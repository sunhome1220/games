'use strict';
// 路線圖：整條路線的站、站體（高架／地下／平面）、限速區間與目前位置，可左右滑動；預設跟隨列車。
// 彎道與平面形狀來自 OpenStreetMap 的真實軌道幾何（© OpenStreetMap contributors，ODbL）；彎道限速是依半徑推估（√(1.0 m/s²×半徑)），不是北捷公布的限速。
const RM_PX=0.1;                                      // 每公尺 0.1 像素（1 公里 = 100 像素）
const RM_ENV={elev:['#f0a64a','高架'],tunnel:['#4a8fe0','地下'],grade:['#5bbf6a','平面']};
let RM={on:false,g:null,t:0,user:0,w:0,mk:null,past:null};
const svgEl=(n,a,t)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',n);for(const k in a)e.setAttribute(k,a[k]);if(t!=null)e.textContent=t;return e;};
// 下一個限速變化：回傳 {kind:'in'|'ahead', lim, d}（d 為距離，公尺），沒有則 null
function nextLimit(g){
  let best=null;
  for(const z of g.zones){
    if(g.pos>z.s1)continue;
    if(g.pos>=z.s0)return {kind:'in',lim:z.lim,d:z.s1-g.pos,R:z.R,dir:z.dir};
    const d=z.s0-g.pos;if(!best||d<best.d)best={kind:'ahead',lim:z.lim,d,R:z.R,dir:z.dir};
  }
  return best;
}
function nextLimitText(g){
  const n=nextLimit(g);if(!n||n.d>2500)return '';
  const m=Math.max(0,Math.round(n.d/10)*10);
  const cv=n.R?`${n.dir==='L'?'左':'右'}彎 R${n.R}　`:'';
  return n.kind==='in'?`${cv}限速 ${n.lim}，還有 ${m} m`:`前方 ${m} m ${cv}降為 ${n.lim} km/h`;
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
  // 彎道（限速區間）：紅底、左右箭頭與推估限速；半徑寫在下方
  let prevR=-1e9,row=0;
  g.zones.forEach(z=>{
    const w=Math.max(68,(z.s1-z.s0)*RM_PX),x0=X(z.s0);
    row=x0<prevR+2?1-row:0;prevR=Math.max(x0+w,row?prevR:0)||x0+w;if(!row)prevR=x0+w;     // 連續彎道（S 形）錯開成兩列，標籤才不會疊在一起
    const y=row?24:4;
    sv.appendChild(svgEl('rect',{x:x0,y,width:w,height:18,fill:row?'#b3261e':'#d32f2f',rx:3,opacity:.94}));
    sv.appendChild(svgEl('text',{x:x0+w/2,y:y+13,'text-anchor':'middle','font-size':11,'font-weight':800,fill:'#fff'},(z.dir==='L'?'◀':'▶')+z.lim+' R'+z.R));
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
  planBuild(g);rmUpdate(g,true);
}
// 平面形狀圖：整條路線的真實形狀（淺色）、本班行駛範圍（亮色）、前方彎道（紅色）、目前位置（黃點）
const PLAN={W:112,H:112,pad:8};
function planXY(g,pos){   // 本班里程 → 形狀點的內插位置（公尺，東／北）
  const L=g.L,sh=L.shape;if(!sh)return null;
  const C0=L.d.slice(0,g.stations[0].idx).reduce((x,y)=>x+y,0);
  const line=g.stations[1]&&g.stations[1].idx<g.stations[0].idx?C0-pos:C0+pos;     // 在路線上的累計里程
  const f=Math.min(sh.length-1.001,Math.max(0,(line-(L.shapeSkip||0))/L.shapeScale/100));
  const i=Math.floor(f),t=f-i;return [sh[i][0]+(sh[i+1][0]-sh[i][0])*t,sh[i][1]+(sh[i+1][1]-sh[i][1])*t];
}
function planBuild(g){
  const box=document.getElementById('rmap-plan');if(!box)return;box.innerHTML='';
  const sh=g.L.shape;if(!sh||!sh.length)return;
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const p of sh){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
  const k=Math.min((PLAN.W-2*PLAN.pad)/Math.max(1,x1-x0),(PLAN.H-2*PLAN.pad)/Math.max(1,y1-y0));
  const ox=(PLAN.W-(x1-x0)*k)/2,oy=(PLAN.H-(y1-y0)*k)/2;
  RM.plan={k,x0,y1,ox,oy};
  const P=p=>[ox+(p[0]-x0)*k,oy+(y1-p[1])*k];     // 北在上
  const sv=svgEl('svg',{width:PLAN.W,height:PLAN.H,viewBox:`0 0 ${PLAN.W} ${PLAN.H}`});
  sv.appendChild(svgEl('polyline',{points:sh.map(p=>P(p).map(v=>v.toFixed(1)).join(',')).join(' '),fill:'none',stroke:'#4a5468','stroke-width':2.5,'stroke-linejoin':'round'}));
  const run=[],step=40;for(let s=0;s<=g.S[g.S.length-1]+step;s+=step){const q=planXY(g,Math.min(s,g.S[g.S.length-1]));if(q)run.push(P(q).map(v=>v.toFixed(1)).join(','));}
  sv.appendChild(svgEl('polyline',{points:run.join(' '),fill:'none',stroke:g.L.color,'stroke-width':3.2,'stroke-linejoin':'round'}));
  g.zones.forEach(z=>{const pts=[];for(let s=z.s0;s<=z.s1+10;s+=20){const q=planXY(g,Math.min(s,z.s1));if(q)pts.push(P(q).map(v=>v.toFixed(1)).join(','));}
    sv.appendChild(svgEl('polyline',{points:pts.join(' '),fill:'none',stroke:'#ff5a3c','stroke-width':4.5,'stroke-linecap':'round'}));});
  sv.appendChild(svgEl('text',{x:PLAN.W-6,y:12,'text-anchor':'end','font-size':10,fill:'#9fb0c8'},'N↑'));
  RM.dot=svgEl('circle',{r:4.2,fill:'#ffd37a',stroke:'#10151e','stroke-width':1.4});sv.appendChild(RM.dot);box.appendChild(sv);
}
function planUpdate(g){
  if(!RM.dot||!RM.plan)return;const q=planXY(g,Math.max(0,g.pos));if(!q)return;
  const p=RM.plan;RM.dot.setAttribute('cx',p.ox+(q[0]-p.x0)*p.k);RM.dot.setAttribute('cy',p.oy+(p.y1-q[1])*p.k);
}
function rmUpdate(g,force){
  if(!RM.on||g!==RM.g||!RM.mk)return;
  const now=performance.now();if(!force&&now-RM.t<200)return;RM.t=now;
  const x=RM.ox+Math.max(0,g.pos)*RM_PX;
  RM.mk.setAttribute('transform',`translate(${x} 0)`);
  RM.past.setAttribute('width',Math.max(0,x-RM.ox));
  planUpdate(g);
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
