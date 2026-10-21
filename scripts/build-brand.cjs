/* Mechanical exports of the generated artwork: PNG sizes, Windows ICO and review sheets.
 * Requires sharp (authoring tool only; not needed to build/run Allhouse).
 * Run from the project root: node scripts/build-brand.cjs
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const design = path.join(root, 'design/branding');
const output = path.join(root, 'public/brand');
const names = ['01-arcade-house', '02-gamepad-house', '03-broadcast-house'];
const labels = ['ARCADE HOUSE', 'GAMEPAD HOUSE', 'BROADCAST HOUSE'];
const glyphs = {
  A:['01110','11011','11011','11111','11011','11011','11011'],
  L:['11000','11000','11000','11000','11000','11000','11111'],
  H:['11011','11011','11011','11111','11011','11011','11011'],
  O:['01110','11011','11011','11011','11011','11011','01110'],
  U:['11011','11011','11011','11011','11011','11011','01110'],
  S:['01111','11000','11000','01110','00011','00011','11110'],
  E:['11111','11000','11000','11110','11000','11000','11111'],
};
const d = [...'ALLHOUSE'].flatMap((c,i)=>glyphs[c].flatMap((row,y)=>[...row].flatMap((p,x)=>p==='1'?[`M${i*6+x} ${y}h1v1h-1z`]:[]))).join('');
const wordmark = color => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 47 7" width="564" height="84" shape-rendering="crispEdges"><path fill="${color}" d="${d}"/></svg>`);
const resize = (source,size)=>sharp(source).resize(size,size,{fit:'contain',kernel:'nearest',background:'#00000000'}).png().toBuffer();
async function main(){
  await fs.mkdir(output,{recursive:true});
  const chosen = path.join(design,names[0]+'.png');
  for(const size of [16,24,32,48,64,128,256,512,1024]) await fs.writeFile(path.join(output,`allhouse-icon-${size}.png`),await resize(chosen,size));
  const sizes=[16,24,32,48,64,128,256];
  const images=await Promise.all(sizes.map(size=>resize(chosen,size)));
  const header=Buffer.alloc(6+images.length*16);
  header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);
  let offset=header.length;
  images.forEach((image,i)=>{const p=6+i*16;header[p]=sizes[i]===256?0:sizes[i];header[p+1]=header[p];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(image.length,p+8);header.writeUInt32LE(offset,p+12);offset+=image.length});
  await fs.writeFile(path.join(output,'allhouse.ico'),Buffer.concat([header,...images]));
  const board=[];
  const boardSvg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1170"><rect width="1440" height="1170" fill="#d8ceb4"/><text x="60" y="70" font-family="sans-serif" font-size="32" font-weight="bold" fill="#302c26">ALLHOUSE / PIXEL BRAND EXPLORATIONS</text><text x="60" y="104" font-family="sans-serif" font-size="17" fill="#5d5444">Retro gaming. A place to stream. Three original directions.</text>${names.map((_,i)=>`<rect x="${40+i*466}" y="145" width="440" height="970" rx="12" fill="#f5edd7"/><text x="${64+i*466}" y="187" font-family="sans-serif" font-size="16" font-weight="bold" fill="#8d2832">0${i+1} / ${labels[i]}${i===0?' / SELECTED':''}</text><rect x="${56+i*466}" y="570" width="408" height="290" fill="#212225"/><text x="${64+i*466}" y="910" font-family="sans-serif" font-size="14" fill="#5d5444">APP ICON / 64 · 48 · 32 · 16 PX</text>`).join('')}</svg>`);
  for(let i=0;i<names.length;i++){
    const source=path.join(design,names[i]+'.png');
    board.push({input:await resize(source,220),left:150+i*466,top:215});
    for(const [theme,color] of [['light','#302c26'],['dark','#f0e4c5']]){
      const icon=await resize(source,256);
      const text=await sharp(wordmark(color)).png().toBuffer();
      const lockup=await sharp({create:{width:880,height:280,channels:4,background:'#00000000'}}).composite([{input:icon,left:0,top:12},{input:text,left:296,top:98}]).png().toBuffer();
      await fs.writeFile(path.join(design,`${names[i]}-lockup-${theme}.png`),lockup);
      if(i===0)await fs.writeFile(path.join(output,`allhouse-lockup-${theme}.png`),lockup);
      board.push({input:await sharp(lockup).resize(392).png().toBuffer(),left:64+i*466,top:theme==='light'?440:646});
    }
    let x=68+i*466;
    for(const size of [64,48,32,16]){board.push({input:await resize(source,size),left:x,top:945+(64-size)/2});x+=size+30}
  }
  for(const [theme,color] of [['light','#302c26'],['dark','#f0e4c5']]) await fs.writeFile(path.join(output,`allhouse-wordmark-${theme}.svg`),wordmark(color));
  await sharp(boardSvg).composite(board).png().toFile(path.join(design,'brand-board.png'));
  console.log('Exported three logo concepts, light/dark lockups, nine icon sizes, Windows ICO and brand-board.png');
}
main().catch(error=>{console.error(error);process.exitCode=1});

