// ===== 對戰模式與連線 =====
// 連線做法：輪到誰，誰的裝置就是「主控」——它算物理、把動作（出發／開火）送給對方播放動畫，
// 回合結束時送出完整局面快照，對方直接套用，兩台裝置就不會因浮點誤差而越跑越不同步。
function snapshot() {
  return { turn, winner, or: overReason, md: mods, tp: turnsPlayed, im: immune, xt: extraTurn, ps: pieces.map(p => [p.x, p.y, p.hp, p.cd, p.T.id === 'P2' ? 1 : 0, p.hd]) };
}
function applySnap(sn) {
  if (JSON.stringify(sn.md) !== JSON.stringify(mods)) { mods = JSON.parse(JSON.stringify(sn.md)); buildTypes(0); buildTypes(1); }
  turnsPlayed = sn.tp.slice(); immune = (sn.im || [0, 0]).slice(); extraTurn = (sn.xt || [0, 0]).slice();
  sn.ps.forEach(([x, y, hp, cd, pr, hd], i) => {
    const p = pieces[i];
    Object.assign(p, { x, y, hp, cd, hd, vx: 0, vy: 0, cdFresh: false });
    p.T = pr ? TT[p.s].P2 : TT[p.s][p.t];
  });
  turn = sn.turn; winner = sn.winner; overReason = sn.or || null;
}
function applyEnd() {
  const sn = pendingEnd; pendingEnd = null;
  const before = pieces.map(p => p.hp);
  applySnap(sn);
  let healed = false;   // 對方回合開始時的戰地醫療也播特效
  pieces.forEach((p, i) => { if (p.hp > before[i] && p.hp > 0) { healFX(p, p.hp - before[i]); healed = true; } });
  if (healed) SFX.play('heal');
  targets = []; moved = false; sel = null; setSkip(false);
  if (winner !== null) { state = 'over'; SFX.play('win'); countGame(); gameOverToLobby(); }
  else { state = 'aim'; setMsg(myTurn() ? '輪到你了！拉動己方棋子移動，停下後點選要攻擊的敵人。' : '等待對手操作…'); }
  updateHeader();
  if (winner === null) maybeTurnPick();
}
function send(m) { if (online() && conn && conn.open) conn.send(m); }
function onNet(m) {
  if (m.t === 'reset') { reset(); setMsg('對手重新開始了一局。'); return; }
  if (m.t === 'cfg') { if (cardsOn !== m.cards || (m.every && cardEvery !== m.every)) { cardsOn = m.cards; if (m.every) cardEvery = m.every; showCardsBtn(); } reset(); return; }   // 連線時以房主的強化卡牌設定為準
  if (m.t === 'resign') { resign(m.side, true); return; }
  if (m.t === 'card') { incoming.push(m); drainIncoming(); return; }
  if (m.t === 'launch') {
    const p = pieces[m.i];
    p.vx = m.vx; p.vy = m.vy; p.hd = Math.atan2(m.vy, m.vx); mover = p;
    SFX.play('launch', 0.7); state = 'moving'; setMsg('對手出發！');
  } else if (m.t === 'undo') {   // 對手取消移動：棋子退回出發點
    const p = pieces[m.i];
    applyUndo({ p, x: m.x, y: m.y, hd: m.hd, hp: m.hp, T: m.pr ? TT[p.s].P2 : TT[p.s][p.t] });
    snaps = null; mover = null; state = 'wait'; setMsg('對手取消了移動，重新選擇中…');
  } else if (m.t === 'shoot') {
    applySnap(m.snap);   // 先對齊停下的位置再播開火
    state = 'fire'; timer = 0.5; mover = pieces[m.a];
    shoot(pieces[m.a], pieces[m.b]);
  } else if (m.t === 'end') {
    pendingEnd = m.snap;
    if (!['moving', 'settle', 'fire'].includes(state)) applyEnd();   // 否則等動畫播完（onStop／endTurn）再套用
  }
}
function restart() {
  reset();
  send({ t: 'reset' });
}
function setMode(m, side = 0) {
  if (m !== 'online' && conn) { try { conn.close(); } catch (e) {} conn = null; }
  mode = m; mySide = side; pendingEnd = null;
  reset();
  $('lobby').hidden = true;
}
const netStatus = s => $('netStatus').innerHTML = s;

// --- PeerJS（WebRTC 點對點；房號＝在免費的 PeerJS 公用伺服器上的 ID） ---
let peer = null;
const peerId = code => 'rc-chess-b-' + code;
function loadPeer() {
  return window.Peer ? Promise.resolve() : new Promise((ok, fail) => {
    const sc = document.createElement('script');
    sc.src = 'vendor/peerjs.min.js'; sc.onload = ok; sc.onerror = () => fail(new Error('載入連線模組失敗'));
    document.head.appendChild(sc);
  });
}
const netErr = e => ({ network: '連不上配對伺服器，請檢查網路', 'server-error': '配對伺服器暫時無法使用，請稍後再試',
                       'browser-incompatible': '這個瀏覽器不支援連線對戰' })[e.type] || (e.type || e.message);
