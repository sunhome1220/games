'use strict';
/* ---------- 反潛直升機主動搜索（★推估；2026-11-16）----------
   攻方：在直升機半徑內選一處海域搜索，找到地圖上的台灣潛艦或美軍攻擊潛艦就現身，並投擲魚雷攻擊。
   守方：共軍潛艦也是地圖棋子（js/psub.js），同樣選一處海域搜索。
   每艘艦每階段出動一次；電腦操作的一方會自動使用。 */
// 各艦艇的反潛直升機架數：共軍 055 兩架、052D／054A 一架、護航棋子（052D＋054A）兩架、航艦（直-18F）四架；美軍柏克級與巡洋艦兩架、航艦打擊群 MH-60R 另計；出雲七架；海自護衛艦一架
const HELO={d55:2,d52:1,f54:1,dd:2,cv:4,ddg:2,cg:2,csg:4,ddh:7,jdg:1,jdd:1};
// 台灣艦隊每艘有機庫的艦一架（S-70C／MH-60R）：成功級、康定級、派里級、濟陽級、新輕型巡防艦；基隆級、沱江級、光六快艇沒有
const HELO_FL={ck:1,kd:1,pf:1,cy:1,lf:1};
const ASW={R:kmH(150),area:kmH(40),pFind:.3,pKill:.35,maxH:2};
function heloN(u){if(!u||!alive(u))return 0;if(u.fl)return u.fl.m.reduce((a,[k,n])=>a+(HELO_FL[k]||0)*n,0);return HELO[u.type]||0;}
const heloReady=u=>heloN(u)>0&&u.heloT!==S.turn+S.phase&&!cvOOA(u);
// 攻方（或任何一方）搜索地圖上的敵方潛艦：h＝搜索中心
function heloSearch(u,h){
  if(!heloReady(u)||hd(hexOf(u),h)>ASW.R)return false;
  u.heloT=S.turn+S.phase;const n=Math.min(ASW.maxH,heloN(u));
  const subs=S.units.filter(s=>s.side!==u.side&&isSubT(s)&&alive(s)&&atSea(s)&&hd(hexOf(s),h)<=ASW.area).sort((a,b)=>hd(hexOf(a),h)-hd(hexOf(b),h));
  let txt='沒有發現潛艦',found=false;
  if(subs.length){const s=subs[0],m=s.type==='hk'?hkU(s)[1]:s.type==='psub'?psubCls(s).det:.8,p=1-Math.pow(1-Math.min(.9,ASW.pFind*m),n);
    if(hitP(p,'heloFind')){found=true;s.revealed=true;s.last={c:s.c,r:s.r,turn:S.turn};const k=hitP(ASW.pKill,'heloKill');
      txt='發現 '+uname(s)+'，投擲魚雷'+(k?'命中':'未命中')+'（發現 '+Math.round(p*100)+'%、命中 '+Math.round(ASW.pKill*100)+'%，推估）';if(k)damage(s,1,'反潛直升機魚雷');}}
  log(uname(u)+' 出動反潛直升機 '+n+' 架搜索 '+hname(h)+' 一帶：'+txt);
  fxq({t:'txt',at:[h.c,h.r],s:found?'發現潛艦':'未發現',col:u.side});
  useRec('反潛直升機搜索',1,null,0,u.fl?u.fl.n:uname(u));
  return true;
}
// 電腦自動：搜索最近發現過的敵方潛艦位置，否則在己方高價值艦艇附近警戒
function heloAuto(side){
  const us=S.units.filter(u=>u.side===side&&heloReady(u));if(!us.length)return;
  const seen=S.units.filter(s=>s.side!==side&&isSubT(s)&&alive(s)&&s.last&&S.turn-s.last.turn<=2).map(s=>TER[K(s.last.c,s.last.r)]).filter(Boolean);
  for(const u of us){const h0=hexOf(u);let h=seen.find(x=>hd(h0,x)<=ASW.R);
    if(!h){const HV={cv:3,cvy:2,lst:2,ro:2,csg:3,ddh:2,tak:2},hv=S.units.filter(x=>x.side===side&&alive(x)&&(HV[x.type]||x.fl)&&atSea(x)&&hd(h0,hexOf(x))<=ASW.R);h=hv.length?hexOf(pickBest(hv,x=>HV[x.type]||2)):h0;}
    heloSearch(u,h);}
}
// 資訊卡按鈕
function heloPanelHTML(u){
  if(!u||u.side!==S.phase||!humanTurn()||!heloReady(u))return '';
  const n=heloN(u);
  setTimeout(()=>{const b=document.getElementById('heloBtn');if(b)b.onclick=()=>{S.mode=S.mode==='helo'?null:'helo';S.heloU=u.id;S.sel=u;if(typeof UC!=='undefined')UC.closedKey=UC.key;render();};},0);
  return '<div class="cvord"><button class="ghost" id="heloBtn">🚁 反潛直升機搜索<small class="pn">（'+n+' 架，點 150 km 內的海域）</small></button></div>';
}
function heloRingSVG(){
  if(S.mode!=='helo')return '';const u=S.units.find(x=>x.id===S.heloU);if(!u||!alive(u))return '';
  const [x,y]=cen(u.c,u.r);return '<circle class="rr r '+u.side+'" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+((ASW.R+.5)*HPX).toFixed(1)+'"/>';
}
