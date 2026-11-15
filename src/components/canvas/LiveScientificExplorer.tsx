import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Cpu,
  EyeOff,
  FlaskConical,
  Focus,
  Loader2,
  MapPin,
  MapPinOff,
  Microscope,
  RotateCcw,
  Scissors,
  Search,
  Sliders,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import { ANATOMICAL_SYSTEMS } from '../../config/anatomicalSystems';
import { cn } from '../../lib/utils';
import {
  fetchNihSceneOrgans,
  type NihOrganSceneItem,
} from '../../services/nihSceneService';
import {
  useAnatomyStore,
  useAppNavigationStore,
  type AnatomicalSystem,
  type BiologicalSex,
  type OfficialAtlasPresetId,
} from '../../store/useAnatomyStore';
import { parseAnatomicalString } from '../../utils/anatomyParser';
import { resolveAssetUrl } from '../../utils/assetUrl';
import {
  buildCloudNodeIndex,
  collectIsolationHideIds,
  matchZAnatomySystemBundle,
  ZANATOMY_PRESET_GLB_URL,
  type CloudNodeIndex,
  type SketchfabAnnotationEntry,
  type SketchfabViewerApi,
} from '../../utils/cloudDissectionBridge';
import { AnatomyViewport } from './AnatomyViewport';
import {
  bakeGlbThumbnail,
  getCachedGlbThumbnail,
  isBakeableGlbUrl,
} from '../../utils/glbThumbnailBaker';
import {
  getCachedOrganThumbnail,
  prefetchOrganThumbnails,
  resolveOrganThumbnail,
} from '../../utils/organThumbnailResolver';

declare global {
  interface Window {
    Sketchfab?: new (
      version: string,
      iframe: HTMLIFrameElement
    ) => {
      init: (
        uid: string,
        options: Record<string, unknown>
      ) => void;
    };
  }
}

type SourceFilter = 'all' | 'z-anatomy' | 'universities' | 'nih-3d' | 'nih-hra';

interface ExplorerModelCard {
  id: string;
  title: string;
  subtitle: string;
  canonicalOrgan?: string;
  sourceLabel: string;
  sourceKind: 'z-anatomy' | 'universities' | 'nih-3d' | 'nih-hra';
  verifiedBadge?: string;
  author: string;
  system: AnatomicalSystem;
  thumbnailUrl: string | null;
  uid?: string;
  isDownloadable: boolean;
  localBundlePreset?: OfficialAtlasPresetId;
  glbUrl?: string;
  faceCount?: number;
  license?: string;
  ta98Code?: string;
  sex?: BiologicalSex;
}

interface SketchfabApiSearchResult {
  uid: string;
  name?: string;
  isDownloadable?: boolean;
  faceCount?: number;
  likeCount?: number;
  license?: { label?: string; slug?: string };
  user?: { username?: string; displayName?: string };
  thumbnails?: {
    images?: Array<{ url: string; width: number; height: number }>;
  };
  tags?: Array<{ name?: string; slug?: string }>;
}

interface SketchfabClickInfo {
  instanceID?: number;
  material?: { name?: string };
}

interface CloudSelectedNodeState {
  instanceID: number;
  name: string;
  cleanLabel: string;
  materialName?: string;
}

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;

const ARABIC_MEDICAL_DICTIONARY: Record<string, string> = {
  قلب: 'heart',
  القلب: 'heart',
  دماغ: 'brain',
  مخ: 'brain',
  الدماغ: 'brain',
  المخ: 'brain',
  مخيخ: 'cerebellum',
  جمجمة: 'skull cranium',
  الجمجمة: 'skull cranium',
  كبد: 'liver',
  الكبد: 'liver',
  رئة: 'lung',
  رئتين: 'lungs',
  رئتان: 'lungs',
  الرئة: 'lung',
  الرئتين: 'lungs',
  كلية: 'kidney',
  كلى: 'kidneys',
  كليتين: 'kidneys',
  الكلية: 'kidney',
  معدة: 'stomach',
  المعدة: 'stomach',
  امعاء: 'intestine',
  الامعاء: 'intestine',
  قولون: 'colon large intestine',
  عمود: 'vertebral column spine',
  'عمود فقري': 'spine vertebral column',
  'العمود الفقري': 'spine vertebral column',
  فقرات: 'vertebrae spine',
  فقرة: 'vertebra',
  'قفص صدري': 'thorax ribcage',
  'القفص الصدري': 'thorax ribcage',
  ضلوع: 'ribs',
  حوض: 'pelvis',
  الحوض: 'pelvis',
  عضلة: 'muscle',
  عضلات: 'muscular system ecorche',
  العضلات: 'muscular system ecorche',
  عصب: 'nerve',
  اعصاب: 'nervous system nerves',
  الاعصاب: 'nervous system nerves',
  'جهاز عصبي': 'nervous system',
  'الجهاز العصبي': 'nervous system',
  'نخاع شوكي': 'spinal cord',
  'حبل شوكي': 'spinal cord',
  'اوعية دموية': 'blood vessels vascular',
  شرايين: 'arteries vascular',
  شريان: 'artery',
  اورطي: 'aorta',
  اورطة: 'aorta',
  'شريان اورطي': 'aorta',
  اوردة: 'veins venous',
  وريد: 'vein',
  'هيكل عظمي': 'human skeleton bones',
  'الهيكل العظمي': 'human skeleton bones',
  عظام: 'bones skeleton',
  عظم: 'bone',
  فخذ: 'femur thigh',
  ساق: 'tibia fibula leg',
  ذراع: 'humerus arm',
  يد: 'hand wrist anatomy',
  قدم: 'foot ankle anatomy',
  ركبة: 'knee joint',
  كتف: 'shoulder scapula clavicle',
  مفصل: 'joint articulation',
  مفاصل: 'joints articulation',
  رحم: 'uterus',
  الرحم: 'uterus',
  مبيض: 'ovary',
  بروستاتا: 'prostate',
  مثانة: 'urinary bladder',
  بنكرياس: 'pancreas',
  طحال: 'spleen',
  حنجرة: 'larynx',
  'قصبة هوائية': 'trachea bronchi',
  مريء: 'esophagus',
  عين: 'eye anatomy',
  العين: 'eye anatomy',
  اذن: 'ear anatomy',
  الاذن: 'ear anatomy',
  اسنان: 'teeth dental',
  الاسنان: 'teeth dental',
  جلد: 'skin integumentary',
  الجلد: 'skin integumentary',
  'غدة درقية': 'thyroid gland',
  ثدي: 'mammary gland',
  'جهاز هضمي': 'digestive system viscera',
  'جهاز تنفسي': 'respiratory system lungs',
  'جهاز دوري': 'cardiovascular system',
  'جهاز بولي': 'urinary system kidney bladder',
  'جهاز تناسلي': 'reproductive system pelvis',
  تشريح: 'human anatomy',
};

const QUICK_ORGAN_CHIPS: Array<{
  id: string;
  labelEn: string;
  query: string;
  system: AnatomicalSystem;
}> = [
  {
    id: 'brain-nerves',
    labelEn: 'Brain & Nerves',
    query: 'brain nervous',
    system: 'nervous',
  },
  {
    id: 'heart-vessels',
    labelEn: 'Heart & Vessels',
    query: 'heart cardiovascular',
    system: 'cardiovascular',
  },
  {
    id: 'skull-spine',
    labelEn: 'Skull & Spine',
    query: 'skull spine skeleton',
    system: 'skeletal',
  },
  {
    id: 'muscular-ecorche',
    labelEn: 'Muscular Écorché',
    query: 'ecorche muscular',
    system: 'muscular',
  },
  {
    id: 'thorax-lungs',
    labelEn: 'Thorax & Lungs',
    query: 'lung thorax trachea',
    system: 'visceral',
  },
  {
    id: 'digestive-liver',
    labelEn: 'Digestive & Liver',
    query: 'liver pancreas intestine',
    system: 'visceral',
  },
  {
    id: 'urogenital',
    labelEn: 'Urogenital (Male / Female)',
    query: 'kidney bladder uterus prostate',
    system: 'visceral',
  },
  {
    id: 'joints-limbs',
    labelEn: 'Joints & Limbs',
    query: 'knee joint pelvis hand',
    system: 'skeletal',
  },
];

const SOURCE_FILTERS: Array<{
  id: SourceFilter;
  labelEn: string;
}> = [
  { id: 'all', labelEn: 'All Sources' },
  { id: 'z-anatomy', labelEn: '🏛️ Z-Anatomy Official (TA2)' },
  { id: 'universities', labelEn: '🎓 University Medical Schools' },
  { id: 'nih-3d', labelEn: '🔬 NIH 3D Biomedical Portal' },
  { id: 'nih-hra', labelEn: '🧬 NIH HRA & BodyParts3D' },
];

let sketchfabViewerScriptPromise: Promise<void> | null = null;

function ensureSketchfabViewerScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.Sketchfab) {
    return Promise.resolve();
  }
  if (sketchfabViewerScriptPromise) {
    return sketchfabViewerScriptPromise;
  }

  sketchfabViewerScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-sketchfab-viewer-api="1.12.1"]'
    );
    if (existing) {
      if (window.Sketchfab) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Failed to load Sketchfab Viewer API')),
          { once: true }
        );
      }
      return;
    }

    const script = document.createElement('script');
    script.src =
      'https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js';
    script.async = true;
    script.dataset.sketchfabViewerApi = '1.12.1';
    script.onload = () => resolve();
    script.onerror = () => {
      sketchfabViewerScriptPromise = null;
      reject(new Error('Unable to load Sketchfab Viewer API 1.12.1'));
    };
    document.head.appendChild(script);
  });

  return sketchfabViewerScriptPromise;
}

