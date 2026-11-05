// 家庭共用的介面與遠端資料套用（依賴 index.html 內的 items、known、save、render）
(() => {
  const KEY = 'fe.family';
  const lsGet = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
  const lsSet = v => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} };
  const st = document.getElementById('famStatus'), bJoin = document.getElementById('famJoin'),
    bShare = document.getElementById('famShare'), bLeave = document.getElementById('famLeave');
  const TXT = { off: '未啟用（只存在這支手機）', connecting: '⏳ 連線中…', ok: '✅ 同步中', offline: '📴 離線，連線後自動同步', error: '⚠️ 同步失敗' };
  function ui() {
    if (!Sync.available) { st.textContent = '尚未設定 Firebase（見 food-expiry/FIREBASE.md）'; bJoin.disabled = true; return; }
    st.textContent = TXT[Sync.status] + (Sync.err ? '（' + Sync.err + '）' : '') + (Sync.code ? '　代碼：' + Sync.code : '');
    bJoin.hidden = !!Sync.code; bShare.hidden = bLeave.hidden = !Sync.code;
  }
  Sync.onStatus = ui;
  Sync.onItems = list => { items = list; save(); render(); };
  Sync.onStock = list => { stock = list; save(); render(); };
  Sync.onKnown = m => { known = m; save(); };
  async function join(code, fromLink) {
    code = Sync.normalize(code);
    if (code.length < 8) return alert('代碼至少 8 個英數字');
    const local = items.length || stock.length || Object.keys(known).length;
    const upload = local && confirm(`把這支手機上的 ${items.length} 筆食品、${stock.length} 項必備品也上傳到家庭「${code}」嗎？\n（取消＝不上傳，改用家庭裡現有的清單）`);
    lsSet(code);
    await Sync.join(code, upload ? { items, known, stock } : null);
    ui();
  }
  bJoin.onclick = () => {
    const c = prompt('輸入家人給你的家庭代碼；留白＝建立新的家庭代碼', '');
    if (c === null) return;
    join(c.trim() || Sync.generate());
  };
  bShare.onclick = async () => {
    const url = location.origin + location.pathname + '?family=' + Sync.code;
    try { if (navigator.share) { await navigator.share({ title: '食品效期記錄', text: '加入我的家庭清單', url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(url); alert('連結已複製，傳給家人即可：\n' + url); } catch { prompt('複製這個連結傳給家人', url); }
  };
  bLeave.onclick = () => {
    if (!confirm('離開家庭共用？這支手機會保留目前的清單，但不再同步。')) return;
    Sync.leave(); lsSet(''); ui();
  };
  ui();
  if (!Sync.available) return;
  const p = new URLSearchParams(location.search), link = Sync.normalize(p.get('family'));
  if (link) { history.replaceState(null, '', location.pathname); }
  const saved = lsGet();
  if (link && link !== saved) { if (confirm(`加入家庭共用清單「${link}」？`)) return join(link, true); }
  if (saved) join(saved);
})();
