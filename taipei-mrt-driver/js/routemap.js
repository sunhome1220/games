'use strict';
// 路線圖：整條路線的站、站體（高架／地下／平面）、限速區間與目前位置，可左右滑動；預設跟隨列車。
// 限速區間是遊戲依站距產生的設定（g.zones），不是北捷實際的限速資料。
const RM_PX=0.07;                                     // 每公尺 0.07 像素（1 公里 = 70 像素）
const RM_ENV={elev:['#f0a64a','高架'],tunnel:['#4a8fe0','地下'],grade:['#5bbf6a','平面']};
let RM={on:false,g:null,t:0,user:0,w:0,mk:null,past:null};
const svgEl=(n,a,t)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',n);for(const k in a)e.setAttribute(k,a[k]);if(t!=null)e.textContent=t;return e;};
// 下一個限速變化：回傳 {kind:'in'|'ahead', lim, d}（d 為距離，公尺），沒有則 null
function nextLimit(g){
  let best=null;
  for(const z of g.zones){
    if(g.pos>z.s1)continue;
    if(g.pos>=z.s0)return {kind:'in',lim:z.lim,d:z.s1-g.pos};
    const d=z.s0-g.pos;if(!best||d<best.d)best={kind:'ahead',lim:z.lim,d};
  }
  return best;
}
function nextLimitText(g){
  const n=nextLimit(g);if(!n||n.d>2500)return '';
  const m=Math.max(0,Math.round(n.d/10)*10);
  return n.kind==='in'?`限速 ${n.lim} 區間，還有 ${m} m`:`前方 ${m} m 降為 ${n.lim} km/h`;
}
function rmBuild(g){
  const box=document.getElementById('rmap-in');if(!box)return;
  box.innerHTML='';RM.g=g;
  const total=g.S[g.S.length-1],w=Math.ceil((total+400)*RM_PX)+80,H=116,ox=40,ly=46;
  const sv=svgEl('svg',{width:w,height:H,viewBox:`0 0 ${w} ${H}`});
  const X=m=>ox+m*RM_PX;
  // 站體底線（以站間中點分段）
  g.sec.forEach((s,i)=>{
    const a=Math.max(s.a,0),b=Math.min(s.b,total),c=(RM_ENV[s.env]||RM_ENV.grade)[0];
    if(b>a)sv.appendChild(svgEl('rect',{x:X(a),y:ly-3,width:Math.max(1,(b-a)*RM_PX),height:6,fill:c,rx:2}));
  });
  // 限速區間
  g.zones.forEach(z=>{
    sv.appendChild(svgEl('rect',{x:X(z.s0),y:8,width:Math.max(4,(z.s1-z.s0)*RM_PX),height:16,fill:'#d32f2f',rx:3,opacity:.9}));
    sv.appendChild(svgEl('text',{x:X(z.s0)+Math.max(4,(z.s1-z.s0)*RM_PX)/2,y:20,'text-anchor':'middle','font-size':12,'font-weight':800,fill:'#fff'},String(z.lim)));
  });
  // 車站
  g.stations.forEach((s,i)=>{
    const x=X(g.S[i]);
    sv.appendChild(svgEl('circle',{cx:x,cy:ly,r:5,fill:'#10151e',stroke:'#fff','stroke-width':1.6}));
    sv.appendChild(svgEl('text',{x:x+2,y:ly+14,'font-size':12,fill:'#dfe7f3',transform:`rotate(55 ${x+2} ${ly+14})`},s.name));
  });
  const past=svgEl('rect',{x:ox,y:0,width:0,height:H,fill:'#000',opacity:.38});sv.appendChild(past);
  const mk=svgEl('path',{d:'M0 28 L-7 38 L7 38 Z',fill:'#ffd37a',stroke:'#10151e','stroke-width':1});sv.appendChild(mk);
  box.appendChild(sv);RM.past=past;RM.mk=mk;RM.w=w;RM.ox=ox;
  document.getElementById('rmap').hidden=!RM.on;
  rmUpdate(g,true);
}
function rmUpdate(g,force){
  if(!RM.on||g!==RM.g||!RM.mk)return;
  const now=performance.now();if(!force&&now-RM.t<200)return;RM.t=now;
  const x=RM.ox+Math.max(0,g.pos)*RM_PX;
  RM.mk.setAttribute('transform',`translate(${x} 0)`);
  RM.past.setAttribute('width',Math.max(0,x-RM.ox));
  const sc=document.getElementById('rmap-in');
  if(now-RM.user>4000)sc.scrollLeft=x-sc.clientWidth*0.3;       // 玩家剛滑過地圖時暫停跟隨
  const t=document.getElementById('rmap-now');if(t)t.textContent=nextLimitText(g)||'前方沒有降速區間';
}
function rmToggle(){
  RM.on=!RM.on;const el=document.getElementById('rmap');el.hidden=!RM.on;
  document.getElementById('b-map').classList.toggle('on',RM.on);
  if(RM.on&&RM.g)rmUpdate(RM.g,true);
}
function rmHide(){RM.on=false;RM.g=null;const el=document.getElementById('rmap');if(el)el.hidden=true;const b=document.getElementById('b-map');if(b)b.classList.remove('on');}
function rmInit(){
  const b=document.getElementById('b-map');if(!b)return;
  b.onclick=rmToggle;
  const sc=document.getElementById('rmap-in');
  sc.addEventListener('pointerdown',()=>{RM.user=performance.now();});
  sc.addEventListener('scroll',()=>{if(RM.fromUser)RM.user=performance.now();});
  sc.addEventListener('touchmove',()=>{RM.user=performance.now();},{passive:true});
  sc.addEventListener('wheel',()=>{RM.user=performance.now();},{passive:true});
}
