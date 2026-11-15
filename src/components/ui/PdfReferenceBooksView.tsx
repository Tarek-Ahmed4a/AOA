import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Download,
  FolderOpen,
  Globe,
  Search,
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
import { PdfBookPane } from './pdf/PdfBookPane';

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
            <span>Load Local .PDF File from Phone</span>
          </button>

          {onStreamRemotePdf && book.remoteFallbackUrl && (
            <>
              <button
                type="button"
                onClick={onStreamRemotePdf}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/50 bg-sky-500/20 px-3 py-1.5 font-mono text-[10.5px] font-semibold text-sky-200 transition-colors hover:bg-sky-500/30 active:scale-95"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Stream Full PDF</span>
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

export const PdfReferenceBooksView: React.FC<{ isActive?: boolean }> = ({
  isActive = true,
}) => {
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

  const [hasMountedBook1, setHasMountedBook1] = useState<boolean>(true);
  const [hasMountedBook2, setHasMountedBook2] = useState<boolean>(false);

  const [pdfPageInput, setPdfPageInput] = useState(String(book1Page));

  useEffect(() => {
    if (viewMode === 'book1' || viewMode === 'split') setHasMountedBook1(true);
    if (viewMode === 'book2' || viewMode === 'split') setHasMountedBook2(true);
  }, [viewMode]);

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
      aria-hidden={!isActive}
      className={cn(
        'fixed inset-0 z-20 flex h-dvh w-dvw flex-col bg-black',
        isFullscreen ? 'p-1.5' : 'px-1.5 pb-1 pt-[48px] md:pt-[54px]',
        !isActive && 'hidden'
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
                name="booksSubbarPageJump"
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
              id="books-subbar-chapter-select"
              name="booksSubbarChapterSelect"
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
        {hasMountedBook1 && (
          <div
            className={cn(
              'min-h-0 flex-1 flex-col',
              viewMode === 'book1' || viewMode === 'split' ? 'flex' : 'hidden'
            )}
          >
            <PdfBookPane
              book={book1}
              customUrl={customOverrides.book1?.url}
              pageNumber={book1Page}
              navNonce={book1Nonce}
              searchKeyword={searchKeyword}
              isPaneVisible={
                isActive && (viewMode === 'book1' || viewMode === 'split')
              }
              onJumpPage={jumpBook1}
              onSelectLocalFile={(file) => loadLocalPdf('book1', file)}
              fallbackReader={
                <OfflineTextbookChapterReader
                  book={book1}
                  initialQuery={searchKeyword}
                  onOpenLocalFile={() => pdfFileInputRef.current?.click()}
                />
              }
            />
          </div>
        )}

        {hasMountedBook2 && (
          <div
            className={cn(
              'min-h-0 flex-1 flex-col',
              viewMode === 'book2' || viewMode === 'split' ? 'flex' : 'hidden'
            )}
          >
            <PdfBookPane
              book={book2}
              customUrl={customOverrides.book2?.url}
              pageNumber={book2Page}
              navNonce={book2Nonce}
              searchKeyword={searchKeyword}
              isPaneVisible={
                isActive && (viewMode === 'book2' || viewMode === 'split')
              }
              onJumpPage={jumpBook2}
              onSelectLocalFile={(file) => loadLocalPdf('book2', file)}
              fallbackReader={
                <OfflineTextbookChapterReader
                  book={book2}
                  initialQuery={searchKeyword}
                  onOpenLocalFile={() => pdfFileInputRef.current?.click()}
                />
              }
            />
          </div>
        )}
      </div>
    </section>
  );
};
