'use strict';
/*
 * "Online neural voices (Microsoft Edge)" speech engine.
 *
 * Talks to the same free, unofficial Microsoft Edge "Read aloud" WebSocket service that the
 * open-source edge-tts project uses (https://github.com/rany2/edge-tts, ported from
 * src/edge_tts/{constants,drm,communicate}.py at master, 2026-10). No API key, no account.
 * Microsoft can change or stop this service at any time; the UI says so and text is only sent
 * here when the user explicitly selected this engine.
 *
 * Privacy: the only data sent is the SSML for the text being spoken, plus the fixed client token,
 * a random connection id and a random MUID cookie, exactly like Edge's own read-aloud feature.
 */
const crypto = require('node:crypto');
const https = require('node:https');

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const BASE = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split('.')[0];
const SEC_MS_GEC_VERSION = '2-' + CHROMIUM_FULL_VERSION;
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const BASE_HEADERS = {
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'en-US,en;q=0.9',
};
const WSS_HEADERS = { Pragma: 'no-cache', 'Cache-Control': 'no-cache', Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold', ...BASE_HEADERS };

/** Curated voices (no voice-list download needed). Only these names can ever reach the SSML. */
const VOICES = Object.freeze([
  { name: 'th-TH-PremwadeeNeural', lang: 'th-TH', label: 'Premwadee (Thai, female)' },
  { name: 'th-TH-NiwatNeural', lang: 'th-TH', label: 'Niwat (Thai, male)' },
  { name: 'th-TH-AcharaNeural', lang: 'th-TH', label: 'Achara (Thai, female)' },
  { name: 'en-US-AvaNeural', lang: 'en-US', label: 'Ava (US English, female)' },
  { name: 'en-US-AndrewNeural', lang: 'en-US', label: 'Andrew (US English, male)' },
  { name: 'en-US-EmmaNeural', lang: 'en-US', label: 'Emma (US English, female)' },
  { name: 'en-US-BrianNeural', lang: 'en-US', label: 'Brian (US English, male)' },
  { name: 'en-GB-SoniaNeural', lang: 'en-GB', label: 'Sonia (UK English, female)' },
].map(Object.freeze));
const VOICE_NAMES = new Set(VOICES.map(v => v.name));
const MAX_CHARS = 500;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

// ---------------------------------------------------------------------------------------------
// Sec-MS-GEC v2 token (port of edge_tts/drm.py generate_sec_ms_gec_v2). Verified against the
// Python reference with fixed timestamps in tests/edgeTts.test.cjs.
const M = 0xffffffff;
const add = (...xs) => xs.reduce((a, b) => (a + b) >>> 0, 0);
const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
const rol16 = x => (((x << 16) | (x >>> 16)) >>> 0);
const mul = (a, b) => Math.imul(a, b) >>> 0;
const SHA_INITIAL = [0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19];
const SHA_STATE = [0xFD9FBEA2, 0x91243CE7, 0xBE499094, 0xCD2E1E0A, 0x6C006F49, 0x04BD35AB, 0xFEB0A7E4, 0x03EFFBD2];
const SHA_SCHEDULE = [0xEB24BF9E, 0x1558691F, 0xA0C09EE2, 0x0CFA32BA, 0xA622EE8C, 0xD1DD9491, 0xC0DD25A0, 0xF9E70AB6, 0xF0C31573, 0x7058CE4E, 0x7188E606, 0x00E5AB33, 0xD258B060, 0x72766564];
const K = [0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5, 0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174, 0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA, 0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967, 0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85, 0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070, 0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3, 0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2];
const SHA_ADJ = 0xC9DC06A7;
const K_BLOCK = [...K.slice(0, 14), SHA_ADJ, ...K.slice(15)];
const SIGMA0_ADJ = 0x059C0B80, SIGMA1_ADJ = 0x000B92C0;
const CS64 = [[0xE82E91B1, 0xB32700D0], [0x44DE24C6, 0x88DFF51D], [0x3BEB65BC, 0x29514038], [0xC89C5933, 0xB328CBDF], [0x8D1EC211, 0xD405B4D5], [0x314EF5D5, 0x26E55F3C], [0xE92491B1, 0x607801C6], [0xF0A5B9D5, 0x82B2C1FB], [0x06064CF3, 0xFA51A3DA], [0xDA79FA60, 0x207CC464], [0xBED20560, 0x3C3C74F3], [0x89F9C9F8, 0xD2D14B61], [0x35FA38C6, 0xBB04A2C1], [0xCB49E3C6, 0xC5626167]];
const CS64_FACTOR = 0x82893933, CS64_ADJ0 = 0xF2F90B1A, CS64_ADJ1 = 0x0B1A0000;
const sigma0 = v => (rotr(v, 7) ^ rotr(v, 18) ^ (v >>> 3)) >>> 0;
const sigma1 = v => (rotr(v, 17) ^ rotr(v, 19) ^ (v >>> 10)) >>> 0;
const bigSigma0 = a => (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
const bigSigma1 = e => (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
function rounds(state, words, first = 0) {
  let [a, b, c, d, e, f, g, h] = state;
  const k = first === 14 ? K_BLOCK : K;
  for (let i = first; i < 64; i++) {
    const t1 = add(h, bigSigma1(e), (g ^ (e & (f ^ g))) >>> 0, k[i], words[i]);
    const t2 = add(bigSigma0(a), ((a & b) | (c & (a | b))) >>> 0);
    h = g; g = f; f = e; e = add(d, t1); d = c; c = b; b = a; a = add(t1, t2);
  }
  return [a, b, c, d, e, f, g, h];
}
function expand(words, first = 16) {
  for (let i = first; i < 64; i++) words.push(add(sigma1(words[i - 2]), words[i - 7], sigma0(words[i - 15]), words[i - 16]));
}
const be = (buf, start, len) => { let v = 0; for (let i = start; i < start + len; i++) v = (v * 256 + (buf[i] || 0)); return v >>> 0; };
function shaInit(data7) {
  const words = new Array(14).fill(0);
  words.push(be(data7, 0, 3), be(data7, 3, 4));
  for (let i = 16; i < 30; i++) {
    let v = SHA_SCHEDULE[i - 16];
    if (i - 2 >= 14) v = add(v, i === 16 ? (sigma1(words[i - 2]) ^ SIGMA1_ADJ) >>> 0 : sigma1(words[i - 2]));
    if (i - 7 >= 14) v = add(v, words[i - 7]);
    if (i - 15 >= 14) v = add(v, i === 29 ? (sigma0(words[i - 15]) ^ SIGMA0_ADJ) >>> 0 : sigma0(words[i - 15]));
    words.push(v);
  }
  words.push((sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + SHA_ADJ - K[14]) >>> 0);
  expand(words, 31);
  const working = rounds(SHA_STATE, words, 14);
  return SHA_INITIAL.map((x, i) => add(x, working[i]));
}
function shaDigest(data) {
  if (data.length < 7) throw new Error('Token salt must contain at least seven bytes');
  const length = 57 + data.length;
  const padLen = (((55 - length) % 64) + 64) % 64;
  const tail = Buffer.concat([data.subarray(7), Buffer.from([0x80]), Buffer.alloc(padLen), Buffer.alloc(8)]);
  tail.writeBigUInt64BE(BigInt(length * 8), tail.length - 8);
  let state = shaInit(data.subarray(0, 7));
  for (let off = 0; off < tail.length; off += 64) {
    const words = []; for (let i = 0; i < 16; i++) words.push(tail.readUInt32BE(off + i * 4));
    expand(words);
    const working = rounds(state, words);
    state = state.map((x, i) => add(x, working[i]));
  }
  const out = Buffer.alloc(32); state.forEach((x, i) => out.writeUInt32BE(x, i * 4)); return out;
}
function cs64Digest(data, digest) {
  let keyA = digest.readUInt32LE(0) | 1, keyB = digest.readUInt32LE(4) | 1;
  keyA >>>= 0; keyB >>>= 0;
  const factors = [mul(keyA, CS64_FACTOR), mul(keyB, CS64_FACTOR)];
  const terms = CS64.map(([coef], i) => mul(coef, factors[i % 2]));
  const offsets = CS64.map(([, o]) => o);
  const raw = Buffer.concat([Buffer.from([0]), data]);
  const padded = Buffer.concat([raw, Buffer.alloc((4 - (raw.length % 4)) % 4)]);
  const words = []; for (let i = 0; i < padded.length; i += 4) words.push(padded.readUInt32LE(i));
  if (words.length % 2) words.push(0);
  words.forEach((w, i) => {
    let term = mul(w, i % 2 === 0 ? keyA : keyB);
    let offset = mul(rol16(w), i % 2 === 0 ? 0xEF0569FB : 0xC31713DB);
    if (i === 0) { term = add(term, mul(CS64_ADJ0, factors[0])); offset = add(offset, CS64_ADJ1); }
    terms.push(term); offsets.push(offset);
  });
  let swapAcc = 0, swapLast = 0, state = 0, acc = 0;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i], y = terms[i + 1];
    let t = rol16(add(offsets[i], x)); let q = mul(t, 0x76F50F34);
    swapAcc = add(swapAcc, add(mul(rol16(q), 0xC3EFEA97), q));
    t = rol16(add(offsets[i + 1], y)); q = mul(t, 0x1881CE3C);
    swapLast = add(mul(rol16(q), 0x35BD1EC9), q);
    swapAcc = add(swapAcc, swapLast);
    state = add(mul(state, keyA), x);
    state = mul(rol16(state), 0xCF98B111); state = mul(rol16(state), 0x87085B9F);
    state = mul(rol16(state), 0x12CEB96D); state = mul(rol16(state), 0x257E1D83);
    acc = add(acc, state);
    t = add(mul(state, keyB), y);
    t = mul(rol16(t), 0xA27416F5); t = mul(rol16(t), 0xD38396FF);
    state = mul(rol16(mul(rol16(t), 0x7C932B89)), 0xBFA49F69);
    acc = add(acc, state);
  }
  return [(swapLast ^ state) >>> 0, (swapAcc ^ acc) >>> 0];
}
let clockSkewSeconds = 0;
function secMsGec(unixSeconds = Date.now() / 1000 + clockSkewSeconds) {
  let ticks = unixSeconds + 11644473600;
  ticks -= ticks % 300;
  const str = (BigInt(Math.round(ticks)) * 10000000n).toString() + TRUSTED_CLIENT_TOKEN;
  const data = Buffer.from(str, 'ascii');
  const digest = shaDigest(data);
  const [c0, c1] = cs64Digest(data, digest);
  const cs = Buffer.alloc(8); cs.writeUInt32LE(c0, 0); cs.writeUInt32LE(c1, 4);
  return cs.toString('hex').toUpperCase() + '-' + digest.toString('hex').toUpperCase();
}

// ---------------------------------------------------------------------------------------------
// Request building
/** Escape for XML text content and attribute values; strips control characters the service rejects. */
function escapeXml(text) {
  return String(text)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/[\ud800-\udfff]/g, ch => ch) // keep valid surrogate pairs (emoji); lone ones are handled below
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function validateRequest(text, options) {
  if (typeof text !== 'string' || !text.trim() || Array.from(text).length > MAX_CHARS)
    throw new Error(`Speech text must contain between 1 and ${MAX_CHARS} characters.`);
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Invalid speech options.');
  if (typeof options.voice !== 'string' || !VOICE_NAMES.has(options.voice)) throw new Error('Unknown online voice.');
  const rate = typeof options.rate === 'number' && Number.isFinite(options.rate) ? Math.max(0.5, Math.min(2, options.rate)) : 1;
  const volume = typeof options.volume === 'number' && Number.isFinite(options.volume) ? Math.max(0, Math.min(1, options.volume)) : 1;
  // Lone surrogates make the service fail; drop them.
  const clean = text.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '');
  return { text: clean, voice: options.voice, rate, volume };
}
const pct = n => (n >= 0 ? '+' : '') + Math.round(n) + '%';
function buildSsml({ text, voice, rate, volume }) {
  if (!VOICE_NAMES.has(voice)) throw new Error('Unknown online voice.');
  return "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>"
    + `<voice name='${voice}'><prosody pitch='+0Hz' rate='${pct((rate - 1) * 100)}' volume='${pct((volume - 1) * 100)}'>`
    + escapeXml(text) + '</prosody></voice></speak>';
}
const jsDate = () => new Date().toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) /, '$1 $3 $2 $4 ').replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
const connectId = () => crypto.randomUUID().replace(/-/g, '');
const configMessage = () => `X-Timestamp:${jsDate()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n`
  + `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"${OUTPUT_FORMAT}"}}}}\r\n`;
