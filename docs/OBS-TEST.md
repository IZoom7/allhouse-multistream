# ทดสอบ Allhouse กับ OBS (ใช้เวลาประมาณ 20 นาที)

ตอนนี้แต่ละชิ้นบนจอเป็น**วิดเจ็ต**แยกกัน แต่ละวิดเจ็ตมีลิงก์ของตัวเอง และต้องเพิ่มเป็น **Browser Source แยกกันใน OBS** หนึ่งวิดเจ็ตต่อหนึ่ง Source ใส่แล้วลากไปวางและย่อขยายใน OBS ได้ตามใจ

ทำทีละข้อแล้วติ๊กข้อที่ผ่าน ถ้าข้อไหนไม่ผ่าน ให้แคปหน้าจอไว้แล้วส่งให้ทีม

**ก่อนเริ่ม:** ต้องมี OBS Studio (เวอร์ชัน 30 ขึ้นไป) และเปิดลำโพงหรือใส่หูฟังไว้ **อย่าทดสอบระหว่างไลฟ์** เพราะคนดูจะเห็นและได้ยินการแจ้งเตือนทดสอบ

## ขนาดของแต่ละวิดเจ็ต (ตั้งใน OBS ให้ตรงตามนี้)

| ลำดับที่เพิ่ม | วิดเจ็ต | Width (กว้าง) | Height (สูง) |
|---|---|---|---|
| 1 | แบนเนอร์ (หัวข้อ / รูป) | 1920 | 1080 |
| 2 | กล่องแชท | 800 | 1080 |
| 3 | แจ้งเตือนผู้ติดตาม (follow) | 1920 | 1080 |
| 4 | แจ้งเตือนสมาชิก (subscription) | 1920 | 1080 |
| 5 | แจ้งเตือนของขวัญ TikTok (gift) — ติ๊ก “Control audio via OBS” ถ้าใส่เสียง | 1920 | 1080 |

ค่าในตารางเป็นขนาดเริ่มต้น ถ้าเปลี่ยนขนาดใน Allhouse ให้ใช้ตัวเลขใหญ่ที่การ์ดของวิดเจ็ตนั้นบอก (“ตั้งใน OBS: กว้าง … สูง …”)
**ทำไมต้องเพิ่มตามลำดับนี้:** ใน OBS ตัวที่อยู่บนสุดในรายการ Sources จะทับตัวอื่น เพิ่มแบนเนอร์ก่อน ส่วนการแจ้งเตือนเพิ่มทีหลัง การแจ้งเตือนจะได้ขึ้นทับทุกอย่าง

## 1. เปิดแอพ
- [ ] ดับเบิลคลิก `Start Allhouse.cmd` แล้วรอจนมุมขวาบนขึ้นว่า “บันทึกในเครื่องแล้ว”
- [ ] ไปหน้า **วิดเจ็ต OBS** ต้องเห็นการ์ดแยก 4 ใบ (แบนเนอร์, แชท, ผู้ติดตาม, สมาชิก) เปิดสวิตช์ทุกใบ แล้วกด **เผยแพร่** หนึ่งครั้ง

## 2. เพิ่มแต่ละวิดเจ็ตเข้า OBS (ทำซ้ำ 4 รอบตามลำดับในตาราง)
- [ ] ที่การ์ดของวิดเจ็ตใน Allhouse กด **คัดลอก** ลิงก์ (ลิงก์ของแต่ละการ์ดไม่เหมือนกัน)
- [ ] ใน OBS ไปที่ช่อง **Sources** กด **+** แล้วเลือก **Browser** ตั้งชื่อให้จำง่าย เช่น “Allhouse แชท”
- [ ] วางลิงก์ลงในช่อง **URL**
- [ ] ตั้ง **Width / Height** ตามตารางด้านบน
- [ ] **เฉพาะวิดเจ็ตแจ้งเตือน (ผู้ติดตาม / สมาชิก):** ติ๊ก **Control audio via OBS** ถ้าไม่ติ๊ก คนดูจะไม่ได้ยินเสียงแจ้งเตือน
- [ ] ปล่อยช่อง “Shutdown source when not visible” ไว้โดยไม่ติ๊ก แล้วกด OK
- [ ] พื้นหลังของวิดเจ็ตโปร่งใส ไม่มีกรอบขาวหรือดำ ตัวหนังสือไทยแสดงครบ ไม่เป็นสี่เหลี่ยม และวรรณยุกต์ไม่โดนตัด
- [ ] การ์ดของวิดเจ็ตนั้นใน Allhouse ขึ้นว่า “เชื่อมแล้ว 1 หน้า” *(แปลว่า OBS เปิดหน้านี้อยู่ **ไม่ได้แปลว่ากำลังไลฟ์**)*

