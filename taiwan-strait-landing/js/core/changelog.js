'use strict';
/* ---------- 更新內容（CHANGELOG）：更版後第一次開啟時自動顯示，也可從頁尾「更新內容」重看 ---------- */
/* 只留最近 15 版；更早的在 changelog_old.js（要看「全部」時才載入，開頁不載入） */
const CHANGELOG=[
  {v:'2026-11-18.26',items:['新增卡頓偵測：火力動畫與地圖重畫時量畫面更新速度，連續兩次（各約 4 秒）低於約 20 格／秒，會提醒一次「畫面好像不太順，要關閉動畫嗎？」，可選「關閉動畫」「繼續使用」「不再提醒」；不會自動關閉。背景分頁、省電模式的 30 格／秒、已關閉動畫時不提醒']},
  {v:'2026-11-18.25',items:['「關閉動畫」現在也會停止桌面地圖的海浪循環動畫（它讓整張地圖每一幀都要重畫）；手機本來就沒有海浪動畫']},
  {v:'2026-11-18.24',items:['布雷改版（★推估）：開局的雷區依序分散到台北港、台中港、高雄、基隆附近（以前只布在台中港與高雄，台北港、基隆永遠沒有雷）；守方在設定精靈新增「預先布雷位置」頁，逐處指定要放在哪個港口（單數處近海水雷、雙數處灘頭地雷）；遊戲中「近海補布水雷」可選擇補在攻方卸載點外海，或任一個仍在守方手上的港口外海（只能補回被掃除或觸發的數量）']},
  {v:'2026-11-18.23',items:['布雷區改版：圖示縮小重畫（海格＝水雷，圓球加觸角；陸地格＝灘頭地雷，扁圓盤加叉），圖例新增說明；只有守方（與旁觀、影片）看得到，攻方不知道雷區位置，觸雷時才從戰報得知。文件更正：火山布雷車只能布陸上地雷，近海水雷是海軍布雷艇布設']},
  {v:'2026-11-18.22',items:['你操作守方時，地圖工具列的「⚓ 登陸提示」按鈕不再顯示（它只對攻方登陸有用，守方按了沒有反應）']},
  {v:'2026-11-18.21',items:['開戰月份選單改成 4×3 月曆格：每個月有天候三色條（綠＝良好、橘＝普通、紅＝惡劣的機率）與季節標籤（東北季風、春季窗口、梅雨、颱風季…），一眼就能比較各月；選取後下方寫出完整機率與該月的特殊效果']},
  {v:'2026-11-18.20',items:['手把：空軍出擊、縱深打擊選了目標後，按 ○ 直接取消已選的目標（原本要把游標移到面板的「取消」才按得到）；再按一次 ○ 離開出擊模式（空軍、攻擊直升機都適用）']},
  {v:'2026-11-18.19',items:['選了空軍基地、選出擊方式、選目標時，操作列的三個按鈕改成該情境的快捷按鈕，不再顯示容易誤按的「電腦代打」「結束階段」：基地卡開著＝船團／島上／大陸三種出擊方式；出擊中＝取消出擊、換方式、確認出擊；直升機出擊與一般打擊中只留取消（縱深打擊選定目標後多一個確認發射）。桌面、全螢幕、手機三種版面同步']},
  {v:'2026-11-18.18',items:['防空隨年份增購（★推估）：每比 2026 年多 1 點防空點數，增購 1 個天弓三型連（2028～29 年 +1、2030 年 +2、2031～32 年 +3）；以前只增加攔截彈、不增加連數。守方在設定精靈新增「防空」頁，逐連選擇要放在哪個地區，選項會標示新增涵蓋哪些原本沒有彈道防禦的重要地點；選「自動」或由電腦守方時，補在涵蓋最薄處。原本的防空營位置不變']},
  {v:'2026-11-18.17',items:['防空部署調整（★推估，總連數不變）：愛國者第 4 營拆成花蓮、台東志航各 1 連；天弓三型北部 4 連挪 1 連到宜蘭。原本宜蘭、蘇澳、台東、志航完全沒有彈道飛彈防禦，現在都有營涵蓋（代價是花蓮與台北一帶各自變薄）']},
  {v:'2026-11-18.16',items:['修正手機上射程圖例蓋住地圖上方按鈕：圖例改排在工具列下方（直向、橫向都是）']},
  {v:'2026-11-18.15',items:['重畫效能：地形不變的「符合條件的格子清單」（台灣沿岸格、陸地、海格候選位置）改成只算一次，每次重畫不再掃過約 9,000 格；畫面與規則不變']},
  {v:'2026-11-18.14',items:['地圖效能：海面的格子合併成幾個大色塊、浪紋分組，地圖的圖形元素從約 46,700 個減到約 30,500 個，重畫後的繪製時間在測試環境約快 4 倍（1.1 秒 → 0.25 秒）；外觀與操作不變']},
  {v:'2026-11-18.13',items:['設定的「火力動畫速度」新增「關閉動畫」：火力動畫不播放、單位移動瞬間完成，打擊結果的訊息仍立刻顯示，電腦推演的動作之間也不停頓；系統設了「減少動態效果」時會自動如此']},
  {v:'2026-11-18.12',items:['程式檔案整理：js/ 依類別分成 core、rules、ui、media、i18n、missions（關卡）、data 子資料夾，原本的 missions/ 也搬進 js/（version.js 留在原處供舊版更新檢查）；程式內容與玩法不變；較大的檔案（render、rules、fx、turn）依職責拆成數個檔案；更新日誌只載入最近 15 版，看「全部」時才載入舊的；新增 tools/test/smoke.js 冒煙測試']},
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
