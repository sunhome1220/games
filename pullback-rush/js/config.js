// 所有可調整的遊戲參數集中在這裡（單位：世界座標 px、秒）。畫面為直式、鳥瞰。
const CONFIG = {
  world: { w: 560, h: 1000 },

  castle: {
    hp: 3,
    w: 250, h: 92,   // 主堡佔地（紅在下、藍在上，貼著場地邊緣）
    hitShake: 0.45,  // 受擊震動秒數
  },

  tank: {
    r: 34,                 // 碰撞半徑
    hullLen: 78, hullWid: 44,
    startOffset: 175,      // 起始位置距離己方場邊
    barrelLen: 54,
  },

  // 第 1 段：拖曳蓄力（向後拉，反方向衝刺）
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

  // 第 2 段：砲塔瞄準（向後拉，砲管朝反方向）→ 放手開砲
  attack: {
    damage: 1,
    range: 540,        // 砲彈最大射程；主堡必須在射程內才打得到
    shellSpeed: 950,   // 砲彈飛行速度 (px/s)
    aimMin: 24,        // 瞄準時至少拉這麼遠才會開砲
    resolveDelay: 0.9, // 攻擊結束到換手的停頓
  },

  // 障礙物（上下左右對稱）：kind = crate | barrel | rock
  obstacles: [
    { kind: 'rock',   x: 280, y: 500, r: 40 },
    { kind: 'crate',  x: 150, y: 400, r: 30 }, { kind: 'crate',  x: 410, y: 600, r: 30 },
    { kind: 'barrel', x: 410, y: 400, r: 26 }, { kind: 'barrel', x: 150, y: 600, r: 26 },
    { kind: 'crate',  x: 130, y: 250, r: 28 }, { kind: 'crate',  x: 430, y: 750, r: 28 },
  ],

  audio: { master: 0.5 },
};
