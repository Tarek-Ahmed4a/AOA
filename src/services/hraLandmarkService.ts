import * as THREE from 'three';
import {
  HRA_LANDMARK_GLB_PREFIX,
  HRA_LANDMARK_ORG_PREFIX,
  HRA_LANDMARK_UBERON_PREFIX,
  STATIC_HRA_LANDMARK_ROWS,
  type CompactHraLandmarkFallbackRow,
} from './hraLandmarkFallback';

/**
 * Official NIH HRA RUI Reference Data Endpoint (OpenAPI v0.20.0).
 * Houses CCF spatial entities, organ extractionSets (including $$Landmarks), and 4x4 scene transforms.
 */
export const HRA_RUI_REFERENCE_DATA_URL =
  'https://apps.humanatlas.io/api/v1/rui-reference-data';

export interface HraLandmarkSubmesh {
  id: string;
  label: string;
  subNode: string;
}

export interface HraSurgicalLandmarkGlb {
  id: string;
  parentOrganKey: string;
  parentOrganSlug: string;
  parentOrganLabel: string;
  ontologyId: string;
  sex: 'male' | 'female';
  side: 'left' | 'right' | 'center';
  glbUrl: string;
  fileName: string;
  /** Column-major 4x4 matrix aligning the landmark GLB relative to its parent organ's GLB space. */
  relativeMatrix: number[];
  subMeshes: HraLandmarkSubmesh[];
}

export interface HraLandmarkMatchQuery {
  organKey?: string | null;
  organId?: string | null;
  organLabel?: string | null;
  ontologyId?: string | null;
  glbUrl?: string | null;
  sex?: 'male' | 'female' | null;
}

interface RawRuiExtractionSite {
  '@id'?: string;
  label?: string;
}

interface RawRuiExtractionSet {
  '@id'?: string;
  label?: string;
  extractionSites?: RawRuiExtractionSite[];
}

interface RawRuiOrganSpatialEntity {
  '@id'?: string;
  label?: string;
  organName?: string;
  sex?: string;
  representation_of?: string;
}

interface RawRuiSceneNode {
  '@id'?: string;
  label?: string;
  scenegraph?: string;
  scenegraphNode?: string;
  transformMatrix?: number[];
}

interface RawRuiReferenceData {
  organSpatialEntities?: Record<string, RawRuiOrganSpatialEntity>;
  extractionSets?: Record<string, RawRuiExtractionSet[]>;
  sceneNodeLookup?: Record<string, RawRuiSceneNode>;
}

const LANDMARK_CACHE_KEY = 'hra_rui_surgical_landmarks_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IDENTITY_MATRIX: number[] = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

/** Strict exclusion against donor tissue blocks, extraction cubes, Millitomes & synthetic cell point clouds. */
const EXCLUDED_LANDMARK_NOISE_REGEX =
  /millitome|tissue[-_\s]?block|point[-_\s]?cloud|synthetic[-_\s]?cell|donor|\b(1x6|2x3)\b|(?:^|[_\-\s])extraction[-_\s]?site/i;

let memoryLandmarksCache: HraSurgicalLandmarkGlb[] | null = null;
let inflightLandmarksPromise: Promise<HraSurgicalLandmarkGlb[]> | null = null;

function expandCompactFallbackRows(
  rows: CompactHraLandmarkFallbackRow[]
): HraSurgicalLandmarkGlb[] {
  return rows.map((row) => {
    const parentOrganKey = row.k.startsWith('http')
      ? row.k
      : `${HRA_LANDMARK_ORG_PREFIX}${row.k}`;
    const glbUrl = row.u.startsWith('http')
      ? row.u
      : `${HRA_LANDMARK_GLB_PREFIX}${row.u}`;
    const ontologyId = row.ont
      ? row.ont.startsWith('http')
        ? row.ont
        : `${HRA_LANDMARK_UBERON_PREFIX}${row.ont}`
      : '';
    const fileName = glbUrl.split('/').pop() || row.u;

    return {
      id: `${row.sl}::${fileName}`,
      parentOrganKey,
      parentOrganSlug: row.sl,
      parentOrganLabel: row.ol,
      ontologyId,
      sex: row.sx,
      side: row.sd,
      glbUrl,
      fileName,
      relativeMatrix: [...IDENTITY_MATRIX],
      subMeshes: row.n.map(([label, subNode], idx) => ({
        id: `${parentOrganKey}#landmark-${idx}`,
        label,
        subNode,
      })),
    };
  });
}

const STATIC_LANDMARKS_FALLBACK: HraSurgicalLandmarkGlb[] =
  expandCompactFallbackRows(STATIC_HRA_LANDMARK_ROWS);

