/* Allhouse site — Thai / English switch. No dependencies.
   Load in <head> right after <title> so the chosen language is set before first paint.
   Markup: every translated piece is a pair, <x lang="th">…</x><x lang="en">…</x>; CSS hides the other one.
   Attributes: put the English value in data-en-alt / data-en-aria-label / data-en-placeholder / data-en-title.
   The page title comes from <meta name="title-en">. Choice: ?lang=th|en, then localStorage, then the browser language. */
(function () {
  var KEY = 'allhouse-lang', root = document.documentElement;
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(l) { try { localStorage.setItem(KEY, l); } catch (e) {} }
  var q = /[?&]lang=(th|en)(?:&|$)/.exec(location.search);
  var saved = stored();
  var lang = q ? q[1] : saved === 'th' || saved === 'en' ? saved : /^th\b/i.test(navigator.language || 'th') ? 'th' : 'en';
  if (q) save(lang);
  function mark() { root.setAttribute('data-lang', lang); root.lang = lang; }
  mark();
  window.allhouseLang = function () { return lang; };

  document.addEventListener('DOMContentLoaded', function () {
    var thTitle = document.title, meta = document.querySelector('meta[name="title-en"]'), enTitle = meta ? meta.content : thTitle;
    var swaps = [];
    ['alt', 'aria-label', 'placeholder', 'title'].forEach(function (a) {
      document.querySelectorAll('[data-en-' + a + ']').forEach(function (el) { swaps.push([el, a, el.getAttribute(a) || '', el.getAttribute('data-en-' + a)]); });
    });
    var toggles = document.querySelectorAll('[data-lang-toggle]');
    function apply() {
      mark();
      document.title = lang === 'en' ? enTitle : thTitle;
      swaps.forEach(function (s) { s[0].setAttribute(s[1], lang === 'en' ? s[3] : s[2]); });
      toggles.forEach(function (b) { b.setAttribute('aria-label', lang === 'en' ? 'ภาษาไทย' : 'English'); });
      document.dispatchEvent(new CustomEvent('allhouse:lang', { detail: lang }));
    }
    toggles.forEach(function (b) {
      b.addEventListener('click', function () { lang = lang === 'en' ? 'th' : 'en'; save(lang); apply(); });
    });
    apply();
  });
})();
