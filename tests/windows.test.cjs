// Pop-out chat window + speech relay: sender trust, command/status validation, bounds, and main.cjs wiring.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isTrustedSender, validateSpeechCommand, validateSpeechStatus, sanitizeBounds, CHAT_WINDOW_HASH } = require('../electron/windows.cjs');

const fakeWindow = (destroyed = false) => { const mainFrame = { id: Math.random() }; return { webContents: { mainFrame }, isDestroyed: () => destroyed }; };

test('only the main frame of an open app window is a trusted IPC sender', () => {
  const main = fakeWindow(), chat = fakeWindow(), other = fakeWindow();
  const ev = (w, frame = w.webContents.mainFrame) => ({ sender: w.webContents, senderFrame: frame });
  assert.equal(isTrustedSender(ev(main), [main, chat]), true);
  assert.equal(isTrustedSender(ev(chat), [main, chat]), true, 'pop-out chat window is allowed');
  assert.equal(isTrustedSender(ev(chat), [main]), false, 'main-only channels reject the pop-out');
  assert.equal(isTrustedSender(ev(other), [main, chat]), false, 'unknown webContents rejected');
  assert.equal(isTrustedSender(ev(main, { id: 'iframe' }), [main, chat]), false, 'sub-frames rejected');
  assert.equal(isTrustedSender(ev(chat), [main, null]), false, 'closed pop-out (null) is not trusted');
  const gone = fakeWindow(true);
  assert.equal(isTrustedSender(ev(gone), [main, gone]), false, 'destroyed window rejected');
  assert.equal(isTrustedSender(null, [main]), false);
  assert.equal(isTrustedSender({}, [main]), false);
});

test('speech commands are allow-listed and clamped', () => {
  assert.deepEqual(validateSpeechCommand({ cmd: 'stop' }), { cmd: 'stop' });
  assert.deepEqual(validateSpeechCommand({ cmd: 'skip', extra: 'x' }), { cmd: 'skip' }, 'extra fields dropped');
  assert.deepEqual(validateSpeechCommand({ cmd: 'open-settings' }), { cmd: 'open-settings' });
  assert.deepEqual(validateSpeechCommand({ cmd: 'set', patch: { enabled: true, volume: 7, rate: 0.1, voice: 'evil' } }), { cmd: 'set', patch: { enabled: true, volume: 1, rate: 0.5 } });
  for (const bad of [null, 'stop', [], {}, { cmd: 'speak' }, { cmd: 'set' }, { cmd: 'set', patch: {} }, { cmd: 'set', patch: { enabled: 'yes' } }, { cmd: 'set', patch: { volume: NaN } }, { cmd: 'set', patch: { rate: '2' } }, { cmd: 'set', patch: [] }])
    assert.throws(() => validateSpeechCommand(bad), /Invalid speech command/, JSON.stringify(bad));
});

test('speech status relayed to the pop-out is normalised', () => {
  assert.deepEqual(validateSpeechStatus({ speaking: true, enabled: true, volume: 3, rate: 9, pending: 2.6, engine: 'online', text: 'secret chat' }),
    { speaking: true, enabled: true, volume: 1, rate: 2, pending: 3, engine: 'online' });
  assert.deepEqual(validateSpeechStatus({ speaking: 'yes', engine: 'cloud' }), { speaking: false, enabled: false, volume: 0.8, rate: 1, pending: 0, engine: 'windows' });
  assert.throws(() => validateSpeechStatus(null));
});

test('saved pop-out bounds are sanitised to a portrait default and the minimum size', () => {
  assert.deepEqual(sanitizeBounds(null), { width: 420, height: 800 });
  assert.deepEqual(sanitizeBounds({ width: 500, height: 900, x: 10, y: 20 }), { width: 500, height: 900, x: 10, y: 20 });
  assert.deepEqual(sanitizeBounds({ width: 100, height: 200, x: 'a', y: 5 }), { width: 420, height: 800 }, 'below minimum / bad position ignored');
  assert.deepEqual(sanitizeBounds({ width: 320, height: 480 }), { width: 320, height: 480 }, 'minimum accepted');
  assert.deepEqual(sanitizeBounds({ width: 1e9, height: 1.5 }), { width: 420, height: 800 });
});

test('main.cjs: pop-out loads our own page with #chat-window, is hardened, and status is main-window only', () => {
  const main = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf8');
  assert.equal(CHAT_WINDOW_HASH, 'chat-window');
  assert.match(main, /chatWin\.loadFile\(indexFile,\{hash:CHAT_WINDOW_HASH\}\)/, 'loads dist/index.html with the chat hash (no remote URL)');
  assert.match(main, /hardenWindow\(chatWin\)/);
  assert.match(main, /hardenWindow\(win\)/);
  assert.match(main, /minWidth:320,minHeight:480/);
  assert.match(main, /isTrustedSender\(event,mainOnly\?\[win\]:\[win,chatWin\]\)/);
  assert.match(main, /invoke\('speech-status',[\s\S]*?\{mainOnly:true\}\)/);
  assert.match(main, /invoke\('speech-command',input=>\{const cmd=validateSpeechCommand\(input\);[\s\S]*?win\.webContents\.send\('house:speech-command',cmd\)/);
  assert.match(main, /webPreferences=\(\)=>\(\{preload:path\.join\(__dirname,'preload\.cjs'\),contextIsolation:true,nodeIntegration:false,sandbox:true\}\)/);
  const preload = fs.readFileSync(path.join(__dirname, '../electron/preload.cjs'), 'utf8');
  for (const name of ['openChatWindow', 'setChatWindowTop', 'sendSpeechCommand', 'onSpeechCommand', 'reportSpeechStatus', 'onSpeechStatus']) assert.match(preload, new RegExp(name + ':'));
  assert.doesNotMatch(preload, /ipcRenderer\.on\([^)]*cb\)/, 'listeners never hand the raw IPC event to the page');
});
