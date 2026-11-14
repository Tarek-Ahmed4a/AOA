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

export default defineConfig({
  base: './',
  plugins: [react(), stripChunkPartsFromDist()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
