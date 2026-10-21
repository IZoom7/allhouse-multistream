// Home status board (round 11): four live tiles in the controller colours. Each tile answers one question at a glance
// and opens the page where you act on it.
import React,{useEffect,useState} from 'react';
import {Radio,Activity,Volume2,Monitor,MessageSquare,UserPlus,Star,Gift,ArrowUpRight} from 'lucide-react';
import {PlatformMark,platformNames} from './components';
import {TTS_PLATFORMS,rulesOf} from './ttsRules';
import type {Connections,HouseEvent,Platform,State,Status,WidgetId} from './types';

type T=(th:string,en:string)=>string;
type Page='connections'|'overlay'|'activity'|'speech';
const WINDOW_MIN=15;
const WIDGETS:[WidgetId,string,string][]=[['chat','แชท','Chat'],['follow','ติดตาม','Follow'],['subscription','สมาชิก','Subs'],['gift','ของขวัญ','Gifts'],['banner','แบนเนอร์','Banner']];

export function HomeStats({t,state,status,conns,desktop,speaking,pending,dirty,onNav,onToggleTts}:{t:T;state:State;status:Status|null;conns:Connections|null;desktop:boolean;speaking:boolean;pending:number;dirty:boolean;onNav:(p:Page)=>void;onToggleTts:(v:boolean)=>void}){
  // the activity window slides even when nothing new arrives
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const iv=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(iv)},[]);
  useEffect(()=>setNow(Date.now()),[state.history.length]);

  // ---- 1. connections
  const online=conns?TTS_PLATFORMS.filter(p=>conns[p]?.state==='connected').length:0;
  const received=conns?TTS_PLATFORMS.reduce((n,p)=>n+(conns[p]?.events||0),0):0;
  const led=(p:Platform)=>{const s=conns?.[p]?.state;return s==='connected'?'on':s==='connecting'||s==='retrying'?'wait':s==='error'?'err':'off'};
  const ledText=(p:Platform)=>({on:t('ออนไลน์','online'),wait:t('กำลังเชื่อม','connecting'),err:t('มีปัญหา','problem'),off:t('ปิด','off')} as Record<string,string>)[led(p)];

  // ---- 2. activity in the last 15 minutes (per-minute bars + totals by kind)
  const from=now-WINDOW_MIN*60000;
  const recent=state.history.filter(e=>{const ts=Date.parse(e.createdAt);return ts>=from&&ts<=now+5000});
  const bars=Array.from({length:WINDOW_MIN},(_,i)=>recent.filter(e=>Math.min(WINDOW_MIN-1,Math.floor((Date.parse(e.createdAt)-from)/60000))===i).length);
  const peak=Math.max(1,...bars);
  const count=(k:HouseEvent['type'])=>recent.filter(e=>e.type===k).length;
  const tests=recent.filter(e=>e.sourceMode!=='live').length;

  // ---- 3. speech
  const rules=rulesOf(state.tts);
  const engineName=state.tts.engine==='online'&&desktop?t('เสียงออนไลน์','Online voice'):t('เสียง Windows','Windows voice');

  // ---- 4. OBS widgets actually open
  const pages=(id:WidgetId)=>status?.widgetClients?.[id]||0;
  const openWidgets=WIDGETS.filter(([id])=>pages(id)>0).length;

  return <div className="board">
    <button type="button" className="tile tile-blue" onClick={()=>onNav('connections')}>
      <div className="tile-head"><span className="tile-icon"><Radio size={18}/></span><span>{t('การเชื่อมต่อ','Connections')}</span><ArrowUpRight className="tile-go" size={16}/></div>
      <div className="tile-big"><strong>{online}</strong><small>/ 4 {t('ออนไลน์','online')}</small></div>
      <div className="tile-platforms">{TTS_PLATFORMS.map(p=><span key={p} className={'tp '+led(p)} title={`${platformNames[p]} · ${ledText(p)}`}><PlatformMark platform={p}/><i className="led" aria-hidden="true"/><span className="sr">{platformNames[p]} {ledText(p)}</span></span>)}</div>
      <small className="tile-foot">{online?t(`รับมาแล้ว ${received} รายการตั้งแต่เปิดแอพ`,`${received} events received since start`):desktop?t('ยังไม่ได้เชื่อม • กดเพื่อใส่ชื่อช่อง','Not connected yet • click to add your channels'):t('เชื่อมจริงได้ในแอพเดสก์ท็อป','Live connections need the desktop app')}</small>
    </button>

    <button type="button" className="tile tile-red" onClick={()=>onNav('activity')}>
      <div className="tile-head"><span className="tile-icon"><Activity size={18}/></span><span>{t(`ความเคลื่อนไหว ${WINDOW_MIN} นาทีล่าสุด`,`Last ${WINDOW_MIN} minutes`)}</span><ArrowUpRight className="tile-go" size={16}/></div>
      <div className="spark" aria-label={t(`${recent.length} รายการใน ${WINDOW_MIN} นาที`,`${recent.length} events in ${WINDOW_MIN} minutes`)}>
        {bars.map((n,i)=><span key={i} className={'bar'+(i===WINDOW_MIN-1?' now':'')+(n?'':' zero')} style={{height:`${Math.max(6,Math.round(n/peak*100))}%`}} title={`${WINDOW_MIN-1-i===0?t('นาทีนี้','this minute'):t(`${WINDOW_MIN-1-i} นาทีก่อน`,`${WINDOW_MIN-1-i} min ago`)}: ${n}`}/>)}
      </div>
      <div className="tile-counts">
        <span title={t('แชท','Chat')}><MessageSquare size={14}/>{count('chat')}</span>
        <span title={t('ผู้ติดตาม','Follows')}><UserPlus size={14}/>{count('follow')}</span>
        <span title={t('สมาชิก','Subs')}><Star size={14}/>{count('subscription')}</span>
        <span title={t('ของขวัญ','Gifts')}><Gift size={14}/>{count('gift')}</span>
      </div>
      <small className="tile-foot">{recent.length?(tests?t(`รวมรายการทดสอบ ${tests} รายการ`,`includes ${tests} test event(s)`):t('ข้อมูลจริงทั้งหมด','all real events')):t('ยังเงียบอยู่ • กดเพื่อส่งแชททดสอบ','Quiet so far • click to send a test chat')}</small>
    </button>

    <div className="tile tile-yellow" role="group" aria-label={t('บอทอ่านแชท','Chat TTS')}>
      <div className="tile-head"><span className="tile-icon"><Volume2 size={18}/></span><span>{t('บอทอ่านแชท','Chat TTS')}</span>
        <button type="button" role="switch" aria-checked={state.tts.enabled} className={'toggle '+(state.tts.enabled?'on':'')} aria-label={state.tts.enabled?t('ปิดบอทอ่านแชท','Turn chat TTS off'):t('เปิดบอทอ่านแชท','Turn chat TTS on')} onClick={()=>onToggleTts(!state.tts.enabled)}><span/></button></div>
      <div className="tile-big tts-big"><span className={'eq'+(speaking?' playing':'')+(state.tts.enabled?'':' muted')} aria-hidden="true"><i/><i/><i/><i/><i/></span><strong className="word">{!state.tts.enabled?t('ปิดอยู่','Off'):speaking?t('กำลังอ่าน','Reading'):t('พร้อมอ่าน','Ready')}</strong>{pending>0&&<small>{t(`รอ ${pending}`,`${pending} waiting`)}</small>}</div>
      <div className="tile-platforms small">{TTS_PLATFORMS.map(p=><span key={p} className={'tp '+(rules.platforms[p]?'on':'muted')} title={`${platformNames[p]} · ${rules.platforms[p]?t('อ่าน','read'):t('ไม่อ่าน','muted')}`}><PlatformMark platform={p}/></span>)}</div>
      <button type="button" className="tile-foot link" onClick={()=>onNav('speech')}>{engineName} · {t('ตั้งค่าเสียงและกฎการอ่าน','voice & reading rules')} <ArrowUpRight size={13}/></button>
    </div>

    <button type="button" className="tile tile-green" onClick={()=>onNav('overlay')}>
      <div className="tile-head"><span className="tile-icon"><Monitor size={18}/></span><span>{t('วิดเจ็ตใน OBS','Widgets in OBS')}</span><ArrowUpRight className="tile-go" size={16}/></div>
      <div className="tile-big"><strong>{desktop?openWidgets:'–'}</strong><small>/ 5 {t('เปิดอยู่ใน OBS','open in OBS')}</small></div>
      <div className="tile-widgets">{WIDGETS.map(([id,th,en])=>{const off=!state.publishedWidgets[id].enabled,open=pages(id)>0;return <span key={id} className={'tw'+(off?' disabled':open?' open':'')} title={off?t('ปิดในฉบับเผยแพร่','off in the published version'):open?t(`เปิดอยู่ ${pages(id)} หน้า`,`${pages(id)} page(s) open`):t('ยังไม่ได้เพิ่มใน OBS','not added to OBS yet')}><i className="led" aria-hidden="true"/>{t(th,en)}</span>})}</div>
      <small className={'tile-foot'+(dirty||status?.paused?' warn':'')}>{dirty?t('มีการแก้ที่ยังไม่เผยแพร่ • OBS ยังแสดงแบบเดิม','Unpublished edits • OBS still shows the old version'):status?.paused?t('คิวแจ้งเตือนพักอยู่','Alert queue is paused'):desktop?t('“เปิดอยู่” = OBS เปิดหน้านี้ ไม่ได้แปลว่ากำลังไลฟ์','“Open” means OBS loaded it, not that you are live'):t('โหมดเบราว์เซอร์ไม่มี OBS','No OBS in browser mode')}</small>
    </button>
  </div>;
}
