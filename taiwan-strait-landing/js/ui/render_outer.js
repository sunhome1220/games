'use strict';
/* 外圍示意區（日本、菲律賓、大陸沿岸）的繪製（自 render.js 拆出） */
/* ---------- 外圍示意區：宮古／先島、舟山、黃山、梅州、呂宋北部（縮小地圖時可見） ---------- */
const FAR={};
let GUAM_LL=null; // 關島示意位置（供海底地形判斷）
// 外圍示意區的地標：以真實經緯度定位（粗格座標 = 細格像素 / KS），陸地形狀見 ISLANDS
// 知名地標：只在放大到 900% 以上時顯示（#map.zhi），不能點選、不影響規則。位置為實際經緯度；圖示以底部中央為原點、高約 10 單位
const LM_SEG=[0,1,2,3,4].map(i=>'M-1.2 '+(-2.5-i*1.2)+'L-1.8 '+(-3.7-i*1.2)+'L1.8 '+(-3.7-i*1.2)+'L1.2 '+(-2.5-i*1.2)+'Z').join('');
const LANDMARKS=[
  ['台北101',121.5645,25.0340,'<path d="M-2.1 0L-1.6 -2.5L1.6 -2.5L2.1 0Z'+LM_SEG+'M-.7 -8.5L-.7 -9.4L.7 -9.4L.7 -8.5Z"/><path class="ln" d="M0 -9.4L0 -11.6"/>'],
  ['總統府',121.5119,25.0400,'<path d="M-5.2 0L-5.2 -2.4L-4 -2.4L-4 -3.5L-3 -3.5L-3 -2.4L-1 -2.4L-1 -6.4L0 -7.8L1 -6.4L1 -2.4L3 -2.4L3 -3.5L4 -3.5L4 -2.4L5.2 -2.4L5.2 0Z"/>'],
  ['高雄85大樓',120.3000,22.6117,'<path d="M-2.7 0L-2.7 -6.2L-1.1 -6.2L-1.1 -9.6L1.1 -9.6L1.1 -6.2L2.7 -6.2L2.7 0L1.1 0L1.1 -3.8L-1.1 -3.8L-1.1 0Z"/><path class="ln" d="M0 -9.6L0 -11.6"/>'],
  ['彰化大佛',120.5497,24.0780,'<circle cx="0" cy="-6.3" r="1.25"/><circle cx="0" cy="-7.7" r=".55"/>'+
    '<path d="M-1.5 -5.1Q-3.1 -3.6 -3.6 -1.9L-4.8 -1.2L-4.8 0L4.8 0L4.8 -1.2L3.6 -1.9Q3.1 -3.6 1.5 -5.1Z"/><path d="M-5.4 .4L5.4 .4L4.4 1.5L-4.4 1.5Z"/>'],
  ['淡江大橋',121.4180,25.1700,'<path class="ln" d="M-8 -1.6L8 -1.6M-1.5 0L-1.5 -9M-1.5 -8.6L-7 -1.6M-1.5 -7.4L-5.2 -1.6M-1.5 -6.2L-3.4 -1.6M-1.5 -8.6L6.5 -1.6M-1.5 -7.4L4.3 -1.6M-1.5 -6.2L2 -1.6"/>']];
function landmarkSVG(){
  const s=R*.055;let o='<g class="lmk">';
  for(const [n,lon,lat,g] of LANDMARKS){
    const [c,r]=llToRC(lon,lat),h=TER[K(c,r)],p=llPx(lon,lat),x=p[0],y=p[1]-(h?elev(h):0);
    o+='<g data-x="'+x.toFixed(1)+'" data-y="'+y.toFixed(1)+'" transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') scale('+s.toFixed(3)+')">'+g+'<text y="5.6" text-anchor="middle">'+n+'</text></g>';
  }
  return o+'</g>';
}
function landmarkDim(){ // 地標和棋子重疊時變淡，不擋住棋子上的字
  if(!$('#map').classList.contains('zhi'))return;
  const us=S&&S.units?S.units.map(u=>cen(u.c,u.r)):[];
  document.querySelectorAll('#gL .lmk>g').forEach(e=>{
    const x=+e.dataset.x,y=+e.dataset.y;
    e.classList.toggle('dim',us.some(p=>x-p[0]>-.7*R&&x-p[0]<1.3*R&&y-p[1]>-.9*R&&y-p[1]<1.15*R));
  });
}
// 外圍大陸沿岸的重要城市名稱（真實位置；只是地標文字、不能點選、不影響規則；寧波、舟山、福州、廈門等已有基地標記的不重複）
const FAR_CITIES=[['上海',121.47,31.23],['杭州',120.15,30.27],['金華',119.65,29.08]];
const FAR_AIRCITY={'櫟社':'寧波','路橋':'台州','龍灣':'溫州'}; // 機場標記旁註明所在城市（寧波、台州、溫州不另外畫城市點，免得和機場標記疊在一起）
const llPx=(lon,lat)=>{const o=center(GEO.c0,GEO.r0),ox=center(GEO.c0+1,GEO.r0)[0]-o[0],oy=center(GEO.c0,GEO.r0+1)[1]-o[1];
  return [o[0]+(lon-GEO.lon0)/GEO.dlon*ox,o[1]+(GEO.lat0-lat)/GEO.dlat*oy];};
