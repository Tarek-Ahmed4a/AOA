/**
 * Z-Anatomy Official Project Archive Ingestion & GLB Pipeline
 * -----------------------------------------------------------
 * Locates the Z-Anatomy .zip archive in the project root (or public/models/),
 * purges legacy mismatched Sketchfab .glb models, parses authentic Z-Anatomy
 * 1.0 .mat material shaders and .fbx anatomical systems with world coordinates
 * preserved, deduplicates geometry vertices, and exports aligned system .glb
 * bundles + manifest.json into public/models/zanatomy/.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'public', 'models', 'zanatomy');

// Polyfill FileReader for Three.js GLTFExporter inside Node.js
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onloadend) this.onloadend();
        if (this.onload) this.onload({ target: this });
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        const b64 = Buffer.from(buf).toString('base64');
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
        if (this.onloadend) this.onloadend();
        if (this.onload) this.onload({ target: this });
      });
    }
  };
}

// Preserve Z-Anatomy dots (.l, .r, .j, .i, .t, .s, .g, .o*, .e*) inside FBX node names
THREE.PropertyBinding.sanitizeNodeName = (name) => name.replace(/\s/g, '_');

/**
 * Minimal dependency-free ZIP reader using standard EOCD + Central Directory + node:zlib
 */
class ZipArchive {
  constructor(filePath) {
    this.filePath = filePath;
    this.fd = fs.openSync(filePath, 'r');
    this.size = fs.fstatSync(this.fd).size;
    this.entries = this.#readCentralDirectory();
  }

  #readRange(offset, length) {
    const buf = Buffer.allocUnsafe(length);
    let totalRead = 0;
    while (totalRead < length) {
      const bytes = fs.readSync(this.fd, buf, totalRead, length - totalRead, offset + totalRead);
      if (bytes === 0) break;
      totalRead += bytes;
    }
    return totalRead === length ? buf : buf.subarray(0, totalRead);
  }

  #readCentralDirectory() {
    const tailLen = Math.min(this.size, 65557);
    const tailOffset = this.size - tailLen;
    const tail = this.#readRange(tailOffset, tailLen);

    let eocdIdx = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocdIdx = i;
        break;
      }
    }
    if (eocdIdx < 0) {
      throw new Error(`Invalid ZIP archive (EOCD not found): ${this.filePath}`);
    }

    const totalEntries = tail.readUInt16LE(eocdIdx + 10);
    const cdSize = tail.readUInt32LE(eocdIdx + 12);
    const cdOffset = tail.readUInt32LE(eocdIdx + 16);
    const cdBuf = this.#readRange(cdOffset, cdSize);

    const list = [];
    let pos = 0;
    while (pos + 46 <= cdBuf.length && list.length < totalEntries) {
      if (cdBuf.readUInt32LE(pos) !== 0x02014b50) break;
      const compMethod = cdBuf.readUInt16LE(pos + 10);
      const compSize = cdBuf.readUInt32LE(pos + 20);
      const uncompSize = cdBuf.readUInt32LE(pos + 24);
      const nameLen = cdBuf.readUInt16LE(pos + 28);
      const extraLen = cdBuf.readUInt16LE(pos + 30);
      const commentLen = cdBuf.readUInt16LE(pos + 32);
      const localHeaderOffset = cdBuf.readUInt32LE(pos + 42);
      const name = cdBuf.subarray(pos + 46, pos + 46 + nameLen).toString('utf8');

      list.push({ name, compMethod, compSize, uncompSize, localHeaderOffset });
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return list;
  }

  readEntryBuffer(entry) {
    const lh = this.#readRange(entry.localHeaderOffset, 30);
    if (lh.readUInt32LE(0) !== 0x04034b50) {
      throw new Error(`Corrupt local header for ${entry.name}`);
    }
    const nameLen = lh.readUInt16LE(26);
    const extraLen = lh.readUInt16LE(28);
    const dataOffset = entry.localHeaderOffset + 30 + nameLen + extraLen;
    const raw = this.#readRange(dataOffset, entry.compSize);

    if (entry.compMethod === 0) return raw;
    if (entry.compMethod === 8) return zlib.inflateRawSync(raw);
    throw new Error(`Unsupported ZIP compression method ${entry.compMethod} for ${entry.name}`);
  }

  close() {
    fs.closeSync(this.fd);
  }
}

