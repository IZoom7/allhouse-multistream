# Allhouse — development log

## Dev log — round 1 (2026-10-20, Super Dev)

Goal: make the 0.1.0 local alpha build, launch and be usable.

### Build blockers fixed
- **`src/styles.css` created** (was missing → `vite build` failed). Covers every class used in the UI; APPINFO §9 tokens for dark + light via `html[data-theme]`; Noto Sans Thai / Noto Sans with 1.6 line-height; 8 px controls / 12 px cards; visible `:focus-visible` rings; `prefers-reduced-motion` honoured; sidebar becomes a drawer (menu button + backdrop, Esc closes) below 1024 px and the layout stacks at ≤880 px, so 800 px (Electron minWidth) has no horizontal scroll. The overlay preview uses container units so it scales like the real OBS overlay (same positions and pixel sizes as `runtime.cjs`).

### Speech (Windows voices) wired
- `electron/preload.cjs`: added `listVoices`, `synthesize`, `getHistory`.
- `electron/main.cjs`: `house:voices`, `house:speak`, `house:history` handlers, all behind the existing sender/main-frame check.
- `electron/speech.cjs`: new `validateSpeakRequest` (text 1–500 chars, voice a non-empty string ≤200 chars with no control chars, rate/volume clamped); PowerShell calls serialised (one at a time); voice list cached (refreshable).
- Verified in the running app: the bridge lists 2 installed voices, returns a valid 118 KB `data:audio/wav` and rejects empty text.

### Bugs fixed in the UI (`src/main.tsx`, `src/api.ts`)
- Saving: debounced (300 ms) and always saves the *latest* state, so a stale closure (e.g. image upload finishing after a title edit) can no longer overwrite newer edits; top bar shows "Saving… / Not saved" honestly instead of always "Saved locally".
- Speech: voices read through a ref (stale-closure fix); when a language has no voice, that part is skipped with a clear message instead of aborting the whole message; errors clear the pending speech queue; global **Stop speech** button in the top bar while speaking; "Refresh voices" + voice count; Windows voices labelled.
- Quick sample from Overview no longer fails if the Activity message box was emptied; spoken text = the stored (trimmed) message.
- Workspace name field can be cleared while typing (previously un-deletable last character); empty name shows an inline error and keeps the old name.
- Theme: "System" follows OS changes live; sidebar theme button toggles from the *effective* theme.
- Image upload: input is focusable (visually hidden, focus ring on the label), re-selecting the same file works, read errors reported.
- IPC error messages stripped of "Error invoking remote method…" prefix.
- Polling now fetches only status + history (not the full state with images) every 1.2 s.
- Browser fallback (`api.ts`): `skip` implemented; same 5 s alert lifecycle as the runtime; input validation; storage-full warning instead of a crash.
- Runtime: `skip` while paused / with nothing playing now skips the next queued alert (was a no-op); added `getHistory()`.
- Honesty: OBS panel says "Overlay pages open: N" (not "viewers"), with "an open overlay page does not mean you are live"; the hero illustration chat and the preview chat are labelled as sample.
- Components moved to `src/components.tsx` (PlatformMark, PageHeading, Toggle with a real `<label for>`, OverlayPreview).

### Tooling / docs
- `scripts/start.ps1` (finds Node on PATH → common folders → Adobe bundled node; `-SkipBuild`, `-BuildOnly`, `-Test`) and `Start Allhouse.cmd` for double-click launch.
- `package.json`: `test` and `app` scripts.
- `README.md` (Thai + English): how to run, what the alpha does / doesn't do, dev env vars.
- Debug-only env vars in `main.cjs`: `ALLHOUSE_DEBUG_LOG`, `ALLHOUSE_DEBUG_CAPTURE`, `ALLHOUSE_DEBUG_SPEECH`. Clear error if `dist/index.html` is missing.
- `.claude/launch.json`: `vite preview` config for browser-pane UI checks.

### Tests
- `tests/runtime.test.cjs`: 12 → 15 tests (skip-while-paused + `getHistory` copy, speech request validation, every preload channel has a main-process handler).

### Verification
- `tsc -b`: clean. `vite build`: OK (dist/). `node --test tests/runtime.test.cjs`: 15/15 pass. `scripts/start.ps1 -Test` / `-BuildOnly`: OK.
- `electron.exe .` with `ALLHOUSE_DATA_DIR` in the scratchpad: window renders (`.app-shell` present, fonts loaded, Thai heading), `GET /overlay/<token>` → 200 overlay HTML, `/events/<token>` streams the published state, bad token → 404. Process killed afterwards.
- Browser preview at 820 px and 1280 px, dark + light: drawer, overlay studio, activity queue (pause → 2 queued → skip → 1) and speech page checked.

### Not done / known limits
- Not tested: real OBS Browser Source, actual audio output through speakers (WAV generation only), Thai voice playback (this PC has no Thai voice), import/export dialogs, display scaling 125–200 %.
- Chromium web voices and Windows SAPI voices can appear twice under different names (e.g. "Microsoft David – English" and "Microsoft David Desktop · Windows").
- No packaging/installer run (`npm run package` untouched).

## Dev log — round 2 (2026-10-20, Super Dev)

