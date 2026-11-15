import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FolderOpen,
  Globe,
  Highlighter,
  Pencil,
  Search,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { translateAnatomicalTermToArabic } from '../../data/clinicalBaseline';
import { cn } from '../../lib/utils';
import {
  getAllTextbookEntries,
  type TextbookEntryRecord,
} from '../../services/textbookKnowledgeService';
import { useAnatomyStore, useAppNavigationStore } from '../../store/useAnatomyStore';
import {
  DEFAULT_PDF_BOOKS,
  usePdfSessionStore,
  type PdfBookManifestEntry,
} from '../../store/usePdfSessionStore';
import { resolveAssetUrl } from '../../utils/assetUrl';

type AnnotationTool = 'read' | 'pen' | 'highlight' | 'text' | 'eraser';

interface InkStroke {
  id: string;
  mode: 'pen' | 'highlight';
  color: string;
  width: number;
  points: Array<[number, number]>;
}

interface PdfTextNote {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface PdfPageAnnotationState {
  strokes: InkStroke[];
  notes: PdfTextNote[];
}

const INK_PALETTE = [
  { id: 'crimson', hex: '#ef4444', label: 'Crimson Ink' },
  { id: 'amber', hex: '#facc15', label: 'Highlight Gold' },
  { id: 'sky', hex: '#0284c7', label: 'Clinical Blue' },
  { id: 'emerald', hex: '#10b981', label: 'Surgical Green' },
  { id: 'obsidian', hex: '#111827', label: 'Dark Ink' },
] as const;

const ANNOTATION_STORAGE_PREFIX = 'aoa:pdf-ann:v1';

function buildAnnotationStorageKey(bookId: string, page: number): string {
  return `${ANNOTATION_STORAGE_PREFIX}:${bookId}:p${Math.max(1, Math.floor(page || 1))}`;
}

function loadPageAnnotations(
  bookId: string,
  page: number
): PdfPageAnnotationState {
  if (typeof window === 'undefined') return { strokes: [], notes: [] };
  try {
    const raw = window.localStorage.getItem(
      buildAnnotationStorageKey(bookId, page)
    );
    if (!raw) return { strokes: [], notes: [] };
    const parsed = JSON.parse(raw) as Partial<PdfPageAnnotationState>;
    return {
      strokes: Array.isArray(parsed.strokes) ? parsed.strokes : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    return { strokes: [], notes: [] };
  }
}

function savePageAnnotations(
  bookId: string,
  page: number,
  data: PdfPageAnnotationState
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = buildAnnotationStorageKey(bookId, page);
    if (data.strokes.length === 0 && data.notes.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(data));
    }
  } catch {
    // Ignore storage quota overflow gracefully
  }
}

