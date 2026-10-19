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
};
// 把 fx（乘以張數 n）轉成「俥 威力 +1 心、射程 +1 格」這類文字
function fxText(fx, n = 1) {
  return Object.entries(fx || {}).map(([k, st]) => `${TYPE_NAME[k] || k} ` + Object.entries(st).map(([stat, v]) => { const i = STAT_INFO[stat]; return i ? `${i[0]} ${i[1](v * n)}` : ''; }).filter(Boolean).join('、')).join('；');
}
const cardDesc = c => c.desc || fxText(c.fx) || c.name;
// 載入時檢查卡牌表：缺欄位、重複代號、未知的兵種／數值名稱、效果為空的卡一律剔除並在主控台警告，避免一筆錯誤毀掉整個遊戲
function validateCards(list) {
  const ids = new Set(), ok = [];
  for (const c of list) {
    const bad = [];
    if (!c || !c.id || !c.name || !c.ic) bad.push('缺少 id／name／ic');
    else if (ids.has(c.id)) bad.push('id 重複');
    if (c && !c.fx && !c.instant) bad.push('沒有 fx 也沒有 instant');
    for (const [k, st] of Object.entries((c && c.fx) || {})) {
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
let cardsOn = true;
try { cardsOn = localStorage.getItem('rc-cards') !== '0'; } catch (e) {}
{ const q = new URLSearchParams(location.search).get('cards'); if (q === '0') cardsOn = false; else if (q === '1') cardsOn = true; }
// ───────────── 強化卡牌清單（想增減卡牌只要改這一段，「我的強化」清單與選牌畫面會自動跟著更新）─────────────
// 每張卡：{ id 唯一代號, ic 圖示, name 名稱, fx 效果, max 最多可拿幾張, need 需要己方還有這種棋子（K R N C E G P）, cond 額外條件函式(side)→布林,
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
  { id: 'c_spl', ic: '💥', name: '炮・擴大爆風', desc: '炮的波及範圍 +0.5 格', need: 'C', max: 2, fx: { C: { splash: 0.5 * C } } },
  { id: 'n_dmg', ic: '🚀', name: '傌・穿甲火箭', desc: '傌的火箭威力 +0.5 心', need: 'N', max: 3, fx: { N: { dmg: 0.5 } } },
  { id: 'n_rel', ic: '⚙️', name: '傌・自動裝填', desc: '傌的火箭冷卻 −1 回合（可降到無冷卻）', need: 'N', max: 1, fx: { N: { reload: -1 } }, cond: s => TT[s].N.reload > 0 },
  { id: 'n_spl', ic: '🎆', name: '傌・破片彈頭', desc: '傌的火箭也有範圍傷害（相鄰 1/2、斜角 1/4）', need: 'N', max: 1, fx: { N: { splash: 1.5 * C } } },
  { id: 'e_aa',  ic: '📶', name: '象・擴大雷達', desc: '象的防空範圍 +1 格', need: 'E', max: 3, fx: { E: { aa: C } } },
  { id: 'e_heal', ic: '💚', name: '象・戰地醫療', desc: '象每回合開始替 2.5 格內血量最少的一位友軍回復 ½ 心', need: 'E', max: 3, fx: { E: { healAmt: 0.5 } } },
  { id: 'e_rel', ic: '⚡', name: '象・快速冷卻', desc: '象攔截後不再冷卻', need: 'E', max: 1, fx: { E: { reload: -1 } }, cond: s => TT[s].E.reload > 0 },
  { id: 'e_dmg', ic: '🔫', name: '象・加強手槍', desc: '象的手槍威力 +1 心', need: 'E', max: 2, fx: { E: { dmg: 1 } } },
  { id: 'g_hp',  ic: '⛑️', name: '仕・防彈鋼盔', desc: '仕的血量上限 +1 心，並回復 1 心', need: 'G', max: 2, fx: { G: { hp: 1 } } },
  { id: 'k_hp',  ic: '🏰', name: '帥・鐵壁', desc: '帥／將的血量上限 +1 心，並回復 1 心', need: 'K', max: 2, fx: { K: { hp: 1 } } },
  { id: 'k_dmg', ic: '🎖️', name: '帥・指揮官配槍', desc: '帥／將的手槍威力 +1 心', need: 'K', max: 2, fx: { K: { dmg: 1 } } },
  { id: 'p_dmg', ic: '🪖', name: '兵・火力全開', desc: '兵與士官長的槍械威力 +0.5 心', need: 'P', max: 3, fx: { P: { dmg: 0.5 }, P2: { dmg: 0.5 } } },
  { id: 'p_hp',  ic: '🦺', name: '兵・防彈背心', desc: '兵與士官長的血量上限 +1 心，並回復 1 心', need: 'P', max: 2, fx: { P: { hp: 1 }, P2: { hp: 1 } } },
  { id: 'all_rng', ic: '🔭', name: '全軍・望遠鏡', desc: '所有武器射程 +0.5 格', max: 2, fx: Object.fromEntries(['K', 'R', 'N', 'C', 'E', 'P', 'P2'].map(k => [k, { range: 0.5 * C }])) },
  { id: 'all_heal', ic: '🚑', name: '全軍・急救包', desc: '所有己方棋子立即回復 1 心', max: 3, instant: s => { for (const p of pieces) if (p.s === s && p.hp > 0 && p.hp < p.T.hp) { const h = Math.min(1, p.T.hp - p.hp); p.hp += h; healFX(p, h); } }, cond: s => pieces.some(p => p.s === s && p.hp > 0 && p.hp < p.T.hp) },
  { id: 'sup',   ic: '📦', name: '空投補給', desc: '傷得最重的一顆己方棋子立即回滿血', max: 5, instant: s => { let best = null, miss = 0; for (const p of pieces) if (p.s === s && p.hp > 0 && p.T.hp - p.hp > miss) { best = p; miss = p.T.hp - p.hp; } if (best) { healFX(best, miss); best.hp = best.T.hp; } }, cond: s => pieces.some(p => p.s === s && p.hp > 0 && p.hp < p.T.hp) },
]);
const cardOf = id => CARDS.find(c => c.id === id);
let pickQ = [], pickSide = null, waitingFor = null, incoming = [];
const CARD_STACK = false;   // 是否允許同一張卡重複拿來疊加（false＝每張卡只能拿一次；max 仍保留，改成 true 即恢復疊加）
function cardOk(c, side) {
  if ((cardCount[side][c.id] || 0) >= (CARD_STACK ? c.max : 1)) return false;
  if (c.need && !pieces.some(p => p.s === side && p.hp > 0 && p.t === c.need)) return false;
  return !c.cond || c.cond(side);
}
function drawOffers(side) {
  const pool = CARDS.filter(c => cardOk(c, side)), out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
function applyCard(side, id) {
  const c = cardOf(id); if (!c) return;
  cardCount[side][id] = (cardCount[side][id] || 0) + 1;
  for (const [k, st] of Object.entries(c.fx || {})) {
    mods[side][k] = mods[side][k] || {};
    for (const [stat, v] of Object.entries(st)) mods[side][k][stat] = (mods[side][k][stat] || 0) + v;
  }
  buildTypes(side);
  for (const p of pieces) if (p.s === side) {
    p.T = TT[side][p.T.id];
    const bonus = c.fx && c.fx[p.T.id] && c.fx[p.T.id].hp;
    if (bonus && p.hp > 0) p.hp = Math.min(p.T.hp, p.hp + bonus);
  }
  if (c.instant) c.instant(side);
  SFX.play('card'); toast(`${SIDE[side].name}獲得強化：${c.ic} ${c.name}`); renderPerks();
}
// 戰地醫療：side 方回合開始時，只替「象 2.5 格內、血量最少」的一位友軍回復（多隻象取最大回復量）
function healPhase(side) {
  const hs = alive().filter(p => p.s === side && p.T.healAmt > 0);
  if (!hs.length) return;
  let best = null, amt = 0;
  for (const q of alive()) if (q.s === side && q.hp < q.T.hp) {
    const a = Math.max(0, ...hs.filter(h => Math.hypot(h.x - q.x, h.y - q.y) <= 2.5 * C + 1).map(h => h.T.healAmt));
    if (a > 0 && (!best || q.hp < best.hp)) { best = q; amt = a; }
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
function renderPerks() {
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
  const left = 10 - (turnsPlayed[side] % 10);
  $('perkBody').innerHTML = (list.length ? list.map(([id, n]) => {
    const c = cardOf(id), total = c.fx ? fxText(c.fx, n) : '';
    return `<div class="pitem"><div class="ic">${c.ic}</div><div><b>${c.name}${n > 1 ? ` ×${n}` : ''}</b><span>${cardDesc(c)}</span>${total && n > 1 ? `<em>累計：${total}</em>` : total ? `<em>目前效果：${total}</em>` : ''}</div></div>`;
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
      const o = drawOffers(side); if (o.length) applyCard(side, o[Math.floor(Math.random() * o.length)].id);
      nextPick();
    }, 900);
  } else if (mine) showCards(side);
  else { $('cardPick').hidden = true; waitingFor = side; setMsg(`等待對手選擇強化卡…`); drainIncoming(); }
}
function showCards(side) {
  const offers = drawOffers(side);
  if (!offers.length) { nextPick(); return; }
  $('cardTitle').textContent = `${SIDE[side].name}・選擇一張強化卡`;
  $('cardSub').textContent = '三選一，效果立刻生效；之後每 10 回合再選一次';
  $('cardBox').classList.toggle('flip', mode === 'face' && side === 1);   // 面對面：黑方這邊的畫面倒轉
  const list = $('cardList'); list.innerHTML = '';
  for (const c of offers) {
    const b = document.createElement('button'); b.className = 'cbtn';
    const n = cardCount[side][c.id] || 0;
    b.innerHTML = `<div class="ic">${c.ic}</div><div><b>${c.name}</b><span>${cardDesc(c)}</span>${n ? `<br><em>已持有 ${n} 張，效果疊加</em>` : ''}</div>`;
    b.onclick = () => chooseCard(side, c.id);
    list.appendChild(b);
  }
  $('cardPick').hidden = false; setMsg('請選擇強化卡。');
}
function chooseCard(side, id) {
  if (pickSide !== side) return;
  $('cardPick').hidden = true;
  applyCard(side, id); send({ t: 'card', side, id });
  nextPick();
}
function drainIncoming() {
  if (waitingFor === null) return;
  const i = incoming.findIndex(m => m.side === waitingFor);
  if (i < 0) return;
  const [m] = incoming.splice(i, 1); waitingFor = null;
  applyCard(m.side, m.id); nextPick();
}
// 每方自己的第 10、20、30… 個回合開始前選牌
function maybeTurnPick() {
  if (!cardsOn || winner !== null || state === 'over') return false;
  const k = turnsPlayed[turn];
  if (k > 0 && k % 10 === 0) { beginPick([turn]); return true; }
  return false;
}
function showCardsBtn() { $('mCards').firstChild.textContent = `🃏 強化卡牌：${cardsOn ? '開' : '關'}`; $('mCards').style.opacity = cardsOn ? 1 : 0.65; }
$('mCards').onclick = () => {
  cardsOn = !cardsOn; showCardsBtn();
  try { localStorage.setItem('rc-cards', cardsOn ? '1' : '0'); } catch (e) {}
};
showCardsBtn();

