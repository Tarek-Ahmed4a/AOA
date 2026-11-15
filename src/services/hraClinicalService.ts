import type { BiologicalSex } from '../store/useAnatomyStore';
import type { AnatomicalPartInfo } from '../utils/anatomyParser';
import { NIH_HRA_REFERENCE_ORGANS_API } from './nihSceneService';

export interface HraFtuCellType {
  id: string;
  label: string;
}

export interface HraFtuIllustration {
  id: string;
  label: string;
  organLabel: string;
  representationOf: string;
  uberonId: string;
  svgUrl: string;
  pngUrl: string;
  cellTypes: HraFtuCellType[];
}

export interface HraOrganDimensionRecord {
  sex: BiologicalSex;
  label: string;
  side: 'Left' | 'Right' | 'Unpaired';
  uberonId: string;
  dimensionsMm: [number, number, number];
  glbUrl: string;
}

export interface HraCellEntry {
  id: string;
  label: string;
}

export interface HraBiomarkerEntry {
  id: string;
  label: string;
  biomarkerType: string;
}

export interface HraAsctbSummary {
  slug: string;
  organTitle: string;
  iri?: string;
  cellTypes: HraCellEntry[];
  biomarkers: HraBiomarkerEntry[];
  source: 'hra-cdn' | 'curated-baseline';
}

export interface HraClinicalEnrichment {
  canonicalOrganKey: string | null;
  uberonId: string | null;
  ftus: HraFtuIllustration[];
  dimensionsBySex: {
    male?: HraOrganDimensionRecord;
    female?: HraOrganDimensionRecord;
  };
  asctb: HraAsctbSummary | null;
}

interface RawFtuNode {
  '@id'?: string;
  label?: string;
  organ_label?: string;
  representation_of?: string;
  illustration_files?: Array<{ file_format?: string; file?: string }>;
  mapping?: Array<{ representation_of?: string; label?: string }>;
}

interface RawReferenceOrgan {
  '@id'?: string;
  label?: string;
  sex?: string;
  representation_of?: string;
  x_dimension?: number;
  y_dimension?: number;
  z_dimension?: number;
  object?: { file?: string };
}

interface RawAsctbGraph {
  iri?: string;
  metadata?: { title?: string };
  data?: {
    cell_types?: Array<{
      id?: string;
      ccf_pref_label?: string;
      ccf_asctb_type?: string;
    }>;
    biomarkers?: Array<{
      id?: string;
      ccf_pref_label?: string;
      ccf_biomarker_type?: string;
    }>;
  };
}

interface OrganMatcherConfig {
  organKey: string;
  displayLabel: string;
  asctbSlug: string;
  uberonId: string;
  ftuOrganKeys: string[];
  regex: RegExp;
}

