'use strict';
/* ---------- simulation events ---------- */
function defaultMods(){
  return {wx:[.6,.25,.15],wxT1:'good',fireAdd:{},strikeEase:{},ssmNeed:4,fxMod:0,strikeMod:0,buildup:'exercise',
    defFreeze:{},defReinfDelay:0,defReinfExtra:0,defReinfHalve:false,defAtk:{},defDef:{},taipeiFort:0,tankAtk:0,
    atkAtk:{},atkDef:{},winter:false,sortie:false,c2Strong:false,moraleHigh:false,civMul:1,decoy:0,resBonus:0,supCut:{},intd:{},noTalks:false,callout:false,shield:{},lastInterdict:0};
}
function sideMod(u,kind){
  const m=S.mods,t=S.turn;
  if(u.side==='def')return kind==='atk'?(m.defAtk[t]||0)+(u.type==='tank'?m.tankAtk:0):(m.defDef[t]||0)+(K(u.c,u.r)===TAIPEI?m.taipeiFort:0);
  return kind==='atk'?(m.atkAtk[t]||0):(m.atkDef[t]||0);
}
function addTurns(obj,from,to,v){for(let t=from;t<=to;t++)obj[t]=(obj[t]||0)+v;}
const pick=a=>a[Math.floor(Math.random()*a.length)];
// 固定規則挑選目標：分數最高者，同分取第一個（取代抽籤）
function pickBest(arr,score){let b=null,bs=-Infinity;for(const x of arr){const v=score(x);if(v>bs){bs=v;b=x;}}return b;}

/* ---------- theater: pools, foreign forces ---------- */
// baseline (2026) force pools, abstract points built from public reporting; see DATA.md (index) and docs/data/*.md
const POOL0={plaAir:8,plaSub:3,plaCV:2,plaAD:6,plaNavy:16,rf:32,plaCM:5,plaLR:6,plaHS:3,rocAir:4,rocNavy:4,rocSub:2,rocAD:4,rocMsl:10,rocDrone:1,rocMine:1,rocAS:10,rocRkt:8,plaLift:8,plaFAC:10};
const AMPH_ERA={'2026':0,'2027':0,'2028':1,'2029':1,'2030':2,'2031':2,'2032':3};
const ERA={
  '2026':{n:'2026 現況',d:'依 2025～2026 公開報導：台灣剛收到首批 F-16V、HIMARS 陸續到貨、雲峰尚未大量生產、火山布雷車尚未交付；共軍有約 250 具東風-26 發射器、東風-17 與 PCH-191 長程火箭，福建艦剛服役。',short:'2026 現況',pools:{},ssm:[],dfire:2},
  '2027':{n:'2027（推估）',d:'火山布雷車 14 套預計到位（交付多次延後，最新報導為 2027 年）；福建艦達完整戰力；F-16V 持續交付、雲峰開始量產。',short:'2027',pools:{plaLift:9,plaAir:8,plaSub:3,plaCV:2,plaAD:6,plaNavy:16,rf:33,plaCM:5,plaLR:7,plaHS:3,rocAir:4,rocNavy:4,rocSub:2,rocAD:4,rocMsl:11,rocDrone:1,rocAS:12,rocMine:3},ssm:[],dfire:2},
  '2028':{n:'2028（推估）',d:'假設預定交付到位：F-16V 66 架、HIMARS 與魚叉岸防增加、第一艘海鯤潛艦服役；共軍增加東風-26 旅與長程火箭。',short:'2028',pools:{plaLift:10,plaAir:8,plaSub:4,plaCV:3,plaAD:6,plaNavy:18,rf:35,plaCM:6,plaLR:8,plaHS:4,rocAir:5,rocNavy:5,rocSub:3,rocAD:5,rocMsl:12,rocDrone:1,rocAS:14,rocMine:3},ssm:[],dfire:3},
  '2029':{n:'2029（推估）',d:'特別預算（立法院縮減版）逐步採購：更多長程精準火力與防空，無人機與巡飛彈開始補上；共軍持續擴編。',short:'2029',pools:{plaLift:11,plaAir:8,plaSub:4,plaCV:3,plaAD:7,plaNavy:18,rf:37,plaCM:6,plaLR:9,plaHS:4,rocAir:5,rocNavy:5,rocSub:3,rocAD:5,rocMsl:13,rocDrone:2,rocAS:16,rocMine:4},ssm:[],dfire:3},
  '2030':{n:'2030（推估）',d:'假設特別預算與自製武器落實：多層防空、更多長程精準火力；共軍第四艘航艦在建、火箭軍擴編。',short:'2030',pools:{plaLift:12,plaAir:8,plaSub:5,plaCV:4,plaAD:7,plaNavy:20,rf:40,plaCM:6,plaLR:10,plaHS:5,rocAir:6,rocNavy:6,rocSub:3,rocAD:6,rocMsl:15,rocDrone:2,rocAS:18,rocMine:5},ssm:['taitung'],dfire:4},
  '2031':{n:'2031（推估）',d:'NASAMS 合約預計 2031 年交付，防空明顯增強；海鯤潛艦增為 2 艘（計畫共 8 艘，進度不確定）。',short:'2031',pools:{plaLift:13,plaAir:8,plaSub:5,plaCV:4,plaAD:7,plaNavy:20,rf:43,plaCM:7,plaLR:11,plaHS:6,rocAir:6,rocNavy:6,rocSub:4,rocAD:7,rocMsl:16,rocDrone:3,rocAS:20,rocMine:5},ssm:['taitung'],dfire:4},
  '2032':{n:'2032（推估）',d:'特別預算期程（2026～2033）接近尾聲，雙方都明顯成長；數值為推估，不確定性最高。',short:'2032',pools:{plaLift:14,plaAir:8,plaSub:6,plaCV:4,plaAD:8,plaNavy:22,rf:45,plaCM:7,plaLR:12,plaHS:7,rocAir:6,rocNavy:6,rocSub:4,rocAD:7,rocMsl:17,rocDrone:3,rocAS:22,rocMine:6},ssm:['taitung','yunlin'],dfire:4}
};
// 魚叉岸防系統（2020 年軍售：發射車 100 輛、RGM-84L-4 飛彈 400 枚；報導 2026～2028 年交付）：★逐年組數與存量（每點約 100 枚）依交付時程推估
const HCD_N=era=>{const y=+era||2026;return y>=2028?3:y>=2027?2:1;};
const HCD_PTS=era=>{const y=+era||2026;return y>=2028?4:y>=2027?2.5:1;};
function previewEra(){const e=ERA[S.era]||ERA['2026'],H=HMR_ERA[S.era]||HMR_ERA['2026'];S.p0=Object.assign({},POOL0,e.pools,{rocHCD:HCD_PTS(S.era),plaDrone:PLA_DRONE[S.era]||200,rocAtc:H[2],rocGml:H[3]},AFS_POOL(S.era));
  S.p0.rocMsl=Math.round((S.p0.rocMsl-Math.min(H[2],84)/25)*100)/100; // 陸軍戰術飛彈改由 rocAtc 單獨計算：從長程飛彈點數扣掉原本估在裡面的 ATACMS（2026 年 64 枚、之後 84 枚，1 點≈25 枚）
  S.pools=Object.assign({},S.p0);S.dfireMax=e.dfire;}
