import * as THREE from 'three';

/**
 * Resolves the effective per-part opacity override (`0.05..1.0`) for a mounted mesh
 * by checking its `uuid`, `name`, and `organGroupId`.
 */
export function resolveMeshOpacityOverride(
  mesh: THREE.Mesh,
  overrides: Record<string, number>
): number | undefined {
  if (!overrides) return undefined;
  const byUuid = overrides[mesh.uuid];
  if (typeof byUuid === 'number') return byUuid;
  if (mesh.name && typeof overrides[mesh.name] === 'number') {
    return overrides[mesh.name];
  }
  const grp = mesh.userData?.organGroupId as string | undefined;
  if (grp && typeof overrides[grp] === 'number') {
    return overrides[grp];
  }
  return undefined;
}

/**
 * Returns the mesh's underlying non-highlighted material (`__opacityCloneMat` if
 * per-part opacity is active, otherwise `__sharedMaterial` or `mesh.material`).
 */
export function getMeshNonHighlightMaterial(
  mesh: THREE.Mesh
): THREE.Material | THREE.Material[] {
  return (
    (mesh.userData?.__opacityCloneMat as
      | THREE.Material
      | THREE.Material[]
      | undefined) ??
    (mesh.userData?.__sharedMaterial as
      | THREE.Material
      | THREE.Material[]
      | undefined) ??
    mesh.material
  );
}

function syncMaterialCloneProps(
  cloneMat: THREE.Material,
  baseMat: THREE.Material,
  overrideOpacity: number
): void {
  const src = baseMat as THREE.MeshStandardMaterial;
  const dst = cloneMat as THREE.MeshStandardMaterial;

  dst.transparent = true;
  dst.opacity = overrideOpacity;
  // Disable depthWrite below 85% so deeper bones/vessels/nerves behind/inside remain 100% visible
  dst.depthWrite = overrideOpacity >= 0.85;
  dst.clippingPlanes = src.clippingPlanes ?? null;
  dst.clipShadows = Boolean(src.clipShadows);
  dst.side = src.side;
  dst.shadowSide = src.shadowSide;
  if ('emissive' in src && 'emissive' in dst && src.emissive && dst.emissive) {
    dst.emissive.copy(src.emissive);
    dst.emissiveIntensity = src.emissiveIntensity;
  }
  dst.needsUpdate = true;
}

/**
 * Applies or clears a per-structure isolated opacity clone (`__opacityCloneMat`)
 * without mutating any shared/pooled material used by other meshes, and preserves
 * all PBR textures (`map`, `normalMap`, `roughnessMap`, etc.).
 */
export function applyMeshPartOpacityOverride(
  mesh: THREE.Mesh,
  overrideOpacity: number | undefined,
  baseRenderOrder: number
): void {
  const baseMat =
    (mesh.userData?.__sharedMaterial as
      | THREE.Material
      | THREE.Material[]
      | undefined) ?? mesh.material;

  if (!baseMat) return;
  if (!mesh.userData.__sharedMaterial) {
    mesh.userData.__sharedMaterial = baseMat;
  }

  const isHighlighted = Boolean(mesh.userData?.__highlightMaterial);

  if (overrideOpacity !== undefined && overrideOpacity < 0.99) {
    const clamped = THREE.MathUtils.clamp(overrideOpacity, 0.05, 1.0);
    let cloneMat = mesh.userData.__opacityCloneMat as
      | THREE.Material
      | THREE.Material[]
      | undefined;

    if (!cloneMat) {
      cloneMat = Array.isArray(baseMat)
        ? baseMat.map((m) => m.clone())
        : baseMat.clone();
      mesh.userData.__opacityCloneMat = cloneMat;
    }

    if (Array.isArray(cloneMat)) {
      const baseArr = Array.isArray(baseMat) ? baseMat : [baseMat];
      cloneMat.forEach((m, idx) =>
        syncMaterialCloneProps(m, baseArr[idx] ?? baseArr[0], clamped)
      );
    } else {
      const singleBase = Array.isArray(baseMat) ? baseMat[0] : baseMat;
      syncMaterialCloneProps(cloneMat, singleBase, clamped);
    }

    if (!isHighlighted) {
      mesh.material = cloneMat;
    }
    mesh.renderOrder = 25;
  } else {
    if (!isHighlighted && mesh.material !== baseMat) {
      mesh.material = baseMat;
    }
    mesh.renderOrder = baseRenderOrder;
  }
}

/**
 * Disposes any cached `__opacityCloneMat` created on a mesh during unmount.
 */
export function disposeMeshOpacityClone(mesh: THREE.Mesh): void {
  const cloneMat = mesh.userData?.__opacityCloneMat as
    | THREE.Material
    | THREE.Material[]
    | undefined;
  if (!cloneMat) return;
  (Array.isArray(cloneMat) ? cloneMat : [cloneMat]).forEach((m) =>
    m?.dispose()
  );
  mesh.userData.__opacityCloneMat = undefined;
}
