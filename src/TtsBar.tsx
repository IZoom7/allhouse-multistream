// Compact chat-speech control bar, used on Chat & activity and in the pop-out chat window.
// Speech itself always plays in the main window; the pop-out only sends commands (see main.cjs speech relay).
import React from 'react';
import {Settings,SkipForward,Square,Volume2} from 'lucide-react';
import type {Platform,SpeechStatus} from './types';
import {PlatformMark,platformNames} from './components';
import {TTS_PLATFORMS} from './ttsRules';

type T=(th:string,en:string)=>string;
export function TtsBar({t,status,onToggle,onVolume,onRate,onStop,onSkip,onSettings,onPlatform,note,disabled}:{t:T;status:SpeechStatus|null;onToggle:(v:boolean)=>void;onVolume:(v:number)=>void;onRate:(v:number)=>void;onStop:()=>void;onSkip:()=>void;onSettings:()=>void;onPlatform?:(p:Platform,on:boolean)=>void;note?:React.ReactNode;disabled?:boolean}){
  const s=status||{speaking:false,enabled:false,volume:0.8,rate:1,pending:0,engine:'windows' as const};
  const off=disabled||!status;
  return <section className="tts-bar" aria-label={t('ควบคุมบอทอ่านแชท','Chat speech controls')}>
    <div className="tts-bar-row">
      <span className="tts-bar-title"><Volume2 size={17}/>{t('บอทอ่านแชท','Chat TTS')}</span>
      <button type="button" role="switch" aria-checked={s.enabled} disabled={off} className={'toggle '+(s.enabled?'on':'')} aria-label={s.enabled?t('ปิดบอทอ่านแชท','Turn chat TTS off'):t('เปิดบอทอ่านแชท','Turn chat TTS on')} onClick={()=>onToggle(!s.enabled)}><span/></button>
      <span className={'tts-state'+(s.speaking?' speaking':'')} role="status" aria-live="polite"><span className={'dot '+(s.speaking?'pulse':'off')}/>{s.speaking?t('กำลังอ่าน…','Reading…'):s.enabled?t('พร้อมอ่าน','Ready'):t('ปิดอยู่','Off')}{s.pending>0&&<small>{t(` • รออีก ${s.pending}`,` • ${s.pending} waiting`)}</small>}</span>
    </div>
    <div className="tts-bar-row">
      <label className="tts-range">{t('ระดับเสียง','Volume')} <span className="range-value">{Math.round(s.volume*100)}%</span><input type="range" min="0" max="1" step="0.05" disabled={off} value={s.volume} onChange={e=>onVolume(Number(e.target.value))}/></label>
      <label className="tts-range">{t('ความเร็ว','Speed')} <span className="range-value">{s.rate.toFixed(1)}×</span><input type="range" min="0.5" max="2" step="0.1" disabled={off} value={s.rate} onChange={e=>onRate(Number(e.target.value))}/></label>
    </div>
    {onPlatform&&s.platforms&&<div className="tts-bar-row tts-platforms" role="group" aria-label={t('อ่านแชทจากแพลตฟอร์ม','Read chat from')}>
      <span className="tts-bar-label">{t('อ่านจาก','Read from')}</span>
      {TTS_PLATFORMS.map(p=>{const on=s.platforms![p];return <button key={p} type="button" className={'tts-chip'+(on?' on':'')} aria-pressed={on} disabled={off} title={on?t(`อ่านแชท ${platformNames[p]} อยู่ • กดเพื่อปิด`,`Reading ${platformNames[p]} chat • click to mute`):t(`ไม่อ่านแชท ${platformNames[p]} • กดเพื่อเปิด`,`${platformNames[p]} chat muted • click to read`)} onClick={()=>onPlatform(p,!on)}><PlatformMark platform={p}/><span>{platformNames[p]}</span><span className="tts-chip-state">{on?t('เปิด','ON'):t('ปิด','OFF')}</span></button>})}
    </div>}
    <div className="tts-bar-row actions">
      <button type="button" className="button secondary compact" disabled={off||!s.speaking} onClick={onSkip}><SkipForward size={15}/>{t('ข้ามข้อความนี้','Skip current')}</button>
      <button type="button" className="button secondary compact danger" disabled={off} onClick={onStop}><Square size={14}/>{t('หยุดและล้างคิว','Stop & clear')}</button>
      <button type="button" className="text-button" onClick={onSettings}><Settings size={15}/>{t('ตั้งค่าเสียงทั้งหมด','All speech settings')}</button>
    </div>
    {note&&<p className="helper">{note}</p>}
  </section>;
}
