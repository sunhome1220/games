'use strict';
/* ---------- 版本與更新提示 ---------- */
// 每次更新遊戲都要改 VERSION（可執行 python3 taiwan-strait-landing/tools/bump_version.py 2026-xx-xx.nn），並在下方 CHANGELOG 最前面補一筆更新內容（再補 tools/i18n/extras.tsv 的英日譯文）；頁面會定期抓自己比對，有新版就提示
const VERSION='2026-11-14.60';
$('#ver').textContent='版本 '+VERSION;
