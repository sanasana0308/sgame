// 三明治鎮遊戲程式（v2：時鐘、緊繃值、體力、聳肩怪、拉到位＋穩住小遊戲、教學風格結尾）。
// 內容全部來自 /content/，數值在 zone 檔的 rules。新的一區只要新增 zone 檔，這個檔案很少需要改。
(async function(){
const {P,KEYS,BACK,COW,clone,lerpPose,backSvgT,figSvg,poseSvg,monsterSvg}=window.SWFig;
const PL=window.SWPlayer;
const $=id=>document.getElementById(id);

// ================= 讀內容 =================
async function getJSON(u){const r=await fetch(u,{cache:'no-cache'});if(!r.ok)throw new Error(u);return r.json();}
let POSES={},Z;
try{
  const [poses,idx]=await Promise.all([getJSON('/v3/content/poses.json'),getJSON('/v3/content/zones/index.json')]);
  for(const p of poses.poses)POSES[p.id]=p;
  const zones=await Promise.all(idx.zones.map(id=>getJSON(`/v3/content/zones/${id}.json`)));
  zones.sort((a,b)=>a.order-b.order);
  const want=new URLSearchParams(location.search).get('zone');
  const today=PL.today();
  const open=zones.filter(z=>z.unlock<=today);
  Z=(want&&zones.find(z=>z.id===want&&z.unlock<=today))||open[open.length-1];
  if(!Z){const next=zones[0];$('toast').textContent=`三明治鎮 ${next.unlock} 開放，敬請期待！`;return;}
}catch(e){$('toast').textContent='小鎮的地圖還沒載入，請重新整理一次。';console.error(e);return;}
// 網站設定（IG 帳號）。讀不到也沒關係，結尾就不顯示 IG 按鈕。
let SITE={};try{SITE=await getJSON('/v3/content/site.json');}catch(_){}
const IG=(()=>{const h=String((SITE.ig||{}).handle||'').trim().replace(/^@/,'');return h?{handle:h,url:(SITE.ig.url||'').trim()||`https://www.instagram.com/${encodeURIComponent(h)}/`}:null;})();

// ================= 規則（數值） =================
const DEF={dayStart:'08:00',dayEnd:'17:00',minPerSec:2,walkTilesPerSec:3.2,lessonMin:40,retryMin:20,talkMin:20,noRopeMin:15,wrongQuizMin:8,
  startTension:[20,50],failTension:20,monsterBoost:1.8,monsterNear:2,cardAt:3,fastBefore:'15:00',
  energy:{start:100,perfect:12,pass:16,fail:28,walkTile:.25,low:30,lowZone:-.05,zeroRestMin:50,zeroRefill:50},
  hold:{zone:.42,minZone:.28,breaths:2,inSec:4,exSec:5,low:.3,high:.7,up:.17,down:.14,wobble:.04,perfect:.8,pass:.5,outMax:3,brickZone:.1}};
const R=Object.assign({},DEF,Z.rules||{});R.energy=Object.assign({},DEF.energy,(Z.rules||{}).energy);R.hold=Object.assign({},DEF.hold,(Z.rules||{}).hold);
const hm=s=>{const [h,m]=String(s).split(':').map(Number);return h*60+(m||0);};
const DAY0=hm(R.dayStart),DAYLEN=hm(R.dayEnd)-DAY0;
const clockStr=m=>{const t=DAY0+Math.round(m);return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;};
const RM=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){return false}})();
// 測試用：?speed=4 讓地圖上的時間和走路一起變快（比例不變，平衡不變）
const SPEED=Math.min(8,Math.max(1,+new URLSearchParams(location.search).get('speed')||1));
const GAME_URL=location.origin+'/town';
const MON=Object.assign({start:[1,1],minPerTile:2.2,drain:12,scareTaps:5,scareTapsRope:3,dazeMin:40},Z.monster||{});
const ROPE=Z.items.find(i=>i.id==='rope');
const BRICK=Z.items.find(i=>i.id==='brick')||{at:[],badgeAt:99};
const BRICKS=BRICK.at;
const REST=Z.rest||{};
const BADGES=Z.badges||{};
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const fill=(s,o)=>String(s||'').replace(/\{(\w+)\}/g,(_,k)=>o[k]!==undefined?o[k]:'');

// 居民
const NPCS=Z.residents.map(r=>{
  const pose=POSES[r.pose]||{};
  return {id:r.id,nm:r.name,role:r.role||'',x:r.at[0],y:r.at[1],kind:r.char,color:r.color,need:r.needs,noitem:r.noItem,ask:r.ask,thanks:r.thanks,
    sticker:r.sticker,bonus:r.bonus,bonusHave:r.bonusHave,bonusMissing:r.bonusMissing,bonusThanks:r.bonusThanks,
    rate:r.rate||.3,wobble:r.wobble||1,from:r.from?hm(r.from)-hm((Z.rules||{}).dayStart||'08:00'):0,fromStr:r.from||'',arrive:r.arrive||'',startT:r.startTension||null,part:r.part||Z.part,mood:r.mood||{},ap:r.approach||{},
    drag:pose.drag||{joint:'hip',from:'stand',label:''},quizRaw:r.quiz,
    L:{nm:pose.name,en:pose.en,fig:pose.figure,back:!!BACK[pose.figure],intro:pose.intro,q:r.quiz.q,fact:r.fact||pose.fact,tip:r.tip||pose.cue,cue:pose.cue,warn:pose.warn}};
});
const F=Z.finale,SEC=Z.secret;
const LETTUCE={id:'lettuce',nm:F.name,role:F.role,x:F.at[0],y:F.at[1],kind:F.char};
const CHEESE=SEC?{id:'cheese',nm:SEC.name,role:SEC.role,x:SEC.at[0],y:SEC.at[1],kind:SEC.char}:null;

// 地圖
const MAP=Z.map.rows,BINFO=Z.map.buildings;
const H=MAP.length,W=MAP[0].length,DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const grid=MAP.map(r=>r.split(''));
const BLD={};for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=grid[y][x];if(BINFO[c]){const b=BLD[c]||(BLD[c]={x0:x,y0:y,x1:x,y1:y});b.x0=Math.min(b.x0,x);b.y0=Math.min(b.y0,y);b.x1=Math.max(b.x1,x);b.y1=Math.max(b.y1,y);}}
const walkable=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&(grid[y][x]==='.'||grid[y][x]==='=');
const FLOOR=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(walkable(x,y))FLOOR.push([x,y]);

// ================= 存檔 =================
const G=PL.get();
let S=PL.zone(Z.id);
const save=()=>PL.save();
const hasRope=()=>!!G.bag.rope;

// ================= 一天（一局）的狀態，不存檔 =================
let run,player,sheetOpen=false,sheetLive=false,sheetKind='',keyHandler=null;
function newRun(){
  const [a,b]=R.startTension;
  run={min:0,started:false,over:false,timeUp:false,allDoneAt:null,energy:R.energy.start,active:null,
    res:Object.fromEntries(NPCS.map(n=>{const [lo,hi]=n.startT||[a,b];return [n.id,{t:Math.round(rnd(lo,hi)),state:n.from>0?'away':'open',fails:0,tries:0,grade:'',warned:false}];})),
    events:(Z.events||[]).map(e=>({e,at:Math.random()<(e.chance??1)?rnd(hm(e.time[0])-DAY0,hm(e.time[1])-DAY0):null,done:false})),
    walkMul:1,rainUntil:-1,rainId:null,
    coupon:Z.coupon&&Z.coupon.at&&Z.coupon.at.length?{at:pick(Z.coupon.at),have:false,used:false}:null,
    cheese:null,
    mon:{x:MON.start[0],y:MON.start[1],fx:MON.start[0],fy:MON.start[1],path:[],target:null,acc:0,daze:0,cool:0,linger:0,taps:[]},
    st:{picks:0,hiPick:0,nearPick:0,talk:0,direct:0,rests:0,zero:0,fails:0,perfects:0,passes:0,walk:0,wasted:0,pend:0,monster:0,scares:0,minEnergy:R.energy.start,wrong:0,noRope:0,badAp:0,order:[]},
    origin:[Z.map.start[0],Z.map.start[1]],newBadges:[]};
  if(SEC&&SEC.window){
    const sp=SEC.spots&&SEC.spots.length?pick(SEC.spots):{at:SEC.at,hint:''};
    const from=rnd(hm(SEC.window[0])-DAY0,hm(SEC.window[1])-DAY0);
    run.cheese={x:sp.at[0],y:sp.at[1],hint:sp.hint,from,to:from+(SEC.stay||45),shown:false,gone:false,caught:false};
  }else if(SEC)run.cheese={x:SEC.at[0],y:SEC.at[1],hint:'',from:0,to:DAYLEN,shown:true,gone:false,caught:false};
  player={x:Z.map.start[0],y:Z.map.start[1],path:[],target:null};
}
newRun();
const resOf=n=>run.res[n.id];
const openRes=()=>NPCS.filter(n=>resOf(n).state==='open');
const cheeseVisible=()=>run.cheese&&!run.cheese.caught&&!run.cheese.gone&&run.min>=run.cheese.from&&run.min<run.cheese.to;
function allPeople(){const a=[...NPCS.filter(n=>resOf(n).state!=='away'),LETTUCE];if(CHEESE&&cheeseVisible())a.push(Object.assign(CHEESE,{x:run.cheese.x,y:run.cheese.y}));return a;}
function blocked(x,y){if(!walkable(x,y))return true;return allPeople().some(n=>n.x===x&&n.y===y);}
function bfs(sx,sy,goal,blk){
  blk=blk||blocked;if(goal(sx,sy))return [];
  const K=(x,y)=>y*W+x,start=K(sx,sy),prev=new Map([[start,-1]]),q=[[sx,sy]];
  while(q.length){const [x,y]=q.shift();for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy;if(blk(nx,ny))continue;const k=K(nx,ny);if(prev.has(k))continue;prev.set(k,K(x,y));
    if(goal(nx,ny)){const path=[];let c=k;while(c!==start){path.unshift([c%W,(c/W)|0]);c=prev.get(c);}return path;}q.push([nx,ny]);}}
  return null;
}
const adjTo=(x,y,tx,ty)=>Math.abs(tx-x)+Math.abs(ty-y)===1;
const distTo=(sx,sy,n)=>{const p=bfs(sx,sy,(x,y)=>adjTo(x,y,n.x,n.y));return p?p.length:99;};

// ================= 標題 =================
const ORD=['','一','二','三','四','五','六','七','八','九','十','十一','十二'];
const zoneName=`第${ORD[Z.order]||Z.order}區`;
$('zoneTag').textContent=`${zoneName} · ${Z.title}`;
$('listTitle').firstChild.textContent=Z.listTitle+' ';
$('help').textContent=`點地圖走路，點居民就會走過去。紅色長條是緊繃值，滿了就會被聳肩怪抓走。連點聳肩怪可以嚇跑牠。噴水池喝水、長椅休息可以回體力。鎮上藏著${BRICKS.length?`瑜伽磚、`:''}一張肩膀按摩券，還有一位愛躲的居民。電腦可以用方向鍵走路、E 互動。`;

// ================= 時間 =================
function floatPlus(t){const el=$('plus');if(!el)return;el.textContent=t;el.classList.remove('on');void el.offsetWidth;el.classList.add('on');}
function tick(gm){
  if(run.over)return;
  run.min+=gm;
  // 事件
  for(const ev of run.events){if(ev.done||ev.at===null||run.min<ev.at)continue;ev.done=true;fireEvent(ev.e);}
  if(run.rainUntil>=0&&run.min>=run.rainUntil){run.rainUntil=-1;run.walkMul=1;const e=(Z.events||[]).find(x=>x.id===run.rainId);toast(e&&e.over||'雨停了。');}
  // 聳肩怪
  const m=run.mon;
  if(m.cool>0)m.cool-=gm;
  if(m.daze>0)m.daze-=gm;
  else{m.acc+=gm/MON.minPerTile;m.linger-=gm;while(m.acc>=1){m.acc-=1;monStep();}}
  // 晚一點才出現的居民
  for(const n of NPCS){const r=resOf(n);if(r.state==='away'&&run.min>=n.from){r.state='open';toast(n.arrive||`${n.nm}出現了。`,'event');}}
  // 緊繃值
  for(const n of NPCS){const r=resOf(n);if(r.state!=='open'||run.active===n.id)continue;
    const near=m.daze<=0&&Math.abs(m.x-n.x)+Math.abs(m.y-n.y)<=R.monsterNear;
    r.t+=n.rate*(near?R.monsterBoost:1)*gm;r.near=near;
    if(r.t>=75&&!r.warned){r.warned=true;toast(`${n.nm}的肩膀快撐不住了！`,'warn');}
    if(r.t>=100)stuck(n);}
  // 起司先生
  const c=run.cheese;
  if(c&&!c.caught&&!c.gone){
    if(!c.shown&&run.min>=c.from){c.shown=true;if(Math.round(player.x)===c.x&&Math.round(player.y)===c.y){c.x=Z.secret.at[0];c.y=Z.secret.at[1];}toast(fill(SEC.appear||'（好像有人在偷看你。）',{hint:c.hint}));}
    if(run.min>=c.to){c.gone=true;if(c.shown)toast(SEC.hide||'起司先生又躲起來了。');}
  }
  if(run.min>=DAYLEN)run.timeUp=true;
}
function spend(min,label){
  let left=min;while(left>0&&!run.timeUp){const d=Math.min(1,left);tick(d);left-=d;}
  if(label!==false)floatPlus(`+${min} 分鐘`);
  renderHud();
}
function fireEvent(e){
  if(e.tensionAll)for(const n of NPCS){const r=resOf(n);if(r.state==='open'&&run.active!==n.id){r.t+=e.tensionAll;if(r.t>=100)stuck(n);}}
  if(e.tension)for(const id in e.tension){const n=NPCS.find(x=>x.id===id);if(!n)continue;const r=resOf(n);if(r.state==='open'&&run.active!==id){r.t+=e.tension[id];if(r.t>=100)stuck(n);}}
  if(e.walk){run.walkMul=e.walk;run.rainUntil=run.min+(e.dur||60);run.rainId=e.id;}
  toast(e.text,'event');
}
function stuck(n){
  const r=resOf(n);if(r.state!=='open')return;r.state='stuck';r.t=100;
  PL.monster(MON.id);
  toast(fill(MON.stuck||'{name}卡住了。',{name:n.nm}),'warn');
  checkResolved();
}
function checkResolved(){if(run.allDoneAt===null&&NPCS.every(n=>resOf(n).state==='saved'||resOf(n).state==='stuck')){run.allDoneAt=run.min;}}

