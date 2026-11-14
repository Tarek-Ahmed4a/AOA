import '../../utils/bvhSetup';
import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  AdaptiveDpr,
  OrbitControls,
  PerspectiveCamera,
  useProgress,
} from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  cameraInteractionState,
  DEFAULT_CAMERA_TARGET,
  useAnatomyStore,
  type CameraPresetView,
} from '../../store/useAnatomyStore';
import { cn } from '../../lib/utils';
import { getRegisteredSceneMesh } from '../../utils/bvhSetup';
import { AnatomicalModelManager } from './AnatomicalModelManager';
import type { AnatomicalPartInfo } from '../../utils/anatomyParser';

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 1.2, 3.2);
const DEFAULT_TARGET_VECTOR = new THREE.Vector3(...DEFAULT_CAMERA_TARGET);

const PRESET_CAMERA_POSITIONS: Record<
  CameraPresetView,
  [number, number, number]
> = {
  anterior: [0, 1.0, 3.2],
  posterior: [0, 1.0, -3.2],
  left: [3.2, 1.0, 0],
  right: [-3.2, 1.0, 0],
  superior: [0, 4.2, 0.01],
  inferior: [0, -2.2, 0.01],
};

function resolveLivePartCenter(
  scene: THREE.Scene,
  part: AnatomicalPartInfo
): THREE.Vector3 {
  const obj =
    getRegisteredSceneMesh(part.meshUuid, part.rawName) ??
    scene.getObjectByProperty('uuid', part.meshUuid) ??
    scene.getObjectByName(part.rawName);
  const localCenter = obj?.userData?.__localCenter as THREE.Vector3 | undefined;
  if (obj && localCenter) {
    obj.updateWorldMatrix(true, false);
    return new THREE.Vector3().copy(localCenter).applyMatrix4(obj.matrixWorld);
  }
  const restCenter = obj?.userData?.__restCenter as THREE.Vector3 | undefined;
  if (obj && restCenter) {
    return new THREE.Vector3().copy(restCenter).add(obj.position);
  }
  return new THREE.Vector3(...part.worldCenter);
}

