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
  r.push([await p.evaluate(()=>document.body.classList.contains('noanim')&&(!document.querySelector('.wv')||getComputedStyle(document.querySelector('.wv')).animationName==='none')),'關閉動畫時，海浪的循環動畫也停掉']);
  r.push([await p.evaluate(()=>SETUP_PAGES.length===5&&SETUP_PAGES.map(x=>x.s).join()==='方式,攻方,守方,假設,確認'),'設定頁整理成 5 頁：方式／攻方／守方／假設／確認']);
  r.push([await p.evaluate(()=>{const f=SETUP_PAGES.flatMap(p=>p.fields);return ['optMode','optEra','optSubCtl','optMonth','optSubMisA','optMN1','optAD1','optSubMisD'].every(id=>f.some(x=>x.sel===id));}),'原本各頁的設定項都還在']);
  r.push([await p.evaluate(()=>{const z=FXOFF&&reduce()&&fxK()<.1;document.querySelector('#wn')&&document.querySelector('#wn').remove();return z;}),'網址 fast=1：關閉動畫（reduce() 為真、動畫時間壓縮）']);
  { // 開戰月份：4×3 月曆格、每格天候三色條；點格子會設定月份，說明文字有完整機率
    const mo=await p.evaluate(()=>{const i=SETUP_PAGES.findIndex(pg=>pg.fields.some(f=>f.sel==='optMonth'));WZ.i=i;renderWizard();const t=[...document.querySelectorAll('.seg.mon .segb')];
      const bars=t.every(b=>b.querySelectorAll('.wxb s').length===3);t.find(b=>b.dataset.v==='10').click();return {n:t.length,bars,v:$('#optMonth').value,desc:(document.querySelector('.seg.mon+.seg-desc')||{}).textContent||''};});
    r.push([mo.n===12&&mo.bars,'開戰月份：12 個月曆格，每格都有天候三色條']);r.push([mo.v==='10'&&/良好 45%、普通 32%、惡劣 23%/.test(mo.desc),'點 10 月：設定月份、說明寫出完整機率 '+mo.desc.slice(0,40)]);
    await p.evaluate(()=>{$('#optMonth').value='4';$('#optMonth').dispatchEvent(new Event('change'));WZ.i=0;renderWizard();});} // 回到第 1 頁：之後 startGame 會一頁頁按下一步，沒看過的頁面不能跳過
  await L.startGame(p);
  // 關卡判定：在已開局的一般對局上直接呼叫各關的 check()（不必真的開關卡、不必玩回合）
  const a=await p.evaluate(()=>{const cv=S.units.find(u=>u.type==='cv'&&u.side==='atk');const D=MISSION_DEFS.carrier,before=D.check();cv.hp=1;return [before,D.check()];});
  r.push([a[0]===null&&a[1]&&a[1].stars===3,'擊沉航艦：未重創時不過關；重創後第 1 回合 3 星']);
  r.push([!!a[1]&&/號|艦/.test(a[1].d)&&!/步|假設情境/.test(a[1].d+a[1].extra)&&/我方付出/.test(a[1].extra)&&/共軍損失/.test(a[1].extra)&&!/整個任務期間/.test(a[1].extra),'擊沉航艦結算：稱呼寫「遼寧號／山東艦／福建艦」、不用「步」、沒有假設情境與整場任務統計，只有我方付出與共軍損失']);
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
  const cov=await p.evaluate(()=>['宜蘭','蘇澳','台東','志航基地','花蓮','新竹基地','桃園機場','清泉崗'].map(n=>{const h=Object.values(TER).find(x=>x.isl==='TW'&&x.name===n);return [n,!!h&&samCovBM(h)];}));
  r.push([cov.every(x=>x[1]),'彈道飛彈防禦涵蓋重要地點（宜蘭、蘇澳、台東、志航、花蓮、新竹、桃園、清泉崗）'+cov.filter(x=>!x[1]).map(x=>' 缺：'+x[0]).join('')]);
  r.push([await p.evaluate(()=>{const b=document.getElementById('btnLand');return !!b&&!b.hidden;}),'你是攻方：登陸提示按鈕顯示']);
  r.push([await p.evaluate(()=>{const t=TER[SPOT.tcport],sea=nbrs(t.c,t.r).find(n=>n.t==='sea'),land=nbrs(t.c,t.r).find(n=>n.t!=='sea'&&!n.cliff);S.mines=S.mines||{};S.mines[sea.k]=1;S.mines[land.k]=1;render();return Object.keys(S.mines).length>=2&&document.querySelectorAll('#map .mine').length===0;}),'你是攻方：地圖上看不到守方的布雷區']);
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

