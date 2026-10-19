// ===== 電腦對戰（AI） =====
// 列舉電腦每顆棋子「原地或移到某個可走的點，再攻擊某個目標（或不攻擊）」的所有行動，
// 用與實際規則相同的函式（scan、shotgunSim、guardBlock、interceptorFor）估算傷害來打分。
// 難度：1 新手＝隨機；2 簡單＝貪心但常失誤；
//       3、4、5＝貪心後，對分數最高的前 N 個行動推算「對手最好的反擊」並扣分（3：前 6 個、4：前 12 個、5：前 20 個，隨機性遞減）。
// 參數由電腦互打調校：再多看一步（我方追擊）與往前推進的位置分，實測都沒有幫助，預設關閉
const AI_CFG = { 3: { top: 6, w: 0.5, rnd: 0.6, pos: false }, 4: { top: 12, w: 0.6, rnd: 0.5, pos: false },
                 5: { top: 20, w: 0.6, rnd: 0.2, pos: false } };
const AI_LEVELS = ['', '新手', '簡單', '普通', '困難', '大師'];
const AI_DELAY = 450;   // 電腦每步之間的停頓（毫秒），讓玩家看得清楚
let aiLevel = 3, aiGen = 0, aiBusy = false, aiPlan = null;
const aiSide = () => 1 - mySide;
const VALUE = { K: 30, R: 9, N: 7, C: 7, E: 5, G: 4, P: 2 };
const unitValue = p => p.T.id === 'P2' ? 6 : VALUE[p.t];
// a 位於 (x,y)、用武器 T 攻擊 b 時，各棋子會受到多少傷害
function predictAttack(a, x, y, T, b) {
  const dm = new Map(), add = (p, d) => { d = effDmg(p, d); if (d > 0) dm.set(p, (dm.get(p) || 0) + d); }, from = { x, y };
  if (T.pellets) {
    const bl = guardBlock(b, from, T), gx = bl && bl.g.x, gy = bl && bl.g.y;
    if (bl) { bl.g.x = bl.x; bl.g.y = bl.y; }   // 仕先走到射線上再算彈丸
    try { for (const [p, n] of shotgunSim(a, b, x, y, T).count) add(p, pelletDmg(n, T)); }
    finally { if (bl) { bl.g.x = gx; bl.g.y = gy; } }
    return dm;
  }
  if (flies(T) && interceptorFor(b.s, b.x, b.y)) return dm;   // 會被防空攔下
  const bl = guardBlock(b, from, T), tgt = bl ? bl.g : b;
  add(tgt, T.dmg);
  if (T.splash) {
    const cx = b.x, cy = b.y;
    for (const q of alive()) {
      if (q === tgt) continue;
      const d = Math.hypot(q.x - cx, q.y - cy);
      if (d <= T.splash + 1) add(q, quarter(d <= C + 1 ? T.dmg / 2 : T.dmg / 4));
    }
  }
  return dm;
}
// 傷害對 side 方的價值：打敵人加分、誤傷自己扣分；擊毀帥／將決定勝負
function dmgValue(dm, side) {
  let v = 0;
  for (const [p, d] of dm) {
    const sign = p.s === side ? -1 : 1, kill = d >= p.hp;
    if (kill && p.t === 'K') v += sign * 10000;
    v += sign * (Math.min(d, p.hp) / p.T.hp * unitValue(p) * 3 + (kill ? unitValue(p) : 0));
  }
  return v;
}
function actionsFor(side) {
  const acts = [];
  for (const p of alive()) {
    if (p.s !== side) continue;
    for (const [x, y, mv] of [[p.x, p.y, false], ...movesFor(p).map(([x, y]) => [x, y, true])]) {
      const T0 = p.T.locked && crossed(p.s, y) ? TT[p.s].P2 : null;
      for (const t of scan(p, x, y, T0)) if (t.ok) acts.push({ p, x, y, mv, T: t.T, b: t.p });
      if (mv) acts.push({ p, x, y, mv, T: T0 || p.T, b: null });
    }
  }
  return acts;
}
const attackValue = (a, side) => a.b ? dmgValue(predictAttack(a.p, a.x, a.y, a.T, a.b), side) : 0;
// 位置分：攻擊棋子往敵帥推進；士守在帥旁；相待在帥附近約 2 格掩護
function positional(a, side) {
  const p = a.p, ek = alive().find(q => q.s !== side && q.t === 'K'), mk = alive().find(q => q.s === side && q.t === 'K');
  const dist = (x, y, q) => q ? Math.hypot(x - q.x, y - q.y) / C : 0;
  if (p.T.guard) return -dist(a.x, a.y, mk) * 0.3;
  if (p.T.aa) return -Math.abs(dist(a.x, a.y, mk) - 2) * 0.3;
  if (p.t === 'K') return 0;
  return (dist(p.x, p.y, ek) - dist(a.x, a.y, ek)) * 0.15;
}
// 暫時套用行動（移動＋傷害）後執行 fn，再還原局面
function simulate(a, fn) {
  const save = pieces.map(p => [p.x, p.y, p.hp, p.T]);
  if (a.b) for (const [q, d] of predictAttack(a.p, a.x, a.y, a.T, a.b)) q.hp = Math.max(0, q.hp - d);
  a.p.x = a.x; a.p.y = a.y; a.p.T = a.T;
  try { return fn(); } finally { pieces.forEach((q, i) => { [q.x, q.y, q.hp, q.T] = save[i]; }); }
}
// side 方最好的一次攻擊（只看攻擊行動），回傳 {a, v}
function bestAttack(side) {
  let best = { a: null, v: 0 };
  for (const a of actionsFor(side)) if (a.b) { const v = attackValue(a, side); if (v > best.v) best = { a, v }; }
  return best;
}
const bestReply = side => bestAttack(side).v;
// 推算對手最佳反擊；deep > 0 時再套用該反擊，加上我方接著能打出的最佳攻擊 × deep
function replyCost(side, deep) {
  const r = bestAttack(1 - side);
  if (!deep || !r.a) return r.v;
  return r.v - deep * simulate(r.a, () => bestReply(side));
}
function aiChoose(side = aiSide(), L = aiLevel) {
  let acts = actionsFor(side);
  if (!acts.length) return null;
  const pickRand = list => list[Math.floor(Math.random() * list.length)];
  if (L === 1) { const atk = acts.filter(a => a.b); return pickRand(atk.length && Math.random() < 0.5 ? atk : acts); }
  for (const a of acts) a.score = attackValue(a, side) + (L >= 3 && AI_CFG[L].pos ? positional(a, side) : 0);
  if (L === 2) for (const a of acts) a.score = a.score * (0.5 + Math.random()) + Math.random() * 3;
  else {
    const cfg = AI_CFG[L];
    for (const a of acts) a.score += Math.random() * cfg.rnd;
    acts.sort((u, v) => v.score - u.score);
    acts = acts.slice(0, cfg.top);
    for (const a of acts) a.score -= cfg.w * simulate(a, () => replyCost(side, cfg.deep || 0));
  }
  return acts.reduce((m, a) => a.score > m.score ? a : m);
}
// 電腦：選好行動後出發或原地開火
function aiAct() {
  const a = aiChoose();
  aiPlan = a;
  if (!a) { setMsg('電腦沒有可走的棋，跳過。'); state = 'fire'; timer = 0.5; return; }
  if (a.mv) { sel = { p: a.p, moves: [[a.x, a.y]], dest: [a.x, a.y], scan: [] }; go([a.x, a.y]); }
  else { mover = a.p; moved = false; fireAt(a.b); }
}
// 電腦：移動後選目標（優先原本計畫的目標）
function aiTarget() {
  const ok = targets.filter(t => t.ok), side = aiSide();
  let t = aiPlan && aiPlan.b && ok.find(t => t.p === aiPlan.b);
  if (!t && ok.length) {
    if (aiLevel === 1) t = ok[Math.floor(Math.random() * ok.length)];
    else {
      const v = u => dmgValue(predictAttack(mover, mover.x, mover.y, u.T, u.p), side);
      const best = ok.reduce((m, u) => v(u) > v(m) ? u : m);
      if (v(best) > 0) t = best;
    }
  }
  if (t) fireAt(t.p); else { targets = []; state = 'fire'; timer = 0.2; setSkip(false); }
}
function aiTick() {
  if (mode !== 'ai' || turn !== aiSide() || aiBusy || winner !== null) return;
  const step = state === 'aim' ? aiAct : state === 'target' && moved ? aiTarget : null;
  if (!step) return;
  aiBusy = true;
  if (state === 'aim') setMsg(`電腦（${AI_LEVELS[aiLevel]}）思考中…`);
  const gen = aiGen;
  setTimeout(() => { if (gen !== aiGen) return; aiBusy = false; step(); }, AI_DELAY);
}

