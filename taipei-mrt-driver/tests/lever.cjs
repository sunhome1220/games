const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1000);
  await p.evaluate(()=>{startRun();});
  await p.waitForTimeout(800);
  const has=await p.evaluate(()=>!!window.__mrt&&!!__mrt.G&&!document.getElementById('lever').classList.contains('hidden'));
  ok('遊戲已開始、手把可見',has);
  let bad=[];
  for(const vh of [390,330]){
    await p.setViewportSize({width:844,height:vh});await p.waitForTimeout(200);
    const rows=await p.evaluate(()=>[...document.querySelectorAll('#lever .n')].map(n=>{const r=n.getBoundingClientRect();return {t:n.textContent,x:r.left+r.width/2,y:r.top+r.height/2};}));
    for(const r of rows){
      await p.touchscreen.tap(r.x,r.y);await p.waitForTimeout(30);
      const got=await p.evaluate(()=>{const n=__mrt.G.notch;return n>0?'P'+n:n===0?'N':n===-8?'EB':'B'+(-n);});
      if(got!==r.t)bad.push(`vh${vh} 點${r.t}→${got}`);
    }
  }
  ok('13 格逐一點擊皆正確（兩種視窗高度）',bad.length===0,bad.slice(0,5).join(' | '));
  // 模擬頁面被捲動：用滑鼠拖曳 B3→B5
  const pos=await p.evaluate(()=>{const f=t=>{const n=[...document.querySelectorAll('#lever .n')].find(x=>x.textContent===t).getBoundingClientRect();return [n.left+n.width/2,n.top+n.height/2];};return {a:f('B3'),c:f('B5')};});
  await p.mouse.move(...pos.a);await p.mouse.down();await p.mouse.move(pos.c[0],pos.c[1],{steps:5});await p.mouse.up();
  ok('拖曳 B3→B5',await p.evaluate(()=>__mrt.G.notch)===-5);
  ok('無錯誤',errs.length===0,errs.join());
  await b.close();
})();