// ================= 聳肩怪 =================
function monStep(){
  const m=run.mon;
  if(!m.path.length&&(m.linger<=0||!m.target||resOf(m.target).state!=='open')){
    const opens=openRes();
    m.target=opens.length?pick(opens):null;m.linger=25;
    const tgt=m.target,rt=pick(FLOOR);
    const goal=tgt?(x,y)=>Math.abs(x-tgt.x)+Math.abs(y-tgt.y)===1:(x,y)=>x===rt[0]&&y===rt[1];
    m.path=bfs(m.x,m.y,goal,(x,y)=>!walkable(x,y))||[];
  }
  if(m.path.length){const [nx,ny]=m.path.shift();m.x=nx;m.y=ny;}
}
function monFar(){const px=Math.round(player.x),py=Math.round(player.y);const far=FLOOR.filter(([x,y])=>Math.abs(x-px)+Math.abs(y-py)>=7);const t=pick(far.length?far:FLOOR);const m=run.mon;m.x=t[0];m.y=t[1];m.fx=t[0];m.fy=t[1];m.path=[];m.target=null;m.linger=0;}
function meetMonster(){if(PL.monster(MON.id))toast(MON.meet||'發現聳肩怪！','warn');}
function monTouch(){
  const m=run.mon;m.cool=6;run.st.monster++;meetMonster();
  run.energy-=MON.drain;run.st.minEnergy=Math.min(run.st.minEnergy,run.energy);
  toast(fill(MON.touch||'聳肩怪撞上你。體力 −{n}。',{n:MON.drain}),'warn');monFar();renderHud();
  if(run.energy<=0)forcedRest();
}
function tapMonster(){
  const m=run.mon;if(m.daze>0){toast('聳肩怪在角落發呆，先不用管牠。');return;}
  const now=performance.now();m.taps=m.taps.filter(t=>now-t<1600);m.taps.push(now);
  const need=hasRope()?MON.scareTapsRope:MON.scareTaps;meetMonster();
  if(m.taps.length>=need){m.taps=[];m.daze=MON.dazeMin;run.st.scares++;S.scares=(S.scares||0)+1;save();monFar();toast(MON.scared||'嚇跑了！');}
  else toast(`${hasRope()?'甩瑜伽繩！':'拍！'}再 ${need-m.taps.length} 下`);
}

// ================= 圖：小人 =================
let fig={cur:clone(P.stand),view:'side',bt:0,brick:false,shrug:0,cowT:1,rope:true};
function brickPose(p){const o=clone(p);o.h1=[p.h1[0],186];o.h2=[p.h2[0],186];o.e1=[p.e1[0],p.e1[1]-6];o.e2=[p.e2[0],p.e2[1]-6];return o;}
const BRICKSVG=`<rect x="46" y="186" width="40" height="13" rx="3" fill="#b48ad8" stroke="#2c2c2a" stroke-width="2"/><text x="40" y="196" text-anchor="end" font-size="11" font-weight="700" fill="#2c2c2a" font-family="Noto Sans TC,sans-serif">瑜伽磚</text>`;
function figMarkup(extra){
  const b=Math.sin(fig.bt)*1.6;
  if(fig.view==='back')return backSvgT(b+fig.shrug,fig.cowT,fig.rope,false,fig.cowT>=1)+(extra||'');
  let p=fig.brick?brickPose(fig.cur):fig.cur;
  if(fig.shrug){p=clone(p);for(const k of ['hd','sh','e1','e2','h1','h2'])p[k][1]-=fig.shrug*(k[0]==='h'&&k!=='hd'?.3:1);}
  return figSvg(p,b,{shrug:fig.shrug>2})+(fig.brick?BRICKSVG:'')+(extra||'');
}
function drawFig(extra){const el=$('fig');if(el)el.innerHTML=figMarkup(extra);}
function moveFig(name,ms=900){
  const from=clone(fig.cur),to=P[name]||P.stand;
  if(RM){fig.cur=clone(to);drawFig();return Promise.resolve();}
  return new Promise(res=>{const t0=performance.now();
    const step=now=>{const t=Math.min(1,(now-t0)/ms),e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
      fig.cur=lerpPose(from,to,e);drawFig();if(t<1)requestAnimationFrame(step);else res();};
    requestAnimationFrame(step);});
}

