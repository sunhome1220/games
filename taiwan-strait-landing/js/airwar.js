'use strict';
/* ---------- 空戰：空軍實際架數、飛彈與攔截彈、火力點數、空優判定（2026-11-14.94 由 theater.js 拆出；一般 script，共用全域）---------- */
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
  for(let i=0;i<e;i++){const k=S.adI.p3>=2?'p3':S.adI.tk>=2?'tk':S.adI.p2>=2?'p2':null;if(!k)break;S.adI[k]-=2;I+=2;kill+=1-Math.pow(1-MSL.pk[k]*((k==='p3'||k==='p2')&&!facUp('leshan')?(intelOK()?WARN.sat.pk:.8):1),2);} // 樂山雷達被摧毀：愛國者少了預警與目標指示
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
function airLossTxt(side,tot,suf){const L=(S.stats.airL||{})[side]||{},nm={air:'空戰',ground:'地面',ad:'被防空擊落'},ps=[];
  let sum=0;
  for(const k of ['air','ground','ad']){const v=Math.round(L[k]||0);
  if(v>0){ps.push(nm[k]+' '+v);
  sum+=v;
  }}const rem=tot-sum;
  if(rem>0&&ps.length)ps.push('艦隊沉沒等 '+rem);
  else if(rem>0&&side!=='def')ps.push('艦隊沉沒等 '+rem);
  return '−'+tot+' 架'+(suf||'')+(ps.length?'（'+ps.join('、')+'）':'');
  }
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

