// 所有可調整的遊戲參數集中在這裡（單位：世界座標 px、秒）
const CONFIG = {
  world: { w: 1000, h: 560, groundY: 400 },

  castle: {
    hp: 3,
    w: 110,          // 主堡寬度（主堡正面位於 w 與 world.w - w）
    h: 190,
    hitShake: 0.45,  // 受擊震動秒數
  },

  tank: {
    w: 92, h: 46, wheelR: 14,
    startX: 195,          // 左方戰車起始 x（右方鏡像）
    backLimit: 12,        // 戰車後端距離己方主堡正面的最小空隙
    laneY: { left: 478, right: 432 }, // 兩台戰車走不同車道，不會互相卡住
  },

  // 拖曳蓄力
  pull: {
    min: 28,          // 低於此距離視為取消
    max: 180,         // 最大蓄力距離（再拉也不會更強）
    bodyShift: 0.4,   // 蓄力時車體往後退的比例（視覺 + 實際起點）
  },

  // 回力車馬達：加速 → 滑行 → 減速
  motor: {
    vMin: 380,        // 最小蓄力的初速 (px/s)
    vMax: 1250,       // 最大蓄力的初速
    accelTime: 0.22,  // 從 0 加速到初速的時間
    decel: 800,       // 滑行減速度
    stopSpeed: 14,    // 低於此速度視為停下
    wallRestitution: 0.55, // 撞到敵方主堡的反彈係數
  },

  // 攻擊：車頭前緣到敵方主堡正面的「空隙」必須落在 [minGap, maxGap] 才會命中
  attack: {
    damage: 1,
    minGap: 105,      // 太近砲管壓不下去
    maxGap: 300,      // 最大射程
    shellTime: 0.6,   // 砲彈飛行時間
    resolveDelay: 0.9, // 攻擊結束到換手的停頓
  },

  audio: { master: 0.5 },
};
