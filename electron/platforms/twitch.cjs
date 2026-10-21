'use strict';
// Twitch chat over the public IRC WebSocket, anonymously (justinfanNNNN): no login, no Client ID.
// Gives chat + sub/resub/gift notices. Follows need EventSub + a user token (separate step, needs a Client ID).
const { reconnecting } = require('./common.cjs');

const URL = 'wss://irc-ws.chat.twitch.tv:443';

function normaliseChannel(input) {
  const s = String(input || '').trim().replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/^[#@]/, '').split(/[/?#]/)[0].toLowerCase();
  return /^[a-z0-9_]{3,25}$/.test(s) ? s : null;
}

const unescapeTag = v => v.replace(/\\(.)/g, (_, c) => ({ s: ' ', ':': ';', '\\': '\\', r: '\r', n: '\n' })[c] ?? c);

/** One raw IRC line -> { tags, command, params, trailing } */
function parseLine(line) {
  let rest = line, tags = {};
  if (rest.startsWith('@')) {
    const sp = rest.indexOf(' ');
    for (const kv of rest.slice(1, sp).split(';')) { const i = kv.indexOf('='); tags[i < 0 ? kv : kv.slice(0, i)] = i < 0 ? '' : unescapeTag(kv.slice(i + 1)); }
    rest = rest.slice(sp + 1);
  }
  let prefix = '';
  if (rest.startsWith(':')) { const sp = rest.indexOf(' '); prefix = rest.slice(1, sp); rest = rest.slice(sp + 1); }
  const ti = rest.indexOf(' :');
  const trailing = ti < 0 ? '' : rest.slice(ti + 2);
  const [command, ...params] = (ti < 0 ? rest : rest.slice(0, ti)).split(' ').filter(Boolean);
  return { tags, prefix, command, params, trailing };
}

const SUB_IDS = ['sub', 'resub', 'subgift', 'submysterygift', 'anonsubgift', 'giftpaidupgrade', 'anongiftpaidupgrade', 'primepaidupgrade'];

/** IRC line -> Allhouse event ({type,name,message}) or null. */
function toEvent(msg) {
  const name = msg.tags['display-name'] || (msg.prefix.split('!')[0]) || msg.tags.login || '';
  if (msg.command === 'PRIVMSG') {
    let text = msg.trailing;
    const action = /^\u0001ACTION (.*)\u0001$/.exec(text); if (action) text = action[1];
    return { type: 'chat', name, message: text };
  }
  if (msg.command === 'USERNOTICE' && SUB_IDS.includes(msg.tags['msg-id'])) {
    const system = msg.tags['system-msg'] || 'subscribed';
    return { type: 'subscription', name: name || msg.tags.login || 'Anonymous', message: msg.trailing ? system + ' — ' + msg.trailing : system };
  }
  return null;
}

/** Live connection. onEvent({type,name,message}), onStatus({state, detail}). Returns { close() }. */
function connect({ channel, WebSocket = globalThis.WebSocket, onEvent, onStatus }) {
  const ch = normaliseChannel(channel);
  if (!ch) throw new Error('Twitch channel name looks wrong. Use the name from twitch.tv/<name>.');
  return reconnecting({
    label: 'Twitch', onStatus,
    open(ready, fail) {
      const ws = new WebSocket(URL);
      let joined = false;
      ws.onopen = () => {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send('PASS SCHMOOPIIE');
        ws.send('NICK justinfan' + (10000 + Math.floor(Math.random() * 80000)));
        ws.send('JOIN #' + ch);
      };
      ws.onmessage = ev => {
        for (const line of String(ev.data).split('\r\n')) {
          if (!line) continue;
          const msg = parseLine(line);
          if (msg.command === 'PING') { ws.send('PONG :' + msg.trailing); continue; }
          if (msg.command === 'RECONNECT') { ws.close(); continue; }
          if (!joined && (msg.command === 'ROOMSTATE' || msg.command === '366')) { joined = true; ready('#' + ch); continue; }
          if (msg.command === 'NOTICE' && /msg_channel_suspended|does not exist/i.test(msg.tags['msg-id'] + msg.trailing)) { fail(new Error('Channel not found or suspended'), true); continue; }
          const e = toEvent(msg); if (e) onEvent(e);
        }
      };
      ws.onerror = () => {};
      ws.onclose = () => fail(new Error('Connection closed'));
      return () => { try { ws.close(); } catch {} };
    },
  });
}

module.exports = { connect, parseLine, toEvent, normaliseChannel };
