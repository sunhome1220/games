// 規則測試：直接在頁面裡呼叫遊戲邏輯（js/game.js、ai.js、turn.js），固定亂數讓結果可重現
const mid = '() => 0.5';   // 固定「亂數」＝0.5（抖動 ×1.0）
module.exports = [
  { name: '資料：道路連得到、每國有都城、克制表完整', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const ids = new Set(G.cities.map(c => c.id)), seen = new Set(['luoyang']), q = ['luoyang'];
      while (q.length) for (const n of neighborsOf(q.shift())) if (!seen.has(n)) { seen.add(n); q.push(n); }
      return { edgesOk: EDGES.every(([a, b]) => ids.has(a) && ids.has(b)), connected: seen.size === ids.size, caps: FIDS.every(f => ownedBy(f).some(c => c.capital && c.id === FACTIONS[f].capital)),
        matrix: Object.keys(ATK).every(a => Object.keys(DEF).every(d => typeof MATRIX[a][d] === 'number')), gens: G.cities.every(c => GENERALS[c.gen]), counts: FIDS.map(f => ownedBy(f).length).join() };
    });
    t.assert.deepStrictEqual(r, { edgesOk: true, connected: true, caps: true, matrix: true, gens: true, counts: '3,3,3' });
  } },
  { name: '出兵：扣兵力、行軍回合數依距離、只能走相鄰道路、兵力不夠或太少不能出', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; const hz = cityById('hanzhong'), before = hz.troops;
      o.far = dispatch('hanzhong', 'jianye', 100); o.few = dispatch('hanzhong', 'changan', 10); o.many = dispatch('hanzhong', 'changan', 99999);
      const a = dispatch('hanzhong', 'changan', 200); o.ok = !!a; o.left = before - hz.troops; o.turns = turnsFor('hanzhong', 'changan');
      return o;
    });
    t.assert.deepStrictEqual(r, { far: null, few: null, many: null, ok: true, left: 200, turns: 1 });
  } },
  { name: '行軍：長路要多回合；抵達自己的城＝增援；抵達中立城＝開始圍城', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; const ch = cityById('chengdu'), hz = cityById('hanzhong'); o.long = turnsFor('chengdu', 'yongan');
      const yo = cityById('yongan'), a = dispatch('chengdu', 'yongan', 300), t0 = yo.troops; let n = 0; while (G.armies.includes(a) && n < 20) { stepArmies(); n++; }
      o.turnsTaken = n; o.reinforced = yo.troops - t0;
      dispatch('hanzhong', 'changan', 200); stepArmies(); const s = G.sieges[0]; o.siege = s && [s.city, s.attacker, s.troops];
      return o;
    });
    t.assert.deepStrictEqual(r, { long: 2, turnsTaken: 2, reinforced: 300, siege: ['changan', 'shu', 200] });
  } },
  { name: '野戰：同一條路上對向的敵軍相遇，兵力多者勝，敗者消滅', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      G.rng = () => 0.5; const o = {};
      const a = dispatch('luoyang', 'xuchang', 600), b = dispatch('xuchang', 'luoyang', 300); b.owner = 'shu';   // 讓兩軍屬不同國
      const ev = stepArmies(); o.field = ev.some(e => e.t === 'field'); o.aWon = ev.some(e => e.win && e.win.id === a.id); o.bGone = !G.armies.includes(b) && !G.sieges.length;
      return o;
    });
    t.assert.deepStrictEqual(r, { field: true, aWon: true, bGone: true });
  } },
  { name: '攻城：克制表生效（火攻被潑水剋制、衝車被出城剋制）；守將智力高則克制更強', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; const mk = (city, a, d) => { newGame('shu', 1); const c = cityById(city); const s = { city, attacker: 'shu', troops: 600, lead: 7, rounds: 0, last: null }; G.sieges.push(s); return siegeRound(s, a, d, () => 0.5); };
      const fireWater = mk('wan', 'fire', 'water'), fireHold = mk('wan', 'fire', 'hold'); o.fire = [fireWater.wallDmg, fireHold.wallDmg, fireWater.wallDmg < fireHold.wallDmg * 0.4];
      const ramSortie = mk('wan', 'ram', 'sortie'), ramWater = mk('wan', 'ram', 'water'); o.ram = ramSortie.wallDmg < ramWater.wallDmg * 0.5;
      const smart = mk('xuchang', 'fire', 'water'), dumb = mk('wan', 'fire', 'water'); o.intel = smart.wallDmg < dumb.wallDmg;   // 司馬懿(智10) vs 守將(智5)
      const arrow = mk('wan', 'ladder', 'arrow'), hold = mk('wan', 'ladder', 'hold'); o.loss = arrow.atkLoss > hold.atkLoss;   // 箭雨攻方傷亡更多
      return o;
    });
    t.assert.ok(r.fire[2] && r.ram && r.intel && r.loss, JSON.stringify(r));
  } },
  { name: '攻城結局：牆破後決戰——攻方多則攻陷（換主、給金幣）；攻方少則潰敗撤圍；攻方全滅則圍城瓦解', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; const run = (att, defT, wall) => { newGame('shu', 1); const c = cityById('wan'); c.troops = defT; c.wall = wall; const g0 = G.factions.shu.gold; const s = { city: 'wan', attacker: 'shu', troops: att, lead: 7, rounds: 0, last: null }; G.sieges.push(s); const r = siegeRound(s, 'ram', 'hold', () => 0.5); return { res: r.result, owner: c.owner, sieges: G.sieges.length, gold: G.factions.shu.gold - g0 }; };
      o.win = run(900, 150, 20); o.lose = run(200, 600, 20); o.dead = run(1, 600, 300);
      return o;
    });
    t.assert.deepStrictEqual(r.win, { res: 'captured', owner: 'shu', sieges: 0, gold: 100 }); t.assert.deepStrictEqual([r.lose.res, r.lose.owner, r.lose.sieges], ['repulsed', 'none', 0]); t.assert.deepStrictEqual([r.dead.res, r.dead.sieges], ['destroyed', 0]);
  } },
  { name: '都城陷落：該國滅亡（城池變中立、軍隊消失）；兩國皆滅則玩家勝利；玩家都城被攻陷則失敗', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; const takeCapital = (att, cap) => { const c = cityById(cap); c.troops = 1; c.wall = 0; const s = { city: cap, attacker: att, troops: 2000, lead: 8, rounds: 0, last: null }; G.sieges.push(s); siegeRound(s, 'ram', 'hold', () => 0.5); };
      newGame('shu', 1); dispatch('luoyang', 'ye', 100); takeCapital('shu', 'luoyang'); o.weiDead = !G.factions.wei.alive; o.neutral = ownedBy('wei').length === 0; o.armies = G.armies.filter(a => a.owner === 'wei').length; o.over1 = checkVictory();
      takeCapital('shu', 'jianye'); o.over2 = checkVictory();
      newGame('shu', 1); takeCapital('wu', 'chengdu'); o.lose = checkVictory();
      return o;
    });
    t.assert.deepStrictEqual(r, { weiDead: true, neutral: true, armies: 0, over1: null, over2: 'win', lose: 'lose' });
  } },
  { name: '每回合結算：收入、補兵不超過上限；被圍的城不補兵不收入；徵兵／修牆花金幣', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; const g0 = G.factions.shu.gold, hz = cityById('hanzhong'), cd = cityById('chengdu'); cd.troops = cd.cap - 5; hz.troops = 300;
      G.sieges.push({ city: 'hanzhong', attacker: 'wei', troops: 100, lead: 5, rounds: 0, last: null }); economy();
      o.income = G.factions.shu.gold - g0; o.capCap = cd.troops === cd.cap; o.besieged = hz.troops === 300;
      const gold = G.factions.shu.gold; cd.troops = 100; o.recruit = recruit('chengdu') && cd.troops === 100 + RECRUIT.troops && G.factions.shu.gold === gold - RECRUIT.cost;
      cd.wall = 100; o.repair = repair('chengdu') && cd.wall === 100 + REPAIR.wall;
      G.factions.shu.gold = 10; o.broke = !recruit('chengdu') && !repair('chengdu');
      return o;
    });
    t.assert.deepStrictEqual(r, { income: 55 + 35, capCap: true, besieged: true, recruit: true, repair: true, broke: true });   // 蜀的成都 55＋永安 35（漢中被圍不計）
  } },
  { name: '電腦：三國全由電腦打，多個種子都能分出勝負、不出錯', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(async () => {
      const res = []; for (const seed of [1, 2, 3, 4, 5, 6]) {
        newGame('shu', seed); G.fast = true; G.auto = true; let n = 0;
        while (n < 400) { G.over = null; G.phase = 'player'; aiOrders(G.player); await endTurn(); n++; if (FIDS.filter(f => G.factions[f].alive).length === 1) break; }
        res.push(FIDS.filter(f => G.factions[f].alive).length === 1 ? n : -1);
      }
      return res;
    });
    t.assert.ok(r.every(n => n > 5 && n < 400), '有局面無法分出勝負：' + r);
  } },
  { name: '電腦戰術：守方會針對攻方上一輪的招式（出現克制的機率明顯較高）', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const s = { city: 'wan', attacker: 'wei', troops: 500, lead: 5, rounds: 1, last: 'fire' }; let water = 0; for (let i = 0; i < 400; i++) if (aiDefenseTactic(s) === 'water') water++;
      return water / 400;
    });
    t.assert.ok(r > 0.45, '對火攻選潑水的比例 ' + r);
  } },
];
