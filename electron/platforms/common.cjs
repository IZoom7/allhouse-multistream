'use strict';
/**
 * Keeps one platform connection alive. `open(ready, fail)` starts one attempt and returns a cleanup function;
 * it calls ready(detail) once connected, fail(err) on loss (retried with backoff) or fail(err, true) to give up.
 * Status states: connecting | connected | retrying | error | stopped.
 */
function reconnecting({ label, open, onStatus = () => {}, readyTimeoutMs = 20000 }) {
  let cleanup = null, timer = null, stopped = false, attempt = 0, current = 0;
  const status = (state, detail = '') => { if (!stopped || state === 'stopped') onStatus({ state, detail }); };
  const start = () => {
    if (stopped) return;
    const id = ++current;
    status(attempt ? 'retrying' : 'connecting', attempt ? `attempt ${attempt + 1}` : '');
    const readyTimer = setTimeout(() => fail(new Error(`${label} did not answer in time`)), readyTimeoutMs);
    const ready = detail => { if (id !== current || stopped) return; clearTimeout(readyTimer); attempt = 0; status('connected', detail || ''); };
    const fail = (err, fatal = false) => {
      if (id !== current || stopped) return;
      clearTimeout(readyTimer); current++;
      try { cleanup && cleanup(); } catch {}
      cleanup = null;
      if (fatal) { stopped = true; onStatus({ state: 'error', detail: err.message }); return; }
      attempt++; const wait = Math.min(60000, 2000 * 2 ** Math.min(attempt - 1, 5));
      onStatus({ state: 'retrying', detail: `${err.message} — retrying in ${Math.round(wait / 1000)}s` });
      timer = setTimeout(start, wait);
    };
    try { cleanup = open(ready, fail); } catch (err) { fail(err); }
  };
  start();
  return {
    close() {
      stopped = true; current++; clearTimeout(timer);
      try { cleanup && cleanup(); } catch {}
      cleanup = null; onStatus({ state: 'stopped', detail: '' });
    },
  };
}

module.exports = { reconnecting };
