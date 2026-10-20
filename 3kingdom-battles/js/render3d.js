// ===== 立體畫面（Three.js）=====
// 地形：每格一根六角柱（InstancedMesh，一次畫完），再加樹、丘、城牆垛口、箭樓、城門、民房、府衙等裝飾。
// 部隊：一群小兵依「陣型」排列（鋒矢＝箭頭、魚鱗＝層疊、鶴翼＝V 字、雁行＝錯開兩列、長蛇＝一列、方圓＝圓陣、混亂＝散開），
//       整群朝向部隊面向；兵力越少小兵越少。器械是各自的模型。
// 點選：射線打到地形柱，取得第幾格。
(function (root) {
  const HX = root.HEX;
  let T = null;
  const V = { ready: false, units: new Map(), hl: [], anims: [], floaters: [], dirty: true };
  root.V3 = V;

  const TOP = { '.': 0.2, ',': 0.2, 'f': 0.22, 'h': 0.75, '~': -0.15, '=': -0.12, 'd': 0.45, 'l': 0.12, 'w': -0.08, 'm': 0.1, 'W': 1.5, 'T': 1.5, 'G': 1.5, 'o': 0.22, 'b': -0.12, 'r': 0.4, 'c': 0.3, 'P': 0.3, 'S': 0.2 };
  const standY = (ch) => (ch === '=' ? 0.22 : TOP[ch] != null ? Math.max(TOP[ch], 0) : 0.2);

  // ---------- 初始化 ----------
  async function init(container) {
    if (V.ready) return true;
    try { T = await import('../vendor/three.min.js'); } catch (e) { console.error(e); return false; }
    V.T = T; V.box = container;
    V.cv = document.createElement('canvas'); V.cv.id = 'cv3'; container.appendChild(V.cv);
    V.layer = document.createElement('div'); V.layer.id = 'floaters'; container.appendChild(V.layer);
    try { V.r = new T.WebGLRenderer({ canvas: V.cv, antialias: true }); } catch (e) { return false; }
    V.dpr = Math.min(window.devicePixelRatio || 1, 2);
    V.r.setPixelRatio(V.dpr);
    V.r.shadowMap.enabled = true; V.r.shadowMap.type = T.PCFSoftShadowMap;
    V.r.outputColorSpace = T.SRGBColorSpace;
    V.scene = new T.Scene();
    V.scene.background = new T.Color(0x1c1813);
    V.scene.fog = new T.Fog(0x1c1813, 42, 100);
    V.cam = new T.PerspectiveCamera(40, 1, 0.5, 300);
    V.scene.add(new T.HemisphereLight(0xf6ead2, 0x3a3020, 1.75));
    const sun = new T.DirectionalLight(0xffe4bc, 2.5); sun.position.set(-18, 34, 14); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 24, bottom: -24, near: 1, far: 90 });
    sun.shadow.bias = -0.0006; V.sun = sun; V.scene.add(sun); V.scene.add(sun.target);
    V.ray = new T.Raycaster(); V.v2 = new T.Vector2(); V.tmpV = new T.Vector3();
    V.cam3 = { tx: 0, tz: 0, dist: 17, yaw: 0, pitch: 52 };
    new ResizeObserver(resize).observe(container);
    bindPointer();
    resize();
    V.clock = performance.now();
    requestAnimationFrame(loop);
    V.ready = true; return true;
  }
  function resize() {
    const w = V.box.clientWidth, h = V.box.clientHeight; if (!w || !h) return;
    V.w = w; V.h = h; V.r.setSize(w, h, false); V.cam.aspect = w / h; V.cam.updateProjectionMatrix(); V.dirty = true;
  }
  function updateCamera() {
    const c = V.cam3; const p = c.pitch * Math.PI / 180, y = c.yaw * Math.PI / 180;
    V.cam.position.set(c.tx + Math.sin(y) * Math.cos(p) * c.dist, Math.sin(p) * c.dist, c.tz + Math.cos(y) * Math.cos(p) * c.dist);
    V.cam.lookAt(c.tx, 0, c.tz); V.cam.updateMatrixWorld();
  }

  // 世界座標
  function wpos(c, r) { const [x, y] = HX.center(c, r); const sx = V.snap && V.snap[HX.key(c, r)]; return [(sx != null ? sx : x) - V.ox, y - V.oz]; }
  // 城牆拉直：同一欄連續好幾列的城牆，在六角格裡奇偶列會左右錯開成鋸齒；畫面上把它們對齊到同一條直線（規則仍是六角格）
  const WALLISH = ch => ch === 'W' || ch === 'T' || ch === 'G' || ch === 'o' || ch === 'r';
  function computeSnap(g) {
    V.snap = {}; const M = g.sc.map;
    for (let c = 0; c < g.W; c++) {
      let r0 = 0;
      for (let r = 0; r <= g.Hh; r++) {
        if (r < g.Hh && WALLISH(M[r][c])) continue;
        if (r - r0 >= 3) for (let k = r0; k < r; k++) V.snap[HX.key(c, k)] = HX.S3 * (c + 0.25);
        r0 = r + 1;
      }
    }
  }
  function topAt(g, c, r) { return standY(g.map[r][c]); }

  // ---------- 材質工具 ----------
  const matCache = new Map();
  function mat(color, opts = {}) {
    const k = color + JSON.stringify(opts);
    if (!matCache.has(k)) matCache.set(k, new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, flatShading: true }, opts)));
    return matCache.get(k);
  }
  function mesh(geo, m, cast = true, recv = false) { const o = new T.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; }

  // ---------- 建立地形 ----------
  function build(g) {
    if (V.world) { V.scene.remove(V.world); }
    V.units.forEach(u => V.scene.remove(u.grp)); V.units.clear();
    V.g = g; V.world = new T.Group(); V.scene.add(V.world);
    if (V.digGrp) { V.scene.remove(V.digGrp); V.digGrp = null; } V.digSig = null; V.depSig = null; if (V.depGrp) { V.scene.remove(V.depGrp); V.depGrp = null; } V.levSig = null; if (V.levGrp) { V.scene.remove(V.levGrp); V.levGrp = null; }
    const [mx, mz] = HX.center(g.W - 1, g.Hh - 1); V.ox = (mx + HX.S3 * 0.5) / 2; V.oz = mz / 2;
    computeSnap(g);
    V.cam3.tx = 0; V.cam3.tz = 0;
    // 底座
    const PAD = 2.6;
    V.gx0 = -V.ox - HX.S3 / 2 - PAD; V.gx1 = V.ox + HX.S3 / 2 + PAD; V.gz0 = -V.oz - 1 - PAD; V.gz1 = V.oz + 1 + PAD;
    const base = mesh(new T.BoxGeometry(V.gx1 - V.gx0, 1.2, V.gz1 - V.gz0), mat(0x2a2219), false, true); base.position.set((V.gx0 + V.gx1) / 2, -0.85, (V.gz0 + V.gz1) / 2); V.world.add(base);
    // 連續地表
    buildGround(g);
    // 河面（半透明水層）
    const water = new T.Mesh(new T.PlaneGeometry(V.gx1 - V.gx0, V.gz1 - V.gz0), new T.MeshStandardMaterial({ color: 0x3d6f66, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.25 }));
    water.rotation.x = -Math.PI / 2; water.position.set((V.gx0 + V.gx1) / 2, -0.02, (V.gz0 + V.gz1) / 2); V.world.add(water); V.water = water;
    buildDeco(g);
    buildWalls(g);
    buildFlora(g);
    buildProps(g);
    buildLevee(g);
    V.dirty = true;
  }
  const isWet = ch => ch === '~' || ch === '=' || ch === 'w' || ch === 'b';
  // 城牆格的地面：牆體只蓋住格子中間，露出來的部分用旁邊（城外或城內）地面的顏色與高度，城牆邊緣才會是直線
  function wallGround(g, c, r) {
    const k = HX.key(c, r), [tx] = HX.center(c, r);
    const dirs = V.snap[k] != null ? [tx < V.snap[k] ? 3 : 0] : [1, 2, 4, 5, 0, 3];
    for (const d of dirs) { const [nc, nr] = HX.neighbor(c, r, d); const ch = g.map[nr] && g.map[nr][nc]; if (ch && !'WTGor'.includes(ch) && !TERRAIN_CITY.has(ch)) return [nc, nr]; }
    for (const d of dirs) { const [nc, nr] = HX.neighbor(c, r, d); const ch = g.map[nr] && g.map[nr][nc]; if (ch && !'WTGor'.includes(ch)) return [nc, nr]; }
    return null;
  }
  const TERRAIN_CITY = new Set(['c', 'P']);

  // ---------- 連續地表 ----------
  // 整片地面是一張連續網格：高度依所在的六角格平滑過渡；顏色畫在一張貼圖上
  // （先用低解析度上色再放大＝地形邊界自然暈開，再疊色塊、筆觸與淡淡的格線）
  const GH = { '.': 0.2, ',': 0.19, 'f': 0.22, 'h': 0.75, '~': -0.3, '=': -0.3, 'd': 0.45, 'l': 0.12, 'w': -0.25, 'm': 0.08, 'b': -0.3, 'o': 0.22, 'r': 0.35, 'c': 0.28, 'P': 0.3, 'S': 0.2 };
  const GC = { '.': 0x7a8749, ',': 0x8c7f55, 'f': 0x55663a, 'h': 0x948660, '~': 0x23463f, '=': 0x23463f, 'd': 0x86744d, 'l': 0x849056, 'w': 0x2a4d48, 'm': 0x5e5038, 'b': 0x23463f, 'o': 0x6c604f, 'r': 0x7a6f61, 'c': 0x8b7b5f, 'P': 0x948469, 'S': 0x8c7853 };
  // 六角格座標（未扣 ox/oz）→ [c, r]
  function hexAtPx(px, pz) {
    const x = px / HX.S3 - pz / 3, z = 2 / 3 * pz, y = -x - z;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    return HX.fromAx(rx, rz);
  }
  function hexAtWorld(wx, wz) { return hexAtPx(wx + V.ox, wz + V.oz); }
  const clampHex = (g, [c, r]) => [Math.max(0, Math.min(g.W - 1, c)), Math.max(0, Math.min(g.Hh - 1, r))];
  // 這一格地面的地形（城牆格用旁邊地面的）
  function groundCh(g, c, r) {
    const ch = g.map[r][c];
    if ('WTG'.includes(ch)) { const n = wallGround(g, c, r); return n ? g.map[n[1]][n[0]] : 'c'; }
    return ch;
  }
  function hexColor(g, c, r) {
    const ch = groundCh(g, c, r);
    const col = new T.Color(GC[ch] != null ? GC[ch] : 0x777777);
    const n = 0.5 * Math.sin(c * 0.55 + r * 0.31) + 0.5 * Math.sin(c * 0.23 - r * 0.6 + 1.7);
    const h = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453; const j = h - Math.floor(h) - 0.5;
    if (ch === '.' || ch === 'l' || ch === 'f' || ch === 'h') {
      col.offsetHSL(n * 0.02, n * 0.04, n * 0.03 + j * 0.04);
      // 草地上踩出來的泥土地
      const m = 0.5 * Math.sin(c * 0.9 + r * 0.45 + 2.1) + 0.5 * Math.sin(c * 0.37 - r * 0.82);
      if (ch === '.' && m > 0.45) col.lerp(new T.Color(0x8d7c52), Math.min(0.55, (m - 0.45) * 1.6));
    } else col.offsetHSL(0, 0, j * 0.05);
    if ((ch === '.' || ch === 'l') && HX.neighbors(c, r).some(([nc, nr]) => g.map[nr] && isWet(g.map[nr][nc]))) col.lerp(new T.Color(0x9a8a5e), 0.3);
    return col;
  }
  function hexHeight(g, c, r) { const ch = groundCh(g, c, r); return GH[ch] != null ? GH[ch] : 0.2; }
  const RING = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3) * 0.42, Math.sin(i * Math.PI / 3) * 0.42])];
  function groundHeight(g, wx, wz) {
    let s = 0; for (const [ax, az] of RING) { const [c, r] = clampHex(g, hexAtWorld(wx + ax, wz + az)); s += hexHeight(g, c, r); }
    return s / RING.length;
  }
  const TPX = 28;   // 貼圖每單位像素
  function buildGround(g) {
    if (V.ground) { V.world.remove(V.ground); V.ground.geometry.dispose(); }
    const w = V.gx1 - V.gx0, d = V.gz1 - V.gz0, RES = 3;
    const geo = new T.PlaneGeometry(w, d, Math.round(w * RES), Math.round(d * RES)); geo.rotateX(-Math.PI / 2);
    geo.translate((V.gx0 + V.gx1) / 2, 0, (V.gz0 + V.gz1) / 2);
    V.groundCv = V.groundCv || document.createElement('canvas');
    const tex = V.groundTex = V.groundTex || new T.CanvasTexture(V.groundCv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const m = new T.Mesh(geo, new T.MeshStandardMaterial({ map: tex, roughness: 1 }));
    m.receiveShadow = true; V.ground = m; V.world.add(m);
    paintGround(g);
  }
  function paintGround(g) {
    // 高度
    const pos = V.ground.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const edge = x <= V.gx0 + 0.01 || x >= V.gx1 - 0.01 || z <= V.gz0 + 0.01 || z >= V.gz1 - 0.01;
      pos.setY(i, edge ? -0.25 : groundHeight(g, x, z));
    }
    pos.needsUpdate = true; V.ground.geometry.computeVertexNormals();
    // 顏色
    const cv = V.groundCv, W = Math.round((V.gx1 - V.gx0) * TPX), H = Math.round((V.gz1 - V.gz0) * TPX);
    cv.width = W; cv.height = H; const x = cv.getContext('2d');
    const LP = 3, lw = Math.round((V.gx1 - V.gx0) * LP), lh = Math.round((V.gz1 - V.gz0) * LP);
    const low = document.createElement('canvas'); low.width = lw; low.height = lh; const lx = low.getContext('2d');
    const img = lx.createImageData(lw, lh); const cache = {};
    for (let py = 0; py < lh; py++) for (let px = 0; px < lw; px++) {
      const [c, r] = clampHex(g, hexAtWorld(V.gx0 + (px + 0.5) / LP, V.gz0 + (py + 0.5) / LP)); const k = c + ',' + r;
      const col = cache[k] || (cache[k] = hexColor(g, c, r)); const o = (py * lw + px) * 4;
      img.data[o] = col.r * 255; img.data[o + 1] = col.g * 255; img.data[o + 2] = col.b * 255; img.data[o + 3] = 255;
    }
    lx.putImageData(img, 0, 0);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(low, 0, 0, W, H);
    const rnd = seeded(97);
    // 大色塊：明暗起伏
    for (let i = 0; i < 160; i++) {
      const cx = rnd() * W, cy = rnd() * H, rad = (1 + rnd() * 2.5) * TPX, dark = rnd() < 0.6;
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, dark ? 'rgba(20,16,8,0.13)' : 'rgba(255,238,190,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // 筆觸：細碎的草與土
    x.lineCap = 'round';
    for (let i = 0; i < W * H / 60; i++) {
      const px = rnd() * W, py = rnd() * H, a = rnd() * Math.PI, l = 2 + rnd() * 4;
      x.strokeStyle = rnd() < 0.55 ? 'rgba(25,22,10,0.14)' : 'rgba(235,225,170,0.10)'; x.lineWidth = 1 + rnd();
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
    // 古道：夯土路面連到相鄰的道路、渡口、城門，邊緣自然暈開，上面有淡淡的車轍和碎石
    const isRoad = ch => ch === ',' || ch === '=' || ch === 'G' || ch === 'o';
    const segs = [];
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) {
      if (g.map[r][c] !== ',') continue;
      for (const [nc, nr] of HX.neighbors(c, r)) if (g.map[nr] && isRoad(g.map[nr][nc]) && (g.map[nr][nc] !== ',' || nr * g.W + nc > r * g.W + c)) segs.push([c, r, nc, nr]);
    }
    const toPx = (c, r) => { const [hx, hz] = wpos(c, r); return [(hx - V.gx0) * TPX, (hz - V.gz0) * TPX]; };
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const [w, col] of [[1.05, 'rgba(120,98,62,0.22)'], [0.78, 'rgba(146,120,78,0.5)'], [0.6, 'rgba(160,134,92,0.45)']]) {
      x.lineWidth = w * TPX; x.strokeStyle = col;
      for (const [c0, r0, c1, r1] of segs) { const [a0, b0] = toPx(c0, r0), [a1, b1] = toPx(c1, r1); x.beginPath(); x.moveTo(a0, b0); x.lineTo(a1, b1); x.stroke(); }
    }
    x.lineWidth = 1.6; x.strokeStyle = 'rgba(70,52,30,0.22)';
    for (const [c0, r0, c1, r1] of segs) {
      const [a0, b0] = toPx(c0, r0), [a1, b1] = toPx(c1, r1), L = Math.hypot(a1 - a0, b1 - b0) || 1, nx = -(b1 - b0) / L * 0.15 * TPX, nz = (a1 - a0) / L * 0.15 * TPX;
      for (const sg of [-1, 1]) { x.beginPath(); x.moveTo(a0 + nx * sg, b0 + nz * sg); x.lineTo(a1 + nx * sg, b1 + nz * sg); x.stroke(); }
      for (let i = 0; i < 10; i++) { const t = rnd(), px = a0 + (a1 - a0) * t + (rnd() - 0.5) * 0.6 * TPX, py = b0 + (b1 - b0) * t + (rnd() - 0.5) * 0.6 * TPX; x.fillStyle = rnd() < 0.5 ? 'rgba(90,80,64,0.35)' : 'rgba(200,184,150,0.3)'; x.beginPath(); x.arc(px, py, 1 + rnd() * 1.6, 0, Math.PI * 2); x.fill(); }
    }
    // 淡淡的格線（水面、城牆不畫）
    x.strokeStyle = 'rgba(240,228,190,0.17)'; x.lineWidth = 1.3;
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) {
      const ch = g.map[r][c]; if (isWet(ch) || 'WTG'.includes(ch)) continue;
      const [hx, hz] = HX.center(c, r); const ux = (hx - V.ox - V.gx0) * TPX, uz = (hz - V.oz - V.gz0) * TPX;
      x.beginPath();
      for (let k = 0; k <= 6; k++) { const a = (30 + 60 * k) * Math.PI / 180; const vx = ux + Math.cos(a) * 0.97 * TPX, vz = uz + Math.sin(a) * 0.97 * TPX; k ? x.lineTo(vx, vz) : x.moveTo(vx, vz); }
      x.stroke();
    }
    // 地圖外圍漸暗
    const fade = PADPX => {
      const L = [[0, 0, PADPX, 0], [W, 0, W - PADPX, 0], [0, 0, 0, PADPX], [0, H, 0, H - PADPX]];
      for (const [x0, y0, x1, y1] of L) { const gr = x.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(20,16,10,0.85)'); gr.addColorStop(1, 'rgba(20,16,10,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
    };
    fade(2.4 * TPX);
    V.groundTex.needsUpdate = true; V.dirty = true;
  }
  function groundY(wx, wz) { return groundHeight(V.g, wx, wz); }

  // 裝飾物：依格子建立，記在 V.deco[key]，地形改變（淹水、城牆倒塌）時重建那一格
  function buildDeco(g) {
    V.deco = {};
    V.geos = V.geos || {
      cone: new T.ConeGeometry(0.28, 0.7, 6), trunk: new T.CylinderGeometry(0.05, 0.06, 0.2, 5),
      merlon: new T.BoxGeometry(0.22, 0.22, 0.22), rock: new T.DodecahedronGeometry(0.22, 0),
      house: new T.BoxGeometry(0.42, 0.28, 0.32), roof4: new T.ConeGeometry(0.36, 0.22, 4),
      crown: new T.DodecahedronGeometry(0.32, 0), bush: new T.DodecahedronGeometry(0.16, 0), reed: new T.ConeGeometry(0.03, 0.32, 4),
      plank: new T.BoxGeometry(1.75, 0.08, 1.0), rail: new T.BoxGeometry(1.75, 0.12, 0.06), tent: new T.ConeGeometry(0.3, 0.45, 6),
    };
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) decoAt(g, c, r);
  }
  function decoAt(g, c, r) {
    const k = HX.key(c, r);
    if (V.deco[k]) { V.world.remove(V.deco[k]); }
    const ch = g.map[r][c]; const [x, z] = wpos(c, r); const top = TOP[ch] != null ? TOP[ch] : 0.2;
    const grp = new T.Group(); grp.position.set(x, top, z);
    const G = V.geos; const rnd = seeded(c * 31 + r * 17);
    if (ch === 'f') {
      // 松樹與闊葉樹混種，樹下有灌木
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + rnd() * 0.8, d = i === 4 ? rnd() * 0.15 : 0.35 + rnd() * 0.35, s = 0.75 + rnd() * 0.5;
        const px = Math.cos(a) * d, pz = Math.sin(a) * d;
        if (rnd() < 0.55) {
          const t = mesh(G.cone, mat([0x2f4a2a, 0x37522e, 0x29422a][i % 3])); t.position.set(px, 0.45 * s + 0.15, pz); t.scale.setScalar(s); grp.add(t);
          const t2 = mesh(G.cone, mat(0x3f5a33)); t2.position.set(px, 0.72 * s + 0.15, pz); t2.scale.setScalar(s * 0.7); grp.add(t2);
        } else {
          const t = mesh(G.crown, mat([0x4a6233, 0x56703a, 0x405a2f][i % 3])); t.position.set(px, 0.42 * s + 0.12, pz); t.scale.set(s, s * 0.85, s); grp.add(t);
        }
        const tr = mesh(G.trunk, mat(0x6b4a2b)); tr.position.set(px, 0.1, pz); grp.add(tr);
      }
      for (let i = 0; i < 2; i++) { const b = mesh(G.bush, mat(0x34492a)); b.position.set((rnd() - 0.5) * 1.1, 0.06, (rnd() - 0.5) * 1.1); b.scale.set(1.2, 0.7, 1.2); grp.add(b); }
    } else if (ch === 'l') {
      if (rnd() < 0.45) for (let i = 0; i < 3; i++) { const o = mesh(G.reed, mat(i % 2 ? 0x8fa35a : 0xa3ad62), false); o.position.set((rnd() - 0.5) * 1.1, 0.12, (rnd() - 0.5) * 1.1); o.rotation.z = (rnd() - 0.5) * 0.4; grp.add(o); }
    } else if (ch === 'h') {
      for (let i = 0; i < 3; i++) { const o = mesh(G.rock, mat(0x8c8a62)); o.position.set((rnd() - 0.5) * 1, 0.05, (rnd() - 0.5) * 1); o.scale.set(1 + rnd(), 0.6 + rnd() * 0.5, 1 + rnd()); grp.add(o); }
    } else if (ch === 'W' || ch === 'T' || ch === 'G') {
      // 城牆本體與垛口在 buildWalls 畫成連續的城垣；這裡只放箭樓、城樓
      if (ch === 'T') {
        const body = mesh(new T.BoxGeometry(0.9, 0.7, 0.9), mat(0xa0583c)); body.position.y = 0.35; grp.add(body);
        const roof = mesh(new T.ConeGeometry(0.85, 0.5, 4), mat(0x4a3b33)); roof.position.y = 0.95; roof.rotation.y = Math.PI / 4; grp.add(roof);
      }
      if (ch === 'G') {
        const body = mesh(new T.BoxGeometry(1.1, 0.55, 0.7), mat(0xa0583c)); body.position.y = 0.28; grp.add(body);
        const roof = mesh(new T.ConeGeometry(0.95, 0.45, 4), mat(0x4a3b33)); roof.position.y = 0.8; roof.rotation.y = Math.PI / 4; roof.scale.set(1.2, 1, 0.8); grp.add(roof);
        for (const s of [-1, 1]) { const door = mesh(new T.BoxGeometry(0.06, 1.1, 0.6), mat(0x4a2c14)); door.position.set(s * 0.68, -0.75, 0); grp.add(door); }
      }
    } else if (ch === 'c') {
      if (rnd() < 0.8) for (let i = 0; i < 2; i++) {
        const hs = mesh(G.house, mat(0xd8cdb6)); const px = (rnd() - 0.5) * 0.9, pz = (rnd() - 0.5) * 0.9; hs.position.set(px, 0.14, pz); hs.rotation.y = rnd() * 3;
        const rf = mesh(G.roof4, mat(0x6e4b3a)); rf.position.set(px, 0.39, pz); rf.rotation.y = hs.rotation.y + Math.PI / 4;
        grp.add(hs, rf);
      }
    } else if (ch === 'P') {
      const hall = mesh(new T.BoxGeometry(1.1, 0.45, 0.8), mat(0xb94a32)); hall.position.y = 0.23; grp.add(hall);
      const roof = mesh(new T.ConeGeometry(0.95, 0.45, 4), mat(0x3d3a44)); roof.position.y = 0.68; roof.rotation.y = Math.PI / 4; roof.scale.set(1.25, 1, 0.9); grp.add(roof);
    } else if (ch === '=') {   // 橋：中段平直，兩端斜下搭到兩岸地面，橋墩插進水裡
      const mid = mesh(new T.BoxGeometry(2.0, 0.08, 1.0), mat(0x8a6236)); mid.position.y = 0.32; grp.add(mid);
      for (const sx of [-1, 1]) {
        const ramp = mesh(new T.BoxGeometry(0.85, 0.08, 1.0), mat(0x7e5a31)); ramp.position.set(sx * 1.38, 0.27, 0); ramp.rotation.z = -sx * 0.13; grp.add(ramp);
      }
      for (const s2 of [-1, 1]) {
        const rl = mesh(new T.BoxGeometry(2.0, 0.12, 0.06), mat(0x6b4a2b)); rl.position.set(0, 0.45, s2 * 0.48); grp.add(rl);
        for (const sx of [-1, 1]) { const rr = mesh(new T.BoxGeometry(0.85, 0.12, 0.06), mat(0x6b4a2b)); rr.position.set(sx * 1.38, 0.4, s2 * 0.48); rr.rotation.z = -sx * 0.13; grp.add(rr); }
        for (const sx of [-0.8, 0, 0.8]) { const q = mesh(new T.CylinderGeometry(0.06, 0.07, 0.8, 5), mat(0x4a3523)); q.position.set(sx, -0.05, s2 * 0.42); grp.add(q); }
      }
      grp.position.y = 0;
    } else if (ch === 'b') {   // 斷橋：兩岸各剩一段橋板與橋柱，中間空了
      for (const sx of [-1, 1]) { const p = mesh(new T.BoxGeometry(0.85, 0.08, 1.0), mat(0x6e4e2c)); p.position.set(sx * 1.38, 0.27, 0); p.rotation.z = -sx * 0.13; grp.add(p); }
      for (const sx of [-1.1, 1.1]) for (const sz of [-0.42, 0.42]) { const q = mesh(new T.CylinderGeometry(0.05, 0.06, 0.6, 5), mat(0x4a3523)); q.position.set(sx, 0.0, sz); grp.add(q); }
      grp.position.y = 0;
    } else if (ch === 'S') {
      for (let i = 0; i < 3; i++) { const t = mesh(G.tent, mat(0xe8dcc0)); t.position.set((i - 1) * 0.5, 0.22, (i % 2 - 0.5) * 0.4); grp.add(t); }
    } else if (ch === 'r') {
      for (let i = 0; i < 5; i++) { const o = mesh(G.merlon, mat(0x8a8178)); o.position.set((rnd() - 0.5) * 1.2, 0.08, (rnd() - 0.5) * 1.2); o.rotation.set(rnd(), rnd(), rnd()); o.scale.setScalar(0.8 + rnd()); grp.add(o); }
    } else if (ch === 'o') {
      for (const s of [-1, 1]) { const p = mesh(new T.BoxGeometry(0.3, 1.3, 0.3), mat(0x8f857c)); p.position.set(0, 0.65, s * 0.6); grp.add(p); }
    }
    if (grp.children.length) { V.world.add(grp); V.deco[k] = grp; } else V.deco[k] = null;
  }
  function seeded(s) { let a = s >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
  function refreshHex(g, c, r) {
    decoAt(g, c, r);
    if (WALLISH(g.sc.map[r][c])) buildWalls(g);
    // 地面整張重畫（一次事件改很多格時只畫一次）
    if (!V.groundDirty) { V.groundDirty = true; queueMicrotask(() => { V.groundDirty = false; if (V.g === g) { paintGround(g); buildProps(g); } }); }
  }

  // 城垣：每格城牆畫一塊牆體，並往相鄰的城牆格各延伸半段，連成一道連續、筆直的城牆；上面兩側排垛口
  function buildWalls(g) {
    if (V.walls) V.world.remove(V.walls);
    const grp = V.walls = new T.Group(); V.wallPick = [];
    const solid = (c, r) => r >= 0 && r < g.Hh && c >= 0 && c < g.W && 'WTG'.includes(g.map[r][c]);
    const box = V.wallBox = V.wallBox || new T.BoxGeometry(1, 1, 1);
    const WW = 1.3, top = TOP.W, merl = [];
    const tone = (c, r) => (((c * 7 + r * 13) % 3) === 0 ? 0x847a6e : ((c + r) % 2 ? 0x766d62 : 0x7d7468));
    const add = (c, r, w, h, d, x, y, z, ang, color, pick = true) => {
      const o = mesh(box, mat(color), true, true); o.scale.set(w, h, d); o.position.set(x, y, z); o.rotation.y = ang;
      if (pick) { o.userData.hex = [c, r]; V.wallPick.push(o); } grp.add(o);
    };
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) {
      if (!solid(c, r)) continue;
      const [x, z] = wpos(c, r); const col = tone(c, r); let ang0 = null;
      for (let d = 0; d < 6; d++) {
        const [nc, nr] = HX.neighbor(c, r, d); if (!solid(nc, nr)) continue;
        const [x2, z2] = wpos(nc, nr); const dx = x2 - x, dz = z2 - z, L = Math.hypot(dx, dz) / 2, ang = Math.atan2(dx, dz);
        if (ang0 == null) ang0 = ang;
        const ux = dx / (2 * L), uz = dz / (2 * L);
        add(c, r, WW, top, L, x + ux * L / 2, top / 2, z + uz * L / 2, ang, col);
        add(c, r, WW + 0.24, 0.22, L, x + ux * L / 2, 0.11, z + uz * L / 2, ang, 0x5f574e, false);           // 牆基
        add(c, r, WW + 0.08, 0.07, L, x + ux * L / 2, top - 0.12, z + uz * L / 2, ang, 0x6c645a, false);     // 牆簷
        for (let t = 0.12; t < L; t += 0.3) for (const s of [-1, 1]) merl.push([x + ux * t + uz * s * (WW / 2 - 0.08), z + uz * t - ux * s * (WW / 2 - 0.08), ang, s]);
      }
      const big = g.map[r][c] === 'T' ? 1.75 : WW;
      add(c, r, big, top, big, x, top / 2, z, ang0 || 0, col);
      if (g.map[r][c] === 'T') for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; merl.push([x + Math.sin(a) * 0.8, z + Math.cos(a) * 0.8, a, 1]); }
    }
    const mg = V.merlonGeo = V.merlonGeo || new T.BoxGeometry(0.16, 0.2, 0.15);
    const im = new T.InstancedMesh(mg, mat(0x786f64), Math.max(1, merl.length)); im.count = merl.length; im.castShadow = true;
    const M4 = new T.Matrix4(), Q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0), ONE = new T.Vector3(1, 1, 1);
    merl.forEach(([mx, mz, a, s], i) => { M4.compose(new T.Vector3(mx, top + 0.1 - (s < 0 ? 0.04 : 0), mz), Q.setFromAxisAngle(Y, a), ONE); im.setMatrixAt(i, M4); });
    grp.add(im); V.world.add(grp); V.dirty = true;
  }

  // 戰場擺設：火把、河岸石頭、糧營的木柵、哨塔、拒馬（地形改變時重建）
  function glowTexture() {
    if (V.glowTex) return V.glowTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,200,110,0.85)'); gr.addColorStop(0.35, 'rgba(255,140,40,0.35)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); V.glowTex = new T.CanvasTexture(cv); V.glowTex.colorSpace = T.SRGBColorSpace; return V.glowTex;
  }
  function buildProps(g) {
    if (V.props) V.world.remove(V.props);
    const grp = V.props = new T.Group(); const rnd = seeded(4242);
    const P = V.pgeo = V.pgeo || {
      post: new T.CylinderGeometry(0.035, 0.045, 0.9, 5), bowl: new T.CylinderGeometry(0.11, 0.06, 0.09, 6), flame: new T.ConeGeometry(0.08, 0.24, 5),
      stake: new T.CylinderGeometry(0.035, 0.045, 0.7, 4), rock: new T.DodecahedronGeometry(0.2, 0), leg: new T.CylinderGeometry(0.03, 0.04, 1.5, 4),
      deck: new T.BoxGeometry(0.62, 0.06, 0.62), roof: new T.ConeGeometry(0.5, 0.3, 4), spike: new T.CylinderGeometry(0.025, 0.025, 0.75, 4), beam: new T.CylinderGeometry(0.03, 0.03, 0.9, 4),
    };
    const wood = mat(0x4a3523), dark = mat(0x2b2118);
    const torch = (x, z) => {
      const y = groundY(x, z);
      const p = mesh(P.post, wood); p.position.set(x, y + 0.45, z); grp.add(p);
      const b = mesh(P.bowl, dark); b.position.set(x, y + 0.93, z); grp.add(b);
      const f = new T.Mesh(P.flame, new T.MeshBasicMaterial({ color: 0xffa035 })); f.position.set(x, y + 1.08, z); grp.add(f);
      const gl = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, opacity: 0.9 })); gl.scale.set(1.1, 1.1, 1); gl.position.set(x, y + 1.08, z); gl.raycast = () => {}; grp.add(gl);
    };
    let pc = null;
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'P') pc = wpos(c, r);
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) {
      const ch = g.map[r][c]; const [x, z] = wpos(c, r);
      if (ch === 'G' || ch === 'o') {   // 城門外兩側火把
        const out = pc && x < pc[0] ? -1 : 1;
        for (const s2 of [-1, 1]) torch(x + out * 1.05, z + s2 * 0.75);
      } else if (ch === '=') {   // 渡口兩頭
        if (rnd() < 0.6) torch(x - 1.0, z + 0.55); else torch(x + 1.0, z - 0.55);
      } else if (ch === 'S') {   // 糧營：木柵、哨塔、拒馬、火把
        const stakes = [];
        for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; if (Math.abs(Math.cos(a) - 1) < 0.15) continue; stakes.push([x + Math.cos(a) * 1.15, z + Math.sin(a) * 1.0, (rnd() - 0.5) * 0.15]); }
        const im = new T.InstancedMesh(P.stake, wood, stakes.length); im.castShadow = true;
        const M4 = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Vector3(), ONE = new T.Vector3(1, 1, 1);
        stakes.forEach(([sx, sz, tilt], i) => { M4.compose(E.set(sx, groundY(sx, sz) + 0.3, sz), Q.setFromAxisAngle(new T.Vector3(1, 0, 0), tilt), ONE); im.setMatrixAt(i, M4); });
        grp.add(im);
        // 哨塔
        const tx = x - 0.75, tz = z - 0.7, ty = groundY(tx, tz);
        for (const [lx, lz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) { const l = mesh(P.leg, wood); l.position.set(tx + lx, ty + 0.75, tz + lz); grp.add(l); }
        const dk = mesh(P.deck, wood); dk.position.set(tx, ty + 1.45, tz); grp.add(dk);
        const rf = mesh(P.roof, dark); rf.position.set(tx, ty + 1.85, tz); rf.rotation.y = Math.PI / 4; grp.add(rf);
        // 拒馬
        for (let k = 0; k < 2; k++) {
          const bx = x + 1.6, bz = z + (k ? 0.55 : -0.55), by = groundY(bx, bz) + 0.22;
          const beam = mesh(P.beam, wood); beam.position.set(bx, by, bz); beam.rotation.x = Math.PI / 2; grp.add(beam);
          for (let q = -1; q <= 1; q++) for (const s2 of [-1, 1]) { const sp = mesh(P.spike, wood); sp.position.set(bx, by, bz + q * 0.32); sp.rotation.z = s2 * 0.75; grp.add(sp); }
        }
        torch(x + 1.25, z + 1.0); torch(x + 1.25, z - 1.0);
      }
      // 河岸石頭
      if ((ch === '.' || ch === 'l' || ch === 'd') && rnd() < 0.4) {
        const wet = HX.neighbors(c, r).map((n, d) => [n, d]).filter(([[nc, nr]]) => g.map[nr] && (g.map[nr][nc] === '~' || g.map[nr][nc] === 'w'));
        if (wet.length) {
          const [[nc, nr]] = wet[Math.floor(rnd() * wet.length)]; const [wx, wz] = wpos(nc, nr);
          for (let i = 0; i < 1 + (rnd() < 0.5); i++) {
            const t = 0.42 + rnd() * 0.12, rx = x + (wx - x) * t + (rnd() - 0.5) * 0.5, rz = z + (wz - z) * t + (rnd() - 0.5) * 0.5;
            const o = mesh(P.rock, mat(rnd() < 0.5 ? 0x5f5a50 : 0x6d675b)); o.position.set(rx, groundY(rx, rz) + 0.02, rz); o.scale.set(1 + rnd(), 0.5 + rnd() * 0.4, 0.8 + rnd() * 0.6); o.rotation.y = rnd() * 3; grp.add(o);
          }
        }
      }
    }
    V.world.add(grp);
  }

  // 草叢、野花、灌木：平原格隨機撒一些（用 InstancedMesh，一種只要一次繪製）
  function buildFlora(g) {
    if (V.flora) V.world.remove(V.flora);
    const grp = V.flora = new T.Group();
    const tufts = [], flowers = [], bushes = [];
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) {
      if (g.map[r][c] !== '.') continue;
      const rnd = seeded(c * 131 + r * 71 + 5); const [x, z] = wpos(c, r); const y = TOP['.'];
      const n = 4 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) tufts.push([x + (rnd() - 0.5) * 1.4, y, z + (rnd() - 0.5) * 1.4, 0.7 + rnd() * 0.7, rnd()]);
      if (rnd() < 0.18) for (let i = 0; i < 3; i++) flowers.push([x + (rnd() - 0.5) * 1.2, y + 0.03, z + (rnd() - 0.5) * 1.2, 0.8 + rnd() * 0.5, rnd()]);
      if (rnd() < 0.14) bushes.push([x + (rnd() - 0.5) * 0.9, y + 0.05, z + (rnd() - 0.5) * 0.9, 0.8 + rnd() * 0.6, rnd()]);
    }
    const M4 = new T.Matrix4(), Q = new T.Quaternion(), P = new T.Vector3(), Sc = new T.Vector3(), C = new T.Color();
    const inst = (geo, list, colors, shadow) => {
      if (!list.length) return;
      const im = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), list.length); im.castShadow = shadow;
      list.forEach(([x, y, z, s, k], i) => { M4.compose(P.set(x, y, z), Q, Sc.set(s, s, s)); im.setMatrixAt(i, M4); im.setColorAt(i, C.setHex(colors[Math.floor(k * colors.length)])); });
      grp.add(im);
    };
    const G = V.fgeo = V.fgeo || { tuft: (() => { const t = new T.ConeGeometry(0.05, 0.16, 4); t.translate(0, 0.08, 0); return t; })(), flower: new T.DodecahedronGeometry(0.035, 0), bush: new T.DodecahedronGeometry(0.17, 0) };
    inst(G.tuft, tufts, [0x5f6c37, 0x6d7a40, 0x52602f, 0x7b8649], false);
    inst(G.flower, flowers, [0xe8dcb0, 0xd9b54a, 0xc98a8a], false);
    inst(G.bush, bushes, [0x3c4b2a, 0x46552e, 0x334226], true);
    V.world.add(grp);
  }

  // ---------- 部隊模型 ----------
  const toneOf = side => (root.SIDE_TONE || { att: 'blue', def: 'red' })[side];
  function sideColor(side) { return toneOf(side) === 'blue' ? 0x3b6fc4 : 0xc8463a; }
  function flagTexture(text, color) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const x = cv.getContext('2d');
    x.fillStyle = '#' + color.toString(16).padStart(6, '0'); x.fillRect(0, 0, 64, 64);
    x.strokeStyle = '#f5e6c0'; x.lineWidth = 4; x.strokeRect(3, 3, 58, 58);
    x.fillStyle = '#fff'; x.font = 'bold 40px "Noto Serif TC","Microsoft JhengHei",serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 32, 35);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }
  // 部隊頭上的徽章：圓形武將頭像（器械用兵種字）、兵力點數（5 格）、陣勢細條、兵力數字
  const faceImgs = {};
  function faceImg(u) {
    const k = u.gen + '|' + toneOf(u.side); if (faceImgs[k]) return faceImgs[k];
    const img = new Image(); faceImgs[k] = img; img.ok = false;
    const A = root.PORTRAIT_ART, file = A && A.approvedFile && A.approvedFile(u.gen, 'default');
    const svgUrl = () => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(root.PORTRAITS.svg(u.gen, 'default', { side: u.side }));
    img.onload = () => {
      img.ok = true;
      if (V.g) for (const v of V.g.units) if (v.gen === u.gen && v.side === u.side) { const rec = V.units.get(v.id); if (rec) { rec.lsig = null; refreshLabel(v, V.g); } }
      V.dirty = true;
    };
    img.onerror = () => { if (file && !img.svg) { img.svg = true; img.src = svgUrl(); } };
    img.src = file ? A.DIR + file : svgUrl(); if (!file) img.svg = true;
    return img;
  }
  function labelTexture(u, g) {
    const R = root.RULES;
    const cv = u._lcv || (u._lcv = document.createElement('canvas')); cv.width = 128; cv.height = 168; const x = cv.getContext('2d');
    x.clearRect(0, 0, 128, 168);
    const sideC = toneOf(u.side) === 'blue' ? '#3b6fc4' : '#c8463a';
    const cx = 64, cy = 54, rad = 44;
    x.save(); x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.closePath(); x.fillStyle = '#1d1712'; x.fill(); x.clip();
    const img = !R.isEngine(u) && root.PORTRAITS ? faceImg(u) : null;
    if (img && img.ok) x.drawImage(img, cx - rad - 6, cy - rad - 2, (rad + 6) * 2, (rad + 6) * 2);
    else {
      x.fillStyle = sideC; x.fillRect(0, 0, 128, 128);
      x.fillStyle = '#f5e9d3'; x.font = 'bold 46px "Noto Serif TC","Microsoft JhengHei",serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(R.isEngine(u) ? R.ty(u).icon : R.gen(u).mark, cx, cy + 2);
    }
    x.restore();
    x.lineWidth = 7; x.strokeStyle = '#1a140e'; x.beginPath(); x.arc(cx, cy, rad + 2, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 4; x.strokeStyle = sideC; x.beginPath(); x.arc(cx, cy, rad + 1, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2; x.strokeStyle = '#d8b56a'; x.beginPath(); x.arc(cx, cy, rad + 4.5, 0, Math.PI * 2); x.stroke();
    // 兵力點數
    const n = u.troops <= 0 ? 0 : Math.max(1, Math.ceil(u.troops / u.max * 5));
    for (let i = 0; i < 5; i++) {
      const px = 28 + i * 18, py = 114;
      x.beginPath(); x.moveTo(px, py - 8); x.quadraticCurveTo(px + 7, py, px, py + 7); x.quadraticCurveTo(px - 7, py, px, py - 8); x.closePath();
      x.fillStyle = i < n ? '#f0a43a' : 'rgba(20,16,10,0.75)'; x.fill(); x.lineWidth = 2; x.strokeStyle = 'rgba(20,14,8,0.9)'; x.stroke();
    }
    // 陣勢
    if (!R.isEngine(u)) { x.fillStyle = 'rgba(20,16,10,0.75)'; x.fillRect(22, 128, 84, 6); x.fillStyle = u.coh >= 70 ? '#7cc46a' : u.coh >= 40 ? '#e0b84a' : '#e05a3a'; x.fillRect(22, 128, 84 * u.coh / 100, 6); }
    // 兵力數字
    x.font = 'bold 22px "Microsoft JhengHei","PingFang TC",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'top';
    x.lineJoin = 'round'; x.lineWidth = 5; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.strokeText(u.troops, cx, 139); x.fillStyle = '#f5e9d3'; x.fillText(u.troops, cx, 139);
    return cv;
  }
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  const UG = {};
  function unitGeos() {
    if (UG.body) return UG;
    UG.body = new T.CylinderGeometry(0.07, 0.09, 0.3, 6); UG.body.translate(0, 0.15, 0);
    UG.head = new T.SphereGeometry(0.065, 7, 5); UG.head.translate(0, 0.37, 0);
    UG.bodyC = UG.body.clone(); UG.bodyC.translate(0, 0.17, 0);
    UG.headC = UG.head.clone(); UG.headC.translate(0, 0.17, 0);
    UG.horse = new T.BoxGeometry(0.34, 0.17, 0.12); UG.horse.translate(0, 0.13, 0);
    UG.spear = new T.BoxGeometry(0.018, 0.55, 0.018); UG.spear.translate(0.08, 0.3, 0.05);
    UG.bow = new T.TorusGeometry(0.1, 0.012, 3, 8, Math.PI); UG.bow.rotateY(Math.PI / 2); UG.bow.translate(0.08, 0.22, 0);
    UG.pole = new T.CylinderGeometry(0.015, 0.015, 1.0, 4); UG.pole.translate(0, 0.5, 0);
    UG.flag = new T.PlaneGeometry(0.34, 0.34); UG.flag.translate(0.18, 0.82, 0);
    UG.arrowHead = new T.ConeGeometry(0.1, 0.22, 3); UG.arrowHead.rotateZ(-Math.PI / 2);
    UG.wheel = new T.CylinderGeometry(0.1, 0.1, 0.05, 8); UG.wheel.rotateX(Math.PI / 2);
    return UG;
  }
  // 依陣型排列 n 個小兵（本地座標：x＝前方、z＝側面）
  function layout(form, n, seedv) {
    const P = []; const rnd = seeded(seedv);
    if (form === 'fengshi') { let row = 0; while (P.length < n) { for (let i = 0; i <= row && P.length < n; i++) P.push([0.5 - row * 0.2, (i - row / 2) * 0.2]); row++; } }
    else if (form === 'yulin') { const rows = [2, 3, 4, 3, 4, 3]; let ri = 0; while (P.length < n) { const w = rows[ri % rows.length]; for (let i = 0; i < w && P.length < n; i++) P.push([0.4 - ri * 0.17, (i - (w - 1) / 2) * 0.19 + (ri % 2 ? 0.05 : -0.05)]); ri++; } }
    else if (form === 'hexi') { P.push([-0.25, 0]); let i = 1; while (P.length < n) { const s = i % 2 ? 1 : -1, k = Math.ceil(i / 2); P.push([-0.25 + k * 0.12, s * k * 0.15]); i++; } }
    else if (form === 'yanxing') { const half = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const back = i >= half; const j = back ? i - half : i; const w = back ? n - half : half; P.push([back ? -0.2 : 0.15, (j - (w - 1) / 2) * 0.22 + (back ? 0.11 : 0)]); } }
    else if (form === 'changshe') { const cols = n > 8 ? 2 : 1; for (let i = 0; i < n; i++) { const col = i % cols, row = Math.floor(i / cols); const rowsN = Math.ceil(n / cols); P.push([0.75 - row * (1.5 / Math.max(1, rowsN - 1)), cols === 2 ? (col - 0.5) * 0.18 : 0]); } }
    else if (form === 'wall') { const half = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const back = i >= half, j = back ? i - half : i, w = back ? n - half : half; P.push([back ? -0.12 : 0.18, (j - (w - 1) / 2) * (1.3 / Math.max(1, w - 1)) * 0.9]); } return P; }   // 城牆上：沿著城牆排成兩列
    else if (form === 'fangyuan') { const ring = Math.min(n, n > 6 ? n - 2 : n); for (let i = 0; i < ring; i++) { const a = i / ring * Math.PI * 2; P.push([Math.cos(a) * 0.48, Math.sin(a) * 0.48]); } for (let i = ring; i < n; i++) P.push([(i - ring - 0.5) * 0.15, 0]); }
    else { for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.7; P.push([Math.cos(a) * d, Math.sin(a) * d]); } }
    return P.map(([a, b]) => [a * 1.15, b * 1.2]);
  }
  function figureCount(u) { const base = u.type === 'cav' ? 9 : 12; return Math.max(2, Math.ceil(base * u.troops / u.max)); }

  function makeUnit(u, g) {
    const G = unitGeos(); const R = root.RULES; const col = sideColor(u.side);
    const grp = new T.Group(); const inner = new T.Group(); grp.add(inner);
    const rec = { grp, inner, figs: [], side: u.side, type: u.type, form: null, n: 0 };
    if (R.isEngine(u)) buildEngine(u, inner, col);
    else {
      const N = 16;
      if (u.type === 'cav' && root.CAVALRY) {
        // 騎兵：披甲戰馬（毛色由 instanceColor 決定）＋裝備與騎士（頂點色，含陣營色），移動／衝鋒時換成奔馳姿態
        const geo = root.CAVALRY.build(T, toneOf(u.side), 'idle');
        const coat = new T.InstancedMesh(geo.coat, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), N);
        const gear = new T.InstancedMesh(geo.gear, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }), N);
        const c = new T.Color(); for (let i = 0; i < N; i++) coat.setColorAt(i, c.setHex(root.CAVALRY.coatOf(u, i)));
        for (const m of [coat, gear]) { m.castShadow = true; m.count = 0; inner.add(m); }
        rec.ims = [coat, gear]; rec.cur = []; rec.target = []; rec.cav = true; rec.pose = 'idle';
      } else {
      const mBody = new T.InstancedMesh(G.body, mat(col), N), mHead = new T.InstancedMesh(G.head, mat(0xe8c8a0), N);
      const extra = u.type === 'arc' ? new T.InstancedMesh(G.bow, mat(0x5a3a1a), N) : new T.InstancedMesh(G.spear, mat(0x9a9a9a), N);
      for (const m of [mBody, mHead, extra]) { m.castShadow = true; m.count = 0; inner.add(m); }
      rec.ims = [mBody, mHead, extra]; rec.cur = []; rec.target = [];
      }
    }
    // 軍旗（將旗）
    const flagM = new T.MeshStandardMaterial({ map: flagTexture(R.isEngine(u) ? R.ty(u).icon : R.gen(u).mark, col), side: T.DoubleSide, roughness: 0.9 });
    const pole = mesh(G.pole, mat(0x4a3420)); pole.position.set(-0.35, 0, 0.35); const flag = mesh(G.flag, flagM); flag.position.copy(pole.position);
    grp.add(pole, flag); rec.flag = flag; rec.flagM = flagM;
    // 朝向箭頭
    const arrow = new T.Mesh(G.arrowHead, new T.MeshBasicMaterial({ color: col })); arrow.position.set(0.82, 0.03, 0); arrow.scale.set(1, 0.15, 1); inner.add(arrow); rec.arrow = arrow;
    // 名牌
    const lcv = labelTexture(u, g); const ltex = new T.CanvasTexture(lcv); ltex.colorSpace = T.SRGBColorSpace;
    const label = new T.Sprite(new T.SpriteMaterial({ map: ltex, depthTest: false, transparent: true })); label.scale.set(0.8, 1.05, 1); label.position.y = 1.65; label.renderOrder = 10;
    label.raycast = () => {};   // 名牌浮在後一格上方，不攔截點擊（點名牌下方的格子才準）
    grp.add(label); rec.label = label; rec.ltex = ltex;
    V.scene.add(grp); V.units.set(u.id, rec);
    placeUnit(u, g, true);
    return rec;
  }
  function buildEngine(u, inner, col) {
    const wood = mat(0x8a6236), dark = mat(0x5a3a1a), G = unitGeos();
    const wheels = (w, l) => { for (const sx of [-l, l]) for (const sz of [-w, w]) { const o = mesh(G.wheel, dark); o.position.set(sx, 0.1, sz); inner.add(o); } };
    if (u.type === 'ram') {
      const b = mesh(new T.BoxGeometry(0.9, 0.35, 0.5), wood); b.position.y = 0.32; inner.add(b);
      const roof = mesh(new T.ConeGeometry(0.55, 0.3, 4), mat(0x6b5a3a)); roof.position.y = 0.64; roof.rotation.y = Math.PI / 4; roof.scale.set(1.4, 1, 0.8); inner.add(roof);
      const log = mesh(new T.CylinderGeometry(0.07, 0.07, 1.1, 6), dark); log.rotation.z = Math.PI / 2; log.position.set(0.25, 0.32, 0); inner.add(log);
      wheels(0.27, 0.3);
    } else if (u.type === 'ladder') {
      const base = mesh(new T.BoxGeometry(0.8, 0.12, 0.4), wood); base.position.y = 0.18; inner.add(base);
      const lad = new T.Group(); lad.position.set(-0.25, 0.2, 0); lad.rotation.z = -1.0;
      for (const s of [-0.13, 0.13]) { const rl = mesh(new T.BoxGeometry(1.3, 0.04, 0.04), wood); rl.position.set(0.65, 0, s); lad.add(rl); }
      for (let i = 0; i < 6; i++) { const rg = mesh(new T.BoxGeometry(0.03, 0.03, 0.26), dark); rg.position.set(0.12 + i * 0.22, 0, 0); lad.add(rg); }
      inner.add(lad); wheels(0.22, 0.28);
    } else if (u.type === 'tower') {
      for (const sx of [-0.25, 0.25]) for (const sz of [-0.25, 0.25]) { const p = mesh(new T.BoxGeometry(0.06, 1.4, 0.06), wood); p.position.set(sx, 0.85, sz); inner.add(p); }
      const plat = mesh(new T.BoxGeometry(0.66, 0.08, 0.66), dark); plat.position.y = 1.5; inner.add(plat);
      const wall = mesh(new T.BoxGeometry(0.66, 0.25, 0.66), mat(col)); wall.position.y = 1.65; wall.scale.set(1, 1, 1); inner.add(wall);
      const base = mesh(new T.BoxGeometry(0.7, 0.15, 0.7), wood); base.position.y = 0.2; inner.add(base); wheels(0.3, 0.3);
    } else if (u.type === 'cata') {
      const base = mesh(new T.BoxGeometry(0.8, 0.15, 0.45), wood); base.position.y = 0.2; inner.add(base);
      for (const sz of [-0.15, 0.15]) { const p = mesh(new T.BoxGeometry(0.06, 0.5, 0.06), wood); p.position.set(0, 0.5, sz); inner.add(p); }
      const arm = new T.Group(); arm.position.set(0, 0.7, 0); const bar = mesh(new T.BoxGeometry(1.1, 0.05, 0.05), dark); bar.position.x = 0.15; arm.add(bar);
      const cw = mesh(new T.BoxGeometry(0.18, 0.18, 0.18), mat(0x666666)); cw.position.x = -0.38; arm.add(cw); arm.rotation.z = 0.5; inner.add(arm);
      inner.userData.arm = arm; wheels(0.24, 0.3);
    }
  }
  function placeUnit(u, g, instant) {
    const rec = V.units.get(u.id); if (!rec) return;
    let [x, z] = wpos(u.c, u.r); const y = topAt(g, u.c, u.r);
    // 同一格兩支部隊（器械＋友軍）：器械往右後方挪，作戰部隊往左前方挪
    if (g.units.some(v => v !== u && v.alive && v.c === u.c && v.r === u.r)) { const e = root.RULES.isEngine(u) ? 1 : -1; x += e * 0.42; z += e * 0.3; }
    rec.home = [x, y, z];
    if (instant || !rec.moving) rec.grp.position.set(x, y, z);
    rec.targetYaw = HX.angleOf(u.face) * Math.PI / 180;
    if (instant) rec.inner.rotation.y = rec.targetYaw;
    updateFigures(u, rec, instant);
  }
  function updateFigures(u, rec, instant) {
    const R = root.RULES;
    if (!rec.ims) return;
    const st = R.state(u); const form = V.g && R.onWall(V.g, u) ? 'wall' : st === 'disorder' ? 'chaos' : u.form;
    const n = figureCount(u);
    if (form !== rec.form || n !== rec.n) {
      rec.form = form; rec.n = n;
      rec.target = layout(form, n, u.id * 97 + (u.routed || 0));
      if (rec.cav) rec.target = rec.target.map(([a, b]) => [a * 1.15, b * 1.3]);   // 馬比較長，隊形拉開一點
      rec.yawJit = rec.target.map((_, i) => (form === 'chaos' ? (seeded(u.id * 13 + i)() - 0.5) * 3 : 0));
      while (rec.cur.length < n) rec.cur.push(rec.target[rec.cur.length] ? [...rec.target[rec.cur.length]] : [0, 0]);
      rec.cur.length = n;
      if (instant) rec.cur = rec.target.map(p => [...p]);
      rec.ims.forEach(m => (m.count = n));
    }
  }
  const _m4 = () => new T.Matrix4(); let M4, Q, S1, P3; const CAV_SCALE = 1.3; let S1c;
  function drawFigures(rec, dt) {
    if (!rec.ims) return false;
    M4 = M4 || _m4(); Q = Q || new T.Quaternion(); S1 = S1 || new T.Vector3(1, 1, 1); S1c = S1c || new T.Vector3(CAV_SCALE, CAV_SCALE, CAV_SCALE); P3 = P3 || new T.Vector3();
    let moving = false; const k = Math.min(1, dt * 4);
    for (let i = 0; i < rec.n; i++) {
      const c = rec.cur[i], t = rec.target[i]; if (!t) continue;
      const dx = t[0] - c[0], dz = t[1] - c[1];
      if (Math.abs(dx) + Math.abs(dz) > 0.002) { c[0] += dx * k; c[1] += dz * k; moving = true; }
      Q.setFromAxisAngle(new T.Vector3(0, 1, 0), rec.yawJit[i] || 0);
      M4.compose(P3.set(c[0], 0, -c[1]), Q, rec.cav ? S1c : S1);
      for (const m of rec.ims) m.setMatrixAt(i, M4);
    }
    for (const m of rec.ims) m.instanceMatrix.needsUpdate = true;
    return moving;
  }
  function syncUnits(g) {
    const R = root.RULES;
    for (const u of g.units) {
      let rec = V.units.get(u.id);
      if (!u.alive) { if (rec && !rec.dying) { V.scene.remove(rec.grp); V.units.delete(u.id); } continue; }
      if (rec && rec.type !== u.type && !rec.dying) { V.scene.remove(rec.grp); V.units.delete(u.id); rec = null; }   // 合流後兵種改變：重建模型
      if (!rec) rec = makeUnit(u, g);
      if (rec.side !== u.side) { recolor(u, rec); }
      placeUnit(u, g, false);
      refreshLabel(u, g);
    }
    applyHidden(g);
    V.dirty = true;
  }
  // 伏兵：藏在林中、敵軍看不到的部隊不畫出來（只對「對方」隱藏）
  function applyHidden(g) {
    const R = root.RULES; if (!R.hidden) return;
    for (const u of g.units) { const rec = V.units.get(u.id); if (rec) rec.grp.visible = !(V.viewSide && u.side !== V.viewSide && R.hidden(g, u)); }
    V.dirty = true;
  }
  // 騎兵姿態：'idle' 站立、'run' 奔馳（換幾何體，陣營色也在這裡換）
  function setPose(u, rec, pose) {
    if (!rec || !rec.cav) return; rec.pose = pose;
    const geo = root.CAVALRY.build(T, toneOf(u.side), pose);
    rec.ims[0].geometry = geo.coat; rec.ims[1].geometry = geo.gear; V.dirty = true;
  }
  function recolor(u, rec) {
    const col = sideColor(u.side); rec.side = u.side;
    if (rec.cav) setPose(u, rec, rec.pose); else if (rec.ims) rec.ims[0].material = mat(col);
    rec.arrow.material.color.setHex(col);
    rec.flagM.map = flagTexture(root.RULES.gen(u).mark, col); rec.flagM.needsUpdate = true;
  }
  function refreshLabel(u, g) {
    const rec = V.units.get(u.id); if (!rec) return;
    const sig = u.troops + '|' + Math.round(u.coh) + '|' + u.name + '|' + u.side;
    if (rec.lsig === sig) return; rec.lsig = sig;
    labelTexture(u, g); rec.ltex.needsUpdate = true;
  }

  // ---------- 標示 ----------
  let hexGeo = null;
  function hexOverlay(color, opacity) {
    hexGeo = hexGeo || (() => { const gg = new T.CircleGeometry(0.9, 6); gg.rotateX(-Math.PI / 2); gg.rotateY(Math.PI / 6); return gg; })();
    const m = new T.Mesh(hexGeo, new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.renderOrder = 2; return m;
  }
  // 格子外框（可移動格用：淡淡的白框）
  let edgeGeo = null;
  function hexEdge(color, opacity = 0.95) {
    edgeGeo = edgeGeo || new T.RingGeometry(0.885, 0.945, 6, 1, Math.PI / 6);
    const m = new T.Mesh(edgeGeo, new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 3; return m;
  }
  function highlight(list) {
    clearHighlights();
    for (const h of list) {
      const [x, z] = wpos(h.c, h.r);
      if (h.color != null) { const o = hexOverlay(h.color, h.opacity || 0.45); o.position.set(x, topAt(V.g, h.c, h.r) + 0.04, z); if (h.scale) o.scale.setScalar(h.scale); V.scene.add(o); V.hl.push(o); }
      if (h.edge) { const e = hexEdge(h.edge, h.edgeOpacity); e.position.set(x, topAt(V.g, h.c, h.r) + 0.05, z); V.scene.add(e); V.hl.push(e); }
    }
    V.dirty = true;
  }
  function clearHighlights() { for (const o of V.hl) V.scene.remove(o); V.hl = []; V.dirty = true; }

  // 方向弱點圈：六個扇形，顏色＝受傷倍率（綠＝強、紅＝弱）
  function showSides(u, profile) {
    if (V.sides) { V.scene.remove(V.sides); V.sides = null; }
    if (!u || !profile) { V.dirty = true; return; }
    const grp = new T.Group();
    for (let d = 0; d < 6; d++) {
      const diff = HX.dirDiff(u.face, d); const m = profile[diff];
      const col = m <= 1.0 ? 0x3fbf5a : m <= 1.25 ? 0xe6c84a : m <= 1.5 ? 0xf08a3a : 0xe0402f;
      const geo = new T.RingGeometry(0.98, 1.22, 2, 1, (d * 60 - 28) * Math.PI / 180, 56 * Math.PI / 180);
      const o = new T.Mesh(geo, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false }));
      o.rotation.x = -Math.PI / 2; o.renderOrder = 3; grp.add(o);
    }
    const [x, z] = wpos(u.c, u.r); grp.position.set(x, topAt(V.g, u.c, u.r) + 0.05, z);
    V.scene.add(grp); V.sides = grp; V.dirty = true;
  }
  function selectRing(u) {
    if (V.sel) { V.scene.remove(V.sel); V.sel = null; }
    if (!u) { V.dirty = true; return; }
    const o = new T.Mesh(new T.RingGeometry(0.8, 0.95, 6, 1, Math.PI / 6), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, depthWrite: false, side: T.DoubleSide }));
    o.rotation.x = -Math.PI / 2; const [x, z] = wpos(u.c, u.r); o.position.set(x, topAt(V.g, u.c, u.r) + 0.06, z); o.renderOrder = 4;
    V.scene.add(o); V.sel = o; V.selU = u.id; V.dirty = true;
  }
  // 河堤標記：可以掘堤時，在河堤上方浮一個「⛏ 掘堤」牌子
  function digMarks(g, list) {
    const sig = list.map(p => p.join(',')).join(';');
    if (V.digSig === sig && V.digGrp) return; V.digSig = sig;
    if (V.digGrp) V.scene.remove(V.digGrp); V.digGrp = null; if (!list.length) { V.dirty = true; return; }
    if (!V.digTex) {
      const cv = document.createElement('canvas'); cv.width = 160; cv.height = 64; const x = cv.getContext('2d');
      x.fillStyle = 'rgba(20,40,55,0.85)'; roundRect(x, 4, 4, 152, 56, 14); x.fill(); x.lineWidth = 3; x.strokeStyle = '#7fd3ff'; x.stroke();
      x.fillStyle = '#e6f7ff'; x.font = 'bold 30px "Microsoft JhengHei","PingFang TC",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⛏ 掘堤', 80, 34);
      V.digTex = new T.CanvasTexture(cv); V.digTex.colorSpace = T.SRGBColorSpace;
    }
    V.digGrp = new T.Group();
    for (const [c, r] of list) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: V.digTex, depthTest: false, transparent: true })); sp.scale.set(1.0, 0.4, 1); sp.renderOrder = 9; sp.raycast = () => {};
      const [x, z] = wpos(c, r); sp.position.set(x, topAt(g, c, r) + 0.9, z); V.digGrp.add(sp);
    }
    V.scene.add(V.digGrp); V.dirty = true;
  }
  // 糧營牌子：糧營名稱與剩餘存量（單位：千人日），起火時標出燒到第幾階段
  function depotMarks(g) {
    const list = (g.vars.depots || []).filter(d => !d.burnt).map(d => ({ d, left: Math.max(0, Math.round(d.s - (d.lost || 0))), fire: g.vars.burning && g.vars.burning[d.c + ',' + d.r] ? (g.vars.dstage && g.vars.dstage[d.c + ',' + d.r]) || 1 : 0 }));
    const sig = list.map(o => o.d.c + ',' + o.d.r + ':' + o.left + ':' + o.fire).join(';');
    if (V.depSig === sig && V.depGrp) return; V.depSig = sig;
    if (V.depGrp) V.scene.remove(V.depGrp); V.depGrp = null; if (!list.length) { V.dirty = true; return; }
    V.depGrp = new T.Group(); V.depTex = V.depTex || {};
    for (const o of list) {
      const key = o.d.name + o.left + ':' + o.fire;
      if (!V.depTex[key]) {
        const cv = document.createElement('canvas'); cv.width = 240; cv.height = 64; const x = cv.getContext('2d');
        x.fillStyle = o.fire ? 'rgba(80,28,12,0.82)' : 'rgba(40,32,20,0.78)'; roundRect(x, 4, 4, 232, 56, 14); x.fill(); x.lineWidth = 2; x.strokeStyle = o.fire ? '#ff9a4a' : '#d9b26a'; x.stroke();
        x.fillStyle = '#f6e7c1'; x.font = 'bold 24px "Microsoft JhengHei","PingFang TC",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText((o.fire ? '🔥' : '🌾') + o.d.name.slice(0, 2) + ' ' + o.left, 120, 34);
        V.depTex[key] = new T.CanvasTexture(cv); V.depTex[key].colorSpace = T.SRGBColorSpace;
      }
      const sp = new T.Sprite(new T.SpriteMaterial({ map: V.depTex[key], depthTest: false, transparent: true, opacity: 0.9 })); sp.scale.set(1.9, 0.51, 1); sp.renderOrder = 8; sp.raycast = () => {};
      const [x, z] = wpos(o.d.c, o.d.r); sp.position.set(x, topAt(g, o.d.c, o.d.r) + 1.15, z); V.depGrp.add(sp);
    }
    V.scene.add(V.depGrp); V.dirty = true;
  }
  // 燃燒中的糧營：持續搖曳的火苗（在 loop 裡動畫）
  function fireMarks(g, list) {
    const sig = list.map(p => p.join(',')).join(';');
    if (V.fireSig === sig && V.fireGrp) return; V.fireSig = sig;
    if (V.fireGrp) V.scene.remove(V.fireGrp); V.fireGrp = null; if (!list.length) { V.dirty = true; return; }
    V.fireGrp = new T.Group(); V.fireCones = [];
    for (const [c, r] of list) {
      const [x, z] = wpos(c, r), y = topAt(g, c, r);
      for (let i = 0; i < 6; i++) { const o = new T.Mesh(new T.ConeGeometry(0.17, 0.55, 5), new T.MeshBasicMaterial({ color: i % 2 ? 0xff7a14 : 0xffd04a, transparent: true, opacity: 0.88 })); o.position.set(x + (Math.random() - 0.5) * 1.0, y + 0.3, z + (Math.random() - 0.5) * 1.0); o.raycast = () => {}; o.userData.ph = Math.random() * 6; V.fireGrp.add(o); V.fireCones.push(o); }
    }
    V.scene.add(V.fireGrp); V.dirty = true;
  }
  // 河堤：把相連的 'd' 格連成一道窄窄的竹籠石堤（像城牆一樣連續）：堤心夯土、兩側竹籠裝石、河側木樁護岸、堤頂木欄
  function buildLevee(g) {
    if (V.levee) V.world.remove(V.levee); V.levee = null;
    const pts = []; for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'd') pts.push(wpos(c, r));
    if (!pts.length) return;
    pts.sort((a, b) => a[1] - b[1]);
    const grp = new T.Group(), earth = mat(0x8b7a55), cageA = mat(0xa88a52), cageB = mat(0x967a45), pile = mat(0x5a4328), rail = mat(0x6b4a2b);
    const Y0 = 0.45;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i], prev = pts[i - 1], next = pts[i + 1];
      // 每一格畫「走向下一格」的一段；最後一格往前一格的方向收尾
      const [ex, ez] = next || [x + (x - prev[0]), z + (z - prev[1])];
      const dx = ex - x, dz = ez - z, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
      const seg = new T.Group(); seg.position.set((x + (next ? ex : x)) / 2, Y0, (z + (next ? ez : z)) / 2); seg.rotation.y = ang;
      const L = next ? len + 0.12 : 0.9;
      if (!next) seg.position.set(x + dx * 0.25, Y0, z + dz * 0.25);
      const core = mesh(new T.BoxGeometry(0.46, 0.34, L), earth); core.position.y = 0.1; seg.add(core);
      const n = Math.max(2, Math.round(L / 0.42));
      for (let k = 0; k < n; k++) for (const sx of [-1, 1]) {
        const cage = mesh(new T.CylinderGeometry(0.15, 0.15, L / n * 0.98, 7), (k + (sx > 0 ? 1 : 0)) % 2 ? cageA : cageB); cage.rotation.x = Math.PI / 2;
        cage.position.set(sx * 0.31, 0.02, -L / 2 + (k + 0.5) * L / n); cage.scale.set(1, 1, 1); seg.add(cage);
      }
      const ns = Math.max(3, Math.round(L / 0.2));
      for (let k = 0; k < ns; k++) { const st = mesh(new T.CylinderGeometry(0.03, 0.04, 0.5, 5), pile); st.position.set(-0.5, 0.05, -L / 2 + (k + 0.5) * L / ns); st.rotation.z = 0.1; seg.add(st); }
      for (const sx of [-0.18, 0.18]) { const rl = mesh(new T.BoxGeometry(0.035, 0.04, L), rail, false); rl.position.set(sx, 0.4, 0); seg.add(rl); }
      for (let k = 0; k <= 2; k++) for (const sx of [-0.18, 0.18]) { const p = mesh(new T.BoxGeometry(0.04, 0.2, 0.04), rail, false); p.position.set(sx, 0.3, -L / 2 + 0.05 + k * (L - 0.1) / 2); seg.add(p); }
      grp.add(seg);
    }
    V.levee = grp; V.world.add(grp);
  }
  // 河堤破口：每掘一次堤上多一處缺口（越掘越大），大水決堤後缺口湧出水柱；另調整水位（三波漲高、退水時回落）
  function leveeMarks(g) {
    const v = g.vars, seg = v.digSeg || {}, dikes = [];
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'd') dikes.push([c, r]);
    const stage = v.flooded && !v.receded ? (v.floodStage || 1) : 0;
    V.waterTarget = [0, 0.03, 0.06, 0.09][stage];
    const sig = dikes.map(([c, r]) => (seg[c + ',' + r] || 0)).join(',') + ':' + (v.flooded && !v.receded ? 1 : 0) + ':' + (v.floodAt || '');
    if (V.levSig === sig && V.levGrp) return; V.levSig = sig;
    if (V.levGrp) V.scene.remove(V.levGrp); V.levGrp = null;
    const marks = dikes.filter(([c, r]) => (seg[c + ',' + r] || 0) > 0);
    if (!marks.length) { V.dirty = true; return; }
    V.levGrp = new T.Group();
    for (const [c, r] of marks) {
      const p = Math.min(seg[c + ',' + r], v.digNeed || 6), [x, z] = wpos(c, r), y = topAt(g, c, r);
      const burst = v.flooded && v.floodAt && v.floodAt[0] === c && v.floodAt[1] === r;
      const w = 0.25 + p * 0.07 + (burst ? 0.5 : 0);
      const gap = mesh(new T.BoxGeometry(1.05, 0.28 + (burst ? 0.12 : 0), w), mat(0x3a2c1a), false); gap.position.set(x, y + 0.2, z); gap.raycast = () => {}; V.levGrp.add(gap);
      for (let k = 0; k < Math.min(p, 4); k++) { const d = mesh(new T.DodecahedronGeometry(0.07, 0), mat(0x9a825a), false); d.position.set(x - 0.55 + (k % 2) * 0.1, y + 0.1, z + (k - 1.5) * 0.12); d.raycast = () => {}; V.levGrp.add(d); }
      if (burst && !v.receded) { const jet = new T.Mesh(new T.BoxGeometry(2.8, 0.12, w * 0.9), new T.MeshBasicMaterial({ color: 0x6fb6d8, transparent: true, opacity: 0.6, depthWrite: false })); jet.position.set(x + 1.4, y + 0.02, z); jet.rotation.z = -0.07; jet.raycast = () => {}; V.levGrp.add(jet); }
    }
    V.scene.add(V.levGrp); V.dirty = true;
  }
  function ladderMarks(g) {
    if (V.lads) V.scene.remove(V.lads);
    V.lads = new T.Group();
    for (const k in g.ladders) {
      const [c, r] = HX.unkey(k); const u = g.units[g.ladders[k]]; if (!u || !u.alive) continue;
      const [x1, z1] = wpos(u.c, u.r), [x2, z2] = wpos(c, r);
      const len = Math.hypot(x2 - x1, z2 - z1, 1.4);
      const o = mesh(new T.BoxGeometry(0.06, 0.06, len), mat(0xd9b26a)); o.position.set((x1 + x2) / 2, 0.9, (z1 + z2) / 2); o.lookAt(x2, 1.6, z2); V.lads.add(o);
    }
    V.scene.add(V.lads); V.dirty = true;
  }

  // ---------- 相機 ----------
  function focus(c, r, smooth = true) {
    const [x, z] = wpos(c, r);
    if (!smooth) { V.camTo = null; V.cam3.tx = x; V.cam3.tz = z; V.dirty = true; return; }
    V.camTo = { x, z, t: 0, fx: V.cam3.tx, fz: V.cam3.tz };
  }
  function bindPointer() {
    const el = V.cv; const pts = new Map(); let downAt = null, moved = 0, last = null, pinch = null;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { downAt = [e.clientX, e.clientY]; moved = 0; last = [e.clientX, e.clientY]; V.btn = e.button; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; moved = 99; }
    });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1 && last) {
        const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY]; moved += Math.abs(dx) + Math.abs(dy);
        if (moved < 6) return;
        if (V.btn === 2 || e.shiftKey) { V.cam3.yaw -= dx * 0.4; V.cam3.pitch = clampN(V.cam3.pitch + dy * 0.3, 25, 85); }
        else pan(dx, dy);
        V.camTo = null; V.dirty = true;
      } else if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        V.cam3.dist = clampN(V.cam3.dist * pinch.d / d, 7, 55);
        V.cam3.yaw += (ang - pinch.ang) * 180 / Math.PI;
        V.cam3.pitch = clampN(V.cam3.pitch + (mid[1] - pinch.mid[1]) * 0.25, 25, 85);
        pinch = { d, ang, mid }; V.camTo = null; V.dirty = true;
      }
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
      if (pts.size === 0) { if (moved < 6 && downAt && V.onTap) tap(e.clientX, e.clientY); pinch = null; last = null; }
      if (pts.size === 1) { last = [...pts.values()][0]; }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); V.cam3.dist = clampN(V.cam3.dist * (1 + Math.sign(e.deltaY) * 0.1), 7, 55); V.dirty = true; }, { passive: false });
  }
  function pan(dx, dy) {
    const s = V.cam3.dist / V.h * 1.1; const y = V.cam3.yaw * Math.PI / 180;
    const rx = Math.cos(y), rz = -Math.sin(y); const fx = -Math.sin(y), fz = -Math.cos(y);
    V.cam3.tx -= (dx * rx - dy * fx) * s; V.cam3.tz -= (dx * rz - dy * fz) * s;
    const lim = V.ox + 2, limz = V.oz + 2;
    V.cam3.tx = clampN(V.cam3.tx, -lim, lim); V.cam3.tz = clampN(V.cam3.tz, -limz, limz);
  }
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  function tap(cx, cy) {
    const rect = V.cv.getBoundingClientRect();
    V.v2.set((cx - rect.left) / rect.width * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    V.ray.setFromCamera(V.v2, V.cam);
    // 先看有沒有點到部隊（取部隊所在格）
    const objs = []; V.units.forEach((rec, id) => objs.push(rec.grp));
    const hu = V.ray.intersectObjects(objs, true);
    if (hu.length) {
      for (const [id, rec] of V.units) { let o = hu[0].object; while (o) { if (o === rec.grp) { const u = V.g.units[id]; V.onTap(u.c, u.r); return; } o = o.parent; } }
    }
    const hit = V.ray.intersectObjects([V.ground, ...(V.wallPick || [])], false)[0];
    if (hit && hit.object.userData.hex) { const [c, r] = hit.object.userData.hex; V.onTap(c, r); }
    else if (hit) { const [c, r] = hexAtWorld(hit.point.x, hit.point.z); if (r >= 0 && r < V.g.Hh && c >= 0 && c < V.g.W) V.onTap(c, r); }
  }
  function rotate(deg) { V.cam3.yaw += deg; V.dirty = true; }
  function zoom(f) { V.cam3.dist = clampN(V.cam3.dist * f, 7, 55); V.dirty = true; }

  // ---------- 動畫 ----------
  function tween(ms, fn) { return new Promise(res => { V.anims.push({ t0: performance.now(), ms, fn, res }); V.dirty = true; }); }
  const sleep = ms => tween(ms, () => {});
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function screenOf(x, y, z) { const v = V.tmpV.set(x, y, z).project(V.cam); return [(v.x + 1) / 2 * V.w, (1 - v.y) / 2 * V.h, v.z < 1]; }
  function floater(c, r, text, cls) {
    const el = document.createElement('div'); el.className = 'floater ' + (cls || ''); el.textContent = text; V.layer.appendChild(el);
    const [x, z] = wpos(c, r); const y = topAt(V.g, c, r) + 1.2;
    V.floaters.push({ el, x, y, z, t0: performance.now(), ms: 1400 });
  }
  function projectile(from, to, kind) {
    const [x1, z1] = wpos(from[0], from[1]), [x2, z2] = wpos(to[0], to[1]);
    const y1 = topAt(V.g, from[0], from[1]) + 0.5, y2 = topAt(V.g, to[0], to[1]) + 0.3;
    const n = kind === 'rock' ? 1 : 6; const objs = [];
    for (let i = 0; i < n; i++) {
      const o = kind === 'rock' ? mesh(new T.SphereGeometry(0.16, 6, 4), mat(0x777777)) : new T.Mesh(new T.BoxGeometry(0.28, 0.02, 0.02), new T.MeshBasicMaterial({ color: 0x3a2a1a }));
      V.scene.add(o); objs.push({ o, dx: (Math.random() - 0.5) * 0.5, dz: (Math.random() - 0.5) * 0.5, delay: i * 0.06 });
    }
    const dist = Math.hypot(x2 - x1, z2 - z1), arc = kind === 'rock' ? dist * 0.35 : dist * 0.18;
    return tween(kind === 'rock' ? 750 : 520, t => {
      for (const p of objs) {
        const tt = clampN((t - p.delay) / (1 - p.delay * 0.8), 0, 1);
        const x = x1 + (x2 + p.dx - x1) * tt, z = z1 + (z2 + p.dz - z1) * tt, y = y1 + (y2 - y1) * tt + Math.sin(tt * Math.PI) * arc;
        const px = p.o.position.clone(); p.o.position.set(x, y, z); if (tt > 0 && tt < 1 && kind !== 'rock') p.o.lookAt(px); p.o.visible = tt > 0 && tt < 1;
        if (kind !== 'rock') p.o.rotateY(Math.PI / 2);
      }
      if (t >= 1) objs.forEach(p => V.scene.remove(p.o));
    });
  }
  function fire(c, r, ms = 1100) {
    const [x, z] = wpos(c, r); const y = topAt(V.g, c, r); const grp = new T.Group(); grp.position.set(x, y, z);
    const fl = []; for (let i = 0; i < 7; i++) { const o = new T.Mesh(new T.ConeGeometry(0.16, 0.5, 5), new T.MeshBasicMaterial({ color: i % 2 ? 0xff8a1a : 0xffd04a, transparent: true, opacity: 0.9 })); o.position.set((Math.random() - 0.5) * 1.1, 0.25, (Math.random() - 0.5) * 1.1); grp.add(o); fl.push(o); }
    V.scene.add(grp);
    return tween(ms, t => { fl.forEach((o, i) => { o.scale.y = 0.6 + Math.abs(Math.sin(t * 20 + i)) * 0.9; o.material.opacity = 0.9 * (1 - t); }); if (t >= 1) V.scene.remove(grp); });
  }
  function dust(c, r) {
    const [x, z] = wpos(c, r); const y = topAt(V.g, c, r); const ps = [];
    for (let i = 0; i < 8; i++) { const o = new T.Mesh(new T.SphereGeometry(0.12, 5, 3), new T.MeshBasicMaterial({ color: 0xc8b48c, transparent: true, opacity: 0.7 })); o.position.set(x, y + 0.2, z); V.scene.add(o); ps.push([o, Math.random() * 6.28]); }
    return tween(600, t => { ps.forEach(([o, a]) => { o.position.x = x + Math.cos(a) * t * 0.9; o.position.z = z + Math.sin(a) * t * 0.9; o.position.y = y + 0.2 + t * 0.4; o.material.opacity = 0.7 * (1 - t); }); if (t >= 1) ps.forEach(([o]) => V.scene.remove(o)); });
  }

  // 播放一筆規則層的特效（回傳 Promise）
  async function playFx(f, g, speed = 1) {
    const R = root.RULES; const ms = x => x / speed;
    if (f.t === 'move') {
      const rec = V.units.get(f.id); const u = g.units[f.id]; if (!rec || f.path.length < 2) { syncUnits(g); return; }
      rec.moving = true; setPose(u, rec, 'run');
      for (let i = 1; i < f.path.length; i++) {
        const [c0, r0] = f.path[i - 1], [c1, r1] = f.path[i];
        const [x0, z0] = wpos(c0, r0), [x1, z1] = wpos(c1, r1); const y0 = topAt(g, c0, r0), y1 = topAt(g, c1, r1);
        rec.targetYaw = HX.angleOf(HX.dirTo(c0, r0, c1, r1)) * Math.PI / 180;
        await tween(ms(f.rout ? 150 : 210), t => { rec.grp.position.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 0.08, z0 + (z1 - z0) * t); });
      }
      rec.moving = false; setPose(u, rec, 'idle'); placeUnit(u, g, false);
    } else if (f.t === 'warp' || f.t === 'face' || f.t === 'form') { syncUnits(g); await sleep(ms(f.t === 'form' ? 350 : 60)); }
    else if (f.t === 'attack' || f.t === 'rocks' || f.t === 'oil') {
      const A = g.units[f.a], D = g.units[f.d]; const ra = V.units.get(f.a), rd = V.units.get(f.d);
      if (ra) { ra.targetYaw = HX.angleOf(HX.dirTo(A.c, A.r, D.c, D.r)) * Math.PI / 180; }
      if (f.t === 'attack' && f.ranged) {
        if (ra && A.type === 'cata') { const arm = ra.inner.userData.arm; if (arm) tween(ms(300), t => { arm.rotation.z = 0.5 - Math.sin(t * Math.PI) * 1.4; }); }
        await projectile([A.c, A.r], [D.c, D.r], A.type === 'cata' ? 'rock' : 'arrow');
      } else if (f.t === 'rocks') { await projectile([A.c, A.r], [D.c, D.r], 'rock'); }
      else if (f.t === 'oil') { await fire(D.c, D.r, ms(700)); }
      else if (ra) {
        const [hx, hy, hz] = ra.home; const [tx, tz] = wpos(D.c, D.r);
        if (f.charge) setPose(A, ra, 'run');
        await tween(ms(f.charge ? 300 : 220), t => { const k = Math.sin(t * Math.PI) * (f.charge ? 0.55 : 0.38); ra.grp.position.set(hx + (tx - hx) * k, hy, hz + (tz - hz) * k); });
        ra.grp.position.set(hx, hy, hz); if (f.charge) setPose(A, ra, 'idle');
      }
      if (rd) dust(D.c, D.r);
      floater(D.c, D.r, '−' + f.dmg + (f.side >= 2 ? (f.side === 3 ? ' 背襲!' : ' 側擊!') : f.charge ? ' 衝鋒!' : ''), f.side >= 2 || f.charge ? 'big' : '');
      if (f.counter && A) floater(A.c, A.r, '−' + f.counter + ' 反擊', 'small');
      syncUnits(g); await sleep(ms(380));
    } else if (f.t === 'struct') {
      const A = f.a != null ? g.units[f.a] : null;
      if (A && A.type === 'cata') { const ra = V.units.get(A.id); if (ra && ra.inner.userData.arm) tween(ms(300), t => { ra.inner.userData.arm.rotation.z = 0.5 - Math.sin(t * Math.PI) * 1.4; }); await projectile([A.c, A.r], [f.c, f.r], 'rock'); }
      else if (A) { const ra = V.units.get(A.id); if (ra) { const [hx, hy, hz] = ra.home; const [tx, tz] = wpos(f.c, f.r); await tween(ms(260), t => { const k = Math.sin(t * Math.PI) * 0.45; ra.grp.position.set(hx + (tx - hx) * k, hy, hz + (tz - hz) * k); }); } }
      if (f.dmg) floater(f.c, f.r, '耐久 −' + f.dmg, 'struct');
      if (f.broke) { dust(f.c, f.r); refreshHex(g, f.c, f.r); syncUnits(g); await sleep(ms(400)); }
      else await sleep(ms(200));
    } else if (f.t === 'tower') {
      await projectile([f.c, f.r], [g.units[f.d].c, g.units[f.d].r], 'arrow'); floater(g.units[f.d].c, g.units[f.d].r, '−' + f.dmg + ' 箭樓', 'small'); syncUnits(g);
    } else if (f.t === 'fire') { const D = g.units[f.d]; await fire(D.c, D.r, ms(1100)); floater(D.c, D.r, '−' + f.dmg + ' 火計', 'big'); syncUnits(g); }
    else if (f.t === 'skill') { const u = g.units[f.id]; floater(u.c, u.r, '【' + f.name + '】', 'skill'); await sleep(ms(500)); syncUnits(g); }
    else if (f.t === 'duel') { const u = g.units[f.a]; floater(u.c, u.r, f.result === 'refuse' ? '避戰' : f.result === 'draw' ? '不分勝負' : f.result === 'win' ? '單挑勝！' : '單挑敗…', 'skill'); await sleep(ms(700)); syncUnits(g); }
    else if (f.t === 'ladder') { ladderMarks(g); await sleep(ms(300)); }
    else if (f.t === 'dig') { const u = g.units[f.id]; dust(u.c, u.r); floater(u.c, u.r, '掘堤', 'skill'); await sleep(ms(400)); }
    else if (f.t === 'flood') {
      // 大水漫過低地：水面先漲高再退回
      const hexes = f.hexes;
      await tween(ms(1600), t => { V.waterBoost = Math.sin(Math.min(1, t * 1.4) * Math.PI / 2) * (f.stage > 1 ? 0.18 : 0.3) * (1 - Math.max(0, t - 0.7) / 0.3); });
      V.waterBoost = 0;
      hexes.forEach(([c, r]) => refreshHex(g, c, r)); syncUnits(g);
    } else if (f.t === 'recede') { f.hexes.forEach(([c, r]) => refreshHex(g, c, r)); await sleep(ms(500)); syncUnits(g);
    } else if (f.t === 'burn') { if (f.start) { floater(f.c, f.r, '糧營起火！', 'big'); await fire(f.c, f.r, ms(700)); } else { await fire(f.c, f.r, ms(1300)); refreshHex(g, f.c, f.r); } }
    else if (f.t === 'douse') { const A = g.units[f.a]; if (A) floater(A.c, A.r, '滅火', 'skill'); dust(f.c, f.r); floater(f.c, f.r, '火勢已止', 'small'); await sleep(ms(600)); }
    else if (f.t === 'rain') { await sleep(ms(400)); }
    else if (f.t === 'defect') { syncUnits(g); for (const id of f.ids) { const u = g.units[id]; floater(u.c, u.r, '倒戈！', 'big'); } await sleep(ms(900)); }
    else if (f.t === 'flame') {
      const A = g.units[f.a], ra = V.units.get(f.a);
      if (ra) ra.targetYaw = HX.angleOf(HX.dirTo(A.c, A.r, f.c, f.r)) * Math.PI / 180;
      if (f.ranged) await projectile([A.c, A.r], [f.c, f.r], 'arrow');
      if (f.n < 2) await fire(f.c, f.r, ms(500));   // 燃起來之後的大火由 burn 特效接著播
      if (f.n < 2) floater(f.c, f.r, '火勢 1/2', 'small'); syncUnits(g);
    }
    else if (f.t === 'merge') {
      // 併入的部隊縮小消失；統帥的部隊換成合流後的兵種、移到新位置
      const gone = V.units.get(f.gone); if (gone) { V.units.delete(f.gone); await tween(ms(400), t => gone.grp.scale.setScalar(1 - t * 0.95)); V.scene.remove(gone.grp); }
      const rec = V.units.get(f.id); const u = g.units[f.id];
      if (rec && rec.type !== u.type) { V.scene.remove(rec.grp); V.units.delete(f.id); }
      syncUnits(g); floater(u.c, u.r, '兩軍合流！', 'big'); await sleep(ms(500));
    }
    else if (f.t === 'dead') {
      const rec = V.units.get(f.id); if (rec) { rec.dying = true; await tween(ms(500), t => { rec.grp.scale.setScalar(1 - t * 0.9); rec.grp.position.y = rec.home[1] - t * 0.3; }); V.scene.remove(rec.grp); V.units.delete(f.id); }
    }
    if (f.t !== 'ladder' && (f.t === 'dead' || f.t === 'move')) ladderMarks(g);
  }

  // ---------- 主迴圈 ----------
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - V.clock) / 1000); V.clock = now;
    let busy = false;
    if (V.camTo) {
      const c = V.camTo; c.t = Math.min(1, c.t + dt * 2.5); const k = ease(c.t);
      V.cam3.tx = c.fx + (c.x - c.fx) * k; V.cam3.tz = c.fz + (c.z - c.fz) * k; busy = true; if (c.t >= 1) V.camTo = null;
    }
    if (V.fireGrp) { busy = true; for (const o of V.fireCones) o.scale.y = 0.7 + Math.abs(Math.sin(now / 130 + o.userData.ph)) * 0.9; }
    if (V.anims.length) {
      busy = true;
      V.anims = V.anims.filter(a => { const t = Math.min(1, (now - a.t0) / a.ms); a.fn(t); if (t >= 1) { a.res(); return false; } return true; });
    }
    V.units.forEach(rec => {
      if (drawFigures(rec, dt)) busy = true;
      if (rec.targetYaw != null) {
        let d = rec.targetYaw - rec.inner.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) > 0.002) { rec.inner.rotation.y += d * Math.min(1, dt * 8); busy = true; }
        rec.flag.rotation.y = Math.sin(now / 400 + rec.home[0]) * 0.25;
      }
    });
    if (V.floaters.length) {
      busy = true;
      V.floaters = V.floaters.filter(f => {
        const t = (now - f.t0) / f.ms; if (t >= 1) { f.el.remove(); return false; }
        const [sx, sy, vis] = screenOf(f.x, f.y + t * 0.9, f.z); f.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`; f.el.style.opacity = vis ? String(1 - Math.max(0, t - 0.6) / 0.4) : '0';
        return true;
      });
    }
    if (V.water) { V.waterBase = (V.waterBase || 0) + ((V.waterTarget || 0) - (V.waterBase || 0)) * Math.min(1, dt * 1.5); V.water.position.y = -0.02 + Math.sin(now / 900) * 0.015 + (V.waterBoost || 0) + V.waterBase; if (Math.abs((V.waterTarget || 0) - V.waterBase) > 0.002) busy = true; }
    if (!busy && !V.dirty && (now - (V.lastDraw || 0)) < 250) return;
    V.dirty = false; V.lastDraw = now;
    if (!V.g) return;
    updateCamera();
    V.r.render(V.scene, V.cam);
  }

  Object.assign(V, { init, build, syncUnits, playFx, highlight, clearHighlights, showSides, selectRing, focus, rotate, zoom, refreshHex, ladderMarks, digMarks, depotMarks, leveeMarks, applyHidden, fireMarks, wpos });
})(window);
