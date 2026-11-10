'use strict';
// Offline Thai AI voices (opt-in download). Nothing here runs until the user presses Download for a voice.
//  - Voices: Thai MMS-TTS fine-tunes by VIZINTZOR, in Piper format (tranhuyluyen/piper-voices-thai on Hugging Face).
//    CC-BY-NC-4.0 (inherited from Meta's MMS-TTS): non-commercial use only. The UI says so before downloading.
//  - Engine: Microsoft onnxruntime-node from npm (only the Windows x64 CPU files are kept: ~21 MB on disk).
// Every file is pinned (exact revision / version) and checked against a known hash before it is used.
// The model reads Thai letters directly (no phonemizer): one id per character with the blank id 0 in between.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const HF = 'https://huggingface.co/tranhuyluyen/piper-voices-thai/resolve/3f78c561e47fc5692f369a2ff65ad2139a7e6c3d/';
const voice = (file, size, sha256, jsonSha256) => ({ file, size, sha256, jsonSha256, url: HF + file + '.onnx', jsonUrl: HF + file + '.onnx.json' });
const VOICES = {
  th_female: voice('th_TH-mms_female-medium', 114415781, 'bc3e0d18b2ca7d47bb9d138ea1f0ea5c4632c38a6f4fc7acbd354532077d3dcd', '217eb21109f4345b23682d5d85fac5be7382f9f6ff6c3b88369f0e1d88c9724c'),
  th_male: voice('th_TH-mms_male-medium', 114415773, '77c1e77ad5b809aca2f3384678f4427bccd6c986c3633744256524826ecbb767', '217eb21109f4345b23682d5d85fac5be7382f9f6ff6c3b88369f0e1d88c9724c'),
  th_narrator: voice('th_TH-mms_male_narrator-medium', 114415773, '3bed1b1b372d914777de01d49eaab104824ad5904c9b95eb10a5792e4c3a61cd', 'ed07f51042a7217f361fe87c10719bcecf733adc633ec7e9fe5f1b968cdafb52'),
};
const ORT_VERSION = '1.22.0';
const BIN = 'package/bin/napi-v6/win32/x64/';
const ENGINE = [
  { name: 'onnxruntime-node', url: `https://registry.npmjs.org/onnxruntime-node/-/onnxruntime-node-${ORT_VERSION}.tgz`, size: 93267589,
    integrity: 'sha512-QaAqr7PFekrmEsmu1rpw7OxJYyG+iACjNHoNtQIVt9Oh7st8WDPIIUe6KhF9l35HVJTJd9CV1rePoPmKhSV26g==',
    // DirectML/GPU files are left out: the CPU is fast enough (about 6x faster than real time) and it saves ~37 MB.
    members: ['package/package.json', 'package/dist', BIN + 'onnxruntime.dll', BIN + 'onnxruntime_binding.node'] },
  { name: 'onnxruntime-common', url: `https://registry.npmjs.org/onnxruntime-common/-/onnxruntime-common-${ORT_VERSION}.tgz`, size: 65121,
    integrity: 'sha512-vcuaNWgtF2dGQu/EP5P8UI5rEPEYqXG2sPPe5j9lg2TY/biJF8eWklTMwlDO08iuXq48xJo0awqIpK5mPG+IxA==', members: ['package/package.json', 'package/dist'] },
];
const ENGINE_SIZE = ENGINE.reduce((n, p) => n + p.size, 0);

