'use strict';
/* 地面規則：戰力、移動、可攻擊目標、傷害、攻擊（自 rules.js 拆出） */
function weak(u){return u.hp===1&&TYPES[u.type].hp>1?1:0;}
// 剛動員的後備旅：裝備（整旅動員的瓶頸）與人員還在編成，攻防各 −1；從動員的守方階段，到下一個攻方階段結束為止（★推估：「一回合」）
const unready=u=>u.type==='res'&&u.mobT!=null&&(S.turn===u.mobT||(S.turn===u.mobT+1&&S.phase==='atk'))?1:0;
function effAtk(u){return TYPES[u.type].atk+sideMod(u,'atk')-weak(u)-unready(u)-(u.side==='atk'&&onTW(u)&&supply().over?1:0);}
function effDef(u){return TYPES[u.type].def+sideMod(u,'def')-weak(u)-unready(u)-(u.side==='atk'&&onTW(u)&&supply().over?1:0)-(unitsAt(K(u.c,u.r)).filter(x=>!isShip(x)).length>1?1:0);}
function terrDef(h){return h.t==='city'||h.t==='mtn'?2:h.t==='port'||h.town?1:0;} // 城鎮（h.town）：城市的一半（使用者 2026-11-15 指定）
// 掩蔽程度：城市、山地 1；城鎮 0.5（★建物與聚落提供的掩蔽取城市的一半，和防禦加成一致）；其他 0。火力打擊的命中門檻加上這個值（門檻 5.5＝命中率 25%）
function terrCover(h){return h.t==='city'||h.t==='mtn'?1:h.town?.5:0;}
const coverTxt=h=>terrCover(h)>=1?'（城市／山地較難）':terrCover(h)>0?'（城鎮稍難）':'';
function seaPen(u){if(!atSea(u))return 0;const wh=wxWave(hexOf(u)),wp=wh>2?2:wh>1.25?1:0;return (u.type==='mar'?-1:-2)-wp;} // 搶灘突擊：浪高越大，登陸艇越難靠岸（>1.25 公尺 −1、>2.0 公尺 −2）
const ADJ_N=()=>Math.round(kmH(ADJ_KM)); // 「相鄰」的格數（ring2 的半徑）
function inZOC(side,h){ // ZOC_KM（10 km＝相鄰格）內有敵方地面部隊：直接掃單位，比逐格查快
  const R=Math.max(1,Math.round(kmH(ZOC_KM)));
  return S.units.some(e=>{if(e.side===side||isMsl(e)||isShip(e)||isFixT(e))return false;const n=hexOf(e);if(!n||!isLand(n)||(isAirT(e)&&n.isl==='CN'))return false;const d=hd(h,n);return d>=1&&d<=R;});
}
function support(u,t){
  let n=0;
  for(const h of ring2(t))for(const f of unitsAt(h.k))if(f!==u&&f.side===u.side&&!isMsl(f)&&!isFixT(f)&&!(h.isl==='CN'))n++;
  return Math.min(2,n);
}
const canSail=u=>u.type==='ff'||u.type==='hk'||u.type==='psub'||u.type==='ssn'||u.type==='csg'||(u.side==='atk'&&(u.type==='amph'||u.type==='mar'||u.type==='arm'||u.type==='dd'||u.type==='cv'||u.type==='cvy'||u.type==='lst'||u.type==='ro'||(u.type==='aas'&&!!u.ship)));
function canEmbark(u,h){
  if(u.type==='ff'||u.type==='hk')return h.t==='port'&&unitsAt(h.k).every(x=>x.side===u.side);
  if(u.type==='psub')return h.t==='port'&&h.isl==='CN';
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
// 對抗性登陸（強攻，2026-11-19）：10 km 一格的地圖上，守軍佔住的格子不是整格都封死（現實中守軍只佔一部分，攻方可在同格其他海灘上岸），
// 所以兩棲艦上的兩棲旅與陸戰旅可以強攻有守軍（沒有友軍）的灘頭：登陸時自動發生戰鬥（沿用搶灘突擊的攻防：浪高與兩棲突擊的減分），最多對 2 個守方單位各打一輪，打光才站穩；打不下來就留在船上。
// 滾裝船、重型旅、空降不能；港口、斷崖、泥灘、山地、台北市區的限制與一般登陸相同（validLanding）。
function opposedLanding(u,h){
  const sh=u.ship&&shipOf(u);if(!sh||sh.type!=='lst'||(u.type!=='amph'&&u.type!=='mar'))return false;
  if(!validLanding(u,h))return false;const us=unitsAt(h.k);
  return us.length>0&&us.every(e=>e.side!==u.side&&!isShip(e));
}
function landAssault(u,h){
  const foes=()=>unitsAt(h.k).filter(e=>e.side!==u.side&&!isShip(e));
  log(uname(u)+' 對 '+hname(h)+' 強攻登陸（守軍 '+foes().length+' 個單位）');
  let n=0;while(alive(u)&&foes().length&&n<2){attack(u,pickBest(foes(),x=>-x.hp));n++;}
  u.moved=true;u.acted=true;
  if(alive(u)&&hexOf(u).k===h.k&&isLand(hexOf(u))){ // 打光守軍並已推進佔領：和一般登陸一樣處理船
    const sh=shipOf(u);if(sh){sh.boundTo=null;sh.ret=true;sh.retT=S.turn;}u.ship=null;
    if(S.stats.firstLand===null&&h.isl==='TW')S.stats.firstLand=S.turn;
    fxq({t:'land',at:[h.c,h.r]});log(uname(u)+' 強攻登陸成功，佔領 '+hname(h));mineCheck(u,h);
  }else if(alive(u))log(uname(u)+' 強攻登陸 '+hname(h)+' 未能奪下，仍在船上');
  else log('強攻登陸 '+hname(h)+' 失敗：'+TYPES[u.type].n+' 全軍覆沒');
  checkInstant();
}
function moveCost(u,h){return h.t==='mtn'?(u.type==='arm'||u.type==='tank'?3:2):1;}

// 過河（★推估）：兩格中心連線跨過主要河流（RIVERS，手繪近似線）。守方戰時會炸橋，隔河攻擊防禦 +1；在敵軍 40 km 內過河要停下（強渡、架橋需要時間）
const RIVX=new Map();
function riverX(a,b){if(!a||!b||a===b)return null;const key=a.k<b.k?a.k+'|'+b.k:b.k+'|'+a.k;if(RIVX.has(key))return RIVX.get(key);
  const p=rcToLL(a.c,a.r),q=rcToLL(b.c,b.r),cr=(o,s,t)=>(s[0]-o[0])*(t[1]-o[1])-(s[1]-o[1])*(t[0]-o[0]);let hit=null;
  const ALL=typeof RIVERS!=='undefined'?RIVERS.concat(typeof TRIBS!=='undefined'?TRIBS.map(([,n,P])=>[n,P]):[]):[]; // 主流＋主要支流
  for(const [n,P] of ALL){for(let i=0;i+1<P.length;i++){const c=P[i],d=P[i+1];if(cr(p,q,c)*cr(p,q,d)<0&&cr(c,d,p)*cr(c,d,q)<0){hit=n;break;}}if(hit)break;}
  RIVX.set(key,hit);return hit;}
const foeNear=(side,h,km)=>S.units.some(e=>e.side!==side&&alive(e)&&!isShip(e)&&isLand(hexOf(e))&&hexOf(e).isl===h.isl&&hd(hexOf(e),h)<=kmH(km));
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
      const left=riverX(h,n)&&foeNear(u.side,n,40)?0:Math.max(0,mp-cost); // 敵前過河：過了就停下
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
const SPD={war:kmH(40),subQuiet:kmH(60),subMax:kmH(100)}; // 公里換成格：軍艦比商船多 40 km、潛艦安靜航行 60 km、最快 100 km（每回合）
const isWarship=u=>isEsc(u)||u.type==='cv'||u.type==='csg'||u.type==='dd'||u.type==='ff';
const seaMove=u=>u.type==='hk'||u.type==='ssn'||u.type==='psub'?SPD.subMax:(S.weather&&S.weather.base!=null?seaOfH(wxWave(hexOf(u))):S.weather.sea)+(isWarship(u)?SPD.war:0); // 依所在海域的浪高
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
      else if(n!==here&&!isShip(u)&&u.type!=='aas'&&validLanding(u,n)&&canStack(u,n.k)&&(!res.has(n.k)||res.get(n.k).kind!=='move'))res.set(n.k,{kind:'land'});
      else if(n!==here&&!isShip(u)&&u.type!=='aas'&&!res.has(n.k)&&opposedLanding(u,n))res.set(n.k,{kind:'land',opp:true}); // 有守軍的灘頭：強攻登陸（對抗性登陸）
    }
  }
}
function reach(u){
  const res=new Map();if(u.moved||u.acted)return res;const h=hexOf(u);
  if(u.boundTo||isFixT(u))return res; // 載著旅的運輸船跟著旅一起走；攻擊直升機旅留在基地（從基地出擊）
  if(u.esc)return res; // 護航艦跟著航艦移動，不單獨移動
  if(isAirT(u)&&!u.dropped&&(h.isl==='CN'||u.ship)){ // 在大陸沿岸待命，或搭在四川艦上（從海上的位置起飛）
    if(S.weather.air)for(const t of Object.values(TER)){
      if((t.isl==='TW'||t.isl==='PH')&&t.t!=='mtn'&&canStack(u,t.k)&&rd(h,t)<=kmH(AIR_R[u.type]))res.set(t.k,{kind:'drop'});
    }
    for(const t of atkAF())if(afRoom(u,t.k))res.set(t.k,{kind:'drop'}); // 占領的機場：可直接機降（天候不佳時也要能起降才行）
    if(!u.ship)return res; // 搭在四川艦上的陸戰隊，另外可以隨艦航行（下面的海上移動）
  }
  if(isLand(h)&&u.type!=='ff'&&u.type!=='hk'&&u.type!=='psub')landReach(u,res);
  if(canSail(u))seaReach(u,res);
  if(isBde(u)&&!u.ship&&isLand(h)&&h.isl==='CN'&&freeShipKind(u,h)===null)for(const [k,v] of [...res])if(v.kind==='sail'||v.kind==='land')res.delete(k); // 沒有可用的運輸船就出不了海
  return res;
}
function targets(u){
  if(u.acted)return [];
  if(u.type==='hmr'){ // 海馬士：打陸上目標。火箭（GMLRS）射程約 80 km＝4 格；陸軍戰術飛彈（ATACMS）約 300 km＝14 格；各自有實際庫存（rocGml、rocAtc）
    if(u.shots<=0||ssmReady(u)-(u.lu||0)<=0)return [];const hu=hexOf(u),P=S.pools||{},atc=(P.rocAtc||0)>=1,gml=(P.rocGml||0)>=1;if(!atc&&!gml)return [];
    return S.units.filter(e=>e.side!==u.side&&!atSea(e)&&!isMsl(e)&&hexOf(e).isl!=='CN'&&(()=>{const d=rd(hu,hexOf(e));return d<=(atc?kmH(300):kmH(80));})());} // 大陸沿岸集結中的部隊不在目標內（那由長程對地打擊處理）
  if(u.type==='mlrs'){ // 雷霆2000：面積性火力，射程依彈種 15／30／45 km（每格約 20 km）＝最遠 2 格；打海灘上的部隊與靠岸的船團（反登陸），需有彈藥庫存
    if(u.shots<=0||(S.pools&&S.pools.rocRkt||0)<1)return [];const hu=hexOf(u);
    return S.units.filter(e=>e.side!==u.side&&!isMsl(e)&&canHitSub(e)&&hexOf(e).isl!=='CN'&&rd(hu,hexOf(e))<=kmH(40));}
  if(isEsc(u))return escTargets(u);
  if(u.type==='hk')return subTargets(u);
  if(u.type==='psub')return psubTargets(u);
  if(isFixT(u))return []; // 攻擊直升機用資訊卡的出擊按鈕；防空營自動攔截
  if(u.type==='ssn'){if(u.acted||!(u.tp>0||u.hm>0))return [];return shipFoes(u,kmH(120)).filter(e=>(u.tp>0&&rd(hexOf(u),hexOf(e))<=kmH(60))||u.hm>0);}
  if(u.type==='nme'||u.type==='mdt'){if(u.acted||!u.mag||u.mag.asm<=0)return [];return shipFoes(u,u.type==='nme'?NME.R:MDT.R);}
  if(isMsl(u)){if(u.shots<=0||(u.fl&&!(u.mag&&u.mag.asm>0)))return [];
    if(u.type==='ssm'&&(S.pools[ssmPool(u)]||0)<=0)return [];
    const R=u.fl?fleetAgg(u).asmR:ssmHp(u)?kmH(120):kmH(160);
    return S.units.filter(e=>e.side!==u.side&&atSea(e)&&!e.ship&&!isSubT(e)&&rd(hexOf(u),hexOf(e))<=R);
    } // 船上的旅不單獨列為目標：打運輸船，船沉了旅一併損失
  const h=hexOf(u);if(h.isl==='CN')return [];
  // 海上的搶灘突擊（登陸艇、兩棲載具靠岸）只有搭兩棲艦的兩棲旅與陸戰旅做得到：滾裝船沒有登陸艇、只能進港口或浮動碼頭卸載；重型旅也不能搶灘（只能在港口卸載）——這兩種在海上沒有可攻擊的目標
  if(atSea(u)){const sh=u.ship&&shipOf(u);if(u.type==='arm'||u.type==='aas'||(sh&&sh.type==='ro'))return [];}
  return ring2(h).flatMap(n=>unitsAt(n.k)).filter(e=>e.side!==u.side&&!atSea(e)&&canHitSub(e)&&(hd(h,hexOf(e))<=1||hasArt(u))); // 海上的潛艦不能被地面部隊直接攻擊；港內的可以。相鄰格才能突擊，20 km 只有編有砲兵的旅能砲擊
}

