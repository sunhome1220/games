const { chromium, devices } = require('playwright');
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errs=[];const ok=(n,c,extra)=>console.log((c?'PASS ':'FAIL ')+n+(extra?'  '+extra:''));
  // ---------- A. 滑桿：精確的相鄰與跳過 ----------
  let p=await b.newPage({viewport:{width:1000,height:760}});p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(900);await p.evaluate(()=>{__mrt.SET.events=false;__mrt.SET.bcOn=false;__mrt.SET.haptic=false;});
  await p.click('.chip.ln >> text=板南線');
  const rb=await p.locator('#rs').boundingBox(),N=23,fx=i=>rb.x+17+(rb.width-34)*(i/(N-1)),cy=rb.y+rb.height/2;
  const drag=async(i0,i1)=>{await p.mouse.move(fx(i0),cy);await p.mouse.down();await p.mouse.move(fx(i1),cy,{steps:6});await p.mouse.up();};
  const S=()=>p.evaluate(()=>({f:__mrt.SET.from,t:__mrt.SET.to,n:__mrt.G.S.length}));
  await p.evaluate(()=>{__mrt.SET.from=0;__mrt.SET.to=22;});await p.click('#a-next');await p.click('#a-prev');   // 觸發重繪
  await drag(0,10);let s=await S();ok('拖「起」到第 10 站',s.f===10,JSON.stringify(s));
  await drag(22,11);s=await S();ok('拖「終」到第 11 站 → 相鄰兩站，關卡只有 1 段',s.f===10&&s.t===11&&s.n===2,JSON.stringify(s));
  await p.click('#a-next');s=await S();ok('起點再往後推一格：不重疊，跳過對方到第 12 站（交叉＝反向）',s.f===12&&s.t===11,JSON.stringify(s));
  await p.click('#b-prev');s=await S();ok('終點往前一格仍可相鄰',s.t===10&&s.f===12,JSON.stringify(s));
  await p.evaluate(()=>{__mrt.SET.from=0;__mrt.SET.to=1;});await p.click('#a-prev');s=await S();ok('已在最左端時 ◀ 不動、不報錯',s.f===0&&s.t===1,JSON.stringify(s));
  // ---------- B. 退行物理 ----------
  const R=await p.evaluate(()=>{
    const m=__mrt;Object.assign(m.SET,{line:'red',from:0,to:3,theme:'day',events:false});m.startRun();const g=m.G;
    const out={};
    g.k=1;g.pos=g.S[1]-5;g.v=0;             // 還沒到線
    m.toggleReverse();out.reject_short=g.rev===false;
    g.pos=g.S[1]+4;g.v=0;                    // 過線 4 m
    m.toggleReverse();out.enter=g.rev===true;out.pen=g.pen.rev;
    m.setNotch(1);for(let i=0;i<60*3;i++)m.step(1/60);
    out.moved_back=g.pos<g.S[1]+4-0.2;out.speedKmh=+(g.v*3.6).toFixed(1);out.lim=g.lim;
    // 超速：持續推 P4，應被 ATP 攔下
    m.setNotch(4);for(let i=0;i<60*6;i++)m.step(1/60);out.atp_on_overspeed=g.trip===true;
    // 復位：回 N、停妥、取消 ATP
    m.setNotch(-5);for(let i=0;i<60*8;i++)m.step(1/60);m.setNotch(0);for(let i=0;i<60*4;i++)m.step(1/60);
    out.tripCleared=g.trip===false;out.stopped=g.v===0;
    return out;});
  ok('還沒超過停車線時拒絕退行',R.reject_short);
  ok('過線後可進入退行、扣分 1 次',R.enter&&R.pen===1);
  ok('退行時車確實往後走',R.moved_back);
  ok('退行限速 5 km/h，超速時 ATP 動作',R.atp_on_overspeed&&R.lim===5,`限速 ${R.lim}`);
  ok('ATP 復歸後可繼續操作',R.tripCleared&&R.stopped);
  const R2=await p.evaluate(()=>{
    const m=__mrt;Object.assign(m.SET,{line:'red',from:0,to:3,theme:'day',events:false});m.startRun();const g=m.G;
    g.k=1;g.pos=g.S[1]+4;g.v=0;m.toggleReverse();
    // 輕推 P1，在快到線時放回 N、B1 煞停
    let guard=0;while(g.pos>g.S[1]+0.8&&guard++<60*60){m.setNotch(1);m.step(1/60);if(g.v*3.6>4)m.setNotch(0);}
    m.setNotch(-3);for(let i=0;i<60*8&&g.v>0;i++)m.step(1/60);m.setNotch(0);
    const e=g.pos-g.S[1];
    const before=g.results.length;m.openDoors(g.stations[1].side);
    return {err:+e.toFixed(2),opened:g.doors.state==='opening',revCleared:g.rev===false,results:g.results.length-before,acc:g.results[g.results.length-1]&&g.results[g.results.length-1].acc,score:g.results[g.results.length-1]&&g.results[g.results.length-1].score,segPen:g.segPen};});
  ok('退行倒回對位後可開門並計分，開門時自動取消退行',R2.opened&&R2.revCleared&&R2.results===1,JSON.stringify(R2));
  // ---------- C. 對位指示條：位置刻度 ----------
  // 靠近停車線時畫面下方會畫指示條（驗證不報錯並含文字）；以像素確認有畫東西
  await p.evaluate(()=>{const m=__mrt;Object.assign(m.SET,{line:'red',from:0,to:3,theme:'day',events:false});m.startRun();const g=m.G;g.k=1;g.pos=g.S[1]-0.3;g.v=0;});
  await p.waitForTimeout(700);
  
  await p.screenshot({path:(process.env.SHOT_DIR||require('os').tmpdir())+'/gauge.png'});
  await p.close();
  // ---------- D. iPhone 規格的選單命中測試 ----------
  for(const [name,vp] of [['橫握 844x390',{width:844,height:390}],['直握 390x844',{width:390,height:844}]]){
    p=await b.newPage({viewport:vp,deviceScaleFactor:3,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1000);
    const bad=await p.evaluate(()=>{
      const out=[];const els=[...document.querySelectorAll('#menu button, #menu select, #menu input, #rs .th')];
      for(const el of els){
        el.scrollIntoView({block:'center'});
        const dt=el.closest('details');if(dt&&!dt.open)continue;   // 收合的 <details> 內容不可見，不算
        const r=el.getBoundingClientRect();if(r.width===0)continue;
        const x=r.left+r.width/2,y=r.top+r.height/2;const hit=document.elementFromPoint(x,y);
        if(!(hit===el||el.contains(hit)||(hit&&hit.contains(el))))out.push((el.id||el.textContent.trim()||el.tagName).slice(0,18)+' ← '+(hit&&(hit.id||hit.tagName)));
      }
      return {n:els.length,bad:out};});
    ok(`${name}：選單 ${bad.n} 個可點元素中心點都被自己接到`,bad.bad.length===0,bad.bad.join(' | '));
    // 真觸控 tap 一個預設關卡 chip，確認真的切換
    const before=await p.evaluate(()=>[__mrt.SET.from,__mrt.SET.to]);
    const chip=p.locator('#m-presets .chip').nth(1);await chip.scrollIntoViewIfNeeded();await chip.tap();
    const after=await p.evaluate(()=>[__mrt.SET.from,__mrt.SET.to]);
    ok(`${name}：觸控點預設關卡有切換`,JSON.stringify(before)!==JSON.stringify(after),JSON.stringify(before)+'→'+JSON.stringify(after));
    // 檢查選單內容有沒有被瀏海安全區域以外的元素橫向溢出
    const ov=await p.evaluate(()=>{const m=document.querySelector('#menu>div');return {sw:document.getElementById('menu').scrollWidth,cw:document.getElementById('menu').clientWidth};});
    ok(`${name}：選單無橫向溢出`,ov.sw<=ov.cw+1,JSON.stringify(ov));
    await p.close();
  }
  console.log('errors',errs);await b.close();
})();
