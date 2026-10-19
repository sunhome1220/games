// ===== 介面：HUD、城池面板、出兵／攻城彈窗、說明 =====
const FNAME = f => FACTIONS[f].name;
function updateHud() {
  $('hTurn').textContent = `第 ${G.turn} 回合`;
  $('hGold').textContent = `💰 ${G.factions[G.player].gold}`;
  $('hFac').innerHTML = FIDS.map(f => `<span style="color:${G.factions[f].alive ? fcol(f) : '#777'}">${FNAME(f)}${f === G.player ? '（你）' : ''}${G.factions[f].alive ? ownedBy(f).length + '城' : '✗'}</span>`).join('');
  $('btnEnd').disabled = G.phase !== 'player';
  const rec = G.log.slice(-4).reverse();
  $('logTxt').innerHTML = rec.map(l => `<div class="${l.kind}">第${l.turn}回合・${l.txt}</div>`).join('');
}
const troopsTxt = c => `${Math.round(c.troops)} / ${c.cap}`;
function renderPanel() {
  const P = $('panel'), c = G.selected && cityById(G.selected), mine = G.phase === 'player';
  if (!c) { P.innerHTML = '<div class="hint">點選地圖上的城池查看；點自己的城可以出兵、徵兵、修城牆。<br>攻下敵方都城即滅其國，兩國皆滅就一統天下！</div>'; return; }
  const g = gen(c), own = c.owner === G.player, s = G.sieges.find(x => x.city === c.id);
  let h = `<h3 style="color:${fcol(c.owner)}">${c.capital ? '★ ' : ''}${c.name}　<small>${FNAME(c.owner)}${own ? '（我方）' : ''}</small></h3>
    <div class="st">守將：${g.name}（統${g.lead}・智${g.int}）　兵力 ${troopsTxt(c)}　城牆 ${Math.round(c.wall)} / ${c.wallMax}　收入 💰${c.income}${s ? `<br>⚔ <b style="color:#ffb26b">${FNAME(s.attacker)}軍 ${Math.round(s.troops)} 人圍城中（第 ${s.rounds} 輪）</b>` : ''}</div>`;
  if (own) {
    h += `<div class="row"><button data-act="recruit" ${mine && G.factions[G.player].gold >= RECRUIT.cost && c.troops < c.cap ? '' : 'disabled'}>徵兵 +${RECRUIT.troops}（💰${RECRUIT.cost}）</button>
      <button data-act="repair" ${mine && G.factions[G.player].gold >= REPAIR.cost && c.wall < c.wallMax ? '' : 'disabled'}>修城牆 +${REPAIR.wall}（💰${REPAIR.cost}）</button></div>`;
    for (const n of neighborsOf(c.id).map(cityById)) {
      const t = turnsFor(c.id, n.id), kind = n.owner === G.player ? '增援' : n.owner === 'none' ? '攻占（中立）' : '進攻';
      h += `<div class="go"><span style="color:${fcol(n.owner)}">${n.name}　${FNAME(n.owner)}・⚔${Math.round(n.troops)}・城牆${Math.round(n.wall)}　${t} 回合</span><button data-act="send" data-to="${n.id}" ${mine && c.troops >= MIN_SEND ? '' : 'disabled'}>${kind} ▸</button></div>`;
    }
  } else {
    const from = neighborsOf(c.id).map(cityById).filter(n => n.owner === G.player);
    h += from.length ? from.map(n => `<div class="go"><span>從 ${n.name}（⚔${Math.round(n.troops)}）出兵，${turnsFor(n.id, c.id)} 回合到達</span><button data-act="sendFrom" data-from="${n.id}" ${mine && n.troops >= MIN_SEND ? '' : 'disabled'}>出兵 ▸</button></div>`).join('') : '<div class="hint">這座城和你的城池不相鄰，要先拿下相鄰的城才能進攻。</div>';
  }
  P.innerHTML = h;
}
function refresh() { updateHud(); renderPanel(); }
function select(id) { G.selected = id; view.targets = []; refresh(); }

// ----- 點選地圖 -----
cv.addEventListener('pointerdown', e => {
  if (!G || $('startOv').hidden === false) return;
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * MW / r.width, y = (e.clientY - r.top) * MH / r.height;
  const hit = G.cities.find(c => Math.hypot(c.x - x, c.y - (y - 6)) < 34 * viewK());
  select(hit ? hit.id : null);
});
$('panel').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b || G.phase !== 'player') return;
  const c = G.selected && cityById(G.selected), a = b.dataset.act;
  if (a === 'recruit') { recruit(c.id); refresh(); }
  else if (a === 'repair') { repair(c.id); refresh(); }
  else if (a === 'send') openSend(c.id, b.dataset.to);
  else if (a === 'sendFrom') openSend(b.dataset.from, c.id);
});

