// Pullback Rush（直式鳥瞰）邏輯與繪圖。參數見 config.js，音效見 audio.js
// 回合：選一台己方戰車 → ① 向後拖曳蓄力，放手衝刺 ② 向後拖曳瞄準，放手開砲
(() => {
  const C = CONFIG, W = C.world.w, H = C.world.h, PU = C.powerups;
  const $ = id => document.getElementById(id);
  const canvas = $('stage'), ctx = canvas.getContext('2d');
  const SIDES = ['red', 'blue'];
  const COLORS = {
    red:  { body: '#e8493f', dark: '#a52e27', light: '#ff9a8f', name: '紅隊' },
    blue: { body: '#3a8fe0', dark: '#2260a0', light: '#9bd0ff', name: '藍隊' },
  };
  const PHASE = { move: '移動', aim: '瞄準' };
  const HINT = { move: '點戰車・拉後放手衝', aim: '拉後放手鎖定', meter: '綠區按下！' };
  const PU_COLOR = { range: '#3a8fe0', power: '#e8493f', repair: '#3fbf5a' };
  const PU_NAME = { range: '射程 +', power: '威力 +', repair: '修復 +' };

  let g;
  // 面對面模式：手機平放在兩人中間，藍隊（上方玩家）看到的文字與按鈕轉 180° 方便閱讀
  let face = false;
  try { face = localStorage.getItem('pbr-face') === '1'; } catch (_) {}
  function rot(cond, cx, cy, fn) {
    if (!cond) return fn();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI); ctx.translate(-cx, -cy); fn(); ctx.restore();
  }

  const enemy = s => (s === 'red' ? 'blue' : 'red');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const castleRect = s => {
    const x = (W - C.castle.w) / 2;
    return { x, y: s === 'blue' ? 0 : H - C.castle.h, w: C.castle.w, h: C.castle.h };
  };
  // 主堡被擊中的部位：tower 裝甲（四角塔樓）、gate 弱點（正面城門）、wall 一般城牆
  function castleZone(side, x, y) {
    const R = castleRect(side), tr = C.castle.tower.r;
    for (const [cx, cy] of [[R.x, R.y], [R.x + R.w, R.y], [R.x, R.y + R.h], [R.x + R.w, R.y + R.h]])
      if (Math.hypot(x - cx, y - cy) < tr) return 'tower';
    const front = side === 'blue' ? R.y + R.h : R.y, gt = C.castle.gate;
    if (Math.abs(x - (R.x + R.w / 2)) < gt.halfW && Math.abs(y - front) < gt.depth) return 'gate';
    return 'wall';
  }
  function nearestOnRect(r, x, y) { return { x: clamp(x, r.x, r.x + r.w), y: clamp(y, r.y, r.y + r.h) }; }
  const alive = s => g.tanks.filter(t => t.side === s && t.alive);
  const dmgOf = t => C.attack.damage + t.powerBonus;
  const rangeOf = t => C.attack.range + t.rangeBonus;

  function newGame() {
    g = { meter: null, state: 'move', turn: 'red', round: 0, t: 0, over: null, overWhy: '', tanks: [], castles: {}, shells: [], pickups: [],
      parts: [], texts: [], drag: null, banner: null, resolveT: 0, shot: null, sel: null };
    for (const s of SIDES) {
      const y = s === 'red' ? H - C.tank.startOffset : C.tank.startOffset;
      C.tank.startX.forEach((x, i) => g.tanks.push({ side: s, id: s + i, alive: true, hp: C.tank.hp, x, y, vx: 0, vy: 0,
        angle: s === 'red' ? -Math.PI / 2 : Math.PI / 2, turret: s === 'red' ? -Math.PI / 2 : Math.PI / 2,
        tread: 0, pull: 0, squash: 0, recoil: 0, flash: 0, motor: null, tickAcc: 0, rangeBonus: 0, powerBonus: 0 }));
      g.castles[s] = { hp: C.castle.hp, shake: 0, flash: 0, crack: 0 };
    }
    for (let i = 0; i < PU.initial; i++) spawnPickup();
    g.sel = alive('red')[0];
    setBanner(`輪到${COLORS.red.name}！`, '點選一台戰車，先移動再瞄準');
  }
  function setBanner(text, sub) { g.banner = { text, sub, t: 1.4 }; }

  // ---------- 增益寶箱 ----------
  function spawnPickup() {
    const z = PU.zone, kinds = Object.keys(PU.types);
    const total = kinds.reduce((a, k) => a + PU.types[k].weight, 0);
    let r = Math.random() * total, kind = kinds[0];
    for (const k of kinds) { r -= PU.types[k].weight; if (r <= 0) { kind = k; break; } }
    for (let tries = 0; tries < 40; tries++) {
      const x = z.xMargin + Math.random() * (W - 2 * z.xMargin), y = z.yMin + Math.random() * (z.yMax - z.yMin);
      const clear = g.tanks.every(t => !t.alive || Math.hypot(t.x - x, t.y - y) > C.tank.r + 50)
        && g.pickups.every(p => Math.hypot(p.x - x, p.y - y) > 70);
      if (clear) { g.pickups.push({ kind, x, y, born: g.t }); return; }
    }
  }
  function checkPickups(t) {
    for (const p of g.pickups.slice()) {
      if (Math.hypot(t.x - p.x, t.y - p.y) > C.tank.r + PU.pickupRadius) continue;
      g.pickups.splice(g.pickups.indexOf(p), 1);
      const def = PU.types[p.kind]; let msg;
      if (p.kind === 'range') { t.rangeBonus = Math.min(def.add * def.max, t.rangeBonus + def.add); msg = `射程 +${def.add}`; }
      else if (p.kind === 'power') { t.powerBonus = Math.min(def.add * def.max, t.powerBonus + def.add); msg = `威力 +${def.add}`; }
      else { t.hp = Math.min(C.tank.hp, t.hp + def.heal); msg = `修復 +${def.heal}`; }
      Sfx.pickup(); burst(p.x, p.y, 18, PU_COLOR[p.kind], 200);
      floatText(t.x, t.y - 50, msg + '！', PU_COLOR[p.kind] === '#e8493f' ? '#ffb0a8' : '#fff', 24);
    }
  }

  // 該戰車與敵方主堡的距離（到主堡矩形最近點）
  function castleDist(t) {
    const p = nearestOnRect(castleRect(enemy(t.side)), t.x, t.y);
    return Math.hypot(p.x - t.x, p.y - t.y);
  }
  const inRange = t => castleDist(t) <= rangeOf(t);

  // ---------- 輸入（滑鼠 + 觸控，皆走 Pointer Events） ----------
  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  canvas.addEventListener('pointerdown', e => {
    if (g && g.state === 'meter') { // 罰球條：點螢幕任何地方定住指針
      if (g.t - g.meter.tStart > C.accuracy.startDelay) lockMeter();
      e.preventDefault(); return;
    }
    if (!g || (g.state !== 'move' && g.state !== 'aim') || g.drag) return; // 同時只接受一個指標
    const p = toWorld(e);
    // 移動階段可選任一台己方戰車；瞄準階段只能操作剛移動過的那台
    const cands = g.state === 'move' ? alive(g.turn) : [g.sel];
    let t = null, best = 90;
    for (const c of cands) { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d <= best) { best = d; t = c; } }
    if (!t) return;
    Sfx.init();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (g.state === 'move' && g.sel !== t) { g.sel = t; Sfx.click(); }
    g.drag = { id: e.pointerId, sx: p.x, sy: p.y, bx: t.x, by: t.y, notch: 0 };
    g.state = g.state === 'move' ? 'charging' : 'aiming';
    if (g.state === 'charging') Sfx.chargeStart();
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!g || !g.drag || e.pointerId !== g.drag.id) return;
    const p = toWorld(e), d = g.drag;
    const dx = d.sx - p.x, dy = d.sy - p.y; // 拉的反方向 = 前進／砲管方向
    if (g.state === 'charging') setPull(dx, dy);
    else if (g.state === 'aiming') setAim(dx, dy);
    e.preventDefault();
  });
  const endDrag = e => {
    if (!g || !g.drag || e.pointerId !== g.drag.id) return;
    if (e.type === 'pointercancel') cancelDrag(); else release();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (g && g.state === 'meter' && (e.code === 'Space' || e.code === 'Enter') && g.t - g.meter.tStart > C.accuracy.startDelay) { lockMeter(); e.preventDefault(); }
  });

  function setPull(dx, dy) {
    const t = g.sel, d = g.drag;
    const len = Math.hypot(dx, dy), pull = Math.min(len, C.pull.max);
    t.pull = pull;
    if (len > 4) t.angle = Math.atan2(dy, dx);
    const k = pull * C.pull.bodyShift;
    t.x = clamp(d.bx - Math.cos(t.angle) * k, C.tank.r, W - C.tank.r);
    t.y = clamp(d.by - Math.sin(t.angle) * k, C.tank.r, H - C.tank.r);
    const p = pull / C.pull.max;
    t.squash = p;
    const notch = Math.floor(pull / 12);
    if (notch !== d.notch) { if (pull > 0) Sfx.ratchet(p); d.notch = notch; }
    Sfx.chargeUpdate(p);
  }
  function setAim(dx, dy) {
    const t = g.sel, d = g.drag;
    d.len = Math.hypot(dx, dy);
    if (d.len < C.attack.aimMin) return;
    t.turret = Math.atan2(dy, dx);
    const notch = Math.floor(t.turret / 0.1);
    if (notch !== d.notch) { Sfx.ratchet(0.2); d.notch = notch; }
  }
  function cancelDrag() {
    const t = g.sel;
    if (g.state === 'charging') { Sfx.chargeStop(); t.x = g.drag.bx; t.y = g.drag.by; t.pull = 0; t.squash = 0; g.state = 'move'; }
    else { g.state = 'aim'; }
    Sfx.cancel(); g.drag = null;
  }
  function release() {
    const t = g.sel, d = g.drag;
    if (g.state === 'charging') {
      if (t.pull < C.pull.min) { cancelDrag(); return; }
      launch(t, (t.pull - C.pull.min) / (C.pull.max - C.pull.min));
    } else {
      if (!(d.len >= C.attack.aimMin)) { cancelDrag(); return; }
      g.drag = null; startMeter(t);
    }
  }
  function launch(t, p) {
    const v0 = lerp(C.motor.vMin, C.motor.vMax, clamp(p, 0, 1));
    t.motor = { v0, t: 0, phase: 'accel' };
    t.vx = t.vy = 0; t.pull = 0; t.tickAcc = 0;
    g.drag = null; g.state = 'dashing';
    Sfx.launch(p);
    burst(t.x - Math.cos(t.angle) * 40, t.y - Math.sin(t.angle) * 40, 10, '#d9c9a8', 90);
  }
  // 沿砲管方向找第一個目標的距離（敵方戰車或主堡），找不到就用到主堡的距離
  function aimDistance(t) {
    const dx = Math.cos(t.turret), dy = Math.sin(t.turret), R = castleRect(enemy(t.side));
    let x = t.x + dx * C.tank.barrelLen, y = t.y + dy * C.tank.barrelLen;
    for (let d = 0; d < rangeOf(t); d += 4) {
      x += dx * 4; y += dy * 4;
      if (x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h) return d + C.tank.barrelLen;
      if (g.tanks.some(o => o.alive && o.side !== t.side && Math.hypot(x - o.x, y - o.y) < C.tank.r)) return d + C.tank.barrelLen;
    }
    return castleDist(t);
  }
  function startMeter(t) {
    const A = C.accuracy, dist = aimDistance(t), k = clamp((dist - A.near) / (A.far - A.near), 0, 1);
    const speed = lerp(A.speedNear, A.speedFar, k);
    g.meter = { tank: t, dist, k, speed, zone: lerp(A.zoneNear, A.zoneFar, k), maxErr: lerp(A.errNear, A.errFar, k) * Math.PI / 180,
      tStart: g.t, t0: g.t - Math.random() * 2 / speed, force: null }; // 隨機起點，沒辦法背時機
    g.state = 'meter'; Sfx.ratchet(0.6);
  }
  function meterValue() { // 0..1 來回擺動
    const m = g.meter; if (m.force != null) return m.force;
    const p = ((g.t - m.t0) * m.speed) % 2; return p < 1 ? p : 2 - p;
  }
  function lockMeter() {
    const m = g.meter, t = m.tank, off = meterValue() * 2 - 1;
    let err = 0;
    if (Math.abs(off) > m.zone) err = Math.sign(off) * (Math.abs(off) - m.zone) / (1 - m.zone) * m.maxErr;
    t.turret += err; g.meter = null;
    const deg = Math.abs(err) * 180 / Math.PI;
    if (deg < 0.01) floatText(t.x, t.y - 70, '完美！', '#7dff8a', 28);
    else floatText(t.x, t.y - 70, `${err > 0 ? '偏右' : '偏左'} ${deg.toFixed(0)}°`, '#fff', 22);
    fire(t);
  }
  function skipMove() {
    if (!g || g.state !== 'move') return;
    Sfx.click(); g.state = 'aim'; setBanner('瞄準！', '向後拉動砲塔，放手開砲');
  }

  // ---------- 更新 ----------
  function update(dt) {
    g.t += dt;
    if (g.banner) { g.banner.t -= dt; if (g.banner.t <= 0) g.banner = null; }
    for (const s of SIDES) { const c = g.castles[s]; c.shake = Math.max(0, c.shake - dt); c.flash = Math.max(0, c.flash - dt); }
    for (const t of g.tanks) {
      t.recoil = Math.max(0, t.recoil - dt * 5); t.flash = Math.max(0, t.flash - dt);
      if (!(g.state === 'charging' && g.sel === t)) t.squash = Math.max(0, t.squash - dt * 5);
    }
    if (g.state === 'dashing') updateDash(dt);
    if (g.state === 'meter' && g.t - g.meter.tStart > C.accuracy.timeout) lockMeter();
    updateShells(dt);
    if (g.state === 'resolving') { g.resolveT -= dt; if (g.resolveT <= 0) nextTurn(); }
    if (g.state === 'over') { g.overT -= dt; if (g.overT <= 0 && !g.resultShown) showResult(); }
    for (const p of g.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vy *= 0.98; }
    g.parts = g.parts.filter(p => p.life > 0);
    for (const t of g.texts) { t.life -= dt; t.y -= 28 * dt; }
    g.texts = g.texts.filter(t => t.life > 0);
  }

  // 戰車與其他戰車／兩座主堡／場邊碰撞，回傳撞擊速度
  function collideTank(t) {
    const e = C.motor.restitution, r = C.tank.r;
    let impact = 0;
    const bounce = (nx, ny) => {
      const vn = t.vx * nx + t.vy * ny;
      if (vn < 0) { t.vx -= (1 + e) * vn * nx; t.vy -= (1 + e) * vn * ny; impact = Math.max(impact, -vn); }
    };
    for (const o of g.tanks) {
      if (o === t || !o.alive) continue;
      const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 0.01, min = r * 2;
      if (d < min) { const nx = dx / d, ny = dy / d; t.x = o.x + nx * min; t.y = o.y + ny * min; bounce(nx, ny); }
    }
    for (const s of SIDES) {
      const R = castleRect(s), p = nearestOnRect(R, t.x, t.y), dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
      if (d < r) {
        const nx = d > 0.01 ? dx / d : 0, ny = d > 0.01 ? dy / d : (s === 'blue' ? 1 : -1);
        t.x = p.x + nx * r; t.y = p.y + ny * r; bounce(nx, ny);
      }
    }
    if (t.x < r) { t.x = r; bounce(1, 0); } if (t.x > W - r) { t.x = W - r; bounce(-1, 0); }
    if (t.y < r) { t.y = r; bounce(0, 1); } if (t.y > H - r) { t.y = H - r; bounce(0, -1); }
    return impact;
  }

  function updateDash(dt) {
    const t = g.sel, m = t.motor;
    m.t += dt;
    let speed = Math.hypot(t.vx, t.vy);
    if (m.phase === 'accel') {
      speed = m.v0 * Math.min(1, m.t / C.motor.accelTime); // 發條釋放，快速加速
      t.vx = Math.cos(t.angle) * speed; t.vy = Math.sin(t.angle) * speed;
      if (m.t >= C.motor.accelTime) m.phase = 'glide';
    } else {
      const ns = Math.max(0, speed - C.motor.decel * dt);   // 滑行減速
      const k = speed > 0 ? ns / speed : 0; t.vx *= k; t.vy *= k; speed = ns;
    }
    const mx = t.vx * dt, my = t.vy * dt, dist = Math.hypot(mx, my);
    t.x += mx; t.y += my; t.tread += dist;
    const impact = collideTank(t);
    if (impact > 0) {
      m.phase = 'glide';
      if (impact > 80) { Sfx.bump(); burst(t.x + Math.cos(t.angle) * 30, t.y + Math.sin(t.angle) * 30, 8, '#ffd24a', 160); }
      if (Math.hypot(t.vx, t.vy) > 30) t.angle = Math.atan2(t.vy, t.vx); // 被撞偏後車頭轉向新方向
    }
    checkPickups(t);
    // 「卡、卡、卡」：依行進距離觸發，速度快則間隔短
    t.tickAcc += dist;
    if (t.tickAcc >= 28) { t.tickAcc -= 28; Sfx.tick(speed / C.motor.vMax); }
    if (speed > 120 && Math.random() < dt * 40) burst(t.x - Math.cos(t.angle) * 36, t.y - Math.sin(t.angle) * 36, 1, '#d9c9a8', 50);
    if (m.phase === 'glide' && Math.hypot(t.vx, t.vy) < C.motor.stopSpeed) {
      t.vx = t.vy = 0; t.motor = null;
      g.state = 'aim';
      setBanner('瞄準！', inRange(t) ? '主堡進入射程' : '主堡還在射程外');
    }
  }

  // ---------- 攻擊 ----------
  function fire(t) {
    const dx = Math.cos(t.turret), dy = Math.sin(t.turret), L = C.tank.barrelLen;
    g.shot = { side: t.side, hit: false };
    g.shells.push({ owner: t, side: t.side, x: t.x + dx * L, y: t.y + dy * L, dx, dy, traveled: 0, range: rangeOf(t), dmg: dmgOf(t), done: false });
    g.state = 'firing'; t.recoil = 1;
    Sfx.shoot();
    burst(t.x + dx * (L + 4), t.y + dy * (L + 4), 10, '#fff2a8', 160, 0.25);
  }
  function updateShells(dt) {
    for (const s of g.shells) {
      if (s.done) continue;
      let left = C.attack.shellSpeed * dt;
      while (left > 0 && !s.done) {
        const step = Math.min(5, left); left -= step;
        s.x += s.dx * step; s.y += s.dy * step; s.traveled += step;
        const hit = shellHit(s);
        if (hit) endShell(s, hit);
        else if (s.traveled >= s.range) endShell(s, { why: 'range' });
      }
      if (!s.done && Math.random() < dt * 60) burst(s.x, s.y, 1, '#ffd24a', 30, 0.3);
    }
    g.shells = g.shells.filter(s => !s.done);
  }
  function shellHit(s) {
    const R = castleRect(enemy(s.side));
    if (s.x >= R.x && s.x <= R.x + R.w && s.y >= R.y && s.y <= R.y + R.h) return { why: 'castle', zone: castleZone(enemy(s.side), s.x, s.y) };
    for (const t of g.tanks) {
      if (!t.alive || t.side === s.side) continue; // 砲彈穿過己方戰車
      if (Math.hypot(s.x - t.x, s.y - t.y) < C.tank.r) return { why: 'tank', tank: t };
    }
    if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) return { why: 'out' };
    return null;
  }
  function endShell(s, h) {
    s.done = true;
    if (g.shot.hit) { /* 一發砲彈只會結算一次 */ }
    else if (h.why === 'castle') { g.shot.hit = true; hitCastle(enemy(s.side), s, h.zone); }
    else if (h.why === 'tank') { g.shot.hit = true; hitTank(h.tank, s); }
    else {
      Sfx.miss(); burst(s.x, s.y, 10, '#9a8f7a', 120);
      floatText(clamp(s.x, 80, W - 80), clamp(s.y, 130, H - 130), h.why === 'range' ? '射程不足！' : '打偏了！', '#fff', 20);
    }
    if (g.state === 'firing' && !g.over) { g.state = 'resolving'; g.resolveT = C.attack.resolveDelay; }
  }
  function hitCastle(side, s, zone) {
    const c = g.castles[side];
    if (c.hp <= 0) return;
    const dy = side === 'blue' ? 44 : -44;
    let dmg = s.dmg;
    if (zone === 'gate') dmg = s.dmg * C.castle.gate.mult;
    else if (zone === 'tower') dmg = Math.max(0, s.dmg - C.castle.tower.reduce);
    if (dmg <= 0) { // 打在裝甲塔樓上：被彈開
      Sfx.bump(); Sfx.miss(); burst(s.x, s.y, 16, '#cfd6de', 220);
      floatText(s.x, s.y + dy, '裝甲彈開！', '#cfd6de', 24);
      return;
    }
    c.hp = Math.max(0, c.hp - dmg);
    c.shake = C.castle.hitShake; c.flash = 0.3; c.crack++;
    Sfx.hit();
    burst(s.x, s.y, 26, '#ff9a2e', 260); burst(s.x, s.y, 14, '#fff2a8', 200);
    if (zone === 'gate') floatText(s.x, s.y + dy + (side === 'blue' ? 28 : -28), '弱點命中！', '#ffd24a', 24);
    floatText(s.x, s.y + dy, '-' + dmg, '#fff', 36);
    if (c.hp <= 0) {
      const R = castleRect(side); burst(R.x + R.w / 2, R.y + R.h / 2, 60, '#ff7a2e', 360);
      endGame(enemy(side), `${COLORS[side].name}的主堡被攻陷了`);
    }
  }
  function hitTank(t, s) {
    t.hp = Math.max(0, t.hp - s.dmg); t.flash = 0.3;
    Sfx.hit(); burst(s.x, s.y, 20, '#ff9a2e', 220);
    floatText(t.x, t.y - 50, '-' + s.dmg, '#fff', 30);
    if (t.hp <= 0) {
      t.alive = false; Sfx.boom(); burst(t.x, t.y, 50, '#ff7a2e', 320); burst(t.x, t.y, 24, '#333', 220);
      floatText(t.x, t.y - 80, '戰車被擊毀！', '#ffd24a', 22);
      if (!alive(t.side).length) endGame(enemy(t.side), `${COLORS[t.side].name}的戰車全數被擊毀`);
    }
  }
  function endGame(winner, why) {
    g.over = winner; g.overWhy = why; g.state = 'over'; g.overT = 1.3; g.resultShown = false;
  }
  function nextTurn() {
    if (g.over) return;
    g.turn = enemy(g.turn); g.state = 'move'; g.shot = null;
    g.sel = alive(g.turn)[0];
    if (g.turn === 'red') { // 每過一輪補一個寶箱
      g.round++;
      if (g.round % PU.spawnEveryRound === 0 && g.pickups.length < PU.maxOnField) spawnPickup();
    }
    setBanner(`輪到${COLORS[g.turn].name}！`, '點選一台戰車，先移動再瞄準');
  }

  // ---------- 特效 ----------
  function burst(x, y, n, color, speed, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * speed;
      g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random()), max: life * 1.5, color, size: 2 + Math.random() * 4 });
    }
  }
  function floatText(x, y, str, color, size = 22) { g.texts.push({ x, y, str, color, size, life: 1.2, flip: face && g.turn === 'blue' }); }

  // ---------- 繪圖 ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawBackground() {
    for (let y = 0; y < H; y += 40) for (let x = 0; x < W; x += 40) {
      ctx.fillStyle = ((x + y) / 40) % 2 ? '#a5d86f' : '#9ccf66'; ctx.fillRect(x, y, 40, 40);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 4; ctx.setLineDash([18, 14]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 95, 0, 7); ctx.stroke();
  }
  // 增益寶箱：彩色禮盒 + 種類圖示（射程＝同心圓、威力＝閃電、修復＝十字）
  function drawPickup(p) {
    const col = PU_COLOR[p.kind], bob = Math.sin((g.t - p.born) * 4) * 3, s = 24;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(4, 8, s, s * .85, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = .25 + .15 * Math.sin(g.t * 5); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, s + 12, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.translate(0, bob);
    ctx.fillStyle = col; rr(-s, -s, s * 2, s * 2, 8); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(-4, -s, 8, s * 2); ctx.fillRect(-s, -4, s * 2, 8); // 緞帶
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
    if (p.kind === 'range') { ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill(); }
    else if (p.kind === 'power') { ctx.beginPath(); ctx.moveTo(3, -10); ctx.lineTo(-6, 2); ctx.lineTo(0, 2); ctx.lineTo(-3, 10); ctx.lineTo(7, -3); ctx.lineTo(1, -3); ctx.closePath(); ctx.fill(); }
    else { ctx.fillRect(-3, -9, 6, 18); ctx.fillRect(-9, -3, 18, 6); }
    ctx.restore();
  }
  function drawCastle(side) {
    const c = g.castles[side], col = COLORS[side], R = castleRect(side), tr = C.castle.tower.r, gt = C.castle.gate;
    let ox = 0, oy = 0;
    if (c.shake > 0) { const k = c.shake / C.castle.hitShake; ox = Math.sin(g.t * 70) * 8 * k; oy = Math.cos(g.t * 90) * 5 * k; }
    ctx.save(); ctx.translate(ox, oy);
    const fill = c.flash > 0 && Math.floor(c.flash * 30) % 2 === 0 ? '#fff' : col.body;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; rr(R.x + 6, R.y + 8, R.w, R.h, 10); ctx.fill();
    ctx.fillStyle = fill; rr(R.x, R.y, R.w, R.h, 10); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = col.dark; ctx.stroke();
    ctx.strokeStyle = col.dark; ctx.globalAlpha = .35; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(R.x, R.y + i * R.h / 4); ctx.lineTo(R.x + R.w, R.y + i * R.h / 4); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // 四角裝甲塔樓：鋼灰色 + 鉚釘（打到會被彈開）
    for (const [tx, ty] of [[R.x, R.y], [R.x + R.w, R.y], [R.x, R.y + R.h], [R.x + R.w, R.y + R.h]]) {
      ctx.fillStyle = '#8d97a3'; ctx.beginPath(); ctx.arc(tx, ty, tr, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4b535d'; ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = '#c5ccd4'; ctx.beginPath(); ctx.arc(tx, ty, tr - 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#4b535d';
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.arc(tx + Math.cos(a) * (tr - 5), ty + Math.sin(a) * (tr - 5), 2.5, 0, 7); ctx.fill(); }
    }
    // 正面城門＝弱點：閃爍的紅黃靶心
    const gx = R.x + R.w / 2, gy = side === 'blue' ? R.y + R.h - 16 : R.y + 16, pulse = 1 + Math.sin(g.t * 6) * 0.12;
    ctx.fillStyle = '#5a3a1e'; rr(gx - gt.halfW, side === 'blue' ? R.y + R.h - 34 : R.y, gt.halfW * 2, 34, 8); ctx.fill();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(gx, gy, 24 * pulse, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    for (const [r2, col2] of [[16, '#e8312a'], [11, '#fff'], [6, '#e8312a'], [2.5, '#ffd24a']]) { ctx.fillStyle = col2; ctx.beginPath(); ctx.arc(gx, gy, r2, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3;
    for (let i = 0; i < c.crack; i++) {
      const cx = R.x + 36 + i * 34, cy = R.y + 14;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 8, cy + 18); ctx.lineTo(cx - 4, cy + 34); ctx.stroke();
    }
    ctx.restore();
    const hy = side === 'blue' ? 46 : H - 46;
    rot(face && side === 'blue', 78, hy, () => {
      ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(8, hy - 24, 144, 48, 12); ctx.fill();
      for (let i = 0; i < C.castle.hp; i++) drawHeart(26 + i * 25, hy, 10, i < c.hp ? '#ff4a6a' : 'rgba(255,255,255,.25)');
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(c.hp, 128, hy + 8);
    });
  }
  function drawHeart(x, y, s, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y + s * .8);
    ctx.bezierCurveTo(x - s * 1.3, y - s * .2, x - s * .5, y - s * 1.1, x, y - s * .3);
    ctx.bezierCurveTo(x + s * .5, y - s * 1.1, x + s * 1.3, y - s * .2, x, y + s * .8); ctx.fill();
  }

  function drawTank(t) {
    const col = COLORS[t.side], L = C.tank.hullLen, Wd = C.tank.hullWid;
    const speed = Math.hypot(t.vx, t.vy);
    ctx.save(); ctx.translate(t.x, t.y);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.save(); ctx.translate(5, 7); ctx.rotate(t.angle); rr(-L / 2, -Wd / 2 - 8, L, Wd + 16, 10); ctx.fill(); ctx.restore();
    ctx.rotate(t.angle);
    if (speed > 150) { // 速度線
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) { const len = 26 + speed / C.motor.vMax * 80 + Math.random() * 16; ctx.beginPath(); ctx.moveTo(-L / 2 - 4, i * 13); ctx.lineTo(-L / 2 - 4 - len, i * 13); ctx.stroke(); }
    }
    // 履帶（隨行進距離捲動的紋路）
    for (const sy of [-1, 1]) {
      ctx.fillStyle = '#2f2f35'; rr(-L / 2, sy * (Wd / 2 + 1) - 8, L, 16, 6); ctx.fill();
      ctx.strokeStyle = '#6a6a74'; ctx.lineWidth = 3;
      const off = t.tread % 12;
      for (let x = -L / 2 + 4 + off; x < L / 2 - 2; x += 12) { ctx.beginPath(); ctx.moveTo(x, sy * (Wd / 2 + 1) - 7); ctx.lineTo(x, sy * (Wd / 2 + 1) + 7); ctx.stroke(); }
    }
    // 車體（蓄力時壓扁，受擊時閃白）
    const sq = t.squash, hurt = t.flash > 0 && Math.floor(t.flash * 30) % 2 === 0;
    ctx.save(); ctx.scale(1 - sq * 0.1, 1 + sq * 0.1);
    ctx.fillStyle = hurt ? '#fff' : col.body; rr(-L / 2 + 4, -Wd / 2, L - 8, Wd, 9); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = col.dark; ctx.stroke();
    ctx.fillStyle = col.dark; rr(-L / 2 + 8, -Wd / 2 + 6, 14, Wd - 12, 3); ctx.fill();
    ctx.restore();
    // 砲塔（可獨立旋轉）與砲管；威力加成時砲管變粗發紅
    ctx.rotate(t.turret - t.angle);
    const back = t.recoil * 9, bw = 10 + t.powerBonus * 3;
    ctx.fillStyle = t.powerBonus ? '#7a3a3a' : '#4a4a52'; rr(8 - back, -bw / 2, C.tank.barrelLen - 8, bw, 3); ctx.fill();
    ctx.fillStyle = '#2f2f35'; rr(C.tank.barrelLen - 14 - back, -bw / 2 - 2, 12, bw + 4, 3); ctx.fill();
    ctx.fillStyle = col.dark; ctx.beginPath(); ctx.arc(0, 0, 19, 0, 7); ctx.fill();
    ctx.fillStyle = col.light; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
    ctx.strokeStyle = col.dark; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(-2, 0, 5, 0, 7); ctx.fill();
    ctx.restore();
    // 生命值小方塊與增益圖示（顯示在車體下方）
    const py = t.y + 46;
    for (let i = 0; i < C.tank.hp; i++) {
      ctx.fillStyle = i < t.hp ? '#3fe05a' : 'rgba(0,0,0,.35)'; rr(t.x - 20 + i * 14, py, 12, 8, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    const nr = t.rangeBonus / PU.types.range.add, np = t.powerBonus / PU.types.power.add;
    for (let i = 0; i < nr; i++) { ctx.fillStyle = PU_COLOR.range; ctx.beginPath(); ctx.arc(t.x - 20 + i * 12 + 5, py + 18, 5, 0, 7); ctx.fill(); }
    for (let i = 0; i < np; i++) { ctx.fillStyle = PU_COLOR.power; ctx.beginPath(); ctx.moveTo(t.x + 8 + i * 13, py + 22); ctx.lineTo(t.x + 14 + i * 13, py + 22); ctx.lineTo(t.x + 11 + i * 13, py + 12); ctx.closePath(); ctx.fill(); }
  }
  // 目前選中戰車的射程圈、選取標記、蓄力箭頭與瞄準線
  function drawSelection() {
    const t = g.sel;
    if (!t || !t.alive || g.over || g.turn !== t.side) return;
    const side = t.side, phaseOn = ['move', 'charging', 'aim', 'aiming', 'meter'].includes(g.state);
    if (!phaseOn) return;
    ctx.strokeStyle = inRange(t) ? 'rgba(47,191,85,.8)' : 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
    ctx.beginPath(); ctx.arc(t.x, t.y, rangeOf(t), 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(t.x, t.y, C.tank.r + 12 + Math.sin(g.t * 6) * 2, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    if (g.state === 'charging') {
      const p = clamp(t.pull / C.pull.max, 0, 1), dx = Math.cos(t.angle), dy = Math.sin(t.angle);
      const len = 40 + p * 150, x2 = t.x + dx * len, y2 = t.y + dy * len;
      ctx.strokeStyle = `hsl(${120 - p * 120},90%,50%)`; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(t.x + dx * 44, t.y + dy * 44); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2 + dx * 14, y2 + dy * 14); ctx.lineTo(x2 - dy * 14 - dx * 6, y2 + dx * 14 - dy * 6); ctx.lineTo(x2 + dy * 14 - dx * 6, y2 - dx * 14 - dy * 6); ctx.closePath(); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      ctx.lineCap = 'butt';
      powerBar(t, p);
    }
    if (g.state === 'aiming' || g.state === 'meter') {
      const dx = Math.cos(t.turret), dy = Math.sin(t.turret);
      ctx.strokeStyle = 'rgba(255,60,40,.9)'; ctx.lineWidth = 4; ctx.setLineDash([4, 12]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(t.x + dx * C.tank.barrelLen, t.y + dy * C.tank.barrelLen); ctx.lineTo(t.x + dx * rangeOf(t), t.y + dy * rangeOf(t)); ctx.stroke();
      ctx.setLineDash([]); ctx.lineCap = 'butt';
      if (g.state === 'aiming' && !(g.drag.len >= C.attack.aimMin)) rot(face && side === 'blue', t.x, t.y - 60, () => badge(t.x, t.y - 60, '再拉一點', '#777'));
    }
  }
  function powerBar(t, p) {
    const bw = 120, bx = t.x - bw / 2, by = t.y - 64;
    rot(face && t.side === 'blue', t.x, by + 2, () => {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(bx - 4, by - 4, bw + 8, 18, 9); ctx.fill();
      const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, '#6be36b'); grad.addColorStop(.6, '#ffd24a'); grad.addColorStop(1, '#ff4a3a');
      ctx.fillStyle = grad; rr(bx, by, Math.max(1, bw * p), 10, 5); ctx.fill();
      const mp = C.pull.min / C.pull.max; ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * mp - 1, by - 3, 2, 16);
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.fillText(t.pull < C.pull.min ? '再拉一點' : Math.round(p * 100) + '%', t.x, by - 9);
    });
  }
  function badge(x, y, str, color) {
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(str).width + 22;
    ctx.fillStyle = color; rr(x - w / 2, y - 16, w, 26, 13); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(str, x, y + 2);
  }
  function drawEffects() {
    for (const s of g.shells) {
      ctx.strokeStyle = 'rgba(255,210,74,.6)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s.x - s.dx * 30, s.y - s.dy * 30); ctx.lineTo(s.x, s.y); ctx.stroke();
      const r = 8 + (s.dmg - 1) * 2;
      ctx.fillStyle = s.dmg > 1 ? '#b3261e' : '#333'; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(s.x - 2, s.y - 2, 3, 0, 7); ctx.fill();
    }
    for (const p of g.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of g.texts) {
      ctx.globalAlpha = clamp(t.life, 0, 1); ctx.font = `bold ${t.size}px sans-serif`; ctx.textAlign = 'center';
      rot(t.flip, t.x, t.y, () => {
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
      });
    }
    ctx.globalAlpha = 1;
  }
  function drawHud() {
    if (g.over) return;
    const col = COLORS[g.turn], phase = g.state === 'move' || g.state === 'charging' || g.state === 'dashing' ? 'move' : 'aim';
    const cy = g.turn === 'blue' ? 46 : H - 46, x = W - 78;
    const flip = face && g.turn === 'blue';
    ctx.textAlign = 'center';
    rot(flip, x, cy, () => {
      ctx.fillStyle = col.body; rr(x - 68, cy - 24, 136, 30, 15); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 17px sans-serif'; ctx.fillText(`${col.name}・${PHASE[phase]}`, x, cy - 3);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.font = '13px sans-serif';
      if (HINT[g.state]) ctx.fillText(HINT[g.state], x, cy + 20);
    });
    if (g.sel && ['move', 'charging', 'aim', 'aiming', 'meter'].includes(g.state) && inRange(g.sel)) {
      const R = castleRect(enemy(g.turn));
      ctx.strokeStyle = `rgba(47,191,85,${0.6 + 0.4 * Math.sin(g.t * 8)})`; ctx.lineWidth = 6;
      rr(R.x - 4, R.y - 4, R.w + 8, R.h + 8, 12); ctx.stroke();
      { const by = g.turn === 'red' ? R.y + R.h + 34 : R.y - 22; rot(flip, W / 2, by, () => badge(W / 2, by, '✔ 進入射程！', '#2fbf55')); }
    }
    if (g.banner) {
      ctx.globalAlpha = clamp(g.banner.t * 1.5, 0, 1);
      rot(flip, W / 2, 500, () => {
        ctx.fillStyle = 'rgba(30,20,50,.82)'; rr(W / 2 - 210, 440, 420, 120, 22); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.fillText(g.banner.text, W / 2, 500);
        ctx.fillStyle = '#cfe9ff'; ctx.font = '20px sans-serif'; ctx.fillText(g.banner.sub, W / 2, 536);
      });
      ctx.globalAlpha = 1;
    }
  }
  // 罰球式瞄準條：綠區＝完美，黃區＝小偏差，紅區＝大偏差
  function drawMeter() {
    const m = g.meter, side = m.tank.side, cy = side === 'red' ? H - 250 : 250, bw = 300, bx = W / 2 - bw / 2, by = cy + 4;
    const diff = m.k < 0.34 ? '簡單' : m.k < 0.67 ? '普通' : '困難';
    rot(face && side === 'blue', W / 2, cy, () => {
      ctx.fillStyle = 'rgba(20,14,40,.82)'; rr(W / 2 - 185, cy - 52, 370, 116, 18); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('在綠區按下！', W / 2, cy - 26);
      ctx.fillStyle = '#cfe9ff'; ctx.font = '14px sans-serif'; ctx.fillText(`目標距離 ${Math.round(m.dist)}・難度：${diff}`, W / 2, cy - 6);
      // 條：紅(外) → 黃 → 綠(中)
      ctx.fillStyle = '#e8493f'; rr(bx, by, bw, 24, 8); ctx.fill();
      const yw = (m.zone + (1 - m.zone) * 0.45) * bw / 2, gw = m.zone * bw / 2;
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(W / 2 - yw, by, yw * 2, 24);
      ctx.fillStyle = '#3fe05a'; ctx.fillRect(W / 2 - gw, by, gw * 2, 24);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; rr(bx, by, bw, 24, 8); ctx.stroke();
      const mx = bx + meterValue() * bw;
      ctx.fillStyle = '#fff'; ctx.fillRect(mx - 3, by - 6, 6, 36);
      ctx.beginPath(); ctx.moveTo(mx, by + 32); ctx.lineTo(mx - 8, by + 44); ctx.lineTo(mx + 8, by + 44); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '12px sans-serif'; ctx.fillText('點螢幕任何地方（空白鍵）定住指針', W / 2, cy + 56);
    });
  }
  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    g.pickups.forEach(drawPickup);
    drawCastle('blue'); drawCastle('red');
    g.tanks.filter(t => t.alive && t !== g.sel).forEach(drawTank);
    if (g.sel && g.sel.alive) drawTank(g.sel);
    drawSelection();
    drawEffects();
    if (g.state !== 'idle') drawHud();
    if (g.state === 'meter') drawMeter();
  }

  // ---------- 畫面流程 ----------
  function showScreen(id) {
    for (const s of ['screen-start', 'screen-result']) $(s).classList.toggle('hidden', s !== id);
    $('btn-skip').style.visibility = 'hidden'; $('btn-skip-top').style.visibility = 'hidden';
  }
  function startGame() { Sfx.init(); Sfx.click(); newGame(); showScreen(null); }
  function showResult() {
    g.resultShown = true;
    const w = g.over, col = COLORS[w];
    $('result-title').textContent = `${col.name}獲勝！`;
    $('result-title').style.color = col.body;
    $('result-sub').textContent = g.overWhy;
    // 面對面：上方多一份轉 180° 的結果，兩邊玩家都讀得到
    $('screen-result').classList.toggle('face', face);
    $('result-top').classList.toggle('hidden', !face);
    $('result-title-top').textContent = $('result-title').textContent;
    $('result-title-top').style.color = col.body;
    $('result-sub-top').textContent = $('result-sub').textContent;
    showScreen('screen-result');
    Sfx.win(); setTimeout(Sfx.lose, 900);
  }

  function fit() {
    const wrap = $('wrap'), bar = 44, ar = W / H;
    let w = window.innerWidth, h = window.innerHeight - bar;
    if (w / h > ar) w = h * ar; else h = w / ar;
    wrap.style.width = w + 'px'; canvas.style.height = h + 'px';
    wrap.style.fontSize = (w / W * 16) + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
  }
  function loop(ts) {
    const dt = Math.min(0.05, (ts - (loop.last || ts)) / 1000); loop.last = ts;
    const dpr = canvas.width / W;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (g) {
      update(dt); render();
      const canSkip = g.state === 'move', topTurn = face && g.turn === 'blue'; // 面對面時，藍隊用上方的按鈕
      $('btn-skip').style.visibility = canSkip && !topTurn ? 'visible' : 'hidden';
      $('btn-skip-top').style.visibility = canSkip && topTurn ? 'visible' : 'hidden';
    }
    requestAnimationFrame(loop);
  }

  function bindUi() {
    $('btn-start').onclick = startGame;
    $('btn-restart').onclick = startGame;
    $('btn-menu').onclick = () => { Sfx.chargeStop(); showScreen('screen-start'); newIdle(); };
    $('btn-skip').onclick = skipMove; $('btn-skip-top').onclick = skipMove;
    $('btn-quit').onclick = () => { Sfx.chargeStop(); showScreen('screen-start'); newIdle(); };
    const syncMute = () => document.querySelectorAll('.mute').forEach(b => { b.textContent = Sfx.isMuted() ? '🔇 音效：關' : '🔊 音效：開'; });
    document.querySelectorAll('.mute').forEach(b => b.onclick = e => {
      e.stopPropagation(); Sfx.init(); Sfx.setMuted(!Sfx.isMuted()); syncMute(); Sfx.click();
    });
    syncMute();
    const syncMode = () => { $('btn-mode').textContent = face ? '🔄 面對面（手機平放，藍隊在上）' : '👥 同側輪流（傳手機）'; };
    $('btn-mode').onclick = () => {
      face = !face; try { localStorage.setItem('pbr-face', face ? '1' : '0'); } catch (_) {}
      Sfx.init(); Sfx.click(); syncMode();
    };
    syncMode();
  }
  function newIdle() { newGame(); g.state = 'idle'; g.banner = null; }

  window.addEventListener('resize', fit);
  fit(); bindUi(); showScreen('screen-start'); newIdle();
  requestAnimationFrame(loop);

  window.__pbr = { get g() { return g; }, get face() { return face; }, CONFIG, castleDist, inRange, castleRect, alive, startGame };
})();