const ssmlMessage = ssml => `X-RequestId:${connectId()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${jsDate()}Z\r\nPath:ssml\r\n\r\n${ssml}`;
/** Binary frame: 2-byte big-endian header length, headers, then audio (same slicing as edge-tts). */
function parseBinary(buf) {
  if (buf.length < 2) throw new Error('Malformed audio frame.');
  const headerLength = buf.readUInt16BE(0);
  if (headerLength > buf.length) throw new Error('Malformed audio frame.');
  const headers = {};
  for (const line of buf.subarray(0, headerLength).toString('utf8').split('\r\n')) {
    const i = line.indexOf(':'); if (i > 0) headers[line.slice(0, i).replace(/^[\s\S]*?(?=[A-Za-z])/, '')] = line.slice(i + 1);
  }
  return { headers, data: buf.subarray(headerLength + 2) };
}
const textPath = s => (/(?:^|\r\n)Path:([^\r\n]+)/.exec(s) || [])[1];

// ---------------------------------------------------------------------------------------------
// Network
const friendly = {
  offline: 'Online voices need an internet connection. Check your connection, or switch the speech engine to Windows voices.',
  refused: 'Microsoft refused the online voice request. The free service may have changed or be temporarily unavailable. Try again later, or switch to Windows voices.',
  timeout: 'The online voice service did not answer in time. Check your internet connection, or switch to Windows voices.',
  noAudio: 'The online voice service returned no audio. Try again, or switch to Windows voices.',
  tooBig: 'Generated speech exceeds the audio size limit.',
};
/** HTTPS probe of the voice list endpoint: tells "offline" from "refused" and gives the server Date for clock-skew fixes. Sends no text. */
function probe(timeoutMs = 8000) {
  return new Promise((resolve) => {
    const url = `https://${BASE}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
    const req = https.get(url, { headers: { ...BASE_HEADERS, 'Accept-Encoding': 'identity' }, timeout: timeoutMs }, res => { res.resume(); resolve({ status: res.statusCode, date: res.headers.date }); });
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.on('error', e => resolve({ error: ['ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH'].includes(e.code) ? 'offline' : 'offline' }));
  });
}
// Swappable in tests only (tests/edgeTts.test.cjs) to simulate offline / refused / slow networks.
const transport = { WebSocket: () => globalThis.WebSocket, probe: (...a) => probe(...a) };
function openSocket(url, headers) {
  const WS = transport.WebSocket();
  if (typeof WS !== 'function') throw new Error('This version of Allhouse cannot open WebSocket connections.');
  return new WS(url, { headers }); // Node/undici WebSocket accepts custom handshake headers
}
const timeouts = { connectTimeoutMs: 10000, totalTimeoutMs: 30000 };
function synthesizeOnce(request, { connectTimeoutMs, totalTimeoutMs } = timeouts) {
  return new Promise((resolve, reject) => {
    const url = `wss://${BASE}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connectId()}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
    let ws, opened = false, settled = false, bytes = 0;
    const chunks = [];
    const finish = (err, value) => {
      if (settled) return; settled = true; clearTimeout(connectTimer); clearTimeout(totalTimer);
      try { ws && ws.close(); } catch {}
      err ? reject(err) : resolve(value);
    };
    const connectTimer = setTimeout(() => finish(Object.assign(new Error(friendly.timeout), { kind: 'timeout' })), connectTimeoutMs);
    const totalTimer = setTimeout(() => finish(Object.assign(new Error(friendly.timeout), { kind: 'timeout' })), totalTimeoutMs);
    try { ws = openSocket(url, { ...WSS_HEADERS, Cookie: `muid=${crypto.randomBytes(16).toString('hex').toUpperCase()};` }); }
    catch (e) { return finish(e); }
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => {
      opened = true; clearTimeout(connectTimer);
      ws.send(configMessage());
      ws.send(ssmlMessage(buildSsml(request)));
    });
    ws.addEventListener('message', ev => {
      if (typeof ev.data === 'string') {
        const path = textPath(ev.data);
        if (path === 'turn.end') {
          if (!bytes) return finish(Object.assign(new Error(friendly.noAudio), { kind: 'noAudio' }));
          return finish(null, Buffer.concat(chunks));
        }
        return;
      }
      try {
        const { headers, data } = parseBinary(Buffer.from(ev.data));
        if (headers.Path !== 'audio' || !data.length) return;
        if (headers['Content-Type'] && headers['Content-Type'] !== 'audio/mpeg') return finish(new Error('Unexpected audio type from the online voice service.'));
        bytes += data.length; chunks.push(data);
        if (bytes > MAX_AUDIO_BYTES) finish(new Error(friendly.tooBig));
      } catch (e) { finish(e); }
    });
    ws.addEventListener('error', () => finish(Object.assign(new Error(opened ? friendly.noAudio : friendly.refused), { kind: opened ? 'noAudio' : 'handshake' })));
    ws.addEventListener('close', () => finish(Object.assign(new Error(friendly.noAudio), { kind: 'noAudio' })));
  });
}
let chain = Promise.resolve();
function serial(task) { const run = chain.catch(() => {}).then(task); chain = run.catch(() => {}); return run; }

