// ===== 啟動 =====
reset(true);
requestAnimationFrame(loop);
{ const q = new URLSearchParams(location.search); if (!q.has('bc') && !q.has('nolog')) setTimeout(() => showLog(false), 300); }   // nolog／bc：測試用，不自動彈出更新內容
{
  const q = new URLSearchParams(location.search);
  if (q.get('bc')) bcConnect(q.get('bc'), +q.get('side') || 0);
  else if (q.get('room')) { $('lobby').hidden = false; $('secNet').open = true; $('roomIn').value = q.get('room'); join(q.get('room')); }
  else $('lobby').hidden = false;   // 一開始先選對戰模式
}
