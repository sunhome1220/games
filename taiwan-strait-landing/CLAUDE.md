# 台海兵棋推演（taiwan-strait-landing）— 開發規則

瀏覽器兵棋遊戲：`index.html`（HTML＋CSS）＋ `js/*.js`（程式，依 `index.html` 內的順序載入；沒有建置步驟）。使用者以繁體中文溝通。
任何模型接手前請先讀完這份文件；數據來源與推估說明在 `DATA.md`。

## 一、設計原則（使用者明確要求，不可違反）

1. **一切數字依物理與數學，不憑空生成**。損失的單位不會復原；效果要有來源（公開資料、既有機制）。
   - 反例（已修掉）：戰機「升空」讓空軍 +1、反擊用憑空的 50%／25%／60%、「秘密請求補給」直接加飛彈。
2. **合理是最高原則；真實為先，遊戲平衡不重要**（使用者明確要求）。勝率高低不是目標，每個數字與規則都要說得通。平衡統計只用來回報結果，不是調整數字的理由；發現沒有依據、為了平衡或好玩而設的數字，要列出來給使用者決定。
   **不為了平衡亂調資料**。「以真實資料為準，就算難也不是從改資料數據下手。攻方想贏可以開之前的外掛（假設情境），開了要在結算報告裡說明。」
3. **隨機只留天氣（依季節）**。決策用固定公式；命中率用小數累計（`hitP`、`takeInt`、`ACC`），不要新增散落的 `Math.random()` 判定。
   - 遊戲邏輯的亂數吃戰局種子（`seedRng`）；**動畫用 `NR()`**（原生亂數），不要讓動畫消耗種子。
4. **百分比要有根據**；沒有根據就明講「推估」，或不顯示百分比。
5. **美日介入由戰況自動判定**（`interestEval`）：不再有外交選項、不再有「參戰擲骰 ±N」加減值（`fxMod` 已移除）。守方先動手／縱深打擊用 `S.mods.escal` 反映在評估。
6. **提示文字不要出現「報復」字眼**（`retal` 只是內部變數名）。
7. **文字風格一致**：攻方／守方、白話、單行按鈕（括號內小字，由 `small.pn` 自動處理）。不要在 UI 寫「沙盒」，一律稱「假設情境」。
8. **成本意識**：使用者在意 token 用量；小改動不要大範圍重寫，不要重複探索。

## 〇、模型分工（依工作選模型）

模型只能由使用者用 `/model` 切換，工作中途不能自行切換。使用者要求切換時，依下列分工提醒，並在適當時機建議切換。

- **可用 Haiku（快速、便宜）**：改名、移動或刪除檔案；列 PR、查狀態；單純合併已確認無衝突的 PR；依既定模板改純文字（例如 CHANGELOG 條目、翻譯 TSV 的新增行）。
- **應用較強模型**：合併衝突處理（更新日誌、版本號、`extras.tsv` 的保留與補回要逐條判斷）；改遊戲邏輯或規則；讀測試結果並做判斷；平衡相關的判斷；修改本文件。
- **不確定時**：先用較強模型做，不要用 Haiku 冒險。改錯規則比多花一點成本更難修。

## 二、工作流程（每次改動）

0. **先說明、提問，等使用者確認才動手**（使用者明確要求）：任何修改程式、文件、設定或 git／PR 的動作之前，先說明準備做什麼、改哪些地方、可能的影響與不確定之處，並提問；使用者確認後才行動。只回答問題、查資料、讀程式碼等不改任何東西的工作可以直接做。使用者說「合併」時照第 4 點處理。
   - **例外（使用者 2026-11-12 指示「一切講求真實，以後不用特別再問」）**：已經確定要做的項目裡，數字或做法的選擇一律採最符合真實的方案，直接做，不再逐項詢問；沒有來源的數字照樣標★推估，並在 PR 與回報中列出。要不要做一個新項目、合併 PR，仍要使用者決定。
1. 先 `git fetch origin main`，再從**最新** `origin/main` 開新分支（`git checkout -B <branch> origin/main`）。
   - 本機的 `origin/main` 可能過期；過期會讓你在舊基準上改、推出衝突標記。
