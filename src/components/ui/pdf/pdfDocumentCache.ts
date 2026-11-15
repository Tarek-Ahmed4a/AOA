export interface CachedPdfEntry {
  url: string;
  pdfjs: typeof import('pdfjs-dist');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any;
  defaultAspect: number;
  numPages: number;
}

const MAX_CACHED_PDF_DOCS = 2;
const docCache = new Map<string, CachedPdfEntry>();
const inFlightLoads = new Map<string, Promise<CachedPdfEntry>>();

async function ensurePdfJsLoaded(): Promise<typeof import('pdfjs-dist')> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
  return pdfjs;
}

/**
 * Loads and retains up to 2 parsed `PDFDocumentProxy` instances across tab and
 * view-mode switches so switching between Book 1, Book 2, Split View, and the
 * 3D Atlas never re-downloads 120–198 MB PDF files or rebuilds workers.
 */
export async function loadCachedPdfDocument(options: {
  url: string;
  isNative: boolean;
  fallbackSizeBytes?: number;
  fallbackPageCount?: number;
  onProgress?: (pct: number) => void;
}): Promise<CachedPdfEntry> {
  const { url, isNative, fallbackSizeBytes = 0, fallbackPageCount = 1, onProgress } = options;

  const existing = docCache.get(url);
  if (existing) {
    // Refresh LRU position
    docCache.delete(url);
    docCache.set(url, existing);
    return existing;
  }

  const inflight = inFlightLoads.get(url);
  if (inflight) {
    return inflight;
  }

  const promise = (async () => {
    const pdfjs = await ensurePdfJsLoaded();

    // Capacitor Android WebViewLocalServer returns 206 headers without skipping
    // range offsets; disable Range only on native mobile. On desktop web,
    // enable 206 byte-range chunking with auto-fetch disabled so only active pages load.
    const loadingTask = pdfjs.getDocument({
      url,
      disableRange: isNative,
      disableAutoFetch: !isNative,
      disableStream: false,
      rangeChunkSize: 262144,
    });

    (
      loadingTask as unknown as {
        onProgress?: (progress: { loaded: number; total: number }) => void;
      }
    ).onProgress = ({ loaded, total }) => {
      if (!onProgress) return;
      const denominator = total > 0 ? total : isNative ? 0 : fallbackSizeBytes;
      if (denominator > 0) {
        onProgress(Math.min(99, Math.max(0, Math.round((loaded / denominator) * 100))));
      }
    };

    const doc = await loadingTask.promise;
    const firstPage = await doc.getPage(1);
    const vp1 = firstPage.getViewport({ scale: 1 });
    const defaultAspect = vp1.width > 0 ? vp1.height / vp1.width : 1.3;

    const entry: CachedPdfEntry = {
      url,
      pdfjs,
      doc,
      defaultAspect,
      numPages: doc.numPages || fallbackPageCount || 1,
    };

    if (docCache.size >= MAX_CACHED_PDF_DOCS) {
      const oldestKey = docCache.keys().next().value;
      if (oldestKey && oldestKey !== url) {
        const evicted = docCache.get(oldestKey);
        docCache.delete(oldestKey);
        try {
          void evicted?.doc?.destroy?.();
        } catch {
          // Ignore disposal errors on LRU eviction
        }
      }
    }

    docCache.set(url, entry);
    return entry;
  })();

  inFlightLoads.set(url, promise);
  try {
    return await promise;
  } finally {
    if (inFlightLoads.get(url) === promise) {
      inFlightLoads.delete(url);
    }
  }
}
