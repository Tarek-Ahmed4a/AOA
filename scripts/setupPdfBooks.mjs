/**
 * Automated PDF Discovery & Public Asset Linking
 *
 * Scans d:\AOA\ and public/ for .pdf textbooks, links/copies them cleanly into
 * public/books/, extracts fast PDF page counts + chapter outlines, and emits:
 *   public/books/manifest.json
 *
 * Usage:
 *   node scripts/setupPdfBooks.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const BOOKS_OUT_DIR = path.join(ROOT, 'public', 'books');
const MANIFEST_PATH = path.join(BOOKS_OUT_DIR, 'manifest.json');

const pdfjsLib = await import(
  pathToFileURL(
    path.join(ROOT, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')
  ).href
);

function findPdfFiles() {
  const candidates = [];
  const skipDirs = new Set(['node_modules', 'dist', 'dist-ssr', '.git']);

  const scanDir = (dir, depth = 0) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        // Skip our own generated public/books directory to prevent self-duplication
        if (path.resolve(fullPath) === path.resolve(BOOKS_OUT_DIR)) continue;
        if (depth < 2) {
          scanDir(fullPath, depth + 1);
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        const stat = fs.statSync(fullPath);
        candidates.push({
          fullPath,
          filename: entry.name,
          sizeBytes: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      }
    }
  };

  scanDir(ROOT, 0);
  return candidates;
}

function classifyBookRole(filename, fallbackSlot) {
  const lower = filename.toLowerCase();
  if (/netter|atlas|plate|organ|illustr/.test(lower)) {
    return {
      slot: 1,
      id: 'book1',
      role: 'atlas',
      title: 'Book 1 — Atlas & Illustrations',
      shortLabel: 'Book 1: Atlas & Organs (Plates)',
      sourceTitle: filename.replace(/\.pdf$/i, ''),
      safeFilename: 'book1-netters-atlas-7ed.pdf',
    };
  }
  if (/gray|textbook|clinical|student|explain/.test(lower)) {
    return {
      slot: 2,
      id: 'book2',
      role: 'textbook',
      title: 'Book 2 — Textbook & Explanations',
      shortLabel: 'Book 2: Clinical Text & Explanations',
      sourceTitle: filename.replace(/\.pdf$/i, ''),
      safeFilename: 'book2-grays-anatomy-4ed.pdf',
    };
  }
  const slug = filename
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    slot: fallbackSlot,
    id: `book${fallbackSlot}`,
    role: fallbackSlot === 1 ? 'atlas' : 'textbook',
    title:
      fallbackSlot === 1
        ? 'Book 1 — Atlas & Illustrations'
        : 'Book 2 — Textbook & Explanations',
    shortLabel:
      fallbackSlot === 1
        ? 'Book 1: Atlas & Organs (Plates)'
        : 'Book 2: Clinical Text & Explanations',
    sourceTitle: filename.replace(/\.pdf$/i, ''),
    safeFilename: `book${fallbackSlot}-${slug || 'reference'}.pdf`,
  };
}

function ensureLinkedPdf(srcPath, destPath) {
  const srcStat = fs.statSync(srcPath);
  if (fs.existsSync(destPath)) {
    try {
      const dstStat = fs.lstatSync(destPath);
      const resolvedDstStat = fs.statSync(destPath);
      if (
        (dstStat.isSymbolicLink() || resolvedDstStat.ino === srcStat.ino) &&
        resolvedDstStat.size === srcStat.size
      ) {
        return dstStat.isSymbolicLink() ? 'symlink' : 'hardlink';
      }
      if (
        resolvedDstStat.size === srcStat.size &&
        Math.abs(resolvedDstStat.mtimeMs - srcStat.mtimeMs) < 1000
      ) {
        return 'copy';
      }
    } catch {
      // Remove broken link and relink below
    }
    fs.rmSync(destPath, { force: true });
  }

  try {
    fs.symlinkSync(srcPath, destPath, 'file');
    return 'symlink';
  } catch {
    try {
      fs.linkSync(srcPath, destPath);
      return 'hardlink';
    } catch {
      fs.copyFileSync(srcPath, destPath);
      return 'copy';
    }
  }
}

async function inspectPdfMetadata(pdfPath, role) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data, verbosity: 0 });
  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;

  const chapters = [];
  const plateToPage = {};
  let plateOffsetEstimate = null;

  try {
    const outline = await doc.getOutline();
    if (Array.isArray(outline)) {
      const resolveOutlineDest = async (dest) => {
        if (!dest) return null;
        const resolved =
          typeof dest === 'string' ? await doc.getDestination(dest) : dest;
        if (!Array.isArray(resolved) || !resolved[0]) return null;
        try {
          const idx = await doc.getPageIndex(resolved[0]);
          return idx + 1;
        } catch {
          return null;
        }
      };

      const chapterNoiseRegex =
        /^(?:front\s+cover|inside\s+front\s+cover|marketing|copyright|consulting\s+editors|editors|international\s+advisory|preface|contributors|acknowledg|dedication|reviewer|table\s+of\s+contents|title\s+page|new\s+to\s+this|frank\s+h\.|surface\s+anatomy)/i;

      const chaptersDepth0 = [];
      const chaptersDepth1 = [];

      const walk = async (items, depth) => {
        for (const item of items) {
          const pageNum = await resolveOutlineDest(item.dest);
          const title = String(item.title || '').replace(/\s+/g, ' ').trim();
          if (title && pageNum) {
            const isUsefulChapter =
              !chapterNoiseRegex.test(title) &&
              !/^plate\s+\d+/i.test(title) &&
              !/^e?table\s+/i.test(title);
            if (isUsefulChapter) {
              if (depth === 0 && !chaptersDepth0.some((c) => c.title === title)) {
                chaptersDepth0.push({ title, page: pageNum });
              } else if (
                depth === 1 &&
                !chaptersDepth1.some((c) => c.title === title)
              ) {
                chaptersDepth1.push({ title, page: pageNum });
              }
            }
            if (role === 'atlas') {
              const plateMatch = title.match(/\bPlate\s+(\d+)\b/i);
              if (plateMatch) {
                const plateNo = Number(plateMatch[1]);
                if (!plateToPage[plateNo]) {
                  plateToPage[plateNo] = pageNum;
                  if (plateOffsetEstimate === null && plateNo >= 1) {
                    plateOffsetEstimate = pageNum - plateNo;
                  }
                }
              }
            }
          }
          if (Array.isArray(item.items) && item.items.length > 0 && depth < 2) {
            await walk(item.items, depth + 1);
          }
        }
      };

      await walk(outline, 0);
      const preferred =
        chaptersDepth0.length >= 6 ? chaptersDepth0 : chaptersDepth1;
      for (const ch of preferred.slice(0, 12)) {
        chapters.push(ch);
      }
    }
  } catch {
    // Outlines optional
  } finally {
    await doc.cleanup?.();
    await loadingTask.destroy();
  }

  return {
    pageCount,
    chapters: chapters.slice(0, 12),
    plateToPage,
    plateOffsetEstimate,
  };
}

async function main() {
  const discovered = findPdfFiles();
  if (discovered.length === 0) {
    console.warn('No PDF files found in d:/AOA or public/.');
  }

  fs.mkdirSync(BOOKS_OUT_DIR, { recursive: true });

  // Deduplicate by resolved path and sort Book 1 (Atlas) first, Book 2 (Textbook) second
  let nextSlot = 1;
  const enriched = discovered
    .map((item) => {
      const meta = classifyBookRole(item.filename, nextSlot++);
      return { ...item, ...meta };
    })
    .sort((a, b) => a.slot - b.slot);

  const expectedOutFiles = new Set(enriched.map((b) => b.safeFilename));
  for (const existing of fs.readdirSync(BOOKS_OUT_DIR)) {
    if (
      existing.toLowerCase().endsWith('.pdf') &&
      !expectedOutFiles.has(existing)
    ) {
      fs.rmSync(path.join(BOOKS_OUT_DIR, existing), { force: true });
    }
  }

  const books = [];
  for (const item of enriched) {
    const destPath = path.join(BOOKS_OUT_DIR, item.safeFilename);
    const linkMethod = ensureLinkedPdf(item.fullPath, destPath);
    const pdfMeta = await inspectPdfMetadata(item.fullPath, item.role);

    books.push({
      id: item.id,
      slot: item.slot,
      role: item.role,
      title: item.title,
      shortLabel: item.shortLabel,
      sourceTitle: item.sourceTitle,
      originalFilename: item.filename,
      filename: item.safeFilename,
      sizeBytes: item.sizeBytes,
      pageCount: pdfMeta.pageCount,
      url: `/books/${encodeURIComponent(item.safeFilename)}`,
      linkMethod,
      chapters: pdfMeta.chapters,
      plateOffsetEstimate: pdfMeta.plateOffsetEstimate,
      plateToPage: pdfMeta.plateToPage,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    books,
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        manifestPath: 'public/books/manifest.json',
        bookCount: books.length,
        books: books.map((b) => ({
          id: b.id,
          title: b.title,
          originalFilename: b.originalFilename,
          url: b.url,
          linkMethod: b.linkMethod,
          pageCount: b.pageCount,
          chaptersCount: b.chapters.length,
          plateMappingsCount: Object.keys(b.plateToPage).length,
          plateOffsetEstimate: b.plateOffsetEstimate,
        })),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('setupPdfBooks failed:', err);
  process.exit(1);
});
