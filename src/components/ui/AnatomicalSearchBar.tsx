import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FileBox,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { ANATOMICAL_SYSTEMS } from '../../config/anatomicalSystems';
import { resolveClinicalBaseline } from '../../data/clinicalBaseline';
import { cn } from '../../lib/utils';
import { useAnatomyStore } from '../../store/useAnatomyStore';
import type { AnatomicalPartInfo } from '../../utils/anatomyParser';

interface IndexedCatalogEntry {
  part: AnatomicalPartInfo;
  cleanNameAr: string;
  searchBlob: string;
  enLower: string;
  arLower: string;
  latinLower: string;
}

function normalizeArabicText(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

export const AnatomicalSearchBar: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [glbFeedback, setGlbFeedback] = useState<string | null>(null);

  const anatomicalCatalog = useAnatomyStore((s) => s.anatomicalCatalog);
  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const searchQuery = useAnatomyStore((s) => s.searchQuery);
  const customGlbUrl = useAnatomyStore((s) => s.customGlbUrl);
  const customGlbName = useAnatomyStore((s) => s.customGlbName);

  const setBiologicalSex = useAnatomyStore((s) => s.setBiologicalSex);
  const setSearchQuery = useAnatomyStore((s) => s.setSearchQuery);
  const selectAndFlyToPart = useAnatomyStore((s) => s.selectAndFlyToPart);
  const loadCustomGlb = useAnatomyStore((s) => s.loadCustomGlb);

  const indexedCatalog = useMemo<IndexedCatalogEntry[]>(() => {
    return anatomicalCatalog.map((part) => {
      const { profile } = resolveClinicalBaseline(part);
      const cleanNameAr = profile.cleanNameAr;
      const sysLabel = ANATOMICAL_SYSTEMS[part.system].label;
      const enLower = part.cleanName.toLowerCase();
      const arLower = normalizeArabicText(cleanNameAr.toLowerCase());
      const latinLower = part.latinName.toLowerCase();
      const searchBlob = [
        enLower,
        arLower,
        cleanNameAr.toLowerCase(),
        latinLower,
        part.ta98Code.toLowerCase(),
        part.system.toLowerCase(),
        sysLabel.toLowerCase(),
        part.rawName.toLowerCase(),
      ].join(' ');

      return {
        part,
        cleanNameAr,
        searchBlob,
        enLower,
        arLower,
        latinLower,
      };
    });
  }, [anatomicalCatalog]);

  const results = useMemo<IndexedCatalogEntry[]>(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return indexedCatalog.slice(0, 8);
    }

    const qLower = trimmed.toLowerCase();
    const qAr = normalizeArabicText(qLower);

    const scored: { entry: IndexedCatalogEntry; score: number }[] = [];
    for (const entry of indexedCatalog) {
      let score = 0;
      if (entry.enLower.startsWith(qLower) || entry.arLower.startsWith(qAr)) {
        score = 100;
      } else if (
        entry.latinLower.startsWith(qLower) ||
        entry.part.ta98Code.toLowerCase().startsWith(qLower)
      ) {
        score = 80;
      } else if (
        entry.enLower.includes(qLower) ||
        entry.arLower.includes(qAr)
      ) {
        score = 60;
      } else if (entry.searchBlob.includes(qLower) || entry.searchBlob.includes(qAr)) {
        score = 40;
      }

      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.part.cleanName.localeCompare(b.entry.part.cleanName);
    });

    return scored.slice(0, 8).map((s) => s.entry);
  }, [indexedCatalog, searchQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, results.length]);

  // Listen for custom GLB runtime loader errors
  useEffect(() => {
    const handleGlbError = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setGlbFeedback(
        detail
          ? `Could not load GLB (${detail}). Reverted to built-in atlas.`
          : 'Could not parse GLB file. Reverted to built-in atlas.'
      );
    };
    window.addEventListener('aoa:glb-error', handleGlbError);
    return () => window.removeEventListener('aoa:glb-error', handleGlbError);
  }, []);

  useEffect(() => {
    if (!glbFeedback) return;
    const timer = window.setTimeout(() => setGlbFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [glbFeedback]);

  const handleLoadGlbFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.glb') && !lower.endsWith('.gltf')) {
        setGlbFeedback('Unsupported format. Please select a .GLB or .GLTF file.');
        return;
      }
      setGlbFeedback(null);
      const objectUrl = URL.createObjectURL(file);
      loadCustomGlb(objectUrl, file.name);
      setIsOpen(false);
    },
    [loadCustomGlb]
  );

  // Global keyboard shortcuts: Ctrl+K / Cmd+K / '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsOpen(true);
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const isTypingTarget = Boolean(
        target &&
          (target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable ||
            (target.tagName === 'INPUT' &&
              (target as HTMLInputElement).type !== 'range'))
      );

      if (e.key === '/' && !isTypingTarget) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Full-window drag-and-drop .glb / .gltf handler
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Boolean(e.dataTransfer?.types && e.dataTransfer.types.includes('Files'));

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsDraggingFile(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDraggingFile(false);
      }
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFile(false);
      const droppedFile = e.dataTransfer?.files?.[0];
      if (droppedFile) {
        handleLoadGlbFile(droppedFile);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleLoadGlbFile]);

  const handleSelectEntry = (entry: IndexedCatalogEntry) => {
    selectAndFlyToPart(entry.part.meshUuid);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      if (results.length > 0) {
        setActiveIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      if (results.length > 0) {
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[activeIndex] ?? results[0];
      if (chosen) {
        handleSelectEntry(chosen);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <>
      {/* Full-Viewport Drag & Drop GLB Overlay */}
      {isDraggingFile && (
        <div
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md"
        >
          <div className="flex max-w-md flex-col items-center rounded-2xl border-2 border-dashed border-sky-400/70 bg-zinc-950/90 px-8 py-10 text-center shadow-[0_0_50px_rgba(56,189,248,0.25)]">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/15 text-sky-300">
              <FileBox className="h-6 w-6" />
            </div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
              3D Anatomical Ingestion
            </p>
            <h2 className="mt-1.5 text-base font-bold text-white">
              Drop .GLB / .GLTF Model Anywhere
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Auto-normalizes scale to 1.8m, builds BVH picking trees, and enables solid surgical cross-sectioning.
            </p>
          </div>
        </div>
      )}

      {/* Top-Right Compact Controls: Omni-Search, Biological Sex Switch & Import .GLB */}
      <div
        ref={containerRef}
        className="pointer-events-auto relative flex items-center justify-end gap-1.5"
      >
        <div
          className={cn(
            'flex h-9 w-36 items-center gap-1.5 rounded-full border bg-[#0a0a0c]/90 px-3 shadow-2xl backdrop-blur-md transition-colors sm:w-44 xl:w-56 2xl:w-64',
            isOpen
              ? 'border-sky-500/40 ring-1 ring-sky-500/20'
              : 'border-white/10 hover:border-white/20'
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search anatomy..."
            aria-label="Search Anatomical Structures"
            className="w-full min-w-0 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
              className="shrink-0 rounded p-0.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <kbd className="hidden shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400 xl:inline-block">
              Ctrl+K
            </kbd>
          )}
        </div>

        {/* Segmented Biological Sex Switch */}
        <div
          role="group"
          aria-label="Biological Sex Model Selector"
          className="flex h-9 shrink-0 items-center rounded-full border border-white/10 bg-[#0a0a0c]/90 p-0.5 shadow-2xl backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setBiologicalSex('male')}
            aria-pressed={biologicalSex === 'male'}
            title="Switch to Male Anatomical Body (♂)"
            className={cn(
              'flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[10px] font-semibold tracking-wider transition-all active:scale-95',
              biologicalSex === 'male'
                ? 'border-sky-500/40 bg-sky-500/15 text-sky-400'
                : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
            )}
          >
            <span className="hidden lg:inline">MALE</span>
            <span aria-hidden="true">♂</span>
          </button>
          <button
            type="button"
            onClick={() => setBiologicalSex('female')}
            aria-pressed={biologicalSex === 'female'}
            title="Switch to Female Anatomical Body (♀)"
            className={cn(
              'flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[10px] font-semibold tracking-wider transition-all active:scale-95',
              biologicalSex === 'female'
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-400'
                : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
            )}
          >
            <span className="hidden lg:inline">FEMALE</span>
            <span aria-hidden="true">♀</span>
          </button>
        </div>

        {/* Import Custom .GLB Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf"
          className="hidden"
          onChange={(e) => {
            handleLoadGlbFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Import external Z-Anatomy / NIH .GLB model"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-[#0a0a0c]/90 px-2.5 font-mono text-[10px] font-medium text-zinc-200 shadow-2xl backdrop-blur-md transition-all hover:border-sky-500/40 hover:bg-sky-500/15 hover:text-sky-300 active:scale-95"
        >
          <Upload className="h-3.5 w-3.5 text-sky-400" />
          <span className="hidden lg:inline">Import .GLB</span>
          <span className="lg:hidden">.GLB</span>
        </button>

        {/* Search Results Dropdown */}
        {isOpen && (
          <div
            role="listbox"
            aria-label="Anatomical search matches"
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-[340px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-white/15 bg-[#08080e]/95 shadow-[0_24px_64px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:w-[380px]"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
              <span>
                {searchQuery.trim()
                  ? `Matches (${results.length})`
                  : `Catalog Quick Index (${anatomicalCatalog.length} structures)`}
              </span>
              <span>Enter to fly</span>
            </div>

            {results.length === 0 ? (
              <div className="px-4 py-5 text-center text-xs text-zinc-400">
                No structures matching "{searchQuery}" in active model.
              </div>
            ) : (
              <ul className="max-h-72 overflow-y-auto touch-pan-y py-1">
                {results.map((entry, idx) => {
                  const sys = ANATOMICAL_SYSTEMS[entry.part.system];
                  const isHighlighted = idx === activeIndex;
                  return (
                    <li key={entry.part.meshUuid}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => handleSelectEntry(entry)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left transition-colors',
                          isHighlighted
                            ? 'bg-sky-500/20 text-white'
                            : 'text-zinc-200 hover:bg-white/5'
                        )}
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span
                            className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: sys.accentColor }}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="truncate text-xs font-semibold text-white">
                                {entry.part.cleanName}
                              </span>
                              <span
                                dir="rtl"
                                className="truncate text-[11px] font-medium text-sky-300/90"
                              >
                                {entry.cleanNameAr}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className="truncate font-serif text-[11px] italic text-zinc-400">
                                {entry.part.latinName}
                              </span>
                              <span className="text-[10px] text-zinc-600">
                                •
                              </span>
                              <span className="font-mono text-[9px] uppercase text-zinc-400">
                                {sys.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-sky-300">
                          {entry.part.ta98Code}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Active Custom GLB Banner / Error Pill */}
        {!isOpen && (customGlbUrl || glbFeedback) && (
          <div className="pointer-events-auto absolute right-0 top-[calc(100%+6px)] z-40 flex flex-wrap items-center justify-end gap-1.5">
            {customGlbUrl && (
              <div className="flex items-center gap-2 rounded-full border border-sky-400/35 bg-zinc-950/90 px-3 py-1 font-mono text-[10px] text-sky-200 shadow-lg backdrop-blur-md">
                <Sparkles className="h-3 w-3 text-sky-400" />
                <span className="max-w-[180px] truncate">
                  {customGlbName ?? 'Custom GLB'}
                </span>
                <button
                  type="button"
                  onClick={() => loadCustomGlb(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white transition-colors hover:bg-white/20"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  <span>Built-in Atlas</span>
                </button>
              </div>
            )}
            {glbFeedback && (
              <div className="rounded-full border border-rose-400/40 bg-rose-950/90 px-3 py-1 font-mono text-[10px] text-rose-200 shadow-lg backdrop-blur-md">
                {glbFeedback}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
