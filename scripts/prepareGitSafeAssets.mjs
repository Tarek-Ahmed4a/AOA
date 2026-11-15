import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['public/books', 'public/models', 'mobile-assets/books'];
const CHUNKS_ROOT = path.join(ROOT, 'large-asset-chunks');
const MAX_GIT_FILE_BYTES = 95 * 1000 * 1000; // 95 MB strict cap under GitHub's 100 MB rejection limit
const CHUNK_SIZE_BYTES = 85 * 1000 * 1000;   // 85 MB (~81.06 MiB), safely under 90 MB
const IGNORE_START = '# >>> AUTO-MANAGED LARGE ASSETS (>95 MB) SPLIT INTO GIT-SAFE CHUNKS >>>';
const IGNORE_END = '# <<< AUTO-MANAGED LARGE ASSETS <<<';

function walkRegularAndLinkedFiles(dirPath, collected = []) {
  if (!fs.existsSync(dirPath)) return collected;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkRegularAndLinkedFiles(fullPath, collected);
    } else {
      // Skip our generated chunk files and chunk metadata
      if (/\.part\d+$/.test(entry.name) || entry.name.endsWith('.chunks.json')) {
        continue;
      }
      collected.push(fullPath);
    }
  }
  return collected;
}

function formatMB(bytes) {
  return `${(bytes / (1000 * 1000)).toFixed(2)} MB (${(bytes / (1024 * 1024)).toFixed(2)} MiB)`;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.allocUnsafe(4 * 1024 * 1024);
    let bytesRead;
    while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(bytesRead === buf.length ? buf : buf.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function existingChunksMatch(manifestPath, sizeBytes, sha256) {
  if (!fs.existsSync(manifestPath)) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.sizeBytes !== sizeBytes || manifest.sha256 !== sha256) {
      return false;
    }
    if (!Array.isArray(manifest.parts) || manifest.parts.length === 0) return false;
    const baseDir = path.dirname(manifestPath);
    let totalPartBytes = 0;
    for (const part of manifest.parts) {
      const partPath = path.join(baseDir, part.filename);
      if (!fs.existsSync(partPath)) return false;
      const pStat = fs.statSync(partPath);
      if (pStat.size !== part.sizeBytes || pStat.size > 90 * 1000 * 1000) {
        return false;
      }
      totalPartBytes += pStat.size;
    }
    return totalPartBytes === sizeBytes;
  } catch {
    return false;
  }
}

function removeLegacyPublicChunks() {
  for (const dir of SCAN_DIRS) {
    const absDir = path.join(ROOT, dir);
    if (!fs.existsSync(absDir)) continue;
    const walkClean = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walkClean(full);
        } else if (/\.part\d+$/.test(entry.name) || entry.name.endsWith('.chunks.json')) {
          fs.unlinkSync(full);
        }
      }
    };
    walkClean(absDir);
  }
}

