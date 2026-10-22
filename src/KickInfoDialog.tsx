// "Edit stream info" for Kick: one-time developer-app setup → sign in → title / category / tags form with a live preview.
// Talks only to window.allhouse.kickApi; the client secret is write-only from the renderer.
import React,{useEffect,useRef,useState} from 'react';
import {X,KeyRound,LogIn,LogOut,Search,Save,Trash2,Copy,ShieldCheck,Tag,Gamepad2,Type,Eye} from 'lucide-react';
import {api,errorText} from './api';
import type {KickApiStatus,KickCategory,KickChannelInfo} from './types';

type T=(th:string,en:string)=>string;
const TITLE_MAX=140;
export function KickInfoDialog({t,onClose,notify}:{t:T;onClose:()=>void;notify:(m:string,error?:boolean)=>void}){
  const k=api.kickApi!;
  const [st,setSt]=useState<KickApiStatus|null>(null),[busy,setBusy]=useState(''),[err,setErr]=useState('');
  const [clientId,setClientId]=useState(''),[secret,setSecret]=useState('');
  const [info,setInfo]=useState<KickChannelInfo|null>(null),[title,setTitle]=useState(''),[cat,setCat]=useState<KickCategory|null>(null),[tags,setTags]=useState<string[]>([]),[tagText,setTagText]=useState('');
  const [q,setQ]=useState(''),[results,setResults]=useState<KickCategory[]>([]),[searching,setSearching]=useState(false),[saved,setSaved]=useState(false);
  const run=async<R,>(label:string,fn:()=>Promise<R>):Promise<R|undefined>=>{setBusy(label);setErr('');try{return await fn()}catch(e){setErr(errorText(e));return undefined}finally{setBusy('')}};
  const apply=(c:KickChannelInfo)=>{setInfo(c);setTitle(c.title);setCat(c.category);setTags(c.tags)};
  const loadInfo=async()=>{const c=await run('load',()=>k.channel());if(c)apply(c);else setSt(await k.status())};
  useEffect(()=>{void k.status().then(s=>{setSt(s);if(s.loggedIn)void loadInfo()})},[]);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey)},[onClose]);
  // category search, debounced
  const seq=useRef(0);
  useEffect(()=>{if(!st?.loggedIn||q.trim().length<2){setResults([]);return}const id=++seq.current;setSearching(true);
    const tm=setTimeout(()=>void k.categories(q).then(r=>{if(id===seq.current)setResults(r)}).catch(e=>setErr(errorText(e))).finally(()=>{if(id===seq.current)setSearching(false)}),350);return()=>clearTimeout(tm)},[q,st?.loggedIn]);
  const addTag=()=>{const v=tagText.trim();if(!v)return;if(tags.length>=10){setErr(t('ใส่แท็กได้สูงสุด 10 อัน','Up to 10 tags'));return}if(!tags.includes(v))setTags([...tags,v]);setTagText('')};
  const dirty=!!info&&(title.trim()!==info.title||(cat?.id||0)!==(info.category?.id||0)||JSON.stringify(tags)!==JSON.stringify(info.tags));
  const save=async()=>{if(!info)return;const ch:{title?:string;categoryId?:number;categoryName?:string;categoryThumb?:string;tags?:string[]}={};
    if(title.trim()!==info.title)ch.title=title.trim();if(cat&&cat.id!==(info.category?.id||0))Object.assign(ch,{categoryId:cat.id,categoryName:cat.name,categoryThumb:cat.thumbnail});if(JSON.stringify(tags)!==JSON.stringify(info.tags))ch.tags=tags;
    const c=await run('save',()=>k.update(ch));if(c){apply(c);setSaved(true);setTimeout(()=>setSaved(false),1600);notify(t('บันทึกข้อมูลไลฟ์บน Kick แล้ว','Stream info saved on Kick'))}};
  const copy=(s:string)=>void api.copyText(s).then(()=>notify(t('คัดลอกแล้ว','Copied'))).catch(()=>{});
  const fill=Math.min(1,title.length/TITLE_MAX),meter=fill>.9?'hot':fill>.7?'warm':'ok';

  let body:React.ReactNode;
  if(!st)body=<p className="helper">{t('กำลังโหลด…','Loading…')}</p>;
  else if(!st.configured)body=<>
    <p>{t('ครั้งแรกต้องผูกแอพนักพัฒนา Kick ของคุณ (ทำครั้งเดียว) สร้างได้ที่ kick.com → Settings → Developer','First, link your own Kick developer app (once). Create it at kick.com → Settings → Developer.')}</p>
    <ol className="kick-steps">
      <li>{t('Redirect URL ใส่','Redirect URL:')} <code>{st.redirect}</code> <button type="button" className="icon-button" aria-label={t('คัดลอก Redirect URL','Copy redirect URL')} onClick={()=>copy(st.redirect)}><Copy size={14}/></button></li>
      <li>{t('ติ๊ก Scope: Read user information, Read channel information, Update channel information (ห้ามติ๊ก Read stream key)','Scopes: Read user information, Read channel information, Update channel information (never Read stream key)')}</li>
      <li>{t('คัดลอก Client ID และ Client Secret มาวางด้านล่าง','Paste the Client ID and Client Secret below')}</li>
    </ol>
    <label>Client ID<input value={clientId} onChange={e=>setClientId(e.target.value)} autoComplete="off" spellCheck={false}/></label>
    <label>Client Secret<input type="password" value={secret} onChange={e=>setSecret(e.target.value)} autoComplete="off" spellCheck={false}/></label>
    <p className="kick-note"><ShieldCheck size={15}/>{t('Secret ถูกเข้ารหัสด้วยระบบของ Windows เก็บไว้ในเครื่องนี้เท่านั้น แอพจะไม่แสดงกลับมาอีก และไม่อยู่ในโฟลเดอร์โปรเจกต์','The secret is encrypted by Windows, kept on this computer only, never shown again and never stored in the project folder.')}</p>
    <button type="button" className="button kick-go full" disabled={!!busy||!clientId.trim()||!secret.trim()} onClick={()=>void run('setup',async()=>{const s=await k.setApp(clientId,secret);setSecret('');setSt(s)})}><KeyRound size={16}/>{t('บันทึกและไปขั้นล็อกอิน','Save and continue')}</button>
  </>;
  else if(!st.loggedIn)body=<>
    <p>{t('กดล็อกอินแล้วอนุญาตในหน้าเว็บ Kick ที่เปิดขึ้น เสร็จแล้วกลับมาที่หน้านี้','Sign in and approve on the Kick page that opens, then come back here.')}</p>
    <button type="button" className={'button kick-go full'+(busy==='login'?' waiting':'')} disabled={!!busy} onClick={()=>void run('login',async()=>{const s=await k.login();setSt(s);await loadInfo()})}><LogIn size={16}/>{busy==='login'?t('รออนุญาตในเบราว์เซอร์…','Waiting for you in the browser…'):t('ล็อกอินด้วย Kick','Sign in with Kick')}</button>
    <p className="helper">{t(`แอพนักพัฒนา: ${st.clientId}`,`Developer app: ${st.clientId}`)} · <button type="button" className="text-button danger" onClick={()=>void run('clear',async()=>setSt(await k.clear()))}>{t('เปลี่ยน/ลบแอพ','Change/remove app')}</button></p>
  </>;
  else body=<>
    {busy==='load'&&!info?<div className="kick-loading" aria-live="polite"><span/><span/><span/>{t('กำลังดึงข้อมูลช่อง…','Loading your channel…')}</div>:info&&<>
      <div className="kick-preview" aria-label={t('ตัวอย่างบน Kick','Preview on Kick')}>
        <div className="kp-thumb">{cat?.thumbnail?<img src={cat.thumbnail} alt="" draggable={false}/>:<Gamepad2 size={28}/>}{info.live&&<span className="kp-live">LIVE</span>}</div>
        <div className="kp-body">
          <small className="kp-eyebrow"><Eye size={12}/> {t('ตัวอย่างบน Kick','Preview on Kick')}</small>
          <strong className={title.trim()?'':'empty'}>{title.trim()||t('ยังไม่มีชื่อไลฟ์','No title yet')}</strong>
          <span className="kp-cat">{cat?cat.name:t('ยังไม่ได้เลือกหมวด','No category')}</span>
          {tags.length>0&&<span className="kp-tags">{tags.map((x,i)=><i key={x} className={'c'+(i%4)}>{x}</i>)}</span>}
        </div>
      </div>
      {info.filledFrom&&<p className="kick-filled"><Eye size={14}/>{info.filledFrom==='live'?t('ค่าเดิมดึงจากไลฟ์ที่กำลังออนอากาศ','Current values come from the stream on air'):info.filledFrom==='saved'?t('ค่าเดิมคือที่คุณบันทึกล่าสุดจากแอพนี้ (API ของ Kick ไม่ส่งมาตอนออฟไลน์)','Current values are what you last saved here (Kick’s API leaves them empty while offline)'):t('ค่าเดิมดึงจากไลฟ์ล่าสุดของคุณ (API ของ Kick ไม่ส่งมาตอนออฟไลน์)','Current values come from your last stream (Kick’s API leaves them empty while offline)')}</p>}
      <label className="kick-title"><span className="kick-label"><Type size={14}/> {t('ชื่อไลฟ์','Title')}</span><input value={title} maxLength={TITLE_MAX} placeholder={t('เช่น เดดบายรายวันครับ','e.g. Daily Dead by Daylight')} onChange={e=>setTitle(e.target.value)}/>
        <span className={'kick-meter '+meter} aria-hidden="true"><span style={{width:`${fill*100}%`}}/></span><small className="helper">{title.length}/{TITLE_MAX}</small></label>
      <div className="kick-field"><span className="kick-label"><Gamepad2 size={14}/> {t('หมวด','Category')}</span>
        <div className="search-field"><Search size={16}/><input value={q} placeholder={cat?t(`เปลี่ยนจาก ${cat.name}…`,`Change from ${cat.name}…`):t('ค้นหาหมวด เช่น Dead by Daylight','Search a category, e.g. Dead by Daylight')} onChange={e=>setQ(e.target.value)} aria-label={t('ค้นหาหมวด','Search category')}/>{searching&&<span className="kick-spin" aria-label={t('กำลังค้นหา','Searching')}/>}</div>
        {results.length>0&&<div className="kick-results" role="listbox">{results.map(r=><button type="button" key={r.id} role="option" aria-selected={cat?.id===r.id} className={'kick-cat'+(cat?.id===r.id?' selected':'')} onClick={()=>{setCat(r);setQ('');setResults([])}}>{r.thumbnail?<img src={r.thumbnail} alt="" draggable={false}/>:<span className="kick-cat-ph"><Gamepad2 size={16}/></span>}<span>{r.name}</span></button>)}</div>}
      </div>
      <div className="kick-field"><span className="kick-label"><Tag size={14}/> {t('แท็ก','Tags')} <small>{tags.length}/10</small></span>
        <div className="kick-tags">{tags.map((x,i)=><span key={x} className={'kick-tag c'+(i%4)}>{x}<button type="button" aria-label={t(`ลบแท็ก ${x}`,`Remove tag ${x}`)} onClick={()=>setTags(tags.filter(y=>y!==x))}><X size={12}/></button></span>)}
          <input value={tagText} maxLength={50} placeholder={tags.length>=10?t('ครบ 10 แท็กแล้ว','10 tags reached'):t('พิมพ์แล้วกด Enter','Type and press Enter')} disabled={tags.length>=10} onChange={e=>setTagText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTag()}}}/></div>
      </div>
      <div className="kick-readonly"><span>{t('ภาษา','Language')}: <b>{info.language||'—'}</b></span><span>18+: <b>{info.mature?t('เปิด','On'):t('ปิด','Off')}</b></span><small>{t('Kick ไม่เปิดให้แก้สองค่านี้ผ่าน API ต้องแก้บนเว็บ Kick','Kick’s API can’t change these two; edit them on kick.com')}</small></div>
      <div className="kick-actions"><button type="button" className="button secondary" onClick={onClose}>{t('ปิด','Close')}</button><button type="button" className={'button kick-go'+(saved?' saved':'')} disabled={!dirty||!!busy||!title.trim()} onClick={()=>void save()}><Save size={16}/>{busy==='save'?t('กำลังบันทึก…','Saving…'):saved?t('บันทึกแล้ว ✓','Saved ✓'):t('บันทึก','Save')}</button></div>
    </>}
    <p className="helper kick-foot"><button type="button" className="text-button" onClick={()=>void run('logout',async()=>{setSt(await k.logout());setInfo(null)})}><LogOut size={14}/>{t('ออกจากระบบ Kick','Sign out of Kick')}</button><span aria-hidden="true">·</span><button type="button" className="text-button danger" onClick={()=>void run('clear',async()=>{setSt(await k.clear());setInfo(null)})}><Trash2 size={14}/>{t('ลบแอพนักพัฒนาและข้อมูลล็อกอิน','Remove developer app and sign-in')}</button></p>
  </>;

  return <div className="modal-backdrop kick-backdrop" onClick={onClose}>
    <section className="modal panel kick-dialog" role="dialog" aria-modal="true" aria-labelledby="kick-dialog-title" onClick={e=>e.stopPropagation()}>
      <header className="kick-head">
        <span className="kick-logo" aria-hidden="true">K</span>
        <div><h2 id="kick-dialog-title">{t('แก้ไขข้อมูลไลฟ์','Edit stream info')}</h2>
          {st?.user?<span className="kick-who">{st.user.picture&&<img src={st.user.picture} alt="" draggable={false}/>}<b>{st.user.name}</b><i className={'kick-led'+(info?.live?' on':'')}/>{info?.live?t('กำลังไลฟ์ • แก้แล้วผู้ชมเห็นทันที','Live • viewers see changes right away'):t('ยังไม่ได้ไลฟ์','Offline')}</span>:<span className="kick-who">kick.com</span>}</div>
        <button type="button" className="icon-button kick-close" aria-label={t('ปิด','Close')} onClick={onClose}><X size={18}/></button>
      </header>
      <div className="kick-body">
        {err&&<p className="conn-error" role="alert">{err}</p>}
        {body}
      </div>
    </section>
  </div>;
}