Input: `tests/QA-REPORT.md` (Round 1) and `UX_REVIEW.md` "Round 1 — Hands-on review".

### QA bugs (`electron/runtime.cjs` unless noted)
| Bug | Fix |
|---|---|
| BUG-1 OBS chat unlabelled | Overlay chat rows now carry a yellow **TEST CHAT** tag (same idea as `TEST ALERT`). |
| BUG-9 corrupt workspace destroyed | On load, an unreadable `workspace.json` is first copied to `workspace.corrupt-<timestamp>.json` (exclusive copy), before any write can happen. Warning now says exactly that and names the file. |
| BUG-2 skip wipes OBS chat | Skip/clear send a new `hide-alert` SSE event (alert only); only "Clear history" sends `clear`. |
| BUG-3 app-only alerts delay OBS | Two independent 5 s lanes (`obs`, `preview`); pause/skip/clear apply to both, skip prefers the playing OBS alert. |
| BUG-4 draft saves rebroadcast | `state` is broadcast only when `published` actually changes. |
| BUG-5 import goes live | Import lands as the **draft**; published layout and `publishedAt` are kept until the user presses Publish. Confirm text and toast say so (`src/main.tsx`). |
| BUG-6 "(imported)" stacks | Existing suffixes are stripped before appending one. |
| BUG-7 unknown history fields kept | New `cleanHistoryEntry()` rebuilds entries from known fields only (exported). |
| BUG-8 full queue blocks chat | Queue-full check applies to follow/sub only. |
| BUG-10 toast covers toggle | Toast moved to top-centre under the top bar (`src/styles.css`). |
| BUG-11 duplicate voices | Web and Windows voices are de-duplicated by a normalised key (language + name without "Microsoft", "Desktop", "- English (…)") — desktop now shows 3 voices instead of 5. |
| BUG-12 preview ≠ overlay alert | `OverlayPreview` shows `TEST ALERT · PLATFORM` / `name — message` from the latest real sample alert, and the chat row shows `TEST CHAT`, matching the overlay. |
| BUG-13 test script | `package.json` `test` = `node --test "tests/*.test.cjs"`; `scripts/start.ps1 -Test` runs the same. |

The 9 `todo` tests in `tests/qa.test.cjs` are now real tests (flags removed). One assertion was adapted: BUG-9 previously checked for the old wording "preserved until you save"; it now checks that the warning names the `workspace.corrupt-…` copy (the backup-file check itself is unchanged).

### Grumpy-user complaints (`src/main.tsx`, `src/components.tsx`, `src/styles.css`)
- **G1** Toasts are mode-aware and truthful: browser mode says "saved in this preview / open the desktop app so OBS can show it"; desktop with no overlay page open says OBS can't show it yet; otherwise "sent to N open overlay page(s), labelled TEST". The "Also send to OBS" option says "(desktop app only)" in browser mode.
- **G2** OBS badge is amber when no overlay page is open ("No OBS in browser mode" in browser), green only with "N page(s) connected (not proof you are live)".
- **G3** Changing page scrolls the content back to the top.
- **G4** Step 2 says "set Width W and Height H" (the published size, which is what OBS shows; a note appears if the draft size differs). Step 3 has a **Send a test alert to OBS [TEST]** button; desktop only, with a reason shown in browser mode.
- **G5** Voice preview works without enabling the bot (the toggle only controls automatic reading). With no Thai voice, the default preview text switches to English; a persistent inline note says the Thai part will be skipped whenever the text contains Thai.
- **G6** Plain-language speech notice (TH + EN), no "audio routing / Desktop Audio" jargon.
- **G7** Follow/subscription samples hide the message box, send "just followed!/just subscribed!" (TH/EN), and the feed shows "followed the channel / subscribed".
- **G8** Publish is a disabled secondary "Up to date ✓" button when nothing changed.
- **G9** Import shows "works in the desktop app only" in browser mode.
- **G10** Platform marks are simple drawn glyphs in brand colours (play triangle, Twitch bubble, block K, TikTok note); no logo files embedded. A newly sent sample is scrolled into view and briefly highlighted.
- Extra: at 800–1024 px the overlay editor stays beside the preview (260 px column) instead of stacking under it.

### Verification
- `tsc -b` clean; `vite build` OK; `node --test "tests/*.test.cjs"` → 38 tests, 38 pass, 0 todo, 0 fail.
- Browser preview (1280 and 800 px): checked toasts, scroll reset, highlight, Publish "up to date", amber badge, exact size step, preview alert text, follow description, speech defaults, platform marks, and that there is no horizontal scroll at 800 px.
- Electron relaunched with scratchpad `devdata`: UI rendered, home shows "3 local voices"; `/overlay/<token>` → 200 and contains the `TEST CHAT` / `hide-alert` code. Process killed afterwards.

