// ===== 勝率估算與「建議認輸」提示（只在對電腦時，只對玩家這一方）=====
// 勝率＝局面特徵的加權和再換算成百分比（logistic）。權重由電腦互打的大量對局校準（見 HINT_W），不是真實機率，只用來判斷「大勢已去」。
// 特徵都從 s 方的角度看：兵力價值（價值×血量比例）、帥血量比例、能過河的攻擊單位數、已過河的攻擊單位數、下一步彼此能打出的最大傷害價值。
function hintFeatures(s) {
  const o = 1 - s, me = alive().filter(p => p.s === s), foe = alive().filter(p => p.s === o);
  const mat = L => L.reduce((a, p) => p.t === 'K' ? a : a + unitValue(p) * Math.min(1, p.hp / p.T.hp), 0);
  const king = L => { const k = L.find(p => p.t === 'K'); return k ? k.hp / k.T.hp : 0; };
  const atk = L => L.filter(p => CROSSERS.includes(p.t)).length;
  const crs = L => L.filter(p => CROSSERS.includes(p.t) && crossed(p.s, p.y)).length;
  return { mat: [mat(me), mat(foe)], k: [king(me), king(foe)], atk: [atk(me), atk(foe)], cross: [crs(me), crs(foe)], hit: [Math.min(15, bestAttack(s).v), Math.min(15, bestAttack(o).v)] };
}
const sampleFeatures = hintFeatures;

// 權重：由電腦互打（難度 1～5 的各種組合，共約 1200 局、1.8 萬個局面）做 logistic 迴歸校準，順序為
// [常數, ln((我方兵力+1)/(對方兵力+1)), 帥血量比例差, 攻擊單位數差/4, 已過河攻擊單位數差/3, (我方最大攻擊價值−對方)/15]
// 驗證：模型說 2%～5% 的局面，實際贏的比例約 2%～6%。重新校準見 tools/selfplay.js、tools/fit_winrate.py。
const HINT_W = [0.12, 0.66, 0.78, 1.56, 0.52, 0.71];
const HINT_LIMIT = 0.05;      // 勝率低於這個值才提示
const HINT_MIN_TURNS = 8;     // 玩家至少下過幾個回合才檢查（開局變化大，不提示）
function hintFeatureVec(f) {
  return [1, Math.log((f.mat[0] + 1) / (f.mat[1] + 1)), f.k[0] - f.k[1], (f.atk[0] - f.atk[1]) / 4, (f.cross[0] - f.cross[1]) / 3, (f.hit[0] - f.hit[1]) / 15];
}
// 回傳 s 方的估計勝率 p（0～1）與理由（依對勝率的拖累程度排序，最多 3 條）
function winEstimate(s) {
  const f = hintFeatures(s), v = hintFeatureVec(f), r1 = n => Math.round(n * 10) / 10;
  const contrib = v.map((x, i) => x * HINT_W[i]);
  const p = 1 / (1 + Math.exp(-contrib.reduce((a, b) => a + b, 0)));
  const hp = L => { const k = alive().find(q => q.s === L && q.t === 'K'); return k ? k.hp : 0; };
  const why = [
    [contrib[1], `兵力價值 ${r1(f.mat[0])} 對 ${r1(f.mat[1])}，差距很大`],
    [contrib[2], `你的帥剩 ${+hp(s).toFixed(2)} 心，對方的帥有 ${+hp(1 - s).toFixed(2)} 心`],
    [contrib[3], `能過河攻擊的棋子你剩 ${f.atk[0]} 個，對方有 ${f.atk[1]} 個`],
    [contrib[4], `已過河的攻擊單位你有 ${f.cross[0]} 個，對方有 ${f.cross[1]} 個`],
    [contrib[5], `對方下一步的攻擊威脅遠高於你（你的最大攻擊價值 ${r1(f.hit[0])}，對方 ${r1(f.hit[1])}）`],
  ].filter(([c]) => c < -0.15).sort((a, b) => a[0] - b[0]).slice(0, 3).map(a => a[1]);
  return { p, why };
}

// ---- 提示：每局最多問一次；選「繼續下」後，只有勝率掉到 1% 以下才再問一次 ----
let hintAsked = 0, hintKey = null, hintLast = 1;
function hintReset() { hintAsked = 0; hintKey = null; hintLast = 1; if ($('surrOv')) $('surrOv').hidden = true; }
function hintTick() {
  if (mode !== 'ai' || winner !== null || state !== 'aim' || turn !== mySide || !$('surrOv').hidden) return;
  if (turnsPlayed[mySide] < HINT_MIN_TURNS || hintAsked >= 2) return;
  const k = turnsPlayed[0] + turnsPlayed[1]; if (k === hintKey) return; hintKey = k;   // 每個回合只估一次
  const e = winEstimate(mySide); hintLast = e.p;
  if (e.p >= HINT_LIMIT || (hintAsked === 1 && e.p >= 0.01)) return;
  hintAsked++;
  $('surrSub').textContent = `電腦估計你現在的勝率${e.p < 0.01 ? '不到 1%' : '約 ' + Math.round(e.p * 100) + '%'}（低於 ${HINT_LIMIT * 100}%）。理由：`;
  $('surrWhy').innerHTML = (e.why.length ? e.why : ['整體局面落後太多']).map(t => `<li>${t}</li>`).join('');
  $('surrOv').hidden = false;
}
$('surrNo').onclick = () => { $('surrOv').hidden = true; };
$('surrYes').onclick = () => {
  $('surrOv').hidden = true;
  if (resign(mySide, true)) { restart(); toast(`已認輸，開新的一局（${AI_LEVELS[aiLevel]}）`); }
};
