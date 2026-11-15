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
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppNavigationStore } from '../../store/useAnatomyStore';
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
  const [localStatus, setLocalStatus] = useState<'checking' | 'ready' | 'missing'>(
    () => (customUrl ? 'ready' : isNative ? 'checking' : 'ready')
  );
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);

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

  useEffect(() => {
    if (customUrl) {
      setLocalStatus('ready');
      return;
    }
    let cancelled = false;
    fetch(localResolvedUrl, { method: 'HEAD' })
      .then((res) => {
        if (!cancelled) {
          setLocalStatus(res.ok ? 'ready' : 'missing');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocalStatus(isNative ? 'missing' : 'ready');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [customUrl, localResolvedUrl, isNative]);

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
      {canRenderIframe ? (
        <iframe
          key={`${book.id}:${localResolvedUrl}:${navNonce}`}
          src={iframeSrc}
          title={book.title}
          className="h-full w-full flex-1 border-0 bg-[#09090b]"
        />
      ) : activeAndroidStreamUrl ? (
        <PdfJsCanvasViewer
          pdfUrl={activeAndroidStreamUrl}
          pageNumber={pageNumber}
          title={book.shortLabel}
          remoteFallbackUrl={book.remoteFallbackUrl}
          onSelectLocalFile={onSelectLocalFile}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-sky-400">
            {book.title}
          </p>
          <h3 className="max-w-sm text-sm font-semibold text-white">
            {book.sourceTitle} (Page {pageNumber})
          </h3>
          <p className="max-w-xs text-xs text-zinc-400">
            Books are kept out of the lightweight mobile APK to keep your download small. Stream online or open your local copy.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            {book.remoteFallbackUrl && (
              <button
                type="button"
                onClick={() => setRemoteStreamActive(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/50 bg-sky-500/20 px-3.5 py-2 font-mono text-[11px] font-semibold text-sky-200 transition-colors hover:bg-sky-500/30"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Read Online (Page {pageNumber})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => mobilePickerRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 font-mono text-[11px] font-medium text-white transition-colors hover:bg-white/20"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Open Device .PDF</span>
            </button>
          </div>
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
        </div>
      )}

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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const pdfReferenceTarget = useAppNavigationStore(
    (s) => s.pdfReferenceTarget
  );
  const books = usePdfSessionStore((s) => s.books);
  const viewMode = usePdfSessionStore((s) => s.viewMode);
  const book1Page = usePdfSessionStore((s) => s.book1Page);
  const book2Page = usePdfSessionStore((s) => s.book2Page);
  const book1Nonce = usePdfSessionStore((s) => s.book1Nonce);
  const book2Nonce = usePdfSessionStore((s) => s.book2Nonce);
  const searchKeyword = usePdfSessionStore((s) => s.searchKeyword);
  const customOverrides = usePdfSessionStore((s) => s.customOverrides);
  const ensureManifestLoaded = usePdfSessionStore((s) => s.ensureManifestLoaded);
  const jumpBook1 = usePdfSessionStore((s) => s.jumpBook1);
  const jumpBook2 = usePdfSessionStore((s) => s.jumpBook2);
  const loadLocalPdf = usePdfSessionStore((s) => s.loadLocalPdf);
  const syncFromReferenceTarget = usePdfSessionStore(
    (s) => s.syncFromReferenceTarget
  );

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

  return (
    <section
      ref={rootRef}
      aria-label="Reference Anatomy Textbooks Library"
      className={cn(
        'fixed inset-0 z-20 flex h-dvh w-dvw flex-col bg-black',
        isFullscreen ? 'p-1.5' : 'px-1.5 pb-1 pt-[46px] md:pt-[52px]'
      )}
    >
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
