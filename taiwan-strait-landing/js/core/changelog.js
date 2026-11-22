'use strict';
/* ---------- 更新內容（CHANGELOG）：更版後第一次開啟時自動顯示，也可從頁尾「更新內容」重看 ---------- */
/* 只留最近 15 版；更早的在 changelog_old.js（要看「全部」時才載入，開頁不載入） */
const CHANGELOG=[
  {v:'2026-11-18.61',items:['新增管理者開關：status.json 設 open:false 就對外關閉（訪客只看到「目前暫停開放」與你寫的訊息），網址加 ?admin=密碼 的管理者仍可照常使用（這台裝置記住，?admin=logout 登出）；抓不到 status.json 照常開放。操作說明見 docs/admin.md、改設定用 tools/admin.py 或手機可用的 admin.html（在瀏覽器內算出管理者密碼雜湊）。軟性關閉：擋得住一般訪客，擋不住自己下載程式碼的人']},
  {v:'2026-11-18.60',items:['標題列新增「🏠 首頁」鈕：戰役模式中也能回首頁（還沒開局＝直接回首頁，設定精靈內容保留；對局中＝確認後重新載入）；設定精靈底下的「任務挑戰：航艦打擊／72 小時港區奪控」小連結移除（首頁已有任務挑戰）']},
  {v:'2026-11-18.59',items:['首頁文案改版：三張卡片「01／戰役模式（完整戰局）」「02／任務挑戰（情境任務）」「03／個人化配置（系統設定）」；「關卡挑戰」統一改稱「任務挑戰」，兩個任務更名為「航艦打擊」「72 小時港區奪控」（網址參數 mission=carrier／port 不變）；首頁改用深海軍藍配色（主背景 #101A24、卡片 #1B2935、暗金強調 #C5A56A，守方標籤 #5EAA91、攻方標籤 #D16F65），不隨亮暗主題切換']},
  {v:'2026-11-18.58',items:['首頁新增「設定」：語言、戰績紀錄、火力動畫速度、國際快訊、語音、部隊兵力表示、地圖畫質、河流名稱、支持作者、重看新手引導，都集中在首頁的設定頁（遊戲中的「⚙ 設定」視窗仍保留，內容相同並多了統計與回首頁）；在首頁切換語言重新載入後會回到設定頁']},
  {v:'2026-11-18.57',items:['首頁可用手把玩：十字鍵／左搖桿在「戰役模式」「關卡挑戰」與關卡卡片之間移動，✕（A）選擇，○ 從關卡列表回首頁，△／Options 直接進戰役模式；首頁開著時 L1／R1 不會動到後面的設定精靈']},
  {v:'2026-11-18.56',items:['新增首頁：第一次開啟時選「戰役模式」（完整戰局，原本的設定精靈）或「關卡挑戰」（限時短任務，列出所有關卡）；可勾「以後直接進入戰役模式」，「⚙ 設定」有「回首頁」。同一分頁重新載入（切換語言）、關卡網址、測試與除錯網址不會顯示首頁']},
  {v:'2026-11-18.55',items:['新增 3 處共軍長程火箭（PHL-16／PCH-191）陣地：平潭、長樂、石獅（依據：2022 年演習平潭曾部署第 72 砲兵旅發射車；2026 年報導福建沿海集中地）。守方可打擊這些陣地，受損則長程火箭每回合波數下降；三處平均分擔發射量為★推估。公開資料找不到平潭的岸基反艦飛彈與防空部署證據，所以沒有加入']},
  {v:'2026-11-18.54',items:['平潭兩座橋的名稱（公鐵大橋、跨海大橋）縮小字級，只在地圖放到最大（900% 以上）時才顯示']},
  {v:'2026-11-18.53',items:['平潭的兩座橋可走：地面部隊能沿橋往返平潭島（北側公鐵大橋 3 格、南側跨海大橋 2 格，每多一格橋面 +1 移動；橋另一端不算相鄰，不能隔橋攻擊）。陸路走得到的港口格現在顯示為「移動」，不再被「靠港上船」蓋掉。橋暫時打不斷']},
  {v:'2026-11-18.52',items:['平潭島（南北約 29 km、東西約 19 km）由 1 格改為 3 格（取島嶼多邊形覆蓋率最高的格子），港口仍在中央格；地圖上畫出與大陸相連的兩座橋（北側平潭海峽公鐵兩用大橋、南側平潭海峽跨海大橋，示意位置，這次只畫圖、不改移動規則）。多出的兩格是大陸陸地格，會讓電腦攻方的部署與推演結果微幅變動']},
  {v:'2026-11-18.51',items:['修正東引上方的「大塊島」：那是舟山群島的示意圖形，被畫在東引正北；現在舟山與大陸沿岸機場（黃山、梅州、櫟社、路橋、龍灣、武夷山）都改用真實經緯度，舟山在 30.05°N、122.25°E（浙江外海）。外圍大陸沿岸新增城市地標：上海、杭州、金華；機場標記旁註明所在城市（櫟社＝寧波、路橋＝台州、龍灣＝溫州）']},
  {v:'2026-11-18.50',items:['滾裝船團依載運的旅型有船數：輕型旅 4 艘、重型合成旅 10 艘（★推估），棋子顯示「剩餘／總共 艘」。每命中 1 枚打掉 1 艘，船上的旅按比例損失兵力（輕型每艘 0.75 步、重型約 0.3 步，小數累計），船全沉旅才一併損失；返航的船團按剩餘船數補回運力。兩棲艦群不變']},
  {v:'2026-11-18.50',items:['共軍護航艦棋子的資訊卡列出組成：052D 與 054A 各 1 艘，各自的防空彈（48／32 枚）、涵蓋距離（200／40 km）、同時接戰數（4／2）與合計（80 枚、6 枚，等於棋子的防空數字）；說明受損 1 步少一艘、只負責防空。棋子本身不變（一對一個棋子，圖示兩艘）']},
  {v:'2026-11-18.49',items:['棋子圖示改回單張卡片（取消疊影），改用圖示內的船形數量表示船數：單艦（航艦、潛艦、055 等）一艘大船；護航艦棋子（052D＋054A 一對）兩艘；艦隊、兩棲艦群、滾裝船團、補給船團、美軍航艦打擊群三艘小船。圖例同步更新']},
  {v:'2026-11-18.48',items:['電腦攻方的護航艦：海上沒有己方運輸船時，退回大陸港口外海待命，運輸船出航後再跟上護送（舊版會單獨堆在登陸區、站在守方射程內，也沒有任何用處）']},
  {v:'2026-11-18.47',items:['地圖工具列新增「⌖ 攻擊」鈕，循環切換：關 → 反艦飛彈（岸置雄風 160 km、魚叉岸防 120 km、艦隊與護航艦反艦飛彈、NMESIS、堤豐）→ 對地火力（海馬士火箭 80 km、雷霆 40 km）→ 關；一次只顯示一類，同一種類的圈合併成一個外框（不再一圈圈互相疊），圖例列出各類。與「◎ 射程」可同時開，狀態記在這台裝置']},
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
