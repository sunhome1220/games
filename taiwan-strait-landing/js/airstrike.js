'use strict';
/* ---------- 守方空軍：從機場出擊、指定目標（比照航艦艦載機）---------- */
// 依據與推估：
//  每座可用機場的戰機＝現有戰機 ×（1−躲進山洞機堡的比例）÷ 可用機場數；出擊架次＝戰機 × 起降能量 × 妥善率 × 每日架次 × 12 小時（同空戰的 sortiesOf）
//  ★打擊任務比例（其餘留給制空）：守方空優 60%、均勢 40%、攻方空優 20%（攻方 AIR.strike 那張表反過來用）
//  ★每個打擊包 4 架：對艦每架掛 1 枚空射反艦飛彈；島上目標用精準炸彈（庫存不限）；大陸沿岸用萬劍彈或 SLAM-ER（每包 4 枚）
//  庫存：AGM-84L 魚叉 2007 年軍售 60 枚（雄二空射型數量不明，未計入）；★萬劍彈 100 枚（台灣不公開）；SLAM-ER 2020 年核准 135 枚，★依合約時程 2027 年起到位
//  射程：萬劍約 200 km、SLAM-ER 約 270 km；戰機先飛到海峽中線附近才發射，★從台灣中心起算各加 100 km
//  損失：★打擊有防空的目標每架次 2%（同艦載機 CVW.loss）、打大陸沿岸每架次 4%；攻方空優時 ×1.5
const AFS={pk:4,share:{def:.6,mid:.4,atk:.2},loss:.02,lossCN:.04,
  wc:{n:'萬劍彈',km:300,pool:'rocWC'},slam:{n:'SLAM-ER',km:370,pool:'rocSlam'}};
const AFS_POOL=era=>({rocAAsh:60,rocWC:100,rocSlam:(+era||2026)>=2027?135:0});
// ---- 以基地為單位：依空軍聯隊的公開駐地分配戰機（同機種在兩個基地的分法未公開，★對半）----
//  新竹 第 2 聯隊 幻象 2000 約 52；清泉崗 第 3 聯隊、台南 第 1 聯隊 經國號 約 129（各半）；嘉義 第 4 聯隊、花蓮（佳山）第 5 聯隊 F-16V 約 140（各半）；
//  志航 第 7 聯隊：F-16 Block 70 66 架 2028 年起進駐（2026 年 10 月首批 2 架抵達）。桃園機場（民用）、岡山（官校、教練機）、屏東（預警機、運輸機）沒有戰鬥機
const AF_WING={hsinchuab:['第 2 聯隊','幻象 2000',52],ckk:['第 3 聯隊','經國號',65],tainanab:['第 1 聯隊','經國號',64],chiayiab:['第 4 聯隊','F-16V',70],chiashan:['第 5 聯隊','F-16V',70],chihhang:['第 7 聯隊','F-16 Block 70',0]};
function afInitBases(){ // 開局：各基地的戰機（權重＝架數，總和＝S.air.TW）
  const w={};for(const [id,[,,n]] of Object.entries(AF_WING)){const k=SPOT[id];if(k)w[k]=n;}
  const k7=SPOT.chihhang;if(k7)w[k7]=Math.max(0,(S.air.TW0||S.air.TW)-Object.values(w).reduce((a,x)=>a+x,0)); // 2028 年起多出的 F-16 Block 70
  S.air.bw=w;
}
const afWing=k=>{const id=Object.keys(AF_WING).find(x=>SPOT[x]===k);return id?AF_WING[id]:null;};
function afBaseCounts(){ // 各基地現有戰機（依權重分配目前總數；空戰損失按比例，地面與占領損失只扣該基地）
  const w=(S.air&&S.air.bw)||{},s=Object.values(w).reduce((a,x)=>a+x,0)||1,o={};for(const k in w)o[k]=S.air.TW*w[k]/s;return o;}
const afBaseN=k=>Math.floor((afBaseCounts()[k]||0)+1e-9);
function airLoseAt(k,n,src){ // 指定基地的損失（地面被炸、基地被占領）
  if(!S.air||!S.air.bw)return airLose('def',n,src);airSync();const c=afBaseCounts(),d=Math.min(Math.round(n),Math.floor((c[k]||0)+1e-9));if(d<=0)return 0;
  c[k]-=d;const r=airLose('def',d,src);S.air.bw=c;return r;}
function afBaseLost(k){ // 基地被占領：★約四分之一來不及撤離，其餘轉場到其他還能用的基地
  if(!S.air||!S.air.bw)return 0;const c=afBaseCounts(),n=c[k]||0;if(n<=0)return 0;const lost=airLoseAt(k,n*.25,'ground'),c2=afBaseCounts(),rest=c2[k]||0;
  const to=Object.keys(c2).filter(x=>x!==k&&S.owner[x]!=='atk'&&afLevel(x)<3),tot=to.reduce((a,x)=>a+c2[x],0);
  if(to.length){to.forEach(x=>{c2[x]+=rest*(tot>0?c2[x]/tot:1/to.length);});c2[k]=0;S.air.bw=c2;}return lost;}
