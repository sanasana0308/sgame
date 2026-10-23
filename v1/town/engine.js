// 三明治鎮遊戲程式。內容全部來自 /content/，這個檔案很少需要改。
(async function(){
const {P,KEYS,BACK,backSvg,figSvg,poseSvg}=window.SWFig;
const PL=window.SWPlayer;
const $=id=>document.getElementById(id);

// ================= 讀內容 =================
async function getJSON(u){const r=await fetch(u,{cache:'no-cache'});if(!r.ok)throw new Error(u);return r.json();}
let POSES={},Z;
try{
  const [poses,idx]=await Promise.all([getJSON('/v1/content/poses.json'),getJSON('/v1/content/zones/index.json')]);
  for(const p of poses.poses)POSES[p.id]=p;
  const zones=await Promise.all(idx.zones.map(id=>getJSON(`/v1/content/zones/${id}.json`)));
  zones.sort((a,b)=>a.order-b.order);
  const want=new URLSearchParams(location.search).get('zone');
  const today=PL.today();
  const open=zones.filter(z=>z.unlock<=today);
  Z=(want&&zones.find(z=>z.id===want&&z.unlock<=today))||open[open.length-1];
  if(!Z){const next=zones[0];$('toast').textContent=`三明治鎮 ${next.unlock} 開放，敬請期待！`;return;}
}catch(e){$('toast').textContent='小鎮的地圖還沒載入，請重新整理一次。';console.error(e);return;}

const RM=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){return false}})();
const GAME_URL=location.origin+'/v1/town';
const ROPE=Z.items.find(i=>i.id==='rope');
const BRICK=Z.items.find(i=>i.id==='brick')||{at:[],badgeAt:99};
const BRICKS=BRICK.at;

// 居民
const NPCS=Z.residents.map(r=>{
  const pose=POSES[r.pose]||{};
  const opts=r.quiz.opts.map((t,i)=>({t,ok:i===0}));
  for(let i=opts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]];}
  return {id:r.id,nm:r.name,role:r.role||'',x:r.at[0],y:r.at[1],kind:r.char,color:r.color,need:r.needs,noitem:r.noItem,ask:r.ask,thanks:r.thanks,
    sticker:r.sticker,bonus:r.bonus,bonusHave:r.bonusHave,bonusMissing:r.bonusMissing,bonusThanks:r.bonusThanks,
    L:{nm:pose.name,en:pose.en,fig:pose.figure,back:!!BACK[pose.figure],intro:pose.intro,q:r.quiz.q,opts,fact:r.fact||pose.fact,tip:r.tip||pose.cue}};
});
const F=Z.finale,SEC=Z.secret;
const LETTUCE={id:'lettuce',nm:F.name,role:F.role,x:F.at[0],y:F.at[1],kind:F.char};
const CHEESE=SEC?{id:'cheese',nm:SEC.name,role:SEC.role,x:SEC.at[0],y:SEC.at[1],kind:SEC.char}:null;
const allPeople=()=>[...NPCS,LETTUCE,...(CHEESE?[CHEESE]:[])];

// 地圖
const MAP=Z.map.rows,BINFO=Z.map.buildings;
const H=MAP.length,W=MAP[0].length,DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const grid=MAP.map(r=>r.split(''));
const BLD={};for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=grid[y][x];if(BINFO[c]){const b=BLD[c]||(BLD[c]={x0:x,y0:y,x1:x,y1:y});b.x0=Math.min(b.x0,x);b.y0=Math.min(b.y0,y);b.x1=Math.max(b.x1,x);b.y1=Math.max(b.y1,y);}}
function blocked(x,y){if(x<0||y<0||x>=W||y>=H)return true;const c=grid[y][x];if(c!=='.'&&c!=='=')return true;return allPeople().some(n=>n.x===x&&n.y===y);}
function bfs(sx,sy,goal){
  if(goal(sx,sy))return [];
  const K=(x,y)=>y*W+x,start=K(sx,sy),prev=new Map([[start,-1]]),q=[[sx,sy]];
  while(q.length){const [x,y]=q.shift();for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy;if(blocked(nx,ny))continue;const k=K(nx,ny);if(prev.has(k))continue;prev.set(k,K(x,y));
    if(goal(nx,ny)){const path=[];let c=k;while(c!==start){path.unshift([c%W,(c/W)|0]);c=prev.get(c);}return path;}q.push([nx,ny]);}}
  return null;
}

// ================= 存檔 =================
const G=PL.get();
let S=PL.zone(Z.id);
const save=()=>PL.save();
const hasRope=()=>!!G.bag.rope;
const startPos=()=>({x:Z.map.start[0],y:Z.map.start[1],path:[],target:null});
let player=startPos(),sheetOpen=false;