const MLRS_SPOTS=['miaoli','changhua','magong','taoyuan']; // 其中 1 組在澎湖（依漢聲電台等報導，澎防部有雷霆2000） // 雷霆2000：公開資料只說陸軍有裝備、沒有確切數量；4 組、彈藥庫存 8 點為遊戲推估（各年代相同）
const HMR_SPOTS=['ckk','gangshan','hsinchuab','yunlin','pingtungc','chihhang'],HMR_N=Object.fromEntries(Object.entries(HMR_ERA).map(([k,v])=>[k,v[1]])); // 棋子數見 HMR_ERA（★1 組約一個營，2029 年起隨後續 82 輛增加）
function hmrSpread(tot){ // 把 tot 輛發射車平均分給現有海馬士棋子
  const us=S.units.filter(u=>u.side==='def'&&u.type==='hmr'&&alive(u));if(!us.length)return;
  splitN(Math.max(us.length,tot),us.length).forEach((v,i)=>{us[i].veh0=v;us[i].veh=v;});
}
function applyEra(){
  previewEra();const e=ERA[S.era]||ERA['2026'];
  {const sp=HMR_SPOTS.slice(0,HMR_N[S.era]||3);if((+S.era||2026)>=2027)sp[sp.length-1]='penghu'; // 國防部 2026 年 5 月證實規劃把海馬士前推到澎湖、東引；★2027 年起從既有數量調 1 組到澎湖
   sp.forEach(k=>{k=SPOT[k];if(!k||!TER[k])return;const h=!unitAt(k)?TER[k]:placeNear(k,x=>x.isl===TER[k].isl&&isLand(x)&&x.t!=='mtn'&&!unitAt(x.k));if(h)S.units.push(mkUnit('def','hmr',h.k,{}));});
   hmrSpread(hmrEra()[0]);}
  MLRS_SPOTS.forEach(k=>{k=SPOT[k];if(!k||!TER[k])return;const h=placeNear(k,x=>x.isl===TER[k].isl&&x.t!=='sea'&&x.t!=='air'&&x.t!=='port'&&!unitAt(x.k))||placeNear(SPOT.tainan,
      x=>x.isl==='TW'&&x.t!=='sea'&&x.t!=='air'&&x.t!=='port'&&!unitAt(x.k));if(h)S.units.push(mkUnit('def','mlrs',h.k,{}));}); // 駐地格已有步兵時，放在最近的空格
  e.ssm.forEach(k=>{k=SPOT[k]||k;if(TER[k]&&!unitAt(k))S.units.push(mkUnit('def','ssm',k,{}));});
  ['taoyuan','kaohsiung','yilan'].slice(0,HCD_N(S.era)).forEach(id=>{const k=SPOT[id];if(!k||!TER[k])return;const h=!unitAt(k)?TER[k]:placeNear(k,x=>x.isl==='TW'&&isLand(x)&&x.t!=='mtn'&&!unitAt(x.k));if(h)S.units.push(mkUnit('def','ssm',h.k,{wp:'hp'}));}); // 魚叉岸防系統（★部署位置與逐年組數為推估）
  log('兵力年代：'+e.n+'。');log(applyLift()+'。');
  // 共軍渡海能力隨年代成長：075 兩棲攻擊艦（2021～2024 服役 3 艘，之後續建）、076 型（2025 年下水海試）、滾裝客貨輪與「水橋」登陸駁船（2024～2025 年陸續曝光）；首波兩棲旅依運力估計約每 2 年 +1 個（推估，不確定性高）
  const ex=AMPH_ERA[S.era]||0;for(let i=0;i<ex;i++){const h=placeNear(FK(i%2?'3,5':'3,2'),q=>q.isl==='CN'&&q.coastal);if(h)S.units.push(mkUnit('atk','amph',h.k,{zone:i%2?'central':'north'}));}
  if(ex)log('共軍渡海運力成長：首波增加 '+ex+' 個兩棲旅，補給運輸船 '+fmt1(S.pools.plaLift)+' 個。');
  placeShips();
  layMines();
}
// 水面艦艇上地圖：共軍護航艦在港口外海，守方艦艇群停泊在港口；兩者都很脆弱，擊沉會連動減少海軍點數
// ★共軍航艦群在台灣東方約 300 km 外活動（岸置雄二／雄三約 160 km、艦射飛彈射程之外），靠艦載機（作戰半徑約 600 km）出擊；位置為推估
const CV_START=[[124.6,23.6],[124.6,22.8],[124.4,22.0]],CV_STANDOFF=300;
let TWCOAST=null;
function cvTwKm(h){if(!TWCOAST)TWCOAST=Object.values(TER).filter(x=>x.isl==='TW'&&x.coastal);let m=1e9;for(const x of TWCOAST){const d=hd(h,x);if(d<m)m=d;}return m*KM_HEX;} // 到台灣海岸的距離（公里）
function placeShips(){
  const P=S.pools;
  // 護航艦：一個棋子約代表一個點（★一點≈052D＋054A 各 1 艘；2026 年 16 點≈32 艘，依公開估計共軍驅逐艦約 50、054A 約 40～46 艘，約一半投入台海；上限 16 個棋子）
  const nd=Math.min(16,Math.max(0,P.plaNavy)),ports=['4,4','3,3','3,7','2,9'].map(k=>TER[FK(k)]);
  const seaC=[];ports.forEach(h=>nbrs(h.c,h.r).filter(x=>x.t==='sea'&&x.c>h.c-1).forEach(x=>{if(!seaC.includes(x))seaC.push(x);}));
  ports.forEach(h=>nbrs(h.c,h.r).forEach(n=>nbrs(n.c,n.r).filter(x=>x.t==='sea'&&x.c>h.c&&!seaC.includes(x)).forEach(x=>seaC.push(x)))); // 第二圈外海格
  seaC.slice().forEach(h=>nbrs(h.c,h.r).filter(x=>x&&x.t==='sea'&&!seaC.includes(x)).forEach(x=>seaC.push(x))); // 第三圈：讓最多 16 個棋子有位置
  for(let i=0;i<nd&&i<seaC.length;i++){const h=seaC[i];if(unitsAt(h.k).length<STACK_MAX)S.units.push(mkUnit('atk','dd',h.k,{}));}
  // 共軍航艦群在台灣東側海域活動
  CV_START.slice(0,Math.min(3,P.plaCV)).forEach(([lo,la],ci)=>{const [c,r]=llToRC(lo,la),h=TER[K(c,r)];if(h&&h.t==='sea'&&canStack({side:'atk'},
      h.k)){const cvU=mkUnit('atk','cv',h.k,{});cvU.cvi=ci;cvU.wmag=CVW.PLA[ci].mag;S.units.push(cvU);spawnEscorts(cvU,ESC_PLA,'atk');}});
  psubSpawn(); // 共軍潛艦：開戰前已出港布署
  heliSpawn(); // 陸軍攻擊直升機旅：放在駐地
  rocFleetsSpawn(); // 台灣海軍：6 個艦隊在母港（組成依年份）
  // 潛艦：劍龍級 2 艘（海龍、海虎，左營）＋海鯤（依年份）。高雄、花蓮港出港（隱蔽、魚雷有限，回港才能補彈）
  const pref=[SPOT.hualien,SPOT.kaohsiung],hkp=Object.values(TER).filter(h=>h.isl==='TW'&&h.t==='port'&&S.owner[h.k]==='def').map(h=>h.k).sort((x,y)=>((pref.indexOf(x)+1)||9)-((pref.indexOf(y)+1)||9));
  const nSub=Math.min(4,P.rocSub),nHL=Math.min(HL_N,nSub),hl=[SPOT.kaohsiung].concat(hkp.filter(k=>k!==SPOT.kaohsiung));
  const put=(list,n,f)=>{for(let i=0,j=0;i<n&&j<list.length;){const k=list[j];if(unitsAt(k).length<STACK_MAX+1){const u=mkUnit("def","hk",subSea(k)||k,{hm:HK_HM});f(u,i);u.tp=hkTp(u);S.units.push(u);i++;}else j++;}};
  put(hl,nHL,(u,i)=>{u.hl=1;u.nm=HL_NM[i]||'劍龍級';}); // 劍龍級母港左營（高雄），滿了才往下一個港
  put(hkp.filter(k=>k!==SPOT.kaohsiung).concat(hkp.includes(SPOT.kaohsiung)?[SPOT.kaohsiung]:[]),nSub-nHL,()=>{}); // 海鯤：花蓮優先，避免和劍龍級擠在同一港
}
function subSea(k){ // 潛艦開戰前就從母港出港，在港外約 30～50 km 的海上隱蔽待命（不會在港內被第一波打沉）
  const h0=TER[k];if(!h0)return null;const seen=new Set([k]);let q=[h0];
  for(let d=1;d<=kmH(50)&&q.length;d++){const nx=[];for(const h of q)for(const n of nbrs(h.c,h.r)){if(!n||seen.has(n.k)||n.t!=='sea')continue;seen.add(n.k);nx.push(n);
      if(d>=kmH(30)&&!unitsAt(n.k).length&&!S.units.some(e=>e.side==='atk'&&hd(hexOf(e),n)<=kmH(20)))return n.k;}q=nx;}
  return null;
}
function syncShips(){
  if(!S.pools)return;
  for(const [type,side,key] of [['dd','atk','plaNavy'],['cv','atk','plaCV'],['hk','def','rocSub'],['psub','atk','plaSub']]){
    const us=S.units.filter(u=>u.type===type&&u.side===side);let extra=us.length-Math.max(0,S.pools[key]);
    while(extra>0&&us.length){const u=us.pop();fxq({t:'dead',at:[u.c,u.r],type:u.type,side:u.side});S.units=S.units.filter(x=>x!==u);extra--;log(uname(u)+' 在 '+hname(hexOf(u))+' 被擊沉（海上交戰）');}
  }
}
// 守方預先布雷：在可能的西岸灘頭與近海布設（火山布雷車用於灘頭，水雷用於近海）；攻方掃雷要耗費時間
function layMines(){
  S.mines={};let n=S.pools.rocMine||0;if(n<=0)return;
  const cand=Object.values(TER).filter(h=>h.isl==='TW'&&(h.t==='plain'||h.t==='port'||h.t==='city')&&!h.cliff&&!h.mud&&nbrs(h.c,h.r).some(x=>x.t==='sea'&&x.c<h.c));
  const dp=h=>Math.min(...PORTS.map(k=>hd(h,TER[k])));
  const beach=cand.filter(h=>h.lon<121.1).sort((a,b)=>dp(a)-dp(b)||a.r-b.r);
  const seaS=new Set();beach.forEach(h=>nbrs(h.c,h.r).filter(x=>x.t==='sea'&&x.c<h.c).forEach(x=>seaS.add(x.k)));
  const sea=[...seaS].map(k=>TER[k]).sort((a,b)=>dp(a)-dp(b)||a.r-b.r);
  const land=beach.filter(h=>!unitAt(h.k));
  for(let i=0;n>0&&(sea.length||land.length);i++,n--){
    const h=(i%2===0?sea:land).shift()||sea.shift()||land.shift();if(!h)break;
    if(!S.mines[h.k])S.mines[h.k]=1;
  }
  syncMines();log('守方預先布雷：'+Object.keys(S.mines).length+' 處（灘頭與近海）。');
}
const syncMines=()=>{if(S.pools)S.pools.rocMine=Object.keys(S.mines).length;};
function mineCheck(u,h){
  if(u.side!=='atk'||!S.mines||!S.mines[h.k])return;
  if(hitP(.5,'mineCheck')){delete S.mines[h.k];syncMines();log(uname(u)+' 在 '+hname(h)+' 觸雷（'+lastTxt()+'）');fxq({t:'txt',at:[h.c,h.r],s:'觸雷',col:'atk'});damage(u,1,'水雷');}
  else log(uname(u)+' 通過 '+hname(h)+' 布雷區，未觸雷（'+lastTxt()+'）');
}
function sweepMines(){
  const ks=Object.keys(S.mines||{});if(!ks.length)return;
  const P=S.pools;if(P.plaNavy<2||S.turn<2)return; // 開戰第 1 回合來不及掃雷
  const sw=Math.min(ks.length,P.plaNavy>=6?2:1),got=[];
  const sea=S.units.filter(u=>u.side==='atk');
  ks.sort((a,b)=>{const f=k=>Math.min(99,...sea.map(u=>hd(TER[k],hexOf(u))));return f(a)-f(b);});
  for(let i=0;i<sw;i++){const k=ks[i];delete S.mines[k];got.push(hname(TER[k]));if(hitP(1/6,'sweepMines')){P.plaNavy--;got.push('掃雷艦觸雷（攻方護航艦 −1）');}}
  syncMines();log('攻方掃雷：清除 '+got.join('、')+'。');
}
const POOLN={rocHf2A:'雄二空射型（經國號；★數量未公開，推估 40 枚）',rocHCD:'魚叉岸防系統飛彈（每點約 100 枚；依交付時程）',plaFAC:'海峽輕型艦艇（022 飛彈快艇、056 輕型護衛艦；★1 點約 6 艘，推估）',plaDrone:'舊戰機改裝無人機（誘餌，每個攻方階段放出 40 架消耗守方攔截彈）',
    rocRkt:'雷霆2000火箭彈庫存（每發 1 點）',plaLst:'兩棲艦群（運旅、可搶灘；往返制，一旦被擊沉即永久損失）',plaLift:'補給運輸船（商船、滾裝船）：往返運補，被擊沉就永久損失',rocAS:'雄二／雄三反艦飛彈（每點約 100 枚）',plaSub:'潛艦（地圖棋子：1 點＝1 個棋子，約 2～3 艘，含 093 型核潛艦）',rocMine:'布雷（火山布雷車、水雷）',
    plaAir:'陸基空軍（東部戰區）',plaCV:'航艦（含艦載機）',plaCM:'巡弋飛彈（長劍、鷹擊）',plaAD:'防空',plaNavy:'海軍護航艦隊',rf:'短程彈道飛彈與長程火箭',plaLR:'東風-26／21D',plaHS:'東風-17 高超音速',rocAir:'空軍（F-16V 等）',rocNavy:'海軍',
    rocSub:'潛艦（海鯤）',rocAD:'防空（天弓等）',rocMsl:'長程對地飛彈（雄二E 等；1 點≈25 枚）',rocAtc:'陸軍戰術飛彈（ATACMS，海馬士用；每點 1 枚）',rocAAsh:'空射反艦飛彈（AGM-84L 魚叉；每點 1 枚）',rocWC:'萬劍彈（經國號空射對地，射程約 200 km；每點 1 枚）',
    rocSlam:'SLAM-ER 空射對地飛彈（射程約 270 km；每點 1 枚）',rocGml:'GMLRS 精準火箭彈（海馬士用；每點 1 個莢艙＝6 發）',rocDrone:'無人機與巡飛彈'};
