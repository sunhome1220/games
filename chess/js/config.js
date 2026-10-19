// ===== 原型 B：移動 + 手動瞄準 =====
// 回合 = ① 拉動一台車（或輕點原地不動） ② 從射程內的敵人中點選目標開火。
// 直射武器會被中間的棋子擋住；炮為曲射可越過棋子但有最小射程。
// 河道泥濘（摩擦加倍），帥/將被限制在九宮內。
const C = 56, M = 46, W = C * 8 + M * 2, H = C * 9 + M * 2, R = 21;
const FR = 900, RIVER_FR = 2.6, MAXPULL = 120, E = 0.85, DPR = 2;
const cv = document.getElementById('cv');
let ctx = cv.getContext('2d');   // 立體模式會暫時換成離屏畫布（見 render3d.js 的 withCtx）
cv.width = W * DPR; cv.height = H * DPR; ctx.scale(DPR, DPR);
// 擋掉長按選單／選字／捲動等瀏覽器預設手勢（pointer 事件仍正常觸發）
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
document.addEventListener('selectstart', e => e.preventDefault());
const gx = c => M + c * C, gy = r => M + r * C;

const SIDE = [{ name: '紅方', col: '#c0392b' }, { name: '黑方', col: '#1d1d1d' }];
const TYPES = {
  K: { n: ['帥', '將'], hp: 3, dist: 1.5 * C, range: 1.5 * C, min: 0,     dmg: 1, mass: 3,   w: '手槍',   snd: 'pistol', proj: 'bullet', palace: true },
  R: { n: ['俥', '車'], hp: 4, dist: 10 * C,   range: 4.2 * C, min: 0,     dmg: 2, mass: 2,   w: '機槍',   snd: 'mg',     proj: 'burst', reload: 1, backup: true, line: true, ortho: true },   // 只能沿橫線／直線移動；橫線、直線射程 5 格，斜對角只有 3 格
  N: { n: ['傌', '馬'], hp: 3, dist: 0, knight: true, range: 3 * C, min: 0,     dmg: 2, mass: 1.5, w: '火箭',   snd: 'rocket', proj: 'rocket', reload: 1, backup: true, knightOnly: true },   // 火箭只能打「日」字位置；近戰（任何時候）用 1 心步槍   // 射後需裝填 2 回合（期間改用步槍）
  C: { n: ['炮', '砲'], hp: 3, dist: 10 * C, range: 5.2 * C, min: 4 * C, dmg: 2, mass: 1.5, w: '迫擊炮', snd: 'mortar', proj: 'shell', reload: 1, indirect: true, moveLine: true, ortho: true, splash: 1.5 * C },   // 只能打同一橫線／直線上的目標；   // 只能沿橫線／直線移動；射後需裝填 1 回合（期間完全不能攻擊，包括近戰）；上下左右相鄰受 1/2 傷害、斜角受 1/4（無條件捨去到 ¼ 心）
  // 相／象：防空＋近戰；自動攔截落點在 2.5 格內的火箭／砲彈（冷卻 2 回合，不影響近戰）；近戰 1 心、射程 1.5 格；只能走田字（象眼被塞就過不去）
  // 仕／士：護衛，近距離手槍；限九宮斜走一格；帥被直接攻擊時，相鄰的士衝出來替帥擋下
  G: { n: ['仕', '士'], hp: 3, dist: 1.5 * C, range: 1.5 * C, min: 0,     dmg: 1, mass: 1.5, w: '手槍', snd: 'pistol', proj: 'bullet', palace: true, guard: true },   // 近距離（相鄰與斜角）手槍 1 心
  E: { n: ['相', '象'], hp: 3, dist: 3 * C,   range: 3 * C,   melee: 1.5 * C, tian: true, min: 0,     dmg: 1, mass: 1.5, w: '手槍',   snd: 'pistol', proj: 'bullet', aa: 2.5 * C, reload: 1 },
  P: { n: ['兵', '卒'], hp: 2, dist: 1 * C,   range: 1.8 * C, min: 0,     dmg: 1, mass: 1,   w: '步槍',   snd: 'rifle',  proj: 'bullet', tag: '（未過河）', locked: true },
  // 士官長（兵過河後空投補給升官）：自由移動（每次最多 2 格），血量 2 → 3，強化霰彈槍 9 發彈丸呈扇形，越近命中越多（傷害與命中數成正比，全中 2.5 心）
  P2: { n: ['士官長', '士官長'], face: ['兵', '卒'], hp: 3, dist: 2 * C, range: 3 * C, min: 0,    dmg: 2.5, mass: 1,   w: '強化霰彈槍', snd: 'shotgun', proj: 'pellets', tag: '（過河升官）',
        pellets: 9, cone: 30 * Math.PI / 180 },
};
// 傌、俥的主武器冷卻時，改用步槍（炮冷卻時完全不能攻擊）（1 心、射程 1.8 格、直射）
const RIFLE = { w: '步槍', snd: 'rifle', proj: 'bullet', dmg: 1, range: 1.8 * C, min: 0, indirect: false, splash: 0, reload: 0, backup: false, ortho: false, knightOnly: false, isAlt: true };
for (const T of Object.values(TYPES)) if (T.backup) T.alt = { ...T, ...RIFLE };
// 每方各有一份兵種數值表 TT[side][key]（含強化卡的加成）；棋子的 p.T 指向自己那方的表
let mods = [{}, {}], cardCount = [{}, {}], turnsPlayed = [0, 0];
const TT = [{}, {}];
function buildTypes(side) {
  for (const k of Object.keys(TYPES)) {
    const T = { ...TYPES[k], id: k }, m = mods[side][k] || {};
    for (const [st, v] of Object.entries(m)) T[st] = (T[st] || 0) + v;
    if (T.reload !== undefined) T.reload = Math.max(0, T.reload);
    if (T.min !== undefined) T.min = Math.max(0, T.min);
    delete T.alt; if (T.backup) T.alt = { ...T, ...RIFLE };
    TT[side][k] = T;
  }
}
function rebuildAll() { buildTypes(0); buildTypes(1); for (const p of pieces) p.T = TT[p.s][p.T.id]; }
const weaponOf = a => a.cd > 0 && a.T.alt ? a.T.alt : a.T;   // 目前可用的武器（單一武器的棋子）
// 目標 b 相對於 (x,y) 是否剛好在「日」字位置
function tianOffset(x, y, b) {   // 目標 b 是否在 (x,y) 的田字對角點（斜 2 格）
  const dx = Math.abs(b.x - x) / C, dy = Math.abs(b.y - y) / C;
  return Math.abs(dx - 2) < 0.05 && Math.abs(dy - 2) < 0.05;
}
function knightOffset(x, y, b) {
  const dx = Math.abs(b.x - x) / C, dy = Math.abs(b.y - y) / C, rx = Math.round(dx), ry = Math.round(dy);
  return Math.abs(dx - rx) < 0.05 && Math.abs(dy - ry) < 0.05 && ((rx === 1 && ry === 2) || (rx === 2 && ry === 1));
}
// 打目標 b 時實際使用的武器：傌——日字位置且火箭已裝填完用火箭，其餘用步槍；炮——冷卻中不能攻擊；俥——冷卻中改用步槍
function weaponFor(a, b, x = a.x, y = a.y) {
  const T = a.T;
  if (!T.alt) return T;
  if (T.knight) return !a.cd && knightOffset(x, y, b) ? T : T.alt;
  return a.cd > 0 ? T.alt : T;
}
const LAYOUT = [['K',4,9],['G',3,9],['G',5,9],['R',0,9],['R',8,9],['N',1,9],['N',7,9],['E',2,9],['E',6,9],['C',1,7],['C',7,7],
                ['P',0,6],['P',2,6],['P',4,6],['P',6,6],['P',8,6]];

