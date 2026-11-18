// 測試共用：內建靜態伺服器（不用另外開 http.server）、開頁面、啟動對局、關卡流程。
const http=require('http'),fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');
const MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
function serve(){return new Promise(res=>{const s=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/,'/index.html'));
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(0,()=>res({s,url:'http://localhost:'+s.address().port+'/index.html'}));});}
async function launch(){return chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});}
// opts.hide＝不畫地圖（#map 設 display:none，瀏覽器不用繪製 9,000 格的 SVG，回合流程快約 3 倍；只能用在不需要看地圖或點地圖的測試）；opts.fast＝網址加 fast=1（關閉動畫）；opts.shrink＝把計時器縮到 40 ms（正常動畫時也不用等太久）；opts.zero＝計時器全部 0 ms；opts.pad＝模擬手把；opts.seed＝固定亂數種子
async function open(b,base,q,opts={}){
  const p=await b.newPage({viewport:{width:1400,height:900}});p.errs=[];p.bad=[];
  p.on('pageerror',e=>p.errs.push(e.message));p.on('response',r=>{if(r.status()>=400)p.bad.push(r.status()+' '+r.url());});
  await p.addInitScript(o=>{
    if(o.seed!=null){let s=o.seed;Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};try{localStorage.clear();}catch(e){}}
    if(o.zero){const st=window.setTimeout;window.setTimeout=(f,t,...a)=>st(f,0,...a);}
    else if(o.shrink){const st=window.setTimeout;window.setTimeout=(f,t,...a)=>st(f,t>=1500?t:Math.min(t||0,40),...a);}
    if(o.hide)document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='#map{display:none!important}';document.head.appendChild(s);});
    if(o.pad){window.__pad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.__pad];}
  },opts);
  const sep=q.includes('?')?'&':'?';await p.goto(base+q+(opts.fast?sep+'fast=1':''),{timeout:90000});await p.waitForTimeout(opts.wait||1200);return p;}
const modalClick=p=>p.evaluate(()=>{const m=document.querySelector('#modal');if(m.hidden)return humanTurn()?2:0;
  const bs=[...m.querySelectorAll('button:not(.mnew)')].filter(x=>!x.disabled&&x.getClientRects().length);
  const e=bs.find(x=>['nwGo','evGo','evOk','itGo','evRoll'].includes(x.id)&&!x.disabled)||m.querySelector('.opt:not(.on)')||m.querySelector('.opt')||bs.find(x=>!x.disabled); // 守方的事件卡要先選一個選項，確認鈕才會啟用
  if(e)e.click();return 1;});
async function startGame(p){await p.evaluate(()=>{for(let i=0;i<6;i++){const n=document.querySelector('#wzNext');if(n&&!n.disabled)n.click();}document.querySelector('#btnStart').click();});
  for(let i=0;i<150;i++){const r=await modalClick(p);if(r===2)return true;await p.waitForTimeout(60);}return false;}
// 關卡：開始任務，一直點到結束（過關或失敗）；hold＝持續把兩個港口設成攻方控制（模擬守住）
async function playMission(p,hold){
  await p.click('#misGo');await p.waitForFunction(()=>S&&S.started,null,{timeout:60000});
  if(hold)await p.evaluate(()=>{setInterval(()=>{for(const k of[SPOT.tcport,SPOT.kaohsiung]){S.owner[k]='atk';S.portDown[k]=0;}},50);});
  for(let i=0;i<500&&!(await p.evaluate(()=>MISSION.done));i++){
    await p.evaluate(()=>{const e=document.querySelector('#modal:not([hidden]) #mbox .opt,#evGo,#evOk:not([disabled]),#itGo,#evRoll');if(e)e.click();else if(humanTurn())document.querySelector('#btnEnd').click();});await p.waitForTimeout(250);}
  await p.waitForTimeout(2500);return (await p.textContent('#mbox')).replace(/\s+/g,' ');}
module.exports={ROOT,serve,launch,open,startGame,playMission,modalClick};
