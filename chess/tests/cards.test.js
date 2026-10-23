// 強化卡牌 v2：等級（普通→終極魔法）、敵方減益、減傷、終極魔法、選牌間隔設定
const fresh = pg => pg.evaluate(() => { cardCount = [{}, {}]; mods = [{}, {}]; immune = [0, 0]; extraTurn = [0, 0]; rebuildAll(); });
module.exports = [
  { name: '卡牌表：四個等級都有牌；敵方減益卡都有說明；終極魔法都是即時效果', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => ({ tiers: [1, 2, 3, 4].map(n => CARDS.filter(c => tierOf(c) === n).length), foeNoDesc: CARDS.filter(c => c.foe && !c.desc).length, ultNotInstant: CARDS.filter(c => tierOf(c) === 4 && !c.instant).length, total: CARDS.length }));
    t.assert.ok(r.tiers.every(n => n >= 4), '每個等級至少 4 張：' + r.tiers); t.assert.deepStrictEqual([r.foeNoDesc, r.ultNotInstant], [0, 0]); t.assert.ok(r.total >= 44);   // 45 張，扣掉暫時停用的「象・生生不息」
  } },
  { name: '選牌等級：第 1 次只有普通卡；越後面越瘋狂，終極魔法一次最多一張、三張不重複', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; cardCount = [{}, {}];
      o.first = Array.from({ length: 200 }, () => drawOffers(0)).every(of => of.length === 3 && of.every(c => tierOf(c) === 1));
      const take = n => { cardCount[0] = {}; for (let i = 0; i < n; i++) cardCount[0]['fake' + i] = 1; };   // 假裝已選過 n 張（不影響卡池）
      const stat = n => { take(n); let ult = 0, t3 = 0, bad = 0; for (let i = 0; i < 300; i++) { const of = drawOffers(0); if (of.filter(c => tierOf(c) === 4).length > 1 || new Set(of.map(c => c.id)).size !== of.length || of.length > 3) bad++; ult += of.filter(c => tierOf(c) === 4).length; t3 += of.filter(c => tierOf(c) === 3).length; } return { ult, t3, bad }; };
      o.early = stat(2); o.mid = stat(3); o.late = stat(6);
      return o;
    });
    t.assert.ok(r.first, '第 1 次選牌出現了非普通卡'); t.assert.strictEqual(r.early.ult, 0, '第 3 次選牌前不該有終極魔法');
    t.assert.ok(r.late.ult > r.mid.ult && r.late.t3 > r.early.t3, '後期應該更瘋狂 ' + JSON.stringify(r)); t.assert.deepStrictEqual([r.early.bad, r.mid.bad, r.late.bad], [0, 0, 0]);
  } },
  { name: '敵方減益：只削弱對手、有下限；血量上限被削時現有血量跟著降', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      T_.place([{ s: 0, t: 'R', c: 4, r: 6 }, { s: 1, t: 'R', c: 4, r: 3 }, { s: 1, t: 'E', c: 2, r: 0 }, { s: 1, t: 'P', c: 0, r: 3 }]); const o = {};
      cardCount = [{}, {}]; mods = [{}, {}]; rebuildAll();
      const foeR = pieces.find(p => p.s === 1 && p.t === 'R'); foeR.hp = 4;
      applyCard(0, 'foe_dmg'); o.dmg = [TT[0].R.dmg, TT[1].R.dmg];
      applyCard(0, 'foe_hp'); o.hpMax = [TT[0].R.hp, TT[1].R.hp]; o.hpNow = foeR.hp;
      applyCard(0, 'foe_reload'); o.reload = [TT[0].R.reload, TT[1].R.reload];
      applyCard(0, 'foe_aa'); o.aa = [TT[0].E.aa / C, TT[1].E.aa / C];
      mods[1].R.dmg = -50; buildTypes(1); o.floor = TT[1].R.dmg;   // 下限 ¼ 心
      return o;
    });
    t.assert.deepStrictEqual(r, { dmg: [2, 1.5], hpMax: [4, 3], hpNow: 3, reload: [1, 2], aa: [2.5, 1], floor: 0.25 });
  } },
  { name: '減傷：防彈衣＋鈦合金每次少受傷，但至少受 ¼ 心；神之護盾期間完全免疫', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const [a, b] = T_.place([{ s: 1, t: 'R', c: 4, r: 3 }, { s: 0, t: 'N', c: 4, r: 6 }]); const o = {};
      cardCount = [{}, {}]; mods = [{}, {}]; rebuildAll();
      applyCard(0, 'armor1'); o.one = effDmg(b, 2); o.min = effDmg(b, 0.25);
      applyCard(0, 'armor2'); o.two = effDmg(b, 2);
      const hp = b.hp; T_.fire(a, b); o.real = hp - b.hp;
      applyCard(0, 'ult_shield'); const hp2 = b.hp; T_.fire(a, b); o.shield = hp2 - b.hp; o.imm = immune.join();
      turn = 1; state = 'fire'; endTurn(); o.after = immune.join();   // 對手（黑）的回合結束，護盾失效
      return o;
    });
    t.assert.deepStrictEqual(r, { one: 1.75, min: 0.25, two: 1.5, real: 1.5, shield: 0, imm: '1,0', after: '0,0' });
  } },
  { name: '終極魔法：天雷審判（帥不會被直接打死）、冰封世界', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; const setup = () => { const ps = T_.place([{ s: 1, t: 'K', c: 4, r: 0, hp: 1 }, { s: 1, t: 'R', c: 0, r: 0 }, { s: 1, t: 'P', c: 0, r: 3, hp: 1 }, { s: 1, t: 'N', c: 1, r: 0 }, { s: 1, t: 'E', c: 2, r: 0 }, { s: 0, t: 'K', c: 4, r: 9 }]); cardCount = [{}, {}]; mods = [{}, {}]; rebuildAll(); immune = [0, 0]; return ps; };
      let [K] = setup(); K.hp = 3; applyCard(0, 'ult_judge'); o.judge = K.hp; K.hp = 1; applyCard(0, 'ult_judge'); o.judgeLow = [K.hp, winner];
      const ps = setup(); applyCard(0, 'ult_freeze'); o.freeze = ps.slice(0, 5).map(p => p.cd).join();   // K R P N E
      return o;
    });
    t.assert.deepStrictEqual(r, { judge: 1.5, judgeLow: [0.25, null], freeze: '0,2,0,2,2' });
  } },
  { name: '隕石雨：選直徑 4 格的圓形範圍，範圍內敵我不分各受 1 心（帥也會死；雙帥同死和局）；電腦自動選落點；點棋盤選落點、按「降下」才生效', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}, land = () => { for (let i = 0; i < 200; i++) update(0.03); };
      let [bk, br, bp, rr] = T_.place([{ s: 1, t: 'K', c: 4, r: 0 }, { s: 1, t: 'R', c: 0, r: 0 }, { s: 1, t: 'P', c: 0, r: 3, hp: 1 }, { s: 0, t: 'R', c: 1, r: 1 }]);
      applyCard(0, 'ult_meteor', { x: T_.X(0), y: T_.Y(1) }); land();   // 圓心 (0,1)，半徑 2 格：黑俥、黑兵、紅俥在範圍內，黑帥在範圍外
      o.area = [br.hp, bp.hp, rr.hp, bk.hp, winner];
      [bk, br, bp, rr] = T_.place([{ s: 1, t: 'K', c: 4, r: 0 }, { s: 1, t: 'R', c: 0, r: 0 }, { s: 1, t: 'P', c: 0, r: 3, hp: 1 }, { s: 0, t: 'R', c: 1, r: 1 }]); immune = [1, 0];
      applyCard(0, 'ult_meteor', { x: T_.X(0), y: T_.Y(1) }); land(); o.shield = [br.hp, rr.hp]; immune = [0, 0];   // 我方有護盾：只傷到敵人（我方紅俥維持 4 心）
      let [rk, k2] = T_.place([{ s: 0, t: 'K', c: 4, r: 9, hp: 1 }, { s: 1, t: 'K', c: 4, r: 8, hp: 1 }, { s: 1, t: 'R', c: 0, r: 0 }]);
      applyCard(0, 'ult_meteor', { x: T_.X(4), y: T_.Y(9) }); land(); o.bothKings = winner;   // 雙帥同死：和局
      [rk, k2] = T_.place([{ s: 0, t: 'K', c: 4, r: 9 }, { s: 1, t: 'K', c: 4, r: 0, hp: 1 }]);
      applyCard(0, 'ult_meteor', { x: T_.X(4), y: T_.Y(0) }); land(); o.enemyKing = winner;   // 只打死敵帥：我方獲勝
      T_.place([{ s: 0, t: 'K', c: 4, r: 9 }, { s: 1, t: 'K', c: 4, r: 0 }, { s: 1, t: 'R', c: 0, r: 2 }, { s: 1, t: 'N', c: 1, r: 2 }]);
      const c = aiMeteorCenter(0); o.ai = meteorHits(c.x, c.y).map(p => p.s + p.t).sort().join();   // 電腦選的圓心罩住價值最高的敵方帥（比俥＋傌更划算）、不傷自己
      // 玩家操作：選到卡 → 點棋盤 → 按「降下」
      [bk, br, bp, rr] = T_.place([{ s: 1, t: 'K', c: 4, r: 0 }, { s: 1, t: 'R', c: 0, r: 0 }, { s: 1, t: 'P', c: 0, r: 3, hp: 1 }, { s: 0, t: 'R', c: 1, r: 1 }]);
      mode = 'local'; pickSide = 0; pickQ = []; chooseCard(0, 'ult_meteor');
      o.ui1 = [state, !$('spellBox').hidden, $('spellGo').disabled, br.hp];
      spellTap({ x: T_.X(0) + 5, y: T_.Y(1) - 4 }); o.ui2 = [spell.x === T_.X(0), spell.y === T_.Y(1), $('spellGo').disabled, $('spellTxt').textContent];
      $('spellGo').click(); o.ui3 = [state !== 'spell', $('spellBox').hidden, br.hp]; land(); o.ui4 = [br.hp, bp.hp, rr.hp];
      return o;
    });
    t.assert.deepStrictEqual(r, {
      area: [3, 0, 3, 3, null], shield: [3, 4], bothKings: 2, enemyKing: 0, ai: '1K',
      ui1: ['spell', true, true, 4], ui2: [true, true, false, '範圍內：敵 2 顆、我 1 顆'], ui3: [true, true, 3], ui4: [3, 0, 3],
    });
  } },
  { name: '隕石雨：連線時對手收到的落點座標一起套用；選落點時 2D、3D 預覽繪製不出錯', async fn(t) {
    const pg = await t.open('view=3d'), errs = [];
    pg.on('pageerror', e => errs.push(String(e)));
    const r = await pg.evaluate(() => {
      const o = {}, land = () => { for (let i = 0; i < 200; i++) update(0.03); };
      let [bk, br, bp, rr] = T_.place([{ s: 1, t: 'K', c: 4, r: 0 }, { s: 1, t: 'R', c: 0, r: 0 }, { s: 1, t: 'P', c: 0, r: 3, hp: 1 }, { s: 0, t: 'R', c: 1, r: 1 }]);
      mode = 'online'; mySide = 1; pickSide = null; pickQ = []; waitingFor = 0; incoming = [];   // 我是黑方，等紅方選牌
      onNet({ t: 'card', side: 0, id: 'ult_meteor', x: T_.X(0), y: T_.Y(1) }); land();
      o.remote = [br.hp, bp.hp, rr.hp];
      [bk, br, bp, rr] = T_.place([{ s: 1, t: 'K', c: 4, r: 0 }, { s: 1, t: 'R', c: 0, r: 0 }, { s: 0, t: 'R', c: 1, r: 1 }]);
      mode = 'local'; pickSide = 0; pickQ = []; chooseCard(0, 'ult_meteor'); spellTap({ x: T_.X(0), y: T_.Y(1) });
      try { for (let i = 0; i < 5; i++) draw(); o.draw3d = 'ok'; } catch (e) { o.draw3d = 'ERR ' + e.message; }
      return o;
    });
    t.assert.deepStrictEqual(r, { remote: [3, 0, 3], draw3d: 'ok' });
    t.assert.deepStrictEqual(errs, []);
  } },
  { name: '終極魔法：起死回生（只在有陣亡棋子時出現、只復活 1 顆、回到出生點）、時間暫停（再走一回合）', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; cardCount = [{}, {}]; mods = [{}, {}]; rebuildAll(); immune = [0, 0]; extraTurn = [0, 0];
      const rv = CARDS.find(c => c.id === 'ult_revive'); o.noDead = rv.cond(0);
      const rook = pieces.find(p => p.s === 0 && p.t === 'R'), pawn = pieces.find(p => p.s === 0 && p.t === 'P'), horse = pieces.find(p => p.s === 0 && p.t === 'N');
      for (const p of [rook, pawn, horse]) { p.hp = 0; p.x = p.y = -999; }
      o.hasDead = rv.cond(0); applyCard(0, 'ult_revive');
      o.revived = [rook, horse, pawn].map(p => p.hp > 0 && p.x === p.hx && p.y === p.hy);   // 沒指定（電腦）：只復活價值最高的 1 顆（俥）
      turn = 0; state = 'fire'; applyCard(0, 'ult_time'); o.xt = extraTurn[0];
      endTurn(); o.afterFirst = [turn, extraTurn[0], state]; state = 'fire'; endTurn(); o.afterSecond = turn;
      return o;
    });
    t.assert.deepStrictEqual(r, { noDead: false, hasDead: true, revived: [true, false, false], xt: 1, afterFirst: [0, 0, 'aim'], afterSecond: 1 });
  } },
  { name: '選卡限時 15 秒：倒數顯示、時間到隨機送一張；抽到隕石雨／起死回生也一併自動選完；等待方看得到對手倒數；不影響電腦', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(async () => {
      const o = {}, wait = ms => new Promise(r => setTimeout(r, ms)), total = () => cardCount[0] && Object.keys(cardCount[0]).length;
      const expire = async () => { pickEnd = Date.now() - 1; await wait(450); };
      // 1. 三選一：倒數 15 秒、時間到隨機送一張並進入下一步
      reset(true); mode = 'local'; cardsOn = true; beginPick([0]);
      o.start = [state, !$('cardPick').hidden, document.getElementById('cardTimer').textContent.includes('剩 15 秒') || document.getElementById('cardTimer').textContent.includes('剩 14 秒')];
      await expire(); o.timeout = [total(), $('cardPick').hidden, state !== 'pick'];
      // 2. 抽到隕石雨：時間到連落點一起自動選（選對自己最有利的圓心，敵方受傷）
      reset(true); mode = 'local'; cardsOn = true; const real = drawOffers; drawOffers = () => [CARDS.find(c => c.id === 'ult_meteor')];
      beginPick([0]); await expire(); const foeHurt = pieces.some(p => p.s === 1 && p.hp < p.T.hp);
      o.meteor = [cardCount[0].ult_meteor, foeHurt, $('spellBox').hidden, state !== 'spell' && state !== 'pick'];
      // 3. 抽到起死回生：時間到自動復活價值最高的那一顆
      reset(true); mode = 'local'; cardsOn = true; drawOffers = () => [CARDS.find(c => c.id === 'ult_revive')];
      for (const ty of ['R', 'N', 'P']) { const p = pieces.find(q => q.s === 0 && q.t === ty); p.hp = 0; p.x = p.y = -999; }
      beginPick([0]); const dead0 = pieces.filter(p => p.s === 0 && p.hp <= 0).length; await expire();
      o.revive = [dead0, pieces.filter(p => p.s === 0 && p.hp <= 0).length, pieces.find(p => p.s === 0 && p.t === 'R').hp > 0];
      drawOffers = real;
      // 4. 連線：等待方的訊息列顯示對手倒數；時間到不會自己選（由選卡那一方的裝置處理）
      reset(true); mode = 'online'; mySide = 1; cardsOn = true; incoming = []; beginPick([0]);
      o.wait = [waitingFor, document.getElementById('info').textContent];
      await expire(); o.waitDone = [total(), pickTimer === 0 || state === 'pick'];
      // 5. 電腦選牌不用倒數，照原本的延遲自己選
      reset(true); mode = 'ai'; mySide = 0; cardsOn = true; beginPick([1]); o.ai0 = pickTimer === 0; await wait(1300); o.ai1 = Object.keys(cardCount[1]).length;
      return o;
    });
    t.assert.deepStrictEqual(r.start, ['pick', true, true]);
    t.assert.deepStrictEqual(r.timeout, [1, true, true]);
    t.assert.deepStrictEqual(r.meteor, [1, true, true, true]);
    t.assert.deepStrictEqual(r.revive, [3, 2, true]);
    t.assert.strictEqual(r.wait[0], 0); t.assert.ok(/對手選卡中，剩 1[45] 秒/.test(r.wait[1]), r.wait[1]);
    t.assert.strictEqual(r.waitDone[0], 0, '等待方不該替對手選卡');
    t.assert.deepStrictEqual([r.ai0, r.ai1], [true, 1]);
  } },
  { name: '起死回生：玩家從陣亡清單選 1 顆復活（只有一顆就直接復活）；連線時選擇的編號一起傳給對方；亂傳的編號被忽略', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}, up = (...ps) => ps.map(p => p.hp > 0 && p.x === p.hx && p.y === p.hy);
      const setup = () => { reset(true);   // 全新開局，只讓紅方的一顆俥、一顆傌、一顆兵陣亡
        const ps = ['R', 'N', 'P'].map(t => pieces.find(p => p.s === 0 && p.t === t)); ps.forEach(p => { p.hp = 0; p.x = p.y = -999; }); return ps; };
      let [rook, horse, pawn] = setup();
      mode = 'local'; pickSide = 0; pickQ = []; chooseCard(0, 'ult_revive');
      const btns = [...document.querySelectorAll('#reviveList button')];
      o.list = [!document.getElementById('reviveOv').hidden, btns.map(b => b.querySelector('b').textContent)];   // 依價值排：俥、傌、兵
      btns[2].click(); o.chosen = [up(rook, horse, pawn).join(), document.getElementById('reviveOv').hidden];   // 選兵：只有兵復活
      [rook, horse, pawn] = setup(); pawn.hp = 1; pawn.x = pawn.hx; pawn.y = pawn.hy;   // 只剩俥、傌陣亡
      mode = 'local'; pickSide = 0; pickQ = []; chooseCard(0, 'ult_revive'); document.querySelectorAll('#reviveList button')[1].click();
      o.second = up(rook, horse).join();   // 選傌
      [rook, horse, pawn] = setup(); horse.hp = 3; horse.x = horse.hx; horse.y = horse.hy; pawn.hp = 2; pawn.x = pawn.hx; pawn.y = pawn.hy;   // 只有俥陣亡：不跳清單、直接復活
      mode = 'local'; pickSide = 0; pickQ = []; chooseCard(0, 'ult_revive'); o.single = [up(rook).join(), document.getElementById('reviveOv').hidden];
      // 連線：對手選了傌（編號隨選牌訊息傳來）；亂傳的編號（活著的棋子、不存在）改復活價值最高的
      [rook, horse, pawn] = setup(); mode = 'online'; mySide = 1; pickSide = null; pickQ = []; waitingFor = 0; incoming = [];
      onNet({ t: 'card', side: 0, id: 'ult_revive', i: pieces.indexOf(horse) }); o.remote = up(rook, horse, pawn).join();
      [rook, horse, pawn] = setup(); waitingFor = 0; incoming = [];
      onNet({ t: 'card', side: 0, id: 'ult_revive', i: 9999 }); o.bogus = up(rook, horse, pawn).join();
      return o;
    });
    t.assert.deepStrictEqual(r, { list: [true, ['俥', '傌', '兵']], chosen: ['false,false,true', true], second: 'false,true', single: ['true', true], remote: 'false,true,false', bogus: 'true,false,false' });
  } },
  { name: '連線同步：護盾與時間暫停隨局面快照同步；房主的選牌間隔會傳給對方', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      immune = [1, 0]; extraTurn = [0, 1]; const sn = JSON.parse(JSON.stringify(snapshot())); immune = [0, 0]; extraTurn = [0, 0]; applySnap(sn);
      const o = { im: immune.join(), xt: extraTurn.join() };
      cardEvery = 10; onNet({ t: 'cfg', cards: false, every: 5 }); o.every = cardEvery; return o;
    });
    t.assert.deepStrictEqual(r, { im: '1,0', xt: '0,1', every: 5 });
  } },
  { name: '選牌間隔設定：點一下切換並記住；每 N 個回合才觸發選牌', async fn(t) {
    const pg = await t.open('every=3&cards=1', { mode: false });
    t.assert.strictEqual(await pg.evaluate(() => cardEvery), 3);
    await pg.evaluate(() => { $('secCards').open = true; }); await pg.click('#mEvery');
    t.assert.strictEqual(await pg.evaluate(() => [cardEvery, localStorage.getItem('rc-every')].join()), '5,5');
    const r = await pg.evaluate(() => {
      $('lobby').hidden = true; reset(true); cardsOn = true; const o = {}; cardEvery = 3;
      turnsPlayed = [2, 0]; turn = 0; o.at2 = maybeTurnPick(); state = 'aim'; pickSide = null;
      turnsPlayed = [3, 0]; o.at3 = maybeTurnPick(); o.state = state; o.sub = $('cardSub').textContent;
      return o;
    });
    t.assert.deepStrictEqual([r.at2, r.at3, r.state], [false, true, 'pick']); t.assert.ok(/每 3 回合/.test(r.sub), r.sub);
  } },
  { name: '選牌畫面：顯示等級標籤；「我的強化」清單也有；終極魔法有金色樣式', async fn(t) {
    const pg = await t.open('cards=1', { mode: false });
    await pg.evaluate(() => { $('lobby').hidden = true; reset(true); cardsOn = true; cardCount[0] = { a: 1, b: 1, c: 1, d: 1, e: 1 }; beginPick([0]); });
    const r = await pg.evaluate(() => ({ btns: [...document.querySelectorAll('#cardList .cbtn')].map(b => b.className + '|' + (b.querySelector('i.tier') || {}).textContent) }));
    t.assert.strictEqual(r.btns.length, 3); t.assert.ok(r.btns.every(x => /^cbtn t[234]\|(★★|★★★|✨)/.test(x)), '後期選牌不該出現普通卡，且每張都要有等級標籤：' + r.btns.join(' ; '));
    const badge = await pg.evaluate(() => { cardsOn = true; cardCount[0] = {}; applyCard(0, 'ult_time'); showPerks(0); return [document.querySelector('#perkBody i.tier.t4') ? 1 : 0, getComputedStyle(document.querySelector('#perkBody i.tier')).backgroundImage !== 'none' ? 1 : 0].join(); });
    t.assert.strictEqual(badge, '1,1');
  } },
];
