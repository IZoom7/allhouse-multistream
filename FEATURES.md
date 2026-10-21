# Allhouse — Feature Specification

สถานะ: แบบออกแบบก่อนพัฒนา (ยังไม่มีฟีเจอร์ที่ implement แล้ว)  
ฉบับ: 0.3 • วันที่: 20 ตุลาคม 2026  
เอกสารที่เกี่ยวข้อง: [APPINFO.md](APPINFO.md) · [APPDOC.md](APPDOC.md)

## 1. Product definition

Allhouse คือ desktop application สำหรับรวบรวมกิจกรรมจากหลายแพลตฟอร์ม สร้าง overlay และเล่น alerts แล้วแสดงผลผ่าน Browser Source ของ OBS Studio เหมาะกับ streamer ที่ต้องการจัดการงานทั้งหมดในที่เดียว โดยเฉพาะผู้ใช้ภาษาไทยและอังกฤษ

**ขอบเขตที่ตีความในฉบับนี้:** multiplatform หมายถึงรับ events/chat จากหลายแพลตฟอร์มพร้อมกัน ไม่ได้หมายถึงส่งสัญญาณวิดีโอหลายปลายทาง ตัว encode, broadcast และจัด scene หลักเป็นหน้าที่ของ OBS การทำ restream service เป็นอีกผลิตภัณฑ์หนึ่งและไม่อยู่ในแผนนี้

กลุ่มเป้าหมายแรก: solo streamer ใช้ Windows และ OBS ในเครื่องเดียว มีหนึ่ง channel ต่อแพลตฟอร์ม รองรับหลายแพลตฟอร์มใน workspace เดียว

หลักการ:

- ตั้งค่าเริ่มต้นได้ง่าย แต่ควบคุม layout, rules และ queue ได้จริง
- ข้อมูลตั้งค่าและ assets อยู่ในเครื่อง การแก้ไขและทดสอบไม่บังคับสมัคร Allhouse account
- แยกสถานะ platform connection, relay และ OBS renderer เพื่อบอกสาเหตุได้ตรงจุด
- ไม่แสดง capability ที่แพลตฟอร์มไม่รองรับเหมือนเป็นความสามารถที่พร้อมใช้งาน
- ความเสถียรระหว่าง live สำคัญกว่าการมี animation หรือ integrations จำนวนมาก

### Connection UX — ผู้ใช้ไม่ต้องตั้งค่า developer tools

เป้าหมาย: **กดเชื่อมต่อ → ล็อกอิน/เลือกบัญชี → กดอนุญาต → พร้อมใช้งาน** หน้ายินยอมและ 2FA ของแพลตฟอร์มยังจำเป็นเมื่อผู้ให้บริการร้องขอ Allhouse ไม่ข้ามขั้นตอนเหล่านี้

- ทีม Allhouse รับผิดชอบ developer registration, review, API credentials, callback URLs, webhook และ service operations; ผู้ใช้ไม่ต้องขอ API access หรือสร้าง developer project
- ค้นหา channel/live ให้อัตโนมัติเมื่อมีคำตอบเดียว; ถ้ามีหลายตัวเลือกให้เลือกจากชื่อ/ภาพ ไม่ให้กรอก channel ID/liveChatId
- ถ้ายังไม่ live ให้แสดง “เชื่อมต่อแล้ว — รอเริ่มไลฟ์” และตรวจตาม quota ที่เหมาะสม ไม่บังคับ login ใหม่
- จำบัญชีและ refresh การเชื่อมต่ออัตโนมัติตามที่ provider อนุญาต; ขอ reconnect เมื่อ revoke/หมดสิทธิ์จริง
- หน้าใช้งานปกติใช้คำว่า “อ่านแชท”, “รับการแจ้งเตือน”, “เชื่อมใหม่”; เก็บ scope/token/webhook details ใน diagnostics สำหรับทีม support
- Chat TTS ใช้บริการที่ Allhouse จัดการให้: **เปิดอ่านแชท → เลือกเสียง → ทดลองฟัง** ไม่ต้องสร้างบัญชี Azure หรือวาง API key; แสดงโควตา/ค่าใช้บริการของ Allhouse ก่อนใช้และไม่เปิดค่าใช้จ่ายโดยเงียบ
- เกณฑ์ตรวจรับ F03/F05/F25/F29: ผู้ทดสอบทั่วไปทำ flow ได้โดยไม่มี developer console/API key; connection และ TTS service ต้องมี production readiness ก่อนประกาศพร้อม

