// 規則單元測試：直接在頁面裡擺好棋子，呼叫遊戲自己的函式，檢查結果
module.exports = [
  { name: '初始棋盤：32 顆棋、全部在交叉點上、可走的點都是空的交叉點', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => ({ n: pieces.length, grid: pieces.every(p => Number.isInteger((p.x - M) / C) && Number.isInteger((p.y - M) / C)),
      bad: pieces.filter(p => movesFor(p).some(([x, y]) => pieces.some(q => q !== p && q.hp > 0 && Math.hypot(q.x - x, q.y - y) < 1) || x < M - 1 || x > M + 8 * C + 1 || y < M - 1 || y > M + 9 * C + 1)).length }));
    t.assert.deepStrictEqual(r, { n: 32, grid: true, bad: 0 });
  } },
  { name: '俥只走直線、不能穿過棋子；傌走日字', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const R = pieces.find(p => p.s === 0 && p.t === 'R'), N = pieces.find(p => p.s === 0 && p.t === 'N');
      const rm = movesFor(R).map(([x, y]) => T_.cell({ x, y })), nm = movesFor(N).map(([x, y]) => T_.cell({ x, y })), [nc, nr] = T_.cell(N);
      return { rookStraight: rm.every(([c, r]) => c === 0 || r === 9), rookBlocked: rm.every(([c, r]) => r >= 7), knightL: nm.length > 0 && nm.every(([c, r]) => { const dx = Math.abs(c - nc), dy = Math.abs(r - nr); return dx * dy === 2; }) };
    });
    t.assert.deepStrictEqual(r, { rookStraight: true, rookBlocked: true, knightL: true });
  } },
  { name: '俥：威力 2、射後冷卻 1、冷卻中改用步槍', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const [a, b, near] = T_.place([{ s: 0, t: 'R', c: 4, r: 6 }, { s: 1, t: 'N', c: 4, r: 3 }, { s: 1, t: 'P', c: 5, r: 6 }]);
      const o = { dmg: TT[0].R.dmg, reload: TT[0].R.reload, weapon: weaponFor(a, b).w };
      T_.fire(a, b); o.hp = b.hp; o.cd = a.cd; o.during = weaponFor(a, near).w; o.rifleDmg = weaponFor(a, near).dmg;
      return o;
    });
    t.assert.deepStrictEqual(r, { dmg: 2, reload: 1, weapon: '機槍', hp: 1, cd: 1, during: '步槍', rifleDmg: 1 });
  } },
  { name: '炮：只打橫直線、距離 4～5.2 格、冷卻中完全不能攻擊', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const [c, far, near, diag] = T_.place([{ s: 0, t: 'C', c: 4, r: 6 }, { s: 1, t: 'R', c: 4, r: 2 }, { s: 1, t: 'N', c: 4, r: 4 }, { s: 1, t: 'P', c: 6, r: 3 }]);
      const sc = p => scan(c).find(x => x.p === p);
      const o = { far: sc(far).ok, near: sc(near).why, diag: !sc(diag), reload: c.T.reload };
      c.cd = 1; o.cd = sc(far).ok === false && /裝填/.test(sc(far).why) && sc(near).ok === false;
      return o;
    });
    t.assert.deepStrictEqual(r, { far: true, near: '太近', diag: true, reload: 1, cd: true });
  } },
  { name: '炮：相鄰受 1/2、斜角受 1/4 波及傷害（敵我皆傷），射後冷卻 1', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const [c, tg, adj, dia, ally] = T_.place([{ s: 0, t: 'C', c: 4, r: 5 }, { s: 1, t: 'R', c: 4, r: 1 }, { s: 1, t: 'N', c: 3, r: 1 }, { s: 1, t: 'P', c: 5, r: 0, hp: 2 }, { s: 1, t: 'G', c: 5, r: 1 }]);
      T_.fire(c, tg); return { tg: tg.hp, adj: adj.hp, dia: dia.hp, ally: ally.hp, cd: c.cd };
    });
    t.assert.deepStrictEqual(r, { tg: 2, adj: 2, dia: 1.5, ally: 2, cd: 1 });
  } },
  { name: '傌：火箭只能打日字、射後冷卻 1 並改用步槍、蹩馬腳', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const [n, kn, adj] = T_.place([{ s: 0, t: 'N', c: 4, r: 6 }, { s: 1, t: 'R', c: 5, r: 4 }, { s: 1, t: 'P', c: 4, r: 5 }]);
      const o = { rocketOnKnight: scan(n).find(x => x.p === kn)?.T?.w, melee: scan(n).find(x => x.p === adj)?.T?.w, dmg: scan(n).find(x => x.p === kn).est };
      T_.fire(n, kn); o.cd = n.cd; o.afterRocket = scan(n).some(x => x.p === kn);
      // 蹩馬腳：(4,5) 有棋擋在長邊 → 往上的日字走不了
      const [n2] = T_.place([{ s: 0, t: 'N', c: 4, r: 6 }, { s: 1, t: 'P', c: 4, r: 5 }]);
      const m = movesFor(n2).map(([x, y]) => T_.cell({ x, y }).join(','));
      o.leg = !m.includes('5,4') && !m.includes('3,4') && m.includes('6,5');
      return o;
    });
    t.assert.deepStrictEqual(r, { rocketOnKnight: '火箭', melee: '步槍', dmg: 2, cd: 1, afterRocket: false, leg: true });
  } },
  { name: '象：走田字、不能過河（紅黑都是）、象眼被塞過不去、走不了時改走一步', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; const cells = p => movesFor(p).map(([x, y]) => T_.cell({ x, y }));
      let [e] = T_.place([{ s: 0, t: 'E', c: 2, r: 9 }]); o.tian = cells(e).map(c => c.join(',')).sort().join('|');
      [e] = T_.place([{ s: 0, t: 'E', c: 2, r: 9 }, { s: 0, t: 'P', c: 3, r: 8 }]); o.eye = cells(e).map(c => c.join(',')).sort().join('|');
      [e] = T_.place([{ s: 0, t: 'E', c: 2, r: 5 }]); o.redRiver = cells(e).every(([c, r]) => r >= 5);
      [e] = T_.place([{ s: 1, t: 'E', c: 2, r: 4 }]); o.blackRiver = cells(e).every(([c, r]) => r <= 4);
      [e] = T_.place([{ s: 0, t: 'E', c: 2, r: 9 }, { s: 0, t: 'P', c: 3, r: 8 }, { s: 0, t: 'P', c: 1, r: 8 }]);
      const fb = movesFor(e); o.fallback = fb.length > 0 && fb.every(([x, y]) => Math.abs(Math.hypot(x - e.x, y - e.y) - C) < 1);
      return o;
    });
    t.assert.deepStrictEqual(r, { tian: '0,7|4,7', eye: '0,7', redRiver: true, blackRiver: true, fallback: true });
  } },
  { name: '象：手槍 1 心，可打相鄰與田字對角點', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const [e, adj, tian, far] = T_.place([{ s: 0, t: 'E', c: 2, r: 7 }, { s: 1, t: 'P', c: 2, r: 6 }, { s: 1, t: 'N', c: 4, r: 5 }, { s: 1, t: 'R', c: 2, r: 4 }]);
      const sc = p => scan(e).find(x => x.p === p);
      return { adj: sc(adj).ok && sc(adj).est, tian: sc(tian).ok && sc(tian).est, far: !sc(far) };
    });
    t.assert.deepStrictEqual(r, { adj: 1, tian: 1, far: true });
  } },
  { name: '象：防空攔截炮彈與火箭，攔截後冷卻 1，下一發攔不了', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const [c, tg, e] = T_.place([{ s: 0, t: 'C', c: 4, r: 5 }, { s: 1, t: 'R', c: 4, r: 1 }, { s: 1, t: 'E', c: 3, r: 2 }]);
      const o = {}; o.msg = T_.fire(c, tg); o.hp1 = tg.hp; o.cd = e.cd; c.cd = 0;
      T_.fire(c, tg); o.hp2 = tg.hp;
      const [n, kn, e2] = T_.place([{ s: 0, t: 'N', c: 4, r: 6 }, { s: 1, t: 'R', c: 5, r: 4 }, { s: 1, t: 'E', c: 6, r: 3 }]);
      T_.fire(n, kn); o.rocketHp = kn.hp; o.rocketCd = e2.cd; return o;
    });
    t.assert.ok(/攔截/.test(r.msg)); t.assert.deepStrictEqual([r.hp1, r.cd, r.hp2, r.rocketHp, r.rocketCd], [4, 1, 2, 4, 1]);
  } },
  { name: '仕：近距離手槍 1 心；帥被直射時走到射線上擋（炮擊、斜線擋不了）', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {};
      let [g, e] = T_.place([{ s: 0, t: 'G', c: 3, r: 9 }, { s: 1, t: 'P', c: 4, r: 8 }]); o.pistol = scan(g).find(x => x.p === e).est;
      const [rk, K, g1, g2] = T_.place([{ s: 0, t: 'R', c: 4, r: 4 }, { s: 1, t: 'K', c: 4, r: 0 }, { s: 1, t: 'G', c: 3, r: 0 }, { s: 1, t: 'G', c: 5, r: 0 }]);
      const bl = guardBlock(K, rk, rk.T); o.line = bl && T_.cell({ x: bl.x, y: bl.y }).join(',');
      o.cannon = !!guardBlock(K, rk, TT[0].C);
      T_.fire(rk, K); const moved = [g1, g2].find(g => T_.cell(g).join(',') === '4,1');
      o.guard = !!moved && moved.hp === 1; o.king = K.hp;
      const [rk2, K2] = T_.place([{ s: 0, t: 'R', c: 7, r: 3 }, { s: 1, t: 'K', c: 4, r: 0 }, { s: 1, t: 'G', c: 3, r: 0 }, { s: 1, t: 'G', c: 5, r: 0 }]);
      o.diag = !guardBlock(K2, rk2, rk2.T); return o;
    });
    t.assert.deepStrictEqual(r, { pistol: 1, line: '4,1', cannon: false, guard: true, king: 3, diag: true });
  } },
  { name: '兵：未過河只能前進一格；過河後升士官長（3 心、霰彈槍、每次最多 2 格、不能後退）', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; let [p] = T_.place([{ s: 0, t: 'P', c: 2, r: 6 }]);
      o.fwd = movesFor(p).map(([x, y]) => T_.cell({ x, y }).join(',')).join('|');
      [p] = T_.place([{ s: 0, t: 'P', c: 2, r: 5 }]); T_.go(p, 2, 4);
      o.promoted = p.T.id === 'P2'; o.hp = p.hp; o.weapon = p.T.w;
      const ms = movesFor(p).map(([x, y]) => [(x - p.x) / C, (y - p.y) / C]);
      o.noBack = ms.every(([dx, dy]) => dy <= 0); o.max = Math.max(...ms.map(([dx, dy]) => Math.hypot(dx, dy)));
      return o;
    });
    t.assert.deepStrictEqual(r, { fwd: '2,5', promoted: true, hp: 3, weapon: '強化霰彈槍', noBack: true, max: 2 });
  } },
  { name: '兵：未過河射程 1 格，只能打上下左右相鄰的敵人，斜角打不到；射程加到 1.5 格以上才打得到斜角', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const [p, up, diag, far] = T_.place([{ s: 0, t: 'P', c: 4, r: 6 }, { s: 1, t: 'N', c: 4, r: 5 }, { s: 1, t: 'R', c: 5, r: 5 }, { s: 1, t: 'C', c: 4, r: 4 }]);
      const sc = q => scan(p).find(x => x.p === q), o = { range: p.T.range / C, adj: !!sc(up) && sc(up).ok, diag: !!sc(diag), far: !!sc(far) };
      cardCount = [{}, {}]; mods = [{}, {}]; rebuildAll(); applyCard(0, 'all_rng'); o.rangeCard = p.T.range / C; o.diagWithCard = !!sc(diag) && sc(diag).ok; return o;
    });
    t.assert.deepStrictEqual(r, { range: 1, adj: true, diag: false, far: false, rangeCard: 1.5, diagWithCard: true });
  } },
  { name: '士官長霰彈槍：越近越痛（近距離全中 2.5 心）', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const [p, close] = T_.place([{ s: 0, t: 'P', id: 'P2', c: 4, r: 4 }, { s: 1, t: 'R', c: 4, r: 3 }, { s: 1, t: 'K', c: 3, r: 0 }]);
      const o = { closeEst: scan(p).find(x => x.p === close).est }; const hp = close.hp; T_.fire(p, close); o.dealt = hp - close.hp; o.msg = /中 9 發/.test(document.getElementById('info').textContent);
      const [p2, far] = T_.place([{ s: 0, t: 'P', id: 'P2', c: 4, r: 4 }, { s: 1, t: 'R', c: 4, r: 1 }, { s: 1, t: 'K', c: 3, r: 0 }]);
      o.farLess = scan(p2).find(x => x.p === far).est < o.closeEst; return o;
    });
    t.assert.deepStrictEqual(r, { closeEst: 2.5, dealt: 2.5, msg: true, farLess: true });
  } },
  { name: '擊毀帥／將即獲勝', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => { const [rk, K] = T_.place([{ s: 0, t: 'R', c: 4, r: 4 }, { s: 1, t: 'K', c: 4, r: 0, hp: 1 }]); T_.fire(rk, K); return winner; });
    t.assert.strictEqual(r, 0);
  } },
  { name: '和局：雙方都沒有能過河的棋子（只剩帥／仕／象）；還有兵就不算', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; T_.place([{ s: 0, t: 'E', c: 2, r: 9 }, { s: 1, t: 'G', c: 3, r: 0 }]); checkWin(); o.draw = winner;
      T_.place([{ s: 0, t: 'E', c: 2, r: 9 }, { s: 1, t: 'P', c: 3, r: 3 }]); checkWin(); o.pawn = winner; return o;
    });
    t.assert.deepStrictEqual(r, { draw: 2, pawn: null });
  } },
  { name: '戰地醫療：每回合只治療範圍內血量最少的一位', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const [e, g, p] = T_.place([{ s: 0, t: 'E', c: 2, r: 9 }, { s: 0, t: 'G', c: 3, r: 9, hp: 2 }, { s: 0, t: 'P', c: 1, r: 9, hp: 1 }]);
      applyCard(0, 'e_heal'); healPhase(0); return { g: g.hp, p: p.hp };
    });
    t.assert.deepStrictEqual(r, { g: 2, p: 1.5 });
  } },
  { name: '強化卡牌：不可疊加、只影響自己這一方、卡表格式正確', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      cardCount = [{}, {}]; mods = [{}, {}]; rebuildAll();
      const o = {}; applyCard(0, 'r_dmg'); o.again = cardOk(cardOf('r_dmg'), 0); o.mine = TT[0].R.dmg; o.theirs = TT[1].R.dmg;
      const offers = drawOffers(0); o.offers = offers.length <= 3 && new Set(offers.map(c => c.id)).size === offers.length && offers.every(c => c.id !== 'r_dmg');
      o.table = CARDS.length > 0 && new Set(CARDS.map(c => c.id)).size === CARDS.length && CARDS.every(c => c.id && c.name && c.ic && c.max >= 1);
      return o;
    });
    t.assert.deepStrictEqual(r, { again: false, mine: 2.5, theirs: 2, offers: true, table: true });
  } },
  { name: '取消移動：棋子退回原位（含升官還原），按鈕與狀態恢復', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const [p] = T_.place([{ s: 0, t: 'P', c: 2, r: 5 }]); const x0 = p.x, y0 = p.y;
      const st = T_.go(p, 2, 4); const o = { st, shown: !document.getElementById('undo').hidden, promoted: p.T.id === 'P2' };
      undoMove(); o.back = p.x === x0 && p.y === y0; o.T = p.T.id; o.hp = p.hp; o.state = state; o.moved = moved; o.hidden = document.getElementById('undo').hidden; return o;
    });
    t.assert.deepStrictEqual(r, { st: 'target', shown: true, promoted: true, back: true, T: 'P', hp: 2, state: 'aim', moved: false, hidden: true });
  } },
  { name: '電腦：各難度都能選出合法行動', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => { mySide = 0; const out = []; for (const L of [1, 2, 3, 4, 5]) { const a = aiChoose(1, L); out.push(!!a && a.p.s === 1); } return out; });
    t.assert.deepStrictEqual(r, [true, true, true, true, true]);
  } },
];
