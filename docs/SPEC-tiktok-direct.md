# Spec: TikTok LIVE แบบเชื่อมตรง (ไม่ต้องเปิด TikFinity)

สถานะ: **พักไว้** (2026-10-22) — ยังไม่ทำตอนนี้ ยังใช้ TikFinity ต่อไป

## Objective

ตอนนี้ Allhouse อ่าน TikTok LIVE ผ่าน TikFinity Desktop (`electron/platforms/tiktok.cjs` ต่อ `ws://127.0.0.1:21213/`)
ผู้ใช้ต้องติดตั้ง + เปิด TikFinity + ล็อกอิน TikTok ในนั้นทุกครั้ง

เป้าหมาย: ให้ Allhouse คุยกับ TikTok เองโดยตรง และล็อกอิน TikTok ได้ในแอพเลย ไม่ต้องมี TikFinity

**แกนของ TikFinity คืออะไร** (ผู้สร้างเดียวกับไลบรารี TikTok-Live-Connector):
1. หา `roomId` ของไลฟ์จาก `@username`
2. ขอ "ลายเซ็น" (X-Bogus / msToken ฯลฯ) ที่ TikTok บังคับ — **นี่คือส่วนยากที่สุด** TikFinity/TikTok-Live-Connector ใช้เซิร์ฟเวอร์เซ็นของบุคคลที่สาม (Euler Stream)
3. ต่อ WebSocket `wss://webcast*.tiktok.com/webcast/im/push/v2/` ซึ่งส่งข้อมูลเป็น **protobuf**
4. ถอด protobuf เป็นข้อความ: `WebcastChatMessage`, `WebcastGiftMessage`, `WebcastSocialMessage` (follow/share), `WebcastMemberMessage` (join), `WebcastLikeMessage`, ซับ ฯลฯ

**แนวทางที่เสนอ (B): ให้หน้าเว็บ TikTok ในแอพเซ็นให้เอง**
- หน้าต่างล็อกอิน TikTok ภายในแอพ (Electron `BrowserWindow`, session แยก `persist:tiktok`) — ผู้ใช้ล็อกอินเองกับ tiktok.com จริง แอพไม่เห็นรหัสผ่าน คุกกี้อยู่ใน session นั้นเท่านั้น
- ตอนเชื่อมต่อ: เปิด `https://www.tiktok.com/@<user>/live` ในหน้าต่างซ่อน (session เดียวกัน) โค้ดของ TikTok เองจะเซ็นและเปิด WebSocket
- Allhouse ดักเฟรมผ่าน `webContents.debugger` (CDP `Network.webSocketFrameReceived`) แล้วถอด protobuf ด้วยตัวถอดของเราเอง
- ไม่มีเซิร์ฟเวอร์บุคคลที่สาม ไม่มี API key ไม่ต้องเพิ่ม dependency

ทางเลือกที่ไม่เลือกเป็นค่าเริ่มต้น:
- (A) ใช้ npm `tiktok-live-connector` + เซิร์ฟเวอร์เซ็น Euler Stream — โค้ดน้อยกว่า แต่ส่ง username/room ไปบุคคลที่สาม มี rate limit อาจต้องใช้ API key และเพิ่ม dependency
- (C) เขียนตัวเซ็น X-Bogus เอง — เปราะมาก TikTok เปลี่ยนบ่อย ไม่คุ้ม

### User stories
- ในฐานะสตรีมเมอร์ ฉันกด "ล็อกอิน TikTok" ในหน้าเชื่อมต่อ ล็อกอินในหน้าต่างที่เด้งขึ้น แล้วแอพแสดง `@ชื่อฉัน`
- ฉันกด "เชื่อมต่อ" แอพรอจนกว่าฉันจะเริ่มไลฟ์ แล้วแชท / ผู้ติดตาม / ของขวัญ / ซับ เข้ามาในห้องและ OBS widget เหมือนเดิม
- ถ้า TikTok ขึ้น CAPTCHA แอพบอกให้ฉันเปิดหน้าต่าง TikTok แล้วแก้เอง (แอพไม่พยายามข้าม CAPTCHA)
- ฉันกด "ออกจากระบบ TikTok" แล้วคุกกี้ใน `persist:tiktok` ถูกลบหมด