### Still not done
- Real OBS Browser Source run and audible speech output (needs a human with OBS and speakers). Thai voice untested (none installed here).
- No automated UI tests for browser-fallback mode or page changes (the reviewer's item 12 is addressed to the tester).

## Dev log — round 3 (2026-10-20, Super Dev / Dev A)

### Online Thai neural voices (Microsoft Edge) — `electron/edgeTts.cjs` (new)
- Ported from rany2/edge-tts master (constants/drm/communicate.py): WSS `speech.platform.bing.com/.../edge/v1`, TrustedClientToken, **Sec-MS-GEC v2** (custom SHA-256/CS64 token, `Sec-MS-GEC-Version=2-143.0.3650.75`), MUID cookie, Edge headers, speech.config + SSML framing, binary audio frames, `audio-24khz-48kbitrate-mono-mp3`. It uses Node's built-in WebSocket with custom handshake headers, so there are no new dependencies.
- The token port matches the Python reference exactly for 4 fixed timestamps (tests).
- Safety: voice allow-list (8 voices: th-TH Premwadee/Niwat/Achara + en), XML-escaped text with control characters removed, 1–500 characters, rate/volume clamped, one request at a time, 10 s connect / 30 s total timeouts, 8 MB cap, MP3 sync check. Clear messages for offline / refused (with one clock-skew retry using the server Date) / timeout / no audio.
- Privacy: `main.cjs` `house:speak-online` refuses unless the **saved** workspace has `tts.engine==='online'`. The default is Windows voices. Choosing online shows the disclosure (free, needs internet, text is sent to Microsoft, unofficial and can stop at any time) and needs an explicit "I agree — use online voices" click. Importing a backup resets the engine to Windows. Thai segments go to the Thai neural voice automatically.
- Evidence (scratchpad): `edge-thai-premwadee.mp3` (19,872 B, MPEG sync `fff3`, ≈3.3 s @48 kbps, "สวัสดีครับ ยินดีต้อนรับสู่ Allhouse"), `electron-edge-thai.mp3` (the same sentence synthesized inside Electron main), `edge-th-TH-NiwatNeural.mp3`, `edge-en-US-AvaNeural.mp3`.
- Tests: `tests/edgeTts.test.cjs`: token vectors, SSML/XML injection, voice allow-list, length limits, framing, and simulated offline/refused/timeout. The LIVE test only runs with `ALLHOUSE_ONLINE_TESTS=1`.
- **Offline Thai option: not included.** From prior knowledge, not re-checked online this round: Piper has no Thai voice. Meta's MMS-TTS Thai (usable through sherpa-onnx) is licensed CC-BY-NC 4.0, so it can't be redistributed for general use, and it would also need native onnxruntime binaries. Revisit if a permissively licensed Thai model appears.

### Other items
- Icons: Simple Icons **16.34.0** (CC0) SVGs vendored in `src/assets/platforms/`. `src/platformIcons.ts` draws a brand-hex tile with a contrasting glyph. The overlay inlines the same glyphs as `data:` images (done before the ownership split, in runtime.cjs).
- R2-BUG-4: the test-alert/chat toast now reports "alerts/chat off in published layout", "queue paused" or "N alerts ahead" instead of promising an alert. Matching warnings sit by the OBS test button.
- R2-BUG-5: Windows voices hidden by dedupe are mapped to their visible twin, so a saved "Microsoft Zira Desktop" stays selected and plays.
- Wording: all fake data is "ทดสอบ" (TH) and "test/TEST" (EN), including "ALL TEST DATA".
- Toasts: 3.5 s for success, 9 s for errors (red, role=alert), bottom-centre.
- Native-app feel: UI text can't be selected; Ctrl+A only works inside text fields; dragstart is blocked. Feed messages, inputs and the OBS URL stay selectable.
- R2-BUG-1..3 (qa2): import keeps the backup draft and keeps a differing published layout as `importedPublished`, with "load into draft / discard" offered in the studio. The fallback allows chat when the queue is full and validates saves. Their todo flags were removed.
- Debug-only: `ALLHOUSE_DEBUG_ONLINE_TTS=<file>` (main.cjs).

### Requests for other owners
- **Dev B (runtime.cjs / components.tsx / tests):**
  1. Capitalise platform names in overlay chat rows (`b.textContent=v.name+' · '+v.platform` → map to "Twitch" etc.) and update qa2 "R2 BUG-1" (line 56 expects `· twitch`). I reverted my attempt to keep tests green.
  2. Before the split I edited runtime.cjs (icons, `user-select:none`, engine fields, importedPublished) and components.tsx (PlatformMark, `draggable={false}`, capitalised preview chat). Please review.
- **Dev C (styles.css / README / docs):**
  1. Before the split I added to styles.css: the user-select block, `.engine-picker/.engine-option/.online-disclosure/.imported-layout`, the bottom-centre toast with its `.error` variant, `.step-note.warn`, and the wrapping fixes (buttons, pills, breadcrumb). Please own and review these.
  2. README: a Credits line (Simple Icons CC0 16.34.0; trademarks belong to their owners) and an "Online voices" section (free, internet, text sent to Microsoft, unofficial, off by default).
  3. Write `docs/OBS-TEST.md`: the Thai-first checkbox list built from QA-REPORT's "Real OBS acceptance procedure", linked from the README.

### Verification
`tsc -b` clean · `vite build` OK (dist rebuilt) · `node --test "tests/*.test.cjs"`: 69 tests, 68 pass, 1 skipped (opt-in LIVE), 0 fail · the LIVE test passed when run with `ALLHOUSE_ONLINE_TESTS=1` · Electron launched on a free 19324: UI rendered, Thai MP3 OK, overlay 200; only my devdata instance was killed.

## Dev B — round 3 (runtime.cjs / components.tsx / tests)
- Overlay: platform names capitalised in chat and alert ("TEST ALERT · Twitch", "name · YouTube TEST CHAT"). `user-select:none` and `-webkit-user-drag:none` apply to every element, and images use `object-fit:contain`. Simple Icons glyphs are inlined (the data: images were already there).
- components.tsx: the preview alert and chat show a PlatformMark plus "TEST ALERT · Twitch" / "TEST CHAT", matching the overlay. Images and SVGs can't be dragged (`noDrag` spread, since React's SVG types lack `draggable`).
- Tests: qa2 has +3 tests (overlay wording / no-drag CSS, components source check, delivery reasons). `node --test "tests/*.test.cjs"`: 72 tests, 71 pass, 1 skipped (opt-in LIVE), 0 fail.

