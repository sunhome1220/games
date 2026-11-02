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
- `taiwan-strait-landing/`：台海登陸戰棋（六角格兩棲登陸兵棋；單一 `index.html`，無外部函式庫）。單人可選攻方或守方，也可雙方同機或觀戰；下方的西太平洋戰區圖納入美、日、菲的基地與部隊（`BASES`、`FORCES`），各方海空軍、飛彈、防空以力量池（`POOL0`）計算制空與制海。各國參戰由擲骰加觸發條件決定，參戰後由電腦操作。電腦推演模式在 7 個事件節點暫停（`EVENTS` 陣列），可決策的用選項、不可控的擲骰。每回合結束有國際快訊；側欄「戰爭代價」把損失換算成軍民傷亡人數與經濟損失（換算參數在 `PERS`、`POOLCOST`、`FXCOST`、`GDPHIT`），結束時產生戰後檢討報告。改版時執行 `python3 taiwan-strait-landing/tools/bump_version.py 2026-xx-xx.nn` 更新版本號，玩家端會跳出「有新版本」提示
- `tx-futures/`：台指期預估・現價查詢（參考 optratw.com）。改版時執行 `python3 tx-futures/tools/bump_version.py 2026-xx-xx.nn` 更新版本號，使用者端會跳出「有新版本」提示。`node tx-futures/server.js` 後開 `http://localhost:8080`；`server.js` 代理期交所 MIS 報價（`/api/quote`），並把每個交易日最後一筆報價存到 `tx-futures/data/history.json`（`/api/history`，保留 60 天；非交易時段顯示最後紀錄）。另外參考新加坡 SGX 富時台灣指數期貨（日盤／電子盤，代號 `TWN`，網址可用環境變數 `SGX_CODE`、`SGX_URL_T`、`SGX_URL_T1` 覆寫），預估價＝選擇權買賣權平價隱含期貨價（K＋C−P）
- `proto-a.html`、`proto-c.html`：另外兩個原型
- `proto-b.html`：舊網址，會自動轉址到 `chess/`

## 專屬網址（Cloudflare Pages，免費）

`chess/` 裡的路徑全部是相對路徑，可以直接當成網站根目錄：在 Cloudflare Pages 連結這個 repo，Production branch 填 `main`、Build command 留空、Build output directory 填 `chess`，每次合併到 `main` 會自動部署（例如 `crazy-chess.pages.dev`）。在專屬網址上「← 選單」連結會自動隱藏（見 `chess/js/main.js` 的 `showMenuLink`）；放在 GitHub Pages 或本機時照常顯示。
