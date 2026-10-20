// ===== 電腦 AI =====
// 每支部隊輪到時：列出所有可到達的位置 × 可做的動作，用「預估戰果 − 風險 + 往目標前進」打分，挑最高的執行，最後朝向威脅最大的方向。
(function (root) {
  const R = root.RULES, H = root.HEX, D = root.DATA;

  const PAL = [18, 9], GATE_W = [15, 9];

  function mean(g, A, T, extra) { return R.calcDamage(g, A, T, Object.assign({ mean: true }, extra || {})); }
  const val = (g, u) => (R.isEngine(u) ? 1.2 : 1) * (u.gen === g.sc.sides.att.leader || u.gen === g.sc.sides.def.leader ? (g.sc.id === 'hefei' && u.gen === 'sunquan' ? 1.8 : 1.4) : 1);

  // ---- 目標位置（依劇本與戰況） ----
  function goalOf(g, u) { return g.sc.id === 'hefei' ? hefeiGoal(g, u) : xiapiGoal(g, u); }
  // 合肥：吳軍先圍城（衝車撞南門、雲梯架南牆），撤軍時往東過逍遙津橋；魏軍張遼、李典天亮突擊孫權，累了就從南門回城，吳軍撤退時追擊孫權
  function hefeiGoal(g, u) {
    const v = g.vars, breach = findBreach(g), pal = findCh(g, 'P') || [11, 4];
    const sun = g.units.find(x => x.gen === 'sunquan');
    if (u.side === 'att') {
      if (v.retreating) return u.gen === 'lingtong' && sun.alive && sun.c < 19 ? [18, 10] : [22, 10];
      if (u.type === 'ram') return [11, 8];
      if (u.type === 'ladder') return u.label.includes('甲') ? [9, 8] : [13, 8];
      if (breach) return pal;
      const field = R.alive(g).filter(x => x.side === 'def' && !R.inCity(g, x) && !R.onWall(g, x) && !R.isEngine(x));
      if (field.length && u.gen !== 'sunquan') return nearest(u, field);
      if (u.gen === 'sunquan') return [12, 12];
      if (u.type === 'arc') return [10 + (u.id % 2) * 2, 9];
      return [[9, 8], [13, 8], [10, 8], [12, 8]][u.id % 4];
    }
    if (breach) {
      const intruders = R.alive(g).filter(x => x.side === 'att' && R.inCity(g, x));
      if (intruders.length) return nearest(u, intruders);
      if (!R.onWall(g, u) || u.type !== 'arc') return breach;
    }
    if (R.onWall(g, u) && u.type === 'arc') return [u.c, u.r];
    if (u.gen === 'yuejin') return [11, 6];   // 樂將軍守護軍，勿得與戰
    if (v.retreating && sun.alive) { u.retreating = false; return sun.c < 19 && u.type === 'cav' ? [19, 10] : [sun.c, sun.r]; }   // 追擊：騎兵搶佔逍遙津橋，其餘直撲孫權
    const out = !R.inCity(g, u) && !R.onWall(g, u);
    const tired = u.troops < u.max * 0.65 || u.coh < 45 || u.retreating;
    if (g.round <= 2 && !tired && sun.alive) return [sun.c, sun.r];   // 晨襲只打前兩回合，見好就收
    if (out) { u.retreating = true; return [11, 5]; }
    return [11, 6];
  }
  function findCh(g, ch) { for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === ch) return [c, r]; return null; }
  function xiapiGoal(g, u) {
    const v = g.vars;
    const defField = R.alive(g).filter(x => x.side === 'def' && !R.inCity(g, x) && !R.isEngine(x));
    const breach = findBreach(g);
    if (u.side === 'att') {
      if (u.type === 'ram') return [14, 9];
      if (u.type === 'cata') return [12, 8];
      if (u.type === 'ladder') return v.digOpen && !v.flooded ? [12, u.label.includes('甲') ? 7 : 11] : (u.label.includes('甲') ? [14, 7] : [14, 11]);
      if (u.type === 'tower') return v.digOpen && !v.flooded ? [12, 10] : [14, 8];
      if (v.digOpen && !v.flooded && g.aiDigger === u.id) return digHex(g, u);
      if (breach) return PAL;
      const westField = defField.filter(x => x.c <= 11);
      if (westField.length) return nearest(u, westField);
      if (defField.length) return nearest(u, defField);
      if (u.type === 'arc') return [13, u.id % 2 ? 7 : 11];
      return [12 + (u.id % 2), 6 + (u.id * 3) % 7];
    }
    // 守方
    if (breach) {
      const intruders = R.alive(g).filter(x => x.side === 'att' && R.inCity(g, x));
      if (intruders.length) return nearest(u, intruders);
      if (!R.onWall(g, u) || u.type !== 'arc') return breach;
    }
    if (R.onWall(g, u) && u.type === 'arc') return [u.c, u.r];
    const digging = R.alive(g).find(x => x.side === 'att' && !R.isEngine(x) && H.neighbors(x.c, x.r).some(([nc, nr]) => g.map[nr] && g.map[nr][nc] === 'd'));
    if (digging && !R.inCity(g, u) && u.type === 'cav') return [digging.c, digging.r];
    const retreat = g.round >= 3 || u.troops < u.max * 0.75 || adjCount(g, u, u.c, u.r) >= 2 || u.retreating;
    if (!R.inCity(g, u) && retreat) { u.retreating = true; return u.gen === 'lubu' ? PAL : [17, 8 + (u.id % 3)]; }
    if (!R.inCity(g, u)) return [9, 7 + (u.id % 3) * 2];
    if (u.gen === 'houcheng' || u.type === 'inf') return [16, 9];
    return [u.c, u.r];
  }
  function findBreach(g) {
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) if (g.map[r][c] === 'o' || g.map[r][c] === 'r') return [c, r];
    return null;
  }
  // 河堤上不能站人：掘堤手要走到堤旁（緊鄰堤格的平地），優先進度最高的那一段
  function digHex(g, u) {
    const seg = g.vars.digSeg || {}, cand = [];
    for (let r = 0; r < g.Hh; r++) for (let c = 0; c < g.W; c++) {
      const ch = g.map[r][c]; if (ch === '~' || ch === 'd' || ch === 'W' || ch === 'T' || ch === 'G') continue;
      const ds = H.neighbors(c, r).filter(([nc, nr]) => g.map[nr] && g.map[nr][nc] === 'd' && H.center(c, r)[0] > H.center(nc, nr)[0] + 0.5); if (!ds.length) continue;
      const o = R.unitAt(g, c, r); if (o && o !== u) continue;
      cand.push({ c, r, prog: Math.max(...ds.map(([nc, nr]) => seg[nc + ',' + nr] || 0)) });
    }
    cand.sort((a, b) => (b.prog - a.prog) * 3 + (H.dist(u.c, u.r, a.c, a.r) - H.dist(u.c, u.r, b.c, b.r)));
    return cand.length ? [cand[0].c, cand[0].r] : [13, 2];
  }
  function nearest(u, list) { let b = null, bd = 1e9; for (const x of list) { const d = H.dist(u.c, u.r, x.c, x.r); if (d < bd) { bd = d; b = x; } } return [b.c, b.r]; }

  // ---- 路程距離場：從目標往外算「實際走路要花幾點移動力」（考慮河流、城牆，忽略部隊） ----
  function field(g, u, goal) {
    const sig = g.map.map(r => r.join('')).join('') + '|' + goal + '|' + u.type + '|' + u.side;
    g._fields = g._fields || new Map();
    if (g._fields.has(sig)) return g._fields.get(sig);
    if (g._fields.size > 200) g._fields.clear();
    const dist = new Map(); const k0 = H.key(goal[0], goal[1]); dist.set(k0, 0);
    const open = [[0, goal[0], goal[1]]];
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [d, c, r] = open.splice(bi, 1)[0];
      if (dist.get(H.key(c, r)) < d) continue;
      for (const [nc, nr] of H.neighbors(c, r)) {
        if (nr < 0 || nr >= g.Hh || nc < 0 || nc >= g.W) continue;
        let mc = R.moveCost ? R.moveCost(g, u, c, r, nc, nr) : 1;
        if (!isFinite(mc)) continue;
        const nd = d + mc, nk = H.key(nc, nr);
        if (dist.has(nk) && dist.get(nk) <= nd) continue;
        dist.set(nk, nd); open.push([nd, nc, nr]);
      }
    }
    g._fields.set(sig, dist); return dist;
  }
  function goalDist(g, u, F, c, r, goal) { const d = F.get(H.key(c, r)); return d != null ? d : H.dist(c, r, goal[0], goal[1]) * 3 + 20; }

  // ---- 危險度：下回合敵軍可能造成的損失（以兵力計） ----
  function danger(g, u, c, r) {
    let s = 0, n = 0;
    for (const e of R.enemiesOf(g, u)) {
      const t = R.ty(e); if (t.atk <= 0 || e.type === 'ram' || e.type === 'ladder') continue;
      const rng = R.rangeOf(g, e), reach = (t.engine ? 0 : R.maxMP(g, e)) + rng;
      const d = H.dist(e.c, e.r, c, r); if (d > reach) continue;
      n++;
      s += (R.state(e) === 'disorder' ? 0.6 : 1) * (0.6 + 0.4 * e.mor / 100) * e.troops / 1000 * 45 * t.atk / 10 * (0.8 + R.gen(e).war / 250) * (d <= rng ? 1.15 : 1) * (t.charge && d > 2 ? 1.2 : 1);
    }
    if (!n) return 0;
    const tt = R.terr(g, c, r);
    const prof = (R.formOf(u) || { def: D.BASE_DEF }).def;
    const friends = H.neighbors(c, r).filter(([cc, rr]) => { const v = R.unitAt(g, cc, rr); return v && v !== u && v.side === u.side && !R.isEngine(v); }).length;
    const expo = R.isEngine(u) ? 1.3 : friends >= 2 ? prof[0] * 1.05 : friends === 1 ? (prof[0] + prof[1]) / 2 : (prof[0] + prof[1] + prof[2] + prof[3]) / 4;
    s *= expo * (1 + 0.12 * (n - 1)) * 10 / (R.ty(u).def + 2);
    if (tt.wall) s *= 0.45;
    if (tt.water) s *= 1.2;
    return s;
  }
  // 敵軍貼身數（包圍風險）
  function adjCount(g, u, c, r) { return H.neighbors(c, r).filter(([cc, rr]) => { const v = R.unitAt(g, cc, rr); return v && v.side !== u.side && !R.isEngine(v); }).length; }

  // ---- 最佳朝向：讓最可能的攻擊落在正面 ----
  function bestFacing(g, u) {
    const prof = (R.formOf(u) || { def: D.BASE_DEF }).def;
    let best = u.face, bs = Infinity;
    for (let d = 0; d < 6; d++) {
      let s = 0;
      for (const e of R.enemiesOf(g, u)) {
        if (R.isEngine(e) && e.type !== 'tower') continue;
        const dist = H.dist(u.c, u.r, e.c, e.r); if (dist > 9) continue;
        const dd = H.dirDiff(d, H.dirTo(u.c, u.r, e.c, e.r));
        s += e.troops / (dist * dist) * prof[dd];
      }
      if (s < bs - 1e-6) { bs = s; best = d; }
    }
    return best;
  }

  // ---- 這格能做的最佳動作 ----
  function bestAction(g, u) {
    const opts = []; // {score, kind, ...}
    const atk = R.attackTargets(g, u);
    const weiz = R.actionsFor(g, u).find(a => a.id === 'skill:weizhen' && a.enabled);
    for (const T of atk) {
      const r1 = mean(g, u, T);
      let s = r1.dmg * val(g, T) * (1 + (r1.side >= 2 ? 0.35 : 0) + (r1.joint ? 0.1 * r1.joint : 0));
      if (r1.dmg >= T.troops) s += R.isEngine(T) ? 150 : 400;
      if (!R.isEngine(T) && T.coh < 45) s *= 1.25;
      if (R.canCounter(g, u, T, r1.ranged)) { const c = R.calcDamage(g, T, u, { mean: true, counter: true }); s -= c.dmg * val(g, u) * 0.9; }
      opts.push({ score: s, kind: 'attack', t: T.id });
      if (weiz && weiz.targets.includes(T.id)) opts.push({ score: s * 1.35 + 40, kind: 'act', id: 'skill:weizhen', t: T.id });
    }
    for (const a of R.actionsFor(g, u)) {
      if (!a.enabled || a.pre) continue;
      if (a.id === 'struct') for (const tg of a.targets) {
        const t = R.terr(g, tg.c, tg.r); const hp = g.hp[tg.k];
        opts.push({ score: (t.gate ? 260 : 150) * (u.type === 'inf' ? 0.3 : 1) + (100 - hp) * 2, kind: 'act', id: 'struct', t: tg.k });
      }
      if (a.id === 'ladder') for (const tg of a.targets) opts.push({ score: R.unitAt(g, tg.c, tg.r) ? 180 : 220, kind: 'act', id: 'ladder', t: tg.k });
      if (a.id === 'dig') for (const t of a.targets) opts.push({ score: 600 + ((g.vars.digSeg || {})[t.k] || 0) * 30, kind: 'act', id: 'dig', t: t.k });
      if (a.id === 'mend') for (const t of a.targets) opts.push({ score: 420 + (g.vars.digSeg[t.k] || 0) * 40, kind: 'act', id: 'mend', t: t.k });
      if (a.id === 'rocks' || a.id === 'oil') for (const id of a.targets) { const T = g.units[id]; opts.push({ score: T.troops * (R.isEngine(T) ? 0.6 : 0.12) * val(g, T) * (T.type === 'ladder' ? 2 : 1), kind: 'act', id: a.id, t: id }); }
      if (a.id === 'skill:huoji') for (const id of a.targets) { const T = g.units[id]; opts.push({ score: T.troops * (R.isEngine(T) ? 0.24 : 0.08) * val(g, T) + 40, kind: 'act', id: a.id, t: id }); }
      if (a.id === 'skill:lijian') for (const id of a.targets) { const T = g.units[id]; const low = (R.gen(T).loyal || 100) < 50; opts.push({ score: (low && R.inCity(g, T) ? 260 : 60) + (100 - T.mor), kind: 'act', id: a.id, t: id }); }
      if (a.id === 'skill:jili' || a.id === 'skill:rende') {
        const rad = a.id === 'skill:jili' ? 3 : 1;
        const need = R.alive(g).filter(v => v.side === u.side && !R.isEngine(v) && H.dist(v.c, v.r, u.c, u.r) <= rad).reduce((s, v) => s + Math.max(0, 85 - v.mor) + Math.max(0, 80 - v.coh), 0);
        opts.push({ score: need * 1.2, kind: 'act', id: a.id });
      }
      if (a.id === 'duel') for (const id of a.targets) { const T = g.units[id]; const diff = R.gen(u).war - R.gen(T).war; if (diff >= 8) opts.push({ score: 120 + diff * 6, kind: 'act', id: 'duel', t: id }); }
      if (a.id === 'shoot') for (const id of a.targets) { const T = g.units[id], r1 = mean(g, u, T, { shoot: true }); opts.push({ score: r1.dmg * val(g, T) * (r1.dmg >= T.troops ? 3 : 1) * 0.5, kind: 'act', id: 'shoot', t: id }); }   // 射箭只是補刀：分數打折，免得為了射箭衝進敵陣
      if (a.id === 'douse') for (const t of a.targets) opts.push({ score: 330, kind: 'act', id: 'douse', t: t.k });
      if (a.id === 'burn') for (const t of a.targets) opts.push({ score: 260 + (u.type === 'arc' || t.dist <= 1 ? 140 : 40), kind: 'act', id: 'burn', t: t.k });   // 放火燒糧營：值錢，但別為了它送死
      if (a.id === 'merge') for (const id of a.targets) {
        const T = g.units[id], lead = g.sc.sides[u.side].leader, weak = x => x.troops <= x.max * 0.35;
        const saveLeader = (T.gen === lead && weak(T)) || (u.gen === lead && weak(u));
        const trapped = R.encircled(g, T) || R.adjEnemies(g, T).length >= 2;
        if (saveLeader || trapped) opts.push({ score: saveLeader ? 900 : 160, kind: 'act', id: 'merge', t: id });   // 只在救主帥或救被圍的殘部時合流
      }
      if (a.id === 'rally' && u.coh < 55) opts.push({ score: (65 - u.coh) * 4 + (R.encircled(g, u) ? 0 : 20), kind: 'act', id: 'rally' });
      if (a.id === 'form') {
        const want = wantForm(g, u);
        if (want && want !== u.form && a.targets.includes(want)) opts.push({ score: want === 'fangyuan' ? 140 : 45, kind: 'act', id: 'form', t: want });
      }
    }
    opts.sort((a, b) => b.score - a.score);
    return opts[0] || null;
  }
  function wantForm(g, u) {
    if (R.isEngine(u)) return null;
    const adj = adjCount(g, u, u.c, u.r);
    const nearE = R.enemiesOf(g, u).filter(e => !R.isEngine(e)).reduce((m, e) => Math.min(m, H.dist(u.c, u.r, e.c, e.r)), 99);
    if (R.encircled(g, u) || adj >= 2) return 'fangyuan';
    if (u.type === 'arc') return 'yanxing';
    // 長蛇陣只在離敵很遠時用（有緩衝，避免來回變陣）
    if (u.form === 'changshe' && nearE > 7) return 'changshe';
    if (nearE > 12 && !R.inCity(g, u)) return 'changshe';
    if (u.form === 'fangyuan' && adj >= 1) return 'fangyuan';
    return u.type === 'cav' ? 'fengshi' : 'yulin';
  }
  // ---- 一支部隊的完整行動 ----
  function act(g, u) {
    if (g.over || !u.alive) return;
    if (g.aiDigger != null && !g.units[g.aiDigger].alive) g.aiDigger = null;
    if (u.side === 'att' && g.vars.digOpen && !g.vars.flooded && g.aiDigger == null) pickDigger(g);
    // 移動前技能（飛將、突襲）
    for (const sk of ['feijiang', 'tuxi']) {
      const a = R.actionsFor(g, u).find(x => x.id === 'skill:' + sk && x.enabled);
      if (a && u.coh >= 50) {
        const reach = R.maxMP(g, u) + (sk === 'feijiang' ? 2 : 3) + 1;
        const tgt = R.enemiesOf(g, u).some(e => H.dist(e.c, e.r, u.c, u.r) <= reach && H.dist(e.c, e.r, u.c, u.r) > 1 && (e.coh < 60 || R.isEngine(e) || g.rnd() < 0.5) && !R.inCity(g, e));
        const breakOut = u.retreating && adjCount(g, u, u.c, u.r) > 0;
        if ((tgt && !u.retreating) || breakOut) R.doAction(g, u, 'skill:' + sk);
      }
    }
    const goal = goalOf(g, u);
    const reach = R.reachable(g, u);
    const home = [u.c, u.r, u.moveLen];
    const aggr = u.side === 'def' && u.retreating && !R.has(u, 'wushuang') ? 0.5 : 1;
    const assault = u.side === 'att' && (g.vars.flooded || findBreach(g) || !R.alive(g).some(x => x.side === 'def' && !R.inCity(g, x) && !R.isEngine(x)));
    const dW = u.side === 'def' ? (R.isEngine(u) ? 0.9 : 0.75) : assault ? (R.isEngine(u) ? 0.3 : 0.25) : (R.isEngine(u) ? 0.9 : 0.55);
    const avoidLow = g.vars.digOpen && !g.vars.flooded && u.side === 'att';
    let best = null;
    const F = field(g, u, goal);
    const gd0 = goalDist(g, u, F, u.c, u.r, goal);
    const gW = assault ? 45 : 22;
    for (const [k, v] of reach) {
      if (v.blocked) continue;
      u.c = v.c; u.r = v.r; u.moveLen = v.cost ? R.pathTo(reach, k).length - 1 : 0;
      const ba = bestAction(g, u);
      const gd = goalDist(g, u, F, v.c, v.r, goal);
      let s = (ba ? ba.score * aggr : 0) - gd * gW + (gd < gd0 ? 10 : 0);
      if (u.side === 'att' && !R.isEngine(u) && g.map[v.r][v.c] === 'P') s += 1500;
      s -= danger(g, u, v.c, v.r) * dW;
      const adj = adjCount(g, u, v.c, v.r);
      if (adj >= 2 && !R.terr(g, v.c, v.r).wall) s -= (adj - 1) * 60 * (u.form === 'fangyuan' ? 0.5 : 1);
      if (avoidLow && g.map[v.r][v.c] === 'l') s -= R.isEngine(u) ? 400 : 120 * (g.vars.dig / g.vars.digNeed + 0.2);
      if (u.side === 'def' && u.retreating && !R.inCity(g, u)) s -= 30;
      if (!best || s > best.s) best = { s, k, v, ba };
    }
    u.c = home[0]; u.r = home[1]; u.moveLen = home[2];
    if (best && best.k !== H.key(u.c, u.r)) R.moveUnit(g, u, best.v.c, best.v.r);
    if (g.over || !u.alive) return;
    // 移動後重新評估（位置確定）
    const ba = bestAction(g, u);
    if (ba && ba.score > 8) {
      if (ba.kind === 'attack') R.attack(g, u, g.units[ba.t]);
      else R.doAction(g, u, ba.id, ba.t);
    }
    if (u.alive && !u.attacked) R.setFacing(g, u, bestFacing(g, u));
  }
  function pickDigger(g) {
    const cands = R.alive(g).filter(x => x.side === 'att' && !R.isEngine(x) && x.gen !== 'caocao');
    const xun = cands.find(x => x.gen === 'xunyou');
    const pick = xun || cands.sort((a, b) => H.dist(a.c, a.r, 13, 2) - H.dist(b.c, b.r, 13, 2))[0];
    if (pick) g.aiDigger = pick.id;
  }

  root.AI = { act, bestFacing, goalOf };
})(typeof window !== 'undefined' ? window : globalThis);
