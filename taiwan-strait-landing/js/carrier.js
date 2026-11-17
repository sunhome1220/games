'use strict';
/* ---------- 航艦艦隊：艦載機任務、護航艦、齊射模型、艦隊協同（2026-11-14.94 由 theater.js 拆出；一般 script，共用全域）---------- */
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
const cvwFoes=(side,c)=>S.units.filter(e=>e.side!==side&&atSea(e)&&isShip(e)&&!isSubT(e)&&e.type!=='fob'&&!subHidden(e)&&rd(hexOf(c.u),hexOf(e))<=c.w.r+c.w.asmR);
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
    const k=x.af,h=TER[k],pk=S.sead?4:5;ok=hitP(pNeed(pk),'cvwAF:'+side);
    fxq({t:'air',at:[h.c,h.r],hit:ok,tsea:false,from,k:'bomb'});
    txt='空襲機場 '+(h.name||'機場');
    if(ok){S.afDmg=S.afDmg||{};S.afDmg[k]=afCut(k)+1;let more='';
      if(afCap(k)<=.5&&S.pools.rocAir>0&&gndMul()>0&&hitP(.5,'cvwAF:'+side)){more='，地面戰機 −'+airLoseAt(k,4*gndMul(),'ground')+' 架（推估）';}
      txt+='：'+afTxt(k)+more;}else txt+='：未命中';
  }else if(x.port){
    const k=x.port,h=TER[k];ok=hitP(pNeed(5),'cvwPort:'+side);
    fxq({t:'air',at:[h.c,h.r],hit:ok,tsea:false,from,k:'bomb'});
    if(ok)S.portDown[k]=S.turn;txt='空襲被占領的 '+(h.name||'港口')+(ok?'：命中，卸載停擺 2 回合':'：未命中');
  }else{
    const t=x.u,h=hexOf(t),mob=side==='atk'&&isLch(t),hid=false,L=mob?(lchFound(t,'cm'),t.locL):null;
    if(mob&&t.locN<=0){
      fxq({t:'air',at:[t.c,t.r],hit:false,tsea:false,from,k:'bomb'});txt='空襲 '+hname(h)+'：'+(t.revealed?'發射車已轉移':'沒能定位真正的發射車，打中誘餌與空車')+'（'+L.txt+'）';
    }else{
      const need=Math.min(6,5+terrCover(h)+(hid?1:0));ok=hitP(mob?lchKillP({k:'g'}):pNeed(need),'cvwLand:'+side+':'+t.type);
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
  const r=salvoHit(t,k,'cvw:'+side+'>'+t.type),big=isBigShip(t),steps=r.steps;
  fxq({t:'cva',from:[c.u.c,c.u.r],to:[t.c,t.r],hit:r.hits>0,side,n:Math.max(1,Math.min(3,Math.ceil(k/4))),R:c.w.asmR,ad:cov?(r.hits>0?'pass':'int'):undefined});
  const L=cov?cvwLose(c,takeInt(CVW.loss*k/CVW.per,'cvwL:'+side)):0;
  const txt=k+' 枚'+c.nm+'攻擊 '+uname(t)+'（距離 '+Math.round(rd(hexOf(c.u),hexOf(t))*10)/10+' 格）：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+salvoStepTxt(t,steps)+(L?'，打擊機被擊落 '+L+' 架':'');
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
      const fo=cvwFoes(side,c).filter(e=>!cvOOA(e));if(!fo.length)break;const t=pickBest(fo,escVal),cov=adCover(t).length>0,k=cov?n:Math.min(n,Math.max(2,2*t.hp));
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
const SALVO={pSeek:.8,pSeekEW:.6,pInt:.7,pIntBM:.5,perMsl:2,ciws:2}; // pSeekEW：★有護航艦干擾與誘餌時的尋標命中率；ciws：★每艘護航艦每階段近迫防禦接戰數
const isEsc=u=>!!SHIPW[u.type];
const tname=t=>t.fl?t.fl.n:t.wp==='hp'?'魚叉岸防系統':t.hl?subNm(t):TYPES[t.type].n;
// ---------- 第 3c 階段：對地巡弋飛彈與反潛（★皆為推估）----------
// 對地：戰斧（美）／長劍系列（共軍 055、052D）射程都在 1,500 km 以上，整個戰場都在射程內；★每次打擊 4 枚，命中率沿用既有的縱深打擊公式
// 反潛：★每回合發現潛艦機率 054A 35%、055 30%、052D 25%（舊護航艦 25%）；新護航艦有艦載直升機，搜索範圍 ★6 格（約 120 km，舊護航艦 3 格）
// 海鯤魚雷打航艦：每有一艘新護航艦在 2 格內，命中率 −★5%（最低 10%）
// 共軍潛艦打美航艦：美方反潛屏障 A＝護航艦數＋MH-60R 架數÷4（★航艦反潛直升機中隊 11 架＋每艘護航艦 2 架）；★命中率 0.3÷(1＋0.25A)，★潛艦被擊沉機率 min(0.6, 0.05A)
const LAM={per:4,asw:{f54:.35,d55:.3,d52:.25,dd:.25},aswR:{f54:kmH(120),d55:kmH(120),d52:kmH(120),dd:kmH(60)},hkCv:.05,hkMin:.1,mh60cv:11,mh60esc:2};
function usAswScreen(g){const u=g||uscPiece();if(!u||!alive(u))return 0;const es=S.units.filter(e=>e.ally==='US'&&isEsc(e)&&e.type!=='tak'&&alive(e)&&e.grp===u.id).length;return es+(LAM.mh60cv+LAM.mh60esc*es)/4;}
const ESC_PLA=['d55','d52','d52','f54','f54']; // ★戰時航艦護航 5 艘：055×1、052D×2、054A×2。日本防衛省歷次通報平時編隊 3～5 艘＋901 補給艦（例：2022 遼寧 055×2、052D、054A；2025 山東 055、054A×2），戰時取上限
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
// 休斯齊射模型：每艘防空艦一波最多接戰 chan 枚（受庫存限制），每枚用 2 枚攔截彈；超過接戰上限的來襲飛彈不會被攔截；涵蓋範圍內的艦艇分攤接戰（見 salvoCalc）
// 同一階段（同回合、同一方行動）內，多次射擊打同一支艦隊視為協同齊射：每艘防空艦已接戰的數量累加，超過上限的就攔不了
const chLeft=(x,cap)=>{const st=S.turn+S.phase;if(x.chT!==st){x.chT=st;x.chU=0;}return Math.max(0,cap-x.chU);};
// 齊射的共用流程：先算攔截與命中（salvoCalc），再換算成扣幾步——航艦體積大，★每 2 枚命中扣 1 步；其他船每枚命中扣 1 步
const isBigShip=t=>t.type==='cv'||t.type==='csg';
// ★航艦：每 2 枚命中扣 1 步，打到剩最後 1 步就失去戰力（無法起降、撤離）；最後 1 步（沉沒）要再多 ★6 枚命中——一般評估擊沉大型航艦需要的命中數遠多於讓它失能
const SINK_HITS=6;
function bigSteps(t,hits,key){let s=0,rem=hits;while(t.hp-s>1&&rem>=2){s++;rem-=2;}if(t.hp-s>1)return s+takeInt(rem/2,key);return s+Math.min(t.hp-s,takeInt(rem/SINK_HITS,key+':sink'));}
function salvoHit(t,n,key,bigKey){const r=salvoCalc(t,n,false,key);r.steps=isBigShip(t)?bigSteps(t,r.hits,bigKey||'salvoBig'):r.hits;return r;}
const salvoStepTxt=(t,steps,none)=>steps?'，'+tname(t)+' −'+(t.fl?steps+' 艘':stpU(t,steps)):(none||''); // 戰報：扣了幾步（艦隊寫艘數）
function salvoCalc(t,n,bm,key){
  const pk=1-Math.pow(1-(bm?SALVO.pIntBM:SALVO.pInt),SALVO.perMsl),cov=adCover(t).length>0||S.units.some(e=>e!==t&&e.side===t.side&&alive(e)&&(isEsc(e)||e.type==='dd')&&rd(hexOf(e),hexOf(t))<=kmH(30));let left=n,I=0,kill=0;
  // 分攤接戰：涵蓋範圍內的每艘防空艦都出力，不再由清單前面的艦先吃完。來襲飛彈一枚一枚分配給「本階段接戰負荷（已接戰÷接戰量上限）最低」的那一艘；
  // 負荷相同時，取累計接戰次數（engN）較少的，再取接戰量大的。接戰量大的艦（055）分到較多、小的（054A）也輪得到；
  // 每艘的接戰量上限、攔截彈庫存都不變，總接戰量與總攔截彈消耗不變，命中期望值不變
  const ads=adCover(t).map(e=>{const full=Math.max(1,chanOf(e));return {e,full,cap:Math.min(chLeft(e,full),Math.floor(e.mag.ad/SALVO.perMsl))};});
  while(left>0){let b=null,bl=0;for(const a of ads){if(a.cap<=0)continue;const l=a.e.chU/a.full;
      if(!b||l<bl-1e-9||(Math.abs(l-bl)<1e-9&&((a.e.engN||0)<(b.e.engN||0)||((a.e.engN||0)===(b.e.engN||0)&&a.full>b.full)))){b=a;bl=l;}}
    if(!b)break;b.e.chU++;b.e.engN=(b.e.engN||0)+1;b.e.mag.ad-=SALVO.perMsl;b.cap--;I+=SALVO.perMsl;kill+=pk;left--;}
  if(left>0&&(t.type==='cv'||t.type==='csg')){const c=Math.min(left,chLeft(t,2));t.chU+=c;kill+=c*.5;left-=c;} // 航艦自身近迫防禦
  // ★護航艦近迫防禦（近迫武器砲、紅旗-10、方陣快砲等）：目標 30 km 內的護航艦或艦隊，每階段各再接戰 2 枚突破的飛彈，攔下機率 50%
  if(left>0)for(const e of S.units){if(left<=0)break;if(e===t||e.side!==t.side||!alive(e)||!(isEsc(e)||e.fl||e.type==='dd')||rd(hexOf(e),hexOf(t))>kmH(30))continue;
    const st=S.turn+S.phase;if(e.cpT!==st){e.cpT=st;e.cpU=0;}const c=Math.min(left,Math.max(0,SALVO.ciws-e.cpU));if(c<=0)continue;e.cpU+=c;kill+=c*.5;left-=c;}
  const surv=Math.max(0,n-kill),hits=Math.min(n,takeInt(surv*(cov?SALVO.pSeekEW:SALVO.pSeek),key||'salvo')); // ★艦隊裡有護航艦時，電子干擾與誘餌讓尋標命中率降低
  return {n,I,surv,hits};
}
function fireSalvo(m,t){
  const W=SHIPW[m.type];if(!m.mag||m.mag.asm<=0)return false;
  const n=Math.min(W.salvo,m.mag.asm);m.mag.asm-=n;m.shots=Math.max(0,(m.shots||1)-1);if(m.shots<=0)m.acted=true;m.revealed=true;
  const r=salvoHit(t,n,'salvo:'+m.type+'>'+t.type),big=isBigShip(t),steps=r.steps;
  fxSalvo([m.c,m.r],t,r);
  log(uname(m)+'以 '+n+' 枚'+W.asmN+'攻擊 '+uname(t)+'：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+salvoStepTxt(t,steps,'，未造成重創')+'（齊射模型，參數為推估）');
  if(steps)damage(t,steps,W.asmN+'齊射');
  checkInstant();return true;
}
function escTargets(u){
  if(!isEsc(u)||u.shots<=0||!u.mag||u.mag.asm<=0)return [];const W=SHIPW[u.type];
  return S.units.filter(e=>e.side!==u.side&&atSea(e)&&isShip(e)&&!isSubT(e)&&!subHidden(e)&&rd(hexOf(u),hexOf(e))<=W.asmR);
}
const escVal=e=>e.type==='cv'||e.type==='csg'?(cvOOA(e)?.5:6):e.type==='tak'?5:isEsc(e)?4:e.type==='lst'||e.type==='ro'?3.5:e.type==='cvy'?3:e.type==='dd'||e.type==='ff'?2.5:1;
// 協同齊射：射程內能打到同一目標的護航艦一起發射，用數量飽和對方防空（現實中的艦隊戰術）
function fireVolley(shooters,t){
  let n=0;const names=[];
  for(const m of shooters){const k=Math.min(SHIPW[m.type].salvo,m.mag.asm);if(k<=0)continue;m.mag.asm-=k;n+=k;m.shots=0;m.acted=true;m.revealed=true;names.push(TYPES[m.type].s);fxq({t:'hmr',from:[m.c,m.r],to:[t.c,t.r],hit:false,atc:true});}
  if(!n)return false;
  const r=salvoHit(t,n,'salvo:'+shooters[0].side+'>'+t.type),big=isBigShip(t),steps=r.steps;
  log(SIDE[shooters[0].side]+'艦隊協同齊射（'+names.join('、')+'）共 '+n+' 枚反艦飛彈攻擊 '+uname(t)+'：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+salvoStepTxt(t,steps,'，未造成重創')+'（齊射模型，參數為推估）');
  if(steps)damage(t,steps,'艦隊齊射');
  checkInstant();return true;
}
function escAutoFire(side){ // 電腦自動開火：挑射程內最有價值的目標，能打到的護航艦一起齊射，直到沒有可射的艦艇
  for(let guard=0;guard<10&&!S.over;guard++){
    const ready=S.units.filter(e=>e.side===side&&isEsc(e)&&alive(e)&&escTargets(e).length);if(!ready.length)return;
    const all=[...new Set(ready.flatMap(escTargets))].filter(e=>!cvOOA(e)),t=pickBest(all,escVal);if(!t)return; // 已失去戰力的航艦不再浪費飛彈
    const sh=ready.filter(m=>escTargets(m).includes(t));if(!fireVolley(sh,t))return;
  }
}