const ORGAN_MATCHERS: OrganMatcherConfig[] = [
  {
    organKey: 'heart',
    displayLabel: 'Heart',
    asctbSlug: 'heart',
    uberonId: 'UBERON:0000948',
    ftuOrganKeys: ['heart'],
    regex: /\b(heart|cardiac|atrium|ventricle|myocardium|endocardium|epicardium|pericardium|mitral|tricuspid|aortic valve|pulmonary valve|coronary|papillary muscle|chordae tendineae|sinoatrial)\b/i,
  },
  {
    organKey: 'kidney',
    displayLabel: 'Kidney',
    asctbSlug: 'kidney',
    uberonId: 'UBERON:0002113',
    ftuOrganKeys: ['kidney'],
    regex: /\b(kidney|renal|nephron|glomerul|calyx|calyces|pyel|podocyte|medullary pyramid)\b/i,
  },
  {
    organKey: 'lung',
    displayLabel: 'Lung',
    asctbSlug: 'lung',
    uberonId: 'UBERON:0002048',
    ftuOrganKeys: ['lung'],
    regex: /\b(lung|pulmonary|alveol|bronchiol|pleura|lingula|lobe of lung)\b/i,
  },
  {
    organKey: 'liver',
    displayLabel: 'Liver',
    asctbSlug: 'liver',
    uberonId: 'UBERON:0002107',
    ftuOrganKeys: ['liver'],
    regex: /\b(liver|hepatic|hepat|caudate lobe|quadrate lobe|gallbladder|bile duct|biliary)\b/i,
  },
  {
    organKey: 'pancreas',
    displayLabel: 'Pancreas',
    asctbSlug: 'pancreas',
    uberonId: 'UBERON:0001264',
    ftuOrganKeys: ['pancreas'],
    regex: /\b(pancrea|islet|langerhans|uncinate process)\b/i,
  },
  {
    organKey: 'small intestine',
    displayLabel: 'Small Intestine',
    asctbSlug: 'small-intestine',
    uberonId: 'UBERON:0002108',
    ftuOrganKeys: ['small intestine'],
    regex: /\b(small intestine|duodenum|jejunum|ileum|villus|lacteal)\b/i,
  },
  {
    organKey: 'large intestine',
    displayLabel: 'Large Intestine',
    asctbSlug: 'large-intestine',
    uberonId: 'UBERON:0000059',
    ftuOrganKeys: ['large intestine'],
    regex: /\b(large intestine|colon|cecum|caecum|appendix|rectum|sigmoid|epiploic|tenia coli)\b/i,
  },
  {
    organKey: 'brain',
    displayLabel: 'Brain',
    asctbSlug: 'allen-brain',
    uberonId: 'UBERON:0000955',
    ftuOrganKeys: ['brain'],
    regex: /\b(brain|cereb|cortex|gyrus|sulcus|hippocamp|thalam|hypothalam|amygdala|pons|medulla oblongata|midbrain|brainstem|ventricle of brain|corpus callosum|putamen|caudate nucleus|allen_)\b/i,
  },
  {
    organKey: 'spinal cord',
    displayLabel: 'Spinal Cord',
    asctbSlug: 'spinal-cord',
    uberonId: 'UBERON:0002240',
    ftuOrganKeys: ['spinal cord'],
    regex: /\b(spinal cord|cauda equina|conus medullaris|filum terminale)\b/i,
  },
  {
    organKey: 'spleen',
    displayLabel: 'Spleen',
    asctbSlug: 'spleen',
    uberonId: 'UBERON:0002106',
    ftuOrganKeys: ['spleen'],
    regex: /\b(spleen|splen)\b/i,
  },
  {
    organKey: 'thymus',
    displayLabel: 'Thymus',
    asctbSlug: 'thymus',
    uberonId: 'UBERON:0002370',
    ftuOrganKeys: ['thymus'],
    regex: /\b(thymus|thymic)\b/i,
  },
  {
    organKey: 'skin',
    displayLabel: 'Skin',
    asctbSlug: 'skin',
    uberonId: 'UBERON:0002097',
    ftuOrganKeys: ['skin', 'skin of body'],
    regex: /\b(skin|epiderm|dermis|integument|cutaneous)\b/i,
  },
  {
    organKey: 'prostate',
    displayLabel: 'Prostate',
    asctbSlug: 'prostate',
    uberonId: 'UBERON:0002367',
    ftuOrganKeys: ['prostate', 'prostate gland'],
    regex: /\b(prostat)\b/i,
  },
  {
    organKey: 'uterus',
    displayLabel: 'Uterus',
    asctbSlug: 'uterus',
    uberonId: 'UBERON:0000995',
    ftuOrganKeys: ['uterus'],
    regex: /\b(uterus|uterine|endometrium|myometrium|cervix)\b/i,
  },
  {
    organKey: 'ovary',
    displayLabel: 'Ovary',
    asctbSlug: 'ovary',
    uberonId: 'UBERON:0000992',
    ftuOrganKeys: ['ovary'],
    regex: /\b(ovary|ovarian|corpus luteum|follicle)\b/i,
  },
  {
    organKey: 'fallopian tube',
    displayLabel: 'Fallopian Tube',
    asctbSlug: 'fallopian-tube',
    uberonId: 'UBERON:0003889',
    ftuOrganKeys: ['fallopian tube'],
    regex: /\b(fallopian|uterine tube|oviduct|fimbriae)\b/i,
  },
  {
    organKey: 'mammary gland',
    displayLabel: 'Mammary Gland',
    asctbSlug: 'mammary-gland',
    uberonId: 'UBERON:0001911',
    ftuOrganKeys: ['mammary gland'],
    regex: /\b(mammary|breast|lactiferous)\b/i,
  },
  {
    organKey: 'placenta full term',
    displayLabel: 'Placenta',
    asctbSlug: 'placenta',
    uberonId: 'UBERON:0001987',
    ftuOrganKeys: ['placenta'],
    regex: /\b(placenta|chorion|trophoblast)\b/i,
  },
  {
    organKey: 'eye',
    displayLabel: 'Eye',
    asctbSlug: 'eye',
    uberonId: 'UBERON:0000970',
    ftuOrganKeys: ['eye'],
    regex: /\b(eye|retina|cornea|sclera|iris|pupil|lens of eye|optic nerve|macula|choroid)\b/i,
  },
  {
    organKey: 'mouth',
    displayLabel: 'Oral Cavity / Mouth',
    asctbSlug: 'mouth',
    uberonId: 'UBERON:0000165',
    ftuOrganKeys: ['mouth'],
    regex: /\b(mouth|oral|tongue|gingiva|palate|salivary|parotid|submandibular|uvula)\b/i,
  },
  {
    organKey: 'trachea',
    displayLabel: 'Trachea',
    asctbSlug: 'trachea',
    uberonId: 'UBERON:0003126',
    ftuOrganKeys: [],
    regex: /\b(trachea|carina)\b/i,
  },
  {
    organKey: 'main bronchus',
    displayLabel: 'Main Bronchus',
    asctbSlug: 'main-bronchus',
    uberonId: 'UBERON:0002182',
    ftuOrganKeys: ['lung'],
    regex: /\b(bronchus|bronchi)\b/i,
  },
  {
    organKey: 'larynx',
    displayLabel: 'Larynx',
    asctbSlug: 'trachea',
    uberonId: 'UBERON:0001737',
    ftuOrganKeys: [],
    regex: /\b(larynx|glottis|epiglottis|vocal|cricoid|thyroid cartilage)\b/i,
  },
  {
    organKey: 'urinary bladder',
    displayLabel: 'Urinary Bladder',
    asctbSlug: 'urinary-bladder',
    uberonId: 'UBERON:0001255',
    ftuOrganKeys: [],
    regex: /\b(urinary bladder|detrusor|trigone of bladder|bladder)\b/i,
  },
  {
    organKey: 'ureter',
    displayLabel: 'Ureter',
    asctbSlug: 'ureter',
    uberonId: 'UBERON:0000056',
    ftuOrganKeys: [],
    regex: /\b(ureter)\b/i,
  },
  {
    organKey: 'lymph node',
    displayLabel: 'Lymph Node',
    asctbSlug: 'lymph-node',
    uberonId: 'UBERON:0000029',
    ftuOrganKeys: [],
    regex: /\b(lymph node|lymphatic|nodus)\b/i,
  },
  {
    organKey: 'palatine tonsil',
    displayLabel: 'Palatine Tonsil',
    asctbSlug: 'palatine-tonsil',
    uberonId: 'UBERON:0002373',
    ftuOrganKeys: [],
    regex: /\b(tonsil)\b/i,
  },
  {
    organKey: 'blood vasculature',
    displayLabel: 'Blood Vasculature',
    asctbSlug: 'blood-vasculature',
    uberonId: 'UBERON:0004537',
    ftuOrganKeys: [],
    regex: /\b(artery|arteries|vein|veins|aorta|vena cava|vasculature|jugular|carotid|subclavian|iliac|femoral artery|femoral vein)\b/i,
  },
  {
    organKey: 'knee',
    displayLabel: 'Knee Joint',
    asctbSlug: 'knee',
    uberonId: 'UBERON:0001465',
    ftuOrganKeys: [],
    regex: /\b(knee|meniscus|cruciate|patella|tibial plateau)\b/i,
  },
  {
    organKey: 'pelvis',
    displayLabel: 'Pelvis',
    asctbSlug: 'skeleton',
    uberonId: 'UBERON:0002355',
    ftuOrganKeys: [],
    regex: /\b(pelvis|pelvic|ilium|ischium|pubis|sacrum|coccyx|acetabulum)\b/i,
  },
  {
    organKey: 'adipose',
    displayLabel: 'Adipose Tissue',
    asctbSlug: 'white-adipose',
    uberonId: 'UBERON:0014455',
    ftuOrganKeys: [],
    regex: /\b(adipose|subcutaneous fat|omentum|mesentery)\b/i,
  },
];

