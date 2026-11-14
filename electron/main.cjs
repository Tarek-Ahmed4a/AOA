const { app, BrowserWindow, ipcMain, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const APP_ORIGIN = 'app://bundle';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

// Enforce hardware WebGL2 acceleration across integrated and discrete GPUs
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-webgl2-compute-context');
app.commandLine.appendSwitch('enable-gpu-rasterization');

// Register custom privileged scheme so fetch(), GLTFLoader, and Chromium PDF viewer work offline
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function resolveDistFile(requestPathname) {
  let decodedPath = decodeURIComponent(requestPathname || '/');
  if (decodedPath === '/' || decodedPath === '') {
    decodedPath = 'index.html';
  } else {
    decodedPath = decodedPath.replace(/^\/+/, '');
  }

  const candidate = path.resolve(DIST_DIR, decodedPath);
  if (candidate !== DIST_DIR && !candidate.startsWith(DIST_DIR + path.sep)) {
    return null;
  }
  return candidate;
}

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    try {
      const reqUrl = new URL(request.url);
      let filePath = resolveDistFile(reqUrl.pathname);
      if (!filePath) {
        return new Response('Forbidden', { status: 403 });
      }

      let stat = await fs.promises.stat(filePath).catch(() => null);
      if (!stat || stat.isDirectory()) {
        if (path.extname(reqUrl.pathname) !== '') {
          return new Response('Not Found', { status: 404 });
        }
        filePath = path.join(DIST_DIR, 'index.html');
        stat = await fs.promises.stat(filePath).catch(() => null);
        if (!stat) {
          return new Response('Not Found', { status: 404 });
        }
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const totalSize = stat.size;
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
        if (match) {
          const start = Number(match[1]);
          const end = match[2]
            ? Math.min(Number(match[2]), totalSize - 1)
            : totalSize - 1;
          if (start >= totalSize || end < start) {
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${totalSize}` },
            });
          }
          const chunkSize = end - start + 1;
          const stream = fs.createReadStream(filePath, { start, end });
          return new Response(Readable.toWeb(stream), {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(chunkSize),
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Accept-Ranges': 'bytes',
            },
          });
        }
      }

      const stream = fs.createReadStream(filePath);
      return new Response(Readable.toWeb(stream), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
        },
      });
    } catch (err) {
      return new Response(String(err?.message || err), { status: 500 });
    }
  });
}

let mainWindow = null;

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Anatomy Atlas 3D',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      plugins: true,
      backgroundThrottling: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadURL(`${APP_ORIGIN}/index.html`);
  }

  mainWindow = win;
  return win;
}

ipcMain.handle('window:toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

ipcMain.handle('window:is-fullscreen', () => {
  return Boolean(mainWindow?.isFullScreen());
});

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

app.whenReady().then(() => {
  registerAppProtocol();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
