import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { resolveAssetUrl } from './assetUrl';

const THUMB_WIDTH = 280;
const THUMB_HEIGHT = 180;
const SESSION_CACHE_PREFIX = 'aoa_glb_thumb_v1::';
const DRACO_DECODER_PATH = resolveAssetUrl('/draco/');
const GLB_FETCH_TIMEOUT_MS = 12000;

interface OffscreenBakeContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  loader: GLTFLoader;
}

const memoryCache = new Map<string, string>();
const inFlightCache = new Map<string, Promise<string | null>>();
let queueTail: Promise<void> = Promise.resolve();
let sharedContext: OffscreenBakeContext | null = null;
let contextUnavailable = false;

function readSessionCache(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
  } catch {
    return null;
  }
}

function writeSessionCache(key: string, dataUrl: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_CACHE_PREFIX + key, dataUrl);
  } catch {
    // Ignore QuotaExceededError or private browsing storage restrictions cleanly
  }
}

function yieldToMainFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      window.requestAnimationFrame(() => window.setTimeout(resolve, 16));
    } else {
      setTimeout(resolve, 16);
    }
  });
}

function ensureOffscreenContext(): OffscreenBakeContext | null {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    contextUnavailable
  ) {
    return null;
  }
  if (sharedContext) return sharedContext;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(1);
    renderer.setSize(THUMB_WIDTH, THUMB_HEIGHT, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();

    // 3-point clinical studio lighting for high-contrast anatomical snapshot thumbnails
    const ambient = new THREE.AmbientLight('#f8fafc', 0.45);
    const keyLight = new THREE.DirectionalLight('#fffaf0', 2.0);
    keyLight.position.set(2.4, 2.2, 3.2);
    const fillLight = new THREE.DirectionalLight('#e0f2fe', 0.95);
    fillLight.position.set(-2.6, 0.3, 2.0);
    const rimLight = new THREE.DirectionalLight('#bae6fd', 1.15);
    rimLight.position.set(0.6, 2.4, -3.2);
    scene.add(ambient, keyLight, fillLight, rimLight);

    const camera = new THREE.PerspectiveCamera(
      35,
      THUMB_WIDTH / THUMB_HEIGHT,
      0.005,
      500
    );

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.setCrossOrigin('anonymous');

    sharedContext = { renderer, scene, camera, loader };
    return sharedContext;
  } catch {
    contextUnavailable = true;
    return null;
  }
}

function normalizeTemporaryMeshMaterials(
  root: THREE.Object3D,
  _system?: string
): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    for (const mat of mats) {
      if (!mat) continue;
      mat.side = THREE.FrontSide;
    }
  });
}

function disposeTemporaryTextureMaps(mat: THREE.Material): void {
  const rec = mat as unknown as Record<string, unknown>;
  const mapKeys = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'emissiveMap',
    'alphaMap',
    'bumpMap',
  ];
  for (const key of mapKeys) {
    const tex = rec[key];
    if (tex instanceof THREE.Texture) {
      tex.dispose();
    }
  }
}

function disposeObjectSubtree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      disposeTemporaryTextureMaps(m);
      m.dispose();
    }
  });
}

/**
 * Returns a cached WebP thumbnail DataURL synchronously if already baked cleanly in memory or sessionStorage.
 */
export function getCachedGlbThumbnail(rawGlbUrl?: string | null): string | null {
  if (!rawGlbUrl) return null;
  const glbUrl = resolveAssetUrl(rawGlbUrl);
  const mem = memoryCache.get(glbUrl);
  if (mem) return mem;
  const persisted = readSessionCache(glbUrl);
  if (persisted) {
    memoryCache.set(glbUrl, persisted);
    return persisted;
  }
  return null;
}

/**
 * Checks whether a .glb URL is local/same-origin or known CORS-accessible for offscreen snapshot baking.
 */
