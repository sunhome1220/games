// 只支援橫式：觸控裝置直放時擋住並暫停遊戲、轉橫後自動繼續；選單直放可用；桌機窄視窗不擋；新版本提示不折行
const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const mk=async(vp,touch)=>{const ctx=await b.newContext({viewport:vp,isMobile:touch,hasTouch:touch});await ctx.addInitScript(()=>localStorage.setItem('mrt-tut','1'));
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(900);return {ctx,p,errs};};
const rot=p=>p.evaluate(()=>({disp:getComputedStyle(document.getElementById('rot')).display,paused,time:G&&G.time}));
const startGame=p=>p.evaluate(()=>{Object.assign(SET,{line:'blue',from:0,to:5,events:false,bcOn:false,radio:false,theme:'day'});startRun();G.state='run';G.v=5;});
// 1. 觸控裝置：選單直放不受限
let t=await mk({width:390,height:844},true);
ok('選單直放：不擋（可以看選單、改設定）',(await t.p.evaluate(()=>getComputedStyle(document.getElementById('rot')).display))==='none');
// 2. 直放時開始遊戲 → 遮罩出現、自動暫停
await startGame(t.p);await t.p.waitForTimeout(500);
let r=await rot(t.p);
ok('直放開始遊戲：全螢幕遮罩出現且遊戲自動暫停',r.disp==='flex'&&r.paused===true,JSON.stringify(r));
const t0=r.time;await t.p.waitForTimeout(700);
ok('遮罩期間遊戲時間不前進',(await rot(t.p)).time===t0);
const cover=await t.p.evaluate(()=>{const b=document.getElementById('rot').getBoundingClientRect();return b.width>=innerWidth&&b.height>=innerHeight;});
ok('遮罩蓋滿整個螢幕',cover);
// 3. 轉橫 → 遮罩消失、自動繼續
await t.p.setViewportSize({width:844,height:390});await t.p.waitForTimeout(600);
r=await rot(t.p);
ok('轉成橫放：遮罩消失、遊戲自動繼續',r.disp==='none'&&r.paused===false,JSON.stringify(r));
const t1=r.time;await t.p.waitForTimeout(600);
ok('繼續後遊戲時間前進',(await rot(t.p)).time>t1);
// 4. 再轉直 → 又擋住；轉橫 → 繼續
await t.p.setViewportSize({width:390,height:844});await t.p.waitForTimeout(500);
ok('再轉成直放：又擋住並暫停',(await rot(t.p)).disp==='flex'&&(await rot(t.p)).paused===true);
// 5. 使用者自己按了暫停：轉橫後不要自動繼續
await t.p.setViewportSize({width:844,height:390});await t.p.waitForTimeout(500);
await t.p.evaluate(()=>{togglePause();});
await t.p.setViewportSize({width:390,height:844});await t.p.waitForTimeout(400);await t.p.setViewportSize({width:844,height:390});await t.p.waitForTimeout(500);
ok('使用者自己暫停的：轉橫後仍保持暫停（不會被自動繼續）',(await rot(t.p)).paused===true);
ok('無錯誤',t.errs.length===0,t.errs.join());await t.ctx.close();
// 6. 桌機（沒有觸控）的窄視窗：不擋
t=await mk({width:390,height:844},false);await startGame(t.p);await t.p.waitForTimeout(500);
r=await rot(t.p);ok('沒有觸控的桌機窄視窗：不擋、遊戲照常進行',r.disp==='none'&&r.paused===false,JSON.stringify(r));await t.ctx.close();
// 7. iPad 橫放：不擋；iPad 直放：擋
t=await mk({width:1024,height:768},true);await startGame(t.p);await t.p.waitForTimeout(400);
ok('iPad 橫放：不擋',(await rot(t.p)).disp==='none');
await t.p.setViewportSize({width:768,height:1024});await t.p.waitForTimeout(500);
ok('iPad 直放：擋住並暫停',(await rot(t.p)).disp==='flex'&&(await rot(t.p)).paused===true);await t.ctx.close();
// 8. 新版本提示在直放的選單也只佔一行（不折行）
t=await mk({width:390,height:844},true);
const nv=await t.p.evaluate(()=>{const b=document.getElementById('newver');b.hidden=false;const r=b.getBoundingClientRect();const lh=parseFloat(getComputedStyle(b).lineHeight)||20;return {h:r.height,w:r.width,W:innerWidth,txt:b.textContent,lh};});
ok('新版本提示：單行（高度 < 兩行）、寬度在畫面內',nv.h<nv.lh+20&&nv.w<=nv.W,JSON.stringify(nv));
await t.ctx.close();
await b.close();})();
