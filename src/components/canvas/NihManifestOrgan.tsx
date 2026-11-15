import React, { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  useAnatomyStore,
  type AnatomicalSystem,
} from '../../store/useAnatomyStore';
import type { NihOrganSceneItem } from '../../services/nihSceneService';
import { resolveAssetUrl } from '../../utils/assetUrl';
import {
  enqueueGeometryBVH,
  registerSceneMesh,
  unregisterSceneMesh,
  useSceneMeshRegistry,
} from '../../utils/bvhSetup';
import {
  INTERNAL_TISSUE_COLORS,
  useClippingPlane,
} from '../../utils/slicingPlane';
import {
  GHOST_EMISSIVE_COLOR,
  ZERO_EMISSIVE_COLOR,
} from '../../utils/tissueShader';
import {
  isFemaleOnlyMesh,
  isMaleOnlyMesh,
} from '../../utils/sexDimorphismFilter';
import {
  resolveExplodeClusterId,
  applyRigidMacroExplodeOffset,
  type ExplodeClusterId,
} from '../../utils/explodeClusters';

function formatNihReadableName(
  rawMeshName: string,
  entry: NihOrganSceneItem
): string {
  const cleaned = rawMeshName
    .replace(/^(VH_[MF]_|Allen_brain_|Allen_|Yao_|SBU_[MF]_|SBU_|NIH_)/i, '')
    .replace(/\.[0-9]+$/g, '')
    .replace(/_[a-z]$/i, '')
    .replace(/_l$/i, ' Left')
    .replace(/_r$/i, ' Right')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2) {
    return entry.name;
  }

  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

const NOOP_RAYCAST: THREE.Mesh['raycast'] = () => {};

const NOISE_SUBMESH_REGEX =
  /\b(adipose|omentum|épiploon|epiploon|peritoneum|péritoine|peritoine|epiploic|mesentery|mésentère|mesentere|nodus)\b|ganglion[\s_-]*lymphatique|_fat_[lr]\b/i;

/**
 * Clones each native GLB material into a lightweight MeshStandardMaterial while
 * strictly preserving all original authored albedo/normal/roughness/metalness/AO maps,
 * material colors, and vertex colors (zero artificial color overrides).
 */
export function cloneAndEnhanceNihMaterial(
  sourceMat: THREE.Material,
  system: AnatomicalSystem,
  hasVertexColors: boolean,
  _tissueColor: THREE.Color,
  _structureHint = ''
): THREE.MeshStandardMaterial {
  const mat = sourceMat.clone() as THREE.MeshStandardMaterial;
  mat.userData.__origSide = THREE.FrontSide;
  mat.side = THREE.FrontSide;
  mat.shadowSide = THREE.FrontSide;

  if (mat.color && !mat.map && system !== 'cardiovascular') {
    if (mat.color.b > 0.5 && mat.color.r < 0.2 && mat.color.g < 0.25) {
      mat.color.set(system === 'integumentary' ? '#e5b59a' : '#d8a997');
    }
  }

  if (system === 'integumentary') {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = 1;
    mat.polygonOffsetUnits = 1;
  }

  if (mat.map) {
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.map.needsUpdate = true;
  }
  if (hasVertexColors) {
    mat.vertexColors = true;
  }

  mat.userData.__anatomicalSystem = system;
  mat.userData.__baseEmissive = mat.emissive
    ? mat.emissive.clone()
    : ZERO_EMISSIVE_COLOR.clone();
  mat.userData.__baseEmissiveIntensity = mat.emissiveIntensity ?? 0;

  return mat;
}

export interface SharedSystemMaterialEntry {
  mat: THREE.MeshStandardMaterial;
  system: AnatomicalSystem;
}

/**
 * Returns a deduplicated shared MeshStandardMaterial keyed by source material UUID,
 * system, and vertex color usage so loaded GLB meshes batch efficiently without per-mesh clones.
 */
