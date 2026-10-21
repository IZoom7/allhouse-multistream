const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const scene = { title: 'WELCOME TO THE HOUSE', subtitle: 'พื้นที่ของเรา เรื่องราวของคุณ', accent: '#b4f272', template: 'studio', showChat: true, showAlert: true, width: 1920, height: 1080, image: '' };
// ---- Widgets (schema v2, docs/WIDGETS-CONTRACT.md) ------------------------------------------------------------
const WIDGET_IDS = ['chat', 'follow', 'subscription', 'gift', 'banner'];
const ANIMS = ['fade', 'slide', 'pop', 'none'];
const MAX_MEDIA = 4000000, MAX_STATE = 25000000, MAX_CSS = 20000;
const CSS_DEFAULTS = { customCssEnabled: false, customCss: '' };
const IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const SOUND_RE = /^data:audio\/(mpeg|wav|ogg|webm);base64,[A-Za-z0-9+/=]+$/;
const alertDefaults = template => ({ ...CSS_DEFAULTS, enabled: true, width: 1920, height: 1080, durationSec: 6, template, fontSize: 64, accent: scene.accent, textColor: '#ffffff', bgOpacity: 0.85, animation: 'pop', image: '', sound: '', soundName: '', volume: 0.8 });
function defaultWidgets() { return validateWidgets(rawDefaultWidgets()); }
function rawDefaultWidgets() {
  return {
    chat: { ...CSS_DEFAULTS, enabled: true, width: 800, height: 1080, fontSize: 28, maxMessages: 6, lifetimeSec: 60, showPlatformIcon: true, bgOpacity: 0.85, accent: scene.accent, textColor: '#ffffff', newestAt: 'bottom', animation: 'slide' },
    follow: alertDefaults('{name} followed!'),
    subscription: alertDefaults('{name} subscribed!'),
    gift: { ...alertDefaults('{name} sent {gift} ×{count}'), minCoins: 1, showGiftImage: true },
    banner: { ...CSS_DEFAULTS, enabled: true, width: 1920, height: 1080, title: scene.title, subtitle: scene.subtitle, accent: scene.accent, template: scene.template, image: '' },
  };
}
/** v1 scene → v2 widgets (contract "Migration from v1"). */
function widgetsFromScene(s) {
  const w = defaultWidgets();
  Object.assign(w.banner, { title: s.title, subtitle: s.subtitle, accent: s.accent, template: s.template, image: s.image || '' });
  w.chat.accent = w.follow.accent = w.subscription.accent = w.gift.accent = s.accent;
  w.chat.enabled = s.showChat; w.follow.enabled = w.subscription.enabled = w.gift.enabled = s.showAlert;
  return w;
}
/** Legacy all-in-one scene derived from widgets (keeps /overlay/<token> working). */
function sceneFromWidgets(w, prev) {
  return { title: w.banner.title, subtitle: w.banner.subtitle, accent: w.banner.accent, template: w.banner.template, showChat: w.chat.enabled,
    showAlert: w.follow.enabled || w.subscription.enabled, width: prev ? prev.width : 1920, height: prev ? prev.height : 1080, image: w.banner.image };
}
const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const str = (v, max) => typeof v === 'string' && v.length <= max;
function validateWidgets(w) {
  const bad = what => { throw new Error('Invalid widget settings: ' + what); };
  if (!w || typeof w !== 'object') bad('missing');
  const base = (x, id) => {
    if (!x || typeof x !== 'object' || typeof x.enabled !== 'boolean' || !int(x.width, 320, 3840) || !int(x.height, 320, 2160)) bad(id + ' size');
    // Custom CSS fields are optional (workspaces saved before they existed have none).
    const css = x.customCss === undefined ? '' : x.customCss;
    if (!str(css, MAX_CSS) || (x.customCssEnabled !== undefined && typeof x.customCssEnabled !== 'boolean')) bad(id + ' custom CSS (max 20000 characters)');
    return { enabled: x.enabled, width: x.width, height: x.height, customCssEnabled: x.customCssEnabled === true, customCss: css };
  };
  const c = w.chat;
  const chat = base(c, 'chat');
  if (!int(c.fontSize, 14, 72) || !int(c.maxMessages, 1, 20) || !(c.lifetimeSec === 0 || int(c.lifetimeSec, 5, 600)) || typeof c.showPlatformIcon !== 'boolean'
    || !num(c.bgOpacity, 0, 1) || !hex(c.accent) || !hex(c.textColor) || !['bottom', 'top'].includes(c.newestAt) || !ANIMS.includes(c.animation)) bad('chat');
  Object.assign(chat, { fontSize: c.fontSize, maxMessages: c.maxMessages, lifetimeSec: c.lifetimeSec, showPlatformIcon: c.showPlatformIcon, bgOpacity: c.bgOpacity, accent: c.accent, textColor: c.textColor, newestAt: c.newestAt, animation: c.animation });
  const alert = id => {
    const a = w[id], out = base(a, id);
    if (!int(a.durationSec, 2, 30) || !str(a.template, 120) || !int(a.fontSize, 20, 160) || !hex(a.accent) || !hex(a.textColor) || !num(a.bgOpacity, 0, 1)
      || !ANIMS.includes(a.animation) || !num(a.volume, 0, 1) || !str(a.soundName, 120)) bad(id);
    if (!str(a.image, MAX_MEDIA) || (a.image && !IMAGE_RE.test(a.image))) bad(id + ' image (PNG/JPEG/WebP/GIF, ≤ 4 MB)');
    if (!str(a.sound, MAX_MEDIA) || (a.sound && !SOUND_RE.test(a.sound))) bad(id + ' sound (MP3/WAV/OGG/WebM, ≤ 4 MB)');
    return Object.assign(out, { durationSec: a.durationSec, template: a.template, fontSize: a.fontSize, accent: a.accent, textColor: a.textColor, bgOpacity: a.bgOpacity, animation: a.animation, image: a.image, sound: a.sound, soundName: a.soundName, volume: a.volume });
  };
  const b = w.banner, banner = base(b, 'banner');
  if (!str(b.title, 120) || !str(b.subtitle, 200) || !hex(b.accent) || !['studio', 'minimal', 'neon'].includes(b.template)
    || !str(b.image, MAX_MEDIA) || (b.image && !IMAGE_RE.test(b.image))) bad('banner');
  Object.assign(banner, { title: b.title, subtitle: b.subtitle, accent: b.accent, template: b.template, image: b.image });
  // gift (round 6): workspaces saved before it existed get the default gift widget (accent taken from follow).
  if (w.gift === undefined) w = { ...w, gift: { ...rawDefaultWidgets().gift, accent: hex(w.follow && w.follow.accent) ? w.follow.accent : scene.accent } };
  const gift = alert('gift');
  if (!int(w.gift.minCoins, 0, 1000000) || typeof w.gift.showGiftImage !== 'boolean') bad('gift');
  Object.assign(gift, { minCoins: w.gift.minCoins, showGiftImage: w.gift.showGiftImage });
  return { chat, follow: alert('follow'), subscription: alert('subscription'), gift, banner };
}
function defaultState() {
  return { schemaVersion: 2, workspaceName: 'My streaming room', language: 'th', theme: 'dark', onboarded: false,
    draft: { ...scene }, published: { ...scene }, publishedAt: null,
    draftWidgets: defaultWidgets(), publishedWidgets: defaultWidgets(), widgetsPublishedAt: null,
    tts: { enabled: false, rate: 1, volume: 0.8, thaiVoice: '', englishVoice: '' }, history: [] };
}
/** Accepts schema v1 (migrated) or v2; always returns a clean v2 state. Unknown fields are dropped. */
function validateState(input) {
  if (!input || typeof input !== 'object' || ![1, 2].includes(input.schemaVersion)) throw new Error('Unsupported backup version');
  let size = 0; try { size = JSON.stringify(input).length; } catch { throw new Error('Unreadable workspace'); }
  if (size > MAX_STATE) throw new Error('Workspace exceeds 25 MB');
  const text = (v, max) => typeof v === 'string' && v.length <= max;
  if (!text(input.workspaceName, 80) || !input.workspaceName.trim()) throw new Error('Workspace name required (1–80 characters)');
  if (!['th', 'en'].includes(input.language) || !['dark', 'light', 'system'].includes(input.theme)) throw new Error('Invalid preferences');
  const cleanScene = (s) => {
    if (!s || !text(s.title, 120) || !text(s.subtitle, 200) || !/^#[0-9a-f]{6}$/i.test(s.accent)
      || !['studio', 'minimal', 'neon'].includes(s.template)
      || !Number.isInteger(s.width) || s.width < 320 || s.width > 3840
      || !Number.isInteger(s.height) || s.height < 320 || s.height > 2160
      || typeof s.showChat !== 'boolean' || typeof s.showAlert !== 'boolean'
      || !text(s.image || '', MAX_MEDIA)
      || (s.image && !IMAGE_RE.test(s.image))) throw new Error('Invalid overlay');
    return { title:s.title, subtitle:s.subtitle, accent:s.accent, template:s.template, showChat:s.showChat, showAlert:s.showAlert, width:s.width, height:s.height, image:s.image || '' };
  };
  // v1 → v2 migration; v2 may omit the legacy scenes (they are derived from the widgets).
  let draftWidgets, publishedWidgets, widgetsPublishedAt, draft, published;
  if (input.schemaVersion === 1) {
    draft = cleanScene(input.draft); published = cleanScene(input.published);
    draftWidgets = widgetsFromScene(draft); publishedWidgets = widgetsFromScene(published);
    widgetsPublishedAt = typeof input.publishedAt === 'string' ? input.publishedAt.slice(0, 40) : null;
  } else {
    draftWidgets = validateWidgets(input.draftWidgets); publishedWidgets = validateWidgets(input.publishedWidgets);
    widgetsPublishedAt = typeof input.widgetsPublishedAt === 'string' ? input.widgetsPublishedAt.slice(0, 40) : null;
    draft = input.draft !== undefined ? cleanScene(input.draft) : sceneFromWidgets(draftWidgets);
    published = input.published !== undefined ? cleanScene(input.published) : sceneFromWidgets(publishedWidgets);
  }
  const importedPublishedWidgets = input.importedPublishedWidgets ? validateWidgets(input.importedPublishedWidgets) : null;
  const t = input.tts;
  if (!t || typeof t.enabled !== 'boolean' || !Number.isFinite(t.rate) || t.rate < 0.5 || t.rate > 2
    || !Number.isFinite(t.volume) || t.volume < 0 || t.volume > 1
    || !text(t.thaiVoice, 200) || !text(t.englishVoice, 200)) throw new Error('Invalid speech settings');
  // Optional engine fields (round 3). 'online' = Microsoft Edge neural voices; absent = Windows voices.
  const hasEngine = t.engine !== undefined;
  if (hasEngine && (!['windows', 'online'].includes(t.engine) || !text(t.onlineThaiVoice ?? '', 200) || !text(t.onlineEnglishVoice ?? '', 200))) throw new Error('Invalid speech settings');
  // Optional chat reading rules (round 9): per-platform on/off, read the name, skip !commands, ignored names, max length.
  let rules = null;
  if (t.rules !== undefined) {
    const r = t.rules, p = r && r.platforms;
    if (!r || typeof r !== 'object' || !p || typeof p !== 'object' || !PLATFORMS.every(k => typeof p[k] === 'boolean')
      || typeof r.readName !== 'boolean' || typeof r.skipCommands !== 'boolean' || !text(r.ignoreNames, 2000) || !int(r.maxChars, 20, 500)) throw new Error('Invalid chat reading rules');
    rules = { platforms: Object.fromEntries(PLATFORMS.map(k => [k, p[k]])), readName: r.readName, skipCommands: r.skipCommands, ignoreNames: r.ignoreNames, maxChars: r.maxChars };
  }
  return { schemaVersion:2, workspaceName:input.workspaceName.trim(), language:input.language, theme:input.theme, onboarded:!!input.onboarded,
    draft, published,
    ...(input.importedPublished ? { importedPublished: cleanScene(input.importedPublished) } : {}), publishedAt: typeof input.publishedAt === 'string' ? input.publishedAt.slice(0,40) : null,
    draftWidgets, publishedWidgets, widgetsPublishedAt, ...(importedPublishedWidgets ? { importedPublishedWidgets } : {}),
    tts: { enabled:t.enabled, rate:t.rate, volume:t.volume, thaiVoice:t.thaiVoice, englishVoice:t.englishVoice,
      ...(hasEngine ? { engine:t.engine, onlineThaiVoice:t.onlineThaiVoice ?? '', onlineEnglishVoice:t.onlineEnglishVoice ?? '' } : {}), ...(rules ? { rules } : {}) }, history: [] };
}
// Simple Icons 16.34.0 glyphs (CC0) from src/assets/platforms, drawn on their brand colour, inlined as data: images.
const PLATFORM_TILES = { twitch: ['#9146FF', '#FFFFFF'], youtube: ['#FF0000', '#FFFFFF'], kick: ['#53FC19', '#0B1A03'], tiktok: ['#000000', '#FFFFFF'] };
function platformIconUris() {
  const out = {};
  for (const [slug, [bg, fg]] of Object.entries(PLATFORM_TILES)) {
    try {
      const svg = require('node:fs').readFileSync(path.join(__dirname, '..', 'src', 'assets', 'platforms', slug + '.svg'), 'utf8');
      const d = (/\sd="([^"]+)"/.exec(svg) || [])[1];
      if (!d || !/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/.test(d)) continue; // path data only, nothing executable
      const tile = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='5' fill='" + bg + "'/><path transform='translate(4.8 4.8) scale(0.6)' fill='" + fg + "' d='" + d + "'/></svg>";
      out[slug] = 'data:image/svg+xml;base64,' + Buffer.from(tile).toString('base64');
    } catch {}
  }
  return out;
}
const PLATFORM_ICONS = platformIconUris();
const CSP_GIFT = "default-src 'none'; script-src 'nonce-allhouse'; style-src 'unsafe-inline'; img-src data: https://*.tiktokcdn.com https://*.tiktokcdn-us.com https://*.tiktokcdn-eu.com https://*.ibyteimg.com https://*.byteimg.com; media-src data:; connect-src 'self'; font-src 'self'";
const CSP = "default-src 'none'; script-src 'nonce-allhouse'; style-src 'unsafe-inline'; img-src data:; media-src data:; connect-src 'self'; font-src 'self'";
/**
 * One OBS Browser Source per widget: transparent large canvas (config width × height, scaled to the window),
 * every user string set with textContent, the alert template split into text nodes (no HTML parsing at all).
 */
