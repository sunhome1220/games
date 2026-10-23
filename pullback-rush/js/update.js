// 版本更新提示：定期抓 version.js 比對，有新版就顯示按鈕，點了以新網址重新整理
(() => {
  const btn = document.getElementById('newver');
  document.getElementById('ver').textContent = '版本 ' + VERSION;
  async function check() {
    try {
      const txt = await (await fetch('js/version.js?check=' + Date.now(), { cache: 'no-store' })).text();
      const v = (txt.match(/const VERSION = '([^']+)'/) || [])[1];
      btn.hidden = !v || v === VERSION;
    } catch (_) { /* 離線時略過 */ }
  }
  btn.onclick = () => location.replace(location.pathname + '?v=' + Date.now());
  if (location.protocol.startsWith('http')) {
    check(); setInterval(check, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    addEventListener('focus', check); addEventListener('pageshow', check);
  }
})();
