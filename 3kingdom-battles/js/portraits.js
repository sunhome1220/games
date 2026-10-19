// ===== 武將頭像：依《三國演義》的外貌描寫，用 SVG 畫出人像與各種情緒 =====
(function (root) {

  // ---------- 外貌 ----------
  // skin 膚色；ear 耳朵（big＝兩耳垂肩）；eye 眼形（narrow 細眼、phoenix 丹鳳眼、round、normal）；brow 眉（silkworm 臥蠶眉、sword 劍眉、thin）
  // beard 鬍鬚 [樣式, 顏色]（long 長髯、xlong 髯長二尺、full 絡腮、goatee 山羊鬍、short 短鬚、none）；stache 八字鬍
  // hat 冠帽（guan 進賢冠、zijin 三叉束髮紫金冠、scarf 頭巾、helmet 頭盔、lunjin 綸巾、topknot 髮髻）；robe 袍色；armor 甲色；patch 眼罩
  const LOOKS = {
    caocao: {
      skin: '#e9c9a2', eye: 'narrow', brow: 'sword', beard: ['long', '#1d1712'], stache: true, hat: 'guan', hatColor: '#1c1c22', robe: '#3a2a56', trim: '#c9a24a', armor: null, age: 1,
      desc: '身長七尺，細眼長髯。', src: '第 1 回',
    },
    xiahoudun: {
      skin: '#d9a77c', eye: 'round', brow: 'sword', beard: ['full', '#1a120c'], stache: true, hat: 'helmet', hatColor: '#3d5a86', robe: '#2b3f63', armor: '#55657e', patch: 'L',
      desc: '下邳之戰前（第 18 回）被曹性一箭射中左目，自此獨眼。', src: '第 18 回',
    },
    liubei: {
      skin: '#f6e3cc', ear: 'big', eye: 'normal', brow: 'thin', beard: ['short', '#2a1e14'], stache: true, lips: '#c8423a', hat: 'guan', hatColor: '#2a2a2a', robe: '#c9a23a', trim: '#6b4a1a', armor: null,
      desc: '身長七尺五寸，兩耳垂肩，雙手過膝，目能自顧其耳，面如冠玉，唇若塗脂。', src: '第 1 回',
    },
    guanyu: {
      skin: '#a8402c', eye: 'phoenix', brow: 'silkworm', beard: ['xlong', '#120d0a'], stache: true, lips: '#e0584a', hat: 'scarf', hatColor: '#2f7a46', robe: '#2f7a46', trim: '#d7b65a', armor: '#3b5a3c',
      desc: '身長九尺，髯長二尺；面如重棗，唇若塗脂；丹鳳眼，臥蠶眉：相貌堂堂，威風凜凜。', src: '第 1 回',
    },
    xunyou: {
      skin: '#ecd0ac', eye: 'narrow', brow: 'thin', beard: ['goatee', '#3a3028'], stache: true, hat: 'lunjin', hatColor: '#2e3a4a', robe: '#4a5d78', trim: '#d9d2c0', armor: null, age: 1,
      desc: '演義沒有描寫外貌，依謀士形象繪製。', src: '—',
    },
    caobu: {
      skin: '#d8ad84', eye: 'normal', brow: 'sword', beard: ['short', '#2a1e14'], stache: true, hat: 'helmet', hatColor: '#3d5a86', robe: '#2b3f63', armor: '#4f5f78',
      desc: '曹軍弓弩隊的部將。', src: '—',
    },
    gongbing: {
      skin: '#cf9f74', eye: 'normal', brow: 'thin', beard: ['none'], hat: 'topknot', hatColor: '#1c1712', robe: '#6b5a44', armor: null,
      desc: '操作攻城器械的工兵。', src: '—',
    },
    lubu: {
      skin: '#f0d2ae', eye: 'sharp', brow: 'sword', beard: ['none'], hat: 'zijin', hatColor: '#d9b44a', robe: '#b8322a', trim: '#f0c860', armor: '#c08a3a', beast: true,
      desc: '頭戴三叉束髮紫金冠，體掛西川紅錦百花袍，身披獸面吞頭連環鎧，腰繫勒甲玲瓏獅蠻帶。', src: '第 5 回',
    },
    zhangliao: {
      skin: '#deb08a', eye: 'sharp', brow: 'sword', beard: ['full', '#1d150f'], stache: true, hat: 'helmet', hatColor: '#7a2a24', robe: '#8a2c24', armor: '#6a5a4a',
      desc: '演義沒有描寫外貌，依騎將形象繪製。', src: '—',
    },
    gaoshun: {
      skin: '#c99872', eye: 'round', brow: 'sword', beard: ['full', '#16110c'], stache: true, hat: 'helmet', hatColor: '#3a3a3a', robe: '#5a2a24', armor: '#4a4440', scar: true,
      desc: '演義沒有描寫外貌，依「陷陣營」統領的形象繪製。', src: '—',
    },
    chengong: {
      skin: '#e6c6a0', eye: 'narrow', brow: 'thin', beard: ['long', '#4a4038'], stache: true, hat: 'guan', hatColor: '#1e1e24', robe: '#5a3a3a', trim: '#cfc3a0', armor: null, age: 2,
      desc: '演義沒有描寫外貌，依謀主形象繪製。', src: '—',
    },
    houcheng: {
      skin: '#d0a07a', eye: 'small', brow: 'thin', beard: ['short', '#2a1e14'], stache: true, hat: 'helmet', hatColor: '#6a3a2a', robe: '#7a3a2a', armor: '#5a4a3a',
      desc: '演義沒有描寫外貌。', src: '—',
    },
    songxian: {
      skin: '#d6a982', eye: 'small', brow: 'thin', beard: ['goatee', '#2a1e14'], stache: true, hat: 'helmet', hatColor: '#5a3a3a', robe: '#6a3030', armor: '#4a4040',
      desc: '演義沒有描寫外貌。', src: '—',
    },
    weixu: {
      skin: '#cc9a72', eye: 'normal', brow: 'sword', beard: ['full', '#21170f'], stache: false, hat: 'helmet', hatColor: '#4a2e26', robe: '#5e2a22', armor: '#55473c',
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
  const INK = '#24160d';
  let uid = 0;
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  };

  // 表情：眉的傾斜（正＝怒，負＝愁）、眼、嘴
  const FACES = {
    neutral: { brow: 0, eye: 'open', mouth: 'line' },
    kind: { brow: -2, eye: 'soft', mouth: 'smile' },
    calm: { brow: 1, eye: 'half', mouth: 'line' },
    stern: { brow: 4, eye: 'open', mouth: 'tight' },
    proud: { brow: 3, eye: 'open', mouth: 'smirk' },
    laugh: { brow: -3, eye: 'joy', mouth: 'laugh' },
    weep: { brow: -6, eye: 'shut', mouth: 'frown', tears: 1 },
    pain: { brow: 8, eye: 'glare', mouth: 'shout', vein: true, flush: true },
    cry: { brow: -8, eye: 'squeeze', mouth: 'wail', tears: 2 },
    cold: { brow: 1, eye: 'sideHalf', mouth: 'line' },
    angry: { brow: 9, eye: 'glare', mouth: 'grit', vein: true, flush: true },
    sly: { brow: 2, eye: 'sideHalf', mouth: 'smirk' },
    haggard: { brow: -4, eye: 'tired', mouth: 'frown', pale: true, bags: true, strands: true },
    fear: { brow: -9, eye: 'wide', mouth: 'wobble', pale: true, sweat: true, strands: true },
    shout: { brow: 9, eye: 'glare', mouth: 'shout', flush: true },
    silent: { brow: 5, eye: 'down', mouth: 'tight' },
    sigh: { brow: -6, eye: 'half', mouth: 'o', puff: true },
    serene: { brow: -1, eye: 'shut', mouth: 'smile' },
    resent: { brow: 7, eye: 'side', mouth: 'frown', shadow: true },
  };

  function svg(genId, moodId, opts = {}) {
    const L = LOOKS[genId] || LOOKS.caobu;
    const M = (MOODS[genId] && MOODS[genId][moodId]) || (MOODS[genId] && MOODS[genId].default) || { face: 'neutral' };
    const F = FACES[M.face] || FACES.neutral;
    const id = 'pt' + (++uid);
    const side = opts.side === 'def' ? 'def' : opts.side === 'att' ? 'att' : null;
    const bgA = side === 'def' ? '#6b2a22' : side === 'att' ? '#24406e' : '#5a4630';
    const bgB = side === 'def' ? '#2e130f' : side === 'att' ? '#101d33' : '#2b2118';
    let skin = L.skin; if (F.pale) skin = shade(skin, 0.18);
    const skinD = shade(skin, -0.18), skinDD = shade(skin, -0.32);
    const bigEar = L.ear === 'big';
    const o = [];
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="portrait" role="img" aria-label="${(opts.name || '')}${M.name && moodId && moodId !== 'default' ? '・' + M.name : ''}">`);
    o.push(`<defs><radialGradient id="${id}b" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/></radialGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skin}"/><stop offset="1" stop-color="${skinD}"/></linearGradient>
      <clipPath id="${id}c"><rect width="120" height="120" rx="10"/></clipPath></defs>`);
    o.push(`<g clip-path="url(#${id}c)"><rect width="120" height="120" fill="url(#${id}b)"/>`);
    // 背景的情緒光暈
    if (F.flush || M.face === 'pain') o.push(`<circle cx="60" cy="56" r="52" fill="#ff5a2a" opacity=".18"/>`);
    if (F.pale || F.shadow) o.push(`<rect width="120" height="120" fill="#0a0f1a" opacity=".25"/>`);

    // 後髮（頭盔以外）
    if (L.hat !== 'helmet') o.push(`<path d="M36 52 Q34 24 60 20 Q86 24 84 52 L84 70 Q60 64 36 70 Z" fill="#1a1410"/>`);
    // 身體：袍與甲
    const robe = L.robe, robeD = shade(robe, -0.3);
    o.push(`<path d="M8 120 Q10 96 36 90 L60 98 L84 90 Q110 96 112 120 Z" fill="${robe}" stroke="${INK}" stroke-width="1.5"/>`);
    if (L.armor) {
      const a = L.armor, aD = shade(a, -0.35);
      o.push(`<path d="M14 120 Q16 100 38 93 L60 101 L82 93 Q104 100 106 120 Z" fill="${a}" stroke="${INK}" stroke-width="1.2"/>`);
      for (let y = 102; y < 120; y += 5) for (let x = 18 + ((y / 5) % 2) * 3; x < 104; x += 6) {
        if (Math.abs(x - 60) < 8 && y < 108) continue;
        o.push(`<path d="M${x} ${y} q3 4 6 0" fill="none" stroke="${aD}" stroke-width="1"/>`);
      }
      // 肩甲
      o.push(`<path d="M10 112 Q14 94 34 92 Q30 104 22 114 Z" fill="${shade(a, 0.12)}" stroke="${INK}" stroke-width="1.2"/><path d="M110 112 Q106 94 86 92 Q90 104 98 114 Z" fill="${shade(a, 0.12)}" stroke="${INK}" stroke-width="1.2"/>`);
      if (L.beast) o.push(`<g transform="translate(60 110)"><circle r="8" fill="${shade(a, 0.25)}" stroke="${INK}" stroke-width="1.2"/><path d="M-4 -2 l2 2 M4 -2 l-2 2" stroke="${INK}" stroke-width="1.4"/><path d="M-4 4 q4 -3 8 0" fill="none" stroke="${INK}" stroke-width="1.2"/><path d="M-3 4 v2 M3 4 v2" stroke="#fff" stroke-width="1"/></g>`);
    }
    // 交領
    o.push(`<path d="M44 90 L60 112 L76 90" fill="none" stroke="${L.trim || shade(robe, 0.35)}" stroke-width="4"/>`);
    o.push(`<path d="M44 90 L60 112 L76 90" fill="none" stroke="${INK}" stroke-width="1"/>`);
    if (M.bound) o.push(`<path d="M8 104 Q60 120 112 104 M8 112 Q60 128 112 112" fill="none" stroke="#b08a52" stroke-width="3.5"/><path d="M8 104 Q60 120 112 104 M8 112 Q60 128 112 112" fill="none" stroke="#6b4f2a" stroke-width="1" stroke-dasharray="2 3"/>`);
    // 脖子
    o.push(`<path d="M50 76 L50 94 Q60 100 70 94 L70 76 Z" fill="${skinD}" stroke="${INK}" stroke-width="1.2"/>`);

    // 耳朵
    if (bigEar) {
      o.push(`<path d="M38 50 Q28 50 29 64 Q30 82 37 90 Q42 86 40 74 Z" fill="${skin}" stroke="${INK}" stroke-width="1.3"/><path d="M82 50 Q92 50 91 64 Q90 82 83 90 Q78 86 80 74 Z" fill="${skin}" stroke="${INK}" stroke-width="1.3"/>`);
      o.push(`<path d="M36 58 q-3 8 0 18 M84 58 q3 8 0 18" fill="none" stroke="${skinDD}" stroke-width="1"/>`);
    } else if (L.hat !== 'helmet') {
      o.push(`<path d="M39 52 Q31 52 32 60 Q33 68 40 68 Z" fill="${skin}" stroke="${INK}" stroke-width="1.3"/><path d="M81 52 Q89 52 88 60 Q87 68 80 68 Z" fill="${skin}" stroke="${INK}" stroke-width="1.3"/>`);
    }
    // 臉
    o.push(`<path d="M38 46 Q38 26 60 26 Q82 26 82 46 L82 62 Q80 80 60 86 Q40 80 38 62 Z" fill="url(#${id}s)" stroke="${INK}" stroke-width="1.6"/>`);
    if (F.flush) o.push(`<ellipse cx="46" cy="66" rx="5" ry="3" fill="#e0402a" opacity=".35"/><ellipse cx="74" cy="66" rx="5" ry="3" fill="#e0402a" opacity=".35"/>`);
    if (F.shadow) o.push(`<path d="M38 40 Q60 30 82 40 L82 50 Q60 46 38 50 Z" fill="#000" opacity=".22"/>`);
    if (L.age) o.push(`<path d="M50 40 q10 -2 20 0${L.age > 1 ? ' M51 43 q9 -2 18 0' : ''}" fill="none" stroke="${skinDD}" stroke-width=".8" opacity=".8"/>`);
    if (L.scar) o.push(`<path d="M72 44 L77 58" stroke="${shade(skin, -0.45)}" stroke-width="1.4"/><path d="M73 49 l3 -1 M74 53 l3 -1" stroke="${shade(skin, -0.45)}" stroke-width=".9"/>`);

    // 眉
    o.push(brows(L, F));
    // 眼
    o.push(eyes(L, F, M, skinDD));
    // 鼻
    o.push(`<path d="M60 52 Q57 62 56 66 Q60 69 64 66" fill="none" stroke="${skinDD}" stroke-width="1.3" stroke-linecap="round"/>`);
    if (F.bags) o.push(`<path d="M44 60 q6 3 12 0 M64 60 q6 3 12 0" fill="none" stroke="#6a5a7a" stroke-width="1.1" opacity=".8"/>`);

    // 鬍鬚（嘴之下）
    const [bs, bc] = L.beard || ['none'];
    if (bs !== 'none') o.push(beard(bs, bc));
    // 嘴
    o.push(mouth(F, L));
    // 八字鬍
    if (L.stache && bs !== 'none') o.push(`<path d="M60 70 Q52 68 46 74 Q50 72 54 72 Q58 72 60 71 Q62 72 66 72 Q70 72 74 74 Q68 68 60 70 Z" fill="${bc}" stroke="${INK}" stroke-width=".6"/>`);

    // 帽冠
    o.push(hat(L, F));
    // 散髮
    if (F.strands) o.push(`<path d="M42 32 Q40 46 44 56 M78 32 Q82 44 77 54 M50 28 Q46 40 49 48" fill="none" stroke="#1a1410" stroke-width="1.4"/>`);

    // 眼罩（夏侯惇左目）；拔矢時改成流血
    if (L.patch && !M.blood) o.push(`<path d="M36 44 L84 38" stroke="#1a1410" stroke-width="2"/><ellipse cx="${L.patch === 'L' ? 70 : 50}" cy="55" rx="8" ry="6" fill="#1a1410" stroke="${INK}"/>`);
    if (M.blood) {
      o.push(`<ellipse cx="70" cy="55" rx="6" ry="5" fill="#5a0a0a"/><path d="M68 59 Q66 70 69 80 Q71 72 72 60 Z M73 59 Q76 66 74 74 Q77 66 75 59 Z" fill="#b01818"/>`);
      o.push(`<path d="M86 30 L104 14" stroke="#6b4a2a" stroke-width="2.4"/><path d="M104 14 l5 -1 l-3 4 Z" fill="#cfcfcf" stroke="${INK}" stroke-width=".6"/><path d="M84 32 l-4 -1 M84 32 l-1 -4" stroke="#e8e0d0" stroke-width="1.2"/>`);
    }
    // 淚、汗、青筋、嘆氣
    if (F.tears) {
      o.push(`<path d="M47 60 Q45 70 47 80 Q49 70 49 60 Z" fill="#9fd4ff" opacity=".9"/>`);
      if (F.tears > 1) o.push(`<path d="M73 60 Q71 72 73 84 Q75 72 75 60 Z" fill="#9fd4ff" opacity=".9"/><circle cx="44" cy="86" r="1.8" fill="#9fd4ff"/><circle cx="77" cy="90" r="1.6" fill="#9fd4ff"/>`);
    }
    if (F.sweat) o.push(`<path d="M85 36 q4 6 0 9 q-4 -3 0 -9 Z M90 48 q3 5 0 7 q-3 -2 0 -7 Z" fill="#bfe6ff" stroke="#5a8ab0" stroke-width=".6"/>`);
    if (F.vein) o.push(`<g transform="translate(83 48) scale(.75)" stroke="#e0281a" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M-6 -2 q3 2 2 6 M6 -2 q-3 2 -2 6 M-2 -7 q2 3 6 2 M-2 7 q2 -3 6 -2"/></g>`);
    if (F.puff) o.push(`<path d="M70 82 q6 -2 10 2 q6 -2 8 4 q-4 4 -10 2 q-6 2 -8 -8 Z" fill="#e8e4dc" opacity=".55"/>`);
    // 框
    o.push(`</g><rect x=".75" y=".75" width="118.5" height="118.5" rx="10" fill="none" stroke="${opts.frame || '#e8c88a'}" stroke-width="1.5"/></svg>`);
    return o.join('');
  }

  function brows(L, F) {
    const t = F.brow; // 正：內側往下（怒）；負：內側往上（愁）
    const thick = L.brow === 'silkworm' ? 4.2 : L.brow === 'sword' ? 3 : 1.8;
    const lift = L.eye === 'phoenix' ? -2 : 0;
    const one = (x0, x1, inner) => {
      const y0 = 45 + lift, yIn = y0 + t * 0.55, yOut = y0 - t * 0.25 + (L.brow === 'sword' ? -2 : 0);
      const [ax, ay, bx, by] = inner === 'R' ? [x0, yOut, x1, yIn] : [x0, yIn, x1, yOut];
      const mx = (ax + bx) / 2, my = Math.min(ay, by) - (L.brow === 'silkworm' ? 3.5 : 2);
      return L.brow === 'silkworm'
        ? `<path d="M${ax} ${ay} Q${mx} ${my - 2} ${bx} ${by} Q${mx} ${my + thick} ${ax} ${ay} Z" fill="#120d0a"/>`
        : `<path d="M${ax} ${ay} Q${mx} ${my} ${bx} ${by}" fill="none" stroke="#120d0a" stroke-width="${thick}" stroke-linecap="round"/>`;
    };
    return one(43, 56, 'R') + one(64, 77, 'L');
  }

  function eyes(L, F, M, skinDD) {
    const out = [];
    const shapeH = { narrow: 1.6, phoenix: 2.2, round: 3.6, small: 2.4, sharp: 2.6, normal: 3 }[L.eye] || 3;
    const tilt = L.eye === 'phoenix' ? 3 : L.eye === 'sharp' ? 1.6 : 0;
    const both = [[50, 'L'], [70, 'R']];
    for (const [cx, s] of both) {
      if (L.patch === 'L' && s === 'R') continue; // 夏侯惇的左目（畫面右側）另外畫
      const dir = s === 'L' ? -1 : 1; // 外眼角方向
      const outer = cx + dir * 6, inner = cx - dir * 6;
      const y = 55;
      const e = F.eye;
      if (e === 'joy') { out.push(`<path d="M${inner} ${y + 1} Q${cx} ${y - 5} ${outer} ${y + 1 - tilt}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`); continue; }
      if (e === 'shut') { out.push(`<path d="M${inner} ${y} Q${cx} ${y + 3} ${outer} ${y - tilt}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`); continue; }
      if (e === 'squeeze') { out.push(`<path d="M${inner} ${y - 1} L${cx} ${y + 2} L${outer} ${y - 2}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`); continue; }
      let h = shapeH, pr = 2.1, px = 0, py = 0, lid = 0;
      if (e === 'glare') { h = Math.max(h, 3.4) + 0.6; pr = 1.5; }
      if (e === 'wide') { h = shapeH + 2.2; pr = 1.2; }
      if (e === 'soft') { h = Math.min(h, 2.4); }
      if (e === 'half') { lid = 0.55; }
      if (e === 'tired') { lid = 0.5; py = 0.5; }
      if (e === 'down') { lid = 0.6; py = 1.2; }
      if (e === 'side') px = 2.4;
      if (e === 'sideHalf') { px = -2.4; lid = 0.45; }
      const yo = y - tilt / 2;
      const top = `M${inner} ${y} Q${cx} ${y - h * 1.6} ${outer} ${yo - tilt / 2}`;
      const bot = `Q${cx} ${y + h * 0.9} ${inner} ${y}`;
      out.push(`<path d="${top} ${bot} Z" fill="#fbf6ea" stroke="${INK}" stroke-width="1.2"/>`);
      out.push(`<clipPath id="ec${cx}${uid}"><path d="${top} ${bot} Z"/></clipPath>`);
      out.push(`<g clip-path="url(#ec${cx}${uid})"><circle cx="${cx + px}" cy="${y - h * 0.2 + py}" r="${pr + 1}" fill="#3a2414"/><circle cx="${cx + px}" cy="${y - h * 0.2 + py}" r="${pr * 0.55}" fill="#0a0604"/>`);
      if (lid) out.push(`<rect x="${inner - 8}" y="${y - h * 2}" width="20" height="${h * 2 * lid + h * 0.3}" fill="${skinDD}" opacity=".95"/>`);
      out.push(`</g>`);
      out.push(`<path d="${top}" fill="none" stroke="${INK}" stroke-width="${L.eye === 'phoenix' ? 2.2 : 1.8}" stroke-linecap="round"/>`);
      if (L.eye === 'phoenix') out.push(`<path d="M${outer} ${yo - tilt / 2} l${dir * 3} -2" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`);
      if (e !== 'wide') out.push(`<circle cx="${cx + px + 0.8}" cy="${y - h * 0.5 + py}" r=".7" fill="#fff"/>`);
    }
    return out.join('');
  }

  function mouth(F, L) {
    const lip = L.lips || shade(L.skin, -0.35);
    switch (F.mouth) {
      case 'smile': return `<path d="M53 76 Q60 80 67 76" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/><path d="M55 77 Q60 79 65 77" stroke="${lip}" stroke-width="1.6" fill="none"/>`;
      case 'smirk': return `<path d="M53 77 Q60 78 67 74" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
      case 'laugh': return `<path d="M50 74 Q60 73 70 74 Q68 86 60 87 Q52 86 50 74 Z" fill="#5a1414" stroke="${INK}" stroke-width="1.4"/><path d="M51.5 75 Q60 74 68.5 75 L68 77.5 Q60 77 52 77.5 Z" fill="#fff"/><path d="M55 84 Q60 81 65 84" fill="#d0606a"/>`;
      case 'frown': return `<path d="M53 79 Q60 74 67 79" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
      case 'wail': return `<path d="M52 80 Q60 70 68 80 Q60 86 52 80 Z" fill="#5a1414" stroke="${INK}" stroke-width="1.4"/><path d="M55 76.5 Q60 74 65 76.5" stroke="#fff" stroke-width="1.6" fill="none"/>`;
      case 'shout': return `<path d="M51 73 Q60 71 69 73 Q67 87 60 88 Q53 87 51 73 Z" fill="#4a0e0e" stroke="${INK}" stroke-width="1.4"/><path d="M52.5 74 Q60 72.5 67.5 74 L67 76.5 Q60 75.5 53 76.5 Z" fill="#fff"/><path d="M54 86 L56 83 L58 86 M62 86 L64 83 L66 86" fill="#fff"/>`;
      case 'grit': return `<rect x="51" y="73.5" width="18" height="6" rx="2" fill="#fff" stroke="${INK}" stroke-width="1.4"/><path d="M51 76.5 H69 M55.5 73.5 v6 M60 73.5 v6 M64.5 73.5 v6" stroke="${INK}" stroke-width=".8"/>`;
      case 'wobble': return `<path d="M52 78 q2 -3 4 0 t4 0 t4 0 t4 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><path d="M54 79 Q60 83 66 79" fill="#5a1414" opacity=".6"/>`;
      case 'tight': return `<path d="M53 77 H67" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
      case 'o': return `<ellipse cx="60" cy="77.5" rx="2.6" ry="3" fill="#4a1010" stroke="${INK}" stroke-width="1.2"/>`;
      default: return `<path d="M54 77 Q60 78.5 66 77" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/><path d="M56 78 Q60 79.5 64 78" stroke="${lip}" stroke-width="1.4" fill="none" opacity=".8"/>`;
    }
  }

  function beard(style, c) {
    const st = `fill="${c}" stroke="${INK}" stroke-width=".8"`;
    const lines = (x0, x1, y0, y1) => { let s = ''; for (let x = x0; x <= x1; x += 4) s += `M${x} ${y0} Q${x + (x - 60) * 0.1} ${(y0 + y1) / 2} ${60 + (x - 60) * 0.6} ${y1} `; return `<path d="${s}" fill="none" stroke="${shade(c, 0.25)}" stroke-width=".7" opacity=".7"/>`; };
    switch (style) {
      case 'xlong': return `<path d="M42 66 Q44 80 52 84 Q60 87 68 84 Q76 80 78 66 Q82 82 76 98 Q70 114 62 124 L58 124 Q50 114 44 98 Q38 82 42 66 Z" ${st}/>` + lines(46, 74, 84, 122)
        + `<path d="M43 64 Q40 72 41 80 M77 64 Q80 72 79 80" stroke="${c}" stroke-width="2.2" fill="none"/>`;
      case 'long': return `<path d="M44 70 Q48 82 54 84 Q60 86 66 84 Q72 82 76 70 Q78 86 72 98 Q66 108 60 112 Q54 108 48 98 Q42 86 44 70 Z" ${st}/>` + lines(50, 70, 84, 110);
      case 'full': return `<path d="M38 56 Q38 76 48 84 Q60 92 72 84 Q82 76 82 56 Q80 68 74 74 Q66 72 60 72 Q54 72 46 74 Q40 68 38 56 Z" ${st}/>` + `<path d="M48 82 Q60 96 72 82 Q66 90 60 92 Q54 90 48 82 Z" ${st}/>`;
      case 'goatee': return `<path d="M55 81 Q60 84 65 81 Q64 92 60 98 Q56 92 55 81 Z" ${st}/>`;
      case 'short': return `<path d="M50 80 Q60 86 70 80 Q68 88 60 90 Q52 88 50 80 Z" ${st}/>`;
      default: return '';
    }
  }

  function hat(L, F) {
    const c = L.hatColor || '#222', cD = shade(c, -0.35), cL = shade(c, 0.25);
    switch (L.hat) {
      case 'guan': // 進賢冠：黑色梁冠
        return `<path d="M38 42 Q38 26 60 25 Q82 26 82 42 Q70 36 60 36 Q50 36 38 42 Z" fill="#1a1410" stroke="${INK}" stroke-width="1.2"/>`
          + `<path d="M46 34 L48 12 Q60 6 74 14 L74 32 Q60 30 46 34 Z" fill="${c}" stroke="${INK}" stroke-width="1.3"/>`
          + `<path d="M52 32 L54 13 M60 31 L61 10 M67 31 L68 12" stroke="${cL}" stroke-width="1"/>`
          + `<path d="M40 38 Q60 30 80 38" stroke="${L.trim || '#c9a24a'}" stroke-width="2.4" fill="none"/>`
          + `<path d="M36 40 L84 40" stroke="#d8c48a" stroke-width="1.2" stroke-dasharray="1 2" opacity=".6"/>`;
      case 'zijin': // 三叉束髮紫金冠＋雉尾
        return `<path d="M38 42 Q38 24 60 23 Q82 24 82 42 Q70 34 60 34 Q50 34 38 42 Z" fill="#1a1410" stroke="${INK}" stroke-width="1.2"/>`
          + `<path d="M58 22 Q40 4 18 2 Q36 8 50 24 Z" fill="#c23a2a" stroke="${INK}" stroke-width=".8"/><path d="M62 22 Q80 4 102 2 Q84 8 70 24 Z" fill="#c23a2a" stroke="${INK}" stroke-width=".8"/>`
          + `<path d="M57 22 Q42 8 22 4 M63 22 Q78 8 98 4" stroke="#f0c860" stroke-width=".8" fill="none" stroke-dasharray="3 2"/>`
          + `<path d="M44 34 L46 20 L52 26 L60 12 L68 26 L74 20 L76 34 Q60 30 44 34 Z" fill="${c}" stroke="${INK}" stroke-width="1.3"/>`
          + `<circle cx="60" cy="27" r="3.2" fill="#7a3aa8" stroke="${INK}" stroke-width=".8"/><circle cx="50" cy="30" r="1.8" fill="#7a3aa8"/><circle cx="70" cy="30" r="1.8" fill="#7a3aa8"/>`
          + `<path d="M40 38 Q60 30 80 38" stroke="${c}" stroke-width="3" fill="none"/><path d="M40 38 Q60 30 80 38" stroke="${INK}" stroke-width=".8" fill="none"/>`;
      case 'scarf': // 綠頭巾
        return `<path d="M36 46 Q34 22 60 20 Q86 22 84 46 Q72 38 60 38 Q48 38 36 46 Z" fill="${c}" stroke="${INK}" stroke-width="1.3"/>`
          + `<path d="M58 21 Q64 12 72 16 Q66 18 64 24 Z" fill="${shade(c, -0.2)}" stroke="${INK}" stroke-width="1"/>`
          + `<path d="M40 40 Q60 32 80 40" stroke="${cL}" stroke-width="1.6" fill="none"/><path d="M84 44 Q92 58 90 74 Q86 60 82 50 Z" fill="${shade(c, -0.15)}" stroke="${INK}" stroke-width="1"/>`;
      case 'helmet':
        return `<path d="M33 52 Q32 20 60 16 Q88 20 87 52 L87 70 Q84 74 80 72 L80 50 Q70 42 60 42 Q50 42 40 50 L40 72 Q36 74 33 70 Z" fill="${c}" stroke="${INK}" stroke-width="1.4"/>`
          + `<path d="M36 46 Q60 34 84 46" stroke="${shade(c, 0.35)}" stroke-width="3" fill="none"/><path d="M36 46 Q60 34 84 46" stroke="${INK}" stroke-width=".8" fill="none"/>`
          + `<path d="M60 16 L60 42" stroke="${cD}" stroke-width="2"/><path d="M57 16 L60 4 L63 16 Z" fill="#c9a24a" stroke="${INK}" stroke-width=".8"/>`
          + `<path d="M58 6 Q50 -2 46 2 Q52 2 58 10 Z" fill="#c23a2a"/>`
          + `<path d="M40 52 L40 70 M80 52 L80 70" stroke="${cD}" stroke-width="1"/>`;
      case 'lunjin': // 綸巾
        return `<path d="M38 44 Q36 22 60 20 Q84 22 82 44 Q70 36 60 36 Q50 36 38 44 Z" fill="${c}" stroke="${INK}" stroke-width="1.3"/>`
          + `<path d="M44 30 Q60 24 76 30 M42 36 Q60 28 78 36" stroke="${shade(c, 0.3)}" stroke-width="1" fill="none"/>`
          + `<path d="M76 30 Q90 40 92 58 Q86 46 80 40 Z" fill="${shade(c, -0.15)}" stroke="${INK}" stroke-width="1"/>`;
      case 'topknot':
        return `<path d="M38 44 Q38 24 60 24 Q82 24 82 44 Q70 36 60 36 Q50 36 38 44 Z" fill="${c}" stroke="${INK}" stroke-width="1.2"/>`
          + `<ellipse cx="60" cy="20" rx="7" ry="6" fill="${c}" stroke="${INK}" stroke-width="1.2"/><path d="M38 38 Q60 30 82 38" stroke="#8a6a44" stroke-width="2.4" fill="none"/>`;
      default: return '';
    }
  }

  // 取武將的情緒清單（default 在最前面）
  function moodsOf(genId) { const m = MOODS[genId] || { default: MOODS.caobu.default }; return Object.keys(m).map(k => ({ id: k, ...m[k] })); }
  function has(genId, moodId) { return !!(MOODS[genId] && MOODS[genId][moodId]); }

  root.PORTRAITS = { LOOKS, MOODS, FACES, svg, moodsOf, has };
})(typeof window !== 'undefined' ? window : globalThis);
