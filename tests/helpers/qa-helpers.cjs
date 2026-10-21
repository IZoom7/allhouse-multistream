const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const vm = require('node:vm');
const { createRuntime, validateState, defaultState } = require('../../electron/runtime.cjs');
const delay = ms => new Promise(r => setTimeout(r, ms));
async function tmpDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'allhouse-qa-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}
async function fixture(t, dir) {
  dir = dir || await tmpDir(t);
  let runtime = await createRuntime({ dataDir: dir, port: 0 });
  t.after(() => runtime.close());
  return {
    dir,
    get runtime() { return runtime; },
    async restart() { await runtime.close(); runtime = await createRuntime({ dataDir: dir, port: 0 }); return runtime; },
  };
}
const sample = (extra = {}) => ({ platform: 'twitch', type: 'chat', name: 'viewer', message: 'hello', target: 'preview', ...extra });
function request(url, { headers = {}, method = 'GET', raw } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { headers, method }, res => {
      let body = ''; res.setEncoding('utf8');
      res.on('data', c => { body += c; if (res.headers['content-type'] === 'text/event-stream') { req.destroy(); resolve({ status: res.statusCode, headers: res.headers, body }); } });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
}
// Raw TCP request so Host can be omitted / malformed exactly.
function rawRequest(port, text) {
  return new Promise((resolve, reject) => {
    const s = net.connect(port, '127.0.0.1', () => s.write(text));
    let out = ''; s.setEncoding('utf8');
    s.on('data', d => { out += d; if (/\r\n\r\n/.test(out)) { s.destroy(); resolve(out); } });
    s.on('error', reject); s.on('close', () => resolve(out));
  });
}
async function stream(t, runtime) {
  const events = [];
  let pending = '';
  await new Promise((resolve, reject) => {
    const req = http.get(runtime.url.replace('/overlay/', '/events/'), res => {
      assert.equal(res.statusCode, 200);
      res.setEncoding('utf8');
      res.on('data', chunk => {
        pending += chunk;
        let idx;
        while ((idx = pending.indexOf('\n\n')) >= 0) {
          const block = pending.slice(0, idx); pending = pending.slice(idx + 2);
          const kind = block.match(/^event: (.+)$/m)?.[1]; const data = block.match(/^data: (.+)$/m)?.[1];
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

// ---- Minimal fake DOM to execute the real overlay <script> in a VM -------------------------
class El {
  constructor(tag, id) { this.tagName = tag.toUpperCase(); this.id = id; this.children = []; this._text = ''; this.style = { setProperty() {} }; this.className = ''; this.src = ''; this.parent = null; this._html = null;
    const set = new Set(); this.classList = { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c), toggle: (c, f) => (f ?? !set.has(c)) ? set.add(c) : set.delete(c) }; }
  set textContent(v) { this.children = []; this._text = String(v); }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set innerHTML(v) { this._html = String(v); throw new Error('innerHTML used: ' + v); }
  append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  replaceChildren() { this.children = []; this._text = ''; }
  get firstChild() { return this.children[0]; }
}
let ctxTimers = null;
function runOverlay(html) {
  const script = html.match(/<script nonce="allhouse">([\s\S]*?)<\/script>/)[1];
  const ids = Object.fromEntries(['scene', 'brand', 'title', 'subtitle', 'art', 'chat', 'alert'].map(id => [id, new El('div', id)]));
  ids.alert.classList.add('hidden');
  const listeners = {}; let esUrl;
  class EventSource { constructor(u) { esUrl = u; } addEventListener(k, fn) { listeners[k] = fn; } }
  const ctx = { document: { getElementById: id => ids[id], createElement: tag => new El(tag) }, EventSource, addEventListener() {}, innerWidth: 1920, innerHeight: 1080, setTimeout: (fn, ms) => { if (ctxTimers) ctxTimers.push({ fn, ms }); return 0; }, clearTimeout() {}, JSON, Math };
  vm.runInNewContext(script, ctx);
  return { ids, esUrl, listeners, emit: (kind, data) => listeners[kind]({ data: JSON.stringify(data) }), feed: events => { for (const e of events) if (listeners[e.kind]) listeners[e.kind]({ data: JSON.stringify(e.data) }); } };
}

module.exports = { delay, tmpDir, fixture, sample, request, rawRequest, stream, El, runOverlay };