const CameraRig: React.FC = () => {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera, scene, raycaster } = useThree();

  const resetViewCounter = useAnatomyStore((s) => s.resetViewCounter);
  const cameraFocusTrigger = useAnatomyStore((s) => s.cameraFocusTrigger);
  const cameraPresetView = useAnatomyStore((s) => s.cameraPresetView);
  const cameraPresetTrigger = useAnatomyStore((s) => s.cameraPresetTrigger);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const cameraTarget = useAnatomyStore((s) => s.cameraTarget);

  const prevResetCounterRef = useRef(resetViewCounter);
  const prevFocusTriggerRef = useRef(cameraFocusTrigger);
  const prevPresetTriggerRef = useRef(cameraPresetTrigger);
  const flightModeRef = useRef<'idle' | 'reset' | 'focus' | 'preset'>('idle');
  const targetGoalRef = useRef(DEFAULT_TARGET_VECTOR.clone());
  const cameraPosGoalRef = useRef(INITIAL_CAMERA_POSITION.clone());
  const viewDirectionTempRef = useRef(new THREE.Vector3());

  // Initialize OrbitControls target & configure fast firstHitOnly raycasting + orbiting guard
  useEffect(() => {
    (
      raycaster as THREE.Raycaster & { firstHitOnly?: boolean }
    ).firstHitOnly = true;

    const controls = controlsRef.current;
    if (!controls) return;

    controls.target.copy(DEFAULT_TARGET_VECTOR);
    controls.update();

    let isControlActive = false;

    const handleControlStart = () => {
      isControlActive = true;
      flightModeRef.current = 'idle';
    };

    const handleControlChange = () => {
      if (isControlActive) {
        cameraInteractionState.isOrbiting = true;
      }
    };

    const handleControlEnd = () => {
      isControlActive = false;
      cameraInteractionState.isOrbiting = false;
    };

    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('change', handleControlChange);
    controls.addEventListener('end', handleControlEnd);
    window.addEventListener('pointerup', handleControlEnd, { passive: true });
    window.addEventListener('pointercancel', handleControlEnd, {
      passive: true,
    });
    return () => {
      cameraInteractionState.isOrbiting = false;
      controls.removeEventListener('start', handleControlStart);
      controls.removeEventListener('change', handleControlChange);
      controls.removeEventListener('end', handleControlEnd);
      window.removeEventListener('pointerup', handleControlEnd);
      window.removeEventListener('pointercancel', handleControlEnd);
    };
  }, [raycaster]);

  // Trigger smooth camera & target reset whenever resetViewCounter increments
  useEffect(() => {
    if (resetViewCounter !== prevResetCounterRef.current) {
      prevResetCounterRef.current = resetViewCounter;
      targetGoalRef.current.set(...cameraTarget);
      cameraPosGoalRef.current.copy(INITIAL_CAMERA_POSITION);
      flightModeRef.current = 'reset';
    }
  }, [resetViewCounter, cameraTarget]);

  // Trigger smooth auto-fly to frame selected anatomical part whenever cameraFocusTrigger increments
  useEffect(() => {
    if (cameraFocusTrigger === prevFocusTriggerRef.current) return;
    prevFocusTriggerRef.current = cameraFocusTrigger;

    const controls = controlsRef.current;
    if (!controls || !selectedPart) return;

    const center = resolveLivePartCenter(scene, selectedPart);
    targetGoalRef.current.copy(center);

    const viewDir = viewDirectionTempRef.current
      .copy(camera.position)
      .sub(controls.target);

    if (viewDir.lengthSq() < 1e-6) {
      viewDir.set(0, 0.15, 1);
    }
    viewDir.normalize();

    const desiredDistance = Math.max(selectedPart.boundingRadius * 3.2, 0.45);
    cameraPosGoalRef.current
      .copy(center)
      .addScaledVector(viewDir, desiredDistance);

    flightModeRef.current = 'focus';
  }, [cameraFocusTrigger, selectedPart, camera, scene]);

  // Trigger standard anatomical view presets (Anterior / Posterior / Left / Right / Superior / Inferior)
  useEffect(() => {
    if (cameraPresetTrigger === prevPresetTriggerRef.current) return;
    prevPresetTriggerRef.current = cameraPresetTrigger;
    if (!cameraPresetView) return;

    const presetCoords = PRESET_CAMERA_POSITIONS[cameraPresetView];

    if (isolatedPartId && selectedPart) {
      const center = resolveLivePartCenter(scene, selectedPart);
      targetGoalRef.current.copy(center);

      const dir = viewDirectionTempRef.current
        .set(...presetCoords)
        .sub(DEFAULT_TARGET_VECTOR)
        .normalize();
      const framingDistance = Math.max(
        selectedPart.boundingRadius * 3.2,
        0.55
      );
      cameraPosGoalRef.current
        .copy(center)
        .addScaledVector(dir, framingDistance);
    } else {
      targetGoalRef.current.copy(DEFAULT_TARGET_VECTOR);
      cameraPosGoalRef.current.set(...presetCoords);
    }

    flightModeRef.current = 'preset';
  }, [
    cameraPresetTrigger,
    cameraPresetView,
    isolatedPartId,
    selectedPart,
    scene,
  ]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || flightModeRef.current === 'idle') return;

    const alpha = 1 - Math.exp(-7 * Math.min(delta, 0.1));
    camera.position.lerp(cameraPosGoalRef.current, alpha);
    controls.target.lerp(targetGoalRef.current, alpha);
    controls.update();

    const posDist = camera.position.distanceTo(cameraPosGoalRef.current);
    const targetDist = controls.target.distanceTo(targetGoalRef.current);

    if (posDist < 0.002 && targetDist < 0.002) {
      camera.position.copy(cameraPosGoalRef.current);
      controls.target.copy(targetGoalRef.current);
      controls.update();
      flightModeRef.current = 'idle';
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={true}
      dampingFactor={0.08}
      rotateSpeed={0.85}
      zoomSpeed={1.0}
      panSpeed={0.85}
      minDistance={0.12}
      maxDistance={4.5}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
};

