'use strict';
/* ---------- 攻擊模式的快捷按鈕（2026-11-18）----------
   操作列的三個按鈕（火力／縱深打擊、電腦代打、結束階段）在「選了空軍基地、選出擊方式、選目標」這段時間，
   會讓人誤按「結束階段」或「電腦代打」。這個檔案依目前的攻擊情境改寫三個按鈕（桌面、全螢幕、手機三組同步）：
   基地卡開著：三個按鈕＝三種出擊方式（船團／島上／大陸）；出擊中：取消出擊／換方式／確認出擊；直升機出擊與一般打擊：只留取消（打擊中守方多一個確認發射）。
   不影響規則，只是換按鈕的字、顯示與動作；按鈕的 onclick 先問 barCtx()，沒有情境才走原本的行為。 */
const BAR_IDS={strike:['btnStrike','fsStrike','mbStrike'],assist:['btnAssist','fsAssist','mbAssist'],end:['btnEnd','fsEnd','mbEnd']};
const AF_ORDER=['afS','afL','afC'];
const afModeN=k=>({afS:afShipT(k).length,afL:afLandT(k).length,afC:afCNT(k).length+afStgT(k).length});
function afPick(k,m){S.afK=k;S.sel=null;S.afPend=null;S.mode=m;if(typeof UC!=='undefined')UC.closedKey=UC.key;render();}
function barCtx(){
  if(!S||!S.started||S.over||S.sim||S.video||!humanTurn())return null;
  const afM=AF_ORDER.includes(S.mode);
  if(afM&&S.afK&&S.phase==='def'){ // 出擊中：取消（原本的按鈕）／換方式／確認出擊
    const k=S.afK,N=afModeN(k),others=AF_ORDER.filter(m=>m!==S.mode&&N[m]>0),pend=S.afPend&&typeof afPendInfo==='function'?afPendInfo():null;
    return {label:(TER[k].name||'基地')+'・'+AF_MODE_N[S.mode],
      assist:{text:others.length?'換方式（'+AF_MODE_N[others[0]]+'）':'換方式',disabled:!others.length,run:()=>others.length&&afPick(k,others[0])},
      end:{text:'確認出擊',disabled:!(pend&&pend.ok),on:!!(pend&&pend.ok),run:()=>{const b=document.getElementById('afPendGo');if(b&&!b.disabled)b.click();}}};}
  if(S.mode==='hlS'||S.mode==='hlL')return {label:'攻擊直升機出擊中',assist:{hide:true},end:{hide:true}};
  if(S.mode==='strike'){const def=S.phase==='def';
    return {label:def?'縱深打擊中':'火力打擊中',assist:{hide:true},end:def&&S.cnPend?{text:'確認發射',disabled:!(S.dfire>0&&(typeof lrOK!=='function'||lrOK())),on:true,run:()=>{const b=document.getElementById('cnPendGo');if(b&&!b.disabled)b.click();}}:{hide:true}};}
  const bk=S.baseSel;if(!S.mode&&bk&&S.phase==='def'&&S.ctrl.def==='human'&&TER[bk]&&TER[bk].t==='air'&&TER[bk].isl==='TW'&&afUsable().some(x=>x.k===bk)&&afBudget(bk)>0&&afBaseN(bk)>0){ // 基地卡開著：三個按鈕＝三種出擊方式
    const N=afModeN(bk),mk=m=>({text:AF_MODE_N[m],disabled:!(N[m]>0),run:()=>N[m]>0&&afPick(bk,m)});
    return {label:(TER[bk].name||'基地')+'・選擇出擊方式',strike:mk('afS'),assist:mk('afL'),end:mk('afC')};}
  return null;
}
function barApply(){ // 在 renderCtrl 最後呼叫：把情境套到三組按鈕；離開情境時把改過的字還原（這幾顆按鈕的字平常不會在別處重設）
  const X=barCtx(),mt=document.getElementById('mbText');
  if(X&&mt&&X.label)mt.textContent=X.label;
  for(const slot of ['strike','assist','end']){const c=X&&X[slot];
    for(const id of BAR_IDS[slot]){const e=document.getElementById(id);if(!e)continue;
      if(!c||(!c.hide&&c.text==null)){if(slot!=='strike'&&e.dataset.t0!=null){ // 打擊鈕的字與停用狀態 renderCtrl 每次都會重設，只有電腦代打、結束階段要還原
        e.textContent=e.dataset.t0;delete e.dataset.t0;e.disabled=e.dataset.d0==='1';delete e.dataset.d0;}if(!c)continue;}
      if(c.hide){e.hidden=true;continue;}
      if(slot!=='strike'&&e.dataset.t0==null&&c.text!=null){e.dataset.t0=e.textContent;e.dataset.d0=e.disabled?'1':'0';}
      e.hidden=false;if(c.text!=null)e.textContent=c.text;e.disabled=!!c.disabled;e.classList.toggle('on',!!c.on);}}
}
