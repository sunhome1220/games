// ----- 繪圖 -----
function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
// 以 (x,y) 為中心旋轉 ang 後，在相對位移 dy 處寫字（可加白邊）
function textAt(txt, x, y, dy, ang, fill, stroke) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  if (stroke) { ctx.strokeStyle = stroke; ctx.strokeText(txt, 0, dy); }
  ctx.fillStyle = fill; ctx.fillText(txt, 0, dy); ctx.restore();
}
function heart(x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.4);
  ctx.bezierCurveTo(x - s * 0.15, y + s * 0.25, x - s * 0.5, y + s * 0.05, x - s * 0.5, y - s * 0.15);
  ctx.bezierCurveTo(x - s * 0.5, y - s * 0.45, x - s * 0.1, y - s * 0.5, x, y - s * 0.2);
  ctx.bezierCurveTo(x + s * 0.1, y - s * 0.5, x + s * 0.5, y - s * 0.45, x + s * 0.5, y - s * 0.15);
  ctx.bezierCurveTo(x + s * 0.5, y + s * 0.05, x + s * 0.15, y + s * 0.25, x, y + s * 0.4);
  ctx.closePath();
}
function drawBoard() {
  ctx.fillStyle = '#e8c88a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7fa7b866'; ctx.fillRect(0, gy(4), W, C);              // 河道（泥濘）
  ctx.fillStyle = '#c0392b14'; ctx.fillRect(gx(3), gy(7), 2 * C, 2 * C);  // 九宮
  ctx.fillStyle = '#0000000f'; ctx.fillRect(gx(3), gy(0), 2 * C, 2 * C);
  ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 1.5;
  for (let r = 0; r <= 9; r++) line(gx(0), gy(r), gx(8), gy(r));
  line(gx(0), gy(0), gx(0), gy(9)); line(gx(8), gy(0), gx(8), gy(9));
  for (let c = 1; c < 8; c++) { line(gx(c), gy(0), gx(c), gy(4)); line(gx(c), gy(5), gx(c), gy(9)); }
  for (const r of [0, 7]) { line(gx(3), gy(r), gx(5), gy(r + 2)); line(gx(5), gy(r), gx(3), gy(r + 2)); }
  ctx.lineWidth = 3; ctx.strokeRect(gx(0) - 6, gy(0) - 6, 8 * C + 12, 9 * C + 12);
  ctx.fillStyle = '#4a5f6b'; ctx.font = 'bold 28px "KaiTi","STKaiti","DFKai-SB","BiauKai","Noto Serif TC",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  textAt('楚　河', gx(2), gy(4.5), 0, textAng(0), '#4a5f6b'); textAt('漢　界', gx(6), gy(4.5), 0, textAng(1), '#4a5f6b');
}
// 棋子上方的兵種圖示（在棋子的文字座標系，y < 0 為上方）
const AIM_BASE = { C: -1.05, E: -0.8 };   // 圖示本身的仰角
// 攻擊中武器圖示要額外轉的角度（漸入 0.08 秒、最後 0.3 秒轉回）
function aimRot(p, base = 0) {
  if (!(p.aimT > 0)) return 0;
  const aw = Math.max(0, Math.min(1, (AIM_T - p.aimT) / 0.08, p.aimT / 0.3));
  const d = Math.atan2(Math.sin(p.aimA - textAng(p.s)), Math.cos(p.aimA - textAng(p.s)));
  return aw * (d - base);
}
function drawIcon(p) {
  const k = p.T.id === 'P2' ? 'P2' : p.t, dark = '#2b2b2b', acc = SIDE[p.s].col;
  ctx.save(); ctx.translate(0, -R - 11); ctx.scale(1.25, 1.25); ctx.lineJoin = 'round';
  if (k !== 'K' && k !== 'G') ctx.rotate(aimRot(p, AIM_BASE[k] || 0));   // 攻擊時，有方向性的武器轉向攻擊方向（炮、防空的圖示本身有仰角，要扣掉）
  const fill = (c, fn) => { ctx.fillStyle = c; ctx.beginPath(); fn(); ctx.fill(); };
  if (k === 'K') {          // 軍官帽
    fill(dark, () => { ctx.moveTo(-9, 1); ctx.quadraticCurveTo(-9, -8, 0, -8); ctx.quadraticCurveTo(9, -8, 9, 1); ctx.closePath(); });
    ctx.fillStyle = acc; ctx.fillRect(-8, -1, 16, 3);
    fill('#111', () => { ctx.moveTo(-8, 2); ctx.quadraticCurveTo(0, 7, 8, 2); ctx.closePath(); });
    fill('#f1c40f', () => ctx.arc(0, -4, 2.3, 0, Math.PI * 2));
  } else if (k === 'G') {   // 盾牌
    fill('#2f6fb5', () => { ctx.moveTo(0, -8); ctx.lineTo(7, -5.5); ctx.lineTo(6.5, 1); ctx.quadraticCurveTo(5, 6, 0, 8); ctx.quadraticCurveTo(-5, 6, -6.5, 1); ctx.lineTo(-7, -5.5); ctx.closePath(); });
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-0.8, -5.5, 1.6, 11); ctx.fillRect(-4.5, -2, 9, 1.6);
  } else if (k === 'E') {   // 防空飛彈（斜向上的飛彈＋發射架）
    ctx.fillStyle = dark; ctx.fillRect(-9, 4, 18, 3); ctx.fillRect(-2, 1, 4, 4);
    ctx.save(); ctx.rotate(-0.8);
    ctx.fillStyle = '#eee'; ctx.fillRect(-7, -1.8, 12, 3.6); ctx.strokeStyle = '#888'; ctx.lineWidth = 0.8; ctx.strokeRect(-7, -1.8, 12, 3.6);
    fill(acc, () => { ctx.moveTo(5, -1.8); ctx.lineTo(9, 0); ctx.lineTo(5, 1.8); ctx.closePath(); });
    fill('#2f6fb5', () => { ctx.moveTo(-7, -1.8); ctx.lineTo(-9, -4); ctx.lineTo(-4, -1.8); ctx.closePath(); ctx.moveTo(-7, 1.8); ctx.lineTo(-9, 4); ctx.lineTo(-4, 1.8); ctx.closePath(); });
    ctx.restore();
  } else if (k === 'R') {   // 機槍
    ctx.fillStyle = dark; ctx.fillRect(-10, -4, 9, 6); ctx.fillRect(-1, -2.5, 12, 2.4); ctx.fillRect(-7, 2, 3, 5);
    ctx.fillRect(10, -4, 1.5, 4); ctx.fillStyle = '#c8a24a'; ctx.fillRect(-4, 2, 4, 3);   // 準星、彈鏈
  } else if (k === 'N') {   // 火箭筒
    ctx.fillStyle = '#5a6b2f'; ctx.fillRect(-11, -3, 16, 6); ctx.fillStyle = dark; ctx.fillRect(-4, 3, 3, 4);
    fill(acc, () => { ctx.moveTo(5, -3.5); ctx.lineTo(11, 0); ctx.lineTo(5, 3.5); ctx.closePath(); });
  } else if (k === 'C') {   // 迫擊炮：斜立的炮管、底板、雙腳架
    ctx.fillStyle = '#6b5a3a'; ctx.beginPath(); ctx.ellipse(-3, 6.5, 7, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(1.2, -1); ctx.lineTo(6.5, 6.5); ctx.moveTo(1.2, -1); ctx.lineTo(-5, 6.5); ctx.stroke();
    ctx.save(); ctx.translate(-3, 5.5); ctx.rotate(-1.05);
    ctx.fillStyle = dark; ctx.fillRect(0, -2.2, 15, 4.4); ctx.fillStyle = '#8a8a8a'; ctx.fillRect(13.2, -3, 2.4, 6); ctx.fillStyle = '#6b5a3a'; ctx.fillRect(0, -3, 2.5, 6);
    ctx.restore();
  } else if (k === 'P') {   // 步槍
    ctx.fillStyle = dark; ctx.fillRect(-4, -1.2, 15, 2.2);
    fill('#7a4b20', () => { ctx.moveTo(-11, -1.5); ctx.lineTo(-3, -1.5); ctx.lineTo(-3, 1.5); ctx.lineTo(-11, 4); ctx.closePath(); });
  } else if (k === 'P2') {  // 霰彈槍（雙管＋彈丸）
    ctx.fillStyle = dark; ctx.fillRect(-4, -2.6, 12, 1.8); ctx.fillRect(-4, -0.4, 12, 1.8);
    fill('#7a4b20', () => { ctx.moveTo(-11, -2); ctx.lineTo(-3, -2); ctx.lineTo(-3, 1.6); ctx.lineTo(-11, 4); ctx.closePath(); });
    ctx.fillStyle = '#e0a800'; for (const [x, y] of [[10, -3], [12, -0.5], [10, 2]]) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
function drawPiece(p) {
  ctx.save();
  // 中彈抖動、開火後座力
  ctx.translate(visX(p) + (p.flash ? rnd(3) : 0) - Math.cos(p.hd) * p.recoil * 5, visY(p) + (p.flash ? rnd(3) : 0) - Math.sin(p.hd) * p.recoil * 5);
  ctx.rotate(p.hd);
  ctx.fillStyle = '#333';
  if (WHEELED.includes(p.t)) for (const [x, y] of [[-11, -R], [11, -R], [-11, R], [11, R]]) ctx.fillRect(x - 5, y - 3, 10, 6);   // 只有俥、炮、傌、相有輪子
  ctx.fillStyle = SIDE[p.s].col; ctx.beginPath(); ctx.moveTo(R + 7, 0); ctx.lineTo(R - 1, -5); ctx.lineTo(R - 1, 5); ctx.fill();
  ctx.rotate(-p.hd + textAng(p.s));   // 棋子文字、愛心朝向自己的玩家
  circle(0, 0, R); ctx.fillStyle = '#f6e3b8'; ctx.fill();
  ctx.strokeStyle = SIDE[p.s].col; ctx.lineWidth = 2.5; ctx.stroke();
  circle(0, 0, R - 4); ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = SIDE[p.s].col; ctx.font = 'bold 20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((p.T.face || p.T.n)[p.s], 0, 1);
  drawIcon(p);
  drawShieldAura(p);
  if (p.T.id === 'P2' && !p.drop) {   // 士官長：金色外圈＋官階標誌（三條 V 形臂章）
    circle(0, 0, R + 2); ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-14, R - 12 + i * 3.4 - 6); ctx.lineTo(-9, R - 6.5 + i * 3.4 - 6); ctx.lineTo(-4, R - 12 + i * 3.4 - 6); ctx.stroke(); }
  }
  if (p.cd > 0) {   // 冷卻中：棋子變暗＋右上角橘色倒數徽章（外圈＝冷卻進度，中間＝剩餘回合）
    circle(0, 0, R); ctx.fillStyle = '#1c1c1ca8'; ctx.fill();
    const bx = R - 2, by = -R + 2, k = 1 - p.cd / p.T.reload;
    circle(bx, by, 12); ctx.fillStyle = '#d35400'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by, 12, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(p.cd, bx, by + 1);
  } else if (p.T.reload && !p.drop) {   // 冷卻完畢：綠色小燈表示可用
    circle(R - 2, -R + 2, 5); ctx.fillStyle = '#2ecc71'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  if (p.flash) { circle(0, 0, R); ctx.fillStyle = `rgba(255,255,255,${p.flash * 2})`; ctx.fill(); }
  // 血量愛心：實心＝剩餘，空心＝已失去
  const n = p.T.hp, gap = 9;
  for (let i = 0; i < n; i++) {
    const hx = (i - (n - 1) / 2) * gap, f = Math.max(0, Math.min(1, p.hp - i)), full = f >= 1, part = f > 0 && !full;
    heart(hx, R + 9, 10);
    ctx.fillStyle = full ? '#e8202a' : '#0003'; ctx.fill();
    if (part) { ctx.save(); ctx.clip(); ctx.fillStyle = '#e8202a'; ctx.fillRect(hx - 5, R + 3, 10 * f, 12); ctx.restore(); }   // 部分的心（¼、½、¾）
    ctx.strokeStyle = full || part ? '#fff' : '#0006'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}
// 老式雷達掃描：同心圓距離環、十字方位線、外圈刻度、順時針旋轉的掃描線與逐漸消退的綠色餘暉，
// 掃過範圍內的敵人時留下光點；冷卻中變灰、轉得很慢；攔截時掃描線轉成紅色鎖定目標。
function radar(x, y, r, owner, strong = true) {
  const now = performance.now() / 1000, ready = !owner.cd, lock = owner.lock && owner.lock.t > 0 ? owner.lock : null;
  const A = strong ? 1 : 0.55, ph = pieces.indexOf(owner) * 1.3;
  const ang = lock ? lock.a : ready ? now * 1.7 + ph : now * 0.3 + ph;
  const col = lock ? '255,90,70' : ready ? '70,230,130' : '150,160,160';
  const rgba = a => `rgba(${col},${a * A})`;
  ctx.save();
  circle(x, y, r); ctx.fillStyle = rgba(0.07); ctx.fill();                       // 螢幕底色
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) { circle(x, y, r * i / 3); ctx.strokeStyle = rgba(i === 3 ? 0.75 : 0.28); ctx.lineWidth = i === 3 ? 2 : 1; ctx.stroke(); }
  ctx.strokeStyle = rgba(0.25); ctx.lineWidth = 1;                              // 十字方位線
  line(x - r, y, x + r, y); line(x, y - r, x, y + r);
  ctx.strokeStyle = rgba(0.6); ctx.lineWidth = 1.5;                             // 外圈刻度（每 15°，每 45° 較長）
  for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, l = i % 3 === 0 ? 7 : 3.5; line(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r - l), y + Math.sin(a) * (r - l)); }
  if (ready || lock) {                                                          // 掃描餘暉：越遠離掃描線越淡
    const N = 30, step = 0.05;
    for (let i = 0; i < N; i++) {
      const a1 = ang - i * step, a0 = a1 - step - 0.004, k = 1 - i / N;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, a0, a1); ctx.closePath();
      ctx.fillStyle = rgba(0.4 * k * k); ctx.fill();
    }
  } else { ctx.setLineDash([2, 6]); }                                           // 冷卻中：只剩一條暗淡的慢速掃描線
  ctx.strokeStyle = rgba(ready || lock ? 0.95 : 0.4); ctx.lineWidth = lock ? 3 : 2;
  line(x, y, x + Math.cos(ang) * r, y + Math.sin(ang) * r); ctx.setLineDash([]);
  if (ready && !lock) {                                                         // 範圍內的敵人：被掃描線掃過時亮起光點，之後漸暗
    for (const q of alive()) {
      if (q.s === owner.s) continue;
      const dx = q.x - x, dy = q.y - y;
      if (Math.hypot(dx, dy) > r + 1) continue;
      const d = (((ang - Math.atan2(dy, dx)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), br = Math.max(0, 1 - d / 3.2);
      if (br <= 0.02) continue;
      circle(q.x, q.y, 3 + 5 * br); ctx.fillStyle = rgba(0.9 * br); ctx.fill();
      circle(q.x, q.y, 6 + 14 * (1 - br)); ctx.strokeStyle = rgba(0.6 * br); ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  if (lock) { circle(x + Math.cos(ang) * r * 0.9, y + Math.sin(ang) * r * 0.9, 6 + Math.sin(now * 25) * 2); ctx.strokeStyle = rgba(1); ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}
function rangeRing(p, x, y) {
  if (p.T.knight && p.T.alt) {   // 傌：步槍近戰圈＋火箭可打的 8 個日字位置（火箭冷卻中變淡）
    const R1 = p.T.alt.range;
    circle(x, y, R1); ctx.fillStyle = '#c0392b14'; ctx.fill(); ctx.strokeStyle = '#c0392b88'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke();
    ctx.globalAlpha = p.cd ? 0.3 : 1; ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2;
    for (const [sx, sy] of [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]]) { circle(x + sx * C, y + sy * C, 13); ctx.fillStyle = '#c0392b22'; ctx.fill(); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.setLineDash([]);
    return;
  }
  p = { ...p, T: weaponOf(p) };   // 冷卻中顯示步槍射程
  if (p.T.ortho) {   // 炮：只能打橫線／直線，距離 min～range
    const a = p.T.min, r = p.T.range;
    ctx.strokeStyle = '#c0392b88'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.globalAlpha = 0.16;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) line(x + dx * a, y + dy * a, x + dx * r, y + dy * r);
    ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) line(x + dx * a, y + dy * a, x + dx * r, y + dy * r);
    ctx.setLineDash([]);
    return;
  }
  if (p.T.aa) {   // 象：雷達（防空）＋近戰圈＋田字對角攻擊點
    radar(x, y, p.T.aa, p, true);
    ctx.strokeStyle = '#c0392b88'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); circle(x, y, p.T.melee); ctx.stroke();
    ctx.strokeStyle = '#c0392b'; for (const [sx, sy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) { circle(x + sx * C, y + sy * C, 13); ctx.fillStyle = '#c0392b22'; ctx.fill(); ctx.stroke(); }
    ctx.setLineDash([]); return;
  }
  circle(x, y, p.T.range); ctx.fillStyle = '#c0392b14'; ctx.fill();
  ctx.strokeStyle = '#c0392b88'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke();
  if (p.T.min) { circle(x, y, p.T.min); ctx.strokeStyle = '#5558'; ctx.stroke(); }
  ctx.setLineDash([]);
}
function marks(list, T, ghost) {
  for (const t of list) {
    const { x, y } = t.p;
    ctx.globalAlpha = ghost ? 0.5 : 1;
    const Tt = t.T || T;
    if (t.ok && Tt && Tt.splash) {   // 炮的爆炸範圍
      circle(x, y, Tt.splash); ctx.fillStyle = '#e67e2214'; ctx.fill();
      ctx.strokeStyle = '#e67e2288'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    if (t.ok) {
      ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 3;
      circle(x, y, R + 7 + Math.sin(performance.now() / 120) * 2); ctx.stroke();
      line(x - R - 12, y, x - R - 2, y); line(x + R + 2, y, x + R + 12, y);
      line(x, y - R - 12, x, y - R - 2); line(x, y + R + 2, x, y + R + 12);
      if (t.est) {   // 預估傷害
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3;
        const gd = guardBlock(t.p, state === 'select' && sel ? (sel.dest ? { x: sel.dest[0], y: sel.dest[1] } : sel.p) : mover || t.p, Tt);   // 會被防空攔截的目標不再特別標示
        textAt(gd ? '🛡 仕會擋' : '-' + hearts(t.est), x, y, -R - 30, textAng(turn), gd ? '#2f6fb5' : '#e8202a', '#fff');
      }
    } else {
      ctx.strokeStyle = '#7778'; ctx.lineWidth = 2; circle(x, y, R + 5); ctx.stroke();
      ctx.font = 'bold 12px sans-serif'; textAt(t.why, x, y, -R - 30, textAng(turn), '#555', '#fff');
    }
  }
  ctx.globalAlpha = 1;
}
function drawDecals() {   // 地上的焦痕
  for (const d of decals) {
    const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
    g.addColorStop(0, '#2a1a0a88'); g.addColorStop(0.6, '#3a2a1a44'); g.addColorStop(1, '#3a2a1a00');
    circle(d.x, d.y, d.r); ctx.fillStyle = g; ctx.fill();
  }
}
function drawParts() { for (const p of parts) drawPart(p); ctx.globalAlpha = 1; }
function drawPart(p) {
  const a = p.t / p.L, k = 1 - a;
  ctx.globalAlpha = Math.min(1, a * 1.5);
  if (p.k === 'spark') {
    ctx.strokeStyle = p.col; ctx.lineWidth = p.size;
    line(p.x, p.y, p.x - p.vx * 0.03, p.y - p.vy * 0.03);
  } else if (p.k === 'fire') {
    circle(p.x, p.y, p.size * (0.5 + k * 0.8)); ctx.fillStyle = a > 0.5 ? '#ffd166' : p.col; ctx.fill();
  } else if (p.k === 'smoke') {
    ctx.globalAlpha = 0.45 * a; circle(p.x, p.y, p.size * (0.6 + k * 1.4)); ctx.fillStyle = p.col; ctx.fill();
  } else if (p.k === 'debris') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + k * 10); ctx.fillStyle = p.col;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6); ctx.restore();
  } else if (p.k === 'ring') {
    circle(p.x, p.y, 6 + p.size * k); ctx.strokeStyle = '#fff4d0'; ctx.lineWidth = 5 * a; ctx.stroke();
  } else if (p.k === 'flash') {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#fff1a8'); g.addColorStop(1, '#ffb43000');
    circle(p.x, p.y, p.size); ctx.fillStyle = g; ctx.fill();
  }
}
// 空投：運輸機由左飛向右 → 在目標上方投下降落傘補給箱 → 緩降落地
function drawDrop(f) {
  const k = 1 - Math.max(0, f.t) / f.T, top = Math.max(26, f.y - 220);
  const plx = -40 + (f.x + 40) * k / 0.22;   // 飛到目標正上方時（k = 0.22）投下補給箱，之後繼續飛出畫面
  if (plx < W + 40) {   // 運輸機
    ctx.save(); ctx.translate(plx, top - 14); ctx.fillStyle = '#4a5a3a';
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-4, -2, 8, 22); ctx.fillRect(-22, -2, 10, 10); ctx.fillStyle = '#2b3a22'; ctx.fillRect(-26, -9, 6, 8);
    ctx.fillStyle = '#9fd0e8'; ctx.fillRect(14, -3, 7, 4); ctx.restore();
  }
  const rel = 0.22;   // 投放時間
  if (k < rel) return;
  const fall = Math.min(1, (k - rel) / (LAND_AT - rel)), e = 1 - (1 - fall) * (1 - fall) * (1 - fall);
  const cx = f.x + Math.sin(fall * 9) * 6 * (1 - fall), cy = top + (f.y - top) * e - 4;
  if (k >= LAND_AT) {   // 落地後：箱子與降落傘留在原地淡出
    const a = Math.max(0, 1 - (k - LAND_AT) / 0.18);
    if (a <= 0) return;
    ctx.globalAlpha = a; crate(f.x, f.y - 4, 0); ctx.globalAlpha = 1; return;
  }
  crate(cx, cy, 1 - fall * 0.15);
}
function crate(x, y, chute) {
  if (chute) {   // 降落傘
    ctx.fillStyle = '#e8e8e8'; ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 20, y - 26); ctx.quadraticCurveTo(x, y - 52 * chute, x + 20, y - 26); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d6453a'; ctx.beginPath(); ctx.moveTo(x - 7, y - 36 * chute - 4); ctx.quadraticCurveTo(x, y - 48 * chute, x + 7, y - 36 * chute - 4); ctx.lineTo(x + 6, y - 26); ctx.lineTo(x - 6, y - 26); ctx.fill();
    ctx.strokeStyle = '#777'; ctx.beginPath(); ctx.moveTo(x - 20, y - 26); ctx.lineTo(x - 7, y - 3); ctx.moveTo(x + 20, y - 26); ctx.lineTo(x + 7, y - 3); ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 3); ctx.stroke();
  }
  ctx.fillStyle = '#a77b3f'; ctx.fillRect(x - 8, y - 4, 16, 12); ctx.strokeStyle = '#5a3d17'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 8, y - 4, 16, 12);
  ctx.beginPath(); ctx.moveTo(x - 8, y + 2); ctx.lineTo(x + 8, y + 2); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 8); ctx.stroke();
  ctx.fillStyle = '#d6453a'; ctx.fillRect(x - 2.5, y - 1.5, 5, 5);
}
function drawProj(f) {
  if (f.delay > 0) return;
  if (f.k === 'drop') { drawDrop(f); return; }
  if (f.k === 'ult') { drawUltWorld(f, P2D); return; }
  const [x, y, gx0, gy0, k] = projPos(f);
  if (f.k === 'pellets') {
    const k = 1 - Math.max(0, f.t) / f.T;
    for (const r of f.rays) {
      const x = f.x1 + (r.x - f.x1) * k, y = f.y1 + (r.y - f.y1) * k;
      ctx.strokeStyle = '#fff7c2'; ctx.lineWidth = 2; line(x - Math.cos(r.dir) * 8, y - Math.sin(r.dir) * 8, x, y);
      circle(x, y, 1.8); ctx.fillStyle = '#ffd23f'; ctx.fill();
    }
    return;
  }
  if (f.k === 'tracer') {   // 曳光彈：橘紅尾跡＋亮黃彈頭
    const bx = x - Math.cos(f.dir) * 26, by = y - Math.sin(f.dir) * 26;
    ctx.lineCap = 'round'; ctx.strokeStyle = '#ff6a1fcc'; ctx.lineWidth = 3; line(bx, by, x, y);
    ctx.strokeStyle = '#fff3a8'; ctx.lineWidth = 2; line(x - Math.cos(f.dir) * 10, y - Math.sin(f.dir) * 10, x, y); ctx.lineCap = 'butt';
  } else if (f.k === 'bullet') {
    const bx = x - Math.cos(f.dir) * 16, by = y - Math.sin(f.dir) * 16;
    ctx.strokeStyle = '#fff7c2'; ctx.lineWidth = 3; line(bx, by, x, y);
    ctx.strokeStyle = f.side ? '#555' : '#ff6b4a'; ctx.lineWidth = 1; line(bx, by, x, y);
  } else if (f.k === 'rocket') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(f.dir);
    ctx.fillStyle = '#ffb030'; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-16 - Math.random() * 6, 0); ctx.lineTo(-8, 3); ctx.fill();
    ctx.fillStyle = f.side ? '#333' : '#b03020'; ctx.fillRect(-8, -3, 14, 6);
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(11, 0); ctx.lineTo(6, 3); ctx.fill();
    ctx.restore();
  } else if (f.k === 'shell') {
    const lift = Math.sin(k * Math.PI);
    ctx.fillStyle = `rgba(0,0,0,${0.35 - lift * 0.2})`;   // 地面影子
    ctx.beginPath(); ctx.ellipse(gx0, gy0, 7 - lift * 3, 4 - lift * 2, 0, 0, Math.PI * 2); ctx.fill();
    const [nx, ny] = projPos({ ...f, t: Math.max(0, f.t - f.T * 0.03) }), ang = Math.atan2(ny - y, nx - x), sc = 1 + lift * 0.5;   // 迫擊砲彈：帶尾翼的水滴形，沿拋物線轉向
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc);
    ctx.fillStyle = '#556b2f'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(5.5, -1.6); ctx.lineTo(8.5, 0); ctx.lineTo(5.5, 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillRect(-9, -3.6, 4, 1.4); ctx.fillRect(-9, 2.2, 4, 1.4); ctx.fillRect(-9, -0.6, 5, 1.2);
    ctx.restore();
  }
}
// 地面層：棋盤、焦痕、交叉點、雷達、選取與範圍提示（立體模式把它畫成貼在棋盤上的貼圖）
function drawGround() {
  drawBoard();
  drawDecals();
  // 交叉點標記（可停的定點）與相的防空範圍（冷卻中變灰）
  ctx.fillStyle = '#6b442355';
  for (let c = 0; c <= 8; c++) for (let r = 0; r <= 9; r++) { circle(gx(c), gy(r), 2.5); ctx.fill(); }
  for (const h of alive()) if (h.T.aa && !(sel && sel.p === h)) radar(h.x, h.y, h.T.aa, h, false);
  if (state === 'aim') for (const p of alive()) if (p.s === turn) {
    circle(p.x, p.y, R + 5); ctx.strokeStyle = turn ? '#0005' : '#c0392b66'; ctx.lineWidth = 3; ctx.stroke();
  }
  let preview = [];
  let markT = null, ghost = false;
  if (sel) {
    const p = sel.p;
    circle(p.x, p.y, R + 6); ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 3; ctx.stroke();
    let ex = p.x, ey = p.y;
    if (sel.dest) {
      [ex, ey] = sel.dest;
      ctx.strokeStyle = SIDE[p.s].col; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); line(p.x, p.y, ex, ey); ctx.setLineDash([]);
      circle(ex, ey, R); ctx.stroke();
    }
    const T = p.T.locked && crossed(p.s, ey) ? TT[p.s].P2 : null;   // 這步會過河就用霰彈槍預覽
    rangeRing(T ? { T } : p, ex, ey);
    for (const [x, y] of sel.moves) {   // 可走的點
      const on = sel.dest && sel.dest[0] === x && sel.dest[1] === y;
      circle(x, y, on ? 11 : 8); ctx.fillStyle = on ? '#ffd400' : '#2ecc71cc'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    // 未選目的地：顯示原地可攻擊的目標；已選：預覽到目的地後可打到誰（淡色）
    preview = sel.dest ? scan(p, ex, ey, T) : sel.scan; markT = T; ghost = !!sel.dest;
    if (p.T.aa) for (const q of alive())   // 預覽：哪些友軍會在防空保護範圍內
      if (q !== p && q.s === p.s && Math.hypot(q.x - ex, q.y - ey) <= p.T.aa + 1) {
        circle(q.x, q.y, R + 5); ctx.strokeStyle = '#2f6fb5aa'; ctx.lineWidth = 3; ctx.stroke();
      }
  }
  if (state === 'target') {
    rangeRing(mover, mover.x, mover.y);
    if (!moved) { circle(mover.x, mover.y, R + 6); ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]); }
  }
  return { preview, markT, ghost };
}
function draw() {
  ctx.save();
  if (viewFlip()) { ctx.translate(W, H); ctx.rotate(Math.PI); }
  if (shake) ctx.translate(rnd(shake), rnd(shake));
  const { preview, markT, ghost } = drawGround();
  for (const p of alive()) drawPiece(p);
  marks(state === 'target' ? targets : preview, markT, ghost);
  for (const f of fx) if (f.k !== 'txt') drawProj(f);
  drawParts();
  drawRevenge();
  for (const f of fx) if (f.k === 'txt') drawTxtFx(f);
  ctx.restore();
  for (const f of fx) if (f.k === 'ult') drawUltScreen(f);
  drawOver();
}
function drawTxtFx(f) {
  if (f.delay > 0) return;   // 還沒到出現時間
  const a = f.t / f.T;
  ctx.globalAlpha = Math.min(1, a * 2); ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; textAt(f.txt, Math.min(W - 70, Math.max(70, f.x)), f.y, -(1 - a) * 30, textAng(f.side ?? turn), f.col || '#e00', '#fff');
  ctx.globalAlpha = 1;
}
// 犄角：還能殺回的仕／象畫一條紅色虛線箭頭指向陣亡位置（走法本來就走得到，路徑上不會有棋子），陣亡位置畫紅色虛線圈「殺回」；
// 整體微微閃動。雙方都看得到（殺回機會從兄弟陣亡起，到下一個自己回合結束為止）。回傳畫了幾支箭頭
function drawRevenge() {
  if (state === 'over' || state === 'pick' || winner !== null) return 0;
  const seen = new Set(), pulse = 0.65 + 0.35 * Math.sin(performance.now() / 220);
  let n = 0;
  ctx.save(); ctx.globalAlpha = pulse;
  for (const p of alive()) {
    const tok = p.rv;
    if (!tok || !revengeOk(tok)) continue;
    if (!seen.has(tok)) {
      seen.add(tok);
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      circle(tok.x, tok.y, R + 6 + Math.sin(performance.now() / 200) * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; textAt('殺回', tok.x, tok.y, R + 22, textAng(tok.side), '#c0392b', '#fff');
    }
    const dx = tok.x - p.x, dy = tok.y - p.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const x1 = p.x + ux * (R + 3), y1 = p.y + uy * (R + 3), x2 = tok.x - ux * (R + 9), y2 = tok.y - uy * (R + 9);
    ctx.strokeStyle = ctx.fillStyle = '#c0392b'; ctx.lineWidth = 3; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * 8, y2 - uy * 8); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - ux * 14 - uy * 7, y2 - uy * 14 + ux * 7); ctx.lineTo(x2 - ux * 14 + uy * 7, y2 - uy * 14 - ux * 7); ctx.closePath(); ctx.fill();
    n++;
  }
  ctx.restore();
  return n;
}
// 結束畫面（勝負／和局）
function drawOver() {
  if (state === 'over') {
    ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const title = online() || mode === 'ai' ? (winner === 2 ? '和局' : winner === mySide ? '你贏了！' : mode === 'ai' ? '電腦獲勝…' : '你輸了…') : winner === 2 ? '和局' : SIDE[winner].name + ' 勝利！';
    // 面對面時上下各一份，兩位玩家都看得到
    for (const ang of mode === 'face' ? [0, Math.PI] : [0]) {
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(ang);
      const dy = mode === 'face' ? 90 : 0;
      ctx.fillStyle = winner === 0 ? '#ff7b6b' : '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.fillText(title, 0, dy - 10);
      ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText('點擊棋盤回到設定頁', 0, dy + 34);
      if (overReason) { ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#ffd166'; ctx.fillText(overReason === 'resign' ? `${SIDE[1 - winner].name}認輸` : `${SIDE[1 - winner].name}只剩帥／仕／象，已守不住`, 0, dy + 68); }
      ctx.restore();
    }
  }
}
let last = performance.now();
function loop(now) { update(Math.min(0.05, (now - last) / 1000)); last = now; draw(); requestAnimationFrame(loop); }

$('legend').innerHTML = '<tr><th>兵種</th><th>武器</th><th>血量</th><th>移動(格)</th><th>射程(格)</th><th>威力</th><th>特性</th></tr>' +
  Object.values(TYPES).map(T => `<tr><td>${T.n.join('/')}${T.tag || ''}</td><td>${T.w}</td><td class="num hp" style="color:#e8202a">♥${+T.hp.toFixed(2)}</td><td>${T.knight ? '日字' : T.aa ? '田字' : T.guard ? '斜 1' : T.dist >= 9 * C ? '不限' : (T.dist / C).toFixed(1)}</td>` +
    `<td>${T.guard ? '手槍 ' + (T.range / C).toFixed(1) : T.aa ? '手槍 ' + (T.melee / C).toFixed(1) + '／田字／攔截 ' + (T.aa / C).toFixed(1) : (T.min ? (T.min / C).toFixed(1) + '～' : '') + (T.range / C).toFixed(1)}</td><td class="num" style="color:#e8202a">${+T.dmg.toFixed(2)}</td>` +
    `<td>${T.indirect ? `曲射，越過障礙；相鄰受 1/2、斜角受 1/4 傷害（敵我皆傷）；走法同車；只能打同一橫線／直線上、距離 4～5.2 格的目標；射後裝填 ${T.reload} 回合，冷卻期間完全無法攻擊（包括近戰），近距離毫無辦法` : T.guard ? '限九宮斜走一格；手槍可打相鄰與斜角的敵人；帥被直射（非炮、非火箭）時，若仕的某個落點剛好在射線上，會自動走過去擋下並換位；犄角：仕、象互相掩護——一方被敵人擊毀時，另一位仕／象若照一般走法走得到陣亡位置，下個回合多一項能力：走到那裡後可改射復仇者飛彈（威力 2、射程 4 格）打殺死兄弟的那個棋子，要不要走過去由你決定' : T.palace ? '限九宮' : T.aa ? `自動攔截落點在範圍內的火箭／砲彈（攔截後冷卻：對方接下來 ${T.reload} 次攻擊攔截不了）；手槍可打相鄰與田字對角點的敵人；走田字（象眼被塞就過不去；田字走不了時改走一步）；犄角：被擊毀時，仕或另一隻象若走得到陣亡位置，下個回合走到那裡後可射復仇者飛彈（威力 2、射程 4 格）打殺死兄弟的棋子` : T.line ? '走法如傳統象棋的車：橫線／直線不限距離（不能穿過棋子）；機槍只能打同一橫線／直線上的目標（比炮短 1 格），直射會被擋' : T.knight ? '走日字（可跳過棋子），蹩馬腳不能走；日字都走不了時改走一步；火箭只能打日字位置、可被相攔截；近戰隨時可用步槍（1 心）' : T.locked ? '只能前進一格' : T.pellets ? '扇形霰彈，越近越痛；每次最多走 2 格，可前進或橫移，不能往後退' : '直射，會被擋'}${T.alt && !T.indirect ? `；射後裝填 ${T.reload} 回合（期間改用步槍）` : ''}</td></tr>`).join('');
// 兵種說明：點「📖 兵種」才開啟彈窗，遊戲頁本身維持整頁不捲動
$('legendBtn').onclick = () => { $('legendOv').hidden = false; };
$('legendClose').onclick = () => { $('legendOv').hidden = true; };
$('legendOv').onclick = e => { if (e.target === $('legendOv')) $('legendOv').hidden = true; };
