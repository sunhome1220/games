'use strict';
/* ---------- 守方決策節點：開戰前、集結期間、開戰初期、中後段 ---------- */
const DEFEV=[
 {id:"pre_deploy",setup:"optPreDeploy",defend:true,at:()=>[1,'atk'],title:"戰備整備重點",blurb:"在攻方行動之前，有限的預算與時間要用在哪一項？",
  choice:{who:'def',options:[{id:"asm",label:"加強反艦飛彈備彈",desc:"反艦飛彈存量 +3；但防空建設延後，守方防空 −1。"},{id:"ad",label:"強化防空與機場加固",desc:"守方防空 +1；但備彈縮減，反艦飛彈存量 −2。"},{id:"reserve",label:"擴大後備與訓練",desc:"每一梯次後備旅 +1；但長程飛彈存量 −1。"},{id:"x_militia",x:1,label:"🔥 全民皆兵",desc:"每一梯次後備旅 +2；平民傷亡 +25%、守方空軍 −1。",ref:"全民防衛；烏克蘭全民抵抗"}]},
  apply(c){const m=S.mods;if(c=="asm"){pAdd('rocAS',3);pAdd('rocAD',-1); return ["反艦飛彈存量 +3","守方防空 −1"];}if(c=="ad"){pAdd('rocAD',1);pAdd('rocAS',-2); return ["守方防空 +1","反艦飛彈存量 −2"];}if(c=="reserve"){m.defReinfExtra+=1;pAdd('rocMsl',-1); return ["每一梯次後備旅 +1","長程飛彈存量 −1"];}if(c=="x_militia"){m.defReinfExtra=Math.min(4,m.defReinfExtra+2);m.civMul*=1.25;pAdd('rocAir',-1);return ["每一梯次後備旅 +2（總加成上限 +4）", "平民傷亡 +25%", "守方空軍 −1"];}return [];}},
 {id:"react",setup:"optReact",defend:true,at:()=>[1,'atk'],title:"預警後的反應",blurb:()=>{const b=S.mods.buildup;return (b==='open'?'攻方公開大規模集結，預警充分。':b==='surprise'?'攻方採戰略突襲，預警有限。':'攻方以演習名義集結，只有部分預警。')+'守方要決定如何反應。';},
  choice:{who:'def',options:[{id:"alert",label:"提高戰備等級",desc:"守方第 1～2 回合防禦 +1；但戰備消耗，反艦飛彈存量 −1。"},{id:"evac",label:"疏散民眾與重要設施",desc:"台灣平民傷亡 −30%；但交通管制使後備旅延後 1 回合到達。"},{id:"bait",label:"欺敵與分散機動發射車",desc:"發射車被火力打擊時更常打到誘餌；但分散部署使守方第 1 回合攻擊 −1。"},{id:"x_preempt",x:1,label:"🔥 預防性打擊集結港",desc:"重創集結中的 2 個攻方船團（各損失約三分之一）；被視為首先動武，美日更不願介入。",ref:"預防性自衛的爭論"},{id:"x_martial",x:1,label:"🔥 宣布戰爭狀態、封閉海空域",desc:"第 1～3 回合守方防禦 +1、後備提前 1 回合、平民傷亡 −15%；股市 −3。",ref:"「莊敬自強，處變不驚」"}]},
  apply(c){const m=S.mods;if(c=="alert"){addTurns(m.defDef,1,2,1);pAdd('rocAS',-1); return ["守方第 1～2 回合防禦 +1","反艦飛彈存量 −1"];}if(c=="evac"){m.civMul*=.7;m.defReinfDelay+=1; return ["台灣平民傷亡 −30%","後備旅延後 1 回合到達"];}if(c=="bait"){m.decoy=1;addTurns(m.defAtk,1,1,-1); return ["火力打擊更常打到誘餌","守方第 1 回合攻擊 −1"];}if(c=="x_preempt"){const n=hitCNUnits(2,'預防性打擊');m.escal=(m.escal||0)+2;return ["重創集結中的攻方船團（最多 2 個單位各損失約三分之一）", "守方先動手：盟友更不願被拖下水（反映在參戰評估）"];}if(c=="x_martial"){addTurns(m.defDef,1,3,1);m.defReinfDelay-=1;m.civMul*=.85;hitMkt(3);return ["守方第 1～3 回合防禦 +1、後備提前 1 回合", "平民傷亡 −15%、全球股市 −3"];}return [];}},
 {id:"penghu",setup:"optPenghu",defend:true,at:()=>[1,'atk'],title:"澎湖守備方針",autoPick:()=>'hold',
  blurb:"澎湖地勢平坦、離本島約 45 公里，在共軍飛彈與戰機範圍內；公開討論多半認為澎湖是不能放棄的外島（失守等於失去海峽），但也有兵推顯示澎湖可能一天就失守。",
  choice:{who:'def',options:[{id:"hold",label:"堅守",desc:"維持現有守軍。"},
    {id:"reinforce",label:"開戰前增援（玉山艦）",desc:"開戰前用玉山艦等運輸艦，把本島一個陸戰旅送到澎湖：澎湖守軍增加，本島少一個旅。戰略突襲時來不及送。"},
    {id:"abandon",label:"棄守，集中本島",desc:"澎湖守軍撤回本島（嘉義、台南一帶），本島多一份兵力；攻方可輕易取得馬公前進基地。放棄國土有政治代價：守方社會韌性判定 −1（推估）。"}]},
  apply(c){return penghuPolicy(c);}},
 {id:"navydep",setup:"optNavy",defend:true,at:()=>[1,'atk'],title:"海軍部署",autoPick:()=>{const b=S.mods.buildup;return b==='open'?'east':b==='surprise'?'port':'disperse';},
  blurb:()=>{const b=S.mods.buildup;return '台灣海軍 6 個艦隊平時停在母港。開戰第一波飛彈會打固定目標（港口）；在海上移動的船，彈道飛彈很難命中。'+(b==='surprise'?'這次是戰略突襲，大型艦艇來不及出港，只有海蛟大隊能及時疏散。':'');},
  choice:{who:'def',options:[{id:"port",label:"留港備戰",desc:"艦隊留在母港，有港口防空保護、補給方便；但開戰第一波飛彈會直接打到港內的船。"},
    {id:"east",label:"出港疏散到東部外海",desc:"艦隊移到花蓮、台東外海（中央山脈屏障、遠離海峽），在海上移動時彈道飛彈很難命中（★×0.1）；但沒有港口防空、離海峽較遠，而且共軍航艦艦隊在東側活動。預警有限（戰略突襲）時只有海蛟大隊來得及出港。"},
    {id:"disperse",label:"分散到母港附近外海",desc:"各艦隊分散到母港附近 2 格內的外海，彈道飛彈很難命中；離戰場近、出擊快，但同樣沒有港口防空。預警有限（戰略突襲）時只有海蛟大隊來得及出港。"}]},
  apply(c){return navyDeploy(c);}},
 {id:"prepos",setup:"optPrepos",defend:true,at:()=>[1,'atk'],title:"預先部署重點",blurb:"攻方船團可能從北、中部渡海。守方要決定兵力放在哪裡。",
  choice:{who:'def',options:[{id:"coast",label:"前推到海岸線",desc:"守方第 1～3 回合防禦 +1（灘頭交戰）；但兵力暴露，攻方第 1 回合打擊更容易命中（命中門檻 −1）。"},{id:"depth",label:"縱深機動、保存實力",desc:"守方第 2～4 回合攻擊 +1（反擊）；但灘頭薄弱，第 1～2 回合防禦 −1。"},{id:"hide",label:"疏散戰機與裝備、隱蔽",desc:"開戰前戰機就躲進佳山、石子山的山洞機堡（約 200 架，推估），其餘分散到疏散機場與公路跑道：到第 2 回合結束，機堡內的戰機不會在地面被炸，其餘地面損失減半（推估）。代價：躲藏的戰機不出擊，這段期間空軍出擊架次與空中戰力依比例下降。"},{id:"x_water",x:1,label:"🔥 水際死守",desc:"第 1～3 回合守方防禦 +2；海岸部隊暴露，攻方第 1～2 回合打擊更容易命中（命中門檻 −1）；第 4～6 回合守方防禦 −1。",ref:"「殲敵於水際、決勝於灘頭」"},{id:"x_scorch",x:1,label:"🔥 焦土縱深",desc:"3 個主要港口自毀，攻方第 2～4 回合攻擊 −1；平民傷亡 +50%、經濟損失大增。",ref:"1938 年焦土抗戰"}]},
  apply(c){const m=S.mods;if(c=="coast"){addTurns(m.defDef,1,3,1);addTurns(m.strikeEase,1,1,1); return ["守方第 1～3 回合防禦 +1","攻方第 1 回合打擊命中門檻 −1（暴露）"];}if(c=="depth"){addTurns(m.defAtk,2,4,1);addTurns(m.defDef,1,2,-1); return ["守方第 2～4 回合攻擊 +1","守方第 1～2 回合防禦 −1"];}if(c=="hide"){m.cave={until:2};m.disp=1;const f=caveF(); return ["約 "+Math.round(f*S.air.TW)+" 架戰機（約 "+Math.round(f*100)+"%）躲進山洞機堡，其餘分散：到第 2 回合結束，地面戰機損失依比例減少","代價：這段期間空軍出擊架次與空中戰力 ×"+fmt1(1-f)];}if(c=="x_water"){addTurns(m.defDef,1,3,2);addTurns(m.strikeEase,1,2,1);addTurns(m.defDef,4,6,-1);return ["守方第 1～3 回合防禦 +2、攻方第 1～2 回合打擊命中門檻 −1（暴露）", "守方第 4～6 回合防禦 −1"];}if(c=="x_scorch"){razeAllPorts();addTurns(m.atkAtk,2,4,-1);m.civMul*=1.5;S.cost.dmg.TW+=3;return ["3 個主要港口自毀（永久無法使用）", "攻方第 2～4 回合攻擊 −1", "平民傷亡 +50%、經濟損失大增"];}return [];}},
 {id:"counter",defend:true,at:()=>[1,'def'],title:"反制先制打擊",blurb:()=>{ // 先讓守方看到「被打了什麼」，再決定怎麼反制
  const r=S.events.find(e=>e.id==='strike'),P=S.pools||{},base="攻方的第一波飛彈與空襲已經結束，守方要決定如何反制。";
  // 統計摘要：依類別歸納這回合攻方階段的戰報（火力打擊、海軍、部隊、空降、戰機），每類一行，沒發生的不列
  const T=S.log.filter(l=>l.t===S.turn&&l.p==='atk').map(l=>l.msg),H=S.hits.filter(h=>h.t===S.turn&&h.side==='def'),B=[];
  const fx=r?(r.effects||[]).filter(Boolean):[];
  if(r&&(r.choice||fx.length))B.push((r.choice?SIDE[r.who]+'選擇「'+r.choice+'」':'攻方打擊')+(fx.length?'，結果：'+fx.join('、'):''));
  const sk=T.filter(m=>/^火力打擊/.test(m)),skHit=sk.filter(m=>/^火力打擊命中|^火力打擊機場 \S+：(?:受損|嚴重受損|跑道癱瘓)|^火力打擊 .*? 命中 /.test(m));
  const af=[...new Set(T.map(m=>(m.match(/^火力打擊機場 (\S+)：(?:受損|嚴重受損|跑道癱瘓)/)||[])[1]).filter(Boolean))];
  if(sk.length)B.push('火力打擊 '+sk.length+' 次，命中 '+skHit.length+' 次'+(af.length?'；機場受損：'+af.slice(0,4).join('、')+(af.length>4?' 等':''):''));
  const navy=H.filter(h=>h.type==='ff').reduce((a,h)=>a+h.n,0),nn=[...new Set(T.map(m=>(m.match(/^(.+?)（守方） 在 .+ 被殲滅/)||[])[1]).filter(x=>x&&/艦隊|大隊/.test(x)).map(x=>x.replace(/（.*?）/,'')))];
  if(navy>0)B.push('海軍損失 '+navy+' 艘'+(nn.length?'（'+nn.slice(0,3).join('、')+(nn.length>3?' 等':'')+'）':''));
  const gnd=H.filter(h=>h.type!=='ff'&&h.type!=='hk').reduce((a,h)=>a+h.n,0);if(gnd>0)B.push('守方部隊與飛彈車損失 '+stpN(gnd));
  const ab=[...new Set(T.map(m=>(m.match(/^空降旅（攻方） 空降 ([^，]+)/)||[])[1]).filter(Boolean))];if(ab.length)B.push('空降：'+ab.slice(0,3).join('、'));
  const ac=T.reduce((a,m)=>a+((m.match(/(?:守方戰機|地面戰機) −(\d+) 架/)||[])[1]|0),0);if(ac>0)B.push('守方地面戰機損失 '+ac+' 架');
  const what=B.length?B.map(x=>'<br>・'+x).join(''):'戰報上目前沒有明確的打擊損失紀錄';
  return base+"<br><b>被打了什麼：</b>"+what+"<br><b>目前守方：</b>空軍 "+P.rocAir+"・防空 "+P.rocAD+"・反艦飛彈 "+P.rocAS+"・長程飛彈 "+fmt1(P.rocMsl)+((P.rocAtc||0)+(P.rocGml||0)>0?"・陸軍戰術飛彈 "+Math.round(P.rocAtc||0)+" 枚・火箭彈 "+Math.round(P.rocGml||0)+" 莢艙":"")+(S.mods.c2Strong?"；指揮通信受重創":"");},
  choice:{who:'def',options:[
   {id:"disperse",label:"分散疏散並搶修機場",desc:"工兵搶修跑道：受損機場最多 2 座各恢復 1 級；戰機分散到疏散機場與公路跑道，之後機場被打時地面戰機損失減半（推估）；飛彈車分散並加強誘餌，之後被定位的機率 ×0.75（推估）。代價：飛彈車換陣地，本階段岸置飛彈與海馬士各少一次射擊。"},
   {id:"sortie",label:"戰機進山洞機堡",desc:"戰機轉場躲進佳山、石子山的山洞機堡（約 200 架，推估），到第 2 回合結束：躲進去的戰機不會在地面被炸，機場被打時地面戰機損失依躲藏比例減少。代價：躲藏的戰機不出擊，這段期間空軍出擊架次與空中戰力依比例下降。跑道受損嚴重（起降能量不足一半）就無法轉場，等於沒有效果。"},
   {id:"retaliate",label:"立即反擊大陸基地",desc:"趁共軍第二波前，先用掉本階段約一半的縱深打擊發射量（每包 4 枚；300 km 內優先用陸軍戰術飛彈，更遠用雄二E），目標依價值挑選（火箭軍陣地、機場、海軍基地、集結區）；和「縱深打擊」同一套規則：先過共軍防空攔截，突破後命中率依目標硬度 20～45%，命中使基地受損一級。發射車有限，本階段之後能發射的就相應減少。"},
   {id:"x_deep",x:1,label:"🔥 全面長程反擊對岸縱深",desc:"立刻用掉本階段全部的縱深打擊發射量（同一套規則，目標依價值挑選），本階段之後就不能再發射；局勢升高、美日更謹慎。",ref:"「重層嚇阻」"}]},
  apply(c){
   const m=S.mods,P=S.pools;
   if(c=="disperse"){
    const dm=Object.keys(S.afDmg||{}).filter(k=>S.owner[k]!=='atk').sort((x,y)=>S.afDmg[y]-S.afDmg[x]).slice(0,2),out=[];
    dm.forEach(k=>{S.afDmg[k]--;out.push((TER[k].name||'機場')+(S.afDmg[k]>0?' 恢復 1 級（仍受損）':' 恢復運作'));if(S.afDmg[k]<=0)delete S.afDmg[k];});
    m.decoy=1;m.disp=1;let n=0;S.units.forEach(u=>{if(u.side==='def'&&(u.type==='ssm'||u.type==='hmr')&&u.shots>0){u.shots--;n++;}});
    return [out.length?'搶修機場：'+out.join('、'):'沒有受損的機場需要搶修','戰機分散到疏散機場與公路跑道：之後機場被打時地面戰機損失減半（推估）','飛彈車分散並加強誘餌：之後被定位的機率 ×'+KLOC.decoy+'（推估）','本階段 '+n+' 個飛彈單位換陣地，各少一次射擊'];
   }
   if(c=="sortie"){
    const af=airfields().filter(h=>S.owner[h.k]!=='atk'),cap=af.length?af.reduce((a,h)=>a+[1,.5,.2,0][Math.min(3,afLevel(h.k))],0)/af.length:0;
    if(cap<.5)return ["機場跑道受損嚴重（起降能量約 "+Math.round(cap*100)+"%），戰機無法轉場到山洞機堡，沒有效果"];
    m.cave={until:2};const f=caveF();
    return ["約 "+Math.round(f*S.air.TW)+" 架戰機（約 "+Math.round(f*100)+"%）躲進山洞機堡，到第 2 回合結束：地面戰機損失依比例減少","代價：這段期間空軍出擊架次與空中戰力 ×"+fmt1(1-f)];
   }
   if(c=="retaliate"||c=="x_deep"){
    const n=c=="x_deep"?lrPackets():Math.ceil(lrPackets()/2),h0=S.stats.cn.hits;let k=0; // 每包 4 枚
    for(;k<n;k++){const id=aiPickCN(true);if(!id)break;strikeCN(id,'roc');}
    if(c=="x_deep")m.escal=(m.escal||0)+1;
    const h=S.stats.cn.hits-h0;
    return ["發射長程飛彈 "+k+" 包（每包 4 枚，共 "+k*ROCLR.pk+" 枚），命中 "+h+" 次（逐包結果見戰報）"].concat(c=="x_deep"?["局勢升高：美日更謹慎（反映在參戰評估）"]:[]);
   }
   return [];
  }},
 {id:"sustain",defend:true,at:T=>[Math.max(3,T-2),'def'],title:"持久戰策略",blurb:"距離判定只剩兩個回合。決定守方最後階段的作戰重點（影響本回合與下回合）。",
  choice:{who:'def',options:[
   {id:"counter",label:"全力反攻收復失地",desc:"效果：砲兵與空中支援集中到反攻方向，守方攻擊 +1；電腦操作的守軍會主動進攻、朝失地集中。代價：預備隊全部投入，其他防線空虛，防禦 −1。"},
   {id:"hold",label:"固守要點、節省兵力",desc:"效果：構工與預置陣地，守方防禦 +1；電腦操作的守軍只在勝算很高時才進攻。代價：放棄反擊，攻擊 −1，攻方可以從容鞏固灘頭。"},
   {id:"mobilize",label:"動員第二梯次後備部隊",hide:()=>!S.units.some(u=>u.side==='atk'&&onTW(u)&&!isShip(u)),desc:"效果：再編成 2 個後備旅，部署在最受威脅的要點（台北或被攻方逼近的港口）附近。代價：編成中攻防各 −1（到下一個攻方階段結束）；動員影響經濟，全球股市 −1。"},
   {id:"x_scorch2",x:1,label:"🔥 焦土保台、同歸於盡",desc:"效果：4 個主要港口（基隆、台北港、台中港、高雄）永久破壞，攻方無法用港口卸載，補給容量未來兩回合再 −2。代價：港口永久無法使用，平民傷亡 +50%。",ref:"「寧為玉碎，不為瓦全」"},
   {id:"x_raid",x:1,label:"🔥 特種部隊突襲後勤樞紐",desc:"效果：特戰部隊滲透攻擊攻方島上的油料、彈藥集積點，攻方補給容量未來兩回合 −2。代價：特戰部隊折損，不再支援前線偵察與火力引導，守方攻擊 −1。",ref:"非對稱作戰"}]},
  apply(c){const m=S.mods,t=S.turn;m.defPost=m.defPost||{};
   if(c=="counter"){addTurns(m.defAtk,t,t+1,1);addTurns(m.defDef,t,t+1,-1);m.defPost[t]=m.defPost[t+1]='counter';return ["守方本回合與下回合攻擊 +1、防禦 −1","電腦操作的守軍主動反攻失地"];}
   if(c=="hold"){addTurns(m.defDef,t,t+1,1);addTurns(m.defAtk,t,t+1,-1);m.defPost[t]=m.defPost[t+1]='hold';return ["守方本回合與下回合防禦 +1、攻擊 −1","電腦操作的守軍只在勝算很高時才進攻"];}
   if(c=="mobilize"){const lost=OBJ.filter(k=>S.owner[k]==='atk'),thr=OBJ.filter(k=>S.owner[k]!=='atk'&&S.units.some(u=>u.side==='atk'&&!isShip(u)&&onTW(u)&&hd(hexOf(u),TER[k])<=3)),anchors=thr.length?thr:[TAIPEI];let n=0;
     for(let i=0;i<2;i++){const k=anchors[i%anchors.length];const hx=(S.owner[k]==='def'&&!unitAt(k))?TER[k]:placeNear(k,x=>x.isl==='TW'&&x.t!=='mtn'&&S.owner[x.k]==='def'&&!inZOC('def',x));if(hx){const nu=mkUnit('def','res',hx.k);nu.mobT=S.turn;S.units.push(nu);S.stats.reserves++;n++;}}
     hitMkt(1);return ["第二梯次後備旅 "+n+" 個完成編成（攻防各 −1，到下一個攻方階段結束）","全球股市 −1"];}
   if(c=="x_scorch2"){razeAllPorts();addTurns(m.supCut,t,t+1,2);m.civMul*=1.5;return [PORTS.length+" 個主要港口永久破壞", "攻方補給容量未來兩回合 −2、平民傷亡 +50%"];}
   if(c=="x_raid"){addTurns(m.supCut,t,t+1,2);addTurns(m.defAtk,t,t+1,-1);return ["攻方補給容量未來兩回合 −2", "守方本回合與下回合攻擊 −1（特戰部隊折損）"];}
   return [];}},
];
(function(){
  const at=id=>EVENTS.findIndex(e=>e.id===id);
  EVENTS.splice(at('buildup'),0,DEFEV[0],DEFEV[1]);       // 開戰前（攻方集結之前）
  EVENTS.splice(at('buildup')+1,0,DEFEV[2],DEFEV[3]);     // 攻方集結期間
  EVENTS.splice(at('final'),0,...DEFEV.slice(4));          // 開戰初期、中段與後期
})();
function snap(){
  let as=0,ds=0;for(const u of S.units)if(onTW(u)&&!isSup(u)&&!isShip(u)){if(u.side==='atk')as+=cpOf(u);else ds+=cpOf(u);}
  as=cpR(as);ds=cpR(ds); // 綜合戰力（兩棲旅 1 步＝1）
  const cs=conditions();
  return {as,ds,sea:S.units.filter(u=>u.side==='atk'&&atSea(u)&&!isShip(u)).length,ports:PORTS.filter(k=>S.owner[k]==='atk'&&!S.portDown[k]).length,pok:portHold().ok,
    taipei:S.owner[TAIPEI]==='atk',ssm:S.units.filter(u=>u.side==='def'&&u.type==='ssm').reduce((a,u)=>a+u.hp,0),ssmV:S.units.filter(u=>u.side==='def'&&u.type==='ssm').reduce((a,u)=>a+(u.veh!=null?u.veh:u.hp),0),n:cs.filter(c=>c.atk).length,
    plaAir:Math.round(plaAirAll()*10)/10,ally:Math.round(allyAir()*10)/10,plaN:S.air?S.air.PLA+cvFighters():0,twN:S.air?S.air.TW:0,navy:S.pools.plaNavy,cv:S.pools.plaCV,fx:'美 '+LV.US[S.fx.lv.US]+'・日 '+LV.JP[S.fx.lv.JP]};
}
function snapDiffHTML(now,prev){ // 預覽用：只列出有變化的項目，畫面短、按鈕不會被擠到下面
  const defs=[['攻方島上戰力','as',v=>cpNum(v)+' '+cpU(),'up'],['守方島上戰力','ds',v=>cpNum(v)+' '+cpU(),'down'],['攻方海上單位','sea'],['攻方控制港口','ports',v=>v+' / '+PORTS.length,'up'],['台北','taipei',v=>v?'攻方':'守方'],['守方岸置反艦飛彈',plainT()?'ssmV':'ssm',v=>v+(plainT()?' 輛發射車':' 步'),'down'],['攻方空軍','plaAir',null,'up'],['守方與盟國空軍','ally',null,'down'],['攻方護航艦隊','navy',null,'up']];
  const ch=defs.filter(d=>now[d[1]]!==prev[d[1]]).map(([label,key,fmt,good])=>{
    const v=now[key],p=prev[key];let d='';
    if(typeof v==='number'){const up=v>p;d='<i class="'+((up===(good==='up'))?'up':'down')+'">'+(up?'+':'')+(Math.round((v-p)*10)/10)+'</i>';}
    return '<div><span>'+label+'</span><b>'+(fmt?fmt(v):v)+'</b>'+d+'</div>';});
  if(now.fx!==prev.fx)ch.push('<div style="grid-column:1/-1"><span>各國參戰</span><b style="font-size:13px">'+now.fx+'</b></div>');
  return (ch.length?'<div class="snap">'+ch.join('')+'</div>':'<div class="dd">沒有立即的數值變化。</div>')+
    '<div class="proj">'+verdictNote(now.n)+'</div>';
}
const evBlurb=ev=>typeof ev.blurb==='function'?ev.blurb():ev.blurb;
function evHead(ev,i){return '<div class="eyebrow">事件節點 '+(i+1)+' / '+EVENTS.length+' · 第 '+S.turn+' 回合 '+SIDE[S.phase]+'階段前</div><h3>'+ev.title+'</h3><p>'+evBlurb(ev)+'</p>';}
function rowFor(rows,v){return rows.find(r=>v>=r.min&&v<=r.max);}
// 「依自身利益決定」：不擲骰，依戰況與各國利益評估（1～6）
function interestEval(c){
  const a=snap(),why=[];let n=3;
  const ds=a.ds,as=a.as,cas=usCas(),st=S.baseStruck||{US:0,JP:0};
  if(c==='US'){n++;why.push('半導體與第一島鏈利益 +1');}
  if(a.ports>=2||a.taipei){n++;why.push('攻方已控制'+(a.taipei?'台北':a.ports+' 個港口')+'，再不介入將失去台灣 +1');}
  else if(as===0&&ds>0){n--;why.push('攻方尚未登陸，無須急著介入 −1');}
  if(ds>=as&&as>0){n++;why.push('守軍仍撐得住，介入有勝算 +1');}
  else if(ds<=2&&as>=ds+4){n--;why.push('守軍幾近崩潰，介入恐為時已晚 −1');}
  if(c==='US'&&cas>=6){n--;why.push('美軍'+casN(cas)+'，國內反彈 −1');}
  if(c==='US'&&S.fx.lv.JP>=1){n++;why.push('日本已同意使用基地 +1');}
  if(c==='JP'&&S.fx.lv.US>=2){n++;why.push('美國已公開介入，同盟壓力 +1');}
  if(c==='JP'&&S.fx.lv.US<=1){n--;why.push('美國尚未公開介入，日本不願單獨涉險 −1');}
  if(st[c]>0){n++;why.push('本國基地遭攻方打擊 +1');}
  if(S.mods.escal>0){const e=Math.min(2,S.mods.escal);n-=e;why.push('守方先動手或縱深打擊，盟友不願被拖下水 −'+e);}
  if(S.pools&&S.pools.plaSub>=4&&c==='JP'){n--;why.push('共軍潛艦威脅航道，日本趨於保守 −1');}
  return [Math.max(1,Math.min(6,n)),why.join('；')];
}
function rollSpec(d,c){c=typeof c==='string'?c:undefined;const [mod,note]=d.mod();const it=d.det?true:S.fxScen==='interest'&&d.c;let raw,why='';
  if(d.det){[raw,why]=d.det(c);}else if(it){[raw,why]=interestEval(d.c);}else{raw=3+(hitP(.5,'evRoll:'+d.label)?1:0);why='期望值 3.5（固定規則）';}
  const v=Math.max(1,Math.min(6,raw+mod));const row=rowFor(d.rows,v);if(d.onRow)d.onRow(row);
  return {row,mod,note,raw,v,it:!!it,why,text:raw+(mod?(mod>0?' +':' ')+mod+' = '+v:''),label:d.label};}
