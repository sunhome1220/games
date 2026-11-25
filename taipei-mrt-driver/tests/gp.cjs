const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  await ctx.addInitScript(()=>{localStorage.setItem('mrt-tut','1');
    window.__pad={connected:false,id:'Test Pad',mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0})),rumbles:[],vibrationActuator:{playEffect:(t,o)=>{window.__pad.rumbles.push(o);return Promise.resolve();}}};
    navigator.getGamepads=()=>window.__pad.connected?[window.__pad]:[null,null,null,null];});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(900);
  const raf2=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))));
  const press=async(i)=>{await p.evaluate(i=>{__pad.buttons[i]={pressed:true,value:1};},i);await raf2();await p.evaluate(i=>{__pad.buttons[i]={pressed:false,value:0};},i);await raf2();};
  const notch=()=>p.evaluate(()=>__mrt.G.notch);
  ok('未接手把：手把教學不顯示',await p.evaluate(()=>document.getElementById('gptut').hidden));
  await p.evaluate(()=>{__pad.connected=true;});await p.waitForTimeout(300);
  ok('接上後在選單顯示手把教學（含按鍵表）',await p.evaluate(()=>!document.getElementById('gptut').hidden&&document.querySelectorAll('#gptut table.gp tr').length>=8));
  await press(0);
  ok('A 關閉手把教學並記錄',await p.evaluate(()=>document.getElementById('gptut').hidden&&localStorage.getItem('mrt-gp-tut')==='1'));
  await press(0);await p.waitForTimeout(400);
  ok('選單按 A 開始值勤',await p.evaluate(()=>document.getElementById('menu').classList.contains('hidden')&&!!__mrt.G));
  // 加減檔
  await press(12);await press(12);
  ok('十字鍵↑兩次 = P2',await notch()===2,String(await notch()));
  await press(13);
  ok('十字鍵↓ = P1',await notch()===1);
  await press(0);
  ok('A 回 N',await notch()===0);
  // 搖桿：推下去一次一檔，要回中才能再觸發
  await p.evaluate(()=>{__pad.axes[1]=0.9;});await raf2();
  ok('搖桿往上推（axes<0）才加檔：往下推 = B1',await notch()===-1,String(await notch()));
  await p.evaluate(()=>{__pad.axes[1]=0.9;});await p.waitForTimeout(250);
  ok('不回中、未達長按時間不連續跳檔',await notch()===-1,String(await notch()));
  await p.waitForTimeout(2200);
  ok('長按超過 0.5 秒後連續減檔',await notch()<=-2,String(await notch()));
  await p.evaluate(()=>{__pad.axes[1]=0.2;});await raf2();
  const n0=await notch();
  await p.evaluate(()=>{__pad.axes[1]=0.4;});await raf2();   // 低於死區：不動
  ok('小幅漂移（0.4）不動作',await notch()===n0);
  await p.evaluate(()=>{__pad.axes[1]=0;});await raf2();
  await press(0);
  await press(1);
  ok('B = EB',await notch()===-8);
  ok('EB 有手把震動',await p.evaluate(()=>__pad.rumbles.some(r=>r.strongMagnitude>=0.9)));
  await press(0);
  // 車門、鳴笛、退行、暫停
  await p.evaluate(()=>{window.__c=[];const o=openDoors,c=closeDoors,h=horn,r=toggleReverse;window.openDoors=s=>{__c.push('open'+s);};window.closeDoors=()=>__c.push('close');window.horn=()=>__c.push('horn');window.toggleReverse=()=>__c.push('rev');});
  await press(4);await press(5);await press(2);await press(3);await press(8);
  ok('LB/RB/X/Y/Back 對應',JSON.stringify(await p.evaluate(()=>__c))==='["openL","openR","close","horn","rev"]',JSON.stringify(await p.evaluate(()=>__c)));
  await press(9);
  ok('Start 暫停',await p.evaluate(()=>paused===true));
  await press(9);
  ok('Start 繼續',await p.evaluate(()=>paused===false));
  // 斷線
  await p.evaluate(()=>{__pad.connected=false;});await p.waitForTimeout(300);
  await press(12);
  ok('斷線後不再作用',await notch()===0);
  ok('無錯誤',errs.length===0,errs.join());
  await b.close();
})();
