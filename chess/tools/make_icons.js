#!/usr/bin/env node
// 產生 PWA／主畫面圖示（icons/*.png）：node chess/tools/make_icons.js   需要 Playwright
const path = require('path'), fs = require('fs');
let pw; for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) try { pw = require(p); break; } catch (e) {}
const out = path.resolve(__dirname, '..', 'icons');
const html = size => `<body style="margin:0"><canvas id=c width=${size} height=${size}></canvas><script>
const c=document.getElementById('c'),g=c.getContext('2d'),s=${size};
const bg=g.createLinearGradient(0,0,s,s); bg.addColorStop(0,'#5a4430'); bg.addColorStop(1,'#2b2118'); g.fillStyle=bg; g.fillRect(0,0,s,s);
g.strokeStyle='#e8c88a55'; g.lineWidth=s*0.006; for(let i=1;i<6;i++){g.beginPath();g.moveTo(s*i/6,0);g.lineTo(s*i/6,s);g.moveTo(0,s*i/6);g.lineTo(s,s*i/6);g.stroke();}
const r=s*0.34; g.fillStyle='#00000055'; g.beginPath(); g.arc(s/2+s*0.012,s/2+s*0.03,r,0,7); g.fill();
g.fillStyle='#f6e3b8'; g.beginPath(); g.arc(s/2,s/2,r,0,7); g.fill();
g.strokeStyle='#c0392b'; g.lineWidth=s*0.03; g.beginPath(); g.arc(s/2,s/2,r*0.93,0,7); g.stroke(); g.lineWidth=s*0.008; g.beginPath(); g.arc(s/2,s/2,r*0.8,0,7); g.stroke();
g.fillStyle='#c0392b'; g.font='bold '+s*0.4+'px "Noto Serif CJK TC","Noto Sans CJK TC",serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('瘋',s/2,s/2+s*0.02);
</script></body>`;
(async () => {
  const b = await pw.chromium.launch(); fs.mkdirSync(out, { recursive: true });
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const pg = await b.newPage({ viewport: { width: size, height: size } }); await pg.setContent(html(size)); await pg.waitForTimeout(200);
    await pg.locator('#c').screenshot({ path: path.join(out, name) }); await pg.close(); console.log('✓', name);
  }
  await b.close();
})();
