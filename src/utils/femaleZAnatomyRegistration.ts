import * as THREE from 'three';

export const FEMALE_PELVIC_ORGAN_IDS = [
  'uterus-female',
  'ovary-female-left',
  'ovary-female-right',
  'fallopian-tube-female-left',
  'fallopian-tube-female-right',
] as const;

export const FEMALE_MAMMARY_ORGAN_IDS = [
  'mammary-gland-female-left',
  'mammary-gland-female-right',
] as const;

export const FEMALE_ZANATOMY_ORGAN_IDS = [
  ...FEMALE_PELVIC_ORGAN_IDS,
  ...FEMALE_MAMMARY_ORGAN_IDS,
] as const;

export const FEMALE_ZANATOMY_ORGAN_ID_SET: ReadonlySet<string> = new Set(
  FEMALE_ZANATOMY_ORGAN_IDS
);

export const PELVIC_FALLBACK_ANCHOR = new THREE.Vector3(0.0, 0.838, 0.016);
export const PELVIC_TARGET_SPAN_X = 0.115;

export const MAMMARY_FALLBACK_ANCHOR_LEFT = new THREE.Vector3(
  0.086,
  1.268,
  0.092
);
export const MAMMARY_FALLBACK_ANCHOR_RIGHT = new THREE.Vector3(
  -0.086,
  1.268,
  0.092
);
export const MAMMARY_TARGET_DIMS = {
  width: 0.095,
  height: 0.095,
  depth: 0.048,
} as const;

export const FEMALE_NOISE_SUBMESH_REGEX =
  /(?:^|_)fat(?:_|$)|retina|skin_envelope/i;

export interface RigidTransformResult {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  anchor: THREE.Vector3;
  rawCenter: THREE.Vector3;
}

/**
 * Computes ONE cohesive rigid similarity transform for all 5 NIH female pelvic organs
 * (`uterus`, `ovary L/R`, `fallopian tube L/R`) so fallopian isthmuses stay seamlessly
 * docked to the uterine cornua and infundibula clasp the ovaries cleanly inside the
 * Z-Anatomy pelvic cavity (`X = 0.000m, Y = 0.838m, Z = +0.016m`).
 */
export function computeCohesivePelvicTransform(
  combinedRawBox: THREE.Box3,
  bladderWorldBox?: THREE.Box3 | null
): RigidTransformResult {
  const rawSize = combinedRawBox.getSize(new THREE.Vector3());
  const rawCenter = combinedRawBox.getCenter(new THREE.Vector3());
  const uniformScale = PELVIC_TARGET_SPAN_X / Math.max(rawSize.x, 0.01);

  const anchor = PELVIC_FALLBACK_ANCHOR.clone();
  if (bladderWorldBox && !bladderWorldBox.isEmpty()) {
    const bc = bladderWorldBox.getCenter(new THREE.Vector3());
    anchor.set(
      THREE.MathUtils.clamp(bc.x, -0.008, 0.008),
      THREE.MathUtils.clamp(bc.y - 0.0456, 0.822, 0.854),
      THREE.MathUtils.clamp(bc.z + 0.0145, 0.006, 0.026)
    );
  }

  const position = anchor
    .clone()
    .addScaledVector(rawCenter, -uniformScale);

  return {
    position,
    scale: new THREE.Vector3(uniformScale, uniformScale, uniformScale),
    anchor,
    rawCenter,
  };
}

/**
 * Computes an anatomically fitted rigid transform for Left or Right NIH mammary gland
 * anchored dynamically over Z-Anatomy `Pectoralis Major` (fallback `L:[+0.086, 1.268, +0.092]`,
 * `R:[-0.086, 1.268, +0.092]`) at physiological dimensions (`0.095m x 0.095m x 0.048m`).
 */