// ---- Thai text → what the model can read (pure, tested) ----
const DIGIT = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const PLACE = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
function belowMillion(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const d = +s[i], pos = s.length - 1 - i;
    if (!d) continue;
    if (pos === 1) out += d === 1 ? 'สิบ' : d === 2 ? 'ยี่สิบ' : DIGIT[d] + 'สิบ';
    else if (pos === 0 && d === 1 && s.length > 1) out += 'เอ็ด';
    else out += DIGIT[d] + PLACE[pos];
  }
  return out;
}
/** "1250" → "หนึ่งพันสองร้อยห้าสิบ". Phone numbers (leading 0) and very long runs are read digit by digit. */
function thaiInteger(s) {
  if ((s.length > 1 && s[0] === '0') || s.length > 12) return Array.from(s, c => DIGIT[c]).join('');
  s = s.replace(/^0+/, '');
  if (!s) return 'ศูนย์';
  if (s.length <= 6) return belowMillion(s);
  const tail = s.slice(-6).replace(/^0+/, '');
  return thaiInteger(s.slice(0, -6)) + 'ล้าน' + (tail ? belowMillion(tail) : '');
}
/** Chat text → Thai words the model knows: Thai digits, numbers, 555 (laughing), % and ฯลฯ. */
function normaliseThai(text) {
  return String(text).normalize('NFC')
    .replace(/[๐-๙]/g, c => String(c.charCodeAt(0) - 0x0e50))
    .replace(/(^|[^\d])5{3,}(?!\d)/g, '$1ฮ่าฮ่าฮ่า ')
    .replace(/\d+(?:,\d{3})*(?:\.\d+)?/g, m => { const [i, f] = m.replace(/,/g, '').split('.'); return ' ' + thaiInteger(i) + (f ? 'จุด' + Array.from(f, c => DIGIT[c]).join('') : '') + ' '; })
    .replace(/%/g, ' เปอร์เซ็นต์ ').replace(/ฯลฯ/g, ' และอื่นๆ ').replace(/ๆ/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
/** Text → model input ids: 0, c1, 0, c2, 0 … (characters the voice does not know are skipped). */
function toIds(text, idMap) {
  const ids = [0];
  let space = true; // no leading space, and never two in a row (skipped English words leave gaps)
  for (const ch of normaliseThai(text)) {
    const v = idMap[ch];
    if (!v || !v.length || ch === '^' || ch === '$' || ch === '_' || (ch === ' ' && space)) continue;
    space = ch === ' ';
    ids.push(v[0], 0);
  }
  if (space && ids.length > 1) ids.length -= 2; // trailing space
  return ids;
}
/** Mono float samples → 16-bit WAV, peak-normalised and scaled by volume (0..1). */
function toWav(samples, rate, volume) {
  let peak = 0; for (const s of samples) { const a = Math.abs(s); if (a > peak) peak = a; }
  const gain = peak > 1e-4 ? (0.9 / peak) * Math.max(0, Math.min(1, volume)) : 0, n = samples.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * gain * 32767))), 44 + i * 2);
  return buf;
}

// ---- download / install ----
const tarExe = () => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const extractTgz = (file, dest, members) => new Promise((resolve, reject) =>
  execFile(tarExe(), ['-xzf', file, '-C', dest, '--strip-components=1', ...members], { windowsHide: true }, err => err ? reject(new Error('Could not unpack the voice engine (' + err.message + ')')) : resolve()));

