// ----- 射擊判定 -----
// 直射：射線上若有其他棋子（任何一方）就被擋住
function blocked(a, b, x, y) {
  const dx = b.x - x, dy = b.y - y, d2 = dx * dx + dy * dy;
  return alive().some(p => {
    if (p === a || p === b) return false;
    const t = Math.max(0, Math.min(1, ((p.x - x) * dx + (p.y - y) * dy) / d2));
    return Math.hypot(p.x - (x + t * dx), p.y - (y + t * dy)) < R * 0.9;
  });
}
// 霰彈：從 (x,y) 朝 b 射出扇形彈丸，每發打到射線上第一顆棋子；回傳各彈丸終點與每顆敵人被打幾發
function shotgunSim(a, b, x = a.x, y = a.y, T = a.T) {
  const dir = Math.atan2(b.y - y, b.x - x), rays = [], count = new Map();
  for (let i = 0; i < T.pellets; i++) {
    const ang = dir + T.cone * (i / (T.pellets - 1) - 0.5), dx = Math.cos(ang), dy = Math.sin(ang);
    let best = null, bt = T.range;
    for (const p of alive()) {
      if (p === a) continue;
      const ox = p.x - x, oy = p.y - y, t = ox * dx + oy * dy, perp2 = ox * ox + oy * oy - t * t;
      if (t <= 0 || perp2 > R * R) continue;
      const th = t - Math.sqrt(R * R - perp2);
      if (th < bt) { bt = th; best = p; }
    }
    rays.push({ dir: ang, x: x + dx * bt, y: y + dy * bt, p: best });
    if (best && best.s !== a.s) count.set(best, (count.get(best) || 0) + 1);
  }
  return { rays, count };
}
const pelletDmg = (n, T) => n ? Math.max(0.25, quarter(n / T.pellets * T.dmg)) : 0;

// ----- 護衛領域（傳統象棋「蓋住的格子」）-----
// 將／士／象照傳統走法「走得到（可以吃）」的格子，而且在己方帥／將 2 格內，就是這顆棋子的護衛領域：
//   · 敵方棋子走完停在領域裡，領域的守衛會自動朝它開一槍（見 turn.js 的 guardFire）；
//   · 將／士／象攻擊站在自己領域裡的目標，威力至少 GUARD_DMG（可以秒殺多數棋子）。
const GUARD_DMG = 4, GUARD_NEAR = 2 * C, GUARD_TYPES = ['K', 'G', 'E'];
function coverCells(d, x = d.x, y = d.y) {
  const me = { s: d.s, T: d.T, t: d.t }, pts = pointsFor(me), at = (px, py) => ([qx, qy]) => Math.abs(qx - px) < 1 && Math.abs(qy - py) < 1;
  const near = (cand) => cand.map(([sx, sy]) => [x + sx * C, y + sy * C]).filter(([cx, cy]) => pts.some(at(cx, cy)));
  if (d.t === 'G') return near([[1, 1], [1, -1], [-1, 1], [-1, -1]]);   // 仕：九宮內斜走一格
  if (d.t === 'K') return near([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);   // 帥／將：九宮內走一格（本遊戲含斜向）
  if (d.t === 'E') return near([[2, 2], [2, -2], [-2, 2], [-2, -2]]).filter(([cx, cy]) => !alive().some(q => q !== d && Math.hypot(q.x - (x + cx) / 2, q.y - (y + cy) / 2) < 1));   // 象：田字，象眼（中間格）有棋子就蓋不到
  return [];
}
// target 站在 a 的護衛領域裡嗎？（a 站在 (x,y)；領域只算己方帥／將 2 格內）
function inGuardZone(a, target, x = a.x, y = a.y) {
  if (!GUARD_TYPES.includes(a.t) || a.hp <= 0 || a.s === target.s) return false;
  const k = a.t === 'K' ? { x, y } : alive().find(q => q.s === a.s && q.t === 'K');
  if (!k || Math.hypot(target.x - k.x, target.y - k.y) > GUARD_NEAR + 1) return false;
  return coverCells(a, x, y).some(([cx, cy]) => Math.abs(cx - target.x) < 1 && Math.abs(cy - target.y) < 1);
}
const guardDmg = (a, target, base, x = a.x, y = a.y) => inGuardZone(a, target, x, y) ? Math.max(base, GUARD_DMG) : base;
// 回傳 {p, ok, why, est}：在射程內的敵人、能否射擊、預估傷害
function scan(a, x = a.x, y = a.y, T0 = null) {
  return alive().filter(p => p.s !== a.s).map(p => {
    const T = T0 || weaponFor(a, p, x, y);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > T.range) return null;
    if (T.ortho) { const ox = Math.abs(p.x - x), oy = Math.abs(p.y - y); if (ox > 1 && oy > 1) return null; }   // 炮：只能打橫線／直線
    if (T.knightOnly && !knightOffset(x, y, p)) return null;
    if (T.tian && d > T.melee + 1 && !tianOffset(x, y, p)) return null;   // 象：相鄰近戰，或打田字對角點（象眼被塞時直射被擋）   // 傌的火箭：只能打日字位置
    if (a.cd > 0 && !a.T.aa && !T.isAlt) return { p, ok: false, why: `裝填中 ${a.cd}` };
    if (d < T.min) return { p, ok: false, why: '太近' };
    if (!T.indirect && blocked(a, p, x, y)) return { p, ok: false, why: '被擋' };
    return { p, ok: true, T, est: T.pellets ? pelletDmg(shotgunSim(a, p, x, y, T).count.get(p) || 0, T) : guardDmg(a, p, T.dmg, x, y) };
  }).filter(Boolean);
}
// 兵過河後永久升級成霰彈兵
// 空投動畫：運輸機飛過 → 投下降落傘補給箱 → 落地爆開，兵升任士官長
const DROP_T = 3.2, LAND_AT = 0.62;   // 動畫進行到 62% 時箱子落地
function airdrop(p) {
  p.drop = DROP_T;   // 動畫期間先不顯示官階標誌
  fx.push({ k: 'drop', x: p.x, y: p.y, t: DROP_T, T: DROP_T, side: p.s, land: () => {
    p.drop = 0; p.flash = 0.5; flashAt(p.x, p.y, 46, 0.18);
    parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0.4, L: 0.4, size: 50, k: 'ring', drag: 0 });
    emit(p.x, p.y, 26, { k: 'spark', sp: 240, life: 0.6, size: 2.5, col: '#ffd23f' });
    emit(p.x, p.y, 10, { k: 'debris', sp: 150, life: 0.8, size: 5, col: '#8a6a3a', drag: 2 });
    emit(p.x, p.y, 8, { k: 'smoke', sp: 40, life: 0.9, size: 12, col: '#c9b48a' });
    fx.push({ k: 'txt', x: p.x, y: p.y - R - 8, txt: '空投補給！升任士官長', t: 1.8, T: 1.8, col: '#d48a00', side: p.s });
    SFX.play('thud'); shake = Math.max(shake, 3);
  } });
  SFX.play('plane');
}
function promoteCrossed() {
  for (const p of alive())
    if (p.T.locked && crossed(p.s, p.y)) {
      p.T = TT[p.s].P2; p.hp = p.T.hp;   // 升官後滿血（3 心）
      airdrop(p);
    }
}

