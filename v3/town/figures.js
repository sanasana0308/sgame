// 小人畫圖：側面骨架 11 個點。遊戲和序列圖卡共用。
// figure 名稱對到 content/poses.json 的 "figure" 欄位；拉到位小遊戲的起點對到 poses.json 的 drag.from。
// 坐姿一律畫跪坐，不畫盤腿。
(function(){
const P={
 stand:{hd:[100,30],sh:[100,52],hip:[100,112],e1:[104,82],h1:[106,108],e2:[96,82],h2:[94,108],k1:[102,155],f1:[104,198],k2:[98,155],f2:[96,198]},
 dog:{hd:[60,176],sh:[72,160],hip:[120,124],e1:[52,179],h1:[33,198],e2:[56,179],h2:[38,198],k1:[144,161],f1:[167,198],k2:[140,161],f2:[161,198]},
 kneel:{hd:[104,98],sh:[102,120],hip:[104,180],e1:[100,150],h1:[96,176],e2:[106,150],h2:[110,176],k1:[60,192],f1:[110,196],k2:[64,193],f2:[114,197]},
 // 跪坐（sit）＝kneel，給內容檔用比較好懂的名字
 sit:null,
 dolphin:{hd:[54,182],sh:[70,168],hip:[118,132],e1:[70,197],h1:[38,198],e2:[74,197],h2:[44,198],k1:[147,165],f1:[175,198],k2:[143,165],f2:[169,198]},
 table:{hd:[44,132],sh:[62,142],hip:[122,138],e1:[62,170],h1:[62,198],e2:[66,170],h2:[68,198],k1:[160,154],f1:[162,198],k2:[156,154],f2:[156,198]},
 sphinx:{hd:[40,146],sh:[56,166],hip:[110,191],e1:[56,196],h1:[24,197],e2:[60,196],h2:[30,197],k1:[153,194],f1:[196,195],k2:[150,195],f2:[192,196]},
 hug:{hd:[104,98],sh:[102,120],hip:[104,180],e1:[78,142],h1:[112,128],e2:[82,150],h2:[114,138],k1:[60,192],f1:[110,196],k2:[64,193],f2:[114,197]},
 // 四足跪姿（手和膝蓋著地）：下犬式的起點
 fours:{hd:[28,124],sh:[42,140],hip:[104,142],e1:[40,170],h1:[38,198],e2:[44,170],h2:[42,198],k1:[106,194],f1:[152,197],k2:[102,194],f2:[148,197]},
 // 前臂跪姿（前臂和膝蓋著地）：海豚式的起點
 forearm:{hd:[52,168],sh:[70,172],hip:[120,150],e1:[70,197],h1:[38,198],e2:[74,197],h2:[44,198],k1:[122,194],f1:[168,197],k2:[118,194],f2:[164,197]},
 // 屈膝坐、手放屁股後面（腳掌踩地，不是盤腿）：反向桌式的起點
 tablesit:{hd:[76,116],sh:[80,140],hip:[104,192],e1:[70,168],h1:[62,198],e2:[74,168],h2:[68,198],k1:[140,160],f1:[160,198],k2:[136,160],f2:[154,198]},
 // 趴著：人面獅身的起點
 prone:{hd:[34,182],sh:[54,188],hip:[110,192],e1:[58,196],h1:[26,197],e2:[62,196],h2:[32,197],k1:[153,194],f1:[196,195],k2:[150,195],f2:[192,196]}
};
P.sit=P.kneel;
// 背面圖的姿勢：先跪坐（kneel），再轉到背面
const BACK={'cow-back':'kneel'};
const KEYS=Object.keys(P.stand);
const clone=p=>JSON.parse(JSON.stringify(p));
function lerpPose(a,b,t){const o={};for(const k of KEYS)o[k]=[a[k][0]+(b[k][0]-a[k][0])*t,a[k][1]+(b[k][1]-a[k][1])*t];return o;}
const Lsvg=(a,c,w,col)=>`<line x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
// 牛面手的背面圖。t：下面那隻手往上爬的進度（0＝垂在旁邊，1＝到位）。rope：有沒有瑜伽繩。
const COW={elbow0:[80,132],hand0:[84,176],elbow1:[76,134],hand1:[103,122],upHand:[117,100],ropeEnd:[114,152]};
function cowHand(t){const l=(a,b)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];return {e:l(COW.elbow0,COW.elbow1),h:l(COW.hand0,COW.hand1)};}
function backSvgT(b,t,rope,small,labels){
  const L=(x1,y1,x2,y2,w,col,extra)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${extra||''}/>`;
  const u=-b,ink='#2c2c2a';const {e,h}=cowHand(t);
  const ropeTo=rope?(t>=.6?h:COW.ropeEnd):null;
  return `${small?'':'<rect x="14" y="198" width="192" height="8" rx="4" fill="#7fa63d" opacity=".35"/>'}
   ${L(92,196,100,182,10,'#b9b2a6')}${L(128,196,120,182,10,'#b9b2a6')}
   <path d="M84 ${86+u} L136 ${86+u} L126 178 Q110 186 94 178 Z" fill="#e2ddd4" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
   <line x1="110" y1="${92+u}" x2="110" y2="172" stroke="#b9b2a6" stroke-width="2" stroke-dasharray="4 4"/>
   <circle cx="86" cy="${88+u}" r="10" fill="#ffc233" opacity=".9"/><circle cx="134" cy="${88+u}" r="10" fill="#ffc233" opacity=".9"/>
   ${L(134,88+u,148,36+u,8,ink)}${L(148,36+u,117,100+u,8,ink)}
   ${L(86,88+u,e[0],e[1]+u,8,ink)}${L(e[0],e[1]+u,h[0],h[1]+u,8,ink)}
   ${ropeTo?`<line x1="117" y1="${100+u}" x2="${ropeTo[0]}" y2="${ropeTo[1]+u}" stroke="#d7263d" stroke-width="4" stroke-dasharray="5 3" stroke-linecap="round"/>`:''}
   <circle cx="110" cy="${60+u}" r="14" fill="#fff" stroke="${ink}" stroke-width="3"/>
   ${small||labels===false?'':`<text x="141" y="${24+u}" text-anchor="end" font-size="12" font-weight="700" fill="#d7263d" font-family="Noto Sans TC,sans-serif">手肘朝上 ↑</text>
   <text x="70" y="${150+u}" text-anchor="end" font-size="12" font-weight="700" fill="#d7263d" font-family="Noto Sans TC,sans-serif">手肘朝下 ↓</text>
   ${rope?`<text x="137" y="${134+u}" font-size="11" fill="#888780" font-family="Noto Sans TC,sans-serif">瑜伽繩</text>`:''}`}`;
}
function backSvg(b,small){return backSvgT(b,1,true,small);}
function figSvg(p,b,opt){
  opt=opt||{};
  const q=k=>[p[k][0],p[k][1]-(['hd','sh','e1','e2','h1','h2'].includes(k)?b*(k==='hd'?1.2:1):0)];
  const far='#b9b2a6',near='#2c2c2a';
  const [hd,sh,hip,e1,h1,e2,h2,k1,f1,k2,f2]=KEYS.map(q);
  return `<rect x="14" y="198" width="192" height="8" rx="4" fill="#7fa63d" opacity=".35"/>
   ${Lsvg(hip,k2,8,far)}${Lsvg(k2,f2,8,far)}${Lsvg(sh,e2,7,far)}${Lsvg(e2,h2,7,far)}${Lsvg(sh,hip,10,near)}
   <circle cx="${sh[0]}" cy="${sh[1]}" r="11" fill="${opt.shrug?'#d7263d':'#ffc233'}" opacity=".9"/>
   ${Lsvg(hip,k1,8,near)}${Lsvg(k1,f1,8,near)}${Lsvg(sh,e1,7,near)}${Lsvg(e1,h1,7,near)}
   <circle cx="${hd[0]}" cy="${hd[1]}" r="12" fill="#fff" stroke="#2c2c2a" stroke-width="3"/>`;
}
// 聳肩怪：灰紫色的小團子，兩隻手往上抓（遊戲地圖以外的地方用 SVG）
function monsterSvg(cls,sleepy){
  const ink='#2c2c2a';
  return `<svg class="${cls||''}" viewBox="0 0 64 64" aria-hidden="true"><path d="M10 52 C6 34 14 18 32 18 C50 18 58 34 54 52 Z" fill="#6d6a8a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
   <path d="M14 30 L6 14 M50 30 L58 14" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><circle cx="6" cy="13" r="3.5" fill="#6d6a8a" stroke="${ink}" stroke-width="2"/><circle cx="58" cy="13" r="3.5" fill="#6d6a8a" stroke="${ink}" stroke-width="2"/>
   ${sleepy?'<path d="M20 34 q4 3 8 0 M36 34 q4 3 8 0" stroke="#ffc233" stroke-width="3" fill="none" stroke-linecap="round"/>':'<circle cx="24" cy="33" r="5" fill="#ffc233"/><circle cx="40" cy="33" r="5" fill="#ffc233"/><circle cx="25" cy="34" r="2" fill="'+ink+'"/><circle cx="41" cy="34" r="2" fill="'+ink+'"/>'}
   <path d="M24 44 q8 -5 16 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
}
// 小貼紙、圖卡用的靜態圖（不含地板）
function poseSvg(figure,cls){
  const c=cls?` class="${cls}"`:'';
  if(BACK[figure])return `<svg${c} viewBox="40 14 140 196" aria-hidden="true">${backSvg(0,true)}</svg>`;
  const p=P[figure]||P.stand;
  return `<svg${c} viewBox="10 20 200 190" aria-hidden="true">${figSvg(p,0).replace(/<rect[^>]*\/>/,'')}</svg>`;
}
window.SWFig={P,KEYS,BACK,COW,clone,lerpPose,cowHand,backSvg,backSvgT,figSvg,poseSvg,monsterSvg};
})();
