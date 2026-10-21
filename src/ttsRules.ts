// Chat reading rules (round 9): which platforms are read aloud and how. Pure functions, shared by live and test chats.
import type {Platform,TtsRules,TtsSettings} from './types';

export const TTS_PLATFORMS:Platform[]=['twitch','youtube','kick','tiktok'];
export const DEFAULT_TTS_RULES:TtsRules={
  platforms:{twitch:true,youtube:true,kick:true,tiktok:true},
  readName:false,
  skipCommands:true,
  ignoreNames:'Nightbot, StreamElements, Streamlabs, Moobot, Fossabot, Sery_Bot',
  maxChars:200,
};
export const MAX_IGNORE_CHARS=2000;

/** Saved rules merged over the defaults (workspaces saved before round 9 have none). */
export function rulesOf(tts:Pick<TtsSettings,'rules'>|undefined):TtsRules{
  const r=tts?.rules;
  return {...DEFAULT_TTS_RULES,...(r||{}),platforms:{...DEFAULT_TTS_RULES.platforms,...(r?.platforms||{})}};
}

/** Names in the ignore box, one per comma or line, compared without case or a leading @. */
export const ignoredNames=(text:string)=>text.split(/[\n,]+/).map(s=>s.trim().replace(/^@/,'').toLowerCase()).filter(Boolean);

export type SkipReason='platform'|'ignored-name'|'command'|'empty';
/**
 * What the bot should say for one chat message, or why it stays quiet.
 * Links are removed, long messages are cut at maxChars (by character, so Thai vowels/tone marks are never split from their letter).
 */
export function speechFor(e:{platform:Platform;name:string;message:string},rules:TtsRules):{text:string}|{skip:SkipReason}{
  if(!rules.platforms[e.platform])return {skip:'platform'};
  const name=e.name.trim().replace(/^@/,'');
  if(ignoredNames(rules.ignoreNames).includes(name.toLowerCase()))return {skip:'ignored-name'};
  let msg=e.message.trim();
  if(rules.skipCommands&&/^[!/]/.test(msg))return {skip:'command'};
  msg=msg.replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim();
  if(!msg)return {skip:'empty'};
  const chars=Array.from(msg);
  if(chars.length>rules.maxChars){
    let cut=rules.maxChars;
    while(cut>0&&/[ัิ-ฺ็-๎]/.test(chars[cut]||''))cut--; // never end on a dangling Thai mark
    msg=chars.slice(0,cut).join('');
  }
  if(!rules.readName)return {text:msg};
  const thai=/[฀-๿]/.test(msg);
  return {text:thai?`${name} บอกว่า ${msg}`:`${name} says ${msg}`};
}
