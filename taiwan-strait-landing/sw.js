/* 最小的 service worker：只為了符合瀏覽器的「可安裝 App」條件，不做任何快取（新版本由頁面自己的版本檢查提示更新）。 */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{}); // 不攔截，直接走網路