### Requests → Dev A (API change, backwards compatible)
- `sendEvent` (IPC `house:event`) now returns the event plus `delivery: {overlays:number, delivered:boolean, reason}`.
- `reason` is one of: `app-only`, `no-overlay`, `chat-hidden`, `alerts-hidden` (published layout), `muted`, `paused`, `queued` (behind another OBS alert), `shown`.
- It describes the moment of sending and is not stored in history.
- Please drive the `obsOutcome` toasts from `delivery.reason` instead of re-deriving them in main.tsx. Add `delivery?` to the `HouseEvent` return type in `types.ts`.
- The browser fallback (`api.ts`) could return `{overlays:0,delivered:false,reason:'app-only'}`.

## Dev log — round 4 (Dev A: widgets UI)
- `src/types.ts`: schema v2 per docs/WIDGETS-CONTRACT.md (`Widgets`, `ChatWidget`, `AlertWidget`, `BannerWidget`, `draftWidgets`/`publishedWidgets`/`widgetsPublishedAt`). `Status.widgetUrls/widgetClients`. `HouseEvent.delivery?`. `StateV1` for migration.
- `src/api.ts`: widget defaults, v1→v2 migration, contract validation and the 25 MB limit. These live in api.ts because qa2 loads it in a VM without `require`. `src/widgets.ts` re-exports them for the UI. The fallback migrates v1 localStorage data, validates v2 saves, and returns `delivery:{overlays:0,delivered:false,reason:'app-only'}`. Legacy scene images may be GIF.
- `src/WidgetsPage.tsx` (new): replaces the old overlay page and its OBS panel; nav label "วิดเจ็ต OBS / OBS widgets". It has:
  - a tab per widget, each with on/off, a page-open badge, an unpublished marker, a big "ตั้งใน OBS: กว้าง W สูง H" hint, its own URL + Copy + Open, OBS steps and a TEST button;
  - full editors: size presets and custom size; chat options; alert template with a placeholder hint and live preview text; image/GIF upload; sound upload (mp3/wav/ogg ≤ 3 MB) with name, play/stop, remove and volume; banner fields;
  - a single "เผยแพร่ทุกวิดเจ็ต" (Publish all widgets) and a 25 MB warning;
  - the legacy all-in-one URL under an "Advanced" `<details>`.
- The preview uses Dev B's `WidgetPreview` once components.tsx exports it; until then a local approximation is used.
- `src/main.tsx`: `updateWidget` keeps the legacy `draft` scene derived from the widgets; publish copies draftWidgets → publishedWidgets plus the legacy scene; test toasts come from `delivery.reason` (unknown reasons → neutral text); v1 state from the runtime or an import is migrated for the UI.
- `electron/main.cjs` + `preload.cjs`: `house:open-widget` only opens a runtime-issued `http://127.0.0.1:` URL for a known widget id.
- Verified: tsc clean, vite build OK, tests 72 / 71 pass / 1 opt-in skip / 0 fail. Browser preview: v1 data migrated, editing, live template preview and Publish saved v2. Electron: UI rendered, `/overlay/<token>` 200, `/w/<token>/chat` 200; only my instance was killed.

### Requests (round 4)
- **Dev C (styles.css):** new classes need styling: `.widget-tabs`, `.widget-tab(.active)`, `.dot.off`, `.widget-card`, `.widget-head-actions`, `.size-hint` (big W×H), `.widget-steps`, `.widget-body` (preview | editor, stacks when narrow), `.widget-preview`, `.widget-editor`, `.asset-row`, `.sound-box`, `.sound-name`, `.legacy-overlay` (details/summary). Also `input[type=number]`.
- **Dev B (runtime.cjs / components.tsx):** (1) `getState()` should return v2 (the UI migrates v1 meanwhile, but saves need the runtime to accept v2). (2) The legacy scene image regex should allow `gif`, since the banner image is copied into `draft/published`. (3) Delivery reasons I map: `app-only, no-overlay|no-page, chat-hidden|alerts-hidden|widget-off|widget-disabled|disabled, not-published, muted, paused, queued, shown`. Others show neutrally. (4) Export `WidgetPreview({widget,kind,event?})` from components.tsx; the UI picks it up automatically.

