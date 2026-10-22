// 序列圖卡：讀 zone 檔的 card 欄位，畫出動作順序
(async function(){
const id=document.body.dataset.zone,el=document.getElementById('card');
try{
  const [poses,z]=await Promise.all([fetch('/content/poses.json').then(r=>r.json()),fetch(`/content/zones/${id}.json`).then(r=>r.json())]);
  const P={};for(const p of poses.poses)P[p.id]=p;
  document.title=`${z.card.title}｜Sandywich`;
  el.innerHTML=`<span class="eyebrow">三明治鎮・第 ${z.order} 區</span><h1>${z.card.title}</h1><p class="sub">${z.part}・照順序做，每個動作慢慢呼吸</p>
  <ol>${z.card.steps.map((s,i)=>{const p=P[s.pose]||{};return `<li><span class="n">${i+1}</span>${SWFig.poseSvg(p.figure)}<b>${p.name||''}</b><small>${p.en||''}</small><p>${s.say}</p></li>`;}).join('')}</ol>
  <p class="brand">Sandywich Yoga</p>`;
}catch(e){el.innerHTML='<p>圖卡載入失敗，請重新整理。</p>';console.error(e);}
})();
