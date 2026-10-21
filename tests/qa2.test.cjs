// QA round 2 (Super Tester): regression of the round-2 fixes and new behaviour
// (two alert lanes, import-as-draft, hide-alert, TEST CHAT tag, corrupt-file backup, browser fallback).
// Tests marked { todo: 'R2-BUG-n ...' } reproduce open bugs listed in tests/QA-REPORT.md "Round 2".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const { createRuntime, defaultState, cleanHistoryEntry } = require('../electron/runtime.cjs');
const { delay, tmpDir, fixture, sample, request, stream, runOverlay } = require('./helpers/qa-helpers.cjs');

const kinds = events => events.map(e => e.kind);
const alerts = events => events.filter(e => e.kind === 'alert');

// ---------------------------------------------------------------- BUG-9 (strengthened)
test('R2 BUG-9: corrupt workspace is backed up byte-for-byte, the warning names a file that exists, and it survives sample/save', async t => {
  const dir = await tmpDir(t);
  const file = path.join(dir, 'workspace.json');
  const corrupt = '{"schemaVersion":1,"workspaceName":"my real room ห้องจริง" ...truncated';
  await fs.writeFile(file, corrupt);
  const setup = await fixture(t, dir);
  const warning = setup.runtime.getStatus().storageWarning;
  const named = warning.match(/workspace\.corrupt-[\w-]+\.json/)?.[0];
  assert.ok(named, 'warning names the backup file: ' + warning);
  assert.equal(await fs.readFile(path.join(dir, named), 'utf8'), corrupt, 'backup content is identical to the original');
  await setup.runtime.sendEvent(sample());
  await setup.runtime.saveState(defaultState());
  assert.equal(await fs.readFile(path.join(dir, named), 'utf8'), corrupt, 'backup is never overwritten');
  // A second launch on a still-corrupt file makes a second, distinct backup instead of failing.
  await fs.writeFile(file, corrupt);
  await delay(5);
  const rt2 = await setup.restart();
  const named2 = rt2.getStatus().storageWarning.match(/workspace\.corrupt-[\w-]+\.json/)?.[0];
  assert.ok(named2 && named2 !== named);
  assert.equal((await fs.readdir(dir)).filter(f => f.startsWith('workspace.corrupt-')).length, 2);
});

test('R2 BUG-9: a valid JSON file that fails validation is also backed up (not silently replaced)', async t => {
  const dir = await tmpDir(t);
  const bad = JSON.stringify({ ...defaultState(), theme: 'purple' });
  await fs.writeFile(path.join(dir, 'workspace.json'), bad);
  const { runtime } = await fixture(t, dir);
  const named = runtime.getStatus().storageWarning.match(/workspace\.corrupt-[\w-]+\.json/)?.[0];
  assert.ok(named);
  assert.equal(await fs.readFile(path.join(dir, named), 'utf8'), bad);
});

// ---------------------------------------------------------------- BUG-1 / BUG-2 (real overlay script, every SSE event fed in)
test('R2 BUG-1: overlay chat row carries a TEST CHAT tag, still rendered as text', async t => {
  const { runtime } = await fixture(t);
  const overlay = runOverlay((await request(runtime.url)).body);
  overlay.emit('state', runtime.getState().published);
  overlay.emit('chat', await runtime.sendEvent(sample({ target: 'obs', name: '<i class=tag>x</i>' })));
  const row = overlay.ids.chat.children[0];
  assert.match(row.textContent, /TEST CHAT/);
  assert.ok(row.textContent.startsWith('<i class=tag>x</i> · Twitch'));
  assert.ok(row.children.every(c => c._html === null));
});

test('R2 BUG-2: skip and clear hide only the alert; chat rows survive; only Clear history wipes chat', async t => {
  const { runtime } = await fixture(t);
  const overlay = runOverlay((await request(runtime.url)).body);
  const events = await stream(t, runtime);
  overlay.emit('state', runtime.getState().published);
  await runtime.sendEvent(sample({ target: 'obs', message: 'keep me' }));
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs' }));
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs' }));
  await delay(20);
  await runtime.controlQueue('skip');
  await delay(20);
  await runtime.controlQueue('clear');
  await delay(20);
  overlay.feed(events.slice(1));
  assert.ok(overlay.ids.chat.textContent.includes('keep me'), 'chat survives skip + clear');
  assert.ok(overlay.ids.alert.classList.contains('hidden'), 'alert hidden after clear');
  assert.ok(kinds(events).includes('hide-alert'));
  assert.ok(!kinds(events).includes('clear'));
  const before = events.length;
  await runtime.controlQueue('clearHistory');
  await delay(20);
  overlay.feed(events.slice(before));
  assert.equal(overlay.ids.chat.children.length, 0, 'Clear history wipes the overlay chat');
});

