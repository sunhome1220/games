// ===== 靜態資料：地形、兵種、陣型、武將、技能、戰役劇本（調整平衡主要改這裡） =====
(function (root) {

  // ---------- 地形 ----------
  // cost：移動消耗 [步/弓, 騎, 器械]（Infinity＝不能進入）；dmg：在此格受到的傷害倍率；h：高度（高打低有利）
  const TERRAIN = {
    '.': { name: '平原', cost: [1, 1, 1], dmg: 1.0, h: 0 },
    ',': { name: '道路', cost: [1, 1, 1], dmg: 1.0, h: 0 },
    'f': { name: '樹林', cost: [2, 3, Infinity], dmg: 0.85, h: 0, cover: true },
    'h': { name: '丘陵', cost: [2, 3, Infinity], dmg: 0.9, h: 1 },
    '~': { name: '河流', cost: [Infinity, Infinity, Infinity], dmg: 1, h: -1 },
    '=': { name: '渡口', cost: [1, 1, 2], dmg: 1.1, h: 0 },
    'd': { name: '河堤', cost: [1, 1, Infinity], dmg: 1.0, h: 0 },
    'l': { name: '低地', cost: [1, 1, 1], dmg: 1.0, h: 0 },
    'w': { name: '大水', cost: [3, 4, Infinity], dmg: 1.15, h: -1, water: true },
    'W': { name: '城牆', cost: [1, 1, Infinity], dmg: 1.0, h: 2, wall: true, hp: 60 },
    'T': { name: '箭樓', cost: [1, 1, Infinity], dmg: 1.0, h: 2, wall: true, tower: true, hp: 80 },
    'G': { name: '城門', cost: [1, 1, 1], dmg: 1.0, h: 2, wall: true, gate: true, hp: 100 },
    'o': { name: '破城門', cost: [1, 1, 1], dmg: 1.0, h: 0 },
    'r': { name: '城牆缺口', cost: [2, 2, Infinity], dmg: 0.95, h: 0 },
    'c': { name: '城內', cost: [1, 1, 1], dmg: 1.0, h: 0, city: true },
    'P': { name: '府衙', cost: [1, 1, 1], dmg: 0.9, h: 0, city: true, palace: true },
    'S': { name: '糧營', cost: [1, 1, 1], dmg: 1.0, h: 0, depot: true },
  };

  // ---------- 兵種 ----------
  // move 移動力、spd 速度（決定行動順序）、atk 攻擊、def 防禦、rng 射程、mv 移動類別（0 步 1 騎 2 器械）
  const UNIT_TYPES = {
    inf: { name: '步兵', icon: '步', move: 4, spd: 6, atk: 10, def: 11, rng: 1, mv: 0 },
    cav: { name: '騎兵', icon: '騎', move: 6, spd: 9, atk: 12, def: 8, rng: 1, mv: 1, charge: true },
    arc: { name: '弓兵', icon: '弓', move: 4, spd: 5, atk: 9, melee: 5, def: 6, rng: 2, mv: 0, ranged: true },
    ram: { name: '衝車', icon: '衝', move: 3, spd: 3, atk: 2, def: 9, rng: 1, mv: 2, engine: true },
    ladder: { name: '雲梯', icon: '梯', move: 3, spd: 3, atk: 0, def: 6, rng: 0, mv: 2, engine: true },
    tower: { name: '井闌', icon: '闌', move: 2, spd: 2, atk: 7, def: 9, rng: 3, mv: 2, engine: true, ranged: true },
    cata: { name: '投石車', icon: '石', move: 2, spd: 2, atk: 14, def: 5, rng: 4, minRng: 2, mv: 2, engine: true, ranged: true },
  };
  // 兵種相剋：騎剋步、步剋弓、弓剋騎
  const COUNTER = { cav: { inf: 1.25, arc: 1.15 }, inf: { arc: 1.25, cav: 0.85 }, arc: { cav: 1.25, inf: 0.85 } };

  // ---------- 陣型 ----------
  // atk 攻擊倍率；def 受傷倍率 [正面, 前側, 後側, 背面]；move 移動加減；joint 合擊倍率；charge 衝鋒倍率；ranged 遠程倍率
  const BASE_DEF = [1.0, 1.2, 1.4, 1.6];
  const FORMATIONS = {
    fengshi: { name: '鋒矢陣', short: '鋒矢', atk: 1.15, def: [0.9, 1.4, 1.7, 1.9], charge: 1.45, desc: '箭頭狀突擊陣。衝鋒威力最大，但側面與背面非常脆弱，需要友軍掩護兩翼。' },
    yulin: { name: '魚鱗陣', short: '魚鱗', atk: 1.25, def: [0.85, 1.3, 1.6, 1.8], desc: '層層疊疊的主力陣。正面攻守俱強，兩側與背後是弱點。' },
    hexi: { name: '鶴翼陣', short: '鶴翼', atk: 1.1, def: [1.15, 1.1, 1.4, 1.6], joint: 2, desc: '兩翼張開的包圍陣。合擊加成翻倍，但中央正面較薄。' },
    yanxing: { name: '雁行陣', short: '雁行', atk: 0.9, def: [1.2, 1.2, 1.5, 1.7], ranged: 1.3, desc: '前後錯開的射擊陣。弓兵遠程攻擊 +30%，近戰較弱。' },
    changshe: { name: '長蛇陣', short: '長蛇', atk: 0.9, def: [1.0, 1.6, 1.6, 1.3], move: 2, desc: '一字長隊的行軍陣。移動 +2，適合趕路與追擊，被攔腰側擊最危險。' },
    fangyuan: { name: '方圓陣', short: '方圓', atk: 0.85, def: [1.0, 1.0, 1.0, 1.0], desc: '圓形密集防守陣。四面八方都沒有弱點，但攻擊力最低；被包圍時用來保命。' },
  };
  const DISORDER = { name: '無陣（混亂）', short: '混亂', atk: 0.65, def: [1.6, 1.6, 1.6, 1.6] };
  const FORM_ALLOWED = {
    inf: ['yulin', 'fengshi', 'hexi', 'changshe', 'fangyuan'],
    cav: ['fengshi', 'yulin', 'hexi', 'changshe', 'fangyuan'],
    arc: ['yanxing', 'changshe', 'fangyuan'],
  };
  const SIDE_NAME = ['正面', '前側', '後側', '背面'];

  // ---------- 技能 ----------
  // kind: passive 被動；active 主動（cd 冷卻回合、rng 範圍、target: self/ally/enemy/none）
  const SKILLS = {
    jianxiong: { name: '奸雄', kind: 'passive', desc: '周圍 2 格內友軍每回合士氣 +3、完整度 +4；合擊加成 ×1.5。' },
    jili: { name: '激勵', kind: 'active', cd: 4, target: 'none', desc: '3 格內友軍士氣 +15、完整度 +10。' },
    ganglie: { name: '剛烈', kind: 'passive', desc: '被攻擊時反擊傷害提高 50%。' },
    heji: { name: '合擊', kind: 'passive', desc: '與友軍夾擊時，合擊加成翻倍。' },
    rende: { name: '仁德', kind: 'active', cd: 3, target: 'none', desc: '自己與相鄰友軍士氣 +20、完整度 +15。' },
    wusheng: { name: '武聖', kind: 'passive', desc: '攻擊力 +20%。' },
    weizhen: { name: '威震', kind: 'active', cd: 3, target: 'enemy', rng: 1, desc: '猛攻相鄰敵軍：傷害 ×1.3，目標完整度再 −15，目標周圍敵軍士氣 −10。' },
    lijian: { name: '離間', kind: 'active', cd: 3, target: 'enemy', rng: 4, desc: '4 格內敵軍士氣 −18；對忠誠低的將領效果加倍。' },
    wushuang: { name: '無雙', kind: 'passive', desc: '攻擊力 +30%，反擊不減半。' },
    feijiang: { name: '飛將', kind: 'active', cd: 3, target: 'self', desc: '本次行動移動 +2、無視敵軍阻擋，下一次攻擊 ×1.4 並額外打亂陣型。' },
    tuxi: { name: '突襲', kind: 'active', cd: 3, target: 'self', desc: '本次行動移動 +3、無視敵軍阻擋，衝鋒加成再提高。' },
    xianzhen: { name: '陷陣', kind: 'passive', desc: '攻擊 +15%；陣型被打亂的程度減半，永不就地解散。' },
    huoji: { name: '火計', kind: 'active', cd: 3, target: 'enemy', rng: 3, desc: '3 格內放火：兵力 −8%、完整度 −20；對攻城器械 ×3，在樹林中 ×1.5。' },
  };

  // ---------- 武將 ----------
  // lead 統率（陣型穩定、合擊、恢復）、war 武力（攻擊、單挑）、int 智力；loyal 忠誠（低的可能倒戈）
  const GENERALS = {
    caocao: { name: '曹操', mark: '曹', lead: 92, war: 72, int: 91, skills: ['jianxiong', 'jili'], bio: '司空，親率大軍東征呂布。' },
    xiahoudun: { name: '夏侯惇', mark: '夏', lead: 85, war: 90, int: 58, skills: ['ganglie', 'heji'], bio: '曹操族弟，勇猛剛烈。' },
    liubei: { name: '劉備', mark: '劉', lead: 78, war: 75, int: 76, skills: ['rende'], bio: '被呂布奪去徐州，投奔曹操一同討伐。' },
    guanyu: { name: '關羽', mark: '關', lead: 95, war: 97, int: 75, skills: ['wusheng', 'weizhen'], bio: '劉備義弟，萬人之敵。' },
    xunyou: { name: '荀攸', mark: '荀', lead: 70, war: 30, int: 94, skills: ['lijian'], bio: '軍師，與郭嘉力勸曹操引水灌城。' },
    caobu: { name: '曹軍部將', mark: '魏', lead: 58, war: 55, int: 40, skills: [], bio: '曹軍弓弩隊。' },
    gongbing: { name: '工兵隊', mark: '工', lead: 40, war: 20, int: 30, skills: [], bio: '操作攻城器械的工兵。' },
    lubu: { name: '呂布', mark: '呂', lead: 88, war: 100, int: 26, skills: ['wushuang', 'feijiang'], bio: '「人中呂布，馬中赤兔」，天下無雙的猛將。' },
    zhangliao: { name: '張遼', mark: '張', lead: 90, war: 92, int: 78, skills: ['tuxi', 'heji'], bio: '呂布麾下騎將，日後的合肥守將。' },
    gaoshun: { name: '高順', mark: '高', lead: 86, war: 85, int: 60, skills: ['xianzhen'], bio: '統領「陷陣營」，所攻無不破者。' },
    chengong: { name: '陳宮', mark: '陳', lead: 70, war: 55, int: 92, skills: ['huoji'], bio: '呂布的謀主，屢獻良策卻不被採用。' },
    houcheng: { name: '侯成', mark: '侯', lead: 46, war: 65, int: 40, loyal: 30, skills: [], bio: '呂布部將，曾因私釀酒被呂布責罵。' },
    songxian: { name: '宋憲', mark: '宋', lead: 42, war: 60, int: 38, loyal: 35, skills: [], bio: '呂布部將。' },
    weixu: { name: '魏續', mark: '魏', lead: 44, war: 62, int: 35, loyal: 35, skills: [], bio: '呂布部將。' },
  };

  // ---------- 戰役劇本 ----------
  // map：奇數列右移的六角格（欄 0..23、列 0..17）；圖例見 TERRAIN
  const XIAPI_MAP = [
    'hhh..ff....~.....ff..hhh',
    'hh..f......~d.....f...hf',
    '.....f.....~d.........ff',
    '.......f...=............',
    '.......ff..~.lllllllllll',
    '......hh...~.llTWWWWWTll',
    '...f.......~.llWcccccWll',
    '...........~.llWcccccWll',
    '.S.........~.llWcccccWll',
    ',,,,,,,,,,,=,,,G,,P,,G,,',
    '...........~.llWcccccWll',
    '........f..~~llWcccccWll',
    '......h.....~llWcccccWll',
    '......hh....~llTWWWWWTll',
    '...f....f...~lllllllllll',
    '...ff...f...=.........f.',
    'hh.......f..~....ff...ff',
    'hh..........~....ff.....',
  ];

  const SCENARIOS = [
    {
      id: 'xiapi', no: 1, name: '下邳之戰', year: '198 年（建安三年）冬', diff: '易', playable: true,
      map: XIAPI_MAP,
      sides: {
        att: { name: '曹操軍', short: '曹', color: '#3b6fc4', leader: 'caocao' },
        def: { name: '呂布軍', short: '呂', color: '#c8463a', leader: 'lubu' },
      },
      units: [
        // 攻方（曹）
        { gen: 'caocao', side: 'att', type: 'inf', troops: 5000, c: 3, r: 9, face: 0, form: 'yulin' },
        { gen: 'xiahoudun', side: 'att', type: 'cav', troops: 4000, c: 2, r: 6, face: 0, form: 'fengshi' },
        { gen: 'liubei', side: 'att', type: 'inf', troops: 3000, c: 4, r: 11, face: 0, form: 'yulin' },
        { gen: 'guanyu', side: 'att', type: 'cav', troops: 3000, c: 2, r: 12, face: 0, form: 'fengshi' },
        { gen: 'xunyou', side: 'att', type: 'arc', troops: 3000, c: 2, r: 8, face: 0, form: 'yanxing' },
        { gen: 'caobu', side: 'att', type: 'arc', troops: 3000, c: 2, r: 10, face: 0, form: 'yanxing' },
        { gen: 'gongbing', side: 'att', type: 'ram', troops: 600, c: 1, r: 9, face: 0, label: '衝車' },
        { gen: 'gongbing', side: 'att', type: 'cata', troops: 600, c: 0, r: 9, face: 0, label: '投石車' },
        { gen: 'gongbing', side: 'att', type: 'ladder', troops: 600, c: 0, r: 8, face: 0, label: '雲梯甲' },
        { gen: 'gongbing', side: 'att', type: 'ladder', troops: 600, c: 0, r: 10, face: 0, label: '雲梯乙' },
        { gen: 'gongbing', side: 'att', type: 'tower', troops: 600, c: 1, r: 10, face: 0, label: '井闌' },
        // 守方（呂布）：城外野戰部隊
        { gen: 'lubu', side: 'def', type: 'cav', troops: 4000, c: 8, r: 8, face: 3, form: 'fengshi' },
        { gen: 'zhangliao', side: 'def', type: 'cav', troops: 3000, c: 8, r: 6, face: 3, form: 'fengshi' },
        { gen: 'gaoshun', side: 'def', type: 'inf', troops: 2500, c: 9, r: 10, face: 3, form: 'yulin', label: '陷陣營' },
        // 守方：城內守軍
        { gen: 'chengong', side: 'def', type: 'arc', troops: 2500, c: 15, r: 9, face: 3, form: 'yanxing' },
        { gen: 'songxian', side: 'def', type: 'arc', troops: 2000, c: 15, r: 7, face: 3, form: 'yanxing' },
        { gen: 'weixu', side: 'def', type: 'inf', troops: 2000, c: 15, r: 11, face: 3, form: 'yulin' },
        { gen: 'houcheng', side: 'def', type: 'inf', troops: 2500, c: 17, r: 9, face: 3, form: 'yulin' },
      ],
      vars: { supply: 30, food: 36, dig: 0, digNeed: 4, digUnlock: 6, flooded: false, betrayed: false, rocks: 8, oil: 4, depotBurnt: false },
      // 各方在戰場邊緣的撤退方向（潰逃時往這裡跑）
      retreat: { att: [0, 9], def: [23, 9] },
      brief: {
        background: '曹操與劉備聯軍東征徐州的呂布。呂布在彭城一帶迎戰，屢戰屢敗，退守下邳。下邳城外有泗水、沂水環繞，城池堅固，曹軍遠道而來，糧草有限。',
        forces: {
          att: '曹操、夏侯惇、劉備、關羽、荀攸等約 2 萬 1 千人，另有衝車、投石車、雲梯兩架、井闌。',
          def: '城外：呂布、張遼兩支騎兵與高順「陷陣營」約 9 千 5 百人；城內：陳宮、宋憲、魏續、侯成約 9 千人。',
        },
        goal: {
          att: ['攻下府衙（城中央）或擒獲呂布即勝利', '曹軍糧草耗盡就必須退兵（失敗）', '曹操部隊被擊潰也算失敗'],
          def: ['撐到曹軍糧草耗盡退兵即勝利', '擊潰曹操部隊也能直接獲勝', '呂布被擒或府衙被佔領則失敗'],
        },
        siege: [
          '先在泗水西岸打野戰，再渡河圍城。河上只有北、中、南三個渡口。',
          '城牆上的守軍很難打：近戰要先用「雲梯」架在城牆旁，再從梯子攻上去；「衝車」專打城門；「投石車」可以打塌城牆、造出缺口；部隊站在「井闌」旁邊時，攻擊城牆的效果比較好。',
          '守城可以用「滾木礌石」「火油」打城牆下的敵軍，四角的箭樓會自動放箭。也可以打開城門出城突擊。',
          '第 6 回合起可以「掘堤」：派步兵或弓兵到城北的河堤上挖堤，挖滿就能引泗水、沂水灌城。大水會淹沒城外低地，城內糧草與士氣每回合下降。',
          '城內守將士氣太低時，忠誠度低的將領可能倒戈開城。',
        ],
        history: [
          '十月，曹操東征，呂布在城外連戰皆敗，退回下邳固守。',
          '陳宮建議「掎角之計」：呂布帶兵駐紮城外、陳宮守城，曹軍攻城就從背後襲擊，攻城外就從城裡出兵。呂布的妻子勸阻，呂布沒有採用。',
          '圍城兩個多月，曹軍疲憊，曹操一度想退兵；荀攸、郭嘉勸他繼續，並掘開泗水、沂水灌城。',
          '十二月，侯成、宋憲、魏續綁了陳宮，率眾開城投降。呂布在白門樓上被圍，最後投降。',
          '曹操本想收用呂布，劉備提醒他呂布曾背叛丁原、董卓，曹操於是下令縊殺呂布，陳宮、高順也被處死。張遼率部投降，從此成為曹魏名將。',
        ],
        paths: {
          att: {
            respect: '先在野戰中擊潰城外部隊，再掘堤水攻，讓城內士氣崩潰、引發倒戈開城。',
            reverse: '不靠水攻與倒戈，直接用器械強攻破城；或在野戰中就擒獲呂布。',
          },
          def: {
            respect: '照史實退守城內，就會走向白門樓的結局。',
            reverse: '採用陳宮的掎角之計：派騎兵留在城外襲擾曹軍糧營、守住河堤阻止水攻，維持城內士氣，撐到曹軍糧盡退兵。',
          },
        },
      },
    },
    {
      id: 'hefei', no: 2, name: '合肥之戰', year: '215 年（建安二十年）', diff: '中', playable: false,
      sides: { att: { name: '孫權軍', short: '吳', color: '#c8463a', leader: 'sunquan' }, def: { name: '張遼軍', short: '魏', color: '#3b6fc4', leader: 'zhangliao' } },
      brief: {
        background: '孫權趁曹操西征漢中，率十萬大軍進攻合肥。城中只有張遼、李典、樂進約七千人。曹操事先留下密函：「若孫權至者，張、李將軍出戰；樂將軍守護軍，勿得與戰。」',
        history: [
          '張遼挑選八百名敢死之士，天亮時突襲吳軍大營，一路殺到孫權帥旗下，孫權退到小土丘上用長戟自守。',
          '吳軍圍城十幾天攻不下，軍中又發生疫病，只好撤退。',
          '撤到逍遙津北岸時，張遼率軍追擊。凌統拚死斷後，孫權躍馬跳過斷橋才逃脫。張遼從此威震江東。',
        ],
        teaser: '以寡擊眾、出城突擊、逍遙津追擊戰（製作中）',
      },
    },
    {
      id: 'fancheng', no: 3, name: '樊城之戰', year: '219 年（建安二十四年）', diff: '難', playable: false,
      sides: { att: { name: '關羽軍', short: '蜀', color: '#2e9e5b', leader: 'guanyu' }, def: { name: '曹仁軍', short: '魏', color: '#3b6fc4', leader: 'caoren' } },
      brief: {
        background: '關羽從江陵北上，圍攻曹仁駐守的樊城。曹操派于禁率七軍救援。',
        history: [
          '秋天連日大雨，漢水暴漲，于禁的七軍全被淹沒，于禁投降，龐德不屈被斬。',
          '樊城一度危急，滿寵勸曹仁死守。徐晃率援軍擊敗關羽，關羽撤圍。',
          '同時東吳呂蒙白衣渡江，糜芳、士仁投降。關羽敗走麥城，在臨沮被擒、被斬。',
        ],
        teaser: '多路援軍、水淹七軍、後方被偷襲（製作中）',
      },
    },
  ];

  root.DATA = { TERRAIN, UNIT_TYPES, COUNTER, BASE_DEF, FORMATIONS, DISORDER, FORM_ALLOWED, SIDE_NAME, SKILLS, GENERALS, SCENARIOS };
})(typeof window !== 'undefined' ? window : globalThis);
