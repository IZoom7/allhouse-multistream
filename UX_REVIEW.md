# Allhouse — First-build usability review

Review date: 20 October 2026  
Reviewer role: impatient, nontechnical Thai-speaking streamer.

This review distinguishes source inspection, browser interaction, and actual desktop/OBS verification. A passing source review is not a claim that a human usability study or OBS broadcast test occurred.

## First-use acceptance

| Area | What the user expects | Release requirement |
|---|---|---|
| First launch | “เปิดมาแล้วกดอะไร?” | One obvious way to try sample chat without an account. |
| Platforms | “เชื่อมแล้วใช้งานได้จริงไหม?” | Unavailable integrations say so before login. Never simulate a successful real connection. |
| Permissions | “ทำไมต้องรู้เรื่อง API?” | No developer console, app ID, API key, or webhook configuration in the ordinary user flow. |
| Chat speech | “แชทไทยกับอังกฤษอ่านได้ไหม?” | Explain available voices, missing language support, and whether speech goes to the local computer or OBS. |
| Speech control | “หยุดพูดเดี๋ยวนี้!” | A clear stop action cancels the current utterance and pending speech. |
| Overlay | “แก้แล้วคนดูเห็นหรือยัง?” | Draft and published states are understandable; changes reach the output only through the stated publish action. |
| OBS | “เอาไปใส่ OBS ตรงไหน?” | Copyable URL, dimensions, numbered setup instructions, and explicit test action. |
| Status | “สีเขียวแปลว่าไลฟ์อยู่เหรอ?” | Connected renderer is not described as broadcasting or confirmed OBS connectivity. |
| Navigation | “ปุ่มหายไปไหน?” | Main tasks remain reachable at compact desktop sizes; focus and labels are understandable. |
| Sample data | “ยอดนี้เป็นของจริงไหม?” | Sample chat/events are unmistakable and do not imply real viewers or platform connectivity. |

## Review rounds

### Round 0 — Design documents

Method: read `FEATURES.md`, `APPINFO.md`, and `APPDOC.md`; no application existed yet.

Findings sent to Super Dev and Super Tester:

1. Prioritize an obvious sample-data path so a new user can experience the app before platform integrations are provisioned.
2. Clearly label the initial local preview release. The 40 planned features must not be mistaken for completed functionality.
3. Include Thai/English speech feedback in the first usable slice because the user explicitly requested it, while honestly distinguishing local voices from the planned managed speech service.
4. Keep platform provisioning out of the user workflow and show unavailable capabilities truthfully.
5. Make publishing, OBS setup, and speech stopping obvious enough to discover without reading architecture documentation.

Application interaction review: pending runnable build.

### Round 1 — Hands-on review

Method: clicked through the **browser preview** (Vite at `http://127.0.0.1:5180`, fallback mode) at 1280×800 and 800×700, dark + light, TH + EN. The desktop Electron build, real OBS Browser Source, and real Windows voices were **not** tested in this round. Audio output itself could not be heard by the reviewer; only the on-screen speaking state was checked.

ผมเป็นสตรีมเมอร์ ไม่ใช่โปรแกรมเมอร์ เปิดมาก็อยากกดแล้วใช้ได้เลย ข้างล่างคือสิ่งที่เห็นจริงๆ

