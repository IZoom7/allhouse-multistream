'use strict';
// YouTube live chat via InnerTube, the endpoint YouTube's own chat pop-out uses (unofficial; no API key, no quota,
// but against YouTube's ToS on automated access and the payload can change). Verified Oct 2026.
// Gives chat, Super Chat (as chat with the amount), new members and gifted memberships. Channel "subscribes" are not in chat.
const { reconnecting } = require('./common.cjs');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'en' };

/** "@handle", channel URL, watch URL, youtu.be link or bare 11-char video id -> { videoId } | { handlePath } | null */
function parseTarget(input) {
  const s = String(input || '').trim();
  const vid = /(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([A-Za-z0-9_-]{11})/.exec(s) || /^([A-Za-z0-9_-]{11})$/.exec(s);
  if (vid && !s.startsWith('@')) return { videoId: vid[1] };
  const h = /^(?:https?:\/\/(?:www\.|m\.)?youtube\.com\/)?(@[A-Za-z0-9._-]{3,30}|channel\/UC[A-Za-z0-9_-]{22}|c\/[A-Za-z0-9._-]+)\/?/.exec(s);
  return h ? { handlePath: h[1] } : null;
}

/** Largest author photo YouTube sends with the message. */
const photo = r => { const t = r && r.authorPhoto && r.authorPhoto.thumbnails; const u = t && t.length && t[t.length - 1].url; return u ? { avatar: u } : {}; };
const runsText = r => !r ? '' : r.simpleText || (r.runs || []).map(x => x.text != null ? x.text : x.emoji ? (x.emoji.isCustomEmoji ? (x.emoji.shortcuts || [''])[0] : x.emoji.emojiId) : '').join('');

/** One chat action -> Allhouse event or null. */
function toEvent(action) {
  const item = action && action.addChatItemAction && action.addChatItemAction.item;
  if (!item) return null;
  if (item.liveChatTextMessageRenderer) {
    const r = item.liveChatTextMessageRenderer;
    return { type: 'chat', name: runsText(r.authorName), message: runsText(r.message), ...photo(r) };
  }
  if (item.liveChatPaidMessageRenderer) {
    const r = item.liveChatPaidMessageRenderer, amt = runsText(r.purchaseAmountText);
    return { type: 'chat', name: runsText(r.authorName), message: `[Super Chat ${amt}] ${runsText(r.message)}`.trim(), ...photo(r) };
  }
  if (item.liveChatMembershipItemRenderer) {
    const r = item.liveChatMembershipItemRenderer;
    return { type: 'subscription', name: runsText(r.authorName), message: runsText(r.headerSubtext) || runsText(r.headerPrimaryText) || 'became a member' };
  }
  const gift = item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer;
  if (gift) {
    const h = gift.header && gift.header.liveChatSponsorshipsHeaderRenderer;
    return { type: 'subscription', name: runsText(h && h.authorName), message: runsText(h && h.primaryText) || 'gifted memberships' };
  }
  return null;
}

function extractJson(html, name) {
  const i = html.indexOf(name);
  if (i < 0) return null;
  const start = html.indexOf('{', i);
  let depth = 0, inStr = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (inStr) { if (c === '\\') j++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) { try { return JSON.parse(html.slice(start, j + 1)); } catch { return null; } }
  }
  return null;
}

/** Chat pop-out HTML -> { apiKey, clientVersion, continuation } */
function parseChatPage(html) {
  const apiKey = (/"INNERTUBE_API_KEY":"([^"]+)"/.exec(html) || [])[1];
  const clientVersion = (/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/.exec(html) || [])[1];
  const data = extractJson(html, 'ytInitialData');
  const lcr = data && data.contents && data.contents.liveChatRenderer;
  // The pop-out opens in "Top chat" (filtered). The view selector's last item is "Live chat" (every message): prefer it.
  const items = (((((lcr || {}).header || {}).liveChatHeaderRenderer || {}).viewSelector || {}).sortFilterSubMenuRenderer || {}).subMenuItems || [];
  const all = items.length ? ((items[items.length - 1].continuation || {}).reloadContinuationData || {}).continuation : null;
  const c = lcr && lcr.continuations && lcr.continuations[0];
  const continuation = all || (c && (c.invalidationContinuationData || c.timedContinuationData || c.reloadContinuationData || {}).continuation);
  return apiKey && clientVersion && continuation ? { apiKey, clientVersion, continuation } : null;
}

/** get_live_chat response -> { actions, continuation, timeoutMs } */
function parseChatResponse(j) {
  const lc = j && j.continuationContents && j.continuationContents.liveChatContinuation;
  if (!lc) return { actions: [], continuation: null, timeoutMs: 0 };
  const c = (lc.continuations || [])[0] || {};
  const d = c.invalidationContinuationData || c.timedContinuationData || c.reloadContinuationData || {};
  return { actions: lc.actions || [], continuation: d.continuation || null, timeoutMs: Math.max(1000, Math.min(5000, d.timeoutMs || 3000)) };
}

function connect({ channel, fetch = globalThis.fetch, onEvent, onStatus }) {
  const target = parseTarget(channel);
  if (!target) throw new Error('Use a YouTube channel (@name) or a live video link.');
  return reconnecting({
    label: 'YouTube', onStatus, readyTimeoutMs: 30000,
    open(ready, fail) {
      let stop = false, timer = null;
      (async () => {
        let videoId = target.videoId;
        if (!videoId) {
          const html = await (await fetch(`https://www.youtube.com/${target.handlePath}/live`, { headers: HEADERS })).text();
          const canon = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/.exec(html);
          if (!canon || !/"isLiveNow":true/.test(html)) return fail(new Error('Channel is not live right now'));
          videoId = canon[1];
        }
        if (stop) return;
        const page = parseChatPage(await (await fetch(`https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`, { headers: HEADERS })).text());
        if (!page) return fail(new Error('Live chat is off or this video is not live'));
        let { continuation } = page, first = true;
        ready('youtube.com/watch?v=' + videoId);
        const poll = async () => {
          if (stop) return;
          try {
            const r = await fetch(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${page.apiKey}&prettyPrint=false`, {
              method: 'POST', headers: { ...HEADERS, 'Content-Type': 'application/json' },
              body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: page.clientVersion, hl: 'en' } }, continuation }),
            });
            if (!r.ok) return fail(new Error('YouTube chat HTTP ' + r.status));
            const res = parseChatResponse(await r.json());
            if (!res.continuation) return fail(new Error('The live stream ended'));
            if (!first) for (const a of res.actions) { const e = toEvent(a); if (e && e.name) onEvent(e); }
            first = false; continuation = res.continuation; // the first batch is backlog: never replay old chat
            if (!stop) timer = setTimeout(poll, res.timeoutMs);
          } catch (e) { fail(new Error('Could not reach YouTube')); }
        };
        poll();
      })().catch(() => fail(new Error('Could not reach YouTube')));
      return () => { stop = true; clearTimeout(timer); };
    },
  });
}

module.exports = { connect, parseTarget, toEvent, parseChatPage, parseChatResponse, extractJson };
