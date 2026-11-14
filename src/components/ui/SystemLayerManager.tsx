import React from 'react';
import {
  Activity,
  Bone,
  Brain,
  Compass,
  Dumbbell,
  Eye,
  EyeOff,
  HeartPulse,
  Layers,
  Shield,
  X,
} from 'lucide-react';
import {
  ANATOMICAL_SYSTEMS,
  SYSTEM_DISPLAY_ORDER,
} from '../../config/anatomicalSystems';
import { cn } from '../../lib/utils';
import {
  useAnatomyStore,
  type AnatomicalSystem,
  type CameraPresetView,
  type ClinicalPreset,
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

const CLINICAL_PRESETS: {
  id: ClinicalPreset;
  label: string;
  desc: string;
}[] = [
  { id: 'full', label: 'Full Body', desc: 'All 100%' },
  {
    id: 'neuro-vascular',
    label: 'Neuro-Vascular',
    desc: 'Nerv+Cardio, Bone 20%',
  },
  {
    id: 'cardio-thoracic',
    label: 'Cardio-Thoracic',
    desc: 'Visc+Cardio, Bone 25%',
  },
  {
    id: 'musculoskeletal',
    label: 'Musculoskeletal',
    desc: 'Bone 100%, Musc 50%',
  },
];

const ORIENTATION_COMPASS: {
  id: CameraPresetView;
  shortLabel: string;
  fullLabel: string;
}[] = [
  { id: 'anterior', shortLabel: 'ANT', fullLabel: 'Anterior (Front)' },
  { id: 'posterior', shortLabel: 'POST', fullLabel: 'Posterior (Back)' },
  { id: 'left', shortLabel: 'LAT-L', fullLabel: 'Anatomical Left' },
  { id: 'right', shortLabel: 'LAT-R', fullLabel: 'Anatomical Right' },
  { id: 'superior', shortLabel: 'SUP', fullLabel: 'Superior (Top)' },
  { id: 'inferior', shortLabel: 'INF', fullLabel: 'Inferior (Bottom)' },
];

export const SystemLayerManager: React.FC = () => {
  const showLayerManager = useAnatomyStore((s) => s.showLayerManager);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity);
  const cameraPresetView = useAnatomyStore((s) => s.cameraPresetView);

  const setShowLayerManager = useAnatomyStore((s) => s.setShowLayerManager);
  const toggleSystem = useAnatomyStore((s) => s.toggleSystem);
  const setSystemOpacity = useAnatomyStore((s) => s.setSystemOpacity);
  const soloSystem = useAnatomyStore((s) => s.soloSystem);
  const applyClinicalPreset = useAnatomyStore((s) => s.applyClinicalPreset);
  const triggerCameraPreset = useAnatomyStore((s) => s.triggerCameraPreset);

  if (!showLayerManager) {
    return null;
  }

  return (
    <section
      aria-label="System Layer & Opacity Matrix"
      className="pointer-events-auto fixed bottom-20 left-1/2 z-30 w-[calc(100dvw-1.5rem)] max-w-[430px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/15 bg-[#08080e]/92 shadow-[0_24px_64px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:bottom-20"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-sky-400" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-200">
            Layer Opacity Matrix & Views
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowLayerManager(false)}
          aria-label="Close Layers & Views"
          title="Close [L]"
          className="rounded-lg border border-white/10 bg-white/5 p-1 text-zinc-400 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="max-h-[65dvh] space-y-3 overflow-y-auto touch-pan-y p-3.5">
        {/* Quick Clinical Presets */}
        <div>
          <div className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Quick Clinical Study Presets
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {CLINICAL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyClinicalPreset(preset.id)}
                className="flex flex-col items-start rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left transition-all hover:border-sky-400/40 hover:bg-sky-500/15 active:scale-[0.98]"
              >
                <span className="text-[11px] font-semibold text-white">
                  {preset.label}
                </span>
                <span className="font-mono text-[9px] text-zinc-400">
                  {preset.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Per-System Opacity & Solo Rows */}
        <div className="border-t border-white/10 pt-2.5">
          <div className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Anatomical System Opacity
          </div>
          <div className="space-y-1.5">
            {SYSTEM_DISPLAY_ORDER.map((sysId) => {
              const cfg = ANATOMICAL_SYSTEMS[sysId];
              const isActive = activeSystems[sysId];
              const opacityVal = systemOpacity[sysId];
              const Icon = SYSTEM_ICONS[sysId];
              const isSolo =
                isActive &&
                SYSTEM_DISPLAY_ORDER.every(
                  (other) => other === sysId || !activeSystems[other]
                );

              return (
                <div
                  key={sysId}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors',
                    isActive
                      ? 'border-white/10 bg-white/[0.03]'
                      : 'border-white/5 bg-white/[0.01] opacity-65'
                  )}
                >
                  {/* Eye Visibility Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleSystem(sysId)}
                    aria-pressed={isActive}
                    title={`Toggle ${cfg.label} visibility`}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors',
                      isActive
                        ? 'border-white/15 bg-white/10 text-white hover:bg-white/20'
                        : 'border-white/10 bg-black/40 text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    {isActive ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                  </button>

                  {/* System Icon + Name */}
                  <div className="flex w-28 shrink-0 items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: cfg.accentColor }}
                    />
                    <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                    <span className="truncate text-[11px] font-medium text-zinc-100">
                      {cfg.label}
                    </span>
                  </div>

                  {/* Opacity Slider (0-100%) */}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={opacityVal}
                      aria-label={`${cfg.label} opacity`}
                      onChange={(e) => {
                        const next = parseFloat(e.target.value);
                        if (!isActive && next > 0) {
                          toggleSystem(sysId);
                        }
                        setSystemOpacity(sysId, next);
                      }}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-sky-400"
                    />
                    <span className="w-8 shrink-0 text-right font-mono text-[10px] text-zinc-300">
                      {Math.round(opacityVal * 100)}%
                    </span>
                  </div>

                  {/* Solo Button */}
                  <button
                    type="button"
                    onClick={() => soloSystem(sysId)}
                    aria-pressed={isSolo}
                    title={`Solo ${cfg.label} System`}
                    className={cn(
                      'shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase transition-colors',
                      isSolo
                        ? 'border-sky-400/50 bg-sky-500/25 text-sky-200'
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                    )}
                  >
                    Solo
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Anatomical Orientation Compass Widget */}
        <div className="border-t border-white/10 pt-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            <Compass className="h-3 w-3 text-sky-400" />
            <span>Anatomical View Compass</span>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {ORIENTATION_COMPASS.map((view) => {
              const active = cameraPresetView === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => triggerCameraPreset(view.id)}
                  title={view.fullLabel}
                  aria-pressed={active}
                  className={cn(
                    'rounded-lg border px-1.5 py-1.5 font-mono text-[10px] font-semibold transition-all active:scale-95',
                    active
                      ? 'border-sky-400/60 bg-sky-500/25 text-white shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                      : 'border-white/10 bg-white/5 text-zinc-300 hover:border-sky-400/35 hover:bg-sky-500/15 hover:text-white'
                  )}
                >
                  {view.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
