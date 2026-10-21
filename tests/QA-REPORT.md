# Allhouse 0.1.0 local alpha — QA report

Tester: Super Tester. Plan: `tests/QA-CHECKLIST.md`, `UX_REVIEW.md`. App source was not modified; tests were added in `tests/qa.test.cjs`.

## Round 1 (2026-10-20)

Environment: Windows 11, Node v24.13.0 (Adobe bundled `node.exe`), Electron from `node_modules/electron/dist/electron.exe`, overlay port 19324. Every Electron run used a fresh `ALLHOUSE_DATA_DIR` under the session scratchpad (`qadata/s1` … `s5`). All Electron processes were closed afterwards (`tasklist | grep -c electron` → 0).
Evidence files (scratchpad `qaout/`): `s1-home.png`, `s2-activity.png`, `s2-connections.png`, `s2-speech.png`, `s2-settings-light-en.png`, `s3-overlay.json`, `s3-overlay-xss.png`, `s5-small-overlay.png`, `s5-small-drawer.png`, `s2-obs-stream3.txt`, `s2-sse.txt`.

How I tested: `node --test`; `curl` against the running app; the real app driven through Chromium DevTools (`--remote-debugging-port=9333`, `Runtime.evaluate` and `Page.captureScreenshot`); and a separate Electron harness that loads the real overlay page in Chromium (`qascripts/overlayharness/main.cjs`).

**Interference note.** During one stretch of the `s2` session (about 10:55:58–10:56:04 UTC), someone else made trusted (real) mouse clicks in my Electron window, and the language and page also changed under my scripts. I logged this with a click spy (`isTrusted: true`). I threw away the UI results from that stretch, minimised the window, and re-ran those steps. The click spy recorded **zero** trusted clicks in the re-runs (`steps3`, `q1`).

### Results

