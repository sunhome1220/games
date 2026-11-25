// 駕駛名牌：縮小並放在左上（車型銘板旁），不蓋住儀表與操作；可在設定關閉
const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const [n,vp] of [['手機橫握',{width:844,height:390}],['iPad',{width:1024,height:768}],]){
  const ctx=await b.newContext({viewport:vp,isMobile:true,hasTouch:true});await ctx.addInitScript(()=>localStorage.setItem('mrt-tut','1'));
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1000);
  const run=async(models)=>{await p.evaluate(m=>{Object.assign(SET,{line:m.line,from:0,to:5,model:m.model,events:false,bcOn:false,radio:false,theme:'day',nameplate:true,driver:'ANDY'});startRun();G.state='run';G.v=0;},models);await p.waitForTimeout(500);};
  for(const m of [{line:'blue',model:'321'},{line:'brown',model:'VAL256'}]){
    await run(m);
    const r=await p.evaluate(()=>({np:__mrt.NPR,W:innerWidth,H:innerHeight,top:dashTop,dashX0,dashX1,land}));
    ok(`${n} ${m.model}：名牌顯示、小（寬 ≤ 150、高 ≤ 18）`,!!r.np&&r.np.w<=150&&r.np.h<=18,JSON.stringify(r.np));
    ok(`${n} ${m.model}：名牌從左側開始（不在儀表正上方的中央）`,!!r.np&&r.np.x<r.W*0.85&&r.np.x>=0,r.np&&Math.round(r.np.x+r.np.w)+' / '+r.W);
    ok(`${n} ${m.model}：名牌不超出儀表範圍、貼在儀表上緣`,!!r.np&&r.np.x+r.np.w<=r.dashX1&&Math.abs(r.np.y+r.np.h/2-r.top)<2);
  }
  // 短名字也要顯示（曾因最小寬度限制而整個不畫）
  await p.evaluate(()=>{SET.driver='Mei';});await p.waitForTimeout(400);
  ok(`${n} 短名字（Mei）也顯示名牌`,await p.evaluate(()=>!!__mrt.NPR&&__mrt.NPR.w>=44&&__mrt.NPR.w<110),JSON.stringify(await p.evaluate(()=>__mrt.NPR)));
  await p.evaluate(()=>{SET.driver='ANDY';SET.nameplate=false;});await p.waitForTimeout(400);
  ok(`${n} 設定關閉後不顯示名牌`,await p.evaluate(()=>__mrt.NPR===null));
  ok(`${n} 選單有「顯示小名牌」設定`,await p.evaluate(()=>!!document.getElementById('m-nameplate')));
  ok(`${n} 無錯誤`,errs.length===0,errs.join());
  await ctx.close();
}
await b.close();})();