add('手機版射程圖例不蓋住地圖按鈕','medium',async c=>{const {devices}=require('playwright');const r=[];
  for(const [nm,dev] of [['直向',devices['iPhone 13']],['橫向',devices['iPhone 13 landscape']]]){
    const ctx=await c.b.newContext({...dev}),p=await ctx.newPage();p.errs=[];p.bad=[];p.on('pageerror',e=>p.errs.push(e.message));
    await p.goto(c.url+'?debug=1&fast=1',{timeout:90000});await p.waitForTimeout(1200);await L.startGame(p);
    const o=await p.evaluate(()=>{RNG_LEG=[1,2,3,4,5,6].map(i=>({cls:i%2?'ad':'x',sd:'def',txt:'測試圖例 '+i+'・200 km'}));rngLegSync();placeLoc();
      const lg=document.getElementById('rngLeg').getBoundingClientRect(),mb=[...document.querySelectorAll('.mapbar>*')].map(q=>q.getBoundingClientRect()).filter(q=>q.width&&q.height);
      return {n:mb.length,ov:mb.filter(q=>q.left<lg.right&&q.right>lg.left&&q.top<lg.bottom&&q.bottom>lg.top).length};});
    r.push([o.n>0&&o.ov===0,'手機'+nm+'：圖例與地圖上方 '+o.n+' 個按鈕重疊 '+o.ov+' 個（應為 0）']);r.push(...noErr(p,'手機'+nm));await ctx.close();}
  return r;});

add('防空增購：各年份連數、設定頁、自動選址','medium',async c=>{const r=[];
  const play=async(era,side,picks)=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true});
    await p.evaluate(([era,side,picks])=>{$('#optEra').value=era;$('#optEra').dispatchEvent(new Event('change'));$('#optSide').value=side;$('#optSide').dispatchEvent(new Event('change'));picks.forEach((v,i)=>{$('#optAD'+(i+1)).value=v;});},[era,side,picks]);
    const page=await p.evaluate(()=>{return SETUP_PAGES.flatMap(p=>p.fields).filter(f=>/^optAD\d$/.test(f.sel)&&(!f.when||f.when())).length;});
    await L.startGame(p);const o=await p.evaluate(()=>({x:(S.samX||[]).map(x=>x.pick+'@'+x.k),n:samExtraN(S.era)}));return {p,page,o};};
  let q=await play('2026','def',[]);r.push([q.o.n===0&&q.o.x.length===0&&q.page===0,'2026 年：沒有增購連、設定頁不出現']);r.push(...noErr(q.p,'2026'));await q.p.close();
  q=await play('2030','def',['pt','yl']);r.push([q.o.n===2&&q.page===2,'2030 年：增購 2 個連，設定頁有 2 個問題（人類守方）']);
  r.push([q.o.x.length===2&&q.o.x[0].startsWith('pt@')&&q.o.x[1].startsWith('yl@'),'2030 年：照設定放在屏東・恆春、宜蘭 '+q.o.x]);r.push(...noErr(q.p,'2030'));await q.p.close();
  q=await play('2032','atk',['pt','pt','pt']);r.push([q.page===0,'你是攻方（電腦守方）：設定頁不出現']);
  r.push([q.o.n===3&&q.o.x.length===3&&q.o.x.every(x=>!x.startsWith('pt@')),'電腦守方一律自動選址（不吃設定值）：'+q.o.x]);r.push(...noErr(q.p,'2032 電腦守方'));await q.p.close();
  return r;});

