'use strict';
/* ---------- 陸軍攻擊直升機（2026-11-16；★推估）----------
   依據：601 旅（桃園龍潭）AH-64E 阿帕契可用 29 架（原購 30 架，2014 年訓練墜毀 1 架）；602 旅（台中新社）AH-1W 超級眼鏡蛇約 60 架（1990 年代購入 63 架）。
   2008 年美國對台軍售通知：30 架 AH-64D Block III 附 1,000 枚 AGM-114L 長弓地獄火飛彈；AH-1W 的地獄火／拖式飛彈庫存未公開（不設上限）。
   地獄火射程約 8 km：直升機要飛到灘頭附近才能發射，會暴露在共軍艦艇防空、灘頭野戰防空與制空戰機之下。
   ★推估：作戰半徑 150 km（不含前進加油點）；只打離台澎海岸 30 km 內的船團（兩棲艦群、滾裝船團、補給船團）與已上岸的部隊；
   每批 4 架、每批約 8 枚地獄火；每個守方階段可出擊批數＝現有架數 × 妥善率（阿帕契 50%、眼鏡蛇 40%）× 制空係數（守方優勢 1、均勢 0.75、攻方優勢 0.5）÷ 4。
   命中（每批打掉 1 步的機率）：船團 阿帕契 25%、眼鏡蛇 20%（地獄火彈頭小，難以重創大型兩棲艦），有護航艦防空時 ×0.6；
   岸上部隊比照空襲，裝甲旅與重型合成旅門檻再低一級（反戰車飛彈）；眼鏡蛇門檻高一級（較舊的瞄準系統）。
   損失：每架 3%（附近有護航艦防空 8%、打岸上部隊而共軍有野戰防空 5%）；攻方空優 ×1.6、守方空優 ×0.6。 */