function computeRelativeMatrix(
  organMatrix?: number[],
  siteMatrix?: number[]
): number[] {
  if (
    !Array.isArray(organMatrix) ||
    organMatrix.length !== 16 ||
    !Array.isArray(siteMatrix) ||
    siteMatrix.length !== 16
  ) {
    return [...IDENTITY_MATRIX];
  }

  let maxDelta = 0;
  for (let i = 0; i < 16; i += 1) {
    maxDelta = Math.max(maxDelta, Math.abs(organMatrix[i] - siteMatrix[i]));
  }
  if (maxDelta < 1e-6) {
    return [...IDENTITY_MATRIX];
  }

  const invOrgan = new THREE.Matrix4().fromArray(organMatrix);
  if (Math.abs(invOrgan.determinant()) < 1e-12) {
    return [...IDENTITY_MATRIX];
  }
  invOrgan.invert();
  const siteMat = new THREE.Matrix4().fromArray(siteMatrix);
  return invOrgan.multiply(siteMat).toArray();
}

function parseSlugFromOrganKey(organKey: string): string {
  const clean = organKey.split('#')[0] || organKey;
  const parts = clean.split('/').filter(Boolean);
  const refIdx = parts.indexOf('ref-organ');
  if (refIdx >= 0 && parts[refIdx + 1]) {
    return parts[refIdx + 1].toLowerCase();
  }
  if (parts.length >= 2 && /^v\d+/i.test(parts[parts.length - 1])) {
    return parts[parts.length - 2].toLowerCase();
  }
  return (parts[parts.length - 1] || organKey).toLowerCase();
}

function inferSideFromText(text: string): 'left' | 'right' | 'center' {
  const lower = text.toLowerCase();
  if (
    lower.includes('-left') ||
    /\bleft\b/.test(lower) ||
    /(?:_|\b)l(?:_|$)/.test(lower)
  ) {
    return 'left';
  }
  if (
    lower.includes('-right') ||
    /\bright\b/.test(lower) ||
    /(?:_|\b)r(?:_|$)/.test(lower)
  ) {
    return 'right';
  }
  return 'center';
}

function parseRuiReferenceData(
  payload: RawRuiReferenceData
): HraSurgicalLandmarkGlb[] {
  const extractionSets = payload.extractionSets ?? {};
  const organEntities = payload.organSpatialEntities ?? {};
  const sceneLookup = payload.sceneNodeLookup ?? {};

  const grouped = new Map<string, HraSurgicalLandmarkGlb>();

  for (const [organKey, sets] of Object.entries(extractionSets)) {
    if (!Array.isArray(sets)) continue;
    const entity = organEntities[organKey];
    const organNode = sceneLookup[organKey];
    const slug = parseSlugFromOrganKey(organKey);
    const sexRaw = (entity?.sex ?? (slug.includes('female') ? 'female' : 'male')).toLowerCase();
    const sex: 'male' | 'female' = sexRaw === 'female' ? 'female' : 'male';
    const side: 'left' | 'right' | 'center' = slug.includes('-left')
      ? 'left'
      : slug.includes('-right')
        ? 'right'
        : 'center';
    const rawOrganLabel =
      entity?.label ?? entity?.organName ?? slug.replace(/[-_]/g, ' ');
    const organLabel = rawOrganLabel.replace(/,\s*(left|right)$/i, '').trim();
    const ontologyId = String(entity?.representation_of ?? '');

    for (const set of sets) {
      const setId = String(set?.['@id'] ?? '');
      const setLabel = String(set?.label ?? '').trim();
      const isOfficialLandmarkSet =
        setId.includes('$$Landmarks') || setLabel.toLowerCase() === 'landmarks';
      if (!isOfficialLandmarkSet) continue;

      for (const site of set.extractionSites ?? []) {
        const siteId = String(site?.['@id'] ?? '');
        const sceneNode = sceneLookup[siteId];
        const glbUrl = String(sceneNode?.scenegraph ?? '');
        if (!glbUrl || !glbUrl.includes('/landmark/') || !glbUrl.toLowerCase().endsWith('.glb')) {
          continue;
        }

        const label = String(site?.label ?? sceneNode?.label ?? '').trim();
        const subNode = String(sceneNode?.scenegraphNode ?? '').trim();

        // Keep kidney Bisection Lines even though hosted in *Kidney_Extraction_Sites.glb,
        // while excluding any accidental cube/Millitome/tissue-block/point-cloud noise.
        const isBisectionLine = /bisection[-_\s]?line/i.test(`${label} ${subNode}`);
        if (!isBisectionLine && EXCLUDED_LANDMARK_NOISE_REGEX.test(`${label} ${subNode}`)) {
          continue;
        }

        const mapKey = `${organKey}|${glbUrl}`;
        let group = grouped.get(mapKey);
        if (!group) {
          const fileName = glbUrl.split('/').pop() || glbUrl;
          group = {
            id: `${slug}::${fileName}`,
            parentOrganKey: organKey,
            parentOrganSlug: slug,
            parentOrganLabel: organLabel,
            ontologyId,
            sex,
            side,
            glbUrl,
            fileName,
            relativeMatrix: computeRelativeMatrix(
              organNode?.transformMatrix,
              sceneNode?.transformMatrix
            ),
            subMeshes: [],
          };
          grouped.set(mapKey, group);
        }

        const duplicateSub = group.subMeshes.some(
          (existing) =>
            existing.subNode === subNode &&
            existing.label.toLowerCase() === label.toLowerCase()
        );
        if (!duplicateSub) {
          group.subMeshes.push({
            id: siteId || `${organKey}#${subNode || label}`,
            label: label || subNode.replace(/[_-]+/g, ' '),
            subNode,
          });
        }
      }
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) =>
      a.parentOrganSlug.localeCompare(b.parentOrganSlug) ||
      a.fileName.localeCompare(b.fileName)
  );
}

