'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const twitch = require('../electron/platforms/twitch.cjs');
const kick = require('../electron/platforms/kick.cjs');
const youtube = require('../electron/platforms/youtube.cjs');
const tiktok = require('../electron/platforms/tiktok.cjs');
const { reconnecting } = require('../electron/platforms/common.cjs');

test('twitch: channel names, chat, /me, sub notices; ignores other lines', () => {
  assert.equal(twitch.normaliseChannel('https://www.twitch.tv/XQC/videos'), 'xqc');
  assert.equal(twitch.normaliseChannel('#caseoh_'), 'caseoh_');
  assert.equal(twitch.normaliseChannel('bad name!'), null);
  const chat = twitch.parseLine('@badges=;color=#FF0000;display-name=Mint\\sMint;id=1 :mint!mint@mint.tmi.twitch.tv PRIVMSG #xqc :สวัสดี hello');
  assert.deepEqual(twitch.toEvent(chat), { type: 'chat', name: 'Mint Mint', message: 'สวัสดี hello', login: 'mint', color: '#FF0000' });
  assert.equal(twitch.toEvent(twitch.parseLine(':a!a@a PRIVMSG #x :\u0001ACTION waves\u0001')).message, 'waves');
  const sub = twitch.parseLine('@display-name=Bob;msg-id=resub;system-msg=Bob\\ssubscribed\\sfor\\s3\\smonths! :tmi.twitch.tv USERNOTICE #xqc :hype');
  assert.deepEqual(twitch.toEvent(sub), { type: 'subscription', name: 'Bob', message: 'Bob subscribed for 3 months! — hype' });
  assert.equal(twitch.toEvent(twitch.parseLine('@msg-id=raid :tmi.twitch.tv USERNOTICE #xqc')), null);
  assert.equal(twitch.toEvent(twitch.parseLine('PING :tmi.twitch.tv')), null);
});

test('kick: chat (emotes become names), subs, gifts, follows; slugs', () => {
  const push = (event, data) => ({ channel: 'chatrooms.1.v2', pub: { data: { event, data: JSON.stringify(data) } } });
  assert.deepEqual(kick.toEvent(push('App\\Events\\ChatMessageEvent', { content: 'hi [emote:39402:Flowie]', sender: { username: 'Deazy' } })), { type: 'chat', name: 'Deazy', message: 'hi Flowie' });
  assert.equal(kick.toEvent(push('App\\Events\\ChatMessageEvent', { content: 'x', sender: { username: 'D', identity: { color: '#75FD46' } } })).color, '#75FD46');
  assert.equal(kick.toEvent(push('App\\Events\\SubscriptionEvent', { username: 'a', months: 3 })).message, 'subscribed for 3 months');
  assert.equal(kick.toEvent(push('App\\Events\\GiftedSubscriptionsEvent', { gifter_username: 'g', gifted_usernames: ['x', 'y'] })).message, 'gifted 2 subs');
  assert.equal(kick.toEvent(push('App\\Events\\FollowersUpdated', { followed: true, username: 'f' })).type, 'follow');
  assert.equal(kick.toEvent(push('App\\Events\\FollowersUpdated', { followed: false })), null);
  assert.equal(kick.toEvent({ pub: { data: { event: 'App\\Events\\ChatMessageEvent', data: '{broken' } } }), null);
  assert.equal(kick.normaliseSlug('https://kick.com/ClassyBeef'), 'classybeef');
  assert.equal(kick.normaliseSlug('../etc'), null);
});

test('youtube: targets, chat runs with emoji, super chat, members, page + response parsing', () => {
  assert.deepEqual(youtube.parseTarget('@LofiGirl'), { handlePath: '@LofiGirl' });
  assert.deepEqual(youtube.parseTarget('https://www.youtube.com/@LofiGirl/live'), { handlePath: '@LofiGirl' });
  assert.deepEqual(youtube.parseTarget('https://www.youtube.com/watch?v=0sfDth4lMLc'), { videoId: '0sfDth4lMLc' });
  assert.deepEqual(youtube.parseTarget('https://youtu.be/0sfDth4lMLc'), { videoId: '0sfDth4lMLc' });
  assert.equal(youtube.parseTarget('not a channel'), null);
  const add = item => ({ addChatItemAction: { item } });
  assert.deepEqual(youtube.toEvent(add({ liveChatTextMessageRenderer: { authorName: { simpleText: '@A' }, message: { runs: [{ text: 'hi ' }, { emoji: { emojiId: '😉' } }, { emoji: { isCustomEmoji: true, shortcuts: [':yt:'] } }] } } })), { type: 'chat', name: '@A', message: 'hi 😉:yt:' });
  assert.equal(youtube.toEvent(add({ liveChatTextMessageRenderer: { authorName: { simpleText: 'A' }, message: { runs: [{ text: 'x' }] }, authorPhoto: { thumbnails: [{ url: 'https://yt4.ggpht.com/s32' }, { url: 'https://yt4.ggpht.com/s64' }] } } })).avatar, 'https://yt4.ggpht.com/s64');
  assert.equal(youtube.toEvent(add({ liveChatPaidMessageRenderer: { authorName: { simpleText: 'B' }, purchaseAmountText: { simpleText: '฿100' }, message: { runs: [{ text: 'gg' }] } } })).message, '[Super Chat ฿100] gg');
  assert.equal(youtube.toEvent(add({ liveChatMembershipItemRenderer: { authorName: { simpleText: 'C' }, headerSubtext: { simpleText: 'Welcome to Members!' } } })).type, 'subscription');
  assert.equal(youtube.toEvent({ markChatItemAsDeletedAction: {} }), null);
  const html = '<script>ytcfg.set({"INNERTUBE_API_KEY":"KEY","INNERTUBE_CONTEXT_CLIENT_VERSION":"2.1"});</script><script>window["ytInitialData"] = {"contents":{"liveChatRenderer":{"continuations":[{"invalidationContinuationData":{"continuation":"TOP"}}],"header":{"liveChatHeaderRenderer":{"viewSelector":{"sortFilterSubMenuRenderer":{"subMenuItems":[{"continuation":{"reloadContinuationData":{"continuation":"TOP"}}},{"continuation":{"reloadContinuationData":{"continuation":"ALL \\"q\\" }"}}}]}}}}}}};</script>';
  assert.deepEqual(youtube.parseChatPage(html), { apiKey: 'KEY', clientVersion: '2.1', continuation: 'ALL "q" }' });
  const res = youtube.parseChatResponse({ continuationContents: { liveChatContinuation: { continuations: [{ invalidationContinuationData: { continuation: 'N', timeoutMs: 10000 } }], actions: [1] } } });
  assert.deepEqual(res, { actions: [1], continuation: 'N', timeoutMs: 5000 });
  assert.equal(youtube.parseChatResponse({}).continuation, null);
});

