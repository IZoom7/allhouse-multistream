'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateState, defaultState, createRuntime } = require('../electron/runtime.cjs');

test('custom CSS: off by default, optional on older workspaces, bounded, type-checked', () => {
  const d = validateState(defaultState());
  for (const id of ['chat', 'follow', 'subscription', 'gift', 'banner']) {
    assert.equal(d.draftWidgets[id].customCssEnabled, false, id);
    assert.equal(d.draftWidgets[id].customCss, '', id);
  }
  const old = defaultState();
  delete old.draftWidgets.chat.customCss; delete old.draftWidgets.chat.customCssEnabled;
  assert.equal(validateState(old).draftWidgets.chat.customCss, '');
  const long = defaultState(); long.draftWidgets.follow.customCss = 'x'.repeat(20001);
  assert.throws(() => validateState(long), /custom CSS/);
  const bad = defaultState(); bad.draftWidgets.follow.customCssEnabled = 'yes';
  assert.throws(() => validateState(bad), /custom CSS/);
});

test('widget page applies custom CSS as <style> text only when switched on', async t => {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'allhouse-css-'));
  const rt = await createRuntime({ dataDir: dir, port: 0 });
  t.after(async () => { await rt.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const url = rt.getStatus().widgetUrls.follow;
  const html = await (await fetch(url)).text();
  // set with textContent (never innerHTML), gated on customCssEnabled, called on every published state
  assert.match(html, /st\.textContent=s&&s\.customCssEnabled\?String\(s\.customCss\|\|''\):''/);
  assert.match(html, /render\(c\);userCss\(c\);size\(\)/);
  assert.doesNotMatch(html, /innerHTML/);
  // CSP still blocks network loads from CSS (no external img/font/style sources)
  assert.match(html, /img-src data:;/);
  assert.match(html, /font-src 'self'/);
});

test('in-app preview scopes user CSS so it cannot restyle the app', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'components.tsx'), 'utf8');
  assert.match(src, /new CSSStyleSheet\(\);sheet\.replaceSync\(css\)/, 'parsed by the browser first');
  assert.match(src, /@scope \(\.wp-stage\)/, 'every rule wrapped in @scope');
  assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
});