## 2. จำนวนฟีเจอร์และวิธีนับ

**แผนทั้งหมด 40 ฟีเจอร์:** MVP 24 ฟีเจอร์ + V1 10 ฟีเจอร์ + Future/Conditional 6 ฟีเจอร์

หนึ่ง Feature ID นับเป็นหนึ่งฟีเจอร์หลัก รายการย่อยในคำอธิบายและ acceptance criteria ไม่เพิ่มจำนวน หมายเลขไม่เปลี่ยนเมื่อเลื่อน release; ให้เปลี่ยนคอลัมน์ระยะและบันทึกเหตุผลแทน

| ระยะ | จำนวน | เป้าหมาย |
|---|---:|---|
| MVP — F01–F24 | 24 | ใช้ Twitch/YouTube, ออกแบบ overlay, แสดงใน OBS และดูแล live session ได้ |
| V1 — F25–F34 | 10 | เพิ่ม Kick, เครื่องมือควบคุมและปรับแต่งที่ลึกขึ้น |
| Future/Conditional — F35–F40 | 6 | ขยายตามสิทธิ์ API ความต้องการ และผลทดสอบ |
| **รวม** | **40** | ไม่ใช่คำยืนยันว่าจะปล่อยทุกฟีเจอร์พร้อมกัน |

Security, accessibility, performance, packaging และ operational readiness เป็น release requirements ใน APPINFO ไม่ได้นับเพิ่มเป็น user features

## 3. MVP — 24 ฟีเจอร์