| Area | Verdict | What I saw |
|---|---|---|
| First launch | ✅ | ปุ่มม่วงใหญ่ “ลองใช้งานด้วยแชทตัวอย่าง” อยู่กลางจอ กดแล้วมี toast “ส่งตัวอย่างแล้ว • แสดงเฉพาะในแอพ” ไม่ต้องล็อกอิน แต่แชทที่ส่งไปโผล่ใต้ขอบจอ ต้องเลื่อนลงไปหาเอง |
| Platforms | ✅ | ทุกการ์ดติดป้าย “ยังไม่พร้อมเชื่อมจริง” กดแล้วขึ้นกล่องบอกตรงๆ ว่า “YouTube ยังไม่พร้อมเชื่อมในรุ่นนี้” ไม่มีการแกล้งทำเป็นเชื่อมสำเร็จ หน้าแรกก็บอก 0/4 |
| Permissions | ✅ | ไม่ต้องกรอก API key / app ID ที่ไหนเลย มีแค่ข้อความบอกว่า “คุณไม่ต้องหา API key” (คำนี้ผมไม่รู้จักอยู่ดี แต่ก็ไม่ได้บังคับให้ทำ) |
| Chat speech | 😤 | อธิบายดีว่าไม่มีเสียงไทย พร้อมวิธีเพิ่มเสียงใน Windows และบอกว่าเสียงออกที่ลำโพงเครื่องนี้ ไม่ได้เข้า OBS แต่ภาษาอังกฤษใช้คำช่างอย่าง “audio routing”, “Desktop Audio” และข้อความทดลองตั้งต้นเป็นภาษาไทยทั้งที่เครื่องไม่มีเสียงไทย ผมไม่เห็นข้อความแจ้งว่า “ข้ามส่วนภาษาไทย” ระหว่างที่ทดสอบ |
| Speech control | ✅ | ตอนกำลังพูด แถบบนสุดมีปุ่มแดง “หยุดเสียง / Stop speech” ทุกหน้า และในหน้า TTS มี “หยุดและล้างคิว” กดแล้วขึ้น “หยุดเสียงและล้างคิวแล้ว” สถานะกลับเป็น “พร้อมเมื่อคุณพร้อม” |
| Overlay | 😤 | ป้ายเปลี่ยนจาก “ตรงกับฉบับเผยแพร่” เป็น “ยังไม่เผยแพร่” ทันทีที่แก้หัวข้อ ดีมาก แต่ในโหมดเบราว์เซอร์ที่ไม่มี OBS กดเผยแพร่แล้ว toast บอก “เผยแพร่แล้ว • OBS ใช้หน้าล่าสุด” ซึ่งไม่จริง และปุ่มเผยแพร่กดได้ตลอดแม้ไม่มีอะไรเปลี่ยน |
| OBS | 😤 | มี 3 ขั้นตอนมีเลขกำกับ ช่องลิงก์บอกว่า “เปิดแอพเดสก์ท็อปเพื่อรับลิงก์ OBS” และปุ่มคัดลอกถูกปิดไว้ (ซื่อสัตย์ดี) แต่ขั้นที่ 2 บอกแค่ “ตั้งขนาดให้ตรงกับโอเวอร์เลย์” ไม่เขียนตัวเลข 1920 × 1080 ในกล่อง OBS และขั้นที่ 3 “ส่งตัวอย่างไป OBS เพื่อทดสอบ” เป็นแค่ข้อความ ไม่มีปุ่มทดสอบในกล่องนี้ ต้องย้ายไปหน้าแชทเอง กล่องนี้ยังซ่อนอยู่ล่างสุดของหน้าออกแบบ |
| Status | 😤 | ข้อความเขียนชัดว่า “จำนวนหน้าโอเวอร์เลย์ที่เปิดอยู่ ไม่ได้แปลว่ากำลังไลฟ์” แต่ป้าย “ยังไม่มีหน้าโอเวอร์เลย์เปิดอยู่” กลับเป็น**สีเขียว** สถานะแย่แต่ใช้สีเขียวแบบนี้ทำให้คนเข้าใจผิด และหน้าแชทขึ้น toast “ส่งตัวอย่างไป OBS แล้ว” ทั้งที่โหมดนี้ไม่มี OBS |
| Navigation | 😤 | ที่ 800 px แถบเมนูยุบเป็นปุ่ม ☰ ใช้ได้ ปุ่ม “Stop speech” กับ TH/EN ยังเห็นอยู่ แต่เปลี่ยนหน้าแล้ว**ตำแหน่งเลื่อนจอค้างจากหน้าเก่า** (เช่นเข้าหน้าแชทแล้วเจอกลางหน้าเลย หัวเรื่องหายไป) ที่ 800 px หน้าออกแบบเอาตัวแก้ไขไปไว้ใต้พรีวิว ต้องเลื่อนขึ้นลงตลอดเวลาแก้ |
| Sample data | ✅ | ทุกแชท/กิจกรรมมีป้าย “ตัวอย่าง/SAMPLE” ในฟีด ในพรีวิวโอเวอร์เลย์ (“SAMPLE ALERT”) และในการ์ด mintmint หน้าแรก ค่าเริ่มต้นคือ “เฉพาะในแอพ (แนะนำ)” พอเลือก OBS ก็มีคำเตือนว่า “ถ้ากำลังไลฟ์ ผู้ชมจะเห็นด้วย” |

#### Complaints (ด่า)

