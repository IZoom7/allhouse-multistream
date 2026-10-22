'use strict';
// Original pixel-art sprites for the landing page (docs-site/assets/pixel/*.svg), drawn as text grids.
// One character = one pixel; '.' is transparent. Re-run after editing a grid:
//   node scripts/build-pixel-art.cjs
const fs = require('node:fs');
const path = require('node:path');

const PAL = {
  k: '#1d1a14', w: '#fff5dd', c: '#f5edd7', S: '#c9ced6', s: '#8a8f98', d: '#10141a', D: '#1f2a36',
  r: '#bd3933', R: '#8d2832', y: '#f0cb45', Y: '#c99a1e', o: '#f08a2b', g: '#287b49', G: '#53c26b',
  b: '#285bb5', B: '#5aa0ff', a: '#2bc3e0', p: '#e62eb4', v: '#7b4fd6', V: '#a78bff', n: '#5d4a36', N: '#8a6a48',
};

const SPRITES = {
  heart: [
    '..kkk...kkk..',
    '.krrrk.krrrk.',
    'krwwrrkrrrrrk',
    'krwrrrrrrrrrk',
    'krrrrrrrrrrrk',
    '.krrrrrrrrrk.',
    '..krrrrrrrk..',
    '...krrrrrk...',
    '....krrrk....',
    '.....krk.....',
    '......k......',
  ],
  star: [
    '.......k.......',
    '......kyk......',
    '......kyk......',
    '.....kyyyk.....',
    'kkkkkyywyykkkkk',
    'kyyyyyywyyyyyyk',
    '.kyyyyyyyyyyyk.',
    '..kyyyyyyyyyk..',
    '...kyyyyyyyk...',
    '...kyyyyyyyk...',
    '..kyyyykyyyyk..',
    '..kyyyk.kyyyk..',
    '.kyyk.....kyyk.',
    '.kkk.......kkk.',
  ],
  coin: [
    '....kkkkkk....',
    '..kkyyyyyykk..',
    '.kyywwyyyyyYk.',
    '.kywyyyyyyyYk.',
    'kyywyykkyyyyYk',
    'kywyyykYyyyyYk',
    'kywyyykYyyyyYk',
    'kyyyyykYyyyyYk',
    'kyyyyykYyyyyYk',
    'kyyyykkkkyyyYk',
    '.kyyyyyyyyyYk.',
    '.kYyyyyyyyYYk.',
    '..kkYYYYYYkk..',
    '....kkkkkk....',
  ],
  chat: [
    '.kkkkkkkkkkkkkk.',
    'kwwwwwwwwwwwwwck',
    'kwwwwwwwwwwwwwck',
    'kwwbbwwbbwwbbwck',
    'kwwbbwwbbwwbbwck',
    'kwwwwwwwwwwwwwck',
    'kcccccccccccccck',
    '.kkkkcckkkkkkkk.',
    '....kck.........',
    '....kk..........',
  ],
  mic: [
    '....kkkk....',
    '...kSSSSk...',
    '..kSwSSSSk..',
    '..kSSkSkSk..',
    '..kSkSkSSk..',
    '..kSSkSkSk..',
    '..kSSSSSSk..',
    '.k.kssssk.k.',
    '.k..kkkk..k.',
    '.kk......kk.',
    '..kk....kk..',
    '...kkkkkk...',
    '.....kk.....',
    '.....kk.....',
    '...kkkkkk...',
  ],
  speaker: [
    '......k.........',
    '.....kk.....k...',
    '....ksk...k..k..',
    'kkkkksk....k..k.',
    'kSSSksk..k..k.k.',
    'kSSSksk...k.k.k.',
    'kSSSksk...k.k.k.',
    'kSSSksk..k..k.k.',
    'kkkkksk....k..k.',
    '....ksk...k..k..',
    '.....kk.....k...',
    '......k.........',
  ],
  gift: [
    '...kk....kk...',
    '..krrk..krrk..',
    '..krwrkkrwrk..',
    '...krrrrrrk...',
    'kkkkkkkkkkkkkk',
    'kyyyyyrryyyyyk',
    'kywyyyrryyyyyk',
    'kkkkkkkkkkkkkk',
    '.kyyyyrryyyyk.',
    '.kywyyrryyyyk.',
    '.kyyyyrryyyyk.',
    '.kyyyyrryyyyk.',
    '.kyyyyrryyyYk.',
    '.kYYYYrrYYYYk.',
    '.kkkkkkkkkkkk.',
  ],
  trophy: [
    '..kkkkkkkkkk..',
    'kkkywyyyyyYkkk',
    'k.kywyyyyyYk.k',
    'k.kywyyyyyYk.k',
    '.kkyyyyyyyYkk.',
    '...kyyyyyYk...',
    '....kyyyYk....',
    '.....kyYk.....',
    '......kk......',
    '.....kYYk.....',
    '....kkkkkk....',
    '...knnnnnnk...',
    '...knyyyynk...',
    '...knnnnnnk...',
    '...kkkkkkkk...',
  ],
  gamepad: [
    '...kkkkkkkkkkkk...',
    '.kkSSSSSSSSSSSSkk.',
    'kSSSkSSSSSSSSSrSSk',
    'kSSkkkSSkkSSSbSgSk',
    'kSSSkSSSSSSSSSySSk',
    'kSSSSSSSSSSSSSSSSk',
    'kSSSSSSkkkkSSSSSSk',
    '.kSSSSk....kSSSSk.',
    '..kkkk......kkkk..',
  ],
  tv: [
    '....k.....k.....',
    '.....k...k......',
    '......k.k.......',
    '..kkkkkkkkkkkk..',
    '.knnnnnnnnnnnnk.',
    '.knkkkkkkkkknnk.',
    '.knkwyagpRbknNk.',
    '.knkwyagpRbknnk.',
    '.knkwyagpRbknNk.',
    '.knkkkkkkkkknnk.',
    '.knnnnnnnnnnnnk.',
    '..kkkkkkkkkkkk..',
    '...kk......kk...',
  ],
  rocket: [
    '.....kk.....',
    '....kwwk....',
    '...kwwwSk...',
    '...kwbbSk...',
    '..kwwbbwSk..',
    '..kwwwwwSk..',
    '..kwwwwwSk..',
    '..kwwrrwSk..',
    '.kkwwwwwSkk.',
    'krkwwwwwSkrk',
    'krrkwwwSkrrk',
    'kkk.kSSk.kkk',
    '....kook....',
    '...koyyok...',
    '....kyyk....',
    '.....kk.....',
  ],
  slime: [
    '......kkkk......',
    '....kkGGGGkk....',
    '...kGGwGGGGGk...',
    '..kGGwwGGGGGGk..',
    '..kGGGGGGGGGGk..',
    '.kGGkkGGGGkkGGk.',
    '.kGGkwGGGGkwGGk.',
    'kGGGGGGkkGGGGGGk',
    'kGGGGGGGGGGGGGGk',
    'kgGGGGGGGGGGGGgk',
    '.kgggGGGGGGgggk.',
    '..kkkkkkkkkkkk..',
  ],
  alien: [
    '...k.......k...',
    '....k.....k....',
    '...kvvvvvvvk...',
    '..kvvwkvvwkvk..',
    '.kvvvvvvvvvvvk.',
    'kvvkvvvvvvvkvvk',
    'kvkkvvvvvvvkkvk',
    'kk.kvkkkkkvk.kk',
    '...kk.....kk...',
  ],
  cloud: [
    '.......kkkk.........',
    '.....kkwwwwkk.......',
    '...kkwwwwwwwwk.kk...',
    '..kwwwwwwwwwwwkwwk..',
    '.kwwwwwwwwwwwwwwwwk.',
    'kwwwwwwwwwwwwwwwwwwk',
    'kSwwwwwwwwwwwwwwwwSk',
    '.kSSSSSSSSSSSSSSSSk.',
    '..kkkkkkkkkkkkkkkk..',
  ],
  bolt: [
    '....kkkk.',
    '...kyyyk.',
    '...kyyk..',
    '..kyyk...',
    '..kyykkkk',
    '.kyyyyyyk',
    '.kkkkyyk.',
    '....kyk..',
    '...kyk...',
    '...kk....',
  ],
  // Arcade cabinet: the screen (d) is rows 6–15, columns 4–17; landing.css overlays the live demo there.
  cabinet: [
    '..kkkkkkkkkkkkkkkkkk..',
    '.kRRRRRRRRRRRRRRRRRRk.',
    '.kRyyyyyyyyyyyyyyyyRk.',
    '.kRRRRRRRRRRRRRRRRRRk.',
    '.kkkkkkkkkkkkkkkkkkkk.',
    '.knnkkkkkkkkkkkkkknnk.',
    '.knkddddddddddddddknk.',
    '.knkddddddddddddddknk.',
    '.knkddddddddddddddknk.',
    '.knkddddddddddddddknk.',
    '.knkddddddddddddddknk.',
    '.knkddddddddddddddknk.',
    '.knkddddddddddddddknk.',
    '.knkddddddddddddddknk.',
    '.knkddddddddddddddknk.',
    '.knkddddddddddddddknk.',
    '.knkkkkkkkkkkkkkkkknk.',
    '.knnnnnnnnnnnnnnnnnnk.',
    'kkkkkkkkkkkkkkkkkkkkkk',
    'kNNNNkkNNNNNNNNNNNNNNk',
    'kNNNkrrkNNNNkbkkgkkykk',
    'kNNNNkkNNNNNNkkkkkkkNk',
    'kNNNNkNNNNNNNNNNNNNNNk',
    'kkkkkkkkkkkkkkkkkkkkkk',
    '.knnnnnnnnnnnnnnnnnnk.',
    '.knnnnnnkkkkkknnnnnnk.',
    '.knnnnnnkyykyyknnnnnk.',
    '.knnnnnnkkkkkknnnnnnk.',
    '.knnnnnnnnnnnnnnnnnnk.',
    '.knNnnnnnnnnnnnnnnNnk.',
    '.knnnnnnnnnnnnnnnnnnk.',
    '.kkkkkkkkkkkkkkkkkkkk.',
  ],
};

