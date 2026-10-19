// ===== 立體（3D）畫面 =====
// 做法：遊戲邏輯仍是平面座標 (x, y)，3D 只負責「畫」與「點選」：
//  · 地面層：沿用 2D 的 drawGround()／marks() 畫到離屏畫布，當作貼圖貼在棋盤上（範圍圈、準星、綠點、雷達、焦痕…）
//  · 棋子：Three.js 立體模型（圓盤＋車輪＋隨車頭轉的底盤＋會轉向攻擊方向的武器），有陰影
//  · 特效：子彈、火箭、砲彈、爆炸粒子、愛心、冷卻徽章、飄字都畫在上方的 HUD 畫布，位置由 3D 投影而來
//  · 點選：從螢幕座標射線打到棋盤平面，換算回平面座標，直接沿用原本的 input.js
// Three.js 只在選了 3D 時才動態載入（vendor/three.min.js）。
const V3 = { ready: false, on: false, az: 0, tilt: 45, rot: true, pieces: new Map(), drops: new Map(), tex: new Map(), mats: new Map() };
const V3_FOV = 34, V3_MIN_TILT = 25, V3_MAX_TILT = 75;

// 暫時把畫布換成別張（離屏地面層／HUD 用），畫完換回來
function withCtx(c, fn) { const keep = ctx; ctx = c; try { fn(); } finally { ctx = keep; } }

async function init3D() {
  if (V3.ready) return true;
  let T;
  try { T = await import('../vendor/three.min.js'); } catch (e) { return false; }
  V3.T = T;
  const stage = document.createElement('div'); stage.id = 'stage3'; stage.hidden = true;
  V3.cv = document.createElement('canvas'); V3.hud = document.createElement('canvas'); V3.cv.id = 'cv3'; V3.hud.id = 'hud3';
  stage.append(V3.cv, V3.hud); cv.after(stage); V3.stage = stage;
  try { V3.r = new T.WebGLRenderer({ canvas: V3.cv, antialias: true, alpha: true }); } catch (e) { stage.remove(); return false; }
  V3.dpr = Math.min(window.devicePixelRatio || 1, 2);
  V3.r.setPixelRatio(V3.dpr); V3.r.shadowMap.enabled = true; V3.r.shadowMap.type = T.PCFSoftShadowMap;
  V3.scene = new T.Scene();
  V3.cam = new T.PerspectiveCamera(V3_FOV, W / H, 10, 6000);
  V3.scene.add(new T.HemisphereLight(0xffffff, 0x7a5a3a, 1.25));
  const sun = new T.DirectionalLight(0xffffff, 1.5); sun.position.set(-260, 520, 300); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 100, far: 1400 }); sun.shadow.bias = -0.0008;
  V3.scene.add(sun);
  // 地面層貼圖（離屏畫布）
  V3.flat = document.createElement('canvas'); V3.fdpr = Math.min(2, V3.dpr);
  V3.flat.width = W * V3.fdpr; V3.flat.height = H * V3.fdpr; V3.fctx = V3.flat.getContext('2d'); V3.fctx.setTransform(V3.fdpr, 0, 0, V3.fdpr, 0, 0);
  V3.flatTex = new T.CanvasTexture(V3.flat); V3.flatTex.colorSpace = T.SRGBColorSpace; V3.flatTex.anisotropy = Math.min(8, V3.r.capabilities.getMaxAnisotropy());
  const board = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshBasicMaterial({ map: V3.flatTex })); board.rotation.x = -Math.PI / 2; V3.scene.add(board);
  const shadowPlane = new T.Mesh(new T.PlaneGeometry(W, H), new T.ShadowMaterial({ opacity: 0.28 })); shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.y = 0.3; shadowPlane.receiveShadow = true; V3.scene.add(shadowPlane);
  const frame = new T.Mesh(new T.BoxGeometry(W + 26, 14, H + 26), new T.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.8 })); frame.position.y = -7.5; frame.receiveShadow = true; V3.scene.add(frame);
  V3.ray = new T.Raycaster(); V3.plane = new T.Plane(new T.Vector3(0, 1, 0), -4); V3.v = new T.Vector3(); V3.v2 = new T.Vector3();
  new ResizeObserver(resize3D).observe(stage);
  bindPointer3D();
  V3.ready = true; return true;
}

