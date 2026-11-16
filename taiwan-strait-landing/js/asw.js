'use strict';
/* ---------- 反潛直升機主動搜索（★推估；2026-11-16）----------
   攻方：在直升機半徑內選一處海域搜索，找到地圖上的台灣潛艦或美軍攻擊潛艦就現身，並投擲魚雷攻擊。
   守方：共軍潛艦是抽象兵力（plaSub），直升機巡邏有機會找到並擊傷，共軍潛艦點數減少。
   每艘艦每階段出動一次；電腦操作的一方會自動使用。 */
// 各艦艇的反潛直升機架數：共軍 055 兩架、052D／054A 一架、護航棋子（052D＋054A）兩架、航艦（直-18F）四架；美軍柏克級與巡洋艦兩架、航艦打擊群 MH-60R 另計；出雲七架；海自護衛艦一架
const HELO={d55:2,d52:1,f54:1,dd:2,cv:4,ddg:2,cg:2,csg:4,ddh:7,jdg:1,jdd:1};
// 台灣艦隊每艘有機庫的艦一架（S-70C／MH-60R）：成功級、康定級、派里級、濟陽級、新輕型巡防艦；基隆級、沱江級、光六快艇沒有
const HELO_FL={ck:1,kd:1,pf:1,cy:1,lf:1};
const ASW={R:kmH(150),area:kmH(40),pFind:.3,pKill:.35,maxH:2,pPatrol:.08,plaSubHit:.25};
function heloN(u){if(!u||!alive(u))return 0;if(u.fl)return u.fl.m.reduce((a,[k,n])=>a+(HELO_FL[k]||0)*n,0);return HELO[u.type]||0;}
const heloReady=u=>heloN(u)>0&&u.heloT!==S.turn+S.phase&&!cvOOA(u);
// 攻方（或任何一方）搜索地圖上的敵方潛艦：h＝搜索中心
function heloSearch(u,h){
  if(!heloReady(u)||hd(hexOf(u),h)>ASW.R)return false;
  u.heloT=S.turn+S.phase;const n=Math.min(ASW.maxH,heloN(u));
  const subs=S.units.filter(s=>s.side!==u.side&&(s.type==='hk'||s.type==='ssn')&&alive(s)&&atSea(s)&&hd(hexOf(s),h)<=ASW.area).sort((a,b)=>hd(hexOf(a),h)-hd(hexOf(b),h));
  let txt='沒有發現潛艦',found=false;
  if(subs.length){const s=subs[0],m=s.type==='hk'?hkU(s)[1]:.8,p=1-Math.pow(1-Math.min(.9,ASW.pFind*m),n);
    if(hitP(p,'heloFind')){found=true;s.revealed=true;s.last={c:s.c,r:s.r,turn:S.turn};const k=hitP(ASW.pKill,'heloKill');
      txt='發現 '+uname(s)+'，投擲魚雷'+(k?'命中':'未命中')+'（發現 '+Math.round(p*100)+'%、命中 '+Math.round(ASW.pKill*100)+'%，推估）';if(k)damage(s,1,'反潛直升機魚雷');}}
  log(uname(u)+' 出動反潛直升機 '+n+' 架搜索 '+hname(h)+' 一帶：'+txt);
  fxq({t:'txt',at:[h.c,h.r],s:found?'發現潛艦':'未發現',col:u.side});
  useRec('反潛直升機搜索',1,null,0,u.fl?u.fl.n:uname(u));
  return true;
}
// 守方巡邏：共軍潛艦是抽象兵力，找到就擊傷（點數減少）
function heloPatrol(u){
  if(!heloReady(u))return false;
  u.heloT=S.turn+S.phase;const n=Math.min(ASW.maxH,heloN(u)),P=S.pools;let txt='沒有發現共軍潛艦';
  if((P.plaSub||0)>0){const p=1-Math.pow(1-ASW.pPatrol,n);
    if(hitP(p,'heloPatrol')){const k=hitP(ASW.pKill,'heloPatrolKill');txt='發現共軍潛艦，投擲魚雷'+(k?'命中（共軍潛艦點數 −'+ASW.plaSubHit+'）':'未命中')+'（發現 '+Math.round(p*100)+'%、命中 '+Math.round(ASW.pKill*100)+'%，推估）';
      if(k)P.plaSub=Math.max(0,Math.round((P.plaSub-ASW.plaSubHit)*100)/100);}}
  log((u.fl?u.fl.n:uname(u))+' 出動反潛直升機 '+n+' 架巡邏：'+txt);
  useRec('反潛直升機巡邏',1,null,0,u.fl?u.fl.n:uname(u));
  return true;
}
// 電腦自動：攻方搜索最近發現過的潛艦位置，否則在航艦與船團附近警戒；守方各艦巡邏
function heloAuto(side){
  const us=S.units.filter(u=>u.side===side&&heloReady(u));if(!us.length)return;
  if(side==='def'){us.forEach(heloPatrol);return;}
  const seen=S.units.filter(s=>s.side!==side&&(s.type==='hk'||s.type==='ssn')&&alive(s)&&s.last&&S.turn-s.last.turn<=2).map(s=>TER[K(s.last.c,s.last.r)]).filter(Boolean);
  for(const u of us){const h0=hexOf(u);let h=seen.find(x=>hd(h0,x)<=ASW.R);
    if(!h){const hv=S.units.filter(x=>x.side===side&&alive(x)&&(x.type==='cv'||x.type==='cvy'||x.type==='lst'||x.type==='ro')&&atSea(x)&&hd(h0,hexOf(x))<=ASW.R);h=hv.length?hexOf(pickBest(hv,x=>x.type==='cv'?3:2)):h0;}
    heloSearch(u,h);}
}
// 資訊卡按鈕
function heloPanelHTML(u){
  if(!u||u.side!==S.phase||!humanTurn()||!heloReady(u))return '';
  const n=heloN(u),atk=u.side==='atk';
  setTimeout(()=>{const b=document.getElementById('heloBtn');if(b)b.onclick=()=>{if(atk){S.mode=S.mode==='helo'?null:'helo';S.heloU=u.id;S.sel=u;if(typeof UC!=='undefined')UC.closedKey=UC.key;}else heloPatrol(u);render();};},0);
  return '<div class="cvord"><button class="ghost" id="heloBtn">🚁 反潛直升機'+(atk?'搜索':'巡邏')+'<small class="pn">（'+n+' 架，'+(atk?'點 150 km 內的海域':'搜索共軍潛艦')+'）</small></button></div>';
}
function heloRingSVG(){
  if(S.mode!=='helo')return '';const u=S.units.find(x=>x.id===S.heloU);if(!u||!alive(u))return '';
  const [x,y]=cen(u.c,u.r);return '<circle class="rr r '+u.side+'" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+((ASW.R+.5)*HPX).toFixed(1)+'"/>';
}
