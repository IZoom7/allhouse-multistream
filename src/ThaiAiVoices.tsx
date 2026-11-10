// Chat TTS → Thai AI voices: offline neural Thai voices the user downloads on demand (electron/thaiTts.cjs).
// Not downloaded = shown but greyed out in the Thai voice list. Download asks first (size, source, licence).
import {useEffect,useState} from 'react';
import {Check,Download,Play,Trash2,X} from 'lucide-react';
import {api,desktop,errorText} from './api';
import type {ConfirmRequest} from './components';
import type {ThaiTtsProgress,ThaiTtsStatus,ThaiVoiceId} from './types';

type T=(a:string,b:string)=>string;
export const AI_PREFIX='ai:';
export const THAI_AI_VOICES:{id:ThaiVoiceId;th:string;en:string;noteTh:string;noteEn:string}[]=[
  {id:'th_female',th:'หญิง',en:'Female',noteTh:'ชัด สดใส เหมาะกับแชททั่วไป',noteEn:'Clear and bright, good for everyday chat'},
  {id:'th_male',th:'ชาย',en:'Male',noteTh:'โทนกลาง ฟังสบาย',noteEn:'Mid tone, easy listening'},
  {id:'th_narrator',th:'ชาย (ผู้บรรยาย)',en:'Male (narrator)',noteTh:'นุ่ม ช้ากว่า แบบอ่านเรื่อง',noteEn:'Softer, slower, storyteller style'},
];
export const thaiAiLabel=(id:string,t:T)=>{const v=THAI_AI_VOICES.find(x=>AI_PREFIX+x.id===id);return v?t(`AI ไทย · ${v.th}`,`Thai AI · ${v.en}`):''};
const mb=(n:number)=>`${(n/1e6).toFixed(n<1e7?1:0)} MB`;

/** Install state + live download progress, shared by the voice list and the panel. */
export function useThaiTts(){
  const [status,setStatus]=useState<ThaiTtsStatus|null>(null);
  const [progress,setProgress]=useState<ThaiTtsProgress|null>(null);
  useEffect(()=>{
    if(!api.thaiTts)return;
    api.thaiTts.status().then(s=>{setStatus(s);setProgress(s.job)}).catch(()=>{});
    return api.thaiTts.onProgress(p=>setProgress(p&&p.phase!=='done'?p:null));
  },[]);
  const installed=(id:ThaiVoiceId)=>!!status?.voices.find(v=>v.id===id)?.installed;
  return {status,setStatus,progress,setProgress,installed};
}
export type ThaiTtsHook=ReturnType<typeof useThaiTts>;