function recLine(r){return [r.choice&&(SIDE[r.who]+'選擇「'+r.choice+'」'),...(r.rolls||[]).map(x=>(r.rolls.length>1?x.label+'：':'')+(x.it?'依情勢判定 ':'擲骰 ')+x.text+' →「'+x.row.label+'」'+(x.it&&x.why?'（'+x.why+'）':''))].filter(Boolean).join('；');}
function finishRec(ev,rec,choice,rolls){
  const fx=ev.apply(choice&&choice.id,rolls.map(r=>r.row));
  rec.effects=fx;rec.rolls=rolls;rec.snap=snap();S.events.push(rec);
  log('【'+ev.title+'】'+recLine(rec)+'：'+fx.join('、'));
  return fx;
}

/* ---------- 重新開始、直接推演到結局 ---------- */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.tipapply');if(!b)return;let a={};try{a=JSON.parse(b.dataset.a);}catch(x){}
  for(const [id,v] of Object.entries(a)){const el=$('#'+id);if(el){el.value=v;el.dispatchEvent(new Event('change'));}}
  VOICE.stop();$('#modal').hidden=true;mboxSet('');$('#resume').hidden=true;$('#vcard').hidden=true;reset();setTab('cmd');toast('已套用到下一局設定，請確認後按「開始」',2600);});
