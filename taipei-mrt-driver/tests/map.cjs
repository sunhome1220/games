const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const S=process.env.SHOT_DIR||require('os').tmpdir();
  for(const [name,vp] of [['land',{width:844,height:390}],['port',{width:390,height:800}]]){
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
    const info=await p.evaluate(()=>({txt:document.getElementById('rmap-now').textContent,st:document.querySelectorAll('#rmap-in text').length,rects:document.querySelectorAll('#rmap-in rect').length,sl:document.getElementById('rmap-in').scrollLeft}));
    ok(name+' 預告文字',/前方 \d+ m (左|右)彎 R\d+\s+降為 \d+ km\/h/.test(info.txt),info.txt);
    ok(name+' 地圖有站名與區段',info.st>=11&&info.rects>5,JSON.stringify(info));
    await p.screenshot({path:`${S}/map-${name}.png`});
    // 進入區間
    await p.evaluate(z=>{__mrt.G.pos=z.s0+10;},zi.z0);await p.waitForTimeout(400);
    ok(name+' 區間內文字',/(左|右)彎 R\d+\s+限速 \d+，還有 \d+ m/.test(await p.textContent('#rmap-now')));
    await p.touchscreen.tap(...r);await p.waitForTimeout(200);
    ok(name+' 再點收合',await p.evaluate(()=>document.getElementById('rmap').hidden));
    ok(name+' 無錯誤',errs.length===0,errs.join());
    await ctx.close();
  }
  await b.close();
})();
