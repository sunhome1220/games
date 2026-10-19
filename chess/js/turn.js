// ----- 回合流程 -----
// 防空：side 方能攔截落點 (x,y) 的相（冷卻完畢、落點在攔截範圍內），取最近的一隻
function interceptorFor(side, x, y) {
  return alive().filter(e => e.s === side && e.T.aa && !e.cd && Math.hypot(e.x - x, e.y - y) <= e.T.aa + 1)
                .sort((u, v) => Math.hypot(u.x - x, u.y - y) - Math.hypot(v.x - x, v.y - y))[0] || null;
}
const flies = T => T.proj === 'rocket' || T.proj === 'shell';   // 會被防空攔截的武器
const reloadMsg = p => p.T.aa ? `${p.T.n[p.s]}防空冷卻中，對方接下來 ${p.cd} 次攻擊攔截不了。` : `${p.T.n[p.s]}${p.T.w}裝填中，還要 ${p.cd} 回合${p.T.alt ? '，期間改用步槍' : '才能再射擊'}。`
function setSkip(on) {
  $('skip').disabled = !on;
  $('skip').textContent = state === 'target' && moved ? (targets.some(t => t.ok) ? '不射擊' : '結束回合') : '取消';
  $('undo').hidden = !(state === 'target' && moved && origin);
  $('fire').hidden = !(state === 'select' && sel && sel.dest);
}
function onStop() {
  promoteCrossed();
  if (online() && !myTurn()) { if (pendingEnd) applyEnd(); else state = 'wait'; return; }
  if (mover.hp <= 0) { state = 'fire'; timer = 0.6; return; }
  targets = scan(mover);
  const manual = !(mode === 'ai' && turn === aiSide());
  if (targets.some(t => t.ok)) {
    state = 'target'; setSkip(true);
    setMsg(`圓圈是${mover.T.n[mover.s]}的攻擊範圍，點黃色準星的敵人開火（準星旁為預估傷害）；` +
           (moved ? '不滿意可按「取消移動」換別的棋，或按「不射擊」結束回合。' : '或按「取消」／點其他己方棋子改操作。'));
  } else if (moved && manual && !quick) {   // 沒有目標也停下來：看過攻擊範圍後可取消移動
    state = 'target'; setSkip(true);
    setMsg(`圓圈是${mover.T.n[mover.s]}的攻擊範圍，` + (mover.T.aa && !targets.length ? '範圍內沒有敵人，藍圈內的火箭和砲彈會被攔截。' : mover.T.guard ? '範圍內沒有敵人；帥被直射時仕會走到射線上擋子彈。' : mover.cd > 0 && targets.length ? reloadMsg(mover) + '' : '範圍內沒有可攻擊的敵人。') + '可按「取消移動」換別的棋，或按「結束回合」。');
  } else if (!moved) {   // 原地選取但沒東西可打：不浪費回合，回到選棋
    const p = mover;
    cancelSelect((p.T.aa ? `${p.T.n[p.s]}射程內沒有敵人（相鄰或田字對角點），負責攔截飛來的火箭和砲彈。` : p.T.guard ? `${p.T.n[p.s]}近距離（相鄰與斜角）沒有敵人；帥被直射時會走到射線上擋子彈。` : p.cd > 0 && targets.length ? reloadMsg(p) : '射程內沒有可攻擊的敵人，') + '請選擇移動位置或換別的棋子。');
  } else {
    state = 'fire'; timer = 0.9;
    setMsg(mover.T.aa && !targets.length ? `${mover.T.n[mover.s]}就定位，藍圈內的火箭和砲彈會被攔截。` : mover.T.guard ? `${mover.T.n[mover.s]}就定位，近距離沒有敵人。` : mover.cd > 0 && targets.length ? reloadMsg(mover)
           : targets.length ? '射程內的敵人都被擋住或太近，無法開火。' : '射程內沒有敵人。');
  }
}
// 移動後反悔：棋子退回出發點（含升官、空投），回到選棋；連線時通知對方同步
function applyUndo(o) {
  const p = o.p;
  fx = fx.filter(f => f.k !== 'drop' && !(f.k === 'txt' && String(f.txt).includes('空投'))); p.drop = 0;
  Object.assign(p, { x: o.x, y: o.y, hd: o.hd, T: o.T, hp: o.hp, vx: 0, vy: 0 });
}
function undoMove() {
  const o = origin;
  if (state !== 'target' || !moved || !o) return false;
  applyUndo(o);
  send({ t: 'undo', i: pieces.indexOf(o.p), x: o.x, y: o.y, hd: o.hd, pr: o.T.id === 'P2' ? 1 : 0, hp: o.hp });
  moved = false; mover = null; origin = null; targets = []; sel = null; state = 'aim'; setSkip(false);
  SFX.play('click');
  return true;
}
// 取消原地選取，回到選棋
function cancelSelect(msg = '已取消，請重新選擇棋子。') {
  state = 'aim'; mover = null; targets = []; setSkip(false); setMsg(msg);
}
// 帥被直射（非炮、非飛彈）時：仕的某個合法落點剛好落在射線上，就自動走過去擋；沒有這種落點就擋不了
function guardBlock(k, from, T) {
  if (k.t !== 'K' || flies(T)) return null;
  const dx = k.x - from.x, dy = k.y - from.y, d2 = dx * dx + dy * dy || 1;
  let best = null;
  for (const g of alive()) {
    if (g.s !== k.s || !g.T.guard) continue;
    for (const [x, y] of movesFor(g)) {
      const t = ((x - from.x) * dx + (y - from.y) * dy) / d2;
      if (t <= 0 || t >= 1) continue;
      const off = Math.hypot(x - (from.x + t * dx), y - (from.y + t * dy));
      if (off < R * 0.9 && (!best || off < best.off)) best = { g, x, y, off };
    }
  }
  return best;
}
// 仕走到擋子彈的位置（永久換位）；ox/oy 為畫面上的滑動位移，實際座標立刻更新
function slideGuard(bl) {
  const g = bl.g, ox = g.x - bl.x, oy = g.y - bl.y;
  g.sl = { ox, oy, k: 0 }; g.ox = ox; g.oy = oy; g.x = bl.x; g.y = bl.y;
  fx.push({ k: 'txt', x: g.x, y: g.y - R - 6, txt: '護駕！', t: 1, T: 1, col: '#2f6fb5', side: g.s });
  SFX.play('click');
}
const visX = p => p.x + (p.ox || 0), visY = p => p.y + (p.oy || 0);   // 畫面上的位置（含衝出位移）
// 開火：車頭轉向目標、槍口火光、彈體飛行，命中時才扣血（impact）
function shoot(a, b) {
  const W = weaponFor(a, b); a.fireT = W !== a.T ? W : null;   // 近戰／冷卻中改用步槍
  const bl = guardBlock(b, a, a.fireT || a.T);
  if (bl) {   // 仕走到射線上擋：單發武器改打仕；霰彈則由彈丸自然打到擋在前面的仕
    slideGuard(bl);
    setMsg(`${bl.g.T.n[bl.g.s]}走到射線上替${b.T.n[b.s]}擋子彈！`);
    if ((a.fireT || a.T).proj !== 'pellets') return shootAt(a, bl.g, bl.g.x, bl.g.y, b);
  }
  return shootAt(a, b, b.x, b.y, b);
}
function shootAt(a, b, tx, ty, aim) {
  const T = a.fireT || a.T, dir = Math.atan2(ty - a.y, tx - a.x);
  const mx = a.x + Math.cos(dir) * (R + 8), my = a.y + Math.sin(dir) * (R + 8);
  a.hd = dir; a.recoil = 1; a.aimA = dir; a.aimT = AIM_T;   // 武器轉向攻擊方向
  if (T.reload && !T.aa) { a.cd = T.reload; firedPiece = a; }
  SFX.play(T.snd);
  if (b === aim) setMsg(`${T.n[a.s]} 用${T.w}攻擊 ${b.T.n[b.s]}！`);
  const base = { x1: mx, y1: my, x2: tx, y2: ty, dir, side: a.s }, nt = b !== aim ? '（替帥擋下）' : '';
  if (T.proj === 'burst') {            // 機槍：四發連射，最後一發結算傷害
    for (let i = 0; i < 4; i++)
      fx.push({ ...base, k: 'bullet', x2: tx + rnd(7), y2: ty + rnd(7), t: 0.12, T: 0.12, delay: i * 0.07 + 0.001,
                start: () => { muzzle(mx, my, dir, false); a.recoil = 1; },
                done: i === 3 ? () => impact(a, b, undefined, nt) : () => emit(tx, ty, 4, { k: 'spark', sp: 160, life: 0.2, size: 2, col: '#ffe066' }) });
  } else if (T.proj === 'bullet') {
    muzzle(mx, my, dir, false);
    fx.push({ ...base, k: 'bullet', t: 0.12, T: 0.12, done: () => impact(a, b, undefined, nt) });
  } else if (T.proj === 'rocket') {
    muzzle(mx, my, dir, true);
    fx.push(intercept(a, b, aim, { ...base, k: 'rocket', t: 0.45, T: 0.45, done: () => impact(a, b) }));
  } else if (T.proj === 'pellets') {   // 霰彈：扇形彈丸同時飛出
    muzzle(mx, my, dir, true); shake = Math.max(shake, 3);
    const { rays, count } = shotgunSim(a, aim, a.x, a.y, T);
    fx.push({ k: 'pellets', x1: a.x, y1: a.y, rays, side: a.s, dir, t: 0.14, T: 0.14, done: () => {
      for (const r of rays) emit(r.x, r.y, 2, { k: 'spark', sp: 120, life: 0.18, size: 2, col: '#ffe066' });
      if (!count.size) { setMsg('霰彈全被擋下，沒有打中敵人。'); timer = Math.max(timer, 0.6); }
      const msgs = [];
      for (const [p, n] of count) msgs.push(impact(a, p, pelletDmg(n, T), `（中 ${n} 發）`));
      if (msgs.length) setMsg(`${T.n[a.s]} 霰彈槍：` + msgs.join('；'));
    } });
  } else {                             // 曲射砲：拋物線飛行
    muzzle(mx, my, dir, true);
    fx.push(intercept(a, b, aim, { ...base, k: 'shell', t: 0.8, T: 0.8, h: Math.hypot(tx - a.x, ty - a.y) * 0.45, done: () => impact(a, b) }));
  }
}
// 防空攔截：落點附近有對方冷卻完畢的相，就發射攔截飛彈，在空中把火箭／砲彈打爆（沒有傷害）
const AIM_T = 1.1;   // 武器朝向攻擊方向的持續秒數
const STOP_AT = 0.65;   // 飛到 65% 時被攔下
function intercept(a, b, aim, f) {
  const e = interceptorFor(1 - a.s, aim.x, aim.y);   // 以原本瞄準的目標判定範圍（士衝出來擋時仍算帥的位置）
  if (!e) return f;
  const [ix, iy] = projPos({ ...f, t: f.T * (1 - STOP_AT) }), flight = f.T * STOP_AT;
  e.cd = e.T.reload; e.cdFresh = true; e.lock = { t: 0.9, a: Math.atan2(iy - e.y, ix - e.x) };   // 雷達鎖定目標
  const dir = Math.atan2(iy - e.y, ix - e.x);   // 防空砲：一串曳光彈快速射向落點（不是飛彈）
  for (let i = 0; i < 7; i++) {
    const j = i ? rnd(5) : 0, px = -Math.sin(dir) * j, py = Math.cos(dir) * j;
    fx.push({ k: 'tracer', x1: e.x + Math.cos(dir) * (R + 6), y1: e.y + Math.sin(dir) * (R + 6), x2: ix + px, y2: iy + py, dir, side: e.s,
              t: flight * 0.4, T: flight * 0.4, delay: flight * 0.3 + i * 0.045 + 0.001,
              start: () => { if (i === 0) SFX.play('aa'); muzzle(e.x, e.y, dir, false); e.recoil = 1; e.aimA = dir; e.aimT = AIM_T; } });
  }
  f.stopAt = STOP_AT;
  f.done = () => {   // 空中爆炸
    flashAt(ix, iy, 30, 0.12);   // 高射砲的空爆：黑色煙團＋橘色火球＋四散破片
    emit(ix, iy, 7, { k: 'smoke', sp: 55, life: 1.2, size: 13, col: '#2e2e2e' });
    emit(ix, iy, 5, { k: 'fire', sp: 60, life: 0.25, size: 9, col: '#ff9a2e' });
    emit(ix, iy, 16, { k: 'spark', sp: 300, life: 0.35, size: 1.6, col: '#ffe9a0' });
    SFX.play('boom', false); shake = Math.max(shake, 4);
    fx.push({ k: 'txt', x: ix, y: iy - 10, txt: '攔截！', t: 1.2, T: 1.2, col: '#2f6fb5', side: e.s });
    setMsg(`${e.T.n[e.s]}攔截了${a.T.n[a.s]}的${a.T.proj === 'rocket' ? '火箭' : '砲彈'}！（${e.T.n[e.s]}冷卻中：對方接下來 ${e.T.reload} 次攻擊攔截不了）`);
    timer = Math.max(timer, 0.9);
  };
  return f;
}
function impact(a, b, dmg = (a.fireT || a.T).dmg, note = '') {
  const T = a.fireT || a.T, heavy = T.proj === 'rocket' || T.proj === 'shell';
  const bx = visX(b), by = visY(b);
  b.hp = Math.max(0, b.hp - dmg); b.flash = 0.35;
  fx.push({ k: 'txt', x: bx, y: by - R, txt: '-' + hearts(dmg), t: 1, T: 1, side: b.s });
  if (b.hp <= 0) { explode(bx, by, true); SFX.play('boom', true); }
  else if (heavy) { explode(bx, by, false); SFX.play('boom', false); }
  else { emit(bx, by, 10, { k: 'spark', sp: 220, life: 0.3, size: 2.5, col: '#ffe066' }); flashAt(bx, by, 18); SFX.play('hit'); shake = Math.max(shake, 2); }
  const res = `${b.T.n[b.s]}${note}，打掉 ${hearts(dmg)}` + (b.hp <= 0 ? '，擊毀！' : `（剩 ${hearts(b.hp)}）`);
  const all = [res];
  if (T.splash && !note.includes('波及')) {   // 炮：落點上下左右相鄰受 1/2 傷害、斜角受 1/4，敵我不分
    parts.push({ x: bx, y: by, vx: 0, vy: 0, t: 0.45, L: 0.45, size: T.splash, k: 'ring', drag: 0 });
    for (const q of alive()) {
      const d = Math.hypot(q.x - bx, q.y - by);
      if (q === b || d > T.splash + 1) continue;
      const dmg = quarter(d <= C + 1 ? T.dmg / 2 : T.dmg / 4);
      if (dmg > 0) all.push(impact(a, q, dmg, '（波及）'));
    }
  }
  if (!note.includes('波及')) setMsg(`${T.n[a.s]} 用${T.w}攻擊 ` + all.join('；'));
  timer = Math.max(timer, b.hp <= 0 ? 1.2 : 0.8);
  checkWin();
  return res;
}
const CROSSERS = ['R', 'N', 'C', 'P'];   // 能過河的兵種（含已升官的士官長）
function checkWin() {
  for (const s of [0, 1])
    if (!pieces.some(p => p.s === s && p.t === 'K' && p.hp > 0)) winner = 1 - s;
  // 雙方都沒有能過河的棋子（只剩帥／仕／相）就沒人打得到對方，直接和局
  if (winner === null && !alive().some(p => CROSSERS.includes(p.t))) { winner = 2; setMsg('雙方都沒有能過河的棋子（只剩帥／仕／象），和局！'); }
}
function endTurn() {
  if (online() && !myTurn()) {   // 對手的回合：動畫播完後等對方送來的結果
    if (pendingEnd) applyEnd(); else state = 'wait';
    return;
  }
  if (winner !== null) { state = 'over'; SFX.play('win'); send({ t: 'end', snap: snapshot() }); return; }
  // 裝填倒數：每結束一個自己的回合減 1（開火那回合不算）
  for (const p of pieces) {
    if (!(p.cd > 0)) continue;
    if (p.T.aa) { if (p.s !== turn && !p.cdFresh) p.cd--; }   // 防空：對方每打完一次攻擊算一次冷卻（剛攔截的那次不算）
    else if (p.s === turn && p !== firedPiece) p.cd--;
  }
  pieces.forEach(p => { p.cdFresh = false; });
  firedPiece = null;
  turnsPlayed[turn]++;
  turn = 1 - turn; state = 'aim'; targets = []; moved = false; setSkip(false);
  healPhase(turn);
  updateHeader();
  send({ t: 'end', snap: snapshot() });
  maybeTurnPick();
}
function update(dt) {
  if (state === 'moving') {
    for (let i = 0; i < 4; i++) physics(dt / 4);
    if (alive().every(p => Math.hypot(p.vx, p.vy) < 2)) startSettle();
  } else if (state === 'settle') {   // 吸附到交叉點的小動畫
    snapT -= dt;
    const k = 1 - Math.max(0, snapT) / SNAP_T, e = k * (2 - k);
    for (const [p, s] of snaps) { p.x = s.fx + (s.tx - s.fx) * e; p.y = s.fy + (s.ty - s.fy) * e; }
    if (snapT <= 0) finishSettle();
  } else if (state === 'fire') {
    timer -= dt;
    if (timer <= 0 && !fx.some(f => f.done)) endTurn();   // 等所有彈體落地
  }
  for (const p of pieces) {
    p.flash = Math.max(0, p.flash - dt); p.recoil = Math.max(0, p.recoil - dt * 6); if (p.aimT > 0) p.aimT = Math.max(0, p.aimT - dt);
    if (p.lock) { p.lock.t -= dt; if (p.lock.t <= 0) p.lock = null; }
    if (p.sl) {   // 仕滑到擋子彈的位置（0.1 秒）
      const d = p.sl; d.k = Math.min(1, d.k + dt / 0.1);
      const e = 1 - d.k * (2 - d.k);
      p.ox = d.ox * e; p.oy = d.oy * e;
      if (d.k >= 1) { p.sl = null; p.ox = p.oy = 0; }
    }
  }
  for (const f of fx) {
    if (f.delay > 0) { f.delay -= dt; if (f.delay <= 0 && f.start) f.start(); continue; }
    f.t -= dt;
    if (f.stopAt && 1 - f.t / f.T >= f.stopAt) f.t = 0;   // 被攔截：提早結束
    if (f.k === 'rocket' && f.t > 0) {   // 火箭尾焰與煙
      const [x, y] = projPos(f);
      emit(x, y, 2, { k: 'smoke', sp: 20, life: 0.7, size: 7, col: '#999' });
      emit(x, y, 1, { k: 'fire', sp: 40, life: 0.15, size: 6, col: '#ffb030', dir: f.dir + Math.PI, spread: 0.6 });
    }
  }
  const finished = fx.filter(f => f.t <= 0);
  fx = fx.filter(f => f.t > 0);
  finished.forEach(f => { if (f.done) f.done(); });
  for (const f of fx) if (f.k === 'drop' && !f.landed && 1 - f.t / f.T >= LAND_AT) { f.landed = true; f.land(); }
  updParts(dt);
  aiTick();
}
// 彈體目前位置（火箭加速、砲彈拋物線）
function projPos(f) {
  const k = 1 - Math.max(0, f.t) / f.T, e = f.k === 'rocket' ? k * k : k;
  const x = f.x1 + (f.x2 - f.x1) * e, y = f.y1 + (f.y2 - f.y1) * e;
  return [x, f.k === 'shell' ? y - Math.sin(k * Math.PI) * f.h : y, x, y, k];
}

