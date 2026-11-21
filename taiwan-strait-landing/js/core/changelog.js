'use strict';
/* ---------- 更新內容（CHANGELOG）：更版後第一次開啟時自動顯示，也可從頁尾「更新內容」重看 ---------- */
/* 只留最近 15 版；更早的在 changelog_old.js（要看「全部」時才載入，開頁不載入） */
const CHANGELOG=[
  {v:'2026-11-18.44',items:['棋子移動改成連續滑動：時間依距離（每格約 85 ms，300 ms～1.9 秒），先加速再減速，艦艇一回合 12 格也看得出是連續航行；超過 20 格（空降、新生成）改淡入。重畫時前一段還沒滑完，會從目前位置接著滑，不再跳；新船從登船格出發而不是在終點淡入；火力動畫等棋子滑到才開始。「關閉動畫」與減少動態效果時維持瞬間移動']},
  {v:'2026-11-18.43',items:['棋子圖示區分「一群」與「單一載具」：兩棲艦群、滾裝船團、補給船團、守方艦艇群、共軍護航艦與潛艦群、通用護衛艦、美軍航艦打擊群背後多兩張錯開的卡片（疊影），船形棋子內畫三艘小船；航艦、海鯤與美軍攻擊潛艦、055／052D／054A 等單艦維持單張卡片與一艘大船。圖例新增說明；棋子大小與版面不變']},
  {v:'2026-11-18.42',items:['沒有護航防空的滾裝船、補給船被反艦飛彈攻擊時，尋標命中率由 0.8 提高為 0.9（★推估：商船改裝、體積大、航速慢、沒有干擾與誘餌）；不同飛彈的尋標命中率仍不區分（沒有公開資料），差異只在突防速度與射程']},
  {v:'2026-11-18.41',items:['滾裝船要靠碼頭：只能在大陸港口格（福州、平潭、泉州、廈門、汕頭）裝船，旅要先走到港口格；登陸艦仍可在港口 40 km 內裝載。修正船團生在內陸機場格（長樂）的畫面問題；格子資訊卡會提示該去哪裡裝滾裝船']},
  {v:'2026-11-18.40',items:['判定回合新增第 16 回合（約 8 天，美軍第 3 航艦打擊群才趕得上）與第 24 回合（約 12 天）；新增「先由電腦推演 3／5／8 回合再接手」（設定精靈第 1 頁，對戰模式）：雙方依規則推演、事件與快訊自動處理，到指定回合後把操作權交還你，等於從戰局中段開始玩，戰局碼可重現']},
  {v:'2026-11-18.39',items:['階段標題（手機為地圖下方的指揮列）加上模擬日期，例如「第 1 回合 · 攻方指揮 · 2026/4/1 白天」：年＝兵力年代、月＝開戰月份、開戰日取該月 1 日（★設定），每 2 回合（白天、夜間各 12 小時）過 1 天，與戰報的 D+n 一致；沒有新增任何版面元素']},
  {v:'2026-11-18.38',items:['守方彈藥存量面板全部換算成「枚」、不再有小數，並新增空射魚叉、空射雄二、萬劍彈、SLAM-ER 等庫存；雄風分成雄二、雄三兩個庫存（2026 年約 7／3 點，每年依年產上限 +131／+70 枚），發射時按剩餘庫存比例動用，彈種決定攔截模型；協同出擊卡片的枚數與預估損失隨批數連動並算進艦載機攔截（舊版 4 批仍顯示單批的 0.1 架），協同攻擊的齊射依實際彈種估攔截']},
  {v:'2026-11-18.36',items:['新增「極簡畫質」（給舊平板、舊手機）：地形改成同類合併的平面色塊，不畫立體側面、陰影、山峰、建築與海浪，地圖節點由約 30,500 個降到約 2,900 個；海岸線、河流、地名、棋子、射程圈都保留，點選照常。可在「⚙ 設定」的「地圖畫質」切換（記在這台裝置），卡頓提醒也多了「極簡畫質」按鈕']},
  {v:'2026-11-18.35',items:['反艦飛彈依速度有不同的突防特性（★推估）：魚叉、雄二是亞音速掠海，雄三全程超音速，鷹擊-83 末端超音速衝刺，鷹擊-18 末端約 Mach 3。越快，防空艦的反應時間越短、每艘艦能同時處理的來襲飛彈越少，攔截彈也更難命中；亞音速飛彈與舊版完全相同']},
  {v:'2026-11-18.34',items:['新增四川艦（076 型兩棲攻擊艦，2027 年起 1 艘，★推估）：一艘兩棲艦，載著「海軍陸戰隊空中突擊營」（約 1/4 個旅），直升機從海上機降（半徑 250 km），可隨艦航行；艦會被打、沉了載的兵一起損失；機降後艦留在海上。電腦攻方第 2～6 回合天候許可時從海上機降。「第 4 艘航艦」改稱「004 型航艦」']},
  {v:'2026-11-18.33',items:['「擊沉航艦」關卡結算精簡：航艦寫成遼寧艦、山東艦、福建艦；拿掉「假設情境」段落與整場任務的統計，只寫攻擊這支航艦隊的我方付出（出擊、飛彈、被擊落戰機）與共軍損失（航艦、艦載機、護航艦）；不再用「步」，改寫「遭重創」「命中 N 次」']},
  {v:'2026-11-18.32',items:['作戰設定頁從 9 頁整理成 5 頁：方式（含判定回合與年代、潛艦操作方式）／攻方（戰前集結、共軍潛艦任務）／守方（戰前決策、防空增購、預先布雷位置、台灣潛艦任務，分組可收合）／假設情境／確認；設定項目一個都沒少']},
  {v:'2026-11-18.31',items:['新增對抗性登陸（強攻）：兩棲艦上的兩棲旅與陸戰旅可以登陸到有守軍的灘頭，登陸時自動戰鬥（沿用搶灘突擊的攻防與減分），守軍打光才站穩，打不下來留在船上。以前守軍佔住的格子整格封死，澎湖只有 4 格、開局每格都有守軍，根本登不上去。滾裝船、重型旅、空降不能強攻；登陸提示標籤寫「強攻登陸」']},
  {v:'2026-11-18.29',items:['攻方不再「請求停火」：停戰評估的選項改為「宣布達成目標、停止攻勢」（單方面，守方沒有接受或拒絕的步驟；結果依達成條件判定：2 項以上＝攻方保有戰果、1 項＝僵局、0 項＝實質撤出）、「有限撤退」、「提高賭注」。守方仍可請求停火談判，由攻方決定接不接受']},
  {v:'2026-11-18.28',items:['潛艦自主執行任務（預設）：設定精靈新增「潛艦任務」頁，開戰前指定台灣或共軍潛艦的任務（目標類型），開戰後你操作的一方的潛艦依任務自行行動、不能手動移動或開火；只有回港或每 3 回合一次的通訊窗口才能更換任務。想逐格操控可選「完全手動」，行為和以前相同。電腦操作的一方不受影響']},
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
