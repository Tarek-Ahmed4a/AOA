import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function walkFiles(dir, extFilter) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, extFilter));
    } else if (!extFilter || entry.name.toLowerCase().endsWith(extFilter)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Compiles live TypeScript modules from `src/` into `.audit-tmp/` via esbuild
 * so the audit tests the exact production parsing, filtering, explode, and clinical baseline logic.
 */
async function loadLiveModules() {
  const tmpDir = path.join(ROOT, '.audit-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const entryPath = path.join(tmpDir, 'audit-entry.ts');
  const outPath = path.join(tmpDir, 'audit-bundle.cjs');

  fs.writeFileSync(
    entryPath,
    [
      `export * from ${JSON.stringify(path.join(ROOT, 'src/utils/anatomyParser.ts'))};`,
      `export * from ${JSON.stringify(path.join(ROOT, 'src/utils/spatialAnatomyResolver.ts'))};`,
      `export * from ${JSON.stringify(path.join(ROOT, 'src/utils/sexDimorphismFilter.ts'))};`,
      `export * from ${JSON.stringify(path.join(ROOT, 'src/utils/explodeClusters.ts'))};`,
      `export { resolveClinicalBaseline, translateAnatomicalTermToArabic } from ${JSON.stringify(path.join(ROOT, 'src/data/clinicalBaseline.ts'))};`,
      `export { resolveTextbookEntry } from ${JSON.stringify(path.join(ROOT, 'src/services/textbookKnowledgeService.ts'))};`,
    ].join('\n'),
    'utf8'
  );

  await esbuild({
    entryPoints: [entryPath],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: outPath,
    logLevel: 'silent',
  });

  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const loaded = req(outPath);
  return { loaded, tmpDir };
}

/**
 * Lightweight, DOM-free GLB 2.0 binary -> Three.js Scene Graph constructor.
 * Reads full node hierarchy, transforms, materials (including baseColorFactor),
 * and POSITION bounds/vertices directly from GLB JSON + BIN chunks.
 */
function loadGlbAsThreeScene(filePath) {
  const buf = fs.readFileSync(filePath);
  const magic = buf.toString('ascii', 0, 4);
  if (magic !== 'glTF') {
    throw new Error(`Invalid GLB magic header in ${filePath}: ${magic}`);
  }
  const chunk0Len = buf.readUInt32LE(12);
  const jsonStart = 20;
  const jsonEnd = jsonStart + chunk0Len;
  const gltf = JSON.parse(buf.toString('utf8', jsonStart, jsonEnd));

  let binBuf = null;
  if (jsonEnd + 8 <= buf.length) {
    const chunk1Len = buf.readUInt32LE(jsonEnd);
    const chunk1Type = buf.readUInt32LE(jsonEnd + 4);
    if (chunk1Type === 0x004e4942) {
      binBuf = buf.subarray(jsonEnd + 8, jsonEnd + 8 + chunk1Len);
    }
  }

  const glMaterials = (gltf.materials || []).map((mDef) => {
    const mat = new THREE.MeshStandardMaterial({
      name: mDef?.name || '',
    });
    const baseColor = mDef?.pbrMetallicRoughness?.baseColorFactor;
    if (Array.isArray(baseColor) && baseColor.length >= 3) {
      mat.color.setRGB(baseColor[0], baseColor[1], baseColor[2]);
    }
    return mat;
  });

  const glbAccessors = gltf.accessors || [];
  const glbViews = gltf.bufferViews || [];

  function buildGeometryFromPrimitive(prim) {
    const geom = new THREE.BufferGeometry();
    const posAccessorIdx = prim?.attributes?.POSITION;
    if (typeof posAccessorIdx === 'number' && glbAccessors[posAccessorIdx]) {
      const acc = glbAccessors[posAccessorIdx];
      if (Array.isArray(acc.min) && Array.isArray(acc.max)) {
        // Fast exact AABB when GLTF accessor provides min/max (always true in glTF 2.0),
        // honoring KHR_mesh_quantization normalized integer bounds.
        const denom = acc.normalized
          ? acc.componentType === 5120
            ? 127
            : acc.componentType === 5121
              ? 255
              : acc.componentType === 5122
                ? 32767
                : acc.componentType === 5123
                  ? 65535
                  : 1
          : 1;
        const scaleMin = (v) => (acc.normalized ? Math.max(v / denom, -1) : v);
        const min = acc.min.map(scaleMin);
        const max = acc.max.map(scaleMin);
        const positions = new Float32Array([
          min[0], min[1], min[2],
          max[0], min[1], min[2],
          min[0], max[1], min[2],
          max[0], max[1], min[2],
          min[0], min[1], max[2],
          max[0], min[1], max[2],
          min[0], max[1], max[2],
          max[0], max[1], max[2],
        ]);
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      } else if (binBuf && typeof acc.bufferView === 'number' && glbViews[acc.bufferView]) {
        const bv = glbViews[acc.bufferView];
        const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
        const stride = bv.byteStride || 12;
        const count = acc.count || 0;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const off = byteOffset + i * stride;
          positions[i * 3] = binBuf.readFloatLE(off);
          positions[i * 3 + 1] = binBuf.readFloatLE(off + 4);
          positions[i * 3 + 2] = binBuf.readFloatLE(off + 8);
        }
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      }
      geom.computeBoundingBox();
      geom.computeBoundingSphere();
    }
    return geom;
  }

  function applyNodeTransform(obj, nodeDef) {
    if (Array.isArray(nodeDef.matrix) && nodeDef.matrix.length === 16) {
      const mat4 = new THREE.Matrix4().fromArray(nodeDef.matrix);
      mat4.decompose(obj.position, obj.quaternion, obj.scale);
    } else {
      if (Array.isArray(nodeDef.translation)) {
        obj.position.fromArray(nodeDef.translation);
      }
      if (Array.isArray(nodeDef.rotation)) {
        obj.quaternion.fromArray(nodeDef.rotation);
      }
      if (Array.isArray(nodeDef.scale)) {
        obj.scale.fromArray(nodeDef.scale);
      }
    }
  }

  const nodes = gltf.nodes || [];
  const meshes = gltf.meshes || [];
  const objectsByNode = new Array(nodes.length);

  for (let i = 0; i < nodes.length; i++) {
    const nDef = nodes[i] || {};
    if (typeof nDef.mesh === 'number' && meshes[nDef.mesh]) {
      const mDef = meshes[nDef.mesh];
      const prims = mDef.primitives || [];
      if (prims.length <= 1) {
        const prim = prims[0] || {};
        const geom = buildGeometryFromPrimitive(prim);
        const mat =
          typeof prim.material === 'number' && glMaterials[prim.material]
            ? glMaterials[prim.material]
            : new THREE.MeshStandardMaterial();
        const mesh = new THREE.Mesh(geom, mat);
        mesh.name = nDef.name || mDef.name || `Node_${i}`;
        applyNodeTransform(mesh, nDef);
        objectsByNode[i] = mesh;
      } else {
        const group = new THREE.Group();
        group.name = nDef.name || mDef.name || `Node_${i}`;
        applyNodeTransform(group, nDef);
        prims.forEach((prim, pIdx) => {
          const geom = buildGeometryFromPrimitive(prim);
          const mat =
            typeof prim.material === 'number' && glMaterials[prim.material]
              ? glMaterials[prim.material]
              : new THREE.MeshStandardMaterial();
          const subMesh = new THREE.Mesh(geom, mat);
          // Match real Three.js GLTFLoader multi-primitive child naming (`mesh_0_1`)
          subMesh.name = `mesh_${i}_${pIdx}`;
          group.add(subMesh);
        });
        objectsByNode[i] = group;
      }
    } else {
      const group = new THREE.Group();
      group.name = nDef.name || `Group_${i}`;
      applyNodeTransform(group, nDef);
      objectsByNode[i] = group;
    }
  }

  const hasParent = new Set();
  for (let i = 0; i < nodes.length; i++) {
    const children = nodes[i]?.children || [];
    for (const cIdx of children) {
      if (objectsByNode[i] && objectsByNode[cIdx]) {
        objectsByNode[i].add(objectsByNode[cIdx]);
        hasParent.add(cIdx);
      }
    }
  }

  const root = new THREE.Group();
  root.name = 'Scene';
  const sceneIdx = typeof gltf.scene === 'number' ? gltf.scene : 0;
  const sceneNodes = gltf.scenes?.[sceneIdx]?.nodes;
  if (Array.isArray(sceneNodes) && sceneNodes.length > 0) {
    for (const nIdx of sceneNodes) {
      if (objectsByNode[nIdx]) root.add(objectsByNode[nIdx]);
    }
  } else {
    for (let i = 0; i < objectsByNode.length; i++) {
      if (!hasParent.has(i) && objectsByNode[i]) root.add(objectsByNode[i]);
    }
  }

  return { root, gltf };
}

function getMeshSpatialStats(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const sphere = new THREE.Sphere();
  const center = new THREE.Vector3();
  if (!box.isEmpty()) {
    box.getCenter(center);
    box.getBoundingSphere(sphere);
  } else {
    mesh.getWorldPosition(center);
  }
  return {
    box,
    center,
    maxZ: box.isEmpty() ? center.z : box.max.z,
    radius: box.isEmpty() ? 0 : sphere.radius,
  };
}

function mirrorMirroredNoisyCheck(mesh, normCenter, radius) {
  const name = mesh.name || '';
  const parentName = mesh.parent?.name || '';
  const matName = Array.isArray(mesh.material)
    ? mesh.material.map((m) => m?.name || '').join(' ')
    : mesh.material?.name || '';
  const joined = `${name} ${matName} ${parentName}`;
  const normalizedJoined = joined.replace(/_/g, ' ');
  const isOmentalTaenia = /\bomental\s+taenia\b/i.test(normalizedJoined);
  if (
    !isOmentalTaenia &&
    (/\b(?:greater\s+omentum|lesser\s+omentum|omentum|épiploon|epiploon|peritoneum|péritoine|peritoine|mesentery|mesocolon|mesoappendix|mésentère|mesentere|adipose)\b/i.test(
      normalizedJoined
    ) ||
      /^peritoneum/i.test(matName))
  ) {
    return true;
  }
  const isProtectedOrgan =
    /(?:omental\s*taenia|palatine\s*tonsil|\btonsil\b|\bspleen\b|\bthymus\b|\bliver\b|\bstomach\b|\bkidney\b|\blung\b|\bpancreas\b|\buterus\b|\bovary\b|\bovaries\b|\bfallopian\b|\bbladder\b|\bgallbladder\b|\bintestin|\bcolon\b|\bduodenum\b|\bjejunum\b|\bileum\b|\bcaecum\b|\bcecum\b|\brectum\b|\besophagus\b|\btrachea\b|\bbronch|\blarynx\b|\bpharynx\b|\bthyroid\b|\badrenal\b|\bureter\b|\bheart\b|\bprostate\b|\btestis\b|\bvagina\b)/i.test(
      normalizedJoined
    );
  if (isProtectedOrgan) return false;
  if (
    /(?:^|_)nodes?(?:\)|_|$)|^node_of_|^lymph_node$|\blymph|\bnodus\b|ganglion[\s_.\-]*lymphatique/i.test(
      joined
    ) ||
    /^lymph/i.test(matName)
  ) {
    return true;
  }
  const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const c = m?.color;
  if (c) {
    const sr = Math.pow(Math.max(c.r, 0), 1 / 2.2);
    const sg = Math.pow(Math.max(c.g, 0), 1 / 2.2);
    const sb = Math.pow(Math.max(c.b, 0), 1 / 2.2);
    const ny = Math.max(-1, Math.min(1, (normCenter.y - 0.9) / 0.9));
    if (
      ny > -0.18 &&
      ny < 0.15 &&
      normCenter.z > 0.04 &&
      ((c.r > 0.75 && c.g > 0.7 && c.b < 0.58) ||
        (sr > 0.75 && sg > 0.7 && sb < 0.58 && sr + sg - 2 * sb > 0.35))
    ) {
      return true;
    }
    if (
      radius > 0 &&
      radius < 0.018 &&
      ((c.g > c.r * 1.15 && c.g > c.b * 1.15 && c.g > 0.04) ||
        (sg > sr * 1.15 && sg > sb * 1.15 && sg > 0.08))
    ) {
      return true;
    }
  }
  return false;
}

