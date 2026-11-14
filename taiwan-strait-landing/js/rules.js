'use strict';
/* ---------- rules ---------- */
// 補給三條管道：①船團（卸載能力＝港口與灘頭，扣掉途中被打掉的）②空投 ③就地徵用（靠民心）。每回合攻方階段開始時結算一次。
function unloadCap(){ // 船團的卸載上限：攻方掌握的港口、灘岸格、灘頭堡（各格依所在海域的浪高）
  let capP=0,capB=0;
  const fb=wh=>Math.max(0,Math.min(1,(2.5-wh)/1.25)),fp=wh=>Math.max(.3,Math.min(1,(4-wh)/2)); // 浪高：灘頭 ≤1.25 公尺全額、≥2.5 公尺歸零；港口有防波堤，≥4 公尺降到三成
  for(const h of Object.values(TER)){
    if(h.isl==='TW'&&S.owner[h.k]==='atk'&&h.coastal&&!h.cliff&&h.t!=='mtn'){
      const wh=wxWave(h);
      if(h.t==='port')capP+=(S.portDown[h.k]?1:portCap(h.k))*fp(wh);else capB+=fb(wh);
      if(MINOR_PORTS[h.k]&&!S.portDown[h.k])capP+=2*fp(wh); // 次要港口
      else if(h.t!=='port'&&S.bh&&S.bh[h.k]&&S.turn-S.bh[h.k]>=1)capB+=2*fb(wh); // 灘頭堡：連續控制 2 個回合的灘岸格
    }
  }
  if(S.owner[MAGONG]==='atk')capB+=2*fb(wxWave(TER[MAGONG]));
  const cap=Math.round(capP+capB);
  return Math.max(0,cap-((S.mods.supCut&&S.mods.supCut[S.turn])||0)); // 守方破壞港口後勤／特種部隊突襲等造成的卸載能力下降
}
function supply(){
  const used=S.units.filter(u=>u.side==='atk'&&onTW(u)&&!isSup(u)).length;
  const cap=(S.sup&&S.sup.t===S.turn)?S.sup.total:unloadCap();
  return {cap,used,over:used>cap};
}
const goodwill=()=>Math.max(0,Math.min(1,1-(S.cost&&S.cost.civ?S.cost.civ.TW:0)/60000-Object.keys(S.portDown||{}).length*.08)); // 民心：平民傷亡與焦土都會降低
// 補給船團與灘頭補給站：真正的棋子。船團每回合從大陸港口出航，渡海抵達卸載點才算數；沿途會被守方的反艦飛彈、潛艦、戰機、無人機、快艇打，攻方靠護航艦保護
function unloadHexes(){ // 可卸貨的格子：攻方掌握的港口、次要港口、連續控制的灘頭、補給站所在格
  const L=[];for(const h of Object.values(TER)){
    if(h.isl!=='TW'||S.owner[h.k]!=='atk'||!h.coastal||h.cliff||h.mud)continue;
    const beach=h.t!=='mtn'&&h.t!=='port'&&enemyAdj(h.k,'atk')===0; // 已控制、周圍沒有敵軍的灘岸：登陸艦可以直接搶灘卸貨
    if((h.t==='port'&&!S.portDown[h.k])||MINOR_PORTS[h.k]||beach)L.push(h);
  }
  for(const f of S.units)if(f.side==='atk'&&f.type==='fob')L.push(hexOf(f));
  return L;
}
// ---------- 海運運力（運輸船棋子）：登陸成功不等於補給成功 ----------
// 兩棲艦群（兩棲攻擊艦、船塢登陸艦、坦克登陸艦，可搶灘）與滾裝船團（民間滾裝客貨輪，要港口卸載、較慢）。每個旅出海都要占用一艘；上岸後船在外海卸載、隔回合返航大陸港口、再裝載一回合才能重新使用；船被擊沉就永久損失。滾裝船團與補給船團共用同一個運力池（P.plaLift）。
const LSTBASE={'2026':5,'2027':5,'2028':6,'2029':6,'2030':6,'2031':6,'2032':7}; // 兩棲艦群：075／076 逐年服役（推估）
function applyLift(){
  const t=+($('#optLift')&&$('#optLift').value),tier=isNaN(t)?1:t,P=S.pools;
  // 第一波運力（個旅）：保守 4＋4＝8、中間 5＋6＝11、樂觀 5＋8＝13（2026 年，之後依年代成長；滾裝船團與補給船團共用）
  // 滾裝船團總數＝運旅用的＋補給用的；運旅最多只能動用超出「補給保留量」的部分，補給船團才不會被運旅搶光
  P.plaLst=[4,5,5][tier]+((LSTBASE[S.era]||5)-5);P.plaLift=[10,14,18][tier]+Math.max(0,P.plaLift-8);S.roReserve=[6,8,10][tier]+Math.max(0,S.p0.plaLift-8>0?0:0);S.p0.plaLst=P.plaLst;S.p0.plaLift=P.plaLift;S.lstBack={};
  return '海運運力：兩棲艦群 '+fmt1(P.plaLst)+'、滾裝船團 '+fmt1(P.plaLift)+'（'+['保守','中間','樂觀'][tier]+'估計）';
}
const isBde=u=>u.type==='amph'||u.type==='mar'||u.type==='arm';
function shipOf(u){return u.ship?S.units.find(x=>x.id===u.ship):null;}
function freeShipKind(u,h){ // 這個旅現在能不能裝船：回傳 'lst'／'ro'／null；已裝船回傳 'have'
  if(u.ship)return 'have';
  if(!isBde(u)||h.isl!=='CN'||!isLand(h))return 'na';
  const P=S.pools,port=h.t==='port',nearPort=port||Object.values(TER).some(q=>q.t==='port'&&q.isl==='CN'&&hd(h,q)<=2); // 滾裝船要靠碼頭：港口或港口 2 格內
  if(u.type==='arm')return nearPort&&P.plaLift>(S.roReserve||0)?'ro':nearPort&&P.plaLst>0?'lst':null; // 重型旅只能在港口附近裝船
  if(P.plaLst>0)return 'lst';
  if(nearPort&&P.plaLift>(S.roReserve||0))return 'ro';
  return null;
}
function embark(u,h){
  const kind=freeShipKind(u,h);if(kind==='have'||kind==='na'||!kind)return;
  const P=S.pools;if(kind==='lst')P.plaLst--;else P.plaLift--;
  const sh=mkUnit('atk',kind,h.k,{boundTo:u.id});S.units.push(sh);u.ship=sh.id;
  log(uname(u)+' 裝上'+TYPES[kind].n+'（剩 兩棲艦群 '+fmt1(P.plaLst)+'、滾裝船團 '+fmt1(P.plaLift)+'）');
}
function liftTurn(){ // 攻方階段開始：卸載完的運輸船返航大陸港口，靠港後裝載一回合再回到運力池
  const P=S.pools,t=S.turn;P.plaLst+=(S.lstBack&&S.lstBack[t])||0;
  const ports=Object.values(TER).filter(h=>h.t==='port'&&h.isl==='CN');if(!ports.length)return;
  const dp=h=>Math.min.apply(null,ports.map(q=>hd(h,q)));
  for(const sh of S.units.filter(x=>x.side==='atk'&&(x.type==='lst'||x.type==='ro')&&x.ret&&t>x.retT)){
    sh.moved=false;const rc=reach(sh);let b=null,bs=dp(hexOf(sh));
    for(const [k,v] of rc){if(v.kind!=='sail')continue;const sc=dp(TER[k]);if(sc<bs){bs=sc;b=k;}}
    if(b)doMove(sh,b,'sail');sh.moved=true;
    if(hexOf(sh).t==='port'&&hexOf(sh).isl==='CN'){S.units=S.units.filter(x=>x!==sh);if(sh.type==='lst'){S.lstBack=S.lstBack||{};S.lstBack[t+2]=(S.lstBack[t+2]||0)+1;}else{S.liftBack=S.liftBack||{};S.liftBack[t+2]=(S.liftBack[t+2]||0)+1;}log(TYPES[sh.type].n+' 返抵大陸港口，裝載後再度可用');}
  }
}
function convoyTurn(){ // 攻方階段開始：運輸船返航入列、派出新船團、全部船團自動朝最近的卸載點前進
  const P=S.pools,t=S.turn;P.plaLift+=(S.liftBack&&S.liftBack[t])||0;
  const sinks=unloadHexes();if(!sinks.length)return;
  const maxSend=Math.min(3,Math.floor((unloadCap()+S.units.filter(x=>x.side==='atk'&&x.type==='fob').length*2)/2)),have=S.units.filter(x=>x.side==='atk'&&x.type==='cvy').length;
  const ord=(S.supOrd&&S.supOrd[t])||{},n=Math.max(0,Math.min(P.plaLift,maxSend+(ord.rush?1:0)-have));
  for(let i=0;i<n;i++){const h=placeNear(FK('4,4'),x=>x.isl==='CN'&&x.t==='port');if(!h)break;S.units.push(mkUnit('atk','cvy',h.k,{fresh:t}));P.plaLift--;}
  if(n>0)log('攻方派出 '+n+' 個補給船團，目標：已掌握的港口與灘頭（運輸船剩 '+fmt1(P.plaLift)+'）');
  for(const u of S.units.filter(x=>x.side==='atk'&&x.type==='cvy')){
    if(u.fresh===t){u.moved=true;continue;} // 剛裝載好的船團這回合留在港內集結，下回合才出航（港內時守方的長程飛彈可以打到）
    u.moved=false;const rc=reach(u),h=hexOf(u);let best=null,bs=Math.min.apply(null,sinks.map(s2=>hd(h,s2)))+ssmThreat(h.k)*.6;
    for(const [k,v] of rc){if(v.kind!=='sail')continue;const hh=TER[k],sc=Math.min.apply(null,sinks.map(s2=>hd(hh,s2)))+ssmThreat(k)*.6+Math.random()*.3-(S.units.some(x=>x.side==='atk'&&x.type==='dd'&&hd(hexOf(x),hh)<=2)?.8:0);if(sc<bs-.2){bs=sc;best=k;}}
    if(best)doMove(u,best,'sail');u.moved=true;u.acted=true;
  }
}
function buildFob(){ // 在攻方掌握的灘頭或港口格建立灘頭補給站
  const h=fobSpot();if(!h)return null;S.units.push(mkUnit('atk','fob',h.k));return h;
}
function resolveSupply(){
  const P=S.pools,t=S.turn,ord=(S.supOrd&&S.supOrd[t])||{},intd=(S.mods.intd&&S.mods.intd[t])||null;
  if(!S.units.some(u=>u.side==='atk'&&!isShip(u)&&onTW(u))){S.sup=null;return;}
  const fobN=S.units.filter(u=>u.side==='atk'&&u.type==='fob').length;
  const AC=S.airCtl,by={},R={t},fa=rocAirEff();
  // ① 船團：已抵達卸載點的補給船團（棋子）卸貨；每回合總卸載量受港口、灘頭、補給站的卸載能力限制
  const ucap=Math.max(0,unloadCap()+fobN*2-(intd==='sabotage'?2:0));
  let unl=0;const arrived=[];
  const sinks=unloadHexes();
  for(const u of S.units.filter(x=>x.side==='atk'&&x.type==='cvy')){
    if(!atSea(u))continue;
    if(sinks.some(h=>hd(hexOf(u),h)<=1)){const c=u.hp;if(unl+c<=ucap){unl+=c;arrived.push(u);}}
  }
  arrived.forEach(u=>{S.units.splice(S.units.indexOf(u),1);S.liftBack=S.liftBack||{};S.liftBack[t+2]=(S.liftBack[t+2]||0)+1;});
  R.convoy={n0:ucap,hit:0,ok:unl,by:{},ships:arrived.length,sunkTotal:(S.stats.cvySunk||0)};
  // ② 空投：要天候允許、運輸機要穿過防空與戰機
  let an0=0,al=0;
  if(S.weather.air&&plaAirOld()>=1){an0=Math.min(2,Math.floor(plaAirOld()/3))+(ord.airlift?1:0);
    const pl=Math.min(.9,.15+(S.sead?0:.25)+(AC==='def'?.25:AC==='mid'?.1:0)+(fa>=2&&AC!=='atk'?.1:0)+(intd==='air'?.3:0));
    for(let i=0;i<an0;i++)if(hitP(pl,'airliftLoss')){al++;}} // 被擊落的是運輸機，不計入戰機架數
  R.air={n0:an0,lost:al,ok:an0-al};
  // ③ 就地：占領區徵用燃料、糧食、彈藥庫存，數量要看民心
  let owned=0;for(const h of Object.values(TER))if(h.isl==='TW'&&isLand(h)&&S.owner[h.k]==='atk')owned++;
  const gw=goodwill(),loc=Math.max(0,Math.round(Math.min(2,owned/60)*gw+(ord.requisition?gw:0))-(intd==='deny'?1:0)); // 守方阻絕就地徵用：−1
  if(ord.requisition&&S.cost&&S.cost.civ)S.cost.civ.TW+=1200; // 強行徵用會增加民怨與傷亡
  R.local={n:loc,gw:Math.round(gw*100),owned};
  // 第一次結算：登陸部隊隨身攜帶的基數（約 4 點），之後靠船團、空投與就地補給
  const stock=(S.sup&&S.sup.stockNext!=null)?S.sup.stockNext:4;R.stock=stock;R.total=R.convoy.ok+R.air.ok+R.local.n+stock-(ord.fob?2:0);
  const used0=S.units.filter(u=>u.side==='atk'&&onTW(u)&&!isSup(u)).length;R.stockNext=Math.max(0,Math.min(2+3*fobN,R.total-used0));S.sup=R;
  const bys=Object.entries(by).map(([k,v])=>k+' '+v).join('、');
  log('補給結算：補給船團 '+R.convoy.ships+' 個抵達卸貨（'+R.convoy.ok+' 點，卸載上限 '+ucap+'；累計損失船團 '+(S.stats.cvySunk||0)+' 個）；庫存 '+stock+'；空投 '+an0+(an0?'、被擊落 '+al:'（天候或空軍不足）')+'；就地 '+loc+'（民心 '+R.local.gw+'%）；合計補給容量 '+R.total);
}
function weak(u){return u.hp===1&&TYPES[u.type].hp>1?1:0;}
// 剛動員的後備旅：裝備（整旅動員的瓶頸）與人員還在編成，攻防各 −1；從動員的守方階段，到下一個攻方階段結束為止（★推估：「一回合」）
const unready=u=>u.type==='res'&&u.mobT!=null&&(S.turn===u.mobT||(S.turn===u.mobT+1&&S.phase==='atk'))?1:0;
function effAtk(u){return TYPES[u.type].atk+sideMod(u,'atk')-weak(u)-unready(u)-(u.side==='atk'&&onTW(u)&&supply().over?1:0);}
function effDef(u){return TYPES[u.type].def+sideMod(u,'def')-weak(u)-unready(u)-(u.side==='atk'&&onTW(u)&&supply().over?1:0)-(unitsAt(K(u.c,u.r)).filter(x=>!isShip(x)).length>1?1:0);}
function terrDef(h){return h.t==='city'||h.t==='mtn'?2:h.t==='port'?1:0;}
function seaPen(u){if(!atSea(u))return 0;const wh=wxWave(hexOf(u)),wp=wh>2?2:wh>1.25?1:0;return (u.type==='mar'?-1:-2)-wp;} // 搶灘突擊：浪高越大，登陸艇越難靠岸（>1.25 公尺 −1、>2.0 公尺 −2）
function inZOC(side,h){
  return ring2(h).some(n=>unitsAt(n.k).some(e=>e.side!==side&&isLand(n)&&!isMsl(e)&&!isShip(e)&&!(e.type==='abn'&&n.isl==='CN')));
}
function support(u,t){
  let n=0;
  for(const h of ring2(t))for(const f of unitsAt(h.k))if(f!==u&&f.side===u.side&&!isMsl(f)&&!(h.isl==='CN'))n++;
  return Math.min(2,n);
}
const canSail=u=>u.type==='ff'||u.type==='hk'||u.type==='ssn'||u.type==='csg'||(u.side==='atk'&&(u.type==='amph'||u.type==='mar'||u.type==='arm'||u.type==='dd'||u.type==='cv'||u.type==='cvy'||u.type==='lst'||u.type==='ro'));
function canEmbark(u,h){
  if(u.type==='ff'||u.type==='hk')return h.t==='port'&&unitsAt(h.k).every(x=>x.side===u.side);
  if(!isLand(h)||!h.coastal||S.owner[h.k]!=='atk')return false;
  return h.t==='port'||(u.type!=='arm'&&h.isl==='CN');
}
// 浮動碼頭：共軍 2023～2025 年演習以浮動碼頭與駁船讓民用滾裝船在灘頭卸載車輛。只有攻方已控制、周圍沒有守軍的灘頭可以架設，★浪高 1.25 公尺以下（浮動碼頭怕浪）
const floatPier=h=>!!h&&h.isl==='TW'&&isLand(h)&&h.coastal&&!h.cliff&&!h.mud&&h.t!=='mtn'&&S.owner[h.k]==='atk'&&enemyAdj(h.k,'atk')===0&&wxWave(h)<=1.25;
function validLanding(u,h){
  if(h.isl==='JP')return false; // 日本島嶼：目前沒有日本地面部隊棋子，暫不開放登陸
  if(!isLand(h)||!h.coastal||h.cliff||h.mud||h.t==='mtn'||h.k===TAIPEI)return false;
  const sh=shipOf(u),ro=sh&&sh.type==='ro';
  if(u.type==='arm')return (h.t==='port'&&S.owner[h.k]==='atk'&&!S.portDown[h.k])||(ro&&floatPier(h));
  if(ro&&h.t!=='port'&&!floatPier(h))return false; // 滾裝船團不能搶灘：要在港口，或已控制灘頭的浮動碼頭卸載
  return true;
}
function moveCost(u,h){return h.t==='mtn'?(u.type==='arm'||u.type==='tank'?3:2):1;}