const ClinicalEnvironment: React.FC = () => {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);

    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.36;

    return () => {
      scene.environment = null;
      envTarget.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
    };
  }, [gl, scene]);

  return null;
};

const LIGHT_RADIUS = 6.0;

function computeSphericalRigWeights(yawDeg: number, pitchDeg: number) {
  const az = THREE.MathUtils.degToRad(yawDeg);
  const el = THREE.MathUtils.degToRad(pitchDeg);
  const cosEl = Math.cos(el);
  return {
    wx: cosEl * Math.sin(az) * LIGHT_RADIUS,
    wy: Math.sin(el) * LIGHT_RADIUS,
    wz: cosEl * Math.cos(az) * LIGHT_RADIUS,
  };
}

// 3-Point Surgical Raking Light offsets locked in camera basis coordinates
const KEY_RAKING_WEIGHTS = computeSphericalRigWeights(38, 28);
const FILL_RAKING_WEIGHTS = computeSphericalRigWeights(-45, -20);
const RIM_BACK_WEIGHTS = computeSphericalRigWeights(162, 24);

function placeCameraRelativeLight(
  light: THREE.DirectionalLight | null,
  camRight: THREE.Vector3,
  camUp: THREE.Vector3,
  camBack: THREE.Vector3,
  weights: { wx: number; wy: number; wz: number }
): void {
  if (!light) return;
  light.position
    .set(0, 0, 0)
    .addScaledVector(camRight, weights.wx)
    .addScaledVector(camUp, weights.wy)
    .addScaledVector(camBack, weights.wz);
}

/**
 * Universal camera-locked 3-point surgical raking light rig.
 * Reorients zero-allocation directional lights every frame as the user orbits
 * so oblique surface relief, deep sulci, and underside organ crevices stay carved from every angle.
 */
export const CameraRakingLightRig: React.FC = () => {
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const { camera } = useThree();

  const camRightRef = useRef(new THREE.Vector3(1, 0, 0));
  const camUpRef = useRef(new THREE.Vector3(0, 1, 0));
  const camBackRef = useRef(new THREE.Vector3(0, 0, 1));

  useEffect(() => {
    camera.updateMatrixWorld();
    camera.matrixWorld.extractBasis(
      camRightRef.current,
      camUpRef.current,
      camBackRef.current
    );
    placeCameraRelativeLight(
      keyLightRef.current,
      camRightRef.current,
      camUpRef.current,
      camBackRef.current,
      KEY_RAKING_WEIGHTS
    );
    placeCameraRelativeLight(
      fillLightRef.current,
      camRightRef.current,
      camUpRef.current,
      camBackRef.current,
      FILL_RAKING_WEIGHTS
    );
    placeCameraRelativeLight(
      rimLightRef.current,
      camRightRef.current,
      camUpRef.current,
      camBackRef.current,
      RIM_BACK_WEIGHTS
    );
  }, [camera]);

  useFrame(({ camera: activeCam }) => {
    activeCam.matrixWorld.extractBasis(
      camRightRef.current,
      camUpRef.current,
      camBackRef.current
    );
    placeCameraRelativeLight(
      keyLightRef.current,
      camRightRef.current,
      camUpRef.current,
      camBackRef.current,
      KEY_RAKING_WEIGHTS
    );
    placeCameraRelativeLight(
      fillLightRef.current,
      camRightRef.current,
      camUpRef.current,
      camBackRef.current,
      FILL_RAKING_WEIGHTS
    );
    placeCameraRelativeLight(
      rimLightRef.current,
      camRightRef.current,
      camUpRef.current,
      camBackRef.current,
      RIM_BACK_WEIGHTS
    );
  });

  return (
    <>
      <directionalLight
        ref={keyLightRef}
        position={[3.2, 2.8, 4.2]}
        intensity={1.85}
        color="#fffcf5"
        castShadow={false}
      />
      <directionalLight
        ref={fillLightRef}
        position={[-4.0, -2.05, 4.0]}
        intensity={0.65}
        color="#fff7ed"
        castShadow={false}
      />
      <directionalLight
        ref={rimLightRef}
        position={[1.7, 2.44, -5.2]}
        intensity={0.55}
        color="#bae6fd"
        castShadow={false}
      />
      <ambientLight intensity={0.28} color="#f8fafc" />
    </>
  );
};

