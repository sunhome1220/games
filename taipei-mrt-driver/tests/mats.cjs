// 材質貼圖（Poly Haven CC0）：貼圖載入、PBR 與環境反射、省電模式退回便宜材質、貼圖載入失敗不影響遊戲、亮度不被改變、授權檔案齊全
const { chromium } = require('playwright');
const fs=require('fs'),path=require('path');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
const ROOT=path.join(__dirname,'..');
(async()=>{
  // 檔案與授權
  const names=['concrete_wall_003','rocky_gravel','asphalt_02','grey_plaster_02','large_grey_tiles','leafy_grass'];
  const sizes=names.map(n=>fs.existsSync(path.join(ROOT,'assets/tex',n+'.jpg'))?fs.statSync(path.join(ROOT,'assets/tex',n+'.jpg')).size:-1);
  ok('6 張貼圖都在倉庫裡，且合計 <600 KB',sizes.every(x=>x>10000)&&sizes.reduce((a,b)=>a+b,0)<600*1024,Math.round(sizes.reduce((a,b)=>a+b,0)/1024)+' KB');
  const cr=fs.readFileSync(path.join(ROOT,'assets/tex/CREDITS.md'),'utf8');
  ok('CREDITS.md 列出每張貼圖的名稱、作者、來源與 CC0 授權',names.every(n=>cr.includes(n+'.jpg')&&cr.includes('polyhaven.com/a/'+n))&&cr.includes('CC0'));
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const mk=async(blockTex)=>{
    const ctx=await b.newContext({viewport:{width:844,height:390}});await ctx.addInitScript(()=>localStorage.setItem('mrt-tut','1'));
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    p.on('console',m=>{const t=m.text();if(/GPU stall|ReadPixels|Performance|Failed to load resource/i.test(t))return;if(m.type()==='error'||(m.type()==='warning'&&/shader|GL|program/i.test(t)))errs.push(t.slice(0,200));});
    if(blockTex)await p.route('**/assets/tex/**',r=>r.abort());
    await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1500);return {ctx,p,errs};
  };
  const run=(p,q,line,from,to,f)=>p.evaluate(([q,line,from,to,f])=>{Object.assign(SET,{line,from,to,events:false,bcOn:false,theme:'day',quality:q});QS=1;resize();startRun();const g=G;g.state='run';rmHide();g.pos=g.S[0]+(g.S[1]-g.S[0])*f;g.v=0;},[q,line,from,to,f]);
  // 1. 一般：貼圖載入、PBR、環境反射
  let t=await mk(false);
  await run(t.p,'auto','blue',0,8,0.5);await t.p.waitForTimeout(2500);
  const info=await t.p.evaluate(()=>R3.pbrInfo());
  ok('預設（自動）：PBR 開、環境反射有、場景用到的貼圖都載入完成',info.pbr&&info.env&&Object.values(info.tex).length>=3&&Object.values(info.tex).every(Boolean),JSON.stringify(info.tex));
  const mats=await t.p.evaluate(()=>R3.matInfo());
  ok('場景裡有 MeshStandardMaterial（PBR），且全部材質都已補丁',mats.standard>0&&mats.unpatched===0,JSON.stringify(mats));
  const lumA=await t.p.evaluate(()=>R3.probe(G,250,60,350,150));
  // 2. 省電：退回 Lambert（無 PBR、無環境反射）
  await run(t.p,'low','blue',0,8,0.5);await t.p.waitForTimeout(2500);
  const infoL=await t.p.evaluate(()=>R3.pbrInfo()),matsL=await t.p.evaluate(()=>R3.matInfo());
  ok('省電：沒有 PBR 材質、沒有環境反射，仍有貼圖（Lambert＋貼圖）',!infoL.pbr&&!infoL.env&&matsL.standard===0&&matsL.triLambert>0,JSON.stringify(matsL));
  const lumL=await t.p.evaluate(()=>R3.probe(G,250,60,350,150));
  ok('PBR 與省電的場景亮度相近（±35%），貼圖沒有改變整體亮度',lumA>lumL*0.65&&lumA<lumL*1.35,`PBR ${lumA.toFixed(1)}／省電 ${lumL.toFixed(1)}`);
  ok('無 JS 錯誤或著色器警告',t.errs.length===0,t.errs.slice(0,2).join(' | '));
  await t.ctx.close();
  // 3. 貼圖載入失敗（網路被擋）：遊戲照常、不報錯
  t=await mk(true);
  await run(t.p,'auto','red',27,20,0.45);await t.p.waitForTimeout(2200);
  const infoF=await t.p.evaluate(()=>R3.pbrInfo());
  const callsF=await t.p.evaluate(()=>R3.info().calls);
  ok('貼圖載入失敗：標示為未載入、場景照常繪製、無錯誤',Object.values(infoF.tex).every(v=>v===false)&&callsF>50&&t.errs.length===0,`calls ${callsF} 錯誤 ${t.errs.slice(0,2).join(' | ')}`);
  await t.ctx.close();
  await b.close();
})();