// ================= 貼紙：三明治食材 =================
const ING={tomato:'番茄片',lettuce:'生菜',cheese:'起司',egg:'煎蛋',bread:'吐司'};
function ingSvg(kind,cls){
  const o=`<svg class="${cls||''}" viewBox="0 0 64 64" aria-hidden="true">`;const ink='#2c2c2a';
  if(kind==='tomato')return o+`<circle cx="32" cy="32" r="26" fill="#d7263d" stroke="${ink}" stroke-width="3"/><circle cx="32" cy="32" r="18" fill="#f0606f"/><g fill="#ffe7a8">${[0,1,2,3,4,5].map(i=>{const a=i/6*6.283;return `<ellipse cx="${32+Math.cos(a)*10}" cy="${32+Math.sin(a)*10}" rx="3" ry="4.5" transform="rotate(${i*60} ${32+Math.cos(a)*10} ${32+Math.sin(a)*10})"/>`}).join('')}</g><circle cx="32" cy="32" r="4" fill="#d7263d"/></svg>`;
  if(kind==='lettuce')return o+`<path d="M10 36 C6 22 18 10 30 12 C40 6 56 14 54 28 C60 38 50 54 36 52 C24 58 8 50 10 36Z" fill="#7fa63d" stroke="${ink}" stroke-width="3"/><path d="M18 44 Q32 34 46 20" stroke="#cfe3a6" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M28 38 L22 30 M36 31 L32 22 M36 31 L44 32" stroke="#cfe3a6" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  if(kind==='cheese')return o+`<path d="M8 46 L56 46 L44 14 Z" fill="#ffc233" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><circle cx="30" cy="36" r="4" fill="#e9a800"/><circle cx="42" cy="28" r="3" fill="#e9a800"/><circle cx="20" cy="42" r="2.5" fill="#e9a800"/><path d="M8 46 L56 46 L56 52 L8 52 Z" fill="#f2b320" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/></svg>`;
  if(kind==='egg')return o+`<path d="M12 34 C8 18 26 8 38 14 C52 12 60 28 52 38 C54 52 32 58 22 50 C10 50 8 42 12 34Z" fill="#fff" stroke="${ink}" stroke-width="3"/><circle cx="33" cy="32" r="10" fill="#ffc233" stroke="${ink}" stroke-width="2.5"/><circle cx="30" cy="29" r="3" fill="#fff" opacity=".7"/></svg>`;
  if(kind==='bread')return o+`<path d="M10 52 L10 26 C4 24 4 12 16 10 C24 4 40 4 48 10 C60 12 60 24 54 26 L54 52 Z" fill="#e8b46a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M16 48 L16 26 C12 24 12 16 20 15 C26 10 38 10 44 15 C52 16 52 24 48 26 L48 48 Z" fill="#fbe6c2"/></svg>`;
  return '';
}
function ropeSvg(){return `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10" fill="none" stroke="#d7263d" stroke-width="4"/><circle cx="16" cy="16" r="5" fill="none" stroke="#d7263d" stroke-width="3"/><path d="M24 22 L30 30" stroke="#d7263d" stroke-width="4" stroke-linecap="round"/></svg>`;}
function brickSvg(){return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12 L21 8 L28 12 L28 22 L12 26 L5 22 Z" fill="#b48ad8" stroke="#2c2c2a" stroke-width="2" stroke-linejoin="round"/><path d="M5 12 L12 16 L28 12 M12 16 L12 26" stroke="#2c2c2a" stroke-width="2" fill="none"/></svg>`;}
function couponSvg(){return `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="8" width="26" height="16" rx="3" fill="#fff1cc" stroke="#2c2c2a" stroke-width="2"/><path d="M11 8 v16" stroke="#2c2c2a" stroke-width="2" stroke-dasharray="2 2"/><path d="M16 16 q3-5 6 0 q3 5 6 0" stroke="#d7263d" stroke-width="2" fill="none"/></svg>`;}
function sandwichSvg(has){
  let y=10,parts='';const ink='#2c2c2a';
  if(has('bread')){parts+=`<path d="M20 ${y+26} C20 ${y} 180 ${y} 180 ${y+26} Z" fill="#e8b46a" stroke="${ink}" stroke-width="3"/>`;y+=28;}
  if(has('lettuce')){parts+=`<path d="M14 ${y+4} q10 -8 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 L186 ${y+12} L14 ${y+12} Z" fill="#7fa63d" stroke="${ink}" stroke-width="3"/>`;y+=14;}
  if(has('tomato')){parts+=`<rect x="22" y="${y}" width="156" height="12" rx="6" fill="#d7263d" stroke="${ink}" stroke-width="3"/>`;y+=14;}
  if(has('cheese')){parts+=`<path d="M18 ${y} L182 ${y} L182 ${y+8} L150 ${y+8} L144 ${y+18} L138 ${y+8} L70 ${y+8} L64 ${y+16} L58 ${y+8} L18 ${y+8} Z" fill="#ffc233" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;y+=12;}
  if(has('egg')){parts+=`<ellipse cx="100" cy="${y+7}" rx="80" ry="8" fill="#fff" stroke="${ink}" stroke-width="3"/><ellipse cx="100" cy="${y+5}" rx="18" ry="5" fill="#ffc233"/>`;y+=16;}
  parts+=`<rect x="20" y="${y}" width="160" height="20" rx="8" fill="#e8b46a" stroke="${ink}" stroke-width="3"/>`;y+=24;
  return `<svg viewBox="0 0 200 ${y+4}" role="img" aria-label="三明治">${parts}</svg>`;
}
const albumHas=k=>NPCS.some(n=>n.sticker===k&&S.helped.includes(n.id));
const runHas=k=>NPCS.some(n=>n.sticker===k&&resOf(n).state==='saved');

// ================= 畫面 =================
function toast(t,kind){const el=$('toast');el.textContent=t;el.className='toast'+(kind?' '+kind:'');el.style.opacity=1;clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.opacity=0,4600);}
const AV={tomato:['#d7263d','番'],lettuce:['#7fa63d','生'],cheese:['#ffc233','起']};
function avOf(n){return n.kind==='person'?[n.color,n.nm.slice(-2,-1)]:AV[n.kind]||['#888780',n.nm[0]];}
const tCol=t=>t>=80?'#d7263d':t>=50?'#f0a020':'#7fa63d';
function renderHud(){
  $('clk').textContent=clockStr(Math.min(run.min,DAYLEN));
  $('dayBar').style.width=Math.min(100,run.min/DAYLEN*100)+'%';
  const e=Math.max(0,Math.round(run.energy));
  $('enBar').style.width=e+'%';$('enBar').style.background=e<R.energy.low?'#d7263d':e<60?'#f0a020':'#7fa63d';
  $('enNum').textContent=e;
  const b=G.bag.brick||0,need=BRICK.badgeAt||3;
  const bag=`<span class="slot ${hasRope()?'got':'off'}" title="瑜伽繩">${ropeSvg()}${hasRope()?'瑜伽繩':'瑜伽繩？'}</span>
   <span class="slot ${b?'got':'off'}" title="瑜伽磚">${brickSvg()}${b}/${need}</span>
   ${run.coupon&&run.coupon.have&&!run.coupon.used?`<span class="slot got" title="${Z.coupon.name}">${couponSvg()}按摩券</span>`:''}
   ${run.rainUntil>=0?'<span class="slot rain">下雨中</span>':''}`;
  if(renderHud.bag!==bag){renderHud.bag=bag;$('bagRow').innerHTML=bag;}
  const sv=NPCS.filter(n=>resOf(n).state==='saved').length,left=R.cardAt-sv;
  const goal=`<span class="pips">${Array.from({length:R.cardAt},(_,i)=>`<i class="${i<sv?'on':''}"></i>`).join('')}</span>${left>0?`再救 <b>${left}</b> 位，解鎖序列圖卡`:'今天解鎖序列圖卡了！再多救幾位'}`;
  if(renderHud.goal!==goal){renderHud.goal=goal;$('goal').innerHTML=goal;}
}
function renderUI(){
  const saved=NPCS.filter(n=>resOf(n).state==='saved').length,stuckN=NPCS.filter(n=>resOf(n).state==='stuck').length;
  $('count').textContent=`救回 ${saved}・卡住 ${stuckN}・共 ${NPCS.length}`;
  const pe=$('people');
  if(!pe.children.length){
    pe.innerHTML=NPCS.map(n=>{const [c,t]=avOf(n);return `<button class="who" data-id="${n.id}"><span class="av" style="background:${c}">${t}</span><span class="t"><b>${n.nm}</b><small></small><span class="tb"><i></i></span></span></button>`;}).join('');
    pe.querySelectorAll('.who').forEach(b=>b.onclick=()=>{const n=NPCS.find(p=>p.id===b.dataset.id);if(resOf(n).state==='away'){toast(`${n.nm}${n.fromStr}才會出現。`);return;}goTo({kind:'npc',n});});
  }
  for(const b of pe.children){const n=NPCS.find(p=>p.id===b.dataset.id);const r=resOf(n);const tt=Math.min(100,Math.round(r.t));
    const sub=r.state==='saved'?`救回了・${n.L.nm}`:r.state==='stuck'?`卡住了・${n.part}`:r.state==='away'?`${n.fromStr} 才會出現`:`緊繃 ${tt}${r.near&&run.mon.daze<=0?'・聳肩怪在旁邊':''}`;
    const cls='who '+r.state+(r.state==='open'&&tt>=80?' hot':'');if(b.className!==cls)b.className=cls;
    const sm=b.querySelector('small');if(sm.textContent!==sub)sm.textContent=sub;
    const i=b.querySelector('.tb i');i.style.width=(r.state==='open'?tt:0)+'%';i.style.background=tCol(tt);}
  const dots=NPCS.map(n=>`<span class="dot ${S.helped.includes(n.id)?'on':'off'}" title="${ING[n.sticker]}">${ingSvg(n.sticker)}</span>`).join('');
  if(renderUI.dots!==dots){renderUI.dots=dots;$('albumDots').innerHTML=dots;}
  renderHud();
}

// ================= 走路、互動 =================
function adjBld(b,x,y){for(let yy=b.y0;yy<=b.y1;yy++)for(let xx=b.x0;xx<=b.x1;xx++)if(adjTo(x,y,xx,yy))return true;return false;}
function isAdj(tg,x,y){if(tg.kind==='npc')return adjTo(x,y,tg.n.x,tg.n.y);if(tg.kind==='bld')return adjBld(BLD[tg.key],x,y);if(tg.kind==='tile')return x===tg.x&&y===tg.y;return false;}
function goTo(tg){
  if(sheetOpen||!run.started||run.over)return;
  const px=Math.round(player.x),py=Math.round(player.y);
  if(isAdj(tg,px,py)){player.path=[];interact(tg);return;}
  const p=bfs(px,py,(x,y)=>isAdj(tg,x,y));
  if(!p){toast('那裡走不過去。');return;}
  player.path=p;player.target=tg;
}
function productive(){run.st.pend=0;run.origin=[Math.round(player.x),Math.round(player.y)];}
function wasted(){run.st.wasted+=run.st.pend;run.st.pend=0;run.origin=[Math.round(player.x),Math.round(player.y)];}
function interact(tg){
  player.target=null;
  if(tg.kind==='tile')return;
  if(tg.kind==='bld'){
    const k=tg.key;
    if(ROPE&&k===ROPE.at&&!hasRope()){G.bag.rope=true;save();productive();renderUI();openSay({nm:ROPE.from,role:BINFO[k].name,kind:'person',color:'#7fa63d'},ROPE.line,[{l:'謝謝老闆',fn:closeSheet}]);return;}
    if(REST.fountain&&k===REST.fountain.key){openFountain();return;}
    if(REST.bench&&k===REST.bench.key){openBench();return;}
    wasted();toast(BINFO[k].line||BINFO[k].name);return;
  }
  const n=tg.n;
  if(n.id==='cheese'){openCheese();return;}
  if(n.id==='lettuce'){wasted();openSay(LETTUCE,fill(F.wait,{n:openRes().length}),[{l:'好',fn:closeSheet}]);return;}
  const r=resOf(n);
  if(r.state==='saved'){wasted();toast(`${n.nm}：「${n.thanks.slice(0,22)}…」看起來很放鬆。`);return;}
  if(r.state==='stuck'){wasted();openSay(n,`${n.mood.stuck||n.ask}<br><br><b>卡住的地方：${n.part}</b><br><small style="color:var(--stone)">今天救不回來了。這個部位，結尾會告訴你怎麼練。</small>`,[{l:'好',fn:closeSheet}],{stuck:true});return;}
  openNpc(n);
}
function pickTile(x,y){
  const k=x+','+y;
  if(BRICKS.some(([bx,by])=>bx===x&&by===y)&&!S.bricks.includes(k)){
    S.bricks.push(k);G.bag.brick=(G.bag.brick||0)+1;productive();
    const full=G.bag.brick>=(BRICK.badgeAt||3);if(full&&BRICK.badge&&PL.badge(BRICK.badge))run.newBadges.push(BRICK.badge);
    save();renderUI();
    toast(!full?`撿到瑜伽磚（${G.bag.brick}/${BRICK.badgeAt}）。磚會一直放在背包，下一區也用得到。`:`集滿 ${BRICK.badgeAt} 塊瑜伽磚！獲得「磚家」徽章。`);
  }
  const c=run.coupon;
  if(c&&!c.have&&c.at[0]===x&&c.at[1]===y){c.have=true;productive();renderHud();toast(Z.coupon.found||'撿到按摩券！');}
}

// ================= 對話框 =================
const $sheet=$('sheet'),$panel=$('panel');
function head(n,extra){const [c,t]=avOf(n);const r=run.res[n.id];
  const bar=r&&r.state==='open'?`<span class="tb big"><i style="width:${Math.min(100,Math.round(r.t))}%;background:${tCol(r.t)}"></i></span><small class="tn">緊繃 ${Math.min(100,Math.round(r.t))}</small>`:'';
  return `<div class="ph"><span class="av" style="background:${c}">${t}</span><div class="pw"><b>${n.nm}</b><small>${n.role||''}</small>${bar}</div>${extra||''}</div>`;}
function openSheet(html,opt){opt=opt||{};sheetOpen=true;sheetLive=!!opt.live;sheetKind=opt.kind||'';$sheet.hidden=false;$panel.innerHTML=html;$panel.scrollTop=0;const f=$panel.querySelector('button');f&&f.focus({preventScroll:true});}
function closeSheet(){
  sheetOpen=false;sheetLive=false;sheetKind='';$sheet.hidden=true;run.active=null;keyHandler=null;
  renderUI();
  if(run.started&&!run.over){
    if(run.energy<=0){forcedRest();return;}
    if(run.timeUp||run.allDoneAt!==null){setTimeout(()=>{if(!sheetOpen&&!run.over)endDay();},run.timeUp?200:900);}
  }
}
function openSay(n,text,btns,opt){
  opt=opt||{};
  openSheet(`${head(n)}<div class="pb"><p class="say">${text}</p><div class="row">${btns.map((b,i)=>`<button class="${i===0?'primary':'ghost'}" data-i="${i}">${b.l}</button>`).join('')}</div></div>`,opt);
  $panel.querySelectorAll('.row button').forEach(b=>b.onclick=()=>btns[+b.dataset.i].fn());
}
function moodLine(n){const r=resOf(n);return r.t>=60?(n.mood.tense||n.ask):(n.mood.calm||n.ask);}
function openNpc(n){
  const r=resOf(n);
  const ap=n.ap,talk=ap.talk||{label:'先聊聊',zone:.06,tension:-8},direct=ap.direct||{label:'直接教',zone:0,tension:0};
  const needRope=n.need==='rope'&&!hasRope();
  const lowE=run.energy<R.energy.low;
  const c=run.coupon,canCoupon=c&&c.have&&!c.used;
  let html=`${head(n)}<div class="pb"><p class="say">${r.tries?'「再來一次？好吧。」':''}${r.tries?'':moodLine(n)}</p>
   ${needRope?`<p class="note warn">${n.noitem||'這個動作要用到瑜伽繩。'}（沒有繩子，兩手會碰不到。）</p>`:''}
   ${lowE?`<p class="note warn">你的體力只剩 ${Math.round(run.energy)}，手也在抖，穩住會比較難。</p>`:''}
   ${canCoupon?`<button class="ghost" id="coupon">${couponSvg()}${Z.coupon.use||'用按摩券'}</button>`:''}
   <p class="lead" style="margin:0">怎麼開始？<small class="cost">教一次 ${r.tries?R.retryMin:R.lessonMin} 分鐘</small></p>
   <div class="row ap">
    <button class="primary" id="apTalk"><b>${talk.label||'先聊聊'}</b><small>+${R.talkMin||20} 分鐘</small></button>
    <button class="primary alt" id="apDirect"><b>${direct.label||'直接教'}</b><small>馬上開始</small></button>
   </div>
   <button class="link" id="later">等一下再來</button></div>`;
  openSheet(html,{live:true,kind:'npc'});
  run.active=n.id;
  $('later').onclick=()=>{wasted();closeSheet();};
  if(canCoupon)$('coupon').onclick=()=>{c.used=true;r.t=Math.max(0,r.t-(Z.coupon.amount||30));productive();toast(fill(Z.coupon.used,{name:n.nm}));renderHud();openNpc(n);};
  $('apTalk').onclick=()=>startLesson(n,'talk',talk);
  $('apDirect').onclick=()=>startLesson(n,'direct',direct);
}
function startLesson(n,kind,ap){
  const r=resOf(n);
  if(!r.picked){ // 第一次教這個人：記錄玩家怎麼選人
    r.picked=true;
    const st=run.st;st.picks++;st.order.push(n.id);
    const opens=openRes();const maxT=Math.max(...opens.map(x=>resOf(x).t));
    if(r.t>=maxT-3)st.hiPick++;
    const [ox,oy]=run.origin;const d=opens.map(x=>[x,distTo(ox,oy,x)]);const minD=Math.min(...d.map(a=>a[1]));
    if(d.find(a=>a[0]===n)[1]<=minD+1)st.nearPick++;
  }
  productive();
  run.st[kind]++;r.approach=kind;
  {const other=n.ap[kind==='talk'?'direct':'talk']||{};if((ap.zone||0)<(other.zone||0))run.st.badAp++;}
  if(kind==='talk')spend(R.talkMin||20);
  r.t=Math.max(0,r.t+(ap.tension||0));
  if(r.t>=100){run.active=null;stuck(n);closeSheet();return;}
  let zone=R.hold.zone+(ap.zone||0);
  const useBrick=n.bonus==='brick'&&(G.bag.brick||0)>0;
  if(useBrick)zone+=R.hold.brickZone;
  if(run.energy<R.energy.low)zone+=R.energy.lowZone;
  zone=Math.max(R.hold.minZone,zone);
  r.tries++;
  dragGame(n,{line:ap.line,zone,useBrick});
}

// ================= 小遊戲 1：拉到位 =================
function svgPt(svg,ev){const p=svg.createSVGPoint();p.x=ev.clientX;p.y=ev.clientY;const m=svg.getScreenCTM();return m?p.matrixTransform(m.inverse()):{x:0,y:0};}
function dragGame(n,o){
  const L=n.L,D=n.drag,cow=!!BACK[L.fig];
  const rope=hasRope();const maxT=cow&&!rope?.62:1;
  const jk=D.joint==='hand'?'h1':D.joint;
  const from=cow?null:(P[D.from]||P.stand),to=cow?null:(P[L.fig]||P.stand);
  const S0=cow?COW.hand0:from[jk],E=cow?COW.hand1:to[jk];
  const dx=E[0]-S0[0],dy=E[1]-S0[1],len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,LH=Math.max(len,80);
  const ring=[S0[0]+ux*LH,S0[1]+uy*LH];
  fig.view=cow?'back':'side';fig.brick=o.useBrick;fig.shrug=0;fig.rope=rope;fig.cowT=0;fig.cur=cow?clone(P.kneel):clone(from);
  openSheet(`${head(n)}<div class="bubble">${o.line||''}</div>
   <div class="figbox drag" id="fbox"><svg id="fig" viewBox="0 0 220 214" role="img" aria-label="${L.nm}：拉到位"></svg><span class="tag">1 拉到位</span></div>
   <div class="pb" id="lb"><div class="pname"><h2>${L.nm}</h2><span>${L.en}</span></div>
   <p class="lead" style="margin:0"><b>把黃色圓點拉到綠圈。</b>${D.label||L.intro}</p>
   <p class="hint">手指或滑鼠按住黃點往綠圈拉；鍵盤按住 ↑。放手會彈回去。</p></div>`,{kind:'drag'});
  run.active=n.id;
  let t=0,down=null,dragging=false,done=false,key=false,raf=0,last=performance.now();
  const svg=$('fig'),box=$('fbox');
  const render=()=>{
    if(cow){fig.cowT=t;}else fig.cur=lerpPose(from,to,t);
    const hx=S0[0]+ux*LH*t,hy=S0[1]+uy*LH*t,ok=t>=.92;
    const gap=cow&&!rope&&t>=maxT-.01?`<text x="112" y="72" text-anchor="middle" font-size="13" font-weight="900" fill="#d7263d" font-family="Noto Sans TC,sans-serif">碰不到！</text>`:'';
    drawFig(`<line x1="${S0[0]}" y1="${S0[1]}" x2="${ring[0]}" y2="${ring[1]}" stroke="#2c2c2a" stroke-width="2" stroke-dasharray="3 5" opacity=".35"/>
      <circle cx="${ring[0]}" cy="${ring[1]}" r="15" fill="${ok?'#7fa63d':'none'}" fill-opacity=".35" stroke="#7fa63d" stroke-width="4"/>
      <circle cx="${hx}" cy="${hy}" r="13" fill="#ffc233" stroke="#2c2c2a" stroke-width="3" class="handle"/>
      <circle cx="${hx}" cy="${hy}" r="24" fill="#ffc233" opacity="${dragging?.25:.12}"/>${gap}`);
  };
  const finish=()=>{if(done)return;done=true;cancelAnimationFrame(raf);keyHandler=null;key=false;
    if(cow&&!rope){noRope(n);return;}
    t=1;render();const lb=$('lb');if(lb)lb.innerHTML=`<p class="patmsg">到位！</p>`;
    setTimeout(()=>holdGame(n,o),RM?200:550);};
  const loop=now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(done)return;
    if(key){t=Math.min(maxT,t+dt*.9);}
    else if(!dragging&&t>0){if(t>=.92||(cow&&!rope&&t>=maxT-.01)){finish();return;}t=Math.max(0,t-dt*1.4);}
    if(key&&(t>=1||(cow&&!rope&&t>=maxT))){finish();return;}
    render();raf=requestAnimationFrame(loop);};
  box.addEventListener('pointerdown',ev=>{if(done)return;ev.preventDefault();try{box.setPointerCapture(ev.pointerId);}catch(_){}const p=svgPt(svg,ev);down={x:p.x,y:p.y,t};dragging=true;});
  box.addEventListener('pointermove',ev=>{if(!dragging||done)return;const p=svgPt(svg,ev);t=Math.max(0,Math.min(maxT,down.t+((p.x-down.x)*ux+(p.y-down.y)*uy)/LH));if(t>=1){dragging=false;finish();}});
  const up=()=>{if(!dragging)return;dragging=false;if(t>=.92||(cow&&!rope&&t>=maxT-.01))finish();};
  box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
  keyHandler=(e,isDown)=>{if(['ArrowUp','ArrowRight',' ','Enter'].includes(e.key)){e.preventDefault();key=isDown;}};
  render();raf=requestAnimationFrame(loop);
}
function noRope(n){
  const r=resOf(n);r.tries--;run.st.noRope++;
  run.energy-=4;spend(R.noRopeMin);
  const lb=$('lb');
  lb.innerHTML=`<p class="say">${n.noitem||'兩手碰不到。要用瑜伽繩。'}</p><p class="note">沒有繩子，兩隻手中間永遠差一截。白白花了 ${R.noRopeMin} 分鐘。</p><button class="primary" id="ok">好，去拿瑜伽繩</button>`;
  $('ok').onclick=()=>{wasted();closeSheet();};
}

// ================= 小遊戲 2：穩住 =================
// 呼吸：吸氣 inSec 秒（綠色往上，按住），吐氣 exSec 秒（綠色往下，放開）
function breathAt(T){const H_=R.hold,cyc=H_.inSec+H_.exSec,k=Math.floor(T/cyc),ph=T-k*cyc;
  if(ph<H_.inSec)return {b:(1-Math.cos(Math.PI*ph/H_.inSec))/2,inh:true,k};
  return {b:(1+Math.cos(Math.PI*(ph-H_.inSec)/H_.exSec))/2,inh:false,k};}
let holdSet=null;
function holdGame(n,o){
  const L=n.L,H_=R.hold;
  if(!BACK[L.fig]){fig.cur=clone(P[L.fig]||P.stand);fig.view='side';}else{fig.view='back';fig.cowT=1;fig.rope=true;}
  const box=$('fbox');box.classList.remove('drag');box.classList.add('hold');
  box.querySelector('.tag').textContent='2 穩住';
  box.insertAdjacentHTML('beforeend',`<div class="gauge" aria-hidden="true"><div class="band" id="band" style="bottom:${(H_.low-o.zone/2)*100}%;height:${o.zone*100}%"></div><div class="needle" id="needle"></div></div>
    <div class="breath"><div class="ring" id="ring"></div><span id="btxt"></span></div><div class="bigcue in" id="bigcue">吸氣：按住 ↑</div><div class="peek" id="peek" hidden>${monsterSvg('pk')}</div>`);
  drawFig();
  box.addEventListener('pointerdown',e=>{if(!holdSet)return;e.preventDefault();try{box.setPointerCapture(e.pointerId);}catch(_){}holdSet(true);});
  ['pointerup','pointercancel','lostpointercapture'].forEach(t=>box.addEventListener(t,()=>holdSet&&holdSet(false)));
  const go=isPractice=>runHold(n,o,isPractice,(frac,early)=>{
    if(isPractice){
      G.tut=G.tut||{};G.tut.hold=true;save();
      $('lb').innerHTML=`<p class="patmsg">${frac>=.5?'很好，就是這樣！':'抓到感覺了嗎？'}</p><p class="note" style="text-align:center">練習：指針在綠色裡 ${Math.round(frac*100)}%（不計分）。<br>正式的要穩住 ${H_.breaths} 個呼吸，一半以上在綠色裡就過關。</p><button class="primary" id="real">開始正式</button><button class="link" id="again2">再練一次</button>`;
      $('real').onclick=()=>go(false);$('again2').onclick=()=>go(true);return;}
    const grade=early?'fail':frac>=H_.perfect?'perfect':frac>=H_.pass?'pass':'fail';
    lessonResult(n,grade,frac,o);});
  if(!(G.tut&&G.tut.hold)){
    $('lb').innerHTML=`<span class="eyebrow">第一次？先試一次（不計分）</span>
     <ol class="how"><li><b>吸氣：按住</b>，指針往上，跟著綠色一起升。</li><li><b>吐氣：放開</b>，指針往下，跟著綠色一起降。</li><li>指針待在<b>綠色</b>裡就對了。圓圈變大是吸氣，變小是吐氣。</li></ol>
     <button class="primary" id="try">先試一次</button>`;
    $('try').onclick=()=>go(true);
  }else go(false);
}
function runHold(n,o,practice,onEnd){
  const L=n.L,H_=R.hold,breaths=practice?1:H_.breaths,dur=breaths*(H_.inSec+H_.exSec);
  $('lb').innerHTML=`<p class="lead" style="margin:0"><b>${practice?'練習 1 個呼吸':`穩住 ${breaths} 個呼吸`}。</b>跟著圓圈：吸氣按住，吐氣放開。</p>
   <button class="holdpad" id="hold"><span class="pt" id="pt" aria-hidden="true">按住這裡開始 ↓</span><b id="hcue">吸氣：按住</b><small id="hstat">按下去就開始</small></button>
   ${practice?'':`<div class="tip"><i>口令</i><p>${L.cue||L.tip}</p></div>`}`;
  const pad=$('hold'),band=$('band'),needle=$('needle'),ring=$('ring'),btxt=$('btxt'),peek=$('peek'),hstat=$('hstat'),hcue=$('hcue'),big=$('bigcue'),pt=$('pt');
  let holding=false,started=false,T=0,v=H_.low,vel=0,inT=0,outRun=0,done=false,last=performance.now(),raf=0;
  const ph1=Math.random()*6,ph2=Math.random()*6,wob=n.wobble*H_.wobble;
  const setHold=h=>{if(done)return;holding=h;pad.classList.toggle('on',h);if(h&&!started){started=true;last=performance.now();pt.hidden=true;}};
  holdSet=setHold;
  pad.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();try{pad.setPointerCapture(e.pointerId);}catch(_){}setHold(true);});
  ['pointerup','pointercancel','lostpointercapture'].forEach(t=>pad.addEventListener(t,()=>setHold(false)));
  pad.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter')e.preventDefault();});
  keyHandler=(e,isDown)=>{if([' ','Enter','ArrowUp'].includes(e.key)){e.preventDefault();setHold(isDown);}};
  let disp=v,c=H_.low;
  const paint=()=>{const br=breathAt(T),z=o.zone;c=H_.low+(H_.high-H_.low)*br.b;
    const w=started?wob*(Math.sin(T*1.3+ph1)+.6*Math.sin(T*2.9+ph2))/1.6:0;disp=Math.max(0,Math.min(1,v+w));
    band.style.bottom=((c-z/2)*100)+'%';band.style.height=(z*100)+'%';needle.style.bottom=(disp*100)+'%';
    const inZ=Math.abs(disp-c)<=z/2;needle.classList.toggle('out',!inZ);
    ring.style.transform=`scale(${.5+.5*br.b})`;
    const inh=!started||br.inh;
    big.textContent=inh?'吸氣：按住 ↑':'吐氣：放開 ↓';big.className='bigcue '+(inh?'in':'out');
    hcue.textContent=inh?'吸氣：按住':'吐氣：放開';pad.classList.toggle('exh',!inh);
    btxt.textContent=started?`${Math.min(breaths,br.k+1)}/${breaths}`:'';
    fig.shrug=inZ?0:8;peek.hidden=inZ||!started;fig.bt=RM?0:br.b*Math.PI/2;drawFig();
    return inZ;};
  const end=early=>{if(done)return;done=true;cancelAnimationFrame(raf);keyHandler=null;holdSet=null;onEnd(inT/dur,early);};
  const loop=now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(done)return;
    if(started){T+=dt;
      const tv=holding?H_.up:-H_.down;vel+=(tv-vel)*(1-Math.exp(-dt/.25));v+=vel*dt;if(v<0){v=0;vel=0;}if(v>1){v=1;vel=0;}
      const inZ=paint();
      if(inZ){inT+=dt;outRun=0;}else outRun+=dt;
      hstat.textContent=inZ?'很穩，繼續':disp>c?'太高了，放開一下':'太低了，按住一下';
      if(!practice&&outRun>H_.outMax){end(true);return;}
      if(T>=dur){end(false);return;}
    }else paint();
    raf=requestAnimationFrame(loop);};
  raf=requestAnimationFrame(loop);
}
function lessonResult(n,grade,frac,o){
  const r=resOf(n),st=run.st,E=R.energy;
  run.energy-=grade==='perfect'?E.perfect:grade==='pass'?E.pass:E.fail;st.minEnergy=Math.min(st.minEnergy,run.energy);
  spend(r.tries>1?R.retryMin:R.lessonMin);
  fig.shrug=0;drawFig();
  const lb=$('lb');const box=$('fbox');box&&box.querySelectorAll('.gauge,.breath,.peek,.bigcue').forEach(x=>x.remove());
  const pct=Math.round(frac*100);
  if(grade==='fail'){
    st.fails++;r.fails++;r.t+=R.failTension;
    const isStuck=r.t>=100;
    if(isStuck){run.active=null;stuck(n);}
    const canRetry=!isStuck&&!run.timeUp&&run.energy>0;
    lb.innerHTML=`<span class="grade fail">失敗</span><p class="say">${isStuck?`聳肩怪趁機跳到${n.nm}的肩膀上。${n.mood.stuck||''}`:`指針跑出綠色太久（穩住 ${pct}%）。${n.nm}的肩膀又往上爬了（緊繃 +${R.failTension}）。`}</p>
      <p class="note">體力 −${E.fail}${isStuck?`・卡住的地方：${n.part}`:''}</p>
      <div class="row">${canRetry?`<button class="primary" id="retry">再試一次（${R.retryMin} 分鐘）</button>`:''}<button class="${canRetry?'ghost':'primary'}" id="leave">${isStuck?'好，去幫別人':'先去幫別人'}</button></div>`;
    if(canRetry)$('retry').onclick=()=>{if(run.energy<=0){closeSheet();return;}const ap=(n.ap[r.approach]||{});startLesson2(n,ap);};
    $('leave').onclick=()=>closeSheet();
    return;
  }
  if(grade==='perfect')st.perfects++;else st.passes++;
  r.state='saved';r.t=0;r.grade=grade;run.active=null;checkResolved();
  if(o.useBrick){S.brickUsed=true;}
  if(!S.helped.includes(n.id))S.helped.push(n.id);save();
  lb.innerHTML=`<span class="grade ${grade}">${grade==='perfect'?'完美！':'過關'}</span><p class="note">穩住 ${pct}%・體力 −${grade==='perfect'?E.perfect:E.pass}</p><button class="primary" id="toQuiz">${n.nm}有問題要問你</button>`;
  $('toQuiz').onclick=()=>quiz(n);
}
// 重試：同樣的開場方式，不再算一次「先聊聊」
function startLesson2(n,ap){
  const r=resOf(n);
  let zone=R.hold.zone+(ap.zone||0);
  const useBrick=n.bonus==='brick'&&(G.bag.brick||0)>0;if(useBrick)zone+=R.hold.brickZone;
  if(run.energy<R.energy.low)zone+=R.energy.lowZone;
  zone=Math.max(R.hold.minZone,zone);r.tries++;
  dragGame(n,{line:'再來一次。慢慢來。',zone,useBrick});
}
function quiz(n){
  const L=n.L,lb=$('lb');
  const opts=n.quizRaw.opts.map((t,i)=>({t,ok:i===0}));
  for(let i=opts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]];}
  const ai=opts.findIndex(o=>o.ok);
  lb.innerHTML=`<span class="eyebrow">${n.nm}問你</span><h2 style="font-size:19px">${L.q}</h2>
    <div class="opts">${opts.map((o,i)=>`<button class="opt" data-i="${i}">${o.t}</button>`).join('')}</div><div id="after"></div>`;
  lb.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.i,ok=i===ai;
    if(ok)S.right++;else{run.st.wrong++;spend(R.wrongQuizMin);}
    S.quiz[n.id]=ok;save();
    lb.querySelectorAll('.opt').forEach((x,j)=>{x.disabled=true;if(j===ai)x.classList.add('right');else if(j===i)x.classList.add('wrong');});
    $('after').innerHTML=`<div class="fact"><b>${ok?'答對了！':`哈，是綠色那個。（想了一下，花了 ${R.wrongQuizMin} 分鐘）`}</b><p>${L.fact}</p><div class="tip"><i>小撇步</i><p>${L.tip}</p></div></div>
      <p class="say" style="margin-top:12px">${n.bonus&&S.brickUsed&&n.bonusThanks?n.bonusThanks:''}${n.thanks}</p>
      <button class="primary" id="nx" style="width:100%;margin-top:12px">拿到「${ING[n.sticker]}」貼紙，回到小鎮</button>`;
    $('nx').onclick=()=>{closeSheet();toast(`拿到「${ING[n.sticker]}」貼紙！`);const ab=$('albumBtn');ab.classList.remove('pop');void ab.offsetWidth;ab.classList.add('pop');};
  });
}

// ================= 休息 =================
function openFountain(){
  const f=REST.fountain;
  openSay({nm:BINFO[f.key].name,role:'回體力',kind:'person',color:'#3d8fb8'},`${f.line}<br><small style="color:var(--stone)">體力 ${Math.round(run.energy)}</small>`,
    [{l:f.btn||`喝水（體力 +${f.energy}）`,fn:()=>{run.energy=Math.min(100,run.energy+f.energy);run.st.rests++;productive();spend(f.min);closeSheet();toast(`咕嚕咕嚕。體力 +${f.energy}。`);}},{l:'不用',fn:()=>{wasted();closeSheet();}}],{live:true});
}
function openBench(forced){
  const b=REST.bench;const H_=R.hold;
  openSheet(`<div class="ph"><span class="av" style="background:#b9895a">椅</span><div class="pw"><b>${forced?'被迫休息':BINFO[b.key].name}</b><small>${forced?(REST.zero||''):'回體力'}</small></div></div>
   <div class="pb"><p class="say">${b.line}</p>
   <div class="benchring"><div class="ring big" id="bring"></div><span id="btxt">按住開始</span></div>
   <button class="holdpad" id="hold"><b>按住＝吸氣</b><small id="hstat">圓圈變大時按住，變小時放開</small></button>
   ${forced?'':'<button class="link" id="nob">算了，不休息</button>'}</div>`,{kind:'bench'});
  const pad=$('hold'),ring=$('bring'),btxt=$('btxt'),hstat=$('hstat');
  let holding=false,started=false,T=0,good=0,done=false,last=performance.now(),raf=0;const per=H_.inSec+H_.exSec,dur=per*2;
  const setHold=h=>{holding=h;pad.classList.toggle('on',h);if(h&&!started){started=true;last=performance.now();}};
  pad.addEventListener('pointerdown',e=>{e.preventDefault();try{pad.setPointerCapture(e.pointerId);}catch(_){}setHold(true);});
  pad.addEventListener('pointerup',()=>setHold(false));pad.addEventListener('pointercancel',()=>setHold(false));
  keyHandler=(e,isDown)=>{if([' ','Enter','ArrowUp'].includes(e.key)){e.preventDefault();setHold(isDown);}};
  if(!forced)$('nob').onclick=()=>{done=true;cancelAnimationFrame(raf);keyHandler=null;wasted();closeSheet();};
  const fin=()=>{done=true;cancelAnimationFrame(raf);keyHandler=null;
    const sc=good/dur;
    if(forced){run.energy=Math.max(run.energy,0)+R.energy.zeroRefill;spend(R.energy.zeroRestMin);}
    else{const g=Math.round(b.energyMin+(b.energyMax-b.energyMin)*Math.min(1,sc/0.85));run.energy=Math.min(100,run.energy+g);run.st.rests++;productive();spend(b.min);}
    run.energy=Math.min(100,run.energy);renderHud();
    $panel.querySelector('.pb').innerHTML=`<p class="patmsg">${sc>=.75?'呼吸好順。':'呼吸有點亂，但有休息到。'}</p><p class="note" style="text-align:center">體力回到 ${Math.round(run.energy)}・${forced?R.energy.zeroRestMin:b.min} 分鐘過去了</p><button class="primary" id="ok">回到小鎮</button>`;
    $('ok').onclick=closeSheet;};
  const loop=now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(done)return;
    if(started){T+=dt;const br=breathAt(T),inh=br.inh;const s=.5+.5*br.b;ring.style.transform=`scale(${s})`;
      btxt.textContent=`${inh?'吸氣：按住':'吐氣：放開'} ${Math.min(2,br.k+1)}/2`;
      if(holding===inh)good+=dt;hstat.textContent=holding===inh?'對，就是這樣':(inh?'吸氣，按住':'吐氣，放開');
      if(T>=dur){fin();return;}}
    raf=requestAnimationFrame(loop);};
  raf=requestAnimationFrame(loop);
}
function forcedRest(){
  if(run.over)return;
  run.st.zero++;player.path=[];player.target=null;
  toast(REST.zero||'你的體力用完了。','warn');
  openBench(true);
}

// ================= 起司先生 =================
function openCheese(){
  const c=run.cheese;const first=!S.cheese;c.caught=true;S.cheese=true;productive();
  if(SEC.badge&&PL.badge(SEC.badge))run.newBadges.push(SEC.badge);save();renderUI();
  openSay(CHEESE,first?SEC.line:SEC.again,[{l:first?'我不會說的':'好',fn:closeSheet}]);
}

// ================= 一天結束 =================
function endDay(){
  if(run.over)return;
  run.over=true;player.path=[];
  if(sheetOpen){sheetOpen=false;$sheet.hidden=true;}
  keyHandler=null;holdSet=null;
  const all=run.allDoneAt!==null&&!run.timeUp;
  fig.cur=clone(P.stand);fig.view='side';fig.brick=false;fig.shrug=0;
  openSheet(`${head(LETTUCE)}<div class="pb" style="padding-bottom:0"><p class="say">${all?'大家的事都處理完了，':`${R.dayEnd} 收工。`}${F.line}</p></div><div class="figbox"><svg id="fig" viewBox="0 0 220 214" role="img" aria-label="${F.title}"></svg><span class="tag">收尾</span></div><div class="pb" id="lb"></div>`,{kind:'hug'});
  drawFig();
  moveFig((POSES[F.pose]||{}).figure||'hug',900).then(()=>{
    $('lb').innerHTML=`<h2 style="font-size:21px">${F.title}</h2><p class="lead">${F.lead}</p><button class="pat" id="patBtn">拍拍</button><p class="patmsg" id="patMsg"></p>`;
    let k=0;const m=F.pats;
    $('patBtn').onclick=()=>{k++;$('patMsg').textContent=m[Math.min(k,m.length)-1];if(!RM){fig.bt+=1.6;drawFig();}if(k===m.length){$('patBtn').disabled=true;finishRun();setTimeout(ending,900);}};
  });
}
function styleOf(){
  const st=run.st,p=Math.max(1,st.picks),tot=st.talk+st.direct;
  const sc={
    tough:st.zero>=1?75+12*st.zero:(st.rests===0&&st.minEnergy<20?62:0),
    fire:st.picks>=2&&st.hiPick/p>=.6?50+st.hiPick/p*40:0,
    slow:tot>=2&&st.talk/tot>=.6?48+st.talk/tot*40:0,
    lost:st.wasted>=24||(st.walk>20&&st.wasted/st.walk>=.3)?45+Math.min(40,st.wasted/2):0,
    route:st.picks>=2&&st.nearPick/p>=.6?42+st.nearPick/p*36:0,
    rush:35
  };
  let best='rush';for(const k in sc)if(sc[k]>sc[best])best=k;
  return (Z.styles||[]).find(s=>s.id===best)||{id:best,name:best,obs:[],cost:'',habit:''};
}
// 稱號：titles[救回人數] 可以是一個字串，或一串隨機挑一個
function titleList(k){const T=Z.titles||[];const t=T[Math.max(0,Math.min(T.length-1,k))];return Array.isArray(t)?t:[t||''];}
const titleFor=k=>pick(titleList(k));
const bestTitle=()=>S.best?(S.best.title||titleList(S.best.saved)[0]):'';
const savedRun=()=>NPCS.filter(n=>resOf(n).state==='saved');
function finishRun(){
  const saved=savedRun(),stuckL=NPCS.filter(n=>resOf(n).state!=='saved');
  const st=run.st;st.wasted+=st.pend;st.pend=0;
  const endMin=Math.min(DAYLEN,run.allDoneAt!==null?run.allDoneAt:run.min);
  const sty=styleOf();run.style=sty;run.endMin=endMin;run.title=titleFor(saved.length);
  for(const n of saved)if(!S.helped.includes(n.id))S.helped.push(n.id);
  S.runs=(S.runs||0)+1;S.perfects=(S.perfects||0)+st.perfects;
  S.styles=S.styles||{};S.styles[sty.id]=(S.styles[sty.id]||0)+1;
  const b=S.best;
  if(!b||saved.length>b.saved||(saved.length===b.saved&&(b.min===null||endMin<b.min)))S.best={saved:saved.length,min:endMin,date:PL.today(),style:sty.id,title:run.title};
  S.last={saved:saved.map(n=>n.id),stuck:stuckL.map(n=>n.id),style:sty.id,min:endMin,date:PL.today(),title:run.title};
  if(saved.length>=R.cardAt&&!S.done){S.done=true;S.doneAt=PL.today();}
  G.title=bestTitle()||run.title;
  const give=id=>{if(BADGES[id]&&PL.badge(id))run.newBadges.push(id);};
  give('first-day');
  if(saved.length===NPCS.length)give('all-saved');
  if(saved.length>=3&&st.fails===0)give('no-fail');
  if(saved.length>=3&&st.zero===0)give('energy-master');
  if(saved.length===NPCS.length&&run.allDoneAt!==null&&run.allDoneAt<=hm(R.fastBefore)-DAY0)give('speedy');
  if(S.perfects>=5)give('perfect5');
  save();
}
// 沒解鎖圖卡時，依照這一天的狀況給兩個具體提示（文字在 zone 檔 tips）
function tipsFor(){
  const st=run.st,T=Z.tips||{},out=[];const p=st.picks;
  const post=NPCS.find(n=>n.need==='rope');
  const sc={
    rope:post&&resOf(post).state!=='saved'&&(st.noRope>0||!hasRope())?9:0,
    hold:st.fails>0?8+st.fails:0,
    energy:st.zero>0||st.minEnergy<15?7:0,
    hi:p===0||st.hiPick/p<.6?6:0,
    approach:st.badAp>0?5.5:0,
    monster:st.monster>=2&&st.scares===0?5:0,
    walk:st.wasted>=15?4:0,
  };
  const ids=Object.keys(sc).filter(k=>sc[k]>0&&T[k]).sort((a,b)=>sc[b]-sc[a]);
  for(const k of [...ids,'hi','hold','energy'])if(T[k]&&!out.includes(T[k])&&out.length<2)out.push(T[k]);
  return out;
}
const shortName=n=>/先生|小姐$/.test(n.nm)?n.nm.replace(/先生|小姐$/,''):n.nm.slice(-2);
function medalSvg(on){return `<svg class="medal" viewBox="0 0 40 40" aria-hidden="true"><path d="M13 3 L20 14 L27 3" fill="none" stroke="${on?'#d7263d':'#c9c3b8'}" stroke-width="5" stroke-linejoin="round"/><circle cx="20" cy="25" r="12" fill="${on?'#ffc233':'#e6e1d8'}" stroke="${on?'#2c2c2a':'#c9c3b8'}" stroke-width="3"/><path d="M20 18 l2 4.5 5 .5 -3.8 3.3 1.2 4.9 -4.4 -2.6 -4.4 2.6 1.2 -4.9 -3.8 -3.3 5 -.5z" fill="${on?'#fff':'#f3efe8'}"/></svg>`;}
function badgeCard(id,isNew){const got=G.badges.includes(id),b=BADGES[id]||[id,''];return `<div class="card bd ${got?'':'off'}">${medalSvg(got)}<b>${b[0]}</b><small>${b[1]}</small>${isNew?'<span class="new">新！</span>':''}</div>`;}
function igLink(){return IG?IG.url:'';}
function ending(){
  const st=run.st,saved=savedRun(),stuckL=NPCS.filter(n=>resOf(n).state!=='saved');
  const sty=run.style,title=run.title;
  const V={saved:saved.length,stuck:stuckL.length,hiPick:st.hiPick,nearPick:st.nearPick,picks:st.picks,talk:st.talk,direct:st.direct,rests:st.rests,zero:st.zero,zeroMin:st.zero*R.energy.zeroRestMin,
    fails:st.fails,perfects:st.perfects,walk:st.walk,wasted:st.wasted,monster:st.monster,scares:st.scares,minEnergy:Math.max(0,Math.round(st.minEnergy)),end:clockStr(run.endMin)};
  const NW=Z.nextWeek;const card=saved.length>=R.cardAt;const need=R.cardAt-saved.length;
  const cta=card&&Z.cta&&Z.cta.url?Z.cta:null;
  const ig=!cta&&IG;
  const best=S.best;const cheer=(Z.cheer||[])[Math.min((Z.cheer||[]).length-1,saved.length)]||'';
  const pl=[...new Set(stuckL.map(n=>n.part))];const parts=pl.slice(0,2).join('、')+(pl.length>2?'……':'');
  const nb=run.newBadges;
  openSheet(`<div class="pb end">
   <span class="eyebrow">${zoneName}・${Z.title}・${clockStr(run.endMin)} 收工</span>
   <h2 class="big">救回 ${saved.length} / ${NPCS.length} 位</h2>
   <div class="ttl"><small>今天的稱號</small><b>${title}</b>${best&&best.saved>saved.length?`<small>最佳紀錄：救回 ${best.saved} 位</small>`:''}</div>
   ${cheer?`<p class="say">${cheer}</p>`:''}
   ${saved.length?`<div class="sandwich">${sandwichSvg(runHas)}</div>`:''}
   ${nb.length?`<div class="newb"><b class="nbh">${fill(Z.badgeCheer||'拿到新徽章！',{n:nb.length})}</b><div class="cards3">${nb.map(id=>badgeCard(id,true)).join('')}</div><small>徽章 ${G.badges.filter(id=>BADGES[id]).length} / ${Object.keys(BADGES).length}・都收在貼紙簿裡</small></div>`:''}
   ${card?`<div class="pass">${cta?`<small>通關密語</small><b>${Z.passcode}</b><small>把通關密語傳給我們，領這一區的序列圖卡。</small><a class="primary" href="${cta.url}" target="_blank" rel="noopener">${cta.label}</a>`:`<small>序列圖卡解鎖了</small><b style="font-size:20px">${Z.card.title}</b>`}<a class="cardlink" href="/cards/${Z.id}" target="_blank" rel="noopener">看序列圖卡 →</a></div>`
     :`<div class="lock"><b>差 ${need} 位就能拿到序列圖卡</b><small>${fill(Z.cardLocked||'',{n:R.cardAt})}</small><ul>${tipsFor().map(t=>`<li>${t}</li>`).join('')}</ul></div>`}
   ${stuckL.length?`<div class="stuckL"><b>沒救回來的</b>${stuckL.map(n=>`<div class="sk">${monsterSvg('mi')}<span><b>${n.nm}${resOf(n).state==='stuck'?'':'<small class="nr">（收工前沒輪到）</small>'}</b><small>卡在：${n.part}</small></span></div>`).join('')}</div>`:''}
   <div class="style"><small>你今天的教學風格</small><h3>${sty.name}</h3>
    <ul>${(sty.obs||[]).map(o=>`<li>${fill(o,V)}</li>`).join('')}</ul>
    <p class="cost2">${fill(sty.cost,V)}</p>
    <div class="tip"><i>小習慣</i><p>${fill(sty.habit,V)}</p></div></div>
   ${NW?`<div class="nw"><small>${stuckL.length?fill(NW.lead,{parts}):NW.leadAll}</small><h3>${NW.title}<span>${NW.part}</span></h3><p>${NW.text}</p>
     ${ig?`<a class="primary igbtn" id="igbtn" href="${igLink()}" target="_blank" rel="noopener">追蹤 @${IG.handle}，跟著練</a><div class="qr" id="qr" hidden><div id="qrc"></div><small>手機掃這裡，追蹤 @${IG.handle}</small></div>`:''}</div>`:''}
   ${!NW&&ig?`<a class="primary igbtn" id="igbtn" href="${igLink()}" target="_blank" rel="noopener">追蹤 @${IG.handle}，跟著練</a>`:''}
   <div class="sec2">
    <button class="ghost sm" id="story">${IG?`存成限動圖，分享並標記 @${IG.handle}`:'存成限動圖分享'}</button>
    <button class="ghost sm" id="share">複製結果文字</button>
   </div>
   <div class="copied" id="copied" aria-live="polite"></div>
   ${run.cheese&&run.cheese.caught&&SEC.teaser?`<p class="say">${SEC.teaser}</p>`:''}
   <div class="row"><button class="${cta||ig?'ghost':'primary'}" id="again">再玩一天</button><button class="ghost" id="book">看貼紙簿</button></div>
   <p class="disc">好玩為主，這不是治療；身體有傷痛，請先詢問醫師。</p></div>`,{kind:'end'});
  $('again').onclick=()=>{const low=saved.length<=1;newRun();if(low&&BADGES.comeback&&PL.badge('comeback'))run.newBadges.push('comeback');sheetOpen=false;$sheet.hidden=true;renderUI();goals();};
  $('book').onclick=()=>album(ending);
  const shareText=()=>`我在「三明治鎮」當了一天瑜伽老師，救回 ${saved.length}/${NPCS.length} 位居民，稱號是「${title}」，教學風格「${sty.name}」！\n${stuckL.length?`沒救回來的卡在：${parts}。\n`:''}換你來當瑜伽老師 👉 ${GAME_URL}${IG?`\n@${IG.handle}`:''}\n#PDPL排都排了排好序列一起練 #sandywichyoga`;
  $('share').onclick=async()=>{
    const t=shareText(),out=$('copied');
    try{await navigator.clipboard.writeText(t);out.textContent='已複製，可以貼到限動或傳給朋友。';}
    catch(_){out.innerHTML='';const ta=document.createElement('textarea');ta.value=t;ta.rows=4;ta.style.width='100%';out.appendChild(ta);ta.select();}
  };
  $('story').onclick=async()=>{
    const out=$('copied');out.textContent='做圖中…';
    try{
      const blob=await storyPng({saved:saved.length,title,style:sty.name});
      const file=new File([blob],'sandywich-town.png',{type:'image/png'});
      const phone=(()=>{try{return matchMedia('(pointer:coarse)').matches}catch(_){return false}})();
      const tip=IG?`<b>發限動小步驟</b><ol style="margin:4px 0 0;padding-left:20px;text-align:left"><li>${phone?'在分享選單選 <b>Instagram</b> → <b>限時動態</b>':'把圖片傳到手機，打開 IG 發 <b>限時動態</b>'}</li><li>加一個「提及」貼紙，打 <b>@${IG.handle}</b></li><li>發出去！我會去看你的戰績😂</li></ol>`:'';
      if(phone&&navigator.canShare&&navigator.canShare({files:[file]})){
        try{await navigator.share({files:[file]});out.innerHTML=tip||'分享好了！';return;}catch(e){if(e&&e.name==='AbortError'){out.innerHTML=tip;return;}}
      }
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='sandywich-town.png';document.body.appendChild(a);a.click();a.remove();
      out.innerHTML=(phone?'圖片存好了，在相簿裡。':'圖片已經下載到電腦了。')+(tip?'<br>'+tip:'');
    }catch(e){console.warn(e);out.textContent='做圖失敗了，改用「複製結果文字」吧。';}
  };
  if(ig)showQR(igLink());
}
// 寬螢幕（電腦）多放一個 QR code，手機掃了直接開 IG
function showQR(url){
  if(!url||!window.matchMedia||!matchMedia('(min-width:700px)').matches)return;
  const draw=()=>{const box=$('qr'),el=$('qrc');if(!box||!el||!window.QRCode)return;el.innerHTML='';
    try{new QRCode(el,{text:url,width:132,height:132,colorDark:'#2c2c2a',colorLight:'#ffffff'});box.hidden=false;}catch(_){box.hidden=true;}};
  if(window.QRCode){draw();return;}
  if(showQR.loading)return;showQR.loading=true;
  const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';s.async=true;
  s.onload=()=>{showQR.loading=false;draw();};s.onerror=()=>{showQR.loading=false;};document.head.appendChild(s);
}
// 限動圖 1080×1920
async function storyPng(d){
  const c=document.createElement('canvas');c.width=1080;c.height=1920;const g=c.getContext('2d');
  try{if(document.fonts&&document.fonts.ready)await document.fonts.ready;}catch(_){}
  const ZH='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  g.fillStyle='#efeae3';g.fillRect(0,0,1080,1920);
  const strip=(y,h)=>{[[0,.32,'#ffc233'],[.32,.57,'#d7263d'],[.57,.8,'#2c2c2a'],[.8,1,'#7fa63d']].forEach(([a,b,col])=>{g.fillStyle=col;g.fillRect(a*1080,y,(b-a)*1080+1,h);});};
  strip(0,40);strip(1880,40);
  const round=(x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
  g.textAlign='center';g.textBaseline='alphabetic';g.fillStyle='#2c2c2a';
  g.font=`900 120px ${ZH}`;g.fillText('三明治鎮',540,250);
  g.font=`600 40px Poppins,${ZH}`;g.fillStyle='#888780';g.fillText(`SANDYWICH YOGA ・ ${zoneName} ${Z.title}`,540,320);
  round(90,400,900,1060,48);g.fillStyle='#fff';g.fill();g.lineWidth=8;g.strokeStyle='#2c2c2a';g.stroke();
  // 三明治
  const svg=(d.saved?sandwichSvg(runHas):monsterSvg('')).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');
  try{const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);});
    const w=d.saved?600:340,h=d.saved?(w*img.height/img.width||300):340;g.drawImage(img,540-w/2,470+Math.max(0,(380-h)/2),w,Math.min(h,380));}catch(_){}
  if(!d.saved){g.font=`700 44px ${ZH}`;g.fillStyle='#888780';g.fillText('今天聳肩怪贏了一局',540,880);}
  g.fillStyle='#2c2c2a';g.font=`900 130px ${ZH}`;g.fillText(`救回 ${d.saved} / ${NPCS.length} 位`,540,d.saved?1010:1030);
  g.font=`500 46px ${ZH}`;g.fillStyle='#888780';g.fillText('今天的稱號',540,1110);
  g.font=`900 72px ${ZH}`;g.fillStyle='#2c2c2a';g.fillText(d.title,540,1200);
  g.font=`500 46px ${ZH}`;g.fillStyle='#888780';g.fillText('教學風格',540,1300);
  g.font=`900 68px ${ZH}`;g.fillStyle='#d7263d';g.fillText(d.style,540,1385);
  // 底部：左邊 QR（掃了打開 IG），右邊邀請文字
  let qrOk=false;
  if(IG){try{const qi=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=(SITE.ig&&SITE.ig.qr)||'/assets/qr-ig.png';});
    round(100,1500,320,320,28);g.fillStyle='#fff';g.fill();g.lineWidth=6;g.strokeStyle='#2c2c2a';g.stroke();g.drawImage(qi,115,1515,290,290);qrOk=true;}catch(_){}}
  const cx=qrOk?710:540;g.textAlign='center';
  g.fillStyle='#2c2c2a';g.font=`900 ${qrOk?64:76}px ${ZH}`;
  if(qrOk){g.fillText('來三明治鎮',cx,1570);g.fillText('當瑜伽老師',cx,1650);}else g.fillText('來三明治鎮當瑜伽老師',cx,1600);
  g.font=`600 ${qrOk?34:48}px Poppins,${ZH}`;g.fillText((location.host||'')+'/town',cx,qrOk?1715:1690);
  if(IG){const pw=qrOk?460:480;round(cx-pw/2,1745,pw,84,42);g.fillStyle='#ffc233';g.fill();g.fillStyle='#2c2c2a';g.font=`700 44px Poppins,${ZH}`;g.fillText('@'+IG.handle,cx,1803);
    if(qrOk){g.font=`700 30px ${ZH}`;g.fillStyle='#888780';g.fillText('掃我追蹤 IG',260,1862);}}
  return await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('toBlob')),'image/png'));
}

