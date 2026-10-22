# Allhouse Manual — คู่มือการใช้งานทั้งระบบ

คู่มือเป็นเว็บ static ล้วน (HTML + CSS + JS ไม่มี dependency ไม่ต้อง build) มากับแอพ และแอพเปิดจากไฟล์ในเครื่องโดยตรง ไม่ต้อง deploy หรือใช้อินเทอร์เน็ต (ฟอนต์จาก Google Fonts จะโหลดถ้ามีเน็ต ไม่มีก็ใช้ฟอนต์ในเครื่องแทน)

```
docs-site/
├── index.html         หน้า landing (โฆษณา): ธีมเกมตู้ มี demo จอ OBS ที่กดเล่นได้ ปุ่มดาวน์โหลด
├── manual.html        หน้าแรกของคู่มือ: แผนที่คู่มือ + เริ่มไลฟ์ใน 5 ขั้น (แอพเปิดหน้านี้เมื่อขอหน้า 'index')
├── start.html         เริ่มต้นใช้งาน: ติดตั้ง เปิดแอพ รู้จักเมนู บันทึกอัตโนมัติ ทดสอบกับของจริง
├── connections.html   เชื่อมต่อแพลตฟอร์ม: Twitch / YouTube / Kick / TikTok (TikFinity)
├── obs-widgets.html   วิดเจ็ต OBS: เพิ่มเข้า OBS เผยแพร่ แจ้งเตือน ของขวัญ แชท แบนเนอร์
├── chat-tts.html      แชทและบอทอ่านแชท: ห้องแชท หน้าต่างแชทแยก เสียง กฎการอ่าน
├── custom-css.html    CSS กำหนดเอง (หัวข้อย่อย) + สนามทดลอง
├── help.html          แก้ปัญหา สำรอง/นำเข้า ความเป็นส่วนตัว เช็กลิสต์ OBS
├── 404.html           GAME OVER (ใช้ path แบบ / จึงต้องอยู่ที่ root ของโดเมน)
├── img/               ภาพหน้าจอแอพ (1440 กว้าง, JPEG)
├── assets/
│   ├── i18n.js        สลับไทย/อังกฤษ (โหลดใน <head>) จำค่าใน localStorage รับ ?lang=th|en
│   ├── guide.css      ธีม retro + ส่วนประกอบของคู่มือ CSS
│   ├── site.css       หัวเว็บ เมนู ปุ่ม TH/EN ภาพหน้าจอ ตาราง กล่องแจ้ง ปุ่มหน้าถัดไป
│   ├── guide.js       ปุ่มคัดลอกโค้ด + สนามทดลอง (เฉพาะหน้า CSS)
│   ├── landing.css / landing.js   หน้า landing: ดาว แถบแชทวิ่ง demo OBS ภาพหน้าจอ คะแนน confetti (↑↑↓↓←→←→BA)
│   ├── pixel/*.svg    ภาพพิกเซลที่วาดเองทั้งหมด สร้างจาก scripts/build-pixel-art.cjs
│   └── favicon-v2.png, allhouse-lockup-*.png, allhouse-icon-256.png
├── _headers, vercel.json, robots.txt, .nojekyll   ค่า header/ความปลอดภัยตอน deploy
```

## สองภาษา (ไทย / English)

ทุกข้อความเขียนเป็นคู่ในไฟล์เดียวกัน: `<span lang="th">…</span><span lang="en">…</span>` (หรือ `<p lang="th">` / `<p lang="en">`) CSS ใน `site.css` / `landing.css` ซ่อนภาษาที่ไม่ได้เลือก ถ้าไม่มี JavaScript จะเห็นภาษาไทย
- ชื่อหน้าภาษาอังกฤษอยู่ใน `<meta name="title-en">`
- attribute ใช้ `data-en-alt`, `data-en-aria-label`, `data-en-placeholder`, `data-en-title`
- ปุ่มสลับคือ `<button class="lang-toggle" data-lang-toggle>` ค่าที่เลือกเก็บใน localStorage (`allhouse-lang`) แอพส่ง `?lang=` มาตามภาษาของแอพ
- เพิ่มข้อความใหม่แล้วอย่าลืมใส่ทั้งสองภาษา

## แอพเปิดคู่มืออย่างไร

- ปุ่ม **คู่มือ** บนแถบด้านบนของแอพ จะเปิดหน้าที่ตรงกับหน้าที่ผู้ใช้ดูอยู่ (เชื่อมต่อ → `connections.html`, วิดเจ็ต → `obs-widgets.html`, แชท/บอท → `chat-tts.html`, ตั้งค่า → `help.html`)
- ลิงก์ใต้ช่อง CSS กำหนดเอง → `custom-css.html`
- ทำงานผ่าน IPC `house:open-docs` ใน `electron/main.cjs` ซึ่งเปิดได้เฉพาะชื่อหน้าในรายการ `DOC_PAGES` ด้วยเบราว์เซอร์ปกติของเครื่อง ถ้าเพิ่มหน้าใหม่ ต้องเพิ่มชื่อใน `DOC_PAGES` และ type `DocPage` (`src/types.ts`) ด้วย
- โฟลเดอร์นี้ถูกรวมไปกับไฟล์แพ็กแอพ (`npm run package`)

## ดูในเครื่อง

ดับเบิลคลิก `manual.html` (คู่มือ) หรือ `index.html` (landing) หรือใช้ dev server (ตั้งไว้ใน `.claude/launch.json` ชื่อ `docs-site`):

```bash
"/c/Program Files/Adobe/Adobe Creative Cloud Experience/libs/node.exe" node_modules/vite/bin/vite.js docs-site --host 127.0.0.1 --port 4180
```

## แก้เนื้อหา

- แต่ละหน้าเป็น HTML ธรรมดา หัวข้อคือ `<section class="cart">` แก้ข้อความตรงๆ ได้เลย
- เมนูด้านบนและปุ่มก่อนหน้า/ถัดไปเขียนซ้ำอยู่ในทุกหน้า ถ้าเพิ่ม/เปลี่ยนชื่อหน้า ต้องแก้ทุกไฟล์ให้ตรงกัน
- ภาพหน้าจอ: ถ่ายจากแอพโหมดสว่าง ขนาด 1440 × 761 แล้วบันทึกเป็น JPEG ใน `img/` ใช้ชื่อเดิมทับได้
- ถ้าเปลี่ยน selector หรือโครงสร้างวิดเจ็ตในแอพ (`electron/runtime.cjs` → `widgetDocument`) ต้องอัปเดตหัวข้อ “ตรงไหนเป็นตรงไหน” ใน `custom-css.html`

## ถ้าวันหนึ่งอยากขึ้นเว็บ

โฟลเดอร์นี้ deploy ได้ทันทีโดยไม่ต้องแก้: ลากทั้งโฟลเดอร์ไปที่ Netlify Drop (https://app.netlify.com/drop) หรือ Cloudflare Pages → Upload assets ทั้งสองที่อ่าน `_headers` ได้เลย ส่วน Vercel ใช้ `vercel.json`
