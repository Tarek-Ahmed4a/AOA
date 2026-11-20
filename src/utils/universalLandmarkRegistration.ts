import * as THREE from 'three';
import type { AnatomicalSystem, BiologicalSex, OfficialAtlasPresetId } from '../store/useAnatomyStore';
import { enqueueGeometryBVH, type SceneMeshRegistry } from '../utils/bvhSetup';
import type { HraSurgicalLandmarkGlb } from '../services/hraLandmarkService';
import type { NihOrganSceneItem } from '../services/nihSceneService';

export interface CrossDatasetTargetMatch {
  organKey: string;
  side: 'left' | 'right' | 'center';
  system: AnatomicalSystem;
  zaCenter: [number, number, number];
  zaSize: [number, number, number];
  anchorMesh: THREE.Mesh;
  anchorRestCenter: THREE.Vector3;
  visible: boolean;
  nihSize?: [number, number, number];
  nihRotation?: [number, number, number];
}

interface CrossOrganMappingRule {
  organKey: string;
  side: 'left' | 'right' | 'center';
  system: AnatomicalSystem;
  includeRegex: RegExp;
  excludeRegex?: RegExp;
}

const CROSS_ORGAN_RULES: readonly CrossOrganMappingRule[] = [
  {
    organKey: 'heart',
    side: 'center',
    system: 'cardiovascular',
    includeRegex: /\b(?:heart|cor|myocardium|pericardium|ventricle|atrium)\b/i,
    excludeRegex: /\b(?:nerve|plexus|lymph|phrenic|esophag|trachea)\b/i,
  },
  {
    organKey: 'kidney',
    side: 'left',
    system: 'visceral',
    includeRegex: /\b(?:kidney|renal\s+cortex|renal\s+medulla|renal\s+pyramid|renal\s+capsule)\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|plexus|lymph|fat|fascia|ureter|gland|suprarenal|adrenal)\b/i,
  },
  {
    organKey: 'kidney',
    side: 'right',
    system: 'visceral',
    includeRegex: /\b(?:kidney|renal\s+cortex|renal\s+medulla|renal\s+pyramid|renal\s+capsule)\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|plexus|lymph|fat|fascia|ureter|gland|suprarenal|adrenal)\b/i,
  },
  {
    organKey: 'liver',
    side: 'center',
    system: 'visceral',
    includeRegex: /\b(?:liver|hepar|hepatic\s+lobe)\b/i,
    excludeRegex: /\b(?:artery|vein|duct|ligament|lymph|nerve|plexus|gallbladder|bile)\b/i,
  },
  {
    organKey: 'lung',
    side: 'center',
    system: 'visceral',
    includeRegex: /\b(?:lung|pulmo|pulmonary\s+lobe)\b/i,
    excludeRegex: /\b(?:artery|vein|trunk|lymph|nerve|plexus|ligament|pleura|node|intrapulmonary)\b/i,
  },
  {
    organKey: 'main bronchus',
    side: 'center',
    system: 'visceral',
    includeRegex: /\b(?:main\s+bronchus|bronch(?:us|i))\b/i,
    excludeRegex: /\b(?:artery|vein|lymph|nerve|plexus)\b/i,
  },
  {
    organKey: 'spleen',
    side: 'center',
    system: 'visceral',
    includeRegex: /\b(?:spleen|splen|lien)\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|plexus|lymph|ligament)\b/i,
  },
  {
    organKey: 'pancreas',
    side: 'center',
    system: 'visceral',
    includeRegex: /\b(?:pancreas|pancreatic\s+(?:head|body|tail|neck))\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|plexus|lymph|duct)\b/i,
  },
  {
    organKey: 'small intestine',
    side: 'center',
    system: 'visceral',
    includeRegex: /\b(?:small\s+intestine|duodenum|jejunum|ileum)\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|plexus|lymph|mesenter)\b/i,
  },
  {
    organKey: 'large intestine',
    side: 'center',
    system: 'visceral',
    includeRegex: /\b(?:large\s+intestine|cecum|caecum|ascending\s+colon|transverse\s+colon|descending\s+colon|sigmoid\s+colon|colon|rectum)\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|plexus|lymph|mesenter|meso-appendix)\b/i,
  },
  {
    organKey: 'urinary bladder',
    side: 'center',
    system: 'visceral',
    includeRegex: /\b(?:urinary\s+bladder|bladder|detrusor|vesica\s+urinaria)\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|plexus|lymph|ligament|gallbladder|gall)\b/i,
  },
  {
    organKey: 'prostate',
    side: 'center',
    system: 'visceral',
    includeRegex: /\b(?:prostate|prostatic)\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|plexus|lymph)\b/i,
  },
  {
    organKey: 'larynx',
    side: 'center',
    system: 'visceral',
    includeRegex: /\b(?:larynx|epiglottis|laryngopharynx|thyroid\s+cartilage|cricoid|arytenoid)\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|muscle|gland|lymph)\b/i,
  },
  {
    organKey: 'trachea',
    side: 'center',
    system: 'visceral',
    includeRegex: /\b(?:trachea|tracheal)\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|muscle|lymph|esophag)\b/i,
  },
  {
    organKey: 'spinal cord',
    side: 'center',
    system: 'nervous',
    includeRegex: /\b(?:white\s+matter\s+of\s+spinal\s+cord|spinal\s+cord|medulla\s+spinalis|conus\s+medullaris)\b/i,
    excludeRegex: /\b(?:artery|vein|vertebra|dura|ganglion)\b/i,
  },
  {
    organKey: 'eye',
    side: 'left',
    system: 'nervous',
    includeRegex: /\b(?:eyeball|globe|eye|cornea|sclera|lens|iris)\b/i,
    excludeRegex: /\b(?:brow|lid|eyelid|socket|orbit|artery|vein|nerve|muscle)\b/i,
  },
  {
    organKey: 'eye',
    side: 'right',
    system: 'nervous',
    includeRegex: /\b(?:eyeball|globe|eye|cornea|sclera|lens|iris)\b/i,
    excludeRegex: /\b(?:brow|lid|eyelid|socket|orbit|artery|vein|nerve|muscle)\b/i,
  },
  {
    organKey: 'knee',
    side: 'left',
    system: 'skeletal',
    includeRegex: /\b(?:patella)\b/i,
    excludeRegex: /\b(?:ligament|bursa|tendon|artery|vein)\b/i,
  },
  {
    organKey: 'knee',
    side: 'right',
    system: 'skeletal',
    includeRegex: /\b(?:patella)\b/i,
    excludeRegex: /\b(?:ligament|bursa|tendon|artery|vein)\b/i,
  },
  {
    organKey: 'ureter',
    side: 'left',
    system: 'visceral',
    includeRegex: /\bureter\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|plexus|lymph|node|orifice)\b/i,
  },
  {
    organKey: 'ureter',
    side: 'right',
    system: 'visceral',
    includeRegex: /\bureter\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|plexus|lymph|node|orifice)\b/i,
  },
  {
    organKey: 'palatine tonsil',
    side: 'left',
    system: 'visceral',
    includeRegex: /\bpalatine\s+tonsil\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|lymph|node|crypt|fossa)\b/i,
  },
  {
    organKey: 'palatine tonsil',
    side: 'right',
    system: 'visceral',
    includeRegex: /\bpalatine\s+tonsil\b/i,
    excludeRegex: /\b(?:artery|vein|nerve|lymph|node|crypt|fossa)\b/i,
  },
];

