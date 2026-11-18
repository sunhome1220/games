const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const ctx=await b.newContext({viewport:{width:390,height:700},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1000);
  await p.evaluate(()=>{__mrt.SET.events=true;__mrt.SET.evOff=[];});
  const st=await p.evaluate(()=>({pos:getComputedStyle(document.getElementById('menu')).position,scroll:document.documentElement.classList.contains('scroll'),sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight}));
  ok('選單不再是 position:fixed，文件可捲動',st.pos==='absolute'&&st.scroll&&st.sh>st.ch,JSON.stringify(st));
  await p.evaluate(()=>{document.getElementById('m-ev').scrollIntoView();});
  // 展開事件清單（真的用觸控點 summary）
  const sum=p.locator('summary:has-text("選擇要出現的事件種類")');await sum.scrollIntoViewIfNeeded();
  const sb=await sum.boundingBox();await p.touchscreen.tap(sb.x+sb.width/2,sb.y+sb.height/2);await p.waitForTimeout(300);
  ok('觸控展開事件清單',await p.evaluate(()=>document.querySelector('details.evd').open));
  const ids=await p.evaluate(()=>[...document.querySelectorAll('.evrow')].map(x=>x.dataset.ev));
  ok('事件清單為整列按鈕，共 7 種',ids.length===7,ids.join());
  // 逐列點擊：在不同捲動位置、以及視窗高度改變（模擬 Safari 工具列收合）後，被切換的必須就是點的那一列
  let bad=[];const scrollsY=[0,300,700,1100,99999];
  for(const vh of [700,790,610]){
    await p.setViewportSize({width:390,height:vh});await p.waitForTimeout(200);
    for(const sy of scrollsY){
      await p.evaluate(sy=>window.scrollTo(0,sy),sy);await p.waitForTimeout(80);
      for(const id of ids){
        const before=await p.evaluate(()=>JSON.stringify([...(__mrt.SET.evOff||[])].sort()));
        const r=await p.evaluate(id=>{const el=document.querySelector(`.evrow[data-ev="${id}"]`);const rc=el.getBoundingClientRect();return {x:rc.left+rc.width/2,y:rc.top+rc.height/2,vis:(rc.top+rc.height/2)>8&&(rc.top+rc.height/2)<innerHeight-8};},id);
        if(!r.vis)continue;
        await p.touchscreen.tap(r.x,r.y);await p.waitForTimeout(40);
        const after=JSON.parse(await p.evaluate(()=>JSON.stringify([...(__mrt.SET.evOff||[])].sort())));
        const prev=JSON.parse(before);const changed=[...new Set([...prev,...after])].filter(x=>prev.includes(x)!==after.includes(x));
        if(changed.length!==1||changed[0]!==id)bad.push(`vh${vh} y${sy} 點「${id}」→變更 ${JSON.stringify(changed)}`);
        await p.touchscreen.tap(r.x,r.y);await p.waitForTimeout(40);   // 再點一次還原
      }
    }
  }
  ok('在 3 種視窗高度、5 個捲動位置下，點哪一列就只切換那一列',bad.length===0,bad.slice(0,4).join(' | '));
  // 其他控制項：點中心點，被切換的必須是自己
  await p.setViewportSize({width:390,height:700});
  await p.evaluate(()=>{document.getElementById('m-bcbox').open=true;});
  const chk=await p.evaluate(async()=>{const out=[];
    for(const id of ['m-ev','m-assist','m-bc','m-hap']){const el=document.getElementById(id);el.scrollIntoView({block:'center'});const rc=el.getBoundingClientRect();
      const hit=document.elementFromPoint(rc.left+rc.width/2,rc.top+rc.height/2);out.push([id,hit===el||el.contains(hit)||(hit&&hit.closest('label')===el.closest('label'))]);}
    return out;});
  ok('勾選框的中心點由自己（或自己的標籤）接到',chk.every(x=>x[1]),JSON.stringify(chk));
  // 遊戲開始後恢復不可捲動；結算時再啟用
  await p.evaluate(()=>{document.getElementById('m-go').click();});await p.waitForTimeout(500);
  const g=await p.evaluate(()=>({scroll:document.documentElement.classList.contains('scroll'),ov:getComputedStyle(document.body).overflow,y:window.scrollY}));
  ok('遊戲進行中：文件不可捲動、回到頂端',!g.scroll&&g.y===0,JSON.stringify(g));
  await p.evaluate(()=>{const m=__mrt;m.G.state='finish';m.G.endT=0.01;});await p.waitForTimeout(1500);
  const r2=await p.evaluate(()=>({scroll:document.documentElement.classList.contains('scroll'),res:!document.getElementById('result').classList.contains('hidden')}));
  ok('結算頁顯示時文件可捲動',r2.scroll&&r2.res,JSON.stringify(r2));
  console.log('errors',errs);await b.close();
})();
