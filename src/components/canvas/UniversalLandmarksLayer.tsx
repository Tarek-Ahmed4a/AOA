import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
  type LandmarkVisualVariant,
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
enqueueGeometryBVH(SHARED_BEACON_GEOMETRY);

const SHARED_LEADER_LINE_MATERIAL = new THREE.LineBasicMaterial({
  color: '#fbbf24',
  transparent: true,
  opacity: 0.65,
});

const VARIANT_PALETTE: Record<
  LandmarkVisualVariant,
  { colorHex: string; emissiveHex: string }
> = {
  rose: { colorHex: '#f43f5e', emissiveHex: '#be123c' },
  blue: { colorHex: '#3b82f6', emissiveHex: '#1d4ed8' },
  emerald: { colorHex: '#10b981', emissiveHex: '#059669' },
  cyan: { colorHex: '#38bdf8', emissiveHex: '#0284c7' },
  amber: { colorHex: '#f59e0b', emissiveHex: '#d97706' },
};

function createPooledVariantMaterials(
  variant: LandmarkVisualVariant
): { coreMat: THREE.MeshStandardMaterial; haloMat: THREE.MeshBasicMaterial } {
  const { colorHex, emissiveHex } = VARIANT_PALETTE[variant];
  const coreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    emissive: new THREE.Color(emissiveHex),
    emissiveIntensity: 0.72,
    roughness: 0.2,
    metalness: 0.12,
    transparent: true,
    opacity: 0.94,
  });
  coreMat.userData = {
    __baseColorHex: coreMat.color.getHex(),
    __baseEmissive: new THREE.Color(emissiveHex),
    __baseEmissiveIntensity: 0.72,
    __baseRoughness: 0.2,
    __baseOpacity: 0.94,
    __origSide: THREE.FrontSide,
  };
  const haloMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  return { coreMat, haloMat };
}

const SHARED_VARIANT_MATERIALS: Record<
  LandmarkVisualVariant,
  { coreMat: THREE.MeshStandardMaterial; haloMat: THREE.MeshBasicMaterial }
> = {
  amber: createPooledVariantMaterials('amber'),
  cyan: createPooledVariantMaterials('cyan'),
  emerald: createPooledVariantMaterials('emerald'),
  rose: createPooledVariantMaterials('rose'),
  blue: createPooledVariantMaterials('blue'),
};

const _frameLookDir = new THREE.Vector3();
const _frameSelCenter = new THREE.Vector3();

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

const TOKEN_REGEX_CACHE = new Map<string, RegExp>();

