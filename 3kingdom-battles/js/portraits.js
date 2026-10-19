// ===== 武將頭像：依《三國演義》的外貌描寫，用 SVG 畫出人像與各種情緒 =====
// 畫風：現代審美的半寫實插畫。主角群畫得英挺好看；能力平平的部將與小兵畫得可愛一點；不畫搞笑表情。
(function (root) {

  // ---------- 外貌 ----------
  // skin 膚色；build 臉型（slim 清秀、normal、strong 方下巴、cute 圓臉大眼）；ear: 'long' 長耳垂（兩耳垂肩）
  // eye 眼形（narrow 細眼、phoenix 丹鳳眼、sharp 銳利、round、normal、cute）；brow 眉（silkworm 臥蠶眉、sword 劍眉、thin 細眉）
  // beard [樣式, 顏色]（xlong 髯長二尺、long 長髯、full 修整的絡腮、goatee 山羊鬍、short 短鬚、none）；stache 八字鬍
  // hat 冠帽（guan 進賢冠、zijin 三叉束髮紫金冠、scarf 頭巾、helmet 頭盔、lunjin 綸巾、topknot 髮髻）；robe 袍色；trim 領緣；armor 甲色
  // patch 眼罩；scar 疤；age 年紀紋路（1 淡、2 較明顯）；hair 髮色（預設黑）
  const LOOKS = {
    caocao: {
      skin: '#ecd0ad', build: 'slim', eye: 'narrow', brow: 'sword', beard: ['long', '#1d1712'], stache: true, hat: 'guan', hatColor: '#1c1c22', robe: '#3a2a56', trim: '#c9a24a', armor: null, age: 1,
      desc: '身長七尺，細眼長髯。', src: '第 1 回',
    },
    xiahoudun: {
      skin: '#dcb08a', build: 'strong', eye: 'sharp', brow: 'sword', beard: ['full', '#1a120c'], stache: true, hat: 'helmet', hatColor: '#3d5a86', robe: '#2b3f63', armor: '#5d6d86', patch: 'L',
      desc: '下邳之戰前（第 18 回）被曹性一箭射中左目，自此獨眼。', src: '第 18 回',
    },
    liubei: {
      skin: '#f5e2cb', build: 'slim', ear: 'long', eye: 'normal', brow: 'thin', beard: ['short', '#2a1e14'], stache: true, lips: '#c4594d', hat: 'guan', hatColor: '#2a2a2a', robe: '#c39a3e', trim: '#2f5f5a', armor: null,
      desc: '身長七尺五寸，兩耳垂肩，雙手過膝，目能自顧其耳，面如冠玉，唇若塗脂。', src: '第 1 回',
    },
    guanyu: {
      skin: '#b8604a', build: 'normal', eye: 'phoenix', brow: 'silkworm', beard: ['xlong', '#120d0a'], stache: true, lips: '#d0605a', hat: 'scarf', hatColor: '#2f7048', robe: '#2f7048', trim: '#cfae5a', armor: '#4a5a40',
      desc: '身長九尺，髯長二尺；面如重棗，唇若塗脂；丹鳳眼，臥蠶眉：相貌堂堂，威風凜凜。', src: '第 1 回',
    },
    xunyou: {
      skin: '#eed4b2', build: 'slim', eye: 'narrow', brow: 'thin', beard: ['goatee', '#3a3028'], stache: true, hat: 'lunjin', hatColor: '#2e3a4a', robe: '#4a5d78', trim: '#ddd5c2', armor: null, age: 1,
      desc: '演義沒有描寫外貌，依謀士形象繪製。', src: '—',
    },
    caobu: {
      skin: '#e2b994', build: 'cute', eye: 'cute', brow: 'thin', beard: ['none'], hat: 'helmet', hatColor: '#3d5a86', robe: '#2b3f63', armor: '#56688a',
      desc: '曹軍弓弩隊的部將。', src: '—',
    },
    gongbing: {
      skin: '#dcae86', build: 'cute', eye: 'cute', brow: 'thin', beard: ['none'], hat: 'topknot', hatColor: '#1c1712', robe: '#6b5a44', armor: null,
      desc: '操作攻城器械的工兵。', src: '—',
    },
    lubu: {
      skin: '#f2d6b4', build: 'slim', eye: 'sharp', brow: 'sword', beard: ['none'], hat: 'zijin', hatColor: '#d9b44a', robe: '#a8302a', trim: '#e8c060', armor: '#b98a42', beast: true,
      desc: '頭戴三叉束髮紫金冠，體掛西川紅錦百花袍，身披獸面吞頭連環鎧，腰繫勒甲玲瓏獅蠻帶。', src: '第 5 回',
    },
    zhangliao: {
      skin: '#e2b893', build: 'normal', eye: 'sharp', brow: 'sword', beard: ['short', '#1d150f'], stache: true, hat: 'helmet', hatColor: '#7a2a24', robe: '#8a2c24', armor: '#6f6050',
      desc: '演義沒有描寫外貌，依騎將形象繪製。', src: '—',
    },
    gaoshun: {
      skin: '#cfa07a', build: 'strong', eye: 'round', brow: 'sword', beard: ['full', '#16110c'], stache: true, hat: 'helmet', hatColor: '#3e3e40', robe: '#5a2a24', armor: '#4e4844', scar: true,
      desc: '演義沒有描寫外貌，依「陷陣營」統領的形象繪製。', src: '—',
    },
    chengong: {
      skin: '#e8caa6', build: 'slim', eye: 'narrow', brow: 'thin', beard: ['long', '#4a4038'], stache: true, hat: 'guan', hatColor: '#1e1e24', robe: '#5a3a3a', trim: '#d6caa8', armor: null, age: 2, hair: '#2a2420',
      desc: '演義沒有描寫外貌，依謀主形象繪製。', src: '—',
    },
    houcheng: {
      skin: '#dcac84', build: 'cute', eye: 'cute', brow: 'thin', beard: ['none'], hat: 'helmet', hatColor: '#6a3a2a', robe: '#7a3a2a', armor: '#5e4e3e',
      desc: '演義沒有描寫外貌。', src: '—',
    },
    songxian: {
      skin: '#e0b48c', build: 'cute', eye: 'cute', brow: 'thin', beard: ['goatee', '#2a1e14'], hat: 'helmet', hatColor: '#5a3a3a', robe: '#6a3030', armor: '#4e4444',
      desc: '演義沒有描寫外貌。', src: '—',
    },
    weixu: {
      skin: '#d6a47c', build: 'cute', eye: 'cute', brow: 'sword', beard: ['short', '#21170f'], hat: 'helmet', hatColor: '#4a2e26', robe: '#5e2a22', armor: '#58493e',
      desc: '演義沒有描寫外貌。', src: '—',
    },
  };

  // ---------- 情緒 ----------
  // 每位武將：default 是平常的樣子，其他是演義裡寫到的情緒（name 名稱、face 表情、quote 原文、src 出處）
  const MOODS = {
    caocao: {
      default: { name: '平常', face: 'neutral' },
      laugh: { name: '大笑', face: 'laugh', quote: '演義中曹操屢屢「大笑」，赤壁兵敗逃往華容道時仍三度大笑。', src: '第 50 回' },
      weep: { name: '泣送陳宮', face: 'weep', quote: '宮徑步下樓，左右牽之不住。操起身泣而送之。', src: '第 19 回' },
    },
    xiahoudun: {
      default: { name: '平常', face: 'stern' },
      rage: { name: '拔矢啖睛', face: 'pain', blood: true, quote: '惇大叫一聲，急用手拔箭，不想連眼珠拔出，乃大呼曰：「父精母血，不可棄也！」遂納於口內啖之。', src: '第 18 回' },
    },
    liubei: {
      default: { name: '平常', face: 'kind' },
      cry: { name: '放聲大哭', face: 'cry', quote: '演義中玄德每逢傷心處便「放聲大哭」，是最常哭的主角。', src: '多回' },
      cold: { name: '白門樓', face: 'cold', quote: '玄德曰：「公不見丁建陽、董卓之事乎？」布目視玄德曰：「是兒最無信者！」', src: '第 19 回' },
    },
    guanyu: {
      default: { name: '平常', face: 'calm' },
      rage: { name: '大怒', face: 'angry', quote: '演義中「雲長大怒」不下數十次，怒時丹鳳眼圓睜、臥蠶眉倒豎。', src: '多回' },
    },
    xunyou: {
      default: { name: '平常', face: 'kind' },
      plan: { name: '獻策', face: 'sly', quote: '「呂布勇而無謀，今三戰皆北，其銳氣衰矣。」力勸曹操決沂、泗之水灌城。', src: '第 19 回' },
    },
    caobu: { default: { name: '平常', face: 'stern' } },
    gongbing: { default: { name: '平常', face: 'neutral' } },
    lubu: {
      default: { name: '平常', face: 'proud' },
      rage: { name: '大怒', face: 'angry', quote: '演義中呂布動輒「大怒」：侯成私釀酒，布大怒，要將他推出斬首。', src: '第 19 回' },
      haggard: { name: '對鏡憔悴', face: 'haggard', quote: '布一日對鏡自照，驚曰：「吾被酒色傷矣！」', src: '第 19 回' },
      plead: { name: '白門樓求饒', face: 'fear', bound: true, quote: '布曰：「縛太急，乞緩之！」操曰：「縛虎不得不急。」', src: '第 19 回' },
    },
    zhangliao: {
      default: { name: '平常', face: 'stern' },
      defy: { name: '白門樓怒罵', face: 'shout', bound: true, quote: '遼曰：「可惜當日火不大，不曾燒死你這國賊！」', src: '第 19 回' },
    },
    gaoshun: {
      default: { name: '平常', face: 'stern' },
      silent: { name: '不答', face: 'silent', bound: true, quote: '操問高順：「汝有何言？」順不答。操怒，命斬之。', src: '第 19 回' },
    },
    chengong: {
      default: { name: '平常', face: 'neutral' },
      sigh: { name: '長嘆', face: 'sigh', quote: '呂布不用其計，陳宮屢屢嘆息：「吾等死無葬身之地矣！」', src: '第 19 回' },
      calm: { name: '從容就死', face: 'serene', bound: true, quote: '操曰：「公台如此奈何？」宮曰：「今日有死而已！」', src: '第 19 回' },
    },
    houcheng: {
      default: { name: '平常', face: 'neutral' },
      grudge: { name: '懷恨', face: 'resent', quote: '侯成私釀酒，布怒欲斬之，眾將苦告，打了五十背花。侯成由是懷恨，夜盜赤兔馬出城投曹。', src: '第 19 回' },
    },
    songxian: {
      default: { name: '平常', face: 'neutral' },
      plot: { name: '密謀', face: 'sly', quote: '宋憲、魏續趁呂布困睡，盜去方天畫戟，將他綁縛。', src: '第 19 回' },
    },
    weixu: {
      default: { name: '平常', face: 'neutral' },
      plot: { name: '密謀', face: 'sly', quote: '宋憲、魏續趁呂布困睡，盜去方天畫戟，將他綁縛。', src: '第 19 回' },
    },
  };

  // ---------- 繪圖 ----------
  const LINE = '#2a1a10';
  let uid = 0;
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  };
  const mix = (a, b, t) => {
    const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };

  // 表情：brow 眉的傾斜（正＝怒，負＝愁）；eye 眼；mouth 嘴；其他是附加效果
  const FACES = {
    neutral: { brow: 0, eye: 'open', mouth: 'line' },
    kind: { brow: -2, eye: 'soft', mouth: 'smile' },
    calm: { brow: 1, eye: 'half', mouth: 'line' },
    stern: { brow: 3, eye: 'open', mouth: 'tight' },
    proud: { brow: 2, eye: 'open', mouth: 'smirk' },
    laugh: { brow: -2, eye: 'joy', mouth: 'laugh' },
    weep: { brow: -6, eye: 'shut', mouth: 'frown', tears: 1 },
    pain: { brow: 8, eye: 'glare', mouth: 'shout', glow: '#c0301a' },
    cry: { brow: -8, eye: 'teary', mouth: 'wail', tears: 2 },
    cold: { brow: 1, eye: 'sideHalf', mouth: 'line' },
    angry: { brow: 8, eye: 'glare', mouth: 'grit', glow: '#c0301a' },
    sly: { brow: 2, eye: 'sideHalf', mouth: 'smirk' },
    haggard: { brow: -4, eye: 'tired', mouth: 'frown', pale: true, bags: true, strands: true },
    fear: { brow: -8, eye: 'wide', mouth: 'wobble', pale: true, sweat: true, strands: true },
    shout: { brow: 8, eye: 'glare', mouth: 'shout', glow: '#c0301a' },
    silent: { brow: 4, eye: 'down', mouth: 'tight' },
    sigh: { brow: -6, eye: 'half', mouth: 'o' },
    serene: { brow: -1, eye: 'shut', mouth: 'smile' },
    resent: { brow: 6, eye: 'side', mouth: 'frown', shadow: true },
  };

  // 臉型（中心 x=60）：眼睛高度、臉的外框
  const BUILD = {
    slim: { eyeY: 56, face: 'M41 46 C41 32 49 26 60 26 C71 26 79 32 79 46 L79.5 57 C79.2 66.5 76 74 70 79.6 C66 83.4 63 85.8 60 86.2 C57 85.8 54 83.4 50 79.6 C44 74 40.8 66.5 40.5 57 Z' },
    normal: { eyeY: 56, face: 'M40.5 46 C40.5 31.5 49 26 60 26 C71 26 79.5 31.5 79.5 46 L80 57 C79.5 67 76 75 69.5 80.5 C65.5 84 62.5 86.5 60 86.8 C57.5 86.5 54.5 84 50.5 80.5 C44 75 40.5 67 40 57 Z' },
    strong: { eyeY: 56, face: 'M40 46 C40 31 49 26 60 26 C71 26 80 31 80 46 L80.6 58 C80.3 68 78 76 72 81.5 C67.5 85 63.5 87 60 87.2 C56.5 87 52.5 85 48 81.5 C42 76 39.7 68 39.4 58 Z' },
    cute: { eyeY: 58, face: 'M40.5 48 C40.5 32 49 27 60 27 C71 27 79.5 32 79.5 48 L79.5 58 C79 70 71 80.5 60 84 C49 80.5 41 70 40.5 58 Z' },
  };
  // 眼形：w 寬、h 高、lift 外眼角上揚、ir 虹膜半徑
  const EYE = {
    normal: { w: 11, h: 3.2, lift: 0.6, ir: 2.8 },
    narrow: { w: 11, h: 2.5, lift: 0.8, ir: 2.4 },
    phoenix: { w: 11.5, h: 2.8, lift: 2.2, ir: 2.5 },
    sharp: { w: 11, h: 3.0, lift: 1.5, ir: 2.6 },
    round: { w: 10.5, h: 3.9, lift: 0.3, ir: 3.0 },
    cute: { w: 11.5, h: 4.6, lift: 0.4, ir: 3.6 },
  };

  function svg(genId, moodId, opts = {}) {
    const L = LOOKS[genId] || LOOKS.caobu;
    const M = (MOODS[genId] && MOODS[genId][moodId]) || (MOODS[genId] && MOODS[genId].default) || { face: 'neutral' };
    const F = FACES[M.face] || FACES.neutral;
    const B = BUILD[L.build] || BUILD.normal;
    const id = 'pt' + (++uid);
    const side = opts.side === 'def' ? 'def' : opts.side === 'att' ? 'att' : null;
    const bgA = side === 'def' ? '#7a3328' : side === 'att' ? '#2c4c80' : '#5a4630';
    const bgB = side === 'def' ? '#24100c' : side === 'att' ? '#0e1a2e' : '#221a12';
    let skin = L.skin; if (F.pale) skin = mix(skin, '#d8dde4', 0.25);
    const skinL = shade(skin, 0.12), skinD = shade(skin, -0.14), skinDD = shade(skin, -0.3);
    const hair = L.hair || '#17110c';
    const lip = L.lips || mix(skin, '#b8564a', 0.45);
    const ctx = { L, F, M, B, id, skin, skinL, skinD, skinDD, hair, lip };
    const o = [];
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="portrait" role="img" aria-label="${(opts.name || '')}${M.name && moodId && moodId !== 'default' ? '・' + M.name : ''}">`);
    o.push(`<defs>
      <radialGradient id="${id}b" cx="50%" cy="40%" r="72%"><stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/></radialGradient>
      <radialGradient id="${id}s" cx="38%" cy="34%" r="78%"><stop offset="0" stop-color="${skinL}"/><stop offset=".55" stop-color="${skin}"/><stop offset="1" stop-color="${skinD}"/></radialGradient>
      <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(L.robe, 0.12)}"/><stop offset="1" stop-color="${shade(L.robe, -0.35)}"/></linearGradient>
      <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(hair, 0.22)}"/><stop offset="1" stop-color="${hair}"/></linearGradient>
      <radialGradient id="${id}i" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#8a5a32"/><stop offset=".6" stop-color="#4a2c16"/><stop offset="1" stop-color="#1c0f06"/></radialGradient>
      <clipPath id="${id}c"><rect width="120" height="120" rx="10"/></clipPath>
      <clipPath id="${id}f"><path d="${B.face}"/></clipPath>
    </defs>`);
    o.push(`<g clip-path="url(#${id}c)"><rect width="120" height="120" fill="url(#${id}b)"/>`);
    // 頭後的光暈（輪廓光，讓人物和背景分開）
    o.push(`<circle cx="62" cy="54" r="40" fill="${F.glow || '#ffe2b0'}" opacity="${F.glow ? 0.22 : 0.1}"/>`);
    if (F.pale || F.shadow) o.push(`<rect width="120" height="120" fill="#0a0f1a" opacity=".22"/>`);

    // 人物整體放大，減少留白
    o.push(`<g transform="translate(60 63) scale(1.13) translate(-60 -60)">`);
    // 後髮
    if (L.hat === 'zijin') o.push(`<path d="M74 36 C84 38 90 48 89 64 C86 54 82 46 74 42 Z M76 38 C82 44 84 52 83 62" fill="#a8302a" stroke="${LINE}" stroke-width=".7"/>`); // 紫金冠後垂的紅纓
    if (L.hat !== 'helmet') o.push(`<path d="M38 54 C36 28 46 18 60 18 C74 18 84 28 82 54 C78 50 42 50 38 54 Z" fill="url(#${id}h)"/>`);
    o.push(body(ctx));
    // 脖子與下巴陰影
    o.push(`<path d="M52.5 76 L52.5 95 C56 98.5 64 98.5 67.5 95 L67.5 76 Z" fill="${skinD}"/><path d="M52.5 82 C56 88 64 88 67.5 82 L67.5 88 C64 92 56 92 52.5 88 Z" fill="${skinDD}" opacity=".45"/>`);
    // 耳朵
    o.push(ears(ctx));
    // 臉
    o.push(`<path d="${B.face}" fill="url(#${id}s)" stroke="${LINE}" stroke-width="1.1"/>`);
    o.push(`<g clip-path="url(#${id}f)">`);
    // 臉部明暗：右側（背光面）陰影、髮際陰影、顴骨紅暈
    o.push(`<path d="M68 26 C80 34 82 56 76 72 C72 80 66 86 60 88 L90 88 L90 26 Z" fill="${skinDD}" opacity=".18"/>`);
    o.push(`<ellipse cx="60" cy="38" rx="22" ry="7" fill="${skinDD}" opacity=".22"/>`);
    const blush = L.build === 'cute' ? 0.3 : 0.07;
    o.push(`<ellipse cx="47" cy="${B.eyeY + 9}" rx="5.5" ry="3" fill="#e0786a" opacity="${F.glow ? blush + 0.08 : blush}"/><ellipse cx="73" cy="${B.eyeY + 9}" rx="5.5" ry="3" fill="#e0786a" opacity="${F.glow ? blush + 0.08 : blush}"/>`);
    if (L.age) o.push(`<path d="M52 41 Q60 39.6 68 41${L.age > 1 ? ' M53.5 43.6 Q60 42.4 66.5 43.6' : ''}" fill="none" stroke="${skinDD}" stroke-width=".6" opacity=".45"/>`);
    if (L.build !== 'cute') o.push(`<path d="M44 66 C46 73 50 78 55 81.5 M76 66 C74 73 70 78 65 81.5" fill="none" stroke="${skinDD}" stroke-width=".7" opacity=".3"/>`);
    if (L.scar) o.push(`<path d="M73 47 L76.5 60" stroke="${shade(skin, -0.42)}" stroke-width="1" opacity=".7" stroke-linecap="round"/>`);
    if (F.bags) o.push(`<path d="M44.5 ${B.eyeY + 4} q6 2.4 11 0 M64.5 ${B.eyeY + 4} q6 2.4 11 0" fill="none" stroke="#6a5a7a" stroke-width=".9" opacity=".6"/>`);
    o.push(`</g>`);

    o.push(brows(ctx));
    o.push(eyes(ctx));
    o.push(nose(ctx));
    const [bs, bc] = L.beard || ['none'];
    if (bs !== 'none') o.push(beard(ctx, bs, bc));
    o.push(mouth(ctx));
    if (L.stache && bs !== 'none') o.push(`<path d="M60 71.2 C57 70.8 53.6 71.8 51.6 74.6 C54 73.6 57 73.3 60 72.8 C63 73.3 66 73.6 68.4 74.6 C66.4 71.8 63 70.8 60 71.2 Z" fill="${bc}"/>`);
    // 前髮、冠帽
    o.push(fringe(ctx));
    o.push(hat(ctx));
    if (F.strands) o.push(`<path d="M44 34 C42 42 43 50 46 56 M76 34 C78.5 42 78 49 75 54" fill="none" stroke="${hair}" stroke-width="1.1" stroke-linecap="round"/>`);

    // 眼罩（夏侯惇左目，畫面右側）；拔矢時改畫受傷流血
    const ex = 60 + 9.5;
    if (L.patch && !M.blood) o.push(`<path d="M41 47 L79 41.5" stroke="#1a120c" stroke-width="1.6"/><path d="M${ex - 6.5} ${B.eyeY - 3} C${ex - 5} ${B.eyeY - 6.5} ${ex + 5} ${B.eyeY - 6.5} ${ex + 6.5} ${B.eyeY - 3} C${ex + 6.5} ${B.eyeY + 4} ${ex + 2} ${B.eyeY + 6} ${ex} ${B.eyeY + 6} C${ex - 2} ${B.eyeY + 6} ${ex - 6.5} ${B.eyeY + 4} ${ex - 6.5} ${B.eyeY - 3} Z" fill="#241a12" stroke="${LINE}" stroke-width=".8"/><path d="M${ex - 4} ${B.eyeY - 3.5} C${ex - 2} ${B.eyeY - 5} ${ex + 2} ${B.eyeY - 5} ${ex + 4} ${B.eyeY - 3.5}" stroke="#5a4636" stroke-width=".7" fill="none"/>`);
    if (M.blood) o.push(`<path d="M${ex - 5.5} ${B.eyeY} Q${ex} ${B.eyeY + 2.2} ${ex + 5.5} ${B.eyeY - 1}" stroke="${LINE}" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="${ex}" cy="${B.eyeY + 0.5}" rx="6.5" ry="4.5" fill="#7a1010" opacity=".55"/><path d="M${ex - 2} ${B.eyeY + 3} C${ex - 3} ${B.eyeY + 10} ${ex - 1} ${B.eyeY + 16} ${ex - 1.5} ${B.eyeY + 22} C${ex} ${B.eyeY + 16} ${ex + 0.5} ${B.eyeY + 9} ${ex} ${B.eyeY + 3} Z" fill="#8e1414" opacity=".85"/>`);
    // 淚、汗（低調，不做成漫畫符號）
    if (F.tears) {
      o.push(`<path d="M${49 - 3} ${B.eyeY + 3} C${49 - 4.5} ${B.eyeY + 9} ${49 - 3.5} ${B.eyeY + 14} ${49 - 4} ${B.eyeY + 19}" fill="none" stroke="#cfe8ff" stroke-width="1.3" opacity=".8" stroke-linecap="round"/>`);
      if (F.tears > 1) o.push(`<path d="M${71 + 3} ${B.eyeY + 3} C${71 + 4.5} ${B.eyeY + 9} ${71 + 3.5} ${B.eyeY + 15} ${71 + 4} ${B.eyeY + 20}" fill="none" stroke="#cfe8ff" stroke-width="1.3" opacity=".8" stroke-linecap="round"/>`);
    }
    if (F.sweat) o.push(`<path d="M78.5 40 C80 43 80 45 78.5 46 C77 45 77 43 78.5 40 Z" fill="#dff1ff" opacity=".85"/>`);
    o.push(`</g>`);
    // 外框
    o.push(`</g><rect x=".75" y=".75" width="118.5" height="118.5" rx="10" fill="none" stroke="${opts.frame || '#e8c88a'}" stroke-width="1.5"/></svg>`);
    return o.join('');
  }

  function body({ L, M, id }) {
    const o = [];
    o.push(`<path d="M10 120 C12 104 28 95 46 92 L60 100 L74 92 C92 95 108 104 110 120 Z" fill="url(#${id}r)" stroke="${LINE}" stroke-width="1"/>`);
    if (L.armor) {
      const a = L.armor, aD = shade(a, -0.32), aL = shade(a, 0.25);
      o.push(`<defs><pattern id="${id}p" width="6" height="5" patternUnits="userSpaceOnUse"><path d="M0 0 Q3 4.6 6 0" fill="none" stroke="${aD}" stroke-width=".8"/><path d="M0 0.6 Q3 3.6 6 0.6" fill="none" stroke="${aL}" stroke-width=".4" opacity=".6"/></pattern>
        <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${aL}"/><stop offset="1" stop-color="${aD}"/></linearGradient></defs>`);
      o.push(`<path d="M16 120 C18 106 32 98 47 95 L60 102 L73 95 C88 98 102 106 104 120 Z" fill="url(#${id}a)" stroke="${LINE}" stroke-width=".9"/>`);
      o.push(`<path d="M16 120 C18 106 32 98 47 95 L60 102 L73 95 C88 98 102 106 104 120 Z" fill="url(#${id}p)"/>`);
      // 肩甲
      o.push(`<path d="M8 116 C10 101 22 93 38 92 C35 102 28 110 20 118 Z" fill="url(#${id}a)" stroke="${LINE}" stroke-width=".9"/><path d="M112 116 C110 101 98 93 82 92 C85 102 92 110 100 118 Z" fill="url(#${id}a)" stroke="${LINE}" stroke-width=".9"/>`);
      o.push(`<path d="M12 110 C16 100 26 95 36 94 M108 110 C104 100 94 95 84 94" stroke="${aL}" stroke-width=".8" fill="none" opacity=".7"/>`);
      if (L.beast) o.push(`<g transform="translate(60 111)"><circle r="7.5" fill="${shade(a, 0.2)}" stroke="${LINE}" stroke-width=".9"/><circle r="5.2" fill="none" stroke="${aD}" stroke-width=".8"/><path d="M-3.4 -1.4 l1.8 1.4 M3.4 -1.4 l-1.8 1.4" stroke="${LINE}" stroke-width="1.1" stroke-linecap="round"/><path d="M-3 3 q3 -2 6 0" fill="none" stroke="${LINE}" stroke-width=".9"/></g>`);
    }
    // 交領（內層白領＋外層領緣）
    const trim = L.trim || shade(L.robe, 0.35);
    o.push(`<path d="M47 91 L60 108 L73 91" fill="none" stroke="#efe6d4" stroke-width="5"/><path d="M45 92 L60 111 L75 92" fill="none" stroke="${trim}" stroke-width="3"/><path d="M45 92 L60 111 L75 92" fill="none" stroke="${LINE}" stroke-width=".7" opacity=".7"/>`);
    if (M.bound) o.push(`<path d="M8 93 Q60 107 112 93 M8 100 Q60 114 112 100" fill="none" stroke="#a88452" stroke-width="3.2"/><path d="M8 93 Q60 107 112 93 M8 100 Q60 114 112 100" fill="none" stroke="#6b4f2a" stroke-width=".9" stroke-dasharray="1.6 2.4"/>`);
    return o.join('');
  }

  function ears({ L, B, skin, skinD, skinDD }) {
    const y = B.eyeY;
    if (L.hat === 'helmet') return '';
    if (L.ear === 'long') // 長耳垂：自然拉長，不誇張
      return `<path d="M41.5 ${y - 4} C37 ${y - 5} 36.4 ${y + 1} 37.4 ${y + 6} C38 ${y + 11} 39.2 ${y + 15} 41.4 ${y + 16.5} C42.6 ${y + 13} 42.2 ${y + 7} 42.2 ${y + 3} Z" fill="${skin}" stroke="${LINE}" stroke-width=".9"/><path d="M78.5 ${y - 4} C83 ${y - 5} 83.6 ${y + 1} 82.6 ${y + 6} C82 ${y + 11} 80.8 ${y + 15} 78.6 ${y + 16.5} C77.4 ${y + 13} 77.8 ${y + 7} 77.8 ${y + 3} Z" fill="${skinD}" stroke="${LINE}" stroke-width=".9"/><path d="M39.4 ${y - 0.5} C38.8 ${y + 3} 39.2 ${y + 7} 40.4 ${y + 10} M80.6 ${y - 0.5} C81.2 ${y + 3} 80.8 ${y + 7} 79.6 ${y + 10}" stroke="${skinDD}" stroke-width=".6" fill="none"/>`;
    return `<path d="M41.5 ${y - 4} C36.5 ${y - 5} 35.5 ${y + 1} 37 ${y + 6} C38 ${y + 9} 40 ${y + 10} 42 ${y + 9} Z" fill="${skin}" stroke="${LINE}" stroke-width=".9"/><path d="M78.5 ${y - 4} C83.5 ${y - 5} 84.5 ${y + 1} 83 ${y + 6} C82 ${y + 9} 80 ${y + 10} 78 ${y + 9} Z" fill="${skinD}" stroke="${LINE}" stroke-width=".9"/><path d="M39.5 ${y - 1} C38.6 ${y + 2} 39 ${y + 5} 40.5 ${y + 6.5} M80.5 ${y - 1} C81.4 ${y + 2} 81 ${y + 5} 79.5 ${y + 6.5}" stroke="${skinDD}" stroke-width=".6" fill="none"/>`;
  }

  function brows({ L, F, B, hair }) {
    const t = F.brow;
    const th = L.brow === 'silkworm' ? 3.4 : L.brow === 'sword' ? 2.6 : 1.9;
    const arc = L.brow === 'silkworm' ? 2.4 : L.brow === 'thin' ? 1.4 : 0.6;
    const y0 = B.eyeY - 8.5 - (L.eye === 'phoenix' ? 0.6 : 0) + (L.build === 'cute' ? -0.5 : 0);
    const col = L.brow === 'thin' ? shade(hair, 0.12) : hair;
    const one = (cx, dir) => {
      const xi = cx - dir * 5, xo = cx + dir * 6.6;
      const yi = y0 + t * 0.42, yo = y0 - t * 0.12 - (L.brow === 'sword' ? 1.6 : 0.4);
      const mx = (xi + xo) / 2, my = (yi + yo) / 2 - arc;
      return `<path d="M${xi} ${yi - th / 2} Q${mx} ${my - th * 0.55} ${xo} ${yo} Q${mx} ${my + th * 0.55} ${xi} ${yi + th / 2} Z" fill="${col}"/>`;
    };
    return one(50.5, -1) + one(69.5, 1);
  }

  function eyes({ L, F, M, B, id, skin, skinDD, hair }) {
    const E = EYE[L.eye] || EYE.normal;
    const out = [];
    const y = B.eyeY;
    [[50.5, -1, 0], [69.5, 1, 1]].forEach(([cx, dir, k]) => {
      if (L.patch === 'L' && dir === 1) return; // 夏侯惇左目另外畫
      const w = E.w / 2, xi = cx - dir * w, xo = cx + dir * w;
      const yi = y + 0.4, yo = y - E.lift;
      const e = F.eye;
      // 閉眼類
      if (e === 'joy') { out.push(`<path d="M${xi} ${yi + 0.6} Q${cx} ${y - 3.6} ${xo} ${yo + 0.6}" fill="none" stroke="${LINE}" stroke-width="1.6" stroke-linecap="round"/><path d="M${cx - 3} ${y + 2.4} Q${cx} ${y + 3.2} ${cx + 3} ${y + 2.4}" stroke="${skinDD}" stroke-width=".6" fill="none"/>`); return; }
      if (e === 'shut') { out.push(`<path d="M${xi} ${yi - 0.6} Q${cx} ${y + 2.2} ${xo} ${yo - 0.2}" fill="none" stroke="${LINE}" stroke-width="1.5" stroke-linecap="round"/><path d="M${xo - dir * 1.2} ${yo + 0.2} l${dir * 1} 1.4 M${xo - dir * 3.2} ${yo + 1} l${dir * 0.7} 1.5" stroke="${LINE}" stroke-width=".8" stroke-linecap="round"/>`); return; }
      let h = E.h, ir = E.ir, px = 0, py = 0, lid = 0;
      if (e === 'soft') { h *= 0.85; py = 0.2; }
      if (e === 'glare') { h *= 0.9; ir *= 0.82; }
      if (e === 'wide') { h *= 1.3; ir *= 0.78; }
      if (e === 'teary') { h *= 0.95; }
      if (e === 'half') lid = 0.45;
      if (e === 'tired') { lid = 0.42; py = 0.5; }
      if (e === 'down') { lid = 0.5; py = 1.3; }
      if (e === 'side') px = 2;
      if (e === 'sideHalf') { px = -2; lid = 0.35; }
      const top = `M${xi} ${yi} C${cx - dir * w * 0.35} ${y - h * 1.35} ${cx + dir * w * 0.45} ${y - h * 1.3} ${xo} ${yo}`;
      const bot = `C${cx + dir * w * 0.4} ${y + h * 0.8} ${cx - dir * w * 0.35} ${y + h * 0.75} ${xi} ${yi}`;
      const cid = `${id}e${k}`;
      out.push(`<clipPath id="${cid}"><path d="${top} ${bot} Z"/></clipPath>`);
      out.push(`<path d="${top} ${bot} Z" fill="#f8f3ea"/>`);
      const ix = cx + px, iy = y - h * 0.12 + py;
      out.push(`<g clip-path="url(#${cid})"><circle cx="${ix}" cy="${iy}" r="${ir}" fill="url(#${id}i)"/><circle cx="${ix}" cy="${iy}" r="${ir * 0.45}" fill="#0c0603"/>`);
      out.push(`<path d="M${xi - 2} ${y - h * 2} L${xo + 2} ${y - h * 2} L${xo + 2} ${y - h * 0.4} Q${cx} ${y - h * 1.1} ${xi - 2} ${y - h * 0.4} Z" fill="#000" opacity=".12"/>`);
      // 眼瞼：從眼角拱到 lidY 的曲線，曲線以上蓋成皮膚
      const lidY = y - h * 1.3 + h * 2.1 * lid, ctrl = 2 * lidY - (yi + yo) / 2;
      const lidCurve = `M${xi} ${yi} Q${cx} ${ctrl} ${xo} ${yo}`;
      if (lid) out.push(`<path d="${lidCurve} L${xo} ${y - h * 2.2} L${xi} ${y - h * 2.2} Z" fill="${skin}"/>`);
      if (e === 'teary') out.push(`<path d="M${xi} ${y + h * 0.35} Q${cx} ${y + h * 0.95} ${xo} ${yo + h * 0.4}" stroke="#d6efff" stroke-width="1.4" fill="none" opacity=".9"/>`);
      out.push(`</g>`);
      // 上睫毛線（閉一半時畫在眼瞼位置）
      if (lid) out.push(`<path d="${lidCurve}" fill="none" stroke="${LINE}" stroke-width="1.7" stroke-linecap="round"/>`);
      else out.push(`<path d="${top}" fill="none" stroke="${LINE}" stroke-width="${L.eye === 'phoenix' || L.eye === 'sharp' ? 1.9 : 1.7}" stroke-linecap="round"/>`);
      // 眼尾、雙眼皮、下眼線
      if (L.eye === 'phoenix' || L.eye === 'sharp') out.push(`<path d="M${xo} ${yo} l${dir * 2.2} ${-(L.eye === 'phoenix' ? 1.6 : 0.8)}" stroke="${LINE}" stroke-width="1.2" stroke-linecap="round"/>`);
      if (!lid && L.eye !== 'narrow') out.push(`<path d="M${xi + dir * 1.5} ${y - h * 1.15} C${cx - dir * w * 0.2} ${y - h * 1.75} ${cx + dir * w * 0.45} ${y - h * 1.7} ${xo + dir * 0.4} ${yo - 1.4}" fill="none" stroke="${skinDD}" stroke-width=".6" opacity=".7"/>`);
      out.push(`<path d="M${xi + dir * 1} ${yi + 0.3} C${cx - dir * w * 0.2} ${y + h * 0.75} ${cx + dir * w * 0.4} ${y + h * 0.7} ${xo - dir * 0.8} ${yo + 0.6}" fill="none" stroke="${skinDD}" stroke-width=".55" opacity=".8"/>`);
      // 眼睛亮點
      if (lid < 0.4) out.push(`<circle cx="${ix - ir * 0.35}" cy="${iy - ir * 0.4}" r="${e === 'teary' ? 1.15 : 0.85}" fill="#fff"/><circle cx="${ix + ir * 0.4}" cy="${iy + ir * 0.3}" r=".4" fill="#fff" opacity=".8"/>`);
    });
    return out.join('');
  }

  function nose({ B, skinL, skinDD }) {
    const y = B.eyeY;
    return `<path d="M61.4 ${y + 1} C62.6 ${y + 5} 63.2 ${y + 8} 63 ${y + 10}" fill="none" stroke="${skinDD}" stroke-width=".8" opacity=".45" stroke-linecap="round"/>`
      + `<path d="M57.4 ${y + 10.8} C58.6 ${y + 12} 61.4 ${y + 12} 62.8 ${y + 10.6}" fill="none" stroke="${skinDD}" stroke-width="1" stroke-linecap="round" opacity=".85"/>`
      + `<ellipse cx="59.6" cy="${y + 9}" rx="1.4" ry=".9" fill="${skinL}" opacity=".7"/>`;
  }

  function mouth({ F, B, lip }) {
    const y = B.eyeY + 19 - (B === BUILD.cute ? 1.5 : 0);
    const lipD = shade(lip, -0.35);
    const lower = `<path d="M56.5 ${y + 0.6} Q60 ${y + 3} 63.5 ${y + 0.6} Z" fill="${lip}" opacity=".55"/>`;
    switch (F.mouth) {
      case 'smile': return `<path d="M54.6 ${y - 0.6} Q60 ${y + 3} 65.4 ${y - 0.6}" fill="none" stroke="${lipD}" stroke-width="1.2" stroke-linecap="round"/>` + `<path d="M56.8 ${y + 1.2} Q60 ${y + 3.4} 63.2 ${y + 1.2}" fill="none" stroke="${lip}" stroke-width="1" opacity=".6"/>`;
      case 'smirk': return `<path d="M55.2 ${y + 0.4} Q59.5 ${y + 1.8} 65 ${y - 1.4}" fill="none" stroke="${lipD}" stroke-width="1.2" stroke-linecap="round"/>` + lower;
      case 'laugh': return `<path d="M54 ${y - 1} Q60 ${y - 1.6} 66 ${y - 1} Q64.6 ${y + 5.4} 60 ${y + 6} Q55.4 ${y + 5.4} 54 ${y - 1} Z" fill="#5e2622" stroke="${lipD}" stroke-width=".8"/><path d="M55.2 ${y - 0.8} Q60 ${y - 1.3} 64.8 ${y - 0.8} L64.4 ${y + 1} Q60 ${y + 0.6} 55.6 ${y + 1} Z" fill="#f4eee4"/><path d="M57 ${y + 4.4} Q60 ${y + 3} 63 ${y + 4.4} Q60 ${y + 5.6} 57 ${y + 4.4} Z" fill="#c0605a"/>`;
      case 'frown': return `<path d="M55.4 ${y + 1.2} Q60 ${y - 0.8} 64.6 ${y + 1.2}" fill="none" stroke="${lipD}" stroke-width="1.2" stroke-linecap="round"/>`;
      case 'wail': return `<path d="M56 ${y + 0.6} Q60 ${y - 1.4} 64 ${y + 0.6} Q62.6 ${y + 4} 60 ${y + 4.2} Q57.4 ${y + 4} 56 ${y + 0.6} Z" fill="#4e1c18" stroke="${lipD}" stroke-width=".8"/>`;
      case 'shout': return `<path d="M54.4 ${y - 1.4} Q60 ${y - 2.4} 65.6 ${y - 1.4} Q64.2 ${y + 6.6} 60 ${y + 7.2} Q55.8 ${y + 6.6} 54.4 ${y - 1.4} Z" fill="#4a1614" stroke="${lipD}" stroke-width=".8"/><path d="M55.6 ${y - 1.1} Q60 ${y - 1.9} 64.4 ${y - 1.1} L64 ${y + 0.6} Q60 ${y + 0.1} 56 ${y + 0.6} Z" fill="#f2ece2"/>`;
      case 'grit': return `<path d="M54.8 ${y + 1} Q57 ${y - 0.6} 60 ${y - 0.4} Q63 ${y - 0.6} 65.2 ${y + 1}" fill="none" stroke="${lipD}" stroke-width="1.4" stroke-linecap="round"/>` + lower;
      case 'wobble': return `<path d="M55.6 ${y + 0.8} Q57.8 ${y - 0.6} 60 ${y + 0.2} Q62.2 ${y - 0.6} 64.4 ${y + 0.8} Q60 ${y + 3} 55.6 ${y + 0.8} Z" fill="#4e1c18" opacity=".85"/>`;
      case 'tight': return `<path d="M55.4 ${y} Q60 ${y + 0.6} 64.6 ${y}" fill="none" stroke="${lipD}" stroke-width="1.4" stroke-linecap="round"/>` + lower;
      case 'o': return `<ellipse cx="60" cy="${y + 0.8}" rx="1.9" ry="1.5" fill="#4e1c18"/>`;
      default: return `<path d="M55.2 ${y} Q60 ${y + 1.2} 64.8 ${y}" fill="none" stroke="${lipD}" stroke-width="1.1" stroke-linecap="round"/>` + lower;
    }
  }

  function beard({ id, B }, style, c) {
    const g = `${id}d`;
    const def = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c, 0.12)}"/><stop offset="1" stop-color="${shade(c, -0.25)}"/></linearGradient></defs>`;
    const hi = shade(c, 0.35);
    const strands = (pts) => `<path d="${pts}" fill="none" stroke="${hi}" stroke-width=".5" opacity=".55" stroke-linecap="round"/>`;
    switch (style) {
      case 'xlong': return def + `<path d="M43.5 63 C44.5 73 50 81.5 60 84.5 C70 81.5 75.5 73 76.5 63 C79.5 79 77 95 69.5 108 C66.5 114 63 119 60 124 C57 119 53.5 114 50.5 108 C43 95 40.5 79 43.5 63 Z" fill="url(#${g})"/>`
        + strands('M52 88 C54 100 56 110 59 121 M57 87 C58 100 59 110 60 122 M63 87 C62 100 61 110 60.5 122 M68 88 C66 100 64 110 61.5 120 M47 80 C49 92 52 102 55 112 M73 80 C71 92 68 102 65 112')
        + `<path d="M41.5 52 C41 60 42 66 44 70 M78.5 52 C79 60 78 66 76 70" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
      case 'long': return def + `<path d="M47.5 74 C50 81 55 84.6 60 85 C65 84.6 70 81 72.5 74 C73 85 69.5 96 63.5 105 C62 107.5 61 109.5 60 111 C59 109.5 58 107.5 56.5 105 C50.5 96 47 85 47.5 74 Z" fill="url(#${g})"/>`
        + strands('M55 86 C56.5 94 58 101 59.6 108 M60 86 L60 109 M65 86 C63.5 94 62 101 60.4 108')
        + `<path d="M42 54 C41.6 61 43 67 45.5 71 M78 54 C78.4 61 77 67 74.5 71" stroke="${c}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
      case 'full': return def + `<path d="M40.6 57 C41 67 45.5 76.5 52 81.6 C55 84 58 86.6 60 87.4 C62 86.6 65 84 68 81.6 C74.5 76.5 79 67 79.4 57 C78.6 64 76 69.5 71.5 72.5 C68.5 74.5 66 76.6 63.6 77.6 L56.4 77.6 C54 76.6 51.5 74.5 48.5 72.5 C44 69.5 41.4 64 40.6 57 Z" fill="url(#${g})"/>`
        + strands('M45 70 C47 75 50 79 53 81.5 M75 70 C73 75 70 79 67 81.5 M57 80 C58 83 59 85 60 86 M63 80 C62 83 61 85 60 86');
      case 'goatee': return def + `<path d="M57 ${B.eyeY + 23} C58.2 ${B.eyeY + 24.6} 61.8 ${B.eyeY + 24.6} 63 ${B.eyeY + 23} C63 ${B.eyeY + 29} 61.6 ${B.eyeY + 34} 60 ${B.eyeY + 37} C58.4 ${B.eyeY + 34} 57 ${B.eyeY + 29} 57 ${B.eyeY + 23} Z" fill="url(#${g})"/>`;
      case 'short': return def + `<path d="M55.6 ${B.eyeY + 23} C57.4 ${B.eyeY + 25} 62.6 ${B.eyeY + 25} 64.4 ${B.eyeY + 23} C64 ${B.eyeY + 27.5} 62 ${B.eyeY + 30} 60 ${B.eyeY + 31} C58 ${B.eyeY + 30} 56 ${B.eyeY + 27.5} 55.6 ${B.eyeY + 23} Z" fill="url(#${g})"/>`
        + `<path d="M44 70 C47 77 53 82 60 84 C67 82 73 77 76 70" fill="none" stroke="${c}" stroke-width="1.6" opacity=".18"/>`;
      default: return '';
    }
  }

  // 帽緣下露出的前髮與鬢角
  function fringe({ L, id, hair }) {
    if (L.hat === 'helmet') return `<path d="M42 46 C44 43 47 42 49 42 L46 48 Z M78 46 C76 43 73 42 71 42 L74 48 Z" fill="${hair}"/>`;
    const cute = L.build === 'cute';
    return `<path d="M40.4 50 C40 36 48 29.5 60 29.5 C72 29.5 80 36 79.6 50 C77 43 72 39.6 66 39 C64 41 61 42 58 41.6 C54 41 50 40.2 47 41 C44 43 41.8 46 40.4 50 Z" fill="url(#${id}h)"/>`
      + `<path d="M40.6 46 C39.8 50 40 54 41.2 57 L42.8 50 Z M79.4 46 C80.2 50 80 54 78.8 57 L77.2 50 Z" fill="${hair}"/>`
      + (cute ? `<path d="M50 39.6 C49 43 47.5 45 45.6 46.4 C49 46 51.6 43.6 52.6 40 Z M57 40.4 C56.6 43.4 55.4 45.4 53.6 46.8 C57 46.2 59 43.8 59.6 40.6 Z" fill="${hair}"/>` : '')
      + `<path d="M46 36 C51 33 56 32.4 61 33" fill="none" stroke="${shade(hair, 0.45)}" stroke-width=".8" opacity=".55" stroke-linecap="round"/>`;
  }

  function hat({ L, id }) {
    const c = L.hatColor || '#222', cD = shade(c, -0.35), cL = shade(c, 0.3);
    const gl = `<defs><linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cL}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${cD}"/></linearGradient></defs>`;
    switch (L.hat) {
      case 'guan': // 進賢冠：黑漆梁冠＋冠纓
        return gl + `<path d="M43 36 C43 28 50 24.5 60 24.5 C70 24.5 77 28 77 36 C71 33 66 32.4 60 32.4 C54 32.4 49 33 43 36 Z" fill="${hair2(L)}" stroke="${LINE}" stroke-width=".8"/>`
          + `<path d="M47.5 33 L49.5 13 C55 9 66 9 71.5 13.5 L72.5 32.4 C67 31.2 53 31.2 47.5 33 Z" fill="url(#${id}t)" stroke="${LINE}" stroke-width=".9"/>`
          + `<path d="M53.5 31.6 L55 12 M60 31.2 L60.6 10.4 M66.5 31.4 L66.8 11.6" stroke="${cL}" stroke-width=".7" opacity=".7"/>`
          + `<path d="M51 14 C51.5 20 51.6 26 51.4 31" stroke="#fff" stroke-width="1.2" opacity=".18" fill="none"/>`
          + `<path d="M43.5 36.4 C52 31.6 68 31.6 76.5 36.4" stroke="${L.trim || '#c9a24a'}" stroke-width="1.8" fill="none"/>`
          ;
      case 'zijin': // 三叉束髮紫金冠＋後垂紅纓（不畫戲曲雉翎）
        return gl + `<path d="M44 37 C44 29 51 25 60 25 C69 25 76 29 76 37 C70 34 66 33.4 60 33.4 C54 33.4 50 34 44 37 Z" fill="${hair2(L)}" stroke="${LINE}" stroke-width=".8"/>`
          + `<path d="M46 34 L47.5 22 L52.5 27 L60 11.5 L67.5 27 L72.5 22 L74 34 C66 31.6 54 31.6 46 34 Z" fill="url(#${id}t)" stroke="${LINE}" stroke-width=".9"/>`
          + `<path d="M48 31 C55 29.4 65 29.4 72 31" stroke="${cD}" stroke-width=".8" fill="none"/>`
          + `<circle cx="60" cy="25" r="2.6" fill="#7a3aa8" stroke="${LINE}" stroke-width=".6"/><circle cx="59.2" cy="24.2" r=".8" fill="#e6c8ff"/><circle cx="50.5" cy="29.4" r="1.4" fill="#7a3aa8"/><circle cx="69.5" cy="29.4" r="1.4" fill="#7a3aa8"/>`
          + `<path d="M60 11.5 L60 8.5" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/><path d="M53 28 C55 22 57 17 59 14" stroke="#fff" stroke-width=".9" opacity=".35" fill="none"/>`;
      case 'scarf': // 綠頭巾
        return gl + `<path d="M79 40 C87 46 90 58 88 74 C85 62 81 52 76 46 Z" fill="${shade(c, -0.18)}" stroke="${LINE}" stroke-width=".8"/>`
          + `<path d="M39 47 C37 27 48 20 60 20 C72 20 83 27 81 47 C74 40.5 67 38.6 60 38.6 C53 38.6 46 40.5 39 47 Z" fill="url(#${id}t)" stroke="${LINE}" stroke-width=".9"/>`
          + `<path d="M44 33 C50 28 60 26.6 70 28.6 M42 40 C50 34.6 66 33.4 77 37.6" stroke="${cD}" stroke-width=".8" fill="none" opacity=".8"/>`
          + `<path d="M59 21 C62 14 70 13 74 17 C69 17 66 19 64 23 Z" fill="${shade(c, -0.12)}" stroke="${LINE}" stroke-width=".8"/>`
          + `<path d="M47 26 C52 23 57 22 62 22" stroke="#fff" stroke-width="1" opacity=".22" fill="none"/>`;
      case 'helmet':
        return gl + `<path d="M35 54 C34 26 45 16 60 16 C75 16 86 26 85 54 L85 70 C83 73 80.5 73 79.5 71 L79 50 C73 44 67 42.4 60 42.4 C53 42.4 47 44 41 50 L40.5 71 C39.5 73 37 73 35 70 Z" fill="url(#${id}t)" stroke="${LINE}" stroke-width=".9"/>`
          + `<path d="M37 46 C46 39 74 39 83 46 L83 49.5 C74 42.6 46 42.6 37 49.5 Z" fill="${shade(c, 0.4)}" stroke="${LINE}" stroke-width=".7"/>`
          + `<path d="M60 16.5 L60 42" stroke="${cD}" stroke-width="1.3"/><path d="M45 24 C49 20 53 18.4 57 18" stroke="#fff" stroke-width="1.1" opacity=".25" fill="none"/>`
          + `<path d="M57.6 16.6 L60 7.5 L62.4 16.6 Z" fill="#c9a24a" stroke="${LINE}" stroke-width=".6"/><path d="M60 8 C58 9 56.5 11 56 13.5 C58 12 59 11.4 60 11 C61 11.4 62 12 64 13.5 C63.5 11 62 9 60 8 Z" fill="#b8342a"/>`;
      case 'lunjin': // 綸巾
        return gl + `<path d="M77 34 C86 40 90 50 90 62 C86 52 82 45 76 40 Z" fill="${shade(c, -0.15)}" stroke="${LINE}" stroke-width=".8"/>`
          + `<path d="M40 44 C38 25 49 19 60 19 C71 19 82 25 80 44 C73 37.6 67 36 60 36 C53 36 47 37.6 40 44 Z" fill="url(#${id}t)" stroke="${LINE}" stroke-width=".9"/>`
          + `<path d="M45 30 C52 26.4 68 26.4 75 30 M43 36 C51 31.6 69 31.6 77 36 M52 21 L50 35 M60 19.6 L60 34.6 M68 21 L70 35" stroke="${cL}" stroke-width=".6" fill="none" opacity=".75"/>`;
      case 'topknot':
        return `<ellipse cx="60" cy="22" rx="7" ry="6" fill="${hair2(L)}" stroke="${LINE}" stroke-width=".8"/><path d="M53.4 23.6 C57 25.4 63 25.4 66.6 23.6" stroke="#8a6a44" stroke-width="2" fill="none"/><path d="M56 19 C58 17.4 61 17.2 63 18" stroke="#fff" stroke-width=".8" opacity=".25" fill="none"/>`;
      default: return '';
    }
  }
  const hair2 = L => L.hair || '#17110c';

  // 取武將的情緒清單（default 在最前面）
  function moodsOf(genId) { const m = MOODS[genId] || { default: MOODS.caobu.default }; return Object.keys(m).map(k => ({ id: k, ...m[k] })); }
  function has(genId, moodId) { return !!(MOODS[genId] && MOODS[genId][moodId]); }

  // 有審核通過的 PNG（assets/portraits/characters.js）就用圖片，否則用 SVG；圖片載入失敗也退回 SVG
  function html(genId, moodId, opts = {}) {
    const A = root.PORTRAIT_ART, file = A && A.approvedFile(genId, moodId || 'default');
    if (!file) return svg(genId, moodId, opts);
    const alt = (opts.name || '') + (moodId && moodId !== 'default' && MOODS[genId] && MOODS[genId][moodId] ? '・' + MOODS[genId][moodId].name : '');
    const esc = v => String(v == null ? '' : v).replace(/"/g, '&quot;');
    return `<img class="portrait" src="${A.DIR}${file}" alt="${esc(alt)}" draggable="false" data-gen="${genId}" data-mood="${esc(moodId || 'default')}" data-side="${esc(opts.side)}" data-name="${esc(opts.name)}" data-frame="${esc(opts.frame)}" onerror="PORTRAITS.fallback(this)">`;
  }
  function fallback(img) {
    const d = img.dataset; img.outerHTML = svg(d.gen, d.mood, { side: d.side || null, name: d.name, frame: d.frame || undefined });
  }

  root.PORTRAITS = { LOOKS, MOODS, FACES, svg, html, fallback, moodsOf, has };
})(typeof window !== 'undefined' ? window : globalThis);
