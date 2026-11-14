import * as THREE from 'three';
import type {
  AnatomicalSystem,
  SlicingPlaneAxis,
  SlicingState,
} from '../store/useAnatomyStore';
import type { AnatomicalPartInfo } from './anatomyParser';

/**
 * Shared persistent clipping plane updated synchronously in useFrame so all
 * sliced meshes and the surgical laser gizmo remain locked in sync with zero allocations.
 */
export const ACTIVE_CLIPPING_PLANE = new THREE.Plane(
  new THREE.Vector3(1, 0, 0),
  0
);

export const BODY_EXPLODE_CENTER = new THREE.Vector3(0, 1.0, 0);

export const INTERNAL_TISSUE_COLORS: Record<AnatomicalSystem, string> = {
  integumentary: '#b57c60',
  skeletal: '#d6cbb5',
  visceral: '#450a0a',
  muscular: '#450a0a',
  cardiovascular: '#450a0a',
  nervous: '#ca8a04',
};

const AXIS_BASE_NORMALS: Record<SlicingPlaneAxis, [number, number, number]> = {
  sagittal: [1, 0, 0],
  coronal: [0, 0, 1],
  axial: [0, -1, 0],
};

const _baseAxis = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _anchor = new THREE.Vector3();
const _planePoint = new THREE.Vector3();

export interface ComputedSliceTransform {
  normal: THREE.Vector3;
  planePoint: THREE.Vector3;
  gizmoSize: number;
}

export function computeSlicingPlaneParameters(
  slicing: SlicingState,
  selectedPart: AnatomicalPartInfo | null,
  liveSelectedCenter?: THREE.Vector3 | null
): ComputedSliceTransform {
  const [nx, ny, nz] = AXIS_BASE_NORMALS[slicing.plane];
  _baseAxis.set(nx, ny, nz);

  const invertSign = slicing.invert ? -1 : 1;
  _normal.copy(_baseAxis).multiplyScalar(invertSign);

  const isSingleOrganScope =
    slicing.scope === 'selected' && selectedPart !== null;

  let travelHalfSpan: number;
  let gizmoSize: number;

  if (isSingleOrganScope && selectedPart) {
    if (liveSelectedCenter) {
      _anchor.copy(liveSelectedCenter);
    } else {
      _anchor.set(...selectedPart.worldCenter);
    }
    travelHalfSpan = Math.max(selectedPart.boundingRadius * 1.15, 0.06);
    gizmoSize = Math.max(selectedPart.boundingRadius * 2.6, 0.26);
  } else {
    _anchor.set(0, 1.0, 0);
    // Full body span: 1.2 meters total (±0.6m sagittal/coronal, ±0.78m axial to clear skull-to-femur)
    travelHalfSpan = slicing.plane === 'axial' ? 0.78 : 0.6;
    gizmoSize = 0.95;
  }

  // Offset moves smoothly along the base axis independently of invert direction
  _planePoint
    .copy(_anchor)
    .addScaledVector(_baseAxis, slicing.offset * travelHalfSpan);

  ACTIVE_CLIPPING_PLANE.setFromNormalAndCoplanarPoint(_normal, _planePoint);

  return {
    normal: _normal,
    planePoint: _planePoint,
    gizmoSize,
  };
}
