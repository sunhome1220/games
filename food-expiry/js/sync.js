// 多人共用：以「家庭代碼」為單位，把清單同步到 Firestore（families/{代碼}/items、known）。
// 沒設定 firebase-config.js 時 Sync.available=false，App 當單機版使用。
window.Sync = (() => {
  const cfg = window.FIREBASE_CONFIG;
  const S = { available: !!(cfg && cfg.projectId), code: null, status: 'off', onItems() {}, onKnown() {}, onStatus() {} };
  let db = null, unsubs = [], loading = null;
  const clean = o => JSON.parse(JSON.stringify(o));
  const kid = c => String(c).replace(/[\/.#$\[\]]/g, '_');
  const setStatus = s => { S.status = s; S.onStatus(s); };
  const load = src => new Promise((ok, no) => { const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = no; document.head.appendChild(e); });
  async function init() {
    if (db) return;
    if (!loading) loading = (async () => {
      if (!window.firebase) { await load('vendor/firebase-app-compat.js'); await load('vendor/firebase-firestore-compat.js'); }
      firebase.initializeApp(cfg);
      db = firebase.firestore();
      try { await db.enablePersistence({ synchronizeTabs: true }); } catch (_) { /* 不支援離線快取就略過 */ }
    })();
    await loading;
  }
  const col = n => db.collection('families').doc(S.code).collection(n);
  function stop() { unsubs.forEach(f => f()); unsubs = []; }
  S.generate = () => { const a = new Uint8Array(10); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''); };
  S.normalize = c => String(c || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  // upload: {items, known}：加入時把本機資料一併上傳（合併，不刪除雲端既有資料）
  S.join = async (code, upload) => {
    if (!S.available) return;
    setStatus('connecting');
    try {
      await init(); stop(); S.code = code;
      if (upload) {
        const b = db.batch();
        upload.items.forEach(it => b.set(col('items').doc(String(it.id)), clean(it)));
        Object.entries(upload.known).forEach(([k, v]) => b.set(col('known').doc(kid(k)), clean({ ...v, code: k })));
        await b.commit();
      }
      const onErr = () => setStatus('error');
      unsubs.push(col('items').onSnapshot(sn => { S.onItems(sn.docs.map(d => ({ ...d.data(), id: d.data().id || d.id }))); setStatus(sn.metadata.fromCache && !navigator.onLine ? 'offline' : 'ok'); }, onErr));
      unsubs.push(col('known').onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { const v = d.data(); m[v.code || d.id] = v; }); S.onKnown(m); }, onErr));
    } catch (e) { console.warn(e); setStatus('error'); }
  };
  S.leave = () => { stop(); S.code = null; setStatus('off'); };
  const on = () => S.available && S.code && db;
  S.setItem = it => { if (on()) col('items').doc(String(it.id)).set(clean(it)).catch(() => setStatus('error')); };
  S.delItem = id => { if (on()) col('items').doc(String(id)).delete().catch(() => setStatus('error')); };
  S.setKnown = (code, v) => { if (on()) col('known').doc(kid(code)).set(clean({ ...v, code })).catch(() => setStatus('error')); };
  S.replaceAll = async (items, known, oldIds) => {
    if (!on()) return;
    const b = db.batch(), keep = new Set(items.map(i => String(i.id)));
    oldIds.forEach(id => { if (!keep.has(String(id))) b.delete(col('items').doc(String(id))); });
    items.forEach(it => b.set(col('items').doc(String(it.id)), clean(it)));
    Object.entries(known).forEach(([k, v]) => b.set(col('known').doc(kid(k)), clean({ ...v, code: k })));
    await b.commit();
  };
  return S;
})();
