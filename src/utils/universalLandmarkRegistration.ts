import * as THREE from 'three';
import type { AnatomicalSystem, BiologicalSex, OfficialAtlasPresetId } from '../store/useAnatomyStore';
import type { SceneMeshRegistry } from '../utils/bvhSetup';
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
    excludeRegex: /\b(?:artery|vein|trunk|lymph|nerve|plexus|ligament|pleura)\b/i,
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
    excludeRegex: /\b(?:artery|vein|nerve|plexus|lymph|mesenter)\b/i,
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
    includeRegex: /\b(?:larynx|thyroid\s+cartilage|cricoid|arytenoid|epiglottis)\b/i,
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
    includeRegex: /\b(?:spinal\s+cord|medulla\s+spinalis|conus\s+medullaris)\b/i,
    excludeRegex: /\b(?:artery|vein|vertebra)\b/i,
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
    if (!includeFemaleSupplementalInline && FEMALE_NATIVE_GROUP_ORGAN_KEYS.has(lm.parentOrganKey)) {
      continue;
    }
    if (lm.parentOrganKey === 'placenta full term') continue;

    const bucketKey = `${lm.parentOrganKey}::${lm.side}`;
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
        n.organKey === lm.parentOrganKey &&
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
        organKey: lm.parentOrganKey,
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
