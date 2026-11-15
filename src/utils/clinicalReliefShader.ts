import * as THREE from 'three';
import type { AnatomicalSystem } from '../store/useAnatomyStore';

export interface ClinicalTissueProfile {
  roughness: number;
  metalness: number;
  uCavityStrength: number;
  uRidgeStrength: number;
  uEdgeCrispness: number;
  uSpecBoost: number;
}

/**
 * Tissue-calibrated PBR roughness/metalness & screen-space relief profiles
 * covering all 6 anatomical systems so tendons, muscle bellies, gyri/sulci,
 * organ fissures, branching vessels, bone tuberosities, and skin retain crisp 3D depth.
 */
export const CLINICAL_TISSUE_PROFILES: Record<
  AnatomicalSystem,
  ClinicalTissueProfile
> = {
  muscular: {
    roughness: 0.36,
    metalness: 0.04,
    uCavityStrength: 0.65,
    uRidgeStrength: 0.26,
    uEdgeCrispness: 0.3,
    uSpecBoost: 0.06,
  },
  visceral: {
    roughness: 0.24,
    metalness: 0.02,
    uCavityStrength: 0.6,
    uRidgeStrength: 0.22,
    uEdgeCrispness: 0.25,
    uSpecBoost: 0.18,
  },
  nervous: {
    roughness: 0.3,
    metalness: 0.03,
    uCavityStrength: 0.75,
    uRidgeStrength: 0.32,
    uEdgeCrispness: 0.35,
    uSpecBoost: 0.1,
  },
  cardiovascular: {
    roughness: 0.22,
    metalness: 0.06,
    uCavityStrength: 0.55,
    uRidgeStrength: 0.25,
    uEdgeCrispness: 0.42,
    uSpecBoost: 0.16,
  },
  skeletal: {
    roughness: 0.42,
    metalness: 0.03,
    uCavityStrength: 0.7,
    uRidgeStrength: 0.3,
    uEdgeCrispness: 0.25,
    uSpecBoost: 0.05,
  },
  integumentary: {
    roughness: 0.48,
    metalness: 0.02,
    uCavityStrength: 0.4,
    uRidgeStrength: 0.15,
    uEdgeCrispness: 0.18,
    uSpecBoost: 0.02,
  },
};

export interface ClinicalReliefUniforms {
  uInternalTissueColor: { value: THREE.Color };
  uCavityStrength: { value: number };
  uRidgeStrength: { value: number };
  uEdgeCrispness: { value: number };
  uSpecBoost: { value: number };
  /** 0.0 = normal, 1.0 = hovered, 2.0 = selected */
  uHighlightState: { value: number };
  /** 1.0 = normal, 0.8 = dimmed background during selection spotlight */
  uDimFactor: { value: number };
}

export const CLINICAL_RELIEF_PROGRAM_CACHE_KEY = () => 'clinical-relief-v2';

export function getClinicalTissueProfile(
  system: AnatomicalSystem
): ClinicalTissueProfile {
  return CLINICAL_TISSUE_PROFILES[system] ?? CLINICAL_TISSUE_PROFILES.visceral;
}

const CLINICAL_RELIEF_UNIFORM_PARS = /* glsl */ `#include <clipping_planes_pars_fragment>
uniform vec3 uInternalTissueColor;
uniform float uCavityStrength;
uniform float uRidgeStrength;
uniform float uEdgeCrispness;
uniform float uSpecBoost;
uniform float uHighlightState;
uniform float uDimFactor;`;