const CN={US:'美國',JP:'日本'};
const LV={US:['不介入','情報支援','有限介入','全面參戰'],JP:['中立','後方支援','全面參戰']};

/* ---------- mainland PLA bases (publicly reported sites, positions approximate) ---------- */
const KIND_N={rf:'火箭軍',air:'空軍基地',navy:'海軍基地',stg:'集結港',isr:'指揮與偵察'};
const KIND_S={rf:'◆',air:'▲',navy:'■',stg:'●',isr:'✦'};
const CNB={
  huangshan:{n:'黃山',kind:'rf',lon:118.3,lat:29.7,hp:3,side:'r',d:'火箭軍飛彈旅駐地（安徽）'},
  leping:{n:'樂平',kind:'rf',lon:117.1,lat:29.0,hp:3,side:'l',d:'火箭軍飛彈旅駐地（江西）'},
  shangrao:{n:'上饒',kind:'rf',lon:118.0,lat:28.2,hp:3,side:'r',d:'火箭軍飛彈旅駐地（江西）'},
  yongan:{n:'永安',kind:'rf',lon:117.4,lat:25.95,hp:3,side:'l',d:'火箭軍飛彈旅駐地（福建）'},
  meizhou:{n:'梅州',kind:'rf',lon:116.3,lat:24.6,hp:3,side:'r',d:'火箭軍飛彈旅駐地（廣東）'},
  ningbo:{n:'寧波',kind:'air',lon:121.2,lat:29.55,hp:3,side:'r',d:'東部戰區空軍機場（浙江）'},
  changle:{n:'長樂',kind:'air',lon:119.3,lat:26.1,hp:3,side:'l',d:'福州長樂機場一帶（福建）'},
  huian:{n:'惠安',kind:'air',lon:118.7,lat:25.1,hp:3,side:'l',d:'泉州惠安機場一帶（福建）'},
  shantou:{n:'汕頭',kind:'air',lon:116.7,lat:23.4,hp:3,side:'l',d:'汕頭外砂機場一帶（廣東）'},
  zhoushan:{n:'舟山',kind:'navy',lon:122.25,lat:30.05,hp:3,side:'r',d:'東海艦隊基地（浙江）'},
  xiamen:{n:'廈門',kind:'navy',lon:118.05,lat:24.45,hp:3,side:'r',d:'廈門海軍基地（福建）'},
  nanjing:{n:'南京',kind:'isr',lon:118.78,lat:32.05,hp:2,side:'r',d:'東部戰區聯合作戰指揮中心（江蘇，概略位置）'},
  putian:{n:'莆田',kind:'isr',lon:119.1,lat:25.35,hp:2,side:'l',d:'福建沿海雷達與電子偵察站（概略位置，推估）'}
};

