#!/usr/bin/env node
/**
 * Automated NIH HuBMAP / Human Reference Atlas (HRA) 3D Reference Organ Downloader.
 * Queries https://apps.humanatlas.io/api/v1/reference-organs (with CDN fallback)
 * and https://apps.humanatlas.io/api/v1/scene for Visible Human Male (VH_M) and
 * Visible Human Female (VH_F) .glb assets, downloads them concurrently into
 * public/models/nih/male/ and public/models/nih/female/, and writes
 * public/models/nih/manifest.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const NIH_DIR = path.join(ROOT_DIR, 'public', 'models', 'nih');
const MALE_DIR = path.join(NIH_DIR, 'male');
const FEMALE_DIR = path.join(NIH_DIR, 'female');
const MANIFEST_PATH = path.join(NIH_DIR, 'manifest.json');

const HRA_API_URL = 'https://apps.humanatlas.io/api/v1/reference-organs';
const HRA_SCENE_URL = 'https://apps.humanatlas.io/api/v1/scene';
const HRA_CDN_BASE = 'https://cdn.humanatlas.io/digital-objects/ref-organ/';
const CONCURRENCY = 4;

const TARGET_ORGAN_MATCHERS = [
  {
    key: 'skin',
    system: 'integumentary',
    ta98Code: 'A16.0.00.001',
    regex: /^skin$/i,
  },
  {
    key: 'adipose',
    system: 'integumentary',
    ta98Code: 'A01.0.00.000',
    regex: /^adipose$/i,
  },
  {
    key: 'brain',
    system: 'nervous',
    ta98Code: 'A14.1.03.001',
    regex: /^brain$/i,
  },
  {
    key: 'spinal cord',
    system: 'nervous',
    ta98Code: 'A14.1.02.001',
    regex: /^spinal[\s_-]?cord$/i,
  },
  {
    key: 'heart',
    system: 'cardiovascular',
    ta98Code: 'A12.1.00.001',
    regex: /^heart$/i,
  },
  {
    key: 'blood vasculature',
    system: 'cardiovascular',
    ta98Code: 'A12.0.00.001',
    regex: /^blood[\s_-]?vasculature$/i,
  },
  {
    key: 'lymph node',
    system: 'cardiovascular',
    ta98Code: 'A13.0.00.001',
    regex: /^lymph[\s_-]?node$/i,
  },
  {
    key: 'larynx',
    system: 'visceral',
    ta98Code: 'A06.2.01.001',
    regex: /^larynx$/i,
  },
  {
    key: 'trachea',
    system: 'visceral',
    ta98Code: 'A06.3.01.001',
    regex: /^trachea$/i,
  },
  {
    key: 'main bronchus',
    system: 'visceral',
    ta98Code: 'A06.4.01.001',
    regex: /^main[\s_-]?bronchus$/i,
  },
  {
    key: 'lung',
    system: 'visceral',
    ta98Code: 'A06.5.01.001',
    regex: /^(?:left |right )?lungs?$/i,
  },
  {
    key: 'thymus',
    system: 'visceral',
    ta98Code: 'A13.1.01.001',
    regex: /^thymus$/i,
  },
  {
    key: 'palatine tonsil',
    system: 'visceral',
    ta98Code: 'A05.2.01.011',
    regex: /^(?:left |right )?palatine[\s_-]?tonsil$/i,
  },
  {
    key: 'liver',
    system: 'visceral',
    ta98Code: 'A05.8.01.001',
    regex: /^liver$/i,
  },
  {
    key: 'spleen',
    system: 'visceral',
    ta98Code: 'A13.2.01.001',
    regex: /^spleen$/i,
  },
  {
    key: 'pancreas',
    system: 'visceral',
    ta98Code: 'A05.9.01.001',
    regex: /^pancreas$/i,
  },
  {
    key: 'omentum',
    system: 'visceral',
    ta98Code: 'A10.1.02.201',
    regex: /^omentum$/i,
  },
  {
    key: 'small intestine',
    system: 'visceral',
    ta98Code: 'A05.6.01.001',
    regex: /^small[\s_-]?intestine$/i,
  },
  {
    key: 'large intestine',
    system: 'visceral',
    ta98Code: 'A05.7.01.001',
    regex: /^large[\s_-]?intestine$/i,
  },
  {
    key: 'epiploic appendage',
    system: 'visceral',
    ta98Code: 'A05.7.03.005',
    regex: /^epiploic[\s_-]?appendage/i,
  },
  {
    key: 'kidney',
    system: 'visceral',
    ta98Code: 'A08.1.01.001',
    regex: /^(?:left |right )?kidneys?$/i,
  },
  {
    key: 'renal pelvis',
    system: 'visceral',
    ta98Code: 'A08.1.05.001',
    regex: /^(?:left |right )?renal[\s_-]?pelvis$/i,
  },
  {
    key: 'ureter',
    system: 'visceral',
    ta98Code: 'A08.2.01.001',
    regex: /^(?:left |right )?ureter$/i,
  },
  {
    key: 'urinary bladder',
    system: 'visceral',
    ta98Code: 'A08.3.01.001',
    regex: /^urinary[\s_-]?bladder$/i,
  },
  {
    key: 'pelvis',
    system: 'skeletal',
    ta98Code: 'A02.5.02.001',
    regex: /^pelvis$/i,
  },
  {
    key: 'knee',
    system: 'skeletal',
    ta98Code: 'A03.6.08.001',
    regex: /^(?:left |right )?knee$/i,
  },
  {
    key: 'sternum',
    system: 'skeletal',
    ta98Code: 'A02.3.03.001',
    regex: /^sternum$/i,
  },
  {
    key: 'manubrium',
    system: 'skeletal',
    ta98Code: 'A02.3.03.002',
    regex: /^manubrium$/i,
  },
  {
    key: 'intervertebral disk',
    system: 'skeletal',
    ta98Code: 'A03.2.02.003',
    regex: /^intervertebral[\s_-]?disk$/i,
    sex: 'male',
  },
  {
    key: 'prostate',
    system: 'visceral',
    ta98Code: 'A09.3.08.001',
    regex: /^prostate$/i,
    sex: 'male',
  },
  {
    key: 'uterus',
    system: 'visceral',
    ta98Code: 'A09.1.03.001',
    regex: /^uterus$/i,
    sex: 'female',
  },
  {
    key: 'ovary',
    system: 'visceral',
    ta98Code: 'A09.1.01.001',
    regex: /^(?:left |right )?(?:ovary|ovaries)$/i,
    sex: 'female',
  },
  {
    key: 'fallopian tube',
    system: 'visceral',
    ta98Code: 'A09.1.02.001',
    regex: /^(?:left |right )?fallopian[\s_-]?tube$/i,
    sex: 'female',
  },
  {
    key: 'mammary gland',
    system: 'visceral',
    ta98Code: 'A16.0.02.001',
    regex: /^(?:left |right )?mammary[\s_-]?gland$/i,
    sex: 'female',
  },
];

// Fallback catalog slugs matching standard NIH HRA CDN digital objects if primary API is unavailable
const FALLBACK_CDN_CATALOG = [
  { slug: 'skin-male', organKey: 'skin', label: 'skin', sex: 'male', ontologyId: 'UBERON:0002097' },
  { slug: 'skin-female', organKey: 'skin', label: 'skin', sex: 'female', ontologyId: 'UBERON:0002097' },
  { slug: 'brain-male', organKey: 'brain', label: 'brain', sex: 'male', ontologyId: 'UBERON:0000955' },
  { slug: 'brain-female', organKey: 'brain', label: 'brain', sex: 'female', ontologyId: 'UBERON:0000955' },
  { slug: 'heart-male', organKey: 'heart', label: 'heart', sex: 'male', ontologyId: 'UBERON:0000948' },
  { slug: 'heart-female', organKey: 'heart', label: 'heart', sex: 'female', ontologyId: 'UBERON:0000948' },
  { slug: 'lung-male', organKey: 'lung', label: 'lung', sex: 'male', ontologyId: 'UBERON:0002048' },
  { slug: 'lung-female', organKey: 'lung', label: 'lung', sex: 'female', ontologyId: 'UBERON:0002048' },
  { slug: 'liver-male', organKey: 'liver', label: 'liver', sex: 'male', ontologyId: 'UBERON:0002107' },
  { slug: 'liver-female', organKey: 'liver', label: 'liver', sex: 'female', ontologyId: 'UBERON:0002107' },
  { slug: 'stomach-male', organKey: 'stomach', label: 'stomach', sex: 'male', ontologyId: 'UBERON:0000945' },
  { slug: 'stomach-female', organKey: 'stomach', label: 'stomach', sex: 'female', ontologyId: 'UBERON:0000945' },
  { slug: 'kidney-male-left', organKey: 'kidney', label: 'Left kidney', sex: 'male', ontologyId: 'UBERON:0004538' },
  { slug: 'kidney-male-right', organKey: 'kidney', label: 'Right kidney', sex: 'male', ontologyId: 'UBERON:0004539' },
  { slug: 'kidney-female-left', organKey: 'kidney', label: 'Left kidney', sex: 'female', ontologyId: 'UBERON:0004538' },
  { slug: 'kidney-female-right', organKey: 'kidney', label: 'Right kidney', sex: 'female', ontologyId: 'UBERON:0004539' },
  { slug: 'spleen-male', organKey: 'spleen', label: 'spleen', sex: 'male', ontologyId: 'UBERON:0002106' },
  { slug: 'spleen-female', organKey: 'spleen', label: 'spleen', sex: 'female', ontologyId: 'UBERON:0002106' },
  { slug: 'pancreas-male', organKey: 'pancreas', label: 'pancreas', sex: 'male', ontologyId: 'UBERON:0001264' },
  { slug: 'pancreas-female', organKey: 'pancreas', label: 'pancreas', sex: 'female', ontologyId: 'UBERON:0001264' },
  { slug: 'small-intestine-male', organKey: 'small intestine', label: 'small intestine', sex: 'male', ontologyId: 'UBERON:0002108' },
  { slug: 'small-intestine-female', organKey: 'small intestine', label: 'small intestine', sex: 'female', ontologyId: 'UBERON:0002108' },
  { slug: 'large-intestine-male', organKey: 'large intestine', label: 'large intestine', sex: 'male', ontologyId: 'UBERON:0000059' },
  { slug: 'large-intestine-female', organKey: 'large intestine', label: 'large intestine', sex: 'female', ontologyId: 'UBERON:0000059' },
  { slug: 'urinary-bladder-male', organKey: 'urinary bladder', label: 'urinary bladder', sex: 'male', ontologyId: 'UBERON:0001255' },
  { slug: 'urinary-bladder-female', organKey: 'urinary bladder', label: 'urinary bladder', sex: 'female', ontologyId: 'UBERON:0001255' },
  { slug: 'pelvis-male', organKey: 'pelvis', label: 'pelvis', sex: 'male', ontologyId: 'UBERON:0002355' },
  { slug: 'pelvis-female', organKey: 'pelvis', label: 'pelvis', sex: 'female', ontologyId: 'UBERON:0002355' },
  { slug: 'spinal-cord-male', organKey: 'spinal cord', label: 'spinal cord', sex: 'male', ontologyId: 'UBERON:0002240' },
  { slug: 'spinal-cord-female', organKey: 'spinal cord', label: 'spinal cord', sex: 'female', ontologyId: 'UBERON:0002240' },
  { slug: 'blood-vasculature-male', organKey: 'blood vasculature', label: 'blood vasculature', sex: 'male', ontologyId: 'UBERON:0004537' },
  { slug: 'blood-vasculature-female', organKey: 'blood vasculature', label: 'blood vasculature', sex: 'female', ontologyId: 'UBERON:0004537' },
  { slug: 'prostate-male', organKey: 'prostate', label: 'prostate', sex: 'male', ontologyId: 'UBERON:0002367' },
  { slug: 'uterus-female', organKey: 'uterus', label: 'uterus', sex: 'female', ontologyId: 'UBERON:0000995' },
  { slug: 'ovary-female-left', organKey: 'ovary', label: 'Left ovary', sex: 'female', ontologyId: 'UBERON:0002119' },
  { slug: 'ovary-female-right', organKey: 'ovary', label: 'Right ovary', sex: 'female', ontologyId: 'UBERON:0002118' },
  { slug: 'fallopian-tube-female-left', organKey: 'fallopian tube', label: 'Left fallopian tube', sex: 'female', ontologyId: 'UBERON:0001303' },
  { slug: 'fallopian-tube-female-right', organKey: 'fallopian tube', label: 'Right fallopian tube', sex: 'female', ontologyId: 'UBERON:0001302' },
  { slug: 'mammary-gland-female-left', organKey: 'mammary gland', label: 'Left mammary gland', sex: 'female', ontologyId: 'UBERON:0001911' },
  { slug: 'mammary-gland-female-right', organKey: 'mammary gland', label: 'Right mammary gland', sex: 'female', ontologyId: 'UBERON:0001911' },
];

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sanitizeFilename(input) {
  return String(input || 'organ')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferSexFromRecord(item) {
  const raw = JSON.stringify({
    sex: item.sex,
    iri: item['@id'] || item.id || '',
    src: item.object?.file || item.glbUrl || item.url || '',
    label: item.label || item.name || item.organ || '',
  }).toLowerCase();

  if (raw.includes('vh_f') || raw.includes('female')) return 'female';
  if (raw.includes('vh_m') || raw.includes('male')) return 'male';
  return null;
}

function extractOrganSlug(item) {
  const iri = String(item['@id'] || item.reference_organ || '');
  const refPart = iri.split('/ref-organ/')[1];
  if (refPart) {
    return sanitizeFilename(refPart.split('/')[0]);
  }
  const sideSuffix = item.side ? `-${String(item.side).toLowerCase()}` : '';
  const sex = inferSexFromRecord(item) || 'unknown';
  return sanitizeFilename(`${item.label || 'organ'}-${sex}${sideSuffix}`);
}

function matchTargetOrgan(labelText) {
  const clean = String(labelText || '').trim();
  for (const matcher of TARGET_ORGAN_MATCHERS) {
    if (matcher.regex.test(clean)) {
      return matcher;
    }
  }
  return null;
}

function extractGlbUrl(item) {
  if (typeof item.glbUrl === 'string' && item.glbUrl.endsWith('.glb')) {
    return item.glbUrl;
  }
  const objFile =
    item.glbObject?.file ||
    item.object?.file ||
    item.reference_organ_file ||
    item.file;
  if (typeof objFile === 'string' && objFile.includes('.glb')) {
    return objFile.startsWith('http')
      ? objFile
      : `${HRA_CDN_BASE}${objFile.replace(/^\/+/, '')}`;
  }
  return null;
}

function extractSceneTransform(sceneNode, item) {
  // CCF scene API sets +/-0.4m X offset to place male and female side-by-side;
  // keep translation centered in native shared coordinates so master Skin Box3 normalization aligns to [0..1.8m].
  const m = sceneNode?.transformMatrix;
  if (Array.isArray(m) && m.length === 16) {
    const rawTx = Number(m[12]) || 0;
    const rawTy = Number(m[13]) || 0;
    const rawTz = Number(m[14]) || 0;
    const centeredX = Math.abs(Math.abs(rawTx) - 0.4) < 0.05 ? 0 : rawTx;
    return {
      translation: [centeredX, rawTy, rawTz],
      rotation: [0, 0, 0],
      scale: [
        Math.hypot(m[0], m[1], m[2]) || 1,
        Math.hypot(m[4], m[5], m[6]) || 1,
        Math.hypot(m[8], m[9], m[10]) || 1,
      ],
    };
  }

  const placement = item?.placement || item?.object?.placement || item?.transform || {};
  const unitFactor =
    placement.translation_units === 'millimeter' ||
    placement.dimension_units === 'millimeter'
      ? 0.001
      : 1;
  const t = placement.translation;
  const tx = Array.isArray(t) ? Number(t[0]) || 0 : (Number(placement.x_translation) || 0) * unitFactor;
  const ty = Array.isArray(t) ? Number(t[1]) || 0 : (Number(placement.y_translation) || 0) * unitFactor;
  const tz = Array.isArray(t) ? Number(t[2]) || 0 : (Number(placement.z_translation) || 0) * unitFactor;
  const degToRad = Math.PI / 180;
  const rx = (Number(placement.x_rotation) || 0) * degToRad;
  const ry = (Number(placement.y_rotation) || 0) * degToRad;
  const rz = (Number(placement.z_rotation) || 0) * degToRad;
  const sx = Number(placement.x_scaling) || 1;
  const sy = Number(placement.y_scaling) || 1;
  const sz = Number(placement.z_scaling) || 1;

  return {
    translation: [tx, ty, tz],
    rotation: [rx, ry, rz],
    scale: [sx, sy, sz],
  };
}

function normalizeApiResponse(payload, sceneNodes) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.reference_organs)
    ? payload.reference_organs
    : Array.isArray(payload?.items)
    ? payload.items
    : [];

  const sceneByOrganIri = new Map();
  if (Array.isArray(sceneNodes)) {
    for (const node of sceneNodes) {
      const iri = node?.reference_organ || node?.['@id'];
      if (iri && !sceneByOrganIri.has(iri)) {
        sceneByOrganIri.set(iri, node);
      }
    }
  }

  const entries = [];
  const seenSlugs = new Set();

  for (const item of list) {
    const label =
      item.label ||
      item.name ||
      item.organ ||
      item.representation_of_label ||
      '';
    const matcher = matchTargetOrgan(label);
    if (!matcher) continue;

    const sex = inferSexFromRecord(item) || matcher.sex;
    if (!sex) continue;
    if (matcher.sex && matcher.sex !== sex) continue;

    const url = extractGlbUrl(item);
    if (!url) continue;

    const slug = extractOrganSlug(item);
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const ontologyId =
      item.representation_of ||
      item.ontologyId ||
      item.organ_id ||
      'UBERON:0000000';

    const fileName = `${slug}.glb`;
    const localPath = `/models/nih/${sex}/${fileName}`;
    const sceneNode = sceneByOrganIri.get(item['@id'] || item.reference_organ);
    const transform = extractSceneTransform(sceneNode, item);

    entries.push({
      id: slug,
      organKey: matcher.key,
      name: String(label).trim(),
      sex,
      side: item.side || 'Unpaired',
      system: matcher.system,
      ontologyId: String(ontologyId),
      ta98Code: matcher.ta98Code,
      remoteUrl: url,
      localPath,
      fileName,
      downloaded: false,
      placement: transform,
    });
  }
  return entries;
}

function buildFallbackEntries() {
  return FALLBACK_CDN_CATALOG.map((item) => {
    const matcher = matchTargetOrgan(item.label);
    const fileName = `${item.slug}.glb`;
    return {
      id: item.slug,
      organKey: item.organKey,
      name: item.label,
      sex: item.sex,
      side: item.slug.endsWith('-left')
        ? 'Left'
        : item.slug.endsWith('-right')
        ? 'Right'
        : 'Unpaired',
      system: matcher?.system ?? 'visceral',
      ontologyId: item.ontologyId,
      ta98Code: matcher?.ta98Code ?? 'A00.0.00.000',
      remoteUrl: `${HRA_CDN_BASE}${item.slug}/latest/assets/3d-model.glb`,
      localPath: `/models/nih/${item.sex}/${fileName}`,
      fileName,
      downloaded: false,
      placement: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    };
  });
}

async function runPool(items, concurrency, worker) {
  const queue = [...items];
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next) {
          await worker(next);
        }
      }
    }
  );
  await Promise.all(workers);
}

async function cleanupOrphanGlbs(dir, expectedFileNames) {
  try {
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (f.endsWith('.glb') && !expectedFileNames.has(f)) {
        await fs.unlink(path.join(dir, f));
      }
    }
  } catch {
    // Directory may not exist yet
  }
}

async function main() {
  await fs.mkdir(MALE_DIR, { recursive: true });
  await fs.mkdir(FEMALE_DIR, { recursive: true });

  let sourceLabel = 'nih-hra-api-v1';
  let entries = [];

  console.log(`[NIH HRA Fetch] Querying ${HRA_API_URL}...`);
  try {
    const [orgRes, sceneRes] = await Promise.all([
      fetchWithTimeout(HRA_API_URL, 10000),
      fetchWithTimeout(HRA_SCENE_URL, 10000).catch(() => null),
    ]);
    if (!orgRes.ok) {
      throw new Error(`HTTP ${orgRes.status} ${orgRes.statusText}`);
    }
    const json = await orgRes.json();
    const sceneNodes = sceneRes && sceneRes.ok ? await sceneRes.json() : [];
    entries = normalizeApiResponse(json, sceneNodes);
    if (entries.length === 0) {
      throw new Error('API returned 0 matching VH_M/VH_F organ entries');
    }
    console.log(
      `[NIH HRA Fetch] Resolved ${entries.length} unique VH_M/VH_F reference organs from HRA API.`
    );
  } catch (err) {
    sourceLabel = 'nih-hra-cdn-fallback';
    console.warn(
      `[NIH HRA Fetch] API query skipped/unavailable (${err?.message ?? err}). Falling back to HRA CDN manifest targets.`
    );
    entries = buildFallbackEntries();
  }

  // Clean out any legacy duplicate-named .glb files
  await cleanupOrphanGlbs(
    MALE_DIR,
    new Set(entries.filter((e) => e.sex === 'male').map((e) => e.fileName))
  );
  await cleanupOrphanGlbs(
    FEMALE_DIR,
    new Set(entries.filter((e) => e.sex === 'female').map((e) => e.fileName))
  );

  let downloadedCount = 0;
  let skippedCount = 0;

  await runPool(entries, CONCURRENCY, async (entry) => {
    const outDir = entry.sex === 'female' ? FEMALE_DIR : MALE_DIR;
    const destPath = path.join(outDir, entry.fileName);

    try {
      const existingStat = await fs.stat(destPath);
      if (existingStat.size > 128) {
        entry.downloaded = true;
        downloadedCount += 1;
        return;
      }
    } catch {
      // Not cached locally yet
    }

    try {
      const res = await fetchWithTimeout(entry.remoteUrl, 30000);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength < 128) {
        throw new Error(`Unexpected small payload (${buffer.byteLength} bytes)`);
      }
      await fs.writeFile(destPath, buffer);
      entry.downloaded = true;
      downloadedCount += 1;
      console.log(
        `  ✓ Downloaded ${entry.localPath} (${(buffer.byteLength / 1024).toFixed(1)} KB)`
      );
    } catch (err) {
      entry.downloaded = false;
      skippedCount += 1;
      console.warn(
        `  • Offline/unavailable fallback for ${entry.localPath} (${err?.message ?? err})`
      );
    }
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: sourceLabel,
    stats: {
      totalTargets: entries.length,
      downloadedCount,
      offlineFallbackCount: skippedCount,
    },
    male: entries
      .filter((e) => e.sex === 'male')
      .map(({ fileName: _fn, ...rest }) => rest),
    female: entries
      .filter((e) => e.sex === 'female')
      .map(({ fileName: _fn, ...rest }) => rest),
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(
    `[NIH HRA Fetch] Manifest written to public/models/nih/manifest.json (${downloadedCount} downloaded, ${skippedCount} offline-fallback ready).`
  );
}

main().catch((err) => {
  console.error('[NIH HRA Fetch] Fatal error:', err);
  process.exitCode = 0;
});
