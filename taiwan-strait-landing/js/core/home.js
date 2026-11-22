'use strict';
/* ---------- 首頁（2026-11-18）----------
   第一次開啟（網址沒有任何參數）時顯示：選「戰役模式」（完整戰局，原本的設定精靈）、「任務挑戰」或「設定」（限時短任務）。
   不顯示的情況：網址有 mission／debug／nohome／nojank／fast 參數（關卡、測試、除錯）、這個分頁已經看過（語言切換重新載入、關卡結束回主遊戲）、
   或使用者勾了「以後直接進入戰役模式」（localStorage tsl-home=0）。網址加 home=1 可強制顯示。設定視窗有「回首頁」。 */
const HOME_SKIP_Q=/[?&](mission|debug|nohome|nojank|fast)=/;
const homeStore=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);v===null?localStorage.removeItem(k):localStorage.setItem(k,v);}catch(e){}return null;};
const homeSess=(k,v)=>{try{if(v===undefined)return sessionStorage.getItem(k);sessionStorage.setItem(k,v);}catch(e){}return null;};
function homeShouldShow(){
  if(/[?&]home=1/.test(location.search))return true;
  return !(HOME_SKIP_Q.test(location.search)||homeSess('tsl-home')==='1'||homeStore('tsl-home')==='0');
}
function homeClose(){homeSess('tsl-home','1');document.body.classList.remove('onhome');$('#home').hidden=true;try{if(/[?&]home=1/.test(location.search))history.replaceState(null,'',location.pathname);}catch(e){}} // 關掉後把網址的 home=1 拿掉，之後重新載入不會又顯示首頁
function homeSettings(){ // 設定頁：語言、戰績紀錄、動畫速度、快訊、語音、地圖畫質…（同「⚙ 設定」視窗，不含統計與回首頁）
  $('#homeIn').innerHTML='<button class="ghost hm-back" id="hmBack">← 回首頁</button><h1>設定</h1><div id="homeSet"></div>';
  $('#hmBack').onclick=homeMain;renderSettings($('#homeSet'));
}
function homeMain(){
  const ts=Object.values(MISSION_DEFS).map(D=>D.title),names=ts.length===2?'「'+ts[0]+'」及「'+ts[1]+'」':ts.map(t=>'「'+t+'」').join('、');
  $('#homeIn').innerHTML='<h1>台海兵棋推演</h1><p class="hm-sub">依公開資料與物理推估的台海攻防推演。選擇要怎麼玩：</p>'+
    '<div class="hm-cards"><button class="hm-card" id="hmCampaign"><span class="tag">01 / 戰役模式</span><b>完整戰局</b><small>自訂年代、雙方兵力配置與交戰規則。選擇攻方或守方，親自指揮作戰，亦可交由系統進行自動推演，或觀看完整戰況模擬。<br>支援戰果統計、戰況回顧及完整戰後評估報告。</small></button>'+
    '<button class="hm-card" id="hmMission"><span class="tag">02 / 任務挑戰</span><b>情境任務</b><small>在指定戰場環境與既定作戰條件下，完成各項任務目標。系統將依據作戰成果進行評分，考驗你的決策能力與戰場應變。<br>收錄'+names+'等挑戰，共 '+ts.length+' 項任務。</small></button>'+
    '<button class="hm-card" id="hmSettings"><span class="tag">03 / 個人化配置</span><b>系統設定</b><small>自訂語言、推演速度、國際快訊、語音、地圖顯示品質及戰績紀錄。</small></button></div>'+
    '<div class="hm-foot"><label><input type="checkbox" id="hmSkip"> 以後直接進入戰役模式</label></div>';
  $('#hmCampaign').onclick=()=>{if($('#hmSkip').checked)homeStore('tsl-home','0');homeClose();};
  $('#hmMission').onclick=homeMissions;$('#hmSettings').onclick=homeSettings;
  $('#hmCampaign').focus();
}
function homeMissions(){
  const cards=Object.entries(MISSION_DEFS).map(([id,D])=>'<a class="hm-card" href="?mission='+id+'"><span class="tag '+(D.cfg&&D.cfg.optSide==='atk'?'en':'fr')+'">你操作：'+(D.cfg&&D.cfg.optSide==='atk'?'攻方':'守方')+'</span><b>'+D.title+'</b><small>'+(D.goal||'')+'<br>'+(D.stars||'')+'</small></a>').join('');
  $('#homeIn').innerHTML='<button class="ghost hm-back" id="hmBack">← 回首頁</button><h1>任務挑戰</h1><p class="hm-sub">選一項任務，先看任務簡報，再按「開始任務」。</p><div class="hm-cards">'+cards+'</div>';
  $('#hmBack').onclick=homeMain;
  document.querySelectorAll('#homeIn a.hm-card').forEach(a=>a.addEventListener('click',()=>homeSess('tsl-home','1')));
  const f=document.querySelector('#homeIn a.hm-card');if(f)f.focus();
}
function homeOpen(){homeMain();document.body.classList.add('onhome');$('#home').hidden=false;}
$('#btnHome').onclick=()=>{ // 標題列的「回首頁」：還沒開局＝直接顯示首頁（設定精靈的內容保留）；對局中＝確認後重新載入（對局結束）
  if(!S.started||S.over){homeOpen();return;}
  if(confirm('回首頁會結束目前這一局，確定嗎？'))homeAgain();};
function homeAgain(){homeSess('tsl-home','0');location.href=location.pathname+'?home=1';} // 設定視窗的「回首頁」：重新載入並顯示首頁
if(homeShouldShow()){homeOpen();if(homeSess('tsl-home-set')==='1'){homeSess('tsl-home-set','0');homeSettings();}} // 在首頁的設定切換語言後重新載入：回到設定頁
