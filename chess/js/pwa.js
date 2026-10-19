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

// --- 加到主畫面 ---
function showInstall() {
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), android = /Android/.test(ua);
  $('instSteps').innerHTML = (ios ? '<li><b>iPhone／iPad（用 Safari 開啟）</b>：點下方工具列的「分享」圖示 ⬆️ → 往下滑，選「加入主畫面」→ 右上角「新增」</li>'
    : android ? '<li><b>Android（Chrome）</b>：點右上角「⋮」→「加到主畫面」或「安裝應用程式」</li>'
    : '<li><b>電腦（Chrome／Edge）</b>：網址列最右邊的「安裝」圖示 ⊕，或選單 →「安裝瘋狂象棋」</li>')
    + (ios || android ? '' : '<li>手機：iPhone 用 Safari 點「分享」→「加入主畫面」；Android 用 Chrome 點「⋮」→「加到主畫面」</li>')
    + '<li>加入後從主畫面圖示開啟，就是沒有網址列的全螢幕，之後點一下就能玩。</li>';
  $('instUrl').textContent = gameUrl();
  $('installOv').hidden = false;
}
$('mInstall').hidden = isStandalone();
$('mInstall').onclick = async () => {
  if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; return; }   // Android／電腦：直接跳出安裝視窗
  showInstall();
};
$('instClose').onclick = () => { $('installOv').hidden = true; };
$('instCopy').onclick = async () => {
  try { await navigator.clipboard.writeText(gameUrl()); toast('已複製遊戲連結'); } catch (e) { prompt('複製這個連結：', gameUrl()); }
};
addEventListener('appinstalled', () => { $('mInstall').hidden = true; toast('已加到主畫面'); });