// ---------------------------------------------------------------- BUG-3 lanes
test('R2 BUG-3: preview and OBS lanes run independently; pause holds both; resume restarts both', async t => {
  const { runtime } = await fixture(t);
  const events = await stream(t, runtime);
  const status = () => runtime.getHistory().map(e => e.target + ':' + e.status);
  await runtime.sendEvent(sample({ type: 'follow', target: 'preview', name: 'p1' }));
  await runtime.sendEvent(sample({ type: 'follow', target: 'preview', name: 'p2' }));
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs', name: 'o1' }));
  await delay(20);
  assert.deepEqual(status(), ['preview:playing', 'preview:queued', 'obs:playing']);
  assert.equal(alerts(events).length, 1);
  assert.equal(alerts(events)[0].data.name, 'o1');
  assert.ok(alerts(events).every(e => e.data.target === 'obs'), 'preview alerts never reach OBS');
  await runtime.controlQueue('skip'); // OBS first
  assert.deepEqual(status(), ['preview:playing', 'preview:queued', 'obs:skipped']);
  await runtime.controlQueue('skip'); // then the playing preview alert
  assert.deepEqual(status(), ['preview:skipped', 'preview:playing', 'obs:skipped']);
  await runtime.controlQueue('pause');
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs', name: 'o2' }));
  await delay(20);
  assert.equal(alerts(events).length, 1, 'paused: nothing new plays');
  assert.equal(runtime.getStatus().queue, 2);
  await runtime.controlQueue('resume');
  await delay(20);
  assert.equal(alerts(events).length, 2);
  await runtime.controlQueue('clear');
  assert.equal(runtime.getStatus().queue, 0);
  assert.ok(runtime.getHistory().every(e => ['skipped', 'completed'].includes(e.status)));
});

test('R2 BUG-3: skip while paused with nothing playing skips the oldest queued alert (any lane)', async t => {
  const { runtime } = await fixture(t);
  await runtime.controlQueue('pause');
  await runtime.sendEvent(sample({ type: 'follow', target: 'preview', name: 'p' }));
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs', name: 'o' }));
  await runtime.controlQueue('skip');
  assert.deepEqual(runtime.getHistory().map(e => e.name + ':' + e.status), ['p:skipped', 'o:queued']);
  await runtime.controlQueue('clear');
});

test('R2 BUG-3: restart with both lanes playing marks both interrupted and replays nothing', async t => {
  const setup = await fixture(t);
  await setup.runtime.sendEvent(sample({ type: 'follow', target: 'preview' }));
  await setup.runtime.sendEvent(sample({ type: 'subscription', target: 'obs' }));
  const rt = await setup.restart();
  const events = await stream(t, rt);
  await delay(50);
  assert.deepEqual(rt.getHistory().map(e => e.status), ['interrupted', 'interrupted']);
  assert.deepEqual(kinds(events), ['state']);
});

test('R2 BUG-3: lane timers advance each lane independently (per-widget durationSec)', { timeout: 15000 }, async t => {
  const { runtime } = await fixture(t);
  const st = runtime.getState(); for (const w of ['draftWidgets', 'publishedWidgets']) st[w].follow.durationSec = 2; await runtime.saveState(st);
  const events = await stream(t, runtime);
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs', name: 'o1' }));
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs', name: 'o2' }));
  await runtime.sendEvent(sample({ type: 'follow', target: 'preview', name: 'p1' }));
  await delay(2300);
  assert.deepEqual(alerts(events).map(e => e.data.name), ['o1', 'o2']);
  assert.deepEqual(runtime.getHistory().map(e => e.name + ':' + e.status), ['o1:completed', 'o2:playing', 'p1:completed']);
  await runtime.controlQueue('clear');
});

// ---------------------------------------------------------------- BUG-4
test('R2 BUG-4: only a change of the published scene is broadcast; preference and speech saves are silent', async t => {
  const { runtime } = await fixture(t);
  const events = await stream(t, runtime);
  const s = runtime.getState();
  Object.assign(s, { language: 'en', theme: 'light', workspaceName: 'x' }); s.tts.rate = 1.5; s.draft.accent = '#123456';
  await runtime.saveState(s);
  await runtime.saveState(s); // identical save
  await delay(20);
  assert.deepEqual(kinds(events), ['state']);
  s.published = structuredClone(s.draft);
  const fresh = await runtime.saveState(s);
  await runtime.saveState(fresh); // re-saving the same published layout does not re-broadcast
  await delay(20);
  assert.deepEqual(kinds(events), ['state', 'state']);
  assert.equal(events[1].data.accent, '#123456');
});

