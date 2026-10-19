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
  { name: '加到主畫面：manifest 與圖示齊全（尺寸正確），index.html 有連結', async fn(t) {
    const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8')), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    t.assert.strictEqual(m.name, '瘋狂象棋'); t.assert.ok(fs.existsSync(path.join(root, m.start_url)));
    for (const ic of m.icons) {
      const f = path.join(root, ic.src), b = fs.readFileSync(f), [w, h] = [b.readUInt32BE(16), b.readUInt32BE(20)];
      t.assert.strictEqual(b.slice(1, 4).toString(), 'PNG'); t.assert.strictEqual(`${w}x${h}`, ic.sizes, ic.src + ' 尺寸與 manifest 不符');
    }
    t.assert.ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512'));
    t.assert.ok(m.icons.some(i => i.purpose === 'maskable'), '缺 maskable 圖示');
    for (const must of ['rel="manifest"', 'rel="apple-touch-icon"', 'apple-mobile-web-app-capable']) t.assert.ok(html.includes(must), '缺 ' + must);
    t.assert.ok(fs.existsSync(path.join(root, 'icons/apple-touch-icon.png')));
  } },
  { name: '全螢幕按鈕：點一下進入、再點離開', async fn(t) {
    const pg = await t.open('', { mode: false });
    t.assert.strictEqual(await pg.evaluate(() => $('fsBtn').hidden), false);
    await pg.evaluate(() => { $('lobby').hidden = true; });
    await pg.click('#fsBtn'); await pg.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 });
    await pg.click('#fsBtn'); await pg.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 });
  } },
  { name: '加到主畫面按鈕：跳出說明（含平台步驟與可複製的連結）', async fn(t) {
    const pg = await t.open('', { mode: false });
    t.assert.strictEqual(await pg.evaluate(() => $('secMore').open), false);   // 預設收合
    await pg.click('#secMore > summary'); await pg.click('#mInstall');
    const r = await pg.evaluate(() => ({ open: !$('installOv').hidden, steps: $('instSteps').children.length, url: $('instUrl').textContent, expect: gameUrl() }));
    t.assert.ok(r.open && r.steps >= 2); t.assert.strictEqual(r.url, r.expect); t.assert.ok(/\/chess\/$/.test(r.url), '連結應指向 chess/：' + r.url);
    await pg.click('#instClose'); t.assert.strictEqual(await pg.evaluate(() => $('installOv').hidden), true);
  } },
  { name: '窄螢幕（360px）：上方按鈕列不會爆版（2D 與 3D）', async fn(t) {
    for (const view of ['2d', '3d']) {
      const pg = await t.ctx.newPage(); await pg.setViewportSize({ width: 360, height: 700 });
      await pg.goto(`${t.base}/chess/index.html?nolog=1&cards=0&view=${view}`); await pg.waitForTimeout(view === '3d' ? 1500 : 300); await pg.click('#mLocal');
      const r = await pg.evaluate(() => { const h = document.querySelector('header'); return { over: document.documentElement.scrollWidth - window.innerWidth, hdr: h.scrollWidth - h.clientWidth }; });
      t.assert.ok(r.over <= 0 && r.hdr <= 0, `${view} 版面溢出：${JSON.stringify(r)}`); await pg.close();
    }
  } },
  { name: '開始畫面：不常用的區塊預設收合，常用按鈕都在畫面內；小螢幕也不超出一頁', async fn(t) {
    for (const [w, h] of [[360, 640], [390, 700]]) {
      const pg = await t.ctx.newPage(); await pg.setViewportSize({ width: w, height: h });
      await pg.goto(`${t.base}/chess/index.html?nolog=1&cards=0&view=2d`); await pg.waitForTimeout(300);
      const r = await pg.evaluate(() => {
        const box = document.querySelector('#lobby .box'), vh = innerHeight, inView = id => { const b = $(id).getBoundingClientRect(); return b.top >= 0 && b.bottom <= vh; };
        return { closed: ['secNet', 'secCards', 'secView', 'secMore'].every(id => !$(id).open), main: ['mCards', 'mLocal', 'mFace', 'mRestart', 'mClose'].every(inView), lv: [...document.querySelectorAll('[data-lv]')].every(b => { const r = b.getBoundingClientRect(); return r.bottom <= vh; }), fit: box.scrollHeight <= box.clientHeight };
      });
      t.assert.deepStrictEqual(r, { closed: true, main: true, lv: true, fit: true }, `${w}x${h} ` + JSON.stringify(r)); await pg.close();
    }
  } },
  { name: '開始畫面：全部展開時可捲動，關閉鈕固定在最上方仍點得到', async fn(t) {
    const pg = await t.ctx.newPage(); await pg.setViewportSize({ width: 360, height: 560 });
    await pg.goto(`${t.base}/chess/index.html?nolog=1&cards=0&view=2d`); await pg.waitForTimeout(300);
    await pg.evaluate(() => document.querySelectorAll('#lobby details').forEach(d => { d.open = true; }));
    const r = await pg.evaluate(() => { const b = document.querySelector('#lobby .box'); b.scrollTop = b.scrollHeight; const c = $('mClose').getBoundingClientRect(); return { scrolls: b.scrollHeight > b.clientHeight, closeVisible: c.top >= 0 && c.bottom <= innerHeight, last: $('ver').getBoundingClientRect().bottom <= innerHeight }; });
    t.assert.deepStrictEqual(r, { scrolls: true, closeVisible: true, last: true });
    await pg.click('#mClose'); t.assert.strictEqual(await pg.evaluate(() => $('lobby').hidden), true); await pg.close();
  } },
  { name: '連結帶房號（?room=）時自動展開「兩台裝置連線」', async fn(t) {
    const pg = await t.ctx.newPage(); await pg.goto(`${t.base}/chess/index.html?nolog=1&cards=0&view=2d&room=1234`); await pg.waitForTimeout(400);
    t.assert.strictEqual(await pg.evaluate(() => $('secNet').open), true); await pg.close();
  } },
  { name: '趣味贊助按鈕：在「更多」裡、新分頁開啟、帶 noopener，且不在常用區', async fn(t) {
    const pg = await t.open('', { mode: false });
    const r = await pg.evaluate(() => { const a = $('mTip'); return { inMore: !!a.closest('#secMore'), target: a.target, rel: a.rel, https: a.href.startsWith('https://service.jkopay.com/'), amount50: new URL(a.href).searchParams.get('amount') === '50', hiddenByDefault: !$('secMore').open }; });
    t.assert.deepStrictEqual(r, { inMore: true, target: '_blank', rel: 'noopener noreferrer', https: true, amount50: true, hiddenByDefault: true });
  } },
  { name: '更新通知：偵測到新版本時顯示「有新版本」按鈕（開始畫面開著也點得到），版本相同時不顯示', async fn(t) {
    const pg = await t.open('', { mode: false });
    let ver = '2099-01-01.01';
    await pg.route('**/js/version.js?check=*', r => r.fulfill({ contentType: 'text/javascript', body: `const VERSION = '${ver}';` }));
    await pg.evaluate(() => checkUpdate()); t.assert.strictEqual(await pg.evaluate(() => $('newver').hidden), false, '有新版本卻沒顯示按鈕');
    const r = await pg.evaluate(() => { const b = $('newver').getBoundingClientRect(), top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return top === $('newver') || $('newver').contains(top); });
    t.assert.ok(r, '按鈕被開始畫面或其他元素蓋住');
    ver = await pg.evaluate(() => VERSION); await pg.evaluate(() => checkUpdate()); t.assert.strictEqual(await pg.evaluate(() => $('newver').hidden), true, '版本相同不該顯示');
    await pg.evaluate(() => { $('newver').hidden = false; }); await pg.evaluate(() => dispatchEvent(new Event('focus'))); await pg.waitForTimeout(300);
    t.assert.strictEqual(await pg.evaluate(() => $('newver').hidden), true, '切回分頁時應重新檢查');
  } },
  { name: '舊單檔版本的更新偵測：轉址頁含另一個版本字串，舊頁面才會提示更新', async fn(t) {
    const html = fs.readFileSync(path.join(root, '..', 'proto-b.html'), 'utf8'), m = html.match(/const VERSION = '([^']+)'/);
    t.assert.ok(m && m[1] !== fs.readFileSync(path.join(root, 'js/version.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1], '轉址頁要有版本字串');
  } },
  { name: '遊戲列表：瘋狂象棋是主卡片，早期原型預設收合', async fn(t) {
    const pg = await t.ctx.newPage(); await pg.goto(`${t.base}/index.html`);
    const r = await pg.evaluate(() => ({ feat: document.querySelector('a.feat').getAttribute('href'), old: document.querySelector('details.old').open, oldLinks: [...document.querySelectorAll('details.old a')].map(a => a.getAttribute('href')), visibleCards: [...document.querySelectorAll('a.card')].filter(a => a.checkVisibility()).length }));
    t.assert.deepStrictEqual(r, { feat: 'chess/index.html', old: false, oldLinks: ['proto-a.html', 'proto-c.html'], visibleCards: 1 }); await pg.close();
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
