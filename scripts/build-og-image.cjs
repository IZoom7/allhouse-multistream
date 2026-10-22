'use strict';
// Renders scripts/og-card.html to docs-site/assets/og-cover.jpg (1200×630, the size every link preview uses;
// JPEG keeps it under WhatsApp's ~300 KB limit).
// Runs inside Electron (needs network once for the Google Fonts in the card):
//   node_modules/electron/dist/electron.exe scripts/build-og-image.cjs
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1200, height: 630, useContentSize: true, show: false, frame: false,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true } });
  await win.loadFile(path.join(__dirname, 'og-card.html'));
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => new Promise(r => setTimeout(r, 400))).then(() => document.fonts.size)');
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1200, height: 630 });
  const out = path.join(__dirname, '..', 'docs-site', 'assets', 'og-cover.jpg');
  fs.writeFileSync(out, img.resize({ width: 1200, height: 630 }).toJPEG(90));
  console.log('wrote', path.relative(process.cwd(), out), img.getSize());
  app.quit();
}).catch(e => { console.error(e); app.exit(1); });