function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (
    window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

function buildPdfIframeSrc(url: string, page: number, keyword?: string): string {
  const safePage = Math.max(1, Math.floor(page || 1));
  const cleanSearch = keyword
    ? `&search=${encodeURIComponent(keyword.trim().slice(0, 60))}`
    : '';
  return `${url}#toolbar=1&navpanes=0&view=FitH&page=${safePage}${cleanSearch}`;
}

interface PdfJsCanvasProps {
  pdfUrl: string;
  pageNumber: number;
  title: string;
  remoteFallbackUrl?: string;
  onSelectLocalFile: (file: File | null | undefined) => void;
}

const PdfJsCanvasViewer: React.FC<PdfJsCanvasProps> = ({
  pdfUrl,
  pageNumber,
  title,
  remoteFallbackUrl,
  onSelectLocalFile,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState<string>('');
  const [zoomScale, setZoomScale] = useState<number>(1.35);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const loadedUrlRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderTask: any = null;

    async function loadAndRender() {
      try {
        setStatus('loading');
        setErrorText('');
        const pdfjs = await import('pdfjs-dist');
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
          ).toString();
        }

        if (loadedUrlRef.current !== pdfUrl || !pdfDocRef.current) {
          const loadingTask = pdfjs.getDocument({
            url: pdfUrl,
            disableAutoFetch: true,
            disableStream: false,
          });
          const doc = await loadingTask.promise;
          if (cancelled) {
            void loadingTask.destroy?.();
            return;
          }
          pdfDocRef.current = doc;
          loadedUrlRef.current = pdfUrl;
        }

        const doc = pdfDocRef.current;
        const safePage = Math.max(1, Math.min(pageNumber, doc.numPages || pageNumber));
        const page = await doc.getPage(safePage);
        if (cancelled || !canvasRef.current) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: zoomScale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = page.render({
          canvasContext: ctx,
          canvas,
          viewport,
        });
        await renderTask.promise;
        if (!cancelled) {
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorText(
            err instanceof Error ? err.message : 'Unable to stream PDF page'
          );
        }
      }
    }

    void loadAndRender();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel?.();
      } catch {
        // Ignore task cancel error
      }
    };
  }, [pdfUrl, pageNumber, zoomScale]);

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-auto bg-[#141418] p-2 pb-16">
      <div className="mb-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/90 px-2.5 py-1 font-mono text-[10px] text-zinc-300">
        <button
          type="button"
          onClick={() => setZoomScale((z) => Math.max(0.75, z - 0.2))}
          className="rounded px-1.5 py-0.5 hover:bg-white/10"
        >
          -
        </button>
        <span>{Math.round(zoomScale * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoomScale((z) => Math.min(2.6, z + 0.2))}
          className="rounded px-1.5 py-0.5 hover:bg-white/10"
        >
          +
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-zinc-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <span>Rendering {title} page {pageNumber}...</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex max-w-sm flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <p className="text-xs font-medium text-rose-300">
            Inline streaming unavailable ({errorText || 'CORS / Offline'}).
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {remoteFallbackUrl && (
              <a
                href={`${remoteFallbackUrl}#page=${pageNumber}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 font-mono text-[11px] font-medium text-sky-200 hover:bg-sky-500/30"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Open PDF in Browser</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-mono text-[11px] text-white hover:bg-white/20"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Select Local .PDF</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              onSelectLocalFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      )}

      <canvas
        ref={canvasRef}
        className={cn(
          'rounded-md bg-white shadow-2xl',
          status === 'error' && 'hidden'
        )}
      />
    </div>
  );
};

const OFFLINE_CHAPTER_FILTERS = [
  { id: 'all', label: 'All Chapters' },
  { id: 'head', label: 'Head & Neck', match: /head|neck|crani|brain|face|eye|ear|laryn|pharyn|oral/i },
  { id: 'back', label: 'Back & Spine', match: /back|spin|vertebr|sacr/i },
  { id: 'thorax', label: 'Thorax & Cardiopulm', match: /thorax|thorac|heart|lung|pulmon|mediast|rib|stern/i },
  { id: 'abdomen', label: 'Abdomen & GI', match: /abdom|stomach|liver|hepat|pancre|spleen|kidney|renal|intestin|colon/i },
  { id: 'pelvis', label: 'Pelvis & Repro', match: /pelv|perine|uter|ovar|prostat|bladder/i },
  { id: 'upper', label: 'Upper Limb', match: /upper|shoulder|arm|forearm|hand|brachi|clavic|scapul|humer|radi|ulna/i },
  { id: 'lower', label: 'Lower Limb', match: /lower|hip|thigh|leg|knee|ankle|foot|femor|tibi|fibul|glute/i },
] as const;

const OfflineTextbookChapterReader: React.FC<{
  book: PdfBookManifestEntry;
  initialQuery: string;
  onOpenLocalFile: () => void;
  onStreamRemotePdf?: () => void;
}> = ({ book, initialQuery, onOpenLocalFile, onStreamRemotePdf }) => {
  const [filterQuery, setFilterQuery] = useState(initialQuery);
  const [selectedChapter, setSelectedChapter] = useState<string>('all');

  useEffect(() => {
    if (initialQuery.trim()) {
      setFilterQuery(initialQuery);
    }
  }, [initialQuery]);

  const allEntries = useMemo<TextbookEntryRecord[]>(() => {
    const entries = getAllTextbookEntries();
    return entries.sort((a, b) => a.canonicalNameEn.localeCompare(b.canonicalNameEn));
  }, []);

  const filteredEntries = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const chapterObj = OFFLINE_CHAPTER_FILTERS.find((c) => c.id === selectedChapter);
    const sourceFilter = book.role === 'atlas' ? 'netter' : 'grays';

    const list = allEntries.filter((entry) => {
      if (chapterObj && 'match' in chapterObj && chapterObj.match) {
        const regHay = `${entry.region} ${entry.canonicalNameEn} ${entry.muscleGroup ?? ''}`;
        if (!chapterObj.match.test(regHay)) return false;
      }
      if (q) {
        const ar = translateAnatomicalTermToArabic(
          entry.canonicalNameEn,
          'Median / Unpaired',
          entry.system
        ).toLowerCase();
        const hay = `${entry.canonicalNameEn} ${ar} ${entry.region} ${entry.system} ${entry.summaryEn} ${entry.clinicalNotesEn ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Prioritize entries from matching reference book (Netter for Book 1, Gray's for Book 2)
    list.sort((a, b) => {
      const aHas = a.sources.includes(sourceFilter) ? 1 : 0;
      const bHas = b.sources.includes(sourceFilter) ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas;
      return a.canonicalNameEn.localeCompare(b.canonicalNameEn);
    });

    return list.slice(0, 60);
  }, [allEntries, book.role, filterQuery, selectedChapter]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#070709] text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0d0d12] px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-emerald-300">
              Built-In Offline Chapter Reader
            </span>
            <span className="hidden sm:inline font-mono text-[10px] text-zinc-400">
              {allEntries.length.toLocaleString()} indexed textbook structures
            </span>
          </div>
          <h3 className="mt-1 truncate text-xs sm:text-sm font-semibold text-white">
            {book.sourceTitle}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenLocalFile}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-mono text-[10.5px] font-medium text-white transition-colors hover:bg-white/20 active:scale-95"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>📂 Load Local .PDF File from Phone</span>
          </button>

          {onStreamRemotePdf && book.remoteFallbackUrl && (
            <>
              <button
                type="button"
                onClick={onStreamRemotePdf}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/50 bg-sky-500/20 px-3 py-1.5 font-mono text-[10.5px] font-semibold text-sky-200 transition-colors hover:bg-sky-500/30 active:scale-95"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>☁️ Stream Full PDF</span>
              </button>
              <a
                href={book.remoteFallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 font-mono text-[10.5px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/25 active:scale-95"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Full PDF Book</span>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Chapter Pills & Search Bar */}
      <div className="flex flex-col gap-2 border-b border-white/10 bg-[#0a0a0e] px-3 py-2 sm:px-4">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter chapters, organs, plates, clinical notes, Arabic terms..."
            className="w-full rounded-lg border border-white/10 bg-black/50 py-1.5 pl-8 pr-8 text-xs text-white placeholder:text-zinc-500 focus:border-sky-500/50 focus:outline-none"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              aria-label="Clear chapter filter"
              className="absolute right-2 rounded p-0.5 text-zinc-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {OFFLINE_CHAPTER_FILTERS.map((ch) => {
            const active = selectedChapter === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChapter(ch.id)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium transition-colors',
                  active
                    ? 'border-sky-500/45 bg-sky-500/20 text-sky-300'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                )}
              >
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Clinical Chapters Reader */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3 sm:p-4">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <BookOpen className="mb-2 h-6 w-6 text-zinc-500" />
            <p className="text-xs font-medium text-zinc-300">
              No matching chapter entries for &ldquo;{filterQuery}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterQuery('');
                setSelectedChapter('all');
              }}
              className="mt-2 rounded-full border border-sky-500/40 bg-sky-500/15 px-3 py-1 font-mono text-[10px] text-sky-300 hover:bg-sky-500/25"
            >
              Show All Indexed Chapters
            </button>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const arName = translateAnatomicalTermToArabic(
              entry.canonicalNameEn,
              'Median / Unpaired',
              entry.system
            );
            return (
              <article
                key={`${entry.canonicalNameEn}-${entry.region}`}
                className="rounded-xl border border-white/10 bg-[#0d0d13] p-3.5 shadow-md transition-colors hover:border-sky-500/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {entry.canonicalNameEn}
                    </h4>
                    {arName && (
                      <p dir="rtl" className="text-xs font-medium text-sky-300/90">
                        {arName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[9.5px] uppercase text-zinc-300">
                      {entry.system}
                    </span>
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[9.5px] text-sky-300">
                      {entry.region}
                    </span>
                  </div>
                </div>

                {(entry.netterRef || entry.grayRef) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 font-mono text-[10px] text-emerald-300/90">
                    {entry.netterRef && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5">
                        📘 {entry.netterRef}
                      </span>
                    )}
                    {entry.grayRef && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-200/90">
                        📗 {entry.grayRef}
                      </span>
                    )}
                  </div>
                )}

                <p className="mt-2 text-xs leading-relaxed text-zinc-200">
                  {entry.summaryEn}
                </p>

                <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] text-zinc-300 sm:grid-cols-2">
                  {entry.primaryFunctionEn && (
                    <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                        Function:{' '}
                      </span>
                      <span>{entry.primaryFunctionEn}</span>
                    </div>
                  )}
                  {entry.origin && (
                    <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                        Origin:{' '}
                      </span>
                      <span>{entry.origin}</span>
                    </div>
                  )}
                  {entry.insertion && (
                    <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                        Insertion:{' '}
                      </span>
                      <span>{entry.insertion}</span>
                    </div>
                  )}
                  {entry.arterialSupply && (
                    <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-rose-300">
                        Arterial:{' '}
                      </span>
                      <span>{entry.arterialSupply}</span>
                    </div>
                  )}
                  {entry.innervation && (
                    <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-amber-300">
                        Innervation:{' '}
                      </span>
                      <span>{entry.innervation}</span>
                    </div>
                  )}
                  {entry.relationsEn && (
                    <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                        Relations:{' '}
                      </span>
                      <span>{entry.relationsEn}</span>
                    </div>
                  )}
                </div>

                {entry.clinicalNotesEn && (
                  <p className="mt-2 rounded-lg border border-sky-500/20 bg-sky-500/[0.06] px-2.5 py-1.5 text-[11px] leading-relaxed text-sky-100">
                    <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sky-300">
                      Clinical Pearl:{' '}
                    </span>
                    {entry.clinicalNotesEn}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

interface PdfFramePaneProps {
  book: PdfBookManifestEntry;
  customUrl?: string;
  pageNumber: number;
  navNonce: number;
  searchKeyword: string;
  onJumpPage: (page: number) => void;
  onSelectLocalFile: (file: File | null | undefined) => void;
}

const PdfFramePane: React.FC<PdfFramePaneProps> = ({
  book,
  customUrl,
  pageNumber,
  navNonce,
  searchKeyword,
  onJumpPage,
  onSelectLocalFile,
}) => {
  const isNative = useMemo(() => isCapacitorNative(), []);
  const localResolvedUrl = resolveAssetUrl(customUrl ?? book.url);
  const [localStatus, setLocalStatus] = useState<'checking' | 'ready' | 'missing'>(() =>
    customUrl ? 'ready' : 'checking'
  );
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);

  useEffect(() => {
    if (customUrl) {
      setLocalStatus('ready');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLocalStatus('checking');

    fetch(localResolvedUrl, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((res) => {
        if (cancelled) return;
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const isHtmlFallback = ct.includes('text/html');
        const isPdfOrBinary =
          ct.includes('pdf') || ct.includes('octet-stream') || ct === '';
        if (res.ok && !isHtmlFallback && isPdfOrBinary) {
          setLocalStatus('ready');
        } else {
          setLocalStatus('missing');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocalStatus('missing');
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [customUrl, localResolvedUrl]);

  const [tool, setTool] = useState<AnnotationTool>('read');
  const [inkHex, setInkHex] = useState<string>(INK_PALETTE[0].hex);
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const [annotations, setAnnotations] = useState<PdfPageAnnotationState>(() =>
    loadPageAnnotations(book.id, pageNumber)
  );
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const paneRef = useRef<HTMLDivElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const mobilePickerRef = useRef<HTMLInputElement>(null);
  const activeStrokeRef = useRef<InkStroke | null>(null);
  const draggingNoteRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    setAnnotations(loadPageAnnotations(book.id, pageNumber));
    setEditingNoteId(null);
  }, [book.id, pageNumber]);

  useEffect(() => {
    savePageAnnotations(book.id, pageNumber, annotations);
  }, [book.id, pageNumber, annotations]);

  const redrawInkCanvas = useCallback(
    (pendingStroke: InkStroke | null = null) => {
      const canvas = inkCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      if (!showAnnotations) return;

      const drawStroke = (s: InkStroke) => {
        if (s.points.length === 0) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = s.mode === 'highlight' ? 0.34 : 0.94;
        ctx.lineWidth = s.width;
        ctx.beginPath();
        const [x0, y0] = s.points[0];
        ctx.moveTo(x0 * rect.width, y0 * rect.height);
        for (let i = 1; i < s.points.length; i += 1) {
          const [px, py] = s.points[i];
          ctx.lineTo(px * rect.width, py * rect.height);
        }
        if (s.points.length === 1) {
          ctx.lineTo(x0 * rect.width + 0.5, y0 * rect.height + 0.5);
        }
        ctx.stroke();
        ctx.restore();
      };

      for (const stroke of annotations.strokes) {
        drawStroke(stroke);
      }
      if (pendingStroke) {
        drawStroke(pendingStroke);
      }
    },
    [annotations.strokes, showAnnotations]
  );

  useEffect(() => {
    redrawInkCanvas(activeStrokeRef.current);
  }, [redrawInkCanvas]);

  useEffect(() => {
    const canvas = inkCanvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => redrawInkCanvas(activeStrokeRef.current));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redrawInkCanvas]);

  const toNormalizedPoint = (
    e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>
  ): [number, number] | null => {
    const el = inkCanvasRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return [
      Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    ];
  };

  const eraseAtNormalizedPoint = useCallback((nx: number, ny: number) => {
    const hitRadius = 0.024;
    setAnnotations((prev) => {
      const nextStrokes = prev.strokes.filter(
        (s) =>
          !s.points.some(([px, py]) => Math.hypot(px - nx, py - ny) <= hitRadius)
      );
      if (nextStrokes.length === prev.strokes.length) return prev;
      return { ...prev, strokes: nextStrokes };
    });
  }, []);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'read') return;
    const pt = toNormalizedPoint(e);
    if (!pt) return;

    if (tool === 'text') {
      const newNote: PdfTextNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        x: Math.min(pt[0], 0.86),
        y: Math.min(pt[1], 0.88),
        text: '',
        color: inkHex,
      };
      setShowAnnotations(true);
      setAnnotations((prev) => ({
        ...prev,
        notes: [...prev.notes, newNote],
      }));
      setEditingNoteId(newNote.id);
      return;
    }

    if (tool === 'eraser') {
      e.currentTarget.setPointerCapture(e.pointerId);
      eraseAtNormalizedPoint(pt[0], pt[1]);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    setShowAnnotations(true);
    const stroke: InkStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mode: tool === 'highlight' ? 'highlight' : 'pen',
      color: inkHex,
      width: tool === 'highlight' ? 16 : 2.8,
      points: [pt],
    };
    activeStrokeRef.current = stroke;
    redrawInkCanvas(stroke);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'eraser' && (e.buttons & 1) === 1) {
      const pt = toNormalizedPoint(e);
      if (pt) eraseAtNormalizedPoint(pt[0], pt[1]);
      return;
    }
    const active = activeStrokeRef.current;
    if (!active) return;
    const pt = toNormalizedPoint(e);
    if (!pt) return;
    const last = active.points[active.points.length - 1];
    if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= 0.0025) {
      active.points.push(pt);
      redrawInkCanvas(active);
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const finished = activeStrokeRef.current;
    if (!finished) return;
    activeStrokeRef.current = null;
    setAnnotations((prev) => ({
      ...prev,
      strokes: [...prev.strokes, finished],
    }));
  };

  const handleUndo = () => {
    setAnnotations((prev) => {
      if (prev.strokes.length > 0) {
        return { ...prev, strokes: prev.strokes.slice(0, -1) };
      }
      if (prev.notes.length > 0) {
        return { ...prev, notes: prev.notes.slice(0, -1) };
      }
      return prev;
    });
  };

  const handleExportNotes = () => {
    const payload = {
      bookId: book.id,
      bookTitle: book.sourceTitle,
      pageNumber,
      exportedAt: new Date().toISOString(),
      ...annotations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.id}-page-${pageNumber}-annotations.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const iframeSrc = useMemo(
    () => buildPdfIframeSrc(localResolvedUrl, pageNumber, searchKeyword),
    [localResolvedUrl, pageNumber, searchKeyword]
  );

  const canRenderIframe = localStatus === 'ready' && !isNative;
  const activeAndroidStreamUrl = customUrl
    ? localResolvedUrl
    : localStatus === 'ready'
      ? localResolvedUrl
      : remoteStreamActive && book.remoteFallbackUrl
        ? book.remoteFallbackUrl
        : null;

  const hasAnyAnnotations =
    annotations.strokes.length > 0 || annotations.notes.length > 0;

  return (
    <div
      ref={paneRef}
      className="relative flex h-full min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#09090b] shadow-2xl"
    >
      {localStatus === 'checking' && !customUrl ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="font-mono text-[11px] text-zinc-400">
            Checking local reference copy for {book.shortLabel}...
          </p>
        </div>
      ) : canRenderIframe ? (
        <iframe
          key={`${book.id}:${localResolvedUrl}:${navNonce}`}
          src={iframeSrc}
          title={book.title}
          className="h-full w-full flex-1 border-0 bg-[#09090b]"
        />
      ) : activeAndroidStreamUrl ? (
        <div className="relative flex h-full w-full flex-1 flex-col">
          {remoteStreamActive && !customUrl && (
            <div className="flex items-center justify-between border-b border-white/10 bg-[#0a0a0e] px-3 py-1.5">
              <span className="font-mono text-[10px] text-sky-300">
                Streaming remote PDF edition...
              </span>
              <button
                type="button"
                onClick={() => setRemoteStreamActive(false)}
                className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 font-mono text-[10px] text-zinc-200 hover:bg-white/20"
              >
                📖 Switch to Offline Chapter Reader
              </button>
            </div>
          )}
          <PdfJsCanvasViewer
            pdfUrl={activeAndroidStreamUrl}
            pageNumber={pageNumber}
            title={book.shortLabel}
            remoteFallbackUrl={book.remoteFallbackUrl}
            onSelectLocalFile={onSelectLocalFile}
          />
        </div>
      ) : (
        <OfflineTextbookChapterReader
          book={book}
          initialQuery={searchKeyword}
          onOpenLocalFile={() => mobilePickerRef.current?.click()}
          onStreamRemotePdf={
            book.remoteFallbackUrl ? () => setRemoteStreamActive(true) : undefined
          }
        />
      )}
      <input
        ref={mobilePickerRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          onSelectLocalFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {/* Interactive Drawing & Highlighting Canvas Overlay (active in Draw / Text / Highlight / Eraser) */}
      <canvas
        ref={inkCanvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        className={cn(
          'absolute inset-0 z-10 h-full w-full',
          tool === 'read'
            ? 'pointer-events-none'
            : tool === 'text'
              ? 'pointer-events-auto cursor-text touch-none'
              : 'pointer-events-auto cursor-crosshair touch-none'
        )}
      />

      {/* Live Write Text (`TT`) Editable Page Notes */}
      {showAnnotations &&
        annotations.notes.map((note) => {
          const isEditing = editingNoteId === note.id;
          return (
            <div
              key={note.id}
              style={{
                left: `${(note.x * 100).toFixed(2)}%`,
                top: `${(note.y * 100).toFixed(2)}%`,
                borderColor: note.color,
              }}
              onPointerDown={(e) => {
                if (tool === 'eraser') {
                  e.stopPropagation();
                  setAnnotations((prev) => ({
                    ...prev,
                    notes: prev.notes.filter((n) => n.id !== note.id),
                  }));
                  return;
                }
                if (tool === 'read') return;
                if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
                e.stopPropagation();
                const rect = paneRef.current?.getBoundingClientRect();
                if (!rect) return;
                draggingNoteRef.current = {
                  id: note.id,
                  offsetX: e.clientX - (rect.left + note.x * rect.width),
                  offsetY: e.clientY - (rect.top + note.y * rect.height),
                };
                const onMove = (ev: PointerEvent) => {
                  const drag = draggingNoteRef.current;
                  const box = paneRef.current?.getBoundingClientRect();
                  if (!drag || !box) return;
                  const nx = Math.max(
                    0.01,
                    Math.min(0.88, (ev.clientX - box.left - drag.offsetX) / box.width)
                  );
                  const ny = Math.max(
                    0.02,
                    Math.min(0.9, (ev.clientY - box.top - drag.offsetY) / box.height)
                  );
                  setAnnotations((prev) => ({
                    ...prev,
                    notes: prev.notes.map((n) =>
                      n.id === drag.id ? { ...n, x: nx, y: ny } : n
                    ),
                  }));
                };
                const onUp = () => {
                  draggingNoteRef.current = null;
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onUp);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
              }}
              className={cn(
                'absolute z-20 min-w-[140px] max-w-[240px] rounded-lg border-l-4 bg-zinc-950/88 px-2 py-1.5 shadow-xl backdrop-blur-md transition-shadow',
                tool === 'read' ? 'pointer-events-none' : 'pointer-events-auto cursor-move'
              )}
            >
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span
                  className="font-mono text-[8.5px] font-semibold uppercase tracking-wider"
                  style={{ color: note.color }}
                >
                  Note • p.{pageNumber}
                </span>
                {tool !== 'read' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAnnotations((prev) => ({
                        ...prev,
                        notes: prev.notes.filter((n) => n.id !== note.id),
                      }));
                    }}
                    aria-label="Delete text note"
                    className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              {isEditing ? (
                <textarea
                  autoFocus
                  dir="auto"
                  rows={2}
                  value={note.text}
                  placeholder="Write note..."
                  onChange={(e) => {
                    const val = e.target.value;
                    setAnnotations((prev) => ({
                      ...prev,
                      notes: prev.notes.map((n) =>
                        n.id === note.id ? { ...n, text: val } : n
                      ),
                    }));
                  }}
                  onBlur={() => {
                    setEditingNoteId(null);
                    setAnnotations((prev) => ({
                      ...prev,
                      notes: prev.notes.filter((n) => n.text.trim().length > 0),
                    }));
                  }}
                  className="w-full resize bg-transparent text-xs font-medium text-white placeholder-zinc-500 outline-none"
                />
              ) : (
                <div
                  dir="auto"
                  onDoubleClick={() => setEditingNoteId(note.id)}
                  onClick={() => tool === 'text' && setEditingNoteId(note.id)}
                  className="whitespace-pre-wrap break-words text-xs font-medium leading-snug text-white"
                >
                  {note.text || 'Tap to write...'}
                </div>
              )}
            </div>
          );
        })}

      {/* Floating Compact Bottom-Right Write & Annotate Toolbar (zero top bar clutter) */}
      <div
        aria-label={`${book.shortLabel} Writing & Annotation Tools`}
        className="pointer-events-auto absolute bottom-2.5 right-2.5 z-30 flex max-w-[calc(100%-1.25rem)] flex-wrap items-center gap-1 rounded-full border border-white/15 bg-zinc-950/90 px-2 py-1 shadow-2xl backdrop-blur-md"
      >
        <button
          type="button"
          onClick={() => onJumpPage(Math.max(1, pageNumber - 1))}
          disabled={pageNumber <= 1}
          title="Previous PDF page"
          className="rounded-full p-1 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-35"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="font-mono text-[10px] tabular-nums text-zinc-300">
          p.{pageNumber}
        </span>
        <button
          type="button"
          onClick={() =>
            onJumpPage(
              book.pageCount
                ? Math.min(book.pageCount, pageNumber + 1)
                : pageNumber + 1
            )
          }
          title="Next PDF page"
          className="rounded-full p-1 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <div className="mx-0.5 h-4 w-px bg-white/15" aria-hidden="true" />

        <button
          type="button"
          onClick={() => setTool('read')}
          aria-pressed={tool === 'read'}
          title="Read & Scroll PDF"
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium transition-all',
            tool === 'read'
              ? 'border-sky-400/50 bg-sky-500/20 text-sky-300'
              : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
          )}
        >
          <BookOpen className="h-3 w-3" />
          <span className="hidden sm:inline">Read</span>
        </button>

        <button
          type="button"
          onClick={() => setTool((t) => (t === 'pen' ? 'read' : 'pen'))}
          aria-pressed={tool === 'pen'}
          title="Draw Freehand Pen on PDF"
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium transition-all',
            tool === 'pen'
              ? 'border-rose-400/60 bg-rose-500/20 text-rose-200'
              : 'border-transparent text-zinc-300 hover:bg-white/5 hover:text-white'
          )}
        >
          <Pencil className="h-3 w-3" />
          <span>Draw</span>
        </button>

        <button
          type="button"
          onClick={() => setTool((t) => (t === 'text' ? 'read' : 'text'))}
          aria-pressed={tool === 'text'}
          title="Write Text Notes Anywhere on PDF (TT)"
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold transition-all',
            tool === 'text'
              ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
              : 'border-transparent text-zinc-300 hover:bg-white/5 hover:text-white'
          )}
        >
          <Type className="h-3 w-3" />
          <span>Write TT</span>
        </button>

        <button
          type="button"
          onClick={() => setTool((t) => (t === 'highlight' ? 'read' : 'highlight'))}
          aria-pressed={tool === 'highlight'}
          title="Highlight on PDF"
          className={cn(
            'rounded-full border p-1 transition-all',
            tool === 'highlight'
              ? 'border-yellow-400/60 bg-yellow-500/20 text-yellow-200'
              : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-white'
          )}
        >
          <Highlighter className="h-3 w-3" />
        </button>

        <button
          type="button"
          onClick={() => setTool((t) => (t === 'eraser' ? 'read' : 'eraser'))}
          aria-pressed={tool === 'eraser'}
          title="Erase Ink or Text Notes"
          className={cn(
            'rounded-full border p-1 transition-all',
            tool === 'eraser'
              ? 'border-white/40 bg-white/15 text-white'
              : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-white'
          )}
        >
          <Eraser className="h-3 w-3" />
        </button>

        <div className="mx-0.5 flex items-center gap-1">
          {INK_PALETTE.map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              onClick={() => setInkHex(swatch.hex)}
              title={swatch.label}
              className={cn(
                'h-3 w-3 rounded-full border transition-transform',
                inkHex === swatch.hex
                  ? 'scale-125 border-white ring-1 ring-white/40'
                  : 'border-white/30 opacity-80 hover:opacity-100'
              )}
              style={{ backgroundColor: swatch.hex }}
            />
          ))}
        </div>

        {hasAnyAnnotations && (
          <>
            <div className="mx-0.5 h-4 w-px bg-white/15" aria-hidden="true" />
            <button
              type="button"
              onClick={handleUndo}
              title="Undo Last Mark"
              className="rounded-full p-1 text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <Undo2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setShowAnnotations((v) => !v)}
              title={showAnnotations ? 'Hide Annotations' : 'Show Annotations'}
              className="rounded-full p-1 text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              {showAnnotations ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setAnnotations({ strokes: [], notes: [] })}
              title="Clear All Page Annotations"
              className="rounded-full p-1 text-zinc-400 hover:bg-rose-500/20 hover:text-rose-200"
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={handleExportNotes}
              title="Export Page Notes (.json)"
              className="rounded-full p-1 text-emerald-300 hover:bg-emerald-500/20"
            >
              <Download className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export const PdfReferenceBooksView: React.FC = () => {
  const rootRef = useRef<HTMLElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const pdfReferenceTarget = useAppNavigationStore(
    (s) => s.pdfReferenceTarget
  );
  const clearPdfReference = useAppNavigationStore((s) => s.clearPdfReference);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const medicalProfile = useAnatomyStore((s) => s.medicalProfile);

  const books = usePdfSessionStore((s) => s.books);
  const viewMode = usePdfSessionStore((s) => s.viewMode);
  const book1Page = usePdfSessionStore((s) => s.book1Page);
  const book2Page = usePdfSessionStore((s) => s.book2Page);
  const book1Nonce = usePdfSessionStore((s) => s.book1Nonce);
  const book2Nonce = usePdfSessionStore((s) => s.book2Nonce);
  const searchKeyword = usePdfSessionStore((s) => s.searchKeyword);
  const dismissedStructureKey = usePdfSessionStore(
    (s) => s.dismissedStructureKey
  );
  const customOverrides = usePdfSessionStore((s) => s.customOverrides);
  const ensureManifestLoaded = usePdfSessionStore((s) => s.ensureManifestLoaded);
  const setViewMode = usePdfSessionStore((s) => s.setViewMode);
  const jumpBook1 = usePdfSessionStore((s) => s.jumpBook1);
  const jumpBook2 = usePdfSessionStore((s) => s.jumpBook2);
  const jumpActiveBook = usePdfSessionStore((s) => s.jumpActiveBook);
  const loadLocalPdf = usePdfSessionStore((s) => s.loadLocalPdf);
  const dismissStructureBadge = usePdfSessionStore(
    (s) => s.dismissStructureBadge
  );
  const syncFromReferenceTarget = usePdfSessionStore(
    (s) => s.syncFromReferenceTarget
  );

  const [pdfPageInput, setPdfPageInput] = useState(String(book1Page));

  useEffect(() => {
    setPdfPageInput(String(viewMode === 'book2' ? book2Page : book1Page));
  }, [viewMode, book1Page, book2Page]);

  useEffect(() => {
    ensureManifestLoaded();
  }, [ensureManifestLoaded]);

  useEffect(() => {
    syncFromReferenceTarget(pdfReferenceTarget);
  }, [pdfReferenceTarget, syncFromReferenceTarget]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const book1 = useMemo(
    () =>
      books.find((b) => b.id === 'book1' || b.role === 'atlas') ??
      DEFAULT_PDF_BOOKS[0],
    [books]
  );
  const book2 = useMemo(
    () =>
      books.find((b) => b.id === 'book2' || b.role === 'textbook') ??
      DEFAULT_PDF_BOOKS[1],
    [books]
  );

  const focusedPdfLabel =
    pdfReferenceTarget?.query ||
    selectedPart?.cleanName ||
    medicalProfile?.cleanNameEn ||
    '';
  const focusedPdfPage =
    pdfReferenceTarget?.book2Page ??
    pdfReferenceTarget?.book1Page ??
    (pdfReferenceTarget?.book1Plate
      ? (book1.plateToPage?.[String(pdfReferenceTarget.book1Plate)] ??
        pdfReferenceTarget.book1Plate + (book1.plateOffsetEstimate ?? 36))
      : undefined);
  const focusedBadgeKey = `${focusedPdfLabel}:${focusedPdfPage ?? ''}:${pdfReferenceTarget?.trigger ?? ''}`;
  const showFocusedPdfBadge =
    Boolean(focusedPdfLabel) && dismissedStructureKey !== focusedBadgeKey;

  const handlePdfPageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseInt(pdfPageInput, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      jumpActiveBook(parsed);
    }
  };

  return (
    <section
      ref={rootRef}
      aria-label="Reference Anatomy Textbooks Library"
      className={cn(
        'fixed inset-0 z-20 flex h-dvh w-dvw flex-col bg-black',
        isFullscreen ? 'p-1.5' : 'px-1.5 pb-1 pt-[48px] md:pt-[54px]'
      )}
    >
      {/* Dedicated Books Sub-Toolbar (kept cleanly inside Reference Books view) */}
      {!isFullscreen && (
        <div className="mb-1.5 flex w-full items-center justify-between gap-2 overflow-x-auto flex-nowrap whitespace-nowrap touch-pan-x no-scrollbar rounded-xl border border-white/10 bg-[#0a0a0c]/95 px-2 py-1.5 shadow-lg backdrop-blur-md">
          <div className="flex shrink-0 items-center gap-1.5">
            <div
              role="group"
              aria-label="Reference Book Layout Selector"
              className="flex h-7 md:h-8 shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-black/50 p-0.5"
            >
              <button
                type="button"
                onClick={() => setViewMode('book1')}
                aria-pressed={viewMode === 'book1'}
                className={cn(
                  'whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] md:text-[10.5px] font-medium transition-all active:scale-95',
                  viewMode === 'book1'
                    ? 'border-sky-500/40 bg-sky-500/15 text-sky-400'
                    : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                )}
              >
                <span>📘</span>
                <span> Book 1</span>
                <span className="hidden lg:inline">: Atlas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('book2')}
                aria-pressed={viewMode === 'book2'}
                className={cn(
                  'whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] md:text-[10.5px] font-medium transition-all active:scale-95',
                  viewMode === 'book2'
                    ? 'border-sky-500/40 bg-sky-500/15 text-sky-400'
                    : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                )}
              >
                <span>📗</span>
                <span> Book 2</span>
                <span className="hidden lg:inline">: Text</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                aria-pressed={viewMode === 'split'}
                className={cn(
                  'whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] md:text-[10.5px] font-medium transition-all active:scale-95',
                  viewMode === 'split'
                    ? 'border-sky-500/40 bg-sky-500/15 text-sky-400'
                    : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                )}
              >
                <span>⚖️</span>
                <span> Split View</span>
              </button>
            </div>

            {showFocusedPdfBadge && (
              <div className="flex h-7 md:h-8 min-w-0 max-w-[200px] items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 text-[10.5px] font-medium text-emerald-300">
                <span aria-hidden="true" className="shrink-0">
                  📍
                </span>
                <span className="truncate text-white">
                  {focusedPdfLabel}
                  {focusedPdfPage ? ` (p.${focusedPdfPage})` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearPdfReference();
                    dismissStructureBadge(focusedBadgeKey);
                  }}
                  aria-label="Clear focused organ pill"
                  className="ml-0.5 shrink-0 rounded-full p-0.5 text-emerald-300/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <form
              onSubmit={handlePdfPageSubmit}
              className="flex h-7 md:h-8 shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2"
            >
              <label
                htmlFor="books-subbar-page-jump"
                className="font-mono text-[10px] uppercase tracking-wider text-zinc-400"
              >
                Pg
              </label>
              <input
                id="books-subbar-page-jump"
                type="number"
                min={1}
                value={pdfPageInput}
                onChange={(e) => setPdfPageInput(e.target.value)}
                aria-label="Quick Page Jump"
                className="w-10 bg-transparent text-center font-mono text-[10.5px] tabular-nums text-white outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9.5px] font-medium text-zinc-200 transition-colors hover:bg-sky-500/20 hover:text-sky-300"
              >
                Go
              </button>
            </form>

            <select
              aria-label="Jump to PDF chapter"
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const [slot, pageStr] = val.split(':');
                const pageNum = Number.parseInt(pageStr, 10);
                if (!Number.isFinite(pageNum) || pageNum < 1) return;
                if (slot === 'book2') {
                  jumpBook2(pageNum);
                } else {
                  jumpBook1(pageNum);
                }
              }}
              className="h-7 md:h-8 max-w-[140px] sm:max-w-[190px] rounded-full border border-white/10 bg-black/50 px-2.5 font-mono text-[10px] text-zinc-300 outline-none transition-colors hover:border-white/25 focus:border-sky-500/50"
            >
              <option value="" disabled>
                Chapters...
              </option>
              {(viewMode === 'book1' || viewMode === 'split') &&
                book1.chapters &&
                book1.chapters.length > 0 && (
                  <optgroup label="Book 1: Atlas">
                    {book1.chapters.map((ch) => (
                      <option
                        key={`b1-${ch.title}-${ch.page}`}
                        value={`book1:${ch.page}`}
                      >
                        {ch.title} (p.{ch.page})
                      </option>
                    ))}
                  </optgroup>
                )}
              {(viewMode === 'book2' || viewMode === 'split') &&
                book2.chapters &&
                book2.chapters.length > 0 && (
                  <optgroup label="Book 2: Text">
                    {book2.chapters.map((ch) => (
                      <option
                        key={`b2-${ch.title}-${ch.page}`}
                        value={`book2:${ch.page}`}
                      >
                        {ch.title} (p.{ch.page})
                      </option>
                    ))}
                  </optgroup>
                )}
            </select>

            <input
              ref={pdfFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const slot = viewMode === 'book2' ? 'book2' : 'book1';
                loadLocalPdf(slot, e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => pdfFileInputRef.current?.click()}
              title="Open a local .pdf file into active reader pane"
              className="flex h-7 md:h-8 shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2.5 font-mono text-[10px] font-medium text-zinc-200 transition-all hover:border-sky-500/40 hover:bg-sky-500/15 hover:text-sky-300 active:scale-95"
            >
              <span aria-hidden="true">📂</span>
              <span>Open PDF</span>
            </button>
          </div>
        </div>
      )}
      <div
        className={cn(
          'grid h-full min-h-0 flex-1 gap-2',
          viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        )}
      >
        {(viewMode === 'book1' || viewMode === 'split') && (
          <PdfFramePane
            book={book1}
            customUrl={customOverrides.book1?.url}
            pageNumber={book1Page}
            navNonce={book1Nonce}
            searchKeyword={searchKeyword}
            onJumpPage={jumpBook1}
            onSelectLocalFile={(file) => loadLocalPdf('book1', file)}
          />
        )}

        {(viewMode === 'book2' || viewMode === 'split') && (
          <PdfFramePane
            book={book2}
            customUrl={customOverrides.book2?.url}
            pageNumber={book2Page}
            navNonce={book2Nonce}
            searchKeyword={searchKeyword}
            onJumpPage={jumpBook2}
            onSelectLocalFile={(file) => loadLocalPdf('book2', file)}
          />
        )}
      </div>
    </section>
  );
};
