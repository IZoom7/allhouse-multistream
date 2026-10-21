# Allhouse — คู่มือการใช้งานที่ออกแบบไว้

ฉบับ: 0.3 • วันที่: 20 ตุลาคม 2026  
**สถานะ: คู่มือสำหรับแอพที่กำลังออกแบบ ยังไม่มี installer หรือหน้าจอที่พัฒนาเสร็จ** ชื่อเมนูและขั้นตอนต่อไปนี้เป็นข้อกำหนด UX ที่ทีมจะใช้สร้างและตรวจรับ ไม่ใช่การยืนยันว่าดาวน์โหลดใช้งานได้แล้ว

ดูขอบเขตและระยะฟีเจอร์ใน [FEATURES.md](FEATURES.md) และรายละเอียดระบบใน [APPINFO.md](APPINFO.md)

## 1. Allhouse ใช้ทำอะไร

ใช้ Allhouse เพื่อเชื่อมบัญชี streaming, รวมกิจกรรมจากผู้ชม, ออกแบบ overlay และ alert แล้วส่งไปแสดงใน OBS Studio ผ่าน Browser Source

คุณยังเริ่ม/หยุดการถ่ายทอดสดและจัดการภาพจากกล้อง/เกมใน OBS ตามปกติ Allhouse ไม่ส่งวิดีโอขึ้นหลายแพลตฟอร์มให้เอง

รุ่น MVP วางแผนรองรับ Twitch และ YouTube ส่วน Kick อยู่ V1 และ TikTok อยู่ในแผนที่ต้องยืนยันสิทธิ์ LIVE integration ก่อน เมนูที่ยังไม่พร้อมจะแสดงสถานะพร้อมเหตุผล

## 2. สิ่งที่ต้องเตรียม

- เครื่อง Windows 11 x64 ตาม support matrix ของรุ่นที่จะเผยแพร่
- OBS Studio รุ่นที่ Allhouse ตรวจรับรอง ติดตั้งบนเครื่องเดียวกัน
- Internet และบัญชีแพลตฟอร์มที่มีสิทธิ์เข้าถึง channel/live chat ที่ต้องการ
- ภาพ, เสียง หรือวิดีโอที่คุณมีสิทธิ์ใช้ หรือเลือก starter templates

การแก้ไข overlay และทดสอบข้อมูลจำลองไม่จำเป็นต้องเชื่อมบัญชี แต่การรับ events จริงต้องมี internet และ permission ที่ถูกต้อง

## 3. เริ่มใช้งานครั้งแรก

1. เมื่อมีรุ่นเผยแพร่ ให้ติดตั้งจากช่องทาง Allhouse ที่ระบุอย่างเป็นทางการ
2. เปิดแอพ เลือกภาษา **ไทย / English**
3. เลือก **Light / Dark / System**; System เปลี่ยนตามระบบปฏิบัติการ
4. ตั้งชื่อ workspace เช่น “My Streaming Room”
5. เลือก **Connect a platform** หรือ **Try with sample events**
6. สร้าง overlay จาก template แล้วเข้า **OBS Setup**

แนะนำให้ทดสอบด้วยข้อมูลจำลองจนแน่ใจว่าภาพและเสียงถูกต้องก่อนถ่ายทอดสดจริง

## 4. รู้จักหน้าหลัก

| หน้า | ใช้ทำอะไร |
|---|---|
| Dashboard | ดู connection health, queue และ checklist ก่อน live |
| Connections | เพิ่มบัญชี ตรวจ permission และเชื่อมใหม่ |
| Overlays | สร้าง layout, เลือก template, Publish และคัดลอก OBS URL |
| Alerts | ปรับหน้าตา/เสียง, ตั้ง rules, ควบคุม queue และทดสอบ |
| Activity | ดู chat/events รวมและค้นประวัติ |
| Assets | จัดการภาพ/เสียง/วิดีโอที่นำเข้า |
| OBS Setup | คำแนะนำ Browser Source และตรวจการเชื่อมต่อ |
| Settings | ภาษา, theme, privacy, backup, startup, updates และ support |

