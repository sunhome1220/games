const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
const BASE='http://localhost:8765/taipei-mrt-driver/index.html';
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
  const mk=async(init,url)=>{const ctx=await b.newContext({viewport:{width:900,height:900}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));if(init)await p.addInitScript(init);await p.goto(url||BASE);await p.waitForTimeout(900);await p.evaluate(()=>{__mrt.SET.events=false;__mrt.SET.bcOn=false;__mrt.SET.haptic=false;});return {ctx,p};};
  // ---------- A. 從連結載入 ----------
  let {ctx,p}=await mk(null,BASE+'?line=blue&from=BL07&to=BL09&model=341&theme=night');
  let r=await p.evaluate(()=>({set:[__mrt.SET.line,__mrt.SET.from,__mrt.SET.to,__mrt.SET.model,__mrt.SET.theme],banner:document.getElementById('sharebanner').hidden?null:document.getElementById('sharebanner').textContent,model:document.getElementById('m-model').value,names:[__mrt.G.stations[0].name,__mrt.G.stations.slice(-1)[0].name],search:location.search}));
  ok('連結參數套用到設定（板南線 BL07→BL09、341、夜晚）',JSON.stringify(r.set)==='["blue",6,8,"341","night"]'&&r.names.join()==='板橋,江子翠'&&r.model==='341',JSON.stringify(r));
  ok('顯示「已載入朋友分享的關卡」提示',/已載入朋友分享的關卡：板南線 板橋 → 江子翠（2 站）/.test(r.banner||''),r.banner);
  ok('網址上的參數被清掉（重新整理不會再蓋掉之後的選擇）',r.search==='');
  await ctx.close();
  // ---------- B. 不合法或惡意參數一律忽略 ----------
  const bad=[['未知路線','?line=foo&from=BL07&to=BL09'],['原型鏈名稱 constructor','?line=constructor&from=a&to=b'],['原型鏈名稱 __proto__','?line=__proto__&from=BL07&to=BL09'],['站號不在該路線','?line=blue&from=R05&to=BL09'],['起訖相同','?line=blue&from=BL07&to=BL07'],['缺少參數','?line=blue&from=BL07'],['HTML 注入','?line=blue&from=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E&to=BL09']];
  for(const [label,q] of bad){
    ({ctx,p}=await mk(null,BASE+q));
    const rr=await p.evaluate(()=>({hidden:document.getElementById('sharebanner').hidden,from:__mrt.SET.from,to:__mrt.SET.to,imgs:document.querySelectorAll('#menu img').length}));
    ok(`不合法參數被忽略：${label}`,rr.hidden&&rr.imgs===0,JSON.stringify(rr));await ctx.close();
  }
  ({ctx,p}=await mk(null,BASE+'?line=blue&from=BL07&to=BL09&model=C301&theme=pink'));
  r=await p.evaluate(()=>[__mrt.SET.model,__mrt.SET.theme]);
  ok('車型不屬於該路線改回隨機；不合法的天色忽略（關卡本身仍套用）',r[0]==='auto'&&r[1]!=='pink',JSON.stringify(r));await ctx.close();
  // ---------- C. 系統分享面板（iPhone／iPad／Mac 的面板內有 AirDrop）----------
  const shareStub=`window.__sh=[];Object.defineProperty(navigator,'share',{configurable:true,value:function(d){window.__sh.push({d,active:navigator.userActivation&&navigator.userActivation.isActive});return window.__shMode==='abort'?Promise.reject(Object.assign(new Error('x'),{name:'AbortError'})):window.__shMode==='deny'?Promise.reject(Object.assign(new Error('x'),{name:'NotAllowedError'})):Promise.resolve();}});window.__cb=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:t=>{window.__cb.push(t);return Promise.resolve();}}});`;
  ({ctx,p}=await mk(shareStub));
  await p.evaluate(()=>{Object.assign(__mrt.SET,{line:'blue',from:6,to:8,model:'341',theme:'dusk'});});
  await p.evaluate(()=>{fillMenu();});
  await p.click('#m-share');await p.waitForTimeout(200);
  r=await p.evaluate(()=>({n:window.__sh.length,p:window.__sh[0]&&window.__sh[0].d,active:window.__sh[0]&&window.__sh[0].active,box:document.getElementById('sh-menu').hidden}));
  ok('點分享：呼叫系統分享面板一次，並且是在點擊當下（使用者啟動中）呼叫',r.n===1&&r.active===true,JSON.stringify({n:r.n,active:r.active}));
  const u=new URL(r.p.url);
  ok('分享內容：標題、文字、連結分開提供（AirDrop 會收到連結）',r.p.title==='北捷駕駛模擬'&&/板南線 板橋 → 江子翠/.test(r.p.text)&&/341 型/.test(r.p.text)&&u.searchParams.get('line')==='blue'&&u.searchParams.get('from')==='BL07'&&u.searchParams.get('to')==='BL09'&&u.searchParams.get('model')==='341'&&u.searchParams.get('theme')==='dusk',JSON.stringify(r.p));
  ok('成功分享後不顯示複製框',r.box===true);
  // 來回一致：把分享出去的連結再解析，得到同一個關卡
  r=await p.evaluate((url)=>{const keep={...__mrt.SET};Object.assign(__mrt.SET,{line:'red',from:0,to:3,model:'auto',theme:'day'});const o=applyShareParams(new URL(url).search);return {o,set:[__mrt.SET.line,__mrt.SET.from,__mrt.SET.to,__mrt.SET.model,__mrt.SET.theme]};},r.p?JSON.stringify(0)&&u.href:'');
  ok('分享出去的連結再被解析，得到同一個關卡（來回一致）',JSON.stringify(r.set)==='["blue",6,8,"341","dusk"]',JSON.stringify(r.set));
  // 使用者關掉分享面板：不算錯誤
  await p.evaluate(()=>{window.__shMode='abort';document.getElementById('sh-menu').hidden=true;});
  await p.click('#m-share');await p.waitForTimeout(200);
  ok('使用者關掉分享面板（AbortError）：不顯示錯誤、不複製',await p.evaluate(()=>document.getElementById('sh-menu').hidden===true&&window.__cb.length===0));
  // 分享被拒絕：退回複製連結
  await p.evaluate(()=>{window.__shMode='deny';});
  await p.click('#m-share');await p.waitForTimeout(300);
  r=await p.evaluate(()=>({box:!document.getElementById('sh-menu').hidden,ta:document.querySelector('#sh-menu textarea')&&document.querySelector('#sh-menu textarea').value,st:document.querySelector('#sh-menu .sh-st').textContent,cb:window.__cb.slice(-1)[0]}));
  ok('分享失敗（NotAllowedError）：退回複製，並如實說明是「分享沒有成功」',r.box&&/line=blue/.test(r.ta)&&/分享沒有成功，已改為複製連結/.test(r.st)&&r.cb===r.ta,JSON.stringify({st:r.st}));
  await ctx.close();
  // ---------- D. 沒有分享面板的瀏覽器（例如部分桌面瀏覽器）----------
  ({ctx,p}=await mk(`window.__cb=[];Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:t=>{window.__cb.push(t);return Promise.resolve();}}});`));
  await p.click('#m-share');await p.waitForTimeout(300);
  r=await p.evaluate(()=>({st:document.querySelector('#sh-menu .sh-st').textContent,cb:window.__cb.length,ta:document.querySelector('#sh-menu textarea').value}));
  ok('沒有 navigator.share：複製連結並顯示',r.cb===1&&/已複製/.test(r.st)&&/\?line=/.test(r.ta),r.st);
  await ctx.close();
  ({ctx,p}=await mk(`Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}});document.execCommand=()=>false;`));
  await p.click('#m-share');await p.waitForTimeout(300);
  r=await p.evaluate(()=>document.querySelector('#sh-menu .sh-st').textContent);
  ok('連剪貼簿都不能用：提示使用者手動複製文字',/長按下方文字複製/.test(r),r);await ctx.close();
  // ---------- E. 結算頁分享成績 ----------
  ({ctx,p}=await mk(shareStub));
  await p.evaluate(()=>{__mrt.SET.driver='小明';});
  await p.evaluate(()=>{const m=__mrt;Object.assign(m.SET,{line:'red',from:27,to:26,model:'C381',theme:'day',events:false,bcOn:false,haptic:false});m.startRun();
    const g=m.G;for(let i=0;i<60*60*15;i++){m.step(1/60);if(i%6===0){const D=g.doors;if(g.state==='finish'||g.k>=g.S.length)continue;const d=g.S[g.k]-g.pos,v=g.v,kmh=v*3.6;
      if(v<0.05&&D.state==='closed'){const j=g.S.findIndex(s=>{const e=s-g.pos;return e<=10&&e>=-30;});if(j===g.k){m.setNotch(0);m.openDoors(g.stations[j].side);continue;}}
      if(D.state==='open'&&D.openT>=6.5&&g.time>=g.tDep[g.cur]-1){m.closeDoors();continue;}if(D.state!=='closed')continue;if(g.trip){m.setNotch(0);continue;}
      if(v<0.05&&d>20){if(g.time>=g.tDep[g.cur])m.setNotch(3);continue;}const a=v*v/(2*Math.max(d,0.01));if(d<=0.02){m.setNotch(-3);continue;}
      if(v>0.3&&(a>0.8||g.notch<0&&a>0.15)){const need=g.dec.findIndex(x=>x>=a*1.03);let nn=need<0?7:need+1;if(v<2.5)nn=Math.min(nn,2);if(v<1.2)nn=1;m.setNotch(-nn);}
      else if(kmh>g.lim-6)m.setNotch(-5);else if(kmh<Math.min(g.lim-8,g.M.vmax-4)&&d>300)m.setNotch(4);else if(v>0.3)m.setNotch(0);else m.setNotch(2);}
      if(g.endT>0&&g.endT<0.05)break;}});
  await p.waitForSelector('#result:not(.hidden)',{timeout:20000});
  await p.click('#r-share');await p.waitForTimeout(300);
  r=await p.evaluate(()=>({d:window.__sh[0]&&window.__sh[0].d,res:{total:LASTRES.total,grade:LASTRES.grade}}));
  const ru=new URL(r.d.url);
  ok('成績分享：文字含駕駛名稱、路線、車型、評級與總分',/駕駛 小明/.test(r.d.text)&&/淡水信義線 淡水 → 紅樹林/.test(r.d.text)&&/C381 型/.test(r.d.text)&&r.d.text.includes('總分 '+r.res.total)&&r.d.text.includes(r.res.grade+' 評級'),r.d.text);
  ok('成績分享的連結是「同一關」（路線、起訖站、車型、天色）',ru.searchParams.get('line')==='red'&&ru.searchParams.get('from')==='R28'&&ru.searchParams.get('to')==='R27'&&ru.searchParams.get('model')==='C381'&&ru.searchParams.get('theme')==='day',r.d.url);
  console.log('errors',errs);await b.close();
})();