const StudioLighting: React.FC = () => {
  return (
    <>
      <ClinicalEnvironment />
      <CameraRakingLightRig />
    </>
  );
};

const NihStreamingProgressHud: React.FC = () => {
  const { active, progress, item, loaded, total } = useProgress();
  if (!active) return null;

  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  const fileLabel = item
    ? decodeURIComponent(item.split('/').pop() ?? '').replace(/\.glb$/i, '')
    : 'NIH Human Reference Atlas';

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 left-1/2 z-40 w-[290px] -translate-x-1/2 rounded-xl border border-sky-400/35 bg-zinc-950/90 px-3.5 py-2.5 shadow-[0_16px_44px_rgba(0,0,0,0.92)] backdrop-blur-xl sm:bottom-24 sm:w-[340px]"
    >
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider">
        <span className="font-semibold text-sky-300">
          Streaming NIH Reference Atlas
        </span>
        <span className="font-bold tabular-nums text-white">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[9px] text-zinc-400">
        <span className="truncate">{fileLabel}</span>
        <span className="shrink-0 tabular-nums">
          {loaded} / {Math.max(total, loaded)} GLB
        </span>
      </div>
    </div>
  );
};

const ViewportFrameloopSync: React.FC<{ active: boolean }> = ({ active }) => {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    setFrameloop(active ? 'always' : 'never');
    if (active) {
      invalidate();
    }
  }, [active, setFrameloop, invalidate]);

  return null;
};

export const AnatomyViewport: React.FC = () => {
  const selectPart = useAnatomyStore((s) => s.selectPart);
  const activeTab = useAnatomyStore((s) => s.activeTab);
  const isAtlasActive = activeTab === 'master-atlas';

  const maxDpr =
    typeof window !== 'undefined'
      ? Math.min(window.devicePixelRatio || 1, 1.5)
      : 1.5;

  return (
    <div
      aria-hidden={!isAtlasActive}
      className={cn(
        'fixed inset-0 h-full w-full bg-black touch-none select-none',
        isAtlasActive
          ? 'visible pointer-events-auto z-0'
          : 'invisible pointer-events-none -z-10'
      )}
    >
      <Canvas
        frameloop={isAtlasActive ? 'always' : 'never'}
        shadows={false}
        dpr={[1, maxDpr]}
        gl={{
          antialias: true,
          stencil: true,
          alpha: false,
          logarithmicDepthBuffer: true,
          powerPreference: 'high-performance',
          localClippingEnabled: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        onPointerMissed={() => selectPart(null)}
      >
        <color attach="background" args={['#000000']} />
        <ViewportFrameloopSync active={isAtlasActive} />
        <AdaptiveDpr pixelated />

        <PerspectiveCamera
          makeDefault
          fov={40}
          near={0.01}
          far={100}
          position={[0, 1.2, 3.2]}
        />

        <StudioLighting />
        <CameraRig />
        <AnatomicalModelManager />
      </Canvas>
      {isAtlasActive && <NihStreamingProgressHud />}
    </div>
  );
};
