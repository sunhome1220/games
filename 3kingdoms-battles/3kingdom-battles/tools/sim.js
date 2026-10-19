// AI 對 AI 模擬：node tools/sim.js [局數] [詳細]
const path = require('path');
for (const f of ['hex', 'data', 'rules', 'ai']) require(path.join(__dirname, '../js', f + '.js'));
const N = +process.argv[2] || 20, verbose = process.argv[3];
const tally = {}; let rounds = 0;
for (let s = 1; s <= N; s++) {
  const g = RULES.newGame('xiapi', { seed: s * 7919 });
  RULES.startRound(g);
  let guard = 0;
  while (!g.over && guard++ < 5000) {
    const u = RULES.activeUnit(g); AI.act(g, u); if (!g.over) RULES.endActivation(g);
    if (g.round > 60) break;
  }
  const k = g.over ? g.over.winner + ':' + g.over.route : 'timeout';
  tally[k] = (tally[k] || 0) + 1; rounds += g.round;
  if (verbose) {
    console.log(`#${s} ${k} R${g.round} flood=${g.vars.flooded}@${g.vars.floodRound} betray=${g.vars.betrayed} supply=${g.vars.supply} food=${g.vars.food}`);
    console.log('  ', g.units.map(u => `${u.name}${u.alive ? u.troops : '×'}(${u.side[0]})`).join(' '));
    if (verbose === 'log') g.log.forEach(l => console.log('   R' + l.round, l.text));
  }
}
console.log(tally, 'avg rounds', (rounds / N).toFixed(1));
