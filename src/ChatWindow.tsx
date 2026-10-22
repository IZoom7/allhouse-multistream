// Pop-out chat window (#chat-window): a compact, portrait, read-only chat feed.
// It never plays speech and never writes TTS settings itself — it sends commands to the main window.
import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,ChevronDown,ChevronUp,Minus,Moon,Pin,PinOff,Plus,Search,Settings2,Square,Sun,Volume2} from 'lucide-react';
import {api,desktop,errorText} from './api';
import {PCOL,PlatformMark,hashColor,platformNames} from './components';
import {TtsBar} from './TtsBar';
import {BrandIcon} from './Brand';
import type {HouseEvent,SpeechCommand,SpeechStatus,State} from './types';

// Display options for this window only (kept in this computer's browser storage).
type View={avatar:boolean;icon:boolean;platformName:boolean;time:boolean;nameColor:'accent'|'platform'|'user';tests:boolean;compact:boolean;follow:boolean};
const VIEW_KEY='allhouse-chatwin-view',DEFAULT_VIEW:View={avatar:true,icon:true,platformName:true,time:true,nameColor:'user',tests:true,compact:false,follow:true};
const readView=():View=>{try{return {...DEFAULT_VIEW,...JSON.parse(localStorage.getItem(VIEW_KEY)||'{}')}}catch{return DEFAULT_VIEW}};
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
  const [view,setView]=useState<View>(readView),[showView,setShowView]=useState(false);
  useEffect(()=>{writeLocal(VIEW_KEY,JSON.stringify(view))},[view]);
  const setV=(p:Partial<View>)=>setView(v=>({...v,...p}));
  const feed=useRef<HTMLDivElement|null>(null),stick=useRef(true),lastId=useRef(''),lastTop=useRef(0),first=useRef(true),userAt=useRef(0);
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

  const chats=useMemo(()=>{const q=filter.trim().toLowerCase();return history.filter(e=>e.type==='chat'&&(view.tests||e.sourceMode==='live')&&(!q||(e.name+' '+e.message+' '+e.platform).toLowerCase().includes(q)))},[history,filter,view.tests]);
  // Newest at the bottom. Keyed on the newest id, not the count: history stops growing at 200 entries.
  const newest=chats.length?chats[chats.length-1].id:'';
  useLayoutEffect(()=>{
    const el=feed.current;if(!el)return;
    const prev=lastId.current;lastId.current=newest;
    if(!newest)return;
    if(newest===prev&&!first.current){if(stick.current&&view.follow)el.scrollTop=el.scrollHeight;return} // font/compact change
    const added=prev?Math.max(1,chats.length-1-chats.findIndex(e=>e.id===prev)):0;
    if(first.current||stick.current&&view.follow){const smooth=!first.current&&!matchMedia('(prefers-reduced-motion: reduce)').matches;el.scrollTo({top:el.scrollHeight,behavior:smooth?'smooth':'auto'});setNewCount(0)}
    else if(added)setNewCount(n=>n+(prev&&chats.some(e=>e.id===prev)?added:1));
    first.current=false;
  },[newest,font,view,showView,ttsOpen]); // anything that changes the feed's size re-pins it to the bottom while following
  // Only the reader's own scrolling (wheel, scrollbar drag, touch, keys) stops following. Old messages dropping off the top
  // of the 200-entry history also move scrollTop, and that must not count as "the reader scrolled up".
  const touched=()=>{userAt.current=Date.now()};
  const onScroll=()=>{const el=feed.current;if(!el)return;const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<48;
    if(!atBottom&&el.scrollTop<lastTop.current-4&&Date.now()-userAt.current<1500)stick.current=false;if(atBottom){stick.current=true;setNewCount(0)}lastTop.current=el.scrollTop};
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
        <button type="button" className={'icon-button'+(showView?' active':'')} aria-expanded={showView} aria-label={t('ตั้งค่าการแสดงผล','Display settings')} title={t('ตั้งค่าการแสดงผล','Display settings')} onClick={()=>setShowView(v=>!v)}><Settings2 size={16}/></button>
        {desktop&&api.setChatWindowTop&&<button type="button" className={'icon-button'+(pinned?' active':'')} aria-pressed={pinned} aria-label={pinned?t('เลิกปักหน้าต่างไว้บนสุด','Unpin from top'):t('ปักหน้าต่างไว้บนสุด','Keep on top')} title={pinned?t('เลิกปักหน้าต่างไว้บนสุด','Unpin from top'):t('ปักหน้าต่างไว้บนสุด','Keep on top')} onClick={togglePin}>{pinned?<PinOff size={16}/>:<Pin size={16}/>}</button>}
      </div>
    </header>
    {showView&&<section className="chatwin-view" aria-label={t('ตั้งค่าการแสดงผล','Display settings')}>
      {([['avatar',t('รูปโปรไฟล์','Profile pictures')],['icon',t('ไอคอนแพลตฟอร์ม','Platform icon')],['platformName',t('ชื่อแพลตฟอร์ม','Platform name')],['time',t('เวลา','Time')],['tests',t('แชททดสอบ','Test chats')],['compact',t('แบบกระชับ','Compact')],['follow',t('เลื่อนตามแชทใหม่','Follow new chat')]] as [keyof View,string][]).map(([k,label])=>
        <button type="button" key={k} className={'cw-chip'+(view[k]?' on':'')} aria-pressed={!!view[k]} onClick={()=>setV({[k]:!view[k]} as Partial<View>)}><span className="cw-led" aria-hidden="true"/>{label}</button>)}
      <label className="cw-select">{t('สีชื่อ','Name colour')}<select value={view.nameColor} onChange={e=>setV({nameColor:e.target.value as View['nameColor']})}><option value="user">{t('สีของผู้ชม','Viewer colour')}</option><option value="platform">{t('สีตามแพลตฟอร์ม','Platform colour')}</option><option value="accent">{t('สีเดียว','One colour')}</option></select></label>
      <p className="helper">{t('รูปโปรไฟล์จริงมาจาก YouTube และ TikTok • Twitch/Kick ใช้วงกลมตัวอักษรแรก • ค่าเหล่านี้ใช้กับหน้าต่างนี้เท่านั้น ไม่กระทบ OBS','Real pictures come from YouTube and TikTok • Twitch/Kick show a letter • these apply to this window only, not OBS')}</p>
    </section>}
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
    <div className="chatwin-feed" ref={feed} onScroll={onScroll} onWheel={touched} onPointerDown={touched} onTouchMove={touched} onKeyDown={e=>{if(['ArrowUp','PageUp','Home'].includes(e.key))touched()}} tabIndex={0} role="log" aria-live="polite" aria-label={t('แชท','Chat')}>
      {chats.length?chats.map(e=>{const nc=view.nameColor==='platform'?PCOL[e.platform]:view.nameColor==='user'?(e.color||hashColor(e.name)):undefined;
        return <article className={'chatwin-msg'+(view.avatar?' has-av':'')+(view.compact?' compact':'')} key={e.id}>
        {view.avatar&&<Avatar e={e}/>}
        <div className="chatwin-meta">{view.icon&&<PlatformMark platform={e.platform}/>}<strong style={nc?{color:nc}:undefined}>{e.name}</strong>{view.platformName&&<span className="chatwin-platform">{platformNames[e.platform]}</span>}{e.sourceMode!=='live'&&<span className="test-tag">{t('ทดสอบ','TEST')}</span>}{view.time&&<time dateTime={e.createdAt}>{time(e.createdAt)}</time>}</div>
        <p className="chatwin-text">{e.message}</p>
      </article>}):<div className="empty"><h3>{filter?t('ไม่พบข้อความที่ค้นหา','No matching messages'):t('ยังไม่มีแชท','No chat yet')}</h3><p>{t('ส่งแชททดสอบจากหน้าต่างหลัก (แชทและกิจกรรม) • ยังไม่มีแชทจริงในรุ่นนี้','Send a test chat from the main window (Chat & activity) • real platform chat is not available in this alpha')}</p></div>}
    </div>
    {newCount>0&&<button type="button" className="chatwin-new pill" onClick={jump}>{t(`ข้อความใหม่ ${newCount}`,`${newCount} new`)} <ArrowDown size={14}/></button>}
  </div>;
}


/** Real picture when the platform sent one (YouTube, TikTok); otherwise the first letter on a steady colour. */
function Avatar({e}:{e:HouseEvent}){
  const [broken,setBroken]=useState(false);
  if(e.avatar&&!broken)return <img className="cw-av" src={e.avatar} alt="" draggable={false} referrerPolicy="no-referrer" onError={()=>setBroken(true)}/>;
  return <span className="cw-av" aria-hidden="true" style={{background:e.color||hashColor(e.name)}}>{(Array.from(e.name.replace(/^@/,''))[0]||'?').toUpperCase()}</span>;
}
