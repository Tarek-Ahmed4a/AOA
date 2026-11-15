import React, { createContext, useContext } from 'react';
import * as THREE from 'three';
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from 'three-mesh-bvh';
import { cameraInteractionState } from '../store/useAnatomyStore';

let isBVHInitialized = false;

export interface SceneMeshRegistry {
  byUuid: Map<string, THREE.Mesh>;
  byName: Map<string, THREE.Mesh>;
}

export function createSceneMeshRegistry(): SceneMeshRegistry {
  return {
    byUuid: new Map<string, THREE.Mesh>(),
    byName: new Map<string, THREE.Mesh>(),
  };
}

export const defaultSceneMeshRegistry: SceneMeshRegistry =
  createSceneMeshRegistry();
export const sceneMeshByUuid = defaultSceneMeshRegistry.byUuid;
export const sceneMeshByName = defaultSceneMeshRegistry.byName;

export const SceneMeshRegistryContext = createContext<SceneMeshRegistry>(
  defaultSceneMeshRegistry
);

export const SceneMeshRegistryProvider: React.FC<{
  registry: SceneMeshRegistry;
  children: React.ReactNode;
}> = ({ registry, children }) =>
  React.createElement(
    SceneMeshRegistryContext.Provider,
    { value: registry },
    children
  );

export function useSceneMeshRegistry(): SceneMeshRegistry {
  return useContext(SceneMeshRegistryContext);
}

/**
 * Registers a mounted anatomical mesh for O(1) lookup by UUID and name.
 */
export function registerSceneMesh(
  mesh: THREE.Mesh,
  registry: SceneMeshRegistry = defaultSceneMeshRegistry
): void {
  registry.byUuid.set(mesh.uuid, mesh);
  if (mesh.name) {
    registry.byName.set(mesh.name, mesh);
  }
}

/**
 * Unregisters an unmounted anatomical mesh from O(1) scene registries.
 */
export function unregisterSceneMesh(
  mesh: THREE.Mesh,
  registry: SceneMeshRegistry = defaultSceneMeshRegistry
): void {
  registry.byUuid.delete(mesh.uuid);
  if (mesh.name && registry.byName.get(mesh.name) === mesh) {
    registry.byName.delete(mesh.name);
  }
}

/**
 * Resolves a mounted anatomical mesh in O(1) time by UUID, falling back to rawName.
 */
export function getRegisteredSceneMesh(
  meshUuid?: string | null,
  rawName?: string | null,
  registry: SceneMeshRegistry = defaultSceneMeshRegistry
): THREE.Mesh | null {
  if (meshUuid) {
    const byUuid = registry.byUuid.get(meshUuid);
    if (byUuid) return byUuid;
  }
  if (rawName) {
    const byName = registry.byName.get(rawName);
    if (byName) return byName;
  }
  return null;
}

const bvhQueue: THREE.BufferGeometry[] = [];
const queuedGeometries = new WeakSet<THREE.BufferGeometry>();
let bvhTimerHandle: number | null = null;

function processBvhChunk(): void {
  bvhTimerHandle = null;
  let processed = 0;
  while (bvhQueue.length > 0 && processed < 5) {
    const geom = bvhQueue.shift();
    if (!geom) continue;
    const vertCount = geom.attributes?.position?.count ?? 0;
    if (!geom.boundsTree && vertCount > 0) {
      try {
        geom.computeBoundsTree();
      } catch {
        // Ignore malformed geometry
      }
    }
    processed += 1;
  }
  if (bvhQueue.length > 0) {
    scheduleNextBvhChunk();
  }
}

function scheduleNextBvhChunk(): void {
  if (bvhTimerHandle !== null || typeof window === 'undefined') return;
  const ric = (
    window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === 'function') {
    bvhTimerHandle = ric(processBvhChunk, { timeout: 50 });
  } else {
    bvhTimerHandle = window.setTimeout(processBvhChunk, 16);
  }
}

/**
 * Queues non-blocking BVH tree generation in 5-mesh idle chunks so heavy models
 * never freeze the UI thread during mount.
 */
export function enqueueGeometryBVH(
  geometry: THREE.BufferGeometry | undefined | null
): void {
  if (!geometry || geometry.boundsTree || queuedGeometries.has(geometry)) {
    return;
  }
  const vertCount = geometry.attributes?.position?.count ?? 0;
  if (vertCount <= 0) return;
  queuedGeometries.add(geometry);
  bvhQueue.push(geometry);
  scheduleNextBvhChunk();
}

const fastConditionalRaycast: THREE.Mesh['raycast'] = function (
  this: THREE.Mesh,
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[]
) {
  if (!this.visible || cameraInteractionState.isOrbiting) return;
  if (!this.layers.test(raycaster.layers)) return;
  return acceleratedRaycast.call(this, raycaster, intersects);
};

/**
 * Patches Three.js BufferGeometry and Mesh prototypes once with three-mesh-bvh
 * acceleration structures for sub-millisecond raycasting.
 */
export function initBVH(): void {
  if (isBVHInitialized) return;

  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = fastConditionalRaycast;

  isBVHInitialized = true;
}

initBVH();
