// Fresh screenshots of the local browser preview; never edits existing screenshots.
const {chromium}=require('playwright');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:761},deviceScaleFactor:1});
    await page.goto('http://127.0.0.1:5189/');
    await page.locator('.brand .allhouse-symbol').evaluate(img=>img.decode());
    await page.getByRole('button',{name:'สลับธีม',exact:true}).click();
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
    await page.evaluate(()=>document.fonts.ready);
    const shoot=async name=>{
      await page.screenshot({path:path.resolve(__dirname,'../../docs-site/img',name+'-v2.jpg'),type:'jpeg',quality:90,animations:'disabled'});
    };
    const nav=async label=>{
      await page.locator('.nav-item').filter({hasText:label}).click();
      await page.locator('main').evaluate(el=>el.scrollTop=0);
      await page.evaluate(()=>document.fonts.ready);
    };
    await shoot('home');
    for(const [label,name] of [['เชื่อมต่อแพลตฟอร์ม','connections'],['แชทและกิจกรรม','activity'],['ตั้งค่า','settings'],['บอทอ่านแชท','tts'],['วิดเจ็ต OBS','widgets']]){
      await nav(label);await shoot(name);
    }
    await page.getByRole('tab',{name:/แจ้งเตือนผู้ติดตาม/}).click();
    await shoot('widget-editor');
    await page.getByRole('tab',{name:/แจ้งเตือนของขวัญ/}).click();
    await shoot('widget-gift');
    await page.getByRole('tab',{name:/กล่องแชท/}).click();
    const css=page.getByRole('switch',{name:'ใช้ CSS กำหนดเอง (ขั้นสูง)',exact:true});
    await css.click();
    await page.getByRole('button',{name:'ใส่โค้ดตัวอย่าง',exact:true}).click();
    await page.locator('.css-editor').scrollIntoViewIfNeeded();
    await shoot('widget-css');
    await nav('บอทอ่านแชท');
    await page.locator('.tts-rules').scrollIntoViewIfNeeded();
    await shoot('tts-rules');
    console.log('Refreshed ten manual screenshots from the current UI with the new logo.');
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
