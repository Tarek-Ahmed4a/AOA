import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  useAnatomyStore,
  useAppNavigationStore,
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

function resolveSnapRay(
  direction: LandmarkSnapDirection | undefined,
  rawPoint: THREE.Vector3,
  box: THREE.Box3,
  center: THREE.Vector3
): { origin: THREE.Vector3; dir: THREE.Vector3 } | null {
  if (!direction || direction === 'none') return null;

  const size = box.getSize(new THREE.Vector3());
  const pad = Math.max(0.08, size.length() * 0.6);

  switch (direction) {
    case 'anterior':
      return {
        origin: new THREE.Vector3(rawPoint.x, rawPoint.y, box.max.z + pad),
        dir: new THREE.Vector3(0, 0, -1),
      };
    case 'posterior':
      return {
        origin: new THREE.Vector3(rawPoint.x, rawPoint.y, box.min.z - pad),
        dir: new THREE.Vector3(0, 0, 1),
      };
    case 'left':
      return {
        origin: new THREE.Vector3(box.max.x + pad, rawPoint.y, rawPoint.z),
        dir: new THREE.Vector3(-1, 0, 0),
      };
    case 'right':
      return {
        origin: new THREE.Vector3(box.min.x - pad, rawPoint.y, rawPoint.z),
        dir: new THREE.Vector3(1, 0, 0),
      };
    case 'superior':
      return {
        origin: new THREE.Vector3(rawPoint.x, box.max.y + pad, rawPoint.z),
        dir: new THREE.Vector3(0, -1, 0),
      };
    case 'inferior':
      return {
        origin: new THREE.Vector3(rawPoint.x, box.min.y - pad, rawPoint.z),
        dir: new THREE.Vector3(0, 1, 0),
      };
    case 'outward': {
      const outDir = rawPoint.clone().sub(center);
      if (outDir.lengthSq() < 1e-6) {
        outDir.set(0, 0, 1);
      } else {
        outDir.normalize();
      }
      return {
        origin: rawPoint.clone().addScaledVector(outDir, pad),
        dir: outDir.negate(),
      };
    }
    default:
      return null;
  }
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
}

const FiducialBeaconMesh: React.FC<{
  placement: ResolvedFiducialPlacement;
}> = ({ placement }) => {
  const { fiducial, anchorMesh, worldPosition, markerRadius } = placement;
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

  const coreMeshRef = useRef<THREE.Mesh>(null);
  const [registeredUuid, setRegisteredUuid] = useState<string>('');

  const { coreMat, haloMat } = useMemo(() => {
    const isCyan = fiducial.variant === 'cyan';
    const colorHex = isCyan ? '#38bdf8' : '#f59e0b';
    const emissiveHex = isCyan ? '#0284c7' : '#d97706';

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

  const visible = !isPeeled && !isIsolatedOut;

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
    (registeredUuid !== '' && selectedPart?.meshUuid === registeredUuid);

  const scaleMultiplier = isSelected ? 1.4 : isHovered ? 1.25 : 1.0;

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
    if (!showSurgicalLandmarks) {
      setCrossTargets([]);
      setFiducialPlacements([]);
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
      // 1. Cross-dataset NIH HRA landmark `.glb` registration onto Z-Anatomy / Explorer organs
      if (
        !skipCrossHraGlb &&
        (isExplorerCustom || activeAtlasPreset !== 'nih-visible-human')
      ) {
        const nextCross = resolveCrossDatasetLandmarkTargets({
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
        setCrossTargets(nextCross);
      } else {
        setCrossTargets([]);
      }

      // 2. Universal 6-system clinical/surgical fiducials
      const candidates = collectVisibleAnatomyMeshes(registry);
      if (candidates.length === 0) {
        setFiducialPlacements([]);
        return;
      }

      const raycaster = new THREE.Raycaster();
      const nextFiducials: ResolvedFiducialPlacement[] = [];
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();

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
        anchorMesh.updateWorldMatrix(true, false);

        const cacheKey = `${fid.id}::${anchorMesh.uuid}`;
        let localAnchor = localAnchorCacheRef.current.get(cacheKey);
        targetBox.getSize(size);

        if (!localAnchor) {
          targetBox.getCenter(center);
          const rawWorld = new THREE.Vector3(
            center.x + fid.normalizedOffset[0] * size.x,
            center.y + fid.normalizedOffset[1] * size.y,
            center.z + fid.normalizedOffset[2] * size.z
          );

          let snappedWorld = rawWorld;
          const raySpec = resolveSnapRay(
            fid.snapDirection,
            rawWorld,
            targetBox,
            center
          );
          if (raySpec) {
            raycaster.set(raySpec.origin, raySpec.dir);
            const hits = raycaster.intersectObjects(matchedMeshes, false);
            if (hits.length > 0) {
              const clearance = THREE.MathUtils.clamp(
                size.length() * 0.012,
                0.0025,
                0.012
              );
              snappedWorld = hits[0].point
                .clone()
                .addScaledVector(raySpec.dir, -clearance);
            }
          }

          localAnchor = anchorMesh.worldToLocal(snappedWorld.clone());
          localAnchorCacheRef.current.set(cacheKey, localAnchor);
        }

        const liveWorld = localAnchor
          .clone()
          .applyMatrix4(anchorMesh.matrixWorld);
        const markerRadius = isExplorerCustom
          ? THREE.MathUtils.clamp(size.length() * 0.015, 0.006, 0.032)
          : fid.system === 'skeletal' || fid.system === 'integumentary'
          ? 0.0072
          : 0.0065;

        nextFiducials.push({
          fiducial: fid,
          anchorMesh,
          localAnchor,
          worldPosition: [liveWorld.x, liveWorld.y, liveWorld.z],
          markerRadius,
        });
      }

      setFiducialPlacements(nextFiducials);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    showSurgicalLandmarks,
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
