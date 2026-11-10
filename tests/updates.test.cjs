const test = require('node:test');
const assert = require('node:assert/strict');
const { pickUpdate } = require('../electron/updates.cjs');
const rel = (tag, extra = {}) => ({ tag_name: tag, html_url: 'https://github.com/IZoom7/allhouse-multistream/releases/tag/' + tag, name: 'Allhouse ' + tag, ...extra });

test('update check: newest release above the current version wins; same, older, drafts and foreign URLs are ignored', () => {
  assert.equal(pickUpdate([rel('v0.2.0'), rel('v0.1.0')], '0.2.0'), null);
  assert.deepEqual(pickUpdate([rel('v0.1.0'), rel('v0.10.0'), rel('v0.3.0')], '0.2.0'), { version: '0.10.0', url: rel('v0.10.0').html_url, title: 'Allhouse v0.10.0' });
  assert.equal(pickUpdate([rel('v9.0.0', { draft: true })], '0.2.0'), null);
  assert.equal(pickUpdate([rel('v9.0.0', { html_url: 'https://evil.example/releases/tag/v9.0.0' })], '0.2.0'), null);
  assert.equal(pickUpdate([rel('v9.0.0-beta')], '0.2.0'), null);
  assert.equal(pickUpdate({ message: 'API rate limit exceeded' }, '0.2.0'), null);
  assert.equal(pickUpdate([rel('v1.0.0')], 'not-a-version'), null);
});
