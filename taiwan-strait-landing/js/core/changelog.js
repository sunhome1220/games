'use strict';
/* ---------- 更新內容（CHANGELOG）：更版後第一次開啟時自動顯示，也可從頁尾「更新內容」重看 ---------- */
/* 只留最近 15 版；更早的在 changelog_old.js（要看「全部」時才載入，開頁不載入） */
const CHANGELOG=[
  {v:'2026-11-18.18',items:['防空隨年份增購（★推估）：每比 2026 年多 1 點防空點數，增購 1 個天弓三型連（2028～29 年 +1、2030 年 +2、2031～32 年 +3）；以前只增加攔截彈、不增加連數。守方在設定精靈新增「防空」頁，逐連選擇要放在哪個地區，選項會標示新增涵蓋哪些原本沒有彈道防禦的重要地點；選「自動」或由電腦守方時，補在涵蓋最薄處。原本的防空營位置不變']},
  {v:'2026-11-18.17',items:['防空部署調整（★推估，總連數不變）：愛國者第 4 營拆成花蓮、台東志航各 1 連；天弓三型北部 4 連挪 1 連到宜蘭。原本宜蘭、蘇澳、台東、志航完全沒有彈道飛彈防禦，現在都有營涵蓋（代價是花蓮與台北一帶各自變薄）']},
  {v:'2026-11-18.16',items:['修正手機上射程圖例蓋住地圖上方按鈕：圖例改排在工具列下方（直向、橫向都是）']},
  {v:'2026-11-18.15',items:['重畫效能：地形不變的「符合條件的格子清單」（台灣沿岸格、陸地、海格候選位置）改成只算一次，每次重畫不再掃過約 9,000 格；畫面與規則不變']},
  {v:'2026-11-18.14',items:['地圖效能：海面的格子合併成幾個大色塊、浪紋分組，地圖的圖形元素從約 46,700 個減到約 30,500 個，重畫後的繪製時間在測試環境約快 4 倍（1.1 秒 → 0.25 秒）；外觀與操作不變']},
  {v:'2026-11-18.13',items:['設定的「火力動畫速度」新增「關閉動畫」：火力動畫不播放、單位移動瞬間完成，打擊結果的訊息仍立刻顯示，電腦推演的動作之間也不停頓；系統設了「減少動態效果」時會自動如此']},
  {v:'2026-11-18.12',items:['程式檔案整理：js/ 依類別分成 core、rules、ui、media、i18n、missions（關卡）、data 子資料夾，原本的 missions/ 也搬進 js/（version.js 留在原處供舊版更新檢查）；程式內容與玩法不變；較大的檔案（render、rules、fx、turn）依職責拆成數個檔案；更新日誌只載入最近 15 版，看「全部」時才載入舊的；新增 tools/test/smoke.js 冒煙測試']},
  {v:'2026-11-18.11',items:['關卡程式整理：框架搬到 missions/common.js（含共用的結算清單與差量工具），「擊沉航艦」搬到 missions/carrier.js，與「72 小時奪港」放在同一個資料夾；玩法不變']},
  {v:'2026-11-18.10',items:['新關卡「72 小時奪港」（攻方）：6 回合內奪下並守住 2 個指定港口（台中、高雄、基隆每天排除 1 個），依運輸船損失與完成回合評星。關卡檔案放在新資料夾 missions/，說明見 missions/port.md；設定頁新增入口']},
  {v:'2026-11-18.09',items:['依實務修正海上的搶灘突擊：只有搭兩棲艦的兩棲旅與陸戰旅可以（登陸艇、兩棲載具靠岸）；搭滾裝船的旅（滾裝船沒有登陸艇，只能在港口或浮動碼頭卸載）和重型旅（不能搶灘）在海上不能攻擊，要先卸載。電腦同樣適用。資訊卡說明各船型能做什麼']},
  {v:'2026-11-18.08',items:['手把登陸流程修正：十字鍵左右選單位時，不再繞過共軍護航艦、運輸船、補給船這些不用手動操作的棋子（原本要按幾十次才輪到船上的旅）','手把選到要登陸的旅後，十字鍵切換的選項把登陸點排在最前面，標籤同地圖上的登陸提示（例如「★推薦 搶灘・守軍中：台中港」），其餘出航、移動才依方位排列']},
  {v:'2026-11-18.07',items:['登陸新手提示：選了要登陸的旅後，地圖上用小標籤指出各處適合的登陸方式——搶灘（登陸艦）、港口卸載、浮動碼頭（滾裝船）、空降，★推薦＝守軍少、離目標近；載著旅的船沒有可登陸格時，在附近港口標出「為什麼不能卸載」。地圖工具列新增「登陸提示」開關（沒選過時前 2 回合預設開啟）','新手引導加上登陸步驟：有部隊在海上、選了船上的旅（有橘格／沒有橘格各有說明）、上岸之後怎麼辦；設定裡可「重看新手引導與登陸提示」','圖例補上綠＝可移動、橘＝可登陸、紫＝可空降、橘圈＝可攻擊目標與登陸標籤的說明']},
  {v:'2026-11-18.06',items:['移除外圍示意區的 6 個橢圓虛線（沖繩、先島、關島、九州、大陸沿海、東海艦隊「投射區」）：只是手放的裝飾，不影響規則，也和真實海岸線對不上。']},
  {v:'2026-11-18.05',items:['長江下游（張家港以下，河道寬 5 公里以上）改用水格表示，不再疊一條細線；細線只畫到張家港，接上水格的邊。']},
  {v:'2026-11-18.04',items:['河流：支流與主流交會處不再有空隙——支流的匯流點會貼到主流實際畫出的曲線上（台灣的基隆河、新店溪等支流，與大陸的漢江匯入長江）。']},
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
