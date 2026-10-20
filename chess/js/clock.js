// ===== 每回合時間限制（同裝置對戰、連線對戰；對電腦不計時）=====
// 超過時間後不會自動處理：輪到等待的那一方可以按「強制取消對手這一步」，不按就一直等。
const CLOCK_OPTIONS = [0, 5, 10, 15, 20, 25, 30];   // 秒；0＝不限時
let clockSec = 0;
try { const v = +localStorage.getItem('rc-clock'); if (CLOCK_OPTIONS.includes(v)) clockSec = v; } catch (e) {}
{ const v = +new URLSearchParams(location.search).get('clock'); if (CLOCK_OPTIONS.includes(v)) clockSec = v; }
let clockLeft = 0, clockKey = null, clockForced = false;
const clockOn = () => clockSec > 0 && mode !== 'ai' && winner === null && state !== 'over';
const clockCounting = () => ['aim', 'select', 'target', 'wait'].includes(state);   // 出發、開火動畫與選牌時不計時
// 目前能不能按「強制取消」：超時、還在等對方決定；連線時只有等待的那一方，同裝置對戰則由另一位玩家按
const forceReady = () => clockOn() && clockLeft <= 0 && !clockForced && clockCounting() && (online() ? !myTurn() : true);
function clockReset() { clockKey = null; clockForced = false; }
function clockTick(dt) {
  const k = turnsPlayed[0] + turnsPlayed[1] + ':' + turn;   // 回合換了就重新計時
  if (k !== clockKey) { clockKey = k; clockLeft = clockSec; clockForced = false; }
  if (clockOn() && clockCounting() && clockLeft > 0) clockLeft = Math.max(0, clockLeft - dt);
  renderClock();
}
function renderClock() {
  const c = $('clock'), on = clockOn();
  c.hidden = !on;
  if (on) {
    c.textContent = clockLeft > 0 ? `⏱ ${SIDE[turn].name} ${Math.ceil(clockLeft)}` : `⏰ ${SIDE[turn].name}超時`;
    c.classList.toggle('warn', clockLeft <= 3);
  }
  const f = $('forceBox'), show = forceReady();
  if (f.hidden === show) f.hidden = !show;
  f.classList.toggle('flip', mode === 'face' && turn === 0);   // 面對面：行動方是紅方時，按鈕要給上方的黑方看
}
// 在「行動的那一方」的裝置上執行：取消這一步（已移動就退回原位），不開火、直接結束回合
function skipTurnByForce() {
  if (winner !== null || !['aim', 'select', 'target'].includes(state)) return false;
  if (state === 'target' && moved) undoMove();
  sel = null; mover = null; targets = []; moved = false; origin = null; setSkip(false);
  state = 'aim'; toast('⏰ 超時，這一步被對手強制取消'); setMsg('⏰ 超時，這一步被對手強制取消，回合結束。');
  endTurn();
  return true;
}
$('forceBtn').onclick = () => {
  if (!forceReady()) return;
  clockForced = true;
  if (online()) { send({ t: 'force' }); setMsg('已強制取消對手這一步，等待對手畫面回應…'); }
  else skipTurnByForce();
  renderClock();
};
function showClockBtn() { $('mClock').textContent = `⏲ 每回合限時：${clockSec ? clockSec + ' 秒' : '不限時'}（點一下切換）`; }
$('mClock').onclick = () => {
  clockSec = CLOCK_OPTIONS[(CLOCK_OPTIONS.indexOf(clockSec) + 1) % CLOCK_OPTIONS.length]; showClockBtn(); clockReset();
  try { localStorage.setItem('rc-clock', clockSec); } catch (e) {}
};
showClockBtn();
