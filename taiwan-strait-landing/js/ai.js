'use strict';
/* ---------- AI ---------- */
function landDist(sources){
  const dist={};const q=[];
  sources.forEach(k=>{dist[k]=0;q.push(k);});
  while(q.length){
    q.sort((a,b)=>dist[a]-dist[b]);const k=q.shift();const h=TER[k];
    for(const n of nbrs(h.c,h.r)){if(!isLand(n))continue;const nd=dist[k]+(n.t==='mtn'?2:1);if(dist[n.k]===undefined||nd<dist[n.k]){dist[n.k]=nd;q.push(n.k);}}
  }
  return dist;
}
const OBJ=[TAIPEI].concat(PORTS);
const OBJD={};OBJ.forEach(k=>OBJD[k]=landDist([k]));
function est(u,t){return effAtk(u)+support(u,t)+seaPen(u)-(effDef(t)+terrDef(hexOf(t)))+(TYPES[t.type].hp-t.hp)*.5;}
async function aiTryAttack(u,thr,focus){
  if(!alive(u)||S.over)return false;
  let ts=targets(u);
  ts=ts.filter(t=>hexOf(t).isl!=='KM'); // 金門、馬祖已無駐軍，雙方都無視
  if(!ts.length)return false;
  let best=null,bs=-99,braw=-99;
  for(const t of ts){const e=est(u,t),f=focus&&focus.includes(hexOf(t).k),adj=e+(f?3:0);if(adj>bs){bs=adj;best=t;braw=e+(f?2:0);}}
  if(braw>=thr){attack(u,best);render();await sleep(380);return true;}
  return false;
}
function enemyAdj(k,side){const h=TER[k];return ring2(h).reduce((a,n)=>a+unitsAt(n.k).filter(e=>e.side!==side&&canHitSub(e)).length,0);}
function minD(k,list){const h=TER[k];return Math.min.apply(null,list.map(x=>hd(h,TER[x])));}
async function runAI(side){
  S.busy=true;render();await sleep(500);
  try{ if(side==='atk')await aiAtk();else await aiDef(); }catch(e){console.error(e);}
  S.busy=false;
  if(!S.over){await sleep(250);endPhase();}
}
// Attacker AI picks one landing zone for the whole game so the force lands together instead of piecemeal.

