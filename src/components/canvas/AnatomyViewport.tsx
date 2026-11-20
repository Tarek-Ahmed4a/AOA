import '../../utils/bvhSetup';
import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  cameraInteractionState,
  DEFAULT_CAMERA_TARGET,
  useAnatomyStore,
  useAnatomyStoreApi,
  useAppNavigationStore,
  type CameraPresetView,
} from '../../store/useAnatomyStore';
import { cn } from '../../lib/utils';
import {
  getRegisteredSceneMesh,
  useSceneMeshRegistry,
  type SceneMeshRegistry,
} from '../../utils/bvhSetup';
import { AnatomicalModelManager } from './AnatomicalModelManager';
import { type AnatomicalPartInfo } from '../../utils/anatomyParser';

const DESKTOP_INITIAL_CAMERA_POSITION: [number, number, number] = [0, 1.2, 3.2];
const MOBILE_INITIAL_CAMERA_POSITION: [number, number, number] = [0, 1.12, 3.55];
const DEFAULT_TARGET_VECTOR = new THREE.Vector3(...DEFAULT_CAMERA_TARGET);

function getResponsiveInitialCameraTuple(): [number, number, number] {
  if (typeof window !== 'undefined' && window.innerWidth < 640) {
    return MOBILE_INITIAL_CAMERA_POSITION;
  }
  return DESKTOP_INITIAL_CAMERA_POSITION;
}

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
  part: AnatomicalPartInfo,
  registry: SceneMeshRegistry
): THREE.Vector3 {
  const obj =
    getRegisteredSceneMesh(part.meshUuid, part.rawName, registry) ??
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
  const { camera, scene, raycaster, invalidate } = useThree();
  const registry = useSceneMeshRegistry();

  const resetViewCounter = useAnatomyStore((s) => s.resetViewCounter);
  const cameraFocusTrigger = useAnatomyStore((s) => s.cameraFocusTrigger);
  const cameraFocusPoint = useAnatomyStore((s) => s.cameraFocusPoint);
  const cameraFocusRadius = useAnatomyStore((s) => s.cameraFocusRadius);
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
  const cameraPosGoalRef = useRef(
    new THREE.Vector3(...getResponsiveInitialCameraTuple())
  );
  const viewDirectionTempRef = useRef(new THREE.Vector3());
  const initializedControlsRef = useRef<WeakSet<object>>(new WeakSet());

  // Initialize OrbitControls target & configure fast firstHitOnly raycasting + orbiting guard
  useEffect(() => {
    (
      raycaster as THREE.Raycaster & { firstHitOnly?: boolean }
    ).firstHitOnly = true;

    const controls = controlsRef.current;
    if (!controls) return;

    if (!initializedControlsRef.current.has(controls)) {
      initializedControlsRef.current.add(controls);
      controls.target.copy(DEFAULT_TARGET_VECTOR);
      camera.lookAt(DEFAULT_TARGET_VECTOR);
      controls.update();
      invalidate();
    }

    let isControlActive = false;

    const handleControlStart = () => {
      isControlActive = true;
      flightModeRef.current = 'idle';
      invalidate();
    };

    const handleControlChange = () => {
      if (isControlActive) {
        cameraInteractionState.isOrbiting = true;
      }
      invalidate();
    };

    const handleControlEnd = () => {
      const wasActive = isControlActive || cameraInteractionState.isOrbiting;
      isControlActive = false;
      cameraInteractionState.isOrbiting = false;
      if (wasActive) {
        invalidate();
      }
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
  }, [camera, raycaster, invalidate]);

  // Trigger smooth camera & target reset whenever resetViewCounter increments
  useEffect(() => {
    if (resetViewCounter !== prevResetCounterRef.current) {
      prevResetCounterRef.current = resetViewCounter;
      targetGoalRef.current.set(...cameraTarget);
      cameraPosGoalRef.current.set(...getResponsiveInitialCameraTuple());
      flightModeRef.current = 'reset';
      invalidate();
    }
  }, [resetViewCounter, cameraTarget, invalidate]);

  // Trigger smooth auto-fly to frame selected anatomical part or specific landmark point
  useEffect(() => {
    if (cameraFocusTrigger === prevFocusTriggerRef.current) return;
    prevFocusTriggerRef.current = cameraFocusTrigger;

    const controls = controlsRef.current;
    if (!controls) return;
    if (!cameraFocusPoint && !selectedPart) return;

    const center = cameraFocusPoint
      ? new THREE.Vector3(...cameraFocusPoint)
      : resolveLivePartCenter(scene, selectedPart!, registry);
    targetGoalRef.current.copy(center);

    const viewDir = viewDirectionTempRef.current
      .copy(camera.position)
      .sub(controls.target);

    if (viewDir.lengthSq() < 1e-6) {
      viewDir.set(0, 0.15, 1);
    }
    viewDir.normalize();

    const desiredDistance = cameraFocusPoint
      ? Math.max((cameraFocusRadius ?? 0.055) * 3.0, 0.18)
      : Math.max((selectedPart?.boundingRadius ?? 0.15) * 3.2, 0.45);
    cameraPosGoalRef.current
      .copy(center)
      .addScaledVector(viewDir, desiredDistance);

    flightModeRef.current = 'focus';
    invalidate();
  }, [
    cameraFocusTrigger,
    cameraFocusPoint,
    cameraFocusRadius,
    selectedPart,
    camera,
    scene,
    registry,
    invalidate,
  ]);

  // Trigger standard anatomical view presets (Anterior / Posterior / Left / Right / Superior / Inferior)
  useEffect(() => {
    if (cameraPresetTrigger === prevPresetTriggerRef.current) return;
    prevPresetTriggerRef.current = cameraPresetTrigger;
    if (!cameraPresetView) return;

    const presetCoords = PRESET_CAMERA_POSITIONS[cameraPresetView];

    if (isolatedPartId && selectedPart) {
      const center = resolveLivePartCenter(scene, selectedPart, registry);
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
    invalidate();
  }, [
    cameraPresetTrigger,
    cameraPresetView,
    isolatedPartId,
    selectedPart,
    scene,
    registry,
    invalidate,
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
    invalidate();
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
    scene.environmentIntensity = 0.26;

    return () => {
      scene.environment = null;
      envTarget.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
    };
  }, [gl, scene]);

  return null;
};

/**
 * Universal camera-locked 3-point surgical raking light rig.
 * Parented once to the active PerspectiveCamera so oblique surface relief
 * rotates automatically with zero per-frame JS work.
 */
export const CameraRakingLightRig: React.FC = () => {
  const { camera } = useThree();

  useEffect(() => {
    const keyLight = new THREE.DirectionalLight('#fffcf5', 1.38);
    keyLight.position.set(3.2, 2.8, 1.0);
    keyLight.target.position.set(0, 0, -3.2);

    const fillLight = new THREE.DirectionalLight('#f8fafc', 0.38);
    fillLight.position.set(-4.0, -2.05, 0.8);
    fillLight.target.position.set(0, 0, -3.2);

    const rimLight = new THREE.DirectionalLight('#bae6fd', 0.45);
    rimLight.position.set(1.7, 2.44, -8.4);
    rimLight.target.position.set(0, 0, -3.2);

    const attached: THREE.Object3D[] = [
      keyLight,
      keyLight.target,
      fillLight,
      fillLight.target,
      rimLight,
      rimLight.target,
    ];
    attached.forEach((obj) => camera.add(obj));

    return () => {
      attached.forEach((obj) => camera.remove(obj));
    };
  }, [camera]);

  return <ambientLight intensity={0.16} color="#f8fafc" />;
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
  const size = useThree((s) => s.size);
  const storeApi = useAnatomyStoreApi();

  useEffect(() => {
    setFrameloop(active ? 'demand' : 'never');
    if (active) {
      invalidate();
    }
  }, [active, setFrameloop, invalidate, size.width, size.height]);

  useEffect(() => {
    if (!active) return;
    return storeApi.subscribe(() => {
      invalidate();
    });
  }, [active, storeApi, invalidate]);

  return null;
};

export interface AnatomyViewportProps {
  active?: boolean;
  mountScene?: boolean;
  showStreamingHud?: boolean;
}

export const AnatomyViewport: React.FC<AnatomyViewportProps> = ({
  active,
  mountScene = true,
  showStreamingHud = true,
}) => {
  const activeTab = useAppNavigationStore((s) => s.activeTab);
  const isAtlasActive = active ?? activeTab === 'master-atlas';
  const initialCameraPos = useMemo(
    () => getResponsiveInitialCameraTuple(),
    []
  );

  const maxDpr =
    typeof window !== 'undefined'
      ? Math.min(window.devicePixelRatio || 1, 1.15)
      : 1.15;

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
        frameloop={isAtlasActive ? 'demand' : 'never'}
        shadows={false}
        dpr={[0.75, maxDpr]}
        camera={{
          position: initialCameraPos,
          fov: 40,
          near: 0.05,
          far: 15,
        }}
        gl={{
          antialias: true,
          stencil: true,
          alpha: false,
          logarithmicDepthBuffer: false,
          powerPreference: 'high-performance',
          localClippingEnabled: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.95,
        }}
      >
        <color attach="background" args={['#000000']} />
        <ViewportFrameloopSync active={isAtlasActive} />

        <StudioLighting />
        <CameraRig />
        {mountScene && <AnatomicalModelManager />}
      </Canvas>
      {isAtlasActive && showStreamingHud && <NihStreamingProgressHud />}
    </div>
  );
};
