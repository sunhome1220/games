// ----- 物理 -----
const inRiver = p => p.y > gy(4) && p.y < gy(5);
function bounds(p) {
  if (p.T.palace) return p.s ? [gx(3), gy(0), gx(5), gy(2)] : [gx(3), gy(7), gx(5), gy(9)];
  return [R, R, W - R, H - R];
}
function moveOne(p, dt) {
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 0) {
    const ns = Math.max(0, sp - FR * (inRiver(p) ? RIVER_FR : 1) * dt);
    p.vx *= ns / sp; p.vy *= ns / sp;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  const [x0, y0, x1, y1] = bounds(p);
  let bump = 0;   // 撞牆速度（給音效用）
  if (p.x < x0) { p.x = x0; bump = Math.abs(p.vx); p.vx = -p.vx * 0.6; }
  if (p.x > x1) { p.x = x1; bump = Math.abs(p.vx); p.vx = -p.vx * 0.6; }
  if (p.y < y0) { p.y = y0; bump = Math.max(bump, Math.abs(p.vy)); p.vy = -p.vy * 0.6; }
  if (p.y > y1) { p.y = y1; bump = Math.max(bump, Math.abs(p.vy)); p.vy = -p.vy * 0.6; }
  return bump;
}
function physics(dt) {
  const ps = alive();
  for (const p of ps) {
    const bump = moveOne(p, dt), sp = Math.hypot(p.vx, p.vy);
    if (bump > 100) bumpFX(p.x, p.y, bump);
    if (sp > 40) p.hd = Math.atan2(p.vy, p.vx);
    if (sp > 150 && Math.random() < 0.15)   // 車尾揚起塵土（河道是水花）
      emit(p.x - Math.cos(p.hd) * R, p.y - Math.sin(p.hd) * R, 1,
           { k: 'smoke', sp: 30, life: 0.6, size: 7, col: inRiver(p) ? '#9cc3d5' : '#b89a6a', dir: p.hd + Math.PI, spread: 1.5 });
  }
}
