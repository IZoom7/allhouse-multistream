// QA round 1 — additional runtime gates (Super Tester).
// Tests marked { todo: 'BUG-n ...' } reproduce open bugs listed in tests/QA-REPORT.md:
// they run and report "# TODO" without failing the suite. Remove the todo flag once fixed.
// Round 2 (Super Dev): all 9 bugs fixed; todo flags removed so they are hard gates.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const vm = require('node:vm');
const { createRuntime, validateState, defaultState } = require('../electron/runtime.cjs');

const delay = ms => new Promise(r => setTimeout(r, ms));
async function tmpDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'allhouse-qa-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}
async function fixture(t, dir) {
  dir = dir || await tmpDir(t);
  let runtime = await createRuntime({ dataDir: dir, port: 0 });
  t.after(() => runtime.close());
  return {
    dir,
    get runtime() { return runtime; },
    async restart() { await runtime.close(); runtime = await createRuntime({ dataDir: dir, port: 0 }); return runtime; },
  };
}
const sample = (extra = {}) => ({ platform: 'twitch', type: 'chat', name: 'viewer', message: 'hello', target: 'preview', ...extra });
function request(url, { headers = {}, method = 'GET', raw } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { headers, method }, res => {
      let body = ''; res.setEncoding('utf8');
      res.on('data', c => { body += c; if (res.headers['content-type'] === 'text/event-stream') { req.destroy(); resolve({ status: res.statusCode, headers: res.headers, body }); } });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
}
// Raw TCP request so Host can be omitted / malformed exactly.
function rawRequest(port, text) {
  return new Promise((resolve, reject) => {
    const s = net.connect(port, '127.0.0.1', () => s.write(text));
    let out = ''; s.setEncoding('utf8');
    s.on('data', d => { out += d; if (/\r\n\r\n/.test(out)) { s.destroy(); resolve(out); } });
    s.on('error', reject); s.on('close', () => resolve(out));
  });
}
async function stream(t, runtime) {
  const events = [];
  let pending = '';
  await new Promise((resolve, reject) => {
    const req = http.get(runtime.url.replace('/overlay/', '/events/'), res => {
      assert.equal(res.statusCode, 200);
      res.setEncoding('utf8');
      res.on('data', chunk => {
        pending += chunk;
        let idx;
        while ((idx = pending.indexOf('\n\n')) >= 0) {
          const block = pending.slice(0, idx); pending = pending.slice(idx + 2);
          const kind = block.match(/^event: (.+)$/m)?.[1]; const data = block.match(/^data: (.+)$/m)?.[1];
          if (kind && data) events.push({ kind, data: JSON.parse(data) });
        }
        if (events.length) resolve();
      });
      t.after(() => res.destroy());
    });
    req.on('error', reject);
    t.after(() => req.destroy());
  });
  return events;
}

// ---- Minimal fake DOM to execute the real overlay <script> in a VM -------------------------
class El {
  constructor(tag, id) { this.tagName = tag.toUpperCase(); this.id = id; this.children = []; this._text = ''; this.style = { setProperty() {} }; this.className = ''; this.src = ''; this.parent = null; this._html = null;
    const set = new Set(); this.classList = { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c), toggle: (c, f) => (f ?? !set.has(c)) ? set.add(c) : set.delete(c) }; }
  set textContent(v) { this.children = []; this._text = String(v); }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set innerHTML(v) { this._html = String(v); throw new Error('innerHTML used: ' + v); }
  append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  replaceChildren() { this.children = []; this._text = ''; }
  get firstChild() { return this.children[0]; }
}
function runOverlay(html) {
  const script = html.match(/<script nonce="allhouse">([\s\S]*?)<\/script>/)[1];
  const ids = Object.fromEntries(['scene', 'brand', 'title', 'subtitle', 'art', 'chat', 'alert'].map(id => [id, new El('div', id)]));
  ids.alert.classList.add('hidden');
  const listeners = {}; let esUrl;
  class EventSource { constructor(u) { esUrl = u; } addEventListener(k, fn) { listeners[k] = fn; } }
  const ctx = { document: { getElementById: id => ids[id], createElement: tag => new El(tag) }, EventSource, addEventListener() {}, innerWidth: 1920, innerHeight: 1080, setTimeout: () => 0, clearTimeout() {}, JSON, Math };
  vm.runInNewContext(script, ctx);
  return { ids, esUrl, emit: (kind, data) => listeners[kind]({ data: JSON.stringify(data) }) };
}

