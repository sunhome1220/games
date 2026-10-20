// ===== 騎兵模型：披甲戰馬＋名馬毛色＋奔馳姿態 =====
// 一匹馬＋騎士由很多小零件組成；這裡把零件合併成兩個幾何體，每支部隊用 InstancedMesh 一次畫出全部騎兵：
//   coat：馬的毛色（頭、頸、身、四肢），顏色用 instanceColor，同一支部隊可以有不同毛色的馬
//   gear：馬甲（陣營色＋金邊＋鱗甲）、面簾、鬃尾、蹄、騎士（盔纓、盔甲、長槍），顏色寫在頂點色
// pose：'idle'（站立、槍朝上）、'run'（奔馳、鬃尾飄揚、騎士前傾槍平舉；移動與衝鋒時用）
// 馬朝 +x，單匹長約 0.4（一格六角格半徑約 0.9）
(function (root) {
  const SIDE = { blue: 0x3b6fc4, red: 0xc8463a };
  const TRIM = 0xd8b560, STEEL = 0x8a8f96, DARK = 0x1a1410, SKIN = 0xe8c8a0, WOOD = 0x6b4a2b;
  // 名馬毛色（instanceColor）
  const COATS = { 赤兔: 0xa83a22, 的盧: 0xe8e4da, 烏騅: 0x2a2623, 棕: 0x6b4a2b, 黃驃: 0xc09a58, 灰: 0xa8a294, 紅棕: 0x8a3a24 };
  const SIGNATURE = { lubu: '赤兔', liubei: '的盧', guanyu: '紅棕', zhangliao: '烏騅', ganning: '黃驃', chenwu: '棕', xiahoudun: '棕' };
  const MIX = ['棕', '棕', '灰', '烏騅', '黃驃', '棕', '紅棕'];
  const cache = {};

  function build(T, side, pose) {
    const key = side + pose; if (cache[key]) return cache[key];
    const run = pose === 'run';
    const acc = { coat: { p: [], n: [] }, gear: { p: [], n: [], c: [] } };
    const UP = new T.Vector3(0, 1, 0), one = new T.Vector3(1, 1, 1);
    const mesh = new T.Mesh();
    const col = new T.Color();
    let base = null;   // 目前整組的變換（例如騎士前傾）
    function put(kind, geo, mtx, hex) {
      geo.applyMatrix4(base ? new T.Matrix4().multiplyMatrices(base, mtx) : mtx);
      const g = geo.toNonIndexed(), p = g.attributes.position.array, n = g.attributes.normal.array, a = acc[kind];
      for (let i = 0; i < p.length; i++) { a.p.push(p[i]); a.n.push(n[i]); }
      if (kind === 'gear') { col.setHex(hex); for (let i = 0; i < p.length / 3; i++) a.c.push(col.r, col.g, col.b); }
    }
    function part(kind, geo, hex, pos = [0, 0, 0], rot = [0, 0, 0], sc = [1, 1, 1]) {
      mesh.position.set(...pos); mesh.rotation.set(...rot); mesh.scale.set(...sc); mesh.updateMatrix();
      put(kind, geo, mesh.matrix.clone(), hex);
    }
    const sph = () => new T.SphereGeometry(1, 8, 6), box = () => new T.BoxGeometry(1, 1, 1), cone = () => new T.ConeGeometry(1, 1, 5);
    function limb(kind, a, b, r1, r2, hex) {
      const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length();
      const q = new T.Quaternion().setFromUnitVectors(UP, d.normalize());
      put(kind, new T.CylinderGeometry(r2, r1, L, 5), new T.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, one), hex);
    }
    const sideHex = SIDE[side];

    // ---------- 馬體（毛色） ----------
    base = run ? new T.Matrix4().makeRotationZ(0.05) : null;
    const p = run ? 1 : 0;
    part('coat', sph(), 0, [0, 0.215, 0], [0, 0, 0], [0.165, 0.078, 0.07]);
    part('coat', sph(), 0, [0.1, 0.225, 0], [0, 0, 0], [0.085, 0.088, 0.075]);
    part('coat', sph(), 0, [-0.105, 0.225, 0], [0, 0, 0], [0.09, 0.088, 0.075]);
    limb('coat', [0.13, 0.25, 0], [0.215 + 0.02 * p, 0.37 + 0.005 * p, 0], 0.052, 0.034, 0);                  // 頸
    part('coat', sph(), 0, [0.275 + 0.025 * p, 0.385 - 0.005 * p, 0], [0, 0, -0.55 - 0.1 * p], [0.085, 0.036, 0.03]); // 頭
    for (const z of [-1, 1]) part('coat', cone(), 0, [0.235 + 0.025 * p, 0.435, 0.022 * z], [0, 0, 0.1], [0.012, 0.04, 0.012]); // 耳
    const legs = run
      ? [[0.115, 0.04, [0.2, 0.15, 0.04], [0.28, 0.1, 0.03]], [0.115, -0.04, [0.18, 0.1, -0.04], [0.23, 0.03, -0.05]], [-0.115, 0.04, [-0.2, 0.1, 0.04], [-0.28, 0.03, 0.05]], [-0.115, -0.04, [-0.22, 0.15, -0.04], [-0.3, 0.1, -0.03]]]
      : [[0.115, 0.04, [0.127, 0.1, 0.04], [0.123, 0.022, 0.04]], [0.115, -0.04, [0.127, 0.1, -0.04], [0.123, 0.022, -0.04]], [-0.115, 0.04, [-0.103, 0.1, 0.04], [-0.107, 0.022, 0.04]], [-0.115, -0.04, [-0.103, 0.1, -0.04], [-0.107, 0.022, -0.04]]];
    for (const [x, z, k, f] of legs) {
      limb('coat', [x, 0.2, z], k, 0.028, 0.017, 0); limb('coat', k, f, 0.016, 0.012, 0);
      part('gear', new T.CylinderGeometry(0.016, 0.02, 0.022, 5), DARK, [f[0], f[1] + 0.005, f[2]]);                     // 蹄
    }

    // ---------- 馬的裝備（陣營色馬衣、鱗甲、面簾、鬃尾） ----------
    part('gear', sph(), 0x3a2c20, [0.325 + 0.03 * p, 0.355 - 0.01 * p, 0], [0, 0, 0], [0.03, 0.026, 0.026]);             // 口鼻
    part('gear', box(), sideHex, [0, 0.17, 0], [0, 0, 0], [0.25, 0.1, 0.17]);                                              // 馬衣
    part('gear', box(), TRIM, [0, 0.118, 0], [0, 0, 0], [0.255, 0.014, 0.175]);
    for (const x of [-0.125, 0.125]) part('gear', box(), TRIM, [x, 0.17, 0], [0, 0, 0], [0.014, 0.1, 0.175]);
    for (let i = 0; i < 3; i++) part('gear', box(), STEEL, [0.165 + 0.01 * p, 0.24 - i * 0.03, 0], [0, 0, 0], [0.02, 0.026, 0.13]);   // 胸甲
    for (let i = 0; i < 3; i++) part('gear', box(), STEEL, [0.17 + i * 0.022 + 0.01 * p, 0.29 + i * 0.035, 0], [0, 0, -0.5], [0.04, 0.03, 0.062]); // 頸甲
    part('gear', box(), STEEL, [0.275 + 0.025 * p, 0.392 - 0.005 * p, 0], [0, 0, -0.55 - 0.1 * p], [0.1, 0.012, 0.06]);    // 面簾
    part('gear', cone(), TRIM, [0.3 + 0.03 * p, 0.425, 0], [0, 0, -0.55 - 0.1 * p], [0.014, 0.04, 0.014]);                // 額飾
    if (run) {
      for (let i = 0; i < 6; i++) part('gear', cone(), 0x20160e, [0.165 + i * 0.022, 0.335 + i * 0.026, 0], [0, 0, 2.05], [0.016, 0.06 - i * 0.003, 0.008]);   // 向後飄的鬃
      for (let i = 0; i < 4; i++) part('gear', cone(), 0x20160e, [-0.2 - i * 0.025, 0.235 - 0.004 * i, (i % 2 ? 1 : -1) * 0.01], [0, 0, 1.5], [0.022, 0.09, 0.012]); // 尾毛
    } else {
      for (let i = 0; i < 4; i++) part('gear', box(), 0x20160e, [0.155 + i * 0.016, 0.33 + i * 0.026, 0], [0, 0, -0.5], [0.03, 0.026, 0.018]);   // 鬃
      limb('gear', [-0.17, 0.25, 0], [-0.24, 0.13, 0], 0.03, 0.012, 0x20160e);                                          // 尾
      part('gear', box(), sideHex, [-0.255, 0.2, 0], [0, 0, 0], [0.09, 0.02, 0.02]);                                      // 尾飾帶
    }

    // ---------- 騎士 ----------
    base = run ? new T.Matrix4().makeTranslation(0, 0.31, 0).multiply(new T.Matrix4().makeRotationZ(-0.2)).multiply(new T.Matrix4().makeTranslation(0, -0.31, 0)) : null;
    const y = 0.3, armor = 0x3a4658;
    part('gear', new T.CylinderGeometry(0.042, 0.052, 0.15, 6), armor, [0, y + 0.09, 0]);                                  // 軀幹
    part('gear', box(), TRIM, [0, y + 0.03, 0], [0, 0, 0], [0.11, 0.016, 0.11]);                                            // 腰帶
    part('gear', sph(), SKIN, [0.004, y + 0.2, 0], [0, 0, 0], [0.036, 0.036, 0.036]);                                       // 頭
    part('gear', new T.SphereGeometry(0.041, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x7a7f86, [0.004, y + 0.208, 0]);      // 盔
    part('gear', new T.CylinderGeometry(0.046, 0.046, 0.008, 8), 0x7a7f86, [0.004, y + 0.206, 0]);                          // 盔緣
    limb('gear', [0.004, y + 0.248, 0], [-0.045, y + 0.3, 0], 0.012, 0.004, sideHex);                                      // 盔纓（陣營色）
    for (const z of [-1, 1]) { limb('gear', [0, y + 0.03, 0.04 * z], [0.025, y - 0.05, 0.078 * z], 0.026, 0.02, armor); limb('gear', [0.025, y - 0.05, 0.078 * z], [0, y - 0.115, 0.082 * z], 0.02, 0.014, 0x3a2c20); } // 腿
    limb('gear', [0.01, y + 0.14, 0.05], [0.075, y + 0.085, 0.065], 0.02, 0.014, armor);                                  // 手臂
    const tip = run ? [0.36, y + 0.27, 0.07] : [0.13, y + 0.5, 0.07];
    limb('gear', [-0.06, y - 0.03, 0.07], tip, 0.008, 0.006, WOOD);                                                         // 槍桿
    part('gear', cone(), 0xcfd2d6, tip, [0, 0, run ? -1.15 : -0.26], [0.016, 0.05, 0.016]);                                 // 槍尖
    if (run) { part('gear', box(), sideHex, [-0.105, y + 0.16, 0], [0, 0, 0.55], [0.11, 0.045, 0.012]); }                  // 飄揚的披風
    base = null;

    function geo(a, withColor) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(a.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(a.n, 3));
      if (withColor) g.setAttribute('color', new T.Float32BufferAttribute(a.c, 3));
      return g;
    }
    return (cache[key] = { coat: geo(acc.coat, false), gear: geo(acc.gear, true) });
  }

  // 這支部隊第 i 匹馬的毛色（名將的部隊都騎他的名馬，其他部隊毛色混搭）
  function coatOf(u, i) {
    const sig = SIGNATURE[u.gen]; if (sig) return COATS[sig];
    let a = ((u.id + 3) * 2654435761 + i * 40503) >>> 0; a = (a ^ (a >>> 13)) >>> 0;
    return COATS[MIX[a % MIX.length]];
  }
  root.CAVALRY = { build, coatOf, COATS, SIGNATURE };
})(typeof window !== 'undefined' ? window : globalThis);