let pieces, turn, state, mover, timer, fx, winner, targets;
let moved = false, firedPiece = null, sel = null, origin = null;   // moved：本回合已移動；sel：目前選取的棋子 {p, moves 可走的點, dest 目的地, scan 原地可攻擊}
// 對戰模式：local＝同裝置並排、face＝同裝置面對面（黑方文字倒轉）、online＝兩台裝置連線
let mode = 'local', mySide = 0, conn = null, pendingEnd = null;
const online = () => mode === 'online';
const myTurn = () => (!online() && mode !== 'ai') || turn === mySide;   // 連線或對電腦時，只能操作自己那方
const viewFlip = () => online() && mySide === 1;   // 連線時執黑的一方，棋盤轉 180° 讓自己在下方
// 文字朝向：讓該方玩家讀起來是正的
const textAng = side => (viewFlip() ? Math.PI : 0) + (mode === 'face' && side === 1 ? Math.PI : 0);
const $ = id => document.getElementById(id);
const alive = () => pieces.filter(p => p.hp > 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const setMsg = s => $('info').textContent = s;
// 血量與傷害都以愛心計，最小單位 ¼ 心
const quarter = x => Math.floor(x * 4 + 1e-9) / 4;
const hearts = n => {
  const w = Math.floor(n), f = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[n - w] || '';
  return w ? '♥'.repeat(w) + f : f + '♥';
};
const rnd = k => (Math.random() - 0.5) * 2 * k;