function widgetDocument(token, id) {
  const common = `@font-face{font-family:House;src:url('/font/thai.woff2')}@font-face{font-family:House;src:url('/font/latin.woff2');unicode-range:U+0000-00FF}
*{box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-user-drag:none}img{object-fit:contain}
html,body{margin:0;background:transparent;overflow:hidden;cursor:default;font-family:House,'Segoe UI',sans-serif;color:var(--text,#fff)}
#scene{position:relative;transform-origin:0 0}.hidden{display:none!important}
.tag{font-style:normal;font-size:.5em;letter-spacing:.08em;margin-left:.6em;padding:.1em .6em;border-radius:999px;background:#ffd08a;color:#2b1a00;vertical-align:.2em}
.pm{width:1.1em;height:1.1em;vertical-align:-.2em;margin-right:.45em;border-radius:.25em}
@keyframes a-fade{from{opacity:0}to{opacity:1}}@keyframes a-slide{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}@keyframes a-pop{0%{opacity:0;transform:scale(.6)}70%{transform:scale(1.06)}100%{opacity:1;transform:none}}
.anim-fade{animation:a-fade .45s ease-out both}.anim-slide{animation:a-slide .45s ease-out both}.anim-pop{animation:a-pop .5s cubic-bezier(.2,.9,.3,1.3) both}
@media (prefers-reduced-motion:reduce){.anim-fade,.anim-slide,.anim-pop{animation:none}}`;
  const css = {
    chat: `#box{position:absolute;inset:24px;display:flex;flex-direction:column;justify-content:flex-end;gap:12px;font-size:var(--fs)}#box.top{flex-direction:column-reverse}
.chat{background:var(--bg);border-radius:.7em;padding:.55em .8em;overflow-wrap:anywhere;line-height:1.35}.chat b{color:var(--accent);font-size:.82em}.chat span{display:block;margin-top:.15em}`,
    alert: `#wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
#card{max-width:80%;text-align:center;padding:.6em 1em;border:4px solid var(--accent);background:var(--bg);border-radius:.5em;font-size:var(--fs);overflow-wrap:anywhere;line-height:1.25}
#card img.art{display:block;max-width:100%;max-height:40vh;margin:0 auto .3em}#card small{display:block;color:var(--accent);font-size:.32em;letter-spacing:.08em;margin-bottom:.3em}#card .ph{color:var(--accent)}#card .msg{display:block;font-size:.5em;opacity:.9;margin-top:.3em}#card img.gimg{display:block;width:1.6em;height:1.6em;margin:0 auto .2em}`,
    banner: `#brand{position:absolute;left:5%;top:5%;border-left:6px solid var(--accent);padding:18px 30px;background:#101414dd;border-radius:0 18px 18px 0}
h1{margin:0;font-size:44px}p{margin:10px 0 0;font-size:28px;color:#ccd3d0}#art{position:absolute;right:5%;top:5%;max-width:30%;max-height:40%}.minimal #brand{background:transparent}.neon #brand{box-shadow:0 0 28px var(--accent)}`,
  };
  const kind = id === 'chat' ? 'chat' : id === 'banner' ? 'banner' : 'alert';
  const body = { chat: '<div id="box"></div>', alert: '<div id="wrap" class="hidden"><div id="card"></div></div>', banner: '<div id="brand"><h1 id="title"></h1><p id="subtitle"></p></div><img id="art" alt="" class="hidden">' }[kind];
  const script = {
    chat: `events.addEventListener('chat',e=>{if(!c||!c.enabled)return;const v=JSON.parse(e.data);const row=document.createElement('div');row.className='chat'+(c.animation==='none'?'':' anim-'+c.animation);if(c.showPlatformIcon){const pi=icon(v.platform);if(pi)row.append(pi)}const b=document.createElement('b');b.textContent=v.name+' · '+(NAMES[v.platform]||v.platform);if(v.sourceMode!=='live'){const tag=document.createElement('i');tag.className='tag';tag.textContent='TEST CHAT';b.append(tag)}const t=document.createElement('span');t.textContent=v.message;row.append(b,t);const box=el('box');box.append(row);while(box.children.length>c.maxMessages)box.firstChild.remove();if(c.lifetimeSec>0)setTimeout(()=>row.remove(),c.lifetimeSec*1000)});
events.addEventListener('clear',()=>el('box').replaceChildren());
function render(s){el('box').classList.toggle('hidden',!s.enabled);el('box').classList.toggle('top',s.newestAt==='top');el('scene').style.setProperty('--fs',s.fontSize+'px');while(el('box').children.length>s.maxMessages)el('box').firstChild.remove()}`,
    alert: `let timer,audio=null;const stop=()=>{el('wrap').classList.add('hidden');clearTimeout(timer);if(audio){try{audio.pause()}catch(_){}audio=null}};
/** Template → text nodes; placeholders become spans. Nothing is ever parsed as HTML. */
function fill(tpl,v){const out=document.createElement('div');for(const part of String(tpl).split(/(\\{name\\}|\\{platform\\}|\\{message\\}|\\{gift\\}|\\{count\\}|\\{coins\\})/)){if(!part)continue;const g=v.gift||{};const val=part==='{name}'?v.name:part==='{platform}'?(NAMES[v.platform]||v.platform):part==='{message}'?v.message:part==='{gift}'?String(g.name||''):part==='{count}'?String(g.count||1):part==='{coins}'?String((g.coins||0)*(g.count||1)):null;if(val===null){out.append(document.createTextNode(part))}else{const s=document.createElement('span');s.className='ph';s.textContent=val;out.append(s)}}return out}
events.addEventListener('alert',e=>{if(!c||!c.enabled)return;const v=JSON.parse(e.data);stop();const card=document.createElement('div');card.id='card';if(c.animation!=='none')card.className='anim-'+c.animation;if(c.image){const i=document.createElement('img');i.className='art';i.alt='';i.draggable=false;i.src=c.image;card.append(i)}if(c.showGiftImage&&v.gift&&v.gift.image){const gi=document.createElement('img');gi.className='gimg';gi.alt='';gi.draggable=false;gi.referrerPolicy='no-referrer';gi.src=v.gift.image;card.append(gi)}const label=document.createElement('small');const pi=icon(v.platform);if(pi)label.append(pi);label.append(document.createTextNode((v.sourceMode==='live'?'':'TEST ALERT · ')+(NAMES[v.platform]||v.platform)));card.append(label,fill(c.template,v));el('wrap').replaceChildren(card);el('wrap').classList.remove('hidden');if(c.sound){try{audio=new Audio(c.sound);audio.volume=c.volume;const p=audio.play();if(p&&p.catch)p.catch(()=>{})}catch(_){}}timer=setTimeout(stop,c.durationSec*1000)});
events.addEventListener('hide-alert',stop);events.addEventListener('clear',stop);
function render(s){el('scene').style.setProperty('--fs',s.fontSize+'px');if(!s.enabled)stop()}`,
    banner: `function render(s){el('scene').className=s.template;el('brand').classList.toggle('hidden',!s.enabled);el('title').textContent=s.title;el('subtitle').textContent=s.subtitle;el('art').src=s.image||'';el('art').classList.toggle('hidden',!s.enabled||!s.image)}`,
  }[kind];
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${id==='gift'?CSP_GIFT:CSP}"><title>Allhouse ${id}</title><style>${common}${css[kind]}</style></head>
<body><div id="scene" data-widget="${id}">${body}</div>
<script nonce="allhouse">
let c=null; const el=id=>document.getElementById(id); const ICONS=${JSON.stringify(PLATFORM_ICONS)}; const NAMES={youtube:'YouTube',twitch:'Twitch',kick:'Kick',tiktok:'TikTok'};
const icon=p=>{if(!Object.prototype.hasOwnProperty.call(ICONS,p))return null;const i=document.createElement('img');i.className='pm';i.alt='';i.src=ICONS[p];i.draggable=false;return i};
const rgba=(h,a)=>'rgba('+parseInt(h.slice(1,3),16)+','+parseInt(h.slice(3,5),16)+','+parseInt(h.slice(5,7),16)+','+a+')';
/** User CSS: only when switched on; textContent keeps it CSS (no HTML). The page CSP blocks any network url()/@import. */
function userCss(s){try{let st=el('user-css');if(!st){st=document.createElement('style');st.id='user-css';(document.head||document.body).append(st)}st.textContent=s&&s.customCssEnabled?String(s.customCss||''):''}catch(_){}}
function size(){if(c)el('scene').style.transform='scale('+Math.min(innerWidth/c.width,innerHeight/c.height)+')'}
addEventListener('resize',size);
const events=new EventSource('/events/${token}?w=${id}');
${script}
events.addEventListener('state',e=>{c=JSON.parse(e.data);const s=el('scene').style;s.width=c.width+'px';s.height=c.height+'px';s.setProperty('--accent',c.accent);if(c.textColor)s.setProperty('--text',c.textColor);if(typeof c.bgOpacity==='number')s.setProperty('--bg',rgba('#101414',c.bgOpacity));render(c);userCss(c);size()});
</script></body></html>`;
}
function overlayDocument(token) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-allhouse'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; font-src 'self'"><style>
@font-face{font-family:House;src:url('/font/thai.woff2')}@font-face{font-family:House;src:url('/font/latin.woff2');unicode-range:U+0000-00FF}
*{box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-user-drag:none}img{object-fit:contain}body{margin:0;background:transparent;color:#fff;cursor:default;font-family:House,'Segoe UI',sans-serif;overflow:hidden}
#scene{position:relative;width:1920px;height:1080px;transform-origin:0 0}
#brand{position:absolute;left:5%;top:5%;border-left:5px solid var(--accent);padding:14px 24px;background:#101414dd;border-radius:0 16px 16px 0}
h1{margin:0;font-size:32px}p{margin:8px 0 0;font-size:23px;color:#ccd3d0}
#art{position:absolute;right:5%;top:5%;max-width:25%;max-height:35%;object-fit:contain}
#chat{position:absolute;left:5%;bottom:8%;width:32%;display:flex;flex-direction:column;gap:10px}
.chat{background:#101414e8;border-radius:16px;padding:16px 20px;font-size:23px;overflow-wrap:anywhere}.chat b{color:var(--accent);font-size:19px}.chat span{display:block;margin-top:4px}.pm{width:26px;height:26px;vertical-align:-6px;margin-right:10px;border-radius:6px}#alert .pm{display:block;width:40px;height:40px;margin:0 auto 10px}.chat .tag{font-style:normal;font-size:13px;letter-spacing:.08em;margin-left:10px;padding:1px 8px;border-radius:999px;background:#ffd08a;color:#2b1a00;vertical-align:2px}
#alert{position:absolute;left:34%;top:38%;width:40%;padding:28px;text-align:center;border:2px solid var(--accent);background:#101414ef;border-radius:24px;font-size:34px;overflow-wrap:anywhere}
#alert small{display:block;color:var(--accent);font-size:18px;margin-bottom:10px}.hidden{display:none!important}.neon #brand,.neon #alert{box-shadow:0 0 28px var(--accent)}.minimal #brand{background:transparent}
</style></head><body><div id="scene"><div id="brand"><h1 id="title"></h1><p id="subtitle"></p></div><img id="art" alt=""><div id="chat"></div><div id="alert" class="hidden"></div></div>
<script nonce="allhouse">
let config, timer; const el=id=>document.getElementById(id); const ICONS=${JSON.stringify(PLATFORM_ICONS)}; const NAMES={youtube:'YouTube',twitch:'Twitch',kick:'Kick',tiktok:'TikTok'};
const icon=p=>{if(!Object.prototype.hasOwnProperty.call(ICONS,p))return null;const i=document.createElement('img');i.className='pm';i.alt='';i.src=ICONS[p];i.draggable=false;return i};
function size(){if(config)el('scene').style.transform='scale('+Math.min(innerWidth/config.width,innerHeight/config.height)+')'}
function apply(s){config=s;el('scene').style.width=s.width+'px';el('scene').style.height=s.height+'px';el('scene').style.setProperty('--accent',s.accent);el('scene').className=s.template;el('title').textContent=s.title;el('subtitle').textContent=s.subtitle;el('chat').classList.toggle('hidden',!s.showChat);if(!s.showAlert)el('alert').classList.add('hidden');el('art').src=s.image||'';el('art').classList.toggle('hidden',!s.image);size()}
addEventListener('resize',size);
const events=new EventSource('/events/${token}');
events.addEventListener('state',e=>apply(JSON.parse(e.data)));
events.addEventListener('chat',e=>{if(!config)return;const v=JSON.parse(e.data);const row=document.createElement('div');row.className='chat';const b=document.createElement('b');b.textContent=v.name+' · '+(NAMES[v.platform]||v.platform);if(v.sourceMode!=='live'){const tag=document.createElement('i');tag.className='tag';tag.textContent='TEST CHAT';b.append(tag)}const t=document.createElement('span');t.textContent=v.message;const pi=icon(v.platform);if(pi)row.append(pi);row.append(b,t);el('chat').append(row);while(el('chat').children.length>5)el('chat').firstChild.remove();setTimeout(()=>row.remove(),45000)});
events.addEventListener('alert',e=>{if(!config||!config.showAlert)return;const v=JSON.parse(e.data);el('alert').replaceChildren();const label=document.createElement('small');label.textContent=(v.sourceMode==='live'?'':'TEST ALERT · ')+(NAMES[v.platform]||v.platform);const msg=document.createElement('div');msg.textContent=v.name+' — '+v.message;const ai=icon(v.platform);if(ai)el('alert').append(ai);el('alert').append(label,msg);el('alert').classList.remove('hidden');clearTimeout(timer);timer=setTimeout(()=>el('alert').classList.add('hidden'),5000)});
events.addEventListener('hide-alert',()=>{el('alert').classList.add('hidden');clearTimeout(timer)});
events.addEventListener('clear',()=>{el('alert').classList.add('hidden');el('chat').replaceChildren();clearTimeout(timer)});
</script></body></html>`;
}
const PLATFORMS = ['youtube', 'twitch', 'kick', 'tiktok'], TYPES = ['chat', 'follow', 'subscription', 'gift'], TARGETS = ['preview', 'obs'];
const GIFT_IMAGE_RE = /^https:\/\/[a-z0-9.-]+\.(tiktokcdn|tiktokcdn-us|tiktokcdn-eu|ibyteimg|byteimg)\.com\/[^\s"'<>]{1,500}$/i;
/** Gift details carried on gift events (not stored in history beyond the message text). */
function cleanGift(g) {
  if (!g || typeof g !== 'object') return { name: 'Gift', count: 1, coins: 0, image: '' };
  const name = typeof g.name === 'string' && g.name.trim() ? g.name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 40) : 'Gift';
  const count = Number.isInteger(g.count) && g.count >= 1 ? Math.min(g.count, 99999) : 1;
  const coins = Number.isInteger(g.coins) && g.coins >= 0 ? Math.min(g.coins, 1000000) : 0;
  return { name, count, coins, image: typeof g.image === 'string' && GIFT_IMAGE_RE.test(g.image) ? g.image : '' };
}
const STATUSES = ['queued', 'playing', 'completed', 'skipped', 'interrupted'];
/** Rebuild a history entry from known fields only (never spread raw objects from disk). */
function cleanHistoryEntry(e) {
  if (!e || typeof e !== 'object' || typeof e.id !== 'string' || e.id.length > 64 || !PLATFORMS.includes(e.platform) || !TYPES.includes(e.type)
    || typeof e.name !== 'string' || e.name.length > 80 || typeof e.message !== 'string' || e.message.length > 500 || !TARGETS.includes(e.target)) return null;
  const status = ['queued', 'playing'].includes(e.status) ? 'interrupted' : STATUSES.includes(e.status) ? e.status : 'completed';
  return { id: e.id, platform: e.platform, type: e.type, name: e.name, message: e.message, target: e.target, sourceMode: e.sourceMode === 'live' ? 'live' : 'test',
    createdAt: typeof e.createdAt === 'string' ? e.createdAt.slice(0, 40) : new Date(0).toISOString(), status };
}
const IMPORTED = ' (imported)';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Legacy edits (UI still changing the draft/published scene) flow into the widgets; otherwise the scene is derived from the widgets. */
function syncLegacy(next, prev) {
  for (const [sc, wk] of [['draft', 'draftWidgets'], ['published', 'publishedWidgets']]) {
    const sceneChanged = !same(next[sc], prev[sc]), widgetsChanged = !same(next[wk], prev[wk]);
    if (sceneChanged && !widgetsChanged) {
      const s = next[sc], p = prev[sc], w = next[wk];
      Object.assign(w.banner, { title: s.title, subtitle: s.subtitle, accent: s.accent, template: s.template, image: s.image });
      if (s.accent !== p.accent) w.chat.accent = w.follow.accent = w.subscription.accent = s.accent;
      if (s.showChat !== p.showChat) w.chat.enabled = s.showChat;
      if (s.showAlert !== p.showAlert) w.follow.enabled = w.subscription.enabled = s.showAlert;
    } else if (widgetsChanged) next[sc] = sceneFromWidgets(next[wk], next[sc]);
  }
}
async function createRuntime({ dataDir, port = 0 }) {
  await fs.mkdir(dataDir, { recursive:true });
  const file = path.join(dataDir, 'workspace.json');
  let state = defaultState(), storageWarning = '';
  try {
    const raw = JSON.parse(await fs.readFile(file, 'utf8'));
    state = validateState(raw);
    state.history = Array.isArray(raw.history) ? raw.history.slice(-200).map(cleanHistoryEntry).filter(Boolean) : [];
  } catch (e) {
    if (e.code !== 'ENOENT') {
      // Keep a copy of the unreadable original before anything (sample chat, queue action, save) can overwrite workspace.json.
      const backup = 'workspace.corrupt-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      try { await fs.copyFile(file, path.join(dataDir, backup), require('node:fs').constants.COPYFILE_EXCL); storageWarning = 'Saved workspace could not be read. A default workspace is open. The original file was kept as ' + backup + ' in the Allhouse data folder.'; }
      catch { storageWarning = 'Saved workspace could not be read and no backup copy could be made. A default workspace is open; it will replace the unreadable file when anything is saved.'; }
    }
  }
  let writes=Promise.resolve(), paused=false, muted=false, closed=false;
  // Two independent alert lanes: app-only (preview) alerts never delay OBS alerts.
  const lanes={obs:{current:null,timer:null},preview:{current:null,timer:null}};
  let token;
  try { token=(await fs.readFile(path.join(dataDir,'overlay-token'),'utf8')).trim(); if(!/^[a-f0-9]{48}$/.test(token))throw new Error('Invalid token') }
  catch { token=crypto.randomBytes(24).toString('hex');await fs.writeFile(path.join(dataDir,'overlay-token'),token,{mode:0o600}) }
  const clients=new Set(); // {res, widget: null (legacy overlay) | widget id}
  const persist=()=>{const snapshot=JSON.stringify(state,null,2);writes=writes.catch(()=>{}).then(async()=>{await fs.writeFile(file+'.tmp',snapshot,'utf8');await fs.rename(file+'.tmp',file)});return writes};
  let soonTimer=null;
  const persistSoon=()=>{if(!soonTimer)soonTimer=setTimeout(()=>{soonTimer=null;persist().catch(()=>{})},2000)};
  const send=(c,kind,data)=>c.res.write('event: '+kind+'\ndata: '+JSON.stringify(data)+'\n\n');
  /** to: widget ids that receive the event; the legacy overlay (widget null) receives everything except widget state. */
  const broadcast=(kind,data,to=WIDGET_IDS)=>{for(const c of clients)if(c.widget===null||to.includes(c.widget))send(c,kind,data)};
  const broadcastLegacyState=()=>{for(const c of clients)if(c.widget===null)send(c,'state',state.published)};
  const broadcastWidgetState=id=>{for(const c of clients)if(c.widget===id)send(c,'state',state.publishedWidgets[id])};
  const pages=id=>{let n=0;for(const c of clients)if(c.widget===id)n++;return n};
  const legacyPages=()=>pages(null);
  const activeCount=()=>state.history.filter(e=>['playing','queued'].includes(e.status)).length;
  const pumpLane=name=>{const lane=lanes[name];if(paused||lane.current||closed)return;const next=state.history.find(e=>e.status==='queued'&&e.target===name);if(!next)return;lane.current=next;next.status='playing';if(name==='obs'&&!muted&&state.publishedWidgets[next.type].enabled)broadcast('alert',next,[next.type]);persist().catch(()=>{});
    const w=(name==='obs'?state.publishedWidgets:state.draftWidgets)[next.type];lane.timer=setTimeout(()=>{next.status='completed';lane.current=null;persist().catch(()=>{});pumpLane(name)},w.durationSec*1000)};
  const pump=()=>{pumpLane('obs');pumpLane('preview')};
  const stopLane=lane=>{clearTimeout(lane.timer);const was=lane.current;if(was)was.status='skipped';lane.current=null;return was};
  const server=http.createServer(async(req,res)=>{
    const expected='127.0.0.1:'+server.address().port;
    if(req.headers.host!==expected){res.writeHead(403);return res.end('Forbidden')}
    if(req.method!=='GET'){res.writeHead(405);return res.end()}
    const qi=req.url.indexOf('?'),pathname=qi<0?req.url:req.url.slice(0,qi),search=qi<0?'':req.url.slice(qi+1);
    const wm=/^\/w\/([a-f0-9]{48})\/([a-z]+)$/.exec(req.url);
    if(wm&&wm[1]===token&&WIDGET_IDS.includes(wm[2])){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end(widgetDocument(token,wm[2]))}
    if(req.url==='/overlay/'+token){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end(overlayDocument(token))}
    const evm=pathname==='/events/'+token&&(qi<0?{w:null}:/^w=[a-z]+$/.test(search)&&WIDGET_IDS.includes(search.slice(2))?{w:search.slice(2)}:null);
    if(evm){
      if(req.headers.origin&&req.headers.origin!=='http://'+expected){res.writeHead(403);return res.end()}
      if(clients.size>=(evm.w?24:10)){res.writeHead(429);return res.end()}
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Content-Type-Options':'nosniff'});const client={res,widget:evm.w};send(client,'state',evm.w?state.publishedWidgets[evm.w]:state.published);clients.add(client);req.on('close',()=>clients.delete(client));return;
    }
    if(req.url==='/font/thai.woff2'||req.url==='/font/latin.woff2'){
      try {const font=req.url.includes('thai')?'@fontsource/noto-sans-thai/files/noto-sans-thai-thai-400-normal.woff2':'@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff2';const bytes=await fs.readFile(require.resolve(font));res.writeHead(200,{'Content-Type':'font/woff2'});return res.end(bytes)}catch{}
    }
    res.writeHead(404);res.end('Not found');
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
  const origin='http://127.0.0.1:'+server.address().port, url=origin+'/overlay/'+token;
  const widgetUrls=Object.fromEntries(WIDGET_IDS.map(id=>[id,origin+'/w/'+token+'/'+id]));
  /** Per widget: the event's own widget (chat/follow/subscription) must be published + enabled and have a page open (or the legacy overlay). */
  const deliveryOf=e=>{
    const widget=e.type,widgetPages=pages(widget),legacy=legacyPages(),n=widgetPages+legacy,base={widget,overlays:n,widgetPages,legacyPages:legacy};
    if(e.target!=='obs')return {...base,delivered:false,reason:'app-only'};
    if(!state.publishedWidgets[widget].enabled)return {...base,delivered:false,reason:e.type==='chat'?'chat-hidden':'alerts-hidden'};
    if(!n)return {...base,delivered:false,reason:'no-overlay'};
    if(e.type==='chat')return {...base,delivered:true,reason:'shown'};
    if(muted)return {...base,delivered:false,reason:'muted'};
    if(paused)return {...base,delivered:false,reason:'paused'};
    const cur=state.history.find(x=>x.id===e.id);
    return cur&&cur.status==='playing'?{...base,delivered:true,reason:'shown'}:{...base,delivered:false,reason:'queued'};
  };
  const heartbeat=setInterval(()=>{for(const c of clients)c.res.write(': heartbeat\n\n')},15000);
  return {
    url,
    getState:()=>structuredClone(state),
    getHistory:()=>structuredClone(state.history),
    getStatus:()=>({url,clients:clients.size,paused,muted,storageWarning,queue:activeCount(),widgetUrls:{...widgetUrls},widgetClients:Object.fromEntries(WIDGET_IDS.map(id=>[id,pages(id)]))}),
    async saveState(input){
      const next=validateState(input);next.history=state.history;syncLegacy(next,state);
      const publishedChanged=!same(next.published,state.published),changedWidgets=WIDGET_IDS.filter(id=>!same(next.publishedWidgets[id],state.publishedWidgets[id]));
      state=next;await persist();storageWarning='';
      if(publishedChanged)broadcastLegacyState(); // draft-only saves never touch the overlays
      for(const id of changedWidgets)broadcastWidgetState(id);
      return this.getState()
    },
    async importState(input){
      const next=validateState(input);await this.controlQueue('clear');const current=state;
      // The backup lands as a draft: OBS keeps showing the current layout until the user presses Publish. If the backup's
      // published layout differs from its draft it is kept as importedPublished, so the UI can offer to load it (nothing is lost).
      let name=next.workspaceName;while(name.endsWith(IMPORTED))name=name.slice(0,-IMPORTED.length).trimEnd();
      state={...next,workspaceName:((name||'My streaming room').slice(0,80-IMPORTED.length))+IMPORTED,draft:next.draft,published:state.published,publishedAt:state.publishedAt,tts:{...next.tts,enabled:false,...(next.tts.engine?{engine:'windows'}:{})},history:[]};
      delete state.importedPublished;if(JSON.stringify(next.published)!==JSON.stringify(next.draft))state.importedPublished=next.published; // imported backups never turn on online speech
      // Widgets follow the same rule: the backup's widgets become the draft; OBS keeps the current published widgets.
      state.draftWidgets=next.draftWidgets;state.publishedWidgets=current.publishedWidgets;state.widgetsPublishedAt=current.widgetsPublishedAt;
      delete state.importedPublishedWidgets;if(!same(next.publishedWidgets,next.draftWidgets))state.importedPublishedWidgets=next.publishedWidgets;
      await persist();return this.getState()
    },
    /** Why an event will or will not appear on OBS right now. reason: app-only | no-overlay | chat-hidden | alerts-hidden | muted | paused | queued | shown */
    deliveryOf(e){return deliveryOf(e)},
    async sendEvent(input){
      if(!input||!PLATFORMS.includes(input.platform)||!TYPES.includes(input.type)||!TARGETS.includes(input.target)||typeof input.name!=='string'||!input.name.trim()||input.name.length>80||typeof input.message!=='string'||!input.message.trim()||input.message.length>500)throw new Error('Invalid sample event');
      if(input.type!=='chat'&&activeCount()>=50)throw new Error('Queue is full (50)'); // chat never enters the alert queue
      const event={id:crypto.randomUUID(),platform:input.platform,type:input.type,name:input.name.trim(),message:input.message.trim(),target:input.target,sourceMode:'test',createdAt:new Date().toISOString(),status:input.type==='chat'?'completed':'queued'};
      if(event.type==='gift')event.gift=cleanGift(input.gift||{name:'Rose',count:1,coins:1}); // test gifts ignore the minimum-coins filter
      state.history.push(event);while(state.history.length>200){const idx=state.history.findIndex(e=>!['queued','playing'].includes(e.status));if(idx<0)break;state.history.splice(idx,1)}
      await persist();if(event.type==='chat'&&event.target==='obs')broadcast('chat',event,['chat']);pump();
      return {...structuredClone(event),delivery:deliveryOf(event)} // delivery: what the OBS overlay will actually show (UI toasts)
    },
    /** Real platform events (chat can arrive many per second): trimmed instead of rejected, always target OBS, persisted lazily. */
    ingestLive(input){
      if(closed||!input||!PLATFORMS.includes(input.platform)||!TYPES.includes(input.type))return null;
      const clip=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n):'';
      const name=clip(input.name,80),message=clip(input.message,500);
      if(!name||(input.type==='chat'&&!message))return null;
      if(input.type!=='chat'&&activeCount()>=50)return null; // alert flood: drop rather than grow the queue without bound
      const event={id:crypto.randomUUID(),platform:input.platform,type:input.type,name,message,target:'obs',sourceMode:'live',createdAt:new Date().toISOString(),status:input.type==='chat'?'completed':'queued'};
      if(event.type==='gift'){
        event.gift=cleanGift(input.gift);
        // Small gifts stay in the activity feed but never pop an OBS alert (the gift widget's "minimum coins").
        if(event.gift.coins*event.gift.count<state.publishedWidgets.gift.minCoins)event.status='completed';
      }
      state.history.push(event);while(state.history.length>200){const idx=state.history.findIndex(e=>!['queued','playing'].includes(e.status));if(idx<0)break;state.history.splice(idx,1)}
      persistSoon();if(event.type==='chat')broadcast('chat',event,['chat']);pump();
      return structuredClone(event)
    },
    async controlQueue(action){
      if(!['pause','resume','skip','clear','mute','unmute','clearHistory'].includes(action))throw new Error('Invalid queue action');
      if(action==='pause')paused=true;if(action==='resume'){paused=false;pump()}
      if(action==='mute')muted=true;if(action==='unmute')muted=false;
      if(action==='skip'){
        // Skip the playing OBS alert first, then a playing app-only alert, else the next queued one. Chat rows on OBS are untouched.
        const lane=lanes.obs.current?lanes.obs:lanes.preview.current?lanes.preview:null;
        if(lane){const was=stopLane(lane);if(was.target==='obs')broadcast('hide-alert',{},[was.type])}
        else{const next=state.history.find(e=>e.status==='queued');if(next)next.status='skipped'}
        pump();
      }
      if(action==='clear'||action==='clearHistory'){
        const hadObs=lanes.obs.current;stopLane(lanes.obs);stopLane(lanes.preview);
        state.history.forEach(e=>{if(e.status==='queued')e.status='skipped'});
        if(action==='clearHistory'){state.history=[];broadcast('clear',{})}else if(hadObs)broadcast('hide-alert',{},[hadObs.type]);
      }
      await persist();return this.getStatus()
    },
    async close(){closed=true;clearTimeout(lanes.obs.timer);clearTimeout(lanes.preview.timer);clearInterval(heartbeat);for(const c of clients)c.res.end();if(soonTimer){clearTimeout(soonTimer);soonTimer=null;persist().catch(()=>{})}await writes;await new Promise(resolve=>server.close(resolve))}
  };
}
module.exports={createRuntime,validateState,defaultState,defaultWidgets,validateWidgets,widgetsFromScene,cleanHistoryEntry,WIDGET_IDS};