const afUsable=()=>airfields().filter(h=>S.owner[h.k]!=='atk'&&afLevel(h.k)<3&&afBaseN(h.k)>0);
function afBudget(k){ // 本階段這座機場可出擊的打擊包數（每階段只算一次）
  S.afB=S.afB||{};const key=S.turn+S.phase;let b=S.afB[k];
  if(!b||b.t!==key){const L=afUsable();let n=0;
    if(S.air&&S.pools&&S.pools.rocAir>0&&L.some(x=>x.k===k)){const ac=afBaseN(k)*(1-caveF());n=takeInt(sortiesOf(ac*AFCAP[afLevel(k)],AIR.TWrate)*(AFS.share[S.airCtl||'mid']||.4)/AFS.pk,'afB:'+k);}
    b=S.afB[k]={t:key,n};}
  return b.n;
}
const afShipT=()=>S.units.filter(e=>e.side==='atk'&&atSea(e)&&isShip(e)&&e.type!=='hk'&&e.type!=='fob'&&!e.ship);
const afLandT=()=>S.units.filter(e=>e.side==='atk'&&!atSea(e)&&!e.ship&&(hexOf(e).isl==='TW'||hexOf(e).isl==='PH'));
const afCNwp=km=>km<=AFS.wc.km&&(S.pools.rocWC||0)>=AFS.pk?'wc':km<=AFS.slam.km&&(S.pools.rocSlam||0)>=AFS.pk?'slam':null;
const afCNT=()=>cnTargets().filter(id=>afCNwp(cnHitP(id).km));
const afStgT=()=>stgTargets().filter(u=>afCNwp(cnHitP({u}).km));
function afLose(n,rate){const L=takeInt(n*rate*(S.airCtl==='atk'?1.5:1),'afLoss');return L?airLose('def',L,'ad'):0;}
// 一次出擊：x＝{u}（海上或島上的攻方單位）｜{cn:基地 id}｜{stg:集結中的單位}；auto＝電腦自動（不跳訊息）
function afStrike(k,x,auto){
  if(afBudget(k)<=0){if(!auto)toast('這座機場本階段已沒有可出擊的打擊機',3000);return false;}
  const h0=TER[k],from=[h0.c,h0.r],nm=(h0.name||'機場');let txt=null,L=0;
  if(x.u&&atSea(x.u)){
    const t=x.u,n=Math.min(AFS.pk,Math.floor(S.pools.rocAAsh||0));if(n<=0){if(!auto)toast('空射反艦飛彈已用完',3000);return false;}
    S.pools.rocAAsh-=n;const r=salvoCalc(t,n,false,'afShip>'+t.type),big=t.type==='cv'||t.type==='csg',steps=big?takeInt(r.hits/2,'afBig'):r.hits;
    fxq({t:'air',at:[t.c,t.r],hit:r.hits>0,tsea:true,from,k:'bomb'});
    txt='以 '+n+' 枚空射反艦飛彈攻擊 '+uname(t)+'：'+(r.I?'對方防空發射 '+r.I+' 枚攔截彈，約 '+fmt1(r.surv)+' 枚突破，':'')+'命中 '+r.hits+' 枚'+(steps?'，'+tname(t)+' −'+(t.fl?steps+' 艘':stpU(t,steps)):'');
    L=afLose(AFS.pk,adCover(t).length?AFS.loss:0);
    if(steps)damage(t,steps,'空射反艦飛彈');
  }else if(x.u){
    const t=x.u,h=hexOf(t),ok=hitP(pNeed((h.t==='city'||h.t==='mtn')?6:5),'afLand:'+t.type);
    fxq({t:'air',at:[t.c,t.r],hit:ok,tsea:false,from,k:'bomb'});
    txt='空襲 '+hname(h)+' 的 '+tname(t)+(ok?'：命中':'：未命中（'+lastTxt()+'）');
    L=afLose(AFS.pk,S.pools.plaAD>0?AFS.loss:0);
    if(ok)damage(t,1,'守方空襲');
  }else{
    const tg=x.cn?x.cn:{u:x.stg},wp=afCNwp(cnHitP(tg).km);if(!wp){if(!auto)toast('萬劍彈與 SLAM-ER 射程不到或已用完',3000);return false;}
    S.pools[AFS[wp].pool]-=AFS.pk;S._afWp={wp,k};
    if(x.cn)strikeCN(x.cn,'rocair');else strikeStage(x.stg,'rocair');
    S._afWp=null;L=afLose(AFS.pk,AFS.lossCN);
  }
  S.afB[k].n--;
  if(txt){const s='守方空軍（'+nm+'起飛）'+txt+(L?'（被擊落 '+L+' 架）':'');log(s+'（參數為推估）');if(!auto)toast(s,4000);}
  else if(L)log('守方空軍（'+nm+'起飛）出擊大陸沿岸，被擊落 '+L+' 架（推估）');
  checkInstant();return true;
}
// 電腦自動出擊（電腦守方、電腦代打、或玩家沒用完的份額）：船團 → 島上高價值目標 → 大陸沿岸集結區與基地
function afAuto(){
  if(S.over||!S.pools)return;const AS=(S.intent||{}).asm,HV=['arm','tank','amph','mar','abn'];
  const shipV=t=>tgtVal(t)+(AS==='tr'&&(t.type==='ro'||t.type==='lst'||t.type==='cvy')?3:AS==='esc'&&(isEsc(t)||t.type==='dd')?3:0);
  for(const h of afUsable()){let guard=20;
    while(afBudget(h.k)>0&&guard-->0&&!S.over){
      const sh=(S.pools.rocAAsh||0)>=1?afShipT():[];
      if(sh.length){afStrike(h.k,{u:pickBest(sh,shipV)},true);continue;}
      const ld=afLandT().filter(t=>HV.includes(t.type)||t.type==='fob');
      if(ld.length){afStrike(h.k,{u:pickBest(ld,t=>tgtVal(t)*10+t.hp)},true);continue;}
      const st=afStgT();if(st.length){afStrike(h.k,{stg:pickBest(st,u=>cnValue({u}))},true);continue;}
      const cn=afCNT();if(cn.length){afStrike(h.k,{cn:pickBest(cn,id=>cnHitP(id).p*cnValue(id))},true);continue;}
      break;}
  }
}
// 機場資訊面板：守方玩家可在守方階段指定目標
function afPanelHTML(k){
  const h=TER[k];if(!h||h.t!=='air'||h.isl!=='TW'||!S.started||S.over)return '';
  const P=S.pools||{},W=afWing(k),ac=afBaseN(k),lv=afLevel(k),n=afUsable().some(x=>x.k===k)?afBudget(k):0;
  if(!ac)return '<div class="hint">'+(W?W[0]+'：目前沒有戰機（'+(S.owner[k]==='atk'?'基地已被占領':'戰機已損失或轉場')+'）':'沒有戰鬥機進駐，不能從這裡出擊')+'。</div>';
  let o='<div class="hint"><b>'+(TER[k].name||'基地')+'</b>（'+(W?W[0]+'・'+W[1]:'')+'）：戰機約 '+ac+' 架'+(lv>=3?'，跑道癱瘓，無法起飛':lv?'，跑道受損（起降 '+Math.round(AFCAP[lv]*100)+'%）':'')+(caveF()>0?'（約 '+Math.round(caveF()*100)+'% 躲在山洞機堡）':'')+'；本階段可出擊 '+n+' 個打擊包（每包 4 架）；空射反艦飛彈 '+Math.round(P.rocAAsh||0)+' 枚、萬劍彈 '+Math.round(P.rocWC||0)+' 枚'+((P.rocSlam||0)>0?'、SLAM-ER '+Math.round(P.rocSlam)+' 枚':'')+'。沒用完的份額在階段結束時由電腦自動出擊。</div>';
  if(humanTurn()&&S.phase==='def'&&S.ctrl.def==='human'&&n>0)o+='<div class="cvord"><button class="ghost" id="btnAfS">攻擊船團<small class="pn">（空射反艦飛彈）</small></button><button class="ghost" id="btnAfL">空襲島上目標<small class="pn">（精準炸彈）</small></button><button class="ghost" id="btnAfC">打擊大陸沿岸<small class="pn">（萬劍彈、SLAM-ER）</small></button></div><div class="hint">按下後點地圖上的目標（大陸沿岸：集結中的部隊或大陸基地）。</div>';
  setTimeout(()=>{[['btnAfS','afS'],['btnAfL','afL'],['btnAfC','afC']].forEach(([id,m])=>{const b=document.getElementById(id);if(b)b.onclick=()=>{S.afK=k;S.sel=null;S.mode=S.mode===m?null:m;render();};});},0);
  return o;
}
const afRings=()=>S.mode==='afS'?afShipT():S.mode==='afL'?afLandT():S.mode==='afC'?afStgT():[];
// 點地圖：在 afS／afL／afC 模式下點目標
function afClick(u,cnId){
  const k=S.afK;if(!k||!(S.mode==='afS'||S.mode==='afL'||S.mode==='afC'))return false;
  if(S.mode==='afC'&&cnId){if(!afCNT().includes(cnId))toast(CNB[cnId]?CNB[cnId].n+(S.cn[cnId]<=0?' 已癱瘓':' 超出萬劍彈與 SLAM-ER 射程（或已用完）'):'打不到',3200);else afStrike(k,{cn:cnId});}
  else if(u&&u.side==='atk'&&afRings().includes(u))afStrike(k,S.mode==='afC'?{stg:u}:{u});
  else toast('這個目標不在這種攻擊的範圍內',2500);
  if(afBudget(k)<=0)S.mode=null;render();return true;
}
