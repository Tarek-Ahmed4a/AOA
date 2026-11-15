import {
  resolveClinicalBaseline,
  translateAnatomicalTermToArabic,
} from '../data/clinicalBaseline';
import type { AnatomicalClinicalProfile } from '../types/medicalData';
import type { AnatomicalPartInfo } from '../utils/anatomyParser';

const CACHE_KEY_PREFIX = 'anatomy_atlas_med_v5_';
const LEGACY_CACHE_PREFIXES = [
  'anatomy_atlas_med_v1_',
  'anatomy_atlas_med_v2_',
  'anatomy_atlas_med_v3_',
  'anatomy_atlas_med_v4_',
];
const API_TIMEOUT_MS = 4500;

function purgeLegacyMedicalCaches(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (LEGACY_CACHE_PREFIXES.some((prefix) => k.startsWith(prefix))) {
        keysToDelete.push(k);
        continue;
      }
      if (k.startsWith(CACHE_KEY_PREFIX)) {
        const val = window.localStorage.getItem(k) || '';
        if (/\bPart\s*\d+\b|الجزء/.test(val)) {
          keysToDelete.push(k);
        }
      }
    }
    for (const k of keysToDelete) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage quota/security errors
  }
}

purgeLegacyMedicalCaches();

interface WikiRestSummary {
  title?: string;
  type?: string;
  description?: string;
  wikibase_item?: string;
  extract?: string;
  thumbnail?: {
    source?: string;
  };
  originalimage?: {
    source?: string;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
}

interface WikidataEntity {
  id?: string;
  missing?: string;
  labels?: Record<string, { value?: string }>;
  descriptions?: Record<string, { value?: string }>;
  sitelinks?: Record<string, { title?: string }>;
  claims?: Record<
    string,
    Array<{
      mainsnak?: {
        datavalue?: {
          value?: string | { id?: string };
        };
      };
    }>
  >;
}

interface AnatomicalDisambiguationEntry {
  en: string;
  ar: string;
  qid: string;
  ta98?: string;
}

const WIKIPEDIA_ANATOMICAL_DISAMBIGUATION_MAP: Record<
  string,
  AnatomicalDisambiguationEntry
> = {
  'right ventricle': {
    en: 'Right_ventricle',
    ar: 'بطين أيمن',
    qid: 'Q735622',
    ta98: 'A12.1.02.001',
  },
  'left ventricle': {
    en: 'Left_ventricle',
    ar: 'بطين أيسر',
    qid: 'Q735645',
    ta98: 'A12.1.03.001',
  },
  'right atrium': {
    en: 'Right_atrium',
    ar: 'أذين أيمن',
    qid: 'Q1069103',
    ta98: 'A12.1.01.001',
  },
  'left atrium': {
    en: 'Left_atrium',
    ar: 'أذين أيسر',
    qid: 'Q1069092',
    ta98: 'A12.1.04.001',
  },
  'lateral ventricle': {
    en: 'Lateral_ventricles',
    ar: 'بطين وحشي',
    qid: 'Q1414180',
    ta98: 'A14.1.09.271',
  },
  'third ventricle': {
    en: 'Third_ventricle',
    ar: 'بطين ثالث',
    qid: 'Q1258281',
    ta98: 'A14.1.08.414',
  },
  'fourth ventricle': {
    en: 'Fourth_ventricle',
    ar: 'بطين رابع',
    qid: 'Q1353345',
    ta98: 'A14.1.05.713',
  },
  ventricle: {
    en: 'Ventricle_(heart)',
    ar: 'بطين (قلب)',
    qid: 'Q180516',
  },
  atrium: {
    en: 'Atrium_(heart)',
    ar: 'أذين (قلب)',
    qid: 'Q1074839',
  },
  'interventricular septum': {
    en: 'Interventricular_septum',
    ar: 'حاجز بين البطينين',
    qid: 'Q1185950',
    ta98: 'A12.1.00.015',
  },
  'interatrial septum': {
    en: 'Interatrial_septum',
    ar: 'حاجز بين الأذينين',
    qid: 'Q2587424',
    ta98: 'A12.1.00.012',
  },
  'tricuspid valve': {
    en: 'Tricuspid_valve',
    ar: 'صمام ثلاثي الشرفات',
    qid: 'Q841450',
    ta98: 'A12.1.02.003',
  },
  'mitral valve': {
    en: 'Mitral_valve',
    ar: 'صمام تاجي',
    qid: 'Q830479',
    ta98: 'A12.1.03.003',
  },
  'bicuspid valve': {
    en: 'Mitral_valve',
    ar: 'صمام تاجي',
    qid: 'Q830479',
    ta98: 'A12.1.03.003',
  },
  'aortic valve': {
    en: 'Aortic_valve',
    ar: 'صمام أبهري',
    qid: 'Q1342670',
    ta98: 'A12.1.03.012',
  },
  'pulmonary valve': {
    en: 'Pulmonary_valve',
    ar: 'صمام رئوي',
    qid: 'Q1419140',
    ta98: 'A12.1.02.012',
  },
  'papillary muscle': {
    en: 'Papillary_muscle',
    ar: 'عضلة حليمية',
    qid: 'Q2153647',
    ta98: 'A12.1.02.008',
  },
  'papillary muscles': {
    en: 'Papillary_muscle',
    ar: 'عضلة حليمية',
    qid: 'Q2153647',
    ta98: 'A12.1.02.008',
  },
  'chordae tendineae': {
    en: 'Chordae_tendineae',
    ar: 'حبال وترية',
    qid: 'Q910085',
    ta98: 'A12.1.02.009',
  },
  'coronary sinus': {
    en: 'Coronary_sinus',
    ar: 'جيب إكليلي',
    qid: 'Q1412894',
    ta98: 'A12.3.01.002',
  },
  'cerebral cortex': {
    en: 'Cerebral_cortex',
    ar: 'قشرة مخية',
    qid: 'Q75839',
    ta98: 'A14.1.09.003',
  },
  'frontal lobe': {
    en: 'Frontal_lobe',
    ar: 'فص جبهي',
    qid: 'Q749520',
    ta98: 'A14.1.09.110',
  },
  'parietal lobe': {
    en: 'Parietal_lobe',
    ar: 'فص جداري',
    qid: 'Q815331',
    ta98: 'A14.1.09.124',
  },
  'temporal lobe': {
    en: 'Temporal_lobe',
    ar: 'فص صدغي',
    qid: 'Q673083',
    ta98: 'A14.1.09.138',
  },
  'occipital lobe': {
    en: 'Occipital_lobe',
    ar: 'فص قذالي',
    qid: 'Q848340',
    ta98: 'A14.1.09.131',
  },
  hypothalamus: {
    en: 'Hypothalamus',
    ar: 'تحت المهاد',
    qid: 'Q164386',
    ta98: 'A14.1.08.401',
  },
  insula: {
    en: 'Insular_cortex',
    ar: 'فص جزيري',
    qid: 'Q839773',
    ta98: 'A14.1.09.149',
  },
  'insular cortex': {
    en: 'Insular_cortex',
    ar: 'فص جزيري',
    qid: 'Q839773',
    ta98: 'A14.1.09.149',
  },
  fornix: {
    en: 'Fornix_(neuroanatomy)',
    ar: 'قبو الدماغ',
    qid: 'Q1438018',
    ta98: 'A14.1.09.257',
  },
  claustrum: {
    en: 'Claustrum',
    ar: 'جدار (تشريح)',
    qid: 'Q1099015',
    ta98: 'A14.1.09.423',
  },
  atlas: {
    en: 'Atlas_(anatomy)',
    ar: 'أطلس (تشريح)',
    qid: 'Q211398',
    ta98: 'A02.2.02.101',
  },
  axis: {
    en: 'Axis_(anatomy)',
    ar: 'محور (تشريح)',
    qid: 'Q242087',
    ta98: 'A02.2.02.201',
  },
  radius: {
    en: 'Radius_(bone)',
    ar: 'كعبرة (عظم)',
    qid: 'Q178532',
    ta98: 'A02.4.05.001',
  },
  ulna: {
    en: 'Ulna',
    ar: 'زند',
    qid: 'Q178652',
    ta98: 'A02.4.06.001',
  },
  iris: {
    en: 'Iris_(anatomy)',
    ar: 'قزحية',
    qid: 'Q178748',
    ta98: 'A15.2.03.020',
  },
  pupil: {
    en: 'Pupil',
    ar: 'حدقة',
    qid: 'Q173318',
    ta98: 'A15.2.03.028',
  },
  lens: {
    en: 'Lens_(vertebrate_anatomy)',
    ar: 'عدسة العين',
    qid: 'Q146701',
    ta98: 'A15.2.05.001',
  },
  palate: {
    en: 'Palate',
    ar: 'حنك',
    qid: 'Q166418',
    ta98: 'A05.1.01.102',
  },
  pharynx: {
    en: 'Pharynx',
    ar: 'بلعوم',
    qid: 'Q174778',
    ta98: 'A05.3.01.001',
  },
  temple: {
    en: 'Temple_(anatomy)',
    ar: 'صدغ',
    qid: 'Q242657',
  },
  trunk: {
    en: 'Torso',
    ar: 'جذع (تشريح)',
    qid: 'Q160695',
    ta98: 'A01.1.00.013',
  },
  bridge: {
    en: 'Nasal_bridge',
    ar: 'جسر الأنف',
    qid: 'Q6966549',
  },
  arch: {
    en: 'Aortic_arch',
    ar: 'قوس الأبهر',
    qid: 'Q616025',
  },
  valve: {
    en: 'Heart_valve',
    ar: 'صمام القلب',
    qid: 'Q274082',
  },
  cortex: {
    en: 'Cerebral_cortex',
    ar: 'قشرة مخية',
    qid: 'Q75839',
    ta98: 'A14.1.09.003',
  },
  medulla: {
    en: 'Medulla_oblongata',
    ar: 'نخاع مستطيل',
    qid: 'Q189033',
    ta98: 'A14.1.04.001',
  },
  pons: {
    en: 'Pons',
    ar: 'جسر (دماغ)',
    qid: 'Q189779',
    ta98: 'A14.1.05.001',
  },
  pineal: {
    en: 'Pineal_gland',
    ar: 'غدة صنوبرية',
    qid: 'Q198654',
    ta98: 'A11.2.00.001',
  },
  'pineal gland': {
    en: 'Pineal_gland',
    ar: 'غدة صنوبرية',
    qid: 'Q198654',
    ta98: 'A11.2.00.001',
  },
  pituitary: {
    en: 'Pituitary_gland',
    ar: 'غدة نخامية',
    qid: 'Q156871',
    ta98: 'A11.1.00.001',
  },
  'pituitary gland': {
    en: 'Pituitary_gland',
    ar: 'غدة نخامية',
    qid: 'Q156871',
    ta98: 'A11.1.00.001',
  },
  crown: {
    en: 'Crown_(tooth)',
    ar: 'تاج السن',
    qid: 'Q1463504',
    ta98: 'A05.1.03.004',
  },
  nail: {
    en: 'Nail_(anatomy)',
    ar: 'ظفر',
    qid: 'Q36864',
    ta98: 'A16.0.01.001',
  },
  root: {
    en: 'Root_(anatomy)',
    ar: 'جذر السن',
    qid: 'Q7366552',
  },
  neck: {
    en: 'Neck',
    ar: 'رقبة',
    qid: 'Q9633',
    ta98: 'A01.1.00.012',
  },
  head: {
    en: 'Human_head',
    ar: 'رأس الإنسان',
    qid: 'Q23640',
    ta98: 'A01.1.00.001',
  },
  body: {
    en: 'Human_body',
    ar: 'جسم الإنسان',
    qid: 'Q23852',
    ta98: 'A01.0.00.000',
  },
  spine: {
    en: 'Vertebral_column',
    ar: 'عمود فقري',
    qid: 'Q483496',
    ta98: 'A02.2.00.001',
  },
  sinus: {
    en: 'Paranasal_sinuses',
    ar: 'جيوب أنفية',
    qid: 'Q215862',
    ta98: 'A06.1.03.001',
  },
};

const EXACT_ONLY_DISAMBIGUATION_KEYS = new Set([
  'head',
  'body',
  'neck',
  'root',
  'crown',
  'arch',
  'bridge',
  'canal',
  'crest',
  'horn',
  'process',
  'sinus',
  'valve',
  'cortex',
  'trunk',
]);

function lookupAnatomicalDisambiguation(
  cleanName: string,
  system: AnatomicalPartInfo['system']
): AnatomicalDisambiguationEntry | undefined {
  const normalized = cleanName
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/\b(?:of|the|human)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const strippedSide = normalized
    .replace(/^(?:left|right)\s+/, '')
    .trim();

  // Exact full phrase first (e.g. "right ventricle", "lateral ventricle", "tricuspid valve")
  if (WIKIPEDIA_ANATOMICAL_DISAMBIGUATION_MAP[normalized]) {
    const exact = WIKIPEDIA_ANATOMICAL_DISAMBIGUATION_MAP[normalized];
    if (normalized === 'ventricle' && system === 'nervous') {
      return {
        en: 'Ventricular_system',
        ar: 'جهاز بطيني',
        qid: 'Q1414180',
      };
    }
    return exact;
  }

  // Substring phrase matching longest-first, excluding bare generic single-word keys
  const phraseKeys = Object.keys(WIKIPEDIA_ANATOMICAL_DISAMBIGUATION_MAP)
    .filter((k) => !EXACT_ONLY_DISAMBIGUATION_KEYS.has(k))
    .sort((a, b) => b.length - a.length);

  for (const key of phraseKeys) {
    if (key === 'ventricle' && system === 'nervous') {
      // Never map brain ventricles ("Anterior horn of lateral ventricle") to cardiac Ventricle_(heart)
      if (/\b(?:lateral|third|fourth)\b/i.test(normalized)) {
        const brainKey = /\blateral\b/i.test(normalized)
          ? 'lateral ventricle'
          : /\bthird\b/i.test(normalized)
            ? 'third ventricle'
            : 'fourth ventricle';
        return WIKIPEDIA_ANATOMICAL_DISAMBIGUATION_MAP[brainKey];
      }
      continue;
    }
    if (key === 'atrium' && /\b(?:right|left)\b/.test(normalized)) continue;
    if (key === 'ventricle' && /\b(?:right|left)\b/.test(normalized)) continue;

    if (
      ` ${normalized} `.includes(` ${key} `) ||
      ` ${strippedSide} `.includes(` ${key} `)
    ) {
      return WIKIPEDIA_ANATOMICAL_DISAMBIGUATION_MAP[key];
    }
  }

  return undefined;
}

interface WikidataResponse {
  entities?: Record<string, WikidataEntity>;
}

interface WikiLanglinksResponse {
  query?: {
    pages?: Record<
      string,
      {
        langlinks?: Array<{
          lang?: string;
          '*'?: string;
        }>;
      }
    >;
  };
}

interface WikiSearchResponse {
  query?: {
    search?: Array<{
      title?: string;
    }>;
  };
}

function getCacheKey(cleanName: string): string {
  return `${CACHE_KEY_PREFIX}${cleanName.toLowerCase()}`;
}

const CORRUPTED_CACHE_RE =
  /الرياض|وادي\s*البطين|Al-Butayn|Q473444|صفحة توضيح|may refer to:/i;

function readCachedProfile(cleanName: string): AnatomicalClinicalProfile | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const key = getCacheKey(cleanName);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    if (CORRUPTED_CACHE_RE.test(raw)) {
      window.localStorage.removeItem(key);
      return null;
    }
    const parsed = JSON.parse(raw) as AnatomicalClinicalProfile;
    if (!parsed || !parsed.cleanNameEn || !parsed.ta98Code) return null;
    if (
      parsed.wikipediaUrlEn?.includes('disambiguation') ||
      parsed.wikidataUrl?.includes('Q473444')
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    return {
      ...parsed,
      source: 'cached',
    };
  } catch {
    return null;
  }
}