| # | Check | Method | Result | Evidence |
|---|---|---|---|---|
| B1 | `tsc -b` | node tsc | PASS | exit 0, no output |
| B2 | `vite build` | node vite | PASS | `✓ built in 1.66s`, `dist/assets/index-*.js` 283.87 kB |
| B3 | `tests/runtime.test.cjs` | `node --test` | PASS | 15/15 pass |
| B4 | `tests/qa.test.cjs` (new) | `node --test` | PASS (14 gates); 9 `todo` = open bugs | `tests 23 · pass 14 · todo 9 · fail 0`; combined run 38 tests, 29 pass, 9 todo |
| G1 | Overlay listens only on loopback | qa test (connects to every LAN IPv4) + curl to `192.168.0.110:19324` | PASS | test refused on 26.26.246.124 / 192.168.0.110; curl `000` |
| G2 | Unknown routes / invalid credentials get no data | qa test (13 near-miss paths, 4 methods) + curl | PASS | all 404 / 405; body never contains token or scene; curl: bad token 404, token+1 char 404, `/` 404, traversal 404, POST 405 |
| G3 | Untrusted Host and Origin rejected | qa test (6 Hosts × 3 routes, missing Host, 5 Origins) + curl | PASS | `Host: localhost:19324` 403, `evil.example` 403, events `Origin: https://evil.example` 403, `Origin: null` 403; same-origin 200 |
| G4 | Editing a draft does not change the published overlay | existing test + real app (edit title, then read SSE) | PASS | `s2-sse.txt` "[SSE during draft]" still shows `WELCOME TO THE HOUSE`; UI pill shows "ยังไม่เผยแพร่" |
| G5 | Explicit publication updates the output | existing + qa test (persisted across restart) + real app | PASS | `s2-sse.txt` "[SSE after publish]" title = edited draft; pill shows "ตรงกับฉบับเผยแพร่" |
| G6 | Preview tests do not enter the OBS stream | existing test | PASS | only `state` events seen for preview chat/follow (see BUG-3 for a related side effect) |
| G7 | Explicit OBS tests are labelled as tests | qa test running the real overlay script + real Chromium harness | **FAIL** | alerts show `TEST ALERT · TWITCH`, but OBS **chat** rows show only `name · platform` → BUG-1 |
| G8 | Queue pause / resume / skip / clear stay consistent | existing + qa test + real app | PASS | real app: 3 queued → pause 3 → skip 2 → resume (1 alert emitted) → clear 0; history shows 3× skipped. See BUG-2 for a side effect. |
| G9 | Restart restores preferences and publication without replaying alerts | existing + qa test + real app | PASS | real app `s4`: 2 queued OBS alerts on disk → relaunch → SSE for 12 s showed `1 event: state` only; UI shows "หยุดเมื่อปิดแอพ" ×2, queue 0. `s2`: en / light / name / published title restored. |
| G10 | Invalid and oversized imports rejected; good state kept | qa test (4 MB+ image, wrong types, non-objects) | PASS (runtime) | `workspace.json` byte-identical afterwards. The 10 MB file-size guard in `main.cjs:25` was checked by reading the source only; the real file dialog was not run. |
| G11 | Exports contain no overlay credentials | qa test repeating the `main.cjs` export handler + source check | PASS | exported JSON has no token, no `/overlay/`, no history. The real save dialog was not run. |
| G12 | User strings render as text, not HTML | qa test (real overlay script in a VM with a fake DOM that throws on innerHTML) + real Chromium harness | PASS | `s3-overlay.json`: 0 injected img/script/svg/iframe, `document.title` unchanged; payloads shown as literal text (`s3-overlay-xss.png`, `s2-activity.png`) |
| G13 | Event history and queue stay bounded | existing + qa tests (1000-entry file → ≤200, 0 replays) | PASS | history 200, queue 50, 11th SSE client gets 429 (BUG-8 is a side effect) |
| D1 | Fresh launch offers a working sample path without login | real app | PASS | `s1-home.png` CTA "ลองใช้งานด้วยแชทตัวอย่าง"; a sample sent from Activity appeared in history. The home quick button itself was not cleanly exercised (interference). |
| D2 | Platform status reflects what is actually implemented | screenshot | PASS | `s2-connections.png`: all 4 cards show "ยังไม่พร้อมเชื่อมจริง" |
| D3 | Connect buttons do not claim success | source + screenshot | PASS | buttons only open a "not ready in this alpha" modal |
| D4 | Thai and English text legible | screenshots (100% scale only) | PASS | Noto Sans Thai loaded (`fonts: loaded`); 125–200% scaling not tested |
| D5a | Light and dark themes readable | screenshots | PASS | `s1-home.png` (dark), `s2-settings-light-en.png` (light) |
| D5b | "System" appearance follows the OS | — | NOT TESTED | OS theme was not toggled |
| D6 | User can tell saved draft from published output | real app | PASS | pill changes between "Unpublished changes" and "Published layout" |
| D7 | OBS guide has URL, size and an explicit test action | real app + source | PASS | URL field `http://127.0.0.1:19324/overlay/<48 hex>`, 3 steps, canvas footer `1920 × 1080`, "Also send to OBS" warning |
| D8 | An open overlay page is not presented as proof of being live | source + UI text | PASS | "Overlay pages open: N … does not mean you are live" |
| D9 | TTS shows the real installed voices and explains missing Thai | real app | PASS (see BUG-11) | "พบ 5 เสียง (ไทย 0 · อังกฤษ 5)"; Thai-missing guidance shown |
| D10 | TTS stop cancels active speech and the queue | — | NOT TESTED | no audio-output verification |
| D11 | Audio preview not described as verified OBS audio routing | UI text | PASS | "Automatic OBS audio routing is not implemented" notice |
| D12 | All controls have keyboard focus and labels | partial automated scan | NOT TESTED | the scan found 0 unlabelled controls at 784 px, but no keyboard walk-through was done |
| D13 | Smallest window keeps key controls reachable | CDP viewport 784×561 | PASS | `scrollWidth == innerWidth` (784), menu button visible, Publish button on screen (`s5-small-overlay.png`) |
| D14 | Closing and reopening keeps settings | real app (graceful close, relaunch) | PASS | an edit made just before close ("LAST EDIT BEFORE CLOSE") was on disk and shown after relaunch |

**Totals: 28 PASS · 1 FAIL · 3 NOT TESTED.** The release limitations in the checklist were not tested: real platforms, cloud TTS, signing, real OBS video/audio, and endurance.

### Bugs

