'use strict';
// Builds the Windows release: a slim packaged app (release/Allhouse-win32-x64) and the styled per-user installer
// release/Allhouse-Setup-<version>.exe (installer/Setup.cs, compiled with the csc.exe that ships with Windows).
// No network, no extra packages: Electron comes from node_modules/electron/dist.
//   node scripts/build-release.cjs [--skip-build]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const V = pkg.version;
const rel = path.join(root, 'release'), out = path.join(rel, 'Allhouse-win32-x64'), work = path.join(rel, 'build');
const run = (cmd, args, opts) => execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
const step = s => console.log('\n» ' + s);

async function main() {
  if (!process.argv.includes('--skip-build')) {
    step('Type-check + build interface');
    run(process.execPath, ['node_modules/typescript/bin/tsc', '-b']);
    run(process.execPath, ['node_modules/vite/bin/vite.js', 'build']);
  }
  for (const d of [out, work]) fs.rmSync(d, { recursive: true, force: true }); // only our own output folders
  fs.mkdirSync(work, { recursive: true });

  step('Electron runtime');
  fs.cpSync(path.join(root, 'node_modules/electron/dist'), out, { recursive: true });
  fs.renameSync(path.join(out, 'electron.exe'), path.join(out, 'Allhouse.exe'));
  fs.rmSync(path.join(out, 'resources', 'default_app.asar'), { force: true });
  for (const f of fs.readdirSync(path.join(out, 'locales'))) if (!['en-US.pak', 'th.pak'].includes(f)) fs.rmSync(path.join(out, 'locales', f));

  step('App files (runtime only: no sources, tests or dev dependencies)');
  const app = path.join(out, 'resources', 'app');
  const copy = (p, filter) => fs.cpSync(path.join(root, p), path.join(app, p), { recursive: true, filter });
  copy('electron'); copy('dist'); copy('scripts/speech.ps1'); copy('src/assets/platforms'); copy('public/brand/allhouse.ico'); copy('LICENSE');
  copy('docs-site', f => !/[\\/](README\.md|vercel\.json|_headers)$/.test(f));
  // Fonts the OBS widget server serves (electron/runtime.cjs resolves them through the package exports).
  for (const [name, file] of [['noto-sans', 'noto-sans-latin-400-normal.woff2'], ['noto-sans-thai', 'noto-sans-thai-thai-400-normal.woff2']]) {
    const from = path.join(root, 'node_modules/@fontsource', name), to = path.join(app, 'node_modules/@fontsource', name);
    fs.mkdirSync(path.join(to, 'files'), { recursive: true });
    for (const f of ['package.json', 'LICENSE']) fs.copyFileSync(path.join(from, f), path.join(to, f));
    fs.copyFileSync(path.join(from, 'files', file), path.join(to, 'files', file));
  }
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: pkg.name, version: V, description: pkg.description, main: pkg.main, license: pkg.license }, null, 2));

  step('Exe icon + version info');
  const exe = path.join(out, 'Allhouse.exe');
  const { resedit } = require(path.join(root, 'node_modules/@electron/packager/dist/resedit.js'));
  await resedit(exe, {
    iconPath: path.join(root, 'public/brand/allhouse.ico'), fileVersion: V, productVersion: V, productName: 'Allhouse',
    legalCopyright: '© Allhouse. All rights reserved.',
    win32Metadata: { CompanyName: 'Allhouse', FileDescription: 'Allhouse', InternalName: 'Allhouse', OriginalFilename: 'Allhouse.exe' },
  });

  step('Electron fuses: no ELECTRON_RUN_AS_NODE, NODE_OPTIONS or --inspect');
  flipFuses(exe, { 0: false /* RunAsNode */, 2: false /* EnableNodeOptionsEnvironmentVariable */, 3: false /* EnableNodeCliInspectArguments */ });

  step('Payload zip');
  const zip = path.join(work, 'payload.zip');
  run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('${out}', '${zip}', [IO.Compression.CompressionLevel]::Optimal, $false)`]);

  step('Installer');
  const fw = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319');
  const csc = path.join(fw, 'csc.exe');
  const refs = ['System.dll', 'System.Core.dll', 'System.Xaml.dll', 'System.IO.Compression.dll', 'System.Windows.Forms.dll',
    'WPF/PresentationFramework.dll', 'WPF/PresentationCore.dll', 'WPF/WindowsBase.dll'].map(r => '/r:' + path.join(fw, r));
  const inst = path.join(root, 'installer');
  const info = title => `using System.Reflection;\n[assembly: AssemblyTitle("${title}")]\n[assembly: AssemblyProduct("Allhouse")]\n[assembly: AssemblyVersion("${V}.0")]\n[assembly: AssemblyFileVersion("${V}.0")]\nnamespace AllhouseSetup { static class BuildInfo { public const string Version = "${V}"; } }\n`;
  fs.writeFileSync(path.join(work, 'InfoSetup.cs'), info('Allhouse Setup'));
  fs.writeFileSync(path.join(work, 'InfoUninstall.cs'), info('Allhouse Uninstall'));
  const common = ['/nologo', '/target:winexe', '/optimize+', '/platform:anycpu', '/utf8output', '/codepage:65001',
    '/win32icon:' + path.join(root, 'public/brand/allhouse.ico'), '/win32manifest:' + path.join(inst, 'app.manifest'),
    `/resource:${path.join(inst, 'Setup.xaml')},Setup.xaml`, `/resource:${path.join(root, 'public/brand/allhouse-icon-256.png')},icon.png`, ...refs];
  const uninst = path.join(work, 'uninstall.exe');
  run(csc, [...common, '/define:UNINSTALLER', '/out:' + uninst, path.join(inst, 'Setup.cs'), path.join(work, 'InfoUninstall.cs')]);
  const setup = path.join(rel, `Allhouse-Setup-${V}.exe`);
  run(csc, [...common, '/out:' + setup, `/resource:${zip},payload.zip`, `/resource:${uninst},uninstall.exe`, path.join(inst, 'Setup.cs'), path.join(work, 'InfoSetup.cs')]);

  const bytes = fs.readFileSync(setup);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(setup + '.sha256', `${sha}  ${path.basename(setup)}\n`);
  step(`Done: ${path.relative(root, setup)}  ${(bytes.length / 1048576).toFixed(1)} MB\n  SHA-256 ${sha}`);
}

/** Electron fuse wire: sentinel, version byte, length byte, then one '0'/'1' per fuse (@electron/fuses layout). */
function flipFuses(file, changes) {
  const buf = fs.readFileSync(file), sentinel = Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');
  const at = buf.indexOf(sentinel);
  if (at < 0 || buf.indexOf(sentinel, at + 1) >= 0) throw new Error('Fuse wire not found exactly once');
  const len = buf[at + sentinel.length + 1], first = at + sentinel.length + 2;
  for (const [i, on] of Object.entries(changes)) {
    if (+i >= len || ![0x30, 0x31].includes(buf[first + +i])) throw new Error('Unexpected fuse layout');
    buf[first + +i] = on ? 0x31 : 0x30;
  }
  fs.writeFileSync(file, buf);
}

main().catch(e => { console.error(e); process.exit(1); });
