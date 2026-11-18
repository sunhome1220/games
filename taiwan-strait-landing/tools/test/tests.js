// 各項測試：每項回傳 [[通過與否, 說明], …]。tier：quick 快速、medium 中等、full 完整（高一級包含低一級）。
const fs=require('fs'),path=require('path'),cp=require('child_process');
const L=require('./lib.js');
const CFGS=[{optEra:'2026',optFx:'interest'},{optEra:'2030',optFx:'none'},{optEra:'2028',optFx:'full',optSide:'def'},{optEra:'2032',optFx:'interest',optBuild:'surprise'}];
const BASE=path.join(__dirname,'baseline.json');
const noErr=(p,n)=>[[!p.errs.length&&!p.bad.length,n+'：沒有頁面錯誤／404 '+JSON.stringify(p.errs.concat(p.bad))]];
const T=[];const add=(name,tier,fn,solo)=>T.push({name,tier,fn,solo}); // solo＝要單獨執行（時間敏感，與其他測試同時跑會互搶 CPU 而誤報）

add('語法檢查','quick',async()=>{const fs2=[];(function w(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const q=path.join(d,f.name);if(f.isDirectory())w(q);else if(q.endsWith('.js'))fs2.push(q);}})(path.join(L.ROOT,'js'));
  const bad=fs2.filter(f=>cp.spawnSync('node',['--check',f]).status!==0);return [[!bad.length,'所有 js 語法正確（'+fs2.length+' 個）'+bad.join(',')]];});

const waitStarted=p=>p.waitForFunction(()=>S&&S.started,null,{timeout:60000});
add('載入、更新日誌、關卡判定、海上突擊規則','quick',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true});const r=[];
  r.push([await p.evaluate(()=>typeof S==='object'&&typeof startGame==='function'&&Object.keys(MISSION_DEFS).join()==='carrier,port'),'頁面載入、兩個關卡已註冊']);
  r.push(...noErr(p,'載入'));
  r.push([await p.evaluate(()=>CHANGELOG.length<=15&&CHANGELOG_OLD===null),'開頁只載入最近的更新日誌']);
  await p.evaluate(()=>showChangelog(true));await p.waitForFunction(()=>CHANGELOG_OLD&&document.querySelectorAll('#wn h4').length>CHANGELOG.length,null,{timeout:10000}).catch(()=>{});
  r.push([await p.evaluate(()=>!!CHANGELOG_OLD&&CHANGELOG_OLD.length>0&&document.querySelectorAll('#wn h4').length>CHANGELOG.length),'看全部時才載入舊的更新日誌']);
  r.push([await p.evaluate(()=>{const z=FXOFF&&reduce()&&fxK()<.1;document.querySelector('#wn')&&document.querySelector('#wn').remove();return z;}),'網址 fast=1：關閉動畫（reduce() 為真、動畫時間壓縮）']);
  await L.startGame(p);
  // 關卡判定：在已開局的一般對局上直接呼叫各關的 check()（不必真的開關卡、不必玩回合）
  const a=await p.evaluate(()=>{const cv=S.units.find(u=>u.type==='cv'&&u.side==='atk');const D=MISSION_DEFS.carrier,before=D.check();cv.hp=1;return [before,D.check()];});
  r.push([a[0]===null&&a[1]&&a[1].stars===3,'擊沉航艦：未重創時不過關；重創後第 1 回合 3 星']);
  const q=await p.evaluate(()=>{const D=MISSION_DEFS.port,ks=portPick().map(x=>x[0]);const none=D.check();
    for(const k of ks){S.owner[SPOT[k]]='atk';S.portDown[SPOT[k]]=0;}const t1=D.check();S.turn+=1;const t2=D.check();
    S.portDown[SPOT[ks[0]]]=1;const t3=D.check();S.turn-=1;return {ks:ks.join(),none,t1,t2s:t2&&t2.stars,t3};});
  r.push([/^(tcport,kaohsiung|kaohsiung,keelung|tcport,keelung)$/.test(q.ks),'奪港：目標是兩個港口 '+q.ks]);r.push([q.none===null&&q.t1===null,'奪港：剛佔領（還沒撐過守方階段）不算過關']);
  r.push([q.t2s>=1,'奪港：撐過一個階段後過關']);r.push([q.t3===null,'奪港：港口被破壞後不算守住']);
  // 海上突擊規則
  const o=await p.evaluate(()=>{let sea=null;for(const d of S.units.filter(u=>u.side==='def'&&!isMsl(u)&&alive(u)&&TER[u.c+','+u.r]&&TER[u.c+','+u.r].isl==='TW')){const h=hexOf(d);const n=nbrs(h.c,h.r).find(n=>n&&n.t==='sea'&&!unitAt(n.k));if(n){sea=n;break;}}
    const out={};for(const [type,st] of [['amph','lst'],['mar','lst'],['amph','ro'],['arm','ro']]){
      const u=S.units.find(x=>x.side==='atk'&&x.type===type&&alive(x)&&!x.ship);const k=[...reach(u)].find(([k,v])=>v.kind==='sail')[0];humanMove(u,k,'sail');const sh=shipOf(u);sh.type=st;sh.c=sea.c;sh.r=sea.r;u.c=sea.c;u.r=sea.r;u.moved=false;u.acted=false;
      out[type+'/'+st]=[targets(u).length,seaPen(u)];}return out;});
  r.push([o['amph/lst'][0]>0&&o['amph/lst'][1]<0,'兩棲旅搭兩棲艦：海上可搶灘突擊（有修正）']);r.push([o['mar/lst'][0]>0&&o['mar/lst'][1]<0,'陸戰旅搭兩棲艦：海上可搶灘突擊']);
  r.push([o['amph/ro'][0]===0,'搭滾裝船的旅：海上不能突擊']);r.push([o['arm/ro'][0]===0,'重型旅：海上不能突擊']);
  r.push(...noErr(p,'快速測試'));await p.close();return r;});

