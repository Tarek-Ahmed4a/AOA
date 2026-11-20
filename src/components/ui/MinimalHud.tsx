import React, { useEffect, useRef, useState } from 'react';
import { type OfficialAtlasPresetId } from '../../store/useAnatomyStore';
import { AnatomicalSearchBar } from './AnatomicalSearchBar';

interface AtlasPresetOption {
  id: OfficialAtlasPresetId;
  label: string;
  shortLabel: string;
}

const ATLAS_PRESET_OPTIONS: AtlasPresetOption[] = [
  { id: 'zanatomy-full-body', label: 'Full Body (All Systems)', shortLabel: 'Full Body' },
  { id: 'zanatomy-skeletal', label: 'Skeletal System', shortLabel: 'Skeletal' },
  { id: 'zanatomy-muscular', label: 'Muscular System', shortLabel: 'Muscular' },
  { id: 'zanatomy-visceral', label: 'Visceral Organs', shortLabel: 'Visceral' },
  {
    id: 'zanatomy-cardiovascular',
    label: 'Cardiovascular System',
    shortLabel: 'Cardiovascular',
  },
  { id: 'zanatomy-nervous', label: 'Nervous System', shortLabel: 'Nervous' },
  {
    id: 'zanatomy-integumentary',
    label: 'Surface Regions',
    shortLabel: 'Surface Regions',
  },
  {
    id: 'nih-visible-human',
    label: 'NIH Visible Human (HRA 3D Body)',
    shortLabel: 'NIH Visible Human',
  },
];
import {
  Activity,
  ArrowLeft,
  Bone,
  Brain,
  Crosshair,
  Dumbbell,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Focus,
  HeartPulse,
  Layers,
  RotateCcw,
  Scan,
  Scissors,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import {
  ANATOMICAL_SYSTEMS,
  SYSTEM_DISPLAY_ORDER,
} from '../../config/anatomicalSystems';
import { cn } from '../../lib/utils';
import {
  cursorCoords,
  useAnatomyStore,
  useAnatomyStoreApi,
  useAppNavigationStore,
  type AnatomicalSystem,
  type SlicingPlaneAxis,
} from '../../store/useAnatomyStore';

const SYSTEM_ICONS: Record<
  AnatomicalSystem,
  React.ComponentType<{ className?: string }>
> = {
  integumentary: Shield,
  skeletal: Bone,
  muscular: Dumbbell,
  visceral: Activity,
  cardiovascular: HeartPulse,
  nervous: Brain,
};

const SLICE_PLANES: { id: SlicingPlaneAxis; label: string; axis: string }[] = [
  { id: 'sagittal', label: 'Sagittal', axis: 'X' },
  { id: 'coronal', label: 'Coronal', axis: 'Z' },
  { id: 'axial', label: 'Axial', axis: 'Y' },
];

export const MinimalHud: React.FC = () => {
  const [mobileDockOpen, setMobileDockOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const hoveredPart = useAnatomyStore((s) => s.hoveredPart);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const isTouchInteraction = useAnatomyStore((s) => s.isTouchInteraction);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity);
  const showLayerManager = useAnatomyStore((s) => s.showLayerManager);
  const cameraPresetView = useAnatomyStore((s) => s.cameraPresetView);

  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const showSurgicalLandmarks = useAnatomyStore((s) => s.showSurgicalLandmarks);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);
  const slicing = useAnatomyStore((s) => s.slicing);
  const activeTab = useAppNavigationStore((s) => s.activeTab);
  const setActiveTab = useAppNavigationStore((s) => s.setActiveTab);
  const explorerOpenedModel = useAppNavigationStore(
    (s) => s.explorerOpenedModel
  );
  const setExplorerOpenedModel = useAppNavigationStore(
    (s) => s.setExplorerOpenedModel
  );
  const storeApi = useAnatomyStoreApi();
  const isNativeViewportActive =
    activeTab === 'master-atlas' ||
    (activeTab === 'cloud-explorer' && explorerOpenedModel?.kind === 'native');

  const toggleSystem = useAnatomyStore((s) => s.toggleSystem);
  const toggleLayerManager = useAnatomyStore((s) => s.toggleLayerManager);
  const resetView = useAnatomyStore((s) => s.resetView);
  const selectPart = useAnatomyStore((s) => s.selectPart);
  const focusSelectedPart = useAnatomyStore((s) => s.focusSelectedPart);

  const peelSelectedPart = useAnatomyStore((s) => s.peelSelectedPart);
  const undoLastPeel = useAnatomyStore((s) => s.undoLastPeel);
  const restoreAllParts = useAnatomyStore((s) => s.restoreAllParts);
  const toggleIsolateSelected = useAnatomyStore((s) => s.toggleIsolateSelected);
  const toggleXrayGhost = useAnatomyStore((s) => s.toggleXrayGhost);
  const toggleSurgicalLandmarks = useAnatomyStore(
    (s) => s.toggleSurgicalLandmarks
  );
  const setExplodeFactor = useAnatomyStore((s) => s.setExplodeFactor);
  const partOpacityOverrides = useAnatomyStore((s) => s.partOpacityOverrides);
  const setPartOpacity = useAnatomyStore((s) => s.setPartOpacity);
  const resetPartOpacity = useAnatomyStore((s) => s.resetPartOpacity);
  const landmarkFilterMode = useAnatomyStore((s) => s.landmarkFilterMode);
  const setLandmarkFilterMode = useAnatomyStore((s) => s.setLandmarkFilterMode);
  const updateSlicing = useAnatomyStore((s) => s.updateSlicing);
  const resetSlicing = useAnatomyStore((s) => s.resetSlicing);

  // Global surgical keyboard shortcuts (ignoring browser modifier combos and text inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          (target.tagName === 'INPUT' &&
            (target as HTMLInputElement).type !== 'range'))
      ) {
        return;
      }

      const navState = useAppNavigationStore.getState();
      const isNativeActive =
        navState.activeTab === 'master-atlas' ||
        (navState.activeTab === 'cloud-explorer' &&
          navState.explorerOpenedModel?.kind === 'native');
      if (!isNativeActive) return;
      const state = storeApi.getState();
      const key = e.key.toLowerCase();

      if (key === 'f' && state.selectedPart) {
        e.preventDefault();
        state.focusSelectedPart();
      } else if (e.key === 'Escape') {
        if (state.showLayerManager) {
          e.preventDefault();
          state.setShowLayerManager(false);
        } else if (state.selectedPart) {
          e.preventDefault();
          state.selectPart(null);
        }
      } else if (key === 'i') {
        e.preventDefault();
        state.toggleIsolateSelected();
      } else if (key === 'h' && state.selectedPart) {
        e.preventDefault();
        state.peelSelectedPart();
      } else if (key === 'z') {
        e.preventDefault();
        state.undoLastPeel();
      } else if (key === 'x') {
        e.preventDefault();
        state.toggleXrayGhost();
      } else if (key === 's') {
        e.preventDefault();
        state.updateSlicing({ enabled: !state.slicing.enabled });
      } else if (key === 'r') {
        e.preventDefault();
        state.restoreAllParts();
      } else if (key === 'l') {
        e.preventDefault();
        state.toggleSurgicalLandmarks();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [storeApi]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      cursorCoords.x = e.clientX;
      cursorCoords.y = e.clientY;
      if (tooltipRef.current) {
        const x = Math.max(8, Math.min(e.clientX + 14, window.innerWidth - 250));
        const y = Math.max(8, Math.min(e.clientY + 14, window.innerHeight - 96));
        tooltipRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const setActiveAtlasPreset = useAnatomyStore((s) => s.setActiveAtlasPreset);
  const customGlbUrl = useAnatomyStore((s) => s.customGlbUrl);

  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!presetMenuOpen) return;
    const handleOutside = (e: PointerEvent) => {
      if (
        presetMenuRef.current &&
        !presetMenuRef.current.contains(e.target as Node)
      ) {
        setPresetMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPresetMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [presetMenuOpen]);

  const activePresetOption =
    ATLAS_PRESET_OPTIONS.find((opt) => opt.id === activeAtlasPreset) ??
    ATLAS_PRESET_OPTIONS[0];

  const activeSelectedPart = useAnatomyStore((s) => s.selectedPart);
  const isHoveringSelected = Boolean(
    hoveredPart &&
      activeSelectedPart &&
      (hoveredPart.meshUuid === activeSelectedPart.meshUuid ||
        hoveredPart.rawName === activeSelectedPart.rawName ||
        hoveredPart.cleanName.trim().toLowerCase() ===
          activeSelectedPart.cleanName.trim().toLowerCase() ||
        (Boolean(hoveredPart.organGroupId) &&
          hoveredPart.organGroupId === activeSelectedPart.organGroupId))
  );
  const showFloatingTooltip =
    Boolean(hoveredPart) && !isTouchInteraction && !isHoveringSelected;
  const maxTooltipX =
    typeof window !== 'undefined'
      ? window.innerWidth - 250
      : cursorCoords.x + 14;
  const maxTooltipY =
    typeof window !== 'undefined'
      ? window.innerHeight - 96
      : cursorCoords.y + 14;
  const initialTooltipX = Math.max(8, Math.min(cursorCoords.x + 14, maxTooltipX));
  const initialTooltipY = Math.max(8, Math.min(cursorCoords.y + 14, maxTooltipY));

  const isSelectedIsolated =
    Boolean(selectedPart) &&
    (isolatedPartId === selectedPart?.meshUuid ||
      isolatedPartId === selectedPart?.rawName);
  const hasAnyDissectionActive =
    hiddenPartIds.length > 0 ||
    isolatedPartId !== null ||
    xrayGhostMode ||
    showSurgicalLandmarks ||
    explodeFactor > 0 ||
    Object.keys(partOpacityOverrides).length > 0;

  const isNon3DTab = activeTab === 'pdf-books' || activeTab === 'feedback';

  return (
    <>
      {/* Single Unified Top Header Bar (horizontally scrollable on mobile phones, zero squish/overflow) */}
      <header
        aria-label="Primary Studio Top Navigation"
        className={cn(
          'pointer-events-auto fixed left-0 right-0 z-50 flex items-center overflow-x-auto overflow-y-hidden flex-nowrap whitespace-nowrap touch-pan-x no-scrollbar scroll-smooth px-2 gap-2 md:left-3 md:right-3 md:px-0 md:overflow-visible',
          isNon3DTab
            ? 'top-1.5 h-10 justify-center md:top-2 md:h-11 md:justify-between'
            : 'top-2 h-10 justify-between md:top-3 md:h-12'
        )}
      >
        {/* Top-Left Zone */}
        {isNon3DTab ? (
          <div className="hidden md:block md:flex-1" />
        ) : (
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 md:min-w-0 md:flex-1">
              {activeTab === 'cloud-explorer' &&
              explorerOpenedModel?.kind === 'native' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setExplorerOpenedModel(null)}
                    aria-label="Back to Explorer search catalog"
                    className="flex h-8 md:h-9 shrink-0 items-center gap-1.5 rounded-full border border-sky-400/35 bg-[#0a0a0c]/90 px-2.5 md:px-3 font-mono text-[10px] font-semibold text-sky-200 shadow-2xl backdrop-blur-md transition-colors hover:border-sky-400/60 hover:bg-sky-500/15 hover:text-white active:scale-95"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                    <span>Back to Results</span>
                  </button>
                  <div
                    className={`${
                      explorerOpenedModel.isFallbackSubstitution
                        ? 'flex border-amber-400/35 bg-amber-950/60'
                        : 'hidden sm:flex border-white/10 bg-[#0a0a0c]/90'
                    } h-8 md:h-9 min-w-0 max-w-[290px] items-center gap-1.5 rounded-full border px-2.5 shadow-2xl backdrop-blur-md`}
                    title={explorerOpenedModel.fallbackReason ?? explorerOpenedModel.title}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                        explorerOpenedModel.isFallbackSubstitution
                          ? 'bg-amber-400'
                          : 'bg-sky-400'
                      }`}
                    />
                    <span className="truncate font-mono text-[10px] font-medium text-zinc-200">
                      {explorerOpenedModel.title}
                    </span>
                    {explorerOpenedModel.isFallbackSubstitution && (
                      <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
                        Fallback Atlas Model
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="hidden md:flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-[#0a0a0c]/90 px-3 shadow-2xl backdrop-blur-md">
                  <img
                    src="./icon.png"
                    alt="Anatomy Atlas 3D"
                    className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                  />
                  <span className="whitespace-nowrap font-mono text-[10px] font-semibold tracking-[0.12em] text-zinc-200">
                    ATLAS 3D
                  </span>
                </div>
              )}

              {isNativeViewportActive && !customGlbUrl && (
                <div ref={presetMenuRef} className="relative shrink-0 md:min-w-0">
                  <button
                    type="button"
                    onClick={() => setPresetMenuOpen((v) => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={presetMenuOpen}
                    aria-label="Atlas Preset Selector"
                    className={cn(
                      'flex h-8 md:h-9 items-center gap-1 md:gap-1.5 whitespace-nowrap rounded-full border bg-[#0a0a0c]/90 px-2 md:px-3 font-mono text-[9.5px] md:text-[10px] shadow-2xl backdrop-blur-md transition-colors',
                      presetMenuOpen
                        ? 'border-sky-500/45 text-white ring-1 ring-sky-500/20'
                        : 'border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
                    )}
                  >
                    <span className="hidden text-zinc-400 xl:inline">
                      Atlas Preset:
                    </span>
                    <span className="max-w-[74px] sm:max-w-[110px] md:max-w-[130px] truncate font-semibold text-sky-400 2xl:max-w-none">
                      {activePresetOption.shortLabel}
                    </span>
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className={cn(
                        'h-3 w-3 shrink-0 text-zinc-400 transition-transform duration-150',
                        presetMenuOpen && 'rotate-180 text-sky-400'
                      )}
                    >
                      <path
                        d="M4 6l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {presetMenuOpen && (
                    <div
                      role="listbox"
                      aria-label="Official 3D Atlas Module Switcher"
                      className="fixed left-2 top-[50px] z-50 w-64 overflow-hidden rounded-xl border border-white/15 bg-[#0a0a0c]/95 p-1.5 shadow-[0_24px_64px_rgba(0,0,0,0.95)] backdrop-blur-xl md:absolute md:left-0 md:top-[calc(100%+6px)]"
                    >
                      <div className="mb-1 border-b border-white/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
                        Official 3D Atlas Presets
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {ATLAS_PRESET_OPTIONS.map((preset) => {
                          const active = activeAtlasPreset === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => {
                                setActiveAtlasPreset(preset.id);
                                setPresetMenuOpen(false);
                              }}
                              className={cn(
                                'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left font-mono text-[10px] font-medium transition-all',
                                active
                                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                                  : 'border-transparent text-zinc-300 hover:bg-white/5 hover:text-white'
                              )}
                            >
                              <span className="truncate">{preset.label}</span>
                              {active && (
                                <svg
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  aria-hidden="true"
                                  className="h-3 w-3 shrink-0 text-sky-400"
                                >
                                  <path
                                    d="M3.5 8.5l3 3 6-6.5"
                                    stroke="currentColor"
                                    strokeWidth="1.75"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
        </div>
        )}

        {/* Top-Center Zone: 3-Tab Minimalist Cockpit Switcher */}
        <nav
          role="tablist"
          aria-label="Workspace View Switcher"
          dir="ltr"
          className="pointer-events-auto flex shrink-0 items-center gap-0.5 md:gap-1 rounded-full border border-white/10 bg-[#0a0a0c]/90 p-0.5 md:p-1 shadow-2xl backdrop-blur-md"
        >
          {(
            [
              {
                id: 'master-atlas',
                mobileLabel: '3D Atlas',
                label: '3D Master Atlas',
              },
              {
                id: 'cloud-explorer',
                mobileLabel: 'Explorer',
                label: 'Live 3D Explorer',
              },
              {
                id: 'pdf-books',
                mobileLabel: 'Books',
                label: 'Reference Books (PDF)',
              },
              {
                id: 'feedback',
                mobileLabel: 'Feedback',
                label: 'Feedback & Problems',
              },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[9.5px] md:px-2.5 md:text-[10.5px] 2xl:px-3 2xl:text-[11px] font-medium tracking-wide transition-all active:scale-95',
                  isActive
                    ? 'border-sky-500/40 bg-sky-500/15 text-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.16)]'
                    : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                )}
              >
                <span className="md:hidden">{tab.mobileLabel}</span>
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Top-Right Zone */}
        {isNon3DTab ? (
          <div className="hidden md:block md:flex-1" />
        ) : (
          <div className="pointer-events-auto flex shrink-0 items-center justify-end gap-1.5 md:min-w-0 md:flex-1">
            {isNativeViewportActive && <AnatomicalSearchBar />}
          </div>
        )}
      </header>

      {isNativeViewportActive && (
      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-2 pt-14 md:p-4 md:pt-16">
      {/* Floating Cursor Tooltip (Mouse Hover Only) */}
      {showFloatingTooltip && hoveredPart && (
        <div
          ref={tooltipRef}
          style={{
            transform: `translate3d(${initialTooltipX}px, ${initialTooltipY}px, 0)`,
          }}
          className="pointer-events-none fixed left-0 top-0 z-30 w-56 rounded-lg border border-white/15 bg-zinc-950/90 px-3 py-2 shadow-2xl backdrop-blur-md"
        >
          <div className="truncate text-xs font-semibold text-white">
            {hoveredPart.cleanName}
          </div>
          <div className="truncate font-serif text-[11px] italic text-zinc-400">
            {hoveredPart.latinName}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-200">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor:
                    ANATOMICAL_SYSTEMS[hoveredPart.system].accentColor,
                }}
              />
              {ANATOMICAL_SYSTEMS[hoveredPart.system].label}
            </span>
            <span className="rounded border border-sky-400/20 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[9px] text-sky-300">
              {hoveredPart.laterality === 'Median / Unpaired'
                ? 'Median'
                : hoveredPart.laterality}
            </span>
          </div>
        </div>
      )}

      {/* Left Column: Collapsed Dissection Pill on <768px, Permanent Suite on >=768px */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-1.5 md:gap-2">
          {/* Mobile (<768px) Collapsed Dissection Toggle Pill */}
          <button
            type="button"
            onClick={() => setMobileDockOpen((v) => !v)}
            aria-expanded={mobileDockOpen}
            className={cn(
              'pointer-events-auto md:hidden flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-mono text-[10.5px] font-medium backdrop-blur-md shadow-xl transition-colors active:scale-95',
              mobileDockOpen || slicing.enabled || hasAnyDissectionActive
                ? 'border-sky-400/50 bg-zinc-950/90 text-sky-200'
                : 'border-white/15 bg-zinc-950/80 text-zinc-200'
            )}
          >
            <Scissors className="h-3 w-3 text-sky-400" />
            <span>Dissect Tools</span>
            <span aria-hidden="true" className="text-[9px] text-zinc-400">
              {mobileDockOpen ? '▴' : '▾'}
            </span>
          </button>

          {/* Left-Docked Surgical Dissection & Cross-Section Slicer Suite */}
          <div
            className={cn(
              'pointer-events-auto w-[215px] md:w-[276px] max-h-[60dvh] md:max-h-[calc(100dvh-152px)] overflow-y-auto touch-pan-y flex-col gap-2',
              mobileDockOpen ? 'flex' : 'hidden md:flex'
            )}
          >
            {/* Surgical Dissection Bar */}
            <section
              aria-label="Surgical Dissection Suite"
              className="rounded-xl border border-white/15 bg-zinc-950/88 md:bg-zinc-950/80 p-2 md:p-3 backdrop-blur-md shadow-2xl"
            >
              <div className="mb-2 flex items-center justify-between gap-1.5">
                <span className="font-mono text-[9.5px] md:text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Surgical Dissection
                </span>
                <div className="flex items-center gap-1">
                  {hiddenPartIds.length > 0 && (
                    <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] text-amber-200">
                      Hidden: {hiddenPartIds.length}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setMobileDockOpen(false)}
                    aria-label="Collapse Dissection Tools"
                    className="md:hidden rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {/* Isolate Organ [I] */}
                <button
                  type="button"
                  onClick={toggleIsolateSelected}
                  disabled={!selectedPart && isolatedPartId === null}
                  title="Isolate selected organ [I]"
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all',
                    isSelectedIsolated || isolatedPartId !== null
                      ? 'border-sky-400/50 bg-sky-500/20 text-sky-100'
                      : selectedPart
                      ? 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                      : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600'
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Focus className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {isolatedPartId ? 'Unisolate' : 'Isolate'}
                    </span>
                  </span>
                  <kbd className="font-mono text-[9px] text-zinc-400">I</kbd>
                </button>

                {/* Peel / Hide [H] */}
                <button
                  type="button"
                  onClick={peelSelectedPart}
                  disabled={!selectedPart}
                  title="Peel / hide selected structure [H]"
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all',
                    selectedPart
                      ? 'border-white/10 bg-white/5 text-zinc-200 hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-100'
                      : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600'
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <EyeOff className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Peel</span>
                  </span>
                  <kbd className="font-mono text-[9px] text-zinc-400">H</kbd>
                </button>

                {/* Undo Peel [Z] */}
                <button
                  type="button"
                  onClick={undoLastPeel}
                  disabled={hiddenPartIds.length === 0}
                  title="Undo last peel [Z]"
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all',
                    hiddenPartIds.length > 0
                      ? 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                      : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600'
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Undo2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Undo Peel</span>
                  </span>
                  <kbd className="font-mono text-[9px] text-zinc-400">Z</kbd>
                </button>

                {/* X-Ray Context [X] */}
                <button
                  type="button"
                  onClick={toggleXrayGhost}
                  aria-pressed={xrayGhostMode}
                  title="Toggle translucent X-Ray anatomical context [X]"
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all',
                    xrayGhostMode
                      ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Scan className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">X-Ray</span>
                  </span>
                  <kbd className="font-mono text-[9px] text-zinc-400">X</kbd>
                </button>

                {/* Slice Tool [S] */}
                <button
                  type="button"
                  onClick={() => updateSlicing({ enabled: !slicing.enabled })}
                  aria-pressed={slicing.enabled}
                  title="Toggle Cross-Section Slice Tool [S]"
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all',
                    slicing.enabled
                      ? 'border-sky-400/55 bg-sky-500/25 text-white shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                      : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Scissors className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Slice Tool</span>
                  </span>
                  <kbd className="font-mono text-[9px] text-zinc-400">S</kbd>
                </button>

                {/* Surgical & Anatomical Landmarks [L] */}
                <button
                  type="button"
                  onClick={toggleSurgicalLandmarks}
                  aria-pressed={showSurgicalLandmarks}
                  data-testid="landmarks-toggle-btn"
                  title="Toggle NIH HRA 3D Anatomical & Surgical Landmarks [L]"
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all',
                    showSurgicalLandmarks
                      ? 'border-amber-400/65 bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-cyan-500/25 text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.28)]'
                      : 'border-white/10 bg-white/5 text-zinc-200 hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-amber-100'
                  )}
                >
                  <span className="flex items-center gap-1 truncate">
                    <span aria-hidden="true" className="text-[11px] leading-none">
                      🎯
                    </span>
                    <span className="truncate">Landmarks</span>
                  </span>
                  <kbd
                    className={cn(
                      'font-mono text-[9px]',
                      showSurgicalLandmarks ? 'text-cyan-200' : 'text-zinc-400'
                    )}
                  >
                    L
                  </kbd>
                </button>

                {/* Restore All [R] */}
                <button
                  type="button"
                  onClick={restoreAllParts}
                  disabled={!hasAnyDissectionActive}
                  title="Restore all hidden, isolated, landmark & exploded structures [R]"
                  className={cn(
                    'col-span-2 flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all',
                    hasAnyDissectionActive
                      ? 'border-white/10 bg-white/5 text-zinc-200 hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-100'
                      : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600'
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Restore All</span>
                  </span>
                  <kbd className="font-mono text-[9px] text-zinc-400">R</kbd>
                </button>
              </div>

              {/* Layer 3 Landmark Filter Pill (when Landmarks [L] is ON) */}
              {showSurgicalLandmarks && (
                <div className="mt-2 flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-1">
                  <button
                    type="button"
                    onClick={() => setLandmarkFilterMode('all')}
                    className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition ${
                      landmarkFilterMode === 'all'
                        ? 'bg-amber-500/30 text-amber-100 shadow-sm'
                        : 'text-amber-200/70 hover:bg-amber-500/15 hover:text-amber-100'
                    }`}
                  >
                    🌐 All Active Landmarks
                  </button>
                  <button
                    type="button"
                    onClick={() => setLandmarkFilterMode('selected')}
                    disabled={!selectedPart}
                    title={
                      selectedPart
                        ? 'Show only landmarks anchored to the selected structure'
                        : 'Select a structure first to filter landmarks'
                    }
                    className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      landmarkFilterMode === 'selected'
                        ? 'bg-emerald-500/30 text-emerald-100 shadow-sm'
                        : 'text-amber-200/70 hover:bg-emerald-500/15 hover:text-emerald-100'
                    }`}
                  >
                    🎯 Selected Part Only
                  </button>
                </div>
              )}

              {/* Selected Part Independent Opacity Slider (5% - 100%) */}
              {selectedPart &&
                (() => {
                  const currentPartOpacity =
                    partOpacityOverrides[selectedPart.meshUuid] ??
                    partOpacityOverrides[selectedPart.rawName] ??
                    (selectedPart.organGroupId
                      ? partOpacityOverrides[selectedPart.organGroupId]
                      : undefined) ??
                    1.0;
                  const opacityPct = Math.round(currentPartOpacity * 100);
                  const isOverridden = opacityPct < 100;
                  return (
                    <div className="mt-2.5 border-t border-white/10 pt-2">
                      <div className="mb-1 flex items-center justify-between gap-1.5 text-[10px] font-medium text-slate-300">
                        <span className="truncate">
                          💧 PART OPACITY: {selectedPart.cleanName}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <span
                            className={`font-mono ${
                              isOverridden ? 'text-cyan-300' : 'text-slate-400'
                            }`}
                          >
                            {opacityPct}%
                          </span>
                          {isOverridden && (
                            <button
                              type="button"
                              onClick={() =>
                                resetPartOpacity(selectedPart.meshUuid)
                              }
                              className="rounded border border-cyan-500/40 bg-cyan-500/15 px-1 py-0.2 text-[9px] text-cyan-200 hover:bg-cyan-500/25"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        step={1}
                        value={opacityPct}
                        onChange={(e) =>
                          setPartOpacity(
                            selectedPart.meshUuid,
                            Number(e.target.value) / 100
                          )
                        }
                        aria-label="Selected Part Opacity"
                        className="h-1.5 w-full cursor-pointer accent-cyan-400"
                      />
                    </div>
                  );
                })()}

              {/* Explode Slider */}
              <div className="mt-2.5 border-t border-white/10 pt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    <Layers className="h-3 w-3 text-sky-400" />
                    Explode View
                  </span>
                  <span className="font-mono text-[10px] text-zinc-200">
                    {Math.round(explodeFactor * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={explodeFactor}
                  onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
                  aria-label="Explode View Factor"
                  className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-sky-400"
                />
              </div>
            </section>

            {/* Cross-Section Slicer Panel */}
            {slicing.enabled && (
              <section
                aria-label="Cross-Section Slicer"
                className="rounded-xl border border-sky-400/25 bg-zinc-950/90 p-3 backdrop-blur-md shadow-2xl"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">
                    <Scissors className="h-3 w-3" />
                    Cross-Section Slicer
                  </span>
                  <button
                    type="button"
                    onClick={resetSlicing}
                    title="Reset & close slicer"
                    className="rounded px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Off
                  </button>
                </div>

                {/* Plane Selector */}
                <div className="grid grid-cols-3 gap-1">
                  {SLICE_PLANES.map((p) => {
                    const active = slicing.plane === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => updateSlicing({ plane: p.id })}
                        className={cn(
                          'rounded-lg border px-1.5 py-1 text-[10px] font-medium transition-all',
                          active
                            ? 'border-sky-400/50 bg-sky-500/25 text-white'
                            : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                        )}
                      >
                        {p.label}{' '}
                        <span className="font-mono text-[9px] text-sky-300">
                          ({p.axis})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Scope Toggle */}
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => updateSlicing({ scope: 'all' })}
                    className={cn(
                      'rounded-lg border px-2 py-1 text-[10px] font-medium transition-all',
                      slicing.scope === 'all'
                        ? 'border-sky-400/50 bg-sky-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                    )}
                  >
                    Whole Body
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSlicing({ scope: 'selected' })}
                    className={cn(
                      'rounded-lg border px-2 py-1 text-[10px] font-medium transition-all',
                      slicing.scope === 'selected'
                        ? 'border-sky-400/50 bg-sky-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                    )}
                  >
                    Selected Organ
                  </button>
                </div>

                {slicing.scope === 'selected' && !selectedPart && (
                  <p className="mt-1.5 font-mono text-[9px] text-amber-300/90">
                    Select any structure to slice locally.
                  </p>
                )}

                {/* Cut Depth Slider */}
                <div className="mt-2.5">
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="uppercase tracking-wider text-zinc-400">
                      Cut Depth
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sky-300">
                        {slicing.offset >= 0 ? '+' : ''}
                        {slicing.offset.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateSlicing({ offset: 0 })}
                        className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-300 hover:bg-white/15 hover:text-white"
                      >
                        Center (0)
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={slicing.offset}
                    onChange={(e) =>
                      updateSlicing({ offset: parseFloat(e.target.value) })
                    }
                    aria-label="Cut Depth Offset"
                    className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-sky-400"
                  />
                </div>

                {/* Flip Cut Direction + Show Laser Plane */}
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
                  <button
                    type="button"
                    onClick={() => updateSlicing({ invert: !slicing.invert })}
                    aria-pressed={slicing.invert}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition-all',
                      slicing.invert
                        ? 'border-sky-400/50 bg-sky-500/20 text-sky-100'
                        : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                    )}
                  >
                    <FlipHorizontal2 className="h-3 w-3" />
                    <span>Invert</span>
                  </button>

                  <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-zinc-300 select-none">
                    <input
                      type="checkbox"
                      checked={slicing.showHelper}
                      onChange={(e) =>
                        updateSlicing({ showHelper: e.target.checked })
                      }
                      className="h-3 w-3 rounded border-white/20 bg-zinc-900 accent-sky-400"
                    />
                    <Eye className="h-3 w-3 text-sky-400" />
                    <span>Laser Plane</span>
                  </label>
                </div>
              </section>
            )}

            {/* Compact Locked / Hovered Structure Quick Target (only when active, docked below Slicer) */}
            {(selectedPart || hoveredPart) && (
              <div className="rounded-xl border border-white/10 bg-zinc-950/85 px-3 py-2 backdrop-blur-md shadow-xl">
                {hoveredPart && (
                  <div className="flex items-baseline gap-2 font-mono text-[11px]">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500">
                      HOVER
                    </span>
                    <span className="truncate font-medium text-sky-300">
                      {hoveredPart.cleanName}
                    </span>
                  </div>
                )}
                {selectedPart && (
                  <div
                    className={cn(
                      'flex items-center justify-between gap-2',
                      hoveredPart && 'mt-1.5 border-t border-white/10 pt-1.5'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-1.5 font-mono text-[11px]">
                      <span className="text-[9px] uppercase tracking-wider text-sky-400">
                        LOCK
                      </span>
                      <span className="truncate font-semibold text-white">
                        {selectedPart.cleanName}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={focusSelectedPart}
                        title="Focus camera on selected organ (F)"
                        className="inline-flex items-center gap-1 rounded border border-sky-400/35 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[9px] font-medium text-sky-200 transition-all hover:bg-sky-500/25 hover:text-white active:scale-95"
                      >
                        <Crosshair className="h-2.5 w-2.5" />
                        <span>F</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => selectPart(null)}
                        title="Deselect [Esc]"
                        className="rounded p-0.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom-Center Floating System Control Bar (Single horizontally-scrollable row on <768px) */}
      <div className="flex justify-center pb-1 sm:pb-2">
        <nav
          aria-label="Anatomical Systems Control"
          className="pointer-events-auto flex max-w-[calc(100vw-1rem)] flex-nowrap items-center justify-start md:justify-center gap-1 md:gap-1.5 overflow-x-auto no-scrollbar rounded-full border border-white/15 bg-zinc-950/80 px-1.5 py-1 md:p-1.5 backdrop-blur-md shadow-2xl"
        >
          {SYSTEM_DISPLAY_ORDER.map((systemId) => {
            const sys = ANATOMICAL_SYSTEMS[systemId];
            const isActive = activeSystems[systemId];
            const opacityVal = systemOpacity[systemId];
            const Icon = SYSTEM_ICONS[systemId];

            return (
              <button
                key={systemId}
                type="button"
                onClick={() => toggleSystem(systemId)}
                aria-pressed={isActive}
                title={`Toggle ${sys.label} System (${Math.round(
                  opacityVal * 100
                )}% opacity)`}
                className={cn(
                  'group flex shrink-0 whitespace-nowrap items-center gap-1 md:gap-1.5 rounded-full px-2 py-1 md:px-3 md:py-1.5 text-[11px] md:text-xs font-medium transition-all duration-150',
                  isActive
                    ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                    : 'bg-transparent text-zinc-500 border border-transparent hover:text-zinc-300 hover:bg-white/5'
                )}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full transition-opacity"
                  style={{
                    backgroundColor: sys.accentColor,
                    opacity: isActive ? Math.max(0.25, opacityVal) : 0.2,
                  }}
                />
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">{sys.label}</span>
                <span className="md:hidden font-mono text-[10px] tracking-wider">
                  {sys.shortLabel}
                </span>
              </button>
            );
          })}

          <div className="mx-0.5 h-5 w-px shrink-0 bg-white/15" aria-hidden="true" />

          <button
            type="button"
            onClick={toggleLayerManager}
            aria-pressed={showLayerManager}
            title="Layers, Opacity Presets & Anatomical Views"
            className={cn(
              'flex shrink-0 whitespace-nowrap items-center gap-1 md:gap-1.5 rounded-full border px-2 py-1 md:px-3 md:py-1.5 text-[11px] md:text-xs font-medium transition-all duration-150 active:scale-95',
              showLayerManager
                ? 'border-sky-400/60 bg-sky-500/25 text-white shadow-[0_0_14px_rgba(56,189,248,0.25)]'
                : 'border-white/15 bg-white/5 text-zinc-200 hover:bg-white/15 hover:text-white'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            <span className="hidden md:inline">Layers & Views</span>
            <span className="md:hidden font-mono text-[10px]">
              {cameraPresetView ? cameraPresetView.slice(0, 3).toUpperCase() : 'LAYERS'}
            </span>
          </button>

          <button
            type="button"
            onClick={resetView}
            title="Reset Camera"
            className="flex shrink-0 whitespace-nowrap items-center gap-1 md:gap-1.5 rounded-full border border-white/15 bg-white/5 px-2 py-1 md:px-3 md:py-1.5 text-[11px] md:text-xs font-medium text-zinc-200 transition-all duration-150 hover:bg-white/15 hover:text-white active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden md:inline">Reset Camera</span>
            <span className="md:hidden font-mono text-[10px]">RESET</span>
          </button>
        </nav>
      </div>
    </div>
      )}
    </>
  );
};
