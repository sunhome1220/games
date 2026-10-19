// ===== 插圖：開場、重大事件、結局的水墨風場景（SVG 程式繪製，不需要圖檔） =====
// 每張圖由元件組成：天色、遠山、霧、河、城牆城樓、營帳、軍隊、騎兵、火、大水、橋……
// 用法：SCENES.html('xiapi:intro')、SCENES.forEvent(劇本, 事件標題)、SCENES.forEnding(劇本, 結局)
(function (root) {
  const W = 800, H = 450;
  let uid = 0;
  function rng(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
  const f1 = n => Math.round(n * 10) / 10;

  // 天色：上、中、下三段漸層與光的顏色
  const SKY = {
    dawn: { s: ['#2a2b48', '#b8705a', '#f2c98c'], light: '#ffd9a0', ink: '#1d1a20', far: '#7c6a78', mid: '#4a3c46' },
    day: { s: ['#5f7f98', '#a9bcc0', '#e4dac0'], light: '#fff3d6', ink: '#1e2220', far: '#8d9a98', mid: '#56625c' },
    dusk: { s: ['#251b2a', '#82402f', '#df9c5c'], light: '#ffc27a', ink: '#170f10', far: '#6e4a48', mid: '#3e2a2a' },
    night: { s: ['#050911', '#141c30', '#2f3850'], light: '#d8e4ff', ink: '#05070c', far: '#2c3448', mid: '#161c2a' },
    storm: { s: ['#161b1f', '#323b3f', '#5d6563'], light: '#c8d2d0', ink: '#0e1112', far: '#4a5352', mid: '#262d2e' },
    gloom: { s: ['#2e3129', '#5d5c48', '#958f70'], light: '#e8dfb8', ink: '#181914', far: '#6a6a55', mid: '#3a3a2e' },
  };
  const BLUE = '#3b6fc4', RED = '#c8463a';

  // ---------- 元件 ----------
  // 起伏的山脊（填到底）
  function ridge(r, y, amp, color, op, rough = 1, blur) {
    const n = 26; let d = `M0 ${H} L0 ${f1(y)}`;
    let ph = r() * 10, ph2 = r() * 10;
    for (let i = 1; i <= n; i++) {
      const x = i / n * W;
      const h = Math.sin(i * 0.55 + ph) * amp * 0.6 + Math.sin(i * 1.7 + ph2) * amp * 0.3 * rough + (r() - 0.5) * amp * 0.25 * rough;
      d += ` L${f1(x)} ${f1(y - Math.abs(h) - amp * 0.2)}`;
    }
    return `<path d="${d} L${W} ${H} Z" fill="${color}" opacity="${op}"${blur ? ` filter="url(#${blur})"` : ''}/>`;
  }
  const mist = (id, y, h, op = 0.5, col = '#f2ead6') => `<rect x="0" y="${y}" width="${W}" height="${h}" fill="url(#${id}m)" opacity="${op}" style="color:${col}"/>`;
  function disc(x, y, rad, col, glow) {
    return `<circle cx="${x}" cy="${y}" r="${rad * 4}" fill="url(#${glow})"/><circle cx="${x}" cy="${y}" r="${rad}" fill="${col}"/>`;
  }
  // 河（帶狀，波紋）
  function river(r, y, h, col, line) {
    let d = `M0 ${y}`; for (let i = 1; i <= 16; i++) d += ` Q${f1((i - 0.5) / 16 * W)} ${f1(y + (r() - 0.5) * 8)} ${f1(i / 16 * W)} ${f1(y + (r() - 0.5) * 6)}`;
    d += ` L${W} ${y + h} L0 ${y + h} Z`;
    let o = `<path d="${d}" fill="${col}"/>`;
    for (let i = 0; i < 26; i++) { const x = r() * W, yy = y + 6 + r() * (h - 10), l = 20 + r() * 60; o += `<path d="M${f1(x)} ${f1(yy)} q${f1(l / 2)} ${f1(-2)} ${f1(l)} 0" stroke="${line}" stroke-width="1.2" fill="none" opacity="${f1(0.25 + r() * 0.35)}"/>`; }
    return o;
  }
  // 城牆（含垛口）
  function wall(x0, x1, y, h, col, hi) {
    let o = `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${h}" fill="${col}"/>`;
    for (let x = x0; x < x1 - 4; x += 12) o += `<rect x="${x}" y="${y - 6}" width="7" height="6" fill="${col}"/>`;
    if (hi) o += `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="2" fill="${hi}" opacity=".35"/>`;
    for (let i = 0; i < (x1 - x0) / 30; i++) o += `<path d="M${x0 + i * 30 + 6} ${y + h * 0.35} h14 M${x0 + i * 30 + 14} ${y + h * 0.7} h14" stroke="#000" stroke-opacity=".18" stroke-width="1"/>`;
    return o;
  }
  // 中式城樓（上翹的屋簷）
  function roof(x, y, w, col) {
    return `<path d="M${x - w} ${y} C${x - w * 0.75} ${y - 3} ${x - w * 0.55} ${y - 8} ${x - w * 0.45} ${y - w * 0.32} L${x + w * 0.45} ${y - w * 0.32} C${x + w * 0.55} ${y - 8} ${x + w * 0.75} ${y - 3} ${x + w} ${y} C${x + w * 0.85} ${y - 5} ${x + w * 0.75} ${y - 4} ${x + w * 0.7} ${y - 3} L${x - w * 0.7} ${y - 3} C${x - w * 0.75} ${y - 4} ${x - w * 0.85} ${y - 5} ${x - w} ${y} Z" fill="${col}"/>`;
  }
  function gateTower(x, y, s, col, opts = {}) {
    const b = s * 34, t = s * 26;
    let o = `<rect x="${x - b}" y="${y - s * 34}" width="${b * 2}" height="${s * 34}" fill="${col}"/>`;
    o += opts.open ? `<path d="M${x - s * 9} ${y} L${x - s * 9} ${y - s * 16} Q${x} ${y - s * 25} ${x + s * 9} ${y - s * 16} L${x + s * 9} ${y} Z" fill="${opts.glow || '#e8b066'}" opacity=".85"/>`
      : `<path d="M${x - s * 9} ${y} L${x - s * 9} ${y - s * 16} Q${x} ${y - s * 25} ${x + s * 9} ${y - s * 16} L${x + s * 9} ${y} Z" fill="#000" opacity=".45"/>`;
    o += `<rect x="${x - t}" y="${y - s * 58}" width="${t * 2}" height="${s * 24}" fill="${col}"/>`;
    for (let i = -2; i <= 2; i++) o += `<rect x="${x + i * s * 9 - s * 2.5}" y="${y - s * 52}" width="${s * 5}" height="${s * 10}" fill="${opts.lit ? '#f0b25c' : '#000'}" opacity="${opts.lit ? 0.8 : 0.35}"/>`;
    o += roof(x, y - s * 58, s * 44, col) + `<rect x="${x - t * 0.7}" y="${y - s * 76}" width="${t * 1.4}" height="${s * 12}" fill="${col}"/>` + roof(x, y - s * 76, s * 32, col);
    return o;
  }
  function tent(x, y, s, col, hi) {
    return `<path d="M${x - s * 16} ${y} L${x} ${y - s * 20} L${x + s * 16} ${y} Z" fill="${col}"/><path d="M${x} ${y - s * 20} L${x + s * 16} ${y} L${x + s * 3} ${y} Z" fill="#000" opacity=".25"/><path d="M${x} ${y - s * 20} l0 ${-s * 6}" stroke="${col}" stroke-width="${s * 1.2}"/>${hi ? `<path d="M${x - 2} ${y} L${x} ${y - s * 9} L${x + 2} ${y} Z" fill="${hi}" opacity=".8"/>` : ''}`;
  }
  function banner(x, y, s, pole, cloth, ch) {
    return `<path d="M${x} ${y} l0 ${-s * 46}" stroke="${pole}" stroke-width="${s * 1.6}"/><path d="M${x} ${y - s * 46} l${s * 18} ${s * 2} q${-s * 3} ${s * 8} ${s * 1} ${s * 16} l${-s * 19} ${-s * 1} Z" fill="${cloth}"/>${ch ? `<text x="${x + s * 9}" y="${y - s * 33}" font-size="${s * 11}" text-anchor="middle" fill="#f6ead0" font-weight="bold" font-family="'Noto Serif TC','Microsoft JhengHei',serif">${ch}</text>` : ''}`;
  }
  // 一列士兵剪影（盔、身、長槍），夾幾面旗
  function troops(r, x0, x1, y, s, col, opts = {}) {
    s *= 1.35;
    let o = ''; const n = Math.round((x1 - x0) / (9 * s));
    // 後排：小一點、淡一點，看起來人多
    if (!opts.single) { o += `<g opacity=".55" transform="translate(${f1(4 * s)} ${f1(-7 * s)})">`; for (let i = 0; i < n; i++) { const x = x0 + (i + 0.5) * (x1 - x0) / n, k = s * 0.85; o += `<circle cx="${f1(x)}" cy="${f1(y - 13 * k)}" r="${f1(2.4 * k)}" fill="${col}"/><path d="M${f1(x - 3.4 * k)} ${f1(y - 10.5 * k)} L${f1(x + 3.4 * k)} ${f1(y - 10.5 * k)} L${f1(x + 4.2 * k)} ${f1(y)} L${f1(x - 4.2 * k)} ${f1(y)} Z" fill="${col}"/>${opts.noSpear ? '' : `<path d="M${f1(x + 2 * k)} ${f1(y - 3 * k)} L${f1(x + (opts.lean || 5) * k)} ${f1(y - 26 * k)}" stroke="${col}" stroke-width="${f1(0.9 * k)}"/>`}`; } o += '</g>'; }
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (x1 - x0) / n + (r() - 0.5) * 3 * s, yy = y + (r() - 0.5) * 4 * s, k = s * (0.9 + r() * 0.2);
      o += `<circle cx="${f1(x)}" cy="${f1(yy - 13 * k)}" r="${f1(2.4 * k)}" fill="${col}"/><path d="M${f1(x - 3.4 * k)} ${f1(yy - 10.5 * k)} L${f1(x + 3.4 * k)} ${f1(yy - 10.5 * k)} L${f1(x + 4.2 * k)} ${f1(yy)} L${f1(x - 4.2 * k)} ${f1(yy)} Z" fill="${col}"/>`;
      if (!opts.noSpear) o += `<path d="M${f1(x + 2 * k)} ${f1(yy - 3 * k)} L${f1(x + (opts.lean || 5) * k)} ${f1(yy - 26 * k)}" stroke="${col}" stroke-width="${f1(0.9 * k)}"/>`;
    }
    for (const b of opts.banners || []) o += banner(x0 + (x1 - x0) * b.at, y, s * (b.s || 1), col, b.col, b.ch);
    return o;
  }
  // 戰馬與騎將（向右奔馳）；leap＝躍起
  function rider(x, y, s, col, opts = {}) {
    const fl = opts.flip ? -1 : 1, rot = opts.leap ? -18 : 0;
    const legs = opts.leap
      ? 'M24 -42 L48 -52 L62 -46 M20 -42 L40 -34 L52 -38 M-26 -44 L-52 -30 L-66 -30 M-22 -42 L-44 -26 L-58 -22'
      : 'M26 -40 L50 -26 L60 -12 M20 -40 L32 -20 L28 -4 M-26 -42 L-46 -26 L-60 -18 M-20 -40 L-28 -18 L-20 -4';
    return `<g transform="translate(${x} ${y}) scale(${fl * s} ${s}) rotate(${rot})" fill="${col}" stroke="${col}">
      <ellipse cx="0" cy="-50" rx="36" ry="14" stroke="none"/>
      <path d="M22 -58 C30 -70 38 -82 46 -88 L54 -86 C58 -80 66 -76 70 -70 L66 -64 C60 -66 54 -68 50 -70 C46 -62 40 -52 34 -46 Z" stroke="none"/>
      <path d="${legs}" fill="none" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-34 -54 C-52 -62 -66 -60 -76 -44 C-64 -52 -54 -52 -38 -48 Z" stroke="none"/>
      <path d="M-6 -60 L10 -60 L6 -88 L-6 -86 Z" stroke="none"/>
      <circle cx="1" cy="-95" r="7" stroke="none"/>
      <path d="M-2 -102 C-8 -112 -16 -114 -22 -110" fill="none" stroke-width="2.5"/>
      <path d="M-4 -84 C-22 -84 -36 -76 -46 -62 C-32 -70 -18 -72 -6 -70 Z" stroke="none" opacity=".85"/>
      <path d="M-34 -58 L${opts.spearUp ? '40 -132' : '78 -96'}" fill="none" stroke-width="3"/>
      ${opts.flag ? `<path d="M-34 -58 L-34 -128" stroke-width="2.5"/><path d="M-34 -128 l-26 4 q4 10 0 20 l26 -3 Z" fill="${opts.flag}" stroke="none"/>` : ''}
    </g>`;
  }
  // 火焰與濃煙
  function fire(r, x, y, s, id) {
    let o = `<ellipse cx="${x}" cy="${y - s * 10}" rx="${s * 70}" ry="${s * 50}" fill="url(#${id}fg)"/>`;
    for (let i = 0; i < 14; i++) {
      const fx = x + (r() - 0.5) * s * 60, h = s * (18 + r() * 34) * (i < 7 ? 1 : 0.6), w = s * (6 + r() * 8);
      o += `<path d="M${f1(fx - w)} ${y} C${f1(fx - w)} ${f1(y - h * 0.5)} ${f1(fx - w * 0.2)} ${f1(y - h * 0.7)} ${f1(fx + (r() - 0.5) * w)} ${f1(y - h)} C${f1(fx + w * 0.3)} ${f1(y - h * 0.6)} ${f1(fx + w)} ${f1(y - h * 0.5)} ${f1(fx + w)} ${y} Z" fill="url(#${id}fl)" opacity="${f1(0.7 + r() * 0.3)}"/>`;
    }
    for (let i = 0; i < 18; i++) o += `<circle cx="${f1(x + (r() - 0.5) * s * 90)}" cy="${f1(y - s * (30 + r() * 70))}" r="${f1(0.8 + r() * 1.4)}" fill="#ffd27a" opacity="${f1(0.5 + r() * 0.5)}"/>`;
    return o;
  }
  function smoke(r, x, y, s, col = '#2a2420', blur) {
    let o = `<g${blur ? ` filter="url(#${blur})"` : ''}>`; for (let i = 0; i < 9; i++) o += `<circle cx="${f1(x + (r() - 0.3) * s * 60 + i * s * 8)}" cy="${f1(y - i * s * 14 - r() * s * 10)}" r="${f1(s * (14 + i * 3))}" fill="${col}" opacity="${f1(0.18 + r() * 0.15)}"/>`;
    return o + '</g>';
  }
  function rain(r, op = 0.35) { let o = ''; for (let i = 0; i < 140; i++) { const x = r() * (W + 100), y = r() * H; o += `<path d="M${f1(x)} ${f1(y)} l-10 26" stroke="#cfd8d6" stroke-width="1" opacity="${f1(op * (0.5 + r()))}"/>`; } return o; }
  function crows(r, n, x0, y0, col = '#141210') { let o = ''; for (let i = 0; i < n; i++) { const x = x0 + r() * 220, y = y0 + r() * 70, s = 0.6 + r() * 0.8; o += `<path d="M${f1(x - 8 * s)} ${f1(y)} q${f1(4 * s)} ${f1(-5 * s)} ${f1(8 * s)} 0 q${f1(4 * s)} ${f1(-5 * s)} ${f1(8 * s)} 0" stroke="${col}" stroke-width="${f1(1.6 * s)}" fill="none"/>`; } return o; }
  // 木橋（broken＝中段斷開）
  function bridge(x, y, w, col, broken) {
    let o = '';
    const seg = (a, b) => { o += `<path d="M${a} ${y} Q${(a + b) / 2} ${y - 18} ${b} ${y}" stroke="${col}" stroke-width="7" fill="none"/>`; for (let px = a + 10; px < b - 4; px += 22) o += `<path d="M${px} ${y - 6} l0 34" stroke="${col}" stroke-width="5"/>`; };
    if (broken) { seg(x - w / 2, x - w * 0.12); seg(x + w * 0.12, x + w / 2); o += `<path d="M${x - w * 0.12} ${y} l8 14 M${x + w * 0.12} ${y} l-6 16" stroke="${col}" stroke-width="5"/>`; }
    else seg(x - w / 2, x + w / 2);
    return o;
  }
  // 半淹的房屋與樹
  function drowned(r, y, col) { let o = ''; for (let i = 0; i < 6; i++) { const x = 40 + r() * 720; o += `<path d="M${f1(x - 14)} ${y} l0 -10 l14 -10 l14 10 l0 10 Z" fill="${col}" opacity=".7"/>`; } return o; }
  // 前景的草葉（畫面下緣，增加景深）
  function grass(r, col) {
    let o = `<g opacity=".92">`;
    for (let i = 0; i < 90; i++) { const x = r() * W, h = 14 + r() * 34, b = (r() - 0.5) * 18; o += `<path d="M${f1(x - 2)} ${H} Q${f1(x + b * 0.3)} ${f1(H - h * 0.6)} ${f1(x + b)} ${f1(H - h)} Q${f1(x + b * 0.2 + 1)} ${f1(H - h * 0.5)} ${f1(x + 2)} ${H} Z" fill="${col}"/>`; }
    return o + '</g>';
  }
  function stamp(x, y, txt) {
    return `<g transform="translate(${x} ${y}) rotate(-4)"><rect x="-30" y="-30" width="60" height="60" rx="6" fill="#b3261e" opacity=".88"/><rect x="-25" y="-25" width="50" height="50" rx="4" fill="none" stroke="#f3dcc8" stroke-width="2" opacity=".85"/><text x="0" y="${txt.length > 1 ? -2 : 10}" font-size="${txt.length > 1 ? 21 : 30}" text-anchor="middle" fill="#f6e6d2" font-family="'Noto Serif TC','Microsoft JhengHei',serif" font-weight="bold">${txt[0]}</text>${txt.length > 1 ? `<text x="0" y="20" font-size="21" text-anchor="middle" fill="#f6e6d2" font-family="'Noto Serif TC','Microsoft JhengHei',serif" font-weight="bold">${txt[1]}</text>` : ''}</g>`;
  }

  // ---------- 畫布：天色＋紙紋＋暗角 ----------
  function canvas(sky, body, seal, alt) {
    const id = 'sc' + (++uid), S = SKY[sky] || SKY.day;
    const defs = `<defs>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${S.s[0]}"/><stop offset=".55" stop-color="${S.s[1]}"/><stop offset="1" stop-color="${S.s[2]}"/></linearGradient>
      <linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="0"/><stop offset=".5" stop-color="currentColor" stop-opacity=".9"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}g"><stop offset="0" stop-color="${S.light}" stop-opacity=".55"/><stop offset="1" stop-color="${S.light}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}fg"><stop offset="0" stop-color="#ffb347" stop-opacity=".6"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a12"/><stop offset=".6" stop-color="#ffb23a"/><stop offset="1" stop-color="#fff0b0"/></linearGradient>
      <radialGradient id="${id}v" cx="50%" cy="48%" r="70%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
      <filter id="${id}b1"><feGaussianBlur stdDeviation="2.5"/></filter>
      <filter id="${id}b2"><feGaussianBlur stdDeviation="1"/></filter>
      <filter id="${id}b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
      <filter id="${id}p" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .45  0 0 0 0 .3  0 0 0 .22 0"/></filter>
    </defs>`;
    return `<svg class="scene" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${alt || ''}">${defs}
      <rect width="${W}" height="${H}" fill="url(#${id}s)"/>${body(id, S)}${grass(rng(alt ? alt.length * 31 : 5), S.ink)}
      <rect width="${W}" height="${H}" filter="url(#${id}p)" opacity=".7"/><rect width="${W}" height="${H}" fill="url(#${id}v)"/>
      ${seal ? stamp(W - 52, 52, seal) : ''}</svg>`;
  }
  const back = (id, S, r, y = 250) => ridge(r, y - 40, 50, S.far, 0.55, 1, id + 'b1') + mist(id, y - 40, 70, 0.35) + ridge(r, y, 34, S.mid, 0.8, 1.2, id + 'b2');

  // ---------- 場景 ----------
  const SC = {
    // 下邳
    'xiapi:intro': () => canvas('dusk', (id, S) => { const r = rng(11); return disc(560, 150, 26, '#ffd08a', id + 'g') + back(id, S, r, 240) + river(r, 285, 50, '#3a4a52', '#c9b48a') + wall(380, 760, 228, 40, S.ink, '#ffb070') + gateTower(570, 270, 1.15, S.ink, { lit: true }) + ridge(r, 402, 6, S.ink, 1, 0.3) + troops(r, 30, 330, 398, 1.6, S.ink, { banners: [{ at: 0.2, col: BLUE, ch: '曹' }, { at: 0.65, col: BLUE, ch: '劉' }] }) + rider(700, 400, 0.75, S.ink, { flip: true, flag: RED }); }, '下', '曹軍兵臨下邳城下'),
    'xiapi:dig': () => canvas('night', (id, S) => { const r = rng(21); return disc(640, 90, 16, '#e8eeff', id + 'g') + back(id, S, r, 230) + river(r, 270, 90, '#1f2c40', '#9fb2d4') + `<path d="M0 300 C200 285 420 300 800 286 L800 330 C500 340 300 322 0 336 Z" fill="${S.mid}"/>` + troops(r, 120, 520, 318, 1.5, S.ink, { lean: -2 }) + `<circle cx="180" cy="300" r="5" fill="#ffcf7a"/><circle cx="180" cy="300" r="22" fill="url(#${id}g)"/><circle cx="430" cy="302" r="5" fill="#ffcf7a"/><circle cx="430" cy="302" r="22" fill="url(#${id}g)"/>` + ridge(r, 410, 12, S.ink, 1, 0.4); }, '掘', '夜裡掘開泗水河堤'),
    'xiapi:flood': () => canvas('storm', (id, S) => { const r = rng(31); return back(id, S, r, 220) + wall(220, 640, 230, 36, S.ink) + gateTower(430, 266, 1, S.ink) + `<rect x="0" y="262" width="${W}" height="190" fill="#34484c"/>` + river(r, 258, 200, '#3d5458', '#b9c9c4') + drowned(r, 330, S.ink) + rain(r, 0.45); }, '淹', '大水灌入下邳城下'),
    'xiapi:recede': () => canvas('gloom', (id, S) => { const r = rng(41); return back(id, S, r, 230) + wall(260, 620, 236, 34, S.ink) + gateTower(440, 270, 0.95, S.ink) + `<rect x="0" y="270" width="${W}" height="180" fill="#5e5038"/>` + river(r, 330, 30, '#4e5a52', '#c8c0a0') + river(r, 390, 20, '#4e5a52', '#c8c0a0') + crows(r, 6, 120, 70); }, '泥', '大水退去，城外一片泥濘'),
    'xiapi:depot': () => canvas('night', (id, S) => { const r = rng(51); return back(id, S, r, 220) + ridge(r, 330, 10, S.ink, 1, 0.3) + tent(240, 330, 3, '#2a2420', '#ff9a40') + tent(380, 335, 3.4, '#2a2420', '#ff9a40') + tent(520, 330, 2.8, '#2a2420') + smoke(r, 330, 240, 2, undefined, id + 'b3') + fire(r, 300, 335, 2.2, id) + fire(r, 470, 338, 1.8, id) + rider(120, 345, 0.8, S.ink, { flag: RED }) + rider(680, 340, 0.7, S.ink, { flag: RED, flip: true }); }, '火', '突入曹軍糧營放火'),
    'xiapi:betray': () => canvas('dawn', (id, S) => { const r = rng(61); return disc(400, 170, 30, '#ffe0a0', id + 'g') + back(id, S, r, 230) + wall(120, 680, 240, 60, S.ink, '#ffcf8a') + gateTower(400, 300, 1.4, S.ink, { open: true, glow: '#ffd890' }) + banner(300, 238, 1.2, S.ink, '#e8e2d2') + banner(500, 238, 1.2, S.ink, '#e8e2d2') + ridge(r, 400, 10, S.ink, 1, 0.3) + troops(r, 330, 470, 405, 1.3, S.ink, { noSpear: true }); }, '降', '西門打開，城內將領倒戈'),
    'xiapi:history': () => canvas('dusk', (id, S) => { const r = rng(71); return disc(200, 140, 22, '#ffc27a', id + 'g') + back(id, S, r, 250) + wall(150, 700, 250, 70, S.ink, '#ffb070') + gateTower(430, 320, 1.6, S.ink, { lit: true }) + `<path d="M430 140 l0 60" stroke="#e8d8b0" stroke-width="2" opacity=".8"/>` + crows(r, 9, 520, 60) + ridge(r, 420, 8, S.ink, 1, 0.2); }, '白', '白門樓'),
    'xiapi:storm': () => canvas('day', (id, S) => { const r = rng(81); return back(id, S, r, 220) + wall(150, 700, 230, 60, S.ink) + gateTower(430, 290, 1.3, S.ink, { open: true, glow: '#ff9a50' }) + smoke(r, 330, 200, 1.8, undefined, id + 'b3') + fire(r, 560, 235, 1.2, id) + ridge(r, 404, 6, S.ink, 1, 0.3) + troops(r, 40, 760, 400, 1.6, S.ink, { banners: [{ at: 0.3, col: BLUE, ch: '曹' }, { at: 0.7, col: BLUE, ch: '夏' }] }); }, '破', '曹軍攻破下邳'),
    'xiapi:field': () => canvas('day', (id, S) => { const r = rng(91); return back(id, S, r, 240) + river(r, 290, 40, '#5a6e70', '#e0d6b8') + ridge(r, 404, 6, S.ink, 1, 0.3) + banner(380, 398, 1.6, S.ink, RED, '呂') + `<path d="M330 402 l120 -4" stroke="${S.ink}" stroke-width="6"/>` + troops(r, 40, 300, 400, 1.6, S.ink, { banners: [{ at: 0.4, col: BLUE, ch: '曹' }] }) + rider(620, 420, 0.9, S.ink, { flip: true, flag: BLUE }); }, '擒', '野戰擒呂布'),
    'xiapi:supply': () => canvas('dusk', (id, S) => { const r = rng(101); return disc(640, 170, 26, '#ffc27a', id + 'g') + back(id, S, r, 250) + `<path d="M0 360 C240 330 520 330 800 300 L800 320 C520 350 240 352 0 384 Z" fill="#6e5636"/>` + troops(r, 80, 640, 345, 1.1, S.ink, { lean: -4, banners: [{ at: 0.5, col: BLUE, ch: '曹' }] }) + ridge(r, 420, 10, S.ink, 1, 0.3); }, '退', '曹軍糧盡退兵'),
    'xiapi:jijiao': () => canvas('night', (id, S) => { const r = rng(111); return disc(160, 90, 15, '#e8eeff', id + 'g') + back(id, S, r, 230) + wall(420, 780, 230, 40, S.ink) + gateTower(600, 270, 1, S.ink, { lit: true }) + ridge(r, 380, 12, S.ink, 1, 0.4) + rider(150, 400, 0.85, S.ink, { flag: RED }) + rider(300, 410, 0.75, S.ink, { flag: RED }); }, '角', '掎角之計'),
    'xiapi:caodown': () => canvas('dusk', (id, S) => { const r = rng(121); return back(id, S, r, 240) + smoke(r, 500, 260, 2, undefined, id + 'b3') + ridge(r, 370, 14, S.ink, 1, 0.5) + `<g transform="rotate(-62 360 400)">${banner(360, 400, 1.6, S.ink, BLUE, '曹')}</g>` + rider(600, 420, 0.95, S.ink, { flip: true, flag: RED, spearUp: true }); }, '敗', '曹操兵敗'),
    'xiapi:rout': () => canvas('dusk', (id, S) => { const r = rng(131); return back(id, S, r, 240) + smoke(r, 300, 260, 2.2, undefined, id + 'b3') + ridge(r, 370, 14, S.ink, 1, 0.5) + `<g transform="rotate(-70 300 400)">${banner(300, 400, 1.5, S.ink, BLUE, '曹')}</g><g transform="rotate(50 460 410)">${banner(460, 410, 1.3, S.ink, BLUE)}</g>`; }, '潰', '曹軍潰敗'),
    // 合肥
    'hefei:intro': () => canvas('dawn', (id, S) => { const r = rng(201); return disc(560, 210, 34, '#ffe2a8', id + 'g') + back(id, S, r, 250) + wall(20, 260, 228, 38, S.ink, '#ffd08a') + gateTower(150, 266, 1, S.ink) + mist(id, 260, 80, 0.55) + tent(470, 330, 2.4, S.mid, '#ffb060') + tent(580, 326, 2.8, S.mid) + tent(690, 332, 2.2, S.mid) + banner(520, 330, 1.2, S.mid, RED, '孫') + ridge(r, 390, 12, S.ink, 1, 0.4) + rider(260, 425, 1.05, S.ink, { flag: BLUE }) + rider(130, 420, 0.75, S.ink) + rider(370, 430, 0.7, S.ink); }, '合', '張遼天亮突襲吳營'),
    'hefei:plague': () => canvas('gloom', (id, S) => { const r = rng(211); return back(id, S, r, 240) + mist(id, 230, 120, 0.7, '#d8d4b8') + tent(240, 340, 2.6, S.mid) + tent(400, 345, 3, S.mid) + tent(560, 338, 2.4, S.mid) + banner(470, 345, 1.1, S.mid, RED) + ridge(r, 400, 8, S.ink, 1, 0.3) + crows(r, 10, 280, 80) + mist(id, 330, 90, 0.5, '#cfcbb0'); }, '疫', '吳軍營中疫病流行'),
    'hefei:retreat': () => canvas('dusk', (id, S) => { const r = rng(221); return disc(220, 170, 24, '#ffc27a', id + 'g') + back(id, S, r, 250) + river(r, 330, 60, '#2f4a48', '#d6b88a') + bridge(560, 330, 260, S.ink) + troops(r, 440, 680, 322, 0.9, S.ink, { lean: 8, banners: [{ at: 0.5, col: RED, ch: '吳' }] }) + ridge(r, 420, 8, S.ink, 1, 0.3); }, '撤', '孫權下令撤軍'),
    'hefei:bridge': () => canvas('dusk', (id, S) => { const r = rng(231); return disc(640, 150, 24, '#ffc27a', id + 'g') + back(id, S, r, 240) + river(r, 300, 160, '#2b4644', '#d8bc8c') + bridge(400, 320, 420, S.ink, true) + rider(400, 300, 1.05, S.ink, { leap: true, flag: RED }) + troops(r, 40, 170, 330, 1.1, S.ink, { banners: [{ at: 0.5, col: BLUE, ch: '張' }] }) + troops(r, 600, 760, 330, 1.0, S.ink, { banners: [{ at: 0.4, col: RED, ch: '凌' }] }); }, '津', '逍遙津斷橋，孫權躍馬'),
    'hefei:camp': () => canvas('dawn', (id, S) => { const r = rng(241); return back(id, S, r, 240) + tent(260, 340, 3, '#2a2420', '#ff9a40') + tent(420, 344, 3.4, '#2a2420') + tent(580, 338, 2.8, '#2a2420', '#ff9a40') + smoke(r, 380, 240, 2, undefined, id + 'b3') + fire(r, 340, 344, 2.1, id) + fire(r, 540, 342, 1.6, id) + rider(140, 425, 0.85, S.ink, { flag: BLUE }); }, '火', '火燒吳營'),
    'hefei:history': () => canvas('dusk', (id, S) => { const r = rng(251); return disc(180, 150, 26, '#ffc27a', id + 'g') + back(id, S, r, 240) + river(r, 300, 160, '#2b4644', '#d8bc8c') + bridge(430, 320, 420, S.ink, true) + rider(440, 300, 1.05, S.ink, { leap: true }) + rider(110, 430, 0.95, S.ink, { flag: BLUE, spearUp: true }); }, '遼', '威震逍遙津'),
    'hefei:raid': () => canvas('dawn', (id, S) => { const r = rng(261); return disc(600, 200, 30, '#ffe2a8', id + 'g') + back(id, S, r, 250) + `<path d="M480 380 Q600 300 720 380 Z" fill="${S.mid}"/>` + `<g transform="rotate(-55 600 340)">${banner(600, 340, 1.4, S.ink, RED, '孫')}</g>` + ridge(r, 412, 5, S.ink, 1, 0.3) + rider(330, 418, 1.15, S.ink, { flag: BLUE, spearUp: true }) + troops(r, 40, 220, 408, 1.4, S.ink, { banners: [{ at: 0.5, col: BLUE, ch: '李' }] }); }, '破', '八百破十萬'),
    'hefei:capture': () => canvas('dusk', (id, S) => { const r = rng(271); return back(id, S, r, 240) + river(r, 300, 150, '#2b4644', '#d8bc8c') + bridge(420, 320, 400, S.ink, true) + `<g transform="rotate(-60 560 330)">${banner(560, 330, 1.3, S.ink, RED, '孫')}</g>` + rider(300, 330, 1, S.ink, { flag: BLUE, spearUp: true }) + troops(r, 40, 200, 330, 1.1, S.ink); }, '擒', '生擒孫權'),
    'hefei:storm': () => canvas('day', (id, S) => { const r = rng(281); return back(id, S, r, 220) + wall(120, 700, 230, 60, S.ink) + gateTower(410, 290, 1.3, S.ink, { open: true, glow: '#ff9a50' }) + banner(260, 228, 1.2, S.ink, RED, '吳') + banner(560, 228, 1.2, S.ink, RED, '孫') + smoke(r, 300, 210, 1.6, undefined, id + 'b3') + ridge(r, 404, 6, S.ink, 1, 0.3) + troops(r, 40, 760, 400, 1.6, S.ink, { banners: [{ at: 0.35, col: RED, ch: '呂' }, { at: 0.7, col: RED, ch: '甘' }] }); }, '陷', '攻陷合肥'),
    'hefei:rout': () => canvas('dusk', (id, S) => { const r = rng(291); return back(id, S, r, 240) + smoke(r, 380, 250, 2.2, undefined, id + 'b3') + ridge(r, 370, 14, S.ink, 1, 0.5) + `<g transform="rotate(-70 320 400)">${banner(320, 400, 1.5, S.ink, RED, '吳')}</g>` + rider(600, 420, 0.95, S.ink, { flip: true, flag: BLUE, spearUp: true }); }, '潰', '吳軍潰敗'),
  };
  // 事件標題 → 場景
  const EVENT = {
    '下邳之戰': 'xiapi:intro', '荀攸、郭嘉獻策': 'xiapi:dig', '水淹下邳': 'xiapi:flood', '大水退去': 'xiapi:recede', '火燒糧營': 'xiapi:depot', '侯成、宋憲、魏續倒戈': 'xiapi:betray',
    '合肥之戰': 'hefei:intro', '吳軍疫病': 'hefei:plague', '孫權撤軍': 'hefei:retreat', '逍遙津斷橋': 'hefei:bridge', '火燒吳營': 'hefei:camp',
  };
  // 結局：xiapi 的 supply、jijiao 共用退兵圖；沒有專屬圖的用潰敗圖
  const ENDING = { 'xiapi:supply': 'xiapi:supply', 'xiapi:jijiao': 'xiapi:jijiao' };
  // 每次重畫（id 不重複，同一頁同時出現兩張也不會互相干擾）
  function html(key) { return SC[key] ? SC[key]() : ''; }
  const forEvent = (sc, title) => html(EVENT[title] || '');
  const forEnding = (sc, route) => html(ENDING[sc + ':' + route] || sc + ':' + route) || html(sc + ':rout');
  const intro = sc => html(sc + ':intro');
  root.SCENES = { html, forEvent, forEnding, intro, keys: () => Object.keys(SC), EVENT };
})(typeof window !== 'undefined' ? window : globalThis);
