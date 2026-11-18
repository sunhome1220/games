'use strict';
/* 地圖繪製：地形、射程圈、艦隊資訊面板（自 render.js 拆出，內容不變；依序載入 render → render_outer → render_bases） */
function center(c,r){return [KS*(OW/FG*(c+.5*(r&1))+OX0),KS*(1.5*OR/FG*r+OY0)];}
function hexPts(x,y,rr){let p=[];for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-30);p.push((x+rr*Math.cos(a)).toFixed(1)+','+(y+rr*Math.sin(a)).toFixed(1));}return p.join(' ');}
const humanTurn=()=>S.started&&!S.over&&!S.busy&&S.ctrl[S.phase]==='human';
/* ---------- 3D map: static terrain layer + dynamic layer + effects ---------- */
const DEPTH={plain:3,city:4,port:2.5,air:2.5,mtn:7,main:2.5};
const SC=R/16; // 格子相對 20 km 格的大小（10 km＝0.5）：地形細節、圖示、字級跟著縮
const US_BIG=Math.max(R,16*.72)/26*1.18,US_SMALL=R/26*1.18; // 棋子：放大時保留原尺寸 72%（好點選）；縮小（地圖縮放 <160%）時縮到一格大、只留兵種符號
const usForZoom=z=>(FG>2&&z<1.6?US_SMALL:US_BIG)*(z>5?5/z:1); // 放大到 500% 以上時棋子在畫面上不再變大（只放大地圖）
let US=usForZoom(1); // 開局縮放 100%
const elev=h=>isLand(h)?(DEPTH[h.t]||4)*SC:0;
function cen(c,r){const [x,y]=center(c,r);return [x,y-elev(TER[K(c,r)])];}
// ---------- 第 3d 階段：射程圈與艦隊資訊面板（只顯示，不影響規則）----------
// 射程圈依直線距離畫成圓形（與「打不打得到」的 rd 判定一致：格子中心在圓內就打得到；圓多畫半格，涵蓋整個格子）
function rangePts(c,r,n){
  if(n<=0)return '';const x0=c-(r-(r&1))/2,z0=r,[cx,cy]=center(c,r),D=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]; // 立方座標 (x,z) 方向
  return D.map(([dx,dz])=>{const x=x0+dx*n,z=z0+dz*n,cc=x+(z-(z&1))/2,[px,py]=center(cc,z),f=(n+.5)/n;return (cx+(px-cx)*f).toFixed(1)+','+(cy+(py-cy)*f).toFixed(1);}).join(' ');
}
// 射程圈圖例：大圈的文字常在畫面外，另在地圖看得到的左上角列出每個圈的線型與說明
let RNG_LEG=[];
function rngLegSync(){
  let d=$('#rngLeg');if(!d){d=document.createElement('div');d.id='rngLeg';d.setAttribute('aria-live','polite');document.body.appendChild(d);}
  const sw=e=>'<svg width="30" height="12" aria-hidden="true">'+(e.cls==='ad'?'<rect class="rr ad '+e.sd+'" x="2" y="2" width="26" height="8" rx="3"/>':'<line class="rr '+e.cls+' '+e.sd+'" x1="1" y1="6" x2="29" y2="6"/>')+'</svg>';
  d.innerHTML=RNG_LEG.map(e=>'<div>'+sw(e)+'<span class="rrl '+e.sd+'">'+e.txt+'</span></div>').join('');
  if(typeof placeLoc==='function')placeLoc();
}
// 畫一個射程圈（n＝格數）並記進圖例
function rrRing(o,lbl,c,r,n,cls,sd,txt,lite){if(n<=0)return;
  const [cx,cy]=center(c,r);o.push('<circle class="rr '+cls+' '+sd+'" cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+((n+.5)*HPX).toFixed(1)+'"/>');
  if(!txt)return;if(!lite)RNG_LEG.push({cls,sd,txt});
  const [x,y]=rangeTop(c,r,n);lbl.push('<text class="rrl '+sd+'" x="'+x.toFixed(1)+'" y="'+(y-4).toFixed(1)+'" text-anchor="middle">'+txt+'</text>');
}
// 台灣空軍基地的射程圈：作戰半徑（打島上目標）、對艦打擊距離（再加空射反艦飛彈射程）、對大陸打擊距離（飛到海峽中線附近再發射萬劍彈或 SLAM-ER）
function baseRingsSVG(k){
  const h=TER[k];if(!h||typeof afWing!=='function'||!afWing(k)||S.owner[k]==='atk')return '';const o=[],lbl=[],P=S.pools||{},n=km=>km/KM_HEX-.5;
  const R=afRad(k),A=afAsm(k),cn=(P.rocSlam||0)>=AFS.pk?AFS.slam:(P.rocWC||0)>=AFS.pk?AFS.wc:null;
  rrRing(o,lbl,h.c,h.r,n(R),'r','def','戰機作戰半徑 '+kmOf(R/KM_HEX)+' km（'+afWing(k)[1]+'）');
  if(A&&(P[A.pool]||0)>=1)rrRing(o,lbl,h.c,h.r,n(R+A.km),'d','def','對艦打擊距離 '+kmOf((R+A.km)/KM_HEX)+' km（'+A.n+'）');
  if(cn){const d=Math.round(afRel(k)+cn.km);rrRing(o,lbl,h.c,h.r,n(d),'x','def','對大陸打擊距離 '+kmOf(d/KM_HEX)+' km（'+cn.n+'）');}
  return o.join('')+lbl.join('');
}
function rangeTop(c,r,n){const [cx,cy]=center(c,r);return [cx,cy-(n+.5)*HPX];}
const kmOf=n=>Math.round(n*KM_HEX).toLocaleString();
function rangeRingsSVG(u,lite){ // u：航艦或護航艦；lite＝一鍵全開時只畫防空傘與對艦打擊距離
  if(!u||!alive(u))return '';const sd=u.side,o=[],lbl=[];
  const ring=(c,r,n,cls,txt)=>rrRing(o,lbl,c,r,n,cls,sd,txt,lite);
  const grp=u.type==='cv'||u.type==='csg'||u.type==='ddh'?u:(u.grp?S.units.find(x=>x.id===u.grp&&alive(x)):null);
  if(u.type==='cv'||u.type==='csg'||u.type==='ddh'){
    const c=cvwCarriers(sd==='atk'?'atk':'def').find(x=>x.u===u);
    {const es=S.units.filter(e=>e.grp===u.id&&isEsc(e)&&alive(e)&&e.mag&&e.mag.ad>0),R=es.length?Math.max(...es.map(e=>SHIPW[e.type].adR)):0; // 防空傘：整個艦隊合成一圈（以航艦為中心、取護航艦最遠的防空射程），不再每艘各畫一圈
      if(R)ring(u.c,u.r,R,'ad',lite?'':'艦隊防空傘 '+kmOf(R)+' km');}
    if(c){if(!lite)ring(u.c,u.r,c.w.r,'r','艦載機作戰半徑 '+kmOf(c.w.r)+' km');
      if((u.wmag||0)>0)ring(u.c,u.r,c.w.r+c.w.asmR,'d','對艦打擊距離 '+kmOf(c.w.r+c.w.asmR)+' km（'+c.nm+'）');}
    if(lite){const [x,y]=rangeTop(u.c,u.r,Math.max(...S.units.filter(e=>e.grp===u.id&&isEsc(e)&&alive(e)).map(e=>SHIPW[e.type].adR),kmH(40)));lbl.push('<text class="rrl '+sd+'" x="'+x.toFixed(1)+'" y="'+(y-4).toFixed(1)+'" text-anchor="middle">防空傘</text>');}
  }else if(u.fl){ // 台灣艦隊：艦隊防空與艦射反艦飛彈（取艦隊中最遠的射程）
    const A=fleetAgg(u),W=u.fl.m.filter(([k,n])=>n>0&&RFW[k].asm>0&&RFW[k].asmR===A.asmR).map(([k])=>RFW[k].w)[0]||'反艦飛彈';
    if(A.adR&&(!u.mag||u.mag.ad>0))ring(u.c,u.r,A.adR,'ad','艦隊防空 '+kmOf(A.adR)+' km');
    if(A.asmR&&(!u.mag||u.mag.asm>0))ring(u.c,u.r,A.asmR,'r',W+' '+kmOf(A.asmR)+' km');
  }else if(u.type==='sam'){ // 防空飛彈營：彈道飛彈防禦範圍、對飛機範圍
    const Y=samSys(u);if(Y.bmR&&samMag(u)>0)ring(u.c,u.r,kmH(Y.bmR),'ad',lite?'':'彈道飛彈防禦 '+Y.bmR+' km');
    if(!lite)ring(u.c,u.r,kmH(Y.acR),'r','對飛機 '+Y.acR+' km');
  }else if(u.type==='dd'){ // 共軍護航艦棋子（052D＋054A）：防空
    ring(u.c,u.r,DDW.adR,'ad','防空 '+kmOf(DDW.adR)+' km');
  }else if(isEsc(u)){
    const W=SHIPW[u.type];if(u.mag&&u.mag.ad>0)ring(u.c,u.r,W.adR,'ad','防空 '+kmOf(W.adR)+' km');
    if(u.mag&&u.mag.asm>0)ring(u.c,u.r,W.asmR,'r',W.asmN+' '+kmOf(W.asmR)+' km');
  }
  return o.join('')+lbl.join('');
}
// 艦隊面板：航艦、艦載機、護航艦飛彈存量，以及目前在對方哪些武器的射程內
function fleetPanelHTML(u){
  if(!u||!(u.type==='cv'||u.type==='csg'||u.type==='ddh'))return '';
  const sd=u.side,en=sd==='atk'?'def':'atk',c=cvwCarriers(sd==='atk'?'atk':'def').find(x=>x.u===u),sp=c?(sd==='atk'?cvwA(c.i):S.cvwA&&S.cvwA.def&&S.cvwA.def[c.ui]):null;
  const es=S.units.filter(e=>e.grp===u.id&&isEsc(e)&&alive(e));
  let h='<table class="fltab"><tr><th>艦</th><th>'+(plainT()?'戰力':'步數')+'</th><th>防空</th><th>反艦</th><th>對地</th></tr>';
  h+='<tr><td><b>'+(c&&c.i>=0?AIR.CV[c.i].n:c?c.n:TYPES[u.type].s)+'</b></td><td>'+(plainT()?pctU(u)+'%':u.hp+'/'+TYPES[u.type].hp)+'</td><td>—</td><td>'+(c?Math.max(0,u.wmag||0):'—')+'</td><td>—</td></tr>';
  es.forEach(e=>{h+='<tr><td>'+TYPES[e.type].s+'</td><td>'+e.hp+'/'+TYPES[e.type].hp+'</td><td>'+e.mag.ad+'</td><td>'+e.mag.asm+'</td><td>'+(e.mag.lam||0)+'</td></tr>';});
  h+='</table>';
  if(c&&S.air){const nAir=c.i<0?S.air.usF[c.ui]:S.air.cvF[c.i];h+='<div class="hint">艦載機 '+Math.round(nAir)+' 架、每回合約 '+Math.round(c.sor)+' 架次'+(sp?'；任務：制空 '+Math.round(sp[0]*100)+'%、對艦 '+Math.round(sp[1]*100)+'%、對地 '+Math.round(sp[2]*100)+'%':'')+'</div>';}
  // 威脅：對方艦射反艦飛彈、艦載機、岸置飛彈、反艦彈道飛彈
  const me=hexOf(u),th=[];
  const near=(arr,R,nm)=>{if(!arr.length)return;const d=Math.min(...arr.map(e=>rd(hexOf(e),me)));th.push(d<=R?'<li class="in">在'+nm+'射程內（距離約 '+kmOf(d)+' km／射程 '+kmOf(R)+' km）</li>':'<li class="out">'+nm+'：還差約 '+kmOf(d-R)+' km 才進入射程</li>');};
  const types=[...new Set(S.units.filter(e=>e.side===en&&isEsc(e)&&alive(e)&&e.mag&&e.mag.asm>0).map(e=>e.type))];
  types.forEach(t=>near(S.units.filter(e=>e.side===en&&e.type===t&&alive(e)&&e.mag&&e.mag.asm>0),SHIPW[t].asmR,TYPES[t].s+' '+SHIPW[t].asmN));
  cvwCarriers(en==='atk'?'atk':'def').forEach(k=>{if((k.u.wmag||0)>0)near([k.u],k.w.r+k.w.asmR,(k.i>=0?AIR.CV[k.i].n:'美航艦')+'艦載機（'+k.nm+'）');});
  if(sd==='atk'){const ssm=S.units.filter(e=>e.side==='def'&&e.type==='ssm'&&alive(e)&&!subHidden(e));if(ssm.length)near(ssm,kmH(160),'守方岸置反艦飛彈');}
  if(sd==='atk'&&atSea(u)&&typeof afUsable==='function'&&S.pools&&((S.pools.rocAAsh||0)>0||(S.pools.rocHf2A||0)>0)){ // 台灣空軍空射反艦飛彈：打得到這艘船的基地與預估
    const bs=afUsable().filter(h=>afCanHit(h.k,{u}));
    if(bs.length){const nb=bs.reduce((a,h)=>a+afBudget(h.k),0),nr=bs.slice().sort((a,b)=>afDist(a.k,u)-afDist(b.k,u))[0],pc=afCapP(u);
      th.push('<li class="in">在台灣空軍空射反艦飛彈範圍內：'+bs.length+' 座基地打得到（最近 '+(nr.name||'基地')+' 約 '+afDist(nr.k,u)+' km）'+(S.phase==='def'?'，本階段還能出擊約 '+nb+' 批（每批 4 枚）':'')+(pc?'；共軍艦載機攔截約 '+Math.round(pc*100)+'%':'')+'（推估）</li>');}
    else th.push('<li class="out">台灣空軍空射反艦飛彈：目前沒有基地打得到（距離超出作戰半徑或基地無法起降）</li>');}
  if(u.type==='csg'&&S.pools&&S.pools.plaLR>0)th.push('<li class="in">在東風-21D／26 反艦彈道飛彈範圍內（存量 '+fmt1(S.pools.plaLR)+'）</li>');
  h+=th.length?'<div class="hint"><b>威脅</b></div><ul class="flthr">'+th.join('')+'</ul>':'<div class="hint">目前沒有已知的對方反艦武器在附近。</div>';
  if(humanTurn()&&cvOwn(u)&&u.side===S.phase&&S.units.includes(u)){ // 玩家操作該方：航艦命令
    const vt=volleyTargets(u),vs=volleyShooters(u),I=cvwManualInfo(u);
    h+='<div class="cvord"><button class="ghost" id="btnVolley"'+(vt.length?'':' disabled')+'>艦隊齊射<small class="pn">（'+vs.length+' 艘可射、射程內目標 '+vt.length+'）</small></button>'+
      '<button class="ghost" id="btnCvw"'+(I&&I.n>0&&I.foes.length?'':' disabled')+'>艦載機對艦<small class="pn">（本回合份額 '+(I?I.n:0)+' 枚'+(I&&I.n>0&&!I.foes.length?'，打擊距離內沒有目標':'')+'）</small></button>'+
      (()=>{const L=cvwManualLandInfo(u);return '<button class="ghost" id="btnCvwL"'+(L&&L.n>0&&L.tg.length?'':' disabled')+'>艦載機對地<small class="pn">（本回合份額 '+(L?L.n:0)+' 次、可打 '+(L?L.tg.length:0)+' 處'+(L&&L.n>0&&!L.tg.length?'，作戰半徑內沒有目標':'')+'）</small></button>';})()+'</div>'+
      '<div class="hint">按下後點選地圖上打得到的目標（橘圈；對地也可以點機場）。沒用完的艦載機份額會在結束階段時自動出擊。</div>';
  }
  return h;
}
let RNG_ALL=false;try{RNG_ALL=localStorage.getItem('tsl-rng')==='1';}catch(e){}
// 台澎海岸線（沿陸地格靠海的邊，和凸起的地塊對齊）、主要河流（★依河口與主要經過點手繪的近似線，誤差約 5～10 km，只是地圖標示、不影響規則）、玉山
const RIVERS=[['淡水河',[[121.41,25.18],[121.46,25.12],[121.49,25.06],[121.46,25.01],[121.40,24.95],[121.33,24.88]]],
  ['頭前溪',[[120.93,24.85],[121.00,24.82],[121.07,24.80],[121.13,24.77]]],
  ['大安溪',[[120.60,24.41],[120.68,24.38],[120.77,24.36],[120.86,24.37]]],
  ['大甲溪',[[120.56,24.29],[120.65,24.27],[120.73,24.25],[120.82,24.23]]],
  ['大肚溪',[[120.48,24.13],[120.57,24.11],[120.65,24.07],[120.73,24.03],[120.80,24.02]]],
  ['濁水溪',[[120.21,23.83],[120.33,23.83],[120.46,23.82],[120.58,23.81],[120.66,23.82],[120.75,23.83]]],
  ['曾文溪',[[120.06,23.04],[120.17,23.10],[120.28,23.15],[120.38,23.18],[120.47,23.20]]],
  ['高屏溪',[[120.42,22.48],[120.44,22.58],[120.46,22.68],[120.50,22.78],[120.55,22.88]]],
  ['蘭陽溪',[[121.85,24.71],[121.78,24.70],[121.70,24.67],[121.62,24.62]]],
  ['秀姑巒溪',[[121.51,23.47],[121.45,23.49],[121.40,23.43],[121.36,23.33],[121.30,23.20]]],
  ['卑南溪',[[121.16,22.77],[121.13,22.83],[121.15,22.93],[121.20,23.03],[121.23,23.12]]]];
// 河流：平滑曲線（Catmull-Rom 轉貝茲），上游細、河口粗；底下一層淺色河岸，和凸起的地塊風格一致
// 支流與主流交會：支流第 0 點（匯流點）貼到主流「實際畫出的曲線」上（平滑曲線不一定經過手畫的控制點，直接用座標會留縫）
function rvSample(pts,k){const n=pts.length,P=i=>pts[Math.max(0,Math.min(n-1,i))],out=[];
  for(let i=0;i<n-1;i++){const p0=P(i-1),p1=P(i),p2=P(i+1),p3=P(i+2),c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6],c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];
    for(let t=0;t<k;t++){const u=t/k,a=(1-u)**3,b=3*u*(1-u)**2,c=3*u*u*(1-u),d=u**3;out.push([a*p1[0]+b*c1[0]+c*c2[0]+d*p2[0],a*p1[1]+b*c1[1]+c*c2[1]+d*p2[1]]);}}
  out.push(pts[n-1]);return out;}
