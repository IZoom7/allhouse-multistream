import React,{useId,useLayoutEffect,useRef,useState} from 'react';
import {Monitor} from 'lucide-react';
import type {AlertWidget,BannerWidget,ChatWidget,HouseEvent,Platform,Scene,WidgetId,Widgets,GiftWidget} from './types';
import {platformIcons} from './platformIcons';

/** React's SVG types omit `draggable`; the DOM attribute still works and stops icons being dragged out of the UI. */
const noDrag={draggable:false} as unknown as React.SVGProps<SVGSVGElement>;
export const platformNames:Record<Platform,string>={youtube:'YouTube',twitch:'Twitch',kick:'Kick',tiktok:'TikTok'};
/** Platform icon: Simple Icons glyph on its brand colour (see platformIcons.ts). */
export function PlatformMark({platform}:{platform:Platform}){const icon=platformIcons[platform];return <span className={'platform-mark '+platform} style={{background:icon.bg,color:icon.fg}} title={platformNames[platform]} aria-label={platformNames[platform]} role="img"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...noDrag}><path d={icon.path} fill="currentColor"/></svg></span>}
export function PageHeading({title,description,action}:{title:string;description:string;action?:React.ReactNode}){return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>}
export function Toggle({checked,onChange,label,disabled}:{checked:boolean;onChange:(v:boolean)=>void;label:string;disabled?:boolean}){const id=useId();return <div className="toggle-row"><label htmlFor={id}>{label}</label><button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} className={'toggle '+(checked?'on':'')} onClick={()=>onChange(!checked)}><span/></button></div>}
/** In-app copy of the OBS overlay (electron/runtime.cjs overlayDocument): same positions, pixel sizes (via --u) and TEST labels. */
export function OverlayPreview({scene,chat,alert}:{scene:Scene;chat?:HouseEvent;alert?:HouseEvent}){
  const style={'--scene-accent':scene.accent,'--u':`calc(100cqw / ${scene.width})`,aspectRatio:`${scene.width}/${scene.height}`} as React.CSSProperties;
  return <div className={'preview-checker '+(scene.height>scene.width?'portrait':'')}><div className={'overlay-preview '+scene.template} style={style}>
    <div className="overlay-brand"><strong>{scene.title}</strong><p>{scene.subtitle}</p></div>
    {scene.image&&<img className="overlay-image" src={scene.image} alt="" draggable={false}/>}
    <div className="preview-empty"><span>YOUR CONTENT GOES HERE</span><Monitor {...noDrag} aria-hidden={true}/></div>
    {scene.showAlert&&<div className="overlay-alert"><PlatformMark platform={alert?.platform||'twitch'}/><small>TEST ALERT · {platformNames[alert?.platform||'twitch']}</small><div>{alert?`${alert.name} — ${alert.message}`:'mintmint — just followed!'}</div></div>}
    {scene.showChat&&<div className="overlay-chat"><PlatformMark platform={chat?.platform||'twitch'}/><strong>{chat?.name||'mintmint'} · {platformNames[chat?.platform||'twitch']}<i className="tag">TEST CHAT</i></strong><p>{chat?.message||'สวัสดีทุกคน Welcome home 💚'}</p></div>}
  </div></div>
}

