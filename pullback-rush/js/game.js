// Pullback Rush（直式鳥瞰）邏輯與繪圖。參數見 config.js，音效見 audio.js
// 回合：① 向後拖曳蓄力 → 放手衝刺（move）② 向後拖曳瞄準 → 放手開砲（aim）
(() => {
  const C = CONFIG, W = C.world.w, H = C.world.h;
  const $ = id => document.getElementById(id);
  const canvas = $('stage'), ctx = canvas.getContext('2d');
  const SIDES = ['red', 'blue'];
  const COLORS = {
    red:  { body: '#e8493f', dark: '#a52e27', light: '#ff9a8f', name: '紅隊' },
    blue: { body: '#3a8fe0', dark: '#2260a0', light: '#9bd0ff', name: '藍隊' },
  };
  const PHASE = { move: '移動', aim: '瞄準' };
  const HINT = { move: '拉後放手衝刺', aim: '拉後放手開砲' };

  let g;

  const enemy = s => (s === 'red' ? 'blue' : 'red');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const castleRect = s => {
    const x = (W - C.castle.w) / 2;
    return { x, y: s === 'blue' ? 0 : H - C.castle.h, w: C.castle.w, h: C.castle.h };
  };
  function nearestOnRect(r, x, y) { return { x: clamp(x, r.x, r.x + r.w), y: clamp(y, r.y, r.y + r.h) }; }

  function newGame() {
    g = { state: 'move', turn: 'red', t: 0, over: null, tanks: {}, castles: {}, shells: [], parts: [], texts: [],
      drag: null, banner: null, resolveT: 0, shot: null };
    for (const s of SIDES) {
      const y = s === 'red' ? H - C.tank.startOffset : C.tank.startOffset;
      g.tanks[s] = { side: s, x: W / 2, y, vx: 0, vy: 0, angle: s === 'red' ? -Math.PI / 2 : Math.PI / 2,
        turret: s === 'red' ? -Math.PI / 2 : Math.PI / 2, tread: 0, pull: 0, squash: 0, recoil: 0, motor: null, tickAcc: 0 };
      g.castles[s] = { hp: C.castle.hp, shake: 0, flash: 0, crack: 0 };
    }
    setBanner(`輪到${COLORS.red.name}！`, '先移動，再瞄準開砲');
  }
  function setBanner(text, sub) { g.banner = { text, sub, t: 1.4 }; }

  // 目前回合戰車與敵方主堡的距離（到主堡矩形最近點）
  function castleDist(s) {
    const t = g.tanks[s], p = nearestOnRect(castleRect(enemy(s)), t.x, t.y);
    return Math.hypot(p.x - t.x, p.y - t.y);
  }
  const inRange = s => castleDist(s) <= C.attack.range;

  // ---------- 輸入（滑鼠 + 觸控，皆走 Pointer Events） ----------
  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  canvas.addEventListener('pointerdown', e => {
    if (!g || (g.state !== 'move' && g.state !== 'aim') || g.drag) return; // 同時只接受一個指標
    const p = toWorld(e), t = g.tanks[g.turn];
    if (Math.hypot(p.x - t.x, p.y - t.y) > 90) return;
    Sfx.init();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
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

  function setPull(dx, dy) {
    const t = g.tanks[g.turn], d = g.drag;
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
    const t = g.tanks[g.turn], d = g.drag;
    d.len = Math.hypot(dx, dy);
    if (d.len < C.attack.aimMin) return;
    t.turret = Math.atan2(dy, dx);
    const notch = Math.floor(t.turret / 0.1);
    if (notch !== d.notch) { Sfx.ratchet(0.2); d.notch = notch; }
  }
  function cancelDrag() {
    const t = g.tanks[g.turn];
    if (g.state === 'charging') { Sfx.chargeStop(); t.x = g.drag.bx; t.y = g.drag.by; t.pull = 0; t.squash = 0; g.state = 'move'; }
    else { g.state = 'aim'; }
    Sfx.cancel(); g.drag = null;
  }
  function release() {
    const t = g.tanks[g.turn], d = g.drag;
    if (g.state === 'charging') {
      if (t.pull < C.pull.min) { cancelDrag(); return; }
      launch(t, (t.pull - C.pull.min) / (C.pull.max - C.pull.min));
    } else {
      if (!(d.len >= C.attack.aimMin)) { cancelDrag(); return; }
      g.drag = null; fire(g.turn);
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
  function skipMove() {
    if (!g || g.state !== 'move') return;
    Sfx.click(); g.state = 'aim'; setBanner('瞄準！', '向後拉動砲塔，放手開砲');
  }

  // ---------- 更新 ----------
  function update(dt) {
    g.t += dt;
    if (g.banner) { g.banner.t -= dt; if (g.banner.t <= 0) g.banner = null; }
    for (const s of SIDES) {
      const c = g.castles[s]; c.shake = Math.max(0, c.shake - dt); c.flash = Math.max(0, c.flash - dt);
      const t = g.tanks[s]; t.recoil = Math.max(0, t.recoil - dt * 5);
    }
    if (g.state === 'dashing') updateDash(dt);
    updateShells(dt);
    if (g.state === 'resolving') { g.resolveT -= dt; if (g.resolveT <= 0) nextTurn(); }
    if (g.state === 'over') { g.overT -= dt; if (g.overT <= 0 && !g.resultShown) showResult(); }
    for (const p of g.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vy *= 0.98; }
    g.parts = g.parts.filter(p => p.life > 0);
    for (const t of g.texts) { t.life -= dt; t.y -= 28 * dt; }
    g.texts = g.texts.filter(t => t.life > 0);
    for (const s of SIDES) { const t = g.tanks[s]; if (g.state !== 'charging' || g.turn !== s) t.squash = Math.max(0, t.squash - dt * 5); }
  }

  // 戰車與障礙物／敵車／兩座主堡／場邊碰撞，回傳撞擊速度
  function collideTank(t) {
    const e = C.motor.restitution, r = C.tank.r;
    let impact = 0;
    const bounce = (nx, ny) => {
      const vn = t.vx * nx + t.vy * ny;
      if (vn < 0) { t.vx -= (1 + e) * vn * nx; t.vy -= (1 + e) * vn * ny; impact = Math.max(impact, -vn); }
    };
    const circles = C.obstacles.concat([{ x: g.tanks[enemy(t.side)].x, y: g.tanks[enemy(t.side)].y, r }]);
    for (const o of circles) {
      const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 0.01, min = r + o.r;
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
    const t = g.tanks[g.turn], m = t.motor;
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
    // 「卡、卡、卡」：依行進距離觸發，速度快則間隔短
    t.tickAcc += dist;
    if (t.tickAcc >= 28) { t.tickAcc -= 28; Sfx.tick(speed / C.motor.vMax); }
    if (speed > 120 && Math.random() < dt * 40) burst(t.x - Math.cos(t.angle) * 36, t.y - Math.sin(t.angle) * 36, 1, '#d9c9a8', 50);
    if (m.phase === 'glide' && Math.hypot(t.vx, t.vy) < C.motor.stopSpeed) {
      t.vx = t.vy = 0; t.motor = null;
      g.state = 'aim';
      setBanner('瞄準！', inRange(g.turn) ? '主堡進入射程' : '主堡還在射程外');
    }
  }

  // ---------- 攻擊 ----------
  function fire(side) {
    const t = g.tanks[side], dx = Math.cos(t.turret), dy = Math.sin(t.turret);
    const L = C.tank.barrelLen;
    g.shot = { side, hit: false };
    g.shells.push({ side, x: t.x + dx * L, y: t.y + dy * L, dx, dy, traveled: 0, done: false });
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
        const why = shellHit(s);
        if (why) endShell(s, why);
        else if (s.traveled >= C.attack.range) endShell(s, 'range');
      }
      if (!s.done && Math.random() < dt * 60) burst(s.x, s.y, 1, '#ffd24a', 30, 0.3);
    }
    g.shells = g.shells.filter(s => !s.done);
  }
  function shellHit(s) {
    const foe = enemy(s.side), R = castleRect(foe);
    if (s.x >= R.x && s.x <= R.x + R.w && s.y >= R.y && s.y <= R.y + R.h) return 'castle';
    const own = castleRect(s.side);
    if (s.x >= own.x && s.x <= own.x + own.w && s.y >= own.y && s.y <= own.y + own.h) return 'block';
    for (const o of C.obstacles) if (Math.hypot(s.x - o.x, s.y - o.y) < o.r + 4) return 'block';
    for (const side of SIDES) {
      if (side === s.side && s.traveled < C.tank.r + 30) continue;
      const t = g.tanks[side];
      if (Math.hypot(s.x - t.x, s.y - t.y) < C.tank.r) return 'tank';
    }
    if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) return 'out';
    return null;
  }
  function endShell(s, why) {
    s.done = true;
    if (why === 'castle' && !g.shot.hit) { g.shot.hit = true; applyHit(enemy(s.side), s); }
    else {
      Sfx.miss(); burst(s.x, s.y, 10, '#9a8f7a', 120);
      const msg = { block: '被擋住了！', tank: '打到戰車（無傷害）', range: '射程不足！', out: '打偏了！' }[why];
      if (msg) floatText(clamp(s.x, 80, W - 80), clamp(s.y, 130, H - 130), msg, '#fff', 20);
    }
    if (g.state === 'firing' && !g.over) { g.state = 'resolving'; g.resolveT = C.attack.resolveDelay; }
  }
  function applyHit(side, s) {
    const c = g.castles[side];
    if (c.hp <= 0) return;
    c.hp = Math.max(0, c.hp - C.attack.damage);
    c.shake = C.castle.hitShake; c.flash = 0.3; c.crack++;
    Sfx.hit();
    burst(s.x, s.y, 26, '#ff9a2e', 260); burst(s.x, s.y, 14, '#fff2a8', 200);
    floatText(s.x, s.y + (side === 'blue' ? 40 : -40), '-' + C.attack.damage, '#fff', 36);
    if (c.hp <= 0) {
      g.over = enemy(side); g.state = 'over'; g.overT = 1.3; g.resultShown = false;
      const R = castleRect(side); burst(R.x + R.w / 2, R.y + R.h / 2, 60, '#ff7a2e', 360);
    }
  }
  function nextTurn() {
    if (g.over) return;
    g.turn = enemy(g.turn); g.state = 'move'; g.shot = null;
    setBanner(`輪到${COLORS[g.turn].name}！`, '先移動，再瞄準開砲');
  }

  // ---------- 特效 ----------
  function burst(x, y, n, color, speed, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * speed;
      g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random()), max: life * 1.5, color, size: 2 + Math.random() * 4 });
    }
  }
  function floatText(x, y, str, color, size = 22) { g.texts.push({ x, y, str, color, size, life: 1.2 }); }

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
    // 中線與中央圓
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 4; ctx.setLineDash([18, 14]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 95, 0, 7); ctx.stroke();
  }
  function drawObstacle(o) {
    ctx.save(); ctx.translate(o.x, o.y);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(5, 7, o.r, o.r * .9, 0, 0, 7); ctx.fill();
    if (o.kind === 'crate') {
      const s = o.r * 1.5; ctx.fillStyle = '#c98f4a'; rr(-s / 2 - 4, -s / 2 - 4, s + 8, s + 8, 5); ctx.fill();
      ctx.strokeStyle = '#7a5226'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#dba765'; rr(-s / 2 + 4, -s / 2 + 4, s - 8, s - 8, 3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2); ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2); ctx.stroke();
    } else if (o.kind === 'barrel') {
      ctx.fillStyle = '#d9552b'; ctx.beginPath(); ctx.arc(0, 0, o.r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8f2f12'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#f08a5a'; ctx.beginPath(); ctx.arc(0, 0, o.r * .62, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, 0, o.r * .22, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#8d9097'; ctx.beginPath();
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr2 = o.r * (0.85 + 0.15 * Math.sin(i * 2.3)); ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#5b5e65'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#b4b7bd'; ctx.beginPath(); ctx.arc(-8, -8, o.r * .4, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function drawCastle(side) {
    const c = g.castles[side], col = COLORS[side], R = castleRect(side);
    let ox = 0, oy = 0;
    if (c.shake > 0) { const k = c.shake / C.castle.hitShake; ox = Math.sin(g.t * 70) * 8 * k; oy = Math.cos(g.t * 90) * 5 * k; }
    ctx.save(); ctx.translate(ox, oy);
    const fill = c.flash > 0 && Math.floor(c.flash * 30) % 2 === 0 ? '#fff' : col.body;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; rr(R.x + 6, R.y + 8, R.w, R.h, 10); ctx.fill();
    ctx.fillStyle = fill; rr(R.x, R.y, R.w, R.h, 10); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = col.dark; ctx.stroke();
    // 城牆磚縫與中央主樓
    ctx.strokeStyle = col.dark; ctx.globalAlpha = .35; ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(R.x, R.y + i * R.h / 6); ctx.lineTo(R.x + R.w, R.y + i * R.h / 6); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = col.light; rr(R.x + R.w / 2 - 40, R.y + 14, 80, R.h - 28, 8); ctx.fill();
    ctx.strokeStyle = col.dark; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#5a3a1e'; rr(R.x + R.w / 2 - 14, side === 'blue' ? R.y + R.h - 38 : R.y + 14, 28, 24, 6); ctx.fill();
    // 四角塔樓
    for (const [tx, ty] of [[R.x, R.y], [R.x + R.w, R.y], [R.x, R.y + R.h], [R.x + R.w, R.y + R.h]]) {
      ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(tx, ty, 24, 0, 7); ctx.fill(); ctx.strokeStyle = col.dark; ctx.stroke();
      ctx.fillStyle = col.dark; ctx.beginPath(); ctx.arc(tx, ty, 10, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3;
    for (let i = 0; i < c.crack; i++) {
      const cx = R.x + 40 + i * 70, cy = R.y + 24;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 10, cy + 20); ctx.lineTo(cx - 4, cy + 40); ctx.stroke();
    }
    ctx.restore();
    // 生命值：三顆愛心 + 數字（放在主堡左側）
    const hy = side === 'blue' ? 46 : H - 46;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(8, hy - 24, 140, 48, 12); ctx.fill();
    for (let i = 0; i < C.castle.hp; i++) drawHeart(30 + i * 31, hy, 12, i < c.hp ? '#ff4a6a' : 'rgba(255,255,255,.25)');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(c.hp, 122, hy + 8);
  }
  function drawHeart(x, y, s, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y + s * .8);
    ctx.bezierCurveTo(x - s * 1.3, y - s * .2, x - s * .5, y - s * 1.1, x, y - s * .3);
    ctx.bezierCurveTo(x + s * .5, y - s * 1.1, x + s * 1.3, y - s * .2, x, y + s * .8); ctx.fill();
  }

  function drawTank(side) {
    const t = g.tanks[side], col = COLORS[side], L = C.tank.hullLen, Wd = C.tank.hullWid;
    const speed = Math.hypot(t.vx, t.vy);
    ctx.save(); ctx.translate(t.x, t.y);
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.save(); ctx.translate(5, 7); ctx.rotate(t.angle); rr(-L / 2, -Wd / 2 - 8, L, Wd + 16, 10); ctx.fill(); ctx.restore();
    ctx.rotate(t.angle);
    // 速度線
    if (speed > 150) {
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) { const len = 26 + speed / C.motor.vMax * 80 + Math.random() * 16; ctx.beginPath(); ctx.moveTo(-L / 2 - 4, i * 13); ctx.lineTo(-L / 2 - 4 - len, i * 13); ctx.stroke(); }
    }
    // 發條彈簧（車尾，蓄力時壓縮）與鑰匙
    const sq = t.squash, springLen = 38 * (1 - sq * 0.7);
    ctx.strokeStyle = sq > .75 ? '#ff3b30' : '#6e6e6e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-L / 2, 0);
    for (let i = 1; i <= 7; i++) ctx.lineTo(-L / 2 - springLen * i / 7, i % 2 ? -9 : 9);
    ctx.stroke();
    ctx.save(); ctx.translate(-L / 2 - springLen - 4, 0); ctx.rotate(t.pull * 0.12);
    ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#a07b00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -8, 5, 8, 0, 0, 7); ctx.ellipse(0, 8, 5, 8, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    // 履帶（隨行進距離捲動的紋路）
    for (const sy of [-1, 1]) {
      ctx.fillStyle = '#2f2f35'; rr(-L / 2, sy * (Wd / 2 + 1) - 8, L, 16, 6); ctx.fill();
      ctx.strokeStyle = '#6a6a74'; ctx.lineWidth = 3;
      const off = t.tread % 12;
      for (let x = -L / 2 + 4 + off; x < L / 2 - 2; x += 12) { ctx.beginPath(); ctx.moveTo(x, sy * (Wd / 2 + 1) - 7); ctx.lineTo(x, sy * (Wd / 2 + 1) + 7); ctx.stroke(); }
    }
    // 車體（蓄力時微壓扁）
    ctx.save(); ctx.scale(1 - sq * 0.06, 1 + sq * 0.08);
    ctx.fillStyle = col.body; rr(-L / 2 + 4, -Wd / 2, L - 8, Wd, 9); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = col.dark; ctx.stroke();
    ctx.fillStyle = col.dark; rr(-L / 2 + 8, -Wd / 2 + 6, 14, Wd - 12, 3); ctx.fill(); // 引擎蓋
    ctx.restore();
    // 砲塔（可獨立旋轉）與砲管
    ctx.rotate(t.turret - t.angle);
    const back = t.recoil * 9;
    ctx.fillStyle = '#4a4a52'; rr(8 - back, -5, C.tank.barrelLen - 8, 10, 3); ctx.fill();
    ctx.fillStyle = '#2f2f35'; rr(C.tank.barrelLen - 14 - back, -7, 12, 14, 3); ctx.fill();
    ctx.fillStyle = col.dark; ctx.beginPath(); ctx.arc(0, 0, 19, 0, 7); ctx.fill();
    ctx.fillStyle = col.light; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
    ctx.strokeStyle = col.dark; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(-2, 0, 5, 0, 7); ctx.fill();
    ctx.restore();

    const active = g.turn === side && !g.over;
    const phase = g.state === 'move' || g.state === 'charging' ? 'move' : g.state === 'aim' || g.state === 'aiming' ? 'aim' : null;
    if (active && phase) {
      // 射程圈
      ctx.strokeStyle = inRange(side) ? 'rgba(47,191,85,.8)' : 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.arc(t.x, t.y, C.attack.range, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    if (active && g.state === 'charging') {
      const p = clamp(t.pull / C.pull.max, 0, 1), dx = Math.cos(t.angle), dy = Math.sin(t.angle);
      // 前進方向箭頭，長度隨蓄力
      const len = 40 + p * 150, x2 = t.x + dx * len, y2 = t.y + dy * len;
      ctx.strokeStyle = `hsl(${120 - p * 120},90%,50%)`; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(t.x + dx * 44, t.y + dy * 44); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2 + dx * 14, y2 + dy * 14); ctx.lineTo(x2 - dy * 14 - dx * 6, y2 + dx * 14 - dy * 6); ctx.lineTo(x2 + dy * 14 - dx * 6, y2 - dx * 14 - dy * 6); ctx.closePath(); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      ctx.lineCap = 'butt';
      powerBar(t, p);
    }
    if (active && g.state === 'aiming') {
      const dx = Math.cos(t.turret), dy = Math.sin(t.turret);
      ctx.strokeStyle = 'rgba(255,60,40,.9)'; ctx.lineWidth = 4; ctx.setLineDash([4, 12]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(t.x + dx * C.tank.barrelLen, t.y + dy * C.tank.barrelLen); ctx.lineTo(t.x + dx * C.attack.range, t.y + dy * C.attack.range); ctx.stroke();
      ctx.setLineDash([]); ctx.lineCap = 'butt';
      if (!(g.drag.len >= C.attack.aimMin)) badge(t.x, t.y - 60, '再拉一點', '#777');
    }
  }
  function powerBar(t, p) {
    const bw = 120, bx = t.x - bw / 2, by = t.y - 64;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(bx - 4, by - 4, bw + 8, 18, 9); ctx.fill();
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#6be36b'); grad.addColorStop(.6, '#ffd24a'); grad.addColorStop(1, '#ff4a3a');
    ctx.fillStyle = grad; rr(bx, by, Math.max(1, bw * p), 10, 5); ctx.fill();
    const mp = C.pull.min / C.pull.max; ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * mp - 1, by - 3, 2, 16);
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(t.pull < C.pull.min ? '再拉一點' : Math.round(p * 100) + '%', t.x, by - 9);
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
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(s.x - 2, s.y - 2, 3, 0, 7); ctx.fill();
    }
    for (const p of g.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of g.texts) {
      ctx.globalAlpha = clamp(t.life, 0, 1); ctx.font = `bold ${t.size}px sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
  function drawHud() {
    if (g.over) return;
    const col = COLORS[g.turn], phase = g.state === 'move' || g.state === 'charging' || g.state === 'dashing' ? 'move' : 'aim';
    const cy = g.turn === 'blue' ? 46 : H - 46, x = W - 78;
    ctx.textAlign = 'center';
    ctx.fillStyle = col.body; rr(x - 68, cy - 24, 136, 30, 15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 17px sans-serif'; ctx.fillText(`${col.name}・${PHASE[phase]}`, x, cy - 3);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.font = '13px sans-serif';
    if (g.state === 'move' || g.state === 'aim') ctx.fillText(HINT[g.state], x, cy + 20);
    // 敵方主堡進入射程提示
    if ((g.state === 'move' || g.state === 'charging' || g.state === 'aim' || g.state === 'aiming') && inRange(g.turn)) {
      const R = castleRect(enemy(g.turn));
      ctx.strokeStyle = `rgba(47,191,85,${0.6 + 0.4 * Math.sin(g.t * 8)})`; ctx.lineWidth = 6;
      rr(R.x - 4, R.y - 4, R.w + 8, R.h + 8, 12); ctx.stroke();
      badge(W / 2, R.y + R.h / 2 + 5, '✔ 進入射程！', '#2fbf55');
    }
    if (g.banner) {
      ctx.globalAlpha = clamp(g.banner.t * 1.5, 0, 1);
      ctx.fillStyle = 'rgba(30,20,50,.82)'; rr(W / 2 - 210, 440, 420, 120, 22); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.fillText(g.banner.text, W / 2, 500);
      ctx.fillStyle = '#cfe9ff'; ctx.font = '20px sans-serif'; ctx.fillText(g.banner.sub, W / 2, 536);
      ctx.globalAlpha = 1;
    }
  }
  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    C.obstacles.forEach(drawObstacle);
    drawCastle('blue'); drawCastle('red');
    drawTank(enemy(g.turn)); drawTank(g.turn);
    drawEffects();
    if (g.state !== 'idle') drawHud();
  }

  // ---------- 畫面流程 ----------
  function showScreen(id) {
    for (const s of ['screen-start', 'screen-result']) $(s).classList.toggle('hidden', s !== id);
    $('btn-skip').style.visibility = 'hidden';
  }
  function startGame() { Sfx.init(); Sfx.click(); newGame(); showScreen(null); }
  function showResult() {
    g.resultShown = true;
    const w = g.over, col = COLORS[w];
    $('result-title').textContent = `${col.name}獲勝！`;
    $('result-title').style.color = col.body;
    $('result-sub').textContent = `${COLORS[enemy(w)].name}的主堡被攻陷了`;
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
      $('btn-skip').style.visibility = g.state === 'move' ? 'visible' : 'hidden';
    }
    requestAnimationFrame(loop);
  }

  function bindUi() {
    $('btn-start').onclick = startGame;
    $('btn-restart').onclick = startGame;
    $('btn-menu').onclick = () => { Sfx.chargeStop(); g = null; showScreen('screen-start'); newIdle(); };
    $('btn-skip').onclick = skipMove;
    $('btn-quit').onclick = () => { Sfx.chargeStop(); showScreen('screen-start'); newIdle(); };
    const syncMute = () => document.querySelectorAll('.mute').forEach(b => { b.textContent = Sfx.isMuted() ? '🔇 音效：關' : '🔊 音效：開'; });
    document.querySelectorAll('.mute').forEach(b => b.onclick = e => {
      e.stopPropagation(); Sfx.init(); Sfx.setMuted(!Sfx.isMuted()); syncMute(); Sfx.click();
    });
    syncMute();
  }
  function newIdle() { newGame(); g.state = 'idle'; g.banner = null; }

  window.addEventListener('resize', fit);
  fit(); bindUi(); showScreen('screen-start'); newIdle();
  requestAnimationFrame(loop);

  window.__pbr = { get g() { return g; }, CONFIG, castleDist, inRange, castleRect, startGame };
})();
