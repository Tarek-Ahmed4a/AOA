#!/usr/bin/env node
/**
 * Automated Sketchfab V3 Female Anatomy Downloader & Cache-Buster
 * Queries Sketchfab V3 API (`downloadable=true`, female anatomy / ecorche / pelvis),
 * downloads verified `.glb` binaries into `public/models/female/`, verifies `glTF` binary headers,
 * writes `public/models/female/manifest.json`, and updates `public/models/zanatomy/manifest.json`
 * with `?v=zanatomy-v4` cache-busting query strings.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const FEMALE_OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'models', 'female');
const FEMALE_MANIFEST_PATH = path.join(FEMALE_OUTPUT_DIR, 'manifest.json');
const ZANATOMY_MANIFEST_PATH = path.join(ROOT_DIR, 'public', 'models', 'zanatomy', 'manifest.json');

const DEFAULT_TOKEN = 'fb4732a2d4e2414f92d3138bcd71d9da';
const SKETCHFAB_API_BASE = 'https://api.sketchfab.com/v3';
const CACHE_VERSION_TAG = 'zanatomy-v4';
const EXCLUDE_STYLIZED_REGEX =
  /\b(cartoon|stylized|lowpoly|low-poly|anime|chibi|minecraft|roblox|voxel|monster|zombie|fantasy|toy|cute)\b/i;

const FEMALE_TARGETS = [
  {
    id: 'female-muscular-ecorche',
    system: 'muscular',
    fileName: 'female_muscular.glb',
    titleAr: 'التشريح العضلي الأنثوي الكامل',
    preferredUids: [
      '132188d5be9b47eabb0e64b378d81603', // Female Anatomy by CheRa_Muscles (863k faces)
      'd415a87cbd2142e78cc4fc5ad592fd39', // Female Body - Skeleton, Muscles & Base Mesh (475k faces)
    ],
    searchQueries: ['female anatomy muscles', 'female anatomy ecorche'],
    minFaceCount: 15000,
    alignment: {
      isFullBody: true,
      targetHeight: 1.76,
      targetCenter: [0, 0.9, 0],
    },
  },
  {
    id: 'female-skeletal-bones',
    system: 'skeletal',
    fileName: 'female_skeletal.glb',
    titleAr: 'الهيكل العظمي الأنثوي',
    preferredUids: [
      'dd376be43a714174b9943294f31c356d', // Female Anatomy by CheRa_Bones (509k faces)
      'e82cc1017e3242fda6f1a43596f3747b', // Female Human Skeleton Full Body Anatomy (227k faces)
    ],
    searchQueries: ['female anatomy bones', 'female human skeleton anatomy'],
    minFaceCount: 15000,
    alignment: {
      isFullBody: true,
      targetHeight: 1.76,
      targetCenter: [0, 0.9, 0],
    },
  },
  {
    id: 'female-visceral-reproductive',
    system: 'visceral',
    fileName: 'female_pelvis_viscera.glb',
    titleAr: 'الحوض والأحشاء التناسلية الأنثوية',
    preferredUids: [
      '0ba41334eb384f5b999d7469f906d3ae', // Female Reproductive and Urinary Systems (525k faces)
      '89fbe9c118404161acb3e9c1b427a2c8', // Female Reproductive System (466k faces)
    ],
    searchQueries: ['female reproductive urinary anatomy', 'female pelvis anatomy'],
    minFaceCount: 10000,
    alignment: {
      isFullBody: false,
      targetHeight: 0.42,
      targetCenter: [0, 0.88, 0],
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
  if (glbSize > 85 * 1024 * 1024) {
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
      if (
        header[0] === 0x67 &&
        header[1] === 0x6c &&
        header[2] === 0x54 &&
        header[3] === 0x46
      ) {
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

async function discoverCandidates(target, authHeaders) {
  const discovered = new Map();

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

  for (const query of target.searchQueries) {
    try {
      const searchUrl = `${SKETCHFAB_API_BASE}/search?type=models&downloadable=true&q=${encodeURIComponent(
        query
      )}&min_face_count=${target.minFaceCount}&sort_by=-likeCount&count=8`;
      const res = await fetchJson(searchUrl, authHeaders);
      for (const item of res.results || []) {
        if (
          !discovered.has(item.uid) &&
          isAuthenticMedicalCandidate(item, target.minFaceCount)
        ) {
          discovered.set(item.uid, item);
        }
      }
    } catch (err) {
      console.warn(`  [warn] Search "${query}" failed: ${err.message}`);
    }
  }

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

async function cacheBustZAnatomyManifest() {
  const raw = await fs.readFile(ZANATOMY_MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.models)) {
    throw new Error('Invalid Z-Anatomy manifest.json structure');
  }
  manifest.cacheVersion = CACHE_VERSION_TAG;
  manifest.models = manifest.models.map((m) => {
    const cleanBasePath = String(
      m.localPath || `/models/zanatomy/${m.fileName || m.file}`
    ).split('?')[0];
    return {
      ...m,
      localPath: `${cleanBasePath}?v=${CACHE_VERSION_TAG}`,
    };
  });
  await fs.writeFile(
    ZANATOMY_MANIFEST_PATH,
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
  console.log(
    `✓ Updated ${ZANATOMY_MANIFEST_PATH} with ?v=${CACHE_VERSION_TAG} on ${manifest.models.length} models.`
  );
}

async function main() {
  const token = await resolveApiToken();
  const authHeaders = { Authorization: `Token ${token}` };

  console.log('=== Sketchfab V3 Female Anatomy Downloader & Cache-Buster ===');
  const me = await fetchJson(`${SKETCHFAB_API_BASE}/me`, authHeaders);
  console.log(`Authenticated as Sketchfab user: ${me.username} (${me.uid})`);

  await fs.mkdir(FEMALE_OUTPUT_DIR, { recursive: true });
  const forceDownload = process.argv.includes('--force');
  const manifestModels = [];

  for (const target of FEMALE_TARGETS) {
    console.log(`\n[${target.id.toUpperCase()}] Resolving female anatomy model...`);
    const destPath = path.join(FEMALE_OUTPUT_DIR, target.fileName);
    const localPath = `/models/female/${target.fileName}?v=${CACHE_VERSION_TAG}`;

    const candidates = await discoverCandidates(target, authHeaders);
    if (candidates.length === 0) {
      console.warn(`  [warn] No candidates found for ${target.id}`);
      continue;
    }

    let selectedMeta = null;
    let downloadedBytes = 0;

    if (!forceDownload) {
      const existingSize = await verifyExistingGlb(destPath);
      if (existingSize && candidates[0]) {
        selectedMeta = candidates[0];
        downloadedBytes = existingSize;
        console.log(
          `  ✓ Reusing verified GLB ${target.fileName} (${(
            existingSize /
            1024 /
            1024
          ).toFixed(2)} MB)`
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
          console.warn(
            `  [retry] Candidate ${candidate.uid} failed: ${err.message}`
          );
        }
      }
    }

    if (!selectedMeta) {
      console.warn(`  [warn] All download attempts failed for "${target.id}"`);
      continue;
    }

    manifestModels.push({
      id: target.id,
      sex: 'female',
      system: target.system,
      file: target.fileName,
      fileName: target.fileName,
      localPath,
      uid: selectedMeta.uid,
      title: selectedMeta.name,
      titleAr: target.titleAr,
      author:
        selectedMeta.user?.displayName ||
        selectedMeta.user?.username ||
        'Sketchfab Author',
      authorUsername: selectedMeta.user?.username || 'unknown',
      faceCount: selectedMeta.faceCount || 0,
      vertexCount: selectedMeta.vertexCount || 0,
      sizeBytes: downloadedBytes,
      isUnifiedFullBody: target.alignment.isFullBody,
      license: selectedMeta.license?.label || 'Creative Commons / Sketchfab',
      viewerUrl:
        selectedMeta.viewerUrl ||
        `https://sketchfab.com/3d-models/${selectedMeta.uid}`,
      alignment: target.alignment,
    });
  }

  const femaleManifest = {
    generatedAt: new Date().toISOString(),
    source: 'sketchfab-v3-api-female',
    authenticatedUser: me.username,
    totalModels: manifestModels.length,
    models: manifestModels,
  };

  await fs.writeFile(
    FEMALE_MANIFEST_PATH,
    JSON.stringify(femaleManifest, null, 2),
    'utf8'
  );
  console.log(
    `\n✓ Wrote ${FEMALE_MANIFEST_PATH} (${manifestModels.length} female GLB models)`
  );

  await cacheBustZAnatomyManifest();
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
