// "วิดเจ็ต OBS / OBS widgets" page (round 4, docs/WIDGETS-CONTRACT.md).
// One card per widget: on/off, its own Browser Source URL, a big W×H hint, a test button and a full editor.
// One Publish button (in the page heading) publishes every widget at once.
import React,{useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,Copy,Gift,ImagePlus,Info,MessageSquare,Monitor,Play,Send,Square,Trash2,Upload,UserPlus,Star,Type,Music} from 'lucide-react';
import {PageHeading,Toggle,WidgetPreview} from './components';
import {api} from './api';
import {ANIMS,MAX_ASSET_CHARS,MAX_IMAGE_BYTES,MAX_SOUND_BYTES,MAX_STATE_BYTES,WIDGET_IDS,fillTemplate,normaliseDataUrl,stateBytes} from './widgets';
// The draft preview is Dev B's WidgetPreview (components.tsx): same layout, labels and template rules as /w/<token>/<id>.
import type {AlertWidget,Anim,BannerWidget,ChatWidget,GiftWidget,HouseEvent,State,Status,WidgetId,Widgets} from './types';

type T=(th:string,en:string)=>string;
type Props={state:State;status:Status|null;t:T;desktop:boolean;busy:boolean;events:HouseEvent[];
  updateWidget:<K extends WidgetId>(id:K,patch:Partial<Widgets[K]>)=>void;publish:()=>void;dirty:boolean;
  notify:(msg:string,error?:boolean)=>void;copy:(text:string)=>void;openWidget:(id:WidgetId)=>void;openLegacy:()=>void;sendTest:(id:Exclude<WidgetId,'banner'>)=>void;
  importedLayoutNotice?:React.ReactNode};


/** Integer field that only commits valid, clamped values (on blur / Enter), so typing "8" on the way to "800" is fine. */
function NumberField({label,value,min,max,onChange,suffix}:{label:string;value:number;min:number;max:number;onChange:(v:number)=>void;suffix?:string}){
  const [text,setText]=useState(String(value));useEffect(()=>setText(String(value)),[value]);
  const commit=()=>{const n=Math.round(Number(text));if(!Number.isFinite(n)||text.trim()===''){setText(String(value));return}const c=Math.max(min,Math.min(max,n));setText(String(c));if(c!==value)onChange(c)};
  return <label>{label}{suffix&&<span className="range-value">{suffix}</span>}<input type="number" inputMode="numeric" min={min} max={max} value={text} onChange={e=>setText(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit()}}/><small className="helper">{min}–{max}</small></label>;
}
function Range({label,value,min,max,step,onChange,format}:{label:string;value:number;min:number;max:number;step:number;onChange:(v:number)=>void;format:(v:number)=>string}){
  return <label>{label} <span className="range-value">{format(value)}</span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
function ColorField({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label>{label}<input type="color" value={value} onChange={e=>onChange(e.target.value)}/></label>}

// Custom CSS (round 7): selectors that exist on each widget's OBS page, and a starter snippet per kind.
const CSS_SELECTORS:Record<'chat'|'alert'|'banner',string[]>={chat:['#box','#box.top','.chat','.chat b','.chat span','.chat .av','.chat .pf','.chat.inline','.tag','.pm'],alert:['#wrap','#card','#card img.art','#card .gimg','#card small','#card .ph','.tag'],banner:['#brand','#title','#subtitle','#art','#scene.neon','#scene.minimal']};
const CSS_EXAMPLES:Record<'chat'|'alert'|'banner',string>={
  chat:'.chat {\n  border-radius: 0;\n  border-left: 6px solid var(--accent);\n  box-shadow: 4px 4px 0 #000;\n}\n.chat b {\n  text-transform: uppercase;\n  letter-spacing: .05em;\n}',
  alert:'#card {\n  border-radius: 0;\n  border-style: dashed;\n  box-shadow: 8px 8px 0 #000;\n}\n#card .ph {\n  color: #ffd84a;\n  text-shadow: 3px 3px 0 #000;\n}',
  banner:'#brand {\n  border-radius: 0;\n  transform: rotate(-2deg);\n  box-shadow: 6px 6px 0 #000;\n}\n#title {\n  letter-spacing: .08em;\n}'};
const cssKind=(id:WidgetId):'chat'|'alert'|'banner'=>id==='chat'?'chat':id==='banner'?'banner':'alert';
const readAsDataUrl=(f:File)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('read failed'));r.readAsDataURL(f)});
const SIZE_PRESETS:Record<WidgetId,[number,number][]>={chat:[[800,1080],[600,1080],[1080,1920],[1920,1080]],follow:[[1920,1080],[1280,720],[1080,1920]],subscription:[[1920,1080],[1280,720],[1080,1920]],gift:[[1920,1080],[1280,720],[1080,1920]],banner:[[1920,1080],[1280,720],[1080,1920]]};

