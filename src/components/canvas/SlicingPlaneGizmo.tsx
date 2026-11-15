import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  useAnatomyStore,
  useAnatomyStoreApi,
} from '../../store/useAnatomyStore';
import {
  getRegisteredSceneMesh,
  useSceneMeshRegistry,
} from '../../utils/bvhSetup';
import {
  computeSlicingPlaneParameters,
  useClippingPlane,
} from '../../utils/slicingPlane';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function buildLaserReticleGeometry(): THREE.BufferGeometry {
  const vertices: number[] = [];
  const half = 0.5;
  const tick = 0.08;

  // Outer perimeter square
  vertices.push(
    -half, -half, 0,  half, -half, 0,
     half, -half, 0,  half,  half, 0,
     half,  half, 0, -half,  half, 0,
    -half,  half, 0, -half, -half, 0
  );

  // Corner surgical ticks
  const corners: [number, number][] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  for (const [cx, cy] of corners) {
    const sx = cx < 0 ? 1 : -1;
    const sy = cy < 0 ? 1 : -1;
    vertices.push(cx, cy, 0, cx + sx * tick, cy + sy * tick, 0);
  }

  // Subtle internal grid lines
  const gridSteps = [-0.25, 0, 0.25];
  for (const g of gridSteps) {
    vertices.push(g, -half, 0, g, half, 0);
    vertices.push(-half, g, 0, half, g, 0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  return geometry;
}

export const SlicingPlaneGizmo: React.FC = () => {
  const storeApi = useAnatomyStoreApi();
  const registry = useSceneMeshRegistry();
  const clippingPlane = useClippingPlane();
  const gizmoGroupRef = useRef<THREE.Group>(null);
  const selectedObjRef = useRef<THREE.Object3D | null>(null);
  const liveCenterRef = useRef(new THREE.Vector3());

  const slicing = useAnatomyStore((s) => s.slicing);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);

  const reticleGeometry = useMemo(() => buildLaserReticleGeometry(), []);

  useEffect(() => {
    return () => {
      reticleGeometry.dispose();
    };
  }, [reticleGeometry]);

  // Cache reference to selected 3D mesh for live exploded position tracking
  useEffect(() => {
    if (selectedPart) {
      selectedObjRef.current = getRegisteredSceneMesh(
        selectedPart.meshUuid,
        selectedPart.rawName,
        registry
      );
    } else {
      selectedObjRef.current = null;
    }
  }, [selectedPart, registry]);

  const syncPlaneTransform = () => {
    const state = storeApi.getState();
    if (!state.slicing.enabled) return;

    let liveCenter: THREE.Vector3 | null = null;
    if (state.slicing.scope === 'selected' && state.selectedPart) {
      const obj = selectedObjRef.current;
      const localCenter = obj?.userData?.__localCenter as
        | THREE.Vector3
        | undefined;
      const restCenter = obj?.userData?.__restCenter as
        | THREE.Vector3
        | undefined;
      if (obj && localCenter) {
        obj.updateWorldMatrix(true, false);
        liveCenter = liveCenterRef.current
          .copy(localCenter)
          .applyMatrix4(obj.matrixWorld);
      } else if (obj && restCenter) {
        liveCenter = liveCenterRef.current.copy(restCenter).add(obj.position);
      }
    }

    const { normal, planePoint, gizmoSize } = computeSlicingPlaneParameters(
      state.slicing,
      state.selectedPart,
      liveCenter,
      clippingPlane
    );

    const group = gizmoGroupRef.current;
    if (group) {
      group.position.copy(planePoint);
      group.quaternion.setFromUnitVectors(Z_AXIS, normal);
      group.scale.setScalar(gizmoSize);
    }
  };

  useLayoutEffect(() => {
    void explodeFactor;
    syncPlaneTransform();
  });

  if (!slicing.enabled) {
    return null;
  }

  return (
    <group ref={gizmoGroupRef} name="Surgical_Slicing_Gizmo">
      {/* Translucent 3D Surgical Laser Plane Guide */}
      {slicing.showHelper && (
        <>
          <mesh renderOrder={12} raycast={() => null}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color="#0ea5e9"
              transparent
              opacity={0.08}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <lineSegments
            geometry={reticleGeometry}
            renderOrder={13}
            raycast={() => null}
          >
            <lineBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.65}
              depthWrite={false}
            />
          </lineSegments>
        </>
      )}
    </group>
  );
};
