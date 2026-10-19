// 測試共用工具：靜態伺服器、Playwright 載入
const http = require('http'), fs = require('fs'), path = require('path');

function loadPlaywright() {
  for (const p of ['playwright', '@playwright/test', '/opt/node-tools/node_modules/playwright'])
    try { return require(p); } catch (e) { /* 試下一個 */ }
  throw new Error('找不到 playwright：請先安裝（npm i playwright），或設定 NODE_PATH');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
// 以 games/ 為根目錄提供靜態檔案（連 proto-b.html 轉址也能測）
function serve(root = path.resolve(__dirname, '..', '..')) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, base: `http://127.0.0.1:${srv.address().port}` })));
}

module.exports = { loadPlaywright, serve };