// ---- Per-widget preview: same DOM ids/classes as the OBS widget page (electron/runtime.cjs widgetDocument), so the
// structural CSS (.wp-stage rules in styles.css) and the user's custom CSS look the same here as on OBS.
type PreviewEvent=Pick<HouseEvent,'platform'|'name'|'message'>&Partial<Pick<HouseEvent,'type'|'gift'>>;
const rgba=(hex:string,a:number)=>`rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
const sampleFor=(kind:WidgetId):PreviewEvent=>kind==='gift'?{platform:'tiktok',name:'mintmint',message:'Rose ×5',gift:{name:'Rose',count:5,coins:1,image:''}}:({platform:'twitch',name:'mintmint',message:kind==='subscription'?'subscribed!':kind==='follow'?'followed!':'สวัสดีทุกคน Welcome home 💚'});
/** Same rule as the widget page: placeholders become text spans, nothing is parsed as HTML, values are never re-expanded. */
export function fillTemplateParts(template:string,v:PreviewEvent):React.ReactNode[]{
  return template.split(/(\{name\}|\{platform\}|\{message\}|\{gift\}|\{count\}|\{coins\})/).filter(Boolean).map((part,i)=>{
    const g=v.gift,val=part==='{name}'?v.name:part==='{platform}'?platformNames[v.platform]:part==='{message}'?v.message:part==='{gift}'?(g?.name??''):part==='{count}'?String(g?.count??1):part==='{coins}'?String((g?.coins??0)*(g?.count??1)):null;
    return val===null?<React.Fragment key={i}>{part}</React.Fragment>:<span key={i} className="ph">{val}</span>;
  });
}
/** Platform glyph sized like the widget page's img.pm. */
function Pm({platform}:{platform:Platform}){const icon=platformIcons[platform];return <span className="pm" style={{background:icon.bg,color:icon.fg}}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...noDrag}><path d={icon.path} fill="currentColor"/></svg></span>}
/**
 * User CSS for the preview: parsed by the browser (CSSStyleSheet) and re-serialised rule by rule inside
 * @scope(.wp-stage), so unbalanced braces or `body {}` rules can never escape and restyle the app itself.
 */
export function scopedUserCss(css:string):string{
  if(!css.trim())return '';
  try{const sheet=new CSSStyleSheet();sheet.replaceSync(css);const rules=[...sheet.cssRules].map(r=>r.cssText).join('\n');return rules?`@scope (.wp-stage) {\n${rules}\n}`:''}catch{return ''}
}
/** Scales a W×H canvas (real widget pixels) into its box, like OBS does with a Browser Source. */
function Canvas({width,height,children,className,vars}:{width:number;height:number;children:React.ReactNode;className?:string;vars:Record<string,string>}){
  const box=useRef<HTMLDivElement>(null),[scale,setScale]=useState(0);
  useLayoutEffect(()=>{const el=box.current;if(!el)return;const fit=()=>setScale(Math.min(el.clientWidth/width,el.clientHeight/height)||0);fit();
    if(typeof ResizeObserver==='undefined')return;const ro=new ResizeObserver(fit);ro.observe(el);return()=>ro.disconnect()},[width,height]);
  return <div ref={box} className="widget-preview-stage" aria-hidden="true"><div id="scene" className={'wp-scene'+(className?' '+className:'')} style={{width,height,transform:`scale(${scale})`,['--canvas-h' as string]:height+'px',...vars} as React.CSSProperties}>{children}</div></div>;
}
/**
 * Preview of one OBS widget at its own aspect ratio (checkerboard = transparent in OBS).
 * Props: widget = that widget's config, kind = widget id, event = latest sample (optional).
 */
export function WidgetPreview({widget,kind,event}:{widget:Widgets[WidgetId];kind:WidgetId;event?:PreviewEvent}){
  const ev=event&&(kind==='chat'?event.type==='chat'||!event.type:kind==='banner'?false:event.type===kind)?event:sampleFor(kind);
  const ratio={aspectRatio:`${widget.width} / ${widget.height}`,...(widget.height>widget.width?{width:'auto',height:'min(420px, 60vh)',maxWidth:'100%'}:{})} as React.CSSProperties;
  const userCss=widget.customCssEnabled?scopedUserCss(widget.customCss||''):'';
  let body:React.ReactNode;
  if(kind==='chat'){
    const c=widget as ChatWidget,rows=[ev,{platform:'youtube' as Platform,name:'บ้านข้างๆ',message:'ไลฟ์วันนี้สนุกมาก!'},{platform:'kick' as Platform,name:'guest',message:'hello 👋'}].slice(0,c.maxMessages).reverse();
    body=<Canvas width={c.width} height={c.height} vars={{'--accent':c.accent,'--text':c.textColor,'--bg':rgba('#101414',c.bgOpacity),'--fs':c.fontSize+'px'}}>
      <div id="box" className={c.newestAt==='top'?'top':undefined}>
        {rows.map((r,i)=><div key={i} className={'chat'+(c.animation==='none'||i!==rows.length-1?'':' anim-'+c.animation)}>
          {c.showPlatformIcon&&<Pm platform={r.platform}/>}<b>{r.name} · {platformNames[r.platform]}<i className="tag">TEST CHAT</i></b><span>{r.message}</span></div>)}
      </div></Canvas>;
  }else if(kind==='banner'){
    const b=widget as BannerWidget;
    body=<Canvas width={b.width} height={b.height} className={b.template} vars={{'--accent':b.accent}}>
      {b.enabled&&<div id="brand"><h1 id="title">{b.title}</h1><p id="subtitle">{b.subtitle}</p></div>}
      {b.enabled&&b.image&&<img id="art" src={b.image} alt="" draggable={false}/>}
    </Canvas>;
  }else{
    const a=widget as AlertWidget;
    body=<Canvas width={a.width} height={a.height} vars={{'--accent':a.accent,'--text':a.textColor,'--bg':rgba('#101414',a.bgOpacity),'--fs':a.fontSize+'px'}}>
      {a.enabled&&<div id="wrap"><div id="card" className={a.animation==='none'?undefined:'anim-'+a.animation}>
        {a.image&&<img className="art" src={a.image} alt="" draggable={false}/>}
        {kind==='gift'&&(widget as GiftWidget).showGiftImage&&<span className="gimg" title="TikTok gift picture">🎁</span>}
        <small><Pm platform={ev.platform}/>TEST ALERT · {platformNames[ev.platform]}</small>
        <div>{fillTemplateParts(a.template,ev)}</div>
      </div></div>}
    </Canvas>;
  }
  return <div className={'widget-preview'+(widget.height>widget.width?' tall':'')} style={ratio} data-widget={kind}>{userCss&&<style>{userCss}</style>}<div className="wp-stage" data-widget={kind}>{body}</div></div>;
}
