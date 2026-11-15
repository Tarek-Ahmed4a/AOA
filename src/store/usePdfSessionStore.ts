import { create } from 'zustand';
import type { PdfReferenceTarget } from './useAnatomyStore';
import { resolveAssetUrl } from '../utils/assetUrl';

export type PdfViewMode = 'book1' | 'book2' | 'split';

export interface PdfChapterBookmark {
  title: string;
  page: number;
}

export interface PdfBookManifestEntry {
  id: string;
  slot: number;
  role: 'atlas' | 'textbook';
  title: string;
  shortLabel: string;
  sourceTitle: string;
  originalFilename: string;
  filename: string;
  sizeBytes: number;
  pageCount: number;
  url: string;
  remoteFallbackUrl?: string;
  chapters?: PdfChapterBookmark[];
  plateOffsetEstimate?: number | null;
  plateToPage?: Record<string, number>;
}

interface PdfBooksManifestResponse {
  generatedAt: string;
  books: PdfBookManifestEntry[];
}

export interface CustomPdfOverride {
  url: string;
  filename: string;
}

export const DEFAULT_PDF_BOOKS: PdfBookManifestEntry[] = [
  {
    id: 'book1',
    slot: 1,
    role: 'atlas',
    title: 'Book 1 — Atlas & Illustrations',
    shortLabel: 'Book 1: Atlas & Organs (Plates)',
    sourceTitle: "Netter's Atlas of Human Anatomy (7th Edition)",
    originalFilename: "Netter's Atlas of Human Anatomy 7ed.pdf",
    filename: 'book1-netters-atlas-7ed.pdf',
    sizeBytes: 0,
    pageCount: 791,
    url: '/books/book1-netters-atlas-7ed.pdf',
    remoteFallbackUrl:
      'https://github.com/Tarek-Ahmed4a/AOA/releases/latest/download/book1-netters-atlas-7ed.pdf',
    chapters: [],
    plateOffsetEstimate: 36,
    plateToPage: {},
  },
  {
    id: 'book2',
    slot: 2,
    role: 'textbook',
    title: 'Book 2 — Textbook & Explanations',
    shortLabel: 'Book 2: Clinical Text & Explanations',
    sourceTitle: "Gray's Anatomy for Students (4th Edition)",
    originalFilename: "Gray's Anatomy for Students 4th Edition NO Watermark.pdf",
    filename: 'book2-grays-anatomy-4ed.pdf',
    sizeBytes: 0,
    pageCount: 1234,
    url: '/books/book2-grays-anatomy-4ed.pdf',
    remoteFallbackUrl:
      'https://github.com/Tarek-Ahmed4a/AOA/releases/latest/download/book2-grays-anatomy-4ed.pdf',
    chapters: [],
    plateOffsetEstimate: null,
    plateToPage: {},
  },
];

let manifestFetchStarted = false;

interface PdfSessionState {
  books: PdfBookManifestEntry[];
  viewMode: PdfViewMode;
  book1Page: number;
  book2Page: number;
  book1Nonce: number;
  book2Nonce: number;
  searchKeyword: string;
  lastHandledTrigger: number;
  dismissedStructureKey: string | null;
  customOverrides: Partial<Record<'book1' | 'book2', CustomPdfOverride>>;

  ensureManifestLoaded: () => void;
  setViewMode: (mode: PdfViewMode) => void;
  jumpBook1: (page: number) => void;
  jumpBook2: (page: number) => void;
  jumpActiveBook: (page: number) => void;
  setSearchKeyword: (keyword: string) => void;
  loadLocalPdf: (slot: 'book1' | 'book2', file: File | undefined | null) => void;
  syncFromReferenceTarget: (target: PdfReferenceTarget | null) => void;
  dismissStructureBadge: (key: string) => void;
}

