// 三級測試：node tools/test/run.js [quick|medium|full] [--update-baseline]
//   quick（預設，約 10 秒）：語法、載入、更新日誌、海上突擊規則、關卡判定
//   medium：quick ＋ 固定種子推演 1 場（對照基準值）＋ 關卡完整流程（關閉動畫）
//   full：medium ＋ 其餘 3 場推演 ＋ 關卡完整流程（正常動畫）＋ 手把登陸流程
// 改規則（結果本來就該變）時，用 --update-baseline 重新建立基準值，並在 PR 說明為什麼變。
const L=require('./lib.js'),{T}=require('./tests.js');
const tiers=['quick','medium','full'],tier=process.argv.find(a=>tiers.includes(a))||'quick',update=process.argv.includes('--update-baseline');
(async()=>{const t0=Date.now(),{s,url}=await L.serve(),b=await L.launch();let fails=0;
  const todo=T.filter(t=>tiers.indexOf(t.tier)<=tiers.indexOf(tier));console.log('測試級別：'+tier+'（'+todo.length+' 項，平行執行）\n');
  const run=async t=>{const t1=Date.now();let r;try{r=await t.fn({b,url,update});}catch(e){r=[[false,'執行失敗：'+e.message]];}return {t,r,ms:Date.now()-t1};};
  const out=[],q=todo.filter(t=>!t.solo),W=+process.env.JOBS||3; // 同時最多 3 項（頁面太多會互搶 CPU，反而逾時）
  await Promise.all(Array.from({length:W},async()=>{while(q.length){const t=q.shift();out.push(await run(t));}}));for(const t of todo.filter(t=>t.solo))out.push(await run(t)); // 時間敏感的測試最後單獨跑
  out.sort((a,b)=>todo.indexOf(a.t)-todo.indexOf(b.t));
  for(const {t,r,ms} of out){console.log('■ '+t.name+'（'+t.tier+'，'+(ms/1000).toFixed(1)+' 秒）');for(const [ok,m] of r){console.log('  '+(ok?'PASS ':'FAIL ')+m);if(!ok)fails++;}}
  await b.close();s.close();console.log('\n'+(fails?'失敗 '+fails+' 項':'全部通過')+'，共 '+((Date.now()-t0)/1000).toFixed(1)+' 秒');process.exit(fails?1:0);})();
