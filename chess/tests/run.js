#!/usr/bin/env node
// 執行 chess/tests 下所有 *.test.js：node chess/tests/run.js [名稱關鍵字]
// 需要 Playwright（含 Chromium）。每個測試開一個新頁面；頁面出現 JS 錯誤或檔案 404 會自動判為失敗。
const fs = require('fs'), path = require('path'), assert = require('assert');
const { loadPlaywright, serve, HELPER } = require('./lib');

(async () => {
  const filter = process.argv[2];
  const { chromium } = loadPlaywright();
  const { srv, base } = await serve();
  const browser = await chromium.launch();
  const tests = [];
  for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort())
    for (const t of require(path.join(__dirname, f))) tests.push({ file: f, ...t });
  let pass = 0, fail = 0; const failed = [];
  for (const t of tests) {
    if (filter && !(t.file + ' ' + t.name).includes(filter)) continue;
    const ctx = await browser.newContext({ viewport: { width: 420, height: 820 } }), pages = [], errs = [];
    const env = {
      base, browser, ctx, assert,
      // 開啟遊戲頁面（預設 cards=0、同裝置並排模式）。opts.freeze（預設 true）會停掉自動動畫迴圈，改由測試手動推進時間，結果才穩定
      async open(params = '', opts = {}) {
        const pg = await ctx.newPage(); pages.push(pg);
        pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
        pg.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
        if (!/(^|&)cards=/.test(params)) params = ('cards=0&' + params).replace(/&$/, '');   // 預設關閉強化卡牌，免得每次都要先選牌
        await pg.goto(`${base}/chess/index.html?nolog=1&${params}`);
        if (opts.mode !== false) await pg.click('#mLocal');
        if (opts.freeze !== false) { await pg.evaluate(() => { window.loop = () => {}; }); await pg.waitForTimeout(60); }
        await pg.evaluate(HELPER);
        return pg;
      },
    };
    const t0 = Date.now();
    try {
      await t.fn(env);
      if (errs.length) throw new Error('頁面錯誤：' + errs.join(' | '));
      pass++; console.log(`  ✓ ${t.file.replace('.test.js', '')} › ${t.name}  (${Date.now() - t0} ms)`);
    } catch (e) {
      fail++; failed.push(t); console.log(`  ✗ ${t.file.replace('.test.js', '')} › ${t.name}\n      ${String(e.message).split('\n').join('\n      ')}`);
    }
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`\n${fail ? '失敗' : '全部通過'}：${pass} 通過、${fail} 失敗`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