function normalizeMatchText(text: string): string {
  return text.toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesTokenPattern(normalizedText: string, pattern: string): boolean {
  const cleanPat = normalizeMatchText(pattern);
  if (!cleanPat || !normalizedText.includes(cleanPat)) return false;
  let rx = TOKEN_REGEX_CACHE.get(cleanPat);
  if (!rx) {
    const escaped = cleanPat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rx = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
    TOKEN_REGEX_CACHE.set(cleanPat, rx);
  }
  return rx.test(normalizedText);
}

const NEUROVASCULAR_ACC_TOKENS = [
  'artery',
  'vein',
  'nerve',
  'plexus',
  'lymph',
  'branch',
  'ganglion',
];
const SKELETAL_ACC_TOKENS = [
  'ligament',
  'tendon',
  'bursa',
  'sheath',
  'fascia',
  'fat pad',
  'capsule',
  'meniscus',
  'disc',
  'synovial',
  'labrum',
  'membrane',
];
const MUSCULAR_ACC_TOKENS = ['bursa', 'sheath', 'fascia', 'ligament'];
const VISCERAL_ACC_TOKENS = [
  'node',
  'nodes',
  'lymph',
  'mesentery',
  'meso-appendix',
  'omental',
  'ligament',
  'fascia',
  'bursa',
];

function hasForbiddenAccessoryToken(
  normalizedText: string,
  tokens: readonly string[],
  explicitPatternsJoined: string
): boolean {
  for (const tok of tokens) {
    if (
      matchesTokenPattern(normalizedText, tok) &&
      !matchesTokenPattern(explicitPatternsJoined, tok)
    ) {
      return true;
    }
  }
  return false;
}

function resolveMuscleAttachmentRatios(cleanName: string): {
  origin: [number, number, number];
  belly: [number, number, number];
  insertion: [number, number, number];
  originDir: LandmarkSnapDirection;
  bellyDir: LandmarkSnapDirection;
  insertionDir: LandmarkSnapDirection;
} {
  const n = cleanName.toLowerCase();

  // 1. Pectoral fan-shaped convergence toward lateral humerus / coracoid
  if (/pectoralis/.test(n)) {
    return {
      origin: [0.10, 0.48, 0.84],
      belly: [0.48, 0.54, 0.90],
      insertion: [0.92, 0.74, 0.58],
      originDir: 'anterior',
      bellyDir: 'anterior',
      insertionDir: 'outward',
    };
  }
  // 2. Deltoid converging inferiorly to deltoid tuberosity
  if (/deltoid/.test(n)) {
    return {
      origin: [0.40, 0.92, 0.54],
      belly: [0.68, 0.54, 0.78],
      insertion: [0.82, 0.08, 0.56],
      originDir: 'superior',
      bellyDir: 'outward',
      insertionDir: 'inferior',
    };
  }
  // 3. Broad back / scapular stabilizers
  if (/trapezius/.test(n)) {
    return {
      origin: [0.12, 0.84, 0.18],
      belly: [0.48, 0.52, 0.16],
      insertion: [0.90, 0.56, 0.44],
      originDir: 'posterior',
      bellyDir: 'posterior',
      insertionDir: 'outward',
    };
  }
  if (/latissimus/.test(n)) {
    return {
      origin: [0.14, 0.12, 0.16],
      belly: [0.50, 0.48, 0.18],
      insertion: [0.90, 0.88, 0.56],
      originDir: 'posterior',
      bellyDir: 'posterior',
      insertionDir: 'superior',
    };
  }
  if (/rhomboid|levator scapulae/.test(n)) {
    return {
      origin: [0.14, 0.82, 0.22],
      belly: [0.50, 0.50, 0.22],
      insertion: [0.88, 0.28, 0.24],
      originDir: 'posterior',
      bellyDir: 'posterior',
      insertionDir: 'outward',
    };
  }
  if (/serratus anterior/.test(n)) {
    return {
      origin: [0.68, 0.36, 0.86],
      belly: [0.64, 0.52, 0.50],
      insertion: [0.22, 0.70, 0.16],
      originDir: 'anterior',
      bellyDir: 'outward',
      insertionDir: 'posterior',
    };
  }
  // 4. Rotator cuff & short scapulohumeral muscles (medial scapula -> lateral humerus)
  if (/supraspinatus|infraspinatus|teres|subscapularis/.test(n)) {
    const posteriorCue = /infraspinatus|teres/.test(n);
    return {
      origin: [0.12, 0.56, posteriorCue ? 0.26 : 0.62],
      belly: [0.48, 0.54, posteriorCue ? 0.24 : 0.72],
      insertion: [0.92, 0.66, 0.56],
      originDir: posteriorCue ? 'posterior' : 'anterior',
      bellyDir: posteriorCue ? 'posterior' : 'anterior',
      insertionDir: 'outward',
    };
  }
  // 5. Thoracic diaphragm dome (peripheral costal rim -> central tendon)
  if (/diaphragm/.test(n)) {
    return {
      origin: [0.86, 0.20, 0.62],
      belly: [0.26, 0.54, 0.80],
      insertion: [0.50, 0.92, 0.52],
      originDir: 'inferior',
      bellyDir: 'anterior',
      insertionDir: 'superior',
    };
  }
  // 6. Oblique strap muscles (SCM & Sartorius)
  if (/sternocleidomastoid/.test(n)) {
    return {
      origin: [0.14, 0.08, 0.82],
      belly: [0.50, 0.52, 0.62],
      insertion: [0.86, 0.92, 0.22],
      originDir: 'anterior',
      bellyDir: 'outward',
      insertionDir: 'superior',
    };
  }
  if (/sartorius/.test(n)) {
    return {
      origin: [0.88, 0.92, 0.76],
      belly: [0.50, 0.52, 0.76],
      insertion: [0.14, 0.08, 0.54],
      originDir: 'superior',
      bellyDir: 'anterior',
      insertionDir: 'inferior',
    };
  }
  // 7. Vertical axial / limb muscles (superior origin -> belly -> inferior insertion)
  if (
    /biceps|triceps|brachialis|brachioradialis|pronator|supinator|flexor|extensor|quadriceps|rectus|vastus|hamstring|semitendinosus|semimembranosus|gracilis|adductor|pectineus|psoas|iliacus|gastrocnemius|soleus|tibialis|fibularis|peroneus|masseter|temporalis|gluteus|piriformis/.test(
      n
    )
  ) {
    const isPosteriorCompartment =
      /triceps|gastrocnemius|soleus|hamstring|semimembranosus|semitendinosus|biceps femoris|gluteus|piriformis/.test(
        n
      );
    const zBelly = isPosteriorCompartment ? 0.14 : 0.86;
    return {
      origin: [0.50, 0.92, 0.52],
      belly: [0.50, 0.52, zBelly],
      insertion: [0.50, 0.08, 0.52],
      originDir: 'superior',
      bellyDir: isPosteriorCompartment ? 'posterior' : 'anterior',
      insertionDir: 'inferior',
    };
  }

  return {
    origin: [0.16, 0.84, 0.52],
    belly: [0.50, 0.50, 0.84],
    insertion: [0.84, 0.18, 0.52],
    originDir: 'superior',
    bellyDir: 'anterior',
    insertionDir: 'inferior',
  };
}

interface CandidateMeshEntry {
  mesh: THREE.Mesh;
  sys: AnatomicalSystem;
  searchText: string;
  explicitLeft: boolean;
  explicitRight: boolean;
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

    const geom = mesh.geometry;
    if (!geom) continue;
    if (!geom.boundingBox) geom.computeBoundingBox();
    if (!geom.boundingBox || geom.boundingBox.isEmpty()) continue;

    mesh.updateWorldMatrix(true, false);
    box.copy(geom.boundingBox).applyMatrix4(mesh.matrixWorld);
    if (box.isEmpty()) continue;

    box.getCenter(center);
    box.getSize(size);
    const pi =
      (mesh.userData?.partInfo as AnatomicalPartInfo | undefined) ??
      (mesh.userData?.__cachedPartInfo as AnatomicalPartInfo | undefined);
    const sys = (mesh.userData?.system as AnatomicalSystem | undefined) ?? pi?.system ?? 'visceral';
    const rawName = mesh.name ?? '';
    const searchText = normalizeMatchText(
      `${pi?.cleanName ?? ''} ${rawName} ${pi?.organGroupId ?? ''} ${pi?.latinName ?? ''}`
    );
    const explicitRight =
      /(?:^|\b|[_.])right(?:\b|[_.])|\.r(?:\b|$)|\bdexter/i.test(searchText) ||
      /[_.]r(?:\b|$)/i.test(rawName);
    const explicitLeft =
      /(?:^|\b|[_.])left(?:\b|[_.])|\.l(?:\b|$)|\bsinist/i.test(searchText) ||
      /[_.]l(?:\b|$)/i.test(rawName);

    candidates.push({
      mesh,
      sys,
      searchText,
      explicitLeft,
      explicitRight,
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
  if (fid.laterality === 'Left') {
    if (entry.explicitRight && !entry.explicitLeft) return false;
    if (!entry.explicitLeft && entry.box.max.x < -0.008) return false;
    return true;
  }
  if (fid.laterality === 'Right') {
    if (entry.explicitLeft && !entry.explicitRight) return false;
    if (!entry.explicitRight && entry.box.min.x > 0.008) return false;
    return true;
  }
  return true;
}

function pickBestTargetForFiducial(
  fid: AnatomicalFiducialLandmark,
  pool: CandidateMeshEntry[],
  isExplorerCustom: boolean,
  customModelHintLower: string,
  allCandidatesFallback: CandidateMeshEntry[] = pool
): {
  anchorMesh: THREE.Mesh;
  matchedMeshes: THREE.Mesh[];
  targetBox: THREE.Box3;
} | null {
  const sameSystemMatches: CandidateMeshEntry[] = [];
  const anySystemMatches: CandidateMeshEntry[] = [];
  const explicitPatternsJoined = normalizeMatchText(fid.meshMatchPatterns.join(' '));

  for (const cand of pool) {
    const hitPattern = fid.meshMatchPatterns.some((pat) =>
      matchesTokenPattern(cand.searchText, pat)
    );
    if (!hitPattern) continue;
    if (!matchesLaterality(fid, cand)) continue;

    if (
      fid.excludePatterns &&
      fid.excludePatterns.some((ex) => matchesTokenPattern(cand.searchText, ex))
    ) {
      continue;
    }

    // Avoid hijacking bone/muscle/organ landmarks onto minor accessory meshes
    if (
      fid.system !== 'cardiovascular' &&
      fid.system !== 'nervous' &&
      hasForbiddenAccessoryToken(
        cand.searchText,
        NEUROVASCULAR_ACC_TOKENS,
        explicitPatternsJoined
      )
    ) {
      continue;
    }
    if (
      fid.system === 'skeletal' &&
      hasForbiddenAccessoryToken(
        cand.searchText,
        SKELETAL_ACC_TOKENS,
        explicitPatternsJoined
      )
    ) {
      continue;
    }
    if (
      fid.system === 'muscular' &&
      hasForbiddenAccessoryToken(
        cand.searchText,
        MUSCULAR_ACC_TOKENS,
        explicitPatternsJoined
      )
    ) {
      continue;
    }
    if (
      fid.system === 'visceral' &&
      hasForbiddenAccessoryToken(
        cand.searchText,
        VISCERAL_ACC_TOKENS,
        explicitPatternsJoined
      )
    ) {
      continue;
    }

    if (cand.sys === fid.system) {
      sameSystemMatches.push(cand);
    } else if (isExplorerCustom) {
      anySystemMatches.push(cand);
    }
  }

  const primaryList = isExplorerCustom
    ? sameSystemMatches.length > 0
      ? sameSystemMatches
      : anySystemMatches
    : sameSystemMatches;

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
      matchesTokenPattern(normalizeMatchText(customModelHintLower), pat)
    )
  ) {
    const fallbackPool = allCandidatesFallback.filter((c) => matchesLaterality(fid, c));
    const finalPool = fallbackPool.length > 0 ? fallbackPool : allCandidatesFallback;
    if (finalPool.length === 0) return null;

    const sorted = [...finalPool].sort((a, b) => b.volume - a.volume);
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
}> = React.memo(({ placement }) => {
  const {
    fiducial,
    anchorMesh,
    worldPosition,
    markerRadius,
    showCompactCallout,
    labelPosition,
    labelSide,
    requireSystemCheck,
  } = placement;
  const { invalidate } = useThree();
  const registry = useSceneMeshRegistry();
  const organGroupId = anchorMesh.userData?.organGroupId as string | undefined;

  // Primitive boolean selectors ensure mouseover only re-renders the 1-2 hovered beacons instead of hundreds.
  const isHovered = useAnatomyStore(
    (s) => s.hoveredPart?.rawName === fiducial.id
  );
  const isSelected = useAnatomyStore(
    (s) =>
      s.selectedPart?.rawName === fiducial.id ||
      s.focusedLandmarkId === fiducial.id
  );
  const isPeeled = useAnatomyStore(
    (s) =>
      s.hiddenPartIds.includes(fiducial.id) ||
      s.hiddenPartIds.includes(`landmark::fiducial::${fiducial.id}`)
  );
  const isIsolatedOut = useAnatomyStore(
    (s) =>
      s.isolatedPartId !== null &&
      s.isolatedPartId !== fiducial.id &&
      s.isolatedPartId !== `landmark::fiducial::${fiducial.id}` &&
      s.isolatedPartId !== anchorMesh.uuid &&
      s.isolatedPartId !== anchorMesh.name &&
      (!organGroupId || s.isolatedPartId !== organGroupId)
  );
  const selectPart = useAnatomyStore((s) => s.selectPart);
  const systemEnabled = useAnatomyStore(
    (s) => s.activeSystems[fiducial.system]
  );

  const coreMeshRef = useRef<THREE.Mesh>(null);
  const { coreMat, haloMat } =
    SHARED_VARIANT_MATERIALS[fiducial.variant] ??
    SHARED_VARIANT_MATERIALS.amber;

  const partInfo = useMemo<AnatomicalPartInfo>(
    () => ({
      meshUuid: `fid_${fiducial.id}`,
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
    [fiducial, anchorMesh.uuid, markerRadius, worldPosition]
  );

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
    return new THREE.Line(geom, SHARED_LEADER_LINE_MATERIAL);
  }, [relLabelPos]);

  useEffect(() => {
    return () => {
      if (leaderLineObj) {
        leaderLineObj.geometry.dispose();
      }
    };
  }, [leaderLineObj]);

  useEffect(() => {
    const mesh = coreMeshRef.current;
    if (!mesh) return;

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
          position={relLabelPos ?? [0, markerRadius * 2.4, 0]}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'auto' }}
        >
          <div
            style={{
              transform:
                labelPosition && labelSide
                  ? labelSide === 'left'
                    ? 'translate(-100%, -50%)'
                    : 'translate(0%, -50%)'
                  : 'translate(-50%, -50%)',
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const livePartInfo =
                  (coreMeshRef.current?.userData?.partInfo as
                    | AnatomicalPartInfo
                    | undefined) ?? partInfo;
                selectPart(livePartInfo);
              }}
              className="pointer-events-auto whitespace-nowrap rounded border border-amber-400/40 bg-zinc-950/90 px-1.5 py-0.5 text-[10px] font-medium text-amber-200 shadow-md transition hover:border-amber-300 hover:bg-zinc-900"
            >
              {fiducial.nameEn.replace(/\s*\((Left|Right)\)\s*$/i, '')}
            </button>
          </div>
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
});

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
interface CachedAnchorEntry {
  anchorMesh: THREE.Mesh;
  localAnchor: THREE.Vector3;
  isSnapped: boolean;
}

interface CandidateCache {
  key: string;
  allCandidates: CandidateMeshEntry[];
  bySystem: Map<AnatomicalSystem, CandidateMeshEntry[]>;
}

interface BaseLayoutState {
  placements: ResolvedFiducialPlacement[];
  selBox: THREE.Box3 | null;
}

export const UniversalLandmarksLayer: React.FC<
  UniversalLandmarksLayerProps
> = ({
  nihCatalog,
  catalogTick = 0,
  modelContext = 'master-atlas',
  customModelHint = '',
  skipCrossHraGlb = false,
}) => {
  const { camera, invalidate } = useThree();
  const registry = useSceneMeshRegistry();
  const clippingPlane = useClippingPlane();
  const slicingEnabled = useAnatomyStore((s) => s.slicing.enabled);
  const slicingScope = useAnatomyStore((s) => s.slicing.scope);
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
  const cameraPresetTrigger = useAnatomyStore((s) => s.cameraPresetTrigger);
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
    (isExplorerCustom ||
      (selectedPart !== null && activeAtlasPreset !== 'nih-visible-human'));
  const landmarksCatalog = useHraSurgicalLandmarksCatalog(shouldLoadHraCatalog);

  const [crossTargets, setCrossTargets] = useState<
    Array<{ landmark: HraSurgicalLandmarkGlb; target: CrossDatasetTargetMatch }>
  >([]);
  const [baseLayoutState, setBaseLayoutState] = useState<BaseLayoutState>({
    placements: [],
    selBox: null,
  });
  const [cameraSectorKey, setCameraSectorKey] = useState<string>('');
  const camSectorRef = useRef<string>('');
  const lastSectorUpdateMsRef = useRef<number>(0);

  // Cache surface-snapped local anchor + exact sub-primitive mesh per (fiducialId::anchorMeshUuid::baselineKey)
  // so `Explode View` scrubbing evaluates `cached.anchorMesh.matrixWorld` cleanly without re-raycasting.
  const localAnchorCacheRef = useRef<Map<string, CachedAnchorEntry>>(
    new Map()
  );
  const lastBaselineKeyRef = useRef<string>('');
  const candidateCacheRef = useRef<CandidateCache | null>(null);

  // Sync slicing clipping planes once across all 5 pooled variant materials
  useEffect(() => {
    const slicedAll = slicingEnabled && slicingScope === 'all';
    const planes = slicedAll ? [clippingPlane] : null;
    for (const pair of Object.values(SHARED_VARIANT_MATERIALS)) {
      pair.coreMat.clippingPlanes = planes;
      pair.coreMat.clipShadows = slicedAll;
      pair.coreMat.needsUpdate = true;
      pair.haloMat.clippingPlanes = planes;
      pair.haloMat.needsUpdate = true;
    }
    invalidate();
  }, [slicingEnabled, slicingScope, clippingPlane, invalidate]);

  useFrame(() => {
    if (
      !showSurgicalLandmarks ||
      !selectedPart ||
      baseLayoutState.placements.length === 0
    ) {
      return;
    }
    const now = performance.now();
    if (now - lastSectorUpdateMsRef.current < 320) return;
    camera.getWorldDirection(_frameLookDir);
    const yawBin = Math.round(
      Math.atan2(_frameLookDir.x, _frameLookDir.z) / (Math.PI / 4)
    );
    _frameSelCenter.set(
      selectedPart.worldCenter[0],
      selectedPart.worldCenter[1],
      selectedPart.worldCenter[2]
    );
    const dist = camera.position.distanceTo(_frameSelCenter);
    const distBin = Math.round(dist * 2);
    const key = `${yawBin}::${distBin}`;
    if (key !== camSectorRef.current) {
      camSectorRef.current = key;
      lastSectorUpdateMsRef.current = now;
      setCameraSectorKey(key);
    }
  });

  const customHintLower = useMemo(
    () =>
      `${customModelHint} ${explorerOpenedModel?.title ?? ''} ${explorerOpenedModel?.key ?? ''}`
        .trim()
        .toLowerCase(),
    [customModelHint, explorerOpenedModel?.title, explorerOpenedModel?.key]
  );

  // Stage 1: Resolve cross-dataset targets & base 3D positions (independent of camera orbit)
  useEffect(() => {
    const anySystemEnabled =
      isExplorerCustom || Object.values(activeSystems).some(Boolean);
    if (
      !showSurgicalLandmarks ||
      !anySystemEnabled ||
      (landmarkFilterMode === 'selected' && !selectedPart)
    ) {
      setCrossTargets([]);
      setBaseLayoutState({ placements: [], selBox: null });
      return;
    }

    const soloSystem = isExplorerCustom
      ? undefined
      : SOLO_PRESET_SYSTEM_MAP[activeAtlasPreset];
    const baselineKey = `${modelContext}::${activeAtlasPreset}::${biologicalSex}::${customGlbUrl ?? ''}::${hiddenPartIds.join(',')}::${isolatedPartId ?? ''}`;
    if (lastBaselineKeyRef.current !== baselineKey) {
      localAnchorCacheRef.current.clear();
      candidateCacheRef.current = null;
      lastBaselineKeyRef.current = baselineKey;
    }

    const activeSysSig = Object.entries(activeSystems)
      .filter(([, on]) => on)
      .map(([k]) => k)
      .join(',');
    const candidateKey = `${baselineKey}::${explodeFactor.toFixed(3)}::${activeSysSig}::${catalogTick}::${anatomicalCatalogLength}`;

    const rafId = window.requestAnimationFrame(() => {
      const effectiveSelectedUuid =
        selectedPart?.landmarkMeta?.parentMeshUuid ?? selectedPart?.meshUuid;
      const effectiveSelectedMesh = effectiveSelectedUuid
        ? registry.byUuid.get(effectiveSelectedUuid)
        : undefined;
      const effectiveSelectedRawName =
        effectiveSelectedMesh?.name ??
        (selectedPart?.landmarkMeta ? undefined : selectedPart?.rawName);
      const effectiveSelectedGroupId =
        (effectiveSelectedMesh?.userData?.organGroupId as string | undefined) ??
        (selectedPart?.landmarkMeta ? undefined : selectedPart?.organGroupId);

      const isAnchoredToSelected = (mesh: THREE.Mesh): boolean => {
        if (!selectedPart) return false;
        if (effectiveSelectedUuid && mesh.uuid === effectiveSelectedUuid) {
          return true;
        }
        if (effectiveSelectedRawName && mesh.name === effectiveSelectedRawName) {
          return true;
        }
        const meshGroup = mesh.userData?.organGroupId as string | undefined;
        if (
          effectiveSelectedGroupId &&
          meshGroup &&
          meshGroup === effectiveSelectedGroupId
        ) {
          return true;
        }
        return false;
      };

      // 1. Cross-dataset NIH HRA landmark `.glb` registration:
      //    In Master Atlas, mount only for the selected organ so 20+ remote CDN GLBs don't freeze the scene.
      if (
        !skipCrossHraGlb &&
        (isExplorerCustom ||
          (selectedPart !== null && activeAtlasPreset !== 'nih-visible-human'))
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
          if (!isExplorerCustom) {
            if (!activeSystems[item.target.system]) return false;
            return selectedPart !== null && isAnchoredToSelected(anchor);
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

      // 2. Collect or reuse cached visible anatomy meshes + O(1) system buckets
      let cachedCands = candidateCacheRef.current;
      if (!cachedCands || cachedCands.key !== candidateKey) {
        const collected = collectVisibleAnatomyMeshes(registry);
        const filteredAll = isExplorerCustom
          ? collected
          : collected.filter((c) => activeSystems[c.sys]);
        const bySystem = new Map<AnatomicalSystem, CandidateMeshEntry[]>();
        for (const c of filteredAll) {
          let arr = bySystem.get(c.sys);
          if (!arr) {
            arr = [];
            bySystem.set(c.sys, arr);
          }
          arr.push(c);
        }
        cachedCands = {
          key: candidateKey,
          allCandidates: filteredAll,
          bySystem,
        };
        candidateCacheRef.current = cachedCands;
      }

      const candidates = cachedCands.allCandidates;
      const candidatesBySystem = cachedCands.bySystem;
      if (candidates.length === 0) {
        setBaseLayoutState({ placements: [], selBox: null });
        return;
      }

      // In Selected Part Only mode, restrict search strictly to the 1-4 meshes of the selected structure!
      const isSelectedOnlyMode =
        landmarkFilterMode === 'selected' && selectedPart !== null;
      const selectedCandidates = isSelectedOnlyMode
        ? candidates.filter((c) => isAnchoredToSelected(c.mesh))
        : null;
      const selectedBySystem = new Map<AnatomicalSystem, CandidateMeshEntry[]>();
      if (selectedCandidates) {
        for (const c of selectedCandidates) {
          let arr = selectedBySystem.get(c.sys);
          if (!arr) {
            arr = [];
            selectedBySystem.set(c.sys, arr);
          }
          arr.push(c);
        }
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

        const pool = isSelectedOnlyMode
          ? isExplorerCustom
            ? selectedCandidates ?? []
            : selectedBySystem.get(fid.system) ?? []
          : isExplorerCustom
          ? candidates
          : candidatesBySystem.get(fid.system) ?? [];

        if (pool.length === 0 && !isExplorerCustom) continue;

        const match = pickBestTargetForFiducial(
          fid,
          pool,
          isExplorerCustom,
          customHintLower,
          selectedCandidates ?? candidates
        );
        if (!match) continue;

        const { anchorMesh, matchedMeshes, targetBox } = match;
        const anchoredToSelected =
          selectedPart !== null &&
          (isSelectedOnlyMode ||
            isAnchoredToSelected(anchorMesh) ||
            matchedMeshes.some(isAnchoredToSelected));

        if (isSelectedOnlyMode && !anchoredToSelected) {
          continue;
        }

        anchorMesh.updateWorldMatrix(true, false);

        const cacheKey = `${fid.id}::${anchorMesh.uuid}`;
        let cached = localAnchorCacheRef.current.get(cacheKey);
        if (
          cached &&
          (!cached.anchorMesh.visible || !isHierarchyVisible(cached.anchorMesh))
        ) {
          cached = undefined;
        }
        targetBox.getSize(size);

        // Build BVH synchronously ONLY for the selected organ; enqueue asynchronously for background meshes
        const needsSnapUpgrade =
          cached !== undefined &&
          !cached.isSnapped &&
          (anchoredToSelected || Boolean(cached.anchorMesh.geometry?.boundsTree));

        if (!cached || needsSnapUpgrade) {
          const rawWorld = computeTargetWorldFromLandmark(fid, targetBox);
          const snapped = snapLandmarkToMeshSurface(
            rawWorld,
            matchedMeshes,
            cacheKey,
            0.0018,
            anchoredToSelected
          );
          if (snapped) {
            cached = {
              anchorMesh: snapped.anchorMesh,
              localAnchor: snapped.localAnchor,
              isSnapped: true,
            };
          } else if (!cached) {
            cached = {
              anchorMesh,
              localAnchor: anchorMesh.worldToLocal(rawWorld.clone()),
              isSnapped: false,
            };
          }
          localAnchorCacheRef.current.set(cacheKey, cached);
        }

        const effectiveAnchorMesh = cached.anchorMesh;
        const localAnchor = cached.localAnchor;
        effectiveAnchorMesh.updateWorldMatrix(true, false);
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
        ? (
            selectedCandidates ??
            candidates.filter((c) => isAnchoredToSelected(c.mesh))
          ).map((c) => c.mesh)
        : [];
      const selBox = new THREE.Box3();
      if (selectedMeshes.length > 0) {
        const tmpBox = new THREE.Box3();
        for (const m of selectedMeshes) {
          const g = m.geometry;
          if (!g) continue;
          if (!g.boundingBox) g.computeBoundingBox();
          if (!g.boundingBox || g.boundingBox.isEmpty()) continue;
          m.updateWorldMatrix(true, false);
          tmpBox.copy(g.boundingBox).applyMatrix4(m.matrixWorld);
          if (!tmpBox.isEmpty()) selBox.union(tmpBox);
        }
      }

      const effectiveSelectedPartInfo =
        (effectiveSelectedMesh?.userData?.partInfo as
          | AnatomicalPartInfo
          | undefined) ?? selectedPart;

      if (
        effectiveSelectedPartInfo &&
        effectiveSelectedPartInfo.system === 'muscular' &&
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
        const muscleLabel = effectiveSelectedPartInfo.cleanName;
        const muscleLabelAr =
          effectiveSelectedPartInfo.cleanNameAr || muscleLabel;
        const originRelation =
          !selectedPart?.landmarkMeta && medicalProfile?.relationsEn
            ? `Anatomical relations: ${medicalProfile.relationsEn}`
            : `Proximal/fixed attachment of ${muscleLabel}.`;
        const attachRatios = resolveMuscleAttachmentRatios(muscleLabel);

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
            ratio: attachRatios.origin,
            dir: attachRatios.originDir,
            sigEn: `${originRelation} Fixed proximal/medial anchor stabilizing contraction.`,
            sigAr: `نقطة الارتكاز الثابتة لمنشأ ${muscleLabelAr}.`,
          },
          {
            key: 'belly',
            shortEn: 'Muscle Belly (بطن العضلة)',
            shortAr: 'بطن العضلة',
            lat: 'Venter musculi',
            variant: 'amber',
            ratio: attachRatios.belly,
            dir: attachRatios.bellyDir,
            sigEn: `Central contractile belly of ${muscleLabel}; primary motor endplate & EMG/trigger-point zone.`,
            sigAr: `الجزء المتقلص المركزي لـ ${muscleLabelAr} وموقع الصفيحة الحركية ونقاط الزناد.`,
          },
          {
            key: 'insertion',
            shortEn: 'Insertion (مرتكز)',
            shortAr: 'مرتكز العضلة',
            lat: 'Insertio musculi',
            variant: 'blue',
            ratio: attachRatios.insertion,
            dir: attachRatios.insertionDir,
            sigEn: `Mobile tendinous insertion of ${muscleLabel} transmitting force to skeletal lever.`,
            sigAr: `المرتكز الوتري المتحرك لـ ${muscleLabelAr} الناقل لقوة الانقباض إلى العظم.`,
          },
        ];

        const existingSelectedPositions = nextFiducials
          .filter((p) => isAnchoredToSelected(p.anchorMesh))
          .map((p) => new THREE.Vector3(...p.worldPosition));

        for (const spec of myoSpecs) {
          const myoId = `myo-${effectiveSelectedPartInfo.meshUuid}-${spec.key}`;
          const myoFid: AnatomicalFiducialLandmark = {
            id: myoId,
            nameEn: spec.shortEn,
            nameAr: spec.shortAr,
            latinName: `${effectiveSelectedPartInfo.latinName || muscleLabel} (${spec.lat})`,
            system: 'muscular',
            variant: spec.variant,
            laterality: effectiveSelectedPartInfo.laterality,
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
            0.0018,
            true
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

      setBaseLayoutState({
        placements: nextFiducials,
        selBox: selBox.isEmpty() ? null : selBox,
      });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    showSurgicalLandmarks,
    landmarkFilterMode,
    selectedPart,
    medicalProfile?.relationsEn,
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

  // Stage 2: Fast O(<=14) Camera-Relative 2-Column Netter Callout Layout
  const fiducialPlacements = useMemo<ResolvedFiducialPlacement[]>(() => {
    const baseList = baseLayoutState.placements;
    if (baseList.length === 0 || !selectedPart) return baseList;

    const calloutIndices: number[] = [];
    for (let i = 0; i < baseList.length; i++) {
      if (baseList[i].showCompactCallout) calloutIndices.push(i);
    }
    if (calloutIndices.length === 0) return baseList;

    const result = baseList.map((p) => (p.showCompactCallout ? { ...p } : p));
    const calloutTargets = calloutIndices.map((idx) => result[idx]);

    const layoutBox = baseLayoutState.selBox
      ? baseLayoutState.selBox.clone()
      : new THREE.Box3();
    if (layoutBox.isEmpty()) {
      for (const p of calloutTargets) {
        layoutBox.expandByPoint(new THREE.Vector3(...p.worldPosition));
      }
    }
    const layoutCenter = new THREE.Vector3();
    layoutBox.getCenter(layoutCenter);

    camera.updateMatrixWorld();
    const camRight = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(camera.quaternion)
      .normalize();
    const camUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(camera.quaternion)
      .normalize();
    const toCam = new THREE.Vector3()
      .subVectors(camera.position, layoutCenter)
      .normalize();

    const corners = [
      new THREE.Vector3(layoutBox.min.x, layoutBox.min.y, layoutBox.min.z),
      new THREE.Vector3(layoutBox.min.x, layoutBox.min.y, layoutBox.max.z),
      new THREE.Vector3(layoutBox.min.x, layoutBox.max.y, layoutBox.min.z),
      new THREE.Vector3(layoutBox.min.x, layoutBox.max.y, layoutBox.max.z),
      new THREE.Vector3(layoutBox.max.x, layoutBox.min.y, layoutBox.min.z),
      new THREE.Vector3(layoutBox.max.x, layoutBox.min.y, layoutBox.max.z),
      new THREE.Vector3(layoutBox.max.x, layoutBox.max.y, layoutBox.min.z),
      new THREE.Vector3(layoutBox.max.x, layoutBox.max.y, layoutBox.max.z),
    ];

    let uMin = Infinity;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const c of corners) {
      const u = c.dot(camRight);
      const v = c.dot(camUp);
      if (u < uMin) uMin = u;
      if (u > uMax) uMax = u;
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }

    const uCenter = layoutCenter.dot(camRight);
    const screenW = Math.max(uMax - uMin, 0.04);
    const screenH = Math.max(vMax - vMin, 0.06);
    const cameraDist = Math.max(
      camera.position.distanceTo(layoutCenter),
      0.12
    );

    const minGapV = THREE.MathUtils.clamp(
      Math.max(screenH * 0.11, cameraDist * 0.036),
      0.022,
      0.056
    );
    const xOffset = THREE.MathUtils.clamp(
      Math.max(screenW * 0.34, cameraDist * 0.12),
      0.038,
      0.15
    );

    let leftCol = calloutTargets.filter(
      (p) => new THREE.Vector3(...p.worldPosition).dot(camRight) < uCenter
    );
    let rightCol = calloutTargets.filter(
      (p) => new THREE.Vector3(...p.worldPosition).dot(camRight) >= uCenter
    );

    if (
      leftCol.length > calloutTargets.length * 0.75 ||
      rightCol.length > calloutTargets.length * 0.75
    ) {
      const sortedByU = [...calloutTargets].sort(
        (a, b) =>
          new THREE.Vector3(...a.worldPosition).dot(camRight) -
          new THREE.Vector3(...b.worldPosition).dot(camRight)
      );
      const mid = Math.floor(sortedByU.length / 2);
      leftCol = sortedByU.slice(0, mid);
      rightCol = sortedByU.slice(mid);
    }

    const layoutColumn = (
      col: ResolvedFiducialPlacement[],
      side: 'left' | 'right'
    ) => {
      if (col.length === 0) return;
      col.sort(
        (a, b) =>
          new THREE.Vector3(...b.worldPosition).dot(camUp) -
          new THREE.Vector3(...a.worldPosition).dot(camUp)
      );
      const vs = col.map((p) =>
        new THREE.Vector3(...p.worldPosition).dot(camUp)
      );
      for (let i = 1; i < vs.length; i++) {
        if (vs[i - 1] - vs[i] < minGapV) {
          vs[i] = vs[i - 1] - minGapV;
        }
      }
      const avgSurfV =
        vs.reduce((acc, _v, idx) => {
          const sv = new THREE.Vector3(...col[idx].worldPosition).dot(camUp);
          return acc + sv;
        }, 0) / col.length;
      const avgLabelV = vs.reduce((acc, v) => acc + v, 0) / vs.length;
      const shiftV = avgSurfV - avgLabelV;
      const targetU = side === 'left' ? uMin - xOffset : uMax + xOffset;

      for (let i = 0; i < col.length; i++) {
        const surfVec = new THREE.Vector3(...col[i].worldPosition);
        const curU = surfVec.dot(camRight);
        const curV = surfVec.dot(camUp);
        const dest = surfVec
          .clone()
          .addScaledVector(camRight, targetU - curU)
          .addScaledVector(camUp, vs[i] + shiftV - curV)
          .addScaledVector(toCam, 0.014);
        col[i].labelPosition = [dest.x, dest.y, dest.z];
        col[i].labelSide = side;
      }
    };

    layoutColumn(leftCol, 'left');
    layoutColumn(rightCol, 'right');

    return result;
  }, [
    baseLayoutState,
    selectedPart,
    camera,
    cameraSectorKey,
    cameraPresetTrigger,
  ]);

  // Sync sidebar & callout anti-collision state cleanly after Stage 2 layout
  useEffect(() => {
    if (!showSurgicalLandmarks || !selectedPart) {
      setActivePartLandmarks([]);
      return;
    }
    const activeItems: ActivePartLandmarkItem[] = fiducialPlacements
      .filter((p) => p.showCompactCallout)
      .map((p) => ({
        id: p.fiducial.id,
        nameEn: p.fiducial.nameEn,
        nameAr: p.fiducial.nameAr,
        latinName: p.fiducial.latinName,
        variant: p.fiducial.variant,
        significanceEn: p.fiducial.significanceEn,
        significanceAr: p.fiducial.significanceAr,
        worldPosition: p.worldPosition,
        labelPosition: p.labelPosition,
      }));
    setActivePartLandmarks(activeItems);
  }, [
    fiducialPlacements,
    selectedPart,
    showSurgicalLandmarks,
    setActivePartLandmarks,
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