แถบด้านบนแสดง workspace ปัจจุบัน พร้อม **Mute alerts** และ **Pause queue** สถานะเหล่านี้ต้องมองเห็นได้แม้ย้ายหน้า

## 5. เชื่อมแพลตฟอร์ม

ขั้นตอนหลักคือ **กดเชื่อมต่อ → ล็อกอิน/เลือกบัญชี → กดอนุญาต → เสร็จ** คุณไม่ต้องสมัคร developer account, ขอ API key หรือตั้งค่า webhook เอง ทีม Allhouse จัดการส่วนนี้ก่อนเปิดให้ใช้งาน

หน้า “อนุญาตให้ Allhouse อ่านแชท/รับกิจกรรม” เป็นการยินยอมในบัญชีของคุณตามข้อกำหนดแพลตฟอร์ม หากเปิด 2FA ต้องยืนยันตามปกติ ครั้งต่อไปแอพจำบัญชีและต่ออายุการเชื่อมต่อให้เมื่อทำได้

### Twitch — MVP

1. เข้า **Connections → Add platform → Twitch**
2. แอพเปิด browser ของเครื่อง ให้ตรวจบัญชีและ channel ก่อนอนุญาต
3. อ่านสิทธิ์ที่ขอและกดยืนยัน; ไม่ต้องกรอกรหัสผ่าน Twitch ใน Allhouse
4. กลับ Allhouse ตรวจชื่อบัญชีและรายการ capabilities
5. หากบาง event ยัง unavailable ให้เปิดรายละเอียดเพื่อดู permission ที่ต้องเพิ่ม

การเชื่อมต่อสำเร็จไม่ได้แปลว่าบัญชีนั้นรับ subscriptions, cheers หรือ events ทุกประเภทได้

### YouTube — MVP

1. เข้า **Connections → Add platform → YouTube**
2. อนุญาตผ่าน Google ใน system browser
3. แอพค้นหา channel และ live ให้อัตโนมัติ; ถ้ามีหลายรายการให้เลือกจากชื่อ/ภาพโดยไม่ต้องกรอก ID
4. เมื่อยังไม่ live จะแสดง **เชื่อมต่อแล้ว — รอเริ่มไลฟ์** ไม่ต้องล็อกอินใหม่
5. เมื่อเริ่มหรือเปลี่ยน live แอพตรวจหารายการใหม่; ถ้ามีหลายรายการจะขอให้เลือก และมีปุ่มค้นหาใหม่

Allhouse จะแสดงเฉพาะข้อมูลที่ API และ channel อนุญาต ไม่รับประกันการแจ้งเตือน subscriber ใหม่ทุกคนย้อนหลังหรือแบบ realtime

### Kick — V1

ขั้นตอนจะคล้ายการเชื่อมบัญชีอื่น แต่ใช้ Allhouse relay เพื่อรับข้อมูล ตรวจทั้ง **Platform connection** และ **Relay connection** หาก relay offline, Twitch/YouTube ที่เชื่อมตรงยังอาจใช้งานต่อได้

### TikTok — ยังไม่เปิดใช้งานในแผน MVP/V1

จะเปิดเมื่อยืนยันช่องทาง LIVE integration และสิทธิ์ที่รองรับแล้ว การมีบัญชี TikTok หรือ login สำเร็จไม่ได้ยืนยันว่าอ่าน LIVE gifts/chat ได้

### ตัดการเชื่อมต่อ

เลือกบัญชี → **Disconnect** แอพหยุดรับข้อมูลและลบข้อมูลเข้าสู่ระบบที่เก็บไว้ ประวัติเดิมยังอยู่จนลบแยกใน Privacy หากต้องการปิดสิทธิ์ที่ผู้ให้บริการด้วย ให้ทำตามผล revoke ที่แอพแจ้ง

## 6. สร้าง overlay