add('攻擊模式的快捷按鈕（取代電腦代打／結束階段）','medium',async c=>{const r=[];
  const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:4242}); // 固定種子：第一波打擊後哪些基地還能出擊是隨機的，不固定會偶爾找不到
  await p.evaluate(()=>{$('#optSide').value='def';$('#optSide').dispatchEvent(new Event('change'));});await L.startGame(p);
  for(let i=0;i<100;i++){const x=await L.modalClick(p);if(x===2&&await p.evaluate(()=>humanTurn()&&document.querySelector('#modal').hidden))break;await p.waitForTimeout(150);}
  const txt=()=>p.evaluate(()=>['mbStrike','mbAssist','mbEnd','btnStrike','btnAssist','btnEnd'].map(id=>{const e=document.getElementById(id);return e.hidden?'':e.textContent.trim()+(e.disabled?'|停':'');}));
  const k=await p.evaluate(()=>{const h=afUsable().find(x=>afBudget(x.k)>0&&afBaseN(x.k)>0);if(!h)return null;S.baseSel=h.k;S.hover=h.k;S.sel=null;render();return h.k;});
  r.push([!!k,'找得到可出擊的空軍基地']);if(!k){await p.close();return r;}
  let t=await txt();r.push([t.slice(0,3).join()===['攻擊船團','空襲島上目標','打擊大陸沿岸'].map((x,i)=>x+(t[i].endsWith('|停')?'|停':'')).join()&&!t.some(x=>/電腦代打|結束階段/.test(x)),'基地卡開著：三個按鈕變成三種出擊方式（沒有「電腦代打」「結束階段」）'+t.slice(0,3)]);
  const m=await p.evaluate(()=>{const N=afModeN(S.baseSel);const e=Object.entries(N).find(([m,n])=>n>0);return e?e[0]:null;});
  if(m){await p.evaluate(m=>{const id={afS:'btnStrike',afL:'btnAssist',afC:'btnEnd'}[m];document.getElementById(id).click();},m);await p.waitForTimeout(200);t=await txt();
    r.push([t[0]==='取消出擊'&&/^換方式/.test(t[1])&&t[2]==='確認出擊|停','出擊中：取消出擊／換方式／確認出擊（還沒選目標時停用） '+t.slice(0,3)]);
    r.push([await p.evaluate(()=>{const e=document.getElementById('btnEnd');e.click();return S.phase==='def'&&S.mode!==null;}),'出擊中按「確認出擊」（停用）不會結束階段']);
    await p.evaluate(()=>document.getElementById('btnStrike').click());await p.waitForTimeout(200);r.push([await p.evaluate(()=>S.mode===null),'按「取消出擊」離開出擊模式']);
  }else r.push([true,'（目前沒有可用的出擊方式，略過出擊中的檢查）']);
  await p.evaluate(()=>{S.baseSel=null;render();});t=await txt();r.push([/縱深打擊|火力打擊/.test(t[0])&&/電腦代打/.test(t[1])&&t[2]==='結束階段','離開基地卡後：恢復原本的三個按鈕 '+t.slice(0,3)]);
  r.push([await p.evaluate(()=>{const b=document.getElementById('btnLand');return !!b&&b.hidden;}),'你是守方：登陸提示按鈕不顯示（按了不會有反應）']);
  r.push([await p.evaluate(()=>{const t=TER[SPOT.tcport],sea=nbrs(t.c,t.r).find(n=>n.t==='sea'),land=nbrs(t.c,t.r).find(n=>n.t!=='sea'&&!n.cliff);S.mines=S.mines||{};S.mines[sea.k]=1;S.mines[land.k]=1;render();return document.querySelectorAll('#map .mine.sea').length>=1&&document.querySelectorAll('#map .mine:not(.sea)').length>=1;}),'你是守方：看得到水雷（海格）與地雷（陸地格），圖形不同']);
  r.push(...noErr(p,'快捷按鈕'));await p.close();return r;});

