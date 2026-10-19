// ===== 規則（純邏輯，不碰畫面）=====
// 一個「回合」裡，所有部隊依速度排序輪流行動（敵我交錯）。每支部隊行動時：可移動一次、做一個動作，最後決定朝向。
// 畫面層透過 g.fx（特效佇列）與 g.log（戰報）得知發生了什麼。
(function (root) {
  const { TERRAIN, UNIT_TYPES, COUNTER, BASE_DEF, FORMATIONS, DISORDER, FORM_ALLOWED, SIDE_NAME, SKILLS, GENERALS, SCENARIOS } = root.DATA;
  const H = root.HEX;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const other = s => (s === 'att' ? 'def' : 'att');

  function rngFrom(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function inMap(g, c, r) { return r >= 0 && r < g.Hh && c >= 0 && c < g.W; }
  // ---------- 建立新局 ----------
  function newGame(scId, opts = {}) {
    const sc = SCENARIOS.find(s => s.id === scId);
    const seed = opts.seed != null ? opts.seed : (Date.now() % 1e9);
    const g = {
      sc, scId, seed, rnd: rngFrom(seed), player: opts.player || null,
      map: sc.map.map(row => row.split('')), W: sc.map[0].length, Hh: sc.map.length,
      hp: {}, ladders: {}, units: [], round: 0, order: [], oi: -1, active: null,
      vars: JSON.parse(JSON.stringify(sc.vars)), log: [], fx: [], over: null,
      stats: { att: { kills: 0, lost: 0 }, def: { kills: 0, lost: 0 } }, flags: {},
    };
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) {
      const t = TERRAIN[g.map[r][c]]; if (t.hp) g.hp[H.key(c, r)] = t.hp;
    }
    // 城內範圍：從府衙往外填，碰到城牆為止
    g.city = new Set();
    const st = []; for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'P') st.push([c, r]);
    while (st.length) { const [c, r] = st.pop(); const k = H.key(c, r); if (g.city.has(k) || !inMap(g, c, r) || TERRAIN[g.map[r][c]].wall) continue; g.city.add(k); st.push(...H.neighbors(c, r)); }
    sc.units.forEach((d, i) => {
      const gen = GENERALS[d.gen], ty = UNIT_TYPES[d.type];
      g.units.push({
        id: i, gen: d.gen, name: d.label ? (ty.engine ? d.label : gen.name) : gen.name, label: d.label || '', side: d.side, type: d.type,
        troops: d.troops, max: d.troops, c: d.c, r: d.r, face: d.face, form: d.form || null,
        coh: 100, mor: 80, cd: {}, alive: true, dueled: false,
        moved: false, acted: false, attacked: false, mpBonus: 0, ignoreZOC: false, buff: {},
      });
    });
    return g;
  }

  // ---------- 查詢 ----------
  const tAt = (g, c, r) => (r >= 0 && r < g.Hh && c >= 0 && c < g.W ? g.map[r][c] : null);
  const terr = (g, c, r) => TERRAIN[tAt(g, c, r)];
  const unitAt = (g, c, r) => g.units.find(u => u.alive && u.c === c && u.r === r) || null;
  const gen = u => GENERALS[u.gen];
  const ty = u => UNIT_TYPES[u.type];
  const isEngine = u => !!ty(u).engine;
  const has = (u, sk) => gen(u).skills.includes(sk) && !isEngine(u);
  const alive = g => g.units.filter(u => u.alive);
  const enemiesOf = (g, u) => g.units.filter(v => v.alive && v.side !== u.side);
  const friendsOf = (g, u) => g.units.filter(v => v.alive && v.side === u.side && v !== u);
  const onWall = (g, u) => !!(terr(g, u.c, u.r) || {}).wall;
  const inCity = (g, u) => { const t = terr(g, u.c, u.r); return !!(t && (t.wall || g.city.has(H.key(u.c, u.r)))); };
  function state(u) { if (isEngine(u)) return 'full'; return u.coh >= 70 ? 'full' : u.coh >= 40 ? 'shaken' : 'disorder'; }
  const STATE_NAME = { full: '完整', shaken: '動搖', disorder: '混亂' };

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
    let cost = t.cost[mv]; if (!isFinite(cost)) return Infinity;
    const fromT = terr(g, fromC, fromR);
    const inside = fromT.wall || g.city.has(H.key(fromC, fromR));
    if (t.wall) {
      if (isEngine(u)) return Infinity;
      if (u.side === 'def' || inside) return cost;
      if (t.gate) return Infinity;
      if (g.ladders[H.key(c, r)] != null && mv === 0) return 2; // 爬雲梯
      return Infinity;
    }
    return cost;
  }
  function maxMP(g, u) {
    let mp = ty(u).move; const f = formOf(u);
    if (f && f.move) mp += f.move;
    if (state(u) === 'disorder') mp -= 1;
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
    // 不能停在友軍所在的格子
    for (const [k, v] of res) if (k !== start && unitAt(g, v.c, v.r)) v.blocked = true;
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
    if (g.sc.id === 'xiapi') XIAPI.onRoundStart(g);
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
    Object.assign(u, { moved: false, acted: false, attacked: false, mpBonus: 0, ignoreZOC: false, buff: {}, sortie: false, moveLen: 0, from: [u.c, u.r, u.face] });
  }
  const activeUnit = g => (g.active == null ? null : g.units[g.active]);
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
    if (!isEngine(u) && path.length > 1) { if (t.water) u.coh -= 8; else if (t.cover && u.type === 'cav') u.coh -= 4; }
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
    const ranged = !!ta.ranged && !opts.counter;
    const parts = [];
    const atkVal = ranged ? ta.atk : (ta.melee || ta.atk);
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
    if (has(A, 'wushuang')) P('無雙', 1.3);
    if (has(A, 'wusheng')) P('武聖', 1.2);
    if (has(A, 'xianzhen')) P('陷陣', 1.15);
    if (A.buff.feijiang && !opts.counter) P('飛將', 1.4);
    if (opts.weizhen) P('威震', 1.3);
    // 兵種相剋
    if (td.engine) P('打器械', ranged ? 1.2 : 1.5);
    else { const cm = (COUNTER[A.type] || {})[D.type]; if (cm) P(cm > 1 ? '兵種剋制' : '兵種被剋', cm); }
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
    coh *= 1 - gen(D).lead / 200;
    if (has(D, 'xianzhen')) coh *= 0.5;
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
    if (u.troops < u.max * 0.25 && !u.broken && !has(u, 'xianzhen')) { u.broken = true; rout(g, u); return; }
    if (u.coh < 15 || u.mor <= 5) {
      if (has(u, 'xianzhen') || lead >= 70) {
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
  function destroy(g, u, how) {
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
    applyLoss(g, D, res.dmg, { side: res.side, charge: res.charge, joint: res.joint, ranged: res.ranged, extraCoh: (A.buff.feijiang ? 15 : 0) + (opts.weizhen ? 15 : 0) });
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
    log(g, `${A.name}攻擊${D.name}${sideTxt}，殺傷 ${res.dmg}${cres ? `，反擊 ${cres.dmg}` : ''}`, A.side);
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
        if (cd > 0) why = `冷卻中（${cd} 回合）`;
        add({ id: 'skill:' + sk, name: S.name, desc: S.desc, need, targets, enabled: !why, why, skill: true, pre: S.target === 'self' });
      }
      // 單挑
      if (!isEngine(u) && gen(u).war >= 60 && !u.dueled) {
        const ts = adjEnemies(g, u).filter(v => !['caobu', 'gongbing'].includes(v.gen) && !v.dueled).map(v => v.id);
        if (ts.length) add({ id: 'duel', name: '單挑', desc: '向相鄰敵將挑戰（每位武將限一次）。勝者部隊士氣大振，敗者部隊士氣與陣型大亂；實力差太多時對方會避戰。', need: 'enemy', targets: ts });
      }
      // 變換陣型
      if (FORM_ALLOWED[u.type]) add({ id: 'form', name: '變陣', desc: '變換陣型（花掉這次動作；貼著敵軍變陣會讓完整度 −15）。', need: 'form', targets: FORM_ALLOWED[u.type].filter(f => f !== u.form) });
      if (!isEngine(u)) add({ id: 'rally', name: '整隊', desc: `重整隊伍：完整度 +${Math.round(15 + gen(u).lead / 5)}、士氣 +5（被包圍時減半）。`, enabled: u.coh < 100 || u.mor < 100, why: '隊伍已經很整齊' });
      // 守城器具
      if (u.side === 'def' && onWall(g, u)) {
        const adj = H.neighbors(u.c, u.r).map(([c, r]) => unitAt(g, c, r)).filter(v => v && v.side !== u.side && !onWall(g, v) && !inCity(g, v)).map(v => v.id);
        add({ id: 'rocks', name: `滾木礌石（剩 ${g.vars.rocks}）`, desc: '砸城牆底下相鄰的敵軍：兵力 −12%、完整度 −15；對器械效果更大。', need: 'enemy', targets: adj, enabled: g.vars.rocks > 0 && adj.length > 0, why: g.vars.rocks <= 0 ? '用完了' : '城下沒有敵軍' });
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
      if (g.sc.id === 'xiapi') XIAPI.actions(g, u, add);
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
      if (adjEnemies(g, u).length) { u.coh = clamp(u.coh - 15, 0, 100); checkCollapse(g, u); }
      log(g, `${u.name}變陣為${FORMATIONS[target].name}`, u.side); g.fx.push({ t: 'form', id: u.id }); return true;
    }
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
    if (g.sc.id === 'xiapi') return XIAPI.doAction(g, u, id, target);
    return false;
  }
  function useSkill(g, u, sk, target) {
    const S = SKILLS[sk];
    const near = (rad, incSelf) => g.units.filter(v => v.alive && v.side === u.side && (incSelf || v !== u) && H.dist(v.c, v.r, u.c, u.r) <= rad && !isEngine(v));
    if (S.target !== 'self') u.acted = true;
    u.cd[sk] = S.cd;
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
      W.mor = clamp(W.mor + 15, 0, 100); Lz.mor = clamp(Lz.mor - 25, 0, 100); Lz.coh = clamp(Lz.coh - 20, 0, 100);
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
      if (encircled(g, u)) { u.coh -= 8 * (1 - lead / 200); u.mor -= 6; }
      else if (!adjEnemies(g, u).length) { u.coh += 6 + lead / 25; if (!(g.vars.flooded && u.side === 'def' && inCity(g, u))) u.mor += 2; }
      if (g.units.some(v => v.alive && v.side === u.side && v !== u && has(v, 'jianxiong') && H.dist(v.c, v.r, u.c, u.r) <= 2)) { u.mor += 3; u.coh += 4; }
      if (terr(g, u.c, u.r).water) { u.coh -= 8; u.troops = Math.round(u.troops * 0.97); }
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
    if (g.sc.id === 'xiapi') XIAPI.onRoundEnd(g);
    checkVictory(g, true);
  }

  // ---------- 勝負 ----------
  function checkVictory(g, roundEnd) {
    if (g.over) return;
    let r = null;
    if (g.sc.id === 'xiapi') r = XIAPI.victory(g, roundEnd);
    if (r) { g.over = r; g.active = null; g.fx.push({ t: 'over' }); }
  }

  // ---------- 下邳之戰專屬規則 ----------
  const XIAPI = {
    onRoundStart(g) {
      const v = g.vars;
      if (g.round === 1) {
        msg(g, '下邳之戰', '曹操大軍東征，呂布在泗水西岸列陣迎擊。陳宮建議：「將軍若引兵屯於城外，宮守城於內，曹軍攻城則將軍擊其背，攻將軍則宮出兵救之，此掎角之勢也。」');
      }
      if (g.round === v.digUnlock && !v.flooded) {
        v.digOpen = true;
        const xun = g.units.find(u => u.gen === 'xunyou' && u.alive && u.side === 'att');
        msg(g, '荀攸、郭嘉獻策', `${xun ? '荀攸' : '郭嘉'}進言：「呂布勇而無謀，今三戰皆北，其銳氣衰矣。」建議掘開泗水、沂水灌城。\n【可以掘堤了】派步兵或弓兵到城北的「河堤」上執行「掘堤」，累計 ${v.digNeed} 次就能水淹下邳。${xun ? '荀攸親自督工效率加倍。' : ''}`, 'att');
      }
    },
    actions(g, u, add) {
      const v = g.vars;
      if (u.side === 'att' && v.digOpen && !v.flooded && g.map[u.r][u.c] === 'd' && !isEngine(u)) {
        add({ id: 'dig', name: `掘堤（${v.dig}/${v.digNeed}）`, desc: '挖開河堤，挖滿後引泗水、沂水灌城：城外低地變成大水（低地上的攻城器械會被沖毀），城內糧草與士氣每回合下降。' });
      }
    },
    doAction(g, u, id) {
      if (id !== 'dig') return false;
      const v = g.vars; v.dig += u.gen === 'xunyou' ? 2 : 1; u.acted = true;
      log(g, `${u.name}掘堤（${Math.min(v.dig, v.digNeed)}/${v.digNeed}）`, u.side);
      g.fx.push({ t: 'dig', id: u.id });
      if (v.dig >= v.digNeed) XIAPI.flood(g);
      return true;
    },
    flood(g) {
      const v = g.vars; v.flooded = true; v.floodRound = g.round;
      const hexes = [];
      for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'l') { g.map[r][c] = 'w'; hexes.push([c, r]); }
      g.fx.push({ t: 'flood', hexes });
      msg(g, '水淹下邳', '泗水、沂水決堤，大水灌入下邳城下。城外一片汪洋，城內糧草漸絕、人心惶惶。', 'att');
      for (const u of alive(g)) if (g.map[u.r][u.c] === 'w') {
        if (isEngine(u)) { log(g, `${u.name}被大水沖走`, u.side, 'bad'); destroy(g, u, '被大水沖毀'); continue; }
        u.coh = clamp(u.coh - 25, 0, 100); applyLoss(g, u, Math.round(u.troops * 0.08), {});
      }
      for (const k in g.hp) { const [c, r] = H.unkey(k); if (g.hp[k] > 0) damageStruct(g, c, r, 8, null); }
    },
    onRoundEnd(g) {
      const v = g.vars;
      v.supply -= 1;
      // 襲擾糧營
      let depot = null; for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'S') depot = [c, r];
      if (depot) {
        const on = unitAt(g, depot[0], depot[1]);
        if (on && on.side === 'def' && !v.depotBurnt) {
          v.depotBurnt = true; v.supply -= 7; g.map[depot[1]][depot[0]] = '.';
          g.fx.push({ t: 'burn', c: depot[0], r: depot[1] });
          msg(g, '火燒糧營', `${on.name}突入曹軍糧營放火！曹軍糧草 −7。`, 'def');
        } else if (g.units.some(u => u.alive && u.side === 'def' && !isEngine(u) && H.dist(u.c, u.r, depot[0], depot[1]) <= 2)) {
          v.supply -= 1; log(g, '呂布軍襲擾曹軍糧道，糧草 −1', 'def', 'big');
        }
      }
      // 城中糧草
      const cityDef = alive(g).filter(u => u.side === 'def' && inCity(g, u) && !isEngine(u));
      if (cityDef.length) {
        v.food -= v.flooded ? 3 : 1;
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
      msg(g, '侯成、宋憲、魏續倒戈', `${traitors.map(u => u.name).join('、')}${chen ? '綁了陳宮，' : ''}率眾開城投降曹操！西城門已經打開。`, 'att');
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
        if (v.supply <= 0) return end('def', defAlive.some(u => !inCity(g, u)) ? 'jijiao' : 'supply');
      }
      return null;
    },
  };
  function msg(g, title, text, side) { g.log.push({ round: g.round, text: `【${title}】${text}`, side: side || null, kind: 'event' }); g.fx.push({ t: 'msg', title, text, side }); }

  // ---------- 結局文字 ----------
  const ENDINGS = {
    xiapi: {
      history: { title: '白門樓', tag: '尊重歷史', text: '水淹下邳、部將倒戈，呂布在白門樓被圍投降。一如史書所載：曹操縊殺呂布，陳宮、高順從容就死，張遼歸降曹操。' },
      storm: { title: '強攻破城', tag: '異於史實', text: '曹軍不靠水攻與內應，以器械與猛攻正面攻陷下邳。呂布被擒，曹操一統徐州的時間比歷史更早。' },
      field: { title: '野戰擒呂布', tag: '逆轉歷史', text: '曹軍在泗水西岸的野戰中就擊潰了呂布本陣，下邳不戰而降。天下第一猛將的傳說，在城外就畫下句點。' },
      supply: { title: '曹軍糧盡退兵', tag: '逆轉歷史', text: '下邳城堅守到底，曹軍糧草耗盡，只得撤回許都。呂布保住徐州，天下局勢從此大不相同。' },
      jijiao: { title: '掎角之計奏效', tag: '逆轉歷史', text: '呂布終於採納陳宮的掎角之計：城外騎兵襲擾糧道，城內堅守不出，曹軍進退兩難，只好糧盡退兵。' },
      caodown: { title: '曹操兵敗下邳', tag: '逆轉歷史', text: '曹操本陣被呂布軍擊潰，曹軍大亂退走。少了曹操的中原，歷史將走向完全不同的方向。' },
      rout: { title: '曹軍全面潰敗', tag: '逆轉歷史', text: '曹軍各部相繼潰散，東征以慘敗收場。' },
    },
  };

  // ---------- 匯出 ----------
  root.RULES = {
    newGame, startRound, nextActivation, endActivation, activeUnit, upcoming,
    reachable, pathTo, moveUnit, undoMove, setFacing, maxMP,
    attackTargets, structTargets, attack, calcDamage, canCounter, actionsFor, doAction,
    unitAt, terr, tAt, state, STATE_NAME, formOf, encircled, adjEnemies, sideHit, inCity, onWall, isEngine, gen, ty, has, alive, enemiesOf, friendsOf,
    rangeOf, canMeleeReach, ENDINGS, other, clamp, inZOC, moveCost,
  };
})(typeof window !== 'undefined' ? window : globalThis);