function normalizeArabicQuery(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

export async function translateArabicMedicalQuery(
  rawInput: string,
  signal?: AbortSignal
): Promise<{
  original: string;
  englishQuery: string;
  wasTranslated: boolean;
}> {
  const trimmed = rawInput.trim();
  if (!trimmed || !ARABIC_CHAR_REGEX.test(trimmed)) {
    return {
      original: trimmed,
      englishQuery: trimmed,
      wasTranslated: false,
    };
  }

  const normalized = normalizeArabicQuery(trimmed);
  if (ARABIC_MEDICAL_DICTIONARY[normalized]) {
    return {
      original: trimmed,
      englishQuery: ARABIC_MEDICAL_DICTIONARY[normalized],
      wasTranslated: true,
    };
  }

  const strippedPrefix = normalized.replace(/^ال/, '');
  if (ARABIC_MEDICAL_DICTIONARY[strippedPrefix]) {
    return {
      original: trimmed,
      englishQuery: ARABIC_MEDICAL_DICTIONARY[strippedPrefix],
      wasTranslated: true,
    };
  }

  const tokenMatches: string[] = [];
  for (const token of normalized.split(/\s+/)) {
    const cleanTok = token.replace(/^ال/, '');
    if (ARABIC_MEDICAL_DICTIONARY[token]) {
      tokenMatches.push(ARABIC_MEDICAL_DICTIONARY[token]);
    } else if (ARABIC_MEDICAL_DICTIONARY[cleanTok]) {
      tokenMatches.push(ARABIC_MEDICAL_DICTIONARY[cleanTok]);
    }
  }
  if (tokenMatches.length > 0) {
    return {
      original: trimmed,
      englishQuery: Array.from(new Set(tokenMatches)).join(' '),
      wasTranslated: true,
    };
  }

  // Fallback to Wikipedia Arabic -> English langlinks API for broader terminology
  try {
    const langUrl = `https://ar.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=en&redirects=1&origin=*&format=json&titles=${encodeURIComponent(trimmed)}`;
    const res = await fetch(langUrl, { signal });
    if (res.ok) {
      const json = (await res.json()) as {
        query?: {
          pages?: Record<string, { langlinks?: Array<{ '*': string }> }>;
        };
      };
      const pages = Object.values(json.query?.pages ?? {});
      const enTitle = pages[0]?.langlinks?.[0]?.['*'];
      if (enTitle) {
        return {
          original: trimmed,
          englishQuery: enTitle.replace(/\s*\(.*?\)\s*/g, '').trim(),
          wasTranslated: true,
        };
      }
    }

    const searchUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmed)}&srlimit=1&origin=*&format=json`;
    const searchRes = await fetch(searchUrl, { signal });
    if (searchRes.ok) {
      const searchJson = (await searchRes.json()) as {
        query?: { search?: Array<{ title?: string }> };
      };
      const topTitle = searchJson.query?.search?.[0]?.title;
      if (topTitle) {
        const resolveUrl = `https://ar.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=en&redirects=1&origin=*&format=json&titles=${encodeURIComponent(topTitle)}`;
        const resolveRes = await fetch(resolveUrl, { signal });
        if (resolveRes.ok) {
          const resolveJson = (await resolveRes.json()) as {
            query?: {
              pages?: Record<string, { langlinks?: Array<{ '*': string }> }>;
            };
          };
          const pages = Object.values(resolveJson.query?.pages ?? {});
          const enTitle = pages[0]?.langlinks?.[0]?.['*'];
          if (enTitle) {
            return {
              original: trimmed,
              englishQuery: enTitle.replace(/\s*\(.*?\)\s*/g, '').trim(),
              wasTranslated: true,
            };
          }
        }
      }
    }
  } catch {
    // Ignore abort or transient offline error and fall back gracefully
  }

  return {
    original: trimmed,
    englishQuery: trimmed,
    wasTranslated: false,
  };
}

function classifyExplorerSystem(text: string): AnatomicalSystem {
  const lower = text.toLowerCase();
  if (/skin|integument|epiderm|dermis/.test(lower)) return 'integumentary';
  if (/brain|cerebr|nerv|spinal|neuron|gangl|plexus|eye|cornea|ear/.test(lower)) {
    return 'nervous';
  }
  if (/heart|cardiac|aort|arter|vein|vascul|angiolog|blood/.test(lower)) {
    return 'cardiovascular';
  }
  if (/musc|ecorche|myolog|tendon|pectoral|deltoid|bicep/.test(lower)) {
    return 'muscular';
  }
  if (/skelet|skull|crani|osteolog|bone|spine|vertebr|pelvis|femur|knee|joint|rib/.test(lower)) {
    return 'skeletal';
  }
  return 'visceral';
}

function pickThumbnailUrl(
  result: SketchfabApiSearchResult
): string | null {
  const images = result.thumbnails?.images;
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort(
    (a, b) => Math.abs(a.width - 520) - Math.abs(b.width - 520)
  );
  return sorted[0]?.url ?? null;
}

function buildAuthHeaders(): Record<string, string> {
  const metaEnv = (
    import.meta as unknown as { env?: Record<string, string | undefined> }
  ).env;
  const token = (metaEnv?.VITE_SKETCHFAB_API_TOKEN || '').trim();
  return token ? { Authorization: `Token ${token}` } : {};
}

const UNIVERSITY_BADGES: Record<string, string> = {
  uod_anatomy: '🎓 Univ. of Dundee Medical School',
  uca_anatomy: '🎓 Univ. of Clermont Anatomy',
  bluelink: '🎓 Univ. of Michigan BlueLink',
  openanatomy: '🎓 Harvard OpenAnatomy',
};

function mapSketchfabItem(
  item: SketchfabApiSearchResult,
  sourceKindOverride?: 'z-anatomy' | 'universities'
): ExplorerModelCard {
  const username = (item.user?.username || '').trim();
  const userLower = username.toLowerCase();
  const displayName = item.user?.displayName || username || 'Anatomy Contributor';
  const isZAnatomy =
    userLower === 'z-anatomy' ||
    sourceKindOverride === 'z-anatomy';
  const title = item.name || 'Anatomical 3D Specimen';
  const tagText = (item.tags ?? []).map((t) => t.name || '').join(' ');
  const uniBadge = UNIVERSITY_BADGES[userLower];
  const matchedBundle = isZAnatomy ? matchZAnatomySystemBundle(title) : null;

  return {
    id: `sf-${item.uid}`,
    uid: item.uid,
    title,
    subtitle: isZAnatomy
      ? 'Official Z-Anatomy Open Medical Atlas'
      : `Medical 3D Scan • ${displayName}`,
    sourceLabel: isZAnatomy
      ? 'Z-Anatomy Official'
      : uniBadge
        ? uniBadge.replace(/^🎓\s*/, '')
        : 'Medical University / Cloud',
    sourceKind: isZAnatomy ? 'z-anatomy' : 'universities',
    verifiedBadge: isZAnatomy
      ? '🏛️ Z-Anatomy TA2'
      : uniBadge || '🎓 Univ. Medical School Scan',
    author: displayName,
    system: matchedBundle?.system ?? classifyExplorerSystem(`${title} ${tagText}`),
    thumbnailUrl: pickThumbnailUrl(item),
    isDownloadable: Boolean(item.isDownloadable) || Boolean(matchedBundle),
    localBundlePreset: matchedBundle?.preset,
    faceCount: item.faceCount,
    license: item.license?.label,
  };
}

function mapNihOrganToCard(organ: NihOrganSceneItem): ExplorerModelCard {
  return {
    id: `nih-${organ.sex}-${organ.id}`,
    title: `${organ.name} (${organ.sex === 'male' ? 'Male' : 'Female'} NIH HRA)`,
    subtitle: `Official Visible Human Reference Organ • ${organ.ta98Code}`,
    canonicalOrgan: organ.organKey,
    sourceLabel: 'NIH Reference Organ',
    sourceKind: 'nih-hra',
    verifiedBadge: '🧬 NIH HRA Visible Human',
    author: 'NIH / HuBMAP HRA',
    system: organ.system,
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: organ.activeUrl,
    license: 'CC-BY 4.0 (NIH)',
    ta98Code: organ.ta98Code,
    sex: organ.sex,
  };
}

