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
// 第 4 欄：★作戰半徑（公里，掛載打擊彈藥、不含空中加油；公開資料多為概略值）
const AF_WING={hsinchuab:['第 2 聯隊','幻象 2000',52,550],ckk:['第 3 聯隊','經國號',65,450],tainanab:['第 1 聯隊','經國號',64,450],chiayiab:['第 4 聯隊','F-16V',70,550],chiashan:['第 5 聯隊','F-16V',70,550],chihhang:['第 7 聯隊','F-16 Block 70',0,550]};
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
    if(S.air&&S.pools&&S.pools.rocAir>0&&L.some(x=>x.k===k)){const ac=afBaseN(k)*(1-caveF());n=takeInt(sortiesOf(ac*afCap(k),AIR.TWrate)*(AFS.share[S.airCtl||'mid']||.4)/AFS.pk,'afB:'+k);}
    b=S.afB[k]={t:key,n};}
  return b.n;
}
// ---- 射程：從出擊的基地算 ----
//  打船團、島上目標：基地到目標 ≤ 作戰半徑（打船再加空射魚叉約 120 km）
//  打大陸：戰機不飛進大陸防空網，★最遠飛到基地與大陸海岸距離的一半（海峽中線附近）才發射：基地到目標 ≤ 武器射程（萬劍約 200、SLAM-ER 約 270 km）＋ min(作戰半徑, 到海岸距離 ÷ 2)
const AF_ASM_KM=120;
const afLL=k=>rcToLL(TER[k].c,TER[k].r),afRad=k=>(afWing(k)||[])[3]||450;
const tLL=x=>x&&x.c!=null?rcToLL(x.c,x.r):CNB[x]?[CNB[x].lon,CNB[x].lat]:null; // 單位或大陸基地 id → 經緯度
const afDist=(k,x)=>Math.round(kmLL(afLL(k),tLL(x)));
const AFCOAST={};const afCoast=k=>{if(AFCOAST[k]==null){if(!CNCOAST)CNCOAST=Object.values(TER).filter(x=>x.isl==='CN'&&x.coastal);const p=afLL(k);AFCOAST[k]=Math.min(...CNCOAST.map(h=>kmLL(p,rcToLL(h.c,h.r))));}return AFCOAST[k];};
const afRel=k=>Math.min(afRad(k),afCoast(k)/2); // 打大陸時最遠飛到哪裡發射
const afCNwpK=(k,x)=>{const d=afDist(k,x),r=afRel(k);return d<=AFS.wc.km+r&&(S.pools.rocWC||0)>=AFS.pk?'wc':d<=AFS.slam.km+r&&(S.pools.rocSlam||0)>=AFS.pk?'slam':null;};
const afReach=(k,x)=>x&&x.c==null||(x&&hexOf(x).isl==='CN')?afRel(k)+AFS.slam.km:atSea(x)?afRad(k)+AF_ASM_KM:afRad(k); // 顯示用的可達距離
const afShipT=k=>S.units.filter(e=>e.side==='atk'&&atSea(e)&&isShip(e)&&e.type!=='hk'&&e.type!=='fob'&&!e.ship&&afDist(k,e)<=afRad(k)+AF_ASM_KM);
const afLandT=k=>S.units.filter(e=>e.side==='atk'&&!atSea(e)&&!e.ship&&(hexOf(e).isl==='TW'||hexOf(e).isl==='PH')&&afDist(k,e)<=afRad(k));
const afCNT=k=>cnTargets().filter(id=>afCNwpK(k,id));
const afStgT=k=>stgTargets().filter(u=>afCNwpK(k,u));
const afCanHit=(k,x)=>!x?false:x.cn?afCNT(k).includes(x.cn):x.stg?!!afCNwpK(k,x.stg):!x.u?false:atSea(x.u)?afShipT(k).includes(x.u):afLandT(k).includes(x.u);
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
    const tg=x.cn?x.cn:{u:x.stg},wp=afCNwpK(k,x.cn||x.stg);if(!wp){if(!auto)toast('萬劍彈與 SLAM-ER 射程不到或已用完',3000);return false;}
    S.pools[AFS[wp].pool]-=AFS.pk;S._afWp={wp,k};
    if(x.cn)strikeCN(x.cn,'rocair');else strikeStage(x.stg,'rocair');
    S._afWp=null;L=afLose(AFS.pk,AFS.lossCN);
  }
  S.afB[k].n--;
  if(txt){const s='守方空軍（'+nm+'起飛）'+txt+(L?'（被擊落 '+L+' 架）':'');log(s+'（參數為推估）');if(!auto)fxToast(s,4000);}
  else if(L)log('守方空軍（'+nm+'起飛）出擊大陸沿岸，被擊落 '+L+' 架（推估）');
  checkInstant();return true;
}
// 電腦自動出擊（電腦守方、電腦代打、或玩家沒用完的份額）：船團 → 島上高價值目標 → 大陸沿岸集結區與基地
function afAuto(){
  if(S.over||!S.pools)return;const AS=(S.intent||{}).asm,HV=['arm','tank','amph','mar','abn'];
  const shipV=t=>tgtVal(t)+(AS==='tr'&&(t.type==='ro'||t.type==='lst'||t.type==='cvy')?3:AS==='esc'&&(isEsc(t)||t.type==='dd')?3:0);
  for(const h of afUsable()){let guard=20;
    while(afBudget(h.k)>0&&guard-->0&&!S.over){
      const sh=(S.pools.rocAAsh||0)>=1?afShipT(h.k):[];
      if(sh.length){afStrike(h.k,{u:pickBest(sh,shipV)},true);continue;}
      const ld=afLandT(h.k).filter(t=>HV.includes(t.type)||t.type==='fob');
      if(ld.length){afStrike(h.k,{u:pickBest(ld,t=>tgtVal(t)*10+t.hp)},true);continue;}
      const st=afStgT(h.k);if(st.length){afStrike(h.k,{stg:pickBest(st,u=>cnValue({u}))},true);continue;}
      const cn=afCNT(h.k);if(cn.length){afStrike(h.k,{cn:pickBest(cn,id=>cnHitP(id).p*cnValue(id))},true);continue;}
      break;}
  }
}
// 機場資訊面板：守方玩家可在守方階段指定目標
function afPanelHTML(k){
  const h=TER[k];if(!h||h.t!=='air'||h.isl!=='TW'||!S.started||S.over)return '';
  const P=S.pools||{},W=afWing(k),ac=afBaseN(k),lv=afLevel(k),n=afUsable().some(x=>x.k===k)?afBudget(k):0;
  if(!ac)return '<div class="hint">'+(W?W[0]+'：目前沒有戰機（'+(S.owner[k]==='atk'?'基地已被占領':'戰機已損失或轉場')+'）':'沒有戰鬥機進駐，不能從這裡出擊')+'。</div>';
  let o='<div class="hint"><b>'+(TER[k].name||'基地')+'</b>（'+(W?W[0]+'・'+W[1]:'')+'）：戰機約 '+ac+' 架'+'，'+afTxt(k)+(caveF()>0?'（約 '+Math.round(caveF()*100)+'% 躲在山洞機堡）':'')+'；本階段可出擊 '+n+' 批（每批 4 架）；空射反艦飛彈 '+Math.round(P.rocAAsh||0)+' 枚、萬劍彈 '+Math.round(P.rocWC||0)+' 枚'+((P.rocSlam||0)>0?'、SLAM-ER '+Math.round(P.rocSlam)+' 枚':'')+'。全台各基地本階段還能出擊共 '+afUsable().reduce((a,h)=>a+afBudget(h.k),0)+' 批；沒用完的份額在階段結束時由電腦自動出擊。</div>';
  if(humanTurn()&&S.phase==='def'&&S.ctrl.def==='human'&&n>0)o+='<div class="cvord"><button class="ghost" id="btnAfS">攻擊船團<small class="pn">（空射反艦飛彈）</small></button><button class="ghost" id="btnAfL">空襲島上目標<small class="pn">（精準炸彈）</small></button><button class="ghost" id="btnAfC">打擊大陸沿岸<small class="pn">（萬劍彈、SLAM-ER）</small></button></div><div class="hint">按下後點地圖上的目標（大陸沿岸：集結中的部隊或大陸基地）。</div>';
  setTimeout(()=>{[['btnAfS','afS'],['btnAfL','afL'],['btnAfC','afC']].forEach(([id,m])=>{const b=document.getElementById(id);if(!b)return;const on=S.mode===m&&S.afK===k;b.classList.toggle('on',on);if(on){const t=b.firstChild;if(t&&t.nodeType===3)t.nodeValue='✓ '+AF_MODE_N[m]+'（選擇中，再按取消）';}b.onclick=()=>{const was=S.mode===m&&S.afK===k;S.afK=k;S.sel=null;S.afPend=null;S.mode=was?null:m;if(!was&&typeof UC!=='undefined'){UC.closedKey=UC.key;}render();}; /* 選了出擊方式就收起基地資訊卡，讓出地圖與確認面板 */});},0);
  return o;
}
const AF_MODE_N={afS:'攻擊船團',afL:'空襲島上目標',afC:'打擊大陸沿岸'};
const afRings=()=>!S.afK?[]:S.mode==='afS'?afShipT(S.afK):S.mode==='afL'?afLandT(S.afK):S.mode==='afC'?afStgT(S.afK):[];
// 點地圖：在 afS／afL／afC 模式下點目標
function afClick(u,cnId){
  const k=S.afK;if(!k||!(S.mode==='afS'||S.mode==='afL'||S.mode==='afC'))return false;
  if(S.mode==='afC'&&cnId){if(!afCNT(k).includes(cnId))toast(CNB[cnId]?CNB[cnId].n+(S.cn[cnId]<=0?' 已癱瘓':' 超出萬劍彈與 SLAM-ER 射程（或已用完）'):'打不到',3200);else S.afPend={k,x:{cn:cnId}};}
  else if(u&&u.side==='atk'&&afRings().includes(u))S.afPend={k,x:S.mode==='afC'?{stg:u.id}:{u:u.id}}; // 先顯示目標資訊，按「確認出擊」才打
  else toast('這個目標不在這種攻擊的範圍內',2500);
  render();return true;
}
// ---- 空軍出擊確認面板（比照縱深打擊）----
function afPendInfo(){
  const P=S.afPend;if(!P)return null;const k=P.k,h0=TER[k],nb=afBudget(k),lr=S.airCtl==='atk'?1.5:1;let nm,lines=[],ok=nb>0,risk=0;
  if(P.x.cn||P.x.stg){
    const u=P.x.stg?S.units.find(x=>x.id===P.x.stg):null;if(P.x.stg&&(!u||!alive(u)))return null;const tg=P.x.cn||{u},H=cnHitP(tg),wp=afCNwpK(k,P.x.cn||u),found=!u||stgFound(u)>0;
    nm=P.x.cn?CNB[P.x.cn].n:hname(hexOf(u)).replace(/^大陸 /,'大陸沿岸 ')+' 集結中的 '+TYPES[u.type].n;
    lines.push(u?(found?'本階段找到 '+stgFound(u)+' 步':'本階段沒有找到，打不到'):'狀態 '+S.cn[P.x.cn]+'／'+CNB[P.x.cn].hp+' 級');
    lines.push((wp?AFS[wp].n+' '+AFS.pk+' 枚（剩 '+Math.round(S.pools[AFS[wp].pool]||0)+'）':'萬劍彈、SLAM-ER 射程不到或已用完')+'・'+(H.IC.I?'約 '+fmt1(H.IC.surv)+' 枚突破防空':'共軍防空已失效'));
    lines.push(u?stepOdds(u,found?H.p:0):'打掉一級的機率 <b>'+Math.round(H.p*100)+'%</b>：'+(CN_FX[CNB[P.x.cn].kind]||'基地受損一級'));
    ok=ok&&!!wp&&found;risk=AFS.lossCN;
  }else{
    const t=S.units.find(x=>x.id===P.x.u);if(!t||!alive(t))return null;nm=uname(t)+'（'+hname(hexOf(t))+'）';
    if(atSea(t)){const cov=adCover(t).length,n=Math.min(AFS.pk,Math.floor(S.pools.rocAAsh||0));
      lines.push('空射反艦 '+n+' 枚（剩 '+Math.round(S.pools.rocAAsh||0)+'）・'+(cov?cov+' 艘護航艦防空，先被攔截':'無護航防空，預估命中 '+fmt1(n*SALVO.pSeek)+' 枚'));
      ok=ok&&n>0;risk=cov?AFS.loss:0;}
    else{const h=hexOf(t),p=pNeed((h.t==='city'||h.t==='mtn')?6:5);lines.push('精準炸彈・'+stepOdds(t,p)+((h.t==='city'||h.t==='mtn')?'（城市／山地較難）':''));risk=S.pools.plaAD>0?AFS.loss:0;}
  }
  const tx=P.x.cn?P.x.cn:S.units.find(y=>y.id===(P.x.u||P.x.stg));if(tx)lines.unshift((h0.name||'基地')+' → '+afDist(k,tx)+' km（'+(afWing(k)?afWing(k)[1]+' ':'')+'可達 '+Math.round(afReach(k,tx))+' km）');
  const xx=P.x.cn?{cn:P.x.cn}:P.x.stg?{stg:S.units.find(y=>y.id===P.x.stg)}:{u:S.units.find(y=>y.id===P.x.u)};
  const all=afUsable().map(h=>[h,afBudget(h.k)]).filter(x=>x[1]>0&&afCanHit(x[0].k,xx));
  lines.push((all.length?'剩 '+all.reduce((a,x)=>a+x[1],0)+' 批（'+all.map(([h,n])=>(h.name||'基地').replace(/基地$/,'')+' '+n).join('、')+'）':'沒有基地打得到或都已出擊完')+'・每批 4 架'+(risk?'・預估損失 '+fmt1(AFS.pk*risk*lr)+' 架':''));
  ok=ok&&!!xx&&afCanHit(k,xx);
  return {html:'<b>'+nm+'</b>'+lines.map(l=>'<div class="cpm">'+l+'</div>').join(''),ok};
}
function afPendSync(){
  let el=document.getElementById('afPend');
  const on=S.afPend&&humanTurn()&&S.phase==='def'&&(S.mode==='afS'||S.mode==='afL'||S.mode==='afC')&&!S.over,I=on?afPendInfo():null;
  if(!I){if(el)el.hidden=true;if(S.afPend&&!on)S.afPend=null;return;}
  if(!el){el=document.createElement('div');el.id='afPend';document.body.appendChild(el);pendDrag(el);}
  el.innerHTML=I.html+'<div class="cpb"><button class="ghost" id="afPendNo">取消</button><button id="afPendGo"'+(I.ok?'':' disabled')+'>確認出擊</button></div>';el.hidden=false;
  document.getElementById('afPendNo').onclick=()=>{S.afPend=null;render();};
  document.getElementById('afPendGo').onclick=()=>{const P=S.afPend;if(!P)return;
    const x=P.x.u?{u:S.units.find(y=>y.id===P.x.u)}:P.x.stg?{stg:S.units.find(y=>y.id===P.x.stg)}:{cn:P.x.cn};if((x.u===undefined&&P.x.u)||(P.x.stg&&!x.stg))return;
    afStrike(P.k,x);const t=x.u||x.stg;if(t&&!alive(t))S.afPend=null;
    if(afBudget(P.k)<=0){const nx=afUsable().find(h=>afBudget(h.k)>0&&(!S.afPend||afCanHit(h.k,P.x.cn?{cn:P.x.cn}:P.x.stg?{stg:S.units.find(y=>y.id===P.x.stg)}:{u:S.units.find(y=>y.id===P.x.u)}))); // 這座基地份額用完：自動改由下一座還有份額的基地出擊
      const k0=P.k;if(nx){S.afK=nx.k;if(S.afPend)S.afPend.k=nx.k;toast((TER[k0].name||'基地')+' 本階段已出擊完，改由 '+(nx.name||'基地')+' 出擊',2600);}else{S.mode=null;S.afPend=null;toast('全台各基地本階段都已出擊完',2600);}}
    render();};
}
