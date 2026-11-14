'use strict';
/* ---------- state ---------- */
let S;
if(/[?&]debug=1/.test(location.search))window.__S=()=>S; // 除錯用：?debug=1 時可由主控台讀取狀態
const LITE=/[?&]lite=1/.test(location.search)||(!/[?&]lite=0/.test(location.search)&&(matchMedia('(pointer:coarse)').matches||innerWidth<=960)); // 手機／觸控：精簡地圖圖層
function mkUnit(side,type,k,extra){
  const [c,r]=k.split(',').map(Number);
  const u=Object.assign({id:S.nid++,side,type,c,r,hp:TYPES[type].hp,moved:false,acted:false,dropped:false,shots:0},extra||{});
  if(type==='dd'&&!u.mag)u.mag={ad:DDW.ad,asm:0,lam:0}; // 共軍護航艦：有防空
  if((type==='ssm'||type==='hmr'||type==='mlrs')&&u.veh==null){u.veh0=lchVeh0(type);u.veh=u.veh0;u.fk=[];}
  return u;
}
function newState(){
  GEN++;for(const k in ACC)delete ACC[k];
  S={turn:1,phase:'atk',T:8,ctrl:{atk:'human',def:'ai'},weather:WEATHER.good,fire:0,units:[],owner:{},log:[],
     sel:null,mode:null,busy:false,over:false,started:false,nid:1,hover:null,zoneFlip:0,
     sim:false,speed:1,events:[],lastSnap:null,mods:defaultMods(),
     pools:null,mines:{},baseStruck:{US:0,JP:0},afl:{},bh:{},bhNote:false,portDown:{},portAsked:{},truce:{atk:{n:0,t:-9},def:{n:0,t:-9}},fx:null,simAuto:false,thSel:null,news:[],hits:[],newsOn:true,fxScen:'interest',fxLock:false,plan:null,video:false,rec:false,gid:Math.random(),cost:newCost(),stats:{fire:0,badWx:0,over:0,firstLand:null,esc:[],reserves:0,tpHold:0,cn:{strikes:0,hits:0},retal:{strikes:0,hits:0}},turnStart:null,fireNote:''};
  for(const h of Object.values(TER))if(isLand(h))S.owner[h.k]=h.isl==='CN'?'atk':'def';
  // 每個單位約一個旅（4,000～5,000 人）。共軍第一波約 40,000～55,000 人（兩棲艦隊首波運力估計 2～4 萬），後續波次由增援補上
  const A=[['arm','3,3'],['arm','3,7'],['arm','2,9'],
    ['amph','3,1','north'],['amph','3,2','north'],['amph','4,4','north'],['amph','3,4','north'],['amph','3,5','central'],['amph','3,6','central'],['amph','2,8','central'],['amph','3,7','central'],
    ['mar','3,0','north'],['mar','2,10','penghu'],['mar','2,9','central'],['abn','2,4',null,0],['abn','2,6',null,1]];
  A.forEach(([t,k,z,g])=>S.units.push(mkUnit('atk',t,FK(k),{zone:z||null,goal:g})));
  // 守方：陸軍作戰旅約 20 餘個（含裝甲、機械化、步兵、陸戰隊 2 個旅）加上快速動員的後備旅；岸置飛彈另計
  const D=[['inf',SPOT.taipei,1],['inf',SPOT.taipei],['res',SPOT.taipei],
    ['inf',SPOT.keelung,1],['inf',SPOT.taoyuan],['tank',SPOT.hukou],['tank',SPOT.hukou],
    ['inf',SPOT.hsinchu],['inf',SPOT.tcport,1],['tank',SPOT.taichung],['res',SPOT.taichung],
    ['tank',SPOT.chiayi],['inf',SPOT.tainan],['inf',SPOT.kaohsiung,1],['mar',SPOT.kaohsiung],['mar',SPOT.pingtung],
    ['inf',SPOT.yilan],['inf',SPOT.hualien],['inf',SPOT.taitung],['inf',SPOT.magong,1],['tank',SPOT.magong], // 澎湖防衛指揮部：M60A3 戰車、CM21 裝甲車（★以 1 個裝甲旅表示）
    ['ssm',SPOT.miaoli],['ssm',SPOT.changhua],['ssm',SPOT.penghu],['ssm',SPOT.chiashan],['ssm',SPOT.tamsui],['ssm',SPOT.hsinchu],['ssm',SPOT.tainan],
    ];
  D.forEach(([t,k,g])=>S.units.push(mkUnit('def',t,k,{garrison:!!g})));
  initTheater();
}
const hexOf=u=>TER[K(u.c,u.r)];
const isMsl=u=>u.type==='ssm'||u.type==='ff'||u.type==='hmr'||u.type==='mlrs';
const isShip=u=>u.type==='dd'||u.type==='ff'||u.type==='hk'||u.type==='ssn'||u.type==='cv'||u.type==='csg'||!!SHIPW[u.type]||u.type==='cvy'||u.type==='fob'||u.type==='lst'||u.type==='ro'; // 補給船團與灘頭補給站不是作戰部隊，不計入兵力
const isSup=u=>u.type==='cvy'||u.type==='fob';
const unitAt=k=>S.units.find(u=>K(u.c,u.r)===k);
// 堆疊：每格最多 2 個友軍單位，不能與敵軍同格
const STACK_MAX=2;
const unitsAt=k=>S.units.filter(u=>K(u.c,u.r)===k);
const canStack=(u,k)=>{const a=unitsAt(k).filter(x=>!x.boundTo);return a.length<STACK_MAX&&a.every(x=>x.side===u.side&&x!==u)&&(!a.length||!isLand(TER[k])||!inZOC(u.side,TER[k]));};
const stackPos=u=>{const a=unitsAt(K(u.c,u.r));if(a.length<2)return [0,0];const i=a.indexOf(u);return i<0?[0,0]:[i?8:-8,i?4:-4];};
const atSea=u=>hexOf(u).t==='sea';
const onTW=u=>hexOf(u).isl==='TW'&&u.type!=='ff'&&u.type!=='hk'; // 港內艦艇不算島上地面部隊
const alive=u=>S.units.includes(u);

