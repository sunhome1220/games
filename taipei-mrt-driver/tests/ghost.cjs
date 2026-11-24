// 換關卡或重新開始時，上一班的 3D 車站要全部移除（曾經殘留在新路線上）
const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({viewport:{width:844,height:390}});await ctx.addInitScript(()=>localStorage.setItem('mrt-tut','1'));
const p=await ctx.newPage();await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1500);
await p.evaluate(()=>{Object.assign(SET,{line:'blue',from:12,to:15,events:false});startRun();G.pos=G.S[1]-0.1;G.state='run';});
await p.waitForTimeout(1200);
const old=await p.evaluate(()=>G.stations.filter(s=>s.g3).length);
await p.evaluate(()=>{window.__oldSt=G.stations;Object.assign(SET,{line:'red',from:27,to:20});startRun();G.state='run';});
await p.waitForTimeout(1200);
const r=await p.evaluate(()=>({left:__oldSt.filter(s=>s.g3).length}));
ok('換關卡後上一班的車站全部移除',old>0&&r.left===0,JSON.stringify({old,...r}));
await b.close();})();