add('預先布雷：分散到四個港口、設定頁指定、補布選位置','medium',async c=>{const r=[];
  const play=async(era,side,picks)=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:9});
    await p.evaluate(([era,side,picks])=>{$('#optEra').value=era;$('#optEra').dispatchEvent(new Event('change'));$('#optSide').value=side;$('#optSide').dispatchEvent(new Event('change'));picks.forEach((v,i)=>{$('#optMN'+(i+1)).value=v;});},[era,side,picks]);
    const page=await p.evaluate(()=>{return SETUP_PAGES.flatMap(p=>p.fields).filter(f=>/^optMN\d$/.test(f.sel)&&(!f.when||f.when())).length;});
    await p.evaluate(()=>{for(let i=0;i<8;i++){const n=document.querySelector('#wzNext');if(n&&!n.disabled)n.click();}document.querySelector('#btnStart').click();});
    await p.waitForFunction(()=>S.started&&S.mines,null,{timeout:60000});
    const o=await p.evaluate(()=>{const near=pk=>Object.keys(S.mines).filter(k=>hd(TER[k],TER[SPOT[pk]])<=2).length;return {n:Object.keys(S.mines).length,tamsui:near('tamsui'),keelung:near('keelung'),tcport:near('tcport'),kaohsiung:near('kaohsiung'),sea:Object.keys(S.mines).filter(k=>TER[k].t==='sea').length};});
    return {p,page,o};};
  let q=await play('2032','atk',[]);
  r.push([q.o.n===6&&q.o.tamsui>=1&&q.o.keelung>=1&&q.o.tcport>=1&&q.o.kaohsiung>=1,'2032 年預設：6 處雷分散到台北港、基隆、台中港、高雄（'+JSON.stringify(q.o)+'）']);
  r.push([q.o.sea===3,'單數處近海水雷、雙數處灘頭地雷（3 + 3）']);r.push([q.page===0,'你是攻方：布雷設定頁不出現']);r.push(...noErr(q.p,'2032 預設'));await q.p.close();
  q=await play('2029','def',['tamsui','tamsui','tamsui','keelung']);
  r.push([q.page===4,'2029 年人類守方：布雷設定頁有 4 個問題']);r.push([q.o.n===4&&q.o.tamsui>=3&&q.o.keelung>=1,'照設定：3 處在台北港、1 處在基隆（'+JSON.stringify(q.o)+'）']);
  const rl=await q.p.evaluate(()=>{const k=Object.keys(S.mines)[0];delete S.mines[k];syncMines();S.mods.mineT=0;const o=interdictOptions().opts.filter(x=>x.id.startsWith('mine'));return o.map(x=>x.id+'|'+x.label);});
  r.push([rl.length>=2&&rl.some(x=>x.startsWith('mine@')&&/台北港/.test(x)),'有雷被掃除或觸發後，補布選項可挑地點（含台北港外海）：'+rl.length+' 個']);r.push(...noErr(q.p,'2029 設定'));await q.p.close();
  return r;});

