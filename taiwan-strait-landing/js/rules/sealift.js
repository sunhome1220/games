'use strict';
/* 海運運力與補給結算：卸載上限、運輸船、補給（自 rules.js 拆出，內容不變） */
// 補給三條管道：①船團（卸載能力＝港口與灘頭，扣掉途中被打掉的）②空投 ③就地徵用（靠民心）。每回合攻方階段開始時結算一次。
function unloadCap(){ // 船團的卸載上限：攻方掌握的港口、灘岸格、灘頭堡（各格依所在海域的浪高）
  let capP=0,capB=0;
  const fb=wh=>Math.max(0,Math.min(1,(2.5-wh)/1.25)),fp=wh=>Math.max(.3,Math.min(1,(4-wh)/2)); // 浪高：灘頭 ≤1.25 公尺全額、≥2.5 公尺歸零；港口有防波堤，≥4 公尺降到三成
  for(const h of terList('twCoast',h=>h.isl==='TW'&&h.coastal&&!h.cliff&&h.t!=='mtn')){
    if(S.owner[h.k]==='atk'){
      const wh=wxWave(h);
      if(h.t==='port')capP+=(S.portDown[h.k]?1:portCap(h.k))*fp(wh);else capB+=fb(wh);
      if(MINOR_PORTS[h.k]&&!S.portDown[h.k])capP+=2*fp(wh); // 次要港口
      else if(h.t!=='port'&&S.bh&&S.bh[h.k]&&S.turn-S.bh[h.k]>=1)capB+=2*fb(wh); // 灘頭堡：連續控制 2 個回合的灘岸格
    }
  }
  if(S.owner[MAGONG]==='atk')capB+=2*fb(wxWave(TER[MAGONG]));
  const capA=typeof atkAF==='function'?Math.min(2,atkAF().length):0; // 空運：占領的機場（★每座 1、最多 2）
  const cap=Math.round(capP+capB)+capA;
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
  const P=S.pools,port=h.t==='port',nearPort=port||Object.values(TER).some(q=>q.t==='port'&&q.isl==='CN'&&hd(h,q)<=kmH(40)); // 登陸艦：港口 40 km（4 格）內都能裝；滾裝船是商船改裝，要靠碼頭，只能在港口格裝（2026-11-18.41，旅要先走到港口）
  if(u.type==='arm')return port&&P.plaLift>(S.roReserve||0)?'ro':nearPort&&P.plaLst>0?'lst':null; // 重型旅：港口格可搭滾裝船，港口附近可搭登陸艦
  if(P.plaLst>0)return 'lst';
  if(port&&P.plaLift>(S.roReserve||0))return 'ro';
  return null;
}
// 滾裝船風險提醒（只提醒，不限制）：商船改裝、航速慢、沒有自身防空，要等制空優勢與可卸載的港口／浮動碼頭才安全
function roRisk(){
  if(!S||!S.started||S.over||!S.pools)return '';
  const noAir=S.airCtl!=='atk',dock=PORTS.some(k=>S.owner[k]==='atk'&&!S.portDown[k])||Object.values(TER).some(floatPier);
  if(noAir&&!dock)return '⚠ 提醒：滾裝船是商船改裝、航速慢、沒有自身防空。目前制空'+AIRCTL[S.airCtl||'mid']+'、攻方也還沒控制能卸載的港口或浮動碼頭，這時出航容易被打沉，到了也沒地方卸載；建議先等（可以不理會這個提醒）。';
  if(noAir)return '⚠ 提醒：目前制空'+AIRCTL[S.airCtl||'mid']+'（不是攻方優勢），滾裝船沒有自身防空，出航容易被打沉。';
  if(!dock)return '⚠ 提醒：攻方還沒控制能卸載的港口或浮動碼頭，滾裝船到了也沒地方卸載。';
  return '';
}
const RO_SHIPS={light:4,arm:10}; // ★推估：一個滾裝船團的船數——輕型旅（兩棲、陸戰）約 4 艘、重型合成旅約 10 艘（一個旅的車輛、人員要這麼多大型滾裝客貨輪）
function embark(u,h){
  const kind=freeShipKind(u,h);if(kind==='have'||kind==='na'||!kind)return;
  const P=S.pools;if(kind==='lst')P.plaLst--;else P.plaLift--;
  const nShip=u.type==='arm'?RO_SHIPS.arm:RO_SHIPS.light,sh=mkUnit('atk',kind,h.k,kind==='ro'?{boundTo:u.id,hp:nShip,mhp:nShip}:{boundTo:u.id});S.units.push(sh);u.ship=sh.id;
  if(typeof ANIM!=='undefined'&&ANIM.pos&&ANIM.pos.size)ANIM.pos.set(sh.id,cen(h.c,h.r)); // 新船從登船的格子出發滑向目的地（不然會在終點淡入）
  log(uname(u)+' 裝上'+TYPES[kind].n+'（剩 兩棲艦群 '+fmt1(P.plaLst)+'、滾裝船團 '+fmt1(P.plaLift)+'）');
  if(kind==='ro'&&typeof humanTurn==='function'&&humanTurn()){const w=roRisk();if(w)toast(w,5200);} // 只提醒，不限制
}
function liftTurn(){ // 攻方階段開始：卸載完的運輸船返航大陸港口，靠港後裝載一回合再回到運力池
  const P=S.pools,t=S.turn;P.plaLst+=(S.lstBack&&S.lstBack[t])||0;
  const ports=Object.values(TER).filter(h=>h.t==='port'&&h.isl==='CN');if(!ports.length)return;
  const dp=h=>Math.min.apply(null,ports.map(q=>hd(h,q)));
  for(const sh of S.units.filter(x=>x.side==='atk'&&(x.type==='lst'||x.type==='ro')&&x.ret&&t>x.retT)){
    sh.moved=false;const rc=reach(sh);let b=null,bs=dp(hexOf(sh));
    for(const [k,v] of rc){if(v.kind!=='sail')continue;const sc=dp(TER[k]);if(sc<bs){bs=sc;b=k;}}
    if(b)doMove(sh,b,'sail');sh.moved=true;
    if(hexOf(sh).t==='port'&&hexOf(sh).isl==='CN'){S.units=S.units.filter(x=>x!==sh);if(sh.type==='lst'){S.lstBack=S.lstBack||{};S.lstBack[t+2]=(S.lstBack[t+2]||0)+1;}else{S.roFrac=(S.roFrac||0)+(sh.mhp?sh.hp/sh.mhp:1);const whole=Math.floor(S.roFrac+1e-9);S.roFrac-=whole;S.liftBack=S.liftBack||{};S.liftBack[t+2]=(S.liftBack[t+2]||0)+whole;}log(TYPES[sh.type].n+' 返抵大陸港口，裝載後再度可用');} // 返航的滾裝船團：剩幾艘就補回幾分之幾個運力（小數累計，滿 1 才回運力池；沉掉的船永久損失）
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
    for(const [k,v] of rc){if(v.kind!=='sail')continue;const hh=TER[k],sc=Math.min.apply(null,sinks.map(s2=>hd(hh,s2)))+ssmThreat(k)*.6+HJ(k)*.3-(S.units.some(x=>x.side==='atk'&&x.type==='dd'&&hd(hexOf(x),hh)<=kmH(40))?.8:0);if(sc<bs-.2){bs=sc;best=k;}}
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
    if(sinks.some(h=>hd(hexOf(u),h)<=kmH(20))){const c=u.hp;if(unl+c<=ucap){unl+=c;arrived.push(u);}}
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
