// 規則測試：直接在頁面裡呼叫 RULES（不經過畫面）
// 每個測試用 setup() 建一個乾淨的戰場：清空所有部隊，再擺上指定的部隊
const SETUP = `
  window.T = {
    g: null,
    setup(list) {
      const g = RULES.newGame('xiapi', { seed: 7 });
      g.units.forEach(u => { u.alive = false; });
      for (const d of list) {
        const base = g.units.find(u => u.gen === d.gen);
        Object.assign(base, { alive: true, troops: d.troops || base.max, c: d.c, r: d.r, face: d.face ?? 0, form: d.form ?? base.form, coh: d.coh ?? 100, mor: d.mor ?? 80, side: d.side || base.side });
      }
      g.round = 1; this.g = g; return g;
    },
    u(gen) { return this.g.units.find(u => u.gen === gen && u.alive) || this.g.units.find(u => u.gen === gen); },
    dmg(a, d) { return RULES.calcDamage(this.g, this.u(a), this.u(d), { mean: true }).dmg; },
  };`;
async function page(env) { const pg = await env.open(); await pg.evaluate(SETUP); return pg; }

module.exports = [
  { name: '方向：從背後打比從正面打痛很多', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      T.setup([{ gen: 'guanyu', c: 5, r: 9, face: 0 }, { gen: 'gaoshun', c: 6, r: 9, face: 3, form: 'yulin' }]);
      const front = T.dmg('guanyu', 'gaoshun');
      T.u('gaoshun').face = 0; const rear = T.dmg('guanyu', 'gaoshun');
      T.u('gaoshun').face = 2; const side = T.dmg('guanyu', 'gaoshun');
      return { front, side, rear };
    });
    env.assert(r.rear > r.side && r.side > r.front, JSON.stringify(r));
    env.assert(r.rear / r.front > 1.9, '魚鱗陣背面倍率應約 1.8/0.85：' + JSON.stringify(r));
  } },
  { name: '方圓陣沒有弱面；友軍協防會降低側擊傷害', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      T.setup([{ gen: 'guanyu', c: 5, r: 9 }, { gen: 'gaoshun', c: 6, r: 9, face: 0, form: 'fangyuan' }]);
      const round1 = T.dmg('guanyu', 'gaoshun'); T.u('gaoshun').face = 3; const round2 = T.dmg('guanyu', 'gaoshun');
      T.setup([{ gen: 'guanyu', c: 5, r: 9 }, { gen: 'gaoshun', c: 6, r: 9, face: 1, form: 'fengshi' }]);
      const alone = T.dmg('guanyu', 'gaoshun');
      const [hc, hr] = HEX.neighbor(6, 9, 2); // 高順的西北邊（攻擊方向旁邊）
      T.setup([{ gen: 'guanyu', c: 5, r: 9 }, { gen: 'gaoshun', c: 6, r: 9, face: 1, form: 'fengshi' }, { gen: 'houcheng', c: hc, r: hr }]);
      const covered = T.dmg('guanyu', 'gaoshun');
      return { round1, round2, alone, covered };
    });
    env.assert.strictEqual(r.round1, r.round2, '方圓陣正面、背面應相同');
    env.assert(r.covered < r.alone * 0.85, '有友軍協防應明顯降低：' + JSON.stringify(r));
  } },
  { name: '包圍與合擊：三面受敵算被包圍，夾擊有合擊加成', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = T.setup([{ gen: 'lubu', c: 8, r: 9 }, { gen: 'guanyu', c: 7, r: 9 }]);
      const solo = T.dmg('guanyu', 'lubu');
      const [c1, r1] = HEX.neighbor(8, 9, 0), [c2, r2] = HEX.neighbor(8, 9, 2);
      T.setup([{ gen: 'lubu', c: 8, r: 9 }, { gen: 'guanyu', c: 7, r: 9 }, { gen: 'xiahoudun', c: c1, r: r1 }, { gen: 'liubei', c: c2, r: r2 }]);
      return { solo, joint: T.dmg('guanyu', 'lubu'), enc: RULES.encircled(T.g, T.u('lubu')) };
    });
    env.assert(r.enc, '三面受敵應被包圍');
    env.assert(r.joint > r.solo * 1.4, '合擊＋包圍應大幅加傷：' + JSON.stringify(r));
  } },
  { name: '陣型崩潰：統率低就地解散、統率高勉強穩住', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      T.setup([{ gen: 'guanyu', c: 5, r: 9 }, { gen: 'weixu', c: 6, r: 9, coh: 18, face: 0 }, { gen: 'zhangliao', c: 6, r: 11, coh: 18, face: 0 }]);
      RULES.attack(T.g, T.u('guanyu'), T.u('weixu'));
      const wx = T.u('weixu').alive;
      const zl = T.u('zhangliao'); zl.coh = 5; T.g.units.find(u => u.gen === 'guanyu').acted = false;
      RULES.attack(T.g, T.u('guanyu'), zl);
      return { wx, zl: zl.alive, zlCoh: zl.coh, log: T.g.log.map(l => l.text).join('/') };
    });
    env.assert(!r.wx, '魏續（統率 44）應就地解散：' + r.log);
    env.assert(r.zl && r.zlCoh >= 15, '張遼（統率 90）應穩住：' + r.log);
  } },
  { name: '攻城：沒有雲梯打不到城上守軍，架梯後可以攀城', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      // (15,6) 是偶數列城牆，城外相鄰 (14,5)(14,6)(14,7)
      const g = T.setup([{ gen: 'liubei', c: 14, r: 7, face: 0 }, { gen: 'songxian', c: 15, r: 6, face: 3 }, { gen: 'gongbing', c: 14, r: 6 }]);
      const before = RULES.attackTargets(g, T.u('liubei')).length;
      const lad = g.units.find(u => u.gen === 'gongbing' && u.alive); lad.type = 'ladder';
      const ok = RULES.doAction(g, lad, 'ladder', '15,6');
      const after = RULES.attackTargets(g, T.u('liubei')).length;
      return { before, ok, after };
    });
    env.assert.strictEqual(r.before, 0, '沒有雲梯不能近戰攻城');
    env.assert(r.ok && r.after === 1, JSON.stringify(r));
  } },
  { name: '城門：攻方走不進城門，衝車撞破後可以進城', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      // 城門 (15,9) 在城外只有 (14,9) 一個相鄰格
      const g = T.setup([{ gen: 'liubei', c: 13, r: 9 }, { gen: 'gongbing', c: 14, r: 9 }]);
      const ram = T.u('gongbing'); ram.type = 'ram';
      const canBefore = RULES.reachable(g, T.u('liubei')).has('15,9');
      for (let i = 0; i < 6 && g.map[9][15] === 'G'; i++) { ram.acted = false; RULES.doAction(g, ram, 'struct', '15,9'); }
      const canAfter = RULES.reachable(g, T.u('liubei')).has('15,9');
      return { canBefore, canAfter, gate: g.map[9][15] };
    });
    env.assert(!r.canBefore && r.canAfter && r.gate === 'o', JSON.stringify(r));
  } },
  { name: '水攻：掘堤滿四次，低地變大水，低地上的器械被沖毀', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = T.setup([{ gen: 'liubei', c: 12, r: 1 }, { gen: 'gongbing', c: 14, r: 6 }]);
      g.vars.digOpen = true;
      const lb = T.u('liubei');
      for (let i = 0; i < 4; i++) { lb.acted = false; RULES.doAction(g, lb, 'dig'); }
      return { flooded: g.vars.flooded, cell: g.map[6][14], eng: T.u('gongbing').alive };
    });
    env.assert(r.flooded && r.cell === 'w' && !r.eng, JSON.stringify(r));
  } },
  { name: '倒戈：水淹後城內士氣低落，侯成等人開城投降', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = RULES.newGame('xiapi', { seed: 3 });
      g.round = 9; g.vars.flooded = true;
      for (const u of g.units) if (u.side === 'def') { u.c = u.gen === 'lubu' ? 18 : u.c; u.r = u.gen === 'lubu' ? 9 : u.r; u.mor = 50; }
      for (const u of g.units) if (['lubu', 'zhangliao', 'gaoshun'].includes(u.gen)) u.alive = false;
      g.units.find(u => u.gen === 'lubu').alive = true;
      g.order = []; g.oi = 0; RULES.nextActivation(g); // 直接進入回合結束結算
      return { betrayed: g.vars.betrayed, hou: g.units.find(u => u.gen === 'houcheng').side, gate: g.map[9][15] };
    });
    env.assert(r.betrayed && r.hou === 'att' && r.gate === 'o', JSON.stringify(r));
  } },
  { name: '勝負：佔領府衙攻方勝；糧草耗盡守方勝', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      let g = RULES.newGame('xiapi', { seed: 1 });
      const lb = g.units.find(u => u.gen === 'liubei'); lb.c = 18; lb.r = 9;
      for (const u of g.units) if (u.side === 'def' && u.gen !== 'lubu') u.alive = false;
      g.units.find(u => u.gen === 'lubu').c = 3; g.units.find(u => u.gen === 'lubu').r = 3;
      g.order = []; g.oi = 0; RULES.nextActivation(g);
      const a = g.over && g.over.winner;
      g = RULES.newGame('xiapi', { seed: 1 }); g.vars.supply = 1; g.order = []; g.oi = 0; RULES.nextActivation(g);
      return { a, b: g.over && g.over.winner };
    });
    env.assert.strictEqual(r.a, 'att'); env.assert.strictEqual(r.b, 'def');
  } },
  { name: 'AI 對 AI：完整一局會分出勝負', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = RULES.newGame('xiapi', { seed: 11 }); RULES.startRound(g);
      let n = 0; while (!g.over && n++ < 3000) { AI.act(g, RULES.activeUnit(g)); if (!g.over) RULES.endActivation(g); }
      return g.over;
    });
    env.assert(r && r.winner, JSON.stringify(r));
  } },
  { name: '存檔：中途存檔再讀取，接著打的結果和沒存檔時一模一樣', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const run = g => { let n = 0; while (!g.over && n++ < 3000) { AI.act(g, RULES.activeUnit(g)); if (!g.over) RULES.endActivation(g); } return JSON.stringify({ over: g.over, stats: g.stats, units: g.units.map(u => [u.c, u.r, u.troops, u.alive]) }); };
      const g = RULES.newGame('xiapi', { seed: 5 }); RULES.startRound(g);
      for (let i = 0; i < 120 && !g.over; i++) { AI.act(g, RULES.activeUnit(g)); if (!g.over) RULES.endActivation(g); }
      const save = JSON.parse(JSON.stringify(RULES.serialize(g)));   // 模擬寫入 localStorage 再讀回
      const g2 = RULES.restore(save);
      return { round: g.round, city: g2.city instanceof Set && g2.city.size === g.city.size, a: run(g), b: run(g2) };
    });
    env.assert(r.round >= 2, '應該打到第 2 回合以後再存檔');
    env.assert(r.city, '城內範圍要還原成 Set');
    env.assert.strictEqual(r.b, r.a);
  } },
];
