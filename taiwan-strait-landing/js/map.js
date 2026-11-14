'use strict';
// coordinates may be negative: columns COL0..COL1-1, rows ROW0..ROW1-1 (original Taiwan coordinates are unchanged)
// 格數加倍：遊戲格是舊版格子（粗格，R=26）的 2×2 細分；舊座標系（粗格）仍用於地形來源與外圍示意區
// 第 3b 階段：遊戲格往東延伸到約 128.5°E（粗格 OC1 16→30、細格 COL1 33→61），讓美航艦能在共軍艦射反艦飛彈射程外作戰；
// 預設畫面（縮放 100%）仍以原本的台灣範圍（OC1V）為準，東側要捲動或縮小才看得到
const OC0=-1, OC1=30, OC1V=16, OR0=-2, OR1=16, OR=26, OW=Math.sqrt(3)*OR, OPAD=6;
const OVBW=OW*(OC1V-OC0)+OW/2+OPAD*2, OVBH=1.5*OR*(OR1-OR0-1)+2*OR+OPAD*2+12;
const KS=16/(OR/2); // 細格相對舊座標系的放大倍率
const R=OR/2*KS, W=Math.sqrt(3)*R, PAD=6;
const OX0=1.5*OW+OPAD, OY0=4*OR+OPAD; // 細格中心在舊座標系中的原點
const COL0=-3, COL1=61, ROW0=-4, ROW1=32; // 細格索引範圍
const VBW=OVBW*KS, VBH=OVBH*KS, GVBW=(OW*(OC1-OC0)+OW/2+OPAD*2)*KS; // GVBW＝整個遊戲格的寬度
const oCenter=(c,r)=>[OW*(c-OC0+.5*(r&1))+OW/2+OPAD,(r-OR0)*1.5*OR+OR+OPAD];
// 外圍示意區（僅縮小時可見，不參與遊戲）：左／右／上／下的延伸量（舊座標系 px）
const oMX0=150, oMX1=760, oMY0=170, oMY1=400;
const MX0=oMX0*KS, MX1=oMX1*KS, MY0=oMY0*KS, MY1=oMY1*KS, EVBW=VBW+MX0+MX1, EVBH=VBH+MY0+MY1, EXT=EVBW/VBW;
// 地圖尺度：每格（相鄰格中心距離）約幾公里。射程、移動、距離一律用公里寫，再用 kmH() 換成格數；要改格子大小只改 KM_HEX（地形與地點座標另需重建）
const KM_HEX=20;
const kmH=km=>km/KM_HEX;
const K=(c,r)=>c+','+r;
const $=s=>document.querySelector(s);
let GEN=0; // 每次重新開局加一：舊的非同步流程（動畫等待中）不會再接續執行
const sleep=ms=>S&&S.rec?Promise.resolve():(g=>new Promise(r=>setTimeout(()=>{if(g===GEN)r();},ms*(S&&S.speed||1))))(GEN);
const NR=Math.random.bind(Math); // 原生亂數：只給動畫用，不吃種子，讓同一個戰局碼在不同機器上走同樣的結果
let SEEDF=null;
function seedRng(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
  let a=(h^h>>>16)>>>0;SEEDF=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};Math.random=SEEDF;}
const newSeed=()=>Math.floor(NR()*0x7fffffff).toString(36).toUpperCase().padStart(6,'0');
const d6=()=>1+Math.floor(Math.random()*6);
// 命中判定：基礎命中率 p 由武器與條件決定，骰子只帶來有限的運氣起伏（相對 ±22%，上限 100%）。
const LUCK=.22;let LAST={p:.5,r:3,pe:.5,hit:false};
const pNeed=need=>Math.max(.03,Math.min(.97,(7-need)/6)); // 舊的門檻 → 基礎命中率
function trial(p){const r=d6(),L=(r-3.5)/2.5,pe=Math.max(0,Math.min(1,p*(1+LUCK*L))),hit=Math.random()<pe;LAST={p,r,L,pe,hit};return hit;}
// 固定規則的命中判定（不擲骰）：把命中率累積起來，累積滿 1 就命中——10 發 90% 剛好中 9 發，3 發 33% 中 1 發，零頭留到下一次
const ACC={};
function hitP(p,key){const k=key||'x';p=Math.max(0,Math.min(1,p));let a=(ACC[k]===undefined?.5:ACC[k])+p,h=false;if(a>=1){a-=1;h=true;}ACC[k]=a;LAST={p,r:'—',L:0,pe:p,hit:h,det:true};return h;}
function takeInt(ev,key){const k=key||'x';const a=(ACC[k]===undefined?.5:ACC[k])+ev,n=Math.floor(a);ACC[k]=a-n;return n;}
const lastTxt=()=>LAST.det?'命中率 '+Math.round(LAST.p*100)+'%（固定規則）':'基礎 '+Math.round(LAST.p*100)+'%・運氣 '+((LAST.pe-LAST.p)>=0?'+':'')+Math.round((LAST.pe-LAST.p)*100)+'%（擲 '+LAST.r+'）→ '+Math.round(LAST.pe*100)+'%';
const SIDE={atk:'攻方',def:'守方'};
const TERN={sea:'海域',main:'大陸',plain:'平原',city:'城市',mtn:'山地',port:'港口',air:'機場'};

