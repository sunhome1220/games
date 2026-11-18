const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
  const ctx=await b.newContext({viewport:{width:900,height:900}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(900);
  const T=(body)=>p.evaluate(new Function('strict',`const m=__mrt;Object.assign(m.SET,{line:'red',from:27,to:20,theme:'day',events:false,bcOn:false,haptic:false,atpStrict:strict});m.startRun();const g=m.G;g.state='run';g.doors.state='closed';g.nextEv=1e9;
    g.k=1;g.pos=300;g.v=20;g.aAct=0;g.notch=0;g.zones=[{s0:g.pos-10,s1:g.pos+3000,lim:45}];
    const go=(sec,fn)=>{for(let i=0;i<Math.round(60*sec);i++){m.step(1/60);if(fn&&fn(i))return true;}return false;};
    ${body}`));
  const run=(strict,body)=>p.evaluate(`(strict=>{${'const m=__mrt;Object.assign(m.SET,{line:"red",from:27,to:20,theme:"day",events:false,bcOn:false,haptic:false,atpStrict:strict});m.startRun();const g=m.G;g.state="run";g.doors.state="closed";g.nextEv=1e9;g.k=1;g.pos=300;g.v=20;g.aAct=0;g.notch=0;g.zones=[{s0:g.pos-10,s1:g.pos+3000,lim:45}];const go=(sec,fn)=>{for(let i=0;i<Math.round(60*sec);i++){m.step(1/60);if(fn&&fn(i))return true;}return false;};'}${body}})(${strict})`);
  // ---- 寬鬆（預設）----
  let r=await run(false,`go(5,()=>g.trip);const tripped=g.trip,vAtTrip=+(g.v*3.6).toFixed(1);
    go(30,()=>!g.trip);const released=!g.trip,vAtRel=+(g.v*3.6).toFixed(1),lim=+g.lim.toFixed(1);
    m.setNotch(2);go(6,null);
    return {tripped,vAtTrip,released,vAtRel,lim,count:g.pen.atp,stillMoving:g.v>1,evAfter:+(g.v*3.6).toFixed(1)};`);
  ok('寬鬆：超速觸發 ATP，速度降到限速以下就復歸（還在行駛中，不必停到底）',r.tripped&&r.released&&r.vAtRel<=r.lim&&r.vAtRel>5,JSON.stringify(r));
  ok('寬鬆：復歸後可以直接再加速，且只扣一次（沒有反覆觸發）',r.count===1&&r.stillMoving);
  r=await run(false,`go(5,()=>g.trip);m.setNotch(3);                       // 一直壓著動力
    go(40,()=>g.v*3.6<g.lim-1);const lowButPower=g.trip;                    // 速度已低於限速，但手把還在 P3
    m.setNotch(0);go(0.3,null);return {lowButPower,afterN:!g.trip,v:+(g.v*3.6).toFixed(1)};`);
  ok('寬鬆：速度已低於限速但手把還在動力位 → 仍不復歸；回到 N 位才復歸',r.lowButPower&&r.afterN,JSON.stringify(r));
  // ---- 嚴格 ----
  r=await run(true,`go(5,()=>g.trip);go(40,()=>g.v*3.6<g.lim-1);const lowStillTrip=g.trip,vLow=+(g.v*3.6).toFixed(1);
    m.setNotch(0);go(60,()=>g.v<=0);const stopped=g.v<=0,trip1=g.trip;                                  // 剛停住
    go(1.2,null);const at1=g.trip;                                                                      // 停後 1.2 秒仍未復歸
    go(1.5,()=>!g.trip);const t3=!g.trip;
    return {lowStillTrip,vLow,stopped,trip1,at1,t3};`);
  ok('嚴格：速度降到限速以下仍不復歸（必須完全停車）',r.lowStillTrip&&r.vLow>5,JSON.stringify(r));
  ok('嚴格：停住後還要再等 2 秒，並且手把在 N 位才復歸',r.stopped&&r.trip1&&r.at1&&r.t3);
  // ---- 退行超出月台：不論模式都要停車（否則寬鬆模式會在原地反覆觸發）----
  r=await run(false,`g.rev=true;g.pos=g.S[1]-26;g.v=1.0;g.notch=0;m.step(1/60);const t0=g.trip,strictFlag=g.tripStrict;
    go(0.5,null);const stillTrip=g.trip;                                                                // 速度已低於退行限速，寬鬆模式本來會復歸
    go(10,()=>g.v<=0.05);const stopped=g.v<=0.05;go(0.5,null);
    return {t0,strictFlag,stillTrip,stopped,count:g.pen.atp};`);
  ok('退行超出月台的 ATP：即使在寬鬆模式也必須停車，且只扣一次（不會在原地反覆觸發）',r.t0&&r.strictFlag&&r.stillTrip&&r.count===1,JSON.stringify(r));
  // ---- 越過停止信號：不論模式都要停車 ----
  r=await run(false,`g.zones=[];g.evOn=true;m.evStart(g,'signal');const hold=g.hold;g.pos=hold+2;g.v=5;m.step(1/60);
    const tripped=g.trip,strictFlag=g.tripStrict;go(0.3,null);const still=g.trip;return {tripped,strictFlag,still,log:g.evLog.map(e=>e.id+':'+e.outcome)};`);
  ok('越過停止信號的 ATP：即使在寬鬆模式也必須停車',r.tripped&&r.strictFlag&&r.still&&r.log[0]==='signal:fail',JSON.stringify(r));
  r=await run(false,`g.zones=[];g.evOn=true;m.evStart(g,'signal');const hold=g.hold;m.setNotch(0);
    go(80,()=>g.v<=0.05&&g.trip);const short=+(hold-g.pos).toFixed(1),count=g.pen.atp;
    return {short,count,stoppedBefore:g.pos<=hold+1};`);
  ok('寬鬆模式下，前方有停止信號：ATP 仍會把列車攔在信號前（沒有衝過去）',r.stoppedBefore&&r.short>-1,JSON.stringify(r));
  // ---- 預設值與選單 ----
  r=await p.evaluate(()=>{localStorage.removeItem('mrt-set');return null;});
  await p.reload();await p.waitForTimeout(900);
  r=await p.evaluate(()=>({strict:__mrt.SET.atpStrict,sel:document.getElementById('m-atp').value}));
  ok('預設是寬鬆（新使用者）',r.strict===false&&r.sel==='relaxed',JSON.stringify(r));
  await p.selectOption('#m-atp','strict');
  r=await p.evaluate(()=>({strict:__mrt.SET.atpStrict,saved:JSON.parse(localStorage.getItem('mrt-set')).atpStrict}));
  ok('選單改成嚴格：立即生效並保存',r.strict===true&&r.saved===true,JSON.stringify(r));
  await p.reload();await p.waitForTimeout(900);
  ok('重新載入後仍是嚴格',await p.evaluate(()=>__mrt.SET.atpStrict===true&&document.getElementById('m-atp').value==='strict'));
  console.log('errors',errs);await b.close();
})();
