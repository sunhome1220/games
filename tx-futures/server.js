// 台指期預估／現價查詢：零相依的小伺服器。
// 靜態檔 + /api/quote（代理期交所 MIS 報價，瀏覽器無法直接跨網域呼叫）。
// 執行：node tx-futures/server.js  （PORT 預設 8080）
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 8080, TTL = 3000;
const cache = {};
// 每個交易日保留最後一筆報價，非交易時段／連不上期交所時就用它顯示
const HISTORY = process.env.HISTORY_FILE || path.join(__dirname, 'data', 'history.json'), KEEP = 60;
let history = {};
try { history = JSON.parse(fs.readFileSync(HISTORY, 'utf8')); } catch (e) {}
function record(d) {
  const day = String(d.future.date || '').trim();
  if (!/^\d{8}$/.test(day) || d.future.last == null) return;
  history[day] = d;
  for (const k of Object.keys(history).sort().slice(0, -KEEP)) delete history[k];
  try { fs.mkdirSync(path.dirname(HISTORY), { recursive: true }); fs.writeFileSync(HISTORY, JSON.stringify(history)); } catch (e) { console.error('寫入紀錄失敗', e.message); }
}
const days = () => Object.keys(history).sort();

function post(cid) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ MarketType: '0', SymbolType: cid === 'TXF' ? 'F' : 'O', KindID: '1', CID: cid,
      ExpireMonth: '', RowSize: '全部', PageNo: '', SortColumn: '', AscDesc: 'A' });
    const req = https.request('https://mis.taifex.com.tw/futures/api/getQuoteList', {
      method: 'POST', timeout: 8000,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body),
        origin: 'https://mis.taifex.com.tw', referer: 'https://mis.taifex.com.tw/futures/', 'user-agent': 'Mozilla/5.0' },
    }, res => {
      let s = ''; res.on('data', d => s += d);
      res.on('end', () => { try { resolve(JSON.parse(s).RtData.QuoteList || []); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject); req.end(body);
  });
}
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };

async function build() {
  const [fut, opt] = await Promise.all([post('TXF'), post('TXO')]);
  const f = fut.find(q => /^TXF[A-L]\d$/.test(q.SymbolID) && num(q.CLastPrice) != null) || fut.find(q => /^TXF[A-L]\d$/.test(q.SymbolID));
  if (!f) throw new Error('no futures quote');
  const future = { symbol: f.SymbolID, name: f.DispCName, last: num(f.CLastPrice), ref: num(f.CRefPrice),
    open: num(f.COpenPrice), high: num(f.CHighPrice), low: num(f.CLowPrice), volume: num(f.CTotalVolume),
    time: f.CTime, date: f.CDate };
  // 選擇權：TXO + 履約價(5) + 月份字母(A-L買權/M-X賣權) + 年尾數；取最近一個到期月
  const by = {};
  for (const q of opt) {
    const m = /^TXO(\d{5})([A-X])(\d)$/.exec(q.SymbolID); if (!m) continue;
    const call = m[2] <= 'L', mon = (m[2].charCodeAt(0) - 65) % 12 + 1, key = m[3] + String(mon).padStart(2, '0');
    const bid = num(q.CBestBidPrice), ask = num(q.CBestAskPrice), last = num(q.CLastPrice);
    const mid = bid != null && ask != null && bid > 0 && ask > 0 ? (bid + ask) / 2 : last;
    ((by[key] ||= {})[+m[1]] ||= {})[call ? 'c' : 'p'] = mid;
  }
  const key = Object.keys(by).sort()[0];
  const rows = [];
  for (const [k, v] of Object.entries(by[key] || {})) if (v.c != null && v.p != null) rows.push({ strike: +k, c: v.c, p: v.p, diff: v.c - v.p });
  rows.sort((a, b) => a.strike - b.strike);
  let est = null;
  if (rows.length) { // 買賣權平價：F ≈ K + C − P，取 |C−P| 最小的三個履約價平均
    const near = [...rows].sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff)).slice(0, 3);
    est = near.reduce((s, r) => s + r.strike + r.diff, 0) / near.length;
  }
  const center = est ?? future.last;
  const near = rows.sort((a, b) => Math.abs(a.strike - center) - Math.abs(b.strike - center)).slice(0, 11).sort((a, b) => a.strike - b.strike);
  const out = { updated: Date.now(), future, estimate: est, optionMonth: key, options: near };
  record(out);
  return out;
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/quote')) {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    try {
      if (!cache.d || Date.now() - cache.t > TTL) cache.d = await build(), cache.t = Date.now();
      res.end(JSON.stringify(cache.d));
    } catch (e) {
      const last = days().pop(); // 連不上：回最後一筆紀錄並標示過期
      if (last) res.end(JSON.stringify({ ...history[last], stale: true, error: String(e.message || e) }));
      else { res.statusCode = 502; res.end(JSON.stringify({ error: String(e.message || e) })); }
    }
    return;
  }
  if (req.url.startsWith('/api/history')) {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(days().reverse().map(k => { const d = history[k]; return { date: k, last: d.future.last, ref: d.future.ref,
      open: d.future.open, high: d.future.high, low: d.future.low, volume: d.future.volume, estimate: d.estimate }; })));
  }
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  const file = path.join(__dirname, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream'); res.end(buf);
  });
}).listen(PORT, () => console.log('台指期 http://localhost:' + PORT));
