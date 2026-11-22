'use strict';
/* ---------- 首頁（2026-11-18）----------
   第一次開啟（網址沒有任何參數）時顯示：選「戰役模式」（完整戰局，原本的設定精靈）或「關卡挑戰」（限時短任務）。
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
function homeMain(){
  $('#homeIn').innerHTML='<h1>台海兵棋推演</h1><p class="hm-sub">依公開資料與物理推估的台海攻防推演。選擇要怎麼玩：</p>'+
    '<div class="hm-cards"><button class="hm-card" id="hmCampaign"><span class="tag">完整戰局</span><b>戰役模式</b><small>自選年代（2026～2032）、兵力與規則，由你指揮攻方或守方，也可以交給電腦推演、或純模擬看影片。戰後有完整的檢討報告。</small></button>'+
    '<button class="hm-card" id="hmMission"><span class="tag">限時短任務</span><b>關卡挑戰</b><small>用同一套規則，在固定開局下完成一個目標，依回合數評星：擊沉航艦、72 小時奪港。共 '+Object.keys(MISSION_DEFS).length+' 關。</small></button></div>'+
    '<div class="hm-foot"><label><input type="checkbox" id="hmSkip"> 以後直接進入戰役模式</label></div>';
  $('#hmCampaign').onclick=()=>{if($('#hmSkip').checked)homeStore('tsl-home','0');homeClose();};
  $('#hmMission').onclick=homeMissions;
  $('#hmCampaign').focus();
}
function homeMissions(){
  const cards=Object.entries(MISSION_DEFS).map(([id,D])=>'<a class="hm-card" href="?mission='+id+'"><span class="tag">你操作：'+(D.cfg&&D.cfg.optSide==='atk'?'攻方':'守方')+'</span><b>'+D.title+'</b><small>'+(D.goal||'')+'<br>'+(D.stars||'')+'</small></a>').join('');
  $('#homeIn').innerHTML='<button class="ghost hm-back" id="hmBack">← 回首頁</button><h1>關卡挑戰</h1><p class="hm-sub">選一關，先看任務簡報，再按「開始任務」。</p><div class="hm-cards">'+cards+'</div>';
  $('#hmBack').onclick=homeMain;
  document.querySelectorAll('#homeIn a.hm-card').forEach(a=>a.addEventListener('click',()=>homeSess('tsl-home','1')));
  const f=document.querySelector('#homeIn a.hm-card');if(f)f.focus();
}
function homeOpen(){homeMain();document.body.classList.add('onhome');$('#home').hidden=false;}
function homeAgain(){homeSess('tsl-home','0');location.href=location.pathname+'?home=1';} // 設定視窗的「回首頁」：重新載入並顯示首頁
if(homeShouldShow())homeOpen();
