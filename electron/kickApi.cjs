'use strict';
// Kick official API for the streamer's own channel: read + edit title, category and tags (docs.kick.com, Oct 2026).
// OAuth 2.1 authorization-code + PKCE. The Kick developer app's client secret and the user's tokens are stored
// encrypted with Electron safeStorage (Windows DPAPI) in userData/kick-auth.json and never sent to the renderer.
const crypto = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const ID = 'https://id.kick.com', API = 'https://api.kick.com/public/v1';
const SCOPES = 'user:read channel:read channel:write';
const PORT = 19325, REDIRECT = `http://localhost:${PORT}/kick/callback`;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function pkce() {
  const verifier = b64url(crypto.randomBytes(48));
  return { verifier, challenge: b64url(crypto.createHash('sha256').update(verifier).digest()) };
}
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cleanString = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max && !/[\u0000-\u001f]/.test(v)) ? v.trim() : null;

/** Only the fields the form shows. The API response also carries the stream key: it never leaves this module. */
function mapChannel(c) {
  if (!c) throw new Error('Kick did not return your channel');
  const s = c.stream || {};
  return {
    slug: String(c.slug || ''), title: String(c.stream_title || ''),
    category: c.category && c.category.id ? { id: c.category.id, name: String(c.category.name || ''), thumbnail: String(c.category.thumbnail || '') } : null,
    tags: Array.isArray(s.custom_tags) ? s.custom_tags.filter(t => typeof t === 'string' && t) : [],
    language: String(s.language || ''), mature: !!s.is_mature, live: !!s.is_live,
  };
}
/**
 * Kick's official API returns an empty title/category/language while the channel is offline (seen Oct 2026), so the form
 * fills gaps from the public channel page data (kick.com/api/v1/channels/<slug>, unofficial): the stream on air, else the last one.
 */
function fromPublic(j) {
  const s = j && (j.livestream || (Array.isArray(j.previous_livestreams) && j.previous_livestreams[0]));
  if (!s) return null;
  const c = Array.isArray(s.categories) ? s.categories[0] : null;
  const thumb = c && c.banner ? String(c.banner.url || String(c.banner.responsive || '').split(' ')[0] || '') : '';
  const at = Date.parse(String(s.created_at || '').replace(' ', 'T') + 'Z') || 0;
  return { at, title: String(s.session_title || ''), category: c && c.id ? { id: c.id, name: String(c.name || ''), thumbnail: thumb } : null,
    tags: Array.isArray(s.tags) ? s.tags.filter(t => typeof t === 'string' && t) : [], language: String(s.language || ''), mature: !!s.is_mature, source: j.livestream ? 'live' : 'last' };
}
/** Validated PATCH body: at least one of title / category / tags (Kick: tags ≤ 10). */
function updateBody(input) {
  if (!input || typeof input !== 'object') throw new Error('Nothing to save');
  const body = {};
  if (input.title !== undefined) { const t = cleanString(input.title, 140); if (!t) throw new Error('Title must be 1–140 characters'); body.stream_title = t; }
  if (input.categoryId !== undefined) { if (!Number.isInteger(input.categoryId) || input.categoryId < 1) throw new Error('Choose a category'); body.category_id = input.categoryId; }
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || input.tags.length > 10) throw new Error('Up to 10 tags');
    const tags = input.tags.map(t => cleanString(t, 50));
    if (tags.some(t => !t)) throw new Error('Each tag must be 1–50 characters');
    body.custom_tags = [...new Set(tags)];
  }
  if (!Object.keys(body).length) throw new Error('Nothing to save');
  return body;
}

