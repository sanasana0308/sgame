// 玩家存檔：整個網站只用一個 localStorage key「sandywich.player」。
// v 是版本號。改格式時，在 migrate() 加一段轉換，舊進度不能消失。
(function(){
const KEY='sandywich.player';
const V=1;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function blank(){return {v:V,createdAt:today(),nickname:'',pain:'',bag:{brick:0,rope:false},zones:{},monsters:[],badges:[]};}
function blankZone(){return {helped:[],quiz:{},right:0,bricks:[],cheese:false,brickUsed:false,done:false,doneAt:''};}
function read(k){try{return JSON.parse(localStorage.getItem(k));}catch(_){return null;}}
function migrate(s){
  if(!s||typeof s!=='object')return null;
  // 之後格式改版：if(s.v===1){...; s.v=2;}
  if(!s.v)s.v=1;
  const b=blank();
  for(const k of Object.keys(b))if(s[k]===undefined)s[k]=b[k];
  if(!s.bag||typeof s.bag!=='object')s.bag=b.bag;
  return s;
}
// 舊版三明治鎮（claude artifact 時期）的存檔，搬進新格式
function fromOld(){
  const o=read('sandwich-town-z1-v1');
  if(!o||!Array.isArray(o.helped))return null;
  const s=blank();const z=blankZone();
  z.helped=o.helped.slice();z.right=o.right||0;z.bricks=Array.isArray(o.bricks)?o.bricks.slice():[];
  z.cheese=!!o.cheese;z.brickUsed=!!o.brickUsed;z.done=!!o.done;if(z.done)z.doneAt=today();
  s.zones['2026-10-shoulder']=z;s.bag={brick:z.bricks.length,rope:!!o.strap};
  if(z.bricks.length>=3)s.badges.push('brick-master');if(z.cheese)s.badges.push('cheese');
  return s;
}
let S=migrate(read(KEY))||fromOld()||blank();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(_){}}
save();
window.SWPlayer={
  get:()=>S,
  save,
  today,
  zone(id){if(!S.zones[id])S.zones[id]=blankZone();return S.zones[id];},
  resetZone(id){S.zones[id]=blankZone();save();},
  badge(id){if(!S.badges.includes(id)){S.badges.push(id);save();return true;}return false;},
  monster(id){if(!S.monsters.includes(id)){S.monsters.push(id);save();}}
};
})();