function writeCachedProfile(
  cleanName: string,
  profile: AnatomicalClinicalProfile
): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(getCacheKey(cleanName), JSON.stringify(profile));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

async function fetchJsonSafe<T>(
  url: string,
  signal: AbortSignal
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function extractClaimString(
  entity: WikidataEntity | undefined,
  propertyId: string
): string | undefined {
  const val = entity?.claims?.[propertyId]?.[0]?.mainsnak?.datavalue?.value;
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
}

function isUsableSummary(text: string | undefined): text is string {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 40) return false;
  if (/may refer to:|توضيح|صفحة توضيح/i.test(trimmed)) return false;
  return true;
}

const NON_MEDICAL_GEOGRAPHY_BLACKLIST_RE =
  /\((?:السعودية|الرياض|مصر|العراق|اليمن|سوريا|الأردن|الكويت|قرية|محافظة|مدينة|منطقة|ولاية|film|movie|album|song|band|river|valley|municipality|village|district|riyadh|saudi|city|highway|disambiguation|توضيح)\)/i;

const NON_MEDICAL_CONTENT_BLACKLIST_RE =
  /\b(?:valley in|wadi in|city in|village in|town in|district in|province|municipality|riyadh|saudi arabia|highway|film directed|album by|song by|musical group|football club|politician|video game)\b|محافظة|قرية\s+(?:سعودية|تقع|في)|بلدة\s+في|وادي\s+البطين|طريق\s+سريع|منطقة\s+الرياض|فيلم\s+من|ألبوم\s+غنائي|أغنية|ممثل|مغني|لاعب\s+كرة|شركة\s+طيران|تقع\s+في\s+(?:محافظة|منطقة|المملكة)/i;