const CLINICAL_RELIEF_FRAGMENT_INJECTION = /* glsl */ `{
#ifdef FLAT_SHADED
  vec3 rawN = normal;
#else
  vec3 rawN = vNormal * ( gl_FrontFacing ? 1.0 : -1.0 );
#endif
  float nLen = length( rawN );
  vec3 n = nLen > 1e-5 ? rawN / nLen : vec3( 0.0, 0.0, 1.0 );

  float vLen = length( vViewPosition );
  vec3 viewDir = vLen > 1e-5 ? vViewPosition / vLen : vec3( 0.0, 0.0, 1.0 );

  vec3 dx = dFdx( n );
  vec3 dy = dFdy( n );
  float depthScale = clamp( vLen, 0.2, 3.0 );
  float curvature = ( cross( n - dx, n + dx ).y - cross( n - dy, n + dy ).x ) * ( 3.8 / depthScale );
  float ndotv = clamp( abs( dot( n, viewDir ) ), 0.0, 1.0 );
  float fresnel = pow( max( 1.0 - ndotv, 1e-4 ), 2.2 );

  float cavityMask = clamp( -curvature, 0.0, 1.0 );
  float ridgeMask = clamp( curvature, 0.0, 1.0 );
  float cavityShade = 1.0 - pow( max( cavityMask, 1e-4 ), 0.85 ) * ( uCavityStrength * 0.56 );
  float ridgeLift = 1.0 + pow( max( ridgeMask, 1e-4 ), 0.9 ) * ( uRidgeStrength * 0.34 );
  float reliefFactor = clamp( cavityShade * ridgeLift, 0.36, 1.32 );

  vec3 litDiffuse = totalDiffuse * reliefFactor;
  float specOcclusion = mix( 1.0, 0.22, cavityMask * uCavityStrength );
  vec3 litSpecular = totalSpecular * specOcclusion * ( 1.0 + ridgeMask * uSpecBoost * 1.35 );

  vec3 edgeTint = mix( diffuseColor.rgb, vec3( 1.0 ), 0.32 );
  vec3 grazingRelief = edgeTint * ( fresnel * uEdgeCrispness * 0.42 )
    + vec3( 1.0, 0.98, 0.96 ) * ( fresnel * uSpecBoost * 0.38 );

  outgoingLight = litDiffuse + litSpecular + totalEmissiveRadiance + grazingRelief;

  if ( uHighlightState < 0.5 ) {
    outgoingLight *= uDimFactor;
  }

#if NUM_CLIPPING_PLANES > 0
  float sliceEdgeDist = abs( clippingPlanes[ 0 ].w - dot( vClipPosition, clippingPlanes[ 0 ].xyz ) );
  float laserRim = 1.0 - smoothstep( 0.0, 0.0020, sliceEdgeDist );
  if ( !gl_FrontFacing ) {
    // Keep true 3D PBR lighting & cavity relief inside hollow cross-sections, with soft interior fill
    vec3 interiorFill = mix( diffuseColor.rgb, uInternalTissueColor, 0.2 );
    outgoingLight = outgoingLight * 0.96 + interiorFill * ( 0.16 + 0.08 * reliefFactor );
  }
  vec3 cutRimColor = mix( diffuseColor.rgb * 1.15 + vec3( 0.14 ), vec3( 0.24, 0.78, 0.98 ), 0.62 );
  outgoingLight = mix( outgoingLight, cutRimColor, laserRim * 0.9 );
#endif

  if ( uHighlightState > 0.5 ) {
    float isSelected = step( 1.5, uHighlightState );
    float rimWeight = mix( 0.65, 1.0, isSelected );
    float fresnelRim = pow( max( 1.0 - ndotv, 1e-4 ), 1.8 ) * 1.35 + clamp( abs( curvature ) * 0.25, 0.0, 0.3 );
    float contourGate = smoothstep( 0.08, 0.65, ( 1.0 - ndotv ) + clamp( abs( curvature ) * 0.4, 0.0, 0.7 ) );
    float rimIntensity = fresnelRim * contourGate;
    vec3 rimCyanLinear = vec3( 0.0, 0.891, 0.991 );
    float rimMix = clamp( rimIntensity * 0.45 * rimWeight, 0.0, 0.78 );
    outgoingLight = mix( outgoingLight, rimCyanLinear, rimMix ) + rimCyanLinear * ( rimIntensity * 0.36 * rimWeight );
  }
}
#include <opaque_fragment>`;

function bindClinicalUniformsToMaterial(
  mat: THREE.MeshStandardMaterial,
  uniforms: ClinicalReliefUniforms
): void {
  mat.userData.__clinicalUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uInternalTissueColor = uniforms.uInternalTissueColor;
    shader.uniforms.uCavityStrength = uniforms.uCavityStrength;
    shader.uniforms.uRidgeStrength = uniforms.uRidgeStrength;
    shader.uniforms.uEdgeCrispness = uniforms.uEdgeCrispness;
    shader.uniforms.uSpecBoost = uniforms.uSpecBoost;
    shader.uniforms.uHighlightState = uniforms.uHighlightState;
    shader.uniforms.uDimFactor = uniforms.uDimFactor;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <clipping_planes_pars_fragment>',
        CLINICAL_RELIEF_UNIFORM_PARS
      )
      .replace(
        '#include <opaque_fragment>',
        CLINICAL_RELIEF_FRAGMENT_INJECTION
      );
  };
  mat.customProgramCacheKey = CLINICAL_RELIEF_PROGRAM_CACHE_KEY;
}

