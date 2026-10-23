// ===== 啟動 =====
// 「← 選單」連到上一層的遊戲選單，只有放在 GitHub Pages（或本機）時才有意義；放在專屬網址（例如 Cloudflare Pages，網站根目錄就是這個遊戲）時隱藏
const showMenuLink = h => h === '' || /(^|\.)github\.io$/.test(h) || /^(localhost|127\.|\[?::1)/.test(h);
$('menuLink').hidden = !showMenuLink(location.hostname);
reset(true);
requestAnimationFrame(loop);
{ const q = new URLSearchParams(location.search); if (!q.has('bc') && !q.has('nolog')) setTimeout(() => showLog(false), 300); }   // nolog／bc：測試用，不自動彈出更新內容
{
  const q = new URLSearchParams(location.search);
  if (q.get('bc')) { if (q.get('resume')) resumeFromStorage(+q.get('side') || 0, q.get('bc')); bcConnect(q.get('bc'), +q.get('side') || 0); }   // resume：測試用，模擬重新整理後回到房間
  else if (q.get('room')) { $('lobby').hidden = false; $('secNet').open = true; $('roomIn').value = q.get('room'); join(q.get('room')); }
  else { $('lobby').hidden = false; offerResume(); }   // 一開始先選對戰模式（有沒打完的連線對戰會多一顆「回到上次的房間」）
}
