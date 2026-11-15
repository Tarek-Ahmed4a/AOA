import React, { createContext, useContext } from 'react';
import { create, useStore, type StoreApi } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { resolveClinicalBaseline } from '../data/clinicalBaseline';
import { buildLandmarkClinicalProfile } from '../data/anatomicalLandmarksCatalog';
import { fetchMedicalProfile } from '../services/medicalKnowledgeService';
import type { AnatomicalClinicalProfile } from '../types/medicalData';
import type { AnatomicalPartInfo } from '../utils/anatomyParser';
import { isPartVisibleForSex } from '../utils/sexDimorphismFilter';

export const cursorCoords = { x: 0, y: 0 };
export const cameraInteractionState = { isOrbiting: false };

export type AnatomicalSystem =
  | 'integumentary'
  | 'skeletal'
  | 'muscular'
  | 'visceral'
  | 'nervous'
  | 'cardiovascular';

export type BiologicalSex = 'male' | 'female';

export type SlicingPlaneAxis = 'sagittal' | 'coronal' | 'axial';
export type SlicingScope = 'all' | 'selected';
export type AtlasLanguage = 'ar' | 'en';
export type CameraPresetView =
  | 'anterior'
  | 'posterior'
  | 'left'
  | 'right'
  | 'superior'
  | 'inferior';
export type ClinicalPreset =
  | 'full'
  | 'neuro-vascular'
  | 'cardio-thoracic'
  | 'musculoskeletal';
export type MobileSheetSnap = 'peek' | 'half' | 'full';
export type ModelSource = 'sketchfab-pack' | 'nih-hra' | 'hybrid';
export type ActiveTab = 'master-atlas' | 'cloud-explorer' | 'pdf-books';

export interface PdfReferenceTarget {
  query: string;
  citationLabel?: string;
  book1Plate?: number;
  book1Page?: number;
  book2Page?: number;
  netterPlates?: string[];
  preferredView?: 'book1' | 'book2' | 'split';
  trigger: number;
}
export type OfficialAtlasPresetId =
  | 'zanatomy-full-body'
  | 'zanatomy-skeletal'
  | 'zanatomy-muscular'
  | 'zanatomy-visceral'
  | 'zanatomy-cardiovascular'
  | 'zanatomy-nervous'
  | 'zanatomy-integumentary'
  | 'nih-visible-human';

export interface SlicingState {
  enabled: boolean;
  plane: SlicingPlaneAxis;
  offset: number;
  invert: boolean;
  scope: SlicingScope;
  showHelper: boolean;
}

export interface PointerScreenPos {
  x: number;
  y: number;
}

export interface ActivePartLandmarkItem {
  id: string;
  nameEn: string;
  nameAr: string;
  latinName: string;
  variant: 'amber' | 'cyan' | 'emerald' | 'rose' | 'blue';
  significanceEn: string;
  significanceAr: string;
  worldPosition: [number, number, number];
}

export interface AnatomyState {
  // Phase 1 state
  selectedMeshId: string | null;
  selectedAnatomicalName: string | null;
  hoveredAnatomicalName: string | null;
  activeSystems: Record<AnatomicalSystem, boolean>;
  systemOpacity: Record<AnatomicalSystem, number>;
  cameraTarget: [number, number, number];
  resetViewCounter: number;

  // Phase 2 state
  selectedPart: AnatomicalPartInfo | null;
  hoveredPart: AnatomicalPartInfo | null;
  pointerScreenPos: PointerScreenPos;
  isTouchInteraction: boolean;
  cameraFocusTrigger: number;

  // Phase 3 Dissection & Slicing state
  hiddenPartIds: string[];
  isolatedPartId: string | null;
  partOpacityOverrides: Record<string, number>;
  xrayGhostMode: boolean;
  showSurgicalLandmarks: boolean;
  landmarkFilterMode: 'all' | 'selected';
  activePartLandmarks: ActivePartLandmarkItem[];
  focusedLandmarkId: string | null;
  explodeFactor: number;
  slicing: SlicingState;

  // Phase 4 Medical Knowledge & Inspector state
  language: AtlasLanguage;
  medicalProfile: AnatomicalClinicalProfile | null;
  isLoadingMedicalData: boolean;

  // Phase 5 Search, Layer Matrix, Camera Presets, Custom GLB & Mobile Sheet state
  anatomicalCatalog: AnatomicalPartInfo[];
  baseCatalogParts: AnatomicalPartInfo[];
  supplementalCatalogParts: AnatomicalPartInfo[];
  searchQuery: string;
  cameraPresetView: CameraPresetView | null;
  cameraPresetTrigger: number;
  customGlbUrl: string | null;
  customGlbName: string | null;
  showLayerManager: boolean;
  mobileSheetSnap: MobileSheetSnap;

  // Phase 5.5 Biological Sex state
  biologicalSex: BiologicalSex;

