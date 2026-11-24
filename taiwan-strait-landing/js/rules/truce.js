'use strict';
/* 預排增援、港口破壞評估、停戰／放棄評估（自 turn.js 拆出） */
const ATK_REINF={2:[['amph','north'],['amph','central'],['arm'],['mar','north']],3:[['mar','central'],['amph','north'],['amph','central'],['arm']],4:[['amph','north'],
    ['amph','central'],['arm'],['amph','north']],5:[['amph','north'],['amph','central'],['arm'],['amph','central']],6:[['amph','north'],['amph','central'],['mar','central'],
    ['arm']],7:[['amph','north'],['amph','central'],['arm'],['amph','north']],8:[['amph','north'],['amph','central'],['amph','central']]};
const DEF_REINF={2:[SPOT.taipei,SPOT.taichung],3:[SPOT.taoyuan,SPOT.tainan],4:[SPOT.hsinchu,SPOT.kaohsiung]};
// 預排增援到第 8 回合為止；之後不會憑空生出新的旅（要更多兵力只能在戰前準備階段選擇擴大動員）
function placeNear(k,filter){
  const base=TER[k];
  const c=Object.values(TER).filter(h=>filter(h)&&!unitAt(h.k)).sort((a,b)=>hd(a,base)-hd(b,base));
  return c[0]||null;
}
/* ---------- 港口破壞評估（守方） ---------- */
function portNearlyLost(k){
  if(S.owner[k]!=='def'||S.portDown[k]||S.portAsked[k])return false;
  const h=TER[k],gar=unitsAt(k).filter(u=>u.side==='def'&&!isShip(u)).reduce((a,u)=>a+u.hp,0);
  if(gar>1)return false;
  return ring2(h).some(n=>unitsAt(n.k).some(u=>u.side==='atk'&&!isShip(u)&&isLand(n)));
}
// 加派兵力：本階段還能走進港口格的守方地面旅（取戰力最強的）
function portReinf(k){
  const c=S.units.filter(u=>u.side==='def'&&alive(u)&&!u.ally&&!u.garrison&&isGndAtk(u)&&!atSea(u)&&hexOf(u).k!==k&&(()=>{const v=reach(u).get(k);return v&&v.kind==='move';})());
  return c.length?pickBest(c,u=>effDef(u)*u.hp-hd(hexOf(u),TER[k])*.01):null;
}
function portOptions(k){
  const nm=TER[k].name||'港口',gar=unitsAt(k).filter(u=>u.side==='def'&&!isShip(u)).reduce((a,u)=>a+u.hp,0),R=portReinf(k);
  const opts=[];
  if(R)opts.push({id:'reinf',label:'加派兵力防守',desc:'調 '+uname(R)+'（'+hname(hexOf(R))+'，約 '+Math.round(hd(hexOf(R),TER[k])*KM_HEX)+' km）立刻進駐港口，算這個單位本階段的移動；港口設施保留，守住就不必破壞。',est:'守軍增為 '+stpN(gar+R.hp)+'；若仍失守，攻方取得完整港口',rec:true});
  opts.push({id:'demolish',label:'破壞港口設施',desc:'炸毀碼頭、吊車與航道：攻方即使占領也無法使用，重型旅無法從該港上岸、補給容量只剩 +1，也不計入攻方「控制港口」；攻方占領並整修 2 個回合後才恢復。',est:'拖慢攻方、可能保住「主要港口」這項條件',rec:!R});
  opts.push({id:'wait',label:'暫緩決定',desc:'先不破壞，也不加派；下個守方階段若仍危急會再評估。但港口如果在攻方階段就失守，就來不及破壞。',est:'保留選擇，但有來不及的風險',rec:false});
  opts.push({id:'keep',label:'保留港口（不再評估）',desc:'設施完整保留；失守後攻方立即取得完整的港口功能。',est:'攻方奪港後馬上能卸載重型旅、補給容量 +4',rec:false});
  opts.push({id:'x_raze',label:'徹底破壞港口與周邊設施',desc:'除了碼頭、吊車與航道，連同港區倉儲、油槽與聯外道路橋梁一併破壞（事先疏散，不額外造成平民傷亡）：攻方至少 4 個回合無法使用；戰後重建的經濟損失較大。',est:'攻方約 4 回合無法用港，但經濟損失增加',rec:false});
  return {title:'港口破壞評估（守方）',blurb:nm+(gar>0?'守軍只剩'+stpN(gar):'已經沒有守軍')+'，攻方地面部隊已逼近，港口即將失守。要怎麼處理？（★為系統建議）',opts};
}
function applyPort(k,o){
  const h=TER[k],rec={turn:S.turn,phase:S.phase,title:'港口破壞評估（'+(h.name||'港口')+'）',id:'port_'+k,choice:o.label,who:'def',rolls:[],effects:[]};
  if(o.id!=='wait'&&o.id!=='reinf')S.portAsked[k]=true;log('【'+rec.title+'】守方選擇「'+o.label+'」');
  if(o.id==='reinf'){const R=portReinf(k);if(R){const from=hname(hexOf(R));doMove(R,k,'move');const t=uname(R)+' 從 '+from+' 進駐 '+(h.name||'港口')+'加強防守';log(t);rec.effects.push(t);}}
  if(o.id==='demolish'){S.portDown[k]=S.turn;rec.effects.push((h.name||'港口')+'設施遭破壞：無法卸載重型旅、補給容量 +1、不計入控制港口，攻方整修需 2 個回合');fxq({t:'txt',at:[h.c,h.r],s:'破壞',col:'def'});}
  if(o.id==='x_raze'){S.portDown[k]=S.turn+2;S.cost.dmg.TW+=2;rec.effects.push('港口與周邊設施徹底破壞：攻方至少 4 個回合無法使用，經濟損失增加');fxq({t:'txt',at:[h.c,h.r],s:'徹底破壞',col:'def'});}
  rec.snap=snap();S.events.push(rec);
}
// 電腦：能加派就加派，否則破壞（固定規則）
const portAuto=info=>info.opts.find(o=>o.id==='reinf')||info.opts.find(o=>o.id==='demolish');
async function portEval(){
  if(S.over)return;
  for(const k of PORTS){
    if(!portNearlyLost(k))continue;
    const info=portOptions(k),manual=(S.sim&&!S.simAuto)||(!S.video&&S.ctrl.def==='human');let o;
    if(manual)o=await askTruce(info,()=>portAuto(info));
    else{o=portAuto(info);if(!(S.rec&&REC.quiet))toast((TER[k].name||'港口')+'：'+o.label);}
    applyPort(k,o);
  }
}
function repairPorts(){
  for(const k of Object.keys(S.portDown))if(S.owner[k]==='atk'&&S.turn>=S.portDown[k]+2){delete S.portDown[k];log('攻方整修完成：'+(TER[k].name||'港口')+'恢復運作');}
}
/* ---------- 停戰／放棄評估 ---------- */
const clamp01=v=>Math.max(0,Math.min(100,Math.round(v)));
function atkOutlook(){ // 攻方勝算的粗略估計（0～100）
  const a=snap();
  let s=35+16*a.ports+(a.taipei?18:0)+(a.as-a.ds)*1.5;
  if(a.as===0)s-=10;
  s+=(S.pools.plaNavy>=5?3:-3)+(S.pools.plaCV>0?2:0);
  if(S.fx.lv.US>=3)s-=8;
  return clamp01(s);
}
function defOutlook(){ // 守方撐住的粗略估計（0～100）
  const a=snap();
  let s=70-16*a.ports-(a.taipei?22:0)+(a.ds-a.as)*1.5;
  const us=usIdx();s+=us>=2?12:us===1?4:-8;
  s-=Math.min(25,S.cost.civ.TW/1200);
  return clamp01(s);
}
function needTruce(side){
  const a=snap(),civ=S.cost.civ.TW;
  if(S.turn>=S.T)return false;
  if(side==='atk')return S.turn>=Math.max(6,Math.ceil(S.T*.7))&&a.ports===0&&!a.taipei&&a.as<=Math.max(2,a.ds/4); // 攻勢要拖到後段才會評估停戰
  const lost=usIdx()<=0||S.us.drop>0,low=civ>=15000;
  return S.turn>=3&&(lost||low)&&(((a.taipei||a.ports>=2)&&(a.ds<=10||civ>=15000))||a.ds<=4);
}
function truceVerdict(kind){
  const n=conditions(true).filter(c=>c.atk).length;
  if(kind==='surrender')return {s:'atk',t:'守方投降',d:'守方放棄抵抗並交出台北，攻方取得首都；戰事結束，平民傷亡與破壞不再擴大。'};
  if(kind==='declare'){ // 攻方單方面宣布達成目標、停止攻勢（不向守方請求停火，守方沒有接受或拒絕的步驟）
    if(n>=2)return {s:'atk',t:'宣布達成目標：攻方保有戰果',d:'攻方宣布目標已達成並停止攻勢；實際達成 '+n+' 項條件，實質控制了關鍵位置，守方無力反擊，被迫接受現況。'};
    if(n===1)return {s:'draw',t:'宣布達成目標：僵局',d:'攻方宣布目標已達成並停止攻勢，但只達成 1 項條件，既沒有站穩也沒有撤出；實質上陷入僵局，後續取決於談判。'};
    return {s:'def',t:'宣布達成目標：實質撤出',d:'攻方宣布「階段性目標已達成」並停止攻勢，但沒有達成任何條件，等同登陸失敗；守方守住主權與主要城市。'};}
  if(kind==='retreat')return {s:'def',t:'攻方撤退',d:'攻方在攻勢受挫後有限撤退、保存實力；登陸未能達成目標，守方守住台灣。'};
  const lab={truce:'停戰',talks:'談判停火',mediated:'國際斡旋停火'}[kind]||'停火';
  if(n>=2)return {s:'atk',t:lab+'：攻方保有戰果',d:'雙方依現況停火；攻方達成 '+n+' 項條件，實質控制了關鍵位置，守方被迫在不利條件下接受。'};
  if(n===1)return {s:'draw',t:lab+'：僵局',d:'雙方停火，攻方只達成 1 項條件，既沒有站穩也沒有撤出；實質上陷入僵局，後續取決於談判。'};
  return {s:'def',t:lab+'：守方守住',d:'雙方停火時攻方沒有達成任何條件，守方守住主權與主要城市。'};
}
function truceOptions(side){
  const ol=atkOutlook(),dl=defOutlook();
  if(side==='atk'){
    const tv=truceVerdict('declare');
    const rec=ol<12?'declare':'escalate';
    return {title:'停戰評估（攻方）',blurb:'攻勢遲遲沒有進展：沒有港口與台北、島上兵力遠遜守方。指揮部評估目前勝算約 '+ol+'%，請選擇下一步（★為系統建議的最優解）。',
      opts:[
      {id:'declare',label:'宣布達成目標、停止攻勢',desc:'不向守方請求停火：單方面宣布「階段性目標已達成」並停止攻勢，部隊轉入防禦或撤回；依目前控制的位置判定。',est:'結果：'+tv.t+'；成本與傷亡不再擴大',rec:rec==='declare'},
      {id:'retreat',label:'有限撤退、保存實力',desc:'撤回島上與海上兵力，不再擴大損失與國際壓力。',est:'結果：守方勝利；攻方損失止血',rec:false},
      {id:'escalate',label:'提高賭注（升級）',desc:'擴大戰事：本回合火力 +3（消耗火箭軍存量 −2），美日參戰程度各 +1（若情境允許）。',est:'短期勝算約 '+clamp01(ol+12)+'%；但美日更快介入，全球股市再受衝擊',rec:false},
      {id:"x_total",x:1,label:"🔥 全面升級、戰時體制",desc:"本回合火力 +3（消耗火箭軍存量 −3），美日參戰程度各 +1；攻方本回合與下回合防禦 −1，平民傷亡 +30%、股市 −4。",ref:"2019〈告台灣同胞書〉",est:'短期戰力大增，但雙方平民與經濟代價急升',rec:false}]};
  }
  const tv=truceVerdict('talks');
  const rec=conditions().filter(c=>c.atk).length>=3?(dl<12?'surrender':'resist'):(dl<12&&!S.mods.noTalks?'talks':'resist');
  const n3=conditions().filter(c=>c.atk).length; // 攻方已達成幾項勝利條件
  const defOpts=o=>{let r=S.mods.noTalks?o.filter(x=>!x.talk):o;
    if(n3>=3)r=r.filter(x=>['surrender','resist'].includes(x.id)); // 三項全部達成：守方只剩投降或繼續抵抗
    else if(n3>=2)r=r.filter(x=>x.id!=='seek'); // 國際斡旋留給「還差一點、拖太久」的局面
    return r;};
  return {title:'放棄評估（守方）',blurb:'守軍傷亡慘重，外援與民意都在流失。政府評估目前撐住的機會約 '+dl+'%，請選擇下一步（★為系統建議的最優解）。',
    opts:defOpts([
    {id:'talks',talk:true,label:'停火談判（接受部分條件）',desc:'以現況停火，保住政府與大部分領土，但接受部分條件與主權讓步。',est:'結果：'+tv.t+'；平民傷亡不再擴大',rec:rec==='talks'},
    {id:'surrender',label:'投降／交出台北',desc:'放棄抵抗，攻方立即取得首都。',est:'結果：守方投降；戰事結束',rec:rec==='surrender'},
    {id:'resist',label:'繼續抵抗',desc:'拒絕放棄，繼續作戰；軍民損失持續累積。',est:'撐住機率約 '+dl+'%',rec:rec==='resist'},
    {id:'seek',label:'尋求外援／國際斡旋',desc:'擲骰：5～6 國際斡旋成功、強制停火；3～4 美日提高介入；1～2 沒有回應、民心再受打擊。',est:'外部因素不可控',rec:false,talk:true}])};
}
function askTruce(info,autoPick){
  return new Promise(done=>{
    const box=mboxSet('ev');$('#modal').hidden=false;$('#resume').hidden=true;
    box.innerHTML='<div class="eyebrow">第 '+S.turn+' 回合 · '+SIDE[S.phase]+'階段前</div><h3>'+info.title+'</h3><p>'+info.blurb+'</p>'+
      '<div class="opts">'+info.opts.map((o,j)=>'<button class="opt" data-j="'+j+'"><b>'+(o.rec?'★ ':'')+o.label+'</b><span>'+o.desc+(o.ref?'<small class="ref">參考：'+o.ref+'</small>':'')+'<br>預估：'+o.est+'</span></button>').join('')+'</div>';
    box.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{const o=info.opts[+b.dataset.j];$('#modal').hidden=true;box.classList.remove('ev');done(o);});
    if(autoPick)simBar(box,()=>done(autoPick()));
    box.querySelector('.opt').focus();
  });
}
function truceAuto(side,info){
  const ol=atkOutlook(),dl=defOutlook();let w;
  if(side==='atk')w=ol<12?[['declare',22],['retreat',9],['escalate',42]]:[['declare',9],['retreat',4],['escalate',74]];
  else{const bad=S.owner[TAIPEI]==='atk'&&PORTS.filter(k=>S.owner[k]==='atk').length>=2;w=bad?[['talks',50],['surrender',15],['resist',25],['seek',10]]:[['talks',25],['surrender',5],['resist',50],['seek',20]];}
  if(side==='def'&&conditions().filter(c=>c.atk).length>=3)w=[['surrender',60],['resist',40]];
  // 停火只在條件真的不利時才請求：守方電腦要等攻方已達成 2 項以上條件才會求和／求外援；攻方電腦只在攻勢停滯（勝算 <12%）時才請和
  const n3=conditions().filter(c=>c.atk).length,noAsk=side==='def'?n3<2:ol>=12;
  w=w.filter(([id])=>info.opts.some(o=>o.id===id)&&!(noAsk&&['declare','talks','seek'].includes(id)));
  if(!w.length)return info.opts.find(o=>o.id==='resist'||o.id==='escalate')||info.opts[0];
  const id=wDet(w,'truce:'+side);return info.opts.find(o=>o.id===id)||info.opts[0]; // 依權重的固定選擇（不擲骰）
}
function applyTruce(side,o){
  const eff=[];
  const rec={turn:S.turn,phase:S.phase,title:side==='atk'?'停戰評估（攻方）':'放棄評估（守方）',id:'truce_'+side,choice:o.label,who:side,rolls:[],effects:eff};
  log('【'+rec.title+'】'+SIDE[side]+'選擇「'+o.label+'」');
  const m=S.mods,t=S.turn;let end=null;
  if(o.id==='declare'||o.id==='talks')end=truceVerdict(o.id);
  else if(o.id==='retreat'||o.id==='surrender')end=truceVerdict(o.id);
  else if(o.id==='escalate'){
    addTurns(m.fireAdd,t,t,3);pAdd('rf',-2);setLevel('JP',Math.min(2,S.fx.lv.JP+1),'攻方升級');setLevel('US',Math.min(3,S.fx.lv.US+1),'攻方升級');
    S.cost.mkt=Math.max(-35,S.cost.mkt-2);eff.push('本回合火力 +3（消耗火箭軍存量 −2）','美日參戰程度升高（若情境允許）');
  }
  else if(o.id==='x_total'){
    const F=["本回合火力 +3（消耗火箭軍存量 −3）", "美日參戰程度升高（若情境允許）", "攻方本回合與下回合防禦 −1", "平民傷亡 +30%、全球股市 −4"];addTurns(m.fireAdd,t,t,3);pAdd('rf',-3);
    setLevel('JP',Math.min(2,S.fx.lv.JP+1),'攻方升級');setLevel('US',Math.min(3,S.fx.lv.US+1),'攻方升級');
    addTurns(m.atkDef,t,t+1,-1);m.civMul*=1.3;hitMkt(4);eff.push(...F);
  }
  else if(o.id==='resist'){eff.push('守方繼續作戰');}
  else if(o.id==='seek'){
    const med=hitP(1/3,'seekMed'),part=!med&&hitP(1/2,'seekPart'); // 原本擲骰 5–6／3–4／1–2 各 1/3
    eff.push('國際斡旋機率 33%、提高介入 33%（固定規則）');
    if(med){end=truceVerdict('mediated');}
    else if(part){setLevel('US',Math.min(3,S.fx.lv.US+1),'尋求外援');setLevel('JP',Math.min(2,S.fx.lv.JP+1),'尋求外援');eff.push('美日提高介入程度（若情境允許）');}
    else{eff.push('沒有得到回應，沒有任何實際效果');}
  }
  rec.snap=snap();S.events.push(rec);
  S.stats.truce=(S.stats.truce||[]);S.stats.truce.push(side+':'+o.id);
  if(end&&!S.over)endGame(end.d,end.s,end.t);
}
// 請和是單方面的：對方不一定接受。對方是玩家時跳出選項；是電腦時依局勢擲骰。現在只有守方會請和（守方求和：攻方佔優時多半拒絕）；攻方改為「宣布達成目標」或「撤退」，不再向守方請求停火
async function truceAccept(req){
  const opp=req==='atk'?'def':'atk',n=conditions().filter(c=>c.atk).length;
  let p;if(req==='atk')p=n===0?.85:.6;else p=n>=3?.15:n===2?.45:.7;
  if(req==='def'&&atkOutlook()<12)p+=.2;p=Math.min(.95,p);
  const manual=(S.sim&&!S.simAuto)||(!S.video&&S.ctrl[opp]==='human');
  if(!manual)return hitP(p,'truceAccept');
  const tv=truceVerdict(req==='atk'?'truce':'talks');
  const info={title:'對方請求停火',blurb:SIDE[req]+'提出依目前局勢停火。接受則戰事結束，拒絕則繼續作戰。',opts:[
    {id:'yes',label:'接受停火',desc:'依目前控制的位置判定，戰事結束。',est:'結果：'+tv.t,rec:false},
    {id:'no',label:'拒絕，繼續作戰',desc:'不接受對方的條件，戰事繼續。',est:'對方仍可能再次請求',rec:false}]};
  const o=await askTruce(info,()=>hitP(p,'truceAccept')?info.opts[0]:info.opts[1]);
  return o.id==='yes';
}
async function truceEval(side){
  if(S.over)return;
  const T=S.truce[side];
  if(T.n>=2||S.turn-T.t<2||!needTruce(side))return;
  T.n++;T.t=S.turn;
  const info=truceOptions(side);
  const manual=(S.sim&&!S.simAuto)||(!S.video&&S.ctrl[side]==='human');
  let o;
  if(manual){o=await askTruce(info,()=>truceAuto(side,info));}
  else{o=truceAuto(side,info);if(!(S.rec&&REC.quiet))toast(info.title+'：'+o.label);
    if(S.rec&&!REC.quiet)recordFrame({html:'<div class="eyebrow">第 '+S.turn+' 回合</div><h3>'+info.title+'</h3><p>'+info.blurb+'</p><p><span class="badge '+side+'">'+SIDE[side]+'決策</span>選擇「'+o.label+'」</p><p class="dd">'+o.desc+'<br>預估：'+o.est+'</p>',kind:'event',dur:7000});}
  if(o.id==='talks'){ // 只有守方會「請求」停火談判（由攻方決定接不接受）；攻方要停，只能宣布達成目標或撤退，不會向守方請求
    const ok=await truceAccept(side);
    if(S.over)return;
    if(!ok){log('【停火請求】'+SIDE[side]+'請求停火，'+SIDE[side==='atk'?'def':'atk']+'拒絕，戰事繼續');if(!(S.rec&&REC.quiet))toast(SIDE[side==='atk'?'def':'atk']+'拒絕停火，戰事繼續');S.stats.truceRej=(S.stats.truceRej||0)+1;return;}
  }
  applyTruce(side,o);
}