// Curated offline baseline so offline/mobile still presents rich HRA CL + HGNC profiles
const OFFLINE_ASCTB_BASELINES: Record<
  string,
  { cells: HraCellEntry[]; biomarkers: HraBiomarkerEntry[] }
> = {
  heart: {
    cells: [
      { id: 'CL:0000746', label: 'Cardiac muscle cell (Cardiomyocyte)' },
      { id: 'CL:1000477', label: 'Sinoatrial pacemaker cell' },
      { id: 'CL:0002548', label: 'Cardiac fibroblast' },
      { id: 'CL:0000115', label: 'Endothelial cell' },
      { id: 'CL:0000669', label: 'Pericyte' },
    ],
    biomarkers: [
      { id: 'HGNC:11943', label: 'TNNT2 (Cardiac Troponin T)', biomarkerType: 'gene' },
      { id: 'HGNC:7577', label: 'MYH7 (Beta-myosin heavy chain)', biomarkerType: 'gene' },
      { id: 'HGNC:16882', label: 'HCN4 (Pacemaker channel)', biomarkerType: 'gene' },
      { id: 'HGNC:7939', label: 'NPPA (Atrial natriuretic factor)', biomarkerType: 'protein' },
      { id: 'HGNC:2631', label: 'PECAM1 / CD31', biomarkerType: 'protein' },
    ],
  },
  kidney: {
    cells: [
      { id: 'CL:0000653', label: 'Glomerular visceral epithelial cell (Podocyte)' },
      { id: 'CL:0002306', label: 'Epithelial cell of proximal tubule' },
      { id: 'CL:1001107', label: 'Loop of Henle epithelial cell' },
      { id: 'CL:1000454', label: 'Renal principal cell' },
      { id: 'CL:1001005', label: 'Glomerular endothelial cell' },
    ],
    biomarkers: [
      { id: 'HGNC:7908', label: 'NPHS1 (Nephrin)', biomarkerType: 'gene' },
      { id: 'HGNC:14464', label: 'NPHS2 (Podocin)', biomarkerType: 'gene' },
      { id: 'HGNC:633', label: 'AQP1 / AQP2 (Aquaporins)', biomarkerType: 'gene' },
      { id: 'HGNC:12559', label: 'UMOD (Uromodulin)', biomarkerType: 'protein' },
      { id: 'HGNC:6682', label: 'LRP2 (Megalin)', biomarkerType: 'gene' },
    ],
  },
  liver: {
    cells: [
      { id: 'CL:0000182', label: 'Hepatocyte' },
      { id: 'CL:1000398', label: 'Liver sinusoidal endothelial cell' },
      { id: 'CL:0000091', label: 'Kupffer cell (Hepatic macrophage)' },
      { id: 'CL:0000632', label: 'Hepatic stellate cell (Ito cell)' },
      { id: 'CL:1000488', label: 'Cholangiocyte (Bile duct epithelial)' },
    ],
    biomarkers: [
      { id: 'HGNC:399', label: 'ALB (Albumin)', biomarkerType: 'gene' },
      { id: 'HGNC:1148', label: 'CYP3A4', biomarkerType: 'gene' },
      { id: 'HGNC:16711', label: 'CLEC4M (Sinusoidal marker)', biomarkerType: 'gene' },
      { id: 'HGNC:6430', label: 'KRT19 (Cholangiocyte CK19)', biomarkerType: 'protein' },
      { id: 'HGNC:14424', label: 'HNF4A', biomarkerType: 'gene' },
    ],
  },
  lung: {
    cells: [
      { id: 'CL:0002062', label: 'Type I pneumocyte (Alveolar epithelial I)' },
      { id: 'CL:0002063', label: 'Type II pneumocyte (Surfactant-producing)' },
      { id: 'CL:0000583', label: 'Alveolar macrophage' },
      { id: 'CL:0000064', label: 'Ciliated bronchial epithelial cell' },
      { id: 'CL:0009092', label: 'Aerocyte capillary endothelial cell' },
    ],
    biomarkers: [
      { id: 'HGNC:10802', label: 'SFTPC (Surfactant Protein C)', biomarkerType: 'gene' },
      { id: 'HGNC:436', label: 'AGER / RAGE (AT1 marker)', biomarkerType: 'gene' },
      { id: 'HGNC:10800', label: 'SFTPB (Surfactant Protein B)', biomarkerType: 'protein' },
      { id: 'HGNC:13490', label: 'SCGB1A1 (Club cell protein)', biomarkerType: 'gene' },
      { id: 'HGNC:10869', label: 'FOXI1 (Pulmonary ionocyte)', biomarkerType: 'gene' },
    ],
  },
  pancreas: {
    cells: [
      { id: 'CL:0000169', label: 'Type B pancreatic cell (Beta cell)' },
      { id: 'CL:0000171', label: 'Pancreatic A cell (Alpha cell)' },
      { id: 'CL:0002064', label: 'Pancreatic acinar cell' },
      { id: 'CL:0002079', label: 'Pancreatic ductal cell' },
    ],
    biomarkers: [
      { id: 'HGNC:6081', label: 'INS (Insulin)', biomarkerType: 'gene' },
      { id: 'HGNC:4191', label: 'GCG (Glucagon)', biomarkerType: 'gene' },
      { id: 'HGNC:11329', label: 'SST (Somatostatin)', biomarkerType: 'gene' },
      { id: 'HGNC:476', label: 'AMY2A (Pancreatic amylase)', biomarkerType: 'protein' },
    ],
  },
  'allen-brain': {
    cells: [
      { id: 'CL:0000679', label: 'Glutamatergic excitatory neuron' },
      { id: 'CL:0000617', label: 'GABAergic inhibitory interneuron' },
      { id: 'CL:0000127', label: 'Astrocyte' },
      { id: 'CL:0000128', label: 'Oligodendrocyte' },
      { id: 'CL:0000129', label: 'Microglial cell' },
    ],
    biomarkers: [
      { id: 'HGNC:11004', label: 'SLC17A7 (VGLUT1)', biomarkerType: 'gene' },
      { id: 'HGNC:4092', label: 'GAD1 / GAD2', biomarkerType: 'gene' },
      { id: 'HGNC:4235', label: 'GFAP (Astrocyte filament)', biomarkerType: 'protein' },
      { id: 'HGNC:6925', label: 'MBP (Myelin basic protein)', biomarkerType: 'protein' },
      { id: 'HGNC:1639', label: 'AIF1 / IBA1 (Microglia)', biomarkerType: 'gene' },
    ],
  },
};

