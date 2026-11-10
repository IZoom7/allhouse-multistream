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
import facebook from './assets/platforms/facebook.svg?raw';
import instagram from './assets/platforms/instagram.svg?raw';
import x from './assets/platforms/x.svg?raw';
import threads from './assets/platforms/threads.svg?raw';
import discord from './assets/platforms/discord.svg?raw';
import line from './assets/platforms/line.svg?raw';
import github from './assets/platforms/github.svg?raw';
import spotify from './assets/platforms/spotify.svg?raw';
import patreon from './assets/platforms/patreon.svg?raw';
import type {SocialNetwork} from './types';
/** Streaming platforms plus the social networks the Social Media Rotator widget can show (same tiles as runtime.cjs PLATFORM_TILES). */
export const socialIcons:Record<SocialNetwork,{path:string;bg:string;fg:string}>={...platformIcons,
  facebook:{path:pathOf(facebook),bg:'#0866FF',fg:'#FFFFFF'},instagram:{path:pathOf(instagram),bg:'#FF0069',fg:'#FFFFFF'},x:{path:pathOf(x),bg:'#000000',fg:'#FFFFFF'},
  threads:{path:pathOf(threads),bg:'#000000',fg:'#FFFFFF'},discord:{path:pathOf(discord),bg:'#5865F2',fg:'#FFFFFF'},line:{path:pathOf(line),bg:'#00C300',fg:'#FFFFFF'},
  github:{path:pathOf(github),bg:'#181717',fg:'#FFFFFF'},spotify:{path:pathOf(spotify),bg:'#1ED760',fg:'#000000'},patreon:{path:pathOf(patreon),bg:'#000000',fg:'#FFFFFF'}};
export const socialNames:Record<SocialNetwork,string>={youtube:'YouTube',twitch:'Twitch',kick:'Kick',tiktok:'TikTok',facebook:'Facebook',instagram:'Instagram',x:'X',threads:'Threads',discord:'Discord',line:'LINE',github:'GitHub',spotify:'Spotify',patreon:'Patreon'};