export function computeMammaryGlandTransform(
  side: 'left' | 'right',
  rawGlandBox: THREE.Box3,
  pectoralisWorldBox?: THREE.Box3 | null
): RigidTransformResult {
  const rawSize = rawGlandBox.getSize(new THREE.Vector3());
  const rawCenter = rawGlandBox.getCenter(new THREE.Vector3());

  const scale = new THREE.Vector3(
    MAMMARY_TARGET_DIMS.width / Math.max(rawSize.x, 0.01),
    MAMMARY_TARGET_DIMS.height / Math.max(rawSize.y, 0.01),
    MAMMARY_TARGET_DIMS.depth / Math.max(rawSize.z, 0.01)
  );

  const anchor =
    side === 'left'
      ? MAMMARY_FALLBACK_ANCHOR_LEFT.clone()
      : MAMMARY_FALLBACK_ANCHOR_RIGHT.clone();

  if (pectoralisWorldBox && !pectoralisWorldBox.isEmpty()) {
    const pc = pectoralisWorldBox.getCenter(new THREE.Vector3());
    const xSign = side === 'left' ? 1 : -1;
    anchor.set(
      xSign * THREE.MathUtils.clamp(Math.abs(pc.x) * 0.86, 0.078, 0.096),
      THREE.MathUtils.clamp(pc.y - 0.042, 1.245, 1.292),
      THREE.MathUtils.clamp(pectoralisWorldBox.max.z - 0.032, 0.084, 0.104)
    );
  }

  const position = new THREE.Vector3(
    anchor.x - rawCenter.x * scale.x,
    anchor.y - rawCenter.y * scale.y,
    anchor.z - rawCenter.z * scale.z
  );

  return {
    position,
    scale,
    anchor,
    rawCenter,
  };
}

/**
 * Computes raw local GLB Box3 of a mounted NIH organ while strictly excluding fat pads.
 */
export function computeFilteredRawOrganBox(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  const temp = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (FEMALE_NOISE_SUBMESH_REGEX.test(mesh.name || '')) return;
    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }
    if (mesh.geometry.boundingBox) {
      temp.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
      box.union(temp);
    }
  });
  return box;
}

const calibratedMaterialPool = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Hides noisy sub-meshes (`fat`) and remediates ONLY raw neon-blue NIH CAD
 * marker materials (`Skin_mat`) while preserving 100% of original natural
 * materials, textures, roughness, metalness, and colors.
 */
export function calibrateFemaleZAnatomyMaterials(
  _organId: string,
  root: THREE.Object3D
): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    const meshName = mesh.name || '';
    if (FEMALE_NOISE_SUBMESH_REGEX.test(meshName)) {
      mesh.visible = false;
      mesh.userData.__isNoiseSubmesh = true;
      mesh.userData.__originallyVisible = false;
      mesh.raycast = () => undefined;
      return;
    }

    const srcMats = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    const updatedMats = srcMats.map((rawMat) => {
      if (!rawMat) return rawMat;
      const stdMat = rawMat as THREE.MeshStandardMaterial;
      const isNeonBlueCadSkin = Boolean(
        stdMat.color &&
          !stdMat.map &&
          stdMat.color.b > 0.5 &&
          stdMat.color.r < 0.2 &&
          stdMat.color.g < 0.25
      );
      const colorHex = isNeonBlueCadSkin
        ? 'd8a997'
        : stdMat.color
          ? stdMat.color.getHexString()
          : 'none';
      const poolKey = [
        stdMat.type,
        stdMat.name ?? '',
        colorHex,
        Number(stdMat.roughness ?? 0.5).toFixed(2),
        Number(stdMat.metalness ?? 0).toFixed(2),
        Number(stdMat.opacity ?? 1).toFixed(2),
        stdMat.transparent ? 1 : 0,
        stdMat.map?.uuid ?? 'nomap',
      ].join('|');

      let pooled = calibratedMaterialPool.get(poolKey);
      if (!pooled) {
        const cloned = rawMat.clone() as THREE.MeshStandardMaterial;
        if (isNeonBlueCadSkin && cloned.color) {
          // Remediate raw NIH CAD marker Skin_mat neon-blue without altering natural tissues
          cloned.color.set('#d8a997');
        }
        cloned.side = THREE.FrontSide;
        cloned.shadowSide = THREE.FrontSide;
        cloned.userData = {
          ...cloned.userData,
          __isPooledMaterial: true,
        };
        calibratedMaterialPool.set(poolKey, cloned);
        pooled = cloned;
      }
      return pooled;
    });

    mesh.material = Array.isArray(mesh.material)
      ? updatedMats
      : updatedMats[0];
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.originalMaterial = mesh.material;
    mesh.userData.__anatomicalSystem = 'visceral';
    mesh.userData.system = 'visceral';
  });
}
