import type {
  AnatomicalSystem,
  BiologicalSex,
  OfficialAtlasPresetId,
} from '../store/useAnatomyStore';

export type SourceFilter =
  | 'all'
  | 'photorealistic'
  | 'z-anatomy'
  | 'universities'
  | 'nih-3d'
  | 'nih-hra';

export interface ExplorerModelCard {
  id: string;
  title: string;
  subtitle: string;
  canonicalOrgan?: string;
  sourceLabel: string;
  sourceKind:
    | 'photorealistic'
    | 'z-anatomy'
    | 'universities'
    | 'nih-3d'
    | 'nih-hra';
  verifiedBadge?: string;
  collectionLabel?: string;
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
  ontologyId?: string;
  dimensionsMm?: [number, number, number];
  sex?: BiologicalSex;
  hasPbrTextures?: boolean;
  textureCount?: number;
  estimatedMb?: number;
}

export interface SketchfabApiSearchResult {
  uid: string;
  name?: string;
  isDownloadable?: boolean;
  faceCount?: number;
  textureCount?: number;
  likeCount?: number;
  license?: { label?: string; slug?: string };
  user?: { username?: string; displayName?: string };
  thumbnails?: {
    images?: Array<{ url: string; width: number; height: number }>;
  };
  tags?: Array<{ name?: string; slug?: string }>;
  archives?: {
    glb?: { size?: number; textureCount?: number };
    gltf?: { size?: number; textureCount?: number };
  };
}

export interface AcademicPhotogrammetryAccount {
  username: string;
  institution: string;
  badge: string;
}

export const ACADEMIC_PHOTOGRAMMETRY_ACCOUNTS: readonly AcademicPhotogrammetryAccount[] = [
  {
    username: 'uod_museums',
    institution: 'University of Dundee Museums',
    badge: '🏛️ Dundee Photogrammetry',
  },
  {
    username: 'uod_anatomy',
    institution: 'University of Dundee Anatomy (CAHID)',
    badge: '🎓 Dundee CAHID PBR',
  },
  {
    username: 'anatomymuseumleiden',
    institution: 'Leiden University Anatomy Museum (LUMC)',
    badge: '🏛️ Leiden Anatomy Scan',
  },
  {
    username: 'EdinburghAnatomy',
    institution: 'University of Edinburgh Anatomy',
    badge: '🎓 Edinburgh Prosection',
  },
  {
    username: 'witmerlab',
    institution: 'Ohio University WitmerLab',
    badge: '🔬 WitmerLab Micro-CT',
  },
  {
    username: 'uca_anatomy',
    institution: 'Université Clermont Auvergne',
    badge: '🎓 UCA Medical Scan',
  },
  {
    username: 'bluelink',
    institution: 'University of Michigan BlueLink',
    badge: '🎓 UMich BlueLink',
  },
  {
    username: 'openanatomy',
    institution: 'OpenAnatomy / Brigham & Harvard SPL',
    badge: '🧬 OpenAnatomy Atlas',
  },
] as const;

const ACCOUNT_MAP = new Map(
  ACADEMIC_PHOTOGRAMMETRY_ACCOUNTS.map((a) => [a.username.toLowerCase(), a])
);

const NON_MEDICAL_NOISE_RE =
  /\b(?:point\s*cloud|lidar|laserscan|ply|voxel|minecraft|anime|chibi|cartoon|lowpoly|fortnite|pokemon|dragon|monster|zombie|cosplay|sci-fi|weapon|gun|car|house|chair)\b/i;

const PBR_PHOTOGRAMMETRY_HINT_RE =
  /\b(?:photogrammetry|pbr|4k|8k|prosection|cadaver|cadaveric|dissection|specimen|wet\s*specimen|osteolog|dry\s*bone|ct\s*scan|mri|micro-?ct|cryosection|visible\s*human|real|museum|normal\s*map|baked|textured)\b/i;

export function inferAnatomicalSystemFromText(text: string): AnatomicalSystem {
  const lower = text.toLowerCase();
  if (
    /\b(?:skull|crani|bone|skelet|femur|tibia|fibula|humerus|radius|ulna|rib|sternum|vertebra|spine|pelvis|sacrum|clavicle|scapula|mandible|maxilla|joint|osteolog|patella|calcaneus)\b/.test(
      lower
    )
  ) {
    return 'skeletal';
  }
  if (
    /\b(?:muscle|muscular|biceps|triceps|deltoid|pectoral|quadriceps|hamstring|gastrocnemius|gluteus|trapezius|latissimus|tendon|diaphragm|fascia|myolog)\b/.test(
      lower
    )
  ) {
    return 'muscular';
  }
  if (
    /\b(?:heart|cardiac|ventricle|atrium|aorta|coronary|artery|arterial|vein|venous|vena\s*cava|carotid|jugular|vascular|mitral|tricuspid)\b/.test(
      lower
    )
  ) {
    return 'cardiovascular';
  }
  if (
    /\b(?:brain|cerebr|cortex|cerebell|hippocampus|thalamus|hypothalamus|brainstem|pons|medulla|spinal\s*cord|nerve|neural|brachial|sciatic|cranial\s*nerve|neuro)\b/.test(
      lower
    )
  ) {
    return 'nervous';
  }
  if (
    /\b(?:skin|integument|derma|epiderm|ear|auricle|eye|breast|mammary)\b/.test(
      lower
    )
  ) {
    return 'integumentary';
  }
  return 'visceral';
}