function splitFileIntoChunks(filePath, statSize) {
  const baseName = path.basename(filePath);
  const relFromPublic = path.relative(path.join(ROOT, 'public'), filePath);
  const chunkDir = path.join(CHUNKS_ROOT, path.dirname(relFromPublic));
  fs.mkdirSync(chunkDir, { recursive: true });
  const manifestPath = path.join(chunkDir, `${baseName}.chunks.json`);
  const fileHash = sha256File(filePath);

  if (existingChunksMatch(manifestPath, statSize, fileHash)) {
    const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(
      `[OK] ${path.relative(ROOT, filePath).replace(/\\/g, '/')} already split cleanly into ${existing.parts.length} chunks.`
    );
    return existing.parts.length;
  }

  // Clean up any stale part files before creating fresh parts
  for (const name of fs.readdirSync(chunkDir)) {
    if (name.startsWith(`${baseName}.part`)) {
      fs.unlinkSync(path.join(chunkDir, name));
    }
  }

  const parts = [];
  const ioBuf = Buffer.allocUnsafe(4 * 1024 * 1024);
  const readFd = fs.openSync(filePath, 'r');
  let partIdx = 0;
  let offset = 0;

  try {
    while (offset < statSize) {
      const targetChunkBytes = Math.min(CHUNK_SIZE_BYTES, statSize - offset);
      const partFilename = `${baseName}.part${partIdx}`;
      const partPath = path.join(chunkDir, partFilename);
      const partHash = crypto.createHash('sha256');
      const writeFd = fs.openSync(partPath, 'w');
      let writtenForPart = 0;

      try {
        while (writtenForPart < targetChunkBytes) {
          const toRead = Math.min(ioBuf.length, targetChunkBytes - writtenForPart);
          const n = fs.readSync(readFd, ioBuf, 0, toRead, offset);
          if (n <= 0) break;
          const slice = n === ioBuf.length ? ioBuf : ioBuf.subarray(0, n);
          fs.writeSync(writeFd, slice);
          partHash.update(slice);
          writtenForPart += n;
          offset += n;
        }
      } finally {
        fs.closeSync(writeFd);
      }

      parts.push({
        index: partIdx,
        filename: partFilename,
        sizeBytes: writtenForPart,
        sha256: partHash.digest('hex'),
      });
      partIdx += 1;
    }
  } finally {
    fs.closeSync(readFd);
  }

  const manifest = {
    version: 1,
    originalFilename: baseName,
    originalRelativePath: path.relative(ROOT, filePath).replace(/\\/g, '/'),
    sizeBytes: statSize,
    sha256: fileHash,
    chunkSizeBytes: CHUNK_SIZE_BYTES,
    parts,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(
    `[SPLIT] ${manifest.originalRelativePath} (${formatMB(statSize)}) -> ${parts.length} chunks (< 90 MB each)`
  );
  return parts.length;
}

function updateGitignore(largeRelPaths) {
  const gitignorePath = path.join(ROOT, '.gitignore');
  let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';

  // Remove old auto-managed block if present
  const blockRe = new RegExp(
    `\\r?\\n?${IGNORE_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${IGNORE_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?\\n?`,
    'g'
  );
  content = content.replace(blockRe, '\n').trimEnd();

  const entries = [...new Set(largeRelPaths)].sort().map((p) => `/${p}`);
  if (entries.length > 0) {
    const block = [IGNORE_START, ...entries, IGNORE_END].join('\n');
    content = `${content}\n\n${block}\n`;
  } else {
    content = `${content}\n`;
  }

  fs.writeFileSync(gitignorePath, content, 'utf8');
}

function untrackLargeFilesIfInGitIndex(largeRelPaths) {
  if (!fs.existsSync(path.join(ROOT, '.git')) || largeRelPaths.length === 0) return;
  try {
    execFileSync('git', ['rm', '--cached', '--ignore-unmatch', ...largeRelPaths], {
      cwd: ROOT,
      stdio: 'pipe',
    });
  } catch {
    // Ignore when files were never staged
  }
}

function main() {
  console.log('=== Preparing Git-Safe Assets (< 95 MB limit, stored outside public/) ===');
  removeLegacyPublicChunks();
  const candidates = SCAN_DIRS.flatMap((dir) => walkRegularAndLinkedFiles(path.join(ROOT, dir)));
  const largeRelPaths = [];

  for (const filePath of candidates) {
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    if (stat.size > MAX_GIT_FILE_BYTES) {
      const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
      largeRelPaths.push(relPath);
      splitFileIntoChunks(filePath, stat.size);
    }
  }

  updateGitignore(largeRelPaths);
  untrackLargeFilesIfInGitIndex(largeRelPaths);

  console.log(`\nGit-ignored unsplit large assets (${largeRelPaths.length}):`);
  for (const p of largeRelPaths) {
    console.log(`  - /${p}`);
  }
  console.log('=== Done ===');
}

main();
