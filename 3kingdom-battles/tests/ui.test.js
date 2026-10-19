// 介面測試
module.exports = [
  { name: '選關：三關都在，第 2、3 關製作中', async fn(env) {
    const pg = await env.open();
    const n = await pg.$$eval('#scList .sc', e => e.length);
    const locked = await pg.$$eval('#scList .sc.lock', e => e.length);
    env.assert.strictEqual(n, 3); env.assert.strictEqual(locked, 2);
    const w = await pg.evaluate(() => document.documentElement.scrollWidth);
    env.assert(w <= 420, '手機寬度不應水平捲動：' + w);
  } },
  { name: '選攻方 → 戰前說明 → 開戰，出現 3D 畫面與行動順序', async fn(env) {
    const pg = await env.open('seed=1');
    await pg.click('#scList button.att');
    env.assert(await pg.isVisible('#briefBox h1'));
    const txt = await pg.textContent('#briefBox');
    env.assert(txt.includes('尊重歷史') && txt.includes('逆轉歷史') && txt.includes('攻城戰說明'));
    await pg.click('#btnGo'); await env.myTurn(pg);
    env.assert(await pg.isVisible('#cv3'));
    env.assert((await pg.$$eval('#order .chip', e => e.length)) > 5);
  } },
  { name: '武將頭像：戰前說明列出登場武將，點開有演義外貌與情緒頭像', async fn(env) {
    const pg = await env.open();
    await pg.click('#scList button.att');
    const gens = await pg.$$eval('#briefBox .roster [data-gen]', e => e.map(x => x.dataset.gen));
    for (const g of ['caocao', 'xiahoudun', 'liubei', 'guanyu', 'xunyou', 'lubu', 'zhangliao', 'gaoshun', 'chengong', 'houcheng', 'songxian', 'weixu'])
      env.assert(gens.includes(g), '缺少武將頭像：' + g);
    await pg.click('#briefBox .roster [data-gen="lubu"]');
    env.assert((await pg.$$eval('#modalBody .gm svg', e => e.length)) >= 4, '呂布應有平常＋3 種情緒');
    env.assert((await pg.textContent('#modalBody')).includes('紫金冠'));
    // 每位武將的每種情緒都畫得出來
    const bad = await pg.evaluate(() => Object.keys(PORTRAITS.LOOKS).flatMap(g => PORTRAITS.moodsOf(g).filter(m => !PORTRAITS.svg(g, m.id).startsWith('<svg')).map(m => g + ':' + m.id)));
    env.assert.deepStrictEqual(bad, []);
  } },
  { name: '玩家回合：移動、攻擊預覽與確認', async fn(env) {
    const pg = await env.open('sc=xiapi&side=att&seed=2&speed=4');
    await env.myTurn(pg);
    // 把目前部隊擺到高順旁邊，測試攻擊流程
    const before = await pg.evaluate(() => {
      const u = RULES.activeUnit(G); const t = G.units.find(x => x.gen === 'gaoshun');
      const [c, r] = HEX.neighbor(t.c, t.r, 3); u.c = c; u.r = r; u.moved = true; V3.syncUnits(G); UI.refresh();
      UI.onTap(t.c, t.r); return { troops: t.troops, preview: !!document.querySelector('.preview') };
    });
    env.assert(before.preview, '應出現攻擊預覽');
    await pg.click('#bPvOk'); await pg.waitForTimeout(2500);
    const after = await pg.evaluate(() => G.units.find(x => x.gen === 'gaoshun').troops);
    env.assert(after < before.troops, `高順兵力應減少：${before.troops} → ${after}`);
  } },
  { name: '結束行動要選朝向，之後換下一支部隊', async fn(env) {
    const pg = await env.open('sc=xiapi&side=att&seed=4&speed=4');
    await env.myTurn(pg);
    const id0 = await pg.evaluate(() => RULES.activeUnit(G).id);
    await pg.click('#bEnd');
    env.assert(await pg.isVisible('#bFaceOk'), '應進入選朝向');
    await pg.evaluate(() => { const u = RULES.activeUnit(G); const [c, r] = HEX.neighbor(u.c, u.r, 1); UI.onTap(c, r); });
    await pg.waitForTimeout(200);
    env.assert.strictEqual(await pg.evaluate(() => RULES.activeUnit(G).face), 1);
    await pg.click('#bFaceOk'); await env.myTurn(pg);
    env.assert.notStrictEqual(await pg.evaluate(() => RULES.activeUnit(G).id), id0);
  } },
  { name: '變陣：選方圓陣後陣型改變', async fn(env) {
    const pg = await env.open('sc=xiapi&side=att&seed=4&speed=4');
    await env.myTurn(pg);
    const btn = await pg.$('#panel [data-a]:text("變陣")'); await btn.click();
    await pg.click('#panel [data-f="fangyuan"]'); await pg.waitForTimeout(600);
    env.assert.strictEqual(await pg.evaluate(() => RULES.activeUnit(G).form), 'fangyuan');
  } },
  { name: '守方開局：操作呂布軍', async fn(env) {
    const pg = await env.open('sc=xiapi&side=def&seed=1&speed=4');
    await env.myTurn(pg);
    env.assert.strictEqual(await pg.evaluate(() => RULES.activeUnit(G).side), 'def');
  } },
  { name: '全自動對戰會跑到結局視窗', async fn(env) {
    const pg = await env.open('sc=xiapi&side=att&seed=5&fast&auto');
    await pg.waitForFunction(() => window.G && G.over && !document.querySelector('#modal').hidden, null, { timeout: 60000 });
    const t = await pg.textContent('#modalBody');
    env.assert(t.includes('史實經過'), t.slice(0, 80));
  } },
];
