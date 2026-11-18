const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const ctx=await b.newContext({viewport:{width:390,height:800},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1000);
  await p.evaluate(()=>{__mrt.SET.driver='SECRETNAME';});
  const tapId=async id=>{await p.evaluate(id=>document.getElementById(id).scrollIntoView({block:'center'}),id);const r=await p.evaluate(id=>{const b=document.getElementById(id).getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];},id);await p.touchscreen.tap(...r);await p.waitForTimeout(150);};
  ok('預設收合',await p.evaluate(()=>document.getElementById('fb-box').hidden));
  await tapId('m-fb');
  ok('觸控展開表單',!await p.evaluate(()=>document.getElementById('fb-box').hidden));
  // 空內容不送出
  await tapId('fb-send');
  ok('空內容提示',(await p.textContent('#fb-st')).includes('請先寫下'));
  await p.selectOption('#fb-type','bug');
  await p.fill('#fb-msg','按 B3 變 B1 & 特殊字元 #?=中文');
  const m=await p.evaluate(()=>{const o=fbBuild('bug',document.getElementById('fb-msg').value,true);return o;});
  ok('收件人正確',m.to==='pinhoward0704@gmail.com'&&m.url.startsWith('mailto:pinhoward0704@gmail.com?subject='),m.url.slice(0,70));
  const dec=decodeURIComponent(m.url.split('body=')[1]);
  ok('內文與特殊字元完整還原',dec.startsWith('按 B3 變 B1 & 特殊字元 #?=中文')&&dec.includes('版本 2026'),dec.slice(0,40));
  ok('不含駕駛名稱',!m.url.includes('SECRETNAME')&&!dec.includes('SECRETNAME'));
  const m2=await p.evaluate(()=>fbBuild('idea','x'.repeat(5000),false));
  ok('內文上限 1500、取消附資訊後不含資訊',decodeURIComponent(m2.url.split('body=')[1]).length===1500);
  // 實際按下寄出：攔截導向
  await p.evaluate(()=>{window.__nav=null;});
  const nav=p.waitForEvent('framenavigated',{timeout:1500}).catch(()=>null);
  await tapId('fb-send');await nav;
  ok('按寄出後狀態文字提示並含備援說明',(await p.textContent('#fb-st')).includes('複製內容'));
  await p.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:t=>{window.__cp=t;return Promise.resolve();}},configurable:true});});
  await tapId('fb-copy');
  const cp=await p.evaluate(()=>window.__cp||'');
  console.log('CP=',JSON.stringify(cp),await p.textContent('#fb-st'));ok('複製內容含收件人與主旨',cp.includes('pinhoward0704@gmail.com')&&cp.includes('[北捷駕駛模擬] 錯誤回報'),cp.slice(0,60));
  await tapId('fb-info-chk');
  ok('取消勾選隱藏資訊',await p.evaluate(()=>document.getElementById('fb-info').hidden));
  ok('無錯誤',errs.length===0,errs.join());
  await b.close();
})();