## Dev B — round 4 (widgets: runtime.cjs / components.tsx / tests)
- **Schema v2:** `draftWidgets`, `publishedWidgets` and `widgetsPublishedAt`. `validateState` accepts v1 (migrated as the contract describes) or v2. Every widget field is checked against the contract limits. Images must be png/jpeg/webp/gif and sounds mpeg/wav/ogg/webm, each ≤ 4 MB. A whole workspace over 25 MB is rejected. Unknown fields are dropped.
- **Legacy scenes:** `draft` and `published` are kept and kept in sync. A save that changes a scene and leaves the widgets alone pushes the scene into the widgets (banner, accents, enabled). A save that changes the widgets re-derives the scene. `/overlay/<token>` still works.
- **Import:** the backup's widgets become the draft. OBS keeps the current published widgets. A differing backup published set is kept as `importedPublishedWidgets`.
- **`GET /w/<token>/<id>`:** chat, follow, subscription and banner pages. Each is transparent, scaled from its own W×H canvas, uses nonce CSP plus `media-src data:` and `user-select:none`, and has fade/slide/pop animations. Every string is set with textContent, and the alert template is split into text nodes. Chat honours all its options. Alerts show the image, play the sound at its volume, last `durationSec`, and stop on skip.
- **`GET /events/<token>?w=<id>`:** each widget receives only its own published config. Chat goes only to the chat widget; follow and subscription go only to their own widget. The legacy overlay gets everything. A disabled published widget gets nothing.
- **Status and delivery:** `getStatus()` adds `widgetUrls` and `widgetClients`. `delivery` is per widget, `{widget, overlays, widgetPages, legacyPages, delivered, reason}`, with the same reasons as before; `chat-hidden` / `alerts-hidden` now mean "that widget is off". OBS alert lanes use the widget's `durationSec`.
- **components.tsx:** `WidgetPreview({widget, kind, event})` renders the widget at its own aspect ratio inside `.widget-preview`. It uses a ResizeObserver-scaled W×H canvas and the same layout, labels and template rules. Also exports `fillTemplateParts`.
- **Tests:** new `tests/widgets.test.cjs` (16 tests). Existing tests are adapted to v2 (schemaVersion 2, delivery fields, durationSec, re-saving the returned state). `node --test "tests/*.test.cjs"`: 88 tests, 87 pass, 1 skipped (opt-in LIVE), 0 fail. `tsc -b` clean.

### Requests
- **Dev A:**
  1. Always save the state returned by `saveState`/`getState`. If you re-send stale `draftWidgets`/`publishedWidgets`, they win over a scene edit and revert the scene. Edit widgets, not the legacy scenes.
  2. Publish = copy `draftWidgets` → `publishedWidgets` and set `widgetsPublishedAt`.
  3. `Delivery` in `types.ts` now also has `widget`, `widgetPages`, `legacyPages`.
  4. Add `importedPublishedWidgets?:Widgets` to `State`.
  5. `WidgetPreview` is ready (`import {WidgetPreview} from './components'`).
- **Dev C:** the in-app preview uses the classes `anim-fade`, `anim-slide`, `anim-pop` and `.tag`. Please add the same keyframes as the widget page (fade 0.45 s; slide translateY(40px); pop scale 0.6 → 1.06 → 1; none under `prefers-reduced-motion`).

## Dev log — round 4 integration (Dev A)
- Saves adopt the state the runtime returns, whenever no newer edit happened in the meantime, so stale widgets are never re-sent. Publish copies `draftWidgets` → `publishedWidgets` and sets `widgetsPublishedAt` (the legacy scene is derived too).
- `types.ts`: `Delivery` gains `widget`, `widgetPages`, `legacyPages`; `State` gains `importedPublishedWidgets`. The import notice offers "load into draft / discard" for it.
- `WidgetsPage.tsx` imports `WidgetPreview` directly from `./components`. The local approximation and the cast are removed.
- Fix: the publish toast counted pages twice (`clients` already includes widget pages).
- **Real Electron run** with a fresh `ALLHOUSE_DATA_DIR` (scratchpad `devdata-r4`), driven over CDP. Evidence: scratchpad `r4-verify.json`, `r4-verify.png`, `sse-chat.txt`, `sse-follow.txt`.
  - Chat: "newest at top" and font 40 were typed with the keyboard and published; `/events/<token>?w=chat` streamed `"fontSize":40,"newestAt":"top"`.
  - Follow: `follow-ding.wav` (49 KB, System.Speech) was uploaded through the real file input. It was published as `data:audio/wav` (65,898 chars), and the follow SSE stream received it.
  - TEST follow: the toast said "should show on 1 Follow alert page". A direct `sendEvent` returned `delivery {widget:'follow', widgetPages:1, delivered:true, reason:'shown'}`, and the follow stream got both alerts. `/w/<token>/follow` returned 200.
  - Only my instance was killed. tsc clean, build OK, tests 88 / 87 pass / 1 opt-in skip / 0 fail.