// 攻擊計畫（可多選軸線）：集中兵力有突擊效果，軸線越多越分散
function applyPlan(){
  const N=$('#optAxN').value==='1',C=$('#optAxC').value==='1',P=$('#optAxP').value!=='0',PF=$('#optAxP').value==='2',m=S.mods;
  let isl=[];if(N)isl.push('north');if(C)isl.push('central');
  if(!isl.length)isl=[aiPlan().zone];
  S.plan={zone:isl[0],axes:isl,penghu:P,pfirst:PF};
  // 集中到單一軸線：所有本島登陸單位改派該軸線；兩條軸線則維持北、中各一半
  if(isl.length===1)S.units.forEach(u=>{if(u.side==='atk'&&(u.zone==='north'||u.zone==='central'))u.zone=isl[0];});
  if(!P)S.units.forEach(u=>{if(u.side==='atk'&&u.zone==='penghu')u.zone=isl[0];});
  const load=isl.length+(P?.5:0);
  const out=[];
  if(load<=1.5){addTurns(m.atkAtk,1,3,1);out.push('集中突擊：第 1～3 回合攻方攻擊 +1');}
  else if(load>=3.5){addTurns(m.atkAtk,1,3,-1);out.push('兵力分散於多條軸線：第 1～3 回合攻方攻擊 −1');}
  else out.push('兩條軸線並進：沒有集中突擊的加成');
  log('攻擊計畫：'+isl.map(z=>z==='north'?'北部':'中部').join('＋')+(P?'＋澎湖':'')+'。'+out.join('；'));
}
function aiPlan(){
  if(S.plan&&S.plan.axes)return S.plan;
  if(S.plan)return S.plan;
  let best='central',bs=1e9;
  for(const z of ['north','central']){
    let s=0;
    // defenders near the beaches, anti-ship missiles covering the approach, minus the victory objectives within reach
    for(const d of S.units)if(d.side==='def'&&onTW(d)&&!isMsl(d)&&ZONES[z].some(k=>hd(TER[k],hexOf(d))<=kmH(80)))s+=d.hp*(effDef(d)+terrDef(hexOf(d)));
    s+=S.units.filter(d=>d.side==='def'&&isMsl(d)&&d.type!=='hmr'&&d.type!=='mlrs'&&ZONES[z].some(k=>hd(TER[k],hexOf(d))<=kmH(160))).reduce((a,d)=>a+d.hp*4,0);
    s-=OBJ.filter(o=>ZONES[z].some(k=>hd(TER[k],TER[o])<=kmH(120))).length*12;
    s+=Math.random()*2;
    if(s<bs){bs=s;best=z;}
  }
  S.plan={zone:best};if(S.ctrl.def!=='human')log('攻方主登陸區：'+(best==='north'?'北部（林口、桃園）':'中部（新竹、苗栗、台中港）'));
  return S.plan;
}
function friendAdj(k,side){const h=TER[k];let n=0;for(const x of ring2(h)){const us=unitsAt(x.k).filter(u=>u.side===side&&isLand(x));if(us.length)n+=us.length;else if(x.isl==='TW'&&S.owner[x.k]===side)n+=.3/3;}return n;}
function ssmThreat(k){const h=TER[k];return S.units.filter(d=>d.side==='def'&&isMsl(d)&&d.type!=='hmr'&&d.type!=='mlrs'&&hd(hexOf(d),h)<=kmH(160)).length;}
async function aiAtk(){
  if(shelterNeeded('atk')&&S.ctrl.atk!=='human'||shelterNeeded('atk')&&S.simAuto){if(!(S.shelterDone&&S.shelterDone.atk===S.turn)){S.shelterDone=S.shelterDone||{};S.shelterDone.atk=S.turn;shelterOrder('atk');}}
  const plan=aiPlan();
  const IT=S.intent||{};
  S.units.forEach(u=>{if(u.side==='atk'&&(u.type==='amph'||u.type==='mar')&&u.zone!=='penghu')u.zone=(IT.axis==='north'||IT.axis==='central')?IT.axis:plan.zone;}); // 澎湖軸線的陸戰旅保留原任務（原本每回合被改派到本島）
  aiBaseStrikes();render();
  { // 火力打擊：整波一起放（先算完、一次繪製），特效同時升空，比逐發等待快得多
    let n=0;
    let afN=0;
    for(const id in FAC)if(S.turn<=3)for(let i=0;i<2&&facUp(id)&&S.fire>0&&!S.over;i++){if(strikeFac(id)===false)break;n++;} // 開局打固定雷達站（★每站每回合 2 包，第 1～3 回合）
    { // 澎湖軸線：整波火力先撥一部分打澎湖守軍（★同時進攻 25%、先取澎湖 60%），直到拿下馬公
      let pn=S.plan&&S.plan.penghu&&S.owner[MAGONG]!=='atk'?Math.round(S.fire*(penghuFirst()?.6:.25)):0;
      while(pn>0&&S.fire>0&&!S.over){const ts=S.units.filter(d=>d.side==='def'&&alive(d)&&strikeable(d)&&hexOf(d).isl==='PH');if(!ts.length)break;const t=pickBest(ts,d=>(d.type==='ssm'?2:0)+(TYPES[d.type].hp-d.hp)+Math.random());if(strike(t)===false)break;n++;pn--;}
    }
    while(S.fire>0&&!S.over){const t=pickStrike(),af=afN<12?pickAirfield():null;if(af&&(!t||af.sc>(t._sc||0))){if(!strikeAirfield(af.k))break;n++;afN++;continue;}if(!t)break;if(strike(t)===false)break;n++;} // 剩下的火力打不到（例如只剩長程火箭、目標在射程外）就停
    if(n){render();await sleep(Math.min(1500,500+n*90));}
  }
  const rank=u=>{const h=hexOf(u);return h.isl==='TW'||h.isl==='PH'?0:h.t==='sea'?1:2;};
  const order=S.units.filter(u=>u.side==='atk').sort((a,b)=>rank(a)-rank(b));
  for(const u of order){if(S.over)return;if(alive(u))await aiAtkUnit(u);}
  if(aiScreen())render();
}
// 電腦攻方：船團編隊——海上的運輸船、登陸艦與載旅船艇不在任何防空艦涵蓋內時，把還沒行動的護航艦開到能涵蓋它的位置
function aiScreen(){
  let n=0;
  for(const t of S.units.filter(x=>x.side==='atk'&&atSea(x)&&alive(x)&&(x.type==='lst'||x.type==='ro'||x.type==='cvy'||!isShip(x)))){
    if(adCover(t).length)continue;
    const ds=S.units.filter(e=>e.side==='atk'&&e.type==='dd'&&alive(e)&&!e.moved&&!e.acted).sort((a,b)=>hd(hexOf(a),hexOf(t))-hd(hexOf(b),hexOf(t)));
    for(const e of ds){let best=null,bd=1e9;for(const [k,v] of reach(e)){if(v.kind!=='sail')continue;const d=hd(TER[k],hexOf(t));if(d<=DDW.adR&&d<bd){bd=d;best=k;}}if(best){doMove(e,best,'sail');n++;break;}}
  }
  return n;
}
// 集中火力準備：每個攻方階段選定一個登陸地段（主攻區內守軍最少的可登陸灘頭與相鄰灘頭），整波火力優先打那一段 1 格內的守軍
// 先取澎湖：攻方選「先取澎湖再攻本島」、馬公還沒拿下、第 6 回合以前
const penghuFirst=()=>!!(S.plan&&S.plan.pfirst&&S.owner[MAGONG]!=='atk'&&S.turn<=6);
const beachOK=h=>h&&h.isl==='TW'&&isLand(h)&&h.coastal&&!h.cliff&&!h.mud&&h.t!=='mtn'&&h.k!==TAIPEI;
function prepSector(){
  const key=S.turn+S.phase;if(S.prep&&S.prep.k===key)return S.prep.hs;
  const pf=penghuFirst(),hold=!pf&&S.units.some(u=>u.side==='atk'&&onTW(u)&&!isShip(u)),zone=pf?'penghu':(S.intent&&(S.intent.axis==='north'||S.intent.axis==='central')?S.intent.axis:aiPlan().zone);
  let hs=[];
  if(!hold||S.turn<=3){
    const defs=S.units.filter(e=>e.side==='def'&&onTW(e)&&alive(e));
    const cand=zone==='penghu'?Object.values(TER).filter(h=>h.isl==='PH'&&isLand(h)&&h.coastal&&!h.cliff&&h.t!=='mtn'):(ZONES[zone]||[]).map(k=>TER[k]).filter(beachOK);
    let best=null,bs=1e9;for(const h of cand){const v=defs.reduce((a,e)=>a+(hd(hexOf(e),h)<=kmH(20)?e.hp:0),0);if(v<bs){bs=v;best=h;}}
    if(best)hs=[best].concat(nbrs(best.c,best.r).filter(beachOK));
  }
  S.prep={k:key,hs};return hs;
}
function pickAirfield(){ // 電腦攻方：開局壓制機場（守方空軍還在、機場還沒癱瘓者優先）
  if(!S.pools.rocAir||afShare()<=0)return null;let best=null,bs=-9;
  for(const h of airfields()){const lv=afLevel(h.k);if(lv>=3||S.owner[h.k]==='atk')continue;const sc=Math.random()*1.5+(S.turn<=2?16:8)+(S.airCtl==='atk'?-3:0)-lv*2.5;if(sc>bs){bs=sc;best=h.k;}}
  return best?{k:best,sc:bs}:null;
}
function pickStrike(){
  const prep=prepSector(),atkLand=S.units.filter(u=>u.side==='atk'&&(onTW(u)||hexOf(u).isl==='PH')),atkSea=S.units.filter(u=>u.side==='atk'&&atSea(u)&&!isShip(u));
  const zoneKs=[].concat(ZONES.north,ZONES.central);
  let best=null,bs=-1;
  for(const d of S.units){
    if(d.side!=='def'||!canHitSub(d))continue;const h=hexOf(d);
    if(isGnd(d)&&gFound(d)<=0)continue; // 地面旅：本階段沒找到任何營
    if(isLch(d)&&lchFound(d,'bm')<=0)continue; // 發射車：本階段偵察沒找到、或找到的都打過了——看不到的目標排不進打擊清單 // 海上的潛艦打不到；港內補給中的潛艦是固定目標
    const subBonus=d.type==='hk'?4:0;
    if(h.isl==='KM')continue; // 金馬無駐軍，雙方無視
    let s=Math.random()+subBonus;
    if(d.type==='ssm')s+=9;else if(d.type==='ff')s-=3;
    if(atkLand.some(a=>hd(hexOf(a),h)<=kmH(40)))s+=7+(TYPES[d.type].hp-d.hp);
    else if(!isMsl(d)&&atkSea.some(a=>hd(hexOf(a),h)<=kmH(40)))s+=6; // 登陸前火力準備：海上的登陸部隊附近（預定灘頭）的守軍
    if(prep.some(p=>hd(p,h)<=kmH(20)))s+=20; // 集中火力準備：選定的登陸地段
    if(S.plan&&S.plan.penghu&&S.owner[MAGONG]!=='atk'&&h.isl==='PH')s+=penghuFirst()?30:12; // 澎湖軸線：開局就打澎湖守軍（路透社：澎湖會在第一波遭打擊）
    if(OBJ.includes(h.k))s+=2;
    if(zoneKs.some(k=>hd(TER[k],h)<=kmH(40)))s+=3;
    { const IT=S.intent||{};
      if(IT.fire==='ssm'&&(d.type==='ssm'||d.type==='hmr'))s+=30;
      if(IT.fire==='reserve'&&(d.type==='tank'||d.type==='res'))s+=30;
      if((IT.axis==='north'||IT.axis==='central')&&ZONES[IT.axis].some(k=>hd(TER[k],h)<=kmH(60)))s+=8; }
    if(h.t==='city'||h.t==='mtn')s-=2;
    if(s>bs){bs=s;best=d;}
  }
  if(best)best._sc=bs;
  return best;
}
async function aiAtkUnit(u){
  if(isEsc(u)){if(escTargets(u).length){escAutoFire('atk');render();await sleep(240);}return;} // 護航艦：移動跟著航艦，只負責開火（協同齊射）
  if(isSup(u)||u.type==='lst'||u.type==='ro')return; // 補給船團、補給站與運輸船由補給與運力系統自動處理
  const h=hexOf(u);
  if(u.type==='cv'&&cvOOA(u)){ // 失去戰鬥能力：遠離守方威脅、往大陸撤離
    const th=S.units.filter(e=>e.side==='def'&&(e.fl||e.type==='ssm'||e.type==='csg'||isEsc(e))&&alive(e));let best=null,bs=-1e9;
    for(const [k,v] of reach(u)){if(v.kind!=='sail')continue;const t=TER[k],sc=(th.length?Math.min(...th.map(e=>hd(t,hexOf(e)))):0)-t.c*.5;if(sc>bs){bs=sc;best=k;}}
    if(best){doMove(u,best,'sail');render();await sleep(240);}return;
  }
  if(u.type==='cv'){ // 航艦群：在東岸海域游弋，遇到岸置飛彈威脅就向外海退
    const rc=reach(u),others=S.units.filter(x=>x.type==='cv'&&x!==u);let best=null;
    const sc=(k)=>ssmThreat(k)*3+others.reduce((a,x)=>a+Math.max(0,kmH(140)-hd(TER[k],hexOf(x))),0)*.6+Math.abs(TER[k].c-31)*.15+cvAggr(u,TER[k]);
    let bs=sc(h.k)-.6;
    for(const [k,v] of rc){if(v.kind!=='sail')continue;const t=sc(k)+Math.random()*.8;if(t<bs){bs=t;best=k;}}
    if(best){doMove(u,best,'sail');render();await sleep(240);}
    return;
  }
  if(u.type==='dd'){ // 護航艦：貼近己方船團，否則朝登陸區靠攏
    const tr=S.units.filter(x=>x.side==='atk'&&x!==u&&!isShip(x)&&atSea(x)),goals=tr.length?tr.map(x=>K(x.c,x.r)):ZONES[aiPlan().zone];
    const rc=reach(u);let best=null,bs=minD(h.k,goals)+ssmThreat(h.k)*.6;
    for(const [k,v] of rc){if(v.kind!=='sail')continue;const s=minD(k,goals)+ssmThreat(k)*.6+Math.random()*.3-(tr.some(x=>hd(TER[k],hexOf(x))<=kmH(40))?.8:0);if(s<bs-.2){bs=s;best=k;}}
    if(best){doMove(u,best,'sail');render();await sleep(260);}
    return;
  }
  if(u.type==='abn'&&!u.dropped&&h.isl==='CN'){
    if(!S.weather.air||S.turn>3)return;
    const rc=reach(u);let best=null,bs=1e9;const g=TER[ABN_GOAL[aiPlan().zone][u.goal||0]];
    for(const [k,v] of rc){if(v.kind!=='drop')continue;const s=hd(TER[k],g)+(inZOC('atk',TER[k])?3:0)-friendAdj(k,'atk')*.5+Math.random()*.4;if(s<bs){bs=s;best=k;}}
    if(best){doMove(u,best,'drop');render();await sleep(380);}
    return;
  }
  if(h.isl==='TW'||h.isl==='PH'){
    const AD=(S.intent||{}).adv;
    if(await aiTryAttack(u,AD==='hold'?1:AD==='dash'?-1:0))return;
    if(h.isl==='PH')return;
    if(AD==='hold')return; // 指揮官令：先鞏固灘頭，不前進
    const open=OBJ.filter(k=>S.owner[k]!=='atk');
    const pOpen=PORTS.filter(k=>S.owner[k]!=='atk');
    const goals=AD==='dash'?[TAIPEI]:AD==='port'&&pOpen.length?pOpen:(open.length?open:OBJ);
    let g=goals[0],gd=1e9;for(const k of goals){if(OBJD[k][h.k]<gd){gd=OBJD[k][h.k];g=k;}}
    const rc=reach(u);let best=null,bs=OBJD[g][h.k];
    for(const [k,v] of rc){if(v.kind!=='move')continue;const ea=enemyAdj(k,'atk'),fa=friendAdj(k,'atk');const s=OBJD[g][k]+ea*.3+(ea>=2&&fa<1?2:0)-Math.min(fa,2)*.2;if(s<bs){bs=s;best=k;}}
    if(best){doMove(u,best,'move');render();await sleep(300);}
    await aiTryAttack(u,0);return;
  }
  // at sea or on the mainland
  let goals;
  if(u.type==='arm'){
    goals=PORTS.concat([SPOT.hualien]).filter(k=>S.owner[k]==='atk').concat(Object.values(TER).filter(floatPier).map(x=>x.k)); // 掌握的港口，或可架浮動碼頭的灘頭
    if(!goals.length)return;
  } else {
    goals=ZONES[u.zone||aiPlan().zone];
  }
  const rc=reach(u);
  let best=null,bs=1e9;
  // 選登陸點：擴大到離目標 10 格內，優先選守軍少的灘頭（2 格內守方兵力越多越差），同一批部隊集中在相鄰灘頭
  const defs=S.units.filter(e=>e.side==='def'&&onTW(e)&&!isMsl(e)&&alive(e));
  for(const [k,v] of rc){
    if(v.kind!=='land')continue;if(TER[k].isl!=='TW'&&TER[k].isl!=='PH')continue;const md=minD(k,goals);if(md>kmH(200))continue; // 只登陸台灣本島與澎湖（不會「登陸」回大陸海岸）
    const dS=defs.reduce((a,e)=>a+(hd(hexOf(e),TER[k])<=kmH(40)?e.hp:0),0);
    const s=md*.5+enemyAdj(k,'atk')*1.5+dS*.25-Math.min(friendAdj(k,'atk'),3)+Math.random()*.3;if(s<bs){bs=s;best=k;}
  }
  if(best){doMove(u,best,'land');render();await sleep(340);return;}
  if(h.t==='sea'&&await aiTryAttack(u,0))return;
  if(h.isl==='CN'&&!h.coastal&&u.type!=='arm'){ // 開局落在內陸格（例如澎湖軸線的陸戰旅）：先走到最靠近目標的沿岸格，下回合才能出航
    let b=null,bs0=minD(h.k,goals);
    for(const [k,v] of rc){if(v.kind!=='move')continue;const t=TER[k];if(t.isl!=='CN')continue;const sc=minD(k,goals)-(t.coastal?3:0);if(sc<bs0){bs0=sc;b=k;}}
    if(b){doMove(u,b,'move');render();await sleep(300);return;}
  }
  if(h.isl==='CN'&&penghuFirst()&&u.zone!=='penghu')return; // 先取澎湖：本島主攻部隊留在大陸，等拿下馬公（最晚第 7 回合）
  if(h.isl==='CN'&&u.type!=='arm'&&S.turn>1&&S.turn<S.T-1){
    // hold reinforcements on the coast until at least two can cross together
    const ready=S.units.filter(x=>x.side==='atk'&&(x.type==='amph'||x.type==='mar')&&hexOf(x).isl==='CN'&&!x.moved).length;
    const afloat=S.units.some(x=>x.side==='atk'&&atSea(x)&&!isShip(x));
    if(ready<2&&!afloat)return;
  }
  const cur=minD(h.k,goals);bs=h.t==='sea'?cur+ssmThreat(h.k)*.6:1e9;best=null;
  for(const [k,v] of rc){if(v.kind!=='sail')continue;const s=minD(k,goals)+ssmThreat(k)*.6+Math.random()*.3;if(s<bs){bs=s;best=k;}}
  if(best){doMove(u,best,'sail');render();await sleep(300);}
  if(atSea(u))await aiTryAttack(u,1);
}
// 海鯤潛艦（守方）：魚雷有限（回港補彈），射程短（約 3 格），射擊後暴露，可能遭攻方護航艦反潛反擊
// 後續批次的海鯤逐步改良（推估，不確定性高）：武器酬載增加、鋰電池與降噪使被發現機率下降、聲納與火控改良使命中率提高
const HK_ERA={'2026':[4,1,0],'2027':[4,1,0],'2028':[4,1,0],'2029':[4,.95,.02],'2030':[5,.9,.04],'2031':[5,.8,.06],'2032':[6,.7,.08]}; // [魚雷齊射數, 被反潛發現的倍率, 命中率加成]
const hkE=()=>HK_ERA[S.era]||HK_ERA['2026'];
const hkTp=()=>hkE()[0];
const HK_P={cv:.3,dd:.35,amph:.5,mar:.5,arm:.5,cvy:.85}; // 補給船團是慢速商船、護航薄弱，最好打；附近每有一艘護航艦命中率 −10%（最低 40%）
const hkP=t=>Math.min(.95,(t.type==='cvy'?Math.max(.4,HK_P.cvy-.1*S.units.filter(e=>e.side==='atk'&&e.type==='dd'&&rd(hexOf(e),hexOf(t))<=kmH(60)).length):t.type==='cv'?Math.max(LAM.hkMin,HK_P.cv-LAM.hkCv*S.units.filter(e=>e.side==='atk'&&isEsc(e)&&alive(e)&&rd(hexOf(e),hexOf(t))<=kmH(40)).length):(HK_P[t.type]||.35))+hkE()[2]); // 航艦：每有一艘新護航艦在 2 格內 −5%（★） // 命中率：航艦有護航與反潛屏護最難打，運輸船與登陸艦最容易
const HK_V={cv:3,amph:1.5,mar:1.5,arm:1.5,cvy:1.2,dd:.8};
const HK_MISSION={cvy:['cvy'],lnd:['amph','mar','arm'],cv:['cv'],dd:['dd']};
// 武器（依公開資料）：海鯤有 6 具 533 公厘魚雷管，主要武器為 Mk 48 Mod 6 重型魚雷（美國 2020 年核准出售 18 枚）與 UGM-84L 潛射魚叉反艦飛彈（官方未公布攜行數）。
// 遊戲簡化：魚雷以「兩枚一次齊射」計、射程 3 格（約 60 公里）；魚叉每次 1 枚、射程 6 格（約 120 公里，但被護航艦攔截機率高、命中率 −12%、發射較不易暴露）。全艇武器總量上限 18 枚。
const HK_HM=6;
const hkPref=()=>S.hkWpn||'auto';
function hkRange(u){const p=hkPref();return Math.max(p!=='hm'&&(u.tp||0)>0?kmH(60):0,p!=='tp'&&(u.hm||0)>0?kmH(120):0);} // 魚雷約 60 km、潛射魚叉約 120 km
function hkSpent(u){return (u.tp||0)<=0&&(u.hm||0)<=0;}
function subTargets(u){
  if(u.acted||hkSpent(u)||!atSea(u))return [];
  const rg=hkRange(u);if(!rg)return [];
  return S.units.filter(e=>e.side==='atk'&&atSea(e)&&HK_P[e.type]&&rd(hexOf(u),hexOf(e))<=rg);
}
function hkPick(u,t){ // 選用武器：近距離優先魚雷（命中較高），較遠用魚叉；依手動偏好
  const d=rd(hexOf(u),hexOf(t)),p=hkPref();
  if(p!=='hm'&&(u.tp||0)>0&&d<=kmH(60))return 'tp';
  if(p!=='tp'&&(u.hm||0)>0&&d<=kmH(120))return 'hm';
  return null;
}
function fireSub(u,t){
  if(!subTargets(u).includes(t))return false;
  const w=hkPick(u,t);if(!w)return false;
  if(w==='tp')u.tp--;else u.hm--;u.shots=0;u.acted=true;u.revealed=true;u.last={c:u.c,r:u.r,turn:S.turn};
  const nm=w==='hm'?'魚叉飛彈':'重型魚雷',sv=w==='hm'&&adCover(t).length?salvoCalc(t,1,false,'hkSalvo>'+t.type):null; // 魚叉在艦隊防空涵蓋內：以齊射模型計算
  const hit=sv?sv.hits>0:hitP(w==='hm'?Math.max(.1,hkP(t)-.12):hkP(t),'sub:'+w+'>'+t.type),big=t.type==='cv'||t.type==='csg',steps=!hit?0:sv&&big?takeInt(.5,'salvoBig'):1;
  log('海鯤潛艦以'+nm+'攻擊 '+uname(t)+(sv?'：對方防空發射 '+sv.I+' 枚攔截彈，':'')+(hit?'命中'+(steps?'':'（航艦體積大，未造成重創）'):'未命中')+'（魚雷 '+u.tp+' 齊射、魚叉 '+u.hm+' 枚'+(sv?'；齊射模型，參數為推估':'')+'）');
  fxq({t:'sub',from:[u.c,u.r],to:[t.c,t.r],hit,w});
  if(hit){S.stats.subHits=(S.stats.subHits||0)+1;if(steps)damage(t,steps,'海鯤潛艦'+nm);}
  const d=S.units.filter(e=>e.side==='atk'&&(e.type==='dd'||isEsc(e))&&alive(e)&&rd(hexOf(u),hexOf(e))<=kmH(80)).length,pa=Math.min(.65,(.1+.12*d)*hkE()[1]*(w==='hm'?.5:1));
  if(hitP(pa,'sub:'+w+'>'+t.type)){log('海鯤潛艦被反潛兵力發現並攻擊');damage(u,1,'反潛攻擊');}
  render();return true;
}
function hkHomeStep(u){ // 往最近的守方港口前進：回傳 {k,eta,inPort}；k 為這回合能到的最近格
  if(hexOf(u).t==='port'&&hexOf(u).isl==='TW')return {home:true};
  const ports=Object.values(TER).filter(h=>h.isl==='TW'&&h.t==='port'&&S.owner[h.k]==='def');if(!ports.length)return null;
  const dp=h=>Math.min.apply(null,ports.map(q=>hd(h,q)));
  const rc=reach(u);let b=null,bs=dp(hexOf(u));
  for(const [k,v] of rc){if(v.kind!=='sail'&&v.kind!=='move')continue;const sc=dp(TER[k]);if(sc<bs){bs=sc;b=k;}}
  return b?{k:b,eta:Math.max(1,Math.ceil(bs/SPD.subMax)),arrive:bs===0}:null;
}
// 潛艦偵測：雙方一般看不見、也打不到對方潛艦；只有開火暴露、或剛好被護航艦（反潛）發現時才現身，下一個守方階段起若沒有再被發現就回到隱匿，只留下「上次發現點」
function subDetect(){ // 攻方階段開始：附近的護航艦各有機會發現潛艦；發現者可以投射反潛武器
  for(const u of S.units.filter(x=>x.side==='def'&&(x.type==='hk'||x.type==='ssn')&&atSea(x))){
    const loud=u.loud;u.loud=false;
    const fs=S.units.filter(e=>e.side==='atk'&&LAM.asw[e.type]&&alive(e)&&rd(hexOf(e),hexOf(u))<=LAM.aswR[e.type]&&hitP(Math.min(.95,LAM.asw[e.type]*hkE()[1]*(loud?2:1)),'subDetect:'+e.type)); // 新護航艦有艦載直升機，搜索範圍較大
    if(!fs.length)continue;
    if(!u.revealed){u.revealed=true;u.last={c:u.c,r:u.r,turn:S.turn};log('攻方護航艦在 '+hname(hexOf(u))+' 附近發現潛艦訊號');}
    if(fs.some(()=>hitP(.3,'subDetect'))){log('攻方護航艦對'+TYPES[u.type].n+'投射反潛武器');damage(u,1,'反潛攻擊');}
  }
}
async function subTurn(u){ // 電腦操作海鯤：依指揮官意圖選目標類型，保持魚叉射程接近、攻擊；武器用盡就回港補彈
  if(!alive(u)||u.acted)return;
  const mis=(S.intent||{}).sub,types=mis&&HK_MISSION[mis]?HK_MISSION[mis]:null;
  const pool=S.units.filter(e=>e.side==='atk'&&atSea(e)&&HK_P[e.type]&&(!types||types.includes(e.type)));
  const best=()=>{const ts=subTargets(u).filter(e=>!types||types.includes(e.type));ts.sort((a,b)=>HK_V[b.type]*hkP(b)-HK_V[a.type]*hkP(a));return ts[0];};
  if(hkSpent(u)){ // 彈藥用盡：自動回母港補彈
    const st=hkHomeStep(u);if(st&&st.k){doMove(u,st.k,'sail');if(!subHidden(u))log('海鯤潛艦彈藥用盡，返回母港補彈');render();await sleep(240);}return;}
  let t=best();
  if(!t&&pool.length){
    const rc=reach(u),want=hkRange(u)>kmH(60)?kmH(100):kmH(40);let bk=null,bs=Math.min.apply(null,pool.map(e=>hd(hexOf(u),hexOf(e))));
    for(const [k,v] of rc){if(v.kind!=='sail')continue;const h=TER[k],sc=Math.min.apply(null,pool.map(e=>hd(h,hexOf(e))))+Math.random()*.3+(hd(hexOf(u),h)>SPD.subQuiet?1.5:0);if(sc<bs-.2&&sc>=want-kmH(10)){bs=sc;bk=k;}} // ★高速航行容易被發現：除非能明顯接近目標，否則維持安靜潛航
    if(!bk)for(const [k,v] of rc){if(v.kind!=='sail')continue;const h=TER[k],sc=Math.min.apply(null,pool.map(e=>hd(h,hexOf(e))))+Math.random()*.3;if(sc<bs-.2){bs=sc;bk=k;}}
    if(bk){doMove(u,bk,'sail');render();await sleep(240);}
    t=best();
  }
  if(t){fireSub(u,t);await sleep(300);}
}
// 手動操作：把選取的潛艦開回母港；切換武器
function hkGoHome(){
  const u=S.sel;if(!u||u.type!=='hk'||!humanTurn()||u.moved)return;
  const st=hkHomeStep(u);
  if(!st){toast('找不到可回的母港');return;}
  if(st.home){toast('已在母港，會自動補滿彈藥');return;}
  if(!st.k){toast('這回合無法移動');return;}
  humanMove(u,st.k,'sail');
  toast(st.arrive?'抵達母港，下個階段補滿彈藥':'朝母港前進（約還需 '+st.eta+' 回合）');render();
}
function hkCycleWpn(){const o=['auto','tp','hm'];S.hkWpn=o[(o.indexOf(hkPref())+1)%3];render();}
async function ffSortie(m){ // 艦艇出港，保持在飛彈射程（約 6 格）外圍，避開護航艦
  if(!alive(m)||m.moved)return;
  if(fcWave(hexOf(m))>=2.2||wxWave(hexOf(m))>=2.2)return; // 所在海域浪高大或預報會變大（颱風預測路徑）時不出港
  const en=S.units.filter(e=>e.side==='atk'&&atSea(e)&&!isShip(e)||e.type==='cv'&&e.side==='atk');
  if(!en.length)return;
  const rc=reach(m);let best=null;const here=Math.min(...en.map(e=>hd(hexOf(m),hexOf(e)))),dd=k=>Math.min(99,...S.units.filter(e=>e.side==='atk'&&e.type==='dd').map(e=>hd(TER[k],hexOf(e))));
  let bs=Math.abs(here-6)+(dd(K(m.c,m.r))<=3?2:0);
  for(const [k,v] of rc){if(v.kind!=='sail')continue;const dm=Math.min(...en.map(e=>hd(TER[k],hexOf(e)))),sc=Math.abs(dm-kmH(120))+(dd(k)<=kmH(60)?2:0)+Math.random()*.4+(m.type==='hk'&&hd(hexOf(m),TER[k])>SPD.subQuiet?1.5:0);if(sc<bs-.3){bs=sc;best=k;}}
  if(best){doMove(m,best,'sail');render();await sleep(260);}
}
async function aiDef(){
  await aiCnStrikes();
  afAuto();render(); // 守方空軍各機場出擊
  if(shelterNeeded('def')&&!(S.shelterDone&&S.shelterDone.def===S.turn)){S.shelterDone=S.shelterDone||{};S.shelterDone.def=S.turn;shelterOrder('def');}
  for(const sb of S.units.filter(u=>u.side==='def'&&u.type==='hk')){if(S.over)return;await subTurn(sb);}
  let vol=0;const MS=(S.intent||{}).msl;let salvoT=null;const scoot=[];
  const HV=['arm','tank','amph','mar','abn','cv'];
  for(const m of S.units.filter(u=>u.side==='def'&&isMsl(u))){
    if(S.over)return;if(!alive(m))continue;
    if((MS==='save'||MS==='scoot')&&m.shots>1)m.shots=1;
    if(m.type==='ff')await ffSortie(m);
    if(enemyAdj(K(m.c,m.r),'def')&&m.type!=='ff'){
      const rc=reach(m);let best=null,bs=-1;
      for(const [k,v] of rc){if(v.kind!=='move')continue;const s=-enemyAdj(k,'def')*3+Math.min.apply(null,S.units.filter(e=>e.side==='atk').map(e=>hd(TER[k],hexOf(e))).concat([kmH(360)]));if(s>bs){bs=s;best=k;}}
      if(best){doMove(m,best,'move');}
    }
    while(alive(m)&&m.shots>0&&!S.over){
      const IT2=S.intent||{},HM=IT2.hmr,AS=IT2.asm,cargo=t=>{const b=t.boundTo&&S.units.find(x=>x.id===t.boundTo);return b?b.type:null;},hvT=t=>HV.includes(t.type)||HV.includes(cargo(t)); // 載著裝甲、兩棲、陸戰旅的運輸船也算高價值
      let ts=targets(m);if(MS==='save')ts=ts.filter(hvT);
      if(m.type==='hmr'){const near=t=>rd(hexOf(m),hexOf(t))<=kmH(80)&&(S.pools.rocGml||0)>=1;ts=HM==='cn'?ts.filter(near):HM==='beach'||HM==='log'?ts:ts.filter(t=>hvT(t)||near(t));}
      if(!ts.length)break; // 電腦把陸軍戰術飛彈留給高價值目標（裝甲、兩棲、陸戰、空降旅），其他目標只在火箭彈射程內才打
      if(m.type==='hmr'||m.type==='mlrs'){const w={arm:4,tank:4,amph:4,mar:4,abn:3,inf:2,res:2};const far=x=>m.type==='hmr'&&rd(hexOf(m),hexOf(x))>kmH(80)?1:0;
        const lg=x=>m.type==='hmr'&&HM==='log'?(x.type==='fob'?2:PORTS.includes(K(x.c,x.r))?1:0):0,bc=x=>m.type==='hmr'&&HM==='beach'&&hexOf(x).coastal&&['arm','tank','amph','mar','abn'].includes(x.type)?1:0;
        ts.sort((a,b)=>lg(b)-lg(a)||bc(b)-bc(a)||(w[b.type]||1)-(w[a.type]||1)||far(a)-far(b)||a.hp-b.hp);} // 同樣價值時先打近的（用火箭彈，省下陸軍戰術飛彈）
      else{const pr=t=>AS==='tr'?((t.type==='ro'||t.type==='lst'||t.type==='cvy')?2+(cargo(t)?1:0):0):AS==='esc'?((isEsc(t)||t.type==='dd')?2:0):0;ts.sort((a,b)=>pr(b)-pr(a)||tgtVal(b)-tgtVal(a)||a.hp-b.hp);} // 指揮官意圖：反艦打擊優先
      if(MS==='salvo'){if(!(salvoT&&alive(salvoT)&&ts.includes(salvoT)))salvoT=ts[0];else ts=[salvoT];}
      fireMissile(m,ts[0]);vol++;
      if(MS==='scoot'&&alive(m))m.revealed=!!(m.mT&&S.turn<m.mT);
    }
    if((m.type==='ssm'||m.type==='hmr'||m.type==='mlrs')&&alive(m)&&!m.moved&&!S.over&&MS!=='salvo'){ // 打了就跑：轉移到山區或離敵較遠的陣地，重新隱蔽
      const rc=reach(m),foes=S.units.filter(e=>e.side==='atk'&&!isShip(e));let best=null,bs=-1e9;
      for(const [k,v] of rc){if(v.kind!=='move')continue;const h2=TER[k];
        const sc=Math.min(kmH(600),...foes.map(e=>hd(h2,hexOf(e))))+(h2.t==='mtn'?4:0)-enemyAdj(k,'def')*5+Math.random()*2;if(sc>bs){bs=sc;best=k;}}
      if(best)scoot.push([m,best]); // 等齊射畫完再轉移，特效才不會從空掉的陣地發出
    }
  }
  if(vol){render();await sleep(Math.min(1800,500+vol*110));} // 守方飛彈一起齊射
  if(scoot.length){for(const [m,k] of scoot)if(alive(m)&&!m.moved){doMove(m,k,'move');m.revealed=!!(m.mT&&S.turn<m.mT);}render();await sleep(300);}
  const pri={tank:0,res:1,inf:2};
  const order=S.units.filter(u=>u.side==='def'&&!isMsl(u)&&!u.ally).sort((a,b)=>pri[a.type]-pri[b.type]);
  for(const u of order){if(S.over)return;if(alive(u))await aiDefUnit(u);}
}
// 守方電腦調兵：只靠看得到的情報（海上船團位置）判斷威脅方向；船團尚未出海時北部與中部都有可能，兵力平均分配，不會預知攻方計畫
function defZoneDist(z){
  const c=S._zd&&S._zd.t===S.turn?S._zd:(S._zd={t:S.turn});
  if(!c[z])c[z]=landDist(ZONES[z]);return c[z];
}
function defPickZone(h){
  const zs=['north','central'];
  const sh=S.units.filter(e=>e.side==='atk'&&atSea(e)&&e.type!=='cvy'&&e.type!=='fob'),w={north:0,central:0};
  for(const z of zs){const hz=ZONES[z].map(k=>TER[k]);for(const e of sh){const d=Math.min.apply(null,hz.map(t=>hd(hexOf(e),t)));w[z]+=1/(1+d);}}
  let want=zs;
  if(sh.length>=3){const a=w.north,b=w.central;if(a>b*1.6)want=['north'];else if(b>a*1.6)want=['central'];}
  // 在可能的登陸區中選離自己最近的；若兩區都可能，依單位位置的奇偶輪流，避免全部擠到同一區
  if(want.length===1)return want[0];
  const dn=defZoneDist('north')[h.k],dc=defZoneDist('central')[h.k];
  if(dn===undefined||dc===undefined)return dn===undefined?'central':'north';
  if(Math.abs(dn-dc)<=3)return (h.c+h.r)%2?'north':'central';
  return dn<dc?'north':'central';
}
async function aiDefUnit(u){
  // when Taipei or a main port has fallen, defenders counterattack more readily and converge on it
  const hold=(S.intent||{}).hold;
  const lost=OBJ.filter(k=>S.owner[k]==='atk');let thr=u.type==='tank'?0:1;
  const line=(S.intent||{}).line;
  if(hold==='preserve')thr=3;
  if(line==='mobile'&&u.type==='tank'&&S.units.some(e=>e.side==='atk'&&onTW(e)))thr=0; // 機動預備：敵人上岸後裝甲旅集中反擊
  const post=S.mods.defPost&&S.mods.defPost[S.turn];if(post==='counter')thr=Math.min(thr,0);else if(post==='hold')thr=3; // 持久戰策略：反攻或固守
  const fk=hold==='capital'?lost.concat([TAIPEI]):hold==='ports'?lost.concat(PORTS):lost;
  if(await aiTryAttack(u,thr,fk))return;
  if(u.garrison||S.mods.defFreeze[S.turn])return;
  const h=hexOf(u);if(h.isl!=='TW')return;
  const rc=reach(u);if(!rc.size)return;
  if((hold==='capital'||hold==='ports')&&!lost.length){ // 指揮官令：向台北／主要港口收縮防守
    const od=landDist(hold==='capital'?[TAIPEI]:PORTS);let b0=od[h.k]===undefined?1e9:od[h.k],pk=null;
    if(b0>kmH(40)){for(const [k,v] of rc){if(v.kind!=='move')continue;const sc=od[k]===undefined?1e9:od[k];if(sc<b0){b0=sc;pk=k;}}
      if(pk){doMove(u,pk,'move');render();await sleep(280);await aiTryAttack(u,thr,fk);}return;}
  }
  if(line==='mobile'&&u.type==='tank'&&!S.units.some(e=>e.side==='atk'&&onTW(e)))return; // 指揮官令：機動預備——敵人上岸前裝甲旅原地隱蔽待命
  if(line==='depth'&&!lost.length&&!u.garrison&&!S.units.some(e=>e.side==='atk'&&onTW(e))){ // 指揮官令：縱深防禦——敵人上岸前不進海岸格，移到附近的城市或山地
    if(!h.coastal&&(h.t==='city'||h.t==='mtn'))return;let pk=null,b0=h.coastal?-1:0;
    for(const [k,v] of rc){if(v.kind!=='move')continue;const t=TER[k];if(t.coastal||t.isl!=='TW')continue;const sc=(t.t==='city'||t.t==='mtn')?2:1;if(sc>b0){b0=sc;pk=k;}}
    if(pk){doMove(u,pk,'move');render();await sleep(280);}return;}
  if(line==='beach'&&!lost.length&&!u.garrison){ // 指揮官令：灘岸前推（朝敵船團實際接近的灘頭）
    const od=defZoneDist(defPickZone(h)||'north');let b0=od[h.k]===undefined?1e9:od[h.k],better=null;
    if(b0>kmH(40)){for(const [k,v] of rc){if(v.kind!=='move')continue;const sc=od[k]===undefined?1e9:od[k];if(sc<b0){b0=sc;better=k;}}
      if(better){doMove(u,better,'move');render();await sleep(280);await aiTryAttack(u,thr,fk);}return;}
  }
  // retake an empty objective in reach
  for(const k of OBJ){if(S.owner[k]==='atk'&&rc.has(k)&&rc.get(k).kind==='move'){doMove(u,k,'move');log(TYPES[u.type].n+' 收復 '+hname(TER[k]));render();await sleep(300);return;}}
  if(lost.length){
    const od=landDist(lost);let bs0=od[h.k]===undefined?1e9:od[h.k],pick0=null;
    if(bs0<=kmH(20))return;
    for(const [k,v] of rc){if(v.kind!=='move')continue;const sc=od[k]===undefined?1e9:od[k];if(sc<bs0){bs0=sc;pick0=k;}}
    if(pick0){doMove(u,pick0,'move');render();await sleep(280);await aiTryAttack(u,thr,lost);}
    return;
  }
  const foes=S.units.filter(e=>e.side==='atk'&&onTW(e));
  let best=null;
  if(foes.length){
    const fd=landDist(foes.map(e=>K(e.c,e.r)));
    let bs=fd[h.k]===undefined?1e9:fd[h.k];
    if(bs<=kmH(20))return;
    for(const [k,v] of rc){if(v.kind!=='move')continue;const s=(fd[k]===undefined?1e9:fd[k])+(OBJ.includes(k)?-.5:0);if(s<bs){bs=s;best=k;}}
  } else if(u.type!=='tank'&&!lost.length){ // 敵人還沒上岸：步兵與後備旅依海上船團的位置向可能的登陸區預先調動（受移動力限制，要幾回合才到位）
    const z=defPickZone(h);if(z){const od=defZoneDist(z);let b0=od[h.k]===undefined?1e9:od[h.k];
      if(b0>kmH(60)){for(const [k,v] of rc){if(v.kind!=='move')continue;const sc=(od[k]===undefined?1e9:od[k])+enemyAdj(k,'def')*3;if(sc<b0){b0=sc;best=k;}}}if(best)S.stats.redep=(S.stats.redep||0)+1;}
  } else if(u.type==='tank'){
    const fleet=S.units.filter(e=>e.side==='atk'&&atSea(e));if(!fleet.length)return;
    let tgt=null,ts=1e9;
    for(const c of Object.values(TER)){if(c.isl!=='TW'||!c.coastal||c.cliff)continue;const s=fleet.reduce((a,e)=>a+hd(c,hexOf(e)),0);if(s<ts){ts=s;tgt=c;}}
    if(!tgt||hd(h,tgt)<=kmH(80))return;
    let bs=hd(h,tgt);
    for(const [k,v] of rc){if(v.kind!=='move')continue;const s=hd(TER[k],tgt);if(s<bs){bs=s;best=k;}}
  }
  if(best){doMove(u,best,'move');render();await sleep(280);await aiTryAttack(u,thr);}
}