1. **BUG-1 — Major — OBS chat samples have no test label.** `electron/runtime.cjs:55` (overlay `chat` handler).
   Repro: Activity → Destination "Also send to OBS" → Send sample (chat).
   Expected: the overlay row is marked TEST or ตัวอย่าง, as alerts already are.
   Actual: the row shows only `name · platform` (`s3-overlay.json` `chat` field), so live viewers see a fake chat as if it were real. Test: `BUG-1` in `qa.test.cjs`.
2. **BUG-9 — Major — The original of an unreadable workspace is destroyed by the first sample chat.** `runtime.cjs:68` (the warning promises "original file preserved until you save"), with `persist()` called from `sendEvent` and `controlQueue` (`:104–115`).
   Repro: put a corrupt `workspace.json` in place → launch → click "Try a sample chat".
   Expected: the original is kept, or backed up, until the user explicitly saves.
   Actual: it is overwritten with defaults and no backup is made (data loss). Test: `BUG-9`.
3. **BUG-2 — Minor — Skipping an alert wipes the OBS chat box.** `runtime.cjs:113` broadcasts `clear` on skip; the overlay `clear` handler at `:57` empties `#chat`.
   Expected: only the alert is hidden.
   Actual: all on-stream chat rows disappear (real Chromium: `chatAfterSkip: 0`; `s2-obs-stream3.txt` shows `event: clear` after skip). Test: `BUG-2`.
4. **BUG-3 — Minor — App-only alerts hold up OBS alerts.** `runtime.cjs:76`: `pump` plays preview follows and subs for 5 s each in the same queue.
   Repro: send a preview follow, then an OBS follow.
   Expected: the OBS alert shows immediately.
   Actual: it is delayed by 5 s per preview alert. Test: `BUG-3`.
5. **BUG-4 — Minor (performance) — Every draft save re-broadcasts the published scene to all overlays.** `runtime.cjs:100`.
   The published scene includes an image of up to about 4 MB, and saves fire about every 300 ms while typing. `s2-obs-stream.txt` shows repeated identical `state` events. Test: `BUG-4`.
6. **BUG-5 — Minor — Import changes the live OBS overlay without Publish.** `runtime.cjs:101`; the confirm text at `src/main.tsx:116` does not mention OBS.
   Expected: imported content arrives as a draft, or the user is warned.
   Actual: the imported `published` scene is broadcast immediately. Test: `BUG-5`.
7. **BUG-6 — Minor — "(imported)" accumulates.** `runtime.cjs:101`.
   Re-importing an export gives "My streaming room (imported) (imported)". Test: `BUG-6`.
8. **BUG-7 — Minor — The history loader keeps arbitrary fields from disk.** `runtime.cjs:67` (`{...e}`).
   A 100 kB extra field survived load and is returned to the renderer and re-persisted. Test: `BUG-7`.
9. **BUG-8 — Minor — A full alert queue also rejects chat samples.** `runtime.cjs:104`.
   Chat never enters the queue, but with 50 queued alerts, sending a chat throws "Queue is full (50)". Test: `BUG-8`.
10. **BUG-10 — Minor (UX) — The toast covers the "Read sample chats aloud" toggle.** `src/styles.css:524`; visible bottom-right in `s2-activity.png`.
11. **BUG-11 — Minor — Duplicate voices.** `src/main.tsx:40` de-duplicates by exact name only.
    "Microsoft David - English (United States)" (web) and "Microsoft David Desktop · Windows" (SAPI) are both listed, giving 5 voices where there are really 3. Known in the DEVLOG but still open.
12. **BUG-12 — Minor — The in-app overlay preview does not match the real overlay alert.** `src/components.tsx:14` shows "SAMPLE ALERT / mintmint is now part of the house!"; the real overlay shows "TEST ALERT · PLATFORM / name — message".
13. **BUG-13 — Minor (process) — `npm test` runs only `tests/runtime.test.cjs`.** `package.json` `scripts.test`.
    The new gates in `tests/qa.test.cjs` will not run unless the script becomes `node --test tests/runtime.test.cjs tests/qa.test.cjs`.

