// Online neural voices (electron/edgeTts.cjs): token, SSML safety, limits and failure messages.
// Network synthesis runs only with ALLHOUSE_ONLINE_TESTS=1 (it sends the test sentence to Microsoft).
const test = require('node:test');
const assert = require('node:assert/strict');
const tts = require('../electron/edgeTts.cjs');
const { transport, timeouts, friendly } = tts._internal;

test('Sec-MS-GEC v2 matches the edge-tts Python reference for fixed timestamps', () => {
  // Vectors produced by edge_tts.drm.generate_sec_ms_gec_v2 (rany2/edge-tts master, 2026-10).
  const vectors = {
    0: '52BC7A17B50DFEC9-28C4394775C8751CD2F6859C030C06DB1489ACAB3B3A7651831FC26895177ED6',
    1700000000: '2CD23A2CA0B2595A-F3C846C370E05F9CC83ACC5F995C5F5D87A4D0F14CE8936A0F902E64099E38A2',
    1792494000.5: 'F66E771A24FD7D83-7A2F175488634B051352C06E50AE41B94EAACD2B5EB06FB7C58A9A52F1327A4B',
    1800000123: '99E54519B490BE5C-E162DB0977FBDCB9B86DD8148BF1BCDC3C0303176CE39852A42B415935C20654',
  };
  for (const [ts, expected] of Object.entries(vectors)) assert.equal(tts.secMsGec(Number(ts)), expected, 'ts ' + ts);
  assert.equal(tts.secMsGec(1700000000), tts.secMsGec(1700000000 + 99), 'token is stable within a 5-minute window');
  assert.notEqual(tts.secMsGec(1700000000), tts.secMsGec(1700000100), 'and changes at the next window');
});

