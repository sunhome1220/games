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

  const COLORS = {
    '.': 0x8fb36a, ',': 0xc9b27c, 'f': 0x5f8f4a, 'h': 0x9c9a6a, '~': 0x3f7fb5, '=': 0x3f7fb5, 'd': 0x8a7350, 'l': 0xa1b57a,
    'w': 0x4a86bd, 'W': 0x9b9188, 'T': 0x8f857c, 'G': 0x8f857c, 'o': 0x7a6a58, 'r': 0x8d8478, 'c': 0xb9a98e, 'P': 0xc6b697, 'S': 0xb9a26f,
  };
  const TOP = { '.': 0.2, ',': 0.2, 'f': 0.22, 'h': 0.75, '~': -0.15, '=': -0.12, 'd': 0.45, 'l': 0.12, 'w': -0.08, 'W': 1.5, 'T': 1.5, 'G': 1.5, 'o': 0.22, 'r': 0.4, 'c': 0.3, 'P': 0.3, 'S': 0.2 };
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
    V.scene.background = new T.Color(0xcfd8dc);
    V.scene.fog = new T.Fog(0xcfd8dc, 45, 110);
    V.cam = new T.PerspectiveCamera(40, 1, 0.5, 300);
    V.scene.add(new T.HemisphereLight(0xfff6e8, 0x5a4a32, 1.6));
    const sun = new T.DirectionalLight(0xffffff, 1.9); sun.position.set(-18, 34, 14); sun.castShadow = true;
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
  function wpos(c, r) { const [x, y] = HX.center(c, r); return [x - V.ox, y - V.oz]; }
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
    const [mx, mz] = HX.center(g.W - 1, g.Hh - 1); V.ox = (mx + HX.S3 * 0.5) / 2; V.oz = mz / 2;
    V.cam3.tx = 0; V.cam3.tz = 0;
    // 底座
    const base = mesh(new T.BoxGeometry(mx + 4, 1.2, mz + 4), mat(0x5b4630), false, true); base.position.y = -0.85; V.world.add(base);
    // 六角柱
    const n = g.W * g.Hh;
    const geo = new T.CylinderGeometry(0.985, 0.985, 1, 6); geo.translate(0, -0.5, 0);
    V.tiles = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), n);
    V.tiles.receiveShadow = true; V.tiles.castShadow = false;
    V.tileIdx = [];
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) { V.tileIdx.push([c, r]); }
    V.world.add(V.tiles);
    for (let i = 0; i < n; i++) setTile(g, ...V.tileIdx[i], i, false);
    V.tiles.instanceMatrix.needsUpdate = true; if (V.tiles.instanceColor) V.tiles.instanceColor.needsUpdate = true;
    // 河面（半透明水層）
    const water = new T.Mesh(new T.PlaneGeometry(mx + 4, mz + 4), new T.MeshStandardMaterial({ color: 0x5b9fd6, transparent: true, opacity: 0.45, roughness: 0.2, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.02; V.world.add(water); V.water = water;
    buildDeco(g);
    V.dirty = true;
  }
  function tileColor(g, c, r) {
    const ch = g.map[r][c];
    const col = new T.Color(COLORS[ch] || 0x888888);
    // 每格微調明暗，看起來比較自然
    const h = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453; const j = (h - Math.floor(h) - 0.5) * 0.08;
    col.offsetHSL(0, 0, j);
    return col;
  }
  function setTile(g, c, r, i, flag = true) {
    if (i == null) i = r * g.W + c;
    const ch = g.map[r][c]; const top = TOP[ch] != null ? TOP[ch] : 0.2;
    const [x, z] = wpos(c, r);
    const m = new T.Matrix4().compose(new T.Vector3(x, top, z), new T.Quaternion(), new T.Vector3(1, top + 1, 1));
    V.tiles.setMatrixAt(i, m); V.tiles.setColorAt(i, tileColor(g, c, r));
    if (flag) { V.tiles.instanceMatrix.needsUpdate = true; V.tiles.instanceColor.needsUpdate = true; V.dirty = true; }
  }

  // 裝飾物：依格子建立，記在 V.deco[key]，地形改變（淹水、城牆倒塌）時重建那一格
  function buildDeco(g) {
    V.deco = {};
    V.geos = V.geos || {
      cone: new T.ConeGeometry(0.28, 0.7, 6), trunk: new T.CylinderGeometry(0.05, 0.06, 0.2, 5),
      merlon: new T.BoxGeometry(0.22, 0.22, 0.22), rock: new T.DodecahedronGeometry(0.22, 0),
      house: new T.BoxGeometry(0.42, 0.28, 0.32), roof4: new T.ConeGeometry(0.36, 0.22, 4),
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
      for (let i = 0; i < 4; i++) {
        const a = rnd() * Math.PI * 2, d = 0.25 + rnd() * 0.45, s = 0.8 + rnd() * 0.5;
        const t = mesh(G.cone, mat(i % 2 ? 0x3f6e35 : 0x4b7d3c)); t.position.set(Math.cos(a) * d, 0.45 * s + 0.15, Math.sin(a) * d); t.scale.setScalar(s);
        const tr = mesh(G.trunk, mat(0x6b4a2b)); tr.position.set(t.position.x, 0.1, t.position.z);
        grp.add(t, tr);
      }
    } else if (ch === 'h') {
      for (let i = 0; i < 3; i++) { const o = mesh(G.rock, mat(0x8c8a62)); o.position.set((rnd() - 0.5) * 1, 0.05, (rnd() - 0.5) * 1); o.scale.set(1 + rnd(), 0.6 + rnd() * 0.5, 1 + rnd()); grp.add(o); }
    } else if (ch === 'W' || ch === 'T' || ch === 'G') {
      // 垛口
      for (let i = 0; i < 6; i++) { const a = (i * 60 + 30) * Math.PI / 180; const o = mesh(G.merlon, mat(0x8a8178)); o.position.set(Math.sin(a) * 0.78, 0.11, Math.cos(a) * 0.78); grp.add(o); }
      if (ch === 'T') {
        const body = mesh(new T.BoxGeometry(0.9, 0.7, 0.9), mat(0xa0583c)); body.position.y = 0.35; grp.add(body);
        const roof = mesh(new T.ConeGeometry(0.85, 0.5, 4), mat(0x4a3b33)); roof.position.y = 0.95; roof.rotation.y = Math.PI / 4; grp.add(roof);
      }
      if (ch === 'G') {
        const body = mesh(new T.BoxGeometry(1.1, 0.55, 0.7), mat(0xa0583c)); body.position.y = 0.28; grp.add(body);
        const roof = mesh(new T.ConeGeometry(0.95, 0.45, 4), mat(0x4a3b33)); roof.position.y = 0.8; roof.rotation.y = Math.PI / 4; roof.scale.set(1.2, 1, 0.8); grp.add(roof);
        const door = mesh(new T.BoxGeometry(0.06, 1.0, 0.7), mat(0x5a3418)); door.position.set(-0.99, -0.55, 0); grp.add(door);
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
    } else if (ch === '=') {
      const p = mesh(G.plank, mat(0x8a6236)); p.position.y = 0.3; grp.add(p);
      for (const s of [-1, 1]) { const rl = mesh(G.rail, mat(0x6b4a2b)); rl.position.set(0, 0.42, s * 0.48); grp.add(rl); }
      grp.position.y = 0;
    } else if (ch === 'd') {
      const o = mesh(new T.BoxGeometry(1.5, 0.18, 0.5), mat(0x7a6446)); o.position.y = 0.09; o.rotation.y = 1.05; grp.add(o);
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
  function refreshHex(g, c, r) { setTile(g, c, r); decoAt(g, c, r); }

  // ---------- 部隊模型 ----------
  function sideColor(side) { return side === 'att' ? 0x3b6fc4 : 0xc8463a; }
  function flagTexture(text, color) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const x = cv.getContext('2d');
    x.fillStyle = '#' + color.toString(16).padStart(6, '0'); x.fillRect(0, 0, 64, 64);
    x.strokeStyle = '#f5e6c0'; x.lineWidth = 4; x.strokeRect(3, 3, 58, 58);
    x.fillStyle = '#fff'; x.font = 'bold 40px "Noto Serif TC","Microsoft JhengHei",serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 32, 35);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function labelTexture(u, g) {
    const cv = u._lcv || (u._lcv = document.createElement('canvas')); cv.width = 256; cv.height = 72; const x = cv.getContext('2d');
    x.clearRect(0, 0, 256, 72);
    x.fillStyle = 'rgba(30,22,14,0.78)'; roundRect(x, 4, 4, 248, 64, 10); x.fill();
    x.fillStyle = u.side === 'att' ? '#8fb4ff' : '#ff9a8a'; x.font = 'bold 30px "Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif'; x.textBaseline = 'top';
    x.fillText(u.name, 14, 8);
    x.fillStyle = '#f5e9d3'; x.font = 'bold 24px "Microsoft JhengHei","PingFang TC",sans-serif'; x.textAlign = 'right'; x.fillText(u.troops, 242, 10); x.textAlign = 'left';
    // 兵力條與完整度條
    const R = root.RULES;
    x.fillStyle = '#333'; x.fillRect(14, 42, 228, 8); x.fillStyle = u.side === 'att' ? '#5d8de0' : '#e0604f'; x.fillRect(14, 42, 228 * u.troops / u.max, 8);
    if (!R.isEngine(u)) { x.fillStyle = '#333'; x.fillRect(14, 54, 228, 6); x.fillStyle = u.coh >= 70 ? '#7cc46a' : u.coh >= 40 ? '#e0b84a' : '#e05a3a'; x.fillRect(14, 54, 228 * u.coh / 100, 6); }
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
    else if (form === 'fangyuan') { const ring = Math.min(n, n > 6 ? n - 2 : n); for (let i = 0; i < ring; i++) { const a = i / ring * Math.PI * 2; P.push([Math.cos(a) * 0.48, Math.sin(a) * 0.48]); } for (let i = ring; i < n; i++) P.push([(i - ring - 0.5) * 0.15, 0]); }
    else { for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.7; P.push([Math.cos(a) * d, Math.sin(a) * d]); } }
    return P.map(([a, b]) => [a * 1.15, b * 1.2]);
  }
  function figureCount(u) { const base = u.type === 'cav' ? 9 : 12; return Math.max(2, Math.ceil(base * u.troops / u.max)); }

  function makeUnit(u, g) {
    const G = unitGeos(); const R = root.RULES; const col = sideColor(u.side);
    const grp = new T.Group(); const inner = new T.Group(); grp.add(inner);
    const rec = { grp, inner, figs: [], side: u.side, form: null, n: 0 };
    if (R.isEngine(u)) buildEngine(u, inner, col);
    else {
      const N = 16;
      const cav = u.type === 'cav';
      const mBody = new T.InstancedMesh(cav ? G.bodyC : G.body, mat(col), N), mHead = new T.InstancedMesh(cav ? G.headC : G.head, mat(0xe8c8a0), N);
      const extra = u.type === 'cav' ? new T.InstancedMesh(G.horse, mat(0x6b4a2b), N) : u.type === 'arc' ? new T.InstancedMesh(G.bow, mat(0x5a3a1a), N) : new T.InstancedMesh(G.spear, mat(0x9a9a9a), N);
      for (const m of [mBody, mHead, extra]) { m.castShadow = true; m.count = 0; inner.add(m); }
      rec.ims = [mBody, mHead, extra]; rec.cur = []; rec.target = [];
    }
    // 軍旗（將旗）
    const flagM = new T.MeshStandardMaterial({ map: flagTexture(R.isEngine(u) ? R.ty(u).icon : R.gen(u).mark, col), side: T.DoubleSide, roughness: 0.9 });
    const pole = mesh(G.pole, mat(0x4a3420)); pole.position.set(-0.35, 0, 0.35); const flag = mesh(G.flag, flagM); flag.position.copy(pole.position);
    grp.add(pole, flag); rec.flag = flag; rec.flagM = flagM;
    // 朝向箭頭
    const arrow = new T.Mesh(G.arrowHead, new T.MeshBasicMaterial({ color: col })); arrow.position.set(0.82, 0.03, 0); arrow.scale.set(1, 0.15, 1); inner.add(arrow); rec.arrow = arrow;
    // 名牌
    const lcv = labelTexture(u, g); const ltex = new T.CanvasTexture(lcv); ltex.colorSpace = T.SRGBColorSpace;
    const label = new T.Sprite(new T.SpriteMaterial({ map: ltex, depthTest: false, transparent: true })); label.scale.set(1.9, 0.53, 1); label.position.y = 1.55; label.renderOrder = 10;
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
    const [x, z] = wpos(u.c, u.r); const y = topAt(g, u.c, u.r);
    rec.home = [x, y, z];
    if (instant || !rec.moving) rec.grp.position.set(x, y, z);
    rec.targetYaw = HX.angleOf(u.face) * Math.PI / 180;
    if (instant) rec.inner.rotation.y = rec.targetYaw;
    updateFigures(u, rec, instant);
  }
  function updateFigures(u, rec, instant) {
    const R = root.RULES;
    if (!rec.ims) return;
    const st = R.state(u); const form = st === 'disorder' ? 'chaos' : u.form;
    const n = figureCount(u);
    if (form !== rec.form || n !== rec.n) {
      rec.form = form; rec.n = n;
      rec.target = layout(form, n, u.id * 97 + (u.routed || 0));
      rec.yawJit = rec.target.map((_, i) => (form === 'chaos' ? (seeded(u.id * 13 + i)() - 0.5) * 3 : 0));
      while (rec.cur.length < n) rec.cur.push(rec.target[rec.cur.length] ? [...rec.target[rec.cur.length]] : [0, 0]);
      rec.cur.length = n;
      if (instant) rec.cur = rec.target.map(p => [...p]);
      rec.ims.forEach(m => (m.count = n));
    }
  }
  const _m4 = () => new T.Matrix4(); let M4, Q, S1, P3;
  function drawFigures(rec, dt) {
    if (!rec.ims) return false;
    M4 = M4 || _m4(); Q = Q || new T.Quaternion(); S1 = S1 || new T.Vector3(1, 1, 1); P3 = P3 || new T.Vector3();
    let moving = false; const k = Math.min(1, dt * 4);
    for (let i = 0; i < rec.n; i++) {
      const c = rec.cur[i], t = rec.target[i]; if (!t) continue;
      const dx = t[0] - c[0], dz = t[1] - c[1];
      if (Math.abs(dx) + Math.abs(dz) > 0.002) { c[0] += dx * k; c[1] += dz * k; moving = true; }
      Q.setFromAxisAngle(new T.Vector3(0, 1, 0), rec.yawJit[i] || 0);
      M4.compose(P3.set(c[0], 0, -c[1]), Q, S1);
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
      if (!rec) rec = makeUnit(u, g);
      if (rec.side !== u.side) { recolor(u, rec); }
      placeUnit(u, g, false);
      refreshLabel(u, g);
    }
    V.dirty = true;
  }
  function recolor(u, rec) {
    const col = sideColor(u.side); rec.side = u.side;
    if (rec.ims) rec.ims[0].material = mat(col);
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
  // 格子外框（可移動格用，讓範圍邊界在各種地形上都清楚）
  let edgeGeo = null;
  function hexEdge(color) {
    edgeGeo = edgeGeo || new T.RingGeometry(0.8, 0.97, 6, 1, Math.PI / 6);
    const m = new T.Mesh(edgeGeo, new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 3; return m;
  }
  function highlight(list) {
    clearHighlights();
    for (const h of list) {
      const o = hexOverlay(h.color, h.opacity || 0.45); const [x, z] = wpos(h.c, h.r);
      o.position.set(x, topAt(V.g, h.c, h.r) + 0.04, z); if (h.scale) o.scale.setScalar(h.scale);
      V.scene.add(o); V.hl.push(o);
      if (h.edge) { const e = hexEdge(h.edge); e.position.set(x, topAt(V.g, h.c, h.r) + 0.05, z); V.scene.add(e); V.hl.push(e); }
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
    if (!smooth) { V.cam3.tx = x; V.cam3.tz = z; V.dirty = true; return; }
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
    const hit = V.ray.intersectObject(V.tiles, false)[0];
    if (hit && hit.instanceId != null) { const [c, r] = V.tileIdx[hit.instanceId]; V.onTap(c, r); }
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
      rec.moving = true;
      for (let i = 1; i < f.path.length; i++) {
        const [c0, r0] = f.path[i - 1], [c1, r1] = f.path[i];
        const [x0, z0] = wpos(c0, r0), [x1, z1] = wpos(c1, r1); const y0 = topAt(g, c0, r0), y1 = topAt(g, c1, r1);
        rec.targetYaw = HX.angleOf(HX.dirTo(c0, r0, c1, r1)) * Math.PI / 180;
        await tween(ms(f.rout ? 150 : 210), t => { rec.grp.position.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 0.08, z0 + (z1 - z0) * t); });
      }
      rec.moving = false; placeUnit(u, g, false);
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
        await tween(ms(f.charge ? 300 : 220), t => { const k = Math.sin(t * Math.PI) * (f.charge ? 0.55 : 0.38); ra.grp.position.set(hx + (tx - hx) * k, hy, hz + (tz - hz) * k); });
        ra.grp.position.set(hx, hy, hz);
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
      const hexes = f.hexes; const from = hexes.map(([c, r]) => TOP.l), to = TOP.w;
      await tween(ms(1600), t => {
        hexes.forEach(([c, r], i) => {
          const top = from[i] + (to - from[i]) * t; const [x, z] = wpos(c, r);
          const idx = r * g.W + c; const m = new T.Matrix4().compose(new T.Vector3(x, top, z), new T.Quaternion(), new T.Vector3(1, top + 1, 1));
          V.tiles.setMatrixAt(idx, m); V.tiles.setColorAt(idx, new T.Color(COLORS.l).lerp(new T.Color(COLORS.w), t));
        });
        V.tiles.instanceMatrix.needsUpdate = true; V.tiles.instanceColor.needsUpdate = true;
      });
      hexes.forEach(([c, r]) => refreshHex(g, c, r)); syncUnits(g);
    } else if (f.t === 'burn') { await fire(f.c, f.r, ms(1300)); refreshHex(g, f.c, f.r); }
    else if (f.t === 'defect') { syncUnits(g); for (const id of f.ids) { const u = g.units[id]; floater(u.c, u.r, '倒戈！', 'big'); } await sleep(ms(900)); }
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
    if (V.water) { V.water.position.y = -0.02 + Math.sin(now / 900) * 0.015; }
    if (!busy && !V.dirty && (now - (V.lastDraw || 0)) < 250) return;
    V.dirty = false; V.lastDraw = now;
    if (!V.g) return;
    updateCamera();
    V.r.render(V.scene, V.cam);
  }

  Object.assign(V, { init, build, syncUnits, playFx, highlight, clearHighlights, showSides, selectRing, focus, rotate, zoom, refreshHex, ladderMarks, wpos });
})(window);
