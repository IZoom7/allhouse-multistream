'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createConnections, PLATFORMS } = require('../electron/connections.cjs');
const { tmpDir } = require('./helpers/qa-helpers.cjs');

/** Fake connectors: record every connect, report "connected", let the test push events. */
function fakes() {
  const calls = [], open = {};
  const connectors = Object.fromEntries(PLATFORMS.map(p => [p, { connect(o) { calls.push({ p, channel: o.channel }); o.onStatus({ state: 'connected', detail: p }); open[p] = o; return { close() { delete open[p]; } }; } }]));
  return { calls, open, connectors };
}
const make = (dir, f, events = []) => createConnections({ dataDir: dir, fetch: null, connectors: f.connectors, onEvent: e => events.push(e), onChange: () => {} });

test('connect is saved and auto-reconnects on the next start; disconnect stops that', async t => {
  const dir = await tmpDir(t);
  const f1 = fakes(), events = [];
  const a = make(dir, f1, events);
  await a.init();
  assert.equal(f1.calls.length, 0, 'nothing saved yet, nothing started');
  const snap = await a.connect('twitch', '  xqc ');
  assert.deepEqual(f1.calls, [{ p: 'twitch', channel: 'xqc' }]);
  assert.equal(snap.twitch.state, 'connected');
  f1.open.twitch.onEvent({ type: 'chat', name: 'v', message: 'hi' });
  assert.deepEqual(events, [{ type: 'chat', name: 'v', message: 'hi', platform: 'twitch' }], 'events are tagged with their platform');
  assert.equal(a.get().twitch.events, 1);
  a.closeAll();

  const f2 = fakes();
  await make(dir, f2).init();
  assert.deepEqual(f2.calls, [{ p: 'twitch', channel: 'xqc' }], 'restarted from connections.json');

  const b = make(dir, fakes()); await b.init(); await b.disconnect('twitch'); b.closeAll();
  const f3 = fakes();
  await make(dir, f3).init();
  assert.equal(f3.calls.length, 0, 'a disconnected platform stays off after restart');
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'connections.json'), 'utf8')).twitch.channel, 'xqc', 'channel name is remembered');
});

test('bad input is refused; a broken connections.json is ignored', async t => {
  const dir = await tmpDir(t);
  await fs.writeFile(path.join(dir, 'connections.json'), '{not json');
  const f = fakes(), c = make(dir, f);
  await c.init();
  assert.equal(f.calls.length, 0);
  await assert.rejects(c.connect('myspace', 'x'), /Unknown platform/);
  await assert.rejects(c.connect('kick', 'x'.repeat(201)), /Invalid channel/);
  await assert.rejects(c.disconnect('myspace'), /Unknown platform/);
});
