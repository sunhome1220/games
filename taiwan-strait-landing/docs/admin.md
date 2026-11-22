# 管理者開關（緊急關閉分享）

## 它做什麼
- 頁面開啟時先抓 `status.json`（加時間參數、不快取）。`open:false` ＝ 對外關閉：訪客只看到「目前暫停開放」＋你寫的訊息，遊戲畫面被蓋住。
- 管理者（你）：網址加 `?admin=密碼`，驗證通過後這台裝置記住，關閉期間照常使用，上方有「管理者模式」提示條。`?admin=logout` 登出。
- 抓不到 `status.json`（離線、網路錯誤）＝照常開放（不讓離線安裝的 App 壞掉）。

## 怎麼操作
1. 第一次：`python3 tools/admin.py passwd` 設定管理者密碼（只存雜湊 `adminHash`，密碼不進倉庫）→ commit、推到 main。
2. 緊急關閉：`python3 tools/admin.py close "維護中，稍後開放"` → commit、推到 main（或直接在 GitHub 網頁／手機 App 編輯 `taiwan-strait-landing/status.json`，把 `"open"` 改成 `false`）。Pages 約 1～2 分鐘生效。
3. 重新開放：`python3 tools/admin.py open`（或把 `open` 改回 `true`）。
4. 撤銷所有裝置的管理者身分：重新 `passwd`（換掉 `adminHash`）。

## 限制（務必知道）
- **這是軟性關閉**：程式碼放在公開倉庫，擋得住一般訪客，擋不住會自己下載、執行程式碼的人，也擋不了已經存下來的離線副本。
- 想要「真的全部下線」：GitHub 倉庫 Settings → Pages → Unpublish site，或把倉庫改為私人（會立即生效，是最後手段）。
- 管理者密碼的雜湊放在公開的 `status.json`，所以密碼要夠長（建議 16 字元以上的隨機字串），否則有被暴力猜出的風險。
- 生效需要「推到 main ＋ Pages 部署」，不是即時；要即時請用上面的 Unpublish。