function joinTrunk(pts,trunks,maxd){ // trunks：一條或多條主流的點列；回傳是否接上
  let best=null,bd=maxd*maxd;const q=pts[0];
  for(const T of trunks){const S=rvSample(T,16);for(let i=0;i<S.length-1;i++){const a=S[i],b=S[i+1],dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/L)):0,x=a[0]+t*dx,y=a[1]+t*dy,d=(x-q[0])**2+(y-q[1])**2;if(d<bd){bd=d;best=[x,y];}}}
  if(best)pts[0]=best;return !!best;}
function riverSVG(pts,w0,w1){ // w0＝河口（第 0 點）寬度、w1＝源頭寬度
  w0=w0||2.8;w1=w1||.7;const n=pts.length;if(n<2)return '';let bank='',water='';
  const P=i=>pts[Math.max(0,Math.min(n-1,i))],f=v=>v.toFixed(1);
  for(let i=0;i<n-1;i++){ // 每段各自一條路徑，寬度從河口（第 0 點）往上游遞減
    const p0=P(i-1),p1=P(i),p2=P(i+1),p3=P(i+2);
    const c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6],c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];
    const d='M'+f(p1[0])+' '+f(p1[1])+'C'+f(c1[0])+' '+f(c1[1])+' '+f(c2[0])+' '+f(c2[1])+' '+f(p2[0])+' '+f(p2[1]),w=(w1+(w0-w1)*(1-(i+.5)/(n-1)))*Math.max(.8,SC);
    bank+='<path class="rvb" d="'+d+'" stroke-width="'+(w+1.8).toFixed(2)+'"/>';water+='<path class="river" d="'+d+'" stroke-width="'+w.toFixed(2)+'"/>';
  }
  return bank+water;
}
// ★主要支流（每條河最多 2 條；依匯流點與主要經過點手繪的近似線，第 0 點是匯流點）
const TRIBS=[['淡水河','基隆河',[[121.465,25.115],[121.52,25.085],[121.57,25.08],[121.62,25.06],[121.67,25.08],[121.73,25.05]]],
  ['淡水河','新店溪',[[121.49,25.03],[121.52,25.00],[121.54,24.96],[121.55,24.90]]],
  ['頭前溪','上坪溪',[[121.08,24.78],[121.09,24.72],[121.10,24.66]]],['頭前溪','油羅溪',[[121.08,24.78],[121.13,24.75],[121.18,24.72]]],
  ['大肚溪','大里溪',[[120.62,24.10],[120.68,24.11],[120.72,24.14]]],['大肚溪','貓羅溪',[[120.60,24.09],[120.64,24.02],[120.68,23.94]]],
  ['濁水溪','清水溪',[[120.60,23.81],[120.66,23.74],[120.70,23.66]]],['曾文溪','菜寮溪',[[120.38,23.17],[120.40,23.23],[120.43,23.28]]],
  ['高屏溪','荖濃溪',[[120.55,22.88],[120.61,22.97],[120.67,23.07]]],['高屏溪','旗山溪',[[120.53,22.87],[120.48,22.95],[120.50,23.05]]],
  ['蘭陽溪','宜蘭河',[[121.83,24.71],[121.77,24.74],[121.72,24.77]]],['卑南溪','鹿野溪',[[121.15,22.90],[121.10,22.94],[121.03,22.97]]]];