const CACHE_KEY_FTU = 'hra_v1_ftu_illustrations_cache_v1';
const CACHE_KEY_REFS = 'hra_v1_ref_organs_dims_cache_v1';
const CACHE_KEY_ASCTB_PREFIX = 'hra_v1_asctb_graph_v1::';

let ftuMemoryCache: HraFtuIllustration[] | null = null;
let ftuPromise: Promise<HraFtuIllustration[]> | null = null;

let dimsMemoryCache: RawReferenceOrgan[] | null = null;
let dimsPromise: Promise<RawReferenceOrgan[]> | null = null;

const asctbMemoryCache = new Map<string, HraAsctbSummary>();
const asctbInFlight = new Map<string, Promise<HraAsctbSummary | null>>();

function readSessionOrLocalJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; data?: T };
    // Expire cached HRA ontology snapshots after 7 days
    if (
      parsed &&
      parsed.data &&
      typeof parsed.savedAt === 'number' &&
      Date.now() - parsed.savedAt < 7 * 24 * 60 * 60 * 1000
    ) {
      return parsed.data;
    }
  } catch {
    // Ignore storage read errors in restricted WebViews
  }
  return null;
}

function writeLocalJson<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    // Ignore storage quota errors cleanly
  }
}

function normalizeUberon(raw?: string): string {
  if (!raw) return '';
  const tail = raw.split('/').pop() ?? raw;
  return tail.replace(/^UBERON_/i, 'UBERON:');
}

