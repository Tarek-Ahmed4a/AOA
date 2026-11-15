import * as THREE from 'three';
import {
  HOVERED_EMISSIVE_COLOR,
  SELECTED_EMISSIVE_COLOR,
  ZERO_EMISSIVE_COLOR,
} from './tissueShader';

export type AnatomicalHighlightState = 0 | 1 | 2; // 0 = normal, 1 = hovered, 2 = selected

/**
 * Clones a mesh's authored material intact without modifying diffuse colors,
 * vertex colors, textures, roughness, metalness, or shaders. Only the cloned
 * material receives an interactive emissive tint when hovered or selected.
 */
export function cloneClinicalHighlightMaterial(
  srcMat: THREE.Material
): THREE.Material {
  return srcMat.clone();
}

/**
 * Updates interactive emissive highlight state (0 = none, 1 = hover, 2 = selected)
 * without altering original PBR diffuse color, roughness, metalness, or maps.
 */
export function setClinicalHighlightState(
  mat: THREE.Material,
  highlightState: AnatomicalHighlightState
): void {
  const stdMat = mat as THREE.MeshStandardMaterial;
  if (!stdMat || !stdMat.emissive) return;

  if (highlightState === 2) {
    stdMat.emissive.copy(SELECTED_EMISSIVE_COLOR);
    stdMat.emissiveIntensity = 0.42;
  } else if (highlightState === 1) {
    stdMat.emissive.copy(HOVERED_EMISSIVE_COLOR);
    stdMat.emissiveIntensity = 0.28;
  } else {
    stdMat.emissive.copy(ZERO_EMISSIVE_COLOR);
    stdMat.emissiveIntensity = 0;
  }
}
