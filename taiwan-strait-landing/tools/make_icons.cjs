// 由 icons/icon.svg、icons/icon-maskable.svg 輸出各尺寸 PNG：node taiwan-strait-landing/tools/make_icons.cjs
// 需要 playwright（chromium）。改圖示時先改 SVG，再執行這支。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = path.resolve(__dirname, '..', 'icons');
const jobs = [['icon.svg', 'icon-192.png', 192], ['icon.svg', 'icon-512.png', 512], ['icon-maskable.svg', 'icon-maskable-512.png', 512], ['icon.svg', 'apple-touch-icon.png', 180]];
(async () => {
  const b = await chromium.launch();
  for (const [src, out, size] of jobs) {
    const svg = fs.readFileSync(path.join(dir, src), 'utf8').replace('width="512" height="512"', `width="${size}" height="${size}"`);
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<body style="margin:0">${svg}</body>`);
    await p.screenshot({ path: path.join(dir, out) });
    await p.close();
    console.log(out, size);
  }
  await b.close();
})();
