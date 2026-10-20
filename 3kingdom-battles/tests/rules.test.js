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
  { name: '城門：守軍只能從城門進出城，不能從城外直接上城牆', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = T.setup([{ gen: 'zhangliao', side: 'def', c: 14, r: 7 }, { gen: 'songxian', side: 'def', c: 15, r: 7 }]);
      const zl = T.u('zhangliao'), sx = T.u('songxian');
      const wallFromOut = RULES.moveCost(g, zl, 15, 6, 14, 7);       // 城外 → 城牆
      const gateFromOut = RULES.moveCost(g, zl, 15, 9, 14, 9);       // 城外 → 城門
      const jumpDown = RULES.moveCost(g, sx, 14, 7, 15, 7);          // 城牆 → 城外
      const gateOut = RULES.moveCost(g, sx, 14, 9, 15, 9);           // 城門 → 城外
      const wallToCity = RULES.moveCost(g, sx, 16, 7, 15, 7);        // 城牆 → 城內
      zl.c = 13; zl.r = 6; const reach = RULES.reachable(g, zl);
      // 能走到的城牆格，路線一定經過城門
      const viaGate = [...reach.keys()].filter(k => { const [c, r] = HEX.unkey(k); return RULES.terr(g, c, r).wall && !RULES.terr(g, c, r).gate; })
        .every(k => RULES.pathTo(reach, k).some(([c, r]) => RULES.terr(g, c, r).gate));
      return { wallFromOut, gateFromOut, jumpDown, gateOut, wallToCity, viaGate };
    });
    env.assert(!isFinite(r.wallFromOut) && !isFinite(r.jumpDown), '不能從城外直接上城牆、也不能從城牆跳下城外：' + JSON.stringify(r));
    env.assert(isFinite(r.gateFromOut) && isFinite(r.gateOut) && isFinite(r.wallToCity), '城門可以進出、城牆可以下到城內：' + JSON.stringify(r));
    env.assert(r.viaGate, '城外部隊要上城牆一定要經過城門');
  } },
  { name: '水淹：大水可以涉水（器械不行），3 回合後退成泥濘', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = RULES.newGame('xiapi', { seed: 2 }); g.round = 7;
      const inf = g.units.find(u => u.side === 'att' && u.type === 'inf' && u.alive), eng = g.units.find(u => u.type === 'ram');
      let lw = null; for (let r = 0; r < g.Hh && !lw; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'l' && !RULES.unitAt(g, c, r)) { lw = [c, r]; break; }
      g.vars.digOpen = true; g.vars.dig = 3; inf.c = 12; inf.r = 1;   // 站在河堤上
      RULES.doAction(g, inf, 'dig');
      const flooded = g.vars.flooded && g.map[lw[1]][lw[0]] === 'w';
      const wadeInf = RULES.moveCost(g, inf, lw[0], lw[1], lw[0] - 1, lw[1]), wadeEng = RULES.moveCost(g, eng, lw[0], lw[1], lw[0] - 1, lw[1]);
      g.order = []; g.oi = 0; for (let i = 0; i < 3; i++) RULES.startRound(g);
      return { flooded, wadeInf, wadeEng, after: g.map[lw[1]][lw[0]], receded: g.vars.receded, engAfter: RULES.moveCost(g, eng, lw[0], lw[1], lw[0] - 1, lw[1]) };
    });
    env.assert(r.flooded, '掘滿應該水淹：' + JSON.stringify(r));
    env.assert(isFinite(r.wadeInf) && !isFinite(r.wadeEng), '步兵可以涉水、器械不行：' + JSON.stringify(r));
    env.assert(r.receded && r.after === 'm' && isFinite(r.engAfter), '3 回合後應退成泥濘、器械可以通過：' + JSON.stringify(r));
  } },
  { name: '同格與順序：器械可和一支友軍同格；己方可以改派別的部隊先行動', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = RULES.newGame('xiapi', { seed: 3 });
      const ram = g.units.find(u => u.type === 'ram'), inf = g.units.find(u => u.side === 'att' && u.type === 'inf' && u.alive), cav = g.units.find(u => u.side === 'att' && u.type === 'cav' && u.alive);
      inf.c = 5; inf.r = 12; cav.c = 7; cav.r = 12; ram.c = 6; ram.r = 13;
      const engWithInf = RULES.canStop(g, ram, 5, 12), cavWithInf = RULES.canStop(g, cav, 5, 12);
      ram.c = 5; ram.r = 12; const third = RULES.canStop(g, g.units.find(u => u.type === 'ladder'), 5, 12);
      const top = RULES.unitAt(g, 5, 12) === inf;
      // 改派順序
      RULES.startRound(g);
      while (RULES.activeUnit(g).side !== 'att') RULES.endActivation(g);
      const cur = RULES.activeUnit(g);
      const later = g.order.slice(g.oi + 1).map(id => g.units[id]).find(u => u.side === 'att' && u.alive);
      const ok = RULES.chooseActive(g, later.id);
      const nowActive = RULES.activeUnit(g) === later, curNext = g.order[g.oi + 1] === cur.id;
      RULES.endActivation(g);
      return { engWithInf, cavWithInf, third, top, ok, nowActive, curNext, curAfter: RULES.activeUnit(g) === cur };
    });
    env.assert(r.engWithInf && !r.cavWithInf && !r.third && r.top, '同格規則：' + JSON.stringify(r));
    env.assert(r.ok && r.nowActive && r.curNext && r.curAfter, '改派順序：' + JSON.stringify(r));
  } },
  { name: '合肥：晨襲陣型鬆散、疫病後撤軍、斷橋只有孫權跳得過、AI 對 AI 分出勝負', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = RULES.newGame('hefei', { seed: 4 }); RULES.startRound(g);
      const wuCoh = g.units.filter(u => u.side === 'att' && !RULES.isEngine(u)).every(u => u.coh === 55);
      const liao = RULES.gen(g.units.find(u => u.gen === 'zhangliao')).skills.includes('liaolai');
      // 直接跳到撤軍
      g.order = []; g.oi = 0; g.round = g.vars.retreatRound - 1; RULES.nextActivation(g);
      const retreating = g.vars.retreating;
      RULES.nextActivation(g); g.order = []; g.oi = 0; RULES.nextActivation(g); g.order = []; g.oi = 0; RULES.nextActivation(g);
      const broken = g.map[10][19] === 'b';
      const sun = g.units.find(u => u.gen === 'sunquan'), ling = g.units.find(u => u.gen === 'lingtong');
      const leap = RULES.moveCost(g, sun, 19, 10, 18, 10), noLeap = RULES.moveCost(g, ling, 19, 10, 18, 10);
      // AI 對 AI
      const g2 = RULES.newGame('hefei', { seed: 9 }); RULES.startRound(g2);
      let n = 0; while (!g2.over && n++ < 4000) { AI.act(g2, RULES.activeUnit(g2)); if (!g2.over) RULES.endActivation(g2); }
      return { wuCoh, liao, retreating, broken, leap, noLeap, over: g2.over };
    });
    env.assert(r.wuCoh && r.liao, '晨襲：' + JSON.stringify(r));
    env.assert(r.retreating && r.broken, '撤軍與斷橋：' + JSON.stringify(r));
    env.assert(isFinite(r.leap) && !isFinite(r.noLeap), '只有孫權能躍馬：' + JSON.stringify(r));
    env.assert(r.over && r.over.winner, 'AI 對 AI 應分出勝負：' + JSON.stringify(r.over));
  } },
  { name: '救援合流：呂布剩 50 人被圍，高順殺到旁邊合流，呂布脫困、兵力相加', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = T.setup([{ gen: 'lubu', c: 6, r: 8, troops: 50, face: 0 }, { gen: 'gaoshun', c: 5, r: 8, face: 0 },
        { gen: 'guanyu', c: 7, r: 8, face: 3 }, { gen: 'xiahoudun', c: 6, r: 7, face: 4 }, { gen: 'liubei', c: 6, r: 9, face: 2 }, { gen: 'caocao', c: 0, r: 0 }]);
      const lu = T.u('lubu'), gao = T.u('gaoshun');
      g.active = gao.id; gao.moved = false; gao.acted = false;
      const act = RULES.actionsFor(g, gao).find(a => a.id === 'merge');
      g.order = [gao.id, lu.id]; g.oi = 0;
      const ok = RULES.doAction(g, gao, 'merge', lu.id);
      return { has: !!act && act.targets.includes(lu.id), ok, luAlive: lu.alive, gaoAlive: gao.alive, at: [lu.c, lu.r], troops: lu.troops, type: lu.type, over: g.over, again: g.order.slice(g.oi + 1).includes(lu.id) };
    });
    env.assert(!r.again, '合流後呂布這回合不應再行動');
    env.assert(r.has && r.ok, JSON.stringify(r));
    env.assert(r.luAlive && !r.gaoAlive && r.at[0] === 5 && r.at[1] === 8 && r.troops === 2550 && r.type === 'inf' && !r.over, JSON.stringify(r));
  } },
  { name: '射箭：步騎也能向 2 格外放箭（不被反擊）；呂布騎射射程 3、威力勝過一般弓兵', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = T.setup([{ gen: 'lubu', c: 8, r: 8 }, { gen: 'zhangliao', c: 7, r: 7 }, { gen: 'caocao', c: 5, r: 8 }, { gen: 'caobu', c: 7, r: 9 }]);
      const lu = T.u('lubu'), zl = T.u('zhangliao'), cao = T.u('caocao'), arc = T.u('caobu');
      const luT = RULES.shootTargets(g, lu).includes(cao);
      zl.c = 7; zl.r = 8; const zlT = RULES.shootTargets(g, zl).includes(cao); zl.c = 9; zl.r = 6;
      lu.c = 7; lu.r = 8;
      const lubu = RULES.calcDamage(g, lu, cao, { mean: true, shoot: true }).dmg, archer = RULES.calcDamage(g, arc, cao, { mean: true }).dmg;
      zl.c = 7; zl.r = 7; const liao = RULES.calcDamage(g, zl, cao, { mean: true, shoot: true }).dmg;
      const before = lu.troops; g.active = lu.id; RULES.doAction(g, lu, 'shoot', cao.id);
      return { luT, zlT, lubu, archer, liao, noCounter: lu.troops === before, hit: cao.troops < cao.max };
    });
    env.assert(r.luT && r.zlT, '射程：' + JSON.stringify(r));
    env.assert(r.lubu > r.archer && r.archer > r.liao && r.liao > 0, '威力：' + JSON.stringify(r));
    env.assert(r.noCounter && r.hit, '射箭不被反擊：' + JSON.stringify(r));
  } },
];
