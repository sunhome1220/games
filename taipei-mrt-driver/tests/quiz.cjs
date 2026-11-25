// 外籍旅客求助（英語四選一）的介面與流程：接聽 → 朗讀英文 → 作答 → 回饋；聽力模式；沒有英語語音時；三種版面不擋操作
const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const [n,vp] of [['手機橫握',{width:844,height:390}],['iPad',{width:1024,height:768}],]){
  const ctx=await b.newContext({viewport:vp,isMobile:true,hasTouch:true});
  await ctx.addInitScript(()=>{localStorage.setItem('mrt-tut','1');window.__spoken=[];
    const voices=[{lang:'zh-TW',name:'Z'},{lang:'en-US',name:'E'}];window.SpeechSynthesisUtterance=function(t){this.text=t;};
    Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>voices,addEventListener(){},cancel(){},speak(u){window.__spoken.push({text:u.text,lang:u.lang,rate:u.rate});}},configurable:true});});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1000);
  const start=(o)=>p.evaluate(o=>{Object.assign(SET,{line:'blue',from:2,to:10,events:true,bcOn:false,radio:false,snd:true,fqLevel:'g5',fqListen:false},o||{});startRun();const g=G;g.state='run';g.pos=g.S[1]+300;g.k=2;g.v=18;g.time=5;g.ev=null;window.__spoken.length=0;evStart(g,'foreign');},o);
  const vis=()=>p.evaluate(()=>!document.getElementById('fq').hidden);
  const until=(fn,ms)=>p.waitForFunction(fn,null,{timeout:ms||6000}).catch(()=>{});   // DOM 在下一個畫面更新時才變，慢機器上要等
  const answerCall=async()=>{await p.waitForFunction(()=>getComputedStyle(document.getElementById('b-act')).display!=='none',null,{timeout:6000}).catch(()=>{});const r=await p.evaluate(()=>{const b=document.getElementById('b-act').getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];});await p.touchscreen.tap(...r);await p.waitForFunction(()=>!document.getElementById('fq').hidden,null,{timeout:6000}).catch(()=>{});};
  const tap=async sel=>{const r=await p.evaluate(sel=>{const b=document.querySelector(sel).getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];},sel);await p.touchscreen.tap(...r);await p.waitForTimeout(300);};
  // 1. 接聽前：只有按鈕，沒有題目面板
  await start();await p.waitForTimeout(400);
  ok(n+' 接聽前：事件開始、有「接聽」按鈕、題目面板還沒出現',await p.evaluate(()=>G.ev.id==='foreign'&&G.evAct.label.includes('接聽'))&&!await vis());
  await answerCall();
  const st=await p.evaluate(()=>({phase:G.fq.phase,q:G.fq.q,txt:document.getElementById('fq-q').textContent,opts:[...document.getElementById('fq-o').children].map(b=>b.textContent),spoken:window.__spoken.slice(),lvl:G.fq.q.level}));
  ok(n+' 接聽後：面板出現、顯示英文題目、4 個選項（A～D）、預設國小五年級',st.phase==='ask'&&st.txt.includes(st.q.en)&&st.opts.length===4&&st.opts.every((o,i)=>o.startsWith(String.fromCharCode(65+i)+'. '))&&st.lvl==='g5',st.q.en);
  ok(n+' 接聽後朗讀英文題目（英語語音）',st.spoken.length===1&&st.spoken[0].text===st.q.en&&st.spoken[0].lang==='en-US',JSON.stringify(st.spoken[0]));
  const box=await p.evaluate(()=>{const b=document.getElementById('fq').getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height,W:innerWidth,H:innerHeight,top:dashTop,ev:document.getElementById('b-act').getBoundingClientRect().bottom};});
  ok(n+' 面板在可視範圍內、不蓋住儀表',box.x>=0&&box.x+box.w<=box.W+1&&box.y>=0&&box.y+box.h<=box.top+4,JSON.stringify(box));
  // 2. 答對
  const ans=await p.evaluate(()=>G.fq.q.ans);
  await tap(`#fq-o button[data-i="${ans}"]`);await until(()=>document.querySelector('#fq-o button.ok')!==null);
  const r1=await p.evaluate(()=>({phase:G.fq.phase,ev:G.ev.outcome,pts:G.ev.pts,cls:[...document.getElementById('fq-o').children].map(b=>b.className),dis:[...document.getElementById('fq-o').children].every(b=>b.disabled),r:document.getElementById('fq-r').textContent}));
  ok(n+' 答對：標示綠色、選項鎖定、顯示說明、+8 或 +10',r1.phase==='result'&&r1.ev==='ok'&&(r1.pts===8||r1.pts===10)&&r1.cls[ans]==='ok'&&r1.dis&&r1.r.startsWith('✔'),JSON.stringify(r1));
  const box2=await p.evaluate(()=>{const b=document.getElementById('fq').getBoundingClientRect();return {y:b.top,h:b.height,top:dashTop};});
  ok(n+' 作答後（多了說明與翻譯）面板仍不蓋住儀表',box2.y+box2.h<=box2.top+4,JSON.stringify(box2));
  await p.evaluate(()=>{G.time+=6;evTick(G,1/60);});await until(()=>document.getElementById('fq').hidden);
  ok(n+' 5 秒後事件結束、面板消失、分數記入事件處置',await p.evaluate(()=>G.ev===null&&G.evLog.length===1&&G.evLog[0].outcome==='ok'&&G.evLog[0].pts>0)&&!await vis());
  // 3. 答錯
  await start();await answerCall();
  const a2=await p.evaluate(()=>G.fq.q.ans),wrong=(a2+1)%4;
  await tap(`#fq-o button[data-i="${wrong}"]`);await until(()=>document.querySelector('#fq-o button.bad')!==null);
  const r2=await p.evaluate(()=>({ev:G.ev.outcome,pts:G.ev.pts,cls:[...document.getElementById('fq-o').children].map(b=>b.className)}));
  ok(n+' 答錯：標示紅色、同時標出正確答案（綠）、−3',r2.ev==='fail'&&r2.pts===-3&&r2.cls[wrong]==='bad'&&r2.cls[a2]==='ok',JSON.stringify(r2));
  // 4. 逾時
  await start();await answerCall();
  await p.evaluate(()=>{G.time+=41;evTick(G,1/60);});await until(()=>document.querySelector('#fq-o button.ok')!==null);
  ok(n+' 作答逾時：標出正確答案、不計分',await p.evaluate(()=>G.fq.phase==='result'&&G.fq.pick===-2&&G.ev.outcome==='late'&&G.ev.pts===0&&document.querySelector('#fq-o button.ok')!==null));
  // 5. 聽力模式
  await start({fqListen:true});await answerCall();
  await until(()=>document.getElementById('fq-q').textContent.includes('🎧'));
  const L1=await p.evaluate(()=>({q:G.fq.q.en,txt:document.getElementById('fq-q').textContent,eye:getComputedStyle(document.getElementById('fq-eye')).display}));
  ok(n+' 聽力模式：先不顯示英文題目、有「顯示文字」鈕',!L1.txt.includes(L1.q)&&L1.eye!=='none',L1.txt);
  await tap('#fq-eye');await until(()=>!document.getElementById('fq-q').textContent.includes('🎧'));
  ok(n+' 按「顯示文字」後顯示題目',await p.evaluate(()=>document.getElementById('fq-q').textContent.includes(G.fq.q.en)));
  await tap('#fq-ear');
  ok(n+' 「再聽一次」會再朗讀',await p.evaluate(()=>window.__spoken.length>=2));
  // 6. 沒有英語語音：聽力模式也要顯示文字（否則沒辦法作答）
  await p.evaluate(()=>{window.bcVoice=()=>null;});
  await start({fqListen:true});await answerCall();
  await until(()=>document.getElementById('fq-r').textContent.includes('沒有英語語音'));
  ok(n+' 沒有英語語音：聽力模式仍顯示文字、不朗讀、提示沒有語音',await p.evaluate(()=>document.getElementById('fq-q').textContent.includes(G.fq.q.en)&&window.__spoken.length===0&&document.getElementById('fq-r').textContent.includes('沒有英語語音')));
  ok(n+' 無錯誤',errs.length===0,errs.join());
  await ctx.close();
}
await b.close();})();