// Female pelvic & mammary HRA organs mount natively inside FemaleZAnatomyOrgansGroup
// when viewing Z-Anatomy in Female mode, so exclude them from duplicate cross-registration.
const FEMALE_NATIVE_GROUP_ORGAN_KEYS = new Set([
  'uterus',
  'ovary',
  'fallopian tube',
  'mammary gland',
]);

function inferMeshSideFromLabelAndX(label: string, centerX: number): 'left' | 'right' | 'center' {
  const lower = label.toLowerCase();
  if (/(?:^|\b|[_.])left(?:\b|[_.])|\.[lr]\b/.test(lower)) {
    if (/(?:^|\b|[_.])left(?:\b|[_.])|\.l(?:\b|$)/.test(lower)) return 'left';
  }
  if (/(?:^|\b|[_.])right(?:\b|[_.])|\.r(?:\b|$)/.test(lower)) return 'right';
  if (centerX > 0.008) return 'left';
  if (centerX < -0.008) return 'right';
  return 'center';
}

function isHierarchyVisible(obj: THREE.Object3D): boolean {
  let curr: THREE.Object3D | null = obj;
  while (curr) {
    if (!curr.visible) return false;
    curr = curr.parent;
  }
  return true;
}

/**
 * Computes normalized bounding-box alignment mapping an NIH HRA landmark `.glb`
 * (transformed into NIH CCF parent-organ space) onto a live Z-Anatomy / Explorer organ box,
 * preserving anatomical laterality (`+X = Left`, `-X = Right`) and preventing flat-plane collapse.
 */
