import type {API,SpeechCommand,SpeechStatus,AlertWidget,Anim,BannerWidget,ChatWidget,Delivery,HouseEvent,Scene,State,StateV1,Status,WidgetId,Widgets} from './types';

// ---- Widgets: defaults, v1 → v2 migration, validation (docs/WIDGETS-CONTRACT.md; runtime.cjs is the desktop authority) ----
export const WIDGET_IDS:WidgetId[]=['chat','follow','subscription','gift','banner'];
export const ANIMS:Anim[]=['pop','fade','slide','none'];
export const MAX_ASSET_CHARS=4*1024*1024;      // encoded data: URL limit per image/sound
export const MAX_SOUND_BYTES=3*1024*1024;      // file picked by the user
export const MAX_IMAGE_BYTES=3*1024*1024;
export const MAX_STATE_BYTES=25*1024*1024;

const alert=(template:string,accent:string,enabled=true):AlertWidget=>({enabled,width:1920,height:1080,durationSec:6,template,fontSize:56,accent,textColor:'#ffffff',bgOpacity:0.85,animation:'pop',image:'',sound:'',soundName:'',volume:0.8});
export function defaultWidgets(accent='#b4f272'):Widgets{
  return {
    chat:{enabled:true,width:800,height:1080,fontSize:28,maxMessages:6,lifetimeSec:45,showPlatformIcon:true,bgOpacity:0.85,accent,textColor:'#ffffff',newestAt:'bottom',animation:'slide',showAvatar:false,showPlatformName:true,nameColor:'accent',layout:'stacked'},
    follow:alert('{name} followed!',accent),
    subscription:alert('{name} subscribed!',accent),
    gift:{...alert('{name} sent {gift} ×{count}',accent),minCoins:1,showGiftImage:true},
    banner:{enabled:true,width:1920,height:1080,title:'WELCOME TO THE HOUSE',subtitle:'พื้นที่ของเรา เรื่องราวของคุณ',accent,template:'studio',image:''},
  };
}
/** v1 scene → widgets: banner ← scene; accents ← scene.accent; chat.enabled ← showChat; alerts.enabled ← showAlert. */
export function widgetsFromScene(s:Scene):Widgets{
  const w=defaultWidgets(s.accent);
  w.banner={...w.banner,title:s.title,subtitle:s.subtitle,accent:s.accent,template:s.template,image:s.image};
  w.chat.enabled=s.showChat;w.follow.enabled=s.showAlert;w.subscription.enabled=s.showAlert;w.gift.enabled=s.showAlert;
  return w;
}
/** Legacy all-in-one overlay scene derived from the widgets, so /overlay/<token> keeps working. */
export function sceneFromWidgets(w:Widgets,prev?:Scene):Scene{
  return {title:w.banner.title,subtitle:w.banner.subtitle,accent:w.banner.accent,template:w.banner.template,image:w.banner.image,
    showChat:w.chat.enabled,showAlert:w.follow.enabled||w.subscription.enabled,width:prev?.width??1920,height:prev?.height??1080};
}
export function migrateState(input:State|StateV1):State{
  // v2 saved before the gift widget existed (round 6): add the default gift widget.
  if(input.schemaVersion===2){const s=input as State;const add=(w:Widgets)=>w&&!w.gift?{...w,gift:defaultWidgets(w.follow?.accent||'#b4f272').gift}:w;return s.draftWidgets?.gift&&s.publishedWidgets?.gift?s:{...s,draftWidgets:add(s.draftWidgets),publishedWidgets:add(s.publishedWidgets)}}
  const v1=input as StateV1;
  return {...v1,schemaVersion:2,draftWidgets:widgetsFromScene(v1.draft),publishedWidgets:widgetsFromScene(v1.published),widgetsPublishedAt:v1.publishedAt};
}