## 3. จัดตำแหน่งใน OBS
- [ ] คลิกที่ Source ในหน้าจอพรีวิวของ OBS แล้ว**ลาก**ไปวางตรงที่ต้องการ (เช่น ให้แชทอยู่ชิดขวา)
- [ ] ลาก**มุม**กรอบสีแดงเพื่อย่อหรือขยาย ภาพต้องยังคมและไม่เบี้ยว (กด Shift ค้างไว้ถ้าอยากยืดแบบไม่รักษาสัดส่วน)
- [ ] ถ้าวางแล้วเละ คลิกขวาที่ Source → **Transform → Reset Transform** แล้วเริ่มใหม่

## 4. เผยแพร่
- [ ] เปลี่ยนหัวข้อของแบนเนอร์ใน Allhouse แต่**ยังไม่กด**เผยแพร่ → OBS ต้องยังแสดงหัวข้อเดิม
- [ ] กด **เผยแพร่** → วิดเจ็ตทุกตัวใน OBS เปลี่ยนตามภายในประมาณ 1 วินาที

## 5. ทดสอบทีละวิดเจ็ต (กด **ส่งทดสอบ** บนการ์ดของแต่ละใบ)
- [ ] **แชท:** มีแถวใหม่ขึ้นในกล่องแชทใน OBS และมีป้าย **TEST**
- [ ] **ผู้ติดตาม:** การแจ้งเตือนขึ้นตามเวลาที่ตั้งไว้ (ค่าเริ่มต้น 6 วินาที) มีป้าย **TEST** ได้ยินเสียงที่อัปโหลดไว้ และแถบเสียงของ Source นี้ใน Audio Mixer ของ OBS ขยับ
- [ ] **สมาชิก:** เหมือนข้อผู้ติดตาม และ**ต้องขึ้นเฉพาะในวิดเจ็ตสมาชิก** ไม่ไปโผล่ในวิดเจ็ตผู้ติดตาม
- [ ] **แบนเนอร์:** หัวข้อ ข้อความรอง และรูป ตรงกับที่เผยแพร่ไว้ ไม่มีส่วนไหนโดนตัด
- [ ] ปิดสวิตช์ของวิดเจ็ตใดก็ได้ใน Allhouse แล้วกดเผยแพร่ → วิดเจ็ตนั้นหายจาก OBS ส่วนตัวอื่นยังอยู่
- [ ] ไปหน้า **แชทและกิจกรรม** ส่งตัวอย่าง “ติดตาม” แล้วกด **ข้าม** ตอนที่มันกำลังขึ้นจอ → การแจ้งเตือนหายไป แต่แชทยังอยู่

## 6. ปิดแล้วเปิดแอพใหม่
- [ ] ปิด Allhouse ทิ้งไว้โดยไม่ปิด OBS แล้วเปิด Allhouse ใหม่ → วิดเจ็ตทุกตัวต่อกลับมาเองภายในไม่กี่วินาที และไม่มีการแจ้งเตือนเก่าเด้งขึ้นมาอีก

## 7. เสียงอ่านแชท (อ่านก่อนทำ)
เสียงแจ้งเตือนเข้า OBS ได้เพราะติ๊ก **Control audio via OBS** ไว้ แต่**เสียงอ่านแชท (บอทอ่านแชท) ไม่ได้เข้า OBS** มันออกที่ลำโพงของเครื่องนี้เท่านั้น ถ้า OBS อัดเสียงคอม (Desktop Audio) ไว้ คนดูก็จะได้ยินเสียงนี้ด้วย
- [ ] ไปหน้า **บอทอ่านแชท** กด **ทดลองฟัง** → ได้ยินเสียงจากลำโพง กด **หยุดและล้างคิว** ตอนที่ยังพูดอยู่ → เสียงหยุดทันที
- [ ] (ไม่บังคับ) ลองเสียงไทย: จะติดตั้งเสียงไทยใน Windows ก็ได้ หรือเปิด “เสียงออนไลน์ (Microsoft Edge)” ในหน้า บอทอ่านแชท ก็ได้ ถ้าใช้เสียงออนไลน์ ข้อความจะถูกส่งไปที่ Microsoft