function createKickApi({ dataDir, fetch, safeStorage, openExternal }) {
  const file = path.join(dataDir, 'kick-auth.json');
  let st = {}; // { clientId, secret: enc, tokens: enc JSON {access, refresh, exp}, user: {name, picture} }
  const enc = s => { if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows cannot encrypt secrets for this account'); return safeStorage.encryptString(s).toString('base64'); };
  const dec = b => safeStorage.decryptString(Buffer.from(b, 'base64'));
  const save = () => fs.writeFile(file, JSON.stringify(st), { mode: 0o600 });
  const loggedOut = async msg => { delete st.tokens; delete st.user; await save(); return new Error(msg); };

  async function exchange(params) {
    const r = await fetch(ID + '/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ ...params, client_id: st.clientId, client_secret: dec(st.secret) }).toString(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || 'Kick sign-in failed (HTTP ' + r.status + ')');
    st.tokens = enc(JSON.stringify({ access: j.access_token, refresh: j.refresh_token || '', exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 }));
    await save();
  }
  async function accessToken() {
    if (!st.tokens) throw new Error('Sign in to Kick first');
    const t = JSON.parse(dec(st.tokens));
    if (Date.now() < t.exp - 60000) return t.access;
    if (!t.refresh) throw await loggedOut('Your Kick sign-in expired. Sign in again.');
    try { await exchange({ grant_type: 'refresh_token', refresh_token: t.refresh }); }
    catch { throw await loggedOut('Your Kick sign-in expired. Sign in again.'); }
    return JSON.parse(dec(st.tokens)).access;
  }
  async function call(method, pathAndQuery, body) {
    const r = await fetch(API + pathAndQuery, {
      method, headers: { Authorization: 'Bearer ' + await accessToken(), Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.status === 401) throw await loggedOut('Kick no longer accepts this sign-in. Sign in again.');
    if (r.status === 204) return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j && j.message) || 'Kick API error (HTTP ' + r.status + ')');
    return j;
  }
  async function loadUser() {
    const u = ((await call('GET', '/users')) || {}).data;
    const me = Array.isArray(u) ? u[0] : null;
    st.user = me ? { name: String(me.name || ''), picture: String(me.profile_picture || '') } : null;
    await save();
  }

  const api = {
    REDIRECT, SCOPES,
    async load() { try { st = JSON.parse(await fs.readFile(file, 'utf8')) || {}; } catch { st = {}; } },
    status() {
      const id = st.clientId || '';
      return { configured: !!(id && st.secret), clientId: id ? id.slice(0, 4) + '…' + id.slice(-4) : '', loggedIn: !!st.tokens, user: st.user || null, redirect: REDIRECT, scopes: SCOPES };
    },
    async setApp(clientId, secret) {
      const id = cleanString(clientId, 200), sec = cleanString(secret, 400);
      if (!id || /\s/.test(id)) throw new Error('Paste the Client ID from your Kick developer app');
      if (!sec || /\s/.test(sec)) throw new Error('Paste the Client Secret from your Kick developer app');
      st = { clientId: id, secret: enc(sec) }; // a different app invalidates any old sign-in
      await save(); return api.status();
    },
    async clear() { st = {}; await fs.rm(file, { force: true }); return api.status(); },
    async logout() { delete st.tokens; delete st.user; await save(); return api.status(); },
    login() {
      if (!st.clientId || !st.secret) return Promise.reject(new Error('Add your Kick developer app first'));
      const { verifier, challenge } = pkce(), state = b64url(crypto.randomBytes(16));
      return new Promise((resolve, reject) => {
        const servers = []; let done = false;
        const finish = (err, val) => { if (done) return; done = true; clearTimeout(timer); servers.forEach(s => s.close()); err ? reject(err) : resolve(val); };
        const handler = async (req, res) => {
          const u = new URL(req.url, REDIRECT);
          if (u.pathname !== '/kick/callback') { res.writeHead(404); return res.end(); }
          const page = msg => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(`<!doctype html><meta charset="utf-8"><title>Allhouse</title><body style="margin:0;font-family:'Noto Sans Thai','Segoe UI',sans-serif;background:#d8ceb4;color:#302c26;display:grid;place-items:center;min-height:100vh"><h2 style="max-width:30em;text-align:center">${escapeHtml(msg)}</h2></body>`); };
          if (u.searchParams.get('state') !== state) { page('ลิงก์นี้ไม่ใช่คำขอล่าสุดจาก Allhouse ลองกดล็อกอินใหม่ในแอพ'); return; } // ignore stray hits; keep waiting
          if (u.searchParams.get('error')) { page('ยกเลิกการเชื่อมบัญชี Kick แล้ว'); return finish(new Error('Kick sign-in was cancelled')); }
          const code = u.searchParams.get('code');
          if (!code) { page('Kick ไม่ได้ส่งรหัสยืนยันกลับมา ลองใหม่อีกครั้ง'); return finish(new Error('Kick did not return a code')); }
          try {
            await exchange({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier });
            await loadUser();
            page('เชื่อมบัญชี Kick แล้ว ปิดหน้านี้แล้วกลับไปที่ Allhouse ได้เลย');
            finish(null, api.status());
          } catch (e) { page('เชื่อมไม่สำเร็จ: ' + e.message); finish(e); }
        };
        // "localhost" may resolve to IPv4 or IPv6 in the browser: listen on both loopback addresses (never on the LAN).
        for (const host of ['127.0.0.1', '::1']) {
          const s = http.createServer(handler);
          s.on('error', e => { if (host === '127.0.0.1') finish(new Error(e.code === 'EADDRINUSE' ? `Port ${PORT} is busy. Close the program using it and try again.` : e.message)); });
          s.listen(PORT, host); servers.push(s);
        }
        const timer = setTimeout(() => finish(new Error('Kick sign-in timed out after 5 minutes')), LOGIN_TIMEOUT_MS);
        const q = new URLSearchParams({ client_id: st.clientId, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPES, state, code_challenge: challenge, code_challenge_method: 'S256' });
        Promise.resolve(openExternal(`${ID}/oauth/authorize?${q}`)).catch(e => finish(e));
      });
    },
    async channel() {
      const info = mapChannel(((await call('GET', '/channels')) || {}).data?.[0]);
      if (info.title && info.category && info.language) return info;
      const slug = info.slug || String(st.user && st.user.name || '').toLowerCase();
      let p = null;
      if (/^[a-z0-9_-]{2,40}$/.test(slug)) try {
        const r = await fetch('https://kick.com/api/v1/channels/' + slug, { headers: { Accept: 'application/json' } });
        p = r.ok ? fromPublic(await r.json()) : null;
      } catch {}
      // What this app saved last wins over an older stream (an offline edit is not visible anywhere else).
      const mine = st.lastSaved && (!p || st.lastSaved.at > p.at) ? { ...st.lastSaved, source: 'saved' } : null;
      if (mine) p = { ...(p || {}), ...mine, title: mine.title || (p && p.title) || '', category: mine.category || (p && p.category) || null, tags: mine.tags.length ? mine.tags : (p && p.tags) || [], language: (p && p.language) || '', mature: !!(p && p.mature) };
      if (!p) return info;
      return { ...info, slug, title: info.title || p.title, category: info.category || p.category, tags: info.tags.length ? info.tags : p.tags,
          language: info.language || p.language, mature: info.mature || p.mature, live: info.live || p.source === 'live', filledFrom: p.source };
    },
    async categories(query) {
      const q = cleanString(query, 100); if (!q) return [];
      const d = ((await call('GET', '/categories?q=' + encodeURIComponent(q))) || {}).data;
      return (Array.isArray(d) ? d : []).slice(0, 20).map(c => ({ id: c.id, name: String(c.name || ''), thumbnail: String(c.thumbnail || '') }));
    },
    async update(input) {
      const body = updateBody(input);
      await call('PATCH', '/channels', body);
      // remember the saved values for the form (Kick's API reads them back empty while offline)
      const prev = st.lastSaved || {};
      const cat = body.category_id ? { id: body.category_id, name: String(cleanString(input.categoryName, 120) || ''), thumbnail: /^https:\/\/([a-z0-9-]+\.)*kick\.com\//i.test(input.categoryThumb || '') ? input.categoryThumb : '' } : prev.category;
      st.lastSaved = { at: Date.now(), title: body.stream_title || prev.title || '', category: cat || null, tags: body.custom_tags || prev.tags || [] };
      await save();
      return api.channel();
    },
  };
  return api;
}

module.exports = { createKickApi, pkce, mapChannel, updateBody, fromPublic, REDIRECT, PORT };