// 陸地格靠海的邊（和海岸線同一套判定）：回傳凸起地塊頂面上的 [a,b] 端點
function seaEdges(h){const out=[],[x,y0]=center(h.c,h.r),y=y0-elev(h),v=hexV(x,y,R),nb=nbrs(h.c,h.r).filter(Boolean).map(n=>[n,center(n.c,n.r)]);
  for(let i=0;i<6;i++){const a=v[i],b=v[(i+1)%6],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2+elev(h),px=x+2*(mx-x),py=y0+2*(my-y0);let best=null,bd=1e9;for(const [n,c] of nb){const dd=(c[0]-px)**2+(c[1]-py)**2;if(dd<bd){bd=dd;best=n;}}
    if(!best||bd>R*R||!isLand(best))out.push([a,b]);}return out;}
// 河口對齊：取河口附近的台灣海岸格，找它靠海、最接近河口的那條邊，河口點放在邊的中點（不超出、也不縮在陸地裡）
let RVCOAST=null;
function mouthPt(lo,la,raw){if(!RVCOAST)RVCOAST=Object.values(TER).filter(h=>h.isl==='TW'&&isLand(h)&&seaEdges(h).length);let best=null,bd=1e9;
  for(const h of RVCOAST)for(const [a,b] of seaEdges(h)){const m=[(a[0]+b[0])/2,(a[1]+b[1])/2],d=(m[0]-raw[0])**2+(m[1]-raw[1])**2;if(d<bd){bd=d;best=m;}}return best||raw;}