  // Phase 6 Sketchfab 3D Anatomy Cloud & Source Switcher
  modelSource: ModelSource;
  showSketchfabModal: boolean;

  // Phase 7 Standalone Official Master Atlas, Cloud Explorer & Dual PDF Books
  activeTab: ActiveTab;
  activeAtlasPreset: OfficialAtlasPresetId;
  explorerCloudUid: string | null;
  explorerCloudTitle: string | null;
  pdfReferenceTarget: PdfReferenceTarget | null;

  // Phase 1 & 2 actions
  selectPart: (part: AnatomicalPartInfo | null) => void;
  setHoveredPart: (
    part: AnatomicalPartInfo | null,
    screenPos?: PointerScreenPos,
    isTouch?: boolean
  ) => void;
  setPointerScreenPos: (screenPos: PointerScreenPos, isTouch?: boolean) => void;
  focusSelectedPart: () => void;
  toggleSystem: (system: AnatomicalSystem) => void;
  setSystemOpacity: (system: AnatomicalSystem, opacity: number) => void;
  resetView: () => void;

  // Phase 3 Dissection & Slicing actions
  peelSelectedPart: () => void;
  undoLastPeel: () => void;
  restoreAllParts: () => void;
  toggleIsolateSelected: () => void;
  setPartOpacity: (partId: string, opacity: number) => void;
  resetPartOpacity: (partId?: string) => void;
  toggleXrayGhost: () => void;
  toggleSurgicalLandmarks: () => void;
  setShowSurgicalLandmarks: (show: boolean) => void;
  setLandmarkFilterMode: (mode: 'all' | 'selected') => void;
  setActivePartLandmarks: (items: ActivePartLandmarkItem[]) => void;
  setFocusedLandmarkId: (id: string | null) => void;
  setExplodeFactor: (val: number) => void;
  updateSlicing: (partial: Partial<SlicingState>) => void;
  resetSlicing: () => void;

  // Phase 4 actions
  setLanguage: (lang: AtlasLanguage) => void;

  // Phase 5 actions
  registerCatalog: (parts: AnatomicalPartInfo[]) => void;
  setSupplementalCatalogParts: (parts: AnatomicalPartInfo[]) => void;
  setSearchQuery: (q: string) => void;
  selectAndFlyToPart: (meshUuid: string) => void;
  triggerCameraPreset: (view: CameraPresetView) => void;
  soloSystem: (systemKey: AnatomicalSystem) => void;
  applyClinicalPreset: (preset: ClinicalPreset) => void;
  loadCustomGlb: (url: string | null, fileName?: string | null) => void;
  setShowLayerManager: (show: boolean) => void;
  toggleLayerManager: () => void;
  setMobileSheetSnap: (snap: MobileSheetSnap) => void;

  // Phase 5.5 actions
  setBiologicalSex: (sex: BiologicalSex) => void;

  // Phase 6 actions
  setModelSource: (source: ModelSource) => void;
  setShowSketchfabModal: (show: boolean) => void;

  // Phase 7 actions
  setActiveTab: (tab: ActiveTab) => void;
  setActiveAtlasPreset: (preset: OfficialAtlasPresetId) => void;
  loadExplorerCloudModel: (uid: string | null, title?: string | null) => void;
  openTextbookReference: (
    target?: Partial<Omit<PdfReferenceTarget, 'trigger'>>
  ) => void;
  clearPdfReference: () => void;
}

export const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 1.0, 0];

const DEFAULT_ACTIVE_SYSTEMS: Record<AnatomicalSystem, boolean> = {
  integumentary: false,
  skeletal: true,
  muscular: true,
  visceral: true,
  nervous: false,
  cardiovascular: false,
};

const DEFAULT_SYSTEM_OPACITY: Record<AnatomicalSystem, number> = {
  integumentary: 0.45,
  skeletal: 1.0,
  muscular: 1.0,
  visceral: 1.0,
  nervous: 1.0,
  cardiovascular: 1.0,
};

const DEFAULT_SLICING_STATE: SlicingState = {
  enabled: false,
  plane: 'sagittal',
  offset: 0,
  invert: false,
  scope: 'all',
  showHelper: true,
};

let activeMedicalAbortController: AbortController | null = null;
let activeMedicalRequestToken = 0;

function cancelActiveMedicalFetch(): void {
  activeMedicalRequestToken += 1;
  if (activeMedicalAbortController) {
    activeMedicalAbortController.abort();
    activeMedicalAbortController = null;
  }
}

export interface ExplorerOpenedModel {
  key: string;
  title: string;
  sourceLabel: string;
  kind: 'native' | 'cloud-stream';
  sketchfabUid?: string;
  presetId?: OfficialAtlasPresetId;
  glbUrl?: string;
  system?: AnatomicalSystem;
  isFallbackSubstitution?: boolean;
  fallbackReason?: string;
}

