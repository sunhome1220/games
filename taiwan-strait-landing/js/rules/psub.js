'use strict';
/* ---------- 共軍潛艦（棋子，2026-11-16 起；★推估）----------
   一個棋子約代表 2～3 艘（plaSub 1 點＝1 個棋子）。約 1/3 是 093 型核動力攻擊潛艦（快、較吵、有鷹擊-18 潛射反艦飛彈），
   其餘是 039A／B 絕氣推進潛艦（安靜、鷹擊-18 較少）。規則和台灣潛艦對稱：平常看不見、開火才暴露、
   會被守方護航艦、艦隊、反潛直升機與 P-3C 反潛巡邏機發現；回大陸港口補彈。 */
const PSUB={
  '093':{n:'093 型核潛艦群',tp:4,hm:6,det:1.3},
  '039':{n:'039 型潛艦群',tp:4,hm:2,det:.7},
  tpR:kmH(60),hmR:kmH(220),
  // 魚雷命中率（依目標，★推估）；航艦打擊群另扣反潛屏障
  P:{fl:.45,csg:.25,ddg:.3,cg:.3,tak:.55,ddh:.3,jdg:.3,jdd:.3},
  V:{csg:10,tak:6,ddh:5,fl:4,ddg:3,cg:3,jdg:3,jdd:3},
  // 開戰前已出港布署的位置（台灣東北、東、東南、巴士海峽、海峽南北口）
  START:[[123.2,24.6],[122.6,22.4],[121.0,21.6],[120.1,23.4],[119.9,24.9],[123.4,23.3]]
};
const isSubT=u=>!!u&&(u.type==='hk'||u.type==='ssn'||u.type==='psub');
const psubCls=u=>PSUB[u.cls]||PSUB['039'];
const psubInPort=u=>u.type==='psub'&&hexOf(u).t==='port'&&hexOf(u).isl==='CN';
function psubSpawn(){
  const n=Math.min(PSUB.START.length,Math.floor(S.pools.plaSub||0));
  for(let i=0;i<n;i++){const [lo,la]=PSUB.START[i],[c,r]=llToRC(lo,la);let h=TER[K(c,r)];
    if(!h||h.t!=='sea'||unitsAt(h.k).length)h=placeNear(K(c,r),x=>x.t==='sea'&&!unitsAt(x.k).length);if(!h)continue;
    const cls=i%3===0?'093':'039',C=PSUB[cls],u=mkUnit('atk','psub',h.k,{cls,tp:C.tp,hm:C.hm});S.units.push(u);}
}
const psubTargetOk=e=>e.side==='def'&&alive(e)&&atSea(e)&&isShip(e)&&!isSubT(e)&&e.type!=='fob'&&hexOf(e).t!=='port'&&PSUB.P[e.fl?'fl':e.type]!=null;
function psubTargets(u){
  if(u.acted||(u.tp<=0&&u.hm<=0)||!atSea(u))return [];
  const R=Math.max(u.tp>0?PSUB.tpR:0,u.hm>0?PSUB.hmR:0);
  return S.units.filter(e=>psubTargetOk(e)&&rd(hexOf(u),hexOf(e))<=R);
}
function psubP(t){
  if(t.type==='csg'){const A=usAswScreen(t);return Math.max(.08,PSUB.P.csg-.03*A);}
  return PSUB.P[t.fl?'fl':t.type]||.3;
}
function psubFire(u,t){
  if(!psubTargets(u).includes(t))return false;
  const d=rd(hexOf(u),hexOf(t)),pref=hkPref(),w=(pref!=='hm'&&u.tp>0&&d<=PSUB.tpR)?'tp':(pref!=='tp'&&u.hm>0&&d<=PSUB.hmR)?'hm':(u.tp>0&&d<=PSUB.tpR)?'tp':null;if(!w)return false;
  if(w==='tp')u.tp--;else u.hm--;u.shots=0;u.acted=true;u.revealed=true;u.last={c:u.c,r:u.r,turn:S.turn};useRec('潛艦攻擊',1,w==='hm'?'鷹擊-18（潛射）':'魚-6 重型魚雷（齊射）',1,psubCls(u).n,t);
  const nm=w==='hm'?'鷹擊-18 潛射反艦飛彈':'魚-6 重型魚雷',C=psubCls(u);let hit,steps=0,sv=null;
  if(w==='hm'){sv=salvoHit(t,2,'psubHm>'+t.type);hit=sv.hits>0;steps=sv.steps;}
  else{hit=hitP(psubP(t),'psub:tp>'+t.type);steps=hit?1:0;}
  log(C.n+'以'+nm+'攻擊 '+uname(t)+(sv?'：對方防空發射 '+sv.I+' 枚攔截彈，約 '+fmt1(sv.surv)+' 枚突破，命中 '+sv.hits+' 枚':(hit?'：命中':'：未命中'))+'（魚雷 '+u.tp+'、鷹擊-18 '+u.hm+'；推估）');
  fxq({t:'sub',from:[u.c,u.r],to:[t.c,t.r],hit,w});
  if(steps)damage(t,steps,C.n+nm);
  // 開火暴露：80 km 內的守方反潛艦艇反擊
  const near=S.units.filter(e=>e.side==='def'&&alive(e)&&(isEsc(e)||e.fl||e.type==='csg'||e.type==='ddh'||e.type==='jdg'||e.type==='jdd')&&rd(hexOf(u),hexOf(e))<=kmH(80)).length;
  const pa=Math.min(.65,(.1+.12*near)*C.det*(w==='hm'?.5:1));
  if(near&&hitP(pa,'psubCounter')){log(C.n+'被守方反潛兵力發現並攻擊');damage(u,1,'守方反潛攻擊');}
  checkInstant();render();return true;
}
// 守方階段開始：守方反潛兵力搜尋附近的共軍潛艦（護航艦、艦隊、日本護衛艦、美軍航艦打擊群，以及岸基 P-3C 反潛巡邏機）
const PSUB_DET={ddg:.35,cg:.35,csg:.3,ddh:.4,jdg:.3,jdd:.3,fl:.2,p3c:.15};
function psubDetect(){
  for(const u of S.units.filter(x=>x.type==='psub'&&alive(x)&&atSea(x))){
    const C=psubCls(u),loud=u.loud;u.loud=false;let found=false,by='';
    for(const e of S.units){if(e.side!=='def'||!alive(e))continue;const k=e.fl?'fl':e.type,p=PSUB_DET[k];if(p==null||rd(hexOf(e),hexOf(u))>kmH(120))continue;
      if(hitP(Math.min(.95,p*C.det*(loud?2:1)),'psubDet:'+k)){found=true;by=e.fl?e.fl.n:uname(e);break;}}
    if(!found&&cvTwKm(hexOf(u))<=250&&hitP(Math.min(.95,PSUB_DET.p3c*C.det*(loud?2:1)),'psubDet:p3c')){found=true;by='P-3C 反潛巡邏機';}
    if(!found)continue;
    if(!u.revealed){u.revealed=true;u.last={c:u.c,r:u.r,turn:S.turn};log(by+' 在 '+hname(hexOf(u))+' 一帶發現共軍潛艦訊號');}
    if(hitP(.3,'psubDetAtk')){log(by+' 對'+C.n+'投射反潛武器');damage(u,1,'守方反潛攻擊');}
  }
}
// 電腦操作：彈藥用完回大陸港口補彈；否則挑射程內最有價值的目標攻擊，不然安靜地朝目標接近
function psubHome(u){
  const ports=Object.values(TER).filter(h=>h.isl==='CN'&&h.t==='port');if(!ports.length)return null;
  const dp=h=>Math.min(...ports.map(q=>hd(h,q))),rc=reach(u);let b=null,bs=dp(hexOf(u));
  for(const [k,v] of rc){if(v.kind!=='sail'&&v.kind!=='move')continue;const sc=dp(TER[k]);if(sc<bs){bs=sc;b=k;}}return b;
}
async function psubTurn(u){
  if(!alive(u)||u.acted)return;
  if(u.tp<=0&&u.hm<=0){if(psubInPort(u))return;const k=psubHome(u);if(k){doMove(u,k,'sail');render();await sleep(200);}return;}
  const best=()=>{const ts=psubTargets(u);ts.sort((a,b)=>(PSUB.V[b.fl?'fl':b.type]||1)*psubP(b)-(PSUB.V[a.fl?'fl':a.type]||1)*psubP(a));return ts[0];};
  let t=best();
  if(!t){const pool=S.units.filter(psubTargetOk);if(pool.length){const rc=reach(u);let bk=null,bs=Math.min(...pool.map(e=>hd(hexOf(u),hexOf(e))));
      for(const [k,v] of rc){if(v.kind!=='sail')continue;const h=TER[k],sc=Math.min(...pool.map(e=>hd(h,hexOf(e))))+(hd(hexOf(u),h)>SPD.subQuiet?1.5:0);if(sc<bs-.2){bs=sc;bk=k;}}
      if(bk){doMove(u,bk,'sail');render();await sleep(200);}}
    t=best();}
  if(t)psubFire(u,t);
}
