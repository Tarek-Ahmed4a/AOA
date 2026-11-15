/**
 * Strips heavy redundant assets from dist/ before Capacitor syncs android assets
 * so the installable Android APK stays lean while retaining full offline Z-Anatomy
 * 3D systems and seamless GitHub Release / CDN streaming fallbacks for textbooks & NIH models.
 *
 * Usage:
 *   node scripts/buildAndroidAssets.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve('dist');
const KEEP_NIH_FEMALE_FILES = new Set([
  'uterus-female.glb',
  'ovary-female-left.glb',
  'ovary-female-right.glb',
  'fallopian-tube-female-left.glb',
  'fallopian-tube-female-right.glb',
  'mammary-gland-female-left.glb',
  'mammary-gland-female-right.glb',
]);

let removedCount = 0;
let removedBytes = 0;

function removeFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;
    fs.unlinkSync(filePath);
    removedCount += 1;
    removedBytes += stat.size;
  } catch {
    // Ignore missing files
  }
}

function walkRemove(dir, predicate) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkRemove(full, predicate);
    } else if (entry.isFile() && predicate(full, entry.name)) {
      removeFile(full);
    }
  }
}

if (!fs.existsSync(DIST_DIR)) {
  console.error('dist/ directory not found. Run npm run build first.');
  process.exit(1);
}

// 1. Remove any stray chunk files or manifests anywhere in dist/
walkRemove(
  DIST_DIR,
  (_full, name) => /\.part\d+$/.test(name) || name.endsWith('.chunks.json')
);

// 2. Strip raw multi-hundred-MB PDF binaries from dist/books/ (manifest.json remoteFallbackUrl handles online access)
walkRemove(path.join(DIST_DIR, 'books'), (_full, name) =>
  name.toLowerCase().endsWith('.pdf')
);

// 3. Remove unused duplicate Sketchfab female/*.glb files
fs.rmSync(path.join(DIST_DIR, 'models', 'female'), {
  recursive: true,
  force: true,
});

// 4. Strip bulky standalone NIH GLBs except manifest.json and the 7 female Z-Anatomy supplement organs
walkRemove(path.join(DIST_DIR, 'models', 'nih'), (_full, name) => {
  const lower = name.toLowerCase();
  if (!lower.endsWith('.glb')) return false;
  return !KEEP_NIH_FEMALE_FILES.has(lower);
});

const savedMiB = (removedBytes / (1024 * 1024)).toFixed(2);
console.log(
  `[ANDROID ASSETS] Stripped ${removedCount} bulky desktop-only assets from dist/ (${savedMiB} MiB saved).`
);
