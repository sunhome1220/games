// 所有可調整的遊戲參數集中在這裡（單位：世界座標 px、秒）。畫面為直式、鳥瞰。
const CONFIG = {
  world: { w: 560, h: 1000 },

  castle: {
    hp: 10,          // 弱點 ×2、威力加成後單發傷害可到 6，血量要夠高才不會一發結束
    w: 170, h: 84,   // 主堡佔地（紅在下、藍在上，貼著場地邊緣）
    hitShake: 0.45,  // 受擊震動秒數
    gate: { halfW: 30, depth: 34, mult: 2 }, // 正面城門＝弱點：傷害 ×mult
    tower: { r: 26, reduce: 1 },             // 四角塔樓＝裝甲：傷害 −reduce（最低 0，被彈開）
  },

  tank: {
    r: 34,                 // 碰撞半徑
    hullLen: 78, hullWid: 44,
    startOffset: 175,      // 起始位置距離己方場邊
    startX: [165, 395],    // 每方兩台戰車的起始 x
    barrelLen: 54,
    hp: 3,                 // 戰車生命值
  },

  // 第 1 段：選一台戰車，拖曳蓄力（向後拉，反方向衝刺）
  pull: {
    min: 26,          // 低於此距離視為取消
    max: 170,         // 最大蓄力距離
    bodyShift: 0.35,  // 蓄力時車體往後退的比例
  },

  // 回力車馬達：加速 → 滑行 → 減速
  motor: {
    vMin: 340,        // 最小蓄力初速 (px/s)
    vMax: 1050,       // 最大蓄力初速
    accelTime: 0.22,  // 從 0 加速到初速的時間
    decel: 800,       // 滑行減速度
    stopSpeed: 14,    // 低於此速度視為停下
    restitution: 0.55, // 撞到障礙／牆／主堡的反彈係數
  },

  // 罰球式瞄準條：鎖定砲管方向後，在擺動的指針經過綠區時按下。
  // 目標越近（near）綠區越寬、指針越慢、誤差越小；越遠（far）反之
  accuracy: {
    near: 150, far: 520,     // 距離範圍 (px)，區間外取端點
    zoneNear: 0.34, zoneFar: 0.07, // 綠區半寬（佔半個條的比例）：完全沒有誤差
    errNear: 3, errFar: 16,  // 綠區外最大角度誤差（度）
    speedNear: 1.0, speedFar: 2.3, // 指針每秒掃過整條幾次
    startDelay: 0.3,         // 條出現後多久才接受按下（避免誤觸）
    timeout: 4,              // 超時自動鎖定
  },

  // 第 2 段：砲塔瞄準（向後拉，砲管朝反方向）→ 放手開砲
  attack: {
    damage: 1,         // 基礎傷害（對主堡與戰車；寶箱可加成）
    range: 520,        // 砲彈基礎射程；目標必須在射程內才打得到（寶箱可加成）
    shellSpeed: 950,   // 砲彈飛行速度 (px/s)
    aimMin: 24,        // 瞄準時至少拉這麼遠才會開砲
    resolveDelay: 0.9, // 攻擊結束到換手的停頓
  },

  // 增益寶箱：戰車衝刺時碰到就會撿起，效果永久跟著該戰車
  powerups: {
    initial: 3,          // 開局場上數量
    maxOnField: 4,       // 場上最多同時存在幾個
    spawnEveryRound: 1,  // 每過幾輪（雙方各一回合）補一個
    pickupRadius: 28,    // 寶箱撿取半徑
    zone: { yMin: 220, yMax: 780, xMargin: 60 }, // 出現範圍
    types: {
      range:  { weight: 1, add: 100, max: 3 },  // 射程 +100，最多疊 3 次
      power:  { weight: 1, add: 1,   max: 2 },  // 威力 +1（砲彈傷害），最多疊 2 次
      repair: { weight: 1, heal: 1 },           // 戰車回復 1 點生命
    },
  },

  audio: { master: 0.5 },
};
