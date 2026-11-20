import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Strip split Git transport chunks (*.partN and *.chunks.json) from dist/
 * after scripts/reassembleLargeAssets.mjs has assembled the full binary files.
 */
function stripChunkPartsFromDist(): Plugin {
  let outDir = 'dist';
  return {
    name: 'strip-chunk-parts-from-dist',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir || 'dist';
    },
    closeBundle() {
      const targetRoot = path.resolve(process.cwd(), outDir);
      if (!fs.existsSync(targetRoot)) return;
      const walkAndClean = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkAndClean(full);
          } else if (/\.part\d+$/.test(entry.name) || entry.name.endsWith('.chunks.json')) {
            fs.unlinkSync(full);
          }
        }
      };
      walkAndClean(targetRoot);
    },
  };
}

function createPdfRangeMiddleware(rootDir: string) {
  const safeBooksRoot = path.resolve(rootDir, 'books');
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const method = req.method?.toUpperCase() || 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      next();
      return;
    }

    const cleanUrl = (req.url || '').split('?')[0];
    if (!cleanUrl.startsWith('/books/') || !cleanUrl.toLowerCase().endsWith('.pdf')) {
      next();
      return;
    }

    const relFile = decodeURIComponent(cleanUrl.slice('/books/'.length));
    const filePath = path.resolve(safeBooksRoot, relFile);
    if (!filePath.startsWith(safeBooksRoot + path.sep) || !fs.existsSync(filePath)) {
      next();
      return;
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      next();
      return;
    }

    const total = stat.size;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (!match) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${total}`);
        res.end();
        return;
      }

      const start = match[1] ? Number.parseInt(match[1], 10) : Math.max(0, total - Number.parseInt(match[2] || '0', 10));
      const end = match[2] && match[1] ? Math.min(total - 1, Number.parseInt(match[2], 10)) : total - 1;

      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= total || start > end) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${total}`);
        res.end();
        return;
      }

      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(end - start + 1));
      if (method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Length', String(total));
    if (method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  };
}

/**
 * Enable HTTP 206 Partial Content streaming for large offline textbook PDFs
 * in Vite dev and preview servers so PDF.js fetches small XRef and visible-page
 * byte ranges instead of downloading 319 MB upfront.
 */
function pdfByteRangeSupport(): Plugin {
  return {
    name: 'pdf-byte-range-support',
    configureServer(server) {
      server.middlewares.use(createPdfRangeMiddleware(path.resolve(process.cwd(), 'public')));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createPdfRangeMiddleware(path.resolve(process.cwd(), 'dist')));
    },
  };
}

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')
) as { version?: string };
const appVersion = packageJson.version ?? '2.0.1';

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react(), stripChunkPartsFromDist(), pdfByteRangeSupport()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