// ---------------------------------------------------------------------------------------------
test('GATE loopback: overlay server is not reachable on a LAN interface address', async t => {
  const { runtime } = await fixture(t);
  const port = new URL(runtime.url).port;
  const lan = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  if (!lan.length) return t.skip('no non-loopback IPv4 interface on this machine');
  for (const addr of lan) {
    const err = await new Promise(resolve => { const s = net.connect(Number(port), addr); s.setTimeout(1500, () => { s.destroy(); resolve('timeout'); }); s.on('connect', () => { s.destroy(); resolve(null); }); s.on('error', e => resolve(e.code)); });
    assert.notEqual(err, null, `connected to ${addr}:${port} — server must listen on 127.0.0.1 only`);
  }
});

test('GATE credentials: near-miss tokens, query strings, encodings and unknown routes return no data', async t => {
  const { runtime } = await fixture(t);
  const url = new URL(runtime.url); const token = url.pathname.split('/').pop();
  assert.match(token, /^[a-f0-9]{48}$/);
  const bad = [`/overlay/${token.slice(0, -1)}`, `/overlay/${token}x`, `/overlay/${token.toUpperCase()}`, `/overlay/${token}/`,
    `/overlay/%2e%2e/${token}`, `/events/${token.slice(1)}`, '/', '/overlay/', '/events/', '/workspace.json', '/overlay-token', '/font/../workspace.json', '/font/x.woff2'];
  for (const p of bad) {
    const r = await request(url.origin + p);
    assert.equal(r.status, 404, p);
    assert.ok(!r.body.includes(token), 'token leaked by ' + p);
    assert.ok(!r.body.includes('WELCOME'), 'workspace data leaked by ' + p);
  }
  for (const m of ['POST', 'PUT', 'DELETE', 'OPTIONS']) assert.equal((await request(runtime.url, { method: m })).status, 405, m);
});

test('GATE host/origin: untrusted Host and Origin headers are rejected on every route', async t => {
  const { runtime } = await fixture(t);
  const url = new URL(runtime.url); const events = runtime.url.replace('/overlay/', '/events/');
  for (const host of ['attacker.example', `localhost:${url.port}`, `127.0.0.1:${Number(url.port) + 1}`, '127.0.0.1', `127.0.0.1:${url.port}.attacker.example`, `[::1]:${url.port}`]) {
    assert.equal((await request(runtime.url, { headers: { Host: host } })).status, 403, 'overlay Host ' + host);
    assert.equal((await request(events, { headers: { Host: host } })).status, 403, 'events Host ' + host);
    assert.equal((await request(url.origin + '/font/thai.woff2', { headers: { Host: host } })).status, 403, 'font Host ' + host);
  }
  const noHost = await rawRequest(Number(url.port), `GET ${url.pathname} HTTP/1.0\r\n\r\n`);
  assert.match(noHost, /^HTTP\/1\.\d (400|403)/, 'missing Host must be rejected');
  for (const origin of ['https://attacker.example', 'null', `http://localhost:${url.port}`, `http://127.0.0.1:${url.port}.evil`, 'file://']) {
    assert.equal((await request(events, { headers: { Origin: origin } })).status, 403, 'Origin ' + origin);
  }
  const same = await request(events, { headers: { Origin: url.origin } });
  assert.equal(same.status, 200, 'same-origin EventSource (the overlay page itself) is allowed');
});

test('GATE SSE: at most 10 concurrent overlay clients; the 11th gets 429', async t => {
  const { runtime } = await fixture(t);
  const events = runtime.url.replace('/overlay/', '/events/');
  const reqs = [];
  t.after(() => reqs.forEach(r => r.destroy()));
  for (let i = 0; i < 10; i++) await new Promise((resolve, reject) => { const r = http.get(events, res => { assert.equal(res.statusCode, 200); res.once('data', () => resolve()); }); r.on('error', reject); reqs.push(r); });
  assert.equal(runtime.getStatus().clients, 10);
  assert.equal((await request(events)).status, 429);
});

test('GATE publish: published snapshot is persisted, survives restart and is served to new overlay clients', async t => {
  const setup = await fixture(t);
  const s = setup.runtime.getState();
  s.draft.title = 'PUBLISHED v2'; s.published = structuredClone(s.draft); s.publishedAt = new Date().toISOString();
  await setup.runtime.saveState(s);
  const s2 = setup.runtime.getState(); s2.draft.title = 'DRAFT v3'; await setup.runtime.saveState(s2);
  const rt = await setup.restart();
  const events = await stream(t, rt);
  assert.equal(events[0].kind, 'state');
  assert.equal(events[0].data.title, 'PUBLISHED v2');
  assert.equal(rt.getState().draft.title, 'DRAFT v3');
  assert.equal(rt.getState().publishedAt, s.publishedAt);
});