// ================= 今天的任務（開場） =================
function goals(){
  const nb=G.badges.filter(id=>BADGES[id]).length,NB=Object.keys(BADGES).length,mGot=G.monsters.includes(MON.id)?1:0;
  const cardOn=S.done;const playing=run.started&&!run.over;
  const dots=NPCS.map(n=>`<span class="mini ${S.helped.includes(n.id)?'on':''}">${ingSvg(n.sticker)}</span>`).join('');
  openSheet(`<div class="pb goals"><span class="eyebrow">${zoneName}・${Z.title}</span><h2 class="h2">今天的任務</h2>
   ${run.newBadges.includes('comeback')?`<div class="newb"><b class="nbh">新徽章：${BADGES.comeback[0]}</b><small>${BADGES.comeback[1]}。今天一定救得回來！</small></div>`:''}
   <ol class="glist">
    <li><span class="gi">${ingSvg('bread')}</span><div><b>救回居民 → 拿貼紙，疊成三明治</b><span class="minis">${dots}</span></div><em>${S.helped.length}/${NPCS.length}</em></li>
    <li><span class="gi">${poseSvg('dog')}</span><div><b>一天救回 ${R.cardAt} 位 → 解鎖序列圖卡</b><small>${cardOn?'已經解鎖了，可以再挑戰更多人':Z.card.title}</small></div><em class="${cardOn?'ok':''}">${cardOn?'✓':'🔒'}</em></li>
    <li><span class="gi">${medalSvg(nb>0)}</span><div><b>收集徽章</b><small>第一天上工就有一個</small></div><em>${nb}/${NB}</em></li>
    <li><span class="gi">${monsterSvg('',false)}</span><div><b>怪物圖鑑</b><small>${mGot?MON.name+'：'+fill(MON.hintBubble||'連點 {n} 下嚇跑牠！',{n:MON.scareTaps}):'在鎮上遇到牠就會收進來'}</small></div><em>${mGot}/1</em></li>
    <li><span class="gi">${medalSvg(!!S.best)}</span><div><b>稱號</b><small>${S.best?`最佳：${bestTitle()}（救回 ${S.best.saved} 位）`:'收工時依照救回幾位決定'}</small></div><em></em></li>
   </ol>
   <div class="howto"><b>怎麼玩</b><ul>
    <li>頭上的<b>紅色長條</b>是緊繃值，滿了聳肩怪就會趴上去。先救最紅的。</li>
    <li>教一次：<b>拉到位</b>，再跟著呼吸<b>按住、放開</b>。</li>
    <li><b>體力</b>低了去噴水池喝水。聳肩怪靠近就<b>連點牠</b>。</li></ul></div>
   <button class="primary big" id="go">${playing?'回到小鎮':'開始上工'}</button>
   <button class="ghost" id="toAlbum">看貼紙簿</button></div>`,{kind:'goals'});
  $('go').onclick=()=>{sheetOpen=false;$sheet.hidden=true;if(!playing){run.started=true;toast('上班囉！先救誰？');}renderUI();};
  $('toAlbum').onclick=()=>album(goals);
}
const intro=goals;