function readLocalStorageLandmarks(): HraSurgicalLandmarkGlb[] | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LANDMARK_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      timestamp?: number;
      items?: HraSurgicalLandmarkGlb[];
    };
    if (
      !parsed.timestamp ||
      !Array.isArray(parsed.items) ||
      parsed.items.length === 0 ||
      Date.now() - parsed.timestamp > CACHE_TTL_MS
    ) {
      return null;
    }
    return parsed.items;
  } catch {
    return null;
  }
}

function writeLocalStorageLandmarks(items: HraSurgicalLandmarkGlb[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      LANDMARK_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), items })
    );
  } catch {
    // Ignore quota limits cleanly
  }
}

/**
 * Synchronously returns cached NIH HRA anatomical/surgical landmark GLBs or the built-in static fallback index.
 */
export function getCachedHraSurgicalLandmarksSync(): HraSurgicalLandmarkGlb[] {
  if (memoryLandmarksCache && memoryLandmarksCache.length > 0) {
    return memoryLandmarksCache;
  }
  const fromStorage = readLocalStorageLandmarks();
  if (fromStorage && fromStorage.length > 0) {
    memoryLandmarksCache = fromStorage;
    return fromStorage;
  }
  return STATIC_LANDMARKS_FALLBACK;
}

/**
 * Fetches, parses, and caches the official NIH HRA anatomical & surgical landmark `.glb` index
 * from GET https://apps.humanatlas.io/api/v1/rui-reference-data, falling back cleanly offline.
 */
export async function getHraSurgicalLandmarks(
  forceRefresh = false
): Promise<HraSurgicalLandmarkGlb[]> {
  if (!forceRefresh) {
    if (memoryLandmarksCache && memoryLandmarksCache.length > 0) {
      return memoryLandmarksCache;
    }
    const stored = readLocalStorageLandmarks();
    if (stored && stored.length > 0) {
      memoryLandmarksCache = stored;
      return stored;
    }
  }

  if (inflightLandmarksPromise && !forceRefresh) {
    return inflightLandmarksPromise;
  }

  inflightLandmarksPromise = (async () => {
    try {
      const res = await fetch(HRA_RUI_REFERENCE_DATA_URL, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`HRA RUI reference data HTTP ${res.status}`);
      }
      const data = (await res.json()) as RawRuiReferenceData;
      const parsed = parseRuiReferenceData(data);
      if (parsed.length === 0) {
        return STATIC_LANDMARKS_FALLBACK;
      }
      memoryLandmarksCache = parsed;
      writeLocalStorageLandmarks(parsed);
      return parsed;
    } catch {
      const existing = getCachedHraSurgicalLandmarksSync();
      memoryLandmarksCache = existing;
      return existing;
    } finally {
      inflightLandmarksPromise = null;
    }
  })();

  return inflightLandmarksPromise;
}

function normalizeOntologyCurie(raw?: string | null): string {
  if (!raw) return '';
  const tail = raw.split('/').pop() || raw;
  return tail.replace(':', '_').toUpperCase();
}