const TYPES={
  amph:{n:'兩棲合成旅',s:'兩棲',atk:3,def:3,mv:kmH(40),hp:3},
  mar:{n:'陸戰旅',s:'陸戰',atk:3,def:3,mv:kmH(40),hp:3},
  abn:{n:'空降旅',s:'空降',atk:3,def:2,mv:kmH(40),hp:2},
  arm:{n:'重型合成旅',s:'裝甲',atk:5,def:3,mv:kmH(60),hp:3},
  inf:{n:'聯兵旅',s:'步兵',atk:2,def:3,mv:kmH(40),hp:3},
  tank:{n:'裝甲旅',s:'裝甲',atk:4,def:3,mv:kmH(60),hp:3},
  res:{n:'後備旅',s:'後備',atk:2,def:2,mv:kmH(40),hp:2},
  ssm:{n:'岸置反艦飛彈',s:'飛彈',atk:0,def:1,mv:kmH(40),hp:2},
  hmr:{n:'海馬士火箭砲（HIMARS）',s:'海馬士',atk:0,def:1,mv:kmH(40),hp:2},
  mlrs:{n:'雷霆2000多管火箭',s:'雷霆',atk:0,def:1,mv:kmH(40),hp:2},
  dd:{n:'共軍護航艦',s:'護航',atk:2,def:1,mv:kmH(60),hp:2},
  cv:{n:'共軍航艦群',s:'航艦',atk:0,def:2,mv:kmH(60),hp:3},
  csg:{n:'美軍航艦打擊群',s:'美航艦',atk:0,def:3,mv:kmH(60),hp:3},
  d55:{n:'055 型驅逐艦',s:'055',atk:0,def:2,mv:kmH(60),hp:2},
  ssn:{n:'美軍 攻擊潛艦',s:'SSN',atk:0,def:1,mv:kmH(60),hp:2},
  nme:{n:'美陸戰隊 NMESIS 反艦飛彈',s:'NMESIS',atk:0,def:1,mv:0,hp:2},
  mdt:{n:'美陸軍 堤豐（多域特遣隊）',s:'堤豐',atk:0,def:1,mv:0,hp:2},
  tak:{n:'美軍 戰鬥支援艦',s:'補給',atk:0,def:1,mv:kmH(60),hp:2},
  ddh:{n:'海自 出雲級直升機護衛艦',s:'出雲',atk:0,def:2,mv:kmH(60),hp:2},
  jdg:{n:'海自 神盾護衛艦（摩耶級／愛宕級）',s:'神盾',atk:0,def:2,mv:kmH(60),hp:2},
  jdd:{n:'海自 通用護衛艦（代表其餘 5 艘）',s:'護衛艦',atk:0,def:1,mv:kmH(60),hp:2},
  d52:{n:'052D 型驅逐艦',s:'052D',atk:0,def:2,mv:kmH(60),hp:2},
  f54:{n:'054A 型護衛艦',s:'054A',atk:0,def:1,mv:kmH(60),hp:1},
  cg:{n:'提康德羅加級巡洋艦',s:'巡洋艦',atk:0,def:2,mv:kmH(60),hp:2},
  ddg:{n:'柏克級驅逐艦',s:'神盾艦',atk:0,def:2,mv:kmH(60),hp:2},
  ff:{n:'守方艦艇群（巡防艦、飛彈快艇）',s:'艦艇',atk:0,def:1,mv:kmH(60),hp:2},
  hk:{n:'海鯤潛艦',s:'潛艦',atk:0,def:1,mv:kmH(60),hp:2},
  lst:{n:'兩棲艦群',s:'兩棲艦',atk:0,def:1,mv:kmH(60),hp:2},
  ro:{n:'滾裝船團',s:'滾裝',atk:0,def:1,mv:kmH(40),hp:2},
  cvy:{n:'補給船團',s:'補給',atk:0,def:1,mv:kmH(40),hp:2}, // 滾裝客貨輪比軍艦慢：每回合最多航行 2 個舊格
  fob:{n:'灘頭補給站',s:'補給站',atk:0,def:2,mv:0,hp:3}
};
const WEATHER={
  good:{id:'good',n:'良好',sea:kmH(100),air:true,fire:0},
  fair:{id:'fair',n:'普通',sea:kmH(80),air:true,fire:0},
  bad:{id:'bad',n:'惡劣',sea:kmH(40),air:false,fire:-2}
};

