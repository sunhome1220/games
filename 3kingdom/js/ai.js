// ===== 電腦：出兵與攻守戰術 =====
const garrisonOf = c => c.capital ? 300 : 120;
const frontier = c => neighborsOf(c.id).some(n => cityById(n).owner !== c.owner);
function aiOrders(f) {
  const fac = G.factions[f]; if (!fac.alive) return;
  for (const c of ownedBy(f)) {
    if (besieged(c.id)) { if (fac.gold >= RECRUIT.cost && c.troops < c.cap) recruit(c.id); continue; }
    const avail = c.troops - garrisonOf(c);
    const foes = neighborsOf(c.id).map(cityById).filter(n => n.owner !== f);
    if (avail >= 120 && foes.length) {
      // 找最好打的鄰城：守軍＋城牆越弱越好；中立城優先，都城加分
      const score = n => n.troops + n.wall * 0.6 - (n.capital ? 150 : 0) - (n.owner === 'none' ? 80 : 0);
      const t = foes.sort((x, y) => score(x) - score(y))[0], need = Math.max(score(t), 80) * 1.0;
      if (avail >= need * 0.8) { dispatch(c.id, t.id, Math.min(avail, Math.max(MIN_SEND, Math.round(need)))); continue; }
    }
    if (avail >= 200 && !frontier(c)) {   // 後方城池把兵送到前線
      const fr = neighborsOf(c.id).map(cityById).filter(n => n.owner === f && frontier(n) && n.troops < c.troops);
      if (fr.length) dispatch(c.id, fr[0].id, Math.round(avail * 0.6));
    }
    if (fac.gold >= RECRUIT.cost + 40 && c.troops < c.cap * 0.6) recruit(c.id);
    if (fac.gold >= REPAIR.cost + 40 && c.wall < c.wallMax * 0.5 && frontier(c)) repair(c.id);
  }
}
const pickW = (w, rng) => { let s = 0; for (const k in w) s += w[k]; let r = rng() * s; for (const k in w) { r -= w[k]; if (r < 0) return k; } return Object.keys(w)[0]; };
// 攻方：依局勢加權（牆厚用衝車、兵多用雲梯、拖久了圍困），並避開對方上一輪守城戰術所剋制的
function aiAttackTactic(siege, rng = G.rng) {
  const c = cityById(siege.city);
  const w = { ram: c.wall > c.wallMax * 0.4 ? 3 : 1, ladder: siege.troops > c.troops * 1.3 ? 3 : 1, fire: 2, starve: siege.rounds >= 2 || siege.troops < c.troops ? 2 : 0.5 };
  if (c.lastDef) for (const k of Object.keys(w)) w[k] *= MATRIX[k][c.lastDef];
  return pickW(w, rng);
}
// 守方：針對攻方上一輪的戰術選克制的
function aiDefenseTactic(siege, rng = G.rng) {
  const w = { hold: 1, arrow: 1, sortie: 0.6, water: 1 }, k = siege.last;
  if (k) w[{ ram: 'sortie', ladder: rng() < 0.5 ? 'arrow' : 'hold', fire: 'water', starve: 'sortie' }[k]] += 3;
  if (siege.troops < cityById(siege.city).troops * 0.5) w.sortie += 1.5;
  return pickW(w, rng);
}
