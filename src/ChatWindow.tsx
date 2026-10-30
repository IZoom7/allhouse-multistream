// Pop-out chat window (#chat-window): a compact, portrait, read-only chat feed with live viewer/like/share numbers.
// It never plays speech and never writes TTS settings itself — it sends commands to the main window.
// Its display options are set in the main window (Settings → Chat window), see chatWindowPrefs.ts.
import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,ChevronDown,ChevronUp,Clock,Eye,Heart,Share2,Square,Volume2} from 'lucide-react';
import {api,errorText} from './api';
import {PCOL,PlatformMark,hashColor,platformNames} from './components';
import {TtsBar} from './TtsBar';
import {BrandIcon} from './Brand';
import {useChatWinPrefs,type ChatWinPrefs} from './chatWindowPrefs';
import type {Connections,HouseEvent,Platform,SpeechCommand,SpeechStatus,State} from './types';

const TTS_OPEN_KEY='allhouse-chatwin-tts-open';
const readLocal=(k:string)=>{try{return localStorage.getItem(k)}catch{return null}};
const writeLocal=(k:string,v:string)=>{try{localStorage.setItem(k,v)}catch{}};
const PLATFORM_ORDER:Platform[]=['tiktok','youtube','twitch','kick'];

export function ChatWindow(){
  const [lang,setLang]=useState<State['language']>('th');
  const [appTheme,setAppTheme]=useState<'dark'|'light'>('dark');
  const [history,setHistory]=useState<HouseEvent[]>([]);
  const [conns,setConns]=useState<Connections|null>(null);
  const [speech,setSpeech]=useState<SpeechStatus|null>(null);
  const [lastStatusAt,setLastStatusAt]=useState(0);
  const [now,setNow]=useState(Date.now());
  const [newCount,setNewCount]=useState(0);
  const [ttsOpen,setTtsOpen]=useState(()=>readLocal(TTS_OPEN_KEY)==='1');
  useEffect(()=>{writeLocal(TTS_OPEN_KEY,ttsOpen?'1':'0')},[ttsOpen]);
  const [error,setError]=useState('');
  const [view]=useChatWinPrefs(),font=view.font,theme=view.theme==='app'?appTheme:view.theme;
  const feed=useRef<HTMLDivElement|null>(null),stick=useRef(true),lastId=useRef(''),lastTop=useRef(0),first=useRef(true),userAt=useRef(0);
  const th=lang!=='en',t=(a:string,b:string)=>th?a:b;

  useEffect(()=>{document.title=t('Allhouse — แชท','Allhouse — Chat')},[th]);
  useEffect(()=>{document.documentElement.dataset.theme=theme},[theme]);
  useEffect(()=>{document.documentElement.lang=lang},[lang]);
  useEffect(()=>{
    api.getState().then(s=>{setLang(s.language);setAppTheme(s.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):s.theme)}).catch(e=>setError(errorText(e)));
    const poll=()=>(api.getHistory?api.getHistory():api.getState().then(s=>s.history)).then(h=>{setHistory(h);setError('')}).catch(e=>setError(errorText(e)));
    poll();const iv=setInterval(()=>{poll();setNow(Date.now())},1000);
    const off=api.onSpeechStatus?.(s=>{setSpeech(s);setLastStatusAt(Date.now())});
    api.getConnections?.().then(setConns).catch(()=>{});
    const offConn=api.onConnections?.(setConns);
    return()=>{clearInterval(iv);off?.();offConn?.()};
  },[]);

  const chats=useMemo(()=>history.filter(e=>e.type==='chat'&&(view.tests||e.sourceMode==='live')),[history,view.tests]);
  // Newest at the bottom. Keyed on the newest id, not the count: history stops growing at 200 entries.
  const newest=chats.length?chats[chats.length-1].id:'';
  useLayoutEffect(()=>{
    const el=feed.current;if(!el)return;
    const prev=lastId.current;lastId.current=newest;
    if(!newest)return;
    if(newest===prev&&!first.current){if(stick.current&&view.follow)el.scrollTop=el.scrollHeight;return} // font/compact change
    const added=prev?Math.max(1,chats.length-1-chats.findIndex(e=>e.id===prev)):0;
    // While the reader is in another window (a game, OBS), they cannot be reading old messages: always follow, instantly
    // (a smooth scroll can stall in an unfocused window).
    const away=!document.hasFocus();if(away&&view.follow)stick.current=true;
    if(first.current||stick.current&&view.follow){const smooth=!first.current&&!away&&!matchMedia('(prefers-reduced-motion: reduce)').matches;el.scrollTo({top:el.scrollHeight,behavior:smooth?'smooth':'auto'});setNewCount(0)}
    else if(added)setNewCount(n=>n+(prev&&chats.some(e=>e.id===prev)?added:1));
    first.current=false;
  },[newest,view,ttsOpen,conns]); // anything that changes the feed's size re-pins it to the bottom while following
  // Only the reader's own scrolling (wheel, scrollbar drag, touch, keys) stops following. Old messages dropping off the top
  // of the 200-entry history also move scrollTop, and that must not count as "the reader scrolled up".
  // Leaving the window (back to the game) resumes following, even if the reader had scrolled up to read.
  useEffect(()=>{const h=()=>{const el=feed.current;if(!el||!view.follow)return;stick.current=true;el.scrollTop=el.scrollHeight;setNewCount(0)};addEventListener('blur',h);return()=>removeEventListener('blur',h)},[view.follow]);
  const touched=()=>{userAt.current=Date.now()};
  const onScroll=()=>{const el=feed.current;if(!el)return;const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<48;
    if(!atBottom&&el.scrollTop<lastTop.current-4&&Date.now()-userAt.current<1500)stick.current=false;if(atBottom){stick.current=true;setNewCount(0)}lastTop.current=el.scrollTop};
  const jump=()=>{const el=feed.current;if(!el)return;stick.current=true;el.scrollTo({top:el.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});setNewCount(0)};

  const command=(cmd:SpeechCommand)=>{if(!api.sendSpeechCommand){setError(t('ควบคุมเสียงได้เฉพาะเมื่อเปิดหน้าต่างหลักอยู่','Speech controls need the main window to be open'));return}api.sendSpeechCommand(cmd).catch(e=>setError(errorText(e)))};
  const statusStale=!speech||now-lastStatusAt>6000;
  const time=(iso:string)=>new Date(iso).toLocaleTimeString(th?'th-TH':'en-US',{hour:'2-digit',minute:'2-digit'});

  return <div className="chatwin" style={{'--chat-font':`${font}px`} as React.CSSProperties}>
    <header className="chatwin-top"><BrandIcon size={24}/><strong className="chatwin-title">{t('แชท','Chat')}</strong></header>
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
    <LiveStats conns={conns} prefs={view} now={now} t={t}/>
    {error&&<div className="notice warning" role="alert"><p>{error}</p></div>}
    <div className="chatwin-feed" ref={feed} onScroll={onScroll} onWheel={touched} onPointerDown={touched} onTouchMove={touched} onKeyDown={e=>{if(['ArrowUp','PageUp','Home'].includes(e.key))touched()}} tabIndex={0} role="log" aria-live="polite" aria-label={t('แชท','Chat')}>
      {chats.length?chats.map(e=>{const nc=view.nameColor==='platform'?PCOL[e.platform]:view.nameColor==='user'?(e.color||hashColor(e.name)):undefined;
        return <article className={'chatwin-msg'+(view.avatar?' has-av':'')+(view.compact?' compact':'')} key={e.id}>
        {view.avatar&&<Avatar e={e}/>}
        <div className="chatwin-meta">{view.icon&&<PlatformMark platform={e.platform}/>}<strong style={nc?{color:nc}:undefined}>{e.name}</strong>{view.platformName&&<span className="chatwin-platform">{platformNames[e.platform]}</span>}{e.sourceMode!=='live'&&<span className="test-tag">{t('ทดสอบ','TEST')}</span>}{view.time&&<time dateTime={e.createdAt}>{time(e.createdAt)}</time>}</div>
        <p className="chatwin-text">{e.message}</p>
      </article>}):<div className="empty"><h3>{t('ยังไม่มีแชท','No chat yet')}</h3><p>{t('ส่งแชททดสอบจากหน้าต่างหลัก (แชทและกิจกรรม) • ยังไม่มีแชทจริงในรุ่นนี้','Send a test chat from the main window (Chat & activity) • real platform chat is not available in this alpha')}</p></div>}
    </div>
    {newCount>0&&<button type="button" className="chatwin-new pill" onClick={jump}>{t(`ข้อความใหม่ ${newCount}`,`${newCount} new`)} <ArrowDown size={14}/></button>}
  </div>;
}