function damage(u,n,why){ // 船與船上的旅同進退：但旅在搶灘戰鬥中的損失不會讓外海的運輸艦跟著沉（損失的是登陸艇與部隊）；船被擊沉時船上的旅一併損失
  if(!S._mir&&!(u.ship&&(!why||why==='地面戰鬥'))){const link=u.ship?S.units.find(x=>x.id===u.ship):u.boundTo?S.units.find(x=>x.id===u.boundTo):null;if(link&&alive(link)){S._mir=true;try{damage(link,n,why);}finally{S._mir=false;}if(!alive(u))return false;}} // 船與船上的旅同進退
  S.hits.push({c:u.c,r:u.r,t:S.turn,side:u.side,type:u.type,n:Math.min(n,u.hp),sea:atSea(u),why:why||'地面戰鬥',dead:n>=u.hp,cvn:u.type==='cv'&&u.cvi!=null?AIR.CV[u.cvi].n:null});
  fxq({t:'dmg',id:u.id,at:[u.c,u.r],n:Math.min(n,u.hp),side:u.side});
  if(isLch(u)&&u.veh!=null&&!S._vehHit){u.veh=Math.max(0,Math.round(u.veh-n*ssmVPS(u)));u.fk=(u.fk||[]).slice(0,u.veh);} // 地面戰鬥、先制打擊：每步＝4 輛完全摧毀
  u.hp-=n;if(u.fl&&u.hp>0)fleetLose(u,n);if(u.type==='heli')heliGroundLoss(u,n);if(u.type==='sam')samLoss(u,n);
  shipHitEffects(u,why);
  if(u.hp<=0){unitDestroyed(u,why);return true;}
  return false;
}
// 船艦受損的連帶效果：航艦剩 1 步撤離、護航艦防空彈減少、美軍航艦與潛艦同步、手把震動、航艦受創戰報
function shipHitEffects(u,why){
  if((u.type==='cv'||u.type==='csg')&&u.hp===1&&!u.ooaN){u.ooaN=1;
    const nm=u.type==='csg'?(csgFx(u)?csgName(csgIdx(csgFx(u).id)):'美軍航艦'):(u.cvi!=null?AIR.CV[u.cvi].n:'共軍航艦');
    log(nm+'受創失去戰鬥能力（飛行甲板受損，艦載機無法起降），撤離戰場修理');
    bigNews(nm+'受創撤離',nm+'遭重創、失去作戰能力，在護航艦掩護下撤離戰場。');
    }if(u.type==='dd'&&u.mag&&u.hp>0)u.mag.ad=Math.min(u.mag.ad,Math.round(DDW.ad*u.hp/TYPES.dd.hp));
    if(u.type==='ssn'&&!u.grp){const f=S.fx.units.find(x=>x.id==='ssn');
    if(f)f.hp=Math.max(0,u.hp);
    }if(window.TSL_RUMBLE)TSL_RUMBLE('hit'); // 手把震動（無手把時無效）
  if(u.type==='csg'){const f=csgFx(u);if(f){f.hp=Math.max(0,u.hp);if(f.hp<=0)usCarrierSunk(why||'共軍攻擊');else log(csgName(csgIdx(f.id))+'在'+hname(hexOf(u))+'受創（'+(why||'未知攻擊')+'），'+cvSt(f.hp,f.max)+'，艦載機出擊能力下降');}}
  if(u.type==='cv'&&u.side==='atk'){const at=hname(hexOf(u))+'（'+(why||'未知攻擊')+'）';log(u.hp<=0?'共軍航艦群在'+at+'被擊沉，失去戰鬥能力':'共軍航艦群在'+at+'受創（'+cvSt(u.hp,mhpOf(u))+'），戰力下降');}
}
// 單位被殲滅：統計、移除棋子、連帶效果（船上的旅、港內艦艇、海軍點數、航艦）
function unitDestroyed(u,why){if(isEsc(u)){S.stats.escLost=S.stats.escLost||{atk:0,def:0};S.stats.escLost[u.side]++;}if(u.type==='ssn')S.stats.ssnLost=(S.stats.ssnLost||0)+1;if(u.ally==='JP')S.stats.jpShip=(S.stats.jpShip||0)+1;
    if(['amph','mar','abn','aas','arm','inf','tank','res'].includes(u.type)){S.stats.bdeLost=S.stats.bdeLost||{atk:0,def:0};S.stats.bdeLost[u.side]++;}
    if(u.type==='cvy'){S.stats.cvySunk=(S.stats.cvySunk||0)+1;if(S.pools)S.pools.plaLift=Math.max(0,S.pools.plaLift)+0;}
    if(u.type==='fob')log('攻方灘頭補給站被摧毀：卸載能力與庫存空間下降');
    fxq({t:'dead',at:[u.c,u.r],type:u.type,side:u.side,id:u.id});ghostAdd(u);S.units=S.units.filter(x=>x!==u);
    if(u.boundTo){const b=S.units.find(x=>x.id===u.boundTo);
      if(b){S.hits.push({c:b.c,r:b.r,t:S.turn,side:b.side,type:b.type,n:b.hp,sea:true,why:'運輸船被擊沉',dead:true});
      S.stats.bdeLost=S.stats.bdeLost||{atk:0,def:0};
      S.stats.bdeLost[b.side]++;
      S.units=S.units.filter(x=>x!==b);
      S.stats.lstSunk=(S.stats.lstSunk||0)+1;
      log('運輸船被擊沉，船上的 '+TYPES[b.type].n+' 一併殲滅');
      }}
    if(u.ship){const sh=shipOf(u);
      if(sh)S.units=S.units.filter(x=>x!==sh);
      }if(u.type==='dd'&&S.pools)S.pools.plaNavy=Math.max(0,S.pools.plaNavy-1);
      if(u.type==='ff'&&S.pools)S.pools.rocNavy=Math.max(0,rnd3(S.pools.rocNavy-ffW(u)));
      if(u.type==='hk'&&S.pools)S.pools.rocSub=Math.max(0,S.pools.rocSub-1);
      if(u.type==='psub'&&S.pools)S.pools.plaSub=Math.max(0,S.pools.plaSub-1);
      if(u.type==='cv'&&S.pools){S.pools.plaCV=Math.max(0,S.pools.plaCV-1);
      if(u.cvi!=null){S.cvGone=S.cvGone||[];
      S.cvGone.push(u.cvi);
      if(S.air)S.air.cvF[u.cvi]=0;
      }plaCarrierLost(why,'守方');
      }
    if(!isShip(u)){const rest=unitsAt(K(u.c,u.r));
      if(rest.length&&rest.every(isShip)){rest.forEach(x=>{fxq({t:'dead',at:[x.c,x.r],type:x.type,side:x.side});S.units=S.units.filter(y=>y!==x);if(x.type==='ff')S.pools.rocNavy=Math.max(0,
          rnd3(S.pools.rocNavy-ffW(x)));if(x.type==='dd')S.pools.plaNavy=Math.max(0,S.pools.plaNavy-1);if(x.type==='cv')S.pools.plaCV=Math.max(0,S.pools.plaCV-1);log(uname(x)+' 隨港口失守而損失');});
      }}log(uname(u)+' 在 '+hname(hexOf(u))+' 被殲滅'+(why?'（'+why+'）':''));
}
// 占領：該格與周圍沒有敵軍的陸地格一併易主（細格版的「控制範圍」）
function claim(side,h){
  S.owner[h.k]=side;
  if(side==='atk'&&h.t==='air'&&h.isl==='TW'){S.afl=S.afl||{};if(!S.afl[h.k]){S.afl[h.k]=1;const lost=afBaseLost(h.k);if(lost)log('攻方占領 '+(h.name||'機場')+'，來不及撤離的守方戰機 −'+lost+' 架（推估：該基地約四分之一，其餘轉場）');}}
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
  const b={set textContent(t){['#btnEnd','#mbEnd','#fsEnd'].forEach(q=>{const e=$(q);if(e)e.textContent=t;});}}; // 三處結束階段按鈕同步顯示
  if(!msg.length||endPhaseGuard.t>Date.now()){endPhaseGuard.t=0;b.textContent=TX('結束階段');return false;}
  endPhaseGuard.t=Date.now()+4000;b.textContent=TX('確定結束階段？');toast(msg.join('；')+'。再按一次「結束階段」確認。',3500);
  clearTimeout(endPhaseGuard.h);endPhaseGuard.h=setTimeout(()=>{endPhaseGuard.t=0;b.textContent=TX('結束階段');},4000);
  return true;
}
function doMove(u,k,kind){
  const from=hexOf(u);const h=TER[k];
  if(kind==='drop'&&u.ship){const sh=shipOf(u);if(sh){sh.boundTo=null;sh.ret=false;}u.ship=null;} // 從四川艦機降：艦留在海上（不回兩棲艦群運力池）
  if(kind==='land'&&opposedLanding(u,h)){landAssault(u,h);return;}
  if(u.type==='psub'&&kind==='sail')u.loud=hd(from,h)>SPD.subQuiet;
  if(u.type==='hk'&&kind==='sail'){u.loud=hd(from,h)>SPD.subQuiet;if(u.loud&&!subHidden(u))log(subNm(u)+'高速航行約 '+Math.round(hd(from,h)*KM_HEX)+' km（超過 '+Math.round(SPD.subQuiet*KM_HEX)+' km），噪音大，下一次被反潛發現的機率加倍');}
  if(kind==='sail'&&isBde(u)&&!u.ship&&isLand(from)&&from.isl==='CN')embark(u,from);
  u.c=h.c;u.r=h.r;u.moved=true;if(u.type==='cv'||u.type==='csg'||u.type==='ddh')escFollow(u); // 護航艦跟著航艦移動
  if(u.ship&&(kind==='sail'||kind==='move')){const sh=shipOf(u);if(sh){sh.c=u.c;sh.r=u.r;}}
  if(u.ship&&kind==='land'){const sh=shipOf(u);if(sh){sh.boundTo=null;sh.ret=true;sh.retT=S.turn;}u.ship=null;} // 上岸後船留在外海卸載，下回合起返航
  if(isLand(h))claim(u.side,h);
  if((kind==='land'||kind==='drop')&&S.stats.firstLand===null&&h.isl==='TW')S.stats.firstLand=S.turn;
  if(kind==='land'){fxq({t:'land',at:[h.c,h.r]});u.acted=true;log(uname(u)+' 於 '+hname(h)+' 登陸');mineCheck(u,h);}
  else if(kind==='drop'){
    u.acted=true;u.dropped=true;
    const heli=u.type==='aas',vb=heli?'機降':'空降',lift=heli?'直升機群':'運輸機群';
    let msg=uname(u)+' '+vb+' '+hname(h);
    const al=atkAF().includes(h),hot=!al&&inZOC(u.side,h),pA=dropAD(h)*(al?.5:1),org=[from.c,from.r]; // 機降到已占領的機場：★攔截機率減半、不會遭落點地面壓制
    if(al)msg=uname(u)+' 以運輸機機降已占領的 '+hname(h);
    const shot=hitP(pA,'dropAD'),hp0=u.hp; // 運輸機群先要飛過守方防空，被擊落的部分整批損失
    const lz=hot&&hitP(.5,'dropHot');      // 落點旁有守方部隊：落地時遭地面火力壓制
    const lose=(shot?1:0)+(lz?1:0),dead=lose>=hp0;
    fxq({t:'drop',from:org,at:[h.c,h.r],lost:shot?1:0,fail:dead,id:u.id});
    if(!S.sim&&!S.video&&!REC.quiet&&!S.rec&&!reduce()){u.dropHide=1;setTimeout(()=>{if(u.dropHide){u.dropHide=0;render();}},8000);} // 動畫中的運輸機還沒飛到前，地圖上先不畫這個空降旅（保險：最多 8 秒）
    if(lose){msg+='，'+[shot?lift+'遭防空攔截（攔截率 '+Math.round(pA*100)+'%，推估）':'',lz?'落點遭地面火力壓制':''].filter(Boolean).join('、')+'，損失 '+stpU(u,Math.min(lose,hp0))+(dead?'，'+vb+'失敗':'，其餘部隊落地');log(msg);damage(u,lose,vb+'損失');return;}
    log(msg+'：'+lift+'突破防空，部隊落地（攔截率 '+Math.round(pA*100)+'%，推估）');
  } else{if(kind==='sail'&&from.t!=='sea'&&!subHidden(u))log(uname(u)+' 自 '+hname(from)+' 出航');if(kind==='sail'||kind==='move')mineCheck(u,h);}
}
// 兵種相剋（★推估）：裝甲在平地壓制輕步兵；空降旅沒有重武器打不動裝甲；裝甲進城市或山地施展不開、易遭反裝甲伏擊
// 空降旅（運輸機，約 400 km）、空中突擊旅（直-20／直-8 直升機機降，★約 250 km：福建沿岸到台灣西岸約 150～200 km，載重時作戰半徑有限）
const isAirT=u=>!!u&&(u.type==='abn'||u.type==='aas');
const AIR_R={abn:400,aas:250};
const ARMOR=['arm','tank'],LIGHT=['abn','aas','res'],FOOT=['inf','res','abn','aas','mar','amph'];
function matchMod(u,t,th){const rough=th.t==='city'||th.t==='mtn';
  if(ARMOR.includes(u.type)&&LIGHT.includes(t.type)&&!rough&&!th.town)return {n:1,t:'裝甲在平地對輕步兵'}; // 城鎮：聚落、水田與溝渠讓裝甲展不開，沒有平地優勢，但也不到城市巷戰的劣勢（★推估）
  if(ARMOR.includes(u.type)&&FOOT.includes(t.type)&&rough)return {n:-1,t:'裝甲攻擊'+(th.t==='city'?'城市':'山地')+'裡的步兵'};
  if(isAirT(u)&&ARMOR.includes(t.type))return {n:-1,t:TYPES[u.type].s+'旅沒有重武器'};
  return {n:0};}
