# 多人共用（Firebase）設定

1. <https://console.firebase.google.com> → 新增專案（可關閉 Google Analytics）。
2. 建構 → **Firestore Database** → 建立資料庫（正式版模式，位置選 `asia-east1` 台灣或 `asia-northeast1` 東京）。
3. Firestore → **規則**，貼上以下內容後發布：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 只有知道「家庭代碼」（不可被列舉）的人能讀寫該家庭的資料
    match /families/{family}/{document=**} {
      allow read, write: if true;
    }
  }
}
```
   （沒有任何規則涵蓋 `/families` 本身，所以無法列出所有家庭，只能用代碼進入。）
4. 專案設定（齒輪）→ 一般 → 您的應用程式 → 新增 **網頁應用程式** `</>` → 複製 `firebaseConfig`，貼進 `firebase-config.js` 的 `window.FIREBASE_CONFIG`。
5. 建議：Google Cloud 主控台 → API 和服務 → 憑證 → 該 API 金鑰 → 應用程式限制選「網站」，加入 `https://你的帳號.github.io/*`，避免金鑰被他處使用。
6. 改版：`python3 food-expiry/tools/bump_version.py 2026-xx-xx.nn`，推到 `main`。

使用：App「⋯」選單 → 家庭共用 → 加入／建立（留白產生新代碼）→ 分享連結給家人。

## Google 帳號登入（選用，換手機時自動還原家庭）

1. Firebase 主控台 → **Authentication** → 開始使用 → **登入方式** → 啟用 **Google**（填專案公開名稱與支援電子郵件）。
2. Authentication → **設定** → **已授權的網域** → 新增 `sunhome1220.github.io`。
3. Firestore 規則加上這一段（放在 `match /databases/{database}/documents { ... }` 裡面）：
```
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
```
4. 使用：App「⋯」→ Google 帳號 → 使用 Google 登入。登入後，帳號會記住你的家庭代碼；換手機登入同一個 Google 帳號，家庭清單自動還原，不用輸入代碼。