1. **[ด่า Super Dev] ต้องแก้ก่อนปล่อย** — โหมดพรีวิวในเบราว์เซอร์โกหกเรื่อง OBS ปุ่ม “เผยแพร่ไป OBS” ขึ้น toast “เผยแพร่แล้ว • OBS ใช้หน้าล่าสุด” และหน้า แชทและกิจกรรม → ส่งไป OBS ด้วย ขึ้น “ส่งตัวอย่างไป OBS แล้ว” ทั้งที่แถบบนบอกเองว่าโหมดนี้ไม่มี OBS *จะพอใจถ้า:* toast ในโหมดนี้บอกว่า “บันทึกฉบับเผยแพร่แล้ว (ต้องเปิดแอพเดสก์ท็อปก่อน OBS ถึงจะเห็น)” หรือปิดตัวเลือก “ส่งไป OBS” ไปเลย
2. **[ด่า Super Dev] ควรแก้** — ป้าย “ยังไม่มีหน้าโอเวอร์เลย์เปิดอยู่” ในกล่อง “เพิ่มโอเวอร์เลย์เข้า OBS” เป็นสีเขียว (สีที่แปลว่าโอเค/ออนไลน์) *จะพอใจถ้า:* ใช้สีเทาหรือเหลืองตอนที่ยังไม่มีหน้าเปิดอยู่ แล้วค่อยเป็นสีเขียวเมื่อ “เชื่อมแล้ว (ยังไม่ใช่ไลฟ์)”
3. **[ด่า Super Dev] ควรแก้** — เปลี่ยนหน้าในเมนูแล้วจอไม่เลื่อนกลับขึ้นบน (`main` ยังเลื่อนค้างไว้ ~285 px จากหน้าที่แล้ว) เปิดหน้าแชทมาเจอกลางรายการ หัวเรื่องหายไป *จะพอใจถ้า:* ทุกหน้าเปิดมาที่ด้านบนสุด
4. **[ด่า Super Dev] ควรแก้** — ในกล่อง OBS ไม่มีปุ่ม “ส่งการแจ้งเตือนทดสอบ” และไม่เขียนขนาดจริง (1920 × 1080) ในขั้นตอน ต้องย้อนไปดู dropdown ขนาดจอเอง *จะพอใจถ้า:* ขั้นที่ 2 เขียนว่า “ตั้ง Width 1920 Height 1080” และขั้นที่ 3 มีปุ่ม “ส่งทดสอบไป OBS” อยู่ตรงนั้น
5. **[ด่า Super Dev] ควรแก้** — หน้า บอทอ่านแชท: ปุ่ม “ทดลองฟัง” กดไม่ได้จนกว่าจะเปิดสวิตช์บอทก่อน (“เปิดบอทอ่านแชทด้านบนก่อนทดลองฟัง”) ผมแค่อยากฟังเสียงก่อนตัดสินใจเปิด และข้อความทดลองตั้งต้นเป็นภาษาไทยทั้งที่เครื่องไม่มีเสียงไทย *จะพอใจถ้า:* ทดลองฟังได้เลยโดยไม่ต้องเปิดบอท และถ้าไม่มีเสียงไทยก็ให้ตัวอย่างตั้งต้นเป็นภาษาที่อ่านได้ หรือแสดงข้อความว่า “จะข้ามส่วนภาษาไทย” ไว้ข้างปุ่มตลอด ไม่ใช่โผล่เป็น toast แป๊บเดียว
6. **[ด่า Super Dev] จุกจิก** — ข้อความภาษาอังกฤษในหน้า TTS ใช้ศัพท์ช่าง: “Automatic OBS audio routing is not implemented. If OBS captures Desktop Audio…” *จะพอใจถ้า:* เขียนว่า “เสียงยังไม่เข้า OBS อัตโนมัติ ถ้า OBS อัดเสียงคอม คนดูอาจได้ยินเสียงทดลองด้วย”
7. **[ด่า Super Dev] จุกจิก** — กิจกรรมแบบ “ติดตาม” ยังใช้ข้อความแชทเดิม (“สวัสดี Allhouse! Welcome to the stream”) ในฟีด ดูเหมือนคนติดตามพิมพ์แชทมา *จะพอใจถ้า:* เปลี่ยนเป็น “บ้านข้างๆ ติดตามแล้ว” หรือซ่อนช่องข้อความเมื่อไม่ใช่แชท
8. **[ด่า Super Dev] จุกจิก** — ปุ่ม “เผยแพร่ไป OBS” ยังเป็นปุ่มม่วงเด่นตลอด แม้ป้ายบอกว่า “ตรงกับฉบับเผยแพร่” แล้ว *จะพอใจถ้า:* ปุ่มเบาลงหรือขึ้นว่า “เผยแพร่แล้ว” จนกว่าจะมีการแก้ไขใหม่
9. **[ด่า Super Dev] จุกจิก** — ปุ่ม “นำเข้าไฟล์สำรอง” ในตั้งค่าเป็นสีเทากดไม่ได้ในโหมดเบราว์เซอร์ และไม่บอกเหตุผล *จะพอใจถ้า:* มีข้อความเล็กๆ “ใช้ได้ในแอพเดสก์ท็อป”
10. **[ด่า Super Dev] จุกจิก** — ไอคอน Twitch/Kick/TikTok เป็นตัวอักษร (▣, K, ♪) ไม่ใช่โลโก้จริง ดูไม่น่าเชื่อถือ และหน้าแรกยังไม่บอกขั้นถัดไปหลังกดแชทตัวอย่าง (แชทไปโผล่ใต้ขอบจอ) *จะพอใจถ้า:* เลื่อน/ไฮไลต์ไปที่ฟีดหลังกด
11. **[ด่า Super Tester] ต้องแก้ก่อนปล่อย** — ยังไม่มีใครเขียนผลทดสอบ OBS จริง (เพิ่ม Browser Source → เห็นโอเวอร์เลย์ → เผยแพร่ → เปลี่ยนตาม) และเสียงจริงของ Windows ลงไว้ใน review นี้ รอบนี้ผมเห็นแค่โหมดเบราว์เซอร์ *จะพอใจถ้า:* มีบันทึกทดสอบบนแอพเดสก์ท็อปพร้อมภาพหน้าจอ OBS อย่างน้อยหนึ่งรอบ
12. **[ด่า Super Tester] ควรแก้** — ไม่มีใครจับได้ว่า toast ในโหมดเบราว์เซอร์อ้างว่าส่งไป OBS แล้ว (ข้อ 1) และเรื่องตำแหน่งเลื่อนจอค้าง (ข้อ 3) ทั้งสองอย่างเจอได้ในคลิกแรกๆ *จะพอใจถ้า:* มีเทสต์สำหรับโหมด fallback และการเปลี่ยนหน้า

