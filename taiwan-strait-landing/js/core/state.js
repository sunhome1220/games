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
     pools:null,mines:{},baseStruck:{US:0,JP:0},afl:{},bh:{},bhNote:false,portDown:{},portAsked:{},truce:{atk:{n:0,t:-9},def:{n:0,t:-9}},fx:null,simAuto:false,thSel:null,
         news:[],hits:[],newsOn:true,fxScen:'interest',fxLock:false,plan:null,video:false,rec:false,gid:Math.random(),cost:newCost(),stats:{fire:0,badWx:0,over:0,firstLand:null,
         esc:[],reserves:0,tpHold:0,cn:{strikes:0,hits:0},retal:{strikes:0,hits:0}},turnStart:null,fireNote:''};
  for(const h of Object.values(TER))if(isLand(h))S.owner[h.k]=h.isl==='CN'?'atk':'def';
  // 每個單位約一個旅（4,000～5,000 人）。共軍第一波約 40,000～55,000 人（兩棲艦隊首波運力估計 2～4 萬），後續波次由增援補上
  const A=[['arm','3,3'],['arm','3,7'],['arm','2,9'],
    ['amph','3,1','north'],['amph','3,2','north'],['amph','4,4','north'],['amph','3,4','north'],['amph','3,5','central'],['amph','3,6','central'],['amph','2,8','central'],['amph','3,7','central'],
    ['mar','3,0','north'],['mar','2,10','penghu'],['mar','2,9','central'],['abn','2,4',null,0],['abn','2,6',null,1]];
  A.forEach(([t,k,z,g])=>S.units.push(mkUnit('atk',t,FK(k),{zone:z||null,goal:g})));
  {const [c,r]=llToRC(119.5,25.5),h=placeNear(K(c,r),x=>x.isl==='CN'&&isLand(x));if(h)S.units.push(mkUnit('atk','aas',h.k,{goal:0}));} // ★空中突擊旅：東部戰區陸航旅的直升機一次約可機降一個加強營，以 1 個棋子代表，前進部署在福建沿岸（平潭對岸）
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
const isShip=u=>u.type==='dd'||u.type==='ff'||u.type==='hk'||u.type==='psub'||u.type==='ssn'||u.type==='cv'||u.type==='csg'||!!SHIPW[u.type]||u.type==='cvy'||u.type==='fob'||u.type==='lst'||u.type==='ro'; // 補給船團與灘頭補給站不是作戰部隊，不計入兵力
const isSup=u=>u.type==='cvy'||u.type==='fob';
const kCR=k=>{const h=TER[k];if(h)return h;const [c,r]=String(k).split(',').map(Number);return {c,r};}; // 格代碼→座標（比對數字比每個單位都組字串快）
const unitAt=k=>{const h=kCR(k);return S.units.find(u=>u.c===h.c&&u.r===h.r);};
// 堆疊：每格最多 2 個友軍單位，不能與敵軍同格
const STACK_MAX=2;
const unitsAt=k=>{const h=kCR(k);return S.units.filter(u=>u.c===h.c&&u.r===h.r);};
const canStack=(u,k)=>{const a=unitsAt(k).filter(x=>!x.boundTo);return a.length<STACK_MAX&&a.every(x=>x.side===u.side&&x!==u)&&(!a.length||!isLand(TER[k])||!inZOC(u.side,TER[k]));};
const stackPos=u=>{const a=unitsAt(K(u.c,u.r));if(a.length<2)return [0,0];const i=a.indexOf(u),s=R/16;return i<0?[0,0]:[i?8*s:-8*s,i?4*s:-4*s];}; // 同格兩個單位錯開（隨格子大小縮放）
const atSea=u=>hexOf(u).t==='sea';
const onTW=u=>hexOf(u).isl==='TW'&&u.type!=='ff'&&u.type!=='hk'; // 港內艦艇不算島上地面部隊
const alive=u=>S.units.includes(u);