// ================= 標題 =================
const ORD=['','一','二','三','四','五','六','七','八','九','十','十一','十二'];
const zoneName=`第${ORD[Z.order]||Z.order}區`;
$('zoneTag').textContent=`${zoneName} · ${Z.title}`;
$('listTitle').firstChild.textContent=Z.listTitle+' ';
$('help').textContent=`點地圖走路，點居民或店家就會走過去。鎮上還藏著${BRICKS.length?` ${BRICKS.length} 塊瑜伽磚和`:''}一位神祕居民。點右上角的貼紙可以打開貼紙簿。電腦可以用方向鍵走路、E 互動。`;
$('toast').textContent=Z.intro;

// ================= 圖：小人 =================
let fig={cur:JSON.parse(JSON.stringify(P.stand)),view:'side',bt:0,breathing:false,anim:null,brick:false};
function drawFig(){const el=$('fig');if(!el)return;const b=Math.sin(fig.bt)*1.6;const pc=fig.brick?Object.assign(JSON.parse(JSON.stringify(fig.cur)),{h1:[fig.cur.h1[0],186],h2:[fig.cur.h2[0],186],e1:[fig.cur.e1[0],fig.cur.e1[1]-6],e2:[fig.cur.e2[0],fig.cur.e2[1]-6]}):fig.cur;el.innerHTML=fig.view==='back'?backSvg(b,false):figSvg(pc,b)+(fig.brick?`<rect x="46" y="186" width="40" height="13" rx="3" fill="#b48ad8" stroke="#2c2c2a" stroke-width="2"/><text x="40" y="196" text-anchor="end" font-size="11" font-weight="700" fill="#2c2c2a" font-family="Noto Sans TC,sans-serif">瑜伽磚</text>`:'');}
function moveFig(name,ms=1000){
  const from=JSON.parse(JSON.stringify(fig.cur)),to=P[name]||P.stand;
  if(RM){fig.cur=JSON.parse(JSON.stringify(to));drawFig();return Promise.resolve();}
  return new Promise(res=>{const t0=performance.now();cancelAnimationFrame(fig.anim);
    const step=now=>{const t=Math.min(1,(now-t0)/ms),e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
      for(const k of KEYS)fig.cur[k]=[from[k][0]+(to[k][0]-from[k][0])*e,from[k][1]+(to[k][1]-from[k][1])*e];
      drawFig();if(t<1)fig.anim=requestAnimationFrame(step);else res();};
    fig.anim=requestAnimationFrame(step);});
}
function swapView(v){const f=$('fig');return new Promise(res=>{if(!f||RM){fig.view=v;drawFig();return res();}f.style.opacity=0;setTimeout(()=>{fig.view=v;drawFig();f.style.opacity=1;setTimeout(res,300);},300);});}

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
function sandwichSvg(){
  const has=k=>NPCS.some(n=>n.sticker===k&&S.helped.includes(n.id));let y=10,parts='';const ink='#2c2c2a';
  if(has('bread')){parts+=`<path d="M20 ${y+26} C20 ${y} 180 ${y} 180 ${y+26} Z" fill="#e8b46a" stroke="${ink}" stroke-width="3"/>`;y+=28;}
  if(has('lettuce')){parts+=`<path d="M14 ${y+4} q10 -8 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 L186 ${y+12} L14 ${y+12} Z" fill="#7fa63d" stroke="${ink}" stroke-width="3"/>`;y+=14;}
  if(has('tomato')){parts+=`<rect x="22" y="${y}" width="156" height="12" rx="6" fill="#d7263d" stroke="${ink}" stroke-width="3"/>`;y+=14;}
  if(has('cheese')){parts+=`<path d="M18 ${y} L182 ${y} L182 ${y+8} L150 ${y+8} L144 ${y+18} L138 ${y+8} L70 ${y+8} L64 ${y+16} L58 ${y+8} L18 ${y+8} Z" fill="#ffc233" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;y+=12;}
  if(has('egg')){parts+=`<ellipse cx="100" cy="${y+7}" rx="80" ry="8" fill="#fff" stroke="${ink}" stroke-width="3"/><ellipse cx="100" cy="${y+5}" rx="18" ry="5" fill="#ffc233"/>`;y+=16;}
  parts+=`<rect x="20" y="${y}" width="160" height="20" rx="8" fill="#e8b46a" stroke="${ink}" stroke-width="3"/>`;y+=24;
  return `<svg viewBox="0 0 200 ${y+4}" role="img" aria-label="你做出來的三明治">${parts}</svg>`;
}

// ================= 畫面 =================
function toast(t){const el=$('toast');el.textContent=t;el.style.opacity=1;clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.opacity=0,5200);}
const AV={tomato:['#d7263d','番'],lettuce:['#7fa63d','生'],cheese:['#ffc233','起']};
function avOf(n){return n.kind==='person'?[n.color,n.nm.slice(-2,-1)]:AV[n.kind]||['#888780',n.nm[0]];}
function renderHud(pop){
  const b=G.bag.brick||0,need=BRICK.badgeAt||3;
  $('hud').innerHTML=`<span class="h">背包</span>
   <span class="slot ${hasRope()?'got':'off'} ${pop==='rope'?'pop':''}" title="瑜伽繩">${ropeSvg()}${hasRope()?'瑜伽繩':'瑜伽繩？'}</span>
   ${Array.from({length:Math.max(need,b)},(_,i)=>`<span class="slot ${i<b?'got':'off'} ${pop==='brick'&&i===b-1?'pop':''}" title="瑜伽磚">${brickSvg()}</span>`).join('')}
   <span class="slot ${b>=need?'got':'off'}" style="font-size:12px">${b>=need?'磚家 ✓':`瑜伽磚 ${b}/${need}`}</span>
   ${S.cheese?`<span class="slot got">${ingSvg('cheese')}起司先生</span>`:''}`;
}
function renderDots(){$('albumDots').innerHTML=NPCS.map(n=>`<span class="dot ${S.helped.includes(n.id)?'on':'off'}" title="${ING[n.sticker]}">${ingSvg(n.sticker)}</span>`).join('');}
function renderUI(){
  $('count').textContent=`${S.helped.length} / ${NPCS.length}`;
  const pe=$('people');
  pe.innerHTML=[...NPCS,LETTUCE].map(n=>{const done=n.id==='lettuce'?S.done:S.helped.includes(n.id);const [c,t]=avOf(n);
    const sub=n.id==='lettuce'?(S.done?'完成':S.helped.length<NPCS.length?'幫完大家再來':'在等你'):done?'已幫忙・'+n.L.nm:n.role;
    return `<button class="who ${done?'done':''}" data-id="${n.id}"><span class="av" style="background:${c};${n.kind==='cheese'?'color:#2c2c2a':''}">${t}</span><span class="t"><b>${n.nm}</b><small>${sub}</small></span></button>`;}).join('');
  pe.querySelectorAll('.who').forEach(b=>b.onclick=()=>{const n=allPeople().find(p=>p.id===b.dataset.id);goTo({kind:'npc',n});});
  renderDots();renderHud();
}

// ================= 走路、互動 =================
function adjTo(x,y,tx,ty){return Math.abs(tx-x)+Math.abs(ty-y)===1;}
function adjBld(b,x,y){for(let yy=b.y0;yy<=b.y1;yy++)for(let xx=b.x0;xx<=b.x1;xx++)if(adjTo(x,y,xx,yy))return true;return false;}
function isAdj(tg,x,y){if(tg.kind==='npc')return adjTo(x,y,tg.n.x,tg.n.y);if(tg.kind==='bld')return adjBld(BLD[tg.key],x,y);if(tg.kind==='brick')return x===tg.x&&y===tg.y;return false;}
function goTo(tg){
  if(sheetOpen)return;
  const px=Math.round(player.x),py=Math.round(player.y);
  if(isAdj(tg,px,py)){player.path=[];interact(tg);return;}
  const p=bfs(px,py,(x,y)=>isAdj(tg,x,y));
  if(!p){toast('那裡走不過去。');return;}
  player.path=p;player.target=tg;
}
function interact(tg){
  player.target=null;
  if(tg.kind==='brick'){pickBrick(tg.x,tg.y);return;}
  if(tg.kind==='bld'){
    const k=tg.key;
    if(ROPE&&k===ROPE.at&&!hasRope()){G.bag.rope=true;save();renderUI();renderHud('rope');openSay({nm:ROPE.from,role:BINFO[k].name,kind:'person',color:'#7fa63d'},ROPE.line,[{l:'謝謝老闆',fn:closeSheet}]);return;}
    toast(BINFO[k].line||BINFO[k].name);return;
  }
  const n=tg.n;
  if(n.id==='cheese'){openCheese();return;}
  if(n.id==='lettuce'){openLettuce();return;}
  if(S.helped.includes(n.id)){toast(`${n.nm}：「${n.thanks.slice(0,22)}…」看起來很放鬆。`);return;}
  openNpc(n);
}
function pickBrick(x,y){
  const k=x+','+y;if(S.bricks.includes(k))return;
  S.bricks.push(k);G.bag.brick=(G.bag.brick||0)+1;
  const full=G.bag.brick>=(BRICK.badgeAt||3);if(full&&BRICK.badge)PL.badge(BRICK.badge);
  save();renderUI();renderHud('brick');
  toast(!full?`撿到瑜伽磚（${G.bag.brick}/${BRICK.badgeAt}）。磚會一直放在背包，下一區也用得到。`:`集滿 ${BRICK.badgeAt} 塊瑜伽磚！獲得「磚家」徽章。這些磚會跟你到下一區。`);
}

// ================= 對話框 =================
const $sheet=$('sheet'),$panel=$('panel');
function head(n){const [c,t]=avOf(n);return `<div class="ph"><span class="av" style="background:${c};${n.kind==='cheese'?'color:#2c2c2a':''}">${t}</span><div><b>${n.nm}</b><small>${n.role||''}</small></div></div>`;}
function openSheet(html){sheetOpen=true;$sheet.hidden=false;$panel.innerHTML=html;$panel.scrollTop=0;const f=$panel.querySelector('button');f&&f.focus({preventScroll:true});}
function closeSheet(){sheetOpen=false;$sheet.hidden=true;fig.breathing=false;renderUI();checkAllDone();}
function openSay(n,text,btns){
  openSheet(`${head(n)}<div class="pb"><p class="say">${text}</p><div class="row">${btns.map((b,i)=>`<button class="${i===0?'primary':'ghost'}" data-i="${i}">${b.l}</button>`).join('')}</div></div>`);
  $panel.querySelectorAll('.row button').forEach(b=>b.onclick=()=>btns[+b.dataset.i].fn());
}
function openNpc(n){
  if(n.need==='rope'&&!hasRope()){openSay(n,n.ask+'<br><br>'+n.noitem,[{l:'好，我去找',fn:closeSheet}]);return;}
  openSay(n,n.ask,[{l:`教他：${n.L.nm}`,fn:()=>lesson(n)},{l:'等一下再來',fn:closeSheet}]);
}
async function lesson(n){
  const L=n.L;
  fig.cur=JSON.parse(JSON.stringify(P.stand));fig.view='side';fig.brick=false;
  const useBrick=n.bonus==='brick'&&(G.bag.brick||0)>0;
  openSheet(`${head(n)}<div class="figbox"><svg id="fig" viewBox="0 0 220 214" role="img" aria-label="${L.nm}示範"></svg><span class="tag" id="ftag">${L.nm}</span>
    <div class="breath" id="breath" hidden><div class="ring" id="ring"></div><span id="btxt">吸氣</span></div></div><div class="pb" id="lb"></div>`);
  drawFig();
  const bonus=n.bonus==='brick'?(useBrick?`<p class="fact" style="margin:0">${n.bonusHave}</p>`:`<p style="margin:0;font-size:14px;color:var(--stone)">${n.bonusMissing}</p>`):'';
  $('lb').innerHTML=`<div class="pname"><h2>${L.nm}</h2><span>${L.en}</span></div><p class="lead">${L.intro}</p>${bonus}<button class="primary" id="do">示範給${n.nm.replace(/先生|小姐/,'')}看</button>`;
  $('do').onclick=async()=>{
    $('do').disabled=true;
    if(L.back){await moveFig(BACK[L.fig],1000);$('ftag').textContent='背面看';await swapView('back');}
    else await moveFig(L.fig,1100);
    if(useBrick){fig.brick=true;S.brickUsed=true;save();drawFig();}
    breathe(n);
  };
}
function breathe(n){
  const L=n.L,lb=$('lb');
  lb.innerHTML=`<div class="pname"><h2>${L.nm}</h2><span>${L.en}</span></div><p class="lead">你和${n.nm}一起停在這裡，跟著圓圈呼吸兩次。</p><button class="link" id="skip">做好了</button>`;
  const B=$('breath'),R=$('ring'),T=$('btxt');
  B.hidden=false;fig.breathing=true;let k=0,stop=false;
  const end=()=>{if(stop)return;stop=true;fig.breathing=false;B.hidden=true;quiz(n);};
  const cyc=()=>{if(stop)return;if(k>=4)return end();const inh=k%2===0;R.classList.toggle('in',inh);T.textContent=inh?'吸氣':'吐氣';k++;setTimeout(cyc,2500);};
  cyc();$('skip').onclick=end;
}
function quiz(n){
  const L=n.L,lb=$('lb');const ai=L.opts.findIndex(o=>o.ok);
  lb.innerHTML=`<span class="eyebrow">${n.nm}問你</span><h2 style="font-size:19px">${L.q}</h2>
    <div class="opts">${L.opts.map((o,i)=>`<button class="opt" data-i="${i}">${o.t}</button>`).join('')}</div><div id="after"></div>`;
  lb.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.i,ok=i===ai;if(ok)S.right++;
    S.quiz[n.id]=ok;if(!S.helped.includes(n.id))S.helped.push(n.id);save();
    lb.querySelectorAll('.opt').forEach((x,j)=>{x.disabled=true;if(j===ai)x.classList.add('right');else if(j===i)x.classList.add('wrong');});
    $('after').innerHTML=`<div class="fact"><b>${ok?'答對了！':'哈，是綠色那個。'}</b><p>${L.fact}</p><div class="tip"><i>小撇步</i><p>${L.tip}</p></div></div>
      <p class="say" style="margin-top:12px">${n.bonus&&S.brickUsed&&n.bonusThanks?n.bonusThanks:''}${n.thanks}</p>
      <button class="primary" id="nx" style="width:100%;margin-top:12px">拿到「${L.nm}」貼紙，回到小鎮</button>`;
    $('nx').onclick=()=>{closeSheet();toast(`拿到「${ING[n.sticker]}」貼紙！放進右上角的貼紙簿了。`);const ab=$('albumBtn');ab.classList.remove('pop');void ab.offsetWidth;ab.classList.add('pop');};
  });
}
function openCheese(){
  const first=!S.cheese;S.cheese=true;if(SEC.badge)PL.badge(SEC.badge);save();renderUI();
  openSay(CHEESE,first?SEC.line:SEC.again,[{l:first?'我不會說的':'好',fn:closeSheet}]);
}
function openLettuce(){
  if(S.done){openSay(LETTUCE,F.after,[{l:'看我的收集',fn:result},{l:'關閉',fn:closeSheet}]);return;}
  const left=NPCS.length-S.helped.length;
  if(left>0){openSay(LETTUCE,F.wait.replace('{n}',left),[{l:'好',fn:closeSheet}]);return;}
  openSay(LETTUCE,F.line,[{l:'好',fn:hug}]);
}
async function hug(){
  const figName=(POSES[F.pose]||{}).figure||'hug';
  fig.cur=JSON.parse(JSON.stringify(P.stand));fig.view='side';fig.brick=false;
  openSheet(`${head(LETTUCE)}<div class="figbox"><svg id="fig" viewBox="0 0 220 214" role="img" aria-label="${F.title}"></svg><span class="tag">收尾</span></div><div class="pb" id="lb"></div>`);
  drawFig();await moveFig(figName,1000);
  $('lb').innerHTML=`<h2 style="font-size:21px">${F.title}</h2><p class="lead">${F.lead}</p><button class="pat" id="patBtn">拍拍</button><p class="patmsg" id="patMsg"></p>`;
  let k=0;const m=F.pats;
  $('patBtn').onclick=()=>{k++;$('patMsg').textContent=m[Math.min(k,m.length)-1];if(!RM)fig.bt+=1.6;if(k===m.length){S.done=true;S.doneAt=PL.today();save();setTimeout(result,1100);}};
}
function bagHtml(){const need=BRICK.badgeAt||3;return `<div class="bag"><span class="${hasRope()?'on':''}">瑜伽繩 ${hasRope()?'✓':'還沒拿'}</span><span class="${G.bag.brick?'on':''}">瑜伽磚 ${G.bag.brick||0}/${need}</span></div>`;}
function badgeCards(){
  const out=[];if((G.bag.brick||0)>=(BRICK.badgeAt||3))out.push(['磚家',`集滿 ${BRICK.badgeAt} 塊瑜伽磚`]);if(S.cheese)out.push(['起司先生彩蛋','找到躲起來的起司先生']);return out;
}
function album(){
  openSheet(`<div class="pb"><span class="eyebrow">貼紙簿・${zoneName} ${Z.title}</span>
   <h2 style="font-size:22px">${S.helped.length} / ${NPCS.length} 張・集滿做出一個三明治</h2>
   <div class="sandwich">${sandwichSvg()}</div>
   <div class="grid">${NPCS.map(n=>S.helped.includes(n.id)?`<div class="sticker">${ingSvg(n.sticker,'ing')}<b>${ING[n.sticker]}・${n.L.nm}</b>${poseSvg(n.L.fig,'pose')}<small>${n.L.tip}</small></div>`:`<div class="sticker empty">${ingSvg(n.sticker,'ing').replace('<svg ','<svg style="opacity:.15;filter:grayscale(1)" ')}<b>${ING[n.sticker]}</b><small>幫${n.nm}就能拿到</small></div>`).join('')}
    ${badgeCards().map(b=>`<div class="sticker badge"><b style="font-size:20px;padding:14px 0 2px">${b[0]}</b><small>${b[1]}</small></div>`).join('')}</div>
   <div><span class="eyebrow" style="background:var(--soft);color:var(--stone);margin-bottom:6px">背包</span>${bagHtml()}</div>
   <button class="primary" id="close">回到小鎮</button></div>`);
  $('close').onclick=closeSheet;
}
$('albumBtn').onclick=()=>{if(!sheetOpen)album();};
function result(){
  const got=NPCS.filter(n=>S.helped.includes(n.id));
  const cta=Z.cta&&Z.cta.url?Z.cta:null;
  openSheet(`<div class="pb">
   <span class="eyebrow">${zoneName}完成</span>
   <h2 style="font-size:24px">${Z.doneLabel}</h2>
   <p class="lead" style="color:var(--stone)">幫了 ${got.length} 位居民，猜對 ${S.right} 題，找到 ${S.bricks.length}/${BRICKS.length} 塊瑜伽磚。</p>
   <div class="sandwich">${sandwichSvg()}</div>
   <p class="say" style="text-align:center">你用 ${got.length} 張貼紙，做出了一個三明治！</p>
   <div class="grid">${got.map(n=>`<div class="sticker">${ingSvg(n.sticker,'ing')}<b>${ING[n.sticker]}・${n.L.nm}</b></div>`).join('')}
    ${badgeCards().map(b=>`<div class="sticker badge"><b style="font-size:20px;padding:14px 0 2px">${b[0]}</b><b style="font-weight:500;font-size:11px;color:var(--stone)">${b[1]}</b></div>`).join('')}</div>
   <div>${bagHtml()}<p style="margin:6px 0 0;font-size:13px;color:var(--stone)">背包裡的瑜伽磚和瑜伽繩，會跟你到下一區。</p></div>
   ${SEC&&S.cheese&&SEC.teaser?`<p class="say">${SEC.teaser}</p>`:''}
   ${cta?`<div class="pass"><small>通關密語</small><b>${Z.passcode}</b><small>把通關密語傳給我們，領這一區的序列圖卡。</small><a class="primary" href="${cta.url}" target="_blank" rel="noopener">${cta.label}</a></div>`:''}
   <div class="row"><button class="ghost" id="share">複製結果分享</button><button class="ghost" id="again">重新開始</button></div>
   <div class="copied" id="copied" aria-live="polite"></div>
   <button class="primary" id="close">回到小鎮逛逛</button></div>`);
  $('close').onclick=closeSheet;
  $('again').onclick=()=>{G.bag.brick=Math.max(0,(G.bag.brick||0)-S.bricks.length);PL.resetZone(Z.id);S=PL.zone(Z.id);save();player=startPos();allDoneShown=false;closeSheet();toast('重新開始。居民的肩膀又卡住了。');};
  $('share').onclick=async()=>{
    const t=`我在「三明治鎮」當了一天瑜伽老師，幫 ${got.length} 位居民放鬆！\n${(G.bag.brick||0)>=(BRICK.badgeAt||3)?'還拿到「磚家」徽章。':''}${S.cheese?'也找到了躲起來的起司先生。':''}\n換你來當瑜伽老師 👉 ${GAME_URL}\n#PDPL排都排了排好序列一起練 #sandywichyoga`;
    const out=$('copied');
    try{await navigator.clipboard.writeText(t);out.textContent='已複製，可以貼到限動或傳給朋友。';}
    catch(_){out.innerHTML='';const ta=document.createElement('textarea');ta.value=t;ta.rows=4;ta.style.width='100%';out.appendChild(ta);ta.select();}
  };
}
let allDoneShown=false;
function checkAllDone(){if(!S.done&&S.helped.length===NPCS.length&&!allDoneShown){allDoneShown=true;toast(`大家都幫完了！去${F.role.replace(/旁$/,'')}找${F.name}。`);}}