| ID | ฟีเจอร์ | ขอบเขตและเกณฑ์ยอมรับหลัก |
|---|---|---|
| F01 | First-run onboarding | เลือก TH/EN, theme, สร้าง workspace และเข้าสู่การทดสอบ OBS ได้; ข้ามการเชื่อมบัญชีเพื่อทดลองได้ |
| F02 | Local workspace | สร้าง/เปิด/เปลี่ยนชื่อ/สำเนา workspace; มีหนึ่ง active workspace; สลับแล้ว URL เดิมของอีก workspace ไม่แสดงข้อมูลผิดชุด |
| F03 | Platform connection center | แสดง account, channel, permissions, capability และสถานะ; เชื่อมใหม่/ตัดการเชื่อมต่อได้; revoke แล้วหยุดรับ event |
| F04 | Twitch connector | OAuth และ EventSub; รับ chat, follow, subscription, gift, cheer, raid ตาม scope/สิทธิ์; permission ขาดต้องบอกเป็นราย capability |
| F05 | YouTube connector | เลือก active broadcast/live chat; รับ chat และ monetization/membership messages ที่ API ส่งและบัญชีมีสิทธิ์; จบ live แล้วแสดงสถานะ ended |
| F06 | Unified activity feed | รวม events ที่รองรับพร้อม platform badge, เวลาและประเภท; filter ตามแหล่ง/ประเภท; ไม่ตีความการซื้อต่างชนิดเป็นรายรับเดียวกัน |
| F07 | Reconnect & health | retry แบบ backoff; แสดง reconnecting, expired, quota limited; ไม่วนขอ OAuth หรือสร้าง alert ซ้ำเมื่อ reconnect |
| F08 | Overlay projects | สร้าง/สำเนา/เปลี่ยนชื่อ/ลบ overlay; preset 1920×1080, 1280×720, 1080×1920 และ custom |
| F09 | Visual layout editor | ลาก, resize, layer order, lock/hide, align, snap, undo/redo และป้อนค่าตัวเลข; save/reopen ไม่ทำตำแหน่งเพี้ยน |
| F10 | Starter templates | อย่างน้อย 3 แบบ: Minimal, Studio, Neon; template ใช้งานได้กับ TH/EN และ canvas แนวนอน/ตั้งผ่าน layout preset |
| F11 | Asset library | นำเข้า PNG/JPEG/WebP, WebM และ WAV/MP3 ภายใต้ข้อจำกัด APPINFO; preview และแจ้งไฟล์หาย/ไม่รองรับได้ |
| F12 | Core widgets | Text, image, shape, clock, latest event; widgets ผูกข้อมูลกับชนิด event ที่รองรับ; แสดง empty state ที่ตั้งค่าได้ |
| F13 | Alert appearance editor | ข้อความ, font, สี, media, เสียง, duration, enter/exit preset; จัดการข้อความไทยยาวโดยไม่ล้นกรอบ |
| F14 | Alert rules | จับคู่ platform + event type + เงื่อนไขจำนวน/ชนิดหน่วยที่ใช้ได้; priority ชัดเจน; มี fallback; ปิด rule ได้ |
| F15 | Durable alert queue | เรียง, pause/resume, skip, clear และ replay แบบระบุ manual; deduplicate delivery; restart ไม่เล่นย้อนหลังทั้งหมดอัตโนมัติ |
| F16 | Preview & test events | ส่งข้อมูลจำลองของทุก supported event; preview เป็นค่าเริ่มต้น; ส่ง test ไป OBS ต้องเลือกชัดเจน; ไม่เพิ่มยอดจริง |
| F17 | Local OBS Browser Source | สร้างและคัดลอก URL ของแต่ละ overlay; alpha background; OBS ใช้ URL ได้โดยไม่ติดตั้ง plugin ของ Allhouse |
| F18 | OBS setup & diagnostics | คู่มือเพิ่ม source, ตรวจ renderer heartbeat/resolution และ test alert; ไม่กล่าวว่า live แล้วเพียงเพราะ browser ต่ออยู่ |
| F19 | Unified chat widget | แสดงข้อความเข้า Twitch/YouTube พร้อม badge และ platform; จำกัดจำนวน/อายุข้อความ; ลบข้อความที่ได้รับ moderation event ตาม capability |
| F20 | Session safety controls | mute alerts, pause queue, hide chat, clear queue; สถานะเด่นชัด; ไม่ mute เสียงเกมหรือ OBS ทั้งระบบ |
| F21 | Local history | ค้นหา/filter event และผลเล่น alert; retention เริ่มต้น 7 วัน; export ประวัติที่เลือกโดยไม่ใส่ tokens; ล้างข้อมูลได้ |
| F22 | Backup & restore | export workspace, assets, rules แบบมี schema version; ไม่รวม credentials; import เป็น workspace ใหม่และตรวจไฟล์ก่อน |
| F23 | Language, theme & accessibility | TH/EN, Light/Dark/System; keyboard navigation, focus visible และ reduced motion; ตั้งค่าคงอยู่หลัง restart |
| F24 | Desktop lifecycle & support | tray/background mode, startup opt-in, ตรวจ update และ diagnostics export ที่ปิดบังข้อมูลลับ; ไม่ restart update ขณะ live |

## 4. V1 — 10 ฟีเจอร์

| ID | ฟีเจอร์ | ขอบเขตและเกณฑ์ยอมรับหลัก |
|---|---|---|
| F25 | Kick connector | รับ events ที่ได้รับสิทธิ์ผ่าน official webhook + Allhouse relay; ตรวจ signature; relay ล่มต้องแจ้งเฉพาะ channel ที่กระทบ |
| F26 | Optional OBS WebSocket link | จับคู่และตรวจ OBS, เพิ่ม Browser Source หลังผู้ใช้เลือก scene; ไม่สั่ง start/stop stream โดยอัตโนมัติ |
| F27 | Goals & counters | นับ events ที่เลือก, ตั้งเป้าหมายและ reset; หน่วย/currency แยกชัดเจน; replay และ test ไม่เพิ่มยอด |
| F28 | Advanced alert variations | แตกตาม tier, amount range และชุดภาพ/เสียง; deterministic priority; มี preview อธิบาย rule ที่ถูกเลือก |
| F29 | Multiplatform Chat TTS Bot | เปิดอ่านแชทเข้าอัตโนมัติจากทุก platform/channel ที่เชื่อมและมี chat capability; เสียงไทย/อังกฤษ, ตรวจภาษาอัตโนมัติ, คิวอ่านทีละข้อความ และเสียงออก OBS; รายละเอียดและเกณฑ์ตรวจรับด้านล่าง |
| F30 | Global shortcuts | กำหนดปุ่ม pause/mute/test/replay; แจ้ง conflict; ปิดได้; test shortcut ต้องเปิดใช้แยก |
| F31 | Profile switching | เก็บชุด overlays/rules/connections references สำหรับเกม/รายการ; switching มี confirmation ระหว่าง session และไม่เปิดเสียงซ้อน |
| F32 | Multi-account per platform | แยก account/channel mapping ใน workspace; route event ถูก channel; ไม่รวม identity ด้วย display name |
| F33 | Cross-platform chat actions | ตอบข้อความและ moderation เฉพาะ platform ที่ API/permission รองรับ; ระบุปลายทางทุกครั้ง; ไม่มี broadcast reply เป็นค่าเริ่มต้น |
| F34 | Session summary | สรุป count, top event types, errors และยอดแยก currency/unit; export; ไม่อ้างเป็นยอดสุทธิหรือรายงานทางบัญชี |

