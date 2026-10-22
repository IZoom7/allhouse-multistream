'use strict';
// Profile pictures for platforms that don't send one with chat (verified Oct 2026, both unofficial, no sign-in):
//   Twitch: gql.twitch.tv with the public web client id — many logins in one query (aliases).
//   Kick:   kick.com/api/v2/channels/<slug> → user.profile_pic (null when the viewer has none).
// YouTube and TikTok already include the picture in chat. Results are cached; an empty string means "no picture".
const TWITCH_GQL = 'https://gql.twitch.tv/gql', TWITCH_WEB_CLIENT = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const HIT_MS = 24 * 3600e3, MISS_MS = 3600e3, MAX = 3000, BATCH_MS = 120, BATCH_MAX = 35;

function createAvatars({ fetch, now = () => Date.now() }) {
  const cache = new Map(); // key -> { url, at }
  const inflight = new Map(); // key -> Promise<string>
  let twitchQueue = new Map(), twitchTimer = null; // login -> [resolve]

  const remember = (key, url) => { cache.delete(key); cache.set(key, { url, at: now() }); if (cache.size > MAX) cache.delete(cache.keys().next().value); return url; };
  const cached = key => { const c = cache.get(key); return c && now() - c.at < (c.url ? HIT_MS : MISS_MS) ? c : null; };

  async function flushTwitch() {
    twitchTimer = null;
    const batch = twitchQueue; twitchQueue = new Map();
    const logins = [...batch.keys()];
    let found = {};
    try {
      const q = logins.map((l, i) => `u${i}:user(login:${JSON.stringify(l)}){profileImageURL(width:70)}`).join(' ');
      const r = await fetch(TWITCH_GQL, { method: 'POST', headers: { 'Client-Id': TWITCH_WEB_CLIENT, 'Content-Type': 'application/json' }, body: JSON.stringify([{ query: `query{${q}}` }]) });
      const data = r.ok ? ((await r.json())[0] || {}).data || {} : {};
      logins.forEach((l, i) => { found[l] = (data['u' + i] && data['u' + i].profileImageURL) || ''; });
    } catch { found = {}; }
    for (const [l, resolvers] of batch) { const url = found[l] || ''; if (l in found) remember('twitch:' + l, url); resolvers.forEach(fn => fn(url)); }
  }

  /** Picture URL for a viewer ('' when there is none or the lookup failed). id: Twitch login or Kick slug. */
  function get(platform, id) {
    const login = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(login) || (platform !== 'twitch' && platform !== 'kick')) return Promise.resolve('');
    const key = platform + ':' + login, c = cached(key);
    if (c) return Promise.resolve(c.url);
    if (inflight.has(key)) return inflight.get(key);
    let p;
    if (platform === 'twitch') {
      p = new Promise(resolve => {
        const list = twitchQueue.get(login) || []; list.push(resolve); twitchQueue.set(login, list);
        if (twitchQueue.size >= BATCH_MAX) { clearTimeout(twitchTimer); flushTwitch(); }
        else if (!twitchTimer) twitchTimer = setTimeout(flushTwitch, BATCH_MS);
      });
    } else {
      p = fetch('https://kick.com/api/v2/channels/' + login, { headers: { Accept: 'application/json' } })
        .then(async r => (r.ok ? remember(key, String(((await r.json()).user || {}).profile_pic || '')) : r.status === 404 ? remember(key, '') : ''))
        .catch(() => '');
    }
    p = p.finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }
  return { get };
}

/** Resolve with the picture or '' after `ms`, whichever comes first (chat is never held longer than that). */
const within = (promise, ms) => Promise.race([promise, new Promise(r => setTimeout(() => r(''), ms))]);

module.exports = { createAvatars, within };
