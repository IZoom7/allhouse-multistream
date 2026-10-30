// Pop-out chat window display options. Edited in the main window (Settings), read by the pop-out.
// Both windows load the same page, so they share localStorage; the 'storage' event carries changes across live.
import {useEffect,useState} from 'react';
import type {Platform} from './types';

export type StatKey='viewers'|'likes'|'shares'|'uptime';
export type ChatWinPrefs={avatar:boolean;icon:boolean;platformName:boolean;time:boolean;nameColor:'accent'|'platform'|'user';tests:boolean;compact:boolean;follow:boolean;
  font:number;theme:'app'|'dark'|'light';stats:Record<StatKey,boolean>;statPlatforms:Record<Platform,boolean>};
const KEY='allhouse-chatwin-view',OLD_FONT='allhouse-chatwin-font',OLD_THEME='allhouse-chatwin-theme';
export const DEFAULT_CHATWIN:ChatWinPrefs={avatar:true,icon:true,platformName:true,time:true,nameColor:'user',tests:true,compact:false,follow:true,
  font:20,theme:'app',stats:{viewers:true,likes:true,shares:true,uptime:false},statPlatforms:{tiktok:true,youtube:true,twitch:true,kick:true}};
export const clampFont=(n:number)=>Math.max(14,Math.min(36,Math.round(n)||20));

export function readChatWinPrefs():ChatWinPrefs{
  try{
    const raw=JSON.parse(localStorage.getItem(KEY)||'{}')||{};
    // Older builds kept font size and theme under their own keys.
    const font=raw.font??Number(localStorage.getItem(OLD_FONT)),oldTheme=localStorage.getItem(OLD_THEME);
    return {...DEFAULT_CHATWIN,...raw,font:clampFont(font),theme:raw.theme??(oldTheme==='dark'||oldTheme==='light'?oldTheme:'app'),
      stats:{...DEFAULT_CHATWIN.stats,...raw.stats},statPlatforms:{...DEFAULT_CHATWIN.statPlatforms,...raw.statPlatforms}};
  }catch{return DEFAULT_CHATWIN}
}

/** Current prefs, kept in step with changes made in the other window. */
export function useChatWinPrefs():[ChatWinPrefs,(patch:Partial<ChatWinPrefs>)=>void]{
  const [prefs,setPrefs]=useState(readChatWinPrefs);
  useEffect(()=>{const h=(e:StorageEvent)=>{if(e.key===KEY)setPrefs(readChatWinPrefs())};addEventListener('storage',h);return()=>removeEventListener('storage',h)},[]);
  const update=(patch:Partial<ChatWinPrefs>)=>setPrefs(p=>{const next={...p,...patch};try{localStorage.setItem(KEY,JSON.stringify(next))}catch{}return next});
  return [prefs,update];
}