add('卡頓偵測：連續兩次慢才提醒、三個按鈕','medium',async c=>{const r=[];
  const feed=(p,ms,n)=>p.evaluate(([ms,n])=>{window.__jank.eval(Array(n).fill(ms));return !!document.getElementById('jankCard');},[ms,n]);
  let p=await L.open(c.b,c.url,'?debug=1',{hide:true,jank:true});await L.startGame(p);await p.evaluate(()=>{__jank.JANK.warm=0;});
  r.push([!(await feed(p,16,40)),'順暢（16 ms）：不提醒']);r.push([!(await feed(p,80,40)),'第一次慢：還不提醒']);r.push([!(await feed(p,16,40)),'接著順暢：計數歸零']);
  r.push([!(await feed(p,80,10)),'樣本太少（10 筆）：不算']);await feed(p,80,40);r.push([await feed(p,80,40),'連續兩次慢（80 ms，約 12 fps）：跳出提醒']);
  r.push([await p.evaluate(()=>document.querySelectorAll('#jankCard button').length===3&&/關閉動畫/.test(document.getElementById('jankCard').textContent)),'提醒有三個按鈕']);
  await p.evaluate(()=>document.getElementById('jankOff').click());await p.waitForTimeout(200);
  r.push([await p.evaluate(()=>!document.getElementById('jankCard')&&FXOFF&&document.body.classList.contains('noanim')&&document.getElementById('optFxSpd').value==='off'),'按「關閉動畫」：動畫關閉、海浪停止、設定同步']);r.push(...noErr(p,'卡頓提醒'));await p.close();
  p=await L.open(c.b,c.url,'?debug=1',{hide:true,jank:true});await L.startGame(p);await p.evaluate(()=>{__jank.JANK.warm=0;});await feed(p,80,40);await feed(p,80,40);
  await p.evaluate(()=>document.getElementById('jankNever').click());r.push([await p.evaluate(()=>!document.getElementById('jankCard')&&localStorage.getItem('tsl-jank')==='0'&&!FXOFF),'按「不再提醒」：記在這台裝置、動畫不變']);
  r.push([!(await feed(p,80,40)),'這局不會再問']);await p.close();
  p=await L.open(c.b,c.url,'?debug=1',{hide:true});await L.startGame(p);await p.evaluate(()=>{__jank.JANK.warm=0;});await feed(p,80,40);r.push([!(await feed(p,80,40)),'網址 nojank=1（測試預設）：不提醒']);await p.close();
  return r;});

add('潛艦開火後脫離、最後已知位置、反潛搜索預覽','medium',async c=>{const r=[];
  const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:11});await L.startGame(p);
  const o=await p.evaluate(()=>{const u=S.units.find(x=>x.side==='def'&&x.type==='hk'&&alive(x));if(!u)return null;
    const hu=TER[SPOT.hualien],sea=Object.values(TER).filter(h=>h.t==='sea'&&hd(h,hu)===5&&!unitsAt(h.k).length).sort((a,b)=>a.r-b.r||a.c-b.c)[0];u.c=sea.c;u.r=sea.r;u.revealed=true;
    const from=hexOf(u);subEvade(u);const to=hexOf(u);render();
    return {rev:u.revealed,last:u.last.c+','+u.last.r===from.k,age:S.turn-u.last.turn,d:hd(from,to),sea:to.t==='sea',marks:document.querySelectorAll('#map .lastk').length,hidden:subHidden(u)};});
  r.push([!!o,'找得到台灣潛艦可測']);if(o){
    r.push([o.rev===false&&o.hidden===true,'開火後立刻恢復隱蔽（對方玩家看不到）']);r.push([o.last&&o.age===0,'留下發射時的最後已知位置']);
    r.push([o.d>=2&&o.d<=4&&o.sea,'轉移 20～40 km（'+o.d+' 格）、落在海上']);r.push([o.marks>=1,'地圖上畫出最後已知位置（？虛線圈）']);}
  const g=await p.evaluate(()=>[heloGain(0),heloGain(ASW.area),heloGain(ASW.area/2)]);
  r.push([g[0]===1&&Math.abs(g[1]-.4)<1e-9&&g[2]>.4&&g[2]<1,'搜索效果隨距離下降：圓心 100%、邊緣 40% '+g.map(x=>x.toFixed(2))]);
  const pv=await p.evaluate(()=>{const u=S.units.find(x=>alive(x)&&heloN(x)>0&&x.side==='atk');if(!u)return null;S.mode='helo';S.heloU=u.id;const h=hexOf(u);heloPreview(h.k);const e=document.getElementById('heloPrev');
    const on=!!e&&e.getAttribute('display')!=='none'&&Math.abs(+e.getAttribute('r')-(ASW.area+.5)*HPX)<1;S.mode=null;heloPreview(null);return {on,off:e.getAttribute('display')==='none'};});
  r.push([!!pv&&pv.on&&pv.off,'反潛直升機：預覽 40 km 搜索圓，離開模式後隱藏']);
  r.push(...noErr(p,'潛艦脫離'));await p.close();return r;});