export function isBakeableGlbUrl(glbUrl?: string | null): boolean {
  if (!glbUrl || typeof glbUrl !== 'string') return false;
  const trimmed = glbUrl.trim();
  if (!trimmed) return false;
  if (/^(?:\/|\.\/|file:|capacitor:|ionic:|app:|http:\/\/localhost|https:\/\/localhost)/i.test(trimmed)) {
    return true;
  }
  if (typeof window !== 'undefined' && trimmed.startsWith(window.location.origin)) {
    return true;
  }
  return /^https:\/\/cdn\.humanatlas\.io\//i.test(trimmed);
}

async function runBakeJob(
  rawGlbUrl: string,
  system?: string
): Promise<string | null> {
  const glbUrl = resolveAssetUrl(rawGlbUrl);
  const alreadyCached = getCachedGlbThumbnail(glbUrl);
  if (alreadyCached) return alreadyCached;

  const ctx = ensureOffscreenContext();
  if (!ctx) return null;

  await yieldToMainFrame();

  const controller = new AbortController();
  const timer =
    typeof window !== 'undefined'
      ? window.setTimeout(() => controller.abort(), GLB_FETCH_TIMEOUT_MS)
      : setTimeout(() => controller.abort(), GLB_FETCH_TIMEOUT_MS);

  let loadedRoot: THREE.Object3D | null = null;
  try {
    const res = await fetch(glbUrl, {
      mode: 'cors',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const baseDir = glbUrl.slice(0, glbUrl.lastIndexOf('/') + 1);
    const gltf = await ctx.loader.parseAsync(buffer, baseDir);
    loadedRoot = gltf.scene;
    if (!loadedRoot) return null;

    normalizeTemporaryMeshMaterials(loadedRoot, system);
    loadedRoot.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(loadedRoot);
    if (box.isEmpty()) return null;

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const radius = Math.max(sphere.radius, 0.005);

    // Frame camera automatically at an oblique 25-degree clinical angle
    const fovRad = THREE.MathUtils.degToRad(ctx.camera.fov);
    const distance = (radius / Math.sin(fovRad * 0.5)) * 1.15;
    const az = THREE.MathUtils.degToRad(25);
    const el = THREE.MathUtils.degToRad(14);
    const viewDir = new THREE.Vector3(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az)
    );

    ctx.camera.position.copy(sphere.center).addScaledVector(viewDir, distance);
    ctx.camera.near = Math.max(distance * 0.01, 0.001);
    ctx.camera.far = Math.max(distance * 25, 25);
    ctx.camera.lookAt(sphere.center);
    ctx.camera.updateProjectionMatrix();

    ctx.scene.add(loadedRoot);
    ctx.renderer.render(ctx.scene, ctx.camera);

    const dataUrl = ctx.renderer.domElement.toDataURL('image/webp', 0.82);
    if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < 120) {
      return null;
    }

    memoryCache.set(glbUrl, dataUrl);
    writeSessionCache(glbUrl, dataUrl);
    return dataUrl;
  } catch {
    return null;
  } finally {
    if (typeof window !== 'undefined') {
      window.clearTimeout(timer);
    } else {
      clearTimeout(timer);
    }
    if (loadedRoot) {
      ctx.scene.remove(loadedRoot);
      disposeObjectSubtree(loadedRoot);
    }
  }
}

/**
 * Renders a 280x180 WebP 3D preview snapshot for a local or CORS-accessible `.glb`
 * inside a strictly sequential single-WebGL-context offscreen queue.
 */
export function bakeGlbThumbnail(
  rawGlbUrl: string,
  system?: string
): Promise<string | null> {
  if (!rawGlbUrl || typeof window === 'undefined') {
    return Promise.resolve(null);
  }
  const glbUrl = resolveAssetUrl(rawGlbUrl);
  const cached = getCachedGlbThumbnail(glbUrl);
  if (cached) return Promise.resolve(cached);

  const existing = inFlightCache.get(glbUrl);
  if (existing) return existing;

  const jobPromise = new Promise<string | null>((resolve) => {
    queueTail = queueTail
      .then(() => runBakeJob(glbUrl, system))
      .then(
        (result) => {
          inFlightCache.delete(glbUrl);
          resolve(result);
        },
        () => {
          inFlightCache.delete(glbUrl);
          resolve(null);
        }
      );
  });

  inFlightCache.set(glbUrl, jobPromise);
  return jobPromise;
}