export interface AppNavigationState {
  activeTab: ActiveTab;
  showSketchfabModal: boolean;
  pdfReferenceTarget: PdfReferenceTarget | null;
  explorerOpenedModel: ExplorerOpenedModel | null;
  setActiveTab: (tab: ActiveTab) => void;
  setShowSketchfabModal: (show: boolean) => void;
  openTextbookReferenceTarget: (
    target: Omit<PdfReferenceTarget, 'trigger'>
  ) => void;
  clearPdfReference: () => void;
  setExplorerOpenedModel: (model: ExplorerOpenedModel | null) => void;
}

export const useAppNavigationStore = create<AppNavigationState>((set) => ({
  activeTab: 'master-atlas',
  showSketchfabModal: false,
  pdfReferenceTarget: null,
  explorerOpenedModel: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setShowSketchfabModal: (show) => set({ showSketchfabModal: show }),
  openTextbookReferenceTarget: (target) =>
    set((state) => ({
      activeTab: 'pdf-books',
      pdfReferenceTarget: {
        ...target,
        trigger: (state.pdfReferenceTarget?.trigger ?? 0) + 1,
      },
    })),
  clearPdfReference: () => set({ pdfReferenceTarget: null }),
  setExplorerOpenedModel: (model) => set({ explorerOpenedModel: model }),
}));