add('潛艦自主執行任務：鎖定、任務設定、通訊窗口','medium',async c=>{const r=[];
  const play=async(side,ctl,misD,misA)=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:21});
    const pg=await p.evaluate(([side,ctl,misD,misA])=>{$('#optSide').value=side;$('#optSide').dispatchEvent(new Event('change'));$('#optSubCtl').value=ctl;$('#optSubMisD').value=misD;$('#optSubMisA').value=misA;
      const F=SETUP_PAGES.flatMap(p=>p.fields);return ['optSubCtl','optSubMisD','optSubMisA'].map(id=>{const f=F.find(x=>x.sel===id);return !!f&&(!f.when||!!f.when());});},[side,ctl,misD,misA]);
    await L.startGame(p);for(let i=0;i<100;i++){const x=await L.modalClick(p);if(x===2&&await p.evaluate(()=>humanTurn()&&document.querySelector('#modal').hidden))break;await p.waitForTimeout(150);}
    return {p,pg};};
  const st=(p,type)=>p.evaluate(type=>{const L=S.units.filter(u=>u.type===type&&alive(u));return {n:L.length,locked:L.filter(u=>u.moved&&u.acted&&u.auto).length,mis:[...new Set(L.map(u=>u.mis))].join('|'),manual:L.filter(u=>!u.moved&&!u.acted).length};},type);
  let q=await play('def','auto','lnd','auto');let o=await st(q.p,'hk');
  r.push([o.n>0&&o.locked===o.n,'守方自主：台灣潛艦在己方階段開始後已行動並鎖定（'+o.locked+'／'+o.n+'）']);r.push([o.mis==='lnd','任務取自設定精靈：載運部隊的登陸艦']);
  r.push([JSON.stringify(q.pg)==='[true,true,false]','你是守方：設定頁顯示操作方式與台灣潛艦任務，不顯示共軍潛艦任務']);
  const pn=await q.p.evaluate(()=>{const u=S.units.find(x=>x.type==='hk'&&alive(x));return {html:subMisPanelHTML(u),open:subWindowOpen(u),turn:S.turn,misT:u.misT};});
  r.push([/自主執行任務/.test(pn.html)&&/下一次通訊窗口/.test(pn.html)||/現在是通訊窗口/.test(pn.html),'資訊卡有「自主執行任務」說明，並寫出通訊窗口']);
  const w=await q.p.evaluate(()=>{const u=S.units.find(x=>x.type==='hk'&&alive(x));const t=S.turn;u.misT=t;const a=subWindowOpen(u);u.misT=t-3;const b=subWindowOpen(u);return [a,b];});
  r.push([w[1]===true&&(w[0]===false||w[0]===true),'距上次交代任務滿 3 回合就有通訊窗口']);r.push(...noErr(q.p,'守方自主'));await q.p.close();
  q=await play('def','manual','auto','auto');o=await st(q.p,'hk');r.push([o.n>0&&o.manual===o.n,'守方完全手動：潛艦沒有被自主鎖定（'+o.manual+'／'+o.n+' 可手動）']);await q.p.close();
  q=await play('atk','auto','auto','esc');o=await st(q.p,'psub');
  r.push([o.n>0&&o.locked===o.n&&o.mis==='esc','攻方自主：共軍潛艦已行動並鎖定，任務＝美日驅逐艦與巡洋艦（'+o.locked+'／'+o.n+'）']);
  r.push([JSON.stringify(q.pg)==='[true,false,true]','你是攻方：設定頁顯示操作方式與共軍潛艦任務，不顯示台灣潛艦任務']);r.push(...noErr(q.p,'攻方自主'));await q.p.close();
  return r;});

