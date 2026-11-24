'use strict';
/* ---------- 更新內容（CHANGELOG）：更版後第一次開啟時自動顯示，也可從頁尾「更新內容」重看 ---------- */
/* 只留最近 15 版；更早的在 changelog_old.js（要看「全部」時才載入，開頁不載入） */
const CHANGELOG=[
  {v:'2026-11-24.03',items:['新增存檔：輪到你操作的階段開始時自動存檔，另有 3 個手動存檔位（設定頁）；首頁多了「繼續上次戰局」。存檔放在這個瀏覽器裡，讀檔後的推演與不中斷完全相同。']},
  {v:'2026-11-24.02',items:['棋子大小跟著格子：平常約 0.9 格寬，相鄰格的棋子不再互相蓋住；畫面上太小時才放大（至少約 38 px，好點選）','同一格兩個棋子改成疊成一疊，右上角標「×2」；點選或游標停在那一格才左右展開','戰力圓點、「3/8 車」「x/y 艘」與彈藥長條收進棋子底部，不再壓到旁邊的棋子','棋子上緣加色帶：黃＝地面機動部隊、青＝火力（飛彈、火箭、防空、直升機、潛艦、作戰艦）、灰＝後勤（運輸、補給）']},
  {v:'2026-11-24.01',items:['移除天氣以外的隨機判定：電腦選擇移動位置、打擊目標、空降落點等改用固定的平手判定（依地點與回合算出，不擲骰）；停戰評估、攔截補給、補給船團調整改為「依權重的固定選擇」（重複評估時各選項比例符合原本設計）；美軍航艦沉沒後的反應取可能性最高的一種；電腦守方的「反制先制打擊」固定選分散疏散、「持久戰策略」攻方達成 2 項條件才全力反攻','動畫、戰報文字與擲骰動畫改用不吃戰局種子的亂數，不再因為畫面怎麼播而改變戰局結果；同一個戰局碼重玩結果完全相同']},
  {v:'2026-11-18.65',items:['新增任務「截斷後續梯隊」（守方，限時 6 回合）：累計打掉攻方滾裝船團的船數（每命中 1 枚＝1 艘，輕型旅 4 艘、重型旅 10 艘），台北不能失守；評星門檻取自電腦守方 18 場的實測中位數 5 艘（★）、加 25%＝7 艘（★★）、加 50%＝8 艘（★★★，打到會提前結束）；結算依武器分組列出貢獻。任務挑戰現在共 3 項']},
  {v:'2026-11-18.63',items:['「回首頁」統一用同一顆房子圖示、固定在標題列首頁鈕的位置：首頁的子頁（任務挑戰、設定）、設定視窗、任務簡報與結算都用它，原本的「← 回首頁」「🏠 回首頁」「回主遊戲」文字按鈕移除；手把在首頁子頁按 ○ 也是回首頁']},
  {v:'2026-11-18.62',items:['手把在選單（首頁、設定精靈、彈窗）裡切換選項時，只用黃框標示目前選到的按鈕，不再疊一顆圓形游標']},
  {v:'2026-11-18.61',items:['新增管理者開關：status.json 設 open:false 就對外關閉（訪客只看到「目前暫停開放」與你寫的訊息），網址加 ?admin=密碼 的管理者仍可照常使用（這台裝置記住，?admin=logout 登出）；抓不到 status.json 照常開放。操作說明見 docs/admin.md、改設定用 tools/admin.py 或手機可用的 admin.html（在瀏覽器內算出管理者密碼雜湊）。軟性關閉：擋得住一般訪客，擋不住自己下載程式碼的人']},
  {v:'2026-11-18.60',items:['標題列新增「🏠 首頁」鈕：戰役模式中也能回首頁（還沒開局＝直接回首頁，設定精靈內容保留；對局中＝確認後重新載入）；設定精靈底下的「任務挑戰：航艦打擊／72 小時港區奪控」小連結移除（首頁已有任務挑戰）']},
  {v:'2026-11-18.59',items:['首頁文案改版：三張卡片「01／戰役模式（完整戰局）」「02／任務挑戰（情境任務）」「03／個人化配置（系統設定）」；「關卡挑戰」統一改稱「任務挑戰」，兩個任務更名為「航艦打擊」「72 小時港區奪控」（網址參數 mission=carrier／port 不變）；首頁改用深海軍藍配色（主背景 #101A24、卡片 #1B2935、暗金強調 #C5A56A，守方標籤 #5EAA91、攻方標籤 #D16F65），不隨亮暗主題切換']},
  {v:'2026-11-18.58',items:['首頁新增「設定」：語言、戰績紀錄、火力動畫速度、國際快訊、語音、部隊兵力表示、地圖畫質、河流名稱、支持作者、重看新手引導，都集中在首頁的設定頁（遊戲中的「⚙ 設定」視窗仍保留，內容相同並多了統計與回首頁）；在首頁切換語言重新載入後會回到設定頁']},
  {v:'2026-11-18.57',items:['首頁可用手把玩：十字鍵／左搖桿在「戰役模式」「關卡挑戰」與關卡卡片之間移動，✕（A）選擇，○ 從關卡列表回首頁，△／Options 直接進戰役模式；首頁開著時 L1／R1 不會動到後面的設定精靈']},
  {v:'2026-11-18.56',items:['新增首頁：第一次開啟時選「戰役模式」（完整戰局，原本的設定精靈）或「關卡挑戰」（限時短任務，列出所有關卡）；可勾「以後直接進入戰役模式」，「⚙ 設定」有「回首頁」。同一分頁重新載入（切換語言）、關卡網址、測試與除錯網址不會顯示首頁']},
  {v:'2026-11-18.55',items:['新增 3 處共軍長程火箭（PHL-16／PCH-191）陣地：平潭、長樂、石獅（依據：2022 年演習平潭曾部署第 72 砲兵旅發射車；2026 年報導福建沿海集中地）。守方可打擊這些陣地，受損則長程火箭每回合波數下降；三處平均分擔發射量為★推估。公開資料找不到平潭的岸基反艦飛彈與防空部署證據，所以沒有加入']},
  {v:'2026-11-18.54',items:['平潭兩座橋的名稱（公鐵大橋、跨海大橋）縮小字級，只在地圖放到最大（900% 以上）時才顯示']},
  {v:'2026-11-18.53',items:['平潭的兩座橋可走：地面部隊能沿橋往返平潭島（北側公鐵大橋 3 格、南側跨海大橋 2 格，每多一格橋面 +1 移動；橋另一端不算相鄰，不能隔橋攻擊）。陸路走得到的港口格現在顯示為「移動」，不再被「靠港上船」蓋掉。橋暫時打不斷']},
];
let wnSeen='';try{wnSeen=localStorage.getItem('tsl-seen-ver')||'';
  if(!wnSeen&&!localStorage.getItem('tsl-setup')&&!localStorage.getItem('tsl-lang')){wnSeen=VERSION;localStorage.setItem('tsl-seen-ver',VERSION);} // 全新使用者不需要看更新內容，直接記為已看過
}catch(e){}
let CHANGELOG_OLD=null; // 更早的版本，需要時才載入 changelog_old.js
function changelogMore(cb){
  if(CHANGELOG_OLD)return cb();
  const s=document.createElement('script');s.src='js/core/changelog_old.js?v='+VERSION;s.onload=()=>{CHANGELOG_OLD=typeof CHANGELOG_OLD_DATA!=='undefined'?CHANGELOG_OLD_DATA:[];cb();};s.onerror=()=>{CHANGELOG_OLD=[];cb();};document.head.appendChild(s);
}
function showChangelog(all){
  const oldest=CHANGELOG[CHANGELOG.length-1].v,needOld=(all||(wnSeen&&wnSeen<oldest))&&!CHANGELOG_OLD;
  if(needOld)return changelogMore(()=>showChangelog(all)); // 看全部、或很久沒開而漏看很多版時，才載入舊的更新內容
  const ALL=CHANGELOG.concat(CHANGELOG_OLD||[]);
  const list=all||!wnSeen?ALL.slice(0,all?ALL.length:3):ALL.filter(c=>c.v>wnSeen);
  if(!list.length)return;
  let d=document.getElementById('wn');if(d)d.remove();
  d=document.createElement('div');d.id='wn';d.setAttribute('role','dialog');d.setAttribute('aria-label','更新內容');
  d.innerHTML='<div class="wn-card"><button class="wn-x" aria-label="關閉">✕</button><h3>更新內容</h3>'+list.map(c=>'<h4>版本 '+c.v+'</h4><ul>'+c.items.map(x=>'<li>'+x+'</li>').join('')+'</ul>').join('')+'<div class="btns"><button id="wnOk">知道了</button></div></div>';
  document.body.appendChild(d);
  const close=()=>{d.remove();try{localStorage.setItem('tsl-seen-ver',VERSION);}catch(e){}};
  d.querySelector('#wnOk').onclick=close;d.querySelector('.wn-x').onclick=close;d.addEventListener('click',e=>{if(e.target===d)close();});
  d.querySelector('#wnOk').focus();
}
