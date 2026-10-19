// ===== 武將頭像資料：人物清單、生成模板、圖片紀錄（遊戲與 tools/portraits.js 共用） =====
// 對應規則：
//   - id 一律用 js/data.js 的 GENERALS 鍵（例如 'guanyu'）；還沒進遊戲的人物（張飛、諸葛亮、趙雲）先用同樣規則命名
//   - 主圖檔名 = `${id}.png`；情緒圖 = `${id}__${mood}.png`（mood 對應 js/portraits.js 的 MOODS 鍵）
//   - 只有 status === 'approved' 的圖片才會被遊戲載入；其他狀態一律用 SVG 頭像
//   - 每張圖的生成紀錄（提示詞、日期、模型、素材來源、授權）在 log.json，由 tools/portraits.js 寫入；approved 卻沒有紀錄會被 check 擋下
(function (root) {

  // ---------- 固定生成模板（不得因角色而改變） ----------
  const TEMPLATE = {
    version: 'v2', // v2：臉部加入「多數人審美」要求
    style: 'semi-realistic digital painting, Eastern historical fantasy, painterly brushwork with refined detail, grounded and weighty tone suited to a historical strategy game, late Eastern Han dynasty (circa 200 AD) Chinese costume and armor as historical reference with tasteful artistic stylization',
    lighting: 'soft key light from the upper left at about 45 degrees, gentle fill on the shadow side, subtle warm rim light from the back right separating the figure from the background, cinematic but restrained, no magical glow',
    composition: 'head-and-shoulders bust portrait, single person, centered, facing about three-quarters toward the viewer\'s left, eyes at roughly 40 percent from the top of the frame, the head top at least 10 percent below the top edge, shoulders fully inside the frame with margin on both sides, square 1:1 framing',
    color: 'natural muted palette, restrained saturation, warm earth tones in skin and leather, costume colors limited to the character palette below',
    face: 'clear readable facial features with natural skin texture and believable proportions, sharp focus on the eyes, expression readable even when scaled down to 64 pixels, attractive modern-appealing features with broad appeal: harmonious well-proportioned face, clear healthy skin, bright expressive eyes, well-groomed hair and beard, dignified and flattering look, unless the character notes say otherwise',
    background: 'simple softly blurred dark background with a subtle gradient and faint atmospheric haze, no scenery details, no objects, strong value contrast between figure and background',
    negative: [
      'text', 'letters', 'calligraphy', 'logo', 'watermark', 'signature', 'frame', 'border', 'UI elements',
      'multiple people', 'extra limbs', 'extra fingers', 'deformed hands', 'distorted face', 'asymmetrical eyes', 'cross-eyed',
      'cropped head', 'head touching the frame edge', 'full body', 'tiny figure',
      'anime', 'chibi', 'cartoon', '3D render', 'plastic skin', 'over-smoothed skin', 'photograph', 'cosplay',
      'oversaturated colors', 'neon', 'glowing magic effects', 'lens flare', 'busy background',
      'Japanese samurai armor', 'Qing dynasty queue hairstyle', 'Ming dynasty costume', 'modern clothing',
      'likeness of any real actor', 'copy of any existing game, film, TV or comic character design',
    ],
  };

  // ---------- 人物清單 ----------
  // batch：1＝第一批測試角色；side：遊戲裡的陣營顏色（att 藍／def 紅；未登場的用 null）
  // novel：《三國演義》公共領域原文（外貌）；design：本作獨立設計（臉、髮鬚、服裝、盔甲、配色、表情）
  // status：planned 規劃中 → generated 已生成待審 → approved 審核通過（遊戲才會載入）／rejected 不採用
  // moods（之後擴充）：{ grudge: { file: 'houcheng__grudge.png', status, expression } }
  const CHARACTERS = [
    {
      id: 'liubei', en: 'Liu Bei', name: '劉備', courtesy: '玄德', faction: '蜀', side: 'att', batch: 1, role: '君主・仁德型統帥', age: 38,
      personality: '仁厚、沉穩、具有領袖氣質，親和中帶著堅忍',
      novel: '身長七尺五寸，兩耳垂肩，雙手過膝，目能自顧其耳，面如冠玉，唇若塗脂。（第 1 回）',
      design: {
        face: 'a handsome man of about 38, fair warm complexion, gentle almond-shaped eyes, straight nose, noticeably long elongated earlobes rendered naturally, softly defined jaw',
        hair: 'black hair gathered in a topknot under a small black lacquered guan cap held by a pale jade hairpin, neatly trimmed short mustache and small chin beard',
        costume: 'layered cross-collar robe in muted ochre over a deep teal inner robe with faint cloud-scroll embroidery on the collar, a single hardened-leather shoulder guard with bronze studs on the left shoulder',
        palette: 'muted ochre, deep teal, warm brown leather, pale jade accent',
        expression: 'calm and benevolent, a faint warm smile, steady sincere gaze at the viewer',
        notes: 'leader look; kind but not weak',
      },
      file: 'liubei.png', status: 'planned',
    },
    {
      id: 'guanyu', en: 'Guan Yu', name: '關羽', courtesy: '雲長', faction: '蜀', side: 'att', batch: 1, role: '猛將・忠義', age: 40,
      personality: '威嚴、沉著、忠義，不怒自威',
      novel: '身長九尺，髯長二尺；面如重棗，唇若塗脂；丹鳳眼，臥蠶眉：相貌堂堂，威風凜凜。（第 1 回）',
      design: {
        face: 'a dignified imposing man of about 40, naturally deep ruddy jujube-red weathered complexion (skin tone, not face paint), long narrow upswept eyes with slightly raised outer corners, thick crescent-shaped eyebrows, strong high cheekbones',
        hair: 'very long glossy straight black beard flowing down past the chest, neatly groomed, black hair under a dark green cloth head wrap tied at the back',
        costume: 'dark bronze scale-lamellar armor under a dark forest-green brocade surcoat with a subtle wave pattern, muted ochre-gold trim at the collar',
        palette: 'deep forest green, dark bronze, muted ochre-gold',
        expression: 'composed and solemn, eyes slightly lowered, quiet authority',
        notes: 'beard length is the signature; must read clearly at small size',
      },
      file: 'guanyu.png', status: 'planned',
    },
    {
      id: 'zhangfei', en: 'Zhang Fei', name: '張飛', courtesy: '翼德', faction: '蜀', side: null, batch: 1, role: '猛將・剛烈', age: 33,
      personality: '魁梧、剛烈、豪邁，氣勢如雷',
      novel: '身長八尺，豹頭環眼，燕頷虎鬚，聲若巨雷，勢如奔馬。（第 1 回）',
      design: {
        face: 'a powerfully built ruggedly handsome man of about 33, broad head and thick neck, large round intense eyes, heavy brows, strong wide jaw, tanned skin',
        hair: 'short thick bristling black beard flaring outward from the jaw and cheeks like a tiger\'s whiskers, black hair bound up under a dark charcoal cloth headband',
        costume: 'blackened iron lamellar armor laced with dark oxblood-red cords, a dark iron gorget, a rough dark leather shoulder cape',
        palette: 'charcoal black, iron gray, oxblood red',
        expression: 'fierce and bold, a wide confident battle grin, eyes blazing',
        notes: 'massive presence; rugged, not ugly',
      },
      file: 'zhangfei.png', status: 'planned',
    },
    {
      id: 'caocao', en: 'Cao Cao', name: '曹操', courtesy: '孟德', faction: '魏', side: 'att', batch: 1, role: '君主・霸主', age: 43,
      personality: '精明、果決、具有政治領袖的壓迫感',
      novel: '身長七尺，細眼長髯。（第 1 回）',
      design: {
        face: 'a lean sharp-featured man of about 43, narrow keen eyes, defined cheekbones, thin firm lips, light graying at the temples',
        hair: 'long well-groomed black beard reaching the upper chest with a few gray strands, hair under a tall black lacquered official cap',
        costume: 'dark indigo-black outer robe with a deep crimson inner collar, black lacquered shoulder armor plates edged in muted gold bronze',
        palette: 'black, deep indigo, deep crimson, muted gold',
        expression: 'shrewd and commanding, a faint knowing half-smile, chin slightly lowered, eyes locked on the viewer',
        notes: 'pressure and intelligence, not villain caricature',
      },
      file: 'caocao.png', status: 'planned',
    },
    {
      id: 'zhugeliang', en: 'Zhuge Liang', name: '諸葛亮', courtesy: '孔明', faction: '蜀', side: null, batch: 1, role: '軍師・謀略', age: 27,
      personality: '儒雅、冷靜、深謀遠慮',
      novel: '身長八尺，面如冠玉，頭戴綸巾，身披鶴氅，飄飄然有神仙之概。（第 38 回）',
      design: {
        face: 'an elegant handsome man of about 27, fair clear complexion, calm narrow intelligent eyes, fine straight nose, refined features',
        hair: 'thin neat mustache and a short refined chin beard, hair under a dark slate-blue silk scholar\'s head scarf (guanjin) with trailing ribbons',
        costume: 'ivory-white crane-feather cloak with black edging over a pale gray scholar robe, the tip of a white feather fan just visible at the lower edge',
        palette: 'ivory white, slate blue-gray, black trim',
        expression: 'serene and contemplative, slight composed smile, gaze thoughtful',
        notes: 'calm genius; avoid mystical glow',
      },
      file: 'zhugeliang.png', status: 'planned',
    },
    {
      id: 'zhaoyun', en: 'Zhao Yun', name: '趙雲', courtesy: '子龍', faction: '蜀', side: null, batch: 1, role: '猛將・槍騎', age: 30,
      personality: '英挺、敏捷、神情堅定',
      novel: '身長八尺，濃眉大眼，闊面重頤，威風凜凜。（第 7 回）',
      design: {
        face: 'a striking heroic man of about 30, broad face with a full firm jaw, thick straight brows, large bright determined eyes, clean-shaven',
        hair: 'black hair tied up under a polished steel helmet with a short white horsehair tassel and cheek guards open',
        costume: 'polished silver-white steel lamellar armor over a pale slate-blue padded tunic, white cloth scarf at the neck',
        palette: 'silver white, slate blue, cool steel gray',
        expression: 'resolute and focused, lips set, alert eyes',
        notes: 'heroic and agile; 闊面重頤 rendered as a strong broad jaw, not heavy',
      },
      file: 'zhaoyun.png', status: 'planned',
    },

    // ---------- 第 1 關其他武將（第二批） ----------
    {
      id: 'xiahoudun', en: 'Xiahou Dun', name: '夏侯惇', courtesy: '元讓', faction: '魏', side: 'att', batch: 2, role: '猛將・剛烈', age: 40,
      personality: '剛烈、悍勇、對曹操忠心',
      novel: '被曹性一箭射中左目，拔矢啖睛：「父精母血，不可棄也！」（第 18 回）',
      design: {
        face: 'a fierce battle-hardened man of about 40, his left eye lost and covered by a dark leather eye patch, a scar running past the patch, hard square jaw',
        hair: 'short full black beard, dark steel helmet with a dark blue cloth lining',
        costume: 'dark steel-blue lamellar armor with black leather edging',
        palette: 'steel blue, black, dark leather brown',
        expression: 'grim and fearless, single eye glaring',
        notes: 'the patch is on the character\'s LEFT eye (viewer\'s right)',
      },
      file: 'xiahoudun.png', status: 'planned',
    },
    {
      id: 'xunyou', en: 'Xun You', name: '荀攸', courtesy: '公達', faction: '魏', side: 'att', batch: 2, role: '軍師', age: 41,
      personality: '深沉內斂、謀略周密',
      novel: '（演義無外貌描寫）',
      design: {
        face: 'a thin reserved scholar of about 41, narrow thoughtful eyes, high forehead, faint lines around the eyes',
        hair: 'thin mustache and a long narrow goatee, hair under a dark blue-gray scholar cap',
        costume: 'layered slate-blue scholar robe with a cream inner collar',
        palette: 'slate blue, cream, dark gray',
        expression: 'quiet and calculating, faint thin smile',
        notes: 'understated; less glamorous than 諸葛亮',
      },
      file: 'xunyou.png', status: 'planned',
    },
    {
      id: 'lubu', en: 'Lu Bu', name: '呂布', courtesy: '奉先', faction: '群', side: 'def', batch: 2, role: '猛將・無雙', age: 35,
      personality: '驕傲、勇猛無雙、反覆無常',
      novel: '頭戴三叉束髮紫金冠，體掛西川紅錦百花袍，身披獸面吞頭連環鎧，腰繫勒甲玲瓏獅蠻帶。（第 5 回）',
      design: {
        face: 'a strikingly handsome proud warrior of about 35, sharp angular features, intense narrow eyes, clean-shaven',
        hair: 'hair bound under an ornate three-pronged gold hair crown set with purple stones',
        costume: 'interlocking ring-mail armor with a beast-face pauldron and chest boss, worn over a deep red brocade robe with a muted floral pattern',
        palette: 'deep red, antique gold, purple accent, dark bronze',
        expression: 'arrogant and fearless, slight sneer',
        notes: 'peerless warrior; avoid opera pheasant-feather design',
      },
      file: 'lubu.png', status: 'planned',
    },
    {
      id: 'zhangliao', en: 'Zhang Liao', name: '張遼', courtesy: '文遠', faction: '群', side: 'def', batch: 2, role: '騎將', age: 29,
      personality: '果敢、沉穩、有大將之風',
      novel: '（演義無外貌描寫）',
      design: {
        face: 'a capable handsome cavalry officer of about 29, keen eyes, firm brows, weathered skin',
        hair: 'short neat black beard, dark red-lacquered helmet with a red plume',
        costume: 'brown leather and iron lamellar cavalry armor with a dark red cloak',
        palette: 'dark red, brown leather, iron',
        expression: 'calm determination',
        notes: '',
      },
      file: 'zhangliao.png', status: 'planned',
    },
    {
      id: 'gaoshun', en: 'Gao Shun', name: '高順', faction: '群', side: 'def', batch: 2, role: '陷陣營統領', age: 38,
      personality: '清白威嚴、寡言、治軍嚴整',
      novel: '操問高順：「汝有何言？」順不答。（第 19 回）',
      design: {
        face: 'a stern taciturn soldier of about 38, deep-set eyes, a scar on the right cheek, weathered dark skin',
        hair: 'full short black beard, plain dark iron helmet',
        costume: 'heavy dark iron lamellar infantry armor with a dark red under-tunic',
        palette: 'dark iron, black, dark red',
        expression: 'silent and unyielding, mouth set in a line',
        notes: '',
      },
      file: 'gaoshun.png', status: 'planned',
    },
    {
      id: 'chengong', en: 'Chen Gong', name: '陳宮', courtesy: '公台', faction: '群', side: 'def', batch: 2, role: '謀主', age: 45,
      personality: '剛直、有謀略、懷才不遇',
      novel: '宮曰：「今日有死而已！」（第 19 回）',
      design: {
        face: 'a lean upright scholar-official of about 45, high cheekbones, tired but sharp eyes, forehead lines',
        hair: 'long beard with gray streaks, black official cap',
        costume: 'dark maroon official robe with a cream inner collar',
        palette: 'maroon, cream, black',
        expression: 'grave and resolute',
        notes: '',
      },
      file: 'chengong.png', status: 'planned',
    },
    {
      id: 'houcheng', en: 'Hou Cheng', name: '侯成', faction: '群', side: 'def', batch: 2, role: '部將', age: 36,
      personality: '心懷怨懟的部將', novel: '（演義無外貌描寫）',
      design: { face: 'an ordinary-looking officer of about 36, small eyes, broad nose', hair: 'short beard, brown-red lacquered helmet', costume: 'plain brown lamellar armor', palette: 'brown, rust red', expression: 'sullen, resentful sidelong glance', notes: 'plain, not heroic' },
      file: 'houcheng.png', status: 'planned',
    },
    {
      id: 'songxian', en: 'Song Xian', name: '宋憲', faction: '群', side: 'def', batch: 2, role: '部將', age: 34,
      personality: '見風轉舵', novel: '（演義無外貌描寫）',
      design: { face: 'an ordinary-looking officer of about 34, narrow face, small shifty eyes', hair: 'thin goatee, dark helmet', costume: 'plain dark red lamellar armor', palette: 'dark red, gray', expression: 'wary, calculating', notes: 'plain, not heroic' },
      file: 'songxian.png', status: 'planned',
    },
    {
      id: 'weixu', en: 'Wei Xu', name: '魏續', faction: '群', side: 'def', batch: 2, role: '部將', age: 37,
      personality: '粗豪的部將', novel: '（演義無外貌描寫）',
      design: { face: 'a heavyset ordinary-looking officer of about 37, thick brows, flat nose', hair: 'full rough beard, dark brown helmet', costume: 'plain brown-red lamellar armor', palette: 'brown, dull red', expression: 'blunt, uneasy', notes: 'plain, not heroic' },
      file: 'weixu.png', status: 'planned',
    },
  ];
  // 曹軍部將、工兵隊是泛用部隊，不做專屬頭像（遊戲裡維持 SVG）

  // 組出完整提示詞。刻意不放人名：模型看到「Guan Yu」之類的名字容易套用現有遊戲／影視的造型，只用外貌描述生成；人名留在紀錄裡：固定模板 + 角色描述（角色只能改外貌、年齡、服裝、盔甲、配色、表情）
  function buildPrompt(ch, mood) {
    const T = TEMPLATE, d = ch.design;
    const expression = mood && mood.expression ? mood.expression : d.expression;
    const positive = [
      `Portrait of an original character: a late Eastern Han dynasty Chinese ${ch.role.includes('軍師') || ch.role.includes('謀') ? 'strategist' : ch.role.includes('君主') ? 'warlord' : 'general'}, designed from the description below only.`,
      `Style: ${T.style}.`,
      `Subject: ${d.face}. ${d.hair}. Wearing ${d.costume}. Character palette: ${d.palette}. Expression: ${expression}.${d.notes ? ' Notes: ' + d.notes + '.' : ''}`,
      `Face: ${T.face}.`,
      `Lighting: ${T.lighting}.`,
      `Composition: ${T.composition}.`,
      `Color: ${T.color}.`,
      `Background: ${T.background}.`,
    ].join('\n');
    const negative = T.negative.join(', ');
    return {
      positive, negative, template: T.version,
      // 不支援負面提示詞的工具（ChatGPT 等）用單段版本
      combined: `${positive}\nDo not include: ${negative}.`,
      // Midjourney：一行，正方形，原始風格，--no 放主要禁止項
      midjourney: `${positive.replace(/\n/g, ' ')} --ar 1:1 --style raw --no ${T.negative.slice(0, 26).join(', ')}`,
    };
  }

  // 遊戲用：查某武將某情緒有沒有審核通過的圖片
  function approvedFile(id, mood) {
    const ch = CHARACTERS.find(c => c.id === id);
    if (!ch) return null;
    if (!mood || mood === 'default') return ch.status === 'approved' ? ch.file : null;
    const m = ch.moods && ch.moods[mood];
    return m && m.status === 'approved' ? m.file : null;
  }

  root.PORTRAIT_ART = { TEMPLATE, CHARACTERS, buildPrompt, approvedFile, DIR: 'assets/portraits/' };
})(typeof window !== 'undefined' ? window : globalThis);