export function computeCrossDatasetAlignment(params: {
  lmLocalCenter: THREE.Vector3;
  lmLocalSize: THREE.Vector3;
  target: CrossDatasetTargetMatch;
}): {
  position: [number, number, number];
  scale: [number, number, number];
  quaternion: THREE.Quaternion;
} {
  const { lmLocalCenter, lmLocalSize, target } = params;

  const rotEuler = target.nihRotation
    ? new THREE.Euler(...target.nihRotation)
    : new THREE.Euler(0, 0, 0);
  const quat = new THREE.Quaternion().setFromEuler(rotEuler);

  // Rotate local size AABB softly if parent organ carries a non-zero CCF rotation
  const rotatedSize = lmLocalSize.clone();
  if (
    target.nihRotation &&
    (Math.abs(target.nihRotation[0]) > 0.01 ||
      Math.abs(target.nihRotation[1]) > 0.01 ||
      Math.abs(target.nihRotation[2]) > 0.01)
  ) {
    const tmpBox = new THREE.Box3(
      new THREE.Vector3(-lmLocalSize.x * 0.5, -lmLocalSize.y * 0.5, -lmLocalSize.z * 0.5),
      new THREE.Vector3(lmLocalSize.x * 0.5, lmLocalSize.y * 0.5, lmLocalSize.z * 0.5)
    );
    tmpBox.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(quat));
    tmpBox.getSize(rotatedSize);
  }

  const refSizeX = Math.max(rotatedSize.x, target.nihSize?.[0] ?? 0, 0.02);
  const refSizeY = Math.max(rotatedSize.y, target.nihSize?.[1] ?? 0, 0.02);
  const refSizeZ = Math.max(rotatedSize.z, target.nihSize?.[2] ?? 0, 0.02);

  const rawSx = target.zaSize[0] / refSizeX;
  const rawSy = target.zaSize[1] / refSizeY;
  const rawSz = target.zaSize[2] / refSizeZ;

  // Geometric-mean damping prevents thin bisection planes from blowing up anisotropically
  const medianScale = Math.cbrt(Math.max(1e-6, rawSx * rawSy * rawSz));
  const minS = medianScale * 0.65;
  const maxS = medianScale * 1.45;

  const sx = THREE.MathUtils.clamp(rawSx, minS, maxS);
  const sy = THREE.MathUtils.clamp(rawSy, minS, maxS);
  const sz = THREE.MathUtils.clamp(rawSz, minS, maxS);

  // Also ensure landmark center shifts appropriately after optional rotation
  const rotatedCenter = lmLocalCenter.clone().applyQuaternion(quat);
  const position: [number, number, number] = [
    target.zaCenter[0] - rotatedCenter.x * sx,
    target.zaCenter[1] - rotatedCenter.y * sy,
    target.zaCenter[2] - rotatedCenter.z * sz,
  ];

  return {
    position,
    scale: [sx, sy, sz],
    quaternion: quat,
  };
}

/**
 * Scans `SceneMeshRegistry` for visible Z-Anatomy / Explorer organs corresponding to
 * NIH HRA surgical landmark parents and pairs each eligible landmark with a live
 * world-space target box (`zaCenter`, `zaSize`) plus NIH CCF reference dimensions.
 */
