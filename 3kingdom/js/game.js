// ===== 遊戲規則（不碰畫面，方便測試）=====
let G = null;
const FIDS = ['wei', 'shu', 'wu'];
const cityById = id => G.cities.find(c => c.id === id);
const neighborsOf = id => EDGES.filter(e => e.includes(id)).map(e => e[0] === id ? e[1] : e[0]);
const edgeLen = (a, b) => { const p = cityById(a), q = cityById(b); return Math.hypot(p.x - q.x, p.y - q.y); };
const turnsFor = (a, b) => Math.ceil(edgeLen(a, b) / ARMY_SPEED);
const gen = c => GENERALS[c.gen] || GENERALS.guard;
const ownedBy = f => G.cities.filter(c => c.owner === f);
const besieged = id => G.sieges.some(s => s.city === id);
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function log(txt, kind = '') { G.log.push({ turn: G.turn, txt, kind }); if (G.log.length > 200) G.log.shift(); }

function newGame(player = 'shu', seed = Date.now() % 100000) {
  G = {
    turn: 1, player, rng: mulberry32(seed), seed, phase: 'player', over: null, log: [], armies: [], sieges: [], nextId: 1, auto: false, fast: false,
    factions: Object.fromEntries(FIDS.map(f => [f, { gold: 300, alive: true }])),
    cities: CITY_DEFS.map(([id, name, x, y, owner, troops, wallMax, cap, income, g]) => ({ id, name, x, y, owner, troops, wall: wallMax, wallMax, cap, income, gen: g, capital: !!FACTIONS[owner].capital && FACTIONS[owner].capital === id })),
    selected: null,
  };
  log(`你是「${FACTIONS[player].name}」。攻下其他兩國的都城，一統天下！`, 'info');
  return G;
}

// ----- 玩家／AI 的命令 -----
const canSend = (c, troops) => !!c && troops >= MIN_SEND && c.troops - troops >= 0;
function dispatch(fromId, toId, troops) {
  const c = cityById(fromId);
  if (!neighborsOf(fromId).includes(toId) || !canSend(c, troops)) return null;
  c.troops -= troops;
  const a = { id: G.nextId++, owner: c.owner, troops, from: fromId, to: toId, pos: 0, prev: 0, len: edgeLen(fromId, toId), lead: gen(c).lead, name: gen(c).name };
  G.armies.push(a); return a;
}
function recruit(cityId) {
  const c = cityById(cityId), f = G.factions[c.owner];
  if (!f || f.gold < RECRUIT.cost || c.troops >= c.cap) return false;
  f.gold -= RECRUIT.cost; c.troops = Math.min(c.cap, c.troops + RECRUIT.troops); return true;
}
function repair(cityId) {
  const c = cityById(cityId), f = G.factions[c.owner];
  if (!f || f.gold < REPAIR.cost || c.wall >= c.wallMax) return false;
  f.gold -= REPAIR.cost; c.wall = Math.min(c.wallMax, c.wall + REPAIR.wall); return true;
}

// ----- 行軍：所有軍隊前進；同路對向相遇就野戰；抵達城池就增援或開始攻城 -----
const pw = (troops, lead, rng) => troops * (0.8 + 0.04 * lead) * (0.9 + 0.2 * rng());
// 兩支軍隊對戰，回傳 { winner: 'a'|'b', left }（勝者剩餘兵力）；平手算 b（守方）勝
function fieldFight(a, b, rng = G.rng) {
  const pa = pw(a.troops, a.lead, rng), pb = pw(b.troops, b.lead, rng);
  const win = pa > pb ? 'a' : 'b', P = Math.max(pa, pb), Q = Math.min(pa, pb), W = win === 'a' ? a : b;
  return { winner: win, left: Math.max(1, Math.round(W.troops * Math.sqrt(Math.max(0, 1 - (Q / P) ** 2)))) };
}
function stepArmies() {
  const events = []; G.ghosts = [];   // ghosts：這一步抵達或戰死的軍隊（畫面用來播完最後一段動畫）
  for (const a of G.armies) { a.prev = a.pos; a.pos += ARMY_SPEED; }
  for (const a of G.armies.slice()) for (const b of G.armies.slice()) {   // 同一條路、對向行軍、位置交會
    if (a.id >= b.id || a.owner === b.owner || a.dead || b.dead || a.from !== b.to || a.to !== b.from || a.pos + b.pos < a.len) continue;
    const r = fieldFight(a, b), w = r.winner === 'a' ? a : b, l = w === a ? b : a;
    w.troops = r.left; l.dead = true; G.ghosts.push({ ...l }); events.push({ t: 'field', win: w, lose: l });
    log(`${FACTIONS[w.owner].name}軍（${w.name}）在野外擊潰${FACTIONS[l.owner].name}軍，剩 ${w.troops} 人`, w.owner === G.player ? 'good' : l.owner === G.player ? 'bad' : '');
  }
  G.armies = G.armies.filter(a => !a.dead);
  for (const a of G.armies.slice()) if (a.pos >= a.len) { G.armies = G.armies.filter(x => x !== a); G.ghosts.push({ ...a }); arrive(a, events); }
  return events;
}
function arrive(a, events) {
  const c = cityById(a.to);
  if (c.owner === a.owner) { c.troops += a.troops; log(`${a.name}軍 ${a.troops} 人抵達${c.name}增援`, a.owner === G.player ? 'info' : ''); events.push({ t: 'reinforce', city: c }); return; }
  const s = G.sieges.find(x => x.city === c.id);
  if (s && s.attacker === a.owner) { s.troops += a.troops; s.lead = Math.max(s.lead, a.lead); log(`${a.name}軍 ${a.troops} 人加入${c.name}的圍城`, 'info'); return; }
  if (s) {   // 另一國已在圍城：先和圍城軍野戰
    const r = fieldFight(a, { troops: s.troops, lead: s.lead });
    if (r.winner === 'a') { s.attacker = a.owner; s.troops = r.left; s.lead = a.lead; s.name = a.name; log(`${FACTIONS[a.owner].name}軍擊退${c.name}城外的圍城軍並接手圍城`, 'info'); }
    else { s.troops = r.left; log(`${FACTIONS[a.owner].name}軍被${c.name}城外的圍城軍擊潰`, 'info'); }
    return;
  }
  G.sieges.push({ city: c.id, attacker: a.owner, troops: a.troops, lead: a.lead, name: a.name, rounds: 0, last: null });
  log(`${FACTIONS[a.owner].name}軍（${a.name}，${a.troops} 人）兵臨${c.name}城下！`, a.owner === G.player || c.owner === G.player ? 'war' : 'info');
  events.push({ t: 'siege', city: c });
}