## เก่า: โอเวอร์เลย์รวมในหน้าเดียว (ไม่แนะนำ)
ลิงก์ “ทั้งหมดในหน้าเดียว” ที่อยู่ในส่วน **ขั้นสูง** ยังใช้ได้ ขนาด 1920 × 1080 **อย่าใช้คู่กับวิดเจ็ตแยก** เพราะทุกอย่างจะขึ้นซ้ำสองชุด

## ส่งผลให้ทีม
บอกทีมว่าข้อไหนผ่านหรือไม่ผ่าน พร้อมแคปหน้าจอ และบอกเวอร์ชัน OBS กับขนาดจอ/สเกลของ Windows (เช่น 1920×1080, 125%) ส่งทางแชทได้เลย ไม่ต้องแก้ไฟล์นี้

---

# Testing Allhouse with OBS (about 20 minutes)

Each on-screen element is now its own **widget** with its own link. Add every widget to OBS as a **separate Browser Source**, then drag and resize it in OBS. Don't test while you are live.

**Sizes, and the order to add them** (later sources sit on top):

| Order | Widget | Width | Height |
|---|---|---|---|
| 1 | Banner (title / image) | 1920 | 1080 |
| 2 | Chat box | 800 | 1080 |
| 3 | Follow alert | 1920 | 1080 |
| 4 | Subscription alert | 1920 | 1080 |
| 5 | TikTok gift alert (tick “Control audio via OBS” if it has a sound) | 1920 | 1080 |

These are the defaults. If you change a size in Allhouse, use the big W×H shown on that widget's card.

1. **Start**
   - [ ] Run `Start Allhouse.cmd`.
   - [ ] Open **OBS widgets**. Turn on all four cards and press **Publish**.
2. **Add each widget** (repeat four times)
   - [ ] On the widget's card, press **Copy**.
   - [ ] OBS → Sources → **+** → **Browser**. Paste the URL and set Width/Height from the table.
   - [ ] **Alert widgets only:** tick **Control audio via OBS**, otherwise viewers won't hear the alert sound. Leave "Shutdown source when not visible" off.
   - [ ] The background is transparent and Thai text renders correctly.
   - [ ] The card shows "connected 1 page". This does **not** mean you are live.
3. **Arrange**
   - [ ] Drag each source into place and resize it from the corners. It should stay sharp and undistorted.
   - [ ] If a source gets messed up: right-click → Transform → Reset Transform.
4. **Publish**
   - [ ] Edit without publishing. OBS should not change.
   - [ ] Press **Publish**. All widgets should update within about 1 second.
5. **Test each widget** with its **Send test** button
   - [ ] Chat: a row with a **TEST** tag appears.
   - [ ] Follow: the alert shows for its duration (default 6 s) with a **TEST** tag, the uploaded sound plays, and the source's meter moves in OBS's Audio Mixer.
   - [ ] Subscription: same as follow, and it appears **only** in the subscription widget.
   - [ ] Banner: title, subtitle and image match what you published, with nothing cut off.
   - [ ] Turn one widget off and publish. Only that widget disappears.
   - [ ] Send a sample follow and press **Skip** while it is showing. The alert hides and the chat stays.
6. **Restart**
   - [ ] Close and reopen Allhouse while OBS stays open. All widgets reconnect by themselves, and no old alert replays.
7. **Chat speech**
   - Alert sounds reach OBS via "Control audio via OBS". Chat TTS does **not**: it plays through this computer's speakers only, so viewers hear it only if OBS captures Desktop Audio.
   - [ ] Preview a voice, then press **Stop & clear** mid-sentence. It should stop immediately.

**Legacy "all in one" overlay** (under **Advanced**, 1920 × 1080) still works. Don't use it together with the separate widgets, or everything shows twice.

**Report back:** send the team which items passed or failed, with screenshots, your OBS version, and your Windows display scale. You don't need to edit this file.