const BASES={
  okinawa:{n:'沖繩本島',d:'嘉手納、普天間、那霸',lon:127.75,lat:26.35,c:'JP',need:4},
  sakishima:{n:'宮古・石垣',d:'陸自地對艦飛彈',lon:124.7,lat:24.6,c:'JP',need:4},
  sasebo:{n:'佐世保',d:'海自、美海軍基地',lon:129.72,lat:33.16,c:'JP',need:4},
  guam:{n:'關島',d:'安德森空軍基地，圖外約 2,700 公里',lon:131.2,lat:14.6,c:'US',need:6},
  sea:{n:'菲律賓海',d:'航艦打擊群（只有到場後才能打擊，需擲 6）',lon:128.6,lat:21.6,c:'US',need:6}
};
const BASE_TRIG={okinawa:{JP:2,US:3},sakishima:{JP:2,US:2},sasebo:{JP:2,US:2},guam:{US:3},sea:{US:3}};
const FORCES=[
  {id:'kadena',c:'US',n:'美空軍 第18聯隊',d:'F-15EX、F-35A',base:'okinawa',kind:'air',hp:3,min:2,needs:'JP'},
  {id:'usmc',stand:true,c:'US',n:'美陸戰隊 第12濱海團',d:'NMESIS 反艦飛彈',base:'okinawa',kind:'ssm',hp:2,min:3,needs:'JP'},
  {id:'ssn',stand:true,land:1,c:'US',n:'美海軍 攻擊潛艦',d:'無法被火力打擊',base:'sea',kind:'sub',hp:2,min:2,hidden:true},
  {id:'bomber',stand:true,land:1,c:'US',n:'美空軍 轟炸機',d:'B-1B 攜 LRASM',base:'guam',kind:'air',hp:2,min:2,salvo:2},
  {id:'csg',land:1,c:'US',n:'美海軍 航艦打擊群',d:'第 7 艦隊，參戰後 2 回合抵達',base:'sea',kind:'air',hp:3,min:3,delay:2},
  {id:'csg2',land:1,c:'US',n:'美海軍 第 2 航艦打擊群',d:'平時在西太平洋或南海巡弋的航艦，參戰後 ★4 回合（約 2 天）抵達',base:'sea',kind:'air',hp:3,min:3,delay:4},
  {id:'csg3',land:1,c:'US',n:'美海軍 第 3 航艦打擊群',d:'自夏威夷或美國本土緊急調派，參戰後 ★16 回合（約 8 天，航程約 4,800 海里）抵達',base:'sea',kind:'air',hp:3,min:3,delay:16},
  {id:'mdtf',stand:true,land:1,c:'US',n:'美陸軍 多域特遣隊',d:'海馬士、堤豐',base:'sakishima',kind:'ssm',hp:2,min:3,needs:'JP'},
  {id:'jasdf',c:'JP',n:'空自 第9航空團',d:'F-15J（那霸）',base:'okinawa',kind:'air',hp:2,min:2},
  {id:'jgsdf',land:1,c:'JP',n:'陸自 地對艦飛彈連隊',d:'12式地對艦飛彈',base:'sakishima',kind:'ssm',hp:2,min:2},
  {id:'jmsdf',c:'JP',n:'海自 護衛隊群',d:'佐世保出港（含出雲級、F-35B），參戰後 1 回合抵達',base:'sasebo',kind:'ship',hp:2,min:2,delay:1},
  {id:'jss',c:'JP',n:'海自 潛艦隊',d:'無法被火力打擊',base:'sea',kind:'sub',hp:2,min:2,hidden:true}
];
function initTheater(){
  S.pools=Object.assign({},POOL0);S.p0=Object.assign({},POOL0);S.era='2026';S.dfireMax=2;
  S.fx={lv:{US:0,JP:0},reach:{US:{},JP:{}},units:FORCES.map(f=>Object.assign({max:f.hp},f))};
  S.cn={};Object.keys(CNB).forEach(id=>S.cn[id]=CNB[id].hp);S.retal=0;S.dfire=0;S.cnLog=[];
  S.us={drop:0,rally:0,hist:[]};
}
function fxReady(f){const r=S.fx.reach[f.c][f.min];return r!==undefined?r+(f.delay||0):null;}
/* ---------- US posture: covert support -> proxy fires (deniable) -> open war; retreats when casualties mount ---------- */
const POSTURE=['隱蔽支援','代理打擊','公開參戰'];
const pn=(i,fx)=>(i===0&&(fx||S.fxScen)==='intel')?'僅提供情報':POSTURE[i];
const pd=i=>(i===0&&S.fxScen==='intel')?'不公開參戰：只提供情報（衛星、偵察與目標資料），不提供補給與作戰行動':POSTURE_D[i];
const POSTURE_D=['不承認介入：只剩情報、補給，以及不具名的潛艦行動','不承認參戰：台美共用的飛彈、魚雷外觀與編號相同，難分是誰發射，以台灣、日本名義打擊；載人機艦撤出戰區','公開承認參戰：各項兵力全數投入'];
// -1 = no US help at all (Taiwan-alone scenario)
function usIdx(){
  if(S.fxScen==='none')return -1;
  const lv=S.fx.lv.US,base=lv>=3?2:S.fxScen==='intel'?0:1; // 台美共用飛彈、魚雷，不公開參戰時至少也是代理打擊
  return Math.max(0,base-(S.us.drop||0));
}
const usCas=()=>S.fx.units.filter(f=>f.c==='US').reduce((a,f)=>a+(f.max-f.hp),0);
function notePosture(why,retreat){
  const i=usIdx(),last=S.us.hist[S.us.hist.length-1];
  if(i<0||(last&&last.idx===i&&!retreat))return;
  S.us.hist.push({t:S.turn,p:S.phase,idx:i,why,retreat:!!retreat});
  log('美國立場：'+pn(i)+'（'+why+'）');
}
function usRally(){
  S.us.rally=S.turn;
  if(S.us.drop>0){S.us.drop--;notePosture('美國本土（關島）遭攻擊，民意凝聚，恢復立場');}
}
// at the start of each defender phase: casualty review (retreat?) and the quiet help that is always there
function usReview(){
  if(usIdx()<0)return;
  const u=S.us,cas=usCas(),th=[6,11][u.drop];
  if(usIdx()>0&&th!==undefined&&cas>=th){
    const recent=u.rally&&S.turn-u.rally<=2,pr=Math.max(0,Math.min(1,(recent?1:3)/6)); // 原本擲骰 4 以上（本土遭攻擊時 −2）＝機率 3/6 或 1/6
    if(hitP(pr,'usReview')){u.drop++;notePosture('美軍'+casN(cas)+'，政治壓力升高，改為更低調的方式',true);}
    else log('美國：美軍'+casN(cas)+'，但'+(recent?'本土遭攻擊使民意凝聚':'國內支持未動搖')+'（退縮機率 '+Math.round(pr*100)+'%，固定規則），維持現有立場');
  }
  S.mods.ssmNeed=Math.min(S.mods.ssmNeed,3);
  if(S.fxScen!=='intel'&&S.turn>=2&&S.turn<=4&&S.pools.rocMsl<S.p0.rocMsl+3){S.pools.rocMsl++;log('美國隱蔽補給：台灣長程飛彈存量 +1');}
}
function usForceOn(f){
  const i=usIdx();if(i<0||f.hp<=0)return false;
  if(f.needs&&S.fx.lv[f.needs]<1)return false;
  if(i===2)return S.fx.lv.US>=f.min&&S.turn>=fxReady(f);
  if(i===1)return !!f.stand&&Math.max(S.fx.lv.US,2)>=f.min&&S.turn>=fxReady(f);
  return f.id==='ssn'&&S.turn>=2&&S.fxScen!=='intel';
}
const usVol=f=>{const i=usIdx();return i>=2?1:i===1?(S.fx.lv.US>=2?.6:.45):.5;};
function fxActive(f){
  if(f.c==='US')return usForceOn(f);
  if(f.hp<=0||S.fx.lv[f.c]<f.min)return false;
  if(f.needs&&S.fx.lv[f.needs]<1)return false;
  return S.turn>=fxReady(f);
}
function fxStatus(f){
  if(f.hp<=0)return '已失去戰力';
  if(f.c==='US'){
    const i=usIdx();if(i<0)return '未參戰';
    if(usForceOn(f))return i===2?'出擊中':i===1?'代理打擊中':'隱蔽行動（不承認）';
    if(S.fx.lv.US>=f.min&&i<2&&!(f.needs&&S.fx.lv[f.needs]<1))return '已撤出（不再公開參與）';
  }
  if(S.fx.lv[f.c]<f.min)return S.fx.lv[f.c]?'未投入作戰':'未參戰';
  if(f.needs&&S.fx.lv[f.needs]<1)return '等待'+CN[f.needs]+'同意使用基地';
  if(S.turn<fxReady(f))return '第 '+fxReady(f)+' 回合抵達';
  return '出擊中';
}
// 航艦被擊沉：任一方的航艦沉沒都是大消息。美軍航艦沉沒時，美國會依傷亡、當前參戰程度與戰況，決定退出、維持或強力報復
function bigNews(title,msg){log('【重大消息】'+title+'：'+msg);if(!(S.rec&&REC.quiet))toast('📰 重大消息：'+title,6500);S.bigNews=S.bigNews||[];S.bigNews.push({t:S.turn,title,msg});}
// 抽象攻擊（潛艦海戰、抽象反艦打擊）打到共軍航艦時：地圖上有航艦棋子就打在棋子上（固定挑步數最多的那艘），沒有棋子的航艦（例如第 4 艘）才直接減數量
// 魚雷：命中扣 1 步（與海鯤魚雷一致）；反艦飛彈：先過艦隊防空（齊射模型），航艦每 2 枚命中扣 1 步
function cvHitAbstract(kind,who){
  const P=S.pools,all=S.units.filter(u=>u.type==='cv'&&u.side==='atk'&&alive(u)),pcs=all.filter(u=>!cvOOA(u)); // 已失去戰力的航艦不再是目標
  if(!pcs.length&&all.length)return '';
  if(pcs.length){const t=pickBest(pcs,x=>x.hp),at=hname(hexOf(t));
    if(kind==='torp'){damage(t,1,who+'魚雷');return who+'魚雷命中 '+at+' 的共軍航艦群（'+cvSt(t.hp,mhpOf(t))+'）';}
    const r=salvoCalc(t,1,false,'abs>cv'),st=r.hits?takeInt(.5,'salvoBig'):0;if(st)damage(t,st,who);
    return r.hits?(st?who+'命中 '+at+' 的共軍航艦群（'+cvSt(t.hp,mhpOf(t))+'）':who+'命中共軍航艦群，但航艦體積大，未造成重創'):who+'攻擊共軍航艦群，被艦隊防空攔截';}
  if(P.plaCV>0){P.plaCV--;plaCarrierLost(kind==='torp'?'魚雷':'反艦飛彈',who);return who+'擊沉一艘不在地圖上的共軍航艦（共軍航艦 −1）';}
  return '';
}
function plaCarrierLost(how,who){log('共軍航艦遭擊沉：'+(who||'守方')+'以'+(how||'攻擊')+'擊沉（剩餘 '+Math.max(0,S.pools.plaCV)+' 艘）');bigNews('共軍航艦遭擊沉','共軍航艦被'+(how||'守方攻擊')+'擊沉，剩餘 '+Math.max(0,S.pools.plaCV)+' 艘；攻方的制空與艦載機出擊能力大受打擊，全球媒體頭條。');}
const CSGS=['csg','csg2','csg3'],isCSG=f=>!!f&&CSGS.includes(f.id),csgIdx=id=>Math.max(0,CSGS.indexOf(id||'csg'));
const csgName=i=>i?'美軍第 '+(i+1)+' 航艦打擊群':'美軍航艦打擊群';
function uscPieces(){return S.units.filter(u=>u.type==='csg'&&alive(u));}
const csgFx=u=>S.fx&&S.fx.units.find(x=>x.id===(u.fid||'csg'));
const csgPieceOf=f=>S.units.find(u=>u.type==='csg'&&(u.fid||'csg')===f.id&&alive(u));
function usCarrierSunk(how){
  log('美軍航艦群（'+(how||'守方攻擊')+'）遭擊沉，失去戰鬥力');
  const idx=usIdx();bigNews('美軍航艦遭擊沉','第 7 艦隊的航艦打擊群在台海附近被擊沉，數千名官兵可能罹難，美國社會震動。');
  if(idx<0)return;
  const cas=usCas(),n=conditions().filter(c=>c.atk).length,recent=S.us.rally&&S.turn-S.us.rally<=2;
  const wR=Math.max(.05,.18+.03*cas+(idx>=2?-.08:0)-(n>=2?.06:0)),wE=Math.max(.1,.3+.1*n+(recent?.2:0)+(idx>=2?.1:0)),wH=Math.max(.1,1-wR-wE),tot=wR+wE+wH,r=Math.random()*tot;
  if(r<wR){S.us.drop=Math.max(S.us.drop||0,1)+1;notePosture('航艦遭擊沉，美國國內壓力暴增，政府宣布撤出戰區',true);log('美國：航艦沉沒後政治壓力過大（'+casN(cas)+'），退出戰場，改為最低限度的支援');}
  else if(r<wR+wE){setLevel('US',Math.min(3,Math.max(S.fx.lv.US,2)+1),'航艦遭擊沉的報復');S.us.drop=0;S.us.rally=S.turn;
    let k=0;for(let i=0;i<3;i++){const id=aiPickCN();if(!id)break;strikeCN(id,'US');k++;}
    log('美國：航艦沉沒激起強烈報復，全力投入並對大陸基地發動 '+k+' 次打擊');}
  else log('美國：航艦沉沒後暫時維持現有立場，等待進一步情勢（'+casN(cas)+'）');
}
function setLevel(c,v,why){
  if(S.fxLock||v<=S.fx.lv[c])return false;
  for(let l=S.fx.lv[c]+1;l<=v;l++)if(S.fx.reach[c][l]===undefined)S.fx.reach[c][l]=S.turn;
  S.fx.lv[c]=v;log(CN[c]+'：'+LV[c][v]+(why?'（'+why+'）':''));
  if(c==='US'){S.mods.ssmNeed=Math.min(S.mods.ssmNeed,3);S.us.drop=0;notePosture('參戰程度升為「'+LV.US[v]+'」');}
  if(c==='JP'&&v===2)setLevel('US',Math.max(S.fx.lv.US,2),'同盟條約');
  return true;
}
// 機場：每座機場有損傷等級 0 完好／1 受損（起降 50%）／2 嚴重受損（20%）／3 癱瘓或被占領（0%）；守方空軍只能從還能用的機場起飛
let AFL=null;
const airfields=()=>AFL||(AFL=Object.values(TER).filter(h=>h.t==='air'&&h.isl==='TW'));
// 跑道：每座機場可起降的跑道數（含可起降的平行滑行道、戰備跑道）。依維基百科與新聞：桃園、台南、岡山各 2 條平行跑道；屏東北、南兩片場站；
//  嘉義另有戰備跑道；志航另有可起降的滑行道；清泉崗、花蓮各 1 條；新竹各來源 1～2 條不一，★取 1。S.afDmg[k]＝被切斷（待搶修）的跑道數
const AF_RWY={taoyuanap:2,tainanab:2,gangshan:2,pingtung:2,chiayiab:2,chihhang:2,ckk:1,hsinchuab:1,chiashan:1};
const afRwy=k=>{const id=Object.keys(AF_RWY).find(x=>SPOT[x]===k);return id?AF_RWY[id]:1;};
const afCut=k=>Math.min(afRwy(k),(S.afDmg&&S.afDmg[k])||0);
const afCap=k=>S.owner[k]==='atk'?0:(afRwy(k)-afCut(k))/afRwy(k); // 起降能力＝可用跑道 ÷ 總跑道
// 攻方占領的機場：跑道還有一半以上能用、制空不在守方、天候可飛時，可以空運（★每座每回合補給 1 個旅、最多 2 座；未空降的空降旅可直接機降）
const afRoom=(u,k)=>{const a=unitsAt(k).filter(x=>!x.boundTo);return a.length<STACK_MAX&&a.every(x=>x.side===u.side&&x!==u);}; // 機降到自己守住的機場：不受敵方接觸區限制
function atkAF(){ // 機場上要有攻方地面部隊、而且從上一回合就守住（剛奪下的跑道要先清理、確保安全）
  const H=S.afHeld||(S.afHeld={}),L=[];
  for(const h of airfields()){const on=S.owner[h.k]==='atk'&&unitsAt(h.k).some(u=>u.side==='atk'&&!isShip(u)&&u.hp>0);
    if(!on){delete H[h.k];continue;}if(H[h.k]==null)H[h.k]=S.turn;
    if(H[h.k]<S.turn&&(afRwy(h.k)-afCut(h.k))/afRwy(h.k)>=.5)L.push(h);}
  return (!S.weather||S.weather.air)&&S.airCtl!=='def'?L:[];
}
const afLevel=k=>S.owner[k]==='atk'||afCap(k)<=0?3:afCut(k)===0?0:afCap(k)>=.5?1:2; // 0 完好、1 部分跑道受損、3 全部癱瘓或被占領（供圖示與電腦判斷）
const afTxt=k=>afCap(k)<=0?'跑道全部癱瘓（無法起降）':afCut(k)?'切斷 '+afCut(k)+' 條跑道（剩 '+(afRwy(k)-afCut(k))+'／'+afRwy(k)+' 條，起降 '+Math.round(afCap(k)*100)+'%）':'完好（'+afRwy(k)+' 條跑道）';
function afShare(){ // 守方戰機實際能起降的比例：依各基地戰機數加權（炸沒有戰鬥機的民用機場或訓練基地，不影響出擊）
  if(S.air&&S.air.bw){const c=afBaseCounts();let t=0,a=0;for(const k in c){t+=c[k];a+=c[k]*afCap(k);}return t>0?a/t:0;}
  const L=airfields();return L.length?L.reduce((a,h)=>a+afCap(h.k),0)/L.length:1;}