function bindConn(c, side) {
  conn = c;
  c.on('data', onNet);
  c.on('open', () => {
    mode = 'online'; mySide = side; pendingEnd = null;
    reset(); $('lobby').hidden = true;
    if (side === 0) send({ t: 'cfg', cards: cardsOn, every: cardEvery });
    netStatus('✅ 已連線');
    setMsg(side === 0 ? '對手已加入！你執紅先手，開始吧。' : '已加入房間！你執黑，等待紅方先手…');
  });
  c.on('close', () => { if (conn === c) { conn = null; setMsg('⚠ 連線中斷，可按 ☰ 重新建立房間。'); netStatus('⚠ 連線中斷'); } });
  c.on('error', e => netStatus('⚠ ' + e.message));
}
async function host() {
  netStatus('建立房間中…');
  try { await loadPeer(); } catch (e) { netStatus('⚠ ' + e.message); return; }
  if (peer) peer.destroy();
  const code = String(1000 + Math.floor(Math.random() * 9000));
  peer = new Peer(peerId(code));
  peer.on('open', () => {
    const link = location.href.split('?')[0] + '?room=' + code;
    netStatus(`房號 <b style="font-size:22px">${code}</b>，等待對手加入…<br>或把連結傳給對方：<br><small>${link}</small>` +
              `<br><button id="copyLink" style="width:auto">複製連結</button>`);
    $('copyLink').onclick = () => navigator.clipboard?.writeText(link).then(() => $('copyLink').textContent = '已複製 ✓');
  });
  peer.on('connection', c => { if (conn && conn.open) { c.close(); return; } bindConn(c, 0); });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') host();   // 房號撞到，換一個
    else netStatus('⚠ 無法建立房間：' + netErr(e));
  });
}
async function join(code) {
  code = String(code).trim();
  if (!/^\d{4}$/.test(code)) { netStatus('請輸入 4 位數房號'); return; }
  netStatus('連線中…');
  try { await loadPeer(); } catch (e) { netStatus('⚠ ' + e.message); return; }
  if (peer) peer.destroy();
  peer = new Peer();
  peer.on('open', () => bindConn(peer.connect(peerId(code), { reliable: true, serialization: 'json' }), 1));
  peer.on('error', e => netStatus(e.type === 'peer-unavailable' ? '⚠ 找不到這個房間，請確認房號' : '⚠ 連線失敗：' + netErr(e)));
}
// 測試用：?bc=房名&side=0|1 用 BroadcastChannel 在同一台電腦的兩個分頁之間連線
function bcConnect(room, side) {
  const ch = new BroadcastChannel('rc-chess-' + room), hs = {};
  const c = { open: false, send: m => ch.postMessage(m), close() { ch.close(); }, on: (ev, fn) => hs[ev] = fn };
  ch.onmessage = e => {
    if (e.data === 'hello' || e.data === 'ack') {
      if (e.data === 'hello') ch.postMessage('ack');
      if (!c.open) { c.open = true; hs.open && hs.open(); }
    } else hs.data && hs.data(e.data);
  };
  bindConn(c, side);
  ch.postMessage('hello');
}

// 一局結束：停一下讓玩家看結果，然後回到設定頁（對戰模式），由玩家選下一局怎麼玩
function gameOverToLobby() { setTimeout(() => { if (state === 'over') $('lobby').hidden = false; }, 1400); }
let helpFrom = null;   // 從設定頁開的說明，關掉後回到設定頁
$('legendClose').addEventListener('click', () => { if (helpFrom === 'lobby') $('lobby').hidden = false; helpFrom = null; });
$('menu').onclick = () => { SFX.init(); $('lobby').hidden = false; showResignBtn(); };
$('mClose').onclick = () => $('lobby').hidden = true;
$('mLocal').onclick = () => setMode('local');
$('mFace').onclick = () => setMode('face');
$('mHost').onclick = () => host();
$('mJoin').onclick = () => join($('roomIn').value);
$('roomIn').onkeydown = e => { if (e.key === 'Enter') join($('roomIn').value); };
document.querySelectorAll('#lobby .lv button').forEach(b => b.onclick = () => {
  aiLevel = +b.dataset.lv; setMode('ai');
  setMsg(`對電腦（${AI_LEVELS[aiLevel]}）：你執紅先手，點選棋子開始。`);
});
$('mHelp').onclick = () => { $('lobby').hidden = true; helpFrom = 'lobby'; $('legendOv').hidden = false; };
// 認輸：同裝置對戰時是「目前輪到的那一方」認輸；對電腦／連線是自己這方。要連按兩次才生效，避免誤觸
const resignSide = () => mode === 'ai' || online() ? mySide : turn;
let resignArm = 0;
function showResignBtn() { const b = $('mResign'); b.textContent = resignArm ? `⚠️ 確定認輸？（${SIDE[resignSide()].name}）` : `🏳️ 認輸（${SIDE[resignSide()].name}）`; b.disabled = state === 'over' || state === 'pick'; }
$('mResign').onclick = () => {
  if (!resignArm) { resignArm = setTimeout(() => { resignArm = 0; showResignBtn(); }, 3500); showResignBtn(); return; }
  clearTimeout(resignArm); resignArm = 0;
  if (resign(resignSide())) $('lobby').hidden = true;
  showResignBtn();
};
$('mRestart').onclick = () => { restart(); $('lobby').hidden = true; };

