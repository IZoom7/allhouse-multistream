'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { createKickApi, pkce, mapChannel, updateBody, PORT } = require('../electron/kickApi.cjs');
const { tmpDir } = require('./helpers/qa-helpers.cjs');

const fakeSafe = { isEncryptionAvailable: () => true, encryptString: s => Buffer.from('ENC:' + Buffer.from(s).toString('hex')), decryptString: b => Buffer.from(b.toString().slice(4), 'hex').toString() };
const json = (status, body) => ({ ok: status < 400, status, json: async () => body });

/** A fake Kick: OAuth token endpoint + public API. Records requests. */
function fakeKick() {
  const seen = [];
  const fetch = async (url, o = {}) => {
    seen.push({ url, method: o.method || 'GET', body: o.body, auth: o.headers && o.headers.Authorization });
    if (url === 'https://id.kick.com/oauth/token') return json(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 7200 });
    if (url.endsWith('/users')) return json(200, { data: [{ user_id: 1, name: 'buckybee', profile_picture: 'https://files.kick.com/p.png' }] });
    if (url.endsWith('/channels') && (o.method || 'GET') === 'GET') return json(200, { data: [{ slug: 'buckybee', stream_title: 'old', category: { id: 5, name: 'Dead By Daylight', thumbnail: 't' }, stream: { key: 'SECRET-STREAM-KEY', language: 'Thai', is_mature: false, custom_tags: ['thai'] } }] });
    if (url.endsWith('/channels')) return { ok: true, status: 204, json: async () => ({}) };
    if (url.includes('/categories?q=')) return json(200, { data: [{ id: 9, name: 'Minecraft', thumbnail: 'm' }] });
    return json(404, { message: 'nope' });
  };
  return { fetch, seen };
}
const get = url => new Promise((res, rej) => http.get(url, r => { let b = ''; r.on('data', c => (b += c)); r.on('end', () => res({ status: r.statusCode, body: b })); }).on('error', rej));

test('PKCE: S256 challenge of the verifier; channel mapping never exposes the stream key; update body is validated', () => {
  const { verifier, challenge } = pkce();
  assert.equal(challenge, crypto.createHash('sha256').update(verifier).digest('base64url'));
  const c = mapChannel({ slug: 's', stream_title: 'x', stream: { key: 'SECRET', custom_tags: ['a', 7] } });
  assert.ok(!JSON.stringify(c).includes('SECRET'));
  assert.deepEqual(c.tags, ['a']);
  assert.deepEqual(updateBody({ title: '  hi ', categoryId: 3, tags: ['a', 'a', 'b'] }), { stream_title: 'hi', category_id: 3, custom_tags: ['a', 'b'] });
  for (const bad of [{}, { title: '' }, { title: 'x'.repeat(141) }, { categoryId: 0 }, { tags: Array(11).fill('t') }, { tags: [''] }, { title: 'a\u0000b' }])
    assert.throws(() => updateBody(bad), JSON.stringify(bad));
});

