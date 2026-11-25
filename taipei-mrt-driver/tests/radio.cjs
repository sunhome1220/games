// 行控無線電通話：事件開始時顯示字幕、朗讀（有國語語音時）、播放提示音與雜訊；可關閉；雜訊強度可選；7 種事件都有
const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({viewport:{width:844,height:390}});
await ctx.addInitScript(()=>{localStorage.setItem('mrt-tut','1');
  window.__spoken=[];
  const voices=[{lang:'zh-TW',name:'TestZh',default:true},{lang:'en-US',name:'TestEn'}];
  window.SpeechSynthesisUtterance=function(t){this.text=t;};
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>voices,addEventListener(){},cancel(){},speak(u){window.__spoken.push({text:u.text,rate:u.rate,pitch:u.pitch});setTimeout(()=>u.onend&&u.onend(),50);}},configurable:true});});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1200);
const start=(o)=>p.evaluate(o=>{Object.assign(SET,{line:'blue',from:2,to:10,events:true,bcOn:false,snd:true,radio:true,radioNoise:'light'},o);startRun();audioInit();const g=G;g.state='run';g.pos=g.S[1]+200;g.k=2;g.v=20;g.time=1;g.ev=null;},o||{});
await start();await p.waitForTimeout(300);
const ids=['quake','wind','trespass','doorfault','signal','power','trainfault'];
for(const id of ids){
  await p.evaluate(()=>{window.__spoken.length=0;OC.cap=null;G.ev=null;});
  await p.evaluate(id=>{evStart(G,id);},id);await p.waitForTimeout(200);
  const statDuring=await p.evaluate(()=>!!OC.stat);await p.waitForTimeout(500);
  const r=await p.evaluate(()=>({cap:OC.cap&&OC.cap.text,spoken:window.__spoken.slice(),stat:true}));r.stat=statDuring;
  const want=await p.evaluate(id=>ocText(G,id,G.ev),id);
  ok(id+'：字幕與朗讀內容一致、國語語音、有雜訊',r.cap===want&&r.spoken.length===1&&r.spoken[0].text===want&&r.stat,r.cap&&r.cap.slice(0,30));
  await p.waitForTimeout(300);
  await p.evaluate(()=>{G.ev=null;evClear(G);});
}
// 雜訊關閉
await p.evaluate(()=>{SET.radioNoise='off';G.ev=null;});await p.evaluate(()=>evStart(G,'signal'));await p.waitForTimeout(400);
ok('雜訊「無」：不產生雜訊但仍有字幕與語音',await p.evaluate(()=>!OC.stat&&!!OC.cap&&window.__spoken.length>0));
// 通話結束後雜訊停止
await p.evaluate(()=>{SET.radioNoise='mid';G.ev=null;evClear(G);window.__spoken.length=0;});await p.evaluate(()=>evStart(G,'power'));await p.waitForTimeout(150);
const during=await p.evaluate(()=>!!OC.stat);await p.waitForTimeout(900);
ok('雜訊在通話期間存在、語音結束後停止',during&&await p.evaluate(()=>OC.stat===null));
// 關閉無線電
await p.evaluate(()=>{SET.radio=false;OC.cap=null;G.ev=null;evClear(G);window.__spoken.length=0;});await p.evaluate(()=>evStart(G,'wind'));await p.waitForTimeout(500);
ok('關閉無線電通話：沒有字幕、語音與雜訊',await p.evaluate(()=>!OC.cap&&!OC.stat&&window.__spoken.length===0));
// 音效關閉：只有字幕
await p.evaluate(()=>{SET.radio=true;SET.snd=false;G.ev=null;evClear(G);window.__spoken.length=0;OC.cap=null;});await p.evaluate(()=>evStart(G,'wind'));await p.waitForTimeout(500);
ok('音效關閉：只顯示字幕，不朗讀、不放雜訊',await p.evaluate(()=>!!OC.cap&&!OC.stat&&window.__spoken.length===0));
// 沒有國語語音：只有字幕（不用別的語言假裝）
await p.evaluate(()=>{SET.snd=true;G.ev=null;evClear(G);window.__spoken.length=0;OC.cap=null;window.bcVoice=()=>null;});await p.evaluate(()=>evStart(G,'wind'));await p.waitForTimeout(500);
ok('沒有國語語音：只顯示字幕與雜訊，不朗讀',await p.evaluate(()=>!!OC.cap&&window.__spoken.length===0));
// 設定存在選單
ok('選單有行控無線電與雜訊強度設定',await p.evaluate(()=>!!document.getElementById('m-radio')&&document.getElementById('m-radionoise').options.length===3));
ok('無錯誤',errs.length===0,errs.join());
await b.close();})();
