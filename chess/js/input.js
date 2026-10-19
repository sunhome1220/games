// ----- 輸入 -----
function pos(e) {
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
  return viewFlip() ? { x: W - x, y: H - y } : { x, y };
}
// 點選己方棋子 → 綠點＝可走的位置、黃色準星＝原地可攻擊的敵人
const fallbackMode = (p, mv) => mv.length > 0 && mv.every(([x, y]) => Math.hypot(x - p.x, y - p.y) < 1.2 * C);   // 目前是「改走一步」模式
function selectPiece(p) {
  const sc = scan(p);
  sel = { p, moves: movesFor(p), dest: null, scan: sc };
  state = 'select'; setSkip(true); SFX.play('click');
  const atk = sc.some(t => t.ok), nm = p.T.n[p.s];
  setMsg(!sel.moves.length && !atk ? `${nm}沒有可走的位置，也沒有可攻擊的目標，請換別的棋子。`
    : `${nm}：` + (sel.moves.length ? '點綠點移動' + (oneStep(p) ? '（每次只能走一格）' : p.T.aa ? (fallbackMode(p, sel.moves) ? '（田字走不了，改走一步）' : '（走田字，象眼被塞就過不去）') : p.T.knight ? (fallbackMode(p, sel.moves) ? '（日字走不了，改走一步）' : '（走日字，蹩馬腳不能走）') : '') : '沒有可走的位置') +
      (atk ? '，或點黃色準星原地攻擊' : '') + '；點別處取消。' +
      (p.T.aa ? (p.cd > 0 ? `（防空冷卻中，對方接下來 ${p.cd} 次攻擊攔截不了；近戰不受影響）` : '（藍圈內的火箭和砲彈會被自動攔截）') : p.T.knight ? (p.cd > 0 ? `（火箭裝填中還要 ${p.cd} 回合；近戰可用步槍）` : '（火箭只能打日字位置；近戰用步槍 1 心）') : p.T.guard ? '（九宮內斜走一格；近距離手槍 1 心；帥被直射時，若有落點在射線上會自動走去擋）' : p.cd > 0 ? `（裝填中還要 ${p.cd} 回合）` : ''));
}
function cancelSel(msg = '已取消，請重新選擇棋子。') {
  sel = null; state = 'aim'; setSkip(false); setMsg(msg);
}
const destMsg = () => '已選目的地：按「出發」或再點一次目的地出發；點其他綠點可改；點別處取消。';
// 出發：算出剛好停在目的地的初速，車子直線開過去
function go([x, y]) {
  const p = sel.p, ex = x - p.x, ey = y - p.y, d = Math.hypot(ex, ey), v = speedFor(p, ex / d, ey / d, d);
  origin = { p, x: p.x, y: p.y, hd: p.hd, T: p.T, hp: p.hp };   // 記下出發前的狀態，讓玩家可取消移動
  sel = null; mover = p; moved = true;
  p.vx = ex / d * v; p.vy = ey / d * v; p.hd = Math.atan2(ey, ex);
  SFX.play('launch', Math.min(1, d / (5 * C)));
  emit(p.x - Math.cos(p.hd) * R, p.y - Math.sin(p.hd) * R, 6, { k: 'smoke', sp: 70, life: 0.6, size: 8, col: '#b89a6a', dir: p.hd + Math.PI, spread: 1.4 });
  state = 'moving'; setSkip(false);
  send({ t: 'launch', i: pieces.indexOf(p), vx: p.vx, vy: p.vy });
}
function fireAt(b) {
  send({ t: 'shoot', a: pieces.indexOf(mover), b: pieces.indexOf(b), snap: snapshot() });
  targets = []; state = 'fire'; timer = 0.5; setSkip(false); shoot(mover, b);
}
cv.addEventListener('pointerdown', e => {
  const m = pos(e), near = (x, y, r = R + 6) => Math.hypot(x - m.x, y - m.y) < r;
  SFX.init();
  if (state === 'over') { restart(); return; }
  if (!myTurn()) { setMsg(mode === 'ai' ? '電腦思考中…' : '還沒輪到你，等待對手操作…'); return; }
  const own = alive().find(q => q.s === turn && near(q.x, q.y));
  if (state === 'target') {   // 移動後：點準星開火；點己方棋子＝取消移動並改選；或按「不射擊」
    const t = targets.find(t => t.ok && near(t.p.x, t.p.y, R + 8));
    if (t) fireAt(t.p);
    else if (moved && own && undoMove()) selectPiece(own);
    return;
  }
  if (state === 'select') {
    const p = sel.p;
    const t = !sel.dest && sel.scan.find(t => t.ok && near(t.p.x, t.p.y, R + 8));
    if (t) { mover = p; moved = false; sel = null; fireAt(t.p); return; }   // 原地開火
    const mv = sel.moves.find(([x, y]) => near(x, y, C * 0.45));
    if (mv) {
      if (quick || sel.dest === mv) { go(mv); return; }
      sel.dest = mv; setSkip(true); setMsg(destMsg()); SFX.play('click'); return;
    }
    if (own === p) { if (sel.dest) go(sel.dest); return; }
    if (own) { selectPiece(own); return; }
    cancelSel(); return;
  }
  if (state === 'aim' && own) selectPiece(own);
});
$('fire').onclick = () => { if (state === 'select' && sel.dest) go(sel.dest); };
$('undo').onclick = () => { if (undoMove()) setMsg('已取消移動，請重新選擇棋子。'); };
$('skip').onclick = () => {
  if (state === 'select') { cancelSel(); return; }
  if (state !== 'target') return;
  if (!moved) { cancelSelect(); return; }
  targets = []; state = 'fire'; timer = 0.2; setSkip(false);
};
// Esc：取消選取；Enter：出發
addEventListener('keydown', e => {
  if (e.key === 'Enter' && state === 'select' && sel.dest) go(sel.dest);
  else if (e.key === 'Escape' && state === 'select') cancelSel();
  else if (e.key === 'Escape' && state === 'target') { if (moved) { if (undoMove()) setMsg('已取消移動，請重新選擇棋子。'); } else cancelSelect(); }
});

$('mute').textContent = SFX.muted ? '🔇' : '🔊';
$('mute').onclick = () => { SFX.init(); $('mute').textContent = SFX.toggle() ? '🔇' : '🔊'; };
// 快速模式：點綠點立即出發（不需確認），記在瀏覽器
let quick = false;
try { quick = localStorage.getItem('rc-quick') === '1'; } catch (e) {}
function showQuick() { $('quick').classList.toggle('on', quick); $('quick').textContent = quick ? '⚡快速✓' : '⚡快速'; }
showQuick();
$('quick').onclick = () => {
  quick = !quick; showQuick();
  try { localStorage.setItem('rc-quick', quick ? '1' : '0'); } catch (e) {}
  setMsg(quick ? '⚡快速模式：點綠點立即出發。' : '一般模式：點綠點後再按「出發」（或再點一次）才會移動。');
};

