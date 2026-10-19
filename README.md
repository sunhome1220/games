# games

- `index.html`：原型選單
- `chess/`：回力車象棋（原型 B，已拆成多個檔案）
  - `index.html`：頁面；`css/style.css`：樣式；`js/*.js`：程式（依 `index.html` 內的順序載入）
  - `js/version.js`：版本號。改版時執行 `python3 chess/tools/bump_version.py 2026-xx-xx.nn`，同步更新版本與 `index.html` 的快取參數
  - `CARDS.md`：強化卡牌表的維護說明；`vendor/`：PeerJS（連線對戰）
- `proto-a.html`、`proto-c.html`：另外兩個原型
- `proto-b.html`：舊網址，會自動轉址到 `chess/`
