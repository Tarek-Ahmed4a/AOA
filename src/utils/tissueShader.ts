import * as THREE from 'three';

export const SELECTED_EMISSIVE_COLOR = new THREE.Color('#00e5ff');
export const HOVERED_EMISSIVE_COLOR = new THREE.Color('#00f2fe');
export const GHOST_EMISSIVE_COLOR = new THREE.Color('#1e293b');
export const ZERO_EMISSIVE_COLOR = new THREE.Color('#000000');

export const SLICER_PROGRAM_CACHE_KEY = () => 'anatomy-slicer-v1';

/**
 * Injects clinical cross-section internal tissue coloring and laser rim shader logic
 * into a Three.js standard/physical material fragment shader.
 */
export function applyTissueSlicerShader(
  shader: THREE.WebGLProgramParametersWithUniforms,
  tissueColor: THREE.Color
): void {
  shader.uniforms.uInternalTissueColor = { value: tissueColor };

  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <clipping_planes_pars_fragment>',
      `#include <clipping_planes_pars_fragment>
uniform vec3 uInternalTissueColor;`
    )
    .replace(
      '#include <opaque_fragment>',
      `#if NUM_CLIPPING_PLANES > 0
  float sliceEdgeDist = abs( clippingPlanes[ 0 ].w - dot( vClipPosition, clippingPlanes[ 0 ].xyz ) );
  float laserRim = 1.0 - smoothstep( 0.0, 0.0022, sliceEdgeDist );
  if ( !gl_FrontFacing ) {
    float grain = 0.86 + 0.14 * sin( vClipPosition.x * 160.0 ) * cos( vClipPosition.y * 160.0 + vClipPosition.z * 160.0 );
    outgoingLight = uInternalTissueColor * grain;
  }
  outgoingLight = mix( outgoingLight, vec3( 0.22, 0.74, 0.97 ), laserRim * 0.92 );
#endif
#include <opaque_fragment>`
    );
}