test('GATE OBS labelling: explicit OBS alert carries sourceMode test and the overlay renders a TEST label', async t => {
  const { runtime } = await fixture(t);
  const events = await stream(t, runtime);
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs' }));
  await delay(30);
  const alert = events.find(e => e.kind === 'alert');
  assert.ok(alert); assert.equal(alert.data.sourceMode, 'test');
  const overlay = runOverlay((await request(runtime.url)).body);
  overlay.emit('state', runtime.getState().published);
  overlay.emit('alert', alert.data);
  assert.match(overlay.ids.alert.textContent, /^TEST ALERT · Twitch/);
});

test('BUG-1 OBS chat samples are not labelled as tests in the overlay', async t => {
  const { runtime } = await fixture(t);
  const overlay = runOverlay((await request(runtime.url)).body);
  overlay.emit('state', runtime.getState().published);
  overlay.emit('chat', await runtime.sendEvent(sample({ target: 'obs' })));
  assert.match(overlay.ids.chat.textContent, /TEST|ตัวอย่าง|SAMPLE/i);
});

test('GATE XSS: hostile names/messages/titles are rendered as text by the real overlay script', async t => {
  const { runtime } = await fixture(t);
  const html = (await request(runtime.url)).body;
  assert.doesNotMatch(html, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/);
  const overlay = runOverlay(html); // fake DOM throws if innerHTML is ever assigned
  assert.equal(overlay.esUrl, '/events/' + new URL(runtime.url).pathname.split('/').pop());
  const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  const s = runtime.getState(); s.draft.title = payload; s.draft.subtitle = payload; s.published = structuredClone(s.draft);
  await runtime.saveState(s);
  overlay.emit('state', runtime.getState().published);
  assert.equal(overlay.ids.title.textContent, payload);
  assert.equal(overlay.ids.subtitle.textContent, payload);
  overlay.emit('chat', await runtime.sendEvent(sample({ target: 'obs', name: payload.slice(0, 80), message: payload })));
  assert.ok(overlay.ids.chat.textContent.includes(payload));
  assert.ok(overlay.ids.chat.children[0].children.every(c => c._html === null));
  // The overlay HTML itself never embeds user strings (they arrive only as JSON over SSE).
  assert.ok(!(await request(runtime.url)).body.includes('onerror=alert'));
});

test('GATE bounded: history loaded from disk is capped at 200 and never replays queued/playing alerts', async t => {
  const dir = await tmpDir(t);
  const st = defaultState();
  st.history = Array.from({ length: 1000 }, (_, i) => ({ id: 'e' + i, platform: 'kick', type: 'follow', name: 'n' + i, message: 'm', target: 'obs', sourceMode: 'test', createdAt: new Date().toISOString(), status: i % 2 ? 'queued' : 'playing' }));
  await fs.writeFile(path.join(dir, 'workspace.json'), JSON.stringify(st));
  const { runtime } = await fixture(t, dir);
  const events = await stream(t, runtime);
  await delay(50);
  assert.ok(runtime.getState().history.length <= 200);
  assert.equal(runtime.getStatus().queue, 0);
  assert.ok(runtime.getState().history.every(e => e.status === 'interrupted'));
  assert.deepEqual(events.map(e => e.kind), ['state']);
});

test('BUG-8 a full alert queue (50) also blocks chat samples, which never enter the queue', async t => {
  const { runtime } = await fixture(t);
  await runtime.controlQueue('pause');
  for (let i = 0; i < 50; i++) await runtime.sendEvent(sample({ type: i % 2 ? 'follow' : 'subscription', target: i % 3 ? 'obs' : 'preview' }));
  await assert.rejects(runtime.sendEvent(sample({ type: 'follow', target: 'obs' })), /full/);
  for (let i = 0; i < 300; i++) await runtime.sendEvent(sample({ message: 'c' + i }));
  assert.equal(runtime.getState().history.length, 200);
  assert.equal(runtime.getStatus().queue, 50, 'queued alerts are never evicted by chat volume');
  await runtime.controlQueue('clear');
});