const EN_MEDICAL_KEYWORD_RE =
  /\b(?:anatomy|anatomical|organ|heart|cardiac|chamber|valve|muscle|muscles|bone|bones|nerve|artery|vein|brain|cerebral|lobe|tissue|gland|membrane|septum|ventricle|atrium|vertebra|skeleton|body|human|biology|medical|physiology|blood|oxygenated|deoxygenated|joint|ligament|tendon|cartilage|viscera|thorax|abdomen|pelvis|cranial|spinal|neural)\b/i;

const AR_MEDICAL_KEYWORD_RE =
  /تشريح|تشريحي|عضو|أعضاء|قلب|قلبي|بطين|أذين|صمام|حاجز|شريان|وريد|عظم|عظام|عضلة|عضلات|عصب|أعصاب|دماغ|مخ|فص|غدة|نسيج|أنسجة|جسم الإنسان|دم|مؤكسج|أكسجين|طب|طبي|فسيولوجيا|حيوي|وظيفة|غشاء|مفصل|وتر|غضروف/;

function isVerifiedMedicalWikiSummary(
  summary: WikiRestSummary | null | undefined,
  lang: 'en' | 'ar'
): summary is WikiRestSummary {
  if (!summary) return false;
  if (summary.type === 'disambiguation') return false;

  const title = summary.title ?? '';
  const description = summary.description ?? '';
  const extract = summary.extract ?? '';

  if (/disambiguation|توضيح/i.test(title)) return false;
  if (NON_MEDICAL_GEOGRAPHY_BLACKLIST_RE.test(title)) return false;
  if (NON_MEDICAL_CONTENT_BLACKLIST_RE.test(`${description} ${extract}`)) {
    return false;
  }
  if (!isUsableSummary(extract)) return false;

  const combined = `${title} ${description} ${extract}`;
  if (lang === 'en') {
    return EN_MEDICAL_KEYWORD_RE.test(combined);
  }
  return (
    AR_MEDICAL_KEYWORD_RE.test(combined) ||
    EN_MEDICAL_KEYWORD_RE.test(combined)
  );
}