export function WidgetsPage(p:Props){
  const {state,status,t,desktop}=p;
  const [tab,setTab]=useState<WidgetId>('chat');
  const [auditioning,setAuditioning]=useState(false);const audition=useRef<HTMLAudioElement|null>(null);
  const stopAudition=()=>{audition.current?.pause();audition.current=null;setAuditioning(false)};
  useEffect(()=>stopAudition,[tab]);
  const names:Record<WidgetId,string>={chat:t('กล่องแชท','Chat box'),follow:t('แจ้งเตือนผู้ติดตาม','Follow alert'),subscription:t('แจ้งเตือนสมาชิก','Subscription alert'),gift:t('แจ้งเตือนของขวัญ','Gift alert'),banner:t('แบนเนอร์หัวข้อ','Title banner')};
  const icons:Record<WidgetId,React.ReactNode>={chat:<MessageSquare size={17}/>,follow:<UserPlus size={17}/>,subscription:<Star size={17}/>,gift:<Gift size={17}/>,banner:<Type size={17}/>};
  const blurbs:Record<WidgetId,string>={chat:t('แชทล่าสุดจากทุกแพลตฟอร์ม เลื่อนขึ้นเรื่อยๆ','Latest chat from every platform, rolling'),follow:t('ขึ้นเมื่อมีคนกดติดตาม','Shows when someone follows'),subscription:t('ขึ้นเมื่อมีคนสมัครสมาชิก','Shows when someone subscribes'),gift:t('ขึ้นเมื่อมีคนส่งของขวัญใน TikTok LIVE (ผ่าน TikFinity)','Shows when someone sends a TikTok LIVE gift (via TikFinity)'),banner:t('หัวข้อ ข้อความรอง และรูปของห้องคุณ','Your title, subtitle and image')};
  const draft=state.draftWidgets[tab],pub=state.publishedWidgets[tab];
  const widgetDirty=(id:WidgetId)=>JSON.stringify(state.draftWidgets[id])!==JSON.stringify(state.publishedWidgets[id]);
  const url=status?.widgetUrls?.[tab]||'';
  const pages=status?.widgetClients?.[tab]||0;
  const lastEvent=p.events.find(e=>tab==='chat'?e.type==='chat':e.type===tab);
  const bytes=stateBytes(state);
  const set=<K extends WidgetId>(id:K,patch:Partial<Widgets[K]>)=>p.updateWidget(id,patch);

  const pickImage=async(id:'follow'|'subscription'|'gift'|'banner',f?:File)=>{
    if(!f)return;
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(f.type)||f.size>MAX_IMAGE_BYTES){p.notify(t('ใช้ PNG, JPG, WebP หรือ GIF ขนาดไม่เกิน 3 MB','Use PNG, JPG, WebP or GIF up to 3 MB'),true);return}
    try{const data=normaliseDataUrl(await readAsDataUrl(f),'image');if(data.length>MAX_ASSET_CHARS){p.notify(t('รูปใหญ่เกินไปหลังแปลงไฟล์ ลองใช้ไฟล์ที่เล็กลง','The image is too large once encoded. Try a smaller file.'),true);return}set(id,{image:data} as Partial<Widgets[typeof id]>)}
    catch{p.notify(t('อ่านไฟล์รูปไม่สำเร็จ','Could not read that image'),true)}
  };
  const pickSound=async(id:'follow'|'subscription'|'gift',f?:File)=>{
    if(!f)return;
    const okType=/^audio\/(mpeg|mp3|wav|x-wav|wave|ogg|webm)$/.test(f.type)||/\.(mp3|wav|ogg)$/i.test(f.name);
    if(!okType||f.size>MAX_SOUND_BYTES){p.notify(t('ใช้ไฟล์เสียง MP3, WAV หรือ OGG ขนาดไม่เกิน 3 MB','Use an MP3, WAV or OGG sound up to 3 MB'),true);return}
    try{
      let data=normaliseDataUrl(await readAsDataUrl(f),'sound');
      if(/^data:(application\/octet-stream|);/.test(data)){const ext=f.name.split('.').pop()!.toLowerCase();data=data.replace(/^data:[^;]*;/,`data:audio/${ext==='mp3'?'mpeg':ext};`)}
      if(!/^data:audio\/(mpeg|wav|ogg|webm);base64,/.test(data)){p.notify(t('ไฟล์เสียงชนิดนี้ใช้ไม่ได้ ลอง MP3, WAV หรือ OGG','That sound type is not supported. Try MP3, WAV or OGG.'),true);return}
      if(data.length>MAX_ASSET_CHARS){p.notify(t('ไฟล์เสียงใหญ่เกินไปหลังแปลงไฟล์ ลองไฟล์ที่สั้นลง','The sound is too large once encoded. Try a shorter file.'),true);return}
      stopAudition();set(id,{sound:data,soundName:f.name.slice(0,120)});p.notify(t(`เพิ่มเสียง “${f.name}” แล้ว • กดเผยแพร่ให้ OBS ใช้`,`Added sound “${f.name}” • publish so OBS uses it`));
    }catch{p.notify(t('อ่านไฟล์เสียงไม่สำเร็จ','Could not read that sound'),true)}
  };
  const playSound=(a:AlertWidget)=>{stopAudition();if(!a.sound)return;const el=new Audio(a.sound);el.volume=a.volume;audition.current=el;setAuditioning(true);el.onended=()=>setAuditioning(false);el.play().catch(()=>{setAuditioning(false);p.notify(t('เล่นเสียงนี้ไม่ได้','This sound could not be played'),true)})};

  const animOptions=(v:Anim,onChange:(a:Anim)=>void)=><label>{t('แอนิเมชัน','Animation')}<select value={v} onChange={e=>onChange(e.target.value as Anim)}>{ANIMS.map(a=><option key={a} value={a}>{({pop:t('เด้งขึ้น','Pop'),fade:t('ค่อยๆ ปรากฏ','Fade'),slide:t('เลื่อนเข้า','Slide'),none:t('ไม่มี','None')} as Record<Anim,string>)[a]}</option>)}</select></label>;
  const sizeEditor=(id:WidgetId)=>{const w=state.draftWidgets[id];const key=`${w.width}x${w.height}`;const presets=SIZE_PRESETS[id];return <>
    <label>{t('ขนาดวิดเจ็ต','Widget size')}<select value={presets.some(([a,b])=>`${a}x${b}`===key)?key:'custom'} onChange={e=>{if(e.target.value==='custom')return;const [width,height]=e.target.value.split('x').map(Number);set(id,{width,height} as Partial<Widgets[typeof id]>)}}>{presets.map(([a,b])=><option key={a+'x'+b} value={`${a}x${b}`}>{a} × {b}</option>)}<option value="custom">{t('กำหนดเอง','Custom')}</option></select></label>
    <div className="field-row"><NumberField label={t('กว้าง (px)','Width (px)')} value={w.width} min={320} max={3840} onChange={width=>set(id,{width} as Partial<Widgets[typeof id]>)}/><NumberField label={t('สูง (px)','Height (px)')} value={w.height} min={320} max={2160} onChange={height=>set(id,{height} as Partial<Widgets[typeof id]>)}/></div>
  </>};

  const chatEditor=(c:ChatWidget)=><>
    <div className="field-row"><NumberField label={t('ขนาดตัวอักษร (px)','Font size (px)')} value={c.fontSize} min={14} max={72} onChange={fontSize=>set('chat',{fontSize})}/><NumberField label={t('จำนวนข้อความบนจอ','Messages on screen')} value={c.maxMessages} min={1} max={20} onChange={maxMessages=>set('chat',{maxMessages})}/></div>
    <label>{t('ซ่อนข้อความหลังจาก','Hide messages after')}<select value={c.lifetimeSec} onChange={e=>set('chat',{lifetimeSec:Number(e.target.value)})}>{[0,15,30,45,60,120,300,600].map(s=><option key={s} value={s}>{s===0?t('ไม่ซ่อน','Never hide'):s<60?t(`${s} วินาที`,`${s} seconds`):t(`${s/60} นาที`,`${s/60} min`)}</option>)}{![0,15,30,45,60,120,300,600].includes(c.lifetimeSec)&&<option value={c.lifetimeSec}>{c.lifetimeSec}s</option>}</select></label>
    <label>{t('ข้อความใหม่อยู่','Newest message at')}<select value={c.newestAt} onChange={e=>set('chat',{newestAt:e.target.value as ChatWidget['newestAt']})}><option value="bottom">{t('ด้านล่าง','Bottom')}</option><option value="top">{t('ด้านบน','Top')}</option></select></label>
    <div className="field-row"><ColorField label={c.nameColor&&c.nameColor!=='accent'?t('สีหลัก (ขอบ/อื่นๆ)','Accent'):t('สีชื่อ','Name colour')} value={c.accent} onChange={accent=>set('chat',{accent})}/><ColorField label={t('สีข้อความ','Text colour')} value={c.textColor} onChange={textColor=>set('chat',{textColor})}/></div>
    <Range label={t('ความทึบพื้นหลัง','Background opacity')} value={c.bgOpacity} min={0} max={1} step={0.05} onChange={bgOpacity=>set('chat',{bgOpacity})} format={v=>Math.round(v*100)+'%'}/>
    <Toggle checked={c.showPlatformIcon} onChange={showPlatformIcon=>set('chat',{showPlatformIcon})} label={t('แสดงไอคอนแพลตฟอร์ม','Show platform icon')}/>
    <Toggle checked={c.showPlatformName!==false} onChange={showPlatformName=>set('chat',{showPlatformName})} label={t('แสดงชื่อแพลตฟอร์มต่อท้ายชื่อ (· Twitch)','Show the platform name after the viewer (· Twitch)')}/>
    <Toggle checked={!!c.showAvatar} onChange={showAvatar=>set('chat',{showAvatar})} label={t('แสดงรูปโปรไฟล์ผู้ชม','Show viewer profile pictures')}/>
    {c.showAvatar&&<p className="helper">{t('YouTube และ TikTok ส่งรูปจริงมาให้ • Twitch และ Kick ไม่ส่งรูปมาในแชท จึงแสดงวงกลมสีพร้อมตัวอักษรแรกของชื่อแทน','YouTube and TikTok send real pictures • Twitch and Kick don’t send pictures with chat, so a coloured circle with the first letter is shown')}</p>}
    <label>{t('สีชื่อผู้ชม','Viewer name colour')}<select value={c.nameColor||'accent'} onChange={e=>set('chat',{nameColor:e.target.value as ChatWidget['nameColor']})}><option value="accent">{t('สีเดียวกันหมด (สีชื่อด้านล่าง)','One colour for everyone (name colour below)')}</option><option value="platform">{t('สีตามแพลตฟอร์ม','Platform colour')}</option><option value="user">{t('สีของผู้ชมแต่ละคน','Each viewer’s own colour')}</option></select></label>
    {c.nameColor==='user'&&<p className="helper">{t('ใช้สีที่ผู้ชมตั้งไว้ใน Twitch และ Kick • แพลตฟอร์มอื่นได้สีประจำตัวจากชื่อ (ชื่อเดิมได้สีเดิมเสมอ)','Uses the colour viewers picked on Twitch and Kick • others get a steady colour from their name')}</p>}
    <label>{t('รูปแบบข้อความ','Message layout')}<select value={c.layout||'stacked'} onChange={e=>set('chat',{layout:e.target.value as ChatWidget['layout']})}><option value="stacked">{t('ชื่ออยู่บน ข้อความอยู่ล่าง','Name above the message')}</option><option value="inline">{t('ชื่อกับข้อความบรรทัดเดียวกัน','Name and message on one line')}</option></select></label>
    {animOptions(c.animation,animation=>set('chat',{animation}))}
  </>;
  const alertEditor=(id:'follow'|'subscription'|'gift',a:AlertWidget)=>{const preview=fillTemplate(a.template||'',id==='gift'?{name:'mintmint',platform:'TikTok',message:'Rose ×5',gift:{name:'Rose',count:5,coins:1}}:{name:'mintmint',platform:'Twitch',message:id==='follow'?t('ติดตามช่องแล้ว!','just followed!'):t('สมัครสมาชิกแล้ว!','just subscribed!')});return <>
    <label>{t('ข้อความแจ้งเตือน','Alert text')}<input maxLength={120} value={a.template} onChange={e=>set(id,{template:e.target.value})} placeholder={id==='follow'?'{name} followed!':id==='gift'?'{name} sent {gift} ×{count}':'{name} subscribed!'}/></label>
    <p className="helper">{id==='gift'?t('ใส่ {name} = ชื่อผู้ชม, {gift} = ชื่อของขวัญ, {count} = จำนวน, {coins} = เหรียญรวม • ตัวอย่าง: ','Use {name} = viewer, {gift} = gift name, {count} = how many, {coins} = total coins • Preview: '):t('ใส่ {name} = ชื่อผู้ชม, {platform} = แพลตฟอร์ม, {message} = ข้อความ • ตัวอย่าง: ','Use {name} = viewer name, {platform} = platform, {message} = message • Preview: ')}<strong>{preview||'—'}</strong></p>
    {id==='gift'&&<><NumberField label={t('เหรียญขั้นต่ำที่จะขึ้นแจ้งเตือน','Minimum coins for an alert')} value={(a as GiftWidget).minCoins} min={0} max={1000000} onChange={minCoins=>set('gift',{minCoins})}/>
      <p className="helper">{t('ของขวัญที่มูลค่ารวมต่ำกว่านี้ (เช่น กุหลาบ 1 เหรียญ) จะแสดงแค่ในห้องแชท ไม่ขึ้นบน OBS • 0 = ขึ้นทุกชิ้น','Gifts worth less than this in total (e.g. a 1-coin Rose) only show in the activity feed, not on OBS • 0 = every gift')}</p>
      <Toggle checked={(a as GiftWidget).showGiftImage} onChange={showGiftImage=>set('gift',{showGiftImage})} label={t('แสดงรูปของขวัญจาก TikTok','Show the TikTok gift picture')}/></>}
    <div className="field-row"><NumberField label={t('แสดงนาน (วินาที)','Show for (seconds)')} value={a.durationSec} min={2} max={30} onChange={durationSec=>set(id,{durationSec})}/><NumberField label={t('ขนาดตัวอักษร (px)','Font size (px)')} value={a.fontSize} min={20} max={160} onChange={fontSize=>set(id,{fontSize})}/></div>
    <div className="field-row"><ColorField label={t('สีหลัก','Accent')} value={a.accent} onChange={accent=>set(id,{accent})}/><ColorField label={t('สีข้อความ','Text colour')} value={a.textColor} onChange={textColor=>set(id,{textColor})}/></div>
    <Range label={t('ความทึบพื้นหลัง','Background opacity')} value={a.bgOpacity} min={0} max={1} step={0.05} onChange={bgOpacity=>set(id,{bgOpacity})} format={v=>Math.round(v*100)+'%'}/>
    {animOptions(a.animation,animation=>set(id,{animation}))}
    <div className="asset-row"><label className="button secondary upload-label"><ImagePlus size={16}/>{a.image?t('เปลี่ยนรูป','Change image'):t('เพิ่มรูป / GIF','Add image / GIF')}<input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{const f=e.target.files?.[0];e.target.value='';void pickImage(id,f)}}/></label>{a.image&&<button className="text-button danger" onClick={()=>set(id,{image:''})}><Trash2 size={15}/>{t('นำรูปออก','Remove image')}</button>}</div>
    <p className="helper">{t('PNG, JPG, WebP หรือ GIF เคลื่อนไหว · สูงสุด 3 MB · แสดงเต็มรูป ไม่ถูกตัด','PNG, JPG, WebP or animated GIF · up to 3 MB · shown whole, never cropped')}</p>
    <fieldset className="sound-box"><legend><Music size={15}/> {t('เสียงแจ้งเตือน','Alert sound')}</legend>
      {a.sound?<p className="sound-name" title={a.soundName}>{a.soundName||t('ไฟล์เสียง','Sound file')}</p>:<p className="helper">{t('ยังไม่มีเสียง • MP3, WAV หรือ OGG สูงสุด 3 MB','No sound yet • MP3, WAV or OGG up to 3 MB')}</p>}
      <div className="asset-row">
        <label className="button secondary compact upload-label"><Upload size={15}/>{a.sound?t('เปลี่ยนเสียง','Replace sound'):t('อัปโหลดเสียง','Upload sound')}<input className="visually-hidden" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,.mp3,.wav,.ogg" onChange={e=>{const f=e.target.files?.[0];e.target.value='';void pickSound(id,f)}}/></label>
        {a.sound&&(auditioning?<button className="button secondary compact" onClick={stopAudition}><Square size={14}/>{t('หยุด','Stop')}</button>:<button className="button secondary compact" onClick={()=>playSound(a)}><Play size={14}/>{t('ฟังในแอพ','Play here')}</button>)}
        {a.sound&&<button className="text-button danger" onClick={()=>{stopAudition();set(id,{sound:'',soundName:''})}}><Trash2 size={15}/>{t('นำเสียงออก','Remove sound')}</button>}
      </div>
      <Range label={t('ความดังของเสียง','Sound volume')} value={a.volume} min={0} max={1} step={0.05} onChange={volume=>{set(id,{volume});if(audition.current)audition.current.volume=volume}} format={v=>Math.round(v*100)+'%'}/>
      <p className="helper">{t('ใน OBS ให้ติ๊ก “Control audio via OBS” ที่ Browser Source นี้ เพื่อให้เสียงเข้าไลฟ์และปรับเสียงใน OBS ได้','In OBS, tick “Control audio via OBS” on this Browser Source so the sound goes into your stream and shows in the OBS mixer.')}</p>
    </fieldset>
  </>};
  const bannerEditor=(b:BannerWidget)=><>
    <label>{t('รูปแบบ','Template')}<select value={b.template} onChange={e=>set('banner',{template:e.target.value as BannerWidget['template']})}><option value="studio">Studio</option><option value="minimal">Minimal</option><option value="neon">Neon</option></select></label>
    <label>{t('หัวข้อ','Title')}<input maxLength={120} value={b.title} onChange={e=>set('banner',{title:e.target.value})}/></label>
    <label>{t('ข้อความรอง','Subtitle')}<input maxLength={200} value={b.subtitle} onChange={e=>set('banner',{subtitle:e.target.value})}/></label>
    <ColorField label={t('สีหลัก','Accent')} value={b.accent} onChange={accent=>set('banner',{accent})}/>
    <div className="asset-row"><label className="button secondary upload-label"><ImagePlus size={16}/>{b.image?t('เปลี่ยนรูป','Change image'):t('เพิ่มรูป / GIF','Add image / GIF')}<input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{const f=e.target.files?.[0];e.target.value='';void pickImage('banner',f)}}/></label>{b.image&&<button className="text-button danger" onClick={()=>set('banner',{image:''})}><Trash2 size={15}/>{t('นำรูปออก','Remove image')}</button>}</div>
  </>;

  const testLabel:Record<Exclude<WidgetId,'banner'>,string>={chat:t('ส่งแชททดสอบไป OBS','Send a test chat to OBS'),follow:t('ส่งการแจ้งเตือนผู้ติดตามทดสอบ','Send a test follow alert'),subscription:t('ส่งการแจ้งเตือนสมาชิกทดสอบ','Send a test subscription alert'),gift:t('ส่งการแจ้งเตือนของขวัญทดสอบ','Send a test gift alert')};
  return <>
    <PageHeading title={t('วิดเจ็ต OBS','OBS widgets')} description={t('แต่ละส่วนเป็น Browser Source แยกกันใน OBS มีลิงก์ ขนาด และการตั้งค่าของตัวเอง ลากวางและย่อขยายใน OBS ได้อิสระ','Each part is its own Browser Source in OBS, with its own link, size and settings. Move and resize each one freely in OBS.')}
      action={p.dirty?<button className="button primary" onClick={p.publish}><Upload size={16}/>{t('เผยแพร่ทุกวิดเจ็ต','Publish all widgets')}</button>:<button className="button secondary" disabled><Check size={16}/>{t('เผยแพร่แล้ว • ไม่มีอะไรเปลี่ยน','Up to date')}</button>}/>
    {p.importedLayoutNotice}
    {p.dirty&&<div className="notice warning" role="note"><Info size={17}/><p>{t('มีการแก้ไขที่ยังไม่เผยแพร่ OBS ยังแสดงฉบับเดิมอยู่ • กด “เผยแพร่ทุกวิดเจ็ต” เมื่อพร้อม','You have unpublished changes. OBS still shows the previous version • press “Publish all widgets” when ready.')}</p></div>}
    {bytes>MAX_STATE_BYTES*0.8&&<div className="notice warning" role="alert"><Info size={17}/><p>{t(`รูปและเสียงรวมกัน ${(bytes/1048576).toFixed(1)} MB ใกล้ขีดจำกัด 25 MB แล้ว ลองใช้ไฟล์ที่เล็กลง`,`Images and sounds now total ${(bytes/1048576).toFixed(1)} MB, close to the 25 MB limit. Try smaller files.`)}</p></div>}
    <div className="widget-tabs" role="tablist" aria-label={t('วิดเจ็ต','Widgets')}>{WIDGET_IDS.map(id=><button key={id} role="tab" aria-selected={tab===id} className={'widget-tab'+(tab===id?' active':'')} onClick={()=>setTab(id)}>{icons[id]}<span>{names[id]}</span><span className={'dot'+(state.draftWidgets[id].enabled?'':' off')} aria-label={state.draftWidgets[id].enabled?t('เปิด','on'):t('ปิด','off')}/>{widgetDirty(id)&&<span className="pill amber">{t('ยังไม่เผยแพร่','unpublished')}</span>}</button>)}</div>
    <section className="panel widget-card" role="tabpanel" aria-label={names[tab]}>
      <div className="panel-heading"><div><h2>{icons[tab]}{names[tab]}</h2><p>{blurbs[tab]}</p></div><div className="widget-head-actions"><span className={pages?'pill':'pill amber'}>{!desktop?t('โหมดเบราว์เซอร์ไม่มี OBS','No OBS in browser mode'):pages?t(`เปิดอยู่ ${pages} หน้า (ยังไม่ใช่การไลฟ์)`,`${pages} page(s) open (not proof you are live)`):t('ยังไม่มีหน้านี้เปิดใน OBS','Not open in OBS yet')}</span><Toggle checked={draft.enabled} onChange={enabled=>set(tab,{enabled} as Partial<Widgets[typeof tab]>)} label={draft.enabled?t('เปิดใช้','On'):t('ปิดอยู่','Off')}/></div></div>
      {!pub.enabled&&<p className="status-message">{t('วิดเจ็ตนี้ปิดอยู่ในฉบับเผยแพร่ หน้าใน OBS จะว่างเปล่า','This widget is off in the published version, so its OBS page stays empty.')}</p>}
      <div className="size-hint" aria-label={t('ขนาดที่ต้องตั้งใน OBS','Size to set in OBS')}><Monitor size={22}/><div><small>{t('ตั้งใน OBS','Set in OBS')}</small><strong>{t(`กว้าง ${pub.width} สูง ${pub.height}`,`Width ${pub.width} · Height ${pub.height}`)}</strong>{(draft.width!==pub.width||draft.height!==pub.height)&&<small>{t(`ฉบับร่างเป็น ${draft.width} × ${draft.height} — เผยแพร่ก่อน แล้วใช้ขนาดนี้แทน`,`Draft is ${draft.width} × ${draft.height} — publish first, then use that size`)}</small>}</div></div>
      <div className="url-field"><input aria-label={t(`ลิงก์ Browser Source ของ${names[tab]}`,`Browser Source URL for ${names[tab]}`)} readOnly value={url||(desktop?t('รอแอพสร้างลิงก์…','Waiting for the app to create the link…'):t('เปิดแอพเดสก์ท็อปเพื่อรับลิงก์ OBS','Open the desktop app to get your OBS link'))}/><button className="button primary" disabled={!url} onClick={()=>p.copy(url)}><Copy size={16}/>{t('คัดลอกลิงก์','Copy link')}</button><button className="icon-button" disabled={!url} aria-label={t('เปิดวิดเจ็ตในเบราว์เซอร์','Open widget in browser')} title={t('เปิดวิดเจ็ตในเบราว์เซอร์','Open widget in browser')} onClick={()=>p.openWidget(tab)}><ArrowUpRight size={20}/></button></div>
      <ol className="widget-steps"><li>{t('ใน OBS: Sources → + → Browser แล้ววางลิงก์นี้','In OBS: Sources → + → Browser, then paste this link')}</li><li>{t(`ตั้ง Width ${pub.width} และ Height ${pub.height}`,`Set Width ${pub.width} and Height ${pub.height}`)}{tab!=='chat'&&tab!=='banner'&&t(' และติ๊ก “Control audio via OBS” ถ้ามีเสียง',' and tick “Control audio via OBS” if it has a sound')}</li><li>{tab==='banner'?t('กดเผยแพร่ แล้วดูผลใน OBS','Publish, then check it in OBS'):t('กดปุ่มทดสอบด้านล่าง ควรเห็นผลใน OBS ทันที','Press the test button below — it should appear in OBS right away')}</li></ol>
      {tab!=='banner'&&<div className="queue-controls"><button className="button secondary" disabled={!desktop||p.busy} onClick={()=>p.sendTest(tab)}><Send size={16}/>{testLabel[tab]}<span className="test-tag">TEST</span></button>{!desktop&&<small className="step-note">{t('ใช้ได้ในแอพเดสก์ท็อป','Available in the desktop app')}</small>}{desktop&&status?.paused&&tab!=='chat'&&<small className="step-note warn">{t('คิวการแจ้งเตือนพักอยู่ — จะขึ้นเมื่อกดเล่นต่อ','The alert queue is paused — it will show after you resume')}</small>}</div>}
      <div className="widget-body">
        <div className="widget-preview"><div className="panel-heading"><strong>{t('พรีวิวฉบับร่าง','Draft preview')}</strong><span className="canvas-footer">{draft.width} × {draft.height}</span></div><WidgetPreview widget={draft} kind={tab} event={lastEvent}/><p className="helper">{t('พื้นตาราง = โปร่งใสใน OBS','Checkerboard = transparent in OBS')}</p>
          <section className="css-editor" aria-label={t('CSS กำหนดเอง','Custom CSS')}>
            <Toggle checked={!!draft.customCssEnabled} onChange={customCssEnabled=>set(tab,{customCssEnabled} as Partial<Widgets[typeof tab]>)} label={t('ใช้ CSS กำหนดเอง (ขั้นสูง)','Use custom CSS (advanced)')}/>
            {draft.customCssEnabled&&<>
              <textarea spellCheck={false} maxLength={20000} rows={10} aria-label={t('โค้ด CSS ของวิดเจ็ตนี้','CSS code for this widget')} placeholder={CSS_EXAMPLES[cssKind(tab)]} value={draft.customCss||''}
                onChange={e=>set(tab,{customCss:e.target.value} as Partial<Widgets[typeof tab]>)}
                onKeyDown={e=>{if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();const el=e.currentTarget,a=el.selectionStart,b=el.selectionEnd,v=el.value.slice(0,a)+'  '+el.value.slice(b);set(tab,{customCss:v} as Partial<Widgets[typeof tab]>);requestAnimationFrame(()=>{el.selectionStart=el.selectionEnd=a+2})}}}/>
              <div className="asset-row"><button className="button secondary compact" onClick={()=>set(tab,{customCss:CSS_EXAMPLES[cssKind(tab)]} as Partial<Widgets[typeof tab]>)}>{t('ใส่โค้ดตัวอย่าง','Insert example')}</button>{(draft.customCss||'')!==''&&<button className="text-button danger" onClick={()=>set(tab,{customCss:''} as Partial<Widgets[typeof tab]>)}><Trash2 size={15}/>{t('ล้างโค้ด','Clear code')}</button>}<small className="helper">{(draft.customCss||'').length}/20000</small></div>
              <button type="button" className="text-button" disabled={!api.openDocs} title={api.openDocs?undefined:t('เปิดคู่มือได้ในแอพเดสก์ท็อป','Open the manual from the desktop app')} onClick={()=>void api.openDocs?.('custom-css',t('th','en') as 'th'|'en').catch(e=>p.notify(String(e?.message||e),true))}><ArrowUpRight size={15}/>{t('เปิดคู่มือ CSS (ตรงไหนเป็นตรงไหน สี ขอบ ไล่สี แอนิเมชัน)','Open the CSS guide (parts, colours, borders, gradients, animation)')}</button>
              <p className="helper">{t('ใช้ selector เหล่านี้ได้:','Selectors you can use:')}</p>
              <div className="css-selectors">{CSS_SELECTORS[cssKind(tab)].map(x=><code key={x}>{x}</code>)}</div>
              <p className="helper">{t('สีตามการตั้งค่า: var(--accent), var(--text), var(--bg) • พรีวิวด้านบนแสดงผลทันที แต่ OBS จะเปลี่ยนเมื่อกดเผยแพร่ • รูปใน CSS ต้องเป็น data: URL เพราะวิดเจ็ตโหลดไฟล์จากเน็ตไม่ได้','Your colours: var(--accent), var(--text), var(--bg) • The preview updates live; OBS changes when you publish • Images in CSS must be data: URLs — widgets cannot load files from the internet')}</p>
            </>}
          </section></div>
        <div className="properties widget-editor"><h3>{t('ตั้งค่า','Settings')}</h3>
          {sizeEditor(tab)}
          {tab==='chat'&&chatEditor(draft as ChatWidget)}
          {(tab==='follow'||tab==='subscription'||tab==='gift')&&alertEditor(tab,draft as AlertWidget)}
          {tab==='banner'&&bannerEditor(draft as BannerWidget)}
        </div>
      </div>
    </section>
    <details className="panel legacy-overlay"><summary>{t('ขั้นสูง: โอเวอร์เลย์รวมทุกอย่างในลิงก์เดียว (แบบเดิม)','Advanced: all-in-one overlay in one link (legacy)')}</summary>
      <p className="helper">{t('ลิงก์เดิมยังใช้ได้ แสดงแบนเนอร์ แชท และการแจ้งเตือนรวมในหน้าเดียว 1920 × 1080 แนะนำให้ใช้วิดเจ็ตแยกด้านบนแทน','The old link still works and shows the banner, chat and alerts together on one 1920 × 1080 page. Separate widgets above are recommended instead.')}</p>
      <div className="url-field"><input aria-label={t('ลิงก์โอเวอร์เลย์รวม','All-in-one overlay URL')} readOnly value={status?.url||t('เปิดแอพเดสก์ท็อปเพื่อรับลิงก์ OBS','Open the desktop app to get your OBS link')}/><button className="button secondary" disabled={!status?.url} onClick={()=>p.copy(status!.url)}><Copy size={16}/>{t('คัดลอกลิงก์','Copy link')}</button><button className="icon-button" disabled={!status?.url} aria-label={t('เปิดในเบราว์เซอร์','Open in browser')} onClick={p.openLegacy}><ArrowUpRight size={20}/></button></div>
    </details>
    <p className="helper">{t('ลิงก์ทั้งหมดใช้ได้เฉพาะเครื่องนี้ เก็บไว้เป็นส่วนตัว • การทดสอบติดป้าย TEST แต่ถ้ากำลังไลฟ์ ผู้ชมก็เห็น • หน้าที่เปิดอยู่ไม่ได้แปลว่ากำลังไลฟ์','All links work on this computer only — keep them private • Tests are labelled TEST, but live viewers will still see them • An open page does not mean you are live.')}</p>
  </>;
}
