# 北捷駕駛模擬：瀏覽器測試

用 Playwright（Chromium、軟體繪圖）開真正的頁面，涵蓋物理與 ATP、事件、計分與排行榜、選單觸控、分享、行人、意見回饋、路線圖、手把（模擬輸入）等。

```bash
bash taipei-mrt-driver/tests/run.sh          # 全跑（約 10 分鐘）
bash taipei-mrt-driver/tests/run.sh atp ui   # 只跑指定的
SHOT_DIR=/some/dir bash taipei-mrt-driver/tests/run.sh t8   # 部分測試會存截圖到 SHOT_DIR（沒設就放系統暫存目錄）
```

需求：Node.js、`playwright`（含 Chromium；`require('playwright')` 要找得到）、python3（腳本自己用 `python3 -m http.server 8765` 在倉庫根目錄起伺服器）。

## 單元測試（不開瀏覽器，約 1 秒）

`node taipei-mrt-driver/tests/unit/sim.test.cjs`（也包含在 `run.sh`，名稱 `unit`）：用 Node 的 `vm` 載入 `js/sim.js`（關卡建立、物理、ATP、計分、車門；不碰 DOM）加上資料與事件引擎，畫面與聲音的副作用以空函式取代。涵蓋加速／煞停距離、ATP 限速曲線與寬鬆／嚴格復歸、計分邊界、車門連動、關卡決定性等 31 項。改物理或規則時先跑這個，比瀏覽器測試快很多。

## 瀏覽器測試內容

| 檔案 | 測什麼 |
|---|---|
| `atp.cjs` | ATP 寬鬆／嚴格復歸、必須停車的情況 |
| `e1.cjs` | 突發事件規則 |
| `t7.cjs`／`t8.cjs` | 選單滑桿與起訖站、停車對位指示條等 |
| `r1.cjs` | 計分、結算、排行榜 |
| `b1.cjs` | 多語言廣播與字幕 |
| `tap.cjs` | iPhone 觸控位置（捲動、視窗高度改變） |
| `name.cjs` | 駕駛名稱 |
| `share.cjs` | 分享連結與成績分享 |
| `ped.cjs` | 行人不穿柱、不重疊 |
| `fb.cjs` | 意見回饋（mailto） |
| `lever.cjs` | 主控器 13 格點擊與拖曳 |
| `map.cjs` | 路線圖與限速預告 |
| `ui.cjs` | 選單簡化、首次教學、自動畫質 |
| `gp.cjs` | 手把（模擬 `navigator.getGamepads`） |
| `sig.cjs` | 號誌專項（SPAD、停止信號卡死檢查） |
| `soak.cjs` | 浸泡（各路線整班跑完、不報錯） |
| `pre.cjs` | 預載腳本：讓測試略過首次教學並展開進階設定（`ui.cjs` 不用） |

## 注意

- 這些測試在**軟體繪圖**下跑，驗證的是邏輯與版面，**不代表真實手機的效能或觸控手感**；iPhone、真實手把、真實喇叭與震動都要實機確認。
- 有些測試會用時間等待，機器很忙時偶爾會誤報；單獨重跑那一項確認。
- 全部是「一項 PASS 都沒有」就算失敗：伺服器沒起來時舊的寫法會顯示 0 項通過卻看似沒有錯誤，這裡已擋掉。