const DISALLOWED_WIKIDATA_P31_IDS = new Set([
  'Q4167410', // Wikimedia disambiguation page
  'Q11266439', // Wikimedia template
  'Q4167836', // Wikimedia category
  'Q515', // city
  'Q532', // village
  'Q3957', // town
  'Q486972', // human settlement
  'Q355304', // watercourse / wadi
  'Q39816', // valley
  'Q34442', // road
]);

function isWikidataDisambiguationEntity(
  entity: WikidataEntity | undefined
): boolean {
  if (!entity || entity.missing !== undefined) return true;

  const p31Claims = entity.claims?.P31 ?? [];
  for (const claim of p31Claims) {
    const val = claim?.mainsnak?.datavalue?.value;
    if (typeof val === 'object' && val?.id) {
      if (DISALLOWED_WIKIDATA_P31_IDS.has(val.id)) return true;
    }
  }

  // Positive anatomical ontology confirmation overrides label heuristics unless flagged P31 above
  const hasMedicalProperty = Boolean(
    extractClaimString(entity, 'P1323') || // TA98
      extractClaimString(entity, 'P1402') || // FMA
      extractClaimString(entity, 'P1554') // UBERON
  );
  const enLabel = entity.labels?.en?.value ?? '';
  const arLabel = entity.labels?.ar?.value ?? '';
  const enDesc = entity.descriptions?.en?.value ?? '';
  const arDesc = entity.descriptions?.ar?.value ?? '';
  const combined = `${enLabel} ${arLabel} ${enDesc} ${arDesc}`;

  if (
    /disambiguation|صفحة توضيح/i.test(combined) ||
    NON_MEDICAL_GEOGRAPHY_BLACKLIST_RE.test(combined) ||
    NON_MEDICAL_CONTENT_BLACKLIST_RE.test(combined)
  ) {
    return true;
  }

  if (entity.id === 'Q473444') return true; // Ventricle (disambiguation)
  if (!hasMedicalProperty && !EN_MEDICAL_KEYWORD_RE.test(combined) && !AR_MEDICAL_KEYWORD_RE.test(combined)) {
    // Reject vague Wikidata entries lacking medical keywords or ontology IDs when description is non-empty
    if (enDesc.length > 0 || arDesc.length > 0) return true;
  }
  return false;
}