2. 實作 → 用 Playwright 實測（見第四節）→ 語法檢查。
3. 版本與資料：
   - `python3 tools/bump_version.py <版本>`，格式 `2026-11-10.NN`（NN 遞增）。會同時改 `js/version.js` 與 `index.html` 裡每個 js 檔的 `?v=` 快取參數。
   - `CHANGELOG`（在 `js/changelog.js`）：加在 `const CHANGELOG=[` 之後第一筆（最新在最上面）。
   - **翻譯不用每次改**（使用者 2026-11-14 指示）：平常改動不補 `extras.tsv`、不重建字典；累積一陣子後，使用者要求時再一次補英文（`extras.tsv`）並執行 `python3 tools/i18n/build_dict.py`（需要 `pip install opencc-python-reimplemented`）。
4. 提交、推送、用 GitHub MCP 開 PR。**不要擅自合併**。
   - 使用者說「合併」＝合併所有未合併的 PR（squash）；「合併N」＝只合併第 N 號。
   - 不要更新 Artifact。
5. 疊在未合併 PR 上的新 PR，要等前一個合併後，把 `origin/main` 併進來再合。衝突處理：`git merge -X ours origin/main`，再檢查是否漏掉 CHANGELOG 條目、重新 bump 版本、重建字典。
6. 需要使用者決定的事，用 AskUserQuestion（選項最多 4 個），不要憑空替他決定重大設計。

## 三、程式結構速查

- **檔案配置**（2026-11-14.39 起由單一 `index.html` 拆開；只改相關的檔案，不要整批讀）：
  - `index.html`：HTML 與 CSS（CSS 留在頁內：規則裡有 `fill:url(#gu-atk)` 這類指向頁內 SVG 漸層的寫法，匯出截圖也會讀 `document.styleSheets`，搬到外部檔在部分瀏覽器與 `file://` 下有風險）。
  - `js/dict.js`：翻譯字典，`build_dict.py` 產生，**不要手改、不要讀**（單行約 680 KB）。`js/i18n.js`：語言切換；`js/btnfix.js`：按鈕括號小字；`js/gamepad.js`：手把。
  - 遊戲程式（依載入順序）：`map`（格子、地形、地點、亂數）→ `state`（狀態、台灣海軍）→ `rules`（規則、海運、殺傷鏈）→ `supply`（補給線）→ `ending`（結局、評分、難度、戰績）→ `theater`（事件節點、力量池、基地、美軍立場、雷達、空軍、飛彈、航艦）→ `strike`（縱深打擊）→ `decisions`（守方決策、重新開始）→ `report`（戰區圖、代價、戰後報告、快訊）→ `turn`（回合流程、天候、港口破壞、停戰、盟軍棋子）→ `ai` → `render`（地圖）→ `fx`（動畫、除錯鉤子、手機浮動卡片）→ `video`（影片、匯出、語音、事件卡）→ `stats` → `input` → `unitinfo`（單位說明、戰局碼）→ `version` → `changelog` → `app`（安裝、設定、精靈、縮放、更新檢查、啟動）。
  - 這些檔案是**一般 script（不是 module）、共用同一個全域作用域**：頂層的 `const`／`let`／`function` 彼此看得到，所以頂層名稱不能重複，也不要和瀏覽器內建的全域名稱（`top`、`name`、`status`…）相同。函式可以跨檔互相呼叫；但**載入當下就執行的頂層程式**只能用到前面檔案已宣告的東西，所以新增檔案或調整順序後要重新載入確認沒有錯誤。每個檔案第一行是 `'use strict';`。
  - 新增 js 檔：在 `index.html` 依順序加 `<script src="js/名稱.js?v=版本"></script>`（`bump_version.py` 會檢查每個 js 檔都有 `?v=`）。
  - `index.html` 裡有一行含 `const VERSION='…'` 的註解，是給還停在單檔版的玩家端更新檢查用的，不要刪。
