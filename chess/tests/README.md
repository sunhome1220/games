# 測試

自動化測試用 [Playwright](https://playwright.dev/)（Chromium）開真正的頁面，直接呼叫遊戲自己的函式。

```bash
npm i playwright          # 第一次（或設定 NODE_PATH 指向已安裝的 playwright）
node chess/tests/run.js          # 全部測試
node chess/tests/run.js 炮       # 只跑名稱含「炮」的
node chess/tests/run.js regression   # 只跑某個檔案
FAST=1 node chess/tests/run.js       # 整局回歸只打 30 回合（完整約 5 分鐘，FAST 約 1 分鐘）
```

測試會自己啟動靜態伺服器（`games/` 為根目錄），不需要另外開伺服器。頁面出現 JS 錯誤或檔案 404 會自動判為失敗。

| 檔案 | 內容 |
|---|---|
| `rules.test.js` | 規則單元測試：各兵種移動／射程／威力／冷卻、波及、防空攔截、仕擋子彈、升官、霰彈、和局、戰地醫療、卡牌、取消移動、電腦 |
| `regression.test.js` | 整局回歸：單機隨機打完一局、連線（BroadcastChannel）整局兩邊局面一致、連線取消移動 |
| `view3d.test.js` | 立體畫面：載入、射線點選、手指旋轉、傾斜設定、翻轉視角、各種特效繪製（用軟體 WebGL 跑） |
| `site.test.js` | 檔案齊全與版本號一致、舊網址轉址、點擊操作流程 |
| `lib.js` | 共用：靜態伺服器、注入頁面的 `T_` 輔助函式（`place` 擺棋、`fire` 開火、`go` 走棋） |

## 寫新測試

在 `*.test.js` 匯出 `[{ name, async fn(t) { … } }]`：

```js
{ name: '俥威力 2', async fn(t) {
  const pg = await t.open();                       // 開遊戲（預設停掉自動動畫，時間由測試推進）
  const r = await pg.evaluate(() => {
    const [a, b] = T_.place([{ s: 0, t: 'R', c: 4, r: 6 }, { s: 1, t: 'N', c: 4, r: 3 }]);   // 紅俥 (4,6)、黑傌 (4,3)
    T_.fire(a, b);                                 // 開火並播完動畫（不結束回合）
    return b.hp;
  });
  t.assert.strictEqual(r, 1);
} }
```

規則改了（數值、射程…）就要同步更新對應的測試期望值。
