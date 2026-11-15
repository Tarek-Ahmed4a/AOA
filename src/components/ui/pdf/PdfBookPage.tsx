import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  buildNormalizedSelectionRects,
  pointInsideRects,
  pointNearStroke,
  type NormalizedRect,
  type PdfInkStroke,
  type PdfPageAnnotations,
  type PdfReaderTool,
  type PdfStickyNote,
  type PdfTextHighlight,
} from './pdfAnnotations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDocumentProxyLike = any;

export interface PdfBookPageProps {
  bookId: string;
  pageNum: number;
  pdfDoc: PdfDocumentProxyLike;
  pdfjsMod: typeof import('pdfjs-dist');
  renderActive: boolean;
  targetWidth: number;
  aspectRatio: number;
  isNativeMobile: boolean;
  searchKeyword: string;
  tool: PdfReaderTool;
  inkHex: string;
  showAnnotations: boolean;
  annotations: PdfPageAnnotations;
  editingNoteId: string | null;
  pageRefCallback: (pageNum: number, el: HTMLDivElement | null) => void;
  onMeasurePage: (pageNum: number, aspectRatio: number) => void;
  onUpdateAnnotations: (
    pageNum: number,
    updater: (prev: PdfPageAnnotations) => PdfPageAnnotations
  ) => void;
  onTextSelected: (payload: {
    pageNum: number;
    quote: string;
    rects: NormalizedRect[];
    clientX: number;
    clientY: number;
  }) => void;
  onClickHighlight: (payload: {
    pageNum: number;
    highlight: PdfTextHighlight;
    clientX: number;
    clientY: number;
  }) => void;
  onEditNote: (noteId: string | null) => void;
}

