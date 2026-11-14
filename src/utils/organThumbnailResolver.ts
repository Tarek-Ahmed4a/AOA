export interface OrganThumbnailInput {
  title: string;
  canonicalOrgan?: string;
  glbUrl?: string;
  thumbnailUrl?: string | null;
  system?: string;
}

export const EXPLORER_THUMBS_STORAGE_KEY = 'anatomy_explorer_thumbs_v1';

const WIKI_SUMMARY_API_BASE =
  'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WIKI_ACTION_API_BASE = 'https://en.wikipedia.org/w/api.php';

const MAX_CONCURRENT_WIKI_REQUESTS = 2;
const REQUEST_SPACING_MS = 75;
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Ordered specificity mapping from NIH HRA / BodyParts3D / NIH 3D / University titles
 * and filenames to canonical English Wikipedia anatomical article titles.
 */
const CANONICAL_ORGAN_RULES: Array<[RegExp, string]> = [
  [/\b(?:uterus|endometrial|endometrium|myometrium|cervix)\b/i, 'Uterus'],
  [/\b(?:pancreas|pancreatic|exocrine duct|islets)\b/i, 'Pancreas'],
  [/\b(?:splen|spleen)\b/i, 'Spleen'],
  [/\b(?:spinal[\s_-]*cord|medulla spinalis)\b/i, 'Spinal_cord'],
  [/\b(?:fallopian|uterine[\s_-]*tube|oviduct|salpinx)\b/i, 'Fallopian_tube'],
  [/\b(?:urinary[\s_-]*bladder|vesica urinaria)\b/i, 'Urinary_bladder'],
  [/\b(?:gallbladder|cholecyst|cystic duct)\b/i, 'Gallbladder'],
  [/\b(?:renal[\s_-]*pelvis|pelvis of kidney)\b/i, 'Renal_pelvis'],
  [/\b(?:large[\s_-]*intestine|colon|epiploic[\s_-]*appendage|caecum|cecum|rectum)\b/i, 'Large_intestine'],
  [/\b(?:small[\s_-]*intestine|duodenum|jejunum|ileum)\b/i, 'Small_intestine'],
  [/\b(?:mammary|breast|areola|nipple)\b/i, 'Mammary_gland'],
  [/\b(?:palatine[\s_-]*tonsil|tonsil)\b/i, 'Palatine_tonsil'],
  [/\b(?:intervertebral[\s_-]*dis[ck])\b/i, 'Intervertebral_disc'],
  [/\b(?:greater[\s_-]*omentum|lesser[\s_-]*omentum|omentum|peritoneum)\b/i, 'Greater_omentum'],
  [/\b(?:lymph[\s_-]*node|lymphoid)\b/i, 'Lymph_node'],
  [/\b(?:adipose|fat tissue)\b/i, 'Adipose_tissue'],
  [/\b(?:heart|cardiac|myocardium|coronary|pericardium)\b/i, 'Heart'],
  [/\b(?:blood[\s_-]*vasculature|vascular[\s_-]*tree|arterial|venous|aorta|angiography|circulatory)\b/i, 'Circulatory_system'],
  [/\b(?:liver|hepatic)\b/i, 'Liver'],
  [/\b(?:kidney|renal|nephron|calyces)\b/i, 'Kidney'],
  [/\b(?:cerebellum|cerebellar)\b/i, 'Cerebellum'],
  [/\b(?:brain|cerebral|gyri|sulci|encephalon|allen atlas)\b/i, 'Human_brain'],
  [/\b(?:lung|pulmonary|alveol)\b/i, 'Lung'],
  [/\b(?:trachea|windpipe)\b/i, 'Trachea'],
  [/\b(?:main[\s_-]*bronchus|bronchus|bronchi)\b/i, 'Bronchus'],
  [/\b(?:larynx|vocal cord)\b/i, 'Larynx'],
  [/\b(?:stomach|gastric)\b/i, 'Stomach'],
  [/\b(?:esophagus|oesophagus)\b/i, 'Esophagus'],
  [/\b(?:thyroid)\b/i, 'Thyroid'],
  [/\b(?:thymus)\b/i, 'Thymus'],
  [/\b(?:ureter)\b/i, 'Ureter'],
  [/\b(?:ovary|ovaries|ovarian)\b/i, 'Ovary'],
  [/\b(?:prostate)\b/i, 'Prostate'],
  [/\b(?:pelvis|pelvic[\s_-]*girdle|acetabulum|sacrum|ilium|ischium|pubis)\b/i, 'Pelvis'],
  [/\b(?:femur|femoral)\b/i, 'Femur'],
  [/\b(?:knee|meniscal|meniscus|patella)\b/i, 'Knee'],
  [/\b(?:skull|cranium|mandible|calvaria|temporal bone)\b/i, 'Human_skull'],
  [/\b(?:sternum|manubrium|xiphoid)\b/i, 'Sternum'],
  [/\b(?:rib[\s_-]*cage|thorax|thoracic cage|ribs)\b/i, 'Rib_cage'],
  [/\b(?:vertebra|vertebral[\s_-]*column|spine)\b/i, 'Vertebral_column'],
  [/\b(?:humerus)\b/i, 'Humerus'],
  [/\b(?:tibia)\b/i, 'Tibia'],
  [/\b(?:fibula)\b/i, 'Fibula'],
  [/\b(?:clavicle)\b/i, 'Clavicle'],
  [/\b(?:scapula)\b/i, 'Scapula'],
  [/\b(?:skin|integument|dermal|cutis)\b/i, 'Human_skin'],
  [/\b(?:bladder)\b/i, 'Urinary_bladder'],
  [/\b(?:skeleton|osteology|bone)\b/i, 'Human_skeleton'],
  [/\b(?:muscle|muscular|myology|biceps|triceps|deltoid|quadriceps)\b/i, 'Muscular_system'],
];

