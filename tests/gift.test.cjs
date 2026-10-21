'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime, validateState, defaultState } = require('../electron/runtime.cjs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { request } = require('./helpers/qa-helpers.cjs');
/** Runtime in a temp dir; closed BEFORE the dir is removed (pending writes must finish first). */
async function runtime(t) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'allhouse-gift-'));
  const rt = await createRuntime({ dataDir: dir, port: 0 });
  t.after(async () => { await rt.close(); await fsp.rm(dir, { recursive: true, force: true }); });
  return rt;
}

test('gift widget: older v2 workspaces gain a default gift widget; its fields are validated', () => {
  const old = defaultState();
  delete old.draftWidgets.gift; delete old.publishedWidgets.gift;
  old.draftWidgets.follow.accent = '#123456';
  const v = validateState(old);
  assert.equal(v.draftWidgets.gift.minCoins, 1);
  assert.equal(v.draftWidgets.gift.accent, '#123456');
  assert.equal(v.publishedWidgets.gift.template, '{name} sent {gift} ×{count}');
  const bad = defaultState(); bad.draftWidgets.gift.minCoins = -5;
  assert.throws(() => validateState(bad), /gift/);
});

test('gift events: sanitised details, minimum coins filter for live gifts, tests always alert', async t => {
  const rt = await runtime(t);
  const s = rt.getState(); s.publishedWidgets.gift.minCoins = 10; await rt.saveState(s);
  const small = rt.ingestLive({ platform: 'tiktok', type: 'gift', name: 'a', message: 'Rose ×5', gift: { name: 'Rose', count: 5, coins: 1, image: 'https://evil.example/x.png' } });
  assert.equal(small.status, 'completed', '5 coins < 10: feed only, no OBS alert');
  assert.equal(small.gift.image, '', 'non-TikTok image hosts are dropped');
  const big = rt.ingestLive({ platform: 'tiktok', type: 'gift', name: 'b', message: 'Lion', gift: { name: 'Lion<script>', count: 1, coins: 29999, image: 'https://p16-webcast.tiktokcdn.com/lion.png' } });
  assert.ok(['queued', 'playing'].includes(big.status));
  assert.equal(big.gift.image, 'https://p16-webcast.tiktokcdn.com/lion.png');
  assert.equal(big.gift.name, 'Lion<script>', 'kept as text; the widget sets it with textContent');
  const testGift = await rt.sendEvent({ platform: 'tiktok', type: 'gift', name: 'Tester', message: 'Rose ×1', target: 'obs' });
  assert.deepEqual(testGift.gift, { name: 'Rose', count: 1, coins: 1, image: '' });
  assert.equal(testGift.delivery.widget, 'gift');
});

test('gift widget page: own CSP allows only TikTok CDN images; other widgets stay data:-only', async t => {
  const rt = await runtime(t);
  const urls = rt.getStatus().widgetUrls;
  const gift = await request(urls.gift, { headers: { Host: new URL(urls.gift).host } });
  const follow = await request(urls.follow, { headers: { Host: new URL(urls.follow).host } });
  assert.equal(gift.status, 200);
  assert.match(gift.body, /img-src data: https:\/\/\*\.tiktokcdn\.com/);
  assert.match(gift.body, /\{gift\\\}/, 'gift placeholders are rendered by the page');
  assert.doesNotMatch(follow.body, /tiktokcdn/);
});
