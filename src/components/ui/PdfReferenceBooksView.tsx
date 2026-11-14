import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { useAnatomyStore } from '../../store/useAnatomyStore';
import {
  DEFAULT_PDF_BOOKS,
  usePdfSessionStore,
  type PdfBookManifestEntry,
} from '../../store/usePdfSessionStore';
import { resolveAssetUrl } from '../../utils/assetUrl';

function buildPdfIframeSrc(url: string, page: number, keyword?: string): string {
  const safePage = Math.max(1, Math.floor(page || 1));
  const cleanSearch = keyword
    ? `&search=${encodeURIComponent(keyword.trim().slice(0, 60))}`
    : '';
  return `${url}#toolbar=1&navpanes=0&view=FitH&page=${safePage}${cleanSearch}`;
}

interface PdfFramePaneProps {
  book: PdfBookManifestEntry;
  customUrl?: string;
  pageNumber: number;
  navNonce: number;
  searchKeyword: string;
}

const PdfFramePane: React.FC<PdfFramePaneProps> = ({
  book,
  customUrl,
  pageNumber,
  navNonce,
  searchKeyword,
}) => {
  const activeUrl = resolveAssetUrl(customUrl ?? book.url);
  const iframeSrc = useMemo(
    () => buildPdfIframeSrc(activeUrl, pageNumber, searchKeyword),
    [activeUrl, pageNumber, searchKeyword]
  );

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#09090b] shadow-2xl">
      <iframe
        key={`${book.id}:${activeUrl}:${navNonce}`}
        src={iframeSrc}
        title={book.title}
        className="h-full w-full flex-1 border-0 bg-[#09090b]"
      />
    </div>
  );
};

export const PdfReferenceBooksView: React.FC = () => {
  const rootRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const pdfReferenceTarget = useAnatomyStore((s) => s.pdfReferenceTarget);
  const books = usePdfSessionStore((s) => s.books);
  const viewMode = usePdfSessionStore((s) => s.viewMode);
  const book1Page = usePdfSessionStore((s) => s.book1Page);
  const book2Page = usePdfSessionStore((s) => s.book2Page);
  const book1Nonce = usePdfSessionStore((s) => s.book1Nonce);
  const book2Nonce = usePdfSessionStore((s) => s.book2Nonce);
  const searchKeyword = usePdfSessionStore((s) => s.searchKeyword);
  const customOverrides = usePdfSessionStore((s) => s.customOverrides);
  const ensureManifestLoaded = usePdfSessionStore((s) => s.ensureManifestLoaded);
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
        isFullscreen ? 'p-1.5' : 'px-1.5 pb-1 pt-[52px]'
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
          />
        )}

        {(viewMode === 'book2' || viewMode === 'split') && (
          <PdfFramePane
            book={book2}
            customUrl={customOverrides.book2?.url}
            pageNumber={book2Page}
            navNonce={book2Nonce}
            searchKeyword={searchKeyword}
          />
        )}
      </div>
    </section>
  );
};