## Round 5 — real platform connections (2026-10-21)
- `electron/platforms/*.cjs`: one reader per platform, each a pure parser (`toEvent`) plus `connect()` built on `common.cjs` `reconnecting()` (backoff 2s→60s, fatal errors stop).
  - Twitch: anonymous IRC WebSocket (`justinfanNNNN`): chat + sub/resub/gift USERNOTICEs. Follows need EventSub + a user token → waiting for a Twitch Client ID (device-code flow, public client).
  - Kick: kick.com moved from Pusher to Centrifugo (verified 2026-10-21). Guest token from `POST web.kick.com/api/v1/realtime/auth/connection`, then `wss://realtime.us-west-2.platform.kick.com/connection/websocket`, channels `chatrooms.<id>.v2` + `channel.<id>`. Channel lookup `kick.com/api/v2/channels/<slug>` is behind Cloudflare: plain Node fetch gets 403, Electron `net.fetch` works.
  - YouTube: InnerTube (`/live_chat` pop-out page → `youtubei/v1/live_chat/get_live_chat`), "Live chat" (not Top chat) continuation, first batch skipped (backlog), polls ≤5 s. Unofficial / ToS risk.
  - TikTok: TikFinity Desktop local WebSocket `ws://127.0.0.1:21213/` (`{event,data}`), chat/follow/social-follow/subscribe. Not verified against a running TikFinity (not installed here); parser follows TikTok-Live-Connector field names.
