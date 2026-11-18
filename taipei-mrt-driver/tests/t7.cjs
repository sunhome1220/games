const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-gl=angle']});const errs=[];
  const p=await b.newPage({viewport:{width:1000,height:620}});
  p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');
  const q=(f)=>p.evaluate(f);
  const ok=(name,cond)=>console.log((cond?'PASS ':'FAIL ')+name);
  // 從選單用真實點擊操作
  await p.click('.chip.ln >> text=板南線');
  ok('選單切換路線',await q(()=>__mrt.SET.line==='blue'));
  const rb=await p.locator('#rs').boundingBox();
  const fx=i=>rb.x+17+(rb.width-34)*(i/22), cy=rb.y+rb.height/2;
  // 拖「起」到第 22 站（南港展覽館），再拖「終」到第 19 站（後山埤）
  await p.mouse.move(fx(0),cy);await p.mouse.down();await p.mouse.move(fx(22),cy,{steps:8});await p.mouse.up();
  ok('滑桿：拖曳起點到最右（南港展覽館）',await q(()=>__mrt.SET.from===22));
  await p.mouse.move(fx(22)-2,cy);   // 此時「終」在別處，點最近的那端
  const to0=await q(()=>__mrt.SET.to);
  await p.mouse.move(fx(to0),cy);await p.mouse.down();await p.mouse.move(fx(19),cy,{steps:8});await p.mouse.up();
  ok('滑桿：終點拖到後山埤、反向 3 站',await q(()=>{const g=__mrt.G;return __mrt.SET.to===19&&g.stations[0].name==='南港展覽館'&&g.stations[g.stations.length-1].name==='後山埤'&&g.S.length===4;}));
  ok('關卡資訊顯示站數',/共 3 站/.test(await p.locator('#m-info').innerText()));
  await p.click('#a-prev');await p.click('#a-prev');
  ok('◀▶ 微調：起點移到昆陽，終點不變',await q(()=>__mrt.SET.from===20&&__mrt.SET.to===19));
  await p.click('#a-prev');
  ok('相鄰：起終只差 1 站也可以（昆陽→後山埤已相鄰）；再推擠會跳過對方',await q(()=>__mrt.SET.from===19+1&&__mrt.SET.to===19||(__mrt.SET.from!==__mrt.SET.to)));
  await p.evaluate(()=>{__mrt.SET.from=22;__mrt.SET.to=19;});await p.click('#b-next');
  ok('終點被推擠到起點時，跳過一站而不重疊',await q(()=>__mrt.SET.from!==__mrt.SET.to));
  await p.evaluate(()=>{__mrt.SET.from=19;__mrt.SET.to=20;});await q(()=>{});await p.click('#m-swap');
  ok('相鄰兩站（1 站）可建立關卡',await q(()=>{const g=__mrt.buildRun({line:'blue',from:19,to:20});return g.S.length===2;}));
  await p.evaluate(()=>{__mrt.SET.from=22;__mrt.SET.to=19;});await p.click('#b-next');await p.click('#b-prev');
  await p.evaluate(()=>{__mrt.SET.from=22;__mrt.SET.to=19;});
  await p.click('#m-swap');
  ok('對調起訖站',await q(()=>__mrt.SET.from===19&&__mrt.SET.to===22));
  await p.click('#m-swap');
  await p.click('#m-go');
  ok('開始後選單隱藏、手把與按鈕出現',await q(()=>document.getElementById('menu').classList.contains('hidden')&&!document.getElementById('lever').classList.contains('hidden')&&!document.getElementById('bar').classList.contains('hidden')));
  ok('反向路線：起點南港展覽館、共 3 站',await q(()=>__mrt.G.stations[0].name==='南港展覽館'&&__mrt.G.S.length===4));
  // 鍵盤
  await p.keyboard.press('ArrowUp');await p.keyboard.press('ArrowUp');
  ok('↑↑ → P2',await q(()=>__mrt.G.notch===2));
  await p.keyboard.press(' ');
  ok('空白 → N',await q(()=>__mrt.G.notch===0));
  await p.keyboard.press('ArrowDown');
  ok('↓ → B1',await q(()=>__mrt.G.notch===-1));
  await p.keyboard.press('x');
  ok('X → EB',await q(()=>__mrt.G.notch===-8));
  await p.keyboard.press(' ');
  // 手把：滑鼠點最上面（P4）與最下面（EB）
  const lb=await p.locator('#lever').boundingBox();
  await p.mouse.click(lb.x+lb.width/2,lb.y+6);
  ok('點手把頂端 → P4',await q(()=>__mrt.G.notch===4));
  await p.mouse.click(lb.x+lb.width/2,lb.y+lb.height-4);
  ok('點手把底端 → EB',await q(()=>__mrt.G.notch===-8));
  await p.mouse.click(lb.x+lb.width/2,lb.y+lb.height*(4.5/13));
  ok('點手把 N 位 → N',await q(()=>__mrt.G.notch===0));
  // 拖曳
  await p.mouse.move(lb.x+lb.width/2,lb.y+lb.height*(4.5/13));await p.mouse.down();
  await p.mouse.move(lb.x+lb.width/2,lb.y+lb.height*(1.5/13),{steps:5});await p.mouse.up();
  ok('拖曳手把到 P3',await q(()=>__mrt.G.notch===3));
  // 發車：門關著時 P3 可加速；實際走 1 秒
  await q(()=>{for(let i=0;i<120;i++)__mrt.step(1/60);});
  ok('P3 加速後速度 > 0',await q(()=>__mrt.G.v>0.5));
  // 連動：模擬停下後開錯邊的門
  await q(()=>{const g=__mrt.G;__mrt.setNotch(-8);for(let i=0;i<60*20&&g.v>0;i++)__mrt.step(1/60);});
  ok('EB 停車',await q(()=>__mrt.G.v===0));
  // 手動把車放在月台上：停車位置 = 起點站(0) 前 3 公尺，並開錯邊
  await q(()=>{const g=__mrt.G;g.pos=g.S[1]-3;g.notch=0;g.k=1;});
  const side=await q(()=>__mrt.G.stations[1].side);
  await p.click(side==='L'?'#b-or':'#b-ol');
  ok('開錯邊：車門不開並扣分',await q(()=>__mrt.G.doors.state==='closed'&&__mrt.G.pen.door===1));
  await p.click(side==='L'?'#b-ol':'#b-or');
  ok('開對邊：車門開啟並計分',await q(()=>__mrt.G.doors.state==='opening'&&__mrt.G.results.length===1&&Math.abs(__mrt.G.results[0].err-3)<0.01));
  // 門開著不能加速（連動）
  await q(()=>{__mrt.setNotch(4);for(let i=0;i<60;i++)__mrt.step(1/60);});
  ok('車門開啟時推 P4 不會移動（連動鎖）',await q(()=>__mrt.G.v===0&&__mrt.G.interlock===true));
  await q(()=>__mrt.setNotch(0));
  // 太早關門
  await q(()=>{for(let i=0;i<60*3;i++)__mrt.step(1/60);});
  await p.click('#b-close');
  ok('開門未滿最短停留時間不能關門',await q(()=>__mrt.G.doors.state==='open'));
  await q(()=>{for(let i=0;i<60*8;i++)__mrt.step(1/60);});
  await p.keyboard.press('f');
  ok('停留足夠後 F 可關門',await q(()=>__mrt.G.doors.state==='closing'));
  // 暫停
  await p.click('#b-pause');
  const t0=await q(()=>__mrt.G.time);await p.waitForTimeout(400);
  ok('暫停時時間不前進',await q(()=>Math.abs(__mrt.G.time-0)>=0)&&(await q(()=>__mrt.G.time))===t0);
  await p.click('#b-pause');
  // 離開回選單
  await p.click('#b-quit');
  ok('離開回到選單',await q(()=>!document.getElementById('menu').classList.contains('hidden')));
  console.log('errors',errs);await b.close();
})();