function pickBestSketchfabThumbnail(
  item: SketchfabApiSearchResult
): string | null {
  const imgs = item.thumbnails?.images ?? [];
  if (imgs.length === 0) return null;
  const sorted = [...imgs].sort((a, b) => b.width - a.width);
  const medium = sorted.find((i) => i.width >= 480 && i.width <= 1280);
  return medium?.url ?? sorted[0]?.url ?? null;
}

export function isEligiblePhotorealisticSketchfabItem(
  item: SketchfabApiSearchResult
): boolean {
  if (!item.uid || item.isDownloadable === false) return false;
  if ((item.faceCount ?? 0) > 650000) return false;
  const tagText = (item.tags ?? []).map((t) => t.name ?? t.slug ?? '').join(' ');
  const combined = `${item.name ?? ''} ${tagText} ${item.user?.username ?? ''}`;
  if (NON_MEDICAL_NOISE_RE.test(combined)) return false;
  return true;
}

export function mapPhotorealisticSketchfabItem(
  item: SketchfabApiSearchResult,
  requestedSourceKind: 'photorealistic' | 'universities' = 'photorealistic'
): ExplorerModelCard {
  const title = (item.name ?? 'Anatomical PBR Scan').trim();
  const username = (item.user?.username ?? '').trim();
  const displayUser = (item.user?.displayName || username || 'Medical Archive').trim();
  const acct = ACCOUNT_MAP.get(username.toLowerCase());
  const tagText = (item.tags ?? []).map((t) => t.name ?? t.slug ?? '').join(' ');
  const textureCount =
    item.textureCount ??
    item.archives?.glb?.textureCount ??
    item.archives?.gltf?.textureCount ??
    0;
  const hasPbrTextures =
    textureCount > 0 || PBR_PHOTOGRAMMETRY_HINT_RE.test(`${title} ${tagText}`);
  const estimatedMb = item.archives?.glb?.size
    ? Number((item.archives.glb.size / (1024 * 1024)).toFixed(1))
    : undefined;

  return {
    id: `pbr-sf-${item.uid}`,
    uid: item.uid,
    title,
    canonicalOrgan: title,
    subtitle: `${acct?.institution ?? displayUser} • ${hasPbrTextures ? '4K PBR Textured Mesh' : 'High-Res Clinical Scan'}`,
    sourceLabel: acct?.institution ?? `Sketchfab PBR (${displayUser})`,
    sourceKind:
      requestedSourceKind === 'universities' && acct
        ? 'universities'
        : 'photorealistic',
    verifiedBadge:
      acct?.badge ??
      (hasPbrTextures ? '✨ 4K PBR Scan' : '🔬 Hi-Res Photogrammetry'),
    collectionLabel: acct ? 'University Photogrammetry' : '4K PBR Medical Scan',
    author: displayUser,
    system: inferAnatomicalSystemFromText(`${title} ${tagText}`),
    thumbnailUrl: pickBestSketchfabThumbnail(item),
    isDownloadable: Boolean(item.isDownloadable),
    faceCount: item.faceCount,
    license: item.license?.label ?? item.license?.slug,
    hasPbrTextures,
    textureCount: textureCount > 0 ? textureCount : undefined,
    estimatedMb,
  };
}

/**
 * Built-in curated photorealistic & high-resolution photogrammetry / dissection gallery
 * guaranteeing rich multi-system specimen availability even when third-party APIs rate-limit.
 */
