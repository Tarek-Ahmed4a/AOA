import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CALIBRATION_RIG_STRUCTURES } from '../../config/anatomicalSystems';
import {
  useAnatomyStore,
  type AnatomicalSystem,
} from '../../store/useAnatomyStore';
import { getRegisteredSceneMesh } from '../../utils/bvhSetup';
import {
  computeSlicingPlaneParameters,
  INTERNAL_TISSUE_COLORS,
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
  const gizmoGroupRef = useRef<THREE.Group>(null);
  const selectedObjRef = useRef<THREE.Object3D | null>(null);
  const liveCenterRef = useRef(new THREE.Vector3());

  const slicing = useAnatomyStore((s) => s.slicing);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const anatomicalCatalog = useAnatomyStore((s) => s.anatomicalCatalog);
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
        selectedPart.rawName
      );
    } else {
      selectedObjRef.current = null;
    }
  }, [selectedPart]);

  // Resolve active system for solid stencil cap material
  let capSystem: AnatomicalSystem | null = null;
  let capPartId: string | null = null;

  if (isolatedPartId && !xrayGhostMode) {
    capPartId = isolatedPartId;
    capSystem =
      CALIBRATION_RIG_STRUCTURES[isolatedPartId]?.system ??
      anatomicalCatalog.find((p) => p.rawName === isolatedPartId)?.system ??
      (selectedPart?.rawName === isolatedPartId ? selectedPart.system : null);
  } else if (slicing.scope === 'selected' && selectedPart) {
    capPartId = selectedPart.rawName;
    capSystem = selectedPart.system;
  }

  const isTargetVisible =
    capSystem !== null &&
    capPartId !== null &&
    activeSystems[capSystem] &&
    systemOpacity[capSystem] >= 0.99 &&
    !hiddenPartIds.includes(capPartId);

  const showStencilCap = slicing.enabled && !xrayGhostMode && isTargetVisible;
  const capColor = capSystem ? INTERNAL_TISSUE_COLORS[capSystem] : '#450a0a';

  const syncPlaneTransform = () => {
    const state = useAnatomyStore.getState();
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
      liveCenter
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
      {/* Solid Stencil Cap Plane for isolated / single-organ cross-sections */}
      {showStencilCap && (
        <mesh renderOrder={4} raycast={() => null}>
          <planeGeometry args={[2.5, 2.5]} />
          <meshStandardMaterial
            color={capColor}
            roughness={0.68}
            metalness={0.04}
            side={THREE.DoubleSide}
            stencilWrite
            stencilRef={0}
            stencilFunc={THREE.NotEqualStencilFunc}
            stencilFail={THREE.ZeroStencilOp}
            stencilZFail={THREE.ZeroStencilOp}
            stencilZPass={THREE.ZeroStencilOp}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}

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