// 空降時運輸機群被防空擊落的機率（★推估）：依守方剩餘防空與制空；防空全失時仍有肩射與機槍 5%
function dropAD(h){const P=S.pools||{},p0=(S.p0&&S.p0.rocAD)||1,f=h&&S.sam?samDropF(h):Math.max(0,Math.min(1,(P.rocAD||0)/p0)),c={atk:.5,mid:1,def:1.5}[S.airCtl||'mid']||1;return Math.min(.6,(.05+.25*f)*c);}
// ★旅屬砲兵（推估）：聯兵旅、裝甲旅、兩棲合成旅、陸戰旅、重型合成旅都編有砲兵營（155 mm／122 mm，射程約 15～24 km）；
//  空降旅只有迫擊砲、後備旅的砲兵編制不明，不計。在海上（登陸途中）不能砲擊。
const ART_T={inf:1,tank:1,amph:1,mar:1,arm:1};
const hasArt=u=>!!ART_T[u.type]&&!atSea(u);
const GND_T=['amph','mar','abn','aas','arm','inf','tank','res'];
const isGndAtk=u=>GND_T.includes(u.type);
const isArtShot=(u,t)=>isGndAtk(u)&&!atSea(u)&&hd(hexOf(u),hexOf(t))>1;
// ★砲擊（推估）：每次打掉 1 步的機率 20%，城鎮 ×0.75、城市與山地 ×0.5，依砲擊方剩餘戰力比例；砲擊方沒有損失，也不能推進占領
function artP(u,t){return .2*(1-.5*terrCover(hexOf(t)))*Math.max(0,u.hp)/TYPES[u.type].hp;}
function artFire(u,t){
  const th=hexOf(t);if(th.isl==='TW'||th.isl==='PH')civHit('TW',th,'combat');
  const p=artP(u,t),hit=hitP(p,'art:'+u.type+'>'+t.type);
  log(uname(u)+' 以旅屬砲兵砲擊 '+hname(th)+' 的 '+TYPES[t.type].n+'（約 '+Math.round(hd(hexOf(u),th)*KM_HEX)+' km）：'+(hit?'命中，守方 −1 步':'未造成重大損失')+'（命中率 '+Math.round(p*100)+'%'+coverTxt(th)+'，推估）');
  fxq({t:'atk',from:[u.c,u.r],to:[t.c,t.r],hit,sea:false,tsea:false});if(!hit)fxq({t:'txt',at:[t.c,t.r],s:'未重創',col:t.side});
  u.acted=true;u.moved=true;
  if(hit)damage(t,1,'砲擊');
  checkInstant();
}
function attack(u,t){
  if(isArtShot(u,t))return artFire(u,t);
  const th=hexOf(t);if(th.isl==='TW'||th.isl==='PH')civHit('TW',th,'combat');
  const sup=support(u,t),pen=seaPen(u);
  const rv=!atSea(u)?riverX(hexOf(u),th):null,mm=matchMod(u,t,th),A=effAtk(u)+sup+pen+mm.n, D=effDef(t)+terrDef(th)+(rv?1:0), x=A-D; // 隔河攻擊：守方防禦 +1
  // 兵力對比 → 攻方壓制的機率 s0；骰子只讓它有限度起伏
  const s0=1/(1+Math.exp(-(x+.6)*.5)),s=Math.max(.02,Math.min(.98,s0)),gk=u.type+'>'+t.type;
  // 固定規則：期望損失依兵力對比算出，整數部分立即損失、零頭累積到之後的戰鬥（不再擲骰）
  const pD=Math.max(0,Math.min(.45,(x-1)/9)),pA=Math.max(0,Math.min(.35,-x/10+.1));
  let ld=takeInt(s*(1+pD),'gnd.d:'+gk),la=takeInt((1-s)*.8*(1+pA),'gnd.a:'+gk);
  ld=Math.min(2,ld);la=Math.min(2,la);
  if(!ld&&!la){if(takeInt(s,'gnd.f:'+gk)>=1)ld=1;else la=1;}
  const res=ld&&la?'雙方各有損失（守方 −'+stpN(ld)+'、攻方 −'+stpN(la)+'）':ld?'守方失 '+stpN(ld):'攻擊方失 '+stpN(la);
  log((pen?'搶灘突擊：':'')+uname(u)+' 攻擊 '+hname(th)+' 的 '+TYPES[t.type].n+'：'+A+' 對 '+D+(rv?'（隔著'+rv+'，守方防禦 +1）':'')+(mm.n?'（兵種相剋 '+(mm.n>0?'+':'')+mm.n+'：'+mm.t+'）':'')+'（壓制機率 '+Math.round(s0*100)+'%，固定規則）→ '+res);
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
  const pd=1+S.units.filter(x=>x.type==='dd'&&x.side==='atk'&&rd(hexOf(x),hexOf(t))<=kmH(40)).length;
  return Math.max(0,Math.min(3,t.inc-pd));
}
// 出動紀錄（只記台灣方）：kind＝出動種類（次數），wpn＝武器型號（實際發射枚數）。結算與戰後報告用
// 目標屬於哪個共軍航艦群（航艦本身或它的護航艦）：回傳艦名，不是就回傳 null
function cvGrpName(t){if(!t||t.side!=='atk')return null;const cv=t.type==='cv'?t:t.grp?S.units.find(x=>x.id===t.grp&&x.type==='cv'):null;return cv?(cv.cvi!=null&&AIR.CV[cv.cvi]?AIR.CV[cv.cvi].n:'共軍航艦'):null;}
const cvRec=g=>{const C=S.stats.cvUse=S.stats.cvUse||{};return C[g]=C[g]||{use:{},by:{},fired:{},air:0};};
function cvAirLost(t,L){const g=cvGrpName(t);if(g&&L>0&&S.stats)cvRec(g).air+=L;} // 攻擊航艦群時被擊落的戰機
function useRec(kind,cnt,wpn,n,who,tgt){ // who＝哪個艦隊、基地、單位；tgt＝目標（打航艦群時另外記一份）
  if(!S.stats)return;
  const g=cvGrpName(tgt);
  if(g){const c=cvRec(g);if(kind&&cnt){c.use[kind]=(c.use[kind]||0)+cnt;if(who){const b=c.by[kind]=c.by[kind]||{};b[who]=(b[who]||0)+cnt;}}if(wpn&&n)c.fired[wpn]=(c.fired[wpn]||0)+n;}
  const U=S.stats.use=S.stats.use||{},F=S.stats.fired=S.stats.fired||{};
  if(kind&&cnt){
    U[kind]=(U[kind]||0)+cnt;
    if(who){const B=S.stats.useBy=S.stats.useBy||{},b=B[kind]=B[kind]||{};b[who]=(b[who]||0)+cnt;}
  }
  if(wpn&&n)F[wpn]=(F[wpn]||0)+n;
}
function fireHimars(m,t){
  const P=S.pools||{},d=rd(hexOf(m),hexOf(t)),atc=d>kmH(80)||(P.rocGml||0)<1,h=hexOf(t),key=atc?'rocAtc':'rocGml'; // 沒有火箭彈時，近距離目標也只能用陸軍戰術飛彈
  const n=Math.max(0,Math.min(HMR_PKG,ssmReady(m)-(m.lu||0),Math.floor(P[key]||0))); // 這次齊射的車數：受可射車數與庫存限制
  m.shots--;m.lu=(m.lu||0)+n;m.revealed=true; // 開火後暴露，下個守方階段前都是顯眼目標
  if(S.pools)S.pools[key]=Math.max(0,(S.pools[key]||0)-n); // 每輛 1 枚 ATACMS 或 1 個火箭莢艙（6 發）
  if(m.side==='def')useRec('海馬士齊射',1,atc?'陸軍戰術飛彈':'海馬士火箭彈（莢艙）',n,hname(hexOf(m)));
  const need=Math.min(6,(atc?5:4)+terrCover(h)),fr=n/HMR_PKG*(atc&&!atSea(t)&&FOOT.includes(t.type)?.5:1),hit=hitP(pNeed(need)*fr,'fireHimars'); // ★陸軍戰術飛彈是單點精準武器，打分散的步兵效果差（×0.5） // 不滿 4 輛時命中率依比例縮小
  fxq({t:'hmr',from:[m.c,m.r],to:[t.c,t.r],hit,atc});
  log('海馬士 '+n+' 輛齊射 '+(atc?n+' 枚陸軍戰術飛彈':n+' 個火箭莢艙（'+n*6+' 發）')+'（庫存剩 '+Math.round(S.pools?S.pools[key]:0)+(atc?' 枚飛彈）':' 個莢艙）')+(atc&&!atSea(t)&&FOOT.includes(t.type)?'（精準飛彈打分散步兵，命中率 ×0.5）':'')+(hit?'，命中 ':'，未命中 ')+hname(h)+' 的 '+TYPES[t.type].n+'（'+lastTxt()+'）');
  if(hit)damage(t,1,'海馬士火箭砲');
  checkInstant();
}
function fireMlrs(m,t){
  const h=hexOf(t),sea=atSea(t),d=rd(hexOf(m),h);
  m.shots--;m.rl=1;m.revealed=true; // 開火後暴露；再裝填要補給與時間，下個階段不能開火
  if(S.pools)S.pools.rocRkt=Math.max(0,S.pools.rocRkt-1);
  const need=Math.min(6,(sea?6:5)+(sea?0:terrCover(h))),fr=lchFrac(m),hit=hitP(pNeed(need)*fr,'fireMlrs'); // 無導引面積火力：命中率比海馬士低；打機動中的船更難
  fxq({t:'hmr',from:[m.c,m.r],to:[t.c,t.r],hit,atc:false});
  log('雷霆2000發射火箭彈（'+(d<=kmH(20)?'15 km 級':'30～45 km 級')+'）'+(fr<1?'（可射 '+ssmReady(m)+'／'+lchV0(m)+' 輛）':'')+(hit?'，命中 ':'，未命中 ')+hname(h)+' 的 '+TYPES[t.type].n+'（'+lastTxt()+'）');
  if(hit)damage(t,1,'雷霆2000火箭');
  checkInstant();
}
// 岸置反艦飛彈分兩種：雄二／雄三（中科院，存量 rocAS，射程約 160 km）與魚叉岸防系統（RGM-84L-4，存量 rocHCD，射程約 120 km，2026～2028 年交付）
const ssmHp=u=>u&&u.type==='ssm'&&u.wp==='hp';
const ssmPool=u=>ssmHp(u)?'rocHCD':'rocAS';
const ssmWn=u=>ssmHp(u)?'魚叉':'雄風';
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
