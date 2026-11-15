import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FolderOpen,
  Highlighter,
  Maximize2,
  MessageSquarePlus,
  Pencil,
  Trash2,
  Type,
  Underline,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { PdfBookManifestEntry } from '../../../store/usePdfSessionStore';
import { resolveAssetUrl } from '../../../utils/assetUrl';
import { PdfBookPage } from './PdfBookPage';
import { loadCachedPdfDocument } from './pdfDocumentCache';
import {
  clearBookPageAnnotations,
  EMPTY_PAGE_ANNOTATIONS,
  loadPdfPageAnnotations,
  PDF_ANNOTATION_PALETTE,
  savePdfPageAnnotations,
  type NormalizedRect,
  type PdfPageAnnotations,
  type PdfReaderTool,
  type PdfTextHighlight,
} from './pdfAnnotations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDocumentProxyLike = any;

export interface PdfBookPaneProps {
  book: PdfBookManifestEntry;
  customUrl?: string;
  pageNumber: number;
  navNonce: number;
  searchKeyword: string;
  isPaneVisible?: boolean;
  onJumpPage: (page: number) => void;
  onSelectLocalFile: (file: File | null | undefined) => void;
  fallbackReader?: React.ReactNode;
}

interface PendingSelectionPopup {
  pageNum: number;
  quote: string;
  rects: NormalizedRect[];
  clientX: number;
  clientY: number;
}

interface ActiveHighlightPopup {
  pageNum: number;
  highlight: PdfTextHighlight;
  clientX: number;
  clientY: number;
}

