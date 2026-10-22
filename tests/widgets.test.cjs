// Round 4 (Dev B): OBS widgets — schema v2, migration, validation, /w/<token>/<id> pages, routing, delivery.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { createRuntime, validateState, defaultState, defaultWidgets, validateWidgets, WIDGET_IDS } = require('../electron/runtime.cjs');
const { delay, tmpDir, fixture, sample, request, runOverlay } = require('./helpers/qa-helpers.cjs');

const tokenOf = rt => rt.url.split('/').pop();
const v1State = () => ({ schemaVersion: 1, workspaceName: 'Old room', language: 'th', theme: 'dark', onboarded: true,
  draft: { title: 'OLD DRAFT', subtitle: 'sub', accent: '#ff0066', template: 'neon', showChat: false, showAlert: true, width: 1280, height: 720, image: '' },
  published: { title: 'OLD LIVE', subtitle: 'live sub', accent: '#00aaff', template: 'minimal', showChat: true, showAlert: false, width: 1920, height: 1080, image: 'data:image/png;base64,AAAA' },
  publishedAt: '2026-10-01T00:00:00.000Z', tts: { enabled: false, rate: 1, volume: 0.8, thaiVoice: '', englishVoice: '' }, history: [] });

// SSE client for one widget (or legacy when w is null)
function sse(t, runtime, w) {
  const events = []; let pending = '';
  const url = runtime.url.replace('/overlay/', '/events/') + (w ? '?w=' + w : '');
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      if (res.statusCode !== 200) return resolve({ status: res.statusCode, events });
      res.setEncoding('utf8');
      res.on('data', chunk => {
        pending += chunk; let i;
        while ((i = pending.indexOf('\n\n')) >= 0) {
          const block = pending.slice(0, i); pending = pending.slice(i + 2);
          const kind = block.match(/^event: (.+)$/m)?.[1], data = block.match(/^data: (.+)$/m)?.[1];
          if (kind && data) events.push({ kind, data: JSON.parse(data) });
        }
        if (events.length) resolve({ status: 200, events });
      });
      t.after(() => res.destroy());
    });
    req.on('error', reject); t.after(() => req.destroy());
  });
}

// Fake DOM able to run a widget page script (text nodes + Audio), throwing on any HTML parsing API.
class Node_ {
  constructor(tag, text) { this.tagName = tag; this.children = []; this._text = text ?? ''; this.className = ''; this.src = ''; this.parent = null; this.style = { setProperty: (k, v) => { this.style[k] = v; } };
    const set = new Set(); this.classList = { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c), toggle: (c, f) => (f ?? !set.has(c)) ? set.add(c) : set.delete(c) }; }
  set textContent(v) { this.children = []; this._text = String(v); }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set innerHTML(v) { throw new Error('innerHTML used: ' + v); }
  insertAdjacentHTML() { throw new Error('insertAdjacentHTML used'); }
  append(...n) { for (const x of n) { x.parent = this; this.children.push(x); } }
  replaceChildren(...n) { this.children = []; this._text = ''; this.append(...n); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  get firstChild() { return this.children[0]; }
}
function runWidget(html) {
  const script = html.match(/<script nonce="allhouse">([\s\S]*?)<\/script>/)[1];
  const ids = {}; for (const m of html.matchAll(/id="([a-z]+)"/g)) ids[m[1]] = new Node_('div');
  const listeners = {}, sounds = [], timers = []; let esUrl;
  class EventSource { constructor(u) { esUrl = u; } addEventListener(k, fn) { listeners[k] = fn; } }
  class Audio { constructor(src) { this.src = src; this.volume = 1; this.paused = true; sounds.push(this); } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } }
  const document = { getElementById: id => ids[id], createElement: tag => new Node_(tag), createTextNode: t => new Node_('#text', t), write() { throw new Error('document.write'); } };
  vm.runInNewContext(script, { document, EventSource, Audio, addEventListener() {}, innerWidth: 1920, innerHeight: 1080, setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {}, JSON, Math, Object, String, parseInt });
  return { ids, esUrl, sounds, timers, emit: (k, d) => listeners[k] && listeners[k]({ data: JSON.stringify(d) }), has: k => !!listeners[k] };
}
const allText = n => n.textContent;

