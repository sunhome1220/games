'use strict';
/* ---------- strikes on mainland bases, retaliation ---------- */
// ── 縱深打擊：改用實際枚數，規則與攻方火力打擊台灣對稱 ──
// ★推估（台灣未公開庫存）：1 點長程飛彈≈25 枚（2026 年 10 點≈250 枚＝雄二E 約 190＋ATACMS 64 的量級；ATACMS 現在另計在 rocAtc，previewEra 會從這裡扣掉）；
//  每包 4 枚（同攻方短程彈道飛彈包）；每個守方階段可發射量受發射車限制：24／32／40 枚（依年代 dfire 2／3／4）；
//  共軍防空（紅旗-9、紅旗-16 等）：每枚來襲以 2 枚攔截，★單枚攔截率 0.4（低空次音速巡弋飛彈利用雷達地平線），依攻方防空存量縮放；
//  通過攔截後命中率依目標硬度（見 CNHARD；機場 33% 同攻方打台灣機場）；命中＝基地受損一級，攻方每 2 回合修復一級（同台灣機場）。
//  火箭軍飛彈與機動發射車戰時多已疏散，打駐地只削弱發射能量（支援設施、預備陣地），不直接摧毀飛彈。
const ROCLR={per:25,pk:4,launch:{2:24,3:32,4:40},ipk:.4,ipn:2};
const mslUsed=()=>S.mslUse&&S.mslUse.k===S.turn+'def'?S.mslUse.n:0; // 本回合守方已發射的雄二E 包數（「反制先制打擊」的反擊在守方階段前發射，佔用同一批發射車）
const lrPackets=()=>Math.max(0,Math.min(Math.floor((ROCLR.launch[S.dfireMax||2]||24)/ROCLR.pk)-mslUsed(),Math.floor((S.pools.rocMsl||0)*ROCLR.per/ROCLR.pk+1e-9)))
  +Math.min(Math.floor((S.pools.rocAtc||0)/ROCLR.pk),S.units.filter(u=>u.side==='def'&&u.type==='hmr'&&alive(u)).reduce((a,u)=>a+Math.min(u.shots||0,Math.floor((ssmReady(u)-(u.lu||0))/ROCLR.pk)),0)); // 加上海馬士現在還能發射的陸軍戰術飛彈包數（要有剩餘射擊次數與 4 輛可射車）
// 陸軍戰術飛彈也能打 300 km 內的大陸目標：與海馬士共用同一個庫存（rocAtc），要有一組還有 4 輛可射的海馬士，發射佔用它一次齊射並暴露；300 km 內優先用它，省下雄二E 打更遠的目標
const ATC_KM=300;
const hmrDeep=()=>S.units.find(u=>u.side==='def'&&u.type==='hmr'&&alive(u)&&u.shots>0&&ssmReady(u)-(u.lu||0)>=ROCLR.pk);
const atcDeepOK=()=>(S.pools.rocAtc||0)>=ROCLR.pk&&!!hmrDeep();
const lrOK=()=>(S.pools.rocMsl||0)>0||atcDeepOK();
const lrWpn=km=>km<=ATC_KM&&atcDeepOK()?'atc':(S.pools.rocMsl||0)>0?'msl':null;
function lrSpend(km){ // 台灣縱深打擊扣彈：回傳 {wp,src}；沒有可用的飛彈回傳 null
  const wp=lrWpn(km),P=S.pools;if(!wp)return null;
  if(wp==='atc'){const h=hmrDeep();P.rocAtc-=ROCLR.pk;h.shots--;h.lu=(h.lu||0)+ROCLR.pk;h.revealed=true;return {wp,src:h};}
  P.rocMsl=Math.max(0,Math.round((P.rocMsl-ROCLR.pk/ROCLR.per)*100)/100);const k=S.turn+'def';if(!S.mslUse||S.mslUse.k!==k)S.mslUse={k,n:0};S.mslUse.n++;return {wp,src:null};
}
const lrWho=L=>L&&L.wp==='atc'?'台灣陸軍戰術飛彈（海馬士）':'台灣長程飛彈（雄二E）';
function cnIntercept(n,eng){const k=Math.min(1,(S.pools.plaAD||0)/6),pk=ROCLR.ipk*k,kill=1-Math.pow(1-pk,ROCLR.ipn),e=eng||1,surv=n*Math.pow(1-kill,e);return {surv,I:pk>0?Math.round(n*ROCLR.ipn*Math.min(e,1.5)):0};}
// ── 命中率依目標而不同（★推估）──
// 距離：從台灣發射，300 km 內只過沿岸一層防空；更深的目標要多穿過防空網，每多 300 km 再多半層接戰（江西、安徽的火箭軍駐地約 500～900 km）；ATACMS 300 km 內可用（與海馬士共用庫存，見 lrWpn），更遠只有雄二E
// 硬度（突破後命中並造成損傷的機率）：火箭軍駐地有加固掩體與坑道 25%；機場、軍港 33%（同攻方打台灣機場）；指揮中心（地下化）20%；雷達與電子偵察站 40%；碼頭邊的船與集結中的車輛（軟目標、密集）45%
const CNHARD={rf:.25,air:.33,navy:.33,stg:.45,isrHQ:.2,isrRad:.4};
const TWLL=[120.7,24.3];
function kmTo(lon,lat){const k=Math.PI/180,dx=(lon-TWLL[0])*111*Math.cos(((lat+TWLL[1])/2)*k),dy=(lat-TWLL[1])*111;return Math.hypot(dx,dy);}
function cnHitP(tg){ // tg：基地 id 或 {u}；回傳 {p（每包命中率）,km,eng,hard,IC}
  let lon,lat,hard;
  if(tg.u){const ll=rcToLL(tg.u.c,tg.u.r);lon=ll[0];lat=ll[1];hard=CNHARD.stg;}
  else{const B=CNB[tg];lon=B.lon;lat=B.lat;hard=B.kind==='isr'?(tg==='nanjing'?CNHARD.isrHQ:CNHARD.isrRad):(CNHARD[B.kind]||.33);}
  const km=kmTo(lon,lat),eng=1+.5*Math.max(0,km-300)/300,IC=cnIntercept(ROCLR.pk,eng);
  return {p:hard*IC.surv/ROCLR.pk,km:Math.round(km),eng,hard,IC};
}
// ── 電腦挑目標：期望效果＝每包命中率 × 命中後的效果（換算成「約等於打掉幾步」，★推估）──
//  共軍火力每包約打掉台灣 0.1 步（依統計：每局約 120 次火力損失／約 1,200 包）；修復要 2 回合
const CN_STEP_PER_PKG=.1;
function cnValue(tg){
  const left=Math.max(0,Math.min(2,(S.T||8)-S.turn+1)); // 受損約維持 2 回合（攻方每 2 回合修復一級），且不超過剩下的回合
  if(tg.u){const u=tg.u,b=u.boundTo?S.units.find(x=>x.id===u.boundTo):null;return (isShip(u)?1:(CPW[u.type]||1))+(b?(CPW[b.type]||1):0);} // 集結中的部隊或船：直接打掉 1 步（載著旅的船連旅一起）
  const B=CNB[tg],lvl=B.hp;
  if(B.kind==='rf'){const per=(MSL.srbmLaunch/MSL.srbmPer)/Object.values(CNB).filter(x=>x.kind==='rf').reduce((a,x)=>a+x.hp,0);return (S.msl&&S.msl.srbm>0?per*left*CN_STEP_PER_PKG:0);} // 每級約少發射 5 包／回合
  if(B.kind==='air'){const per=(S.fire||20)*.4/Object.values(CNB).filter(x=>x.kind==='air').reduce((a,x)=>a+x.hp,0);return per*left*CN_STEP_PER_PKG+(S.cn[tg]<=2&&S.pools.plaAir>0?.5*.3:0);}
  if(B.kind==='navy')return S.cn[tg]<=1&&S.pools.plaNavy>0?1:.2; // 打到癱瘓才傷及港內艦艇
  if(B.kind==='isr')return 6*(.2/Object.values(CNB).filter(x=>x.kind==='isr').reduce((a,x)=>a+x.hp,0))*left; // 共軍每回合約 6 步火力損失來自需要定位的目標，每級少找到約 5%
  return .2;
}
function cnNeed(id){return 5;}
// 命中後，地圖上基地的受損標記要等飛彈動畫抵達才更新（結算當下就已扣，畫面先保留，最多 6 秒）
const CNPEND={};
const cnShown=id=>{const now=Date.now(),L=(CNPEND[id]||[]).filter(x=>x>now);CNPEND[id]=L;return Math.min(CNB[id].hp,S.cn[id]+L.length);};
function repairCN(){ // 攻方每 2 回合搶修一級（同守方機場）
  if(S.turn%2||!S.cn)return;
  for(const id of Object.keys(CNB)){if(S.cn[id]<CNB[id].hp){S.cn[id]++;log('攻方搶修大陸 '+CNB[id].n+(S.cn[id]>=CNB[id].hp?'，恢復運作':'，仍受損'));}}
}
function cnTargets(){return Object.keys(CNB).filter(id=>S.cn[id]>0&&CNB[id].kind!=='stg');}
// 沿岸集結中的攻方部隊與船隻（登船前最脆弱）：部隊與車輛擠在港區、船靠碼頭、裝載要好幾天，衛星（含商業衛星）看得到——每步每階段定位 ★60%，夜間 ×0.7、雲雨或颱風 ×0.6
const STGLOC={p:.6,night:.7,wx:.6};
const stgUnits=()=>S.units.filter(u=>u.side==='atk'&&alive(u)&&u.hp>0&&hexOf(u).isl==='CN'&&u.type!=='cv'&&u.type!=='fob');
function stgFound(u){const key=S.turn+S.phase;if(u.sgT!==key){u.sgT=key;let p=STGLOC.p;const f=['集結裝載中，每步定位 '+Math.round(p*100)+'%'];
  if(S.turn%2===0){p*=STGLOC.night;f.push('夜間 ×'+STGLOC.night);}
  if(S.weather&&(S.weather.id==='bad'||tyThreat(S.weather))){p*=STGLOC.wx;f.push('雲雨或颱風 ×'+STGLOC.wx);}
  u.sgL=f.join('、');u.sgN=takeInt(p*Math.max(0,u.hp),'sgloc');}return u.sgN;}
