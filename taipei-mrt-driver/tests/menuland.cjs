// 手機橫握的選單：不必捲動就看得到「開始值勤」；左右兩欄；直握與平板版面維持原樣；橫握時點路線／預設關卡／開始都正常
const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const open=async vp=>{const c=await b.newContext({viewport:vp,isMobile:true,hasTouch:true});await c.addInitScript(()=>localStorage.setItem('mrt-tut','1'));
  const p=await c.newPage();p.on('pageerror',e=>console.log('pageerror',e.message));await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForSelector('#m-go');await p.waitForTimeout(800);return [c,p];};
const geo=p=>p.evaluate(()=>{const r=id=>document.getElementById(id).getBoundingClientRect();const go=r('m-go'),ln=r('m-lines'),inf=r('m-info');return {goBottom:go.bottom,goTop:go.top,goLeft:go.left,lnRight:ln.right,infoTop:inf.top,H:innerHeight,W:innerWidth,sw:document.documentElement.scrollWidth};});
for(const [n,vp] of [['手機橫握 844×390',{width:844,height:390}],['小手機橫握 667×375',{width:667,height:375}],['手機橫握 932×430',{width:932,height:430}]]){
  const [c,p]=await open(vp);const g=await geo(p);
  ok(n+'：「開始值勤」不必捲動就在畫面內',g.goBottom<=g.H&&g.goTop>=0,JSON.stringify(g));
  ok(n+'：左右兩欄（開始鈕在路線右邊）、沒有橫向捲動',g.goLeft>=g.lnRight-2&&g.sw<=g.W+1,JSON.stringify({goLeft:g.goLeft,lnRight:g.lnRight}));
  await p.locator('.chip.ln >> text=板南線').tap();await p.waitForTimeout(200);
  ok(n+'：點路線有效',await p.evaluate(()=>SET.line==='blue'));
  await p.locator('#m-presets .chip').nth(1).tap();await p.waitForTimeout(200);
  const pr=await p.evaluate(()=>[SET.from,SET.to]);ok(n+'：點預設關卡有效',pr[0]===11&&pr[1]===14,JSON.stringify(pr));
  await p.locator('#m-go').tap();await p.waitForFunction(()=>!!G&&G.state!==undefined&&document.getElementById('menu').classList.contains('hidden'),null,{timeout:8000}).catch(()=>{});
  ok(n+'：按開始後進入遊戲',await p.evaluate(()=>document.getElementById('menu').classList.contains('hidden')));
  await c.close();}
{const [c,p]=await open({width:390,height:844});const g=await geo(p);
  ok('直握：版面維持單欄（開始鈕在路線下方）',g.infoTop>0&&g.goTop>g.infoTop&&g.goLeft<g.W/2,JSON.stringify(g));await c.close();}
{const [c,p]=await open({width:1024,height:768});const g=await geo(p);
  ok('平板橫握：維持單欄置中',g.goLeft<g.lnRight&&g.goTop>g.infoTop,JSON.stringify(g));await c.close();}
await b.close();})();