function landReach(u,res){
  const start=hexOf(u);const best=new Map([[start.k,TYPES[u.type].mv]]);const q=[[start,TYPES[u.type].mv]];
  while(q.length){
    const [h,mp]=q.shift();
    if(h!==start&&inZOC(u.side,h))continue;
    for(const n of nbrs(h.c,h.r)){
      if(!isLand(n))continue;
      const cost=moveCost(u,n);
      if(cost>mp&&!(h===start))continue;
      const occs=unitsAt(n.k),occ=occs[0];if(occ&&occ.side!==u.side)continue;
      const left=Math.max(0,mp-cost);
      if((best.has(n.k)?best.get(n.k):-1)>=left)continue;
      best.set(n.k,left);
      if(n!==start&&canStack(u,n.k))res.set(n.k,{kind:'move'});
      q.push([n,left]);
    }
  }
}
// 海上移動（每回合 12 小時的有效推進，不是全速直線航行）：
// 船團與運兵船要集結編隊、走掃雷航道、配合護航 → 依天候 5／4／2 格；
// ★作戰艦（護航艦、航艦、守方艦艇）不必配合船團、但要警戒與走之字航線 → 天候格數 +2；
// ★潛艦在水下幾乎不受浪高影響：3 格以內為安靜潛航，最多 5 格（高速或呼吸管航行，噪音大，下一次被反潛發現的機率加倍）
const SPD={war:2,subQuiet:3,subMax:5};
const isWarship=u=>isEsc(u)||u.type==='cv'||u.type==='csg'||u.type==='dd'||u.type==='ff';
const seaMove=u=>u.type==='hk'||u.type==='ssn'?SPD.subMax:(S.weather&&S.weather.base!=null?seaOfH(wxWave(hexOf(u))):S.weather.sea)+(isWarship(u)?SPD.war:0); // 依所在海域的浪高
function seaReach(u,res){
  const here=hexOf(u);const startSea=here.t==='sea';
  if(!startSea&&!canEmbark(u,here))return;
  const sm=seaMove(u);const best=new Map();const q=[];
  const visitSea=(n,left)=>{
    if((best.has(n.k)?best.get(n.k):-1)>=left)return;
    best.set(n.k,left);if(canStack(u,n.k)&&!res.has(n.k))res.set(n.k,{kind:'sail'});q.push([n,left]);
  };
  if(startSea){best.set(here.k,sm);q.push([here,sm]);}
  else for(const n of nbrs(here.c,here.r))if(n.t==='sea')visitSea(n,sm-1);
  while(q.length){
    const [h,mp]=q.shift();if(mp<1)continue;
    for(const n of nbrs(h.c,h.r)){
      if(n.t==='sea')visitSea(n,mp-1);
      else if(dockOK(u,n))res.set(n.k,{kind:'sail'}); // 潛艦與船艇可以靠進己方港口（母港、避風）
      else if(n!==here&&!isShip(u)&&validLanding(u,n)&&canStack(u,n.k)&&(!res.has(n.k)||res.get(n.k).kind!=='move'))res.set(n.k,{kind:'land'});
    }
  }
}
function reach(u){
  const res=new Map();if(u.moved||u.acted)return res;const h=hexOf(u);
  if(u.boundTo)return res; // 載著旅的運輸船跟著旅一起走
  if(u.esc)return res; // 護航艦跟著航艦移動，不單獨移動
  if(u.type==='abn'&&!u.dropped&&h.isl==='CN'){
    if(S.weather.air)for(const t of Object.values(TER)){
      if((t.isl==='TW'||t.isl==='PH')&&t.t!=='mtn'&&canStack(u,t.k)&&rd(h,t)<=20)res.set(t.k,{kind:'drop'});
    }
    return res;
  }
  if(isLand(h)&&u.type!=='ff'&&u.type!=='hk')landReach(u,res);
  if(canSail(u))seaReach(u,res);
  if(isBde(u)&&!u.ship&&isLand(h)&&h.isl==='CN'&&freeShipKind(u,h)===null)for(const [k,v] of [...res])if(v.kind==='sail'||v.kind==='land')res.delete(k); // 沒有可用的運輸船就出不了海
  return res;
}
function targets(u){
  if(u.acted)return [];
  if(u.type==='hmr'){ // 海馬士：打陸上目標。火箭（GMLRS）射程約 80 km＝4 格；陸軍戰術飛彈（ATACMS）約 300 km＝14 格；各自有實際庫存（rocGml、rocAtc）
    if(u.shots<=0||ssmReady(u)-(u.lu||0)<=0)return [];const hu=hexOf(u),P=S.pools||{},atc=(P.rocAtc||0)>=1,gml=(P.rocGml||0)>=1;if(!atc&&!gml)return [];
    return S.units.filter(e=>e.side!==u.side&&!atSea(e)&&!isMsl(e)&&hexOf(e).isl!=='CN'&&(()=>{const d=rd(hu,hexOf(e));return d<=(atc?14:4);})());} // 大陸沿岸集結中的部隊不在目標內（那由長程對地打擊處理）
  if(u.type==='mlrs'){ // 雷霆2000：面積性火力，射程依彈種 15／30／45 km（每格約 20 km）＝最遠 2 格；打海灘上的部隊與靠岸的船團（反登陸），需有彈藥庫存
    if(u.shots<=0||(S.pools&&S.pools.rocRkt||0)<1)return [];const hu=hexOf(u);
    return S.units.filter(e=>e.side!==u.side&&!isMsl(e)&&hexOf(e).isl!=='CN'&&rd(hu,hexOf(e))<=2);}
  if(isEsc(u))return escTargets(u);
  if(u.type==='hk')return subTargets(u);
  if(u.type==='ssn'){if(u.acted||!(u.tp>0||u.hm>0))return [];return shipFoes(u,6).filter(e=>(u.tp>0&&rd(hexOf(u),hexOf(e))<=3)||u.hm>0);}
  if(u.type==='nme'||u.type==='mdt'){if(u.acted||!u.mag||u.mag.asm<=0)return [];return shipFoes(u,u.type==='nme'?NME.R:MDT.R);}
  if(isMsl(u)){if(u.shots<=0||(u.fl&&!(u.mag&&u.mag.asm>0)))return [];const R=u.fl?fleetAgg(u).asmR:8;return S.units.filter(e=>e.side!==u.side&&atSea(e)&&!e.ship&&rd(hexOf(u),hexOf(e))<=R);} // 船上的旅不單獨列為目標：打運輸船，船沉了旅一併損失
  const h=hexOf(u);if(h.isl==='CN')return [];
  return ring2(h).flatMap(n=>unitsAt(n.k)).filter(e=>e.side!==u.side&&!atSea(e)&&canHitSub(e)); // 海上的潛艦不能被地面部隊直接攻擊；港內的可以
}

