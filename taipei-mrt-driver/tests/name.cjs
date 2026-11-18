const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const ctx=await b.newContext({viewport:{width:900,height:900}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(900);
  await p.evaluate(()=>{__mrt.SET.events=false;__mrt.SET.bcOn=false;__mrt.SET.haptic=false;});
  ok('預設駕駛名稱是 ANDY（欄位與實際使用值）',await p.evaluate(()=>drvName()==='ANDY'&&document.getElementById('m-driver').value==='ANDY'));
  const spy=()=>p.evaluate(()=>{window.__plates=[];if(!window.__origT){window.__origT=T;T=function(s,...a){if(typeof s==='string'&&s.startsWith('駕駛 '))window.__plates.push(s);return window.__origT(s,...a);};}});
  await spy();
  // 真實輸入：清空後輸入新名稱
  await p.fill('#m-driver','');await p.type('#m-driver','Mei');
  ok('輸入後立即生效並儲存',await p.evaluate(()=>drvName()==='Mei'&&JSON.parse(localStorage.getItem('mrt-set')).driver==='Mei'));
  await p.evaluate(()=>{__mrt.render();});
  ok('駕駛室名牌顯示「駕駛 Mei」',(await p.evaluate(()=>window.__plates.slice(-1)[0]))==='駕駛 Mei',await p.evaluate(()=>JSON.stringify(window.__plates.slice(-1))));
  await p.reload();await p.waitForTimeout(900);
  ok('重新載入後仍是 Mei（設定有保存）',await p.evaluate(()=>drvName()==='Mei'&&document.getElementById('m-driver').value==='Mei'));
  // 清空 → 離開欄位後回到預設 ANDY
  await p.fill('#m-driver','');await p.evaluate(()=>document.getElementById('m-driver').blur());
  ok('清空後離開欄位：回到預設 ANDY',await p.evaluate(()=>drvName()==='ANDY'&&document.getElementById('m-driver').value==='ANDY'));
  // 前後空白、過長
  await p.fill('#m-driver','   Bob  ');await p.evaluate(()=>document.getElementById('m-driver').blur());
  ok('前後空白會被去掉',await p.evaluate(()=>drvName()==='Bob'&&document.getElementById('m-driver').value==='Bob'));
  await p.fill('#m-driver','');await p.type('#m-driver','ABCDEFGHIJKLMNOPQRST');
  ok('最多 12 個字',await p.evaluate(()=>document.getElementById('m-driver').value.length===12&&drvName().length===12),await p.evaluate(()=>document.getElementById('m-driver').value));
  // 中文與 emoji
  await p.fill('#m-driver','小明🚇');await p.evaluate(()=>document.getElementById('m-driver').blur());
  ok('支援中文與 emoji',await p.evaluate(()=>drvName()==='小明🚇'));
  // Enter 收起鍵盤（失去焦點），不會觸發遊戲
  await p.fill('#m-driver','Amy');await p.press('#m-driver','Enter');
  ok('按 Enter 離開欄位',await p.evaluate(()=>document.activeElement!==document.getElementById('m-driver')&&drvName()==='Amy'));
  // 成績與排行榜：名稱隨時存、顯示時跳脫 HTML
  await p.fill('#m-driver','<b>x</b>');await p.evaluate(()=>document.getElementById('m-driver').blur());
  await p.evaluate(()=>{localStorage.removeItem('mrt-board');});
  await p.evaluate(()=>{const m=__mrt;Object.assign(m.SET,{line:'red',from:27,to:26,events:false,bcOn:false,haptic:false});m.startRun();
    const g=m.G;for(let i=0;i<60*60*15;i++){m.step(1/60);if(i%6===0){const D=g.doors;if(g.state==='finish'||g.k>=g.S.length)continue;const d=g.S[g.k]-g.pos,v=g.v,kmh=v*3.6;
      if(v<0.05&&D.state==='closed'){const j=g.S.findIndex(s=>{const e=s-g.pos;return e<=10&&e>=-30;});if(j===g.k){m.setNotch(0);m.openDoors(g.stations[j].side);continue;}}
      if(D.state==='open'&&D.openT>=6.5&&g.time>=g.tDep[g.cur]-1){m.closeDoors();continue;}if(D.state!=='closed')continue;if(g.trip){m.setNotch(0);continue;}
      if(v<0.05&&d>20){if(g.time>=g.tDep[g.cur])m.setNotch(3);continue;}const a=v*v/(2*Math.max(d,0.01));if(d<=0.02){m.setNotch(-3);continue;}
      if(v>0.3&&(a>0.8||g.notch<0&&a>0.15)){const need=g.dec.findIndex(x=>x>=a*1.03);let nn=need<0?7:need+1;if(v<2.5)nn=Math.min(nn,2);if(v<1.2)nn=1;m.setNotch(-nn);}
      else if(kmh>g.lim-6)m.setNotch(-5);else if(kmh<Math.min(g.lim-8,g.M.vmax-4)&&d>300)m.setNotch(4);else if(v>0.3)m.setNotch(0);else m.setNotch(2);}
      if(g.endT>0&&g.endT<0.05)break;}});
  await p.waitForSelector('#result:not(.hidden)',{timeout:20000});
  const r=await p.evaluate(()=>({title:document.getElementById('r-title').textContent,html:document.querySelector('#r-rank').innerHTML,hasB:!!document.querySelector('#r-rank b'),store:JSON.parse(localStorage.getItem('mrt-board'))}));
  ok('結算頁標題顯示駕駛名稱',r.title.startsWith('駕駛 <b>x</b>'),r.title.slice(0,30));
  ok('排行榜顯示名稱時跳脫 HTML（不會變成粗體標籤）',!r.hasB&&r.html.includes('&lt;b&gt;x&lt;/b&gt;'));
  ok('排行榜紀錄存的是當時的名稱',Object.values(r.store)[0].list[0].name==='<b>x</b>');
  console.log('errors',errs);await b.close();
})();