const CAVE=280; // ★山洞機堡可容納的戰機：佳山約 200、石子山（志航）約 80（維基百科等非官方估計）
const caveF=()=>S.mods&&S.mods.cave&&S.turn<=S.mods.cave.until&&S.air?Math.min(1,CAVE/Math.max(1,S.air.TW))*(S.mods.cave.w||1):0; // w：來得及躲進去的比例（戰略突襲時 ★0.5） // 躲進山洞機堡的戰機比例
const gndMul=()=>(1-caveF())*(S.mods&&S.mods.disp?.5:1); // 機場被打時地面戰機損失的倍率：機堡內的不會被炸、★分散到疏散機場與公路跑道減半
const rocAirEff=()=>S.pools.rocAir*afShare()*(1-caveF());
// ---------- 固定雷達站（固定目標：看得到、打得到）----------
// 樂山：鋪路爪長程預警雷達（新竹樂山，海拔約 2,600 公尺，2013 年啟用）；報導：對彈道飛彈約 6 分鐘預警，2024 年仍未與天弓整合
//  被摧毀：愛國者攔截率 ×0.8（★推估：失去預警與目標指示；天弓本來就沒整合，不受影響）
// 東引：空軍長程預警雷達，把防空預警往北延伸約 100 公里；被摧毀：守方空中有效戰力 ×0.9（★推估：失去北面早期預警）
// 打擊：固定目標不需定位；彈道飛彈先過守方攔截，命中依武器數量（每枚 40%；★雷達陣面是軟目標）；命中即失效，不會修復
const FAC={leshan:{n:'樂山雷達',ll:[121.12,24.55],d:'鋪路爪長程預警雷達，對彈道飛彈約 6 分鐘預警；美國建造、與美方共享資料。被摧毀後改由美國衛星預警轉傳（較慢）：愛國者攔截率 ×0.9，沒有美國情報時 ×0.8（推估；天弓尚未整合，不受影響）；美國介入評估 +1。'},
  dongyin:{n:'東引雷達',ll:[120.49,26.37],d:'空軍長程預警雷達，把防空預警往北延伸約 100 公里。被摧毀後守方空中有效戰力 ×0.9（推估）。'}};