// ---- validation (same rules as the contract / runtime.cjs) ----
const hex=(v:unknown)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const int=(v:unknown,a:number,b:number)=>Number.isInteger(v)&&(v as number)>=a&&(v as number)<=b;
const num=(v:unknown,a:number,b:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const str=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
const anim=(v:unknown)=>ANIMS.includes(v as Anim);
const dataUrl=(v:unknown,re:RegExp)=>typeof v==='string'&&v.length<=MAX_ASSET_CHARS&&(v===''||re.test(v));
const IMAGE_RE=/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/,SOUND_RE=/^data:audio\/(mpeg|wav|ogg|webm);base64,[A-Za-z0-9+/=]+$/;
const base=(w:any)=>!!w&&typeof w.enabled==='boolean'&&int(w.width,320,3840)&&int(w.height,320,2160)&&(w.customCss===undefined||str(w.customCss,20000))&&(w.customCssEnabled===undefined||typeof w.customCssEnabled==='boolean');
export const chatOk=(w:ChatWidget)=>base(w)&&int(w.fontSize,14,72)&&int(w.maxMessages,1,20)&&(w.lifetimeSec===0||int(w.lifetimeSec,5,600))&&typeof w.showPlatformIcon==='boolean'&&num(w.bgOpacity,0,1)&&hex(w.accent)&&hex(w.textColor)&&['bottom','top'].includes(w.newestAt)&&anim(w.animation)&&(w.showAvatar===undefined||typeof w.showAvatar==='boolean')&&(w.showPlatformName===undefined||typeof w.showPlatformName==='boolean')&&(w.nameColor===undefined||['accent','platform','user'].includes(w.nameColor))&&(w.layout===undefined||['stacked','inline'].includes(w.layout));
export const alertOk=(w:AlertWidget)=>base(w)&&int(w.durationSec,2,30)&&str(w.template,120)&&int(w.fontSize,20,160)&&hex(w.accent)&&hex(w.textColor)&&num(w.bgOpacity,0,1)&&anim(w.animation)&&dataUrl(w.image,IMAGE_RE)&&dataUrl(w.sound,SOUND_RE)&&str(w.soundName,120)&&num(w.volume,0,1);
export const bannerOk=(w:BannerWidget)=>base(w)&&str(w.title,120)&&str(w.subtitle,200)&&hex(w.accent)&&['studio','minimal','neon'].includes(w.template)&&dataUrl(w.image,IMAGE_RE);
export const widgetsOk=(w:Widgets)=>!!w&&chatOk(w.chat)&&alertOk(w.follow)&&alertOk(w.subscription)&&alertOk(w.gift)&&int(w.gift.minCoins,0,1000000)&&typeof w.gift.showGiftImage==='boolean'&&bannerOk(w.banner);

/** Normalise what a FileReader gives us to the MIME types the contract allows. */
export function normaliseDataUrl(url:string,kind:'image'|'sound'):string{
  let u=url;
  if(kind==='sound')u=u.replace(/^data:audio\/(x-wav|wave|vnd\.wave);/,'data:audio/wav;').replace(/^data:audio\/(mp3|x-mpeg|mpeg3);/,'data:audio/mpeg;').replace(/^data:video\/ogg;/,'data:audio/ogg;');
  return u;
}
/** Fill placeholders the same way the widget page does (text only, never HTML). */
export const fillTemplate=(template:string,v:{name:string;platform:string;message:string;gift?:{name:string;count:number;coins:number}})=>template.replace(/\{(name|platform|message|gift|count|coins)\}/g,(_,k:string)=>k==='gift'?(v.gift?.name??''):k==='count'?String(v.gift?.count??1):k==='coins'?String((v.gift?.coins??0)*(v.gift?.count??1)):v[k as 'name'|'platform'|'message']);
/** Rough encoded size of the saved workspace, to warn before the 25 MB limit. */
export const stateBytes=(s:State)=>JSON.stringify({...s,history:[]}).length;


// Browser-preview fallback used when the page is opened outside Electron (e.g. `vite dev`).
// It mirrors the desktop runtime's rules closely enough for UI testing; nothing leaves the browser.
const scene={title:'WELCOME TO THE HOUSE',subtitle:'พื้นที่ของเรา เรื่องราวของคุณ',accent:'#b4f272',template:'studio' as const,showChat:true,showAlert:true,width:1920,height:1080,image:''};
const initial:State={schemaVersion:2,workspaceName:'My streaming room',language:'th',theme:'dark',onboarded:false,draftWidgets:defaultWidgets(),publishedWidgets:defaultWidgets(),widgetsPublishedAt:null,draft:scene,published:{...scene},publishedAt:null,tts:{enabled:false,rate:1,volume:0.8,thaiVoice:'',englishVoice:''},history:[]};
let cached:State=structuredClone(initial);
try { const saved=localStorage.getItem('allhouse-preview');if(saved){const s=JSON.parse(saved);if(s&&(s.schemaVersion===1||s.schemaVersion===2)&&s.draft&&s.published&&s.tts&&Array.isArray(s.history))cached=migrateState(s)} } catch {}
let paused=false,muted=false,storageWarning='',current:HouseEvent|null=null,timer:ReturnType<typeof setTimeout>|undefined;
const persist=()=>{try{localStorage.setItem('allhouse-preview',JSON.stringify(cached));storageWarning=''}catch{storageWarning='Browser storage is full; changes in this preview are kept only until you close the tab.'}};
const active=()=>cached.history.filter(e=>e.status==='queued'||e.status==='playing').length;
const status=():Status=>({url:'',clients:0,paused,muted,storageWarning,queue:active()});
// Same 5-second, one-at-a-time alert lifecycle as electron/runtime.cjs.
const pump=()=>{if(paused||current)return;const next=cached.history.find(e=>e.status==='queued');if(!next)return;current=next;next.status='playing';persist();timer=setTimeout(()=>{next.status='completed';current=null;persist();pump()},5000)};
// Same rules as electron/runtime.cjs validateState, so the preview never accepts what the desktop app would reject.
const sceneOk=(x:State['draft'])=>!!x&&typeof x.title==='string'&&x.title.length<=120&&typeof x.subtitle==='string'&&x.subtitle.length<=200&&/^#[0-9a-f]{6}$/i.test(x.accent)&&['studio','minimal','neon'].includes(x.template)&&Number.isInteger(x.width)&&x.width>=320&&x.width<=3840&&Number.isInteger(x.height)&&x.height>=320&&x.height<=2160&&typeof x.showChat==='boolean'&&typeof x.showAlert==='boolean'&&typeof x.image==='string'&&x.image.length<=4000000&&(!x.image||/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(x.image));
function validate(s:State){
  if(!s||s.schemaVersion!==2)throw new Error('Unsupported workspace version');
  if(!widgetsOk(s.draftWidgets)||!widgetsOk(s.publishedWidgets))throw new Error('Invalid widget settings');
  if(stateBytes(s)>MAX_STATE_BYTES)throw new Error('Workspace is larger than 25 MB. Use smaller images or sounds.');
  if(typeof s.workspaceName!=='string'||!s.workspaceName.trim()||s.workspaceName.length>80)throw new Error('Workspace name required (1–80 characters)');
  if(!['th','en'].includes(s.language)||!['dark','light','system'].includes(s.theme))throw new Error('Invalid preferences');
  if(!sceneOk(s.draft)||!sceneOk(s.published))throw new Error('Invalid overlay');
  const t=s.tts;if(!t||typeof t.enabled!=='boolean'||!Number.isFinite(t.rate)||t.rate<0.5||t.rate>2||!Number.isFinite(t.volume)||t.volume<0||t.volume>1||typeof t.thaiVoice!=='string'||t.thaiVoice.length>200||typeof t.englishVoice!=='string'||t.englishVoice.length>200)throw new Error('Invalid speech settings');
  const r=t.rules;if(r!==undefined&&(!r||!r.platforms||!['twitch','youtube','kick','tiktok'].every(k=>typeof (r.platforms as Record<string,unknown>)[k]==='boolean')||typeof r.readName!=='boolean'||(r.nameTemplate!==undefined&&!str(r.nameTemplate,200))||typeof r.skipCommands!=='boolean'||!str(r.ignoreNames,2000)||!int(r.maxChars,20,500)))throw new Error('Invalid chat reading rules');
}
// Pop-out chat in browser preview: a second tab/window sharing localStorage; speech relay over BroadcastChannel.
const isPopout=()=>typeof location!=='undefined'&&location.hash==='#chat-window';
const reloadFromStorage=()=>{if(!isPopout())return;try{const raw=localStorage.getItem('allhouse-preview');if(raw){const s=JSON.parse(raw);if(s&&(s.schemaVersion===1||s.schemaVersion===2)&&Array.isArray(s.history))cached=migrateState(s)}}catch{}};
let channel:BroadcastChannel|null|undefined;
const bc=()=>{if(channel===undefined)channel=typeof BroadcastChannel==='function'?new BroadcastChannel('allhouse-speech'):null;return channel};
const listen=<T,>(kind:string,cb:(v:T)=>void)=>{const c=bc();if(!c)return()=>{};const h=(e:MessageEvent)=>{if(e.data&&e.data.kind===kind)cb(e.data.value as T)};c.addEventListener('message',h);return()=>c.removeEventListener('message',h)};
const fallback:API={
  async getState(){reloadFromStorage();return structuredClone(cached)},async getHistory(){reloadFromStorage();return structuredClone(cached.history)},async getStatus(){return status()},
  async saveState(input){const s=migrateState(input as State|StateV1);validate(s);cached={...structuredClone(s),workspaceName:s.workspaceName.trim()||cached.workspaceName,history:cached.history};persist();return structuredClone(cached)},
  async sendEvent(input){
    const name=input.name.trim(),message=input.message.trim();
    if(!name||name.length>80||!message||message.length>500)throw new Error('Invalid sample event');
    if(input.type!=='chat'&&active()>=50)throw new Error('Queue is full (50)'); // chat never enters the alert queue
    const e:HouseEvent={...input,name,message,id:crypto.randomUUID(),sourceMode:'test',createdAt:new Date().toISOString(),status:input.type==='chat'?'completed':'queued'};
    cached.history=[...cached.history,e];
    while(cached.history.length>200){const idx=cached.history.findIndex(x=>x.status!=='queued'&&x.status!=='playing');if(idx<0)break;cached.history.splice(idx,1)}
    persist();pump();const delivery:Delivery={overlays:0,delivered:false,reason:'app-only'};return {...structuredClone(e),delivery} // no OBS in browser mode
  },
  async controlQueue(a){
    if(a==='pause')paused=true;if(a==='resume'){paused=false;pump()}
    if(a==='mute')muted=true;if(a==='unmute')muted=false;
    if(a==='skip'||a==='clear'||a==='clearHistory'){
      clearTimeout(timer);
      if(current)current.status='skipped';else if(a==='skip'){const next=cached.history.find(e=>e.status==='queued');if(next)next.status='skipped'}
      current=null;
      if(a!=='skip')cached.history.forEach(e=>{if(e.status==='queued')e.status='skipped'});
      if(a==='clearHistory')cached.history=[];
      pump();
    }
    persist();return status()
  },
  async copyText(t){await navigator.clipboard.writeText(t);return true},
  async exportBackup(){const data={...cached,history:[]};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Allhouse-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true},
  async importBackup(){throw new Error('Import is available in the desktop app.')},async openOverlay(){},
  async openChatWindow(){const w=window.open('#chat-window','allhouse-chat','width=420,height=800');if(!w)throw new Error('The browser blocked the pop-up window. Allow pop-ups for this page.');w.focus();return {open:true,top:false}},
  async sendSpeechCommand(cmd:SpeechCommand){bc()?.postMessage({kind:'cmd',value:cmd});return true},
  async reportSpeechStatus(s:SpeechStatus){bc()?.postMessage({kind:'status',value:s});return true},
  onSpeechCommand:cb=>listen<SpeechCommand>('cmd',cb),onSpeechStatus:cb=>listen<SpeechStatus>('status',cb)
};
export const desktop=!!window.allhouse;
export const api:API=window.allhouse||fallback;
/** IPC errors arrive as "Error invoking remote method 'house:x': Error: message" — keep only the message. */
export const errorText=(e:unknown)=>(e instanceof Error?e.message:String(e)).replace(/^Error invoking remote method '[^']+':\s*/,'').replace(/^Error:\s*/,'');
