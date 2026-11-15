export type PdfReaderTool = 'read' | 'pen' | 'highlight' | 'text' | 'eraser';

export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfTextHighlight {
  id: string;
  kind: 'highlight' | 'underline';
  color: string;
  rects: NormalizedRect[];
  quote?: string;
}

export interface PdfInkStroke {
  id: string;
  color: string;
  width: number;
  mode: 'pen' | 'highlight';
  points: [number, number][];
}

export interface PdfStickyNote {
  id: string;
  x: number;
  y: number;
  color: string;
  text: string;
  quote?: string;
}

export interface PdfPageAnnotations {
  highlights: PdfTextHighlight[];
  strokes: PdfInkStroke[];
  notes: PdfStickyNote[];
}

export interface PdfColorSwatch {
  id: string;
  label: string;
  hex: string;
}

export const PDF_ANNOTATION_PALETTE: PdfColorSwatch[] = [
  { id: 'yellow', label: 'Yellow Highlight', hex: '#fde047' },
  { id: 'cyan', label: 'Cyan Ink', hex: '#38bdf8' },
  { id: 'green', label: 'Emerald Ink', hex: '#4ade80' },
  { id: 'rose', label: 'Crimson Ink', hex: '#fb7185' },
  { id: 'amber', label: 'Amber Ink', hex: '#fbbf24' },
];

export const EMPTY_PAGE_ANNOTATIONS: PdfPageAnnotations = {
  highlights: [],
  strokes: [],
  notes: [],
};

const STORAGE_V2_PREFIX = 'aoa:pdf-ann:v2';
const STORAGE_V1_PREFIX = 'aoa:pdf-ann:v1';

function buildV2Key(bookId: string, page: number): string {
  return `${STORAGE_V2_PREFIX}:${bookId}:${Math.max(1, Math.floor(page))}`;
}

function buildV1Key(bookId: string, page: number): string {
  return `${STORAGE_V1_PREFIX}:${bookId}:${Math.max(1, Math.floor(page))}`;
}

export function loadPdfPageAnnotations(
  bookId: string,
  page: number
): PdfPageAnnotations {
  try {
    const rawV2 = window.localStorage.getItem(buildV2Key(bookId, page));
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<PdfPageAnnotations>;
      return {
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        strokes: Array.isArray(parsed.strokes) ? parsed.strokes : [],
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      };
    }

    // Best-effort migration from legacy v1 viewport strokes/notes
    const rawV1 = window.localStorage.getItem(buildV1Key(bookId, page));
    if (!rawV1) return { ...EMPTY_PAGE_ANNOTATIONS };
    const legacy = JSON.parse(rawV1) as {
      strokes?: PdfInkStroke[];
      notes?: PdfStickyNote[];
    };
    return {
      highlights: [],
      strokes: Array.isArray(legacy.strokes) ? legacy.strokes : [],
      notes: Array.isArray(legacy.notes) ? legacy.notes : [],
    };
  } catch {
    return { ...EMPTY_PAGE_ANNOTATIONS };
  }
}

export function savePdfPageAnnotations(
  bookId: string,
  page: number,
  state: PdfPageAnnotations
): void {
  try {
    const key = buildV2Key(bookId, page);
    const hasData =
      state.highlights.length > 0 ||
      state.strokes.length > 0 ||
      state.notes.length > 0;
    if (!hasData) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in sandboxed WebViews
  }
}

export function clearBookPageAnnotations(bookId: string, page: number): void {
  try {
    window.localStorage.removeItem(buildV2Key(bookId, page));
    window.localStorage.removeItem(buildV1Key(bookId, page));
  } catch {
    // Ignore
  }
}

/**
 * Merges glyph/word DOMRect fragments along the same text line so page-anchored
 * highlights render cleanly without jagged gaps or per-character seams.
 */
export function buildNormalizedSelectionRects(
  range: Range,
  pageRect: DOMRect
): NormalizedRect[] {
  if (pageRect.width <= 0 || pageRect.height <= 0) return [];
  const rawRects = Array.from(range.getClientRects())
    .map((r) => {
      const x1 = Math.max(0, Math.min(1, (r.left - pageRect.left) / pageRect.width));
      const y1 = Math.max(0, Math.min(1, (r.top - pageRect.top) / pageRect.height));
      const x2 = Math.max(0, Math.min(1, (r.right - pageRect.left) / pageRect.width));
      const y2 = Math.max(0, Math.min(1, (r.bottom - pageRect.top) / pageRect.height));
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    })
    .filter((r) => r.w > 0.002 && r.h > 0.003);

  if (rawRects.length === 0) return [];

  rawRects.sort((a, b) => (Math.abs(a.y - b.y) > 0.005 ? a.y - b.y : a.x - b.x));

  const merged: NormalizedRect[] = [];
  for (const r of rawRects) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      Math.abs(prev.y - r.y) <= Math.max(prev.h, r.h) * 0.45 &&
      r.x <= prev.x + prev.w + 0.015
    ) {
      const right = Math.max(prev.x + prev.w, r.x + r.w);
      const bottom = Math.max(prev.y + prev.h, r.y + r.h);
      prev.x = Math.min(prev.x, r.x);
      prev.y = Math.min(prev.y, r.y);
      prev.w = right - prev.x;
      prev.h = bottom - prev.y;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

export function pointNearStroke(
  stroke: PdfInkStroke,
  nx: number,
  ny: number,
  tolerance = 0.024
): boolean {
  const tolSq = tolerance * tolerance;
  for (const [px, py] of stroke.points) {
    const dx = px - nx;
    const dy = py - ny;
    if (dx * dx + dy * dy <= tolSq) return true;
  }
  return false;
}

export function pointInsideRects(
  rects: NormalizedRect[],
  nx: number,
  ny: number,
  pad = 0.006
): boolean {
  return rects.some(
    (r) =>
      nx >= r.x - pad &&
      nx <= r.x + r.w + pad &&
      ny >= r.y - pad &&
      ny <= r.y + r.h + pad
  );
}