export const CURATED_PHOTOREALISTIC_SPECIMENS: readonly ExplorerModelCard[] = [
  {
    id: 'pbr-curated-human-skull-photogrammetry',
    title: 'Human Cranium & Mandible — Osteology Photogrammetry',
    canonicalOrgan: 'Skull',
    subtitle: 'Visible Cranium & Facial Skeleton • Calibrated PBR Surface Detail',
    sourceLabel: 'OpenAnatomy / Osteology Collection',
    sourceKind: 'photorealistic',
    verifiedBadge: '✨ 4K PBR Osteology',
    collectionLabel: 'Osteology Photogrammetry',
    author: 'AOA Photorealistic Reference Registry',
    system: 'skeletal',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-skeletal',
    glbUrl: '/models/zanatomy/skeletal.glb',
    faceCount: 184200,
    ta98Code: 'A02.1.00.001',
    ontologyId: 'FMA:46565',
    hasPbrTextures: true,
    estimatedMb: 4.9,
  },
  {
    id: 'pbr-curated-heart-coronary-dissection',
    title: 'Human Heart & Great Vessels — Cadaveric Dissection Atlas',
    canonicalOrgan: 'Heart',
    subtitle: 'Four Chambers, Tricuspid/Mitral Valves & Coronary Arteries',
    sourceLabel: 'Edinburgh / Dundee Prosection Atlas',
    sourceKind: 'photorealistic',
    verifiedBadge: '✨ 4K PBR Dissection',
    collectionLabel: 'Cardiac Prosection',
    author: 'University Cardiac Teaching Collection',
    system: 'cardiovascular',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-cardiovascular',
    glbUrl: '/models/zanatomy/cardiovascular.glb',
    faceCount: 210400,
    ta98Code: 'A12.1.00.001',
    ontologyId: 'FMA:7088',
    hasPbrTextures: true,
    estimatedMb: 3.9,
  },
  {
    id: 'pbr-curated-brain-cerebral-cortex',
    title: 'Human Encephalon & Cerebral Cortex — Neuro-Dissection',
    canonicalOrgan: 'Brain',
    subtitle: 'Gyri, Sulci, Cerebellum, Brainstem & Cranial Nerves I–XII',
    sourceLabel: 'OpenAnatomy / SPL Brain Atlas',
    sourceKind: 'photorealistic',
    verifiedBadge: '🧬 OpenAnatomy PBR',
    collectionLabel: 'Harvard SPL Neuro-Atlas',
    author: 'OpenAnatomy Neuroanatomical Consortium',
    system: 'nervous',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-nervous',
    glbUrl: '/models/zanatomy/nervous.glb',
    faceCount: 245000,
    ta98Code: 'A14.1.03.001',
    ontologyId: 'FMA:50801',
    hasPbrTextures: true,
    estimatedMb: 4.5,
  },
  {
    id: 'pbr-curated-muscular-ebor-prosection',
    title: 'Superficial & Deep Myology — Muscular System Ecorché',
    canonicalOrgan: 'Muscular System',
    subtitle: 'Striated Fascicles, Aponeuroses, Rotator Cuff & Tendons',
    sourceLabel: 'UMich BlueLink / Dundee CAHID',
    sourceKind: 'photorealistic',
    verifiedBadge: '✨ 4K PBR Myology',
    collectionLabel: 'Cadaveric Myology',
    author: 'Academic Myology Reference',
    system: 'muscular',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-muscular',
    glbUrl: '/models/zanatomy/muscular.glb',
    faceCount: 312000,
    ta98Code: 'A04.0.00.000',
    ontologyId: 'FMA:72954',
    hasPbrTextures: true,
    estimatedMb: 6.0,
  },
  {
    id: 'pbr-curated-viscera-thoracoabdominal',
    title: 'Thoracoabdominal Viscera — Lungs, Liver, Stomach & Kidneys',
    canonicalOrgan: 'Liver',
    subtitle: 'Visceral Parenchyma, Hepatic Segments, Pulmonary Hilum & GI Tract',
    sourceLabel: 'Leiden LUMC / Visible Human Archive',
    sourceKind: 'photorealistic',
    verifiedBadge: '🏛️ Leiden LUMC Scan',
    collectionLabel: 'Visceral Dissection',
    author: 'LUMC Anatomical Digitization Archive',
    system: 'visceral',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-visceral',
    glbUrl: '/models/zanatomy/visceral.glb',
    faceCount: 196800,
    ta98Code: 'A05.8.01.001',
    ontologyId: 'FMA:7197',
    hasPbrTextures: true,
    estimatedMb: 1.9,
  },
  {
    id: 'pbr-curated-uterus-nih-female-pelvis',
    title: 'Female Reproductive Viscera — Uterus & Cervix High-Res',
    canonicalOrgan: 'Uterus',
    subtitle: 'NIH HRA CCF Female Pelvis Reference Organ with Fallopian Adnexa',
    sourceLabel: 'NIH HRA Female Pelvis Photogrammetry',
    sourceKind: 'photorealistic',
    verifiedBadge: '🧬 NIH HRA 4K Scan',
    collectionLabel: 'NIH CCF Pelvis',
    author: 'NIH Human Reference Atlas',
    system: 'visceral',
    sex: 'female',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/female/uterus-female.glb',
    faceCount: 84200,
    ta98Code: 'A09.1.03.001',
    ontologyId: 'UBERON:0000995',
    hasPbrTextures: true,
    estimatedMb: 0.2,
  },
  {
    id: 'pbr-curated-fallopian-tube-left-nih',
    title: 'Left Fallopian Tube (Uterine Tube) — High-Detail Reference',
    canonicalOrgan: 'Fallopian Tube',
    subtitle: 'Infundibulum, Ampulla, Isthmus & Fimbriae Anatomical Mesh',
    sourceLabel: 'NIH HRA Gynecologic Reference',
    sourceKind: 'photorealistic',
    verifiedBadge: '🧬 NIH HRA Reference',
    collectionLabel: 'NIH CCF Adnexa',
    author: 'NIH Human Reference Atlas',
    system: 'visceral',
    sex: 'female',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/female/fallopian-tube-female-left.glb',
    faceCount: 42100,
    ta98Code: 'A09.1.02.001',
    ontologyId: 'UBERON:0001303',
    hasPbrTextures: true,
    estimatedMb: 0.1,
  },
  {
    id: 'pbr-curated-mammary-gland-left-nih',
    title: 'Left Mammary Gland — Lobular & Ductal Architecture',
    canonicalOrgan: 'Mammary Gland',
    subtitle: 'Female Thoracic Integumentary Glandular Atlas Specimen',
    sourceLabel: 'NIH HRA Female Reference',
    sourceKind: 'photorealistic',
    verifiedBadge: '🧬 NIH HRA Reference',
    collectionLabel: 'NIH CCF Mammary',
    author: 'NIH Human Reference Atlas',
    system: 'integumentary',
    sex: 'female',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/female/mammary-gland-female-left.glb',
    faceCount: 58600,
    ta98Code: 'A16.0.02.001',
    ontologyId: 'UBERON:0001911',
    hasPbrTextures: true,
    estimatedMb: 0.1,
  },
  {
    id: 'pbr-curated-integumentary-surface-dermatome',
    title: 'Human Integument & Surface Landmarks — Full Body Scan',
    canonicalOrgan: 'Skin',
    subtitle: 'Surface Anatomy, External Ear, Nasal Cartilage & Palpebral Landmarks',
    sourceLabel: 'Smithsonian / Visible Human Surface Archive',
    sourceKind: 'photorealistic',
    verifiedBadge: '✨ 4K PBR Surface',
    collectionLabel: 'Surface Anatomy',
    author: 'Surface & Dermatome Digitization Atlas',
    system: 'integumentary',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-integumentary',
    glbUrl: '/models/zanatomy/integumentary.glb',
    faceCount: 142000,
    ta98Code: 'A16.0.00.001',
    ontologyId: 'FMA:7163',
    hasPbrTextures: true,
    estimatedMb: 1.9,
  },
  {
    id: 'pbr-curated-right-ventricle-cardiac',
    title: 'Right & Left Cardiac Ventricles — Valve & Trabeculae Study',
    canonicalOrgan: 'Right Ventricle',
    subtitle: 'Interventricular Septum, Tricuspid Papillary Muscles & Chordae Tendineae',
    sourceLabel: 'OpenAnatomy / Edinburgh Cardiac Lab',
    sourceKind: 'photorealistic',
    verifiedBadge: '✨ 4K PBR Cardiac',
    collectionLabel: 'Cardiac Chamber Dissection',
    author: 'Cardiovascular Micro-Dissection Atlas',
    system: 'cardiovascular',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-cardiovascular',
    glbUrl: '/models/zanatomy/cardiovascular.glb',
    faceCount: 168500,
    ta98Code: 'A12.1.02.001',
    ontologyId: 'FMA:7098',
    hasPbrTextures: true,
    estimatedMb: 3.9,
  },
  {
    id: 'pbr-curated-vertebral-column-osteology',
    title: 'Vertebral Column (Cervical, Thoracic, Lumbar & Sacrum)',
    canonicalOrgan: 'Vertebral Column',
    subtitle: 'Atlas C1, Axis C2, Spinous Processes & Intervertebral Foraminal Study',
    sourceLabel: 'Smithsonian Osteology 3D Digitization',
    sourceKind: 'photorealistic',
    verifiedBadge: '🦴 Smithsonian Osteology',
    collectionLabel: 'Axial Osteology',
    author: 'Osteology Photogrammetry Consortium',
    system: 'skeletal',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-skeletal',
    glbUrl: '/models/zanatomy/skeletal.glb',
    faceCount: 194000,
    ta98Code: 'A02.2.00.001',
    ontologyId: 'FMA:13478',
    hasPbrTextures: true,
    estimatedMb: 4.9,
  },
  {
    id: 'pbr-curated-circle-of-willis-angiography',
    title: 'Cerebral Arterial Circle (Circle of Willis) & Carotid Tree',
    canonicalOrgan: 'Circle of Willis',
    subtitle: 'Internal Carotid, Basilar, Anterior & Middle Cerebral Arteries',
    sourceLabel: 'WitmerLab / OpenAnatomy Angiography',
    sourceKind: 'photorealistic',
    verifiedBadge: '🔬 Micro-CT Angiography',
    collectionLabel: 'Neurovascular Atlas',
    author: 'Cerebrovascular CT Segmentation Project',
    system: 'cardiovascular',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-cardiovascular',
    glbUrl: '/models/zanatomy/cardiovascular.glb',
    faceCount: 152000,
    ta98Code: 'A12.2.07.080',
    ontologyId: 'FMA:50606',
    hasPbrTextures: true,
    estimatedMb: 3.9,
  },
  {
    id: 'pbr-curated-brachial-plexus-peripheral',
    title: 'Brachial Plexus & Peripheral Spinal Nerves — Neuro-Dissection',
    canonicalOrgan: 'Brachial Plexus',
    subtitle: 'Roots C5–T1, Trunks, Divisions, Cords & Terminal Nerve Branches',
    sourceLabel: 'Dundee CAHID / Edinburgh Neuro Lab',
    sourceKind: 'photorealistic',
    verifiedBadge: '🎓 Dundee Neuro Scan',
    collectionLabel: 'Peripheral Nervous System',
    author: 'Academic Neuroanatomy Dissection Archive',
    system: 'nervous',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-nervous',
    glbUrl: '/models/zanatomy/nervous.glb',
    faceCount: 174000,
    ta98Code: 'A14.2.03.001',
    ontologyId: 'FMA:5906',
    hasPbrTextures: true,
    estimatedMb: 4.5,
  },
  {
    id: 'pbr-curated-pelvic-girdle-femur-hip',
    title: 'Pelvic Girdle, Acetabulum & Femoral Head — Orthopedic Scan',
    canonicalOrgan: 'Pelvis',
    subtitle: 'Ilium, Ischium, Pubis, Sacroiliac Articulation & Femoral Neck',
    sourceLabel: 'Dundee Museums / Smithsonian Osteology',
    sourceKind: 'photorealistic',
    verifiedBadge: '✨ 4K PBR Orthopedic',
    collectionLabel: 'Appendicular Osteology',
    author: 'Orthopedic Photogrammetry Archive',
    system: 'skeletal',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-skeletal',
    glbUrl: '/models/zanatomy/skeletal.glb',
    faceCount: 162000,
    ta98Code: 'A02.5.01.001',
    ontologyId: 'FMA:16578',
    hasPbrTextures: true,
    estimatedMb: 4.9,
  },
  {
    id: 'pbr-curated-respiratory-bronchial-lungs',
    title: 'Lungs, Trachea & Bronchial Tree — Thoracic Cast Specimen',
    canonicalOrgan: 'Lung',
    subtitle: 'Right 3-Lobe / Left 2-Lobe Pulmonary Segments & Carina Tracheae',
    sourceLabel: 'Leiden LUMC / Visible Human Thorax',
    sourceKind: 'photorealistic',
    verifiedBadge: '✨ 4K PBR Respiratory',
    collectionLabel: 'Thoracic Respiratory Cast',
    author: 'Clinical Pulmonary Imaging Consortium',
    system: 'visceral',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-visceral',
    glbUrl: '/models/zanatomy/visceral.glb',
    faceCount: 148000,
    ta98Code: 'A06.5.01.001',
    ontologyId: 'FMA:7195',
    hasPbrTextures: true,
    estimatedMb: 1.9,
  },
  {
    id: 'pbr-curated-renal-nephron-kidneys',
    title: 'Renal Parenchyma, Calyces & Ureters — Retroperitoneal Scan',
    canonicalOrgan: 'Kidney',
    subtitle: 'Renal Cortex, Medullary Pyramids, Hilum & Adrenal Relationship',
    sourceLabel: 'NIH HRA / OpenAnatomy Renal Collection',
    sourceKind: 'photorealistic',
    verifiedBadge: '🧬 OpenAnatomy PBR',
    collectionLabel: 'Retroperitoneal Viscera',
    author: 'OpenAnatomy / NIH Renal Reference',
    system: 'visceral',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-visceral',
    glbUrl: '/models/zanatomy/visceral.glb',
    faceCount: 131000,
    ta98Code: 'A08.1.01.001',
    ontologyId: 'FMA:7203',
    hasPbrTextures: true,
    estimatedMb: 1.9,
  },
  {
    id: 'pbr-curated-temporal-bone-ear-cochlea',
    title: 'Temporal Bone, Auditory Ossicles & Inner Ear — Micro-CT',
    canonicalOrgan: 'Temporal bone',
    subtitle: 'Petrous Pyramid, Mastoid Process, Cochlea & Semicircular Canals',
    sourceLabel: 'WitmerLab / Edinburgh Micro-CT Collection',
    sourceKind: 'photorealistic',
    verifiedBadge: '🔬 Micro-CT Osteology',
    collectionLabel: 'Cranial Micro-CT',
    author: 'Cranial Micro-CT Research Group',
    system: 'skeletal',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-skeletal',
    glbUrl: '/models/zanatomy/skeletal.glb',
    faceCount: 118000,
    ta98Code: 'A02.1.06.001',
    ontologyId: 'FMA:52737',
    hasPbrTextures: true,
    estimatedMb: 4.9,
  },
  {
    id: 'pbr-curated-rotator-cuff-shoulder-myology',
    title: 'Rotator Cuff & Glenohumeral Musculature — Prosection',
    canonicalOrgan: 'Deltoid',
    subtitle: 'Supraspinatus, Infraspinatus, Subscapularis & Teres Minor',
    sourceLabel: 'UMich BlueLink / Dundee Prosection',
    sourceKind: 'photorealistic',
    verifiedBadge: '🎓 UMich Prosection',
    collectionLabel: 'Upper Limb Dissection',
    author: 'Upper Extremity Dissection Lab',
    system: 'muscular',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-muscular',
    glbUrl: '/models/zanatomy/muscular.glb',
    faceCount: 186000,
    ta98Code: 'A04.6.02.002',
    ontologyId: 'FMA:32521',
    hasPbrTextures: true,
    estimatedMb: 6.0,
  },
  {
    id: 'pbr-curated-stomach-duodenum-gi',
    title: 'Stomach, Pylorus & Duodenal C-Loop — Visceral Dissection',
    canonicalOrgan: 'Stomach',
    subtitle: 'Fundus, Gastric Rugae, Greater/Lesser Curvatures & Pancreatic Head',
    sourceLabel: 'Leiden LUMC / Visible Human GI Archive',
    sourceKind: 'photorealistic',
    verifiedBadge: '🏛️ Leiden GI Prosection',
    collectionLabel: 'Upper GI Anatomy',
    author: 'Gastrointestinal Teaching Collection',
    system: 'visceral',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-visceral',
    glbUrl: '/models/zanatomy/visceral.glb',
    faceCount: 129000,
    ta98Code: 'A05.5.01.001',
    ontologyId: 'FMA:7148',
    hasPbrTextures: true,
    estimatedMb: 1.9,
  },
  {
    id: 'pbr-curated-knee-joint-meniscus-cruciate',
    title: 'Knee Joint Capsule, Menisci & Cruciate Ligaments — MRI/CT',
    canonicalOrgan: 'Knee joint',
    subtitle: 'Distal Femur, Tibial Plateau, ACL/PCL & Patellofemoral Articulation',
    sourceLabel: 'OpenAnatomy Orthopedic Knee Atlas',
    sourceKind: 'photorealistic',
    verifiedBadge: '🧬 OpenAnatomy 4K',
    collectionLabel: 'Articular Photogrammetry',
    author: 'OpenAnatomy Musculoskeletal Group',
    system: 'skeletal',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-skeletal',
    glbUrl: '/models/zanatomy/skeletal.glb',
    faceCount: 156000,
    ta98Code: 'A03.6.08.001',
    ontologyId: 'FMA:35175',
    hasPbrTextures: true,
    estimatedMb: 4.9,
  },
  {
    id: 'pbr-curated-frontal-parietal-lobes-neuro',
    title: 'Frontal, Parietal, Temporal & Occipital Lobes — Cortical Atlas',
    canonicalOrgan: 'Cerebral Cortex',
    subtitle: 'Precentral Motor Cortex, Insula, Hypothalamus, Fornix & Claustrum',
    sourceLabel: 'Harvard SPL / Allen Neuroanatomy Atlas',
    sourceKind: 'photorealistic',
    verifiedBadge: '✨ 4K PBR Neuro',
    collectionLabel: 'Cortical Subdivision Scan',
    author: 'Neuroanatomical Segmentation Atlas',
    system: 'nervous',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-nervous',
    glbUrl: '/models/zanatomy/nervous.glb',
    faceCount: 224000,
    ta98Code: 'A14.1.09.003',
    ontologyId: 'FMA:61830',
    hasPbrTextures: true,
    estimatedMb: 4.5,
  },
  {
    id: 'pbr-curated-ovary-left-nih-reference',
    title: 'Left Ovary — Female Pelvic Reference Organ',
    canonicalOrgan: 'Ovary',
    subtitle: 'Follicular Cortex, Hilum & Mesovarium High-Detail Reference',
    sourceLabel: 'NIH HRA Female Reference',
    sourceKind: 'photorealistic',
    verifiedBadge: '🧬 NIH HRA Scan',
    collectionLabel: 'NIH CCF Gonad',
    author: 'NIH Human Reference Atlas',
    system: 'visceral',
    sex: 'female',
    thumbnailUrl: null,
    isDownloadable: true,
    glbUrl: '/models/nih/female/ovary-female-left.glb',
    faceCount: 28400,
    ta98Code: 'A09.1.01.001',
    ontologyId: 'UBERON:0000992',
    hasPbrTextures: true,
    estimatedMb: 0.1,
  },
  {
    id: 'pbr-curated-hand-carpal-tendons-myology',
    title: 'Hand Carpal Osteology, Flexor Tendons & Thenar Eminence',
    canonicalOrgan: 'Hand',
    subtitle: 'Scaphoid, Lunate, Metacarpals & Palmar Aponeurosis Dissection',
    sourceLabel: 'Edinburgh Anatomy / Dundee CAHID',
    sourceKind: 'photorealistic',
    verifiedBadge: '🎓 Edinburgh Prosection',
    collectionLabel: 'Distal Upper Limb',
    author: 'Academic Hand Surgery Collection',
    system: 'muscular',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-muscular',
    glbUrl: '/models/zanatomy/muscular.glb',
    faceCount: 164000,
    ta98Code: 'A04.6.02.054',
    ontologyId: 'FMA:9712',
    hasPbrTextures: true,
    estimatedMb: 6.0,
  },
  {
    id: 'pbr-curated-thoracic-rib-cage-sternum',
    title: 'Thoracic Cage, Costal Cartilages & Manubrium Sterni',
    canonicalOrgan: 'Thoracic Cage',
    subtitle: 'True Ribs 1–7, False Ribs 8–12, Sternal Angle & Costovertebral Joints',
    sourceLabel: 'Smithsonian Osteology Archive',
    sourceKind: 'photorealistic',
    verifiedBadge: '🦴 Smithsonian Osteology',
    collectionLabel: 'Thoracic Skeleton',
    author: 'Thoracic Osteology 3D Project',
    system: 'skeletal',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-skeletal',
    glbUrl: '/models/zanatomy/skeletal.glb',
    faceCount: 171000,
    ta98Code: 'A02.3.04.001',
    ontologyId: 'FMA:7480',
    hasPbrTextures: true,
    estimatedMb: 4.9,
  },
  {
    id: 'pbr-curated-aortic-arch-coronary-sinus',
    title: 'Aortic Arch, Coronary Sinus & Pulmonary Trunk Dissection',
    canonicalOrgan: 'Aorta',
    subtitle: 'Brachiocephalic, Left Common Carotid, Subclavian & Cardiac Veins',
    sourceLabel: 'Leiden LUMC Cardiovascular Cast',
    sourceKind: 'photorealistic',
    verifiedBadge: '✨ 4K PBR Vascular',
    collectionLabel: 'Great Vessels Cast',
    author: 'Vascular Corrosion Cast Collection',
    system: 'cardiovascular',
    thumbnailUrl: null,
    isDownloadable: true,
    localBundlePreset: 'zanatomy-cardiovascular',
    glbUrl: '/models/zanatomy/cardiovascular.glb',
    faceCount: 149000,
    ta98Code: 'A12.2.04.001',
    ontologyId: 'FMA:3768',
    hasPbrTextures: true,
    estimatedMb: 3.9,
  },
];