const HELI={
  b:[{id:'601',n:'601 旅',ac:'AH-64E 阿帕契',lon:121.21,lat:24.86,n0:29,ready:.5,ship:.25,land:0,hf:true},
     {id:'602',n:'602 旅',ac:'AH-1W 超級眼鏡蛇',lon:120.81,lat:24.22,n0:60,ready:.4,ship:.2,land:1,hf:false}],
  R:150,coast:30,pk:4,hfPer:8,hf0:1000,
  share:{def:1,mid:.75,atk:.5},loss:{ship:.08,land:.05,none:.03},lossAir:{def:.6,mid:1,atk:1.6}
};
const HELI_SHIP=['lst','ro','cvy'];
function heliB(id){return HELI.b.find(b=>b.id===id);}
// 基地格：離實際位置最近的台灣陸地格
function heliBaseK(b){
  if(b.k&&TER[b.k])return b.k;const [c,r]=llToRC(b.lon,b.lat);let h=TER[K(c,r)];
  if(!h||h.isl!=='TW'||!isLand(h))h=Object.values(TER).filter(x=>x.isl==='TW'&&isLand(x)).sort((a,x)=>hd(a,TER[K(c,r)]||a)-hd(x,TER[K(c,r)]||x))[0];
  b.k=h?h.k:null;return b.k;
}
function heliSt(){if(!S.heli){S.heli={hf:HELI.hf0};HELI.b.forEach(b=>{S.heli[b.id]={n:b.n0};});}return S.heli;}
const heliUp=b=>{const k=heliBaseK(b);return !!k&&S.owner[k]!=='atk'&&heliSt()[b.id].n>0;};
function heliBudget(b){
  const st=heliSt()[b.id],key=S.turn+S.phase;
  if(!st.bud||st.bud.t!==key)st.bud={t:key,n:heliUp(b)&&S.phase==='def'?takeInt(st.n*b.ready*(HELI.share[S.airCtl||'mid']||.75)/HELI.pk,'heliB:'+b.id):0};
  return st.bud.n;
}
let HELI_COAST=null;
function heliNearCoast(t){
  if(!HELI_COAST)HELI_COAST=Object.values(TER).filter(h=>(h.isl==='TW'||h.isl==='PH')&&isLand(h)&&nbrs(h.c,h.r).some(n=>n&&n.t==='sea'));
  const h=hexOf(t);return HELI_COAST.some(x=>hd(x,h)<=kmH(HELI.coast));
}
const heliDist=(b,t)=>Math.round(kmLL(rcToLL(TER[heliBaseK(b)].c,TER[heliBaseK(b)].r),rcToLL(t.c,t.r)));
function heliShipT(b){
  if(b.hf&&(heliSt().hf||0)<1)return [];
  return S.units.filter(e=>e.side==='atk'&&alive(e)&&atSea(e)&&HELI_SHIP.includes(e.type)&&heliNearCoast(e)&&heliDist(b,e)<=HELI.R);
}
function heliLandT(b){
  if(b.hf&&(heliSt().hf||0)<1)return [];
  return S.units.filter(e=>e.side==='atk'&&alive(e)&&!atSea(e)&&!e.ship&&(hexOf(e).isl==='TW'||hexOf(e).isl==='PH')&&heliDist(b,e)<=HELI.R);
}
const heliCover=t=>adCover(t).length>0;
function heliP(b,t){
  if(atSea(t))return b.ship*(heliCover(t)?.6:1);
  const arm=t.type==='arm'||t.type==='tank';return pNeed(5+terrCover(hexOf(t))-(arm?1:0)+b.land);
}
function heliLossRate(t){const base=atSea(t)?(heliCover(t)?HELI.loss.ship:HELI.loss.none):(S.pools&&S.pools.plaAD>0?HELI.loss.land:HELI.loss.none);return base*(HELI.lossAir[S.airCtl||'mid']||1);}
// 一批出擊：b＝旅、t＝目標
function heliStrike(b,t,auto){
  if(heliBudget(b)<=0){if(!auto)toast(b.n+'本階段已沒有可出擊的直升機',3000);return false;}
  const ok0=(atSea(t)?heliShipT(b):heliLandT(b)).includes(t);if(!ok0){if(!auto)toast('這個目標不在攻擊直升機的範圍內',3000);return false;}
  const st=heliSt(),h0=TER[heliBaseK(b)],from=[h0.c,h0.r];st[b.id].bud.n--;
  let nm='';if(b.hf){const n=Math.min(HELI.hfPer,Math.floor(st.hf));st.hf-=n;nm='地獄火 '+n+' 枚';}else nm='地獄火／拖式飛彈';
  useRec('攻擊直升機出擊（批，每批 4 架）',1,b.hf?'AGM-114L 地獄火':null,b.hf?HELI.hfPer:0,b.n,t);
  const p=heliP(b,t),hit=hitP(p,'heli:'+b.id+'>'+t.type);
  const L=Math.min(st[b.id].n,takeInt(HELI.pk*heliLossRate(t),'heliLoss'));st[b.id].n-=L;
  fxq({t:'air',at:[t.c,t.r],hit,tsea:atSea(t),from,k:'bomb'});
  const s='守方'+b.n+'（'+b.ac+'）以'+nm+'攻擊 '+hname(hexOf(t))+' 的 '+uname(t)+(hit?'：命中':'：未命中')+'（命中率 '+Math.round(p*100)+'%'+(L?'，被擊落 '+L+' 架':'')+'；推估）';
  log(s);if(!auto)fxToast(s,4000);
  if(hit)damage(t,1,b.n+'攻擊直升機');
  checkInstant();return true;
}
// 電腦自動：先打近岸船團（補給、兩棲優先），再打上岸的裝甲與兩棲部隊
function heliAuto(){
  if(S.over||S.phase!=='def')return;
  for(const b of HELI.b){let g=20;
    while(heliBudget(b)>0&&g-->0&&!S.over){
      const sh=heliShipT(b);if(sh.length){heliStrike(b,pickBest(sh,t=>tgtVal(t)+heliP(b,t)*3),true);continue;}
      const ld=heliLandT(b);if(ld.length){heliStrike(b,pickBest(ld,t=>tgtVal(t)*heliP(b,t)*10+t.hp),true);continue;}
      break;}
  }
}
// 地圖標籤（基地格上的小標籤，可點）
function heliTagsSVG(){
  if(!S.started)return '';let o='';
  for(const b of HELI.b){const k=heliBaseK(b);if(!k)continue;const h=TER[k],[x,y0]=cen(h.c,h.r),y=y0-R*.62,fs=8.5*Math.max(.72,SC),w=(b.id.length+2.2)*fs*.62+10,hh=fs+7,dead=!heliUp(b);
    o+='<g class="btag'+(dead?' lost':'')+'" data-hbase="'+b.id+'"><rect x="'+(x-w/2).toFixed(1)+'" y="'+(y-hh/2).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+hh.toFixed(1)+'" rx="3"/><text x="'+x.toFixed(1)+'" y="'+(y+fs*.36).toFixed(1)+'" text-anchor="middle" font-size="'+fs.toFixed(1)+'">🚁'+b.id+'</text></g>';}
  return o;
}
const heliAt=k=>HELI.b.find(b=>heliBaseK(b)===k);
const HELI_MODE_N={hlS:'攻擊近岸船團',hlL:'攻擊上岸部隊'};
function heliPanelHTML(b){
  const st=heliSt(),n=heliBudget(b),up=heliUp(b);
  let o='<h2 style="color:var(--def)">'+b.n+'（'+b.ac+'）</h2><div class="hint">現有約 '+st[b.id].n+' 架'+(up?'；本階段可出擊 '+n+' 批（每批 4 架）':S.owner[heliBaseK(b)]==='atk'?'；基地已被占領，無法出擊':'')+
    '；'+(b.hf?'AGM-114L 地獄火 '+Math.round(st.hf)+' 枚（2008 年軍售 1,000 枚）':'地獄火／拖式飛彈庫存未公開，不設上限')+'。作戰半徑約 '+HELI.R+' km，只打離岸 '+HELI.coast+' km 內的船團與上岸部隊；地獄火射程約 8 km，要飛到灘頭附近，會被艦艇防空與戰機擊落（推估）。沒用完的批數在階段結束時由電腦自動出擊。</div>';
  if(humanTurn()&&S.phase==='def'&&S.ctrl.def==='human'&&n>0){const nS=heliShipT(b).length,nL=heliLandT(b).length;
    o+='<div class="cvord"><button class="ghost" id="btnHlS"'+(nS?'':' disabled')+'>攻擊近岸船團<small class="pn">（'+(nS?'可打 '+nS+' 個':'範圍內沒有船團')+'）</small></button><button class="ghost" id="btnHlL"'+(nL?'':' disabled')+'>攻擊上岸部隊<small class="pn">（'+(nL?'可打 '+nL+' 個':'範圍內沒有上岸部隊')+'）</small></button></div>';
    setTimeout(()=>{[['btnHlS','hlS'],['btnHlL','hlL']].forEach(([id,m])=>{const e=document.getElementById(id);if(!e)return;const on=S.mode===m&&S.hlB===b.id;e.classList.toggle('on',on);
      e.onclick=()=>{S.hlB=b.id;S.sel=null;S.mode=on?null:m;if(!on&&typeof UC!=='undefined')UC.closedKey=UC.key;render();};});},0);}
  return o;
}
const heliRings=()=>{const b=heliB(S.hlB);if(!b)return [];return S.mode==='hlS'?heliShipT(b):S.mode==='hlL'?heliLandT(b):[];};
function heliClick(u){
  const b=heliB(S.hlB);if(!b||!(S.mode==='hlS'||S.mode==='hlL'))return false;
  const R=heliRings();if(u&&!R.includes(u)){const alt=R.find(x=>x.c===u.c&&x.r===u.r);if(alt)u=alt;}
  if(u&&R.includes(u)){heliStrike(b,u,false);if(heliBudget(b)<=0||!heliRings().length)S.mode=null;}
  else if(u&&u.side==='atk')toast('這個目標不在攻擊直升機的範圍內（按下方「取消出擊」可離開）',3000);
  else{S.mode=null;return false;}
  render();return true;
}
function heliRangeSVG(){
  const b=heliB(S.hlB);if(!b||!(S.mode==='hlS'||S.mode==='hlL'))return '';const h=TER[heliBaseK(b)];if(!h)return '';const o=[],lbl=[];
  rrRing(o,lbl,h.c,h.r,HELI.R/KM_HEX-.5,'r','def','攻擊直升機作戰半徑 '+HELI.R+' km（'+b.ac+'）',false);return o.join('')+lbl.join('');
}
