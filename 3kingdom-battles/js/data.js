// ===== 靜態資料：地形、兵種、陣型、武將、技能、戰役劇本（調整平衡主要改這裡） =====
(function (root) {

  // ---------- 地形 ----------
  // cost：移動消耗 [步/弓, 騎, 器械]（Infinity＝不能進入）；dmg：在此格受到的傷害倍率；h：高度（高打低有利）
  const TERRAIN = {
    '.': { name: '平原', desc: '一般地形。', cost: [1, 1, 1], dmg: 1.0, h: 0 },
    ',': { name: '道路', desc: '大路，水淹時也不會淹。', cost: [1, 1, 1], dmg: 1.0, h: 0 },
    'f': { name: '樹林', desc: '移動較慢、受傷較少，騎兵不能衝鋒，器械進不去。', cost: [2, 3, Infinity], dmg: 0.85, h: 0, cover: true },
    'h': { name: '丘陵', desc: '移動較慢；居高臨下攻擊有加成。', cost: [2, 3, Infinity], dmg: 0.9, h: 1 },
    '~': { name: '河流', desc: '不能通行，只能走渡口。', cost: [Infinity, Infinity, Infinity], dmg: 1, h: -1 },
    '=': { name: '渡口', desc: '過河的地方；在渡口上受傷較多。', cost: [1, 1, 2], dmg: 1.1, h: 0 },
    'd': { name: '河堤', desc: '第 6 回合起，曹軍步兵或弓兵站在這裡可以「掘堤」，挖滿 4 次就水淹下邳。', cost: [1, 1, Infinity], dmg: 1.0, h: 0 },
    'l': { name: '低地', desc: '城外的低窪地；水淹時會變成大水。', cost: [1, 1, 1], dmg: 1.0, h: 0 },
    'w': { name: '大水', desc: '步騎可涉水（移動消耗較多、受傷 +10%），器械過不去；3 回合後退成泥濘。', cost: [2, 3, Infinity], dmg: 1.1, h: -1, water: true },
    'm': { name: '泥濘', desc: '大水退去後的泥地，移動較慢，器械也能緩慢通過。', cost: [2, 2, 3], dmg: 1.05, h: 0 },
    'W': { name: '城牆', desc: '守軍只能從城門上下城；攻方步兵要先架雲梯才能攀城。', cost: [1, 1, Infinity], dmg: 1.0, h: 2, wall: true, hp: 60 },
    'T': { name: '箭樓', desc: '城牆四角，每回合自動向附近敵軍放箭。', cost: [1, 1, Infinity], dmg: 1.0, h: 2, wall: true, tower: true, hp: 80 },
    'G': { name: '城門', desc: '守軍進出城的地方；攻方要用衝車撞破。', cost: [1, 1, 1], dmg: 1.0, h: 2, wall: true, gate: true, hp: 100 },
    'o': { name: '破城門', desc: '城門已破，雙方都能通行。', cost: [1, 1, 1], dmg: 1.0, h: 0 },
    'r': { name: '城牆缺口', desc: '城牆被打塌的缺口，可以從這裡進城。', cost: [2, 2, Infinity], dmg: 0.95, h: 0 },
    'c': { name: '城內', desc: '城裡的街道。', cost: [1, 1, 1], dmg: 1.0, h: 0, city: true },
    'P': { name: '府衙', desc: '城中央。曹軍佔領這裡就獲勝。', cost: [1, 1, 1], dmg: 0.9, h: 0, city: true, palace: true },
    'b': { name: '斷橋', desc: '橋板被拆掉了，部隊過不去；只有孫權能「躍馬」跳過。', cost: [Infinity, Infinity, Infinity], dmg: 1.0, h: -1, broken: true },
    'S': { name: '糧營', desc: '曹軍的糧草營；呂布軍突入會燒掉糧草。', cost: [1, 1, 1], dmg: 1.0, h: 0, depot: true },
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
    jianxiong: { name: '奸雄', kind: 'passive', desc: '周圍 2 格內友軍每回合士氣 +3、陣勢 +4；合擊加成 ×1.5。' },
    jili: { name: '激勵', kind: 'active', cd: 4, target: 'none', desc: '3 格內友軍士氣 +15、陣勢 +10。' },
    ganglie: { name: '剛烈', kind: 'passive', desc: '被攻擊時反擊傷害提高 50%。' },
    heji: { name: '合擊', kind: 'passive', desc: '與友軍夾擊時，合擊加成翻倍。' },
    rende: { name: '仁德', kind: 'active', cd: 3, target: 'none', desc: '自己與相鄰友軍士氣 +20、陣勢 +15。' },
    wusheng: { name: '武聖', kind: 'passive', desc: '攻擊力 +20%。' },
    weizhen: { name: '威震', kind: 'active', cd: 3, target: 'enemy', rng: 1, desc: '猛攻相鄰敵軍：傷害 ×1.3，目標陣勢再 −15，目標周圍敵軍士氣 −10。' },
    lijian: { name: '離間', kind: 'active', cd: 3, target: 'enemy', rng: 4, desc: '4 格內敵軍士氣 −18；對忠誠低的將領效果加倍。' },
    wushuang: { name: '無雙', kind: 'passive', desc: '攻擊力 +30%，反擊不減半。' },
    feijiang: { name: '飛將', kind: 'active', cd: 3, cost: 12, target: 'self', desc: '本次行動移動 +2、無視敵軍阻擋，下一次攻擊 ×1.4 並額外打亂陣型。' },
    tuxi: { name: '突襲', kind: 'active', cd: 3, cost: 12, target: 'self', desc: '本次行動移動 +3、無視敵軍阻擋，衝鋒加成再提高。' },
    xianzhen: { name: '陷陣', kind: 'passive', desc: '「每所攻擊無不破者」：攻擊 +35%，打中敵軍時額外打亂對方陣型；「鎧甲斗具皆精練齊整」：受到的傷害 −20%；陣型被打亂的程度減半，不會潰逃、永不就地解散。' },
    qishe: { name: '騎射', kind: 'passive', desc: '「轅門射戟」：射箭威力與精銳弓兵相當，射程 3。' },
    xiandeng: { name: '先登', kind: 'passive', desc: '每戰常先登：攻擊 +15%；陣型被打亂的程度減半，永不就地解散。' },
    liaolai: { name: '遼來', kind: 'passive', desc: '「遼來遼來」：攻擊 +20%；每回合結束時，2 格內的敵軍士氣 −4。' },
    duanhou: { name: '斷後', kind: 'passive', desc: '友軍撤退時拚死斷後：受到的傷害 −25%，陣型被打亂的程度減半，不會潰逃。' },
    huoji: { name: '火計', kind: 'active', cd: 3, target: 'enemy', rng: 3, desc: '3 格內放火：兵力 −8%、陣勢 −20；對攻城器械 ×3，在樹林中 ×1.5。' },
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
    lubu: { name: '呂布', mark: '呂', lead: 88, war: 100, int: 26, skills: ['wushuang', 'feijiang', 'qishe'], bio: '「人中呂布，馬中赤兔」，天下無雙的猛將；弓馬嫺熟，曾在轅門一箭射中畫戟小枝。' },
    zhangliao: { name: '張遼', mark: '張', lead: 90, war: 92, int: 78, skills: ['tuxi', 'heji'], bio: '呂布麾下騎將，日後的合肥守將。' },

    gaoshun: { name: '高順', mark: '高', lead: 86, war: 85, int: 60, skills: ['xianzhen'], bio: '統領「陷陣營」：七百餘兵號為千人，鎧甲精練，每所攻擊無不破者（遊戲比例）。' },
    chengong: { name: '陳宮', mark: '陳', lead: 70, war: 55, int: 92, skills: ['huoji'], bio: '呂布的謀主，屢獻良策卻不被採用。' },
    houcheng: { name: '侯成', mark: '侯', lead: 46, war: 65, int: 40, loyal: 30, skills: [], bio: '呂布部將，曾因私釀酒被呂布責罵。' },
    songxian: { name: '宋憲', mark: '宋', lead: 42, war: 60, int: 38, loyal: 35, skills: [], bio: '呂布部將。' },
    sunquan: { name: '孫權', mark: '孫', lead: 80, war: 67, int: 80, skills: ['jili'], bio: '吳侯，趁曹操西征漢中，親率十萬大軍北攻合肥。' },
    lumeng: { name: '呂蒙', mark: '蒙', lead: 86, war: 80, int: 88, skills: ['heji'], bio: '吳下阿蒙已非昔日，督軍攻城。' },
    ganning: { name: '甘寧', mark: '甘', lead: 84, war: 92, int: 68, skills: ['tuxi'], bio: '錦帆賊出身的猛將，曾以百騎夜襲曹營。' },
    lingtong: { name: '凌統', mark: '凌', lead: 78, war: 86, int: 62, skills: ['duanhou'], bio: '吳軍勇將，逍遙津之戰率親兵拚死護送孫權。' },
    jiangqin: { name: '蔣欽', mark: '蔣', lead: 74, war: 72, int: 60, skills: [], bio: '吳軍宿將，率弓弩隊。' },
    chenwu: { name: '陳武', mark: '陳', lead: 72, war: 84, int: 50, skills: [], bio: '吳軍騎將，在合肥之戰中力戰而死。' },
    wubu: { name: '吳軍部將', mark: '吳', lead: 55, war: 52, int: 40, skills: [], bio: '吳軍弓弩隊。' },
    lidian: { name: '李典', mark: '李', lead: 78, war: 75, int: 72, skills: ['heji'], bio: '與張遼素來不和，國難當前仍慨然隨張遼出戰。' },
    yuejin: { name: '樂進', mark: '樂', lead: 80, war: 82, int: 55, skills: ['xiandeng'], bio: '曹操密函指定「樂將軍守護軍，勿得與戰」。' },
    xueti: { name: '薛悌', mark: '薛', lead: 60, war: 35, int: 75, skills: [], bio: '護軍，帶來曹操「賊至乃發」的密函。' },
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

  // 合肥：城在北，淝水在東，逍遙津橋在城東南；吳軍從南邊來
  const HEFEI_MAP = [
    'hh..................~.hh',
    'h.......TWWWWWT.ff..~..h',
    '........WcccccW..f..~...',
    '..ff.h..WcccccW.....~...',
    '...f.h..WccPccG,....~.f.',
    '........WcccccW,....~.f.',
    '........WcccccW.,..~~...',
    '........TWWGWWT.,.l~....',
    '...........,.....,l~....',
    '....f......,.....,l~....',
    '....ff.....,......,=,,,,',
    '...........,......l~....',
    '...........,......l~....',
    '..ff.......,......l~~ff.',
    '...........,hh..f...~...',
    '.........S.,....ff..~.h.',
    'h.....ff...,........~..h',
    'hh..................~..h',
  ];

  const SCENARIOS = [
    {
      id: 'xiapi', no: 1, name: '下邳之戰', year: '198 年（建安三年）冬', diff: '易', playable: true,
      map: XIAPI_MAP,
      sides: {
        att: { name: '曹操軍', short: '曹', color: '#3b6fc4', tone: 'blue', leader: 'caocao' },
        def: { name: '呂布軍', short: '呂', color: '#c8463a', tone: 'red', leader: 'lubu' },
      },
      blurb: { att: '野戰擊破呂布，渡河圍城、水攻下邳', def: '以寡敵眾，守住下邳直到曹軍糧盡' },
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
          '第 6 回合起可以「掘堤」：派步兵或弓兵站到城北泗水邊的「河堤」（地圖上標著 ⛏ 的兩格）執行「掘堤」，累計 4 次就引泗水、沂水灌城。',
          '水淹之後：城外低地變成大水（步兵、騎兵可以涉水但走得慢、受傷較多；器械過不去，原本在低地上的器械會被沖走）；3 回合後大水退成泥濘，器械也能慢慢通過。通往城門的大路不會淹。城內每回合糧食 −3、守軍士氣 −4，城牆耐久慢慢下降。',
          '進出城只能走城門：守軍回城、出城都要經過城門；攻方步兵要靠雲梯攀城，或等城門、城牆被打破。',
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
      id: 'hefei', no: 2, name: '合肥之戰', year: '215 年（建安二十年）', diff: '中', playable: true,
      map: HEFEI_MAP,
      sides: {
        att: { name: '孫權軍', short: '吳', color: '#c8463a', tone: 'red', leader: 'sunquan' },
        def: { name: '張遼軍', short: '魏', color: '#3b6fc4', tone: 'blue', leader: 'zhangliao' },
      },
      blurb: { att: '十萬大軍圍攻合肥，趕在疫病蔓延前破城', def: '八百敢死突襲吳營，守住合肥、逍遙津追擊' },
      // 劇本裡的武將能力調整（覆蓋 GENERALS）
      genMod: { zhangliao: { lead: 94, war: 95, skills: ['tuxi', 'liaolai'], bio: '曹魏名將，合肥守將。' } },
      units: [
        // 攻方（吳）
        { gen: 'sunquan', side: 'att', type: 'inf', troops: 4000, c: 12, r: 14, face: 2, form: 'yulin' },
        { gen: 'lumeng', side: 'att', type: 'inf', troops: 3500, c: 9, r: 12, face: 2, form: 'yulin' },
        { gen: 'ganning', side: 'att', type: 'cav', troops: 2500, c: 14, r: 12, face: 2, form: 'fengshi' },
        { gen: 'lingtong', side: 'att', type: 'inf', troops: 2500, c: 10, r: 14, face: 2, form: 'yulin' },
        { gen: 'jiangqin', side: 'att', type: 'arc', troops: 3000, c: 13, r: 15, face: 2, form: 'yanxing' },
        { gen: 'chenwu', side: 'att', type: 'cav', troops: 2000, c: 7, r: 12, face: 1, form: 'fengshi' },
        { gen: 'wubu', side: 'att', type: 'arc', troops: 3000, c: 11, r: 15, face: 2, form: 'yanxing' },
        { gen: 'gongbing', side: 'att', type: 'ram', troops: 600, c: 11, r: 16, face: 2, label: '衝車' },
        { gen: 'gongbing', side: 'att', type: 'ladder', troops: 600, c: 9, r: 16, face: 2, label: '雲梯甲' },
        { gen: 'gongbing', side: 'att', type: 'ladder', troops: 600, c: 14, r: 16, face: 2, label: '雲梯乙' },
        // 守方（魏）：出城突擊的部隊
        { gen: 'zhangliao', side: 'def', type: 'cav', troops: 2000, c: 11, r: 9, face: 5, form: 'fengshi', label: '八百敢死' },
        { gen: 'lidian', side: 'def', type: 'inf', troops: 2000, c: 10, r: 8, face: 5, form: 'yulin' },
        // 守方：城內
        { gen: 'yuejin', side: 'def', type: 'inf', troops: 2000, c: 11, r: 5, face: 5, form: 'yulin' },
        { gen: 'xueti', side: 'def', type: 'arc', troops: 1500, c: 10, r: 7, face: 5, form: 'yanxing' },
        { gen: 'caobu', side: 'def', type: 'arc', troops: 1500, c: 12, r: 7, face: 5, form: 'yanxing' },
        { gen: 'caobu', side: 'def', type: 'inf', troops: 1500, c: 10, r: 5, face: 5, form: 'yulin' },
      ],
      hp: { G: 140, W: 80 },   // 合肥城小而堅（張遼事先加固城防）
      vars: { surpriseSide: 'att', surpriseUntil: 2, plague: false, plagueRound: 4, retreatRound: 9, retreating: false, retreatStart: 0, bridgeBroken: false, campBurnt: false, rocks: 6, oil: 3 },
      retreat: { att: [23, 10], def: [11, 3] },
      escape: [[22, 9], [23, 9], [22, 10], [23, 10], [22, 11], [23, 11], [21, 10], [21, 9], [21, 11]],
      brief: {
        background: '孫權趁曹操西征漢中，率十萬大軍進攻合肥。城中只有張遼、李典、樂進約七千人。護軍薛悌帶來曹操事先寫好的密函：「若孫權至者，張、李將軍出戰；樂將軍守護軍，勿得與戰。」',
        forces: {
          att: '孫權、呂蒙、甘寧、凌統、蔣欽、陳武等約 2 萬人（遊戲比例），另有衝車、雲梯兩架。',
          def: '城外：張遼「八百敢死」與李典準備天亮出擊；城內：樂進、薛悌與守軍約 6 千 5 百人。城門、城牆比一般城池堅固。',
        },
        goal: {
          att: ['攻下合肥府衙（城中央）或全滅魏軍即勝利', '第 4 回合起軍中疫病蔓延，第 9 回合（或兵力折損過半）必須撤軍', '撤軍時孫權過了逍遙津橋、退到東邊就算安全撤回；孫權被擊潰則大敗'],
          def: ['守住合肥，撐到吳軍撤退，並讓孫權退過逍遙津（史實）', '擊潰孫權部隊：生擒孫權（逆轉歷史）', '府衙被佔領或全軍覆沒則失敗'],
        },
        siege: [
          '第 1 回合天亮：張遼與李典已在南門外列陣，吳軍營寨還沒整好（陣型鬆散，第 1、2 回合吳軍攻擊力 ×0.7「倉促應戰」）。這是突襲孫權本陣的最好機會。',
          '張遼「遼來」：攻擊 +20%，每回合讓身邊 2 格內的吳軍士氣下降。',
          '進出城只能走城門（南門、東門）。突擊完要記得從城門退回城裡。',
          '吳軍要上城：雲梯架在城牆旁，步兵、弓兵才能攀城；衝車撞南門。城上守軍可用滾木礌石、火油，四角箭樓會自動放箭。',
          '吳軍大營在西南：魏軍部隊衝進大營會放火，吳軍全軍士氣 −10。',
          '第 4 回合起吳軍疫病蔓延：每回合兵力 −3%、士氣 −3。第 9 回合或兵力折損過半，孫權下令撤軍。',
          '撤軍後：吳軍要從東邊的逍遙津橋過淝水撤走。撤軍 2 回合後橋板被魏軍拆掉，只有孫權能「躍馬」跳過斷橋，其他人要靠凌統斷後。',
        ],
        history: [
          '張遼挑選八百名敢死之士，天亮時披甲持戟，率先衝陣，殺了數十人、斬二將，一路殺到孫權帥旗下，孫權大驚，退到小土丘上用長戟自守。',
          '張遼叱孫權下來決戰，孫權不敢動。吳軍重重包圍，張遼左衝右突，帶著部下突圍而出，又回頭救出被圍的部眾，吳軍士氣大挫。',
          '吳軍圍城十幾天攻不下，軍中又發生疫病，只好撤退。',
          '撤到逍遙津北岸時，張遼率步騎追擊。凌統率親兵三百拚死斷後，孫權躍馬跳過被拆斷的橋才逃脫。張遼從此威震江東，「遼來遼來」，小兒不敢夜啼。',
        ],
        paths: {
          att: {
            respect: '吳軍攻城不下、疫病蔓延而撤退，孫權在凌統掩護下躍馬過橋逃回江東。',
            reverse: '頂住張遼的晨襲，在疫病擴散前用雲梯、衝車強攻破城，拿下合肥。',
          },
          def: {
            respect: '張遼晨襲挫敵銳氣，堅守合肥直到吳軍撤退，再於逍遙津追擊。',
            reverse: '在晨襲或逍遙津追擊時擊潰孫權本陣，生擒孫權。',
          },
        },
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
