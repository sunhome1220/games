const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errs=[];
  // ---------- A. 廣播（Android 類環境：有 vibrate；語音有 zh-TW / en-US / ja-JP / ko-KR，沒有台語客語）----------
  let ctx=await b.newContext({viewport:{width:1000,height:700}});let p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{
    window.__spoken=[];window.__cancel=0;window.__vib=[];
    const voices=[{lang:'zh-TW',name:'zh'},{lang:'en-US',name:'en'},{lang:'ja-JP',name:'ja'},{lang:'ko-KR',name:'ko'}];
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>voices,speak:u=>window.__spoken.push({text:u.text,lang:u.lang}),cancel:()=>window.__cancel++,addEventListener(){}}});
    window.SpeechSynthesisUtterance=function(t){this.text=t;};
    navigator.vibrate=(p)=>{window.__vib.push(p);return true;};
  });
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1000);
  await p.evaluate(()=>{__mrt.SET.events=false;});
  const ann=(name,kind)=>p.evaluate(([name,kind])=>{
    const m=__mrt;Object.assign(m.SET,{line:'red',from:27,to:0,events:false,bcOn:true,bcLangs:['zh','nan','hak','en','ja','ko'],bcJk:'part'});m.startRun();
    window.__spoken.length=0;const g=m.G;const st=g.stations.find(s=>s.name===name);announce(kind,st);
    return {cap:BCAP.lines.map(l=>l.id+':'+(l.voice?'v':'-')),spoken:window.__spoken.map(s=>s.lang),texts:window.__spoken.map(s=>s.text)};},[name,kind]);
  let r=await ann('竹圍','next');
  ok('非熱門站（竹圍）：日語、韓語不播；語言順序為國語、英語、（日韓）、台語、客語；台語客語只有字幕',JSON.stringify(r.cap)===JSON.stringify(['zh:v','en:v','nan:-','hak:-']),JSON.stringify(r));
  ok('英語站名用國語語音唸對音：「The next station is」(en-US) ＋「竹圍」(zh-TW)；台語客語不朗讀',JSON.stringify(r.spoken)===JSON.stringify(['zh-TW','en-US','zh-TW'])&&r.texts[1]==='The next station is'&&r.texts[2]==='竹圍',JSON.stringify(r.texts));
  r=await ann('台北車站','next');
  ok('報導點名的熱門站（台北車站）：日語、韓語也播（順序 國→英→日→韓→台→客）',r.cap.join()==='zh:v,en:v,ja:v,ko:v,nan:-,hak:-'&&r.spoken.join()==='zh-TW,en-US,en-US,ja-JP,ko-KR',JSON.stringify(r));
  ok('英語句型：The next station is Taipei Main Station（慣用英文名全用英文語音）',r.texts[1]==='The next station is'&&r.texts[2]==='Taipei Main Station',r.texts.join(' | '));
  for(const [name,exp] of [['江子翠',['The next station is','江子翠']],['龍山寺',['The next station is','龍山','Temple']],['中正紀念堂',['The next station is','Chiang Kai-Shek Memorial Hall']],['民權西路',['The next station is','民權','West Road']],['國父紀念館',['The next station is','Sun Yat-sen Memorial Hall']],['南港展覽館',['The next station is','Taipei','南港','Exhibition Center']]]){
    const rr=await p.evaluate(([name])=>{const m=__mrt;const L=m.LINES;const key=Object.keys(L).find(k=>L[k].st.includes(name));const i=L[key].st.indexOf(name);
      Object.assign(m.SET,{line:key,from:Math.max(0,i-1),to:Math.min(L[key].st.length-1,i+1),events:false,bcOn:true,bcLangs:['en'],bcJk:'part'});m.startRun();
      window.__spoken.length=0;const st=m.G.stations.find(s=>s.name===name);announce('next',st);
      return {texts:window.__spoken.map(s=>s.text),langs:window.__spoken.map(s=>s.lang),cap:BCAP.lines[0].text};},[name]);
    ok(`「${name}」：${exp.slice(1).join('＋')} 依語言拆開朗讀`,JSON.stringify(rr.texts)===JSON.stringify(exp),JSON.stringify(rr.texts)+' 字幕：'+rr.cap);
  }
  // 沒有國語語音時：退回整句英文（不會缺字）
  const nz=await p.evaluate(()=>{const keep=BCV;BCV=BCV.filter(v=>v.lang!=='zh-TW');const m=__mrt;Object.assign(m.SET,{line:'blue',from:7,to:10,events:false,bcOn:true,bcLangs:['en']});m.startRun();window.__spoken.length=0;announce('next',m.G.stations.find(s=>s.name==='江子翠'));const o=window.__spoken.map(s=>s.text);BCV=keep;return o;});
  ok('沒有國語語音時退回整句英文：The next station is Jiangzicui.',JSON.stringify(nz)===JSON.stringify(['The next station is Jiangzicui.']),JSON.stringify(nz));
  r=await ann('大安','next');
  ok('轉乘站（大安：紅線×文湖線，不在點名名單內）也播日語韓語',r.cap.includes('ja:v')&&r.cap.includes('ko:v'),JSON.stringify(r.cap));
  const tr=await p.evaluate(()=>({daan:bcIsTransfer('大安'),zhuwei:bcIsTransfer('竹圍'),zxfx:bcIsTransfer('忠孝復興'),named:BC_NAMED_JK.has('大安')}));
  ok('轉乘判斷：大安、忠孝復興為轉乘站，竹圍不是',tr.daan&&tr.zxfx&&!tr.zhuwei&&!tr.named,JSON.stringify(tr));
  r=await p.evaluate(()=>{const m=__mrt;m.SET.bcJk='all';m.startRun();window.__spoken.length=0;const st=m.G.stations.find(s=>s.name==='竹圍');announce('next',st);const o=BCAP.lines.map(l=>l.id).join();m.SET.bcJk='part';return o;});
  ok('日韓語範圍設為「全線」：竹圍也播日語韓語',r==='zh,en,ja,ko,nan,hak',r);
  r=await ann('台北車站','arrive');
  const side=await p.evaluate(()=>__mrt.G.stations.find(s=>s.name==='台北車站').side);
  ok('到站廣播含門側（國語、英語、日語、韓語）',new RegExp(side==='L'?'左側':'右側').test(r.texts[0])&&r.texts.some(t=>t==='This is')&&r.texts.some(t=>new RegExp('The doors will open on the '+(side==='L'?'left':'right')+' side\\.').test(t))&&r.texts.some(t=>/ドア/.test(t))&&r.texts.some(t=>/문/.test(t)),r.texts.join(' | '));
  // 沒有日語語音的裝置：只顯示字幕，不用別的語言唸
  await p.evaluate(()=>{BCV=BCV.filter(v=>v.lang!=='ja-JP');});
  r=await ann('台北車站','next');
  ok('裝置沒有日語語音時：日語只顯示字幕、不朗讀',r.cap.includes('ja:-')&&!r.spoken.includes('ja-JP'),JSON.stringify(r));
  // 語言選擇
  r=await p.evaluate(()=>{const m=__mrt;Object.assign(m.SET,{bcLangs:['en']});m.startRun();window.__spoken.length=0;announce('next',m.G.stations[1]);return {cap:BCAP.lines.map(l=>l.id),sp:window.__spoken.length};});
  ok('只選 English：只出現英語一行；朗讀「The next station is」＋站名（國語語音）共 2 段',r.cap.join()==='en'&&r.sp===2,JSON.stringify(r));
  r=await p.evaluate(()=>{const m=__mrt;Object.assign(m.SET,{bcOn:false,bcLangs:['zh']});m.startRun();window.__spoken.length=0;BCAP=null;announce('next',m.G.stations[1]);Object.assign(m.SET,{bcOn:true});return {cap:BCAP,sp:window.__spoken.length};});
  ok('關閉廣播：不朗讀也沒有字幕',r.cap===null&&r.sp===0);
  // 發車時自動播「下一站」
  r=await p.evaluate(()=>{const m=__mrt;Object.assign(m.SET,{bcOn:true,bcLangs:['zh','en'],events:false});m.startRun();window.__spoken.length=0;const g=m.G;g.doors.state='closed';m.setNotch(3);for(let i=0;i<60*12;i++)m.step(1/60);return window.__spoken.map(s=>s.text);});
  ok('起步離開月台後自動播「下一站」（國語＋英語）',r.some(t=>/下一站/.test(t))&&r.some(t=>t==='The next station is'),JSON.stringify(r));
  // 字幕畫面
  await p.evaluate(()=>{const m=__mrt;Object.assign(m.SET,{bcOn:true,bcLangs:['zh','nan','en','ja','ko'],bcJk:'all'});m.startRun();const g=m.G;g.k=1;g.pos=g.S[0]+500;g.v=16;announce('next',g.stations[1]);});
  await p.waitForTimeout(700);await p.screenshot({path:(process.env.SHOT_DIR||require('os').tmpdir())+'/caption.png'});
  // ---------- B. 震動（Android 路徑）----------
  r=await p.evaluate(()=>{
    const m=__mrt;Object.assign(m.SET,{haptic:true,events:false,bcOn:false});m.startRun();const g=m.G;window.__vib.length=0;
    const out={};
    for(const n of [1,2,3,4,0,-1,-3,-5,-7,-8]){m.setNotch(n===1?2:1);window.__vib.length=0;m.setNotch(n);out[n]=window.__vib[window.__vib.length-1];}
    return out;});
  console.log('  震動圖案(ms)：',JSON.stringify(r));
  ok('P 檔：單一輕點且越高檔越久',r[1][0]<r[2][0]&&r[2][0]<r[3][0]&&r[3][0]<r[4][0]&&r[1].length===1);
  ok('N 位：與其他檔位不同的「兩下卡位」感（3 段）',r[0].length===3);
  ok('B 檔：越重的煞車震動越長',r[-1][0]<r[-3][0]&&r[-3][0]<r[-5][0]&&r[-5][0]<r[-7][0]);
  ok('EB：重而長的多段圖案，與 B7 明顯不同',r[-8].length===5&&r[-8].reduce((a,b)=>a+b,0)>300&&r[-8].reduce((a,b)=>a+b,0)>r[-7].reduce((a,b)=>a+b,0)*8);
  r=await p.evaluate(()=>{
    const m=__mrt;Object.assign(m.SET,{haptic:true});m.startRun();const g=m.G;const out={};
    window.__vib.length=0;g.v=0;g.pos=g.S[0];g.cur=0;g.k=1;m.openDoors(g.stations[0].side);out.open=window.__vib.slice();
    window.__vib.length=0;g.doors.state='open';g.doors.openT=9;m.closeDoors();out.close=window.__vib.slice();
    window.__vib.length=0;g.trip=false;g.v=20;g.pos=g.S[0]+300;m.setNotch(0);g.trip=true;m.step(1/60);m.step(1/60);m.step(1/60);out.atp=window.__vib.slice();
    window.__vib.length=0;g.trip=false;g._tripH=false;g.evOn=true;g.ev=null;m.evStart(g,'quake');out.quake=window.__vib.slice(-1)[0];
    return out;});
  ok('車門開／關各有不同圖案',r.open[0].length===1&&r.close[0].length===3,JSON.stringify([r.open,r.close]));
  ok('ATP 動作震動一次（不會每幀重複）',r.atp.length===1&&r.atp[0].length===7,JSON.stringify(r.atp));
  ok('地震事件有專屬的搖晃圖案',r.quake&&r.quake.length>=11,JSON.stringify(r.quake));
  r=await p.evaluate(()=>{const m=__mrt;m.SET.haptic=false;window.__vib.length=0;m.startRun();m.setNotch(-8);m.setNotch(2);return window.__vib.length;});
  ok('關閉震動：完全不震',r===0);
  r=await p.evaluate(()=>{const m=__mrt;m.SET.haptic=true;m.startRun();const g=m.G;g.v=15;window.__vib.length=0;m.setNotch(-8);const first=window.__vib.length;_hapLast=0;hapRumble(g);return {first,after:window.__vib.length};});
  ok('緊急煞車持續時有低頻震動（每 0.5 秒）',r.after===r.first+1,JSON.stringify(r));
  await ctx.close();
  // ---------- C. iPhone 路徑：沒有 navigator.vibrate，改用 switch 近似 ----------
  ctx=await b.newContext({viewport:{width:844,height:390},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',hasTouch:true,isMobile:true});
  p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{try{delete Navigator.prototype.vibrate;}catch(e){}try{Object.defineProperty(navigator,'vibrate',{value:undefined,configurable:true});}catch(e){}
    window.__clicks=0;const orig=HTMLLabelElement.prototype.click;HTMLLabelElement.prototype.click=function(){window.__clicks++;return orig.call(this);};});
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1000);
  r=await p.evaluate(()=>{const m=__mrt;Object.assign(m.SET,{haptic:true,events:false,bcOn:false});m.startRun();return {sup:hapSupport(),info:document.getElementById('m-hapinfo').textContent};});
  ok('iPhone：判斷為 iOS 近似震動',r.sup==='ios',JSON.stringify(r));
  const clicks=async(fn)=>{await p.evaluate(()=>{window.__clicks=0;});await p.evaluate(fn);await p.waitForTimeout(900);return p.evaluate(()=>window.__clicks);};
  const c1=await clicks(()=>{__mrt.setNotch(0);__mrt.setNotch(2);});
  const cN=await clicks(()=>{__mrt.setNotch(0);});
  const cEB=await clicks(()=>{__mrt.setNotch(-8);});
  ok('iPhone：P2 約 1 下、N 位 2 下、EB 明顯更多下（觸感不同）',c1>=1&&cN===2&&cEB>=8&&cEB>cN*3,`P2 後累計 ${c1}、N ${cN}、EB ${cEB}`);
  console.log('errors',errs);await b.close();
})();
