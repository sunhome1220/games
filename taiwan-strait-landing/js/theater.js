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
// baseline (2026) force pools, abstract points built from public reporting; see DATA.md
const POOL0={plaAir:8,plaSub:3,plaCV:2,plaAD:6,plaNavy:8,rf:32,plaCM:5,plaLR:6,plaHS:3,rocAir:4,rocNavy:4,rocSub:0,rocAD:4,rocMsl:10,rocDrone:1,rocMine:1,rocAS:10,rocRkt:8,plaLift:8};
const AMPH_ERA={'2026':0,'2027':0,'2028':1,'2029':1,'2030':2,'2031':2,'2032':3};
const ERA={
  '2026':{n:'2026 現況',d:'依 2025～2026 公開報導：台灣剛收到首批 F-16V、HIMARS 陸續到貨、雲峰尚未大量生產、火山布雷車尚未交付；共軍有約 250 具東風-26 發射器、東風-17 與 PCH-191 長程火箭，福建艦剛服役。',short:'2026 現況',pools:{},ssm:[],dfire:2},
  '2027':{n:'2027（推估）',d:'火山布雷車 14 套預計到位（交付多次延後，最新報導為 2027 年）；福建艦達完整戰力；F-16V 持續交付、雲峰開始量產。',short:'2027',pools:{plaLift:9,plaAir:8,plaSub:3,plaCV:2,plaAD:6,plaNavy:8,rf:33,plaCM:5,plaLR:7,plaHS:3,rocAir:4,rocNavy:4,rocSub:0,rocAD:4,rocMsl:11,rocDrone:1,rocAS:12,rocMine:3},ssm:[],dfire:2},
  '2028':{n:'2028（推估）',d:'假設預定交付到位：F-16V 66 架、HIMARS 與魚叉岸防增加、第一艘海鯤潛艦服役；共軍增加東風-26 旅與長程火箭。',short:'2028',pools:{plaLift:10,plaAir:8,plaSub:4,plaCV:3,plaAD:6,plaNavy:9,rf:35,plaCM:6,plaLR:8,plaHS:4,rocAir:5,rocNavy:5,rocSub:1,rocAD:5,rocMsl:12,rocDrone:1,rocAS:14,rocMine:3},ssm:[],dfire:3},
  '2029':{n:'2029（推估）',d:'特別預算（立法院縮減版）逐步採購：更多長程精準火力與防空，無人機與巡飛彈開始補上；共軍持續擴編。',short:'2029',pools:{plaLift:11,plaAir:8,plaSub:4,plaCV:3,plaAD:7,plaNavy:9,rf:37,plaCM:6,plaLR:9,plaHS:4,rocAir:5,rocNavy:5,rocSub:1,rocAD:5,rocMsl:13,rocDrone:2,rocAS:16,rocMine:4},ssm:[],dfire:3},
  '2030':{n:'2030（推估）',d:'假設特別預算與自製武器落實：多層防空、更多長程精準火力；共軍第四艘航艦在建、火箭軍擴編。',short:'2030',pools:{plaLift:12,plaAir:8,plaSub:5,plaCV:4,plaAD:7,plaNavy:10,rf:40,plaCM:6,plaLR:10,plaHS:5,rocAir:6,rocNavy:6,rocSub:1,rocAD:6,rocMsl:15,rocDrone:2,rocAS:18,rocMine:5},ssm:['taitung'],dfire:4},
  '2031':{n:'2031（推估）',d:'NASAMS 合約預計 2031 年交付，防空明顯增強；海鯤潛艦增為 2 艘（計畫共 8 艘，進度不確定）。',short:'2031',pools:{plaLift:13,plaAir:8,plaSub:5,plaCV:4,plaAD:7,plaNavy:10,rf:43,plaCM:7,plaLR:11,plaHS:6,rocAir:6,rocNavy:6,rocSub:2,rocAD:7,rocMsl:16,rocDrone:3,rocAS:20,rocMine:5},ssm:['taitung'],dfire:4},
  '2032':{n:'2032（推估）',d:'特別預算期程（2026～2033）接近尾聲，雙方都明顯成長；數值為推估，不確定性最高。',short:'2032',pools:{plaLift:14,plaAir:8,plaSub:6,plaCV:4,plaAD:8,plaNavy:11,rf:45,plaCM:7,plaLR:12,plaHS:7,rocAir:6,rocNavy:6,rocSub:2,rocAD:7,rocMsl:17,rocDrone:3,rocAS:22,rocMine:6},ssm:['taitung','yunlin'],dfire:4}
};
function previewEra(){const e=ERA[S.era]||ERA['2026'],H=HMR_ERA[S.era]||HMR_ERA['2026'];S.p0=Object.assign({},POOL0,e.pools,{plaDrone:PLA_DRONE[S.era]||200,rocAtc:H[2],rocGml:H[3]},AFS_POOL(S.era));
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
  MLRS_SPOTS.forEach(k=>{k=SPOT[k];if(!k||!TER[k])return;const h=placeNear(k,x=>x.isl===TER[k].isl&&x.t!=='sea'&&x.t!=='air'&&x.t!=='port'&&!unitAt(x.k))||placeNear(SPOT.tainan,x=>x.isl==='TW'&&x.t!=='sea'&&x.t!=='air'&&x.t!=='port'&&!unitAt(x.k));if(h)S.units.push(mkUnit('def','mlrs',h.k,{}));}); // 駐地格已有步兵時，放在最近的空格
  e.ssm.forEach(k=>{k=SPOT[k]||k;if(TER[k]&&!unitAt(k))S.units.push(mkUnit('def','ssm',k,{}));});
  log('兵力年代：'+e.n+'。');log(applyLift()+'。');
  // 共軍渡海能力隨年代成長：075 兩棲攻擊艦（2021～2024 服役 3 艘，之後續建）、076 型（2025 年下水海試）、滾裝客貨輪與「水橋」登陸駁船（2024～2025 年陸續曝光）；首波兩棲旅依運力估計約每 2 年 +1 個（推估，不確定性高）
  const ex=AMPH_ERA[S.era]||0;for(let i=0;i<ex;i++){const h=placeNear(FK(i%2?'3,5':'3,2'),q=>q.isl==='CN'&&q.coastal);if(h)S.units.push(mkUnit('atk','amph',h.k,{zone:i%2?'central':'north'}));}
  if(ex)log('共軍渡海運力成長：首波增加 '+ex+' 個兩棲旅，補給運輸船 '+fmt1(S.pools.plaLift)+' 個。');
  placeShips();
  layMines();
}
// 水面艦艇上地圖：共軍護航艦在港口外海，守方艦艇群停泊在港口；兩者都很脆弱，擊沉會連動減少海軍點數
function placeShips(){
  const P=S.pools;
  // 護航艦：一個棋子約代表一個點（艦隊規模成長時，海峽上的護航艦也跟著變多，上限 8 個）
  const nd=Math.min(8,Math.max(0,P.plaNavy)),ports=['4,4','3,3','3,7','2,9'].map(k=>TER[FK(k)]);
  const seaC=[];ports.forEach(h=>nbrs(h.c,h.r).filter(x=>x.t==='sea'&&x.c>h.c-1).forEach(x=>{if(!seaC.includes(x))seaC.push(x);}));
  ports.forEach(h=>nbrs(h.c,h.r).forEach(n=>nbrs(n.c,n.r).filter(x=>x.t==='sea'&&x.c>h.c&&!seaC.includes(x)).forEach(x=>seaC.push(x)))); // 第二圈外海格，讓 8 個棋子有位置
  for(let i=0;i<nd&&i<seaC.length;i++){const h=seaC[i];if(unitsAt(h.k).length<STACK_MAX)S.units.push(mkUnit('atk','dd',h.k,{}));}
  // 共軍航艦群在台灣東側海域活動
  [[122.9,24.2],[122.9,23.3],[122.9,22.4]].slice(0,Math.min(3,P.plaCV)).forEach(([lo,la],ci)=>{const [c,r]=llToRC(lo,la),h=TER[K(c,r)];if(h&&h.t==='sea'&&canStack({side:'atk'},h.k)){const cvU=mkUnit('atk','cv',h.k,{});cvU.cvi=ci;cvU.wmag=CVW.PLA[ci].mag;S.units.push(cvU);spawnEscorts(cvU,ESC_PLA,'atk');}});
  rocFleetsSpawn(); // 台灣海軍：6 個艦隊在母港（組成依年份）
  // 海鯤潛艦：高雄、花蓮港出港（隱蔽、魚雷有限，回港才能補彈）
  const pref=[SPOT.hualien,SPOT.kaohsiung],hkp=Object.values(TER).filter(h=>h.isl==='TW'&&h.t==='port'&&S.owner[h.k]==='def').map(h=>h.k).sort((x,y)=>((pref.indexOf(x)+1)||9)-((pref.indexOf(y)+1)||9));
  for(let i=0,j=0;i<Math.min(4,P.rocSub)&&j<hkp.length;j++){const k=hkp[j];if(unitsAt(k).length<STACK_MAX+1){S.units.push(mkUnit("def","hk",k,{tp:hkTp(),hm:HK_HM}));i++;}}
}
function syncShips(){
  if(!S.pools)return;
  for(const [type,side,key] of [['dd','atk','plaNavy'],['cv','atk','plaCV'],['hk','def','rocSub']]){
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
const POOLN={plaDrone:'舊戰機改裝無人機（誘餌，每個攻方階段放出 40 架消耗守方攔截彈）',rocRkt:'雷霆2000火箭彈庫存（每發 1 點）',plaLst:'兩棲艦群（運旅、可搶灘；往返制，沉了就永久損失）',plaLift:'補給運輸船（商船、滾裝船）：往返運補，被擊沉就永久損失',rocAS:'雄二／雄三反艦飛彈（每點約 100 枚）',plaSub:'潛艦（含核動力攻擊潛艦）',rocMine:'布雷（火山布雷車、水雷）',plaAir:'陸基空軍（東部戰區）',plaCV:'航艦（含艦載機）',plaCM:'巡弋飛彈（長劍、鷹擊）',plaAD:'防空',plaNavy:'海軍護航艦隊',rf:'短程彈道飛彈與長程火箭',plaLR:'東風-26／21D',plaHS:'東風-17 高超音速',rocAir:'空軍（F-16V 等）',rocNavy:'海軍',rocSub:'潛艦（海鯤）',rocAD:'防空（天弓等）',rocMsl:'長程對地飛彈（雄二E 等；1 點≈25 枚）',rocAtc:'陸軍戰術飛彈（ATACMS，海馬士用；每點 1 枚）',rocAAsh:'空射反艦飛彈（AGM-84L 魚叉；每點 1 枚）',rocWC:'萬劍彈（經國號空射對地，射程約 200 km；每點 1 枚）',rocSlam:'SLAM-ER 空射對地飛彈（射程約 270 km；每點 1 枚）',rocGml:'GMLRS 精準火箭彈（海馬士用；每點 1 個莢艙＝6 發）',rocDrone:'無人機與巡飛彈'};
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
  const P=S.pools,pcs=S.units.filter(u=>u.type==='cv'&&u.side==='atk'&&alive(u));
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
const afLevel=k=>S.owner[k]==='atk'?3:((S.afDmg&&S.afDmg[k])||0);
const AFCAP=[1,.5,.2,0];
function afShare(){ // 守方戰機實際能起降的比例：依各基地戰機數加權（炸沒有戰鬥機的民用機場或訓練基地，不影響出擊）
  if(S.air&&S.air.bw){const c=afBaseCounts();let t=0,a=0;for(const k in c){t+=c[k];a+=c[k]*AFCAP[afLevel(k)];}return t>0?a/t:0;}
  const L=airfields();return L.length?L.reduce((a,h)=>a+AFCAP[afLevel(h.k)],0)/L.length:1;}
const CAVE=200; // ★佳山、石子山山洞機堡可容納的戰機（公開說法不一，約 80～200 架以上）
const caveF=()=>S.mods&&S.mods.cave&&S.turn<=S.mods.cave.until&&S.air?Math.min(1,CAVE/Math.max(1,S.air.TW)):0; // 躲進山洞機堡的戰機比例
const gndMul=()=>(1-caveF())*(S.mods&&S.mods.disp?.5:1); // 機場被打時地面戰機損失的倍率：機堡內的不會被炸、★分散到疏散機場與公路跑道減半
const rocAirEff=()=>S.pools.rocAir*afShare()*(1-caveF());
// ---------- 固定雷達站（固定目標：看得到、打得到）----------
// 樂山：鋪路爪長程預警雷達（新竹樂山，海拔約 2,600 公尺，2013 年啟用）；報導：對彈道飛彈約 6 分鐘預警，2024 年仍未與天弓整合
//  被摧毀：愛國者攔截率 ×0.8（★推估：失去預警與目標指示；天弓本來就沒整合，不受影響）
// 東引：空軍長程預警雷達，把防空預警往北延伸約 100 公里；被摧毀：守方空中有效戰力 ×0.9（★推估：失去北面早期預警）
// 打擊：固定目標不需定位；彈道飛彈先過守方攔截，命中依武器數量（每枚 40%；★雷達陣面是軟目標）；命中即失效，不會修復
const FAC={leshan:{n:'樂山雷達',ll:[121.12,24.55],d:'鋪路爪長程預警雷達，對彈道飛彈約 6 分鐘預警。被摧毀後愛國者攔截率 ×0.8（推估；天弓尚未整合，不受影響）。'},
  dongyin:{n:'東引雷達',ll:[120.49,26.37],d:'空軍長程預警雷達，把防空預警往北延伸約 100 公里。被摧毀後守方空中有效戰力 ×0.9（推估）。'}};
const facUp=id=>!(S.facDown&&S.facDown[id]);
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
    const fs=Math.max(.55,SC);o+='<g class="fac" data-fac="'+id+'" style="cursor:pointer" transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') scale('+fs.toFixed(2)+') translate('+(-x).toFixed(1)+' '+(-y).toFixed(1)+')"><circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="9" fill="var(--panel,#fff)" stroke="'+col+'" stroke-width="2"'+(strikeOn&&up?' class="ring strike"':'')+'/>'+
      '<path d="M'+(x-5).toFixed(1)+' '+(y+4).toFixed(1)+'A7 7 0 0 1 '+(x+4).toFixed(1)+' '+(y-5).toFixed(1)+'M'+(x-2).toFixed(1)+' '+(y+1).toFixed(1)+'L'+(x+3).toFixed(1)+' '+(y-3).toFixed(1)+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linecap="round"/>'+
      (up?'':'<path d="M'+(x-7)+' '+(y-7)+'L'+(x+7)+' '+(y+7)+'" stroke="#c0392b" stroke-width="2.5"/>')+
      '<text x="'+x.toFixed(1)+'" y="'+(y+16).toFixed(1)+'" text-anchor="middle" font-size="6.5" font-weight="600" fill="'+col+'" stroke="var(--panel,#fff)" stroke-width="2" paint-order="stroke" pointer-events="none">'+FAC[id].n+'</text></g>';} // 字小一點、不擋棋子；失效只看紅色斜線
  return o;
}
function strikeAirfield(k){ // 火力打擊機場：命中則損傷 +1 級；到嚴重程度時地面上的戰機也會損失
  const h=TER[k];if(!h||S.fire<=0)return false;const lv=afLevel(k);if(lv>=3)return false;
  const pk=fireTake(h,false);if(!pk)return false;S.stats.fire++;S.afDmg=S.afDmg||{};
  const PM=pkgMod(pk,h,null),need=S.sead?4:5,ok=hitP(pNeed(need)*PM.m,'strikeAirfield:'+pk.k); // 跑道容易被打出彈坑；防空被壓制時更容易
  fxq({t:'air',at:[h.c,h.r],hit:ok,tsea:false,org:orgPick('pla'),k:pk.k!=='g'?'bm':'cm'});
  if(ok){S.afDmg[k]=lv+1;const nl=lv+1;let more='';if(nl>=2&&S.pools.rocAir>0&&gndMul()>0&&hitP(.5,'strikeAirfield')){more='，地面戰機 −'+airLoseAt(k,4*gndMul(),'ground')+' 架（推估：強化機堡外）';}
    log('火力打擊機場 '+(h.name||'機場')+'：'+['','受損（起降 50%）','嚴重受損（起降 20%）','跑道癱瘓（無法起降）'][nl]+more+'（'+(PM.txt?PM.txt+'；':'')+lastTxt()+'）');}
  else log('火力打擊機場 '+(h.name||'機場')+' 未命中（'+(PM.txt?PM.txt+'；':'')+lastTxt()+'）');
  checkInstant();return true;
}
function repairAirfields(){ // 守方每 2 回合修復一級（未被占領的機場）
  if(!S.afDmg||S.turn%2)return;
  for(const k of Object.keys(S.afDmg)){if(S.owner[k]==='atk')continue;S.afDmg[k]--;log('守方搶修機場：'+(TER[k].name||'機場')+(S.afDmg[k]>0?'，仍受損':'，恢復運作'));if(S.afDmg[k]<=0)delete S.afDmg[k];}
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
// ---------- 空軍改用實際架數（航艦第 2 階段）----------
// 點數＝有效架次 ÷ K：有效架次＝架數 × 妥善率 × 每日出擊率 × 每回合時數／24 × 品質係數。K＝34 使 2026 年台灣空軍約等於原本的 4 點。
// ★＝推估：妥善率 70%、共軍東部戰區可用 300 架、品質係數（有固定翼預警機 ×1.2、有專用電戰機再 ×1.1）、福建與第 4 艘航艦的組成與出擊率
const AIR={K:34,mc:.7,hrs:12,
  TW:{'2026':321,'2027':321,'2028':387,'2029':387,'2030':387,'2031':387,'2032':387}, // F-16V 約 140＋經國號約 129＋幻象 約 52；2028 年起加 F-16 Block 70 66 架
  TWrate:1.0,TWq:1.2,            // 分散作戰每架每日約 1 架次；E-2K 預警機
  PLA:300,PLArate:1.0,PLAq:1.32, // ★東部戰區可用；空警-500 預警機、殲-16D 電戰機
  CV:[{n:'遼寧',f:24,rate:1.0,q:1.0},{n:'山東',f:24,rate:1.0,q:1.0},{n:'福建',f:30,rate:1.25,q:1.2},{n:'第 4 艘航艦',f:30,rate:1.25,q:1.2}], // 遼寧、山東滑跳、無固定翼預警機；★福建彈射、空警-600
  US:{f:44,rate:1.25,q:1.32},    // 每艘：打擊戰機 44 架；E-2D、EA-18G
  loss:.02,                      // ★空戰損失基準：每回合 2% × 己方出擊架次 × 敵我有效戰力比（蘭徹斯特平方律）
  ctl:1.5,                       // ★制空判定：有效戰力比 ≥ 1.5 為優勢
  strike:{atk:.6,mid:.4,def:.2}, // ★共軍出擊架次用於對地打擊的比例（依制空狀況）
  perFire:10};                   // ★每 10 架次對地打擊＝1 點火力
const sortiesOf=(n,rate)=>n*AIR.mc*rate*AIR.hrs/24;
const ptsOf=(n,rate,q)=>sortiesOf(n,rate)*q/AIR.K;
// ---------- 飛彈與攔截彈改成實際枚數 ----------
// 攻方（美國國防部 2024《中國軍力報告》等公開推估）：短程彈道飛彈約 900 枚、發射車約 300 輛；PCH-191 長程火箭 48 輛、每車 10 枚 370 mm
// 1 點火力＝一個打擊包：★彈道飛彈 4 枚、★長程火箭 8 枚（彈頭較小）；命中率沿用原公式＝整包打下去目標失去戰力的機率
// ★每輛發射車每回合（12 小時）發射一次：短程彈道飛彈每回合最多 300 枚＝75 包；長程火箭每回合 480 枚＝60 包；★火箭庫存＝48×10×3 輪＝1,440 枚；射程約 350 km，只打得到台灣西半部
// 守方攔截彈（公開推估）：愛國者三型 CRI 約 384＋MSE 102、愛國者二型 GEM 約 200、天弓三型 ★約 400（外界推估）
// 每枚來襲射 2 枚攔截彈；★單枚攔截率：愛國者三型 0.7、天弓三型與愛國者二型 0.5；★每回合最多接戰 21 個連 × 8 枚＝168 枚；只保護機場、港口、城市
// 彈道飛彈打野外分散、掩蔽的地面部隊：命中率 ★×0.3；打海上移動的船：★×0.1
const MSL={srbmPer:4,rktPer:8,srbmLaunch:300,rktLaunch:480,rkt:1440,rktR:kmH(340),srbm2026:900,adPerPt:250,adCap:168,
  ad2026:{p3:486,p2:200,tk:400},pk:{p3:.7,p2:.5,tk:.5},field:.3,sea:.1,rfScale:900/32};
function mslInit(){
  const P=S.pools,k=Math.max(.25,(P.rocAD||0)/4);
  S.adI={p3:Math.round(MSL.ad2026.p3*k),p2:Math.round(MSL.ad2026.p2*k),tk:Math.round(MSL.ad2026.tk*k)};
  S.msl={srbm:Math.round((P.rf||0)*MSL.rfScale),rkt:MSL.rkt};adSync(true);mslSync(true);
  S.msl.srbm0=S.msl.srbm;S.adI0=adTot();
}
const adTot=()=>S.adI?S.adI.p3+S.adI.p2+S.adI.tk:0;
// 其他規則仍以「防空點數」（rocAD）運作：每 250 枚攔截彈＝1 點。其他程式改了點數時，按比例換算回攔截彈
function adSync(init){
  const P=S.pools;if(!S.adI||!P)return;
  if(!init&&S._ad!=null&&P.rocAD!==S._ad){const tot=adTot();
    if(tot>0){const f=Math.max(0,P.rocAD*MSL.adPerPt/Math.max(1,S._ad*MSL.adPerPt));for(const k of ['p3','p2','tk'])S.adI[k]=Math.max(0,Math.round(S.adI[k]*f));}
    else if(P.rocAD>S._ad)S.adI.tk+=(P.rocAD-S._ad)*MSL.adPerPt;}
  P.rocAD=Math.round(adTot()/MSL.adPerPt);S._ad=P.rocAD;
}
// 火箭軍點數（rf）也維持舊尺度：1 點≈28 枚短程彈道飛彈
function mslSync(init){
  const P=S.pools;if(!S.msl||!P)return;
  if(!init&&S._rf!=null&&P.rf!==S._rf)S.msl.srbm=Math.max(0,Math.round(S.msl.srbm+(P.rf-S._rf)*MSL.rfScale));
  P.rf=Math.round(S.msl.srbm/MSL.rfScale*10)/10;S._rf=P.rf;
}
const covered=h=>h&&(h.isl==='TW'||h.isl==='PH')&&(h.t==='air'||h.t==='port'||h.t==='city')&&S.owner[h.k]!=='atk'; // 攔截彈保護的固定重要目標（澎湖也有天弓三型與刺針，共用守方攔截彈）
let CNCOAST=null;
const rktOK=h=>{if(!CNCOAST)CNCOAST=Object.values(TER).filter(x=>x.isl==='CN'&&x.coastal);return CNCOAST.some(c=>rd(c,h)<=MSL.rktR);};
// 取一點火力：回傳 {k:'g'|'s'|'r',n}（g＝空軍、巡弋飛彈等其他來源；s＝短程彈道飛彈；r＝長程火箭）
function fireTake(h,soft,noRkt){
  const F=S.fpk||(S.fpk={g:S.fire,s:0,r:0});const canR=!noRkt&&F.r>0&&rktOK(h);
  const ord=soft?['g',canR?'r':null,'s']:[canR?'r':null,'s','g'];let k=ord.find(x=>x&&F[x]>0);if(!k)k=['g','s','r'].find(x=>F[x]>0&&(x!=='r'||canR));if(!k)return null;
  F[k]--;S.fire=Math.max(0,S.fire-1);
  if(k==='s'){S.msl.srbm=Math.max(0,S.msl.srbm-MSL.srbmPer);mslSync(true);return {k,n:MSL.srbmPer};}
  if(k==='r'){S.msl.rkt=Math.max(0,S.msl.rkt-MSL.rktPer);return {k,n:MSL.rktPer};}
  if((F.hs||0)>0){F.hs--;return {k,n:0,hs:true};} // 東風-17：不受守方攔截，特效畫成高超音速滑翔體
  return {k,n:0};
}
// 攔截：n 枚來襲，每枚 2 枚攔截彈，先用愛國者三型；回傳突破的枚數（小數）與發射的攔截彈
function adIntercept(n){
  adSync();if(!S.adI)return {surv:n,I:0};let e=Math.min(n,Math.max(0,S.adLeft||0),Math.floor(adTot()/2)),kill=0,I=0;
  for(let i=0;i<e;i++){const k=S.adI.p3>=2?'p3':S.adI.tk>=2?'tk':S.adI.p2>=2?'p2':null;if(!k)break;S.adI[k]-=2;I+=2;kill+=1-Math.pow(1-MSL.pk[k]*((k==='p3'||k==='p2')&&!facUp('leshan')?.8:1),2);} // 樂山雷達被摧毀：愛國者少了預警與目標指示
  S.adLeft=Math.max(0,(S.adLeft||0)-I/2);P_adFix();return {surv:Math.max(0,n-kill),I};
}
function P_adFix(){if(!S.pools||!S.adI)return;S.pools.rocAD=Math.round(adTot()/MSL.adPerPt);S._ad=S.pools.rocAD;}
// 一個打擊包的命中率修正：攔截（固定目標）、野外分散部隊、海上移動目標
function pkgMod(pk,h,t){
  if(!pk||pk.k==='g')return {m:1,txt:''};
  let m=1,txt='';const nm=pk.k==='s'?'短程彈道飛彈':'長程火箭';
  if(covered(h)){const r=adIntercept(pk.n);m*=r.surv/pk.n;txt=nm+' '+pk.n+' 枚，守方發射 '+r.I+' 枚攔截彈，約 '+(Math.round(r.surv*10)/10)+' 枚突破';}
  else txt=nm+' '+pk.n+' 枚';
  if(t&&atSea(t)){m*=MSL.sea;txt+='；海上移動目標難以命中（×'+MSL.sea+'）';}
  else if(t&&!covered(h)&&!(t.type==='ssm'||t.type==='hmr'||t.type==='mlrs')&&!isShip(t)&&!isGnd(t)){ // 地面旅改由殺傷鏈（gFound）處理分散與隱蔽，不再重複打折
m*=MSL.field;txt+='；野外分散部隊（×'+MSL.field+'）';}
  return {m,txt};
}
function airInit(){
  S.air={TW:AIR.TW[S.era]||AIR.TW['2026'],PLA:AIR.PLA,cvF:AIR.CV.map(c=>c.f),usF:CSGS.map(()=>AIR.US.f)};
  S.air.TW0=S.air.TW;S.air.PLA0=S.air.PLA;afInitBases();airPts();
}
function airPts(){const P=S.pools;if(!S.air||!P)return;P.rocAir=Math.round(ptsOf(S.air.TW,AIR.TWrate,AIR.TWq)*100)/100;P.plaAir=Math.round(ptsOf(S.air.PLA,AIR.PLArate,AIR.PLAq)*100)/100;S.air._tw=P.rocAir;S.air._pla=P.plaAir;}
// 其他程式若直接改了點數（舊的加減），換算回架數，避免整點加減造成數十架的誤差
function airSync(){
  if(!S.air||!S.pools)return;const P=S.pools;
  if(P.rocAir!==S.air._tw){S.air.TW=Math.max(0,Math.round(S.air.TW+(P.rocAir-S.air._tw)*AIR.K/(AIR.mc*AIR.TWrate*AIR.hrs/24*AIR.TWq)));}
  if(P.plaAir!==S.air._pla){S.air.PLA=Math.max(0,Math.round(S.air.PLA+(P.plaAir-S.air._pla)*AIR.K/(AIR.mc*AIR.PLArate*AIR.hrs/24*AIR.PLAq)));}
  airPts();
}
// 戰機損失來源台帳（只記錄、不影響數字）：air 空戰、ground 地面（機場遭飛彈或空襲、被占領）、ad 出擊時被防空擊落；side：atk 共軍、def 台灣、us 美航艦
function airLedger(side,src,n){if(!(n>0))return;const L=S.stats.airL=S.stats.airL||{atk:{},def:{},us:{}};L[side][src]=(L[side][src]||0)+n;}
function airLossTxt(side,tot,suf){const L=(S.stats.airL||{})[side]||{},nm={air:'空戰',ground:'地面',ad:'被防空擊落'},ps=[];let sum=0;for(const k of ['air','ground','ad']){const v=Math.round(L[k]||0);if(v>0){ps.push(nm[k]+' '+v);sum+=v;}}const rem=tot-sum;if(rem>0&&ps.length)ps.push('艦隊沉沒等 '+rem);else if(rem>0&&side!=='def')ps.push('艦隊沉沒等 '+rem);return '−'+tot+' 架'+(suf||'')+(ps.length?'（'+ps.join('、')+'）':'');}
function airLose(side,n,src){if(!S.air||n<=0)return 0;airSync();const k=side==='def'?'TW':'PLA',d=Math.min(S.air[k],Math.round(n));S.air[k]-=d;airLedger(side==='def'?'def':'atk',src||'air',d);airPts();return d;}
// 還在的共軍航艦（AIR.CV 的索引）：有棋子的看棋子是否還在；沒有棋子的（例如第 4 艘）依剩餘艘數補足
// 航艦失去戰鬥能力：剩 1 步（★）＝飛行甲板受損，艦載機無法起降，撤離戰場修理；仍可被追擊擊沉，但攻擊方不再優先打它
const cvOOA=u=>!!u&&(u.type==='cv'||u.type==='csg')&&alive(u)&&u.hp<=1;
const cvOOAi=i=>S.units.some(u=>u.type==='cv'&&u.cvi===i&&cvOOA(u));
function cvIdx(){
  if(!S.pools)return [];const n=Math.min(S.pools.plaCV,AIR.CV.length),gone=S.cvGone||[],out=S.units.filter(u=>u.type==='cv'&&u.side==='atk'&&u.cvi!=null).map(u=>u.cvi).slice(0,n);
  for(let i=0;i<AIR.CV.length&&out.length<n;i++)if(!out.includes(i)&&!gone.includes(i))out.push(i);return out.sort((a,b)=>a-b);}
const cvwA=i=>S.cvwA&&S.cvwA.atk&&S.cvwA.atk[i]; // 本回合的任務分配 [制空, 對艦, 對地]；沒有棋子的航艦沒有分配（全部算制空，對地照舊比例）
function cvAirPts(){if(!S.air)return S.pools.plaCV;let s=0;for(const i of cvIdx()){if(cvOOAi(i))continue;const c=AIR.CV[i],a=cvwA(i);s+=ptsOf(S.air.cvF[i],c.rate,c.q)*(a?a[0]:1);}return s;}
function cvFighters(){if(!S.air)return 0;let s=0;for(const i of cvIdx())s+=S.air.cvF[i];return s;}
const plaAirAll=()=>S.pools.plaAir+cvAirPts();
function usAirPts(f){const i=csgIdx(f.id),n=(S.air?S.air.usF[i]:AIR.US.f)*(f.hp<=1?0:f.hp)/3*supMult(csgPieceOf(f)),sp=S.cvwA&&S.cvwA.def&&S.cvwA.def[i],a=sp&&csgPieceOf(f)?sp[0]:1;return ptsOf(n,AIR.US.rate,AIR.US.q)*a;} // 只有分配到制空的架次算進空戰
// 給依賴舊尺度的運輸機空投用：換算成舊版的共軍空軍點數（8 點＝滿編）
const plaAirOld=()=>S.air?8*S.air.PLA/Math.max(1,S.air.PLA0):S.pools.plaAir;
// ---------- 艦載機任務（第 3b 階段）：每回合把艦載機架次分給制空、對艦、對地，打得到的距離＝作戰半徑（＋反艦飛彈射程）----------
// 作戰半徑（每格 20 km）：F/A-18E 約 390 海里≈720 km＝36 格；★殲-15（滑跳起飛）約 600 km＝30 格；★福建艦（彈射起飛）約 800 km＝40 格
// 反艦飛彈：LRASM 公開射程 370 km 以上，取下限＝18 格（保守）；★鷹擊-83K 約 220 km＝11 格；★每架打擊機掛 2 枚
// ★庫存：每艘美航艦 LRASM 40 枚、每艘共軍航艦鷹擊-83K 48 枚（用完就沒有）；★攻擊有艦隊防空的目標，每出擊架次損失 2%
// ★任務分配（推估的固定公式）：有敵艦在打擊距離內＝制空 40%、對艦 40%、對地 20%；沒有＝對艦的份改去制空；攻方可用指揮官意圖調整
// ★美軍對地空襲：每 2 架次（一個雙機分隊）攻擊一次，命中率沿用盟軍空襲；只打得到作戰半徑內的目標（沒有防區外對地武器的推估）
const CVW={US:{r:kmH(720),asmN:'LRASM',asmR:kmH(360),mag:40},
  PLA:[{r:kmH(600),asmR:kmH(220),mag:48},{r:kmH(600),asmR:kmH(220),mag:48},{r:kmH(800),asmR:kmH(220),mag:48},{r:kmH(800),asmR:kmH(220),mag:48}],plaN:'鷹擊-83K',
  per:2,loss:.02,landPer:2,
  split:{'':[.4,.4,.2],ship:[.3,.6,.1],air:[.7,.2,.1],land:[.4,.1,.5]}};
function cvwCarriers(side){
  if(!S.air||!S.pools)return [];
  if(side==='def')return uscPieces().map(u=>{const f=csgFx(u);if(!f||f.hp<=1)return null;const ui=csgIdx(f.id);return {u,i:-1,ui,w:CVW.US,nm:CVW.US.asmN,sor:sortiesOf(S.air.usF[ui]*f.hp/3,AIR.US.rate)*supMult(u),n:ui?'美第 '+(ui+1)+' 航艦':'美航艦'};}).filter(Boolean);
  return S.units.filter(u=>u.type==='cv'&&u.side==='atk'&&u.cvi!=null&&alive(u)&&u.hp>1).map(u=>({u,i:u.cvi,w:CVW.PLA[u.cvi],nm:CVW.plaN,sor:sortiesOf(S.air.cvF[u.cvi],AIR.CV[u.cvi].rate)*Math.max(0,u.hp)/3,n:AIR.CV[u.cvi].n}));
}
const cvwFoes=(side,c)=>S.units.filter(e=>e.side!==side&&atSea(e)&&isShip(e)&&e.type!=='hk'&&e.type!=='fob'&&!subHidden(e)&&rd(hexOf(c.u),hexOf(e))<=c.w.r+c.w.asmR);
// 對地目標（作戰半徑內）：
//  共軍艦載機：守方的陸地單位（部隊、飛彈車）與還沒癱瘓的機場；
//  美軍艦載機：攻方在陸地上的任何單位（台灣、澎湖、大陸沿岸港內船隻…）與被攻方占領、還能用的港口。
const cvwLandT=(side,c)=>{
  const here=hexOf(c.u),R=c.w.r,out=[];
  if(side==='atk'){
    for(const e of S.units)if(e.side==='def'&&!isShip(e)&&!atSea(e)&&!(e.ally)&&rd(here,hexOf(e))<=R)out.push({u:e});
    if(S.pools&&S.pools.rocAir>0)for(const h of airfields())if(S.owner[h.k]!=='atk'&&afLevel(h.k)<3&&rd(here,h)<=R)out.push({af:h.k});
  }else{
    for(const e of S.units)if(e.side==='atk'&&!atSea(e)&&!subHidden(e)&&rd(here,hexOf(e))<=R)out.push({u:e});
    for(const k of PORTS)if(S.owner[k]==='atk'&&!S.portDown[k]&&TER[k]&&rd(here,TER[k])<=R)out.push({port:k});
  }
  return out;
};
const cvwLand=c=>cvwLandT('def',c).filter(x=>x.u).map(x=>x.u);
const cvwLandVal=(side,x)=>{
  if(x.af)return 25+(afLevel(x.af)===0?5:0);if(x.port)return 28;
  const t=x.u,l=(t.type==='ssm'||t.type==='hmr'||t.type==='mlrs');
  return side==='atk'?(l?32:tgtVal(t)*10)+t.hp:tgtVal(t)*10+t.hp;
};
// 本回合艦載機對地份額（攻擊次數）：每回合只算一次，記在航艦上（手動先用，剩下的自動出擊）
function cvwLandBudget(side,c,sp){
  if(c.u.cvwLT!==S.turn){c.u.cvwLT=S.turn;c.u.cvwLB=takeInt(sp[2]*c.sor/CVW.landPer,'cvwLandN:'+side+c.i);}
  return c.u.cvwLB;
}
// 一次對地空襲：t＝{u}｜{af}｜{port}；回傳 {txt,hit,L}
function cvwLandHit(side,c,x){
  const from=[c.u.c,c.u.r],src=c.n+'艦載機';let ok=false,txt='';
  if(x.af){
    const k=x.af,h=TER[k],lv=afLevel(k),pk=S.sead?4:5;ok=hitP(pNeed(pk),'cvwAF:'+side);
    fxq({t:'air',at:[h.c,h.r],hit:ok,tsea:false,from,k:'bomb'});
    txt='空襲機場 '+(h.name||'機場');
    if(ok){S.afDmg=S.afDmg||{};S.afDmg[k]=lv+1;const nl=lv+1;let more='';
      if(nl>=2&&S.pools.rocAir>0&&gndMul()>0&&hitP(.5,'cvwAF:'+side)){more='，地面戰機 −'+airLoseAt(k,4*gndMul(),'ground')+' 架（推估）';}
      txt+='：'+['','受損（起降 50%）','嚴重受損（起降 20%）','跑道癱瘓（無法起降）'][nl]+more;}else txt+='：未命中';
  }else if(x.port){
    const k=x.port,h=TER[k];ok=hitP(pNeed(5),'cvwPort:'+side);
    fxq({t:'air',at:[h.c,h.r],hit:ok,tsea:false,from,k:'bomb'});
    if(ok)S.portDown[k]=S.turn;txt='空襲被占領的 '+(h.name||'港口')+(ok?'：命中，卸載停擺 2 回合':'：未命中');
  }else{
    const t=x.u,h=hexOf(t),mob=side==='atk'&&isLch(t),hid=false,L=mob?(lchFound(t,'cm'),t.locL):null;
    if(mob&&t.locN<=0){
      fxq({t:'air',at:[t.c,t.r],hit:false,tsea:false,from,k:'bomb'});txt='空襲 '+hname(h)+'：'+(t.revealed?'發射車已轉移':'沒能定位真正的發射車，打中誘餌與空車')+'（'+L.txt+'）';
    }else{
      const need=Math.min(6,(h.t==='city'||h.t==='mtn'?6:5)+(hid?1:0));ok=hitP(mob?lchKillP({k:'g'}):pNeed(need),'cvwLand:'+side+':'+t.type);
      fxq({t:'air',at:[t.c,t.r],hit:ok,tsea:false,from,k:'bomb'});
      txt='空襲 '+hname(h)+' 的 '+tname(t)+(ok?'：命中':'：未命中');
      if(ok){if(isLch(t)&&t.veh!=null){t.locN=Math.max(0,(t.locN||0)-1);txt+='，'+ssmHit(t,src+'空襲');}else damage(t,1,src+'空襲');}
    }
  }
  const ad=side==='atk'?S.pools.rocAD>0:S.pools.plaAD>0; // 對方還有防空：出擊的戰機有機會被擊落
  const L=ad?cvwLose(c,takeInt(CVW.loss*CVW.landPer,'cvwL:land:'+side+c.i)):0;
  return {txt:txt+(L?'（被防空擊落 '+L+' 架）':''),hit:ok,L};
}
// 玩家手動：指定對地目標
function cvwManualLandInfo(cv){const sd=cv.side,c=cvwCarriers(sd).find(x=>x.u===cv);if(!c)return null;return {c,n:cvwLandBudget(sd,c,cvwSp(sd,c)),tg:cvwLandT(sd,c)};}
function cvwManualLand(cv,x){
  const I=cvwManualLandInfo(cv);if(!I||I.n<=0)return false;
  const hit=I.tg.find(y=>(x.u&&y.u===x.u)||(y.af&&y.af===x.af)||(y.port&&y.port===x.port));if(!hit)return false;
  I.c.u.cvwLB=I.n-1;const R=cvwLandHit(cv.side,I.c,hit);if(R.L){S.stats.cvwLost=S.stats.cvwLost||{atk:0,def:0};S.stats.cvwLost[cv.side]+=R.L;}
  log(I.c.n+'艦載機（指定目標）：'+R.txt+'（本回合對地份額剩 '+I.c.u.cvwLB+' 次；參數為推估）');checkInstant();return true;
}
// 航艦的對艦打擊距離（格）：艦載機作戰半徑＋反艦飛彈射程；沒有飛彈時只算作戰半徑
const cvReachOf=u=>u.type==='csg'?CVW.US.r+((u.wmag||0)>0?CVW.US.asmR:0):(u.cvi!=null?CVW.PLA[u.cvi].r+((u.wmag||0)>0?CVW.PLA[u.cvi].asmR:0):0);
// 航艦位置評分（越小越好）：想進入自己的打擊距離；受創（≤1 步）時離開對方打擊距離；友軍艦隊保持 5～10 格內互相掩護
function cvAggr(u,h){
  let sc=0;const own=cvReachOf(u),me=u.side;
  for(const f of S.units.filter(e=>e.side!==me&&(e.type==='cv'||e.type==='csg')&&alive(e))){
    const d=rd(h,hexOf(f)),er=cvReachOf(f);
    sc+=Math.max(0,d-own)*.4;                       // 迎擊：靠近到自己打得到
    if(u.hp<=1)sc+=Math.max(0,er+2-d)*3;            // 剩 1 步：撤出對方的打擊距離
  }
  const fr=S.units.filter(e=>e.side===me&&e!==u&&(e.type==='cv'||e.type==='csg')&&alive(e));
  if(fr.length){const dn=Math.min(...fr.map(e=>hd(h,hexOf(e))));sc+=Math.max(0,dn-kmH(200))*.5+Math.max(0,kmH(100)-dn)*.5;}
  return sc;
}
function cvwSplit(side,c){
  const it=side==='atk'?(((S.lastIntent&&S.lastIntent.atk)||{}).cvw||''):'';let [a,s,l]=CVW.split[it]||CVW.split[''];
  if(!(c.u.wmag>0)||!cvwFoes(side,c).length){a+=s;s=0;}                                   // 沒有打得到的敵艦或飛彈用完：對艦的份改去制空
  if(!cvwLandT(side,c).length){a+=l;l=0;}                                                  // 作戰半徑內沒有可打的陸地目標：對地的份改去制空
  return [a,s,l];
}
function cvwPlan(){ // 每回合開始（空戰之前）分配一次
  S.cvwA={atk:{},def:{}};
  for(const c of cvwCarriers('atk'))S.cvwA.atk[c.i]=cvwSplit('atk',c);
  for(const d of cvwCarriers('def'))S.cvwA.def[d.ui]=cvwSplit('def',d);
}
function cvwLose(c,n){if(n<=0)return 0;if(c.i<0){const d=Math.min(S.air.usF[c.ui],n);S.air.usF[c.ui]-=d;airLedger('us','ad',d);return d;}const d=Math.min(S.air.cvF[c.i],n);S.air.cvF[c.i]-=d;airLedger('atk','ad',d);return d;}
// 艦載機出擊：對艦（以齊射模型對上目標艦隊防空）與對地（美軍；共軍的對地已換算成火力點數）
// 本回合艦載機對艦份額（飛彈枚數）：每回合只算一次，記在航艦上（手動打擊先扣，剩下的由自動出擊用掉）
function cvwBudget(side,c,sp){
  if(c.u.cvwT!==S.turn){c.u.cvwT=S.turn;c.u.cvwB=Math.min(c.u.wmag||0,takeInt(sp[1]*c.sor*CVW.per,'cvwN:'+side+c.i));}
  return Math.min(c.u.cvwB,c.u.wmag||0);
}
// 一波艦載機對艦打擊：k 枚打 t（齊射模型），回傳戰報文字與被擊落架數
function cvwHit(side,c,t,k){
  c.u.wmag-=k;const cov=adCover(t).length>0;
  const r=salvoCalc(t,k,false,'cvw:'+side+'>'+t.type),big=t.type==='cv'||t.type==='csg',steps=big?takeInt(r.hits/2,'salvoBig'):r.hits;
  fxq({t:'cva',from:[c.u.c,c.u.r],to:[t.c,t.r],hit:r.hits>0,side,n:Math.max(1,Math.min(3,Math.ceil(k/4))),R:c.w.asmR,ad:cov?(r.hits>0?'pass':'int'):undefined});
  const L=cov?cvwLose(c,takeInt(CVW.loss*k/CVW.per,'cvwL:'+side)):0;
  const txt=k+' 枚'+c.nm+'攻擊 '+uname(t)+'（距離 '+Math.round(rd(hexOf(c.u),hexOf(t))*10)/10+' 格）：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+(steps?'，'+tname(t)+' −'+(t.fl?steps+' 艘':stpU(t,steps)):'')+(L?'，打擊機被擊落 '+L+' 架':'');
  if(steps)damage(t,steps,c.n+'艦載機（'+c.nm+'）');
  checkInstant();return {txt,L};
}
// 玩家操作攻方：航艦的手動命令（艦隊齊射、指定艦載機目標）
const cvOwn=u=>u&&alive(u)&&(u.type==='cv'&&u.side==='atk'||u.type==='csg'&&allyHuman());
const cvwSp=(sd,c)=>(sd==='atk'?cvwA(c.i):S.cvwA&&S.cvwA.def&&S.cvwA.def[c.ui])||cvwSplit(sd,c);
function volleyShooters(cv,t){return S.units.filter(e=>e.grp===cv.id&&isEsc(e)&&alive(e)&&e.shots>0&&e.mag&&e.mag.asm>0&&(!t||rd(hexOf(e),hexOf(t))<=SHIPW[e.type].asmR));}
function volleyTargets(cv){const sh=volleyShooters(cv);return [...new Set(sh.flatMap(escTargets))];}
function cvwManualInfo(cv){const sd=cv.side,c=cvwCarriers(sd).find(x=>x.u===cv);if(!c)return null;return {c,n:cvwBudget(sd,c,cvwSp(sd,c)),foes:cvwFoes(sd,c)};}
function cvwManual(cv,t){
  const I=cvwManualInfo(cv);if(!I||I.n<=0||!I.foes.includes(t))return false;
  const cov=adCover(t).length>0,k=cov?I.n:Math.min(I.n,Math.max(2,2*t.hp));I.c.u.cvwB=I.n-k;
  const R=cvwHit(cv.side,I.c,t,k);if(R.L){S.stats.cvwLost=S.stats.cvwLost||{atk:0,def:0};S.stats.cvwLost[cv.side]+=R.L;}
  log(I.c.n+'艦載機（指定目標）：'+R.txt+'（本回合對艦份額剩 '+I.c.u.cvwB+' 枚；參數為推估）');return true;
}
function cvwPrepOnly(side){for(const c of cvwCarriers(side)){const sp=cvwA(c.i)||cvwSplit(side,c);cvwBudget(side,c,sp);cvwLandBudget(side,c,sp);}}
function cvwStrike(side){
  if(S.over)return;
  for(const c of cvwCarriers(side)){
    if(!alive(c.u))continue;
    let sp=side==='def'?S.cvwA&&S.cvwA.def&&S.cvwA.def[c.ui]:cvwA(c.i);if(!sp){sp=cvwSplit(side,c);if(side==='def'){S.cvwA=S.cvwA||{atk:{}};S.cvwA.def=S.cvwA.def||{};S.cvwA.def[c.ui]=sp;}}
    const pct='制空 '+Math.round(sp[0]*100)+'%、對艦 '+Math.round(sp[1]*100)+'%、對地 '+Math.round(sp[2]*100)+'%';
    const out=[];let lost=0;
    // 對艦（手動已用掉的份額不再出擊）
    let n=cvwBudget(side,c,sp);
    for(let g=0;g<6&&n>0&&!S.over;g++){
      const fo=cvwFoes(side,c);if(!fo.length)break;const t=pickBest(fo,escVal),cov=adCover(t).length>0,k=cov?n:Math.min(n,Math.max(2,2*t.hp));
      n-=k;c.u.cvwB=n;const R=cvwHit(side,c,t,k);lost+=R.L;out.push(R.txt);
    }
    c.u.cvwB=0;
    // 對地（兩邊：手動已用掉的份額不再出擊）
    {let nl=cvwLandBudget(side,c,sp),tried=0,hl=0;const lines=[];
      for(let j=0;j<12&&nl>0&&!S.over;j++){const tg=cvwLandT(side,c);if(!tg.length)break;
        const x=pickBest(tg,y=>cvwLandVal(side,y));nl--;c.u.cvwLB=nl;tried++;const R=cvwLandHit(side,c,x);lost+=R.L;if(R.hit)hl++;if(lines.length<3)lines.push(R.txt);}
      c.u.cvwLB=0;
      if(tried)out.push('對地空襲 '+tried+' 次，命中 '+hl+' 次（'+lines.join('；')+(tried>3?'…':'')+'）');
    }
    log(c.n+'艦載機出擊（每回合約 '+Math.round(c.sor)+' 架次；'+pct+'；'+c.nm+'剩 '+Math.max(0,c.u.wmag||0)+' 枚）'+(out.length?'：'+out.join('；'):'：打擊距離內沒有目標，全部執行制空與艦隊防護')+'（參數為推估）');
    if(lost){S.stats.cvwLost=S.stats.cvwLost||{atk:0,def:0};S.stats.cvwLost[side]+=lost;}
  }
}
// ---------- 航艦艦隊（第 3a 階段）：護航艦是真實棋子，有自己的飛彈庫存；交戰用休斯齊射模型 ----------
// 垂直發射管數有公開資料（055 型 112、052D 型 64、054A 型 32、柏克級 96、提康德羅加級 122）；★各彈種的配置比例沒有公開，為推估
// 射程以每格 20 km 換算：鷹擊-18 約 540 km＝27 格、鷹擊-83 約 230 km＝11 格、魚叉 約 130 km＝6 格；★防空涵蓋：海紅旗-9 約 200 km＝10 格、標準飛彈 ★8 格、海紅旗-16 ★2 格
const SHIPW={
  d55:{ad:80,adR:kmH(200),asm:16,asmN:'鷹擊-18',asmR:kmH(540),lam:16,salvo:4,chan:6},
  tak:{ad:0,adR:0,asm:0,asmN:'',asmR:0,lam:0,salvo:0,chan:0}, // 補給艦：不作戰，跟著航艦；被擊沉時該艦艦載機架次 ★×0.7（燃油與彈藥補給受影響）
  ddh:{ad:22,adR:0,asm:0,asmN:'',asmR:0,lam:0,salvo:0,chan:2},   // ★出雲級：只有 SeaRAM 自身防禦；反潛直升機 ★7 架，2027 年起 F-35B ★10 架
  jdg:{ad:80,adR:kmH(160),asm:8,asmN:'90 式反艦飛彈',asmR:kmH(200),lam:0,salvo:4,chan:4}, // ★摩耶級垂直發射管 96 管；標準飛彈涵蓋 8 格；90 式約 200 km（取保守值）
  jdd:{ad:32,adR:kmH(40),asm:8,asmN:'90 式反艦飛彈',asmR:kmH(200),lam:0,salvo:4,chan:2}, // ★改良型海麻雀
  d52:{ad:48,adR:kmH(200),asm:8,asmN:'鷹擊-18',asmR:kmH(540),lam:8,salvo:4,chan:4},
  f54:{ad:32,adR:kmH(40),asm:8,asmN:'鷹擊-83',asmR:kmH(220),lam:0,salvo:4,chan:2},
  cg:{ad:106,adR:kmH(160),asm:8,asmN:'魚叉',asmR:kmH(120),lam:16,salvo:4,chan:6},
  ddg:{ad:80,adR:kmH(160),asm:8,asmN:'魚叉',asmR:kmH(120),lam:8,salvo:4,chan:4}};
// ★chan＝每艘一波能同時接戰的來襲飛彈數（推估；柏克級有 3 具 SPG-62 照射雷達、提康德羅加級 4 具，可分時導引多枚）；航艦自身近迫防禦另可處理 2 枚（攔截率 50%）
// ★休斯齊射模型參數（推估）：反艦飛彈尋標命中率 0.8；艦隊防空每枚來襲發射 2 枚攔截彈，單枚攔截率 0.7（彈道飛彈 0.5）
const SALVO={pSeek:.8,pInt:.7,pIntBM:.5,perMsl:2};
const isEsc=u=>!!SHIPW[u.type];
const tname=t=>t.fl?t.fl.n:TYPES[t.type].n;
// ---------- 第 3c 階段：對地巡弋飛彈與反潛（★皆為推估）----------
// 對地：戰斧（美）／長劍系列（共軍 055、052D）射程都在 1,500 km 以上，整個戰場都在射程內；★每次打擊 4 枚，命中率沿用既有的縱深打擊公式
// 反潛：★每回合發現潛艦機率 054A 35%、055 30%、052D 25%（舊護航艦 25%）；新護航艦有艦載直升機，搜索範圍 ★6 格（約 120 km，舊護航艦 3 格）
// 海鯤魚雷打航艦：每有一艘新護航艦在 2 格內，命中率 −★5%（最低 10%）
// 共軍潛艦打美航艦：美方反潛屏障 A＝護航艦數＋MH-60R 架數÷4（★航艦反潛直升機中隊 11 架＋每艘護航艦 2 架）；★命中率 0.3÷(1＋0.25A)，★潛艦被擊沉機率 min(0.6, 0.05A)
const LAM={per:4,asw:{f54:.35,d55:.3,d52:.25,dd:.25},aswR:{f54:kmH(120),d55:kmH(120),d52:kmH(120),dd:kmH(60)},hkCv:.05,hkMin:.1,mh60cv:11,mh60esc:2};
function usAswScreen(g){const u=g||uscPiece();if(!u||!alive(u))return 0;const es=S.units.filter(e=>e.ally==='US'&&isEsc(e)&&e.type!=='tak'&&alive(e)&&e.grp===u.id).length;return es+(LAM.mh60cv+LAM.mh60esc*es)/4;}
const ESC_PLA=['d55','d52','f54']; // ★共軍航艦典型護航：055、052D、054A 各 1 艘（日本防衛省多次通報 3 艘左右護航）
// 美航艦打擊群（公開資料：航艦＋3～5 艘水面艦＋補給艦）：★2026～2027 年巡洋艦 1＋柏克級 3；之後柏克級 4（巡洋艦退役）；另有戰鬥支援艦 1
const usEscorts=()=>((+S.era||2026)<=2027?['cg','ddg','ddg','ddg']:['ddg','ddg','ddg','ddg']).concat(['tak']);
const SUPPLY_LOSS=.7;
function supMult(u){if(!u||!u.hadSup)return 1;return S.units.some(e=>e.grp===u.id&&e.type==='tak'&&alive(e))?1:SUPPLY_LOSS;} // 美航艦：神盾驅逐艦 2～4 艘，有時加巡洋艦；巡洋艦預計 2020 年代末退役
function spawnEscorts(cv,types,side,ally){
  const used=new Set();
  for(const t of types){
    const h=nbrs(cv.c,cv.r).concat(nbrs(cv.c,cv.r).flatMap(n=>nbrs(n.c,n.r))).find(x=>x&&x.t==='sea'&&!used.has(x.k)&&canStack({side},x.k));
    if(!h)continue;used.add(h.k);const W=SHIPW[t];
    const e=mkUnit(side,t,h.k,{});e.esc=true;e.grp=cv.id;e.mag={ad:W.ad,asm:W.asm,lam:W.lam};if(ally)e.ally=ally;S.units.push(e);
  }
}
// 航艦移動後，護航艦跟上：移到航艦相鄰的海域格（盡量就近）
function escFollow(cv){
  const es=S.units.filter(e=>e.grp===cv.id&&isEsc(e));if(!es.length)return;
  const ring=nbrs(cv.c,cv.r).filter(x=>x&&x.t==='sea');const taken=new Set();
  for(const e of es){
    const free=ring.filter(x=>!taken.has(x.k)&&(unitsAt(x.k).filter(y=>y!==e).length<STACK_MAX)).sort((a,b)=>hd(a,hexOf(e))-hd(b,hexOf(e)));
    const h=free[0];if(!h)continue;taken.add(h.k);e.c=h.c;e.r=h.r;e.moved=true;
  }
}
// 艦隊防空涵蓋：目標所屬一方、射程內還有防空飛彈的護航艦
function adCover(t){return S.units.filter(e=>e.side===t.side&&(isEsc(e)||e.fl||e.type==='dd')&&alive(e)&&e.mag&&e.mag.ad>0&&rd(hexOf(e),hexOf(t))<=adROf(e));}
const grpCovered=t=>adCover(t).length>0; // 在任何防空艦涵蓋內（含護航艦保護的船團）：來襲飛彈以齊射模型攔截
// 休斯齊射模型：n 枚來襲，防空發射 I＝min(庫存, 2n) 枚攔截彈，存活＝n − I × 攔截率，命中期望＝存活 × 尋標命中率（以小數累計取整數）
// 休斯齊射模型：每艘防空艦一波最多接戰 chan 枚（受庫存限制），每枚用 2 枚攔截彈；超過接戰上限的來襲飛彈不會被攔截
// 同一階段（同回合、同一方行動）內，多次射擊打同一支艦隊視為協同齊射：每艘防空艦已接戰的數量累加，超過上限的就攔不了
const chLeft=(x,cap)=>{const st=S.turn+S.phase;if(x.chT!==st){x.chT=st;x.chU=0;}return Math.max(0,cap-x.chU);};
function salvoCalc(t,n,bm,key){
  const pk=1-Math.pow(1-(bm?SALVO.pIntBM:SALVO.pInt),SALVO.perMsl);let left=n,I=0,kill=0;
  for(const e of adCover(t)){if(left<=0)break;const c=Math.min(left,chLeft(e,chanOf(e)),Math.floor(e.mag.ad/SALVO.perMsl));if(c<=0)continue;e.chU+=c;e.mag.ad-=c*SALVO.perMsl;I+=c*SALVO.perMsl;kill+=c*pk;left-=c;}
  if(left>0&&(t.type==='cv'||t.type==='csg')){const c=Math.min(left,chLeft(t,2));t.chU+=c;kill+=c*.5;left-=c;} // 航艦自身近迫防禦
  const surv=Math.max(0,n-kill),hits=Math.min(n,takeInt(surv*SALVO.pSeek,key||'salvo'));
  return {n,I,surv,hits};
}
function fireSalvo(m,t){
  const W=SHIPW[m.type];if(!m.mag||m.mag.asm<=0)return false;
  const n=Math.min(W.salvo,m.mag.asm);m.mag.asm-=n;m.shots=Math.max(0,(m.shots||1)-1);if(m.shots<=0)m.acted=true;m.revealed=true;
  const r=salvoCalc(t,n,false,'salvo:'+m.type+'>'+t.type);
  fxq({t:'hmr',from:[m.c,m.r],to:[t.c,t.r],hit:r.hits>0,atc:true});
  const big=t.type==='cv'||t.type==='csg',steps=big?takeInt(r.hits/2,'salvoBig'):r.hits; // ★航艦體積大：每 2 枚命中扣 1 步
  log(uname(m)+'以 '+n+' 枚'+W.asmN+'攻擊 '+uname(t)+'：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+(steps?'，'+tname(t)+' −'+(t.fl?steps+' 艘':stpU(t,steps)):'，未造成重創')+'（齊射模型，參數為推估）');
  if(steps)damage(t,steps,W.asmN+'齊射');
  checkInstant();return true;
}
function escTargets(u){
  if(!isEsc(u)||u.shots<=0||!u.mag||u.mag.asm<=0)return [];const W=SHIPW[u.type];
  return S.units.filter(e=>e.side!==u.side&&atSea(e)&&isShip(e)&&e.type!=='hk'&&!subHidden(e)&&rd(hexOf(u),hexOf(e))<=W.asmR);
}
const escVal=e=>e.type==='cv'||e.type==='csg'?(cvOOA(e)?.5:6):e.type==='tak'?5:isEsc(e)?4:e.type==='lst'||e.type==='ro'?3.5:e.type==='cvy'?3:e.type==='dd'||e.type==='ff'?2.5:1;
// 協同齊射：射程內能打到同一目標的護航艦一起發射，用數量飽和對方防空（現實中的艦隊戰術）
function fireVolley(shooters,t){
  let n=0;const names=[];
  for(const m of shooters){const k=Math.min(SHIPW[m.type].salvo,m.mag.asm);if(k<=0)continue;m.mag.asm-=k;n+=k;m.shots=0;m.acted=true;m.revealed=true;names.push(TYPES[m.type].s);fxq({t:'hmr',from:[m.c,m.r],to:[t.c,t.r],hit:false,atc:true});}
  if(!n)return false;
  const r=salvoCalc(t,n,false,'salvo:'+shooters[0].side+'>'+t.type),big=t.type==='cv'||t.type==='csg',steps=big?takeInt(r.hits/2,'salvoBig'):r.hits;
  log(SIDE[shooters[0].side]+'艦隊協同齊射（'+names.join('、')+'）共 '+n+' 枚反艦飛彈攻擊 '+uname(t)+'：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+(steps?'，'+tname(t)+' −'+(t.fl?steps+' 艘':stpU(t,steps)):'，未造成重創')+'（齊射模型，參數為推估）');
  if(steps)damage(t,steps,'艦隊齊射');
  checkInstant();return true;
}
function escAutoFire(side){ // 電腦自動開火：挑射程內最有價值的目標，能打到的護航艦一起齊射，直到沒有可射的艦艇
  for(let guard=0;guard<10&&!S.over;guard++){
    const ready=S.units.filter(e=>e.side===side&&isEsc(e)&&alive(e)&&escTargets(e).length);if(!ready.length)return;
    const all=[...new Set(ready.flatMap(escTargets))],t=pickBest(all,escVal);if(!t)return;
    const sh=ready.filter(m=>escTargets(m).includes(t));if(!fireVolley(sh,t))return;
  }
}
function computeFire(){
  const P=S.pools,t=S.turn,rs=cnShare('rf'),as=cnShare('air');
  mslSync();adSync();S.adLeft=MSL.adCap; // 每個攻方階段：守方各連重新可接戰
  const sP=Math.min(Math.floor(S.msl.srbm/MSL.srbmPer),Math.round(MSL.srbmLaunch/MSL.srbmPer*rs)),rP=Math.min(Math.floor(S.msl.rkt/MSL.rktPer),Math.round(MSL.rktLaunch/MSL.rktPer)); // 發射車數決定每回合上限；飛彈在實際打擊時才扣
  const hs=Math.min(P.plaHS,Math.round((t<=3?2:1)*rs));P.plaHS-=hs; // DF-17 hypersonic: not reduced by the defender's air defense
  const cm0=Math.min(P.plaCM,Math.round((t<=3?2:1)*as));P.plaCM-=cm0;const cm=Math.max(0,cm0-(P.rocAD>=5?1:0)); // cruise missiles are intercepted more easily than ballistic ones
  airSync();const fr=AIR.strike[S.airCtl||'mid']||.4,plaSor=sortiesOf(S.air?S.air.PLA:0,AIR.PLArate)*as*fr+cvIdx().reduce((a,i)=>{const s=sortiesOf(S.air?S.air.cvF[i]:0,AIR.CV[i].rate),w=cvwA(i);return a+s*(w?0:fr);},0); // 有棋子的航艦：對地份額改由艦載機實際空襲（cvwStrike），不再換算成火力點數
  const air=Math.max(0,Math.round(plaSor/AIR.perFire)); // ★陸基機出擊架次依制空狀況分配給對地打擊；航艦艦載機依任務分配的對地比例；每 10 架次＝1 點 // ★出擊架次依制空狀況分配給對地打擊，每 10 架次＝1 點
  const add=S.mods.fireAdd[t]||0,sd=S.sead?1:0; // 守方防空不再直接扣火力點數：改在每個打擊包實際攔截
  S.fireNote=(rs<1||as<1?'大陸基地受損：火箭軍旅可用 '+Math.round(rs*100)+'%、機場可用 '+Math.round(as*100)+'%。':'')+'短程彈道飛彈 '+sP+' 包（每包 4 枚，存量 '+S.msl.srbm+' 枚）＋長程火箭 '+rP+' 包（每包 8 枚，只打得到台灣西半部，存量 '+S.msl.rkt+' 枚）'+(hs?'＋東風-17 '+hs:'')+(cm?'＋巡弋飛彈 '+cm:'')+'＋空軍 '+air+(sd?'＋防空壓制 1':'')+'（守方攔截彈 '+adTot()+' 枚，每回合最多接戰 '+MSL.adCap+' 枚）'+(S.weather.fire?'－天候 '+(-S.weather.fire):'')+(add?(add>0?'＋':'－')+'事件 '+Math.abs(add):'');
  let lam=0;for(const e of S.units.filter(e=>e.side==='atk'&&isEsc(e)&&alive(e)&&e.mag&&e.mag.lam>=LAM.per)){e.mag.lam-=LAM.per;lam++;} // ★每艘 055／052D 每回合發射 4 枚對地巡弋飛彈＝1 點火力
  if(lam)S.fireNote+='＋艦射對地巡弋飛彈 '+lam;
  const pb=S.owner[MAGONG]==='atk'?1:0; // 澎湖前進基地
  if(pb)S.fireNote+='＋澎湖前進基地 1';
  const g=Math.max(0,hs+cm+air+sd+S.weather.fire+add+pb+lam);S.fpk={g,s:sP,r:rP,hs};
  return Math.max(1,g+sP+rP);
}
// 空戰參數：隱形機占比（共軍、盟軍；台灣沒有）、反隱形感測抵銷、電子戰強度
function airParams(){
  const g=S.airGen||'mixed',yr=Math.max(0,(+S.era||2026)-2026),base={legacy:[.05,.15],mixed:[.2,.4],stealthy:[.45,.65]}[g]||[.2,.4];
  return {m:S.airModel||'bvr',pla:Math.min(.8,base[0]+.03*yr),ally:Math.min(.85,base[1]+.03*yr),ewk:{low:.8,mid:1,high:1.25}[S.ewLv||'mid'],cDef:.4,cPla:.35};
}
const stealthPen=A=>A.m==='bvr'?A.pla*(1-A.cDef):0; // 共軍隱形機扣掉守方預警與反隱形感測後，對防空造成的實際突破
function airEff(){ // 有效空中戰力：隱形機占比越高越強，但會被對方的反隱形感測抵銷；盟軍隱形機只在盟軍參戰時才有（台灣的 rocAir 沒有隱形機）
  const P=S.pools,A=airParams(),ally=allyAir();
  const dy=facUp('dongyin')?1:.9; // 東引雷達被摧毀：失去北面早期預警
  if(A.m!=='bvr')return {A,pla:plaAirAll(),def:ally*dy};
  const re=rocAirEff(),au=Math.max(0,ally-re);
  return {A,pla:plaAirAll()*(1+.6*A.pla*(1-A.cDef)),def:(re+au*(1+.6*A.ally*(1-A.cPla)))*dy};
}
function airBattle(){
  airSync();const P=S.pools,ally=allyAir(),out=[],E=airEff(),A=E.A,ek=Math.max(.01,A.ewk);
  // 蘭徹斯特平方律：各方戰機損失＝基準 × 己方出擊架次 × 敵我有效戰力比（比值限制在 0.2～5）；整數部分立即損失，零頭累積
  const r=Math.max(.2,Math.min(5,E.def>0?E.pla/E.def:5)),plaS=sortiesOf(S.air.PLA,AIR.PLArate)+cvIdx().reduce((a,i)=>{const w=cvwA(i);return a+sortiesOf(S.air.cvF[i],AIR.CV[i].rate)*(w?w[0]:1);},0); // 艦載機只有分配到制空的架次參加空戰
  const twS=sortiesOf(S.air.TW,AIR.TWrate)*afShare()*(1-caveF()),air2=1; // 躲進山洞機堡的戰機不出擊
  const lp=takeInt(AIR.loss*plaS/r,'airL:PLA'),lt=takeInt(AIR.loss*twS*r*air2,'airL:TW');
  let lpC=0;if(lp){const cvS=plaS-sortiesOf(S.air.PLA,AIR.PLArate),fromCv=plaS>0?Math.round(lp*cvS/plaS):0;lpC=fromCv;
    {let left=fromCv;for(const i of cvIdx()){if(left<=0)break;const d=Math.min(left,S.air.cvF[i]);S.air.cvF[i]-=d;airLedger('atk','air',d);left-=d;}}airLose('atk',lp-fromCv);out.push('攻方戰機 −'+lp+' 架'+(fromCv?'（其中艦載機 '+fromCv+'）':''));}
  if(lt){airLose('def',lt);out.push('守方戰機 −'+lt+' 架');}
  for(const csg of S.fx.units.filter(f=>isCSG(f)&&fxActive(f)&&f.hp>1)){const i=csgIdx(csg.id),sp=S.cvwA&&S.cvwA.def&&S.cvwA.def[i],ua=sp?sp[0]:1,lu=takeInt(AIR.loss*sortiesOf(S.air.usF[i]*csg.hp/3,AIR.US.rate)*supMult(csgPieceOf(csg))*ua*r,'airL:US'+i);if(lu){S.air.usF[i]=Math.max(0,S.air.usF[i]-lu);airLedger('us','air',lu);out.push((i?'美第 '+(i+1)+' 航艦':'美航艦')+'艦載機 −'+lu+' 架');}}
  if(P.rocAD>0&&hitP(.5,'airBattle')){P.rocAD--;out.push('守方防空遭壓制 −1');}
  S.fx.units.forEach(f=>{
    if(!fxActive(f))return;
    if(f.kind==='air'&&!isCSG(f)&&hitP(1/6,'airBattle')){f.hp--;out.push(f.n+' −1');}
    if(f.kind==='sub'&&hitP(1/6,'airBattle')){f.hp--;out.push(f.n+' 遭反潛 −1');}
  });
  if(S.fx.units.some(f=>f.kind==='air'&&fxActive(f))&&P.plaAD>0&&hitP(1/3,'airBattle')){P.plaAD--;out.push('攻方防空 −1');}
  if(out.length)log('第 '+S.turn+' 回合空優爭奪：'+out.join('、'));
  const E2=airEff(),dff=E2.pla-E2.def;
  fxq({t:'dog',al:Math.min(3,lp),dl:Math.min(3,lt),na:Math.min(4,Math.max(2,Math.ceil(plaAirAll()))),nd:Math.min(4,Math.max(2,Math.ceil(allyAir()))),ctl:dff>=3?'atk':dff<=-3?'def':'mid',pst:A.m==='bvr'?A.pla:0,dst:A.m==='bvr'&&allyAir()>rocAirEff()?A.ally:0,ob:airfields().filter(h=>afLevel(h.k)<3).map(h=>[h.c,h.r]),ew:S.ewLv||'mid'});
  // 兩層：制空（陸基＋艦載機 vs 守方與盟國）與防空壓制（SEAD）
  const E3=airEff(),rr=E3.def>0?E3.pla/E3.def:9;S.airCtl=rr>=AIR.ctl?'atk':rr<=1/AIR.ctl?'def':'mid'; // ★有效戰力比 ≥ 1.5 為優勢
  S.sead=P.rocAD<=2+(stealthPen(A)>=.12?1:0)+(A.ewk>1?1:0);
  log('制空：'+AIRCTL[S.airCtl]+(A.m==='bvr'?'（隱形機占比：共軍 '+Math.round(A.pla*100)+'%'+(allyAir()>rocAirEff()?'、盟軍 '+Math.round(A.ally*100)+'%':'、台灣 0%')+'；電戰'+({low:'低',mid:'中',high:'高'}[S.ewLv||'mid'])+'）':'')+'；守方防空'+(S.sead?'遭壓制，攻方火力 +1':'尚能維持，攻方火力不加成'));
}
const AIRCTL={atk:'攻方優勢',mid:'雙方均勢',def:'守方與盟國優勢'};
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
    if(fleet.length&&(hitP(.67,'antiShipFleet')||P.plaNavy<=0)){const tg=pickBest(fleet,tgtVal),cov=S.units.some(x=>x.type==='dd'&&x!==tg&&rd(hexOf(x),hexOf(tg))<=kmH(40))?1:0,sat=satHit(tg),gc=grpCovered(tg),ok=gc?salvoCalc(tg,1,false,'antiShip:grp').hits>0:(sat>=3||hitP(pNeed(need+(tg.type==='cvy'?cvyMod(tg):escortMod()+cov)-sat),'antiShip'));fxq({t:'air',at:[tg.c,tg.r],hit:ok,tsea:true,org:base==='roc'&&rocOrigin(fk,tg)?undefined:orgPick(base),from:base==='roc'?rocOrigin(fk,tg)||undefined:undefined,k:fk||'cm',ad:P.plaAD>0&&fk!=='torp'?(ok?'pass':'int'):undefined,adSide:'atk'});if(ok){hc++;const st=gc?((tg.type==='cv'||tg.type==='csg')?takeInt(.5,'salvoBig'):1):sat>=2?2:1;if(st)damage(tg,st,gc?who:sat>=2?'飽和攻擊':who);}}
    else if(P.plaNavy>0){if(hitP(pNeed(need),'antiShip')){he++;P.plaNavy--;if(P.plaCV>0&&hitP(pNeed(5+(P.plaNavy>=5?1:0)),'antiShip')){const m=cvHitAbstract('asm',who);if(m){cvh++;log(m);}}}}
    else if(canLand){
      const land=S.units.filter(u=>u.side==='atk'&&onTW(u));if(!land.length)break;
      const t=pickBest(land,x=>tgtVal(x)*10+x.hp),h=hexOf(t),ok=hitP(pNeed(h.t==='city'||h.t==='mtn'?6:5),'antiShip');fxq({t:'air',at:[t.c,t.r],hit:ok,tsea:false,org:base==='roc'&&rocOrigin(fk,t)?undefined:orgPick(base),from:base==='roc'?rocOrigin(fk,t)||undefined:undefined,k:fk||'cm'});if(ok){hl++;damage(t,1,who);}
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
  // 共軍潛艦：在海峽與西太平洋攻擊美日艦艇與守方海軍；美日反潛兵力薄弱時幾乎不受壓力
  if(P.plaSub>0){
    const csg=act.find(f=>isCSG(f)),jm=act.find(f=>f.id==='jmsdf'),ssn=act.find(f=>f.id==='ssn');
    const A=usAswScreen(),asw=(jm?1:0)+(ssn?1:0)+(csg?(uscPiece()?A/3:1):0)+(P.rocNavy>=3?1:0)+(P.rocSub>0?1:0); // 美航艦在地圖上：反潛屏障依護航艦與 MH-60R 架數
    const tg=[...act.filter(f=>f.kind==='ship'||isCSG(f))];
    for(let i=0;i<Math.min(P.plaSub,3);i++){
      const t=tg.length&&(hitP(.7,'subTarget')||P.rocNavy<=0)?pickBest(tg,x=>(isCSG(x)?10:0)+x.hp):null;
      const need=(t&&isCSG(t)?6:5)-(asw===0?1:0);
      if(t&&isCSG(t)&&csgPieceOf(t)){const pu=csgPieceOf(t),Ag=usAswScreen(pu),pc=.3/(1+.25*Ag);if(hitP(pc,'subCsg')){out.push('共軍潛艦突破反潛屏障，魚雷擊傷 '+t.n+'（命中率 '+Math.round(pc*100)+'%，★推估）');damage(pu,1,'共軍潛艦魚雷');}}
      else if(t&&t.id==='jmsdf'&&jmsPieces().length){if(hitP(pNeed(need),'seaBattle')){const v=pickBest(jmsPieces(),x=>x.hp);out.push('共軍潛艦魚雷命中 '+uname(v));damage(v,1,'共軍潛艦魚雷');jmsSync();}}
      else if(t){if(hitP(pNeed(need),'seaBattle')){t.hp--;out.push('共軍潛艦擊傷 '+t.n+'（−1）');}}
      else if(P.rocNavy>0&&hitP(pNeed(5-(asw===0?1:0)),'seaBattle')){const m=rocFleetHit('共軍潛艦魚雷');if(m)out.push('共軍潛艦擊沉守方艦艇：'+m);}
    }
    if(asw===0)out.push('反潛兵力薄弱，共軍潛艦在太平洋幾乎不受壓力');
    else if(P.plaSub>0&&hitP(csg&&uscPiece()?Math.max(Math.ceil(asw/2)/6,Math.min(.6,.05*A)):Math.ceil(asw/2)/6,'seaBattle')){P.plaSub--;out.push('共軍潛艦遭反潛擊沉（攻方潛艦 −1）');}
  }
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
