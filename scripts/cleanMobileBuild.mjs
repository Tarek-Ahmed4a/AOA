/**
 * Cleans stale Android asset caches and strips desktop-only binaries from dist/
 * before `npx cap sync android` packages assets into the APK.
 *
 * Keeps:
 *  - All 6 lossless Draco-compressed Z-Anatomy offline GLBs + manifest
 *  - Offline Draco decoder assets in dist/draco/
 *  - Female Z-Anatomy supplement NIH GLBs (7 organs) + NIH manifest
 *  - Textbook manifest.json (remoteFallbackUrl for online reading)
 *
 * Removes:
 *  - Stale android/app/src/main/assets/public directory
 *  - Desktop-only raw textbook PDFs in dist/books/
 *  - Unused legacy dist/models/female/ bundles
 *  - Standalone male/duplicate NIH GLBs in dist/models/nih/
 *  - Any leftover archives, chunk parts, or temporary files
 *
 * Usage:
 *   node scripts/cleanMobileBuild.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve('dist');
const ANDROID_ASSETS_PUBLIC_DIR = path.resolve(
  'android',
  'app',
  'src',
  'main',
  'assets',
  'public'
);

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

function sumDirectoryBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += sumDirectoryBytes(full);
    } else if (entry.isFile()) {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

if (!fs.existsSync(DIST_DIR)) {
  console.error('[MOBILE CLEAN] dist/ directory not found. Run npm run build first.');
  process.exit(1);
}

// 0. Wipe stale Capacitor Android public assets folder so deleted files never linger in APKs
if (fs.existsSync(ANDROID_ASSETS_PUBLIC_DIR)) {
  const staleBytes = sumDirectoryBytes(ANDROID_ASSETS_PUBLIC_DIR);
  fs.rmSync(ANDROID_ASSETS_PUBLIC_DIR, { recursive: true, force: true });
  console.log(
    `[MOBILE CLEAN] Cleared stale android/app/src/main/assets/public (${(staleBytes / (1024 * 1024)).toFixed(2)} MiB).`
  );
}

// 1. Remove stray chunk parts, archives, or temporary files anywhere in dist/
walkRemove(
  DIST_DIR,
  (_full, name) =>
    /\.part\d+$/.test(name) ||
    name.endsWith('.chunks.json') ||
    /\.(zip|tar|gz|bak|tmp)$/i.test(name)
);

// 2. Strip raw textbook PDF binaries from dist/books/ (manifest.json remoteFallbackUrl handles online access)
walkRemove(path.join(DIST_DIR, 'books'), (_full, name) =>
  name.toLowerCase().endsWith('.pdf')
);

// 3. Remove unused legacy female/*.glb directory if present
const legacyFemaleDir = path.join(DIST_DIR, 'models', 'female');
if (fs.existsSync(legacyFemaleDir)) {
  removedBytes += sumDirectoryBytes(legacyFemaleDir);
  fs.rmSync(legacyFemaleDir, { recursive: true, force: true });
  removedCount += 1;
}

// 4. Strip bulky standalone NIH GLBs except manifest.json and the 7 female Z-Anatomy supplement organs
walkRemove(path.join(DIST_DIR, 'models', 'nih'), (_full, name) => {
  const lower = name.toLowerCase();
  if (!lower.endsWith('.glb')) return false;
  return !KEEP_NIH_FEMALE_FILES.has(lower);
});

const remainingBytes = sumDirectoryBytes(DIST_DIR);
console.log(
  `[MOBILE CLEAN] Stripped ${removedCount} desktop-only items (${(removedBytes / (1024 * 1024)).toFixed(2)} MiB freed). Remaining dist/ payload: ${(remainingBytes / (1024 * 1024)).toFixed(2)} MiB.`
);
