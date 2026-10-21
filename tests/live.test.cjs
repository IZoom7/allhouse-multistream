'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRuntime } = require('../electron/runtime.cjs');
const { tmpDir, delay } = require('./helpers/qa-helpers.cjs');

test('ingestLive: real events are trimmed, marked live, sent to OBS and persisted lazily', async t => {
  const dir = await tmpDir(t);
  const rt = await createRuntime({ dataDir: dir, port: 0 });
  t.after(() => rt.close());
  const e = rt.ingestLive({ platform: 'twitch', type: 'chat', name: '  viewer\u0007 ', message: 'x'.repeat(900) });
  assert.equal(e.sourceMode, 'live');
  assert.equal(e.target, 'obs');
  assert.equal(e.name, 'viewer');
  assert.equal(e.message.length, 500);
  assert.equal(rt.ingestLive({ platform: 'twitch', type: 'chat', name: 'a', message: '   ' }), null, 'empty chat dropped');
  assert.equal(rt.ingestLive({ platform: 'myspace', type: 'chat', name: 'a', message: 'b' }), null, 'unknown platform dropped');
  assert.ok(['queued', 'playing'].includes(rt.ingestLive({ platform: 'kick', type: 'follow', name: 'f', message: '' }).status), 'alerts may have no message');
  await delay(2300);
  const saved = JSON.parse(await fs.readFile(path.join(dir, 'workspace.json'), 'utf8'));
  assert.equal(saved.history.filter(h => h.sourceMode === 'live').length, 2);
});

test('overlay pages hide the TEST label only for live events', async () => {
  const src = await fs.readFile(path.join(__dirname, '..', 'electron', 'runtime.cjs'), 'utf8');
  assert.match(src, /if\(v\.sourceMode!=='live'\)\{const tag=/);
  assert.match(src, /v\.sourceMode==='live'\?'':'TEST ALERT · '/);
});
