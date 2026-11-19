'use strict';
/* ---------- 卡頓偵測（2026-11-18）----------
   火力動畫播放、地圖重畫的前後，用 requestAnimationFrame 量相鄰兩幀的間隔；連續兩個 4 秒的取樣視窗，間隔中位數都超過 50 ms（低於約 20 fps）就提醒一次：
   「畫面好像不太順，要關閉動畫嗎？」按鈕：關閉動畫（等於設定的「關閉動畫」）／繼續使用（這局不再問）／不再提醒（記在這台裝置）。只提醒，不自動關。
   忽略：背景分頁（rAF 被暫停）、載入後前 8 秒、單次間隔 ≥1 秒、已關閉動畫或系統設了減少動態效果、手機省電模式的 30 fps（門檻 20 fps 以下才算）。網址加 nojank=1 可關閉偵測（測試用）。 */
const JANK={win:4000,minN:30,slowMs:50,need:2,warm:8000,t0:Date.now(),bad:0,off:/[?&]nojank=1/.test(location.search)};
let jRun=false,jLast=0,jBuf=[],jEnd=0;
const jankStored=()=>{try{return localStorage.getItem('tsl-jank')==='0';}catch(e){return false;}};
const jankOff=()=>JANK.off||jankStored()||FASTURL||reduce()||!S||!S.started||S.video||S.rec||S.jankAsked||Date.now()-JANK.t0<JANK.warm;
function jankPing(){ // 有動畫或重畫時呼叫：開一個 4 秒的取樣視窗（已經在取樣就延長）
  if(jankOff())return;jEnd=performance.now()+JANK.win;
  if(!jRun){jRun=true;jLast=0;jBuf=[];requestAnimationFrame(jankTick);}
}
function jankTick(now){
  if(document.hidden){jLast=0;jBuf=[];} // 背景分頁：丟掉
  else{if(jLast){const d=now-jLast;if(d<1000)jBuf.push(d);}jLast=now;}
  if(now<jEnd&&!jankOff())requestAnimationFrame(jankTick);
  else{jRun=false;const b=jBuf;jBuf=[];jankEval(b);}
}
const jankMedian=a=>{const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1];};
function jankEval(buf){ // 取樣視窗結束：樣本夠多、中位數太慢才算一次「不順」；連續兩次才提醒
  if(!buf||buf.length<JANK.minN||jankOff())return;
  const m=jankMedian(buf);
  if(m>JANK.slowMs){JANK.bad++;if(JANK.bad>=JANK.need)jankOffer(m);}else JANK.bad=0;
}
function jankOffer(m){
  if(!S||S.jankAsked)return;S.jankAsked=true;JANK.bad=0;
  let d=document.getElementById('jankCard');if(d)d.remove();
  d=document.createElement('div');d.id='jankCard';d.setAttribute('role','status');
  d.innerHTML='<div>畫面好像不太順（約 '+Math.round(1000/m)+' 格／秒）。要關閉動畫讓它順一點嗎？<small>會停止火力動畫與地圖海浪，戰報與結算照常；之後可在右上角「⚙ 設定」的「火力動畫速度」改回。</small></div><div class="cpb"><button id="jankOff">關閉動畫</button><button class="ghost" id="jankKeep">繼續使用</button><button class="ghost" id="jankNever">不再提醒</button></div>';
  document.body.appendChild(d);
  const close=()=>d.remove();
  d.querySelector('#jankOff').onclick=()=>{close();if(typeof applyPref==='function')applyPref('optFxSpd','off');const sel=document.getElementById('optFxSpd');if(sel)sel.value='off';fxSet('off');if(typeof toast==='function')toast('已關閉動畫，可在「⚙ 設定」改回',3500);try{if(typeof saveSetup==='function')saveSetup();}catch(e){}};
  d.querySelector('#jankKeep').onclick=close;
  d.querySelector('#jankNever').onclick=()=>{close();try{localStorage.setItem('tsl-jank','0');}catch(e){}};
}
if(/[?&]debug=1/.test(location.search))window.__jank={eval:jankEval,JANK,offer:jankOffer}; // 測試用：直接餵取樣資料
