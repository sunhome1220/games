'use strict';
/* ---------- 補給線：守方攔截補給船團、攻方護航或加緊運補 ---------- */
const hasBeachhead=()=>S.units.some(u=>u.side==='atk'&&!isShip(u)&&onTW(u));
// 補給情報：守方做決策時看得到攻方補給的實際狀況（船團在哪、貨量多少、空投與卸載能力），只列出真的有東西可以打的選項
function supplyIntel(){
  const cv=S.units.filter(x=>x.side==='atk'&&x.type==='cvy'&&atSea(x)),cargo=cv.reduce((a,u)=>a+u.hp,0),sinks=unloadHexes(),fob=S.units.filter(x=>x.side==='atk'&&x.type==='fob').length;
  const near=cv.length&&sinks.length?Math.min.apply(null,cv.map(u=>Math.min.apply(null,sinks.map(h=>hd(hexOf(u),h))))):null;
  const AC=S.airCtl,fa=rocAirEff(),P=S.pools;
  const airN=plaAirOld()>=3?Math.min(2,Math.floor(plaAirOld()/3)):0;
  const plBase=Math.min(.9,.15+(S.sead?0:.25)+(AC==='def'?.25:AC==='mid'?.1:0)+(fa>=2&&AC!=='atk'?.1:0));
  const prot=Math.max(.2,1-Math.min(.6,P.plaNavy/25)-((S.supOrd&&S.supOrd[S.turn]&&S.supOrd[S.turn].escort)?.25:0));
  const sp=supply(),sup=S.sup&&S.sup.t===S.turn?S.sup:null;
  return {cv,cargo,sinks,fob,near,airN,plBase,plInt:Math.min(.9,plBase+.3*Math.min(1,afShare()*(1-caveF()))),prot,ucap:unloadCap()+fob*2,sp,sup};
}
function intdMineSpot(){ // 攻方主要卸載點（港口優先）外海、還沒有水雷的海格
  const sinks=unloadHexes();if(!sinks.length)return null;const main=sinks.find(h=>h.t==='port')||sinks[0];
  return nbrs(main.c,main.r).find(x=>x&&x.t==='sea'&&!(S.mines&&S.mines[x.k]))||null;
}
function interdictOptions(){
  const I=supplyIntel(),opts=[{id:'normal',label:'照常作戰',desc:'維持原本的攻擊目標。',est:'不影響補給',rec:false}];
  const pc=Math.min(.9,.45*I.prot),hitsE=Math.min(I.cargo,3*pc),gain={};
  if(I.cv.length>0){gain.convoy=hitsE;
    opts.push({id:'convoy',label:'全力打補給船團',desc:'海上有 '+I.cv.length+' 個補給船團（貨量共 '+I.cargo+' 點'+(I.near!=null?'，最近的離卸載點約 '+I.near+' 格':'')+'）。反艦飛彈、潛艦、戰機優先打船團：額外 3 次攻擊，每次命中約 '+Math.round(pc*100)+'%（已計入攻方護航）；代價是反艦飛彈存量 −2，也少打登陸船團。',est:'再擊中約 '+hitsE.toFixed(1)+' 次，攻方少約 '+hitsE.toFixed(1)+' 點貨量',rec:false});}
  if(I.airN>0&&I.plInt>I.plBase){gain.air=I.airN*(I.plInt-I.plBase); // 守方戰機飛不起來（機場全癱瘓）就沒有這個選項
    opts.push({id:'air',label:'全力攔截運輸機',desc:'攻方戰機 '+(S.air?S.air.PLA:'')+' 架，每回合可空投約 '+I.airN+' 點（要天候允許才能飛）。目前運輸機被擊落機率約 '+Math.round(I.plBase*100)+'%（防空'+(S.sead?'已被壓制':'尚可')+'、制空'+AIRCTL[S.airCtl||'mid']+'）；集中攔截後約 '+Math.round(I.plInt*100)+'%。代價是出擊的戰機可能折損（1/3 機率守方空軍 −1）。',est:'空投再少約 '+gain.air.toFixed(1)+' 點，被擊落的運輸機算攻方空軍損失',rec:false});}
  if(I.sinks.length>0&&I.ucap>=3){gain.sabotage=Math.min(2,I.ucap);
    opts.push({id:'sabotage',label:'特種部隊破壞港口後勤設施',desc:'攻方目前有 '+I.sinks.length+' 處可卸貨（港口、灘頭、補給站 '+I.fob+' 個），卸載能力 '+I.ucap+' 點。特種部隊襲擊卸載碼頭與油料庫：下回合卸載能力 −2；代價是破壞行動造成平民傷亡 +1,500。',est:'卸載能力 '+I.ucap+' → '+Math.max(0,I.ucap-2)+'；只有船團要卸貨時才有效',rec:false});}
  // 火力打擊灘頭補給站：位置固定、物資集中的軟目標（★每次 50%），用雷霆2000 或海馬士；代價是發射車開火後暴露
  const fobs=S.units.filter(x=>x.side==='atk'&&x.type==='fob'&&alive(x)),lchs=S.units.filter(x=>x.side==='def'&&(x.type==='hmr'||x.type==='mlrs')&&alive(x));
  if(fobs.length&&lchs.length&&(S.pools.rocRkt||0)>=1){gain.fob=Math.min(2,fobs.reduce((a,x)=>a+x.hp,0))*.5;
    opts.push({id:'fob',label:'火力打擊灘頭補給站',desc:'攻方有 '+fobs.length+' 個灘頭補給站（每個讓卸載能力 +2）。雷霆2000／海馬士集中射擊：2 次攻擊，每次約 50%（位置固定、物資集中，推估），命中扣補給站 1 步、打光就消失。代價：雷霆火箭彈存量 −1，參與的發射車開火後暴露到下個攻方階段。',est:'補給站預計損失約 '+(Math.round(gain.fob*10)/10)+' 步；全毀時卸載能力 −2',rec:false});}
  // 近海布雷：閔江級布雷艇在攻方主要卸載點外海補布一處水雷（只能補回被掃掉的數量，★觸雷 50% 沿用既有規則）
  const swept=Math.max(0,((S.p0&&S.p0.rocMine)||0)-Object.keys(S.mines||{}).length),mineSpot=intdMineSpot();
  if(swept>0&&mineSpot&&(S.mods.mineT||0)<S.turn){gain.mine=.5;
    opts.push({id:'mine',label:'近海補布水雷',desc:'攻方已掃除 '+swept+' 處水雷。布雷艇趁夜在 '+hname(mineSpot)+'（攻方卸載點外海）補布一處：之後經過的船團、運輸船與護航艦有 50% 機率觸雷受損（沿用水雷規則），直到被掃除。代價：布雷艇出港有被發現的風險（1/4 機率守方海軍 −1），每 2 回合最多一次。',est:'卸載點外海多一處雷區',rec:false});}
  // 阻絕就地徵用：撤離或破壞占領區附近的油料、糧食與彈藥庫存（焦土程度低於破壞港口）
  const lc=I.sup?I.sup.local.n:0;
  if(lc>0){gain.deny=Math.min(lc,1);
    opts.push({id:'deny',label:'阻絕就地徵用',desc:'攻方上回合從占領區就地徵用 '+lc+' 點補給（燃料、糧食、彈藥庫存）。民防與後備部隊提前撤離或破壞占領區周邊的物資：下回合就地補給 −1。代價：民生損失與撤離造成平民傷亡 +500，民心（影響攻方日後就地徵用）不變。',est:'就地補給 '+lc+' → '+Math.max(0,lc-1),rec:false});}
  const best=Object.entries(gain).sort((a,b)=>b[1]-a[1])[0];if(best)opts.find(o=>o.id===best[0]).rec=true;
  const sc=I.sp,sup=I.sup;
  return {title:'攔截補給（守方）',blurb:'攻方補給現況：島上部隊 '+sc.used+' 個、補給容量 '+sc.cap+(sup?'（船團 '+sup.convoy.ok+'、空投 '+sup.air.ok+'、就地 '+sup.local.n+'、庫存 '+sup.stock+'）':'')+'；海上補給船團 '+I.cv.length+' 個。',opts};
}
async function interdictEval(){
  if(S.over||S.turn<3||!hasBeachhead())return;
  const info=interdictOptions(),manual=(S.sim&&!S.simAuto)||(!S.video&&S.ctrl.def==='human');
  if(info.opts.length<=1)return; // 攻方補給沒有可打的管道，不必決策
  const ai=()=>{const rest=info.opts.filter(x=>x.id!=='normal');if(Math.random()>=.3||S.pools.rocAS<3||!rest.length)return info.opts[0];const w={convoy:50,air:30,sabotage:20,fob:35,mine:20,deny:15};let tot=rest.reduce((a,x)=>a+w[x.id],0),r=Math.random()*tot;for(const x of rest){r-=w[x.id];if(r<=0)return x;}return rest[0];};
  let o;
  if(manual)o=await askTruce(info,ai);
  else{o=ai();if(!(S.rec&&REC.quiet)&&o.id!=='normal')toast(info.title+'：'+o.label);}
  const m=S.mods,t=S.turn,eff=[],rec={turn:t,phase:S.phase,title:info.title,id:'interdict_'+t,choice:o.label,who:'def',rolls:[],effects:eff};
  log('【'+rec.title+'】守方選擇「'+o.label+'」');
  m.intd=m.intd||{};
  if(o.id!=='normal'){m.intd[t+1]=o.id;S.stats.interdict=(S.stats.interdict||0)+1;m.lastInterdict=t;}
  if(o.id==='convoy'){pAdd('rocAS',-2);const prot=Math.max(.2,1-Math.min(.6,S.pools.plaNavy/25)-((S.supOrd&&S.supOrd[t]&&S.supOrd[t].escort)?.25:0));let hit=0;for(let i=0;i<3;i++){const cs=S.units.filter(x=>x.side==='atk'&&x.type==='cvy'&&atSea(x));if(!cs.length)break;const c=pickBest(cs,x=>x.hp);if(hitP(Math.min(.9,.45*prot),'intdConvoy')){hit++;damage(c,1,'守方（攔截補給船團）');}}eff.push('對補給船團額外發動 3 次攻擊，命中 '+hit,'反艦飛彈存量 −2');log('守方集中攻擊補給船團：命中 '+hit+' 次');}
  else if(o.id==='air'){if(hitP(1/3,'intdAir')){const l=airLose('def',2);eff.push('出擊戰機折損，守方戰機 −'+l+' 架（推估）');}eff.push('下回合空投被擊落機率 +30%');}
  else if(o.id==='sabotage'){if(S.cost&&S.cost.civ)S.cost.civ.TW+=1500;eff.push('下回合船團卸載能力 −2','平民傷亡 +1,500');}
  else if(o.id==='fob'){pAdd('rocRkt',-1);let hit=0;for(let i=0;i<2;i++){const fs=S.units.filter(x=>x.side==='atk'&&x.type==='fob'&&alive(x)&&x.hp>0);if(!fs.length)break;const f=pickBest(fs,x=>-x.hp);if(hitP(.5,'intdFob')){hit++;damage(f,1,'守方火力（灘頭補給站）');}}
    S.units.filter(x=>x.side==='def'&&(x.type==='hmr'||x.type==='mlrs')&&alive(x)).forEach(x=>{x.revealed=true;});
    eff.push('對灘頭補給站 2 次攻擊，命中 '+hit+' 次','雷霆火箭彈存量 −1','發射車開火後暴露');}
  else if(o.id==='mine'){const k=intdMineSpot();if(k){S.mines=S.mines||{};S.mines[k.k]=1;syncMines();S.mods.mineT=S.turn+1;eff.push('在 '+hname(k)+' 補布一處水雷');log('守方布雷艇在 '+hname(k)+' 補布水雷');}
    if(hitP(.25,'intdMine')&&S.pools.rocNavy>0){S.pools.rocNavy--;eff.push('布雷艇被發現擊沉（守方海軍 −1）');}}
  else if(o.id==='deny'){if(S.cost&&S.cost.civ)S.cost.civ.TW+=500;eff.push('下回合就地補給 −1','平民傷亡 +500');}
  rec.snap=snap();S.events.push(rec);
}
function fobSpot(){ // 建立補給站的候選格：攻方掌握、沿岸、沒有敵軍相鄰
  if(S.units.filter(x=>x.side==='atk'&&x.type==='fob').length>=2)return null;
  const c=Object.values(TER).filter(h=>h.isl==='TW'&&S.owner[h.k]==='atk'&&h.coastal&&!h.cliff&&!h.mud&&h.t!=='mtn'&&unitsAt(h.k).length<STACK_MAX&&!unitsAt(h.k).some(e=>e.side!=='atk')&&enemyAdj(h.k,'atk')===0).sort((a,b)=>(b.t==='port')-(a.t==='port')||0);
  return c[0]||null;
}
function convoyOptions(){
  const hit=S.mods.lastInterdict===S.turn-1,I=supplyIntel(),P=S.pools,gw=Math.round(goodwill()*100),fobN=I.fob;
  let owned=0;for(const h of Object.values(TER))if(h.isl==='TW'&&isLand(h)&&S.owner[h.k]==='atk')owned++;
  const opts=[{id:'normal',label:'照常作戰',desc:'不調整護航與運補。',est:'不影響補給',rec:!hit}];
  if(I.cv.length>0||hit)opts.push({id:'escort',label:'集中護航補給船團',desc:'海上有 '+I.cv.length+' 個補給船團（貨量 '+I.cargo+' 點），護航艦隊 '+fmt1(P.plaNavy)+'。集中保護：船團每次遭攻擊的命中率 −25%；但本回合攻方攻擊 −1。',est:'船團較安全，攻勢略緩',rec:hit});
  if(I.airN>0)opts.push({id:'airlift',label:'加大空投',desc:'攻方戰機 '+(S.air?S.air.PLA:'')+' 架，本回合基本可空投 '+I.airN+' 點；再多派運輸機 +1 點，但要穿過防空與戰機（目前被擊落機率約 '+Math.round(I.plBase*100)+'%），被擊落就算空軍損失。',est:'多一點補給，有折損風險',rec:false});
  if(owned>0&&gw>0)opts.push({id:'requisition',label:'強行徵用民間物資',desc:'占領區 '+owned+' 格、民心 '+gw+'%。就地徵用燃料與糧食：就地補給 +1 點（乘上民心）；但強行徵用造成平民傷亡 +1,200，民心下降。',est:'多一點補給，民心再降',rec:false});
  if(P.plaLift>0&&I.sinks.length>0)opts.push({id:'rush',label:'加緊運補',desc:'運輸船剩 '+fmt1(P.plaLift)+' 個、卸載能力 '+I.ucap+' 點。緊急多派 1 個補給船團出航；但抽調護航艦，護航艦隊 −1，新增的船也要承受攻擊。',est:'多一個船團，護航變薄',rec:false});
  if(fobSpot())opts.push({id:'fob',label:'建立灘頭補給站',desc:'目前補給站 '+fobN+' / 2 個。在已掌握的灘頭或港口格建立：卸載能力 +2、庫存空間 +3；本回合補給 −2（材料與人力）；補給站是棋子，守方可以攻擊，攻方要派兵守。',est:'長期補給改善，補給站需要保護',rec:false});
  return {title:'補給線（攻方）',blurb:(hit?'守方正集中火力攻擊你的補給線，要把有限的資源投在哪一條管道？':'灘頭堡已建立。補給靠船團、空投與就地徵用三條路，本回合要偏重哪一條？')+'目前：島上部隊 '+I.sp.used+' 個、補給容量 '+I.sp.cap+'。（結算在本回合開始時進行。）',opts};
}
async function convoyEval(){
  if(S.over||S.turn<3||!hasBeachhead())return;
  const info=convoyOptions(),manual=(S.sim&&!S.simAuto)||(!S.video&&S.ctrl.atk==='human');
  if(info.opts.length<=1)return; // 沒有可調整的項目
  const ai=()=>{const hit=S.mods.lastInterdict===S.turn-1,r=Math.random();const O=info.opts,pickId=id=>O.find(x=>x.id===id)||O[0];
    const nf=S.units.filter(x=>x.side==='atk'&&x.type==='fob').length;return hit?(r<.45?pickId('escort'):r<.6?pickId('airlift'):r<.72?pickId('rush'):r<.82?pickId('requisition'):r<.92&&nf<2?pickId('fob'):O[0]):(nf<2&&r<.45?pickId('fob'):r<.75?O[0]:r<.87?pickId('requisition'):pickId('airlift'));};
  let o;if(manual)o=await askTruce(info,ai);else{o=ai();if(!(S.rec&&REC.quiet)&&o.id!=='normal')toast(info.title+'：'+o.label);}
  const m=S.mods,t=S.turn,eff=[],rec={turn:t,phase:S.phase,title:info.title,id:'convoy_'+t,choice:o.label,who:'atk',rolls:[],effects:eff};
  log('【'+rec.title+'】攻方選擇「'+o.label+'」');
  S.supOrd=S.supOrd||{};S.supOrd[t]={};
  if(o.id==='escort'){S.supOrd[t].escort=1;addTurns(m.atkAtk,t,t,-1);eff.push('船團遭攻擊命中率 −25%；攻方本回合攻擊 −1');}
  else if(o.id==='airlift'){S.supOrd[t].airlift=1;eff.push('空投 +1 點（有被擊落風險）');}
  else if(o.id==='requisition'){S.supOrd[t].requisition=1;eff.push('就地補給 +1 點（乘上民心）；平民傷亡 +1,200');}
  else if(o.id==='rush'){S.supOrd[t].rush=1;S.pools.plaNavy=Math.max(0,S.pools.plaNavy-1);eff.push('多派 1 個補給船團、護航艦隊 −1');}
  else if(o.id==='fob'){S.supOrd[t].fob=1;const h=buildFob();eff.push(h?'在 '+hname(h)+' 建立灘頭補給站（卸載能力 +2、庫存 +3；本回合補給 −2）':'沒有合適的位置，補給站未建立');if(!h)S.supOrd[t].fob=0;}
  rec.snap=snap();S.events.push(rec);
}
function updateBeachheads(){ // 灘岸格連續被攻方控制 2 個回合就成為灘頭堡（補給 +2）；失守即重算
  S.bh=S.bh||{};
  for(const h of Object.values(TER)){
    if(h.isl!=='TW'||!h.coastal||h.cliff||h.mud||h.t==='mtn'||h.t==='port'||MINOR_PORTS[h.k])continue;
    if(S.owner[h.k]==='atk'){if(!S.bh[h.k])S.bh[h.k]=S.turn;}else delete S.bh[h.k];
  }
  if(!S.bhNote&&Object.values(S.bh).some(t=>S.turn-t>=1)){S.bhNote=true;log('灘頭堡已建立：接下來要建立並守住補給線——占領港口、保護跨海補給船團，否則島上部隊會因補給不足而損耗。');if(!REC.quiet&&S.ctrl&&S.ctrl.atk==='human')toast('灘頭堡已建立：要守住補給線',4200);}
}
function supplyAttrition(){ // 補給容量不足：島上攻方部隊逐回合損耗；缺糧越久損耗越重，補給長期斷絕就崩潰（即使占領了台北也一樣）
  const sp=supply(),d=sp.used-sp.cap;
  if(S.turn<3||d<=0){S.stats.supDef=0;return;}
  const sd=S.stats.supDef=(S.stats.supDef||0)+1;
  const us=S.units.filter(u=>u.side==='atk'&&!isShip(u)&&onTW(u)&&u.hp>0);let n=Math.min(us.length,Math.max(1,Math.ceil(d/3))+Math.floor((sd-1)/2)),lost=0;
  while(n-->0&&us.length){const u=pickBest(us,x=>x.hp);us.splice(us.indexOf(u),1);damage(u,1,'補給不足');lost++;} // 缺補給先拖垮兵力最多的單位
  if(lost){S.stats.attr=(S.stats.attr||0)+lost;log('攻方灘頭補給線未建立（需求 '+sp.used+'、容量 '+sp.cap+'；已連續 '+sd+' 回合）：島上部隊損耗 '+stpN(lost));if(!REC.quiet)toast('攻方補給不足，島上部隊損耗');}
  if(S.over)return;
  const noLift=S.pools.plaLift<=0&&!S.units.some(x=>x.side==='atk'&&x.type==='cvy');
  if((noLift&&sd>=2)||sd>=5){
    endGame(noLift?'攻方的補給船團與運輸船已全數損失，島上部隊連續 '+sd+' 回合得不到彈藥與油糧，彈盡糧絕而崩潰；即使一度占領台北，也守不住。':'攻方在島上連續 '+sd+' 回合補給不足，部隊在缺彈缺糧中被耗盡，攻勢崩潰。','def','補給斷絕，守方勝利');
  }
}
function checkInstant(){
  syncShips();
  if(S.over)return;
  if(S.units.some(u=>u.side==='atk'&&!isShip(u)&&(atSea(u)||onTW(u))))S.stats.sailed=true;
  if(S.started&&twControl()>=.8)return endGame('攻方已控制本島八成以上領土，守方大勢已去，攻方立即獲勝。','atk');
  if(S.stats.sailed&&S.turn>=3&&!penghuFirst()&&!(S.pools&&S.pools.plaLst>0)&&!S.units.some(u=>u.side==='atk'&&!isShip(u)&&(atSea(u)||onTW(u)||hexOf(u).isl==='PH'))) // 攻方還有兩棲艦可以再發起一波、或正按計畫先取澎湖時，不算「無法登陸」return endGame('渡海船團全滅、登陸部隊耗盡：攻方已無法登陸，守方獲勝。','def');
  if(!S.units.some(u=>u.side==='def'&&onTW(u)))return endGame('守方本島部隊全滅，攻方立即獲勝。','atk');
  {const a=snap();if(a.n>=3&&S.turn>=2&&(a.ds<=4||a.ds*6<=a.as))return endGame('守方防線全面崩潰：攻方已達成三項勝利條件，島上守軍僅剩'+cpTxt(a.ds)+'（攻方'+cpTxt(a.as)+'），攻方立即獲勝。','atk');}
  if(!S.units.some(u=>u.side==='atk'&&!isShip(u))&&S.turn>=5)return endGame('攻方部隊全滅，守方立即獲勝。','def');
}
