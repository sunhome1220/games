'use strict';
/* ---------- 更新內容（CHANGELOG）：更版後第一次開啟時自動顯示，也可從頁尾「更新內容」重看 ---------- */
/* 只留最近 15 版；更早的在 changelog_old.js（要看「全部」時才載入，開頁不載入） */
const CHANGELOG=[
  {v:'2026-11-18.52',items:['平潭島（南北約 29 km、東西約 19 km）由 1 格改為 3 格（取島嶼多邊形覆蓋率最高的格子），港口仍在中央格；地圖上畫出與大陸相連的兩座橋（北側平潭海峽公鐵兩用大橋、南側平潭海峽跨海大橋，示意位置，這次只畫圖、不改移動規則）。多出的兩格是大陸陸地格，會讓電腦攻方的部署與推演結果微幅變動']},
  {v:'2026-11-18.50',items:['滾裝船團依載運的旅型有船數：輕型旅 4 艘、重型合成旅 10 艘（★推估），棋子顯示「剩餘／總共 艘」。每命中 1 枚打掉 1 艘，船上的旅按比例損失兵力（輕型每艘 0.75 步、重型約 0.3 步，小數累計），船全沉旅才一併損失；返航的船團按剩餘船數補回運力。兩棲艦群不變']},
  {v:'2026-11-18.50',items:['共軍護航艦棋子的資訊卡列出組成：052D 與 054A 各 1 艘，各自的防空彈（48／32 枚）、涵蓋距離（200／40 km）、同時接戰數（4／2）與合計（80 枚、6 枚，等於棋子的防空數字）；說明受損 1 步少一艘、只負責防空。棋子本身不變（一對一個棋子，圖示兩艘）']},
  {v:'2026-11-18.49',items:['棋子圖示改回單張卡片（取消疊影），改用圖示內的船形數量表示船數：單艦（航艦、潛艦、055 等）一艘大船；護航艦棋子（052D＋054A 一對）兩艘；艦隊、兩棲艦群、滾裝船團、補給船團、美軍航艦打擊群三艘小船。圖例同步更新']},
  {v:'2026-11-18.48',items:['電腦攻方的護航艦：海上沒有己方運輸船時，退回大陸港口外海待命，運輸船出航後再跟上護送（舊版會單獨堆在登陸區、站在守方射程內，也沒有任何用處）']},
  {v:'2026-11-18.47',items:['地圖工具列新增「⌖ 攻擊」鈕，循環切換：關 → 反艦飛彈（岸置雄風 160 km、魚叉岸防 120 km、艦隊與護航艦反艦飛彈、NMESIS、堤豐）→ 對地火力（海馬士火箭 80 km、雷霆 40 km）→ 關；一次只顯示一類，同一種類的圈合併成一個外框（不再一圈圈互相疊），圖例列出各類。與「◎ 射程」可同時開，狀態記在這台裝置']},
  {v:'2026-11-18.46',items:['地圖整體實際尺寸放大一倍（含棋子、地名、射程圈），縮放百分比的範圍不變（80%～1000%、預設 300%）：同樣的 300% 現在畫得比以前大一倍。縮到最小（80%）時看到的範圍，約等於舊版的 160%，不再能縮到看見整個外圍區；全螢幕的「看全圖」也只到這個程度']},
  {v:'2026-11-18.45',items:['修正火力動畫從空格冒出：開火後才移動（或推進）的棋子，現在先留在原地讓動畫從牠原本的位置發出，約 0.9 秒後才滑向新位置；先移動再開火的棋子照舊，動畫等它滑到才開始']},
  {v:'2026-11-18.44',items:['棋子移動改成連續滑動：時間依距離（每格約 85 ms，300 ms～1.9 秒），先加速再減速，艦艇一回合 12 格也看得出是連續航行；超過 20 格（空降、新生成）改淡入。重畫時前一段還沒滑完，會從目前位置接著滑，不再跳；新船從登船格出發而不是在終點淡入；火力動畫等棋子滑到才開始。「關閉動畫」與減少動態效果時維持瞬間移動']},
  {v:'2026-11-18.43',items:['棋子圖示區分「一群」與「單一載具」：兩棲艦群、滾裝船團、補給船團、守方艦艇群、共軍護航艦與潛艦群、通用護衛艦、美軍航艦打擊群背後多兩張錯開的卡片（疊影），船形棋子內畫三艘小船；航艦、海鯤與美軍攻擊潛艦、055／052D／054A 等單艦維持單張卡片與一艘大船。圖例新增說明；棋子大小與版面不變']},
  {v:'2026-11-18.42',items:['沒有護航防空的滾裝船、補給船被反艦飛彈攻擊時，尋標命中率由 0.8 提高為 0.9（★推估：商船改裝、體積大、航速慢、沒有干擾與誘餌）；不同飛彈的尋標命中率仍不區分（沒有公開資料），差異只在突防速度與射程']},
  {v:'2026-11-18.41',items:['滾裝船要靠碼頭：只能在大陸港口格（福州、平潭、泉州、廈門、汕頭）裝船，旅要先走到港口格；登陸艦仍可在港口 40 km 內裝載。修正船團生在內陸機場格（長樂）的畫面問題；格子資訊卡會提示該去哪裡裝滾裝船']},
  {v:'2026-11-18.40',items:['判定回合新增第 16 回合（約 8 天，美軍第 3 航艦打擊群才趕得上）與第 24 回合（約 12 天）；新增「先由電腦推演 3／5／8 回合再接手」（設定精靈第 1 頁，對戰模式）：雙方依規則推演、事件與快訊自動處理，到指定回合後把操作權交還你，等於從戰局中段開始玩，戰局碼可重現']},
  {v:'2026-11-18.39',items:['階段標題（手機為地圖下方的指揮列）加上模擬日期，例如「第 1 回合 · 攻方指揮 · 2026/4/1 白天」：年＝兵力年代、月＝開戰月份、開戰日取該月 1 日（★設定），每 2 回合（白天、夜間各 12 小時）過 1 天，與戰報的 D+n 一致；沒有新增任何版面元素']},
  {v:'2026-11-18.38',items:['守方彈藥存量面板全部換算成「枚」、不再有小數，並新增空射魚叉、空射雄二、萬劍彈、SLAM-ER 等庫存；雄風分成雄二、雄三兩個庫存（2026 年約 7／3 點，每年依年產上限 +131／+70 枚），發射時按剩餘庫存比例動用，彈種決定攔截模型；協同出擊卡片的枚數與預估損失隨批數連動並算進艦載機攔截（舊版 4 批仍顯示單批的 0.1 架），協同攻擊的齊射依實際彈種估攔截']},
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