test('SSML escaping: chat text cannot inject XML, SSML tags, attributes or switch voices', () => {
  const hostile = [
    `</prosody></voice><voice name='en-US-GuyNeural'>pwned`,
    `<speak><audio src="http://evil.example/x.mp3"/></speak>`,
    `<![CDATA[ x ]]> <!-- c --> <?xml version="1.0"?> <!DOCTYPE x [<!ENTITY e SYSTEM "file:///c:/windows/win.ini">]> &e;`,
    `' onload='x' "quoted" & &amp; &#x41;`,
    `<img src=x onerror=alert(1)><script>alert(2)</script>`,
    'tab\tvt\u000bnul\u0000bell\u0007 ok',
  ];
  for (const text of hostile) {
    const ssml = tts.buildSsml({ text, voice: 'th-TH-PremwadeeNeural', rate: 1, volume: 1 });
    const inner = ssml.slice(ssml.indexOf("'+0%'>") + "'+0%'>".length, ssml.lastIndexOf('</prosody>'));
    assert.doesNotMatch(inner, /[<>]/, 'no raw angle brackets in text: ' + text);
    assert.doesNotMatch(inner, /&(?!(amp|lt|gt|quot|apos);)/, 'every & starts a known entity');
    assert.doesNotMatch(inner, /'/, 'no raw apostrophe');
    assert.doesNotMatch(inner, /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/, 'control characters removed');
    assert.equal((ssml.match(/<voice /g) || []).length, 1, 'exactly one voice element');
    assert.equal((ssml.match(/<\/prosody>/g) || []).length, 1);
    assert.ok(ssml.startsWith("<speak version='1.0'") && ssml.endsWith('</prosody></voice></speak>'));
  }
  assert.equal(tts.escapeXml(`a<b>&'"`), 'a&lt;b&gt;&amp;&apos;&quot;');
  assert.equal(tts.escapeXml('สวัสดี 💚 Allhouse'), 'สวัสดี 💚 Allhouse', 'Thai and emoji pass through');
});

test('only allow-listed voices reach the SSML attribute', () => {
  for (const voice of ["th-TH-PremwadeeNeural' xml:lang='x", 'en-US-GuyNeural', '', null, 42, 'Microsoft David Desktop'])
    assert.throws(() => tts.validateRequest('hi', { voice, rate: 1, volume: 1 }), /Unknown online voice|Invalid/);
  assert.throws(() => tts.buildSsml({ text: 'hi', voice: "x'><evil/>", rate: 1, volume: 1 }), /Unknown online voice/);
  assert.ok(tts.listVoices().some(v => v.name === 'th-TH-PremwadeeNeural' && v.lang === 'th-TH'));
  assert.ok(tts.listVoices().some(v => v.name === 'th-TH-NiwatNeural'));
  assert.ok(tts.listVoices().some(v => v.lang.startsWith('en-')));
});

test('text length limits, option validation and prosody clamping', () => {
  const v = { voice: 'th-TH-NiwatNeural', rate: 1, volume: 1 };
  for (const bad of ['', '   ', '\n\t', 42, null, undefined, {}, 'ก'.repeat(tts.MAX_CHARS + 1), '💚'.repeat(tts.MAX_CHARS + 1)])
    assert.throws(() => tts.validateRequest(bad, v), /between 1 and 500/);
  assert.doesNotThrow(() => tts.validateRequest('ก'.repeat(tts.MAX_CHARS), v));
  assert.doesNotThrow(() => tts.validateRequest('💚'.repeat(tts.MAX_CHARS), v), 'limit counts characters, not UTF-16 units');
  for (const bad of [null, [], 'th-TH-NiwatNeural']) assert.throws(() => tts.validateRequest('hi', bad), /Invalid speech options/);
  const r = tts.validateRequest('hi', { voice: 'th-TH-NiwatNeural', rate: 9, volume: -3 });
  assert.equal(r.rate, 2); assert.equal(r.volume, 0);
  const ssml = tts.buildSsml(r);
  assert.match(ssml, /rate='\+100%' volume='-100%'/);
  assert.match(tts.buildSsml(tts.validateRequest('hi', { voice: 'en-US-AvaNeural', rate: 'fast', volume: NaN })), /rate='\+0%' volume='\+0%'/);
  assert.equal(tts.validateRequest('a\ud800b', v).text, 'ab', 'lone surrogates dropped');
});

test('wire messages follow the edge-tts framing', () => {
  const { configMessage, ssmlMessage, jsDate } = tts._internal;
  assert.match(jsDate(), /^\w{3} \w{3} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT\+0000 \(Coordinated Universal Time\)$/);
  assert.match(configMessage(), /Path:speech\.config\r\n\r\n\{"context".*audio-24khz-48kbitrate-mono-mp3/);
  const m = ssmlMessage('<speak/>');
  assert.match(m, /^X-RequestId:[0-9a-f]{32}\r\nContent-Type:application\/ssml\+xml\r\nX-Timestamp:.+Z\r\nPath:ssml\r\n\r\n<speak\/>$/);
  const header = Buffer.from('Path:audio\r\nContent-Type:audio/mpeg\r\n');
  const frame = Buffer.concat([Buffer.from([0, header.length]), header, Buffer.from([0xff, 0xf3, 1, 2])]);
  const parsed = tts.parseBinary(frame);
  assert.equal(parsed.headers.Path, 'audio'); assert.equal(parsed.headers['Content-Type'], 'audio/mpeg');
  assert.equal(parsed.data.length, 4, 'audio starts at offset header_length + 2, as in edge-tts');
  assert.throws(() => tts.parseBinary(Buffer.from([0xff, 0xff, 0])), /Malformed/);
});

// ---- simulated network failures (no traffic leaves the machine) ----
function withTransport(t, ws, probe) {
  const saved = { ...transport }, savedTimeouts = { ...timeouts };
  transport.WebSocket = () => ws; if (probe) transport.probe = probe;
  t.after(() => { Object.assign(transport, saved); Object.assign(timeouts, savedTimeouts); });
}
class FailingSocket { constructor() { setTimeout(() => this.l.error?.(), 5); } set binaryType(_) {} addEventListener(k, f) { (this.l ||= {})[k] = f; } close() {} send() { throw new Error('must not send'); } }
class SilentSocket { set binaryType(_) {} addEventListener() {} close() {} send() {} }

test('offline: handshake failure + unreachable host gives a clear offline message', async t => {
  withTransport(t, FailingSocket, async () => ({ error: 'offline' }));
  await assert.rejects(tts.synthesize('สวัสดี', { voice: 'th-TH-PremwadeeNeural' }), err => err.message === friendly.offline && /internet connection/.test(err.message));
});

test('refused: reachable service that rejects the handshake says Microsoft refused it', async t => {
  withTransport(t, FailingSocket, async () => ({ status: 403, date: new Date().toUTCString() }));
  await assert.rejects(tts.synthesize('hello', { voice: 'en-US-AvaNeural' }), { message: friendly.refused });
});

test('timeout: a socket that never opens fails within the connect timeout', async t => {
  withTransport(t, SilentSocket);
  timeouts.connectTimeoutMs = 50; timeouts.totalTimeoutMs = 200;
  const started = Date.now();
  await assert.rejects(tts.synthesize('hello', { voice: 'en-US-AvaNeural' }), { message: friendly.timeout });
  assert.ok(Date.now() - started < 1000);
});

test('invalid input is rejected before any connection is attempted', async t => {
  let opened = 0;
  withTransport(t, class { constructor() { opened++; } });
  await assert.rejects(tts.synthesize('x'.repeat(501), { voice: 'th-TH-NiwatNeural' }));
  await assert.rejects(tts.synthesize('hi', { voice: 'evil' }));
  assert.equal(opened, 0);
});

test('LIVE: Thai sentence synthesizes to a plausible MP3', { skip: process.env.ALLHOUSE_ONLINE_TESTS !== '1' && 'set ALLHOUSE_ONLINE_TESTS=1 (sends text to Microsoft)' }, async () => {
  const url = await tts.synthesize('สวัสดีครับ ยินดีต้อนรับสู่ Allhouse', { voice: 'th-TH-PremwadeeNeural', rate: 1, volume: 1 });
  assert.match(url, /^data:audio\/mpeg;base64,/);
  const bytes = Buffer.from(url.split(',')[1], 'base64');
  assert.ok(bytes.length > 8000 && bytes.length < 200000, 'size ' + bytes.length);
  assert.equal(bytes[0], 0xff); assert.equal(bytes[1] & 0xe0, 0xe0);
});