function extractCanonicalOrganKey(lm: HraSurgicalLandmarkGlb): string {
  const fromSlug = (lm.parentOrganSlug ?? '')
    .trim()
    .toLowerCase()
    .replace(/-(?:male|female)(?:-(?:left|right))?$/, '')
    .replace(/-(?:left|right)$/, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (fromSlug) return fromSlug;
  return (lm.parentOrganLabel ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(?:left|right)\s+/, '')
    .replace(/,\s*(?:left|right)$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveCrossDatasetLandmarkTargets(params: {
  registry: SceneMeshRegistry;
  landmarks: HraSurgicalLandmarkGlb[];
  nihCatalog: Record<BiologicalSex, NihOrganSceneItem[]> | null;
  biologicalSex: BiologicalSex;
  activeAtlasPreset: OfficialAtlasPresetId;
  activeSystems: Record<AnatomicalSystem, boolean>;
  hiddenPartIds: string[];
  isolatedPartId: string | null;
  includeFemaleSupplementalInline?: boolean;
  ignorePresetAndSystemFilter?: boolean;
}): Array<{
  landmark: HraSurgicalLandmarkGlb;
  target: CrossDatasetTargetMatch;
}> {
  const {
    registry,
    landmarks,
    nihCatalog,
    biologicalSex,
    activeAtlasPreset,
    activeSystems,
    includeFemaleSupplementalInline = false,
    ignorePresetAndSystemFilter = false,
  } = params;

  if (landmarks.length === 0) return [];

  const soloPresetSystemMap: Partial<Record<OfficialAtlasPresetId, AnatomicalSystem>> = {
    'zanatomy-skeletal': 'skeletal',
    'zanatomy-muscular': 'muscular',
    'zanatomy-visceral': 'visceral',
    'zanatomy-cardiovascular': 'cardiovascular',
    'zanatomy-nervous': 'nervous',
    'zanatomy-integumentary': 'integumentary',
  };
  const presetSoloSystem = soloPresetSystemMap[activeAtlasPreset];

  const boxMap = new Map<
    string,
    {
      rule: CrossOrganMappingRule;
      box: THREE.Box3;
      anchorMesh: THREE.Mesh;
      anchorWeight: number;
    }
  >();

  const tmpBox = new THREE.Box3();
  const tmpCenter = new THREE.Vector3();

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

    const meshSys = (mesh.userData?.system as AnatomicalSystem | undefined) ?? 'visceral';
    if (!ignorePresetAndSystemFilter) {
      if (!activeSystems[meshSys]) continue;
      if (presetSoloSystem && meshSys !== presetSoloSystem) continue;
    }

    // Exclude NIH-space meshes (those already render HRA landmarks directly via NihManifestOrgan)
    if (mesh.userData?.parentModelContext === 'nih_visible_human') {
      continue;
    }

    const partInfo =
      (mesh.userData?.partInfo as { cleanName?: string; rawName?: string; organGroupId?: string } | undefined) ??
      (mesh.userData?.__cachedPartInfo as { cleanName?: string; rawName?: string; organGroupId?: string } | undefined);

    const searchText = `${partInfo?.cleanName ?? ''} ${mesh.name ?? ''} ${partInfo?.organGroupId ?? ''}`.trim();
    if (!searchText) continue;

    tmpBox.setFromObject(mesh);
    if (tmpBox.isEmpty()) continue;
    tmpBox.getCenter(tmpCenter);

    for (const rule of CROSS_ORGAN_RULES) {
      if (!ignorePresetAndSystemFilter) {
        if (presetSoloSystem && rule.system !== presetSoloSystem) continue;
        if (!activeSystems[rule.system]) continue;
      }
      if (!rule.includeRegex.test(searchText)) continue;
      if (rule.excludeRegex?.test(searchText)) continue;

      if (rule.side !== 'center') {
        const inferredSide = inferMeshSideFromLabelAndX(searchText, tmpCenter.x);
        if (inferredSide !== 'center' && inferredSide !== rule.side) continue;
      }

      const key = `${rule.organKey}::${rule.side}`;
      const sizeVec = tmpBox.getSize(new THREE.Vector3());
      const weight = sizeVec.x * sizeVec.y * sizeVec.z;

      const existing = boxMap.get(key);
      if (existing) {
        existing.box.union(tmpBox);
        if (weight > existing.anchorWeight) {
          existing.anchorMesh = mesh;
          existing.anchorWeight = weight;
        }
      } else {
        boxMap.set(key, {
          rule,
          box: tmpBox.clone(),
          anchorMesh: mesh,
          anchorWeight: weight,
        });
      }
    }
  }

  if (boxMap.size === 0) return [];

  const nihList = nihCatalog?.[biologicalSex] ?? [];
  const results: Array<{ landmark: HraSurgicalLandmarkGlb; target: CrossDatasetTargetMatch }> = [];
  const seenKeys = new Set<string>();

  for (const lm of landmarks) {
    if (lm.sex !== biologicalSex) continue;
    const canonicalKey = extractCanonicalOrganKey(lm);
    if (!includeFemaleSupplementalInline && FEMALE_NATIVE_GROUP_ORGAN_KEYS.has(canonicalKey)) {
      continue;
    }
    if (canonicalKey === 'placenta full term') continue;

    const bucketKey = `${canonicalKey}::${lm.side}`;
    const bucket = boxMap.get(bucketKey);
    if (!bucket) continue;

    if (seenKeys.has(lm.id)) continue;
    seenKeys.add(lm.id);

    const zaCenterVec = new THREE.Vector3();
    const zaSizeVec = new THREE.Vector3();
    bucket.box.getCenter(zaCenterVec);
    bucket.box.getSize(zaSizeVec);

    // Prevent zero-thickness fallback on sparse meshes
    zaSizeVec.set(
      Math.max(0.02, zaSizeVec.x),
      Math.max(0.02, zaSizeVec.y),
      Math.max(0.02, zaSizeVec.z)
    );

    const nihMatch = nihList.find(
      (n) =>
        n.organKey === canonicalKey &&
        (lm.side === 'center' || n.side.toLowerCase() === lm.side)
    );
    const nihSize: [number, number, number] | undefined = nihMatch?.dimensionsMm
      ? [
          nihMatch.dimensionsMm[0] / 1000,
          nihMatch.dimensionsMm[1] / 1000,
          nihMatch.dimensionsMm[2] / 1000,
        ]
      : undefined;

    const restCenter =
      (bucket.anchorMesh.userData?.__restCenter as THREE.Vector3 | undefined)?.clone() ??
      zaCenterVec.clone();

    results.push({
      landmark: lm,
      target: {
        organKey: canonicalKey,
        side: lm.side,
        system: bucket.rule.system,
        zaCenter: [zaCenterVec.x, zaCenterVec.y, zaCenterVec.z],
        zaSize: [zaSizeVec.x, zaSizeVec.y, zaSizeVec.z],
        anchorMesh: bucket.anchorMesh,
        anchorRestCenter: restCenter,
        visible: true,
        nihSize,
        nihRotation: nihMatch?.placement?.rotation,
      },
    });
  }

  return results;
}

export interface SurfaceSnapResult {
  anchorMesh: THREE.Mesh;
  localAnchor: THREE.Vector3;
  worldPosition: THREE.Vector3;
}

interface BvhHitTarget {
  point: THREE.Vector3;
  distance: number;
  faceIndex: number;
}

const _snapLocalPt = new THREE.Vector3();
const _snapWorldPt = new THREE.Vector3();
const _snapV0 = new THREE.Vector3();
const _snapV1 = new THREE.Vector3();
const _snapV2 = new THREE.Vector3();
const _snapEdge1 = new THREE.Vector3();
const _snapEdge2 = new THREE.Vector3();
const _snapLocalNormal = new THREE.Vector3();
const _snapWorldNormal = new THREE.Vector3();
const _snapNormalMatrix = new THREE.Matrix3();
const _snapInvMatrix = new THREE.Matrix4();
const _snapBoxCenter = new THREE.Vector3();

function computeFaceOutwardWorldNormal(
  mesh: THREE.Mesh,
  geometry: THREE.BufferGeometry,
  faceIndex: number,
  localHitPoint: THREE.Vector3,
  worldHitPoint: THREE.Vector3,
  targetPointWorld: THREE.Vector3
): THREE.Vector3 {
  const posAttr = geometry.attributes.position as THREE.BufferAttribute | undefined;
  if (!posAttr || faceIndex < 0) {
    return _snapWorldNormal
      .subVectors(targetPointWorld, worldHitPoint)
      .normalize();
  }

  const indexAttr = geometry.index;
  const i0 = indexAttr ? indexAttr.getX(faceIndex * 3) : faceIndex * 3;
  const i1 = indexAttr ? indexAttr.getX(faceIndex * 3 + 1) : faceIndex * 3 + 1;
  const i2 = indexAttr ? indexAttr.getX(faceIndex * 3 + 2) : faceIndex * 3 + 2;

  if (i0 < posAttr.count && i1 < posAttr.count && i2 < posAttr.count) {
    _snapV0.fromBufferAttribute(posAttr, i0);
    _snapV1.fromBufferAttribute(posAttr, i1);
    _snapV2.fromBufferAttribute(posAttr, i2);
    _snapEdge1.subVectors(_snapV1, _snapV0);
    _snapEdge2.subVectors(_snapV2, _snapV0);
    _snapLocalNormal.crossVectors(_snapEdge1, _snapEdge2);

    if (_snapLocalNormal.lengthSq() > 1e-12) {
      _snapLocalNormal.normalize();
      // Ensure normal faces outward from local bounding box center
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        geometry.boundingBox.getCenter(_snapBoxCenter);
        if (
          _snapLocalNormal.dot(_snapV0.copy(localHitPoint).sub(_snapBoxCenter)) <
          0
        ) {
          _snapLocalNormal.negate();
        }
      }
      _snapNormalMatrix.getNormalMatrix(mesh.matrixWorld);
      _snapWorldNormal.copy(_snapLocalNormal).applyMatrix3(_snapNormalMatrix);
      if (_snapWorldNormal.lengthSq() > 1e-12) {
        return _snapWorldNormal.normalize();
      }
    }
  }

  _snapWorldNormal.subVectors(targetPointWorld, worldHitPoint);
  if (_snapWorldNormal.lengthSq() > 1e-12) {
    return _snapWorldNormal.normalize();
  }
  return _snapWorldNormal.set(0, 1, 0);
}

/**
 * Snaps a world-space anatomical target point directly onto the closest outer
 * triangle surface of `candidateMeshes` using `three-mesh-bvh`
 * (`boundsTree.closestPointToPoint`), adds a +1.8mm outward normal offset so
 * the beacon rests flush on the surface without Z-fighting, and caches the
 * local-space anchor on `mesh.userData.__snappedLandmarks` for O(1) Explode
 * View tracking.
 */
export function snapLandmarkToMeshSurface(
  targetPointWorld: THREE.Vector3,
  candidateMeshes: THREE.Mesh[],
  landmarkKey: string,
  offsetMeters: number = 0.0018,
  allowSyncBvhBuild: boolean = true
): SurfaceSnapResult | null {
  if (candidateMeshes.length === 0) return null;

  // Fast-path: return cached local anchor if already computed for this landmark
  for (const mesh of candidateMeshes) {
    const cache = mesh.userData?.__snappedLandmarks as
      | Record<string, [number, number, number]>
      | undefined;
    const cached = cache?.[landmarkKey];
    if (cached) {
      mesh.updateWorldMatrix(true, false);
      const localAnchor = new THREE.Vector3(cached[0], cached[1], cached[2]);
      const worldPosition = localAnchor.clone().applyMatrix4(mesh.matrixWorld);
      return { anchorMesh: mesh, localAnchor, worldPosition };
    }
  }

  let bestMesh: THREE.Mesh | null = null;
  let bestDistSq = Infinity;
  const bestLocalHit = new THREE.Vector3();
  let bestFaceIndex = -1;

  const hitTarget: BvhHitTarget = {
    point: new THREE.Vector3(),
    distance: Infinity,
    faceIndex: -1,
  };

  for (const mesh of candidateMeshes) {
    if (!mesh.visible) continue;
    const geom = mesh.geometry;
    if (!geom || !geom.attributes?.position) continue;

    if (!geom.boundsTree && typeof geom.computeBoundsTree === 'function') {
      if (allowSyncBvhBuild) {
        try {
          geom.computeBoundsTree();
        } catch {
          // Fallback if geometry is malformed
        }
      } else {
        enqueueGeometryBVH(geom);
        continue;
      }
    }
    if (!geom.boundsTree) continue;

    mesh.updateWorldMatrix(true, false);
    _snapInvMatrix.copy(mesh.matrixWorld).invert();
    _snapLocalPt.copy(targetPointWorld).applyMatrix4(_snapInvMatrix);

    const res = geom.boundsTree.closestPointToPoint(_snapLocalPt, hitTarget);
    if (!res) continue;

    _snapWorldPt.copy(res.point).applyMatrix4(mesh.matrixWorld);
    const distSq = _snapWorldPt.distanceToSquared(targetPointWorld);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestMesh = mesh;
      bestLocalHit.copy(res.point);
      bestFaceIndex = res.faceIndex;
    }
  }

  if (!bestMesh) return null;

  bestMesh.updateWorldMatrix(true, false);
  const worldHitPoint = bestLocalHit.clone().applyMatrix4(bestMesh.matrixWorld);
  const outwardNormal = computeFaceOutwardWorldNormal(
    bestMesh,
    bestMesh.geometry,
    bestFaceIndex,
    bestLocalHit,
    worldHitPoint,
    targetPointWorld
  );

  const worldPosition = worldHitPoint.addScaledVector(
    outwardNormal,
    offsetMeters
  );
  const localAnchor = bestMesh.worldToLocal(worldPosition.clone());

  if (!bestMesh.userData.__snappedLandmarks) {
    bestMesh.userData.__snappedLandmarks = {};
  }
  (
    bestMesh.userData.__snappedLandmarks as Record<
      string,
      [number, number, number]
    >
  )[landmarkKey] = [localAnchor.x, localAnchor.y, localAnchor.z];

  return { anchorMesh: bestMesh, localAnchor, worldPosition };
}
