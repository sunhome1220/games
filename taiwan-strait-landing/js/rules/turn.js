'use strict';
/* 回合流程：共軍獵殺、無人機、反艦彈道、階段開始與結束（自 turn.js 拆出） */
// 單發命中率＝偵察定位 × 末端穿透。定位：上一回合移動 ≤1 格 0.6、2 格 0.4、≥3 格 0.2；穿透：max(0.1, 0.5 − 0.1 × 護航數)，護航數＝打擊群自身 2 艘＋在場的盟軍艦艇
const ASBM={max:2,loc:[.6,.6,.4,.2],pen0:.5,penStep:.1,penMin:.1,ownEscort:2};
// ---------- 舊戰機改裝無人機：誘餌波 ----------
// 依據：Mitchell Institute 報告（路透社報導）估計台海附近機場已部署約 200 架以上舊戰機改裝無人機；陸委會稱可改裝超過 500 架。
// 2026～2027 年 200 架、★2028～2029 年 300 架、★2030 年起 500 架；每個攻方階段在飛彈打擊前放出 ★40 架；★守方分不出誘餌，每架射 2 枚攔截彈
// （占用本回合接戰上限與攔截彈存量）；突破的無人機不另外造成傷害（第一版只算消耗攔截彈）
const PLA_DRONE={'2026':200,'2027':200,'2028':300,'2029':300,'2030':500,'2031':500,'2032':500},DRONE_WAVE=40;
// ---------- 共軍獵殺台灣艦隊（每個攻方階段）----------
// 艦艇雷達訊號大、比陸上發射車好找：★出港艦隊的定位機率依制空——攻方優勢 90%、均勢 65%、守方優勢 40%；夜間 ×0.85（以雷達為主的海上偵察受夜間影響小）、雲雨或颱風 ×0.8；
// 上一階段開火暴露＝100%；在港內是固定目標＝★90%。找到後以 ★16／12／6 枚空射反艦飛彈攻擊（依制空：可用的打擊機數），以齊射模型對上艦隊自身防空，每命中 1 枚沉 1 艘
const KSEA={ctl:{atk:.9,mid:.65,def:.4},port:.9,night:.85,wx:.8,n:{atk:16,mid:12,def:6}};
// 海峽（台灣本島西岸以西、大陸沿岸以東的海域）：共軍 022 飛彈快艇與 056 輕型護衛艦在這裡活動
const strait=h=>!!h&&h.t==='sea'&&rcToLL(h.c,h.r)[0]<120.9&&rcToLL(h.c,h.r)[1]>22.3&&rcToLL(h.c,h.r)[1]<25.6;
const facSalvo=()=>Math.round(Math.min(10,(S.pools.plaFAC||0))*.8);
function huntFleets(){
  const out=[],ac=S.airCtl||'mid';
  for(const u of S.units.filter(x=>x.fl&&x.side==='def'&&alive(x))){
    const h=hexOf(u),inPort=h.t==='port';let p;
    if(inPort)p=KSEA.port;else if(u.revealed)p=1;else{p=KSEA.ctl[ac];if(S.turn%2===0)p*=KSEA.night;if(S.weather&&(S.weather.id==='bad'||tyThreat(S.weather)))p*=KSEA.wx;}
    if(!hitP(p,'huntLoc:'+(inPort?'port':'sea'))){out.push(u.fl.n+'：沒有找到（定位 '+Math.round(p*100)+'%）');continue;}
    const st=strait(h),fac=st?facSalvo():0; // 海峽內：022 飛彈快艇也加入攻擊（★每點 0.8 枚鷹擊-83，推估）
    if(st&&S.pools.plaFAC>0){const l=takeInt(.25,'facLoss');if(l){S.pools.plaFAC=Math.max(0,S.pools.plaFAC-l);out.push(u.fl.n+'與共軍飛彈快艇交火，擊沉約 '+l*6+' 艘（推估）');}}
    const n=Math.max(2,Math.round(KSEA.n[ac]*ffW(u)))+fac,r=salvoCalc(u,n,false,'hunt>'+u.fl.id); // 小隊分到的攻擊量依比例縮小（總攻擊量與拆分前相同）
    fxq({t:'air',at:[u.c,u.r],hit:r.hits>0,tsea:true,org:orgPick('pla'),k:'cm',ad:r.I>0?(r.hits>0?'pass':'int'):undefined,adSide:'def'});
    out.push(u.fl.n+'（'+(inPort?'港內':u.revealed?'開火後暴露':'海上')+'）：'+n+' 枚，艦隊攔截 '+r.I+' 枚，命中 '+r.hits+(r.hits?'，沉 '+Math.min(r.hits,u.hp)+' 艘':''));
    if(r.hits)damage(u,r.hits,'共軍空射反艦飛彈');
  }
  if(out.length)log('共軍獵殺守方艦隊（制空'+AIRCTL[ac]+'；定位與枚數為推估）：'+out.join('；'));
}
function droneWave(){
  const P=S.pools;if(!(P.plaDrone>0))return;const n=Math.min(P.plaDrone,DRONE_WAVE);P.plaDrone-=n;
  const r=adIntercept(n),kill=Math.round(n-r.surv);S.stats.drones=(S.stats.drones||0)+n;
  airfields().filter(h=>S.owner[h.k]!=='atk').slice(0,3).forEach(h=>fxq({t:'air',at:[h.c,h.r],hit:false,tsea:false,org:orgPick('pla'),k:'drone',ad:r.I>0?'int':undefined}));
  log('舊戰機改裝無人機 '+n+' 架當誘餌飛向台灣：守方防空發射 '+r.I+' 枚攔截彈、擊落約 '+kill+' 架（剩 '+fmt1(P.plaDrone)+' 架；攔截彈還剩 '+adTot()+' 枚；架數與用法為推估）');
}
function antiCarrier(){
  const ps=uscPieces().filter(u=>!cvOOA(u));if(!ps.length||!S.pools||S.pools.plaLR<1)return;const mv=x=>x.prev?hd(TER[K(x.prev[0],x.prev[1])]||hexOf(x),hexOf(x)):kmH(60),u=ps.reduce((a,b)=>mv(b)<mv(a)?b:a); // 挑定位最準的那支
  const moved=u.prev?hd(TER[K(u.prev[0],u.prev[1])]||hexOf(u),hexOf(u)):kmH(60);
  const pLoc=ASBM.loc[Math.min(3,moved)];
  const n=Math.min(ASBM.max,Math.floor(S.pools.plaLR));let h=0,I0=0,loc=0;
  for(let i=0;i<n&&alive(u);i++){
    S.pools.plaLR--;let ok=false; // 反艦彈道飛彈屬東風-21D／26 存量
    if(hitP(pLoc,'asbmLoc')){loc++;const r=salvoCalc(u,1,true,'asbm');I0+=r.I;ok=r.hits>0;} // 先要定位成功，再過護航艦的反彈道攔截（齊射模型）
    fxq({t:'air',at:[u.c,u.r],hit:ok,tsea:true,org:orgPick('pla'),k:'bm'});
    if(ok){h++;damage(u,1,'反艦彈道飛彈（東風-21D／26）');}
  }
  log('反航母打擊：發射 '+n+' 枚反艦彈道飛彈，定位成功 '+loc+' 枚、護航艦發射 '+I0+' 枚攔截彈，命中 '+h+' 枚（定位 '+Math.round(pLoc*100)+'%：上一回合移動 '+moved+' 格；攔截以齊射模型計算；皆為推估）');
}
// 階段開始：清除上一階段的狀態、重設本方單位的行動與射擊次數
function phaseReset(side){
  S.phase=side;S.sel=null;S.mode=null;S.baseSel=null;
  GHOSTS.clear();S.units.forEach(u=>{u.inc=0;u.dropHide=0;if(side==='def')u.revealed=!!(u.mT&&S.turn<u.mT);});
  for(const u of S.units)if(u.side===side){u.moved=false;
    u.acted=false;
    if(u.type==='hk'&&hkAtHome(u)&&u.hp<TYPES.hk.hp){u.rep=(u.rep||0)+1;if(u.rep>=2){u.rep=0;u.hp++;log(subNm(u)+' 在母港左營完成維修，恢復 1 步');}} // ★母港維修：每 2 回合 1 步
    if(u.type==='psub'){if(psubInPort(u)){u.tp=psubCls(u).tp;u.hm=psubCls(u).hm;}u.shots=1;}
    if(u.type==='hk'){if(hexOf(u).t==='port'){u.tp=hkTp(u);
    u.hm=HK_HM;
    }u.shots=hkSpent(u)?0:1;
    }if(isEsc(u))u.shots=1;
    if(u.type==='mlrs'&&u.rl>0)u.rl--;
    if(isMsl(u))u.shots=(u.type==='ssm'&&S.pools&&(S.pools[ssmPool(u)]||0)<=0)?0:u.type==='ssm'?(ssmReady(u)>0?Math.max(1,Math.round(2*ssmReady(u)/lchV0(u))):0):u.type==='mlrs'?(u.rl>0?0:1):u.type==='hmr'?(u.lu=0,Math.ceil(ssmReady(u)/HMR_PKG)):u.type==='ff'?1:2;
    }
  for(const u of S.units)if(u.side===side&&(u.type==='hmr'||u.type==='mlrs')&&u.veh!=null&&ssmReady(u)<=0)u.shots=0; // 車都不能射了
}
// 攻方階段開始：天候、空戰、火力點數、飛彈預警、無人機、獵殺艦隊、艦載機、增援
async function atkPhaseStart(){
  if(S.ctrl.atk!=='human'||S.sim)heloAuto('atk');
    S.weather=rollWeather();if(S.weather.id==='bad')S.stats.badWx++;waveAttrition();if(S.over)return;
    uscSync();jmsSync();cvwPlan();airBattle();S.fire=computeFire();warnNotice();droneWave();huntFleets();doRetaliation();sweepMines();uscSync();antiCarrier();if(S.over)return;
    if(S.ctrl.atk==='human'&&!S.sim&&!S.video)cvwPrepOnly('atk');else cvwStrike('atk');render();if(S.over)return; // 玩家操作攻方：艦載機對艦份額可先手動指定目標，階段結束時剩下的自動出擊
    if(S.turn>=3&&S.owner[MAGONG]!=='atk'&&S.units.some(u=>u.side==='def'&&hexOf(u).k===MAGONG)&&S.units.some(u=>u.side==='atk'&&atSea(u)&&!isShip(u))){antiShip('守方（澎湖前沿警戒）',1,4,false,'','roc','cm');render();}
    (ATK_REINF[S.turn]||[]).forEach(([t,z])=>{ // 第 8 回合後的持續增援：兩棲旅每回合 2 個，掌握港口時再加 1 個重型旅
      const h=t==='arm'?placeNear(FK('4,4'),x=>x.isl==='CN'&&x.t==='port'):placeNear(FK('4,4'),x=>x.isl==='CN'&&x.coastal);
      if(h){if(!z){const ax=(S.plan&&S.plan.axes)||['north','central'];z=ax[S.zoneFlip++%ax.length];}S.units.push(mkUnit('atk',t,h.k,{zone:z}));log('攻方增援 '+TYPES[t].n+' 抵達 '+hname(h));}
    });
    log('第 '+S.turn+' 回合開始，天候'+S.weather.n+'（海上移動 '+S.weather.sea+'，火力 '+S.fire+' 點'+(S.weather.air?'':'，無法空降')+'）');
}
// 守方階段開始：後備旅動員、縱深打擊份額、美國檢討、艦艇出港、海上交戰
async function defPhaseStart(){
  psubDetect();
  if(S.ctrl.def!=='human'||S.sim)heloAuto('def');
    if(supply().over)S.stats.over++;
    let wave=(DEF_REINF[S.turn-S.mods.defReinfDelay]||[]).slice(); // 守方後備旅動員受裝備庫存限制，4 回合後沒有新的後備旅
    if(S.mods.defReinfHalve)wave=wave.filter((k,i)=>i%2===0);
    if(wave.length)for(let i=0;i<S.mods.defReinfExtra;i++)wave.push(wave[0]);
    wave.forEach(k=>{
      const h=(S.owner[k]==='def'&&!unitAt(k))?TER[k]:placeNear(k,x=>x.isl==='TW'&&x.t!=='mtn'&&S.owner[x.k]==='def'&&!inZOC('def',x));
      if(h){const nu=mkUnit('def','res',h.k);nu.mobT=S.turn;S.units.push(nu);S.stats.reserves++;log('守方後備旅於 '+hname(h)+' 完成動員（裝備與人員還在編成，攻防各 −1，到下一個攻方階段結束）');}
    });
    S.dfire=lrPackets();usReview();render(); // 本階段可發射的包數（每包 4 枚）：受發射車與存量限制
    if(S.ctrl.def!=='human')for(const m of S.units.filter(u=>u.side==='def'&&u.type==='ff'))await ffSortie(m); // 守方艦艇先出港，再進行海上交戰結算
    await navalPhase();if(S.over)return;
  
}
async function beginPhase(side){
  if(typeof MISSION!=='undefined'&&MISSION&&MISSION.phase(side))return; // 關卡挑戰：限時到了就結束
  phaseReset(side);
  if(side==='atk')S.turnStart={snap:snap(),lv:Object.assign({},S.fx.lv),owner:Object.assign({},S.owner)};
  if(window.TSL_RUMBLE&&humanTurn())TSL_RUMBLE('turn'); // 輪到自己操作時短震一下
  render();if(side==='atk'&&S.turn>1)captureHL('t'+(S.turn-1));await runEvents(side);if(S.over)return;
  await truceEval(side);if(S.over)return;
  if(side==='def')await portEval();if(S.over)return;
  if(side==='def'){await uscTurn();if(S.over)return;}
  if(side==='atk'){subDetect();updateBeachheads();await convoyEval();if(S.over)return;}
  if(side==='def')await interdictEval();if(S.over)return;
  if(side==='def')intelStaging();
  if(side==='def')repairAirfields(); // 跑道搶修好就能在本守方階段起飛
  if(side==='atk'){repairPorts();repairCN();resolveSupply();convoyTurn();liftTurn();supplyAttrition();abnIsolation();if(S.over)return;}
  if(side==='atk')await atkPhaseStart();else await defPhaseStart();if(S.over)return;
  toast('第 '+S.turn+' 回合 · '+SIDE[side]+'階段');
  render();
  if(S.ctrl[side]==='ai')runAI(side);
}
async function endPhase(){
  if(S.over||!S.started)return;
  if(S.phase==='atk'&&S.ctrl.atk==='human'&&!S.sim&&!S.video&&S.units.some(u=>cvOwn(u)&&(u.cvwT===S.turn&&u.cvwB>0||u.cvwLT===S.turn&&u.cvwLB>0))){cvwStrike('atk');S.mode=null;render();if(S.over)return;} // 沒用完的艦載機對艦份額自動出擊
  if(S.phase==='atk')return beginPhase('def');
  if(S.phase==='atk'&&!S.over&&!(typeof MISSION!=='undefined'&&MISSION&&S.ctrl.atk==='human'))heliAuto('atk'); // 共軍直-10 沒用完的批數
  if(S.phase==='def'){if(!(typeof MISSION!=='undefined'&&MISSION&&S.ctrl.def==='human')){afAuto();heliAuto();}S.mode=null;render();if(S.over)return;} // 關卡挑戰：玩家沒派完的空軍份額不自動出擊（要自己下令）
  if(allyHuman()){S.busy=true;try{await allyEndAuto();}finally{S.busy=false;}if(S.over)return;}
  S.stats.tpHold=S.owner[TAIPEI]==='atk'?(S.stats.tpHold||0)+1:0;
  {const nn=conditions().filter(c=>c.atk).length;S.stats.winHold=nn>=2?(S.stats.winHold||0)+1:0;S.stats.fullHold=nn>=3?(S.stats.fullHold||0)+1:0;}
  econTick();
  if(S.turn>=S.T){
    // 未真正分出勝負（攻方達成不到兩項、但島上或海上還有攻方兵力）就不在此判定，雙方繼續打下去；上限 30 回合
    const nn=conditions().filter(c=>c.atk).length,alive=S.units.some(u=>u.side==='atk'&&!isShip(u)&&(onTW(u)||hexOf(u).isl==='PH'||atSea(u)));
    if(nn<2&&alive&&S.T<30){
      // 超過預計回合：真人操作的局可選擇由電腦接手推演到分出勝負，或自己繼續、或現在就判定
      const human=!S.sim&&!S.video&&!S.rec&&(S.ctrl.atk==='human'||S.ctrl.def==='human');
      if(human){
        const info={title:'已超過預計回合',blurb:'預計的第 '+S.T+' 回合到了，但勝負還沒分出來（攻方達成 '+nn+' / 3 項，雙方仍在交戰）。要怎麼繼續？',
          opts:[{id:'self',label:'自己繼續操作（再 2 回合）',desc:'判定延後 2 回合，由你繼續指揮。',est:'判定延後至第 '+(S.T+2)+' 回合',rec:false},
            {id:'ai',label:'由電腦接手推演到分出勝負',desc:'雙方都交給電腦，一路推演到分出勝負（上限第 30 回合）；之後可看戰報與結算。',est:'電腦推演，最多到第 30 回合',rec:true},
            {id:'now',label:'現在就判定',desc:'不再延長，依目前局勢直接判定結果。',est:'依目前的控制與兵力判定',rec:false}]};
        const o=await askTruce(info,()=>info.opts[1]);
        if(o.id==='now')return endGame();
        if(o.id==='ai'){S.ctrl={atk:'ai',def:'ai'};S.takeover=true;log('超過預計回合：雙方改由電腦接手推演，直到分出勝負');}
      }
      S.T+=2;S.extended=true;S.stats.autoExt=(S.stats.autoExt||0)+1;log('戰局尚未分出勝負：判定延後至第 '+S.T+' 回合（攻方達成 '+nn+' / 3 項，雙方仍在交戰）');toast('戰局未分，判定延後至第 '+S.T+' 回合',3600);}
    else return endGame();
  }
  if((S.stats.fullHold||0)>=2)return endGame('攻方連續兩個回合同時控制首都、主要港口並取得兵力優勢，提前判定攻方勝利。','atk','攻方提前取勝');
  const n=buildNews();S.news.push(n);
  if(S.rec){render();if(S.newsOn)recordFrame({html:newsBody(n),kind:'news',dur:6500});}
  else if(S.newsOn&&!S.simAuto){if(S.newsCompact){render();toast('📰 '+((n.items&&n.items[0])||'本回合快訊'),3200);}else{S.busy=true;render();await showNews(n);S.busy=false;}}
  if(S.over)return;
  S.turn++;beginPhase('atk');
}
