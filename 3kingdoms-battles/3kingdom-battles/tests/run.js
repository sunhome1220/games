#!/usr/bin/env node
// 執行 3kingdom-battles/tests 下所有 *.test.js：node 3kingdom-battles/tests/run.js [名稱關鍵字]
// 需要 Playwright（含 Chromium）。每個測試開一個新頁面；頁面出現 JS 錯誤或檔案 404 會自動判為失敗。
const fs = require('fs'), path = require('path'), assert = require('assert');
const { loadPlaywright, serve } = require('./lib');

(async () => {
  const filter = process.argv[2];
  const { chromium } = loadPlaywright();
  const { srv, base } = await serve();
  // 無頭瀏覽器用軟體 WebGL（SwiftShader）畫 3D
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const tests = [];
  for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort())
    for (const t of require(path.join(__dirname, f))) tests.push({ file: f, ...t });
  let pass = 0, fail = 0;
  for (const t of tests) {
    if (filter && !(t.file + ' ' + t.name).includes(filter)) continue;
    const ctx = await browser.newContext({ viewport: { width: 420, height: 820 } }), errs = [];
    const env = {
      base, browser, ctx, assert,
      // 開啟遊戲頁面；params 例如 'sc=xiapi&side=att&seed=1&fast'
      async open(params = '') {
        const pg = await ctx.newPage();
        pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
        pg.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
        await pg.goto(`${base}/3kingdom-battles/index.html${params ? '?' + params : ''}`);
        await pg.waitForTimeout(300);
        return pg;
      },
      // 等到輪到玩家操作（途中出現事件視窗就按繼續）
      async myTurn(pg, ms = 30000) {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
          if (await pg.isVisible('#modal')) await pg.click('#modalBtns button');
          if (await pg.evaluate(() => { const u = window.G && RULES.activeUnit(G); return !!u && u.side === UI.side && !UI.busy; })) return;
          await pg.waitForTimeout(150);
        }
        throw new Error('等不到玩家回合');
      },
    };
    const t0 = Date.now();
    try {
      await t.fn(env);
      if (errs.length) throw new Error('頁面錯誤：' + errs.join(' | '));
      pass++; console.log(`  ✓ ${t.file.replace('.test.js', '')} › ${t.name}  (${Date.now() - t0} ms)`);
    } catch (e) {
      fail++; console.log(`  ✗ ${t.file.replace('.test.js', '')} › ${t.name}\n      ${String(e.message).split('\n').join('\n      ')}`);
    }
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`\n${fail ? '失敗' : '全部通過'}：${pass} 通過、${fail} 失敗`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