function buildFilteredCatalog(
  baseParts: AnatomicalPartInfo[],
  supplementalParts: AnatomicalPartInfo[],
  biologicalSex: BiologicalSex
): AnatomicalPartInfo[] {
  const seen = new Set<string>();
  const deduped: AnatomicalPartInfo[] = [];
  const merged =
    biologicalSex === 'female'
      ? [...baseParts, ...supplementalParts]
      : baseParts;
  for (const p of merged) {
    if (!isPartVisibleForSex(p, biologicalSex)) continue;
    const key = `${p.meshUuid}::${p.rawName}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(p);
    }
  }
  deduped.sort((a, b) =>
    a.cleanName === b.cleanName ? 0 : a.cleanName < b.cleanName ? -1 : 1
  );
  return deduped;
}

export function createAnatomyViewportStore(
  initialOverrides?: Partial<AnatomyState>
): StoreApi<AnatomyState> {
  return createStore<AnatomyState>((set, get) => ({
  selectedMeshId: null,
  selectedAnatomicalName: null,
  hoveredAnatomicalName: null,
  activeSystems: { ...DEFAULT_ACTIVE_SYSTEMS },
  systemOpacity: { ...DEFAULT_SYSTEM_OPACITY },
  cameraTarget: [...DEFAULT_CAMERA_TARGET] as [number, number, number],
  resetViewCounter: 0,

  selectedPart: null,
  hoveredPart: null,
  pointerScreenPos: { x: 0, y: 0 },
  isTouchInteraction: false,
  cameraFocusTrigger: 0,

  hiddenPartIds: [],
  isolatedPartId: null,
  xrayGhostMode: false,
  showSurgicalLandmarks: false,
  landmarkFilterMode: 'all',
  activePartLandmarks: [],
  focusedLandmarkId: null,
  explodeFactor: 0,
  slicing: { ...DEFAULT_SLICING_STATE },

  language: 'en',
  medicalProfile: null,
  isLoadingMedicalData: false,

  anatomicalCatalog: [],
  baseCatalogParts: [],
  supplementalCatalogParts: [],
  searchQuery: '',
  cameraPresetView: null,
  cameraPresetTrigger: 0,
  customGlbUrl: null,
  customGlbName: null,
  showLayerManager: false,
  mobileSheetSnap: 'half',
  biologicalSex: 'male',
  modelSource: 'sketchfab-pack',
  showSketchfabModal: false,
  activeTab: 'master-atlas',
  activeAtlasPreset: 'zanatomy-full-body',
  explorerCloudUid: null,
  explorerCloudTitle: null,
  pdfReferenceTarget: null,
  partOpacityOverrides: {},

  selectPart: (part) => {
    cancelActiveMedicalFetch();

    if (!part) {
      set({
        selectedPart: null,
        selectedMeshId: null,
        selectedAnatomicalName: null,
        medicalProfile: null,
        isLoadingMedicalData: false,
        mobileSheetSnap: 'half',
      });
      return;
    }

    if (
      part.landmarkMeta ||
      part.ta98Code === 'LMK-FID' ||
      part.ta98Code === 'HRA-LMK'
    ) {
      const landmarkProfile = buildLandmarkClinicalProfile(part);
      set({
        selectedPart: part,
        selectedMeshId: part.rawName || part.meshUuid,
        selectedAnatomicalName: part.cleanName,
        medicalProfile: landmarkProfile,
        isLoadingMedicalData: false,
      });
      return;
    }

    const { profile: baselineProfile } = resolveClinicalBaseline(part);
    const controller = new AbortController();
    activeMedicalAbortController = controller;
    const requestToken = activeMedicalRequestToken;

    set({
      selectedPart: part,
      selectedMeshId: part.rawName || part.meshUuid,
      selectedAnatomicalName: part.cleanName,
      medicalProfile: baselineProfile,
      isLoadingMedicalData: true,
    });

    void fetchMedicalProfile(part, controller.signal)
      .then((profile) => {
        if (
          controller.signal.aborted ||
          requestToken !== activeMedicalRequestToken
        ) {
          return;
        }
        set({
          medicalProfile: profile,
          isLoadingMedicalData: false,
        });
      })
      .catch(() => {
        if (
          controller.signal.aborted ||
          requestToken !== activeMedicalRequestToken
        ) {
          return;
        }
        set({ isLoadingMedicalData: false });
      });
  },

  setHoveredPart: (part, screenPos, isTouch) => {
    if (screenPos) {
      cursorCoords.x = screenPos.x;
      cursorCoords.y = screenPos.y;
    }
    const current = get();
    const nextUuid = part?.meshUuid ?? null;
    const prevUuid = current.hoveredPart?.meshUuid ?? null;
    const nextTouch =
      isTouch !== undefined ? isTouch : current.isTouchInteraction;
    if (nextUuid === prevUuid && nextTouch === current.isTouchInteraction) {
      return;
    }
    set({
      hoveredPart: part,
      hoveredAnatomicalName: part ? part.cleanName : null,
      isTouchInteraction: nextTouch,
    });
  },

  setPointerScreenPos: (screenPos, isTouch) => {
    cursorCoords.x = screenPos.x;
    cursorCoords.y = screenPos.y;
    if (isTouch !== undefined && isTouch !== get().isTouchInteraction) {
      set({ isTouchInteraction: isTouch });
    }
  },

  focusSelectedPart: () =>
    set((state) => {
      if (!state.selectedPart) return state;
      return {
        cameraTarget: [...state.selectedPart.worldCenter] as [
          number,
          number,
          number,
        ],
        cameraFocusTrigger: state.cameraFocusTrigger + 1,
      };
    }),

  toggleSystem: (system) =>
    set((state) => {
      const nextActive = !state.activeSystems[system];
      const clearHover =
        !nextActive && state.hoveredPart?.system === system;
      return {
        activeSystems: {
          ...state.activeSystems,
          [system]: nextActive,
        },
        ...(clearHover
          ? { hoveredPart: null, hoveredAnatomicalName: null }
          : {}),
      };
    }),

  setSystemOpacity: (system, opacity) =>
    set((state) => ({
      systemOpacity: {
        ...state.systemOpacity,
        [system]: Math.max(0, Math.min(1, opacity)),
      },
    })),

  resetView: () => {
    cancelActiveMedicalFetch();
    set((state) => ({
      selectedPart: null,
      selectedMeshId: null,
      selectedAnatomicalName: null,
      medicalProfile: null,
      isLoadingMedicalData: false,
      cameraTarget: [...DEFAULT_CAMERA_TARGET] as [number, number, number],
      cameraPresetView: null,
      resetViewCounter: state.resetViewCounter + 1,
    }));
  },

  peelSelectedPart: () => {
    cancelActiveMedicalFetch();
    set((state) => {
      if (!state.selectedPart) return state;
      const uuidTarget = state.selectedPart.meshUuid;
      const rawTarget = state.selectedPart.rawName;
      const targetId = uuidTarget || rawTarget;
      const nextHidden = state.hiddenPartIds.includes(targetId)
        ? state.hiddenPartIds
        : [...state.hiddenPartIds, targetId];
      const clearHover =
        state.hoveredPart?.meshUuid === uuidTarget ||
        (Boolean(rawTarget) && state.hoveredPart?.rawName === rawTarget);

      return {
        hiddenPartIds: nextHidden,
        selectedPart: null,
        selectedMeshId: null,
        selectedAnatomicalName: null,
        medicalProfile: null,
        isLoadingMedicalData: false,
        isolatedPartId:
          state.isolatedPartId === uuidTarget ||
          state.isolatedPartId === rawTarget
            ? null
            : state.isolatedPartId,
        ...(clearHover
          ? { hoveredPart: null, hoveredAnatomicalName: null }
          : {}),
      };
    });
  },

  undoLastPeel: () =>
    set((state) => {
      if (state.hiddenPartIds.length === 0) return state;
      return {
        hiddenPartIds: state.hiddenPartIds.slice(0, -1),
      };
    }),

  restoreAllParts: () =>
    set({
      hiddenPartIds: [],
      isolatedPartId: null,
      partOpacityOverrides: {},
      xrayGhostMode: false,
      showSurgicalLandmarks: false,
      landmarkFilterMode: 'all',
      explodeFactor: 0,
    }),

  toggleIsolateSelected: () =>
    set((state) => {
      if (state.selectedPart) {
        const uuidTarget = state.selectedPart.meshUuid;
        const rawTarget = state.selectedPart.rawName;
        const isCurrentlyIsolated =
          state.isolatedPartId === uuidTarget ||
          state.isolatedPartId === rawTarget;
        return {
          isolatedPartId: isCurrentlyIsolated ? null : uuidTarget || rawTarget,
        };
      }
      if (state.isolatedPartId !== null) {
        return { isolatedPartId: null };
      }
      return state;
    }),

  setPartOpacity: (partId, opacity) =>
    set((state) => {
      const clamped = Math.max(0.05, Math.min(1, opacity));
      const keys = new Set<string>([partId]);
      const match =
        (state.selectedPart &&
        (state.selectedPart.meshUuid === partId ||
          state.selectedPart.rawName === partId ||
          state.selectedPart.organGroupId === partId)
          ? state.selectedPart
          : null) ??
        state.anatomicalCatalog.find(
          (p) =>
            p.meshUuid === partId ||
            p.rawName === partId ||
            p.organGroupId === partId
        );

      if (match) {
        if (match.meshUuid) keys.add(match.meshUuid);
        if (match.rawName) keys.add(match.rawName);
        if (match.organGroupId) keys.add(match.organGroupId);
        const matchName = match.cleanName.toLowerCase();
        for (const p of state.anatomicalCatalog) {
          const sameGroup =
            Boolean(match.organGroupId) &&
            p.organGroupId === match.organGroupId;
          const sameNamedOrgan =
            p.cleanName.toLowerCase() === matchName &&
            p.system === match.system &&
            p.laterality === match.laterality;
          if (sameGroup || sameNamedOrgan) {
            if (p.meshUuid) keys.add(p.meshUuid);
            if (p.rawName) keys.add(p.rawName);
          }
        }
      }

      const nextOverrides = { ...state.partOpacityOverrides };
      if (clamped >= 0.995) {
        for (const k of keys) delete nextOverrides[k];
      } else {
        for (const k of keys) nextOverrides[k] = clamped;
      }
      return { partOpacityOverrides: nextOverrides };
    }),

  resetPartOpacity: (partId) =>
    set((state) => {
      if (!partId) {
        return { partOpacityOverrides: {} };
      }
      const keys = new Set<string>([partId]);
      const match =
        (state.selectedPart &&
        (state.selectedPart.meshUuid === partId ||
          state.selectedPart.rawName === partId ||
          state.selectedPart.organGroupId === partId)
          ? state.selectedPart
          : null) ??
        state.anatomicalCatalog.find(
          (p) =>
            p.meshUuid === partId ||
            p.rawName === partId ||
            p.organGroupId === partId
        );
      if (match) {
        if (match.meshUuid) keys.add(match.meshUuid);
        if (match.rawName) keys.add(match.rawName);
        if (match.organGroupId) keys.add(match.organGroupId);
        const matchName = match.cleanName.toLowerCase();
        for (const p of state.anatomicalCatalog) {
          if (
            (match.organGroupId && p.organGroupId === match.organGroupId) ||
            (p.cleanName.toLowerCase() === matchName &&
              p.system === match.system &&
              p.laterality === match.laterality)
          ) {
            if (p.meshUuid) keys.add(p.meshUuid);
            if (p.rawName) keys.add(p.rawName);
          }
        }
      }
      const nextOverrides = { ...state.partOpacityOverrides };
      for (const k of keys) delete nextOverrides[k];
      return { partOpacityOverrides: nextOverrides };
    }),

  toggleXrayGhost: () =>
    set((state) => ({
      xrayGhostMode: !state.xrayGhostMode,
    })),

  toggleSurgicalLandmarks: () =>
    set((state) => ({
      showSurgicalLandmarks: !state.showSurgicalLandmarks,
    })),

  setShowSurgicalLandmarks: (show) =>
    set({
      showSurgicalLandmarks: show,
    }),

  setLandmarkFilterMode: (mode) =>
    set({
      landmarkFilterMode: mode,
    }),

  setActivePartLandmarks: (items) =>
    set({
      activePartLandmarks: items,
    }),

  setFocusedLandmarkId: (id) =>
    set({
      focusedLandmarkId: id,
    }),

  setExplodeFactor: (val) =>
    set({
      explodeFactor: Math.max(0, Math.min(1, val)),
    }),

  updateSlicing: (partial) =>
    set((state) => ({
      slicing: {
        ...state.slicing,
        ...partial,
        offset:
          partial.offset !== undefined
            ? Math.max(-1, Math.min(1, partial.offset))
            : state.slicing.offset,
      },
    })),

  resetSlicing: () =>
    set((state) => ({
      slicing: {
        ...state.slicing,
        enabled: false,
        offset: 0,
        invert: false,
      },
    })),

  setLanguage: (lang) => set({ language: lang }),

  registerCatalog: (parts) =>
    set((state) => ({
      baseCatalogParts: parts,
      anatomicalCatalog: buildFilteredCatalog(
        parts,
        state.supplementalCatalogParts,
        state.biologicalSex
      ),
    })),

  setSupplementalCatalogParts: (parts) =>
    set((state) => ({
      supplementalCatalogParts: parts,
      anatomicalCatalog: buildFilteredCatalog(
        state.baseCatalogParts,
        parts,
        state.biologicalSex
      ),
    })),

  setSearchQuery: (q) => set({ searchQuery: q }),

  selectAndFlyToPart: (meshUuid) => {
    const state = get();
    const part =
      state.anatomicalCatalog.find((item) => item.meshUuid === meshUuid) ??
      state.anatomicalCatalog.find((item) => item.rawName === meshUuid);
    if (!part) return;

    set((prev) => ({
      activeSystems: {
        ...prev.activeSystems,
        [part.system]: true,
      },
      systemOpacity: {
        ...prev.systemOpacity,
        [part.system]:
          prev.systemOpacity[part.system] < 0.05
            ? 1.0
            : prev.systemOpacity[part.system],
      },
      hiddenPartIds: prev.hiddenPartIds.filter(
        (id) => id !== part.meshUuid && id !== part.rawName
      ),
      isolatedPartId:
        prev.isolatedPartId &&
        prev.isolatedPartId !== part.meshUuid &&
        prev.isolatedPartId !== part.rawName &&
        !prev.xrayGhostMode
          ? null
          : prev.isolatedPartId,
    }));

    get().selectPart(part);
    get().focusSelectedPart();
  },

  triggerCameraPreset: (view) =>
    set((state) => ({
      cameraPresetView: view,
      cameraPresetTrigger: state.cameraPresetTrigger + 1,
    })),

  soloSystem: (systemKey) =>
    set((state) => {
      const nextActive: Record<AnatomicalSystem, boolean> = {
        integumentary: false,
        skeletal: false,
        muscular: false,
        visceral: false,
        nervous: false,
        cardiovascular: false,
        [systemKey]: true,
      };
      return {
        activeSystems: nextActive,
        systemOpacity: {
          ...state.systemOpacity,
          [systemKey]: 1.0,
        },
        ...(state.hoveredPart && state.hoveredPart.system !== systemKey
          ? { hoveredPart: null, hoveredAnatomicalName: null }
          : {}),
      };
    }),

  applyClinicalPreset: (preset) =>
    set((state) => {
      let nextActive: Record<AnatomicalSystem, boolean>;
      let nextOpacity: Record<AnatomicalSystem, number>;

      switch (preset) {
        case 'neuro-vascular':
          nextActive = {
            integumentary: false,
            skeletal: true,
            muscular: false,
            visceral: false,
            nervous: true,
            cardiovascular: true,
          };
          nextOpacity = {
            integumentary: 0.12,
            skeletal: 0.2,
            muscular: 1.0,
            visceral: 1.0,
            nervous: 1.0,
            cardiovascular: 1.0,
          };
          break;
        case 'cardio-thoracic':
          nextActive = {
            integumentary: false,
            skeletal: true,
            muscular: false,
            visceral: true,
            nervous: false,
            cardiovascular: true,
          };
          nextOpacity = {
            integumentary: 0.35,
            skeletal: 0.25,
            muscular: 1.0,
            visceral: 1.0,
            nervous: 1.0,
            cardiovascular: 1.0,
          };
          break;
        case 'musculoskeletal':
          nextActive = {
            integumentary: false,
            skeletal: true,
            muscular: true,
            visceral: false,
            nervous: false,
            cardiovascular: false,
          };
          nextOpacity = {
            integumentary: 0.15,
            skeletal: 1.0,
            muscular: 0.65,
            visceral: 1.0,
            nervous: 1.0,
            cardiovascular: 1.0,
          };
          break;
        case 'full':
        default:
          nextActive = { ...DEFAULT_ACTIVE_SYSTEMS };
          nextOpacity = { ...DEFAULT_SYSTEM_OPACITY };
          break;
      }

      return {
        activeSystems: nextActive,
        systemOpacity: nextOpacity,
        ...(state.hoveredPart && !nextActive[state.hoveredPart.system]
          ? { hoveredPart: null, hoveredAnatomicalName: null }
          : {}),
      };
    }),

  loadCustomGlb: (url, fileName = null) => {
    cancelActiveMedicalFetch();
    set((state) => {
      if (
        state.customGlbUrl &&
        state.customGlbUrl !== url &&
        state.customGlbUrl.startsWith('blob:')
      ) {
        URL.revokeObjectURL(state.customGlbUrl);
      }

      return {
        customGlbUrl: url,
        customGlbName: url ? fileName : null,
        explorerCloudUid: null,
        explorerCloudTitle: null,
        anatomicalCatalog: [],
        baseCatalogParts: [],
        supplementalCatalogParts: [],
        searchQuery: '',
        selectedPart: null,
        selectedMeshId: null,
        selectedAnatomicalName: null,
        hoveredPart: null,
        hoveredAnatomicalName: null,
        medicalProfile: null,
        isLoadingMedicalData: false,
        hiddenPartIds: [],
        isolatedPartId: null,
        partOpacityOverrides: {},
        xrayGhostMode: false,
        showSurgicalLandmarks: false,
        explodeFactor: 0,
        activeSystems: {
          integumentary: true,
          skeletal: true,
          muscular: true,
          visceral: true,
          nervous: true,
          cardiovascular: true,
        },
        systemOpacity: { ...DEFAULT_SYSTEM_OPACITY },
        cameraTarget: [...DEFAULT_CAMERA_TARGET] as [number, number, number],
        resetViewCounter: state.resetViewCounter + 1,
      };
    });
  },

  setShowLayerManager: (show) => set({ showLayerManager: show }),

  toggleLayerManager: () =>
    set((state) => ({ showLayerManager: !state.showLayerManager })),

  setMobileSheetSnap: (snap) => set({ mobileSheetSnap: snap }),

  setBiologicalSex: (sex) => {
    cancelActiveMedicalFetch();
    set((state) => {
      if (state.biologicalSex === sex) return state;
      return {
        biologicalSex: sex,
        supplementalCatalogParts: state.supplementalCatalogParts,
        anatomicalCatalog: buildFilteredCatalog(
          state.baseCatalogParts,
          state.supplementalCatalogParts,
          sex
        ),
        selectedPart: null,
        selectedMeshId: null,
        selectedAnatomicalName: null,
        hoveredPart: null,
        hoveredAnatomicalName: null,
        medicalProfile: null,
        isLoadingMedicalData: false,
        hiddenPartIds: [],
        isolatedPartId: null,
        partOpacityOverrides: {},
        mobileSheetSnap: 'half',
      };
    });
  },

  setModelSource: (source) => {
    cancelActiveMedicalFetch();
    set((state) => {
      if (state.customGlbUrl && state.customGlbUrl.startsWith('blob:')) {
        URL.revokeObjectURL(state.customGlbUrl);
      }
      return {
        modelSource: source,
        customGlbUrl: null,
        customGlbName: null,
        anatomicalCatalog: [],
        baseCatalogParts: [],
        supplementalCatalogParts: [],
        selectedPart: null,
        selectedMeshId: null,
        selectedAnatomicalName: null,
        hoveredPart: null,
        hoveredAnatomicalName: null,
        medicalProfile: null,
        isLoadingMedicalData: false,
        hiddenPartIds: [],
        isolatedPartId: null,
        partOpacityOverrides: {},
        mobileSheetSnap: 'half',
        cameraTarget: [...DEFAULT_CAMERA_TARGET] as [number, number, number],
        resetViewCounter: state.resetViewCounter + 1,
      };
    });
  },

  setShowSketchfabModal: (show) =>
    useAppNavigationStore.getState().setShowSketchfabModal(show),

  setActiveTab: (tab) => useAppNavigationStore.getState().setActiveTab(tab),

  setActiveAtlasPreset: (preset) => {
    cancelActiveMedicalFetch();
    set((state) => {
      if (state.customGlbUrl && state.customGlbUrl.startsWith('blob:')) {
        URL.revokeObjectURL(state.customGlbUrl);
      }

      const presetSystemMap: Partial<
        Record<OfficialAtlasPresetId, AnatomicalSystem>
      > = {
        'zanatomy-skeletal': 'skeletal',
        'zanatomy-muscular': 'muscular',
        'zanatomy-visceral': 'visceral',
        'zanatomy-cardiovascular': 'cardiovascular',
        'zanatomy-nervous': 'nervous',
        'zanatomy-integumentary': 'integumentary',
      };
      const soloTargetSystem = presetSystemMap[preset];
      const nextActiveSystems =
        preset === 'zanatomy-full-body'
          ? { ...DEFAULT_ACTIVE_SYSTEMS }
          : soloTargetSystem
            ? {
                ...state.activeSystems,
                [soloTargetSystem]: true,
              }
            : preset === 'nih-visible-human'
              ? {
                  integumentary: true,
                  skeletal: true,
                  muscular: true,
                  visceral: true,
                  cardiovascular: true,
                  nervous: true,
                }
              : state.activeSystems;

      const nextSystemOpacity =
        preset === 'zanatomy-integumentary'
          ? { ...state.systemOpacity, integumentary: 0.9 }
          : preset === 'zanatomy-full-body'
            ? { ...DEFAULT_SYSTEM_OPACITY }
            : {
                ...state.systemOpacity,
                integumentary: DEFAULT_SYSTEM_OPACITY.integumentary,
              };

      return {
        activeAtlasPreset: preset,
        activeSystems: nextActiveSystems,
        systemOpacity: nextSystemOpacity,
        modelSource:
          preset === 'nih-visible-human' ? 'nih-hra' : 'sketchfab-pack',
        customGlbUrl: null,
        customGlbName: null,
        explorerCloudUid: null,
        explorerCloudTitle: null,
        anatomicalCatalog: [],
        baseCatalogParts: [],
        supplementalCatalogParts: [],
        selectedPart: null,
        selectedMeshId: null,
        selectedAnatomicalName: null,
        hoveredPart: null,
        hoveredAnatomicalName: null,
        medicalProfile: null,
        isLoadingMedicalData: false,
        hiddenPartIds: [],
        isolatedPartId: null,
        partOpacityOverrides: {},
        xrayGhostMode: false,
        showSurgicalLandmarks: false,
        explodeFactor: 0,
        mobileSheetSnap: 'half',
        cameraTarget: [...DEFAULT_CAMERA_TARGET] as [number, number, number],
        resetViewCounter: state.resetViewCounter + 1,
      };
    });
  },

  loadExplorerCloudModel: (uid, title = null) => {
    cancelActiveMedicalFetch();
    set((state) => {
      if (state.customGlbUrl && state.customGlbUrl.startsWith('blob:')) {
        URL.revokeObjectURL(state.customGlbUrl);
      }
      return {
        explorerCloudUid: uid,
        explorerCloudTitle: uid ? title : null,
        customGlbUrl: null,
        customGlbName: null,
        anatomicalCatalog: [],
        baseCatalogParts: [],
        supplementalCatalogParts: [],
        hiddenPartIds: [],
        isolatedPartId: null,
        partOpacityOverrides: {},
        xrayGhostMode: false,
        showSurgicalLandmarks: false,
        explodeFactor: 0,
      };
    });
  },

  openTextbookReference: (target) => {
    const state = get();
    const profile = state.medicalProfile;
    const part = state.selectedPart;
    const query =
      target?.query ||
      profile?.cleanNameEn ||
      part?.cleanName ||
      'Human Anatomy';
    const citationLabel =
      target?.citationLabel || profile?.textbookRefCitation || undefined;
    const netterPlates =
      target?.netterPlates ?? profile?.netterPlates ?? undefined;

    let book2Page = target?.book2Page;
    if (!book2Page && citationLabel) {
      const grayMatch = citationLabel.match(/Gray's[^•]*\(p\.(\d+)\)/i);
      if (grayMatch) book2Page = Number(grayMatch[1]);
    }

    let book1Plate = target?.book1Plate;
    if (!book1Plate && netterPlates && netterPlates.length > 0) {
      const pMatch = netterPlates[0].match(/(\d+)/);
      if (pMatch) book1Plate = Number(pMatch[1]);
    }
    if (!book1Plate && citationLabel) {
      const netterMatch = citationLabel.match(/Netter[^•]*Plate\s+(\d+)/i);
      if (netterMatch) book1Plate = Number(netterMatch[1]);
    }

    let book1Page = target?.book1Page;
    if (!book1Page && !book1Plate && citationLabel) {
      const netterPageMatch = citationLabel.match(/Netter[^•]*\(p\.(\d+)\)/i);
      if (netterPageMatch) book1Page = Number(netterPageMatch[1]);
    }

    const preferredView =
      target?.preferredView ||
      (book1Plate || book1Page
        ? book2Page
          ? 'split'
          : 'book1'
        : book2Page
          ? 'book2'
          : 'split');

    useAppNavigationStore.getState().openTextbookReferenceTarget({
      query,
      citationLabel,
      book1Plate,
      book1Page,
      book2Page,
      netterPlates,
      preferredView,
    });
  },

  clearPdfReference: () =>
    useAppNavigationStore.getState().clearPdfReference(),
  ...(initialOverrides ?? {}),
}));
}

export const masterAnatomyStore = createAnatomyViewportStore();
export const explorerAnatomyStore = createAnatomyViewportStore();

export const AnatomyStoreContext =
  createContext<StoreApi<AnatomyState>>(masterAnatomyStore);

export const AnatomyStoreProvider: React.FC<{
  store: StoreApi<AnatomyState>;
  children: React.ReactNode;
}> = ({ store, children }) =>
  React.createElement(AnatomyStoreContext.Provider, { value: store }, children);

export function useAnatomyStoreApi(): StoreApi<AnatomyState> {
  return useContext(AnatomyStoreContext);
}

export function useAnatomyStore(): AnatomyState;
export function useAnatomyStore<T>(selector: (state: AnatomyState) => T): T;
export function useAnatomyStore<T = AnatomyState>(
  selector?: (state: AnatomyState) => T
): T {
  const store = useContext(AnatomyStoreContext);
  const effectiveSelector =
    selector ?? (((state: AnatomyState) => state) as (s: AnatomyState) => T);
  return useStore(store, effectiveSelector);
}
