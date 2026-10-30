// Settings → Chat window: everything that used to sit in the pop-out's own toolbar, plus which live numbers it shows.
import {useEffect,useState} from 'react';
import {ExternalLink} from 'lucide-react';
import {api,errorText} from './api';
import {Toggle,platformNames} from './components';
import {clampFont,useChatWinPrefs,type ChatWinPrefs,type StatKey} from './chatWindowPrefs';
import type {Platform} from './types';

type T=(a:string,b:string)=>string;
const PLATFORMS:Platform[]=['tiktok','youtube','twitch','kick'];

export function ChatWindowSettings({t,onError,onOpen}:{t:T;onError:(msg:string)=>void;onOpen:()=>void}){
  const [prefs,update]=useChatWinPrefs();
  const [top,setTop]=useState<boolean|null>(null);
  useEffect(()=>{api.getChatWindowState?.().then(s=>setTop(s.top)).catch(()=>{})},[]);
  const setPin=(v:boolean)=>api.setChatWindowTop?.(v).then(s=>setTop(s.top)).catch(e=>onError(errorText(e)));
  const stat=(k:StatKey,v:boolean)=>update({stats:{...prefs.stats,[k]:v}});
  const show=(k:keyof ChatWinPrefs,label:string)=><Toggle checked={!!prefs[k]} onChange={v=>update({[k]:v} as Partial<ChatWinPrefs>)} label={label}/>;
  return <div className="two-columns">
    <section className="panel form-panel">
      <div className="panel-heading"><h2>{t('หน้าต่างแชท','Chat window')}</h2><button type="button" className="button secondary compact" onClick={onOpen}><ExternalLink size={15}/>{t('เปิดหน้าต่างแชท','Pop out chat')}</button></div>
      <p className="helper">{t('ค่าตรงนี้ใช้กับหน้าต่างแชทแยกเท่านั้น ไม่กระทบ OBS • เปลี่ยนแล้วหน้าต่างแชทอัปเดตทันที','These apply to the pop-out chat window only, not OBS • changes show up right away')}</p>
      {top!==null&&<Toggle checked={top} onChange={setPin} label={t('ปักหน้าต่างแชทไว้บนสุด','Keep chat window on top')}/>}
      <label>{t('ขนาดตัวอักษร','Text size')} <span className="range-value">{prefs.font}px</span><input type="range" min="14" max="36" step="2" value={prefs.font} onChange={e=>update({font:clampFont(Number(e.target.value))})}/></label>
      <label>{t('ธีม','Appearance')}<select value={prefs.theme} onChange={e=>update({theme:e.target.value as ChatWinPrefs['theme']})}><option value="app">{t('ตามแอปหลัก','Same as the app')}</option><option value="dark">{t('มืด','Dark')}</option><option value="light">{t('สว่าง','Light')}</option></select></label>
      <label>{t('สีชื่อ','Name colour')}<select value={prefs.nameColor} onChange={e=>update({nameColor:e.target.value as ChatWinPrefs['nameColor']})}><option value="user">{t('สีของผู้ชม','Viewer colour')}</option><option value="platform">{t('สีตามแพลตฟอร์ม','Platform colour')}</option><option value="accent">{t('สีเดียว','One colour')}</option></select></label>
      {show('avatar',t('รูปโปรไฟล์','Profile pictures'))}
      {show('icon',t('ไอคอนแพลตฟอร์ม','Platform icon'))}
      {show('platformName',t('ชื่อแพลตฟอร์ม','Platform name'))}
      {show('time',t('เวลา','Time'))}
      {show('tests',t('แสดงแชททดสอบ','Show test chats'))}
      {show('compact',t('แบบกระชับ','Compact'))}
      {show('follow',t('เลื่อนตามแชทใหม่','Follow new chat'))}
    </section>
    <section className="panel form-panel">
      <h2>{t('ตัวเลขไลฟ์','Live numbers')}</h2>
      <p className="helper">{t('แสดงเหนือแชท สำหรับแพลตฟอร์มที่เชื่อมต่ออยู่ • ตอนนี้มีตัวเลขจาก TikTok (ผ่าน TikFinity) แพลตฟอร์มอื่นจะตามมา','Shown above the chat for connected platforms • numbers come from TikTok (via TikFinity) for now; other platforms will follow')}</p>
      <Toggle checked={prefs.stats.viewers} onChange={v=>stat('viewers',v)} label={t('👁 คนดูตอนนี้','👁 Watching now')}/>
      <Toggle checked={prefs.stats.likes} onChange={v=>stat('likes',v)} label={t('❤ ไลค์ทั้งหมด','❤ Total likes')}/>
      <Toggle checked={prefs.stats.shares} onChange={v=>stat('shares',v)} label={t('↗ แชร์ (นับตั้งแต่เชื่อมต่อ)','↗ Shares (since connecting)')}/>
      <Toggle checked={prefs.stats.uptime} onChange={v=>stat('uptime',v)} label={t('⏱ เวลาตั้งแต่เชื่อมต่อ','⏱ Time since connecting')}/>
      <hr/><h3>{t('แสดงของแพลตฟอร์ม','Show for')}</h3>
      {PLATFORMS.map(p=><Toggle key={p} checked={prefs.statPlatforms[p]} onChange={v=>update({statPlatforms:{...prefs.statPlatforms,[p]:v}})} label={platformNames[p]}/>)}
    </section>
  </div>;
}