export function getOrCreateSharedStandardMaterial(
  cache: Map<string, SharedSystemMaterialEntry>,
  sourceMat: THREE.Material,
  system: AnatomicalSystem,
  hasVertexColors: boolean,
  tissueColor: THREE.Color,
  structureHint = ''
): THREE.MeshStandardMaterial {
  const std = sourceMat as THREE.MeshStandardMaterial;
  const isSkinPlaceholder = /^Skin_mat/i.test(sourceMat.name || '');
  const colorSig = std.color ? std.color.getHexString() : 'ffffff';
  const emissiveSig = std.emissive ? std.emissive.getHexString() : '000000';
  const emissiveInt =
    typeof std.emissiveIntensity === 'number'
      ? std.emissiveIntensity.toFixed(2)
      : '1.00';
  const roughSig =
    typeof std.roughness === 'number' ? std.roughness.toFixed(3) : '1.000';
  const metalSig =
    typeof std.metalness === 'number' ? std.metalness.toFixed(3) : '0.000';
  const opacitySig =
    typeof std.opacity === 'number' ? std.opacity.toFixed(3) : '1.000';
  const alphaTestSig =
    typeof std.alphaTest === 'number' ? std.alphaTest.toFixed(2) : '0.00';
  const flatSig = std.flatShading ? 1 : 0;
  const mapSig = std.map?.uuid ?? '';
  const normalSig = std.normalMap?.uuid ?? '';
  const roughMapSig = std.roughnessMap?.uuid ?? '';
  const metalMapSig = std.metalnessMap?.uuid ?? '';
  const aoMapSig = std.aoMap?.uuid ?? '';
  const alphaMapSig = std.alphaMap?.uuid ?? '';
  const bumpMapSig = std.bumpMap?.uuid ?? '';
  const key = `${system}::${hasVertexColors ? 1 : 0}::${colorSig}::${emissiveSig}::${emissiveInt}::${roughSig}::${metalSig}::${opacitySig}::${alphaTestSig}::${std.transparent ? 1 : 0}::${flatSig}::${mapSig}::${normalSig}::${roughMapSig}::${metalMapSig}::${aoMapSig}::${alphaMapSig}::${bumpMapSig}${
    isSkinPlaceholder && structureHint ? `::${structureHint}` : ''
  }`;
  const existing = cache.get(key);
  if (existing) return existing.mat;

  const created = cloneAndEnhanceNihMaterial(
    sourceMat,
    system,
    hasVertexColors,
    tissueColor,
    structureHint
  );
  cache.set(key, { mat: created, system });
  return created;
}

interface NihManifestOrganGLBProps {
  entry: NihOrganSceneItem;
  urlOverride?: string;
  forceVisible?: boolean;
  onOrganMounted: (
    entry: NihOrganSceneItem,
    scene: THREE.Object3D
  ) => void;
  onOrganUnmounted: (organId: string) => void;
}