// ================= 畫地圖 =================
const cv=$('cv'),ctx=cv.getContext('2d');let ts=24,cw=360,pulse=0;
function resize(){cw=$('stageMap').clientWidth||360;ts=cw/W;const d=window.devicePixelRatio||1;cv.width=Math.round(cw*d);cv.height=Math.round(cw*H/W*d);cv.style.height=(cw*H/W)+'px';ctx.setTransform(d,0,0,d,0,0);}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
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
      ctx.fillStyle='#2c2c2a';ctx.font=`700 ${Math.max(10,ts*.42)}px "Noto Sans TC",sans-serif`;ctx.fillText(info.name,x+w/2,y+h/2);continue;}
    rr(x,y,w,h,6);ctx.fillStyle=info.bg||'#888780';ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='#2c2c2a';ctx.stroke();
    if(h>ts){ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(x+4,y+4,w-8,h*.28);}
    ctx.fillStyle=info.fg||'#fff';const fs=Math.max(9,Math.min(ts*.5,w/info.name.length*.85));ctx.font=`900 ${fs}px "Noto Sans TC",sans-serif`;ctx.fillText(info.name,x+w/2,y+h*(h>ts?.6:.52));
    if(ROPE&&k===ROPE.at&&!hasRope())bubble(b.x0+(b.x1-b.x0+1)/2,b.y0,'#ffc233','繩');
  }
  for(const [bx,by] of BRICKS){if(S.bricks.includes(bx+','+by))continue;const cx=(bx+.5)*ts,cy=(by+.5)*ts+Math.sin(pulse*3)*1.5;ctx.fillStyle='#b48ad8';rr(cx-ts*.28,cy-ts*.18,ts*.56,ts*.36,4);ctx.fill();ctx.strokeStyle='#2c2c2a';ctx.lineWidth=1.5;ctx.stroke();}
  for(const n of allPeople())drawNpc(n);
  drawPlayer();
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
function drawNpc(n){
  const cx=(n.x+.5)*ts,cy=(n.y+.5)*ts,r=ts*.42;
  const done=n.id==='lettuce'?S.done:n.id==='cheese'?S.cheese:S.helped.includes(n.id);
  if(n.kind==='tomato'){ctx.fillStyle='#d7263d';ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fill();ctx.fillStyle='#7fa63d';for(let i=0;i<5;i++){const a=-Math.PI/2+(i-2)*.5;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*r*.35,cy-r*.85+Math.sin(a)*r*.15,r*.28,r*.1,a,0,7);ctx.fill();}face(cx,cy,r,done?'happy':'angry');}
  else if(n.kind==='lettuce'){ctx.fillStyle='#7fa63d';ctx.beginPath();for(let i=0;i<=16;i++){const a=i/16*Math.PI*2,rad=r*(i%2?1:.86);ctx.lineTo(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad);}ctx.fill();ctx.fillStyle='#a9c96b';ctx.beginPath();ctx.arc(cx,cy,r*.62,0,7);ctx.fill();face(cx,cy,r,done?'happy':'calm');}
  else if(n.kind==='cheese'){ctx.globalAlpha=S.cheese?1:.55+.25*Math.sin(pulse*2);ctx.fillStyle='#ffc233';ctx.beginPath();ctx.moveTo(cx-r,cy+r*.7);ctx.lineTo(cx+r,cy+r*.7);ctx.lineTo(cx+r*.2,cy-r*.9);ctx.closePath();ctx.fill();ctx.strokeStyle='#2c2c2a';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#e9a800';ctx.beginPath();ctx.arc(cx+r*.45,cy+r*.3,r*.12,0,7);ctx.arc(cx-r*.5,cy+r*.45,r*.09,0,7);ctx.fill();face(cx,cy+r*.15,r*.75,'happy');ctx.globalAlpha=1;}
  else{ctx.fillStyle=n.color;ctx.beginPath();ctx.arc(cx,cy+r*.25,r*.75,Math.PI,0);ctx.fill();ctx.fillRect(cx-r*.75,cy+r*.25,r*1.5,r*.5);ctx.fillStyle='#f6d9c0';ctx.beginPath();ctx.arc(cx,cy-r*.2,r*.55,0,7);ctx.fill();ctx.strokeStyle='#2c2c2a';ctx.lineWidth=1.5;ctx.stroke();face(cx,cy-r*.2,r*.55,done?'happy':'sad');
    if(!done){ctx.fillStyle='#ffc233';ctx.globalAlpha=.6+.4*Math.sin(pulse*4);ctx.beginPath();ctx.arc(cx-r*.7,cy+r*.15,r*.22,0,7);ctx.arc(cx+r*.7,cy+r*.15,r*.22,0,7);ctx.fill();ctx.globalAlpha=1;}}
  ctx.font=`700 ${Math.max(9,ts*.34)}px "Noto Sans TC",sans-serif`;ctx.lineWidth=3;ctx.strokeStyle='#fff';
  if(n.id!=='cheese'||S.cheese){ctx.strokeText(n.nm,cx,cy+r+ts*.22);ctx.fillStyle='#2c2c2a';ctx.fillText(n.nm,cx,cy+r+ts*.22);}
  const needs=n.id==='lettuce'?(!S.done&&S.helped.length===NPCS.length):n.id==='cheese'?false:!done;
  if(needs)bubble(n.x+.5,n.y-.05,'#d7263d','!');
  else if(done&&n.id!=='cheese')bubble(n.x+.5,n.y-.05,'#7fa63d','✓');
}
function bubble(tx,ty,col,t){const x=tx*ts,y=ty*ts-ts*.18+Math.sin(pulse*4)*2;ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,ts*.27,0,7);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=col==='#ffc233'?'#2c2c2a':'#fff';ctx.font=`900 ${ts*.3}px "Noto Sans TC",sans-serif`;ctx.fillText(t,x,y+1);}
function drawPlayer(){
  const cx=(player.x+.5)*ts,cy=(player.y+.5)*ts,r=ts*.4;
  ctx.fillStyle='rgba(0,0,0,.12)';ctx.beginPath();ctx.ellipse(cx,cy+r*.9,r*.8,r*.25,0,0,7);ctx.fill();
  ctx.fillStyle='#2c2c2a';ctx.beginPath();ctx.arc(cx,cy+r*.25,r*.75,Math.PI,0);ctx.fill();ctx.fillRect(cx-r*.75,cy+r*.25,r*1.5,r*.5);
  ctx.fillStyle='#ffc233';ctx.beginPath();ctx.arc(cx-r*.55,cy+r*.2,r*.22,0,7);ctx.arc(cx+r*.55,cy+r*.2,r*.22,0,7);ctx.fill();
  ctx.fillStyle='#f6d9c0';ctx.beginPath();ctx.arc(cx,cy-r*.25,r*.55,0,7);ctx.fill();ctx.strokeStyle='#2c2c2a';ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle='#2c2c2a';ctx.beginPath();ctx.arc(cx,cy-r*.85,r*.25,0,7);ctx.fill();
  face(cx,cy-r*.25,r*.55,'happy');
  if(hasRope()){ctx.strokeStyle='#d7263d';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(cx-r*.7,cy-r*.05);ctx.lineTo(cx+r*.7,cy+r*.6);ctx.stroke();}
  ctx.font=`700 ${Math.max(9,ts*.34)}px "Noto Sans TC",sans-serif`;ctx.lineWidth=3;ctx.strokeStyle='#fff';ctx.strokeText('你',cx,cy+r+ts*.22);ctx.fillStyle='#2c2c2a';ctx.fillText('你',cx,cy+r+ts*.22);
}

