'use strict';
// Kick chat via the same realtime service kick.com's web client uses (unofficial; can change without notice).
// Verified Oct 2026: kick.com moved from Pusher to Centrifugo:
//   POST https://web.kick.com/api/v1/realtime/auth/connection {client_id} -> guest token
//   wss://realtime.us-west-2.platform.kick.com/connection/websocket, subscribe "chatrooms.<chatroomId>.v2" and "channel.<channelId>"
const { reconnecting } = require('./common.cjs');

const API = 'https://web.kick.com/api/v1/realtime';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

function normaliseSlug(input) {
  const s = String(input || '').trim().replace(/^https?:\/\/(www\.)?kick\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0].toLowerCase();
  return /^[a-z0-9_-]{2,40}$/.test(s) ? s : null;
}

/** "[emote:123:name]" -> "name" (so text and speech stay readable). */
const cleanText = s => String(s || '').replace(/\[emote:\d+:([^\]]*)\]/g, (_, n) => n).trim();

/** One Centrifugo push -> Allhouse event or null. */
function toEvent(push) {
  const pub = push && push.pub && push.pub.data;
  if (!pub || typeof pub.event !== 'string') return null;
  let d = pub.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return null; } }
  if (!d || typeof d !== 'object') return null;
  switch (pub.event) {
    case 'App\\Events\\ChatMessageEvent': {
      const text = cleanText(d.content);
      const color = d.sender && d.sender.identity && d.sender.identity.color;
      return d.sender && text ? { type: 'chat', name: d.sender.username, message: text, ...(d.sender.slug ? { slug: String(d.sender.slug) } : {}), ...(color ? { color } : {}) } : null;
    }
    case 'App\\Events\\SubscriptionEvent':
      return { type: 'subscription', name: d.username || 'Someone', message: d.months > 1 ? `subscribed for ${d.months} months` : 'subscribed' };
    case 'App\\Events\\GiftedSubscriptionsEvent': {
      const n = Array.isArray(d.gifted_usernames) ? d.gifted_usernames.length : 1;
      return { type: 'subscription', name: d.gifter_username || 'Anonymous', message: `gifted ${n} sub${n === 1 ? '' : 's'}` };
    }
    case 'App\\Events\\FollowersUpdated':
      return d.followed && d.username ? { type: 'follow', name: d.username, message: 'followed' } : null;
    default: return null;
  }
}

/** Resolve a channel slug to {channelId, chatroomId}. fetchJson must look like a browser (Cloudflare blocks plain Node fetch). */
async function lookup(slug, fetchJson) {
  const j = await fetchJson('https://kick.com/api/v2/channels/' + slug);
  if (!j || !j.id || !j.chatroom || !j.chatroom.id) throw new Error('Kick channel not found');
  return { channelId: j.id, chatroomId: j.chatroom.id };
}

function connect({ channel, fetchJson, WebSocket = globalThis.WebSocket, fetch = globalThis.fetch, onEvent, onStatus }) {
  const slug = normaliseSlug(channel);
  if (!slug) throw new Error('Kick channel name looks wrong. Use the name from kick.com/<name>.');
  let ids = null;
  return reconnecting({
    label: 'Kick', onStatus,
    open(ready, fail) {
      let ws = null, dead = false, refreshTimer = null;
      const clientId = 'allhouse-' + Date.now().toString(36); // a refresh token must be for the same guest (verified Oct 2026)
      const guestToken = async () => {
        const r = await fetch(API + '/auth/connection', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://kick.com', 'User-Agent': UA }, body: JSON.stringify({ client_id: clientId }) });
        const token = r.ok && (await r.json()).data?.token;
        if (!token) throw new Error('Kick refused a guest connection');
        return token;
      };
      (async () => {
        if (!ids) {
          try { ids = await lookup(slug, fetchJson); }
          catch (e) { return fail(new Error(e.message === 'Kick channel not found' ? `Kick channel "${slug}" was not found` : 'Could not reach kick.com'), e.message === 'Kick channel not found'); }
        }
        const token = await guestToken();
        if (dead) return;
        ws = new WebSocket('wss://realtime.us-west-2.platform.kick.com/connection/websocket', { headers: { Origin: 'https://kick.com', 'User-Agent': UA } });
        const armRefresh = c => { clearTimeout(refreshTimer); const ttl = c && c.expires && c.ttl;
          if (ttl > 120) refreshTimer = setTimeout(() => guestToken().then(t => { if (!dead) ws.send(JSON.stringify({ id: 4, refresh: { token: t } })); }).catch(() => {}), (ttl - 60) * 1000); };
        ws.onopen = () => ws.send(JSON.stringify({ id: 1, connect: { token, name: 'js' } }));
        ws.onmessage = ev => {
          for (const line of String(ev.data).split('\n')) {
            if (!line) continue;
            if (line === '{}') { ws.send('{}'); continue; } // Centrifugo ping
            let m; try { m = JSON.parse(line); } catch { continue; }
            if (m.id === 1) {
              if (m.error) return fail(new Error('Kick: ' + m.error.message));
              // The guest token expires (ttl ~45 min): refresh it on the same socket a minute early so no chat is missed.
              // If the refresh fails, Kick closes the socket and the normal reconnect takes over.
              armRefresh(m.connect);
              ws.send(JSON.stringify({ id: 2, subscribe: { channel: `chatrooms.${ids.chatroomId}.v2` } }));
              ws.send(JSON.stringify({ id: 3, subscribe: { channel: `channel.${ids.channelId}` } }));
            } else if (m.id === 4) { armRefresh(m.refresh); // each refresh returns the next ttl
            } else if (m.id === 2) {
              if (m.error) return fail(new Error('Kick chat: ' + m.error.message));
              ready('kick.com/' + slug);
            } else if (m.push) { const e = toEvent(m.push); if (e) onEvent(e); }
          }
        };
        ws.onerror = () => {};
        ws.onclose = () => fail(new Error('Connection closed'));
      })().catch(e => fail(e));
      return () => { dead = true; clearTimeout(refreshTimer); try { ws && ws.close(); } catch {} };
    },
  });
}

module.exports = { connect, toEvent, cleanText, normaliseSlug, lookup };
