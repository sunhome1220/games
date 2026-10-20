// ===== 強化卡牌 =====
const TYPE_NAME = { K: '帥', R: '俥', N: '傌', C: '炮', E: '象', G: '仕', P: '兵', P2: '士官長' };
// 數值名稱 → [顯示名稱, 格式化函式]；cells 以格為單位、hearts 以心為單位
const num = v => String(Math.round(v * 100) / 100);
const STAT_INFO = {
  dmg:     ['威力', v => `${v > 0 ? '+' : ''}${num(v)} 心`],
  range:   ['射程', v => `${v > 0 ? '+' : ''}${num(v / C)} 格`],
  min:     ['最小距離', v => `${v > 0 ? '+' : ''}${num(v / C)} 格`],
  splash:  ['波及範圍', v => `${v > 0 ? '+' : ''}${num(v / C)} 格`],
  aa:      ['防空範圍', v => `${v > 0 ? '+' : ''}${num(v / C)} 格`],
  hp:      ['血量上限', v => `${v > 0 ? '+' : ''}${num(v)} 心`],
  reload:  ['冷卻', v => `${v > 0 ? '+' : ''}${num(v)} 回合`],
  healAmt: ['每回合回復', v => `+${num(v)} 心`],
  armor:   ['減傷', v => `${v > 0 ? '+' : ''}${num(v)} 心（每次受傷少受這麼多，至少仍受 ¼ 心）`],
};
// 把 fx（乘以張數 n）轉成「俥 威力 +1 心、射程 +1 格」這類文字
function fxText(fx, n = 1) {
  return Object.entries(fx || {}).map(([k, st]) => `${TYPE_NAME[k] || k} ` + Object.entries(st).map(([stat, v]) => { const i = STAT_INFO[stat]; return i ? `${i[0]} ${i[1](v * n)}` : ''; }).filter(Boolean).join('、')).join('；');
}
const cardDesc = c => c.desc || [fxText(c.fx), c.foe ? '敵方：' + fxText(c.foe) : ''].filter(Boolean).join('；') || c.name;
// 卡牌等級：1 普通、2 稀有、3 瘋狂、4 終極魔法。選牌次數越多，高等級越容易出現（見 tierWeights）
const TIERS = { 1: { name: '普通', mark: '★' }, 2: { name: '稀有', mark: '★★' }, 3: { name: '瘋狂', mark: '★★★' }, 4: { name: '終極魔法', mark: '✨' } };
const tierOf = c => c.tier || 1;
const tierBadge = c => `<i class="tier t${tierOf(c)}">${TIERS[tierOf(c)].mark} ${TIERS[tierOf(c)].name}</i>`;
// 載入時檢查卡牌表：缺欄位、重複代號、未知的兵種／數值名稱、效果為空的卡一律剔除並在主控台警告，避免一筆錯誤毀掉整個遊戲
function validateCards(list) {
  const ids = new Set(), ok = [];
  for (const c of list) {
    const bad = [];
    if (!c || !c.id || !c.name || !c.ic) bad.push('缺少 id／name／ic');
    else if (ids.has(c.id)) bad.push('id 重複');
    if (c && !c.fx && !c.foe && !c.instant) bad.push('沒有 fx／foe 也沒有 instant');
    if (c && c.tier !== undefined && !TIERS[c.tier]) bad.push('tier 必須是 1～4');
    if (c && c.foe && !c.desc) bad.push('有 foe 的卡必須寫 desc');
    for (const grp of [(c && c.fx) || {}, (c && c.foe) || {}])
      for (const [k, st] of Object.entries(grp)) {
        if (!TYPES[k]) bad.push(`未知兵種 ${k}`);
        for (const stat of Object.keys(st)) if (!STAT_INFO[stat]) bad.push(`未知數值 ${stat}`);
      }
    if (c && !(c.max >= 1)) bad.push('max 必須 ≥ 1');
    if (bad.length) { console.warn('[強化卡牌] 已忽略：', c && c.id, bad.join('、')); continue; }
    if (c.off) continue;
    ids.add(c.id); ok.push(c);
  }
  return ok;
}
// 開局雙方各選 1 張；之後每方自己的每第 10 個回合開始時再選 1 張（三選一）。強化以「每方一份數值表」累加，
// 棋子的傷害、射程、血量、冷卻、防空範圍等都直接讀取這份表，所以對所有規則（含電腦對戰、連線同步）一律生效。
let cardEvery = 10;   // 每幾個回合選一次卡（開始畫面可設定：3／5／8／10／15／20）
const CARD_EVERY_OPTIONS = [3, 5, 8, 10, 15, 20];
try { const v = +localStorage.getItem('rc-every'); if (CARD_EVERY_OPTIONS.includes(v)) cardEvery = v; } catch (e) {}
{ const v = +new URLSearchParams(location.search).get('every'); if (CARD_EVERY_OPTIONS.includes(v)) cardEvery = v; }
let immune = [0, 0], extraTurn = [0, 0];   // 神之護盾（剩幾個「對手回合」）、時間暫停（還有幾次額外回合）；隨局面快照同步
let cardsOn = true;
try { cardsOn = localStorage.getItem('rc-cards') !== '0'; } catch (e) {}
{ const q = new URLSearchParams(location.search).get('cards'); if (q === '0') cardsOn = false; else if (q === '1') cardsOn = true; }
const ALL_TYPES = ['K', 'R', 'N', 'C', 'E', 'G', 'P', 'P2'];
const allFx = (stat, v) => Object.fromEntries(ALL_TYPES.map(k => [k, { [stat]: v }]));   // 全軍都加（或減）同一個數值
// 終極魔法用：對棋子造成法術傷害（無視減傷、但神之護盾擋得住；noKill 時至少留 ¼ 心，帥／將不會被法術直接擊殺），並在 delay 秒後播爆炸
function spellHit(p, d, delay = 0, noKill = false) {
  if (immune[p.s] > 0) { fx.push({ k: 'txt', x: p.x, y: p.y - R, txt: '免疫', t: 1.2, T: 1.2, col: '#2f6fb5', side: p.s, delay: delay || 0.001 }); return 0; }
  const floor = noKill ? Math.min(0.25, p.hp) : 0, dealt = Math.max(0, Math.min(d, p.hp - floor)); p.hp -= dealt; p.flash = 0.6;
  fx.push({ k: 'txt', x: p.x, y: p.y - R, txt: '-' + hearts(dealt), t: 1.4, T: 1.4, side: p.s, delay: delay || 0.001,
            start: () => { explode(p.x, p.y, p.hp <= 0); SFX.play('boom', p.hp <= 0); shake = Math.max(shake, 5); } });
  return dealt;
}
const deadOf = s => pieces.filter(p => p.s === s && p.hp <= 0 && p.t !== 'K');
// 復活的棋子回到出生點；被佔了就找最近的空交叉點（結果固定，連線兩邊一致）
function reviveCell(p) {
  const free = ([x, y]) => !alive().some(q => Math.hypot(q.x - x, q.y - y) < 1);
  return [[p.hx, p.hy], ...pointsFor({ ...p, T: TT[p.s][p.t] }).sort((a, b) => Math.hypot(a[0] - p.hx, a[1] - p.hy) - Math.hypot(b[0] - p.hx, b[1] - p.hy) || a[0] - b[0] || a[1] - b[1])].find(free);
}
// ───────────── 強化卡牌清單（想增減卡牌只要改這一段，「我的強化」清單與選牌畫面會自動跟著更新）─────────────
// 每張卡：{ id 唯一代號, ic 圖示, name 名稱, tier 等級 1普通／2稀有／3瘋狂／4終極魔法（省略＝1）, fx 效果（加強己方）, foe 效果（削弱敵方，格式同 fx、數值多為負數，必須寫 desc）, max 最多可拿幾張, need 需要己方還有這種棋子（K R N C E G P）, cond 額外條件函式(side)→布林,
//           desc 說明（可省略，省略時由 fx 自動產生）, instant 立即效果函式(side)（急救、補給這類不改數值的卡）, off: true 暫時停用 }
// fx 格式：{ 兵種代號: { 數值名: 增減量 } }，兵種代號 K 帥 R 俥 N 傌 C 炮 E 象 G 仕 P 兵 P2 士官長；
//         數值名 dmg 威力(心)／range 射程／min 最小距離／splash 波及範圍／aa 防空範圍（這三項單位是像素，用 C 的倍數表示格數）／hp 血量上限(心)／reload 冷卻回合／healAmt 每回合回復(心)
// 新增：在下面加一筆即可；停用：加 off: true；刪除：直接移除該筆（已經存在的對局不受影響）。格式有誤的卡會被忽略並在主控台警告。詳見 games/CARDS.md
const CARDS = validateCards([
  { id: 'r_dmg', ic: '🔫', name: '俥・加裝彈鏈', desc: '俥的機槍威力 +0.5 心', need: 'R', max: 3, fx: { R: { dmg: 0.5 } } },
  { id: 'r_rng', ic: '🎯', name: '俥・長管槍身', desc: '俥的射程 +1 格', need: 'R', max: 2, fx: { R: { range: C } } },
  { id: 'r_hp',  ic: '🛡️', name: '俥・加厚裝甲', desc: '俥的血量上限 +1 心，並回復 1 心', need: 'R', max: 2, fx: { R: { hp: 1 } } },
  { id: 'c_dmg', ic: '💣', name: '炮・高爆彈頭', desc: '炮的威力 +0.5 心', need: 'C', max: 3, fx: { C: { dmg: 0.5 } } },
  { id: 'c_rng', ic: '📡', name: '炮・增程火藥', desc: '炮的射程 +1.5 格', need: 'C', max: 2, fx: { C: { range: 1.5 * C } } },
  { id: 'c_min', ic: '↔️', name: '炮・近距調校', desc: '炮的最小距離 −1 格', need: 'C', max: 3, fx: { C: { min: -C } }, cond: s => TT[s].C.min > 0 },
  { id: 'c_spl', tier: 2, ic: '💥', name: '炮・擴大爆風', desc: '炮的波及範圍 +0.5 格', need: 'C', max: 2, fx: { C: { splash: 0.5 * C } } },
  { id: 'n_dmg', ic: '🚀', name: '傌・穿甲火箭', desc: '傌的火箭威力 +0.5 心', need: 'N', max: 3, fx: { N: { dmg: 0.5 } } },
  { id: 'n_rel', tier: 2, ic: '⚙️', name: '傌・自動裝填', desc: '傌的火箭冷卻 −1 回合（可降到無冷卻）', need: 'N', max: 1, fx: { N: { reload: -1 } }, cond: s => TT[s].N.reload > 0 },
  { id: 'n_spl', tier: 2, ic: '🎆', name: '傌・破片彈頭', desc: '傌的火箭也有範圍傷害（相鄰 1/2、斜角 1/4）', need: 'N', max: 1, fx: { N: { splash: 1.5 * C } } },
  { id: 'e_aa',  ic: '📶', name: '象・擴大雷達', desc: '象的防空範圍 +1 格', need: 'E', max: 3, fx: { E: { aa: C } } },
  { id: 'e_heal', tier: 2, ic: '💚', name: '象・戰地醫療', desc: '象每回合開始替 2.5 格內受傷最重（缺血最多）的一位友軍回復 1 心', need: 'E', max: 3, fx: { E: { healAmt: 1 } } },
  { id: 'e_rel', tier: 2, ic: '⚡', name: '象・快速冷卻', desc: '象攔截後不再冷卻', need: 'E', max: 1, fx: { E: { reload: -1 } }, cond: s => TT[s].E.reload > 0 },
  { id: 'e_dmg', tier: 2, ic: '🔫', name: '象・加強手槍', desc: '象的手槍威力 +1 心', need: 'E', max: 2, fx: { E: { dmg: 1 } } },
  { id: 'g_hp',  ic: '⛑️', name: '仕・防彈鋼盔', desc: '仕的血量上限 +1 心，並回復 1 心', need: 'G', max: 2, fx: { G: { hp: 1 } } },
  { id: 'k_hp',  ic: '🏰', name: '帥・鐵壁', desc: '帥／將的血量上限 +1 心，並回復 1 心', need: 'K', max: 2, fx: { K: { hp: 1 } } },
  { id: 'k_dmg', ic: '🎖️', name: '帥・指揮官配槍', desc: '帥／將的手槍威力 +1 心', need: 'K', max: 2, fx: { K: { dmg: 1 } } },
  { id: 'p_dmg', ic: '🪖', name: '兵・火力全開', desc: '兵與士官長的槍械威力 +0.5 心', need: 'P', max: 3, fx: { P: { dmg: 0.5 }, P2: { dmg: 0.5 } } },
  { id: 'p_hp',  ic: '🦺', name: '兵・防彈背心', desc: '兵與士官長的血量上限 +1 心，並回復 1 心', need: 'P', max: 2, fx: { P: { hp: 1 }, P2: { hp: 1 } } },
  { id: 'all_rng', ic: '🔭', name: '全軍・望遠鏡', desc: '所有武器射程 +0.5 格', max: 2, fx: Object.fromEntries(['K', 'R', 'N', 'C', 'E', 'P', 'P2'].map(k => [k, { range: 0.5 * C }])) },
  { id: 'all_heal', ic: '🚑', name: '全軍・急救包', desc: '所有己方棋子立即回復 1 心', max: 3, instant: s => { for (const p of pieces) if (p.s === s && p.hp > 0 && p.hp < p.T.hp) { const h = Math.min(1, p.T.hp - p.hp); p.hp += h; healFX(p, h); } }, cond: s => pieces.some(p => p.s === s && p.hp > 0 && p.hp < p.T.hp) },
  { id: 'sup',   ic: '📦', name: '空投補給', desc: '傷得最重的一顆己方棋子立即回滿血', max: 5, instant: s => { let best = null, miss = 0; for (const p of pieces) if (p.s === s && p.hp > 0 && p.T.hp - p.hp > miss) { best = p; miss = p.T.hp - p.hp; } if (best) { healFX(best, miss); best.hp = best.T.hp; } }, cond: s => pieces.some(p => p.s === s && p.hp > 0 && p.hp < p.T.hp) },
  // ── 稀有（★★）──
  { id: 'r_dmg2', tier: 2, ic: '🔥', name: '俥・穿甲彈', desc: '俥的機槍威力 +1 心', need: 'R', max: 1, fx: { R: { dmg: 1 } } },
  { id: 'c_dmg2', tier: 2, ic: '☄️', name: '炮・重型彈頭', desc: '炮的威力 +1 心', need: 'C', max: 1, fx: { C: { dmg: 1 } } },
  { id: 'n_dmg2', tier: 2, ic: '🚀', name: '傌・雙彈頭火箭', desc: '傌的火箭威力 +1 心', need: 'N', max: 1, fx: { N: { dmg: 1 } } },
  { id: 'p_dmg2', tier: 2, ic: '🪖', name: '兵・特種彈藥', desc: '兵與士官長的槍械威力 +1 心', need: 'P', max: 1, fx: { P: { dmg: 1 }, P2: { dmg: 1 } } },
  { id: 'armor1', tier: 2, ic: '🦺', name: '全軍・防彈衣', desc: '己方所有棋子每次受傷少受 ¼ 心（至少仍受 ¼ 心）', max: 1, fx: allFx('armor', 0.25) },
  { id: 'all_hp1', tier: 2, ic: '💗', name: '全軍・營養加餐', desc: '己方所有棋子血量上限 +1 心，並回復 1 心', max: 1, fx: allFx('hp', 1) },
  { id: 'foe_rng', tier: 2, ic: '📉', name: '敵方・干擾電波', desc: '敵方所有武器射程 −0.5 格（最低 1 格）', max: 1, foe: allFx('range', -0.5 * C) },
  // ── 瘋狂（★★★）──
  { id: 'all_dmg', tier: 3, ic: '🌋', name: '全軍・狂暴化', desc: '己方所有武器威力 +1 心', max: 1, fx: allFx('dmg', 1) },
  { id: 'all_rng2', tier: 3, ic: '🦅', name: '全軍・鷹眼', desc: '己方所有武器射程 +1 格', max: 1, fx: allFx('range', C) },
  { id: 'armor2', tier: 3, ic: '🧱', name: '全軍・鈦合金裝甲', desc: '己方所有棋子再減傷 ¼ 心（和防彈衣疊加後每次少受 ½ 心）', max: 1, fx: allFx('armor', 0.25) },
  { id: 'c_super', tier: 3, ic: '🛰️', name: '炮・戰略迫擊砲彈', desc: '炮的威力 +1 心、射程 +1 格、波及範圍 +0.5 格', need: 'C', max: 1, fx: { C: { dmg: 1, range: C, splash: 0.5 * C } } },
  { id: 'k_god', tier: 3, ic: '👑', name: '帥・天命所歸', desc: '帥／將的血量上限 +2 心並回復 2 心，手槍威力 +1 心', need: 'K', max: 1, fx: { K: { hp: 2, dmg: 1 } } },
  { id: 'heal_all', tier: 3, ic: '💞', name: '象・生生不息', desc: '象的戰地醫療每回合再多回復 1 心', need: 'E', max: 1, fx: { E: { healAmt: 1 } }, off: true },   // 暫時停用：戰地醫療改為每回合固定補 1 心，不再有額外加量
  { id: 'foe_dmg', tier: 3, ic: '🧪', name: '敵方・彈藥受潮', desc: '敵方所有武器威力 −0.5 心（最低 ¼ 心）', max: 1, foe: allFx('dmg', -0.5) },
  { id: 'foe_hp', tier: 3, ic: '🦠', name: '敵方・疾病蔓延', desc: '敵方所有棋子血量上限 −1 心（現有血量超過上限的會被削掉，最低 1 心）', max: 1, foe: allFx('hp', -1) },
  { id: 'foe_reload', tier: 3, ic: '⛓️', name: '敵方・全面卡彈', desc: '敵方俥、傌、炮、象的冷卻都 +1 回合', max: 1, foe: { R: { reload: 1 }, N: { reload: 1 }, C: { reload: 1 }, E: { reload: 1 } } },
  { id: 'foe_aa', tier: 3, ic: '📵', name: '敵方・雷達失靈', desc: '敵方象的防空範圍 −1.5 格（最低 ½ 格）', max: 1, foe: { E: { aa: -1.5 * C } } },
  // ── 終極魔法（✨，只在後期選牌才可能出現，每次三選一最多出現一張）──
  { id: 'ult_meteor', tier: 4, ic: '☄️', name: '終極魔法・隕石雨', desc: '指定一個直徑 4 格的圓形範圍，範圍內所有棋子（敵我不分，帥／將也會）各受 1 心傷害', max: 1, area: true,
    instant: (s, at) => {
      const c = at || aiMeteorCenter(s), hit = meteorHits(c.x, c.y), when = i => 0.5 + i * 0.12;   // 每顆隕石依序落下，when＝落地時間（和傷害的 delay 對齊）
      const extra = Array.from({ length: 5 }, (_, i) => { const a = Math.random() * 7, r = Math.sqrt(Math.random()) * METEOR_R; return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, at: 0.45 + i * 0.17 }; });   // 範圍內多幾顆純視覺的隕石
      ultCast('meteor', s, [...hit.map((p, i) => ({ x: p.x, y: p.y, at: when(i) })), ...extra].sort((a, b) => a.at - b.at));
      hit.forEach((p, i) => spellHit(p, 1, when(i), false)); checkWin();
    } },
  { id: 'ult_revive', tier: 4, ic: '😇', name: '終極魔法・起死回生', desc: '復活最多 2 顆己方陣亡的棋子（優先價值高的，帥除外），滿血回到出生點', max: 1, cond: s => deadOf(s).length > 0,
    instant: s => {
      const ts = [];
      for (const p of deadOf(s).sort((a, b) => unitValue(b) - unitValue(a)).slice(0, 2)) {
        const [x, y] = reviveCell(p); p.T = TT[s][p.t]; p.hp = p.T.hp; p.x = x; p.y = y; p.cd = 0; p.vx = p.vy = 0; p.flash = 0.8; ts.push({ x, y, at: 0.15 + ts.length * 0.25 });
        flashAt(x, y, 70, 0.3); emit(x, y, 30, { k: 'spark', sp: 160, life: 0.9, size: 3, col: '#7dff9a' }); parts.push({ x, y, vx: 0, vy: 0, t: 0.6, L: 0.6, size: 70, k: 'ring', drag: 0 });
      }
      ultCast('revive', s, ts);
    } },
  { id: 'ult_time', tier: 4, ic: '⏳', name: '終極魔法・時間暫停', desc: '這個回合結束後，你再行動一次（對手跳過一回合）', max: 1,
    instant: s => { extraTurn[s]++; ultCast('time', s); } },
  { id: 'ult_shield', tier: 4, ic: '🛡️', name: '終極魔法・神之護盾', desc: '己方所有棋子在對手的下一個回合完全免疫傷害', max: 1,
    instant: s => { immune[s] = 1; ultCast('shield', s, alive().filter(q => q.s === s).map(p => ({ x: p.x, y: p.y, at: 0.2 }))); } },
  { id: 'ult_judge', tier: 4, ic: '⚡', name: '終極魔法・天雷審判', desc: '敵方帥／將受 1.5 心雷擊（不會被直接打死，最少剩 ¼ 心）', max: 1,
    instant: s => { const ks = alive().filter(p => p.s === 1 - s && p.t === 'K'); ultCast('judge', s, ks.map(k => ({ x: k.x, y: k.y, at: 0.35 }))); for (const k of ks) spellHit(k, 1.5, 0.37, true); checkWin(); } },
  { id: 'ult_freeze', tier: 4, ic: '❄️', name: '終極魔法・冰封世界', desc: '敵方俥、傌、炮、象全部進入 2 回合冷卻（俥、傌只剩步槍，炮不能開火，象不能防空）', max: 1,
    instant: s => { const ps = alive().filter(q => q.s === 1 - s && q.T.reload > 0); for (const p of ps) p.cd = Math.max(p.cd || 0, 2); ultCast('freeze', s, ps.map(p => ({ x: p.x, y: p.y, at: 0.45 }))); } },
]);
const cardOf = id => CARDS.find(c => c.id === id);
// 隕石雨：落點是圓心，半徑 2 格（直徑 4 格）；範圍內敵我不分
const METEOR_R = 2 * C;
const meteorHits = (x, y) => alive().filter(p => Math.hypot(p.x - x, p.y - y) <= METEOR_R + 1);
// 電腦選落點：掃過所有交叉點，挑「對自己最有利」的圓心（打到敵人加分、誤傷自己扣分，打死自己的帥是大扣分）
function aiMeteorCenter(side) {
  let best = null;
  for (let c = 0; c <= 8; c++) for (let r = 0; r <= 9; r++) {
    const x = M + c * C, y = M + r * C, dm = new Map();
    for (const p of meteorHits(x, y)) { const d = effDmg(p, 1); if (d > 0) dm.set(p, d); }
    const v = dmgValue(dm, side) + Math.random() * 0.01;
    if (!best || v > best.v) best = { x, y, v };
  }
  return best;
}
let pickQ = [], pickSide = null, waitingFor = null, incoming = [];
const CARD_STACK = false;   // 是否允許同一張卡重複拿來疊加（false＝每張卡只能拿一次；max 仍保留，改成 true 即恢復疊加）
function cardOk(c, side) {
  if ((cardCount[side][c.id] || 0) >= (CARD_STACK ? c.max : 1)) return false;
  if (c.need && !pieces.some(p => p.s === side && p.hp > 0 && p.t === c.need)) return false;
  return !c.cond || c.cond(side);
}
// 各檔次的出現機率，依「這一方已經選過幾張」（k）逐步往高等級移動：第 1 張只會是普通卡，之後越來越瘋狂，終極魔法要第 4 次選牌之後才有機會
const TIER_WEIGHTS = [[1, 0, 0, 0], [0.6, 0.4, 0, 0], [0.3, 0.5, 0.2, 0], [0.1, 0.4, 0.4, 0.1], [0, 0.2, 0.5, 0.3]];
const picksOf = side => Object.values(cardCount[side]).reduce((a, b) => a + b, 0);
function drawOffers(side, rand = Math.random) {
  const w = TIER_WEIGHTS[Math.min(picksOf(side), TIER_WEIGHTS.length - 1)], pool = CARDS.filter(c => cardOk(c, side)), out = [];
  while (out.length < 3 && pool.length) {
    const ok = pool.filter(c => tierOf(c) < 4 || !out.some(o => tierOf(o) === 4));   // 一次最多一張終極魔法
    if (!ok.length) break;
    const tiers = [1, 2, 3, 4].filter(t => ok.some(c => tierOf(c) === t)), tw = tiers.map(t => w[t - 1]), sum = tw.reduce((a, b) => a + b, 0);
    let r = rand() * (sum || tiers.length), t = tiers[tiers.length - 1];
    for (let i = 0; i < tiers.length; i++) { r -= sum ? tw[i] : 1; if (r < 0) { t = tiers[i]; break; } }   // 該等級沒牌時（sum 為 0）就從現有的等級平均抽
    const cand = ok.filter(c => tierOf(c) === t), c = cand[Math.floor(rand() * cand.length)];
    out.push(c); pool.splice(pool.indexOf(c), 1);
  }
  return out;
}
function applyCard(side, id, at) {
  const c = cardOf(id); if (!c) return;
  cardCount[side][id] = (cardCount[side][id] || 0) + 1;
  const add = (who, grp) => { for (const [k, st] of Object.entries(grp || {})) { mods[who][k] = mods[who][k] || {}; for (const [stat, v] of Object.entries(st)) mods[who][k][stat] = (mods[who][k][stat] || 0) + v; } };
  add(side, c.fx); add(1 - side, c.foe);   // fx 加強自己，foe 削弱對手
  buildTypes(side); buildTypes(1 - side);
  for (const p of pieces) {
    p.T = TT[p.s][p.T.id];
    if (p.s === side) { const bonus = c.fx && c.fx[p.T.id] && c.fx[p.T.id].hp; if (bonus && p.hp > 0) p.hp = Math.min(p.T.hp, p.hp + bonus); }
    else if (p.hp > p.T.hp) p.hp = p.T.hp;   // 敵方血量上限被削：現有血量不能超過新上限
  }
  if (c.instant) c.instant(side, at);
  if (tierOf(c) === 3) gainFlash(3);   // 瘋狂卡：全螢幕紫光（終極魔法有自己的動畫，見 ultimate.js）
  if (tierOf(c) < 4) SFX.play('card');   // 終極魔法有自己的聲音（見 ultimate.js）
  toast(`${SIDE[side].name}獲得${tierOf(c) >= 4 ? '' : '強化'}：${c.ic} ${c.name}`); renderPerks();
}
// 戰地醫療：side 方回合開始時，只替「象 2.5 格內、受傷最重（缺血最多，同樣多時取現有血量較少者）」的一位友軍回復（多隻象取最大回復量）
function healPhase(side) {
  const hs = alive().filter(p => p.s === side && p.T.healAmt > 0);
  if (!hs.length) return;
  let best = null, amt = 0;
  for (const q of alive()) if (q.s === side && q.hp < q.T.hp) {
    const a = Math.max(0, ...hs.filter(h => Math.hypot(h.x - q.x, h.y - q.y) <= 2.5 * C + 1).map(h => h.T.healAmt));
    const miss = q.T.hp - q.hp;
    if (a > 0 && (!best || miss > best.T.hp - best.hp || (miss === best.T.hp - best.hp && q.hp < best.hp))) { best = q; amt = a; }
  }
  if (!best) return;
  const h = Math.min(amt, best.T.hp - best.hp); best.hp += h; healFX(best, h);
  SFX.play('heal');
}
function healFX(q, amt) {
  fx.push({ k: 'txt', x: q.x, y: q.y - R, txt: '+' + hearts(amt), t: 1.3, T: 1.3, col: '#159447', side: q.s });
  emit(q.x, q.y, 10, { k: 'spark', sp: 70, life: 0.7, size: 2.5, col: '#7dff9a' });
}
let toastTimer = 0;
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => e.classList.remove('on'), 2600); }
// 特別卡的動畫：瘋狂（3）紫色閃電、終極魔法（4）金色光芒；選牌畫面依這次最高等級播開場動畫，拿到卡時再播一次全螢幕閃光
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function gainFlash(tier) {
  if (reduceMotion()) return;
  const e = document.createElement('div'); e.className = 'gainFlash t' + tier; document.body.appendChild(e);
  setTimeout(() => e.remove(), 1500);
}
// 距離下次選牌還要下完幾個回合（和「我的強化」清單同一算法）
const drawLeft = side => cardEvery - (turnsPlayed[side] % cardEvery);
function renderDrawIn() {
  const e = $('drawIn'); if (!e) return;
  e.hidden = !cardsOn;
  if (!cardsOn) return;
  const solo = mode === 'ai' || online(), sides = solo ? [mySide] : [0, 1];
  e.innerHTML = '🎴 ' + sides.map(s => { const n = drawLeft(s); return `${solo ? '' : SIDE[s].name + ' '}<b class="${n === 1 ? 'soon' : ''}">${n === 1 ? '下回合抽卡' : '再 ' + n + ' 回合抽卡'}</b>`; }).join('　');
  e.title = `每 ${cardEvery} 回合抽一次強化卡`;
}
function renderPerks() {
  renderDrawIn();
  const part = s => { const l = Object.entries(cardCount[s]).filter(([id]) => cardOf(id)).map(([id, n]) => `${cardOf(id).ic}${cardOf(id).name.split('・')[1] || cardOf(id).name}${n > 1 ? '×' + n : ''}`); return l.length ? `<b>${SIDE[s].name}</b> ${l.join('、')}` : ''; };
  $('perks').innerHTML = [part(0), part(1)].filter(Boolean).join('　｜　');
  const total = cardCount[0] && Object.values(cardCount[mode === 'ai' || online() ? mySide : 0]).reduce((a, b) => a + b, 0);
  $('perkBtn').hidden = !cardsOn; $('perkBtn').textContent = '🃏 我的強化' + (total ? `（${total}）` : '');
  if (!$('perkOv').hidden) showPerks(perkTab);
}
// 「我的強化」清單：列出某一方已拿到的所有卡、張數、說明與累計效果，並提示下次選牌的時機。資料全部來自 CARDS，卡牌增減會自動反映
let perkTab = 0;
function showPerks(side) {
  perkTab = side;
  const mine = mode === 'ai' || online() ? mySide : -1;   // 對電腦／連線時標示哪一方是自己
  for (const s of [0, 1]) { const b = $('pTab' + s); b.textContent = SIDE[s].name + (s === mine ? '（我）' : ''); b.classList.toggle('on', s === side); }
  const list = Object.entries(cardCount[side]).filter(([id]) => cardOf(id));
  const left = cardEvery - (turnsPlayed[side] % cardEvery);
  $('perkBody').innerHTML = (list.length ? list.map(([id, n]) => {
    const c = cardOf(id), total = c.fx ? fxText(c.fx, n) : '';
    return `<div class="pitem"><div class="ic">${c.ic}</div><div>${tierBadge(c)}<b>${c.name}${n > 1 ? ` ×${n}` : ''}</b><span>${cardDesc(c)}</span>${total && n > 1 ? `<em>累計：${total}</em>` : total ? `<em>目前效果：${total}</em>` : ''}</div></div>`;
  }).join('') : '<div class="empty">還沒有獲得任何強化</div>') +
    `<div class="next">${cardsOn ? `${SIDE[side].name}還要下完 ${left} 個回合，就能再選一張強化卡` : '強化卡牌目前已關閉'}</div>`;
  $('perkOv').hidden = false;
}
$('perkBtn').onclick = () => showPerks(mode === 'ai' || online() ? mySide : turn);
$('pTab0').onclick = () => showPerks(0); $('pTab1').onclick = () => showPerks(1);
$('perkClose').onclick = () => { $('perkOv').hidden = true; };
// 選牌流程：pickQ 依序處理；自己這台裝置上的人類顯示三選一，電腦自動選，連線對手則等他的選擇訊息
function beginPick(sides) { pickQ = sides.slice(); state = 'pick'; sel = null; targets = []; setSkip(false); nextPick(); }
function nextPick() {
  if (!pickQ.length) {
    pickSide = null; waitingFor = null; $('cardPick').hidden = true;
    if (state === 'pick') state = 'aim';
    updateHeader();
    if (online() && !myTurn()) setMsg('等待對手操作…'); else setMsg('強化完成！' + (turn === 0 || !online() ? '請選擇棋子。' : ''));
    return;
  }
  const side = pickSide = pickQ.shift(), mine = mode === 'local' || mode === 'face' || mySide === side;
  state = 'pick'; updateHeader();
  if (mode === 'ai' && side === aiSide()) {
    $('cardPick').hidden = true; setMsg('電腦正在選擇強化卡…');
    const gen = aiGen; setTimeout(() => {
      if (gen !== aiGen || pickSide !== side) return;
      const o = drawOffers(side); if (o.length) { const top = Math.max(...o.map(tierOf)), best = o.filter(c => tierOf(c) === top); applyCard(side, best[Math.floor(Math.random() * best.length)].id); }   // 電腦選等級最高的
      nextPick();
    }, 900);
  } else if (mine) showCards(side);
  else { $('cardPick').hidden = true; waitingFor = side; setMsg(`等待對手選擇強化卡…`); drainIncoming(); }
}
function showCards(side) {
  const offers = drawOffers(side);
  if (!offers.length) { nextPick(); return; }
  $('cardTitle').textContent = `${SIDE[side].name}・選擇一張強化卡`;
  $('cardSub').textContent = `三選一，效果立刻生效；之後每 ${cardEvery} 回合再選一次（越後面的卡越瘋狂）`;
  $('cardBox').classList.toggle('flip', mode === 'face' && side === 1);   // 面對面：黑方這邊的畫面倒轉
  const list = $('cardList'); list.innerHTML = '';
  const top = Math.max(...offers.map(tierOf)), box = $('cardBox');
  box.classList.remove('top2', 'top3', 'top4'); void box.offsetWidth; if (top >= 2) box.classList.add('top' + top);
  $('cardTitle').textContent += top >= 4 ? ' ✨終極降臨！' : top === 3 ? ' ⚡瘋狂！' : '';
  if (top >= 3) { gainFlash(top); SFX.play(top >= 4 ? 'win' : 'card'); }
  offers.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'cbtn t' + tierOf(c); b.style.setProperty('--d', (i * 0.18) + 's');
    const n = cardCount[side][c.id] || 0;
    b.innerHTML = `<div class="ic">${c.ic}</div><div>${tierBadge(c)}<b>${c.name}</b><span>${cardDesc(c)}</span>${n ? `<br><em>已持有 ${n} 張，效果疊加</em>` : ''}</div>`;
    b.onclick = () => chooseCard(side, c.id);
    list.appendChild(b);
  });
  $('cardPick').hidden = false; setMsg('請選擇強化卡。');
}
function chooseCard(side, id) {
  if (pickSide !== side) return;
  $('cardPick').hidden = true;
  const c = cardOf(id);
  if (c && c.area && !(mode === 'ai' && side === aiSide())) { beginAreaPick(side, c); return; }   // 要選範圍的卡：先讓玩家點落點、按「降下」才生效
  applyCard(side, id); send({ t: 'card', side, id });
  nextPick();
}
// ---- 選範圍（隕石雨）：點棋盤放圓圈（吸附到交叉點）、預覽範圍內的棋子，按「降下」確認 ----
let spell = null;   // { side, id, x, y }；x、y 為 null＝還沒點
function beginAreaPick(side, c) {
  spell = { side, id: c.id, x: null, y: null }; state = 'spell'; sel = null; targets = []; setSkip(false);
  $('spellTxt').textContent = `${c.ic} ${c.name}：點棋盤選擇落點（直徑 4 格的圓，敵我不分）`; $('spellGo').disabled = true;
  $('spellBox').hidden = false; $('spellBox').classList.toggle('flip', mode === 'face' && side === 1);
  updateHeader(); setMsg('☄️ 點棋盤選擇隕石落點，可重新點選；按「降下」確認。');
}
function spellTap(m) {
  if (!spell) return;
  const cx = Math.max(0, Math.min(8, Math.round((m.x - M) / C))), cy = Math.max(0, Math.min(9, Math.round((m.y - M) / C)));
  spell.x = M + cx * C; spell.y = M + cy * C;
  const hit = meteorHits(spell.x, spell.y), foe = hit.filter(p => p.s !== spell.side), me = hit.filter(p => p.s === spell.side);
  $('spellTxt').textContent = `範圍內：敵 ${foe.length} 顆、我 ${me.length} 顆` + (me.some(p => p.t === 'K') ? '　⚠️ 我方帥在範圍內！' : '') + (foe.some(p => p.t === 'K') ? '　敵方帥在範圍內' : '');
  $('spellGo').disabled = false; SFX.play('click');
}
$('spellGo').onclick = () => {
  if (!spell || spell.x === null) return;
  const { side, id, x, y } = spell; spell = null; $('spellBox').hidden = true; state = 'pick';
  applyCard(side, id, { x, y }); send({ t: 'card', side, id, x, y });
  nextPick();
};
// 預覽：圓圈＋範圍內的棋子（敵方紅、我方藍）。畫在棋盤座標上，2D 與 3D 的地面都用得到
function drawSpellPreview() {
  if (state !== 'spell' || !spell || spell.x === null) return;
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 180);
  ctx.save();
  ctx.fillStyle = '#ff7a1a33'; ctx.beginPath(); ctx.arc(spell.x, spell.y, METEOR_R, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 3; ctx.setLineDash([9, 6]); ctx.globalAlpha = pulse; ctx.beginPath(); ctx.arc(spell.x, spell.y, METEOR_R, 0, 7); ctx.stroke();
  ctx.setLineDash([]); ctx.lineWidth = 4;
  for (const p of meteorHits(spell.x, spell.y)) { ctx.strokeStyle = p.s === spell.side ? '#2f6fb5' : '#e8202a'; ctx.beginPath(); ctx.arc(p.x, p.y, R + 5, 0, 7); ctx.stroke(); }
  ctx.restore();
}
function drainIncoming() {
  if (waitingFor === null) return;
  const i = incoming.findIndex(m => m.side === waitingFor);
  if (i < 0) return;
  const [m] = incoming.splice(i, 1); waitingFor = null;
  applyCard(m.side, m.id, m.x !== undefined ? { x: m.x, y: m.y } : undefined); nextPick();
}
// 每方自己的第 N、2N、3N… 個回合開始前選牌（N = cardEvery）
function maybeTurnPick() {
  if (!cardsOn || winner !== null || state === 'over') return false;
  const k = turnsPlayed[turn];
  if (k > 0 && k % cardEvery === 0) { beginPick([turn]); return true; }
  return false;
}
function showCardsBtn() { $('mCards').firstChild.textContent = `🃏 強化卡牌：${cardsOn ? '開' : '關'}`; $('mCards').style.opacity = cardsOn ? 1 : 0.65; }
$('mCards').onclick = () => {
  cardsOn = !cardsOn; showCardsBtn();
  try { localStorage.setItem('rc-cards', cardsOn ? '1' : '0'); } catch (e) {}
};
showCardsBtn();

function showEvery() { $('mEvery').textContent = `⏱ 每 ${cardEvery} 回合選一次卡（點一下切換）`; }
$('mEvery').onclick = () => {
  cardEvery = CARD_EVERY_OPTIONS[(CARD_EVERY_OPTIONS.indexOf(cardEvery) + 1) % CARD_EVERY_OPTIONS.length]; showEvery();
  try { localStorage.setItem('rc-every', cardEvery); } catch (e) {}
};
showEvery();