1. เข้า **Overlays → New overlay**
2. ตั้งชื่อ เช่น “Main Stream”
3. เลือกขนาดตาม OBS canvas: 1920×1080, 1280×720 หรือ 1080×1920 สำหรับแนวตั้ง
4. เลือก Minimal, Studio, Neon หรือเริ่มว่าง
5. เพิ่ม text, image, shape, clock, latest-event หรือ chat widget
6. ลากเพื่อวางตำแหน่ง ใช้ inspector ป้อน X/Y/width/height เพื่อความแม่นยำ
7. จัด layers, lock สิ่งที่ไม่ต้องการขยับ และใช้ undo/redo เมื่อแก้พลาด
8. ตรวจ preview ทั้งข้อความไทย อังกฤษ ชื่อยาว และ background ที่ใกล้เคียงสตรีมจริง
9. กด **Publish** เพื่อส่ง revision ปัจจุบันไป overlay ที่ OBS ใช้

แอพเก็บ draft อัตโนมัติ แต่ draft ยังไม่เปลี่ยนภาพออกอากาศจน Publish การย่อหน้าต่างแอพไม่เปลี่ยนขนาด canvas ของ overlay

### นำเข้า assets

เข้า **Assets → Import** แล้วเลือกไฟล์:

| ประเภท | รูปแบบเริ่มต้น | เพดานต่อไฟล์ที่เสนอ |
|---|---|---:|
| ภาพ | PNG, JPEG, WebP | 20 MB |
| เสียง | WAV, MP3 | 25 MB |
| วิดีโอ | WebM | 100 MB |

ชนิด codec และความละเอียดต้องผ่านการตรวจด้วย ไฟล์นามสกุลถูกต้องอาจยังใช้ไม่ได้ แอพคัดลอกไฟล์ที่ยอมรับเข้า library; การย้ายไฟล์ต้นฉบับภายหลังไม่ควรทำให้ overlay เสีย

MVP ไม่รองรับการนำเข้า HTML/JavaScript เพื่อรันเอง

## 7. ตั้งค่า alert

1. เข้า **Alerts → Appearance**
2. เลือกประเภท event และ platform ที่รองรับ
3. กำหนดข้อความ โดยเลือกตัวแปรจากเมนู เช่น ชื่อผู้ใช้ จำนวน และหน่วยที่มีจริง
4. เลือก font, สี, ภาพ/วิดีโอ, เสียง และ animation preset
5. ตั้งเวลาแสดง ค่าเริ่มต้นที่เสนอ 6 วินาที และเว้นช่วง 2 วินาที
6. เปิด **Rules** เลือก event, filter และ priority
7. ทดสอบหลายกรณี เช่น ชื่อไทยยาว, ข้อความว่าง และ media ที่โหลดไม่สำเร็จ
8. บันทึกและ Publish revision ที่เกี่ยวข้องก่อนใช้งานจริง

ตัวอย่าง rule: Twitch subscription ใช้ alert “Welcome”; Twitch cheer ใช้ alert “Thanks” โดยเปรียบเทียบหน่วย bits ของ event นั้น ไม่เปรียบเทียบกับเงินของ YouTube โดยตรง

หากหลาย rules ตรงกัน ระบบใช้ priority สูงสุด จากนั้นลำดับที่จัดไว้ สามารถดูผลว่า event เลือก rule ใดใน Activity

## 8. ทดสอบอย่างปลอดภัย

**Test event** แสดงใน preview ของ Allhouse เป็นค่าเริ่มต้น เลือก **Send test to OBS** เมื่อต้องการตรวจใน source จริง โดย UI ต้องแสดงคำเตือนว่าจะปรากฏต่อผู้ชมถ้า source นั้นกำลังออกอากาศ

Test และ replay ไม่เพิ่มยอด counters/statistics จริง ข้อมูลจำลองต้องมีป้าย **Test** ใน activity

Preview ทดสอบรูปแบบการแสดงผล แต่การยืนยันภาพโปร่งใสและเสียงต้องตรวจใน OBS อีกครั้ง

### Chat TTS Bot — อ่านแชทไทย/อังกฤษอัตโนมัติ (V1)

ฟีเจอร์นี้ขยาย TTS เดิมให้เป็นบอทอ่านแชท เมื่อเปิดแล้วไม่ต้องใช้คำสั่งในแชท: ข้อความใหม่จากทุกแพลตฟอร์มที่เลือกและรับ chat ได้จะเข้าคิวอ่านทีละข้อความ