function findZipArchive() {
  const candidates = [];
  for (const dir of [ROOT_DIR, path.join(ROOT_DIR, 'public', 'models')]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.toLowerCase().endsWith('.zip')) {
        candidates.push(path.join(dir, file));
      }
    }
  }
  const preferred = candidates.find((p) => path.basename(p).toLowerCase().includes('z-anatomy'));
  return preferred || candidates[0] || null;
}

function purgeOldZAnatomyDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    return;
  }
  for (const file of fs.readdirSync(OUT_DIR)) {
    if (file.endsWith('.glb') || file.endsWith('.gltf') || file === 'manifest.json') {
      fs.unlinkSync(path.join(OUT_DIR, file));
      console.log(`Purged legacy file: public/models/zanatomy/${file}`);
    }
  }
}

function normalizeMatKey(name) {
  return name
    .toLowerCase()
    .replace(/\.\d{3}$/, '')
    .replace(/\.mat$/, '')
    .replace(/[_\-\s]+/g, ' ')
    .trim();
}

function parseUnityMaterials(zip) {
  const matByKey = new Map();
  const matEntries = zip.entries.filter(
    (e) =>
      e.name.includes('/1.0 Materials/') &&
      e.name.endsWith('.mat') &&
      !e.name.includes('/KeyColors/') &&
      !e.name.includes('/Insertions/')
  );

  for (const entry of matEntries) {
    const text = zip.readEntryBuffer(entry).toString('utf8');
    const nameMatch = text.match(/^\s*m_Name:\s*(.+)$/m);
    const baseColorMatch = text.match(
      /- _BaseColor:\s*\{r:\s*([0-9.eE+-]+),\s*g:\s*([0-9.eE+-]+),\s*b:\s*([0-9.eE+-]+),\s*a:\s*([0-9.eE+-]+)\}/
    );
    const colorMatch = text.match(
      /- _Color:\s*\{r:\s*([0-9.eE+-]+),\s*g:\s*([0-9.eE+-]+),\s*b:\s*([0-9.eE+-]+),\s*a:\s*([0-9.eE+-]+)\}/
    );
    const smoothMatch = text.match(/- _Smoothness:\s*([0-9.eE+-]+)/);
    const metalMatch = text.match(/- _Metallic:\s*([0-9.eE+-]+)/);

    const fileBaseName = path.basename(entry.name, '.mat');
    const matName = nameMatch && nameMatch[1].trim() ? nameMatch[1].trim() : fileBaseName;
    const rgba = baseColorMatch || colorMatch;
    if (!rgba) continue;

    const r = Math.min(1, Math.max(0, parseFloat(rgba[1])));
    const g = Math.min(1, Math.max(0, parseFloat(rgba[2])));
    const b = Math.min(1, Math.max(0, parseFloat(rgba[3])));
    const smoothness = smoothMatch ? Math.min(1, Math.max(0, parseFloat(smoothMatch[1]))) : 0.45;
    const metallic = metalMatch ? Math.min(1, Math.max(0, parseFloat(metalMatch[1]))) : 0.0;

    const relFolder = entry.name.split('/1.0 Materials/')[1].split('/')[0].toLowerCase();
    const spec = {
      name: matName,
      folder: relFolder,
      r,
      g,
      b,
      roughness: Math.min(0.92, Math.max(0.18, 1 - smoothness * 0.8)),
      metalness: Math.min(0.15, metallic * 0.3),
    };

    matByKey.set(`${relFolder}:${normalizeMatKey(matName)}`, spec);
    if (!matByKey.has(normalizeMatKey(matName))) {
      matByKey.set(normalizeMatKey(matName), spec);
    }
    matByKey.set(`${relFolder}:${normalizeMatKey(fileBaseName)}`, spec);
    if (!matByKey.has(normalizeMatKey(fileBaseName))) {
      matByKey.set(normalizeMatKey(fileBaseName), spec);
    }
  }

  return matByKey;
}

