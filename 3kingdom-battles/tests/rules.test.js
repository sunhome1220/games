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
  { name: '水攻：同一段河堤掘滿 6 次決堤，低地變大水，低地上的器械被沖毀', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = T.setup([{ gen: 'liubei', c: 14, r: 1 }, { gen: 'gongbing', c: 14, r: 6 }]);
      g.vars.digOpen = true;
      const lb = T.u('liubei');
      let early = null; for (let i = 0; i < 6; i++) { lb.acted = false; RULES.doAction(g, lb, 'dig', '13,1'); if (i === 4) early = g.vars.flooded; }
      return { early, flooded: g.vars.flooded, cell: g.map[6][14], eng: T.u('gongbing').alive };
    });
    env.assert(!r.early && r.flooded && r.cell === 'w' && !r.eng, JSON.stringify(r));
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
      g = RULES.newGame('xiapi', { seed: 1 }); g.vars.supply = 1; g.vars.starve = 2; g.order = []; g.oi = 0; RULES.nextActivation(g);
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
  { name: '水淹：大水分三波漲高、可以涉水（器械不行），掘堤後第 4 回合退成泥濘', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = RULES.newGame('xiapi', { seed: 2 }); g.round = 7;
      const inf = g.units.find(u => u.side === 'att' && u.type === 'inf' && u.alive), eng = g.units.find(u => u.type === 'ram');
      let lw = null; for (let r = 0; r < g.Hh && !lw; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'l' && !RULES.unitAt(g, c, r)) { lw = [c, r]; break; }
      g.vars.digOpen = true; g.vars.digSeg = { '13,1': 5 }; g.vars.dig = 5; inf.c = 14; inf.r = 1;   // 站在堤旁
      RULES.doAction(g, inf, 'dig', '13,1');
      const flooded = g.vars.flooded && g.map[lw[1]][lw[0]] === 'w';
      const cnt = () => { let n = 0; for (const row of g.map) for (const ch of row) if (ch === 'w') n++; return n; };
      const waves = [cnt()]; const fr = g.vars.floodRound;
      const wadeInf = RULES.moveCost(g, inf, lw[0], lw[1], lw[0] - 1, lw[1]), wadeEng = RULES.moveCost(g, eng, lw[0], lw[1], lw[0] - 1, lw[1]);
      g.order = []; g.oi = 0; for (let i = 0; i < 4; i++) { RULES.startRound(g); waves.push(cnt()); }
      return { waves, stage: g.vars.floodStage, flooded, wadeInf, wadeEng, after: g.map[lw[1]][lw[0]], receded: g.vars.receded, engAfter: RULES.moveCost(g, eng, lw[0], lw[1], lw[0] - 1, lw[1]) };
    });
    env.assert(r.flooded, '掘滿應該水淹：' + JSON.stringify(r));
    env.assert(r.waves[0] > 0 && r.waves[1] > r.waves[0] && r.waves[2] > r.waves[1] && r.waves[3] === r.waves[2] && r.stage === 3, '水位分三波越漲越高：' + JSON.stringify(r));
    env.assert(isFinite(r.wadeInf) && !isFinite(r.wadeEng), '步兵可以涉水、器械不行：' + JSON.stringify(r));
    env.assert(r.receded && r.after === 'm' && isFinite(r.engAfter), '第 4 回合應退成泥濘、器械可以通過：' + JSON.stringify(r));
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
  { name: '技能冷卻與代價：飛將用完按鈕顯示冷卻、陣勢下降；陣勢太低不能用；冷卻 3 回合後恢復', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = T.setup([{ gen: 'lubu', c: 8, r: 8 }, { gen: 'caocao', c: 2, r: 8 }]); const lu = T.u('lubu'); g.active = lu.id;
      const find = () => RULES.actionsFor(g, lu).find(a => a.id === 'skill:feijiang');
      const before = lu.coh; RULES.doAction(g, lu, 'skill:feijiang');
      const used = find(), drop = before - lu.coh;
      const cd = []; for (let i = 0; i < 3; i++) { cd.push(lu.cd.feijiang); for (const u of g.units) if (u.alive) for (const k in u.cd) if (u.cd[k] > 0) u.cd[k]--; }
      lu.coh = 30; const tired = find();
      lu.coh = 100; lu.acted = false; const again = find();
      return { name: used.name, enabled: used.enabled, drop, cd, tired: tired.enabled, tiredWhy: tired.why, again: again.enabled };
    });
    env.assert(r.name === '飛將（冷卻 3）' && !r.enabled, JSON.stringify(r));
    env.assert(r.drop > 3 && r.drop < 8, '呂布統率高，代價約 5：' + JSON.stringify(r));
    env.assert(!r.tired && r.again, JSON.stringify(r));
  } },
  { name: '下邳：糧營各存一部分，燒光才缺糧；缺糧後軍心天天下降，撐 3 天退兵', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = RULES.newGame('xiapi', { seed: 2 }); g.sc.weather = ['晴']; RULES.startRound(g);
      const ds = g.vars.depots, zl = g.units.find(u => u.gen === 'zhangliao'), cao = g.units.find(u => u.gen === 'caocao');
      const sup0 = g.vars.supply; const roundEnd = () => { g.order = []; g.oi = 0; RULES.nextActivation(g); };
      const ignite = (u, d) => { g.active = u.id; u.acted = false; u.c = d.c + 1; u.r = d.r; const t = RULES.actionsFor(g, u).find(x => x.id === 'burn'); return t && RULES.doAction(g, u, 'burn', HEX.key(d.c, d.r)); };
      ignite(zl, ds[0]); roundEnd(); roundEnd(); roundEnd();                     // 燒中軍糧營（相鄰放火）：晴天連燒三階段
      const afterOne = g.vars.supply, burnt1 = ds.filter(d => d.burnt).length;
      for (const d of ds.slice(1)) { const u = g.units.find(x => x.gen === (d === ds[1] ? 'gaoshun' : 'lubu')); ignite(u, d); }
      roundEnd(); roundEnd(); roundEnd();
      const sup2 = g.vars.supply, starve2 = g.vars.starve, mor = cao.mor;
      const out = []; for (let i = 0; i < 6 && !g.over; i++) { roundEnd(); out.push(g.vars.starve); }
      return { sup0, afterOne, burnt1, sup2, starve2, mor, cao: cao.mor, out, over: g.over };
    });
    env.assert(r.burnt1 === 1 && r.afterOne <= r.sup0 - 210, '燒一座：' + JSON.stringify(r));
    env.assert(r.sup2 <= 0 && r.starve2 >= 1, '三座燒光就缺糧：' + JSON.stringify(r));
    env.assert(r.over && r.over.winner === 'def' && r.over.round >= 1, '缺糧 3 天後守方勝：' + JSON.stringify(r));
  } },
  { name: '主將殺出重圍：呂布第一次被打光時帶殘部衝到友軍旁，第二次才算被擒；可被救援合流', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = RULES.newGame('xiapi', { seed: 3 }); RULES.startRound(g);
      const lu = g.units.find(u => u.gen === 'lubu'), gao = g.units.find(u => u.gen === 'gaoshun'), at = (n, c, r) => { const u = g.units.find(x => x.gen === n); u.c = c; u.r = r; return u; };
      at('lubu', 8, 8); at('gaoshun', 6, 6); at('guanyu', 9, 8); at('xiahoudun', 8, 7);
      RULES.attack ? null : null;
      // 直接把呂布打光
      g.units.find(u => u.gen === 'guanyu').acted = false;
      const A = g.units.find(u => u.gen === 'guanyu'); lu.troops = 30; g.active = A.id; A.moved = false; A.acted = false;
      RULES.attack(g, A, lu);
      const first = { alive: lu.alive, troops: lu.troops, over: !!g.over, near: Math.min(...g.units.filter(u => u.alive && u.side === 'def' && u !== lu && !RULES.isEngine(u)).map(u => HEX.dist(u.c, u.r, lu.c, lu.r))) };
      // 再被打光 = 被擒
      lu.troops = 10; A.acted = false; if (HEX.dist(A.c, A.r, lu.c, lu.r) > 1) { A.c = lu.c + 1; A.r = lu.r; } RULES.attack(g, A, lu);
      return { first, second: { alive: lu.alive, over: g.over && g.over.winner } };
    });
    env.assert(r.first.alive && !r.first.over && r.first.troops >= 40 && r.first.near <= 2, '第一次：' + JSON.stringify(r));
    env.assert(!r.second.alive && r.second.over === 'att', '第二次：' + JSON.stringify(r));
  } },
  { name: '火箭燒營：弓兵 2～3 格外一箭就燃；步騎要射 2 箭，火勢累積', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = RULES.newGame('xiapi', { seed: 5 }); RULES.startRound(g);
      const d = g.vars.depots[1]; const arc = g.units.find(u => u.gen === 'chengong'), cav = g.units.find(u => u.gen === 'zhangliao');
      const place = (u, c, r) => { u.c = c; u.r = r; u.acted = false; g.active = u.id; };
      place(cav, d.c + 3, d.r); const farCav = RULES.depotTargets(g, cav).length;     // 3 格外，沒有高地：步騎射程 2，射不到
      place(cav, d.c + 2, d.r); const k = HEX.key(d.c, d.r);
      const t1 = RULES.doAction(g, cav, 'burn', k), after1 = g.map[d.r][d.c], fire1 = g.vars.fire[k];
      place(cav, d.c + 2, d.r); RULES.doAction(g, cav, 'burn', k);
      const after2 = g.map[d.r][d.c], burning = !!g.vars.burning[k], burnt = d.burnt;
      const d2 = g.vars.depots[2]; place(arc, d2.c + 2, d2.r); const a1 = RULES.doAction(g, arc, 'burn', HEX.key(d2.c, d2.r));
      return { farCav, t1, after1, fire1, after2, burning, burnt, a1, arcBurning: !!g.vars.burning[HEX.key(d2.c, d2.r)] };
    });
    env.assert(r.farCav === 0 && r.t1 && r.after1 === 'S' && r.fire1 === 1, '步騎一箭只有 1/2：' + JSON.stringify(r));
    env.assert(r.after2 === 'S' && r.burning && !r.burnt, '第二箭起火（還沒燒光）：' + JSON.stringify(r));
    env.assert(r.a1 && r.arcBurning, '弓兵一箭就燃：' + JSON.stringify(r));
  } },
  { name: '火勢看天氣：起火損 15%、之後每回合結束損 30%、55%；下雨熄火且點不著；守營方可滅火', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const mk = w => { const g = RULES.newGame('xiapi', { seed: 4 }); g.sc.weather = w; RULES.startRound(g); return g; };
      const roundEnd = g => { g.order = []; g.oi = 0; RULES.nextActivation(g); };
      const light = (g, d) => { const u = g.units.find(x => x.gen === 'zhangliao'); g.active = u.id; u.acted = false; u.c = d.c + 1; u.r = d.r; return RULES.doAction(g, u, 'burn', HEX.key(d.c, d.r)); };
      // 晴天：與沒起火的對照局相比，糧草差額 = 2（15%）→ 5（45%）→ 12（全部）
      const base = []; { const g0 = mk(['晴']); base.push(g0.vars.supply); for (let i = 0; i < 3; i++) { roundEnd(g0); base.push(g0.vars.supply); } }
      let g = mk(['晴']); const d = g.vars.depots[0]; light(g, d); g.units.find(x => x.gen === 'zhangliao').c = 20; const dif = [Math.round(base[0] - g.vars.supply)]; for (let i = 0; i < 3; i++) { roundEnd(g); dif.push(Math.round(base[i + 1] - g.vars.supply)); }
      const out = { dif, burnt: d.burnt, tile: g.map[d.r][d.c] };
      // 下雨：起火後下一回合下雨 → 熄火、剩餘保住
      g = mk(['晴', '雨']); const d1 = g.vars.depots[0], s1 = g.vars.supply; light(g, d1); g.units.find(x => x.gen === 'zhangliao').c = 20; roundEnd(g);
      out.rainLoss = s1 - g.vars.supply; out.rainBurning = Object.keys(g.vars.burning).length; out.rainBurnt = d1.burnt;
      // 雨天點不著
      g = mk(['雨']); const d2 = g.vars.depots[0]; const u = g.units.find(x => x.gen === 'zhangliao'); u.c = d2.c + 1; u.r = d2.r; g.active = u.id; out.rainTargets = RULES.depotTargets(g, u).length;
      // 滅火：曹軍部隊在旁邊
      g = mk(['晴']); const d3 = g.vars.depots[0], s3 = g.vars.supply; light(g, d3); const afterIgnite = s3 - g.vars.supply;
      const cx = g.units.find(x => x.gen === 'xiahoudun'); cx.c = d3.c - 1 < 0 ? d3.c + 1 : d3.c; cx.r = d3.r + (cx.c === d3.c + 1 ? 1 : 0); g.units.forEach(x => { if (x !== cx && x.c === cx.c && x.r === cx.r) x.c = 15; });
      cx.c = d3.c; cx.r = d3.r; g.active = cx.id; cx.acted = false;
      const act = RULES.actionsFor(g, cx).find(x => x.id === 'douse'); const ok = act && RULES.doAction(g, cx, 'douse', HEX.key(d3.c, d3.r));
      roundEnd(g);
      out.douse = { act: !!act, ok: !!ok, afterIgnite, stage: g.vars.dstage[HEX.key(d3.c, d3.r)], burnt: d3.burnt, burning: Object.keys(g.vars.burning).length };
      return out;
    });
    env.assert(r.dif[0] === 32 && r.dif[1] === 32 && r.dif[2] === 95 && r.dif[3] === 210 && r.burnt && r.tile === '.', '晴天連燒：15%→45%→全部（210 的 15%＝32、45%＝95）：' + JSON.stringify(r));
    env.assert(r.rainLoss <= 100 && r.rainBurning === 0 && !r.rainBurnt, '下雨熄火：' + JSON.stringify(r));
    env.assert(r.rainTargets === 0, '雨天點不著：' + JSON.stringify(r));
    env.assert(r.douse.act && r.douse.ok && r.douse.burning === 0 && r.douse.stage === 1 && !r.douse.burnt, '滅火止住：' + JSON.stringify(r));
  } },
  { name: '天氣預報：智力 90 以上者提前一兩回合提醒下雨或放晴；天氣表連雨最多 2 回合', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const runs = {}; for (const id in DATA.SCENARIOS) { const w = DATA.SCENARIOS[id].weather; if (!w) continue; const t = w.concat(w); let run = 0, mx = 0; for (const x of t) { run = x === '雨' ? run + 1 : 0; mx = Math.max(mx, run); } runs[id] = mx; }
      const g = RULES.newGame('xiapi', { seed: 2 }); g.sc.weather = ['晴', '晴', '雨', '雨', '晴']; RULES.startRound(g);
      const fx = g.fx.filter(f => f.t === 'forecast');   // 第 1 回合：看到第 3 回合下雨（後天）
      const seerDef = RULES.seer(g, 'def') && RULES.seer(g, 'def').gen, seerAtt = RULES.seer(g, 'att') && RULES.seer(g, 'att').gen;
      return { runs, n: fx.length, text: fx.map(f => f.side + ':' + f.text), seerDef, seerAtt };
    });
    env.assert(Object.values(r.runs).every(n => n <= 2), '連雨超過 2 回合：' + JSON.stringify(r.runs));
    env.assert(r.seerAtt && r.n >= 1 && r.text.some(t => t.includes('下雨')), '預報：' + JSON.stringify(r));
  } },
  { name: '河堤五段：每段各自累計掘堤，守軍可搶修倒扣進度；沒掘的另一段不受影響', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = T.setup([{ gen: 'liubei', c: 14, r: 1 }, { gen: 'lubu', c: 14, r: 2 }]);
      g.vars.digOpen = true; const lb = T.u('liubei'), lu = T.u('lubu');
      const segs = []; for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'd') segs.push(c + ',' + r);
      for (let i = 0; i < 3; i++) { lb.acted = false; RULES.doAction(g, lb, 'dig', '13,1'); }
      g.active = lu.id; lu.acted = false; lu.c = 14; lu.r = 2;
      const onLevee = RULES.reachable(g, lb).has('13,2');
      const mend = RULES.actionsFor(g, lu).find(a => a.id === 'mend');
      const ok = mend && RULES.doAction(g, lu, 'mend', '13,1');
      return { segs: segs.length, after: g.vars.digSeg['13,1'], mend: !!mend, ok: !!ok, other: g.vars.digSeg['13,2'] || 0, onLevee };
    });
    env.assert(r.segs === 5, '河堤應有 5 段：' + JSON.stringify(r));
    env.assert(!r.onLevee && r.mend && r.ok && r.after === 1 && r.other === 0, '堤上不能站人；搶修 −2、其他段不變：' + JSON.stringify(r));
  } },
  { name: '伏兵：林中部隊 2 格外對曹軍隱形；騎兵移動力 +2；從林中發動的第一擊有伏擊加成', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      let fr = null; const g0 = RULES.newGame('xiapi', { seed: 3 }); for (let r = 0; r < g0.Hh && !fr; r++) for (let c = 0; c < g0.W; c++) if (g0.map[r][c] === 'f' && c > 4 && c < 10) { fr = [c, r]; break; }
      const g = T.setup([{ gen: 'lubu', c: fr[0], r: fr[1] }, { gen: 'caocao', c: Math.min(23, fr[0] + 6), r: fr[1] }, { gen: 'liubei', c: Math.min(23, fr[0] + 7), r: fr[1] }]);
      const lu = T.u('lubu'), cao = T.u('caocao');
      const hid = RULES.hidden(g, lu), seen = RULES.enemiesOf(g, cao).includes(lu);
      const mp = RULES.maxMP(g, lu), base = DATA.UNITS ? 0 : 0;
      cao.c = fr[0] + 2; cao.r = fr[1]; const near = RULES.hidden(g, lu);
      cao.c = Math.min(23, fr[0] + 6);
      g.active = lu.id; lu.ambush = true; const dm = RULES.calcDamage(g, lu, cao, { mean: true }); lu.ambush = false; const d0 = RULES.calcDamage(g, lu, cao, { mean: true });
      return { hid, seen, near, mp, amb: dm.dmg, plain: d0.dmg };
    });
    env.assert(r.hid && !r.seen, '林中隱蔽：' + JSON.stringify(r));
    env.assert(!r.near, '2 格內現形：' + JSON.stringify(r));
    env.assert(r.amb > r.plain * 1.25, '伏擊加成：' + JSON.stringify(r));
  } },
  { name: '攻城器械只轟城防：投石車打不到城外野戰部隊，打得到城內守軍', async fn(env) {
    const pg = await page(env);
    const r = await pg.evaluate(() => {
      const g = T.setup([{ gen: 'zhangliao', c: 9, r: 8 }, { gen: 'chengong', c: 15, r: 8 }]);
      const cata = g.units.find(u => u.type === 'cata'); Object.assign(cata, { alive: true, c: 11, r: 8, troops: 600 }); g.active = cata.id; cata.acted = false;
      const field = RULES.attackTargets(g, cata).map(u => u.gen);
      T.u('zhangliao').c = 22; T.u('zhangliao').r = 1; cata.c = 12; cata.r = 8;
      const inCity = RULES.attackTargets(g, cata).map(u => u.gen);
      return { field, inCity, cityCheng: RULES.inCity(g, T.u('chengong')) };
    });
    env.assert(!r.field.includes('zhangliao'), '野戰部隊不該被轟：' + JSON.stringify(r));
    env.assert(r.cityCheng && r.inCity.includes('chengong'), '城內守軍應打得到：' + JSON.stringify(r));
  } },
];