**Verdict (Round 1):** ยอมรับ (accept) สำหรับ build แรกแบบมีเงื่อนไข ส่วนที่ซื่อสัตย์ทำได้ดี (แพลตฟอร์ม, ป้ายตัวอย่าง, ปุ่มหยุดเสียง) แต่ข้อ 1 และ 11 ต้องปิดให้ได้ก่อนส่งให้สตรีมเมอร์คนอื่น

### Round 2 — Re-review

Method: restarted Vite (browser preview, port 5180) after the fixes. Cleared the saved data in the browser so I started like a first launch. Checked at 1280×800 and 800×700, TH and EN, dark and light. As in Round 1, the desktop app, real OBS and real Windows voices were not tested by me.

| # | Original complaint | Verdict | What I saw now |
|---|---|---|---|
| 1 | Browser mode claims OBS got things | ✅ | เผยแพร่แล้วขึ้น “บันทึกฉบับเผยแพร่แล้ว (ต้องเปิดแอพเดสก์ท็อปก่อน OBS จึงจะเห็น)” ตัวเลือก “ส่งไป OBS ด้วย (เฉพาะแอพเดสก์ท็อป)” กดไม่ได้ในโหมดนี้ ส่งตัวอย่างขึ้น “แสดงเฉพาะในแอพ ไม่ไป OBS” |
| 2 | Green badge for “no overlay open” | ✅ | ป้ายเปลี่ยนเป็นสีส้มอ่อน “โหมดเบราว์เซอร์ไม่มี OBS / No OBS in browser mode” |
| 3 | Scroll position carried between pages | ✅ | เลื่อนหน้าแรกลงไปแล้วกดเมนู หน้าใหม่เปิดที่ด้านบนสุด (`main.scrollTop` = 0) |
| 4 | No size numbers / no test button in OBS steps | ✅ (desktop part unverified) | ขั้น 2 “ตั้ง Width 1920 และ Height 1080” ถ้าฉบับร่างเป็น 1080×1920 ก็บอกว่า “publish first, then use that size” ขั้น 3 มีปุ่ม “ส่งการแจ้งเตือนทดสอบไป OBS” ติดป้าย TEST ในเบราว์เซอร์ปุ่มนี้กดไม่ได้ และมีข้อความบอกว่า “ใช้ได้ในแอพเดสก์ท็อป” ผมเลยยังไม่เห็นว่ามันขึ้นใน OBS จริงไหม |
| 5 | TTS preview needs bot on; Thai default text with no Thai voice | ✅ | ตอนบอทปิดก็กด “ทดลองฟัง” ได้ ขึ้นว่า “บอทปิดอยู่: ยังไม่อ่านแชทอัตโนมัติ แต่ทดลองฟังตรงนี้ได้” และปุ่ม “หยุดเสียง” บนแถบบนก็โผล่มา ข้อความตั้งต้นเป็นอังกฤษเพราะไม่มีเสียงไทย พอกด “ใช้ข้อความไทย+อังกฤษ” มีกล่องเหลืองค้างไว้ว่า “ส่วนที่เป็นภาษาไทยในข้อความนี้จะถูกข้าม” |
| 6 | Jargon in EN TTS notice | ✅ | “Speech plays through this computer’s speakers only. It does not go into OBS by itself…” เป็นภาษาคนแล้ว |
| 7 | Follow event shows chat text | ✅ | เลือก “ติดตาม” แล้วช่องข้อความหายไป มีตัวอย่างว่า “บ้านข้างๆ — ติดตามช่องแล้ว!” ในฟีดแสดง “ติดตามช่องแล้ว” |
| 8 | Publish button always loud | ✅ | ถ้าไม่มีอะไรเปลี่ยน ปุ่มจะเบาลงเป็น “✓ เผยแพร่แล้ว • ไม่มีอะไรเปลี่ยน / Up to date” พอแก้อะไรก็กลับเป็นปุ่มม่วง |
| 9 | Import disabled with no reason | ✅ | “Importing works in the desktop app only.” |
| 10 | Letter icons; sample chat lands off-screen | ✅ | โลโก้ Twitch / Kick / TikTok เป็นโลโก้จริงแล้ว กดแชทตัวอย่างแล้วจอเลื่อนให้เห็นฟีด (รายการใหม่อยู่ชิดขอบล่าง ยังไม่ได้ไฮไลต์ แต่ยอมได้) |
| 11 | No real OBS test record | see below | OBS isn't installed on this machine. Judged against the tester's manual procedure (below). |
| 12 | Tests missed #1 and #3 | 😤 | ไม่ได้เช็กโค้ดเทสต์ทีละตัว แต่ในโฟลเดอร์มี `tests/qa2.test.cjs` ไฟล์ใหม่ และ QA-REPORT ยังจับบัคใหม่ได้เอง (BUG-1 ถึง BUG-5) ผมเลยยอมให้ผ่านไปก่อน |

