#!/usr/bin/env node
/**
 * Automated Sketchfab V3 Medical Anatomy Downloader
 * Queries Sketchfab V3 API (`downloadable=true`, non-stylized medical anatomy & Z-Anatomy),
 * downloads `.glb` binaries into `public/models/zanatomy/`, verifies `glTF` binary headers,
 * and emits `public/models/zanatomy/manifest.json`.
 *
 * Usage:
 *   npm run fetch:sketchfab
 *   node scripts/fetchSketchfabAnatomy.mjs [--force]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'models', 'zanatomy');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');

const DEFAULT_TOKEN = 'fb4732a2d4e2414f92d3138bcd71d9da';
const SKETCHFAB_API_BASE = 'https://api.sketchfab.com/v3';
const EXCLUDE_STYLIZED_REGEX =
  /\b(cartoon|stylized|lowpoly|low-poly|anime|chibi|minecraft|roblox|voxel|monster|zombie|fantasy|toy|cute)\b/i;

const MIN_ARCHIVE_BYTES = 250 * 1024;
const MAX_ARCHIVE_BYTES = 75 * 1024 * 1024;
const FORCE_DOWNLOAD = process.argv.includes('--force');

/**
 * Official standalone anatomical modules stored in `public/models/zanatomy/manifest.json`.
 * Never overlapped across mismatched authors — each entry loads cleanly as a self-contained atlas.
 */