## สมมติฐาน (แก้ได้ตอนนี้)
1. ใช้แนวทาง B เป็นค่าเริ่มต้น
2. อ่านไลฟ์ของ **ช่องที่ล็อกอิน** เป็นหลัก แต่ยอมให้พิมพ์ `@ชื่อ` อื่นได้ (อ่านไลฟ์สาธารณะได้แม้ไม่ล็อกอิน)
3. **ยังเก็บโหมด TikFinity ไว้** เป็นตัวเลือก "ขั้นสูง" สำรองเผื่อ TikTok เปลี่ยนระบบ
4. Event ที่รองรับเท่าเดิม: chat, follow, subscribe, gift (รวมกฎ combo `repeatEnd`) — like/join/share ยังไม่แสดง
5. รูปแบบ event ที่ส่งออกเหมือน `toEvent` เดิมทุกประการ → widget / TTS / ห้องแชทไม่ต้องแก้
6. ไม่ใช้ API ทางการ (TikTok ไม่มี API แชทสาธารณะ) — อาจพังเมื่อ TikTok เปลี่ยนหน้าเว็บ ต้องแสดงคำเตือนแบบเดียวกับ Kick/YouTube
7. แอพไม่ส่ง TikTok ไปนอกเครื่อง ไม่แตะรหัสผ่าน ไม่อ่านคุกกี้ออกมาเก็บเอง

## Tech Stack
Electron 41 (main process, CommonJS `.cjs`), React 19 + TypeScript (renderer), Node `node:test`. ไม่เพิ่ม dependency ใหม่ (protobuf ถอดด้วยมือ — ใช้แค่ wire type 0/2/5/1)

## Commands
```
Test:      pnpm test            (node --test "tests/*.test.cjs")
Typecheck: pnpm exec tsc -b
App:       pnpm app             (build แล้วเปิด Electron)
Package:   pnpm package
```

## Project Structure
```
electron/platforms/tiktok.cjs          → คงไว้ (โหมด TikFinity) แยก toEvent ที่ใช้ร่วมได้
electron/platforms/tiktokDirect.cjs    → ใหม่: ต่อไลฟ์ผ่านหน้าต่างซ่อน + CDP, รอไลฟ์เริ่ม, reconnecting()
electron/platforms/tiktokProto.cjs     → ใหม่: ตัวถอด protobuf ขั้นต่ำ + map Webcast* → event (pure, ทดสอบได้)
electron/tiktokAuth.cjs                → ใหม่: หน้าต่างล็อกอิน, เช็คสถานะ/ชื่อผู้ใช้, ออกจากระบบ (session persist:tiktok)
electron/connections.cjs, main.cjs, preload.cjs → ต่อสาย connector + IPC login/logout/status
src/ConnectionsPage.tsx, src/api.ts, src/types.ts → การ์ด TikTok: ปุ่มล็อกอิน, ชื่อ @, เลือกโหมด
tests/tiktokProto.test.cjs             → ใหม่
docs-site/connections.html, DEVLOG.md  → อัปเดตคำอธิบาย
```

## Code Style
ตามไฟล์ platform เดิม: CommonJS, `'use strict'`, คอมเมนต์หัวไฟล์บอกแหล่งที่มา + วันที่ยืนยัน, ฟังก์ชัน pure แยกจากการเชื่อมต่อเพื่อทดสอบ, ใช้ `reconnecting()` จาก `common.cjs`
```js
/** One decoded Webcast message -> Allhouse event or null. */
function toEvent(method, m) {
  switch (method) {
    case 'WebcastChatMessage': return m.content ? { type: 'chat', name: who(m.user), message: String(m.content), ...pic(m.user) } : null;
    // ...
    default: return null; // likes, joins, shares: not shown
  }
}
```
UI: ข้อความสองภาษาผ่าน `t('ไทย','English')` เหมือนการ์ดอื่น

