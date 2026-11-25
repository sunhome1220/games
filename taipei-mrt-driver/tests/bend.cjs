// 3D 軌道轉彎（彎曲世界）：彎道前方的偏移量大、直線段小；材質都已補丁且沒有 GL／著色器錯誤；開關有效；畫面確實不同
const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:844,height:390}});await ctx.addInitScript(()=>localStorage.setItem('mrt-tut','1'));
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{const t=m.text();if(/GPU stall|ReadPixels|Performance/i.test(t))return;   // 量亮度時讀回像素的效能提示不算錯誤
  if(m.type()==='error'||(m.type()==='warning'&&/shader|GL|program/i.test(t)))errs.push(t.slice(0,200));});
await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(1500);
for(const [n,o] of [['藍線地下',{line:'blue',from:0,to:8}],['紅線高架',{line:'red',from:27,to:20}],['文湖線',{line:'brown',from:0,to:8}],['綠線',{line:'green',from:0,to:8}]]){
  await p.evaluate(([o])=>{Object.assign(SET,o,{events:false,bcOn:false,theme:'day'});startRun();G.state='run';rmHide();R3.setBend(null);},[o]);
  await p.waitForTimeout(400);
  // 找一處彎道前、一處前方 480 m 內都是直線的位置
  const pos=await p.evaluate(()=>{const g=G,end=g.S[g.S.length-1];let curve=null,straight=null;
    for(let s=0;s<end-500&&(!curve||!straight);s+=20){let mx=0;for(let d=0;d<=480;d+=40)mx=Math.max(mx,Math.abs(pathLateral(g,s,d)));
      if(!curve&&mx>40)curve=s;if(!straight&&mx<1.5)straight=s;}
    return {curve,straight};});
  ok(n+' 找得到彎道前與直線段',pos.curve!==null);
  await p.evaluate(s=>{G.pos=s;G.v=0;},pos.curve);await p.waitForTimeout(900);
  const bi=await p.evaluate(()=>R3.bendInfo());
  ok(n+' 彎道前方偏移量大（>40 m）且彎曲已開啟',bi.on===1&&bi.max>40,JSON.stringify(bi));
  ok(n+' 場景裡所有網格的材質都已補丁（地面大平面除外）',bi.unpatched.length===0,JSON.stringify(bi.unpatched));
  const on=await p.screenshot({clip:{x:0,y:60,width:844,height:190}});
  await p.evaluate(()=>R3.setBend(false));await p.waitForTimeout(900);
  const off=await p.screenshot({clip:{x:0,y:60,width:844,height:190}});
  const bo=await p.evaluate(()=>R3.bendInfo());
  ok(n+' 關閉後 uOn=0、畫面不同',bo.on===0&&Buffer.compare(on,off)!==0,Math.abs(on.length-off.length)+' bytes 差');
  await p.evaluate(()=>R3.setBend(null));
  if(pos.straight!==null){await p.evaluate(s=>{G.pos=s;},pos.straight);await p.waitForTimeout(800);
    const bs=await p.evaluate(()=>R3.bendInfo());ok(n+' 直線段前方偏移量小（<5 m）',bs.max<5,bs.max.toFixed(2));}
}
// ---- 隧道燈光：燈下亮、燈間暗（每 18 m 一盞）；關閉調變後亮度均勻；車站內不調變 ----
await p.evaluate(()=>{Object.assign(SET,{line:'blue',from:0,to:8,events:false,bcOn:false,theme:'day'});startRun();G.state='run';rmHide();G.v=0;R3.setBend(null);R3.setLamps(null);});
await p.waitForTimeout(500);
const tunPos=await p.evaluate(()=>{const g=G;for(let s=300;s<g.S[g.S.length-1]-300;s+=18){if(g.sec.find(c=>s>=c.a&&s<c.b).env==='tunnel'&&g.S.every(q=>Math.abs(q-s)>400))return s;}return null;});
ok('找得到遠離車站的隧道直線段',tunPos!==null);
const lum=async(on)=>{await p.evaluate(v=>R3.setLamps(v),on);const base=Math.ceil(tunPos/18)*18,r=[];
  for(const off of [0,3,6,9,12,15]){await p.evaluate(x=>{G.pos=x;},base+off);await p.waitForTimeout(450);r.push(await p.evaluate(()=>R3.probe(G,140,100,180,120)));}return r;};
await p.evaluate(()=>R3.setPost('off'));   // 量「燈光調變」本身：關掉後製（光暈會隨燈的遠近讓亮度起伏，混在一起量不準）
const lOff=await lum(false),lOn=await lum(true);
const spread=a=>(Math.max(...a)-Math.min(...a))/(a.reduce((x,y)=>x+y,0)/a.length);
ok('關閉燈光調變：沿隧道前進亮度幾乎不變（變化 <8%）',spread(lOff)<0.08,spread(lOff).toFixed(3));
ok('開啟燈光調變：沿隧道前進亮度明顯起伏（變化 >25%）',spread(lOn)>0.25,spread(lOn).toFixed(3)+'  '+lOn.map(v=>v.toFixed(0)).join(','));
// 車站內不調變
const stPos=await p.evaluate(()=>{const g=G;return g.stations.findIndex(st=>st.env==='tunnel')>=0?g.stations.find(st=>st.env==='tunnel').pos:null;});
if(stPos!==null){
  const inSt=async(on)=>{await p.evaluate(v=>R3.setLamps(v),on);const r=[];for(const off of [-30,-24,-18,-12]){await p.evaluate(x=>{G.pos=x;},stPos+off);await p.waitForTimeout(450);r.push(await p.evaluate(()=>R3.probe(G,140,100,180,120)));}return r;};
  const sOff=await inSt(false),sOn=await inSt(true);
  const diff=Math.max(...sOff.map((v,i)=>Math.abs(v-sOn[i])/Math.max(1,v)));
  ok('車站內不調變：開／關亮度差 <10%',diff<0.10,diff.toFixed(3));
}
await p.evaluate(()=>R3.setLamps(null));
await p.evaluate(()=>R3.setPost('full'));
ok('沒有 JS 錯誤或著色器／GL 警告',errs.length===0,errs.slice(0,3).join(' | '));
await b.close();})();
