import {
  explorerAnatomyStore,
  masterAnatomyStore,
  useAppNavigationStore,
} from '../store/useAnatomyStore';

const MAX_CAPTURED_ERRORS = 8;
const capturedErrors: string[] = [];
let initialized = false;

function pushCapturedError(summary: string): void {
  const clean = summary.replace(/\s+/g, ' ').trim().slice(0, 260);
  if (!clean) return;
  const entry = `[${new Date().toISOString()}] ${clean}`;
  capturedErrors.push(entry);
  if (capturedErrors.length > MAX_CAPTURED_ERRORS) {
    capturedErrors.shift();
  }
}

/**
 * Registers global window error listeners once to retain the last 8 runtime errors
 * in memory for invisible inclusion in user problem reports.
 */
export function initRuntimeErrorBuffer(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event) => {
    const loc = event.filename
      ? ` (${event.filename.split('/').pop()}:${event.lineno})`
      : '';
    pushCapturedError(`Error: ${event.message || 'Unknown error'}${loc}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason =
      event.reason instanceof Error
        ? event.reason.message
        : typeof event.reason === 'string'
        ? event.reason
        : 'Unhandled Promise rejection';
    pushCapturedError(`Rejection: ${reason}`);
  });
}

function detectPlatformLabel(): string {
  if (typeof window === 'undefined') return 'Unknown';
  const win = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    process?: { versions?: { electron?: string } };
  };
  if (win.Capacitor?.isNativePlatform?.()) {
    return `Capacitor (${win.Capacitor.getPlatform?.() ?? 'mobile'})`;
  }
  if (
    typeof navigator !== 'undefined' &&
    /Electron/i.test(navigator.userAgent)
  ) {
    return 'Electron Desktop (Windows/PC)';
  }
  return 'Web Browser';
}

/**
 * Builds a concise technical & anatomical context block silently attached
 * to submitted feedback reports so developers know exact state without user effort.
 */
export function buildAutoDiagnosticsSnapshot(): string {
  const nav = useAppNavigationStore.getState();
  const isExplorerNative =
    Boolean(nav.explorerOpenedModel) &&
    nav.explorerOpenedModel?.kind === 'native';
  const state = (
    isExplorerNative ? explorerAnatomyStore : masterAnatomyStore
  ).getState();

  const selectedLabel = state.selectedPart
    ? `${state.selectedPart.cleanName} (${state.selectedPart.system} | TA98:${state.selectedPart.ta98Code})`
    : 'None';
  const focusedLandmark = state.focusedLandmarkId ?? 'None';
  const viewport =
    typeof window !== 'undefined'
      ? `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`
      : 'N/A';

  const lines = [
    `App: AOA v2.0.0 | Platform: ${detectPlatformLabel()} | Viewport: ${viewport}`,
    `Sex: ${state.biologicalSex} | Preset: ${state.activeAtlasPreset} | Explorer: ${nav.explorerOpenedModel?.title ?? 'None'}`,
    `Selected Structure: ${selectedLabel} | Focused Landmark: ${focusedLandmark}`,
    `Modes: Landmarks=${state.showSurgicalLandmarks ? state.landmarkFilterMode : 'off'}, Isolated=${state.isolatedPartId ? 'yes' : 'no'}, XRay=${state.xrayGhostMode ? 'yes' : 'no'}, Slice=${state.slicing.enabled ? state.slicing.plane : 'off'}`,
  ];

  if (capturedErrors.length > 0) {
    lines.push(`Recent Runtime Errors:\n${capturedErrors.join('\n')}`);
  }

  return lines.join('\n');
}
