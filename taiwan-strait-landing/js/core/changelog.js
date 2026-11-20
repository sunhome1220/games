'use strict';
/* ---------- 更新內容（CHANGELOG）：更版後第一次開啟時自動顯示，也可從頁尾「更新內容」重看 ---------- */
/* 只留最近 15 版；更早的在 changelog_old.js（要看「全部」時才載入，開頁不載入） */
const CHANGELOG=[
  {v:'2026-11-18.38',items:['守方彈藥存量面板全部換算成「枚」、不再有小數，並新增空射魚叉、空射雄二、萬劍彈、SLAM-ER 等庫存；雄風分成雄二、雄三兩個庫存（2026 年約 7／3 點，每年依年產上限 +131／+70 枚），發射時按剩餘庫存比例動用，彈種決定攔截模型；協同出擊卡片的枚數與預估損失隨批數連動並算進艦載機攔截（舊版 4 批仍顯示單批的 0.1 架），協同攻擊的齊射依實際彈種估攔截']},
  {v:'2026-11-18.36',items:['新增「極簡畫質」（給舊平板、舊手機）：地形改成同類合併的平面色塊，不畫立體側面、陰影、山峰、建築與海浪，地圖節點由約 30,500 個降到約 2,900 個；海岸線、河流、地名、棋子、射程圈都保留，點選照常。可在「⚙ 設定」的「地圖畫質」切換（記在這台裝置），卡頓提醒也多了「極簡畫質」按鈕']},
  {v:'2026-11-18.35',items:['反艦飛彈依速度有不同的突防特性（★推估）：魚叉、雄二是亞音速掠海，雄三全程超音速，鷹擊-83 末端超音速衝刺，鷹擊-18 末端約 Mach 3。越快，防空艦的反應時間越短、每艘艦能同時處理的來襲飛彈越少，攔截彈也更難命中；亞音速飛彈與舊版完全相同']},
  {v:'2026-11-18.34',items:['新增四川艦（076 型兩棲攻擊艦，2027 年起 1 艘，★推估）：一艘兩棲艦，載著「海軍陸戰隊空中突擊營」（約 1/4 個旅），直升機從海上機降（半徑 250 km），可隨艦航行；艦會被打、沉了載的兵一起損失；機降後艦留在海上。電腦攻方第 2～6 回合天候許可時從海上機降。「第 4 艘航艦」改稱「004 型航艦」']},
  {v:'2026-11-18.33',items:['「擊沉航艦」關卡結算精簡：航艦寫成遼寧艦、山東艦、福建艦；拿掉「假設情境」段落與整場任務的統計，只寫攻擊這支航艦隊的我方付出（出擊、飛彈、被擊落戰機）與共軍損失（航艦、艦載機、護航艦）；不再用「步」，改寫「遭重創」「命中 N 次」']},
  {v:'2026-11-18.32',items:['作戰設定頁從 9 頁整理成 5 頁：方式（含判定回合與年代、潛艦操作方式）／攻方（戰前集結、共軍潛艦任務）／守方（戰前決策、防空增購、預先布雷位置、台灣潛艦任務，分組可收合）／假設情境／確認；設定項目一個都沒少']},
  {v:'2026-11-18.31',items:['新增對抗性登陸（強攻）：兩棲艦上的兩棲旅與陸戰旅可以登陸到有守軍的灘頭，登陸時自動戰鬥（沿用搶灘突擊的攻防與減分），守軍打光才站穩，打不下來留在船上。以前守軍佔住的格子整格封死，澎湖只有 4 格、開局每格都有守軍，根本登不上去。滾裝船、重型旅、空降不能強攻；登陸提示標籤寫「強攻登陸」']},
  {v:'2026-11-18.29',items:['攻方不再「請求停火」：停戰評估的選項改為「宣布達成目標、停止攻勢」（單方面，守方沒有接受或拒絕的步驟；結果依達成條件判定：2 項以上＝攻方保有戰果、1 項＝僵局、0 項＝實質撤出）、「有限撤退」、「提高賭注」。守方仍可請求停火談判，由攻方決定接不接受']},
  {v:'2026-11-18.28',items:['潛艦自主執行任務（預設）：設定精靈新增「潛艦任務」頁，開戰前指定台灣或共軍潛艦的任務（目標類型），開戰後你操作的一方的潛艦依任務自行行動、不能手動移動或開火；只有回港或每 3 回合一次的通訊窗口才能更換任務。想逐格操控可選「完全手動」，行為和以前相同。電腦操作的一方不受影響']},
  {v:'2026-11-18.27',items:['潛艦開火後立刻恢復隱蔽、轉移 20～40 km（以前是原地暴露整個對方階段），地圖只留「？」虛線圈標示最後已知位置，約 2 回合內逐漸變淡；反潛直升機搜索時游標會預覽 40 km 的搜索圓，發現機率隨潛艦離搜索圓心越遠而降低（圓心 100%、邊緣 40%）。數字為★推估']},
  {v:'2026-11-18.26',items:['新增卡頓偵測：火力動畫與地圖重畫時量畫面更新速度，連續兩次（各約 4 秒）低於約 20 格／秒，會提醒一次「畫面好像不太順，要關閉動畫嗎？」，可選「關閉動畫」「繼續使用」「不再提醒」；不會自動關閉。背景分頁、省電模式的 30 格／秒、已關閉動畫時不提醒']},
  {v:'2026-11-18.25',items:['「關閉動畫」現在也會停止桌面地圖的海浪循環動畫（它讓整張地圖每一幀都要重畫）；手機本來就沒有海浪動畫']},
  {v:'2026-11-18.24',items:['布雷改版（★推估）：開局的雷區依序分散到台北港、台中港、高雄、基隆附近（以前只布在台中港與高雄，台北港、基隆永遠沒有雷）；守方在設定精靈新增「預先布雷位置」頁，逐處指定要放在哪個港口（單數處近海水雷、雙數處灘頭地雷）；遊戲中「近海補布水雷」可選擇補在攻方卸載點外海，或任一個仍在守方手上的港口外海（只能補回被掃除或觸發的數量）']},
  {v:'2026-11-18.23',items:['布雷區改版：圖示縮小重畫（海格＝水雷，圓球加觸角；陸地格＝灘頭地雷，扁圓盤加叉），圖例新增說明；只有守方（與旁觀、影片）看得到，攻方不知道雷區位置，觸雷時才從戰報得知。文件更正：火山布雷車只能布陸上地雷，近海水雷是海軍布雷艇布設']},
  {v:'2026-11-18.22',items:['你操作守方時，地圖工具列的「⚓ 登陸提示」按鈕不再顯示（它只對攻方登陸有用，守方按了沒有反應）']},
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