let LOGN=0;
function log(msg){S.log.unshift({t:S.turn,p:S.phase,msg,n:++LOGN});if(S.log.length>300)S.log.pop();}
function toast(msg,ms){if(S&&S.rec)return;const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),ms||1500);}
function hname(h){return h.name||(TERN[h.t]+' '+h.c+'-'+h.r);}
function uname(u){return (u.fl?u.fl.n:TYPES[u.type].n)+'（'+SIDE[u.side]+'）';}
// ---------- 台灣海軍：依真實艦隊編制，一個棋子＝一個艦隊（★艦隊歸屬與武器數字為推估）----------
// 每艘：防空飛彈 ad、防空涵蓋 adR（格）、反艦飛彈 asm、反艦射程 asmR（格）、同時接戰數 ch
const RFW={kl:{n:'基隆級',ad:60,adR:6,asm:8,asmR:6,ch:2},ck:{n:'成功級',ad:36,adR:2,asm:8,asmR:8,ch:2},pf:{n:'派里級',ad:36,adR:2,asm:4,asmR:6,ch:2},
  kd:{n:'康定級',ad:24,adR:1,asm:8,asmR:8,ch:2},cy:{n:'濟陽級',ad:10,adR:2,asm:4,asmR:6,ch:2},lf:{n:'新輕型巡防艦',ad:32,adR:2,asm:8,asmR:10,ch:2},
  tc:{n:'沱江級',ad:12,adR:1,asm:16,asmR:8,ch:1},kh:{n:'光六快艇',ad:0,adR:0,asm:4,asmR:8,ch:0}};
