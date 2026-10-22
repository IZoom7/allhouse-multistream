'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAvatars, within } = require('../electron/avatars.cjs');

const json = (status, body) => ({ ok: status < 400, status, json: async () => body });

test('Twitch: one batched query for several viewers, then served from cache', async () => {
  const calls = [];
  const fetch = async (url, o) => {
    calls.push({ url, body: o && o.body });
    const q = JSON.parse(o.body)[0].query;
    const data = {}; let i = 0;
    for (const m of q.matchAll(/u(\d+):user\(login:"([^"]+)"\)/g)) data['u' + m[1]] = m[2] === 'ghost' ? null : { profileImageURL: `https://static-cdn.jtvnw.net/${m[2]}.png` }, i++;
    return json(200, [{ data }]);
  };
  const a = createAvatars({ fetch });
  const [x, y, z] = await Promise.all([a.get('twitch', 'XQC'), a.get('twitch', 'caseoh_'), a.get('twitch', 'ghost')]);
  assert.deepEqual([x, y, z], ['https://static-cdn.jtvnw.net/xqc.png', 'https://static-cdn.jtvnw.net/caseoh_.png', '']);
  assert.equal(calls.length, 1, 'batched');
  assert.match(calls[0].body, /login:\\"xqc\\"/, 'logins are lower-cased and JSON-quoted');
  assert.equal(await a.get('twitch', 'xqc'), 'https://static-cdn.jtvnw.net/xqc.png');
  assert.equal(await a.get('twitch', 'ghost'), '', 'no-picture answer is cached too');
  assert.equal(calls.length, 1, 'cache hit');
});

test('Kick: per-viewer lookup (null picture → empty), bad ids and other platforms are ignored, failures are not cached', async () => {
  let n = 0, fail = true;
  const fetch = async url => {
    n++;
    if (url.endsWith('/topdon-79')) return json(200, { user: { profile_pic: 'https://files.kick.com/images/user/1/p.webp' } });
    if (url.endsWith('/nopic')) return json(200, { user: { profile_pic: null } });
    if (url.endsWith('/flaky')) { if (fail) { fail = false; throw new Error('net'); } return json(200, { user: { profile_pic: 'https://files.kick.com/f.webp' } }); }
    return json(404, {});
  };
  const a = createAvatars({ fetch });
  assert.equal(await a.get('kick', 'topdon-79'), 'https://files.kick.com/images/user/1/p.webp');
  assert.equal(await a.get('kick', 'nopic'), '');
  assert.equal(await a.get('kick', '../etc'), '');
  assert.equal(await a.get('youtube', 'x'), '');
  assert.equal(await a.get('kick', 'flaky'), '', 'network error → no picture this time');
  assert.equal(await a.get('kick', 'flaky'), 'https://files.kick.com/f.webp', 'and it is retried next time');
  const before = n; await a.get('kick', 'topdon-79'); assert.equal(n, before, 'cached');
});

test('within(): chat is never held longer than the limit', async () => {
  const t0 = Date.now();
  assert.equal(await within(new Promise(() => {}), 50), '');
  assert.ok(Date.now() - t0 < 500);
  assert.equal(await within(Promise.resolve('u'), 50), 'u');
});