const PdfBookPageInner: React.FC<PdfBookPageProps> = ({
  pageNum,
  pdfDoc,
  pdfjsMod,
  renderActive,
  targetWidth,
  aspectRatio,
  isNativeMobile,
  searchKeyword,
  tool,
  inkHex,
  showAnnotations,
  annotations,
  editingNoteId,
  pageRefCallback,
  onMeasurePage,
  onUpdateAnnotations,
  onTextSelected,
  onClickHighlight,
  onEditNote,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const aspectRatioRef = useRef<number>(aspectRatio);
  const onMeasurePageRef = useRef(onMeasurePage);
  aspectRatioRef.current = aspectRatio;
  onMeasurePageRef.current = onMeasurePage;

  const [scaleFactor, setScaleFactor] = useState<number>(1);
  const [renderedPageSize, setRenderedPageSize] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [searchMatchRects, setSearchMatchRects] = useState<NormalizedRect[]>([]);

  const activeStrokeRef = useRef<PdfInkStroke | null>(null);
  const draggingNoteRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const estimatedW = Math.max(220, Math.round(targetWidth));
  const estimatedH = Math.max(260, Math.round(estimatedW * aspectRatio));
  const displayW = renderedPageSize?.w ?? estimatedW;
  const displayH = renderedPageSize?.h ?? estimatedH;

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      wrapperRef.current = el;
      pageRefCallback(pageNum, el);
    },
    [pageNum, pageRefCallback]
  );

  // Render crisp PDF page raster + TextLayer ONLY while within active viewport window
  useEffect(() => {
    if (!renderActive || !pdfDoc || !pdfjsMod) {
      setSearchMatchRects([]);
      return;
    }

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderTask: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let textLayerInstance: any = null;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const pageAspect =
          baseViewport.width > 0
            ? baseViewport.height / baseViewport.width
            : aspectRatioRef.current;
        onMeasurePageRef.current(pageNum, pageAspect);

        const cssScale = Math.max(
          0.35,
          Math.min(3.5, estimatedW / Math.max(1, baseViewport.width))
        );
        const viewport = page.getViewport({ scale: cssScale });
        if (cancelled) return;

        const pageW = Math.round(viewport.width);
        const pageH = Math.round(viewport.height);
        setScaleFactor(viewport.scale);
        setRenderedPageSize({ w: pageW, h: pageH });

        const canvas = pageCanvasRef.current;
        if (canvas) {
          const maxDpr = isNativeMobile ? 1.35 : 1.75;
          const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
          canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
          canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
          canvas.style.width = `${pageW}px`;
          canvas.style.height = `${pageH}px`;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, viewport.width, viewport.height);
            renderTask = page.render({
              canvasContext: ctx,
              canvas,
              viewport,
            });
            await renderTask.promise;
          }
        }
        if (cancelled) return;

        const textContainer = textLayerRef.current;
        if (textContainer) {
          textContainer.replaceChildren();
          const tl = new pdfjsMod.TextLayer({
            textContentSource: page.streamTextContent(),
            container: textContainer,
            viewport,
          });
          textLayerInstance = tl;
          await tl.render();
        }
      } catch {
        // Swallow benign cancellation errors when page scrolls rapidly out of view
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel?.();
      } catch {
        // Ignore
      }
      try {
        textLayerInstance?.cancel?.();
      } catch {
        // Ignore
      }
    };
  }, [renderActive, pdfDoc, pdfjsMod, pageNum, estimatedW, isNativeMobile]);

  // Highlight active searchKeyword inside rendered TextLayer spans
  useEffect(() => {
    const query = searchKeyword.trim().toLowerCase();
    const textContainer = textLayerRef.current;
    const wrapper = wrapperRef.current;
    if (!renderActive || !query || !textContainer || !wrapper) {
      setSearchMatchRects([]);
      return;
    }

    const timer = window.setTimeout(() => {
      const pageRect = wrapper.getBoundingClientRect();
      if (pageRect.width <= 0 || pageRect.height <= 0) return;
      const matches: NormalizedRect[] = [];
      const spans = textContainer.querySelectorAll('span');
      spans.forEach((span) => {
        const txt = span.textContent?.toLowerCase();
        if (!txt || !txt.includes(query)) return;
        const r = span.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        matches.push({
          x: Math.max(0, (r.left - pageRect.left) / pageRect.width),
          y: Math.max(0, (r.top - pageRect.top) / pageRect.height),
          w: Math.min(1, r.width / pageRect.width),
          h: Math.min(1, r.height / pageRect.height),
        });
      });
      setSearchMatchRects(matches.slice(0, 60));
    }, 80);

    return () => window.clearTimeout(timer);
  }, [renderActive, searchKeyword, scaleFactor, renderedPageSize]);

  // Draw page-anchored freehand ink strokes
  const redrawInkCanvas = useCallback(
    (pendingStroke: PdfInkStroke | null = null) => {
      const canvas = inkCanvasRef.current;
      if (!canvas) return;
      const w = displayW;
      const h = displayH;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.max(1, Math.floor(w * dpr));
      const targetH = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!showAnnotations) return;

      const drawStroke = (s: PdfInkStroke) => {
        if (s.points.length === 0) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = s.mode === 'highlight' ? 0.34 : 0.94;
        ctx.lineWidth = s.width;
        ctx.beginPath();
        const [x0, y0] = s.points[0];
        ctx.moveTo(x0 * w, y0 * h);
        for (let i = 1; i < s.points.length; i += 1) {
          const [px, py] = s.points[i];
          ctx.lineTo(px * w, py * h);
        }
        if (s.points.length === 1) {
          ctx.lineTo(x0 * w + 0.5, y0 * h + 0.5);
        }
        ctx.stroke();
        ctx.restore();
      };

      for (const s of annotations.strokes) drawStroke(s);
      if (pendingStroke) drawStroke(pendingStroke);
    },
    [annotations.strokes, displayH, displayW, showAnnotations]
  );

  useEffect(() => {
    redrawInkCanvas(null);
  }, [redrawInkCanvas]);

  const toNormalized = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const el = wrapperRef.current;
      if (!el) return [0.5, 0.5];
      const rect = el.getBoundingClientRect();
      const x = Math.max(0.01, Math.min(0.99, (clientX - rect.left) / Math.max(1, rect.width)));
      const y = Math.max(0.01, Math.min(0.99, (clientY - rect.top) / Math.max(1, rect.height)));
      return [x, y];
    },
    []
  );

  // Handle text selection & highlight clicks cleanly inside .textLayer without blocking scroll
  const handlePagePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePagePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (tool !== 'read' && tool !== 'highlight') return;

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const finishSelectionCheck = () => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const quote = sel.toString().trim();
          const ancestor = range.commonAncestorContainer;
          if (quote.length > 0 && wrapper.contains(ancestor)) {
            const pageRect = wrapper.getBoundingClientRect();
            const rects = buildNormalizedSelectionRects(range, pageRect);
            if (rects.length > 0) {
              if (tool === 'highlight') {
                const created: PdfTextHighlight = {
                  id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  kind: 'highlight',
                  color: inkHex,
                  rects,
                  quote: quote.slice(0, 240),
                };
                onUpdateAnnotations(pageNum, (prev) => ({
                  ...prev,
                  highlights: [...prev.highlights, created],
                }));
                sel.removeAllRanges();
                return;
              }

              onTextSelected({
                pageNum,
                quote: quote.slice(0, 240),
                rects,
                clientX: e.clientX,
                clientY: e.clientY,
              });
              return;
            }
          }
        }

        // If no text was selected (tap rather than drag), check if user tapped an existing highlight
        const down = pointerDownPosRef.current;
        if (
          down &&
          Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 &&
          showAnnotations &&
          annotations.highlights.length > 0
        ) {
          const [nx, ny] = toNormalized(e.clientX, e.clientY);
          const hit = [...annotations.highlights]
            .reverse()
            .find((hl) => pointInsideRects(hl.rects, nx, ny));
          if (hit) {
            onClickHighlight({
              pageNum,
              highlight: hit,
              clientX: e.clientX,
              clientY: e.clientY,
            });
          }
        }
      };

      // Defer 1 tick on mobile touch/selection settle so Range reflects final selection
      window.setTimeout(finishSelectionCheck, 10);
    },
    [
      annotations.highlights,
      inkHex,
      onClickHighlight,
      onTextSelected,
      onUpdateAnnotations,
      pageNum,
      showAnnotations,
      tool,
      toNormalized,
    ]
  );

  // Freehand Pen / Sticky Note / Eraser pointer handlers on this page's ink layer
  const handleInkPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'read' || tool === 'highlight') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const [nx, ny] = toNormalized(e.clientX, e.clientY);

    if (tool === 'text') {
      const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newNote: PdfStickyNote = {
        id,
        x: nx,
        y: ny,
        color: inkHex,
        text: '',
      };
      onUpdateAnnotations(pageNum, (prev) => ({
        ...prev,
        notes: [...prev.notes, newNote],
      }));
      onEditNote(id);
      return;
    }

    if (tool === 'eraser') {
      onUpdateAnnotations(pageNum, (prev) => ({
        ...prev,
        highlights: prev.highlights.filter((hl) => !pointInsideRects(hl.rects, nx, ny, 0.015)),
        strokes: prev.strokes.filter((s) => !pointNearStroke(s, nx, ny, 0.03)),
        notes: prev.notes.filter((n) => Math.hypot(n.x - nx, n.y - ny) > 0.045),
      }));
      return;
    }

    e.currentTarget.setPointerCapture?.(e.pointerId);
    const stroke: PdfInkStroke = {
      id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      color: inkHex,
      width: 2.6,
      mode: 'pen',
      points: [[nx, ny]],
    };
    activeStrokeRef.current = stroke;
    redrawInkCanvas(stroke);
  };

  const handleInkPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [nx, ny] = toNormalized(e.clientX, e.clientY);
    if (tool === 'eraser' && e.buttons === 1) {
      onUpdateAnnotations(pageNum, (prev) => ({
        ...prev,
        highlights: prev.highlights.filter((hl) => !pointInsideRects(hl.rects, nx, ny, 0.015)),
        strokes: prev.strokes.filter((s) => !pointNearStroke(s, nx, ny, 0.03)),
        notes: prev.notes.filter((n) => Math.hypot(n.x - nx, n.y - ny) > 0.045),
      }));
      return;
    }

    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    const last = stroke.points[stroke.points.length - 1];
    if (last && Math.hypot(nx - last[0], ny - last[1]) < 0.0025) return;
    stroke.points.push([nx, ny]);
    redrawInkCanvas(stroke);
  };

  const handleInkPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    activeStrokeRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    onUpdateAnnotations(pageNum, (prev) => ({
      ...prev,
      strokes: [...prev.strokes, stroke],
    }));
  };

  const handleNoteDragPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const dragging = draggingNoteRef.current;
    if (!dragging) return;
    const [nx, ny] = toNormalized(e.clientX, e.clientY);
    onUpdateAnnotations(pageNum, (prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === dragging.id
          ? {
              ...n,
              x: Math.max(0.03, Math.min(0.95, nx - dragging.offsetX)),
              y: Math.max(0.03, Math.min(0.95, ny - dragging.offsetY)),
            }
          : n
      ),
    }));
  };

  const textLayerInteractive = tool === 'read' || tool === 'highlight';

  return (
    <div
      ref={setRefs}
      data-page-number={pageNum}
      onPointerDown={handlePagePointerDown}
      onPointerUp={handlePagePointerUp}
      onPointerMove={handleNoteDragPointerMove}
      onPointerCancel={() => {
        draggingNoteRef.current = null;
      }}
      style={
        {
          width: `${displayW}px`,
          height: `${displayH}px`,
          '--scale-factor': String(scaleFactor),
        } as React.CSSProperties
      }
      className={cn(
        'aoa-pdf-page relative mx-auto my-2 shrink-0 overflow-hidden rounded-md bg-white shadow-[0_10px_35px_rgba(0,0,0,0.55)] ring-1 ring-white/10',
        tool === 'highlight' && 'selection:bg-yellow-300/40'
      )}
    >
      {renderActive ? (
        <>
          {/* Layer 0: Crisp PDF Page Raster */}
          <canvas
            ref={pageCanvasRef}
            className="pointer-events-none block h-full w-full"
          />

          {/* Layer 1: Saved Word-Level Text Highlights & Search Hits (multiply over white page) */}
          <div className="pointer-events-none absolute inset-0 z-[1]">
            {searchMatchRects.map((r, idx) => (
              <div
                key={`sr-${idx}`}
                className="absolute rounded-[2px] bg-sky-400/35 ring-1 ring-sky-500/60"
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                }}
              />
            ))}
            {showAnnotations &&
              annotations.highlights.map((hl) =>
                hl.rects.map((r, idx) => (
                  <div
                    key={`${hl.id}-${idx}`}
                    className="absolute"
                    style={
                      hl.kind === 'underline'
                        ? {
                            left: `${r.x * 100}%`,
                            top: `${(r.y + r.h * 0.85) * 100}%`,
                            width: `${r.w * 100}%`,
                            height: '2px',
                            backgroundColor: hl.color,
                          }
                        : {
                            left: `${r.x * 100}%`,
                            top: `${r.y * 100}%`,
                            width: `${r.w * 100}%`,
                            height: `${r.h * 100}%`,
                            backgroundColor: hl.color,
                            opacity: 0.42,
                            mixBlendMode: 'multiply',
                            borderRadius: '2px',
                          }
                    }
                  />
                ))
              )}
          </div>

          {/* Layer 2: Real PDF.js TextLayer (word selection directly over rendered text) */}
          <div
            ref={textLayerRef}
            className={cn(
              'textLayer',
              textLayerInteractive ? 'pointer-events-auto' : 'pointer-events-none'
            )}
          />
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-900/95 font-mono text-[11px] text-zinc-500">
          <span>Page {pageNum}</span>
        </div>
      )}

      {/* Layer 3: Page-Anchored Freehand Ink Overlay */}
      <canvas
        ref={inkCanvasRef}
        onPointerDown={handleInkPointerDown}
        onPointerMove={handleInkPointerMove}
        onPointerUp={handleInkPointerUp}
        onPointerCancel={handleInkPointerUp}
        className={cn(
          'absolute inset-0 z-[3] h-full w-full',
          tool === 'read' || tool === 'highlight'
            ? 'pointer-events-none'
            : tool === 'pen'
              ? 'pointer-events-auto cursor-crosshair touch-none'
              : tool === 'text'
                ? 'pointer-events-auto cursor-text touch-pan-y'
                : 'pointer-events-auto cursor-cell touch-pan-y'
        )}
      />

      {/* Layer 4: Page-Anchored Sticky Notes */}
      {showAnnotations &&
        annotations.notes.map((note) => {
          const isEditing = editingNoteId === note.id;
          return (
            <div
              key={note.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (tool === 'eraser') {
                  onUpdateAnnotations(pageNum, (prev) => ({
                    ...prev,
                    notes: prev.notes.filter((n) => n.id !== note.id),
                  }));
                  return;
                }
                const [nx, ny] = toNormalized(e.clientX, e.clientY);
                draggingNoteRef.current = {
                  id: note.id,
                  offsetX: nx - note.x,
                  offsetY: ny - note.y,
                };
              }}
              onPointerUp={() => {
                draggingNoteRef.current = null;
              }}
              style={{
                left: `${note.x * 100}%`,
                top: `${note.y * 100}%`,
              }}
              className="pointer-events-auto absolute z-[4] -translate-x-1/2 -translate-y-1/2"
            >
              {isEditing ? (
                <div
                  className="w-52 rounded-xl border border-white/20 bg-[#0b0d13]/95 p-2 shadow-2xl backdrop-blur-md"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {note.quote && (
                    <div className="mb-1.5 truncate border-l-2 border-amber-400/70 pl-1.5 font-sans text-[10px] italic text-zinc-400">
                      "{note.quote}"
                    </div>
                  )}
                  <textarea
                    autoFocus
                    rows={3}
                    value={note.text}
                    placeholder="Write study note..."
                    onChange={(e) => {
                      const nextText = e.target.value;
                      onUpdateAnnotations(pageNum, (prev) => ({
                        ...prev,
                        notes: prev.notes.map((n) =>
                          n.id === note.id ? { ...n, text: nextText } : n
                        ),
                      }));
                    }}
                    className="w-full resize-none rounded-lg border border-white/15 bg-black/75 p-1.5 font-sans text-[11px] text-white outline-none focus:border-sky-400/60"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateAnnotations(pageNum, (prev) => ({
                          ...prev,
                          notes: prev.notes.filter((n) => n.id !== note.id),
                        }));
                        onEditNote(null);
                      }}
                      className="rounded px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditNote(null)}
                      className="rounded-md bg-sky-500/25 px-2.5 py-0.5 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/40"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditNote(note.id);
                  }}
                  style={{
                    borderColor: `${note.color}aa`,
                    backgroundColor: 'rgba(11, 13, 19, 0.92)',
                  }}
                  className="group flex max-w-[170px] items-center gap-1.5 rounded-lg border px-2 py-1 text-left shadow-xl backdrop-blur-md hover:scale-105"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: note.color }}
                  />
                  <span className="truncate font-sans text-[11px] font-medium text-zinc-100">
                    {note.text || note.quote || 'Note...'}
                  </span>
                  <X
                    className="ml-0.5 hidden h-3 w-3 shrink-0 text-zinc-400 hover:text-rose-300 group-hover:block"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onUpdateAnnotations(pageNum, (prev) => ({
                        ...prev,
                        notes: prev.notes.filter((n) => n.id !== note.id),
                      }));
                    }}
                  />
                </button>
              )}
            </div>
          );
        })}

      {/* Subtle page footer badge inside page corner */}
      <div className="pointer-events-none absolute bottom-1.5 right-2 z-[4] rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-zinc-200">
        {pageNum}
      </div>
    </div>
  );
};

export const PdfBookPage = React.memo(PdfBookPageInner);

