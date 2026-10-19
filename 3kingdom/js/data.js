// ===== 三國・攻城守城：靜態資料（地圖、城池、武將、攻守戰術與克制表）=====
const MW = 800, MH = 520;   // 地圖邏輯尺寸
const FACTIONS = {
  wei:  { name: '魏', col: '#3b6fc4', capital: 'luoyang' },
  shu:  { name: '蜀', col: '#2e9e5b', capital: 'chengdu' },
  wu:   { name: '吳', col: '#d0453a', capital: 'jianye' },
  none: { name: '中立', col: '#8d8d8d' },
};
// lead 統率（影響攻城輸出）、int 智力（影響守城時克制戰術的效果）
const GENERALS = {
  caocao:     { name: '曹操', lead: 9, int: 8 },  xiahoudun: { name: '夏侯惇', lead: 8, int: 4 },  simayi:  { name: '司馬懿', lead: 7, int: 10 }, zhangliao: { name: '張遼', lead: 9, int: 6 },
  liubei:     { name: '劉備', lead: 7, int: 7 },  guanyu:    { name: '關羽', lead: 10, int: 6 },    zhangfei:{ name: '張飛', lead: 9, int: 4 },  zhugeliang:{ name: '諸葛亮', lead: 6, int: 10 },
  sunquan:    { name: '孫權', lead: 7, int: 7 },  zhouyu:    { name: '周瑜', lead: 8, int: 9 },     lusun:   { name: '陸遜', lead: 7, int: 9 },  lvmeng:   { name: '呂蒙', lead: 8, int: 7 },
  guard:      { name: '守將', lead: 5, int: 5 },
};
// id、名稱、座標、初始勢力、初始兵力、城牆上限、兵力上限、每回合收入（金）、守將
const CITY_DEFS = [
  ['changan', '長安', 240, 160, 'none', 280, 260, 900, 30, 'guard'],
  ['luoyang', '洛陽', 400, 175, 'wei', 800, 500, 1500, 52, 'caocao'],
  ['ye',      '鄴',   570, 105, 'wei', 440, 300, 1000, 40, 'zhangliao'],
  ['xuchang', '許昌', 520, 250, 'wei', 440, 300, 1000, 40, 'simayi'],
  ['wan',     '宛',   385, 310, 'none', 260, 220, 800, 25, 'guard'],
  ['xiangyang','襄陽', 440, 372, 'none', 260, 260, 800, 30, 'guard'],
  ['shouchun','壽春', 630, 320, 'wu', 300, 300, 900, 28, 'lusun'],
  ['hanzhong','漢中', 170, 275, 'shu', 460, 300, 900, 35, 'zhaoyun_'],
  ['chengdu', '成都', 80, 372,  'shu', 800, 500, 1500, 55, 'liubei'],
  ['yongan',  '永安', 250, 388, 'shu', 420, 280, 900, 35, 'guanyu'],
  ['jiangling','江陵', 390, 452, 'none', 260, 240, 800, 30, 'guard'],
  ['chaisang','柴桑', 570, 428, 'wu', 360, 300, 900, 28, 'lvmeng'],
  ['jianye',  '建業', 715, 380, 'wu', 640, 500, 1500, 45, 'sunquan'],
];
GENERALS.zhaoyun_ = { name: '趙雲', lead: 9, int: 6 };
const EDGES = [['changan', 'luoyang'], ['luoyang', 'ye'], ['luoyang', 'xuchang'], ['ye', 'xuchang'], ['luoyang', 'wan'], ['xuchang', 'wan'], ['xuchang', 'shouchun'],
  ['wan', 'xiangyang'], ['xiangyang', 'jiangling'], ['changan', 'hanzhong'], ['hanzhong', 'chengdu'], ['hanzhong', 'wan'], ['chengdu', 'yongan'], ['yongan', 'xiangyang'],
  ['yongan', 'jiangling'], ['jiangling', 'chaisang'], ['chaisang', 'jianye'], ['shouchun', 'jianye'], ['shouchun', 'chaisang']];
const ARMY_SPEED = 150;   // 行軍：每回合走多遠（地圖像素）
const MIN_SEND = 30;      // 最少出兵數
// 攻城戰術：對城牆傷害 wall、對守軍殺傷 kill、己方損失 loss（皆為「攻城兵力」的比例）；starve 圍困改用守軍兵力的比例
const ATK = {
  ram:    { name: '衝車', ic: '🪵', wall: 0.6, kill: 0.05, loss: 0.06, tip: '撞擊城門與城牆，拆城最快；怕守軍出城燒毀' },
  ladder: { name: '雲梯', ic: '🪜', wall: 0.1, kill: 0.35, loss: 0.25, tip: '強攻上城，殺傷守軍最多但自己傷亡慘重；怕固守與箭雨' },
  fire:   { name: '火攻', ic: '🔥', wall: 0.3, kill: 0.2, loss: 0.04, tip: '火燒城樓，傷城牆也傷守軍；怕潑水滅火' },
  starve: { name: '圍困', ic: '🏕️', wall: 0, kill: 0.08, loss: 0.01, tip: '斷糧耗守軍，幾乎沒有損失；怕守軍出城破圍' },
};
// 守城戰術：lossMul 攻方傷亡倍率、selfLoss 守方自損（守軍兵力比例）
const DEF = {
  hold:   { name: '固守', ic: '🛡️', lossMul: 0.8, selfLoss: 0, tip: '堅守不出，剋雲梯' },
  arrow:  { name: '箭雨', ic: '🏹', lossMul: 1.6, selfLoss: 0, tip: '萬箭齊發，大量殺傷攻方，剋雲梯' },
  sortie: { name: '出城', ic: '🐎', lossMul: 1.2, selfLoss: 0.08, tip: '開城突擊，剋衝車與圍困，但自己會有損失' },
  water:  { name: '潑水', ic: '💧', lossMul: 0.6, selfLoss: 0, tip: '備水滅火，剋火攻' },
};
// 攻方效果倍率 MATRIX[攻][守]：小於 1 代表被剋制
const MATRIX = {
  ram:    { hold: 0.6, arrow: 0.9, sortie: 0.5, water: 1.3 },
  ladder: { hold: 0.5, arrow: 0.4, sortie: 1.3, water: 1.4 },
  fire:   { hold: 1.0, arrow: 1.1, sortie: 1.3, water: 0.3 },
  starve: { hold: 1.4, arrow: 1.2, sortie: 0.4, water: 1.3 },
};
const RECRUIT = { cost: 80, troops: 100 }, REPAIR = { cost: 60, wall: 50 };