const ATLAS_MODULE_TARGETS = [
  {
    id: 'zanatomy-splanchnology',
    system: 'visceral',
    fileName: 'visceral.glb',
    titleAr: 'أطلس Z-Anatomy الرسمي (الأحشاء والهيكل)',
    isUnifiedFullBody: true,
    searchQueries: [
      'user:Z-Anatomy Splanchnology',
      'user:Z-Anatomy Arthrology',
    ],
    minFaceCount: 15000,
    preferredUids: [
      '5cfafb312f504815aa3fec55735607a6', // Z-Anatomy Official Splanchnology (2.01M faces, 47.6MB)
    ],
    alignment: {
      isFullBody: true,
      targetHeight: 1.76,
      targetCenter: [0, 0.9, 0],
    },
  },
  {
    id: 'master-ecorche',
    system: 'muscular',
    fileName: 'master_ecorche.glb',
    titleAr: 'مجسم التشريح العضلي الكامل (Full Écorché)',
    isUnifiedFullBody: true,
    searchQueries: [
      'ecorche anatomy full body',
      'user:Z-Anatomy Muscular insertions',
    ],
    minFaceCount: 20000,
    preferredUids: [
      'ab11ebff89224f03bd75efede1164cf6', // Male Full Body Ecorche (640k faces, 28.6MB)
      'e402d3d541eb4b199c57d5410f5d3c57', // Ecorche - Anatomy study (418k faces, 15.6MB)
    ],
    alignment: {
      isFullBody: true,
      targetHeight: 1.76,
      targetCenter: [0, 0.9, 0],
    },
  },
  {
    id: 'complete-skeleton',
    system: 'skeletal',
    fileName: 'skeletal.glb',
    titleAr: 'الهيكل العظمي الكامل (183 عظمة مسماة)',
    isUnifiedFullBody: true,
    searchQueries: [
      'human skeleton anatomy medical',
      'user:Z-Anatomy Arthrology',
    ],
    minFaceCount: 15000,
    preferredUids: [
      '911b9df7e7834175b69b4840ea15e054', // Human Skeleton (568k faces, 16.1MB)
      'be643fd4575f4637a6cc5237b460cea1', // Male Human Skeleton - Full Body
    ],
    alignment: {
      isFullBody: true,
      targetHeight: 1.76,
      targetCenter: [0, 0.9, 0],
      rotationEuler: [Math.PI / 2, 0, Math.PI],
    },
  },
  {
    id: 'muscular-system',
    system: 'muscular',
    fileName: 'muscular.glb',
    titleAr: 'الجهاز العضلي البشري',
    isUnifiedFullBody: true,
    searchQueries: [
      'human muscular system anatomy ecorche',
      'male body muscular system anatomy',
    ],
    minFaceCount: 15000,
    preferredUids: [
      '991eb96938be4d0d8fadee241a1063d3', // Male Body Muscular System - Anatomy Study (210k faces)
    ],
    alignment: {
      isFullBody: true,
      targetHeight: 1.76,
      targetCenter: [0, 0.9, 0],
    },
  },
  {
    id: 'nervous-system',
    system: 'nervous',
    fileName: 'nervous.glb',
    titleAr: 'الجهاز العصبي الكامل والمخ',
    isUnifiedFullBody: true,
    searchQueries: [
      'human nervous system brain anatomy',
      'systeme nerveux humain brain anatomy',
    ],
    minFaceCount: 10000,
    preferredUids: [
      '04e4630154774717b2a9787bb37b92a0', // Système nerveux Humain entier (53k faces)
      '5d10d80150d34fe7b160302d0003092c', // Human Nervous System - Full Body
    ],
    alignment: {
      isFullBody: true,
      targetHeight: 1.68,
      targetCenter: [0, 0.94, 0],
    },
  },
  {
    id: 'cardiovascular-heart',
    system: 'cardiovascular',
    fileName: 'cardiovascular.glb',
    titleAr: 'القلب والأوعية الدموية (تشريح عالي الدقة)',
    isUnifiedFullBody: false,
    searchQueries: [
      'human heart vascular anatomy',
      'human heart 3d model visible heart',
    ],
    minFaceCount: 10000,
    preferredUids: [
      '8199e0e5b5c74104b69324d846f10278', // Human Heart Donation #277 - VisibleHeartLabs (300k faces)
    ],
    alignment: {
      isFullBody: false,
      targetHeight: 0.78,
      targetCenter: [0, 1.0, 0],
    },
  },
  {
    id: 'integumentary-skin',
    system: 'integumentary',
    fileName: 'integumentary.glb',
    titleAr: 'التشريح السطحي والغطاء الجلدي',
    isUnifiedFullBody: true,
    searchQueries: [
      'male body base mesh highpoly anatomy',
      'human body base mesh anatomy',
    ],
    minFaceCount: 15000,
    preferredUids: [
      '9311f4f8fa1a4fe4bb0027ff7e8fd795', // Male body base mesh (highpoly) (475k faces)
    ],
    alignment: {
      isFullBody: true,
      targetHeight: 1.78,
      targetCenter: [0, 0.9, 0],
      rotationEuler: [0, Math.PI, 0],
    },
  },
];

