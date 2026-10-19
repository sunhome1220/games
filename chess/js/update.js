// ===== 版本與重新整理 =====
// VERSION 定義在 version.js
$('ver').textContent = '版本 ' + VERSION;
// 重新整理並略過瀏覽器快取（網址加上時間戳記）
function reloadFresh() {
  if (online() && conn && conn.open && !confirm('重新整理會中斷目前的連線對戰，確定嗎？')) return;
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
$('mReload').onclick = reloadFresh;
$('newver').onclick = reloadFresh;
if (location.protocol.startsWith('http')) {
  checkUpdate();
  setInterval(checkUpdate, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
  addEventListener('focus', checkUpdate); addEventListener('pageshow', checkUpdate);   // 切回分頁／從背景還原也檢查
}