test('GATE restart: preferences, speech settings and token persist; playing alert is interrupted, not replayed', async t => {
  const setup = await fixture(t);
  const tokenBefore = setup.runtime.url.split('/').pop();
  const s = setup.runtime.getState();
  Object.assign(s, { language: 'en', theme: 'system', onboarded: true, workspaceName: 'QA room' });
  s.tts = { enabled: true, rate: 1.5, volume: 0.3, thaiVoice: 'Voice TH', englishVoice: 'Microsoft Zira Desktop' };
  await setup.runtime.saveState(s);
  await setup.runtime.sendEvent(sample({ type: 'follow', target: 'obs' })); // starts playing immediately
  assert.equal(setup.runtime.getHistory()[0].status, 'playing');
  const rt = await setup.restart();
  const events = await stream(t, rt);
  await delay(50);
  const r = rt.getState();
  assert.equal(rt.url.split('/').pop(), tokenBefore, 'OBS URL must stay stable across restarts');
  assert.deepEqual([r.language, r.theme, r.onboarded, r.workspaceName], ['en', 'system', true, 'QA room']);
  assert.deepEqual(r.tts, s.tts);
  assert.equal(r.history[0].status, 'interrupted');
  assert.deepEqual(events.map(e => e.kind), ['state']);
});

test('GATE import: oversized image / wrong types are rejected and existing state is untouched on disk', async t => {
  const setup = await fixture(t);
  const s = setup.runtime.getState(); s.workspaceName = 'Good state'; await setup.runtime.saveState(s);
  const onDisk = await fs.readFile(path.join(setup.dir, 'workspace.json'), 'utf8');
  const big = defaultState(); big.draft.image = 'data:image/png;base64,' + 'A'.repeat(4_000_001);
  const bads = [big, { ...defaultState(), draft: { ...defaultState().draft, width: 1920.5 } }, { ...defaultState(), tts: { ...defaultState().tts, enabled: 'yes' } },
    { ...defaultState(), theme: '<script>' }, { ...defaultState(), published: null }, [], 'string', { ...defaultState(), workspaceName: '   ' }];
  for (const b of bads) await assert.rejects(setup.runtime.importState(b));
  assert.equal(setup.runtime.getState().workspaceName, 'Good state');
  assert.equal(await fs.readFile(path.join(setup.dir, 'workspace.json'), 'utf8'), onDisk);
});

test('GATE import: main.cjs rejects backup files over 10 MB before parsing (source inspection)', async () => {
  const main = await fs.readFile(path.join(__dirname, '../electron/main.cjs'), 'utf8');
  assert.match(main, /fs\.stat\(p\)\)\.size>10000000\)throw/);
  assert.ok(main.indexOf('size>10000000') < main.indexOf('JSON.parse(await fs.readFile(p'), 'size check precedes read/parse');
});