function inferSideFromName(text: string): 'Left' | 'Right' | 'Unpaired' {
  if (/\bleft\b|_L\b/i.test(text)) return 'Left';
  if (/\bright\b|_R\b/i.test(text)) return 'Right';
  return 'Unpaired';
}

export async function getHraFtuIllustrations(): Promise<HraFtuIllustration[]> {
  if (ftuMemoryCache) return ftuMemoryCache;
  const stored = readSessionOrLocalJson<HraFtuIllustration[]>(CACHE_KEY_FTU);
  if (stored && stored.length > 0) {
    ftuMemoryCache = stored;
    return stored;
  }

  if (!ftuPromise) {
    ftuPromise = fetch('https://apps.humanatlas.io/api/v1/ftu-illustrations', {
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`FTU HTTP ${res.status}`);
        return res.json() as Promise<{ '@graph'?: RawFtuNode[] }>;
      })
      .then((json) => {
        const graph = Array.isArray(json?.['@graph']) ? json['@graph'] : [];
        const items: HraFtuIllustration[] = [];
        for (const node of graph) {
          const id = String(node['@id'] ?? '');
          const files = Array.isArray(node.illustration_files)
            ? node.illustration_files
            : [];
          const svgUrl =
            files.find((f) => f.file_format === 'image/svg+xml')?.file ?? '';
          const pngUrl =
            files.find((f) => f.file_format === 'image/png')?.file ?? '';
          if (!id || (!svgUrl && !pngUrl)) continue;

          const seen = new Set<string>();
          const cellTypes: HraFtuCellType[] = [];
          for (const m of node.mapping ?? []) {
            const label = String(m.label ?? '').trim();
            if (!label || seen.has(label)) continue;
            seen.add(label);
            cellTypes.push({
              id: (m.representation_of ?? '').split('/').pop() || 'CL',
              label,
            });
          }

          items.push({
            id,
            label: String(node.label ?? id.split('/').pop() ?? 'FTU'),
            organLabel: String(node.organ_label ?? '').toLowerCase(),
            representationOf: String(node.representation_of ?? ''),
            uberonId: normalizeUberon(node.representation_of),
            svgUrl,
            pngUrl,
            cellTypes,
          });
        }
        ftuMemoryCache = items;
        if (items.length > 0) writeLocalJson(CACHE_KEY_FTU, items);
        return items;
      })
      .catch(() => [])
      .finally(() => {
        ftuPromise = null;
      });
  }

  return ftuPromise;
}