add('攻方停戰＝宣布達成目標或撤退，不向守方請求','medium',async c=>{const r=[];
  const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:31});await L.startGame(p);
  const o=await p.evaluate(()=>{const ids=truceOptions('atk').opts.map(x=>x.id),dv=truceOptions('def').opts.map(x=>x.id),v=truceVerdict('declare');return {ids,dv,vt:v.t,vs:v.s};});
  r.push([o.ids.includes('declare')&&o.ids.includes('retreat')&&o.ids.includes('escalate')&&!o.ids.includes('truce'),'攻方選項：宣布達成目標／撤退／升級，沒有「請求停火」 '+o.ids]);
  r.push([/宣布達成目標/.test(o.vt)&&['atk','draw','def'].includes(o.vs),'宣布達成目標的結果依達成條件判定：'+o.vt]);
  r.push([o.dv.includes('talks'),'守方仍可請求停火談判（'+o.dv+'）']);
  r.push(...noErr(p,'攻方停戰'));await p.close();return r;});

add('對抗性登陸（強攻有守軍的灘頭）','medium',async c=>{const r=[];
  const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:5});await L.startGame(p);
  const o=await p.evaluate(()=>{const t=TER['26,26'],sea=nbrs(t.c,t.r).find(n=>n&&n.t==='sea'&&!unitsAt(n.k).length);const res={};
    const setup=(type,shipType)=>{const u=S.units.find(x=>x.side==='atk'&&x.type===type&&alive(x)&&!x.ship);const k0=[...reach(u)].find(([k,v])=>v.kind==='sail')[0];humanMove(u,k0,'sail');const sh=shipOf(u);sh.type=shipType;sh.c=sea.c;sh.r=sea.r;u.c=sea.c;u.r=sea.r;u.moved=false;u.acted=false;return u;};
    let u=setup('mar','lst');let v=reach(u).get('26,26');res.marLst=!!(v&&v.opp&&v.kind==='land');
    humanMove(u,'26,26','land');res.after={acted:u.acted,landedOrAboard:(alive(u)&&(hexOf(u).k==='26,26'?'landed':'aboard'))||'dead',unbound:hexOf(u).k==='26,26'?!u.ship:null};
    return res;});
  r.push([o.marLst,'陸戰旅在兩棲艦上：緊鄰有守軍的澎湖格，可強攻登陸（reach 標示 opp）']);
  r.push([o.after.acted&&['landed','aboard','dead'].includes(o.after.landedOrAboard)&&(o.after.unbound===null||o.after.unbound===true),'強攻登陸正常結算（成功＝上岸並放掉船；失敗＝留在船上或全軍覆沒）：'+JSON.stringify(o.after)]);
  const n=await p.evaluate(()=>{const t=TER['26,26'],sea=nbrs(t.c,t.r).find(n=>n&&n.t==='sea'&&!unitsAt(n.k).length);const out={};
    for(const [type,st] of [['amph','ro'],['arm','lst']]){const u=S.units.find(x=>x.side==='atk'&&x.type===type&&alive(x)&&!x.ship);if(!u)continue;const k0=[...reach(u)].find(([k,v])=>v.kind==='sail');if(!k0)continue;humanMove(u,k0[0],'sail');const sh=shipOf(u);sh.type=st;sh.c=sea.c;sh.r=sea.r;u.c=sea.c;u.r=sea.r;u.moved=false;u.acted=false;const v=reach(u).get('26,26');out[type+'/'+st]=!!(v&&v.kind==='land');}
    return out;});
  r.push([n['amph/ro']===false&&n['arm/lst']===false,'滾裝船上的旅、重型旅：不能強攻登陸 '+JSON.stringify(n)]);
  r.push(...noErr(p,'強攻登陸'));await p.close();return r;});

