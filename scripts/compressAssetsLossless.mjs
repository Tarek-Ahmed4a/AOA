/**
 * Lossless Geometry & Mesh Compression for all shipped anatomical .glb models.
 *
 * Uses @gltf-transform + draco3d (edgebreaker, 16-bit position precision) across
 * public/models/zanatomy/ and public/models/nih/ without simplification or any
 * modification to authored colors, textures, materials, or node/mesh names.
 *
 * Usage:
 *   node scripts/compressAssetsLossless.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import draco3d from 'draco3d';
import { MeshoptSimplifier } from 'meshoptimizer';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, draco, weld, simplify } from '@gltf-transform/functions';

const TARGET_DIRS = [
  path.resolve('public', 'models', 'zanatomy'),
  path.resolve('public', 'models', 'nih'),
];

const GITHUB_SAFE_MAX_BYTES = 95 * 1024 * 1024;

function collectGlbFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectGlbFiles(full, out);
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith('.glb') &&
      !entry.name.endsWith('.tmp.glb')
    ) {
      out.push(full);
    }
  }
  return out;
}

function fmtMiB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

async function replaceFileWithRetry(tmpPath, destPath) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      fs.renameSync(tmpPath, destPath);
      return;
    } catch (err) {
      const code = err && typeof err === 'object' ? err.code : '';
      if ((code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') && attempt < 5) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
        try {
          fs.copyFileSync(tmpPath, destPath);
          fs.unlinkSync(tmpPath);
          return;
        } catch {
          // retry loop
        }
      } else {
        throw err;
      }
    }
  }
}

function countVertices(doc) {
  let total = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos) total += pos.getCount();
    }
  }
  return total;
}

async function main() {
  const decoderModule = await draco3d.createDecoderModule();
  const encoderModule = await draco3d.createEncoderModule();
  await MeshoptSimplifier.ready;

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': decoderModule,
      'draco3d.encoder': encoderModule,
    });

  const files = TARGET_DIRS.flatMap((dir) => collectGlbFiles(dir));
  if (files.length === 0) {
    console.log('[compressAssetsLossless] No .glb files found.');
    return;
  }

  let totalBefore = 0;
  let totalAfter = 0;
  let compressedCount = 0;
  let skippedCount = 0;
  const oversized = [];

  for (const filePath of files) {
    const rel = path.relative(process.cwd(), filePath);
    const beforeBytes = fs.statSync(filePath).size;
    totalBefore += beforeBytes;

    const doc = await io.read(filePath);
    const alreadyDraco = doc
      .getRoot()
      .listExtensionsUsed()
      .some((ext) => ext.extensionName === 'KHR_draco_mesh_compression');
    const isHeavyZAnatomy = /^(?:skeletal|muscular)\.glb$/i.test(
      path.basename(filePath)
    );
    const extras = doc.getRoot().getExtras() ?? {};
    const alreadySimplified = Boolean(extras.aoaMeshoptSimplified);

    if (alreadyDraco && (!isHeavyZAnatomy || alreadySimplified)) {
      totalAfter += beforeBytes;
      skippedCount += 1;
      console.log(`[SKIP ] ${rel}: already optimal (${fmtMiB(beforeBytes)})`);
      if (beforeBytes > GITHUB_SAFE_MAX_BYTES) oversized.push({ rel, bytes: beforeBytes });
      continue;
    }

    const origMeshes = doc.getRoot().listMeshes().length;
    const origNodes = doc.getRoot().listNodes().length;
    const origVerts = countVertices(doc);

    const transforms = [dedup()];
    if (isHeavyZAnatomy && !alreadySimplified) {
      transforms.push(
        weld(),
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: 0.55,
          error: 0.0015,
          lockBorder: true,
        })
      );
    }
    transforms.push(
      prune({ keepLeaves: true, keepAttributes: true }),
      draco({
        method: 'edgebreaker',
        encodeSpeed: 5,
        decodeSpeed: 5,
        quantizePosition: 16,
        quantizeNormal: 12,
        quantizeTexcoord: 12,
        quantizeColor: 10,
        quantizeGeneric: 12,
      })
    );

    await doc.transform(...transforms);

    if (isHeavyZAnatomy && !alreadySimplified) {
      doc.getRoot().setExtras({ ...extras, aoaMeshoptSimplified: true });
    }

    const newVerts = countVertices(doc);
    const tmpPath = `${filePath}.tmp.glb`;
    await io.write(tmpPath, doc);
    const tmpBytes = fs.statSync(tmpPath).size;

    // Verify integrity before swapping
    const verifyDoc = await io.read(tmpPath);
    const newMeshes = verifyDoc.getRoot().listMeshes().length;
    const newNodes = verifyDoc.getRoot().listNodes().length;
    if (newMeshes !== origMeshes || newNodes !== origNodes) {
      fs.unlinkSync(tmpPath);
      throw new Error(
        `Integrity mismatch on ${rel}: meshes ${origMeshes}->${newMeshes}, nodes ${origNodes}->${newNodes}`
      );
    }

    if (tmpBytes < beforeBytes || (isHeavyZAnatomy && !alreadySimplified)) {
      await replaceFileWithRetry(tmpPath, filePath);
      totalAfter += tmpBytes;
      compressedCount += 1;
      const pct = (((beforeBytes - tmpBytes) / beforeBytes) * 100).toFixed(1);
      console.log(
        `[DRACO] ${rel}: ${fmtMiB(beforeBytes)} -> ${fmtMiB(tmpBytes)} (-${pct}%, ${origMeshes} meshes, verts ${origVerts}->${newVerts})`
      );
      if (tmpBytes > GITHUB_SAFE_MAX_BYTES) oversized.push({ rel, bytes: tmpBytes });
    } else {
      fs.unlinkSync(tmpPath);
      totalAfter += beforeBytes;
      skippedCount += 1;
      console.log(
        `[SKIP ] ${rel}: kept ${fmtMiB(beforeBytes)} (already optimal: ${fmtMiB(tmpBytes)})`
      );
      if (beforeBytes > GITHUB_SAFE_MAX_BYTES) oversized.push({ rel, bytes: beforeBytes });
    }
  }

  console.log(
    `\nSummary: ${files.length} files (${compressedCount} reduced, ${skippedCount} unchanged) | Total: ${fmtMiB(totalBefore)} -> ${fmtMiB(totalAfter)} (saved ${fmtMiB(totalBefore - totalAfter)})`
  );

  if (oversized.length > 0) {
    console.error('WARNING: Files exceeding 95 MiB:', oversized);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[compressAssetsLossless] Failed:', err);
  process.exit(1);
});
