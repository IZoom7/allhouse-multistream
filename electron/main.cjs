const {app,BrowserWindow,ipcMain,dialog,clipboard,shell,net,safeStorage}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {createRuntime}=require('./runtime.cjs');
const speech=require('./speech.cjs');
const edgeTts=require('./edgeTts.cjs');
const {createConnections}=require('./connections.cjs');
const {createKickApi}=require('./kickApi.cjs');
const {createAvatars,within}=require('./avatars.cjs');
const {isTrustedSender,validateSpeechCommand,validateSpeechStatus,sanitizeBounds,hardenWindow,CHAT_WINDOW_HASH}=require('./windows.cjs');
let runtime,win,chatWin=null,quitting=false,connections=null;
const webPreferences=()=>({preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true});
const brandIcon=path.join(__dirname,'../public/brand/allhouse.ico');
if(process.env.ALLHOUSE_DATA_DIR)app.setPath('userData',path.resolve(process.env.ALLHOUSE_DATA_DIR));
const gotLock=app.requestSingleInstanceLock();
if(!gotLock)app.quit();
else {
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
app.whenReady().then(async()=>{
  runtime=await createRuntime({dataDir:app.getPath('userData'),port:19324});
  const invoke=(name,fn,{mainOnly=false}={})=>ipcMain.handle('house:'+name,async(event,...args)=>{
    // Trusted: the main frame of the main window or of the pop-out chat window (both load our own dist/index.html).
    if(!isTrustedSender(event,mainOnly?[win]:[win,chatWin]))throw new Error('Unauthorized sender');
    return fn(...args);
  });
  invoke('state',()=>runtime.getState());invoke('history',()=>runtime.getHistory());invoke('status',()=>runtime.getStatus());
  invoke('save',s=>runtime.saveState(s));invoke('event',e=>runtime.sendEvent(e));invoke('queue',a=>runtime.controlQueue(a));
  invoke('copy',text=>{if(typeof text!=='string'||text.length>20000)throw new Error('Invalid text');clipboard.writeText(text);return true});
  invoke('voices',options=>speech.listVoices({refresh:!!(options&&options.refresh===true)}));
  invoke('speak',(text,options)=>speech.speak(text,options));
  invoke('online-voices',()=>edgeTts.listVoices());
  // Text is only ever sent to Microsoft when the saved workspace has the online engine selected.
  invoke('speak-online',(text,options)=>{if(runtime.getState().tts.engine!=='online')throw new Error('Online voices are not selected. Choose "Online neural voices" on the Chat TTS page first.');return edgeTts.synthesize(text,options)});
  // ---- Live platform connections (unofficial readers for YouTube/Kick, anonymous Twitch IRC, TikFinity for TikTok).
  // net.fetch uses Chromium's network stack, which kick.com's Cloudflare accepts (plain Node fetch gets 403).
  const toWindows=(channel,data)=>{for(const w of [win,chatWin])if(w&&!w.isDestroyed())w.webContents.send(channel,data)};
  const avatars=createAvatars({fetch:(u,o)=>net.fetch(u,o)}),chains={};
  connections=createConnections({dataDir:app.getPath('userData'),fetch:(u,o)=>net.fetch(u,o),
    // Twitch/Kick chat: look up the viewer's picture first (cached; at most 700 ms for a new viewer). One chain per
    // platform keeps messages in their original order.
    onEvent:e=>{const id=e.platform==='twitch'?e.login:e.platform==='kick'?e.slug:'';
      chains[e.platform]=(chains[e.platform]||Promise.resolve()).then(async()=>{if(e.type==='chat'&&id&&!e.avatar){const url=await within(avatars.get(e.platform,id),700);if(url)e.avatar=url}
        const ev=runtime.ingestLive(e);if(ev)toWindows('house:live-event',ev)}).catch(()=>{})},
    onChange:s=>toWindows('house:connections',s)});
  invoke('connections',()=>connections.get());
  // ---- Kick official API (edit stream info). Secret + tokens stay in the main process, encrypted with safeStorage.
  const kick=createKickApi({dataDir:app.getPath('userData'),fetch:(u,o)=>net.fetch(u,o),safeStorage,openExternal:u=>shell.openExternal(u)});
  await kick.load();
  invoke('kick-api-status',()=>kick.status(),{mainOnly:true});
  invoke('kick-api-set-app',(id,secret)=>kick.setApp(id,secret),{mainOnly:true});
  invoke('kick-api-clear',()=>kick.clear(),{mainOnly:true});
  invoke('kick-api-login',()=>kick.login(),{mainOnly:true});
  invoke('kick-api-logout',()=>kick.logout(),{mainOnly:true});
  invoke('kick-api-channel',()=>kick.channel(),{mainOnly:true});
  invoke('kick-api-categories',q=>kick.categories(q),{mainOnly:true});
  invoke('kick-api-update',input=>kick.update(input),{mainOnly:true});
  invoke('connect',(platform,channel)=>connections.connect(platform,channel),{mainOnly:true});
  invoke('disconnect',platform=>connections.disconnect(platform),{mainOnly:true});
  // Local user manual (docs-site/*.html) opened in the default browser. Only known page names; the renderer never supplies a path.
  // 'index' is the manual's home (manual.html; docs-site/index.html is the public landing page). lang picks Thai/English.
  const DOC_PAGES=['index','start','connections','obs-widgets','chat-tts','custom-css','help'];
  invoke('open-docs',async(page,lang)=>{
    if(!DOC_PAGES.includes(page))throw new Error('Unknown manual page');
    const file=path.join(__dirname,'..','docs-site',(page==='index'?'manual':page)+'.html');
    try{await fs.access(file)}catch{throw new Error('The manual files are missing (docs-site folder).')}
    const url=require('node:url').pathToFileURL(file);url.search='lang='+(lang==='en'?'en':'th');
    return shell.openExternal(url.href);
  });
  invoke('open-overlay',()=>shell.openExternal(runtime.url));
  // Opens only a URL the runtime itself issued for a known widget id (never a renderer-supplied URL).
  invoke('open-widget',id=>{if(!['chat','follow','subscription','banner'].includes(id))throw new Error('Unknown widget');const url=(runtime.getStatus().widgetUrls||{})[id];if(typeof url!=='string'||!url.startsWith('http://127.0.0.1:'))throw new Error('This widget link is not available yet.');return shell.openExternal(url)});
  // ---- Pop-out chat window (portrait, reading only). Speech always plays in the main window.
  const indexFile=path.join(__dirname,'../dist/index.html');
  const chatPrefsFile=path.join(app.getPath('userData'),'chat-window.json');
  let chatPrefs={};try{chatPrefs=JSON.parse(await fs.readFile(chatPrefsFile,'utf8'))||{}}catch{}
  const saveChatPrefs=()=>{if(!chatWin||chatWin.isDestroyed())return;const b=chatWin.getBounds();chatPrefs={x:b.x,y:b.y,width:b.width,height:b.height,top:chatWin.isAlwaysOnTop()};fs.writeFile(chatPrefsFile,JSON.stringify(chatPrefs)).catch(()=>{})};
  const chatState=()=>({open:!!chatWin&&!chatWin.isDestroyed(),top:!!chatWin&&!chatWin.isDestroyed()&&chatWin.isAlwaysOnTop()});
  invoke('open-chat-window',async()=>{
    if(chatWin&&!chatWin.isDestroyed()){if(chatWin.isMinimized())chatWin.restore();chatWin.focus();return chatState()}
    chatWin=new BrowserWindow({...sanitizeBounds(chatPrefs),minWidth:320,minHeight:480,title:'Allhouse — แชท / Chat',icon:brandIcon,backgroundColor:'#101214',autoHideMenuBar:true,alwaysOnTop:chatPrefs.top===true,webPreferences:webPreferences()});
    hardenWindow(chatWin);
    let saveTimer;const later=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(saveChatPrefs,400)};
    chatWin.on('resize',later);chatWin.on('move',later);chatWin.on('close',saveChatPrefs);chatWin.on('closed',()=>{chatWin=null});
    await chatWin.loadFile(indexFile,{hash:CHAT_WINDOW_HASH});
    return chatState();
  });
  invoke('chat-window-state',()=>chatState());
  invoke('chat-window-top',flag=>{if(typeof flag!=='boolean')throw new Error('Invalid value');if(chatWin&&!chatWin.isDestroyed()){chatWin.setAlwaysOnTop(flag);saveChatPrefs()}return chatState()});
  // Pop-out → main window: stop / skip / settings changes. Only the main window plays speech and writes state.
  invoke('speech-command',input=>{const cmd=validateSpeechCommand(input);if(!win||win.isDestroyed())throw new Error('The main window is closed');win.webContents.send('house:speech-command',cmd);if(cmd.cmd==='open-settings'){if(win.isMinimized())win.restore();win.focus()}return true});
  // Main window → pop-out: what is being read right now. Accepted only from the main window.
  invoke('speech-status',status=>{const s=validateSpeechStatus(status);if(chatWin&&!chatWin.isDestroyed())chatWin.webContents.send('house:speech-status',s);return true},{mainOnly:true});
  invoke('export',async()=>{const r=await dialog.showSaveDialog(win,{defaultPath:'Allhouse-backup.json',filters:[{name:'Allhouse backup',extensions:['json']}]});if(r.canceled)return false;const state=runtime.getState();state.history=[];await fs.writeFile(r.filePath,JSON.stringify(state,null,2));return true});
  invoke('import',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Allhouse backup',extensions:['json']}]});if(r.canceled)return null;const p=r.filePaths[0];if((await fs.stat(p)).size>10000000)throw new Error('Backup exceeds 10 MB');const data=JSON.parse(await fs.readFile(p,'utf8'));return runtime.importState(data)});
  win=new BrowserWindow({width:1440,height:960,minWidth:800,minHeight:600,title:'Allhouse',icon:brandIcon,backgroundColor:'#101214',autoHideMenuBar:true,webPreferences:webPreferences()});
  hardenWindow(win);
  win.on('closed',()=>{win=null;if(chatWin&&!chatWin.isDestroyed())chatWin.close()}); // the pop-out never outlives the app window
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  try{await fs.access(indexFile)}catch{throw new Error('The interface has not been built yet (dist/index.html is missing). Run scripts\\start.ps1, which builds it first.')}
  if(process.env.ALLHOUSE_DEBUG_LOG){
    // Developer diagnostics only: mirror renderer console output and load failures to a log file.
    const log=line=>fs.appendFile(path.resolve(process.env.ALLHOUSE_DEBUG_LOG),new Date().toISOString()+' '+line+'\n').catch(()=>{});
    win.webContents.on('console-message',(event,level,message)=>log('[renderer:'+(event.level??level)+'] '+(event.message??message)));
    win.webContents.on('did-fail-load',(_e,code,desc)=>log('[load-failed] '+code+' '+desc));
    win.webContents.on('render-process-gone',(_e,d)=>log('[renderer-gone] '+d.reason));
    if(process.env.ALLHOUSE_DEBUG_ONLINE_TTS){const out=process.env.ALLHOUSE_DEBUG_ONLINE_TTS;edgeTts.synthesize('สวัสดีครับ ยินดีต้อนรับสู่ Allhouse',{voice:'th-TH-PremwadeeNeural',rate:1,volume:1}).then(async u=>{const b=Buffer.from(u.split(',')[1],'base64');await fs.writeFile(path.resolve(out),b);log('[online-tts] ok bytes='+b.length+' head='+b.subarray(0,2).toString('hex'))}).catch(e=>log('[online-tts] error '+e.message))}
    win.webContents.on('did-finish-load',()=>{log('[loaded]');setTimeout(async()=>{try{log('[probe] '+await win.webContents.executeJavaScript('JSON.stringify({shell:!!document.querySelector(".app-shell"),fonts:document.fonts.status,title:document.querySelector("h1")?.textContent,ttsStat:document.querySelectorAll(".stat")[2]?.innerText,styled:getComputedStyle(document.body).fontFamily})'));if(process.env.ALLHOUSE_DEBUG_SPEECH)log('[speech] '+await win.webContents.executeJavaScript('window.allhouse.listVoices().then(async v=>{const wav=v.length?await window.allhouse.synthesize("Hello from Allhouse",{voice:v[0].name,rate:1,volume:1}):"";let bad="";try{await window.allhouse.synthesize("",{voice:"x"})}catch(e){bad=e.message}return JSON.stringify({voices:v,wavBytes:wav.length,wavOk:wav.startsWith("data:audio/wav;base64,"),rejectsEmpty:bad})})'));if(process.env.ALLHOUSE_DEBUG_CAPTURE){const img=await win.webContents.capturePage();await fs.writeFile(path.resolve(process.env.ALLHOUSE_DEBUG_CAPTURE),img.toPNG());log('[captured]')}}catch(e){log('[probe-error] '+e.message)}},4000)});
  }
  await win.loadFile(indexFile);
  await connections.init();
}).catch(error=>{dialog.showErrorBox('Allhouse could not start',error.code==='EADDRINUSE'?'Port 19324 is already in use. Close the other Allhouse instance and try again.':error.message);app.quit()});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',event=>{if(runtime&&!quitting){event.preventDefault();quitting=true;if(connections)connections.closeAll();runtime.close().finally(()=>app.quit())}});
}
