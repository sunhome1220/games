'use strict';
/* 戰力顯示輔助、局勢條件與勝負判定（自 rules.js 拆出） */
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
let TWL=null; // 本島陸地格（開局後不變，快取）
const twControl=()=>{const hs=TWL||(TWL=Object.values(TER).filter(h=>h.isl==='TW'&&isLand(h)));return hs.length?hs.filter(h=>S.owner[h.k]==='atk').length/hs.length:0;}; // 攻方控制的本島領土比例