const stgTargets=()=>stgUnits().filter(u=>stgFound(u)>0);
function strikeStage(u,by){ // 縱深打擊集結中的部隊或船隻：同一套規則（每包 4 枚、先過共軍防空、命中 33%），要先被找到
  const hn=x=>{const n=hname(x);return /^大陸 /.test(n)?'大陸沿岸':n;},P=S.pools,sc=by==='roc'?ROCLR.pk/ROCLR.per:1,proxy=by==='US'&&usIdx()<2;let who={roc:'台灣長程飛彈（雄二E）',US:proxy?'美軍（代理打擊）':'美軍',JP:'自衛隊'}[by],h=hexOf(u);
  let L=null;if(by==='roc'){L=lrSpend(cnHitP({u}).km);if(!L){log('沒有射程到得了 '+hn(h)+' 的長程飛彈');S.dfire++;return;}who=lrWho(L);}
  S.retal+=((by==='roc'||proxy)?.25:.5)*sc;S.cost.civ.CN+=Math.round(60*sc);S.cost.dmg.CN+=.3*sc;S.stats.cn.strikes++;
  const HP=cnHitP({u}),IC=HP.IC,hit=stgFound(u)>0&&hitP(HP.p,'strikeStage');
  const itx=ROCLR.pk+' 枚，距離約 '+HP.km+' km'+(IC.I?'，共軍防空發射 '+Math.round(IC.I)+' 枚攔截彈，約 '+(Math.round(IC.surv*10)/10)+' 枚突破':'，共軍防空已失效')+'，命中率 '+Math.round(HP.p*100)+'%';
  const src=(L&&L.src)||S.units.find(x=>x.side==='def'&&(x.type==='hmr'||x.type==='ssm')&&alive(x))||TER[TAIPEI];
  fxq(by==='roc'?{t:'air',from:[src.c,src.r],at:[u.c,u.r],hit,tsea:false,k:'cm'}:{t:'air',src:'e',at:[u.c,u.r],hit,tsea:false});
  if(hit){u.sgN=Math.max(0,(u.sgN||0)-1);S.stats.cn.hits++;const nm=TYPES[u.type].n;damage(u,1,'縱深打擊（集結區）');
    log(who+'縱深打擊 '+hn(h)+' 集結中的 '+nm+'（'+itx+'；'+(u.sgL||'')+'）：命中，'+nm+' 損失 '+stpU(u,1));}
  else log(who+'縱深打擊 '+hn(h)+' 集結中的 '+TYPES[u.type].n+'（'+itx+'）：未命中（'+lastTxt()+'）');
  S.cnLog.push({t:S.turn,id:'stage',by,hit});checkInstant();
}
function strikeCN(id,by){
  if(typeof id==='string'&&id[0]==='u'){const u=S.units.find(x=>'u'+x.id===id);if(u)strikeStage(u,by);return;}
  const proxy=by==='US'&&usIdx()<2,B=CNB[id],P=S.pools,need=cnNeed(id);let who={roc:'台灣長程飛彈（雄二E）',US:proxy?'美軍（代理打擊）':'美軍',JP:'自衛隊'}[by];
  const sc=by==='roc'?ROCLR.pk/ROCLR.per:1; // 台灣：一包 4 枚＝0.16 點；美日仍是抽象點數
  if(by==='roc'){const L=lrSpend(cnHitP(id).km);if(!L){log('沒有射程到得了 '+B.n+' 的長程飛彈');S.dfire++;return;}who=lrWho(L);}
  S.retal+=((by==='roc'||proxy)?.25:.5)*sc;
  S.cost.civ.CN+=Math.round((B.kind==='stg'?120:B.kind==='navy'?90:B.kind==='air'?50:35)*sc);S.cost.dmg.CN+=(B.kind==='stg'?.5:.3)*sc;
  S.stats.cn.strikes++;
  const HP=cnHitP(id),IC=HP.IC,hit=hitP(HP.p,'strikeCN');let fx='';
  const itx=ROCLR.pk+' 枚，距離約 '+HP.km+' km'+(IC.I?'，共軍防空發射 '+Math.round(IC.I)+' 枚攔截彈，約 '+(Math.round(IC.surv*10)/10)+' 枚突破':'，共軍防空已失效')+'，命中率 '+Math.round(HP.p*100)+'%';
  fxq({t:'tfa',a:by==='roc'?'tw':by==='US'?(Math.random()<.5?'guam':'sea'):'sakishima',b:id,hit});
  if(hit){
    S.cn[id]--;S.stats.cn.hits++;if(!S.rec&&!reduce())(CNPEND[id]=CNPEND[id]||[]).push(Date.now()+6000);
    if(B.kind==='rf')fx='駐地與預備陣地受損，火箭軍發射能量下降（飛彈與機動發射車多已疏散，不在駐地）';
    else if(B.kind==='air'){fx='跑道與機堡受損，出擊架次下降';if(S.cn[id]<=1&&P.plaAir>0&&hitP(.5,'strikeCNair'))fx+='，地面戰機 −'+airLose('atk',4,'ground')+' 架（推估：強化機堡外）';}
    else if(B.kind==='isr')fx='指揮與偵察受損，共軍定位台灣目標的能力下降';
    else if(B.kind==='navy'){fx='港區設施受損';if(S.cn[id]<=0&&P.plaNavy>0){P.plaNavy--;fx+='，仍在港內的艦艇受創（攻方護航艦隊 −1，推估）';}}
    else{const us=S.units.filter(u=>u.side==='atk'&&hexOf(u).isl==='CN'),sh=us.filter(u=>u.type==='cvy'||u.type==='lst'||u.type==='ro');if(us.length){const u=pickBest(sh.length?sh:us,tgtVal);damage(u,1,'大陸集結區遭打擊');fx=TYPES[u.type].n+' 損失 '+stpU(u,1);}} // 港口裝載中的船團是最好打的目標，優先被打到
    if(S.cn[id]<=0)fx+=(fx?'，':'')+B.n+'已癱瘓';
  }
  S.cnLog.push({t:S.turn,id,by,hit});
  log(who+'縱深打擊 '+B.n+'（'+itx+'）'+(hit?'：命中'+(fx?'，'+fx:''):'：未命中（'+lastTxt()+'）'));
  checkInstant();
}
function aiPickCN(roc){ // 期望效果最高的目標（命中率 × 效果，±10% 雜訊）
  let best=null,bs=-1;
  const cand=cnTargets().map(id=>({k:id,tg:id})).concat(stgTargets().map(u=>({k:'u'+u.id,tg:{u}})));
  const DP=roc&&S.intent&&S.intent.deep,kd=tg=>tg.u?'stg':CNB[tg].kind,pref=tg=>!DP?1:DP==='stg'?(kd(tg)==='stg'||kd(tg)==='navy'?3:1):kd(tg)===DP?3:1; // 指揮官意圖「縱深打擊目標」：指定的種類優先（權重 ×3，只影響挑選順序）
  for(const c of cand){const H=cnHitP(c.tg);if(roc&&!lrWpn(H.km))continue;const v=H.p*cnValue(c.tg)*pref(c.tg)*(.9+Math.random()*.2);if(v>bs){bs=v;best=c.k;}} // 守方：只挑射程到得了的目標
  return best;
}
const allyCanStrike=f=>f.land&&fxActive(f)&&(f.c==='US'?S.fx.lv.US>=3&&usIdx()>=1:S.fx.lv.JP>=2&&S.fx.lv.US>=2);
// each eligible force rolls whether to strike the mainland this phase: US needs 4+, Japan 5+ (more wary of escalation)
// 美軍護航艦的戰斧：每艘有對地飛彈的護航艦每回合打一次（★4 枚）；先打攻方在台灣的固定目標（灘頭補給站、被占領的港口），沒有才打大陸基地
function tomahawkTargets(){
  const fob=S.units.filter(u=>u.side==='atk'&&u.type==='fob'),ports=PORTS.filter(k=>S.owner[k]==='atk'&&!S.portDown[k]);
  return {fob,ports};
}
async function usTomahawk(f){
  const sh=S.units.filter(e=>e.ally==='US'&&(isEsc(e)||e.type==='ssn'||e.type==='mdt')&&alive(e)&&e.mag&&e.mag.lam>=LAM.per);if(!sh.length)return false;
  for(const m of sh){if(S.over)return true;
    m.mag.lam-=LAM.per;const T=tomahawkTargets();
    if(T.fob.length||T.ports.length){
      const fob=T.fob.length?pickBest(T.fob,x=>x.hp):null,k=fob?null:T.ports[0],h=fob?hexOf(fob):TER[k],ok=hitP(pNeed(5),'tomahawk:island');
      fxq({t:'msl',from:[m.c,m.r],to:[h.c,h.r],hit:ok});
      if(ok){if(fob)damage(fob,1,'戰斧巡弋飛彈');else{S.portDown[k]=S.turn;}}
      log(uname(m)+'發射 '+LAM.per+' 枚戰斧巡弋飛彈攻擊 '+(fob?'灘頭補給站（'+hname(h)+'）':'被占領的 '+hname(h))+(ok?'：命中'+(fob?'':'，港口卸載停擺 2 回合'):'：未命中（'+lastTxt()+'）')+'（剩 '+m.mag.lam+' 枚）');
    }else{const id=aiPickCN();if(!id){m.mag.lam+=LAM.per;break;}log(uname(m)+'發射 '+LAM.per+' 枚戰斧巡弋飛彈縱深打擊（剩 '+m.mag.lam+' 枚）');strikeCN(id,'US');}
    render();await sleep(200);
  }
  return true;
}
async function alliedLandStrikes(mode){
  const pcs=mode!=='start',abs=mode!=='end';S._tomDone=false;if(pcs){const f=S.fx.units.find(x=>isCSG(x)&&csgPieceOf(x)&&fxActive(x))||(mdtPiece()&&S.fx.units.find(x=>x.id==='mdtf'&&fxActive(x)))||(ssnIndep()&&S.fx.units.find(x=>x.id==='ssn'&&fxActive(x)));const T=tomahawkTargets();if(f&&(T.fob.length||T.ports.length)&&!allyCanStrike(f)){S._tomDone=true;await usTomahawk(f);if(S.over)return;}} // 打台灣島上的攻方目標不涉及攻擊大陸
  for(const f of S.fx.units.filter(allyCanStrike)){
    const isPc=isCSG(f)&&csgPieceOf(f)||f.id==='mdtf'&&mdtPiece();if(isPc?(!pcs||allyHuman()):!abs)continue; // 玩家操作盟軍：棋子對大陸的戰斧由玩家決定，不自動打 // 玩家操作盟軍：棋子的打擊留到結束階段，其餘抽象部隊照舊
    const need=f.c==='US'?(usIdx()>=2?4:5):5,pa=pNeed(need);
    if(!hitP(pa,'allyStrike:'+f.id)){log(f.n+'評估縱深打擊：出手機率 '+Math.round(pa*100)+'%（固定規則），本回合按兵不動');continue;}
    log(f.n+'評估縱深打擊：出手機率 '+Math.round(pa*100)+'%（固定規則），決定出手');
    if(isCSG(f)&&csgPieceOf(f)||f.id==='mdtf'&&mdtPiece()){if(!S._tomDone){S._tomDone=true;await usTomahawk(f);if(S.over)return;}continue;} // 美航艦打擊群在地圖上：改用護航艦的戰斧實際庫存
    for(let i=0;i<f.land;i++){const id=aiPickCN();if(!id)return;strikeCN(id,f.c);render();await sleep(200);if(S.over)return;}
  }
}
async function aiCnStrikes(){
  while(S.dfire>0&&lrOK()&&!S.over){const id=aiPickCN(true);if(!id)break;S.dfire--;strikeCN(id,'roc');render();await sleep(250);}
}
function doRetaliation(){
  const n=Math.floor(S.retal);if(n<=0)return;S.retal-=n;
  for(let i=0;i<n;i++){
    const tg=S.fx.units.filter(f=>f.base!=='sea'&&f.hp>0&&fxActive(f)&&!(f.c==='US'&&usIdx()<2)&&!(f.id==='jmsdf'&&S.jmsOn)); // 海自艦隊出港後不在佐世保 // China avoids striking US units that are not openly at war
    if(!tg.length){S.fire++;if(S.fpk)S.fpk.g++;S.stats.retal.strikes++;log('中方報復：沒有可打擊的盟國部隊，本回合火力 +1');continue;}
    const lr=S.pools.plaLR>0;if(lr)S.pools.plaLR--;
    const f=pickBest(tg,x=>x.hp),b=f.base,B=BASES[b],need=Math.max(3,baseNeed(b)-(lr?1:0));
    Object.keys(BASE_TRIG[b]).forEach(c=>{if(setLevel(c,BASE_TRIG[b][c],'中方報復打擊'+B.n))S.stats.esc.push(B.n+'→'+CN[c]+LV[c][BASE_TRIG[b][c]]);});
    const ck=B.c==='JP'?'JP':b==='guam'?'US':null;
    if(ck){S.cost.civ[ck]+=60;S.cost.dmg[ck]+=.5;}
    S.stats.retal.strikes++;
    if(b==='guam')usRally();
    const ok=hitP(pNeed(need),'doRetaliation');
    fxq({t:'tfa',a:'yongan',b,hit:ok});
    if(ok){f.hp--;if(isCSG(f)&&f.hp<=0)usCarrierSunk('中方報復打擊'+B.n);S.stats.retal.hits++;log('中方報復打擊 '+B.n+(lr?'（東風-26／21D）':'')+' 命中 '+f.n+'（'+lastTxt()+'）'+(f.hp<=0?'，已失去戰力':''));}
    else log('中方報復打擊 '+B.n+' 未命中（'+lastTxt()+'）');
  }
}

