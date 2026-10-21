'use strict';
// Window/IPC trust helpers for the main window and the pop-out chat window (kept pure for tests/windows.test.cjs).

/** An IPC call is trusted only from the main frame of one of our own, still-open windows. */
function isTrustedSender(event, windows) {
  if (!event || !event.sender) return false;
  return windows.some(w => w && !(typeof w.isDestroyed === 'function' && w.isDestroyed())
    && event.sender === w.webContents && event.senderFrame === w.webContents.mainFrame);
}

/** Commands the pop-out may send to the main window's speech player. */
function validateSpeechCommand(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid speech command');
  const { cmd } = input;
  if (cmd === 'stop' || cmd === 'skip' || cmd === 'open-settings') return { cmd };
  if (cmd === 'set') {
    const p = input.patch;
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Invalid speech command');
    const patch = {};
    if ('enabled' in p) { if (typeof p.enabled !== 'boolean') throw new Error('Invalid speech command'); patch.enabled = p.enabled; }
    if ('volume' in p) { if (typeof p.volume !== 'number' || !Number.isFinite(p.volume)) throw new Error('Invalid speech command'); patch.volume = Math.max(0, Math.min(1, p.volume)); }
    if ('platforms' in p) {
      const q = p.platforms, ids = ['twitch', 'youtube', 'kick', 'tiktok'];
      if (!q || typeof q !== 'object' || !ids.every(k => typeof q[k] === 'boolean')) throw new Error('Invalid speech command');
      patch.platforms = Object.fromEntries(ids.map(k => [k, q[k]]));
    }
    if ('rate' in p) { if (typeof p.rate !== 'number' || !Number.isFinite(p.rate)) throw new Error('Invalid speech command'); patch.rate = Math.max(0.5, Math.min(2, p.rate)); }
    if (!Object.keys(patch).length) throw new Error('Invalid speech command');
    return { cmd, patch };
  }
  throw new Error('Invalid speech command');
}

/** Speaking status the main window reports, relayed to the pop-out. */
function validateSpeechStatus(s) {
  if (!s || typeof s !== 'object') throw new Error('Invalid speech status');
  const num = (v, a, b, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d);
  return {
    speaking: s.speaking === true, enabled: s.enabled === true,
    volume: num(s.volume, 0, 1, 0.8), rate: num(s.rate, 0.5, 2, 1),
    pending: Math.round(num(s.pending, 0, 100, 0)),
    engine: s.engine === 'online' ? 'online' : 'windows',
    ...(s.platforms && typeof s.platforms === 'object' ? { platforms: Object.fromEntries(['twitch', 'youtube', 'kick', 'tiktok'].map(k => [k, s.platforms[k] !== false])) } : {}),
  };
}

/** Saved pop-out bounds → safe BrowserWindow options (falls back to 420×800 and keeps the minimum size). */
function sanitizeBounds(saved, { minWidth = 320, minHeight = 480 } = {}) {
  const out = { width: 420, height: 800 };
  if (saved && typeof saved === 'object') {
    const int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
    if (int(saved.width, minWidth, 4000)) out.width = saved.width;
    if (int(saved.height, minHeight, 4000)) out.height = saved.height;
    if (int(saved.x, -10000, 20000) && int(saved.y, -10000, 20000)) { out.x = saved.x; out.y = saved.y; }
  }
  return out;
}

/** Same hardening as the main window: no new windows, no navigation away from the app, no permissions. */
function hardenWindow(w) {
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', event => event.preventDefault());
}

const CHAT_WINDOW_HASH = 'chat-window';
module.exports = { isTrustedSender, validateSpeechCommand, validateSpeechStatus, sanitizeBounds, hardenWindow, CHAT_WINDOW_HASH };