// 外圍（大陸）河流的河口對齊：先去掉落在海格上的開頭幾點，再把河口點放在最近海岸格「靠海那條邊」的中點（不超出海岸、也不留縫）
let OFINE=null; // buildFar 建好的外圍細格（Map）
const HNBR=(c,r)=>((r&1)?[[1,0],[1,1],[0,1],[-1,0],[0,-1],[1,-1]]:[[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]]).map(([a,b])=>[c+a,r+b]); // 第 k 邊朝向 60k 度，和 hexV 的頂點順序一致
function cellLand(c,r){const h=TER[K(c,r)];if(h)return isLand(h);const f=OFINE&&OFINE.get(K(c,r));return !!f&&f.t!=='sea';}
function outerRiverPts(P,toPx,sea){
  let i=0;if(sea)while(i<P.length-2){const [c,r]=llToRC(P[i][0],P[i][1]);if(cellLand(c,r))break;i++;}
  const Q=P.slice(i),pts=Q.map(toPx);if(!sea)return pts;
  const [c0,r0]=llToRC(Q[0][0],Q[0][1]);let best=null,bd=1e18;
  for(let dr=-12;dr<=12;dr++)for(let dc=-12;dc<=12;dc++){const c=c0+dc,r=r0+dr;if(!cellLand(c,r))continue;
    const h=TER[K(c,r)],[x,y0]=center(c,r),v=hexV(x,y0-(h?elev(h):0),R),nb=HNBR(c,r);
    for(let k=0;k<6;k++){if(cellLand(nb[k][0],nb[k][1]))continue;const m=[(v[k][0]+v[(k+1)%6][0])/2,(v[k][1]+v[(k+1)%6][1])/2],d=(m[0]-pts[0][0])**2+(m[1]-pts[0][1])**2;if(d<bd){bd=d;best=m;}}}
  if(best){if(bd<(R*1.5)**2)pts[0]=best;else pts.unshift(best);} // 離海岸很近就把河口移到邊上；還有一段距離（資料只到市區附近）就延伸一段到海岸
  return pts;}