// ================= 貼紙簿・圖鑑 =================
function album(back){
  const mGot=G.monsters.includes(MON.id);const b=S.best;const last=S.last;
  const nb=G.badges.filter(id=>BADGES[id]).length,NB=Object.keys(BADGES).length;
  const need=hasRope()?MON.scareTapsRope:MON.scareTaps;
  openSheet(`<div class="pb alb"><span class="eyebrow">貼紙簿・${zoneName} ${Z.title}</span>
   <section><h3 class="sec">稱號</h3><div class="cards2">
     <div class="card"><small>目前</small><b>${last&&last.title?last.title:(b?bestTitle():'還沒有')}</b><small>${last?`上次救回 ${last.saved.length} 位`:'玩完一天就會有'}</small></div>
     <div class="card"><small>最佳</small><b>${b?bestTitle():'還沒有'}</b><small>${b?`救回 ${b.saved} 位・玩了 ${S.runs||0} 天`:'—'}</small></div></div></section>
   <section><h3 class="sec">貼紙 <span class="cnt">${S.helped.length}/${NPCS.length}</span></h3>
     <div class="sandwich sm">${sandwichSvg(albumHas)}</div>
     <div class="cards5">${NPCS.map(n=>{const on=S.helped.includes(n.id);return `<div class="card st ${on?'':'off'}">${ingSvg(n.sticker,'ic')}<b>${ING[n.sticker]}</b><small>${on?n.L.nm:'救回'+shortName(n)}</small></div>`;}).join('')}</div>
     <p class="cap">救回居民拿貼紙，五張疊成一個三明治。</p></section>
   <section><h3 class="sec">徽章 <span class="cnt">${nb}/${NB}</span></h3><div class="cards3">${Object.keys(BADGES).map(id=>badgeCard(id,false)).join('')}</div></section>
   <section><h3 class="sec">怪物圖鑑 <span class="cnt">${mGot?1:0}/1</span></h3>
     <div class="card mon ${mGot?'':'off'}">${monsterSvg('mbig')}<div>${mGot?`<b>${MON.name}</b><small>${MON.about}</small><small><em>怎麼嚇跑：</em>${MON.how||''}</small><small><em>牠失手的時候：</em>${MON.weakTime}</small><small><em>你嚇跑牠：</em>${S.scares||0} 次</small>`:`<b>？？？</b><small>在鎮上遇到牠，就會收進圖鑑。</small>`}</div></div></section>
   <section><h3 class="sec">背包</h3><div class="chips"><span class="${hasRope()?'on':''}">瑜伽繩 ${hasRope()?'✓':'還沒拿'}</span><span class="${G.bag.brick?'on':''}">瑜伽磚 ${G.bag.brick||0}/${BRICK.badgeAt||3}</span></div><p class="cap">背包裡的東西會跟你到下一區。</p></section>
   <div class="row">${!back&&run.started&&!run.over?'<button class="ghost" id="toGoals">今天的任務</button>':''}<button class="primary" id="close">${back===goals?'回去':back?'回到結果':'回到小鎮'}</button></div></div>`,{kind:'album'});
  $('close').onclick=()=>{if(back){back();return;}closeSheet();if(!run.started)goals();};
  if($('toGoals'))$('toGoals').onclick=()=>goals();
}
$('albumBtn').onclick=()=>{if(!sheetOpen)album();else if(sheetKind==='goals')album(goals);};

