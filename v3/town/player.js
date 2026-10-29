// 玩家存檔：整個網站只用一個 localStorage key「sandywich.player」。
// v 是版本號。改格式時，在 migrate() 加一段轉換，舊進度不能消失。
// v1 → v2（2026-10-23）：三明治鎮加了時鐘、體力、失敗。每區多了 runs、best、perfects、styles、scares、last；
//   helped 改成「曾經救回過的居民」（貼紙），舊的 helped 原封不動保留。
// v2 → v3（2026-10-28）：加 tut（第一次的教學看過了沒，例如「穩住」的練習呼吸）。best、last 多了 title（可以沒有）。
(function(){
const KEY='sandywich.player.v3';
const V=3;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function blank(){return {v:V,createdAt:today(),nickname:'',pain:'',title:'',bag:{brick:0,rope:false},zones:{},monsters:[],badges:[],tut:{hold:false}};}
function blankZone(){return {helped:[],quiz:{},right:0,bricks:[],cheese:false,brickUsed:false,done:false,doneAt:'',
  runs:0,best:null,perfects:0,styles:{},scares:0,last:null};}
function read(k){try{return JSON.parse(localStorage.getItem(k));}catch(_){return null;}}
function fillZone(z){
  const b=blankZone();if(!z||typeof z!=='object')return b;
  for(const k of Object.keys(b))if(z[k]===undefined||z[k]===null&&b[k]!==null)z[k]=b[k];
  if(!Array.isArray(z.helped))z.helped=[];if(!Array.isArray(z.bricks))z.bricks=[];
  return z;
}
function migrate(s){
  if(!s||typeof s!=='object')return null;
  if(!s.v)s.v=1;
  if(s.v===1){
    // v1 的「done」代表全部幫完。轉成 v2 的最佳紀錄，時間不知道就留空。
    for(const id of Object.keys(s.zones||{})){
      const z=fillZone(s.zones[id]);
      if(z.helped.length&&!z.best)z.best={saved:z.helped.length,min:null,date:z.doneAt||'',from:'v1'};
      s.zones[id]=z;
    }
    s.v=2;
  }
  if(s.v===2){
    // 玩過 v2 的人已經會「穩住」，不用再練習
    const played=Object.values(s.zones||{}).some(z=>z&&(z.runs||0)>0);
    s.tut={hold:played};s.v=3;
  }
  const b=blank();
  for(const k of Object.keys(b))if(s[k]===undefined)s[k]=b[k];
  if(!s.bag||typeof s.bag!=='object')s.bag=b.bag;
  if(!s.zones||typeof s.zones!=='object')s.zones={};
  for(const id of Object.keys(s.zones))s.zones[id]=fillZone(s.zones[id]);
  if(!s.tut||typeof s.tut!=='object')s.tut={hold:false};
  if(!Array.isArray(s.monsters))s.monsters=[];if(!Array.isArray(s.badges))s.badges=[];
  return s;
}
// 舊版三明治鎮（claude artifact 時期）的存檔，搬進新格式
function fromOld(){
  const o=read('sandwich-town-z1-v1');
  if(!o||!Array.isArray(o.helped))return null;
  const s=blank();const z=blankZone();
  z.helped=o.helped.slice();z.right=o.right||0;z.bricks=Array.isArray(o.bricks)?o.bricks.slice():[];
  z.cheese=!!o.cheese;z.brickUsed=!!o.brickUsed;z.done=!!o.done;if(z.done)z.doneAt=today();
  if(z.helped.length)z.best={saved:z.helped.length,min:null,date:z.doneAt,from:'artifact'};
  s.zones['2026-10-shoulder']=z;s.bag={brick:z.bricks.length,rope:!!o.strap};
  if(z.bricks.length>=3)s.badges.push('brick-master');if(z.cheese)s.badges.push('cheese');
  return s;
}
let S=migrate(read(KEY))||fromOld()||blank();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(_){}}
save();
window.SWPlayer={
  V,
  get:()=>S,
  save,
  today,
  zone(id){if(!S.zones[id])S.zones[id]=blankZone();return S.zones[id];},
  resetZone(id){S.zones[id]=blankZone();save();},
  badge(id){if(!S.badges.includes(id)){S.badges.push(id);save();return true;}return false;},
  monster(id){if(!S.monsters.includes(id)){S.monsters.push(id);save();return true;}return false;}
};
})();
