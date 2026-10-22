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
  $('cardPick').hidden = true; if (typeof spell !== 'undefined' && spell) { spell = null; $('spellBox').hidden = true; }
  setSkip(false); state = winner !== null ? 'over' : 'aim';
  renderPerks(); updateHeader();
  setMsg(winner !== null ? '一局結束。' : myTurn() ? '輪到你了！拉動己方棋子移動，停下後點選要攻擊的敵人。' : '等待對手操作…');
}
function requestResync(why) {
  if (Date.now() - resyncAt < 1500) return;   // 短時間內不重複要求
  resyncAt = Date.now(); console.warn('[連線] 兩邊局面不同步，要求對方重傳完整局面：' + why);
  send({ t: 'resync', why });
}
function sendEnd() { send({ t: 'end', snap: snapshot(), h: stateHash() }); }
// 處理連線強化的訊息；回傳 true＝已處理
function onNetPlus(m) {
  if (m.t === 'resync') { send({ t: 'full', full: fullState() }); return true; }
  if (m.t === 'full') { applyFull(m.full); toast('已與對手同步局面'); return true; }
  return false;
}