const score=async(c,i,tag)=>{const p=await L.open(c.b,c.url,'?debug=1',{zero:true,hide:true,seed:1234+i*77,wait:500});
  const s=await p.evaluate(cfg=>window.__score(cfg),CFGS[i]);const errs=p.errs.slice();await p.close();return {s,errs};};
const baseCheck=async(c,idx)=>{const base=fs.existsSync(BASE)?JSON.parse(fs.readFileSync(BASE,'utf8')):{};const r=[];
  const res=await Promise.all(idx.map(i=>score(c,i)));
  idx.forEach((i,k)=>{const s=JSON.stringify(res[k].s);if(c.update){base[i]=s;r.push([true,'基準值已更新：設定 '+i+' '+s.slice(0,60)]);}
    else if(!base[i])r.push([false,'設定 '+i+' 沒有基準值（執行 --update-baseline 建立）']);
    else r.push([base[i]===s,'固定種子推演（設定 '+i+'）與基準值相同'+(base[i]===s?'':'\n    基準 '+base[i]+'\n    現在 '+s)]);
    r.push([!res[k].errs.length,'推演（設定 '+i+'）沒有頁面錯誤 '+res[k].errs]);});
  if(c.update){const cur=fs.existsSync(BASE)?JSON.parse(fs.readFileSync(BASE,'utf8')):{};for(const i of idx)cur[i]=base[i];fs.writeFileSync(BASE,JSON.stringify(cur,null,1));} // 寫入前重新讀檔再合併：medium 與 full 的推演同時跑，不然後寫的會蓋掉先寫的
  return r;};
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
add('手把 ○ 取消出擊確認面板','full',async c=>{const r=[];
  const p=await L.open(c.b,c.url,'?debug=1',{pad:true,fast:true,hide:true,seed:4242});
  await p.evaluate(()=>{$('#optSide').value='def';$('#optSide').dispatchEvent(new Event('change'));});await L.startGame(p);
  for(let i=0;i<100;i++){const x=await L.modalClick(p);if(x===2&&await p.evaluate(()=>humanTurn()&&document.querySelector('#modal').hidden))break;await p.waitForTimeout(150);}
  const press=async i=>{await p.evaluate(i=>{__pad.buttons[i].pressed=true;__pad.buttons[i].value=1;},i);await p.waitForTimeout(120);await p.evaluate(i=>{__pad.buttons[i].pressed=false;__pad.buttons[i].value=0;},i);await p.waitForTimeout(200);};
  const ok=await p.evaluate(()=>{const h=afUsable().find(x=>afBudget(x.k)>0&&afBaseN(x.k)>0);if(!h)return false;S.afK=h.k;S.baseSel=h.k;S.sel=null;
    const m=['afL','afS','afC'].find(m=>afModeN(h.k)[m]>0);if(!m)return false;S.mode=m;S.afPend=null;render();
    const t=(m==='afS'?afShipT(h.k):m==='afL'?afLandT(h.k):afStgT(h.k))[0];if(!t)return false;S.afPend={k:h.k,x:m==='afC'?{stg:t.id}:{u:t.id}};render();return true;});
  r.push([ok,'準備好出擊確認面板']);if(ok){
    r.push([await p.evaluate(()=>{const e=document.getElementById('afPend');return !!e&&!e.hidden;}),'確認面板顯示中']);
    await press(1);r.push([await p.evaluate(()=>!S.afPend&&S.mode!==null),'按 ○：取消已選的目標（仍在出擊模式）']);
    await press(1);r.push([await p.evaluate(()=>S.mode===null),'再按 ○：取消出擊，離開出擊模式']);}
  r.push(...noErr(p,'手把取消'));await p.close();return r;},true);
module.exports={T};