function farPlace(lon,lat,t,name,tag,who){const [x,y]=llPx(lon,lat);FAR[name]={lon,lat,x:x/KS,y:y/KS,t,name,tag:tag||null,who:who||null};}
function farSchem(c,r,t,name,tag,who){const [x,y]=oCenter(c,r);FAR[name]={x,y,t,name,tag:tag||null,who:who||null,schem:true};} // 圖外的地點：示意位置（粗格座標）
const llInv=(px,py)=>{const o=center(GEO.c0,GEO.r0),ox=center(GEO.c0+1,GEO.r0)[0]-o[0],oy=center(GEO.c0,GEO.r0+1)[1]-o[1];return [GEO.lon0+(px-o[0])/ox*GEO.dlon,GEO.lat0-(py-o[1])/oy*GEO.dlat];};
(function(){
  // 大陸機場與基地：實際位置在圖外北側，以示意位置標示
  // 2026-11-18.51 起一律用真實經緯度（舊版是示意位置，舟山畫在東引正上方、與真實海岸線對不上）
  farPlace(118.26,29.73,'air','黃山','火箭軍','atk'); farPlace(116.3,24.6,'air','梅州','火箭軍','atk');
  farPlace(121.46,29.83,'air','櫟社','東部戰區','atk'); farPlace(121.43,28.56,'air','路橋','東部戰區','atk'); farPlace(120.85,27.91,'air','龍灣','東部戰區','atk'); farPlace(118.0,27.7,'air','武夷山','東部戰區','atk');
  farPlace(122.25,30.05,'port','舟山','東部戰區','atk');
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
  [[120.5,18.5],[120.78,18.58],[121.07,18.62],[121.25,18.6],[121.45,18.5],[121.63,18.37],[121.82,18.3],[122.0,18.3],[122.12,18.42],[122.2,18.5],[122.22,18.38],[122.3,
      18.1],[122.36,17.7],[122.5,17.2],[122.48,16.9],[122.4,16.6],[122.22,16.38],[122.15,16.28],[122.02,16.05],[121.75,15.85],[121.6,15.7],[121.45,15.4],[119.95,15.4],
      [119.9,15.8],[119.9,16.15],[119.88,16.4],[120.1,16.35],[120.2,16.12],[120.3,16.0],[120.4,16.2],[120.33,16.62],[120.35,17.1],[120.38,17.57],[120.45,17.95],[120.52,
      18.2]] // 呂宋北部（Cape Engaño、Casiguran 灣、Lingayen 灣、Cape Bolinao）
];
// 圖外地點的示意形狀：以示意位置為錨點，縮小後畫出（九州 0.5 倍、關島原尺寸、舟山群島）
(function(){
  const sch=(name,pts,sc,cap)=>{const f=FAR[name];if(!f)return;const [aL,aB]=llInv(f.x*KS,f.y*KS),[rL,rB]=cap||[0,0];
    return pts.map(([x,y])=>[aL+(x-rL)*sc,aB+(y-rB)*sc]);};
  ISL_POLY.push(sch('佐世保',[[129.65,33.2],[129.9,33.6],[130.3,33.65],[130.9,33.95],[131.1,33.6],[131.7,33.3],[131.9,32.6],[131.65,31.7],[131.35,31.15],[131.05,31.0],[130.7,31.0],[130.2,31.1],[130.2,31.6],[130.2,32.3],[129.95,32.55],[129.6,32.9]],.5,[129.72,33.17]));
  const g=sch('關島',[[144.78,13.62],[144.9,13.28]],1,[144.85,13.5]);GUAM_LL=[(g[0][0]+g[1][0])/2,(g[0][1]+g[1][1])/2];ISL_CAP.push([g[0][0],g[0][1],g[1][0],g[1][1],.1]);
  ISL_CAP.push([122.0,30.15,122.3,29.95,.13]); // 舟山群島（真實位置、舟山本島一帶，半徑留一點寬度讓窄島至少占一格）
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
const orgPick=k=>{const a=ORG[k];return a?a[Math.floor(NR()*a.length)].slice():null;};
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
// 點是否落在帶狀水道內：W＝[[經度,緯度,半寬 km],…]，沿折線線性內插半寬
function inWaterBand(lon,lat,W){const kx=111.2*Math.cos(lat*Math.PI/180),ky=111.2;
  for(let i=0;i<W.length-1;i++){const [x1,y1,w1]=W[i],[x2,y2,w2]=W[i+1],dx=(x2-x1)*kx,dy=(y2-y1)*ky,px=(lon-x1)*kx,py=(lat-y1)*ky,L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,(px*dx+py*dy)/L)):0;
    if(Math.hypot(px-t*dx,py-t*dy)<=w1+(w2-w1)*t)return true;}
  return false;}
// 極簡畫質的平面地形色（與 tileGrad 的漸層同色系，不做漸層）：key → [CSS 變數, 不支援 color-mix 時的備用色]
const ULC={plain:['land','#d9d1ad'],city:['city','#cfc4a0'],mtn:['mtn','#b5a47c'],main:['main','#c8c4b8'],plain2:['land2','#d3d0a8'],plain3:['land3','#dfd5b3'],hill:['hill','#c9bd92'],main2:['main2','#c3c6b6'],main3:['main3','#cec8b8'],
  mainhill:['mainhill','#b9b3a1'],mainmtn:['mainmtn','#a39d8c'],maincity:['maincity','#d4cfc2'],tcity:['tcity','#b8b6ae'],town:['town','#b4c0a2'],
  e0:['e0','#a9c98b'],e1:['e1','#c3cc8f'],e2:['e2','#c9bd86'],e3:['e3','#b3a374'],e4:['e4','#998b62'],e5:['e5','#7f7552'],e6:['e6','#686344']};
const ulFill=k=>{const c=ULC[k]||ULC.plain;return 'fill="'+c[1]+'" style="fill:color-mix(in srgb,var(--'+c[0]+') 85%,#fff)"';};
function buildFar(){
  // 外圍示意區：地形一律用與遊戲格相同的細格；標示、投射區仍用舊座標系（粗格）再整組縮放 KS 對齊
  const center=oCenter,VBW=OVBW,VBH=OVBH,W=OW,R=OR,COL0=OC0,COL1=OC1,ROW0=OR0,ROW1=OR1,MX0=oMX0,MX1=oMX1,MY0=oMY0,MY1=oMY1,EVBW=OVBW+oMX0+oMX1,EVBH=OVBH+oMY0+oMY1,TER=TERC;
  const RF=FINE.R,fx0=-oMX0*KS-RF*2,fx1=(OVBW+oMX1)*KS+RF*2,fy0=-oMY0*KS-RF*2,fy1=(OVBH+oMY1)*KS+RF*2;
  const POLY=[[112,31.5],[122.3,31.5],[122.0,30.8],[122.2,30.0],[121.9,29.6],[121.8,29.0],[121.5,28.5],[120.9,27.9],[120.5,27.4],[120.35,26.8],[119.9,26.5],[119.62,
      26.25],[119.68,25.95],[119.8,25.62],[119.6,25.35],[119.15,25.25],[118.95,24.98],[118.65,24.62],[118.2,24.45],[117.95,24.3],[117.5,23.7],[117.0,23.4],[116.7,23.2],
      [116.0,22.85],[115.4,22.7],[114.9,22.3],[114.6,22.1],[113.8,22.3],[112,22.3]];
  const inPoly=(x,y,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,yi]=P[i],[xj,yj]=P[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
  const farL=Object.values(FAR).map(f=>[f.x*KS,f.y*KS,f]);
  const fine=new Map();
  const cMin=Math.floor((fx0/KS-OX0)/(OW/FG))-4,cMax=Math.ceil((fx1/KS-OX0)/(OW/FG))+4,rMin=Math.floor((fy0/KS-OY0)/(1.5*OR/FG))-4,rMax=Math.ceil((fy1/KS-OY0)/(1.5*OR/FG))+4; // 依外圍範圍算出要掃的格（不再寫死，否則擴大範圍後右、下角會缺格）
  for(let r=rMin;r<=rMax;r++)for(let c=cMin;c<=cMax;c++){
    if(c>=FINE.c0&&c<FINE.c1&&r>=FINE.r0&&r<FINE.r1)continue;
    const [x,y]=fineCenter(c,r);if(x<fx0||x>fx1||y<fy0||y>fy1)continue;
    const [lon,lat]=rcToLL(c,r);let t='sea',name=null;
    if(typeof OUTER_WATER!=='undefined'&&inWaterBand(lon,lat,OUTER_WATER))t='sea'; // 寬河道（長江下游）：當水格，不畫細線
    else if(typeof OUTER_LAND!=='undefined'?inPoly(lon,lat,OUTER_LAND):inPoly(lon,lat,POLY))t='main'; // 真實海岸線（js/data/outer.js）；沒有資料時退回手繪
    else if(inIsl(lon,lat))t='plain';
    fine.set(K(c,r),{c,r,x,y,t});
  }
  OFINE=fine;
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
  let fineSvg='';let wi=0;const seaD={},wvF=[[],[],[],[],[],[],[],[],[]]; // 浪紋依動畫延遲分 9 組，每組一個 path； // 細格海面：同色的海格合併成一個 path（約 4,000 個節點 → 數個）
  const farBand=h=>{const [lo,la]=rcToLL(h.c,h.r);return la>27.9||lo<115.1;}; // 後來擴大的北、西外圍：只畫色塊，不畫山丘細節與海浪（節點太多手機會慢）
  const ulF={}; // 極簡畫質：外圍陸地依地形分類合併成平面色塊 path（約 8,000 個 polygon → 十幾個 path）；有名稱可點的格子仍單獨畫
  for(const h of fine.values()){
    if(h.t==='sea'){const [slon,slat]=rcToLL(h.c,h.r),dd=dist.get(K(h.c,h.r)),sc=seaClass(slon,slat,dd);(seaD[sc]=seaD[sc]||[]).push('M'+hexPts(h.x,h.y,RF).replace(/ /g,'L')+'Z');
      if(!LITE&&!ULTRA&&sc!=='d1'&&(h.c+h.r)%2===0&&!farBand(h))wvF[wi++%9].push('M'+(h.x-6)+' '+(h.y+1)+'q3 -3 6 0t6 0');}
    else if(ULTRA&&!clickOf[K(h.c,h.r)]){const kk=VTKEY(h.vt,h.t==='main');(ulF[kk]=ulF[kk]||[]).push('M'+hexPts(h.x,h.y,RF).replace(/ /g,'L')+'Z');}
    else{const nm=clickOf[K(h.c,h.r)];if(ULTRA){const kk=VTKEY(h.vt,h.t==='main');fineSvg+='<polygon class="tl-far fclick" '+ulFill(kk)+' stroke="var(--land-edge)" stroke-width=".5" points="'+hexPts(h.x,h.y,RF)+'" data-far="'+nm+'"/>';continue;}
      fineSvg+='<polygon class="tl-far'+(nm?' fclick':'')+'" fill="url(#gt-'+VTKEY(h.vt,h.t==='main')+')" stroke="var(--land-edge)" stroke-width=".5" points="'+hexPts(h.x,h.y,RF)+'"'+(nm?' data-far="'+nm+'"':'')+'/>';
      if(!farBand(h)&&(h.vt==='mtn'||h.vt==='city'||(!LITE&&h.vt==='hill'&&((h.c*7+h.r*13)&3)!==0)))fineSvg+='<g pointer-events="none" opacity=".9">'+tileDetail({t:h.vt,vt:h.vt,c:h.c,r:h.r},h.x,h.y)+'</g>';}
  }
  fineSvg+=Object.entries(ulF).map(([kk,d])=>'<path class="tl-ul" '+ulFill(kk)+' d="'+d.join('')+'"/>').join('');
  fineSvg=Object.entries(seaD).map(([c,d])=>'<path class="tl-sea '+c+'" d="'+d.join('')+'"/>').join('')+fineSvg+wvF.map((d,i)=>d.length?'<path class="wv" style="animation-delay:'+(-i*.7).toFixed(1)+'s" d="'+d.join('')+'"/>':'').join('');
  const bg='<rect x="'+(-oMX0*KS-10)+'" y="'+(-oMY0*KS-10)+'" width="'+((OVBW+oMX0+oMX1)*KS+20).toFixed(0)+'" height="'+((OVBH+oMY0+oMY1)*KS+20).toFixed(0)+'" fill="url(#gSea)"/>';
  const tiles=Object.values(FAR).filter(f=>f.name).map(f=>[0,0,f.x,f.y,f]);
  let o='<g class="far">';
  const col={atk:'var(--atk)',jp:'var(--jp)',us:'var(--us)'};
  for(const [c,r,x,y,f] of tiles){
    if(!f||!f.name||HIDEFAR.has(f.name))continue;
    if(f.who)o+='<circle pointer-events="none" cx="'+x+'" cy="'+(y+4)+'" r="4.5" fill="'+col[f.who]+'" stroke="#fff" stroke-width="1"/>';
    o+='<text class="far-lbl" x="'+x+'" y="'+(y-9)+'">'+f.name+(FAR_AIRCITY[f.name]?'（'+FAR_AIRCITY[f.name]+'）':'')+'</text>';
    if(f.tag)o+='<text class="far-tag" x="'+x+'" y="'+(y+18)+'" fill="'+col[f.who]+'">'+f.tag+'</text>';
  }
  for(const [nm,lo,la] of FAR_CITIES){const [px,py]=llPx(lo,la);o+='<circle pointer-events="none" cx="'+(px/KS).toFixed(2)+'" cy="'+(py/KS).toFixed(2)+'" r="2.2" fill="var(--ink)" stroke="#fff" stroke-width=".8" opacity=".75"/><text class="far-lbl city" x="'+(px/KS).toFixed(2)+'" y="'+(py/KS-4).toFixed(2)+'">'+nm+'</text>';}
  let oS='';
  const SUBG=(x,y,who,dash)=>'<g><ellipse cx="'+x+'" cy="'+(y+7)+'" rx="16" ry="4" fill="#000" opacity=".15"/><path d="M'+(x-17)+' '+(y+2)+'q0 -6 8 -6h18q9 0 9 6q0 6 -9 6h-18q-8 0 -8 -6z" fill="'+
      col[who]+'" stroke="#fff" stroke-width="1"'+(dash?' stroke-dasharray="3 2" fill-opacity=".55"':'')+'/><path d="M'+(x-4)+' '+(y-4)+'v-5h8v5" fill="'+col[who]+'" stroke="#fff" stroke-width="1"/><path d="M'+
      (x+2)+' '+(y-9)+'v-5h4" fill="none" stroke="#fff" stroke-width="1.2"/><path d="M'+(x-17)+' '+(y+2)+'l-4 -3m4 3l-4 4" stroke="'+col[who]+'" stroke-width="1.5"/></g>';
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
      '<ellipse class="ush" cx="0" cy="11" rx="16" ry="5"/><rect class="uside '+cls+'" x="-15" y="-9" width="30" height="22" rx="3"/><rect class="body '+cls+'" x="-15" y="-14" width="30" height="23" rx="3"/><rect class="uhi" x="-13" y="-13" width="26" height="3" rx="1.5"/>'+
          FSYM[kind]+'<text class="tx" x="0" y="6.5">'+sh+'</text></g></g>';
    return ch+'<text class="far-lbl" x="'+x+'" y="'+(y-16*FK-2).toFixed(1)+'">'+t+'</text><text class="far-tag" x="'+x+'" y="'+(y+14*FK+7).toFixed(1)+'" fill="'+col[who]+'">'+sub+'</text>';};
  oS+=SH(23,17,'atk','共軍潛艦','太平洋・隱蔽',true)+'<g id="csgM">'+SH(32,10,'us','第7艦隊','航艦打擊群')+'</g>'+'<g id="jmsdfM">'+SH(26,-4,'jp','海自護衛隊群','佐世保出港')+'</g>'+SH(19,17,'us','美軍潛艦','隱蔽',true)+SH(15,17,'jp','海自潛艦','隱蔽',true);
  const T=(c,r,t,sz)=>{const [x,y]=center(c,r);return '<text class="big" font-size="'+(sz||12)+'" x="'+x+'" y="'+y+'" text-anchor="middle">'+t+'</text>';};
  o+=T(23,8,'太平洋',13)+T(5,19,'南海',13)+T(15,14,'呂宋海峽',11)+T(14,-3,'東海',13);
  o+='<text class="far-tag" x="'+(VBW-6)+'" y="-6" text-anchor="end" fill="var(--muted)" style="text-anchor:end">▲ 虛線內為遊戲格；外圍僅為背景（可點選查看）</text></g><rect class="playbox" x="0" y="0" width="'+GVBW.toFixed(1)+'" height="'+VBH.toFixed(1)+'" rx="6"/>';
  $('#gX').innerHTML=bg+fineSvg+'<g transform="scale('+KS+')">'+o+'</g>';
  $('#gE').innerHTML='<g transform="scale('+KS+')">'+oS+'</g>';
}
// 平潭島與大陸的兩座橋（只畫在地圖上，不影響規則；位置為連接兩端格子的示意線，★實際橋位與長度見 docs/data/map.md）：
// 北側＝平潭海峽公鐵兩用大橋（長樂松下→平潭蘇澳，全長 16.34 公里，2020 年通車）、南側＝平潭海峽跨海大橋（公路橋，約 4.9 公里，2010 年通車）
function bridgesSVG(){
  let o='<g class="brg" pointer-events="none">';
  for(const {n:nm,a:ka,b:kb} of BRIDGES){const a=TER[ka],b=TER[kb];if(!a||!b)continue;const [x1,y1]=cen(a.c,a.r),[x2,y2]=cen(b.c,b.r),d='M'+x1.toFixed(1)+' '+y1.toFixed(1)+'L'+x2.toFixed(1)+' '+y2.toFixed(1);
    o+='<path class="bk" stroke-width="'+(R*.2).toFixed(1)+'" d="'+d+'"/><path class="bc" stroke-width="'+(R*.07).toFixed(1)+'" d="'+d+'"/>'
      +'<text class="lbl minor brgl" font-size="'+(4.4*Math.max(.72,SC)).toFixed(1)+'" x="'+((x1+x2)/2).toFixed(1)+'" y="'+((y1+y2)/2-R*.3).toFixed(1)+'" text-anchor="middle">'+nm+'</text>';}
  return o+'</g>';}
const nearCity=h=>Object.values(TER).some(x=>x!==h&&x.name&&(x.t==='city'||x.t==='port')&&hd(x,h)<=Math.round(kmH(25)));
function buildStatic(){
  const defs=tileGrad('gt-plain','land','#d9d1ad')+tileGrad('gt-city','city','#cfc4a0')+tileGrad('gt-mtn','mtn','#b5a47c')+tileGrad('gt-main','main','#c8c4b8')+tileGrad('gt-plain2',
      'land2','#d3d0a8')+tileGrad('gt-plain3','land3','#dfd5b3')+tileGrad('gt-hill','hill','#c9bd92')+tileGrad('gt-main2','main2','#c3c6b6')+tileGrad('gt-main3','main3',
      '#cec8b8')+tileGrad('gt-mainhill','mainhill','#b9b3a1')+tileGrad('gt-mainmtn','mainmtn','#a39d8c')+tileGrad('gt-maincity','maincity','#d4cfc2')+['#a9c98b','#c3cc8f',
      '#c9bd86','#b3a374','#998b62','#7f7552','#686344'].map((c,i)=>tileGrad('gt-e'+i,'e'+i,c)).join('')+tileGrad('gt-tcity','tcity','#b8b6ae')+tileGrad('gt-town','town','#b4c0a2')+
    '<linearGradient id="gu-atk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4574d" style="stop-color:color-mix(in srgb,var(--atk) 72%,#fff)"/><stop offset="1" stop-color="#a02a24" style="stop-color:color-mix(in srgb,var(--atk) 90%,#000)"/></linearGradient>'+
    '<linearGradient id="gu-def" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a82c8" style="stop-color:color-mix(in srgb,var(--def) 72%,#fff)"/><stop offset="1" stop-color="#18457d" style="stop-color:color-mix(in srgb,var(--def) 90%,#000)"/></linearGradient>'+
'<linearGradient id="gu-atk-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--atk) 84%,#000)"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--atk) 52%,#000)"/></linearGradient>'+
    '<linearGradient id="gu-def-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--def) 84%,#000)"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--def) 52%,#000)"/></linearGradient>'+
    '<linearGradient id="gu-atk-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--atk) 38%,#fff)"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--atk) 62%,#fff)"/></linearGradient>'+
    '<linearGradient id="gu-def-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--def) 38%,#fff)"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--def) 62%,#fff)"/></linearGradient>'+
    '<linearGradient id="gSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9c5ce" style="stop-color:color-mix(in srgb,var(--sea) 78%,#fff)"/><stop offset="1" stop-color="#8fb0bb" style="stop-color:color-mix(in srgb,var(--sea) 94%,#000)"/></linearGradient>';
  $('#mdefs').innerHTML=defs;
  const sea=[],land=[];Object.values(TER).forEach(h=>(isLand(h)?land:sea).push(h));
  land.sort((a,b)=>a.r-b.r||a.c-b.c);
  // distance from land for shallow-water shading
  const dist=new Map();let q=[];land.forEach(h=>{dist.set(h.k,0);q.push(h);});
  while(q.length){const h=q.shift();for(const n of nbrs(h.c,h.r)){if(!dist.has(n.k)){dist.set(n.k,dist.get(h.k)+1);q.push(n);}}}
  buildFar();
  let o='',lbls='';
  // 海面：同色的海格合併成一個 path（原本每格一個 polygon，約 7,800 個節點）；浪紋依動畫延遲分 9 組各一個 path。點選／游標移入海面時，用座標反查是哪一格（seaHexAt）
  const seaP={},wvP=[[],[],[],[],[],[],[],[],[]];let wi=0;
  for(const h of sea){const [x,y]=center(h.c,h.r),[slon,slat]=rcToLL(h.c,h.r),sc=seaClass(slon,slat,dist.get(h.k));
    (seaP[sc]=seaP[sc]||[]).push('M'+hexPts(x,y,R).replace(/ /g,'L')+'Z');
    if(!LITE&&!ULTRA&&sc!=='d1'&&(h.c+h.r)%2===0)wvP[wi++%9].push('M'+(x-9)+' '+(y+2)+'q4.5 -4 9 0t9 0');
  }
  o+=Object.entries(seaP).map(([c,d])=>'<path class="tl-sea '+c+'" data-sea="1" d="'+d.join('')+'"/>').join('')+wvP.map((d,i)=>d.length?'<path class="wv" style="animation-delay:'+(-i*.7).toFixed(1)+'s" d="'+d.join('')+'"/>':'').join('');
  const ulN={},ulKey=h=>h.isl==='CN'||h.t==='main'?VTKEY(h.vt,true):h.elev!=null?(h.t==='city'?'tcity':h.town?'town':'e'+Math.min(6,Math.floor(h.elev/500))):(h.t==='city'?'city':h.t==='mtn'?'mtn':'plain');
  if(ULTRA)for(const h of land){const [x,y]=center(h.c,h.r),kk=ulKey(h);(ulN[kk]=ulN[kk]||[]).push('M'+hexPts(x,y,R).replace(/ /g,'L')+'Z');}
  if(ULTRA)o+=Object.entries(ulN).map(([kk,d])=>'<path class="tl-ul" data-sea="2" '+ulFill(kk)+' d="'+d.join('')+'"/>').join(''); // 極簡畫質：近岸陸地同類合併成平面色塊，點選用座標反查（seaHexAt，data-sea=2 表示陸地也回傳）
  if(!ULTRA)for(const h of land){const [x,y]=center(h.c,h.r),d=elev(h);o+='<polygon class="tl-sh" points="'+ptsStr(hexV(x+3,y+d+4,R))+'"/>';}
  for(const h of land){
    const [x,y0]=center(h.c,h.r),d=ULTRA?0:elev(h),y=y0-d,v=hexV(x,y,R),b=v.map(p=>[p[0],p[1]+d]);
    const key=h.isl==='CN'||h.t==='main'?VTKEY(h.vt,true):h.elev!=null?(h.t==='city'?'tcity':h.town?'town':'e'+Math.min(6,Math.floor(h.elev/500))):(h.t==='city'?'city':h.t==='mtn'?'mtn':'plain'); // 台澎：依海拔每 500 公尺分色（地形圖配色），城市灰色
    if(!ULTRA){o+='<g class="tile t-'+key+'">';
    [[3,4,'l'],[2,3,'l'],[1,2,'r'],[0,1,'r']].forEach(([i,j,s])=>{o+='<polygon class="sd '+s+'" points="'+ptsStr([v[i],v[j],b[j],b[i]])+'"/>';});
    o+='<polygon class="tt" fill="url(#gt-'+key+')" points="'+ptsStr(v)+'" data-k="'+h.k+'"/>';
    o+='<polyline class="tg" points="'+ptsStr([v[3],v[4],v[5],v[0]])+'"/>';
    if(h.cliff)o+='<polygon class="cliff" points="'+hexPts(x,y,R-3)+'"/>';
    if(h.mud)o+='<polygon class="mud" points="'+hexPts(x,y,R-3)+'"/>';
    o+=tileDetail(h,x,y);}
    if(h.name&&(h.t!=='plain'||h.isl==='JP'||['宜蘭','恆春','澎湖'].includes(h.name))&&!(h.t==='air'&&(nearCity(h)||h.isl==='TW'))){ /* 台澎機場的名稱改由可點的基地標籤（baseTagsSVG）顯示 */const ob=h.k===TAIPEI||PORTS.includes(h.k);
      lbls+='<text class="lbl'+(ob?' obj':' minor')+'" font-size="'+(8.5*Math.max(.72,SC)).toFixed(1)+'" x="'+x+'" y="'+(FG>2?y-R*1.2:y-(h.t==='mtn'?11:9))+'">'+(ob?'★':'')+h.name+'</text>';
      } // 機場旁 25 km 內已有城市或港口名就不重複標（點機場仍看得到名稱）；縮小時只顯示勝負要點
    if(!ULTRA)o+='</g>';
  }
  o+=coastRiverSVG(land);
  o+=bridgesSVG(); // 平潭的兩座橋（示意位置）
  o+=lbls; // 地名畫在河流、海岸線之後，河流不會壓過字
  o+='<text class="big" font-size="15" x="'+cc(6,3)[0]+'" y="'+cc(6,3)[1]+'" writing-mode="tb">台灣海峽</text>';
  o+='<text class="big" font-size="13" x="'+cc(15,7)[0]+'" y="'+cc(15,7)[1]+'" writing-mode="tb">太平洋</text>';
  o+='<text class="big" font-size="12" x="'+cc(1,1)[0]+'" y="'+cc(1,1)[1]+'" writing-mode="tb">大陸沿海</text>';
  $('#gS').innerHTML=o;
  $('#gL').innerHTML=landmarkSVG(); // 地標畫在棋子上方（不能點選），所在格有棋子時也看得到
  $('#map').classList.toggle('zlo',FG>2&&(typeof ZOOM==='undefined'?1:ZOOM)<1.6);
  $('#map').classList.toggle('zhi',typeof ZOOM!=='undefined'&&ZOOM>=9);
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
const unitCat=t=>(t==='ssm'||t==='hmr'||t==='heli'||t==='sam'||t==='mlrs'||t==='hk'||t==='ssn'||t==='psub'||t==='nme'||t==='mdt'||t==='ff')?'f':(t==='cvy'||t==='fob'||t==='lst'||t==='ro')?'l':'m';
// 艦艇棋子的船形數量＝這個棋子代表的船數：單艦一艘大船；護航艦棋子（052D＋054A 一對）兩艘；艦群、運輸船團三艘小船（不再疊卡片）
const HULLN=t=>t==='dd'?2:(t==='lst'||t==='ro'||t==='cvy'||t==='ff'||t==='jdd'||t==='csg')?3:0;
const HULLS=(bx,by,n)=>{const sp=18/n,w=sp-.7;return Array.from({length:n},(_,i)=>{const x0=bx+.35+i*sp,y0=by+7.6-(n===3?(i===1?1.6:0):(i===1?1.2:0));return '<path class="sym" data-h="1" d="M'+x0.toFixed(1)+' '+y0.toFixed(1)+'h'+w.toFixed(1)+'l-1 1.9h-'+(w-2).toFixed(1)+'z"/><path class="sym" d="M'+(x0+w*.26).toFixed(1)+' '+y0.toFixed(1)+'v-1.8h'+(w*.48).toFixed(1)+'v1.8"/>';}).join('');};
function unitSVG(u,withSmoke){
  const [x0,y0]=cen(u.c,u.r),[sx,sy]=stackPos(u),x=x0+sx,y=y0+sy,stacked=sx!==0,T=TYPES[u.type];
  const done=S.started&&u.side===S.phase&&u.acted,sel=S.sel===u||!!(u.boundTo&&S.sel&&S.sel.id===u.boundTo),yy=y-2;
  let sym='';const bx=x-9,by=yy-10,bw=18,bh=10;
  const box='<rect class="sym" x="'+bx+'" y="'+by+'" width="'+bw+'" height="'+bh+'"'+(u.type==='res'?' stroke-dasharray="2 1.5"':'')+'/>';
  const X='<path class="sym" d="M'+bx+' '+by+'L'+(bx+bw)+' '+(by+bh)+'M'+(bx+bw)+' '+by+'L'+bx+' '+(by+bh)+'"/>';
  if(u.type==='arm'||u.type==='tank')sym=box+'<ellipse class="sym" cx="'+x+'" cy="'+(by+5)+'" rx="6" ry="3"/>';
  else if(u.type==='csg')sym=box+HULLS(bx,by,3);
  else if(u.type==='cv'||u.type==='ddh')sym=box+'<path class="sym" d="M'+(x-8)+' '+(by+5.5)+'h16l-1.2 3h-13.6z"/><path class="sym" d="M'+(x+2)+' '+(by+5.5)+'v-2.6h3v2.6"/>';
  else if(u.type==='hk'||u.type==='ssn'||u.type==='psub')sym=box+'<path class="sym" d="M'+(x-8)+' '+(by+7)+'q8-8 16 0z"/><path class="sym" d="M'+(x-1)+' '+(by+3)+'h3v3h-3z"/>';
  else if(u.type==='dd'||u.type==='ff'||u.type==='jdd')sym=box+HULLS(bx,by,HULLN(u.type));
  else if(!!SHIPW[u.type]&&u.type!=='jdd')sym=box+'<path class="sym" d="M'+(x-7)+' '+(by+6)+'h14l-2 3h-10z"/><path class="sym" d="M'+(x-2)+' '+(by+6)+'v-3h4v3"/>';
  else if(u.type==='hmr'||u.type==='mlrs')sym=box+'<path class="sym" d="M'+(x-6)+' '+(by+8)+'h12M'+(x-4)+' '+(by+7.5)+'l7 -5M'+(x-1)+' '+(by+7.5)+'l7 -5M'+(x+2)+
      ' '+(by+7.5)+'l5 -3.5"/><circle class="sym" cx="'+(x-4)+'" cy="'+(by+8.6)+'" r="1"/><circle class="sym" cx="'+(x+4)+'" cy="'+(by+8.6)+'" r="1"/>';
  else if(u.type==='ssm'||u.type==='nme'||u.type==='mdt')sym=box+'<path class="sym" d="M'+(x-5)+' '+(by+8)+'L'+x+' '+(by+2)+'L'+(x+5)+' '+(by+8)+'M'+x+' '+(by+2)+'V'+(by+9)+'"/>';
  else if(u.type==='lst'||u.type==='ro'||u.type==='cvy')sym=box+HULLS(bx,by,3);
  else if(u.type==='fob')sym=box+'<path class="sym" d="M'+(x-6)+' '+(by+8)+'h12M'+(x-4)+' '+(by+8)+'v-5h8v5"/>';
  else if(u.type==='heli')sym=box+'<path class="sym" d="M'+(x-7)+' '+(by+3)+'h14M'+x+' '+(by+3)+'v2M'+(x-4)+' '+(by+7)+'q4 -3 7 0q-3 2.5 -7 0zM'+(x+3)+' '+(by+7)+'h4"/>';
  else if(u.type==='sam')sym=box+'<path class="sym" d="M'+(x-6)+' '+(by+9)+'Q'+x+' '+(by-1)+' '+(x+6)+' '+(by+9)+'M'+x+' '+(by+9)+'V'+(by+3)+'"/>';
  else if(u.type==='aas')sym=box+X+'<path class="sym" d="M'+(x-7)+' '+(by-2)+'h14M'+x+' '+(by-2)+'v2"/>';
  else if(u.type==='abn')sym=box+X+'<path class="sym" d="M'+(x-5)+' '+(by+bh)+'Q'+x+' '+(by+4)+' '+(x+5)+' '+(by+bh)+'"/>';
  else if(u.type==='amph'||u.type==='mar')sym=box+X+'<path class="sym" d="M'+(bx+1)+' '+(by+bh-1.5)+'q2.5 -2 5 0t5 0t5 0"/>';
  else sym=box+X;
  let pips='';
    const lv=isLch(u)&&u.veh!=null&&!u.ghostFleet,n=u.mhp>6||lv?0:(u.mhp||T.hp);
    if(lv&&(ssmReady(u)<lchV0(u)||sel))pips='<text x="'+x+'" y="'+(y+20.5)+'" text-anchor="middle" font-size="7" font-weight="800" fill="'+(ssmReady(u)<lchV0(u)?'#c0392b':'var(--ink)')+'">'+ssmReady(u)+'/'+lchV0(u)+' 車</text>';
    else if(u.mhp>6)pips='<text x="'+x+'" y="'+(y+20.5)+'" text-anchor="middle" font-size="7" font-weight="800" fill="var(--ink)">'+u.hp+'/'+u.mhp+' 艘</text>';
    for(let i=0;i<n;i++){const px=x-(n-1)*3.5+i*7;
    pips+='<circle class="pip '+(i<u.hp?'full':'lost')+'" cx="'+px+'" cy="'+(y+17.5)+'" r="2"/>';
    }
  // 重創、失去戰鬥能力（航艦剩 1 步）：棋子變暗、右上角冒黑煙
  const ooa=cvOOA(u),smoke=ooa?'<g class="smk'+(LITE?' still':'')+'" transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') scale('+(US*(stacked?.86:1)).toFixed(3)+') translate('+(-x).toFixed(1)+' '+(-y).toFixed(1)+')"><circle class="s1" cx="'+(x+8)+'" cy="'+(y-15)+'" r="3"/><circle class="s2" cx="'+(x+10.5)+'" cy="'+(y-20)+'" r="3.8"/><circle class="s3" cx="'+
      (x+13.5)+'" cy="'+(y-26)+'" r="4.6"/><path class="fl" d="M'+(x+5.5)+' '+(y-13)+'q1.2 -3.2 2.6 -4.6q.4 2 1.6 2.8q1 1 .6 1.8z"/></g>':'';
  {const ar=typeof ammoRows==='function'?ammoRows(u):[],tm=ar.reduce((a,x)=>a+x.m,0),tv=ar.reduce((a,x)=>a+x.v,0);
    if(tm>0&&tv<tm-.01){const r=tv/tm,by=y+(u.mhp>6?23.5:21.5); // 艦隊棋子下方有「x/y 艘」文字，長條再往下一點
      pips+='<rect class="ub-t" x="'+(x-12)+'" y="'+by+'" width="24" height="2.6" rx="1.3"/><rect class="ub-f '+ammoLv(r)+'" x="'+(x-12)+'" y="'+by+'" width="'+(24*r).toFixed(1)+'" height="2.6" rx="1.3"/>';}}
  const sea=atSea(u);
  const wf=US/(16/26*1.18),wake=sea&&LITE?'<ellipse class="wk still" cx="'+x+'" cy="'+(y+12*wf)+'" rx="'+(14*wf).toFixed(1)+'" ry="'+(4*wf).toFixed(1)+'"/>':sea?'<ellipse class="wk" cx="'+
      x+'" cy="'+(y+12*wf)+'" rx="'+(14*wf).toFixed(1)+'" ry="'+(4*wf).toFixed(1)+'"/><ellipse class="wk w2" cx="'+x+'" cy="'+(y+12*wf)+'" rx="'+(14*wf).toFixed(1)+'" ry="'+(4*wf).toFixed(1)+'"/>':'';
  return '<g class="u'+(sel?' sel':'')+(done?' done':'')+(ooa?' ooa':'')+'" data-k="'+K(u.c,u.r)+'" data-id="'+u.id+'" data-x="'+x.toFixed(1)+'" data-y="'+y.toFixed(1)+'">'+wake+
    '<g class="ui"'+(sel?' transform="translate(0,-3)"':'')+'><g transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') scale('+(US*(stacked?.86:1)).toFixed(3)+') translate('+(-x).toFixed(1)+' '+(-y).toFixed(1)+')">'+'<ellipse class="ush" cx="'+x+'" cy="'+(y+11)+'" rx="16" ry="5"/>'+
    '<rect class="uside '+u.side+'" x="'+(x-15)+'" y="'+(y-9)+'" width="30" height="22" rx="3"/>'+
    '<rect class="body '+u.side+' c'+unitCat(u.type)+'" x="'+(x-15)+'" y="'+(y-14)+'" width="30" height="23" rx="3"/>'+
    '<rect class="uhi" x="'+(x-13)+'" y="'+(y-13)+'" width="26" height="3" rx="1.5"/>'+sym+
    '<text class="tx" x="'+x+'" y="'+(y+6.5)+'">'+(u.fl?u.fl.s:u.type==='heli'&&heliB(u.hb)?heliB(u.hb).tag:u.type==='sam'&&samSite(u)?samSite(u).tag:T.s)+'</text>'+pips+((()=>{ // 運輸船載著什麼：只有攻方自己（或觀戰）看得到，格式「兵種簡稱＋剩餘步數」；守方玩家只能看到船
      const b=u.boundTo&&S.units.find(z=>z.id===u.boundTo);if(!b)return '';
      if(S.ctrl&&S.ctrl.def==='human'&&S.ctrl.atk!=='human'&&!S.sim&&!S.video)return '';
      const t=TYPES[b.type].s+b.hp,w=Math.max(14,t.length*6.4+4);
      return '<rect x="'+(x-15)+'" y="'+(y-18)+'" width="'+w.toFixed(1)+'" height="8.5" rx="2" fill="#111" opacity=".9"/><text x="'+(x-15+w/2).toFixed(1)+'" y="'+
          (y-11.6)+'" text-anchor="middle" font-size="6.3" font-weight="700" fill="#fff">'+t+'</text>';})())+(sea?'<circle class="sea-tag" cx="'+(x+15)+'" cy="'+(y-12)+'" r="2.6"/>':'')+'</g></g></g>'+(withSmoke&&smoke?'\u0001'+smoke:''); // 黑煙接在 \u0001 後面，由 mapUnitsSVG 移到所有棋子上方，才不會被旁邊的棋子蓋住
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
