/* Allhouse landing page: starfield, ticker, reveals, the live OBS demo, screenshots, scores, confetti. No dependencies. */
(function () {
  'use strict';
  // The one place the download link lives. GitHub's /releases/latest skips pre-releases, so this names the version.
  var DOWNLOAD = 'https://github.com/IZoom7/allhouse-multistream/releases/download/v0.1.0/Allhouse-Setup-0.1.0.exe';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lang = function () { return window.allhouseLang ? window.allhouseLang() : 'th'; };
  var L = function (th, en) { return lang() === 'en' ? en : th; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };

  $$('[data-download]').forEach(function (a) { a.href = DOWNLOAD; });

  // ---------- starfield ----------
  var cv = $('.stars');
  if (cv) {
    var ctx = cv.getContext('2d'), stars = [], shooting = null, W = 0, H = 0, dpr = Math.min(2, devicePixelRatio || 1);
    var size = function () {
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = []; for (var i = 0; i < Math.round(W * H / 3200); i++) stars.push({ x: Math.random() * W, y: Math.random() * H * .8, s: Math.random() < .15 ? 3 : 2, p: Math.random() * 6.28, v: .5 + Math.random() * 1.5, z: .2 + Math.random() * .8 });
    };
    var colors = ['#fff5dd', '#f0cb45', '#5aa0ff', '#efa39a'];
    var frame = function (t) {
      ctx.clearRect(0, 0, W, H);
      var sy = scrollY * .15;
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i], a = reduce ? .8 : .45 + .55 * Math.abs(Math.sin(st.p + t / 1000 * st.v));
        ctx.globalAlpha = a; ctx.fillStyle = colors[i % 4];
        var y = (st.y - sy * st.z) % H; if (y < 0) y += H;
        ctx.fillRect(Math.round(st.x), Math.round(y), st.s, st.s);
        if (st.s === 3 && a > .9) { ctx.fillRect(Math.round(st.x) - 3, Math.round(y) + 1, 9, 1); ctx.fillRect(Math.round(st.x) + 1, Math.round(y) - 3, 1, 9); }
      }
      if (!reduce) {
        if (!shooting && Math.random() < .004) shooting = { x: Math.random() * W * .6 + W * .3, y: Math.random() * H * .3, l: 0 };
        if (shooting) {
          shooting.l += 10; ctx.globalAlpha = Math.max(0, 1 - shooting.l / 500);
          for (var k = 0; k < 14; k++) { ctx.fillStyle = k < 2 ? '#fff' : '#f0cb45'; ctx.fillRect(Math.round(shooting.x - shooting.l + k * 4), Math.round(shooting.y + shooting.l * .45 - k * 1.8), 3, 3); }
          if (shooting.l > 500) shooting = null;
        }
        requestAnimationFrame(frame);
      }
      ctx.globalAlpha = 1;
    };
    size(); addEventListener('resize', size); requestAnimationFrame(frame);
  }

  // ---------- sample data ----------
  var P = {
    twitch: { c: '#bf94ff', bg: '#9146ff', fg: '#fff' }, youtube: { c: '#ff6b6b', bg: '#ff0000', fg: '#fff' },
    kick: { c: '#53fc19', bg: '#53fc19', fg: '#0b1a03' }, tiktok: { c: '#25f4ee', bg: '#000', fg: '#fff' },
  };
  var NAMES = ['mintmint', 'บ้านข้างๆ', 'pixelpanda', 'น้องแมวส้ม', 'kaiju_tv', 'ฟ้าใส', 'GGwp_Pond', 'noodle.exe', 'ป้าแจ่ม', 'retro_rin'];
  var CHAT_TH = ['สวัสดีค่าาา 👋', 'เสียงบอทน่ารักมาก', 'มาจาก TikTok ครับ!', 'วิดเจ็ตสวยจัง ทำยังไง', 'GG ครับบบ', 'คิดถึงไลฟ์นี้เลย', '555+ ฮามาก', 'ขอเพลงต่อไปหน่อย', 'บ้านนี้น่าอยู่จัง 💚', 'กดติดตามแล้วนะ'];
  var CHAT_EN = ['hiii everyone 👋', 'the TTS voice is so cute', 'here from TikTok!', 'love these widgets', 'GG!!', 'missed this stream', 'lmao 😂', 'next song pls', 'cozy house 💚', 'just followed!'];
  var GIFTS = [['Rose', 1], ['Galaxy', 1000], ['Lion', 29999], ['Perfume', 20], ['Finger Heart', 5]];
  var icon = function (p) { return '<svg aria-hidden="true"><use href="#ic-' + p + '"/></svg>'; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ---------- ticker ----------
  var track = $('.ticker-track');
  var fillTicker = function () {
    if (!track) return;
    var items = [], msgs = lang() === 'en' ? CHAT_EN : CHAT_TH, plats = Object.keys(P);
    for (var i = 0; i < 12; i++) { var p = plats[i % 4]; items.push('<span class="tk" style="--c:' + P[p].c + '">' + icon(p) + '<b>' + esc(NAMES[i % NAMES.length]) + '</b> ' + esc(msgs[i % msgs.length]) + '</span>'); }
    track.innerHTML = items.join('') + items.join(''); // doubled for a seamless loop
  };
  fillTicker();

  // ---------- reveal on scroll ----------
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); if (e.target.classList.contains('scoreboard')) countUp(); } });
  }, { threshold: .18 }) : null;
  $$('.reveal').forEach(function (el) { if (io) io.observe(el); else el.classList.add('in'); });

  // ---------- live demo ----------
  var chatw = $('#chatw'), alertw = $('#alertw'), ttsw = $('#ttsw'), viewers = $('#viewers');
  var alertQueue = [], alertBusy = false, speakTimer = null;
  var addChat = function (p, name, text) {
    if (!chatw) return;
    var li = document.createElement('li');
    li.style.setProperty('--c', P[p].c);
    li.innerHTML = '<span class="pi" style="background:' + P[p].bg + ';color:' + P[p].fg + '">' + icon(p) + '</span><span><b>' + esc(name) + '</b>' + esc(text) + '</span>';
    chatw.appendChild(li);
    while (chatw.children.length > 5) chatw.removeChild(chatw.firstChild);
    speak(name, text);
  };
  var speak = function (name, text) {
    if (!ttsw) return;
    ttsw.hidden = false; ttsw.style.animation = 'none'; void ttsw.offsetWidth; ttsw.style.animation = '';
    var span = ttsw.querySelector('span'), line = L(name + ' บอกว่า ', name + ' says ') + text, i = 0;
    clearInterval(speakTimer);
    speakTimer = setInterval(function () { span.textContent = line.slice(0, ++i); if (i >= line.length) { clearInterval(speakTimer); speakTimer = setTimeout(function () { ttsw.hidden = true; }, 1400); } }, reduce ? 1 : 28);
  };
  var showAlert = function () {
    if (alertBusy || !alertQueue.length || !alertw) return;
    alertBusy = true;
    var a = alertQueue.shift();
    alertw.style.setProperty('--c', a.color); alertw.className = 'alert-w'; alertw.hidden = false;
    alertw.innerHTML = '<img src="assets/pixel/' + a.sprite + '.svg" alt=""><small>' + a.tag + ' · ' + a.plat.toUpperCase() + '</small>' + a.html;
    burst(alertw.getBoundingClientRect(), 18);
    setTimeout(function () { alertw.classList.add('out'); setTimeout(function () { alertw.hidden = true; alertBusy = false; showAlert(); }, 400); }, 2600);
  };
  var fire = function (kind) {
    var p = pick(Object.keys(P)), name = pick(NAMES);
    if (kind === 'chat') return addChat(p, name, pick(lang() === 'en' ? CHAT_EN : CHAT_TH));
    if (kind === 'follow') alertQueue.push({ plat: p, color: '#ff6b6b', sprite: 'heart', tag: 'NEW FOLLOWER', html: L('<b>' + esc(name) + '</b> กดติดตามแล้ว!', '<b>' + esc(name) + '</b> just followed!') });
    if (kind === 'sub') alertQueue.push({ plat: p === 'tiktok' ? 'twitch' : p, color: '#f0cb45', sprite: 'star', tag: 'NEW SUB', html: L('<b>' + esc(name) + '</b> สมัครสมาชิกแล้ว!', '<b>' + esc(name) + '</b> subscribed!') });
    if (kind === 'gift') { var g = pick(GIFTS), n = g[1] > 100 ? 1 : 1 + Math.floor(Math.random() * 30);
      alertQueue.push({ plat: 'tiktok', color: '#25f4ee', sprite: 'gift', tag: 'GIFT · ' + (g[1] * n).toLocaleString() + ' COINS', html: L('<b>' + esc(name) + '</b> ส่ง ' + g[0] + ' ×' + n, '<b>' + esc(name) + '</b> sent ' + g[0] + ' ×' + n) }); }
    showAlert();
  };
  $$('[data-fire]').forEach(function (b) { b.addEventListener('click', function () { fire(b.getAttribute('data-fire')); }); });
  // attract mode: runs only while the demo is on screen
  var demoOn = false, demoTimer = null, tick = 0;
  var loop = function () {
    if (!demoOn) return;
    tick++; fire(tick % 7 === 0 ? pick(['follow', 'gift', 'sub']) : 'chat');
    if (viewers) viewers.textContent = Math.max(42, (+viewers.textContent || 128) + Math.round((Math.random() - .4) * 9));
    demoTimer = setTimeout(loop, 1500 + Math.random() * 900);
  };
  var scene = $('#scene');
  if (scene && 'IntersectionObserver' in window) new IntersectionObserver(function (es) {
    var vis = es[0].isIntersecting; if (vis && !demoOn) { demoOn = true; loop(); } else if (!vis) { demoOn = false; clearTimeout(demoTimer); }
  }, { threshold: .3 }).observe(scene);

  // ---------- screenshots ----------
  var tabs = $$('.stage-tabs button'), img = $('#stageimg'), shotIdx = 0, shotTimer = null;
  var show = function (i, user) {
    shotIdx = i; tabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    if (!img) return;
    img.classList.add('swap');
    setTimeout(function () { img.src = tabs[i].getAttribute('data-shot'); img.alt = tabs[i].textContent.trim(); img.classList.remove('swap'); }, 200);
    if (user) clearInterval(shotTimer);
  };
  tabs.forEach(function (t, i) { t.addEventListener('click', function () { show(i, true); }); });
  if (!reduce && tabs.length) shotTimer = setInterval(function () { show((shotIdx + 1) % tabs.length); }, 4800);
  tabs.forEach(function (t) { var im = new Image(); im.src = t.getAttribute('data-shot'); }); // preload

  // ---------- scores ----------
  var counted = false;
  function countUp() {
    if (counted) return; counted = true;
    $$('[data-count]').forEach(function (b) {
      var to = +b.getAttribute('data-count'), suf = b.getAttribute('data-suffix') || '', n = 0;
      if (!to) { var r = 0, t0 = setInterval(function () { b.textContent = Math.floor(Math.random() * 999) + suf; if (++r > 12) { clearInterval(t0); b.textContent = '0' + suf; } }, 60); return; }
      var t = setInterval(function () { b.textContent = (++n) + suf; if (n >= to) clearInterval(t); }, 180);
    });
  }

  // ---------- confetti ----------
  var BITS = ['#285bb5', '#bd3933', '#f0cb45', '#287b49', '#e62eb4', '#2bc3e0', '#fff5dd'];
  function burst(rect, n) {
    if (reduce || !rect) return;
    var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    for (var i = 0; i < (n || 26); i++) {
      var b = document.createElement('i'), ang = Math.random() * 6.28, d = 60 + Math.random() * 160;
      b.className = 'bit'; b.style.left = cx + 'px'; b.style.top = cy + 'px'; b.style.background = pick(BITS);
      b.style.setProperty('--x', Math.cos(ang) * d + 'px'); b.style.setProperty('--y', Math.sin(ang) * d + 40 + 'px'); b.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      document.body.appendChild(b); setTimeout(b.remove.bind(b), 1100);
    }
  }
  $$('[data-burst], .px-btn.big').forEach(function (a) {
    a.addEventListener('mouseenter', function () { burst(a.getBoundingClientRect(), 14); });
    a.addEventListener('click', function () { burst(a.getBoundingClientRect(), 40); });
  });

  // ---------- ↑↑↓↓←→←→BA ----------
  var code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'], pos = 0;
  addEventListener('keydown', function (e) {
    pos = (e.key === code[pos] || e.key.toLowerCase() === code[pos]) ? pos + 1 : (e.key === code[0] ? 1 : 0);
    if (pos === code.length) { pos = 0; document.body.classList.toggle('party'); for (var i = 0; i < 6; i++) setTimeout(function () { burst({ left: Math.random() * innerWidth, top: Math.random() * innerHeight * .7, width: 0, height: 0 }, 30); }, i * 180); }
  });

  document.addEventListener('allhouse:lang', function () { fillTicker(); });
})();
