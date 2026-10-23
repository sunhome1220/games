// ===== 線上大廳：目前有哪些房間在等對手加入 =====
// PeerJS 的公共配對服務不提供房間清單，所以由「正在看大廳或正在公開房間的玩家」當大廳主機：
//   · 用固定的 id（HUB_ID）搶當主機，搶到的人負責記錄房間；沒搶到的人用一般連線向主機報到／查清單。
//   · 房主每 REG_EVERY 毫秒向主機報到一次（心跳）；超過 ROOM_TTL 沒報到的房間會被清掉；對手加入或取消房間時主動撤掉。
//   · 主機離線時，其他人偵測到連線中斷，重新搶當主機；房間在下一次心跳自動重新報到，清單最多空白約 10 秒。
// 資料格式與連線都集中在這個檔案，之後想換成自己的伺服器，只要換掉 lobbyConnect／lobbyReg／lobbyUnreg／lobbyAsk 這幾個函式。
const HUB_ID = 'rc-chess-lobby-hub', ROOM_TTL = 25000, MAX_ROOMS = 200, MAX_PER_CONN = 3;
const LOBBY_FAST = (() => { const v = +new URLSearchParams(location.search).get('reg'); return v >= 200 ? v : 0; })();   // ?reg=毫秒：測試用，縮短報到與查詢間隔
const REG_EVERY = LOBBY_FAST || 10000, LIST_EVERY = LOBBY_FAST || 4000;
let lobbyState = 'off';   // off 沒在用／connecting 連線中／online 已連上主機／hub 我就是主機／error 無法使用
let lobbyView = false, myRoomCode = null, lobbyList = [];
let lastRooms = 0, hubPeer = null, cliPeer = null, hubConn = null, hubRooms = new Map(), hubTimer = 0, listTimer = 0, regTimer = 0, retryT = 0;
const lobbyNeeded = () => lobbyView || !!myRoomCode;
const cleanRoom = r => r && /^\d{4}$/.test(String(r.code)) ? { code: String(r.code), name: cleanNick(r.name) || '玩家', cards: !!r.cards, every: CARD_EVERY_OPTIONS.includes(r.every) ? r.every : 10, clock: CLOCK_OPTIONS.includes(r.clock) ? r.clock : 0 } : null;
const myRoomInfo = () => ({ code: myRoomCode, name: myName, cards: cardsOn, every: cardEvery, clock: clockSec });

// ---- 主機端：記錄房間、回傳清單（傳輸方式無關，測試直接餵假連線）----
function hubList(now = Date.now()) {
  return [...hubRooms.values()].filter(r => now - r.ts <= ROOM_TTL).sort((a, b) => b.created - a.created)
    .map(r => ({ code: r.code, name: r.name, cards: r.cards, every: r.every, clock: r.clock, wait: Math.floor((now - r.created) / 1000) }));
}
function hubSet(info, owner) {
  const r = cleanRoom(info); if (!r) return false;
  const old = hubRooms.get(r.code), now = Date.now();
  if (!old && hubRooms.size >= MAX_ROOMS) return false;
  if (old && old.owner !== owner) return false;   // 房號已被別人占用
  if (owner && owner.codes) { if (!owner.codes.has(r.code) && owner.codes.size >= MAX_PER_CONN) return false; owner.codes.add(r.code); }
  hubRooms.set(r.code, { ...r, owner, ts: now, created: old ? old.created : now });
  return true;
}
function hubDrop(code, owner) { const r = hubRooms.get(code); if (r && r.owner === owner) { hubRooms.delete(code); if (owner && owner.codes) owner.codes.delete(code); } }
function hubAccept(c) {
  c.codes = new Set();
  c.on('data', m => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'reg') { hubSet(m.room, c); if (lobbyState === 'hub') lobbyAsk(); }
    else if (m.t === 'unreg') { hubDrop(String(m.code), c); if (lobbyState === 'hub') lobbyAsk(); }
    else if (m.t === 'list') { try { c.send({ t: 'rooms', list: hubList() }); } catch (e) {} }
  });
  const gone = () => { for (const code of [...c.codes]) hubDrop(code, c); };
  c.on('close', gone); c.on('error', gone);
}
function hubSweep() { const now = Date.now(); for (const [k, r] of hubRooms) if (now - r.ts > ROOM_TTL) hubRooms.delete(k); }