async function resolveApiToken() {
  const envToken =
    process.env.SKETCHFAB_API_TOKEN || process.env.VITE_SKETCHFAB_API_TOKEN;
  if (envToken && envToken.trim()) {
    return envToken.trim();
  }
  try {
    const raw = await fs.readFile(ENV_PATH, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = /^(?:VITE_)?SKETCHFAB_API_TOKEN\s*=\s*(.+)$/.exec(line.trim());
      if (m?.[1]) {
        return m[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  } catch {
    // .env not readable
  }
  return DEFAULT_TOKEN;
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${url}: ${text.slice(0, 160)}`);
  }
  return res.json();
}

function isAuthenticMedicalCandidate(model, minFaceCount) {
  if (!model || !model.uid || !model.isDownloadable) return false;
  const title = model.name || '';
  const tagText = Array.isArray(model.tags)
    ? model.tags.map((t) => t.name || t.slug || '').join(' ')
    : '';
  if (
    EXCLUDE_STYLIZED_REGEX.test(title) ||
    EXCLUDE_STYLIZED_REGEX.test(tagText)
  ) {
    return false;
  }
  const faces = Number(model.faceCount || 0);
  if (faces > 0 && faces < minFaceCount) {
    return false;
  }
  const glbSize = Number(model.archives?.glb?.size || 0);
  if (glbSize > 0 && (glbSize < MIN_ARCHIVE_BYTES || glbSize > MAX_ARCHIVE_BYTES)) {
    return false;
  }
  return true;
}

async function verifyExistingGlb(filePath) {
  try {
    const handle = await fs.open(filePath, 'r');
    try {
      const stat = await handle.stat();
      if (stat.size < 1024) return null;
      const header = Buffer.alloc(4);
      await handle.read(header, 0, 4, 0);
      if (header[0] === 0x67 && header[1] === 0x6c && header[2] === 0x54 && header[3] === 0x46) {
        return stat.size;
      }
      return null;
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}

async function downloadAndVerifyGlb(downloadUrl, destPath) {
  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`Binary download failed (${res.status}) from S3 URL`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 1024) {
    throw new Error(`Downloaded binary too small (${buffer.length} bytes)`);
  }
  const isGltfMagic =
    buffer[0] === 0x67 &&
    buffer[1] === 0x6c &&
    buffer[2] === 0x54 &&
    buffer[3] === 0x46;

  if (!isGltfMagic) {
    throw new Error(
      `Invalid GLB magic header: 0x${buffer.subarray(0, 4).toString('hex')}`
    );
  }

  const tempPath = `${destPath}.tmp`;
  await fs.writeFile(tempPath, buffer);
  await fs.rename(tempPath, destPath);
  return buffer.length;
}

async function discoverCandidatesForTarget(target, authHeaders) {
  const discovered = new Map();

  // 1. Inspect preferred curated Sketchfab UIDs via live API metadata endpoint
  for (const uid of target.preferredUids) {
    try {
      const meta = await fetchJson(
        `${SKETCHFAB_API_BASE}/models/${uid}`,
        authHeaders
      );
      if (isAuthenticMedicalCandidate(meta, 5000)) {
        discovered.set(meta.uid, meta);
      }
    } catch (err) {
      console.warn(`  [warn] Metadata lookup failed for UID ${uid}: ${err.message}`);
    }
  }

  // 2. Run live Sketchfab V3 search queries as backup & discovery
  for (const query of target.searchQueries) {
    try {
      const isUserScoped = query.startsWith('user:');
      const searchUrl = isUserScoped
        ? `${SKETCHFAB_API_BASE}/search?type=models&downloadable=true&user=Z-Anatomy&q=${encodeURIComponent(
            query.replace(/^user:Z-Anatomy\s*/i, '')
          )}&count=8`
        : `${SKETCHFAB_API_BASE}/search?type=models&downloadable=true&q=${encodeURIComponent(
            query
          )}&min_face_count=${target.minFaceCount}&sort_by=-likeCount&count=10`;

      const res = await fetchJson(searchUrl, authHeaders);
      for (const item of res.results || []) {
        if (!discovered.has(item.uid) && isAuthenticMedicalCandidate(item, target.minFaceCount)) {
          discovered.set(item.uid, item);
        }
      }
    } catch (err) {
      console.warn(`  [warn] Search "${query}" failed: ${err.message}`);
    }
  }

  // Also include curated Z-Anatomy models explicitly as top choice where specified
  const ordered = [];
  for (const uid of target.preferredUids) {
    if (discovered.has(uid)) {
      ordered.push(discovered.get(uid));
      discovered.delete(uid);
    }
  }
  for (const rest of discovered.values()) {
    ordered.push(rest);
  }
  return ordered;
}

async function main() {
  const token = await resolveApiToken();
  const authHeaders = { Authorization: `Token ${token}` };

  console.log('=== Sketchfab V3 Medical Anatomy Downloader ===');
  const me = await fetchJson(`${SKETCHFAB_API_BASE}/me`, authHeaders);
  console.log(`Authenticated as Sketchfab user: ${me.username} (${me.uid})`);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const manifestModels = [];

  // Pre-query Z-Anatomy Official account and top Ecorche full-body atlases for live verification
  try {
    const [zAnatRes, ecorcheRes] = await Promise.all([
      fetchJson(
        `${SKETCHFAB_API_BASE}/search?type=models&user=Z-Anatomy&downloadable=true&count=24`,
        authHeaders
      ),
      fetchJson(
        `${SKETCHFAB_API_BASE}/search?type=models&q=ecorche+anatomy+full+body&categories=science-technology&downloadable=true&sort_by=-likeCount`,
        authHeaders
      ),
    ]);
    console.log(
      `Catalog check: ${zAnatRes.results?.length ?? 0} Z-Anatomy official bundles, ${
        ecorcheRes.results?.length ?? 0
      } Ecorche atlases indexed.`
    );
  } catch (err) {
    console.warn(`  [warn] Pre-query index check skipped: ${err.message}`);
  }

  for (const target of ATLAS_MODULE_TARGETS) {
    console.log(`\n[${target.id.toUpperCase()}] Preparing standalone atlas module...`);
    const destPath = path.join(OUTPUT_DIR, target.fileName);
    const localPath = `/models/zanatomy/${target.fileName}`;

    const candidates = await discoverCandidatesForTarget(target, authHeaders);
    if (candidates.length === 0) {
      throw new Error(`No downloadable medical GLB found for atlas module: ${target.id}`);
    }

    let selectedMeta = null;
    let downloadedBytes = 0;

    if (!FORCE_DOWNLOAD) {
      const existingSize = await verifyExistingGlb(destPath);
      if (existingSize && candidates[0]) {
        selectedMeta = candidates[0];
        downloadedBytes = existingSize;
        console.log(
          `  ✓ Reusing verified GLB ${target.fileName} (${(existingSize / 1024 / 1024).toFixed(2)} MB)`
        );
      }
    }

    if (!selectedMeta) {
      for (const candidate of candidates) {
        try {
          console.log(
            `  → Requesting download link for "${candidate.name}" (${candidate.uid}, ${candidate.faceCount} faces)...`
          );
          const dlMeta = await fetchJson(
            `${SKETCHFAB_API_BASE}/models/${candidate.uid}/download`,
            authHeaders
          );
          const glbUrl = dlMeta?.glb?.url;
          if (!glbUrl) {
            console.warn(`  [skip] ${candidate.uid} returned no glb.url`);
            continue;
          }
          downloadedBytes = await downloadAndVerifyGlb(glbUrl, destPath);
          selectedMeta = candidate;
          console.log(
            `  ✓ Downloaded & verified glTF header: ${target.fileName} (${(
              downloadedBytes /
              1024 /
              1024
            ).toFixed(2)} MB)`
          );
          break;
        } catch (err) {
          console.warn(`  [retry] Candidate ${candidate.uid} failed: ${err.message}`);
        }
      }
    }

    if (!selectedMeta) {
      throw new Error(`All download attempts failed for module "${target.id}"`);
    }

    manifestModels.push({
      id: target.id,
      system: target.system,
      file: target.fileName,
      fileName: target.fileName,
      localPath,
      uid: selectedMeta.uid,
      title: selectedMeta.name,
      titleAr: target.titleAr,
      author: selectedMeta.user?.displayName || selectedMeta.user?.username || 'Sketchfab Author',
      authorUsername: selectedMeta.user?.username || 'unknown',
      faceCount: selectedMeta.faceCount || 0,
      vertexCount: selectedMeta.vertexCount || 0,
      sizeBytes: downloadedBytes,
      isUnifiedFullBody: target.isUnifiedFullBody,
      license: selectedMeta.license?.label || 'Creative Commons / Sketchfab',
      viewerUrl: selectedMeta.viewerUrl || `https://sketchfab.com/3d-models/${selectedMeta.uid}`,
      alignment: target.alignment,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'sketchfab-v3-api',
    authenticatedUser: me.username,
    totalModels: manifestModels.length,
    models: manifestModels,
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n=== Done! Wrote ${MANIFEST_PATH} (${manifestModels.length} verified GLB systems) ===`);
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
