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
  // live traffic only rewrites the small history.json, never workspace.json (which carries images/sounds)
  const history = JSON.parse(await fs.readFile(path.join(dir, 'history.json'), 'utf8'));
  assert.equal(history.filter(h => h.sourceMode === 'live').length, 2);
  await assert.rejects(fs.readFile(path.join(dir, 'workspace.json'), 'utf8'), /ENOENT/);
});

test('overlay pages hide the TEST label only for live events', async () => {
  const src = await fs.readFile(path.join(__dirname, '..', 'electron', 'runtime.cjs'), 'utf8');
  assert.match(src, /if\(v\.sourceMode!=='live'\)\{const tag=/);
  assert.match(src, /v\.sourceMode==='live'\?'':'TEST ALERT · '/);
});

test('history.json survives a restart; old workspaces with embedded history still load', async t => {
  const dir = await tmpDir(t);
  const a = await createRuntime({ dataDir: dir, port: 0 });
  a.ingestLive({ platform: 'kick', type: 'chat', name: 'v', message: 'hello' });
  await a.close();
  const b = await createRuntime({ dataDir: dir, port: 0 });
  t.after(() => b.close());
  assert.equal(b.getHistory().at(-1).message, 'hello');
});

test('live chat: avatar only from YouTube/TikTok image hosts over https, colour only #rrggbb', async t => {
  const dir = await tmpDir(t);
  const rt = await createRuntime({ dataDir: dir, port: 0 });
  const ok = rt.ingestLive({ platform: 'youtube', type: 'chat', name: 'a', message: 'x', avatar: 'https://yt4.ggpht.com/abc=s64', color: '#FF0000' });
  assert.equal(ok.avatar, 'https://yt4.ggpht.com/abc=s64');
  assert.equal(ok.color, '#FF0000');
  for (const avatar of ['http://yt4.ggpht.com/x', 'https://evil.example/ggpht.com/x', 'https://ggpht.com.evil.example/x', 'javascript:alert(1)', 'https://p16.tiktokcdn.com/a b'])
    assert.equal(rt.ingestLive({ platform: 'tiktok', type: 'chat', name: 'b', message: 'y', avatar }).avatar, undefined, avatar);
  assert.equal(rt.ingestLive({ platform: 'twitch', type: 'chat', name: 'c', message: 'z', color: 'red;background:url(x)' }).color, undefined);
  await rt.close(); // before tmpDir's cleanup removes the folder
});

test('profile picture and name colour are kept in history.json across a restart (and re-checked on load)', async t => {
  const dir = await tmpDir(t);
  const a = await createRuntime({ dataDir: dir, port: 0 });
  a.ingestLive({ platform: 'youtube', type: 'chat', name: 'yt', message: 'hi', avatar: 'https://yt4.ggpht.com/a=s64', color: '#123456' });
  await a.close();
  const file = path.join(dir, 'history.json');
  const rows = JSON.parse(await fs.readFile(file, 'utf8'));
  rows.push({ ...rows[0], id: 'evil', avatar: 'https://evil.example/x.png', color: 'red' }); // tampered row
  await fs.writeFile(file, JSON.stringify(rows));
  const b = await createRuntime({ dataDir: dir, port: 0 });
  const h = b.getHistory();
  assert.deepEqual([h[0].avatar, h[0].color], ['https://yt4.ggpht.com/a=s64', '#123456']);
  assert.deepEqual([h[1].avatar, h[1].color], [undefined, undefined]);
  await b.close();
});

test('Twitch and Kick picture hosts are accepted for live chat', async t => {
  const dir = await tmpDir(t);
  const rt = await createRuntime({ dataDir: dir, port: 0 });
  for (const avatar of ['https://static-cdn.jtvnw.net/jtv_user_pictures/x-70x70.png', 'https://files.kick.com/images/user/1/p.webp'])
    assert.equal(rt.ingestLive({ platform: 'twitch', type: 'chat', name: 'a', message: 'x', avatar }).avatar, avatar);
  assert.equal(rt.ingestLive({ platform: 'kick', type: 'chat', name: 'a', message: 'x', avatar: 'https://kick.com.evil.example/p.png' }).avatar, undefined);
  await rt.close();
});
