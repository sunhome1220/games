// 多人共用：以「家庭代碼」為單位，把清單同步到 Firestore（families/{代碼}/items、known）。
// 沒設定 firebase-config.js 時 Sync.available=false，App 當單機版使用。
window.Sync = (() => {
  const cfg = window.FIREBASE_CONFIG;
  const S = { user: null, onUser() {}, onRestore() {}, authErr: '', err: '', available: !!(cfg && cfg.projectId), code: null, status: 'off', onItems() {}, onKnown() {}, onStock() {}, onStatus() {} };
  let db = null, unsubs = [], loading = null;
  const clean = o => JSON.parse(JSON.stringify(o));
  const kid = c => String(c).replace(/[\/.#$\[\]]/g, '_');
  const setStatus = (s, e) => { S.status = s; S.err = e ? (e.code || e.message || String(e)) : ''; S.onStatus(s); };
  const load = src => new Promise((ok, no) => { const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = no; document.head.appendChild(e); });
  async function init() {
    if (db) return;
    if (!loading) loading = (async () => {
      if (!window.firebase) { await load('vendor/firebase-app-compat.js'); await load('vendor/firebase-firestore-compat.js'); }
      firebase.initializeApp(cfg);
      db = firebase.firestore();
      try { db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (_) {}
    })();
    await loading;
  }
  // ---- Google 登入 ----
  let auth = null;
  const AUTH_MSG = {
    'auth/unauthorized-domain': '此網站網域尚未加入 Firebase「授權網域」',
    'auth/operation-not-allowed': 'Firebase 尚未啟用 Google 登入',
    'auth/popup-closed-by-user': '登入視窗被關閉',
    'auth/cancelled-popup-request': '登入已取消',
    'auth/network-request-failed': '網路連線失敗',
    'auth/web-storage-unsupported': '瀏覽器擋住了儲存空間，無法登入',
  };
  const authMsg = e => AUTH_MSG[e && e.code] || (e && (e.code || e.message)) || '未知錯誤';
  S.initAuth = async () => {
    if (!S.available || auth) return;
    await init();
    if (!firebase.auth) await load('vendor/firebase-auth-compat.js');
    auth = firebase.auth();
    auth.onAuthStateChanged(u => { S.user = u; S.authErr = ''; S.onUser(u); if (u) restore(u); });
    auth.getRedirectResult().catch(e => { S.authErr = authMsg(e); S.onUser(S.user); });
  };
  S.signIn = async () => {
    try {
      await S.initAuth();
      S.authErr = ''; S.onUser(S.user);
      const prov = new firebase.auth.GoogleAuthProvider();
      prov.setCustomParameters({ prompt: 'select_account' });
      try { await auth.signInWithPopup(prov); }
      catch (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) await auth.signInWithRedirect(prov);
        else throw e;
      }
    } catch (e) { console.warn(e); S.authErr = authMsg(e); S.onUser(S.user); }
  };
  S.signOut = async () => { try { if (auth) await auth.signOut(); } catch (e) { console.warn(e); } };
  // 帳號底下記住「我的家庭代碼」，換手機登入後自動還原
  async function restore(u) {
    try {
      const d = await db.collection('users').doc(u.uid).get();
      S.onRestore(d.exists && d.data().familyCode ? d.data().familyCode : '');
    } catch (e) { console.warn(e); S.authErr = authMsg(e); S.onUser(S.user); }
  }
  S.saveFamily = code => {
    if (!auth || !S.user) return;
    db.collection('users').doc(S.user.uid).set({ familyCode: code || null, t: Date.now() }).catch(e => console.warn(e));
  };
  const col = n => db.collection('families').doc(S.code).collection(n);
  function stop() { unsubs.forEach(f => f()); unsubs = []; }
  S.generate = () => { const a = new Uint8Array(10); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''); };
  S.normalize = c => String(c || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  // upload: {items, known}：加入時把本機資料一併上傳（合併，不刪除雲端既有資料）
  S.join = async (code, upload) => {
    if (!S.available) return;
    setStatus('connecting');
    const to = setTimeout(() => { if (S.status === 'connecting') setStatus('error', { code: '逾時：10 秒內沒收到伺服器回應' }); }, 10000);
    try {
      await init(); stop(); S.code = code;
      if (upload) {
        const b = db.batch();
        upload.items.forEach(it => b.set(col('items').doc(String(it.id)), clean(it)));
        (upload.stock || []).forEach(it => b.set(col('stock').doc(String(it.id)), clean(it)));
        Object.entries(upload.known).forEach(([k, v]) => b.set(col('known').doc(kid(k)), clean({ ...v, code: k })));
        b.commit().catch(e => { console.warn(e); setStatus('error', e); });
      }
      const onErr = e => { console.warn(e); setStatus('error', e); };
      unsubs.push(col('items').onSnapshot(sn => { S.onItems(sn.docs.map(d => ({ ...d.data(), id: d.data().id || d.id }))); setStatus(sn.metadata.fromCache && !navigator.onLine ? 'offline' : 'ok'); }, onErr));
      unsubs.push(col('stock').onSnapshot(sn => { S.onStock(sn.docs.map(d => ({ ...d.data(), id: d.data().id || d.id }))); }, onErr));
      unsubs.push(col('known').onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { const v = d.data(); m[v.code || d.id] = v; }); S.onKnown(m); }, onErr));
    } catch (e) { console.warn(e); setStatus('error', e); }
  };
  S.leave = () => { stop(); S.code = null; setStatus('off'); };
  const on = () => S.available && S.code && db;
  S.setItem = it => { if (on()) col('items').doc(String(it.id)).set(clean(it)).catch(e => setStatus('error', e)); };
  S.delItem = id => { if (on()) col('items').doc(String(id)).delete().catch(e => setStatus('error', e)); };
  S.setStock = it => { if (on()) col('stock').doc(String(it.id)).set(clean(it)).catch(e => setStatus('error', e)); };
  S.delStock = id => { if (on()) col('stock').doc(String(id)).delete().catch(e => setStatus('error', e)); };
  S.setKnown = (code, v) => { if (on()) col('known').doc(kid(code)).set(clean({ ...v, code })).catch(e => setStatus('error', e)); };
  S.replaceAll = async (items, known, oldIds, stock = [], oldStockIds = []) => {
    if (!on()) return;
    const b = db.batch(), keep = new Set(items.map(i => String(i.id)));
    oldIds.forEach(id => { if (!keep.has(String(id))) b.delete(col('items').doc(String(id))); });
    items.forEach(it => b.set(col('items').doc(String(it.id)), clean(it)));
    const keepS = new Set(stock.map(i => String(i.id)));
    oldStockIds.forEach(id => { if (!keepS.has(String(id))) b.delete(col('stock').doc(String(id))); });
    stock.forEach(it => b.set(col('stock').doc(String(it.id)), clean(it)));
    Object.entries(known).forEach(([k, v]) => b.set(col('known').doc(kid(k)), clean({ ...v, code: k })));
    await b.commit();
  };
  return S;
})();