// ---- 連線：搶當主機或向主機報到 ----
async function lobbyStart() {
  if (!lobbyNeeded()) return;
  if (lobbyState === 'online' || lobbyState === 'hub') { lobbyAsk(); return; }
  if (lobbyState === 'connecting') return;
  try { await loadPeer(); } catch (e) { lobbyState = 'error'; renderLobby(); return; }
  lobbyConnect();
}
function lobbyConnect() {
  if (!lobbyNeeded()) return;
  lobbyState = 'connecting'; renderLobby(); lobbyCloseNet();
  const p = cliPeer = new Peer();
  p.on('open', () => {
    const c = hubConn = p.connect(HUB_ID, { reliable: true, serialization: 'json' });
    c.on('open', () => { if (hubConn !== c) return; lobbyState = 'online'; lastRooms = Date.now(); lobbyAsk(); lobbyReg(); clearInterval(listTimer); listTimer = setInterval(lobbyAsk, LIST_EVERY); renderLobby(); });
    c.on('data', m => { if (m && m.t === 'rooms' && Array.isArray(m.list)) { lastRooms = Date.now(); lobbyList = m.list.map(cleanRoom2).filter(Boolean); renderLobby(); } });
    c.on('close', () => { if (hubConn === c) lobbyLost(); });
    c.on('error', () => { if (hubConn === c) lobbyLost(); });
  });
  p.on('error', e => { if (cliPeer !== p) return; if (e.type === 'peer-unavailable') lobbyClaim(); else lobbyLost(); });   // 找不到主機：自己來當
}
const cleanRoom2 = r => { const c = cleanRoom(r); return c ? { ...c, wait: Math.max(0, Math.floor(+r.wait || 0)) } : null; };
function lobbyClaim() {
  lobbyCloseNet();
  const p = hubPeer = new Peer(HUB_ID);
  p.on('open', () => { if (hubPeer !== p) return; lobbyState = 'hub'; hubRooms = new Map(); clearInterval(hubTimer); hubTimer = setInterval(() => { hubSweep(); lobbyAsk(); }, LIST_EVERY); lobbyReg(); renderLobby(); });
  p.on('connection', hubAccept);
  p.on('error', e => { if (hubPeer !== p) return; if (e.type === 'unavailable-id') lobbyRetry(300 + Math.random() * 700); else lobbyLost(); });   // 剛好被別人搶到：改去向他報到
}
function lobbyCloseNet() {
  clearInterval(listTimer); clearInterval(hubTimer);
  const a = cliPeer, b = hubPeer; cliPeer = hubPeer = hubConn = null;
  for (const p of [a, b]) { try { p && p.destroy(); } catch (e) {} }
}
function lobbyLost() { lobbyCloseNet(); lobbyState = 'connecting'; renderLobby(); lobbyRetry(1500 + Math.random() * 1500); }
function lobbyRetry(ms) { clearTimeout(retryT); retryT = setTimeout(() => { if (lobbyNeeded()) lobbyConnect(); }, ms); }
function lobbyTeardown() { clearTimeout(retryT); clearInterval(regTimer); lobbyCloseNet(); lobbyState = 'off'; lobbyList = []; renderLobby(); }

// ---- 報到、撤掉、查清單 ----
function lobbyReg() {
  if (!myRoomCode) return;
  if (lobbyState === 'hub') hubSet(myRoomInfo(), null);
  else if (lobbyState === 'online' && hubConn && hubConn.open) { try { hubConn.send({ t: 'reg', room: myRoomInfo() }); } catch (e) {} }
}
function lobbyUnreg() {
  if (!myRoomCode) return;
  if (lobbyState === 'hub') hubDrop(myRoomCode, null);
  else if (hubConn && hubConn.open) { try { hubConn.send({ t: 'unreg', code: myRoomCode }); } catch (e) {} }
}
function lobbyAsk() {
  if (lobbyState === 'hub') { lobbyList = hubList(); renderLobby(); }
  else if (lobbyState === 'online' && hubConn && hubConn.open) {
    if (Date.now() - lastRooms > LIST_EVERY * 3.5 + 1000) { lobbyLost(); return; }   // 主機一直沒回清單：視為主機掉了，重新搶
    try { hubConn.send({ t: 'list' }); } catch (e) {}
  }
}
// 房主：公開／撤掉自己的房間（建立房間時、對手加入時、取消勾選時）
function lobbyAnnounce(code) { lobbyUnannounce(); myRoomCode = code; clearInterval(regTimer); regTimer = setInterval(lobbyReg, REG_EVERY); lobbyStart().then(lobbyReg); }
function lobbyUnannounce() { lobbyUnreg(); myRoomCode = null; clearInterval(regTimer); if (!lobbyNeeded()) lobbyTeardown(); }
function lobbySetView(on) { lobbyView = on; if (on) lobbyStart(); else if (!lobbyNeeded()) lobbyTeardown(); }

// ---- 畫面 ----
function renderLobby() {
  const box = $('roomList'); if (!box) return;
  const st = lobbyState, rows = lobbyList.filter(r => r.code !== myRoomCode);
  $('lobbyStat').textContent = !lobbyView ? '' : st === 'error' ? '🔎 大廳暫時無法使用' : st === 'online' || st === 'hub' ? `🔎 線上等待中的房間（${rows.length}）` : '🔎 連線大廳中…';
  box.innerHTML = '';
  if (!lobbyView) return;
  if ((st === 'online' || st === 'hub') && !rows.length) { const d = document.createElement('div'); d.className = 'note'; d.textContent = '目前沒有人在等對手。你可以建立一個房間（預設會公開到這裡）。'; box.appendChild(d); }
  for (const r of rows) {
    const row = document.createElement('div'); row.className = 'roomRow';
    const info = document.createElement('div');
    const nm = document.createElement('b'); nm.textContent = r.name; info.appendChild(nm);
    const sm = document.createElement('small'); sm.textContent = `房號 ${r.code}　🃏 ${r.cards ? '強化卡開' : '強化卡關'}　⏲ ${r.clock ? r.clock + ' 秒' : '不限時'}　等待 ${r.wait} 秒`; info.appendChild(sm);
    const b = document.createElement('button'); b.textContent = '加入'; b.onclick = () => { $('roomIn').value = r.code; join(r.code); };
    row.append(info, b); box.appendChild(row);
  }
}
$('secNet').addEventListener('toggle', () => lobbySetView($('secNet').open));
$('lobbyRefresh').onclick = () => { if (lobbyState === 'online' || lobbyState === 'hub') lobbyAsk(); else if (lobbyState !== 'connecting') { lobbyState = 'off'; lobbyStart(); } };
$('pubChk').onchange = () => { try { localStorage.setItem('rc-public', $('pubChk').checked ? '1' : '0'); } catch (e) {} if (typeof hostWaiting !== 'undefined' && hostWaiting) { if ($('pubChk').checked) lobbyAnnounce(roomCode); else lobbyUnannounce(); } };
try { if (localStorage.getItem('rc-public') === '0') $('pubChk').checked = false; } catch (e) {}