const facUp=id=>!(S.facDown&&S.facDown[id]);
// 美國情報：除了「不介入（台灣孤軍）」，美國至少提供衛星與偵察情報。飛彈預警來源：樂山雷達（約 6 分鐘）→ 樂山被毀時改由美國衛星預警轉傳（★約 4 分鐘，較慢）→ 都沒有就沒有預警
const intelOK=()=>S.fxScen!=='none';
const warnSrc=()=>facUp('leshan')?'leshan':intelOK()?'sat':null;
const WARN={leshan:{n:'樂山雷達',min:6,civ:.6,pk:1},sat:{n:'美國衛星預警（轉傳）',min:4,civ:.75,pk:.9}}; // ★有預警時民眾進入掩體，飛彈造成的平民傷亡倍率；愛國者攔截率倍率（推估）
const warnCiv=()=>{const w=WARN[warnSrc()];return w?w.civ:1;};
function warnNotice(){ // 攻方階段開始：預警飛彈來襲
  if(!S.fire)return;const w=WARN[warnSrc()];S.mslWave=(S.mslWave||0)+1;
  const t=w?'🛰 '+w.n+'：偵測到共軍準備第 '+S.mslWave+' 波飛彈攻擊，發射後約 '+w.min+' 分鐘抵達，民眾請進入掩體':'⚠ 第 '+S.mslWave+' 波飛彈來襲：樂山雷達已毀、也沒有美國情報，無法提前預警';
  log(t+(w?'（預警讓平民傷亡約 ×'+w.civ+'，推估）':''));if(S.ctrl.def==='human'&&!S.sim&&!S.video)toast(t,4200);
}
function intelStaging(){ // 守方階段開始：美國情報通報大陸沿岸的集結
  if(!intelOK())return;const g={};for(const u of stgUnits()){const n=hname(hexOf(u)).replace(/^大陸 /,'');g[n]=(g[n]||0)+1;}
  const L=Object.entries(g).sort((a,b)=>b[1]-a[1]);if(!L.length)return;
  const t='🛰 美國情報：共軍兩棲部隊在 '+L.slice(0,3).map(([n,c])=>n+'（'+c+' 個單位）').join('、')+(L.reduce((a,x)=>a+x[1],0)>=4?' 大量集結':' 集結')+'，建議縱深打擊源頭（登船前最脆弱）';
  log(t);if(S.ctrl.def==='human'&&!S.sim&&!S.video)toast(t,4500);
}
function facHex(id){let [c,r]=llToRC(FAC[id].ll[0],FAC[id].ll[1]);c=Math.max(COL0,Math.min(COL1-1,c));r=Math.max(ROW0,Math.min(ROW1-1,r));return TER[K(c,r)];}
function strikeFac(id){
  if(!facUp(id))return false;const h=facHex(id),pk=fireTake(h,false);if(!pk)return false;S.stats.fire++;
  const r=pk.n?adIntercept(pk.n):{surv:0,I:0},m=pk.n?r.surv/pk.n:1,ok=hitP(lchKillP(pk)*m,'fac:'+id);
  fxq({t:'air',at:[h.c,h.r],hit:ok,tsea:false,org:orgPick('pla'),k:pk.hs?'hs':pk.k==='g'?'cm':'bm',ad:r.I>0?(ok?'pass':'int'):undefined});
  if(ok){S.facDown=S.facDown||{};S.facDown[id]=S.turn;}
  log('火力打擊 '+FAC[id].n+(pk.n?'（'+pk.n+' 枚，守方發射 '+r.I+' 枚攔截彈）':'')+(ok?'：命中，雷達失效。'+FAC[id].d.split('。')[1]+'。':'：未命中'));
  checkInstant();return true;
}
function facSVG(){
  if(!S.started)return '';const strikeOn=humanTurn()&&S.phase==='atk'&&S.mode==='strike';let o='';
  for(const id in FAC){const h=facHex(id);if(!h)continue;const [x,y]=center(h.c,h.r),up=facUp(id),col=up?'var(--def,#2b5a8f)':'#888';
    const fs=Math.max(.55,SC);
      o+='<g class="fac" data-fac="'+id+'" style="cursor:pointer" transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') scale('+fs.toFixed(2)+') translate('+(-x).toFixed(1)+
          ' '+(-y).toFixed(1)+')"><circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="9" fill="var(--panel,#fff)" stroke="'+col+'" stroke-width="2"'+(strikeOn&&up?' class="ring strike"':'')+'/>'+
      '<path d="M'+(x-5).toFixed(1)+' '+(y+4).toFixed(1)+'A7 7 0 0 1 '+(x+4).toFixed(1)+' '+(y-5).toFixed(1)+'M'+(x-2).toFixed(1)+' '+(y+1).toFixed(1)+'L'+(x+3).toFixed(1)+' '+(y-3).toFixed(1)+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linecap="round"/>'+
      (up?'':'<path d="M'+(x-7)+' '+(y-7)+'L'+(x+7)+' '+(y+7)+'" stroke="#c0392b" stroke-width="2.5"/>')+
      '<text x="'+x.toFixed(1)+'" y="'+(y+16).toFixed(1)+'" text-anchor="middle" font-size="6.5" font-weight="600" fill="'+col+'" stroke="var(--panel,#fff)" stroke-width="2" paint-order="stroke" pointer-events="none">'+FAC[id].n+'</text></g>';} // 字小一點、不擋棋子；失效只看紅色斜線
  return o;
}
function strikeAirfield(k){ // 火力打擊機場：命中則切斷 1 條跑道；可用跑道剩一半以下時地面上的戰機也會損失
  const h=TER[k];if(!h||S.fire<=0)return false;if(afCap(k)<=0)return false;
  const pk=fireTake(h,false);if(!pk)return false;S.stats.fire++;S.afDmg=S.afDmg||{};
  const PM=pkgMod(pk,h,null),need=S.sead?4:5,ok=hitP(pNeed(need)*PM.m,'strikeAirfield:'+pk.k); // 跑道容易被打出彈坑；防空被壓制時更容易
  fxq({t:'air',at:[h.c,h.r],hit:ok,tsea:false,org:orgPick('pla'),k:pk.k!=='g'?'bm':'cm'});
  if(ok){S.afDmg[k]=afCut(k)+1;let more='';if(afCap(k)<=.5&&S.pools.rocAir>0&&gndMul()>0&&hitP(.5,'strikeAirfield')){more='，地面戰機 −'+airLoseAt(k,4*gndMul(),'ground')+' 架（推估：強化機堡外）';}
    log('火力打擊機場 '+(h.name||'機場')+'：'+afTxt(k)+more+'（'+(PM.txt?PM.txt+'；':'')+lastTxt()+'）');}
  else log('火力打擊機場 '+(h.name||'機場')+' 未命中（'+(PM.txt?PM.txt+'；':'')+lastTxt()+'）');
  checkInstant();return true;
}
function repairAirfields(){ // 守方每個守方階段開始時，每座未被占領的機場搶修好 1 條跑道（★快速跑道搶修：填彈坑、開出最低可用跑道約數小時，取每 12 小時 1 條）
  if(!S.afDmg)return;
  for(const k of Object.keys(S.afDmg)){if(S.owner[k]==='atk')continue;S.afDmg[k]--;if(S.afDmg[k]<=0)delete S.afDmg[k];log('守方搶修機場：'+(TER[k].name||'機場')+' 修好 1 條跑道（'+(afCut(k)?'仍有 '+afCut(k)+' 條待修，起降 '+Math.round(afCap(k)*100)+'%':'恢復運作')+'）');}
}
function allyAir(){const dh=S.units&&jmsLead(),f35=dh&&(+S.era||2026)>=2027?ptsOf(10*dh.hp/2,1.0,1.32):0; // ★出雲級 F-35B 約 10 架
  return f35+rocAirEff()+S.fx.units.filter(f=>f.kind==='air'&&fxActive(f)).reduce((a,f)=>a+(isCSG(f)?usAirPts(f):f.hp),0);} // 美航艦以艦載機實際架次計；其他盟軍空軍仍為點數
