'use strict';
// TikTok LIVE through TikFinity Desktop (tikfinity.zerody.one), which re-broadcasts the streamer's LIVE events on a
// local WebSocket. TikFinity must be running on this computer and connected to the TikTok account.
// Message shape: {"event":"chat","data":{...}}. Field names follow TikTok-Live-Connector (flat or nested under data.user).
const { reconnecting } = require('./common.cjs');

const DEFAULT_URL = 'ws://127.0.0.1:21213/';

const who = d => (d && (d.nickname || (d.user && d.user.nickname) || d.uniqueId || (d.user && d.user.uniqueId))) || '';

/** One TikFinity message -> Allhouse event or null. */
function toEvent(msg) {
  if (!msg || typeof msg.event !== 'string') return null;
  const d = msg.data || {};
  switch (msg.event) {
    case 'chat': return d.comment ? { type: 'chat', name: who(d), message: String(d.comment) } : null;
    case 'follow': return { type: 'follow', name: who(d), message: 'followed' };
    case 'subscribe': return { type: 'subscription', name: who(d), message: 'subscribed' };
    case 'social': return /follow/i.test(String(d.displayType || '')) ? { type: 'follow', name: who(d), message: 'followed' } : null;
    case 'gift': {
      // Streakable gifts (giftType 1, e.g. Rose) send one message per tap: alert once, when the combo ends.
      const det = d.giftDetails || {}, ext = d.extendedGiftInfo || {};
      const giftType = d.giftType ?? det.giftType;
      if (giftType === 1 && d.repeatEnd !== true && d.repeatEnd !== 1) return null;
      const gift = {
        name: String(d.giftName || det.giftName || ext.name || 'Gift'),
        count: Math.max(1, parseInt(d.repeatCount, 10) || 1),
        coins: Math.max(0, parseInt(d.diamondCount ?? det.diamondCount ?? ext.diamond_count, 10) || 0),
        image: String(d.giftPictureUrl || (det.giftImage && det.giftImage.giftPictureUrl) || (ext.image && ext.image.url_list && ext.image.url_list[0]) || ''),
      };
      return { type: 'gift', name: who(d), message: `${gift.name} ×${gift.count}`, gift };
    }
    default: return null; // likes, joins, shares: not shown
  }
}

function connect({ url = DEFAULT_URL, WebSocket = globalThis.WebSocket, onEvent, onStatus }) {
  if (!/^ws:\/\/(127\.0\.0\.1|localhost):\d{2,5}\/?$/.test(url)) throw new Error('TikFinity address must be on this computer (ws://127.0.0.1:port).');
  return reconnecting({
    label: 'TikFinity', onStatus, readyTimeoutMs: 8000,
    open(ready, fail) {
      const ws = new WebSocket(url);
      ws.onopen = () => ready('TikFinity');
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(String(ev.data)); } catch { return; }
        const e = toEvent(m); if (e && e.name) onEvent(e);
      };
      ws.onerror = () => {};
      ws.onclose = () => fail(new Error('TikFinity is not running (or its Event API is off)'));
      return () => { try { ws.close(); } catch {} };
    },
  });
}

module.exports = { connect, toEvent, DEFAULT_URL };
