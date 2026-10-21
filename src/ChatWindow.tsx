// Pop-out chat window (#chat-window): a compact, portrait, read-only chat feed.
// It never plays speech and never writes TTS settings itself — it sends commands to the main window.
import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,ChevronDown,ChevronUp,Minus,Moon,Pin,PinOff,Plus,Search,Square,Sun,Volume2} from 'lucide-react';
import {api,desktop,errorText} from './api';
import {PlatformMark,platformNames} from './components';
import {TtsBar} from './TtsBar';
import {BrandIcon} from './Brand';
import type {HouseEvent,SpeechCommand,SpeechStatus,State} from './types';

const FONT_KEY='allhouse-chatwin-font',THEME_KEY='allhouse-chatwin-theme',TTS_OPEN_KEY='allhouse-chatwin-tts-open';
const readLocal=(k:string)=>{try{return localStorage.getItem(k)}catch{return null}};
const writeLocal=(k:string,v:string)=>{try{localStorage.setItem(k,v)}catch{}};
const clampFont=(n:number)=>Math.max(14,Math.min(36,Math.round(n)));

export function ChatWindow(){
  const [lang,setLang]=useState<State['language']>('th');
  const [history,setHistory]=useState<HouseEvent[]>([]);
  const [filter,setFilter]=useState('');
  const [font,setFont]=useState(()=>clampFont(Number(readLocal(FONT_KEY))||20));
  const [theme,setTheme]=useState<'dark'|'light'>(()=>readLocal(THEME_KEY)==='light'?'light':'dark');
  const [pinned,setPinned]=useState(false);
  const [speech,setSpeech]=useState<SpeechStatus|null>(null);
  const [lastStatusAt,setLastStatusAt]=useState(0);
  const [now,setNow]=useState(Date.now());
  const [newCount,setNewCount]=useState(0);
  const [ttsOpen,setTtsOpen]=useState(()=>readLocal(TTS_OPEN_KEY)==='1');
  useEffect(()=>{writeLocal(TTS_OPEN_KEY,ttsOpen?'1':'0')},[ttsOpen]);
  const [error,setError]=useState('');
  const feed=useRef<HTMLDivElement|null>(null),stick=useRef(true),seen=useRef(0);
  const th=lang!=='en',t=(a:string,b:string)=>th?a:b;

  useEffect(()=>{document.title=t('Allhouse — แชท','Allhouse — Chat')},[th]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;writeLocal(THEME_KEY,theme)},[theme]);
  useEffect(()=>{document.documentElement.lang=lang},[lang]);
  useEffect(()=>{writeLocal(FONT_KEY,String(font))},[font]);
  useEffect(()=>{
    api.getState().then(s=>{setLang(s.language);if(!readLocal(THEME_KEY)){const sys=s.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):s.theme;setTheme(sys)}}).catch(e=>setError(errorText(e)));
    api.getChatWindowState?.().then(s=>setPinned(s.top)).catch(()=>{});
    const poll=()=>(api.getHistory?api.getHistory():api.getState().then(s=>s.history)).then(h=>{setHistory(h);setError('')}).catch(e=>setError(errorText(e)));
    poll();const iv=setInterval(()=>{poll();setNow(Date.now())},1000);
    const off=api.onSpeechStatus?.(s=>{setSpeech(s);setLastStatusAt(Date.now())});
    return()=>{clearInterval(iv);off?.()};
  },[]);

  const chats=useMemo(()=>{const q=filter.trim().toLowerCase();return history.filter(e=>e.type==='chat'&&(!q||(e.name+' '+e.message+' '+e.platform).toLowerCase().includes(q)))},[history,filter]);
  // Newest at the bottom. Follow new messages unless the reader scrolled up; then count them in a pill.
  useLayoutEffect(()=>{
    const el=feed.current;if(!el)return;
    const added=Math.max(0,chats.length-seen.current);seen.current=chats.length;
    if(stick.current){el.scrollTop=el.scrollHeight;setNewCount(0)}else if(added)setNewCount(n=>n+added);
  },[chats.length,font]);
  const onScroll=()=>{const el=feed.current;if(!el)return;const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<48;stick.current=atBottom;if(atBottom)setNewCount(0)};
  const jump=()=>{const el=feed.current;if(!el)return;stick.current=true;el.scrollTo({top:el.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});setNewCount(0)};

  const command=(cmd:SpeechCommand)=>{if(!api.sendSpeechCommand){setError(t('ควบคุมเสียงได้เฉพาะเมื่อเปิดหน้าต่างหลักอยู่','Speech controls need the main window to be open'));return}api.sendSpeechCommand(cmd).catch(e=>setError(errorText(e)))};
  const statusStale=!speech||now-lastStatusAt>6000;
  const togglePin=()=>api.setChatWindowTop?.(!pinned).then(s=>setPinned(s.top)).catch(e=>setError(errorText(e)));
  const time=(iso:string)=>new Date(iso).toLocaleTimeString(th?'th-TH':'en-US',{hour:'2-digit',minute:'2-digit'});

  return <div className="chatwin" style={{'--chat-font':`${font}px`} as React.CSSProperties}>
    <header className="chatwin-top"><BrandIcon size={24}/>
      <strong className="chatwin-title">{t('แชท','Chat')}</strong>
      <span className="muted-badge">{t('แชททดสอบมีป้าย ทดสอบ','Test chats say TEST')}</span>
      <div className="chatwin-tools">
        <button type="button" className="icon-button" aria-label={t('ตัวอักษรเล็กลง','Smaller text')} title={t('ตัวอักษรเล็กลง','Smaller text')} disabled={font<=14} onClick={()=>setFont(f=>clampFont(f-2))}><Minus size={16}/><span className="visually-hidden">A-</span></button>
        <span className="chatwin-font" aria-live="polite">{font}px</span>
        <button type="button" className="icon-button" aria-label={t('ตัวอักษรใหญ่ขึ้น','Larger text')} title={t('ตัวอักษรใหญ่ขึ้น','Larger text')} disabled={font>=36} onClick={()=>setFont(f=>clampFont(f+2))}><Plus size={16}/><span className="visually-hidden">A+</span></button>
        <button type="button" className="icon-button" aria-label={t('สลับธีม','Toggle theme')} title={t('สลับธีม','Toggle theme')} onClick={()=>setTheme(v=>v==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={16}/>:<Moon size={16}/>}</button>
        {desktop&&api.setChatWindowTop&&<button type="button" className={'icon-button'+(pinned?' active':'')} aria-pressed={pinned} aria-label={pinned?t('เลิกปักหน้าต่างไว้บนสุด','Unpin from top'):t('ปักหน้าต่างไว้บนสุด','Keep on top')} title={pinned?t('เลิกปักหน้าต่างไว้บนสุด','Unpin from top'):t('ปักหน้าต่างไว้บนสุด','Keep on top')} onClick={togglePin}>{pinned?<PinOff size={16}/>:<Pin size={16}/>}</button>}
      </div>
    </header>
    {/* Slim speech strip by default so the feed keeps the space; the full control bar opens on demand. */}
    <div className="chatwin-tts-strip" role="group" aria-label={t('บอทอ่านแชท','Chat TTS')}>
      <Volume2 size={16}/><span className={'tts-state'+(speech?.speaking&&!statusStale?' speaking':'')} role="status" aria-live="polite"><span className={'dot '+(speech?.speaking&&!statusStale?'pulse':'off')}/>{statusStale?t('รอหน้าต่างหลัก…','Waiting for main window…'):speech?.speaking?t('กำลังอ่าน…','Reading…'):speech?.enabled?t('บอทอ่านแชท: พร้อม','Chat TTS: ready'):t('บอทอ่านแชท: ปิด','Chat TTS: off')}</span>
      {!ttsOpen&&<button type="button" className="button secondary compact danger" disabled={statusStale} onClick={()=>command({cmd:'stop'})}><Square size={13}/>{t('หยุด','Stop')}</button>}
      <button type="button" className="icon-button" aria-expanded={ttsOpen} aria-label={ttsOpen?t('ซ่อนตัวควบคุมเสียง','Hide speech controls'):t('แสดงตัวควบคุมเสียง','Show speech controls')} title={ttsOpen?t('ซ่อนตัวควบคุมเสียง','Hide speech controls'):t('แสดงตัวควบคุมเสียง','Show speech controls')} onClick={()=>setTtsOpen(v=>!v)}>{ttsOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
    </div>
    {ttsOpen&&<TtsBar t={t} status={statusStale?null:speech} disabled={statusStale}
      onToggle={enabled=>command({cmd:'set',patch:{enabled}})} onVolume={volume=>command({cmd:'set',patch:{volume}})} onRate={rate=>command({cmd:'set',patch:{rate}})} onPlatform={(p,on)=>speech?.platforms&&command({cmd:'set',patch:{platforms:{...speech.platforms,[p]:on}}})}
      onStop={()=>command({cmd:'stop'})} onSkip={()=>command({cmd:'skip'})} onSettings={()=>command({cmd:'open-settings'})}
      note={statusStale?t('กำลังรอหน้าต่างหลัก… เสียงอ่านแชทเล่นจากหน้าต่างหลักของ Allhouse เท่านั้น เปิดหน้าต่างหลักค้างไว้','Waiting for the main window… Chat speech plays only from the main Allhouse window, so keep it open.'):t('เสียงเล่นจากหน้าต่างหลัก ปุ่มตรงนี้สั่งหน้าต่างหลักให้หยุด/ข้าม','Speech plays from the main window; these buttons tell it to stop or skip.')}/>}
    {!ttsOpen&&statusStale&&<p className="helper chatwin-hint">{t('เสียงอ่านแชทเล่นจากหน้าต่างหลักเท่านั้น เปิดหน้าต่างหลักค้างไว้','Chat speech plays only from the main window — keep it open.')}</p>}
    <div className="search-field chatwin-search"><Search size={16}/><input placeholder={t('ค้นหาชื่อหรือข้อความ…','Search name or message…')} value={filter} onChange={e=>setFilter(e.target.value)} aria-label={t('ค้นหาแชท','Search chat')}/></div>
    {error&&<div className="notice warning" role="alert"><p>{error}</p></div>}
    <div className="chatwin-feed" ref={feed} onScroll={onScroll} role="log" aria-live="polite" aria-label={t('แชท','Chat')}>
      {chats.length?chats.map(e=><article className="chatwin-msg" key={e.id}>
        <div className="chatwin-meta"><PlatformMark platform={e.platform}/><strong>{e.name}</strong><span className="chatwin-platform">{platformNames[e.platform]}</span>{e.sourceMode!=='live'&&<span className="test-tag">{t('ทดสอบ','TEST')}</span>}<time dateTime={e.createdAt}>{time(e.createdAt)}</time></div>
        <p className="chatwin-text">{e.message}</p>
      </article>):<div className="empty"><h3>{filter?t('ไม่พบข้อความที่ค้นหา','No matching messages'):t('ยังไม่มีแชท','No chat yet')}</h3><p>{t('ส่งแชททดสอบจากหน้าต่างหลัก (แชทและกิจกรรม) • ยังไม่มีแชทจริงในรุ่นนี้','Send a test chat from the main window (Chat & activity) • real platform chat is not available in this alpha')}</p></div>}
    </div>
    {newCount>0&&<button type="button" className="chatwin-new pill" onClick={jump}>{t(`ข้อความใหม่ ${newCount}`,`${newCount} new`)} <ArrowDown size={14}/></button>}
  </div>;
}

