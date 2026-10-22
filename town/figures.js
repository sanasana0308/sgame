// 小人畫圖：側面骨架 11 個點。遊戲和序列圖卡共用。
// figure 名稱對到 content/poses.json 的 "figure" 欄位。
(function(){
const P={
 stand:{hd:[100,30],sh:[100,52],hip:[100,112],e1:[104,82],h1:[106,108],e2:[96,82],h2:[94,108],k1:[102,155],f1:[104,198],k2:[98,155],f2:[96,198]},
 dog:{hd:[60,176],sh:[72,160],hip:[120,124],e1:[52,179],h1:[33,198],e2:[56,179],h2:[38,198],k1:[144,161],f1:[167,198],k2:[140,161],f2:[161,198]},
 kneel:{hd:[104,98],sh:[102,120],hip:[104,180],e1:[100,150],h1:[96,176],e2:[106,150],h2:[110,176],k1:[60,192],f1:[110,196],k2:[64,193],f2:[114,197]},
 dolphin:{hd:[54,182],sh:[70,168],hip:[118,132],e1:[70,197],h1:[38,198],e2:[74,197],h2:[44,198],k1:[147,165],f1:[175,198],k2:[143,165],f2:[169,198]},
 table:{hd:[44,132],sh:[62,142],hip:[122,138],e1:[62,170],h1:[62,198],e2:[66,170],h2:[68,198],k1:[160,154],f1:[162,198],k2:[156,154],f2:[156,198]},
 sphinx:{hd:[40,146],sh:[56,166],hip:[110,191],e1:[56,196],h1:[24,197],e2:[60,196],h2:[30,197],k1:[153,194],f1:[196,195],k2:[150,195],f2:[192,196]},
 hug:{hd:[104,98],sh:[102,120],hip:[104,180],e1:[78,142],h1:[112,128],e2:[82,150],h2:[114,138],k1:[60,192],f1:[110,196],k2:[64,193],f2:[114,197]}
};
// 背面圖的姿勢：先跪坐（kneel），再轉到背面
const BACK={'cow-back':'kneel'};
const KEYS=Object.keys(P.stand);
const Lsvg=(a,c,w,col)=>`<line x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
function backSvg(b,small){
  const L=(x1,y1,x2,y2,w,col)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const u=-b,ink='#2c2c2a';
  return `${small?'':'<rect x="14" y="198" width="192" height="8" rx="4" fill="#7fa63d" opacity=".35"/>'}
   ${L(92,196,100,182,10,'#b9b2a6')}${L(128,196,120,182,10,'#b9b2a6')}
   <path d="M84 ${86+u} L136 ${86+u} L126 178 Q110 186 94 178 Z" fill="#e2ddd4" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
   <line x1="110" y1="${92+u}" x2="110" y2="172" stroke="#b9b2a6" stroke-width="2" stroke-dasharray="4 4"/>
   <circle cx="86" cy="${88+u}" r="10" fill="#ffc233" opacity=".9"/><circle cx="134" cy="${88+u}" r="10" fill="#ffc233" opacity=".9"/>
   ${L(134,88+u,148,36+u,8,ink)}${L(148,36+u,117,100+u,8,ink)}
   ${L(86,88+u,76,134+u,8,ink)}${L(76,134+u,103,122+u,8,ink)}
   <line x1="117" y1="${100+u}" x2="103" y2="${122+u}" stroke="#d7263d" stroke-width="4" stroke-dasharray="5 3" stroke-linecap="round"/>
   <circle cx="110" cy="${60+u}" r="14" fill="#fff" stroke="${ink}" stroke-width="3"/>
   ${small?'':`<text x="156" y="${36+u}" font-size="12" font-weight="700" fill="#d7263d" font-family="Noto Sans TC,sans-serif">↑ 手肘朝上</text>
   <text x="70" y="${150+u}" text-anchor="end" font-size="12" font-weight="700" fill="#d7263d" font-family="Noto Sans TC,sans-serif">手肘朝下 ↓</text>
   <text x="137" y="${134+u}" font-size="11" fill="#888780" font-family="Noto Sans TC,sans-serif">瑜伽繩</text>`}`;
}
function figSvg(p,b){
  const q=k=>[p[k][0],p[k][1]-(['hd','sh','e1','e2','h1','h2'].includes(k)?b*(k==='hd'?1.2:1):0)];
  const far='#b9b2a6',near='#2c2c2a';
  const [hd,sh,hip,e1,h1,e2,h2,k1,f1,k2,f2]=KEYS.map(q);
  return `<rect x="14" y="198" width="192" height="8" rx="4" fill="#7fa63d" opacity=".35"/>
   ${Lsvg(hip,k2,8,far)}${Lsvg(k2,f2,8,far)}${Lsvg(sh,e2,7,far)}${Lsvg(e2,h2,7,far)}${Lsvg(sh,hip,10,near)}
   <circle cx="${sh[0]}" cy="${sh[1]}" r="11" fill="#ffc233" opacity=".9"/>
   ${Lsvg(hip,k1,8,near)}${Lsvg(k1,f1,8,near)}${Lsvg(sh,e1,7,near)}${Lsvg(e1,h1,7,near)}
   <circle cx="${hd[0]}" cy="${hd[1]}" r="12" fill="#fff" stroke="#2c2c2a" stroke-width="3"/>`;
}
// 小貼紙、圖卡用的靜態圖（不含地板）
function poseSvg(figure,cls){
  const c=cls?` class="${cls}"`:'';
  if(BACK[figure])return `<svg${c} viewBox="40 14 140 196" aria-hidden="true">${backSvg(0,true)}</svg>`;
  const p=P[figure]||P.stand;
  return `<svg${c} viewBox="10 20 200 190" aria-hidden="true">${figSvg(p,0).replace(/<rect[^>]*\/>/,'')}</svg>`;
}
window.SWFig={P,KEYS,BACK,backSvg,figSvg,poseSvg};
})();
