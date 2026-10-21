'use strict';
// Owns the live platform connections: saved settings (connections.json), status, auto-reconnect on start.
const fs = require('node:fs/promises');
const path = require('node:path');
const CONNECTORS = {
  twitch: require('./platforms/twitch.cjs'),
  youtube: require('./platforms/youtube.cjs'),
  kick: require('./platforms/kick.cjs'),
  tiktok: require('./platforms/tiktok.cjs'),
};
const PLATFORMS = Object.keys(CONNECTORS);

function createConnections({ dataDir, fetch, onEvent, onChange }) {
  const file = path.join(dataDir, 'connections.json');
  let saved = {};
  const live = {};   // platform -> { close }
  const status = Object.fromEntries(PLATFORMS.map(p => [p, { state: 'off', detail: '' }]));
  const counts = Object.fromEntries(PLATFORMS.map(p => [p, 0]));
  const fetchJson = async url => { const r = await fetch(url, { headers: { Accept: 'application/json' } }); if (r.status === 404) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
  const snapshot = () => Object.fromEntries(PLATFORMS.map(p => [p, { channel: (saved[p] || {}).channel || '', enabled: !!(saved[p] || {}).enabled, ...status[p], events: counts[p] }]));
  const changed = () => onChange(snapshot());
  const persist = () => fs.writeFile(file, JSON.stringify(saved, null, 2)).catch(() => {});

  function start(platform) {
    stop(platform, false);
    const cfg = saved[platform];
    try {
      live[platform] = CONNECTORS[platform].connect({
        channel: cfg.channel, fetch, fetchJson,
        onEvent: e => { counts[platform]++; onEvent({ ...e, platform }); },
        onStatus: s => { status[platform] = s; changed(); },
      });
    } catch (e) { status[platform] = { state: 'error', detail: e.message }; changed(); }
  }
  function stop(platform, notify = true) {
    if (live[platform]) { live[platform].close(); delete live[platform]; }
    status[platform] = { state: 'off', detail: '' };
    if (notify) changed();
  }
  return {
    async init() {
      try { const j = JSON.parse(await fs.readFile(file, 'utf8')); for (const p of PLATFORMS) if (j[p] && typeof j[p] === 'object') saved[p] = { channel: String(j[p].channel || '').slice(0, 200), enabled: j[p].enabled === true }; } catch {}
      for (const p of PLATFORMS) if (saved[p] && saved[p].enabled) start(p);
    },
    get: snapshot,
    async connect(platform, channel) {
      if (!PLATFORMS.includes(platform)) throw new Error('Unknown platform');
      if (typeof channel !== 'string' || channel.length > 200) throw new Error('Invalid channel');
      saved[platform] = { channel: channel.trim(), enabled: true }; counts[platform] = 0;
      await persist(); start(platform); return snapshot();
    },
    async disconnect(platform) {
      if (!PLATFORMS.includes(platform)) throw new Error('Unknown platform');
      saved[platform] = { ...(saved[platform] || { channel: '' }), enabled: false };
      await persist(); stop(platform); return snapshot();
    },
    closeAll() { for (const p of PLATFORMS) if (live[p]) { live[p].close(); delete live[p]; } },
  };
}

module.exports = { createConnections, PLATFORMS };