const SYSTEM_FALLBACK_WIKI_TITLE: Record<string, string> = {
  nervous: 'Human_brain',
  cardiovascular: 'Heart',
  skeletal: 'Human_skeleton',
  muscular: 'Muscular_system',
  visceral: 'Abdomen',
  integumentary: 'Human_skin',
};

const memoryThumbCache = new Map<string, string>();
let storageHydrated = false;
const inFlightTitlePromises = new Map<string, Promise<string | null>>();

let activeRequests = 0;
const waitQueue: Array<() => void> = [];

async function withWikiConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (activeRequests >= MAX_CONCURRENT_WIKI_REQUESTS) {
    await new Promise<void>((resolve) => {
      waitQueue.push(resolve);
    });
  }
  activeRequests += 1;
  try {
    return await fn();
  } finally {
    await new Promise<void>((resolve) => setTimeout(resolve, REQUEST_SPACING_MS));
    activeRequests -= 1;
    const next = waitQueue.shift();
    if (next) next();
  }
}

function hydrateStorageOnce(): void {
  if (storageHydrated || typeof window === 'undefined') return;
  storageHydrated = true;
  try {
    const raw = window.localStorage.getItem(EXPLORER_THUMBS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === 'string' && val.startsWith('http')) {
          memoryThumbCache.set(key, val);
        }
      }
    }
  } catch {
    // Ignore storage read or JSON parse errors gracefully
  }
}

function persistCacheToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of memoryThumbCache.entries()) {
      obj[k] = v;
    }
    window.localStorage.setItem(
      EXPLORER_THUMBS_STORAGE_KEY,
      JSON.stringify(obj)
    );
  } catch {
    // Ignore QuotaExceededError or private storage errors cleanly
  }
}

function cacheResolvedThumb(wikiTitle: string, url: string): void {
  if (!url || !url.startsWith('http')) return;
  hydrateStorageOnce();
  memoryThumbCache.set(wikiTitle, url);
  persistCacheToStorage();
}

export function getSystemFallbackWikiTitle(system?: string): string {
  if (system && SYSTEM_FALLBACK_WIKI_TITLE[system]) {
    return SYSTEM_FALLBACK_WIKI_TITLE[system];
  }
  return 'Heart';
}

/**
 * Maps any anatomical card title, canonical organ name, or GLB filename to its
 * exact canonical English Wikipedia article slug for Wikimedia REST image resolution.
 */
export function resolveCanonicalWikiTitle(item: OrganThumbnailInput): string {
  const glbFilename = item.glbUrl
    ? decodeURIComponent(item.glbUrl.split('/').pop() ?? '')
        .replace(/\.glb$/i, '')
        .replace(/[-_]+/g, ' ')
    : '';
  const combined = `${item.canonicalOrgan ?? ''} ${item.title} ${glbFilename}`
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [regex, wikiTitle] of CANONICAL_ORGAN_RULES) {
    if (regex.test(combined)) {
      return wikiTitle;
    }
  }

  return getSystemFallbackWikiTitle(item.system);
}

/**
 * Synchronously checks memory & localStorage (`anatomy_explorer_thumbs_v1`) for an already-resolved thumbnail URL.
 */
export function getCachedOrganThumbnail(
  item: OrganThumbnailInput
): string | null {
  hydrateStorageOnce();
  const wikiTitle = resolveCanonicalWikiTitle(item);
  const direct = memoryThumbCache.get(wikiTitle);
  if (direct) return direct;
  const fallback = getSystemFallbackWikiTitle(item.system);
  return memoryThumbCache.get(fallback) ?? null;
}