- 全域狀態 `S`；單位、棋子顏色分三類（`unitCat`）；事件節點 `EVENTS`（守方決策用 `defend:true`，戰前三項用 `setup:` 對應設定頁欄位）。
- 設定精靈：`SETUP_PAGES`（欄位 `{sel,q,when,grp,opts:{值:[標籤,說明]}}`）。新增設定項要同步四處：隱藏的 `<select id=opt…>`、change 監聽清單、`CFG_IDS`、`DEFAULT_CFG`。
- 確定性：`hitP(p,key)`、`takeInt`、`ACC`；天候 `nextWave/rollWeather`；戰局碼 `seedCode/parseSeedCode/initSeed`。
- 補給與運輸：`unloadCap`、`resolveSupply`、`convoyTurn`、`liftTurn`、`supplyAttrition`；運輸船是真實棋子，可被攻擊。
- 打擊大陸：`strikeCN`（人工與電腦共用同一個飛彈存量與命中公式）、`aiPickCN`。台灣方用 `lrSpend`：300 km 內優先用陸軍戰術飛彈（`rocAtc`，佔用海馬士一次齊射），其餘用雄二E（`rocMsl`）。
- 海馬士：`HMR_ERA`（各年代發射車、棋子數、ATACMS 枚數、GMLRS 莢艙數）、`hmrSpread`（車數平均分配）、`HMR_PKG`（一次齊射最多 4 輛）。
- 潛艦（海鯤）：`subTargets/fireSub/subHidden`；在海上隱蔽、回港時才看得到、可被打。
- 地圖尺度：`KM_HEX`（`js/map.js`，目前 20）＝每格（相鄰格中心距離）幾公里。**射程、移動、距離一律用公里寫，再用 `kmH(km)` 換成格數**（例如 `rd(a,b)<=kmH(80)`、`mv:kmH(40)`），不要再寫裸的格數；地面「相鄰」＝`ADJ_KM`（40 km，`ring2`）。新寫的程式也要照做。
  - 2026-11-14.44 完成第 1 步（統一公里單位，行為不變）。還沒換算、改尺度時要一起處理的：地形來源仍是 40 km 粗格切 2×2（`map.js` 的 `TERC`／`FK`／`FC`）、地點座標與登陸區清單、`nbrs` 一格內的鄰接（佔領擴張 `claim`、接觸判定 `gContact`、登陸）、`landDist` 的步數成本、文字說明裡的「N 格」。
  - 第 2 步（用真實經緯度重建地形）、第 3 步（改成 10 km 並測手機效能）尚未開始，使用者要再決定。
- 除錯鉤子：網址加 `?debug=1`，提供 `window.__S`、`__dog`、`__fg`、`__ledger` 等。

## 四、測試與工具注意事項

- Playwright 已預裝：`require('playwright')`，`chromium.launch({executablePath:'/opt/pw-browsers/chromium'})`。加速用：`window.setTimeout` 包一層縮短等待。
- 設定精靈現在有 **5～6 頁**，測試要連按 `#wzNext` 至少 5 次（用 `if(n&&!n.disabled)` 保護）才能 `#btnStart`。
- 模擬對局：每個彈窗點 `#mbox .opt`／`#evRoll`／`#evGo`／`#itGo`，人類回合點 `#btnAssist`。長時間工作用 `( cmd & )` 背景執行再等結果。
- 語法檢查：`for f in js/*.js; do node --check $f; done`。
- 改程式用 Python 腳本替換時，對每個 `old` 先 `assert s.count(old)==1`。
- 新舊版比對（重構時用）：`?debug=1` 的 `window.__score(cfg)` 跑一場電腦推演並回傳分數；用 `addInitScript` 把 `Math.random` 換成固定種子的亂數，新舊兩版結果應完全相同。
- **不要用 `git checkout -- <檔案>` 或 `git checkout <檔案>` 還原**——會丟掉所有未提交的修改（曾經因此重做全部工作）。要保護進度就先 `git commit`。
- 不要用 `git push --force` 覆蓋別人的分支；覆蓋自己剛推錯的分支用 `--force-with-lease`。
- 提交訊息與 PR 描述結尾要加上工作階段給的署名行。

## 五、已知的未完成事項（使用者擱置或待決定）

- 剩餘的隨機改成固定公式（電腦決策、事件骰、`pick`／`wpick`／`Math.random` 殘留）。
- 難度評分基準重建（等規則穩定後再一次調整；暫停中）。
- 潮汐擱淺（古寧頭效應）、增援完全由運力驅動、守方優先打運輸船、「隱形戰機台軍看不到」空戰選項、雷霆2000 砲兵（尚未加入）。
- 日文翻譯約 900 條仍回退英文（見 `tools/i18n/ja_todo.txt`）。
