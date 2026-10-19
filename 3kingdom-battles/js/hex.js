// ===== 六角格座標（尖頂、奇數列右移 odd-r） =====
// 地圖用 (c, r) = (欄, 列) 記錄；距離與方向換成 axial (q, r) 計算。
// 方向編號 0..5：0 東、1 東北、2 西北、3 西、4 西南、5 東南（逆時針，每格 60°）。
(function (root) {
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]; // axial (dq, dr)
  const DIR_NAME = ['東', '東北', '西北', '西', '西南', '東南'];
  const S3 = Math.sqrt(3);

  const toAx = (c, r) => [c - ((r - (r & 1)) >> 1), r];
  const fromAx = (q, r) => [q + ((r - (r & 1)) >> 1), r];
  const key = (c, r) => c + ',' + r;
  const unkey = k => k.split(',').map(Number);

  function neighbor(c, r, d) {
    const [q, rr] = toAx(c, r); const [dq, dr] = DIRS[((d % 6) + 6) % 6];
    return fromAx(q + dq, rr + dr);
  }
  function neighbors(c, r) { return DIRS.map((_, d) => neighbor(c, r, d)); }
  function dist(c1, r1, c2, r2) {
    const [q1, a] = toAx(c1, r1), [q2, b] = toAx(c2, r2);
    const dq = q1 - q2, dr = a - b;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }
  // 平面座標（單位：格半徑 1）；x 向東、y 向南
  function center(c, r) { return [S3 * (c + 0.5 * (r & 1)), 1.5 * r]; }
  // 從 a 看 b 的方向（0..5，取最接近的 60° 扇區）
  function dirTo(c1, r1, c2, r2) {
    const [x1, y1] = center(c1, r1), [x2, y2] = center(c2, r2);
    let ang = Math.atan2(-(y2 - y1), x2 - x1) * 180 / Math.PI; // 數學角度：0 東、逆時針
    if (ang < 0) ang += 360;
    return Math.round(ang / 60) % 6;
  }
  // 兩個方向差幾面：0 同向 … 3 相反
  function dirDiff(a, b) { const d = (((a - b) % 6) + 6) % 6; return d > 3 ? 6 - d : d; }
  const angleOf = d => d * 60; // 度數（數學角度）

  root.HEX = { DIRS, DIR_NAME, toAx, fromAx, key, unkey, neighbor, neighbors, dist, center, dirTo, dirDiff, angleOf, S3 };
})(typeof window !== 'undefined' ? window : globalThis);
