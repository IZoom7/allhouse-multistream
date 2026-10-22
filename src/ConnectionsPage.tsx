import React,{useEffect,useState} from 'react';
import {Info,Plug,Unplug,AlertTriangle,Check,Minus,Radio,XCircle,PenLine} from 'lucide-react';
import {KickInfoDialog} from './KickInfoDialog';
import {api,desktop,errorText} from './api';
import {PageHeading,PlatformMark,platformNames} from './components';
import type {ConnectionInfo,Connections,Platform} from './types';

type T=(th:string,en:string)=>string;
const ORDER:Platform[]=['twitch','youtube','kick','tiktok'];

export function ConnectionsPage({t,notify,onTryTests}:{t:T;notify:(m:string)=>void;onTryTests:()=>void}){
  const [kickEdit,setKickEdit]=useState(false),[conns,setConns]=useState<Connections|null>(null),[draft,setDraft]=useState<Partial<Record<Platform,string>>>({}),[busy,setBusy]=useState<Platform|null>(null);
  useEffect(()=>{if(!api.getConnections)return;api.getConnections().then(setConns).catch(()=>{});return api.onConnections?.(setConns)},[]);
  const info:Record<Platform,{label:string;placeholder:string;gets:[string,boolean][];note:string;warn?:string}>={
    twitch:{label:t('ชื่อช่อง Twitch','Twitch channel'),placeholder:'twitch.tv/yourname',
      gets:[[t('แชท','Chat'),true],[t('ซับ / ซับต่อ / ของขวัญ','Subs, resubs, gifts'),true],[t('ผู้ติดตามใหม่ (ต้องล็อกอิน — เร็วๆ นี้)','New followers (needs sign-in — coming soon)'),false]],
      note:t('อ่านแชทได้เลยโดยไม่ต้องล็อกอิน แค่ใส่ชื่อช่อง','Reads chat without signing in — just enter the channel name.')},
    youtube:{label:t('ช่อง (@ชื่อ) หรือ ลิงก์ไลฟ์','Channel (@name) or live link'),placeholder:'@yourchannel',
      gets:[[t('แชท + Super Chat','Chat + Super Chat'),true],[t('สมาชิกใหม่ / ของขวัญสมาชิก','New members / gifted memberships'),true],[t('ผู้ติดตาม (YouTube ไม่ส่งให้ในแชท)','Subscribers (YouTube does not send these to chat)'),false]],
      note:t('ใส่ @ชื่อช่อง แอพจะรอจนกว่าช่องจะเริ่มไลฟ์ แล้วต่อให้อัตโนมัติ (แชทอาจช้าราว 5 วินาที)','Enter your @channel. Allhouse waits until you go live and joins automatically (chat may lag ~5 seconds).'),
      warn:t('ใช้ช่องทางเดียวกับหน้าต่างแชทของ YouTube ไม่ใช่ API ทางการ อาจหยุดทำงานได้ถ้า YouTube เปลี่ยนระบบ','Uses the same feed as YouTube’s chat pop-out, not the official API. It may stop working if YouTube changes it.')},
    kick:{label:t('ชื่อช่อง Kick','Kick channel'),placeholder:'kick.com/yourname',
      gets:[[t('แชท','Chat'),true],[t('ซับ / ของขวัญซับ','Subs / gifted subs'),true],[t('ผู้ติดตามใหม่','New followers'),true]],
      note:t('ใส่ชื่อช่องจาก kick.com/ชื่อ','Enter the name from kick.com/<name>.'),
      warn:t('Kick ไม่มี API แชทสาธารณะ ใช้ช่องทางเดียวกับเว็บ kick.com อาจหยุดทำงานได้ถ้า Kick เปลี่ยนระบบ','Kick has no public chat API. This uses the same feed as kick.com and may stop working if Kick changes it.')},
    tiktok:{label:'TikFinity',placeholder:'',
      gets:[[t('แชท','Chat'),true],[t('ผู้ติดตามใหม่','New followers'),true],[t('ซับสคริปชัน','Subscriptions'),true],[t('ของขวัญ (วิดเจ็ตแจ้งเตือนของขวัญ)','Gifts (gift alert widget)'),true]],
      note:t('TikTok ไม่มี API แชท ให้เปิดโปรแกรม TikFinity Desktop (ฟรี: tikfinity.zerody.one) ล็อกอิน TikTok ในนั้น แล้วกดเชื่อมต่อที่นี่','TikTok has no chat API. Open TikFinity Desktop (free: tikfinity.zerody.one), sign in to TikTok there, then connect here.')},
  };
  const stateText=(c?:ConnectionInfo)=>!c||c.state==='off'||c.state==='stopped'?t('ปิดอยู่','Off'):c.state==='connected'?t('เชื่อมแล้ว','Connected'):c.state==='connecting'?t('กำลังเชื่อม…','Connecting…'):c.state==='retrying'?t('กำลังลองใหม่','Retrying'):t('เชื่อมไม่ได้','Failed');
  const connect=async(p:Platform)=>{const ch=p==='tiktok'?'':(draft[p]??conns?.[p]?.channel??'').trim();if(p!=='tiktok'&&!ch){notify(t('ใส่ชื่อช่องก่อน','Enter a channel first'));return}
    setBusy(p);try{setConns(await api.connectPlatform!(p,ch))}catch(e){notify(errorText(e))}finally{setBusy(null)}};
  const disconnect=async(p:Platform)=>{setBusy(p);try{setConns(await api.disconnectPlatform!(p))}catch(e){notify(errorText(e))}finally{setBusy(null)}};
  return <>
    <PageHeading title={t('เชื่อมต่อแพลตฟอร์ม','Connect your platforms')} description={t('ใส่ชื่อช่องแล้วกดเชื่อมต่อ แชทและการแจ้งเตือนจริงจะเข้ามาที่ห้องนี้และ OBS','Enter your channel and connect. Real chat and alerts flow into this room and OBS.')}/>
    {!desktop&&<div className="notice warning"><Info size={18}/>{t('การเชื่อมต่อจริงใช้ได้เฉพาะในแอพเดสก์ท็อป','Live connections only work in the desktop app.')}</div>}
    <div className="platform-grid">{ORDER.map(p=>{const c=conns?.[p],on=!!c&&c.enabled&&c.state!=='off',i=info[p];
      return <section className="panel platform-card" key={p}>
        <div className="platform-card-top"><PlatformMark platform={p}/><span className={'conn-state '+(c?.state||'off')}>{stateText(c)}</span></div>
        <div className="conn-top">
        <h2>{platformNames[p]}</h2>
        <p>{i.note}</p>
        <ul className="conn-gets">{i.gets.map(([g,ok])=><li key={g} className={ok?'ok':'no'}><span className="conn-tick" aria-label={ok?t('ได้','yes'):t('ไม่ได้','no')}>{ok?<Check size={13} strokeWidth={3.2}/>:<Minus size={13} strokeWidth={3.2}/>}</span><span>{g}</span></li>)}</ul>
        </div>
        <div className="conn-bottom">
        {p!=='tiktok'&&<label>{i.label}<input value={draft[p]??c?.channel??''} placeholder={i.placeholder} disabled={on||!desktop} maxLength={200} onChange={e=>setDraft({...draft,[p]:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&!on)void connect(p)}}/></label>}
        {i.warn&&<p className="conn-warn"><AlertTriangle size={15}/><span>{i.warn}</span></p>}
        {c&&c.state==='error'&&<p className="conn-error"><XCircle size={15}/><span>{c.detail}</span></p>}
        {on&&c!.state!=='error'&&<div className={'conn-lcd '+c!.state}><Radio size={15}/><div><strong>{c!.detail||stateText(c)}</strong><small>{t('รับมาแล้ว','Received')} {c!.events} {t('รายการ','events')}</small></div></div>}
        {p==='kick'&&api.kickApi&&<button type="button" className="button secondary full nowrap" title={t('แก้ชื่อไลฟ์ หมวด และแท็กบน Kick','Edit your Kick title, category and tags')} onClick={()=>setKickEdit(true)}><PenLine size={16}/>{t('แก้ไขข้อมูลไลฟ์','Edit stream info')}</button>}
        {on?<button className="button secondary full" disabled={busy===p} onClick={()=>void disconnect(p)}><Unplug size={16}/>{t('ตัดการเชื่อมต่อ','Disconnect')}</button>
          :<button className="button primary full" disabled={busy===p||!desktop} onClick={()=>void connect(p)}><Plug size={16}/>{t('เชื่อมต่อ','Connect')}</button>}
        </div>
      </section>})}</div>
    {kickEdit&&<KickInfoDialog t={t} notify={notify} onClose={()=>setKickEdit(false)}/>}
    <section className="panel horizontal-panel"><div><h3>{t('ยังไม่ไลฟ์? ลองด้วยแชททดสอบ','Not live yet? Try test chats')}</h3><p>{t('แชททดสอบติดป้าย TEST เสมอ แยกจากแชทจริง','Test chats are always labelled TEST and kept apart from real chat.')}</p></div><button className="button secondary" onClick={onTryTests}>{t('เปิดห้องทดลอง','Try test events')}</button></section>
  </>;
}