Object.values(TYPES).forEach(t=>{t.mv*=2;}); // 格數加倍：移動力加倍，實際行進距離不變

/* ---------- map ---------- */
const TERC={}; // 舊版粗格地形（作為細格與外圍示意區的來源）
for(let r=OR0;r<OR1;r++)for(let c=OC0;c<OC1;c++)TERC[K(c,r)]={c,r,k:K(c,r),t:'sea',isl:null};
const COAST=[4,4,3,3,3,3,4,3,3,3,2,2,2,1,1,1,1,1]; // coast column per row, starting at OR0
for(let r=OR0;r<OR1;r++)for(let c=OC0;c<=COAST[r-OR0];c++)Object.assign(TERC[K(c,r)],{t:'main',isl:'CN'});
[[3,3,'port','福州'],[4,4,'port','平潭'],[2,4,'air','龍田'],[3,7,'port','泉州'],[2,9,'port','廈門'],
 [4,-2,'port','寧波'],[1,15,'port','汕頭'],[2,2,'air','長樂'],[2,6,'air','惠安'],
 [2,-1,'air','櫟社'],[2,0,'air','路橋'],[2,1,'air','龍灣'],[1,3,'air','武夷山'],[1,5,'air','連城'],[1,8,'air','龍海'],[1,9,'air','高崎'],[1,12,'air','潮汕']]
  .forEach(([c,r,t,n])=>Object.assign(TERC[K(c,r)],{t,name:n}));
const TW=[
 [11,1,'plain','淡水'],[12,1,'port','基隆'],
 [10,2,'plain','林口'],[11,2,'city','台北'],[12,2,'mtn'],
 [10,3,'air','桃園機場'],[11,3,'city','桃園'],[12,3,'mtn'],[13,3,'plain','宜蘭'],
 [9,4,'city','新竹'],[10,4,'plain','湖口'],[11,4,'mtn'],[12,4,'mtn'],[13,4,'plain',null,1],
 [9,5,'plain','苗栗'],[10,5,'plain'],[11,5,'mtn'],[12,5,'mtn'],[13,5,'plain',null,1],
 [9,6,'port','台中港'],[10,6,'city','台中'],[11,6,'mtn'],[12,6,'mtn'],[13,6,'port','花蓮'],
 [9,7,'plain','彰化',null,0,1],[10,7,'plain'],[11,7,'mtn'],[12,7,'mtn'],[13,7,'plain',null,1],
 [9,8,'plain','雲林',null,0,1],[10,8,'city','嘉義'],[11,8,'mtn'],[12,8,'mtn'],[13,8,'plain',null,1],
 [9,9,'city','台南'],[10,9,'plain'],[11,9,'mtn'],[12,9,'city','台東',1],
 [10,10,'port','高雄'],[11,10,'mtn'],[12,10,'plain',null,1],
 [10,11,'plain','屏東'],[11,11,'mtn'],
 [11,12,'plain','恆春']
];
TW.forEach(([c,r,t,n,cl,mud])=>Object.assign(TERC[K(c,r)],{t,name:n||null,cliff:!!cl,mud:!!mud,isl:'TW'}));
[[7,8,'port','馬公'],[7,9,'plain','澎湖']].forEach(([c,r,t,n])=>Object.assign(TERC[K(c,r)],{t,name:n,isl:'PH'}));

