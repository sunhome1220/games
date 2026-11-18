// 匿名統計：DNT、本機不統計、事件送出、統計服務失敗不影響遊戲。用 Playwright 路由把假網域 stats.test 對到本機檔案，GoatCounter 腳本以假的取代。
const { chromium } = require('playwright');
const fs=require('fs'),path=require('path');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
const ROOT=path.join(__dirname,'..','..');
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css'};
async function open(b,{dnt,gcFail}={}){
  const ctx=await b.newContext({viewport:{width:900,height:520}});
  if(dnt)await ctx.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{value:'1'}));
  await ctx.addInitScript(()=>localStorage.setItem('mrt-tut','1'));
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const gcReq=[];
  await p.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(u.hostname==='gc.zgo.at'){gcReq.push(u.href);
      if(gcFail)return r.abort();
      return r.fulfill({contentType:'application/javascript',body:`window.__gcCalls=[];window.goatcounter={count:o=>window.__gcCalls.push(o)};`});}
    if(u.hostname==='stats.test'){
      let f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});
      return r.fulfill({contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});}
    return r.continue();
  });
  return {ctx,p,errs,gcReq};
}
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  // 1. 一般瀏覽器
  let t=await open(b);
  await t.p.goto('http://stats.test/taipei-mrt-driver/index.html');await t.p.waitForTimeout(1200);
  const sc=await t.p.evaluate(()=>{const s=document.querySelector('script[data-goatcounter]');return s&&{u:s.getAttribute('data-goatcounter'),src:s.src};});
  ok('載入 GoatCounter 腳本且站台網址正確',sc&&sc.u==='https://sunhome.goatcounter.com/count'&&sc.src.includes('gc.zgo.at/count.js'),JSON.stringify(sc));
  await t.p.evaluate(()=>{SET.line='blue';startRun();});await t.p.waitForTimeout(500);
  let calls=await t.p.evaluate(()=>window.__gcCalls);
  ok('開始遊玩送出 play 與 play-路線 事件',calls.some(c=>c.path==='play'&&c.event===true)&&calls.some(c=>c.path==='play-blue'&&c.event===true),JSON.stringify(calls.map(c=>c.path)));
  ok('事件內容不含駕駛名稱或成績',!JSON.stringify(calls).includes('ANDY'));
  await t.p.evaluate(()=>{G.state='run';showResult();});await t.p.waitForTimeout(300);
  calls=await t.p.evaluate(()=>window.__gcCalls);
  ok('結算送出 finish 事件',calls.some(c=>c.path==='finish'));
  ok('選單有統計告知文字',await t.p.evaluate(()=>document.body.textContent.includes('匿名統計')));
  ok('無錯誤',t.errs.length===0,t.errs.join());await t.ctx.close();
  // 2. Do Not Track
  t=await open(b,{dnt:true});
  await t.p.goto('http://stats.test/taipei-mrt-driver/index.html');await t.p.waitForTimeout(1000);
  await t.p.evaluate(()=>{startRun();});await t.p.waitForTimeout(300);
  ok('Do Not Track：不載入腳本、不送事件',t.gcReq.length===0&&await t.p.evaluate(()=>!document.querySelector('script[data-goatcounter]')&&!window.__gcCalls));
  await t.ctx.close();
  // 3. 統計服務連不上：遊戲照常
  t=await open(b,{gcFail:true});
  await t.p.goto('http://stats.test/taipei-mrt-driver/index.html');await t.p.waitForTimeout(1000);
  await t.p.evaluate(()=>{startRun();});await t.p.waitForTimeout(500);
  ok('統計服務連不上：遊戲照常開始、無錯誤',await t.p.evaluate(()=>!!G&&G.state!=='result')&&t.errs.length===0,t.errs.join());
  await t.ctx.close();
  // 4. 本機開發不統計
  const c=await b.newContext();const p=await c.newPage();const req=[];
  await p.route('**/gc.zgo.at/**',r=>{req.push(1);r.abort();});
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(800);
  ok('localhost 不載入統計',req.length===0);
  await b.close();
})();
