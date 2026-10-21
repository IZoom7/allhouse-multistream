const { chromium } = require('playwright');
const path = require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5189/');
    await page.getByRole('button',{name:'Allhouse — หน้าแรก',exact:true}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('.brand .allhouse-symbol').evaluate(img=>img.decode());
    const bounds=await page.locator('.allhouse-lockup').evaluate(el=>{
      const a=el.getBoundingClientRect(),b=el.closest('.sidebar').getBoundingClientRect();
      return {width:a.width,inside:a.left>=b.left&&a.right<=b.right,icon:el.querySelector('img').naturalWidth};
    });
    if(!bounds.inside||!bounds.icon)throw new Error('Logo is clipped or missing');
    await page.screenshot({path:path.join(__dirname,'app-dark.png')});
    await page.getByRole('button',{name:'สลับธีม',exact:true}).click();
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
    await page.waitForFunction(()=>[...document.querySelectorAll('.nav-item')].every(el=>!el.disabled));
    await page.screenshot({path:path.join(__dirname,'app-light.png')});
    await page.setViewportSize({width:800,height:600});
    const menu=page.locator('button.mobile-menu');
    await menu.click();
    await page.locator('.sidebar.open').waitFor();
    await page.screenshot({path:path.join(__dirname,'app-compact.png')});
    console.log(JSON.stringify({bounds,pageErrors:errors,themes:['dark','light'],compact:'800x600'}));
    if(errors.length)throw new Error(errors.join('; '));
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});