function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export const PdfBookPane: React.FC<PdfBookPaneProps> = ({
  book,
  customUrl,
  pageNumber,
  navNonce,
  searchKeyword,
  isPaneVisible = true,
  onJumpPage,
  onSelectLocalFile,
  fallbackReader,
}) => {
  const isNative = useMemo(() => isCapacitorNative(), []);
  const resolvedUrl = resolveAssetUrl(customUrl ?? book.url);

  const [pdfjsMod, setPdfjsMod] = useState<typeof import('pdfjs-dist') | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfDocumentProxyLike>(null);
  const [numPages, setNumPages] = useState<number>(book.pageCount || 1);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showEmergencyFallback, setShowEmergencyFallback] = useState<boolean>(false);

  const [visiblePage, setVisiblePage] = useState<number>(Math.max(1, pageNumber));
  const [zoom, setZoom] = useState<number>(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(620);
  const [defaultAspect, setDefaultAspect] = useState<number>(1.3);
  const [pageAspects, setPageAspects] = useState<Record<number, number>>({});

  const [tool, setTool] = useState<PdfReaderTool>('read');
  const [inkHex, setInkHex] = useState<string>(PDF_ANNOTATION_PALETTE[0].hex);
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [annotationsTick, setAnnotationsTick] = useState<number>(0);

  const [selectionPopup, setSelectionPopup] = useState<PendingSelectionPopup | null>(null);
  const [highlightPopup, setHighlightPopup] = useState<ActiveHighlightPopup | null>(null);
  const [copiedJustNow, setCopiedJustNow] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const filePickerRef = useRef<HTMLInputElement | null>(null);
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const annotationsMapRef = useRef<Map<string, PdfPageAnnotations>>(new Map());

  const prevNavNonceRef = useRef<number>(navNonce);
  const suppressNextJumpRef = useRef<number | null>(null);
  const initialScrollDoneForUrlRef = useRef<string>('');
  const visiblePageRef = useRef<number>(visiblePage);
  visiblePageRef.current = visiblePage;
  const onJumpPageRef = useRef(onJumpPage);
  onJumpPageRef.current = onJumpPage;

  // Load PDF document via shared LRU cache so tab & split switches never re-download 120–198 MB
  useEffect(() => {
    let cancelled = false;

    setLoadStatus('loading');
    setLoadProgress(null);
    setErrorMsg('');
    setShowEmergencyFallback(false);
    setSelectionPopup(null);
    setHighlightPopup(null);

    void loadCachedPdfDocument({
      url: resolvedUrl,
      isNative,
      fallbackSizeBytes: book.sizeBytes || 0,
      fallbackPageCount: book.pageCount || 1,
      onProgress: (pct) => {
        if (!cancelled) setLoadProgress(pct);
      },
    })
      .then((entry) => {
        if (cancelled) return;
        setPdfjsMod(entry.pdfjs);
        setDefaultAspect(entry.defaultAspect);
        setPdfDoc(entry.doc);
        setNumPages(entry.numPages);
        setLoadStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setPdfDoc(null);
        setLoadStatus('error');
        setErrorMsg(
          err instanceof Error ? err.message : `Unable to open PDF (${book.shortLabel})`
        );
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedUrl, isNative, book.pageCount, book.shortLabel, book.sizeBytes]);

  // Measure scroll container width responsively so Fit Width adapts on PC split & mobile
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !isPaneVisible) return;

    const updateWidth = () => {
      if (el.clientWidth <= 0) return;
      const next = Math.max(260, el.clientWidth - 20);
      setContainerWidth((prev) => (Math.abs(prev - next) > 4 ? next : prev));
    };
    updateWidth();

    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPaneVisible]);

  const targetPageWidth = Math.max(220, Math.round(containerWidth * zoom));
  const prefixTops = useMemo(() => {
    const count = Math.max(1, numPages || 1);
    const tops = new Float64Array(count + 1);
    const estW = Math.max(220, Math.round(targetPageWidth));
    for (let i = 1; i <= count; i++) {
      const ratio = pageAspects[i] ?? defaultAspect;
      const pageH = Math.max(260, Math.round(estW * ratio));
      tops[i] = tops[i - 1] + pageH + 16;
    }
    return tops;
  }, [numPages, pageAspects, targetPageWidth, defaultAspect]);
  const prefixTopsRef = useRef<Float64Array>(prefixTops);
  prefixTopsRef.current = prefixTops;

  const getAnnotations = useCallback(
    (p: number): PdfPageAnnotations => {
      const key = `${book.id}:${p}`;
      const cached = annotationsMapRef.current.get(key);
      if (cached) return cached;
      const loaded = loadPdfPageAnnotations(book.id, p);
      annotationsMapRef.current.set(key, loaded);
      return loaded;
    },
    [book.id]
  );

  const handleUpdateAnnotations = useCallback(
    (p: number, updater: (prev: PdfPageAnnotations) => PdfPageAnnotations) => {
      const key = `${book.id}:${p}`;
      const current = getAnnotations(p);
      const next = updater(current);
      annotationsMapRef.current.set(key, next);
      savePdfPageAnnotations(book.id, p, next);
      setAnnotationsTick((t) => t + 1);
    },
    [book.id, getAnnotations]
  );

  const registerPageElement = useCallback(
    (p: number, el: HTMLDivElement | null) => {
      if (el) pageElementsRef.current.set(p, el);
      else pageElementsRef.current.delete(p);
    },
    []
  );

  const handleMeasurePage = useCallback((p: number, ratio: number) => {
    setPageAspects((prev) => {
      const existing = prev[p];
      if (existing && Math.abs(existing - ratio) < 0.004) return prev;
      return { ...prev, [p]: ratio };
    });
  }, []);

  const scrollToPageNumber = useCallback(
    (targetPage: number) => {
      const count = Math.max(1, numPages || 1);
      const clamped = Math.max(1, Math.min(count, Math.floor(targetPage || 1)));
      const container = scrollContainerRef.current;
      if (container) {
        const targetTop = prefixTopsRef.current[clamped - 1] ?? 0;
        container.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'auto',
        });
      }
      visiblePageRef.current = clamped;
      setVisiblePage(clamped);
    },
    [numPages]
  );

  // Sync external store pageNumber jumps (Top bar Go, Chapters, Next/Prev, 3D Atlas click)
  useEffect(() => {
    if (loadStatus !== 'ready' || !pdfDoc || !isPaneVisible) return;

    const urlChanged = initialScrollDoneForUrlRef.current !== resolvedUrl;
    const nonceBumped = navNonce !== prevNavNonceRef.current;
    prevNavNonceRef.current = navNonce;

    if (!urlChanged && !nonceBumped && suppressNextJumpRef.current === pageNumber) {
      suppressNextJumpRef.current = null;
      return;
    }

    suppressNextJumpRef.current = null;
    initialScrollDoneForUrlRef.current = resolvedUrl;
    const clamped = Math.max(1, Math.min(numPages || 1, Math.floor(pageNumber || 1)));
    const rafId = window.requestAnimationFrame(() => scrollToPageNumber(clamped));
    return () => window.cancelAnimationFrame(rafId);
  }, [loadStatus, pdfDoc, resolvedUrl, pageNumber, navNonce, numPages, isPaneVisible, scrollToPageNumber]);

  // Update visiblePage passively when the user scrolls manually via O(log N) prefix search
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || loadStatus !== 'ready' || !isPaneVisible) return;

    let rafPending = false;
    const detectVisiblePage = () => {
      rafPending = false;
      const tops = prefixTopsRef.current;
      const count = Math.max(1, tops.length - 1);
      const midY = Math.max(0, container.scrollTop - 8 + container.clientHeight * 0.42);

      let lo = 0;
      let hi = count - 1;
      let bestIdx = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (tops[mid] <= midY) {
          bestIdx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      const bestPage = Math.max(1, Math.min(count, bestIdx + 1));

      if (bestPage !== visiblePageRef.current) {
        visiblePageRef.current = bestPage;
        setVisiblePage(bestPage);
        suppressNextJumpRef.current = bestPage;
        onJumpPageRef.current(bestPage);
      }
    };

    const handleScroll = () => {
      setSelectionPopup(null);
      setHighlightPopup(null);
      if (rafPending) return;
      rafPending = true;
      window.requestAnimationFrame(detectVisiblePage);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loadStatus, isPaneVisible]);

  const handleTextSelected = useCallback((sel: PendingSelectionPopup) => {
    setHighlightPopup(null);
    setSelectionPopup(sel);
  }, []);

  const handleClickHighlight = useCallback((hl: ActiveHighlightPopup) => {
    setSelectionPopup(null);
    setHighlightPopup(hl);
  }, []);

  const currentPageAnn = useMemo(() => {
    void annotationsTick;
    return getAnnotations(visiblePage);
  }, [annotationsTick, getAnnotations, visiblePage]);

  const hasCurrentPageAnns =
    currentPageAnn.highlights.length > 0 ||
    currentPageAnn.strokes.length > 0 ||
    currentPageAnn.notes.length > 0;

  const handleSaveSelectionMark = (
    kind: 'highlight' | 'underline',
    color: string
  ) => {
    if (!selectionPopup) return;
    const item: PdfTextHighlight = {
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      color,
      rects: selectionPopup.rects,
      quote: selectionPopup.quote,
    };
    handleUpdateAnnotations(selectionPopup.pageNum, (prev) => ({
      ...prev,
      highlights: [...prev.highlights, item],
    }));
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  };

  const handleCreateNoteFromSelection = () => {
    if (!selectionPopup) return;
    const first = selectionPopup.rects[0];
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    handleUpdateAnnotations(selectionPopup.pageNum, (prev) => ({
      ...prev,
      highlights: [
        ...prev.highlights,
        {
          id: `hl-${Date.now()}`,
          kind: 'highlight',
          color: inkHex,
          rects: selectionPopup.rects,
          quote: selectionPopup.quote,
        },
      ],
      notes: [
        ...prev.notes,
        {
          id,
          x: Math.min(0.88, Math.max(0.12, first ? first.x + first.w : 0.5)),
          y: Math.min(0.9, Math.max(0.08, first ? first.y : 0.5)),
          color: inkHex,
          text: '',
          quote: selectionPopup.quote,
        },
      ],
    }));
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
    setEditingNoteId(id);
  };

  const handleCopySelection = () => {
    if (!selectionPopup) return;
    void navigator.clipboard?.writeText?.(selectionPopup.quote);
    setCopiedJustNow(true);
    window.setTimeout(() => {
      setCopiedJustNow(false);
      setSelectionPopup(null);
    }, 650);
  };

  const handleUndoPage = () => {
    handleUpdateAnnotations(visiblePage, (prev) => {
      if (prev.strokes.length > 0) {
        return { ...prev, strokes: prev.strokes.slice(0, -1) };
      }
      if (prev.highlights.length > 0) {
        return { ...prev, highlights: prev.highlights.slice(0, -1) };
      }
      if (prev.notes.length > 0) {
        return { ...prev, notes: prev.notes.slice(0, -1) };
      }
      return prev;
    });
  };

  const handleExportPageNotes = () => {
    const payload = {
      bookId: book.id,
      bookTitle: book.title,
      pageNumber: visiblePage,
      exportedAt: new Date().toISOString(),
      annotations: currentPageAnn,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${book.id}-p${visiblePage}-notes.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  if (showEmergencyFallback && fallbackReader) {
    return (
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#09090b]">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#0b0d13] px-3 py-1.5">
          <span className="font-mono text-[10px] text-zinc-300">
            {book.shortLabel} — Offline Chapter Fallback
          </span>
          <button
            type="button"
            onClick={() => setShowEmergencyFallback(false)}
            className="rounded-full border border-sky-400/40 bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/35"
          >
            Back to PDF Reader
          </button>
        </div>
        {fallbackReader}
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#09090b] shadow-2xl">
      {/* Compact Non-Locking Book Sub-Header: Page Turn + Zoom work in ANY tool */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0c0e14]/95 px-2.5 py-1.5 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <span className="truncate font-mono text-[11px] font-semibold text-zinc-100">
            {book.shortLabel}
          </span>
          {book.id !== 'book1' && (
            <span className="hidden truncate font-mono text-[10px] text-zinc-500 md:inline">
              ({numPages} pp)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Page Stepper (Always Interactive) */}
          <div className="flex items-center rounded-full border border-white/10 bg-black/50 p-0.5">
            <button
              type="button"
              onClick={() => {
                const target = Math.max(1, visiblePage - 1);
                onJumpPage(target);
                scrollToPageNumber(target);
              }}
              disabled={visiblePage <= 1}
              aria-label="Previous page"
              className="rounded-full p-1 text-zinc-300 hover:bg-white/10 disabled:opacity-35"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-mono text-[10px] font-semibold text-zinc-200">
              {visiblePage} / {numPages}
            </span>
            <button
              type="button"
              onClick={() => {
                const target = Math.min(numPages, visiblePage + 1);
                onJumpPage(target);
                scrollToPageNumber(target);
              }}
              disabled={visiblePage >= numPages}
              aria-label="Next page"
              className="rounded-full p-1 text-zinc-300 hover:bg-white/10 disabled:opacity-35"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center rounded-full border border-white/10 bg-black/50 p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
              aria-label="Zoom out"
              className="rounded-full p-1 text-zinc-300 hover:bg-white/10"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1.0)}
              title="Reset to Fit Width"
              className="px-1.5 font-mono text-[10px] font-medium text-zinc-300 hover:text-white"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))}
              aria-label="Zoom in"
              className="rounded-full p-1 text-zinc-300 hover:bg-white/10"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1.0)}
              title="Fit page width"
              className="hidden rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Continuous Scrollable Page Viewport */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-auto overscroll-contain bg-[#11131a] px-2 pb-20 pt-2"
        onClick={() => {
          setHighlightPopup(null);
        }}
      >
        {loadStatus === 'loading' ? (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-2.5 p-6 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
            <p className="font-mono text-[11px] text-zinc-300">
              Loading {book.shortLabel}
              {loadProgress !== null ? ` (${loadProgress}%)` : '...'}
            </p>
          </div>
        ) : loadStatus === 'error' ? (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="max-w-sm font-sans text-xs text-rose-300">
              {errorMsg || `Could not open PDF (${book.shortLabel}).`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => filePickerRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/20 px-3 py-1.5 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/35"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Open Local PDF
              </button>
              {fallbackReader && (
                <button
                  type="button"
                  onClick={() => setShowEmergencyFallback(true)}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/20"
                >
                  Open Offline Chapter Reader
                </button>
              )}
            </div>
          </div>
        ) : (
          (() => {
            const totalPages = Math.max(1, numPages || 1);
            const clampedVisible = Math.max(1, Math.min(totalPages, visiblePage));
            const overscan = 3;
            const startPage = Math.max(1, clampedVisible - overscan);
            const endPage = Math.min(totalPages, clampedVisible + overscan);
            const topSpacerPx = prefixTops[startPage - 1] ?? 0;
            const bottomSpacerPx = Math.max(
              0,
              (prefixTops[totalPages] ?? 0) - (prefixTops[endPage] ?? 0)
            );
            void annotationsTick;

            return (
              <div className="flex min-w-full flex-col items-center">
                {topSpacerPx > 0 && (
                  <div
                    style={{ height: `${topSpacerPx}px` }}
                    className="w-px shrink-0"
                    aria-hidden="true"
                  />
                )}
                {Array.from({ length: endPage - startPage + 1 }, (_, idx) => {
                  const p = startPage + idx;
                  const isNearVisible = Math.abs(p - clampedVisible) <= 1;
                  const pageAnn = isNearVisible
                    ? getAnnotations(p)
                    : EMPTY_PAGE_ANNOTATIONS;

                  return (
                    <PdfBookPage
                      key={p}
                      bookId={book.id}
                      pageNum={p}
                      pdfDoc={pdfDoc}
                      pdfjsMod={pdfjsMod!}
                      renderActive={isNearVisible}
                      targetWidth={targetPageWidth}
                      aspectRatio={pageAspects[p] ?? defaultAspect}
                      isNativeMobile={isNative}
                      searchKeyword={searchKeyword}
                      tool={tool}
                      inkHex={inkHex}
                      showAnnotations={showAnnotations}
                      annotations={pageAnn}
                      editingNoteId={editingNoteId}
                      pageRefCallback={registerPageElement}
                      onMeasurePage={handleMeasurePage}
                      onUpdateAnnotations={handleUpdateAnnotations}
                      onTextSelected={handleTextSelected}
                      onClickHighlight={handleClickHighlight}
                      onEditNote={setEditingNoteId}
                    />
                  );
                })}
                {bottomSpacerPx > 0 && (
                  <div
                    style={{ height: `${bottomSpacerPx}px` }}
                    className="w-px shrink-0"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })()
        )}
      </div>

      {/* Floating Selection Bar when User Highlights Book Words (Read Mode) */}
      {selectionPopup && (
        <div
          style={{
            left: `${Math.max(12, Math.min(window.innerWidth - 270, selectionPopup.clientX - 110))}px`,
            top: `${Math.max(64, Math.min(window.innerHeight - 115, selectionPopup.clientY - 52))}px`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed z-50 flex items-center gap-1.5 rounded-full border border-white/20 bg-[#0b0e16]/95 px-2.5 py-1.5 shadow-2xl backdrop-blur-xl"
        >
          {PDF_ANNOTATION_PALETTE.map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              title={`Highlight (${swatch.label})`}
              onClick={() => handleSaveSelectionMark('highlight', swatch.hex)}
              className="h-4 w-4 rounded-full border border-white/40 transition-transform hover:scale-125"
              style={{ backgroundColor: swatch.hex }}
            />
          ))}
          <div className="mx-0.5 h-4 w-px bg-white/15" aria-hidden="true" />
          <button
            type="button"
            title="Underline Selected Text"
            onClick={() => handleSaveSelectionMark('underline', inkHex)}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-zinc-200 hover:bg-white/15"
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Add Note to Selection"
            onClick={handleCreateNoteFromSelection}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-sky-200 hover:bg-sky-500/20"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>Note</span>
          </button>
          <button
            type="button"
            title="Copy Text"
            onClick={handleCopySelection}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-zinc-200 hover:bg-white/15"
          >
            {copiedJustNow ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      )}

      {/* Existing Highlight Edit Popover (Tap Highlight to Recolor or Remove) */}
      {highlightPopup && (
        <div
          style={{
            left: `${Math.max(12, Math.min(window.innerWidth - 220, highlightPopup.clientX - 90))}px`,
            top: `${Math.max(64, Math.min(window.innerHeight - 110, highlightPopup.clientY - 46))}px`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed z-50 flex items-center gap-1.5 rounded-full border border-white/20 bg-[#0b0e16]/95 px-2.5 py-1.5 shadow-2xl backdrop-blur-xl"
        >
          {PDF_ANNOTATION_PALETTE.map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              onClick={() => {
                handleUpdateAnnotations(highlightPopup.pageNum, (prev) => ({
                  ...prev,
                  highlights: prev.highlights.map((h) =>
                    h.id === highlightPopup.highlight.id
                      ? { ...h, color: swatch.hex }
                      : h
                  ),
                }));
                setHighlightPopup(null);
              }}
              className={cn(
                'h-4 w-4 rounded-full border transition-transform hover:scale-125',
                highlightPopup.highlight.color === swatch.hex
                  ? 'border-white ring-1 ring-white/50'
                  : 'border-white/30'
              )}
              style={{ backgroundColor: swatch.hex }}
            />
          ))}
          <div className="mx-0.5 h-4 w-px bg-white/15" aria-hidden="true" />
          <button
            type="button"
            title="Remove Highlight"
            onClick={() => {
              handleUpdateAnnotations(highlightPopup.pageNum, (prev) => ({
                ...prev,
                highlights: prev.highlights.filter(
                  (h) => h.id !== highlightPopup.highlight.id
                ),
              }));
              setHighlightPopup(null);
            }}
            className="rounded-full p-1 text-rose-300 hover:bg-rose-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <input
        ref={filePickerRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          onSelectLocalFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {/* Bottom Floating Study Dock (Page-Anchored Marks; Never Locks Page Scroll/Nav) */}
      <div className="pointer-events-auto absolute bottom-3 left-1/2 z-30 flex max-w-[96%] -translate-x-1/2 items-center gap-1 overflow-x-auto no-scrollbar rounded-full border border-white/15 bg-[#090b10]/95 px-2.5 py-1 shadow-2xl backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setTool('read')}
          aria-pressed={tool === 'read'}
          title="Read & Select Book Text"
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all',
            tool === 'read'
              ? 'border-sky-400/50 bg-sky-500/20 text-sky-200'
              : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-white'
          )}
        >
          Read
        </button>

        <button
          type="button"
          onClick={() => setTool((t) => (t === 'highlight' ? 'read' : 'highlight'))}
          aria-pressed={tool === 'highlight'}
          title="Auto-Highlight Selected Book Text"
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all',
            tool === 'highlight'
              ? 'border-yellow-400/60 bg-yellow-500/20 text-yellow-200'
              : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-white'
          )}
        >
          <Highlighter className="h-3 w-3" />
          <span className="hidden sm:inline">Highlight</span>
        </button>

        <button
          type="button"
          onClick={() => setTool((t) => (t === 'pen' ? 'read' : 'pen'))}
          aria-pressed={tool === 'pen'}
          title="Freehand Pen (Anchored to Page)"
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all',
            tool === 'pen'
              ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
              : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-white'
          )}
        >
          <Pencil className="h-3 w-3" />
          <span className="hidden sm:inline">Pen</span>
        </button>

        <button
          type="button"
          onClick={() => setTool((t) => (t === 'text' ? 'read' : 'text'))}
          aria-pressed={tool === 'text'}
          title="Place Sticky Note on Page"
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all',
            tool === 'text'
              ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
              : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-white'
          )}
        >
          <Type className="h-3 w-3" />
          <span className="hidden sm:inline">Note</span>
        </button>

        <button
          type="button"
          onClick={() => setTool((t) => (t === 'eraser' ? 'read' : 'eraser'))}
          aria-pressed={tool === 'eraser'}
          title="Erase Marks on Page"
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
          {PDF_ANNOTATION_PALETTE.map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              onClick={() => setInkHex(swatch.hex)}
              title={swatch.label}
              className={cn(
                'h-3 w-3 shrink-0 rounded-full border transition-transform',
                inkHex === swatch.hex
                  ? 'scale-125 border-white ring-1 ring-white/40'
                  : 'border-white/30 opacity-80 hover:opacity-100'
              )}
              style={{ backgroundColor: swatch.hex }}
            />
          ))}
        </div>

        {hasCurrentPageAnns && (
          <>
            <div className="mx-0.5 h-4 w-px bg-white/15" aria-hidden="true" />
            <button
              type="button"
              onClick={handleUndoPage}
              title="Undo Last Page Mark"
              className="rounded-full p-1 text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <Undo2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setShowAnnotations((v) => !v)}
              title={showAnnotations ? 'Hide Page Marks' : 'Show Page Marks'}
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
              onClick={() => {
                clearBookPageAnnotations(book.id, visiblePage);
                annotationsMapRef.current.set(`${book.id}:${visiblePage}`, {
                  highlights: [],
                  strokes: [],
                  notes: [],
                });
                setAnnotationsTick((t) => t + 1);
              }}
              title="Clear Page Annotations"
              className="rounded-full p-1 text-zinc-400 hover:bg-rose-500/20 hover:text-rose-200"
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={handleExportPageNotes}
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
