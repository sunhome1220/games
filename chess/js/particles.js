// ----- 粒子特效 -----
let parts = [], decals = [], shake = 0, lastBump = 0;
// o: {k 種類, sp 速度, life 壽命, size, col, dir 方向（省略＝四散）, spread 擴散角, drag 阻力}
function emit(x, y, n, o) {
  for (let i = 0; i < n; i++) {
    const a = o.dir === undefined ? Math.random() * Math.PI * 2 : o.dir + rnd((o.spread || 1) / 2);
    const sp = o.sp * (0.3 + Math.random() * 0.7), L = o.life * (0.6 + Math.random() * 0.4);
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: L, L, size: o.size * (0.6 + Math.random() * 0.6),
                 col: o.col, k: o.k, drag: o.drag ?? 3, rot: Math.random() * 6 });
  }
}
function flashAt(x, y, size, t = 0.12) { parts.push({ x, y, vx: 0, vy: 0, t, L: t, size, k: 'flash', drag: 0 }); }
function muzzle(x, y, dir, big) {
  flashAt(x, y, big ? 26 : 16);
  emit(x, y, big ? 10 : 5, { k: 'spark', sp: 260, life: 0.18, size: 2, col: '#ffe066', dir, spread: 0.9 });
  emit(x, y, big ? 6 : 2, { k: 'smoke', sp: 50, life: 0.7, size: 8, col: '#888', dir, spread: 1.2 });
}
function explode(x, y, big) {
  flashAt(x, y, big ? 60 : 34, big ? 0.16 : 0.1);
  parts.push({ x, y, vx: 0, vy: 0, t: 0.35, L: 0.35, size: big ? 75 : 42, k: 'ring', drag: 0 });
  emit(x, y, big ? 40 : 18, { k: 'spark', sp: big ? 340 : 230, life: 0.5, size: 2.5, col: '#ffd23f' });
  emit(x, y, big ? 16 : 8,  { k: 'fire',  sp: big ? 120 : 80,  life: 0.45, size: big ? 16 : 11, col: '#ff7a1a' });
  emit(x, y, big ? 18 : 8,  { k: 'smoke', sp: big ? 60 : 40,   life: big ? 1.5 : 1, size: big ? 18 : 12, col: '#555' });
  if (big) emit(x, y, 12, { k: 'debris', sp: 280, life: 0.9, size: 5, col: '#3a2a1a', drag: 2.5 });
  decals.push({ x: x + rnd(4), y: y + rnd(4), r: big ? 30 + Math.random() * 6 : 13 });
  shake = Math.max(shake, big ? 12 : 5);
}
function bumpFX(x, y, v) {
  const now = performance.now();
  if (now - lastBump > 60) { SFX.play('bump', v); lastBump = now; }
  if (v > 250) emit(x, y, 6, { k: 'spark', sp: 180, life: 0.25, size: 2, col: '#fff3b0' });
  if (v > 450) shake = Math.max(shake, 3);
}
function updParts(dt) {
  for (const p of parts) {
    p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f;
    if (p.k === 'smoke') p.y -= 12 * dt;
  }
  parts = parts.filter(p => p.t > 0);
  shake = Math.max(0, shake - 40 * dt);
}

function reset(noPick = false) {
  clockReset();
  if (typeof hintReset === 'function') hintReset();
  gameCounted = false; $('tipCard').hidden = true;   // 新的一局：重新計數、收起小提醒（見 tip.js）
  mods = [{}, {}]; cardCount = [{}, {}]; turnsPlayed = [0, 0]; immune = [0, 0]; extraTurn = [0, 0]; pickQ = []; pickSide = null; waitingFor = null; incoming = [];
  $('cardPick').hidden = true; buildTypes(0); buildTypes(1);
  pieces = [];
  for (let s = 0; s < 2; s++)
    for (const [t, c, r] of LAYOUT) {
      const T = TT[s][t];
      pieces.push({ s, t, T, x: gx(c), y: gy(s ? 9 - r : r), hx: gx(c), hy: gy(s ? 9 - r : r), vx: 0, vy: 0, hp: T.hp, hd: s ? Math.PI / 2 : -Math.PI / 2, flash: 0, recoil: 0, cd: 0 });
    }
  aiGen++; aiBusy = false; aiPlan = null;   // 取消還沒執行的電腦動作
  turn = 0; state = 'aim'; sel = null; fx = []; moved = false; firedPiece = null; winner = null; overReason = null; targets = []; parts = []; decals = []; shake = 0;
  updateHeader(); $('skip').disabled = true;
  setMsg('拉動己方棋子移動（輕點＝原地不動），停下後點選要攻擊的敵人。');
  renderPerks();
  if (typeof saveCheckpoint === 'function' && online()) saveCheckpoint();   // 連線對戰：新的一局從這裡開始（斷線重連的回溯點）
  if (cardsOn && !noPick) beginPick([0, 1]);   // 開局：雙方各選一張強化卡
}
function updateHeader() {
  $('turn').textContent = online() ? (myTurn() ? `你的回合（${SIDE[turn].name}）` : `對手回合（${SIDE[turn].name}）`)
    : mode === 'ai' ? (myTurn() ? '你的回合' : `電腦回合・${AI_LEVELS[aiLevel]}`) : SIDE[turn].name + ' 回合';
  $('turn').style.color = turn ? '#ddd' : '#ff7b6b';
  // 面對面：訊息列移到目前玩家那一側（黑方在上、文字倒轉）
  const bar = $('bar'), face = mode === 'face';
  if (face && turn === 0) cv.after(bar); else cv.before(bar);
  bar.classList.toggle('flip', face && turn === 1);
  if (state === 'pick') $('turn').textContent = '選擇強化卡';
  if (state === 'spell') $('turn').textContent = '選擇隕石落點';
  if (typeof renderDrawIn === 'function') renderDrawIn();
  if (online() && !myTurn() && state === 'aim') setMsg('等待對手操作…');
}