// 演習掩護：借演習轉為攻擊。規模越大，預先部署越多，但規模太大，守方情報部門識破的機率也越高（識破後守方提早動員、第 1 回合防禦 +1）
const EXER={small:{n:'小規模演習',det:.15,navy:0,amph:0},mid:{n:'中規模演習',det:.45,navy:2,amph:0},huge:{n:'空前大規模演習',det:.85,navy:3,amph:1}};
function applyExercise(){
  const sc=EXER[($('#optExer')&&$('#optExer').value)||'small']||EXER.small,m=S.mods,out=[];
  S.exer={n:sc.n,det:false,navy:sc.navy};
  if(sc.navy){
    S.pools.plaNavy+=sc.navy;
    const cs=[[119.9,24.6],[120.1,24.0],[119.9,23.3],[120.2,25.0]].map(([lo,la])=>{const [c,r]=llToRC(lo,la);return TER[K(c,r)];}).filter(h=>h&&h.t==='sea');
    let n=0;for(const h of cs){if(n>=sc.navy||S.units.filter(u=>u.type==='dd').length>=10)break;if(unitsAt(h.k).length<STACK_MAX){S.units.push(mkUnit('atk','dd',h.k,{}));n++;}}
    out.push('演習期間護航艦隊 +'+sc.navy+'（已預先部署在海峽上）');
  }
  if(sc.amph){const h=placeNear(FK('3,3'),x=>x.isl==='CN'&&x.coastal);if(h)S.units.push(mkUnit('atk','amph',h.k,{zone:'central'}));out.push('戰前擴編 +'+sc.amph+' 兩棲旅');}
  S.exer.det=hitP(sc.det,'exerDetect');
  if(S.exer.det){
    m.defReinfDelay-=1;addTurns(m.defDef,1,1,1);out.push('守方情報部門察覺異常：後備提前 1 回合動員、第 1 回合防禦 +1');
    if(sc.navy>=2){const cs=S.fx.units.find(f=>f.id==='csg');if(cs)cs.delay=0;out.push('美軍航艦打擊群與偵察機提前前出（參戰即到場）');}
  }
  else out.push('守方研判為例行演習，沒有提前動員');
  return out;
}
// 開局前的演習序幕：地圖上畫出環台演習區，約 8 秒後轉為攻擊（可略過）
function exercisePrelude(){
  return new Promise(done=>{
    if(!S.exer||S.sim||S.video||S.rec||reduce()){done();return;}
    const g=document.getElementById('gF'),els=[],tm=[];
    const Z=[['A',[121.9,25.7]],['B',[123.0,25.1]],['C',[123.3,23.7]],['D',[122.4,22.1]],['E',[120.7,21.6]],['F',[119.6,22.7]],['G',[119.4,24.4]]];
    const pxy=([lo,la])=>{const [c,r]=llToRC(lo,la);return TER[K(c,r)]?cen(c,r):center(c,r);};
    Z.forEach(([nm,ll],i)=>{tm.push(setTimeout(()=>{const p=pxy(ll),e=document.createElementNS(SVGNS,'ellipse');e.setAttribute('cx',p[0]);e.setAttribute('cy',p[1]);e.setAttribute('rx',R*3.4);e.setAttribute('ry',R*2.4);e.setAttribute('fill','rgba(210,60,50,.16)');e.setAttribute('stroke','#d9534a');e.setAttribute('stroke-width','2');e.setAttribute('stroke-dasharray','7 5');g.appendChild(e);els.push(e);
      const t=document.createElementNS(SVGNS,'text');t.setAttribute('x',p[0]);t.setAttribute('y',p[1]+4);t.setAttribute('text-anchor','middle');t.setAttribute('class','fxt atk');t.textContent=nm+' 區';g.appendChild(t);els.push(t);},i*520));});
    const box=document.createElement('div');box.className='coach exer';box.setAttribute('role','status');
    const det=S.exer.det;
    box.innerHTML='<b>演習序幕 · '+TX(S.exer.n)+'</b><span id="exTxt">'+TX('共軍宣布在台灣周邊海空域實施聯合演習，劃設環台演習區，艦機群出港環島機動。')+'</span><button aria-label="'+TX('略過')+'" title="'+TX('略過')+'">✕</button>';
    document.body.appendChild(box);
    let fin=false;const end=()=>{if(fin)return;fin=true;tm.forEach(clearTimeout);els.forEach(e=>e.remove());box.remove();done();};
    box.querySelector('button').onclick=end;
    tm.push(setTimeout(()=>{const t=document.getElementById('exTxt');if(t)t.textContent=TX(det?'守方情報部門察覺異常：這次演習的規模與部署不尋常，後備部隊提前動員，美日也提高警戒、航艦與偵察機前出。':'守方研判為例行演習，沒有採取額外動員。');},4800));
    tm.push(setTimeout(()=>{const t=document.getElementById('exTxt');if(t)t.textContent=TX('演習結束的瞬間，艦艇與登陸部隊轉向台灣——演習轉為攻擊。');},6600));
    tm.push(setTimeout(end,8200));
  });
}
// 開戰月份與天候：台灣海峽的天候隨季節——10～3 月東北季風浪高（沒有颱風）、4～5 月較穩定、梅雨 5～6 月、7～9 月颱風季（沒有東北季風）。機率為依氣候特性的推估，每回合依該月機率抽天候
const MONTHWX={1:[.25,.40,.35],2:[.25,.40,.35],3:[.35,.40,.25],4:[.60,.28,.12],5:[.50,.32,.18],6:[.40,.35,.25],7:[.40,.30,.30],8:[.30,.33,.37],9:[.30,.33,.37],10:[.45,.32,.23],11:[.30,.40,.30],12:[.25,.40,.35]};
const MONTHN=['','1 月（東北季風）','2 月（東北季風）','3 月（東北季風尾聲）','4 月（春季窗口）','5 月（梅雨前後）','6 月（梅雨）','7 月（颱風季）','8 月（颱風季高峰）','9 月（颱風季高峰）','10 月（秋季窗口）','11 月（東北季風）','12 月（東北季風）'];
function applyMonth(){
  const mo=Math.max(1,Math.min(12,+($('#optMonth')&&$('#optMonth').value)||4)),m=S.mods;
  S.month=mo;m.wx=MONTHWX[mo].slice();m.wxT1=mo===4?'good':null;
  const out=['開戰月份：'+MONTHN[mo]+'；天候機率 良好 '+Math.round(m.wx[0]*100)+'%、普通 '+Math.round(m.wx[1]*100)+'%、惡劣 '+Math.round(m.wx[2]*100)+'%'];
  if(mo===10||mo===9)addTurns(m.fireAdd,1,1,mo===10?2:0);
  if(mo===12||mo<=2){m.defReinfDelay+=1;m.winter=true;out.push('冬季：守方動員延後 1 回合，外國反應較慢');}
  if(mo===10)out.push('秋季能見度佳：第 1 回合火力 +2');
  return out;
}
// 假設情境：預設全部關閉，雙方對稱；每項標明依據與代價，開啟後結算頁標示使用了哪些假設、停用難度評級
function applyWhatIf(){
  const v=id=>$(id)&&$(id).value==='1',m=S.mods,P=S.pools,out=[],tag=[];
  const addDD=n=>{const cs=[[119.9,24.6],[120.1,24.0],[119.9,23.3],[120.2,25.0],[120.0,22.7]].map(([lo,la])=>{const [c,r]=llToRC(lo,la);return TER[K(c,r)];}).filter(h=>h&&h.t==='sea');let k=0;for(const h of cs){if(k>=n||S.units.filter(u=>u.type==='dd').length>=10)break;if(unitsAt(h.k).length<STACK_MAX){S.units.push(mkUnit('atk','dd',h.k,{}));k++;}}};
  if(v('#optWiShip')){P.plaNavy+=2;P.plaCV=Math.min(4,P.plaCV+1);P.plaLst+=2;P.plaLift+=2;S.p0.plaLst=P.plaLst;S.p0.plaLift=P.plaLift;addDD(2);tag.push('砸鍋賣鐵加速造艦');out.push('護航艦隊 +2、航艦 +1、兩棲艦群 +2、滾裝船團 +2');}
  if(v('#optWiLift')){P.plaLst=99;P.plaLift=99;S.roReserve=0;S.p0.plaLst=99;S.p0.plaLift=99;tag.push('海運運力無限');out.push('登陸艦與運輸船不再限制增援（舊版假設）');}
  if(v('#optWiWx')){m.wx=[1,0,0];m.wxT1='good';tag.push('海象永遠適合登陸');out.push('天候固定良好');}
  if(v('#optWiDArms')){pAdd('rocAS',3);pAdd('rocAD',1);let hx;
    if(String(S.era)==='2026'){hmrSpread(S.units.filter(u=>u.side==='def'&&u.type==='hmr'&&alive(u)).reduce((a,u)=>a+u.veh0,0)+18);pAdd('rocAtc',20);S.p0.rocAtc+=20;hx='海馬士第二批 18 輛、陸軍戰術飛彈 20 枚提前到貨';} // 2026 年底前預定到貨的第二批
    else{pAdd('rocMsl',2);hx='長程飛彈 +2';} // 2027 年起海馬士已依交付期程計入，不另加
    tag.push('軍購準時到貨');out.push('守方反艦飛彈 +3、防空 +1、'+hx);}
  if(v('#optWiLocal')){pAdd('rocSub',1);pAdd('rocMsl',3);const pref=[SPOT.hualien,SPOT.kaohsiung],ports=Object.values(TER).filter(h=>h.isl==='TW'&&h.t==='port'&&S.owner[h.k]==='def').map(h=>h.k).sort((x,y)=>((pref.indexOf(x)+1)||9)-((pref.indexOf(y)+1)||9));for(const k of ports){if(unitsAt(k).length<STACK_MAX+1){S.units.push(mkUnit('def','hk',k,{tp:hkTp(),hm:HK_HM}));break;}}tag.push('國造武器提前量產');out.push('海鯤潛艦 +1、長程飛彈 +3');}
  if(v('#optWiAllies')){const cs=S.fx.units.find(f=>f.id==='csg');if(cs)cs.delay=0;tag.push('美日提前介入');out.push('美軍航艦打擊群提前到位');}
  S.sandbox=tag;if(tag.length)log('【假設情境】'+tag.join('、')+'：'+out.join('；')+'。');
  return out;
}
function applyBuildup(id){
  const m=S.mods;m.buildup=id;const out=[];
  if(id==='x_mass'){
    m.buildup='open';
    ['3,3','4,4','3,3'].forEach(k=>{const h=placeNear(FK(k),x=>x.isl==='CN'&&x.coastal);if(h)S.units.push(mkUnit('atk','amph',h.k,{zone:'central'}));});
    const h=placeNear(FK('3,3'),x=>x.isl==='CN');if(h)S.units.push(mkUnit('atk','arm',h.k));
    S.pools.plaNavy+=2;m.defReinfDelay-=2;addTurns(m.defDef,1,1,1);m.strikeMod+=1;hitMkt(3);
    S.fx.units.find(f=>f.id==='csg').delay=0;
    return ["攻方第一波 +3 兩棲旅、+1 重型旅，護航艦隊 +2", "守方後備提前 2 回合動員，第 1 回合防禦 +1", "美國航艦已在附近", "全球股市 −3"];
  }
  if(id==='open'){
    ['3,3','4,4'].forEach(k=>{const h=placeNear(FK(k),x=>x.isl==='CN'&&x.coastal);if(h)S.units.push(mkUnit('atk','amph',h.k,{zone:'central'}));});
    const h=placeNear(FK('3,3'),x=>x.isl==='CN');if(h)S.units.push(mkUnit('atk','arm',h.k));
    S.pools.plaNavy+=2;m.defReinfDelay-=1;m.strikeMod+=1;
    S.fx.units.find(f=>f.id==='csg').delay=0;
    out.push('攻方第一波 +2 兩棲旅、+1 重型旅，護航艦隊 +2','守方後備提前 1 回合動員','美國航艦已在附近待命（參戰即到場）','先制打擊的攔截擲骰 +1');
  } else if(id==='surprise'){
    let cut=0;S.units=S.units.filter(u=>{if(u.side==='atk'&&cut<2&&u.type==='amph'&&u.zone==='central'){cut++;return false;}return true;});
    const a=S.units.find(u=>u.side==='atk'&&u.type==='arm'&&u.c===2&&u.r===9);if(a)S.units=S.units.filter(u=>u!==a);
    S.pools.plaNavy-=2;m.defReinfDelay+=1;m.strikeMod-=1;
    out.push('攻方第一波 −2 兩棲旅、−1 重型旅，護航艦隊 −2','守方後備延後 1 回合動員','先制打擊的攔截擲骰 −1');
  } else{out.push('雙方都只有部分預警，維持基準設定');if(id==='exercise')out.push(...applyExercise());}
  return out;
}
const BUILDUP=[
  {id:'open',label:'公開全面集結',desc:'兵力最多，但數週的集結讓台、美、日提早準備。'},
  {id:'exercise',label:'演習掩護',desc:'以軍演名義集結，雙方都只有部分預警（基準設定）。'},
  {id:'surprise',label:'戰略突襲',desc:'兵力少一截，換取守方與盟國反應慢一拍。'},
  {id:"x_mass",x:1,label:"🔥 公開恫嚇式大集結",desc:"兵力大增（+3 兩棲旅、+1 重型旅、護航艦隊 +2）；守方提早 2 回合動員、第 1 回合防禦 +1，股市 −3。",ref:"2022 年 8 月圍台軍演"}];