- `electron/connections.cjs`: saved in `connections.json` (userData), auto-reconnects enabled platforms at start, pushes status + live events to windows.
- `runtime.ingestLive()`: real events → `sourceMode:'live'`, always OBS, trimmed (not rejected), lazy persist (2 s), overlays hide the TEST label only for live events.
- UI: `src/ConnectionsPage.tsx` (status, what each platform delivers, unofficial warnings), live chat read aloud when the Chat TTS bot is on, home stat counts connected platforms, TEST tag only on test events.
- Verified in real Electron: Twitch (#xqc) + Kick (classybeef) chat reached the OBS chat widget SSE as `sourceMode:"live"` (27 messages / 25 s); YouTube @LofiGirl connected; TikTok shows "TikFinity is not running".

## Round 6 — TikTok gift alert widget + TikFinity check (2026-10-21)
- TikFinity Desktop on this PC answers on `ws://127.0.0.1:21213/`: on connect it sends `state_update` and `config` (no `data` on state_update). No chat/gift events while the account is not LIVE, so the gift parser is still verified only against TikTok-Live-Connector field names, not a real TikFinity gift.
- New 5th widget `gift` (`/w/<token>/gift`): an alert widget plus `minCoins` (gifts worth less in total stay in the feed, no OBS alert; tests ignore it) and `showGiftImage` (TikTok CDN picture). Placeholders `{gift}` `{count}` `{coins}` (total). Older v2 workspaces get the default gift widget automatically.
- Gift widget page has its own CSP allowing images only from TikTok CDNs (`*.tiktokcdn*.com`, `*.ibyteimg.com`, `*.byteimg.com`); every other page stays `img-src data:`. Gift image URLs are validated server-side (`cleanGift`).
- TikTok parser: streakable gifts (giftType 1) alert once at combo end (`repeatEnd`), one-shot gifts immediately; reads flat or nested (`giftDetails`, `extendedGiftInfo`, `user`) fields.
- Verified in real Electron: TikTok shows "connected" via TikFinity; a test gift reached `/w/<token>/gift` (`delivery.reason: shown`) and rendered "mintmint sent Rose ×1".
- Tests: `tests/gift.test.cjs` (3), gift cases in `platforms.test.cjs`; widget tests updated for the 5th widget. 107/107 pass.

## Round 7 — per-widget custom CSS (2026-10-21)
- Every widget has `customCssEnabled` (default off) + `customCss` (≤ 20 000 chars); optional for older workspaces. Widget defaults now go through `validateWidgets` so key order matches validated state (`same()` compares JSON text — a mismatch made scene/widget sync misfire).
- OBS page: `userCss()` writes the CSS into `<style id="user-css">` via `textContent` on every published state (live, no reload). CSP unchanged, so `url()`/`@import` cannot reach the network (data: images only).
- In-app preview now uses the same ids/classes as the widget page (`#box .chat`, `#wrap #card .ph`, `#brand #title`…); structural rules use `:where(.wp-stage)` so user selectors win exactly as on OBS. User CSS is parsed with `CSSStyleSheet.replaceSync` and re-serialised inside `@scope (.wp-stage)` so it cannot restyle the app.
- Widgets page: "Use custom CSS (advanced)" switch under the preview, code box (Tab inserts spaces), example snippet per widget kind, selector list, colour variables note.
- Verified in real Electron: published CSS applied live on `/w/<token>/follow` (radius 0, dashed border, 8px shadow, yellow name). Tests: `tests/customcss.test.cjs` (3).
- CSS guide artifact: https://claude.ai/artifact/CuV1Xh1omz4ReJu8n1szXW (private to the owner until shared). Linked from the custom CSS box; desktop opens it via IPC `house:open-css-guide` with a fixed URL.
- Round 8: `docs-site/` = static, dependency-free copy of the CSS guide for free hosting (Cloudflare Pages / Netlify / Vercel / GitHub Pages), with 404, favicon, security headers (`_headers`, `vercel.json`). Excluded from Electron packaging. Fixed the playground: base `#pg-stage #card` rules now use `:where(#pg-stage)` so user CSS wins (same fix as the app preview). Artifact republished (v2).

## Round 9 — chat reading rules (2026-10-21)
- `tts.rules` (optional; defaults in `src/ttsRules.ts`): per-platform read on/off, read name first ("X บอกว่า …" / "X says …" by message script, or an optional `nameTemplate` ≤200 chars with `{user}` `{message}` `{platform}`, expanded in one pass; no `{message}` → message appended), skip `!`/`/` commands, ignored names (comma/line separated, case-insensitive, `@` ignored; bots pre-filled), max characters 20–500 (cut never leaves a dangling Thai vowel/tone mark). Links are never read.
- `speechFor()` is the single gate for live chat and test chats ("read test chats aloud"). Validated in `runtime.cjs` (`Invalid chat reading rules`) and the browser fallback.
- UI: Chat TTS page panel "Which chat is read, and how" (platform cards, rules, live example on an LCD); platform chips on the TTS bar (Chat & activity + pop-out). Pop-out relay accepts `{cmd:'set', patch:{platforms}}`; status carries `platforms`.
- Tests: `tests/ttsrules.test.cjs` (6; transpiles `src/ttsRules.ts` with the project's TypeScript). 111/111 pass.

## Round 10 — full local user manual (2026-10-21)
- `docs-site/` is now the whole manual, 7 pages (index, start, connections, obs-widgets, chat-tts, custom-css, help) sharing one header/nav + prev/next pager; real app screenshots in `docs-site/img` (captured from the browser-preview build with a throwaway Electron script, light theme, 1440 wide).
- The app opens the manual from disk: IPC `house:open-docs` (whitelisted page names → `docs-site/<page>.html` via `shell.openExternal(file://…)`). Topbar **คู่มือ / Manual** button opens the page matching the current screen; the custom-CSS link opens `custom-css.html`. The claude.ai artifact URL is no longer used by the app. `docs-site` now ships in the package (removed from the packager ignore list).
- `guide.js` guards the playground so it can load on every page.

## Brand refresh — pixel arcade identity (2026-10-21)
- Three transparent image-generated directions saved under design/branding: Arcade House (selected), Gamepad House and Broadcast House; prompts and comparison sheet included.
- Original pixel ALLHOUSE wordmark in src/Brand.tsx; shared in sidebar and home illustration. Matching symbol on loading/settings and chat header; language and existing features preserved.
- PNG icon sizes 16–1024, 7-size Windows ICO, transparent light/dark lockups and SVG wordmarks in public/brand. Main/pop-out BrowserWindows, HTML favicon and Electron packager now use the new icon. Manual favicon updated to PNG.
- TypeScript and production Vite build passed. Browser screenshots checked at 1440×960 light/dark and 800×600 compact navigation, no logo clipping or page errors. Extracted the packaged EXE icon to verify the replacement.
- Windows package: release/Allhouse-win32-x64/Allhouse.exe. Existing processes were not restarted; reopen the app to load updated branding.

## Round 11 — home status board (2026-10-21)
- Replaced the three home stat cards (incl. the not-useful "overlays 5/4") with `src/HomeStats.tsx`: four clickable tiles in the controller colours — Connections (per-platform LED: online/connecting/problem/off + events received), Last 15 minutes (per-minute bar chart on an LCD + chat/follow/sub/gift counts, notes test events), Chat TTS (equalizer animates while reading, inline on/off switch, which platforms are read, queue size), Widgets in OBS (which of the 5 widgets OBS actually has open, unpublished-edit / paused-queue warnings). Styles in retro.css; respects reduced motion. Manual screenshots recaptured.

## Round 12 — review fixes (2026-10-21)
- History moved to `history.json` (≤200 rows). Chat/alert traffic and queue actions rewrite only that file; `workspace.json` (with images/sounds, up to 25 MB) is written on save/import only. Old workspaces with embedded history still load.
- Speech queue: chat keeps the newest 20 lines (oldest dropped silently) instead of refusing new ones with a toast per message.
- Kick: guest token refreshed on the same socket a minute before it expires (Centrifugo `refresh`; must reuse the same client_id — verified live), re-armed after each refresh.
- `connections.cjs` takes injectable `connectors`; new `tests/connections.test.cjs` covers save → auto-reconnect → disconnect stays off, bad input, broken file.
- Home chart refreshes on the newest event id (history length stops at 200); removed the redundant `liveCount` state.
- Skipped: merging the browser-fallback validation in `src/api.ts` with `runtime.cjs` (refactor, needs the R2-BUG-3 test reworked).

## Round 13 — chat widget options (2026-10-21)
- Chat widget: profile pictures (YouTube authorPhoto, TikTok profilePictureUrl/avatarThumb; Twitch/Kick send none → coloured first-letter circle), platform name after the viewer on/off, name colour mode (one accent / platform tint / viewer's own colour from Twitch `color` tag or Kick `identity.color`, else a steady hash colour), one-line layout. All optional with defaults for older workspaces.
- Live events carry `avatar` (https, YouTube/TikTok image CDNs only; same hosts allowed in the chat page CSP) and `color` (#rrggbb only).
- Widget page row: `[i.av] b(img.pm + name + small.pf + i.tag) span(message)`; name colour via `--name` so custom CSS can override. Preview mirrors it (`<i>` for initials/icon so `.chat span` stays the message). Manual updated.
- Round 14: `tts.singleVoice` (optional) — one chosen voice (the Thai-voice slot, list shows every voice) reads the whole message in its own accent instead of switching Thai/English voices; works for Windows and online voices. Verified Premwadee synthesises mixed Thai/English text.
- Round 15: Kick "Edit stream info" (`electron/kickApi.cjs`, `src/KickInfoDialog.tsx`). Official API: OAuth 2.1 + PKCE (S256) with a one-off loopback callback on `localhost:19325` (127.0.0.1 + ::1 only, state-checked, 5-min timeout); scopes `user:read channel:read channel:write`. The user's own Kick developer app (Client ID + Secret entered in-app) and the tokens are encrypted with Electron `safeStorage` in `userData/kick-auth.json`; the secret is write-only from the renderer and the channel's stream key is never passed on. Edits title (≤140), category (search via `/public/v1/categories?q=`, deprecated but the only text search), tags (≤10); language and 18+ are read-only in Kick's API. Token refresh is automatic; 401 → signed out with a clear message. Renderer CSP allows images from `*.kick.com` (category art, avatar). Tests: `tests/kickapi.test.cjs`.
- Round 16: Kick button shortened (nowrap); dialog redesigned (Kick-green header with live LED, live 'Preview on Kick' card, title meter, category tiles, colour tags, saved state); toasts z-index 90 so the dialog backdrop blur no longer covers them (checked with elementFromPoint).
- Round 17: Kick form prefill. Kick's official GET /channels returns empty title/category/language while offline, so gaps are filled from kick.com/api/v1/channels/<slug> (unofficial: stream on air, else previous_livestreams[0]) or from the values this app saved last (kept in kick-auth.json), whichever is newer. Saves send only the fields the user changed. Verified against the real buckybee data (title 🟢เดดบายรายวันครับ, Dead By Daylight id 94, Thai).
- Round 18: pop-out chat follows the newest message again (keyed on the newest id — the 200-entry history stopped changing length — and only the reader's own wheel/scrollbar/touch/keys stop following, so messages dropping off the top no longer count as scrolling up); smooth scroll for new messages; re-pins on font/panel changes. New display settings in the pop-out (pictures, platform icon/name, time, name colour, test chats, compact, follow), saved per computer. Renderer CSP allows YouTube/TikTok avatar hosts. Verified in an off-screen window with a full 200-entry history.
- Round 19: history.json now keeps each chat's avatar URL and name colour (re-validated on load with the same rules as live ingest), so pictures survive a restart.
- Round 20: profile pictures for Twitch (gql.twitch.tv, public web client id, batched ≤35 logins) and Kick (kick.com/api/v2/channels/<slug> user.profile_pic) via electron/avatars.cjs: cached 24 h (no-picture 1 h), a new viewer's chat waits at most 700 ms, one ordered chain per platform. Hosts static-cdn.jtvnw.net and files.kick.com added to the avatar allow-list and CSPs. Letter circle only when the viewer has no picture.

## Branding revision — 2026-10-22
- Selected Broadcast House v2: oxblood roof, chimney with pixel smoke, rainbow no-signal CRT, bright green/blue buttons.
- Replaced shared app icon, lockups, favicon and Windows package icon; updated local manual header/favicon and ten screenshots.
- Validation: TypeScript/Vite build, Windows packaging, extracted executable icon, browser light/dark/compact layouts and manual logo load passed.


## Security pass + Windows installer — 2026-10-22
- Security review (main/preload IPC, local OBS server, widget pages, Kick OAuth, avatars, backup import): no blocking findings. IPC is sender-checked, the OBS server is 127.0.0.1-only with Host check + 48-hex token, widget pages set every user string with textContent, renderer CSP has no inline script. Pending changes and untracked files scanned: no secrets.
- Lockfile audit (npm advisory API): extract-zip (high ×2) and sprintf-js (moderate) are build-time only (Electron download / packager), not shipped. Electron 41 (moderate HID/USB origin advisory, not reachable: every permission request is denied) is **end-of-life** — upgrade to a supported major (43–45) before a wide public release.
- `pnpm release` (scripts/build-release.cjs): slim package from node_modules/electron/dist (only runtime files, en-US/th locales; 409 MB → 313 MB installed), exe icon/version via resedit, Electron fuses RunAsNode / NODE_OPTIONS / --inspect switched off (verified ELECTRON_RUN_AS_NODE does nothing).
- Installer `release/Allhouse-Setup-<version>.exe` (installer/Setup.cs + Setup.xaml, WPF on .NET Framework 4.x, compiled by Windows' csc.exe): borderless retro window, floating pixel house with chimney smoke, TV colour-bar progress, rotating tips, sparkles on finish, TH/EN toggle. Per-user (no admin): %LOCALAPPDATA%\Programs\Allhouse, Start menu + optional desktop icon, HKCU Apps & Features entry, updates in place. Uninstaller runs from a temp copy, deletes only a folder carrying the `.allhouse-install` marker + Allhouse.exe (junctions not followed), keeps user data unless asked (then only %APPDATA%\allhouse with workspace.json/overlay-token), and deletes itself.
- Verified on this PC: install (193 files, registry entry, both shortcuts), packaged app starts and serves widget fonts, uninstall removes folder/registry/shortcuts and keeps user data. Not code-signed: SmartScreen shows "Windows protected your PC" until the exe is signed.