Informational (not counted as bugs): the overlay CSP nonce is a fixed string (`'nonce-allhouse'`); the token comparison is not constant-time (loopback only); the renderer CSP `connect-src http://127.0.0.1:*` is broader than needed. Once, a graceful `taskkill` did not close the app; I could not reproduce it in 3 later attempts, including with an SSE client attached.

Bug-reproducing tests in `tests/qa.test.cjs` are marked `{ todo: 'BUG-n …' }`. Remove the flag once a bug is fixed so the test becomes a hard gate.

## Round 2 (2026-10-20)

Scope: re-verify BUG-1…13, regress the round-1 gates, review the round-2 changes for new bugs, run the overlay in real Chromium, and add browser-mode coverage.

**Snapshot under test.** The round-2 code as it stood at about 18:13: `runtime.cjs` 18:07, `main.tsx` 18:09, `components.tsx` and `styles.css` 18:10, `api.ts` 17:39, `dist/` built 18:14. **The code kept changing while I tested.** Between 18:20 and 18:23 new edits appeared: `electron/edgeTts.cjs`, `tests/edgeTts.test.cjs`, a rewritten `importState`, validation in `api.ts`, and edits to `preload.cjs`, `types.ts` and `main.cjs`. The results below are for the snapshot unless marked **current tree** (checked at 18:23).

New tests:
- `tests/qa2.test.cjs`: 19 tests (16 gates + 3 `todo` for open bugs).
- `tests/helpers/qa-helpers.cjs`: shared fixture, SSE reader, and a fake DOM that runs the real overlay script.

**Real-app runs.** The real app ran minimised and was driven through DevTools (CDP). An offscreen Chromium window played the role of OBS: `qascripts/viewer/main.cjs` loads the overlay URL and takes screenshots on command. Browser mode was tested by loading `dist/index.html` in Chromium with **no preload**, so `window.allhouse` is undefined (`qascripts/browsermode/main.cjs`). No visible windows and no Vite were used; port 5180 was not touched. All Electron processes were killed afterwards (count 0). Evidence is in scratchpad `qaout/r2/` (`v0…v6-*.png/json`, `app-*.png`, `steps.log`, `browser-mode.log`).

**Interference, again.** The click spy saw 6 trusted (real) clicks on the overlay editor panel during the `r2steps` run. My recorded results all match the actions my script took.

**Dev's edit to my BUG-9 assertion is legitimate.** Dev changed only the precondition on the warning wording, from "preserved until you save" to "kept as workspace.corrupt-". The preservation check was untouched. It was weak, though: it accepted any file whose name matched `/corrupt|bak/`. `qa2` now checks that the backup is byte-identical to the original, that it survives a sample chat and a save, and that a second launch makes a second backup. All three pass. My other BUG tests in `qa.test.cjs` are unchanged apart from the removed `todo` flags (diffed).

