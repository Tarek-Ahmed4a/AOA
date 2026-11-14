import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  joinPrimitives,
  prune,
  simplify,
  weld,
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MODELS_DIR = path.join(ROOT_DIR, 'public', 'models');
const SIZE_THRESHOLD_BYTES = 15 * 1024 * 1024; // 15 MB

async function collectLargeGlbs(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectLargeGlbs(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) {
      const stat = await fs.stat(fullPath);
      const binStat = await fs.stat(`${fullPath}.bin`).catch(() => null);
      const effectiveSize = stat.size + (binStat ? binStat.size : 0);
      if (effectiveSize > SIZE_THRESHOLD_BYTES || binStat !== null) {
        results.push({ path: fullPath, sizeBytes: effectiveSize });
      }
    }
  }
  return results;
}

function formatMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function countGlbStats(doc) {
  const meshes = doc.getRoot().listMeshes();
  let primitives = 0;
  let vertices = 0;
  for (const m of meshes) {
    for (const p of m.listPrimitives()) {
      primitives += 1;
      const pos = p.getAttribute('POSITION');
      if (pos) vertices += pos.getCount();
    }
  }
  return { meshes: meshes.length, primitives, vertices };
}

function joinPrimitivesPerMesh(doc) {
  const matIds = new WeakMap();
  let nextMatId = 1;

  for (const mesh of doc.getRoot().listMeshes()) {
    const prims = mesh.listPrimitives();
    if (prims.length <= 1) continue;

    const groups = new Map();
    for (const p of prims) {
      const mat = p.getMaterial();
      let matId = 0;
      if (mat) {
        matId = matIds.get(mat) ?? 0;
        if (!matId) {
          matId = nextMatId++;
          matIds.set(mat, matId);
        }
      }
      const key = [
        matId,
        mat?.getName() ?? '',
        p.getMode(),
        p.listSemantics().sort().join(','),
        Boolean(p.getIndices()),
      ].join('::');

      let bucket = groups.get(key);
      if (!bucket) {
        bucket = [];
        groups.set(key, bucket);
      }
      bucket.push(p);
    }

    for (const group of groups.values()) {
      if (group.length > 1) {
        const joined = joinPrimitives(group);
        mesh.addPrimitive(joined);
        for (const oldPrim of group) {
          mesh.removePrimitive(oldPrim);
          oldPrim.dispose();
        }
      }
    }
  }
}

async function main() {
  const candidates = await collectLargeGlbs(MODELS_DIR);
  candidates.sort((a, b) => b.sizeBytes - a.sizeBytes);

  if (candidates.length === 0) {
    console.log('No .glb files > 15 MB (or pending .glb.bin) found under public/models/.');
    return;
  }

  console.log(`Found ${candidates.length} .glb models to optimize to single-file binary GLB:`);

  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of candidates) {
    const relPath = path.relative(ROOT_DIR, file.path);
    const beforeBytes = file.sizeBytes;
    totalBefore += beforeBytes;

    console.log(`\nOptimizing ${relPath} (${formatMB(beforeBytes)})...`);
    const document = await io.read(file.path);
    const beforeStats = countGlbStats(document);

    joinPrimitivesPerMesh(document);

    await document.transform(
      dedup(),
      weld(),
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: 0.5,
        error: 0.01,
      }),
      prune({ keepLeaves: true, keepExtras: true })
    );

    const afterStats = countGlbStats(document);
    if (afterStats.meshes !== beforeStats.meshes) {
      throw new Error(
        `Safety abort on ${relPath}: mesh count changed from ${beforeStats.meshes} to ${afterStats.meshes}`
      );
    }

    const glbBytes = await io.writeBinary(document);
    const magic = Buffer.from(
      glbBytes.buffer,
      glbBytes.byteOffset,
      Math.min(4, glbBytes.byteLength)
    ).toString('ascii');
    if (magic !== 'glTF' || glbBytes.byteLength <= 1024) {
      throw new Error(
        `Invalid GLB binary output for ${relPath} (magic=${JSON.stringify(magic)}, bytes=${glbBytes.byteLength})`
      );
    }

    const tmpPath = `${file.path}.tmp`;
    await fs.writeFile(tmpPath, glbBytes);
    await fs.rename(tmpPath, file.path);
    await fs.unlink(`${file.path}.bin`).catch(() => {});

    const afterStat = await fs.stat(file.path);
    const afterBytes = afterStat.size;
    totalAfter += afterBytes;

    const pctDrop = (((beforeBytes - afterBytes) / beforeBytes) * 100).toFixed(1);
    const vertDrop =
      beforeStats.vertices > 0
        ? (
            ((beforeStats.vertices - afterStats.vertices) /
              beforeStats.vertices) *
            100
          ).toFixed(1)
        : '0.0';

    console.log(
      `  Done: ${formatMB(beforeBytes)} -> ${formatMB(afterBytes)} (-${pctDrop}%) | Meshes: ${beforeStats.meshes} -> ${afterStats.meshes} | Prims: ${beforeStats.primitives} -> ${afterStats.primitives} | Vertices: ${beforeStats.vertices} -> ${afterStats.vertices} (-${vertDrop}%)`
    );
  }

  const overallDrop =
    totalBefore > 0
      ? (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)
      : '0.0';
  console.log(
    `\nOptimization complete: ${formatMB(totalBefore)} -> ${formatMB(totalAfter)} (-${overallDrop}% total).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