### F29 — Multiplatform Chat TTS Bot

ขยายฟีเจอร์ TTS เดิมเป็น **บอทอ่านแชทอัตโนมัติ** ยังอยู่ V1 และยังนับเป็นหนึ่งฟีเจอร์ รวมแผน 40 ฟีเจอร์เท่าเดิม บอททำหน้าที่อ่านข้อความ ไม่ต้องเป็น AI chatbot หรือส่งข้อความตอบกลับ

- เมื่อเปิด **Read every incoming chat** ทุก live chat message ที่ adapter รับได้จะเข้าคิวอ่านอัตโนมัติ ไม่ต้องพิมพ์คำสั่งหรือส่ง donation; เปิด/ปิดแยก platform/channel ได้
- ตัวเลือก All connected platforms ครอบคลุมบัญชีที่เชื่อมใหม่และมีสิทธิ์อ่าน chat ด้วย โดยแสดงรายการที่มีผลให้ผู้ใช้เห็น; TikTok จะเข้าร่วมได้เมื่อ F35 พร้อมจริง
- รองรับ Thai, English และ Auto; เลือกเสียงไทยกับอังกฤษแยกกัน พร้อม preview และตั้งความเร็ว/ระดับเสียง
- Auto ใช้ภาษาในข้อความ ไม่ใช้แพลตฟอร์มหรือสัญชาติผู้ส่ง; ข้อความไทยปนอังกฤษแยกช่วงภาษาแล้วอ่านต่อกันเป็นข้อความเดียว มี fallback สำหรับคำสั้น ตัวเลข และชื่อเฉพาะ
- ค่าเริ่มต้นอ่านข้อความอย่างเดียว; เลือกให้อ่านชื่อผู้ส่งและชื่อแพลตฟอร์มนำหน้าได้
- มีคิว TTS แยกจาก alerts: pause/resume, skip, stop current, clear และ mute TTS; ไม่พูดทับกันระหว่างแพลตฟอร์ม
- ข้อความที่ถูกลบก่อนเล่นต้องถูกยกเลิกเมื่อได้รับ moderation event; ถ้ากำลังอ่านให้หยุดเท่าที่ทำได้ ไม่สามารถย้อนคืนเสียงที่ออกไปแล้ว
- เปิดตัวกรองคำ, ข้าม URLs, emote-only และบัญชี bot แบบปรับได้ พร้อมเหตุผลเมื่อข้าม; ไม่ตัดข้อความจากผู้ส่งคนละคนเพียงเพราะข้อความเหมือนกัน
- ข้อความสดที่ผ่านตัวกรองจะอ่านเมื่อถึงคิว ภายใต้เพดานความยาว, queue, TTL และ quota; ไม่อ้างว่าอ่านข้อความได้ครบไม่จำกัดเมื่อ chat เร็วกว่าเสียงอ่าน
- Cloud TTS แจ้งข้อมูลที่จะส่งออกและค่าใช้บริการก่อนเปิดใช้งาน; มี budget cap และสถานะ quota/voice unavailable; ไม่เปลี่ยน engine หรือส่งข้อมูลไป provider ใหม่โดยเงียบ

