import * as THREE from 'three';

const EXTENSION_NAME = 'KHR_materials_pbrSpecularGlossiness';
const MAX_GLOSS_CANVAS_DIM = 1024;

interface KHRSpecularGlossinessDef {
  diffuseFactor?: [number, number, number, number];
  diffuseTexture?: Record<string, unknown>;
  specularFactor?: [number, number, number];
  glossinessFactor?: number;
  specularGlossinessTexture?: Record<string, unknown>;
}

interface GLTFMaterialDef {
  extensions?: Record<string, unknown>;
}

export interface GLTFParserLike {
  json: {
    materials?: GLTFMaterialDef[];
  };
  assignTexture: (
    materialParams: Record<string, unknown>,
    mapName: string,
    mapDef: unknown,
    colorSpace?: THREE.ColorSpace
  ) => Promise<unknown>;
}

export interface GLTFPluginRegistrableLoader {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: (callback: (parser: any) => any) => unknown;
}

function copyTextureTransform(src: THREE.Texture, dst: THREE.Texture): void {
  dst.wrapS = src.wrapS;
  dst.wrapT = src.wrapT;
  dst.offset.copy(src.offset);
  dst.repeat.copy(src.repeat);
  dst.center.copy(src.center);
  dst.rotation = src.rotation;
  dst.flipY = src.flipY;
  dst.channel = src.channel;
  dst.magFilter = src.magFilter;
  dst.minFilter = src.minFilter;
  dst.matrixAutoUpdate = src.matrixAutoUpdate;
  if (!src.matrixAutoUpdate) {
    dst.matrix.copy(src.matrix);
  }
}

/**
 * Converts `KHR_materials_pbrSpecularGlossiness` alpha glossiness (`A`)
 * into a PBR metallic-roughness `roughnessMap` (`1 - glossiness` in G channel).
 */
function buildRoughnessTextureFromGlossAlpha(
  specGlossTex: THREE.Texture,
  glossinessFactor: number
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const img = specGlossTex.image as
    | (CanvasImageSource & {
        width?: number;
        height?: number;
        naturalWidth?: number;
        naturalHeight?: number;
      })
    | undefined;
  if (!img) return null;

  const rawW = img.naturalWidth || img.width || 0;
  const rawH = img.naturalHeight || img.height || 0;
  if (rawW <= 0 || rawH <= 0) return null;

  const scale = Math.min(1, MAX_GLOSS_CANVAS_DIM / Math.max(rawW, rawH));
  const targetW = Math.max(1, Math.round(rawW * scale));
  const targetH = Math.max(1, Math.round(rawH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const pixels = imgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const gloss = (pixels[i + 3] / 255) * glossinessFactor;
      const roughByte = Math.max(
        10,
        Math.min(255, Math.round((1.0 - gloss) * 255))
      );
      pixels[i] = roughByte;
      pixels[i + 1] = roughByte;
      pixels[i + 2] = roughByte;
      pixels[i + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Tainted cross-origin image cannot be read back; caller keeps scalar roughness
    return null;
  }

  const roughnessTex = new THREE.CanvasTexture(canvas);
  copyTextureTransform(specGlossTex, roughnessTex);
  roughnessTex.colorSpace = THREE.NoColorSpace;
  roughnessTex.needsUpdate = true;
  return roughnessTex;
}

class GLTFMaterialsPbrSpecularGlossinessPlugin {
  name = EXTENSION_NAME;
  private parser: GLTFParserLike;

  constructor(parser: GLTFParserLike) {
    this.parser = parser;
  }

  getMaterialType(materialIndex: number): typeof THREE.MeshPhysicalMaterial | null {
    const materialDef = this.parser.json.materials?.[materialIndex];
    if (!materialDef?.extensions?.[EXTENSION_NAME]) {
      return null;
    }
    return THREE.MeshPhysicalMaterial;
  }

  extendMaterialParams(
    materialIndex: number,
    materialParams: Record<string, unknown>
  ): Promise<void> {
    const materialDef = this.parser.json.materials?.[materialIndex];
    const ext = materialDef?.extensions?.[EXTENSION_NAME] as
      | KHRSpecularGlossinessDef
      | undefined;
    if (!ext) {
      return Promise.resolve();
    }

    // Override glTF metallicRoughness defaults (`metalness = 1, roughness = 1`)
    // that GLTFLoader assigns when `pbrMetallicRoughness` is omitted.
    materialParams.metalness = 0.0;
    materialParams.ior = 1.5;
    materialParams.specularIntensity = 1.0;

    const color = new THREE.Color(1, 1, 1);
    let opacity = 1.0;
    if (Array.isArray(ext.diffuseFactor)) {
      const [r = 1, g = 1, b = 1, a = 1] = ext.diffuseFactor;
      color.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
      opacity = a;
    }
    materialParams.color = color;
    materialParams.opacity = opacity;

    const specularFactor = Array.isArray(ext.specularFactor)
      ? ext.specularFactor
      : [1, 1, 1];
    materialParams.specularColor = new THREE.Color().setRGB(
      specularFactor[0] ?? 1,
      specularFactor[1] ?? 1,
      specularFactor[2] ?? 1,
      THREE.LinearSRGBColorSpace
    );

    const glossinessFactor =
      typeof ext.glossinessFactor === 'number' ? ext.glossinessFactor : 1.0;
    materialParams.roughness = THREE.MathUtils.clamp(
      1.0 - glossinessFactor,
      0.04,
      1.0
    );

    const pending: Promise<unknown>[] = [];

    if (ext.diffuseTexture !== undefined) {
      pending.push(
        this.parser.assignTexture(
          materialParams,
          'map',
          ext.diffuseTexture,
          THREE.SRGBColorSpace
        )
      );
    }

    if (ext.specularGlossinessTexture !== undefined) {
      const scratch: Record<string, unknown> = {};
      pending.push(
        Promise.resolve(
          this.parser.assignTexture(
            scratch,
            'specGlossTex',
            ext.specularGlossinessTexture,
            THREE.SRGBColorSpace
          )
        ).then(() => {
          const specGlossTex = scratch.specGlossTex;
          if (specGlossTex instanceof THREE.Texture) {
            materialParams.specularColorMap = specGlossTex;
            const derivedRoughness = buildRoughnessTextureFromGlossAlpha(
              specGlossTex,
              glossinessFactor
            );
            if (derivedRoughness) {
              materialParams.roughnessMap = derivedRoughness;
              materialParams.roughness = 1.0;
            }
          }
        })
      );
    }

    return Promise.all(pending).then(() => undefined);
  }
}

const createPbrSpecGlossPlugin = (parser: GLTFParserLike) =>
  new GLTFMaterialsPbrSpecularGlossinessPlugin(parser);

/**
 * Stable loader extender for `@react-three/drei`'s `useGLTF` and `three`'s `GLTFLoader`.
 * Keeping module-level function references guarantees idempotent plugin registration
 * and avoids invalidating React Three Fiber loader caches.
 */
export function registerCustomGlbExtensions(
  loader: GLTFPluginRegistrableLoader
): void {
  loader.register(createPbrSpecGlossPlugin);
}
