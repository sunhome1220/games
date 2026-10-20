// ===== 規則（純邏輯，不碰畫面）=====
// 一個「回合」裡，所有部隊依速度排序輪流行動（敵我交錯）。每支部隊行動時：可移動一次、做一個動作，最後決定朝向。
// 畫面層透過 g.fx（特效佇列）與 g.log（戰報）得知發生了什麼。
(function (root) {
  const { TERRAIN, UNIT_TYPES, COUNTER, BASE_DEF, FORMATIONS, DISORDER, FORM_ALLOWED, SIDE_NAME, SKILLS, GENERALS, SCENARIOS } = root.DATA;
  // 劇本的武將能力調整：GEN_MOD[劇本][武將] = 合併後的武將資料；部隊的 gk 記住用哪個劇本的版本
  const GEN_MOD = {};
  for (const sc of SCENARIOS) if (sc.genMod) { GEN_MOD[sc.id] = {}; for (const k in sc.genMod) GEN_MOD[sc.id][k] = Object.assign({}, GENERALS[k], sc.genMod[k]); }
  const H = root.HEX;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const other = s => (s === 'att' ? 'def' : 'att');

  // 亂數狀態放在 g.rs，存檔時一起存，讀檔後接著產生同樣的亂數
  function rngOf(g) {
    return () => { const a = (g.rs = ((g.rs | 0) + 0x6D2B79F5) | 0); let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function inMap(g, c, r) { return r >= 0 && r < g.Hh && c >= 0 && c < g.W; }
  // ---------- 建立新局 ----------
  function newGame(scId, opts = {}) {
    const sc = SCENARIOS.find(s => s.id === scId);
    const seed = opts.seed != null ? opts.seed : (Date.now() % 1e9);
    const g = {
      sc, scId, seed, rs: seed >>> 0, player: opts.player || null,
      map: sc.map.map(row => row.split('')), W: sc.map[0].length, Hh: sc.map.length,
      hp: {}, ladders: {}, units: [], round: 0, order: [], oi: -1, active: null,
      vars: JSON.parse(JSON.stringify(sc.vars)), log: [], fx: [], over: null,
      stats: { att: { kills: 0, lost: 0 }, def: { kills: 0, lost: 0 } }, flags: {},
    };
    g.rnd = rngOf(g);
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) {
      const t = TERRAIN[g.map[r][c]]; if (t.hp) g.hp[H.key(c, r)] = (sc.hp && sc.hp[g.map[r][c]]) || t.hp;   // 劇本可調整城防耐久
    }
    // 城內範圍：從府衙往外填，碰到城牆為止
    g.city = new Set();
    const st = []; for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'P') st.push([c, r]);
    while (st.length) { const [c, r] = st.pop(); const k = H.key(c, r); if (g.city.has(k) || !inMap(g, c, r) || TERRAIN[g.map[r][c]].wall) continue; g.city.add(k); st.push(...H.neighbors(c, r)); }
    sc.units.forEach((d, i) => {
      const gen = GENERALS[d.gen], ty = UNIT_TYPES[d.type];
      g.units.push({
        id: i, gen: d.gen, gk: GEN_MOD[scId] && GEN_MOD[scId][d.gen] ? scId : undefined, name: d.label ? (ty.engine ? d.label : gen.name) : gen.name, label: d.label || '', side: d.side, type: d.type,
        troops: d.troops, max: d.troops, c: d.c, r: d.r, face: d.face, form: d.form || null,
        coh: 100, mor: 80, cd: {}, alive: true, dueled: false,
        moved: false, acted: false, attacked: false, mpBonus: 0, ignoreZOC: false, buff: {},
      });
    });
    return g;
  }

  // ---------- 存檔／讀檔 ----------
  // 存成純資料：劇本用 scId 重新對應、城內範圍 Set 轉陣列；特效佇列與底線開頭的暫存（AI 快取、名牌畫布）不存
  function serialize(g) {
    return JSON.parse(JSON.stringify(g, function (k, v) {
      if (this === g && (k === 'sc' || k === 'rnd' || k === 'fx')) return undefined;
      if (k[0] === '_') return undefined;
      return v instanceof Set ? [...v] : v;
    }));
  }
  function restore(o) {
    const sc = SCENARIOS.find(s => s.id === o.scId); if (!sc) throw new Error('找不到戰役：' + o.scId);
    const g = Object.assign(JSON.parse(JSON.stringify(o)), { sc, city: new Set(o.city), fx: [] });
    g.rnd = rngOf(g);
    return g;
  }

  // ---------- 查詢 ----------
  const tAt = (g, c, r) => (r >= 0 && r < g.Hh && c >= 0 && c < g.W ? g.map[r][c] : null);
  const terr = (g, c, r) => TERRAIN[tAt(g, c, r)];
  // 一格最多兩支部隊：器械可以和一支友軍同格（避免器械塞住路口）。unitAt 優先回傳作戰部隊
  function unitAt(g, c, r) {
    let eng = null;
    for (const u of g.units) if (u.alive && u.c === c && u.r === r) { if (!ty(u).engine) return u; eng = eng || u; }
    return eng;
  }
  const unitsAt = (g, c, r) => g.units.filter(u => u.alive && u.c === c && u.r === r);
  // u 能不能停在這一格
  function canStop(g, u, c, r) {
    const o = unitsAt(g, c, r).filter(v => v !== u);
    if (!o.length) return true;
    return o.length === 1 && o[0].side === u.side && (isEngine(u) || isEngine(o[0]));
  }
  const gen = u => (u.gk ? GEN_MOD[u.gk][u.gen] : GENERALS[u.gen]);
  const ty = u => UNIT_TYPES[u.type];
  const isEngine = u => !!ty(u).engine;
  const has = (u, sk) => gen(u).skills.includes(sk) && !isEngine(u);
  const alive = g => g.units.filter(u => u.alive);
  // 伏兵：劇本設定 sc.ambush＝某一方，這一方的作戰部隊藏在樹林格裡、敵軍 2 格內才看得見；本回合出手過（暴露）也看得見
  const rawEnemies = (g, u) => g.units.filter(v => v.alive && v.side !== u.side);
  function hidden(g, v) {
    if (!v.alive || g.sc.ambush !== v.side || isEngine(v) || g.map[v.r][v.c] !== 'f' || v.exposed === g.round) return false;
    return !rawEnemies(g, v).some(e => H.dist(e.c, e.r, v.c, v.r) <= 2);
  }
  const enemiesOf = (g, u) => g.units.filter(v => v.alive && v.side !== u.side && !hidden(g, v));
  const friendsOf = (g, u) => g.units.filter(v => v.alive && v.side === u.side && v !== u);
  const onWall = (g, u) => !!(terr(g, u.c, u.r) || {}).wall;
  const inCity = (g, u) => { const t = terr(g, u.c, u.r); return !!(t && (t.wall || g.city.has(H.key(u.c, u.r)))); };
  function state(u) { if (isEngine(u)) return 'full'; return u.coh >= 70 ? 'full' : u.coh >= 40 ? 'shaken' : 'disorder'; }
  const STATE_NAME = { full: '嚴整', shaken: '動搖', disorder: '混亂' };

  // 目前生效的陣型數值（動搖時效果減半、混亂時全失）
  function formOf(u) {
    if (isEngine(u) || !u.form) return null;
    const st = state(u);
    if (st === 'disorder') return DISORDER;
    const f = FORMATIONS[u.form];
    if (st === 'full') return f;
    const half = (m, base) => base + (m - base) / 2;
    return {
      name: f.name, short: f.short, atk: half(f.atk, 1), def: f.def.map((m, i) => half(m, BASE_DEF[i])),
      move: f.move ? Math.floor(f.move / 2) : 0, joint: f.joint ? half(f.joint, 1) : 0, charge: f.charge ? half(f.charge, 1.2) : 0, ranged: f.ranged ? half(f.ranged, 1) : 0,
    };
  }
  function adjEnemies(g, u, combatOnly = true) {
    return H.neighbors(u.c, u.r).map(([c, r]) => unitAt(g, c, r)).filter(v => v && v.side !== u.side && (!combatOnly || !isEngine(v)));
  }
  // 被包圍：相鄰 3 支以上敵軍，或兩支敵軍在正對面夾擊
  function encircled(g, u) {
    if (isEngine(u) || onWall(g, u)) return false;
    const es = adjEnemies(g, u); if (es.length >= 3) return true;
    if (es.length === 2) { const d1 = H.dirTo(u.c, u.r, es[0].c, es[0].r), d2 = H.dirTo(u.c, u.r, es[1].c, es[1].r); return H.dirDiff(d1, d2) === 3; }
    return false;
  }
  function inZOC(g, u, c, r) {
    return H.neighbors(c, r).some(([cc, rr]) => { const v = unitAt(g, cc, rr); return v && v.side !== u.side && !isEngine(v); });
  }
  function moveCost(g, u, c, r, fromC, fromR) {
    if (!inMap(g, c, r)) return Infinity;
    const t = terr(g, c, r), mv = ty(u).mv;
    if (t.broken) return u.gen === 'sunquan' ? 3 : Infinity;   // 斷橋：只有孫權能躍馬跳過
    let cost = t.cost[mv]; if (!isFinite(cost)) return Infinity;
    const fromT = terr(g, fromC, fromR);
    const inside = fromT.wall || g.city.has(H.key(fromC, fromR));
    if (t.wall) {
      if (isEngine(u)) return Infinity;
      if (inside) return cost;   // 城內、城牆上走動
      // 從城外上城：守軍只能走城門；攻方步兵要爬雲梯
      if (t.gate) return u.side === 'def' ? cost : Infinity;
      if (u.side === 'att' && g.ladders[H.key(c, r)] != null && mv === 0) return 2; // 爬雲梯
      return Infinity;
    }
    // 從城牆上下到城外：只能走城門（攻方可以沿自己的雲梯爬下去）；城牆缺口、破城門照常通行
    if (fromT.wall && !fromT.gate && !g.city.has(H.key(c, r)) && !(g.ladders[H.key(fromC, fromR)] != null && u.side === 'att')) return Infinity;
    return cost;
  }
  function maxMP(g, u) {
    let mp = ty(u).move; const f = formOf(u);
    if (f && f.move) mp += f.move;
    if (state(u) === 'disorder') mp -= 1;
    if (g.sc.ambush === u.side && u.type === 'cav') mp += 2;   // 呂布的騎兵來去如風
    return Math.max(1, mp + u.mpBonus);
  }
  // 可到達的格子：Map key → { cost, prev }
  function reachable(g, u) {
    const res = new Map(); const start = H.key(u.c, u.r);
    res.set(start, { cost: 0, prev: null, c: u.c, r: u.r });
    if (u.moved) return res;
    const mp = maxMP(g, u); const open = [[0, u.c, u.r]];
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [cost, c, r] = open.shift();
      const k = H.key(c, r); if (res.get(k).cost < cost) continue;
      if (k !== start && !u.ignoreZOC && inZOC(g, u, c, r) && !isEngine(u)) continue; // 進入敵軍控制區就停下
      if (k !== start && isEngine(u) && inZOC(g, u, c, r)) continue;
      for (const [nc, nr] of H.neighbors(c, r)) {
        const nk = H.key(nc, nr); const occ = unitAt(g, nc, nr);
        if (occ && occ.side !== u.side) continue;
        const mc = moveCost(g, u, nc, nr, c, r); if (!isFinite(mc)) continue;
        const nc2 = cost + mc; if (nc2 > mp) continue;
        const prev = res.get(nk); if (prev && prev.cost <= nc2) continue;
        res.set(nk, { cost: nc2, prev: k, c: nc, r: nr });
        open.push([nc2, nc, nr]);
      }
    }
    // 不能停在友軍所在的格子（器械可以和一支友軍同格）
    for (const [k, v] of res) if (k !== start && !canStop(g, u, v.c, v.r)) v.blocked = true;
    return res;
  }
  function pathTo(reach, k) { const p = []; let cur = k; while (cur) { const v = reach.get(cur); p.unshift([v.c, v.r]); cur = v.prev; } return p; }

  // ---------- 行動順序 ----------
  function speedOf(g, u) {
    let s = ty(u).spd + gen(u).lead / 25;
    if (state(u) === 'disorder') s -= 2;
    if (u.form === 'changshe' && state(u) !== 'disorder') s += 1;
    return s;
  }
  function startRound(g) {
    g.round++;
    for (const u of g.units) { u.spdRoll = speedOf(g, u) + g.rnd() * 1.5; }
    g.order = alive(g).sort((a, b) => b.spdRoll - a.spdRoll).map(u => u.id);
    g.oi = -1;
    g.fx.push({ t: 'round', n: g.round });
    startWeather(g);
    const SR = SC_RULES[g.sc.id]; if (SR) SR.onRoundStart(g);
    nextActivation(g);
  }
  function nextActivation(g) {
    if (g.over) { g.active = null; return; }
    while (++g.oi < g.order.length) {
      const u = g.units[g.order[g.oi]];
      if (u.alive) { beginActivation(g, u); return; }
    }
    endRound(g);
    if (!g.over) startRound(g);
  }
  function beginActivation(g, u) {
    g.active = u.id;
    Object.assign(u, { moved: false, acted: false, attacked: false, mpBonus: 0, ignoreZOC: false, buff: {}, sortie: false, moveLen: 0, from: [u.c, u.r, u.face], ambush: hidden(g, u) });
  }
  const activeUnit = g => (g.active == null ? null : g.units[g.active]);
  // 不必照順序：輪到己方時（目前的部隊還沒移動、沒動作），可以改派本回合還沒行動的其他己方部隊先動
  function canChoose(g, id) {
    const cur = activeUnit(g), u = g.units[id];
    if (!cur || !u || !u.alive || u === cur || u.side !== cur.side || cur.moved || cur.acted) return false;
    return g.order.indexOf(id) > g.oi;
  }
  function chooseActive(g, id) {
    if (!canChoose(g, id)) return false;
    const cur = activeUnit(g);
    Object.assign(cur, { moved: false, acted: false });
    g.order.splice(g.order.indexOf(id), 1); g.order.splice(g.oi, 0, id);   // 選中的插到現在，原本輪到的順延一位
    beginActivation(g, g.units[id]); return true;
  }
  function endActivation(g) {
    const u = activeUnit(g); if (u) { u.moved = u.acted = true; }
    nextActivation(g);
  }
  function upcoming(g, n = 8) {
    const ids = []; for (let i = Math.max(g.oi, 0); i < g.order.length && ids.length < n; i++) { const u = g.units[g.order[i]]; if (u.alive) ids.push(u.id); }
    return ids;
  }

  // ---------- 移動 ----------
  function moveUnit(g, u, c, r) {
    const reach = reachable(g, u); const k = H.key(c, r);
    if (u.moved || !reach.has(k) || reach.get(k).blocked) return false;
    const path = pathTo(reach, k);
    // 離開原位：架好的雲梯收起
    if (path.length > 1 && u.type === 'ladder') for (const lk in g.ladders) if (g.ladders[lk] === u.id) delete g.ladders[lk];
    const wasIn = inCity(g, u);
    u.c = c; u.r = r; u.moved = true; u.moveLen = path.length - 1;
    if (path.length > 1) u.face = H.dirTo(path[path.length - 2][0], path[path.length - 2][1], c, r);
    u.sortie = wasIn && !inCity(g, u);
    // 涉水、穿林會打亂隊形
    const t = terr(g, c, r);
    if (!isEngine(u) && path.length > 1) { if (t.water) u.coh -= 8 * steady(u); else if (t.cover && u.type === 'cav') u.coh -= 4 * steady(u); }
    g.fx.push({ t: 'move', id: u.id, path });
    return true;
  }
  function undoMove(g, u) {
    if (!u.moved || u.acted || !u.from) return false;
    [u.c, u.r, u.face] = u.from; u.moved = false; u.moveLen = 0; u.sortie = false;
    g.fx.push({ t: 'warp', id: u.id });
    return true;
  }
  function setFacing(g, u, d) { u.face = ((d % 6) + 6) % 6; g.fx.push({ t: 'face', id: u.id }); }

  // ---------- 傷害計算 ----------
  function sideHit(g, att, def) {
    if (isEngine(def) || onWall(g, def)) return -1;
    const d = H.dirTo(def.c, def.r, att.c, att.r); return H.dirDiff(def.face, d);
  }
  function jointCount(g, att, def) {
    return H.neighbors(def.c, def.r).map(([c, r]) => unitAt(g, c, r))
      .filter(v => v && v !== att && v.side === att.side && !isEngine(v) && state(v) !== 'disorder').length;
  }
  function nearCao(g, u) { return g.units.some(v => v.alive && v.side === u.side && has(v, 'jianxiong') && H.dist(v.c, v.r, u.c, u.r) <= 2); }
  function towerSupport(g, u) { return u.type === 'tower' || g.units.some(v => v.alive && v.side === u.side && v.type === 'tower' && H.dist(v.c, v.r, u.c, u.r) <= 1); }

  // 回傳 { dmg, parts:[[說明, 倍率]], side, joint, charge }；opts.counter＝反擊，opts.mean＝不擲骰
  function calcDamage(g, A, D, opts = {}) {
    const ta = ty(A), td = ty(D), ga = gen(A);
    const dist = H.dist(A.c, A.r, D.c, D.r);
    const shoot = !!opts.shoot && !opts.counter;   // 步兵、騎兵也帶弓箭：射箭（威力比弓兵低）
    const ranged = (!!ta.ranged || shoot) && !opts.counter;
    const parts = [];
    const atkVal = shoot ? ta.atk * shootPower(A) : ranged ? ta.atk : (ta.melee || ta.atk);
    let m = A.troops / 1000 * 45 * atkVal / 10;
    const P = (label, x) => { if (Math.abs(x - 1) > 0.005) parts.push([label, x]); m *= x; };
    P('武力', 0.8 + ga.war / 250);
    P('士氣', 0.6 + 0.4 * A.mor / 100);
    const f = formOf(A);
    if (f) {
      if (ranged && f.ranged) P(f.short + '（遠程）', f.ranged);
      else P(f.short, f.atk);
    }
    if (ranged && dist === 1 && !ta.engine) P('近距離射擊', 0.8);
    if (shoot) parts.push([has(A, 'qishe') ? '騎射（轅門射戟）' : A.type === 'cav' ? '騎射' : '步兵弓箭', 1]);
    if (has(A, 'wushuang')) P('無雙', 1.3);
    if (has(A, 'wusheng')) P('武聖', 1.2);
    if (has(A, 'xianzhen')) P('陷陣', 1.35);
    if (has(A, 'xiandeng')) P('先登', 1.15);
    if (has(D, 'xianzhen')) P('陷陣營精甲', 0.8);
    if (has(A, 'liaolai')) P('遼來', 1.2);
    if (g.vars.surpriseSide === A.side && g.round <= g.vars.surpriseUntil) P('倉促應戰', 0.7);   // 被突襲的一方前幾回合還沒整好隊伍
    if (has(D, 'duanhou') && g.vars.retreating) P('斷後', 0.75);
    if (A.buff.feijiang && !opts.counter) P('飛將', 1.4);
    if (opts.weizhen) P('威震', 1.3);
    if (A.ambush && !opts.counter) P('伏擊', 1.3);
    // 兵種相剋
    if (td.engine) P('打器械', ranged ? 1.2 : 1.5);
    else if (!shoot) { const cm = (COUNTER[A.type] || {})[D.type]; if (cm) P(cm > 1 ? '兵種剋制' : '兵種被剋', cm); }   // 射箭不算近戰的兵種相剋
    // 衝鋒
    let charge = false;
    if (!opts.counter && ta.charge && !ranged && A.moveLen >= 2 && state(A) !== 'disorder') {
      const dt = terr(g, D.c, D.r);
      if (!dt.cover && !dt.wall && dt.h <= 0) { charge = true; let cm = f && f.charge ? f.charge : 1.2; if (A.buff.tuxi) cm += 0.15; P('衝鋒', cm); }
    }
    if (A.sortie && !opts.counter) P('出城突擊', 1.15);
    // 合擊
    let k = 0;
    if (!opts.counter) {
      k = jointCount(g, A, D);
      if (k) {
        let per = 0.06 + ga.lead / 1000;
        if (has(A, 'heji') || (f && f.joint)) per *= (f && f.joint) ? f.joint : 2;
        if (nearCao(g, A)) per *= 1.5;
        if (ranged) per /= 2;
        P(`合擊 ×${k}`, 1 + k * per);
      }
    }
    // 方向
    const side = sideHit(g, A, D);
    if (A.ambush && !opts.counter && side === 3) P('伏擊打背後', 1.15);
    if (side >= 0) {
      const fd = formOf(D); let sm = (fd ? fd.def : BASE_DEF)[side];
      if (side >= 1 && sm > 1) {
        const ad = H.dirTo(D.c, D.r, A.c, A.r);
        const cover = [ad - 1, ad + 1].some(d => { const [c, r] = H.neighbor(D.c, D.r, d); const v = unitAt(g, c, r); return v && v.side === D.side && !isEngine(v) && state(v) !== 'disorder'; });
        if (cover) { sm = 1 + (sm - 1) * 0.4; }
        if (ranged) sm = 1 + (sm - 1) * 0.5;
        P(SIDE_NAME[side] + (cover ? '（有友軍協防）' : ''), sm);
      } else P(SIDE_NAME[side], sm);
    } else if (isEngine(D)) P('器械', 1.3);
    if (encircled(g, D)) P('被包圍', 1.15);
    // 地形與高度
    const dT = terr(g, D.c, D.r), aT = terr(g, A.c, A.r);
    if (dT.wall && !aT.wall) {
      if (A.type === 'cata') P('投石砸城頭', 0.9);
      else if (ranged) P(towerSupport(g, A) ? '仰攻城牆（井闌掩護）' : '仰攻城牆', towerSupport(g, A) ? 0.8 : 0.6);
      else P('攀梯攻城', 0.7);
    } else {
      if (dT.dmg !== 1) P(dT.name, dT.dmg);
      if (aT.h > dT.h) P('居高臨下', 1.15); else if (aT.h < dT.h) P('仰攻', 0.85);
    }
    P('防禦', 10 / (td.def + 2));
    if (opts.counter) P(has(D, 'wushuang') ? '反擊（無雙）' : has(D, 'ganglie') ? '反擊（剛烈）' : '反擊', has(D, 'wushuang') ? 1 : has(D, 'ganglie') ? 0.75 : 0.5);
    if (!opts.mean) m *= 0.9 + g.rnd() * 0.2;
    return { dmg: Math.min(D.troops, Math.max(1, Math.round(m))), parts, side, joint: k, charge, ranged };
  }
  // 會不會被反擊：近戰、對方不是器械、沒有混亂、從正面或前側打（城牆上的守軍一定會還手）
  function canCounter(g, A, D, ranged) {
    if (ranged || isEngine(D) || state(D) === 'disorder' || D.troops <= 0) return false;
    if (H.dist(A.c, A.r, D.c, D.r) !== 1) return false;
    const s = sideHit(g, A, D); return s === -1 || s <= 1;
  }

  // ---------- 損傷與崩潰 ----------
  function applyLoss(g, D, dmg, info = {}) {
    const before = D.troops; D.troops = Math.max(0, D.troops - dmg);
    g.stats[D.side].lost += dmg; g.stats[other(D.side)].kills += dmg;
    if (isEngine(D)) { if (D.troops <= 0) destroy(g, D, '被摧毀'); return; }
    const pct = dmg / Math.max(1, before) * 100;
    let coh = pct * 2.0 + (info.side >= 0 ? [0, 6, 12, 18][info.side] : 0) + (info.charge ? 8 : 0) + (info.joint || 0) * 4 + (info.extraCoh || 0);
    coh *= steady(D);
    if (steadfast(D) || (has(D, 'duanhou') && g.vars.retreating)) coh *= 0.5;
    if (info.ranged) coh *= 0.7;
    D.coh = clamp(D.coh - Math.max(2, coh), 0, 100);
    D.mor = clamp(D.mor - (pct * 0.9 + (info.side === 3 ? 5 : 0) + (info.extraMor || 0)), 0, 100);
    checkCollapse(g, D);
  }
  function checkCollapse(g, u) {
    if (!u.alive) return;
    if (u.troops <= 0) { destroy(g, u, '全軍覆沒'); return; }
    if (isEngine(u)) return;
    const lead = gen(u).lead;
    // 兵力折損到兩成五以下：殘部潰逃（陷陣營除外，每支部隊只觸發一次）
    if (u.troops < u.max * 0.25 && !u.broken && !has(u, 'xianzhen') && !(has(u, 'duanhou') && g.vars.retreating)) { u.broken = true; rout(g, u); return; }
    if (u.coh < 15 || u.mor <= 5) {
      if (steadfast(u) || lead >= 70) {
        if (u.coh < 15) { u.coh = 15; u.mor = clamp(u.mor - 8, 0, 100); }
        if (u.mor <= 5) u.mor = 10;
        if (!u.steadied) { u.steadied = true; log(g, `${u.name}陣型大亂，靠著統率勉強穩住部隊`, u.side); }
      } else if (lead >= 45) rout(g, u);
      else {
        log(g, `${u.name}部陣型崩潰、號令不行，部隊就地解散！`, u.side, 'bad');
        destroy(g, u, '就地解散');
      }
    }
  }
  function rout(g, u) {
    const goal = g.sc.retreat[u.side]; const path = [[u.c, u.r]];
    for (let step = 0; step < 3; step++) {
      const [c, r] = path[path.length - 1];
      let best = null, bs = Infinity;
      for (const [nc, nr] of H.neighbors(c, r)) {
        if (unitAt(g, nc, nr) || !isFinite(moveCost(g, u, nc, nr, c, r))) continue;
        if (path.some(p => p[0] === nc && p[1] === nr)) continue;
        const s = H.dist(nc, nr, goal[0], goal[1]) + (inZOC(g, u, nc, nr) ? 3 : 0);
        if (s < bs) { bs = s; best = [nc, nr]; }
      }
      if (!best) break; path.push(best);
    }
    log(g, `${u.name}部潰逃！`, u.side, 'bad');
    if (path.length < 2) {
      u.troops = Math.round(u.troops * 0.7); log(g, `${u.name}部無路可逃，遭到追殺`, u.side, 'bad');
      if (u.troops < 300) { destroy(g, u, '被殲滅'); return; }
    } else {
      const [c, r] = path[path.length - 1]; const [pc, pr] = path[path.length - 2];
      u.c = c; u.r = r; u.face = H.dirTo(pc, pr, c, r);
      g.fx.push({ t: 'move', id: u.id, path, rout: true });
    }
    u.coh = 25; u.mor = clamp(u.mor - 10, 8, 100); u.routed = (u.routed || 0) + 1;
  }
  // 主將單騎殺出重圍：第一次被打光時，若身邊（3 格內）有友軍或人在城內，就帶著殘部（約 1.2% 兵力）衝到友軍旁邊，之後才算被擒
  function leaderEscape(g, u, how) {
    if (!g.sc.leaderEscape || isEngine(u) || u.escaped || u.gen !== g.sc.sides[u.side].leader) return false;
    const friends = alive(g).filter(v => v !== u && v.side === u.side && !isEngine(v));
    if (!friends.length) return false;
    friends.sort((a, b) => H.dist(a.c, a.r, u.c, u.r) - H.dist(b.c, b.r, u.c, u.r));
    const near = friends[0];
    if (!(H.dist(near.c, near.r, u.c, u.r) <= 3 || inCity(g, u) || onWall(g, u))) return false;
    // 找友軍旁邊的空格（優先不貼著敵軍；城內的主將優先留在城內）
    const old = [u.c, u.r]; let best = null;
    for (const f of friends.slice(0, 3)) for (const [c, r] of H.neighbors(f.c, f.r)) {
      if (!inMap(g, c, r) || unitAt(g, c, r) || !isFinite(moveCost(g, u, c, r, f.c, f.r))) continue;
      const t = terr(g, c, r); if (t.water) continue;
      const foes = H.neighbors(c, r).filter(([cc, rr]) => { const w = unitAt(g, cc, rr); return w && w.side !== u.side && !isEngine(w); }).length;
      const sc = foes * 10 + H.dist(c, r, old[0], old[1]) * 0.5 + (inCity(g, u) && !g.city.has(H.key(c, r)) ? 20 : 0);
      if (!best || sc < best.sc) best = { sc, c, r };
    }
    if (!best) return false;
    u.escaped = true; u.troops = Math.max(40, Math.round(u.max * 0.012)); u.mor = 35; u.coh = 25; u.c = best.c; u.r = best.r; u.moved = true;
    log(g, `${u.name}${how}，單騎殺出重圍，身邊只剩 ${u.troops} 人！（友軍趕來可「救援合流」）`, u.side, 'big');
    g.fx.push({ t: 'warp', id: u.id });
    return true;
  }
  function destroy(g, u, how) {
    if (leaderEscape(g, u, how)) return;
    u.alive = false; u.troops = 0;
    for (const lk in g.ladders) if (g.ladders[lk] === u.id) delete g.ladders[lk];
    const caught = !isEngine(u) && u.gen !== 'caobu';
    u.fate = how;
    log(g, isEngine(u) ? `${u.name}${how}` : `${u.name}部${how}${caught ? (g.rnd() < 0.5 ? `，${u.name}被俘` : `，${u.name}突圍逃走`) : ''}`, u.side, 'bad');
    g.fx.push({ t: 'dead', id: u.id });
    checkVictory(g);
  }
  function log(g, text, side, kind) { g.log.push({ round: g.round, text, side: side || null, kind: kind || '' }); g.fx.push({ t: 'log', text, side, kind }); }

  // ---------- 攻擊 ----------
  function canMeleeReach(g, A, D) {
    if (H.dist(A.c, A.r, D.c, D.r) !== 1) return false;
    const dT = terr(g, D.c, D.r), aT = terr(g, A.c, A.r);
    if (dT.wall && !aT.wall && !g.city.has(H.key(A.c, A.r))) return g.ladders[H.key(D.c, D.r)] != null && ty(A).mv === 0;
    return true;
  }
  function rangeOf(g, u) {
    const t = ty(u); let r = t.rng;
    if (t.ranged && !t.engine && terr(g, u.c, u.r).h >= 1) r += 1;
    return r;
  }
  function attackTargets(g, u) {
    const t = ty(u); if (t.atk <= 0 || u.acted) return [];
    const res = [];
    for (const v of enemiesOf(g, u)) {
      if (isEngine(v) && unitAt(g, v.c, v.r) !== v) continue;   // 和作戰部隊同格的器械受到掩護，要先打作戰部隊
      const d = H.dist(u.c, u.r, v.c, v.r);
      if (t.ranged) { if (d <= rangeOf(g, u) && d >= (t.minRng || 1)) res.push(v); }
      else if (u.type === 'ram') { /* 衝車只撞門 */ }
      else if (canMeleeReach(g, u, v)) res.push(v);
    }
    return res;
  }
  // 可攻擊的城防（城門、城牆、箭樓）
  function structTargets(g, u) {
    if (u.acted) return [];
    const res = [];
    const cand = u.type === 'cata' ? null : H.neighbors(u.c, u.r);
    const check = (c, r) => {
      const t = terr(g, c, r); if (!t || !t.wall) return;
      const k = H.key(c, r); if (!(g.hp[k] > 0)) return;
      if (u.type === 'cata') { const d = H.dist(u.c, u.r, c, r); if (d < 2 || d > 4) return; }
      else if (u.type === 'ram') { if (!t.gate) return; }
      else if (u.type === 'inf') { if (!t.gate || unitAt(g, c, r)) return; }
      else return;
      if (u.side === 'def') return;
      res.push({ c, r, k });
    };
    if (cand) cand.forEach(([c, r]) => check(c, r));
    else for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) check(c, r);
    return res;
  }
  function attack(g, A, D, opts = {}) {
    if (A.acted) return null;
    const res = calcDamage(g, A, D, opts);
    A.face = H.dirTo(A.c, A.r, D.c, D.r); A.acted = true; A.attacked = true;
    const counterOK = canCounter(g, A, D, res.ranged);
    // 特效先排進佇列（之後的潰逃、陣亡動畫才會排在攻擊之後）
    const fx = { t: 'attack', a: A.id, d: D.id, dmg: res.dmg, counter: 0, side: res.side, ranged: res.ranged, charge: res.charge, joint: res.joint, kind: A.type };
    g.fx.push(fx);
    applyLoss(g, D, res.dmg, { side: res.side, charge: res.charge, joint: res.joint, ranged: res.ranged, extraCoh: (A.buff.feijiang ? 15 : 0) + (opts.weizhen ? 15 : 0) + (has(A, 'xianzhen') ? 12 : 0) + (A.ambush ? 15 : 0) });
    if (A.ambush) { g.fx.push({ t: 'skill', id: A.id, name: '伏擊' }); A.ambush = false; }
    A.exposed = g.round;
    if (A.type === 'cata' && D.alive && onWall(g, D)) damageStruct(g, D.c, D.r, 6, A);
    let cres = null;
    if (counterOK && D.alive && A.alive) {
      cres = calcDamage(g, D, A, { counter: true });
      fx.counter = cres.dmg;
      applyLoss(g, A, cres.dmg, { side: cres.side, ranged: false });
    }
    if (A.alive && !isEngine(A) && !res.ranged) A.coh = clamp(A.coh - 2, 0, 100);
    if (A.alive) A.mor = clamp(A.mor + 2, 0, 100);
    const sideTxt = res.side >= 0 ? `（${SIDE_NAME[res.side]}${res.charge ? '・衝鋒' : ''}${res.joint ? `・合擊${res.joint}` : ''}）` : '';
    log(g, `${A.name}${opts.shoot ? (has(A, 'qishe') ? '張弓騎射' : '放箭射擊') : '攻擊'}${D.name}${sideTxt}，殺傷 ${res.dmg}${cres ? `，反擊 ${cres.dmg}` : ''}`, A.side);
    if (opts.weizhen) for (const [c, r] of H.neighbors(D.c, D.r)) { const v = unitAt(g, c, r); if (v && v.side === D.side) { v.mor = clamp(v.mor - 10, 0, 100); checkCollapse(g, v); } }
    checkVictory(g);
    return { res, cres };
  }
  function damageStruct(g, c, r, amount, A) {
    const k = H.key(c, r); if (!(g.hp[k] > 0)) return 0;
    const dmg = Math.max(1, Math.round(amount)); g.hp[k] = Math.max(0, g.hp[k] - dmg);
    const t = terr(g, c, r); let broke = false;
    if (g.hp[k] <= 0) {
      broke = true; g.map[r][c] = t.gate ? 'o' : 'r'; delete g.ladders[k];
      log(g, t.gate ? '城門被攻破了！' : `${t.name}被打塌，出現缺口！`, A ? A.side : null, 'big');
    }
    g.fx.push({ t: 'struct', a: A ? A.id : null, c, r, dmg, broke, kind: A ? A.type : 'flood' });
    return dmg;
  }
  function attackStruct(g, A, c, r) {
    if (A.acted) return false;
    const t = terr(g, c, r); let amt;
    if (A.type === 'ram') amt = 30 * A.troops / 600; else if (A.type === 'cata') amt = (t.gate ? 12 : 18) * A.troops / 600; else amt = 8 * A.troops / 3000;
    amt *= 0.85 + g.rnd() * 0.3;
    A.face = H.dirTo(A.c, A.r, c, r); A.acted = true; A.attacked = true;
    const dmg = damageStruct(g, c, r, amt, A);
    log(g, `${A.name}攻擊${t.name}，耐久 −${dmg}${g.hp[H.key(c, r)] > 0 ? `（剩 ${g.hp[H.key(c, r)]}）` : ''}`, A.side);
    return true;
  }

  // ---------- 動作清單 ----------
  // 每個動作：{ id, name, desc, need: 'enemy'|'hex'|'none', targets:[...] , enabled, why }
  function actionsFor(g, u) {
    const L = []; const t = ty(u);
    const add = (o) => L.push(Object.assign({ enabled: true, targets: [], need: 'none' }, o));
    if (!u.acted) {
      // 技能
      for (const sk of gen(u).skills) {
        const S = SKILLS[sk]; if (S.kind !== 'active' || isEngine(u)) continue;
        const cd = u.cd[sk] || 0; let targets = [], need = 'none', why = '';
        if (S.target === 'self' && u.moved) why = '要在移動前使用';
        if (S.target === 'enemy') {
          need = 'enemy';
          targets = enemiesOf(g, u).filter(v => sk === 'weizhen' ? canMeleeReach(g, u, v) && !isEngine(v) : H.dist(u.c, u.r, v.c, v.r) <= S.rng).map(v => v.id);
          if (!targets.length) why = '範圍內沒有敵軍';
        }
        if (state(u) === 'disorder') why = '陣型混亂，無法施展';
        if (S.cost && u.coh < 40) why = '陣勢太低（要 40 以上），沒力氣衝鋒';
        if (cd > 0) why = `冷卻中（${cd} 回合）`;
        const costTxt = S.cost ? `　【代價】使用時陣勢 −${Math.round(S.cost * steady(u))}（統率越高扣越少）。` : '';
        add({ id: 'skill:' + sk, name: cd > 0 ? `${S.name}（冷卻 ${cd}）` : S.name, desc: `${S.desc}　冷卻 ${S.cd} 回合。${costTxt}`, need, targets, enabled: !why, why, skill: true, pre: S.target === 'self' });
      }
      // 單挑
      if (!isEngine(u) && gen(u).war >= 60 && !u.dueled) {
        const ts = adjEnemies(g, u).filter(v => !['caobu', 'gongbing', 'wubu'].includes(v.gen) && !v.dueled).map(v => v.id);
        if (ts.length) add({ id: 'duel', name: '單挑', desc: '向相鄰敵將挑戰（每位武將限一次）。勝者部隊士氣大振，敗者部隊士氣與陣型大亂；實力差太多時對方會避戰。', need: 'enemy', targets: ts });
      }
      // 變換陣型
      if (FORM_ALLOWED[u.type]) add({ id: 'form', name: '變陣', desc: '變換陣型（花掉這次動作；貼著敵軍變陣會讓陣勢 −15）。', need: 'form', targets: FORM_ALLOWED[u.type].filter(f => f !== u.form) });
      // 步兵、騎兵射箭
      if (!isEngine(u) && !ty(u).ranged) {
        const st = shootTargets(g, u);
        add({ id: 'shoot', name: has(u, 'qishe') ? '騎射' : '射箭', desc: has(u, 'qishe') ? `呂布「轅門射戟」：向 2～${shootRange(g, u)} 格外的敵軍放箭，威力與精銳弓兵相當，不會被反擊。` : `向 2～${shootRange(g, u)} 格外的敵軍放箭（威力約弓兵的兩成，不會被反擊）。`, need: 'enemy', targets: st.map(v => v.id), enabled: st.length > 0, why: state(u) === 'disorder' ? '陣型混亂，無法放箭' : '2 格外沒有敵軍' });
      }
      // 救援合流：與相鄰的友軍合成一支部隊（其中一方是殘部時）
      if (!isEngine(u)) {
        const mates = H.neighbors(u.c, u.r).map(([c, r]) => unitAt(g, c, r)).filter(v => v && v !== u && v.side === u.side && !isEngine(v) && (isRemnant(v) || isRemnant(u)));
        if (mates.length) add({ id: 'merge', name: '救援合流', desc: '與相鄰的友軍合為一支部隊（其中一方兵力剩三成五以下才能合流）：兵力相加，由主帥（或統率較高者）統領，站到兵力較多的那一格，士氣 +10。被圍的殘部可以這樣被救出來。', need: 'ally', targets: mates.map(v => v.id) });
      }
      // 放火燒糧營：相鄰就地放火；2～3 格外射火箭（弓兵、呂布一箭就燃，步騎要射兩箭）
      const bt = depotTargets(g, u);
      if (bt.length) add({ id: 'burn', name: bt.some(t => t.dist <= 1) ? '放火燒營' : '火箭燒營', desc: '糧營放火：相鄰（含同格）直接點燃；2 格以外可以射火箭（弓兵、呂布「騎射」一箭就燃，步兵、騎兵要射 2 箭）。點燃當下存糧 −15%，沒下雨又沒人撲滅，下一、再下一回合結束再損 30%、55%（燒光）。下雨時點不著。', need: 'hex', targets: bt });
      const dt = douseTargets(g, u);
      if (dt.length) add({ id: 'douse', name: '滅火', desc: '撲滅相鄰（含同格）糧營的大火：火停了，已經燒掉的不會回來，剩下的保住。', need: 'hex', targets: dt });
      if (!isEngine(u)) add({ id: 'rally', name: '整隊', desc: `重整隊伍：陣勢 +${Math.round(15 + gen(u).lead / 5)}、士氣 +5（被包圍時減半）。`, enabled: u.coh < 100 || u.mor < 100, why: '隊伍已經很整齊' });
      // 守城器具
      if (u.side === 'def' && onWall(g, u)) {
        const adj = H.neighbors(u.c, u.r).map(([c, r]) => unitAt(g, c, r)).filter(v => v && v.side !== u.side && !onWall(g, v) && !inCity(g, v)).map(v => v.id);
        add({ id: 'rocks', name: `滾木礌石（剩 ${g.vars.rocks}）`, desc: '砸城牆底下相鄰的敵軍：兵力 −12%、陣勢 −15；對器械效果更大。', need: 'enemy', targets: adj, enabled: g.vars.rocks > 0 && adj.length > 0, why: g.vars.rocks <= 0 ? '用完了' : '城下沒有敵軍' });
        add({ id: 'oil', name: `火油（剩 ${g.vars.oil}）`, desc: '向城下相鄰敵軍潑灑火油：兵力 −10%、士氣 −8；燒攻城器械特別有效。', need: 'enemy', targets: adj, enabled: g.vars.oil > 0 && adj.length > 0, why: g.vars.oil <= 0 ? '用完了' : '城下沒有敵軍' });
      }
      // 雲梯
      if (u.type === 'ladder') {
        const ws = H.neighbors(u.c, u.r).filter(([c, r]) => { const tt = terr(g, c, r); return tt && tt.wall && g.hp[H.key(c, r)] > 0 && g.ladders[H.key(c, r)] == null; }).map(([c, r]) => ({ c, r, k: H.key(c, r) }));
        add({ id: 'ladder', name: '架梯', desc: '把雲梯架在相鄰的城牆上，之後步兵、弓兵可以從這裡攻上城頭。雲梯移動就會收起。', need: 'hex', targets: ws, enabled: ws.length > 0, why: '旁邊沒有城牆' });
      }
      // 城防目標
      const st = structTargets(g, u);
      if (st.length) add({ id: 'struct', name: u.type === 'ram' ? '撞門' : u.type === 'cata' ? '轟擊城防' : '攻門', desc: u.type === 'ram' ? '用衝車撞擊城門。' : u.type === 'cata' ? '投石轟擊城牆、城門或箭樓，耐久歸零就會出現缺口。' : '用步兵硬撞城門（效果很差，最好用衝車）。', need: 'hex', targets: st });
      // 劇本專屬
      const SR = SC_RULES[g.sc.id]; if (SR && SR.actions) SR.actions(g, u, add);
    }
    return L;
  }
  function doAction(g, u, id, target) {
    if (u.acted || g.over) return false;
    const A = actionsFor(g, u).find(a => a.id === id); if (!A || !A.enabled) return false;
    if (id.startsWith('skill:')) return useSkill(g, u, id.slice(6), target);
    if (id === 'duel') return duel(g, u, g.units[target]);
    if (id === 'form') {
      if (!A.targets.includes(target)) return false;
      u.form = target; u.acted = true;
      if (adjEnemies(g, u).length) { u.coh = clamp(u.coh - 15 * steady(u) * 1.4, 0, 100); checkCollapse(g, u); }
      log(g, `${u.name}變陣為${FORMATIONS[target].name}`, u.side); g.fx.push({ t: 'form', id: u.id }); return true;
    }
    if (id === 'shoot') { if (!A.targets.includes(target)) return false; attack(g, u, g.units[target], { shoot: true }); return true; }
    if (id === 'burn') { const t = A.targets.find(x => x.k === target); if (!t) return false; return igniteDepot(g, u, t); }
    if (id === 'douse') { const t = A.targets.find(x => x.k === target); if (!t) return false; return douse(g, u, t); }
    if (id === 'merge') { if (!A.targets.includes(target)) return false; return merge(g, u, g.units[target]); }
    if (id === 'rally') {
      const half = encircled(g, u) ? 0.5 : 1;
      u.coh = clamp(u.coh + (15 + gen(u).lead / 5) * half, 0, 100); u.mor = clamp(u.mor + 5 * half, 0, 100); u.acted = true;
      log(g, `${u.name}重整隊伍`, u.side); g.fx.push({ t: 'form', id: u.id }); return true;
    }
    if (id === 'rocks' || id === 'oil') {
      const D = g.units[target]; if (!A.targets.includes(target)) return false;
      const eng = isEngine(D);
      const pct = id === 'rocks' ? (eng ? 0.3 : 0.12) : (eng ? 0.45 : 0.1);
      g.vars[id]--; u.acted = true; u.attacked = true; u.face = H.dirTo(u.c, u.r, D.c, D.r);
      const dmg = Math.max(1, Math.round(D.troops * pct * (0.9 + g.rnd() * 0.2)));
      g.fx.push({ t: id, a: u.id, d: D.id, dmg });
      log(g, `${u.name}${id === 'rocks' ? '投下滾木礌石' : '潑下火油'}，${D.name}損失 ${dmg}`, u.side);
      applyLoss(g, D, dmg, { extraCoh: id === 'rocks' ? 15 : 0, extraMor: id === 'oil' ? 8 : 0 });
      return true;
    }
    if (id === 'ladder') {
      const tg = A.targets.find(x => x.k === target); if (!tg) return false;
      g.ladders[tg.k] = u.id; u.acted = true; u.face = H.dirTo(u.c, u.r, tg.c, tg.r);
      log(g, `${u.name}架上城牆！步兵、弓兵可以從這裡攻城`, u.side); g.fx.push({ t: 'ladder', id: u.id, c: tg.c, r: tg.r }); return true;
    }
    if (id === 'struct') {
      const tg = A.targets.find(x => x.k === target); if (!tg) return false;
      return attackStruct(g, u, tg.c, tg.r);
    }
    const SR = SC_RULES[g.sc.id]; if (SR && SR.doAction) return SR.doAction(g, u, id, target);
    return false;
  }
  function useSkill(g, u, sk, target) {
    const S = SKILLS[sk];
    const near = (rad, incSelf) => g.units.filter(v => v.alive && v.side === u.side && (incSelf || v !== u) && H.dist(v.c, v.r, u.c, u.r) <= rad && !isEngine(v));
    if (S.target !== 'self') u.acted = true;
    u.cd[sk] = S.cd;
    if (S.cost) u.coh = clamp(u.coh - S.cost * steady(u), 0, 100);   // 衝鋒耗體力：陣勢下降
    g.fx.push({ t: 'skill', id: u.id, name: S.name, target });
    if (sk === 'jili') { for (const v of near(3, true)) { v.mor = clamp(v.mor + 15, 0, 100); v.coh = clamp(v.coh + 10, 0, 100); } log(g, `${u.name}親自激勵將士，全軍士氣大振`, u.side); }
    else if (sk === 'rende') { for (const v of near(1, true)) { v.mor = clamp(v.mor + 20, 0, 100); v.coh = clamp(v.coh + 15, 0, 100); } log(g, `${u.name}撫慰士卒，人心安定`, u.side); }
    else if (sk === 'feijiang') { u.mpBonus = 2; u.ignoreZOC = true; u.buff.feijiang = true; log(g, '呂布躍馬挺戟：「誰敢擋我！」', u.side); }
    else if (sk === 'tuxi') { u.mpBonus = 3; u.ignoreZOC = true; u.buff.tuxi = true; log(g, `${u.name}率輕騎突襲！`, u.side); }
    else if (sk === 'weizhen') { u.acted = false; attack(g, u, g.units[target], { weizhen: true }); }
    else if (sk === 'lijian') {
      const D = g.units[target]; const low = (gen(D).loyal || 100) < 50;
      D.mor = clamp(D.mor - (low ? 36 : 18), 0, 100); D.lijian = (D.lijian || 0) + 1;
      log(g, `${u.name}派人離間${D.name}${low ? '，對方軍心大亂' : ''}`, u.side); checkCollapse(g, D);
    } else if (sk === 'huoji') {
      const D = g.units[target]; u.face = H.dirTo(u.c, u.r, D.c, D.r);
      let pct = 0.08; if (isEngine(D)) pct *= 3; if (terr(g, D.c, D.r).cover) pct *= 1.5;
      const dmg = Math.max(1, Math.round(D.troops * pct));
      g.fx.push({ t: 'fire', d: D.id, dmg });
      log(g, `${u.name}施放火計，${D.name}陷入火海，損失 ${dmg}`, u.side);
      applyLoss(g, D, dmg, { extraCoh: 20, extraMor: 5 });
    }
    checkVictory(g);
    return true;
  }
  const isRemnant = u => u.troops <= u.max * 0.35;
  // ---------- 糧營放火與火勢 ----------
  // 糧營是地圖上的「S」；被糧營守護的那一方是 sc.depotOwner（預設攻方），另一方的非器械部隊才能放火
  // 火勢：點燃當下馬上損 15%；之後每回合結束（點燃的下一、下下回合）再損 30%、55%，第三次燒光（以原存量計）。
  //   下雨會澆熄所有火勢、下雨天也點不起火；糧營方部隊相鄰可以「滅火」。熄火後損失保留；再點燃就接著下一階段。
  //   進度存在 vars.dstage[位置]＝已經燒了幾個階段（0～3）、vars.burning[位置]＝{ since: 點燃的回合 }（正在燒）
  const FIRE_CUM = [0, 0.15, 0.45, 1];
  const WEATHER_ICON = { 晴: '☀️', 陰: '☁️', 雨: '🌧' };
  const depotOwner = g => g.sc.depotOwner || 'att';
  const weatherAt = (g, round) => { const w = g.sc.weather; return w && w.length ? w[(round - 1) % w.length] : '晴'; };
  const isRaining = g => g.vars.weather === '雨';
  const burningAt = (g, c, r) => !!(g.vars.burning && g.vars.burning[H.key(c, r)]);
  function depotTargets(g, u) {
    if (isEngine(u) || u.acted || u.side === depotOwner(g) || state(u) === 'disorder' || isRaining(g)) return [];
    const res = [], arc = !!ty(u).ranged, R = arc ? rangeOf(g, u) : shootRange(g, u);
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) {
      if (g.map[r][c] !== 'S' || burningAt(g, c, r)) continue;
      const d = H.dist(u.c, u.r, c, r); if (d > R && d > 1) continue;
      res.push({ c, r, k: H.key(c, r), dist: d });
    }
    return res;
  }
  // 糧營方的部隊：相鄰（含同格）正在燒的糧營可以滅火
  function douseTargets(g, u) {
    if (isEngine(u) || u.acted || u.side !== depotOwner(g)) return [];
    const res = [];
    for (const k in (g.vars.burning || {})) { const [c, r] = H.unkey(k); const d = H.dist(u.c, u.r, c, r); if (d <= 1) res.push({ c, r, k, dist: d }); }
    return res;
  }
  function igniteDepot(g, u, t) {
    const near = t.dist <= 1; u.acted = true;
    if (!near) u.face = H.dirTo(u.c, u.r, t.c, t.r);
    g.vars.fire = g.vars.fire || {};
    const power = near ? 2 : (ty(u).ranged || has(u, 'qishe')) ? 2 : 1;
    g.vars.fire[t.k] = (g.vars.fire[t.k] || 0) + power;
    if (g.vars.fire[t.k] >= 2) {
      delete g.vars.fire[t.k];
      g.fx.push({ t: 'flame', a: u.id, c: t.c, r: t.r, ranged: !near, n: 2 });
      startFire(g, u, t.c, t.r);
    } else { log(g, `${u.name}向糧營射出火箭，火勢漸起（1/2）`, u.side); g.fx.push({ t: 'flame', a: u.id, c: t.c, r: t.r, ranged: !near, n: 1 }); }
    return true;
  }
  function startFire(g, u, c, r) {
    g.vars.burning = g.vars.burning || {}; g.vars.dstage = g.vars.dstage || {};
    g.vars.burning[H.key(c, r)] = { since: g.round, by: u.gen };
    g.fx.push({ t: 'burn', c, r, start: true });
    advanceFire(g, u, c, r);   // 點燃當下馬上損第一段
  }
  function advanceFire(g, u, c, r) {
    const k = H.key(c, r), n = Math.min(3, (g.vars.dstage[k] || 0) + 1); g.vars.dstage[k] = n;
    const SR = SC_RULES[g.sc.id], from = FIRE_CUM[n - 1], to = FIRE_CUM[n];
    if (SR && SR.onDepotDamage) SR.onDepotDamage(g, u, c, r, { n, from, to });
    if (n >= 3) { g.map[r][c] = '.'; delete g.vars.burning[k]; g.fx.push({ t: 'burn', c, r }); }
  }
  function douse(g, u, t) {
    u.acted = true; delete g.vars.burning[t.k];
    const left = Math.round((1 - FIRE_CUM[g.vars.dstage[t.k] || 0]) * 100);
    log(g, `${u.name}率人撲滅糧營的大火，還剩 ${left}% 存糧`, u.side, 'big');
    g.fx.push({ t: 'douse', a: u.id, c: t.c, r: t.r });
    return true;
  }
  // 每回合結束：還在燒的糧營（不是這回合才點燃的）再燒一段；每回合開始：決定天氣，下雨就澆熄所有火
  function tickFires(g) {
    for (const k of Object.keys(g.vars.burning || {})) {
      const f = g.vars.burning[k]; if (g.round <= f.since) continue;
      const [c, r] = H.unkey(k); const by = g.units.find(x => x.gen === f.by) || g.units[0];
      advanceFire(g, by, c, r);
    }
  }
  function startWeather(g) {
    const w = weatherAt(g, g.round), prev = g.vars.weather; g.vars.weather = w;
    if (w === '雨') {
      if (g.vars.burning && Object.keys(g.vars.burning).length) { g.vars.burning = {}; g.fx.push({ t: 'rain' }); log(g, '大雨澆熄了糧營的火勢', null, 'big'); }
      g.vars.fire = {};
    }
    if (prev !== w) log(g, `第 ${g.round} 回合：${WEATHER_ICON[w]} ${w}`, null);
    forecast(g);
  }
  // 智力 90 以上的人物（陣中存活）能看出未來兩回合的天氣轉變：開始下雨、或雨停放晴
  const seer = (g, side) => alive(g).filter(u => u.side === side && !isEngine(u) && gen(u).int >= 90).sort((a, b) => gen(b).int - gen(a).int)[0] || null;
  function forecast(g) {
    const v = g.vars; v.fcAnn = v.fcAnn || {};
    let prev = g.vars.weather;
    for (let d = 1; d <= 2; d++) {
      const w = weatherAt(g, g.round + d);
      if (w !== prev && (w === '雨' || prev === '雨')) {
        for (const side of ['att', 'def']) {
          const s = seer(g, side), key = side + ':' + (g.round + d); if (!s || v.fcAnn[key]) continue; v.fcAnn[key] = 1;
          const when = d === 1 ? '明天' : '後天', text = w === '雨' ? `${when}（第 ${g.round + d} 回合）怕是要下雨了，糧營的火勢會被澆熄，也點不起火。` : `${when}（第 ${g.round + d} 回合）雨就要停了，天要放晴，火勢不會再被雨澆熄。`;
          log(g, `${s.name}觀天象：${text}`, side);
          g.fx.push({ t: 'forecast', side, gen: s.gen, name: s.name, text });
        }
      }
      prev = w;
    }
  }
  // 步騎射箭：一般步兵 3 成、騎兵 3 成 5 的攻擊力；「騎射」的呂布接近精銳弓兵
  function shootPower(u) { return has(u, 'qishe') ? 0.6 : u.type === 'cav' ? 0.22 : 0.18; }
  const shootRange = (g, u) => (has(u, 'qishe') ? 3 : 2) + (terr(g, u.c, u.r).h >= 1 ? 1 : 0);
  function shootTargets(g, u) {
    if (u.acted || isEngine(u) || ty(u).ranged || state(u) === 'disorder') return [];
    const R = shootRange(g, u);
    return enemiesOf(g, u).filter(v => { const d = H.dist(u.c, u.r, v.c, v.r); return d >= 2 && d <= R && !(isEngine(v) && unitAt(g, v.c, v.r) !== v); });
  }
  const steadfast = u => has(u, 'xianzhen') || has(u, 'xiandeng');   // 陷陣、先登：陣型不易亂、永不就地解散
  // 統率越高，陣型越不容易被打亂：統率 50 受 8 成影響、70 受 6 成、90 只受 4 成（最低 3 成）
  function steady(u) { return clamp(1.3 - gen(u).lead / 100, 0.3, 1); }
  // 兩軍合流：主帥（劇本的主將，否則統率較高者）那一支留下，另一支併入；位置取兵力較多的那一格（殘部因此脫離包圍）
  function merge(g, u, v) {
    const leader = g.sc.sides[u.side].leader;
    const cmd = u.gen === leader ? u : v.gen === leader ? v : (gen(u).lead >= gen(v).lead ? u : v);
    const other = cmd === u ? v : u, big = u.troops >= v.troops ? u : v, tot = u.troops + v.troops;
    const coh = (u.coh * u.troops + v.coh * v.troops) / tot, mor = (u.mor * u.troops + v.mor * v.troops) / tot;
    const from = [cmd.c, cmd.r];
    cmd.c = big.c; cmd.r = big.r; cmd.face = big.face;
    if (cmd !== big) { cmd.type = big.type; cmd.form = big.form; }
    cmd.troops = tot; cmd.max = Math.max(u.max, v.max, tot);
    cmd.coh = clamp(coh + 5, 0, 100); cmd.mor = clamp(mor + 10, 0, 100); cmd.broken = false;
    cmd.joined = [...(cmd.joined || []), other.gen];
    // 併入的部隊離開戰場（不算陣亡），也不再輪到行動
    other.alive = false; other.merged = cmd.id; other.troops = 0;
    for (const k in g.ladders) if (g.ladders[k] === other.id) delete g.ladders[k];
    u.acted = true; u.moved = true; cmd.acted = true; cmd.moved = true;
    g.order = g.order.filter((id, i) => i <= g.oi || id !== cmd.id);   // 合流後的部隊這回合已經行動過，不再輪到
    log(g, `${other.name}與${cmd.name}兩軍合流！由${cmd.name}統領，兵力 ${tot}`, u.side, 'big');
    g.fx.push({ t: 'merge', id: cmd.id, gone: other.id, from, path: [from, [cmd.c, cmd.r]] });
    checkVictory(g);
    return true;
  }
  function duel(g, u, D) {
    u.acted = true; u.attacked = true; u.dueled = true; u.face = H.dirTo(u.c, u.r, D.c, D.r);
    const a = gen(u), b = gen(D);
    if (b.war < a.war - 12) {
      D.mor = clamp(D.mor - 10, 0, 100);
      log(g, `${u.name}陣前叫陣，${D.name}不敢應戰，部隊士氣下滑`, u.side);
      g.fx.push({ t: 'duel', a: u.id, d: D.id, result: 'refuse' });
      checkCollapse(g, D); return true;
    }
    D.dueled = true;
    const diff = a.war - b.war; let result;
    if (Math.abs(diff) < 5 && g.rnd() < 0.2) result = 'draw';
    else result = g.rnd() < clamp(0.5 + diff / 40, 0.1, 0.9) ? 'win' : 'lose';
    const W = result === 'win' ? u : D, Lz = result === 'win' ? D : u;
    if (result === 'draw') { log(g, `${u.name}與${D.name}大戰數十回合，不分勝負`, u.side); }
    else {
      W.mor = clamp(W.mor + 15, 0, 100); Lz.mor = clamp(Lz.mor - 25, 0, 100); Lz.coh = clamp(Lz.coh - 20 * steady(Lz) * 1.4, 0, 100);
      log(g, `單挑！${W.name}擊敗${Lz.name}，${Lz.name}部軍心動搖`, W.side, 'big');
      checkCollapse(g, Lz);
    }
    g.fx.push({ t: 'duel', a: u.id, d: D.id, result });
    checkVictory(g);
    return true;
  }

  // ---------- 回合結束 ----------
  function endRound(g) {
    for (const u of alive(g)) {
      for (const k in u.cd) if (u.cd[k] > 0) u.cd[k]--;
      if (isEngine(u)) continue;
      const lead = gen(u).lead;
      if (encircled(g, u)) { u.coh -= 8 * steady(u); u.mor -= 6; }
      else if (!adjEnemies(g, u).length) { u.coh += 4 + lead / 12; if (!(g.vars.flooded && u.side === 'def' && inCity(g, u))) u.mor += 2; }
      else u.coh += Math.max(0, (lead - 70) / 5);   // 統率高的將領在交戰中也能穩住陣腳（統率 90：每回合 +4）
      if (g.units.some(v => v.alive && v.side === u.side && v !== u && has(v, 'jianxiong') && H.dist(v.c, v.r, u.c, u.r) <= 2)) { u.mor += 3; u.coh += 4; }
      if (terr(g, u.c, u.r).water) { u.coh -= 8 * steady(u); u.troops = Math.round(u.troops * 0.97); }
      u.coh = clamp(u.coh, 0, 100); u.mor = clamp(u.mor, 0, 100);
      checkCollapse(g, u);
    }
    // 箭樓自動放箭
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) {
      if (g.map[r][c] !== 'T' || !(g.hp[H.key(c, r)] > 0)) continue;
      const occ = unitAt(g, c, r); if (occ && occ.side === 'att') continue;
      const tg = g.units.filter(v => v.alive && v.side === 'att' && !inCity(g, v) && H.dist(c, r, v.c, v.r) <= 3).sort((a, b) => H.dist(c, r, a.c, a.r) - H.dist(c, r, b.c, b.r))[0];
      if (!tg) continue;
      const dmg = Math.round(70 * (0.85 + g.rnd() * 0.3) * (isEngine(tg) ? 0.8 : 1));
      g.fx.push({ t: 'tower', c, r, d: tg.id, dmg });
      applyLoss(g, tg, Math.min(dmg, tg.troops), { ranged: true });
    }
    tickFires(g);
    if (SC_RULES[g.sc.id]) SC_RULES[g.sc.id].onRoundEnd(g);
    checkVictory(g, true);
  }

  // ---------- 勝負 ----------
  function checkVictory(g, roundEnd) {
    if (g.over) return;
    let r = null;
    if (SC_RULES[g.sc.id]) r = SC_RULES[g.sc.id].victory(g, roundEnd);
    if (r) { g.over = r; g.active = null; g.fx.push({ t: 'over' }); }
  }

  // ---------- 下邳之戰專屬規則 ----------
  const XIAPI = {
    onRoundStart(g) {
      const v = g.vars;
      if (g.round === 1) {
        msg(g, '下邳之戰', '曹操大軍東征，呂布在泗水西岸列陣迎擊。陳宮建議：「將軍若引兵屯於城外，宮守城於內，曹軍攻城則將軍擊其背，攻將軍則宮出兵救之，此掎角之勢也。」', null, [['chengong', 'default']]);
      }
      if (v.flooded && !v.receded && v.floodStage < 3 && g.round >= v.floodRound + v.floodStage) XIAPI.floodStep(g, v.floodStage + 1);
      if (v.flooded && !v.receded && g.round >= v.floodRound + 4) XIAPI.recede(g);
      if (g.round === v.digUnlock && !v.flooded) {
        v.digOpen = true;
        const xun = g.units.find(u => u.gen === 'xunyou' && u.alive && u.side === 'att');
        msg(g, '荀攸、郭嘉獻策', `${xun ? '荀攸' : '郭嘉'}進言：「呂布勇而無謀，今三戰皆北，其銳氣衰矣。」建議掘開泗水、沂水灌城。\n\n【可以掘堤了】\n・河堤在城北泗水邊（地圖上標著 ⛏ 的格子，上方「掘堤」數字可以點一下帶你過去）\n・派步兵或弓兵站上河堤，執行「掘堤」，累計 ${v.digNeed} 次就水淹下邳${xun ? '\n・荀攸親自督工，一次算兩次' : ''}\n・呂布軍可以派兵佔住河堤阻止掘堤`, 'att', [[xun ? 'xunyou' : 'caocao', xun ? 'plan' : 'default']]);
      }
    },
    actions(g, u, add) {
      const v = g.vars;
      if (u.side === 'att' && v.digOpen && !v.flooded && g.map[u.r][u.c] === 'd' && !isEngine(u)) {
        add({ id: 'dig', name: `掘堤（本段 ${(v.digSeg || {})[H.key(u.c, u.r)] || 0}/${v.digNeed}）`, desc: '挖開腳下這一段河堤：同一段挖滿後決堤，大水從這裡開始淹向城下（低地上的攻城器械會被沖毀），城內糧食消耗變 3 倍、士氣每回合下降。守軍可以在旁邊「搶修」把進度倒扣。' });
      }
      // 搶修河堤：守軍站在堤上或相鄰，把一段堤的掘堤進度 −2
      if (u.side !== 'att' && v.digOpen && !v.flooded && !isEngine(u) && !u.acted) {
        const targets = []; for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'd') { const k = H.key(c, r), d = H.dist(u.c, u.r, c, r); if (d <= 1 && (v.digSeg || {})[k] > 0) targets.push({ c, r, k, dist: d }); }
        if (targets.length) add({ id: 'mend', name: '搶修河堤', desc: '站在河堤上或相鄰時，花一次動作把一段堤的掘堤進度 −2（水淹之後就修不了了）。', need: 'hex', targets });
      }
    },
    doAction(g, u, id, target) {
      const v = g.vars; v.digSeg = v.digSeg || {};
      if (id === 'mend') {
        const A = actionsFor(g, u).find(a => a.id === 'mend'); const t = A && A.targets.find(x => x.k === target); if (!t) return false;
        v.digSeg[t.k] = Math.max(0, v.digSeg[t.k] - 2); u.acted = true; v.dig = Math.max(0, ...Object.values(v.digSeg));
        log(g, `${u.name}搶修河堤，這一段掘堤進度降到 ${v.digSeg[t.k]}/${v.digNeed}`, u.side); g.fx.push({ t: 'dig', id: u.id, mend: true });
        return true;
      }
      if (id !== 'dig') return false;
      const k = H.key(u.c, u.r); v.digSeg[k] = (v.digSeg[k] || 0) + (u.gen === 'xunyou' ? 2 : 1); u.acted = true;
      v.dig = Math.max(...Object.values(v.digSeg));
      log(g, `${u.name}掘堤（本段 ${Math.min(v.digSeg[k], v.digNeed)}/${v.digNeed}）`, u.side);
      g.fx.push({ t: 'dig', id: u.id });
      if (v.digSeg[k] >= v.digNeed) XIAPI.flood(g, [u.c, u.r]);
      return true;
    },
    flood(g, origin) {
      const v = g.vars; v.flooded = true; v.floodAt = origin || null; v.floodRound = g.round; v.floodStage = 0;
      // 低地依離河堤的遠近分三波淹：近的先淹，之後每回合再漫開一圈
      const dikes = [origin || [12, 2]];   // 從決堤的那一段開始淹
      const lows = []; for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'l') lows.push([c, r, Math.min(...dikes.map(([dc, dr]) => H.dist(c, r, dc, dr)))]);
      lows.sort((x, y) => x[2] - y[2] || x[1] - y[1] || x[0] - y[0]);
      const per = Math.ceil(lows.length / 3); v.floodWaves = [0, 1, 2].map(i => lows.slice(i * per, (i + 1) * per).map(([c, r]) => [c, r]));
      XIAPI.floodStep(g, 1);
      msg(g, '水淹下邳', '泗水、沂水決堤，大水灌入下邳城下。城外一片汪洋，城內糧草漸絕、人心惶惶。\n\n【水淹後】\n・大水分三回合越漲越高：先淹靠河堤的低地，下回合、再下回合漸漸漫到城下各處（第 3 回合淹到最高）\n・淹到的低地變成大水：步兵、騎兵可以涉水，但走得慢、受傷多一成；器械過不去，原本在低地上的器械被沖走\n・通往城門的大路沒有淹，可以沿路進逼城門\n・城內糧食消耗變 3 倍、守軍每回合士氣 −4，城牆耐久慢慢下降；士氣太低時可能有人倒戈\n・掘堤後第 4 回合大水會退成泥濘，器械也能慢慢通過', 'att', [['lubu', 'haggard']]);
      for (const k in g.hp) { const [c, r] = H.unkey(k); if (g.hp[k] > 0) damageStruct(g, c, r, 8, null); }
    },
    // 第 n 波大水（1～3）：這一波的低地變成大水，站在上面的人受損、器械被沖毀
    floodStep(g, n) {
      const v = g.vars, hexes = v.floodWaves[n - 1] || []; v.floodStage = n;
      for (const [c, r] of hexes) if (g.map[r][c] === 'l') g.map[r][c] = 'w';
      g.fx.push({ t: 'flood', hexes, stage: n });
      if (n > 1) log(g, n === 3 ? '大水漲到最高，城下一片汪洋' : '大水又漫開一圈', 'att');
      for (const u of alive(g)) if (g.map[u.r][u.c] === 'w' && hexes.some(([c, r]) => c === u.c && r === u.r)) {
        if (isEngine(u)) { log(g, `${u.name}被大水沖走`, u.side, 'bad'); destroy(g, u, '被大水沖毀'); continue; }
        u.coh = clamp(u.coh - 25, 0, 100); applyLoss(g, u, Math.round(u.troops * 0.08), {});
      }
    },
    recede(g) {
      const v = g.vars; v.receded = true; const hexes = [];
      for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'w') { g.map[r][c] = 'm'; hexes.push([c, r]); }
      g.fx.push({ t: 'recede', hexes });
      msg(g, '大水退去', '城外的大水退成泥濘：步兵、騎兵移動仍然較慢，器械也能緩慢通過了。城內依然缺糧，守軍士氣持續下降。', null, []);
    },
    // 糧營被燒：每一段損失＝原存量 × (累計比例 ← 前累計比例)，四捨五入不丟失；士氣也依同樣比例扣（合計 −4）
    onDepotDamage(g, on, c, r, { n, from, to }) {
      const v = g.vars, d = v.depots.find(x => x.c === c && x.r === r); if (!d || d.burnt) return;
      const loss = Math.round(d.s * to) - Math.round(d.s * from), mor = Math.round(4 * to) - Math.round(4 * from);
      v.supply -= loss; d.lost = (d.lost || 0) + loss;
      for (const u of alive(g)) if (u.side === 'att' && !isEngine(u)) u.mor = clamp(u.mor - mor, 0, 100);
      if (n >= 3) { d.burnt = true; v.depotBurnt = v.depots.every(x => x.burnt); }
      const left = v.depots.filter(x => !x.burnt).length;
      if (n === 1) msg(g, '火燒糧營', `${on.name}放火燒了曹軍的${d.name}！第一段燒掉 ${loss} 糧；不撲滅的話，之後每回合結束會再燒 30%、55%（共 ${d.s} 糧）。下雨或曹軍滅火才會停。`, 'def', [[on.gen, 'default']]);
      else if (n === 2) log(g, `${d.name}大火蔓延，又燒掉 ${loss} 糧`, 'def', 'big');
      else msg(g, '糧營燒光', `${d.name}被燒光了（共 ${d.s} 糧）！曹軍糧草 −${loss}。${left ? `曹軍還剩 ${left} 座糧營。` : '曹軍的糧營全被燒光了！'}`, 'def', [[on.gen, 'default']]);
    },
    onRoundEnd(g) {
      const v = g.vars;
      // 糧草單位＝千人日：每天吃掉現存作戰部隊人數 ÷ 1000
      v.supply -= supplyStat(g).daily;
      // 糧營：回合結束時站在糧營上的守方部隊會把它燒光；靠近（2 格內）的守方部隊每回合騷擾糧道
      let harass = false;
      for (const d of v.depots) {
        if (d.burnt) continue;
        if (g.units.some(u => u.alive && u.side === 'def' && !isEngine(u) && H.dist(u.c, u.r, d.c, d.r) <= 2)) harass = true;
      }
      if (harass && v.supply > 0) { v.supply -= 10; log(g, '呂布軍襲擾曹軍糧道，糧草 −10', 'def', 'big'); }
      // 缺糧：曹軍軍心天天下降，撐不了幾天就得退兵
      v.supply = Math.max(v.supply, -999);
      if (v.supply <= 0) {
        v.starve += 1;
        if (v.starve === 1) msg(g, '曹軍缺糧', `曹軍糧草耗盡！\n\n【缺糧】曹軍各部每回合軍心 −8，陣勢也會動搖；撐 ${v.starveLimit} 回合軍心渙散，曹操就只能退兵（守方獲勝）。守方只要守住、拖住就好。`, 'def', [['caocao', 'weep']]);
        else log(g, `曹軍缺糧第 ${v.starve} 天，軍心渙散`, 'att', 'bad');
        for (const u of alive(g)) if (u.side === 'att' && !isEngine(u)) { u.mor = clamp(u.mor - 8, 0, 100); u.coh = clamp(u.coh - 3, 0, 100); checkCollapse(g, u); }
      }
      // 城中糧草
      const cityDef = alive(g).filter(u => u.side === 'def' && inCity(g, u) && !isEngine(u));
      if (cityDef.length) {
        v.food -= cityDef.reduce((s, u) => s + u.troops, 0) / 1000 * (v.flooded ? 3 : 1);   // 一樣是千人日；水淹後糧食泡爛，消耗是平常的 3 倍
        if (v.food <= 0) { v.food = 0; for (const u of cityDef) { u.mor = clamp(u.mor - 8, 0, 100); checkCollapse(g, u); } log(g, '城中糧盡，守軍士氣低落', 'def', 'bad'); }
        if (v.flooded) for (const u of cityDef) u.mor = clamp(u.mor - 4, 0, 100);
      }
      if (v.flooded) for (const k in g.hp) { const [c, r] = H.unkey(k); if (g.hp[k] > 0) { g.hp[k] = Math.max(1, g.hp[k] - 2); } }
      // 倒戈
      if (!v.betrayed && cityDef.length) {
        const avg = cityDef.reduce((s, u) => s + u.mor, 0) / cityDef.length;
        v.unrest = avg < 55;
        const traitors = cityDef.filter(u => (gen(u).loyal || 100) < 50);
        const strain = traitors.reduce((s, u) => s + (u.lijian || 0), 0);
        if (traitors.length && g.round >= 8 && ((v.flooded && avg < 65) || avg < 38 + strain * 4 || v.food <= 0)) XIAPI.betray(g, traitors);
      }
    },
    betray(g, traitors) {
      const v = g.vars; v.betrayed = true; v.unrest = false;
      for (const u of traitors) { u.side = 'att'; u.coh = 60; u.mor = 70; }
      g.fx.push({ t: 'defect', ids: traitors.map(u => u.id) });
      // 開城門
      for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'G' && c < 18) { g.map[r][c] = 'o'; g.hp[H.key(c, r)] = 0; g.fx.push({ t: 'struct', c, r, dmg: 0, broke: true, kind: 'open' }); }
      const chen = g.units.find(u => u.gen === 'chengong' && u.alive && u.side === 'def');
      if (chen && inCity(g, chen)) { chen.troops = Math.round(chen.troops * 0.5); chen.coh = 10; chen.mor = 20; checkCollapse(g, chen); }
      msg(g, '侯成、宋憲、魏續倒戈', `${traitors.map(u => u.name).join('、')}${chen ? '綁了陳宮，' : ''}率眾開城投降曹操！西城門已經打開。`, 'att', traitors.map(u => [u.gen, u.gen === 'houcheng' ? 'grudge' : 'plot']));
    },
    victory(g, roundEnd) {
      const v = g.vars;
      const lu = g.units.find(u => u.gen === 'lubu'), cao = g.units.find(u => u.gen === 'caocao');
      const defAlive = alive(g).filter(u => u.side === 'def' && !isEngine(u));
      const attAlive = alive(g).filter(u => u.side === 'att' && !isEngine(u));
      const end = (winner, route) => ({ winner, route, round: g.round });
      if (!lu.alive) {
        if (v.flooded && v.betrayed) return end('att', 'history');
        if (!inCity(g, lu) && !v.flooded) return end('att', 'field');
        return end('att', 'storm');
      }
      if (!cao.alive) return end('def', 'caodown');
      if (!defAlive.length) return end('att', 'storm');
      if (!attAlive.length) return end('def', 'rout');
      if (roundEnd) {
        const pal = g.units.find(u => u.alive && u.side === 'att' && g.map[u.r][u.c] === 'P');
        if (pal) return end('att', v.flooded && v.betrayed ? 'history' : 'storm');
        if (v.supply <= 0 && v.starve >= v.starveLimit) return end('def', defAlive.some(u => !inCity(g, u)) ? 'jijiao' : 'supply');
      }
      return null;
    },
  };
  // who：事件頭像 [[武將, 情緒], …]
  // 戰報只記第一段；視窗顯示全文（空一行之後是操作說明）
  function msg(g, title, text, side, who) { g.log.push({ round: g.round, text: `【${title}】${text.split('\n\n')[0]}`, side: side || null, kind: 'event' }); g.fx.push({ t: 'msg', title, text, side, who }); }

  // ---------- 合肥之戰專屬規則 ----------
  const sunOf = g => g.units.find(u => u.gen === 'sunquan');
  const escaped = (g, u) => g.sc.escape.some(([c, r]) => c === u.c && r === u.r);
  const HEFEI = {
    // 吳營被燒：全軍士氣合計 −10，依 15%／30%／55% 分三段扣
    onDepotDamage(g, on, c, r, { n, from, to }) {
      const v = g.vars; v.campBurnt = true;
      const mor = Math.round(10 * to) - Math.round(10 * from);
      for (const u of alive(g)) if (u.side === 'att' && !isEngine(u)) u.mor = clamp(u.mor - mor, 0, 100);
      if (n === 1) msg(g, '火燒吳營', `${on.name}放火燒了吳軍大營！吳軍全軍士氣 −${mor}；不撲滅的話，之後每回合結束會再燒 30%、55%（士氣合計 −10）。下雨或吳軍滅火才會停。`, 'def', [[on.gen, on.gen === 'zhangliao' ? 'charge' : 'default']]);
      else log(g, `吳軍大營${n >= 3 ? '被燒光了' : '大火蔓延'}，全軍士氣 −${mor}`, 'def', 'big');
    },
    onRoundStart(g) {
      const v = g.vars;
      if (g.round === 1) {
        // 天亮突襲：吳軍營寨未整
        for (const u of g.units) if (u.side === 'att' && !isEngine(u)) { u.coh = 55; u.mor = 70; }
        for (const u of g.units) if (u.gen === 'zhangliao' || u.gen === 'lidian') u.mor = 100;
        // 天亮出擊：第 1 回合魏軍全部先動，吳軍才醒過來
        g.order = [...g.order.filter(id => g.units[id].side === 'def'), ...g.order.filter(id => g.units[id].side === 'att')];
        msg(g, '合肥之戰', '孫權率十萬大軍圍合肥。張遼、李典、樂進打開曹操的密函：「若孫權至者，張、李將軍出戰；樂將軍守護軍，勿得與戰。」張遼連夜募得敢死之士八百人，殺牛犒軍，準備天亮出擊。\n\n【晨襲】\n・天亮出擊：第 1 回合魏軍全部先行動；吳軍營寨還沒整好，各部陣型鬆散（陣勢 55），第 1、2 回合攻擊力 ×0.7（倉促應戰）\n・張遼「遼來」：攻擊 +20%，每回合讓身邊 2 格的吳軍士氣下降\n・孫權在南邊的小土丘上；吳軍大營在西南，走到旁邊按「放火燒營」（或射火箭）就能燒掉，吳軍全軍士氣 −10\n・突擊完要從南門或東門退回城裡', null, [['zhangliao', 'charge'], ['lidian', 'resolve'], ['yuejin', 'default']]);
      }
      if (g.round === v.plagueRound && !v.plague && !v.retreating) {
        v.plague = true;
        msg(g, '吳軍疫病', `吳軍久屯城下，軍中疫病流行。\n\n【疫病】每回合結束時，吳軍各部兵力 −3%、士氣 −3。第 ${v.retreatRound} 回合（或兵力折損過半）孫權就會下令撤軍。`, null, [['sunquan', 'worry']]);
      }
      if (!v.retreating) {
        const att = g.units.filter(u => u.side === 'att' && !isEngine(u));
        const now = att.filter(u => u.alive).reduce((s, u) => s + u.troops, 0), all = att.reduce((s, u) => s + u.max, 0);
        if (g.round >= v.retreatRound || now < all * 0.5) HEFEI.retreat(g);
      } else if (!v.bridgeBroken && g.round >= v.retreatStart + 2) {
        v.bridgeBroken = true;
        for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === '=') { g.map[r][c] = 'b'; g.fx.push({ t: 'burn', c, r }); }
        const sun = sunOf(g);
        msg(g, '逍遙津斷橋', '魏軍拆掉了逍遙津橋的橋板！\n\n【斷橋】除了孫權能「躍馬」跳過斷橋，其他吳軍都過不去了。凌統「斷後」：撤軍時受傷 −25%、不會潰逃。', 'def', [[sun && sun.alive ? 'sunquan' : 'zhangliao', sun && sun.alive ? 'leap' : 'charge'], ['lingtong', 'guard']]);
      }
    },
    retreat(g) {
      const v = g.vars; v.retreating = true; v.retreatStart = g.round;
      msg(g, '孫權撤軍', '合肥久攻不下，疫病蔓延，孫權下令撤軍。大軍先行，孫權與凌統、甘寧等殿後，走到逍遙津北岸……\n\n【撤軍】\n・吳軍要讓孫權從東邊的逍遙津橋過淝水，退到地圖東緣的撤退區就安全了（其他部隊到了撤退區也會撤離戰場）\n・2 回合後魏軍會拆掉橋板，之後只有孫權能躍馬跳過\n・魏軍：追擊！擊潰孫權部隊就能生擒孫權', 'att', [['sunquan', 'worry'], ['zhangliao', 'charge']]);
    },
    onRoundEnd(g) {
      const v = g.vars;
      if (v.plague && !v.retreating) {
        for (const u of alive(g)) if (u.side === 'att' && !isEngine(u)) { u.troops = Math.max(1, Math.round(u.troops * 0.97)); u.mor = clamp(u.mor - 3, 0, 100); }
        log(g, '吳軍疫病蔓延，各部兵力 −3%、士氣 −3', 'att', 'bad');
      }
      // 遼來：張遼身邊的敵軍士氣下降
      for (const z of alive(g)) if (has(z, 'liaolai')) for (const u of alive(g)) if (u.side !== z.side && !isEngine(u) && H.dist(u.c, u.r, z.c, z.r) <= 2) { u.mor = clamp(u.mor - 4, 0, 100); checkCollapse(g, u); }
      // 撤退區：過了橋的吳軍部隊撤離戰場（孫權到了就結束）
      if (v.retreating) for (const u of alive(g)) if (u.side === 'att' && u.gen !== 'sunquan' && escaped(g, u)) { u.alive = false; u.escaped = true; log(g, `${u.name}部撤過淝水`, 'att'); g.fx.push({ t: 'dead', id: u.id }); }
    },
    victory(g, roundEnd) {
      const v = g.vars, sun = sunOf(g);
      const end = (winner, route) => ({ winner, route, round: g.round });
      if (!sun.alive) return end('def', v.retreating ? 'capture' : 'raid');
      if (v.retreating && escaped(g, sun)) return end('def', 'history');
      if (!alive(g).some(u => u.side === 'def' && !isEngine(u))) return end('att', 'storm');
      if (!alive(g).some(u => u.side === 'att' && !isEngine(u))) return end('def', v.retreating ? 'capture' : 'rout');
      if (roundEnd) {
        if (g.units.some(u => u.alive && u.side === 'att' && g.map[u.r][u.c] === 'P')) return end('att', 'storm');
        if (g.round >= 18) return end('def', 'history');
      }
      return null;
    },
  };
  // 糧草現況（單位：千人日）：現有、每天消耗、還能撐幾天；城中糧同理
  function supplyStat(g) {
    const v = g.vars, daily = alive(g).filter(u => u.side === 'att' && !isEngine(u)).reduce((s, u) => s + u.troops, 0) / 1000;
    const cityTroops = alive(g).filter(u => u.side === 'def' && inCity(g, u) && !isEngine(u)).reduce((s, u) => s + u.troops, 0) / 1000;
    const days = (x, per) => (per > 0 ? Math.floor(Math.max(0, x) / per) : 99);
    return { supply: Math.max(0, Math.round(v.supply)), daily, days: days(v.supply, daily), food: Math.max(0, Math.round(v.food)), cityDaily: cityTroops, foodDays: days(v.food, cityTroops * (v.flooded ? 3 : 1)) };
  }
  const SC_RULES = { xiapi: XIAPI, hefei: HEFEI };

  // ---------- 結局文字 ----------
  const ENDINGS = {
    xiapi: {
      history: { title: '白門樓', tag: '尊重歷史', text: '水淹下邳、部將倒戈，呂布在白門樓被圍投降。一如史書所載：曹操縊殺呂布，陳宮、高順從容就死，張遼歸降曹操。', who: [['lubu', 'plead'], ['caocao', 'weep'], ['chengong', 'calm'], ['gaoshun', 'silent'], ['zhangliao', 'defy'], ['liubei', 'cold']] },
      storm: { title: '強攻破城', tag: '異於史實', text: '曹軍不靠水攻與內應，以器械與猛攻正面攻陷下邳。呂布被擒，曹操一統徐州的時間比歷史更早。', who: [['caocao', 'laugh'], ['lubu', 'plead']] },
      field: { title: '野戰擒呂布', tag: '逆轉歷史', text: '曹軍在泗水西岸的野戰中就擊潰了呂布本陣，下邳不戰而降。天下第一猛將的傳說，在城外就畫下句點。', who: [['caocao', 'laugh'], ['lubu', 'plead']] },
      supply: { title: '曹軍糧盡退兵', tag: '逆轉歷史', text: '下邳城堅守到底，曹軍糧草耗盡，只得撤回許都。呂布保住徐州，天下局勢從此大不相同。', who: [['lubu', 'default'], ['caocao', 'default']] },
      jijiao: { title: '掎角之計奏效', tag: '逆轉歷史', text: '呂布終於採納陳宮的掎角之計：城外騎兵襲擾糧道，城內堅守不出，曹軍進退兩難，只好糧盡退兵。', who: [['chengong', 'default'], ['lubu', 'default']] },
      caodown: { title: '曹操兵敗下邳', tag: '逆轉歷史', text: '曹操本陣被呂布軍擊潰，曹軍大亂退走。少了曹操的中原，歷史將走向完全不同的方向。', who: [['lubu', 'default'], ['caocao', 'default']] },
      rout: { title: '曹軍全面潰敗', tag: '逆轉歷史', text: '曹軍各部相繼潰散，東征以慘敗收場。', who: [['lubu', 'default']] },
    },
    hefei: {
      history: { title: '威震逍遙津', tag: '尊重歷史', text: '吳軍久攻合肥不下，疫病蔓延，只得撤退。張遼在逍遙津追擊，凌統拚死斷後，孫權躍馬跳過斷橋才逃出生天。從此「遼來遼來」，江東小兒聞之不敢夜啼。', who: [['zhangliao', 'charge'], ['sunquan', 'leap'], ['lingtong', 'guard']] },
      raid: { title: '八百破十萬', tag: '逆轉歷史', text: '張遼的晨襲一路殺到孫權帥旗下，這一次孫權沒能退上土丘——吳軍主帥被擒，十萬大軍不戰自潰。', who: [['zhangliao', 'charge'], ['sunquan', 'worry']] },
      capture: { title: '生擒孫權', tag: '逆轉歷史', text: '逍遙津橋斷，凌統沒能擋住追兵，孫權被張遼生擒。江東群龍無首，三國的局勢從此改寫。', who: [['zhangliao', 'charge'], ['sunquan', 'worry']] },
      storm: { title: '攻陷合肥', tag: '逆轉歷史', text: '吳軍頂住了張遼的突襲，趕在疫病擴散前攻破合肥。江淮門戶落入東吳手中，曹魏的東南防線大為動搖。', who: [['sunquan', 'default'], ['lumeng', 'default'], ['ganning', 'default']] },
      rout: { title: '吳軍潰敗', tag: '逆轉歷史', text: '吳軍各部在合肥城下相繼潰散，北伐以慘敗收場。', who: [['zhangliao', 'charge']] },
    },

  };

  // ---------- 匯出 ----------
  root.RULES = {
    newGame, serialize, restore, startRound, nextActivation, endActivation, activeUnit, upcoming,
    steady, seer, hidden, supplyStat, shootTargets, depotTargets, douseTargets, WEATHER_ICON, weatherAt, reachable, pathTo, moveUnit, unitsAt, canStop, canChoose, chooseActive, undoMove, setFacing, maxMP,
    attackTargets, structTargets, attack, calcDamage, canCounter, actionsFor, doAction,
    unitAt, terr, tAt, state, STATE_NAME, formOf, encircled, adjEnemies, sideHit, inCity, onWall, isEngine, gen, ty, has, alive, enemiesOf, friendsOf,
    rangeOf, canMeleeReach, ENDINGS, other, clamp, inZOC, moveCost,
  };
})(typeof window !== 'undefined' ? window : globalThis);
