# Widgets contract (round 4) — shared by Dev A / B / C

Goal: instead of one all-in-one overlay, every element is its own OBS Browser Source with its own URL,
size and settings. The streamer adds each one to OBS and drags/resizes it there.
Each widget page is a **large, transparent canvas** (OBS scales it down cleanly).

## Widgets (ids are fixed)

| id | What it shows | Default size |
|---|---|---|
| `chat` | Rolling chat box | 800 × 1080 |
| `follow` | Follow alert | 1920 × 1080 (alert centred, big) |
| `subscription` | Subscription/member alert | 1920 × 1080 |
| `banner` | Title/subtitle/image (the old "scene" brand block) | 1920 × 1080 |

The old all-in-one `/overlay/<token>` keeps working (it's still a legacy "all in one" option, shown last in the UI).

## Types (TypeScript; runtime.cjs validates the same thing)

```ts
type WidgetBase = { enabled:boolean; width:number; height:number };   // width 320–3840, height 320–2160, integers
type Anim = 'fade'|'slide'|'pop'|'none';

type ChatWidget = WidgetBase & {
  fontSize:number;            // 14–72 px
  maxMessages:number;         // 1–20
  lifetimeSec:number;         // 0 (never hide) or 5–600
  showPlatformIcon:boolean;
  bgOpacity:number;           // 0–1 (bubble background)
  accent:string; textColor:string; // #rrggbb
  newestAt:'bottom'|'top';
  animation:Anim;
};

type AlertWidget = WidgetBase & {
  durationSec:number;         // 2–30
  template:string;            // ≤ 120 chars, placeholders {name} {platform} {message}
  fontSize:number;            // 20–160 px
  accent:string; textColor:string;
  bgOpacity:number;           // 0–1
  animation:Anim;
  image:string;               // '' or data:image/(png|jpeg|webp|gif);base64,…  ≤ 4 MB encoded (gif allowed for animated alerts)
  sound:string;               // '' or data:audio/(mpeg|wav|ogg|webm);base64,… ≤ 4 MB encoded
  soundName:string;           // original filename for display, ≤ 120 chars
  volume:number;              // 0–1
  readMessageTts?:never;      // not in this round
};

type BannerWidget = WidgetBase & { title:string; subtitle:string; accent:string; template:'studio'|'minimal'|'neon'; image:string };

type Widgets = { chat:ChatWidget; follow:AlertWidget; subscription:AlertWidget; banner:BannerWidget };
```

`State` becomes `schemaVersion: 2` with `draftWidgets: Widgets`, `publishedWidgets: Widgets`, `widgetsPublishedAt: string|null`.
Migration from v1 (runtime.cjs, also accepted on import): banner ← old scene title/subtitle/accent/template/image;
chat.accent/follow.accent/subscription.accent ← scene.accent; chat.enabled ← showChat; follow/subscription.enabled ← showAlert.
Keep the old `draft`/`published` scene fields so the legacy overlay still works (derive from widgets on save is fine).
Defaults: follow template `"{name} followed!"` / TH UI may show it; subscription `"{name} subscribed!"`; durationSec 6; animation 'pop'; volume 0.8.
Workspace file size: reject state > 25 MB.

## HTTP (runtime.cjs, loopback only, same Host/Origin/token rules as today)

- `GET /w/<token>/<id>` → widget HTML page (transparent, CSP nonce like the overlay; `user-select:none`).
- `GET /events/<token>?w=<id>` → SSE. Sends `state` (that widget's **published** config only), and `chat` / `alert` events as today.
  Alert events go only to the matching widget (follow → `follow`, subscription → `subscription`); legacy overlay still gets everything.
- Alert pages play `sound` at `volume` when an alert shows (OBS: tick "Control audio via OBS" to hear it in the stream).
- Status: `getStatus()` adds `widgetUrls: Record<id,string>` and `widgetClients: Record<id,number>`.
- Test: existing `sendEvent` with target 'obs' covers chat/follow/subscription. `delivery` must reflect the matching widget (enabled, published, page open).

## UI (main.tsx)

New page/section "วิดเจ็ต OBS / OBS widgets": a card per widget with: on/off, its own URL + Copy, W×H shown big ("ตั้งใน OBS: กว้าง 800 สูง 1080"), "ส่งทดสอบ" button, and an editor
(all fields above; image upload; **sound upload** with play/stop audition in the app, file name, remove, volume; template with placeholder hint + live preview).
Draft vs Publish stays: one "เผยแพร่" publishes all widgets. Preview of each widget at its own aspect ratio.
