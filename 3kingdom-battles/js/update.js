// ===== 新版本通知與更新內容 =====
// VERSION 定義在 version.js、CHANGELOG 在 changelog.js
(function (root) {
  const $ = id => document.getElementById(id);
  const SEEN = '3kb-seen';
  // 重新整理並略過瀏覽器快取（網址加上時間戳記）；戰鬥中先確認
  function reloadFresh() {
    if (root.UI && root.UI.g && !root.UI.g.over && !confirm('重新整理會中斷目前的戰役，確定嗎？')) return;
    const q = new URLSearchParams(location.search);
    q.set('v', Date.now());
    location.replace(location.pathname + '?' + q);
  }
  async function checkUpdate() {
    try {
      const txt = await (await fetch('js/version.js?check=' + Date.now(), { cache: 'no-store' })).text();
      const v = (txt.match(/const VERSION = '([^']+)'/) || [])[1];
      $('newver').hidden = !v || v === VERSION;
    } catch (e) { /* 離線時略過 */ }
  }
  function logHTML(list) { return list.map(e => `<h3>${e.v}</h3><ul>${e.t.map(x => `<li>${x}</li>`).join('')}</ul>`).join(''); }
  // all：全部；否則只顯示上次看過之後的新內容（最多 5 筆）
  function showLog(all) {
    let seen = ''; try { seen = localStorage.getItem(SEEN) || ''; } catch (e) {}
    const list = all ? CHANGELOG : CHANGELOG.filter(e => e.v > seen).slice(0, 5);
    if (!list.length) return;
    $('logBody').innerHTML = logHTML(list); $('logOv').hidden = false;
  }
  function closeLog() { $('logOv').hidden = true; try { localStorage.setItem(SEEN, VERSION); } catch (e) {} }
  $('newver').onclick = reloadFresh;
  $('logClose').onclick = closeLog;
  $('btnChangelog').onclick = () => showLog(true);
  // 第一次玩不彈（直接記下目前版本）；之後版本更新才彈出新內容
  let seen = null; try { seen = localStorage.getItem(SEEN); } catch (e) {}
  if (seen === null) { try { localStorage.setItem(SEEN, VERSION); } catch (e) {} }
  else if (seen < VERSION) showLog(false);
  if (location.protocol.startsWith('http')) {
    checkUpdate();
    setInterval(checkUpdate, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
    addEventListener('focus', checkUpdate); addEventListener('pageshow', checkUpdate);   // 切回分頁／從背景還原也檢查
  }
  root.UPDATE = { showLog, reloadFresh, checkUpdate };
})(window);