// 補給船團（慢速、無防空的商船）：比軍艦好打，只有附近的護航艦才能保護它——無護航 −1（命中門檻降低）、每有一艘護航艦在 2 格內 +1（最多 +2）
function cvyMod(t){const near=S.units.filter(e=>e.side==='atk'&&e.type==='dd'&&rd(hexOf(e),hexOf(t))<=kmH(40)).length;return -1+Math.min(2,near);}
// 守方選目標的價值：航艦最高，其次是補給船團（打掉補給就是斷攻方的後路）、載著登陸部隊的船，護航艦最低
const tgtVal=e=>(e.type==='cv'?(cvOOA(e)?.5:4):e.type==='cvy'?3:(e.type==='amph'||e.type==='mar'||e.type==='arm')?2.5:e.type==='dd'?1:1.5)+(e.boundTo&&S.units.some(x=>x.id===e.boundTo)?2.5:0); // 載著旅的運輸船：船＋旅的價值
function pickW(arr,f){let t=arr.reduce((a,x)=>a+f(x),0),r=Math.random()*t;for(const x of arr){if((r-=f(x))<=0)return x;}return arr[0];}
function escortMod(){return S.pools.plaNavy>=5?1:0;}
// 大陸基地損傷：火箭軍旅駐地、空軍機場被打掉的比例，就是對應發射與出擊能量的損失（發射架、跑道損毀就發射不出去）
function cnShare(kind){let a=0,b=0;for(const id of Object.keys(CNB)){if(CNB[id].kind!==kind)continue;a+=Math.max(0,S.cn[id]);b+=CNB[id].hp;}return b?a/b:1;}
// 沒有棋子的台灣部隊（空軍、無人機、海軍抽象部分）開火時，特效從真實的發射位置出發：空軍＝離目標最近、還能起降的機場；無人機＝離目標最近的守方地面單位；其他＝最近的守方飛彈車或艦隊
function rocOrigin(fk,tg){
  const near=arr=>arr.length?pickBest(arr,x=>-hd(x.h,hexOf(tg))):null;
  let c=null;
  if(fk==='bomb')c=near(airfields().filter(h=>S.owner[h.k]==='def'&&afLevel(h.k)<3).map(h=>({h})));
  else if(fk==='drone')c=near(S.units.filter(u=>u.side==='def'&&onTW(u)&&!isMsl(u)).map(u=>({h:hexOf(u)})));
  else c=near(S.units.filter(u=>u.side==='def'&&alive(u)&&(u.type==='ssm'||u.fl)).map(u=>({h:hexOf(u)})));
  return c?[c.h.c,c.h.r]:null;
}
function antiShip(who,shots,need,canLand,tag,ok0,fk){
  const base=ok0||'roc';
  const P=S.pools;let hc=0,he=0,hl=0,cvh=0;
  for(let i=0;i<shots;i++){
    const fleet=S.units.filter(u=>u.side==='atk'&&atSea(u)&&(!isShip(u)||u.type==='cv'||u.type==='cvy'));
    if(fleet.length&&(hitP(.67,'antiShipFleet')||P.plaNavy<=0)){const tg=pickBest(fleet,tgtVal),cov=S.units.some(x=>x.type==='dd'&&x!==tg&&rd(hexOf(x),hexOf(tg))<=kmH(40))?1:0,
        sat=satHit(tg),gc=grpCovered(tg),ok=gc?salvoCalc(tg,1,false,'antiShip:grp').hits>0:(sat>=3||hitP(pNeed(need+(tg.type==='cvy'?cvyMod(tg):escortMod()+cov)-sat),'antiShip'));
      fxq({t:'air',at:[tg.c,tg.r],hit:ok,tsea:true,org:base==='roc'&&rocOrigin(fk,tg)?undefined:orgPick(base),from:base==='roc'?rocOrigin(fk,tg)||undefined:undefined,k:fk||'cm',ad:P.plaAD>0&&fk!=='torp'?(ok?'pass':'int'):undefined,adSide:'atk'});
      if(ok){hc++;
      const st=gc?((tg.type==='cv'||tg.type==='csg')?takeInt(.5,'salvoBig'):1):sat>=2?2:1;
      if(st)damage(tg,st,gc?who:sat>=2?'飽和攻擊':who);
      }}
    else if(P.plaNavy>0){if(hitP(pNeed(need),'antiShip')){he++;P.plaNavy--;if(P.plaCV>0&&hitP(pNeed(5+(P.plaNavy>=5?1:0)),'antiShip')){const m=cvHitAbstract('asm',who);if(m){cvh++;log(m);}}}}
    else if(canLand){
      const land=S.units.filter(u=>u.side==='atk'&&onTW(u));if(!land.length)break;
      const t=pickBest(land,x=>tgtVal(x)*10+x.hp),h=hexOf(t),ok=hitP(pNeed(5+terrCover(h)),'antiShip');
        fxq({t:'air',at:[t.c,t.r],hit:ok,tsea:false,org:base==='roc'&&rocOrigin(fk,t)?undefined:orgPick(base),from:base==='roc'?rocOrigin(fk,t)||undefined:undefined,k:fk||'cm'});
        if(ok){hl++;
        damage(t,1,who);
        }
    } else break;
  }
  const parts=[];if(hc)parts.push('命中船團 '+hc);if(he)parts.push('擊傷護航艦 '+he);if(cvh)parts.push('攻擊航艦 '+cvh+' 次');if(hl)parts.push('命中島上部隊 '+hl);
  log(who+(tag||'')+' 出擊 '+shots+' 次'+(parts.length?'：'+parts.join('、'):'，未命中'));
}
async function navalPhase(){
  const P=S.pools;
  if(P.rocNavy>0){antiShip('守方海軍',Math.ceil(Math.max(0,P.rocNavy-S.units.filter(u=>u.type==='ff').length)/2),4,false,'','roc','cm');} // 艦隊被攻方海空兵力打擊：改由攻方階段的 huntFleets 依定位與齊射模型計算
  // 守方空軍改由各機場出擊（airstrike.js：afStrike／afAuto），彈藥有實際庫存、損失依架次
  if(P.rocDrone>0){antiShip('無人機與巡飛彈',Math.min(P.rocDrone,3),5,false,'','roc','drone');if(hitP(1/3,'navalPhase')){P.rocDrone--;log('無人機群遭干擾與攔截 −1');}}
  jmsSync();const act=S.fx.units.filter(fxActive);S._cvwDone=false;
  if(act.length)toast('美日部隊出擊');
  for(const f of act){
    if(S.over)return;
    if(f.id==='jmsdf'&&jmsPieces().length)continue; // 海自艦隊在地圖上：由棋子實際開火
    if(f.id==='ssn'&&ssnIndep())continue;           // 美軍攻擊潛艦在地圖上：已在守方階段開頭移動並開火
    if(f.id==='usmc'&&nmePiece()){if(!allyHuman()){nmeFire();render();await sleep(220);}continue;}
    if(f.id==='mdtf'&&mdtPiece()){if(!allyHuman()){mdtFire();render();await sleep(220);}continue;}
    if(isCSG(f)&&csgPieceOf(f)){if(!S._cvwDone&&!allyHuman()){S._cvwDone=true;cvwStrike('def');render();await sleep(220);}continue;} // 美航艦棋子在場：艦載機依作戰半徑實際出擊
    const us=f.c==='US',pi=usIdx(),shots=Math.max(1,Math.ceil(f.hp*(f.salvo||1)*(us?usVol(f):1)));
    antiShip(f.n,shots,4+(f.kind==='air'?(P.plaAD>=4?1:0)+(S.airCtl==='atk'?1:S.airCtl==='def'?-1:0):0),f.kind==='air',us&&pi===1?'（代理打擊）':us&&pi===0?'（不具名行動）':'',f.base,({air:'bomb',sub:'torp',ssm:'cm',ship:'cm'})[f.kind]||'cm');
    render();await sleep(220);
  }
  if(allyHuman())cvwPrepOnly('def');
  await alliedLandStrikes(allyHuman()?'start':undefined);
  seaBattle();
  checkInstant();
}
// 海上交戰：共軍護航艦隊與航艦，對上守方海軍、美日水面艦與潛艦
function seaBattle(){
  const P=S.pools,out=[];
  const act=S.fx.units.filter(f=>fxActive(f)&&f.hp>0),ships=act.filter(f=>f.kind==='ship'&&!(f.id==='jmsdf'&&jmsPieces().length)),subs=act.filter(f=>f.kind==='sub'&&!(f.id==='ssn'&&ssnIndep()));
  const rounds=Math.min(3,Math.ceil((P.plaNavy+P.plaCV)/4));
  for(let i=0;i<rounds;i++){
    if(P.rocNavy>0&&hitP(.5,'seaBattle')){const m=rocFleetHit('海上交戰');if(m)out.push(m);}
    else if(ships.length&&hitP(pNeed(5),'seaBattle')){const f=pickBest(ships.filter(x=>x.hp>0),x=>x.hp);if(f){f.hp--;out.push(f.n+' −1');if(isCSG(f)&&f.hp<=0)usCarrierSunk('海上交戰（'+f.n+'）');}}
  }
  for(let i=0;i<Math.min(2,Math.max(0,P.rocNavy-S.units.filter(u=>u.fl).length));i++)if(P.plaNavy>0&&hitP(pNeed(5+(P.plaCV>0&&P.plaNavy>=6?1:0)),'seaBattle')){P.plaNavy--;out.push('攻方護航艦 −1');}
  for(const sb of subs){
    if(sb.hp<=0)continue;
    if(hitP(.5,'seaBattle')){
      if(P.plaCV>0&&hitP(1/6,'seaBattle')){const m=cvHitAbstract('torp',sb.n);if(m)out.push(m);}
      else if(P.plaNavy>0){P.plaNavy--;out.push(sb.n+'擊沉護航艦（攻方護航艦 −1）');}
    }
    if(P.plaNavy>=4&&hitP(pNeed(5),'seaBattle')){sb.hp--;out.push(sb.n+'遭反潛 −1');}
  }
  // 海鯤潛艦是棋子（由玩家操作或依指揮官意圖行動），不再在此自動擲骰
  // 共軍海空兵力搜尋並攻擊出港的守方艦艇：改由攻方階段的 huntFleets 計算
  // 共軍潛艦已改成地圖棋子（js/psub.js），不再在此抽象擲骰
  if(out.length)log('第 '+S.turn+' 回合海上交戰：'+out.join('、'));
}
function baseNeed(b){
  const B=BASES[b];let n=B.need;
  if(B.c==='JP'&&S.fx.units.some(f=>f.id==='jasdf'&&fxActive(f)))n++;
  return Math.min(6,n);
}
function baseTargets(b){if(S.fxScen==='none'||S.fxScen==='intel')return [];return S.fx.units.filter(f=>f.base===b&&f.hp>0&&!f.hidden&&(b!=='sea'||fxActive(f))&&!(f.id==='jmsdf'&&S.jmsOn));} // 海自艦隊出港後不在佐世保
function escalationText(b){
  const tr=BASE_TRIG[b],up=Object.keys(tr).filter(c=>S.fx.lv[c]<tr[c]);
  return up.length?'打擊'+BASES[b].n+'會讓'+up.map(c=>CN[c]+'升級為「'+LV[c][tr[c]]+'」').join('、')+'。':'';
}
function strikeBase(b){
  if(!fireTake(null,false,true))return;S.stats.fire++;const B=BASES[b],tr=BASE_TRIG[b];
  S.baseStruck=S.baseStruck||{US:0,JP:0};if(B.c)S.baseStruck[B.c]++;
  if(b==='guam'&&usIdx()>=0)usRally();
  Object.keys(tr).forEach(c=>{if(setLevel(c,tr[c],B.n+'遭攻方打擊'))S.stats.esc.push(B.n+'→'+CN[c]+LV[c][tr[c]]);});
  const ck=B.c==='JP'?'JP':b==='guam'?'US':null;if(ck){S.cost.civ[ck]+=40;S.cost.dmg[ck]+=.4;}
  const tg=baseTargets(b);
  if(!tg.length){log('火力打擊 '+B.n+'：沒有可打擊的目標');return;}
  const lr=S.pools.plaLR>0;if(lr)S.pools.plaLR--; // DF-26 / DF-21D
  const need=Math.max(3,baseNeed(b)-(lr?1:0)),ok=hitP(pNeed(need),'strikeBase');
  fxq({t:'tfa',a:Object.keys(CNB).find(id=>CNB[id].kind==='rf'&&S.cn[id]>0)||'yongan',b,hit:ok});
  if(ok){const f=pickBest(tg,x=>x.hp);f.hp--;if(isCSG(f)&&f.hp<=0)usCarrierSunk('共軍'+B.n+'火力打擊');log('火力打擊 '+B.n+(lr?'（東風-26／21D）':'')+' 命中 '+f.n+'（'+lastTxt()+'）'+(f.hp<=0?'，已失去戰力':''));}
  else log('火力打擊 '+B.n+' 未命中（'+lastTxt()+'）');
  landSync(); // 抽象單位的步數變了：同步陸上棋子（打沒了就立刻移除）
}
function aiBaseStrikes(){
  if(!S.fx.units.some(fxActive))return;
  let budget=Math.floor(((S.fpk&&S.fpk.g)||0)/2); // 打美日基地只用空軍與巡弋飛彈等其他火力，不動用短程飛彈與火箭的大部分
  while(budget>0&&S.fire>0){
    let best=null,bs=0;
    for(const b of Object.keys(BASES)){
      if(escalationText(b))continue;
      const s=baseTargets(b).filter(fxActive).reduce((a,f)=>a+f.hp*(f.salvo||1),0)*(7-baseNeed(b));
      if(s>bs){bs=s;best=b;}
    }
    if(!best)break;strikeBase(best);budget--;
  }
}
