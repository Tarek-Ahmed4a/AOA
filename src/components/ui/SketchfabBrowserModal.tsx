import React, { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  Download,
  ExternalLink,
  Loader2,
  Search,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAnatomyStore } from '../../store/useAnatomyStore';

const SKETCHFAB_API_BASE = 'https://api.sketchfab.com/v3';
const SKETCHFAB_TOKEN =
  (
    import.meta as unknown as {
      env?: Record<string, string | undefined>;
    }
  ).env?.VITE_SKETCHFAB_API_TOKEN || 'fb4732a2d4e2414f92d3138bcd71d9da';

interface SketchfabThumbnailImage {
  url: string;
  width: number;
  height: number;
}

interface SketchfabModelItem {
  uid: string;
  name: string;
  viewerUrl?: string;
  faceCount?: number;
  vertexCount?: number;
  likeCount?: number;
  isDownloadable?: boolean;
  user?: {
    username?: string;
    displayName?: string;
  };
  license?: {
    label?: string;
  };
  thumbnails?: {
    images?: SketchfabThumbnailImage[];
  };
  archives?: {
    glb?: {
      size?: number;
    };
  };
}

interface SearchPreset {
  id: string;
  label: string;
  query: string;
  userFilter?: string;
  minFaces?: number;
}

const SEARCH_PRESETS: SearchPreset[] = [
  {
    id: 'zanatomy',
    label: 'Z-Anatomy Official',
    query: '',
    userFilter: 'Z-Anatomy',
  },
  {
    id: 'skeletal',
    label: 'Skeletal System',
    query: 'human skeleton anatomy medical',
    minFaces: 10000,
  },
  {
    id: 'muscular',
    label: 'Muscular Écorché',
    query: 'human muscular system ecorche',
    minFaces: 10000,
  },
  {
    id: 'nervous',
    label: 'Brain & Nerves',
    query: 'human nervous system brain anatomy',
    minFaces: 10000,
  },
  {
    id: 'cardio',
    label: 'Heart & Vessels',
    query: 'human heart vascular anatomy',
    minFaces: 10000,
  },
  {
    id: 'visceral',
    label: 'Internal Organs',
    query: 'human internal organs anatomy',
    minFaces: 5000,
  },
];

function pickThumbnailUrl(item: SketchfabModelItem): string | null {
  const images = item.thumbnails?.images ?? [];
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => a.width - b.width);
  const medium = sorted.find((img) => img.width >= 260) ?? sorted[sorted.length - 1];
  return medium?.url ?? null;
}

function formatFaces(count?: number): string {
  if (!count) return 'N/A';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M faces`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k faces`;
  return `${count} faces`;
}

