# 台海兵棋推演：兵力資料依據與限制

遊戲裡的「兵力」是抽象的點數，不是真實數量。本文件說明各項數值參考了哪些公開報導、做了哪些假設。
資料整理於 2026 年 11 月，各項數量並不公開，不同來源也有出入，請當作示意，不要當作事實引用。

## 分類檔案（docs/data/）

數據說明依主題拆成下列檔案；查證或修改某一類數字時，只要讀對應的檔案。

| 檔案 | 內容 | ★ 推估條目數 |
|---|---|---|
| [`docs/data/eras.md`](docs/data/eras.md) | 兵力年代、兵力規模與限制 | 1 |
| [`docs/data/taiwan.md`](docs/data/taiwan.md) | 台灣（守方）：兵力、海軍與潛艦、守方決策 | 6 |
| [`docs/data/pla.md`](docs/data/pla.md) | 共軍（攻方）：兵力與艦隊 | 2 |
| [`docs/data/missiles.md`](docs/data/missiles.md) | 飛彈、命中率與攔截：反艦、長程打擊、海馬士、射程 | 25 |
| [`docs/data/air.md`](docs/data/air.md) | 空軍、機場與空戰海戰 | 14 |
| [`docs/data/ground.md`](docs/data/ground.md) | 地面作戰、登陸與補給 | 9 |
| [`docs/data/map.md`](docs/data/map.md) | 地圖、地形與地理位置 | 4 |
| [`docs/data/misc.md`](docs/data/misc.md) | 美軍立場、語言與語音 | 2 |

新增或修改數據時：寫進對應主題的檔案（找不到合適的就放 `misc.md`），沒有來源的數字標 ★；程式裡的變數名稱寫在說明中，方便雙向查找。

## 來源

- Yun Feng：<https://en.wikipedia.org/wiki/Yun_Feng>
- 台灣特別預算：<https://news.usni.org/2025/11/26/taiwan-rolls-out-40b-defense-supplemental-to-fund-air-defense-asymmetric-capabilities>、<https://globaltaiwan.org/2026/03/the-contents-and-controversies-of-taiwans-special-defense-budget/>
- 對台軍售交付進度：<https://tsm.schar.gmu.edu/taiwan-arms-sale-backlog-june-2026-update/>
- F-16V 交付：<https://www.defensenews.com/global/asia-pacific/2026/10/02/taiwans-first-two-f-16v-fighter-jets-arrive-to-bolster-defenses-against-china/>
- 海鯤潛艦：<https://en.wikipedia.org/wiki/Hai_Kun-class_submarine>
- 東風-26 數量：<https://www.tandfonline.com/doi/full/10.1080/00963402.2025.2467011>（Bulletin of the Atomic Scientists, Chinese nuclear weapons, 2025）
- PHL-16／PCH-191：<https://en.wikipedia.org/wiki/PHL-16>、<https://ssi.armywarcollege.edu/SSI-Media/Recent-Publications/Article/3622541/china-maritime-report-no-32-the-pch191-modular-long-range-rocket-launcher-resha/>
- 美國國防部 2025 年中國軍力報告摘要：<https://fas.org/publication/the-pentagons-slimmed-down-2025-china-military-power-report/>
- 共軍無人機：<https://www.taiwannews.com.tw/en/news/6364427>、<https://www.defenseone.com/ideas/2025/06/chinas-drone-arsenal-shows-power-civil-military-fusion/406118>、<https://www.cna.org/our-media/indepth/2025/09/china-readies-drone-swarms-for-future-war>、<https://drone-warfare.com/research/pla-drone-swarm/>、<https://interestingengineering.com/military/china-can-meet-only-60-of-wartime-drone-demand-study-finds>
