'use strict';
/* ---------- input ---------- */
$('#map').addEventListener('click',async e=>{
  const cnE=e.target.closest('[data-cn]');
  if(cnE){const id=cnE.getAttribute('data-cn');
    if(tomClick(id))return;
    if(humanCN(id))return;
    const fn=CNB[id]&&CNB[id].n;if(fn&&FARINFO[fn]){FARSEL=fn;S.sel=null;S.hover=null;renderInfo();}return;}
  const fcE=e.target.closest('[data-fac]');
  if(fcE){const id=fcE.getAttribute('data-fac');
    if(humanTurn()&&S.phase==='atk'&&S.mode==='strike'&&S.fire>0&&facUp(id)){strikeFac(id);if(S.fire<=0)S.mode=null;render();return;}
    toast(FAC[id].n+'：'+(facUp(id)?'運作中。':'已被摧毀。')+FAC[id].d,5200);return;}
  const bE=e.target.closest('[data-b]');
  if(bE){const b=bE.getAttribute('data-b');
    if(humanTurn()&&S.phase==='atk'&&S.mode==='strike'&&S.fire>0&&baseTargets(b).length){const w=escalationText(b);if(w&&!(await confirmBox(w)))return;strikeBase(b);if(S.fire<=0)S.mode=null;render();return;}
    return;}
  const fe=e.target.closest('[data-far]');
  if(fe){FARSEL=fe.getAttribute('data-far');S.sel=null;S.hover=null;renderInfo();return;}
  const el=e.target.closest('[data-k]');if(!el)return;const k=el.getAttribute('data-k');FARSEL=null;
  S.hover=k;const idEl=e.target.closest('[data-id]'),hitU=idEl?S.units.find(x=>x.id===+idEl.dataset.id):null;S.hoverId=hitU?hitU.id:null;
  if(!humanTurn()){S.sel=hitU||unitAtVis(k)||null;render();return;}
  let u=hitU||unitAtVis(k);
  if(u&&u.boundTo&&u.side===S.phase&&!(S.sel&&S.sel.side!==u.side)){const b=S.units.find(y=>y.id===u.boundTo);if(b&&alive(b))u=b;} // 點自己的運輸船＝選取船上的旅（旅不畫在海上）
  if(S.mode==='tom')S.mode=null;
  if((S.mode==='afS'||S.mode==='afL'||S.mode==='afC')&&afClick(u))return; // 守方空軍：點目標
  if(S.mode==='volley'||S.mode==='cvw'||S.mode==='cvwL'){ // 航艦命令：點選射程內的目標
    const cv=S.sel&&cvOwn(S.sel)?S.sel:null;
    if(cv&&S.mode==='cvwL'){cvwManualLand(cv,{u:u&&u.side!==cv.side?u:null,af:k,port:k});}
    else if(cv&&u&&u.side!==cv.side){
      if(S.mode==='volley'&&volleyTargets(cv).includes(u)){const sh=volleyShooters(cv,u);if(sh.length)fireVolley(sh,u);}
      else if(S.mode==='cvw')cvwManual(cv,u);
    }
    S.mode=null;render();return;
  }
  if(S.mode==='strike'){
    if(S.phase==='atk'&&u&&u.side==='def'&&strikeable(u)&&S.fire>0){strike(u);if(S.fire<=0)S.mode=null;}
    else if(S.phase==='def'&&u&&u.side==='atk'&&hexOf(u).isl==='CN'&&S.dfire>0&&lrOK()){if(stgFound(u)>0){S.dfire--;strikeStage(u,'roc');if(S.dfire<=0||!lrOK())S.mode=null;}else toast('這個集結中的單位本階段沒有被找到（或找到的部分都打過了），打不到',3200);}
    else if(S.phase==='def'&&u&&u.side==='atk'&&hexOf(u).isl==='CN')toast('本階段已沒有可發射的長程飛彈（發射車或存量用完）',3200);
    else if(S.phase==='atk'&&u&&u.side==='def'&&isLch(u)&&canHitSub(u))toast('這個發射車陣地本階段偵察沒有找到真正的車（或找到的都打過了），打不到',3200);
    else if(S.phase==='atk'&&!u&&S.fire>0&&TER[k]&&TER[k].t==='air'&&TER[k].isl==='TW'&&strikeAirfield(k)){if(S.fire<=0)S.mode=null;}
    render();return;
  }
  const sel=S.sel&&alive(S.sel)&&S.sel.side===S.phase?S.sel:null;
  if(sel&&u&&u!==sel&&u.side===sel.side){const rc=reach(sel);if(rc.has(k)){humanMove(sel,k,rc.get(k).kind);if(!alive(sel)||(sel.acted&&!targets(sel).length))S.sel=null;render();return;}}
  if(u){
    if(sel&&u.side!==sel.side&&targets(sel).includes(u)){
      if(sel.type==='hk')fireSub(sel,u);else if(isMsl(sel)||isEsc(sel)||sel.ally)fireMissile(sel,u);else attack(sel,u);
      if(sel.acted||!alive(sel))S.sel=null;
    } else S.sel=(S.sel===u||(u.ally&&!allyHuman()))?null:u; // 預設美日由電腦操作，點了只看資訊；選「你操作」時可選取
    render();return;
  }
  if(sel){const rc=reach(sel);if(rc.has(k)){humanMove(sel,k,rc.get(k).kind);if(!alive(sel)||(sel.acted&&!targets(sel).length))S.sel=null;render();return;}}
  S.sel=null;render();
});
let LAST_TOUCH=0;document.addEventListener('touchstart',()=>{LAST_TOUCH=Date.now();},{passive:true,capture:true}); // 手機點一下會先產生模擬的滑鼠移入事件：跳過，避免資訊卡先蓋到手指下，讓這次點擊落在卡片上而不是地圖
$('#map').addEventListener('mouseover',e=>{if(Date.now()-LAST_TOUCH<1000)return;const el=e.target.closest('[data-k]');if(!el||S.sel)return;const k=el.getAttribute('data-k'),ue=e.target.closest('[data-id]'),hid=ue?+ue.dataset.id:null;if(k!==S.hover||hid!==S.hoverId){S.hover=k;S.hoverId=hid;if(FARSEL)FARSEL=null;renderInfo();}});
