// 新事件的介面（依 2014 中時、2025 知新聞）：乘客對講監視螢幕與動作按鈕、軌道異物的 3D 物件、駕駛台燈號與儀表
const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const [n,vp] of [['橫握',{width:844,height:390}],['平板',{width:1024,height:768}],['直握',{width:390,height:800}]]){
  const ctx=await b.newContext({viewport:vp,isMobile:true,hasTouch:true});await ctx.addInitScript(()=>localStorage.setItem('mrt-tut','1'));
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1000);
  const start=()=>p.evaluate(()=>{Object.assign(SET,{line:'blue',from:2,to:10,events:true,bcOn:false,radio:false,theme:'day'});startRun();const g=G;g.state='run';g.pos=g.S[1]+300;g.k=2;g.v=18;g.time=5;g.ev=null;});
  const tapEl=async id=>{const r=await p.evaluate(id=>{const b=document.getElementById(id).getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];},id);await p.touchscreen.tap(...r);await p.waitForTimeout(250);};
  // 乘客對講
  await start();await p.evaluate(()=>{evStart(G,'intercom');G.ev.left=false;G.ic.left=false;G.ev.scn='medical';evIcAct(G,G.ev);});await p.waitForTimeout(500);
  const vis=await p.evaluate(()=>({ic:!document.getElementById('ic').hidden,act:getComputedStyle(document.getElementById('b-act')).display!=='none',txt:document.getElementById('b-act').textContent,cap:document.getElementById('ic-lb').textContent}));
  ok(n+' 對講：監視螢幕與按鈕出現',vis.ic&&vis.act&&vis.txt.includes('接聽'),JSON.stringify(vis));
  const box=await p.evaluate(()=>{const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height};};return {ic:r('ic'),act:r('b-act'),dashTop:window.dashTop||null,H:innerHeight,W:innerWidth};});
  ok(n+' 對講：螢幕與按鈕都在可視範圍內，彼此不重疊',box.ic.x>=0&&box.ic.y>=0&&box.ic.x+box.ic.w<=box.W&&box.ic.y+box.ic.h<=box.H&&box.act.x+box.act.w<=box.W+1&&(box.act.x>=box.ic.x+box.ic.w||box.act.y>=box.ic.y+box.ic.h||box.act.x+box.act.w<=box.ic.x||box.act.y+box.act.h<=box.ic.y),JSON.stringify(box));
  await tapEl('b-act');
  await p.waitForFunction(()=>document.getElementById('b-act').textContent.includes('回報行控'),null,{timeout:5000}).catch(()=>{});   // 按鈕文字在下一個畫面更新時才換（慢機器上要多等）
  const ph=await p.evaluate(()=>({ph:G.ev&&G.ev.phase,ev:G.ev&&G.ev.id,act:G.evAct&&G.evAct.label,disp:getComputedStyle(document.getElementById('b-act')).display}));
  ok(n+' 觸控「接聽」後進入回報階段',ph.ph==='report'&&(await p.textContent('#b-act')).includes('回報行控'),JSON.stringify(ph));
  await tapEl('b-act');await p.evaluate(()=>{G.cur++;});await p.waitForTimeout(300);
  ok(n+' 回報並到站後事件完成、螢幕與按鈕消失',await p.evaluate(()=>G.ev===null&&document.getElementById('ic').hidden&&getComputedStyle(document.getElementById('b-act')).display==='none'));
  // 軌道異物的 3D 物件
  await start();await p.evaluate(()=>evStart(G,'debris'));await p.waitForTimeout(800);
  const hi=await p.evaluate(()=>({h:R3.hazInfo(),pos:G.hz.pos}));
  ok(n+' 異物：3D 場景的異物物件可見、位置在事件指定的里程（z = −里程）',hi.h.debris&&Math.abs(hi.h.debrisZ+hi.pos)<0.01&&!hi.h.person,JSON.stringify(hi));
  await p.evaluate(()=>{G.hz=null;G.ev=null;});await p.waitForTimeout(400);
  ok(n+' 異物清除後 3D 物件隱藏',await p.evaluate(()=>!R3.hazInfo().debris));
  // 駕駛台燈號：EB／門警
  await start();await p.evaluate(()=>{G.trip=false;G.v=8;G.notch=0;G.hz=null;G.ev=null;});await p.waitForTimeout(300);
  const l0=await p.evaluate(()=>__mrt.cabLampState(G));
  ok(n+' 駕駛台燈號：平常全部熄滅',!l0.eb&&!l0.door&&!l0.fault,JSON.stringify(l0));
  await p.evaluate(()=>{setNotch(-8);});const l1=await p.evaluate(()=>__mrt.cabLampState(G));
  ok(n+' 駕駛台燈號：緊急煞車時 EB-A／EB-B 亮',l1.eb===true);
  await p.evaluate(()=>{setNotch(0);G.doors.state='open';});const l2=await p.evaluate(()=>__mrt.cabLampState(G));
  ok(n+' 駕駛台燈號：開門時車門警示燈亮、EB 熄',l2.door===true&&l2.eb===false);
  await p.evaluate(()=>{G.doors.state='closed';evStart(G,'power');});const l3=await p.evaluate(()=>__mrt.cabLampState(G));
  ok(n+' 駕駛台燈號：供電異常時故障燈亮',l3.fault===true);
  ok(n+' 無錯誤',errs.length===0,errs.join());
  await ctx.close();
}
await b.close();})();