test('GATE export: exported workspace (getState + history cleared, as in main.cjs) contains no overlay token', async t => {
  const setup = await fixture(t);
  await setup.runtime.sendEvent(sample({ message: 'secret history' }));
  const token = (await fs.readFile(path.join(setup.dir, 'overlay-token'), 'utf8')).trim();
  const exported = setup.runtime.getState(); exported.history = []; // mirrors main.cjs 'export' handler
  const json = JSON.stringify(exported, null, 2);
  assert.ok(!json.includes(token)); assert.ok(!json.includes('/overlay/')); assert.ok(!json.includes('secret history'));
  const ws = await fs.readFile(path.join(setup.dir, 'workspace.json'), 'utf8');
  assert.ok(!ws.includes(token), 'workspace.json does not store the token either');
  // Round trip: an exported file is importable.
  await setup.runtime.importState(JSON.parse(json));
  const main = await fs.readFile(path.join(__dirname, '../electron/main.cjs'), 'utf8');
  assert.match(main, /const state=runtime\.getState\(\);state\.history=\[\];await fs\.writeFile\(r\.filePath,JSON\.stringify\(state/);
});

test('GATE queue: pause/resume/skip/clear keep status.queue consistent with history', async t => {
  const { runtime } = await fixture(t);
  const events = await stream(t, runtime);
  for (let i = 0; i < 4; i++) await runtime.sendEvent(sample({ type: 'follow', target: 'obs', name: 'n' + i }));
  await delay(20);
  const count = () => runtime.getHistory().filter(e => ['queued', 'playing'].includes(e.status)).length;
  assert.equal(runtime.getStatus().queue, 4); assert.equal(count(), 4);
  assert.equal(events.filter(e => e.kind === 'alert').length, 1);
  await runtime.controlQueue('pause');
  await runtime.controlQueue('skip'); // skips the playing one; paused -> nothing new plays
  await delay(20);
  assert.equal(runtime.getStatus().queue, 3); assert.equal(count(), 3);
  assert.equal(events.filter(e => e.kind === 'alert').length, 1);
  await runtime.controlQueue('resume'); await delay(20);
  assert.equal(events.filter(e => e.kind === 'alert').length, 2);
  await runtime.controlQueue('clear');
  assert.equal(runtime.getStatus().queue, 0); assert.equal(count(), 0);
  await assert.rejects(runtime.controlQueue('explode'));
});

test('BUG-2 skipping an alert wipes the OBS chat box', async t => {
  const { runtime } = await fixture(t);
  const overlay = runOverlay((await request(runtime.url)).body);
  const events = await stream(t, runtime);
  overlay.emit('state', runtime.getState().published);
  overlay.emit('chat', await runtime.sendEvent(sample({ target: 'obs', message: 'keep me' })));
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs' }));
  await runtime.controlQueue('skip');
  await delay(20);
  for (const e of events.filter(e => e.kind === 'clear')) overlay.emit('clear', e.data);
  assert.ok(overlay.ids.chat.textContent.includes('keep me'), 'chat should survive skipping an alert');
});

test('BUG-3 app-only (preview) alerts block the OBS alert queue for 5 s each', async t => {
  const { runtime } = await fixture(t);
  const events = await stream(t, runtime);
  await runtime.sendEvent(sample({ type: 'follow', target: 'preview' }));
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs' }));
  await delay(200);
  try { assert.equal(events.filter(e => e.kind === 'alert').length, 1, 'OBS alert should not wait behind an app-only alert'); }
  finally { await runtime.controlQueue('clear'); }
});

test('BUG-4 draft-only saves re-broadcast the full published scene (incl. image) to every overlay', async t => {
  const { runtime } = await fixture(t);
  const events = await stream(t, runtime);
  const s = runtime.getState(); s.draft.title = 'typing'; await runtime.saveState(s);
  await delay(30);
  assert.equal(events.filter(e => e.kind === 'state').length, 1);
});

test('BUG-5 import changes the live OBS overlay without an explicit publish', async t => {
  const { runtime } = await fixture(t);
  const events = await stream(t, runtime);
  const imp = defaultState(); imp.published.title = 'FROM BACKUP';
  await runtime.importState(imp);
  await delay(30);
  assert.ok(!events.some(e => e.kind === 'state' && e.data.title === 'FROM BACKUP'));
});

test('BUG-6 repeated imports keep appending " (imported)" to the workspace name', async t => {
  const { runtime } = await fixture(t);
  await runtime.importState(defaultState());
  await runtime.importState(runtime.getState());
  assert.equal(runtime.getState().workspaceName, 'My streaming room (imported)');
});

test('BUG-7 unknown fields on history entries in workspace.json survive load', async t => {
  const dir = await tmpDir(t);
  const st = defaultState();
  st.history = [{ id: 'a', platform: 'kick', type: 'chat', name: 'n', message: 'm', target: 'preview', status: 'completed', createdAt: 'x', injected: 'x'.repeat(100000) }];
  await fs.writeFile(path.join(dir, 'workspace.json'), JSON.stringify(st));
  const { runtime } = await fixture(t, dir);
  assert.equal('injected' in runtime.getHistory()[0], false, 'raw extra field (100 kB) was kept');
});

test('GATE bounded: queue is capped at 50 alerts and history at 200 entries', async t => {
  const { runtime } = await fixture(t);
  await runtime.controlQueue('pause');
  for (let i = 0; i < 50; i++) await runtime.sendEvent(sample({ type: i % 2 ? 'follow' : 'subscription', target: i % 3 ? 'obs' : 'preview' }));
  await assert.rejects(runtime.sendEvent(sample({ type: 'follow', target: 'obs' })), /full/);
  await runtime.controlQueue('clear');
  for (let i = 0; i < 300; i++) await runtime.sendEvent(sample({ message: 'c' + i }));
  assert.equal(runtime.getState().history.length, 200);
  assert.equal(runtime.getStatus().queue, 0);
});

test('BUG-9 unreadable workspace.json is overwritten by the first sample event, despite "preserved until you save"', async t => {
  const dir = await tmpDir(t);
  const file = path.join(dir, 'workspace.json');
  const corrupt = '{"schemaVersion":1, "workspaceName": "my real room" ...truncated';
  await fs.writeFile(file, corrupt);
  const { runtime } = await fixture(t, dir);
  assert.match(runtime.getStatus().storageWarning, /could not be read[\s\S]*kept as workspace\.corrupt-/); // round 2: warning names the backup copy
  await runtime.sendEvent(sample()); // "Try a sample chat" — not a save
  const preserved = (await fs.readFile(file, 'utf8')) === corrupt || (await fs.readdir(dir)).some(f => /corrupt|bak|broken/i.test(f));
  assert.ok(preserved, 'original workspace content was destroyed by a sample chat');
});