// 細格地形：每個粗格細分成 2×2，名稱／港口／機場只留在中心細格
const TER={};
for(let r=ROW0;r<ROW1;r++)for(let c=COL0;c<COL1;c++)TER[K(c,r)]={c,r,k:K(c,r),t:'sea',isl:null};
(function(){
  const cells=Object.values(TERC),cp=cells.map(h=>oCenter(h.c,h.r));
  for(const h of Object.values(TER)){
    const x=OW/2*(h.c+.5*(h.r&1))+OX0,y=.75*OR*h.r+OY0;let bi=0,bd=1e18;
    for(let i=0;i<cells.length;i++){const dx=cp[i][0]-x,dy=cp[i][1]-y,d=dx*dx+dy*dy;if(d<bd){bd=d;bi=i;}}
    const q=cells[bi],ctr=(h.c===2*q.c+(q.r&1)&&h.r===2*q.r);
    h.t=q.t;h.isl=q.isl;h.cliff=!!q.cliff;h.mud=!!q.mud;h.name=null;h.pc=q.c;h.pr=q.r;
    if(q.t==='port'||q.t==='air'){if(ctr)h.name=q.name||null;else{h.t='plain';}}
    else if(ctr)h.name=q.name||null;
  }
})();
// 粗格座標 → 細格座標（中心細格）
const MAINC={}; // 舊版大陸座標 → 新版（真實經緯度）大陸地點
const FK=k=>{if(MAINC[k])return MAINC[k];const [c,r]=k.split(',').map(Number);return K(2*c+(r&1),2*r);};
const FC=(c,r)=>[2*c+(r&1),2*r];
const cc=(c,r)=>{const [a,b]=FC(c,r);return center(a,b);};
const ADJ_KM=40; // 地面戰鬥的「相鄰」：40 km 內（20 km 一格時＝1～2 格，沿用舊版粗格的相鄰）
function ring2(h){ // 距離 ADJ_KM 內的格（相當於舊版的「相鄰」）
  if(h.n2)return h.n2;const seen=new Set([h.k]),out=[];let fr=[h];
  for(let d=0;d<Math.round(kmH(ADJ_KM));d++){const nx=[];for(const a of fr)for(const b of nbrs(a.c,a.r))if(!seen.has(b.k)){seen.add(b.k);out.push(b);nx.push(b);}fr=nx;}
  return h.n2=out;
}
function nbrs(c,r){
  const d=(r&1)?[[1,0],[1,-1],[0,-1],[-1,0],[0,1],[1,1]]:[[1,0],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1]];
  const o=[];for(const [dc,dr] of d){const a=c+dc,b=r+dr;if(a>=COL0&&a<COL1&&b>=ROW0&&b<ROW1)o.push(TER[K(a,b)]);}return o;
}
function cube(c,r){const x=c-(r-(r&1))/2;return [x,-x-r,r];}
// 射程用的直線距離（以「相鄰格中心距離＝1」為單位，1 單位約 20 km）：武器、雷達、防空的射程判定都用它，範圍是圓形；移動、相鄰、控制區仍用格數 hd
function rd(a,b){const [ax,ay]=center(a.c,a.r),[bx,by]=center(b.c,b.r);return Math.hypot(ax-bx,ay-by)/(KS*OW/2)-1e-9;}
function hd(a,b){const p=cube(a.c,a.r),q=cube(b.c,b.r);return Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]),Math.abs(p[2]-q[2]));}
const isLand=h=>h.t!=='sea';

