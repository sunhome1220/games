// ===== 介面：選關、戰前說明、戰場操作、結局 =====
(function (root) {
  const R = root.RULES, D = root.DATA, H = root.HEX;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { g: null, side: null, speed: 1, mode: 'main', inspect: null, pending: null, preview: null, busy: false, fast: false, auto: false };
  root.UI = S;
  const COL = { move: 0x4fc3f7, attack: 0xff4d3d, struct: 0xff9a3a, target: 0xc77dff, face: 0xffe08a };

  // ---------- 武將頭像 ----------
  const P = root.PORTRAITS;
  // 武將在劇本裡屬於哪一方（決定頭像底色）
  function genSide(gen, sc) { const x = ((sc || (S.g && S.g.sc) || D.SCENARIOS[0]).units || []).find(v => v.gen === gen); return x ? x.side : null; }
  function face(gen, mood, opts = {}) {
    const M = P.MOODS[gen] && P.MOODS[gen][mood];
    return `<figure class="pt ${opts.cls || ''}" ${opts.data ? `data-gen="${gen}"` : ''}>${P.svg(gen, mood, { side: opts.side || genSide(gen, opts.sc), name: D.GENERALS[gen].name })}${opts.caption ? `<figcaption>${esc(D.GENERALS[gen].name)}${M && mood !== 'default' ? `・${esc(M.name)}` : ''}</figcaption>` : ''}</figure>`;
  }
  const faces = (who, opts) => who && who.length ? `<div class="pts">${who.map(([gn, m]) => face(gn, m, { caption: true, ...opts })).join('')}</div>` : '';
  // 戰鬥中用的情緒：不用「被綁」的那幾張
  function battleMood(gen, prefs) { const m = P.MOODS[gen] || {}; return prefs.find(k => m[k] && !m[k].bound) || 'default'; }
  // 戰場上的頭像特寫（不擋操作，自己消失）
  let cutT = null;
  function cutIn(list, text) {
    if (S.fast) return;
    const el = $('#cutin'); if (!el) return;
    el.innerHTML = `<div class="pts">${list.map(([gn, m, side]) => face(gn, m, { side, caption: true })).join('<b class="vs">VS</b>')}</div>${text ? `<div class="ct">${esc(text)}</div>` : ''}`;
    el.hidden = false; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(cutT); cutT = setTimeout(() => (el.hidden = true), 2200 / S.speed);
  }
  // 武將錄：所有外貌與情緒頭像、演義原文
  function showGeneral(gen, sc) {
    const G = D.GENERALS[gen], L = P.LOOKS[gen];
    const ms = P.moodsOf(gen);
    return modal(`<h2>${esc(G.name)}</h2>
      <p>${esc(G.bio)}</p>
      <div class="box2"><b>演義外貌</b>（${esc(L.src)}）：${esc(L.desc)}</div>
      <div class="gal">${ms.map(m => `<div class="gm">${face(gen, m.id, { sc, cls: 'lg' })}<b>${esc(m.name)}</b>${m.quote ? `<small>${esc(m.quote)}${m.src ? `（${esc(m.src)}）` : ''}</small>` : ''}</div>`).join('')}</div>`, [['關閉', true]]);
  }

  // ---------- 畫面切換 ----------
  function show(id) { for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id; }

  // ---------- 選關 ----------
  function renderSelect() {
    show('scrSelect'); $('#title').textContent = '三國・名戰錄';
    $('#scList').innerHTML = D.SCENARIOS.map(sc => `
      <div class="sc ${sc.playable ? '' : 'lock'}">
        <div><span class="no">第 ${sc.no} 關</span><b>${sc.name}</b><span class="diff">${sc.year}・難度 ${sc.diff}${sc.playable ? '' : '・製作中'}</span></div>
        <p>${esc(sc.brief.background)}</p>
        ${sc.playable ? `<div class="sides">
          <button class="att" data-sc="${sc.id}" data-side="att"><b style="color:var(--att)">攻方・${sc.sides.att.name}</b><small>${sideBlurb(sc, 'att')}</small></button>
          <button class="def" data-sc="${sc.id}" data-side="def"><b style="color:var(--def)">守方・${sc.sides.def.name}</b><small>${sideBlurb(sc, 'def')}</small></button>
        </div>` : `<p class="lead">${esc(sc.brief.teaser)}</p><div class="sides"><button data-peek="${sc.id}" class="btn ghost">📜 看戰役簡介</button></div>`}
      </div>`).join('');
    for (const b of document.querySelectorAll('#scList [data-sc]')) b.onclick = () => showBrief(b.dataset.sc, b.dataset.side);
    for (const b of document.querySelectorAll('#scList [data-peek]')) b.onclick = () => peek(b.dataset.peek);
  }
  function sideBlurb(sc, side) { return side === 'att' ? '野戰擊破呂布，渡河圍城、水攻下邳' : '以寡敵眾，守住下邳直到曹軍糧盡'; }
  function peek(id) {
    const sc = D.SCENARIOS.find(s => s.id === id);
    modal(`<h2>${sc.name}（${sc.year}）</h2><p>${esc(sc.brief.background)}</p><h3>史實經過</h3><ul>${sc.brief.history.map(h => `<li>${esc(h)}</li>`).join('')}</ul><p class="lead">本關製作中，先完成第 1 關的試玩回饋後再開發。</p>`, [['知道了', true]]);
  }

  // ---------- 戰前說明 ----------
  function showBrief(scId, side) {
    const sc = D.SCENARIOS.find(s => s.id === scId); const B = sc.brief; const me = sc.sides[side], foe = sc.sides[R.other(side)];
    show('scrBrief'); $('#title').textContent = sc.name;
    $('#briefBox').innerHTML = `<div class="brief">
      <h1>第 ${sc.no} 關・${sc.name}</h1>
      <p class="lead">${sc.year}｜你扮演 <b class="${side}">${me.name}</b>（${side === 'att' ? '攻方' : '守方'}），對手是電腦操控的${foe.name}。</p>
      <h2>戰役背景</h2><p>${esc(B.background)}</p>
      <h2>雙方兵力</h2>
      <div class="box2"><b class="att">${sc.sides.att.name}</b>：${esc(B.forces.att)}<br><b class="def">${sc.sides.def.name}</b>：${esc(B.forces.def)}</div>
      <h2>登場武將</h2><p class="lead">點頭像看《三國演義》裡的外貌描寫與各種情緒。</p>
      <div class="roster">${['att', 'def'].map(sd => `<div><b class="${sd}">${sc.sides[sd].name}</b><div class="pts">${[...new Set(sc.units.filter(x => x.side === sd).map(x => x.gen))].map(gn => face(gn, 'default', { sc, caption: true, data: true })).join('')}</div></div>`).join('')}</div>
      <h2>勝利條件</h2><ul>${B.goal[side].map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <h2>攻城戰說明</h2><ul>${B.siege.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <h2>尊重歷史，還是逆轉歷史？</h2>
      <div class="box2"><span class="tag h">尊重歷史</span>${esc(B.paths[side].respect)}</div>
      <div class="box2"><span class="tag r">逆轉歷史</span>${esc(B.paths[side].reverse)}</div>
      <p class="lead">真實的歷史經過，會在戰役結束後揭曉並和你的戰果對照。</p>
      <h2>基本操作</h2>
      <ul>
        <li>輪到你的部隊時：點<b style="color:#4fc3f7">藍色格子</b>移動，點<b style="color:#ff4d3d">紅色敵軍</b>預覽攻擊（再按確認），下方按鈕可變陣、整隊、使用技能。</li>
        <li>沒有攻擊的話，結束前要選<b>朝向</b>——部隊周圍的彩色圈是方向弱點：<span class="m-good">綠＝強</span>、<span class="m-warn">黃</span>、<span class="m-bad">紅＝弱</span>。</li>
        <li>單指拖曳移動地圖、雙指縮放旋轉（滑鼠：右鍵拖曳旋轉、滾輪縮放）。右上角按鈕也可以轉視角。</li>
      </ul>
      <div class="row"><button class="main" id="btnGo">⚔ 開戰</button><button id="btnHow">📖 陣型與規則說明</button><button id="btnBackSel">← 換一關</button></div>
    </div>`;
    for (const f of document.querySelectorAll('#briefBox .roster [data-gen]')) f.onclick = () => showGeneral(f.dataset.gen, sc);
    $('#btnGo').onclick = () => startBattle(scId, side);
    $('#btnHow').onclick = showHelp;
    $('#btnBackSel').onclick = renderSelect;
    $('#scrBrief').scrollTop = 0;
  }

  // ---------- 開戰 ----------
  async function startBattle(scId, side, opts = {}) {
    show('scrBattle');
    const sc = D.SCENARIOS.find(s => s.id === scId); $('#title').textContent = sc.name;
    S.g = R.newGame(scId, { player: side, seed: opts.seed }); S.side = side; S.mode = 'main'; S.inspect = null; S.preview = null; S.pending = null;
    root.G = S.g;
    if (!(await root.V3.init($('#stage')))) { $('#panel').innerHTML = '<p>這台裝置無法顯示 3D 畫面（不支援 WebGL）。</p>'; return; }
    root.V3.onTap = onTap;
    root.V3.build(S.g); root.V3.syncUnits(S.g);
    const myLead = S.g.units.find(u => u.side === side && u.gen === sc.sides[side].leader);
    root.V3.focus(myLead.c, myLead.r, false);
    R.startRound(S.g);
    await loop();
  }
  const isMine = u => u && !S.auto && u.side === S.side;

  async function loop() {
    const g = S.g;
    while (!g.over) {
      await drain();
      if (g.over) break;
      const u = R.activeUnit(g); if (!u) break;
      renderHUD();
      if (isMine(u)) { beginPlayer(u); return; }
      S.busy = true; $('#busy').hidden = false; renderPanelEnemy(u);
      if (!S.fast) { root.V3.focus(u.c, u.r); await wait(260 / S.speed); }
      AI.act(g, u);
      await drain();
      if (!g.over) R.endActivation(g);
    }
    await drain();
    S.busy = false; $('#busy').hidden = true;
    if (g.over) showEnd();
  }
  const wait = ms => new Promise(r => setTimeout(r, S.fast ? 0 : ms));

  // 播放規則層產生的特效與事件
  async function drain() {
    const g = S.g;
    while (g.fx.length) {
      const f = g.fx.shift();
      if (f.t === 'log') { renderLastLog(); continue; }
      if (f.t === 'round') { renderHUD(); toast(`第 ${f.n} 回合`); continue; }
      if (f.t === 'msg') { renderHUD(); if (!S.fast) await modal(`<h2>${esc(f.title)}</h2>${faces(f.who)}<p style="white-space:pre-line">${esc(f.text)}</p>`, [['繼續', true]]); continue; }
      if (f.t === 'duel') duelCut(f);
      if (f.t === 'skill') { const u = g.units[f.id]; if (!R.isEngine(u)) cutIn([[u.gen, battleMood(u.gen, ['rage', 'laugh', 'plan', 'plot']), u.side]], `${u.name}【${f.name}】`); }
      if (f.t === 'over') continue;
      if (S.fast) { if (['move', 'warp', 'face', 'form', 'attack', 'dead', 'defect', 'struct', 'flood', 'burn', 'ladder'].includes(f.t)) { if (f.t === 'flood') f.hexes.forEach(([c, r]) => root.V3.refreshHex(g, c, r)); if (f.t === 'struct' && f.broke) root.V3.refreshHex(g, f.c, f.r); if (f.t === 'burn') root.V3.refreshHex(g, f.c, f.r); if (f.t === 'ladder') root.V3.ladderMarks(g); } continue; }
      await root.V3.playFx(f, g, S.speed);
    }
    root.V3.syncUnits(g);
    renderHUD();
  }

  function duelCut(f) {
    const g = S.g, a = g.units[f.a], d = g.units[f.d];
    const WIN = ['laugh', 'rage', 'plan', 'plot'], LOSE = ['haggard', 'cry', 'sigh', 'grudge', 'weep'];
    const ma = f.result === 'win' ? WIN : f.result === 'lose' ? LOSE : ['rage', 'default'];
    const md = f.result === 'lose' ? WIN : f.result === 'win' || f.result === 'refuse' ? LOSE : ['rage', 'default'];
    const txt = { win: `單挑！${a.name}獲勝`, lose: `單挑！${d.name}獲勝`, draw: '大戰數十回合，不分勝負', refuse: `${d.name}不敢應戰` }[f.result];
    cutIn([[a.gen, battleMood(a.gen, ma), a.side], [d.gen, battleMood(d.gen, md), d.side]], txt);
  }

  // ---------- 玩家操作 ----------
  function beginPlayer(u) {
    S.busy = false; $('#busy').hidden = true; S.mode = 'main'; S.inspect = null; S.preview = null; S.pending = null;
    root.V3.focus(u.c, u.r);
    refresh();
  }
  function refresh() {
    const g = S.g, u = R.activeUnit(g);
    if (!u || !isMine(u) || g.over) return;
    root.V3.selectRing(u);
    const insp = S.inspect != null ? g.units[S.inspect] : null;
    const ring = S.preview && S.preview.unit != null ? g.units[S.preview.unit] : insp || u;
    root.V3.showSides(ring && ring.alive && !R.isEngine(ring) && !R.onWall(g, ring) ? ring : null, ring ? (R.formOf(ring) || { def: D.BASE_DEF }).def : null);
    setHighlights(u);
    renderPanel(u);
    renderHUD();
  }
  function setHighlights(u) {
    const g = S.g; const L = [];
    if (S.mode === 'face') {
      H.neighbors(u.c, u.r).forEach(([c, r], d) => { if (g.map[r] && g.map[r][c]) L.push({ c, r, color: d === u.face ? 0xffffff : COL.face, opacity: d === u.face ? 0.7 : 0.45 }); });
    } else if (S.mode === 'target' && S.pending) {
      for (const t of S.pending.targets) { const [c, r] = typeof t === 'object' ? [t.c, t.r] : [g.units[t].c, g.units[t].r]; L.push({ c, r, color: COL.target, opacity: 0.6 }); }
    } else if (S.mode === 'main') {
      if (!u.moved) for (const [k, v] of R.reachable(g, u)) if (!v.blocked && v.cost > 0) L.push({ c: v.c, r: v.r, color: COL.move, opacity: 0.35 });
      if (!u.acted) {
        for (const t of R.attackTargets(g, u)) L.push({ c: t.c, r: t.r, color: COL.attack, opacity: 0.6 });
        for (const s of R.structTargets(g, u)) L.push({ c: s.c, r: s.r, color: COL.struct, opacity: 0.6 });
      }
    }
    if (S.preview) { const p = S.preview; L.push({ c: p.c, r: p.r, color: 0xffffff, opacity: 0.5, scale: 0.6 }); }
    root.V3.highlight(L);
  }

  function onTap(c, r) {
    const g = S.g; if (!g || g.over) return;
    const u = R.activeUnit(g); const t = R.unitAt(g, c, r);
    if (S.busy || !isMine(u)) { if (t) { S.inspect = t.id; renderPanelEnemy(u, t); root.V3.showSides(R.isEngine(t) || R.onWall(g, t) ? null : t, (R.formOf(t) || { def: D.BASE_DEF }).def); } return; }
    if (S.mode === 'face') {
      const d = H.neighbors(u.c, u.r).findIndex(([cc, rr]) => cc === c && rr === r);
      if (d >= 0) { R.setFacing(g, u, d); drain().then(refresh); }
      return;
    }
    if (S.mode === 'target' && S.pending) {
      const P = S.pending; const hit = P.targets.find(x => (typeof x === 'object' ? x.c === c && x.r === r : g.units[x].c === c && g.units[x].r === r));
      if (hit != null) {
        if (P.id === 'skill:weizhen') { S.preview = { unit: hit, c, r, weizhen: true }; S.mode = 'main'; refresh(); return; }
        act(P.id, typeof hit === 'object' ? hit.k : hit); return;
      }
      if (t) { S.inspect = t.id; refresh(); }
      return;
    }
    if (S.mode !== 'main') { if (t) { S.inspect = t.id; refresh(); } return; }
    // 主模式
    if (S.preview && S.preview.c === c && S.preview.r === r) { confirmPreview(); return; }
    if (t && t.side !== u.side && R.attackTargets(g, u).includes(t)) { S.preview = { unit: t.id, c, r }; S.inspect = null; refresh(); return; }
    const st = R.structTargets(g, u).find(s => s.c === c && s.r === r);
    if (st && !t) { S.preview = { struct: st.k, c, r }; refresh(); return; }
    if (t) { S.preview = null; S.inspect = t === u ? null : t.id; refresh(); return; }
    if (!u.moved) {
      const reach = R.reachable(g, u); const v = reach.get(H.key(c, r));
      if (v && !v.blocked && v.cost > 0) { S.preview = null; S.inspect = null; R.moveUnit(g, u, c, r); S.busy = true; drain().then(() => { S.busy = false; root.V3.focus(u.c, u.r); refresh(); }); return; }
    }
    S.preview = null; S.inspect = null; refresh();
  }
  function confirmPreview() {
    const g = S.g, u = R.activeUnit(g), p = S.preview; S.preview = null;
    if (p.struct) act('struct', p.struct);
    else if (p.weizhen) act('skill:weizhen', p.unit);
    else { R.attack(g, u, g.units[p.unit]); after(); }
  }
  function act(id, target) {
    const g = S.g, u = R.activeUnit(g);
    S.mode = 'main'; S.pending = null; S.preview = null;
    if (!R.doAction(g, u, id, target)) { toast('現在不能這樣做'); refresh(); return; }
    after();
  }
  async function after() {
    S.busy = true; await drain(); S.busy = false;
    const g = S.g; if (g.over) { showEnd(); return; }
    const u = R.activeUnit(g);
    if (!u || !u.alive) { R.endActivation(g); loop(); return; }
    refresh();
  }
  function onAction(a) {
    const g = S.g, u = R.activeUnit(g);
    if (!a.enabled) { toast(a.why || '現在不能用'); return; }
    S.preview = null; S.inspect = null;
    if (a.id === 'form') { S.mode = 'form'; S.pending = a; refresh(); return; }
    if (a.need === 'enemy' || a.need === 'hex') { S.mode = 'target'; S.pending = a; refresh(); return; }
    act(a.id);
  }
  function endUnit() {
    const g = S.g, u = R.activeUnit(g);
    if (!u.attacked && S.mode !== 'face') { S.mode = 'face'; S.preview = null; S.inspect = null; root.V3.focus(u.c, u.r); refresh(); return; }
    finishUnit();
  }
  function finishUnit() {
    const g = S.g; S.mode = 'main'; root.V3.clearHighlights(); root.V3.showSides(null); root.V3.selectRing(null);
    R.endActivation(g); loop();
  }

  // ---------- 面板 ----------
  function bar(v, max, color) { return `<div class="bar"><i style="width:${Math.max(0, Math.min(100, v / max * 100))}%;background:${color}"></i></div>`; }
  function cohColor(v) { return v >= 70 ? 'var(--good)' : v >= 40 ? 'var(--warn)' : 'var(--bad)'; }
  function unitCard(u) {
    const g = S.g, ty = R.ty(u), gn = R.gen(u);
    const f = R.formOf(u); const st = R.state(u);
    const eng = R.isEngine(u);
    const tags = [];
    if (!eng) tags.push(`${f ? f.name || f.short : '—'}${st !== 'full' ? `（${R.STATE_NAME[st]}）` : ''}`);
    tags.push('面向' + H.DIR_NAME[u.face]);
    if (R.encircled(g, u)) tags.push('<span class="m-bad">被包圍</span>');
    if (R.onWall(g, u)) tags.push('城上');
    const t = R.terr(g, u.c, u.r); tags.push(t.name);
    return `<div class="ucard">${eng ? `<div class="badge ${u.side}">${ty.icon}</div>` : `<div class="badge pt ${u.side}" data-gen="${u.gen}" title="看${esc(gn.name)}的武將錄">${P.svg(u.gen, 'default', { side: u.side, name: gn.name, frame: u.side === 'att' ? '#5d8de0' : '#e0604f' })}</div>`}<div class="uinfo">
      <div class="uname">${esc(u.name)}<small>${eng ? ty.name : `${ty.name}${u.label ? '・' + u.label : ''}　統${gn.lead} 武${gn.war} 智${gn.int}`}</small></div>
      <div class="usub">${tags.join('｜')}</div>
      <div class="bars"><span>兵力</span>${bar(u.troops, u.max, u.side === 'att' ? 'var(--att)' : 'var(--def)')}<span>${u.troops}</span>
      ${eng ? '' : `<span>士氣</span>${bar(u.mor, 100, '#b98cf0')}<span>${Math.round(u.mor)}</span><span>完整</span>${bar(u.coh, 100, cohColor(u.coh))}<span>${Math.round(u.coh)} ${R.STATE_NAME[st]}</span>`}</div>
    </div></div>`;
  }
  function skillLine(u) {
    if (R.isEngine(u)) return '';
    const sk = R.gen(u).skills.map(s => { const S2 = D.SKILLS[s]; return `<b>${S2.name}</b>${S2.kind === 'active' ? (u.cd[s] ? `（冷卻 ${u.cd[s]}）` : '（主動）') : '（被動）'}：${S2.desc}`; });
    return sk.length ? `<div class="usub" style="margin-top:4px">${sk.join('<br>')}</div>` : '';
  }
  function renderPanel(u) {
    const g = S.g; const insp = S.inspect != null ? g.units[S.inspect] : null;
    let h = '';
    if (insp && insp.alive) {
      h += unitCard(insp) + skillLine(insp);
      if (!R.isEngine(insp) && !R.onWall(g, insp)) h += `<div class="usub" style="margin-top:4px">方向受傷倍率：${profileText((R.formOf(insp) || { def: D.BASE_DEF }).def)}</div>`;
      h += `<div class="acts"><button id="bkSel">↩ 回到${esc(u.name)}</button></div>`;
      $('#panel').innerHTML = h; $('#bkSel').onclick = () => { S.inspect = null; refresh(); }; hookFaces(); return;
    }
    h += unitCard(u);
    if (S.mode === 'face') {
      h += `<div class="hint">選擇朝向：點部隊旁邊的黃色格子（白色＝目前朝向）。正面受傷最少、背面最多，記得把正面對準敵人。</div>`;
      h += `<div class="acts"><button class="end" id="bFaceOk">✔ 確定朝向，結束行動</button>${!u.acted ? '<button id="bFaceBack">↩ 返回</button>' : ''}</div>`;
    } else if (S.mode === 'form') {
      h += `<div class="hint">選擇新陣型（花掉這次動作${R.adjEnemies(g, u).length ? '；貼著敵軍變陣，完整度 −15' : ''}）：</div><div class="forms">`;
      for (const fid of S.pending.targets) { const F = D.FORMATIONS[fid]; h += `<button data-f="${fid}"><span><b>${F.name}</b>　攻擊 ×${F.atk}${F.move ? `、移動 +${F.move}` : ''}${F.ranged ? `、遠程 ×${F.ranged}` : ''}${F.joint ? '、合擊 ×2' : ''}${F.charge ? `、衝鋒 ×${F.charge}` : ''}<small>${F.desc}</small><small>受傷：${profileText(F.def)}</small></span></button>`; }
      h += `</div><div class="acts"><button id="bFormBack">↩ 返回</button></div>`;
    } else if (S.mode === 'target') {
      h += `<div class="hint">【${esc(S.pending.name)}】點選紫色的目標。${esc(S.pending.desc || '')}</div><div class="acts"><button id="bTgBack">↩ 取消</button></div>`;
    } else {
      if (S.preview) h += previewHTML(u);
      else h += `<div class="hint">${!u.moved ? '點藍色格子移動；' : ''}${!u.acted ? '點紅色敵軍預覽攻擊；也可以用下面的按鈕。' : '動作已用完，按「結束行動」選朝向。'}</div>`;
      const acts = R.actionsFor(g, u).filter(a => !(a.pre && u.moved));
      h += '<div class="acts">';
      acts.forEach((a, i) => { h += `<button data-a="${i}" class="${a.skill ? 'skill' : ''}" ${a.enabled ? '' : 'style="opacity:.45"'} title="${esc(a.desc || '')}">${esc(a.name)}</button>`; });
      if (u.moved && !u.acted) h += `<button id="bUndo">↶ 取消移動</button>`;
      h += `<button class="end" id="bEnd">${u.attacked ? '✔ 結束行動' : '結束行動 ▶'}</button></div>`;
      S._acts = acts;
    }
    h += lastLogHTML();
    $('#panel').innerHTML = h;
    for (const b of document.querySelectorAll('#panel [data-a]')) b.onclick = () => onAction(S._acts[+b.dataset.a]);
    for (const b of document.querySelectorAll('#panel [data-f]')) b.onclick = () => act('form', b.dataset.f);
    const on = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
    on('#bEnd', endUnit); on('#bFaceOk', finishUnit); on('#bFaceBack', () => { S.mode = 'main'; refresh(); });
    on('#bFormBack', () => { S.mode = 'main'; S.pending = null; refresh(); }); on('#bTgBack', () => { S.mode = 'main'; S.pending = null; refresh(); });
    on('#bUndo', () => { R.undoMove(g, u); drain().then(refresh); });
    hookFaces(); on('#bPvOk', confirmPreview); on('#bPvNo', () => { S.preview = null; refresh(); });
  }
  function hookFaces() { for (const b of document.querySelectorAll('#panel .badge[data-gen]')) b.onclick = () => showGeneral(b.dataset.gen); }
  function profileText(p) { return D.SIDE_NAME.map((n, i) => `<span class="${p[i] <= 1 ? 'm-good' : p[i] <= 1.25 ? 'm-warn' : 'm-bad'}">${n}×${p[i].toFixed(2).replace(/0$/, '')}</span>`).join(' '); }
  function previewHTML(u) {
    const g = S.g, p = S.preview;
    if (p.struct) {
      const [c, r] = H.unkey(p.struct); const t = R.terr(g, c, r);
      return `<div class="preview">攻擊<b>${t.name}</b>（耐久 ${g.hp[p.struct]}）。${u.type === 'ram' ? '衝車撞門威力最大。' : u.type === 'cata' ? '投石可以打塌城牆，造出缺口。' : '步兵撞門效果很差。'}<div class="acts"><button class="end" id="bPvOk">⚔ 確認攻擊</button><button id="bPvNo">取消</button></div></div>`;
    }
    const T = g.units[p.unit];
    const res = R.calcDamage(g, u, T, { mean: true, weizhen: p.weizhen });
    const cnt = R.canCounter(g, u, T, res.ranged) ? R.calcDamage(g, T, u, { mean: true, counter: true }) : null;
    const sideTxt = res.side >= 0 ? `打在對方的<b>${D.SIDE_NAME[res.side]}</b>` : R.onWall(g, T) ? '攻擊城上守軍' : '攻擊器械';
    return `<div class="preview">${p.weizhen ? '【威震】' : ''}攻擊 <b>${esc(T.name)}</b>：${sideTxt}，預估殺傷 <b>約 ${res.dmg}</b>${cnt ? `，會被反擊約 ${cnt.dmg}` : '，對方無法反擊'}
      <div class="parts">${res.parts.map(([l, m]) => `${l}×${m.toFixed(2)}`).join('　')}</div>
      <div class="acts"><button class="end" id="bPvOk">⚔ 確認攻擊</button><button id="bPvNo">取消</button></div></div>`;
  }
  function renderPanelEnemy(active, show) {
    const g = S.g; const u = show || active;
    if (!u) return;
    $('#panel').innerHTML = `<div class="usub" style="margin-bottom:4px">${show ? '查看部隊' : (isMine(active) ? '' : '敵軍行動中')}</div>` + unitCard(u) + (show ? skillLine(u) : '') + lastLogHTML();
    hookFaces();
  }
  function lastLogHTML() {
    const L = S.g.log.slice(-3).reverse();
    return `<div class="lastlog">${L.map(l => `<div class="${l.side || ''}">${esc(l.text)}</div>`).join('')}</div>`;
  }
  function renderLastLog() { const el = document.querySelector('#panel .lastlog'); if (el) el.outerHTML = lastLogHTML(); }

  function renderHUD() {
    const g = S.g; if (!g) return;
    $('#hRound').textContent = `第 ${g.round} 回合`;
    const v = g.vars; const bits = [];
    if (g.scId === 'xiapi') {
      bits.push(`曹軍糧草 <b>${Math.max(0, v.supply)}</b>`);
      bits.push(`城中糧 <b>${v.food}</b>`);
      if (v.digOpen && !v.flooded) bits.push(`掘堤 ${v.dig}/${v.digNeed}`);
      if (v.flooded) bits.push('已水淹');
      if (v.betrayed) bits.push('西門已開');
      else if (v.unrest) bits.push('<span class="warn">⚠ 城內人心浮動</span>');
    }
    $('#hVars').innerHTML = bits.join('｜');
    const ids = R.upcoming(g, 14);
    $('#order').innerHTML = ids.map((id, i) => { const u = g.units[id]; const e = R.isEngine(u); return `<div class="chip ${u.side} ${i === 0 ? 'now' : ''} ${e ? 'eng' : ''}" title="${esc(u.name)}">${e ? R.ty(u).icon : R.gen(u).mark}</div>`; }).join('');
  }
  let toastT = null;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 1400); }

  // ---------- 視窗 ----------
  function modal(html, btns) {
    return new Promise(res => {
      $('#modalBody').innerHTML = html;
      $('#modalBtns').innerHTML = btns.map(([t, v], i) => `<button data-i="${i}" class="${i === 0 ? 'main' : ''}">${t}</button>`).join('');
      $('#modal').hidden = false;
      for (const b of document.querySelectorAll('#modalBtns button')) b.onclick = () => { $('#modal').hidden = true; res(btns[+b.dataset.i][1]); };
    });
  }
  function showHelp() {
    const F = D.FORMATIONS;
    modal(`<h2>陣型與規則</h2>
      <h3>行動順序</h3><p>每回合所有部隊依「速度」排隊輪流行動，敵我交錯（上方的圓點就是順序）。騎兵最快，器械最慢；統率高、長蛇陣會更快，混亂會變慢。快的部隊可以趁敵人還沒轉身就繞到側面、背後。</p>
      <h3>方向</h3><p>每支部隊都有朝向。被攻擊時看攻擊來自哪一面：正面×1.0、前側×1.2、後側×1.4、背面×1.6（再依陣型調整）。被打的一方只有在自己的回合才能轉身。<br>若受攻擊那一面的兩旁有友軍，<b>友軍協防</b>會把加成大幅降低——所以強攻陣型要有友軍護住兩翼。</p>
      <h3>陣型（受傷倍率：正面／前側／後側／背面）</h3>
      <table class="ft"><tr><th>陣型</th><th>攻擊</th><th>受傷倍率</th><th>特性</th></tr>
      ${Object.values(F).map(f => `<tr><td>${f.name}</td><td>×${f.atk}</td><td>${f.def.join(' / ')}</td><td style="text-align:left">${f.desc}</td></tr>`).join('')}
      <tr><td>混亂</td><td>×0.65</td><td>1.6 全方位</td><td style="text-align:left">陣型失效、不能用技能、無法反擊</td></tr></table>
      <h3>完整度（陣型被衝亂）</h3><p>70 以上完整；40～70 動搖（陣型效果減半）；15～40 混亂；低於 15 潰散：統率 70 以上勉強穩住，45～69 潰逃，45 以下<b>就地解散</b>。側擊、背襲、衝鋒、合擊、被包圍都會大幅打亂陣型；用「整隊」恢復，遠離敵軍也會慢慢恢復。兵力剩兩成五以下的部隊會潰逃一次。</p>
      <h3>深入敵陣：包圍與合擊</h3><p>相鄰有 3 支敵軍，或兩支敵軍從正對面夾擊，就是<b>被包圍</b>：受傷 ×1.15，每回合士氣、完整度下降。攻擊時，目標旁邊每多一支我方部隊就有<b>合擊</b>加成（統率越高越多；有「合擊」技能或鶴翼陣翻倍）。反過來說，突破敵陣的一方如果敵將統率低、沒有合擊能力，就能從側背痛擊對方。</p>
      <h3>衝鋒、反擊、地形</h3><p>騎兵移動 2 格以上再攻擊就是衝鋒（樹林、丘陵、城牆擋住衝鋒）。近戰從正面或前側攻擊會被反擊。居高臨下 ×1.15；樹林、丘陵受傷較少；進入敵軍相鄰格（控制區）會停下來。</p>
      <h3>攻城</h3><p>城牆上的守軍：近戰要先用雲梯「架梯」，步兵、弓兵才能爬上去；弓箭仰攻 ×0.6（井闌旁 ×0.8）。衝車撞門、投石車打城牆，耐久歸零出現缺口。守方可用滾木礌石、火油，四角箭樓每回合自動放箭；從城門出城後攻擊有「出城突擊」加成。</p>
      <h3>單挑與計策</h3><p>武力 60 以上的武將可以向相鄰敵將單挑；實力差太多對方會避戰（士氣下降）。各武將的技能在部隊資訊裡可以看到。</p>`, [['關閉', true]]);
  }
  function showLog() {
    const L = S.g ? S.g.log.slice().reverse() : [];
    modal(`<h2>戰報</h2>${L.map(l => `<div class="logl ${l.kind === 'event' ? 'event' : l.side || ''}">第${l.round}回合　${esc(l.text)}</div>`).join('')}`, [['關閉', true]]);
  }
  async function showMenu() {
    const r = await modal(`<h2>選單</h2><p>動畫速度：目前 ${S.speed}x</p>`, [['繼續', 0], ['動畫速度', 1], ['重新開始這一關', 2], ['回到選關', 3]]);
    if (r === 1) { S.speed = S.speed >= 4 ? 1 : S.speed * 2; toast(`動畫速度 ${S.speed}x`); }
    if (r === 2 && S.g) startBattle(S.g.scId, S.side);
    if (r === 3) { S.g = null; renderSelect(); }
  }
  function showEnd() {
    const g = S.g; const o = g.over; const E = R.ENDINGS[g.scId][o.route]; const sc = g.sc;
    const win = o.winner === S.side;
    const st = g.stats;
    root.V3.clearHighlights(); root.V3.showSides(null); root.V3.selectRing(null);
    $('#panel').innerHTML = `<div class="hint">戰役結束：${win ? '勝利' : '敗北'}</div><div class="acts"><button id="bEndShow">查看結局</button></div>`;
    $('#bEndShow').onclick = showEnd;
    modal(`<h2>${win ? '🏆 勝利！' : '敗北…'}　${E.title}</h2>
      <p><span class="tag ${E.tag === '尊重歷史' ? 'h' : 'r'}">${E.tag}</span>${sc.sides[o.winner].name}獲勝（第 ${o.round} 回合）</p>
      ${faces(E.who)}
      <p>${esc(E.text)}</p>${E.who && E.who.some(([gn, m]) => P.MOODS[gn][m] && P.MOODS[gn][m].quote && P.MOODS[gn][m].src === '第 19 回') ? `<h3>演義・白門樓</h3><ul class="quotes">${E.who.map(([gn, m]) => P.MOODS[gn][m]).filter(M => M && M.quote && M.src === '第 19 回').map(M => `<li>${esc(M.quote)}</li>`).join('')}</ul>` : ''}
      <h3>你的戰果</h3><p>${sc.sides.att.name}損失 ${st.att.lost} 人；${sc.sides.def.name}損失 ${st.def.lost} 人。${g.vars.flooded ? '有水淹下邳。' : '沒有水淹。'}${g.vars.betrayed ? '城內將領倒戈。' : '沒有人倒戈。'}${g.vars.depotBurnt ? '曹軍糧營被燒。' : ''}</p>
      <h3>史實經過</h3><ul>${sc.brief.history.map(h => `<li>${esc(h)}</li>`).join('')}</ul>`,
      [['再玩一次', 'again'], ['換另一邊玩', 'swap'], ['回到選關', 'menu'], ['看戰場', 'stay']]).then(r => {
        if (r === 'again') startBattle(g.scId, S.side);
        else if (r === 'swap') showBrief(g.scId, R.other(S.side));
        else if (r === 'menu') renderSelect();
      });
  }

  // ---------- 啟動 ----------
  function init() {
    $('#btnHelp').onclick = showHelp; $('#btnMenu').onclick = () => (S.g ? showMenu() : renderSelect());
    $('#btnLog').onclick = showLog;
    for (const b of document.querySelectorAll('#camBtns button')) b.onclick = () => {
      const k = b.dataset.cam, V = root.V3;
      if (k === 'rl') V.rotate(-45); if (k === 'rr') V.rotate(45); if (k === 'zi') V.zoom(0.8); if (k === 'zo') V.zoom(1.25);
      if (k === 'fc' && S.g) { const u = R.activeUnit(S.g); if (u) V.focus(u.c, u.r); }
    };
    const q = new URLSearchParams(location.search);
    S.fast = q.has('fast'); S.auto = q.has('auto'); if (q.get('speed')) S.speed = +q.get('speed');
    if (q.get('sc')) startBattle(q.get('sc'), q.get('side') || 'att', { seed: q.get('seed') ? +q.get('seed') : undefined });
    else renderSelect();
  }
  Object.assign(S, { init, renderSelect, showBrief, startBattle, onTap, refresh, showHelp, drain });
})(window);
