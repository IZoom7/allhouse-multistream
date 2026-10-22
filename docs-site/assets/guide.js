/* Allhouse CSS guide — copy buttons and the live playground. No dependencies. */
(function () {
  var L = function (th, en) { return window.allhouseLang && window.allhouseLang() === 'en' ? en : th; };
  var presets = {
    retro: "#card {\n  border-radius: 0;\n  border: 4px solid #000;\n  background: #f0cb45;\n  color: #1d1a12;\n  box-shadow: 8px 8px 0 #000;\n}\n#card small {\n  color: #8d2832;\n}\n#card .ph {\n  color: #8d2832;\n}",
    neon: "@keyframes glow {\n  0%, 100% { box-shadow: 0 0 8px #ff3df5; }\n  50% { box-shadow: 0 0 34px 8px #ff3df5; }\n}\n#card {\n  border-color: #ff3df5;\n  background: #0b0718;\n  animation: glow 1.6s ease-in-out infinite;\n}\n#card .ph {\n  color: #6ff7ff;\n  text-shadow: 0 0 12px #6ff7ff;\n}",
    rainbow: "#card {\n  border: 5px solid transparent;\n  border-radius: 14px;\n  background:\n    linear-gradient(#141818, #141818) padding-box,\n    linear-gradient(90deg, #ff5f6d, #ffc371, #2ec4b6, #6a5cff) border-box;\n}\n#card .ph {\n  background: linear-gradient(90deg, #ffd84a, #ff6b6b);\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent;\n}",
    bounce: "@keyframes bounce-in {\n  0% { transform: translateY(-80px); opacity: 0; }\n  60% { transform: translateY(10px); opacity: 1; }\n  100% { transform: translateY(0); }\n}\n#card {\n  animation: bounce-in .8s ease-out;\n}",
    clean: "#card {\n  background: transparent;\n  border: 0;\n  text-shadow: 0 2px 8px #000;\n}\n#card small {\n  display: none;\n}"
  };
  var ta = document.getElementById('pg-code'), stage = document.getElementById('pg-stage'), status = document.getElementById('pg-status');
  if (ta) {
  var style = document.createElement('style'); document.head.appendChild(style);
  function apply() {
    var css = ta.value;
    try {
      var sheet = new CSSStyleSheet(); sheet.replaceSync(css);
      var rules = Array.prototype.map.call(sheet.cssRules, function (r) { return r.cssText; }).join('\n');
      style.textContent = rules ? '@scope (#pg-stage) {\n' + rules + '\n}' : '';
      status.textContent = css.trim() ? sheet.cssRules.length + L(' กฎใช้งานได้', ' rules applied') : '';
    } catch (e) { status.textContent = L('โค้ดยังไม่สมบูรณ์', 'The code isn’t complete yet'); }
  }
  function replay() { var c = document.getElementById('card'); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; }
  ta.addEventListener('input', apply);
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); var a = ta.selectionStart, b = ta.selectionEnd; ta.value = ta.value.slice(0, a) + '  ' + ta.value.slice(b); ta.selectionStart = ta.selectionEnd = a + 2; apply(); }
  });
  document.querySelectorAll('[data-preset]').forEach(function (btn) {
    btn.addEventListener('click', function () { ta.value = presets[btn.getAttribute('data-preset')] || ''; apply(); replay(); });
  });
  document.getElementById('pg-replay').addEventListener('click', replay);
  document.getElementById('pg-copy').addEventListener('click', function () {
    var done = function () { status.textContent = L('คัดลอกแล้ว วางในช่อง CSS ของวิดเจ็ตได้เลย', 'Copied. Paste it into the widget’s CSS box.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, function () { ta.focus(); ta.select(); status.textContent = L('กด Ctrl+C เพื่อคัดลอก', 'Press Ctrl+C to copy'); });
    else { ta.focus(); ta.select(); status.textContent = L('กด Ctrl+C เพื่อคัดลอก', 'Press Ctrl+C to copy'); }
  });
  } // end playground
  // copy buttons on every code block
  document.querySelectorAll('pre.code').forEach(function (pre) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'copy'; b.textContent = L('คัดลอก', 'Copy');
    document.addEventListener('allhouse:lang', function () { b.textContent = L('คัดลอก', 'Copy'); });
    b.addEventListener('click', function () {
      var text = pre.innerText.replace(/(คัดลอก(แล้ว)?|Copy|Copied)$/, '').trimEnd();
      var ok = function () { b.textContent = L('คัดลอกแล้ว', 'Copied'); setTimeout(function () { b.textContent = L('คัดลอก', 'Copy'); }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    });
    pre.appendChild(b);
  });
  if (ta) { ta.value = presets.retro; apply(); }
})();
