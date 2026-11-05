// 必備品庫存：衛生紙、蛋這類「天天要有」的東西。庫存少於警戒量時標紅、提醒補貨。
// 依賴 index.html 的 $、ls、stock、save、render、Sync、toast 相關元素
(() => {
  const isLow = s => Number(s.qty) < Number(s.min);
  window.lowStock = () => stock.filter(isLow);
  let tab = ls.get('fe.tab', 'food');
  window.curTab = () => tab;
  const fmt = n => String(Math.round(Number(n) * 100) / 100);
  let tt = null;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 2600); }

  function setTab(t) {
    tab = t === 'stock' ? 'stock' : 'food'; ls.set('fe.tab', tab);
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('#foodView').hidden = tab !== 'food'; $('#stockView').hidden = tab !== 'stock';
  }
  document.querySelector('.tabs').onclick = e => { if (e.target.dataset.tab) setTab(e.target.dataset.tab); };

  window.renderStock = () => {
    const L = stock.slice().sort((a, b) => (isLow(b) - isLow(a)) || String(a.name).localeCompare(String(b.name), 'zh-Hant'));
    const nLow = L.filter(isLow).length;
    $('#sLow').textContent = nLow; $('#sAll').textContent = L.length;
    $('#stCopy').hidden = !nLow;
    document.querySelector('.tabs [data-tab=stock]').innerHTML = ic('box') + '必備庫存' + (nLow ? ` <span class="tag low" style="margin:0 0 0 2px;vertical-align:0">${nLow}</span>` : '');
    $('#stList').innerHTML = L.length ? L.map(s => {
      const low = isLow(s);
      return `<div class="item st ${low ? 'low' : ''}"><div class="info"><div class="nm"><span class="tag ${low ? 'low' : 'ok'}">${low ? '該補貨' : '充足'}</span>${esc(s.name)}</div><div class="meta">警戒量 ${fmt(s.min)} ${esc(s.unit || '')}${s.code ? ' · ' + esc(s.code) : ''}</div></div><div class="badge">${low ? '只剩 ' : '庫存 '}${fmt(s.qty)} ${esc(s.unit || '')}</div><button class="sm t-gray qbtn" data-minus="${s.id}" aria-label="減一">${ic('minus')}</button><button class="sm qbtn" data-plus="${s.id}" aria-label="加一">${ic('plus')}</button>${Number(s.step) > 1 ? `<button class="sm ghost" data-plusn="${s.id}">${ic('plus')}${fmt(s.step)}</button>` : ''}<button class="sm t-gray qbtn" data-stedit="${s.id}" aria-label="編輯">${ic('edit')}</button></div>`;
    }).join('') : '<div class="empty">還沒有必備品<br>按上方「新增必備品」，例如衛生紙、雞蛋</div>';
  };

  function change(s, d) {
    const wasLow = isLow(s);
    s.qty = Math.max(0, Math.round((Number(s.qty) + d) * 100) / 100);
    Sync.setStock(s); save(); render();
    if (!wasLow && isLow(s)) toast(`${s.name} 少於警戒量，該補貨了`);
  }
  $('#stList').onclick = e => {
    const d = e.target.dataset, find = id => stock.find(x => x.id == id);
    if (d.plus) change(find(d.plus), 1);
    if (d.plusn) { const s = find(d.plusn); change(s, Number(s.step) || 1); }
    if (d.minus) change(find(d.minus), -1);
    if (d.stedit) openStock(find(d.stedit));
  };

  let editing = null;
  function openStock(s, code = '') {
    editing = s;
    $('#stTitle').textContent = s ? '編輯必備品' : '新增必備品';
    const k = !s && code && known[code];
    $('#sName').value = s ? s.name : (k ? k.name : '');
    $('#sQty').value = s ? s.qty : 1; $('#sUnit').value = s ? (s.unit || '') : '個';
    $('#sMin').value = s ? s.min : 1; $('#sStep').value = s ? (s.step || 1) : 1; $('#sCode').value = s ? (s.code || '') : code;
    $('#stDel').hidden = !s;
    $('#stockDlg').showModal();
  }
  $('#stAdd').onclick = () => openStock(null);
  $('#stCancel').onclick = () => $('#stockDlg').close();
  $('#stDel').onclick = () => {
    if (!editing || !confirm(`刪除必備品「${editing.name}」？`)) return;
    stock = stock.filter(x => x !== editing); Sync.delStock(editing.id); save(); render(); $('#stockDlg').close();
  };
  $('#stockForm').onsubmit = () => {
    const name = $('#sName').value.trim(); if (!name) return;
    const v = { name, qty: Math.max(0, +$('#sQty').value || 0), unit: $('#sUnit').value.trim(), min: Math.max(0, +$('#sMin').value || 0), step: Math.max(1, +$('#sStep').value || 1), code: $('#sCode').value.trim() };
    let s = editing;
    if (s) Object.assign(s, v); else { s = { id: Date.now() + Math.random().toString(36).slice(2, 6), ...v }; stock.push(s); }
    Sync.setStock(s); save(); render();
    if (isLow(s)) toast(`${s.name} 少於警戒量，該補貨了`);
  };
  $('#stCopy').onclick = async () => {
    const text = '需補貨：\n' + lowStock().map(s => `・${s.name}（剩 ${fmt(s.qty)} ${s.unit || ''}，警戒 ${fmt(s.min)}）`).join('\n');
    try { await navigator.clipboard.writeText(text); toast('補貨清單已複製'); } catch { prompt('複製補貨清單', text); }
  };

  // 在「必備庫存」分頁掃條碼：已登記的 +1；沒登記的開新增視窗
  window.stockScan = code => {
    const s = stock.find(x => x.code && x.code === code);
    if (s) { change(s, 1); toast(`${s.name} +1 → ${fmt(s.qty)} ${s.unit || ''}`); }
    else openStock(null, code);
  };

  setTab(tab); renderStock();
})();