function restartGame(){
  if(!confirm(TX('重新開始？目前的進度會消失，回到作戰設定。')))return;
  if(document.body.classList.contains('mapfs'))setFs(false);
  const vb=$('#vbusy');if(vb&&!vb.hidden){V.abort=true;toast(TX('正在停止模擬，馬上回到作戰設定'),1800);return;} // 影片還在錄製：錄製流程結束時再回設定
  vStop(); // 停止影片播放（播放計時器會把畫面切回影片）
  VOICE.stop();$('#modal').hidden=true;mboxSet('');$('#resume').hidden=true;$('#vcard').hidden=true;
  reset();setTab('cmd');
}
function autoRest(){S.simAuto=true;S.speed=.25;} // 之後的事件節點、停戰／港口評估、快訊都自動處理
function autoDecide(ev){
  if(EVENTS.includes(ev)&&S.events.some(e=>e.id===ev.id))return; // 已處理過的事件節點不再重複套用
  const rec={turn:S.turn,phase:S.phase,title:ev.title,id:ev.id};let ch=null;
  if(ev.choice){const opts=ev.choice.options.filter(o=>!o.hide||!o.hide());ch=autoChoice(ev,opts);rec.choice=ch.label;rec.who=ev.choice.who;}
  finishRec(ev,rec,ch,(ev.dice||[]).filter(d=>!d.skip||!d.skip()).map(d=>rollSpec(d,ch&&ch.id)));
}
function simBar(box,onAuto){ // 電腦推演模式：視窗底部的「重新開始」與「直接推演到結局」
  if(!S.sim||S.simAuto)return;
  const d=document.createElement('div');d.className='simbar';
  d.innerHTML='<button class="lnk" data-a="restart">↺ 重新開始</button><button class="lnk" data-a="auto">⏩ 直接推演到結局</button>';
  box.appendChild(d);
  d.querySelector('[data-a="restart"]').onclick=restartGame;
  d.querySelector('[data-a="auto"]').onclick=()=>{autoRest();$('#modal').hidden=true;$('#resume').hidden=true;box.classList.remove('ev');onAuto();};
}
function previewOpt(ev,o){ // 試算：在複製的狀態上套用選項，不動到真正的戰局
  const real=S,rnd=Math.random;PREVIEW=true;
  try{S=structuredClone(real);Math.random=()=>.5;const rs=(ev.dice||[]).filter(d=>(!d.skip||!d.skip())&&d.det).map(d=>rollSpec(d,o&&o.id));const fx=ev.apply(o&&o.id,rs.map(r=>r.row));return {fx,now:snap(),why:rs.map(r=>r.label+'：'+r.why+' → 判定 '+r.v+'「'+r.row.label+'」')};}
  catch(e){return {fx:[o.desc],now:snap()};}
  finally{S=real;Math.random=rnd;PREVIEW=false;}
}
function playEvent(ev,i){
  return new Promise(done=>{
    const box=mboxSet('ev');$('#modal').hidden=false;$('#resume').hidden=true;
    const rec={turn:S.turn,phase:S.phase,title:ev.title,id:ev.id};
    const allSpecs=(ev.dice||[]).filter(d=>!d.skip||!d.skip());const specs=allSpecs.filter(d=>!d.det);let quick=false;
    const finish=(choice,rolls)=>{
      if(!specs.length&&allSpecs.length)rolls=allSpecs.map(d=>rollSpec(d,choice&&choice.id));
      const fx=finishRec(ev,rec,choice,rolls);const now=rec.snap;
      render();
      if(quick||ev.defend&&!S.sim){ // 已在預覽確認過、不再多顯示結果畫面；對戰中的守方決策：不另外顯示結果畫面，改用提示（完整結果已寫入戰報），少點一次
        $('#modal').hidden=true;$('#resume').hidden=true;box.classList.remove('ev');S.lastSnap=now;
        toast('已選擇「'+rec.choice+'」：'+fx.join('、'),3600);done();return;
      }
      const res=document.createElement('div');res.className='res';
      res.innerHTML='<div class="eyebrow">結果</div><ul>'+fx.map(x=>'<li>'+x+'</li>').join('')+'</ul>'+
        '<div class="eyebrow" style="margin-top:12px">有變化的戰況</div>'+snapDiffHTML(now,S.lastSnap||now)+
        '<div class="btns stk"><button id="evGo">繼續推演 ▶</button><button class="ghost" id="evMap">看地圖</button></div>';
      box.appendChild(res);
      S.lastSnap=now;
      $('#evMap').onclick=()=>{$('#modal').hidden=true;$('#resume').hidden=false;};
      $('#evGo').onclick=()=>{$('#modal').hidden=true;$('#resume').hidden=true;box.classList.remove('ev');done();};
      simBar(box,()=>done());
      $('#evGo').focus();
    };
    const diceStep=choice=>{
      box.classList.remove('evfix');
      let h=evHead(ev,i);
      if(choice)h+='<p><span class="badge '+ev.choice.who+'">'+SIDE[ev.choice.who]+'決策</span>已選擇「'+choice.label+'」</p>';
      specs.forEach((d,j)=>{
        h+='<div class="dblk"><p><span class="badge dice">'+(S.fxScen==='interest'&&d.c?'依情勢判定':'不可控 · 擲骰')+'</span>'+d.label+' <span class="dd" id="dm'+j+'"></span></p>'+
          '<table class="dtable" id="dt'+j+'">'+d.rows.map((r,k)=>'<tr data-k="'+k+'"><td>'+(r.min===r.max?r.min:r.min+'–'+r.max)+'</td><td><b>'+r.label+'</b> <span class="dd">'+r.desc+'</span><br>'+(S.fxScen==='interest'&&d.c?'':'<span class="dd">機率 '+Math.round((r.max-r.min+1)/6*100)+'%（未修正）</span>')+'</td></tr>').join('')+'</table>'+
          '<div class="dierow"><div class="die" id="die'+j+'">?</div><span class="dd" id="dr'+j+'"></span></div></div>';
      });
      h+='<div class="btns" style="margin-top:12px"><button id="evRoll">'+(S.fxScen==='interest'?'判定':'擲骰')+(specs.length>1?'（依序 '+specs.length+' 顆）':'')+'</button></div>';
      box.innerHTML=h;simBar(box,()=>{autoDecide(ev);render();done();});
      const showMod=j=>{const [m,n]=specs[j].mod();$('#dm'+j).textContent=m?'（修正 '+(m>0?'+':'')+m+'：'+n+'）':'';};
      specs.forEach((d,j)=>showMod(j));
      $('#evRoll').onclick=async()=>{
        $('#evRoll').disabled=true;const rolls=[];
        const still=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        for(let j=0;j<specs.length;j++){
          showMod(j);const die=$('#die'+j);
          if(!still)for(let k=0;k<10;k++){die.textContent=d6();await new Promise(r=>setTimeout(r,55));}
          const r=rollSpec(specs[j]);rolls.push(r);die.textContent=r.v;
          $('#dt'+j).querySelector('tr[data-k="'+specs[j].rows.indexOf(r.row)+'"]').classList.add('hit');
          $('#dr'+j).textContent=r.it?'判定 '+r.raw+(r.mod?'，修正後 '+r.v:'')+(r.why?'：'+r.why:''):(r.mod?'擲出 '+r.raw+'，修正後 '+r.v:'擲出 '+r.v);
          render();
        }
        finish(choice,rolls);
      };
      $('#evRoll').focus();
    };
    if(ev.choice){
      box.classList.add('evfix'); // 決策視窗高度固定：點選與否，「繼續推演」都在同一個位置
      box.innerHTML=evHead(ev,i)+'<p><span class="badge '+ev.choice.who+'">'+SIDE[ev.choice.who]+'決策</span>由你替'+SIDE[ev.choice.who]+'指揮官決定：</p>'+
        '<div class="opts">'+ev.choice.options.filter(o=>!o.hide||!o.hide()).map((o,j)=>'<button class="opt" data-j="'+j+'"><b>'+o.label+'</b><span>'+o.desc+'</span>'+(o.ref?'<small class="ref">參考：'+o.ref+'</small>':'')+'</button>').join('')+'</div>';
      const opts=ev.choice.options.filter(o=>!o.hide||!o.hide());let sel=null;
      const pv=document.createElement('div');pv.className='res pv';pv.innerHTML='<div class="dd">點選項即可預覽影響，可隨時改選；按「繼續推演」才會正式生效。</div>';
      const bt=document.createElement('div');bt.className='btns stk';bt.innerHTML='<button id="evOk" disabled>繼續推演 ▶</button>';
      box.appendChild(pv);box.appendChild(bt);
      box.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
        sel=opts[+b.dataset.j];box.querySelectorAll('.opt').forEach(x=>x.classList.toggle('on',x===b));
        const r=specs.length?null:previewOpt(ev,sel);
        pv.innerHTML=r?'<div class="eyebrow">預估影響 · '+sel.label+'</div>'+(r.why||[]).map(x=>'<p class="dd">'+x+'</p>').join('')+'<ul>'+r.fx.map(x=>'<li>'+x+'</li>').join('')+'</ul>'+
          '<div class="eyebrow" style="margin-top:10px">有變化的戰況</div>'+snapDiffHTML(r.now,snap()):
          '<div class="eyebrow">預估影響 · '+sel.label+'</div><div class="dd">'+sel.desc+(sel.ref?'<br><small class="ref">參考：'+sel.ref+'</small>':'')+'<br>此決策之後還要擲骰，結果在確認後才會揭曉。</div>';
        $('#evOk').disabled=false;pv.style.scrollMarginBottom='88px';try{pv.scrollIntoView({block:'end',behavior:'smooth'});}catch(e){}
      });
      $('#evOk').onclick=()=>{const o=sel;if(!o)return;rec.choice=o.label;rec.who=ev.choice.who;
        box.querySelectorAll('.opt,#evOk').forEach(x=>x.disabled=true);
        if(specs.length)diceStep(o);else{quick=true;finish(o,[]);}};
      simBar(box,()=>{autoDecide(ev);render();done();});
      box.querySelector('.opt').focus();
    } else diceStep(null);
  });
}
async function runEvents(side){
  for(let i=0;i<EVENTS.length;i++){
    const ev=EVENTS[i],[t,p]=ev.at(S.T);
    if(t!==S.turn||p!==side||S.events.some(e=>e.id===ev.id))continue;
    if(ev.dice&&!ev.choice&&ev.dice.every(d=>d.skip&&d.skip()))continue;
    if(ev.id==='timing'){S.events.push({turn:S.turn,phase:S.phase,title:ev.title,id:ev.id,choice:'依開戰月份：'+MONTHN[S.month||4],who:'atk',rolls:[],effects:[],snap:snap()});continue;} // 發起時機由設定的月份決定
    if(ev.setup){ // 戰前準備已改到初始設定：依設定套用；選「電腦決定」時，對戰模式隨機挑一項（不含🔥），推演模式照原流程（有 autoPick 的事件依戰況固定挑選）
      const v=$('#'+ev.setup).value,opts=ev.choice.options,ch=opts.find(o=>o.id===v)||(ev.autoPick?opts.find(o=>o.id===ev.autoPick()):null)||((!S.sim&&!S.video)?pick(opts.filter(o=>!o.x)):null);
      if(ch){const rec={turn:S.turn,phase:S.phase,title:ev.title,id:ev.id,choice:ch.label,who:'def'};finishRec(ev,rec,ch,[]);continue;}
    }
    if(S.sim&&S.simAuto)autoDecide(ev);
    else if(S.sim){toast('事件節點：'+ev.title);await playEvent(ev,i);}
    else if(S.video){if(ev.id!=='buildup')autoEvent(ev,i);}
    else if(ev.defend){ // 守方決策：人類守方彈窗選擇；電腦守方隨機抽一個選項
      if(S.ctrl&&S.ctrl.def==='human'){S.busy=true;toast('決策：'+ev.title);await playEvent(ev,i);S.busy=false;}
      else{const rec={turn:S.turn,phase:S.phase,title:ev.title,id:ev.id},opts=ev.choice.options,ch=pick(opts.filter(o=>!o.x&&(!o.hide||!o.hide())));rec.choice=ch.label;rec.who='def';finishRec(ev,rec,ch,[]);}
    }
    else if(ev.auto){
      const rec={turn:S.turn,phase:S.phase,title:ev.title,id:ev.id};
      finishRec(ev,rec,null,ev.dice.filter(d=>!d.skip||!d.skip()).map(d=>rollSpec(d)));toast(ev.title+'：'+snap().fx);
    }
    if(S.over)return;
  }
}
function renderNodes(){
  $('#simCard').hidden=!(S.sim||S.video);if(!(S.sim||S.video))return;
  $('#nodes').innerHTML=EVENTS.filter(ev=>!(S.video&&ev.id==='buildup')).map(ev=>{
    const [t,p]=ev.at(S.T),r=S.events.find(e=>e.id===ev.id);
    const kind=ev.choice&&ev.dice?'決策＋擲骰':ev.choice?SIDE[ev.choice.who]+'決策':'擲骰';
    return '<li class="'+(r?'done':'')+'"><span class="tn">T'+t+(p==='atk'?'攻':'守')+'</span><div><b>'+ev.title+'</b> <span class="dd" style="display:inline">'+kind+'</span>'+
      '<span class="dd">'+(r?recLine(r):S.fxLock&&(ev.id==='foreign'||ev.id==='escalate')?'依開局情境略過（'+FXSCEN[S.fxScen]+'）':'尚未發生')+'</span></div></li>';
  }).join('');
}
function timelineHTML(){
  if(!S.events.length)return '';
  return acc('推演時間軸',S.events.length+' 個事件節點','<ul class="tl">'+S.events.map(e=>
    '<li><b>T'+e.turn+' '+e.title+'</b><div class="dd">'+recLine(e)+'</div>'+
    '<div>'+e.effects.join('、')+'</div><div class="dd">當時：島上戰力 攻方 '+cpNum(e.snap.as)+'・守方 '+cpNum(e.snap.ds)+' '+cpU()+'、港口 '+e.snap.ports+'/'+PORTS.length+'、台北'+(e.snap.taipei?'攻方':'守方')+'控制、'+e.snap.fx+'，攻方達成 '+e.snap.n+'/3</div></li>').join('')+
    '<li><b>T'+S.turn+' 最終判定</b><div class="dd">島上戰力 攻方 '+cpNum(snap().as)+'・守方 '+cpNum(snap().ds)+' '+cpU()+'；'+snap().fx+'</div></li></ul>',false);
}
