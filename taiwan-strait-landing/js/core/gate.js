'use strict';
/* ---------- 管理者開關（2026-11-18）----------
   開頁時先抓同目錄的 status.json（加時間參數、不快取）：
     open:false ＝ 對外關閉，顯示「暫停開放」畫面（message 是顯示的文字），遊戲畫面蓋住、無法操作。
     adminHash  ＝ 管理者密碼的 SHA-256（'tsl-admin:' ＋ 密碼）。網址加 ?admin=密碼 驗證通過後，這台裝置記住（localStorage），
                  關閉期間管理者仍能照常使用，畫面上方有提示條；?admin=logout 登出。換掉 adminHash 就等於撤銷所有裝置的管理者身分。
   抓不到 status.json（離線、網路錯誤）＝照常開放（不讓離線的 App 壞掉）。
   ★這是軟性的關閉：程式碼是公開的，擋得住一般使用者，擋不住會自己下載程式碼的人；要真的全部下線，請到 GitHub 取消發佈 Pages 或把倉庫改為私人。
   操作說明見 docs/admin.md；改設定用 tools/admin.py。 */
(function(){
  const hex=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);v===null?localStorage.removeItem(k):localStorage.setItem(k,v);}catch(e){}return null;};
  const veil=document.createElement('div');veil.id='gateVeil';veil.setAttribute('role','alert');
  veil.style.cssText='position:fixed;inset:0;z-index:100;background:#101A24;color:#E8EDF0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font:16px/1.7 system-ui,"Noto Sans TC",sans-serif';
  document.body.insertBefore(veil,document.body.firstChild);
  const done=()=>{veil.remove();};
  const closed=msg=>{veil.innerHTML='<div style="max-width:420px"><div style="font-size:30px;font-weight:700;letter-spacing:.04em;margin-bottom:10px">台海兵棋推演</div><div style="color:#C5A56A;font-weight:700;margin-bottom:12px">目前暫停開放</div><div style="color:#9AAAB4">'+String(msg||'目前暫停開放，請稍後再來。').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))+'</div></div>';};
  const banner=()=>{const b=document.createElement('div');b.id='gateAdmin';b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99;background:#C5A56A;color:#101A24;font:13px/1.4 system-ui,sans-serif;padding:4px 10px;text-align:center';
    b.innerHTML='管理者模式：遊戲目前已對外關閉，只有你看得到。 <a href="?admin=logout" style="color:#101A24;text-decoration:underline">登出管理者</a>';document.body.appendChild(b);};
  const timer=setTimeout(done,3000); // 3 秒內沒結果＝照常開放
  (async()=>{
    let st=null;
    try{const r=await fetch('status.json?t='+Date.now(),{cache:'no-store'});if(r.ok)st=await r.json();}catch(e){}
    clearTimeout(timer);
    if(!st||st.open!==false){done();window.TSL_CLOSED=false;
      const m=location.search.match(/[?&]admin=([^&]*)/);if(m&&m[1]==='logout'){ls('tsl-admin',null);try{history.replaceState(null,'',location.pathname);}catch(e){}}
      return;}
    window.TSL_CLOSED=true;
    let admin=false;const h=st.adminHash||'';
    if(h){
      const m=location.search.match(/[?&]admin=([^&]*)/);
      if(m){const p=decodeURIComponent(m[1]);if(p==='logout'){ls('tsl-admin',null);}else if(await hex('tsl-admin:'+p)===h)ls('tsl-admin',h);
        try{history.replaceState(null,'',location.pathname);}catch(e){}}
      admin=ls('tsl-admin')===h;
    }
    window.TSL_ADMIN=admin;
    if(admin){done();banner();}else closed(st.message);
  })();
})();
