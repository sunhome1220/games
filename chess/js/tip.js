// ===== 玩了一陣子的小提醒（純屬好玩，關掉照樣能玩）=====
// 每打完一場（分出勝負或和局）算一場，記在瀏覽器：滿 20 場提醒一次、滿 50 場再提醒一次，之後不再打擾。
const TIP_AT = {
  20: { txt: '🎉 哇，你已經玩了 20 場瘋狂象棋！<br>如果玩得開心，歡迎請作者吃碗滷肉飯 🍜<br><small>不想理我也沒關係，直接關掉照樣能玩～</small>', go: '🍜 好啊，請你', no: '先不要' },
  50: { txt: '😆 看來你很愛我們的遊戲喔！已經 50 場了！<br>方便的話，請作者喝杯超商咖啡 ☕<br>讓遊戲更瘋狂、更有趣！<br><small>（不方便也完全 OK，感謝你一直玩）</small>', go: '☕ 請你喝！', no: '下次吧' },
};
let gameCounted = false;   // 同一場只算一次（reset 時歸零）
function hideTip() { $('tipCard').hidden = true; }
function countGame() {
  if (gameCounted) return; gameCounted = true;
  let n;
  try { n = (+localStorage.getItem('rc-games') || 0) + 1; localStorage.setItem('rc-games', n); } catch (e) { return; }
  for (const m of [20, 50]) {
    const k = 'rc-tip' + m; let seen = false;
    try { seen = localStorage.getItem(k) === '1'; } catch (e) {}
    if (n < m || seen) continue;
    setTimeout(() => {   // 等勝利畫面看一下再提醒；這時已經重開新局就改下一場再說
      if (state !== 'over') return;
      try { localStorage.setItem(k, '1'); } catch (e) {}
      $('tipTxt').innerHTML = TIP_AT[m].txt; $('tipGo').textContent = TIP_AT[m].go; $('tipNo').textContent = TIP_AT[m].no; $('tipGo').href = $('mTip').href;
      $('tipCard').hidden = false;
    }, 1500);
    break;   // 一次最多提醒一則
  }
}
$('tipNo').onclick = hideTip; $('tipGo').onclick = () => setTimeout(hideTip, 300);