1. เข้า **Alerts → Chat TTS**
2. ใช้บริการเสียงที่ Allhouse เตรียมให้ ตรวจข้อมูลที่จะส่งและโควตา/ค่าใช้บริการก่อนเปิดใช้ ไม่ต้องสร้างบัญชี Azure หรือใส่ API key; หากบริการต้องยืนยันบัญชี Allhouse ให้ดำเนินการตามหน้าจอโดยใช้บัญชีที่รองรับ
3. เลือก **All connected platforms** หรือระบุ platform/channel เอง; แบบ All จะรวมบัญชีที่เชื่อมใหม่เมื่อมี chat capability ด้วย
4. เลือก **Read every incoming chat** และเปิด Chat TTS
5. ตั้งภาษา **Auto / ไทย / English**; Auto เลือกเสียงตามข้อความและรองรับข้อความไทยปนอังกฤษ
6. เลือกเสียงไทยและเสียงอังกฤษแยกกัน กด **Preview voice** แล้วปรับความเร็ว/ความดัง
7. เลือกว่าจะอ่านเฉพาะข้อความ หรืออ่านชื่อผู้ส่ง/แพลตฟอร์มนำหน้าด้วย
8. ตรวจตัวกรองและเพดานข้อความ แล้วทดสอบ “สวัสดีทุกคน welcome to the stream”
9. ในส่วน **OBS audio output** คัดลอก URL ไปเพิ่ม Browser Source ชื่อ **Allhouse — Chat TTS**; source นี้ไม่มีภาพ ให้เปิด Control audio via OBS และตรวจ mixer
10. ใช้ source เดิมร่วมกันใน scenes ที่ต้องการฟัง แล้วเลือก **Send TTS test to OBS** เพื่อยืนยันว่าเสียงออกเพียงครั้งเดียว

ตัวอย่าง: แชทไทยเข้า Twitch แล้วแชทอังกฤษเข้า YouTube บอทจะอ่านตามลำดับที่ Allhouse รับ ด้วยเสียงของแต่ละภาษา ไม่มีเสียงสองแพลตฟอร์มพูดทับกัน บอทนี้ไม่ได้ส่งข้อความตอบกลับในแชท

**ปุ่มควบคุม TTS แยกจาก alerts**

| ปุ่ม | การทำงาน |
|---|---|
| Pause TTS | หยุดเริ่มข้อความถัดไป; ข้อความปัจจุบันอ่านจนจบ; pending ยังมีอายุจำกัด |
| Resume TTS | อ่านคิวที่ยังไม่หมดอายุ |
| Skip / Stop current | หยุดข้อความที่กำลังอ่าน; ไปข้อความถัดไปหากไม่ได้ pause |
| Clear TTS queue | ยกเลิก pending; หากต้องการหยุดเสียงปัจจุบันด้วยใช้ Stop all |
| Mute TTS | หยุดเสียงและข้ามคิวเสียงรวมถึงข้อความใหม่จน unmute; ไม่สะสมกลับมาอ่านทีหลัง |
| Stop all / ปิด Chat TTS | หยุดเสียงปัจจุบันและยกเลิกคิวทั้งหมด |

Mute alerts ไม่ได้ปิด Chat TTS; แต่ละส่วนมีสถานะ mute ของตนเอง หากมี alert ที่ใช้เสียง ระบบรอข้อความ TTS ปัจจุบันจบก่อนเล่น alert แล้วจึงอ่านแชทต่อ

**ข้อจำกัดที่ต้องเห็นในหน้าใช้งาน**

