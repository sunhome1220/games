// 後製（光暈、色彩分級、暈影）：畫質設定對應的等級、自動降級、開啟後畫面確實不同、光暈只出現在發光物體附近、無著色器錯誤
const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:844,height:390}});await ctx.addInitScript(()=>localStorage.setItem('mrt-tut','1'));
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{const t=m.text();if(/GPU stall|ReadPixels|Performance/i.test(t))return;if(m.type()==='error'||(m.type()==='warning'&&/shader|GL|program/i.test(t)))errs.push(t.slice(0,200));});
await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1500);
await p.evaluate(()=>{Object.assign(SET,{line:'blue',from:0,to:8,events:false,bcOn:false,theme:'day',quality:'auto'});startRun();G.state='run';rmHide();G.v=0;});
await p.waitForTimeout(600);
const info=await p.evaluate(()=>R3.postInfo());
ok('預設（自動、解析度正常）：後製全開',info.mode==='full'&&info.w>0,JSON.stringify(info));
// 畫質設定 → 等級
const map=await p.evaluate(()=>{const r={};for(const [q,qs] of [['low',1],['high',1],['high',0.5],['auto',1],['auto',0.8],['auto',0.5]]){SET.quality=q;QS=qs;resize();r[q+'@'+qs]=R3.postMode();}SET.quality='auto';QS=1;resize();return r;});
ok('畫質對應：省電＝關、高畫質＝全開（即使解析度降低）、自動＝依解析度全開／只分級／關',map['low@1']==='off'&&map['high@1']==='full'&&map['high@0.5']==='full'&&map['auto@1']==='full'&&map['auto@0.8']==='grade'&&map['auto@0.5']==='off',JSON.stringify(map));
// 自動降級時後製隨之降級
const deg=await p.evaluate(()=>{SET.quality='auto';QS=1;pf={n:0,t:0,warm:90};resize();const a=R3.postMode();for(let i=0;i<400;i++)perfAdapt(0.05,true);const b2=R3.postMode();const q=QS;QS=1;resize();return {a,b:b2,q};});
ok('自動畫質因太卡降低解析度後，後製跟著降級（不再全開）',deg.a==='full'&&deg.b!=='full'&&deg.q<1,JSON.stringify(deg));
// 隧道內：找一盞燈附近的位置，比較 full 與 grade 的亮度（光暈只會讓亮部周圍變亮）
const pos=await p.evaluate(()=>{const g=G;for(let s=300;s<g.S[g.S.length-1]-300;s+=18){if(g.sec.find(c=>s>=c.a&&s<c.b).env==='tunnel'&&g.S.every(q=>Math.abs(q-s)>400))return Math.ceil(s/18)*18;}return null;});
ok('找得到隧道內的燈',pos!==null);
await p.evaluate(s=>{G.pos=s+10;},pos);await p.waitForTimeout(500);
const lum=async(mode,rect)=>{await p.evaluate(m=>R3.setPost(m),mode);await p.waitForTimeout(350);return p.evaluate(r=>R3.probe(G,...r),rect);};
const rect=[250,50,350,160];
const off=await lum('off',rect),grade=await lum('grade',rect),full=await lum('full',rect);
ok('開啟後製畫面確實不同（與關閉的亮度不同）',Math.abs(grade-off)>0.3||Math.abs(full-off)>0.3,`off ${off.toFixed(2)} grade ${grade.toFixed(2)} full ${full.toFixed(2)}`);
ok('光暈（full）比只分級（grade）更亮：燈的光暈疊加到周圍',full>grade+0.05,`grade ${grade.toFixed(2)} → full ${full.toFixed(2)}`);
// 白天地面：沒有發光物體，光暈幾乎不增加亮度（不應整片泛白）
await p.evaluate(()=>{Object.assign(SET,{line:'red',from:27,to:20});startRun();G.state='run';rmHide();G.v=0;G.pos=G.S[0]+400;});await p.waitForTimeout(600);
const d0=await lum('off',[200,150,440,100]),dg=await lum('grade',[200,150,440,100]),df=await lum('full',[200,150,440,100]);
ok('白天：後製（分級）的亮度與關閉時相近（±15%），自動降級時不會忽亮忽暗',dg>d0*0.85&&dg<d0*1.15,`off ${d0.toFixed(1)} grade ${dg.toFixed(1)}`);
ok('白天沒有發光物體：光暈不會讓畫面泛白（亮度增加 <3%）',df<dg*1.03,`grade ${dg.toFixed(2)} → full ${df.toFixed(2)}`);
ok('場景亮度仍在合理範圍（沒有整片黑或白）',df>15&&df<235,df.toFixed(1));
await p.evaluate(()=>R3.setPost('full'));
ok('無 JS 錯誤或著色器／GL 警告',errs.length===0,errs.slice(0,3).join(' | '));
await b.close();})();