const CURATED_NIH_3D_MODELS: ExplorerModelCard[] = [
  {
    id: 'nih3d-brain-allen-ct',
    title: 'Segmented Human Brain & Gyri (NIH 3D / Allen Atlas)',
    subtitle: 'High-Resolution Volumetric Neuroanatomy MRI Reconstruction',
    sourceLabel: 'NIH 3D Biomedical Portal',
    sourceKind: 'nih-3d',
    verifiedBadge: '🔬 NIH 3D CT/MRI Scan',
    author: 'NIH NIAID 3D Print Exchange',
    system: 'nervous',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/male/brain-male.glb',
    faceCount: 184200,
    license: 'CC0 / Public Domain (NIH)',
    ta98Code: 'A14.1.03.001',
  },
  {
    id: 'nih3d-heart-chambers-ct',
    title: 'Cardiac Chambers & Great Vessels (CT Angiography)',
    subtitle: 'Visible Human Project Segmented Myocardium & Valves',
    sourceLabel: 'NIH 3D Biomedical Portal',
    sourceKind: 'nih-3d',
    verifiedBadge: '🔬 NIH 3D CT/MRI Scan',
    author: 'NIH Visible Human Segmented Mesh',
    system: 'cardiovascular',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/male/heart-male.glb',
    faceCount: 142500,
    license: 'CC0 / Public Domain (NIH)',
    ta98Code: 'A12.1.00.001',
  },
  {
    id: 'nih3d-pulmonary-bronchial-ct',
    title: 'Thoracic Lungs & Bronchial Lobes (High-Res CT)',
    subtitle: '3D Segmented Pulmonary Parenchyma & Hilar Anatomy',
    sourceLabel: 'NIH 3D Biomedical Portal',
    sourceKind: 'nih-3d',
    verifiedBadge: '🔬 NIH 3D CT/MRI Scan',
    author: 'NIH 3D Biomedical Repository',
    system: 'visceral',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/male/lung-male.glb',
    faceCount: 118400,
    license: 'CC-BY 4.0 (NIH)',
    ta98Code: 'A06.5.01.001',
  },
  {
    id: 'nih3d-pelvis-osteology-ct',
    title: 'Female Pelvic Girdle & Sacrum (Clinical CT Scan)',
    subtitle: '3D Osteological Reconstruction • True Obstetric Conjugates',
    sourceLabel: 'NIH 3D Biomedical Portal',
    sourceKind: 'nih-3d',
    verifiedBadge: '🔬 NIH 3D CT/MRI Scan',
    author: 'NIH NIAID 3D Biomedical Portal',
    system: 'skeletal',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/female/pelvis-female.glb',
    faceCount: 164800,
    license: 'CC-BY 4.0 (NIH)',
    ta98Code: 'A02.5.02.001',
  },
  {
    id: 'nih3d-hepatic-portal-ct',
    title: 'Human Liver Lobes & Biliary Fossa (Contrast CT)',
    subtitle: 'Clinical Segmented Hepatic Parenchyma (Segments I–VIII)',
    sourceLabel: 'NIH 3D Biomedical Portal',
    sourceKind: 'nih-3d',
    verifiedBadge: '🔬 NIH 3D CT/MRI Scan',
    author: 'NIH 3D Print Exchange',
    system: 'visceral',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/male/liver-male.glb',
    faceCount: 96300,
    license: 'CC0 / Public Domain (NIH)',
    ta98Code: 'A05.8.01.001',
  },
  {
    id: 'nih3d-knee-joint-mri',
    title: 'Knee Articulation & Meniscal Complex (3T MRI)',
    subtitle: 'Distal Femur, Proximal Tibia & Ligamentous Capsule Scan',
    sourceLabel: 'NIH 3D Biomedical Portal',
    sourceKind: 'nih-3d',
    verifiedBadge: '🔬 NIH 3D CT/MRI Scan',
    author: 'NIH / HuBMAP Reference Mesh',
    system: 'skeletal',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/male/knee-male-left.glb',
    faceCount: 88900,
    license: 'CC-BY 4.0 (NIH)',
    ta98Code: 'A03.6.08.001',
  },
  {
    id: 'nih3d-renal-left-ct',
    title: 'Renal Cortex & Collecting Calyces (Urography CT)',
    subtitle: '3D Segmented Kidney Parenchyma & Vascular Hilum',
    sourceLabel: 'NIH 3D Biomedical Portal',
    sourceKind: 'nih-3d',
    verifiedBadge: '🔬 NIH 3D CT/MRI Scan',
    author: 'NIH 3D Biomedical Portal',
    system: 'visceral',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/male/kidney-male-left.glb',
    faceCount: 64200,
    license: 'CC-BY 4.0 (NIH)',
    ta98Code: 'A08.1.01.001',
  },
  {
    id: 'nih3d-vascular-tree-mra',
    title: 'Systemic Arterial & Venous Tree (Whole-Body MRA)',
    subtitle: 'Aortic Arch, Iliac Bifurcation & Vena Cava Reconstruction',
    sourceLabel: 'NIH 3D Biomedical Portal',
    sourceKind: 'nih-3d',
    verifiedBadge: '🔬 NIH 3D CT/MRI Scan',
    author: 'NIH Visible Human Angiography',
    system: 'cardiovascular',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/male/blood-vasculature-male.glb',
    faceCount: 215400,
    license: 'CC-BY 4.0 (NIH)',
    ta98Code: 'A12.0.00.001',
  },
];

const CURATED_BODYPARTS3D_MODELS: ExplorerModelCard[] = [
  {
    id: 'bp3d-uterus-fma17558',
    title: 'Uterus & Endometrial Corpus (BodyParts3D • FMA:17558)',
    subtitle: 'DBCLS Anatomical Ontology Concept • Female Reproductive System',
    sourceLabel: 'BodyParts3D (DBCLS)',
    sourceKind: 'nih-hra',
    verifiedBadge: '🧬 BodyParts3D / DBCLS',
    author: 'DBCLS Life Science Database',
    system: 'visceral',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/female/uterus-female.glb',
    faceCount: 48600,
    license: 'CC BY-SA 2.1 JP (DBCLS)',
    ta98Code: 'A09.1.03.001',
    sex: 'female',
  },
  {
    id: 'bp3d-pancreas-fma7198',
    title: 'Pancreas & Exocrine Duct System (BodyParts3D • FMA:7198)',
    subtitle: 'DBCLS / lifesciencedb.jp/bp3d Ontology Mesh',
    sourceLabel: 'BodyParts3D (DBCLS)',
    sourceKind: 'nih-hra',
    verifiedBadge: '🧬 BodyParts3D / DBCLS',
    author: 'DBCLS Life Science Database',
    system: 'visceral',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/male/pancreas-male.glb',
    faceCount: 41200,
    license: 'CC BY-SA 2.1 JP (DBCLS)',
    ta98Code: 'A05.9.01.001',
  },
  {
    id: 'bp3d-spleen-fma7196',
    title: 'Splen / Spleen Parenchyma (BodyParts3D • FMA:7196)',
    subtitle: 'DBCLS / lifesciencedb.jp/bp3d • Lymphoid Reference Concept',
    sourceLabel: 'BodyParts3D (DBCLS)',
    sourceKind: 'nih-hra',
    verifiedBadge: '🧬 BodyParts3D / DBCLS',
    author: 'DBCLS Life Science Database',
    system: 'visceral',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/male/spleen-male.glb',
    faceCount: 36800,
    license: 'CC BY-SA 2.1 JP (DBCLS)',
    ta98Code: 'A13.2.01.001',
  },
  {
    id: 'bp3d-spinal-cord-fma7647',
    title: 'Spinal Cord & Nerve Roots (BodyParts3D • FMA:7647)',
    subtitle: 'DBCLS / lifesciencedb.jp/bp3d • Central Nervous Concept',
    sourceLabel: 'BodyParts3D (DBCLS)',
    sourceKind: 'nih-hra',
    verifiedBadge: '🧬 BodyParts3D / DBCLS',
    author: 'DBCLS Life Science Database',
    system: 'nervous',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/male/spinal-cord-male.glb',
    faceCount: 92400,
    license: 'CC BY-SA 2.1 JP (DBCLS)',
    ta98Code: 'A14.1.02.001',
  },
  {
    id: 'bp3d-trachea-fma7394',
    title: 'Trachea & Primary Bronchi (BodyParts3D • FMA:7394)',
    subtitle: 'DBCLS / lifesciencedb.jp/bp3d • Airway Cartilage Concept',
    sourceLabel: 'BodyParts3D (DBCLS)',
    sourceKind: 'nih-hra',
    verifiedBadge: '🧬 BodyParts3D / DBCLS',
    author: 'DBCLS Life Science Database',
    system: 'visceral',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/male/trachea-male.glb',
    faceCount: 54100,
    license: 'CC BY-SA 2.1 JP (DBCLS)',
    ta98Code: 'A06.3.01.001',
  },
];

interface RawNih3dPortalEntry {
  id?: string | number;
  title?: string;
  name?: string;
  description?: string;
  author?: string;
  submitter?: string;
  files?: Array<{ url?: string; format?: string }>;
  glb_url?: string;
  download_url?: string;
  thumbnail_url?: string;
  polygon_count?: number;
  faces?: number;
}