## Testing Strategy
- **Unit (`node:test`)**: ตัวถอด protobuf กับ bytes ที่ประกอบเอง (varint, length-delimited, nested, field ซ้ำ, ข้อมูลเสีย → ไม่ throw); mapping chat/follow/subscribe/gift(+combo); การตรวจ `@username`
- **Fixture จริง**: เก็บเฟรมจริง 1–2 เฟรม (ตัดข้อมูลส่วนตัวออก) จากไลฟ์ที่กำลังออนแอร์ ไว้ใน `tests/fixtures/` เพื่อกันถอยหลัง
- **Manual (Electron จริง)**: ล็อกอิน → เปิดไลฟ์สาธารณะที่กำลังไลฟ์ → แชทถึง OBS chat widget SSE ภายใน 10 วินาที; ของขวัญถึง `/w/<token>/gift`
- เทสต์เดิมของ TikFinity ต้องผ่านต่อ

## Boundaries
- **Always:** ให้ผู้ใช้ล็อกอินเองในหน้า tiktok.com จริง; เก็บคุกกี้ไว้ใน `persist:tiktok` เท่านั้น; แสดงคำเตือน "ไม่ใช่ API ทางการ"; รันเทสต์ก่อน commit
- **Ask first:** เพิ่ม dependency (เช่น `protobufjs`, `tiktok-live-connector`); ส่งข้อมูลใดๆ ไปเซิร์ฟเวอร์บุคคลที่สาม; ลบโหมด TikFinity
- **Never:** อ่าน/เก็บ/ส่งรหัสผ่านหรือคุกกี้ออกนอก session; พยายามข้ามหรือแก้ CAPTCHA อัตโนมัติ; ส่งข้อความ/คอมเมนต์ใน TikTok แทนผู้ใช้; ใส่ข้อมูลส่วนตัวใน fixture

## Success Criteria
1. ไม่ได้เปิด TikFinity เลย กดล็อกอิน → ล็อกอิน → การ์ดแสดง `@ชื่อ` และยังจำได้หลังปิด–เปิดแอพ
2. กดเชื่อมต่อขณะไม่ได้ไลฟ์ → สถานะ "รอไลฟ์เริ่ม" (ไม่ใช่ error) และต่อเองภายใน 60 วินาทีหลังเริ่มไลฟ์
3. แชทจริงขึ้นในห้องและ OBS widget ช้าไม่เกิน ~5 วินาที; ของขวัญ combo แจ้งครั้งเดียวตอนจบ combo
4. ไลฟ์จบ / เน็ตหลุด → retry ด้วย backoff แบบ platform อื่น ไม่ค้าง
5. CAPTCHA / ต้องล็อกอินใหม่ → สถานะ error ที่บอกวิธีแก้ + ปุ่มเปิดหน้าต่าง TikTok
6. ออกจากระบบ → คุกกี้ใน `persist:tiktok` หาย, การเชื่อมต่อหยุด
7. หน้าต่างซ่อนถูกปิดเมื่อ disconnect/ปิดแอพ (ไม่มี renderer ค้างใน Task Manager)
8. `pnpm test` และ `tsc -b` ผ่าน

## Open Questions
1. **แนวทาง B (หน้าต่างซ่อน + ดักเฟรม) โอเคไหม?** ข้อแลก: ใช้ RAM เพิ่ม ~150–300 MB ระหว่างเชื่อมต่อ แลกกับไม่พึ่งเซิร์ฟเวอร์ใคร — หรืออยากได้ A (npm + Euler Stream) ที่เบากว่าแต่พึ่งบุคคลที่สาม?
2. **เก็บโหมด TikFinity ไว้เป็นสำรองไหม** หรือลบทิ้งเลย?
3. **จำเป็นต้องล็อกอินไหม** — ไลฟ์สาธารณะอ่านได้โดยไม่ล็อกอิน แต่ล็อกอินช่วยลด CAPTCHA, อ่านไลฟ์จำกัดอายุได้ และเติม `@ชื่อ` ให้อัตโนมัติ เสนอ: ล็อกอินเป็นทางหลัก แต่ไม่บังคับ
4. อยากได้ event เพิ่มไหม (like, คนเข้าห้อง, share, จำนวนคนดู) หรือเท่าเดิมก่อน?
5. ความเสี่ยงด้าน ToS: การอ่านไลฟ์ผ่านช่องทางไม่ทางการขัดเงื่อนไข TikTok ได้ (TikFinity เองก็ทำแบบนี้) รับได้สำหรับ alpha ใช้งานเองไหม?
