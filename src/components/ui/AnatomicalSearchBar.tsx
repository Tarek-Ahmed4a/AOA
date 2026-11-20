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
import {
  ANATOMICAL_FIDUCIAL_LANDMARKS,
  type AnatomicalFiducialLandmark,
} from '../../data/anatomicalLandmarksCatalog';
import { resolveClinicalBaseline } from '../../data/clinicalBaseline';
import { cn } from '../../lib/utils';
import {
  useAnatomyStore,
  useAnatomyStoreApi,
  type BiologicalSex,
} from '../../store/useAnatomyStore';
import type { AnatomicalPartInfo } from '../../utils/anatomyParser';

interface IndexedCatalogEntry {
  kind: 'part' | 'landmark';
  uniqueKey: string;
  part: AnatomicalPartInfo;
  landmark?: AnatomicalFiducialLandmark;
  cleanNameEn: string;
  cleanNameAr: string;
  latinName: string;
  searchBlob: string;
  enLower: string;
  arLower: string;
  latinLower: string;
}

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesSearchToken(textNormalized: string, pattern: string): boolean {
  const pat = normalizeMatchText(pattern);
  if (!pat) return false;
  const escaped = pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(
    textNormalized
  );
}

function isLandmarkAllowedForSex(
  fid: AnatomicalFiducialLandmark,
  sex: BiologicalSex
): boolean {
  const hay = `${fid.id} ${fid.nameEn} ${fid.parentOrganLabel}`.toLowerCase();
  if (/\b(?:prostate|scrot|testis|testicul|penis|penile|epididym)\b/.test(hay)) {
    return sex === 'male';
  }
  if (
    /\b(?:uterus|uterine|ovary|ovarian|fallopian|vagina|clitoris|mammary|breast|areola)\b/.test(
      hay
    )
  ) {
    return sex === 'female';
  }
  return true;
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
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const [isOpen, setIsOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [glbFeedback, setGlbFeedback] = useState<string | null>(null);

  const storeApi = useAnatomyStoreApi();
  const anatomicalCatalog = useAnatomyStore((s) => s.anatomicalCatalog);
  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const searchQuery = useAnatomyStore((s) => s.searchQuery);
  const customGlbUrl = useAnatomyStore((s) => s.customGlbUrl);
  const customGlbName = useAnatomyStore((s) => s.customGlbName);

  const setBiologicalSex = useAnatomyStore((s) => s.setBiologicalSex);
  const setSearchQuery = useAnatomyStore((s) => s.setSearchQuery);
  const selectAndFlyToPart = useAnatomyStore((s) => s.selectAndFlyToPart);
  const loadCustomGlb = useAnatomyStore((s) => s.loadCustomGlb);

  const indexedParts = useMemo<IndexedCatalogEntry[]>(() => {
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
        kind: 'part',
        uniqueKey: `part::${part.meshUuid}`,
        part,
        cleanNameEn: part.cleanName,
        cleanNameAr,
        latinName: part.latinName,
        searchBlob,
        enLower,
        arLower,
        latinLower,
      };
    });
  }, [anatomicalCatalog]);

  const indexedLandmarks = useMemo<IndexedCatalogEntry[]>(() => {
    if (anatomicalCatalog.length === 0) return [];
    const normalizedParts = anatomicalCatalog.map((part) => ({
      part,
      hay: normalizeMatchText(
        `${part.cleanName} ${part.rawName} ${part.organGroupId} ${part.latinName}`
      ),
    }));

    const out: IndexedCatalogEntry[] = [];
    for (const fid of ANATOMICAL_FIDUCIAL_LANDMARKS) {
      if (!isLandmarkAllowedForSex(fid, biologicalSex)) continue;

      const matches = normalizedParts.filter(({ part, hay }) => {
        if (part.system !== fid.system) return false;
        if (fid.laterality === 'Left' && part.laterality === 'Right') {
          return false;
        }
        if (fid.laterality === 'Right' && part.laterality === 'Left') {
          return false;
        }
        if (
          fid.excludePatterns?.some((ex) => matchesSearchToken(hay, ex))
        ) {
          return false;
        }
        return fid.meshMatchPatterns.some((pat) => matchesSearchToken(hay, pat));
      });

      if (matches.length === 0) continue;
      matches.sort((a, b) => b.part.boundingRadius - a.part.boundingRadius);
      const parentPart = matches[0].part;

      const sysLabel = ANATOMICAL_SYSTEMS[fid.system].label;
      const enLower = fid.nameEn.toLowerCase();
      const arLower = normalizeArabicText(fid.nameAr.toLowerCase());
      const latinLower = fid.latinName.toLowerCase();
      const searchBlob = [
        enLower,
        arLower,
        fid.nameAr.toLowerCase(),
        latinLower,
        fid.region.toLowerCase(),
        fid.parentOrganLabel.toLowerCase(),
        normalizeArabicText(fid.parentOrganAr.toLowerCase()),
        fid.system.toLowerCase(),
        sysLabel.toLowerCase(),
        'landmark معلم تشريحي',
      ].join(' ');

      out.push({
        kind: 'landmark',
        uniqueKey: `lmk::${fid.id}`,
        part: parentPart,
        landmark: fid,
        cleanNameEn: fid.nameEn,
        cleanNameAr: fid.nameAr,
        latinName: fid.latinName,
        searchBlob,
        enLower,
        arLower,
        latinLower,
      });
    }
    return out;
  }, [anatomicalCatalog, biologicalSex]);

  const results = useMemo<IndexedCatalogEntry[]>(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return indexedParts.slice(0, 8);
    }

    const qLower = trimmed.toLowerCase();
    const qAr = normalizeArabicText(qLower);

    const scored: { entry: IndexedCatalogEntry; score: number }[] = [];
    for (const entry of indexedParts) {
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
      } else if (
        entry.searchBlob.includes(qLower) ||
        entry.searchBlob.includes(qAr)
      ) {
        score = 40;
      }

      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    for (const entry of indexedLandmarks) {
      let score = 0;
      if (entry.enLower.startsWith(qLower) || entry.arLower.startsWith(qAr)) {
        score = 96;
      } else if (entry.latinLower.startsWith(qLower)) {
        score = 78;
      } else if (
        entry.enLower.includes(qLower) ||
        entry.arLower.includes(qAr)
      ) {
        score = 58;
      } else if (
        entry.searchBlob.includes(qLower) ||
        entry.searchBlob.includes(qAr)
      ) {
        score = 38;
      }

      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.cleanNameEn.localeCompare(b.entry.cleanNameEn);
    });

    return scored.slice(0, 10).map((s) => s.entry);
  }, [indexedParts, indexedLandmarks, searchQuery]);

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
      } else if (e.key === 'Escape' && (isOpen || mobileSearchOpen)) {
        setIsOpen(false);
        setMobileSearchOpen(false);
        inputRef.current?.blur();
        mobileInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mobileSearchOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setMobileSearchOpen(false);
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
    const store = storeApi.getState();
    if (entry.kind === 'landmark' && entry.landmark) {
      const targetLandmark = entry.landmark;
      if (!store.activeSystems[entry.part.system]) {
        store.toggleSystem(entry.part.system);
      }
      if (!store.showSurgicalLandmarks) {
        store.setShowSurgicalLandmarks(true);
      }
      selectAndFlyToPart(entry.part.meshUuid);
      store.setFocusedLandmarkId(targetLandmark.id);
      window.setTimeout(() => {
        const latest = storeApi.getState();
        const found = latest.activePartLandmarks.find(
          (lm) => lm.id === targetLandmark.id
        );
        if (found) {
          latest.focusLandmarkPoint(
            found.id,
            found.worldPosition,
            Math.min(Math.max(entry.part.boundingRadius * 0.45, 0.045), 0.09)
          );
        }
      }, 140);
    } else {
      selectAndFlyToPart(entry.part.meshUuid);
    }
    setIsOpen(false);
    setMobileSearchOpen(false);
    inputRef.current?.blur();
    mobileInputRef.current?.blur();
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
      setMobileSearchOpen(false);
      inputRef.current?.blur();
      mobileInputRef.current?.blur();
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
        className="pointer-events-auto relative flex shrink-0 items-center justify-end gap-1 md:gap-1.5"
      >
        {/* Mobile (<768px) Search Icon Toggle */}
        <button
          type="button"
          onClick={() => {
            setMobileSearchOpen((prev) => {
              const next = !prev;
              setIsOpen(next);
              if (next) {
                window.setTimeout(() => mobileInputRef.current?.focus(), 20);
              }
              return next;
            });
          }}
          aria-label="Toggle Anatomical Search"
          aria-expanded={mobileSearchOpen}
          className={cn(
            'md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[#0a0a0c]/90 shadow-2xl backdrop-blur-md transition-colors',
            mobileSearchOpen
              ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
              : 'border-white/10 text-sky-400 hover:border-white/20'
          )}
        >
          <Search className="h-3.5 w-3.5" />
        </button>

        {/* Desktop (>=768px) Inline Search Input */}
        <div
          className={cn(
            'hidden md:flex h-9 w-36 items-center gap-1.5 rounded-full border bg-[#0a0a0c]/90 px-2.5 shadow-2xl backdrop-blur-md transition-colors xl:w-44 2xl:w-60',
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

        {/* Mobile Floating Search Input Overlay */}
        {mobileSearchOpen && (
          <div className="fixed left-2 right-2 top-[52px] z-50 flex h-9 items-center gap-2 rounded-full border border-sky-500/45 bg-[#08080e]/95 px-3 shadow-2xl backdrop-blur-xl md:hidden">
            <Search className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            <input
              ref={mobileInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Search anatomy (English, Latin, Arabic)..."
              aria-label="Mobile Anatomical Search"
              className="w-full min-w-0 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  mobileInputRef.current?.focus();
                }}
                aria-label="Clear search query"
                className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileSearchOpen(false);
                  setIsOpen(false);
                }}
                aria-label="Close mobile search"
                className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Segmented Biological Sex Switch */}
        <div
          role="group"
          aria-label="Biological Sex Model Selector"
          className="flex h-8 md:h-9 shrink-0 items-center rounded-full border border-white/10 bg-[#0a0a0c]/90 p-0.5 shadow-2xl backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setBiologicalSex('male')}
            aria-pressed={biologicalSex === 'male'}
            title="Switch to Male Anatomical Body (♂)"
            className={cn(
              'flex items-center gap-1 rounded-full border px-1.5 py-0.5 md:px-2 md:py-1 font-mono text-[10px] font-semibold tracking-wider transition-all active:scale-95',
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
              'flex items-center gap-1 rounded-full border px-1.5 py-0.5 md:px-2 md:py-1 font-mono text-[10px] font-semibold tracking-wider transition-all active:scale-95',
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
          className="flex h-8 w-8 md:h-9 md:w-auto shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-[#0a0a0c]/90 px-0 md:px-2.5 font-mono text-[10px] font-medium text-zinc-200 shadow-2xl backdrop-blur-md transition-all hover:border-sky-500/40 hover:bg-sky-500/15 hover:text-sky-300 active:scale-95"
        >
          <Upload className="h-3.5 w-3.5 text-sky-400" />
          <span className="hidden lg:inline">Import .GLB</span>
          <span className="hidden md:inline lg:hidden">.GLB</span>
        </button>

        {/* Search Results Dropdown */}
        {isOpen && (
          <div
            role="listbox"
            aria-label="Anatomical search matches"
            className={cn(
              'z-50 overflow-hidden rounded-xl border border-white/15 bg-[#08080e]/95 shadow-[0_24px_64px_rgba(0,0,0,0.95)] backdrop-blur-xl',
              mobileSearchOpen
                ? 'fixed left-2 right-2 top-[96px] md:absolute md:left-auto md:right-0 md:top-[calc(100%+6px)] md:w-[380px]'
                : 'absolute right-0 top-[calc(100%+6px)] w-[340px] max-w-[calc(100vw-1.5rem)] sm:w-[380px]'
            )}
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
                  const isLandmark = entry.kind === 'landmark' && entry.landmark;
                  return (
                    <li key={entry.uniqueKey}>
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
                            style={{
                              backgroundColor: isLandmark
                                ? '#f59e0b'
                                : sys.accentColor,
                            }}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="truncate text-xs font-semibold text-white">
                                {entry.cleanNameEn}
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
                                {entry.latinName}
                              </span>
                              <span className="text-[10px] text-zinc-600">
                                •
                              </span>
                              <span className="font-mono text-[9px] uppercase text-zinc-400">
                                {isLandmark
                                  ? `${entry.landmark!.parentOrganLabel} · ${sys.label}`
                                  : sys.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isLandmark ? (
                          <span className="shrink-0 rounded border border-amber-400/35 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-300">
                            🎯 Landmark
                          </span>
                        ) : (
                          <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-sky-300">
                            {entry.part.ta98Code}
                          </span>
                        )}
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
