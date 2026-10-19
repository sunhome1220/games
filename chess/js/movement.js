// ----- 定點移動：每次移動都停在棋盤交叉點上 -----
const fwd = p => p.s ? 1 : -1;
const crossed = (s, y) => s ? y > gy(4.5) : y < gy(4.5);
// 只能走一格的情況：未過河的兵（只能往前）
const oneStep = p => p.T.locked;
// 這顆棋子可以停的交叉點（帥／將限九宮）
function pointsFor(p) {
  const pts = [], [x0, y0, x1, y1] = bounds(p);
  for (let c = 0; c <= 8; c++)
    for (let r = 0; r <= 9; r++) {
      const x = gx(c), y = gy(r);
      if (p.T.aa && crossed(p.s, y)) continue;   // 相／象不能過河
      if (p.T.palace && (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1)) continue;
      pts.push([x, y]);
    }
  return pts;
}
// 可以走的點：空的交叉點、在移動力範圍內、直線路徑不穿過其他棋子（不會撞開別人）
function pathClear(p, x, y) {
  const dx = x - p.x, dy = y - p.y, d2 = dx * dx + dy * dy;
  return alive().every(q => {
    if (q === p) return true;
    const t = Math.max(0, Math.min(1, ((q.x - p.x) * dx + (q.y - p.y) * dy) / d2));
    return Math.hypot(q.x - (p.x + t * dx), q.y - (p.y + t * dy)) >= R * 1.8;
  });
}
// 相／象走田字、傌走日字；一個合法落點都沒有（被塞象眼／蹩馬腳／落點被佔）時，改為可往上下左右走一步
function movesFor(p) {
  const m = movesBase(p);
  if (m.length || !(p.T.knight || p.T.aa)) return m;
  const pts = pointsFor(p), at = (x, y) => ([qx, qy]) => Math.abs(qx - x) < 1 && Math.abs(qy - y) < 1;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([sx, sy]) => [p.x + sx * C, p.y + sy * C])
    .filter(([x, y]) => pts.some(at(x, y)) && !alive().some(q => at(x, y)([q.x, q.y])));
}
function movesBase(p) {
  const pts = pointsFor(p), at = (x, y) => ([qx, qy]) => Math.abs(qx - x) < 1 && Math.abs(qy - y) < 1;
  let cand;
  if (p.T.guard) cand = [[1, 1], [1, -1], [-1, 1], [-1, -1]]   // 士：九宮內斜走一格
                         .map(([sx, sy]) => [p.x + sx * C, p.y + sy * C]).filter(([x, y]) => pts.some(at(x, y)));
  else if (p.T.knight) {   // 傌：走「日」字，蹩馬腳（長邊方向緊鄰的那一格有棋子）就走不了；可跳過其他棋子
    const occ = (x, y) => alive().some(q => q !== p && at(x, y)([q.x, q.y]));
    return [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]]
      .filter(([sx, sy]) => !occ(p.x + (Math.abs(sx) === 2 ? Math.sign(sx) : 0) * C, p.y + (Math.abs(sy) === 2 ? Math.sign(sy) : 0) * C))
      .map(([sx, sy]) => [p.x + sx * C, p.y + sy * C]).filter(([x, y]) => pts.some(at(x, y)) && !occ(x, y));
  }
  else if (p.T.aa) cand = [[2, 2], [2, -2], [-2, 2], [-2, -2]]   // 相／象：走「田」字（斜走兩格），象眼（中間格）有棋子就被塞住
                         .map(([sx, sy]) => [p.x + sx * C, p.y + sy * C]).filter(([x, y]) => pts.some(at(x, y)));
  else if (oneStep(p)) cand = (p.T.locked ? [[0, fwd(p)]] : [[1, 0], [-1, 0], [0, 1], [0, -1]])
                         .map(([sx, sy]) => [p.x + sx * C, p.y + sy * C]).filter(([x, y]) => pts.some(at(x, y)));
  else cand = pts.filter(([x, y]) => { const d = Math.hypot(x - p.x, y - p.y); return d > 1 && d <= p.T.dist + 1 && (!(p.T.line || p.T.moveLine) || Math.abs(x - p.x) < 1 || Math.abs(y - p.y) < 1); });
  if (p.T.id === 'P2') cand = cand.filter(([x, y]) => (y - p.y) * fwd(p) > -1);   // 過河的兵（士官長）：可前進或橫移，不能往後退
  return cand.filter(([x, y]) => !alive().some(q => at(x, y)([q.x, q.y])) && pathClear(p, x, y));
}
// 以初速 v 沿 (ux,uy) 直線滑行的距離（含河道摩擦、不考慮邊界反彈）
function travel(p, ux, uy, v) {
  let x = p.x, y = p.y, sp = v, d = 0;
  const dt = 1 / 240;
  while (sp > 0) {
    sp = Math.max(0, sp - FR * (inRiver({ y }) ? RIVER_FR : 1) * dt);
    x += ux * sp * dt; y += uy * sp * dt; d += sp * dt;
  }
  return d;
}
// 剛好停在距離 d 處所需的初速（二分法）
function speedFor(p, ux, uy, d) {
  let lo = 0, hi = 3000;
  for (let i = 0; i < 24; i++) {
    const v = (lo + hi) / 2;
    if (travel(p, ux, uy, v) < d) lo = v; else hi = v;
  }
  return (lo + hi) / 2;
}
// 停下後所有棋子對齊到最近的空交叉點（近的先選）
function snapTargets() {
  const ps = alive(), taken = new Set(), res = new Map();
  const near = p => Math.min(...pointsFor(p).map(([x, y]) => Math.hypot(x - p.x, y - p.y)));
  for (const p of ps.sort((a, b) => near(a) - near(b))) {
    let best = null, bd = Infinity;
    for (const [x, y] of pointsFor(p)) {
      if (taken.has(x + ',' + y)) continue;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    taken.add(best.join()); res.set(p, { fx: p.x, fy: p.y, tx: best[0], ty: best[1] });
  }
  return res;
}
let snaps = null, snapT = 0;
const SNAP_T = 0.2;
function startSettle() {
  pieces.forEach(p => p.vx = p.vy = 0);
  snaps = snapTargets();
  if ([...snaps.values()].every(s => Math.hypot(s.tx - s.fx, s.ty - s.fy) < 0.5)) { finishSettle(); return; }
  state = 'settle'; snapT = SNAP_T;
}
function finishSettle() {
  for (const [p, s] of snaps) { p.x = s.tx; p.y = s.ty; }
  snaps = null; onStop();
}

