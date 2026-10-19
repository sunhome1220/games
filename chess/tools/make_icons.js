#!/usr/bin/env node
// 產生 PWA／主畫面圖示（icons/*.png）：node chess/tools/make_icons.js   需要 Playwright（含 Chromium）
// 圖示是用遊戲同一套 Three.js 渲染的 3D 場景（tools/icon.html）：棋盤上的「瘋」字車形棋子，砲口噴火。
const path = require('path');
const { loadPlaywright, serve } = require('../tests/lib');
(async () => {
  const { chromium } = loadPlaywright(), { srv, base } = await serve();
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = path.resolve(__dirname, '..', 'icons');
  // maskable：內容縮小留出安全區，讓系統裁成圓形／圓角時不會切到棋子
  for (const [name, size, mask] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 1], ['apple-touch-icon.png', 180, 0]]) {
    const pg = await b.newPage({ viewport: { width: size, height: size } });
    pg.on('pageerror', e => { throw e; });
    await pg.goto(`${base}/chess/tools/icon.html?size=${size}&mask=${mask}`); await pg.waitForFunction(() => window.__done, null, { timeout: 20000 }); await pg.waitForTimeout(300);
    await pg.locator('#c').screenshot({ path: path.join(out, name) }); await pg.close(); console.log('✓', name);
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
