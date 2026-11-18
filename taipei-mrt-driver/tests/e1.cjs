const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const p=await b.newPage({viewport:{width:1000,height:700}});const errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1000);
  const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
  const run=(f)=>p.evaluate(f);
  const base=`const m=__mrt;Object.assign(m.SET,{line:'red',from:27,to:20,theme:'day',events:true,evRate:'mid',evOff:[],model:'C301'});m.startRun();const g=m.G;g.nextEv=1e9;
    const go=(sec,fn)=>{for(let i=0;i<Math.round(60*sec);i++){m.step(1/60);if(fn&&fn(i))break;}};
    // 巡航到 60 km/h 以上
    g.zones=[];g.k=1;g.pos=300;g.v=20;g.aAct=0;g.notch=0;g.state='run';g.doors.state='closed';`;
  const T=(name,body)=>run(new Function('return (()=>{'+base+body+'})()'));
  // 1 地震：限速、ramp、完成
  let r=await T('quake',`
    m.evStart(g,'quake');const e=g.ev;const lim0=g.lim;
    go(1,null);const lim1=g.lim;
    // 煞到限速以下並維持
    m.setNotch(-4);go(25,()=>g.v*3.6<=e.lim-3);m.setNotch(0);
    const slow=g.v*3.6;go(e.dur,()=>false);
    return {level:e.level,lim:e.lim,lim0:+lim0.toFixed(1),lim1:+lim1.toFixed(1),slow:+slow.toFixed(1),log:g.evLog.map(x=>x.id+':'+x.outcome),atp:g.pen.atp,limAfter:+g.lim.toFixed(0)};`);
  ok('地震：限速自 80 緩降到事件限速',r.lim1<r.lim0&&r.lim1>=r.lim,JSON.stringify(r));
  ok('地震：照規定減速後事件完成（處置得宜）',r.log[0]==='quake:ok'&&r.atp===0&&r.limAfter>=70);
  // 2 地震：無視限速 → ATP 動作 → 事件仍會結束（不卡死）
  r=await T('quake2',`m.evStart(g,'quake');m.setNotch(0);go(40,null);const trip=g.pen.atp;go(120,null);return {trip,log:g.evLog.map(x=>x.id+':'+x.outcome),ev:!!g.ev};`);
  ok('地震：無視限速會被 ATP 攔下、事件結束後恢復',r.trip>=1&&!r.ev&&r.log[0].startsWith('quake:'),JSON.stringify(r));
  // 3 強風：隧道路線不可用；高架路線會限速
  r=await run(()=>{const m=__mrt;Object.assign(m.SET,{line:'blue',from:0,to:5,events:true,model:'321'});m.startRun();return __mrt.EV_INFO&&m.G.stations.every(s=>s.env==='tunnel');});
  ok('板南線全地下（強風事件不會被排到）',r===true);
  r=await T('wind',`m.evStart(g,'wind');const e=g.ev;go(1,null);const l=g.lim;return {l:+l.toFixed(1),rain:g.rain,windOnly:g.evWindOnly};`);
  ok('強風：高架段套用限速並顯示雨景',r.l<80&&r.rain&&r.windOnly,JSON.stringify(r));
  // 4 旅客誤入軌道：EB → 成功
  r=await T('tres-ok',`
    g.zones=[];g.pos=g.S[0]+200;g.k=1;g.v=20;
    const can=EV.trespass.can(g);m.evStart(g,'trespass');const hz=g.hz.pos;
    m.setNotch(-8);go(30,()=>g.v<=0.05);const stopPos=g.pos;m.setNotch(0);
    go(10,()=>!g.ev);
    return {can,hz:+(hz-stopPos).toFixed(1),log:g.evLog.map(x=>x.id+':'+x.outcome+':'+x.pts),hzNow:g.hz};`);
  ok('旅客誤入軌道：EB 在人員前停妥 → 處置完成',r.can&&r.hz>6&&r.log[0]==='trespass:ok:12'&&r.hzNow===null,JSON.stringify(r));
  // 5 旅客誤入軌道：不處置 → 失敗、被接管、事件結束、不卡死
  r=await T('tres-fail',`
    g.zones=[];g.pos=g.S[0]+200;g.k=1;g.v=20;m.evStart(g,'trespass');
    go(60,()=>!g.ev);
    return {log:g.evLog.map(x=>x.id+':'+x.outcome+':'+x.pts),v:g.v,ev:!!g.ev,forceEB:g.evForceEB};`);
  ok('旅客誤入軌道：不處置 → 失敗 −30、行控接管後事件結束',r.log[0]==='trespass:fail:-30'&&!r.ev&&!r.forceEB,JSON.stringify(r));
  r=await T('tres-atp',`m.SET.atpStrict=true;g.pos=g.S[0]+200;g.k=1;g.v=20;m.evStart(g,'trespass');const hz=g.hz.pos;
    g.zones=[{s0:g.pos+60,s1:g.pos+400,lim:45}];m.setNotch(0);go(60,()=>!g.ev);return {log:g.evLog.map(x=>x.id+':'+x.outcome+':'+x.pts),atp:g.pen.atp};`);
  ok('旅客誤入軌道（嚴格 ATP）：由 ATP 代為煞停 → 未完成、不給分',r.log[0]==='trespass:late:0'&&r.atp>=1,JSON.stringify(r));
  r=await T('tres-relaxed',`m.SET.atpStrict=false;g.pos=g.S[0]+200;g.k=1;g.v=20;m.evStart(g,'trespass');
    g.zones=[{s0:g.pos+60,s1:g.pos+400,lim:45}];m.setNotch(0);go(60,()=>!g.ev);return {log:g.evLog.map(x=>x.id+':'+x.outcome+':'+x.pts)};`);
  ok('旅客誤入軌道（寬鬆 ATP）：ATP 是超速防護不是防撞，不處置會失敗 −30',r.log[0]==='trespass:fail:-30',JSON.stringify(r));
  // 6 車門故障：連動鎖、重試、行控授權
  r=await T('door',`
    g.v=0;g.pos=g.S[0];g.cur=0;g.k=1;
    m.evStart(g,'doorfault');
    m.setNotch(3);go(2,null);const blocked=g.v===0&&g.interlock;
    m.setNotch(0);
    // 重新開關門直到排除（最多 8 次）
    let tries=0,cleared=false;
    for(;tries<8&&g.ev;tries++){
      g.doors.state='closed';m.evOnDoorsClosed(g);   // 模擬關門完成
      if(!g.ev){cleared=true;break;}
    }
    return {blocked,tries,cleared,log:g.evLog.map(x=>x.id+':'+x.outcome+':'+x.pts),df:!!g.doorFault};`);
  ok('車門故障：閉鎖燈未亮時推 P3 不會動（連動鎖）',r.blocked);
  ok('車門故障：重新開關門最終排除、不卡死',r.cleared&&r.log[0].startsWith('doorfault:ok')&&!r.df,JSON.stringify(r));
  r=await T('door2',`
    g.v=0;g.pos=g.S[0];g.cur=0;g.k=1;m.evStart(g,'doorfault');
    m.evCallControl();go(9,null);const auth=g.evLim;const msg=g.ev&&g.ev.title;
    // 到下一站：模擬到站完成
    g.cur=1;go(1,null);
    return {auth,msg,log:g.evLog.map(x=>x.id+':'+x.outcome),ev:!!g.ev};`);
  ok('車門故障：聯絡行控約 8 秒後授權，限速 25 km/h，到站後解除',r.auth===25&&r.log[0]==='doorfault:ok'&&!r.ev,JSON.stringify(r));
  // 7 號誌異常
  r=await T('sig-ok',`
    g.zones=[];g.pos=g.S[0]+100;g.k=1;g.v=20;
    const can=EV.signal.can(g);m.evStart(g,'signal');const hold=g.hold;
    // 照 ATP 曲線煞車停在號誌前
    for(let i=0;i<60*40&&g.v>0.05;i++){const d=hold-g.pos,a=g.v*g.v/(2*Math.max(d-3,0.1));m.setNotch(a>0.85?-7:a>0.5?-5:a>0.25?-3:g.v>1?-1:-2);m.step(1/60);}
    m.setNotch(-2);go(2,null);const stopped=g.v<=0.05,short=hold-g.pos;m.setNotch(0);
    go(40,()=>g.ev&&g.ev.cleared);const cleared=g.ev&&g.ev.cleared;
    m.setNotch(3);go(60,()=>!g.ev);
    return {can,stopped,short:+short.toFixed(1),cleared,log:g.evLog.map(x=>x.id+':'+x.outcome+':'+x.pts),atp:g.pen.atp};`);
  ok('號誌異常：停在號誌前、等待恢復、低速通過 → 處置完成',r.can&&r.stopped&&r.cleared&&r.log[0]==='signal:ok:8',JSON.stringify(r));
  r=await T('sig-fail',`g.zones=[];g.pos=g.S[0]+100;g.k=1;g.v=20;m.evStart(g,'signal');const hold=g.hold;m.setNotch(0);
    go(50,()=>g.v<=0.05&&g.trip);const trip=g.pen.atp,short=hold-g.pos;
    m.setNotch(0);go(60,()=>g.ev&&g.ev.cleared);m.setNotch(3);go(90,()=>!g.ev);
    return {trip,short:+short.toFixed(1),log:g.evLog.map(x=>x.id+':'+x.outcome+':'+x.pts),ev:!!g.ev};`);
  ok('號誌異常：不處置 → ATP 在號誌前攔下（不會越過），事件仍會結束但不給分',r.trip>=1&&r.short>0&&r.log[0]==='signal:late:0'&&!r.ev,JSON.stringify(r));
  // 8 供電異常
  r=await T('pow',`g.v=0;g.pos=g.S[0];g.cur=0;m.evStart(g,'power');m.setNotch(4);go(5,null);const v1=g.v;m.setNotch(0);return {v1:+v1.toFixed(2),acc:g.evAcc,flick:g.flicker};`);
  ok('供電異常：P4 加速明顯變弱、燈光閃爍',r.v1<3.2&&r.acc===0.4&&r.flick,JSON.stringify(r));
  // 9 列車故障清客
  r=await T('tf',`
    g.pos=g.S[0]+100;g.k=1;g.v=20;m.evStart(g,'trainfault');
    m.setNotch(-3);go(40,()=>g.v*3.6<=41);const lim=g.lim;
    // 模擬到站並開門
    g.v=0;g.pos=g.S[1];g.stopSt=1;g.doors.side=g.stations[1].side;g.doors.state='open';g.doors.openT=7;g.cur=1;g.k=2;g.state='run';
    go(0.2,null);const blocked=g.evBlockClose;
    m.closeDoors();const stillOpen=g.doors.state==='open';
    go(13,null);const released=!g.evBlockClose;
    m.closeDoors();
    return {lim:+lim.toFixed(0),blocked,stillOpen,released,log:g.evLog.map(x=>x.id+':'+x.outcome),state:g.ev&&g.ev.state};`);
  ok('列車故障：限速 40、到站後清客期間不能關門、12 秒後可關門',r.lim<=41&&r.blocked&&r.stillOpen&&r.released,JSON.stringify(r));
  console.log('errors',errs);await b.close();
})();