export function ThaiAiVoicesPanel({t,hook,selected,onUse,onPreview,ask,notify}:{t:T;hook:ThaiTtsHook;selected:string;onUse:(value:string)=>void;onPreview:(value:string)=>void;ask:(r:ConfirmRequest)=>void;notify:(msg:string,error?:boolean)=>void}){
  const {status,setStatus,progress,setProgress,installed}=hook;
  const busy=!!progress;
  if(!desktop||!api.thaiTts)return <section className="panel form-panel thai-ai"><h2>{t('เสียงไทย AI (ออฟไลน์)','Thai AI voices (offline)')}</h2><p className="helper">{t('ดาวน์โหลดเสียงได้ในแอปเดสก์ท็อปเท่านั้น','Voices can be downloaded in the desktop app only.')}</p></section>;
  const start=(id:ThaiVoiceId)=>{
    const size=status?.voices.find(v=>v.id===id)?.size||0,engine=status&&!status.engine?status.engineSize:0;
    ask({title:t('ดาวน์โหลดเสียงไทย AI?','Download this Thai AI voice?'),
      body:t(`ขนาดรวม ${mb(size+engine)}${engine?` (รวมตัวประมวลผลเสียง ${mb(engine)} ที่โหลดครั้งแรกครั้งเดียว ใช้ร่วมกันทุกเสียง)`:''} • โหลดจาก Hugging Face และ npm (Microsoft ONNX Runtime) แล้วตรวจไฟล์ก่อนติดตั้ง • หลังติดตั้ง อ่านแชทในเครื่องนี้ ไม่ส่งข้อความออกอินเทอร์เน็ต • ไลเซนส์เสียง CC-BY-NC 4.0: ใช้ได้เฉพาะงานที่ไม่ใช่เชิงพาณิชย์`,
        `${mb(size+engine)} in total${engine?` (includes the ${mb(engine)} voice engine, downloaded once and shared by all voices)`:''} • from Hugging Face and npm (Microsoft ONNX Runtime), checked before install • once installed, chat is read on this computer and never sent online • voice licence CC-BY-NC 4.0: non-commercial use only`),
      confirmLabel:t('ดาวน์โหลดและติดตั้ง','Download and install'),cancelLabel:t('ยกเลิก','Cancel'),icon:<Download size={16}/>,
      onConfirm:()=>{setProgress({voice:id,phase:engine?'engine':'voice',received:0,total:size+engine,bytesPerSec:0});
        api.thaiTts!.install(id).then(s=>{setStatus(s);setProgress(null);notify(t('ติดตั้งเสียงไทย AI แล้ว กด “ใช้เสียงนี้” ได้เลย','Thai AI voice installed. Press “Use this voice”.'))})
          .catch(e=>{setProgress(null);api.thaiTts!.status().then(setStatus).catch(()=>{});const m=errorText(e);notify(/cancel/i.test(m)?t('ยกเลิกการดาวน์โหลดแล้ว','Download cancelled'):t('ดาวน์โหลดไม่สำเร็จ: ','Download failed: ')+m,!/cancel/i.test(m))})}});
  };
  const remove=(id:ThaiVoiceId)=>ask({title:t('ลบเสียงนี้?','Remove this voice?'),body:t('ไฟล์เสียงจะถูกลบออกจากเครื่อง (คืนพื้นที่ประมาณ 114 MB) ดาวน์โหลดใหม่ได้ทุกเมื่อ','The voice file is deleted from this computer (about 114 MB freed). You can download it again any time.'),
    confirmLabel:t('ลบเสียง','Remove voice'),cancelLabel:t('ยกเลิก','Cancel'),icon:<Trash2 size={16}/>,danger:true,
    onConfirm:()=>{if(selected===AI_PREFIX+id)onUse('');api.thaiTts!.remove(id).then(setStatus).catch(e=>notify(errorText(e),true))}});
  return <section className="panel form-panel thai-ai">
    <div className="panel-heading"><h2>{t('เสียงไทย AI (ออฟไลน์)','Thai AI voices (offline)')}</h2><span className="pill">{t('ฟรี • ไม่ต้องต่อเน็ตหลังติดตั้ง','Free • no internet after install')}</span></div>
    <p className="helper">{t('เสียงไทยธรรมชาติกว่าเสียง Windows ประมวลผลในเครื่องนี้ ส่วนภาษาอังกฤษยังใช้เสียงอังกฤษที่เลือกไว้ • ไลเซนส์ CC-BY-NC 4.0 (ไม่ใช่เชิงพาณิชย์)','More natural Thai than Windows voices, generated on this computer. English parts still use your English voice • licence CC-BY-NC 4.0 (non-commercial)')}</p>
    <ul className="thai-ai-list">{THAI_AI_VOICES.map(v=>{
      const value=AI_PREFIX+v.id,has=installed(v.id),mine=progress?.voice===v.id,inUse=selected===value;
      return <li key={v.id} className={'thai-ai-item'+(has?' installed':'')+(inUse?' in-use':'')}>
        <div className="thai-ai-row">
          <div className="thai-ai-name"><strong>{t(v.th,v.en)}</strong><small>{t(v.noteTh,v.noteEn)} • {mb(status?.voices.find(x=>x.id===v.id)?.size||114e6)}</small></div>
          <div className="thai-ai-actions">
            {has?<>
              <button type="button" className="icon-button" title={t('ลองฟัง','Preview')} aria-label={t('ลองฟัง','Preview')} onClick={()=>onPreview(value)}><Play size={16}/></button>
              {inUse?<span className="pill thai-ai-inuse"><Check size={14}/>{t('ใช้อยู่','In use')}</span>:<button type="button" className="button secondary compact" onClick={()=>onUse(value)}>{t('ใช้เสียงนี้','Use this voice')}</button>}
              <button type="button" className="icon-button" title={t('ลบ','Remove')} aria-label={t('ลบเสียงนี้','Remove this voice')} onClick={()=>remove(v.id)}><Trash2 size={16}/></button>
            </>:mine?<button type="button" className="button secondary compact danger" onClick={()=>api.thaiTts!.cancel()}><X size={14}/>{t('ยกเลิก','Cancel')}</button>
              :<button type="button" className="button primary compact" disabled={busy} onClick={()=>start(v.id)}><Download size={15}/>{t('ดาวน์โหลด','Download')}</button>}
          </div>
        </div>
        {mine&&progress&&<DownloadBar t={t} p={progress}/>}
      </li>})}</ul>
  </section>;
}

function DownloadBar({t,p}:{t:T;p:ThaiTtsProgress}){
  const pct=p.total?Math.min(100,p.received/p.total*100):0,installing=p.phase==='install';
  const left=p.bytesPerSec>0?Math.max(0,(p.total-p.received)/p.bytesPerSec):0;
  const eta=left>=60?t(`เหลือ ~${Math.ceil(left/60)} นาที`,`~${Math.ceil(left/60)} min left`):left>0?t(`เหลือ ~${Math.ceil(left)} วินาที`,`~${Math.ceil(left)} s left`):'';
  const phase=installing?t('กำลังติดตั้ง…','Installing…'):p.phase==='engine'?t('ตัวประมวลผลเสียง (ครั้งแรกครั้งเดียว)','Voice engine (first time only)'):t('กำลังโหลดเสียง','Downloading voice');
  return <div className="dl">
    <div className={'dl-track'+(installing?' busy':'')} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={phase}>
      <div className="dl-fill" style={{width:`${pct}%`}}><span className="dl-shine"/></div>
      <span className="dl-pct">{Math.floor(pct)}%</span>
    </div>
    <div className="dl-meta"><span>{phase}</span><span>{mb(p.received)} / {mb(p.total)}{p.bytesPerSec>0&&!installing?` • ${(p.bytesPerSec/1e6).toFixed(1)} MB/s`:''}{eta&&!installing?` • ${eta}`:''}</span></div>
  </div>;
}