// ----- 出兵彈窗 -----
let sendCtx = null;
function sendAmount() { const c = cityById(sendCtx.from), p = +$('sendRange').value / 100; return Math.max(MIN_SEND, Math.min(c.troops, Math.round(c.troops * p / 10) * 10)); }
function openSend(from, to) {
  const c = cityById(from), n = cityById(to); sendCtx = { from, to };
  $('sendTitle').textContent = `${c.name} → ${n.name}`;
  $('sendSub').textContent = `${n.owner === G.player ? '增援自己的城池' : n.owner === 'none' ? '攻占中立城池' : '進攻' + FNAME(n.owner) + '的城池'}，行軍 ${turnsFor(from, to)} 回合`;
  $('sendRange').value = 70; showSend(); $('sendOv').hidden = false;
}
function showSend() { const c = cityById(sendCtx.from), n = sendAmount(); $('sendNum').textContent = `派出 ${n} 人（${c.name}留守 ${Math.round(c.troops - n)} 人）`; }
$('sendRange').oninput = showSend;
$('sendNo').onclick = () => { $('sendOv').hidden = true; };
$('sendOk').onclick = () => {
  const n = sendAmount(); $('sendOv').hidden = true;
  const a = dispatch(sendCtx.from, sendCtx.to, n);
  if (a) log(`${a.name}率 ${n} 人從${cityById(a.from).name}出發，前往${cityById(a.to).name}`, 'info');
  refresh();
};

// ----- 攻城彈窗：選戰術 → 播動畫 → 顯示結果 -----
function sgFill(s, c) {
  $('sgBars').innerHTML = [['城牆', c.wall, c.wallMax, '#c9b78f'], [`守軍（${FNAME(c.owner)}）`, c.troops, c.cap, fcol(c.owner)], [`攻方（${FNAME(s.attacker)}）`, s.troops, Math.max(s.troops, 1000), fcol(s.attacker)]]
    .map(([n, v, m, col]) => `<span>${n}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, v / m * 100))}%;background:${col}"></i></span><span>${Math.round(v)}</span>`).join('');
}
function sgSetScene(s, c, over = {}) { Object.assign(sg, { a: null, d: null, run: false, owner: c.owner, attacker: s.attacker, attCol: fcol(s.attacker), defCol: fcol(c.owner), A0: s.troops, A1: s.troops, D0: c.troops, D1: c.troops, w0: c.wall, w1: c.wall, wm: c.wallMax }, over); }
function chooseTacticUI(s, role) {
  if (G.fast) return Promise.resolve(role === 'attack' ? aiAttackTactic(s) : aiDefenseTactic(s));
  return new Promise(res => {
    const c = cityById(s.city), set = role === 'attack' ? ATK : DEF;
    $('sgTitle').textContent = `${c.name}攻防戰・第 ${s.rounds + 1} 輪`;
    $('sgInfo').innerHTML = role === 'attack' ? `你是<b style="color:#ffb26b">攻方</b>：選一個攻城戰術（對方同時選守城戰術，被剋制效果會大減）` : `你是<b style="color:#8be0a0">守方</b>：選一個守城戰術（${FNAME(s.attacker)}軍${s.last ? '上一輪用了「' + ATK[s.last].name + '」' : '剛到城下'}）`;
    sgFill(s, c); sgSetScene(s, c);
    $('sgBtns').innerHTML = Object.entries(set).map(([k, t]) => `<button data-k="${k}">${t.ic} ${t.name}<small>${t.tip}</small></button>`).join('');
    $('sgBtns').onclick = e => { const b = e.target.closest('button[data-k]'); if (!b) return; $('sgBtns').onclick = null; $('sgBtns').innerHTML = ''; res(b.dataset.k); };
    $('siegeOv').hidden = false;
  });
}
function showResultUI(r, s, involved) {
  if (G.fast) return Promise.resolve();   // 測試／快速模式不彈窗
  if (!involved) { view.flash.push({ x: r.city.x, y: r.city.y, t: 1 }); return hooks.wait(500); }
  return new Promise(res => {
    const c = r.city, win = { ram: 'wall', ladder: 'kill' };
    const verdict = r.e < 1 ? '被剋制！效果大減' : r.e > 1.15 ? '剋制成功！效果大增' : '勢均力敵';
    $('siegeOv').hidden = false;
    $('sgTitle').textContent = `${c.name}攻防戰・結果`;
    sgSetScene(s, c, { a: r.a, d: r.d, A0: r.A0, A1: r.A0 - r.atkLoss, D0: r.D0, D1: r.D0 - r.defKill, w0: r.w0, w1: Math.max(0, r.w0 - r.wallDmg), run: true, t0: performance.now() });
    sgFill({ ...s, troops: r.A0 }, { ...c, troops: r.D0, wall: r.w0 });
    const outcome = { ongoing: '', captured: `<br><b style="color:#8be0a0">🏯 ${c.name}被${FNAME(s.attacker)}軍攻陷！</b>`, repulsed: `<br><b style="color:#ff8a80">攻方潰敗，${c.name}守住了！</b>`, destroyed: `<br><b style="color:#ff8a80">攻方全軍覆沒，圍城瓦解！</b>` }[r.result];
    $('sgInfo').innerHTML = `${ATK[r.a].ic} 攻方「${ATK[r.a].name}」　vs　${DEF[r.d].ic} 守方「${DEF[r.d].name}」：<b>${verdict}</b><br>城牆 −${r.wallDmg}　守軍 −${r.defKill}　攻方損失 −${r.atkLoss}${outcome}`;
    $('sgBtns').innerHTML = '<button data-k="ok" style="grid-column:1/3;text-align:center">繼續 ▶</button>';
    const done = () => { $('sgBtns').onclick = null; sgFill(s, c); $('siegeOv').hidden = true; sg.run = false; res(); };
    $('sgBtns').onclick = e => { if (e.target.closest('button')) done(); };
  });
}