// ================= 畫地圖 =================
const cv=$('cv'),ctx=cv.getContext('2d');let ts=24,cw=360,pulse=0;
function resize(){cw=$('stageMap').clientWidth||360;ts=cw/W;const d=window.devicePixelRatio||1;cv.width=Math.round(cw*d);cv.height=Math.round(cw*H/W*d);cv.style.height=(cw*H/W)+'px';ctx.setTransform(d,0,0,d,0,0);}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
const wob=k=>RM?0:k;
function draw(dt){
  pulse+=dt;
  ctx.fillStyle='#dfe8cf';ctx.fillRect(0,0,cw,cw*H/W);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const c=grid[y][x];
    if((x+y)%2===0&&c==='.'){ctx.fillStyle='#d6e2c2';ctx.fillRect(x*ts,y*ts,ts,ts);}
    if(c==='='){ctx.fillStyle='#f3ede4';ctx.fillRect(x*ts,y*ts,ts+.5,ts+.5);}
  }
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(grid[y][x]==='#'){const cx=(x+.5)*ts,cy=(y+.5)*ts;ctx.fillStyle='#5f8229';ctx.beginPath();ctx.arc(cx,cy+ts*.08,ts*.46,0,7);ctx.fill();ctx.fillStyle='#7fa63d';ctx.beginPath();ctx.arc(cx-ts*.06,cy-ts*.04,ts*.36,0,7);ctx.fill();}
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const k in BLD){const b=BLD[k],info=BINFO[k];const x=b.x0*ts+2,y=b.y0*ts+2,w=(b.x1-b.x0+1)*ts-4,h=(b.y1-b.y0+1)*ts-4;
    if(info.fountain){ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,7);ctx.fill();ctx.strokeStyle='#888780';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#bfe0ec';ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2-6,h/2-6,0,0,7);ctx.fill();
      ctx.fillStyle='#2c2c2a';ctx.font=`700 ${Math.max(10,ts*.42)}px "Noto Sans TC",sans-serif`;ctx.fillText(info.name,x+w/2,y+h/2);
      if(REST.fountain&&k===REST.fountain.key)bubble(b.x0+(b.x1-b.x0+1)/2,b.y0,'#3d8fb8','水');continue;}
    rr(x,y,w,h,6);ctx.fillStyle=info.bg||'#888780';ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='#2c2c2a';ctx.stroke();
    if(h>ts){ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(x+4,y+4,w-8,h*.28);}
    ctx.fillStyle=info.fg||'#fff';const fs=Math.max(9,Math.min(ts*.5,w/info.name.length*.85));ctx.font=`900 ${fs}px "Noto Sans TC",sans-serif`;ctx.fillText(info.name,x+w/2,y+h*(h>ts?.6:.52));
    if(ROPE&&k===ROPE.at&&!hasRope())bubble(b.x0+(b.x1-b.x0+1)/2,b.y0,'#ffc233','繩');
  }
  for(const [bx,by] of BRICKS){if(S.bricks.includes(bx+','+by))continue;const cx=(bx+.5)*ts,cy=(by+.5)*ts+wob(Math.sin(pulse*3)*1.5);ctx.fillStyle='#b48ad8';rr(cx-ts*.28,cy-ts*.18,ts*.56,ts*.36,4);ctx.fill();ctx.strokeStyle='#2c2c2a';ctx.lineWidth=1.5;ctx.stroke();}
  const c=run.coupon;
  if(c&&!c.have&&Math.abs(player.x-c.at[0])+Math.abs(player.y-c.at[1])<=3){const cx=(c.at[0]+.5)*ts,cy=(c.at[1]+.5)*ts;ctx.globalAlpha=.6+.4*Math.sin(pulse*5);ctx.fillStyle='#fff1cc';rr(cx-ts*.3,cy-ts*.2,ts*.6,ts*.4,3);ctx.fill();ctx.strokeStyle='#d7263d';ctx.lineWidth=1.5;ctx.stroke();ctx.globalAlpha=1;}
  for(const n of allPeople())drawNpc(n);
  drawMonster(dt);
  drawPlayer();
  // 天色：下午慢慢變橘，下雨變灰藍
  const late=Math.max(0,(run.min-DAYLEN*.6)/(DAYLEN*.4));if(late>0){ctx.fillStyle=`rgba(255,150,60,${.16*late})`;ctx.fillRect(0,0,cw,cw*H/W);}
  if(run.rainUntil>=0){ctx.fillStyle='rgba(80,110,150,.14)';ctx.fillRect(0,0,cw,cw*H/W);ctx.strokeStyle='rgba(60,100,160,.35)';ctx.lineWidth=1.5;ctx.beginPath();
    for(let i=0;i<40;i++){const x=((i*53+pulse*(RM?0:120))%cw),y=((i*97+pulse*(RM?0:300))%(cw*H/W));ctx.moveTo(x,y);ctx.lineTo(x-4,y+10);}ctx.stroke();}
}
function face(cx,cy,r,mood){
  ctx.fillStyle='#2c2c2a';const ey=cy-r*.12;
  if(mood==='angry'){ctx.lineWidth=2;ctx.strokeStyle='#2c2c2a';ctx.beginPath();ctx.moveTo(cx-r*.55,ey-r*.32);ctx.lineTo(cx-r*.15,ey-r*.15);ctx.moveTo(cx+r*.55,ey-r*.32);ctx.lineTo(cx+r*.15,ey-r*.15);ctx.stroke();}
  ctx.beginPath();ctx.arc(cx-r*.32,ey,Math.max(1.5,r*.11),0,7);ctx.arc(cx+r*.32,ey,Math.max(1.5,r*.11),0,7);ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle='#2c2c2a';ctx.beginPath();
  if(mood==='happy')ctx.arc(cx,cy+r*.12,r*.3,.15*Math.PI,.85*Math.PI);
  else if(mood==='sad'||mood==='angry'){ctx.arc(cx,cy+r*.5,r*.25,1.15*Math.PI,1.85*Math.PI);}
  else{ctx.moveTo(cx-r*.2,cy+r*.3);ctx.lineTo(cx+r*.2,cy+r*.3);}
  ctx.stroke();
}
function monBlob(cx,cy,r,sleepy,alpha){
  ctx.globalAlpha=alpha||1;
  ctx.fillStyle='#6d6a8a';ctx.strokeStyle='#2c2c2a';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cx-r,cy+r*.7);ctx.bezierCurveTo(cx-r*1.1,cy-r*.4,cx-r*.5,cy-r,cx,cy-r);ctx.bezierCurveTo(cx+r*.5,cy-r,cx+r*1.1,cy-r*.4,cx+r,cy+r*.7);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.lineWidth=Math.max(2,r*.18);ctx.beginPath();ctx.moveTo(cx-r*.7,cy-r*.3);ctx.lineTo(cx-r*1.15,cy-r*1.05);ctx.moveTo(cx+r*.7,cy-r*.3);ctx.lineTo(cx+r*1.15,cy-r*1.05);ctx.stroke();
  if(sleepy){ctx.strokeStyle='#ffc233';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx-r*.5,cy-r*.1);ctx.lineTo(cx-r*.15,cy-r*.1);ctx.moveTo(cx+r*.15,cy-r*.1);ctx.lineTo(cx+r*.5,cy-r*.1);ctx.stroke();}
  else{ctx.fillStyle='#ffc233';ctx.beginPath();ctx.arc(cx-r*.32,cy-r*.15,r*.2,0,7);ctx.arc(cx+r*.32,cy-r*.15,r*.2,0,7);ctx.fill();ctx.fillStyle='#2c2c2a';ctx.beginPath();ctx.arc(cx-r*.3,cy-r*.12,r*.08,0,7);ctx.arc(cx+r*.34,cy-r*.12,r*.08,0,7);ctx.fill();}
  ctx.globalAlpha=1;
}
function drawMonster(dt){
  const m=run.mon;const k=Math.min(1,dt*8);m.fx+=(m.x-m.fx)*k;m.fy+=(m.y-m.fy)*k;
  const cx=(m.fx+.5)*ts,cy=(m.fy+.5)*ts+wob(Math.sin(pulse*5)*1.5);
  if(m.daze<=0){ctx.fillStyle='rgba(109,106,138,.13)';ctx.beginPath();ctx.arc(cx,cy,ts*(R.monsterNear+.5),0,7);ctx.fill();}
  monBlob(cx,cy,ts*.38,m.daze>0,m.daze>0?.6:1);
  if(m.daze>0){ctx.fillStyle='#2c2c2a';ctx.font=`900 ${ts*.32}px Poppins,sans-serif`;ctx.fillText('z',cx+ts*.42,cy-ts*.45);return;}
  const need=hasRope()?MON.scareTapsRope:MON.scareTaps,now=performance.now();
  const taps=m.taps.filter(t=>now-t<1600).length;
  if(taps){ // 連點的進度圈
    ctx.lineWidth=Math.max(3,ts*.12);ctx.strokeStyle='rgba(44,44,42,.2)';ctx.beginPath();ctx.arc(cx,cy,ts*.62,0,7);ctx.stroke();
    ctx.strokeStyle='#d7263d';ctx.beginPath();ctx.arc(cx,cy,ts*.62,-Math.PI/2,-Math.PI/2+Math.PI*2*taps/need);ctx.stroke();
    ctx.fillStyle='#d7263d';ctx.font=`900 ${ts*.36}px Poppins,sans-serif`;ctx.fillText(`${taps}/${need}`,cx,cy+ts*.85);}
  else if(run.monHint&&run.st.scares===0){ // 教玩家怎麼嚇跑牠
    const t=fill(MON.hintBubble||'連點 {n} 下嚇跑牠！',{n:need});ctx.font=`900 ${Math.max(10,ts*.36)}px "Noto Sans TC",sans-serif`;
    const w=ctx.measureText(t).width+ts*.4,h=ts*.56,bx=Math.max(2,Math.min(cw-w-2,cx-w/2)),by=cy-ts*1.25+wob(Math.sin(pulse*4)*2);
    ctx.fillStyle='#d7263d';rr(bx,by,w,h,h/2);ctx.fill();ctx.beginPath();ctx.moveTo(cx-ts*.12,by+h-1);ctx.lineTo(cx+ts*.12,by+h-1);ctx.lineTo(cx,by+h+ts*.16);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff';ctx.fillText(t,bx+w/2,by+h/2+1);}
}
function drawNpc(n){
  const cx=(n.x+.5)*ts,cy=(n.y+.5)*ts,r=ts*.42;
  const rs=run.res[n.id];const isRes=!!rs;
  const done=isRes?rs.state==='saved':n.id==='lettuce'?false:run.cheese&&run.cheese.caught;
  const stuckN=isRes&&rs.state==='stuck';
  if(stuckN)ctx.globalAlpha=.5;
  if(n.kind==='tomato'){ctx.fillStyle=stuckN?'#999':'#d7263d';ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fill();ctx.fillStyle='#7fa63d';for(let i=0;i<5;i++){const a=-Math.PI/2+(i-2)*.5;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*r*.35,cy-r*.85+Math.sin(a)*r*.15,r*.28,r*.1,a,0,7);ctx.fill();}face(cx,cy,r,done?'happy':'angry');}
  else if(n.kind==='lettuce'){ctx.fillStyle='#7fa63d';ctx.beginPath();for(let i=0;i<=16;i++){const a=i/16*Math.PI*2,rad=r*(i%2?1:.86);ctx.lineTo(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad);}ctx.fill();ctx.fillStyle='#a9c96b';ctx.beginPath();ctx.arc(cx,cy,r*.62,0,7);ctx.fill();face(cx,cy,r,'calm');}
  else if(n.kind==='cheese'){ctx.globalAlpha=.65+.35*Math.sin(pulse*3);ctx.fillStyle='#ffc233';ctx.beginPath();ctx.moveTo(cx-r,cy+r*.7);ctx.lineTo(cx+r,cy+r*.7);ctx.lineTo(cx+r*.2,cy-r*.9);ctx.closePath();ctx.fill();ctx.strokeStyle='#2c2c2a';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#e9a800';ctx.beginPath();ctx.arc(cx+r*.45,cy+r*.3,r*.12,0,7);ctx.arc(cx-r*.5,cy+r*.45,r*.09,0,7);ctx.fill();face(cx,cy+r*.15,r*.75,'happy');ctx.globalAlpha=1;}
  else{ctx.fillStyle=stuckN?'#999':n.color;ctx.beginPath();ctx.arc(cx,cy+r*.25,r*.75,Math.PI,0);ctx.fill();ctx.fillRect(cx-r*.75,cy+r*.25,r*1.5,r*.5);ctx.fillStyle='#f6d9c0';ctx.beginPath();ctx.arc(cx,cy-r*.2,r*.55,0,7);ctx.fill();ctx.strokeStyle='#2c2c2a';ctx.lineWidth=1.5;ctx.stroke();face(cx,cy-r*.2,r*.55,done?'happy':'sad');
    if(!done&&!stuckN){ctx.fillStyle='#ffc233';ctx.globalAlpha=.6+.4*Math.sin(pulse*4);ctx.beginPath();ctx.arc(cx-r*.7,cy+r*.15,r*.22,0,7);ctx.arc(cx+r*.7,cy+r*.15,r*.22,0,7);ctx.fill();ctx.globalAlpha=1;}}
  ctx.globalAlpha=1;
  if(stuckN)monBlob(cx,cy-r*.15,r*.62,false,1);
  ctx.font=`700 ${Math.max(9,ts*.34)}px "Noto Sans TC",sans-serif`;ctx.lineWidth=3;ctx.strokeStyle='#fff';
  ctx.strokeText(n.nm,cx,cy+r+ts*.22);ctx.fillStyle=stuckN?'#888780':'#2c2c2a';ctx.fillText(n.nm,cx,cy+r+ts*.22);
  if(isRes&&rs.state==='open'){
    const t=Math.min(100,rs.t),bw=ts*.9,bh=Math.max(4,ts*.14),bx=cx-bw/2,by=n.y*ts-ts*.32;
    ctx.fillStyle='#fff';rr(bx-1.5,by-1.5,bw+3,bh+3,3);ctx.fill();ctx.strokeStyle='#2c2c2a';ctx.lineWidth=1.2;ctx.stroke();
    ctx.fillStyle=tCol(t);if(t>=85&&Math.sin(pulse*10)>0)ctx.fillStyle='#ff6b7d';ctx.fillRect(bx,by,bw*t/100,bh);
  }else if(stuckN)bubble(n.x+.5,n.y-.15,'#888780','✕');
  else if(done&&n.id!=='cheese')bubble(n.x+.5,n.y-.05,'#7fa63d','✓');
}
function bubble(tx,ty,col,t){const x=tx*ts,y=ty*ts-ts*.18+wob(Math.sin(pulse*4)*2);ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,ts*.27,0,7);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=col==='#ffc233'?'#2c2c2a':'#fff';ctx.font=`900 ${ts*.3}px "Noto Sans TC",sans-serif`;ctx.fillText(t,x,y+1);}
function drawPlayer(){
  const cx=(player.x+.5)*ts,cy=(player.y+.5)*ts,r=ts*.4;const tired=run.energy<R.energy.low;
  ctx.fillStyle='rgba(0,0,0,.12)';ctx.beginPath();ctx.ellipse(cx,cy+r*.9,r*.8,r*.25,0,0,7);ctx.fill();
  ctx.fillStyle='#2c2c2a';ctx.beginPath();ctx.arc(cx,cy+r*.25,r*.75,Math.PI,0);ctx.fill();ctx.fillRect(cx-r*.75,cy+r*.25,r*1.5,r*.5);
  ctx.fillStyle='#ffc233';ctx.beginPath();ctx.arc(cx-r*.55,cy+r*(tired?0:.2),r*.22,0,7);ctx.arc(cx+r*.55,cy+r*(tired?0:.2),r*.22,0,7);ctx.fill();
  ctx.fillStyle='#f6d9c0';ctx.beginPath();ctx.arc(cx,cy-r*.25,r*.55,0,7);ctx.fill();ctx.strokeStyle='#2c2c2a';ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle='#2c2c2a';ctx.beginPath();ctx.arc(cx,cy-r*.85,r*.25,0,7);ctx.fill();
  face(cx,cy-r*.25,r*.55,tired?'sad':'happy');
  if(hasRope()){ctx.strokeStyle='#d7263d';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(cx-r*.7,cy-r*.05);ctx.lineTo(cx+r*.7,cy+r*.6);ctx.stroke();}
  ctx.font=`700 ${Math.max(9,ts*.34)}px "Noto Sans TC",sans-serif`;ctx.lineWidth=3;ctx.strokeStyle='#fff';ctx.strokeText('你',cx,cy+r+ts*.22);ctx.fillStyle='#2c2c2a';ctx.fillText('你',cx,cy+r+ts*.22);
}