function computeFire(){
  const P=S.pools,t=S.turn,rs=cnShare('rf'),as=cnShare('air');
  mslSync();adSync();S.adLeft=MSL.adCap; // 每個攻方階段：守方各連重新可接戰
  const sP=Math.min(Math.floor(S.msl.srbm/MSL.srbmPer),Math.round(MSL.srbmLaunch/MSL.srbmPer*rs)),rP=Math.min(Math.floor(S.msl.rkt/MSL.rktPer),Math.round(MSL.rktLaunch/MSL.rktPer)); // 發射車數決定每回合上限；飛彈在實際打擊時才扣
  const hs=Math.min(P.plaHS,Math.round((t<=3?2:1)*rs));P.plaHS-=hs; // DF-17 hypersonic: not reduced by the defender's air defense
  const cm0=Math.min(P.plaCM,Math.round((t<=3?2:1)*as));P.plaCM-=cm0;const cm=Math.max(0,cm0-(P.rocAD>=5?1:0)); // cruise missiles are intercepted more easily than ballistic ones
  airSync();const fr=AIR.strike[S.airCtl||'mid']||.4,plaSor=sortiesOf(S.air?S.air.PLA:0,AIR.PLArate)*as*fr+cvIdx().reduce((a,i)=>{const s=sortiesOf(S.air?S.air.cvF[i]:0,AIR.CV[i].rate),w=cvwA(i);return a+s*(w?0:fr);},0); // 有棋子的航艦：對地份額改由艦載機實際空襲（cvwStrike），不再換算成火力點數
  const air=Math.max(0,Math.round(plaSor/AIR.perFire)); // ★陸基機出擊架次依制空狀況分配給對地打擊；航艦艦載機依任務分配的對地比例；每 10 架次＝1 點 // ★出擊架次依制空狀況分配給對地打擊，每 10 架次＝1 點
  const add=S.mods.fireAdd[t]||0,sd=S.sead?1:0; // 守方防空不再直接扣火力點數：改在每個打擊包實際攔截
  S.fireNote=(rs<1||as<1?'大陸基地受損：火箭軍旅可用 '+Math.round(rs*100)+'%、機場可用 '+Math.round(as*100)+'%。':'')+'短程彈道飛彈 '+sP+' 波（每波 4 枚，存量 '+S.msl.srbm+' 枚）＋長程火箭 '+rP+' 波（每波 8 枚，只打得到台灣西半部，存量 '+
      S.msl.rkt+' 枚）'+(hs?'＋東風-17 '+hs:'')+(cm?'＋巡弋飛彈 '+cm:'')+'＋空軍 '+air+(sd?'＋防空壓制 1':'')+'（守方攔截彈 '+adTot()+' 枚，每回合最多接戰 '+MSL.adCap+' 枚）'+(S.weather.fire?'－天候 '+(-S.weather.fire):'')+
      (add?(add>0?'＋':'－')+'事件 '+Math.abs(add):'');
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
  const lp=takeInt(AIR.loss*plaS*Math.min(5,E.pla>0?E.def/E.pla:0),'airL:PLA'),lt=takeInt(AIR.loss*twS*r*air2,'airL:TW'); // 攻方損失依守方（含盟軍）實際升空的戰力；守方機場全癱瘓又沒有盟軍時，攻方在空戰中沒有損失（不再套用 0.2 的下限）
  let lpC=0;if(lp){const cvS=plaS-sortiesOf(S.air.PLA,AIR.PLArate),fromCv=plaS>0?Math.round(lp*cvS/plaS):0;lpC=fromCv;
    {let left=fromCv;for(const i of cvIdx()){if(left<=0)break;const d=Math.min(left,S.air.cvF[i]);S.air.cvF[i]-=d;airLedger('atk','air',d);left-=d;}}airLose('atk',lp-fromCv);out.push('攻方戰機 −'+lp+' 架'+(fromCv?'（其中艦載機 '+fromCv+'）':''));}
  if(lt){airLose('def',lt);out.push('守方戰機 −'+lt+' 架');}
  for(const csg of S.fx.units.filter(f=>isCSG(f)&&fxActive(f)&&f.hp>1)){const i=csgIdx(csg.id),sp=S.cvwA&&S.cvwA.def&&S.cvwA.def[i],ua=sp?sp[0]:1,lu=takeInt(AIR.loss*sortiesOf(S.air.usF[i]*csg.hp/3,AIR.US.rate)*supMult(csgPieceOf(csg))*ua*r,'airL:US'+i);
    if(lu){S.air.usF[i]=Math.max(0,S.air.usF[i]-lu);
    airLedger('us','air',lu);
    out.push((i?'美第 '+(i+1)+' 航艦':'美航艦')+'艦載機 −'+lu+' 架');
    }}
  if(P.rocAD>0&&hitP(.5,'airBattle')){P.rocAD--;out.push('守方防空遭壓制 −1');}
  S.fx.units.forEach(f=>{
    if(!fxActive(f))return;
    if(f.kind==='air'&&!isCSG(f)&&hitP(1/6,'airBattle')){f.hp--;out.push(f.n+' −1');}
    if(f.kind==='sub'&&hitP(1/6,'airBattle')){f.hp--;out.push(f.n+' 遭反潛 −1');}
  });
  if(S.fx.units.some(f=>f.kind==='air'&&fxActive(f))&&P.plaAD>0&&hitP(1/3,'airBattle')){P.plaAD--;out.push('攻方防空 −1');}
  if(out.length)log('第 '+S.turn+' 回合空優爭奪：'+out.join('、'));
  const E2=airEff(),dff=E2.pla-E2.def;
  fxq({t:'dog',al:Math.min(3,lp),dl:Math.min(3,lt),na:Math.min(4,Math.max(2,Math.ceil(plaAirAll()))),nd:Math.min(4,Math.max(2,Math.ceil(allyAir()))),ctl:dff>=3?'atk':dff<=-3?'def':'mid',
      pst:A.m==='bvr'?A.pla:0,dst:A.m==='bvr'&&allyAir()>rocAirEff()?A.ally:0,ob:airfields().filter(h=>afLevel(h.k)<3).map(h=>[h.c,h.r]),ew:S.ewLv||'mid'});
  // 兩層：制空（陸基＋艦載機 vs 守方與盟國）與防空壓制（SEAD）
  const E3=airEff(),rr=E3.def>0?E3.pla/E3.def:9;S.airCtl=rr>=AIR.ctl?'atk':rr<=1/AIR.ctl?'def':'mid'; // ★有效戰力比 ≥ 1.5 為優勢
  S.sead=P.rocAD<=2+(stealthPen(A)>=.12?1:0)+(A.ewk>1?1:0);
  log('制空：'+AIRCTL[S.airCtl]+(A.m==='bvr'?'（隱形機占比：共軍 '+Math.round(A.pla*100)+'%'+(allyAir()>rocAirEff()?'、盟軍 '+Math.round(A.ally*100)+'%':'、台灣 0%')+'；電戰'+({low:'低',mid:'中',high:'高'}[S.ewLv||'mid'])+'）':'')+'；守方防空'+(S.sead?'遭壓制，攻方火力 +1':'尚能維持，攻方火力不加成'));
}
const AIRCTL={atk:'攻方優勢',mid:'雙方均勢',def:'守方與盟國優勢'};