- อ่านเฉพาะข้อความสดที่แอพรับได้ ไม่อ่าน history เก่าหลัง reconnect อัตโนมัติ และไม่รับประกันข้อมูลที่แพลตฟอร์มไม่ได้ส่ง
- ค่าเริ่มต้นที่เสนอ: 300 ตัวอักษรที่ผู้ใช้อ่านเห็นต่อข้อความ, เสียงสูงสุด 30 วินาที, คิว 100 ข้อความ และอายุคิว 120 วินาที; chat ที่มาเร็วกว่าการอ่านอาจถูกข้ามพร้อมบอกเหตุผล
- ปรับตัวกรองคำ/URLs/emote-only/บัญชี bot ได้; ข้อความที่ถูกลบก่อนอ่านจะถูกยกเลิกเมื่อระบบได้รับการแจ้งลบ
- Cloud TTS ต้องใช้ internet โดยส่งข้อความผ่านบริการ Allhouse ไปยังผู้ให้บริการเสียงที่ระบุ; แสดงโควตา/ค่าใช้บริการและหยุดเมื่อถึง cap; แผนราคาอยู่ระหว่างออกแบบและไม่มีการคิดเงินโดยอัตโนมัติโดยไม่สมัครบริการ
- หาก voice ใช้ไม่ได้ ให้เลือกเสียงที่พร้อมจริง แอพไม่เปลี่ยน provider หรือส่งข้อความไปบริการอื่นโดยไม่แจ้ง
- TikTok อ่านได้ต่อเมื่อ integration F35 เปิดใช้งานและได้รับสิทธิ์อ่าน LIVE chat แล้ว

## 9. เพิ่ม Allhouse เข้า OBS Studio — MVP

1. เปิด Allhouse และ Publish overlay ที่ต้องการ
2. เข้า **OBS Setup** หรือหน้า overlay แล้วเลือก **Copy Browser Source URL**
3. ใน OBS เลือก scene → **Sources → + → Browser**
4. ตั้งชื่อ เช่น “Allhouse — Main”
5. ปิด **Local file** แล้ววาง URL ที่คัดลอก
6. ตั้ง Width/Height ให้ตรงกับ overlay เช่น 1920×1080
7. ตรวจพื้นหลังโปร่งใสและตำแหน่ง source เหนือภาพเกม/กล้องตามต้องการ
8. สำหรับ overlay ที่ต้องรับ alerts ต่อเนื่อง แนะนำไม่เปิด **Shutdown source when not visible**; ตรวจพฤติกรรมใน scene ของคุณอีกครั้ง
9. ไม่เปิด refresh ทุกครั้งที่ source active โดยไม่จำเป็น เพราะอาจขัดจังหวะ animation
10. เลือก **Send test to OBS** จาก Allhouse แล้วตรวจทั้งภาพและ audio meter

ชื่อ option อาจต่างเล็กน้อยตาม OBS version; คู่มือ release จริงต้องมีภาพจากรุ่นที่รองรับ

### เสียง

- หากต้องการปรับเสียงใน mixer ของ OBS ให้ใช้ **Control audio via OBS** ตามตัวเลือกของ Browser Source รุ่นที่ใช้
- ตรวจ source mute, mixer level และ output track
- เริ่มจาก monitoring off เพื่อหลีกเลี่ยงเสียงวน/เสียงซ้ำ; เปิด monitoring เฉพาะเมื่อเข้าใจ routing
- อย่าเปิดทั้ง Allhouse preview audio และ production test audio พร้อมกัน
- ถ้าใช้ overlay เดียวหลาย scenes ให้ reuse source ที่มีอยู่เมื่อเหมาะสม และตรวจการแจ้ง renderer ซ้ำ

### ข้อควรรู้เกี่ยวกับ URL

- ใช้ได้ในเครื่องเดียวกับ Allhouse ตามขอบเขต MVP และต้องเปิด Allhouse อยู่
- URL เป็นข้อมูลเข้าถึง overlay ควรหลีกเลี่ยงการเผยแพร่ในภาพหน้าจอหรือส่งให้ผู้อื่น
- หลัง **Regenerate URL** หรือ restore backup ต้องนำ URL ใหม่ไปใส่ใน OBS
- หาก port ที่แอพใช้อยู่ถูกโปรแกรมอื่นใช้งาน ให้ใช้ wizard แก้ไขและอัปเดต URL ตามที่แจ้ง
- “Renderer connected” หมายถึงมีหน้า overlay เชื่อมต่อ ไม่ได้ยืนยันว่า OBS กำลัง live หรือ source อยู่บนภาพที่ผู้ชมเห็น

### OBS WebSocket — V1 เท่านั้น

ใช้เพื่อช่วยจับคู่ OBS และเพิ่ม source อัตโนมัติ เปิด authentication และเชื่อมผ่านหน้า **OBS Setup → Connect OBS** ความสามารถนี้ไม่จำเป็นต่อการวาง Browser Source URL ด้วยตัวเอง