function resize3D() {
  if (!V3.ready) return;
  const w = V3.stage.clientWidth, h = V3.stage.clientHeight; if (!w || !h) return;
  V3.w = w; V3.h = h; V3.r.setSize(w, h, false);
  V3.hud.width = Math.round(w * V3.dpr); V3.hud.height = Math.round(h * V3.dpr);
  V3.cam.aspect = w / h; V3.cam.updateProjectionMatrix();
}

// ----- 相機：以棋盤中心為軸，仰角 tilt（預設 45°），方位角 = 基準（連線執黑時轉 180°）＋手指旋轉量 -----
function updateCamera() {
  const base = viewFlip() ? Math.PI : 0, az = base + V3.az, el = V3.tilt * Math.PI / 180;
  const hfov = 2 * Math.atan(Math.tan(V3_FOV * Math.PI / 360) * V3.cam.aspect);
  const dist = (W * 0.56) / Math.tan(hfov / 2);
  const sh = shake ? [rnd(shake), rnd(shake)] : [0, 0];
  V3.cam.position.set(Math.sin(az) * Math.cos(el) * dist + sh[0], Math.sin(el) * dist + sh[1], Math.cos(az) * Math.cos(el) * dist);
  V3.cam.lookAt(0, 0, 18); V3.cam.updateMatrixWorld();
}
// 世界座標（遊戲平面座標 x,y，離地高度 h）→ 螢幕座標（CSS 像素）
function P3(x, h, y) { const v = V3.v.set(x - W / 2, h, y - H / 2).project(V3.cam); return [(v.x * 0.5 + 0.5) * V3.w, (-v.y * 0.5 + 0.5) * V3.h]; }
// 在 (x,h,y) 處「每 1 個遊戲像素」約等於幾個螢幕像素
function S3(x, h, y) { const a = P3(x, h, y), b = P3(x + 20, h, y), c = P3(x, h, y + 20); return (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - a[0], c[1] - a[1])) / 40; }

// ----- 點選：螢幕座標 → 棋盤平面座標（取離地 4 的平面，棋子頂部與地面點的誤差都在容許範圍內）-----
function pos3D(e) {
  const r = V3.cv.getBoundingClientRect();
  V3.ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, V3.cam);
  const hit = V3.ray.ray.intersectPlane(V3.plane, V3.v2);
  return hit ? { x: hit.x + W / 2, y: hit.z + H / 2 } : { x: -999, y: -999 };
}
// 單指拖曳 = 旋轉視角（啟用時）；輕點 = 交給原本的點選處理（以合成的 pointerdown 轉送給 2D 畫布的監聽器）
function bindPointer3D() {
  let d = null;
  const fwd = e => cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: e.clientX, clientY: e.clientY, bubbles: true }));
  V3.cv.addEventListener('pointerdown', e => {
    if (!V3.rot) { fwd(e); return; }
    d = { x: e.clientX, y: e.clientY, drag: false }; V3.cv.setPointerCapture(e.pointerId);
  });
  V3.cv.addEventListener('pointermove', e => {
    if (!d) return;
    if (!d.drag && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.drag = true;
    if (d.drag) { V3.az -= (e.clientX - d.x) * 0.008; d.x = e.clientX; d.y = e.clientY; }
  });
  const end = e => { if (d && !d.drag && e.type === 'pointerup') fwd(e); d = null; };
  V3.cv.addEventListener('pointerup', end); V3.cv.addEventListener('pointercancel', end);
}