**Acceptance criteria เพิ่มเติม**

1. แชทไทยจาก Twitch และอังกฤษจาก YouTube เข้าใกล้กัน: อ่านทั้งสองตามลำดับรับ โดยใช้เสียงที่เลือกและไม่ซ้อนกัน
2. ทดสอบ “สวัสดีทุกคน welcome to the stream” พร้อมตัวเลข/emoji; ฟังรู้เรื่องทั้งสองภาษาและไม่ตัดวรรณยุกต์ใน text preprocessing
3. Provider delivery ซ้ำอ่านครั้งเดียว; initial history, reconnect backfill และ test ไม่ถูกอ่านเป็น live chat โดยอัตโนมัติ
4. เสียงดังใน OBS ครั้งเดียวแม้เปิดหลาย overlays; local preview ไม่ออกอากาศเว้นแต่ผู้ใช้เลือกส่ง test
5. ปิด TTS แล้วหยุดเสียงปัจจุบันและยกเลิก pending; เปิดใหม่ไม่อ่านข้อความเก่าที่สะสมขณะปิด
6. Timeout/quota/queue overflow มีสถานะและจำนวน skipped ชัดเจน และไม่ทำให้ alerts หรือ chat widget หยุดทำงาน

## 5. Future / Conditional — 6 ฟีเจอร์

| ID | ฟีเจอร์ | เงื่อนไขก่อนเริ่ม |
|---|---|---|
| F35 | TikTok LIVE integration | ต้องยืนยัน official/authorized LIVE access, event catalog และข้อกำหนดกับผู้ให้บริการ; ไม่ใช้ scraping หรือ session-cookie capture เป็น baseline |
| F36 | Additional platform adapters | เลือกจาก demand; มี official/authorized event access และผ่าน security review; ไม่สัญญาว่า “ทุกแพลตฟอร์ม” รองรับเหมือนกัน |
| F37 | Cloud workspace sync | มี Allhouse account, conflict resolution, privacy/retention และต้นทุนที่ตกลง; credentials ไม่ติดไปกับ workspace |
| F38 | Remote companion control | ออกแบบ authentication, device pairing และ revoke ก่อนเปิด LAN/remote; ไม่เปิด local server สู่ internet โดยตรง |
| F39 | Theme marketplace | กำหนดสิทธิ์ assets, moderation, version compatibility และธุรกรรมก่อน; template ไม่มี arbitrary JavaScript |
| F40 | External integration SDK | signed/permissioned adapter หรือ authenticated event API; rate limits, schema validation และ isolation; ไม่เปิด plugin ใน privileged process |

## 6. Platform capability matrix

ตรวจเอกสารสาธารณะวันที่ 20 ตุลาคม 2026 ความพร้อมจริงยังขึ้นกับการลงทะเบียนแอพ, scope, review, สถานะ channel และ region ต้องยืนยันใน integration spike อีกครั้ง

| Platform | ระยะ | การรับข้อมูลที่ออกแบบ | เหตุการณ์เป้าหมาย | ข้อจำกัดที่ UI ต้องสื่อ |
|---|---|---|---|---|
| Twitch | MVP | EventSub WebSocket + API | chat, follow, sub/gift, cheer, raid | event แต่ละชนิดใช้ permission/เงื่อนไขต่างกัน; ไม่ถือว่าการ login ให้สิทธิ์ทุกอย่าง |
| YouTube | MVP | liveChatMessages.streamList; fallback list ตาม quota/backoff | chat, Super Chat/Sticker, membership-related messages ที่ API ส่ง | ต้องมี live chat ที่เข้าถึงได้; ไม่รับประกัน realtime subscriber alert ของผู้ติดตามทุกคน |
| Kick | V1 | public HTTPS webhook → relay → desktop | chat, follow, subscription/gift ตาม catalog ที่ได้รับสิทธิ์ | ต้องมี relay และ internet; localhost รับ webhook จาก Kick โดยตรงไม่ได้ |
| TikTok | Conditional | ยังไม่กำหนด transport จนยืนยัน access | LIVE chat/gifts ตามสิทธิ์ที่ได้จริง | Login/Content Posting API ไม่ใช่หลักฐานว่ามี LIVE events API ใช้งานทั่วไป |
| Other | Future | adapter contract | ตาม capability | ต้องผ่าน discovery แยกต่อแพลตฟอร์ม |

