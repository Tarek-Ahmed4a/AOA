import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  useAnatomyStore,
  useAppNavigationStore,
  type ActivePartLandmarkItem,
  type AnatomicalSystem,
  type BiologicalSex,
  type OfficialAtlasPresetId,
} from '../../store/useAnatomyStore';
import {
  ANATOMICAL_FIDUCIAL_LANDMARKS,
  type AnatomicalFiducialLandmark,
  type LandmarkSnapDirection,
} from '../../data/anatomicalLandmarksCatalog';
import type { NihOrganSceneItem } from '../../services/nihSceneService';
import type { HraSurgicalLandmarkGlb } from '../../services/hraLandmarkService';
import {
  resolveCrossDatasetLandmarkTargets,
  snapLandmarkToMeshSurface,
  type CrossDatasetTargetMatch,
} from '../../utils/universalLandmarkRegistration';
import {
  enqueueGeometryBVH,
  registerSceneMesh,
  unregisterSceneMesh,
  useSceneMeshRegistry,
  type SceneMeshRegistry,
} from '../../utils/bvhSetup';
import type { AnatomicalPartInfo } from '../../utils/anatomyParser';
import { useClippingPlane } from '../../utils/slicingPlane';
import {
  HraLandmarkOverlayList,
  useHraSurgicalLandmarksCatalog,
} from './HraLandmarkOverlayGLB';

const NOOP_RAYCAST: THREE.Mesh['raycast'] = () => {};

const SOLO_PRESET_SYSTEM_MAP: Partial<
  Record<OfficialAtlasPresetId, AnatomicalSystem>
> = {
  'zanatomy-skeletal': 'skeletal',
  'zanatomy-muscular': 'muscular',
  'zanatomy-visceral': 'visceral',
  'zanatomy-cardiovascular': 'cardiovascular',
  'zanatomy-nervous': 'nervous',
  'zanatomy-integumentary': 'integumentary',
};

const SHARED_BEACON_GEOMETRY = new THREE.SphereGeometry(1, 16, 16);
const SHARED_HALO_GEOMETRY = new THREE.SphereGeometry(1.55, 14, 14);

function isHierarchyVisible(obj: THREE.Object3D): boolean {
  let curr: THREE.Object3D | null = obj;
  while (curr) {
    if (!curr.visible) return false;
    curr = curr.parent;
  }
  return true;
}

