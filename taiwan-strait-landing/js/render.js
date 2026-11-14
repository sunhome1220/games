'use strict';
/* ---------- rendering ---------- */
function center(c,r){return [KS*(OW/FG*(c+.5*(r&1))+OX0),KS*(1.5*OR/FG*r+OY0)];}
function hexPts(x,y,rr){let p=[];for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-30);p.push((x+rr*Math.cos(a)).toFixed(1)+','+(y+rr*Math.sin(a)).toFixed(1));}return p.join(' ');}
const humanTurn=()=>S.started&&!S.over&&!S.busy&&S.ctrl[S.phase]==='human';
/* ---------- 3D map: static terrain layer + dynamic layer + effects ---------- */
const DEPTH={plain:3,city:4,port:2.5,air:2.5,mtn:7,main:2.5};
const SC=R/16; // 格子相對 20 km 格的大小（10 km＝0.5）：地形細節、圖示、字級跟著縮
const US_BIG=Math.max(R,16*.72)/26*1.18,US_SMALL=R/26*1.18; // 棋子：放大時保留原尺寸 72%（好點選）；縮小（地圖縮放 <160%）時縮到一格大、只留兵種符號
const usForZoom=z=>FG>2&&z<1.6?US_SMALL:US_BIG;
let US=usForZoom(1); // 開局縮放 100%
const elev=h=>isLand(h)?(DEPTH[h.t]||4)*SC:0;
function cen(c,r){const [x,y]=center(c,r);return [x,y-elev(TER[K(c,r)])];}
// ---------- 第 3d 階段：射程圈與艦隊資訊面板（只顯示，不影響規則）----------
// 射程圈依直線距離畫成圓形（與「打不打得到」的 rd 判定一致：格子中心在圓內就打得到；圓多畫半格，涵蓋整個格子）
function rangePts(c,r,n){
  if(n<=0)return '';const x0=c-(r-(r&1))/2,z0=r,[cx,cy]=center(c,r),D=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]; // 立方座標 (x,z) 方向
  return D.map(([dx,dz])=>{const x=x0+dx*n,z=z0+dz*n,cc=x+(z-(z&1))/2,[px,py]=center(cc,z),f=(n+.5)/n;return (cx+(px-cx)*f).toFixed(1)+','+(cy+(py-cy)*f).toFixed(1);}).join(' ');
}
function rangeTop(c,r,n){const [cx,cy]=center(c,r);return [cx,cy-(n+.5)*HPX];}
const kmOf=n=>Math.round(n*KM_HEX).toLocaleString();
function rangeRingsSVG(u,lite){ // u：航艦或護航艦；lite＝一鍵全開時只畫防空傘與對艦打擊距離
  if(!u||!alive(u))return '';const sd=u.side,o=[],lbl=[];
  const ring=(c,r,n,cls,txt)=>{if(n<=0)return;{const [cx,cy]=center(c,r);o.push('<circle class="rr '+cls+' '+sd+'" cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+((n+.5)*HPX).toFixed(1)+'"/>');}if(txt){const [x,y]=rangeTop(c,r,n);lbl.push('<text class="rrl '+sd+'" x="'+x.toFixed(1)+'" y="'+(y-4).toFixed(1)+'" text-anchor="middle">'+txt+'</text>');}};
  const grp=u.type==='cv'||u.type==='csg'||u.type==='ddh'?u:(u.grp?S.units.find(x=>x.id===u.grp&&alive(x)):null);
  if(u.type==='cv'||u.type==='csg'||u.type==='ddh'){
    const c=cvwCarriers(sd==='atk'?'atk':'def').find(x=>x.u===u);
    S.units.filter(e=>e.grp===u.id&&isEsc(e)&&alive(e)&&e.mag&&e.mag.ad>0).forEach(e=>ring(e.c,e.r,SHIPW[e.type].adR,'ad',''));
    if(c){if(!lite)ring(u.c,u.r,c.w.r,'r','艦載機作戰半徑 '+c.w.r+' 格（'+kmOf(c.w.r)+' km）');
      if((u.wmag||0)>0)ring(u.c,u.r,c.w.r+c.w.asmR,'d','對艦打擊距離 '+(c.w.r+c.w.asmR)+' 格（'+c.nm+'）');}
    if(lite){const [x,y]=rangeTop(u.c,u.r,Math.max(...S.units.filter(e=>e.grp===u.id&&isEsc(e)&&alive(e)).map(e=>SHIPW[e.type].adR),kmH(40)));lbl.push('<text class="rrl '+sd+'" x="'+x.toFixed(1)+'" y="'+(y-4).toFixed(1)+'" text-anchor="middle">防空傘</text>');}
  }else if(isEsc(u)){
    const W=SHIPW[u.type];if(u.mag&&u.mag.ad>0)ring(u.c,u.r,W.adR,'ad','防空 '+W.adR+' 格（'+kmOf(W.adR)+' km）');
    if(u.mag&&u.mag.asm>0)ring(u.c,u.r,W.asmR,'r',W.asmN+' '+W.asmR+' 格（'+kmOf(W.asmR)+' km）');
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
  const near=(arr,R,nm)=>{if(!arr.length)return;const d=Math.min(...arr.map(e=>rd(hexOf(e),me)));th.push(d<=R?'<li class="in">在'+nm+'射程內（距離 '+d+' 格／射程 '+R+' 格）</li>':'<li class="out">'+nm+'：射程外 '+(d-R)+' 格</li>');};
  const types=[...new Set(S.units.filter(e=>e.side===en&&isEsc(e)&&alive(e)&&e.mag&&e.mag.asm>0).map(e=>e.type))];
  types.forEach(t=>near(S.units.filter(e=>e.side===en&&e.type===t&&alive(e)&&e.mag&&e.mag.asm>0),SHIPW[t].asmR,TYPES[t].s+' '+SHIPW[t].asmN));
  cvwCarriers(en==='atk'?'atk':'def').forEach(k=>{if((k.u.wmag||0)>0)near([k.u],k.w.r+k.w.asmR,(k.i>=0?AIR.CV[k.i].n:'美航艦')+'艦載機（'+k.nm+'）');});
  if(sd==='atk'){const ssm=S.units.filter(e=>e.side==='def'&&e.type==='ssm'&&alive(e)&&!subHidden(e));if(ssm.length)near(ssm,8,'守方岸置反艦飛彈');}
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
function hexV(x,y,rr){const o=[];for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-30);o.push([x+rr*Math.cos(a),y+rr*Math.sin(a)]);}return o;}
// 給手把程式用：遊戲格的中心（地圖座標）、由地圖座標找最近的格子、相鄰格
window.TSL_HEX={R,c2p:(c,r)=>center(c,r),ok:(c,r)=>!!TER[K(c,r)],nb:(c,r)=>nbrs(c,r).map(h=>[h.c,h.r]),
  p2c:(px,py)=>{const r0=Math.round((py/KS-OY0)/(1.5*OR/FG));let best=null,bd=1e18;for(let r=r0-1;r<=r0+1;r++){const c0=Math.round((px/KS-OX0)/(OW/FG)-.5*(r&1));for(let c=c0-1;c<=c0+1;c++){const [x,y]=center(c,r),d=(x-px)*(x-px)+(y-py)*(y-py);if(d<bd){bd=d;best=[c,r];}}}return best;}};
const ptsStr=v=>v.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
const STATIC={built:false};
const ANIM={pos:new Map(),gid:null,ok:true};
function tileGrad(id,v,fb){return '<linearGradient id="'+id+'" x1=".1" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="'+fb+'" style="stop-color:color-mix(in srgb,var(--'+v+') 76%,#fff)"/><stop offset="1" stop-color="'+fb+'" style="stop-color:color-mix(in srgb,var(--'+v+') 93%,#000)"/></linearGradient>';}
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
  if(tt==='mtn'&&h.elev!=null)return h.elev>=2000&&((h.c+h.r)&1)===0?peak(x,y+9,20,17):''; // 台澎：顏色表示高度，只在 2,000 公尺以上隔格畫一座小山
  if(tt==='mtn')return peak(x-6,y+8,24,22)+peak(x+9,y+10,17,14);
  if(h.t==='port')return '<rect class="pier" x="'+(x-3)+'" y="'+(y+3)+'" width="6" height="14" rx="1"/><rect class="cont c1" x="'+(x-12)+'" y="'+(y+2)+'" width="8" height="5"/><rect class="cont c2" x="'+(x+5)+'" y="'+(y+6)+'" width="8" height="5"/><path class="crane" d="M'+(x+9)+' '+(y+4)+'V'+(y-10)+'H'+(x-2)+'"/>';
  if(h.t==='air')return '<polygon class="rwy" points="'+[x-15,y+2,x+13,y-4,x+15,y,x-13,y+6].join(',')+'"/><path class="rwl" d="M'+(x-11)+' '+(y+3)+'L'+(x+11)+' '+(y-2)+'"/>';
  return '';
}

/* ---------- 外圍示意區：宮古／先島、舟山、黃山、梅州、呂宋北部（縮小地圖時可見） ---------- */
const FAR={};
let GUAM_LL=null; // 關島示意位置（供海底地形判斷）
// 外圍示意區的地標：以真實經緯度定位（粗格座標 = 細格像素 / KS），陸地形狀見 ISLANDS
const llPx=(lon,lat)=>{const o=center(GEO.c0,GEO.r0),ox=center(GEO.c0+1,GEO.r0)[0]-o[0],oy=center(GEO.c0,GEO.r0+1)[1]-o[1];
  return [o[0]+(lon-GEO.lon0)/GEO.dlon*ox,o[1]+(GEO.lat0-lat)/GEO.dlat*oy];};
function farPlace(lon,lat,t,name,tag,who){const [x,y]=llPx(lon,lat);FAR[name]={lon,lat,x:x/KS,y:y/KS,t,name,tag:tag||null,who:who||null};}
function farSchem(c,r,t,name,tag,who){const [x,y]=oCenter(c,r);FAR[name]={x,y,t,name,tag:tag||null,who:who||null,schem:true};} // 圖外的地點：示意位置（粗格座標）
const llInv=(px,py)=>{const o=center(GEO.c0,GEO.r0),ox=center(GEO.c0+1,GEO.r0)[0]-o[0],oy=center(GEO.c0,GEO.r0+1)[1]-o[1];return [GEO.lon0+(px-o[0])/ox*GEO.dlon,GEO.lat0-(py-o[1])/oy*GEO.dlat];};
(function(){
  // 大陸機場與基地：實際位置在圖外北側，以示意位置標示
  farSchem(-3,-4,'air','黃山','火箭軍','atk'); farSchem(-3,4,'air','梅州','火箭軍','atk');
  farSchem(8,-5,'air','櫟社','東部戰區','atk'); farSchem(7,-6,'air','路橋','東部戰區','atk'); farSchem(5,-6,'air','龍灣','東部戰區','atk'); farSchem(-1,-3,'air','武夷山','東部戰區','atk');
  farSchem(8,-3,'port','舟山','東部戰區','atk');
  // 先島群島、沖繩（真實位置；第 3b 階段起在遊戲格內，畫成日本的陸地格）
  farPlace(123.0,24.46,'plain','與那國','自衛隊','jp'); farPlace(124.17,24.4,'plain','石垣','自衛隊','jp'); farPlace(125.3,24.78,'air','宮古島','自衛隊','jp');
  farPlace(127.86,26.42,'air','嘉手納','美空軍','us'); farPlace(127.6,26.14,'plain','那霸','空自','jp');
  // 九州、關島在圖外：示意位置
  farSchem(27,-6,'port','佐世保','海自','jp'); farSchem(26,22,'air','關島','美空軍','us');
  // 呂宋海峽與呂宋北部（真實位置；伊特巴雅特略南移以免被遊戲格蓋住）
  farPlace(121.83,20.6,'plain','伊特巴雅特','美軍','us'); farPlace(121.97,20.4,'port','巴丹','美軍','us'); farPlace(121.95,19.45,'plain','巴布煙群島','美軍','us');
  farPlace(120.55,18.18,'air','拉婁','美軍','us'); farPlace(122.13,18.46,'port','卡米洛‧奧西亞斯','美軍','us');
})();
// 外圍陸地：島鏈用「線段＋半徑」(度)，大島用多邊形；畫在細格上（半徑已留一點寬度讓窄島至少占一格）
const ISL_POLY=[
  [[120.5,18.5],[120.78,18.58],[121.07,18.62],[121.25,18.6],[121.45,18.5],[121.63,18.37],[121.82,18.3],[122.0,18.3],[122.12,18.42],[122.2,18.5],[122.22,18.38],[122.3,18.1],[122.36,17.7],[122.5,17.2],[122.48,16.9],[122.4,16.6],[122.22,16.38],[122.15,16.28],[122.02,16.05],[121.75,15.85],[121.6,15.7],[121.45,15.4],[119.95,15.4],[119.9,15.8],[119.9,16.15],[119.88,16.4],[120.1,16.35],[120.2,16.12],[120.3,16.0],[120.4,16.2],[120.33,16.62],[120.35,17.1],[120.38,17.57],[120.45,17.95],[120.52,18.2]] // 呂宋北部（Cape Engaño、Casiguran 灣、Lingayen 灣、Cape Bolinao）
];
// 圖外地點的示意形狀：以示意位置為錨點，縮小後畫出（九州 0.5 倍、關島原尺寸、舟山群島）
(function(){
  const sch=(name,pts,sc,cap)=>{const f=FAR[name];if(!f)return;const [aL,aB]=llInv(f.x*KS,f.y*KS),[rL,rB]=cap||[0,0];
    return pts.map(([x,y])=>[aL+(x-rL)*sc,aB+(y-rB)*sc]);};
  ISL_POLY.push(sch('佐世保',[[129.65,33.2],[129.9,33.6],[130.3,33.65],[130.9,33.95],[131.1,33.6],[131.7,33.3],[131.9,32.6],[131.65,31.7],[131.35,31.15],[131.05,31.0],[130.7,31.0],[130.2,31.1],[130.2,31.6],[130.2,32.3],[129.95,32.55],[129.6,32.9]],.5,[129.72,33.17]));
  const g=sch('關島',[[144.78,13.62],[144.9,13.28]],1,[144.85,13.5]);GUAM_LL=[(g[0][0]+g[1][0])/2,(g[0][1]+g[1][1])/2];ISL_CAP.push([g[0][0],g[0][1],g[1][0],g[1][1],.1]);
  const z=sch('舟山',[[122.15,30.02],[122.35,29.92]],1.6,[122.2,30.0]);ISL_CAP.push([z[0][0],z[0][1],z[1][0],z[1][1],.2]);
})();
const inIsl=(lon,lat)=>{
  const k=Math.cos(lat*Math.PI/180);
  for(const [x1,y1,x2,y2,r] of ISL_CAP){const dx=(x2-x1)*k,dy=y2-y1,px=(lon-x1)*k,py=lat-y1,L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,(px*dx+py*dy)/L)):0;if(Math.hypot(px-t*dx,py-t*dy)<=r)return true;}
  for(const P of ISL_POLY){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,yi]=P[i],[xj,yj]=P[j];if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)c=!c;}if(c)return true;}
  return false;};
