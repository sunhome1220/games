// ===== 終極魔法的演出 =====
// 一次施法 = 一個 { k:'ult', kind, T, targets } 的特效：
//  · drawUltWorld：畫在棋盤上的（隕石、閃電、冰晶、光柱、護盾罩…），2D 與 3D 共用，靠 P(x, 離地高度, y) 換算畫面位置
//  · drawUltScreen：蓋在整個畫面上的（招式名稱橫幅、色調／暗角、時鐘、飄雪…），座標系是 W×H
// 傷害／復活等規則效果仍在 cards.js 的 instant 裡，這裡只管動畫與聲音，時間點（at）與 spellHit 的 delay 對齊。
const ULT = {
  meteor: { title: '隕石雨', sub: '☄️ 流星墜落・敵軍全體重創', col: '#ff8a3a', T: 2.8, snd: 'meteor' },
  revive: { title: '起死回生', sub: '😇 聖光降臨・英靈歸來', col: '#ffe38a', T: 2.8, snd: 'holy' },
  time:   { title: '時間暫停', sub: '⏳ 時間靜止・再行動一次', col: '#b79bff', T: 2.8, snd: 'tick' },
  shield: { title: '神之護盾', sub: '🛡️ 神明庇佑・全軍免傷', col: '#7fc4ff', T: 2.6, snd: 'shield' },
  judge:  { title: '天雷審判', sub: '⚡ 蒼天降罪・雷擊敵帥', col: '#ffe066', T: 2.6, snd: 'thunder' },
  freeze: { title: '冰封世界', sub: '❄️ 萬物凍結・敵軍冷卻', col: '#9fe0ff', T: 2.8, snd: 'freeze' },
};
// 施放：targets 為 [{ x, y, at }]（作用位置與發生時間，秒）；播聲音、震動畫面
function ultCast(kind, side, targets = []) {
  const u = ULT[kind];
  fx.push({ k: 'ult', kind, side, T: u.T, t: u.T, targets });
  SFX.play(u.snd); shake = Math.max(shake, kind === 'meteor' || kind === 'judge' ? 7 : 3);
}
const hash = (i, k = 0) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
const env = (e, T, a = 0.35, b = 0.6) => Math.max(0, Math.min(1, e / a, (T - e) / b));   // 淡入淡出
const P2D = (x, h, y) => [x, y - h * 0.9, 1]; P2D.flat = 1;   // 2D 俯視：離地高度往上畫
// 單一特效在棋盤上的部分
function drawUltWorld(f, P) {
  const c = ctx, e = f.T - f.t, flat = P.flat || 1;
  const grad = (x, y, r0, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); for (const [o, col] of stops) g.addColorStop(o, col); return g; };
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  if (f.kind === 'meteor') {
    f.targets.forEach((tg, i) => {
      const u = (e - (tg.at - 0.45)) / 0.45; if (u < 0 || u > 1.5) return;
      if (u <= 1) {
        const pos = q => P(tg.x - 150 * (1 - q), 380 * Math.pow(1 - q, 1.2), tg.y), [sx, sy, s] = pos(u);
        for (let k = 8; k >= 1; k--) { const [tx, ty, ts] = pos(Math.max(0, u - k * 0.04)); c.globalAlpha = 0.55 * (1 - k / 9); c.fillStyle = k < 4 ? '#ffb030' : '#ff5a1a'; c.beginPath(); c.arc(tx, ty, (13 - k) * ts, 0, 7); c.fill(); }
        c.globalAlpha = 1; c.fillStyle = grad(sx, sy, 0, 22 * s, [[0, '#fff'], [0.4, '#ffd23f'], [1, '#ff4a1a00']]); c.beginPath(); c.arc(sx, sy, 22 * s, 0, 7); c.fill();
        c.fillStyle = '#5a3a2a'; c.beginPath(); c.arc(sx, sy, 8 * s, 0, 7); c.fill();
      } else {   // 落地後：衝擊波＋焦黑坑洞
        const q = (u - 1) / 0.5, [gx, gy, s] = P(tg.x, 0, tg.y); c.globalAlpha = 1 - q; c.strokeStyle = '#ffd9a0'; c.lineWidth = 5 * s * (1 - q);
        c.beginPath(); c.ellipse(gx, gy, (20 + 70 * q) * s, (20 + 70 * q) * s * flat, 0, 0, 7); c.stroke();
      }
    });
  } else if (f.kind === 'judge') {
    const k = f.targets[0]; if (!k) { c.restore(); return; }
    [0.35, 0.58, 0.82].forEach((t0, n) => {
      const d = e - t0; if (d < 0 || d > 0.24) return; const a = 1 - d / 0.24, pts = [];
      for (let i = 0; i <= 9; i++) { const h = 620 * (1 - i / 9), jx = i === 9 ? 0 : (hash(i, n * 7 + 1) - 0.5) * 70 * (1 - i / 12); pts.push(P(k.x + jx, h, k.y)); }
      const path = () => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); };
      const s = pts[9][2]; c.globalAlpha = a * 0.45; c.strokeStyle = '#ffe9a0'; c.lineWidth = 16 * s; path(); c.stroke();
      c.globalAlpha = a; c.strokeStyle = '#fff'; c.lineWidth = 4.5 * s; path(); c.stroke();
      const b = pts[3]; c.lineWidth = 2.5 * s; c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(b[0] + (hash(n, 3) - 0.5) * 120 * s, b[1] + 80 * s); c.stroke();   // 分叉
      const [gx, gy] = pts[9]; c.fillStyle = grad(gx, gy, 0, 60 * s, [[0, '#ffffffcc'], [1, '#ffe06600']]); c.beginPath(); c.ellipse(gx, gy, 60 * s, 60 * s * flat, 0, 0, 7); c.fill();
    });
    if (e > 0.35) { const [gx, gy, s] = P(k.x, 0, k.y), q = Math.min(1, (e - 0.35) / 0.9); c.globalAlpha = (1 - q) * 0.8; c.strokeStyle = '#ffd23f'; c.lineWidth = 4 * s; c.beginPath(); c.ellipse(gx, gy, (30 + 90 * q) * s, (30 + 90 * q) * s * flat, 0, 0, 7); c.stroke(); }
  } else if (f.kind === 'freeze') {
    f.targets.forEach((tg, i) => {
      const t0 = 0.45 + i * 0.06, q = Math.min(1, Math.max(0, (e - t0) / 0.35)), a = env(e - t0, f.T - t0, 0.01, 0.7); if (q <= 0) return;
      const [gx, gy, s] = P(tg.x, 0, tg.y), n = 7; c.globalAlpha = a * 0.95;
      for (let j = 0; j < n; j++) {   // 冰錐
        const ang = j / n * Math.PI * 2 + 0.3, bx = gx + Math.cos(ang) * 17 * s, by = gy + Math.sin(ang) * 11 * s * (flat > 0.6 ? 1 : 0.6), hh = (26 + hash(i, j) * 22) * q * s;
        c.fillStyle = j % 2 ? '#bfe9ff' : '#e8f8ff'; c.beginPath(); c.moveTo(bx - 5 * s, by); c.lineTo(bx + (j - 3) * 1.5 * s, by - hh); c.lineTo(bx + 5 * s, by); c.closePath(); c.fill();
        c.strokeStyle = '#5fb4e6'; c.lineWidth = 1.2 * s; c.stroke();
      }
      c.fillStyle = grad(gx, gy - 8 * s, 0, 28 * s, [[0, '#ffffffaa'], [1, '#7cc8ff00']]); c.beginPath(); c.arc(gx, gy - 8 * s, 28 * s, 0, 7); c.fill();
    });
  } else if (f.kind === 'shield') {
    f.targets.forEach((tg, i) => {
      const a = env(e - 0.25, f.T - 0.25, 0.4, 0.8); if (a <= 0) return;
      const [gx, gy, s] = P(tg.x, 12, tg.y), r = 34 * s * (0.7 + 0.3 * Math.min(1, (e - 0.25) / 0.4));
      c.globalAlpha = a * 0.35; c.fillStyle = grad(gx, gy, r * 0.3, r, [[0, '#9fd0ff00'], [1, '#7fc4ff']]); c.beginPath(); c.ellipse(gx, gy - 6 * s, r, r * (0.55 + 0.45 * flat), 0, 0, 7); c.fill();
      c.globalAlpha = a * 0.9; c.strokeStyle = '#d8efff'; c.lineWidth = 2 * s; c.beginPath(); c.ellipse(gx, gy - 6 * s, r, r * (0.55 + 0.45 * flat), 0, 0, 7); c.stroke();
      c.lineWidth = 1.2 * s; for (let j = 0; j < 6; j++) { const g = e * 1.4 + j * Math.PI / 3 + i; c.beginPath(); c.moveTo(gx + Math.cos(g) * r * 0.55, gy - 6 * s + Math.sin(g) * r * 0.3); c.lineTo(gx + Math.cos(g + 1.05) * r * 0.55, gy - 6 * s + Math.sin(g + 1.05) * r * 0.3); c.stroke(); }
    });
    const [cx, cy, s] = P(W / 2, 0, H / 2), q = Math.min(1, e / 1.0);   // 從棋盤中心擴散的護盾波
    c.globalAlpha = (1 - q) * 0.7; c.strokeStyle = '#9fd0ff'; c.lineWidth = 8 * s * (1 - q); c.beginPath(); c.ellipse(cx, cy, 420 * q * s, 420 * q * s * flat, 0, 0, 7); c.stroke();
  } else if (f.kind === 'revive') {
    f.targets.forEach((tg, i) => {
      const a = env(e - tg.at, f.T - tg.at, 0.35, 0.9); if (a <= 0) return;
      const [gx, gy, s] = P(tg.x, 0, tg.y), [tx, ty] = P(tg.x, 430, tg.y), w = (26 - 8 * Math.min(1, (e - tg.at) / 1.4)) * s;
      const g = c.createLinearGradient(0, ty, 0, gy); g.addColorStop(0, '#fff6c000'); g.addColorStop(0.7, '#fff2b0cc'); g.addColorStop(1, '#ffffffee');
      c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.moveTo(tx - w * 0.5, ty); c.lineTo(tx + w * 0.5, ty); c.lineTo(gx + w, gy); c.lineTo(gx - w, gy); c.closePath(); c.fill();
      c.fillStyle = grad(gx, gy, 0, 50 * s, [[0, '#fffbe0cc'], [1, '#ffe38a00']]); c.beginPath(); c.ellipse(gx, gy, 50 * s, 50 * s * flat, 0, 0, 7); c.fill();
      for (let j = 0; j < 16; j++) { const ph = (e * 0.7 + hash(j, i) ) % 1, ang = e * 4 + j * 0.9, [px, py] = P(tg.x + Math.cos(ang) * 20, 380 * ph, tg.y + Math.sin(ang) * 20 * flat); c.globalAlpha = a * (1 - ph); c.fillStyle = j % 2 ? '#fff' : '#ffe38a'; c.beginPath(); c.arc(px, py, (3 - ph * 2) * s, 0, 7); c.fill(); }
      const [hx, hy] = P(tg.x, 64 + 16 * Math.sin(e * 3), tg.y); c.globalAlpha = a; c.strokeStyle = '#ffe38a'; c.lineWidth = 3 * s; c.beginPath(); c.ellipse(hx, hy, 17 * s, 5 * s, 0, 0, 7); c.stroke();   // 天使光環
    });
  } else if (f.kind === 'time') {
    const [cx, cy, s] = P(W / 2, 0, H / 2);
    for (let i = 0; i < 3; i++) { const q = ((e * 0.8 + i / 3) % 1); c.globalAlpha = (1 - q) * 0.5 * env(e, f.T, 0.2, 0.6); c.strokeStyle = '#c9b8ff'; c.lineWidth = 5 * s * (1 - q); c.beginPath(); c.ellipse(cx, cy, 460 * q * s, 460 * q * s * flat, 0, 0, 7); c.stroke(); }
  }
  c.restore();
}
// 蓋在整個畫面上的部分（座標系 W×H）：色調／暗角、時鐘、飄雪、閃光與招式名稱橫幅
function drawUltScreen(f) {
  const c = ctx, u = ULT[f.kind], e = f.T - f.t, E = env(e, f.T, 0.3, 0.7);
  c.save();
  if (f.kind === 'meteor') {
    c.globalAlpha = E * 0.5; const g = c.createRadialGradient(W / 2, H / 2, 150, W / 2, H / 2, 520); g.addColorStop(0, '#ff3a0000'); g.addColorStop(1, '#a01800'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalAlpha = E; c.fillStyle = '#ffb04a'; for (let i = 0; i < 36; i++) { const x = hash(i) * W, y = ((hash(i, 2) * H + e * (60 + hash(i, 3) * 80)) % H); c.fillRect(x, H - y, 2, 2); }   // 飄起的火星
  } else if (f.kind === 'judge') {
    c.globalAlpha = E * 0.75; const g = c.createLinearGradient(0, 0, 0, H * 0.7); g.addColorStop(0, '#0b0d1a'); g.addColorStop(1, '#0b0d1a00'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#1b2036'; for (let i = 0; i < 9; i++) { const cx = (hash(i) * (W + 120) - 60 + e * 14 * (i % 2 ? 1 : -1)), cy = 20 + hash(i, 4) * 70; for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(cx + j * 26, cy + (j % 2) * 8, 34 - j * 4, 0, 7); c.fill(); } }
    for (const t0 of [0.35, 0.58, 0.82]) { const d = e - t0; if (d >= 0 && d < 0.12) { c.globalAlpha = (1 - d / 0.12) * 0.7; c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); } }
  } else if (f.kind === 'freeze') {
    const q = Math.min(1, e / 0.9); c.globalAlpha = E; const g = c.createRadialGradient(W / 2, H / 2, 80 + 300 * (1 - q), W / 2, H / 2, 560); g.addColorStop(0, '#bfe9ff00'); g.addColorStop(1, '#d8f3ffee'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalAlpha = E * 0.25; c.fillStyle = '#4aa3df'; c.fillRect(0, 0, W, H);
    c.globalAlpha = E; c.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { const x = (hash(i) * W + Math.sin(e * 2 + i) * 14 + W) % W, y = (hash(i, 5) * H + e * (50 + hash(i, 6) * 90)) % H, r = 1.5 + hash(i, 7) * 2.5; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  } else if (f.kind === 'shield') {
    const q = Math.min(1, e / 1.0); c.globalAlpha = (1 - q) * 0.6; const g = c.createRadialGradient(W / 2, H / 2, 380 * q, W / 2, H / 2, 380 * q + 80); g.addColorStop(0, '#7fc4ff00'); g.addColorStop(0.5, '#a8d6ff'); g.addColorStop(1, '#7fc4ff00'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalAlpha = E * 0.18; c.fillStyle = '#4a8fd6'; c.fillRect(0, 0, W, H);
  } else if (f.kind === 'revive') {
    c.globalAlpha = E * 0.55; const g = c.createRadialGradient(W / 2, 0, 20, W / 2, 0, H); g.addColorStop(0, '#fff8d0'); g.addColorStop(1, '#fff8d000'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalAlpha = E; c.fillStyle = '#fffdf0'; for (let i = 0; i < 22; i++) { const x = (hash(i) * W + Math.sin(e * 1.6 + i) * 22 + W) % W, y = (hash(i, 8) * H + e * (30 + hash(i, 9) * 40)) % H; c.beginPath(); c.ellipse(x, y, 3.5, 8, Math.sin(e + i), 0, 7); c.fill(); }   // 飄落的羽毛
  } else if (f.kind === 'time') {
    c.globalAlpha = E * 0.5; c.fillStyle = '#2a1d5a'; c.fillRect(0, 0, W, H);
    c.globalAlpha = E * 0.9; c.save(); c.translate(W / 2, H / 2); const R0 = 118 + 6 * Math.sin(e * 4);
    c.strokeStyle = '#d8c8ff'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, R0, 0, 7); c.stroke(); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R0 - 10, 0, 7); c.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.lineWidth = i % 3 ? 2 : 5; c.beginPath(); c.moveTo(Math.sin(a) * (R0 - 12), -Math.cos(a) * (R0 - 12)); c.lineTo(Math.sin(a) * (R0 - 26), -Math.cos(a) * (R0 - 26)); c.stroke(); }
    const spin = e < 1.7 ? -(1 - Math.pow(1 - e / 1.7, 3)) * 18 : -18;   // 指針倒轉、漸慢，最後定格
    c.lineCap = 'round'; c.lineWidth = 7; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(spin) * 62, -Math.cos(spin) * 62); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(spin * 12) * 92, -Math.cos(spin * 12) * 92); c.stroke(); c.restore();
  }
  // 招式名稱橫幅（面對面時上下各一份）
  const bt = Math.min(1, e / 0.35), fade = Math.min(1, (1.9 - e) / 0.5);
  if (e < 1.9 && fade > 0) for (const ang of mode === 'face' ? [0, Math.PI] : [0]) {
    c.save(); c.translate(W / 2, H / 2 + (mode === 'face' ? (ang ? -150 : 150) : 120)); c.rotate(ang); c.globalAlpha = Math.max(0, fade);
    const sc = 0.6 + 0.4 * (1 - Math.pow(1 - bt, 3)); c.scale(sc, sc);
    c.fillStyle = '#000a'; c.fillRect(-W / 2, -52, W, 104);
    c.strokeStyle = u.col; c.lineWidth = 3; c.beginPath(); c.moveTo(-W / 2, -52); c.lineTo(W / 2, -52); c.moveTo(-W / 2, 52); c.lineTo(W / 2, 52); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = u.col; c.shadowBlur = 24; c.fillStyle = '#fff'; c.font = 'bold 50px "Noto Serif CJK TC","PingFang TC",serif'; c.fillText(u.title, 0, -8);
    c.shadowBlur = 0; c.fillStyle = u.col; c.font = 'bold 16px sans-serif'; c.fillText(u.sub, 0, 33); c.restore();
  }
  c.restore();
}
// 持續狀態：神之護盾有效期間，己方棋子外圍有藍色光罩（2D 用）
function drawShieldAura(p) {
  if (!(immune[p.s] > 0)) return;
  const t = performance.now() / 1000;
  ctx.save(); ctx.globalAlpha = 0.28 + 0.12 * Math.sin(t * 3); ctx.fillStyle = '#7fc4ff'; ctx.beginPath(); ctx.arc(0, 0, R + 8, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.85; ctx.strokeStyle = '#d8efff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R + 8, 0, 7); ctx.stroke();
  ctx.lineWidth = 1; for (let j = 0; j < 6; j++) { const a = t * 1.2 + j * Math.PI / 3; ctx.beginPath(); ctx.arc(0, 0, R + 8, a, a + 0.5); ctx.stroke(); }
  ctx.restore();
}