async function getRawReferenceOrgans(): Promise<RawReferenceOrgan[]> {
  if (dimsMemoryCache) return dimsMemoryCache;
  const stored = readSessionOrLocalJson<RawReferenceOrgan[]>(CACHE_KEY_REFS);
  if (stored && stored.length > 0) {
    dimsMemoryCache = stored;
    return stored;
  }

  if (!dimsPromise) {
    dimsPromise = fetch(NIH_HRA_REFERENCE_ORGANS_API, {
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`RefOrgans HTTP ${res.status}`);
        return res.json() as Promise<RawReferenceOrgan[]>;
      })
      .then((list) => {
        const valid = Array.isArray(list) ? list : [];
        dimsMemoryCache = valid;
        if (valid.length > 0) writeLocalJson(CACHE_KEY_REFS, valid);
        return valid;
      })
      .catch(() => [])
      .finally(() => {
        dimsPromise = null;
      });
  }

  return dimsPromise;
}

export async function getHraAsctbSummary(
  slug: string,
  organTitle: string
): Promise<HraAsctbSummary | null> {
  if (!slug) return null;
  const mem = asctbMemoryCache.get(slug);
  if (mem) return mem;

  const stored = readSessionOrLocalJson<HraAsctbSummary>(
    `${CACHE_KEY_ASCTB_PREFIX}${slug}`
  );
  if (stored) {
    asctbMemoryCache.set(slug, stored);
    return stored;
  }

  const existingReq = asctbInFlight.get(slug);
  if (existingReq) return existingReq;

  const req = fetch(
    `https://cdn.humanatlas.io/digital-objects/asct-b/${encodeURIComponent(slug)}/latest/graph.json`,
    { headers: { Accept: 'application/json' } }
  )
    .then(async (res) => {
      if (!res.ok) throw new Error(`ASCT+B HTTP ${res.status}`);
      return (await res.json()) as RawAsctbGraph;
    })
    .then((graph): HraAsctbSummary => {
      const cells: HraCellEntry[] = [];
      const seenCells = new Set<string>();
      for (const ct of graph.data?.cell_types ?? []) {
        const label = String(ct.ccf_pref_label ?? '').trim();
        const id = String(ct.id ?? '').trim();
        if (
          !label ||
          id === 'CL:0000000' ||
          id === 'LMHA:00135' ||
          /\bcell type$/i.test(label)
        ) {
          continue;
        }
        const key = label.toLowerCase();
        if (seenCells.has(key)) continue;
        seenCells.add(key);
        cells.push({ id: id || 'CL', label });
      }

      const biomarkers: HraBiomarkerEntry[] = [];
      const seenBm = new Set<string>();
      for (const bm of graph.data?.biomarkers ?? []) {
        const label = String(bm.ccf_pref_label ?? '').trim();
        const id = String(bm.id ?? '').trim();
        if (
          !label ||
          id.startsWith('HGNCO:') ||
          /^(gene|protein|lipids|metabolites|proteoforms)$/i.test(label)
        ) {
          continue;
        }
        const key = label.toLowerCase();
        if (seenBm.has(key)) continue;
        seenBm.add(key);
        biomarkers.push({
          id: id || 'HGNC',
          label,
          biomarkerType: String(bm.ccf_biomarker_type ?? 'gene').toLowerCase(),
        });
      }

      const summary: HraAsctbSummary = {
        slug,
        organTitle: organTitle || graph.metadata?.title || slug,
        iri: graph.iri,
        cellTypes: cells,
        biomarkers,
        source: 'hra-cdn',
      };
      asctbMemoryCache.set(slug, summary);
      writeLocalJson(`${CACHE_KEY_ASCTB_PREFIX}${slug}`, summary);
      return summary;
    })
    .catch((): HraAsctbSummary | null => {
      const offline = OFFLINE_ASCTB_BASELINES[slug];
      if (!offline) return null;
      const summary: HraAsctbSummary = {
        slug,
        organTitle,
        cellTypes: offline.cells,
        biomarkers: offline.biomarkers,
        source: 'curated-baseline',
      };
      asctbMemoryCache.set(slug, summary);
      return summary;
    })
    .finally(() => {
      asctbInFlight.delete(slug);
    });

  asctbInFlight.set(slug, req);
  return req;
}