const FARINFO={
  '嘉手納':{w:'us',t:'沖繩・嘉手納（美空軍 第18聯隊）',d:'F-15EX、F-35A。美日聯合作戰的前進空軍基地。',r:'距台灣約 600 公里，戰機可直接涵蓋台灣海峽。'},
  '那霸':{w:'jp',t:'沖繩・那霸（空自 第9航空團）',d:'F-15J 戰機。',r:'距台灣約 650 公里。'},
  '與那國':{w:'jp',t:'與那國島（陸自）',d:'地對艦飛彈連隊、監視雷達。',r:'距台灣東部僅約 110 公里，12 式地對艦飛彈可涵蓋台灣東側海域。'},
  '石垣':{w:'jp',t:'石垣島（陸自）',d:'地對艦飛彈連隊駐地。',r:'距台灣約 270 公里。'},
  '宮古島':{w:'jp',t:'宮古島（陸自、空自）',d:'地對艦飛彈、防空與雷達；扼守宮古海峽。',r:'距台灣約 400 公里，也是共軍艦隊進出西太平洋的要道。'},
  '佐世保':{w:'jp',t:'九州・佐世保（海自、美海軍）',d:'護衛隊群母港，參戰後需 1 回合抵達。',r:'距台灣約 1,100 公里。'},
  '關島':{w:'us',t:'關島・安德森（美空軍）',d:'B-1B、B-52 轟炸機，可攜長程反艦飛彈。',r:'距台灣約 2,800 公里，靠空中加油與長程飛彈打擊；共軍東風-26 可涵蓋（打擊可能引發升級）。'},
  '共軍航艦群':{w:'atk',t:'共軍航艦群（遼寧、山東、福建）',d:'三艘航艦（福建艦 2025 年 11 月服役、仍在形成完整戰力），艦載機加入制空；遭美日反艦攻擊時可能被重創。',r:'在台灣東側海域活動，航艦數量隨年代增加（2028 為 3、2030 為 4，第四艘在建）。'},
  '共軍潛艦':{w:'atk',t:'共軍潛艦（含核動力攻擊潛艦）',d:'在海峽與西太平洋攻擊美日艦艇與守方海軍；美日反潛兵力（海自護衛隊群、美軍潛艦、航艦直升機、台灣海軍與潛艦）薄弱時幾乎不受壓力，反潛力量越多越容易被擊沉。',r:'公開報導共軍潛艦總數已超過 60 艘；遊戲只取投入台海與西太平洋的相對規模，位置為示意。'},
  '海自護衛隊群':{w:'jp',t:'海自 護衛隊群',d:'佐世保出港（含出雲級、F-35B），參戰後 1 回合抵達。',r:'在台灣東北側、先島群島附近海域活動。'},
  '第7艦隊':{w:'us',t:'美海軍 第7艦隊（航艦打擊群）',d:'參戰後 2 回合抵達西太平洋海域，艦載機與艦艇出擊。',r:'在台灣東側海域活動，受共軍反艦飛彈威脅。'},
  '美軍潛艦':{w:'us',t:'美軍攻擊潛艦（隱蔽）',d:'無法被火力打擊；隱蔽支援階段就可能行動。',r:'位置不公開，圖上僅為示意。'},
  '海自潛艦':{w:'jp',t:'海自潛艦（隱蔽）',d:'無法被火力打擊。',r:'位置不公開，圖上僅為示意。'},
  '黃山':{w:'atk',t:'黃山（火箭軍基地，安徽）',d:'火箭軍飛彈旅駐地，可發射短程彈道飛彈與長程火箭。',r:'距台北約 750 公里；其中遠程型飛彈（東風-26 等）可打擊沖繩與關島。'},
  '梅州':{w:'atk',t:'梅州（火箭軍基地，廣東）',d:'火箭軍飛彈旅駐地。',r:'距台灣南部約 450 公里。'},
  '舟山':{w:'atk',t:'舟山（東海艦隊基地，浙江）',d:'東海艦隊艦艇與海軍航空兵駐地。',r:'距台北約 650 公里。'},
  '伊特巴雅特':{w:'us',t:'巴丹群島・伊特巴雅特（美軍）',d:'呂宋海峽要點，美軍可能部署岸置反艦飛彈。',r:'距台灣南端約 200 公里。'},
  '巴丹':{w:'us',t:'巴丹群島・巴丹島（美軍）',d:'呂宋海峽要點，EDCA 據點之一。',r:'距台灣南端約 200 公里。'},
  '巴布煙群島':{w:'us',t:'巴布煙群島（美軍）',d:'呂宋海峽以南的前沿島鏈。',r:'距台灣南端約 450 公里。'},
  '拉婁':{w:'us',t:'呂宋北部・拉婁（EDCA 據點）',d:'美軍可輪駐戰機。',r:'距台灣南端約 700 公里。'},
  '卡米洛‧奧西亞斯':{w:'us',t:'呂宋北部・卡米洛‧奧西亞斯海軍基地',d:'美軍可使用的海軍設施。',r:'距台灣南端約 650 公里。'}
};
const FARWHO={atk:'共軍',us:'美軍',jp:'日本'};
let FARSEL=null;
const ORG={okinawa:[[26,-1],[27,-1]],sakishima:[[20,3],[18,5]],sasebo:[[27,-6]],guam:[[26,22]],sea:[[19,9],[18,13]],
  pla:[[2,2],[2,4],[2,6],[-3,-4],[-3,11],[7,-4]],plaCV:[[17,7]],roc:[[13,6],[10,10],[12,1],[9,6]]};