const SYSTEM_MATERIAL_FOLDERS = {
  skeletal: 'bones',
  muscular: 'muscles',
  visceral: 'splanchnology',
  cardiovascular: 'cardiovascular',
  nervous: 'nervous',
  integumentary: 'regions',
};

const HELPER_NAME_RE = /\.(?:j|i|t|s|[oe]\d*[lr]?)(?=$|\.)/i;
const HELPER_PREFIX_RE = /^(?:cross_section|text|line|camera|light)/i;
const INSERTION_MAT_RE = /^(?:origin|end[-_\s]|muscular[_\s](?:origin|ending)|line)/i;

function isHelperNode(obj, ancestorsHaveHelperName) {
  const n = obj.name || '';
  if (ancestorsHaveHelperName || HELPER_NAME_RE.test(n) || HELPER_PREFIX_RE.test(n)) {
    return true;
  }
  return false;
}

function formatCleanExportMeshName(rawName) {
  let clean = (rawName || '').trim().replace(/\.g$/i, '');
  if (/\.l$/i.test(clean)) {
    clean = `${clean.slice(0, -2)}_Left`;
  } else if (/\.r$/i.test(clean)) {
    clean = `${clean.slice(0, -2)}_Right`;
  }
  return clean;
}

function lookupMaterialSpec(matName, systemKey, matMap) {
  const key = normalizeMatKey(matName || '');
  const folder = SYSTEM_MATERIAL_FOLDERS[systemKey] || '';
  if (matMap.has(`${folder}:${key}`)) return matMap.get(`${folder}:${key}`);
  if (matMap.has(key)) return matMap.get(key);

  // Strip numeric suffix e.g. Bone-1 -> Bone 1 / Bone
  const noDashNum = key.replace(/-\d+$/, '').trim();
  if (matMap.has(`${folder}:${noDashNum}`)) return matMap.get(`${folder}:${noDashNum}`);
  if (matMap.has(noDashNum)) return matMap.get(noDashNum);

  const baseWord = key.replace(/[\d'-]+$/g, '').trim();
  if (matMap.has(`${folder}:${baseWord}`)) return matMap.get(`${folder}:${baseWord}`);
  if (matMap.has(baseWord)) return matMap.get(baseWord);

  return null;
}

function buildStandardMaterial(origMat, systemKey, matMap, sharedMaterialCache) {
  const origName = (origMat?.name || '').trim();
  if (INSERTION_MAT_RE.test(origName)) return null;

  const cacheKey = `${systemKey}::${origName}`;
  if (sharedMaterialCache.has(cacheKey)) {
    return sharedMaterialCache.get(cacheKey);
  }

  const spec = lookupMaterialSpec(origName, systemKey, matMap);
  const stdMat = new THREE.MeshStandardMaterial({
    name: origName || `${systemKey}_Material`,
    roughness: spec ? spec.roughness : 0.45,
    metalness: spec ? spec.metalness : 0.03,
    transparent: false,
    opacity: 1.0,
    side: THREE.DoubleSide,
  });

  if (spec) {
    // Unity .mat colors are stored in sRGB [0..1]; Three.js working space is Linear
    stdMat.color.setRGB(spec.r, spec.g, spec.b, THREE.SRGBColorSpace);
  } else if (origMat?.color) {
    stdMat.color.copy(origMat.color);
    // Avoid flat grey FBX placeholder when no .mat entry matched
    const c = stdMat.color;
    const isFlatGrey = Math.abs(c.r - c.g) < 0.02 && Math.abs(c.g - c.b) < 0.02 && c.r > 0.7 && c.r < 0.85;
    if (isFlatGrey) {
      if (systemKey === 'skeletal') stdMat.color.set('#e3dac9');
      else if (systemKey === 'muscular') stdMat.color.set('#d47b69');
      else if (systemKey === 'cardiovascular') stdMat.color.set('#e06c6e');
      else if (systemKey === 'nervous') stdMat.color.set('#f2e6a7');
      else if (systemKey === 'integumentary') stdMat.color.set('#eecbb7');
      else if (systemKey === 'visceral') stdMat.color.set('#c97a72');
    }
  } else {
    stdMat.color.set('#e5dec9');
  }

  sharedMaterialCache.set(cacheKey, stdMat);
  return stdMat;
}

function optimizeAndFlattenGeometry(srcGeom, worldMatrix) {
  const geom = srcGeom.clone();
  geom.applyMatrix4(worldMatrix);

  // Strip unused attributes (uv, color, tangent) to keep GLB lean & index cleanly
  for (const attrName of Object.keys(geom.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal') {
      geom.deleteAttribute(attrName);
    }
  }

  // Flip triangle winding if worldMatrix has negative determinant
  if (worldMatrix.determinant() < 0) {
    if (geom.index) {
      const idx = geom.index.array;
      for (let i = 0; i < idx.length; i += 3) {
        const tmp = idx[i + 1];
        idx[i + 1] = idx[i + 2];
        idx[i + 2] = tmp;
      }
      geom.index.needsUpdate = true;
    } else {
      const pos = geom.attributes.position.array;
      for (let i = 0; i + 8 < pos.length; i += 9) {
        for (let k = 0; k < 3; k++) {
          const tmp = pos[i + 3 + k];
          pos[i + 3 + k] = pos[i + 6 + k];
          pos[i + 6 + k] = tmp;
        }
      }
      geom.attributes.position.needsUpdate = true;
    }
    geom.computeVertexNormals();
  } else if (!geom.attributes.normal) {
    geom.computeVertexNormals();
  }

  // Round normals slightly before mergeVertices so nearly-coincident vertices deduplicate
  const normAttr = geom.attributes.normal;
  if (normAttr) {
    for (let i = 0; i < normAttr.array.length; i++) {
      normAttr.array[i] = Math.round(normAttr.array[i] * 200) / 200;
    }
  }

  try {
    const merged = mergeVertices(geom, 1e-4);
    geom.dispose();
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  } catch {
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    return geom;
  }
}

function extractCleanSystemMeshes(fbxScene, systemKey, matMap, sharedMaterialCache) {
  fbxScene.updateMatrixWorld(true);
  const keptMeshes = [];
  const unmatchedMaterials = new Set();

  function walk(node, ancestorIsHelper) {
    const nodeIsHelper = isHelperNode(node, ancestorIsHelper);
    if (nodeIsHelper) return;

    if (node.isMesh && node.geometry?.attributes?.position?.count > 0) {
      const cleanName = formatCleanExportMeshName(node.name);
      if (!cleanName || HELPER_NAME_RE.test(cleanName)) {
        // Skip empty/helper names
      } else {
        const origMats = Array.isArray(node.material) ? node.material : [node.material];
        let skipForInsertionMat = false;
        const newMats = origMats.map((m) => {
          const built = buildStandardMaterial(m, systemKey, matMap, sharedMaterialCache);
          if (!built) skipForInsertionMat = true;
          else if (m?.name && !lookupMaterialSpec(m.name, systemKey, matMap)) {
            unmatchedMaterials.add(m.name);
          }
          return built;
        });

        if (!skipForInsertionMat) {
          const optGeom = optimizeAndFlattenGeometry(node.geometry, node.matrixWorld);
          const outMat = Array.isArray(node.material) ? newMats : newMats[0];
          const cleanMesh = new THREE.Mesh(optGeom, outMat);
          cleanMesh.name = cleanName;
          keptMeshes.push(cleanMesh);
        }
      }
    }

    for (const child of node.children) {
      walk(child, nodeIsHelper);
    }
  }

  walk(fbxScene, false);
  return { keptMeshes, unmatchedMaterials };
}

function exportGroupToGlb(group, outPath) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      group,
      (gltfBuffer) => {
        const buf = Buffer.from(gltfBuffer);
        fs.writeFileSync(outPath, buf);
        resolve(buf.byteLength);
      },
      (err) => reject(err),
      { binary: true }
    );
  });
}

