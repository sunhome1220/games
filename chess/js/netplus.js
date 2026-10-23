// ===== 連線強化：序號、局面雜湊、不同步偵測與自動修復（見 network.js）=====
// 每則訊息帶序號（n）；回合結束的 end 訊息另帶局面雜湊（h）。接收方套用快照後重算雜湊，對不上或序號跳號就要求對方重傳完整局面（resync → full），
// 兩台裝置因此不會悄悄看到不同的棋盤。完整局面 fullState() 也是之後斷線重連續局用的資料格式。
let sendN = 0, recvN = 0, pendingEndH, resyncAt = 0;
const netClone = o => JSON.parse(JSON.stringify(o));
const stable = o => Array.isArray(o) ? '[' + o.map(stable).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}' : JSON.stringify(o);
// 犄角的殺回機會（棋子上的 rv）不在快照裡，打包成可傳送的格式：每個機會記下它的位置、兇手與哪些棋子能用
function packRv() {
  const toks = [], idx = new Map();
  pieces.forEach((p, i) => {
    if (!p.rv) return;
    if (!idx.has(p.rv)) { idx.set(p.rv, toks.length); toks.push({ x: p.rv.x, y: p.rv.y, k: pieces.indexOf(p.rv.killer), side: p.rv.side, at: p.rv.at, used: p.rv.used, m: [] }); }
    toks[idx.get(p.rv)].m.push(i);
  });
  return toks;
}
function unpackRv(list) {
  for (const p of pieces) p.rv = null;
  for (const t of list || []) { const tok = { x: t.x, y: t.y, killer: pieces[t.k], side: t.side, at: t.at, used: t.used }; for (const i of t.m) pieces[i].rv = tok; }
}
const fullState = () => ({ snap: netClone(snapshot()), cc: netClone(cardCount), rv: packRv(), cfg: { cards: cardsOn, every: cardEvery, clock: clockSec } });
function stateHash() {
  const s = stable({ s: snapshot(), cc: cardCount, rv: packRv() });
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
// 套用完整局面（不同步修復、斷線重連都用它）：丟掉進行中的動畫與操作，回到「輪到誰就等誰操作」
function applyFull(f) {
  applySnap(f.snap); cardCount = netClone(f.cc); unpackRv(f.rv);
  if (f.cfg) { if (f.cfg.clock !== undefined && CLOCK_OPTIONS.includes(f.cfg.clock)) { clockSec = f.cfg.clock; showClockBtn(); } if (cardsOn !== f.cfg.cards || (f.cfg.every && cardEvery !== f.cfg.every)) { cardsOn = f.cfg.cards; if (f.cfg.every) cardEvery = f.cfg.every; showCardsBtn(); } }
  pendingEnd = null; pendingEndH = undefined; targets = []; moved = false; sel = null; mover = null; origin = null; snaps = null; fx = []; incoming = []; pickQ = []; pickSide = null; waitingFor = null;
  stopPickClock(); $('cardPick').hidden = true; $('reviveOv').hidden = true; if (typeof spell !== 'undefined' && spell) { spell = null; $('spellBox').hidden = true; }
  setSkip(false); state = winner !== null ? 'over' : 'aim';
  renderPerks(); updateHeader(); saveCheckpoint();
  setMsg(winner !== null ? '一局結束。' : myTurn() ? '輪到你了！拉動己方棋子移動，停下後點選要攻擊的敵人。' : '等待對手操作…');
}
function requestResync(why) {
  if (Date.now() - resyncAt < 1500) return;   // 短時間內不重複要求
  resyncAt = Date.now(); console.warn('[連線] 兩邊局面不同步，要求對方重傳完整局面：' + why);
  send({ t: 'resync', why });
}
function sendEnd() { send({ t: 'end', snap: snapshot(), h: stateHash() }); saveCheckpoint(); }
// 處理連線強化的訊息；回傳 true＝已處理
function onNetPlus(m) {
  if (m.t === 'resync') { send({ t: 'full', full: fullState() }); return true; }
  if (m.t === 'full') { applyFull(m.full); toast('已與對手同步局面'); return true; }
  return false;
}

// ===== 斷線偵測、自動重連、續局 =====
// 心跳：每 HB 毫秒互送 ping，超過 3.2 倍時間沒收到任何訊息就判定斷線；斷線時畫面蓋上提示、雙方自動重連（房主維持房間、加入者重新連進去）。
// 重連後雙方交換「檢查點」（上一個回合結束時的完整局面），進度較新的那份為準、進度相同就各自回到檢查點，所以斷線時還沒走完的那一步會取消，其餘不變。
// 檢查點也存在這台裝置的 localStorage，重新整理頁面後可從設定頁「回到上次的房間」續局。
const HB = (() => { const v = +new URLSearchParams(location.search).get('hb'); return v >= 100 ? v : 2000; })();
let netDrop = false;   // 測試用：true＝假裝網路完全不通（不送也不收）
let netLost = false, lastRecv = Date.now(), lostSince = 0, resumeSent = false, resumeIntent = false, netRtt = null, peerBg = false;
let checkpoint = null, roomCode = null, retryTimer = 0;
const progress = () => turnsPlayed[0] + turnsPlayed[1];
const SESS_KEY = side => 'rc-sess-' + side;
function saveCheckpoint() {
  if (!online()) return;
  checkpoint = { prog: progress(), full: fullState() };
  try { if (winner !== null) localStorage.removeItem(SESS_KEY(mySide)); else localStorage.setItem(SESS_KEY(mySide), JSON.stringify({ room: roomCode, side: mySide, t: Date.now(), ck: checkpoint })); } catch (e) {}
}
function loadSession(side) {
  try { const s = JSON.parse(localStorage.getItem(SESS_KEY(side))); return s && s.ck && Date.now() - s.t < 30 * 60 * 1000 ? s : null; } catch (e) { return null; }
}
function clearSession() { try { localStorage.removeItem(SESS_KEY(mySide)); } catch (e) {} checkpoint = null; }
// 重新整理頁面後回到原本的房間：先用存下的檢查點還原局面，再連回去（連上後會和對手比對進度）
function resumeFromStorage(side, room) {
  const s = loadSession(side);
  if (!s || (room && s.room !== room)) return false;
  mode = 'online'; mySide = side; roomCode = s.room; checkpoint = s.ck; applyFull(s.ck.full); resumeIntent = true;
  markLost('重新整理後回到房間');
  return true;
}
function markLost(why) {
  if (netLost || !online() || state === 'over') return;
  netLost = true; lostSince = Date.now(); resumeSent = false; console.warn('[連線] 斷線：' + why);
  renderNetOv(); clearInterval(retryTimer); retryTimer = setInterval(tryReconnect, Math.max(HB * 2, 500)); tryReconnect();
}
function tryReconnect() {
  if (!netLost) return;
  if (conn && typeof conn.reconnect === 'function') { conn.reconnect(); return; }   // 測試用（BroadcastChannel）
  if (mySide === 1) reconnectJoin(); else reconnectHost();
}
function netRecovered() {
  if (!netLost && !resumeIntent) return;
  netLost = false; resumeIntent = false; clearInterval(retryTimer); lastRecv = Date.now(); renderNetOv();
  toast('✅ 已重新連線，從上一個回合結束的局面繼續');
  if (winner === null && state === 'aim') { if (progress() === 0) { if (cardsOn) beginPick([0, 1]); } else maybeTurnPick(); }
}
function sendResume(reply) { resumeSent = true; send({ t: 'resume', re: !!reply, prog: checkpoint ? checkpoint.prog : -1, full: checkpoint && checkpoint.full }); }
function onResume(m) {
  peerBg = false;   // 重新連上的是新的連線，背景狀態重算
  if (!m.re) sendResume(true);   // 對方主動送來的一律回一份我的檢查點（回覆本身不再回覆，避免來回不停）
  const mine = checkpoint ? checkpoint.prog : -1;
  if (m.full && m.prog > mine) { applyFull(m.full); checkpoint = { prog: m.prog, full: m.full }; }
  else if (checkpoint) applyFull(checkpoint.full);   // 同進度或我這邊較新：回到檢查點（取消斷線時未完成的那一步）
  netRecovered();
}
// 連線建立時（bindConn 的 open）：如果是重連或回到房間，就交換檢查點、不重開一局。回傳 true＝走續局流程
function netOnOpen() {
  lastRecv = Date.now(); resumeSent = false; peerBg = false;
  if (!netLost && !resumeIntent) return false;
  netLost = true; sendResume(); return true;
}
// 心跳與逾時判斷
function netTick() {
  if (!online() || state === 'over') return;
  if (!netLost && conn && conn.open && !netDrop) { try { conn.send({ t: 'ping', ts: Date.now() }); } catch (e) {} }
  if (netLost) renderNetOv();
  else if (Date.now() - lastRecv > (peerBg ? 60000 : HB * 3.2)) markLost('心跳逾時');
}
setInterval(netTick, HB);
document.addEventListener('visibilitychange', () => { if (online() && !netLost) send({ t: document.hidden ? 'bg' : 'fg' }); });   // 切到背景時瀏覽器會讓計時器變慢，先告訴對方別誤判斷線
// 在 onNet 最前面處理心跳、續局訊息；回傳 true＝已處理
function onNetBeat(m) {
  lastRecv = Date.now();
  if (m.t === 'ping') { try { conn.send({ t: 'pong', ts: m.ts }); } catch (e) {} return true; }
  if (m.t === 'pong') { netRtt = Date.now() - m.ts; return true; }
  if (m.t === 'bg') { peerBg = true; return true; }
  if (m.t === 'fg') { peerBg = false; return true; }
  if (m.t === 'resume') { onResume(m); return true; }
  if (netLost && !resumeSent) { sendResume(); }   // 斷線中收到對方訊息：對方還活著，交換檢查點恢復
  return false;
}
// ---- 斷線提示畫面 ----
function renderNetOv() {
  const ov = $('netOv'), show = netLost && online() && state !== 'over';
  ov.hidden = !show;
  if (!show) return;
  const sec = Math.floor((Date.now() - lostSince) / 1000);
  $('netOvS').textContent = resumeIntent ? `正在回到房間…（${sec} 秒）` : `連線中斷，正在自動重連…（${sec} 秒）。重連後會從上一個回合結束的局面繼續。`;
  $('netClaim').hidden = sec < 30;
}
$('netLeave').onclick = () => { try { if (conn) conn.close(); } catch (e) {} conn = null; clearSession(); netLost = false; resumeIntent = false; clearInterval(retryTimer); renderNetOv(); setMode('local'); $('lobby').hidden = false; };
$('netClaim').onclick = () => { netLost = false; resumeIntent = false; clearInterval(retryTimer); clearSession(); if (resign(1 - mySide, true)) toast('對手一直沒有回來，判對手認輸'); renderNetOv(); };

// 設定頁：有可以回去的房間（這台裝置上次的連線對戰還沒結束、30 分鐘內）就顯示按鈕
function offerResume() {
  const s = [0, 1].map(loadSession).filter(Boolean).sort((a, b) => b.t - a.t)[0];
  if (!s) return;
  $('secNet').open = true;
  netStatus(`<button id="mResume" style="width:auto">↩ 回到上次的連線對戰（房號 ${s.room}，${s.side ? '執黑' : '執紅'}）</button>`);
  $('mResume').onclick = async () => {
    try { await loadPeer(); } catch (e) { netStatus('⚠ ' + e.message); return; }
    if (resumeFromStorage(s.side, s.room)) $('lobby').hidden = true;
  };
}