async function fetchWikiSummaryThumb(wikiTitle: string): Promise<string | null> {
  hydrateStorageOnce();
  const cached = memoryThumbCache.get(wikiTitle);
  if (cached) return cached;

  const existing = inFlightTitlePromises.get(wikiTitle);
  if (existing) return existing;

  const task = withWikiConcurrencyLimit(async () => {
    const controller = new AbortController();
    const timer =
      typeof window !== 'undefined'
        ? window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
        : setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = `${WIKI_SUMMARY_API_BASE}${encodeURIComponent(wikiTitle)}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        thumbnail?: { source?: string };
        originalimage?: { source?: string };
      };
      const imgUrl =
        data?.thumbnail?.source || data?.originalimage?.source || null;
      if (imgUrl && imgUrl.startsWith('http')) {
        cacheResolvedThumb(wikiTitle, imgUrl);
        return imgUrl;
      }
      return null;
    } catch {
      return null;
    } finally {
      if (typeof window !== 'undefined') {
        window.clearTimeout(timer);
      } else {
        clearTimeout(timer);
      }
      inFlightTitlePromises.delete(wikiTitle);
    }
  });

  inFlightTitlePromises.set(wikiTitle, task);
  return task;
}

/**
 * Batch-warms Wikimedia thumbnails for an entire array of uncached cards in a single
 * HTTP query (`action=query&prop=pageimages`) to avoid burst 429 limits when switching filters.
 */
export async function prefetchOrganThumbnails(
  items: OrganThumbnailInput[]
): Promise<void> {
  if (typeof window === 'undefined' || items.length === 0) return;
  hydrateStorageOnce();

  const missingTitles = new Set<string>();
  for (const item of items) {
    if (item.thumbnailUrl) continue;
    const wikiTitle = resolveCanonicalWikiTitle(item);
    if (!memoryThumbCache.has(wikiTitle)) {
      missingTitles.add(wikiTitle);
    }
  }

  if (missingTitles.size === 0) return;

  const titleList = Array.from(missingTitles).slice(0, 45);
  try {
    const endpoint =
      `${WIKI_ACTION_API_BASE}?action=query&titles=${encodeURIComponent(
        titleList.join('|')
      )}&prop=pageimages&format=json&pithumbsize=480&redirects=1&origin=*`;
    const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const json = (await res.json()) as {
      query?: {
        normalized?: Array<{ from?: string; to?: string }>;
        redirects?: Array<{ from?: string; to?: string }>;
        pages?: Record<
          string,
          { title?: string; thumbnail?: { source?: string } }
        >;
      };
    };
    const q = json?.query;
    if (!q?.pages) return;

    const thumbByPageTitle = new Map<string, string>();
    for (const page of Object.values(q.pages)) {
      if (page?.title && page.thumbnail?.source) {
        thumbByPageTitle.set(page.title, page.thumbnail.source);
      }
    }

    const redirectMap = new Map<string, string>();
    for (const norm of q.normalized ?? []) {
      if (norm.from && norm.to) redirectMap.set(norm.from, norm.to);
    }
    for (const redir of q.redirects ?? []) {
      if (redir.from && redir.to) redirectMap.set(redir.from, redir.to);
    }

    for (const rawTitle of titleList) {
      const normalized = rawTitle.replace(/_/g, ' ');
      const step1 = redirectMap.get(rawTitle) ?? redirectMap.get(normalized) ?? normalized;
      const finalTitle = redirectMap.get(step1) ?? step1;
      const src = thumbByPageTitle.get(finalTitle) ?? thumbByPageTitle.get(step1);
      if (src && src.startsWith('http')) {
        cacheResolvedThumb(rawTitle, src);
      }
    }
  } catch {
    // Individual resolveOrganThumbnail calls will gracefully recover per-card
  }
}

/**
 * Resolves a high-resolution anatomical illustration/render via Wikimedia REST API
 * (`en.wikipedia.org/api/rest_v1/page/summary/{canonical_organ_title}`), falling back
 * automatically to the system-level anatomical summary image and persisting in `localStorage`.
 */
export async function resolveOrganThumbnail(
  item: OrganThumbnailInput
): Promise<string | null> {
  if (item.thumbnailUrl && item.thumbnailUrl.startsWith('http')) {
    return item.thumbnailUrl;
  }

  const wikiTitle = resolveCanonicalWikiTitle(item);
  const resolved = await fetchWikiSummaryThumb(wikiTitle);
  if (resolved) return resolved;

  const fallbackTitle = getSystemFallbackWikiTitle(item.system);
  if (fallbackTitle !== wikiTitle) {
    return fetchWikiSummaryThumb(fallbackTitle);
  }
  return null;
}
