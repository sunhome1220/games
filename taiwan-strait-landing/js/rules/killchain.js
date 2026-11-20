'use strict';
/* 殺傷鏈與飛彈打擊（自 rules.js 拆出） */
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
//   城市 ×0.5（建築與平民遮蔽）、城鎮 ×0.75（城市的一半）、山地 ×0.5（林木與地形）、夜間 ×0.7、雲雨或颱風 ×0.6
//  與敵軍接觸（同格或相鄰格有敵方地面部隊，或相鄰海上有攻方登陸船團——灘頭火力準備時守軍在監視範圍內）：前線部隊集中作戰、被偵察與無人機持續盯住，定位 35%
//  已知位置：開戰頭 2 個回合仍在平時駐地或預構陣地（開戰時的位置，沒移動過）——多年情監偵早已掌握，定位 25%；第 3 回合起部隊已轉入野戰與備用陣地，恢復隱蔽
const GLOC={ctl:{atk:.05,mid:.03,def:.015},city:.5,town:.75,mtn:.5,night:.7,wx:.6,contact:.35,known:.25,knownT:2};
const isGnd=u=>!!u&&!isLch(u)&&!isShip(u)&&!atSea(u)&&CPW[u.type]!==undefined;
const isFixT=u=>!!u&&(u.type==='heli'||u.type==='sam'); // 留在原地、不參與地面戰鬥的棋子
const isLocG=u=>isGnd(u)||isFixT(u); // 要先定位才打得到（地面旅、疏散中的攻擊直升機）
function gContact(t){const h=hexOf(t);return [h,...nbrs(h.c,h.r)].some(n=>n&&unitsAt(n.k).some(e=>e.side!==t.side&&alive(e)&&!isShip(e)&&(isLand(n)?!atSea(e):e.side==='atk')));}
function gKnown(t){const k=K(t.c,t.r);if(t.k0===undefined)t.k0=S.turn<=1&&t.type!=='heli'?k:null;return S.turn<=GLOC.knownT&&t.k0===k;}
function gLocP(t){
  const h=hexOf(t),f=[];let p;
  const kn=gKnown(t); // 先記下開戰時的位置
  if(gContact(t)){p=GLOC.contact;f.push('與敵軍接觸，定位 '+Math.round(p*100)+'%');}
  else if(kn){p=GLOC.known;f.push('仍在開戰前已知的駐地或陣地，定位 '+Math.round(p*100)+'%');}
  else{p=GLOC.ctl[S.airCtl||'mid'];f.push('隱蔽中，制空'+AIRCTL[S.airCtl||'mid']+'時每營定位 '+(Math.round(p*1000)/10)+'%');
    if(h.t==='city'){p*=GLOC.city;f.push('城市 ×'+GLOC.city);}else if(h.town){p*=GLOC.town;f.push('城鎮 ×'+GLOC.town);}else if(h.t==='mtn'){p*=GLOC.mtn;f.push('山地 ×'+GLOC.mtn);}
    if(S.turn%2===0){p*=GLOC.night;f.push('夜間 ×'+GLOC.night);}
    if(S.weather&&(S.weather.id==='bad'||tyThreat(S.weather))){p*=GLOC.wx;f.push('雲雨或颱風 ×'+GLOC.wx);}}
  if(t.type==='sam'&&t.emitT>=S.turn-1&&p<SAM.emit){p=SAM.emit;f.push('雷達開機接戰後遭電子偵察定位 '+Math.round(p*100)+'%');}
  if(!gContact(t)&&isrF()<1){p*=isrF();f.push('共軍指揮與偵察受損 ×'+(Math.round(isrF()*100)/100));}
  return {p,txt:f.join('、')};
}
function gFound(t){const key=S.turn+S.phase;if(t.glT!==key){t.glT=key;const L=gLocP(t);t.glL=L;t.glN=takeInt(L.p*Math.max(0,t.hp),'gloc');}return t.glN;}
// 共軍指揮與偵察節點（南京指揮中心、福建沿海雷達與電子偵察站）受損：定位台灣目標的機率下降，全毀時 ×0.8（★推估，與守方樂山雷達失效對稱）
const isrF=()=>.8+.2*cnShare('isr');
// 可打擊：機動發射車與地面旅都要本階段偵察找到、而且還有沒打過的部分；固定設施、艦艇照舊
const strikeable=u=>canHitSub(u)&&(!isLch(u)||lchFound(u,'bm')>0)&&(!isLocG(u)||gFound(u)>0); // 攻擊直升機開戰前已疏散，比照隱蔽中的地面部隊定位
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
let fireMixOf='魚叉'; // 這一發的彈種（扣庫存前依當時比例決定）
function fireMissile(m,t){
  if(window.__fm)window.__fm.push(t.type+(atSea(t)?'@sea':'@land'));
  if(m.type==='ssn')return ssnFire(m,t);if(m.type==='nme')return nmeFire(t);if(m.type==='mdt')return mdtFire(t);
  if(m.type==='hmr')return fireHimars(m,t);
  if(m.type==='mlrs')return fireMlrs(m,t);
  if(isEsc(m))return fireSalvo(m,t);
  if(m.fl)return fleetSalvo(m,t);
  fireMixOf=m.type==='ssm'?ssmMix(m):asMix();if(m.type==='ssm'&&S.pools)ssmDraw(m,SSM_N); // 存量每點約 100 枚：每發 2 枚＝0.02 點（原本扣 0.2 點＝20 枚，與實際發射數不符）
  m.shots--;if(m.shots<=0&&m.type!=='ssm')m.acted=true; // 岸置發射車打完仍可機動轉移
  if(m.type==='ssm'&&m.side==='def')useRec('岸置反艦飛彈射擊',1,ssmHp(m)?'魚叉（岸防）':'雄二／雄三（岸置）',SSM_N,(ssmHp(m)?'魚叉岸防 ':'雄風 ')+hname(hexOf(m)),t);
  if(m.type==='ssm')m.revealed=true; // 開火後暴露
  if(adCover(t).length){ // 目標在 055／052D／054A 防空涵蓋內：★每次 2 枚，以齊射模型對上艦隊防空（同階段共用接戰上限）
    const n=SSM_N,r=salvoHit(t,n,'ssmSalvo>'+t.type,undefined,fireMixOf),big=isBigShip(t),steps=r.steps;t.inc=(t.inc||0)+1;
    fxSalvo([m.c,m.r],t,r);
    log((m.type==='ff'?'守方艦艇':'岸置反艦飛彈')+'以 '+n+' 枚'+(m.type==='ssm'?ssmWn(m):'雄風')+'飛彈攻擊 '+uname(t)+'：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+salvoStepTxt(t,steps,'，未造成重創')+'（齊射模型，參數為推估）');
    if(steps)damage(t,steps,(m.type==='ssm'?(ssmHp(m)?'魚叉岸防系統 魚叉':'岸置 雄二／雄三'):'雄風')+'飛彈');
    checkInstant();return;
  }
  if(t.type==='ro'||t.type==='cvy'){ // 滾裝船與補給船：商船改裝、體積大、航速慢、沒有自身防空；不在護航艦防空涵蓋內時，飛彈只受尋標命中率限制（同齊射模型的 pSeek）
    const hits=takeInt(SSM_N*seekOf(t),'ssmMerch>'+t.type);t.inc=(t.inc||0)+1;
    fxq({t:'msl',from:[m.c,m.r],to:[t.c,t.r],hit:hits>0});
    log((m.type==='ff'?'守方艦艇':'岸置反艦飛彈')+'以 '+SSM_N+' 枚'+(m.type==='ssm'?ssmWn(m):'雄風')+'飛彈攻擊沒有護航防空的 '+uname(t)+'：命中 '+hits+' 枚（尋標命中率 '+Math.round(seekOf(t)*100)+'%，推估）'+(hits?'，'+tname(t)+' −'+stpU(t,hits):''));
    if(hits)damage(t,hits,(m.type==='ssm'?(ssmHp(m)?'魚叉岸防系統 魚叉':'岸置 雄二／雄三'):'雄風')+'飛彈');
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
  const need=Math.min(6,Math.max(2,5+terrCover(h)-((S.mods.strikeEase&&S.mods.strikeEase[S.turn])||0)));
  if(mob&&lchFound(t,pk.k==='g'?'cm':'bm')<=0){
    fxq({t:'air',at:[t.c,t.r],hit:false,tsea:false,org:orgPick('pla'),k:pk.hs?'hs':pk.k==='g'?'cm':'bm'});
    log('火力打擊 '+hname(h)+'：'+(t.revealed?'發射車已轉移，打到空的陣地':'沒有找到（或已打過所有找到的）真正發射車，打中誘餌與空車')+'（'+t.locL.txt+'；本階段找到的車都已打過；推估）');checkInstant();return;}
  if(isLocG(t)&&gFound(t)<=0){
    fxq({t:'air',at:[t.c,t.r],hit:false,tsea:false,org:orgPick('pla'),k:pk.hs?'hs':pk.k==='g'?'cm':'bm'});
    log('火力打擊 '+hname(h)+'：沒有找到可打擊的'+tname(t)+'營級部隊，打到空的陣地（'+(t.glL?t.glL.txt:'')+'；推估）');checkInstant();return;}
  const PM=pkgMod(pk,h,t),ok=hitP((mob?lchKillP(pk):pNeed(need))*PM.m,'st:'+t.type+':'+pk.k); // 機動發射車：已定位後依武器數量計算
  fxq({t:'air',at:[t.c,t.r],hit:ok,tsea:atSea(t),org:orgPick(S.pools&&S.pools.plaCV>0&&Math.random()<.3?'plaCV':'pla'),k:pk.hs?'hs':pk.k!=='g'?'bm':Math.random()<.5&&S.pools.plaCM>0?'cm':'bomb',ad:!pk.hs&&S.pools.rocAD>0&&!S.sead&&!atSea(t)?(ok?'pass':'int'):undefined});
  if(ok){if(isLch(t)&&t.veh!=null){t.locN=Math.max(0,(t.locN||0)-1);
    const x=ssmHit(t,'火力打擊');
    log('火力打擊命中 '+hname(h)+' 的 '+tname(t)+'：'+x+'（'+(PM.txt?PM.txt+'；':'')+lastTxt()+'）');
    }else{if(isLocG(t))t.glN=Math.max(0,(t.glN||0)-1);
    log('火力打擊命中 '+hname(h)+' 的 '+tname(t)+'（'+(isGnd(t)&&t.glL?t.glL.txt+'；':'')+(PM.txt?PM.txt+'；':'')+lastTxt()+'）');
    damage(t,1,'火力打擊');
    }}
  else log('火力打擊 '+hname(h)+' 未命中（'+(PM.txt?PM.txt+'；':'')+lastTxt()+'）');
  checkInstant();return true;
}

// ── 戰力量詞（通俗文字／戰棋「步」）與綜合戰力 ──
// 「步」是戰棋的耗損單位；通俗模式改用「戰力 %」「艘」「發射車」「航艦損傷狀態」，合計則換算成「相當於幾個旅」
let TERM='plain';const plainT=()=>TERM!=='steps';
// ★推估 綜合戰力權重（每步，以兩棲合成旅 1 步＝1.0 為基準）：依實際裝備對照 ST 100-9 範例（裝甲連 3.2、機步連 2.0、輕步兵連 1.0）。重型合成旅（99A＋04A）、M1A2T 裝甲旅≈裝甲；兩棲旅（05 式兩棲突擊砲＋步戰車）與聯兵旅（M60A3／CM-11 戰車營＋機步營）同屬戰車＋機步混編≈2.4；空降旅（03 式傘兵戰車）介於輕步兵與機步；後備旅＝輕步兵再依訓練打折。發射車、火箭車不計入地面戰力
const CPW={arm:1.3,tank:1.2,amph:1,mar:1,inf:1,abn:.6,aas:.6,res:.35};
const cpOf=u=>Math.max(0,u.hp)*(CPW[u.type]||0);
const cpR=x=>Math.round(x*10)/10;
const fmt1=x=>typeof x==='number'?String(Math.round(x*10)/10):x; // 顯示用：最多一位小數（避免 13.399999999999999）
const cpNum=x=>plainT()?Math.round(x/3*10)/10:cpR(x); // 一個標準旅＝3 步×1.0＝3
const cpU=()=>plainT()?'個旅':'戰力點';
const cpTxt=x=>plainT()?'約 '+cpNum(x)+' 個旅的戰力':cpR(x)+' 戰力點';
const mhpOf=u=>u.mhp||u.max||(TYPES[u.type]||{}).hp||3;
const pctU=u=>Math.max(0,Math.round(100*u.hp/mhpOf(u)));
