import React from 'react';

// The symbol is generated artwork; the wordmark uses a small, original pixel alphabet.
// Keep the accessible name on the enclosing link/button rather than reading each asset.
const letters: Record<string, string[]> = {
  A: ['01110','11011','11011','11111','11011','11011','11011'],
  L: ['11000','11000','11000','11000','11000','11000','11111'],
  H: ['11011','11011','11011','11111','11011','11011','11011'],
  O: ['01110','11011','11011','11011','11011','11011','01110'],
  U: ['11011','11011','11011','11011','11011','11011','01110'],
  S: ['01111','11000','11000','01110','00011','00011','11110'],
  E: ['11111','11000','11000','11110','11000','11000','11111'],
};
const wordPath = [...'ALLHOUSE'].flatMap((letter, i) => letters[letter].flatMap((row, y) =>
  [...row].flatMap((cell, x) => cell === '1' ? [`M${i * 6 + x} ${y}h1v1h-1z`] : [])
)).join('');
const icon = './brand/allhouse-icon-128.png?v=20261022';

export function BrandIcon({size=48,className=''}:{size?:number;className?:string}) {
  return <img className={'allhouse-symbol '+className} src={icon} width={size} height={size} alt="" draggable={false}/>;
}

export function BrandLockup() {
  return <span className="allhouse-lockup" aria-hidden="true">
    <BrandIcon/>
    <span className="allhouse-lettering">
      <BrandWordmark/>
      <span className="allhouse-brand-caption">STREAMING STUDIO</span>
    </span>
  </span>;
}

export function BrandWordmark() {
  return <svg className="allhouse-wordmark" viewBox="0 0 47 7" width="141" height="21" fill="currentColor" shapeRendering="crispEdges" focusable="false" aria-hidden="true"><path d={wordPath}/></svg>;
}
