// 頭像資料與載入測試
const path = require('path');
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
module.exports = [
  { name: '頭像資料：人物 id、檔名、圖片規格與生成紀錄都對得上', async fn(env) {
    const { check } = require(path.join(__dirname, '..', 'tools', 'portraits.js'));
    const { errs } = check();
    env.assert.deepStrictEqual(errs, []);
  } },
  { name: '頭像載入：審核通過的 PNG 會顯示，載入失敗時退回 SVG', async fn(env) {
    const pg = await env.open();
    await pg.route('**/assets/portraits/ok.png', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG1 }));
    await pg.route('**/assets/portraits/broken.png', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('not a png') }));
    // 沒有審核通過的圖片時用 SVG
    env.assert((await pg.evaluate(() => PORTRAITS.html('guanyu', 'default'))).startsWith('<svg'));
    const res = await pg.evaluate(async () => {
      PORTRAIT_ART.approvedFile = id => (id === 'guanyu' ? 'ok.png' : id === 'lubu' ? 'broken.png' : null);
      const box = document.createElement('div');
      box.innerHTML = PORTRAITS.html('guanyu', 'default', { name: '關羽' }) + PORTRAITS.html('lubu', 'default', { name: '呂布' });
      document.body.appendChild(box);
      await new Promise(r => setTimeout(r, 500));
      return { img: !!box.querySelector('img[data-gen="guanyu"]'), svg: box.querySelectorAll('svg').length, alt: box.querySelector('img').alt };
    });
    env.assert(res.img, '關羽應顯示 PNG'); env.assert.strictEqual(res.svg, 1, '呂布圖片壞掉應退回 SVG'); env.assert.strictEqual(res.alt, '關羽');
  } },
];
