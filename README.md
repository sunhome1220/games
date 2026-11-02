# games

- `index.html`：原型選單
- `chess/`：瘋狂象棋（原型 B，已拆成多個檔案）
  - `index.html`：頁面；`css/style.css`：樣式；`js/*.js`：程式（依 `index.html` 內的順序載入）
  - `js/version.js`：版本號。改版時執行 `python3 chess/tools/bump_version.py 2026-xx-xx.nn`，同步更新版本與 `index.html` 的快取參數
  - `js/render3d.js`、`js/view3d.js`：立體 3D 畫面與設定（Three.js 放在 `vendor/three.min.js`，選 3D 才會載入；用到的類別有增減時執行 `bash chess/tools/build_three.sh` 重新打包）
  - `manifest.webmanifest`、`icons/`、`js/pwa.js`：加到主畫面（圖示是用 `tools/icon.html` 的 3D 場景渲染，`node chess/tools/make_icons.js` 重新產生）與全螢幕按鈕
  - `CARDS.md`：強化卡牌表的維護說明；`vendor/`：PeerJS（連線對戰）
- `3kingdom-battles/`：三國・名戰錄（立體 3D 回合制攻守城戰，歷史戰役關卡），說明見 `3kingdom-battles/README.md`
- `pikmin-like/`：小芽隊長（2D 即時群體操作，類皮克敏玩法；單一 `index.html`，無外部函式庫）。改版時執行 `python3 pikmin-like/tools/bump_version.py 2026-xx-xx.nn` 更新版本號，玩家端會跳出「有新版本」提示
- `pullback-rush/`：Pullback Rush（回力戰車同畫面雙人對戰，純 Canvas、無外部函式庫）。`js/config.js` 集中所有參數（蓄力、馬達、射程、主堡血量），`js/audio.js` 合成音效，`js/game.js` 邏輯與繪圖。本機執行：`python3 -m http.server` 後開 `/pullback-rush/`。改版時執行 `python3 pullback-rush/tools/bump_version.py 2026-xx-xx.nn` 更新版本號，玩家端會跳出「有新版本」提示
- `taiwan-strait-landing/`：台海登陸戰棋（六角格兩棲登陸兵棋；單一 `index.html`，無外部函式庫）。單人可選攻方或守方，也可雙方同機或觀戰；開局為 5 頁設定精靈（每頁有說明，可上一步／下一步，設定會記錄），側欄分頁，主地圖可縮放與全螢幕；下方的西太平洋戰區圖納入美、日、菲的基地與部隊（`BASES`、`FORCES`），各方海空軍、飛彈、防空以力量池（`POOL0`）計算制空與制海。各國參戰由擲骰加觸發條件決定，參戰後由電腦操作。電腦推演模式在 7 個事件節點暫停（`EVENTS` 陣列），可決策的用選項、不可控的擲骰。每回合結束有國際快訊；戰區圖標出中方火箭軍、空軍、海軍基地與集結港（`CNB`），台灣長程飛彈與美日部隊可以打擊，並會招致中方報復；主地圖可切換標準／放大／最大；側欄「戰爭代價」把損失換算成軍民傷亡人數與經濟損失（換算參數在 `PERS`、`POOLCOST`、`FXCOST`、`GDPHIT`），結束時產生戰後檢討報告。改版時執行 `python3 taiwan-strait-landing/tools/bump_version.py 2026-xx-xx.nn` 更新版本號，玩家端會跳出「有新版本」提示。模式含「純模擬」：先瞬間錄下整場戰爭（`startVideo`），再以戰棋地圖為背景像影片般播放，下方字幕區顯示動作與影響，可暫停、變速、拖曳時間軸。地圖採 3D 地塊（`buildStatic` 靜態層、`renderMap` 動態層），攻防有彈道、爆炸與棋子滑動等動畫（`runFx`）。可加到主畫面：`manifest.webmanifest` 與 `icons/`（`icon.svg` 為圖示原稿，改圖後執行 `node taiwan-strait-landing/tools/make_icons.cjs` 重新輸出各尺寸 PNG）。可在設定頁或影片模式「跑統計」（`runStats`）：電腦自動模擬 50／100／300 局並列出勝率、代價與決策影響；操作階段可按「電腦代打剩餘單位」（`assistPhase`）；手機版設定精靈排在地圖前、操作列固定在底部。判定有「僵局」：只達成首都且已連續控制 2 個回合以上（`verdict`、`tpHeldTurns`）；守方在首都或港口失守時會集結反攻（`aiDefUnit`）。設定頁以選項按鈕列搭配單句說明，底部固定上一步／下一步／開始；結果頁頂部固定判定與三項條件、內容以可收折區塊（`acc`）呈現、底部固定操作按鈕。美軍有三種立場：隱蔽支援、代理打擊（不承認參戰）、公開參戰，傷亡累計到門檻時會擲骰退縮（`usIdx`、`usReview`）；影片字幕區等文字框固定高度，播放時版面不跳動。兵力年代（2026 現況／2028／2030，`ERA`）依公開報導加入雲峰、東風-15／16／17／26／21D、PCH-191、HIMARS 等，資料依據與限制見 `taiwan-strait-landing/DATA.md`；參戰情境新增「只提供情報」，已移除菲律賓；地圖外圍加入示意區（宮古／先島、舟山、黃山、梅州、呂宋北部美軍），縮小才看得到；外圍示意區含美日沖繩／關島／第7艦隊／九州與共軍沿海投射區，各方遠程火力由這些位置發出；點外圍基地可看說明與概略射程，手機支援雙指縮放；共軍航艦、巡弋飛彈、制空與防空壓制兩層空戰、海上交戰（護航艦隊、潛艦）；美軍至少是代理打擊（台美共用飛彈與魚雷）、台灣海鯤潛艦；兵力年代改為 2026～2032 逐年、守方布雷（火山布雷車與水雷）；共軍潛艦（含反潛對抗）；每格最多 2 個友軍單位（堆疊）；參戰情境新增「依自身利益決定」、火力動畫依軍種有不同彈道、潛艦圖示；水面艦艇上地圖（共軍護航艦、守方艦艇群）；地圖格數加倍（細格約 36×36）；台灣依真實地形重畫、機場增加、東岸飛彈與共軍航艦群上地圖、雄二／雄三存量；艦艇可移動、航艦飽和攻擊、西太平洋戰區呈現呂宋；停戰（攻方）／放棄（守方）評估；台灣反艦火力依發射平台分列、損失來源統計；機動發射車隱蔽與打了就跑
- `tx-futures/`：台指期預估・現價查詢（參考 optratw.com）。改版時執行 `python3 tx-futures/tools/bump_version.py 2026-xx-xx.nn` 更新版本號，使用者端會跳出「有新版本」提示。`node tx-futures/server.js` 後開 `http://localhost:8080`；`server.js` 代理期交所 MIS 報價（`/api/quote`），並把每個交易日最後一筆報價存到 `tx-futures/data/history.json`（`/api/history`，保留 60 天；非交易時段顯示最後紀錄）。另外參考新加坡 SGX 富時台灣指數期貨（日盤／電子盤，代號 `TWN`，網址可用環境變數 `SGX_CODE`、`SGX_URL_T`、`SGX_URL_T1` 覆寫），預估價＝選擇權買賣權平價隱含期貨價（K＋C−P）
- `proto-a.html`、`proto-c.html`：另外兩個原型
- `proto-b.html`：舊網址，會自動轉址到 `chess/`

## 專屬網址（Cloudflare Pages，免費）

`chess/` 裡的路徑全部是相對路徑，可以直接當成網站根目錄：在 Cloudflare Pages 連結這個 repo，Production branch 填 `main`、Build command 留空、Build output directory 填 `chess`，每次合併到 `main` 會自動部署（例如 `crazy-chess.pages.dev`）。在專屬網址上「← 選單」連結會自動隱藏（見 `chess/js/main.js` 的 `showMenuLink`）；放在 GitHub Pages 或本機時照常顯示。