test('tiktok (TikFinity): chat, follow, social follow, subscribe; nested user fields; local-only address', () => {
  assert.deepEqual(tiktok.toEvent({ event: 'chat', data: { comment: 'สวัสดี', uniqueId: 'u1', nickname: 'Nick' } }), { type: 'chat', name: 'Nick', message: 'สวัสดี' });
  assert.equal(tiktok.toEvent({ event: 'chat', data: { comment: 'x', user: { uniqueId: 'nested' } } }).name, 'nested');
  assert.equal(tiktok.toEvent({ event: 'chat', data: { comment: 'x', nickname: 'n', profilePictureUrl: 'https://p16-sign.tiktokcdn.com/a.webp' } }).avatar, 'https://p16-sign.tiktokcdn.com/a.webp');
  assert.equal(tiktok.toEvent({ event: 'chat', data: { comment: 'x', user: { nickname: 'n', avatarThumb: { urlList: ['https://p77.tiktokcdn-us.com/b.jpg'] } } } }).avatar, 'https://p77.tiktokcdn-us.com/b.jpg');
  assert.equal(tiktok.toEvent({ event: 'follow', data: { nickname: 'F' } }).type, 'follow');
  assert.equal(tiktok.toEvent({ event: 'social', data: { nickname: 'F', displayType: 'pm_main_follow_message_viewer_2' } }).type, 'follow');
  assert.equal(tiktok.toEvent({ event: 'social', data: { displayType: 'pm_mt_guidance_share' } }), null);
  assert.equal(tiktok.toEvent({ event: 'subscribe', data: { nickname: 'S' } }).type, 'subscription');
  // Gifts: streakable gifts alert once at the end of the combo; one-shot gifts alert immediately.
  assert.equal(tiktok.toEvent({ event: 'gift', data: { nickname: 'G', giftType: 1, repeatEnd: false, repeatCount: 3, giftName: 'Rose' } }), null);
  assert.deepEqual(tiktok.toEvent({ event: 'gift', data: { nickname: 'G', giftType: 1, repeatEnd: true, repeatCount: 5, giftName: 'Rose', diamondCount: 1, giftPictureUrl: 'https://p16-webcast.tiktokcdn.com/rose.png' } }),
    { type: 'gift', name: 'G', message: 'Rose ×5', gift: { name: 'Rose', count: 5, coins: 1, image: 'https://p16-webcast.tiktokcdn.com/rose.png' } });
  const lion = tiktok.toEvent({ event: 'gift', data: { user: { nickname: 'L' }, giftDetails: { giftName: 'Lion', diamondCount: 29999, giftType: 2 } } });
  assert.deepEqual([lion.name, lion.gift.name, lion.gift.count, lion.gift.coins], ['L', 'Lion', 1, 29999]);
  assert.throws(() => tiktok.connect({ url: 'ws://evil.example:21213/', onEvent() {}, onStatus() {} }));
});

test('reconnecting: retries with backoff, gives up on fatal errors, close stops everything', async () => {
  const states = [];
  let opens = 0;
  const c = reconnecting({ label: 'T', onStatus: s => states.push(s.state), open(ready, fail) { opens++; if (opens === 1) setTimeout(() => fail(new Error('drop')), 5); else ready('ok'); return () => {}; } });
  await new Promise(r => setTimeout(r, 2200));
  assert.deepEqual(states, ['connecting', 'retrying', 'retrying', 'connected']);
  c.close();
  assert.equal(states.at(-1), 'stopped');
  const s2 = [];
  reconnecting({ label: 'T', onStatus: s => s2.push(s), open(_r, fail) { fail(new Error('not found'), true); return () => {}; } });
  assert.deepEqual(s2.map(s => s.state), ['connecting', 'error']);
});
