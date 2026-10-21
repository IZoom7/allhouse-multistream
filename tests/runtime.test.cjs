const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { createRuntime, validateState, defaultState } = require('../electron/runtime.cjs');

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'allhouse-test-'));
  let runtime = await createRuntime({ dataDir: dir, port: 0 });
  t.after(async () => {
    await runtime.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(dir, { recursive: true, force: true });
  });
  return {
    dir,
    get runtime() { return runtime; },
    async restart() {
      await runtime.close();
      runtime = await createRuntime({ dataDir: dir, port: 0 });
      return runtime;
    },
  };
}

const sample = (extra = {}) => ({
  platform: 'twitch', type: 'chat', name: 'ผู้ชม',
  message: 'สวัสดี welcome to Allhouse', target: 'preview', ...extra,
});
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function get(url, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { headers, method }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}
async function stream(t, runtime) {
  const events = [];
  let pending = '';
  const url = runtime.url.replace('/overlay/', '/events/');
  await new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      assert.equal(res.statusCode, 200);
      res.setEncoding('utf8');
      res.on('data', chunk => {
        pending += chunk;
        let idx;
        while ((idx = pending.indexOf('\n\n')) >= 0) {
          const block = pending.slice(0, idx);
          pending = pending.slice(idx + 2);
          const kind = block.match(/^event: (.+)$/m)?.[1];
          const data = block.match(/^data: (.+)$/m)?.[1];
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

test('state validation accepts defaults, strips unsupported fields and credentials', () => {
  const result = validateState({ ...defaultState(), token: 'secret', history: [{ token: 'secret' }] });
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.token, undefined);
  assert.deepEqual(result.history, []);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('state validation rejects malformed, unsafe and excessive inputs', () => {
  const bad = [
    null, {}, { ...defaultState(), schemaVersion: 999 },
    { ...defaultState(), workspaceName: '' },
    { ...defaultState(), workspaceName: 'x'.repeat(81) },
    { ...defaultState(), language: 'javascript' },
    { ...defaultState(), draft: { ...defaultState().draft, width: 100000 } },
    { ...defaultState(), draft: { ...defaultState().draft, title: 'x'.repeat(121) } },
    { ...defaultState(), draft: { ...defaultState().draft, image: 'https://attacker.example/a.png' } },
    { ...defaultState(), draft: { ...defaultState().draft, image: 'data:image/svg+xml;base64,PHN2Zz4=' } },
    { ...defaultState(), tts: { ...defaultState().tts, rate: Infinity } },
    { ...defaultState(), tts: { ...defaultState().tts, volume: -1 } },
  ];
  for (const input of bad) assert.throws(() => validateState(input));
});

test('HTTP overlay is local, transparent, credential-protected and safe against cross-origin access', async t => {
  const { runtime } = await fixture(t);
  const url = new URL(runtime.url);
  assert.equal(url.hostname, '127.0.0.1');
  const valid = await get(runtime.url);
  assert.equal(valid.status, 200);
  assert.match(valid.body, /background:transparent/);
  assert.equal(valid.headers['cache-control'], 'no-store');
  assert.equal((await get(`${url.origin}/overlay/wrong`)).status, 404);
  assert.equal((await get(`${url.origin}/events/wrong`)).status, 404);
  assert.equal((await get(`${url.origin}/../workspace.json`)).status, 404);
  assert.equal((await get(runtime.url, { Host: 'attacker.example' })).status, 403);
  assert.equal((await get(runtime.url.replace('/overlay/', '/events/'), { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await get(runtime.url, {}, 'POST')).status, 405);
  assert.match(valid.body, /\.textContent=/);
  assert.doesNotMatch(valid.body, /\.innerHTML\s*=/);
});

test('draft edits remain isolated until an explicit published snapshot is saved', async t => {
  const { runtime } = await fixture(t);
  const events = await stream(t, runtime);
  const before = runtime.getState();
  const next = runtime.getState();
  next.draft.title = 'DRAFT ONLY <script>bad()</script>';
  await runtime.saveState(next);
  await delay(30);
  assert.equal(events.at(-1).kind, 'state');
  assert.equal(events.at(-1).data.title, before.published.title);
  next.published = structuredClone(next.draft);
  await runtime.saveState(next);
  await delay(30);
  assert.equal(events.at(-1).data.title, next.draft.title);
});

test('preview events never enter OBS stream while explicit OBS tests do', async t => {
  const { runtime } = await fixture(t);
  const events = await stream(t, runtime);
  await runtime.sendEvent(sample());
  await runtime.sendEvent(sample({ type: 'follow' }));
  await delay(30);
  assert.deepEqual(events.map(e => e.kind), ['state']);
  await runtime.controlQueue('clear');
  const event = await runtime.sendEvent(sample({ target: 'obs', message: '<img src=x onerror=alert(1)>' }));
  await delay(30);
  const received = events.find(e => e.kind === 'chat');
  assert.ok(received);
  assert.equal(received.data.sourceMode, 'test');
  assert.equal(received.data.message, event.message);
});

test('invalid sample events are rejected without side effects', async t => {
  const { runtime } = await fixture(t);
  for (const overrides of [{ platform: 'unknown' }, { type: 'donation' }, { target: 'live' }, { name: '' }, { message: '' }, { message: 'x'.repeat(501) }]) {
    await assert.rejects(runtime.sendEvent(sample(overrides)));
  }
  assert.deepEqual(runtime.getState().history, []);
});

test('pause holds alerts and resume emits only the next one; clear prevents replay', async t => {
  const { runtime } = await fixture(t);
  const events = await stream(t, runtime);
  await runtime.controlQueue('pause');
  await runtime.sendEvent(sample({ type: 'follow', target: 'obs' }));
  await runtime.sendEvent(sample({ type: 'subscription', target: 'obs' }));
  await delay(30);
  assert.equal(events.filter(e => e.kind === 'alert').length, 0);
  assert.equal(runtime.getStatus().queue, 2);
  await runtime.controlQueue('resume');
  await delay(30);
  assert.equal(events.filter(e => e.kind === 'alert').length, 1);
  await runtime.controlQueue('clear');
  assert.equal(runtime.getStatus().queue, 0);
  assert.ok(runtime.getState().history.every(e => e.status === 'skipped'));
});

test('queue overflow is reported and history remains bounded', async t => {
  const { runtime } = await fixture(t);
  await runtime.controlQueue('pause');
  for (let i = 0; i < 50; i++) await runtime.sendEvent(sample({ type: 'follow' }));
  await assert.rejects(runtime.sendEvent(sample({ type: 'follow' })), /full/);
  assert.equal(runtime.getStatus().queue, 50);
  await runtime.controlQueue('clearHistory');
  for (let i = 0; i < 205; i++) await runtime.sendEvent(sample({ message: String(i) }));
  assert.equal(runtime.getState().history.length, 200);
  assert.equal(runtime.getState().history[0].message, '5');
});

test('restart restores settings and marks unfinished alerts interrupted without replay', async t => {
  const setup = await fixture(t);
  const state = setup.runtime.getState();
  state.workspaceName = 'บ้านสตรีม';
  state.theme = 'light';
  state.draft.title = 'UNPUBLISHED';
  await setup.runtime.saveState(state);
  await setup.runtime.controlQueue('pause');
  await setup.runtime.sendEvent(sample({ type: 'follow', target: 'obs' }));
  const runtime = await setup.restart();
  const events = await stream(t, runtime);
  assert.equal(runtime.getState().workspaceName, 'บ้านสตรีม');
  assert.equal(runtime.getState().theme, 'light');
  assert.equal(runtime.getState().draft.title, 'UNPUBLISHED');
  assert.notEqual(runtime.getState().published.title, 'UNPUBLISHED');
  assert.equal(runtime.getState().history[0].status, 'interrupted');
  assert.equal(runtime.getStatus().queue, 0);
  await delay(30);
  assert.deepEqual(events.map(e => e.kind), ['state']);
});

test('invalid import preserves the existing workspace and queue', async t => {
  const { runtime } = await fixture(t);
  await runtime.controlQueue('pause');
  await runtime.sendEvent(sample({ type: 'follow' }));
  const before = runtime.getState();
  await assert.rejects(runtime.importState({ schemaVersion: 3 }));
  assert.deepEqual(runtime.getState(), before);
});

test('valid import disables speech and discards imported history and unknown credentials', async t => {
  const { runtime } = await fixture(t);
  const imported = defaultState();
  imported.tts.enabled = true;
  imported.history = [{ status: 'queued', token: 'credential' }];
  imported.token = 'credential';
  await runtime.importState(imported);
  const result = runtime.getState();
  assert.match(result.workspaceName, /\(imported\)$/);
  assert.equal(result.tts.enabled, false);
  assert.deepEqual(result.history, []);
  assert.equal(JSON.stringify(result).includes('credential'), false);
});

test('unreadable workspace is reported and preserved until an explicit save', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'allhouse-test-'));
  const file = path.join(dir, 'workspace.json');
  const corrupt = '{invalid json';
  await fs.writeFile(file, corrupt);
  const runtime = await createRuntime({ dataDir: dir, port: 0 });
  t.after(async () => {
    await runtime.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(dir, { recursive: true, force: true });
  });
  assert.ok(runtime.getStatus().storageWarning);
  assert.equal(await fs.readFile(file, 'utf8'), corrupt);
  await runtime.saveState(defaultState());
  assert.equal(runtime.getStatus().storageWarning, '');
  assert.doesNotThrow(() => JSON.parse(require('node:fs').readFileSync(file, 'utf8')));
});

test('skip while paused skips the next queued alert instead of doing nothing', async t => {
  const { runtime } = await fixture(t);
  await runtime.controlQueue('pause');
  await runtime.sendEvent(sample({ type: 'follow', name: 'one' }));
  await runtime.sendEvent(sample({ type: 'follow', name: 'two' }));
  const status = await runtime.controlQueue('skip');
  assert.equal(status.queue, 1);
  const history = runtime.getHistory();
  assert.deepEqual(history.map(e => [e.name, e.status]), [['one', 'skipped'], ['two', 'queued']]);
  history[0].status = 'tampered';
  assert.equal(runtime.getHistory()[0].status, 'skipped', 'getHistory returns a copy');
  await runtime.controlQueue('clear');
});

test('speech request validation rejects bad input and clamps numbers', () => {
  const { validateSpeakRequest } = require('../electron/speech.cjs');
  const ok = validateSpeakRequest('สวัสดี hello', { voice: 'Microsoft Zira Desktop', rate: 9, volume: -1 });
  assert.deepEqual(ok, { text: 'สวัสดี hello', voice: 'Microsoft Zira Desktop', rate: 2, volume: 0 });
  assert.equal(validateSpeakRequest('hi', { voice: 'v', rate: 'fast', volume: NaN }).rate, 1);
  assert.throws(() => validateSpeakRequest('', { voice: 'v' }));
  assert.throws(() => validateSpeakRequest('   ', { voice: 'v' }));
  assert.throws(() => validateSpeakRequest(42, { voice: 'v' }));
  assert.throws(() => validateSpeakRequest('ก'.repeat(501), { voice: 'v' }));
  assert.doesNotThrow(() => validateSpeakRequest('ก'.repeat(500), { voice: 'v' }));
  assert.throws(() => validateSpeakRequest('hi', null));
  assert.throws(() => validateSpeakRequest('hi', ['v']));
  assert.throws(() => validateSpeakRequest('hi', { voice: '' }));
  assert.throws(() => validateSpeakRequest('hi', { voice: 'x'.repeat(201) }));
  assert.throws(() => validateSpeakRequest('hi', { voice: 'a\nb' }));
  assert.throws(() => validateSpeakRequest('hi', { voice: { toString: () => 'v' } }));
});

test('preload exposes speech and history bridges that main.cjs handles', async () => {
  const preload = await fs.readFile(path.join(__dirname, '../electron/preload.cjs'), 'utf8');
  const main = await fs.readFile(path.join(__dirname, '../electron/main.cjs'), 'utf8');
  for (const channel of preload.matchAll(/'house:([a-z-]+)'/g)) {
    // Either main handles it (invoke) or main pushes it to the windows (main -> renderer events such as house:live-event).
    assert.ok(main.includes(`invoke('${channel[1]}'`) || main.includes(`'house:${channel[1]}'`), `main.cjs must handle or send house:${channel[1]}`);
  }
  for (const name of ['listVoices', 'synthesize', 'getHistory']) assert.match(preload, new RegExp(name + ':'));
});

test('speech engine: optional field validated, persisted, and never switched on by an import', async t => {
  const setup = await fixture(t);
  const s = setup.runtime.getState();
  s.tts = { ...s.tts, engine: 'online', onlineThaiVoice: 'th-TH-NiwatNeural', onlineEnglishVoice: '' };
  await setup.runtime.saveState(s);
  const rt = await setup.restart();
  assert.equal(rt.getState().tts.engine, 'online');
  assert.equal(rt.getState().tts.onlineThaiVoice, 'th-TH-NiwatNeural');
  for (const engine of ['cloud', '', 1, null]) {
    const bad = rt.getState(); bad.tts.engine = engine;
    await assert.rejects(rt.saveState(bad), /speech/);
  }
  const imp = defaultState(); imp.tts = { ...imp.tts, engine: 'online', onlineThaiVoice: 'th-TH-PremwadeeNeural', onlineEnglishVoice: '' };
  const after = await rt.importState(imp);
  assert.equal(after.tts.engine, 'windows', 'imported backups must not enable sending text online');
  assert.deepEqual(Object.keys(validateState(defaultState()).tts).sort(), ['enabled', 'englishVoice', 'rate', 'thaiVoice', 'volume'], 'old workspaces stay valid without engine fields');
});

test('main.cjs only sends text online when the saved engine is "online"', async () => {
  const main = await fs.readFile(path.join(__dirname, '../electron/main.cjs'), 'utf8');
  assert.match(main, /invoke\('speak-online',\(text,options\)=>\{if\(runtime\.getState\(\)\.tts\.engine!=='online'\)throw/);
});
