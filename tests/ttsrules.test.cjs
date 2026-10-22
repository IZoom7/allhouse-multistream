'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { validateState, defaultState } = require('../electron/runtime.cjs');
const { validateSpeechCommand, validateSpeechStatus } = require('../electron/windows.cjs');

// Load src/ttsRules.ts (pure, type-only imports) by transpiling it to CommonJS.
function loadRules() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ttsRules.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, require);
  return mod.exports;
}
const R = loadRules();
const rules = (patch = {}) => ({ ...R.DEFAULT_TTS_RULES, ...patch, platforms: { ...R.DEFAULT_TTS_RULES.platforms, ...(patch.platforms || {}) } });

test('per-platform: YouTube muted, TikTok read', () => {
  const r = rules({ platforms: { youtube: false } });
  assert.deepEqual(R.speechFor({ platform: 'youtube', name: 'a', message: 'hello' }, r), { skip: 'platform' });
  assert.deepEqual(R.speechFor({ platform: 'tiktok', name: 'a', message: 'hello' }, r), { text: 'hello' });
});

test('ignored names (case, @, commas/lines), bot commands, links, empty', () => {
  const r = rules({ ignoreNames: 'Nightbot,\n @StreamElements ' });
  assert.deepEqual(R.speechFor({ platform: 'twitch', name: 'nightbot', message: 'hi' }, r), { skip: 'ignored-name' });
  assert.deepEqual(R.speechFor({ platform: 'twitch', name: '@streamelements', message: 'hi' }, r), { skip: 'ignored-name' });
  assert.deepEqual(R.speechFor({ platform: 'twitch', name: 'v', message: '!points' }, r), { skip: 'command' });
  assert.deepEqual(R.speechFor({ platform: 'twitch', name: 'v', message: '!points' }, rules({ skipCommands: false })), { text: '!points' });
  assert.deepEqual(R.speechFor({ platform: 'kick', name: 'v', message: 'ดู https://x.y/z นี่' }, r), { text: 'ดู นี่' });
  assert.deepEqual(R.speechFor({ platform: 'kick', name: 'v', message: 'https://x.y' }, r), { skip: 'empty' });
});

test('read the name first (Thai or English connector) and cut long messages without splitting Thai marks', () => {
  assert.deepEqual(R.speechFor({ platform: 'tiktok', name: 'mint', message: 'สวัสดี' }, rules({ readName: true })), { text: 'mint บอกว่า สวัสดี' });
  assert.deepEqual(R.speechFor({ platform: 'tiktok', name: 'mint', message: 'hello' }, rules({ readName: true })), { text: 'mint says hello' });
  const long = R.speechFor({ platform: 'tiktok', name: 'v', message: 'ก'.repeat(19) + 'กี่' + 'x'.repeat(50) }, rules({ maxChars: 20 }));
  assert.ok(!/[ัิ-ฺ็-๎]$/.test(long.text), 'never ends on a dangling vowel/tone mark');
  assert.ok(Array.from(long.text).length <= 20);
});

test('custom name template: {user} {message} {platform}, no re-expansion, message appended if missing', () => {
  const say = (tpl, message = 'hello', platform = 'kick') => R.speechFor({ platform, name: '@mint', message }, rules({ readName: true, nameTemplate: tpl }));
  assert.deepEqual(say('{user} จาก {platform} พูดว่า {message}'), { text: 'mint จาก Kick พูดว่า hello' });
  assert.deepEqual(say('{message} — {USER}'), { text: 'hello — mint' });
  assert.deepEqual(say('{user} says {message}', 'try {user} $&'), { text: 'mint says try {user} $&' });
  assert.deepEqual(say('ข้อความจาก {user}'), { text: 'ข้อความจาก mint hello' });
  assert.deepEqual(say('   '), { text: 'mint says hello' }, 'blank = automatic');
  assert.deepEqual(R.speechFor({ platform: 'kick', name: 'mint', message: 'hello' }, rules({ nameTemplate: '{user}: {message}' })), { text: 'hello' }, 'off = message only');
});

test('rulesOf fills defaults for older workspaces', () => {
  assert.deepEqual(R.rulesOf({}), R.DEFAULT_TTS_RULES);
  assert.equal(R.rulesOf({ rules: { ...R.DEFAULT_TTS_RULES, platforms: { youtube: false } } }).platforms.twitch, true);
});

test('runtime validation: rules optional, saved cleanly, bad values rejected', () => {
  const s = defaultState();
  assert.equal(validateState(s).tts.rules, undefined, 'absent stays absent');
  s.tts.rules = { ...rules({ platforms: { youtube: false } }), extra: 'drop me' };
  const v = validateState(s).tts.rules;
  assert.equal(v.platforms.youtube, false);
  assert.equal(v.extra, undefined);
  assert.equal(v.nameTemplate, undefined, 'no template stays absent');
  const s2 = defaultState(); s2.tts.rules = rules({ nameTemplate: '{user}: {message}' });
  assert.equal(validateState(s2).tts.rules.nameTemplate, '{user}: {message}');
  for (const bad of [{ maxChars: 5 }, { nameTemplate: 'x'.repeat(201) }, { nameTemplate: 7 }, { ignoreNames: 'x'.repeat(2001) }, { readName: 'yes' }, { platforms: { twitch: 'no' } }]) {
    const b = defaultState(); b.tts.rules = rules(bad);
    assert.throws(() => validateState(b), /chat reading rules/, JSON.stringify(bad));
  }
});

test('pop-out relay: platform switches validated in commands and status', () => {
  const p = { twitch: true, youtube: false, kick: true, tiktok: true };
  assert.deepEqual(validateSpeechCommand({ cmd: 'set', patch: { platforms: p } }), { cmd: 'set', patch: { platforms: p } });
  assert.throws(() => validateSpeechCommand({ cmd: 'set', patch: { platforms: { twitch: 1 } } }));
  assert.equal(validateSpeechStatus({ platforms: { youtube: false } }).platforms.youtube, false);
  assert.equal(validateSpeechStatus({}).platforms, undefined);
});

test('single-voice setting: optional, boolean only, saved', () => {
  const s = defaultState();
  assert.equal(validateState(s).tts.singleVoice, undefined);
  s.tts.singleVoice = true;
  assert.equal(validateState(s).tts.singleVoice, true);
  s.tts.singleVoice = 'yes';
  assert.throws(() => validateState(s), /speech settings/);
});