// ---------------------------------------------------------------- BUG-5 / BUG-6 import
test('R2 BUG-5: import lands as draft; published and publishedAt untouched; Publish then goes live', async t => {
  const { runtime } = await fixture(t);
  const s = runtime.getState(); s.draft.title = 'LIVE'; s.published = structuredClone(s.draft); s.publishedAt = '2026-10-20T00:00:00.000Z';
  await runtime.saveState(s);
  const events = await stream(t, runtime);
  const imp = defaultState(); imp.draft.title = 'BACKUP DRAFT'; imp.published.title = 'BACKUP PUBLISHED';
  const result = await runtime.importState(imp);
  await delay(20);
  assert.ok(['BACKUP DRAFT', 'BACKUP PUBLISHED'].includes(result.draft.title), 'draft comes from the backup: ' + result.draft.title);
  assert.equal(result.published.title, 'LIVE');
  assert.equal(result.publishedAt, '2026-10-20T00:00:00.000Z');
  assert.deepEqual(kinds(events), ['state']);
  result.published = structuredClone(result.draft);
  await runtime.saveState(result);
  await delay(20);
  assert.equal(events.at(-1).data.title, result.draft.title);
});

test('R2-BUG-1 import keeps only one of the two backed-up layouts (draft and published); the other is silently lost', async t => {
  const { runtime } = await fixture(t);
  const imp = defaultState(); imp.draft.title = 'HALF-EDITED DRAFT'; imp.published.title = 'THE LAYOUT I STREAM WITH';
  const result = JSON.stringify(await runtime.importState(imp));
  assert.ok(result.includes('HALF-EDITED DRAFT') && result.includes('THE LAYOUT I STREAM WITH'), 'both backed-up layouts should survive import (or the user should be told)');
});

test('R2 BUG-6: import name suffix never stacks and never exceeds 80 characters', async t => {
  const { runtime } = await fixture(t);
  for (const name of ['Room (imported) (imported)', 'x'.repeat(80), 'ห้อง'.repeat(20), 'Room (imported)  (imported)', '(imported)']) {
    const imp = defaultState(); imp.workspaceName = name;
    const r = await runtime.importState(imp);
    assert.ok(r.workspaceName.length <= 80, name + ' -> ' + r.workspaceName.length);
    assert.equal(r.workspaceName.match(/\(imported\)/g).length, name === '(imported)' ? 2 : 1, name + ' -> ' + r.workspaceName);
    await runtime.importState(r);
    assert.equal(runtime.getState().workspaceName, r.workspaceName, 're-import is idempotent');
  }
});

// ---------------------------------------------------------------- BUG-7
test('R2 BUG-7: cleanHistoryEntry keeps only known fields and normalises bad values', () => {
  const base = { id: 'a', platform: 'kick', type: 'chat', name: 'n', message: 'm', target: 'obs', status: 'completed', createdAt: 'x'.repeat(100) };
  const ok = cleanHistoryEntry({ ...base, injected: 'x', token: 'secret', sourceMode: 'pwned' });
  assert.deepEqual(Object.keys(ok).sort(), ['createdAt', 'id', 'message', 'name', 'platform', 'sourceMode', 'status', 'target', 'type']);
  assert.equal(ok.sourceMode, 'test', 'unknown sourceMode values fall back to "test"');
  // Real platform events (round 5) are stored as 'live' and must survive a restart as such. History is never re-broadcast to OBS.
  assert.equal(cleanHistoryEntry({ ...base, sourceMode: 'live' }).sourceMode, 'live');
  assert.equal(ok.createdAt.length, 40);
  assert.equal(cleanHistoryEntry({ ...base, status: 'pwned' }).status, 'completed');
  assert.equal(cleanHistoryEntry({ ...base, status: 'playing' }).status, 'interrupted');
  for (const bad of [null, 'x', [], { ...base, id: 'x'.repeat(65) }, { ...base, id: 5 }, { ...base, platform: 'x' }, { ...base, name: 'x'.repeat(81) }, { ...base, target: 'live' }])
    assert.equal(cleanHistoryEntry(bad), null);
});

