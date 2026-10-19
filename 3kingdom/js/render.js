// ===== 繪圖：地圖與攻城場景 =====
const $ = id => document.getElementById(id);
const cv = $('map'), ctx = cv.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);
cv.width = MW * DPR; cv.height = MH * DPR;
const view = { targets: [], hover: null, t: 0, animT: 1, ghosts: [], flash: [] };
// 小螢幕上地圖被縮小，城池與文字依實際顯示寬度放大一點才看得清楚
const viewK = () => Math.max(1, Math.min(1.6, 0.55 + (MW / (cv.clientWidth || MW)) * 0.45));   // targets：選擇出兵目標時要標亮的城
const fcol = f => (FACTIONS[f] || FACTIONS.none).col;

function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function drawTerrain(c) {
  const g = c.createLinearGradient(0, 0, MW, MH); g.addColorStop(0, '#e9d7a8'); g.addColorStop(1, '#d6c08a'); c.fillStyle = g; c.fillRect(0, 0, MW, MH);
  c.strokeStyle = '#c4aa6f33'; c.lineWidth = 1; for (let i = 0; i < 40; i++) line(c, 0, i * 14, MW, i * 14 + 30);
  // 黃河（北）、長江（南）
  c.lineCap = 'round'; c.lineWidth = 9; c.strokeStyle = '#8fc0d8aa';
  c.beginPath(); c.moveTo(20, 80); c.bezierCurveTo(200, 20, 330, 120, 470, 60); c.bezierCurveTo(580, 20, 680, 80, 790, 40); c.stroke();
  c.beginPath(); c.moveTo(20, 425); c.bezierCurveTo(160, 350, 300, 440, 450, 412); c.bezierCurveTo(580, 385, 690, 450, 790, 430); c.stroke();
  c.lineCap = 'butt'; c.fillStyle = '#5b86a0'; c.font = 'italic 13px serif'; c.textAlign = 'center'; c.fillText('黃河', 330, 62); c.fillText('長　江', 330, 440);
  // 山脈
  c.fillStyle = '#a8946066'; for (const [x, y] of [[140, 210], [200, 230], [165, 330], [300, 255], [470, 440]]) { c.beginPath(); c.moveTo(x - 22, y + 12); c.lineTo(x, y - 14); c.lineTo(x + 22, y + 12); c.closePath(); c.fill(); }
}
function drawRoads(c) {
  const sel = G.selected;
  for (const [a, b] of EDGES) {
    const p = cityById(a), q = cityById(b), hot = sel && (sel === a || sel === b);
    c.strokeStyle = hot ? '#7a4a1a' : '#8a6a3acc'; c.lineWidth = hot ? 4 : 2.5; c.setLineDash([9, 6]); line(c, p.x, p.y, q.x, q.y); c.setLineDash([]);
  }
}
function drawCity(c, city) {
  const col = fcol(city.owner), under = besieged(city.id), sel = G.selected === city.id, tgt = view.targets.includes(city.id);
  const k = viewK(); c.save(); c.translate(city.x, city.y); c.scale(k, k);
  if (sel || tgt) { c.strokeStyle = tgt ? '#ffd400' : '#fff'; c.lineWidth = 3; c.setLineDash(tgt ? [5, 4] : []); c.beginPath(); c.arc(0, 0, 30 + (tgt ? Math.sin(view.t * 6) * 2 : 0), 0, 7); c.stroke(); c.setLineDash([]); }
  c.fillStyle = '#00000030'; c.beginPath(); c.ellipse(0, 16, 24, 7, 0, 0, 7); c.fill();
  // 城牆與城樓
  c.fillStyle = '#7d7468'; c.fillRect(-22, -4, 44, 20); c.fillStyle = '#9a9184'; c.fillRect(-22, -4, 44, 5);
  for (let i = -22; i < 22; i += 9) c.fillRect(i, -9, 5, 6);   // 垛口
  c.fillStyle = col; c.fillRect(-9, -22, 18, 18); c.fillStyle = '#00000040'; c.fillRect(-9, -22, 18, 4);
  c.fillStyle = '#3a2a1a'; c.beginPath(); c.moveTo(-12, -22); c.lineTo(0, -32); c.lineTo(12, -22); c.closePath(); c.fill();   // 屋頂
  c.fillStyle = '#2a1d12'; c.fillRect(-4, 4, 8, 12);   // 城門
  if (city.capital) { c.fillStyle = '#ffd400'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.fillText('★', 0, -36); }
  c.fillStyle = '#fff'; c.strokeStyle = '#0008'; c.lineWidth = 3; c.font = 'bold 14px sans-serif'; c.textAlign = 'center';
  c.strokeText(city.name, 0, 33); c.fillText(city.name, 0, 33);
  c.font = '12px sans-serif'; const tx = '⚔' + Math.round(city.troops); c.strokeText(tx, 0, 46); c.fillText(tx, 0, 46);
  // 城牆耐久
  c.fillStyle = '#0006'; c.fillRect(-20, 50, 40, 5); c.fillStyle = city.wall / city.wallMax > 0.4 ? '#c9b78f' : '#e0584a'; c.fillRect(-20, 50, 40 * city.wall / city.wallMax, 5);
  if (under) { c.font = '20px serif'; c.fillText('🔥', 24, -14 + Math.sin(view.t * 8) * 2); const s = G.sieges.find(x => x.city === city.id); c.strokeStyle = fcol(s.attacker); c.lineWidth = 3; c.setLineDash([6, 5]); c.beginPath(); c.arc(0, 0, 38, view.t, view.t + 5); c.stroke(); c.setLineDash([]); }
  c.restore();
}
function armyPos(a, t) {
  const p = cityById(a.from), q = cityById(a.to), s = Math.min(a.len, a.prev + (a.pos - a.prev) * t) / a.len;
  return [p.x + (q.x - p.x) * s, p.y + (q.y - p.y) * s, Math.atan2(q.y - p.y, q.x - p.x)];
}
function drawArmy(c, a, t) {
  const [x, y, ang] = armyPos(a, t), col = fcol(a.owner);
  const k = viewK(); c.save(); c.translate(x, y); c.scale(k, k);
  c.fillStyle = '#00000030'; c.beginPath(); c.ellipse(0, 9, 11, 4, 0, 0, 7); c.fill();
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 2; line(c, 0, 8, 0, -20);   // 旗桿
  const w = Math.sin(view.t * 7 + a.id) * 2; c.fillStyle = col; c.beginPath(); c.moveTo(0, -20); c.lineTo(17 + w, -16); c.lineTo(15 - w, -9); c.lineTo(0, -8); c.closePath(); c.fill();
  c.fillStyle = '#fff'; c.font = 'bold 8px sans-serif'; c.textAlign = 'left'; c.fillText(FACTIONS[a.owner].name, 3, -12);
  c.fillStyle = '#fff'; c.strokeStyle = '#000a'; c.lineWidth = 3; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.strokeText(Math.round(a.troops), 0, 22); c.fillText(Math.round(a.troops), 0, 22);
  for (let i = 0; i < 3; i++) { c.fillStyle = col; c.fillRect(-9 + i * 7, 3 + (i % 2) * 2, 4, 5); }   // 小兵
  c.restore();
}
function drawMap() {
  const c = ctx; c.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawTerrain(c); drawRoads(c);
  for (const city of G.cities) drawCity(c, city);
  for (const a of G.armies) drawArmy(c, a, view.animT);
  for (const a of view.ghosts) drawArmy(c, a, view.animT);
  for (const f of view.flash) { c.globalAlpha = Math.max(0, f.t); c.fillStyle = '#ff9a3a'; c.beginPath(); c.arc(f.x, f.y, 40 * (1.4 - f.t), 0, 7); c.fill(); c.globalAlpha = 1; }
}
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; view.t += dt;
  for (const f of view.flash) f.t -= dt; view.flash = view.flash.filter(f => f.t > 0);
  if (G) drawMap();
  if (!$('siegeOv').hidden) drawSiegeScene();
  requestAnimationFrame(frame);
}