| # | Check | Method | Result | Evidence |
|---|---|---|---|---|
| R2-B1 | `tsc -b` | node tsc | PASS (snapshot) / **FAIL (current tree)** | snapshot exit 0. At 18:23: `src/api.ts(15,495): error TS1005: ')' expected` → R2-BUG-0 |
| R2-B2 | `vite build` | node vite | PASS (snapshot) | `✓ built in 1.57s`, `index-CsUHJtzn.js` 292 kB |
| R2-B3 | Full suite `node --test "tests/*.test.cjs"` | node | PASS (snapshot) | 67 tests: 63 pass, 3 todo, 1 skipped (`edgeTts` LIVE test, needs network), 0 fail. **Current tree:** 3 browser-fallback tests fail because `api.ts` no longer compiles. |
| V1 | BUG-1: TEST CHAT label | qa/qa2 tests + real Chromium overlay | PASS | `v4-test-chat.png`: yellow `TEST CHAT` tag; text `บ้านข้างๆ · youtube TEST CHAT \| <img src=x onerror=alert(1)> สวัสดี TEST`; 0 injected elements |
| V2 | BUG-2: skip keeps chat | qa2 (every SSE event fed into the real script) + real Chromium | PASS | `v5b-after-skip.json`: chat row kept, `alertVisible:false`; skip/clear send `hide-alert`; only Clear history sends `clear` |
| V3 | BUG-3: separate preview and OBS lanes | qa2 (5 tests incl. a real 5 s timer test) | PASS | `o1,o2` play while `p1` completes independently; pause holds both; skip goes OBS → preview → oldest queued; restart interrupts both lanes |
| V4 | BUG-4: no rebroadcast on draft-only saves | qa2 + real Chromium | PASS | language/theme/tts/draft saves send 0 `state`; publish sends exactly 1; `v1-draft-edited.json` overlay unchanged |
| V5 | BUG-5: import goes to the draft, not live | qa2 (snapshot) | PASS (see R2-BUG-1) | published title and `publishedAt` unchanged; no `state` broadcast. The native file dialog was not driven. |
| V6 | BUG-6: suffix does not stack | qa2 (5 names incl. 80-char Thai) | PASS | ≤80 chars, exactly one suffix, re-import idempotent |
| V7 | BUG-7: history rebuilt from known fields | qa + qa2 (`cleanHistoryEntry` unit test) | PASS | extra/`token` fields dropped; `sourceMode` forced to `test`; bad status → completed; id >64 chars rejected |
| V8 | BUG-8: chat allowed when alert queue is full | qa + qa2 | PASS (desktop) | 51st alert refused, chat accepted. Browser fallback in the snapshot still refused chat → R2-BUG-2 |
| V9 | BUG-9: corrupt file backed up | qa2 (byte compare, 2 launches, valid-JSON-but-invalid file) | PASS | `workspace.corrupt-<ts>.json` == original; never overwritten |
| V10 | BUG-10: toast position | screenshot | PASS | `app-overlay-obs-panel.png`: toast top-centre, no longer over the toggle |
| V11 | BUG-11: voice dedupe | real app | PASS (see R2-BUG-5) | "พบ 3 เสียง (ไทย 0 · อังกฤษ 3)": David, Mark, Zira (web) |
| V12 | BUG-12: preview matches overlay | screenshot | PASS | in-app preview shows `TEST ALERT · TWITCH / Allhouse test — ติดตามช่องแล้ว!` and the `TEST CHAT` tag |
| V13 | BUG-13: test script runs all suites | `package.json` | PASS | `node --test "tests/*.test.cjs"` (picks up `qa2` too) |
| RG | Round-1 gates G1–G13 | `runtime.test` + `qa.test` | PASS (snapshot) | all 38 round-1 tests pass, including loopback (refused on 26.26.246.124 and 192.168.0.110), Host/Origin, export, XSS, bounds |
| O1 | Publish → overlay updates (real Chromium) | CDP + viewer | PASS | `v1` title unchanged while the draft was edited (pill "ยังไม่เผยแพร่") → Publish → `v2` title `ROUND2 <b>DRAFT</b> ห้องใหม่`, accent `#ff3366`; toast "เผยแพร่แล้ว • ส่งไปหน้าโอเวอร์เลย์ที่เปิดอยู่ 1 หน้า"; button turns to disabled "เผยแพร่แล้ว • ไม่มีอะไรเปลี่ยน" |
| O2 | Test alert button → TEST ALERT (real Chromium) | CDP + viewer | PASS | `v3-test-alert.png`: `TEST ALERT · TWITCH \| Allhouse test — ติดตามช่องแล้ว!` |
| O3 | OBS badge and size step | CDP | PASS | amber "ยังไม่มีหน้าโอเวอร์เลย์เปิดอยู่" with no viewer → "เชื่อมแล้ว 1 หน้า (ยังไม่ใช่การไลฟ์)" with the viewer; step 2 reads "ตั้ง Width 1920 และ Height 1080" |
| O4 | Follow sample hides the message box | CDP | PASS | textarea removed for follow; feed shows "ติดตามช่องแล้ว" |
| O5 | Voice preview works with the bot off | CDP | PASS | Preview button enabled while the TTS toggle is `false`; with no Thai voice the default text switches to English |
| BM1 | Browser mode: notice, OBS controls disabled with a reason | Chromium, no preload | PASS | `browser-mode.log`: bridge `undefined`; badge "โหมดเบราว์เซอร์ไม่มี OBS" (amber); test button DISABLED + "ใช้ได้ในแอพเดสก์ท็อป"; Copy link disabled; OBS option "(เฉพาะแอพเดสก์ท็อป)" disabled; import disabled with helper text |
| BM2 | Browser mode: toasts are truthful | Chromium, no preload | PASS | quick sample "แสดงเฉพาะในแอพ ไม่ไป OBS"; publish "บันทึกฉบับเผยแพร่แล้ว (ต้องเปิดแอพเดสก์ท็อปก่อน OBS ถึงจะเห็น)" |
| BM3 | `api.ts` fallback logic | qa2 (TS-transpiled `api.ts` in a VM with fake storage and timers) | PASS (snapshot) / **FAIL (current tree)** | validation, trimming, 5 s lifecycle, pause/skip/clearHistory, localStorage persistence, storage-full warning, corrupt storage → defaults, `errorText` prefix strip |
| N1 | Real OBS Studio Browser Source | — | NOT TESTED | OBS Studio is not installed on this machine; see the procedure below |
| N2 | Audible speech through speakers / OBS capture | — | NOT TESTED | no human listener; only WAV generation and the bridge were exercised in round 1 |
| N3 | Thai voice playback | — | NOT TESTED | no Thai voice is installed (`ไทย 0`); only the "Thai part skipped" path is reachable |
| N4 | New Edge/online TTS path (`edgeTts.cjs`) | — | NOT TESTED | added during this round, outside round-2 scope; its LIVE test is skipped by design (it sends text to Microsoft) |