function resolveOrganMatcher(part: AnatomicalPartInfo): OrganMatcherConfig | null {
  const hay = `${part.rawName} ${part.cleanName} ${part.latinName ?? ''} ${part.organGroupId ?? ''}`;
  for (const matcher of ORGAN_MATCHERS) {
    if (matcher.regex.test(hay)) return matcher;
  }
  if (part.system === 'skeletal') {
    return {
      organKey: 'skeleton',
      displayLabel: 'Skeletal System',
      asctbSlug: 'skeleton',
      uberonId: 'UBERON:0001434',
      ftuOrganKeys: [],
      regex: /.*/,
    };
  }
  if (part.system === 'muscular') {
    return {
      organKey: 'muscular system',
      displayLabel: 'Muscular System',
      asctbSlug: 'muscular-system',
      uberonId: 'UBERON:0002204',
      ftuOrganKeys: [],
      regex: /.*/,
    };
  }
  if (part.system === 'cardiovascular') {
    return ORGAN_MATCHERS.find((m) => m.organKey === 'blood vasculature') ?? null;
  }
  return null;
}

function selectDimensionForSex(
  rawRefs: RawReferenceOrgan[],
  matcher: OrganMatcherConfig,
  preferredSide: 'Left' | 'Right' | 'Unpaired',
  sex: BiologicalSex
): HraOrganDimensionRecord | undefined {
  const sexStr = sex === 'male' ? 'male' : 'female';
  const candidates = rawRefs.filter((r) => {
    if (String(r.sex ?? '').toLowerCase() !== sexStr) return false;
    const lbl = String(r.label ?? '').toLowerCase();
    return (
      lbl === matcher.organKey ||
      lbl.endsWith(` ${matcher.organKey}`) ||
      (matcher.organKey === 'placenta full term' && lbl.includes('placenta'))
    );
  });
  if (candidates.length === 0) return undefined;

  const sideMatch =
    preferredSide !== 'Unpaired'
      ? candidates.find(
          (c) => inferSideFromName(String(c.label ?? '')) === preferredSide
        )
      : undefined;
  const pick = sideMatch ?? candidates[0];
  if (
    typeof pick.x_dimension !== 'number' ||
    typeof pick.y_dimension !== 'number' ||
    typeof pick.z_dimension !== 'number'
  ) {
    return undefined;
  }
  return {
    sex,
    label: String(pick.label ?? matcher.displayLabel),
    side: inferSideFromName(String(pick.label ?? '')),
    uberonId: normalizeUberon(pick.representation_of) || matcher.uberonId,
    dimensionsMm: [pick.x_dimension, pick.y_dimension, pick.z_dimension],
    glbUrl: String(pick.object?.file ?? ''),
  };
}

