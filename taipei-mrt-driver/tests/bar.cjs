// 駕駛台按鈕燈號：停妥時開門鈕亮白燈（兩側都亮，不洩漏門側）、開門後該側亮綠燈、可關門時關門鈕亮琥珀燈、
// 關門中閃爍、退行中退行鈕亮燈且文字變「恢復前進」、緊急煞車作用時紅燈閃；行駛中全部不亮
const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const [n,vp] of [['橫握',{width:844,height:390}],['直握',{width:390,height:800}]]){
  const ctx=await b.newContext({viewport:vp,isMobile:true,hasTouch:true});await ctx.addInitScript(()=>localStorage.setItem('mrt-tut','1'));
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1000);
  const waitCls=async(id,want)=>{for(let i=0;i<30;i++){const v=await p.evaluate(id=>document.getElementById(id).className.replace(/\bpb\b|\bdoor\b|\bclose\b|\brev\b|\beb\b/g,'').trim(),id);if(v===want)return;await p.waitForTimeout(100);}};   // 慢機器上畫面更新可能晚於固定等待
  const cls=()=>p.evaluate(()=>Object.fromEntries(['b-ol','b-close','b-or','b-rev','b-eb'].map(i=>[i,document.getElementById(i).className.replace(/\bpb\b|\bdoor\b|\bclose\b|\brev\b|\beb\b/g,'').trim()])));
  await p.evaluate(()=>{Object.assign(SET,{line:'blue',from:12,to:15,events:false,bcOn:false});startRun();G.state='run';G.pos=G.S[1]-300;G.v=15;});await p.waitForTimeout(300);
  let c=await cls();ok(n+' 行駛中全部不亮',Object.values(c).every(v=>v===''),JSON.stringify(c));
  await p.evaluate(()=>{G.pos=G.S[1]-0.1;G.v=0;});await waitCls('b-ol','ready');
  c=await cls();ok(n+' 停妥在月台：兩個開門鈕都亮白燈',c['b-ol']==='ready'&&c['b-or']==='ready'&&c['b-close']==='',JSON.stringify(c));
  const side=await p.evaluate(()=>G.stations[1].side);
  await p.evaluate(s=>openDoors(s),side);await waitCls(side==='L'?'b-ol':'b-or','on');
  c=await cls();const on=side==='L'?'b-ol':'b-or',off=side==='L'?'b-or':'b-ol';
  ok(n+' 開門後該側亮綠燈、另一側不亮',c[on]==='on'&&c[off]==='',JSON.stringify(c));
  ok(n+' 未滿最少停留時間：關門鈕不亮',c['b-close']==='');
  await p.evaluate(()=>{G.doors.state='open';G.doors.openT=10;});await waitCls('b-close','ready');
  ok(n+' 可關門：關門鈕亮琥珀燈',(await cls())['b-close']==='ready');
  await p.evaluate(()=>closeDoors());await waitCls('b-close','ready blink');
  ok(n+' 關門中：關門鈕閃爍',(await cls())['b-close']==='ready blink');
  await p.evaluate(()=>{setNotch(-8);});await waitCls('b-eb','on');
  ok(n+' 緊急煞車：紅燈閃',(await cls())['b-eb']==='on');
  await p.evaluate(()=>{setNotch(0);G.doors.state='closed';G.doors.frac=0;G.rev=true;syncRevBtn();});await waitCls('b-rev','on');
  ok(n+' 退行中：退行鈕亮燈、文字為「恢復前進」',(await cls())['b-rev']==='on'&&await p.textContent('#b-rev-t')==='恢復前進');
  const geo=await p.evaluate(()=>['b-ol','b-close','b-or','b-rev','b-eb'].map(i=>{const r=document.getElementById(i).getBoundingClientRect(),l=document.querySelector('#'+i+' .lb').getBoundingClientRect();return {w:r.width,h:r.height,lw:l.width,lh:l.height};}));
  ok(n+' 文字不超出按鈕、不被擠成直排',geo.every(g=>g.lw<=g.w+1&&g.lh<=g.h+1&&g.lh<40),JSON.stringify(geo.map(g=>Math.round(g.lh))));
  ok(n+' 無錯誤',errs.length===0,errs.join());
  await ctx.close();
}
await b.close();})();
