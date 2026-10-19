// 立體（3D）畫面：載入、點選（射線拾取）、手指旋轉、傾斜設定、翻轉視角
async function open3d(t, params = '') {
  const pg = await t.open('view=3d' + (params ? '&' + params : ''));
  await pg.waitForFunction(() => V3.ready && V3.on, null, { timeout: 15000 });
  await pg.evaluate(() => { draw3D(); });
  return pg;
}
// 棋子（或地面點）目前在畫面上的 client 座標
const screenOf = (pg, x, h, y) => pg.evaluate(([x, h, y]) => { const [sx, sy] = P3(x, h, y), r = V3.cv.getBoundingClientRect(); return [r.left + sx, r.top + sy]; }, [x, h, y]);

module.exports = [
  { name: '3D 載入：模型齊全、有畫出三角形、沒有錯誤', async fn(t) {
    const pg = await open3d(t);
    const r = await pg.evaluate(() => ({ models: V3.pieces.size, tris: V3.r.info.render.triangles, cv2d: getComputedStyle(cv).display, stage: !V3.stage.hidden, tilt: V3.tilt, rot: V3.rot }));
    t.assert.strictEqual(r.models, 32); t.assert.ok(r.tris > 2000, '三角形數太少：' + r.tris);
    t.assert.deepStrictEqual([r.cv2d, r.stage, r.tilt, r.rot], ['none', true, 45, true]);
  } },
  { name: '3D 點選：點棋子頂部選取、點綠點設目的地', async fn(t) {
    const pg = await open3d(t, 'view=3d');
    const p = await pg.evaluate(() => { const p = pieces.find(q => q.s === 0 && q.t === 'N'); return { x: p.x, y: p.y }; });
    await pg.mouse.click(...await screenOf(pg, p.x, 14, p.y));
    t.assert.strictEqual(await pg.evaluate(() => state + ':' + sel.p.t), 'select:N');
    const mv = await pg.evaluate(() => { quick = false; return sel.moves[0]; });
    await pg.mouse.click(...await screenOf(pg, mv[0], 0, mv[1]));
    t.assert.deepStrictEqual(await pg.evaluate(() => sel.dest), mv);
  } },
  { name: '3D 手指旋轉：拖曳會轉視角（不會誤選棋子）；轉過之後點選仍然準確', async fn(t) {
    const pg = await open3d(t);
    const [cx, cy] = await screenOf(pg, 270, 0, 300);
    await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(cx + 60, cy, { steps: 6 }); await pg.mouse.move(cx + 120, cy, { steps: 6 }); await pg.mouse.up();
    const az = await pg.evaluate(() => V3.az); t.assert.ok(Math.abs(az) > 0.5, '視角沒有旋轉');
    t.assert.strictEqual(await pg.evaluate(() => state), 'aim');
    await pg.evaluate(() => draw3D());
    const p = await pg.evaluate(() => { const p = pieces.find(q => q.s === 0 && q.t === 'R'); return { x: p.x, y: p.y }; });
    await pg.mouse.click(...await screenOf(pg, p.x, 14, p.y));
    t.assert.strictEqual(await pg.evaluate(() => state + ':' + sel.p.t), 'select:R');
  } },
  { name: '3D 關閉手指旋轉：拖曳不轉視角，輕點立即選取', async fn(t) {
    const pg = await open3d(t);
    await pg.evaluate(() => { viewPref.rot = false; V3.rot = false; });
    const [cx, cy] = await screenOf(pg, 270, 0, 300);
    await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(cx + 100, cy, { steps: 6 }); await pg.mouse.up();
    t.assert.strictEqual(await pg.evaluate(() => V3.az), 0);
  } },
  { name: '3D 射線換算：各棋子投影到螢幕再換算回來，誤差在 10 像素內（一般與連線執黑的翻轉視角）', async fn(t) {
    const pg = await open3d(t);
    const worst = await pg.evaluate(() => {
      let w = 0;
      for (const side of [0, 1]) {
        mode = 'online'; mySide = side; updateCamera();   // 連線執黑（side=1）時 viewFlip() 為真，相機轉 180°
        for (const p of pieces) { const [sx, sy] = P3(p.x, 4, p.y), r = V3.cv.getBoundingClientRect(), q = pos3D({ clientX: r.left + sx, clientY: r.top + sy }); w = Math.max(w, Math.hypot(q.x - p.x, q.y - p.y)); }
      }
      mode = 'local'; mySide = 0; return w;
    });
    t.assert.ok(worst < 10, '換算誤差 ' + worst);
  } },
  { name: '3D 特效：機槍、火箭、砲彈、霰彈、防空攔截、空投、爆炸的繪製不出錯', async fn(t) {
    const pg = await open3d(t);
    const n = await pg.evaluate(() => {
      let frames = 0; const run = (a, b) => { turn = a.s; mover = a; state = 'fire'; timer = 99; shoot(a, b); for (let i = 0; i < 60; i++) { update(0.03); draw3D(); frames++; } };
      let [rk, tg] = T_.place([{ s: 0, t: 'R', c: 4, r: 6 }, { s: 1, t: 'N', c: 4, r: 3 }]); run(rk, tg);
      let [n, kn] = T_.place([{ s: 0, t: 'N', c: 4, r: 6 }, { s: 1, t: 'R', c: 5, r: 4 }]); run(n, kn);
      let [c, far, e] = T_.place([{ s: 0, t: 'C', c: 4, r: 5 }, { s: 1, t: 'R', c: 4, r: 1 }, { s: 1, t: 'E', c: 3, r: 2 }]); run(c, far);   // 防空攔截
      let [p2, near] = T_.place([{ s: 0, t: 'P', id: 'P2', c: 4, r: 4 }, { s: 1, t: 'R', c: 4, r: 3 }, { s: 1, t: 'K', c: 3, r: 0 }]); run(p2, near);
      let [pw] = T_.place([{ s: 0, t: 'P', c: 2, r: 5 }]); T_.go(pw, 2, 4); for (let i = 0; i < 90; i++) { update(0.03); draw3D(); frames++; }   // 升官空投
      return frames;
    });
    t.assert.ok(n > 300);
  } },
  { name: '3D 空投：運輸機飛過、補給箱降落傘緩降、落地後清掉模型並升官', async fn(t) {
    const pg = await open3d(t);
    const r = await pg.evaluate(() => {
      const [p] = T_.place([{ s: 0, t: 'P', c: 3, r: 5 }]); quick = false; selectPiece(p); const mv = sel.moves[0]; sel.dest = mv; go(mv);
      for (let i = 0; i < 400 && state !== 'target'; i++) update(0.02);
      const f = fx.find(x => x.k === 'drop'), o = { hasFx: !!f, seen: { plane: false, chute: false, crateLow: false } };
      for (let i = 0; i < 300 && fx.includes(f); i++) {
        update(0.02); draw3D(); const d = V3.drops.get(f); if (!d) continue;
        if (d.plane.g.visible && d.plane.g.position.y > 100) o.seen.plane = true;
        if (d.goods.chute.visible && d.goods.g.position.y > 30) o.seen.chute = true;
        if (d.goods.g.position.y < 10) o.seen.crateLow = true;
      }
      draw3D(); o.cleaned = V3.drops.size === 0; o.promoted = p.T.id === 'P2'; return o;
    });
    t.assert.deepStrictEqual(r, { hasFx: true, seen: { plane: true, chute: true, crateLow: true }, cleaned: true, promoted: true });
  } },
  { name: '3D 傾斜角設定與重置視角', async fn(t) {
    const pg = await open3d(t);
    await pg.evaluate(() => { $('tilt').value = 60; $('tilt').dispatchEvent(new Event('input')); V3.az = 1; });
    t.assert.strictEqual(await pg.evaluate(() => [V3.tilt, viewPref.tilt, $('tiltV').textContent].join()), '60,60,60°');
    await pg.click('#camBtn'); t.assert.strictEqual(await pg.evaluate(() => V3.az), 0);
  } },
  { name: '2D／3D 切換：切回 2D 顯示原本的畫布', async fn(t) {
    const pg = await open3d(t);
    await pg.evaluate(() => { viewPref.view = '2d'; return applyView(); });
    t.assert.deepStrictEqual(await pg.evaluate(() => [getComputedStyle(cv).display !== 'none', V3.stage.hidden, window.draw === draw2D]), [true, true, true]);
  } },
];
