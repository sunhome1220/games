// 整局回歸：隨機打完整局，檢查沒有錯誤、棋子都在交叉點上；連線模式兩邊局面不能不同步
const { chromium } = require('playwright');
const tap = async (pg, x, y) => {
  const [cx, cy] = await pg.evaluate(([x, y]) => { const r = cv.getBoundingClientRect(), k = r.width / W; if (viewFlip()) { x = W - x; y = H - y; } return [r.left + x * k, r.top + y * k]; }, [x, y]);
  await pg.mouse.click(cx, cy);
};
// 用真的點擊操作一個回合：隨機選棋、走位或原地開火，再選目標或不射擊
async function playTurn(pg, settle) {
  const pick = await pg.evaluate(() => {
    const mine = alive().filter(p => p.s === turn).map(p => ({ p, m: movesFor(p), a: scan(p).filter(t => t.ok) })).filter(o => o.m.length || o.a.length);
    const o = mine[Math.floor(Math.random() * mine.length)], k = alive().find(q => q.s !== turn && q.t === 'K');
    if (o.a.length && Math.random() < 0.5) return { sel: [o.p.x, o.p.y], atk: [o.a[0].p.x, o.a[0].p.y] };
    const m = o.m.length ? o.m.sort((u, v) => Math.hypot(u[0] - k.x, u[1] - k.y) - Math.hypot(v[0] - k.x, v[1] - k.y))[Math.floor(Math.random() * Math.min(3, o.m.length))] : null;
    return { sel: [o.p.x, o.p.y], mv: m, atk: !m && o.a.length ? [o.a[0].p.x, o.a[0].p.y] : null };
  });
  await tap(pg, ...pick.sel);
  if (pick.atk) await tap(pg, ...pick.atk); else { await tap(pg, ...pick.mv); if (!(await pg.evaluate(() => quick))) await pg.click('#fire'); }
  let s = await settle();
  if (s === 'target' || (Array.isArray(s) && s.includes('target'))) {
    const tg = await pg.evaluate(() => { const t = targets.find(t => t.ok); return t && [t.p.x, t.p.y]; });
    if (tg && Math.random() < 0.85) await tap(pg, ...tg); else await pg.click('#skip');
    await settle();
  }
}
const MAX_TURNS = process.env.FAST ? 30 : 150;   // FAST=1 只打 30 回合，快速檢查用

