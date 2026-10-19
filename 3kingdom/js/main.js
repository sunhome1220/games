// ===== 啟動 =====
function startGame(f, seed) {
  newGame(f, seed); view.targets = []; view.ghosts = [];
  $('startOv').hidden = true; $('endOv').hidden = true; $('siegeOv').hidden = true; $('sendOv').hidden = true;
  G.selected = ownedBy(f).find(c => c.capital).id; refresh();
}
for (const b of document.querySelectorAll('#startOv .pick')) b.onclick = () => startGame(b.dataset.f);
{ const q = new URLSearchParams(location.search); const f = q.get('faction'); if (FIDS.includes(f)) startGame(f, +q.get('seed') || undefined); else { newGame('shu', 1); refresh(); } }
requestAnimationFrame(frame);