// ----- 棋子模型 -----
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!V3.mats.has(k)) V3.mats.set(k, new V3.T.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.25, ...o })); return V3.mats.get(k); };
function box(w, h, d, c, x = 0, y = 0, z = 0, g) { const m = new V3.T.Mesh(new V3.T.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; if (g) g.add(m); return m; }
function cyl(r1, r2, h, c, x = 0, y = 0, z = 0, g, seg = 20) { const m = new V3.T.Mesh(new V3.T.CylinderGeometry(r1, r2, h, seg), mat(c)); m.position.set(x, y, z); m.castShadow = true; if (g) g.add(m); return m; }
// 圓盤頂面貼圖：棋子文字（面對面時黑方文字倒轉由模型旋轉處理）
function topTexture(p) {
  const face = (p.T.face || p.T.n)[p.s], key = p.s + face;
  if (!V3.tex.has(key)) {
    const c = document.createElement('canvas'); c.width = c.height = 192; const g = c.getContext('2d'), col = SIDE[p.s].col;
    g.fillStyle = '#f6e3b8'; g.fillRect(0, 0, 192, 192);
    g.strokeStyle = col; g.lineWidth = 9; g.beginPath(); g.arc(96, 96, 88, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(96, 96, 74, 0, Math.PI * 2); g.stroke();
    g.fillStyle = col; g.font = 'bold 96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(face, 96, 102);
    const t = new V3.T.CanvasTexture(c); t.colorSpace = V3.T.SRGBColorSpace; t.anisotropy = 4; V3.tex.set(key, t);
  }
  return V3.tex.get(key);
}
// 武器（桶身朝本地 +X；放在圓盤頂上）。回傳 { g, aim: 是否會轉向攻擊方向 }
function buildWeapon(k) {
  const g = new V3.T.Group(), Y = 13; let aim = true;
  const dark = 0x2b2b2b;
  if (k === 'R') { box(15, 6, 8, dark, -4, Y + 4, 0, g); box(17, 2.6, 2.6, dark, 9, Y + 5, 0, g); box(2, 4, 2, dark, 17, Y + 7, 0, g); box(6, 3, 5, 0xc8a24a, -3, Y + 1.5, 4.5, g); }
  else if (k === 'N') { cyl(4.2, 4.2, 26, 0x5a6b2f, 3, Y + 6, 0, g).rotation.z = Math.PI / 2; const t = new V3.T.Mesh(new V3.T.ConeGeometry(4.6, 7, 16), mat(0xc0392b)); t.rotation.z = -Math.PI / 2; t.position.set(19.5, Y + 6, 0); g.add(t); box(3, 5, 3, dark, 0, Y + 2, 0, g); }
  else if (k === 'C') { cyl(9, 9, 1.6, 0x6b5a3a, -3, Y + 1, 0, g); const tube = new V3.T.Group(); cyl(3.4, 3.4, 22, dark, 0, 11, 0, tube); cyl(4.4, 4.4, 3, 0x8a8a8a, 0, 22, 0, tube); tube.rotation.z = -0.47; tube.position.set(-3, Y + 2, 0); g.add(tube); }
  else if (k === 'P') { box(20, 2.6, 3, dark, 6, Y + 5, 0, g); box(8, 4, 3.4, 0x7a4b20, -6, Y + 4.5, 0, g); }
  else if (k === 'P2') { box(20, 2.2, 2.2, dark, 7, Y + 5.6, -1.4, g); box(20, 2.2, 2.2, dark, 7, Y + 5.6, 1.4, g); box(9, 4.5, 4, 0x7a4b20, -7, Y + 4.8, 0, g); const ring = new V3.T.Mesh(new V3.T.TorusGeometry(R - 1, 1.3, 8, 40), mat(0xe0a800)); ring.rotation.x = Math.PI / 2; ring.position.y = Y - 0.5; g.add(ring); }
  else if (k === 'E') { box(7, 5, 7, dark, 0, Y + 2.5, 0, g); for (const z of [-3, 3]) { const b = new V3.T.Group(); box(18, 2.4, 2.4, 0xcfd5da, 8, 0, 0, b); b.rotation.z = 0.75; b.position.set(0, Y + 7, z); g.add(b); } }
  else if (k === 'G') { aim = false; box(2.4, 15, 13, 0x2f6fb5, 6, Y + 8.5, 0, g); box(2.8, 11, 2, 0xffffff, 6, Y + 8.5, 0, g); box(2.8, 2, 9, 0xffffff, 6, Y + 9.5, 0, g); }   // 盾牌立在前方（本地 +X）
  else if (k === 'K') { aim = false; cyl(8.5, 9.5, 6, dark, 0, Y + 5, 0, g, 24); cyl(10.5, 10.5, 1.4, dark, 0, Y + 2, 0, g, 24); cyl(9.6, 9.6, 2.6, 0xc0392b, 0, Y + 3.4, 0, g, 24); cyl(2.4, 2.4, 1, 0xf1c40f, 8.2, Y + 8.2, 0, g, 12).rotation.z = Math.PI / 2; }
  return { g, aim };
}
function makePiece(p) {
  const T = V3.T, root = new T.Group(), key = p.s + p.T.id;
  const sideMat = new T.MeshStandardMaterial({ color: 0xf6e3b8, roughness: 0.6 }), topMat = new T.MeshStandardMaterial({ map: topTexture(p), roughness: 0.6 });
  const disc = new T.Mesh(new T.CylinderGeometry(R, R, 9, 40), [sideMat, topMat, sideMat]); disc.position.y = 7.5; disc.castShadow = disc.receiveShadow = true;
  const face = new T.Group(); face.add(disc); root.add(face);   // 圓盤固定朝向（文字不跟車頭轉）
  const chassis = new T.Group();   // 車輪＋車頭箭頭，隨車頭轉
  for (const sx of [-11, 11]) for (const sz of [-R, R]) box(11, 6, 7, 0x333333, sx, 4, sz * 1.02, chassis);
  const arrow = new T.Mesh(new T.ConeGeometry(5.5, 9, 3), mat(parseInt(SIDE[p.s].col.slice(1), 16))); arrow.rotation.z = -Math.PI / 2; arrow.position.set(R + 3, 5, 0); arrow.castShadow = true; chassis.add(arrow);
  root.add(chassis);
  const w = buildWeapon(p.T.id === 'P2' ? 'P2' : p.t); root.add(w.g);
  V3.scene.add(root);
  return { root, face, chassis, weapon: w.g, aim: w.aim, sideMat, topMat, key, ang: null };
}
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function syncPieces() {
  const seen = new Set();
  for (const p of pieces) {
    if (p.hp <= 0) { const m = V3.pieces.get(p); if (m) m.root.visible = false; continue; }
    let m = V3.pieces.get(p);
    if (!m || m.key !== p.s + p.T.id) { if (m) V3.scene.remove(m.root); m = makePiece(p); V3.pieces.set(p, m); }
    seen.add(p); m.root.visible = true;
    const rec = (p.recoil || 0) * 5;
    m.root.position.set(visX(p) - W / 2 - Math.cos(p.hd) * rec, 0, visY(p) - H / 2 - Math.sin(p.hd) * rec);
    m.chassis.rotation.y = -p.hd;
    m.face.rotation.y = -textAng(p.s) + Math.PI / 2;   // 貼圖「上」方向 = +X；轉成讓文字朝向該方玩家
    // 武器：攻擊中轉向攻擊方向，平時朝向敵方（紅方朝上、黑方朝下）
    const rest = p.s ? Math.PI / 2 : -Math.PI / 2, tgt = p.aimT > 0 ? p.aimA : rest;
    if (m.ang === null) m.ang = tgt; m.ang += angDiff(tgt, m.ang) * 0.35;
    m.weapon.rotation.y = -(m.aim ? m.ang : rest);
    const dim = p.cd > 0, f = Math.min(1, (p.flash || 0) * 2.5);
    for (const mm of [m.sideMat, m.topMat]) { mm.color.setHex(dim ? 0x6a6a6a : 0xffffff); mm.emissive.setRGB(f, f, f); }
    m.sideMat.color.setHex(dim ? 0x6a6040 : 0xf6e3b8);
  }
  for (const [p, m] of V3.pieces) if (!seen.has(p) && !pieces.includes(p)) { V3.scene.remove(m.root); V3.pieces.delete(p); }
}

// ----- HUD：愛心、冷卻徽章、特效（投影到螢幕） -----
function drawHud() {
  const hc = V3.hud.getContext('2d'); hc.setTransform(1, 0, 0, 1, 0, 0); hc.clearRect(0, 0, V3.hud.width, V3.hud.height);
  const k = V3.dpr;
  withCtx(hc, () => {
    // 棋子上的愛心與冷卻徽章（畫面向上，大小依距離縮放）
    for (const p of alive().sort((a, b) => a.y - b.y)) {
      const [sx, sy] = P3(visX(p), 0, visY(p)), s = S3(visX(p), 0, visY(p)), el = V3.tilt * Math.PI / 180;
      ctx.setTransform(k * s, 0, 0, k * s, k * sx, k * (sy + R * Math.sin(el) * s));
      const n = p.T.hp, gap = 9;
      for (let i = 0; i < n; i++) {
        const hx = (i - (n - 1) / 2) * gap, f = Math.max(0, Math.min(1, p.hp - i)), full = f >= 1, part = f > 0 && !full;
        heart(hx, 9, 10); ctx.fillStyle = full ? '#e8202a' : '#0003'; ctx.fill();
        if (part) { ctx.save(); ctx.clip(); ctx.fillStyle = '#e8202a'; ctx.fillRect(hx - 5, 3, 10 * f, 12); ctx.restore(); }
        ctx.strokeStyle = full || part ? '#fff' : '#0006'; ctx.lineWidth = 1; ctx.stroke();
      }
      const [tx, ty] = P3(visX(p), 14, visY(p));
      ctx.setTransform(k * s, 0, 0, k * s, k * tx, k * ty);
      if (p.cd > 0) {   // 冷卻中：橘色倒數徽章
        const bx = R - 2, by = -R - 6, f = 1 - p.cd / p.T.reload;
        circle(bx, by, 12); ctx.fillStyle = '#d35400'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(bx, by, 12, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.cd, bx, by + 1);
      } else if (p.T.reload && !p.drop) { circle(R - 2, -R - 6, 5); ctx.fillStyle = '#2ecc71'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
      if (p.T.id === 'P2' && !p.drop) { ctx.fillStyle = '#e0a800'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', -R + 2, -R - 6); }
    }
    for (const f of fx) if (f.k !== 'txt') drawProj3D(f);
    // 粒子：每顆用貼地的局部仿射變換（圓形壓成橢圓，透視感自然）
    for (const p of parts) {
      const a = P3(p.x, 6, p.y), b = P3(p.x + 1, 6, p.y), c = P3(p.x, 6, p.y + 1);
      const m = [b[0] - a[0], b[1] - a[1], c[0] - a[0], c[1] - a[1]];
      ctx.setTransform(k * m[0], k * m[1], k * m[2], k * m[3], k * (a[0] - m[0] * p.x - m[2] * p.y), k * (a[1] - m[1] * p.x - m[3] * p.y));
      drawPart(p);
    }
    ctx.globalAlpha = 1;
    // 飄字
    for (const f of fx) if (f.k === 'txt') {
      const a = f.t / f.T, [sx, sy] = P3(Math.min(W - 40, Math.max(40, f.x)), 34, f.y);
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalAlpha = Math.min(1, a * 2); ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.strokeText(f.txt, sx, sy - (1 - a) * 30); ctx.fillStyle = f.col || '#e00'; ctx.fillText(f.txt, sx, sy - (1 - a) * 30); ctx.globalAlpha = 1;
    }
    // 結束畫面：座標系直接用原本的 W×H
    ctx.setTransform(k * V3.w / W, 0, 0, k * V3.h / H, 0, 0); drawOver();
    // 目前這一方的提示（面對面時文字方向）交給 drawOver 處理
  });
}
// 彈體（螢幕空間畫法，沿用 2D 的配色與形狀）
function drawProj3D(f) {
  if (f.delay > 0) return;
  const k = V3.dpr, [x, sy, gx, gy, kk] = projPos(f), H0 = 16;
  if (f.k === 'drop') return;   // 空投是 3D 模型，見 syncDrops()
  const dirx = Math.cos(f.dir || 0), diry = Math.sin(f.dir || 0);
  if (f.k === 'pellets') {
    const t = 1 - Math.max(0, f.t) / f.T;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    for (const r of f.rays) {
      const px = f.x1 + (r.x - f.x1) * t, py = f.y1 + (r.y - f.y1) * t, a = P3(px, H0, py), b = P3(px - Math.cos(r.dir) * 8, H0, py - Math.sin(r.dir) * 8);
      ctx.strokeStyle = '#fff7c2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0], a[1]); ctx.stroke(); circle(a[0], a[1], 1.8); ctx.fillStyle = '#ffd23f'; ctx.fill();
    }
    return;
  }
  if (f.k === 'bullet' || f.k === 'tracer') {
    const len = f.k === 'tracer' ? 26 : 16, a = P3(x, H0, gy), b = P3(x - dirx * len, H0, gy - diry * len);
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineCap = 'round';
    if (f.k === 'tracer') { ctx.strokeStyle = '#ff6a1fcc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0], a[1]); ctx.stroke(); const c = P3(x - dirx * 10, H0, gy - diry * 10); ctx.strokeStyle = '#fff3a8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(a[0], a[1]); ctx.stroke(); }
    else { ctx.strokeStyle = '#fff7c2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0], a[1]); ctx.stroke(); ctx.strokeStyle = f.side ? '#555' : '#ff6a4a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0], a[1]); ctx.stroke(); }
    ctx.lineCap = 'butt'; return;
  }
  if (f.k === 'rocket') {
    const a = P3(x, H0, gy), b = P3(x - dirx * 14, H0, gy - diry * 14), s = S3(x, H0, gy), ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
    ctx.setTransform(k * s, 0, 0, k * s, k * a[0], k * a[1]); ctx.rotate(ang);
    ctx.fillStyle = '#ffb030'; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-16 - Math.random() * 6, 0); ctx.lineTo(-8, 3); ctx.fill();
    ctx.fillStyle = f.side ? '#333' : '#b03020'; ctx.fillRect(-8, -3, 14, 6); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(11, 0); ctx.lineTo(6, 3); ctx.fill();
    return;
  }
  if (f.k === 'shell') {   // 迫擊砲彈：地面影子＋空中的砲彈（離地高度 = 拋物線高度）
    const lift = Math.max(0, gy - sy), ground = P3(gx, 0, gy), air = P3(gx, lift + 6, gy), s = S3(gx, lift, gy), s0 = S3(gx, 0, gy);
    ctx.setTransform(k * s0, 0, 0, k * s0 * Math.sin(V3.tilt * Math.PI / 180), k * ground[0], k * ground[1]);
    ctx.fillStyle = `rgba(0,0,0,${0.35 - Math.min(0.2, lift / 400)})`; ctx.beginPath(); ctx.ellipse(0, 0, 7, 7, 0, 0, Math.PI * 2); ctx.fill();
    const nx = projPos({ ...f, t: Math.max(0, f.t - f.T * 0.03) }), nxt = P3(nx[2], Math.max(0, gy - nx[1]) + 6, nx[3]), ang = Math.atan2(nxt[1] - air[1], nxt[0] - air[0]);
    ctx.setTransform(k * s, 0, 0, k * s, k * air[0], k * air[1]); ctx.rotate(ang);
    ctx.fillStyle = '#556b2f'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(5.5, -1.6); ctx.lineTo(8.5, 0); ctx.lineTo(5.5, 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillRect(-9, -3.6, 4, 1.4); ctx.fillRect(-9, 2.2, 4, 1.4); ctx.fillRect(-9, -0.6, 5, 1.2);
  }
}
// ----- 空投（3D）：運輸機飛越棋盤 → 投下降落傘補給箱 → 傘衣展開、緩降、落地後降落傘塌下、箱子淡出 -----
const DROP_ALT = 150, DROP_REL = 0.22;   // 飛行高度；投放時間點（動畫進度）
function buildPlane(col) {
  const g = new V3.T.Group(), olive = 0x4a5a3a, dark = 0x2b3a22;
  const fus = cyl(5.5, 4.2, 46, olive, 0, 0, 0, g, 16); fus.rotation.z = Math.PI / 2;
  const nose = new V3.T.Mesh(new V3.T.ConeGeometry(5.5, 9, 16), mat(olive)); nose.rotation.z = -Math.PI / 2; nose.position.x = 27.5; nose.castShadow = true; g.add(nose);
  const tailCone = new V3.T.Mesh(new V3.T.ConeGeometry(4.2, 10, 16), mat(olive)); tailCone.rotation.z = Math.PI / 2; tailCone.position.x = -28; tailCone.castShadow = true; g.add(tailCone);
  box(12, 1.6, 74, olive, 2, 1.5, 0, g);                      // 主翼
  box(8, 1.2, 26, olive, -22, 1.5, 0, g);                     // 水平尾翼
  box(9, 11, 1.6, col, -22, 7, 0, g);                         // 垂直尾翼（隊色）
  box(8, 3, 9.5, 0x9fd0e8, 17, 3.2, 0, g);                    // 駕駛艙玻璃
  box(2, 4.5, 12, 0x1d1d1d, -4, -4, 0, g);                    // 貨艙門
  const props = [];
  for (const z of [-17, 17]) {                                // 兩具螺旋槳引擎
    const eng = cyl(3.6, 3.6, 12, dark, 6, -1, z, g, 12); eng.rotation.z = Math.PI / 2;
    const pr = new V3.T.Group(); pr.position.set(12.5, -1, z); box(0.8, 17, 2.4, 0x111111, 0, 0, 0, pr); box(0.8, 2.4, 17, 0x111111, 0, 0, 0, pr); g.add(pr); props.push(pr);
  }
  return { g, props };
}
function buildDropGoods(opacityMats) {
  const T = V3.T, g = new T.Group(), own = (c, o = {}) => { const m = new T.MeshStandardMaterial({ color: c, roughness: 0.7, transparent: true, ...o }); opacityMats.push(m); return m; };
  const crate = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(15, 12, 15), own(0xa77b3f)); body.castShadow = true; crate.add(body);
  for (const [w, h, d, x, y, z] of [[15.6, 2, 2, 0, 6, 0], [2, 2, 15.6, 0, 6, 0], [15.6, 1.6, 1.6, 0, 0, 7.6], [15.6, 1.6, 1.6, 0, 0, -7.6]]) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), own(0x5a3d17)); m.position.set(x, y, z); crate.add(m); }
  const red = new T.Mesh(new T.BoxGeometry(5, 5, 15.6), own(0xd6453a)); red.position.y = 1; crate.add(red);
  g.add(crate);
  if (!V3.tex.has('canopy')) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 8; const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#d6453a' : '#f2f2f2'; x.fillRect(i * 16, 0, 16, 8); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; V3.tex.set('canopy', t);
  }
  const chute = new T.Group();
  const dome = new T.Mesh(new T.SphereGeometry(24, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), own(0xffffff, { map: V3.tex.get('canopy'), side: T.DoubleSide }));
  dome.scale.y = 0.62; dome.castShadow = true; chute.add(dome);
  const pts = []; for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) pts.push(sx * 17, 0, sz * 17, sx * 5, -30, sz * 5);
  const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
  const lm = new T.LineBasicMaterial({ color: 0x555555, transparent: true }); opacityMats.push(lm);
  chute.add(new T.LineSegments(lg, lm)); chute.position.y = 36;
  g.add(chute);
  return { g, crate, chute };
}
function makeDrop(f) {
  const mats = [], plane = buildPlane(parseInt(SIDE[f.side ?? 0].col.slice(1), 16)), goods = buildDropGoods(mats);
  plane.g.scale.setScalar(1.15); V3.scene.add(plane.g); V3.scene.add(goods.g);
  return { plane, goods, mats, rolled: false };
}
function syncDrops() {
  const now = performance.now() / 1000, live = new Set();
  for (const f of fx) {
    if (f.k !== 'drop') continue;
    live.add(f); let d = V3.drops.get(f); if (!d) { d = makeDrop(f); V3.drops.set(f, d); }
    const t = 1 - Math.max(0, f.t) / f.T, px = -230 + (f.x + 230) * t / DROP_REL;   // 飛機的遊戲 x 座標（t = DROP_REL 時剛好在目標正上方）
    const pl = d.plane.g; pl.visible = px < W + 280;
    pl.position.set(px - W / 2, DROP_ALT + 14 + Math.sin(now * 3) * 2, f.y - H / 2); pl.rotation.x = Math.sin(now * 2.2) * 0.05;
    for (const pr of d.plane.props) pr.rotation.x += 0.9;
    const gd = d.goods, released = t >= DROP_REL;
    if (!released) { gd.g.position.set(px - W / 2, DROP_ALT + 4, f.y - H / 2); gd.chute.visible = false; gd.crate.scale.setScalar(0.7); }   // 還掛在機腹下
    else {
      const fall = Math.min(1, (t - DROP_REL) / (LAND_AT - DROP_REL)), e = 1 - (1 - fall) * (1 - fall) * (1 - fall), landed = t >= LAND_AT;
      const sway = Math.sin(fall * 9) * 6 * (1 - fall), h = landed ? 6 : 6 + (DROP_ALT - 2) * (1 - e);
      gd.g.position.set(f.x - W / 2 + sway, h, f.y - H / 2); gd.g.rotation.z = Math.sin(fall * 9 + 1) * 0.08 * (1 - fall);
      gd.crate.scale.setScalar(0.7 + 0.3 * Math.min(1, fall * 6));
      gd.chute.visible = true;
      const open = Math.min(1, fall * 7);   // 剛投下時傘衣由小展開
      if (!landed) { gd.chute.scale.set(0.25 + 0.75 * open, 0.25 + 0.75 * open, 0.25 + 0.75 * open); gd.chute.position.y = 36 * open; gd.chute.rotation.x = 0; }
      else { const c = Math.min(1, (t - LAND_AT) / 0.1); gd.chute.scale.set(1 + 0.3 * c, 1 - 0.8 * c, 1 + 0.3 * c); gd.chute.position.y = 36 * (1 - c) + 6 * c; }   // 落地：降落傘塌下
      const a = landed ? Math.max(0, 1 - (t - LAND_AT) / 0.18) : 1; for (const m of d.mats) m.opacity = a;
      gd.g.visible = a > 0;
    }
  }
  for (const [f, d] of V3.drops) if (!live.has(f)) { V3.scene.remove(d.plane.g, d.goods.g); d.mats.forEach(m => m.dispose()); V3.drops.delete(f); }
}

// ----- 每格畫面 -----
function draw3D() {
  withCtx(V3.fctx, () => {
    ctx.save(); ctx.clearRect(0, 0, W, H);
    const { preview, markT, ghost } = drawGround();
    marks(state === 'target' ? targets : preview, markT, ghost);
    ctx.restore();
  });
  V3.flatTex.needsUpdate = true;
  syncPieces(); syncDrops(); updateCamera();
  V3.r.render(V3.scene, V3.cam);
  drawHud();
}
