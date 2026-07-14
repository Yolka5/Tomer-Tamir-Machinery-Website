const { app, BrowserWindow, shell, session } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 41730;
// Serve the repo root so BeaverOS can reuse firebase-config.js, forge.css,
// the TTM logo, and even open ForgeOS (os.html) from the same origin.
const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.gltf': 'model/gltf+json',
  '.csv': 'text/csv'
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath;
      try {
        urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch (err) {
        res.writeHead(400).end('Bad request');
        return;
      }

      if (urlPath.endsWith('/')) urlPath += 'index.html';

      const filePath = path.normalize(path.join(ROOT, urlPath));
      if (!filePath.startsWith(path.normalize(ROOT))) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404).end('Not found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
    });

    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function createWindow() {
  await startServer();

  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0c0e',
    autoHideMenuBar: true,
    icon: path.join(ROOT, 'TTMNewLogo.png'),
    title: 'BeaverOS',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Allow popups on our own origin (Google sign-in, ForgeOS window).
  // External links open in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1:' + PORT) ||
        url.startsWith('http://localhost:' + PORT) ||
        url.includes('firebaseapp.com') ||
        url.includes('accounts.google.com')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Use localhost (not 127.0.0.1) — it's in Firebase's authorized domains by default.
  win.loadURL('http://localhost:' + PORT + '/BeaverOS/app/index.html');
}

app.whenReady().then(() => {
  // Allow microphone access for Marcus voice mode.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
