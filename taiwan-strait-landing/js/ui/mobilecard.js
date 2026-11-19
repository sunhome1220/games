'use strict';
/* 手機浮動資訊卡（自 fx.js 拆出） */
/* ---------- 手機：點選資訊改成地圖上的小浮動卡片（可拖曳、可關閉，位置記在這台裝置） ---------- */
let UCmin=false;try{UCmin=localStorage.getItem('tsl-ucard-min')==='1';}catch(e){}
const UC={closedKey:null,key:null,min:UCmin};
function ucSetMin(v){UC.min=v;try{localStorage.setItem('tsl-ucard-min',v?'1':'0');}catch(e){}syncUCard();}
const ucFloat=()=>matchMedia('(max-width:960px)').matches;
function syncUCard(){
  const el=$('#info'),cd=$('#ucard');if(!cd)return;
  if(!ucFloat()){cd.hidden=true;return;}
  const fresh=el.innerHTML!=='',src=fresh?el:$('#ucBody'),has=!!(src.querySelector('h2')||src.querySelector('.stats'));
  const key=(FARSEL&&!S.sel?'far:'+FARSEL:S.sel?'u'+S.sel.id:S.hoverId?'u'+S.hoverId:S.hover?(S.baseSel===S.hover?'b':'h')+S.hover:'')+'|'+S.turn;
  if(key!==UC.key){UC.key=key;UC.closedKey=null;}
  const chip=$('#ucChip');
  if(!has||UC.closedKey===key){cd.hidden=true;chip.hidden=true;return;}
  if(fresh){$('#ucBody').innerHTML=el.innerHTML;el.innerHTML='';}
  const h2=$('#ucBody').querySelector('h2'),ey=$('#ucBody').querySelector('.eyebrow');chip.textContent='▢ '+((h2||ey||{}).textContent||'資訊');
  cd.hidden=UC.min;chip.hidden=!UC.min;if(!UC.min)ucPlace();
}
function ucPlace(){
  const cd=$('#ucard');let pos=null;try{pos=JSON.parse(localStorage.getItem('tsl-ucard-pos')||'null');}catch(e){}
  if(!pos||typeof pos.fx!=='number'){cd.classList.remove('moved');cd.style.left=cd.style.top='';return;}
  cd.classList.add('moved');const w=cd.offsetWidth||220,h=cd.offsetHeight||140;
  cd.style.left=Math.max(4,Math.min(innerWidth-w-4,pos.fx*innerWidth))+'px';cd.style.top=Math.max(4,Math.min(innerHeight-h-4,pos.fy*innerHeight))+'px';
}
(function(){
  const cd=$('#ucard');if(!cd)return;let d=null;
  cd.addEventListener('pointerdown',e=>{if(e.target.closest('#ucClose,#ucMin,button'))return;if(e.target.closest('#ucBody')&&!e.target.closest('h2,.eyebrow,.stats'))return; // 內容區：手指滑動是捲動，不是拖曳視窗
    const r=cd.getBoundingClientRect();d={dx:e.clientX-r.left,dy:e.clientY-r.top,moved:false};try{cd.setPointerCapture(e.pointerId);}catch(x){}});
  cd.addEventListener('pointermove',e=>{if(!d)return;d.moved=true;cd.classList.add('moved');const w=cd.offsetWidth,h=cd.offsetHeight;
    cd.style.left=Math.max(4,Math.min(innerWidth-w-4,e.clientX-d.dx))+'px';cd.style.top=Math.max(4,Math.min(innerHeight-h-4,e.clientY-d.dy))+'px';});
  const end=()=>{if(!d)return;if(d.moved){try{localStorage.setItem('tsl-ucard-pos',JSON.stringify({fx:parseFloat(cd.style.left)/innerWidth,fy:parseFloat(cd.style.top)/innerHeight}));}catch(e){}}d=null;};
  cd.addEventListener('pointerup',end);cd.addEventListener('pointercancel',end);
  $('#ucClose').onclick=()=>{UC.closedKey=UC.key;cd.hidden=true;if(S&&S.baseSel){S.baseSel=null;render();}};
  $('#ucMin').onclick=()=>ucSetMin(true);$('#ucChip').onclick=()=>ucSetMin(false);
  cd.addEventListener('dblclick',()=>{try{localStorage.removeItem('tsl-ucard-pos');}catch(e){}ucPlace();}); // 連點兩下回到右下角
  addEventListener('resize',()=>{if(!cd.hidden)ucPlace();else syncUCard();});
})();
(function(){ // 天候膠囊：整顆可拖曳；放開時離畫面邊緣 40 px 內就吸到那個邊（靠近角落吸到角落），位置記在這台裝置
  const w=$('#wxWin');if(!w)return;let d=null,pos=null;const SNAP=40,M=8;
  const bottomBar=()=>{const b=document.querySelector('.mbar');return b&&getComputedStyle(b).display!=='none'?b.offsetHeight:0;}; // 手機底部操作列
  function apply(){
    if(!pos)return;const ww=w.offsetWidth||120,hh=w.offsetHeight||30;
    w.style.left=w.style.right=w.style.top=w.style.bottom='auto'; // 用 auto 蓋掉 CSS 預設的 left／top，否則同時設 right／bottom 會把膠囊拉大
    if(pos.h==='l')w.style.left='calc('+M+'px + env(safe-area-inset-left,0px))';
    else if(pos.h==='r')w.style.right='calc('+M+'px + env(safe-area-inset-right,0px))';
    else w.style.left=Math.max(0,Math.min(innerWidth-ww,pos.fx*innerWidth))+'px';
    if(pos.v==='t')w.style.top='calc('+M+'px + env(safe-area-inset-top,0px))';
    else if(pos.v==='b')w.style.bottom='calc('+(M+bottomBar())+'px + env(safe-area-inset-bottom,0px))';
    else w.style.top=Math.max(0,Math.min(innerHeight-hh,pos.fy*innerHeight))+'px';
  }
  function snap(){ // 依目前位置決定吸附的邊
    const r=w.getBoundingClientRect(),bb=bottomBar();
    pos={h:r.left<SNAP?'l':innerWidth-r.right<SNAP?'r':'x',v:r.top<SNAP?'t':innerHeight-bb-r.bottom<SNAP?'b':'y',fx:r.left/innerWidth,fy:r.top/innerHeight};
    apply();try{localStorage.setItem('tsl-wx-pos',JSON.stringify(pos));}catch(e){}
  }
  window.TSL_WXSNAP=snap; // 手把拖曳放開後也吸附
  {const mw=document.querySelector('.mapwrap');if(mw&&window.IntersectionObserver)new IntersectionObserver(es=>{const e=es[es.length-1];w.classList.toggle('offmap',e.intersectionRect.height<120);},{threshold:[0,.05,.1,.2,.35,.5,.75,1]}).observe(mw);} // 捲到地圖以外就隱藏，不蓋住下面的內容
  try{const p=JSON.parse(localStorage.getItem('tsl-wx-pos')||'null');if(p&&typeof p.fx==='number'){pos={h:p.h||'x',v:p.v||'y',fx:p.fx,fy:p.fy};apply();}}catch(e){}
  w.addEventListener('pointerdown',e=>{const r=w.getBoundingClientRect();d={x0:e.clientX,y0:e.clientY,dx:e.clientX-r.left,dy:e.clientY-r.top,id:e.pointerId,moved:false};});
  addEventListener('pointermove',e=>{if(!d||e.pointerId!==d.id)return;
    if(!d.moved){if(Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<6)return;d.moved=true;w.classList.add('drag');try{w.setPointerCapture(d.id);}catch(x){}}
    w.style.right=w.style.bottom='';w.style.left=Math.max(0,Math.min(innerWidth-w.offsetWidth,e.clientX-d.dx))+'px';w.style.top=Math.max(0,Math.min(innerHeight-w.offsetHeight,e.clientY-d.dy))+'px';e.preventDefault();});
  const end=()=>{if(!d)return;const mv=d.moved;d=null;w.classList.remove('drag');if(mv){snap();const blk=ev=>{ev.stopPropagation();ev.preventDefault();};addEventListener('click',
      blk,{capture:true,once:true});setTimeout(()=>removeEventListener('click',blk,{capture:true}),300);}}; // 拖曳結束後吞掉這次 click，不要彈出說明
  addEventListener('pointerup',end);addEventListener('pointercancel',end);
  addEventListener('resize',()=>{wxWinSync();renderStatus();apply();});
})();
function render(){focusOwnOnce();coachUpdate();
  if(typeof MISSION!=='undefined'&&MISSION)MISSION.tick();
  /* 關卡挑戰：檢查過關條件 */if(S.rec)recordFrame();
  else{renderAll();if(typeof jankPing==='function')jankPing();
  textZoomFix();
  cnPendSync();
  afPendSync();
  if(FXQ.length)playFx(FXQ.splice(0));
  }const rb=$('#btnRestart');
  if(rb)rb.hidden=!(S.started&&!S.over&&!S.video);
  {const on=!!S.started;
  const nb=$('#btnNew');
  if(nb)nb.hidden=!on;
  const fb=$('#fsNew');
  if(fb)fb.hidden=!on;
  const mb=$('#mNew');
  if(mb)mb.hidden=!on;
  }const ab=$('#btnAI');
  if(ab)ab.hidden=!(S.started&&!S.over&&!S.video&&!S.sim&&(S.ctrl.atk==='human'||S.ctrl.def==='human'));
  }
$('#btnRestart').onclick=()=>restartGame();$('#btnNew').onclick=()=>restartGame();$('#mNew').onclick=()=>restartGame();$('#fsNew').onclick=()=>restartGame(); // 隨時都能放棄這一局（含電腦推演、影片播放、事件視窗開著時）
$('#btnAI').onclick=()=>{
  if(!S.started||S.over||S.video||S.sim)return;
  const hs=['atk','def'].filter(k=>S.ctrl[k]==='human');if(!hs.length)return;
  if(!confirm(TX('改由電腦接手？你操作的一方（')+hs.map(k=>TX(SIDE[k])).join('、')+TX('）之後都由電腦指揮，無法再取回。')))return;
  const was=S.ctrl[S.phase];hs.forEach(k=>{S.ctrl[k]='ai';});
  log('玩家改由電腦接手指揮（'+hs.map(k=>SIDE[k]).join('、')+'）');toast('已改由電腦接手');
  if(was==='human'&&!S.busy&&!S.over)runAI(S.phase);
  render();
};
