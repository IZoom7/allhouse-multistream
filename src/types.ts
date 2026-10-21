export type Platform = 'youtube'|'twitch'|'kick'|'tiktok';
/** Legacy all-in-one overlay scene (v1). Kept in v2 and derived from the widgets so /overlay/<token> still works. */
export type Scene = {title:string;subtitle:string;accent:string;template:'studio'|'minimal'|'neon';showChat:boolean;showAlert:boolean;width:number;height:number;image:string};
/** sendEvent's verdict (runtime.cjs): which widget, how many pages, and why it will or won't show. */
export type Delivery = {widget?:WidgetId|null;overlays:number;widgetPages?:number;legacyPages?:number;delivered:boolean;reason:string};
export type HouseEvent = {id:string;platform:Platform;type:'chat'|'follow'|'subscription'|'gift';name:string;message:string;target:'preview'|'obs';createdAt:string;status:string;sourceMode:'test'|'live';delivery?:Delivery;gift?:GiftInfo}
/** TikTok gift details (live gifts; image is a TikTok CDN URL shown only on the OBS gift widget). */
export type GiftInfo = {name:string;count:number;coins:number;image:string};

// ---- Widgets (docs/WIDGETS-CONTRACT.md, round 4) ----
export type WidgetId = 'chat'|'follow'|'subscription'|'gift'|'banner';
export type Anim = 'fade'|'slide'|'pop'|'none';
/** customCss* (round 7): optional user CSS applied on the OBS widget page when switched on. */
export type WidgetBase = {enabled:boolean;width:number;height:number;customCssEnabled?:boolean;customCss?:string};
export type ChatWidget = WidgetBase & {fontSize:number;maxMessages:number;lifetimeSec:number;showPlatformIcon:boolean;bgOpacity:number;accent:string;textColor:string;newestAt:'bottom'|'top';animation:Anim};
export type AlertWidget = WidgetBase & {durationSec:number;template:string;fontSize:number;accent:string;textColor:string;bgOpacity:number;animation:Anim;image:string;sound:string;soundName:string;volume:number};
export type BannerWidget = WidgetBase & {title:string;subtitle:string;accent:string;template:'studio'|'minimal'|'neon';image:string};
/** Gift alert (round 6): an alert plus a minimum-coins filter and the TikTok gift picture. */
export type GiftWidget = AlertWidget & {minCoins:number;showGiftImage:boolean};
export type Widgets = {chat:ChatWidget;follow:AlertWidget;subscription:AlertWidget;gift:GiftWidget;banner:BannerWidget};

/** Chat reading rules (round 9). Optional: older workspaces use DEFAULT_TTS_RULES (ttsRules.ts). */
export type TtsRules = {platforms:Record<Platform,boolean>;readName:boolean;skipCommands:boolean;ignoreNames:string;maxChars:number};
export type TtsSettings = {enabled:boolean;rate:number;volume:number;thaiVoice:string;englishVoice:string;engine?:'windows'|'online';onlineThaiVoice?:string;onlineEnglishVoice?:string;rules?:TtsRules};
export type State = {schemaVersion:2;workspaceName:string;language:'th'|'en';theme:'dark'|'light'|'system';onboarded:boolean;
  draftWidgets:Widgets;publishedWidgets:Widgets;widgetsPublishedAt:string|null;
  /** From an import: the backup's published widgets when they differed from its draft (offered as "load into draft"). */
  importedPublishedWidgets?:Widgets;
  draft:Scene;published:Scene;importedPublished?:Scene;publishedAt:string|null;
  tts:TtsSettings;history:HouseEvent[]};
/** What older builds stored; accepted on load/import and migrated (src/widgets.ts, runtime.cjs). */
export type StateV1 = Omit<State,'schemaVersion'|'draftWidgets'|'publishedWidgets'|'widgetsPublishedAt'|'importedPublishedWidgets'> & {schemaVersion:1};
export type Status = {url:string;clients:number;paused:boolean;muted:boolean;storageWarning:string;queue:number;widgetUrls?:Partial<Record<WidgetId,string>>;widgetClients?:Partial<Record<WidgetId,number>>};
/** Pop-out → main window speech control. The main window is the only player and the only writer of TTS settings. */
export type SpeechCommand = {cmd:'stop'}|{cmd:'skip'}|{cmd:'open-settings'}|{cmd:'set';patch:Partial<Pick<TtsSettings,'enabled'|'volume'|'rate'>>&{platforms?:Record<Platform,boolean>}};
/** Main window → pop-out: what the player is doing. */
export type SpeechStatus = {speaking:boolean;enabled:boolean;volume:number;rate:number;pending:number;engine:'windows'|'online';platforms?:Record<Platform,boolean>};
export type ChatWindowState = {open:boolean;top:boolean};
export type QueueAction = 'pause'|'resume'|'skip'|'clear'|'mute'|'unmute'|'clearHistory';
export type ConnectionInfo = {channel:string;enabled:boolean;state:'off'|'connecting'|'connected'|'retrying'|'error'|'stopped';detail:string;events:number};
export type Connections = Record<Platform,ConnectionInfo>;
export type DocPage = 'index'|'start'|'connections'|'obs-widgets'|'chat-tts'|'custom-css'|'help';
export type API = {openDocs?(page:DocPage):Promise<unknown>;getConnections?():Promise<Connections>;connectPlatform?(platform:Platform,channel:string):Promise<Connections>;disconnectPlatform?(platform:Platform):Promise<Connections>;onConnections?(cb:(c:Connections)=>void):()=>void;onLiveEvent?(cb:(e:HouseEvent)=>void):()=>void;getState():Promise<State>;getHistory?():Promise<HouseEvent[]>;getStatus():Promise<Status>;saveState(s:State):Promise<State>;sendEvent(e:Pick<HouseEvent,'platform'|'type'|'name'|'message'|'target'>):Promise<HouseEvent>;controlQueue(a:QueueAction):Promise<Status>;exportBackup():Promise<boolean>;importBackup():Promise<State|null>;copyText(t:string):Promise<boolean>;openOverlay():Promise<unknown>;openWidget?(id:WidgetId):Promise<unknown>;listVoices?(options?:{refresh?:boolean}):Promise<{name:string;lang:string}[]>;onlineVoices?():Promise<{name:string;lang:string;label:string}[]>;synthesizeOnline?(text:string,options:{voice:string;rate:number;volume:number}):Promise<string>;synthesize?(text:string,options:{voice:string;rate:number;volume:number}):Promise<string>;
  openChatWindow?():Promise<ChatWindowState|unknown>;getChatWindowState?():Promise<ChatWindowState>;setChatWindowTop?(flag:boolean):Promise<ChatWindowState>;
  sendSpeechCommand?(cmd:SpeechCommand):Promise<unknown>;reportSpeechStatus?(s:SpeechStatus):Promise<unknown>;
  onSpeechCommand?(cb:(cmd:SpeechCommand)=>void):()=>void;onSpeechStatus?(cb:(s:SpeechStatus)=>void):()=>void};
declare global { interface Window {allhouse?:API} }