ไม่ cross-deduplicate โดยชื่อผู้ใช้หรือข้อความ: ผู้ใช้ชื่อเหมือนกันคนละแพลตฟอร์มเป็นคนละ identity และการส่งข้อความเดียวกันสองแพลตฟอร์มเป็นสอง events

## 7. Release gates และลำดับการพัฒนา

ไม่มีการกำหนดวันส่งมอบก่อนทำ technical spikes และประเมินกำลังทีม

1. **Discovery gate:** ยืนยัน personas, Windows-first, same-machine OBS, scope MVP และ developer registrations; ทำ capability evidence ต่อ platform
2. **Integration spikes:** พิสูจน์ Twitch OAuth/EventSub, YouTube live chat และ OBS transparency/audio/reload บนเครื่องเป้าหมาย; สรุป scopes ที่ต้องขอจริงก่อนสร้าง consent UI
3. **Foundation:** F01–F03, F07–F09, F17, F23 พร้อม storage/security boundary
4. **Event-to-screen slice:** F04–F06, F13–F16, F18 ให้ event จริงเดินครบถึง OBS
5. **Creator workflow:** F10–F12, F19–F22, F24; ทดสอบตั้งแต่ติดตั้งใหม่ถึง restore
6. **MVP beta gate:** ครบ 24 features, ผ่าน security, load, accessibility และ recovery criteria ใน APPINFO; เอกสาร APPDOC ตรงกับ UI จริง
7. **V1 gate:** Kick relay พร้อม monitoring/tenant isolation/replay protection, และทดสอบแต่ละ feature F25–F34 ก่อนประกาศพร้อมใช้งาน

Feature ที่ติด provider approval ต้องแสดง unavailable พร้อมเหตุผล ไม่ปล่อย mock connector แล้วนับว่าฟีเจอร์เสร็จ

## 8. Out of scope

- Video capture/encoding, RTMP forwarding, cloud restream และการแทน OBS Studio
- รับเงินจริง, payment processing, payout หรือรวมมูลค่า gifts/coins/bits เป็นเงินโดยสมมติ conversion
- Bot automation, engagement manipulation และการเก็บรหัสผ่านบัญชีแพลตฟอร์ม
- Arbitrary HTML/JS plugins, embedded login browser และ public overlay hosting ใน MVP
- Collaboration หลาย operator, mobile native app และ remote OBS ข้ามเครื่องใน MVP

## 9. Success criteria ที่เสนอ

เป็นเป้าหมายสำหรับทดสอบ ไม่ใช่ผลวัดของซอฟต์แวร์ที่มีแล้ว

- ผู้ทดสอบใหม่อย่างน้อย 8 ใน 10 คนส่ง test alert เข้า OBS ได้ภายใน 10 นาที หลังเตรียม OBS และบัญชีที่พร้อม
- เส้นทางจาก event เข้า Allhouse ถึงเริ่ม render: p95 ≤ 500 ms เมื่อ queue ว่าง ไม่รวม provider/network delay
- replay ของ delivery ID เดิม 100 ครั้งสร้าง logical alert เพียงหนึ่งรายการ
- ทำ live soak test 8 ชั่วโมงผ่านโดยไม่มี crash หรือ queue โตอย่างไม่มีขอบเขต
- ไม่พบ plaintext tokens ใน renderer storage, logs, backups หรือ diagnostics

## 10. แหล่งอ้างอิง

- [Twitch EventSub](https://dev.twitch.tv/docs/eventsub/) และ [WebSocket handling](https://dev.twitch.tv/docs/eventsub/handling-websocket-events)
- [YouTube liveChatMessages.streamList](https://developers.google.com/youtube/data/live/reference/rest/v3/liveChatMessages/streamList)
- [Kick official Events documentation](https://github.com/KickEngineering/KickDevDocs/blob/main/events/introduction.md)
- [TikTok developer documentation](https://developers.tiktok.com/doc/) — ยังไม่ใช่หลักฐานยืนยัน general-access LIVE events
- [OBS Browser Source](https://obsproject.com/kb/browser-source)
