'use strict';
/* ---------- 關卡挑戰（框架）：網址加 ?mission=<id> 時啟用；沒有參數時完全不動作 ----------
   戰鬥規則全部沿用主遊戲；關卡只負責：開局設定、過關判定、限時、簡報與結算。
   核心程式只有三個掛勾點：beginPhase（MISSION.phase）、render（MISSION.tick）、endGame（MISSION.onEnd）。
   各關放在 js/missions/<id>.js，用 MISSION_DEFS[id]={...} 註冊；各關共用的小工具（結算清單、差量）放在這個檔案。 */
const MISSION_DEFS={};
var MISSION=null; // 用 var：核心程式以 typeof 檢查，沒有關卡時為 null
// 各關結算共用：misList＝條列；misDiff＝兩份計數表相減，只留增加的 [名稱,差]
const misList=a=>'<ul class="mdeb">'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
const misDiff=(A,B)=>Object.entries(A||{}).map(([k,v])=>[k,v-((B||{})[k]||0)]).filter(x=>x[1]>0);
function missionId(){const m=location.search.match(/[?&]mission=([a-z0-9_-]+)/i);return m?m[1]:null;}
function missionStars(n){return '<span class="mstars">'+'★'.repeat(n)+'<span class="off">'+'★'.repeat(3-n)+'</span></span>';}
function missionBox(html){const box=mboxSet('');box.innerHTML=html;$('#modal').hidden=false;return box;}
function missionExit(){location.href=location.pathname;} // 回主遊戲
function missionRetry(){location.href=location.pathname+'?mission='+MISSION.id;}
function missionStart(id){
  const D=MISSION_DEFS[id];if(!D)return;
  MISSION={id,D,done:false,
    phase(side){return D.phase?D.phase(side):false;},
    tick(){if(!S.started||S.over||MISSION.done)return;const r=D.check();if(r)missionWin(r);},
    onEnd(early,side,label){missionResult(D.lose?D.lose(early,side,label):{t:'任務失敗',d:early||'時間到，未完成任務目標。'});}};
  Object.entries(D.cfg||{}).forEach(([k,v])=>{const e=$('#'+k);if(e)e.value=v;}); // 用關卡指定的設定開局（不改玩家記錄的設定）
  document.body.classList.add('mission');
  missionBriefing(); // 先看簡報，按「開始任務」才開局（避免簡報背後電腦已經開打）
}
function missionBriefing(){
  const D=MISSION.D,box=missionBox('<div class="eyebrow">🎯 任務挑戰</div><h3>'+D.title+'</h3><div class="mbrief">'+D.brief+'</div>'+
    '<div class="mgoal"><b>過關條件</b>：'+D.goal+'</div><div class="mgoal"><b>評星</b>：'+D.stars+'</div>'+
    (D.tips?'<div class="mtips"><b>提示</b><ul>'+D.tips.map(t=>'<li>'+t+'</li>').join('')+'</ul></div>':'')+
    '<div class="wz-note">'+(D.note||'')+'</div><div class="btns" style="margin-top:12px"><button id="misGo">開始任務</button><button class="ghost" id="misExit">回主遊戲</button></div>');
  $('#misGo').onclick=()=>{$('#modal').hidden=true;startGame();};$('#misExit').onclick=missionExit;$('#misGo').focus();
}
function missionWin(r){
  MISSION.done=true;S.over=true;S.sel=null;S.mode=null;log('🎯 關卡完成：'+r.t);
  setTimeout(()=>missionResult(r,true),1800); // 等擊沉的動畫播完
}
function missionResult(r,win){
  S.over=true;MISSION.done=true;render();
  const box=missionBox('<div class="eyebrow">🎯 任務挑戰 · '+MISSION.D.title+'</div><h3 class="verdict '+(win?'def':'atk')+'">'+(win?'任務成功':'任務失敗')+'</h3>'+
    (win?'<div class="mstarrow">'+missionStars(r.stars||1)+'</div>':'')+'<p>'+(r.d||'')+'</p>'+(r.extra||'')+
    '<div class="btns" style="margin-top:12px"><button id="misAgain">再挑戰一次</button><button class="ghost" id="misMap">檢視地圖</button><button class="ghost" id="misExit2">回主遊戲</button></div>');
  $('#misAgain').onclick=missionRetry;$('#misMap').onclick=()=>{$('#modal').hidden=true;};$('#misExit2').onclick=missionExit;
}
