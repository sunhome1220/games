// Pullback Rush 遊戲邏輯與繪圖（參數見 config.js，音效見 audio.js）
(() => {
  const C = CONFIG, W = C.world.w, H = C.world.h, GY = C.world.groundY;
  const $ = id => document.getElementById(id);
  const canvas = $('stage'), ctx = canvas.getContext('2d');
  const SIDES = ['left', 'right'];
  const COLORS = {
    left:  { body: '#ff5a4f', dark: '#c23a31', light: '#ff9a8f', name: '紅隊' },
    right: { body: '#3fa9f5', dark: '#2679b5', light: '#8fd0ff', name: '藍隊' },
  };

  let g; // 目前這一局的狀態

  const dirOf = s => (s === 'left' ? 1 : -1);
  const faceX = s => (s === 'left' ? C.castle.w : W - C.castle.w); // 該方主堡正面
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function newGame() {
    g = {
      state: 'aim', turn: 'left', t: 0, over: null,
      tanks: {}, castles: {}, shells: [], parts: [], texts: [],
      drag: null, banner: 0, resolveT: 0, shot: null, hint: '',
    };
    for (const s of SIDES) {
      g.tanks[s] = { side: s, x: s === 'left' ? C.tank.startX : W - C.tank.startX, vx: 0,
        wheel: 0, pull: 0, motor: null, tickAcc: 0, squash: 0 };
      g.castles[s] = { hp: C.castle.hp, shake: 0, flash: 0, crack: 0 };
    }
    g.banner = 1.4;
  }

  // ---------- 幾何 / 判定 ----------
  const front = t => t.x + dirOf(t.side) * C.tank.w / 2;
  const enemy = s => (s === 'left' ? 'right' : 'left');
  // 車頭前緣到敵方主堡正面的空隙
  function gapTo(s) {
    const t = g.tanks[s];
    return (faceX(enemy(s)) - front(t)) * dirOf(s);
  }
  function rangeStatus(s) {
    const gap = gapTo(s);
    if (gap > C.attack.maxGap) return 'far';
    if (gap < C.attack.minGap) return 'close';
    return 'in';
  }

  // ---------- 輸入（滑鼠 + 觸控，皆走 Pointer Events） ----------
  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  canvas.addEventListener('pointerdown', e => {
    if (!g || g.state !== 'aim' || g.drag) return; // 同時只接受一個指標
    const p = toWorld(e), t = g.tanks[g.turn];
    const ty = C.tank.laneY[g.turn];
    if (Math.abs(p.x - t.x) > C.tank.w * 0.9 || Math.abs(p.y - ty) > C.tank.h * 1.8) return;
    Sfx.init();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    g.drag = { id: e.pointerId, startX: p.x, lastNotch: 0, baseX: t.x };
    g.state = 'charging';
    Sfx.chargeStart();
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!g || g.state !== 'charging' || e.pointerId !== g.drag.id) return;
    setPull(clamp((g.drag.startX - toWorld(e).x) * dirOf(g.turn), 0, C.pull.max));
    e.preventDefault();
  });
  const endDrag = e => {
    if (!g || g.state !== 'charging' || e.pointerId !== g.drag.id) return;
    if (e.type === 'pointercancel') cancelCharge(); else release();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  function setPull(pull) {
    const t = g.tanks[g.turn], d = g.drag;
    t.pull = pull;
    const p = clamp(pull / C.pull.max, 0, 1);
    // 車體隨彈簧壓縮往後退，但不超過己方主堡
    const minX = faceX(g.turn) + dirOf(g.turn) * (C.tank.backLimit + C.tank.w / 2);
    const x = d.baseX - dirOf(g.turn) * pull * C.pull.bodyShift;
    t.x = dirOf(g.turn) === 1 ? Math.max(x, minX) : Math.min(x, minX);
    t.squash = p;
    // 每 12px 一格棘輪「卡」，音高隨蓄力上升
    const notch = Math.floor(pull / 12);
    if (notch !== d.lastNotch) { if (pull > 0) Sfx.ratchet(p); d.lastNotch = notch; }
    Sfx.chargeUpdate(p);
  }
  function cancelCharge() {
    const t = g.tanks[g.turn];
    Sfx.chargeStop(); Sfx.cancel();
    t.x = g.drag.baseX; t.pull = 0; t.squash = 0;
    g.drag = null; g.state = 'aim';
  }
  function release() {
    const t = g.tanks[g.turn];
    if (t.pull < C.pull.min) { cancelCharge(); return; }
    const p = clamp((t.pull - C.pull.min) / (C.pull.max - C.pull.min), 0, 1);
    launch(t, p);
  }
  function launch(t, p) {
    const v0 = lerp(C.motor.vMin, C.motor.vMax, p);
    t.motor = { v0, t: 0, p, phase: 'accel' };
    t.vx = 0; t.pull = 0; t.tickAcc = 0;
    g.drag = null; g.state = 'dashing';
    Sfx.launch(p);
    burst(t.x - dirOf(t.side) * 40, C.tank.laneY[t.side] + 16, 10, '#d9c9a8', 90);
  }

  // ---------- 更新 ----------
  function update(dt) {
    g.t += dt;
    if (g.banner > 0) g.banner -= dt;
    for (const s of SIDES) {
      const c = g.castles[s];
      c.shake = Math.max(0, c.shake - dt); c.flash = Math.max(0, c.flash - dt);
    }
    if (g.state === 'dashing') updateDash(dt);
    updateShells(dt);
    if (g.state === 'resolving') {
      g.resolveT -= dt;
      if (g.resolveT <= 0) nextTurn();
    }
    if (g.state === 'over') {
      g.overT -= dt;
      if (g.overT <= 0 && !g.resultShown) showResult();
    }
    for (const p of g.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.grav ?? 500) * dt; }
    g.parts = g.parts.filter(p => p.life > 0);
    for (const t of g.texts) { t.life -= dt; t.y -= 28 * dt; }
    g.texts = g.texts.filter(t => t.life > 0);
    // 空閒時彈簧回彈
    for (const s of SIDES) { const t = g.tanks[s]; if (!(g.drag && g.turn === s)) t.squash = Math.max(0, t.squash - dt * 5); }
  }

  function updateDash(dt) {
    const t = g.tanks[g.turn], m = t.motor, d = dirOf(t.side);
    m.t += dt;
    let speed = Math.abs(t.vx);
    if (m.phase === 'accel') {
      speed = m.v0 * Math.min(1, m.t / C.motor.accelTime); // 發條釋放，快速加速
      t.vx = d * speed;
      if (m.t >= C.motor.accelTime) m.phase = 'glide';
    } else {
      speed = Math.max(0, speed - C.motor.decel * dt);       // 滑行減速
      t.vx = Math.sign(t.vx) * speed;
    }
    const dx = t.vx * dt;
    t.x += dx; t.wheel += dx / C.tank.wheelR;
    // 與敵方主堡碰撞 → 反彈（不得穿過）
    const wall = faceX(enemy(t.side)), limit = wall - d * (C.tank.w / 2 + 1);
    if ((t.x - limit) * d > 0) {
      const impact = Math.abs(t.vx);
      t.x = limit;
      if (impact > 80) { Sfx.bump(); burst(wall, C.tank.laneY[t.side] - 10, 8, '#ffd24a', 160); }
      t.vx = -t.vx * C.motor.wallRestitution; m.phase = 'glide';
    }
    // 與己方主堡（反彈後倒退時）
    const back = faceX(t.side) + d * (C.tank.backLimit + C.tank.w / 2);
    if ((back - t.x) * d > 0) { t.x = back; t.vx = 0; }
    // 「卡、卡、卡」：依行進距離觸發，速度越快間隔越密（距離固定→頻率隨速度）
    t.tickAcc += Math.abs(dx);
    if (t.tickAcc >= 28) { t.tickAcc -= 28; Sfx.tick(speed / C.motor.vMax); }
    // 揚塵
    if (speed > 120 && Math.random() < dt * 40) burst(t.x - Math.sign(t.vx || d) * 40, C.tank.laneY[t.side] + 18, 1, '#d9c9a8', 50);
    if (m.phase === 'glide' && Math.abs(t.vx) < C.motor.stopSpeed) {
      t.vx = 0; t.motor = null;
      fire(t.side);
    }
  }

  // ---------- 攻擊 ----------
  function fire(side) {
    const t = g.tanks[side], d = dirOf(side), status = rangeStatus(side);
    const sx = front(t) + d * 14, sy = C.tank.laneY[side] - 38;
    const targetFace = faceX(enemy(side));
    let tx, ty, willHit = false;
    if (status === 'in') { tx = targetFace; ty = GY - 80; willHit = true; }
    else if (status === 'far') { tx = front(t) + d * C.attack.maxGap * 0.8; ty = C.tank.laneY[side] + 14; }
    else { tx = targetFace + d * 140; ty = GY - 20; } // 太近：砲彈飛越主堡
    g.shot = { side, hit: false };
    g.shells.push({ side, x0: sx, y0: sy, x1: tx, y1: ty, t: 0, dur: C.attack.shellTime, willHit, done: false });
    g.state = 'firing';
    Sfx.shoot();
    burst(sx, sy, 8, '#fff2a8', 140, 0.25);
    if (status === 'far') floatText(t.x, C.tank.laneY[side] - 80, '射程不足！', '#fff');
    if (status === 'close') floatText(t.x, C.tank.laneY[side] - 80, '太近了！', '#fff');
  }
  function updateShells(dt) {
    for (const s of g.shells) {
      if (s.done) continue;
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      s.x = lerp(s.x0, s.x1, k);
      s.y = lerp(s.y0, s.y1, k) - Math.sin(k * Math.PI) * 90;
      if (Math.random() < dt * 60) burst(s.x, s.y, 1, '#ffd24a', 30, 0.3, 0);
      if (k >= 1) {
        s.done = true;
        if (s.willHit && !g.shot.hit) { g.shot.hit = true; applyHit(enemy(s.side)); }
        else { Sfx.miss(); burst(s.x, s.y, 10, '#9a8f7a', 120); }
        if (g.state === 'firing') {
          if (g.over) { /* 勝負已定 */ }
          else { g.state = 'resolving'; g.resolveT = C.attack.resolveDelay; }
        }
      }
    }
    g.shells = g.shells.filter(s => !s.done);
  }
  function applyHit(side) {
    const c = g.castles[side];
    if (c.hp <= 0) return;
    c.hp = Math.max(0, c.hp - C.attack.damage);
    c.shake = C.castle.hitShake; c.flash = 0.3; c.crack++;
    Sfx.hit();
    const x = faceX(side);
    burst(x, GY - 80, 26, '#ff9a2e', 260); burst(x, GY - 80, 14, '#fff2a8', 200);
    floatText(x + (side === 'left' ? 60 : -60), GY - 150, '-' + C.attack.damage, '#fff', 34);
    if (c.hp <= 0) {
      g.over = enemy(side); g.state = 'over'; g.overT = 1.3; g.resultShown = false;
      burst(x, GY - 90, 60, '#ff7a2e', 360);
    }
  }
  function nextTurn() {
    if (g.over) return;
    g.turn = enemy(g.turn); g.state = 'aim'; g.banner = 1.2; g.shot = null;
  }

  // ---------- 特效 ----------
  function burst(x, y, n, color, speed, life = 0.6, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * speed;
      g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: life * (0.5 + Math.random()),
        max: life * 1.5, color, size: 2 + Math.random() * 4, grav });
    }
  }
  function floatText(x, y, str, color, size = 22) { g.texts.push({ x, y, str, color, size, life: 1.1 }); }

  // ---------- 繪圖 ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, '#8fd8ff'); sky.addColorStop(1, '#e6f7ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GY);
    // 雲
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const [cx, cy, s] of [[200, 90, 1], [520, 60, 1.3], [800, 120, .9]]) {
      const ox = (g.t * 6 * s) % 60;
      for (const [dx, dy, r] of [[-26, 6, 22], [0, 0, 30], [30, 8, 22]]) {
        ctx.beginPath(); ctx.arc(cx + dx * s + ox, cy + dy * s, r * s, 0, 7); ctx.fill();
      }
    }
    // 地板：木紋玩具桌面
    ctx.fillStyle = '#e8b86d'; ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = '#d9a455'; ctx.fillRect(0, GY, W, 10);
    ctx.strokeStyle = 'rgba(120,70,20,.18)'; ctx.lineWidth = 2;
    for (let y = GY + 40; y < H; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // 車道線
    ctx.setLineDash([16, 14]); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3;
    for (const s of SIDES) { const y = C.tank.laneY[s] + 30; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  function drawRangeBand(side) {
    const d = dirOf(side), face = faceX(enemy(side)), col = COLORS[side];
    const a = face - d * C.attack.maxGap, b = face - d * C.attack.minGap; // 前緣需落在此區間
    const x0 = Math.min(a, b), w = Math.abs(a - b);
    const status = rangeStatus(side);
    ctx.fillStyle = status === 'in' ? 'rgba(80,220,110,.38)' : 'rgba(255,255,255,.28)';
    ctx.fillRect(x0, GY + 10, w, H - GY - 10);
    ctx.strokeStyle = status === 'in' ? '#2fbf55' : col.dark; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.strokeRect(x0, GY + 12, w, H - GY - 16); ctx.setLineDash([]);
    ctx.fillStyle = col.dark; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('有效射程', x0 + w / 2, H - 10);
  }
  function drawCastle(side) {
    const c = g.castles[side], col = COLORS[side], d = dirOf(side);
    const cw = C.castle.w, ch = C.castle.h;
    const baseX = side === 'left' ? 0 : W - cw;
    let ox = 0, oy = 0;
    if (c.shake > 0) { const k = c.shake / C.castle.hitShake; ox = Math.sin(g.t * 70) * 9 * k; oy = Math.cos(g.t * 90) * 4 * k; }
    ctx.save(); ctx.translate(ox, oy);
    const y0 = GY - ch + 12;
    const fill = c.flash > 0 && Math.floor(c.flash * 30) % 2 === 0 ? '#fff' : col.body;
    ctx.fillStyle = fill; rr(baseX, y0, cw, ch, 8); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = col.dark; ctx.stroke();
    // 城垛
    ctx.fillStyle = fill;
    for (let i = 0; i < 3; i++) { rr(baseX + 6 + i * 36, y0 - 22, 26, 28, 4); ctx.fill(); ctx.stroke(); }
    // 磚縫
    ctx.strokeStyle = col.dark; ctx.lineWidth = 2; ctx.globalAlpha = .4;
    for (let r = 1; r < 6; r++) { const y = y0 + r * 30; ctx.beginPath(); ctx.moveTo(baseX, y); ctx.lineTo(baseX + cw, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // 城門
    ctx.fillStyle = '#5a3a1e'; rr(baseX + cw / 2 - 20, GY - 56, 40, 68, 20); ctx.fill();
    // 面向敵方的玩具大砲
    ctx.fillStyle = '#444'; rr(baseX + (side === 'left' ? cw - 8 : -22), y0 + 40, 30, 14, 5); ctx.fill();
    // 裂痕
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3;
    for (let i = 0; i < c.crack; i++) {
      const cx = baseX + 20 + i * 30, cy = y0 + 50 + i * 20;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 10, cy + 16); ctx.lineTo(cx - 4, cy + 30); ctx.stroke();
    }
    ctx.restore();
    // 生命值：三顆愛心 + 數字
    const hx = side === 'left' ? 20 : W - 20 - 150;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(hx - 8, 10, 166, 46, 12); ctx.fill();
    for (let i = 0; i < C.castle.hp; i++) {
      drawHeart(hx + 22 + i * 38, 33, 15, i < c.hp ? '#ff4a6a' : 'rgba(255,255,255,.25)');
    }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(c.hp, hx + 128, 41);
  }
  function drawHeart(x, y, s, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x, y + s * .8);
    ctx.bezierCurveTo(x - s * 1.3, y - s * .2, x - s * .5, y - s * 1.1, x, y - s * .3);
    ctx.bezierCurveTo(x + s * .5, y - s * 1.1, x + s * 1.3, y - s * .2, x, y + s * .8);
    ctx.fill();
  }
  function drawTank(side) {
    const t = g.tanks[side], col = COLORS[side], d = dirOf(side);
    const y = C.tank.laneY[side], w = C.tank.w, h = C.tank.h, r = C.tank.wheelR;
    const active = g.turn === side && !g.over;
    const sq = t.squash, speed = Math.abs(t.vx), spd = speed / C.motor.vMax;
    ctx.save(); ctx.translate(t.x, y); ctx.scale(d, 1); // 以朝右為基準繪製，右方鏡像
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, 22, w / 2, 7, 0, 0, 7); ctx.fill();
    // 速度線
    if (speed > 150) {
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const ly = -22 + i * 10, len = 30 + spd * 90 + Math.random() * 20;
        ctx.beginPath(); ctx.moveTo(-w / 2 - 6, ly); ctx.lineTo(-w / 2 - 6 - len, ly); ctx.stroke();
      }
    }
    // 發條彈簧（在車尾，蓄力時壓縮）
    const springLen = 34 * (1 - sq * 0.7);
    ctx.strokeStyle = sq > .75 ? '#ff3b30' : '#888'; ctx.lineWidth = 4; ctx.beginPath();
    const coils = 7; ctx.moveTo(-w / 2, 4);
    for (let i = 1; i <= coils; i++) ctx.lineTo(-w / 2 - springLen * i / coils, 4 + (i % 2 ? -9 : 9));
    ctx.stroke();
    // 發條鑰匙
    ctx.save(); ctx.translate(-w / 2 - springLen - 6, 4); ctx.rotate(t.pull * 0.12);
    ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#a07b00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-4, -7, 8, 5, 0, 0, 7); ctx.ellipse(-4, 7, 8, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
    // 車體（蓄力時微壓扁）
    const sx = 1 - sq * 0.06, sy = 1 + sq * 0.1;
    ctx.save(); ctx.scale(sx, sy);
    ctx.fillStyle = col.body; rr(-w / 2, -16, w, 30, 10); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = col.dark; ctx.stroke();
    ctx.fillStyle = col.light; rr(-w / 2 + 6, -12, w - 12, 7, 3); ctx.fill();
    // 砲塔 + 砲管
    ctx.fillStyle = col.dark; rr(-18, -36, 38, 24, 9); ctx.fill();
    ctx.fillStyle = '#555'; rr(16, -30, 34, 9, 4); ctx.fill();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, -24, 5, 0, 7); ctx.fill();
    ctx.restore();
    // 輪子（隨移動距離轉動）
    for (const wx of [-w / 2 + 20, w / 2 - 20]) {
      ctx.save(); ctx.translate(wx, 14); ctx.rotate(t.wheel);
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(0, 0, r * .55, 0, 7); ctx.fill();
      ctx.strokeStyle = '#777'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-r * .55, 0); ctx.lineTo(r * .55, 0); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
    // 在射程內的光圈提示
    if (active && g.state !== 'over' && rangeStatus(side) === 'in' && (g.state === 'aim' || g.state === 'charging')) {
      ctx.strokeStyle = `rgba(47,191,85,${0.6 + 0.4 * Math.sin(g.t * 8)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(t.x, y, w * .72, h * .95, 0, 0, 7); ctx.stroke();
      badge(t.x, y - 70, '✔ 進入射程！', '#2fbf55');
    }
    if (active && g.state === 'aim') {
      // 提示手勢
      const hx = t.x - d * (w / 2 + 40) + Math.sin(g.t * 4) * 6 * -d;
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '26px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d === 1 ? '⇠' : '⇢', hx, y - 4);
    }
    // 蓄力力量條
    if (g.state === 'charging' && g.turn === side) {
      const p = clamp(t.pull / C.pull.max, 0, 1), bw = 130, bx = t.x - bw / 2, by = y - 72;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(bx - 4, by - 4, bw + 8, 18, 9); ctx.fill();
      const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, '#6be36b'); grad.addColorStop(.6, '#ffd24a'); grad.addColorStop(1, '#ff4a3a');
      ctx.fillStyle = grad; rr(bx, by, bw * p, 10, 5); ctx.fill();
      const minP = C.pull.min / C.pull.max;
      ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * minP - 1, by - 3, 2, 16);
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.fillText(t.pull < C.pull.min ? '再拉一點' : Math.round(p * 100) + '%', t.x, by - 10);
    }
  }
  function badge(x, y, str, color) {
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(str).width + 22;
    ctx.fillStyle = color; rr(x - w / 2, y - 16, w, 26, 13); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(str, x, y + 2);
  }
  function drawEffects() {
    for (const s of g.shells) {
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(s.x - 2, s.y - 2, 3, 0, 7); ctx.fill();
    }
    for (const p of g.parts) {
      ctx.globalAlpha = clamp(p.life / (p.max || 1), 0, 1); ctx.fillStyle = p.color;
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
    ctx.textAlign = 'center';
    if (!g.over) {
      const col = COLORS[g.turn];
      ctx.fillStyle = col.body; rr(W / 2 - 110, 12, 220, 38, 19); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 19px sans-serif';
      ctx.fillText(`${col.name}回合`, W / 2, 38);
      if (g.state === 'aim') {
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.font = '15px sans-serif';
        ctx.fillText('按住戰車向後拖曳蓄力，放手衝刺', W / 2, 72);
      }
    }
    if (g.banner > 0 && !g.over) {
      const col = COLORS[g.turn];
      ctx.globalAlpha = clamp(g.banner * 1.5, 0, 1);
      ctx.fillStyle = col.dark; rr(W / 2 - 200, 200, 400, 70, 20); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 34px sans-serif';
      ctx.fillText(`輪到${col.name}！`, W / 2, 247);
      ctx.globalAlpha = 1;
    }
  }
  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    if ((g.state === 'aim' || g.state === 'charging') && !g.over) drawRangeBand(g.turn);
    drawCastle('left'); drawCastle('right');
    // 依車道深度排序
    for (const s of ['right', 'left']) drawTank(s);
    drawEffects(); if (g.state !== 'idle') drawHud();
  }

  // ---------- 畫面流程 ----------
  function showScreen(id) {
    for (const s of ['screen-start', 'screen-result']) $(s).classList.toggle('hidden', s !== id);
    $('hud-top').classList.toggle('hidden', id !== null);
  }
  function startGame() {
    Sfx.init(); Sfx.click();
    newGame(); showScreen(null);
  }
  function showResult() {
    g.resultShown = true;
    const w = g.over, col = COLORS[w];
    $('result-title').textContent = `${col.name}獲勝！`;
    $('result-title').style.color = col.body;
    $('result-sub').textContent = `${COLORS[enemy(w)].name}的主堡被攻陷了`;
    showScreen('screen-result');
    Sfx.win();
    setTimeout(Sfx.lose, 900);
  }

  function fit() {
    const wrap = $('wrap'), ar = W / H;
    let w = window.innerWidth, h = window.innerHeight;
    if (w / h > ar) w = h * ar; else h = w / ar;
    wrap.style.width = w + 'px'; wrap.style.height = h + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr * 1, 0, 0, dpr * 1, 0, 0);
  }
  // 因為 canvas 是 CSS 縮放，需要把繪圖座標 (W×H) 映射到 dpr 解析度
  function loop(ts) {
    const dt = Math.min(0.05, (ts - (loop.last || ts)) / 1000); loop.last = ts;
    const dpr = canvas.width / W;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (g) { update(dt); render(); }
    requestAnimationFrame(loop);
  }

  function bindUi() {
    $('btn-start').onclick = startGame;
    $('btn-restart').onclick = startGame;
    $('btn-menu').onclick = () => { Sfx.chargeStop(); showScreen('screen-start'); g = null; };
    const syncMute = () => document.querySelectorAll('.mute').forEach(b => { b.textContent = Sfx.isMuted() ? '🔇 音效：關' : '🔊 音效：開'; });
    document.querySelectorAll('.mute').forEach(b => b.onclick = e => {
      e.stopPropagation(); Sfx.init(); Sfx.setMuted(!Sfx.isMuted()); syncMute(); Sfx.click();
    });
    $('btn-quit').onclick = () => { Sfx.chargeStop(); g = null; showScreen('screen-start'); };
    syncMute();
  }

  window.addEventListener('resize', fit);
  fit(); bindUi(); showScreen('screen-start');
  newGame(); g.state = 'idle'; // 開始畫面的背景
  requestAnimationFrame(loop);

  // 供自動化測試使用
  window.__pbr = { get g() { return g; }, CONFIG, rangeStatus, gapTo, startGame };
})();
