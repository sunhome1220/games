// 線上大廳（房間清單）：用「假 PeerJS」（mockpeer.js）在多個分頁之間模擬配對，測試大廳主機推舉、房間報到／撤掉、主機離線接手、驗證與逾時
const MOCK = require('./mockpeer');
const open = async (t, params = '') => {
  const pg = await t.ctx.newPage(); pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  await pg.addInitScript(MOCK);
  await pg.goto(`${t.base}/chess/index.html?nolog=1&cards=0&view=2d&reg=300&${params}`);
  await pg.waitForTimeout(150);
  return pg;
};
const openNet = async pg => { await pg.evaluate(() => { document.getElementById('lobby').hidden = false; document.getElementById('secNet').open = true; }); };   // 打開「兩台裝置連線」區塊＝開始看大廳
const rows = pg => pg.evaluate(() => [...document.querySelectorAll('#roomList .roomRow')].map(r => r.textContent));

module.exports = [
  { name: '大廳主機端：房間報到、清單排序與欄位、驗證（房號格式、同一連線最多 3 間、被別人占用的房號、暱稱過濾）、逾時清除、連線中斷撤掉', async fn(t) {
    const pg = await t.open();
    const r = await pg.evaluate(() => {
      const o = {}; hubRooms = new Map();
      const fake = () => { const h = {}; const c = { on: (e, f) => { h[e] = f; }, send: m => { c.out = m; }, emit: (e, ...a) => h[e] && h[e](...a), out: null }; hubAccept(c); return c; };
      const a = fake(), b = fake();
      a.emit('data', { t: 'reg', room: { code: '1234', name: '<b>小明小明小明小明小明</b>', cards: 1, every: 5, clock: 15 } });
      b.emit('data', { t: 'reg', room: { code: '5678', name: '阿華', cards: false, every: 999, clock: 7 } });   // 非法的間隔／限時改回預設
      a.emit('data', { t: 'reg', room: { code: 'abcd', name: 'x' } }); a.emit('data', { t: 'reg', room: { code: '12345', name: 'x' } }); a.emit('data', 'garbage'); a.emit('data', null);
      b.emit('data', { t: 'reg', room: { code: '1234', name: '搶房號' } });   // 房號 1234 已被 a 占用
      for (const code of ['2001', '2002', '2003']) a.emit('data', { t: 'reg', room: { code } }); o.perConn = [...hubRooms.values()].filter(r => r.owner === a).length;   // 最多 3 間
      a.emit('data', { t: 'list' }); const L = a.out.list; o.codes = L.map(x => x.code).sort().join();
      const r1234 = L.find(x => x.code === '1234'), r5678 = L.find(x => x.code === '5678');
      o.fields = [r1234.name, r1234.cards, r1234.every, r1234.clock, r5678.cards, r5678.every, r5678.clock, typeof r1234.wait];
      // 逾時：25 秒沒報到的房間不再列出，掃描會清掉
      hubRooms.get('5678').ts -= 26000; o.stale = hubList().map(x => x.code).includes('5678'); hubSweep(); o.swept = !hubRooms.has('5678');
      // 房主撤掉 / 連線中斷時整批撤掉
      a.emit('data', { t: 'unreg', code: '2001' }); b.emit('data', { t: 'unreg', code: '1234' }); o.unreg = [hubRooms.has('2001'), hubRooms.get('1234').owner === a];   // 不能撤別人的房間
      a.emit('close'); o.afterClose = hubRooms.size;
      return o;
    });
    t.assert.deepStrictEqual(r, { perConn: 3, codes: '1234,2001,2002,5678', fields: ['b小明小明小明小', true, 5, 15, false, 10, 0, 'number'], stale: false, swept: true, unreg: [false, true], afterClose: 0 });
  } },
  { name: '大廳（假 PeerJS 多分頁）：第一個人成為主機；房主公開的房間出現在別人的清單；對手加入後自動撤掉；不公開的房間不會列出', async fn(t) {
    const viewer = await open(t, 'nick=' + encodeURIComponent('觀眾'));
    await openNet(viewer); await viewer.waitForFunction(() => lobbyState === 'hub', null, { timeout: 8000 });   // 沒人當主機，自己搶到
    t.assert.match(await viewer.evaluate(() => document.getElementById('roomList').textContent), /目前沒有人在等對手/);
    const host = await open(t, 'nick=' + encodeURIComponent('小明'));
    await openNet(host); await host.evaluate(() => document.getElementById('mHost').click());
    await host.waitForFunction(() => hostWaiting && lobbyState === 'online', null, { timeout: 8000 });   // 房主向主機報到
    await viewer.waitForFunction(() => document.querySelectorAll('#roomList .roomRow').length === 1, null, { timeout: 8000 });
    const row = (await rows(viewer))[0], code = await host.evaluate(() => roomCode);
    t.assert.ok(row.includes('小明') && row.includes('房號 ' + code) && row.includes('強化卡關') && row.includes('不限時') && /等待 \d+ 秒/.test(row), row);
    // 另一個人看清單、點「加入」連進房間
    const guest = await open(t, 'nick=' + encodeURIComponent('阿華'));
    await openNet(guest); await guest.waitForFunction(() => lobbyState === 'online' && document.querySelectorAll('#roomList .roomRow').length === 1, null, { timeout: 10000 });
    await guest.evaluate(() => document.querySelector('#roomList .roomRow button').click());
    await Promise.all([host, guest].map(p => p.waitForFunction(() => mode === 'online' && !netLost && peerName !== '對手', null, { timeout: 10000 })));
    t.assert.deepStrictEqual(await Promise.all([host, guest].map(p => p.evaluate(() => [mySide, peerName]))), [[0, '阿華'], [1, '小明']]);
    // 對手加入後房間撤掉：主機的清單為空
    await viewer.waitForFunction(() => document.querySelectorAll('#roomList .roomRow').length === 0, null, { timeout: 8000 });
    t.assert.strictEqual(await viewer.evaluate(() => hubRooms.size), 0);
    // 不公開的房間：取消勾選後建立，清單看不到
    const priv = await open(t, 'nick=' + encodeURIComponent('私人'));
    await openNet(priv); await priv.evaluate(() => { document.getElementById('pubChk').checked = false; document.getElementById('pubChk').onchange(); document.getElementById('mHost').click(); });
    await priv.waitForFunction(() => hostWaiting, null, { timeout: 8000 }); await priv.waitForTimeout(1200);
    t.assert.strictEqual(await viewer.evaluate(() => hubRooms.size), 0, '不公開的房間不該出現在清單');
  } },
  { name: '大廳（假 PeerJS）：主機離線後，其他人接手當主機，房主自動重新報到，清單恢復', async fn(t) {
    const hubPg = await open(t); await openNet(hubPg); await hubPg.waitForFunction(() => lobbyState === 'hub', null, { timeout: 8000 });
    const host = await open(t, 'nick=' + encodeURIComponent('小明'));
    await openNet(host); await host.evaluate(() => document.getElementById('mHost').click());
    await host.waitForFunction(() => hostWaiting && lobbyState === 'online', null, { timeout: 8000 });
    const viewer = await open(t); await openNet(viewer);
    await viewer.waitForFunction(() => lobbyState === 'online' && document.querySelectorAll('#roomList .roomRow').length === 1, null, { timeout: 10000 });
    await hubPg.evaluate(() => window.__mpDie()); await hubPg.close();   // 主機關掉頁面
    // 兩個客戶端偵測到中斷，其中一個搶到主機；房間在下一次心跳重新報到
    await viewer.waitForFunction(() => document.querySelectorAll('#roomList .roomRow').length === 1 && (lobbyState === 'online' || lobbyState === 'hub'), null, { timeout: 20000 });
    let states = '';
    for (let i = 0; i < 40 && states !== 'hub,online'; i++) { states = await Promise.all([host, viewer].map(p => p.evaluate(() => lobbyState))).then(s => s.sort().join()); if (states !== 'hub,online') await host.waitForTimeout(250); }
    t.assert.strictEqual(states, 'hub,online', '應該有一個人接手當主機、另一個向新主機報到');
    await Promise.all([host, viewer].map(p => p.waitForFunction(() => lobbyList.length === 0 || lobbyList.some(r => r.name), null, { timeout: 5000 })));
  } },
  { name: '經由（假）PeerJS 建立房間、輸入房號加入、一方的 peer 消失後雙方自動重連並續局（房主維持房間、加入者重新連入）', async fn(t) {
    const A = await open(t, 'hb=300&nick=' + encodeURIComponent('小明')), B = await open(t, 'hb=300&nick=' + encodeURIComponent('阿華'));
    await A.evaluate(() => { document.getElementById('lobby').hidden = false; document.getElementById('pubChk').checked = false; document.getElementById('mHost').click(); });
    await A.waitForFunction(() => hostWaiting, null, { timeout: 8000 });
    const code = await A.evaluate(() => roomCode);
    await B.evaluate(c => { document.getElementById('lobby').hidden = false; document.getElementById('roomIn').value = c; document.getElementById('mJoin').click(); }, code);
    await Promise.all([A, B].map(p => p.waitForFunction(() => mode === 'online' && !netLost && peerName !== '對手', null, { timeout: 10000 })));
    t.assert.deepStrictEqual(await Promise.all([A, B].map(p => p.evaluate(() => [mySide, peerName, hostWaiting]))), [[0, '阿華', false], [1, '小明', false]]);
    await B.evaluate(() => window.__mpDie());   // 加入者的連線（peer）整個消失
    await Promise.all([A, B].map(p => p.waitForFunction(() => netLost, null, { timeout: 8000 })));
    await Promise.all([A, B].map(p => p.waitForFunction(() => !netLost && conn && conn.open, null, { timeout: 20000 })));   // 加入者重新連入、房主接受
    const h = await Promise.all([A, B].map(p => p.evaluate(() => [stateHash(), turn, state, mode])));
    t.assert.deepStrictEqual(h[0], h[1]);
    t.assert.deepStrictEqual(h[0].slice(1), [0, 'aim', 'online']);
  } },
];