function coastRiverSVG(land){
  let o='',d='';
  for(const h of land){if(h.isl!=='TW'&&h.isl!=='PH')continue;if(h.elev!=null&&h.elev>=150||h.t==='mtn'||h.cliff)continue; /* 只在低平的海岸畫線（西岸平地和淺海顏色接近）；東岸山地、斷崖本來就分得很清楚 */const [x,y0]=center(h.c,h.r),y=y0-elev(h),v=hexV(x,y,R);
    const nb=nbrs(h.c,h.r).filter(Boolean).map(n=>[n,center(n.c,n.r)]);
    for(let i=0;i<6;i++){const a=v[i],b=v[(i+1)%6],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2+elev(h),px=x+2*(mx-x),py=y0+2*(my-y0);
      let best=null,bd=1e9;for(const [n,c] of nb){const dd=(c[0]-px)**2+(c[1]-py)**2;if(dd<bd){bd=dd;best=n;}}
      if(!best||bd>R*R||!isLand(best))d+='M'+a[0].toFixed(1)+' '+a[1].toFixed(1)+'L'+b[0].toFixed(1)+' '+b[1].toFixed(1);}}
  if(d)o+='<path class="coast" d="'+d+'"/>';
  const lift=(lo,la)=>{const [c,r]=llToRC(lo,la),h=TER[K(c,r)];return h?elev(h):0;};
  const toPx=([lo,la])=>{const [x,y]=llPx(lo,la);return [x,y-lift(lo,la)];};
  const TRUNK={};for(const [n,P] of RIVERS){const pts=P.map(toPx);pts[0]=mouthPt(P[0][0],P[0][1],pts[0]);TRUNK[n]=pts;} // 河口對齊海岸格的邊
  for(const [p,n,P] of TRIBS){const pts=P.map(toPx);if(TRUNK[p])joinTrunk(pts,[TRUNK[p]],R*6);o+=riverSVG(pts,1.5,.5);const m=pts[Math.min(pts.length-1,2)];o+='<text class="lbl rvl rvt" font-size="'+(4.8*Math.max(.72,SC)).toFixed(1)+'" x="'+m[0].toFixed(1)+'" y="'+(m[1]-2).toFixed(1)+'" text-anchor="middle">'+n+'</text>';}
  for(const [n,P] of RIVERS){const pts=TRUNK[n];
    o+=riverSVG(pts);
    const m=pts[Math.min(pts.length-1,2)];o+='<text class="lbl rvl" font-size="'+(5.6*Math.max(.72,SC)).toFixed(1)+'" x="'+m[0].toFixed(1)+'" y="'+(m[1]-3).toFixed(1)+'" text-anchor="middle">'+n+'</text>';}
  if(typeof OUTER_LAKES!=='undefined'){ // 大陸的河流與湖泊（只是背景，不影響規則；真實資料見 js/data/outer.js）
    for(const [n,L] of OUTER_LAKES){const pp=L.map(toPx);o+='<path class="lake" d="M'+pp.map(q=>q.map(v=>v.toFixed(1)).join(' ')).join('L')+'Z"/>';
      if(n&&pp.length>8){const cx=pp.reduce((a,q)=>a+q[0],0)/pp.length,cy=pp.reduce((a,q)=>a+q[1],0)/pp.length;o+='<text class="lbl rvl" font-size="'+(5.6*Math.max(.72,SC)).toFixed(1)+'" x="'+cx.toFixed(1)+'" y="'+cy.toFixed(1)+'" text-anchor="middle">'+n+'</text>';}}
    const ORV=OUTER_RIVERS.map(([n,P,sea])=>[n,outerRiverPts(P,toPx,sea)]),OPAR={'漢江':'長江'}; // 漢江在武漢匯入長江
    for(const [n,pts] of ORV){const par=OPAR[n];if(par&&pts.length>1)joinTrunk(pts,ORV.filter(r=>r[0]===par).map(r=>r[1]),R*8);}
    for(const [n,pts] of ORV){if(pts.length<2)continue;o+=riverSVG(pts,n==='長江'?3.6:2,.6);
      if(pts.length>6&&n!=='贛江'&&n!=='卡加延河'){const m=pts[Math.floor(pts.length/3)];o+='<text class="lbl rvl" font-size="'+(5.6*Math.max(.72,SC)).toFixed(1)+'" x="'+m[0].toFixed(1)+'" y="'+(m[1]-3).toFixed(1)+'" text-anchor="middle">'+n+'</text>';}}}
  {const [c,r]=llToRC(120.957,23.470),h=TER[K(c,r)];if(h){const [x,y0]=center(h.c,h.r),y=y0-elev(h); // 玉山：和其他地名一樣放在所在格的中心上方（不用小數座標，放大到 500% 以上時才不會跑位）
    o+='<text class="lbl peak" font-size="'+(8.5*Math.max(.72,SC)).toFixed(1)+'" x="'+x.toFixed(1)+'" y="'+(FG>2?y-R*1.2:y-11).toFixed(1)+'">▲玉山</text>';}}
  return o;
}
function hexV(x,y,rr){const o=[];for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-30);o.push([x+rr*Math.cos(a),y+rr*Math.sin(a)]);}return o;}
// 給手把程式用：遊戲格的中心（地圖座標）、由地圖座標找最近的格子、相鄰格
window.TSL_HEX={R,c2p:(c,r)=>center(c,r),ok:(c,r)=>!!TER[K(c,r)],nb:(c,r)=>nbrs(c,r).map(h=>[h.c,h.r]),
  p2c:(px,py)=>{const r0=Math.round((py/KS-OY0)/(1.5*OR/FG));let best=null,bd=1e18;for(let r=r0-1;r<=r0+1;r++){const c0=Math.round((px/KS-OX0)/(OW/FG)-.5*(r&1));for(let c=c0-1;c<=c0+1;c++){const [x,y]=center(c,r),d=(x-px)*(x-px)+(y-py)*(y-py);if(d<bd){bd=d;best=[c,r];}}}return best;}};