/**
 * Configures tissue-appropriate PBR roughness/metalness and attaches the unified
 * Clinical Relief + Cross-Section Laser Slicer + 3D Fresnel Rim shader to a material.
 */
export function applyClinicalReliefToMaterial(
  mat: THREE.MeshStandardMaterial,
  system: AnatomicalSystem,
  tissueColor: THREE.Color
): ClinicalReliefUniforms {
  const profile = getClinicalTissueProfile(system);
  mat.roughness = profile.roughness;
  mat.metalness = profile.metalness;

  const uniforms: ClinicalReliefUniforms = {
    uInternalTissueColor: { value: tissueColor.clone() },
    uCavityStrength: { value: profile.uCavityStrength },
    uRidgeStrength: { value: profile.uRidgeStrength },
    uEdgeCrispness: { value: profile.uEdgeCrispness },
    uSpecBoost: { value: profile.uSpecBoost },
    uHighlightState: { value: 0.0 },
    uDimFactor: { value: 1.0 },
  };

  bindClinicalUniformsToMaterial(mat, uniforms);
  return uniforms;
}

/**
 * Clones a shared material for O(1) hover/selection highlighting with independent
 * uniform references while sharing the exact compiled WebGLProgram cache key.
 */
export function cloneClinicalHighlightMaterial(
  srcMat: THREE.Material
): THREE.MeshStandardMaterial {
  const cloned = srcMat.clone() as THREE.MeshStandardMaterial;
  cloned.userData = { ...srcMat.userData };

  const srcUniforms = srcMat.userData?.__clinicalUniforms as
    | ClinicalReliefUniforms
    | undefined;
  const srcSystem =
    (srcMat.userData?.__anatomicalSystem as AnatomicalSystem | undefined) ??
    'visceral';
  const fallbackProfile = getClinicalTissueProfile(srcSystem);

  const nextUniforms: ClinicalReliefUniforms = {
    uInternalTissueColor: {
      value: srcUniforms?.uInternalTissueColor?.value
        ? srcUniforms.uInternalTissueColor.value.clone()
        : new THREE.Color('#c85a53'),
    },
    uCavityStrength: {
      value: srcUniforms?.uCavityStrength?.value ?? fallbackProfile.uCavityStrength,
    },
    uRidgeStrength: {
      value: srcUniforms?.uRidgeStrength?.value ?? fallbackProfile.uRidgeStrength,
    },
    uEdgeCrispness: {
      value: srcUniforms?.uEdgeCrispness?.value ?? fallbackProfile.uEdgeCrispness,
    },
    uSpecBoost: {
      value: srcUniforms?.uSpecBoost?.value ?? fallbackProfile.uSpecBoost,
    },
    uHighlightState: { value: 0.0 },
    uDimFactor: { value: 1.0 },
  };

  bindClinicalUniformsToMaterial(cloned, nextUniforms);
  return cloned;
}

export function setClinicalHighlightState(
  matOrMats: THREE.Material | THREE.Material[],
  highlightState: 0 | 1 | 2,
  dimFactor = 1.0
): void {
  const list = Array.isArray(matOrMats) ? matOrMats : [matOrMats];
  for (const m of list) {
    const uniforms = m.userData?.__clinicalUniforms as
      | ClinicalReliefUniforms
      | undefined;
    if (uniforms) {
      uniforms.uHighlightState.value = highlightState;
      uniforms.uDimFactor.value = dimFactor;
    }
  }
}

export function setClinicalDimFactor(
  mat: THREE.Material,
  dimFactor: number
): void {
  const uniforms = mat.userData?.__clinicalUniforms as
    | ClinicalReliefUniforms
    | undefined;
  if (uniforms) {
    uniforms.uDimFactor.value = dimFactor;
  }
}