// ------------------------------------------------------------------------------------------------ schema / migration
test('defaults are schema v2 with the four widgets and contract defaults', () => {
  const s = defaultState();
  assert.equal(s.schemaVersion, 2);
  assert.deepEqual(Object.keys(s.draftWidgets), WIDGET_IDS);
  assert.deepEqual([s.draftWidgets.chat.width, s.draftWidgets.chat.height], [800, 1080]);
  for (const id of ['follow', 'subscription']) {
    const a = s.draftWidgets[id];
    assert.deepEqual([a.width, a.height, a.durationSec, a.animation, a.volume], [1920, 1080, 6, 'pop', 0.8]);
  }
  assert.equal(s.draftWidgets.follow.template, '{name} followed!');
  assert.equal(s.draftWidgets.subscription.template, '{name} subscribed!');
  assert.deepEqual(validateState(s), { ...s, history: [] });
});

test('v1 → v2 migration maps scene to banner, accents and enabled flags (draft and published separately)', () => {
  const v2 = validateState(v1State());
  assert.equal(v2.schemaVersion, 2);
  const d = v2.draftWidgets, p = v2.publishedWidgets;
  assert.deepEqual([d.banner.title, d.banner.subtitle, d.banner.accent, d.banner.template], ['OLD DRAFT', 'sub', '#ff0066', 'neon']);
  assert.deepEqual([p.banner.title, p.banner.template, p.banner.image], ['OLD LIVE', 'minimal', 'data:image/png;base64,AAAA']);
  assert.deepEqual([d.chat.accent, d.follow.accent, d.subscription.accent], ['#ff0066', '#ff0066', '#ff0066']);
  assert.deepEqual([d.chat.enabled, d.follow.enabled, d.subscription.enabled], [false, true, true]);
  assert.deepEqual([p.chat.enabled, p.follow.enabled, p.subscription.enabled], [true, false, false]);
  assert.equal(v2.widgetsPublishedAt, '2026-10-01T00:00:00.000Z');
  assert.equal(v2.published.title, 'OLD LIVE', 'legacy scenes are kept for /overlay');
  assert.equal(v2.draft.width, 1280);
});

test('v1 workspace.json on disk is migrated at startup and saved back as v2', async t => {
  const dir = await tmpDir(t);
  await fs.writeFile(path.join(dir, 'workspace.json'), JSON.stringify(v1State()));
  const { runtime } = await fixture(t, dir);
  assert.equal(runtime.getStatus().storageWarning, '');
  assert.equal(runtime.getState().publishedWidgets.banner.title, 'OLD LIVE');
  await runtime.saveState(runtime.getState());
  const disk = JSON.parse(await fs.readFile(path.join(dir, 'workspace.json'), 'utf8'));
  assert.equal(disk.schemaVersion, 2);
  assert.ok(disk.draftWidgets && disk.publishedWidgets);
});

test('v1 import is migrated; widgets land as draft; published widgets stay until Publish', async t => {
  const { runtime } = await fixture(t);
  const before = runtime.getState().publishedWidgets;
  const r = await runtime.importState(v1State());
  assert.equal(r.schemaVersion, 2);
  assert.equal(r.draftWidgets.banner.title, 'OLD DRAFT');
  assert.deepEqual(r.publishedWidgets, before);
  assert.equal(r.importedPublishedWidgets.banner.title, 'OLD LIVE', 'the backup\'s published widgets are kept for "load into draft"');
});