const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
const uptime=(ms:number)=>{const m=Math.max(0,Math.floor(ms/60000));return m<60?`${m}m`:`${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`};

/** One row per connected platform: viewers now, total likes, shares since connecting, time since connecting.
 * Numbers a platform has not reported (yet, or at all) are left out. */
function LiveStats({conns,prefs,now,t}:{conns:Connections|null;prefs:ChatWinPrefs;now:number;t:(a:string,b:string)=>string}){
  const on=prefs.stats;
  if(!conns||!(on.viewers||on.likes||on.shares||on.uptime))return null;
  const shows=(p:Platform)=>{const s=conns[p].stats||{};return (on.viewers&&s.viewers!=null)||(on.likes&&s.likes!=null)||(on.shares&&s.shares!=null)||(on.uptime&&!!s.since)};
  // Only TikTok reports numbers so far: it gets a "waiting" row until the first one; others appear only with something to show.
  const rows=PLATFORM_ORDER.filter(p=>prefs.statPlatforms[p]&&conns[p]?.state==='connected'&&(p==='tiktok'||shows(p)));
  if(!rows.length)return null;
  return <div className="chatwin-stats" role="group" aria-label={t('ตัวเลขไลฟ์','Live numbers')}>
    {rows.map(p=>{const s=conns[p].stats||{},shown=shows(p);
      return <div className="cw-stat-row" key={p}><PlatformMark platform={p}/>
        {on.viewers&&s.viewers!=null&&<span className="cw-stat" title={t('คนดูตอนนี้','Watching now')}><Eye size={15} aria-hidden="true"/><b>{compact.format(s.viewers)}</b><span className="visually-hidden">{t('คนดู','viewers')}</span></span>}
        {on.likes&&s.likes!=null&&<span className="cw-stat" title={t('ไลค์ทั้งหมดในไลฟ์นี้','Likes this stream')}><Heart size={15} aria-hidden="true"/><b>{compact.format(s.likes)}</b><span className="visually-hidden">{t('ไลค์','likes')}</span></span>}
        {on.shares&&s.shares!=null&&<span className="cw-stat" title={t('แชร์ (นับตั้งแต่เชื่อมต่อ)','Shares (since connecting)')}><Share2 size={15} aria-hidden="true"/><b>{compact.format(s.shares)}</b><span className="visually-hidden">{t('แชร์','shares')}</span></span>}
        {on.uptime&&s.since&&<span className="cw-stat" title={t('เวลาตั้งแต่เชื่อมต่อ','Time since connecting')}><Clock size={15} aria-hidden="true"/><b>{uptime(now-Date.parse(s.since))}</b></span>}
        {!shown&&<span className="cw-stat muted">{t('รอตัวเลขจาก ','Waiting for numbers from ')+platformNames[p]+'…'}</span>}
      </div>})}
  </div>;
}

/** Real picture when the platform sent one (YouTube, TikTok); otherwise the first letter on a steady colour. */
function Avatar({e}:{e:HouseEvent}){
  const [broken,setBroken]=useState(false);
  if(e.avatar&&!broken)return <img className="cw-av" src={e.avatar} alt="" draggable={false} referrerPolicy="no-referrer" onError={()=>setBroken(true)}/>;
  return <span className="cw-av" aria-hidden="true" style={{background:e.color||hashColor(e.name)}}>{(Array.from(e.name.replace(/^@/,''))[0]||'?').toUpperCase()}</span>;
}