// ---- 台灣本島與澎湖：依真實海岸線、山脈與城市位置重畫（大陸沿岸仍沿用舊版格局）
const GEO={r0:4,lat0:25.04,dlat:.1557,c0:18,lon0:120.5,dlon:.1917};
const llToRC=(lon,lat)=>{const r=Math.round(GEO.r0+(GEO.lat0-lat)/GEO.dlat);return [Math.round(GEO.c0+(lon-GEO.lon0)/GEO.dlon-.5*(r&1)),r];};
const rcToLL=(c,r)=>[GEO.lon0+(c+.5*(r&1)-GEO.c0)*GEO.dlon,GEO.lat0-(r-GEO.r0)*GEO.dlat];
const SPOT={};
(function(){
  const TWP=[[121.50,25.30],[121.68,25.28],[121.75,25.15],[121.93,25.05],[122.00,25.00],[121.90,24.83],[121.85,24.60],[121.78,24.35],[121.65,24.15],[121.62,24.00],[121.52,23.55],[121.40,23.10],[121.20,22.78],[120.95,22.40],[120.86,21.90],[120.72,22.00],[120.62,22.35],[120.42,22.50],[120.27,22.60],[120.15,22.95],[120.10,23.30],[120.12,23.38],[120.17,23.77],[120.30,24.10],[120.50,24.28],[120.68,24.48],[120.80,24.65],[120.92,24.85],[121.05,25.08],[121.30,25.13],[121.42,25.18]];
  const inPoly=(x,y,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,yi]=P[i],[xj,yj]=P[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
  const RID=[[121.60,24.95],[121.35,24.50],[121.15,24.00],[120.98,23.50],[120.95,23.00],[120.85,22.50],[120.85,22.20]];
  const ridge=lat=>{for(let i=0;i<RID.length-1;i++){const a=RID[i],b=RID[i+1];if(lat<=a[1]&&lat>=b[1]){const t=(a[1]-lat)/(a[1]-b[1]);return a[0]+(b[0]-a[0])*t;}}return lat>RID[0][1]?RID[0][0]:RID[RID.length-1][0];};
  const hw=lat=>lat>24.9||lat<22.3?.11:lat>24.7||lat<22.6?.16:.2;
  for(const h of Object.values(TER))if(h.isl==='TW'||h.isl==='PH'){h.t='sea';h.isl=null;h.name=null;h.cliff=false;h.mud=false;}
  const tw=[];
  for(const h of Object.values(TER)){
    if(h.t!=='sea')continue;const [lon,lat]=rcToLL(h.c,h.r);
    if(lon<119.9||lon>122.2||lat<21.8||lat>25.4)continue;
    if(inPoly(lon,lat,TWP)){h.t='plain';h.isl='TW';h.lon=lon;h.lat=lat;tw.push(h);}
  }
  const plainE=(lon,lat)=>(lat>24.52&&lat<24.88&&lon>121.55)||(lat>23.6&&lat<24.15&&lon>121.38&&lon<121.8)||(lat>22.55&&lat<23.05&&lon>121.0&&lon<121.3)||lat<22.35;
  for(const h of tw){const rl=ridge(h.lat);if(h.lon>=rl-hw(h.lat)*.9&&(h.lon<=rl+hw(h.lat)||!plainE(h.lon,h.lat)))h.t='mtn';}
  // 海岸旗標：東岸斷崖、西岸泥灘
  const coastal=h=>nbrs(h.c,h.r).some(n=>n.t==='sea');
  for(const h of tw){
    if(!coastal(h))continue;
    if(h.lon>121.3&&h.lat>22.9&&h.lat<24.6&&!(h.lat>23.85&&h.lat<24.1))h.cliff=true;
    if(h.lat>22.9&&h.lat<24.8&&h.lon<121.0&&h.t==='plain'&&h.lat>23.55&&h.lat<24.2)h.mud=true;
  }
  // 地點
  const near=(lon,lat,filter)=>{let best=null,bd=1e9;for(const h of tw){if(filter&&!filter(h))continue;const d=Math.hypot((h.lon-lon)/GEO.dlon,(h.lat-lat)/GEO.dlat);if(d<bd){bd=d;best=h;}}return best;};
  const put=(id,name,type,lon,lat,opt)=>{opt=opt||{};const h=near(lon,lat,opt.coast?(x=>coastal(x)&&x.t!=='sea'&&!x.named):(x=>!x.named));if(!h)return;h.t=type;h.name=name;h.named=true;h.cliff=!!opt.cliff;h.mud=false;SPOT[id]=h.k;
    if(opt.ring)nbrs(h.c,h.r).filter(n=>n.isl==='TW'&&!n.named&&n.t!=='sea').slice(0,opt.ring).forEach(n=>{n.t='city';n.cliff=false;n.mud=false;});};
  put('taipei','台北','city',121.52,25.04,{ring:2});
  put('keelung','基隆','port',121.74,25.13,{coast:1});
  put('tamsui','台北港','port',121.44,25.17,{coast:1}); // 淡水河口：南岸八里的台北港（深水商港，貨櫃與汽車滾裝碼頭）與淡水同一格
  put('linkou','林口','plain',121.35,25.08);
  put('taoyuanap','桃園機場','air',121.23,25.08);
  put('taoyuan','桃園','city',121.30,24.99);
  put('hsinchu','新竹','city',120.97,24.80);
  put('hsinchuab','新竹基地','air',120.94,24.82);
  put('hukou','湖口','plain',121.04,24.90);
  put('miaoli','苗栗','plain',120.82,24.56);
  put('tcport','台中港','port',120.52,24.28,{coast:1});
  put('ckk','清泉崗','air',120.62,24.26);
  put('taichung','台中','city',120.67,24.15,{ring:1});
  put('changhua','彰化','plain',120.54,24.07);
  put('yunlin','雲林','plain',120.40,23.72);
  put('chiayi','嘉義','city',120.45,23.48);
  put('chiayiab','嘉義基地','air',120.39,23.46);
  put('tainan','台南','city',120.20,23.00);
  put('tainanab','台南基地','air',120.21,22.95);
  put('gangshan','岡山基地','air',120.27,22.79);
  put('kaohsiung','高雄','port',120.28,22.61,{coast:1});
  put('pingtung','屏東基地','air',120.46,22.70);
  put('pingtungc','屏東','plain',120.50,22.66);
  put('hengchun','恆春','plain',120.76,22.00);
  put('yilan','宜蘭','plain',121.75,24.75);
  put('suao','蘇澳','port',121.86,24.60,{coast:1,cliff:0});
  put('hualien','花蓮','port',121.60,23.98,{coast:1});
  put('chiashan','佳山基地','air',121.58,24.00);
  put('taitung','台東','city',121.14,22.76);
  put('chihhang','志航基地','air',121.10,22.76);
  // 澎湖：馬公本島（2 格）與白沙（1 格，與本島隔海）；沒有駐軍的小島（望安、七美、西嶼等）不畫出
  const pc=llToRC(119.57,23.57),ph=TER[K(pc[0],pc[1])];
  if(ph){
    const sea=x=>x&&x.t==='sea';
    ph.t='port';ph.isl='PH';ph.name='馬公';SPOT.magong=ph.k;
    const m2=nbrs(ph.c,ph.r).find(h=>sea(h)&&h.c<=ph.c)||nbrs(ph.c,ph.r).find(sea);
    if(m2){m2.t='plain';m2.isl='PH';}
    const adj=new Set([ph.k,m2&&m2.k]);nbrs(ph.c,ph.r).forEach(h=>adj.add(h.k));if(m2)nbrs(m2.c,m2.r).forEach(h=>adj.add(h.k));
    let bsha=null;
    for(const h of Object.values(TER)){if(!sea(h)||adj.has(h.k)||Math.abs(h.c-ph.c)>3||Math.abs(h.r-ph.r)>3)continue;
      if(h.r<=ph.r&&hd(h,ph)===kmH(40)&&h.c>=ph.c){bsha=h;break;}}
    if(!bsha)bsha=Object.values(TER).find(h=>sea(h)&&!adj.has(h.k)&&hd(h,ph)===kmH(40));
    if(bsha){bsha.t='plain';bsha.isl='PH';bsha.name='白沙';SPOT.penghu=bsha.k;}
  }
  tw.forEach(h=>{h.pc=h.c;h.pr=h.r;});
  // 同名的外島仍屬澎湖；補上需要的別名
  SPOT.tcity=SPOT.taichung;
})();
// ---- 大陸沿岸（福建、廣東）：依真實海岸線與地點經緯度重畫
const SPOTC={};
(function(){
  const COASTL=[[120.35,26.8],[119.9,26.5],[119.62,26.25],[119.68,25.95],[119.8,25.62],[119.6,25.35],[119.15,25.25],[118.95,24.98],[118.65,24.62],[118.2,24.45],[117.95,24.3],[117.5,23.7],[117.0,23.4],[116.7,23.2],[116.0,22.85],[115.4,22.7],[114.9,22.3],[114.6,22.1]];
  const poly=[[114.0,27.2],[120.5,27.2]].concat(COASTL,[[114.0,22.1]]);
  const inPoly=(x,y,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,yi]=P[i],[xj,yj]=P[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
  for(const h of Object.values(TER))if(h.isl==='CN'){h.t='sea';h.isl=null;h.name=null;h.cliff=false;h.mud=false;}
  const cn=[];
  for(const h of Object.values(TER)){
    if(h.t!=='sea')continue;const [lon,lat]=rcToLL(h.c,h.r);
    if(inPoly(lon,lat,poly)){h.t='main';h.isl='CN';h.lon=lon;h.lat=lat;cn.push(h);}
  }
  const coastalC=h=>nbrs(h.c,h.r).some(n=>n.t==='sea');
  const dist=(h,lon,lat)=>Math.hypot((rcToLL(h.c,h.r)[0]-lon)/GEO.dlon,(rcToLL(h.c,h.r)[1]-lat)/GEO.dlat);
  const nearC=(lon,lat,filter)=>{let best=null,bd=1e9;for(const h of cn){if(filter&&!filter(h))continue;const d=dist(h,lon,lat);if(d<bd){bd=d;best=h;}}return best;};
  const put=(id,name,type,lon,lat,coast)=>{const h=nearC(lon,lat,x=>!x.named&&(!coast||coastalC(x)));if(!h)return;h.t=type;h.name=name;h.named=true;SPOTC[id]=h.k;SPOTC[name]=h.k;};
  put('fuzhou','福州','port',119.62,26.0,1);put('pingtan','平潭','port',119.78,25.52,1);put('quanzhou','泉州','port',118.65,24.85,1);
  put('xiamen','廈門','port',118.12,24.46,1);put('shantou','汕頭','port',116.72,23.36,1);
  put('changle','長樂','air',119.66,25.93);put('longtian','龍田','air',119.45,25.7);put('huian','惠安','air',118.8,25.0);
  put('liancheng','連城','air',116.75,25.7);put('longhai','龍海','air',117.82,24.43);put('gaoqi','高崎','air',118.1,24.56);put('chaoshan','潮汕','air',116.5,23.56);
  const AN={fuding:[120.2,26.7],lianjiang:[119.6,26.25],fuzhou:[119.62,26.0],pingtan:[119.78,25.52],putian:[119.1,25.3],huian:[118.9,25.0],quanzhou:[118.65,24.85],jinjiang:[118.55,24.7],xiamen:[118.12,24.46],dongshan:[117.5,23.75],shantou:[116.72,23.36]};
  const used={};
  const pick=(an,i)=>{const [lon,lat]=AN[an];const list=cn.filter(h=>coastalC(h)).sort((a,b)=>dist(a,lon,lat)-dist(b,lon,lat));return list[i]||list[0];};
  const M={'3,0':['fuding',0],'4,-1':['fuding',1],'4,-2':['fuding',2],'3,1':['lianjiang',0],'3,2':['fuzhou',1],'3,3':['fuzhou',0],'4,4':['pingtan',0],'3,4':['pingtan',1],'3,5':['putian',0],'3,6':['huian',0],'3,7':['quanzhou',0],'2,8':['jinjiang',0],'2,9':['xiamen',0],'2,10':['xiamen',1],'1,9':['xiamen',2],'1,10':['dongshan',0],'1,14':['shantou',1],'1,15':['shantou',0]};
  for(const [k,[an,i]] of Object.entries(M)){const h=an==='fuzhou'&&i===0?TER[SPOTC.fuzhou]:an==='pingtan'&&i===0?TER[SPOTC.pingtan]:an==='quanzhou'&&i===0?TER[SPOTC.quanzhou]:an==='xiamen'&&i===0?TER[SPOTC.xiamen]:an==='shantou'&&i===0?TER[SPOTC.shantou]:pick(an,i);if(h)MAINC[k]=h.k;}
  MAINC['2,4']=SPOTC['龍田'];MAINC['2,6']=SPOTC['惠安'];
})();
// ---- 金門、馬祖（外島，貼近大陸沿岸）：地圖上為小島，守軍少
(function(){
  const seaNear=(lon,lat)=>{const [c,r]=llToRC(lon,lat);let h=TER[K(c,r)];if(h&&h.t==='sea')return h;return Object.values(TER).filter(x=>x.t==='sea').sort((a,b)=>hd(a,TER[K(c,r)]||a)-hd(b,TER[K(c,r)]||b))[0];};
  const mk=(id,name,base,n)=>{
    base.t='port';base.isl='KM';base.name=name;base.kmId=id;SPOT[id]=base.k;
    nbrs(base.c,base.r).filter(h=>h.t==='sea').slice(0,n).forEach((h,i)=>{h.t='plain';h.isl='KM';h.kmId=id;if(i===0)SPOT[id+'2']=h.k;});
  };
  mk('kinmen','金門',seaNear(118.37,24.45),2);
  mk('matsu','馬祖',seaNear(119.97,26.18),1);
})();

// 外圍與遊戲格內的島鏈：「線段＋半徑」(度)；與那國依真實位置（約 123.0°E）
const ISL_CAP=[ // [lon1,lat1,lon2,lat2,半徑]
  [128.28,26.86,127.68,26.12,.13], // 沖繩本島（東北—西南向細長）
  [129.5,28.5,129.25,28.12,.1],[128.95,27.85,128.9,27.75,.08],[128.6,27.4,128.55,27.33,.07], // 奄美、德之島、沖永良部
  [126.8,26.36,126.75,26.32,.08], // 久米島
  [125.33,24.8,125.25,24.74,.11],[124.3,24.5,124.1,24.38,.11],[123.85,24.38,123.75,24.3,.1],[123.05,24.47,122.94,24.45,.07], // 宮古、石垣、西表、與那國
  [130.55,30.4,130.45,30.3,.1],[131.05,30.62,130.95,30.4,.08], // 屋久島、種子島
  [121.97,20.4,121.99,20.36,.1],[121.83,20.6,121.85,20.56,.1],[121.87,20.25,121.89,20.22,.06], // 巴丹、伊特巴雅特、薩布坦
  [121.95,19.5,121.95,19.45,.1],[121.47,19.35,121.45,19.3,.1],[121.9,18.95,121.9,18.93,.07],[121.35,18.87,121.33,18.86,.06], // 巴布煙群島
];
// 遊戲格內的琉球島嶼（與那國、西表、石垣、宮古、沖繩南部）：畫成日本的陸地格；太小的島至少占最近的一格
(function(){
  const sea=Object.values(TER).filter(h=>h.t==='sea'&&rcToLL(h.c,h.r)[0]>122.6);
  for(const [x1,y1,x2,y2,r] of ISL_CAP){
    if(Math.max(x1,x2)<122.6||Math.min(x1,x2)>128.7||Math.min(y1,y2)>26.4||Math.max(y1,y2)<20.8)continue;let n=0,best=null,bd=1e9;
    for(const h of sea){if(h.t!=='sea')continue;const [lon,lat]=rcToLL(h.c,h.r),k=Math.cos(lat*Math.PI/180),dx=(x2-x1)*k,dy=y2-y1,px=(lon-x1)*k,py=lat-y1,L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,(px*dx+py*dy)/L)):0,d=Math.hypot(px-t*dx,py-t*dy);
      if(d<=r){h.t='plain';h.isl='JP';n++;}else if(d<bd){bd=d;best=h;}}
    if(!n&&best&&bd<.2){best.t='plain';best.isl='JP';}
  }
  const jp=Object.values(TER).filter(h=>h.isl==='JP');
  [['與那國',123.0,24.46],['西表',123.8,24.33],['石垣',124.17,24.4],['宮古島',125.3,24.78],['沖繩',127.7,26.2]].forEach(([n,lon,lat])=>{let b=null,bd=1e9;
    for(const h of jp){if(h.name)continue;const [a,c]=rcToLL(h.c,h.r),d=Math.hypot(a-lon,c-lat);if(d<bd){bd=d;b=h;}}if(b&&bd<.35)b.name=n;});
})();
Object.values(TER).forEach(h=>{h.coastal=isLand(h)&&nbrs(h.c,h.r).some(n=>n.t==='sea');});

