'use strict';
// Startup update check: the newest public GitHub release of this repo (pre-releases count; drafts are never public).
// One unauthenticated GET to api.github.com; nothing about the user is sent. Only a github.com release page is ever opened.
const REPO = 'IZoom7/allhouse-multistream';
const API = `https://api.github.com/repos/${REPO}/releases?per_page=10`;
const PAGE_RE = /^https:\/\/github\.com\/IZoom7\/allhouse-multistream\/releases\/tag\/v\d+\.\d+\.\d+$/;
const parse = v => { const m = /^v?(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/.exec(String(v || '')); return m ? m.slice(1).map(Number) : null; };
const newer = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
/** GitHub releases JSON → { version, url, title } of the newest release above `current`, or null. */
function pickUpdate(releases, current) {
  const cur = parse(current);
  if (!cur || !Array.isArray(releases)) return null;
  let best = null;
  for (const r of releases) {
    const v = r && !r.draft ? parse(r.tag_name) : null;
    if (!v || !PAGE_RE.test(String(r.html_url)) || !newer(v, cur) || (best && !newer(v, best.v))) continue;
    best = { v, version: v.join('.'), url: r.html_url, title: typeof r.name === 'string' ? r.name.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 120) : '' };
  }
  return best && { version: best.version, url: best.url, title: best.title };
}
async function checkForUpdate({ fetch, current }) {
  const res = await fetch(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Allhouse-update-check' }, signal: AbortSignal.timeout(8000) });
  return res.ok ? pickUpdate(await res.json(), current) : null;
}
module.exports = { pickUpdate, checkForUpdate };