function isFiducialAllowedForSex(
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

interface CandidateMeshEntry {
  mesh: THREE.Mesh;
  sys: AnatomicalSystem;
  searchText: string;
  box: THREE.Box3;
  center: THREE.Vector3;
  volume: number;
}

function collectVisibleAnatomyMeshes(
  registry: SceneMeshRegistry
): CandidateMeshEntry[] {
  const candidates: CandidateMeshEntry[] = [];
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  for (const mesh of registry.byUuid.values()) {
    if (
      !mesh.visible ||
      mesh.userData?.isSurgicalLandmark ||
      mesh.userData?.__isNoiseFiltered ||
      mesh.userData?.__isNoiseSubmesh ||
      mesh.userData?.__isStencilHelper ||
      !isHierarchyVisible(mesh)
    ) {
      continue;
    }

    mesh.updateWorldMatrix(true, false);
    box.setFromObject(mesh);
    if (box.isEmpty()) continue;

    box.getCenter(center);
    box.getSize(size);
    const pi =
      (mesh.userData?.partInfo as AnatomicalPartInfo | undefined) ??
      (mesh.userData?.__cachedPartInfo as AnatomicalPartInfo | undefined);
    const sys = (mesh.userData?.system as AnatomicalSystem | undefined) ?? pi?.system ?? 'visceral';
    const searchText = `${pi?.cleanName ?? ''} ${mesh.name ?? ''} ${pi?.organGroupId ?? ''} ${pi?.latinName ?? ''}`
      .trim()
      .toLowerCase();

    candidates.push({
      mesh,
      sys,
      searchText,
      box: box.clone(),
      center: center.clone(),
      volume: size.x * size.y * size.z,
    });
  }

  return candidates;
}

function matchesLaterality(
  fid: AnatomicalFiducialLandmark,
  entry: CandidateMeshEntry
): boolean {
  if (fid.laterality === 'Median / Unpaired') return true;
  const txt = entry.searchText;
  const explicitlyRight = /(?:^|\b|[_.])right(?:\b|[_.])|\.r(?:\b|$)|\bdexter/i.test(txt);
  const explicitlyLeft = /(?:^|\b|[_.])left(?:\b|[_.])|\.l(?:\b|$)|\bsinist/i.test(txt);

  if (fid.laterality === 'Left') {
    if (explicitlyRight && !explicitlyLeft) return false;
    if (!explicitlyLeft && entry.box.max.x < -0.008) return false;
    return true;
  }

  if (fid.laterality === 'Right') {
    if (explicitlyLeft && !explicitlyRight) return false;
    if (!explicitlyRight && entry.box.min.x > 0.008) return false;
    return true;
  }

  return true;
}

function pickBestTargetForFiducial(
  fid: AnatomicalFiducialLandmark,
  candidates: CandidateMeshEntry[],
  isExplorerCustom: boolean,
  customModelHintLower: string
): {
  anchorMesh: THREE.Mesh;
  matchedMeshes: THREE.Mesh[];
  targetBox: THREE.Box3;
} | null {
  const sameSystemMatches: CandidateMeshEntry[] = [];
  const anySystemMatches: CandidateMeshEntry[] = [];

  for (const cand of candidates) {
    if (!matchesLaterality(fid, cand)) continue;
    const hitPattern = fid.meshMatchPatterns.some((pat) =>
      cand.searchText.includes(pat.toLowerCase())
    );
    if (!hitPattern) continue;

    // Avoid hijacking bone/muscle/organ landmarks onto minor twigs unless system matches
    const isAccessoryVesselOrNerve =
      /\b(?:artery|vein|nerve|plexus|lymph|branch|ganglion)\b/.test(cand.searchText);
    if (
      isAccessoryVesselOrNerve &&
      fid.system !== 'cardiovascular' &&
      fid.system !== 'nervous'
    ) {
      continue;
    }

    if (cand.sys === fid.system) {
      sameSystemMatches.push(cand);
    } else {
      anySystemMatches.push(cand);
    }
  }

  const primaryList =
    sameSystemMatches.length > 0 ? sameSystemMatches : anySystemMatches;

  if (primaryList.length > 0) {
    primaryList.sort((a, b) => b.volume - a.volume);
    const totalBox = new THREE.Box3();
    for (const item of primaryList) {
      totalBox.union(item.box);
    }
    return {
      anchorMesh: primaryList[0].mesh,
      matchedMeshes: primaryList.map((p) => p.mesh),
      targetBox: totalBox,
    };
  }

  // Fallback for single-organ Tab 2 Explorer models with generic node names (`Object_1`)
  if (
    isExplorerCustom &&
    customModelHintLower &&
    fid.explorerModelPatterns?.some((pat) =>
      customModelHintLower.includes(pat.toLowerCase())
    )
  ) {
    const fallbackPool = candidates.filter((c) => matchesLaterality(fid, c));
    const pool = fallbackPool.length > 0 ? fallbackPool : candidates;
    if (pool.length === 0) return null;

    const sorted = [...pool].sort((a, b) => b.volume - a.volume);
    const totalBox = new THREE.Box3();
    for (const item of sorted) {
      totalBox.union(item.box);
    }
    return {
      anchorMesh: sorted[0].mesh,
      matchedMeshes: sorted.map((p) => p.mesh),
      targetBox: totalBox,
    };
  }

  return null;
}

interface ResolvedFiducialPlacement {
  fiducial: AnatomicalFiducialLandmark;
  anchorMesh: THREE.Mesh;
  localAnchor: THREE.Vector3;
  worldPosition: [number, number, number];
  markerRadius: number;
  showCompactCallout: boolean;
  labelPosition?: [number, number, number];
  labelSide?: 'left' | 'right';
  requireSystemCheck: boolean;
}

function computeTargetWorldFromLandmark(
  fid: AnatomicalFiducialLandmark,
  targetBox: THREE.Box3
): THREE.Vector3 {
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  targetBox.getCenter(center);
  targetBox.getSize(size);

  if (fid.anatomicalRatio) {
    const [rx, ry, rz] = fid.anatomicalRatio;
    const isRightSide =
      fid.laterality === 'Right' ||
      (fid.laterality !== 'Left' && center.x < -0.005);
    const x = isRightSide
      ? targetBox.max.x - rx * size.x
      : targetBox.min.x + rx * size.x;
    const y = targetBox.min.y + ry * size.y;
    const z = targetBox.min.z + rz * size.z;
    return new THREE.Vector3(x, y, z);
  }

  return new THREE.Vector3(
    center.x + fid.normalizedOffset[0] * size.x,
    center.y + fid.normalizedOffset[1] * size.y,
    center.z + fid.normalizedOffset[2] * size.z
  );
}

const FiducialBeaconMesh: React.FC<{
  placement: ResolvedFiducialPlacement;
}> = ({ placement }) => {
  const {
    fiducial,
    anchorMesh,
    worldPosition,
    markerRadius,
    showCompactCallout,
    labelPosition,
    requireSystemCheck,
  } = placement;
  const { invalidate } = useThree();
  const registry = useSceneMeshRegistry();
  const clippingPlane = useClippingPlane();
  const clippingPlanesList = useMemo(() => [clippingPlane], [clippingPlane]);
  const slicingEnabled = useAnatomyStore((s) => s.slicing.enabled);
  const slicingScope = useAnatomyStore((s) => s.slicing.scope);
  const hoveredPart = useAnatomyStore((s) => s.hoveredPart);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const focusedLandmarkId = useAnatomyStore((s) => s.focusedLandmarkId);
  const selectPart = useAnatomyStore((s) => s.selectPart);
  const systemEnabled = useAnatomyStore(
    (s) => s.activeSystems[fiducial.system]
  );

  const coreMeshRef = useRef<THREE.Mesh>(null);
  const [registeredUuid, setRegisteredUuid] = useState<string>('');

  const { coreMat, haloMat } = useMemo(() => {
    const colorHex =
      fiducial.variant === 'rose'
        ? '#f43f5e'
        : fiducial.variant === 'blue'
        ? '#3b82f6'
        : fiducial.variant === 'emerald'
        ? '#10b981'
        : fiducial.variant === 'cyan'
        ? '#38bdf8'
        : '#f59e0b';
    const emissiveHex =
      fiducial.variant === 'rose'
        ? '#be123c'
        : fiducial.variant === 'blue'
        ? '#1d4ed8'
        : fiducial.variant === 'emerald'
        ? '#059669'
        : fiducial.variant === 'cyan'
        ? '#0284c7'
        : '#d97706';

    const core = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      emissive: new THREE.Color(emissiveHex),
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0.12,
      transparent: true,
      opacity: 0.94,
    });
    core.userData = {
      __baseColorHex: core.color.getHex(),
      __baseEmissive: new THREE.Color(emissiveHex),
      __baseEmissiveIntensity: 0.72,
      __baseRoughness: 0.2,
      __baseOpacity: 0.94,
      __origSide: THREE.FrontSide,
    };

    const halo = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });

    return { coreMat: core, haloMat: halo };
  }, [fiducial.variant]);

  const partInfo = useMemo<AnatomicalPartInfo>(
    () => ({
      meshUuid: registeredUuid || `fid_${fiducial.id}`,
      rawName: fiducial.id,
      cleanName: fiducial.nameEn,
      cleanNameAr: fiducial.nameAr,
      latinName: fiducial.latinName,
      laterality: fiducial.laterality,
      system: fiducial.system,
      ta98Code: 'LMK-FID',
      organGroupId: `landmark::fiducial::${fiducial.id}`,
      worldCenter: worldPosition,
      boundingRadius: Math.max(0.03, markerRadius * 4.5),
      landmarkMeta: {
        id: fiducial.id,
        nameEn: fiducial.nameEn,
        nameAr: fiducial.nameAr,
        latinName: fiducial.latinName,
        parentOrganLabel: fiducial.parentOrganLabel,
        parentOrganAr: fiducial.parentOrganAr,
        parentMeshUuid: anchorMesh.uuid,
        localizationEn: fiducial.localizationEn,
        localizationAr: fiducial.localizationAr,
        significanceEn: fiducial.significanceEn,
        significanceAr: fiducial.significanceAr,
        region: fiducial.region,
      },
    }),
    [fiducial, registeredUuid, anchorMesh.uuid, markerRadius, worldPosition]
  );

  const isPeeled =
    hiddenPartIds.includes(fiducial.id) ||
    hiddenPartIds.includes(`landmark::fiducial::${fiducial.id}`) ||
    (registeredUuid ? hiddenPartIds.includes(registeredUuid) : false);

  const isIsolatedOut =
    isolatedPartId !== null &&
    isolatedPartId !== fiducial.id &&
    isolatedPartId !== registeredUuid &&
    isolatedPartId !== `landmark::fiducial::${fiducial.id}` &&
    isolatedPartId !== anchorMesh.uuid &&
    isolatedPartId !== anchorMesh.name &&
    isolatedPartId !== (anchorMesh.userData?.organGroupId as string | undefined);

  const visible =
    !isPeeled &&
    !isIsolatedOut &&
    (!requireSystemCheck || systemEnabled) &&
    anchorMesh.visible &&
    isHierarchyVisible(anchorMesh);

  const relLabelPos = useMemo<[number, number, number] | null>(() => {
    if (!labelPosition) return null;
    return [
      labelPosition[0] - worldPosition[0],
      labelPosition[1] - worldPosition[1],
      labelPosition[2] - worldPosition[2],
    ];
  }, [labelPosition, worldPosition]);

  const leaderLineObj = useMemo(() => {
    if (!relLabelPos) return null;
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(relLabelPos[0], relLabelPos[1], relLabelPos[2]),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: '#fbbf24',
      transparent: true,
      opacity: 0.65,
    });
    return new THREE.Line(geom, mat);
  }, [relLabelPos]);

  useEffect(() => {
    return () => {
      if (leaderLineObj) {
        leaderLineObj.geometry.dispose();
        (leaderLineObj.material as THREE.Material).dispose();
      }
    };
  }, [leaderLineObj]);

  useEffect(() => {
    const mesh = coreMeshRef.current;
    if (!mesh) return;
    setRegisteredUuid(mesh.uuid);

    mesh.userData = {
      ...(mesh.userData || {}),
      isSurgicalLandmark: true,
      system: fiducial.system,
      organGroupId: `landmark::fiducial::${fiducial.id}`,
      landmarkLabel: fiducial.nameEn,
      landmarkParentOrganLabel: fiducial.parentOrganLabel,
      __isNoiseFiltered: false,
      __sharedMaterial: coreMat,
      originalMaterial: coreMat,
      __origRaycast: mesh.raycast,
      partInfo: {
        ...partInfo,
        meshUuid: mesh.uuid,
      },
    };

    enqueueGeometryBVH(mesh.geometry);
    registerSceneMesh(mesh, registry);
    invalidate();

    return () => {
      const hi = mesh.userData?.__highlightMaterial as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (hi) {
        (Array.isArray(hi) ? hi : [hi]).forEach((m) => m?.dispose());
        mesh.userData.__highlightMaterial = undefined;
      }
      unregisterSceneMesh(mesh, registry);
      invalidate();
    };
  }, [fiducial, coreMat, registry, invalidate]);

  useEffect(() => {
    const mesh = coreMeshRef.current;
    if (!mesh) return;
    const pi = mesh.userData?.partInfo as AnatomicalPartInfo | undefined;
    if (pi) {
      pi.worldCenter = worldPosition;
      if (pi.landmarkMeta) {
        pi.landmarkMeta.parentMeshUuid = anchorMesh.uuid;
      }
    }
    mesh.visible = visible;
    mesh.raycast = visible
      ? ((mesh.userData.__origRaycast as THREE.Mesh['raycast']) ??
        THREE.Mesh.prototype.raycast)
      : NOOP_RAYCAST;
    if (visible) {
      mesh.layers.enable(0);
    } else {
      mesh.layers.disable(0);
    }
    invalidate();
  }, [visible, worldPosition, anchorMesh.uuid, invalidate]);

  useEffect(() => {
    const slicedAll = slicingEnabled && slicingScope === 'all';
    coreMat.clippingPlanes = slicedAll ? clippingPlanesList : null;
    coreMat.clipShadows = slicedAll;
    coreMat.needsUpdate = true;
    haloMat.clippingPlanes = slicedAll ? clippingPlanesList : null;
    haloMat.needsUpdate = true;
    invalidate();
  }, [slicingEnabled, slicingScope, clippingPlanesList, coreMat, haloMat, invalidate]);

  useEffect(() => {
    return () => {
      coreMat.dispose();
      haloMat.dispose();
    };
  }, [coreMat, haloMat]);

  const isHovered =
    hoveredPart?.rawName === fiducial.id ||
    (registeredUuid !== '' && hoveredPart?.meshUuid === registeredUuid);
  const isSelected =
    selectedPart?.rawName === fiducial.id ||
    focusedLandmarkId === fiducial.id ||
    (registeredUuid !== '' && selectedPart?.meshUuid === registeredUuid);

  const scaleMultiplier = isSelected ? 1.5 : isHovered ? 1.25 : 1.0;

  return (
    <group
      name={`FiducialBeacon_${fiducial.id}`}
      position={worldPosition}
      visible={visible}
    >
      <mesh
        ref={coreMeshRef}
        name={fiducial.nameEn}
        geometry={SHARED_BEACON_GEOMETRY}
        material={coreMat}
        scale={markerRadius * scaleMultiplier}
        renderOrder={16}
      />
      <mesh
        geometry={SHARED_HALO_GEOMETRY}
        material={haloMat}
        scale={markerRadius * scaleMultiplier}
        raycast={NOOP_RAYCAST}
        renderOrder={15}
      />
      {showCompactCallout && relLabelPos && leaderLineObj && visible && (
        <primitive object={leaderLineObj} />
      )}
      {showCompactCallout && !isHovered && !isSelected && visible && (
        <Html
          center
          position={relLabelPos ?? [0, markerRadius * 2.4, 0]}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'auto' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              selectPart(partInfo);
            }}
            className="pointer-events-auto whitespace-nowrap rounded border border-amber-400/40 bg-zinc-950/90 px-1.5 py-0.5 text-[10px] font-medium text-amber-200 shadow-md transition hover:border-amber-300 hover:bg-zinc-900"
          >
            {fiducial.nameEn.replace(/\s*\((Left|Right)\)\s*$/i, '')}
          </button>
        </Html>
      )}
      {(isHovered || isSelected) && visible && (
        <Html
          center
          position={[0, markerRadius * 2.6, 0]}
          zIndexRange={[30, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded-lg border border-amber-400/50 bg-slate-950/95 px-2.5 py-1 text-center shadow-lg backdrop-blur-md">
            <div className="text-[11px] font-semibold leading-tight text-amber-200">
              {fiducial.nameEn}
            </div>
            <div className="text-[9.5px] leading-tight text-sky-300/90">
              {fiducial.parentOrganLabel}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

export interface UniversalLandmarksLayerProps {
  nihCatalog: Record<BiologicalSex, NihOrganSceneItem[]> | null;
  catalogTick?: number;
  modelContext?: 'master-atlas' | 'explorer-custom';
  customModelHint?: string;
  skipCrossHraGlb?: boolean;
}

/**
 * Universal Landmark Registration & Fiducial Layer for 100% of AOA:
 * - Cross-registers NIH HRA surgical `.glb` overlays onto Z-Anatomy & Explorer organs
 * - Attaches 88 curated clinical/surgical fiducials across Skeletal, Muscular, Visceral,
 *   Cardiovascular, Nervous & Integumentary systems with surface ray-snapping and
 *   atomic `localToWorld` anchoring through `Explode View`.
 */
export const UniversalLandmarksLayer: React.FC<
  UniversalLandmarksLayerProps
> = ({
  nihCatalog,
  catalogTick = 0,
  modelContext = 'master-atlas',
  customModelHint = '',
  skipCrossHraGlb = false,
}) => {
  const registry = useSceneMeshRegistry();
  const showSurgicalLandmarks = useAnatomyStore((s) => s.showSurgicalLandmarks);
  const landmarkFilterMode = useAnatomyStore((s) => s.landmarkFilterMode);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const medicalProfile = useAnatomyStore((s) => s.medicalProfile);
  const setActivePartLandmarks = useAnatomyStore(
    (s) => s.setActivePartLandmarks
  );
  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const customGlbUrl = useAnatomyStore((s) => s.customGlbUrl);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);
  const anatomicalCatalogLength = useAnatomyStore(
    (s) => s.anatomicalCatalog.length
  );
  const explorerOpenedModel = useAppNavigationStore(
    (s) => s.explorerOpenedModel
  );

  const isExplorerCustom = modelContext === 'explorer-custom';
  const shouldLoadHraCatalog =
    showSurgicalLandmarks &&
    !skipCrossHraGlb &&
    (isExplorerCustom || activeAtlasPreset !== 'nih-visible-human');
  const landmarksCatalog = useHraSurgicalLandmarksCatalog(shouldLoadHraCatalog);

  const [crossTargets, setCrossTargets] = useState<
    Array<{ landmark: HraSurgicalLandmarkGlb; target: CrossDatasetTargetMatch }>
  >([]);
  const [fiducialPlacements, setFiducialPlacements] = useState<
    ResolvedFiducialPlacement[]
  >([]);

  // Cache surface-snapped local anchors per (fiducialId::anchorMeshUuid::baselineKey)
  // so `Explode View` scrubbing evaluates `anchorMesh.localToWorld` cleanly without re-raycasting.
  const localAnchorCacheRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const lastBaselineKeyRef = useRef<string>('');

  const customHintLower = useMemo(
    () =>
      `${customModelHint} ${explorerOpenedModel?.title ?? ''} ${explorerOpenedModel?.key ?? ''}`
        .trim()
        .toLowerCase(),
    [customModelHint, explorerOpenedModel?.title, explorerOpenedModel?.key]
  );

  // Sync both cross-dataset NIH HRA GLB targets & surface-snapped clinical fiducial placements
  // after child `useEffect`s apply `explodeFactor`, Peel, Isolate, and Female pelvic scaling.
  useEffect(() => {
    const anySystemEnabled =
      isExplorerCustom || Object.values(activeSystems).some(Boolean);
    if (
      !showSurgicalLandmarks ||
      !anySystemEnabled ||
      (landmarkFilterMode === 'selected' && !selectedPart)
    ) {
      setCrossTargets([]);
      setFiducialPlacements([]);
      setActivePartLandmarks([]);
      return;
    }

    const soloSystem = isExplorerCustom
      ? undefined
      : SOLO_PRESET_SYSTEM_MAP[activeAtlasPreset];
    const baselineKey = `${modelContext}::${activeAtlasPreset}::${biologicalSex}::${customGlbUrl ?? ''}::${hiddenPartIds.join(',')}::${isolatedPartId ?? ''}`;
    if (lastBaselineKeyRef.current !== baselineKey) {
      localAnchorCacheRef.current.clear();
      lastBaselineKeyRef.current = baselineKey;
    }

    const rafId = window.requestAnimationFrame(() => {
      const isAnchoredToSelected = (mesh: THREE.Mesh): boolean => {
        if (!selectedPart) return false;
        if (mesh.uuid === selectedPart.meshUuid) return true;
        if (selectedPart.rawName && mesh.name === selectedPart.rawName) {
          return true;
        }
        const meshGroup = mesh.userData?.organGroupId as string | undefined;
        if (
          selectedPart.organGroupId &&
          meshGroup &&
          meshGroup === selectedPart.organGroupId
        ) {
          return true;
        }
        return false;
      };

      // 1. Cross-dataset NIH HRA landmark `.glb` registration onto Z-Anatomy / Explorer organs
      if (
        !skipCrossHraGlb &&
        (isExplorerCustom || activeAtlasPreset !== 'nih-visible-human')
      ) {
        const rawCross = resolveCrossDatasetLandmarkTargets({
          registry,
          landmarks: landmarksCatalog,
          nihCatalog,
          biologicalSex,
          activeAtlasPreset,
          activeSystems,
          hiddenPartIds,
          isolatedPartId,
          includeFemaleSupplementalInline: isExplorerCustom,
          ignorePresetAndSystemFilter: isExplorerCustom,
        });
        const filteredCross = rawCross.filter((item) => {
          const anchor = item.target.anchorMesh;
          if (!anchor.visible || !isHierarchyVisible(anchor)) return false;
          if (!isExplorerCustom && !activeSystems[item.target.system]) {
            return false;
          }
          if (landmarkFilterMode === 'selected') {
            return selectedPart !== null && isAnchoredToSelected(anchor);
          }
          return true;
        });
        setCrossTargets(filteredCross);
      } else {
        setCrossTargets([]);
      }

      // 2. Universal 6-system clinical/surgical fiducials
      const allCandidates = collectVisibleAnatomyMeshes(registry);
      const candidates = isExplorerCustom
        ? allCandidates
        : allCandidates.filter((c) => activeSystems[c.sys]);
      if (candidates.length === 0) {
        setFiducialPlacements([]);
        setActivePartLandmarks([]);
        return;
      }

      const nextFiducials: ResolvedFiducialPlacement[] = [];
      const size = new THREE.Vector3();
      let selectedCalloutCount = 0;

      for (const fid of ANATOMICAL_FIDUCIAL_LANDMARKS) {
        if (!isFiducialAllowedForSex(fid, biologicalSex)) continue;

        if (!isExplorerCustom) {
          if (soloSystem && fid.system !== soloSystem) continue;
          if (!activeSystems[fid.system]) continue;
          if ((systemOpacity[fid.system] ?? 1) < 0.05) continue;
        }

        const match = pickBestTargetForFiducial(
          fid,
          candidates,
          isExplorerCustom,
          customHintLower
        );
        if (!match) continue;

        const { anchorMesh, matchedMeshes, targetBox } = match;
        const anchoredToSelected =
          isAnchoredToSelected(anchorMesh) ||
          matchedMeshes.some(isAnchoredToSelected);

        if (
          landmarkFilterMode === 'selected' &&
          selectedPart &&
          !anchoredToSelected
        ) {
          continue;
        }

        anchorMesh.updateWorldMatrix(true, false);

        const cacheKey = `${fid.id}::${anchorMesh.uuid}`;
        let localAnchor = localAnchorCacheRef.current.get(cacheKey);
        targetBox.getSize(size);

        let effectiveAnchorMesh = anchorMesh;
        if (!localAnchor) {
          const rawWorld = computeTargetWorldFromLandmark(fid, targetBox);

          const snapped = snapLandmarkToMeshSurface(
            rawWorld,
            matchedMeshes,
            cacheKey,
            0.0018
          );
          if (snapped) {
            effectiveAnchorMesh = snapped.anchorMesh;
            localAnchor = snapped.localAnchor;
          } else {
            localAnchor = anchorMesh.worldToLocal(rawWorld.clone());
          }
          localAnchorCacheRef.current.set(cacheKey, localAnchor);
        }

        const liveWorld = localAnchor
          .clone()
          .applyMatrix4(effectiveAnchorMesh.matrixWorld);
        const markerRadius = THREE.MathUtils.clamp(
          size.length() * 0.022,
          0.0014,
          0.0048
        );

        const showCompactCallout =
          anchoredToSelected && selectedCalloutCount < 14;
        if (showCompactCallout) selectedCalloutCount += 1;

        nextFiducials.push({
          fiducial: fid,
          anchorMesh: effectiveAnchorMesh,
          localAnchor,
          worldPosition: [liveWorld.x, liveWorld.y, liveWorld.z],
          markerRadius,
          showCompactCallout,
          requireSystemCheck: !isExplorerCustom,
        });
      }

      // Authentic Myological Landmarks (Origin, Muscle Belly, Insertion) when a muscle is selected
      const selectedMeshes = selectedPart
        ? candidates.map((c) => c.mesh).filter(isAnchoredToSelected)
        : [];
      const selBox = new THREE.Box3();
      if (selectedMeshes.length > 0) {
        const tmpBox = new THREE.Box3();
        for (const m of selectedMeshes) {
          m.updateWorldMatrix(true, false);
          tmpBox.setFromObject(m);
          if (!tmpBox.isEmpty()) selBox.union(tmpBox);
        }
      }

      if (
        selectedPart &&
        selectedPart.system === 'muscular' &&
        (isExplorerCustom || activeSystems.muscular) &&
        !selBox.isEmpty()
      ) {
        const selSize = new THREE.Vector3();
        selBox.getSize(selSize);
        const dynRadius = THREE.MathUtils.clamp(
          selSize.length() * 0.022,
          0.0014,
          0.0048
        );
        const muscleLabel = selectedPart.cleanName;
        const muscleLabelAr = selectedPart.cleanNameAr || muscleLabel;
        const originRelation = medicalProfile?.relationsEn
          ? `Anatomical relations: ${medicalProfile.relationsEn}`
          : `Proximal/medial attachment of ${muscleLabel}.`;

        const myoSpecs: Array<{
          key: string;
          shortEn: string;
          shortAr: string;
          lat: string;
          variant: 'rose' | 'amber' | 'blue';
          ratio: [number, number, number];
          dir: LandmarkSnapDirection;
          sigEn: string;
          sigAr: string;
        }> = [
          {
            key: 'origin',
            shortEn: 'Origin (منشأ)',
            shortAr: 'منشأ العضلة',
            lat: 'Origo musculi',
            variant: 'rose',
            ratio: [0.12, 0.85, 0.55],
            dir: 'superior',
            sigEn: `${originRelation} Fixed proximal/medial anchor stabilizing contraction.`,
            sigAr: `نقطة الارتكاز الثابتة القريبة أو الإنسية لمنشأ ${muscleLabelAr}.`,
          },
          {
            key: 'belly',
            shortEn: 'Muscle Belly (بطن العضلة)',
            shortAr: 'بطن العضلة',
            lat: 'Venter musculi',
            variant: 'amber',
            ratio: [0.5, 0.5, 0.85],
            dir: 'anterior',
            sigEn: `Central contractile belly of ${muscleLabel}; primary motor endplate & EMG/trigger-point zone.`,
            sigAr: `الجزء المتقلص المركزي لـ ${muscleLabelAr} وموقع الصفيحة الحركية ونقاط الزناد.`,
          },
          {
            key: 'insertion',
            shortEn: 'Insertion (مرتكز)',
            shortAr: 'مرتكز العضلة',
            lat: 'Insertio musculi',
            variant: 'blue',
            ratio: [0.88, 0.2, 0.55],
            dir: 'inferior',
            sigEn: `Mobile distal/lateral tendinous insertion of ${muscleLabel} transmitting force to bone.`,
            sigAr: `المرتكز الوتري البعيد أو الوحشي لـ ${muscleLabelAr} الناقل لقوة الانقباض إلى العظم.`,
          },
        ];

        const existingSelectedPositions = nextFiducials
          .filter((p) => isAnchoredToSelected(p.anchorMesh))
          .map((p) => new THREE.Vector3(...p.worldPosition));

        for (const spec of myoSpecs) {
          const myoId = `myo-${selectedPart.meshUuid}-${spec.key}`;
          const myoFid: AnatomicalFiducialLandmark = {
            id: myoId,
            nameEn: spec.shortEn,
            nameAr: spec.shortAr,
            latinName: `${selectedPart.latinName || muscleLabel} (${spec.lat})`,
            system: 'muscular',
            variant: spec.variant,
            laterality: selectedPart.laterality,
            region: 'Myological Attachment & Belly',
            parentOrganLabel: muscleLabel,
            parentOrganAr: muscleLabelAr,
            meshMatchPatterns: [],
            normalizedOffset: [
              spec.ratio[0] - 0.5,
              spec.ratio[1] - 0.5,
              spec.ratio[2] - 0.5,
            ],
            anatomicalRatio: spec.ratio,
            snapDirection: spec.dir,
            localizationEn: `Surface-snapped ${spec.shortEn.toLowerCase()} on ${muscleLabel}.`,
            localizationAr: `${spec.shortAr} مثبت على سطح ${muscleLabelAr}.`,
            significanceEn: spec.sigEn,
            significanceAr: spec.sigAr,
          };

          const targetWorld = computeTargetWorldFromLandmark(myoFid, selBox);
          const snapped = snapLandmarkToMeshSurface(
            targetWorld,
            selectedMeshes,
            myoId,
            0.0018
          );
          if (!snapped) continue;

          // Deduplicate if a curated origin/insertion landmark already sits within 3cm
          if (
            (spec.key === 'origin' || spec.key === 'insertion') &&
            existingSelectedPositions.some(
              (pos) => pos.distanceTo(snapped.worldPosition) < 0.03
            )
          ) {
            continue;
          }

          const showCompactCallout = selectedCalloutCount < 14;
          if (showCompactCallout) selectedCalloutCount += 1;

          nextFiducials.push({
            fiducial: myoFid,
            anchorMesh: snapped.anchorMesh,
            localAnchor: snapped.localAnchor,
            worldPosition: [
              snapped.worldPosition.x,
              snapped.worldPosition.y,
              snapped.worldPosition.z,
            ],
            markerRadius: dynRadius,
            showCompactCallout,
            requireSystemCheck: !isExplorerCustom,
          });
        }
      }

      // Netter-Style 2-Column Vertical Anti-Overlap Callout Layout on Selected Structure
      const calloutTargets = nextFiducials.filter((p) => p.showCompactCallout);
      if (selectedPart && calloutTargets.length > 0) {
        const layoutBox = selBox.clone();
        if (layoutBox.isEmpty()) {
          for (const p of calloutTargets) {
            layoutBox.expandByPoint(new THREE.Vector3(...p.worldPosition));
          }
        }
        const layoutCenter = new THREE.Vector3();
        const layoutSize = new THREE.Vector3();
        layoutBox.getCenter(layoutCenter);
        layoutBox.getSize(layoutSize);

        const W = Math.max(layoutSize.x, 0.04);
        const H = Math.max(layoutSize.y, 0.06);
        const minGapY = THREE.MathUtils.clamp(H * 0.11, 0.022, 0.045);
        const xOffset = Math.max(W * 0.35, 0.038);

        let leftCol = calloutTargets.filter(
          (p) => p.worldPosition[0] < layoutCenter.x
        );
        let rightCol = calloutTargets.filter(
          (p) => p.worldPosition[0] >= layoutCenter.x
        );

        if (
          leftCol.length > calloutTargets.length * 0.75 ||
          rightCol.length > calloutTargets.length * 0.75
        ) {
          const sortedByX = [...calloutTargets].sort(
            (a, b) => a.worldPosition[0] - b.worldPosition[0]
          );
          const mid = Math.floor(sortedByX.length / 2);
          leftCol = sortedByX.slice(0, mid);
          rightCol = sortedByX.slice(mid);
        }

        const layoutColumn = (
          col: ResolvedFiducialPlacement[],
          side: 'left' | 'right'
        ) => {
          if (col.length === 0) return;
          col.sort((a, b) => b.worldPosition[1] - a.worldPosition[1]);
          const ys = col.map((p) => p.worldPosition[1]);
          for (let i = 1; i < ys.length; i++) {
            if (ys[i - 1] - ys[i] < minGapY) {
              ys[i] = ys[i - 1] - minGapY;
            }
          }
          const avgSurfY =
            col.reduce((acc, p) => acc + p.worldPosition[1], 0) / col.length;
          const avgLabelY = ys.reduce((acc, y) => acc + y, 0) / ys.length;
          const shiftY = avgSurfY - avgLabelY;
          const labelX =
            side === 'left'
              ? layoutBox.min.x - xOffset
              : layoutBox.max.x + xOffset;

          for (let i = 0; i < col.length; i++) {
            col[i].labelPosition = [
              labelX,
              ys[i] + shiftY,
              col[i].worldPosition[2] + 0.012,
            ];
            col[i].labelSide = side;
          }
        };

        layoutColumn(leftCol, 'left');
        layoutColumn(rightCol, 'right');
      }

      const activeItems: ActivePartLandmarkItem[] = selectedPart
        ? nextFiducials
            .filter((p) => isAnchoredToSelected(p.anchorMesh))
            .map((p) => ({
              id: p.fiducial.id,
              nameEn: p.fiducial.nameEn,
              nameAr: p.fiducial.nameAr,
              latinName: p.fiducial.latinName,
              variant: p.fiducial.variant,
              significanceEn: p.fiducial.significanceEn,
              significanceAr: p.fiducial.significanceAr,
              worldPosition: p.worldPosition,
            }))
        : [];
      setActivePartLandmarks(activeItems);

      setFiducialPlacements(nextFiducials);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    showSurgicalLandmarks,
    landmarkFilterMode,
    selectedPart,
    medicalProfile?.relationsEn,
    setActivePartLandmarks,
    registry,
    landmarksCatalog,
    nihCatalog,
    catalogTick,
    modelContext,
    skipCrossHraGlb,
    isExplorerCustom,
    customHintLower,
    biologicalSex,
    activeAtlasPreset,
    activeSystems,
    systemOpacity,
    hiddenPartIds,
    isolatedPartId,
    xrayGhostMode,
    customGlbUrl,
    explodeFactor,
    anatomicalCatalogLength,
  ]);

  if (!showSurgicalLandmarks) return null;

  return (
    <group name={`Universal_Landmarks_Layer_${modelContext}`}>
      {crossTargets.length > 0 && (
        <HraLandmarkOverlayList
          visible={showSurgicalLandmarks}
          crossTargets={crossTargets}
          parentSystem={explorerOpenedModel?.system ?? 'visceral'}
        />
      )}
      {fiducialPlacements.map((placement) => (
        <FiducialBeaconMesh
          key={placement.fiducial.id}
          placement={placement}
        />
      ))}
    </group>
  );
};
