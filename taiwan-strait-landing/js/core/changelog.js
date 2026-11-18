'use strict';
/* ---------- 更新內容（CHANGELOG）：更版後第一次開啟時自動顯示，也可從頁尾「更新內容」重看 ---------- */
/* 只留最近 15 版；更早的在 changelog_old.js（要看「全部」時才載入，開頁不載入） */
const CHANGELOG=[
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
  {v:'2026-11-18.03',items:['地圖外圍往北、往西擴大（約到 32.3°N、113.6°E），補上長江（含下游入海口）、漢江、淮河、富春江與鄱陽湖、太湖、巢湖等湖泊；東北角、東南角缺的格子補齊（先前掃描範圍寫死，右側與下方被截掉）。河流入海口與海岸格的邊對齊，不超出海岸、也不留縫。長江鎮江以下河口段 Natural Earth 沒有資料，是依城市位置畫的近似線（★推估）。']},
  {v:'2026-11-18.02',items:['外圍示意區的大陸海岸線改用真實資料（浙江、福建、廣東一帶不再是手繪的粗糙折線）；補上大陸的河流與湖泊：閩江、九龍江、甌江、東江、梅江、贛江（上游）、新豐江水庫等範圍內有資料的部分。長江、黃河、珠江口、韓江、錢塘江與各大湖不在目前地圖範圍內（或資料沒有），未畫。']},
  {v:'2026-11-18.01',items:['地圖縮放下限由 40% 提高為 80%（再縮小沒有意義，且邊緣不美觀）。']},
  {v:'2026-11-17.16',items:['滾裝船風險提醒（只提醒，不限制）：制空還不是攻方優勢、或攻方還沒控制能卸載的港口／浮動碼頭時，旅出航搭滾裝船會跳出提醒；滾裝船、船上的旅、以及會搭滾裝船的旅，資訊卡也會顯示同樣的提醒。電腦的行為不變']},
  {v:'2026-11-17.15',items:['載運的旅（或點到運輸船）本回合還能行動、卻沒有橘色可登陸格時，資訊卡會說明原因：滾裝船／登陸艦各自能在哪裡卸載，以及附近每個港口、灘頭為什麼不行（港口還在守方手上或被破壞、灘頭還沒占領、旁邊有敵軍、浪太高、格內有敵軍、斷崖泥灘山地）；岸邊太遠時顯示還差多遠']},
  {v:'2026-11-17.14',items:['選了己方單位、要移動時，機場標籤會變半透明且不能點，不再蓋住海上的目標格（原本點標籤所在的位置會變成點到機場、無法移動到那一格）；取消選取後恢復']},
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