/** Synthesize text → `data:audio/mpeg;base64,...`. Retries once after fixing clock skew if the handshake is refused. */
async function synthesize(text, options) {
  const request = validateRequest(text, options);
  return serial(async () => {
    let audio;
    try { audio = await synthesizeOnce(request); }
    catch (e) {
      if (e.kind !== 'handshake') throw e;
      const p = await transport.probe();
      if (p.error) throw new Error(p.error === 'timeout' ? friendly.timeout : friendly.offline);
      const server = p.date ? Date.parse(p.date) : NaN;
      if (Number.isFinite(server) && Math.abs(server / 1000 - (Date.now() / 1000 + clockSkewSeconds)) > 60) {
        clockSkewSeconds = server / 1000 - Date.now() / 1000;
        audio = await synthesizeOnce(request).catch(err => { throw err.kind === 'handshake' ? new Error(friendly.refused) : err; });
      } else throw new Error(friendly.refused);
    }
    // Minimal sanity check: MPEG audio frame sync or ID3 tag.
    if (audio.length < 256 || !((audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0) || audio.subarray(0, 3).toString() === 'ID3')) throw new Error(friendly.noAudio);
    return 'data:audio/mpeg;base64,' + audio.toString('base64');
  });
}
const listVoices = () => VOICES.map(v => ({ ...v }));

module.exports = { synthesize, listVoices, validateRequest, buildSsml, escapeXml, secMsGec, parseBinary, MAX_CHARS, VOICES, _internal: { jsDate, configMessage, ssmlMessage, transport, timeouts, friendly } };