const orgPick=k=>{const a=ORG[k];return a?a[Math.floor(Math.random()*a.length)].slice():null;};
function farKeyInGrid(c,r){return c>=OC0&&c<OC1&&r>=OR0&&r<OR1;}
const TERF=(c,r)=>TER[K(c,r)];
const fineCenter=(c,r)=>center(c,r),FINE={R,c0:COL0,c1:COL1,r0:ROW0,r1:ROW1};
// 海底地形（依文獻概略）：台灣東岸陸棚不到 2 km 即陡降深海（無淺水漸層）；台灣海峽、閩粵沿海、東海與南海北部為寬廣淺陸棚；
// 琉球群島太平洋側（琉球海溝）、巴士海峽／巴丹群島、呂宋東岸、關島周邊都是近岸即深水；其餘為一般漸層。
const midLonTW=lat=>120.85+(lat-21.9)*.17;
function seaZone(lon,lat){
  if(GUAM_LL&&Math.hypot((lon-GUAM_LL[0])*Math.cos(lat*Math.PI/180),lat-GUAM_LL[1])<2.2)return 'steep';
  if(lat>=21.5&&lat<=25.4&&lon>midLonTW(lat))return 'steep';          // 台灣東岸與東南外海
  if(lat<22&&lon>=119.8&&lat>=19)return 'steep';                       // 恆春以南、巴士海峽
  if(lat>=18.3&&lat<22&&lon>=120.4&&lon<=123.6)return 'steep';         // 呂宋海峽、巴丹與巴布煙群島周邊
  if(lat<18.3&&lon>=122.0)return 'steep';                              // 呂宋東岸（菲律賓海）
  if(lon>=122.6&&lat>=22.5&&lat<=28.5&&(5.3*(lat-24.4)-2.5*(lon-123))<0)return 'steep'; // 琉球群島太平洋側
  if(lat>=22&&lat<=27.6&&lon<midLonTW(lat))return 'shelf12';           // 台灣海峽與閩粵沿海（陸棚約 250 km）
  if(lat>25.3&&lat<=33&&lon<=124.3+(lat-26)*.5)return 'shelf19';       // 東海陸棚（約 400 km）
  if(lat>=17.5&&lat<22&&lon<=119.5)return 'shelf12';                   // 南海北部陸棚
  return 'norm';}
const ZW={steep:0,norm:2,shelf12:12,shelf19:19};
const SWC=new Map();
function shelfW(lon,lat){ // 陸棚寬度：把分區邊界在約 0.45 度內平滑混合，再加低頻起伏，避免海底分界出現筆直的線
  const key=Math.round(lon*40)+','+Math.round(lat*40),c=SWC.get(key);if(c!==undefined)return c;
  let sum=0,n=0;const R=.45;
  for(const [dx,dy] of [[0,0],[R,0],[-R,0],[0,R],[0,-R],[R*.7,R*.7],[-R*.7,R*.7],[R*.7,-R*.7],[-R*.7,-R*.7],[R*.5,0],[-R*.5,0],[0,R*.5],[0,-R*.5]]){sum+=ZW[seaZone(lon+dx,lat+dy)];n++;}
  let w=sum/n;w*=1+.22*Math.sin(lon*7.3+lat*4.1)*Math.cos(lon*3.7-lat*6.9);
  SWC.set(key,w);return w;}
function seaClass(lon,lat,dist){
  const d=dist==null?99:dist,w=shelfW(lon,lat);
  if(w<1)return d>10?'d4':'d3';                                        // 陡降：近岸即深水，不做淺水漸層
  if(d<=1)return 'd1';
  if(w<3)return d===2?'d2':d>10?'d4':'d3';
  const W=Math.round(w);                                                // 陸棚寬度（細格數）
  if(d<=W)return d===2?'d2':'sh';
  if(d===W+1)return 'd2';
  return d>W+10?'d4':'d3';}
// 地形分類 → 色塊 key（mainland=大陸色系，否則為島嶼色系）
function VTKEY(vt,main){const m=main?'main':'';
  if(vt==='mtn')return main?'mainmtn':'mtn'; if(vt==='hill')return main?'mainhill':'hill'; if(vt==='city')return main?'maincity':'city';
  if(vt==='plain2')return main?'main2':'plain2'; if(vt==='plain3')return main?'main3':'plain3'; return main?'main':'plain';}