export const usePdfSessionStore = create<PdfSessionState>((set, get) => ({
  books: DEFAULT_PDF_BOOKS,
  viewMode: 'split',
  book1Page: 37,
  book2Page: 1,
  book1Nonce: 0,
  book2Nonce: 0,
  searchKeyword: '',
  lastHandledTrigger: 0,
  dismissedStructureKey: null,
  customOverrides: {},

  ensureManifestLoaded: () => {
    if (manifestFetchStarted || typeof fetch === 'undefined') return;
    manifestFetchStarted = true;
    fetch(resolveAssetUrl('/books/manifest.json'), { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<PdfBooksManifestResponse>) : null))
      .then((data) => {
        if (data?.books?.length) {
          set({
            books: data.books.map((book) => ({
              ...book,
              url: resolveAssetUrl(book.url),
            })),
          });
        }
      })
      .catch(() => {
        // Retain DEFAULT_PDF_BOOKS seamlessly
      });
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  jumpBook1: (page) =>
    set((state) => {
      const b1 =
        state.books.find((b) => b.id === 'book1' || b.role === 'atlas') ??
        DEFAULT_PDF_BOOKS[0];
      const safe = Math.max(1, Math.floor(page || 1));
      const clamped = b1.pageCount ? Math.min(safe, b1.pageCount) : safe;
      return {
        book1Page: clamped,
        book1Nonce: state.book1Nonce + 1,
      };
    }),

  jumpBook2: (page) =>
    set((state) => {
      const b2 =
        state.books.find((b) => b.id === 'book2' || b.role === 'textbook') ??
        DEFAULT_PDF_BOOKS[1];
      const safe = Math.max(1, Math.floor(page || 1));
      const clamped = b2.pageCount ? Math.min(safe, b2.pageCount) : safe;
      return {
        book2Page: clamped,
        book2Nonce: state.book2Nonce + 1,
      };
    }),

  jumpActiveBook: (page) => {
    const mode = get().viewMode;
    if (mode === 'book2') {
      get().jumpBook2(page);
    } else {
      get().jumpBook1(page);
    }
  },

  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),

  loadLocalPdf: (slot, file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;
    const nextUrl = URL.createObjectURL(file);
    set((state) => {
      const old = state.customOverrides[slot];
      if (old?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(old.url);
      }
      const nextOverrides = {
        ...state.customOverrides,
        [slot]: { url: nextUrl, filename: file.name },
      };
      if (slot === 'book1') {
        return {
          customOverrides: nextOverrides,
          book1Page: 1,
          book1Nonce: state.book1Nonce + 1,
        };
      }
      return {
        customOverrides: nextOverrides,
        book2Page: 1,
        book2Nonce: state.book2Nonce + 1,
      };
    });
  },

  syncFromReferenceTarget: (target) => {
    if (!target) return;
    const state = get();
    if (target.trigger === state.lastHandledTrigger) return;

    const book1 =
      state.books.find((b) => b.id === 'book1' || b.role === 'atlas') ??
      DEFAULT_PDF_BOOKS[0];
    let nextB1Page = target.book1Page;
    if (!nextB1Page && target.book1Plate) {
      const mapped = book1.plateToPage?.[String(target.book1Plate)];
      const offset = book1.plateOffsetEstimate ?? 36;
      nextB1Page = mapped ?? target.book1Plate + offset;
    }

    set({
      lastHandledTrigger: target.trigger,
      dismissedStructureKey: null,
      ...(target.query ? { searchKeyword: target.query } : {}),
      ...(nextB1Page && nextB1Page >= 1
        ? { book1Page: nextB1Page, book1Nonce: state.book1Nonce + 1 }
        : {}),
      ...(target.book2Page && target.book2Page >= 1
        ? { book2Page: target.book2Page, book2Nonce: state.book2Nonce + 1 }
        : {}),
      ...(target.preferredView ? { viewMode: target.preferredView } : {}),
    });
  },

  dismissStructureBadge: (key) => set({ dismissedStructureKey: key }),
}));
