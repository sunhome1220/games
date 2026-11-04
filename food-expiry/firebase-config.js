// 貼上 Firebase 網頁應用程式的設定（專案設定 → 一般 → 您的應用程式 → SDK 設定與配置 → Config）。
// 這段是公開的網頁設定、不是密碼；資料是否可讀寫由 Firestore 規則決定（見 FIREBASE.md）。
// 還沒設定時維持 null，App 會當單機版使用。
window.FIREBASE_CONFIG = null;
/* 範例：
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "你的專案.firebaseapp.com",
  projectId: "你的專案",
  storageBucket: "你的專案.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
*/