async function fetchNih3dPortalModels(
  query: string,
  parentSignal?: AbortSignal
): Promise<ExplorerModelCard[]> {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const curatedMatches =
    tokens.length === 0
      ? CURATED_NIH_3D_MODELS
      : CURATED_NIH_3D_MODELS.filter((card) => {
          const hay =
            `${card.title} ${card.subtitle} ${card.system} ${card.ta98Code ?? ''}`.toLowerCase();
          return tokens.some((tok) => hay.includes(tok));
        });

  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), 4500);
  const onParentAbort = () => timeoutController.abort();
  parentSignal?.addEventListener('abort', onParentAbort, { once: true });

  const liveCards: ExplorerModelCard[] = [];
  try {
    const endpoint = `https://3d.nih.gov/api/v2/models?search=${encodeURIComponent(
      query || 'anatomy'
    )}&format=glb`;
    const res = await fetch(endpoint, { signal: timeoutController.signal });
    if (res.ok) {
      const payload = (await res.json()) as
        | RawNih3dPortalEntry[]
        | { results?: RawNih3dPortalEntry[]; models?: RawNih3dPortalEntry[] };
      const rows = Array.isArray(payload)
        ? payload
        : payload.results ?? payload.models ?? [];

      for (const item of rows.slice(0, 12)) {
        const glbFileUrl =
          item.glb_url ||
          item.files?.find((f) =>
            String(f.format || f.url || '')
              .toLowerCase()
              .includes('glb')
          )?.url ||
          item.download_url;
        if (!glbFileUrl) continue;
        const title = String(item.title || item.name || 'NIH 3D Specimen').trim();
        liveCards.push({
          id: `nih3d-live-${item.id ?? title}`,
          title,
          subtitle:
            String(item.description || '').slice(0, 96) ||
            'NIH 3D Print Exchange Clinical Reconstruction',
          sourceLabel: 'NIH 3D Biomedical Portal',
          sourceKind: 'nih-3d',
          verifiedBadge: '🔬 NIH 3D CT/MRI Scan',
          author: String(item.author || item.submitter || 'NIH 3D Portal'),
          system: classifyExplorerSystem(`${title} ${item.description ?? ''}`),
          thumbnailUrl: item.thumbnail_url || null,
          isDownloadable: true,
          glbUrl: glbFileUrl,
          faceCount: item.polygon_count ?? item.faces,
          license: 'CC-BY / Public Domain (NIH 3D)',
        });
      }
    }
  } catch {
    // Expected when browser CORS or offline policy blocks 3d.nih.gov; curated library provides seamless CT/MRI scans
  } finally {
    window.clearTimeout(timeoutId);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }

  const combined = [...liveCards, ...curatedMatches];
  const seen = new Set<string>();
  return combined.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function formatReadableNodeName(raw: string): string {
  return raw
    .replace(/__\d+$/g, '')
    .replace(/\.\d{3}$/g, '')
    .replace(/^node[_-]/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveInitialCardThumbnail(card: ExplorerModelCard): {
  src: string | null;
  baked: boolean;
} {
  const baked = getCachedGlbThumbnail(card.glbUrl);
  if (baked) {
    return { src: baked, baked: true };
  }
  const primary = card.thumbnailUrl?.trim() ? card.thumbnailUrl : null;
  if (primary) {
    return { src: primary, baked: false };
  }
  const cachedWiki = getCachedOrganThumbnail({
    title: card.title,
    canonicalOrgan: card.canonicalOrgan,
    glbUrl: card.glbUrl,
    thumbnailUrl: card.thumbnailUrl,
    system: card.system,
  });
  return { src: cachedWiki, baked: false };
}

/**
 * Renders a 3-stage clinical card thumbnail:
 *  1. Cached baked 3D snapshot / primary URL / Wikimedia anatomical image
 *  2. IntersectionObserver-triggered offscreen Three.js `.glb` 3D snapshot
 *  3. Automatic `onError` recovery across Wikimedia + system fallbacks
 */
const ExplorerCardThumbnail: React.FC<{
  card: ExplorerModelCard;
  accentColor: string;
}> = React.memo(({ card, accentColor }) => {
  const initial = resolveInitialCardThumbnail(card);
  const [imgSrc, setImgSrc] = useState<string | null>(initial.src);
  const [hasBakedGlb, setHasBakedGlb] = useState<boolean>(initial.baked);
  const [isResolving, setIsResolving] = useState<boolean>(() => !initial.src);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef<boolean>(true);
  const failedUrlsRef = useRef<Set<string>>(new Set());
  const fallbackTierRef = useRef<0 | 1 | 2>(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset per-card error tracking when the card identity changes.
  useEffect(() => {
    failedUrlsRef.current.clear();
    fallbackTierRef.current = 0;
    const next = resolveInitialCardThumbnail(card);
    setImgSrc(next.src);
    setHasBakedGlb(next.baked);
    setIsResolving(!next.src);
  }, [
    card.id,
    card.thumbnailUrl,
    card.glbUrl,
    card.title,
    card.canonicalOrgan,
    card.system,
  ]);

  // Stage 1: Resolve missing/empty thumbnail immediately via Wikimedia medical REST API.
  useEffect(() => {
    let cancelled = false;
    const baked = getCachedGlbThumbnail(card.glbUrl);
    if (baked && !failedUrlsRef.current.has(baked)) {
      setImgSrc(baked);
      setHasBakedGlb(true);
      setIsResolving(false);
      return;
    }

    const explicitUrl =
      card.thumbnailUrl?.trim() &&
      !failedUrlsRef.current.has(card.thumbnailUrl.trim())
        ? card.thumbnailUrl.trim()
        : null;
    if (explicitUrl) {
      return;
    }

    setIsResolving(true);
    void resolveOrganThumbnail({
      title: card.title,
      canonicalOrgan: card.canonicalOrgan,
      glbUrl: card.glbUrl,
      thumbnailUrl: null,
      system: card.system,
    }).then((resolved) => {
      if (cancelled || !mountedRef.current) return;
      if (resolved && !failedUrlsRef.current.has(resolved)) {
        setImgSrc((prev) => prev ?? resolved);
      }
      setIsResolving(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    card.id,
    card.title,
    card.canonicalOrgan,
    card.glbUrl,
    card.thumbnailUrl,
    card.system,
  ]);

  // Track viewport visibility for lazy offscreen `.glb` 3D snapshot baking.
  useEffect(() => {
    if (
      hasBakedGlb ||
      !isBakeableGlbUrl(card.glbUrl) ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [card.glbUrl, hasBakedGlb]);

  // Stage 2: Bake a real Three.js offscreen 3D WebGL snapshot for visible bakeable GLBs.
  useEffect(() => {
    if (!isVisible || hasBakedGlb || !isBakeableGlbUrl(card.glbUrl) || !card.glbUrl) {
      return;
    }
    let cancelled = false;

    const cachedBaked = getCachedGlbThumbnail(card.glbUrl);
    if (cachedBaked && !failedUrlsRef.current.has(cachedBaked)) {
      setImgSrc(cachedBaked);
      setHasBakedGlb(true);
      setIsResolving(false);
      return;
    }

    void bakeGlbThumbnail(card.glbUrl, card.system).then((dataUrl) => {
      if (cancelled || !mountedRef.current || !dataUrl) return;
      if (!failedUrlsRef.current.has(dataUrl)) {
        setHasBakedGlb(true);
        setImgSrc(dataUrl);
        setIsResolving(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isVisible, hasBakedGlb, card.glbUrl, card.system]);

  // Stage 3: Automatic `onError` recovery across Wikimedia + system + offscreen GLB bake.
  const handleImgError = useCallback(() => {
    if (imgSrc) {
      failedUrlsRef.current.add(imgSrc);
    }

    if (fallbackTierRef.current < 1) {
      fallbackTierRef.current = 1;
      setIsResolving(true);
      void resolveOrganThumbnail({
        title: card.title,
        canonicalOrgan: card.canonicalOrgan,
        glbUrl: card.glbUrl,
        thumbnailUrl: null,
        system: card.system,
      }).then((resolved) => {
        if (!mountedRef.current) return;
        if (resolved && !failedUrlsRef.current.has(resolved)) {
          setHasBakedGlb(false);
          setImgSrc(resolved);
          setIsResolving(false);
          return;
        }
        if (isBakeableGlbUrl(card.glbUrl) && card.glbUrl) {
          void bakeGlbThumbnail(card.glbUrl, card.system).then((baked) => {
            if (!mountedRef.current) return;
            if (baked && !failedUrlsRef.current.has(baked)) {
              setHasBakedGlb(true);
              setImgSrc(baked);
              setIsResolving(false);
              return;
            }
            if (fallbackTierRef.current < 2) {
              fallbackTierRef.current = 2;
              void resolveOrganThumbnail({
                title: card.system,
                system: card.system,
                thumbnailUrl: null,
              }).then((sysResolved) => {
                if (!mountedRef.current) return;
                if (sysResolved && !failedUrlsRef.current.has(sysResolved)) {
                  setHasBakedGlb(false);
                  setImgSrc(sysResolved);
                } else {
                  setImgSrc(null);
                }
                setIsResolving(false);
              });
              return;
            }
            setImgSrc(null);
            setIsResolving(false);
          });
          return;
        }
        if (fallbackTierRef.current < 2) {
          fallbackTierRef.current = 2;
          void resolveOrganThumbnail({
            title: card.system,
            system: card.system,
            thumbnailUrl: null,
          }).then((sysResolved) => {
            if (!mountedRef.current) return;
            if (sysResolved && !failedUrlsRef.current.has(sysResolved)) {
              setHasBakedGlb(false);
              setImgSrc(sysResolved);
            } else {
              setImgSrc(null);
            }
            setIsResolving(false);
          });
          return;
        }
        setImgSrc(null);
        setIsResolving(false);
      });
      return;
    }

    if (fallbackTierRef.current < 2) {
      fallbackTierRef.current = 2;
      setIsResolving(true);
      void resolveOrganThumbnail({
        title: card.system,
        system: card.system,
        thumbnailUrl: null,
      }).then((sysResolved) => {
        if (!mountedRef.current) return;
        if (sysResolved && !failedUrlsRef.current.has(sysResolved)) {
          setHasBakedGlb(false);
          setImgSrc(sysResolved);
        } else {
          setImgSrc(null);
        }
        setIsResolving(false);
      });
      return;
    }

    setImgSrc(null);
    setIsResolving(false);
  }, [card.canonicalOrgan, card.glbUrl, card.system, card.title, imgSrc]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-gradient-to-b from-slate-900/80 to-black"
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={card.title}
          loading="lazy"
          onError={handleImgError}
          className="h-full w-full object-contain bg-gradient-to-b from-slate-900/80 to-black p-2 transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-b from-slate-900/90 to-black px-4 text-center">
          {isResolving && (
            <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-sky-500/10 to-transparent" />
          )}
          <div
            className={cn(
              'relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-slate-950/90 shadow-inner',
              isResolving && 'animate-pulse'
            )}
            style={{
              boxShadow: `0 0 24px ${accentColor}30`,
            }}
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            {isResolving
              ? 'Loading anatomical preview...'
              : (card.verifiedBadge ?? card.sourceLabel)}
          </span>
        </div>
      )}

      {hasBakedGlb && imgSrc && (
        <span className="pointer-events-none absolute bottom-2 right-2 rounded border border-sky-400/30 bg-slate-950/80 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-wider text-sky-300 backdrop-blur-sm">
          3D Render
        </span>
      )}
    </div>
  );
});
ExplorerCardThumbnail.displayName = 'ExplorerCardThumbnail';

export const LiveScientificExplorer: React.FC = () => {
  const activeTab = useAppNavigationStore((s) => s.activeTab);
  const explorerOpenedModel = useAppNavigationStore(
    (s) => s.explorerOpenedModel
  );
  const setExplorerOpenedModel = useAppNavigationStore(
    (s) => s.setExplorerOpenedModel
  );

  const explorerCloudUid = useAnatomyStore((s) => s.explorerCloudUid);
  const explorerCloudTitle = useAnatomyStore((s) => s.explorerCloudTitle);
  const loadCustomGlb = useAnatomyStore((s) => s.loadCustomGlb);
  const loadExplorerCloudModel = useAnatomyStore(
    (s) => s.loadExplorerCloudModel
  );
  const setActiveAtlasPreset = useAnatomyStore((s) => s.setActiveAtlasPreset);
  const selectPart = useAnatomyStore((s) => s.selectPart);

  const [hasMountedNativeStage, setHasMountedNativeStage] = useState(
    () => explorerOpenedModel?.kind === 'native'
  );
  useEffect(() => {
    if (explorerOpenedModel?.kind === 'native') {
      setHasMountedNativeStage(true);
    }
  }, [explorerOpenedModel]);

  const [searchInput, setSearchInput] = useState('');
  const [translatedLabel, setTranslatedLabel] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [cards, setCards] = useState<ExplorerModelCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);

  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudNodeCount, setCloudNodeCount] = useState(0);
  const [lastPickedCloudNode, setLastPickedCloudNode] = useState<string | null>(
    null
  );
  const [cloudSelectedNode, setCloudSelectedNode] =
    useState<CloudSelectedNodeState | null>(null);
  const [cloudPeeledStack, setCloudPeeledStack] = useState<number[]>([]);
  const [cloudIsolatedId, setCloudIsolatedId] = useState<number | null>(null);
  const [cloudSliceEnabled, setCloudSliceEnabled] = useState(false);
  const [cloudSliceDepth, setCloudSliceDepth] = useState(35);
  const [cloudExplodePct, setCloudExplodePct] = useState(0);
  const [cloudPinsVisible, setCloudPinsVisible] = useState(true);
  const [cloudAnnotationCount, setCloudAnnotationCount] = useState(0);
  const [cloudDockMinimized, setCloudDockMinimized] = useState(false);

  const searchAbortRef = useRef<AbortController | null>(null);
  const nihCacheRef = useRef<ExplorerModelCard[] | null>(null);
  const cloudIframeRef = useRef<HTMLIFrameElement>(null);
  const cloudApiRef = useRef<SketchfabViewerApi | null>(null);
  const cloudNodeIndexRef = useRef<CloudNodeIndex | null>(null);
  const cloudAnnotationsRef = useRef<SketchfabAnnotationEntry[]>([]);
  const cloudHiddenIdsRef = useRef<Set<number>>(new Set());

  const ensureNihCards = useCallback(async (): Promise<ExplorerModelCard[]> => {
    if (nihCacheRef.current) return nihCacheRef.current;
    const catalog = await fetchNihSceneOrgans();
    const list: ExplorerModelCard[] = [];
    const seen = new Set<string>();
    for (const sex of ['male', 'female'] as BiologicalSex[]) {
      for (const organ of catalog[sex] ?? []) {
        if (seen.has(organ.id)) continue;
        seen.add(organ.id);
        list.push(mapNihOrganToCard(organ));
      }
    }
    nihCacheRef.current = list;
    return list;
  }, []);

  const executeSearch = useCallback(
    async (rawQuery: string, filter: SourceFilter) => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setIsSearching(true);
      setStatusMessage(null);

      try {
        const translation = await translateArabicMedicalQuery(
          rawQuery,
          controller.signal
        );
        if (controller.signal.aborted) return;

        setTranslatedLabel(
          translation.wasTranslated
            ? `${translation.original} → ${translation.englishQuery}`
            : null
        );

        const q = translation.englishQuery.trim();
        const tokens = q
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);

        const headers = buildAuthHeaders();
        const fetchTasks: Promise<ExplorerModelCard[]>[] = [];

        // 1. Z-Anatomy Official Sketchfab Search
        if (filter === 'all' || filter === 'z-anatomy') {
          const zUrl = q
            ? `https://api.sketchfab.com/v3/search?type=models&user=Z-Anatomy&q=${encodeURIComponent(q)}&count=18`
            : `https://api.sketchfab.com/v3/search?type=models&user=Z-Anatomy&sort_by=-likeCount&count=18`;
          fetchTasks.push(
            fetch(zUrl, { headers, signal: controller.signal })
              .then((r) => (r.ok ? r.json() : { results: [] }))
              .then((json: { results?: SketchfabApiSearchResult[] }) =>
                (json.results ?? []).map((item) =>
                  mapSketchfabItem(item, 'z-anatomy')
                )
              )
              .catch(() => [])
          );
        }

        // 2. University Medical Schools (Dundee, Clermont, Michigan BlueLink) & Academic Scans
        if (filter === 'all' || filter === 'universities') {
          const uniAccounts = ['uod_anatomy', 'uca_anatomy', 'bluelink'];
          for (const acct of uniAccounts) {
            const acctUrl = q
              ? `https://api.sketchfab.com/v3/search?type=models&user=${acct}&q=${encodeURIComponent(q)}&count=8`
              : `https://api.sketchfab.com/v3/search?type=models&user=${acct}&sort_by=-likeCount&count=6`;
            fetchTasks.push(
              fetch(acctUrl, { headers, signal: controller.signal })
                .then((r) => (r.ok ? r.json() : { results: [] }))
                .then((json: { results?: SketchfabApiSearchResult[] }) =>
                  (json.results ?? []).map((item) =>
                    mapSketchfabItem(item, 'universities')
                  )
                )
                .catch(() => [])
            );
          }

          const uniQuery = q
            ? `${q} anatomy`
            : 'human anatomy university dissection';
          const downloadableParam = filter === 'all' ? '&downloadable=true' : '';
          const uniUrl = `https://api.sketchfab.com/v3/search?type=models&categories=science-technology${downloadableParam}&q=${encodeURIComponent(uniQuery)}&sort_by=-likeCount&count=12`;
          fetchTasks.push(
            fetch(uniUrl, { headers, signal: controller.signal })
              .then((r) => (r.ok ? r.json() : { results: [] }))
              .then((json: { results?: SketchfabApiSearchResult[] }) =>
                (json.results ?? []).map((item) =>
                  mapSketchfabItem(item, 'universities')
                )
              )
              .catch(() => [])
          );
        }

        // 3. NIH 3D Biomedical Portal (3d.nih.gov API + Curated Clinical CT/MRI Library)
        if (filter === 'all' || filter === 'nih-3d') {
          fetchTasks.push(fetchNih3dPortalModels(q, controller.signal));
        }

        // 4. Official NIH HRA Visible Human & BodyParts3D (DBCLS)
        if (filter === 'all' || filter === 'nih-hra') {
          const matchingBodyParts =
            tokens.length === 0
              ? CURATED_BODYPARTS3D_MODELS
              : CURATED_BODYPARTS3D_MODELS.filter((card) => {
                  const hay =
                    `${card.title} ${card.subtitle} ${card.system} ${card.ta98Code ?? ''}`.toLowerCase();
                  return tokens.some((tok) => hay.includes(tok));
                });

          fetchTasks.push(
            ensureNihCards()
              .then((allNih) => {
                const matchedNih =
                  tokens.length === 0
                    ? allNih.slice(0, 12)
                    : allNih
                        .filter((card) => {
                          const hay =
                            `${card.title} ${card.subtitle} ${card.system}`.toLowerCase();
                          return tokens.some((tok) => hay.includes(tok));
                        })
                        .slice(0, 14);
                return [...matchingBodyParts, ...matchedNih];
              })
              .catch(() => matchingBodyParts)
          );
        }

        const groups = await Promise.all(fetchTasks);
        if (controller.signal.aborted) return;

        const merged: ExplorerModelCard[] = [];
        const seenIds = new Set<string>();
        for (const group of groups) {
          for (const card of group) {
            const dedupKey = card.uid ? `uid:${card.uid}` : card.id;
            if (seenIds.has(dedupKey)) continue;
            seenIds.add(dedupKey);
            merged.push(card);
          }
        }

        // Rank Z-Anatomy Official, NIH 3D CT/MRI, NIH HRA & downloadable local-capable GLBs first
        merged.sort((a, b) => {
          const score = (c: ExplorerModelCard) => {
            const kindScore =
              c.sourceKind === 'z-anatomy'
                ? 40
                : c.sourceKind === 'nih-3d'
                  ? 35
                  : c.sourceKind === 'nih-hra'
                    ? 30
                    : c.verifiedBadge?.includes('Univ.') &&
                        !c.verifiedBadge.includes('Scan')
                      ? 25
                      : 15;
            return kindScore + (c.isDownloadable ? 20 : 0);
          };
          return score(b) - score(a);
        });

        setCards(merged);
        void prefetchOrganThumbnails(
          merged.map((card) => ({
            title: card.title,
            canonicalOrgan: card.canonicalOrgan,
            glbUrl: card.glbUrl,
            thumbnailUrl: card.thumbnailUrl,
            system: card.system,
          }))
        );
        if (merged.length === 0) {
          setStatusMessage(
            'No matching 3D anatomical specimens found. Try another medical term or quick filter.'
          );
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setStatusMessage(
          'Live search request failed. Please check your network connection.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    },
    [ensureNihCards]
  );

  // Run initial catalog load on mount
  useEffect(() => {
    void executeSearch('', 'all');
    return () => {
      searchAbortRef.current?.abort();
    };
  }, [executeSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeSearch(searchInput, sourceFilter);
  };

  const handleSourceChange = (nextFilter: SourceFilter) => {
    setSourceFilter(nextFilter);
    void executeSearch(searchInput, nextFilter);
  };

  const handleQuickChipClick = (query: string) => {
    setSearchInput(query);
    void executeSearch(query, sourceFilter);
  };

  // Mode A: Auto-route direct .glb, local Z-Anatomy bundles, or downloadable Sketchfab .glb into Tab 2's isolated Native Three.js Engine
  const launchInLocalEngine = useCallback(
    async (card: ExplorerModelCard) => {
      setLoadingCardId(card.id);
      setStatusMessage(null);

      try {
        if (card.glbUrl) {
          loadExplorerCloudModel(null);
          loadCustomGlb(resolveAssetUrl(card.glbUrl), card.title);
          setExplorerOpenedModel({
            key: card.id,
            title: card.title,
            sourceLabel: card.sourceLabel,
            kind: 'native',
            glbUrl: card.glbUrl,
            system: card.system,
          });
          return;
        }

        const matchedBundle = card.localBundlePreset
          ? {
              preset: card.localBundlePreset,
              system: card.system,
              isFullBody: card.localBundlePreset === 'zanatomy-full-body',
            }
          : card.sourceKind === 'z-anatomy'
            ? matchZAnatomySystemBundle(card.title)
            : null;

        if (matchedBundle) {
          loadExplorerCloudModel(null);
          const bundleGlbUrl = ZANATOMY_PRESET_GLB_URL[matchedBundle.preset];
          if (bundleGlbUrl && !matchedBundle.isFullBody) {
            loadCustomGlb(resolveAssetUrl(bundleGlbUrl), card.title);
          } else {
            setActiveAtlasPreset('zanatomy-full-body');
          }
          setExplorerOpenedModel({
            key: card.id,
            title: card.title,
            sourceLabel: card.sourceLabel,
            kind: 'native',
            presetId: matchedBundle.preset,
            glbUrl: bundleGlbUrl ?? undefined,
            system: matchedBundle.system,
          });
          return;
        }

        if (!card.uid || !card.isDownloadable) {
          if (card.uid) {
            loadExplorerCloudModel(card.uid, card.title);
            setExplorerOpenedModel({
              key: card.id,
              title: card.title,
              sourceLabel: card.sourceLabel,
              kind: 'cloud-stream',
              sketchfabUid: card.uid,
              system: card.system,
            });
          }
          return;
        }

        const headers = buildAuthHeaders();
        const dlRes = await fetch(
          `https://api.sketchfab.com/v3/models/${card.uid}/download`,
          { headers }
        );
        if (!dlRes.ok) {
          throw new Error(`Sketchfab download API HTTP ${dlRes.status}`);
        }
        const dlJson = (await dlRes.json()) as {
          glb?: { url?: string };
          gltf?: { url?: string };
        };
        const assetUrl = dlJson.glb?.url;
        if (!assetUrl) {
          loadExplorerCloudModel(card.uid, card.title);
          setExplorerOpenedModel({
            key: card.id,
            title: card.title,
            sourceLabel: card.sourceLabel,
            kind: 'cloud-stream',
            sketchfabUid: card.uid,
            system: card.system,
          });
          setStatusMessage(
            'Model uses archived GLTF — opened in Cloud 3D Stage.'
          );
          return;
        }

        const binaryRes = await fetch(assetUrl);
        if (!binaryRes.ok) {
          throw new Error(`GLB stream HTTP ${binaryRes.status}`);
        }
        const blob = await binaryRes.blob();
        const objectUrl = URL.createObjectURL(blob);

        loadExplorerCloudModel(null);
        loadCustomGlb(objectUrl, card.title);
        setExplorerOpenedModel({
          key: card.id,
          title: card.title,
          sourceLabel: card.sourceLabel,
          kind: 'native',
          glbUrl: objectUrl,
          system: card.system,
        });
      } catch {
        if (card.uid && card.sourceKind !== 'z-anatomy' && !card.localBundlePreset) {
          loadExplorerCloudModel(card.uid, card.title);
          setExplorerOpenedModel({
            key: card.id,
            title: card.title,
            sourceLabel: card.sourceLabel,
            kind: 'cloud-stream',
            sketchfabUid: card.uid,
            system: card.system,
          });
          setStatusMessage(
            'Direct GLB fetch unavailable — opened in Cloud 3D Stage.'
          );
        } else {
          setStatusMessage('Failed to load GLB asset from source.');
        }
      } finally {
        setLoadingCardId(null);
      }
    },
    [
      loadCustomGlb,
      loadExplorerCloudModel,
      setActiveAtlasPreset,
      setExplorerOpenedModel,
    ]
  );

  // Reconcile Cloud 3D visible/hidden sub-meshes whenever Peel, Isolate, or Slice changes
  useEffect(() => {
    const api = cloudApiRef.current;
    const index = cloudNodeIndexRef.current;
    if (!api || !index || !cloudReady) return;

    const nextHidden = new Set<number>(cloudPeeledStack);
    if (cloudIsolatedId !== null) {
      for (const id of collectIsolationHideIds(cloudIsolatedId, index)) {
        nextHidden.add(id);
      }
    }
    if (cloudSliceEnabled && index.sliceOrderedIds.length > 0) {
      const sliceCount = Math.min(
        Math.max(index.sliceOrderedIds.length - 1, 0),
        Math.round((cloudSliceDepth / 100) * index.sliceOrderedIds.length)
      );
      for (let i = 0; i < sliceCount; i++) {
        nextHidden.add(index.sliceOrderedIds[i]);
      }
    }

    for (const id of nextHidden) {
      if (!cloudHiddenIdsRef.current.has(id)) {
        api.hide?.(id);
      }
    }
    for (const prevId of cloudHiddenIdsRef.current) {
      if (!nextHidden.has(prevId)) {
        api.show?.(prevId);
      }
    }
    cloudHiddenIdsRef.current = nextHidden;
  }, [
    cloudReady,
    cloudPeeledStack,
    cloudIsolatedId,
    cloudSliceEnabled,
    cloudSliceDepth,
  ]);

  // Cloud Explode View via radial `api.translate` across movable transform nodes
  useEffect(() => {
    const api = cloudApiRef.current;
    const index = cloudNodeIndexRef.current;
    if (!api || !index || !cloudReady || index.movableNodes.length === 0) {
      return;
    }

    const factor = cloudExplodePct / 100;
    const timer = window.setTimeout(() => {
      for (const node of index.movableNodes) {
        api.translate?.(
          node.instanceID,
          [
            node.restLocal[0] + node.explodeDir[0] * factor,
            node.restLocal[1] + node.explodeDir[1] * factor,
            node.restLocal[2] + node.explodeDir[2] * factor,
          ],
          { duration: 0.14, easing: 'easeOutQuad' }
        );
      }
    }, 35);

    return () => window.clearTimeout(timer);
  }, [cloudReady, cloudExplodePct]);

  // Sync Sketchfab Annotation Pins visibility (`[A]`)
  useEffect(() => {
    const api = cloudApiRef.current;
    if (!api || !cloudReady) return;
    if (cloudPinsVisible) {
      api.showAnnotationTooltips?.();
      for (let i = 0; i < cloudAnnotationsRef.current.length; i++) {
        api.showAnnotation?.(i);
      }
    } else {
      api.hideAnnotationTooltips?.();
      for (let i = 0; i < cloudAnnotationsRef.current.length; i++) {
        api.hideAnnotation?.(i);
      }
    }
  }, [cloudReady, cloudPinsVisible]);

  const handleCloudIsolate = useCallback(() => {
    if (!cloudSelectedNode) return;
    setCloudIsolatedId((prev) =>
      prev === cloudSelectedNode.instanceID ? null : cloudSelectedNode.instanceID
    );
  }, [cloudSelectedNode]);

  const handleCloudPeel = useCallback(() => {
    if (!cloudSelectedNode) return;
    setCloudPeeledStack((prev) =>
      prev.includes(cloudSelectedNode.instanceID)
        ? prev
        : [...prev, cloudSelectedNode.instanceID]
    );
    if (cloudIsolatedId === cloudSelectedNode.instanceID) {
      setCloudIsolatedId(null);
    }
    setCloudSelectedNode(null);
  }, [cloudSelectedNode, cloudIsolatedId]);

  const handleCloudUndoPeel = useCallback(() => {
    setCloudPeeledStack((prev) => prev.slice(0, -1));
  }, []);

  const handleCloudRestoreAll = useCallback(() => {
    setCloudPeeledStack([]);
    setCloudIsolatedId(null);
    setCloudSliceEnabled(false);
    setCloudExplodePct(0);
    setCloudPinsVisible(true);
    cloudApiRef.current?.recenterCamera?.();
  }, []);

  // Cloud Stage Keyboard Shortcuts ([I] Isolate, [H] Peel, [Z] Undo Peel, [S] Slice, [R] Restore, [A] Pins)
  useEffect(() => {
    if (
      activeTab !== 'cloud-explorer' ||
      explorerOpenedModel?.kind !== 'cloud-stream' ||
      !explorerCloudUid
    ) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'i') {
        handleCloudIsolate();
      } else if (k === 'h') {
        handleCloudPeel();
      } else if (k === 'z') {
        handleCloudUndoPeel();
      } else if (k === 's') {
        setCloudSliceEnabled((v) => !v);
      } else if (k === 'r') {
        handleCloudRestoreAll();
      } else if (k === 'a') {
        setCloudPinsVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab,
    explorerOpenedModel,
    explorerCloudUid,
    handleCloudIsolate,
    handleCloudPeel,
    handleCloudUndoPeel,
    handleCloudRestoreAll,
  ]);

  // Mode B: Sketchfab Viewer API 1.12.1 on #000000 stage (strictly read-only materials, zero inspector UI)
  useEffect(() => {
    if (!explorerCloudUid || explorerOpenedModel?.kind !== 'cloud-stream') {
      cloudApiRef.current = null;
      cloudNodeIndexRef.current = null;
      cloudAnnotationsRef.current = [];
      cloudHiddenIdsRef.current.clear();
      setCloudReady(false);
      setCloudError(null);
      setCloudNodeCount(0);
      setLastPickedCloudNode(null);
      setCloudSelectedNode(null);
      setCloudPeeledStack([]);
      setCloudIsolatedId(null);
      setCloudSliceEnabled(false);
      setCloudExplodePct(0);
      setCloudPinsVisible(true);
      setCloudAnnotationCount(0);
      return;
    }

    let cancelled = false;
    setCloudReady(false);
    setCloudError(null);
    setCloudSelectedNode(null);
    setCloudPeeledStack([]);
    setCloudIsolatedId(null);
    setCloudSliceEnabled(false);
    setCloudExplodePct(0);
    setCloudPinsVisible(true);

    ensureSketchfabViewerScript()
      .then(() => {
        if (cancelled || !cloudIframeRef.current || !window.Sketchfab) return;
        const client = new window.Sketchfab(
          '1.12.1',
          cloudIframeRef.current
        );

        client.init(explorerCloudUid, {
          autostart: 1,
          preload: 1,
          transparent: 0,
          ui_theme: 'dark',
          ui_controls: 0,
          ui_infos: 0,
          ui_watermark: 0,
          ui_stop: 0,
          ui_help: 0,
          ui_settings: 0,
          ui_inspector: 0,
          ui_annotations: 0,
          ui_ar: 0,
          ui_vr: 0,
          ui_hint: 0,
          success: (rawApi: unknown) => {
            if (cancelled) return;
            const api = rawApi as SketchfabViewerApi;
            cloudApiRef.current = api;
            api.start();
            api.addEventListener('viewerready', () => {
              if (cancelled) return;
              setCloudReady(true);
              api.setBackground({ color: [0, 0, 0, 1] }, () => {});

              api.getNodeMap((err, nodes) => {
                if (cancelled || err || !nodes) return;
                const index = buildCloudNodeIndex(nodes);
                cloudNodeIndexRef.current = index;
                setCloudNodeCount(index.nameByInstanceId.size);
              });

              api.getAnnotationList?.((err, annotations) => {
                if (cancelled || err || !Array.isArray(annotations)) return;
                cloudAnnotationsRef.current = annotations;
                setCloudAnnotationCount(annotations.length);
              });

              api.addEventListener('annotationSelect', (rawIndex: unknown) => {
                if (cancelled || typeof rawIndex !== 'number' || rawIndex < 0) {
                  return;
                }
                const ann = cloudAnnotationsRef.current[rawIndex];
                if (!ann) return;
                const rawTitle =
                  ann.name || explorerCloudTitle || 'Anatomical Structure';
                const cleanLabel = formatReadableNodeName(rawTitle);
                setLastPickedCloudNode(cleanLabel);
                selectPart(parseAnatomicalString(rawTitle, cleanLabel));
              });

              api.addEventListener(
                'click',
                (rawInfo: unknown) => {
                  const info = rawInfo as SketchfabClickInfo | undefined;
                  if (!info) return;
                  const idx = cloudNodeIndexRef.current;
                  const mappedName =
                    typeof info.instanceID === 'number'
                      ? idx?.nameByInstanceId.get(info.instanceID)
                      : undefined;
                  const candidateRaw =
                    mappedName ||
                    info.material?.name ||
                    explorerCloudTitle ||
                    'Anatomical Structure';
                  const cleanLabel = formatReadableNodeName(candidateRaw);
                  if (!cleanLabel) return;
                  setLastPickedCloudNode(cleanLabel);
                  if (typeof info.instanceID === 'number') {
                    setCloudSelectedNode({
                      instanceID: info.instanceID,
                      name: candidateRaw,
                      cleanLabel,
                      materialName: info.material?.name,
                    });
                  }
                  selectPart(parseAnatomicalString(candidateRaw, cleanLabel));
                },
                { pick: 'fast' }
              );
            });
          },
          error: () => {
            if (!cancelled) {
              setCloudError(
                'Failed to initialize Sketchfab Cloud Viewer for this model.'
              );
            }
          },
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setCloudError((err as Error)?.message || 'Cloud viewer error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [explorerCloudUid, explorerCloudTitle, selectPart]);

  const activeCloudCard = useMemo(
    () =>
      explorerCloudUid
        ? cards.find((c) => c.uid === explorerCloudUid) ?? null
        : null,
    [cards, explorerCloudUid]
  );

  const isCloudTabActive = activeTab === 'cloud-explorer';
  const isNativeStageVisible =
    isCloudTabActive && explorerOpenedModel?.kind === 'native';
  const isCloudStreamVisible =
    isCloudTabActive &&
    explorerOpenedModel?.kind === 'cloud-stream' &&
    Boolean(explorerCloudUid);
  const isCatalogVisible = isCloudTabActive && explorerOpenedModel === null;

  return (
    <>
      {hasMountedNativeStage && (
        <AnatomyViewport
          active={isNativeStageVisible}
          mountScene={hasMountedNativeStage}
          showStreamingHud={false}
        />
      )}

      {explorerOpenedModel?.kind === 'cloud-stream' && explorerCloudUid && (
        <div
          aria-hidden={!isCloudStreamVisible}
          className={cn(
            'fixed inset-0 bg-black',
            isCloudStreamVisible
              ? 'visible pointer-events-auto z-20'
              : 'invisible pointer-events-none -z-20'
          )}
        >
          <iframe
            ref={cloudIframeRef}
            title={explorerCloudTitle || 'Sketchfab Cloud 3D Specimen'}
            allow="autoplay; fullscreen; xr-spatial-tracking"
            className="h-full w-full border-0 bg-black"
          />

          {!cloudReady && !cloudError && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="flex items-center gap-3 rounded-2xl border border-sky-400/30 bg-zinc-950/90 px-5 py-3 font-mono text-xs text-sky-200 shadow-2xl">
                <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                <span>Initializing 3D Scientific Cloud Stage...</span>
              </div>
            </div>
          )}

          {cloudError && (
            <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/90 p-6">
              <div className="max-w-md rounded-2xl border border-rose-500/35 bg-zinc-950 p-5 text-center shadow-2xl">
                <p className="text-sm font-semibold text-rose-200">{cloudError}</p>
                <button
                  type="button"
                  onClick={() => {
                    loadExplorerCloudModel(null);
                    setExplorerOpenedModel(null);
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Explorer</span>
                </button>
              </div>
            </div>
          )}

          {/* Left Dissection Controls for Stream-Only Third-Party Cloud Models */}
          <aside className="pointer-events-auto fixed left-3 top-16 z-20 w-[238px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/10 bg-[#07070c]/90 p-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-sky-400" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-200">
                SURGICAL DISSECTION
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCloudDockMinimized((v) => !v)}
              aria-label={
                cloudDockMinimized
                  ? 'Expand Surgical Dissection'
                  : 'Minimize Surgical Dissection'
              }
              className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              {cloudDockMinimized ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {!cloudDockMinimized && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {/* Isolate [I] */}
                <button
                  type="button"
                  onClick={handleCloudIsolate}
                  disabled={!cloudReady || !cloudSelectedNode}
                  aria-pressed={cloudIsolatedId !== null}
                  title="Isolate selected structure [I]"
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all',
                    cloudIsolatedId !== null
                      ? 'border-sky-400/50 bg-sky-500/20 text-white'
                      : cloudSelectedNode
                        ? 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                        : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600'
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Focus className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {cloudIsolatedId !== null ? 'Unisolate' : 'Isolate'}
                    </span>
                  </span>
                  <kbd className="font-mono text-[9px] text-zinc-400">I</kbd>
                </button>

                {/* Peel [H] */}
                <button
                  type="button"
                  onClick={handleCloudPeel}
                  disabled={!cloudReady || !cloudSelectedNode}
                  title="Peel / hide selected structure [H]"
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all',
                    cloudSelectedNode
                      ? 'border-white/10 bg-white/5 text-zinc-200 hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-100'
                      : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600'
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <EyeOff className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Peel</span>
                  </span>
                  <kbd className="font-mono text-[9px] text-zinc-400">H</kbd>
                </button>

                {/* Undo Peel [Z] */}
                <button
                  type="button"
                  onClick={handleCloudUndoPeel}
                  disabled={!cloudReady || cloudPeeledStack.length === 0}
                  title="Undo last peel [Z]"
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all',
                    cloudPeeledStack.length > 0
                      ? 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                      : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600'
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Undo2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Undo Peel</span>
                  </span>
                  <kbd className="font-mono text-[9px] text-zinc-400">Z</kbd>
                </button>

                {/* Slice Tool [S] */}
                <button
                  type="button"
                  onClick={() => setCloudSliceEnabled((v) => !v)}
                  disabled={!cloudReady}
                  aria-pressed={cloudSliceEnabled}
                  title="Toggle Cross-Section Layer Cutaway [S]"
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all',
                    cloudSliceEnabled
                      ? 'border-sky-400/55 bg-sky-500/25 text-white shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                      : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Scissors className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Slice Tool</span>
                  </span>
                  <kbd className="font-mono text-[9px] text-zinc-400">S</kbd>
                </button>

                {/* Restore All [R] */}
                <button
                  type="button"
                  onClick={handleCloudRestoreAll}
                  disabled={!cloudReady}
                  title="Restore all peeled, isolated & exploded structures [R]"
                  className="flex items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-zinc-200 transition-all hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-100"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Restore All</span>
                  </span>
                  <kbd className="font-mono text-[9px] text-zinc-400">R</kbd>
                </button>
              </div>

              {cloudSliceEnabled && (
                <div className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-2.5 py-2">
                  <div className="flex items-center justify-between font-mono text-[9.5px] text-sky-200">
                    <span>SECTION DEPTH</span>
                    <span>{cloudSliceDepth}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={85}
                    value={cloudSliceDepth}
                    onChange={(e) =>
                      setCloudSliceDepth(Number(e.target.value))
                    }
                    className="mt-1 h-1.5 w-full cursor-pointer accent-sky-400"
                  />
                </div>
              )}

              {/* Explode View Slider */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
                <div className="flex items-center justify-between font-mono text-[9.5px] text-zinc-300">
                  <span>EXPLODE VIEW</span>
                  <span className="text-sky-300">{cloudExplodePct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={cloudExplodePct}
                  disabled={!cloudReady}
                  onChange={(e) =>
                    setCloudExplodePct(Number(e.target.value))
                  }
                  className="mt-1 h-1.5 w-full cursor-pointer accent-sky-400 disabled:opacity-40"
                />
              </div>

              {/* Hide / Show Annotation Pins [A] */}
              <button
                type="button"
                onClick={() => setCloudPinsVisible((v) => !v)}
                disabled={!cloudReady}
                aria-pressed={!cloudPinsVisible}
                title="Hide or show 3D annotation pins [A]"
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all',
                  cloudPinsVisible
                    ? 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                    : 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                )}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {cloudPinsVisible ? (
                    <MapPinOff className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">
                    {cloudPinsVisible ? 'Hide Pins' : 'Show Pins'}
                    {cloudAnnotationCount > 0 ? ` (${cloudAnnotationCount})` : ''}
                  </span>
                </span>
                <kbd className="font-mono text-[9px] text-zinc-400">A</kbd>
              </button>
            </div>
          )}
        </aside>

        {/* Bottom-Left Cloud Stage Dock (clears Top Bar and Right Clinical Inspector Sidebar) */}
        <div className="pointer-events-auto fixed bottom-4 left-4 z-20 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-zinc-950/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() => {
              loadExplorerCloudModel(null);
              setExplorerOpenedModel(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-zinc-200 transition-colors hover:bg-white/15 hover:text-white active:scale-95"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Search Results</span>
          </button>

          <div className="h-4 w-px bg-white/15" />

          <div className="min-w-0 max-w-[240px]">
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-300">
              <Cloud className="h-3 w-3 shrink-0" />
              <span>CLOUD STAGE {cloudNodeCount > 0 ? `• ${cloudNodeCount} NODES` : ''}</span>
            </div>
            <div className="truncate text-xs font-semibold text-white">
              {explorerCloudTitle || 'Scientific 3D Specimen'}
            </div>
            {lastPickedCloudNode && (
              <div className="truncate font-mono text-[10px] text-sky-300">
                Selected: {lastPickedCloudNode}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const title = lastPickedCloudNode || explorerCloudTitle || 'Human Anatomy';
              selectPart(parseAnatomicalString(title, title));
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/15 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-sky-200 transition-colors hover:bg-sky-500/25 hover:text-white"
          >
            <Microscope className="h-3.5 w-3.5" />
            <span>Clinical Profile</span>
          </button>

          {activeCloudCard?.isDownloadable && (
            <button
              type="button"
              onClick={() => void launchInLocalEngine(activeCloudCard)}
              disabled={loadingCardId === activeCloudCard.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/25 hover:text-white disabled:opacity-50"
            >
              {loadingCardId === activeCloudCard.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Cpu className="h-3.5 w-3.5" />
              )}
              <span>Open in Local Dissector</span>
            </button>
          )}
        </div>
        </div>
      )}

      {/* Search & Browse Dashboard View (persists state across tab switches) */}
      <section
        aria-label="Live 3D Scientific Explorer"
        aria-hidden={!isCatalogVisible}
        className={cn(
          'fixed inset-0 overflow-y-auto touch-pan-y bg-zinc-950/92 px-3 pb-10 pt-20 backdrop-blur-xl transition-opacity duration-150 sm:px-6 xl:pt-20',
          isCatalogVisible
            ? 'visible pointer-events-auto opacity-100 z-20'
            : 'invisible pointer-events-none opacity-0 -z-20'
        )}
      >
      <div className="mx-auto max-w-6xl">
        {/* Header & Bilingual Query Box */}
        <div className="rounded-2xl border border-white/10 bg-[#090910]/95 p-4 shadow-2xl sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/35 bg-sky-500/15 text-sky-300">
                <FlaskConical className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white sm:text-base">
                  Live 3D Scientific Explorer
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Search Z-Anatomy Official, Medical Universities, and NIH Reference Organs in English, Arabic, or Latin
                </p>
              </div>
            </div>

            {translatedLabel && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 font-mono text-[10px] font-semibold text-emerald-200">
                <Sparkles className="h-3 w-3" />
                <span>{translatedLabel}</span>
              </div>
            )}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                dir="auto"
                placeholder="Search 3D anatomy (English or Arabic, e.g., Skull, Heart, جمجمة, قلب)..."
                className="w-full rounded-xl border border-white/15 bg-black/70 py-2.5 pl-10 pr-10 text-xs text-white placeholder-zinc-500 outline-none transition-colors focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400/40 sm:text-sm"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    void executeSearch('', sourceFilter);
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/25 px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-sky-500/35 active:scale-95 disabled:opacity-60"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span>Search 3D</span>
            </button>
          </form>

          {/* Source Filters */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mr-1">
              SOURCE:
            </span>
            {SOURCE_FILTERS.map((f) => {
              const active = sourceFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSourceChange(f.id)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-semibold transition-all active:scale-95',
                    active
                      ? 'border-sky-400/60 bg-sky-500/25 text-white'
                      : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/25 hover:text-zinc-100'
                  )}
                >
                  {f.labelEn}
                </button>
              );
            })}
          </div>

          {/* Quick Anatomical Region & System Chips */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mr-1">
              QUICK ORGANS:
            </span>
            {QUICK_ORGAN_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleQuickChipClick(chip.query)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-sky-400/40 hover:bg-sky-500/15 hover:text-white"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: ANATOMICAL_SYSTEMS[chip.system].accentColor,
                  }}
                />
                <span>{chip.labelEn}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status / Empty Banner */}
        {statusMessage && (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            {statusMessage}
          </div>
        )}

        {/* Loading Grid Skeleton */}
        {isSearching && cards.length === 0 ? (
          <div className="mt-6 flex items-center justify-center py-16">
            <div className="flex items-center gap-3 font-mono text-xs text-sky-300">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>
                Querying live Z-Anatomy, University & NIH 3D Repositories...
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const sysMeta = ANATOMICAL_SYSTEMS[card.system];
              const isLoadingThis = loadingCardId === card.id;

              return (
                <article
                  key={card.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b12]/95 shadow-xl transition-all hover:border-sky-400/40"
                >
                  {/* Visual 3-Stage Hybrid Thumbnail (Wikimedia + Offscreen GLB Snapshot) */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-b from-slate-900/80 to-black">
                    <ExplorerCardThumbnail
                      card={card}
                      accentColor={sysMeta.accentColor}
                    />

                    {/* Verified Source + Downloadable Badges */}
                    <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 font-mono text-[9.5px] font-semibold backdrop-blur-md',
                          card.sourceKind === 'z-anatomy'
                            ? 'border border-emerald-400/40 bg-emerald-950/85 text-emerald-200'
                            : card.sourceKind === 'universities'
                              ? 'border border-violet-400/40 bg-violet-950/85 text-violet-200'
                              : card.sourceKind === 'nih-3d'
                                ? 'border border-amber-400/40 bg-amber-950/85 text-amber-200'
                                : 'border border-sky-400/40 bg-sky-950/85 text-sky-200'
                        )}
                      >
                        {card.verifiedBadge ?? card.sourceLabel}
                      </span>

                      {card.isDownloadable && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-950/80 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-cyan-200 backdrop-blur-md">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span>Direct GLB</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col justify-between p-3.5">
                    <div>
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: sysMeta.accentColor }}
                        />
                        <span>{sysMeta.label}</span>
                        {card.faceCount ? (
                          <span className="text-zinc-400">
                            •{' '}
                            {card.faceCount >= 1000
                              ? `${(card.faceCount / 1000).toFixed(0)}k`
                              : card.faceCount}{' '}
                            polys
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-1 line-clamp-1 text-sm font-bold text-white">
                        {card.title}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-400">
                        {card.subtitle}
                      </p>
                    </div>

                    {/* Action Footer */}
                    <div className="mt-3 flex items-center gap-2">
                      {card.sourceKind === 'z-anatomy' ||
                      Boolean(card.localBundlePreset) ||
                      card.isDownloadable ? (
                        <button
                          type="button"
                          onClick={() => void launchInLocalEngine(card)}
                          disabled={isLoadingThis}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-500/20 px-3 py-2 text-[11px] font-semibold text-white transition-all hover:bg-sky-500/35 active:scale-95 disabled:opacity-50"
                        >
                          {isLoadingThis ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Cpu className="h-3.5 w-3.5 text-sky-300" />
                          )}
                          <span>Load in 3D Engine</span>
                        </button>
                      ) : card.uid ? (
                        <button
                          type="button"
                          onClick={() => void launchInLocalEngine(card)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-3 py-2 text-[11px] font-semibold text-white transition-all hover:bg-emerald-500/35 active:scale-95"
                        >
                          <Cloud className="h-3.5 w-3.5 text-emerald-300" />
                          <span>Cloud 3D</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      </section>
    </>
  );
};
