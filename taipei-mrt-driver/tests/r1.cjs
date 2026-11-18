const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const ctx=await b.newContext({viewport:{width:1000,height:720}});const p=await ctx.newPage();const errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(900);await p.evaluate(()=>{__mrt.SET.events=false;__mrt.SET.bcOn=false;__mrt.SET.haptic=false;});
  const ok=(n,c)=>console.log((c?'PASS ':'FAIL ')+n);
  // 自動駕駛跑完一班；skill=0 好、1 差（故意晚發車）
  const drive=(cfg,late)=>p.evaluate(([cfg,late])=>{
    const m=__mrt;Object.assign(m.SET,cfg);m.startRun();
    for(let i=0;i<60*60*30;i++){
      m.step(1/60);
      if(i%6===0){const g=m.G,D=g.doors;if(g.state==='finish'||g.k>=g.S.length)continue;
        const d=g.S[g.k]-g.pos,v=g.v,kmh=v*3.6;
        if(v<0.05&&D.state==='closed'){const j=g.S.findIndex(s=>{const e=s-g.pos;return e<=10&&e>=-30;});if(j===g.k){m.setNotch(0);m.openDoors(g.stations[j].side);continue;}}
        if(D.state==='open'&&D.openT>=6.5&&g.time>=g.tDep[g.cur]-1+late){m.closeDoors();continue;}
        if(D.state!=='closed')continue;if(g.trip){m.setNotch(0);continue;}
        if(v<0.05&&d>20){if(g.time>=g.tDep[g.cur]+late)m.setNotch(3);continue;}
        const a=v*v/(2*Math.max(d,0.01));if(d<=0.02){m.setNotch(-3);continue;}
        if(v>0.3&&(a>0.8||g.notch<0&&a>0.15)){const need=[0.25,0.45,0.65,0.85,1.05,1.2,1.35].findIndex(x=>x>=a*1.03);let nn=need<0?7:need+1;if(v<2.5)nn=Math.min(nn,2);if(v<1.2)nn=1;m.setNotch(-nn);}
        else if(kmh>g.lim-6)m.setNotch(-5);else if(kmh<Math.min(g.lim-8,76)&&d>300)m.setNotch(4);else if(v>0.3)m.setNotch(0);else m.setNotch(2);
      }
      if(m.G.endT>0&&m.G.endT<0.05)break;
    }
  },[cfg,late]);
  const cfg={line:'red',from:27,to:24,theme:'day'};
  await drive(cfg,0);await p.waitForSelector('#result:not(.hidden)',{timeout:20000});
  let txt=await p.locator('#r-rank').innerText();
  ok('第一筆：顯示第 1 名',/第一筆紀錄|第 1 名/.test(txt));
  await drive(cfg,40);await p.waitForSelector('#result:not(.hidden)',{timeout:20000});await p.waitForFunction(()=>JSON.parse(localStorage.getItem('mrt-board')||'{}')&&Object.values(JSON.parse(localStorage.getItem('mrt-board'))).some(b=>b.list.length>=2));
  txt=await p.locator('#r-rank').innerText();
  console.log('  第二筆名次文字：',txt.split('\n')[0]);console.log('  榜上總分：',JSON.stringify(await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('mrt-board')))[0].list.map(e=>e.total))));
  ok('分數較低的第二筆：排第 2 名',/第 2 名/.test(txt));
  const bd=await p.evaluate(()=>JSON.parse(localStorage.getItem('mrt-board')));
  const list=Object.values(bd)[0].list;
  ok('排行榜依總分遞減且有 2 筆',list.length===2&&list[0].total>=list[1].total);
  console.log('  totals',list.map(e=>e.total));
  await p.screenshot({path:(process.env.SHOT_DIR||require('os').tmpdir())+'/rank-result.png'});
  await drive(cfg,0);await p.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('mrt-board'))).some(b=>b.list.length>=3),null,{timeout:20000});
  const bd2=await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('mrt-board')))[0].list.length);
  ok('第三筆後共 3 筆',bd2===3);
  // 選單 → 排行榜
  await p.click('#r-menu');await p.click('#m-board');await p.waitForTimeout(300);
  ok('排行榜畫面顯示 3 列',(await p.locator('#b-list tr').count())===4);
  await p.screenshot({path:(process.env.SHOT_DIR||require('os').tmpdir())+'/rank-board.png'});
  await p.keyboard.press('ArrowUp');
  ok('排行榜畫面時鍵盤不會操作列車',(await p.evaluate(()=>__mrt.G.notch))<=0);
  await p.click('#b-back');
  ok('回選單且顯示本路線最高分',/這條路線最高/.test(await p.locator('#m-best').innerText()));
  // 不同路線分開計
  await p.evaluate(()=>{__mrt.SET.to=20;});await p.click('#b-next');await p.click('#b-prev');
  ok('換站數後路線 key 改變、最高分提示清空',(await p.locator('#m-best').innerText())==='');
  // 即時分數
  await p.click('#m-go');await p.evaluate(()=>{const g=__mrt.G;g.results.push({score:77});});await p.waitForTimeout(300);
  await p.screenshot({path:(process.env.SHOT_DIR||require('os').tmpdir())+'/rank-live.png'});
  console.log('errors',errs);await b.close();
})();