// 依年份：濟陽級逐步除役、新輕型巡防艦 2028 年起陸續加入（2028～2040 年共 10～12 艘）
const ROCF=[
  {id:'168',n:'168 艦隊（蘇澳）',s:'168',home:'suao',m:y=>[['kl',4],['cy',y<=2027?4:y<=2029?2:0],['lf',y<=2027?0:y<=2029?2:y<=2031?4:6]]},
  {id:'124',n:'124 艦隊（左營）',s:'124',home:'kaohsiung',m:y=>[['kd',6]]},
  {id:'131',n:'131 艦隊（基隆）',s:'131',home:'keelung',m:y=>[['ck',5]]},
  {id:'146',n:'146 艦隊（馬公）',s:'146',home:'magong',m:y=>[['ck',3],['pf',2]]},
  {id:'hjN',n:'海蛟大隊（北）',s:'海蛟北',home:'suao',m:y=>[['tc',6],['kh',15]]},
  {id:'hjS',n:'海蛟大隊（南）',s:'海蛟南',home:'kaohsiung',m:y=>[['tc',6],['kh',15]]}];
const FLEET_PER=2; // ★每艘每次齊射 2 枚
function fleetAgg(u){const A={hp:0,ad:0,asm:0,adR:0,asmR:0,chan:0,sh:0};for(const [k,n] of u.fl.m){if(n<=0)continue;const W=RFW[k];A.hp+=n;A.ad+=W.ad*n;A.asm+=W.asm*n;A.chan+=W.ch*n;if(W.ad>0)A.adR=Math.max(A.adR,W.adR);if(W.asm>0){A.asmR=Math.max(A.asmR,W.asmR);A.sh+=n;}}return A;}
const fleetTxt=u=>u.fl.m.filter(([,n])=>n>0).map(([k,n])=>RFW[k].n+' '+n).join('、');
// 共軍抽象護航艦「dd」：每個代表一組 052D＋054A（★），防空沿用兩艦的數字：攔截彈 48＋32＝80 枚、涵蓋 10 格（052D 海紅旗-9）、每波接戰 4＋2＝6 枚；剩 1 步時減半
const DDW={ad:80,adR:10,chan:6};
const adROf=e=>e.fl?fleetAgg(e).adR:e.type==='dd'?DDW.adR:SHIPW[e.type].adR,chanOf=e=>e.fl?fleetAgg(e).chan:e.type==='dd'?Math.ceil(DDW.chan*e.hp/TYPES.dd.hp):SHIPW[e.type].chan;
function fleetLose(u,n){ // 損失 n 艘：從船數最多的艦型扣起；飛彈庫存不超過剩下的船能裝的量
  for(let i=0;i<n;i++){let b=null;for(const x of u.fl.m)if(x[1]>0&&(!b||x[1]>b[1]))b=x;if(!b)break;b[1]--;}
  const A=fleetAgg(u);u.mag.ad=Math.min(u.mag.ad,A.ad);u.mag.asm=Math.min(u.mag.asm,A.asm);
}
function rocFleetsSpawn(){
  const y=+S.era||2026;let n=0,ships=0;
  for(const F of ROCF){const k0=SPOT[F.home],h=k0&&TER[k0]&&unitsAt(k0).length<STACK_MAX?TER[k0]:placeNear(k0,x=>x.t==='sea'&&hd(x,TER[k0])<=2&&unitsAt(x.k).length<STACK_MAX)||placeNear(k0,x=>x.isl==='TW'&&x.t==='port'&&unitsAt(x.k).length<STACK_MAX);if(!h)continue; // 母港已滿：停在港外相鄰海域
    const u=mkUnit('def','ff',h.k,{});u.fl={id:F.id,n:F.n,s:F.s,m:F.m(y).filter(([,c])=>c>0).map(x=>x.slice())};const A=fleetAgg(u);u.hp=A.hp;u.mhp=A.hp;u.mag={ad:A.ad,asm:A.asm,lam:0};S.units.push(u);n++;ships+=A.hp;}
  S.pools.rocNavy=n;S.p0.rocNavy=n;S.rocShips0=ships;
}
// 開戰前海軍部署：east＝疏散到花蓮、台東外海；disperse＝母港附近 2 格內外海；戰略突襲時只有海蛟大隊來得及出港
// 澎湖守備方針：堅守／開戰前增援（玉山艦）／棄守
function penghuPolicy(c){
  const free=(k,f)=>placeNear(k,x=>f(x)&&isLand(x)&&x.t!=='mtn'&&!unitAt(x.k));
  if(c==='reinforce'){
    if(S.mods.buildup==='surprise')return ['戰略突襲：預警不足，玉山艦來不及把部隊送到澎湖'];
    const m=S.units.find(u=>u.side==='def'&&u.type==='mar'&&onTW(u));if(!m)return ['本島沒有可調動的陸戰旅'];
    const h=free(MAGONG,x=>x.isl==='PH');if(!h)return ['澎湖沒有空的駐地'];
    const from=hname(hexOf(m));m.c=h.c;m.r=h.r;m.garrison=false;
    return ['玉山艦開戰前把陸戰旅自'+from+'送到澎湖（'+hname(h)+'）；本島少一個旅'];
  }
  if(c==='abandon'){
    const ps=S.units.filter(u=>u.side==='def'&&hexOf(u).isl==='PH'&&!isShip(u));let n=0;
    for(const u of ps){const h=free(SPOT.chiayi||SPOT.tainan,x=>x.isl==='TW');if(!h)continue;u.c=h.c;u.r=h.r;u.garrison=false;n++;}
    S.mods.resBonus=(S.mods.resBonus||0)-1;
    return ['澎湖守軍 '+n+' 個單位撤回本島（嘉義、台南一帶）','放棄國土的政治代價：守方社會韌性判定 −1（推估）'];
  }
  return ['澎湖維持現有守軍'];
}
function navyDeploy(c){
  if(c!=='east'&&c!=='disperse')return ['台灣海軍艦隊留在母港'];
  const late=S.mods.buildup==='surprise',fs=S.units.filter(u=>u.fl&&alive(u)&&(!late||/^hj/.test(u.fl.id))),used=new Set(),moved=[];
  const free=x=>x&&x.t==='sea'&&!used.has(x.k)&&unitsAt(x.k).length<STACK_MAX;
  const eastSea=Object.values(TER).filter(x=>{if(x.t!=='sea')return false;const [lon,lat]=rcToLL(x.c,x.r);return lon>121.6&&lon<122.3&&lat>22.4&&lat<24.6;}).sort((a,b)=>a.r-b.r);
  for(const u of fs){let h=null;
    if(c==='east'){h=eastSea.find(free);}
    else{const home=hexOf(u);h=Object.values(TER).filter(x=>free(x)&&hd(x,home)<=2).sort((a,b)=>hd(a,home)-hd(b,home))[0];}
    if(!h)continue;used.add(h.k);u.c=h.c;u.r=h.r;moved.push(u.fl.s);}
  return [(c==='east'?'疏散到東部外海：':'分散到母港附近外海：')+(moved.join('、')||'無'),late?'戰略突襲：大型艦艇來不及出港，仍在母港':''].filter(Boolean);
}
function rocFleetHit(why){ // 抽象的海空打擊命中守方海軍：船數最多的艦隊損失 1 艘
  const fs=S.units.filter(u=>u.fl&&alive(u));if(!fs.length)return '';const f=pickBest(fs,x=>x.hp);damage(f,1,why);return f.fl.n+' −1 艘';
}
function fleetSalvo(m,t){
  const A=fleetAgg(m);const n=Math.min(m.mag.asm,A.sh*FLEET_PER);if(n<=0)return false;
  m.mag.asm-=n;m.shots=0;m.acted=true;m.revealed=true;
  const r=salvoCalc(t,n,false,'fleet>'+t.type),big=t.type==='cv'||t.type==='csg',steps=big?takeInt(r.hits/2,'salvoBig'):r.hits;
  fxq({t:'msl',from:[m.c,m.r],to:[t.c,t.r],hit:r.hits>0});
  log(m.fl.n+'齊射 '+n+' 枚反艦飛彈攻擊 '+uname(t)+'：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+(steps?'，'+tname(t)+' −'+(t.fl?steps+' 艘':stpU(t,steps)):'，未造成重創')+'（齊射模型，參數為推估）');
  if(steps)damage(t,steps,m.fl.n+'反艦飛彈');
  checkInstant();return true;
}
