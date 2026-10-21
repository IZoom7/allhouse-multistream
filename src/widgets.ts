// Widget helpers (docs/WIDGETS-CONTRACT.md). Implemented in api.ts so the browser fallback stays a single
// self-contained module (tests load it in a VM without require); re-exported here for the UI.
export {WIDGET_IDS,ANIMS,MAX_ASSET_CHARS,MAX_SOUND_BYTES,MAX_IMAGE_BYTES,MAX_STATE_BYTES,defaultWidgets,widgetsFromScene,sceneFromWidgets,migrateState,chatOk,alertOk,bannerOk,widgetsOk,normaliseDataUrl,fillTemplate,stateBytes} from './api';