const ptsStr=v=>v.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
const STATIC={built:false};
const ANIM={pos:new Map(),gid:null,ok:true};
function tileGrad(id,v,fb){return '<linearGradient id="'+id+'" x1=".1" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="'+fb+'" style="stop-color:color-mix(in srgb,var(--'+
    v+') 76%,#fff)"/><stop offset="1" stop-color="'+fb+'" style="stop-color:color-mix(in srgb,var(--'+v+') 93%,#000)"/></linearGradient>';
  }
function bldg(cx,cy,w,hh){ // small isometric building: front, right side, roof
  const d=w*.45;
  return '<g class="bd"><polygon class="bf" points="'+[cx-w/2,cy,cx+w/2,cy,cx+w/2,cy-hh,cx-w/2,cy-hh].join(',')+'"/>'+
    '<polygon class="bs" points="'+[cx+w/2,cy,cx+w/2+d,cy-d*.6,cx+w/2+d,cy-hh-d*.6,cx+w/2,cy-hh].join(',')+'"/>'+
    '<polygon class="br" points="'+[cx-w/2,cy-hh,cx+w/2,cy-hh,cx+w/2+d,cy-hh-d*.6,cx-w/2+d,cy-hh-d*.6].join(',')+'"/></g>';
}
function peak(px,py,w,h){
  return '<polygon class="pkL" points="'+[px,py-h,px-w/2,py,px+w*.12,py+w*.16].join(',')+'"/>'+
    '<polygon class="pkR" points="'+[px,py-h,px+w*.12,py+w*.16,px+w/2,py].join(',')+'"/>'+
    '<polygon class="pkS" points="'+[px,py-h,px-w*.14,py-h+h*.28,px+w*.02,py-h+h*.2,px+w*.13,py-h+h*.3].join(',')+'"/>';
}
function tileDetail(h,x,y){const o=tileDetail0(h,x,y);return o?'<g transform="translate('+x+' '+y+') scale('+(.6*SC).toFixed(3)+') translate('+(-x)+' '+(-y)+')">'+o+'</g>':'';}
function tileDetail0(h,x,y){
  const tt=h.t==='main'&&h.vt?h.vt:h.t;
  if(FG>2&&h.vt&&(tt==='mtn'||tt==='hill')&&((h.c+h.r)&1))return ''; // 細格時大陸山地與丘陵隔格才畫，避免過密
  if(tt==='hill')return peak(x-3,y+9,20,12)+peak(x+9,y+10,13,8);
  if(tt==='city')return bldg(x-9,y+7,8,11)+bldg(x+2,y+8,9,16)+bldg(x+11,y+5,7,9);
  if(h.town)return bldg(x-8,y+6,7,5)+bldg(x+5,y+9,8,7); // 城鎮：兩棟低矮房屋
  if(tt==='mtn'&&h.elev!=null)return h.elev>=2000&&((h.c+h.r)&1)===0?peak(x,y+9,20,17):''; // 台澎：顏色表示高度，只在 2,000 公尺以上隔格畫一座小山
  if(tt==='mtn')return peak(x-6,y+8,24,22)+peak(x+9,y+10,17,14);
  if(h.t==='port')return '<rect class="pier" x="'+(x-3)+'" y="'+(y+3)+'" width="6" height="14" rx="1"/><rect class="cont c1" x="'+(x-12)+'" y="'+(y+2)+'" width="8" height="5"/><rect class="cont c2" x="'+
      (x+5)+'" y="'+(y+6)+'" width="8" height="5"/><path class="crane" d="M'+(x+9)+' '+(y+4)+'V'+(y-10)+'H'+(x-2)+'"/>';
  if(h.t==='air')return '<polygon class="rwy" points="'+[x-15,y+2,x+13,y-4,x+15,y,x-13,y+6].join(',')+'"/><path class="rwl" d="M'+(x-11)+' '+(y+3)+'L'+(x+11)+' '+(y-2)+'"/>';
  return '';
}
