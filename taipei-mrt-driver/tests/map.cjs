const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const S=process.env.SHOT_DIR||require('os').tmpdir();
  for(const [name,vp] of [['land',{width:844,height:390}],]){
    const ctx=await b.newContext({viewport:vp,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(800);
    await p.evaluate(()=>{Object.assign(__mrt.SET,{line:'blue',from:0,to:10,events:false});__mrt.startRun();});
    await p.waitForTimeout(500);
    ok(name+' 地圖預設收合',await p.evaluate(()=>document.getElementById('rmap').hidden));
    const zi=await p.evaluate(()=>({n:__mrt.G.zones.length,z0:__mrt.G.zones.slice().sort((a,b)=>a.s0-b.s0)[0]}));
    ok(name+' 本班有限速區間',zi.n>0,JSON.stringify(zi));
    // 把車移到第一個區間前 300 m
    await p.evaluate(z=>{const g=__mrt.G;g.pos=z.s0-300;},zi.z0);
    await p.waitForTimeout(400);
    const r=await p.evaluate(()=>{const b=document.getElementById('b-map').getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];});
    await p.touchscreen.tap(...r);await p.waitForTimeout(500);
    ok(name+' 觸控展開地圖',!await p.evaluate(()=>document.getElementById('rmap').hidden));
    await p.waitForFunction(()=>/前方 \d+ m (左|右)彎/.test(document.getElementById('rmap-now').textContent),null,{timeout:5000}).catch(()=>{});
    const info=await p.evaluate(()=>({txt:document.getElementById('rmap-now').textContent,st:document.querySelectorAll('#rmap-in text').length,rects:document.querySelectorAll('#rmap-in rect').length,sl:document.getElementById('rmap-in').scrollLeft}));
    ok(name+' 預告文字',/前方 \d+ m (左|右)彎 R\d+\s+降為 \d+ km\/h/.test(info.txt),info.txt);
    ok(name+' 地圖有站名與區段',info.st>=11&&info.rects>5,JSON.stringify(info));
    await p.screenshot({path:`${S}/map-${name}.png`});
    // 進入區間
    await p.evaluate(z=>{__mrt.G.pos=z.s0+10;},zi.z0);await p.waitForTimeout(400);
    await p.waitForFunction(()=>/(左|右)彎 R\d+\s+限速 \d+，還有 \d+ m/.test(document.getElementById('rmap-now').textContent),null,{timeout:5000}).catch(()=>{});   // 文字每 200 ms 更新一次，慢機器上要多等
    ok(name+' 區間內文字',/(左|右)彎 R\d+\s+限速 \d+，還有 \d+ m/.test(await p.textContent('#rmap-now')));
    await p.touchscreen.tap(...r);await p.waitForTimeout(200);
    ok(name+' 再點收合',await p.evaluate(()=>document.getElementById('rmap').hidden));
    // 手機橫握：事件進行中或行控來電時路線圖暫時隱藏（免得蓋住事件橫幅與字幕），結束後回來；螢幕大（直握視為大版面）不隱藏
    await p.touchscreen.tap(...r);await p.waitForTimeout(300);                       // 再展開
    await p.evaluate(()=>{Object.assign(SET,{radio:true,events:true});const g=__mrt.G;g.state='run';g.ev=null;OC.cap=null;});await p.waitForTimeout(500);
    const vis=()=>p.evaluate(()=>getComputedStyle(document.getElementById('rmap')).visibility);
    ok(name+' 沒有事件時路線圖可見',await vis()==='visible');
    await p.evaluate(()=>{evStart(__mrt.G,'power');});await p.waitForTimeout(800);
    const want=name==='land'?'hidden':'visible';
    ok(name+' 事件進行中路線圖'+(want==='hidden'?'暫時隱藏':'維持可見'),await vis()===want,await vis());
    await p.evaluate(()=>{const g=__mrt.G;evClear(g);g.ev=null;OC.cap=null;});await p.waitForTimeout(800);
    ok(name+' 事件結束後路線圖回來',await vis()==='visible');
    ok(name+' 無錯誤',errs.length===0,errs.join());
    await ctx.close();
  }
  await b.close();
})();
