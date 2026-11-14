import * as THREE from 'three';
import type { BiologicalSex } from '../store/useAnatomyStore';
import type { AnatomicalPartInfo } from './anatomyParser';

export interface SpatialMeshBounds {
  center: THREE.Vector3;
  maxZ: number;
  radius: number;
  system?: string;
}

/**
 * Normalizes anatomical identifiers, node names, ancestor paths, and material names
 * into a lowercase ASCII space-padded token string so word boundaries work reliably
 * even on underscore-separated GLB names (e.g., `Corpus_cavernosum_of_penis`).
 */
export function normalizeAnatomicalTokens(input: string): string {
  const ascii = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const spaced = ascii
    .replace(/[_\-./():;,[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced ? ` ${spaced} ` : ' ';
}

function collectMaterialNames(material: THREE.Material | THREE.Material[] | undefined): string[] {
  if (!material) return [];
  const list = Array.isArray(material) ? material : [material];
  const names: string[] = [];
  for (const mat of list) {
    if (mat && typeof mat.name === 'string' && mat.name.trim().length > 0) {
      names.push(mat.name.trim());
    }
  }
  return names;
}

const R3F_WRAPPER_PREFIX_REGEX =
  /^(?:Human_Body_Assembly_|NIH_Visible_Human_|Anatomical_Atlas_Root|Sketchfab_System_|Scene$)/i;

function collectRawHierarchyText(obj: THREE.Object3D): string {
  const segments: string[] = [];
  let cursor: THREE.Object3D | null = obj;

  while (cursor) {
    if (cursor.name && R3F_WRAPPER_PREFIX_REGEX.test(cursor.name)) {
      break;
    }
    if (typeof cursor.name === 'string' && cursor.name.trim().length > 0) {
      segments.push(cursor.name.trim());
    }
    const ud = cursor.userData as Record<string, unknown> | undefined;
    if (ud) {
      for (const key of ['anatomicalName', 'organGroupId', 'cleanName', 'nihOrganId']) {
        const val = ud[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          segments.push(val.trim());
        }
      }
    }
    cursor = cursor.parent;
  }

  const mesh = obj as THREE.Mesh;
  if (mesh.material) {
    segments.push(...collectMaterialNames(mesh.material));
  }

  return segments.join(' ');
}

/**
 * Traverses `obj` and all model-internal ancestor parents up to the GLB root,
 * concatenating node names, anatomical userData hints, and material names into a
 * normalized lowercase token string for accurate TA2 / hierarchy-aware sex classification.
 */
export function getFullHierarchyPath(obj: THREE.Object3D): string {
  return normalizeAnatomicalTokens(collectRawHierarchyText(obj));
}

function compilePhraseRegex(terms: readonly string[]): RegExp {
  const escaped = terms.map((term) => {
    const clean = term
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\-./():;,[\]]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  });
  return new RegExp(`(?:^|\\s)(?:${escaped.join('|')})(?=\\s|$)`, 'i');
}

function compilePrefixStemRegex(stems: readonly string[]): RegExp {
  const escaped = stems.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?:^|\\s)(?:${escaped.join('|')})[a-z]*(?=\\s|$)`, 'i');
}

// Exact multi-word and complete-token male-specific TA2 / English / Latin / French terms
const MALE_ONLY_EXACT_TERMS: readonly string[] = [
  // External, Ligaments, Fascia & Erectile
  'penis',
  'verge',
  'glans',
  'glans penis',
  'gland du',
  'prepuce',
  'foreskin',
  'frenulum',
  'frenulum of prepuce',
  'frenulum of penis',
  'suspensory',
  'suspenseur',
  'fundiform',
  'fundiforme',
  'ligament of penis',
  'ligamentum suspensorium',
  'ligamentum fundiforme',
  'suspensory ligament of penis',
  'fundiform ligament of penis',
  'fascia of penis',
  'deep fascia of penis',
  'superficial fascia of penis',
  'buck',
  'buck fascia',
  'colles',
  'tunica albuginea',
  'tunica albuginea of corpora',
  'corpus cavernosum',
  'corpora cavernosa',
  'corps caverneux',
  'caverneux',
  'corpus spongiosum',
  'corps spongieux',
  'spongieux',
  'bulb of penis',
  'bulbus penis',
  'bulbe du penis',
  'crus of penis',
  'crura of penis',
  'pilier du penis',
  'dorsal vein of penis',
  'dorsal veins of penis',
  'dorsal artery of penis',
  'deep artery of penis',
  'dorsal nerve of penis',
  'helicine',
  'navicular fossa',
  'external urethral orifice',
  'urogenital diaphragm',
  'perineal membrane',
  'urogenital region',
  'hairs of head',
  'hairs of eyebrow',
  'eyelashes',
  'pubic hairs',
  // Scrotal & Testicular
  'scrotum',
  'scrotal',
  'dartos',
  'raphe of scrotum',
  'septum of scrotum',
  'testis',
  'testes',
  'appendix of testis',
  'appendix of epididymis',
  'tunica vaginalis',
  'tunica albuginea of testis',
  'mediastinum testis',
  'lobules of testis',
  'rete testis',
  'efferent ductules',
  'external pudendal',
  'genital branch of genitofemoral',
  // Cord, Ducts, Perineal & Glands
  'deferens',
  'deferent',
  'ductus deferens',
  'vas deferens',
  'canal deferent',
  'ampulla of ductus',
  'cremaster',
  'seminal',
  'seminal vesicle',
  'seminal gland',
  'vesicule seminale',
  'glandula vesiculosa',
  'ejaculatory duct',
  'conduit ejaculateur',
  'prostatic utricle',
  'utriculus prostaticus',
  'cowper',
  'spongy urethra',
  'prostatic urethra',
  'membranous urethra',
  'male urethra',
  'urethra',
  'bulbospongiosus',
  'ischiocavernosus',
  'masculin',
];

const MALE_ONLY_PREFIX_STEMS: readonly string[] = [
  'penil',
  'cavernos',
  'spongios',
  'scrot',
  'testi',
  'testicl',
  'testicul',
  'epididym',
  'spermat',
  'cremast',
  'pampiniform',
  'prostat',
  'bulbourethral',
];

// Also support French hyphenated "bulbo-uretral" (becomes "bulbo uretral" after normalization)
const MALE_ONLY_EXTRA_PHRASES: readonly string[] = [
  'bulbo uretral',
  'external pudendal artery',
  'external pudendal veins',
  'genital branch of genitofemoral nerve',
];

const FEMALE_ONLY_EXACT_TERMS: readonly string[] = [
  'uterus',
  'myometrium',
  'endometrium',
  'cervix',
  'ovary',
  'ovaire',
  'fallopian',
  'uterine tube',
  'salpinx',
  'trompe',
  'fimbria',
  'infundibulum of uterine',
  'broad ligament',
  'round ligament of uterus',
  'cardinal ligament',
  'utero ovarian',
  'suspensory ligament of ovary',
  'vagina',
  'fornix of vagina',
  'hymen',
  'vulva',
  'pudendal cleft',
  'mons pubis',
  'labium',
  'labia',
  'clitoris',
  'bulb of vestibule',
  'greater vestibular',
  'bartholin',
  'skene',
  'mammary gland',
  'mammary glands',
  'glandula mammaria',
  'mamma',
  'breast',
  'lactiferous',
  'nipple',
  'areola',
];

const FEMALE_ONLY_PREFIX_STEMS: readonly string[] = [
  'uterin',
  'ovari',
  'vagin',
  'clitorid',
  'pudend',
];

const SPATIAL_SAFE_SHARED_EXCLUSION_REGEX = compilePhraseRegex([
  'rectus abdominis',
  'pyramidalis',
  'obliquus',
  'external oblique',
  'internal oblique',
  'transversus abdominis',
  'adductor',
  'pectineus',
  'gracilis',
  'sartorius',
  'iliopsoas',
  'iliacus',
  'psoas',
  'tensor fasciae latae',
  'lacunar node',
  'lacunar nodes',
  'prevesical',
  'vesical nodes',
  'femoral triangle',
  'femoral artery',
  'femoral vein',
  'femoral nerve',
  'saphenous',
  'obturator',
  'internal pudendal',
  'pudendal nerve',
  'hip bone',
  'sacrum',
  'coccyx',
  'femur',
]);

const MALE_EXACT_REGEX = compilePhraseRegex([
  ...MALE_ONLY_EXACT_TERMS,
  ...MALE_ONLY_EXTRA_PHRASES,
]);
const MALE_STEM_REGEX = compilePrefixStemRegex(MALE_ONLY_PREFIX_STEMS);
const RAW_MALE_TAG_REGEX = /(?:^|[\s/\\_-])(?:male[_-]|[_-]male)(?=$|[\s_.\-/])/i;

const FEMALE_EXACT_REGEX = compilePhraseRegex(FEMALE_ONLY_EXACT_TERMS);
const FEMALE_STEM_REGEX = compilePrefixStemRegex(FEMALE_ONLY_PREFIX_STEMS);
const RAW_FEMALE_TAG_REGEX = /(?:^|[\s/\\_-])(?:female[_-]|[_-]female)(?=$|[\s_.\-/])/i;

export const MALE_ONLY_TA2_TERMS: readonly string[] = [
  ...MALE_ONLY_EXACT_TERMS,
  ...MALE_ONLY_PREFIX_STEMS,
  ...MALE_ONLY_EXTRA_PHRASES,
];

export const FEMALE_ONLY_TA2_TERMS: readonly string[] = [
  ...FEMALE_ONLY_EXACT_TERMS,
  ...FEMALE_ONLY_PREFIX_STEMS,
];

function sanitizeProtectedMaleTokens(normalized: string): string {
  return normalized
    .replace(/\bsuspensory\s+ligament\s+of\s+(?:eyeball|ovary)\b/g, ' ')
    .replace(/\b(?:vh\s+f\s+)?suspensory\s+ligaments\b/g, ' ')
    .replace(/\bfrenula\s+capsulae\b/g, ' ');
}

/**
 * Checks whether a normalized or raw string contains any male-specific TA2/anatomical term.
 * Protects shared "internal pudendal", "pudendal nerve", "suspensory ligament of eyeball/ovary",
 * mammary "suspensory ligaments", and "frenula capsulae".
 */
export function isMaleOnlyText(rawText: string): boolean {
  if (!rawText) return false;
  if (RAW_MALE_TAG_REGEX.test(rawText)) return true;
  const sanitized = sanitizeProtectedMaleTokens(normalizeAnatomicalTokens(rawText));
  return MALE_EXACT_REGEX.test(sanitized) || MALE_STEM_REGEX.test(sanitized);
}

/**
 * Checks whether a normalized or raw string contains any female-specific TA2/anatomical term.
 * Note: shared `Internal_pudendal_*` and `Pudendal_nerve_*` are preserved for both sexes;
 * female external vulvar structures match `pudendal cleft` or explicit female terms.
 */
export function isFemaleOnlyText(rawText: string): boolean {
  if (!rawText) return false;
  if (RAW_FEMALE_TAG_REGEX.test(rawText)) return true;
  const normalized = normalizeAnatomicalTokens(rawText);
  // Protect unisex internal pudendal vessels and pudendal nerve from matching `pudend*`
  const sanitized = normalized
    .replace(/\b(?:internal|external)\s+pudendal\b/g, ' ')
    .replace(/\bpudendal\s+(?:nerve|canal|artery|arteries|vein|veins)\b/g, ' ');
  return FEMALE_EXACT_REGEX.test(sanitized) || FEMALE_STEM_REGEX.test(sanitized);
}

const PROTECTED_FEMALE_OR_SHARED_IN_GROIN_REGEX =
  /\b(?:uterus|ovary|ovaries|ovarian|fallopian|uterine tube|vagina|urinary bladder|broad ligament|round ligament of uterus|clitor|mammary|breast|vh f|female|femoral|iliac|obturator|gluteal|pudendal|pelvic|sacrum|coccyx|hip bone|pubic|ischium|ilium|rectum|anal|sigmoid|colon)\b/i;

const PROTECTED_THIGH_AND_PELVIC_MUSCLE_REGEX =
  /\b(?:adductor|pectineus|gracilis|sartorius|quadriceps|rectus femoris|vastus|iliopsoas|psoas|iliacus|gluteus|piriformis|obturator|gemellus|quadratus femoris|tensor fasciae|rectus abdominis|pyramidalis|obliquus|transversus abdominis|levator ani)\b/i;

/**
 * Spatial Bounding-Box Safety Filter for `FEMALE ♀` mode:
 * Hides ALL male groin, spermatic cord, inguinal, or male subpubic remnants
 * protruding in `|nx| < 0.09`, `-0.22 < ny < -0.05` (standing `0.68..0.905`), `nz > 0.01`,
 * while strictly excluding/protecting skeletal bones, thigh/abdominal muscles,
 * major neurovascular trunks, and female pelvic viscera.
 */
export function isInMaleSubpubicProtrusionZone(
  hierarchyPath: string,
  bounds?: SpatialMeshBounds
): boolean {
  if (!bounds) return false;

  const { center, maxZ, radius, system } = bounds;
  if (system === 'skeletal') return false;
  if (
    system === 'muscular' &&
    PROTECTED_THIGH_AND_PELVIC_MUSCLE_REGEX.test(hierarchyPath)
  ) {
    return false;
  }
  if (
    SPATIAL_SAFE_SHARED_EXCLUSION_REGEX.test(hierarchyPath) ||
    PROTECTED_FEMALE_OR_SHARED_IN_GROIN_REGEX.test(hierarchyPath)
  ) {
    return false;
  }

  // Support normalized `[-1.0, +1.0]`, centered `[-0.9, +0.9]`, and standing `[0, 1.8]` body frames.
  const inStandingBand = center.y >= 0.68 && center.y <= 0.905;
  const inNormalizedOrCenteredBand = center.y > -0.22 && center.y < -0.05;
  if (!inStandingBand && !inNormalizedOrCenteredBand) return false;

  if (Math.abs(center.x) >= 0.09) return false;
  if (radius >= 0.14) return false;

  return center.z > 0.01 || maxZ > 0.025;
}

/**
 * Returns true if the given 3D object belongs strictly to male anatomy.
 */
export function isMaleOnlyMesh(
  obj: THREE.Object3D,
  spatialBounds?: SpatialMeshBounds
): boolean {
  const rawHierarchy = collectRawHierarchyText(obj);
  if (RAW_MALE_TAG_REGEX.test(rawHierarchy)) return true;
  const fullPath = sanitizeProtectedMaleTokens(normalizeAnatomicalTokens(rawHierarchy));
  if (MALE_EXACT_REGEX.test(fullPath) || MALE_STEM_REGEX.test(fullPath)) {
    return true;
  }
  return isInMaleSubpubicProtrusionZone(fullPath, spatialBounds);
}

/**
 * Returns true if the given 3D object belongs strictly to female anatomy.
 */
export function isFemaleOnlyMesh(obj: THREE.Object3D): boolean {
  const rawHierarchy = collectRawHierarchyText(obj);
  return isFemaleOnlyText(rawHierarchy);
}

/**
 * Master sex visibility predicate for any Scene mesh or Object3D.
 */
export function isMeshVisibleForSex(
  obj: THREE.Object3D,
  biologicalSex: BiologicalSex,
  spatialBounds?: SpatialMeshBounds
): boolean {
  const resolvedBounds =
    spatialBounds ??
    (obj.userData?.__spatialBounds as SpatialMeshBounds | undefined);
  if (biologicalSex === 'female') {
    if (obj.userData?.__isMaleOnly === true) return false;
    return !isMaleOnlyMesh(obj, resolvedBounds);
  }
  if (obj.userData?.__isFemaleOnly === true) return false;
  return !isFemaleOnlyMesh(obj);
}

/**
 * Sex filter for Omni-Search (`AnatomicalPartInfo`) catalog entries.
 */
export function isPartVisibleForSex(
  part: AnatomicalPartInfo,
  biologicalSex: BiologicalSex
): boolean {
  const combined = `${part.rawName} ${part.cleanName} ${part.latinName}`;
  if (biologicalSex === 'female') {
    if (isMaleOnlyText(combined)) return false;
    const [cx, cy, cz] = part.worldCenter;
    if (
      isInMaleSubpubicProtrusionZone(normalizeAnatomicalTokens(combined), {
        center: new THREE.Vector3(cx, cy, cz),
        maxZ: cz + part.boundingRadius * 0.5,
        radius: part.boundingRadius,
        system: part.system,
      })
    ) {
      return false;
    }
    return true;
  }
  return !isFemaleOnlyText(combined);
}
