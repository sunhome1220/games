// 介面測試：開局選國、點選城池、出兵、結束回合後的攻城彈窗（攻方／守方）、說明、版面
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
module.exports = [
  { name: '開局：選國畫面有三個勢力；選蜀後進入遊戲，都城被選取並顯示面板', async fn(t) {
    const pg = await t.open('', { start: false });
    t.assert.strictEqual(await pg.evaluate(() => document.querySelectorAll('#startOv .pick').length), 3);
    await pg.click('.pick[data-f="shu"]');
    const r = await pg.evaluate(() => ({ hidden: $('startOv').hidden, sel: G.selected, player: G.player, panel: $('panel').textContent.includes('成都'), hud: $('hFac').textContent }));
    t.assert.deepStrictEqual([r.hidden, r.sel, r.player, r.panel], [true, 'chengdu', 'shu', true]); t.assert.ok(/蜀（你）3城/.test(r.hud), r.hud);
  } },
  { name: '點選地圖上的城池會選取；點空白處取消選取', async fn(t) {
    const pg = await t.open();
    const pos = id => pg.evaluate(id => { const c = cityById(id), r = cv.getBoundingClientRect(); return [r.left + c.x * r.width / MW, r.top + (c.y + 6) * r.height / MH]; }, id);
    await pg.mouse.click(...await pos('luoyang')); t.assert.strictEqual(await pg.evaluate(() => G.selected), 'luoyang');
    t.assert.ok(await pg.evaluate(() => $('panel').textContent.includes('曹操')), '面板應顯示守將');
    await pg.mouse.click(5, 5 + 140); await pg.evaluate(() => select(null)); t.assert.strictEqual(await pg.evaluate(() => G.selected), null);
  } },
  { name: '出兵：面板按「進攻」→ 拉桿決定兵力 → 出兵後城裡兵力減少、地圖上出現軍隊', async fn(t) {
    const pg = await t.open();
    await pg.evaluate(() => select('hanzhong'));
    const before = await pg.evaluate(() => cityById('hanzhong').troops);
    await pg.click('#panel button[data-act="send"][data-to="changan"]');
    t.assert.strictEqual(await pg.evaluate(() => $('sendOv').hidden), false);
    await pg.fill('#sendRange', '50'); await pg.evaluate(() => $('sendRange').dispatchEvent(new Event('input')));
    const n = await pg.evaluate(() => sendAmount()); t.assert.ok(n >= 200 && n <= 240, '兵力 ' + n);
    await pg.click('#sendOk');
    const r = await pg.evaluate(() => ({ armies: G.armies.length, left: cityById('hanzhong').troops, to: G.armies[0].to }));
    t.assert.deepStrictEqual([r.armies, r.to, Math.round(before - r.left) === n], [1, 'changan', true]);
  } },
  { name: '徵兵與修城牆：花金幣、按鈕在金幣不夠時停用', async fn(t) {
    const pg = await t.open();
    await pg.evaluate(() => { select('chengdu'); cityById('chengdu').troops = 500; cityById('chengdu').wall = 300; refresh(); });
    await pg.click('#panel button[data-act="recruit"]');
    t.assert.deepStrictEqual(await pg.evaluate(() => [cityById('chengdu').troops, G.factions.shu.gold]), [600, 220]);
    await pg.evaluate(() => { G.factions.shu.gold = 10; refresh(); });
    t.assert.strictEqual(await pg.evaluate(() => document.querySelector('#panel button[data-act="recruit"]').disabled), true);
  } },
  { name: '攻方：結束回合後兵臨城下 → 彈出攻城窗（四種攻城戰術）→ 選招 → 結果與克制說明 → 繼續', async fn(t) {
    const pg = await t.open();
    await pg.evaluate(() => { dispatch('hanzhong', 'changan', 300); });
    await pg.click('#btnEnd'); await pg.waitForSelector('#sgBtns button[data-k]', { timeout: 5000 });
    const r = await pg.evaluate(() => ({ title: $('sgTitle').textContent, keys: [...document.querySelectorAll('#sgBtns button')].map(b => b.dataset.k).join(), info: $('sgInfo').textContent }));
    t.assert.ok(/長安/.test(r.title) && r.keys === 'ram,ladder,fire,starve' && /攻方/.test(r.info), JSON.stringify(r));
    await pg.click('#sgBtns button[data-k="ram"]'); await pg.waitForSelector('#sgBtns button[data-k="ok"]');
    const res = await pg.evaluate(() => $('sgInfo').textContent); t.assert.ok(/衝車/.test(res) && /城牆 −/.test(res) && /(剋制|勢均力敵)/.test(res), res);
    await pg.click('#sgBtns button[data-k="ok"]'); await pg.waitForFunction(() => G.phase === 'player' && G.turn === 2, null, { timeout: 5000 });
    t.assert.strictEqual(await pg.evaluate(() => $('siegeOv').hidden), true);
  } },
  { name: '守方：電腦進攻玩家的城 → 彈出守城選項（箭雨／潑水…）→ 結算', async fn(t) {
    const pg = await t.open();
    await pg.evaluate(() => { const c = cityById('changan'); c.owner = 'wei'; c.troops = 700; dispatch('changan', 'hanzhong', 600); });
    await pg.click('#btnEnd'); await pg.waitForSelector('#sgBtns button[data-k]', { timeout: 5000 });
    const r = await pg.evaluate(() => ({ title: $('sgTitle').textContent, keys: [...document.querySelectorAll('#sgBtns button')].map(b => b.dataset.k).join(), info: $('sgInfo').textContent }));
    t.assert.ok(/漢中/.test(r.title) && r.keys === 'hold,arrow,sortie,water' && /守方/.test(r.info), JSON.stringify(r));
    await pg.click('#sgBtns button[data-k="water"]'); await pg.waitForSelector('#sgBtns button[data-k="ok"]'); await pg.click('#sgBtns button[data-k="ok"]');
    await pg.waitForFunction(() => G.phase === 'player', null, { timeout: 5000 });
  } },
  { name: '勝負：天下一統／國破家亡畫面，可以再玩一局', async fn(t) {
    const pg = await t.open();
    await pg.evaluate(() => { G.over = 'win'; showEnd(); });
    t.assert.ok(await pg.evaluate(() => !$('endOv').hidden && /天下一統/.test($('endTitle').textContent)));
    await pg.click('#endAgain'); t.assert.strictEqual(await pg.evaluate(() => $('startOv').hidden), false);
  } },
  { name: '玩法說明：顯示克制表（紅＝被剋制、綠＝剋制）', async fn(t) {
    const pg = await t.open();
    await pg.click('#btnHelp');
    const r = await pg.evaluate(() => ({ open: !$('helpOv').hidden, rows: document.querySelectorAll('#helpBox table tr').length, red: document.querySelectorAll('#helpBox td.k').length, green: document.querySelectorAll('#helpBox td.g').length }));
    t.assert.deepStrictEqual([r.open, r.rows], [true, 5]); t.assert.ok(r.red >= 4 && r.green >= 5, JSON.stringify(r));
  } },
  { name: '版面：窄螢幕（360×640）不橫向捲動，地圖、面板、結束回合鈕都在畫面內', async fn(t) {
    const pg = await t.ctx.newPage(); await pg.setViewportSize({ width: 360, height: 640 });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(`${t.base}/3kingdom/index.html?faction=shu&seed=1`); await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => { const w = innerWidth, h = innerHeight, b = id => document.getElementById(id).getBoundingClientRect(); return { over: document.documentElement.scrollWidth - w, endOk: b('btnEnd').right <= w && b('btnEnd').bottom <= h, map: b('map').right <= w + 1, panel: b('panel').bottom <= h + 1 && b('panel').height >= 60 }; });
    t.assert.deepStrictEqual(r, { over: 0, endOk: true, map: true, panel: true }); t.assert.deepStrictEqual(errs, []); await pg.close();
  } },
  { name: '版本：index.html 的 ?v= 與 version.js 一致、所有檔案都存在', async fn(t) {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), ver = fs.readFileSync(path.join(root, 'js/version.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];
    const srcs = [...html.matchAll(/<script src="([^"?]+)\?v=([^"]*)"/g)]; t.assert.ok(srcs.length >= 7);
    for (const [, f, v] of srcs) { t.assert.ok(fs.existsSync(path.join(root, f)), '缺檔案 ' + f); t.assert.strictEqual(v, ver, `${f} 的 ?v=${v} 與 VERSION ${ver} 不一致（請執行 tools/bump_version.py）`); }
  } },
];