// ----- 行軍動畫 -----
function marchAnim(events) {
  if (G.fast) return Promise.resolve();
  view.ghosts = G.ghosts || [];
  for (const ev of events) if (ev.t === 'field') { const [x, y] = armyPos(ev.win, 1); view.flash.push({ x, y, t: 1 }); }
  return new Promise(res => { const t0 = performance.now(); (function step(now) { view.animT = Math.min(1, (now - t0) / 900); if (view.animT < 1) requestAnimationFrame(step); else { view.animT = 1; view.ghosts = []; res(); } })(t0); });
}
Object.assign(hooks, { chooseTactic: chooseTacticUI, showResult: showResultUI, onMarch: marchAnim });

// ----- 結束回合與勝負 -----
$('btnEnd').onclick = async () => {
  if (G.phase !== 'player') return;
  $('sendOv').hidden = true; G.selected = G.selected; refresh();
  await endTurn(); view.targets = []; refresh();
  if (G.over) showEnd();
};
function showEnd() {
  $('endTitle').textContent = G.over === 'win' ? '🎉 天下一統！' : '💀 國破家亡…';
  $('endSub').textContent = G.over === 'win' ? `你用 ${G.turn - 1} 回合統一了三國。` : `${FNAME(G.player)}的都城陷落，共撐了 ${G.turn - 1} 回合。`;
  $('endOv').hidden = false;
}
$('endAgain').onclick = () => { $('endOv').hidden = true; $('startOv').hidden = false; };

// ----- 說明 -----
function helpHtml() {
  const hd = '<tr><th></th>' + Object.values(DEF).map(d => `<th>${d.ic} ${d.name}</th>`).join('') + '</tr>';
  const rows = Object.entries(ATK).map(([k, a]) => `<tr><th>${a.ic} ${a.name}</th>` + Object.keys(DEF).map(d => { const e = MATRIX[k][d]; return `<td class="${e < 0.8 ? 'k' : e > 1.2 ? 'g' : ''}">${e.toFixed(1)}</td>`; }).join('') + '</tr>').join('');
  return `<h2>玩法說明</h2>
  <h3>目標</h3>攻下其他兩國的<b>都城</b>（★）就能讓該國滅亡；兩國都滅就一統天下。都城被攻陷你就輸了。
  <h3>每回合</h3>① 點自己的城 → 選鄰城「出兵」（拉桿決定派多少人）；也可以花金幣徵兵、修城牆。② 按「結束回合」：電腦出兵、所有軍隊沿道路前進、已兵臨城下的城池打一輪攻城戰、結算收入。
  <h3>行軍</h3>軍隊每回合走固定距離，路遠要多走幾回合。兩支敵對軍隊在同一條路上對向相遇會直接野戰，兵力多、統率高者勝。抵達自己的城就是增援，抵達敵城或中立城就開始<b>圍城</b>。
  <h3>攻城：猜拳式戰術</h3>圍城每回合打一輪：攻方選一種攻城戰術、守方<b>同時</b>選一種守城戰術，依下表（攻方效果倍率）結算：<span style="color:#ff8a80">紅色＝被剋制</span>，<span style="color:#8be0a0">綠色＝剋制成功</span>。
  <table>${hd}${rows}</table>
  <ul><li>🪵 衝車：拆城牆最快　🪜 雲梯：殺傷最多但自己傷亡慘重　🔥 火攻：傷城也傷人　🏕️ 圍困：幾乎沒損失，慢慢耗守軍</li>
  <li>🛡️ 固守　🏹 箭雨（攻方傷亡 ×1.6）　🐎 出城（守軍會有損失）　💧 潑水（攻方傷亡 ×0.6，專剋火攻）</li>
  <li>攻方<b>統率</b>越高輸出越強；守將<b>智力</b>越高，剋制效果越好。</li>
  <li>城牆被打穿或守軍被殲滅時進行最後決戰；攻方贏就攻陷、輸了就潰敗撤圍。圍城中的城池不會補兵、不收入、不修牆。</li></ul>
  <h3>小提醒</h3>電腦守方會針對你上一輪的戰術選克制，所以<b>不要連續用同一招</b>！
  <button id="helpClose" style="width:100%;margin-top:10px">知道了</button>`;
}
function openHelp() { $('helpBox').innerHTML = helpHtml(); $('helpOv').hidden = false; $('helpClose').onclick = () => { $('helpOv').hidden = true; }; }
$('btnHelp').onclick = $('btnHelp2').onclick = openHelp;
$('btnNew').onclick = () => { if (confirm('重新開始？目前的進度會消失。')) { $('startOv').hidden = false; } };
