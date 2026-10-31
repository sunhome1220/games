// 電腦自打（不播動畫，一局約 0.2 秒）：收集「局面特徵 → 這一方最後有沒有贏」的資料，給 tools/fit_winrate.py 校準勝率權重（見 js/surrender.js 的 HINT_W）。
// 用法（在 games/ 目錄下）：node chess/tools/selfplay.js 場數 紅方難度,黑方難度 輸出檔.json　例：node chess/tools/selfplay.js 120 3,3 d_3,3.json
// 需要 playwright（NODE_PATH 指向已安裝處）與 Chromium。
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const N = +process.argv[2] || 3, LS = (process.argv[3] || '3,3').split(',').map(Number), out = process.argv[4] || '/tmp/sim.json';
const srv = http.createServer((q, r) => { let f = path.join(__dirname, '..', '..', decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; r.end(); } else { r.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html'); r.end(d); } }); }).listen(0, async () => {
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH ? process.env.PLAYWRIGHT_BROWSERS_PATH + '/chromium' : undefined, args: ['--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: 420, height: 800 } });
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto(`http://localhost:${srv.address().port}/chess/index.html?nolog=1&cards=0&view=2d${process.env.QS || ''}`);
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { window.loop = () => {}; });
  const data = [];
  for (let g = 0; g < N; g++) {
    const t0 = Date.now();
    const res = await pg.evaluate(async ([LS]) => {
      $('lobby').hidden = true; mode = 'ai'; aiLevel = LS[0]; mySide = 0; reset(true);
      const samples = []; let turns = 0;
      while (winner === null && turns < 150) {
        if (typeof sampleFeatures === 'function' && turns >= 4 && turns % 3 === 0) samples.push({ t: turns, side: turn, f: sampleFeatures(turn) });
        mySide = 1 - turn; aiLevel = LS[turn];   // 讓 aiSide() 指向目前行動的一方
        let guard = 0;
        const startTurn = turn, startPlayed = turnsPlayed[0] + turnsPlayed[1];
        while (winner === null && turnsPlayed[0] + turnsPlayed[1] === startPlayed && guard++ < 600) {
          if (state === 'aim') aiAct();
          else if (state === 'target' && moved) aiTarget();
          else update(0.05);
        }
        if (guard >= 600) return { stuck: true, turns };
        turns++;
      }
      return { winner, turns, samples };
    }, [LS]);
    console.log('game', g, res.stuck ? 'STUCK' : `winner=${res.winner} turns=${res.turns}`, (Date.now() - t0) + 'ms');
    if (!res.stuck) data.push(res);
  }
  fs.writeFileSync(out, JSON.stringify(data));
  await b.close(); srv.close();
});