**Totals (round 2):** 29 PASS, 2 FAIL (both current-tree only: R2-B1 and BM3), 4 NOT TESTED. Rows R2-B1 and BM3 are counted under FAIL. On the snapshot they pass.

### Round 2 bugs

0. **R2-BUG-0 — Blocker (current tree) — `src/api.ts` no longer compiles.** `src/api.ts:15`: the new `sceneOk` regex `/^data:image/(png|jpeg|webp)…/` has an unescaped `/`.
   Repro: `tsc -b`.
   Expected: exit 0.
   Actual: `TS1005 ')' expected` ×3, and the browser-fallback tests fail. `scripts/start.ps1` (tsc → vite build) cannot rebuild the app; the old `dist/` from 18:14 still runs. Introduced 18:21:58, after the "38/38" claim. Fix: `/^data:image\/(png|jpeg|webp);base64,…$/`.
1. **R2-BUG-1 — Minor — Import throws away one of the two layouts in a backup.**
   - Snapshot (`runtime.cjs` 18:07): the backup's *published* layout was dropped.
   - Current tree (18:22): the backup's *draft* is dropped instead (`draft: next.published`).
   Either way a backed-up layout is lost without telling the user. Test: `qa2` `R2-BUG-1` (todo).
2. **R2-BUG-2 — Minor — The browser fallback refuses chat when 50 alerts are queued** (parity with BUG-8). `src/api.ts` `sendEvent`.
   In the current tree the line reads `input.type!=='chat'&&…`, so it looks fixed, but this cannot be verified while R2-BUG-0 stands. Test: `R2-BUG-2` (todo).
3. **R2-BUG-3 — Minor — The browser fallback `saveState` does no validation** (width 100000 and theme `javascript` were accepted).
   The current tree adds `validate()`; same status as R2-BUG-2. Test: `R2-BUG-3` (todo).
4. **R2-BUG-4 — Minor — The test-alert toast promises an alert that the overlay will drop.** `src/main.tsx:94` (`obsOutcome`).
   Repro: turn off "แสดงการแจ้งเตือน" → Publish → "ส่งการแจ้งเตือนทดสอบไป OBS".
   Expected: the toast says alerts are hidden in the published layout.
   Actual: "จะขึ้นบนหน้าโอเวอร์เลย์ 1 หน้า (ติดป้าย TEST)", while the overlay shows nothing (`v6-alerts-off.json`, `alertVisible:false`). The same happens when the queue is paused: step 3 promises an alert "for 5 seconds" and nothing appears. Chat has the same gap when "Show chat" is off.
5. **R2-BUG-5 — Minor — Dedupe silently drops a saved voice choice.** `src/main.tsx:22` and `:43`: web voices win and the SAPI duplicates are removed.
   Repro: `tts.englishVoice = "Microsoft Zira Desktop"` (a valid round-1 choice) → open Chat TTS.
   Expected: Zira stays selected (map it to the web "Microsoft Zira").
   Actual: the select shows "อัตโนมัติ" and playback uses the first English voice, David (`app-voice-orphan.png`).