add('海面點選與游標移入（反查格子）','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true});const r=[];await L.startGame(p);
  const pts=await p.evaluate(()=>{const g=document.querySelector('#gS').getScreenCTM(),out=[];
    for(const h of Object.values(TER)){if(h.t!=='sea'||h.isl)continue;const [x,y]=center(h.c,h.r),q=new DOMPoint(x,y).matrixTransform(g);
      if(q.x>40&&q.x<window.innerWidth-40&&q.y>140&&q.y<window.innerHeight-60&&!unitAt(h.k)&&(h.c*7+h.r*3)%97===0&&(()=>{const e=document.elementFromPoint(q.x,q.y);return !!(e&&e.closest('[data-sea]'));})())out.push({k:h.k,x:q.x,y:q.y});}
    return out.slice(0,6);});
  r.push([pts.length>=3,'找得到畫面內的海格可測 '+pts.length]);let okHover=0,okClick=0;
  for(const q of pts){await p.mouse.move(q.x-30,q.y);await p.mouse.move(q.x,q.y,{steps:3});await p.waitForTimeout(60);if(await p.evaluate(k=>S.hover===k,q.k))okHover++;
    await p.evaluate(()=>{S.hover=null;});await p.mouse.click(q.x,q.y);await p.waitForTimeout(60);if(await p.evaluate(k=>S.hover===k,q.k))okClick++;}
  r.push([okHover===pts.length,'游標移到海格上：資訊卡跟著格子 '+okHover+'／'+pts.length]);r.push([okClick===pts.length,'點海格：反查到正確的格子 '+okClick+'／'+pts.length]);
  r.push([await p.evaluate(()=>document.querySelectorAll('#map *').length<35000),'地圖 SVG 節點數 < 35,000（海面合併後約 30,000；合併前約 46,700）']);
  r.push(...noErr(p,'海面點選'));await p.close();return r;});

const score=async(c,i,tag)=>{const p=await L.open(c.b,c.url,'?debug=1',{zero:true,hide:true,seed:1234+i*77,wait:500});
  const s=await p.evaluate(cfg=>window.__score(cfg),CFGS[i]);const errs=p.errs.slice();await p.close();return {s,errs};};
const baseCheck=async(c,idx)=>{const base=fs.existsSync(BASE)?JSON.parse(fs.readFileSync(BASE,'utf8')):{};const r=[];
  const res=await Promise.all(idx.map(i=>score(c,i)));
  idx.forEach((i,k)=>{const s=JSON.stringify(res[k].s);if(c.update){base[i]=s;r.push([true,'基準值已更新：設定 '+i+' '+s.slice(0,60)]);}
    else if(!base[i])r.push([false,'設定 '+i+' 沒有基準值（執行 --update-baseline 建立）']);
    else r.push([base[i]===s,'固定種子推演（設定 '+i+'）與基準值相同'+(base[i]===s?'':'\n    基準 '+base[i]+'\n    現在 '+s)]);
    r.push([!res[k].errs.length,'推演（設定 '+i+'）沒有頁面錯誤 '+res[k].errs]);});
  if(c.update)fs.writeFileSync(BASE,JSON.stringify(base,null,1));return r;};