// ---------------------------------------------------------------- BUG-8
test('R2 BUG-8: chat still works with a full alert queue; the 51st alert is refused', async t => {
  const { runtime } = await fixture(t);
  await runtime.controlQueue('pause');
  for (let i = 0; i < 50; i++) await runtime.sendEvent(sample({ type: 'follow', target: i % 2 ? 'obs' : 'preview' }));
  await assert.rejects(runtime.sendEvent(sample({ type: 'subscription', target: 'preview' })), /full/);
  await runtime.sendEvent(sample({ target: 'obs', message: 'chat ok' }));
  assert.equal(runtime.getStatus().queue, 50);
  await runtime.controlQueue('clear');
});

// ---------------------------------------------------------------- Browser fallback (src/api.ts), Grumpy #12
function loadFallback({ storageFull = false, saved } = {}) {
  const ts = require('typescript');
  const src = require('node:fs').readFileSync(path.join(__dirname, '../src/api.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const store = new Map(saved ? [['allhouse-preview', saved]] : []);
  const timers = [];
  const ctx = {
    exports: {}, window: {}, structuredClone, crypto: require('node:crypto'), JSON, Error, Promise, Math, Date, String, Number, Array, Object,
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => { if (storageFull) throw new Error('QuotaExceededError'); store.set(k, v); } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: id => { if (timers[id - 1]) timers[id - 1].fn = null; },
  };
  ctx.module = { exports: ctx.exports };
  vm.runInNewContext(js, ctx);
  const runTimers = () => { const due = timers.splice(0); for (const t of due) if (t.fn) t.fn(); };
  return { ...ctx.exports, store, runTimers };
}

test('Browser fallback: no desktop bridge -> fallback API with validation, queue cap and 5 s alert lifecycle', async () => {
  const fb = loadFallback();
  assert.equal(fb.desktop, false);
  const api = fb.api;
  await assert.rejects(api.sendEvent({ platform: 'twitch', type: 'chat', name: '  ', message: 'x', target: 'preview' }), /Invalid/);
  await assert.rejects(api.sendEvent({ platform: 'twitch', type: 'chat', name: 'n', message: 'x'.repeat(501), target: 'preview' }), /Invalid/);
  const chat = await api.sendEvent({ platform: 'twitch', type: 'chat', name: ' n ', message: ' hi ', target: 'preview' });
  assert.deepEqual([chat.name, chat.message, chat.status, chat.sourceMode], ['n', 'hi', 'completed', 'test']);
  await api.sendEvent({ platform: 'kick', type: 'follow', name: 'a', message: 'f', target: 'preview' });
  await api.sendEvent({ platform: 'kick', type: 'follow', name: 'b', message: 'f', target: 'preview' });
  let h = await api.getHistory();
  assert.deepEqual(h.map(e => e.status), ['completed', 'playing', 'queued']);
  assert.equal((await api.getStatus()).queue, 2);
  fb.runTimers(); // 5 s elapse
  h = await api.getHistory();
  assert.deepEqual(h.map(e => e.status), ['completed', 'completed', 'playing']);
  await api.controlQueue('pause'); fb.runTimers();
  await api.sendEvent({ platform: 'kick', type: 'follow', name: 'c', message: 'f', target: 'preview' });
  assert.equal((await api.getStatus()).paused, true);
  await api.controlQueue('skip');
  assert.deepEqual((await api.getHistory()).map(e => e.status), ['completed', 'completed', 'completed', 'skipped']);
  await api.controlQueue('clearHistory');
  assert.deepEqual(await api.getHistory(), []);
  // persisted to localStorage
  assert.ok(JSON.parse(fb.store.get('allhouse-preview')).history);
  await assert.rejects(api.importBackup(), /desktop app/);
});

test('Browser fallback: storage-full is reported as a warning instead of crashing; corrupt saved data falls back to defaults', async () => {
  const full = loadFallback({ storageFull: true });
  const s = await full.api.getState(); s.workspaceName = 'x';
  await full.api.saveState(s);
  assert.match((await full.api.getStatus()).storageWarning, /storage is full/);
  const corrupt = loadFallback({ saved: '{not json' });
  assert.equal((await corrupt.api.getState()).workspaceName, 'My streaming room');
});

test('Browser fallback: errorText strips the Electron IPC prefix', () => {
  const { errorText } = loadFallback();
  assert.equal(errorText(new Error("Error invoking remote method 'house:event': Error: Queue is full (50)")), 'Queue is full (50)');
  assert.equal(errorText('plain'), 'plain');
});

test('R2-BUG-2 browser fallback still refuses chat when 50 alerts are queued (desktop fixed in BUG-8, fallback not)', async () => {
  const { api } = loadFallback();
  await api.controlQueue('pause');
  for (let i = 0; i < 50; i++) await api.sendEvent({ platform: 'kick', type: 'follow', name: 'a', message: 'f', target: 'preview' });
  await api.sendEvent({ platform: 'kick', type: 'chat', name: 'a', message: 'chat ok', target: 'preview' });
});

test('R2-BUG-3 browser fallback saveState accepts invalid state the desktop would reject', async () => {
  const { api } = loadFallback();
  const s = await api.getState(); s.draft.width = 100000; s.theme = 'javascript';
  await assert.rejects(api.saveState(s));
});

// ---------------------------------------------------------------- Dev B round 3: wording, no-drag, delivery result
test('Overlay: capitalised platform names and TEST labels in chat and alert; nothing selectable or draggable', async t => {
  const { runtime } = await fixture(t);
  const html = (await request(runtime.url)).body;
  assert.match(html, /\*\{[^}]*user-select:none[^}]*-webkit-user-drag:none/);
  assert.match(html, /img\{object-fit:contain\}/);
  const overlay = runOverlay(html);
  overlay.emit('state', runtime.getState().published);
  for (const [p, name] of [['youtube', 'YouTube'], ['twitch', 'Twitch'], ['kick', 'Kick'], ['tiktok', 'TikTok']]) {
    overlay.emit('chat', await runtime.sendEvent(sample({ platform: p, target: 'obs', name: 'n' })));
    assert.match(overlay.ids.chat.children.at(-1).textContent, new RegExp('^n · ' + name + 'TEST CHAT'));
    overlay.emit('alert', { platform: p, name: 'n', message: 'm' });
    assert.match(overlay.ids.alert.textContent, new RegExp('^TEST ALERT · ' + name));
  }
});

test('components.tsx: preview uses the same capitalised names / TEST labels and blocks dragging', async () => {
  const src = await fs.readFile(path.join(__dirname, '../src/components.tsx'), 'utf8');
  assert.match(src, /TEST ALERT · \{platformNames\[/);
  assert.match(src, /TEST CHAT/);
  assert.doesNotMatch(src, /toUpperCase\(\)/);
  assert.match(src, /<img[^>]*draggable=\{false\}/);
  assert.match(src, /<svg[^>]*\{\.\.\.noDrag\}/);
});

test('sendEvent reports what OBS will actually show (delivery.reason)', async t => {
  const { runtime } = await fixture(t);
  const reason = async (extra) => (await runtime.sendEvent(sample(extra))).delivery;
  assert.deepEqual(await reason({ type: 'follow' }), { widget: 'follow', overlays: 0, widgetPages: 0, legacyPages: 0, delivered: false, reason: 'app-only' });
  assert.equal((await reason({ type: 'follow', target: 'obs' })).reason, 'no-overlay');
  await runtime.controlQueue('clear');
  await stream(t, runtime);
  assert.deepEqual(await reason({ type: 'follow', target: 'obs' }), { widget: 'follow', overlays: 1, widgetPages: 0, legacyPages: 1, delivered: true, reason: 'shown' });
  assert.equal((await reason({ type: 'follow', target: 'obs' })).reason, 'queued', 'behind the playing alert');
  await runtime.controlQueue('clear');
  await runtime.controlQueue('pause');
  assert.equal((await reason({ type: 'subscription', target: 'obs' })).reason, 'paused');
  await runtime.controlQueue('resume'); await runtime.controlQueue('clear');
  await runtime.controlQueue('mute');
  assert.equal((await reason({ type: 'follow', target: 'obs' })).reason, 'muted');
  await runtime.controlQueue('unmute'); await runtime.controlQueue('clear');
  assert.deepEqual(await reason({ target: 'obs' }), { widget: 'chat', overlays: 1, widgetPages: 0, legacyPages: 1, delivered: true, reason: 'shown' });
  let s = runtime.getState(); s.published.showAlert = false; s.published.showChat = false; s = await runtime.saveState(s);
  assert.equal((await reason({ type: 'follow', target: 'obs' })).reason, 'alerts-hidden');
  assert.equal((await reason({ target: 'obs' })).reason, 'chat-hidden');
  s.draft.showAlert = true; await runtime.saveState(s); // a draft change alone does not count
  assert.equal((await reason({ type: 'follow', target: 'obs' })).reason, 'alerts-hidden');
  assert.equal(runtime.getHistory().some(e => 'delivery' in e), false, 'delivery is not persisted in history');
  await runtime.controlQueue('clear');
});