function createThaiTts({ dataDir, fetch, onProgress = () => {}, voices = VOICES, engine = ENGINE, extract = extractTgz, loadOrt }) {
  const root = path.join(dataDir, 'thai-voices'), engineDir = path.join(root, 'engine', 'node_modules'), engineOk = path.join(root, 'engine', 'ok.json');
  const voiceFile = (id, ext) => path.join(root, voices[id].file + ext);
  const installed = id => fs.existsSync(voiceFile(id, '.onnx')) && fs.existsSync(voiceFile(id, '.onnx.json'));
  const engineReady = () => fs.existsSync(engineOk);
  let job = null, loaded = null, queue = Promise.resolve();

  const status = () => ({
    engine: engineReady(), engineSize: engine.reduce((n, p) => n + p.size, 0), license: 'CC-BY-NC-4.0',
    voices: Object.entries(voices).map(([id, v]) => ({ id, size: v.size, installed: installed(id) })),
    job: job && { voice: job.voice, phase: job.phase, received: job.received, total: job.total, bytesPerSec: job.rate },
  });
  const report = (force = false) => { const now = Date.now(); if (!job || (!force && now - job.lastReport < 200)) return; job.lastReport = now; onProgress(status().job); };

  async function download(url, dest, { algo, expect, signal, counted = true }) {
    const part = dest + '.part';
    const r = await fetch(url, { signal });
    if (!r.ok || !r.body) throw new Error('Download failed (HTTP ' + r.status + ')');
    const hash = crypto.createHash(algo), out = fs.createWriteStream(part), reader = r.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        hash.update(value);
        if (!out.write(value)) await new Promise(res => out.once('drain', res));
        if (counted) job.received += value.length; // the small voice settings file is not part of the shown total
        const secs = (Date.now() - job.startedAt) / 1000; // average since the start: steady numbers, no wild first-second ETA
        if (secs >= 1) job.rate = Math.round(job.received / secs);
        report();
      }
      await new Promise((res, rej) => out.end(err => err ? rej(err) : res()));
    } catch (e) { out.destroy(); await fsp.rm(part, { force: true }); throw signal && signal.aborted ? new Error('Download cancelled') : e; }
    const got = algo === 'sha512' ? 'sha512-' + hash.digest('base64') : hash.digest('hex');
    if (got !== expect) { await fsp.rm(part, { force: true }); throw new Error('The downloaded file is damaged (checksum mismatch). Please try again.'); }
    await fsp.rename(part, dest);
  }

  async function installEngine(signal) {
    const tmp = path.join(root, 'tmp');
    await fsp.rm(path.join(root, 'engine'), { recursive: true, force: true });
    await fsp.mkdir(tmp, { recursive: true });
    for (const p of engine) {
      job.phase = 'engine'; report(true);
      const tgz = path.join(tmp, p.name + '.tgz');
      await download(p.url, tgz, { algo: 'sha512', expect: p.integrity, signal });
      job.phase = 'install'; report(true);
      const dest = path.join(engineDir, p.name);
      await fsp.mkdir(dest, { recursive: true });
      await extract(tgz, dest, p.members);
      await fsp.rm(tgz, { force: true });
    }
    await fsp.writeFile(engineOk, JSON.stringify({ version: ORT_VERSION }));
  }

  /** Download (engine on first use) + voice, verify, install. Progress goes to onProgress. One download at a time. */
  async function install(id) {
    if (!voices[id]) throw new Error('Unknown voice');
    if (job) throw new Error('Another voice is downloading. Wait for it or cancel it first.');
    const v = voices[id], needEngine = !engineReady(), controller = new AbortController();
    job = { voice: id, phase: needEngine ? 'engine' : 'voice', received: 0, total: v.size + (needEngine ? engine.reduce((n, p) => n + p.size, 0) : 0), rate: 0, startedAt: Date.now(), lastReport: 0, controller };
    report(true);
    try {
      await fsp.mkdir(root, { recursive: true });
      if (needEngine) await installEngine(controller.signal);
      job.phase = 'voice'; report(true);
      await download(v.jsonUrl, voiceFile(id, '.onnx.json'), { algo: 'sha256', expect: v.jsonSha256, signal: controller.signal, counted: false });
      await download(v.url, voiceFile(id, '.onnx'), { algo: 'sha256', expect: v.sha256, signal: controller.signal });
      job.phase = 'done'; report(true);
    } catch (e) {
      await fsp.rm(voiceFile(id, '.onnx.json'), { force: true }).catch(() => {});
      throw e;
    } finally { job = null; await fsp.rm(path.join(root, 'tmp'), { recursive: true, force: true }).catch(() => {}); }
    return status();
  }
  const cancel = () => { if (job) job.controller.abort(); return true; };
  async function remove(id) {
    if (!voices[id]) throw new Error('Unknown voice');
    if (job && job.voice === id) throw new Error('This voice is downloading. Cancel it first.');
    await queue.catch(() => {});
    if (loaded && loaded.id === id) { const s = loaded.session; loaded = null; await (s.release ? s.release() : null); }
    await fsp.rm(voiceFile(id, '.onnx'), { force: true }); await fsp.rm(voiceFile(id, '.onnx.json'), { force: true });
    return status(); // the engine stays: Windows cannot delete a DLL this app has loaded, and it is reused by the other voices
  }

  const ort = () => loadOrt ? loadOrt() : require(path.join(engineDir, 'onnxruntime-node'));
  async function session(id) {
    if (loaded && loaded.id === id) return loaded;
    const cfg = JSON.parse(await fsp.readFile(voiceFile(id, '.onnx.json'), 'utf8'));
    const o = ort(), threads = Math.max(1, Math.min(4, os.cpus().length - 1));
    const s = await o.InferenceSession.create(voiceFile(id, '.onnx'), { intraOpNumThreads: threads });
    if (loaded && loaded.session.release) await loaded.session.release();
    loaded = { id, session: s, ort: o, map: cfg.phoneme_id_map, rate: (cfg.audio && cfg.audio.sample_rate) || 22050, inference: cfg.inference || {} };
    return loaded;
  }
  /** Thai text → "data:audio/wav;base64,…", or '' when there is nothing Thai to read. One synthesis at a time. */
  function synthesize(text, options) {
    if (typeof text !== 'string' || text.length > 1000) throw new Error('Invalid text');
    const id = options && options.voice;
    if (!voices[id] || !installed(id) || !engineReady()) throw new Error('This Thai AI voice is not downloaded yet (Chat TTS → Thai AI voices).');
    const rate = Math.max(0.5, Math.min(2, Number(options.rate) || 1)), volume = Math.max(0, Math.min(1, Number.isFinite(Number(options.volume)) ? Number(options.volume) : 1));
    const run = queue.then(async () => {
      const m = await session(id), ids = toIds(text, m.map);
      if (ids.length < 3) return '';
      const T = m.ort.Tensor, inf = m.inference;
      const out = await m.session.run({
        input: new T('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
        input_lengths: new T('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
        scales: new T('float32', Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) / rate, inf.noise_w ?? 0.8]), [3]),
      });
      return 'data:audio/wav;base64,' + toWav(out[m.session.outputNames[0]].data, m.rate, volume).toString('base64');
    });
    queue = run.catch(() => {});
    return run;
  }
  return { status, install, cancel, remove, synthesize };
}

module.exports = { createThaiTts, normaliseThai, thaiInteger, toIds, toWav, VOICES, ENGINE, ENGINE_SIZE };
