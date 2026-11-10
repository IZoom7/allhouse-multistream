'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createThaiTts, normaliseThai, thaiInteger, toIds, toWav, VOICES, ENGINE } = require('../electron/thaiTts.cjs');

test('thai numbers: units, tens, เอ็ด/ยี่สิบ, millions, long digit runs', () => {
  assert.equal(thaiInteger('0'), 'ศูนย์');
  assert.equal(thaiInteger('11'), 'สิบเอ็ด');
  assert.equal(thaiInteger('21'), 'ยี่สิบเอ็ด');
  assert.equal(thaiInteger('101'), 'หนึ่งร้อยเอ็ด');
  assert.equal(thaiInteger('1250'), 'หนึ่งพันสองร้อยห้าสิบ');
  assert.equal(thaiInteger('2000000'), 'สองล้าน');
  assert.equal(thaiInteger('12500001'), 'สิบสองล้านห้าแสนเอ็ด');
  assert.equal(thaiInteger('0812345678'), 'ศูนย์แปดหนึ่งสองสามสี่ห้าหกเจ็ดแปด');
});

test('normaliseThai: numbers with commas/decimals, Thai digits, 555, %', () => {
  assert.equal(normaliseThai('ได้ 1,250 คะแนน'), 'ได้ หนึ่งพันสองร้อยห้าสิบ คะแนน');
  assert.equal(normaliseThai('๓ คน'), 'สาม คน');
  assert.equal(normaliseThai('99.5%'), 'เก้าสิบเก้าจุดห้า เปอร์เซ็นต์');
  assert.equal(normaliseThai('555555'), 'ฮ่าฮ่าฮ่า');
  assert.equal(normaliseThai('ห้อง 5551'), 'ห้อง ห้าพันห้าร้อยห้าสิบเอ็ด');
});

test('toIds: blank between letters, unknown characters skipped, no doubled or edge spaces', () => {
  const map = { ' ': [3], 'ก': [10], 'ข': [11], '^': [], '$': [], '_': [0] };
  assert.deepEqual(toIds('กข', map), [0, 10, 0, 11, 0]);
  assert.deepEqual(toIds(' ก hello ข ', map), [0, 10, 0, 3, 0, 11, 0]);
  assert.deepEqual(toIds('hello', map), [0]);
});

test('toWav: 16-bit mono header, peak-normalised and scaled by volume', () => {
  const wav = toWav(Float32Array.from([0, 0.5, -0.5]), 16000, 0.5);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readInt16LE(46), Math.round(0.45 * 32767));
});

test('pinned downloads: every voice and engine file has a size and a hash', () => {
  for (const v of Object.values(VOICES)) { assert.match(v.sha256, /^[0-9a-f]{64}$/); assert.match(v.jsonSha256, /^[0-9a-f]{64}$/); assert.match(v.url, /^https:\/\/huggingface\.co\/.+\/resolve\/[0-9a-f]{40}\//); }
  for (const p of ENGINE) { assert.match(p.integrity, /^sha512-/); assert.match(p.url, /^https:\/\/registry\.npmjs\.org\//); assert.ok(p.size > 0); }
});

// ---- install flow with a fake network ----
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const sha512 = b => 'sha512-' + crypto.createHash('sha512').update(b).digest('base64');
function fakeFetch(files, { failAfter } = {}) {
  return async (url, { signal } = {}) => {
    const body = files[url];
    if (!body) return { ok: false, status: 404, body: null };
    let sent = false;
    return { ok: true, status: 200, body: { getReader: () => ({ read: async () => {
      if (signal && signal.aborted) throw new Error('aborted');
      if (failAfter && sent) throw new Error('network lost');
      if (sent) return { done: true };
      sent = true; return { done: false, value: new Uint8Array(body) };
    } }) } };
  };
}
function setup(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allhouse-thai-'));
  const model = Buffer.from('model'), json = Buffer.from('{"phoneme_id_map":{}}'), tgz = Buffer.from('tgz');
  const voices = { th_female: { file: 'f', size: model.length, sha256: sha256(overrides.model || model), jsonSha256: sha256(json), url: 'https://x/f.onnx', jsonUrl: 'https://x/f.onnx.json' } };
  const engine = [{ name: 'onnxruntime-node', url: 'https://x/e.tgz', size: tgz.length, integrity: sha512(tgz), members: ['package'] }];
  const extracted = [], progress = [];
  const tts = createThaiTts({ dataDir: dir, voices, engine, fetch: fakeFetch({ 'https://x/f.onnx': model, 'https://x/f.onnx.json': json, 'https://x/e.tgz': tgz }, overrides),
    extract: async (file, dest, members) => { extracted.push({ file: path.basename(file), members }); }, onProgress: p => progress.push(p) });
  return { dir, tts, extracted, progress };
}

test('install: first voice also installs the engine, verifies files, reports progress', async () => {
  const { dir, tts, extracted, progress } = setup();
  assert.deepEqual(tts.status().voices, [{ id: 'th_female', size: 5, installed: false }]);
  const s = await tts.install('th_female');
  assert.equal(s.engine, true);
  assert.equal(s.voices[0].installed, true);
  assert.equal(s.job, null);
  assert.deepEqual(extracted, [{ file: 'onnxruntime-node.tgz', members: ['package'] }]);
  assert.ok(progress.some(p => p.phase === 'engine') && progress.some(p => p.phase === 'voice'));
  assert.equal(progress[progress.length - 1].received, progress[progress.length - 1].total);
  assert.ok(!fs.existsSync(path.join(dir, 'thai-voices', 'tmp')));
  await assert.rejects(tts.install('nope'), /Unknown voice/);
});

test('install: a damaged download is rejected and nothing is left installed', async () => {
  const { dir, tts } = setup({ model: Buffer.from('other') });
  await assert.rejects(tts.install('th_female'), /checksum/);
  assert.equal(tts.status().voices[0].installed, false);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'thai-voices')).filter(f => f.startsWith('f.')), []);
});

test('install: a lost connection cleans up the partial file; synthesize refuses voices not installed', async () => {
  const { dir, tts } = setup({ failAfter: true });
  await assert.rejects(tts.install('th_female'), /network lost/);
  assert.ok(!fs.readdirSync(path.join(dir, 'thai-voices')).some(f => f.endsWith('.part')));
  assert.throws(() => tts.synthesize('สวัสดี', { voice: 'th_female' }), /not downloaded/);
});