// ----- 攻城：每回合一輪，攻方選攻城戰術、守方選守城戰術，依克制表結算 -----
function siegeRound(siege, a, d, rng = G.rng) {
  const c = cityById(siege.city), A = siege.troops, D = c.troops, W0 = c.wall, T = ATK[a], F = DEF[d];
  const e = MATRIX[a][d], lead = 0.8 + 0.04 * siege.lead, intel = 0.8 + 0.04 * gen(c).int, jit = 0.9 + 0.2 * rng();
  const eff = e * (e < 1 ? 1 / intel : 1) * lead * jit;   // 守將智力高，克制效果更強
  const wallDmg = Math.round(T.wall * A * eff), defKill = Math.round((a === 'starve' ? T.kill * D : T.kill * A) * eff);
  const defSelf = Math.round(F.selfLoss * D), atkLoss = Math.min(A, Math.max(1, Math.round(T.loss * A * F.lossMul * (0.9 + 0.2 * rng()))));   // 每輪至少損失 1 人
  c.wall = Math.max(0, c.wall - wallDmg); c.troops = Math.max(0, D - defKill - defSelf); siege.troops = Math.max(0, A - atkLoss);
  siege.rounds++; siege.last = a;
  const r = { a, d, e, wallDmg, defKill: D - c.troops, atkLoss: A - siege.troops, A0: A, D0: D, w0: W0, result: 'ongoing', city: c };
  if (siege.troops <= 0) { r.result = 'destroyed'; liftSiege(siege); return r; }
  if (c.wall <= 0 || c.troops <= 0) {   // 城牆被破或守軍被殲：最後決戰
    const att = siege.troops, def = c.troops;
    if (att > def) { r.result = 'captured'; capture(c, siege, Math.max(1, Math.round(att - def * 0.8))); }
    else { r.result = 'repulsed'; c.troops = Math.max(1, Math.round(def - att * 0.8)); liftSiege(siege); }
  }
  return r;
}
function liftSiege(s) { G.sieges = G.sieges.filter(x => x !== s); }
function capture(c, siege, left) {
  const old = c.owner, atk = siege.attacker;
  liftSiege(siege);
  c.owner = atk; c.troops = left; c.wall = Math.round(c.wallMax * 0.3); c.gen = 'guard'; c.lastDef = null;
  G.factions[atk].gold += 100;
  log(`${FACTIONS[atk].name}軍攻下了${c.name}！`, atk === G.player ? 'good' : old === G.player ? 'bad' : 'war');
  if (FACTIONS[old].capital === c.id) { c.capital = false; eliminate(old); }
}
function eliminate(f) {
  G.factions[f].alive = false;
  for (const c of G.cities) if (c.owner === f) c.owner = 'none';
  G.armies = G.armies.filter(a => a.owner !== f); G.sieges = G.sieges.filter(s => s.attacker !== f);
  log(`${FACTIONS[f].name}的都城陷落，${FACTIONS[f].name}滅亡！`, f === G.player ? 'bad' : 'good');
}

// ----- 每回合結算：收入、徵兵、修城牆；檢查勝負 -----
function economy() {
  for (const f of FIDS) if (G.factions[f].alive) G.factions[f].gold += ownedBy(f).filter(c => !besieged(c.id)).reduce((s, c) => s + c.income, 0);
  for (const c of G.cities) {
    if (besieged(c.id)) continue;
    c.troops = Math.min(c.cap, c.troops + Math.round(c.cap * (c.owner === 'none' ? 0.01 : 0.03)));
    c.wall = Math.min(c.wallMax, c.wall + 10);
  }
}
function checkVictory() {
  const alive = FIDS.filter(f => G.factions[f].alive);
  if (!G.factions[G.player].alive) G.over = 'lose';
  else if (alive.length === 1) G.over = 'win';
  return G.over;
}