6. **R2-BUG-6 — Minor (process) — Code changed under test without notice.** New `edgeTts.cjs` and its test, plus runtime, preload, types and api edits, landed during round-2 verification.
   The online TTS path sends chat text to Microsoft. It needs its own privacy and consent review and a QA round before release.

### Current-tree re-check (18:26)

Dev kept fixing while this report was being written.

- **Builds:** `tsc -b` exit 0 and `vite build` OK, so **R2-BUG-0 is fixed**.
- **Tests:** `node --test "tests/*.test.cjs"` → 69 tests, 68 pass, 1 skipped (`edgeTts` LIVE), 0 fail, 0 todo.
- **R2-BUG-1, -2 and -3:** Dev removed my `todo` flags on the three R2 tests. I checked that the assertions are unchanged, and they now pass, so these three are **fixed at unit level**.
- **Not re-run:** the current tree (`main.tsx` 18:24, `runtime.cjs` 18:24, `components.tsx` and `platformIcons.ts` 18:26) has **not** been re-verified in Electron. The real-Chromium rows O1–O5 and BM1–BM2 apply to the 18:14 build.
- **Still open in the current source:** R2-BUG-4 (`obsOutcome` unchanged) and R2-BUG-5 (`voiceKey` dedupe has no mapping for saved voices). R2-BUG-6 also stands.
- **Totals on the current tree:** the 2 snapshot FAILs (R2-B1, BM3) now PASS, giving **31 PASS, 0 FAIL, 4 NOT TESTED**. Open bugs: 2 Minor (R2-BUG-4, R2-BUG-5) plus the process issue (R2-BUG-6).

### Real OBS acceptance procedure (for the user, manual)

Not run by QA: OBS Studio is not installed here, and no one was available to listen. Allow about 15 minutes, with OBS Studio 30+ installed and speakers or headphones on.

1. Start Allhouse (`Start Allhouse.cmd`). Wait for the "บันทึกในเครื่องแล้ว" status.
2. Allhouse → **ออกแบบโอเวอร์เลย์** → click **คัดลอกลิงก์**. Note Width and Height from step 2 (for example 1920 × 1080).
3. OBS → Scene → Sources **+** → **Browser** → name it "Allhouse" → paste the URL. Set **Width/Height** to the values from step 2. Leave "Use custom frame rate" off and "Shutdown source when not visible" off → OK.
   - Pass: OBS shows the title box top-left over a transparent background (no white/black rectangle), and Thai text renders with no boxes or tofu.
   - Pass: Allhouse's OBS badge turns green, "เชื่อมแล้ว 1 หน้า (ยังไม่ใช่การไลฟ์)".
4. In Allhouse, change the title and do **not** publish. Pass: OBS is unchanged. Press **เผยแพร่ไป OBS**. Pass: OBS updates within about 1 s.
5. Click **ส่งการแจ้งเตือนทดสอบไป OBS**. Pass: OBS shows a box labelled **TEST ALERT · TWITCH** for about 5 s, then it disappears.
6. Chat & activity → Destination **ส่งไป OBS ด้วย** → Send sample (chat). Pass: OBS shows the row with a yellow **TEST CHAT** tag. Then send a follow and press **ข้าม** while it is showing. Pass: the alert hides and the chat row stays.
7. Close Allhouse while OBS is open, then reopen it. Pass: OBS reconnects by itself within a few seconds and shows the published layout. No old alert replays.
8. Audio: Chat TTS → **ทดลองฟัง**. Pass: you hear the English sentence through the speakers. Press **หยุดและล้างคิว** mid-sentence. Pass: it stops immediately. If OBS captures Desktop Audio, check that the OBS audio meter moves. This is the only place preview audio can reach the stream; Allhouse does not route audio to OBS.
9. Thai voice: install a Thai voice (Windows Settings → Time & language → Speech → Manage voices), restart Allhouse, and preview "สวัสดีทุกคน". Pass: the Thai voice is listed and audible.
10. Record results (pass/fail, OBS version, Windows display scale, screenshots) in this file under "Real OBS run".
