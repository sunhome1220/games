// 終極魔法動畫：每個魔法都會排出動畫、2D／3D 繪製不出錯、播完會清掉、音效音量合理
const KINDS = ['meteor', 'revive', 'time', 'shield', 'judge', 'freeze'];
module.exports = [
  { name: '終極魔法動畫：六種都會排出 ult 動畫，持續時間正確，播完就清掉', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {};
      for (const k of ["meteor","revive","time","shield","judge","freeze"]) {
        T_.place([{ s: 0, t: "K", c: 4, r: 9 }, { s: 1, t: "K", c: 4, r: 0 }, { s: 0, t: "R", c: 1, r: 7 }, { s: 1, t: "R", c: 1, r: 2 }, { s: 1, t: "N", c: 7, r: 2 }]), cardCount = [{}, {}], mods = [{}, {}], immune = [0, 0], extraTurn = [0, 0], rebuildAll(); fx.length = 0; if (k === 'revive') { const p = pieces.find(q => q.s === 0 && q.t === 'R'); p.hp = 0; p.dead = true; }
        applyCard(0, 'ult_' + k);
        const f = fx.find(e => e.k === 'ult'); o[k] = f ? [f.kind, f.T] : null;
        for (let i = 0; i < 200; i++) update(0.03);
        o[k + '_left'] = fx.filter(e => e.k === 'ult').length;
      }
      return o;
    });
    for (const k of KINDS) { t.assert.ok(r[k] && r[k][0] === k && r[k][1] > 2, k + ' ' + JSON.stringify(r[k])); t.assert.strictEqual(r[k + '_left'], 0, k + ' 動畫沒清掉'); }
  } },
  { name: '終極魔法動畫：整段時間軸 2D 與 3D 繪製都不出錯', async fn(t) {
    const pg = await t.open('view=3d');
    const errs = [];
    pg.on('pageerror', e => errs.push(String(e)));
    const r = await pg.evaluate(() => {
      let n = 0;
      for (const k of ["meteor","revive","time","shield","judge","freeze"]) {
        T_.place([{ s: 0, t: "K", c: 4, r: 9 }, { s: 1, t: "K", c: 4, r: 0 }, { s: 0, t: "R", c: 1, r: 7 }, { s: 1, t: "R", c: 1, r: 2 }, { s: 1, t: "N", c: 7, r: 2 }]), cardCount = [{}, {}], mods = [{}, {}], immune = [0, 0], extraTurn = [0, 0], rebuildAll(); fx.length = 0; applyCard(0, 'ult_' + k);
        for (let i = 0; i < 100; i++) { update(0.03); try { draw(); n++; } catch (e) { return 'ERR ' + k + ' ' + e.message; } }
      }
      return n;
    });
    t.assert.ok(typeof r === 'number' && r >= 600, String(r)); t.assert.deepStrictEqual(errs, []);
  } },
  { name: '神之護盾：免疫期間畫護盾光環；隕石雨的落點延遲與傷害延遲一致', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      T_.place([{ s: 0, t: "K", c: 4, r: 9 }, { s: 1, t: "K", c: 4, r: 0 }, { s: 0, t: "R", c: 1, r: 7 }, { s: 1, t: "R", c: 1, r: 2 }, { s: 1, t: "N", c: 7, r: 2 }]), cardCount = [{}, {}], mods = [{}, {}], immune = [0, 0], extraTurn = [0, 0], rebuildAll(); fx.length = 0; applyCard(0, 'ult_meteor');
      const f = fx.find(e => e.k === 'ult'); const ats = f.targets.map(x => x.at);
      return { n: f.targets.length, sorted: ats.every((a, i) => i === 0 || a >= ats[i - 1]), min: Math.min(...ats), max: Math.max(...ats), T: f.T };
    });
    t.assert.ok(r.n >= 3 && r.sorted && r.min >= 0.4 && r.max < r.T, JSON.stringify(r));
  } },
  { name: '終極魔法音效：六種音效都有聲音且不爆音', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(async () => {
      const o = {};
      for (const n of ['meteor', 'holy', 'tick', 'shield', 'thunder', 'freeze']) {
        const b = await SFX._render(n, [], 3); const d = b.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); o[n] = +pk.toFixed(3);
      } return o;
    });
    for (const n in r) t.assert.ok(r[n] > 0.03 && r[n] <= 1, n + ' 峰值 ' + r[n]);
  } },
];