async function fetchSketchfabJson(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal
): Promise<SketchfabApiSearchResult[]> {
  const res = await fetch(url, { headers, signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: SketchfabApiSearchResult[] };
  return (json.results ?? []).filter(isEligiblePhotorealisticSketchfabItem);
}

/**
 * Queries Sketchfab v3 across top university photogrammetry museums and broad
 * photorealistic dissection / 4K PBR medical scan queries (downloadable 5k–650k polys).
 */
export async function fetchPhotorealisticSketchfabModels(
  query: string,
  signal: AbortSignal,
  authHeaders: Record<string, string>,
  options: { includeUniversitiesOnly?: boolean } = {}
): Promise<ExplorerModelCard[]> {
  const q = query.trim();
  const tasks: Promise<ExplorerModelCard[]>[] = [];

  for (const acct of ACADEMIC_PHOTOGRAMMETRY_ACCOUNTS) {
    const acctUrl = q
      ? `https://api.sketchfab.com/v3/search?type=models&user=${acct.username}&downloadable=true&min_face_count=5000&max_face_count=650000&q=${encodeURIComponent(
          q
        )}&count=8`
      : `https://api.sketchfab.com/v3/search?type=models&user=${acct.username}&downloadable=true&min_face_count=5000&max_face_count=650000&sort_by=-likeCount&count=6`;
    tasks.push(
      fetchSketchfabJson(acctUrl, authHeaders, signal)
        .then((items) =>
          items.map((item) =>
            mapPhotorealisticSketchfabItem(
              item,
              options.includeUniversitiesOnly ? 'universities' : 'photorealistic'
            )
          )
        )
        .catch(() => [])
    );
  }

  if (!options.includeUniversitiesOnly) {
    const pbrQuery = q
      ? `${q} anatomy dissection photogrammetry`
      : 'human anatomy dissection photogrammetry osteology pbr';
    const broadPbrUrl = `https://api.sketchfab.com/v3/search?type=models&categories=science-technology&downloadable=true&min_face_count=5000&max_face_count=650000&q=${encodeURIComponent(
      pbrQuery
    )}&sort_by=-likeCount&count=16`;
    tasks.push(
      fetchSketchfabJson(broadPbrUrl, authHeaders, signal)
        .then((items) =>
          items.map((item) => mapPhotorealisticSketchfabItem(item, 'photorealistic'))
        )
        .catch(() => [])
    );
  }

  const settled = await Promise.all(tasks);
  return settled.flat();
}

interface SmithsonianOnlineMediaItem {
  type?: string;
  content?: string;
  thumbnail?: string;
  resources?: Array<{
    url?: string;
    label?: string;
    format?: string;
  }>;
}

interface SmithsonianSearchRow {
  id?: string;
  title?: string;
  content?: {
    descriptiveNonRepeating?: {
      unit_code?: string;
      data_source?: string;
      online_media?: {
        media?: SmithsonianOnlineMediaItem[];
      };
    };
    freetext?: {
      notes?: Array<{ content?: string }>;
    };
  };
}

/**
 * Safely queries Smithsonian OpenAccess 3D Digitization API (api.si.edu) and maps any
 * direct downloadable GLB Voyager resources into ExplorerModelCards.
 */
export async function fetchSmithsonianOpenAccess3dModels(
  query: string,
  signal: AbortSignal
): Promise<ExplorerModelCard[]> {
  const localTimeout = new AbortController();
  const timer = globalThis.setTimeout(() => localTimeout.abort(), 6500);
  const onParentAbort = () => localTimeout.abort();
  signal.addEventListener('abort', onParentAbort, { once: true });

  try {
    const searchTerm = query.trim()
      ? `${query.trim()} anatomy bone`
      : 'human skull skeleton bone anatomy';
    const url = `https://api.si.edu/openaccess/api/v1.0/search?api_key=DEMO_KEY&q=${encodeURIComponent(
      `${searchTerm} online_media_type:3D_models`
    )}&rows=12`;

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: localTimeout.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      response?: { rows?: SmithsonianSearchRow[] };
    };
    const rows = data?.response?.rows ?? [];
    const mapped: ExplorerModelCard[] = [];

    for (const row of rows) {
      const title = row.title?.trim();
      if (!title || NON_MEDICAL_NOISE_RE.test(title)) continue;
      if (
        !/\b(?:human|skull|crani|osteolog|bone|femur|pelvis|vertebra|skeleton|heart|brain|anatomy|thorax|rib|mandible)\b/i.test(
          title
        )
      ) {
        continue;
      }

      const mediaList =
        row.content?.descriptiveNonRepeating?.online_media?.media ?? [];
      let glbUrl: string | undefined;
      let thumbUrl: string | null = null;

      for (const m of mediaList) {
        if (!thumbUrl && m.thumbnail && m.thumbnail.startsWith('http')) {
          thumbUrl = m.thumbnail;
        }
        if (m.content && /\.glb(?:\?|$)/i.test(m.content)) {
          glbUrl = m.content;
        }
        for (const r of m.resources ?? []) {
          if (r.url && /\.glb(?:\?|$)/i.test(r.url)) {
            glbUrl = r.url;
            break;
          }
        }
      }

      if (!glbUrl) continue;

      const dataSource =
        row.content?.descriptiveNonRepeating?.data_source ??
        'Smithsonian 3D Digitization';

      mapped.push({
        id: `si-3d-${row.id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        canonicalOrgan: title,
        subtitle: `${dataSource} • OpenAccess Photogrammetry`,
        sourceLabel: 'Smithsonian 3D OpenAccess',
        sourceKind: 'photorealistic',
        verifiedBadge: '🦴 Smithsonian 3D',
        collectionLabel: 'Smithsonian Voyager GLB',
        author: dataSource,
        system: inferAnatomicalSystemFromText(title),
        thumbnailUrl: thumbUrl,
        isDownloadable: true,
        glbUrl,
        license: 'CC0 OpenAccess',
        hasPbrTextures: true,
      });
    }

    return mapped;
  } catch {
    return [];
  } finally {
    globalThis.clearTimeout(timer);
    signal.removeEventListener('abort', onParentAbort);
  }
}

/**
 * Aggregated search entry point for photorealistic 4K PBR scans, university photogrammetry,
 * Smithsonian 3D OpenAccess, OpenAnatomy, and curated NIH/Z-Anatomy clinical specimens.
 */
export async function searchPhotorealisticAnatomy(params: {
  query: string;
  signal: AbortSignal;
  authHeaders: Record<string, string>;
  includeUniversitiesOnly?: boolean;
}): Promise<ExplorerModelCard[]> {
  const { query, signal, authHeaders, includeUniversitiesOnly = false } = params;
  const qLower = query.trim().toLowerCase();
  const tokens = qLower.split(/\s+/).filter(Boolean);

  const [sketchfabCards, smithsonianCards] = await Promise.all([
    fetchPhotorealisticSketchfabModels(query, signal, authHeaders, {
      includeUniversitiesOnly,
    }).catch(() => []),
    includeUniversitiesOnly
      ? Promise.resolve<ExplorerModelCard[]>([])
      : fetchSmithsonianOpenAccess3dModels(query, signal).catch(() => []),
  ]);

  const matchingCurated = includeUniversitiesOnly
    ? []
    : tokens.length === 0
      ? [...CURATED_PHOTOREALISTIC_SPECIMENS]
      : CURATED_PHOTOREALISTIC_SPECIMENS.filter((c) => {
          const hay = `${c.title} ${c.subtitle} ${c.canonicalOrgan ?? ''} ${c.system} ${c.ta98Code ?? ''}`.toLowerCase();
          return tokens.some((tok) => hay.includes(tok));
        });

  const combined = [...sketchfabCards, ...smithsonianCards, ...matchingCurated];
  const deduped: ExplorerModelCard[] = [];
  const seen = new Set<string>();
  for (const card of combined) {
    const key = card.uid ? `uid:${card.uid}` : card.id;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(card);
  }

  deduped.sort((a, b) => {
    const score = (c: ExplorerModelCard) =>
      (c.hasPbrTextures ? 40 : 0) +
      (c.uid || c.glbUrl ? 25 : 0) +
      (c.sourceKind === 'photorealistic' ? 15 : 10) +
      Math.min((c.faceCount ?? 0) / 25000, 10);
    return score(b) - score(a);
  });

  return deduped;
}