// ------------------------------------------------------------------------------------------------ validation
test('widget validation: every limit in the contract is enforced', () => {
  const ok = defaultWidgets();
  assert.doesNotThrow(() => validateWidgets(ok));
  const mutate = (id, patch) => { const w = defaultWidgets(); Object.assign(w[id], patch); return w; };
  const bad = [
    ['chat', { width: 319 }], ['chat', { height: 2161 }], ['chat', { width: 800.5 }], ['banner', { enabled: 'yes' }],
    ['chat', { fontSize: 13 }], ['chat', { fontSize: 73 }], ['chat', { maxMessages: 0 }], ['chat', { maxMessages: 21 }],
    ['chat', { lifetimeSec: 4 }], ['chat', { lifetimeSec: 601 }], ['chat', { bgOpacity: 1.1 }], ['chat', { bgOpacity: NaN }],
    ['chat', { accent: 'red' }], ['chat', { textColor: '#fff' }], ['chat', { newestAt: 'left' }], ['chat', { animation: 'spin' }], ['chat', { showPlatformIcon: 1 }],
    ['follow', { durationSec: 1 }], ['follow', { durationSec: 31 }], ['follow', { template: 'x'.repeat(121) }], ['follow', { template: 5 }],
    ['follow', { fontSize: 19 }], ['follow', { fontSize: 161 }], ['follow', { volume: 1.01 }], ['follow', { volume: -0.1 }], ['follow', { soundName: 'x'.repeat(121) }],
    ['subscription', { image: 'data:image/svg+xml;base64,PHN2Zz4=' }], ['subscription', { image: 'https://example.com/a.png' }],
    ['subscription', { image: 'data:image/png;base64,' + 'A'.repeat(4000000) }],
    ['follow', { sound: 'data:audio/x-msdownload;base64,AAAA' }], ['follow', { sound: 'data:text/html;base64,PHNjcmlwdD4=' }],
    ['follow', { sound: 'data:audio/mpeg;base64,AAAA<script>' }], ['follow', { sound: 'data:audio/mpeg;base64,' + 'A'.repeat(4000000) }],
    ['banner', { title: 'x'.repeat(121) }], ['banner', { subtitle: 'x'.repeat(201) }], ['banner', { template: 'retro' }], ['banner', { image: 'javascript:alert(1)' }],
  ];
  for (const [id, patch] of bad) assert.throws(() => validateWidgets(mutate(id, patch)), /Invalid widget/, id + ' ' + JSON.stringify(patch).slice(0, 60));
  assert.throws(() => validateWidgets({ ...ok, chat: undefined }));
  // allowed edge values
  for (const [id, patch] of [['chat', { lifetimeSec: 0 }], ['chat', { lifetimeSec: 600 }], ['follow', { image: 'data:image/gif;base64,R0lGOD==' }],
    ['follow', { sound: 'data:audio/ogg;base64,T2dn' }], ['subscription', { sound: 'data:audio/wav;base64,UklG' }], ['follow', { sound: 'data:audio/webm;base64,GkXf' }], ['follow', { template: '' }]])
    assert.doesNotThrow(() => validateWidgets(mutate(id, patch)), id + JSON.stringify(patch));
  // unknown fields are dropped
  const extra = defaultWidgets(); extra.follow.readMessageTts = true; extra.chat.onload = 'x'; extra.evil = {};
  const clean = validateWidgets(extra);
  assert.equal('readMessageTts' in clean.follow, false); assert.equal('onload' in clean.chat, false); assert.equal('evil' in clean, false);
});

test('workspace over 25 MB is rejected; invalid widget import leaves state untouched', async t => {
  const s = defaultState();
  const big = 'data:audio/mpeg;base64,' + 'A'.repeat(3999000);
  for (const w of ['draftWidgets', 'publishedWidgets']) for (const id of ['follow', 'subscription']) { s[w][id].sound = big; s[w][id].image = 'data:image/png;base64,' + 'A'.repeat(3999000); }
  assert.throws(() => validateState(s), /25 MB/);
  const { runtime } = await fixture(t);
  const before = runtime.getState();
  const bad = defaultState(); bad.draftWidgets.follow.sound = 'data:audio/x-evil;base64,AAAA';
  await assert.rejects(runtime.importState(bad), /sound/);
  await assert.rejects(runtime.saveState(bad), /sound/);
  assert.deepEqual(runtime.getState(), before);
});

