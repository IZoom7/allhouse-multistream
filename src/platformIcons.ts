// Platform glyphs from Simple Icons 16.34.0 (CC0-1.0, https://simpleicons.org), vendored in src/assets/platforms/.
// Brand colours are the Simple Icons hex values. Trademarks belong to their owners; see README "Credits".
import type {Platform} from './types';
import twitch from './assets/platforms/twitch.svg?raw';
import youtube from './assets/platforms/youtube.svg?raw';
import kick from './assets/platforms/kick.svg?raw';
import tiktok from './assets/platforms/tiktok.svg?raw';
const pathOf=(svg:string)=>{const d=/\sd="([^"]+)"/.exec(svg)?.[1]||'';return /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/.test(d)?d:''};
/** bg = brand colour (Simple Icons hex), fg = glyph colour chosen for contrast on that background. */
export const platformIcons:Record<Platform,{path:string;bg:string;fg:string}>={
  twitch:{path:pathOf(twitch),bg:'#9146FF',fg:'#FFFFFF'},
  youtube:{path:pathOf(youtube),bg:'#FF0000',fg:'#FFFFFF'},
  kick:{path:pathOf(kick),bg:'#53FC19',fg:'#0B1A03'},
  tiktok:{path:pathOf(tiktok),bg:'#000000',fg:'#FFFFFF'},
};
