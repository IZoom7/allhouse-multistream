const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('allhouse', {
  getState:()=>ipcRenderer.invoke('house:state'),
  getHistory:()=>ipcRenderer.invoke('house:history'),
  getStatus:()=>ipcRenderer.invoke('house:status'),
  saveState:(state)=>ipcRenderer.invoke('house:save',state),
  sendEvent:(event)=>ipcRenderer.invoke('house:event',event),
  controlQueue:(action)=>ipcRenderer.invoke('house:queue',action),
  exportBackup:()=>ipcRenderer.invoke('house:export'),
  importBackup:()=>ipcRenderer.invoke('house:import'),
  copyText:(text)=>ipcRenderer.invoke('house:copy',text),
  openOverlay:()=>ipcRenderer.invoke('house:open-overlay'),
  openDocs:(page,lang)=>ipcRenderer.invoke('house:open-docs',String(page),lang==='en'?'en':'th'),
  openWidget:(id)=>ipcRenderer.invoke('house:open-widget',String(id)),
  listVoices:(options)=>ipcRenderer.invoke('house:voices',options&&options.refresh===true?{refresh:true}:undefined),
  onlineVoices:()=>ipcRenderer.invoke('house:online-voices'),
  synthesizeOnline:(text,options)=>ipcRenderer.invoke('house:speak-online',String(text),{voice:String(options&&options.voice||''),rate:Number(options&&options.rate),volume:Number(options&&options.volume)}),
  // Pop-out chat window + speech relay (speech always plays in the main window).
  openChatWindow:()=>ipcRenderer.invoke('house:open-chat-window'),
  getChatWindowState:()=>ipcRenderer.invoke('house:chat-window-state'),
  setChatWindowTop:(flag)=>ipcRenderer.invoke('house:chat-window-top',flag===true),
  sendSpeechCommand:(cmd)=>ipcRenderer.invoke('house:speech-command',cmd),
  reportSpeechStatus:(status)=>ipcRenderer.invoke('house:speech-status',status),
  onSpeechCommand:(cb)=>{const h=(_e,cmd)=>cb(cmd);ipcRenderer.on('house:speech-command',h);return()=>ipcRenderer.removeListener('house:speech-command',h)},
  onSpeechStatus:(cb)=>{const h=(_e,s)=>cb(s);ipcRenderer.on('house:speech-status',h);return()=>ipcRenderer.removeListener('house:speech-status',h)},
  // Kick official API: edit your stream info (the client secret is write-only from here)
  kickApi:{
    status:()=>ipcRenderer.invoke('house:kick-api-status'),
    setApp:(clientId,secret)=>ipcRenderer.invoke('house:kick-api-set-app',String(clientId||''),String(secret||'')),
    clear:()=>ipcRenderer.invoke('house:kick-api-clear'),
    login:()=>ipcRenderer.invoke('house:kick-api-login'),
    logout:()=>ipcRenderer.invoke('house:kick-api-logout'),
    channel:()=>ipcRenderer.invoke('house:kick-api-channel'),
    categories:(q)=>ipcRenderer.invoke('house:kick-api-categories',String(q||'')),
    update:(input)=>ipcRenderer.invoke('house:kick-api-update',input),
  },
  // Live platform connections
  getConnections:()=>ipcRenderer.invoke('house:connections'),
  connectPlatform:(platform,channel)=>ipcRenderer.invoke('house:connect',String(platform),String(channel||'')),
  disconnectPlatform:(platform)=>ipcRenderer.invoke('house:disconnect',String(platform)),
  onConnections:(cb)=>{const h=(_e,s)=>cb(s);ipcRenderer.on('house:connections',h);return()=>ipcRenderer.removeListener('house:connections',h)},
  onLiveEvent:(cb)=>{const h=(_e,e)=>cb(e);ipcRenderer.on('house:live-event',h);return()=>ipcRenderer.removeListener('house:live-event',h)},
  synthesize:(text,options)=>ipcRenderer.invoke('house:speak',String(text),{voice:String(options&&options.voice||''),rate:Number(options&&options.rate),volume:Number(options&&options.volume)})
});