function damage(u,n,why){ // 船與船上的旅同進退：但旅在搶灘戰鬥中的損失不會讓外海的運輸艦跟著沉（損失的是登陸艇與部隊）；船被擊沉時船上的旅一併損失
  if(!S._mir&&!(u.ship&&(!why||why==='地面戰鬥'))){const link=u.ship?S.units.find(x=>x.id===u.ship):u.boundTo?S.units.find(x=>x.id===u.boundTo):null;if(link&&alive(link)){S._mir=true;try{damage(link,n,why);}finally{S._mir=false;}if(!alive(u))return false;}} // 船與船上的旅同進退
  S.hits.push({c:u.c,r:u.r,t:S.turn,side:u.side,type:u.type,n:Math.min(n,u.hp),sea:atSea(u),why:why||'地面戰鬥',dead:n>=u.hp,cvn:u.type==='cv'&&u.cvi!=null?AIR.CV[u.cvi].n:null});
  fxq({t:'dmg',id:u.id,at:[u.c,u.r],n:Math.min(n,u.hp),side:u.side});
  if(isLch(u)&&u.veh!=null&&!S._vehHit){u.veh=Math.max(0,Math.round(u.veh-n*ssmVPS(u)));u.fk=(u.fk||[]).slice(0,u.veh);} // 地面戰鬥、先制打擊：每步＝4 輛完全摧毀
  u.hp-=n;if(u.fl&&u.hp>0)fleetLose(u,n);
  if((u.type==='cv'||u.type==='csg')&&u.hp===1&&!u.ooaN){u.ooaN=1;const nm=u.type==='csg'?(csgFx(u)?csgName(csgIdx(csgFx(u).id)):'美軍航艦'):(u.cvi!=null?AIR.CV[u.cvi].n:'共軍航艦');log(nm+'受創失去戰鬥能力（飛行甲板受損，艦載機無法起降），撤離戰場修理');bigNews(nm+'受創撤離',nm+'遭重創、失去作戰能力，在護航艦掩護下撤離戰場。');}if(u.type==='dd'&&u.mag&&u.hp>0)u.mag.ad=Math.min(u.mag.ad,Math.round(DDW.ad*u.hp/TYPES.dd.hp));if(u.type==='ssn'&&!u.grp){const f=S.fx.units.find(x=>x.id==='ssn');if(f)f.hp=Math.max(0,u.hp);}if(window.TSL_RUMBLE)TSL_RUMBLE('hit'); // 手把震動（無手把時無效）
  if(u.type==='csg'){const f=csgFx(u);if(f){f.hp=Math.max(0,u.hp);if(f.hp<=0)usCarrierSunk(why||'共軍攻擊');else log(csgName(csgIdx(f.id))+'在'+hname(hexOf(u))+'受創（'+(why||'未知攻擊')+'），'+cvSt(f.hp,f.max)+'，艦載機出擊能力下降');}}
  if(u.type==='cv'&&u.side==='atk'){const at=hname(hexOf(u))+'（'+(why||'未知攻擊')+'）';log(u.hp<=0?'共軍航艦群在'+at+'被擊沉，失去戰鬥能力':'共軍航艦群在'+at+'受創（'+cvSt(u.hp,mhpOf(u))+'），戰力下降');}
  if(u.hp<=0){if(isEsc(u)){S.stats.escLost=S.stats.escLost||{atk:0,def:0};S.stats.escLost[u.side]++;}if(u.type==='ssn')S.stats.ssnLost=(S.stats.ssnLost||0)+1;if(u.ally==='JP')S.stats.jpShip=(S.stats.jpShip||0)+1;
    if(['amph','mar','abn','arm','inf','tank','res'].includes(u.type)){S.stats.bdeLost=S.stats.bdeLost||{atk:0,def:0};S.stats.bdeLost[u.side]++;}
    if(u.type==='cvy'){S.stats.cvySunk=(S.stats.cvySunk||0)+1;if(S.pools)S.pools.plaLift=Math.max(0,S.pools.plaLift)+0;}
    if(u.type==='fob')log('攻方灘頭補給站被摧毀：卸載能力與庫存空間下降');
    fxq({t:'dead',at:[u.c,u.r],type:u.type,side:u.side,id:u.id});ghostAdd(u);S.units=S.units.filter(x=>x!==u);
    if(u.boundTo){const b=S.units.find(x=>x.id===u.boundTo);if(b){S.hits.push({c:b.c,r:b.r,t:S.turn,side:b.side,type:b.type,n:b.hp,sea:true,why:'運輸船被擊沉',dead:true});S.stats.bdeLost=S.stats.bdeLost||{atk:0,def:0};S.stats.bdeLost[b.side]++;S.units=S.units.filter(x=>x!==b);S.stats.lstSunk=(S.stats.lstSunk||0)+1;log('運輸船被擊沉，船上的 '+TYPES[b.type].n+' 一併殲滅');}}
    if(u.ship){const sh=shipOf(u);if(sh)S.units=S.units.filter(x=>x!==sh);}if(u.type==='dd'&&S.pools)S.pools.plaNavy=Math.max(0,S.pools.plaNavy-1);if(u.type==='ff'&&S.pools)S.pools.rocNavy=Math.max(0,S.pools.rocNavy-1);if(u.type==='hk'&&S.pools)S.pools.rocSub=Math.max(0,S.pools.rocSub-1);if(u.type==='cv'&&S.pools){S.pools.plaCV=Math.max(0,S.pools.plaCV-1);if(u.cvi!=null){S.cvGone=S.cvGone||[];S.cvGone.push(u.cvi);if(S.air)S.air.cvF[u.cvi]=0;}plaCarrierLost(why,'守方');}
    if(!isShip(u)){const rest=unitsAt(K(u.c,u.r));if(rest.length&&rest.every(isShip)){rest.forEach(x=>{fxq({t:'dead',at:[x.c,x.r],type:x.type,side:x.side});S.units=S.units.filter(y=>y!==x);if(x.type==='ff')S.pools.rocNavy=Math.max(0,S.pools.rocNavy-1);if(x.type==='dd')S.pools.plaNavy=Math.max(0,S.pools.plaNavy-1);if(x.type==='cv')S.pools.plaCV=Math.max(0,S.pools.plaCV-1);log(uname(x)+' 隨港口失守而損失');});}}log(uname(u)+' 在 '+hname(hexOf(u))+' 被殲滅'+(why?'（'+why+'）':''));return true;}
  return false;
}
// 占領：該格與周圍沒有敵軍的陸地格一併易主（細格版的「控制範圍」）
function claim(side,h){
  S.owner[h.k]=side;
  if(side==='atk'&&h.t==='air'&&h.isl==='TW'){S.afl=S.afl||{};if(!S.afl[h.k]){S.afl[h.k]=1;const lost=airLose('def',S.air?S.air.TW/Math.max(1,airfields().length)*.25:0,'ground');log('攻方占領 '+(h.name||'機場')+'，來不及撤離的守方戰機 −'+lost+' 架（推估：該基地約四分之一）');}}
  for(const n of nbrs(h.c,h.r)){if(!isLand(n)||n.t==='port'||n.k===TAIPEI)continue;if(n.isl!==h.isl)continue;if(unitsAt(n.k).some(e=>e.side!==side))continue;if(n.isl==='CN'&&side!=='atk')continue;S.owner[n.k]=side;}
}
// 復原與防呆：人類操作的普通移動／出航可以撤銷（在做任何其他動作前）；結束階段時若還有沒用的火力或可行動單位，需再按一次確認
function humanMove(u,k,kind){
  const keep=(kind==='move'||kind==='sail')?{id:u.id,turn:S.turn,phase:S.phase,c:u.c,r:u.r,acted:u.acted,hp:u.hp,owner:Object.assign({},S.owner),logN:S.log.length?S.log[0].n:0}:null;
  doMove(u,k,kind);
  S.undo=keep&&alive(u)&&u.hp===keep.hp?Object.assign(keep,{stamp:LOGN}):null;
}
function undoAvail(){const q=S.undo;if(!q||!S.started||S.over||q.turn!==S.turn||q.phase!==S.phase||q.stamp!==LOGN)return false;const u=S.units.find(x=>x.id===q.id);return !!(u&&u.hp===q.hp);}
function undoMove(){
  if(!humanTurn()||!undoAvail())return;
  const q=S.undo,u=S.units.find(x=>x.id===q.id);
  u.c=q.c;u.r=q.r;u.moved=false;u.acted=q.acted;S.owner=q.owner;
  while(S.log.length&&S.log[0].n>q.logN)S.log.shift();
  S.undo=null;S.sel=u;toast('已撤銷移動');render();
}
function endPhaseGuard(){ // 回傳 true＝先擋下並提示
  const atkP=S.phase==='atk',fire=atkP?S.fire:(S.dfire||0);
  const idle=S.turn<=2?S.units.filter(u=>u.side===S.phase&&!u.garrison&&!u.ally&&!isSup(u)&&reach(u).size>0).length:0;
  const msg=[];if(fire>0)msg.push('還有 '+fire+' 點火力沒用（不會累積到下回合）');if(idle>0)msg.push('還有 '+idle+' 個單位可以行動');
  const b=$('#btnEnd');
  if(!msg.length||endPhaseGuard.t>Date.now()){endPhaseGuard.t=0;b.textContent=TX('結束階段');return false;}
  endPhaseGuard.t=Date.now()+4000;b.textContent=TX('確定結束階段？');toast(msg.join('；')+'。再按一次「結束階段」確認。',3500);
  clearTimeout(endPhaseGuard.h);endPhaseGuard.h=setTimeout(()=>{endPhaseGuard.t=0;b.textContent=TX('結束階段');},4000);
  return true;
}
function doMove(u,k,kind){
  const from=hexOf(u);const h=TER[k];
  if(u.type==='hk'&&kind==='sail'){u.loud=hd(from,h)>SPD.subQuiet;if(u.loud&&!subHidden(u))log('海鯤潛艦高速航行 '+hd(from,h)+' 格（超過 '+SPD.subQuiet+' 格），噪音大，下一次被反潛發現的機率加倍');}
  if(kind==='sail'&&isBde(u)&&!u.ship&&isLand(from)&&from.isl==='CN')embark(u,from);
  u.c=h.c;u.r=h.r;u.moved=true;if(u.type==='cv'||u.type==='csg'||u.type==='ddh')escFollow(u); // 護航艦跟著航艦移動
  if(u.ship&&(kind==='sail'||kind==='move')){const sh=shipOf(u);if(sh){sh.c=u.c;sh.r=u.r;}}
  if(u.ship&&kind==='land'){const sh=shipOf(u);if(sh){sh.boundTo=null;sh.ret=true;sh.retT=S.turn;}u.ship=null;} // 上岸後船留在外海卸載，下回合起返航
  if(isLand(h))claim(u.side,h);
  if((kind==='land'||kind==='drop')&&S.stats.firstLand===null&&h.isl==='TW')S.stats.firstLand=S.turn;
  if(kind==='land'){fxq({t:'land',at:[h.c,h.r]});u.acted=true;log(uname(u)+' 於 '+hname(h)+' 登陸');mineCheck(u,h);}
  else if(kind==='drop'){
    u.acted=true;u.dropped=true;
    let msg=uname(u)+' 空降 '+hname(h);
    const hot=inZOC(u.side,h);
    if(hitP(hot?.5:1/6,hot?'dropHot':'dropAD')){msg+='，'+(hot?'落點遭地面火力壓制':'運輸機群遭防空攔截')+'（'+lastTxt()+'）損失 '+stpU(u,1);log(msg);damage(u,1,'空降損失');return;}
    log(msg);
  } else{if(kind==='sail'&&from.t!=='sea'&&!subHidden(u))log(uname(u)+' 自 '+hname(from)+' 出航');if(kind==='sail'||kind==='move')mineCheck(u,h);}
}
function attack(u,t){
  const th=hexOf(t);if(th.isl==='TW'||th.isl==='PH')civHit('TW',th,'combat');
  const sup=support(u,t),pen=seaPen(u);
  const A=effAtk(u)+sup+pen, D=effDef(t)+terrDef(th), x=A-D;
  // 兵力對比 → 攻方壓制的機率 s0；骰子只讓它有限度起伏
  const s0=1/(1+Math.exp(-(x+.6)*.5)),s=Math.max(.02,Math.min(.98,s0)),gk=u.type+'>'+t.type;
  // 固定規則：期望損失依兵力對比算出，整數部分立即損失、零頭累積到之後的戰鬥（不再擲骰）
  const pD=Math.max(0,Math.min(.45,(x-1)/9)),pA=Math.max(0,Math.min(.35,-x/10+.1));
  let ld=takeInt(s*(1+pD),'gnd.d:'+gk),la=takeInt((1-s)*.8*(1+pA),'gnd.a:'+gk);
  ld=Math.min(2,ld);la=Math.min(2,la);
  if(!ld&&!la){if(takeInt(s,'gnd.f:'+gk)>=1)ld=1;else la=1;}
  const res=ld&&la?'雙方各有損失（守方 −'+stpN(ld)+'、攻方 −'+stpN(la)+'）':ld?'守方失 '+stpN(ld):'攻擊方失 '+stpN(la);
  log((pen?'搶灘突擊：':'')+uname(u)+' 攻擊 '+hname(th)+' 的 '+TYPES[t.type].n+'：'+A+' 對 '+D+'（壓制機率 '+Math.round(s0*100)+'%，固定規則）→ '+res);
  fxq({t:'atk',from:[u.c,u.r],to:[t.c,t.r],hit:ld>0,sea:atSea(u),tsea:atSea(t)});if(!ld)fxq({t:'txt',at:[t.c,t.r],s:'擋住',col:'def'});
  u.acted=true;u.moved=true;
  const tDead=ld?damage(t,ld):false;
  const uDead=la?damage(u,la):false;
  if(tDead&&!uDead){
    const can=(atSea(u)?validLanding(u,th):true)&&unitsAt(th.k).every(isShip);
    if(can){unitsAt(th.k).filter(isShip).forEach(x=>damage(x,x.hp,'港口失守'));u.c=th.c;u.r=th.r;claim(u.side,th);log(TYPES[u.type].n+' 推進佔領 '+hname(th));}
  }
  checkInstant();
}
// 航艦的點防禦：自身加附近護航艦；來襲飛彈超過防禦量就形成飽和攻擊（超出 3 枚必中）
function satHit(t){
  t.inc=(t.inc||0)+1;if(t.type!=='cv')return 0;
  const pd=1+S.units.filter(x=>x.type==='dd'&&x.side==='atk'&&rd(hexOf(x),hexOf(t))<=2).length;
  return Math.max(0,Math.min(3,t.inc-pd));
}
function fireHimars(m,t){
  const P=S.pools||{},d=rd(hexOf(m),hexOf(t)),atc=d>4||(P.rocGml||0)<1,h=hexOf(t),key=atc?'rocAtc':'rocGml'; // 沒有火箭彈時，近距離目標也只能用陸軍戰術飛彈
  const n=Math.max(0,Math.min(HMR_PKG,ssmReady(m)-(m.lu||0),Math.floor(P[key]||0))); // 這次齊射的車數：受可射車數與庫存限制
  m.shots--;m.lu=(m.lu||0)+n;m.revealed=true; // 開火後暴露，下個守方階段前都是顯眼目標
  if(S.pools)S.pools[key]=Math.max(0,(S.pools[key]||0)-n); // 每輛 1 枚 ATACMS 或 1 個火箭莢艙（6 發）
  const need=Math.min(6,(atc?5:4)+((h.t==='city'||h.t==='mtn')?1:0)),fr=n/HMR_PKG,hit=hitP(pNeed(need)*fr,'fireHimars'); // 不滿 4 輛時命中率依比例縮小
  fxq({t:'hmr',from:[m.c,m.r],to:[t.c,t.r],hit,atc});
  log('海馬士 '+n+' 輛齊射 '+(atc?n+' 枚陸軍戰術飛彈':n+' 個火箭莢艙（'+n*6+' 發）')+'（庫存剩 '+Math.round(S.pools?S.pools[key]:0)+(atc?' 枚飛彈）':' 個莢艙）')+(hit?'，命中 ':'，未命中 ')+hname(h)+' 的 '+TYPES[t.type].n+'（'+lastTxt()+'）');
  if(hit)damage(t,1,'海馬士火箭砲');
  checkInstant();
}
function fireMlrs(m,t){
  const h=hexOf(t),sea=atSea(t),d=rd(hexOf(m),h);
  m.shots--;m.rl=1;m.revealed=true; // 開火後暴露；再裝填要補給與時間，下個階段不能開火
  if(S.pools)S.pools.rocRkt=Math.max(0,S.pools.rocRkt-1);
  const need=Math.min(6,(sea?6:5)+((!sea&&(h.t==='city'||h.t==='mtn'))?1:0)),fr=lchFrac(m),hit=hitP(pNeed(need)*fr,'fireMlrs'); // 無導引面積火力：命中率比海馬士低；打機動中的船更難
  fxq({t:'hmr',from:[m.c,m.r],to:[t.c,t.r],hit,atc:false});
  log('雷霆2000發射火箭彈（'+(d<=1?'15 km 級':'30～45 km 級')+'）'+(fr<1?'（可射 '+ssmReady(m)+'／'+lchV0(m)+' 輛）':'')+(hit?'，命中 ':'，未命中 ')+hname(h)+' 的 '+TYPES[t.type].n+'（'+lastTxt()+'）');
  if(hit)damage(t,1,'雷霆2000火箭');
  checkInstant();
}
const SSM_N=2; // ★岸置發射車與艦艇每次發射 2 枚（雄風二、三型發射車每車 4 枚）
// 岸置反艦飛彈單位＝一群分散的機動發射車（★每單位 8 輛；官方未公開實際數量）。2 步＝每步 4 輛。
// 精準打擊命中只影響 1 輛（分散部署，一個打擊包只能鎖定一輛），依毀傷評估分級（美國陸軍 BRL 定義：機動／火力／完全摧毀）：
//  ★完全摧毀 50%：永久損失；★火力殺傷 30%：2 回合（24 小時）不能射，之後修復；★機動殺傷 20%：沒法打完就跑，整個單位到下一個攻方階段結束都維持暴露
// 分級用小數累計（不是擲骰）；地面戰鬥或先制打擊造成的「步」損失，每步＝4 輛完全摧毀
// 海馬士與雷霆2000 也是機動發射車，套用同樣的分級毀傷：
//  海馬士：[發射車, 棋子數, 陸軍戰術飛彈（枚）, GMLRS 火箭莢艙（個，每個 6 發）]，車數平均分給各棋子
//   2026：首批 11 輛（2024 年 9 月到貨）、ATACMS 64 枚、GMLRS 864 發（144 莢艙，依中央社等報導隨首批接裝；★另有報導說隨第二批到貨，使用者選擇採前者）；第二批 18 輛＋ATACMS 20 枚依報導 2026 年底前到貨
//   2027：共 29 輛、ATACMS 84 枚、144 莢艙（2022 年追加案）
//   2025 年 12 月美國核准再售 82 輛、ATACMS 420 枚、GMLRS 1,203 莢艙（756 M31A2＋447 M30A2）；交付時程未公開，合約預計 2032 年完成：★假設 2029 年起每年平均交付 1／4
//  雷霆2000：Oryx 2023 年清點陸軍有 43 輛，遊戲 4 組＝每組約 11 輛
const SSM={veh:8,K:.5,F:.3,fix:2};
const HMR_ERA={'2026':[11,3,64,144],'2027':[29,3,84,144],'2028':[29,3,84,144],'2029':[50,4,189,445],'2030':[70,5,294,746],'2031':[91,6,399,1046],'2032':[111,6,504,1347]},MLRS_VEH=11;
const HMR_PKG=4; // ★一次射擊任務＝最多 4 輛（約一個排）齊射，每輛 1 個火箭莢艙（6 發）或 1 枚陸軍戰術飛彈；每階段的射擊次數＝可射車數 ÷ 4（無條件進位）
const hmrEra=()=>HMR_ERA[S.era]||HMR_ERA['2026'];
const splitN=(tot,n)=>Array.from({length:n},(_,i)=>Math.floor(tot/n)+(i<tot%n?1:0)); // 車數平均分配（餘數給前面的棋子）
const isLch=u=>!!u&&(u.type==='ssm'||u.type==='hmr'||u.type==='mlrs');
const lchVeh0=type=>type==='ssm'?SSM.veh:type==='hmr'?Math.round(hmrEra()[0]/hmrEra()[1]):MLRS_VEH;
const lchV0=u=>u.veh0||lchVeh0(u.type);
const ssmVPS=u=>lchV0(u)/TYPES[u.type].hp;
const ssmBroken=u=>(u.fk||[]).filter(t=>t>S.turn).length;
const ssmReady=u=>Math.max(0,(u.veh==null?lchV0(u):u.veh)-ssmBroken(u));
const lchFrac=u=>u.veh==null?1:ssmReady(u)/lchV0(u); // 可射的車占原本的比例（海馬士、雷霆的火力依此縮小）
// ---------- 殺傷鏈：打擊機動發射車前，先要找到它、而且飛彈到時它還在 ----------
// 依據：1991 年獵殺飛毛腿幾乎沒有確認戰果（誘餌、夜間）；以色列在伊朗上空長期掌握空域、偵察不斷，宣稱戰果高得多。數字皆★推估：
//  沒暴露（隱蔽中）：定位機率依制空——攻方優勢 75%、均勢 45%、守方優勢 30%（共軍偵察機與無人機能不能在台灣上空滯留）；
//   夜間 ×0.7（光學偵察受限，紅外線與雷達衛星仍可用）、雲雨或颱風 ×0.6、守方誘餌政策 ×0.75
//  已暴露（上階段開火）：要看飛彈到時發射車是否已轉移——彈道飛彈與火箭數分鐘到達 85%、巡弋飛彈與戰機數十分鐘 60%；機動受損的車跑不掉＝100%
const KLOC={ctl:{atk:.75,mid:.45,def:.3},night:.7,wx:.6,decoy:.75,fresh:{bm:.85,cm:.6}};
// 已定位的機動發射車是軟目標：命中率依武器數量計算（★每枚彈道飛彈、巡弋飛彈或炸彈 40%、每枚長程火箭 20%），難度集中在「找到它」
const KILL1={s:.4,r:.2,g:.4},kill1N=pk=>pk.k==='g'?2:pk.n;
const lchKillP=pk=>1-Math.pow(1-(KILL1[pk.k]||.4),kill1N(pk));
// 偵察是瓶頸：每個單位每個階段只判斷一次「找到幾輛」＝定位機率 × 可見車數（小數累計）；之後的打擊只能打已找到的車，找到的都打中了，再多飛彈也只會打到誘餌
function lchFound(t,kind){const key=S.turn+S.phase;if(t.locT!==key){t.locT=key;const L=locateP(t,kind);t.locL=L;t.locN=takeInt(L.p*(t.veh==null?lchV0(t):t.veh),'locN:'+t.type);}return t.locN;}
function locateP(t,kind){
  const f=[];let p;
  if(t.mT&&S.turn<t.mT){p=1;f.push('機動受損，無法轉移');}
  else if(t.revealed){p=KLOC.fresh[kind];f.push('已暴露；'+(kind==='bm'?'彈道飛彈數分鐘到達':'巡弋飛彈或戰機要數十分鐘')+'，發射車仍在原地 '+Math.round(p*100)+'%');}
  else{p=KLOC.ctl[S.airCtl||'mid'];f.push('隱蔽中，制空'+AIRCTL[S.airCtl||'mid']+'時定位 '+Math.round(p*100)+'%');
    if(S.turn%2===0){p*=KLOC.night;f.push('夜間 ×'+KLOC.night);}
    if(S.weather&&(S.weather.id==='bad'||tyThreat(S.weather))){p*=KLOC.wx;f.push('雲雨或颱風 ×'+KLOC.wx);}
    if(S.mods.decoy){p*=KLOC.decoy;f.push('誘餌 ×'+KLOC.decoy);}
    if(isrF()<1){p*=isrF();f.push('共軍指揮與偵察受損 ×'+(Math.round(isrF()*100)/100));}}
  return {p,txt:f.join('、')};
}
// ── 地面旅的殺傷鏈：比照發射車，每個攻方階段先判斷「找到幾個營」（1 步≈1 營），只有找到的營打得到 ──
// 依據：1991 沙漠風暴在開闊沙漠、完全制空下，約 38 天、3.5 萬～4.3 萬架次才讓伊軍戰車減少約 39%（宣稱值，可能高估）；
//  烏克蘭的經驗是分散、隱蔽的地面部隊很難被遠程火力大量殲滅。數字皆★推估：
//  隱蔽中：每營每階段被定位（精確到能下一整個打擊包）的機率依制空——攻方優勢 5%、均勢 3%、守方優勢 1.5%；
//   城市 ×0.5（建築與平民遮蔽）、山地 ×0.5（林木與地形）、夜間 ×0.7、雲雨或颱風 ×0.6
//  與敵軍接觸（同格或相鄰格有敵方地面部隊，或相鄰海上有攻方登陸船團——灘頭火力準備時守軍在監視範圍內）：前線部隊集中作戰、被偵察與無人機持續盯住，定位 35%
//  已知位置：開戰頭 2 個回合仍在平時駐地或預構陣地（開戰時的位置，沒移動過）——多年情監偵早已掌握，定位 25%；第 3 回合起部隊已轉入野戰與備用陣地，恢復隱蔽
const GLOC={ctl:{atk:.05,mid:.03,def:.015},city:.5,mtn:.5,night:.7,wx:.6,contact:.35,known:.25,knownT:2};
const isGnd=u=>!!u&&!isLch(u)&&!isShip(u)&&!atSea(u)&&CPW[u.type]!==undefined;
function gContact(t){const h=hexOf(t);return [h,...nbrs(h.c,h.r)].some(n=>n&&unitsAt(n.k).some(e=>e.side!==t.side&&alive(e)&&!isShip(e)&&(isLand(n)?!atSea(e):e.side==='atk')));}
function gKnown(t){const k=K(t.c,t.r);if(t.k0===undefined)t.k0=S.turn<=1?k:null;return S.turn<=GLOC.knownT&&t.k0===k;}
function gLocP(t){
  const h=hexOf(t),f=[];let p;
  const kn=gKnown(t); // 先記下開戰時的位置
  if(gContact(t)){p=GLOC.contact;f.push('與敵軍接觸，定位 '+Math.round(p*100)+'%');}
  else if(kn){p=GLOC.known;f.push('仍在開戰前已知的駐地或陣地，定位 '+Math.round(p*100)+'%');}
  else{p=GLOC.ctl[S.airCtl||'mid'];f.push('隱蔽中，制空'+AIRCTL[S.airCtl||'mid']+'時每營定位 '+(Math.round(p*1000)/10)+'%');
    if(h.t==='city'){p*=GLOC.city;f.push('城市 ×'+GLOC.city);}else if(h.t==='mtn'){p*=GLOC.mtn;f.push('山地 ×'+GLOC.mtn);}
    if(S.turn%2===0){p*=GLOC.night;f.push('夜間 ×'+GLOC.night);}
    if(S.weather&&(S.weather.id==='bad'||tyThreat(S.weather))){p*=GLOC.wx;f.push('雲雨或颱風 ×'+GLOC.wx);}}
  if(!gContact(t)&&isrF()<1){p*=isrF();f.push('共軍指揮與偵察受損 ×'+(Math.round(isrF()*100)/100));}
  return {p,txt:f.join('、')};
}
function gFound(t){const key=S.turn+S.phase;if(t.glT!==key){t.glT=key;const L=gLocP(t);t.glL=L;t.glN=takeInt(L.p*Math.max(0,t.hp),'gloc');}return t.glN;}
// 共軍指揮與偵察節點（南京指揮中心、福建沿海雷達與電子偵察站）受損：定位台灣目標的機率下降，全毀時 ×0.8（★推估，與守方樂山雷達失效對稱）
const isrF=()=>.8+.2*cnShare('isr');
// 可打擊：機動發射車與地面旅都要本階段偵察找到、而且還有沒打過的部分；固定設施、艦艇照舊
const strikeable=u=>canHitSub(u)&&(!isLch(u)||lchFound(u,'bm')>0)&&(!isGnd(u)||gFound(u)>0);
function ssmHit(t,why){ // 一次精準命中：回傳戰報文字
  const k=takeInt(SSM.K,'ssmG:K')>=1?'K':takeInt(SSM.F/(1-SSM.K),'ssmG:F')>=1?'F':'M';
  if(k==='K'){
    const nv=Math.max(0,t.veh-1),nh=nv>0?Math.ceil(nv/ssmVPS(t)):0,drop=t.hp-nh;t.veh=nv;t.fk=(t.fk||[]).slice(0,nv);
    if(drop>0){S._vehHit=true;try{damage(t,drop,why);}finally{S._vehHit=false;}}else fxq({t:'txt',at:[t.c,t.r],s:'−1 車',col:'def'});
    return '1 輛發射車被摧毀（剩 '+nv+' 輛）';
  }
  if(k==='F'){t.fk=(t.fk||[]).filter(x=>x>S.turn);if(t.fk.length<t.veh)t.fk.push(S.turn+SSM.fix);fxq({t:'txt',at:[t.c,t.r],s:'火力受損',col:'def'});return '1 輛發射車火力受損，'+SSM.fix+' 回合後修復（可射 '+ssmReady(t)+' 輛）';}
  t.mT=S.turn+1;t.revealed=true;fxq({t:'txt',at:[t.c,t.r],s:'機動受損',col:'def'});return '1 輛發射車機動受損，無法轉移陣地，整個單位到下一個攻方階段結束都維持暴露';
}
function fireMissile(m,t){
  if(window.__fm)window.__fm.push(t.type+(atSea(t)?'@sea':'@land'));
  if(m.type==='ssn')return ssnFire(m,t);if(m.type==='nme')return nmeFire(t);if(m.type==='mdt')return mdtFire(t);
  if(m.type==='hmr')return fireHimars(m,t);
  if(m.type==='mlrs')return fireMlrs(m,t);
  if(isEsc(m))return fireSalvo(m,t);
  if(m.fl)return fleetSalvo(m,t);
  if(m.type==='ssm'&&S.pools&&S.pools.rocAS!==undefined)S.pools.rocAS=Math.max(0,Math.round((S.pools.rocAS-SSM_N/100)*100)/100); // 存量每點約 100 枚：每發 2 枚＝0.02 點（原本扣 0.2 點＝20 枚，與實際發射數不符）
  m.shots--;if(m.shots<=0&&m.type!=='ssm')m.acted=true; // 岸置發射車打完仍可機動轉移
  if(m.type==='ssm')m.revealed=true; // 開火後暴露
  if(adCover(t).length){ // 目標在 055／052D／054A 防空涵蓋內：★每次 2 枚，以齊射模型對上艦隊防空（同階段共用接戰上限）
    const n=SSM_N,r=salvoCalc(t,n,false,'ssmSalvo>'+t.type),big=t.type==='cv'||t.type==='csg',steps=big?takeInt(r.hits/2,'salvoBig'):r.hits;t.inc=(t.inc||0)+1;
    fxq({t:'msl',from:[m.c,m.r],to:[t.c,t.r],hit:r.hits>0});
    log((m.type==='ff'?'守方艦艇':'岸置反艦飛彈')+'以 '+n+' 枚雄風飛彈攻擊 '+uname(t)+'：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+(steps?'，'+tname(t)+' −'+(t.fl?steps+' 艘':stpU(t,steps)):'，未造成重創')+'（齊射模型，參數為推估）');
    if(steps)damage(t,steps,'雄風反艦飛彈');
    checkInstant();return;
  }
  if(t.type==='ro'||t.type==='cvy'){ // 滾裝船與補給船：商船改裝、體積大、航速慢、沒有自身防空；不在護航艦防空涵蓋內時，飛彈只受尋標命中率限制（同齊射模型的 pSeek）
    const hits=takeInt(SSM_N*SALVO.pSeek,'ssmMerch>'+t.type);t.inc=(t.inc||0)+1;
    fxq({t:'msl',from:[m.c,m.r],to:[t.c,t.r],hit:hits>0});
    log((m.type==='ff'?'守方艦艇':'岸置反艦飛彈')+'以 '+SSM_N+' 枚雄風飛彈攻擊沒有護航防空的 '+uname(t)+'：命中 '+hits+' 枚（尋標命中率 '+Math.round(SALVO.pSeek*100)+'%，推估）'+(hits?'，'+tname(t)+' −'+stpU(t,hits):''));
    if(hits)damage(t,hits,'雄風反艦飛彈');
    checkInstant();return;
  }
  const sat=satHit(t),need=(m.type==='ff'?4:S.mods.ssmNeed)+escortMod()-sat,hit=sat>=3||hitP(pNeed(need),'ms:'+m.type+'>'+t.type);
  fxq({t:'msl',from:[m.c,m.r],to:[t.c,t.r],hit});
  if(hit){log('反艦飛彈命中海上的 '+TYPES[t.type].n+(sat>=2?'（飽和攻擊）':'（'+lastTxt()+'）'));damage(t,sat>=2?2:1,sat>=2?'飽和攻擊':'反艦飛彈');}
  else log('反艦飛彈未命中（'+lastTxt()+'）');
  checkInstant();
}
function strike(t){
  if(window.__st)window.__st.push(t.type);
  const h=hexOf(t),soft=!covered(h)&&!(t.type==='ssm'||t.type==='hmr'||t.type==='mlrs')||atSea(t),pk=fireTake(h,soft);if(!pk)return false;S.stats.fire++;civHit('TW',h,'strike');
  const mob=isLch(t); // 機動發射車：先過殺傷鏈（定位與時效）
  const need=Math.min(6,Math.max(2,((h.t==='city'||h.t==='mtn')?6:5)-((S.mods.strikeEase&&S.mods.strikeEase[S.turn])||0)));
  if(mob&&lchFound(t,pk.k==='g'?'cm':'bm')<=0){
    fxq({t:'air',at:[t.c,t.r],hit:false,tsea:false,org:orgPick('pla'),k:pk.hs?'hs':pk.k==='g'?'cm':'bm'});
    log('火力打擊 '+hname(h)+'：'+(t.revealed?'發射車已轉移，打到空的陣地':'沒有找到（或已打過所有找到的）真正發射車，打中誘餌與空車')+'（'+t.locL.txt+'；本階段找到的車都已打過；推估）');checkInstant();return;}
  if(isGnd(t)&&gFound(t)<=0){
    fxq({t:'air',at:[t.c,t.r],hit:false,tsea:false,org:orgPick('pla'),k:pk.hs?'hs':pk.k==='g'?'cm':'bm'});
    log('火力打擊 '+hname(h)+'：沒有找到可打擊的'+TYPES[t.type].n+'營級部隊，打到空的陣地（'+(t.glL?t.glL.txt:'')+'；推估）');checkInstant();return;}
  const PM=pkgMod(pk,h,t),ok=hitP((mob?lchKillP(pk):pNeed(need))*PM.m,'st:'+t.type+':'+pk.k); // 機動發射車：已定位後依武器數量計算
  fxq({t:'air',at:[t.c,t.r],hit:ok,tsea:atSea(t),org:orgPick(S.pools&&S.pools.plaCV>0&&Math.random()<.3?'plaCV':'pla'),k:pk.hs?'hs':pk.k!=='g'?'bm':Math.random()<.5&&S.pools.plaCM>0?'cm':'bomb',ad:!pk.hs&&S.pools.rocAD>0&&!S.sead&&!atSea(t)?(ok?'pass':'int'):undefined});
  if(ok){if(isLch(t)&&t.veh!=null){t.locN=Math.max(0,(t.locN||0)-1);const x=ssmHit(t,'火力打擊');log('火力打擊命中 '+hname(h)+' 的 '+TYPES[t.type].n+'：'+x+'（'+(PM.txt?PM.txt+'；':'')+lastTxt()+'）');}else{if(isGnd(t))t.glN=Math.max(0,(t.glN||0)-1);log('火力打擊命中 '+hname(h)+' 的 '+TYPES[t.type].n+'（'+(isGnd(t)&&t.glL?t.glL.txt+'；':'')+(PM.txt?PM.txt+'；':'')+lastTxt()+'）');damage(t,1,'火力打擊');}}
  else log('火力打擊 '+hname(h)+' 未命中（'+(PM.txt?PM.txt+'；':'')+lastTxt()+'）');
  checkInstant();return true;
}

// ── 戰力量詞（通俗文字／戰棋「步」）與綜合戰力 ──
// 「步」是戰棋的耗損單位；通俗模式改用「戰力 %」「艘」「發射車」「航艦損傷狀態」，合計則換算成「相當於幾個旅」
let TERM='plain';const plainT=()=>TERM!=='steps';
// ★推估 綜合戰力權重（每步，以兩棲合成旅 1 步＝1.0 為基準）：依實際裝備對照 ST 100-9 範例（裝甲連 3.2、機步連 2.0、輕步兵連 1.0）。重型合成旅（99A＋04A）、M1A2T 裝甲旅≈裝甲；兩棲旅（05 式兩棲突擊砲＋步戰車）與聯兵旅（M60A3／CM-11 戰車營＋機步營）同屬戰車＋機步混編≈2.4；空降旅（03 式傘兵戰車）介於輕步兵與機步；後備旅＝輕步兵再依訓練打折。發射車、火箭車不計入地面戰力
const CPW={arm:1.3,tank:1.2,amph:1,mar:1,inf:1,abn:.6,res:.35};
const cpOf=u=>Math.max(0,u.hp)*(CPW[u.type]||0);
const cpR=x=>Math.round(x*10)/10;
const fmt1=x=>typeof x==='number'?String(Math.round(x*10)/10):x; // 顯示用：最多一位小數（避免 13.399999999999999）
const cpNum=x=>plainT()?Math.round(x/3*10)/10:cpR(x); // 一個標準旅＝3 步×1.0＝3
const cpU=()=>plainT()?'個旅':'戰力點';
const cpTxt=x=>plainT()?'約 '+cpNum(x)+' 個旅的戰力':cpR(x)+' 戰力點';
const mhpOf=u=>u.mhp||u.max||(TYPES[u.type]||{}).hp||3;
const pctU=u=>Math.max(0,Math.round(100*u.hp/mhpOf(u)));
function stpU(u,n){return plainT()?Math.min(100,Math.round(100*n/mhpOf(u)))+'% 戰力':n+' 步';}
function stpN(n){return plainT()?'約 '+n+' 個營級戰力':n+' 步';} // ★ 通俗換算：1 步約等於一個營（一個旅 3 步）
function casN(n){return plainT()?'累計受創 '+n+' 次':'傷亡累計 '+n+' 步';}
function cvSt(hp,max){max=max||3;return plainT()?(hp<=0?'被擊沉':hp<=1?'重創、失去戰鬥能力':hp<max?'輕傷、仍能作戰':'完好'):(hp<=0?'被擊沉':'剩 '+hp+' 步');}
function hpCell(u){
  if(!plainT())return [u.hp+'/'+mhpOf(u),'步數'];
  if(u.fl)return [u.hp+' 艘','艦艇'];
  if(isLch(u)&&u.veh!=null)return [u.veh+'/'+(u.veh0||u.veh),'發射車'];
  if(u.type==='cv'||u.type==='csg')return [cvSt(u.hp,mhpOf(u)).split('、')[0],'狀態'];
  return [pctU(u)+'%','戰力'];
}
function conditions(final){
  const tp=S.owner[TAIPEI]==='atk';
  const pc=PORTS.filter(k=>S.owner[k]==='atk'&&!S.portDown[k]).length,PH=portHold();
  let as=0,ds=0;
  for(const u of S.units)if(onTW(u)&&!isShip(u)){if(u.side==='atk')as+=cpOf(u);else ds+=cpOf(u);}
  return [
    {title:'首都台北',desc:'判定時台北由攻方控制',atk:tp,now:'目前由'+(tp?'攻方':'守方')+'控制'+(tp?'（已連續 '+tpHeldTurns(!!final)+' 個回合）':'')},
    {title:'主要港口',desc:'攻方控制的主要港口（未被破壞）每回合卸載容量，足以支撐島上部隊的補給（至少 '+PORT_NEED0+'）。容量依實際貨物吞吐量：高雄 25、台中港 8、台北港 5、基隆 4',atk:PH.ok,now:'攻方控制 '+pc+' / '+PORTS.length+' 個港口，卸載容量 '+PH.cap+'，需要 '+PH.need},
    {title:'島上戰力',desc:'攻方在本島的綜合戰力不少於守方，且至少'+cpTxt(4).replace('約 ','約 ')+'（足以站穩）。綜合戰力依部隊種類加權：裝甲＞兩棲／陸戰／聯兵旅＞空降＞後備，飛彈與火箭發射車不計',atk:as>=ds&&as>=4,now:'攻方 '+cpTxt(as)+' 對 守方 '+cpTxt(ds)}
  ];
}
// consecutive turn-ends the attacker has held Taipei; final=true at judgment time (the last turn-end is already counted)
function tpHeldTurns(final){const h=S.stats.tpHold||0;return final?h:h+(S.owner[TAIPEI]==='atk'?1:0);}
function verdict(n,final){
  const tp=S.owner[TAIPEI]==='atk',hold=tpHeldTurns(final),b=snap(),wh=S.stats.winHold||0;
  if(n===3)return wh>=2
    ?{s:'atk',t:'攻方決定性勝利',d:'首都、港口與兵力優勢全數到手，並且連續多個回合站穩，守方防線崩潰。'}
    :{s:'atk',t:'攻方勝利',d:'三項條件全部達成，但直到最後才同時到手，立足尚未完全穩固。'};
  if(n===2)return wh>=2
    ?{s:'atk',t:'攻方勝利',d:'攻方達成兩項條件，並連續站穩，已取得戰略主動。'}
    :{s:'atk',t:'攻方險勝',d:'攻方達成兩項條件，但直到最後一個回合才達成，立足未穩；守方預期會集結反攻。'};
  if(n===1&&tp)return hold>=2
    ?{s:'draw',t:'僵局',d:'攻方占領首都已連續 '+hold+' 個回合，但沒有控制足夠的港口、島上兵力也不足以站穩，補給線孤立；守方預期會集結兵力收復，戰局尚未分出勝負。'}
    :{s:'def',t:'守方勝利',d:'攻方直到最後才占領首都（只持續 '+hold+' 個回合），立足未穩、其他條件都落空，預期很快被收復，視為攻勢失敗。'};
  if(n===1)return (b.as>=6&&b.ports>=1)
    ?{s:'draw',t:'灘頭堡僵持',d:'攻方雖未達成兩項條件，但在島上站穩了'+cpTxt(b.as)+'並控制 '+b.ports+' 個港口，守方一時無法將其逐出；戰局陷入拉鋸，尚未分出勝負。'}
    :{s:'def',t:'守方勝利',d:'攻方雖有斬獲，但未能同時達成兩項條件，攻勢頓挫。'};
  return b.as<=0
    ?{s:'def',t:'守方決定性勝利',d:'攻方三項條件全部落空，島上沒有留下部隊，登陸作戰失敗。'}
    :{s:'def',t:'守方勝利',d:'攻方三項條件全部落空；雖有少數部隊上岸，但無法站穩，登陸作戰失敗。'};
}
// 代價調整後的戰略評價：勝利不等於划算
function strategicTag(v,lim){
  const c=costSummary(),civ=c.civ.TW,milA=c.mil.atk.n,mkt=c.mkt,pd=Object.keys(S.portDown||{}).length;
  const lines=[];let tag='';
  if(v.s==='def'){
    if(civ>=30000||pd>=2){tag='（慘勝）';lines.push('守方雖然守住，但台灣平民傷亡約 '+ppl(civ)+(pd?'、'+pd+' 個港口遭自行破壞':'')+'，戰後重建與經濟復原代價沉重。');}
    else lines.push('守方在可承受的代價下守住台灣。');
  }else if(v.s==='atk'){
    if(milA>=120000||mkt<=-20){tag='（慘勝）';lines.push('攻方雖然達成目標，但軍人傷亡約 '+ppl(milA)+'、全球股市累計 '+mkt.toFixed(1)+'%'+'，面臨長期制裁與孤立，戰略上得不償失。');}
    else lines.push('攻方以相對可控的代價達成目標。');
  }else lines.push('雙方都沒有取得決定性結果，戰略評價取決於後續談判與雙方的持久力。');
  return {tag,text:lines.join('')};
}
const twControl=()=>{const hs=Object.values(TER).filter(h=>h.isl==='TW'&&isLand(h));return hs.length?hs.filter(h=>S.owner[h.k]==='atk').length/hs.length:0;}; // 攻方控制的本島領土比例