/**
 * Fetches bilingual anatomical documentation by combining an authoritative offline
 * clinical baseline with parallel live Wikipedia REST v1 + Wikidata API lookups and localStorage caching.
 */
export async function fetchMedicalProfile(
  part: AnatomicalPartInfo,
  externalSignal?: AbortSignal
): Promise<AnatomicalClinicalProfile> {
  const cached = readCachedProfile(part.cleanName);
  if (cached) {
    return {
      ...cached,
      id: part.rawName || part.meshUuid,
      laterality: part.laterality,
    };
  }

  const {
    profile: baseline,
    wikiSearchTerm,
    searchCandidates,
    fallbackArTitle,
  } = resolveClinicalBaseline(part);

  const disambig = lookupAnatomicalDisambiguation(part.cleanName, part.system);

  if (externalSignal?.aborted) {
    return baseline;
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const handleExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', handleExternalAbort, { once: true });

  const queryTermSources = async (term: string, forcedQid?: string) => {
    const enWikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      term.replace(/\s+/g, '_')
    )}`;
    const wikidataApiUrl = forcedQid
      ? `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
          forcedQid
        )}&props=claims|labels|descriptions|sitelinks&languages=en|ar|la&format=json&origin=*`
      : `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${encodeURIComponent(
          term.replace(/_/g, ' ')
        )}&props=claims|labels|descriptions|sitelinks&languages=en|ar|la&format=json&origin=*`;
    const langlinksApiUrl = `https://en.wikipedia.org/w/api.php?action=query&redirects=1&titles=${encodeURIComponent(
      term.replace(/_/g, ' ')
    )}&prop=langlinks&lllang=ar&format=json&origin=*`;

    const [rawEnSummary, wikidataRes, langlinksRes] = await Promise.all([
      fetchJsonSafe<WikiRestSummary>(enWikiUrl, controller.signal),
      fetchJsonSafe<WikidataResponse>(wikidataApiUrl, controller.signal),
      fetchJsonSafe<WikiLanglinksResponse>(langlinksApiUrl, controller.signal),
    ]);

    const verifiedEnSummary = isVerifiedMedicalWikiSummary(rawEnSummary, 'en')
      ? rawEnSummary
      : null;

    const rawEntity = wikidataRes?.entities
      ? Object.values(wikidataRes.entities).find((e) => !e.missing)
      : undefined;
    const verifiedEntity =
      rawEntity && !isWikidataDisambiguationEntity(rawEntity)
        ? rawEntity
        : undefined;

    const langlinkArTitle =
      verifiedEnSummary || verifiedEntity
        ? langlinksRes?.query?.pages
          ? Object.values(langlinksRes.query.pages)[0]?.langlinks?.[0]?.['*']
          : undefined
        : undefined;

    return {
      enSummary: verifiedEnSummary,
      entity: verifiedEntity,
      langlinkArTitle,
      rejectedForDisambiguation: Boolean(
        (rawEnSummary && !verifiedEnSummary) || (rawEntity && !verifiedEntity)
      ),
    };
  };

  try {
    const baseCandidates = Array.from(
      new Set([
        ...(disambig ? [disambig.en.replace(/_/g, ' ')] : []),
        ...(searchCandidates?.length > 0 ? searchCandidates : [wikiSearchTerm]),
      ])
    );

    const primaryTerm = baseCandidates[0] || wikiSearchTerm;
    let { enSummary, entity, langlinkArTitle, rejectedForDisambiguation } =
      await queryTermSources(primaryTerm);

    if (controller.signal.aborted) {
      return baseline;
    }

    // Retry cascade on missing or rejected disambiguation/geography results
    if (!enSummary || !entity) {
      const baseCleanForSuffix = primaryTerm.replace(/\s*\([^)]*\)\s*/g, '').trim();
      const fallbackTerms = Array.from(
        new Set([
          ...baseCandidates.slice(1),
          ...(rejectedForDisambiguation || !enSummary
            ? [
                `${baseCleanForSuffix} (anatomy)`,
                `${baseCleanForSuffix} (heart)`,
                `${baseCleanForSuffix} (bone)`,
                `${baseCleanForSuffix} (muscle)`,
              ]
            : []),
        ])
      ).slice(0, 4);

      for (const cand of fallbackTerms) {
        if (controller.signal.aborted) return baseline;
        if (cand.toLowerCase() === primaryTerm.toLowerCase()) continue;
        // Never fall back to unqualified bare ambiguous nouns unless cardiac/nervous scoped
        if (
          /^(?:ventricle|atrium|atlas|axis|radius|iris|lens|temple|trunk|bridge|arch|valve|root|crown|nail)$/i.test(
            cand.trim()
          )
        ) {
          continue;
        }
        const retryRes = await queryTermSources(
          cand,
          !entity && enSummary?.wikibase_item ? enSummary.wikibase_item : undefined
        );
        if (!enSummary && retryRes.enSummary) enSummary = retryRes.enSummary;
        if (!entity && retryRes.entity) entity = retryRes.entity;
        if (!langlinkArTitle && retryRes.langlinkArTitle) {
          langlinkArTitle = retryRes.langlinkArTitle;
        }
        if (enSummary && entity) break;
      }
    }

    // Also upgrade entity via enSummary.wikibase_item if REST summary resolved a QID directly
    if (!entity && enSummary?.wikibase_item && !controller.signal.aborted) {
      const qidEntityRes = await fetchJsonSafe<WikidataResponse>(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
          enSummary.wikibase_item
        )}&props=claims|labels|descriptions|sitelinks&languages=en|ar|la&format=json&origin=*`,
        controller.signal
      );
      const qidEnt = qidEntityRes?.entities?.[enSummary.wikibase_item];
      if (qidEnt && !isWikidataDisambiguationEntity(qidEnt)) {
        entity = qidEnt;
      }
    }

    if (controller.signal.aborted) {
      return baseline;
    }

    const wdArabic = entity?.labels?.ar?.value;
    const arDirectCandidates = Array.from(
      new Set(
        [
          entity?.sitelinks?.arwiki?.title,
          langlinkArTitle,
          disambig?.ar,
          fallbackArTitle,
        ].filter((t): t is string => Boolean(t && t.trim().length > 0))
      )
    );

    let arArticleTitle: string | undefined;
    let arSummary: WikiRestSummary | null = null;

    for (const candidateAr of arDirectCandidates) {
      if (controller.signal.aborted) return baseline;
      const rawAr = await fetchJsonSafe<WikiRestSummary>(
        `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          candidateAr.replace(/\s+/g, '_')
        )}`,
        controller.signal
      );
      if (isVerifiedMedicalWikiSummary(rawAr, 'ar')) {
        arArticleTitle = rawAr.title || candidateAr;
        arSummary = rawAr;
        break;
      }
    }

    if (!arSummary && !controller.signal.aborted) {
      const baseArTerm =
        disambig?.ar ||
        wdArabic ||
        baseline.cleanNameAr.replace(/\s*\([^)]*\)/g, '').trim() ||
        wikiSearchTerm;
      const arSearchQuery = `${baseArTerm} تشريح`;
      const arSearchUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        arSearchQuery
      )}&utf8=1&srlimit=3&format=json&origin=*`;
      const arSearchRes = await fetchJsonSafe<WikiSearchResponse>(
        arSearchUrl,
        controller.signal
      );
      if (controller.signal.aborted) {
        return baseline;
      }
      const searchHits = (arSearchRes?.query?.search ?? [])
        .map((s) => s.title)
        .filter((t): t is string => Boolean(t));

      for (const hitTitle of searchHits) {
        if (controller.signal.aborted) return baseline;
        if (/توضيح|الرياض|وادي/i.test(hitTitle)) continue;
        const rawArHit = await fetchJsonSafe<WikiRestSummary>(
          `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            hitTitle.replace(/\s+/g, '_')
          )}`,
          controller.signal
        );
        if (isVerifiedMedicalWikiSummary(rawArHit, 'ar')) {
          arArticleTitle = rawArHit.title || hitTitle;
          arSummary = rawArHit;
          break;
        }
      }
    }

    if (controller.signal.aborted) {
      return baseline;
    }

    const wdTa98 = extractClaimString(entity, 'P1323');
    const resolvedTa98 =
      disambig?.ta98 && baseline.ta98Code.includes('.0.00.')
        ? disambig.ta98
        : baseline.ta98Code.includes('.0.00.') && wdTa98
          ? wdTa98
          : baseline.ta98Code;

    const wdFmaRaw = extractClaimString(entity, 'P1402');
    const wdFma = wdFmaRaw
      ? wdFmaRaw.toUpperCase().startsWith('FMA:')
        ? wdFmaRaw.toUpperCase()
        : `FMA:${wdFmaRaw}`
      : undefined;
    const wdLatin = entity?.labels?.la?.value;

    const verifiedQid =
      entity?.id ??
      (enSummary?.wikibase_item && enSummary.wikibase_item !== 'Q473444'
        ? enSummary.wikibase_item
        : undefined);

    const wdEntityUrl = verifiedQid
      ? `https://www.wikidata.org/wiki/${verifiedQid}`
      : resolvedTa98 && !resolvedTa98.includes('.0.00.')
        ? `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(
            `haswbstatement:P1323=${resolvedTa98}`
          )}`
        : `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(
            disambig?.en.replace(/_/g, ' ') || baseline.cleanNameEn
          )}`;

    const safeEnWikiUrl =
      enSummary?.content_urls?.desktop?.page ??
      (disambig
        ? `https://en.wikipedia.org/wiki/${encodeURIComponent(disambig.en)}`
        : baseline.wikipediaUrlEn ??
          `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(
            `${wikiSearchTerm} anatomy`
          )}`);

    const fallbackArSearchTerm =
      disambig?.ar || wdArabic || baseline.cleanNameAr || wikiSearchTerm;
    const safeArWikiUrl =
      arSummary?.content_urls?.desktop?.page ??
      (arArticleTitle
        ? `https://ar.wikipedia.org/wiki/${encodeURIComponent(
            arArticleTitle.replace(/\s+/g, '_')
          )}`
        : disambig?.ar
          ? `https://ar.wikipedia.org/w/index.php?search=${encodeURIComponent(
              `${disambig.ar} تشريح`
            )}`
          : baseline.wikipediaUrlAr ??
            `https://ar.wikipedia.org/w/index.php?search=${encodeURIComponent(
              `${fallbackArSearchTerm} تشريح`
            )}`);

    const hasLiveEnrichment = Boolean(enSummary || arSummary || entity || disambig);
    if (!hasLiveEnrichment) {
      return {
        ...baseline,
        wikipediaUrlEn: safeEnWikiUrl,
        wikipediaUrlAr: safeArWikiUrl,
        wikidataUrl: wdEntityUrl,
      };
    }

    const baselineArWithoutVertebraCode = baseline.cleanNameAr.replace(
      /\((?:C\d+[-–]?[A-Z]?\d*|CN\s*[IVX]+|L\d+[-–]?S?\d*|T\d+[-–]?T?\d*)\)/gi,
      ''
    );
    const hasGenericBaselineAr =
      baseline.cleanNameAr.includes('—') ||
      /[A-Za-z]/.test(baselineArWithoutVertebraCode);

    let resolvedCleanNameAr = baseline.cleanNameAr.replace(/\s*—\s*/g, ' — ');
    if (hasGenericBaselineAr && (wdArabic || disambig?.ar)) {
      const arLabel = disambig?.ar || wdArabic!;
      if (part.laterality === 'Left' && !arLabel.includes('أيسر')) {
        resolvedCleanNameAr = `${arLabel} (أيسر)`;
      } else if (part.laterality === 'Right' && !arLabel.includes('أيمن')) {
        resolvedCleanNameAr = `${arLabel} (أيمن)`;
      } else {
        resolvedCleanNameAr = arLabel;
      }
    } else if (baseline.cleanNameAr.includes('—')) {
      resolvedCleanNameAr = translateAnatomicalTermToArabic(
        part.cleanName,
        part.laterality,
        part.system,
        disambig?.ar || wdArabic
      );
    }

    const hasAuthoritativeTextbookSummary =
      baseline.source === 'textbook-primary' &&
      Boolean(baseline.summaryEn) &&
      !/^.*—\s*Plate\s+/i.test(baseline.summaryEn);

    const wikiSummaryEn =
      enSummary && isUsableSummary(enSummary.extract)
        ? enSummary.extract
        : undefined;
    const wikiSummaryAr =
      arSummary && isUsableSummary(arSummary.extract)
        ? arSummary.extract
        : undefined;

    const merged: AnatomicalClinicalProfile = {
      ...baseline,
      cleanNameAr: resolvedCleanNameAr,
      latinName: baseline.latinName || wdLatin || part.latinName,
      ta98Code: resolvedTa98,
      fmaId: baseline.fmaId ?? wdFma,
      // Primary Source Hierarchy: Authoritative Textbooks (Gray's 4e & Netter 7e) NEVER get overwritten by Wikipedia
      summaryEn: hasAuthoritativeTextbookSummary
        ? baseline.summaryEn
        : wikiSummaryEn ?? baseline.summaryEn,
      // Arabic summary stays authentic Arabic (baseline Arabic OR verified medical Arabic Wikipedia)
      summaryAr:
        baseline.summaryAr &&
        !/يتم استجلاب الملخصات الموسوعية|يمكنك مراجعة المصادر المرجعية/.test(
          baseline.summaryAr
        )
          ? baseline.summaryAr
          : wikiSummaryAr ?? baseline.summaryAr,
      secondaryWikiSummaryEn: wikiSummaryEn,
      secondaryWikiSummaryAr: wikiSummaryAr,
      wikipediaUrlEn: safeEnWikiUrl,
      wikipediaUrlAr: safeArWikiUrl,
      wikidataUrl: wdEntityUrl,
      // Strictly verified medical thumbnails ONLY (never attach thumbnails from rejected/disambiguation/geography pages)
      thumbnailUrl:
        (enSummary ? enSummary.thumbnail?.source : undefined) ??
        (arSummary ? arSummary.thumbnail?.source : undefined) ??
        baseline.thumbnailUrl,
      source: baseline.source === 'textbook-primary' ? 'textbook-primary' : 'live-api',
    };

    writeCachedProfile(part.cleanName, merged);
    return merged;
  } catch {
    return baseline;
  } finally {
    globalThis.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', handleExternalAbort);
  }
}