function fxDice(c,esc){
  const rows={
    JP:[{min:1,max:2,label:'中立',desc:'不同意美軍從日本基地出擊',lv:0},{min:3,max:5,label:'後方支援',desc:'重要影響事態：美軍可使用日本基地',lv:1},{min:6,max:6,label:'全面參戰',desc:'存立危機事態：自衛隊投入作戰',lv:2}],
    US:[{min:1,max:1,label:'不介入',desc:'公開不介入，但台美共用的飛彈、魚雷難分誰發射：潛艦與轟炸機以代理打擊方式出手（火力約四成半）',lv:0},{min:2,max:3,label:'情報支援',desc:'擴大隱蔽支援與補給，守方反艦飛彈命中門檻 −1，代理打擊維持',lv:1},{min:4,max:5,label:'有限介入',desc:'「代理打擊」：以台灣、日本名義發射遠程飛彈，載人機艦不進入戰區，不承認參戰',lv:2},{min:6,max:6,label:'全面參戰',desc:'公開參戰：航艦、戰機、陸戰濱海團、多域特遣隊全數投入；傷亡過高時可能退縮',lv:3}]
  }[c];
  return {c,label:CN[c]+'的反應',rows,skip:()=>S.fxLock||S.fx.lv[c]>=rows[rows.length-1].lv,
    mod:()=>{const m=S.mods,p=[];let n=0;
      if(m.winter){n--;p.push('冬季奇襲 −1');}
      if(c==='US'&&S.fx.lv.JP>=1){n++;p.push('日本支援 +1');}
      if(esc){n++;p.push('戰事延長 +1');}
      return [n,p.join('、')];},
    onRow:r=>setLevel(c,r.lv,'擲骰')};
}
const FXSCEN={dice:'擲骰決定',interest:'依自身利益決定',intel:'只提供情報（不公開參戰）',none:'不介入（台灣孤軍）',full:'開戰即全面介入'};
function applyFxScenario(){
  if(S.fxScen==='full'){setLevel('JP',2,'開局情境');setLevel('US',3,'開局情境');}
  if(S.fxScen!=='dice'&&S.fxScen!=='interest')S.fxLock=true;
  log('參戰情境：'+FXSCEN[S.fxScen]+'。');
  if(S.fxScen==='none')log('美國立場：完全不介入（台灣孤軍情境）');
  else notePosture(S.fxScen==='full'?'開局情境':'開戰前即隱蔽提供情報與補給，不公開承認');
}
function fxSummary(){return ['美國：'+LV.US[S.fx.lv.US]+'；日本：'+LV.JP[S.fx.lv.JP],
  '出擊中的美日部隊：'+(S.fx.units.filter(f=>f.hp>0&&S.fx.lv[f.c]>=f.min&&(!f.needs||S.fx.lv[f.needs]>=1)).map(f=>f.n+(fxActive(f)?'':'（第 '+fxReady(f)+' 回合）')).join('、')||'無')];}