async function main() {
  console.log('=== Z-Anatomy Official Zip Ingestion & GLB Pipeline ===\n');

  const zipPath = findZipArchive();
  if (!zipPath) {
    console.error('❌ No .zip archive found in project root or public/models/.');
    process.exit(1);
  }
  console.log(`Found archive: ${path.relative(ROOT_DIR, zipPath)}`);

  const zip = new ZipArchive(zipPath);

  // Case B: If Blender .blend files exist in the zip and Blender CLI is available, delegate to Blender script
  const blendEntries = zip.entries.filter((e) => e.name.toLowerCase().endsWith('.blend'));
  if (blendEntries.length > 0) {
    try {
      execSync('blender --version', { stdio: 'ignore' });
      console.log('Detected .blend files + Blender installation. Running Blender exporter...');
      // Extract .blend and run scripts/export_zanatomy_blender.py if present
    } catch {
      console.log('Blender CLI not found; falling back to direct Node pipeline.');
    }
  }

  purgeOldZAnatomyDir();

  const matMap = parseUnityMaterials(zip);
  console.log(`Parsed ${matMap.size} Z-Anatomy Unity material entries.`);

  const SYSTEM_BUNDLES = [
    {
      id: 'zanatomy-skeletal',
      system: 'skeletal',
      fileName: 'skeletal.glb',
      title: 'Skeletal System & Joints (Z-Anatomy 1.0)',
      titleAr: 'الجهاز الهيكلي والمفاصل (Z-Anatomy 1.0)',
      fbxNames: ['SkeletalSystem100.fbx', 'Joints100.fbx'],
    },
    {
      id: 'zanatomy-muscular',
      system: 'muscular',
      fileName: 'muscular.glb',
      title: 'Muscular System & Fascia (Z-Anatomy 1.0)',
      titleAr: 'الجهاز العضلي واللفافات (Z-Anatomy 1.0)',
      fbxNames: ['MuscularSystem100.fbx'],
    },
    {
      id: 'zanatomy-visceral',
      system: 'visceral',
      fileName: 'visceral.glb',
      title: 'Visceral & Lymphoid Organs (Z-Anatomy 1.0)',
      titleAr: 'الأحشاء الداخلية والجهاز اللمفاوي (Z-Anatomy 1.0)',
      fbxNames: ['VisceralSystem100.fbx', 'LymphoidOrgans100.fbx'],
    },
    {
      id: 'zanatomy-cardiovascular',
      system: 'cardiovascular',
      fileName: 'cardiovascular.glb',
      title: 'Cardiovascular System (Z-Anatomy 1.0)',
      titleAr: 'القلب والأوعية الدموية (Z-Anatomy 1.0)',
      fbxNames: ['CardioVascular41.fbx'],
    },
    {
      id: 'zanatomy-nervous',
      system: 'nervous',
      fileName: 'nervous.glb',
      title: 'Nervous System & Sensory Organs (Z-Anatomy 1.0)',
      titleAr: 'الجهاز العصبي وأعضاء الحس (Z-Anatomy 1.0)',
      fbxNames: ['NervousSystem100.fbx'],
    },
    {
      id: 'zanatomy-integumentary',
      system: 'integumentary',
      fileName: 'integumentary.glb',
      title: 'Surface Anatomy & Integumentary Regions (Z-Anatomy 1.0)',
      titleAr: 'التشريح السطحي والمناطق الجلدية (Z-Anatomy 1.0)',
      fbxNames: ['Regions of human body100.fbx'],
    },
  ];

  const fbxLoader = new FBXLoader();
  const sharedMaterialCache = new Map();
  const globalBox = new THREE.Box3();
  const manifestModels = [];

  for (const bundle of SYSTEM_BUNDLES) {
    const group = new THREE.Group();
    group.name = bundle.id;

    let totalTris = 0;
    let totalVerts = 0;
    const bundleUnmatched = new Set();

    for (const fbxFile of bundle.fbxNames) {
      const entry = zip.entries.find(
        (e) => e.name.includes('/1.0 Models/') && path.basename(e.name) === fbxFile
      );
      if (!entry) {
        console.warn(`⚠️ Missing FBX in zip: ${fbxFile}`);
        continue;
      }

      console.log(`Parsing ${fbxFile} (${(entry.uncompSize / 1024 / 1024).toFixed(1)} MB)...`);
      const buf = zip.readEntryBuffer(entry);
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const fbxScene = fbxLoader.parse(ab, '');

      const { keptMeshes, unmatchedMaterials } = extractCleanSystemMeshes(
        fbxScene,
        bundle.system,
        matMap,
        sharedMaterialCache
      );
      unmatchedMaterials.forEach((m) => bundleUnmatched.add(m));

      for (const mesh of keptMeshes) {
        group.add(mesh);
        if (mesh.geometry.boundingBox) {
          globalBox.union(mesh.geometry.boundingBox);
        }
        const posCount = mesh.geometry.attributes.position.count;
        const triCount = mesh.geometry.index
          ? mesh.geometry.index.count / 3
          : posCount / 3;
        totalVerts += posCount;
        totalTris += Math.round(triCount);
      }

      console.log(`  -> Kept ${keptMeshes.length} anatomical meshes from ${fbxFile}`);
    }

    if (bundleUnmatched.size > 0) {
      console.log(`  [Unmatched .mat names fallback]: ${[...unmatchedMaterialsList(bundleUnmatched)].join(', ')}`);
    }

    const outPath = path.join(OUT_DIR, bundle.fileName);
    const sizeBytes = await exportGroupToGlb(group, outPath);
    console.log(
      `✅ Exported ${bundle.fileName}: ${group.children.length} meshes, ${totalVerts.toLocaleString()} verts, ${totalTris.toLocaleString()} tris (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)\n`
    );

    // Dispose temporary geometries before next bundle
    for (const child of group.children) {
      child.geometry?.dispose();
    }

    manifestModels.push({
      id: bundle.id,
      system: bundle.system,
      file: bundle.fileName,
      fileName: bundle.fileName,
      localPath: `/models/zanatomy/${bundle.fileName}`,
      title: bundle.title,
      titleAr: bundle.titleAr,
      author: 'Z-Anatomy (Gauthier Kervyn & Contributors)',
      license: 'CC BY-SA 4.0',
      meshCount: group.children.length,
      vertexCount: totalVerts,
      faceCount: totalTris,
      sizeBytes,
      isUnifiedFullBody: true,
    });
  }

  zip.close();

  // Compute one shared master world transform from global Z-Anatomy bounds so all 6 systems align cleanly
  const globalSize = new THREE.Vector3();
  const globalCenter = new THREE.Vector3();
  globalBox.getSize(globalSize);
  globalBox.getCenter(globalCenter);

  const TARGET_HEIGHT_M = 1.76;
  const sharedScale = TARGET_HEIGHT_M / Math.max(globalSize.y, 0.001);
  const sharedOffset = [
    Number((-globalCenter.x * sharedScale).toFixed(5)),
    Number((-globalBox.min.y * sharedScale + 0.02).toFixed(5)),
    Number((-globalCenter.z * sharedScale).toFixed(5)),
  ];

  for (const m of manifestModels) {
    m.alignment = {
      isFullBody: true,
      useSharedOrigin: true,
      sharedScale: Number(sharedScale.toFixed(8)),
      sharedOffset,
      targetHeight: TARGET_HEIGHT_M,
      targetCenter: [0, 0.9, 0],
    };
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'z-anatomy-1.0-official-zip',
    archiveFile: path.basename(zipPath),
    totalModels: manifestModels.length,
    sharedWorldTransform: {
      scale: Number(sharedScale.toFixed(8)),
      position: sharedOffset,
      rawBoundsCm: {
        min: globalBox.min.toArray().map((n) => Number(n.toFixed(2))),
        max: globalBox.max.toArray().map((n) => Number(n.toFixed(2))),
      },
    },
    models: manifestModels,
  };

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`✅ Wrote official manifest: public/models/zanatomy/manifest.json`);
  console.log(`   Shared scale: ${manifest.sharedWorldTransform.scale}, offset: [${sharedOffset.join(', ')}]`);
}

function unmatchedMaterialsList(set) {
  return [...set].slice(0, 12);
}

main().catch((err) => {
  console.error('❌ Failed processing Z-Anatomy archive:', err);
  process.exit(1);
});