// ================= 主迴圈、操作 =================
let last=0,kb=null,kbT=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000||0);last=now;
  if(!sheetOpen){
    if(player.path.length){const [nx,ny]=player.path[0];const dx=nx-player.x,dy=ny-player.y,d=Math.hypot(dx,dy),s=5*dt;
      if(d<=s){player.x=nx;player.y=ny;player.path.shift();const b=BRICKS.find(([bx,by])=>bx===nx&&by===ny);if(b)pickBrick(nx,ny);}else{player.x+=dx/d*s;player.y+=dy/d*s;}}
    else if(player.target){const t=player.target;player.target=null;const px=Math.round(player.x),py=Math.round(player.y);if(isAdj(t,px,py))interact(t);}
    else if(kb){kbT-=dt;if(kbT<=0){step(kb);kbT=.15;}}
  }
  if(fig.breathing&&!RM){fig.bt+=.045;drawFig();}
  draw(dt);requestAnimationFrame(frame);
}
function step(d){const px=Math.round(player.x),py=Math.round(player.y),nx=px+d[0],ny=py+d[1];if(!blocked(nx,ny))player.path=[[nx,ny]];}
cv.addEventListener('pointerdown',ev=>{
  if(sheetOpen)return;const r=cv.getBoundingClientRect();const fx=(ev.clientX-r.left)/ts,fy=(ev.clientY-r.top)/ts;const x=Math.floor(fx),y=Math.floor(fy);
  if(x<0||y<0||x>=W||y>=H)return;
  // 點到居民身上、頭上的「！」或名字，都算點到這位居民（手指比格子大）
  let n=null,bd=.8;
  for(const p of allPeople()){for(const [hx,hy] of [[p.x+.5,p.y+.5],[p.x+.5,p.y-.2],[p.x+.5,p.y+1.1]]){const d=Math.hypot(fx-hx,fy-hy);if(d<bd){bd=d;n=p;}}}
  if(n){goTo({kind:'npc',n});return;}
  // 點到店家頭上的「繩」泡泡，也算點到店家
  if(ROPE&&!hasRope()&&BLD[ROPE.at]){const b=BLD[ROPE.at];if(Math.hypot(fx-(b.x0+(b.x1-b.x0+1)/2),fy-(b.y0-.18))<.7){goTo({kind:'bld',key:ROPE.at});return;}}
  const c=grid[y][x];
  if(BINFO[c]){goTo({kind:'bld',key:c});return;}
  if(c==='#')return;
  const b=BRICKS.find(([bx,by])=>bx===x&&by===y);
  const p=bfs(Math.round(player.x),Math.round(player.y),(a,bb)=>a===x&&bb===y);if(p){player.path=p;player.target=b?{kind:'brick',x,y}:null;}
});
const KM={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
window.addEventListener('keydown',e=>{
  if(sheetOpen){if(e.key==='Escape'&&!$('patBtn'))closeSheet();return;}
  if(KM[e.key]){e.preventDefault();if(kb!==KM[e.key]){kb=KM[e.key];player.target=null;if(!player.path.length){step(kb);kbT=.18;}}return;}
  if(e.key==='e'||e.key==='E'||e.key===' '){e.preventDefault();const px=Math.round(player.x),py=Math.round(player.y);
    const n=allPeople().find(p=>adjTo(px,py,p.x,p.y));if(n){interact({kind:'npc',n});return;}
    for(const k in BLD)if(adjBld(BLD[k],px,py)){interact({kind:'bld',key:k});return;}}
});
window.addEventListener('keyup',e=>{if(KM[e.key]&&kb===KM[e.key])kb=null;});
window.addEventListener('resize',resize);
resize();renderUI();requestAnimationFrame(frame);toast.t=setTimeout(()=>$('toast').style.opacity=0,7000);
if(S.done)toast('歡迎回到三明治鎮。點生菜小姐可以再看一次收集。');
else if(S.helped.length)toast(`歡迎回來！你已經幫了 ${S.helped.length} 位居民，背包也都還在。`);
if(location.hash==='#book')album();
// 給自動測試用
window.__town={Z,NPCS,get S(){return S},G,interact,lesson,album,result,goTo};
})();