const EVENTS=[
 {id:'buildup',at:()=>[1,'atk'],title:'戰前集結',
  blurb:'渡海需要先集結船團、兵員與彈藥，這段時間很難完全隱藏。集結越公開、規模越大，台灣與美日越早察覺並開始準備。',
  choice:{who:'atk',options:BUILDUP},
  apply(c){return applyBuildup(c);}},
 {id:'timing',at:()=>[1,'atk'],title:'發起時機',
  blurb:'攻方必須選擇渡海的季節。台灣海峽每年只有春、秋兩個較穩定的窗口；冬季東北季風浪高，但守方較難預判。',
  choice:{who:'atk',options:[
   {id:'apr',label:'四月窗口',desc:'海象最穩定，第 1 回合必為好天氣。守方也最有防備。'},
   {id:'oct',label:'十月窗口',desc:'天氣稍差，但秋季能見度佳，第 1 回合火力 +2。'},
   {id:'winter',label:'冬季奇襲',desc:'東北季風、壞天氣多；守方動員延後一回合，外國反應也較慢。'},
   {id:"x_typhoon",x:1,label:"🔥 颱風季強渡",desc:"第 1 回合必為惡劣天氣（火力 −2、海上移動 2）；守方第 1 回合攻擊 −1、動員延後 1 回合。高變異。",ref:"1949 年古寧頭戰役"},
   {id:"x_politic",x:1,label:"🔥 政治節點發動",desc:"守方社會韌性判定 −1。",ref:"2024 年「聯合利劍」演習"}]},
  apply(c){
   const m=S.mods;
   if(c==='x_typhoon'){m.wx=[.1,.2,.7];m.wxT1='bad';addTurns(m.defAtk,1,1,-1);m.defReinfDelay+=1;return ["第 1 回合必為惡劣天氣", "守方第 1 回合攻擊 −1、動員延後 1 回合"];}
   if(c==='x_politic'){m.wx=[.5,.3,.2];m.wxT1='good';m.resBonus-=1;return ["守方社會韌性判定 −1", "天候機率：良好 50%、普通 30%、惡劣 20%"];}
   if(c==='apr'){m.wx=[.65,.25,.1];m.wxT1='good';return ['天候機率：良好 65%、普通 25%、惡劣 10%','第 1 回合天候良好'];}
   if(c==='oct'){m.wx=[.5,.3,.2];m.wxT1='good';addTurns(m.fireAdd,1,1,2);return ['天候機率：良好 50%、普通 30%、惡劣 20%','第 1 回合火力 +2'];}
   m.wx=[.3,.4,.3];m.wxT1=null;m.defReinfDelay+=1;m.winter=true;
   return ['天候機率：良好 30%、普通 40%、惡劣 30%（第 1 回合也要擲）','守方後備動員延後 1 回合','之後的攔截擲骰與美日參戰擲骰對攻方有利 1 點'];
  }},
 {id:'strike',at:()=>[1,'atk'],title:'先制打擊',
  blurb:'開戰第一波飛彈與空襲。攻方選擇打擊重點，實際效果取決於守方的防空、戰機、預警與備戰配置（不擲骰），這是攻方無法掌控的。',
  choice:{who:'atk',options:[
   {id:'ssm',label:'反艦飛彈陣地',desc:'削弱守方岸置反艦飛彈，讓船團渡海更安全。'},
   {id:'c2',label:'指揮與通信',desc:'癱瘓守方指揮，使守方機動部隊無法調動。'},
   {id:'air',label:'機場與防空',desc:'摧毀守方空軍與防空，換取後續回合的火力。'},
   {id:'okinawa',hide:()=>S.fxScen==='none'||S.fxScen==='intel',label:'沖繩美日基地',desc:'先打掉嘉手納等基地的戰機，但日本與美國會立即全面參戰。'},
   {id:"x_decap",x:1,label:"🔥 斬首打擊（指揮核心）",desc:"依判定：成功則守方機動部隊第 1～3 回合無法調動、社會韌性 −1；部分成功癱瘓 2 回合；失敗則沒有效果。平民傷亡 +50%。",ref:"「斬首行動」討論；2022 年基輔機場機降"},
   {id:"x_saturate",x:1,label:"🔥 飽和耗盡",desc:"第 1 回合火力 +4；之後火箭軍、巡弋與高超音速存量大減；平民傷亡 +50%。",ref:"飽和攻擊思維"}]},
  dice:[{label:'守方與盟國的防空攔截、預警',det:c=>{ // 不擲骰：依守方的實際配置判定（1～6，越高越容易被攔截）
    const m=S.mods,P=S.pools,w=[];let n=3;
    if(P.rocAD>=7){n+=2;w.push('守方防空充足 +2');}else if(P.rocAD>=5){n++;w.push('守方防空較強 +1');}else if(P.rocAD<=3){n--;w.push('守方防空薄弱 −1');}
    if(m.buildup==='open'){n++;w.push('攻方公開集結，預警充分 +1');}else if(m.buildup==='surprise'){n--;w.push('戰略突襲，預警有限 −1');}
    if(m.decoy){n++;w.push('飛彈車分散、誘餌 +1');}
    if(P.rocAir>=5){n++;w.push('守方戰機充足 +1');}else if(P.rocAir<=2){n--;w.push('守方戰機不多 −1');}
    if(c==='okinawa'){n++;w.push('美日基地防空嚴密 +1');}
    return [Math.max(1,Math.min(6,n)),w.join('；')||'依守方配置'];},rows:[
   {min:1,max:2,label:'攔截失敗',desc:'打擊大致奏效'},
   {min:3,max:4,label:'部分攔截',desc:'效果打折'},
   {min:5,max:6,label:'大多被攔截',desc:'效果有限'}],
   mod:()=>{const m=S.mods,p=[];let n=0;if(m.winter){n--;p.push('冬季奇襲 −1');}if(m.strikeMod){n+=m.strikeMod;p.push((m.strikeMod>0?'公開集結 +1':'戰略突襲 −1'));}return [n,p.join('、')];}}],
  apply(c,rows){
   const m=S.mods,row=rows[0],lv=row.min===1?2:row.min===3?1:0,P=S.pools;
   if(c==='okinawa'){S.cost.civ.JP+=[40,120,250][lv];S.cost.dmg.JP+=[.5,1.5,3][lv];}
   else {S.cost.civ.TW+=[150,400,800][lv];S.cost.dmg.TW+=[.8,2,4][lv];}
   if(c==='ssm'){ // 先制打擊反艦飛彈：也要先定位。開戰前的定位機率依預警（★公開集結 30%、演習掩護 50%、戰略突襲 70%：預警越少，越多發射車還在平時駐地），誘餌 ×0.75；
    // 每個單位挨 ★1／3／5 個打擊包（依判定結果），定位後每包（4 枚彈道飛彈）命中 87%，命中依毀傷分級影響 1 輛
    const ss=S.units.filter(u=>u.side==='def'&&u.type==='ssm');const out=[];
    const pl=({open:.3,exercise:.5,surprise:.7}[S.mods.buildup]||.5)*(S.mods.decoy?KLOC.decoy:1),att=[1,3,5][lv],pk={k:'s',n:MSL.srbmPer};
    for(const u of ss){if(!alive(u))continue;let fd=takeInt(pl*u.veh,'preLocN'),hits=[];const f0=fd;for(let i=0;i<att&&alive(u)&&fd>0;i++){if(hitP(lchKillP(pk),'preKill')){fd--;hits.push(ssmHit(u,'先制打擊'));}}
      out.push(hname(hexOf(u))+' 反艦飛彈：挨 '+att+' 波、找到 '+f0+' 輛'+(hits.length?'，'+hits.join('；'):'，沒有損失'));}
    out.push('（開戰前定位機率 '+Math.round(pl*100)+'%，依預警與誘餌；推估）');
    return ss.length?out:['沒有可打擊的飛彈陣地'];
   }
   if(c==='x_decap'){const F=["平民傷亡 +50%", "斬首成功：守方機動部隊第 1～3 回合無法調動，社會韌性 −1", "部分成功：守方機動部隊第 1～2 回合無法調動", "斬首失敗：指揮核心未受影響"];m.civMul*=1.5;const o=[F[0]];
      if(lv===2){m.defFreeze[1]=m.defFreeze[2]=m.defFreeze[3]=true;m.c2Strong=true;o.push(F[1]);}
      else if(lv===1){m.defFreeze[1]=m.defFreeze[2]=true;o.push(F[2]);}
      else{o.push(F[3]);}
      return o;}
    if(c==='x_saturate'){const F=["第 1 回合火力 +4", "火箭軍與巡弋存量大減、高超音速用盡", "平民傷亡 +50%"];addTurns(m.fireAdd,1,1,4);P.rf=Math.floor(P.rf*.4);P.plaCM=0;P.plaHS=0;m.civMul*=1.5;return F;}
   if(c==='c2'){
    if(lv===2){m.defFreeze[1]=m.defFreeze[2]=true;m.c2Strong=true;return ['守方機動部隊第 1、2 回合無法調動（仍可就地反擊）','之後的社會韌性擲骰 −1'];}
    if(lv===1){m.defFreeze[1]=true;return ['守方機動部隊第 1 回合無法調動'];}
    addTurns(m.defAtk,1,1,-1);return ['守方第 1 回合攻擊 −1'];
   }
   if(c==='air'){
    const a=[30,15,15][2-lv],d=[2,1,0][2-lv];const la=airLose('def',a*gndMul(),'ground');P.rocAD=Math.max(0,P.rocAD-d); // ★地面被毀架數：攔截失敗 30 架、其餘 15 架（多數在強化機堡與山洞機庫）
    addTurns(m.fireAdd,1,1,lv);
    return ['守方戰機在地面被毀 −'+la+' 架（推估）'+(d?'、防空 −'+d:''),lv?'第 1 回合火力 +'+lv:'火力沒有額外加成'];
   }
   const upJ=setLevel('JP',2,'沖繩遭先制打擊'),upU=setLevel('US',3,'駐日美軍遭先制打擊');
   const hitU=(id,n)=>{const f=S.fx.units.find(x=>x.id===id);f.hp=Math.max(0,f.hp-n);return f.n+' −'+n;};
   const out=lv===2?[hitU('kadena',2),hitU('usmc',1),hitU('jasdf',1)]:lv===1?[hitU('kadena',1),hitU('jasdf',1)]:[hitU('kadena',1)];
   return out.concat(upJ?['日本：全面參戰']:[],upU?['美國：全面參戰']:[]);
  }},
 {id:'mobilize',at:()=>[2,'def'],title:'動員與社會韌性',
  blurb:'守方發布動員令並決定兵力重點。電網、網路與交通遭破壞後社會能否維持運作，則不是政府能完全掌控的。',
  choice:{who:'def',options:[
   {id:'full',label:'全面動員',desc:'每一梯次後備旅多 1 個。'},
   {id:'capital',label:'首都要塞化',desc:'台北守軍防禦 +1，直到推演結束。'},
   {id:'mobile',label:'機動反擊',desc:'所有裝甲旅攻擊 +1，直到推演結束。'},
   {id:"x_total",x:1,label:"🔥 戰時總動員、開放私人武器",desc:"每一梯次後備旅 +2；第 2～4 回合守方攻擊 −1、防空 −1，平民傷亡 +30%。",ref:"瑞士、以色列式民兵"},
   {id:"x_cap2",x:1,label:"🔥 首都決戰",desc:"台北守軍防禦 +2；其他地區第 2～6 回合守方防禦 −1。",ref:"1937 年南京保衛戰"}]},
  dice:[{label:'社會韌性（電網、網路、交通遭破壞後）',rows:[
   {min:1,max:1,label:'電網癱瘓',desc:'後備旅減半，守方第 2～3 回合攻擊 −1'},
   {min:2,max:3,label:'動員延遲',desc:'後備旅延後 1 回合到達'},
   {min:4,max:5,label:'運作正常',desc:'沒有額外影響'},
   {min:6,max:6,label:'全民團結',desc:'守方第 2～3 回合防禦 +1'}],
   mod:()=>{const n=(S.mods.c2Strong?-1:0)+(S.mods.resBonus||0);return [n,(S.mods.c2Strong?'指揮通信遭重創 −1':'')+(S.mods.resBonus?(S.mods.c2Strong?'、':'')+'戰時管制 '+(S.mods.resBonus>0?'+':'')+S.mods.resBonus:'')];}}],
  apply(c,rows){
   const m=S.mods,row=rows[0],out=[];
   if(c==='full'){m.defReinfExtra=1;out.push('每一梯次後備旅 +1');}
   else if(c==='x_total'){m.defReinfExtra=Math.min(4,m.defReinfExtra+2);addTurns(m.defAtk,2,4,-1);m.civMul*=1.3;pAdd('rocAD',-1);out.push(...["每一梯次後備旅 +2（總加成上限 +4）", "守方第 2～4 回合攻擊 −1、防空 −1", "平民傷亡 +30%"]);}
   else if(c==='x_cap2'){m.taipeiFort=2;addTurns(m.defDef,2,6,-1);out.push(...["台北守軍防禦 +2", "守方第 2～6 回合防禦 −1"]);}
   else if(c==='capital'){m.taipeiFort=1;out.push('台北守軍防禦 +1');}
   else {m.tankAtk=1;out.push('裝甲旅攻擊 +1');}
   if(row.min===1){m.defReinfHalve=true;addTurns(m.defAtk,2,3,-1);out.push('後備旅減半','守方第 2～3 回合攻擊 −1');}
   else if(row.min===2){m.defReinfDelay+=1;out.push('後備旅延後 1 回合到達');}
   else if(row.min===6){addTurns(m.defDef,2,3,1);out.push('守方第 2～3 回合防禦 +1');}
   else out.push('社會運作正常');
   return out;
  }},
 {id:'foreign',at:()=>[3,'atk'],title:'各國參戰判斷',auto:true,
  blurb:'戰事進入第三回合。日本、美國依序判斷是否參戰：日本決定美軍能否使用日本基地，美國的決定會參考日本的態度。',
  dice:[fxDice('JP'),fxDice('US')],
  apply(){return fxSummary();}},
 {id:'escalate',at:()=>[5,'atk'],title:'戰事延長',auto:true,
  blurb:'戰事拖過兩天，國際壓力與傷亡持續升高。還沒全面參戰的國家重新評估，參戰程度只會提高、不會降低。時間越久，越傾向介入。',
  dice:[fxDice('JP',1),fxDice('US',1)],
  apply(){return fxSummary();}},
 {id:'final',at:T=>[T,'atk'],title:'最後攻勢',
  blurb:'判定回合到了。攻方指揮官要決定最後一回合是傾全力奪取目標，還是守住已經拿到的戰果。',
  choice:{who:'atk',options:[
   {id:'allin',label:'孤注一擲',desc:'本回合攻方攻擊 +1、火力 +3，但防禦 −1。'},
   {id:'hold',hide:()=>{const a=snap();return !(a.ports>0||a.taipei||a.as>0);},label:'鞏固戰果',desc:'本回合攻方防禦 +1，守住已佔領的目標。（尚未登陸、沒有戰果時不提供）'},
   {id:"x_all",x:1,label:"🔥 不惜代價",desc:"本回合攻擊 +2、火力 +4（消耗火箭軍存量 −3），防禦 −2；平民傷亡 +50%、股市 −4。",ref:"〈愚公移山〉"},
   {id:'ai',hide:()=>REC.quiet||S.sim||S.video||S.ctrl.atk!=='human',label:'改由電腦接手指揮',desc:'你不再親自操作攻方，之後的回合由電腦指揮攻方（守方設定不變）。本回合比照「孤注一擲」：攻擊 +1、火力 +3、防禦 −1。'}]},
  apply(c){
   const m=S.mods,t=S.turn;
   if(c==='x_all'){addTurns(m.atkAtk,t,t,2);addTurns(m.fireAdd,t,t,4);pAdd('rf',-3);addTurns(m.atkDef,t,t,-2);m.civMul*=1.5;hitMkt(4);return ["攻方本回合攻擊 +2、火力 +4（消耗火箭軍存量 −3）", "攻方本回合防禦 −2", "平民傷亡 +50%、全球股市 −4"];}
   if(c==='ai'){
    S.ctrl.atk='ai';addTurns(m.atkAtk,t,t,1);addTurns(m.fireAdd,t,t,3);addTurns(m.atkDef,t,t,-1);
    return ['攻方改由電腦指揮','攻方本回合攻擊 +1、火力 +3','攻方本回合防禦 −1'];
   }
   if(c==='allin'){addTurns(m.atkAtk,t,t,1);addTurns(m.fireAdd,t,t,3);addTurns(m.atkDef,t,t,-1);return ['攻方本回合攻擊 +1、火力 +3','攻方本回合防禦 −1'];}
   addTurns(m.atkDef,t,t,1);return ['攻方本回合防禦 +1'];
  }}
];
const hitMkt=n=>{S.cost.mkt=Math.max(-35,S.cost.mkt-n);};
function razeAllPorts(){PORTS.forEach(k=>{S.portDown[k]=1e3;});} // 焦土：港口永久無法使用
function hitCNUnits(n,why){const t=S.units.filter(u=>u.side==='atk'&&(u.type==='amph'||u.type==='arm')&&hexOf(u).isl==='CN').slice(0,n);t.forEach(u=>damage(u,1,why));return t.length;}
const pAdd=(k,v)=>{if(S.pools)S.pools[k]=Math.max(0,(S.pools[k]||0)+v);};
