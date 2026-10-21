'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function invoke(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive',
      '-Command', fs.readFileSync(path.join(__dirname, '..', 'scripts', 'speech.ps1'), 'utf8'),
    ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Local speech timed out. Try a shorter message.'));
    }, 20000);
    child.stdout.on('data', data => {
      output += data.toString('utf8');
      if (output.length > 12 * 1024 * 1024) {
        child.kill();
        finish(new Error('Generated speech exceeds the audio size limit.'));
      }
    });
    child.stderr.resume();
    child.on('error', () => finish(new Error('Windows speech is unavailable on this computer.')));
    child.on('close', code => {
      if (code !== 0) return finish(new Error('Windows could not generate speech. Check the selected voice.'));
      try {
        const value = JSON.parse(output.replace(/^\uFEFF/, '').trim());
        if (value.error) return finish(new Error(value.error));
        finish(null, value);
      } catch { finish(new Error('Windows returned an invalid speech response.')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(payload), 'utf8');
  });
}

function validateSpeakRequest(text, options) {
  if (typeof text !== 'string' || !text.trim() || Array.from(text).length > 500)
    throw new Error('Speech text must contain between 1 and 500 characters.');
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error('Invalid speech options.');
  if (typeof options.voice !== 'string' || !options.voice.trim() || options.voice.length > 200 || /[\u0000-\u001f]/.test(options.voice))
    throw new Error('Select an installed voice before playing speech.');
  const rate = typeof options.rate === 'number' && Number.isFinite(options.rate) ? Math.max(0.5, Math.min(2, options.rate)) : 1;
  const volume = typeof options.volume === 'number' && Number.isFinite(options.volume) ? Math.max(0, Math.min(1, options.volume)) : 1;
  return { text, voice: options.voice, rate, volume };
}

// One PowerShell synthesis at a time so a burst of chat cannot spawn dozens of processes.
let chain = Promise.resolve();
function serial(task) {
  const run = chain.catch(() => {}).then(task);
  chain = run.catch(() => {});
  return run;
}

let voiceCache = null;
async function listVoices({ refresh = false } = {}) {
  if (process.platform !== 'win32') return [];
  if (voiceCache && !refresh) return voiceCache.map(v => ({ ...v }));
  const result = await serial(() => invoke({ action: 'voices' }));
  voiceCache = (Array.isArray(result.voices) ? result.voices : [])
    .filter(v => v && typeof v.name === 'string' && typeof v.lang === 'string')
    .map(v => ({ name: v.name, lang: v.lang }));
  return voiceCache.map(v => ({ ...v }));
}

async function speak(text, options) {
  const request = validateSpeakRequest(text, options);
  if (process.platform !== 'win32') throw new Error('Windows speech is only available on Windows.');
  const result = await serial(() => invoke({ action: 'speak', ...request }));
  if (typeof result.audio !== 'string' || !result.audio.startsWith('data:audio/wav;base64,'))
    throw new Error('No speech audio was generated.');
  return result.audio;
}

module.exports = { listVoices, speak, validateSpeakRequest };
