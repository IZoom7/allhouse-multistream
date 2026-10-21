// Chat TTS page: which platforms are read aloud, and the reading rules (round 9).
import React,{useEffect,useState} from 'react';
import {Filter} from 'lucide-react';
import {PlatformMark,Toggle,platformNames} from './components';
import {MAX_IGNORE_CHARS,TTS_PLATFORMS,rulesOf,speechFor} from './ttsRules';
import type {Platform,TtsRules,TtsSettings} from './types';

type T=(th:string,en:string)=>string;
export function TtsRulesPanel({t,tts,onChange}:{t:T;tts:TtsSettings;onChange:(r:TtsRules)=>void}){
  const r=rulesOf(tts);
  const set=(patch:Partial<TtsRules>)=>onChange({...r,...patch});
  const setPlatform=(p:Platform,on:boolean)=>set({platforms:{...r.platforms,[p]:on}});
  // max length commits on blur so typing "1" on the way to "150" doesn't jump to 20
  const [maxText,setMaxText]=useState(String(r.maxChars));useEffect(()=>setMaxText(String(r.maxChars)),[r.maxChars]);
  const commitMax=()=>{const n=Math.round(Number(maxText));const v=Number.isFinite(n)?Math.max(20,Math.min(500,n)):r.maxChars;setMaxText(String(v));if(v!==r.maxChars)set({maxChars:v})};
  const sample=speechFor({platform:'tiktok',name:'mintmint',message:'สวัสดีทุกคน ไลฟ์วันนี้สนุกมาก https://example.com'},r);
  const on=TTS_PLATFORMS.filter(p=>r.platforms[p]).length;
  return <section className="panel tts-rules">
    <div className="panel-heading"><div><h2><Filter size={19}/>{t('อ่านแชทจากที่ไหน และอ่านอย่างไร','Which chat is read, and how')}</h2><p>{t('ใช้กับแชทจริงจากทุกแพลตฟอร์มที่เชื่อมไว้ และแชททดสอบ','Applies to real chat from every connected platform and to test chats')}</p></div><span className={on?'pill':'pill amber'}>{t(`อ่าน ${on}/4 แพลตฟอร์ม`,`Reading ${on}/4 platforms`)}</span></div>
    <div className="tts-platform-grid" role="group" aria-label={t('อ่านแชทจากแพลตฟอร์ม','Read chat from')}>
      {TTS_PLATFORMS.map(p=><div key={p} className={'tts-platform'+(r.platforms[p]?' on':'')}><PlatformMark platform={p}/><div><strong>{platformNames[p]}</strong><small>{r.platforms[p]?t('อ่านออกเสียง','Read aloud'):t('ปิดเสียง (ยังแสดงในแชท)','Muted (still shown in chat)')}</small></div><Toggle checked={r.platforms[p]} onChange={v=>setPlatform(p,v)} label={t(`อ่านแชท ${platformNames[p]}`,`Read ${platformNames[p]} chat`)}/></div>)}
    </div>
    <div className="two-columns tts-rule-cols">
      <div className="form-panel">
        <Toggle checked={r.readName} onChange={readName=>set({readName})} label={t('อ่านชื่อผู้ชมก่อนข้อความ (“mintmint บอกว่า …”)','Say the viewer’s name first (“mintmint says …”)')}/>
        <Toggle checked={r.skipCommands} onChange={skipCommands=>set({skipCommands})} label={t('ข้ามคำสั่งบอท (ข้อความที่ขึ้นต้นด้วย ! หรือ /)','Skip bot commands (messages starting with ! or /)')}/>
        <label>{t('อ่านยาวสุดต่อข้อความ (ตัวอักษร)','Longest message to read (characters)')}<input type="number" min={20} max={500} value={maxText} onChange={e=>setMaxText(e.target.value)} onBlur={commitMax} onKeyDown={e=>{if(e.key==='Enter')commitMax()}}/><small className="helper">{t('20–500 • ยาวกว่านี้จะอ่านแค่ส่วนแรก • ลิงก์จะไม่ถูกอ่านเสมอ','20–500 • longer messages are cut • links are never read')}</small></label>
      </div>
      <div className="form-panel">
        <label>{t('ไม่อ่านแชทจากชื่อเหล่านี้','Never read chat from these names')}<textarea rows={4} maxLength={MAX_IGNORE_CHARS} value={r.ignoreNames} onChange={e=>set({ignoreNames:e.target.value})} placeholder="Nightbot, StreamElements"/><small className="helper">{t('คั่นด้วยจุลภาคหรือขึ้นบรรทัดใหม่ • ไม่สนตัวพิมพ์เล็กใหญ่ • ใส่บอทหรือคนที่ไม่อยากให้อ่าน','Separate with commas or new lines • not case-sensitive • add bots or anyone you don’t want read')}</small></label>
        <div className="tts-rule-sample"><small>{t('ตัวอย่างแชท TikTok จาก mintmint จะถูกอ่านว่า:','A TikTok chat from mintmint would be read as:')}</small><p>{'text' in sample?`“${sample.text}”`:t('— ไม่อ่าน (ปิดเสียง TikTok หรืออยู่ในรายชื่อที่ไม่อ่าน) —','— not read (TikTok is muted or the name is ignored) —')}</p></div>
      </div>
    </div>
  </section>;
}