const GENERIC_LABEL_REGEX =
  /(?:^|\b)(?:part\s*#?\d+|(?:—|-)\s*part\b|(?:object|mesh|primitive|submesh)(?:\s*#?\d+)?\b|node\s*#?\d+\b)|الجزء|^\d+$/i;

const MALE_LEAK_REGEX =
  /\b(?:prostat|testis|testes|testicular|epididym|ductus[\s_-]*deferens|vas[\s_-]*deferens|spermatic|seminal[\s_-]*vesicl|vesicule[\s_-]*seminale|bulbourethral|bulbo[\s_-]*uretral|cowper|corpus[\s_-]*cavernosum|corpora[\s_-]*cavernosa|corpus[\s_-]*spongiosum|glans|prepuce|foreskin|scrot|suspensory[\s_-]*ligament[\s_-]*of[\s_-]*penis|fundiform|penis|penile|bulb[\s_-]*of[\s_-]*penis|crus[\s_-]*of[\s_-]*penis|crura[\s_-]*of[\s_-]*penis|cremaster|male[\s_-]*urethra|hairs[\s_-]*of[\s_-]*head|pubic[\s_-]*hairs)\b/i;

const FEMALE_LEAK_REGEX =
  /\b(?:uterus|ovary|ovaries|ovarian|fallopian|uterine[\s_-]*tube|salpinx|vagina|vaginal|vulva|clitoris|clitoral|labium|labia|mons[\s_-]*pubis|mammary[\s_-]*gland|breast|nipple|areola|broad[\s_-]*ligament|round[\s_-]*ligament[\s_-]*of[\s_-]*uterus|greater[\s_-]*vestibular|bartholin)\b/i;

const LAZY_TEXTBOOK_FALLBACK_REGEX =
  /contributes to structural integrity|regional muscular perforating|regional periosteal & nutrient|segmental somatic motor|segmental visceral branches|vasa vasorum & systemic\/coronary|vasa nervorum \/ segmental|cutaneous perforators|structural support within/i;

function isCrossSystemClinicalMismatch(system, combinedText) {
  return (
    system !== 'integumentary' &&
    /barrier against pathogens and UV radiation/i.test(combinedText)
  );
}

const LEGITIMATE_ROOT_TA98_CODES = new Set([
  'A12.0.00.001',
  'A13.0.00.001',
  'A14.0.00.001',
  'A16.0.00.001',
]);

const CORE_60_STRUCTURES = [
  // Muscles (18)
  { name: 'Pectoralis Major', system: 'muscular', muscle: true },
  { name: 'Deltoid', system: 'muscular', muscle: true },
  { name: 'Biceps Brachii', system: 'muscular', muscle: true },
  { name: 'Triceps Brachii', system: 'muscular', muscle: true },
  { name: 'Latissimus Dorsi', system: 'muscular', muscle: true },
  { name: 'Trapezius', system: 'muscular', muscle: true },
  { name: 'Rectus Abdominis', system: 'muscular', muscle: true },
  { name: 'External Oblique', system: 'muscular', muscle: true },
  { name: 'Gluteus Maximus', system: 'muscular', muscle: true },
  { name: 'Rectus Femoris', system: 'muscular', muscle: true },
  { name: 'Biceps Femoris', system: 'muscular', muscle: true },
  { name: 'Gastrocnemius', system: 'muscular', muscle: true },
  { name: 'Tibialis Anterior', system: 'muscular', muscle: true },
  { name: 'Sternocleidomastoid', system: 'muscular', muscle: true },
  { name: 'Masseter', system: 'muscular', muscle: true },
  { name: 'Temporalis', system: 'muscular', muscle: true },
  { name: 'Diaphragm', system: 'muscular', muscle: true },
  { name: 'Serratus Anterior', system: 'muscular', muscle: true },
  { name: 'Soleus', system: 'muscular', muscle: true },
  { name: 'Sartorius', system: 'muscular', muscle: true },
  // Bones (14)
  { name: 'Cranium', system: 'skeletal' },
  { name: 'Mandible', system: 'skeletal' },
  { name: 'Cervical Vertebrae', system: 'skeletal' },
  { name: 'Thoracic Vertebrae', system: 'skeletal' },
  { name: 'Lumbar Vertebrae', system: 'skeletal' },
  { name: 'Sternum', system: 'skeletal' },
  { name: 'Ribs', system: 'skeletal' },
  { name: 'Clavicle', system: 'skeletal' },
  { name: 'Scapula', system: 'skeletal' },
  { name: 'Humerus', system: 'skeletal' },
  { name: 'Radius', system: 'skeletal' },
  { name: 'Ulna', system: 'skeletal' },
  { name: 'Pelvis', system: 'skeletal' },
  { name: 'Femur', system: 'skeletal' },
  { name: 'Tibia', system: 'skeletal' },
  { name: 'Fibula', system: 'skeletal' },
  { name: 'Patella', system: 'skeletal' },
  // Visceral & Endocrine & Reproductive (17)
  { name: 'Lungs', system: 'visceral' },
  { name: 'Trachea', system: 'visceral' },
  { name: 'Larynx', system: 'visceral' },
  { name: 'Liver', system: 'visceral' },
  { name: 'Gallbladder', system: 'visceral' },
  { name: 'Stomach', system: 'visceral' },
  { name: 'Pancreas', system: 'visceral' },
  { name: 'Spleen', system: 'visceral' },
  { name: 'Kidneys', system: 'visceral' },
  { name: 'Small Intestine', system: 'visceral' },
  { name: 'Large Intestine', system: 'visceral' },
  { name: 'Urinary Bladder', system: 'visceral' },
  { name: 'Thyroid Gland', system: 'visceral' },
  { name: 'Uterus', system: 'visceral' },
  { name: 'Ovary', system: 'visceral' },
  { name: 'Prostate Gland', system: 'visceral' },
  { name: 'Testes', system: 'visceral' },
  // Cardiovascular (6)
  { name: 'Heart', system: 'cardiovascular' },
  { name: 'Aorta', system: 'cardiovascular' },
  { name: 'Superior Vena Cava', system: 'cardiovascular' },
  { name: 'Inferior Vena Cava', system: 'cardiovascular' },
  { name: 'Carotid Arteries', system: 'cardiovascular' },
  { name: 'Jugular Veins', system: 'cardiovascular' },
  // Nervous & Integumentary (6)
  { name: 'Brain', system: 'nervous' },
  { name: 'Cerebellum', system: 'nervous' },
  { name: 'Spinal Cord', system: 'nervous' },
  { name: 'Brachial Plexus', system: 'nervous' },
  { name: 'Vagus Nerve', system: 'nervous' },
  { name: 'Sciatic Nerve', system: 'nervous' },
  { name: 'Skin', system: 'integumentary' },
];

async function runAudit() {
  const { loaded, tmpDir } = await loadLiveModules();
  try {
    const zManifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public/models/zanatomy/manifest.json'), 'utf8')
    );
    const nihManifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public/models/nih/manifest.json'), 'utf8')
    );

    const results = {
      pillar1: {
        totalMeshes: 0,
        genericFailures: [],
        lateralityErrors: [],
        spatialZoneLateralityChecks: [],
      },
      pillar2: {
        systemBounds: {},
        crossDatasetIsolated: false,
        visceralOmentumLymphVisible: [],
        visceralProtectedHidden: [],
        explodeSplits: [],
      },
      pillar3: {
        femaleModeMaleLeaks: [],
        maleModeFemaleLeaks: [],
        femaleOrgansFound: [],
        maleOrgansFound: [],
        femaleIntegumentSuppressedCount: 0,
      },
      pillar4: {
        totalCoreChecked: CORE_60_STRUCTURES.length,
        coreFailures: [],
        realMeshFallbackSamples: [],
        truncatedTextbookCount: 0,
      },
    };

    const wrapperRoot = new THREE.Group();
    wrapperRoot.name = 'Human_Body_Assembly_zanatomy-full-body_audit';

    // -----------------------------------------------------------------------
    // Traverse all 6 Z-Anatomy GLBs
    // -----------------------------------------------------------------------
    for (const modelEntry of zManifest.models) {
      const glbPath = path.join(ROOT, 'public/models/zanatomy', modelEntry.fileName);
      const { root } = loadGlbAsThreeScene(glbPath);
      const scale = modelEntry.alignment.sharedScale;
      const offset = modelEntry.alignment.sharedOffset;
      root.scale.setScalar(scale);
      root.position.set(offset[0], offset[1], offset[2]);
      wrapperRoot.add(root);
      root.updateMatrixWorld(true);

      const sysBox = new THREE.Box3();
      const systemMeshes = [];
      let partIdx = 0;

      root.traverse((obj) => {
        if (!obj.isMesh) return;
        const mesh = obj;
        partIdx += 1;
        results.pillar1.totalMeshes += 1;

        const stats = getMeshSpatialStats(mesh);
        if (!stats.box.isEmpty()) sysBox.union(stats.box);

        mesh.userData.system = modelEntry.system;
        mesh.userData.parentModelContext = modelEntry.system;
        mesh.userData.partIndex = partIdx - 1;
        mesh.userData.__spatialBounds = {
          center: stats.center.clone(),
          maxZ: stats.maxZ,
          radius: stats.radius,
          system: modelEntry.system,
        };
        mesh.userData.__restCenter = stats.center.clone();

        const parsed = loaded.parseAnatomicalMesh(
          mesh,
          `zanatomy/${modelEntry.system}`,
          partIdx - 1
        );

        // Pillar 1A: Zero Generic Labels
        if (
          GENERIC_LABEL_REGEX.test(parsed.cleanName) ||
          GENERIC_LABEL_REGEX.test(parsed.cleanNameAr || '') ||
          GENERIC_LABEL_REGEX.test(parsed.latinName)
        ) {
          results.pillar1.genericFailures.push({
            file: modelEntry.fileName,
            rawName: mesh.name,
            cleanName: parsed.cleanName,
            cleanNameAr: parsed.cleanNameAr,
          });
        }

        // Pillar 1B: Anatomical Laterality Consistency (+X = Left / Sinister, -X = Right / Dexter)
        const lat = parsed.laterality;
        const absX = Math.abs(stats.center.x);
        if (lat === 'Left' && stats.center.x < -0.025) {
          results.pillar1.lateralityErrors.push({
            file: modelEntry.fileName,
            rawName: mesh.name,
            cleanName: parsed.cleanName,
            laterality: lat,
            cx: Number(stats.center.x.toFixed(4)),
            reason: 'Labeled Left but positioned in subject Right (-X)',
          });
        }
        if (lat === 'Right' && stats.center.x > 0.025) {
          results.pillar1.lateralityErrors.push({
            file: modelEntry.fileName,
            rawName: mesh.name,
            cleanName: parsed.cleanName,
            laterality: lat,
            cx: Number(stats.center.x.toFixed(4)),
            reason: 'Labeled Right but positioned in subject Left (+X)',
          });
        }
        if (/^Liver$/i.test(parsed.cleanName) && stats.center.x > 0.03) {
          results.pillar1.lateralityErrors.push({
            file: modelEntry.fileName,
            rawName: mesh.name,
            cleanName: parsed.cleanName,
            laterality: lat,
            cx: Number(stats.center.x.toFixed(4)),
            reason: 'Whole Liver should center on subject Right (-X)',
          });
        }
        if (/^Spleen$/i.test(parsed.cleanName) && stats.center.x < 0.02) {
          results.pillar1.lateralityErrors.push({
            file: modelEntry.fileName,
            rawName: mesh.name,
            cleanName: parsed.cleanName,
            laterality: lat,
            cx: Number(stats.center.x.toFixed(4)),
            reason: 'Spleen should center on subject Left (+X)',
          });
        }
        if (/^Stomach$/i.test(parsed.cleanName) && stats.center.x < 0.0) {
          results.pillar1.lateralityErrors.push({
            file: modelEntry.fileName,
            rawName: mesh.name,
            cleanName: parsed.cleanName,
            laterality: lat,
            cx: Number(stats.center.x.toFixed(4)),
            reason: 'Stomach should center predominantly on subject Left (+X)',
          });
        }

        // Pillar 2: Visceral filter check
        if (modelEntry.system === 'visceral') {
          const isNoisy = mirrorMirroredNoisyCheck(mesh, stats.center, stats.radius);
          const isOmentumOrLymph =
            /\b(?:omentum|mesentery|mesocolon|peritoneum|lymph[\s_-]*node|nodus)\b/i.test(
              `${mesh.name} ${mesh.parent?.name || ''}`
            );
          const isProtectedOrgan =
            /\b(?:liver|stomach|spleen|kidney|lung|pancreas|small[\s_-]*intestine|large[\s_-]*intestine|urinary[\s_-]*bladder|gallbladder|palatine[\s_-]*tonsil|thymus|omental[\s_-]*taenia)\b/i.test(
              mesh.name
            );
          if (isOmentumOrLymph && !isProtectedOrgan && !isNoisy) {
            results.pillar2.visceralOmentumLymphVisible.push({
              file: modelEntry.fileName,
              rawName: mesh.name,
            });
          }
          if (isProtectedOrgan && isNoisy) {
            results.pillar2.visceralProtectedHidden.push({
              file: modelEntry.fileName,
              rawName: mesh.name,
            });
          }
        }

        // Pillar 2B: Explode macro-unit check on muscles, tendons, and hands/feet
        const clusterId = loaded.resolveExplodeClusterId(
          `${mesh.parent?.name || ''} ${mesh.name} ${parsed.cleanName}`,
          modelEntry.system,
          stats.center
        );
        systemMeshes.push({ mesh, parsed, stats, clusterId });

        // Pillar 3: Sex dimorphism test across Z-Anatomy
        const visFemale = loaded.isMeshVisibleForSex(
          mesh,
          'female',
          mesh.userData.__spatialBounds
        );
        const isFemaleHairSuppress =
          modelEntry.system === 'integumentary' &&
          /\b(?:hairs?[\s_]+of[\s_]+head|pubic[\s_]+hairs?)\b/i.test(
            `${mesh.name} ${parsed.cleanName}`
          );
        if (isFemaleHairSuppress) results.pillar3.femaleIntegumentSuppressedCount += 1;
        const effectiveVisFemale = visFemale && !isFemaleHairSuppress;
        const visMale = loaded.isMeshVisibleForSex(
          mesh,
          'male',
          mesh.userData.__spatialBounds
        );

        const labelAll = `${mesh.parent?.name || ''} ${mesh.name} ${parsed.cleanName}`;
        if (effectiveVisFemale && MALE_LEAK_REGEX.test(labelAll)) {
          // Allow protected "suspensory ligament of eyeball/ovary" or shared perineal if false positive? Flag and inspect!
          if (!/suspensory\s+ligament\s+of\s+(?:eyeball|ovary)/i.test(labelAll)) {
            results.pillar3.femaleModeMaleLeaks.push({
              file: modelEntry.fileName,
              rawName: mesh.name,
              cleanName: parsed.cleanName,
            });
          }
        }
        if (visMale && FEMALE_LEAK_REGEX.test(labelAll)) {
          results.pillar3.maleModeFemaleLeaks.push({
            file: modelEntry.fileName,
            rawName: mesh.name,
            cleanName: parsed.cleanName,
          });
        }

        // Exhaustive P4 clinical baseline verification across EVERY Z-Anatomy mesh (zero lazy fallbacks, zero truncated text, zero hashed TA98)
        const base = loaded.resolveClinicalBaseline(parsed);
        const p4Profile = base.profile;
        const p4Combined = `${p4Profile.primaryFunctionEn} ${p4Profile.arterialSupply} ${p4Profile.venousDrainage} ${p4Profile.innervation}`;
        const p4Truncated =
          /\b(?:and|or|of|the|via|from|to|with|by)\s*[,;:\-]?$/i.test(
            (p4Profile.arterialSupply || '').trim()
          ) ||
          /\b(?:and|or|of|the|via|from|to|with|by)\s*[,;:\-]?$/i.test(
            (p4Profile.innervation || '').trim()
          );
        const p4BadTa98 =
          !p4Profile.ta98Code ||
          (p4Profile.ta98Code.includes('.0.00.') &&
            !LEGITIMATE_ROOT_TA98_CODES.has(p4Profile.ta98Code));
        const p4BadAr =
          !p4Profile.cleanNameAr || /^\s*الجزء(?:\s*\d+)?\s*$/i.test(p4Profile.cleanNameAr);

        if (
          LAZY_TEXTBOOK_FALLBACK_REGEX.test(p4Combined) ||
          isCrossSystemClinicalMismatch(parsed.system, p4Combined) ||
          p4Truncated ||
          p4BadTa98 ||
          p4BadAr
        ) {
          results.pillar4.realMeshFallbackSamples.push({
            file: modelEntry.fileName,
            cleanName: parsed.cleanName,
            system: parsed.system,
            ta98Code: p4Profile.ta98Code,
            cleanNameAr: p4Profile.cleanNameAr,
            arterial: p4Profile.arterialSupply,
            func: p4Profile.primaryFunctionEn,
            p4Truncated,
            p4BadTa98,
            p4BadAr,
          });
        }
      });

      const sysCenter = new THREE.Vector3();
      if (!sysBox.isEmpty()) sysBox.getCenter(sysCenter);
      results.pillar2.systemBounds[`zanatomy:${modelEntry.system}`] = {
        meshCount: systemMeshes.length,
        center: [
          Number(sysCenter.x.toFixed(4)),
          Number(sysCenter.y.toFixed(4)),
          Number(sysCenter.z.toFixed(4)),
        ],
        minY: Number(sysBox.min.y.toFixed(4)),
        maxY: Number(sysBox.max.y.toFixed(4)),
      };

      // Check skeletal hand/foot bone clustering & rigid offset vector equality
      const checkRigidCluster = (groupLabel, items) => {
        if (items.length <= 1) return;
        const clusterSet = new Set(items.map((x) => x.clusterId));
        const vecs = items.map((x) => {
          const dummy = new THREE.Mesh();
          const rest = new THREE.Vector3();
          loaded.applyRigidMacroExplodeOffset(dummy, x.clusterId, 1.0, rest);
          return dummy.position.clone();
        });
        const maxDist = Math.max(
          ...vecs.map((v) => v.distanceTo(vecs[0]))
        );
        if (clusterSet.size > 1 || maxDist > 1e-6) {
          results.pillar2.explodeSplits.push({
            group: groupLabel,
            clusters: [...clusterSet],
            maxVectorDelta: Number(maxDist.toFixed(6)),
            samples: items.map((m) => `${m.parsed.rawName} -> ${m.clusterId}`),
          });
        }
      };

      if (modelEntry.system === 'skeletal') {
        for (const handSide of ['Left', 'Right']) {
          checkRigidCluster(
            `${handSide} Hand Bones`,
            systemMeshes.filter(
              ({ parsed, stats }) =>
                stats.center.y > 0.5 &&
                /\b(?:carpal|scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|metacarp|phalanx.*hand)\b/i.test(
                  parsed.rawName
                ) &&
                parsed.laterality === handSide
            )
          );
          checkRigidCluster(
            `${handSide} Foot Bones`,
            systemMeshes.filter(
              ({ parsed }) =>
                /\b(?:tarsal|talus|calcane|navicular|cuboid|cuneiform|metatars|phalanx.*foot|of_foot)\b/i.test(
                  parsed.rawName
                ) && parsed.laterality === handSide
            )
          );
        }
      }

      if (modelEntry.system === 'muscular') {
        const muscleGroupFilters = [
          { label: 'Biceps_brachii', match: (r) => r.includes('biceps_brachii') },
          { label: 'Triceps_brachii', match: (r) => r.includes('triceps_brachii') },
          { label: 'Deltoid', match: (r) => r.includes('deltoid') },
          { label: 'Pectoralis_major', match: (r) => r.includes('pectoralis_major') },
          { label: 'Gastrocnemius', match: (r) => r.includes('gastrocnemius') },
          { label: 'Soleus', match: (r) => r.includes('soleus') },
          { label: 'Tibialis_anterior', match: (r) => r.includes('tibialis_anterior') },
          { label: 'Rectus_femoris', match: (r) => r.includes('rectus_femoris') },
          { label: 'Gluteus_maximus', match: (r) => r.includes('gluteus_maximus') },
          { label: 'Trapezius', match: (r) => r.includes('trapezius') },
          { label: 'Latissimus_dorsi', match: (r) => r.includes('latissimus_dorsi') },
          { label: 'Sartorius', match: (r) => r.includes('sartorius') },
          { label: 'Iliopsoas', match: (r) => r.includes('iliopsoas') },
          { label: 'Quadriceps', match: (r) => r.includes('quadriceps') },
          {
            label: 'Extensor_digitorum (Forearm)',
            match: (r) => r.includes('extensor_digitorum') && !/longus|brevis/.test(r),
          },
          {
            label: 'Extensor_digitorum_longus/brevis (Leg/Foot)',
            match: (r) => /extensor_digitorum_(?:longus|brevis)/.test(r),
          },
          { label: 'Flexor_carpi', match: (r) => r.includes('flexor_carpi') },
        ];
        for (const groupSpec of muscleGroupFilters) {
          for (const side of ['Left', 'Right']) {
            checkRigidCluster(
              `${side} ${groupSpec.label} (belly + tendons/sheaths)`,
              systemMeshes.filter(
                ({ parsed }) =>
                  groupSpec.match(parsed.rawName.toLowerCase()) &&
                  parsed.laterality === side
              )
            );
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Pillar 1C: Direct Spatial Resolver Laterality & Asymmetric Landmarks Test
    // -----------------------------------------------------------------------
    const spatialProbes = [
      { coords: { nx: -0.06, ny: 0.22, nz: 0.04, frame: 'normalized' }, sys: 'visceral', expectedIncl: 'Liver', expectedSide: 'Median / Unpaired' },
      { coords: { nx: 0.08, ny: 0.22, nz: -0.02, frame: 'normalized' }, sys: 'visceral', expectedIncl: 'Spleen', expectedSide: 'Median / Unpaired' },
      { coords: { nx: -0.08, ny: 0.35, nz: 0.0, frame: 'normalized' }, sys: 'visceral', expectedIncl: 'Right', expectedSide: 'Right' },
      { coords: { nx: 0.08, ny: 0.35, nz: 0.0, frame: 'normalized' }, sys: 'visceral', expectedIncl: 'Left', expectedSide: 'Left' },
      { coords: { nx: -0.07, ny: 0.04, nz: -0.02, frame: 'normalized' }, sys: 'visceral', expectedIncl: 'Right Kidney', expectedSide: 'Right' },
      { coords: { nx: 0.07, ny: 0.04, nz: -0.02, frame: 'normalized' }, sys: 'visceral', expectedIncl: 'Left Kidney', expectedSide: 'Left' },
      { coords: { nx: -0.25, ny: 0.45, nz: 0.0, frame: 'normalized' }, sys: 'skeletal', expectedIncl: 'Right', expectedSide: 'Right' },
      { coords: { nx: 0.25, ny: 0.45, nz: 0.0, frame: 'normalized' }, sys: 'skeletal', expectedIncl: 'Left', expectedSide: 'Left' },
    ];
    for (const probe of spatialProbes) {
      const res = loaded.resolveSpatialStructure(probe.coords, probe.sys);
      const ok =
        res.cleanNameEn.includes(probe.expectedIncl) &&
        res.laterality === probe.expectedSide;
      if (!ok) {
        results.pillar1.spatialZoneLateralityChecks.push({ probe, res });
      }
    }

    // -----------------------------------------------------------------------
    // Traverse ALL 73 NIH GLBs
    // -----------------------------------------------------------------------
    for (const sex of ['male', 'female']) {
      for (const organ of nihManifest[sex] || []) {
        const rel = organ.localPath.replace(/^\//, '');
        const glbPath = path.join(ROOT, 'public', rel);
        const { root } = loadGlbAsThreeScene(glbPath);
        const [tx, ty, tz] = organ.placement?.translation || [0, 0, 0];
        const [rx, ry, rz] = organ.placement?.rotation || [0, 0, 0];
        const [sx, sy, sz] = organ.placement?.scale || [1, 1, 1];
        root.position.set(tx, ty, tz);
        root.rotation.set(
          THREE.MathUtils.degToRad(rx),
          THREE.MathUtils.degToRad(ry),
          THREE.MathUtils.degToRad(rz)
        );
        root.scale.set(sx, sy, sz);
        root.updateMatrixWorld(true);

        root.traverse((obj) => {
          if (!obj.isMesh) return;
          results.pillar1.totalMeshes += 1;
          const mesh = obj;
          const stats = getMeshSpatialStats(mesh);
          mesh.userData.system = organ.system;
          mesh.userData.nihOrganId = organ.id;
          mesh.userData.ta98Code = organ.ta98Code;
          mesh.userData.__spatialBounds = {
            center: stats.center.clone(),
            maxZ: stats.maxZ,
            radius: stats.radius,
            system: organ.system,
          };

          const parsed = loaded.parseAnatomicalMesh(mesh, organ.system);
          if (
            GENERIC_LABEL_REGEX.test(parsed.cleanName) ||
            GENERIC_LABEL_REGEX.test(parsed.cleanNameAr || '')
          ) {
            results.pillar1.genericFailures.push({
              file: organ.localPath,
              rawName: mesh.name,
              cleanName: parsed.cleanName,
            });
          }

          if (organ.side === 'Left' && stats.center.x < -0.01) {
            results.pillar1.lateralityErrors.push({
              file: organ.localPath,
              rawName: mesh.name,
              cx: Number(stats.center.x.toFixed(4)),
              reason: 'NIH Left organ positioned at -X',
            });
          }
          if (organ.side === 'Right' && stats.center.x > 0.01) {
            results.pillar1.lateralityErrors.push({
              file: organ.localPath,
              rawName: mesh.name,
              cx: Number(stats.center.x.toFixed(4)),
              reason: 'NIH Right organ positioned at +X',
            });
          }

          if (sex === 'female' && loaded.isMeshVisibleForSex(mesh, 'female') && MALE_LEAK_REGEX.test(`${organ.id} ${mesh.name}`)) {
            if (!/\b(?:mammary|suspensory\s+ligament\s+of\s+ovary)\b/i.test(mesh.name)) {
              results.pillar3.femaleModeMaleLeaks.push({
                file: organ.localPath,
                rawName: mesh.name,
              });
            }
          }
          if (sex === 'male' && loaded.isMeshVisibleForSex(mesh, 'male') && FEMALE_LEAK_REGEX.test(`${organ.id} ${mesh.name}`)) {
            results.pillar3.maleModeFemaleLeaks.push({
              file: organ.localPath,
              rawName: mesh.name,
            });
          }
          if (sex === 'female' && /\b(?:uterus|ovary|fallopian|mammary)\b/i.test(organ.id)) {
            if (!results.pillar3.femaleOrgansFound.includes(organ.id)) {
              results.pillar3.femaleOrgansFound.push(organ.id);
            }
          }
          if (sex === 'male' && /\bprostate\b/i.test(organ.id)) {
            if (!results.pillar3.maleOrgansFound.includes(organ.id)) {
              results.pillar3.maleOrgansFound.push(organ.id);
            }
          }
        });
      }
    }

    // -----------------------------------------------------------------------
    // Check cross-dataset isolation & visceral preset logic in source code
    // -----------------------------------------------------------------------
    const managerSrc = fs.readFileSync(
      path.join(ROOT, 'src/components/canvas/AnatomicalModelManager.tsx'),
      'utf8'
    );
    const nihSvcSrc = fs.readFileSync(
      path.join(ROOT, 'src/services/nihSceneService.ts'),
      'utf8'
    );
    results.pillar2.crossDatasetIsolated =
      /if\s*\(activeAtlasPreset\s*===\s*'nih-visible-human'\)\s*\{\s*return\s*\[\];/.test(managerSrc) &&
      /activeAtlasPreset\s*===\s*'nih-visible-human'\s*\?\s*activeNihOrgans\s*:\s*\[\]/.test(managerSrc) &&
      !/female_muscular\.glb|female_pelvis_viscera\.glb/.test(managerSrc) &&
      /isPeritonealOverlay/.test(managerSrc) &&
      /lymph\[-_\\s\]\?node/.test(nihSvcSrc);

    // -----------------------------------------------------------------------
    // Pillar 4: Verify all Top 60+ Core Textbook Structures
    // -----------------------------------------------------------------------
    results.pillar4.coreVerifiedTable = [];
    for (const item of CORE_60_STRUCTURES) {
      const part = loaded.parseAnatomicalString(item.name, item.name, item.system);
      const { profile } = loaded.resolveClinicalBaseline(part);
      const issues = [];

      if (LAZY_TEXTBOOK_FALLBACK_REGEX.test(profile.primaryFunctionEn || '')) {
        issues.push('Lazy generic primaryFunctionEn fallback');
      }
      if (LAZY_TEXTBOOK_FALLBACK_REGEX.test(profile.arterialSupply || '')) {
        issues.push('Lazy generic arterialSupply fallback');
      }
      if (LAZY_TEXTBOOK_FALLBACK_REGEX.test(profile.innervation || '')) {
        issues.push('Lazy generic innervation fallback');
      }
      if (!profile.arterialSupply || profile.arterialSupply.length < 8) {
        issues.push('Missing/short arterialSupply');
      }
      if (!profile.venousDrainage || profile.venousDrainage.length < 8) {
        issues.push('Missing/short venousDrainage');
      }
      if (!profile.innervation || profile.innervation.length < 6) {
        issues.push('Missing/short innervation');
      }
      if (profile.arterialSupply && /\b(?:and|or|of|the|via|from|to|with|by)\s*[,;:\-]?$/i.test(profile.arterialSupply.trim())) {
        issues.push(`Truncated arterialSupply: "${profile.arterialSupply}"`);
        results.pillar4.truncatedTextbookCount += 1;
      }
      if (profile.innervation && /\b(?:and|or|of|the|via|from|to|with|by)\s*[,;:\-]?$/i.test(profile.innervation.trim())) {
        issues.push(`Truncated innervation: "${profile.innervation}"`);
        results.pillar4.truncatedTextbookCount += 1;
      }
      if (item.muscle) {
        if (!profile.origin || profile.origin.length < 6) issues.push('Missing muscle origin');
        if (!profile.insertion || profile.insertion.length < 6) issues.push('Missing muscle insertion');
        if (!profile.action || profile.action.length < 6) issues.push('Missing muscle action');
      }
      if (!profile.cleanNameAr || /الجزء|\bPart\b/i.test(profile.cleanNameAr)) {
        issues.push(`Invalid Arabic name: ${profile.cleanNameAr}`);
      }
      if (
        !profile.ta98Code ||
        (profile.ta98Code.includes('.0.00.') &&
          !LEGITIMATE_ROOT_TA98_CODES.has(profile.ta98Code))
      ) {
        issues.push(`Generic fallback TA98 code: ${profile.ta98Code}`);
      }

      results.pillar4.coreVerifiedTable.push({
        key: item.name,
        cleanNameEn: profile.cleanNameEn,
        cleanNameAr: profile.cleanNameAr,
        latinName: profile.latinName,
        ta98Code: profile.ta98Code,
        system: profile.system,
        arterialSupply: profile.arterialSupply,
        innervation: profile.innervation,
      });

      if (issues.length > 0) {
        results.pillar4.coreFailures.push({
          name: item.name,
          system: item.system,
          issues,
          cleanNameEn: profile.cleanNameEn,
          cleanNameAr: profile.cleanNameAr,
          ta98Code: profile.ta98Code,
        });
      }
    }

    const totalFailures =
      results.pillar1.genericFailures.length +
      results.pillar1.lateralityErrors.length +
      results.pillar1.spatialZoneLateralityChecks.length +
      (results.pillar2.crossDatasetIsolated ? 0 : 1) +
      results.pillar2.visceralOmentumLymphVisible.length +
      results.pillar2.visceralProtectedHidden.length +
      results.pillar2.explodeSplits.length +
      results.pillar3.femaleModeMaleLeaks.length +
      results.pillar3.maleModeFemaleLeaks.length +
      results.pillar4.coreFailures.length +
      results.pillar4.realMeshFallbackSamples.length;

    // Print concise diagnostic summary
    console.log('=== MEDICAL PROFESSOR AUDIT (FINAL VERIFICATION) ===');
    console.log('Total meshes audited (Z-Anatomy + NIH):', results.pillar1.totalMeshes);
    console.log('P1 Generic label failures:', results.pillar1.genericFailures.length);
    if (results.pillar1.genericFailures.length > 0) {
      console.log('  Sample generic failures:', results.pillar1.genericFailures.slice(0, 15));
    }
    console.log('P1 Laterality errors (GLB):', results.pillar1.lateralityErrors.length);
    if (results.pillar1.lateralityErrors.length > 0) {
      console.log('  Sample laterality errors:', results.pillar1.lateralityErrors.slice(0, 15));
    }
    console.log('P1 Spatial zone probe failures:', results.pillar1.spatialZoneLateralityChecks.length);
    if (results.pillar1.spatialZoneLateralityChecks.length > 0) {
      console.log('  Sample spatial zone fails:', results.pillar1.spatialZoneLateralityChecks);
    }
    console.log('P2 Cross-dataset isolated:', results.pillar2.crossDatasetIsolated);
    console.log('P2 System bounds:', results.pillar2.systemBounds);
    console.log('P2 Visceral noisy visible leaks:', results.pillar2.visceralOmentumLymphVisible.length, results.pillar2.visceralOmentumLymphVisible);
    console.log('P2 Visceral protected hidden accidentally:', results.pillar2.visceralProtectedHidden.length, results.pillar2.visceralProtectedHidden);
    console.log('P2 Explode splits:', results.pillar2.explodeSplits.length, results.pillar2.explodeSplits);
    console.log('P3 Female mode -> male leaks:', results.pillar3.femaleModeMaleLeaks.length, results.pillar3.femaleModeMaleLeaks.slice(0, 15));
    console.log('P3 Male mode -> female leaks:', results.pillar3.maleModeFemaleLeaks.length, results.pillar3.maleModeFemaleLeaks.slice(0, 15));
    console.log('P3 Female integumentary head/pubic hair suppressed:', results.pillar3.femaleIntegumentSuppressedCount);
    console.log('P3 Female organs in NIH:', results.pillar3.femaleOrgansFound);
    console.log('P3 Male organs in NIH:', results.pillar3.maleOrgansFound);
    console.log(`P4 Core ${results.pillar4.totalCoreChecked} structures failures:`, results.pillar4.coreFailures.length);
    if (results.pillar4.coreFailures.length > 0) {
      console.log('  Core failures details:', JSON.stringify(results.pillar4.coreFailures, null, 2));
    }
    console.log('P4 Z-Anatomy exhaustive baseline failures:', results.pillar4.realMeshFallbackSamples.length);
    if (results.pillar4.realMeshFallbackSamples.length > 0) {
      console.log('  Sample baseline failures:', JSON.stringify(results.pillar4.realMeshFallbackSamples.slice(0, 15), null, 2));
    }
    console.log('TOTAL AUDIT FAILURES:', totalFailures);
    if (process.argv.includes('--dump-core-table')) {
      console.log('CORE_TABLE_JSON_START');
      console.log(JSON.stringify(results.pillar4.coreVerifiedTable, null, 2));
      console.log('CORE_TABLE_JSON_END');
    }
    if (totalFailures > 0) {
      process.exitCode = 1;
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runAudit().catch((err) => {
  console.error('AUDIT SCRIPT CRASHED:', err);
  process.exit(1);
});
