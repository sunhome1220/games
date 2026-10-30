// 測試共用工具：靜態伺服器、Playwright 載入、頁面內的擺棋／開火輔助函式
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

// 注入到頁面的輔助函式（在遊戲自己的全域環境裡執行，可直接用 pieces、TT、C、M…）
const HELPER = `
window.T_ = {
  X: c => M + c * C, Y: r => M + r * C,
  cell: p => [Math.round((p.x - M) / C), Math.round((p.y - M) / C)],
  // 清空棋盤再依 specs 擺棋：{ s 0紅/1黑, t 兵種, c 欄 0~8, r 列 0~9, id:'P2' 升官, hp, cd }；缺帥時自動補在九宮中央。回傳棋子（依 specs 順序）
  place(specs) {
    for (const p of pieces) { p.hp = 0; p.x = p.y = -999; p.cd = 0; p.vx = p.vy = 0; p.ox = p.oy = 0; p.T = TT[p.s][p.t]; p.cdFresh = false; p.rv = null; }
    const all = specs.slice();
    for (const s of [0, 1]) if (!specs.some(sp => sp.s === s && sp.t === 'K')) all.push({ s, t: 'K', c: 4, r: s ? 0 : 9 });
    const used = new Set(), out = [];
    for (const sp of all) {
      const p = pieces.find(q => q.s === sp.s && q.t === sp.t && !used.has(q)); used.add(p);
      p.T = sp.id === 'P2' ? TT[sp.s].P2 : TT[sp.s][sp.t];
      p.hp = sp.hp ?? p.T.hp; p.cd = sp.cd || 0; p.x = M + sp.c * C; p.y = M + sp.r * C;
      out.push(p);
    }
    winner = null; state = 'aim'; fx = []; targets = []; moved = false; sel = null; mover = null; turn = 0;
    return out;
  },
  // a 對 b 開火並把動畫跑完（不會結束回合），回傳訊息
  fire(a, b) {
    turn = a.s; mover = a; state = 'fire'; timer = 99; shoot(a, b);
    for (let i = 0; i < 600 && fx.length; i++) update(0.02);
    return document.getElementById('info').textContent;
  },
  // 在畫面上選棋、走到 (c,r)（一般模式），把動畫與吸附跑完；回傳最後的 state
  go(p, c, r) {
    quick = false; selectPiece(p);
    const mv = sel.moves.find(([x, y]) => Math.abs(x - M - c * C) < 1 && Math.abs(y - M - r * C) < 1);
    if (!mv) return 'no-move';
    sel.dest = mv; go(mv);
    for (let i = 0; i < 400 && (state === 'moving' || state === 'settle' || state === 'guard'); i++) update(0.02);
    for (let i = 0; i < 200 && fx.some(f => f.k === 'drop'); i++) update(0.02);
    return state;
  },
};
`;

module.exports = { loadPlaywright, serve, HELPER };