function normalizeOrganNameTokens(raw?: string | null): {
  tokens: string[];
  sexHint: 'male' | 'female' | null;
  sideHint: 'left' | 'right' | 'center';
} {
  if (!raw) return { tokens: [], sexHint: null, sideHint: 'center' };
  const lower = raw.toLowerCase();
  const sexHint: 'male' | 'female' | null = lower.includes('female') || lower.includes('♀')
    ? 'female'
    : lower.includes('male') || lower.includes('♂')
      ? 'male'
      : null;

  const cleaned = lower
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bnih\b|\bhra\b|\bvhm\b|\bvhf\b|\bmale\b|\bfemale\b|\b3d\b/g, ' ')
    .replace(/colon\b/g, 'large intestine')
    .replace(/gallbladder\b/g, 'liver')
    .replace(/main bronchi\b/g, 'main bronchus')
    .replace(/lungs\b/g, 'lung')
    .replace(/ovaries\b/g, 'ovary')
    .replace(/ureters\b/g, 'ureter')
    .replace(/kidneys\b/g, 'kidney')
    .replace(/fallopian tubes\b/g, 'fallopian tube')
    .replace(/mammary glands|breast\b/g, 'mammary gland')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const sideHint = inferSideFromText(cleaned);
  const stopWords = new Set(['of', 'the', 'and', 'in', 'human', 'organ', 'left', 'right']);
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stopWords.has(t));

  return { tokens, sexHint, sideHint };
}

/**
 * Matches all NIH HRA landmark GLB overlays associated with an anatomical organ or Explorer card.
 */
export function matchLandmarksForOrgan(
  query: HraLandmarkMatchQuery,
  catalogList?: HraSurgicalLandmarkGlb[]
): HraSurgicalLandmarkGlb[] {
  const catalog =
    catalogList && catalogList.length > 0
      ? catalogList
      : getCachedHraSurgicalLandmarksSync();

  const nameInfo = normalizeOrganNameTokens(query.organLabel);
  const effectiveSex = query.sex ?? nameInfo.sexHint;
  const sexPool = effectiveSex
    ? catalog.filter((item) => item.sex === effectiveSex)
    : catalog;

  // 1. Direct parentOrganKey IRI match
  const rawKey = query.organKey?.trim() ?? '';
  if (rawKey) {
    const cleanKeyBase = rawKey.split('#')[0].toLowerCase();
    const byIri = catalog.filter(
      (item) =>
        item.parentOrganKey.toLowerCase() === rawKey.toLowerCase() ||
        item.parentOrganKey.split('#')[0].toLowerCase() === cleanKeyBase
    );
    if (byIri.length > 0) return byIri;
  }

  // 2. Slug match (supports Explorer keys like "nih-male-kidney-male-left" or raw "kidney-male-left")
  const candidateSlugSources = [query.organId, query.organKey]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map((v) =>
      v
        .trim()
        .toLowerCase()
        .replace(/^nih-(male|female)-/, '')
        .split('#')[0]
    );

  for (const slugCandidate of candidateSlugSources) {
    const bySlug = catalog.filter(
      (item) =>
        item.parentOrganSlug === slugCandidate ||
        slugCandidate.endsWith(`/${item.parentOrganSlug}`)
    );
    if (bySlug.length > 0) return bySlug;
  }

  // 3. Reference GLB filename match (only for non-blob remote/local ref-organ URLs)
  if (query.glbUrl && !query.glbUrl.startsWith('blob:')) {
    const glbLower = query.glbUrl.toLowerCase();
    const glbMatch = glbLower.match(/\/ref-organ\/([^/]+)\//);
    if (glbMatch?.[1]) {
      const slugFromUrl = glbMatch[1];
      const byUrlSlug = catalog.filter(
        (item) => item.parentOrganSlug === slugFromUrl
      );
      if (byUrlSlug.length > 0) return byUrlSlug;
    }
  }

  // 4. Ontology CURIE (UBERON) + sex + optional laterality match
  const curie = normalizeOntologyCurie(query.ontologyId);
  if (curie) {
    const byOntology = sexPool.filter(
      (item) => normalizeOntologyCurie(item.ontologyId) === curie
    );
    if (byOntology.length > 0) {
      if (nameInfo.sideHint !== 'center') {
        const sideFiltered = byOntology.filter(
          (item) => item.side === nameInfo.sideHint || item.side === 'center'
        );
        if (sideFiltered.length > 0) return sideFiltered;
      }
      return byOntology;
    }
  }

  // 5. Anatomical label token + sex + laterality match
  if (nameInfo.tokens.length > 0) {
    const exactMatches: HraSurgicalLandmarkGlb[] = [];
    for (const item of sexPool) {
      if (
        nameInfo.sideHint !== 'center' &&
        item.side !== 'center' &&
        item.side !== nameInfo.sideHint
      ) {
        continue;
      }
      const itemLabelClean = normalizeOrganNameTokens(item.parentOrganLabel);
      if (itemLabelClean.tokens.length === 0) continue;
      const allItemTokensPresent = itemLabelClean.tokens.every((t) =>
        nameInfo.tokens.includes(t)
      );
      const exactSameTokens =
        allItemTokensPresent &&
        nameInfo.tokens.length === itemLabelClean.tokens.length;
      if (exactSameTokens || allItemTokensPresent) {
        exactMatches.push(item);
      }
    }
    if (exactMatches.length > 0) return exactMatches;
  }

  return [];
}