## 10. ระหว่างถ่ายทอดสด

ก่อนเริ่มตรวจ:

- ถูก workspace และ broadcast
- Connections พร้อม และไม่มี permission/token error
- Overlay revision ที่ต้องการถูก Publish
- OBS source แสดงถูกขนาดและ audio meter ทำงาน
- Mute/Pause อยู่ในสถานะที่ตั้งใจ
- ไม่มี test event รอส่งขึ้น OBS

| ปุ่ม | ผลที่เกิดขึ้น |
|---|---|
| Pause queue | หยุดเริ่ม alert ถัดไป; event ยังเข้า history; alert ที่กำลังเล่นจบตามปกติ |
| Resume queue | เล่นเฉพาะ pending ที่ยังไม่หมดอายุ |
| Skip current | จบ alert ปัจจุบันและไปตัวถัดไป |
| Mute alerts | ปิดเสียง alerts ของ Allhouse; ภาพยังทำงาน |
| Hide chat | ซ่อน chat widget ที่เลือก; ไม่ลบข้อความบนแพลตฟอร์ม |
| Clear queue | ยกเลิก pending พร้อมยืนยัน; ไม่ลบ history |
| Replay | สร้าง manual playback ใหม่ของ event ที่เลือก; ไม่เพิ่มยอดจริง |

ค่า freshness เริ่มต้น 120 วินาที หมายความว่าเมื่อ pause หรือ offline นาน events บางรายการจะอยู่ใน history แต่ไม่เล่นย้อนหลังอัตโนมัติ หากต้องการเล่น ให้เลือก replay ทีละรายการ

ถ้าอินเทอร์เน็ตขาด overlay ที่บันทึกไว้ยังแสดงได้ แต่ข้อมูลใหม่หยุดเข้า เมื่อ reconnect ระบบไม่รับประกันว่าจะกู้ event ที่ provider ไม่ส่งย้อนหลังได้ครบ

## 11. ปิดหน้าต่างกับออกจากแอพ

- เปิด **Run in tray**: ปิดหน้าต่างแล้ว runtime ยังทำงาน; เปิดกลับจาก tray icon
- เลือก **Quit Allhouse**: หยุด connectors และ local overlay service; OBS จะไม่ได้รับข้อมูลใหม่
- หากมี session หรือ renderer ใช้งานอยู่ แอพต้องอธิบายผลก่อน Quit
- **Start with Windows** เป็น opt-in ใน Settings
- แอพแจ้ง update ได้ แต่เลื่อนการติดตั้ง/restart จนกว่าจะจบ live

## 12. Backup, restore และข้อมูลส่วนตัว

### สำรอง

1. เข้า **Settings → Backup → Export workspace**
2. เลือก workspace และตรวจขนาดรวม assets
3. บันทึกไฟล์ในตำแหน่งที่ต้องการ

Backup รวม layout, rules, settings และ assets ไม่รวม OAuth tokens, OBS password หรือ URL access tokens ประวัติ event ใช้ export แยกจาก Activity

### กู้คืน

1. เข้า **Settings → Backup → Import**
2. เลือกไฟล์และตรวจผล validation
3. Import เป็น workspace ใหม่
4. เชื่อมบัญชีอีกครั้ง ตรวจ assets และ Publish
5. คัดลอก URL ใหม่ไปใส่ใน OBS แล้วทดสอบก่อน live

### Privacy

- History เก็บเริ่มต้น 7 วัน; diagnostic logs 14 วัน
- ลบ history ได้ใน **Settings → Privacy**
- Diagnostics export ต้องปิดบังข้อมูลลับ; ให้ preview รายการไฟล์ก่อนส่งให้ support
- การเชื่อม Kick ใน V1 ต้องผ่าน relay; UI ต้องอธิบายข้อมูลที่บริการได้รับ
- การตัดบัญชีไม่ลบ backup ที่คุณ export ไว้เอง

## 13. Troubleshooting