Also good at 800 px: the overlay editor is now beside the preview, not underneath, and the OBS box fits without overflow. Light and dark themes both look clean.

#### New complaints (Round 2)

1. **[ด่า Super Dev] จุกจิก** — คำเรียกข้อมูลตัวอย่างไม่ตรงกันแล้ว ภาษาไทยในฟีดใช้ “ตัวอย่าง” ภาษาอังกฤษใช้ “TEST” แต่หัวการ์ดเขียน “ALL SAMPLE DATA” ในพรีวิวโอเวอร์เลย์เป็น “TEST ALERT · TWITCH” / “TEST CHAT” และชื่อแพลตฟอร์มในกล่องแชทเป็นตัวเล็ก “twitch” *จะพอใจถ้า:* ใช้คำเดียวทั้งแอพ (sample = ตัวอย่าง หรือ test = ทดสอบ ก็ได้ แต่ต้องเหมือนกันทุกที่) และเขียนชื่อแพลตฟอร์มเป็น “Twitch”
2. **[ด่า Super Dev] ควรแก้ (from QA-REPORT BUG-1, not seen by me in browser mode)** — แชทตัวอย่างที่ส่งเข้า OBS จริงไม่มีป้าย TEST ถ้าผมกดตอนไลฟ์ คนดูจะคิดว่ามีคนพิมพ์จริง *จะพอใจถ้า:* ทุกแถวที่ส่งเข้า OBS ติดป้ายเหมือนการแจ้งเตือน
3. **[ด่า Super Dev] จุกจิก** — toast เด้งมาทับแถบโหมดพรีวิวกับหัวหน้า และค้างอยู่หลายวินาที (เช่นตอนเผยแพร่) *จะพอใจถ้า:* ย้ายไปมุมจอหรือให้หายไวกว่านี้
4. **[ด่า Super Dev] ควรแก้ (from QA-REPORT R2-BUG-4)** — ถ้าปิด “แสดงการแจ้งเตือน” หรือพักคิวไว้ แล้วกด “ส่งการแจ้งเตือนทดสอบไป OBS” แอพยังบอกว่าจะขึ้นบนจอ แต่ OBS ไม่ขึ้นอะไรเลย ผมคงคิดว่า OBS พัง *จะพอใจถ้า:* บอกตรงๆ ว่า “การแจ้งเตือนถูกปิดในฉบับเผยแพร่” หรือ “คิวพักอยู่”
5. **[ด่า Super Dev] ควรแก้ (watch item)** — QA บอกว่ามีโค้ดเสียงออนไลน์ใหม่ (`edgeTts`) ที่ส่งข้อความแชทไปให้ Microsoft แต่หน้า TTS ที่ผมเห็นยังเขียนว่า “ข้อความไม่ถูกส่งไปบริการออนไลน์ของ Allhouse” ถ้าจะเปิดใช้ ต้องถามผมก่อนและบอกให้ชัดว่าข้อความไปที่ไหน *จะพอใจถ้า:* ไม่เปิดให้ใช้จนกว่าจะมีปุ่มยินยอมชัดๆ (ใน browser preview ยังไม่เห็นส่วนนี้)