const TAIPEI=SPOT.taipei, PORTS=[SPOT.keelung,SPOT.tamsui,SPOT.tcport,SPOT.kaohsiung], MAGONG=SPOT.magong;
// 主要港口的戰時卸載容量（每回合可支撐的旅數，★推估）：依 2024（民國 113）年貨物裝卸量（計費噸）的相對比例，以基隆＝4 為基準（原本每個主要港口都是 4）——
//  高雄約 4.07 億、台中港約 1.36 億、台北港約 0.81 億、基隆約 0.66 億計費噸（台中港、台北港的統計期間與口徑未完全確認）；其他港口（蘇澳、花蓮、馬公）維持 4
const PORTCAP={[SPOT.keelung]:4,[SPOT.tamsui]:5,[SPOT.tcport]:8,[SPOT.kaohsiung]:25};
const portCap=k=>PORTCAP[k]||4;
const PORT_NEED0=8; // ★港口條件的最低門檻＝原本「2 個主要港口 × 4」
function portHold(){ // 攻方控制（未被破壞）的主要港口卸載容量，對上島上部隊的補給需求
  const cap=PORTS.filter(k=>S.owner[k]==='atk'&&!S.portDown[k]).reduce((a,k)=>a+portCap(k),0);
  const need=Math.max(PORT_NEED0,S.units.filter(u=>u.side==='atk'&&onTW(u)&&!isSup(u)).length);
  return {cap,need,ok:cap>=need};
}
// 麥寮港（雲林，台塑六輕工業專用港）：年吞吐量約 7,000 萬噸以上、可進出 30 萬噸級油輪的深水港，但碼頭多為石化、煤、油專用，不是貨櫃或滾裝碼頭——列為次要港口；也是雲林泥灘海岸唯一能靠岸卸載的地方
const MINOR_PORTS={'17,12':'麥寮港','20,5':'新竹港','16,17':'安平港','25,6':'烏石港','21,18':'富岡港'}; // 次要港口：占領後補給容量 +2（共 3），不計入勝負條件、重型旅仍需主要港口才能上岸
const ZONES={north:[SPOT.linkou,SPOT.tamsui,SPOT.taoyuanap],central:[SPOT.miaoli,SPOT.hsinchu,SPOT.tcport],penghu:[SPOT.penghu,SPOT.magong]};

const ABN_GOAL={north:[SPOT.taoyuanap,SPOT.taoyuan],central:[SPOT.miaoli,SPOT.changhua]};
