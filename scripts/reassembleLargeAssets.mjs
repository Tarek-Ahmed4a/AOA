import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['public/books', 'public/models'];

function findChunkManifests(dirPath, found = []) {
  if (!fs.existsSync(dirPath)) return found;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      findChunkManifests(fullPath, found);
    } else if (entry.isFile() && entry.name.endsWith('.chunks.json')) {
      found.push(fullPath);
    }
  }
  return found;
}

function isTargetReady(targetPath, expectedSize) {
  if (!fs.existsSync(targetPath)) return false;
  try {
    const lstat = fs.lstatSync(targetPath);
    if (lstat.isSymbolicLink() || !lstat.isFile()) {
      return false;
    }
    return lstat.size === expectedSize;
  } catch {
    return false;
  }
}

function reassembleManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const baseDir = path.dirname(manifestPath);
  const targetPath = path.join(baseDir, manifest.originalFilename);
  const relTarget = path.relative(ROOT, targetPath).replace(/\\/g, '/');

  if (isTargetReady(targetPath, manifest.sizeBytes)) {
    console.log(`[READY] ${relTarget} (${(manifest.sizeBytes / (1024 * 1024)).toFixed(2)} MiB)`);
    return;
  }

  const orderedParts = [...manifest.parts].sort((a, b) => a.index - b.index);
  for (const part of orderedParts) {
    const partPath = path.join(baseDir, part.filename);
    if (!fs.existsSync(partPath)) {
      throw new Error(`Missing chunk part ${partPath} required to reassemble ${relTarget}`);
    }
  }

  const tmpPath = `${targetPath}.reassemble.tmp`;
  const ioBuf = Buffer.allocUnsafe(4 * 1024 * 1024);
  const totalHash = crypto.createHash('sha256');
  let totalWritten = 0;

  const outFd = fs.openSync(tmpPath, 'w');
  try {
    for (const part of orderedParts) {
      const partPath = path.join(baseDir, part.filename);
      const inFd = fs.openSync(partPath, 'r');
      try {
        let bytesRead;
        while ((bytesRead = fs.readSync(inFd, ioBuf, 0, ioBuf.length, null)) > 0) {
          const slice = bytesRead === ioBuf.length ? ioBuf : ioBuf.subarray(0, bytesRead);
          fs.writeSync(outFd, slice);
          totalHash.update(slice);
          totalWritten += bytesRead;
        }
      } finally {
        fs.closeSync(inFd);
      }
    }
  } finally {
    fs.closeSync(outFd);
  }

  const actualSha = totalHash.digest('hex');
  if (totalWritten !== manifest.sizeBytes || actualSha !== manifest.sha256) {
    fs.unlinkSync(tmpPath);
    throw new Error(
      `Integrity mismatch reassembling ${relTarget}: expected ${manifest.sizeBytes}B/${manifest.sha256}, got ${totalWritten}B/${actualSha}`
    );
  }

  // Replace symlinks or incomplete target atomically
  try {
    const existingStat = fs.lstatSync(targetPath);
    if (existingStat) {
      fs.unlinkSync(targetPath);
    }
  } catch {
    // Target did not exist yet
  }
  fs.renameSync(tmpPath, targetPath);

  console.log(
    `[ASSEMBLED] ${relTarget} (${(totalWritten / (1024 * 1024)).toFixed(2)} MiB, sha256 verified)`
  );
}

function main() {
  const manifests = SCAN_DIRS.flatMap((dir) => findChunkManifests(path.join(ROOT, dir)));
  if (manifests.length === 0) {
    console.log('[OK] No split large asset manifests found.');
    return;
  }

  console.log(`=== Reassembling ${manifests.length} Large Asset(s) ===`);
  for (const manifestPath of manifests) {
    reassembleManifest(manifestPath);
  }
}

main();