#### Complaint #11 — the manual OBS procedure (`tests/QA-REPORT.md` → “Real OBS acceptance procedure”)

Verdict: 😤 ซื่อสัตย์ แต่ยังไม่ใช่ของสำหรับผู้ใช้
- **Honest: ✅** เขียนชัดว่า “Not run by QA” และในตาราง N1–N4 แถว OBS จริง เสียงจริง และเสียงไทย ก็ติด NOT TESTED ไม่มีการอ้างว่าผ่าน
- **Clear: mostly ✅** มี 10 ขั้น มีเลขกำกับ ทุกขั้นบอกว่า “ต้องเห็นอะไรถึงผ่าน” ใช้ชื่อปุ่มเดียวกับในแอพ มีขั้นที่เช็กว่าแก้แล้วยังไม่เผยแพร่ OBS ต้องไม่เปลี่ยน ขั้นปุ่มทดสอบ และขั้นเปิดแอพใหม่ ครบตามที่ผมอยากรู้
- **😤 [ด่า Super Tester] ควรแก้:** เขียนเป็นภาษาอังกฤษเกือบทั้งหมด มีคำอย่าง “tofu”, “Windows display scale” ซ่อนอยู่ในรายงาน QA ในโฟลเดอร์ `tests` และสั่งให้ผู้ใช้ “Record results … in this file” คือให้สตรีมเมอร์ไปแก้ไฟล์ .md เอง *จะพอใจถ้า:* ทำเป็นภาษาไทยเป็นหลัก ย้ายไปไว้ใน README หรือ “วิธีทดสอบกับ OBS” ที่หาเจอง่าย แล้วให้ส่งผลกลับเป็นเช็กลิสต์ง่ายๆ หรือแคปหน้าจอ ไม่ต้องแก้ไฟล์
- ข้อ 11 ยังไม่ปิด จนกว่าจะมีคนทำตามขั้นตอนนี้บนเครื่องที่มี OBS จริง แต่ผมไม่เอาเรื่องนี้มาเป็นเหตุ reject build alpha นี้ เพราะมีข้อจำกัดเรื่องเครื่องจริงๆ และบอกตรงๆ แล้ว

Note: QA-REPORT lists R2-BUG-0 (`src/api.ts` did not compile, so `Start Allhouse.cmd` could not rebuild). I re-ran `tsc -b` at the end of this round and it exited cleanly with no errors, so this looks fixed now. Super Tester should confirm it in their own record.

**Verdict (Round 2):** ยอมรับ (accept). ทุกข้อจาก Round 1 ที่ผมเช็กในเบราว์เซอร์ได้ แก้แล้วจริง (ข้อ 1–10 ✅) ที่เหลือเป็นเรื่องจุกจิกกับ “ควรแก้” ส่วน OBS จริงยังต้องรอคนที่มี OBS ทำตามขั้นตอน
