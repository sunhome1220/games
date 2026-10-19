// ===== 畫面設定：2D／3D、傾斜角、手指旋轉（在開始畫面設定，記在瀏覽器） =====
const draw2D = draw, pos2D = pos;   // 原本的 2D 繪圖與點選換算
const viewPref = { view: '3d', tilt: 45, rot: true };
try {
  const g = k => localStorage.getItem(k);
  if (g('rc-view')) viewPref.view = g('rc-view');
  if (g('rc-tilt')) viewPref.tilt = Math.max(V3_MIN_TILT, Math.min(V3_MAX_TILT, +g('rc-tilt') || 45));
  if (g('rc-rot')) viewPref.rot = g('rc-rot') === '1';
} catch (e) {}
{ const q = new URLSearchParams(location.search); if (q.get('view')) viewPref.view = q.get('view'); }   // ?view=2d／3d（測試用）
function saveView() { try { localStorage.setItem('rc-view', viewPref.view); localStorage.setItem('rc-tilt', viewPref.tilt); localStorage.setItem('rc-rot', viewPref.rot ? '1' : '0'); } catch (e) {} }

async function applyView() {
  let want = viewPref.view;
  if (want === '3d' && !(await init3D())) { want = '2d'; viewPref.view = '2d'; toast('這個裝置／瀏覽器不支援 3D，已改用平面畫面'); }
  const on = want === '3d' && V3.ready;
  V3.on = on; V3.tilt = viewPref.tilt; V3.rot = viewPref.rot;
  cv.style.display = on ? 'none' : '';
  if (V3.ready) V3.stage.hidden = !on;
  window.draw = on ? draw3D : draw2D; window.pos = on ? pos3D : pos2D;
  if (on) resize3D();
  $('camBtn').hidden = !on;
  $('v3d').classList.toggle('on', on); $('v2d').classList.toggle('on', !on);
  $('tiltRow').hidden = !on; $('mRot').hidden = !on;
  $('tilt').value = viewPref.tilt; $('tiltV').textContent = viewPref.tilt + '°';
  $('mRot').textContent = viewPref.rot ? '👆 手指旋轉視角：開' : '👆 手指旋轉視角：關（固定角度）';
  saveView();
}
$('v3d').onclick = () => { viewPref.view = '3d'; applyView(); };
$('v2d').onclick = () => { viewPref.view = '2d'; applyView(); };
$('tilt').oninput = () => { viewPref.tilt = +$('tilt').value; V3.tilt = viewPref.tilt; $('tiltV').textContent = viewPref.tilt + '°'; saveView(); };
$('mRot').onclick = () => { viewPref.rot = !viewPref.rot; V3.rot = viewPref.rot; if (!viewPref.rot) V3.az = 0; applyView(); };
$('camBtn').onclick = () => { V3.az = 0; V3.tilt = viewPref.tilt; };   // 重置視角
applyView();