export async function fetchHraClinicalEnrichment(
  part: AnatomicalPartInfo
): Promise<HraClinicalEnrichment> {
  const matcher = resolveOrganMatcher(part);
  if (!matcher) {
    return {
      canonicalOrganKey: null,
      uberonId: null,
      ftus: [],
      dimensionsBySex: {},
      asctb: null,
    };
  }

  const preferredSide = inferSideFromName(`${part.rawName} ${part.cleanName}`);

  const [allFtus, allRefOrgans, asctbSummary] = await Promise.all([
    getHraFtuIllustrations(),
    getRawReferenceOrgans(),
    getHraAsctbSummary(matcher.asctbSlug, matcher.displayLabel),
  ]);

  const matchingFtus = allFtus.filter((ftu) => {
    const ftuOrg = ftu.organLabel.toLowerCase();
    return (
      matcher.ftuOrganKeys.includes(ftuOrg) ||
      ftu.uberonId === matcher.uberonId
    );
  });

  const maleDim = selectDimensionForSex(allRefOrgans, matcher, preferredSide, 'male');
  const femaleDim = selectDimensionForSex(allRefOrgans, matcher, preferredSide, 'female');

  return {
    canonicalOrganKey: matcher.organKey,
    uberonId: maleDim?.uberonId ?? femaleDim?.uberonId ?? matcher.uberonId,
    ftus: matchingFtus,
    dimensionsBySex: {
      male: maleDim,
      female: femaleDim,
    },
    asctb: asctbSummary,
  };
}

export {
  HRA_RUI_REFERENCE_DATA_URL,
  getCachedHraSurgicalLandmarksSync,
  getHraSurgicalLandmarks,
  matchLandmarksForOrgan,
  type HraLandmarkMatchQuery,
  type HraLandmarkSubmesh,
  type HraSurgicalLandmarkGlb,
} from './hraLandmarkService';