// ------------------------------------------------------------------------------------------------ HTTP
test('widget pages: token, id, Host and method rules; transparent, nonce CSP with media-src data:, no selection', async t => {
  const { runtime } = await fixture(t);
  const st = runtime.getStatus(), origin = new URL(runtime.url).origin, token = tokenOf(runtime);
  assert.deepEqual(Object.keys(st.widgetUrls), WIDGET_IDS);
  assert.deepEqual(st.widgetClients, { chat: 0, follow: 0, subscription: 0, gift: 0, banner: 0 });
  for (const id of WIDGET_IDS) {
    assert.equal(st.widgetUrls[id], `${origin}/w/${token}/${id}`);
    const r = await request(st.widgetUrls[id]);
    assert.equal(r.status, 200); assert.equal(r.headers['cache-control'], 'no-store');
    assert.match(r.body, /background:transparent/); assert.match(r.body, /user-select:none/); assert.match(r.body, /media-src data:/);
    assert.match(r.body, /script-src 'nonce-allhouse'/); assert.doesNotMatch(r.body, /innerHTML|insertAdjacentHTML|document\.write|eval\(/);
    assert.equal((await request(st.widgetUrls[id], { headers: { Host: 'evil.example' } })).status, 403);
    assert.equal((await request(st.widgetUrls[id], { method: 'POST' })).status, 405);
  }
  for (const p of [`/w/${token}/overlay`, `/w/${token}/`, `/w/${token.slice(1)}x/chat`, `/w/${'0'.repeat(48)}/chat`, `/w/${token}/chat?x=1`, `/w/${token}/chat/`, `/w/${token}/CHAT`])
    assert.equal((await request(origin + p)).status, 404, p);
  const ev = runtime.url.replace('/overlay/', '/events/');
  for (const q of ['?w=evil', '?w=', '?w=chat&x=1', '?x=chat', '?w=__proto__'])
    assert.equal((await request(ev + q)).status, 404, q);
  assert.equal((await request(ev + '?w=chat', { headers: { Origin: 'https://evil.example' } })).status, 403);
});

test('SSE ?w=: each widget gets only its own published config; draft edits never reach it', async t => {
  const { runtime } = await fixture(t);
  const streams = {}; for (const id of WIDGET_IDS) streams[id] = await sse(t, runtime, id);
  for (const id of WIDGET_IDS) { assert.equal(streams[id].events[0].kind, 'state'); assert.deepEqual(streams[id].events[0].data, runtime.getState().publishedWidgets[id]); }
  assert.deepEqual(runtime.getStatus().widgetClients, { chat: 1, follow: 1, subscription: 1, gift: 1, banner: 1 });
  let s = runtime.getState(); s.draftWidgets.follow.template = 'DRAFT {name}'; s = await runtime.saveState(s);
  await delay(20);
  for (const id of WIDGET_IDS) assert.equal(streams[id].events.length, 1, 'draft edit is silent for ' + id);
  s.publishedWidgets = structuredClone(s.draftWidgets); s.widgetsPublishedAt = new Date().toISOString(); await runtime.saveState(s);
  await delay(20);
  assert.equal(streams.follow.events.length, 2); assert.equal(streams.follow.events[1].data.template, 'DRAFT {name}');
  for (const id of ['chat', 'subscription', 'banner']) assert.equal(streams[id].events.length, 1, 'unchanged widget ' + id + ' gets no state');
});

test('routing: follow → follow widget, subscription → subscription widget, chat → chat widget; legacy overlay gets all', async t => {
  const { runtime } = await fixture(t);
  const st = {}; for (const id of [...WIDGET_IDS, null]) st[id] = await sse(t, runtime, id);
  const kinds = id => st[id].events.slice(1).map(e => e.kind + ':' + (e.data.type || ''));
  await runtime.sendEvent(sample({ target: 'obs', name: 'c' }));
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs', name: 'f' }));
  await delay(20);
  await runtime.controlQueue('skip');
  await runtime.sendEvent(sample({ type: 'subscription', target: 'obs', name: 's' }));
  await runtime.sendEvent(sample({ type: 'follow', target: 'preview', name: 'p' })); // app-only: nowhere
  await delay(20);
  assert.deepEqual(kinds('chat'), ['chat:chat']);
  assert.deepEqual(kinds('follow'), ['alert:follow', 'hide-alert:']);
  assert.deepEqual(kinds('subscription'), ['alert:subscription']);
  assert.deepEqual(kinds('banner'), []);
  assert.deepEqual(kinds(null), ['chat:chat', 'alert:follow', 'hide-alert:', 'alert:subscription']);
  await runtime.controlQueue('clear');
});

test('a disabled (published) alert widget receives nothing and delivery says so; the queue still advances', async t => {
  const { runtime } = await fixture(t);
  let s = runtime.getState(); s.draftWidgets.follow.enabled = false; s.publishedWidgets = structuredClone(s.draftWidgets); s = await runtime.saveState(s);
  const f = await sse(t, runtime, 'follow');
  const d = (await runtime.sendEvent(sample({ type: 'follow', target: 'obs' }))).delivery;
  assert.deepEqual([d.widget, d.delivered, d.reason, d.widgetPages], ['follow', false, 'alerts-hidden', 1]);
  const sub = (await runtime.sendEvent(sample({ type: 'subscription', target: 'obs' }))).delivery;
  assert.equal(sub.reason, 'no-overlay', 'subscription page not open (follow page does not count)');
  await delay(20);
  assert.deepEqual(f.events.slice(1).map(e => e.kind), []);
  await runtime.controlQueue('clear');
});

test('delivery per widget: only the matching widget page counts', async t => {
  const { runtime } = await fixture(t);
  await sse(t, runtime, 'chat');
  assert.equal((await runtime.sendEvent(sample({ type: 'follow', target: 'obs' }))).delivery.reason, 'no-overlay');
  await runtime.controlQueue('clear');
  const c = (await runtime.sendEvent(sample({ target: 'obs' }))).delivery;
  assert.deepEqual([c.widget, c.delivered, c.reason, c.widgetPages, c.legacyPages], ['chat', true, 'shown', 1, 0]);
  await sse(t, runtime, 'subscription');
  const s = (await runtime.sendEvent(sample({ type: 'subscription', target: 'obs' }))).delivery;
  assert.deepEqual([s.widget, s.delivered, s.reason], ['subscription', true, 'shown']);
  await runtime.controlQueue('clear');
});

// ------------------------------------------------------------------------------------------------ widget page scripts (real HTML, fake DOM)
const page = async (rt, id) => runWidget((await request(rt.getStatus().widgetUrls[id])).body);

test('alert widget: template placeholders and hostile names render as text; image, sound at volume, duration, label', async t => {
  const { runtime } = await fixture(t);
  const w = runWidget((await request(runtime.getStatus().widgetUrls.follow)).body);
  assert.equal(w.esUrl, `/events/${tokenOf(runtime)}?w=follow`);
  const cfg = { ...defaultWidgets().follow, template: '<img src=x onerror=alert(1)> {name} via {platform}: {message} {unknown}', image: 'data:image/gif;base64,R0lGOD==', sound: 'data:audio/mpeg;base64,SUQz', volume: 0.35, durationSec: 9, animation: 'slide' };
  w.emit('state', cfg);
  w.emit('alert', { platform: 'tiktok', name: '<script>alert(2)</script>', message: '{name}<b>x</b>', type: 'follow' });
  const card = w.ids.wrap.children[0];
  assert.equal(w.ids.wrap.classList.contains('hidden'), false);
  assert.equal(card.className, 'anim-slide');
  const text = allText(card);
  assert.ok(text.includes('TEST ALERT · TikTok'));
  assert.ok(text.includes('<img src=x onerror=alert(1)> <script>alert(2)</script> via TikTok: {name}<b>x</b> {unknown}'), text);
  const img = card.children[0]; assert.equal(img.src, cfg.image); assert.equal(img.draggable, false);
  const spans = card.children.at(-1).children.filter(n => n.tagName === 'span');
  assert.deepEqual(spans.map(s => s.textContent), ['<script>alert(2)</script>', 'TikTok', '{name}<b>x</b>'], 'placeholders are not re-expanded inside values');
  assert.equal(w.sounds.length, 1); assert.equal(w.sounds[0].volume, 0.35); assert.equal(w.sounds[0].paused, false);
  assert.equal(w.timers.at(-1).ms, 9000);
  w.emit('hide-alert', {});
  assert.equal(w.ids.wrap.classList.contains('hidden'), true); assert.equal(w.sounds[0].paused, true, 'skip stops the sound');
  w.emit('state', { ...cfg, enabled: false }); w.emit('alert', { platform: 'kick', name: 'n', message: 'm' });
  assert.equal(w.ids.wrap.classList.contains('hidden'), true, 'disabled widget never shows');
  assert.equal(w.sounds.length, 1);
});

test('chat widget: options honoured (max messages, newest at top, icon toggle, lifetime, font size, TEST CHAT, text only)', async t => {
  const { runtime } = await fixture(t);
  const w = await page(runtime, 'chat');
  assert.equal(w.has('alert'), false, 'chat page has no alert handler');
  w.emit('state', { ...defaultWidgets().chat, maxMessages: 2, newestAt: 'top', showPlatformIcon: false, lifetimeSec: 0, fontSize: 40, animation: 'none' });
  for (const n of ['a', 'b', '<img src=x onerror=alert(1)>']) w.emit('chat', { platform: 'youtube', name: n, message: '<b>m</b>' });
  const box = w.ids.box;
  assert.equal(box.children.length, 2);
  assert.ok(box.classList.contains('top'));
  assert.equal(w.ids.scene.style['--fs'], '40px');
  assert.equal(allText(box.children[1]), '<img src=x onerror=alert(1)> · YouTubeTEST CHAT<b>m</b>');
  assert.ok(box.children.every(r => r.children.every(c => c.tagName !== 'img' && (c.children || []).every(x => x.tagName !== 'img'))), 'no platform icon');
  assert.equal(w.timers.length, 0, 'lifetime 0 = never hide');
  w.emit('state', { ...defaultWidgets().chat, lifetimeSec: 30, animation: 'pop' });
  w.emit('chat', { platform: 'kick', name: 'n', message: 'm' });
  assert.equal(w.timers.at(-1).ms, 30000);
  assert.equal(box.children.at(-1).className, 'chat anim-pop');
  assert.equal(box.children.at(-1).children[0].children[0].tagName, 'img', 'platform icon shown, inside the name line');
  // round 13: avatar (initial when no picture), platform-coloured names, one-line layout, platform name hidden
  w.emit('state', { ...defaultWidgets().chat, showAvatar: true, nameColor: 'platform', layout: 'inline', showPlatformName: false, showPlatformIcon: false, animation: 'none' });
  w.emit('chat', { platform: 'kick', name: '@mint', message: 'hi' });
  const row = box.children.at(-1);
  assert.ok(row.classList.contains('inline') && row.classList.contains('has-av'));
  assert.equal(row.children[0].className, 'av');
  assert.equal(row.children[0].textContent, 'M', 'first letter, @ dropped');
  assert.equal(row.style['--name'], '#53fc18', 'Kick green');
  assert.ok(!allText(row).includes('· Kick'), 'platform name hidden');
});

test('banner widget: title/subtitle as text, image, template class, hides when disabled', async t => {
  const { runtime } = await fixture(t);
  const w = await page(runtime, 'banner');
  w.emit('state', { ...defaultWidgets().banner, title: '<script>x</script>', subtitle: 'ซับ', template: 'neon', image: 'data:image/png;base64,AAAA' });
  assert.equal(w.ids.title.textContent, '<script>x</script>'); assert.equal(w.ids.subtitle.textContent, 'ซับ');
  assert.equal(w.ids.scene.className, 'neon'); assert.equal(w.ids.art.src, 'data:image/png;base64,AAAA');
  assert.equal(w.ids.art.classList.contains('hidden'), false);
  w.emit('state', { ...defaultWidgets().banner, enabled: false });
  assert.ok(w.ids.brand.classList.contains('hidden'));
});

// ------------------------------------------------------------------------------------------------ legacy
test('legacy /overlay still works: scene edits flow into widgets and widget edits flow into the legacy scene', async t => {
  const { runtime } = await fixture(t);
  const legacy = await sse(t, runtime, null), banner = await sse(t, runtime, 'banner');
  let s = runtime.getState(); s.draft.title = 'LEGACY EDIT'; s.published = structuredClone(s.draft); s = await runtime.saveState(s);
  assert.equal(s.publishedWidgets.banner.title, 'LEGACY EDIT');
  s.draftWidgets.banner.title = 'WIDGET EDIT'; s.draftWidgets.chat.enabled = false; s.publishedWidgets = structuredClone(s.draftWidgets); s = await runtime.saveState(s);
  assert.equal(s.published.title, 'WIDGET EDIT'); assert.equal(s.published.showChat, false);
  await delay(20);
  assert.deepEqual(legacy.events.map(e => e.data.title), ['WELCOME TO THE HOUSE', 'LEGACY EDIT', 'WIDGET EDIT']);
  assert.deepEqual(banner.events.map(e => e.data.title), ['WELCOME TO THE HOUSE', 'LEGACY EDIT', 'WIDGET EDIT']);
  const ov = runOverlay((await request(runtime.url)).body);
  ov.emit('state', s.published); assert.equal(ov.ids.title.textContent, 'WIDGET EDIT');
});

test('components.tsx WidgetPreview: exported, text-only template fill (same placeholder regex as the widget page), no HTML injection APIs', async () => {
  const src = await fs.readFile(path.join(__dirname, '../src/components.tsx'), 'utf8');
  const rt = await fs.readFile(path.join(__dirname, '../electron/runtime.cjs'), 'utf8');
  assert.match(src, /export function WidgetPreview\(\{widget,kind,event\}/);
  assert.match(src, /export function fillTemplateParts/);
  assert.doesNotMatch(src, /dangerouslySetInnerHTML|innerHTML/);
  assert.ok(src.includes(String.raw`split(/(\{name\}|\{platform\}|\{message\}|\{gift\}|\{count\}|\{coins\})/)`));
  assert.ok(rt.includes(String.raw`split(/(\\{name\\}|\\{platform\\}|\\{message\\}|\\{gift\\}|\\{count\\}|\\{coins\\})/)`), 'runtime widget page uses the same placeholder set');
  for (const label of ['TEST ALERT · {platformNames[', 'TEST CHAT']) assert.ok(src.includes(label), label);
  assert.match(src, /aspectRatio:`\$\{widget\.width\} \/ \$\{widget\.height\}`/);
});