let LOGN=0;
function log(msg){S.log.unshift({t:S.turn,p:S.phase,msg,n:++LOGN});if(S.log.length>300)S.log.pop();}
function toast(msg,ms){if(S&&S.rec)return;const t=$('#toast');t.textContent=msg;t.classList.remove('open','cut');t.classList.add('show');
  t.classList.toggle('cut',t.scrollHeight>t.clientHeight+2||t.scrollWidth>t.clientWidth+2); // 超過兩行被截斷：提示可以點開看全文
  clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show','open'),ms||1500);}
// 點快訊：第一次展開全文並停留（不自動消失），再點一次關閉。快訊顯示時會擋住點擊，不會誤觸後面的「重新開始」等按鈕
$('#toast').addEventListener('click',e=>{e.stopPropagation();e.preventDefault();const t=e.currentTarget;if(!t.classList.contains('show'))return;clearTimeout(toast.h);
  if(t.classList.contains('open')||!t.classList.contains('cut')){t.classList.remove('show','open');return;}
  t.classList.add('open');});
function hname(h){return h.name||(TERN[h.t]+' '+h.c+'-'+h.r);}
function uname(u){return (u.lha?LHA.n:u.lhaMar?LHA.marN:u.fl?u.fl.n:u.type==='psub'?psubCls(u).n:u.wp==='hp'?'魚叉岸防系統':u.hl?'劍龍級潛艦（'+u.nm+'）':TYPES[u.type].n)+'（'+SIDE[u.side]+'）';}
// ---------- 台灣海軍：依真實艦隊編制，一個棋子＝一個艦隊（★艦隊歸屬與武器數字為推估）----------
// 每艘：防空飛彈 ad、防空涵蓋 adR（格）、反艦飛彈 asm、反艦射程 asmR（格）、同時接戰數 ch
const RFW={kl:{n:'基隆級',w:'魚叉',ad:60,adR:kmH(120),asm:8,asmR:kmH(120),ch:2},ck:{n:'成功級',w:'雄二／雄三',ad:36,adR:kmH(40),asm:8,asmR:kmH(160),ch:2},pf:{n:'派里級',w:'雄二',ad:36,adR:kmH(40),asm:4,asmR:kmH(120),ch:2},
  kd:{n:'康定級',w:'雄二',ad:24,adR:kmH(20),asm:8,asmR:kmH(160),ch:2},cy:{n:'濟陽級',w:'魚叉',ad:10,adR:kmH(40),asm:4,asmR:kmH(120),ch:2},lf:{n:'新輕型巡防艦',w:'雄二／雄三',ad:32,adR:kmH(40),asm:8,asmR:kmH(200),ch:2},
  tc:{n:'沱江級',w:'雄二／雄三',ad:12,adR:kmH(20),asm:16,asmR:kmH(160),ch:1},kh:{n:'光六快艇',w:'雄二',ad:0,adR:0,asm:4,asmR:kmH(160),ch:0}};
// 依年份：濟陽級逐步除役、新輕型巡防艦 2028 年起陸續加入（2028～2040 年共 10～12 艘）
const ROCF=[
  {id:'168',n:'168 艦隊（蘇澳）',s:'168',home:'suao',m:y=>[['kl',4],['cy',y<=2027?4:y<=2029?2:0],['lf',y<=2027?0:y<=2029?2:y<=2031?4:6]]},
  {id:'124',n:'124 艦隊（左營）',s:'124',home:'kaohsiung',m:y=>[['kd',6]]},
  {id:'131',n:'131 艦隊（基隆）',s:'131',home:'keelung',m:y=>[['ck',5]]},
  {id:'146',n:'146 艦隊（馬公）',s:'146',home:'magong',m:y=>[['ck',3],['pf',2]]},
  // 光六快艇與沱江級（原海蛟大隊，2014 年併入 131 艦隊；2026 年預定改隸濱海作戰指揮部）。★拆成 6 個小隊分散部署（小艇沒有艦載指管、防空薄弱，集中沒有好處）：
  // 艘數合計不變（沱江 7、光六 30）；各隊母港為推估。w＝這個棋子占「一個艦隊」的比例（1／3）：守方海軍損失與戰損計數（rocNavy）依它換算，總量與原本 6 個艦隊相同
  {id:'fbN1',n:'光六・沱江快艇隊（北一）',s:'艇北1',home:'suao',w:1/3,m:y=>[['tc',2],['kh',5]]},
  {id:'fbN2',n:'光六・沱江快艇隊（北二）',s:'艇北2',home:'keelung',w:1/3,m:y=>[['tc',1],['kh',5]]},
  {id:'fbN3',n:'光六・沱江快艇隊（北三）',s:'艇北3',home:'hualien',w:1/3,m:y=>[['tc',1],['kh',5]]},
  {id:'fbS1',n:'光六・沱江快艇隊（南一）',s:'艇南1',home:'kaohsiung',w:1/3,m:y=>[['tc',1],['kh',5]]},
  {id:'fbS2',n:'光六・沱江快艇隊（南二）',s:'艇南2',home:'magong',w:1/3,m:y=>[['tc',1],['kh',5]]},
  {id:'fbS3',n:'光六・沱江快艇隊（南三）',s:'艇南3',home:'tcport',w:1/3,m:y=>[['tc',1],['kh',5]]}];
const ffW=u=>(u.fl&&u.fl.w)||1; // 艦隊棋子占一個艦隊的比例（主力艦隊 1、快艇小隊 1/3）
const ffWsum=()=>S.units.filter(u=>u.fl&&alive(u)).reduce((a,u)=>a+ffW(u),0);
const rnd3=x=>Math.round(x*1e6)/1e6; // 消除 1/3 累加的浮點誤差
const fleetWn=u=>{const order=['雄二','雄三','魚叉'],w=new Set();u.fl.m.forEach(([k,n])=>{if(n>0&&RFW[k].asm>0)RFW[k].w.split('／').forEach(x=>w.add(x));});return order.filter(x=>w.has(x)).join('／')||'反艦飛彈';};
// 艦隊的飛彈組成（依各艦型的飛彈種類與數量；「雄二／雄三」兩種的艦各算一半，★推估）：給齊射模型依速度算突防
const fleetProf=u=>{const o={};u.fl.m.forEach(([k,n])=>{if(n>0&&RFW[k].asm>0){const ws=RFW[k].w.split('／');ws.forEach(x=>{o[x]=(o[x]||0)+RFW[k].asm*n/ws.length;});}});return o;};
const fleetCls=u=>u.fl.m.filter(([k,n])=>n>0&&RFW[k].asm>0).map(([k])=>RFW[k].n).join('、'); // 有反艦飛彈的艦型 // ★各艦反艦飛彈種類（依公開資料：基隆級、濟陽級魚叉；成功級、沱江級雄二／雄三；康定級、光六雄二；派里級推估為雄二）
const FLEET_PER=2; // ★每艘每次齊射 2 枚
function fleetAgg(u){const A={hp:0,ad:0,asm:0,adR:0,asmR:0,chan:0,sh:0};for(const [k,n] of u.fl.m){if(n<=0)continue;const W=RFW[k];A.hp+=n;A.ad+=W.ad*n;A.asm+=W.asm*n;A.chan+=W.ch*n;if(W.ad>0)A.adR=Math.max(A.adR,W.adR);if(W.asm>0){A.asmR=Math.max(A.asmR,W.asmR);A.sh+=n;}}return A;}
const fleetTxt=u=>u.fl.m.filter(([,n])=>n>0).map(([k,n])=>RFW[k].n+' '+n).join('、');
// 共軍抽象護航艦「dd」：每個代表一組 052D＋054A（★），防空沿用兩艦的數字：攔截彈 48＋32＝80 枚、涵蓋 10 格（052D 海紅旗-9）、每波接戰 4＋2＝6 枚；剩 1 步時減半
const DDW={ad:80,adR:kmH(200),chan:6};
const adROf=e=>e.fl?fleetAgg(e).adR:e.type==='dd'?DDW.adR:SHIPW[e.type].adR,chanOf=e=>e.fl?fleetAgg(e).chan:e.type==='dd'?Math.ceil(DDW.chan*e.hp/TYPES.dd.hp):SHIPW[e.type].chan;
function fleetLose(u,n){ // 損失 n 艘：從船數最多的艦型扣起；飛彈庫存不超過剩下的船能裝的量
  for(let i=0;i<n;i++){let b=null;for(const x of u.fl.m)if(x[1]>0&&(!b||x[1]>b[1]))b=x;if(!b)break;b[1]--;}
  const A=fleetAgg(u);u.mag.ad=Math.min(u.mag.ad,A.ad);u.mag.asm=Math.min(u.mag.asm,A.asm);
}
function rocFleetsSpawn(){
  const y=+S.era||2026;let n=0,ships=0;
  for(const F of ROCF){const k0=SPOT[F.home],h=k0&&TER[k0]&&unitsAt(k0).length<STACK_MAX?TER[k0]:placeNear(k0,x=>x.t==='sea'&&hd(x,TER[k0])<=kmH(40)&&unitsAt(x.k).length<STACK_MAX)||placeNear(k0,x=>x.isl==='TW'&&x.t==='port'&&unitsAt(x.k).length<STACK_MAX);if(!h)continue; // 母港已滿：停在港外相鄰海域
    const u=mkUnit('def','ff',h.k,{});u.fl={id:F.id,n:F.n,s:F.s,w:F.w||1,m:F.m(y).filter(([,c])=>c>0).map(x=>x.slice())};const A=fleetAgg(u);u.hp=A.hp;u.mhp=A.hp;u.mag={ad:A.ad,asm:A.asm,lam:0};S.units.push(u);n+=F.w||1;ships+=A.hp;}
  n=rnd3(n);S.pools.rocNavy=n;S.p0.rocNavy=n;S.rocShips0=ships;
}
// 開戰前海軍部署：east＝疏散到花蓮、台東外海；disperse＝母港附近 2 格內外海；戰略突襲時只有快艇隊來得及出港
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
  const late=S.mods.buildup==='surprise',fs=S.units.filter(u=>u.fl&&alive(u)&&(!late||/^fb/.test(u.fl.id))),used=new Set(),moved=[];
  const free=x=>x&&x.t==='sea'&&!used.has(x.k)&&unitsAt(x.k).length<STACK_MAX;
  const eastSea=Object.values(TER).filter(x=>{if(x.t!=='sea')return false;const [lon,lat]=rcToLL(x.c,x.r);return lon>121.6&&lon<122.3&&lat>22.4&&lat<24.6;}).sort((a,b)=>a.r-b.r);
  for(const u of fs){let h=null;
    if(c==='east'){h=eastSea.find(free);}
    else{const home=hexOf(u);h=Object.values(TER).filter(x=>free(x)&&hd(x,home)<=kmH(40)).sort((a,b)=>hd(a,home)-hd(b,home))[0];}
    if(!h)continue;used.add(h.k);u.c=h.c;u.r=h.r;moved.push(u.fl.s);}
  return [(c==='east'?'疏散到東部外海：':'分散到母港附近外海：')+(moved.join('、')||'無'),late?'戰略突襲：大型艦艇來不及出港，仍在母港':''].filter(Boolean);
}
function rocFleetHit(why){ // 抽象的海空打擊命中守方海軍：船數最多的艦隊損失 1 艘
  const fs=S.units.filter(u=>u.fl&&alive(u));if(!fs.length)return '';const f=pickBest(fs,x=>x.hp);damage(f,1,why);return f.fl.n+' −1 艘';
}
function fleetSalvo(m,t){
  const A=fleetAgg(m);const n=Math.min(m.mag.asm,A.sh*FLEET_PER);if(n<=0)return false;
  m.mag.asm-=n;m.shots=0;m.acted=true;m.revealed=true;useRec('艦隊齊射',1,fleetWn(m)+'（艦射）',n,m.fl.n,t);
  const r=salvoHit(t,n,'fleet>'+t.type,undefined,fleetProf(m)),big=isBigShip(t),steps=r.steps;
  fxSalvo([m.c,m.r],t,r);
  log(m.fl.n+'齊射 '+n+' 枚'+fleetWn(m)+'攻擊 '+uname(t)+'：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+salvoStepTxt(t,steps,'，未造成重創')+'（齊射模型，參數為推估）');
  if(steps)damage(t,steps,m.fl.n+'（'+fleetCls(m)+'）'+fleetWn(m)+'飛彈');
  checkInstant();return true;
}