module.exports = [
  { name: '單機整局：隨機打到分出勝負（或 150 回合），棋子都在交叉點上', async fn(t) {
    const pg = await t.open('', { freeze: false });
    const settle = async () => { for (let i = 0; i < 150; i++) { await pg.waitForTimeout(60); const s = await pg.evaluate(() => state); if (!['moving', 'settle', 'fire'].includes(s)) return s; } throw new Error('動畫卡住'); };
    let n = 0; for (; n < MAX_TURNS && (await pg.evaluate(() => state)) !== 'over'; n++) await playTurn(pg, settle);
    const r = await pg.evaluate(() => ({ onGrid: alive().every(p => Number.isInteger((p.x - M) / C) && Number.isInteger((p.y - M) / C)), hasK: [0, 1].map(s => alive().some(p => p.s === s && p.t === 'K')) }));
    t.assert.ok(r.onGrid, '有棋子沒停在交叉點上');
    console.log(`      （${n} 回合，winner=${await pg.evaluate(() => winner)}）`);
  } },
  { name: '連線整局（BroadcastChannel 模擬）：每回合兩邊局面一致', async fn(t) {
    const room = 'room' + Date.now() % 100000, pgs = [];
    for (const s of [0, 1]) pgs.push(await t.open(`bc=${room}&side=${s}`, { mode: false, freeze: false }));
    let warns = 0; pgs.forEach(p => p.on('console', m => { if (m.text().includes('[連線]')) warns++; }));   // 正常對局不該出現任何「局面不同步」
    await pgs[0].waitForTimeout(400);
    await pgs[0].evaluate(() => { quick = true; }); await pgs[1].evaluate(() => { quick = false; });   // 一邊快速模式、一邊一般模式
    const settle = async () => { for (let i = 0; i < 600; i++) { await pgs[0].waitForTimeout(60); const st = await Promise.all(pgs.map(p => p.evaluate(() => state))); if (st.every(s => ['aim', 'over', 'target', 'wait', 'select'].includes(s))) return st; } throw new Error('動畫卡住'); };
    let mism = 0, n = 0;
    for (; n < MAX_TURNS; n++) {
      if ((await pgs[0].evaluate(() => state)) === 'over') break;
      const turn = await pgs[0].evaluate(() => turn);
      await playTurn(pgs[turn], settle); await pgs[0].waitForTimeout(250); await settle();
      const sn = await Promise.all(pgs.map(p => p.evaluate(() => JSON.stringify(snapshot()))));
      if (sn[0] !== sn[1]) mism++;
    }
    t.assert.strictEqual(mism, 0, `有 ${mism} 回合兩邊局面不一致`);
    t.assert.strictEqual(warns, 0, `正常對局出現了 ${warns} 次不同步修復`);
    console.log(`      （${n} 回合）`);
  } },
  { name: '連線：認輸兩邊同步（設定頁按鈕要連按兩次才生效）', async fn(t) {
    const room = 'resign' + Date.now() % 100000, pgs = [];
    for (const s of [0, 1]) pgs.push(await t.open(`bc=${room}&side=${s}`, { mode: false, freeze: false }));
    await pgs[0].waitForTimeout(600);
    await pgs[1].evaluate(() => { $('lobby').hidden = true; }); await pgs[1].click('#menu');
    await pgs[1].click('#mResign');   // 第一次只是「確認」
    t.assert.deepStrictEqual(await pgs[1].evaluate(() => [winner, $('mResign').textContent.includes('確定')]), [null, true]);
    await pgs[1].click('#mResign');
    await pgs[0].waitForFunction(() => state === 'over', null, { timeout: 30000 });
    const end = await Promise.all(pgs.map(p => p.evaluate(() => ({ state, winner, overReason }))));
    t.assert.deepStrictEqual(end, [{ state: 'over', winner: 0, overReason: 'resign' }, { state: 'over', winner: 0, overReason: 'resign' }]);
  } },
  { name: '連線：每回合限時，超時後等待方按「強制取消」，行動方這一步被取消並換人（房主的限時設定同步給對方）', async fn(t) {
    const room = 'clock' + Date.now() % 100000, pgs = [];
    for (const s of [0, 1]) pgs.push(await t.open(`bc=${room}&side=${s}&clock=${s ? 0 : 10}`, { mode: false, freeze: false }));
    await pgs[0].waitForTimeout(600);
    t.assert.deepStrictEqual(await Promise.all(pgs.map(p => p.evaluate(() => clockSec))), [10, 10]);
    await pgs[0].evaluate(() => { const p = pieces.find(q => q.s === 0 && q.t === 'R'); selectPiece(p); });   // 紅方選了棋子但沒動
    await Promise.all(pgs.map(p => p.evaluate(() => { clockLeft = 0; })));
    await pgs[1].waitForFunction(() => !$('forceBox').hidden, null, { timeout: 10000 });
    t.assert.strictEqual(await pgs[0].evaluate(() => $('forceBox').hidden), true, '行動方不該看到強制取消按鈕');
    await pgs[1].click('#forceBtn');
    await pgs[0].waitForFunction(() => turn === 1, null, { timeout: 30000 }); await pgs[1].waitForFunction(() => turn === 1, null, { timeout: 30000 });
    t.assert.deepStrictEqual(await Promise.all(pgs.map(p => p.evaluate(() => [turn, state]))), [[1, 'aim'], [1, 'aim']]);
  } },
  { name: '連線整局含強化卡牌（含隕石雨選落點）：兩邊局面一致，沒有觸發不同步修復', async fn(t) {
    const room = 'cards' + Date.now() % 100000, pgs = [];
    for (const s of [0, 1]) pgs.push(await t.open(`bc=${room}&side=${s}&cards=1&every=3`, { mode: false, freeze: false }));
    let warns = 0; pgs.forEach(p => p.on('console', m => { if (m.text().includes('[連線]')) warns++; }));
    await pgs[0].waitForTimeout(600);
    // 輪流處理選牌：選第一張；遇到要選範圍的卡（隕石雨）就點棋盤中央再按「降下」
    const picks = async () => {
      for (let k = 0; k < 400; k++) {
        const st = await Promise.all(pgs.map(p => p.evaluate(() => { const o = state; if (o === 'pick' && !$('cardPick').hidden) { $('cardList').children[0].click(); return 'picked'; } if (o === 'spell') { spellTap({ x: M + 4 * C, y: M + 4 * C }); $('spellGo').click(); return 'spelled'; } return o; })));
        if (st.every(s => ['aim', 'over', 'target', 'wait', 'select'].includes(s))) return;
        await pgs[0].waitForTimeout(60);
      }
      throw new Error('選牌卡住');
    };
    const settle = async () => { await picks(); for (let i = 0; i < 600; i++) { await pgs[0].waitForTimeout(60); const st = await Promise.all(pgs.map(p => p.evaluate(() => state))); if (st.every(s => ['aim', 'over', 'target', 'wait', 'select'].includes(s))) return st; } throw new Error('動畫卡住'); };
    let mism = 0, n = 0, cardsSeen = 0;
    await picks();
    for (; n < 24; n++) {
      if ((await pgs[0].evaluate(() => state)) === 'over') break;
      const turn = await pgs[0].evaluate(() => turn);
      await playTurn(pgs[turn], settle); await pgs[0].waitForTimeout(250); await settle();
      const sn = await Promise.all(pgs.map(p => p.evaluate(() => JSON.stringify([snapshot(), cardCount]))));
      if (sn[0] !== sn[1]) mism++;
    }
    cardsSeen = await pgs[0].evaluate(() => Object.keys(cardCount[0]).length + Object.keys(cardCount[1]).length);
    t.assert.strictEqual(mism, 0, `有 ${mism} 回合兩邊局面不一致`);
    t.assert.ok(cardsSeen >= 4, '應該選過幾次牌：' + cardsSeen);
    t.assert.strictEqual(warns, 0, `出現了 ${warns} 次不同步修復`);
  } },
  { name: '連線：局面雜湊對不上、訊息序號跳號時，自動要對方重傳完整局面並修復', async fn(t) {
    const room = 'sync' + Date.now() % 100000, pgs = [];
    for (const s of [0, 1]) pgs.push(await t.open(`bc=${room}&side=${s}&cards=0`, { mode: false, freeze: false }));
    await pgs[0].waitForTimeout(600);
    const settle = async () => { for (let i = 0; i < 600; i++) { await pgs[0].waitForTimeout(60); const st = await Promise.all(pgs.map(p => p.evaluate(() => state))); if (st.every(s => ['aim', 'over', 'target', 'wait', 'select'].includes(s))) return st; } throw new Error('動畫卡住'); };
    // 1. 黑方的強化卡牌紀錄被弄亂（快照裡沒有這項）：紅方走完一回合，黑方套用快照後雜湊對不上，應自動被修好
    await pgs[1].evaluate(() => { cardCount = [{ r_dmg: 1 }, {}]; });
    await playTurn(pgs[0], settle); await pgs[0].waitForTimeout(250); await settle();
    await pgs[1].waitForFunction(() => JSON.stringify(cardCount) === '[{},{}]', null, { timeout: 15000 });
    await pgs[0].waitForTimeout(1700);   // 修復要求有 1.5 秒節流，避免來回重傳
    // 2. 序號跳號：黑方的棋子血量被弄亂＋接收序號被改亂，紅方送任何訊息後黑方應重傳修復
    await pgs[1].evaluate(() => { pieces[0].hp = 0.1; recvN = 999; });
    await pgs[0].evaluate(() => send({ t: 'noop' }));
    await pgs[1].waitForFunction(() => pieces[0].hp !== 0.1, null, { timeout: 15000 });
    const h = await Promise.all(pgs.map(p => p.evaluate(() => stateHash())));
    t.assert.strictEqual(h[0], h[1], '修復後兩邊局面雜湊應一致');
  } },
  { name: '連線：取消移動（含升官空投）兩邊同步還原', async fn(t) {
    const room = 'undo' + Date.now() % 100000, pgs = [];
    for (const s of [0, 1]) pgs.push(await t.open(`bc=${room}&side=${s}`, { mode: false, freeze: false }));
    await pgs[0].waitForTimeout(400);
    const place = async pg => pg.evaluate(() => { const p = pieces.find(q => q.s === 0 && q.t === 'P'); p.x = M; p.y = M + 5 * C; return pieces.indexOf(p); });
    const i = await place(pgs[0]); await place(pgs[1]);
    await pgs[0].evaluate(i => { quick = false; const p = pieces[i]; selectPiece(p); const mv = sel.moves.find(([x, y]) => Math.abs(y - M - 4 * C) < 1); sel.dest = mv; go(mv); }, i);
    await pgs[0].waitForFunction(() => state === 'target', null, { timeout: 30000 }); await pgs[1].waitForFunction(() => state === 'wait', null, { timeout: 30000 });
    const mid = await Promise.all(pgs.map(p => p.evaluate(i => ({ state, T: pieces[i].T.id }), i)));
    await pgs[0].evaluate(() => undoMove()); await pgs[1].waitForFunction(i => pieces[i].T.id === 'P' && !fx.some(f => f.k === 'drop'), i, { timeout: 30000 });
    const end = await Promise.all(pgs.map(p => p.evaluate(i => ({ state, T: pieces[i].T.id, hp: pieces[i].hp, y: pieces[i].y, drops: fx.filter(f => f.k === 'drop').length }), i)));
    t.assert.deepStrictEqual(mid.map(m => m.T), ['P2', 'P2']);
    t.assert.deepStrictEqual(end.map(e => [e.T, e.hp, e.y, e.drops]), [['P', 2, 46 + 5 * 56, 0], ['P', 2, 46 + 5 * 56, 0]]);
    t.assert.deepStrictEqual([end[0].state, end[1].state], ['aim', 'wait']);
  } },
];