// ================= 主迴圈、操作 =================
let last=0,kb=null,kbT=0,uiT=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000||0);last=now;
  const live=run.started&&!run.over&&(!sheetOpen||sheetLive);
  if(live){
    tick(dt*R.minPerSec*SPEED);
    if(!sheetOpen){
      if(player.path.length){const [nx,ny]=player.path[0];const dx=nx-player.x,dy=ny-player.y,d=Math.hypot(dx,dy),s=R.walkTilesPerSec*run.walkMul*SPEED*dt;
        if(d<=s){player.x=nx;player.y=ny;player.path.shift();run.st.walk++;run.st.pend++;run.energy-=R.energy.walkTile;run.st.minEnergy=Math.min(run.st.minEnergy,run.energy);pickTile(nx,ny);
          if(run.energy<=0){player.path=[];player.target=null;forcedRest();}}
        else{player.x+=dx/d*s;player.y+=dy/d*s;}}
      else if(player.target){const t=player.target;player.target=null;const px=Math.round(player.x),py=Math.round(player.y);if(isAdj(t,px,py))interact(t);}
      else if(kb){kbT-=dt;if(kbT<=0){step(kb);kbT=.15;}}
      const m=run.mon;
      if(!sheetOpen&&m.daze<=0&&m.cool<=0&&Math.hypot(player.x-m.fx,player.y-m.fy)<.6)monTouch();
      if(!sheetOpen&&!G.monsters.includes(MON.id)&&Math.abs(player.x-m.x)+Math.abs(player.y-m.y)<=3)meetMonster();
      if(!run.monHint&&m.daze<=0&&(Math.abs(player.x-m.x)+Math.abs(player.y-m.y)<=3||NPCS.some(n=>resOf(n).state==='open'&&Math.abs(n.x-m.x)+Math.abs(n.y-m.y)<=R.monsterNear))){
        run.monHint=true;meetMonster();toast(fill(MON.hint||'聳肩怪來了！連點牠 {n} 下可以嚇跑牠。',{n:hasRope()?MON.scareTapsRope:MON.scareTaps}),'warn');}
    }
    if(sheetOpen&&sheetLive&&run.timeUp)endDay();
    else if(!sheetOpen&&(run.timeUp||run.allDoneAt!==null))endDay();
    uiT-=dt;if(uiT<=0){uiT=.25;renderUI();}
  }
  draw(dt);requestAnimationFrame(frame);
}
function step(d){const px=Math.round(player.x),py=Math.round(player.y),nx=px+d[0],ny=py+d[1];if(!blocked(nx,ny))player.path=[[nx,ny]];}
cv.addEventListener('pointerdown',ev=>{
  if(sheetOpen||!run.started||run.over)return;const r=cv.getBoundingClientRect();const fx=(ev.clientX-r.left)/ts,fy=(ev.clientY-r.top)/ts;const x=Math.floor(fx),y=Math.floor(fy);
  if(x<0||y<0||x>=W||y>=H)return;
  // 點到居民身上、頭上的長條、名字，都算點到這位居民（手指比格子大）
  let n=null,bd=.8;
  for(const p of allPeople()){for(const [hx,hy] of [[p.x+.5,p.y+.5],[p.x+.5,p.y-.25],[p.x+.5,p.y+1.1]]){const d=Math.hypot(fx-hx,fy-hy);if(d<bd){bd=d;n=p;}}}
  const m=run.mon,md=Math.hypot(fx-(m.fx+.5),fy-(m.fy+.5));
  if(md<.85&&md<=bd){tapMonster();return;}
  if(n){goTo({kind:'npc',n});return;}
  if(ROPE&&!hasRope()&&BLD[ROPE.at]){const b=BLD[ROPE.at];if(Math.hypot(fx-(b.x0+(b.x1-b.x0+1)/2),fy-(b.y0-.18))<.7){goTo({kind:'bld',key:ROPE.at});return;}}
  const c=grid[y][x];
  if(BINFO[c]){goTo({kind:'bld',key:c});return;}
  if(c==='#')return;
  const p=bfs(Math.round(player.x),Math.round(player.y),(a,bb)=>a===x&&bb===y);if(p){player.path=p;player.target=null;}
});
const KM={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
window.addEventListener('keydown',e=>{
  if(sheetOpen){if(keyHandler){keyHandler(e,true);return;}if(e.key==='Escape'&&['album'].includes(sheetKind))$('close').click();return;}
  if(!run.started||run.over)return;
  if(KM[e.key]){e.preventDefault();if(kb!==KM[e.key]){kb=KM[e.key];player.target=null;if(!player.path.length){step(kb);kbT=.18;}}return;}
  if(e.key==='m'||e.key==='M'){const mm=run.mon;if(Math.abs(player.x-mm.x)+Math.abs(player.y-mm.y)<=3)tapMonster();return;}
  if(e.key==='e'||e.key==='E'||e.key===' '){e.preventDefault();const px=Math.round(player.x),py=Math.round(player.y);
    const n=allPeople().find(p=>adjTo(px,py,p.x,p.y));if(n){interact({kind:'npc',n});return;}
    for(const k in BLD)if(adjBld(BLD[k],px,py)){interact({kind:'bld',key:k});return;}}
});
window.addEventListener('keyup',e=>{if(sheetOpen&&keyHandler){keyHandler(e,false);return;}if(KM[e.key]&&kb===KM[e.key])kb=null;});
window.addEventListener('resize',resize);
resize();renderUI();requestAnimationFrame(frame);
$('toast').textContent=Z.intro;
if(location.hash==='#book')album();else intro();
// 給自動測試用（不影響遊戲）
window.__town={Z,NPCS,R,storyPng,get S(){return S},G,get run(){return run},get player(){return player},get sheetKind(){return sheetKind},get sheetOpen(){return sheetOpen},
  goTo,distTo,openRes,clockStr,DAYLEN,BLD,ts:()=>ts};
})();