// ----- 攻城場景（彈窗裡的小動畫）-----
const sg = { a: null, d: null, t: 0, A0: 0, D0: 0, A1: 0, D1: 0, w0: 0, w1: 0, wm: 1, col: '#fff', run: false };
function drawSiegeScene() {
  const c = $('sgCv').getContext('2d'), W = 480, H = 230; c.setTransform(1, 0, 0, 1, 0, 0);
  const t = sg.run ? Math.min(1, (performance.now() - sg.t0) / 1800) : 0;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#b9d7ee'); g.addColorStop(0.55, '#d8e6c0'); g.addColorStop(0.56, '#8fb06a'); g.addColorStop(1, '#6f8f4f'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const wallR = sg.w0 + (sg.w1 - sg.w0) * t, wallH = 40 + 70 * Math.max(0.12, wallR / sg.wm);   // 牆越破越矮
  const gx = 300;
  // 城
  c.fillStyle = '#8b8174'; c.fillRect(gx, 190 - wallH, 120, wallH); c.fillStyle = '#a39a8b'; for (let x = gx; x < gx + 120; x += 16) c.fillRect(x, 186 - wallH, 9, 8);
  c.fillStyle = '#2a1d12'; c.fillRect(gx + 8, 148, 26, 42);   // 城門
  c.fillStyle = fcol(sg.owner); c.fillRect(gx + 88, 160 - wallH - 22, 4, 36); c.fillRect(gx + 88, 160 - wallH - 22, 22, 12);   // 旗
  if (wallR < sg.wm * 0.5) { c.strokeStyle = '#3a2a1a88'; c.lineWidth = 2; for (let i = 0; i < 4; i++) line(c, gx + 20 + i * 26, 190 - wallH + 10, gx + 30 + i * 26, 190 - wallH + 40); }
  // 兵：每 ~25 人一個點
  const na = Math.min(40, Math.ceil((sg.A0 + (sg.A1 - sg.A0) * t) / 25)), nd = Math.min(30, Math.ceil((sg.D0 + (sg.D1 - sg.D0) * t) / 25));
  const advance = sg.a === 'ladder' ? t * 90 : sg.a === 'ram' ? t * 40 : 0;
  c.fillStyle = sg.attCol;
  for (let i = 0; i < na; i++) { const x = 40 + (i % 8) * 14 + advance + (i % 3) * 4, y = 150 + Math.floor(i / 8) * 9; c.fillRect(x, y, 6, 8); }
  c.fillStyle = sg.defCol;
  for (let i = 0; i < nd; i++) { const x = gx + 6 + (i % 10) * 11, y = 190 - wallH - 8 - (Math.floor(i / 10)) * 9; if (sg.d === 'sortie' && t > 0.3) c.fillRect(gx - 20 - (t - 0.3) * 160 + (i % 5) * 9, 165 + (i % 3) * 9, 6, 8); else c.fillRect(x, y, 6, 8); }
  if (!sg.run) return;
  // 戰術特效
  const A = sg.a, D = sg.d;
  if (A === 'ram') { const rx = 150 + t * 120; c.fillStyle = '#6b4a2a'; c.fillRect(rx, 168, 70, 14); c.fillStyle = '#444'; c.fillRect(rx + 66, 166, 10, 18); c.fillStyle = '#222'; c.beginPath(); c.arc(rx + 12, 186, 6, 0, 7); c.arc(rx + 56, 186, 6, 0, 7); c.fill(); if (t > 0.55) { c.fillStyle = '#ffd23f'; for (let i = 0; i < 6; i++) c.fillRect(gx - 4 + Math.sin(i * 2 + t * 30) * 12, 160 + i * 4, 3, 3); } }
  if (A === 'ladder') { c.strokeStyle = '#6b4a2a'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { const lx = gx - 40 + i * 40; line(c, lx - 30, 190, lx + 4 * i, 190 - wallH + 6); line(c, lx - 24, 190, lx + 10 + 4 * i, 190 - wallH + 6); } }
  if (A === 'fire') { for (let i = 0; i < 14; i++) { const fx = gx + 10 + i * 8.5, fy = 190 - wallH - 6 - Math.abs(Math.sin(t * 14 + i)) * 16; c.fillStyle = i % 2 ? '#ff7a1a' : '#ffd23f'; c.beginPath(); c.arc(fx, fy, 7 - (i % 3), 0, 7); c.fill(); } c.strokeStyle = '#ff7a1a'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { const p = (t * 1.6 + i * 0.25) % 1; c.beginPath(); c.arc(150 + p * 170, 120 - Math.sin(p * Math.PI) * 60, 4, 0, 7); c.stroke(); } }
  if (A === 'starve') { c.strokeStyle = fcol(sg.attacker); c.lineWidth = 3; c.setLineDash([8, 6]); c.beginPath(); c.arc(gx + 60, 170, 120 + t * 10, Math.PI * 0.55, Math.PI * 1.6); c.stroke(); c.setLineDash([]); c.fillStyle = '#ff9a3a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(190 + i * 22, 196 - (i % 2) * 8, 3 + Math.sin(t * 20 + i), 0, 7); c.fill(); } }
  if (D === 'arrow') { c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.5; for (let i = 0; i < 18; i++) { const p = (t * 2 + i * 0.07) % 1, sx = gx + 10, sy = 190 - wallH, ex = 60 + (i % 9) * 26, ey = 160; const x = sx + (ex - sx) * p, y = sy + (ey - sy) * p - Math.sin(p * Math.PI) * 50; line(c, x, y, x + 6, y - 3); } }
  if (D === 'water') { c.fillStyle = '#4aa3df'; for (let i = 0; i < 22; i++) { const p = (t * 2.2 + i * 0.05) % 1; c.beginPath(); c.arc(gx + 10 + (i % 11) * 10, 190 - wallH + p * wallH, 3, 0, 7); c.fill(); } }
  if (D === 'hold') { c.strokeStyle = '#9fd0ffcc'; c.lineWidth = 4; c.beginPath(); c.moveTo(gx - 4, 186 - wallH); c.lineTo(gx + 124, 186 - wallH); c.lineTo(gx + 124, 192); c.lineTo(gx - 4, 192); c.closePath(); c.stroke(); }
  if (t > 0.5 && t < 0.75) { c.globalAlpha = 0.5 - Math.abs(t - 0.62) * 3; c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
}
