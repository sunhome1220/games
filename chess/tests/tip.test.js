// 玩滿 20／50 場的小提醒：各出現一次、可關閉、同一場只算一次、不會在新局中冒出來
const finishGame = pg => pg.evaluate(() => {   // 擺好局面讓紅方一擊擊毀黑將，並進入結束畫面
  const [rk, K] = T_.place([{ s: 0, t: 'R', c: 4, r: 4 }, { s: 1, t: 'K', c: 4, r: 0, hp: 1 }]); T_.fire(rk, K); state = 'fire'; endTurn(); return state;
});
async function openWith(t, games, seen = []) {
  const pg = await t.ctx.newPage();
  await pg.addInitScript(([g, s]) => { try { localStorage.setItem('rc-games', g); for (const k of s) localStorage.setItem(k, '1'); } catch (e) {} }, [String(games), seen]);
  pg.on('pageerror', e => { throw e; });
  await pg.goto(`${t.base}/chess/index.html?nolog=1&cards=0&view=2d`); await pg.click('#mLocal'); await pg.evaluate(() => { window.loop = () => {}; }); await pg.evaluate(require('./lib').HELPER);
  return pg;
}
module.exports = [
  { name: '小提醒：第 20 場結束後出現一次（有趣的文案、可關閉），之後的場次不再出現', async fn(t) {
    const pg = await openWith(t, 19);
    t.assert.strictEqual(await finishGame(pg), 'over');
    t.assert.strictEqual(await pg.evaluate(() => $('tipCard').hidden), true, '延遲前不該出現');
    await pg.waitForFunction(() => !$('tipCard').hidden, null, { timeout: 4000 });
    const r = await pg.evaluate(() => ({ txt: $('tipTxt').textContent, go: $('tipGo').textContent, href: new URL($('tipGo').href).searchParams.get('amount') === '50', n: localStorage.getItem('rc-games') }));
    t.assert.ok(/20 場/.test(r.txt) && /滷肉飯/.test(r.txt) && /關掉照樣能玩/.test(r.txt) && r.href && r.n === '20', JSON.stringify(r));
    await pg.click('#tipNo'); t.assert.strictEqual(await pg.evaluate(() => $('tipCard').hidden), true);
    await pg.evaluate(() => reset(true)); await finishGame(pg); await pg.waitForTimeout(2000);   // 第 21 場
    t.assert.strictEqual(await pg.evaluate(() => $('tipCard').hidden), true, '第 21 場不該再提醒'); await pg.close();
  } },
  { name: '小提醒：第 50 場出現第二則（超商咖啡）；已看過 20 場那則也不會重複', async fn(t) {
    const pg = await openWith(t, 49, ['rc-tip20']);
    await finishGame(pg); await pg.waitForFunction(() => !$('tipCard').hidden, null, { timeout: 4000 });
    const txt = await pg.evaluate(() => $('tipTxt').textContent);
    t.assert.ok(/很愛我們的遊戲/.test(txt) && /超商咖啡/.test(txt) && /更瘋狂/.test(txt) && /50 場/.test(txt), txt);
    await pg.close();
  } },
  { name: '小提醒：同一場只算一次；中途重開新局就不會冒出來；沒到 20 場不提醒', async fn(t) {
    const pg = await openWith(t, 5);
    await finishGame(pg); await pg.evaluate(() => { countGame(); countGame(); });
    t.assert.strictEqual(await pg.evaluate(() => localStorage.getItem('rc-games')), '6', '同一場被重複計算');
    await pg.close();
    const pg2 = await openWith(t, 19); await finishGame(pg2); await pg2.evaluate(() => reset(true)); await pg2.waitForTimeout(2000);
    t.assert.strictEqual(await pg2.evaluate(() => $('tipCard').hidden), true, '新局中不該跳出提醒');
    t.assert.strictEqual(await pg2.evaluate(() => localStorage.getItem('rc-tip20')), null, '沒顯示就不該標記為已看過'); await pg2.close();
  } },
];