function formatBytes(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB GLB`;
}

export const SketchfabBrowserModal: React.FC = () => {
  const showSketchfabModal = useAnatomyStore((s) => s.showSketchfabModal);
  const setShowSketchfabModal = useAnatomyStore((s) => s.setShowSketchfabModal);
  const loadCustomGlb = useAnatomyStore((s) => s.loadCustomGlb);

  const [queryInput, setQueryInput] = useState('');
  const [activePresetId, setActivePresetId] = useState<string>('zanatomy');
  const [results, setResults] = useState<SketchfabModelItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loadingUid, setLoadingUid] = useState<string | null>(null);

  const runSearch = useCallback(
    async (
      query: string,
      preset?: SearchPreset,
      signal?: AbortSignal
    ) => {
      setIsSearching(true);
      setSearchError(null);

      try {
        const url = new URL(`${SKETCHFAB_API_BASE}/search`);
        url.searchParams.set('type', 'models');
        url.searchParams.set('downloadable', 'true');
        url.searchParams.set('count', '18');

        if (preset?.userFilter) {
          url.searchParams.set('user', preset.userFilter);
        } else {
          url.searchParams.set('sort_by', '-likeCount');
          if (preset?.minFaces) {
            url.searchParams.set('min_face_count', String(preset.minFaces));
          }
        }

        const effectiveQuery = query.trim() || preset?.query || '';
        if (effectiveQuery) {
          url.searchParams.set('q', effectiveQuery);
        }

        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Token ${SKETCHFAB_TOKEN}`,
          },
          signal,
        });

        if (!res.ok) {
          throw new Error(`Sketchfab API error (${res.status})`);
        }

        const json = (await res.json()) as { results?: SketchfabModelItem[] };
        const filtered = (json.results ?? []).filter(
          (item) =>
            item.isDownloadable &&
            !/\b(cartoon|stylized|anime|chibi|minecraft|roblox|voxel|monster|zombie)\b/i.test(
              item.name || ''
            )
        );
        setResults(filtered);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSearchError(
          (err as Error).message || 'Failed to query Sketchfab V3 Medical Cloud'
        );
      } finally {
        if (!signal?.aborted) {
          setIsSearching(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!showSketchfabModal) return;
    const controller = new AbortController();
    const activePreset = SEARCH_PRESETS.find((p) => p.id === activePresetId);
    void runSearch(queryInput, activePreset, controller.signal);
    return () => controller.abort();
  }, [showSketchfabModal, activePresetId, runSearch]); // run when modal opens or preset switches

  useEffect(() => {
    if (!showSketchfabModal) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSketchfabModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showSketchfabModal, setShowSketchfabModal]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = queryInput.trim();
    if (!cleaned) return;
    setActivePresetId('custom');
    void runSearch(cleaned, {
      id: 'custom',
      label: 'Custom',
      query: cleaned,
      minFaces: 5000,
    });
  };

  const handleStreamModel = async (item: SketchfabModelItem) => {
    setLoadingUid(item.uid);
    setSearchError(null);
    try {
      const res = await fetch(
        `${SKETCHFAB_API_BASE}/models/${item.uid}/download`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Token ${SKETCHFAB_TOKEN}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Could not obtain download link (${res.status})`);
      }

      const data = (await res.json()) as {
        glb?: { url?: string; size?: number };
      };
      const glbUrl = data?.glb?.url;
      if (!glbUrl) {
        throw new Error('This model does not expose a converted .GLB download.');
      }

      loadCustomGlb(glbUrl, `${item.name} (Sketchfab)`);
      setShowSketchfabModal(false);
    } catch (err) {
      setSearchError(
        (err as Error).message || 'Failed to stream model from Sketchfab.'
      );
    } finally {
      setLoadingUid(null);
    }
  };

  if (!showSketchfabModal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sketchfab 3D Medical Cloud Library"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowSketchfabModal(false);
        }
      }}
    >
      <div className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#09090e]/95 shadow-[0_30px_90px_rgba(0,0,0,0.96)]">
        {/* Modal Header */}
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/40 bg-sky-500/15 text-sky-300">
              <Cloud className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-bold text-white sm:text-base">
                  Sketchfab 3D Medical Cloud Library
                </h2>
                <span className="hidden rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-300 sm:inline-flex">
                  V3 API Authenticated
                </span>
              </div>
              <p className="truncate text-[11px] text-zinc-400">
                Search Z-Anatomy & downloadable clinical 3D .GLB scans and stream directly into the viewport.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSketchfabModal(false)}
            aria-label="Close Cloud Library"
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Search & Category Chips */}
        <div className="border-b border-white/10 bg-black/30 px-4 py-3 sm:px-6">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/15 bg-zinc-950/90 px-3 py-2 focus-within:border-sky-400/60">
              <Search className="h-4 w-4 shrink-0 text-sky-400" />
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search Sketchfab medical anatomy (e.g. Z-Anatomy, skull, cranial nerves, heart valve)..."
                className="w-full min-w-0 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none sm:text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/20 px-4 py-2 font-mono text-xs font-semibold text-sky-100 transition-colors hover:bg-sky-500/30 disabled:opacity-50"
            >
              {isSearching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              <span>Search</span>
            </button>
          </form>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {SEARCH_PRESETS.map((preset) => {
              const active = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setQueryInput('');
                    setActivePresetId(preset.id);
                  }}
                  className={cn(
                    'rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium transition-all',
                    active
                      ? 'border-sky-400/60 bg-sky-500/20 text-sky-200'
                      : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/25 hover:text-white'
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {searchError && (
            <div className="mt-2.5 rounded-lg border border-rose-400/40 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
              {searchError}
            </div>
          )}
        </div>

        {/* Results Grid */}
        <div className="min-h-0 flex-1 overflow-y-auto touch-pan-y p-4 sm:p-6">
          {isSearching && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
              <Loader2 className="h-7 w-7 animate-spin text-sky-400" />
              <p className="mt-3 font-mono text-xs uppercase tracking-wider">
                Querying Sketchfab 3D Medical Models...
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-400">
              No downloadable anatomical .GLB models matched this query.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((item) => {
                const thumbUrl = pickThumbnailUrl(item);
                const glbSizeLabel = formatBytes(item.archives?.glb?.size);
                const isLoadingItem = loadingUid === item.uid;
                const isOfficialZAnatomy =
                  item.user?.username?.toLowerCase() === 'z-anatomy';

                return (
                  <article
                    key={item.uid}
                    className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80 transition-all hover:border-sky-400/40 hover:bg-zinc-900/70"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-black">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={item.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-700">
                          <Cloud className="h-8 w-8" />
                        </div>
                      )}

                      <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1">
                        {isOfficialZAnatomy && (
                          <span className="inline-flex items-center gap-1 rounded border border-sky-400/50 bg-sky-950/90 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-sky-200 backdrop-blur-md">
                            <Sparkles className="h-2.5 w-2.5 text-sky-400" />
                            <span>Z-Anatomy</span>
                          </span>
                        )}
                        <span className="rounded border border-white/15 bg-black/75 px-1.5 py-0.5 font-mono text-[9px] text-zinc-200 backdrop-blur-md">
                          {formatFaces(item.faceCount)}
                        </span>
                        {glbSizeLabel && (
                          <span className="rounded border border-emerald-400/30 bg-emerald-950/80 px-1.5 py-0.5 font-mono text-[9px] text-emerald-200 backdrop-blur-md">
                            {glbSizeLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-3">
                      <div>
                        <h3 className="line-clamp-2 text-xs font-semibold text-white">
                          {item.name}
                        </h3>
                        <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-zinc-400">
                          <span className="inline-flex items-center gap-1 truncate">
                            <User className="h-3 w-3 shrink-0 text-zinc-500" />
                            <span className="truncate">
                              {item.user?.displayName ||
                                item.user?.username ||
                                'Author'}
                            </span>
                          </span>
                          {item.viewerUrl && (
                            <a
                              href={item.viewerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open on Sketchfab"
                              className="inline-flex shrink-0 items-center gap-0.5 text-zinc-500 transition-colors hover:text-sky-300"
                            >
                              <span>Web</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={Boolean(loadingUid)}
                        onClick={() => void handleStreamModel(item)}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-sky-100 transition-all hover:bg-sky-500/25 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoadingItem ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
                            <span>Streaming .GLB...</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5 text-sky-400" />
                            <span>Load into 3D Viewport</span>
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
