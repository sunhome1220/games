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
- `proto-a.html`、`proto-c.html`：另外兩個原型
- `proto-b.html`：舊網址，會自動轉址到 `chess/`

## 專屬網址（Cloudflare Pages，免費）

`chess/` 裡的路徑全部是相對路徑，可以直接當成網站根目錄：在 Cloudflare Pages 連結這個 repo，Production branch 填 `main`、Build command 留空、Build output directory 填 `chess`，每次合併到 `main` 會自動部署（例如 `crazy-chess.pages.dev`）。在專屬網址上「← 選單」連結會自動隱藏（見 `chess/js/main.js` 的 `showMenuLink`）；放在 GitHub Pages 或本機時照常顯示。