export const NihManifestOrganGLB: React.FC<NihManifestOrganGLBProps> = ({
  entry,
  urlOverride,
  forceVisible = false,
  onOrganMounted,
  onOrganUnmounted,
}) => {
  const gltf = useGLTF(resolveAssetUrl(urlOverride ?? entry.activeUrl));
  const system = entry.system;

  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const storeSystemActive = useAnatomyStore((s) => s.activeSystems[system]);
  const isSystemActive = storeSystemActive || forceVisible;
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity[system]);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);
  const slicing = useAnatomyStore((s) => s.slicing);

  const registry = useSceneMeshRegistry();
  const clippingPlane = useClippingPlane();
  const clippingPlanesList = useMemo(() => [clippingPlane], [clippingPlane]);

  const tissueColor = useMemo(
    () => new THREE.Color(INTERNAL_TISSUE_COLORS[system]),
    [system]
  );

  const { clonedScene, sharedMaterials, registeredMeshes } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const matCache = new Map<string, SharedSystemMaterialEntry>();
    const meshes: THREE.Mesh[] = [];
    const box = new THREE.Box3();
    const organBoxes = new Map<string, THREE.Box3>();
    const collectedMeshes: Array<{
      mesh: THREE.Mesh;
      organGroupId: string;
      isNoiseMesh: boolean;
      geomLocalCenter: THREE.Vector3;
    }> = [];
    let meshIndex = 0;

    clone.updateMatrixWorld(true);

    // Pass 1: Assign names, build BVH, and merge bounding boxes per logical organ group
    clone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      meshIndex += 1;

      if (!mesh.name) {
        mesh.name = `${entry.name || entry.id}_sub_${meshIndex}`;
      }

      if (mesh.geometry && !mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox();
      }

      box.setFromObject(mesh);
      const explicitGroupId =
        typeof mesh.userData?.organGroupId === 'string' &&
        mesh.userData.organGroupId.trim().length > 0
          ? mesh.userData.organGroupId.trim()
          : '';
      const rawGroupBase =
        explicitGroupId ||
        (mesh.parent && mesh.parent !== clone && mesh.parent.name
          ? mesh.parent.name
          : mesh.name)
          .replace(/(?:_\d+|\.\d{3}|_primitive\d+|Primitive_\d+)$/i, '')
          .trim() ||
        entry.id;
      const organGroupId = `${entry.id}::${rawGroupBase}`;

      if (!box.isEmpty()) {
        const prevGroupBox = organBoxes.get(organGroupId);
        if (prevGroupBox) {
          prevGroupBox.union(box);
        } else {
          organBoxes.set(organGroupId, box.clone());
        }
      }

      const geomLocalCenter = mesh.geometry?.boundingBox
        ? mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
        : new THREE.Vector3();

      collectedMeshes.push({
        mesh,
        organGroupId,
        isNoiseMesh: NOISE_SUBMESH_REGEX.test(mesh.name),
        geomLocalCenter,
      });
    });

    const sharedCenterVec = new THREE.Vector3();

    // Pass 2: Assign rigid macro-unit explode cluster IDs & preserve authentic materials
    for (const { mesh, organGroupId, isNoiseMesh, geomLocalCenter } of collectedMeshes) {
      const groupBox = organBoxes.get(organGroupId);
      if (groupBox && !groupBox.isEmpty()) {
        groupBox.getCenter(sharedCenterVec);
      } else {
        box.setFromObject(mesh);
        box.getCenter(sharedCenterVec);
      }

      const explodeClusterId = resolveExplodeClusterId(
        `${entry.name} ${entry.organKey} ${entry.side ?? ''} ${mesh.name}`,
        system,
        sharedCenterVec
      );

      const hasVertexColors = Boolean(mesh.geometry?.getAttribute('color'));

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) =>
          getOrCreateSharedStandardMaterial(
            matCache,
            m,
            system,
            hasVertexColors,
            tissueColor,
            mesh.name
          )
        );
      } else if (mesh.material) {
        mesh.material = getOrCreateSharedStandardMaterial(
          matCache,
          mesh.material,
          system,
          hasVertexColors,
          tissueColor,
          mesh.name
        );
      }

      const isMaleOnly =
        entry.sex === 'male' ||
        entry.organKey === 'prostate' ||
        isMaleOnlyMesh(mesh);
      const isFemaleOnly =
        entry.sex === 'female' ||
        entry.organKey === 'uterus' ||
        entry.organKey === 'ovary' ||
        entry.organKey === 'fallopian tube' ||
        entry.organKey === 'mammary gland' ||
        isFemaleOnlyMesh(mesh);

      mesh.userData = {
        ...mesh.userData,
        anatomicalName: formatNihReadableName(mesh.name, entry),
        organGroupId,
        system,
        ta98Code: entry.ta98Code,
        ontologyId: entry.ontologyId,
        nihOrganId: entry.id,
        __isNoiseFiltered: isNoiseMesh,
        __isMaleOnly: isMaleOnly,
        __isFemaleOnly: isFemaleOnly,
        __restPosition: mesh.position.clone(),
        __restCenter: sharedCenterVec.clone(),
        __localCenter: geomLocalCenter,
        __explodeClusterId: explodeClusterId,
        __sharedMaterial: mesh.material,
        __origRaycast: mesh.raycast,
      };

      if (isNoiseMesh) {
        mesh.visible = false;
        mesh.layers.disable(0);
        mesh.raycast = NOOP_RAYCAST;
      } else {
        meshes.push(mesh);
      }
    }

    return {
      clonedScene: clone,
      sharedMaterials: Array.from(matCache.values()),
      registeredMeshes: meshes,
    };
  }, [gltf.scene, entry, system, tissueColor]);

  useEffect(() => {
    registeredMeshes.forEach((m) => registerSceneMesh(m, registry));
    onOrganMounted(entry, clonedScene);
    return () => {
      registeredMeshes.forEach((m) => unregisterSceneMesh(m, registry));
      onOrganUnmounted(entry.id);
    };
  }, [entry, clonedScene, registeredMeshes, registry, onOrganMounted, onOrganUnmounted]);

  // Dispose shared materials and any active highlight clone on unmount
  useEffect(() => {
    return () => {
      registeredMeshes.forEach((mesh) => {
        const hi = mesh.userData?.__highlightMaterial as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (hi) {
          (Array.isArray(hi) ? hi : [hi]).forEach((m) => m?.dispose());
          mesh.userData.__highlightMaterial = undefined;
        }
        if (mesh.userData?.__sharedMaterial) {
          mesh.material = mesh.userData.__sharedMaterial;
        }
      });
      sharedMaterials.forEach(({ mat }) => mat.dispose());
    };
  }, [registeredMeshes, sharedMaterials]);

  // Apply rigid macro-unit explode offsets declaratively without per-frame useFrame traversal
  useEffect(() => {
    clonedScene.parent?.updateWorldMatrix(true, false);
    clonedScene.updateMatrixWorld(true);
    const explodeCtx = { activeAtlasPreset, activeSystems };

    for (const mesh of registeredMeshes) {
      const restPos = mesh.userData?.__restPosition as
        | THREE.Vector3
        | undefined;
      const clusterId = mesh.userData?.__explodeClusterId as
        | ExplodeClusterId
        | undefined;
      if (restPos) {
        applyRigidMacroExplodeOffset(
          mesh,
          clusterId,
          explodeFactor,
          restPos,
          explodeCtx
        );
      }
    }
  }, [clonedScene, registeredMeshes, explodeFactor, activeAtlasPreset, activeSystems]);

  // Synchronize visibility, raycast layers, X-ray, opacity, renderOrder, and cross-section clipping
  useEffect(() => {
    const isInternalSelection =
      selectedPart !== null && selectedPart.system !== 'integumentary';
    const hasFocus = isolatedPartId !== null || selectedPart !== null;

    let effectiveOpacity = xrayGhostMode && hasFocus ? 0.1 : systemOpacity;
    if (xrayGhostMode && !hasFocus) {
      effectiveOpacity = 0.1;
    }
    if (system === 'integumentary' && isInternalSelection) {
      effectiveOpacity = xrayGhostMode ? 0.08 : Math.min(systemOpacity, 0.12);
    }
    const isTranslucentLayer = xrayGhostMode || effectiveOpacity < 0.85;
    const effectiveTransparent = isTranslucentLayer || effectiveOpacity < 1;
    const effectiveDepthWrite =
      !isTranslucentLayer && effectiveOpacity >= 0.99;
    const sharedSliced = slicing.enabled && slicing.scope === 'all';
    const targetRenderOrder = effectiveTransparent
      ? system === 'integumentary'
        ? 11
        : 10
      : 2;

    for (const { mat } of sharedMaterials) {
      mat.clippingPlanes = sharedSliced ? clippingPlanesList : null;
      mat.clipShadows = sharedSliced;
      mat.side = sharedSliced ? THREE.DoubleSide : THREE.FrontSide;
      mat.shadowSide = mat.side;
      mat.transparent = effectiveTransparent;
      mat.opacity = effectiveOpacity;
      mat.depthWrite = effectiveDepthWrite;
      const baseEmissive =
        (mat.userData?.__baseEmissive as THREE.Color | undefined) ??
        ZERO_EMISSIVE_COLOR;
      const baseIntensity =
        (mat.userData?.__baseEmissiveIntensity as number | undefined) ?? 0;
      if (xrayGhostMode) {
        mat.emissive.copy(GHOST_EMISSIVE_COLOR);
        mat.emissiveIntensity = 0.35;
      } else {
        mat.emissive.copy(baseEmissive);
        mat.emissiveIntensity = baseIntensity;
      }
    }

    for (const mesh of registeredMeshes) {
      const rawId = mesh.name;
      const isHiddenForSex =
        (biologicalSex === 'female' && Boolean(mesh.userData?.__isMaleOnly)) ||
        (biologicalSex === 'male' && Boolean(mesh.userData?.__isFemaleOnly));
      const isHiddenByPeel =
        hiddenPartIds.includes(mesh.uuid) || hiddenPartIds.includes(rawId);
      const isIsolatedOut =
        isolatedPartId !== null &&
        !xrayGhostMode &&
        isolatedPartId !== mesh.uuid &&
        isolatedPartId !== rawId;

      const isVisible =
        !isHiddenForSex && isSystemActive && !isHiddenByPeel && !isIsolatedOut;
      mesh.visible = isVisible;
      const origRaycast =
        (mesh.userData?.__origRaycast as THREE.Mesh['raycast'] | undefined) ??
        THREE.Mesh.prototype.raycast;
      mesh.raycast = isVisible ? origRaycast : NOOP_RAYCAST;
      if (isVisible) {
        mesh.layers.enable(0);
        enqueueGeometryBVH(mesh.geometry);
      } else {
        mesh.layers.disable(0);
      }
      mesh.renderOrder = targetRenderOrder;
    }
  }, [
    registeredMeshes,
    sharedMaterials,
    system,
    biologicalSex,
    isSystemActive,
    systemOpacity,
    selectedPart,
    hiddenPartIds,
    isolatedPartId,
    xrayGhostMode,
    slicing.enabled,
    slicing.scope,
  ]);

  return (
    <group
      name={`NIH_${entry.id}`}
      position={entry.placement.translation}
      rotation={entry.placement.rotation}
      scale={entry.placement.scale}
    >
      <primitive object={clonedScene} visible={isSystemActive} />
    </group>
  );
};