add('固定種子推演（1 場）','medium',c=>baseCheck(c,[0]));
add('固定種子推演（其餘 3 場）','full',c=>baseCheck(c,[1,2,3]));

const mission=async(c,q,hold,opts,want,name)=>{const p=await L.open(c.b,c.url,q,opts);const t=await L.playMission(p,hold);const r=[[t.includes(want),name+'：結算「'+want+'」'],...noErr(p,name)];await p.close();return r;}; // 一定要關掉頁面：沒關的頁面會繼續在背景跑，拖慢後面的測試
add('關卡完整流程（關閉動畫）','medium',async c=>[].concat(
  ...await Promise.all([mission(c,'?mission=port&ex=keelung&debug=1',true,{fast:true,hide:true},'任務成功','奪港過關'),mission(c,'?mission=port&ex=keelung&debug=1',false,{fast:true,hide:true},'任務失敗','奪港失敗')])));
add('關卡完整流程（正常動畫）','full',async c=>[].concat(
  ...await Promise.all([mission(c,'?mission=port&ex=keelung&debug=1',true,{shrink:true},'任務成功','奪港過關（正常動畫）'),mission(c,'?mission=port&ex=keelung&debug=1',false,{shrink:true,hide:true},'任務失敗','奪港失敗（動畫程式照跑、不繪製地圖）')])));

add('手把登陸流程','full',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{pad:true,shrink:true});const r=[];
  const press=async(i)=>{await p.evaluate(i=>{__pad.buttons[i].pressed=true;__pad.buttons[i].value=1;},i);await p.waitForTimeout(110);await p.evaluate(i=>{__pad.buttons[i].pressed=false;__pad.buttons[i].value=0;},i);await p.waitForTimeout(150);};
  const st=()=>p.evaluate(()=>({human:humanTurn(),modal:!document.querySelector('#modal').hidden,turn:S.turn}));
  for(let i=0;i<5;i++)await press(5);await press(9);await p.waitForTimeout(2000);
  for(let i=0;i<150;i++){const s=await st();if(s.human&&!s.modal)break;if(s.modal)await press(3);await p.waitForTimeout(250);}
  await p.evaluate(()=>{const am=S.units.find(u=>u.side==='atk'&&u.type==='amph'&&alive(u)&&!u.ship);const k=[...reach(am)].find(([k,v])=>v.kind==='sail')[0];humanMove(am,k,'sail');S.sel=null;render();});
  await press(9);await press(9);
  for(let i=0;i<200;i++){const s=await st();if(s.human&&!s.modal&&s.turn>=2)break;if(s.modal)await press(3);await p.waitForTimeout(250);}
  await p.evaluate(()=>{const am=S.units.find(u=>u.side==='atk'&&u.ship&&alive(u));const sh=shipOf(am),t=TER[SPOT.tcport],sea=Object.values(TER).filter(h=>h.t==='sea'&&rd(h,t)<=3&&!unitAt(h.k)).sort((a,b)=>rd(a,t)-rd(b,t))[0];sh.c=sea.c;sh.r=sea.r;am.c=sea.c;am.r=sea.r;render();});
  let n=0;for(;n<60;n++){await press(1);await press(15);if(await p.evaluate(()=>S.sel&&S.sel.ship))break;}
  r.push([n<=3,'手把：十字鍵 '+(n+1)+' 次選到船上的旅（應 ≤ 4）']);
  const toast=()=>p.evaluate(()=>document.querySelector('#toast').textContent);let ok=false;
  for(let i=0;i<30;i++){const t=await toast();if(/^\d+\/\d+　(搶灘|登陸|港口)/.test(t)||/★推薦/.test(t)){ok=true;break;}await press(15);}
  r.push([ok,'手把：登陸選項排在最前面']);await press(0);await p.waitForTimeout(1500);
  r.push([await p.evaluate(()=>S.stats.firstLand!=null||S.units.some(u=>u.side==='atk'&&u.type==='amph'&&!u.ship&&hexOf(u).isl==='TW')),'手把：按 ✕ 完成登陸']);
  r.push(...noErr(p,'手把流程'));await p.close();return r;},true);
module.exports={T};
