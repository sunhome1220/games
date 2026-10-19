// 網站結構：所有檔案載得到、版本號一致、舊網址會轉址、基本操作流程
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
module.exports = [
  { name: 'index.html 的 script／css 都存在，且 ?v= 與 version.js 的 VERSION 一致', async fn(t) {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), ver = fs.readFileSync(path.join(root, 'js/version.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];
    const srcs = [...html.matchAll(/<script src="([^"?]+)\?v=([^"]*)"/g)];
    t.assert.ok(srcs.length >= 10, '找不到 script 標籤');
    for (const [, f, v] of srcs) { t.assert.ok(fs.existsSync(path.join(root, f)), '缺檔案 ' + f); t.assert.strictEqual(v, ver, `${f} 的 ?v=${v} 與 VERSION ${ver} 不一致（請執行 tools/bump_version.py）`); }
    for (const [, f] of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) t.assert.ok(fs.existsSync(path.join(root, f)), '缺檔案 ' + f);
    t.assert.ok(fs.existsSync(path.join(root, 'vendor/peerjs.min.js')));
  } },
  { name: '更新內容（CHANGELOG）最新一筆就是目前的 VERSION', async fn(t) {
    const pg = await t.open();
    t.assert.strictEqual(await pg.evaluate(() => CHANGELOG[0].v === VERSION), true);
  } },
  { name: '舊網址 proto-b.html 會轉址到 chess/（保留參數）', async fn(t) {
    const pg = await t.ctx.newPage(); await pg.goto(`${t.base}/proto-b.html?room=1234`); await pg.waitForURL(/chess\/index\.html\?room=1234/, { timeout: 5000 }); await pg.close();
  } },
  { name: '操作流程：點選棋子 → 點綠點 → 出發 → 輪到黑方', async fn(t) {
    const pg = await t.open('', { freeze: false });
    const cl = (x, y) => pg.evaluate(([x, y]) => { const r = cv.getBoundingClientRect(), k = r.width / W; return [r.left + x * k, r.top + y * k]; }, [x, y]);
    const [px, py, mx, my] = await pg.evaluate(() => { const p = pieces.find(q => q.s === 0 && q.t === 'P'), m = movesFor(p)[0]; quick = false; return [p.x, p.y, m[0], m[1]]; });
    await pg.mouse.click(...await cl(px, py)); t.assert.strictEqual(await pg.evaluate(() => state), 'select');
    await pg.mouse.click(...await cl(mx, my)); await pg.click('#fire');
    for (let i = 0; i < 100 && (await pg.evaluate(() => turn)) === 0; i++) { await pg.waitForTimeout(60); if ((await pg.evaluate(() => state)) === 'target') await pg.click('#skip'); }
    t.assert.strictEqual(await pg.evaluate(() => turn), 1);
  } },
];