function svg(rows, name) {
  const w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) throw new Error(`${name}: row ${i} is ${r.length} wide, expected ${w}`); });
  let rects = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < w;) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      if (!PAL[ch]) throw new Error(`${name}: unknown colour "${ch}"`);
      let run = 1; while (x + run < w && row[x + run] === ch) run++;
      rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${PAL[ch]}"/>`;
      x += run;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${rows.length}" width="${w * 8}" height="${rows.length * 8}" shape-rendering="crispEdges">${rects}</svg>\n`;
}

/** Night city skyline: a repeatable 96×28 strip with lit windows (seeded, so it never changes between builds). */
function skyline() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const W = 96, H = 28; let rects = '';
  for (let x = 0; x < W;) {
    const bw = 5 + Math.floor(rnd() * 8), bh = 8 + Math.floor(rnd() * 18), top = H - bh;
    rects += `<rect x="${x}" y="${top}" width="${bw}" height="${bh}" fill="${rnd() > .5 ? '#1f2a36' : '#17202b'}"/>`;
    rects += `<rect x="${x}" y="${top}" width="${bw}" height="1" fill="#2c3a4a"/>`;
    for (let wy = top + 2; wy < H - 1; wy += 3) for (let wx = x + 1; wx < x + bw - 1; wx += 2)
      if (rnd() > .62) rects += `<rect x="${wx}" y="${wy}" width="1" height="1" fill="${rnd() > .2 ? '#f0cb45' : '#efa39a'}"/>`;
    if (rnd() > .7) rects += `<rect x="${x + Math.floor(bw / 2)}" y="${top - 3}" width="1" height="3" fill="#2c3a4a"/><rect x="${x + Math.floor(bw / 2)}" y="${top - 4}" width="1" height="1" fill="#bd3933"/>`;
    x += bw + (rnd() > .7 ? 1 : 0);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 6}" height="${H * 6}" preserveAspectRatio="none" shape-rendering="crispEdges">${rects}</svg>\n`;
}

const out = path.join(__dirname, '..', 'docs-site', 'assets', 'pixel');
fs.mkdirSync(out, { recursive: true });
for (const [name, rows] of Object.entries(SPRITES)) fs.writeFileSync(path.join(out, name + '.svg'), svg(rows, name));
fs.writeFileSync(path.join(out, 'skyline.svg'), skyline());
console.log('wrote', Object.keys(SPRITES).length + 1, 'sprites to', path.relative(process.cwd(), out));
