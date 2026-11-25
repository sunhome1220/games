// 3D 軌道轉彎（彎曲世界）：彎道前方的偏移量大、直線段小；材質都已補丁且沒有 GL／著色器錯誤；開關有效；畫面確實不同
const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:844,height:390}});await ctx.addInitScript(()=>localStorage.setItem('mrt-tut','1'));
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'||(m.type()==='warning'&&/shader|GL|program/i.test(m.text())))errs.push(m.text().slice(0,200));});
await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1500);
for(const [n,o] of [['藍線地下',{line:'blue',from:0,to:8}],['紅線高架',{line:'red',from:27,to:20}],['文湖線',{line:'brown',from:0,to:8}],['綠線',{line:'green',from:0,to:8}]]){
  await p.evaluate(([o])=>{Object.assign(SET,o,{events:false,bcOn:false,theme:'day'});startRun();G.state='run';rmHide();R3.setBend(null);},[o]);
  await p.waitForTimeout(400);
  // 找一處彎道前、一處前方 480 m 內都是直線的位置
  const pos=await p.evaluate(()=>{const g=G,end=g.S[g.S.length-1];let curve=null,straight=null;
    for(let s=0;s<end-500&&(!curve||!straight);s+=20){let mx=0;for(let d=0;d<=480;d+=40)mx=Math.max(mx,Math.abs(pathLateral(g,s,d)));
      if(!curve&&mx>40)curve=s;if(!straight&&mx<1.5)straight=s;}
    return {curve,straight};});
  ok(n+' 找得到彎道前與直線段',pos.curve!==null);
  await p.evaluate(s=>{G.pos=s;G.v=0;},pos.curve);await p.waitForTimeout(900);
  const bi=await p.evaluate(()=>R3.bendInfo());
  ok(n+' 彎道前方偏移量大（>40 m）且彎曲已開啟',bi.on===1&&bi.max>40,JSON.stringify(bi));
  ok(n+' 場景裡所有網格的材質都已補丁（地面大平面除外）',bi.unpatched.length===0,JSON.stringify(bi.unpatched));
  const on=await p.screenshot({clip:{x:0,y:60,width:844,height:190}});
  await p.evaluate(()=>R3.setBend(false));await p.waitForTimeout(900);
  const off=await p.screenshot({clip:{x:0,y:60,width:844,height:190}});
  const bo=await p.evaluate(()=>R3.bendInfo());
  ok(n+' 關閉後 uOn=0、畫面不同',bo.on===0&&Buffer.compare(on,off)!==0,Math.abs(on.length-off.length)+' bytes 差');
  await p.evaluate(()=>R3.setBend(null));
  if(pos.straight!==null){await p.evaluate(s=>{G.pos=s;},pos.straight);await p.waitForTimeout(800);
    const bs=await p.evaluate(()=>R3.bendInfo());ok(n+' 直線段前方偏移量小（<5 m）',bs.max<5,bs.max.toFixed(2));}
}
ok('沒有 JS 錯誤或著色器／GL 警告',errs.length===0,errs.slice(0,3).join(' | '));
await b.close();})();
