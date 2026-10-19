// ===== 回合流程：AI 出兵 → 軍隊前進 → 各城圍城一輪 → 結算 =====
// hooks 由畫面層（ui.js）換成有動畫、讓玩家選戰術的版本；測試或沒畫面時用這裡的自動版
const hooks = {
  wait: ms => G.fast ? Promise.resolve() : new Promise(r => setTimeout(r, ms)),
  chooseTactic: async (siege, role) => role === 'attack' ? aiAttackTactic(siege) : aiDefenseTactic(siege),
  showResult: async () => {},
  onMarch: async () => {},
};
async function endTurn() {
  if (G.phase !== 'player' || G.over) return;
  G.phase = 'resolving';
  for (const f of FIDS) if (f !== G.player) aiOrders(f);
  const events = stepArmies();
  await hooks.onMarch(events);
  for (const s of G.sieges.slice()) {
    if (!G.sieges.includes(s)) continue;
    const c = cityById(s.city), pAtt = s.attacker === G.player, pDef = c.owner === G.player, attacker = s.attacker;
    const a = pAtt && !G.auto ? await hooks.chooseTactic(s, 'attack') : aiAttackTactic(s);
    const d = pDef && !G.auto ? await hooks.chooseTactic(s, 'defend') : aiDefenseTactic(s);
    c.lastDef = d;
    const r = siegeRound(s, a, d);
    await hooks.showResult(r, s, pAtt || pDef);
    log(`${c.name}之戰：${FACTIONS[attacker].name}軍用${ATK[a].name}、守軍用${DEF[d].name}（城牆 −${r.wallDmg}，守軍 −${r.defKill}，攻方 −${r.atkLoss}）`, pAtt || pDef ? 'war' : '');
    if (checkVictory()) break;
  }
  economy(); checkVictory();
  G.turn++; G.phase = G.over ? 'over' : 'player';
}