function buildFar(){
  // 外圍示意區：地形一律用與遊戲格相同的細格；標示、投射區仍用舊座標系（粗格）再整組縮放 KS 對齊
  const center=oCenter,VBW=OVBW,VBH=OVBH,W=OW,R=OR,COL0=OC0,COL1=OC1,ROW0=OR0,ROW1=OR1,MX0=oMX0,MX1=oMX1,MY0=oMY0,MY1=oMY1,EVBW=OVBW+oMX0+oMX1,EVBH=OVBH+oMY0+oMY1,TER=TERC;
  const RF=FINE.R,fx0=-oMX0*KS-RF*2,fx1=(OVBW+oMX1)*KS+RF*2,fy0=-oMY0*KS-RF*2,fy1=(OVBH+oMY1)*KS+RF*2;
  const POLY=[[112,31.5],[122.3,31.5],[122.0,30.8],[122.2,30.0],[121.9,29.6],[121.8,29.0],[121.5,28.5],[120.9,27.9],[120.5,27.4],[120.35,26.8],[119.9,26.5],[119.62,26.25],[119.68,25.95],[119.8,25.62],[119.6,25.35],[119.15,25.25],[118.95,24.98],[118.65,24.62],[118.2,24.45],[117.95,24.3],[117.5,23.7],[117.0,23.4],[116.7,23.2],[116.0,22.85],[115.4,22.7],[114.9,22.3],[114.6,22.1],[113.8,22.3],[112,22.3]];
  const inPoly=(x,y,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,yi]=P[i],[xj,yj]=P[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
  const farL=Object.values(FAR).map(f=>[f.x*KS,f.y*KS,f]);
  const fine=new Map();
  for(let r=-60;r<=90;r++)for(let c=-70;c<=110;c++){
    if(c>=FINE.c0&&c<FINE.c1&&r>=FINE.r0&&r<FINE.r1)continue;
    const [x,y]=fineCenter(c,r);if(x<fx0||x>fx1||y<fy0||y>fy1)continue;
    const [lon,lat]=rcToLL(c,r);let t='sea',name=null;
    if(inPoly(lon,lat,POLY))t='main';
    else if(inIsl(lon,lat))t='plain';
    fine.set(K(c,r),{c,r,x,y,t});
  }
  // 每個有名稱的外圍地點：最近的細格負責點選
  const clickOf={};
  for(const [px,py,f] of farL){if(!(f.name&&FARINFO[f.name]))continue;let best=null,bd=1e9;for(const h of fine.values()){if(h.t==='sea')continue;const d=Math.hypot(h.x-px,h.y-py);if(d<bd){bd=d;best=h;}}if(best)clickOf[K(best.c,best.r)]=f.name;}
  const nb=(c,r)=>((r&1)?[[1,0],[1,-1],[0,-1],[-1,0],[0,1],[1,1]]:[[1,0],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1]]).map(([a,b])=>[c+a,r+b]);
  const dist=new Map();let q=[];
  fine.forEach(h=>{if(h.t!=='sea'){dist.set(K(h.c,h.r),0);q.push([h.c,h.r]);}});
  Object.values(TERC).forEach(()=>{});
  // 遊戲格內的陸地也算（讓外圍緊鄰的海格有淺水色）
  for(let r=FINE.r0;r<FINE.r1;r++)for(let c=FINE.c0;c<FINE.c1;c++){const h=TERF(c,r);if(h&&h.t!=='sea'){dist.set(K(c,r),0);q.push([c,r]);}}
  while(q.length){const [c,r]=q.shift(),d=dist.get(K(c,r));if(d>=34)continue;for(const [a,b] of nb(c,r)){const k=K(a,b);if(!dist.has(k)){dist.set(k,d+1);q.push([a,b]);}}}
  // ---- 地形分類（非台灣的陸地）：離岸距離＋實際山脈／城市，給平地、丘陵、山地、城市不同色塊與符號 ----
  (function(){
    const land=new Map(),isSea=(c,r)=>{const f=fine.get(K(c,r));if(f)return f.t==='sea';const g=TERF(c,r);return g?g.t==='sea':false;};
    fine.forEach(h=>{if(h.t!=='sea'){const [lon,lat]=rcToLL(h.c,h.r);land.set(K(h.c,h.r),{c:h.c,r:h.r,lon,lat,ref:h,main:h.t==='main'});}});
    for(let r=FINE.r0;r<FINE.r1;r++)for(let c=FINE.c0;c<FINE.c1;c++){const g=TERF(c,r);if(g&&(g.isl==='CN'||g.t==='main')){const [lon,lat]=rcToLL(c,r);land.set(K(c,r),{c,r,lon,lat,ref:g,main:true});}}
    const ld=new Map();let qq=[];
    land.forEach((v,k)=>{if(nb(v.c,v.r).some(([a,b])=>isSea(a,b))){ld.set(k,1);qq.push(v);}});
    while(qq.length){const v=qq.shift(),d=ld.get(K(v.c,v.r));for(const [a,b] of nb(v.c,v.r)){const k=K(a,b);if(land.has(k)&&!ld.has(k)){ld.set(k,d+1);qq.push(land.get(k));}}}
    const CITY=[[119.3,26.08],[118.1,24.48],[118.6,24.9],[117.65,24.52],[119.0,25.43],[119.55,26.66],[120.7,28.0],[121.42,28.66],[116.7,23.37],[116.62,23.66],[117.02,25.08],[117.64,26.26],[118.17,26.64],[116.1,24.3],[119.92,28.45],[118.65,24.6],
      [127.68,26.21],[127.98,26.59],[125.28,24.8],[124.16,24.34],[120.59,18.2],[121.73,17.62],[121.64,18.36],[120.39,17.57],[120.6,16.4]];
    const cityKeys=new Set();
    for(const [lo,la] of CITY){let best=null,bd=1e9;land.forEach((v,k)=>{const d=Math.hypot((v.lon-lo)*Math.cos(la*Math.PI/180),v.lat-la);if(d<bd){bd=d;best=k;}});if(best&&bd<.35)cityKeys.add(best);}
    const hash=(c,r)=>((c*73856093)^(r*19349663))>>>0;
    land.forEach((v,k)=>{
      const d=ld.get(k)||1,{lon,lat}=v;let t;
      if(cityKeys.has(k))t='city';
      else if(v.main){const n=hash(v.c*3+1,v.r*7+2)%100;
        if(d<=3)t='plain';
        else if(lon<118.6&&lat>25.3&&lat<28.4)t=d>=5?(n<60?'mtn':'hill'):'hill';              // 武夷山脈
        else if(d<=5)t=n<70?'plain':'hill';
        else t=n<50?'hill':n<82?'plain':'mtn';}                                              // 內陸：丘陵、平地、零星山地交錯
      else if(lat>=16.2&&lat<=18.4&&lon>=120.4&&lon<=121.35)t=d>=2?'mtn':'hill';          // 呂宋 科迪勒拉山脈
      else if(lon>=121.85&&lat<=18.2&&lat>=15.5)t=d>=2?'mtn':'hill';                       // 呂宋 馬德雷山脈
      else if(lat>26.5&&lon>127.5&&lon<128.6)t=d>=2?'mtn':'hill';                          // 沖繩北部山地
      else t=d>=4?'mtn':d>=2?'hill':'plain';
      if(t==='plain'){const m=hash(v.c,v.r)%3;t=m===0?'plain':m===1?'plain2':'plain3';}
      v.ref.vt=t;
    });
  })();
  // 精簡模式（LITE）：不畫會持續動畫的海浪、減少山丘細節，降低圖層節點與動畫數量（約 2,000 個動畫、1 萬多節點）
  let fineSvg='';let wi=0;const seaD={}; // 細格海面：同色的海格合併成一個 path（約 4,000 個節點 → 數個）
  for(const h of fine.values()){
    if(h.t==='sea'){const [slon,slat]=rcToLL(h.c,h.r),dd=dist.get(K(h.c,h.r)),sc=seaClass(slon,slat,dd);(seaD[sc]=seaD[sc]||[]).push('M'+hexPts(h.x,h.y,RF).replace(/ /g,'L')+'Z');
      if(!LITE&&sc!=='d1'&&(h.c+h.r)%2===0)fineSvg+='<path class="wv" style="animation-delay:'+(-(wi++%9)*.7).toFixed(1)+'s" d="M'+(h.x-6)+' '+(h.y+1)+'q3 -3 6 0t6 0"/>';}
    else{const nm=clickOf[K(h.c,h.r)];fineSvg+='<polygon class="tl-far'+(nm?' fclick':'')+'" fill="url(#gt-'+VTKEY(h.vt,h.t==='main')+')" stroke="var(--land-edge)" stroke-width=".5" points="'+hexPts(h.x,h.y,RF)+'"'+(nm?' data-far="'+nm+'"':'')+'/>';
      if(h.vt==='mtn'||h.vt==='city'||(!LITE&&h.vt==='hill'&&((h.c*7+h.r*13)&3)!==0))fineSvg+='<g pointer-events="none" opacity=".9">'+tileDetail({t:h.vt,vt:h.vt,c:h.c,r:h.r},h.x,h.y)+'</g>';}
  }
  fineSvg=Object.entries(seaD).map(([c,d])=>'<path class="tl-sea '+c+'" d="'+d.join('')+'"/>').join('')+fineSvg;
  const bg='<rect x="'+(-oMX0*KS-10)+'" y="'+(-oMY0*KS-10)+'" width="'+((OVBW+oMX0+oMX1)*KS+20).toFixed(0)+'" height="'+((OVBH+oMY0+oMY1)*KS+20).toFixed(0)+'" fill="url(#gSea)"/>';
  const tiles=Object.values(FAR).filter(f=>f.name).map(f=>[0,0,f.x,f.y,f]);
  let o='<g class="far">';
  const col={atk:'var(--atk)',jp:'var(--jp)',us:'var(--us)'};
  for(const [c,r,x,y,f] of tiles){
    if(!f||!f.name||HIDEFAR.has(f.name))continue;
    if(f.who)o+='<circle pointer-events="none" cx="'+x+'" cy="'+(y+4)+'" r="4.5" fill="'+col[f.who]+'" stroke="#fff" stroke-width="1"/>';
    o+='<text class="far-lbl" x="'+x+'" y="'+(y-9)+'">'+f.name+'</text>';
    if(f.tag)o+='<text class="far-tag" x="'+x+'" y="'+(y+18)+'" fill="'+col[f.who]+'">'+f.tag+'</text>';
  }
  let oS='';
  const Z=(c,r,rx,ry,who,t)=>{const [x,y]=center(c,r);return '<ellipse pointer-events="none" cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="none" stroke="'+col[who]+'" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="6 4"/>'+(t?'<text class="far-tag" x="'+x+'" y="'+(y+ry+10)+'" fill="'+col[who]+'">'+t+'</text>':'');};
  const SUBG=(x,y,who,dash)=>'<g><ellipse cx="'+x+'" cy="'+(y+7)+'" rx="16" ry="4" fill="#000" opacity=".15"/><path d="M'+(x-17)+' '+(y+2)+'q0 -6 8 -6h18q9 0 9 6q0 6 -9 6h-18q-8 0 -8 -6z" fill="'+col[who]+'" stroke="#fff" stroke-width="1"'+(dash?' stroke-dasharray="3 2" fill-opacity=".55"':'')+'/><path d="M'+(x-4)+' '+(y-4)+'v-5h8v5" fill="'+col[who]+'" stroke="#fff" stroke-width="1"/><path d="M'+(x+2)+' '+(y-9)+'v-5h4" fill="none" stroke="#fff" stroke-width="1.2"/><path d="M'+(x-17)+' '+(y+2)+'l-4 -3m4 3l-4 4" stroke="'+col[who]+'" stroke-width="1.5"/></g>';
  // 航艦打擊群：側視剪影，尺寸控制在一個細格以內。美軍＝尼米茲／福特級（平甲板、斜角甲板、艦島居中偏後）；
  // 共軍＝遼寧／山東（滑躍式艦艏、較寬的艦島與雷達罩）。座標以艦艏朝右的 56 單位寬為準，再縮放。
  const CVG=(x,y,who)=>{const f=col[who],ln='stroke="#fff" stroke-width=".7" vector-effect="non-scaling-stroke" stroke-linejoin="round"',us=who==='us';
    const hull=us?'<path d="M-28 -2h53l6 3.5l-5 5.5h-49l-6 -3z" fill="'+f+'" '+ln+'/>'
      :'<path d="M-28 -2h37l9 -4.5h10v8.5l-4 5h-49l-6 -3z" fill="'+f+'" '+ln+'/>';
    const deck=us?'<path d="M-22 0l30 -1.2M-24 2.5h48" stroke="#fff" stroke-opacity=".55" stroke-width=".6" vector-effect="non-scaling-stroke" fill="none"/><path d="M-19 -2l-5 4.5h9l5 -4.5z" fill="'+f+'" '+ln+'/>' // 斜角甲板的外伸部分
      :'<path d="M-24 2.5h34" stroke="#fff" stroke-opacity=".55" stroke-width=".6" vector-effect="non-scaling-stroke" fill="none"/>';
    const isl=us?'<path d="M4 -2v-6h5v6" fill="'+f+'" '+ln+'/><path d="M6.5 -8v-3" stroke="#fff" stroke-width=".7" vector-effect="non-scaling-stroke" fill="none"/>'
      :'<path d="M-6 -2v-7h9v7" fill="'+f+'" '+ln+'/><circle cx="-1.5" cy="-11" r="2" fill="'+f+'" '+ln+'/>';
    const esc='<path d="M-41 4h8l-1.2 3h-5.6z" fill="'+f+'" '+ln+'/><path d="M33 5h8l-1.2 3h-5.6z" fill="'+f+'" '+ln+'/>';
    return '<g transform="translate('+x+' '+y+') scale(.3)">'+hull+deck+isl+esc+'</g>';};
  const FK=US/KS; // 外圍艦艇改畫成與兵棋相同的棋子（尺寸與單位一致）
  const FSYM={sub:'<rect class="sym" x="-9" y="-12" width="18" height="10"/><path class="sym" d="M-7 -5q0 -3 4 -3h6q4 0 4 3q0 3 -4 3h-6q-4 0 -4 -3z"/><path class="sym" d="M-1 -8v-2h3v2"/>',
    cv:'<rect class="sym" x="-9" y="-12" width="18" height="10"/><path class="sym" d="M-8 -6.5h16l-1.2 3h-13.6z"/><path class="sym" d="M2 -6.5v-2.6h3v2.6"/>',
    dd:'<rect class="sym" x="-9" y="-12" width="18" height="10"/><path class="sym" d="M-7 -6h14l-2 3h-10z"/><path class="sym" d="M-2 -6v-3h4v3"/>'};
  const SH=(c,r,who,t,sub,dash)=>{const [x,y]=center(c,r),isSub=/潛艦/.test(t),cvg=/航艦/.test(sub),kind=isSub?'sub':cvg?'cv':'dd',sh=isSub?(who==='jp'?'SS':'SSN'):cvg?(who==='atk'?'CV':'CSG'):'DDG';
    const cls=who;const ch='<g class="fu fclick'+(dash?' hid':'')+'" data-far="'+t+'"><g transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') scale('+FK.toFixed(4)+')">'+
      '<ellipse class="ush" cx="0" cy="11" rx="16" ry="5"/><rect class="uside '+cls+'" x="-15" y="-9" width="30" height="22" rx="3"/><rect class="body '+cls+'" x="-15" y="-14" width="30" height="23" rx="3"/><rect class="uhi" x="-13" y="-13" width="26" height="3" rx="1.5"/>'+FSYM[kind]+'<text class="tx" x="0" y="6.5">'+sh+'</text></g></g>';
    return ch+'<text class="far-lbl" x="'+x+'" y="'+(y-16*FK-2).toFixed(1)+'">'+t+'</text><text class="far-tag" x="'+x+'" y="'+(y+14*FK+7).toFixed(1)+'" fill="'+col[who]+'">'+sub+'</text>';};
  o+=Z(26.5,-1,115,70,'us','美日 沖繩投射區')+Z(19.5,4,150,95,'jp','日本 先島投射區')+Z(26.5,22,95,60,'us','美軍 關島投射區')+Z(27.5,-5.5,95,50,'jp','日本 九州')
    +Z(-4,5,62,300,'atk','共軍 大陸沿海投射區')+Z(8,-3.5,85,55,'atk','共軍 東海艦隊');
  oS+=SH(23,17,'atk','共軍潛艦','太平洋・隱蔽',true)+'<g id="csgM">'+SH(32,10,'us','第7艦隊','航艦打擊群')+'</g>'+'<g id="jmsdfM">'+SH(26,-4,'jp','海自護衛隊群','佐世保出港')+'</g>'+SH(19,17,'us','美軍潛艦','隱蔽',true)+SH(15,17,'jp','海自潛艦','隱蔽',true);
  const T=(c,r,t,sz)=>{const [x,y]=center(c,r);return '<text class="big" font-size="'+(sz||12)+'" x="'+x+'" y="'+y+'" text-anchor="middle">'+t+'</text>';};
  o+=T(23,8,'太平洋',13)+T(5,19,'南海',13)+T(15,14,'呂宋海峽',11)+T(14,-3,'東海',13);
  o+='<text class="far-tag" x="'+(VBW-6)+'" y="-6" text-anchor="end" fill="var(--muted)" style="text-anchor:end">▲ 虛線內為遊戲格；外圍僅為背景（可點選查看）</text></g><rect class="playbox" x="0" y="0" width="'+GVBW.toFixed(1)+'" height="'+VBH.toFixed(1)+'" rx="6"/>';
  $('#gX').innerHTML=bg+fineSvg+'<g transform="scale('+KS+')">'+o+'</g>';
  $('#gE').innerHTML='<g transform="scale('+KS+')">'+oS+'</g>';
}
const nearCity=h=>Object.values(TER).some(x=>x!==h&&x.name&&(x.t==='city'||x.t==='port')&&hd(x,h)<=Math.round(kmH(25)));
function buildStatic(){
  const defs=tileGrad('gt-plain','land','#d9d1ad')+tileGrad('gt-city','city','#cfc4a0')+tileGrad('gt-mtn','mtn','#b5a47c')+tileGrad('gt-main','main','#c8c4b8')+tileGrad('gt-plain2','land2','#d3d0a8')+tileGrad('gt-plain3','land3','#dfd5b3')+tileGrad('gt-hill','hill','#c9bd92')+tileGrad('gt-main2','main2','#c3c6b6')+tileGrad('gt-main3','main3','#cec8b8')+tileGrad('gt-mainhill','mainhill','#b9b3a1')+tileGrad('gt-mainmtn','mainmtn','#a39d8c')+tileGrad('gt-maincity','maincity','#d4cfc2')+['#a9c98b','#c3cc8f','#c9bd86','#b3a374','#998b62','#7f7552','#686344'].map((c,i)=>tileGrad('gt-e'+i,'e'+i,c)).join('')+tileGrad('gt-tcity','tcity','#b8b6ae')+
    '<linearGradient id="gu-atk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4574d" style="stop-color:color-mix(in srgb,var(--atk) 72%,#fff)"/><stop offset="1" stop-color="#a02a24" style="stop-color:color-mix(in srgb,var(--atk) 90%,#000)"/></linearGradient>'+
    '<linearGradient id="gu-def" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a82c8" style="stop-color:color-mix(in srgb,var(--def) 72%,#fff)"/><stop offset="1" stop-color="#18457d" style="stop-color:color-mix(in srgb,var(--def) 90%,#000)"/></linearGradient>'+
'<linearGradient id="gu-atk-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--atk) 84%,#000)"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--atk) 52%,#000)"/></linearGradient>'+'<linearGradient id="gu-def-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--def) 84%,#000)"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--def) 52%,#000)"/></linearGradient>'+'<linearGradient id="gu-atk-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--atk) 38%,#fff)"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--atk) 62%,#fff)"/></linearGradient>'+'<linearGradient id="gu-def-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--def) 38%,#fff)"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--def) 62%,#fff)"/></linearGradient>'+
    '<linearGradient id="gSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9c5ce" style="stop-color:color-mix(in srgb,var(--sea) 78%,#fff)"/><stop offset="1" stop-color="#8fb0bb" style="stop-color:color-mix(in srgb,var(--sea) 94%,#000)"/></linearGradient>';
  $('#mdefs').innerHTML=defs;
  const sea=[],land=[];Object.values(TER).forEach(h=>(isLand(h)?land:sea).push(h));
  land.sort((a,b)=>a.r-b.r||a.c-b.c);
  // distance from land for shallow-water shading
  const dist=new Map();let q=[];land.forEach(h=>{dist.set(h.k,0);q.push(h);});
  while(q.length){const h=q.shift();for(const n of nbrs(h.c,h.r)){if(!dist.has(n.k)){dist.set(n.k,dist.get(h.k)+1);q.push(n);}}}
  buildFar();
  let o='';
  let wi=0;
  for(const h of sea){const [x,y]=center(h.c,h.r),[slon,slat]=rcToLL(h.c,h.r),sc=seaClass(slon,slat,dist.get(h.k));
    o+='<polygon class="tl-sea '+sc+'" points="'+hexPts(x,y,R)+'" data-k="'+h.k+'"/>';
    if(!LITE&&sc!=='d1'&&(h.c+h.r)%2===0){o+='<path class="wv" style="animation-delay:'+(-(wi++%9)*.7).toFixed(1)+'s" d="M'+(x-9)+' '+(y+2)+'q4.5 -4 9 0t9 0"/>';}
  }
  for(const h of land){const [x,y]=center(h.c,h.r),d=elev(h);o+='<polygon class="tl-sh" points="'+ptsStr(hexV(x+3,y+d+4,R))+'"/>';}
  for(const h of land){
    const [x,y0]=center(h.c,h.r),d=elev(h),y=y0-d,v=hexV(x,y,R),b=v.map(p=>[p[0],p[1]+d]);
    const key=h.isl==='CN'||h.t==='main'?VTKEY(h.vt,true):h.elev!=null?(h.t==='city'?'tcity':'e'+Math.min(6,Math.floor(h.elev/500))):(h.t==='city'?'city':h.t==='mtn'?'mtn':'plain'); // 台澎：依海拔每 500 公尺分色（地形圖配色），城市灰色
    o+='<g class="tile t-'+key+'">';
    [[3,4,'l'],[2,3,'l'],[1,2,'r'],[0,1,'r']].forEach(([i,j,s])=>{o+='<polygon class="sd '+s+'" points="'+ptsStr([v[i],v[j],b[j],b[i]])+'"/>';});
    o+='<polygon class="tt" fill="url(#gt-'+key+')" points="'+ptsStr(v)+'" data-k="'+h.k+'"/>';
    o+='<polyline class="tg" points="'+ptsStr([v[3],v[4],v[5],v[0]])+'"/>';
    if(h.cliff)o+='<polygon class="cliff" points="'+hexPts(x,y,R-3)+'"/>';
    if(h.mud)o+='<polygon class="mud" points="'+hexPts(x,y,R-3)+'"/>';
    o+=tileDetail(h,x,y);
    if(h.name&&(h.t!=='plain'||h.isl==='JP'||['宜蘭','恆春','澎湖'].includes(h.name))&&!(h.t==='air'&&nearCity(h))){const ob=h.k===TAIPEI||PORTS.includes(h.k);o+='<text class="lbl'+(ob?' obj':' minor')+'" font-size="'+(8.5*Math.max(.72,SC)).toFixed(1)+'" x="'+x+'" y="'+(FG>2?y-R*1.2:y-(h.t==='mtn'?11:9))+'">'+(ob?'★':'')+h.name+'</text>';} // 機場旁 25 km 內已有城市或港口名就不重複標（點機場仍看得到名稱）；縮小時只顯示勝負要點
    o+='</g>';
  }
  o+='<text class="big" font-size="15" x="'+cc(6,3)[0]+'" y="'+cc(6,3)[1]+'" writing-mode="tb">台灣海峽</text>';
  o+='<text class="big" font-size="13" x="'+cc(15,7)[0]+'" y="'+cc(15,7)[1]+'" writing-mode="tb">太平洋</text>';
  o+='<text class="big" font-size="12" x="'+cc(1,1)[0]+'" y="'+cc(1,1)[1]+'" writing-mode="tb">大陸沿海</text>';
  $('#gS').innerHTML=o;
  $('#map').classList.toggle('zlo',FG>2&&(typeof ZOOM==='undefined'?1:ZOOM)<1.6);
  const svg=$('#map');svg.setAttribute('viewBox',(-MX0)+' '+(-MY0)+' '+EVBW.toFixed(1)+' '+EVBH.toFixed(1));
  STATIC.fleets=FLEETS.map(F=>{const a=center(F.from[0],F.from[1]),b=center(F.to[0],F.to[1]);return [b[0]-a[0],b[1]-a[1]];});
  STATIC.built=true;
}
// 被殲滅的單位：棋子先留在地圖上（殘影），等攻擊動畫播完、「殲滅」特效出現時才消失，順序才不會倒過來
const GHOSTS=new Map();
function ghostAdd(u){
  if(reduce()||S.rec)return;
  const g=Object.assign({},u,{hp:Math.max(1,u.hp),ghost:true});GHOSTS.set(u.id,g);
  setTimeout(()=>ghostDrop(u.id),7000); // 保險：特效沒播也一定會清掉
}
function ghostDrop(id){
  if(!GHOSTS.has(id))return;GHOSTS.delete(id);
  document.querySelectorAll('[data-id="'+id+'"]').forEach(e=>{if(!e.closest('#gF'))e.remove();});
}
// 棋子色調分三類（攻方紅、守方藍各自三種深淺，海上與陸上共用）：深＝火力打擊（飛彈、火箭砲、潛艦、飛彈艇）、標準＝作戰部隊、淡＝後勤運輸（船團、補給站、運輸船）
const unitCat=t=>(t==='ssm'||t==='hmr'||t==='mlrs'||t==='hk'||t==='ssn'||t==='nme'||t==='mdt'||t==='ff')?'f':(t==='cvy'||t==='fob'||t==='lst'||t==='ro')?'l':'m';
function unitSVG(u){
  const [x0,y0]=cen(u.c,u.r),[sx,sy]=stackPos(u),x=x0+sx,y=y0+sy,stacked=sx!==0,T=TYPES[u.type];
  const done=S.started&&u.side===S.phase&&u.acted,sel=S.sel===u||!!(u.boundTo&&S.sel&&S.sel.id===u.boundTo),yy=y-2;
  let sym='';const bx=x-9,by=yy-10,bw=18,bh=10;
  const box='<rect class="sym" x="'+bx+'" y="'+by+'" width="'+bw+'" height="'+bh+'"'+(u.type==='res'?' stroke-dasharray="2 1.5"':'')+'/>';
  const X='<path class="sym" d="M'+bx+' '+by+'L'+(bx+bw)+' '+(by+bh)+'M'+(bx+bw)+' '+by+'L'+bx+' '+(by+bh)+'"/>';
  if(u.type==='arm'||u.type==='tank')sym=box+'<ellipse class="sym" cx="'+x+'" cy="'+(by+5)+'" rx="6" ry="3"/>';
  else if(u.type==='cv'||u.type==='csg'||u.type==='ddh')sym=box+'<path class="sym" d="M'+(x-8)+' '+(by+5.5)+'h16l-1.2 3h-13.6z"/><path class="sym" d="M'+(x+2)+' '+(by+5.5)+'v-2.6h3v2.6"/>';
  else if(u.type==='hk'||u.type==='ssn')sym=box+'<path class="sym" d="M'+(x-8)+' '+(by+7)+'q8-8 16 0z"/><path class="sym" d="M'+(x-1)+' '+(by+3)+'h3v3h-3z"/>';
  else if(u.type==='dd'||u.type==='ff'||!!SHIPW[u.type])sym=box+'<path class="sym" d="M'+(x-7)+' '+(by+6)+'h14l-2 3h-10z"/><path class="sym" d="M'+(x-2)+' '+(by+6)+'v-3h4v3"/>';
  else if(u.type==='hmr'||u.type==='mlrs')sym=box+'<path class="sym" d="M'+(x-6)+' '+(by+8)+'h12M'+(x-4)+' '+(by+7.5)+'l7 -5M'+(x-1)+' '+(by+7.5)+'l7 -5M'+(x+2)+' '+(by+7.5)+'l5 -3.5"/><circle class="sym" cx="'+(x-4)+'" cy="'+(by+8.6)+'" r="1"/><circle class="sym" cx="'+(x+4)+'" cy="'+(by+8.6)+'" r="1"/>';
  else if(u.type==='ssm'||u.type==='nme'||u.type==='mdt')sym=box+'<path class="sym" d="M'+(x-5)+' '+(by+8)+'L'+x+' '+(by+2)+'L'+(x+5)+' '+(by+8)+'M'+x+' '+(by+2)+'V'+(by+9)+'"/>';
  else if(u.type==='lst'||u.type==='ro')sym=box+'<path class="sym" d="M'+(x-7)+' '+(by+7)+'h14l-2 2.5h-10z"/><path class="sym" d="M'+(x-5)+' '+(by+7)+'v-2.5h10v2.5"/>';
  else if(u.type==='cvy')sym=box+'<path class="sym" d="M'+(x-7)+' '+(by+7)+'h14l-2 2.5h-10z"/><path class="sym" d="M'+(x-4)+' '+(by+7)+'v-3h8v3"/>';
  else if(u.type==='fob')sym=box+'<path class="sym" d="M'+(x-6)+' '+(by+8)+'h12M'+(x-4)+' '+(by+8)+'v-5h8v5"/>';
  else if(u.type==='abn')sym=box+X+'<path class="sym" d="M'+(x-5)+' '+(by+bh)+'Q'+x+' '+(by+4)+' '+(x+5)+' '+(by+bh)+'"/>';
  else if(u.type==='amph'||u.type==='mar')sym=box+X+'<path class="sym" d="M'+(bx+1)+' '+(by+bh-1.5)+'q2.5 -2 5 0t5 0t5 0"/>';
  else sym=box+X;
  let pips='';const lv=isLch(u)&&u.veh!=null&&!u.ghostFleet,n=u.mhp>6||lv?0:(u.mhp||T.hp);if(lv&&(ssmReady(u)<lchV0(u)||sel))pips='<text x="'+x+'" y="'+(y+20.5)+'" text-anchor="middle" font-size="7" font-weight="800" fill="'+(ssmReady(u)<lchV0(u)?'#c0392b':'var(--ink)')+'">'+ssmReady(u)+'/'+lchV0(u)+' 車</text>';else if(u.mhp>6)pips='<text x="'+x+'" y="'+(y+20.5)+'" text-anchor="middle" font-size="7" font-weight="800" fill="var(--ink)">'+u.hp+'/'+u.mhp+' 艘</text>';for(let i=0;i<n;i++){const px=x-(n-1)*3.5+i*7;pips+='<circle class="pip '+(i<u.hp?'full':'lost')+'" cx="'+px+'" cy="'+(y+17.5)+'" r="2"/>';}
  const sea=atSea(u);
  const wf=US/(16/26*1.18),wake=sea?'<ellipse class="wk" cx="'+x+'" cy="'+(y+12*wf)+'" rx="'+(14*wf).toFixed(1)+'" ry="'+(4*wf).toFixed(1)+'"/><ellipse class="wk w2" cx="'+x+'" cy="'+(y+12*wf)+'" rx="'+(14*wf).toFixed(1)+'" ry="'+(4*wf).toFixed(1)+'"/>':'';
  return '<g class="u'+(sel?' sel':'')+(done?' done':'')+'" data-k="'+K(u.c,u.r)+'" data-id="'+u.id+'" data-x="'+x.toFixed(1)+'" data-y="'+y.toFixed(1)+'">'+wake+
    '<g class="ui"'+(sel?' transform="translate(0,-3)"':'')+'><g transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') scale('+(US*(stacked?.86:1)).toFixed(3)+') translate('+(-x).toFixed(1)+' '+(-y).toFixed(1)+')">'+'<ellipse class="ush" cx="'+x+'" cy="'+(y+11)+'" rx="16" ry="5"/>'+
    '<rect class="uside '+u.side+'" x="'+(x-15)+'" y="'+(y-9)+'" width="30" height="22" rx="3"/>'+
    '<rect class="body '+u.side+' c'+unitCat(u.type)+'" x="'+(x-15)+'" y="'+(y-14)+'" width="30" height="23" rx="3"/>'+
    '<rect class="uhi" x="'+(x-13)+'" y="'+(y-13)+'" width="26" height="3" rx="1.5"/>'+sym+
    '<text class="tx" x="'+x+'" y="'+(y+6.5)+'">'+(u.fl?u.fl.s:T.s)+'</text>'+pips+((()=>{ // 運輸船載著什麼：只有攻方自己（或觀戰）看得到，格式「兵種簡稱＋剩餘步數」；守方玩家只能看到船
      const b=u.boundTo&&S.units.find(z=>z.id===u.boundTo);if(!b)return '';
      if(S.ctrl&&S.ctrl.def==='human'&&S.ctrl.atk!=='human'&&!S.sim&&!S.video)return '';
      const t=TYPES[b.type].s+b.hp,w=Math.max(14,t.length*6.4+4);
      return '<rect x="'+(x-15)+'" y="'+(y-18)+'" width="'+w.toFixed(1)+'" height="8.5" rx="2" fill="#111" opacity=".9"/><text x="'+(x-15+w/2).toFixed(1)+'" y="'+(y-11.6)+'" text-anchor="middle" font-size="6.3" font-weight="700" fill="#fff">'+t+'</text>';})())+(sea?'<circle class="sea-tag" cx="'+(x+15)+'" cy="'+(y-12)+'" r="2.6"/>':'')+'</g></g></g>';
}
const FLEETS=[{id:'csg',el:'csgM',from:[32,10],to:[31,10]},{id:'jmsdf',el:'jmsdfM',from:[26,-4],to:[20,-3]}]; // 美日艦隊：參戰後逐回合由基地海域駛向台灣周邊（from／to 為遠景格座標）
function fleetProgress(F){ // 0＝在原處、1＝到位
  const f=S.fx&&S.fx.units.find(x=>x.id===F.id);if(!f||S.fxScen==='none'||S.fxScen==='intel')return 0;
  const rd=fxReady(f);if(rd==null)return 0;if(S.turn>=rd)return 1;
  return Math.max(0,Math.min(.85,1-(rd-S.turn)/((f.delay||2)+1)));
}
function updateCsg(){
  if(!STATIC.fleets)return;
  FLEETS.forEach((F,i)=>{
    const g=document.getElementById(F.el);if(!g)return;const f=S.fx&&S.fx.units.find(x=>x.id===F.id),p=fleetProgress(F),d=STATIC.fleets[i];
    g.style.transition=S.rec||S.sim&&S.speed>=1?'none':'transform .9s ease-in-out';
    g.style.transform='translate('+(d[0]*p).toFixed(1)+'px,'+(d[1]*p).toFixed(1)+'px)';
    g.style.opacity=(F.id==='csg'&&(S.units&&S.units.some(u=>u.type==='csg')||ghostIds().includes('csg')))||(F.id==='jmsdf'&&S.jmsOn)?'0':f&&f.hp<=0?'.3':'1';
  });
}
/* ---------- 基地直接畫在主地圖上：大陸基地（火箭軍、空軍、海軍、集結港）與美日基地，可直接點選打擊，不必切到戰區圖 ---------- */
const HIDEFAR=new Set(['嘉手納','宮古島','佐世保','關島','黃山','梅州','舟山']); // 這些外圍地標改由基地標記取代
let BPX=null;
function basePx(){
  if(BPX)return BPX;BPX={};
  for(const [id,B] of Object.entries(CNB)){const [x,y]=llPx(B.lon,B.lat);BPX['c'+id]=[x,y];}
  const bm={okinawa:'嘉手納',sakishima:'宮古島',sasebo:'佐世保',guam:'關島'};
  for(const [b,n] of Object.entries(bm)){const f=FAR[n];if(f)BPX['b'+b]=[f.x*KS,f.y*KS];}
  const [sx,sy]=oCenter(19,9);BPX.bsea=[sx*KS,sy*KS];
  return BPX;
}
function baseMarkersSVG(){
  const P=basePx(),strikeOn=humanTurn()&&S.phase==='atk'&&S.mode==='strike',dOn=(humanTurn()&&S.phase==='def'&&S.mode==='strike'&&S.dfire>0&&lrOK())||tomOn();
  let o='';
  for(const [id,B] of Object.entries(CNB)){
    const pt=P['c'+id];if(!pt)continue;const [x,y]=pt,hp=cnShown(id),tg=dOn&&cnTargets().includes(id);
    const shape=B.kind==='rf'?'<polygon class="mcb" points="0,-10 10,0 0,10 -10,0"/>':B.kind==='air'?'<polygon class="mcb" points="0,-9 9,7 -9,7"/>':B.kind==='navy'?'<rect class="mcb" x="-8" y="-8" width="16" height="16"/>':B.kind==='isr'?'<polygon class="mcb" points="0,-10 3,-3 10,0 3,3 0,10 -3,3 -10,0 -3,-3"/>':'<circle class="mcb" r="8"/>';
    o+='<g class="mcg'+(hp>0?'':' off')+'" data-cn="'+id+'" transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') scale('+US.toFixed(3)+')"><circle r="24" fill="transparent" class="hit"/>'+shape+'<text class="mnum" y="4">'+hp+'</text>'+(tg?'<circle class="ttg d" r="16"/>':'')+'<text class="mlb" x="'+(B.side==='l'?-13:13)+'" y="3"'+(B.side==='l'?' text-anchor="end"':'')+'>'+B.n+'</text></g>';
  }
  for(const [b,B] of Object.entries(BASES)){
    const pt=P['b'+b];if(!pt)continue;const [x,y]=pt,us=S.fx.units.filter(f=>f.base===b),live=us.filter(f=>f.hp>0).length,act=us.some(fxActive),tg=strikeOn&&baseTargets(b).length;
    o+='<g class="mbg" data-b="'+b+'" transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') scale('+US.toFixed(3)+')"><circle r="24" fill="transparent" class="hit"/><circle class="mbd '+B.c.toLowerCase()+(act?' on':'')+'" r="10"/><text class="mnum'+(act?' w':'')+'" y="4">'+live+'</text>'+(tg?'<circle class="ttg" r="16"/>':'')+'<text class="mlb" x="14" y="4">'+B.n+'</text></g>';
  }
  return o;
}
function renderMap(){
  if(!STATIC.built)buildStatic();
  updateCsg();
  let o='';
  for(const h of Object.values(TER)){
    if(!isLand(h)||h.isl==='CN'||S.owner[h.k]!=='atk')continue;
    const [x,y]=cen(h.c,h.r);o+='<polygon class="ov-atk" points="'+hexPts(x,y,R-1)+'"/>';
  }
  for(const h of Object.values(TER)){ // 次要港口 ⚓ 與灘頭堡外框
    if(h.isl!=='TW')continue;const mp=MINOR_PORTS[h.k],bh=S.bh&&S.bh[h.k]&&S.turn-S.bh[h.k]>=1&&S.owner[h.k]==='atk';if(!mp&&!bh)continue;
    const [x,y]=cen(h.c,h.r);if(bh)o+='<polygon class="ov-bh" points="'+hexPts(x,y,R-3)+'"/>';
  }
  if(humanTurn()&&S.sel&&alive(S.sel)&&S.sel.side===S.phase){
    for(const [k,v] of reach(S.sel)){const [x,y]=cen(TER[k].c,TER[k].r);o+='<polygon class="hl '+v.kind+'" points="'+hexPts(x,y,R-2)+'"/>';}
  }
  {const iu=S.sel&&alive(S.sel)?S.sel:(S.hoverId?S.units.find(x=>x.id===S.hoverId):null); // 射程圈：一鍵全開時畫雙方所有航艦艦隊；點選（或游標停在）艦艇時畫該艦
   if(S.started&&RNG_ALL)S.units.filter(x=>(x.type==='cv'||x.type==='csg'||x.type==='ddh')&&alive(x)&&x!==iu).forEach(x=>{o+=rangeRingsSVG(x,true);});
   if(S.started&&iu&&(iu.type==='cv'||iu.type==='csg'||iu.type==='ddh'||isEsc(iu)))o+=rangeRingsSVG(iu,false);}
  S.units.filter(u=>!subHidden(u)&&!(u.ship&&atSea(u))).concat([...GHOSTS.values()]).sort((a,b)=>cen(a.c,a.r)[1]-cen(b.c,b.r)[1]).forEach(u=>{o+=unitSVG(u);});
  // 潛艦「上次發現點」：目前沒被發現的潛艦，只在地圖上留下最後被發現的位置（淡虛線圈與回合數）
  S.units.filter(u=>subHidden(u)&&u.last&&S.turn-u.last.turn<=6).forEach(u=>{const p=cen(u.last.c,u.last.r);o+='<g class="lastseen" opacity=".8"><circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="'+(R*.55).toFixed(1)+'" fill="none" stroke="#3f7fd0" stroke-width="1.6" stroke-dasharray="4 3"/><text x="'+p[0].toFixed(1)+'" y="'+(p[1]+4).toFixed(1)+'" text-anchor="middle" font-size="11" fill="#3f7fd0" font-weight="700">?</text><text x="'+p[0].toFixed(1)+'" y="'+(p[1]+R*.55+10).toFixed(1)+'" text-anchor="middle" font-size="9" fill="#3f7fd0">'+TX('潛艦 上次發現點')+' T'+u.last.turn+'</text></g>';});
  o+=facSVG();
  o+=wxMapSVG();
  o+=ghostFleetsSVG();
  o+=baseMarkersSVG();
  for(const k of Object.keys(MINOR_PORTS)){const h=TER[k];if(!h)continue;const [x,y]=cen(h.c,h.r);o+='<text class="mport" style="font-size:'+(14*Math.max(.55,SC)).toFixed(1)+'px" x="'+(x+R*.7).toFixed(1)+'" y="'+(y-R*.35).toFixed(1)+'">⚓</text>';} // 次要港口標記畫在單位之上
  Object.keys(S.mines||{}).forEach(k=>{const h=TER[k];if(!h)return;const [x,y]=cen(h.c,h.r);o+='<g class="mine" pointer-events="none"><circle cx="'+x.toFixed(1)+'" cy="'+(y+8).toFixed(1)+'" r="4.5" fill="#222" stroke="#ffd45a" stroke-width="1.2"/><path d="M'+(x-7).toFixed(1)+' '+(y+8).toFixed(1)+'h14M'+x.toFixed(1)+' '+(y+1).toFixed(1)+'v14" stroke="#ffd45a" stroke-width="1"/></g>';});
  airfields().forEach(h=>{const lv=afLevel(h.k);if(!lv)return;const [x,y]=cen(h.c,h.r);o+='<text class="fxt af'+lv+'" pointer-events="none" x="'+(x+R*.65).toFixed(1)+'" y="'+(y-R*.4).toFixed(1)+'" text-anchor="middle" style="font-size:'+((lv===3?15:12)*Math.max(.55,SC)).toFixed(1)+'px;stroke-width:'+(3*Math.max(.55,SC)).toFixed(1)+'px" fill="'+(lv===3?'#c0392b':lv===2?'#e67e22':'#e0a800')+'">'+(lv===3?'✕':'⚠')+'</text>';});
  Object.keys(S.portDown||{}).forEach(k=>{const h=TER[k];if(!h)return;const [x,y]=cen(h.c,h.r);o+='<text class="fxt dead" pointer-events="none" x="'+x.toFixed(1)+'" y="'+(y+4).toFixed(1)+'" text-anchor="middle" font-size="18" fill="#c0392b">✕</text>';});
  (S.focus||[]).forEach(k=>{const h=TER[k];if(!h)return;const [x,y]=cen(h.c,h.r);o+='<ellipse class="vfocus" cx="'+x.toFixed(1)+'" cy="'+(y+4).toFixed(1)+'" rx="17" ry="12"/>';});
  if(humanTurn()){
    let rings=[];
    if(S.mode==='strike'){if(S.phase==='atk')rings=S.units.filter(u=>u.side==='def'&&strikeable(u)).map(u=>[u,'strike']);else if(S.phase==='def'&&S.dfire>0&&lrOK())rings=stgTargets().map(u=>[u,'strike']);}
    else if(S.mode==='volley'&&S.sel&&cvOwn(S.sel))rings=volleyTargets(S.sel).map(u=>[u,'strike']);
    else if(S.mode==='afS'||S.mode==='afL'||S.mode==='afC')rings=afRings().map(u=>[u,'strike']);
    else if(S.mode==='cvw'&&S.sel&&cvOwn(S.sel)){const I=cvwManualInfo(S.sel);rings=I&&I.n>0?I.foes.map(u=>[u,'strike']):[];}
    else if(S.mode==='cvwL'&&S.sel&&cvOwn(S.sel)){const I=cvwManualLandInfo(S.sel);rings=I&&I.n>0?I.tg.filter(x=>x.u).map(x=>[x.u,'strike']):[];}
    else if(S.sel&&alive(S.sel)&&S.sel.side===S.phase)rings=targets(S.sel).map(u=>[u,'']);
    rings=rings.filter(([u])=>!subHidden(u)&&!(u.ship&&atSea(u))); // 地圖上沒畫出來的單位（船上的旅、隱蔽的潛艦）不畫圈
    rings.forEach(([u,c])=>{const [x0,y0]=cen(u.c,u.r),[sx,sy]=stackPos(u),x=x0+sx,y=y0+sy;o+='<circle class="ring '+c+'" cx="'+x+'" cy="'+y+'" r="15"/>';});
  }
  $('#gD').innerHTML=o;
  // slide units that moved since the previous render, pop in new ones
  const now=new Map(),k=fxK();ANIM.slid=false;
  document.querySelectorAll('#gD .u[data-id]').forEach(e=>{
    const id=+e.dataset.id,x=+e.dataset.x,y=+e.dataset.y;now.set(id,[x,y]);
    if(!ANIM.ok||ANIM.gid!==S.gid||reduce())return;
    const p=ANIM.pos.get(id);
    if(p){const dx=p[0]-x,dy=p[1]-y,dd=Math.hypot(dx,dy);if(dd>1&&dd<W*8){ANIM.slid=true;e.animate([{transform:'translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)'},{transform:'translate(0,0)'}],{duration:280*k,easing:'cubic-bezier(.2,.7,.2,1)'});}}
    else if(ANIM.pos.size)e.animate([{opacity:0,transform:'translateY(-14px)'},{opacity:1,transform:'translateY(0)'}],{duration:360*k,easing:'ease-out'});
  });
  ANIM.pos=now;ANIM.gid=S.gid;
}