test('setup → sign-in through the local callback → read, search, save; secrets stored encrypted', async t => {
  const dir = await tmpDir(t);
  const k = fakeKick();
  let authorizeUrl = '';
  const kick = createKickApi({ dataDir: dir, fetch: k.fetch, safeStorage: fakeSafe, openExternal: async u => {
    authorizeUrl = u; const q = new URL(u).searchParams;
    setTimeout(async () => {
      assert.equal((await get(`http://127.0.0.1:${PORT}/kick/callback?code=C&state=wrong`)).status, 200, 'stray hit is ignored, login keeps waiting');
      await get(`http://127.0.0.1:${PORT}/kick/callback?code=C&state=${q.get('state')}`);
    }, 20);
  } });
  await kick.load();
  await assert.rejects(kick.login(), /developer app/);
  await assert.rejects(kick.setApp('id with space', 's'), /Client ID/);
  await kick.setApp('abcd1234efgh', 'TOP-SECRET-VALUE');
  const s = await kick.login();
  const q = new URL(authorizeUrl).searchParams;
  assert.equal(q.get('code_challenge_method'), 'S256');
  assert.equal(q.get('scope'), 'user:read channel:read channel:write');
  assert.equal(q.get('redirect_uri'), `http://localhost:${PORT}/kick/callback`);
  assert.deepEqual([s.loggedIn, s.user.name, s.clientId], [true, 'buckybee', 'abcd…efgh']);
  assert.ok(!JSON.stringify(s).includes('TOP-SECRET'), 'status never carries the secret');
  const tokenCall = k.seen.find(x => x.url.endsWith('/oauth/token'));
  assert.match(tokenCall.body, /code_verifier=/); assert.match(tokenCall.body, /client_secret=TOP-SECRET-VALUE/);
  const disk = await fs.readFile(path.join(dir, 'kick-auth.json'), 'utf8');
  assert.ok(!disk.includes('TOP-SECRET') && !disk.includes('"AT"') && !disk.includes('RT'), 'secret and tokens are encrypted on disk');

  const info = await kick.channel();
  assert.deepEqual([info.title, info.category.name, info.tags, info.language], ['old', 'Dead By Daylight', ['thai'], 'Thai']);
  assert.ok(!JSON.stringify(info).includes('SECRET-STREAM-KEY'));
  assert.deepEqual(await kick.categories('mine'), [{ id: 9, name: 'Minecraft', thumbnail: 'm' }]);
  await kick.update({ title: 'เดดบายรายวันครับ', categoryId: 9, tags: ['thai'] });
  const patch = k.seen.find(x => x.method === 'PATCH');
  assert.equal(patch.auth, 'Bearer AT');
  assert.deepEqual(JSON.parse(patch.body), { stream_title: 'เดดบายรายวันครับ', category_id: 9, custom_tags: ['thai'] });

  await kick.logout();
  assert.equal(kick.status().loggedIn, false);
  await kick.clear();
  assert.equal(kick.status().configured, false);
});

test('offline: empty official fields are filled from the last stream; a newer save from this app wins; only changed fields are sent', async t => {
  const dir = await tmpDir(t);
  const seen = [];
  const fetch = async (url, o = {}) => {
    seen.push({ url, method: o.method || 'GET', body: o.body });
    if (url.endsWith('/users')) return json(200, { data: [{ name: 'BuckyBee', profile_picture: '' }] });
    if (url === 'https://api.kick.com/public/v1/channels' && (o.method || 'GET') === 'GET') return json(200, { data: [{ slug: '', stream_title: '', category: null, stream: { language: '', custom_tags: [], key: 'K' } }] });
    if (url.endsWith('/channels')) return { ok: true, status: 204, json: async () => ({}) };
    if (url === 'https://kick.com/api/v1/channels/buckybee') return json(200, { livestream: null, previous_livestreams: [{ session_title: '🟢เดดบายรายวันครับ', created_at: '2026-10-20 13:05:52', language: 'Thai', is_mature: false, tags: ['thai'],
      categories: [{ id: 94, name: 'Dead By Daylight', banner: { url: 'https://files.kick.com/images/subcategories/94/banner/x.webp' } }] }] });
    return json(404, {});
  };
  const kick = createKickApi({ dataDir: dir, fetch, safeStorage: fakeSafe, openExternal: async () => {} });
  await kick.load(); await kick.setApp('abcd1234', 'S');
  // pretend we are signed in
  await fs.writeFile(path.join(dir, 'kick-auth.json'), JSON.stringify({ ...JSON.parse(await fs.readFile(path.join(dir, 'kick-auth.json'), 'utf8')),
    tokens: fakeSafe.encryptString(JSON.stringify({ access: 'AT', refresh: 'RT', exp: Date.now() + 3600e3 })).toString('base64'), user: { name: 'BuckyBee', picture: '' } }));
  await kick.load();
  const a = await kick.channel();
  assert.deepEqual([a.title, a.category.id, a.category.name, a.language, a.tags, a.filledFrom], ['🟢เดดบายรายวันครับ', 94, 'Dead By Daylight', 'Thai', ['thai'], 'last']);
  assert.ok(!JSON.stringify(a).includes('"K"'), 'no stream key');
  const b = await kick.update({ title: 'ชื่อใหม่' });
  assert.deepEqual(JSON.parse(seen.find(x => x.method === 'PATCH').body), { stream_title: 'ชื่อใหม่' }, 'only the changed field is sent');
  assert.deepEqual([b.title, b.category.name, b.filledFrom], ['ชื่อใหม่', 'Dead By Daylight', 'saved'], 'the newer save wins; untouched fields still come from the last stream');
});