| อาการ | ตรวจและแก้ไข |
|---|---|
| OBS ว่าง | เปิด Allhouse, ตรวจ URL/port, Publish แล้ว, ตรวจขนาด Browser Source และตำแหน่งใน scene |
| เห็น preview แต่ OBS ไม่เห็น | ตรวจว่าใช้ published revision; ตรวจ renderer heartbeat; OBS และ Allhouse ต้องอยู่เครื่องเดียวกัน |
| ภาพขึ้นแต่เสียงไม่มี | ตรวจ Mute alerts, OBS mixer, Control audio via OBS, track routing และระดับเสียง asset |
| เสียงดังสองครั้ง | ปิด preview audio, ตรวจ monitoring loop และ Browser Sources ซ้ำ |
| Chat TTS ไม่อ่าน | ตรวจว่าเปิด F29, เลือก platform, มีข้อความสด, ไม่ mute/pause, voice พร้อม, quota เหลือ และ source Chat TTS เชื่อมอยู่ |
| อ่านไทยหรืออังกฤษไม่ตรง | เลือก Auto หรือกำหนดภาษาใหม่ ตรวจเสียงแต่ละภาษาและ fallback สำหรับชื่อ/ข้อความสั้น |
| Chat TTS ข้ามข้อความ | ดู reason เช่น filtered, deleted, expired, overflow หรือ quota; ไม่กด replay ทั้ง history เพื่อแก้คิวล้น |
| Connected แต่ไม่มี event | ตรวจ channel/broadcast, capability/permission และ Activity filter; ลอง event ที่บัญชีรองรับ |
| YouTube ไม่มี chat | ตรวจว่าเลือกไลฟ์ถูกอัน เปิดแชทไว้แล้ว และบัญชีเข้าถึงช่องนั้นได้; กดค้นหาไลฟ์ใหม่ |
| Permission expired | กด Reconnect ใน Connections; ไม่จำเป็นต้องลบ overlay |
| Rate limited / quota | รอตามเวลาที่แอพแจ้ง; ไม่กด reconnect ซ้ำ; ลด polling fallback ถ้ามี |
| Kick หยุดแต่ platform อื่นปกติ | ตรวจ relay status; history อาจมี gap หาก offline เกิน retention |
| Alerts ไม่เล่นหลังกลับ online | อาจหมด TTL หรือเป็น historical events; ดู reason ใน Activity และ replay รายการที่ต้องการ |
| Font ไทยถูกตัด | ตรวจ line-height, text box height, scaling และ packaged font ใน OBS |
| ไฟล์ใช้ไม่ได้ | ตรวจ format, codec และ size; เปลี่ยนไฟล์และทดสอบใน OBS |
| ย้าย workspace แล้ว source ผิดชุด | ตรวจ overlay/workspace ของ URL; source เดิมไม่ควรถูกผูกเข้าชุดใหม่อัตโนมัติ |
| เล่นกระตุก | ลดวิดีโอ/animation พร้อมกัน, จำนวน chat visible, ตรวจ GPU และ frame health |

หากยังมีปัญหา ให้ใช้ **Settings → Support → Export diagnostics** พร้อมเวลาที่เกิดเหตุ, app/OBS versions และขั้นตอนก่อนเกิดปัญหา ไม่ส่ง access tokens หรือรหัสผ่าน

## 14. ฟีเจอร์ที่คู่มือนี้ยังไม่ให้ถือว่าใช้ได้

- Kick, OBS WebSocket automation, goals, Multiplatform Chat TTS Bot (ไทย/อังกฤษ), global shortcuts, profiles, หลายบัญชีต่อแพลตฟอร์ม, chat actions และ session summaries: **V1**
- TikTok LIVE, แพลตฟอร์มเพิ่มเติม, cloud sync, remote control, marketplace และ SDK: **Future/Conditional**

เมื่อพัฒนาจริงต้องอัปเดตคู่มือจากหน้าจอที่ทดสอบแล้ว เพิ่ม screenshots และระบุ version ที่ฟีเจอร์เริ่มรองรับ

## 15. อ้างอิงสำหรับการตั้งค่า

- [OBS Browser Source](https://obsproject.com/kb/browser-source)
- [OBS Remote Control Guide](https://obsproject.com/kb/remote-control-guide)
- [รายละเอียดขอบเขตและข้อจำกัดแพลตฟอร์ม](FEATURES.md#6-platform-capability-matrix)
