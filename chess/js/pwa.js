// ===== 加到主畫面與全螢幕 =====
// 加到主畫面：Android／電腦 Chrome 會觸發 beforeinstallprompt，可直接跳出安裝；iPhone／iPad 的 Safari 沒有這個事件，只能顯示手動步驟。
// 全螢幕：用 Fullscreen API（iPhone 不支援，按鈕會隱藏；加到主畫面後就是全螢幕）。
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const gameUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');

// --- 全螢幕 ---
const fsEl = document.documentElement, fsOn = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsOk = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen) && !isStandalone();
$('fsBtn').hidden = !fsOk;
function showFs() { $('fsBtn').textContent = fsOn() ? '🗗' : '⛶'; $('fsBtn').title = fsOn() ? '離開全螢幕' : '全螢幕'; }
$('fsBtn').onclick = () => {
  try { fsOn() ? (document.exitFullscreen || document.webkitExitFullscreen).call(document) : (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl); } catch (e) { toast('這個瀏覽器不能切換全螢幕'); }
};
document.addEventListener('fullscreenchange', showFs); document.addEventListener('webkitfullscreenchange', showFs); showFs();

// --- 加到主畫面（依裝置／瀏覽器給不同做法） ---
function envInfo() {
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), android = /Android/.test(ua);
  const inApp = /Line\/|FBAN|FBAV|Instagram|MicroMessenger|; wv\)|Messenger|Twitter|TikTok|Snapchat/i.test(ua);
  const alt = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  return { ios, android, inApp, iosSafari: ios && !alt && !inApp, iosOther: ios && alt && !inApp, samsung: /SamsungBrowser/.test(ua), firefox: /Firefox|FxiOS/.test(ua), edge: /Edg\//.test(ua),
    safariMac: !ios && !android && /^((?!chrome|android|crios|edg).)*safari/i.test(ua) };
}
function installLabel() { const e = envInfo(); return installEvt ? '📲 安裝遊戲' : e.inApp ? '📲 用瀏覽器開啟' : '📲 加到主畫面'; }
function showInstall() {
  const e = envInfo(), steps = [];
  if (e.inApp) steps.push('<li><b>你現在是在 App 內建的瀏覽器</b>（LINE、Facebook、Instagram 等），不能直接加到主畫面。請點「複製遊戲連結」，再貼到 ' + (e.ios ? 'Safari' : 'Chrome') + ' 開啟，然後再按一次這個按鈕。</li>');
  else if (e.iosSafari) steps.push('<li><b>iPhone／iPad（Safari）</b>：點下方工具列的「分享」圖示 ⬆️ → 往下滑，選「加入主畫面」→ 右上角「新增」</li>');
  else if (e.iosOther) steps.push('<li><b>iPhone／iPad</b>：這個瀏覽器可能沒有「加入主畫面」。建議複製連結，用 Safari 開啟後點「分享」⬆️ →「加入主畫面」；較新的 iOS 在 Chrome／Edge 的「分享」選單裡也有。</li>');
  else if (e.android && e.samsung) steps.push('<li><b>Android（Samsung Internet）</b>：點右下角選單「≡」→「新增頁面至」→「主螢幕」</li>');
  else if (e.android && e.firefox) steps.push('<li><b>Android（Firefox）</b>：點右上角「⋮」→「安裝」或「加到主畫面」</li>');
  else if (e.android) steps.push('<li><b>Android（Chrome）</b>：點右上角「⋮」→「加到主畫面」或「安裝應用程式」</li>');
  else if (e.safariMac) steps.push('<li><b>Mac（Safari）</b>：選單列「檔案」→「加入 Dock」</li>');
  else if (e.firefox) steps.push('<li><b>電腦（Firefox）</b>：Firefox 不支援安裝網頁，建議把網頁加入書籤，或改用 Chrome／Edge。</li>');
  else steps.push('<li><b>電腦（Chrome／Edge）</b>：網址列最右邊的「安裝」圖示 ⊕，或選單 →「安裝瘋狂象棋」</li>');
  if (!e.inApp) steps.push('<li>加入後從主畫面圖示開啟，就是沒有網址列的全螢幕，之後點一下就能玩。</li>');
  $('instSteps').innerHTML = steps.join('');
  $('instUrl').textContent = gameUrl();
  $('installOv').hidden = false;
}
$('mInstall').hidden = isStandalone();
$('mInstall').textContent = installLabel();
addEventListener('beforeinstallprompt', () => { $('mInstall').textContent = installLabel(); });
$('mInstall').onclick = async () => {
  if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; $('mInstall').textContent = installLabel(); return; }   // Android／電腦：直接跳出安裝視窗
  showInstall();
};
$('instClose').onclick = () => { $('installOv').hidden = true; };
$('instCopy').onclick = async () => {
  try { await navigator.clipboard.writeText(gameUrl()); toast('已複製遊戲連結'); } catch (e) { prompt('複製這個連結：', gameUrl()); }
};
addEventListener('appinstalled', () => { $('mInstall').hidden = true; toast('已加到主畫面'); });
