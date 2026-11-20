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
 * Updates interactive highlight state (0 = none, 1 = hover, 2 = selected)
 * without altering authored PBR diffuse color, roughness, metalness, or maps.
 * Supports both emissive PBR materials and unlit MeshBasicMaterial scans.
 */
export function setClinicalHighlightState(
  mat: THREE.Material,
  highlightState: AnatomicalHighlightState,
  subtleIsolated: boolean = false
): void {
  const stdMat = mat as THREE.MeshStandardMaterial;
  if (stdMat && 'emissive' in stdMat && stdMat.emissive) {
    if (highlightState === 2) {
      stdMat.emissive.copy(SELECTED_EMISSIVE_COLOR);
      stdMat.emissiveIntensity = subtleIsolated ? 0.05 : 0.15;
    } else if (highlightState === 1) {
      stdMat.emissive.copy(HOVERED_EMISSIVE_COLOR);
      stdMat.emissiveIntensity = 0.09;
    } else {
      stdMat.emissive.copy(ZERO_EMISSIVE_COLOR);
      stdMat.emissiveIntensity = 0;
    }
    return;
  }

  const basicMat = mat as THREE.MeshBasicMaterial;
  if (!basicMat || !basicMat.color) return;
  if (!basicMat.userData.__origBasicColor) {
    basicMat.userData.__origBasicColor = basicMat.color.clone();
  }
  const orig = basicMat.userData.__origBasicColor as THREE.Color;
  if (highlightState === 2) {
    basicMat.color
      .copy(orig)
      .lerp(SELECTED_EMISSIVE_COLOR, subtleIsolated ? 0.06 : 0.15);
  } else if (highlightState === 1) {
    basicMat.color.copy(orig).lerp(HOVERED_EMISSIVE_COLOR, 0.08);
  } else {
    basicMat.color.copy(orig);
  }
}
