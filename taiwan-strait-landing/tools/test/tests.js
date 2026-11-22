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
  r.push([await p.evaluate(()=>/2026\/4\/1 白天/.test($('#phaseTitle').textContent)&&simDate(2)==='2026/4/1 夜間'&&simDate(3)==='2026/4/2 白天'&&simDate(24)==='2026/4/12 夜間'),'模擬日期：2026 年 4 月 1 日白天起，每 2 回合過 1 天（顯示在階段標題）']);
  r.push([await p.evaluate(()=>{const ref=S.units.find(u=>u.type==='cv')||S.units[0],n=t=>{const u=Object.assign({},ref,{type:t,side:'atk',hp:TYPES[t].hp,boundTo:null,ship:null,fl:undefined,mhp:undefined});const g=unitSVG(u,false);return [(g.match(/data-h="1"/g)||[]).length,(g.match(/class="ugh/g)||[]).length];};
    return ['lst','ro','cvy','ff','csg'].every(t=>!TYPES[t]||n(t)[0]===3)&&n('dd')[0]===2&&['cv','hk','ssn','d55','f54','amph','arm'].every(t=>!TYPES[t]||n(t)[0]===0)&&['lst','ro','dd','cv','csg'].every(t=>n(t)[1]===0);}),'棋子圖示：船形數＝船數（艦群／運輸船三艘、護航艦一對兩艘、單艦一艘大船），不疊卡片']);
  // 關卡判定：在已開局的一般對局上直接呼叫各關的 check()（不必真的開關卡、不必玩回合）
  const a=await p.evaluate(()=>{const cv=S.units.find(u=>u.type==='cv'&&u.side==='atk');const D=MISSION_DEFS.carrier,before=D.check();cv.hp=1;return [before,D.check()];});
  r.push([a[0]===null&&a[1]&&a[1].stars===3,'擊沉航艦：未重創時不過關；重創後第 1 回合 3 星']);
  r.push([!!a[1]&&/號|艦/.test(a[1].d)&&!/步|假設情境/.test(a[1].d+a[1].extra)&&/我方付出/.test(a[1].extra)&&/共軍損失/.test(a[1].extra)&&!/整個任務期間/.test(a[1].extra),'擊沉航艦結算：稱呼寫「遼寧艦／山東艦／福建艦」、不用「步」、沒有假設情境與整場任務統計，只有我方付出與共軍損失']);
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

add('極簡畫質：節點數、點選陸地與海面、設定與卡頓提醒','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1&ultra=1',{fast:true});const r=[];await L.startGame(p);await p.evaluate(()=>setZoom(1,true));await p.waitForTimeout(200);
  r.push([await p.evaluate(()=>ULTRA&&document.body.classList.contains('ultra')&&document.querySelectorAll('#map *').length<6000&&!document.querySelector('#map .tile,#map .tl-sh,#map .wv')),'極簡畫質：地圖節點 < 6,000、沒有立體地形與海浪（'+await p.evaluate(()=>document.querySelectorAll('#map *').length)+'）']);
  const lh=await p.evaluate(()=>{const g=document.querySelector('#gS').getScreenCTM(),el=document.querySelector('#map .tl-ul[data-sea="2"]');let n=0,ok=0;
    for(const h of Object.values(TER)){if(h.isl!=='TW'||(h.c*7+h.r*3)%11!==0)continue;const [x,y]=center(h.c,h.r),q=new DOMPoint(x,y).matrixTransform(g);n++;if(seaHexAt(el,q.x,q.y)===h.k)ok++;}return {n,ok};});
  r.push([lh.n>20&&lh.ok===lh.n,'極簡畫質：陸地格由座標反查（seaHexAt）全部正確 '+lh.ok+'／'+lh.n]);
  const pts=await p.evaluate(()=>{const g=document.querySelector('#gS').getScreenCTM(),out=[];
    for(const h of Object.values(TER)){if(h.t!=='sea'||h.isl||unitAt(h.k)||(h.c*7+h.r*3)%23!==0)continue;const [x,y]=center(h.c,h.r),q=new DOMPoint(x,y).matrixTransform(g);
      if(q.x>40&&q.x<innerWidth-40&&q.y>140&&q.y<innerHeight-60){const e=document.elementFromPoint(q.x,q.y);if(e&&e.closest('[data-sea]'))out.push({k:h.k,x:q.x,y:q.y});}}
    return out.slice(0,6);});
  let ok=0;for(const q of pts){await p.evaluate(()=>{S.hover=null;});await p.mouse.click(q.x,q.y);await p.waitForTimeout(60);if(await p.evaluate(k=>S.hover===k,q.k))ok++;}
  r.push([pts.length>=3&&ok===pts.length,'極簡畫質：點海面格反查正確 '+ok+'／'+pts.length]);
  const sw=await p.evaluate(()=>{setQual('normal');const n=document.querySelectorAll('#map *').length,t=!!document.querySelector('#map .tile'),st=localStorage.getItem('tsl-qual');setQual('ultra');return {n,t,st,u:document.querySelectorAll('#map *').length};});
  r.push([sw.n>20000&&sw.t&&sw.u<6000,'設定切換：一般 '+sw.n+' 節點（有立體地形）↔ 極簡 '+sw.u]);
  await p.evaluate(()=>{openSettings();});r.push([await p.evaluate(()=>!!document.querySelector('[data-qual="ultra"].on')&&!!document.querySelector('[data-qual="normal"]')),'設定視窗有「地圖畫質」選項']);
  r.push(...noErr(p,'極簡畫質'));await p.close();
  const q=await L.open(c.b,c.url,'?debug=1&ultra=0',{hide:true,jank:true});await L.startGame(q);await q.evaluate(()=>{__jank.JANK.warm=0;__jank.offer(40);});
  r.push([await q.evaluate(()=>{const b=document.getElementById('jankUl');if(!b)return false;b.click();return ULTRA&&localStorage.getItem('tsl-qual')==='ultra'&&FXOFF;}),'卡頓提醒的「極簡畫質」：切換並關閉動畫、記在裝置']);await q.close();return r;});

add('彈藥存量：雄二／雄三分開、面板用「枚」、協同出擊卡片隨批數連動','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:77});const r=[];
  await p.evaluate(()=>{$('#optEra').value='2030';$('#optEra').dispatchEvent(new Event('change'));});await L.startGame(p);
  const a=await p.evaluate(()=>{const P=S.pools,t0=asTot(),u=S.units.find(x=>x.type==='ssm'&&x.side==='def'&&!ssmHp(x)),mix0=asMix(),a0=P.rocAS,b0=P.rocAS3;ssmDraw(u,100);
    return {as:S.p0.rocAS,as3:S.p0.rocAS3,sum:t0,after:asTot(),m:mix0,ra:P.rocAS/a0,rb:P.rocAS3/b0,html:defLedgerBars()};});
  r.push([Math.abs(a.as-12.24)<.01&&Math.abs(a.as3-5.8)<.01,'2030 年庫存：雄二 '+a.as+' 點（約 '+Math.round(a.as*100)+' 枚）、雄三 '+a.as3+' 點（2026 年 7／3，每年 +131／+70 枚）']);
  r.push([Math.abs(a.sum-a.after-1)<1e-6&&Math.abs(a.ra-a.rb)<1e-3,'發射 100 枚：共扣 1 點、雄二與雄三按比例同降（'+(a.ra*100).toFixed(1)+'%／'+(a.rb*100).toFixed(1)+'%）']);
  r.push([/雄二（岸置/.test(a.html)&&/雄三（岸置/.test(a.html)&&/空射魚叉/.test(a.html)&&!/\d\.\d<small>/.test(a.html.replace(/<span class="abt">.*?<\/span>/g,''))&&!/[0-9]\.[0-9]/.test(a.html.replace(/style="[^"]*"/g,'')),'守方彈藥面板：雄二、雄三、空射魚叉分開，單位「枚」、沒有小數']);
  const f=await p.evaluate(()=>{const k=Object.keys(AF_ASM)[0];const t=S.units.find(x=>x.side==='atk'&&atSea(x)&&isShip(x));const base=afUsable().find(h=>afBudget(h.k)>0);if(!t||!base)return null;
    S.afK=base.k;S.afPend={k:base.k,x:{u:t.id},nb:1};const one=afPendInfo().html;S.afPend.nb=3;const three=afPendInfo().html;
    const L=h=>{const m=h.match(/預估損失約 ([0-9.]+) 架/);return m?+m[1]:0;};const N=h=>{const m=h.match(/（(\d) 批；剩/);return m?+m[1]:0;};
    return {l1:L(one),l3:L(three),n1:N(one),n3:N(three),max:coAirMax(base.k,t)};});
  r.push([!!f&&(f.max<3||(f.n3===3&&f.l3>=f.l1*1.5)),'協同出擊卡片：批數 1→3，預估損失與批數隨之增加 '+JSON.stringify(f)]);
  r.push(...noErr(p,'彈藥存量'));await p.close();return r;});

add('先由電腦推演 N 回合再接手、判定回合可選 16／24','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:15});const r=[];
  r.push([await p.evaluate(()=>[...$('#optT').options].map(o=>o.value).join()==='6,8,10,12,16,24'&&SETUP_PAGES.flatMap(x=>x.fields).find(f=>f.sel==='optT').opts['24']&&['optPre'].every(id=>CFG_IDS.includes(id)&&id in DEFAULT_CFG)),'判定回合有 16、24；先推演欄位已登記']);
  await p.evaluate(()=>{$('#optPre').value='3';$('#optPre').dispatchEvent(new Event('change'));});await L.startGame(p).catch(()=>{});
  await p.waitForFunction(()=>S.over||S.turn>=4&&S.ctrl.atk==='human',null,{timeout:90000}).catch(()=>{});
  const b=await p.evaluate(()=>({turn:S.turn,phase:S.phase,ctl:S.ctrl.atk+'/'+S.ctrl.def,pre:S.preAI,auto:S.simAuto,sp:S.speed,over:S.over,log:S.log.some&&S.log.some(x=>/由你接手/.test(typeof x==='string'?x:JSON.stringify(x)))}));
  r.push([!b.over&&b.turn===4&&b.phase==='atk'&&b.ctl==='human/ai'&&!b.pre&&!b.auto&&b.sp===1,'第 4 回合攻方階段：操作權交還給玩家，自動模式關閉 '+JSON.stringify(b)]);
  r.push(...noErr(p,'先推演'));await p.close();return r;});

add('棋子移動：連續滑動，時間依距離（遠的滑得久、超過 20 格不滑）','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{});const r=[];await L.startGame(p);
  const o=await p.evaluate(async()=>{const u=S.units.find(x=>x.side==='atk'&&(x.type==='amph'||x.type==='mar')&&alive(x)&&!x.ship&&hexOf(x).isl==='CN');
    const rc=[...reach(u)].filter(([k,v])=>v.kind==='sail').map(([k])=>[k,hd(hexOf(u),TER[k])]).sort((a,b)=>a[1]-b[1]);const near=rc[1],far=rc[rc.length-1];
    const dur=async(k)=>{const id=u.ship||u.id;humanMove(u,k,'sail');render();const sh=u.ship?S.units.find(x=>x.id===u.ship):u;const e=document.querySelector('#gD .u[data-id="'+u.id+'"]')||document.querySelector('#gD .u[data-id="'+(sh&&sh.id)+'"]');
      const a=e?e.getAnimations().filter(x=>x.effect.getKeyframes().some(f=>f.transform)):[];return a.length?a[0].effect.getTiming().duration:0;};
    const dFar=await dur(far[0]);return {far:far[1],dFar,farSlide:slideMs(far[1]*HPX),cap:HPX*20,slid:ANIM.slid,ms:ANIM.slidMs};});
  r.push([o.dFar>=300&&o.dFar<=1900&&Math.abs(o.dFar-o.farSlide)<o.farSlide*.1,'滑動時間 '+Math.round(o.dFar)+' ms（距離 '+o.far+' 格，公式 '+Math.round(o.farSlide)+' ms，300～1900 ms）']);
  r.push([await p.evaluate(()=>slideMs(HPX)===300&&slideMs(HPX*12)>800&&slideMs(HPX*40)===1900&&easeIO(.5)===.5&&easeIO(0)===0&&easeIO(1)===1),'時間公式：1 格 300 ms、12 格 >800 ms、上限 1,900 ms；先加速後減速']);
  r.push(...noErr(p,'棋子滑動'));await p.close();return r;});

add('開火後才移動的棋子：留在原地開火、播完才滑走（火力動畫不從空格冒出）','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{},);const r=[];await L.startGame(p);
  const o=await p.evaluate(()=>{const pick=()=>S.units.filter(x=>x.side==='def'&&x.type==='ssm'&&alive(x)).slice(0,2);const [a,b]=pick();if(!a||!b)return null;
    const mv=(u)=>{const h=hexOf(u),n=nbrs(h.c,h.r).find(q=>q&&isLand(q)&&!unitsAt(q.k).length&&q.k!==h.k);return n;};
    const na=mv(a),nb=mv(b);render();
    const t=S.units.find(x=>x.side==='atk'&&alive(x));
    FXQ.push({t:'msl',from:[a.c,a.r],to:[t.c,t.r],hit:false}); // a 在舊位置開火，之後移動
    a.c=na.c;a.r=na.r;b.c=nb.c;b.r=nb.r; // b 只是移動，沒有開火
    render();
    const d=u=>{const e=document.querySelector('#gD .u[data-id="'+u.id+'"]');const an=e?e.getAnimations().filter(x=>x.effect.getKeyframes().some(f=>f.transform)):[];return an.length?an[0].effect.getTiming():null;};
    const ta=d(a),tb=d(b);return {a:ta&&{delay:ta.delay,fill:ta.fill},b:tb&&{delay:tb.delay},slid:ANIM.slid,fw:FIRE_WAIT};});
  r.push([!!o&&o.a&&o.a.delay>=o.fw*.9&&o.a.fill==='backwards','從舊位置開火的棋子：滑動延遲 '+(o&&o.a&&Math.round(o.a.delay))+' ms（先開火再滑走）']);
  r.push([!!o&&o.b&&o.b.delay===0,'只移動、沒有開火的棋子：立刻滑動、不延遲']);
  r.push(...noErr(p,'開火後移動'));await p.close();return r;});

add('地圖實際尺寸 ×2（百分比範圍不變）','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true});const r=[];await L.startGame(p);
  const o=await p.evaluate(()=>{const w=document.querySelector('.mapwrap'),m=$('#map');setZoom(3,true);const a=m.getBoundingClientRect().width/w.clientWidth;setZoom(1.5,true);const b=m.getBoundingClientRect().width/w.clientWidth;
    const lim=[];setZoom(100);lim.push(ZOOM);setZoom(.01);lim.push(ZOOM);setZoom(3,true);return {a,b,ex:3*ZB*EXT,ex2:1.5*ZB*EXT,lim,ZB,lab:$('#zLabel').textContent};});
  r.push([o.ZB===2&&Math.abs(o.a-o.ex)<.02&&Math.abs(o.b-o.ex2)<.02,'300% 時地圖寬 '+o.a.toFixed(2)+' 倍視窗（舊版 '+(o.ex/2).toFixed(2)+'，現 ×2）']);
  r.push([o.lim.join()==='10,0.8'&&o.lab==='300%','百分比範圍不變：最大 1000%、最小 80%、預設 300% '+o.lim.join('／')]);
  r.push(...noErr(p,'地圖尺寸'));await p.close();return r;});

add('「攻擊」鈕：循環顯示反艦／對地火力的攻擊範圍，同類合併外框','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true});const r=[];await L.startGame(p);
  const st=()=>p.evaluate(()=>({n:document.querySelectorAll('#map .rr').length,masks:document.querySelectorAll('#map mask').length,leg:[...document.querySelectorAll('#rngLeg span')].map(x=>x.textContent).join('|'),on:document.getElementById('btnRngA').getAttribute('aria-pressed'),lab:document.querySelector('#btnRngA .bl').textContent,ls:localStorage.getItem('tsl-rnga')}));
  const n0=await st();await p.click('#btnRngA');await p.waitForTimeout(300);const a=await st();
  r.push([n0.n===0&&a.n>=2&&a.on==='true'&&a.lab===' 反艦'&&/雄風 160 km/.test(a.leg)&&!/海馬士/.test(a.leg)&&a.masks>=1&&a.ls==='1','第 1 下「反艦」：只畫反艦飛彈範圍，同類合併外框（'+a.masks+' 組遮罩）：'+a.leg.slice(0,50)]);
  await p.click('#btnRngA');await p.waitForTimeout(300);const b2=await st();
  r.push([b2.lab===' 對地'&&/海馬士火箭 80 km/.test(b2.leg)&&!/雄風/.test(b2.leg)&&b2.ls==='2','第 2 下「對地」：只畫海馬士、雷霆：'+b2.leg]);
  await p.click('#btnRngA');await p.waitForTimeout(300);const c3=await st();
  r.push([c3.n===0&&c3.on==='false'&&c3.lab===' 攻擊'&&c3.ls==='0','第 3 下：關閉']);
  r.push(...noErr(p,'攻擊範圍'));await p.close();return r;});

add('電腦攻方護航艦：沒有運輸船時退回大陸港口，有運輸船就貼近','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:12});const r=[];await L.startGame(p);
  const o=await p.evaluate(async()=>{const ports=Object.values(TER).filter(h=>h.t==='port'&&h.isl==='CN');const dP=u=>Math.min(...ports.map(q=>hd(hexOf(u),q)));
    const dd=S.units.find(u=>u.side==='atk'&&u.type==='dd'&&alive(u));const tw=Object.values(TER).find(h=>h.isl==='TW'&&h.t==='sea');
    const seaNear=Object.values(TER).filter(h=>h.t==='sea'&&!h.isl&&hd(h,TER[S.units.find(u=>u.side==='atk'&&u.type==='cv'&&alive(u))?hexOf(S.units.find(u=>u.type==='cv')).k:TER['26,26'].k])<=60).slice(0,1);
    // 把護航艦放到海峽中間（離大陸港口約 10 格以上），海上沒有運輸船
    const mid=Object.values(TER).filter(h=>h.t==='sea'&&!h.isl&&dP({c:h.c,r:h.r,hex:h})>0).map(h=>[h,Math.min(...ports.map(q=>hd(h,q)))]).filter(x=>x[1]>=10&&x[1]<=14&&!unitsAt(x[0].k).length)[0][0];
    dd.c=mid.c;dd.r=mid.r;dd.moved=false;dd.acted=false;S.units.filter(u=>u.side==='atk'&&!isShip(u)&&atSea(u)).forEach(u=>{u.c=ports[0].c;u.r=ports[0].r;});
    const before=dP(dd);await aiAtkEscort(dd,{h:hexOf(dd)});const after=dP(dd);return {before,after};});
  r.push([o.after<o.before,'海上沒有己方運輸船：護航艦朝大陸港口退（距離 '+o.before+' → '+o.after+' 格）']);
  r.push(...noErr(p,'護航艦待命'));await p.close();return r;});

add('護航艦棋子資訊卡：列出 052D 與 054A 各自的數字','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:3});const r=[];await L.startGame(p);
  const o=await p.evaluate(()=>{const u=S.units.find(x=>x.type==='dd'&&x.side==='atk'&&alive(x));const st=[];stNaval(u,hexOf(u),st);const a=SHIPW.d52,b=SHIPW.f54;return {t:st.join('|'),sum:[a.ad+b.ad===DDW.ad,a.chan+b.chan===DDW.chan]};});
  r.push([/052D 防空彈 48 枚/.test(o.t)&&/054A 防空彈 32 枚/.test(o.t)&&/合計 80 枚、同時接戰 6 枚/.test(o.t)&&o.sum[0]&&o.sum[1],'資訊卡列出 052D 48／054A 32、合計 80（等於棋子的防空數字）']);
  r.push(...noErr(p,'護航艦資訊卡'));await p.close();return r;});

add('滾裝船團依旅型有船數：輕型 4、重型 10，每少一艘旅按比例損失、返航按剩餘船數補回運力','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:8});const r=[];await L.startGame(p);
  const o=await p.evaluate(()=>{const port=Object.values(TER).find(h=>h.t==='port'&&h.isl==='CN');S.pools.plaLst=0;S.pools.plaLift=20;S.roReserve=0;
    const mk=type=>{const u=S.units.find(x=>x.side==='atk'&&x.type===type&&alive(x)&&!x.ship);u.c=port.c;u.r=port.r;embark(u,port);return [u,shipOf(u)];};
    const out={};
    let [u,sh]=mk('amph');out.light={hp:sh.hp,mhp:sh.mhp,b:u.hp};damage(sh,1,'t');out.l1={ship:sh.hp,brig:u.hp};damage(sh,1,'t');out.l2={ship:sh.hp,brig:u.hp};damage(sh,2,'t');out.l4={shipGone:!S.units.includes(sh),brigGone:!S.units.includes(u)};
    [u,sh]=mk('arm');out.heavy={hp:sh.hp,mhp:sh.mhp,b:u.hp};const b0=u.hp;for(let i=0;i<3;i++)damage(sh,1,'t');out.h3={ship:sh.hp,brig:u.hp,b0};damage(sh,1,'t');out.h4={ship:sh.hp,brig:u.hp};
    // 返航：兩個剩 5／10 的滾裝船團回港，才補回 1 個運力
    S.pools.plaLift=3;S.liftBack={};S.roFrac=0;const t0=S.turn,mkr=()=>{const x=mkUnit('atk','ro',port.k,{hp:5,mhp:10});x.ret=true;x.retT=t0-1;S.units.push(x);return x;};
    mkr();S.turn=t0+1;liftTurn();const a1=Object.values(S.liftBack).reduce((a,b)=>a+b,0);
    mkr();liftTurn();const a2=Object.values(S.liftBack).reduce((a,b)=>a+b,0);
    out.ret={a1,a2};return out;});
  r.push([o.light.hp===4&&o.light.mhp===4&&o.heavy.hp===10&&o.heavy.mhp===10,'輕型旅船團 '+o.light.hp+'／'+o.light.mhp+' 艘、重型旅 '+o.heavy.hp+'／'+o.heavy.mhp+' 艘']);
  r.push([o.l1.ship===3&&o.l1.brig===o.light.b&&o.l2.ship===2&&o.l2.brig===o.light.b-1,'輕型：打掉 1 艘旅仍滿（0.75 步），打掉 2 艘旅 −1 步（共 1.5 步）']);
  r.push([o.l4.shipGone&&o.l4.brigGone,'輕型：船全沉，船上的旅一併損失']);
  r.push([o.h3.ship===7&&o.h3.brig===o.h3.b0&&o.h4.ship===6&&o.h4.brig===o.h3.b0-1,'重型：打掉 3 艘旅仍滿（0.9 步），第 4 艘旅 −1 步（1.2 步）']);
  r.push([o.ret.a1===0&&o.ret.a2===1,'返航補回運力：第 1 個剩 5／10 補 0（累計 0.5），第 2 個再補 1（累計 1.0） '+JSON.stringify(o.ret)]);
  r.push(...noErr(p,'滾裝船團船數'));await p.close();return r;});

add('外圍北側：舟山在真實位置、城市地標名稱','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true});const r=[];
  const o=await p.evaluate(()=>{const f=FAR['舟山'],q=FAR['路橋'],t=document.querySelector('#gX');
    const isl=[...OFINE.values()].filter(h=>h.t==='plain').map(h=>rcToLL(h.c,h.r)).filter(([lo,la])=>la>29.5&&la<30.6&&lo>121.7&&lo<122.6).length;
    const south=[...OFINE.values()].filter(h=>h.t==='plain').map(h=>rcToLL(h.c,h.r)).filter(([lo,la])=>la>26.2&&la<27&&lo>120&&lo<120.8).length;
    return {sz:[f.lon,f.lat,!f.schem],lq:[q.lon,q.lat,!q.schem],isl,south,cities:[...document.querySelectorAll('#gX .city')].map(e=>e.textContent).join(),lab:[...document.querySelectorAll('#gX .far-lbl')].map(e=>e.textContent).filter(x=>/（/.test(x)).join()};});
  r.push([o.sz[2]&&Math.abs(o.sz[1]-30.05)<.1&&o.lq[2]&&o.isl>=5&&o.south===0,'舟山在真實位置（30.05°N、122.25°E），群島 '+o.isl+' 格；東引上方不再有假的大島 '+o.south]);
  r.push([o.cities==='上海,杭州,金華'&&/寧波/.test(o.lab)&&/台州/.test(o.lab)&&/溫州/.test(o.lab),'城市地標：'+o.cities+'；機場旁註明 '+o.lab]);
  r.push(...noErr(p,'外圍北側'));await p.close();return r;});

add('平潭島 3 格＋兩座橋（只畫圖）','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true});const r=[];
  const o=await p.evaluate(()=>{const pt=Object.values(TER).filter(h=>h.pt);const ll=pt.map(h=>rcToLL(h.c,h.r));const span=[Math.max(...ll.map(x=>x[1]))-Math.min(...ll.map(x=>x[1])),Math.max(...ll.map(x=>x[0]))-Math.min(...ll.map(x=>x[0]))];
    return {n:pt.length,land:pt.every(h=>h.isl==='CN'&&h.t!=='sea'),port:pt.some(h=>h.name==='平潭'&&h.t==='port'),span,brg:document.querySelectorAll('#gS .brg .bk').length,lbl:[...document.querySelectorAll('#gS .brg text')].map(e=>e.textContent).join(),conn:(()=>{const k=Object.values(TER).filter(h=>h.pt)[0];return nbrs(k.c,k.r).some(n=>n&&n.pt);})()};});
  r.push([o.n===3&&o.land&&o.port&&o.span[0]>=.14&&o.conn,'平潭島 '+o.n+' 格（南北 '+(o.span[0]*111).toFixed(0)+' km 的格中心跨度，彼此相鄰，含港口格）']);
  r.push([o.brg===2&&o.lbl==='公鐵大橋,跨海大橋','地圖上畫了兩座橋：'+o.lbl]);
  r.push([await p.evaluate(()=>{const t=document.querySelector('#gS .brg .brgl');if(!t)return false;const lo=(setZoom(3,true),getComputedStyle(t).display==='none'),hi=(setZoom(10,true),getComputedStyle(t).display!=='none'),fs=+t.getAttribute('font-size');setZoom(3,true);return lo&&hi&&fs<5;}),'橋的名稱字很小，只在放到最大（≥900%）時才顯示']);
  r.push(...noErr(p,'平潭'));await p.close();return r;});

add('平潭的橋：地面部隊可走橋往返島上','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:4});const r=[];await L.startGame(p);
  const o=await p.evaluate(()=>{const out={n:BRIDGES.length,br:BRIDGES.map(x=>x.n+':'+x.a+'→'+x.b)};
    const put=(u,k)=>{const h=TER[k];u.c=h.c;u.r=h.r;u.moved=false;u.acted=false;u.ship=null;S.units.filter(x=>x!==u&&x.c===h.c&&x.r===h.r).forEach(x=>{x.c=0;x.r=0;});};
    const arm=S.units.find(x=>x.side==='atk'&&x.type==='arm'&&alive(x)),inf=S.units.find(x=>x.side==='atk'&&x.type==='amph'&&alive(x));
    const B=BRIDGES[0],B2=BRIDGES[1];[B.b,B2.b,B.a,B2.a].forEach(k=>S.units.filter(x=>x!==arm&&x!==inf&&x.c===TER[k].c&&x.r===TER[k].r).forEach(x=>{x.c=0;x.r=0;}));
    put(arm,B.a);let rc=reach(arm);out.armToIsland=rc.has(B.b)&&rc.get(B.b).kind==='move';
    put(inf,B2.a);rc=reach(inf);out.infToIsland=rc.has(B2.b)&&rc.get(B2.b).kind==='move';
    put(inf,B2.b);rc=reach(inf);out.back=rc.has(B2.a)&&rc.get(B2.a).kind==='move';
    out.dist=[hd(TER[B.a],TER[B.b]),hd(TER[B2.a],TER[B2.b])];
    // 不是橋的另一端：不能一步走到島上
    const far=Object.values(TER).find(h=>h.isl==='CN'&&h.t!=='sea'&&!h.pt&&hd(h,TER[B.b])>=8&&!BRIDGE_NB[h.k]);put(inf,far.k);out.farNo=!reach(inf).has(B.b);
    return out;});
  r.push([o.n===2,'有兩座橋：'+o.br.join('、')]);
  r.push([o.armToIsland&&o.infToIsland&&o.back,'重型旅、兩棲旅可從大陸端走橋到島上，再走回來（橋距 '+o.dist.join('、')+' 格）']);
  r.push([o.farNo,'離橋很遠的大陸格不能一步走到島上']);
  r.push(...noErr(p,'平潭橋'));await p.close();return r;});

add('共軍長程火箭陣地（平潭、長樂、石獅）：可被打擊，受損則長程火箭波數下降','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:9});const r=[];await L.startGame(p);
  const o=await p.evaluate(()=>{const ids=Object.keys(CNB).filter(k=>CNB[k].kind==='rkt');const out={ids:ids.join(),known:ids.every(k=>S.cn[k]===CNB[k].hp)};
    const w=()=>{computeFire();const m=S.fireNote.match(/長程火箭 (\d+) 波/);return m?+m[1]:-1;};
    S.msl.rkt=1440;out.w0=w();S.cn.pingtanR=0;out.w1=w();out.share=cnShare('rkt');out.val=cnValue('pingtanR');S.cn.pingtanR=3;
    out.inList=Object.keys(CNB).filter(k=>CNB[k].kind==='rkt').every(k=>typeof KIND_N[CNB[k].kind]==='string');return out;});
  r.push([o.ids==='pingtanR,changleR,shishiR'&&o.known,'三處長程火箭陣地：'+o.ids]);
  r.push([o.w0===60&&o.w1===40&&Math.abs(o.share-2/3)<1e-6,'完整時每回合 '+o.w0+' 波；平潭陣地癱瘓後 '+o.w1+' 波（3 處平均分擔 ★）']);
  r.push(...noErr(p,'長程火箭陣地'));await p.close();return r;});

add('首頁：選戰役模式或關卡挑戰','medium',async c=>{const r=[];
  const raw=await c.b.newPage({viewport:{width:1200,height:900}});const errs=[];raw.on('pageerror',e=>errs.push(e.message));
  await raw.goto(c.url,{timeout:60000});await raw.waitForTimeout(900);
  const a=await raw.evaluate(()=>({show:!document.getElementById('home').hidden,on:document.body.classList.contains('onhome'),vis:getComputedStyle(document.querySelector('.app')).visibility,t:document.querySelector('#home h1').textContent,btns:[...document.querySelectorAll('#home .hm-card')].map(b=>b.querySelector('b').textContent).join()}));
  r.push([a.show&&a.on&&a.vis==='hidden'&&a.btns==='戰役模式,關卡挑戰','開啟（沒有網址參數）：顯示首頁，兩個選項「'+a.btns+'」，後面的遊戲畫面先藏起來']);
  await raw.click('#hmMission');
  const m=await raw.evaluate(()=>[...document.querySelectorAll('#homeIn a.hm-card')].map(a=>a.getAttribute('href')+':'+a.querySelector('b').textContent).join());
  r.push([m==='?mission=carrier:擊沉航艦,?mission=port:72 小時奪港'||/carrier/.test(m)&&/port/.test(m),'關卡挑戰：列出所有關卡 '+m]);
  await raw.click('#hmBack');await raw.click('#hmCampaign');
  const b=await raw.evaluate(()=>({hid:document.getElementById('home').hidden,on:document.body.classList.contains('onhome'),vis:getComputedStyle(document.querySelector('.app')).visibility,ss:sessionStorage.getItem('tsl-home'),wz:!!document.querySelector('#wzNext')}));
  r.push([b.hid&&!b.on&&b.vis==='visible'&&b.ss==='1'&&b.wz,'選戰役模式：首頁關閉、顯示設定精靈，這個分頁不再顯示首頁']);
  await raw.reload();await raw.waitForTimeout(700);
  r.push([await raw.evaluate(()=>document.getElementById('home').hidden),'同一分頁重新載入（例如切換語言）：不再顯示首頁']);
  await raw.close();
  const p2=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true});r.push([await p2.evaluate(()=>document.getElementById('home').hidden),'網址有 debug／nojank 等參數（測試、關卡）：不顯示首頁']);await p2.close();
  r.push([!errs.length,'首頁：沒有頁面錯誤 '+JSON.stringify(errs)]);return r;});

add('海面點選與游標移入（反查格子）','medium',async c=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true});const r=[];await L.startGame(p);await p.evaluate(()=>setZoom(1,true));await p.waitForTimeout(200); // 預設 300% 畫面內海格太少，縮到 100% 再取樣
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

add('卡頓偵測：連續兩次慢才提醒、四個按鈕','medium',async c=>{const r=[];
  const feed=(p,ms,n)=>p.evaluate(([ms,n])=>{window.__jank.eval(Array(n).fill(ms));return !!document.getElementById('jankCard');},[ms,n]);
  let p=await L.open(c.b,c.url,'?debug=1',{hide:true,jank:true});await L.startGame(p);await p.evaluate(()=>{__jank.JANK.warm=0;});
  r.push([!(await feed(p,16,40)),'順暢（16 ms）：不提醒']);r.push([!(await feed(p,80,40)),'第一次慢：還不提醒']);r.push([!(await feed(p,16,40)),'接著順暢：計數歸零']);
  r.push([!(await feed(p,80,10)),'樣本太少（10 筆）：不算']);await feed(p,80,40);r.push([await feed(p,80,40),'連續兩次慢（80 ms，約 12 fps）：跳出提醒']);
  r.push([await p.evaluate(()=>document.querySelectorAll('#jankCard button').length===4&&/關閉動畫/.test(document.getElementById('jankCard').textContent)),'提醒有四個按鈕（含極簡畫質）']);
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

add('四川艦（076 型）：2027 年起、載陸戰隊、海上機降','medium',async c=>{const r=[];
  const play=async era=>{const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:5});await p.evaluate(e=>{$('#optEra').value=e;$('#optEra').dispatchEvent(new Event('change'));},era);await L.startGame(p);return p;};
  let p=await play('2026');r.push([await p.evaluate(()=>!S.units.some(u=>u.lha||u.lhaMar)),'2026 年：沒有四川艦']);await p.close();
  p=await play('2027');
  const o=await p.evaluate(()=>{const sh=S.units.find(u=>u.lha),m=S.units.find(u=>u.lhaMar);if(!sh||!m)return null;const rc=reach(m),k={},bound=sh.boundTo===m.id&&m.ship===sh.id;for(const v of rc.values())k[v.kind]=(k[v.kind]||0)+1;
    const n0=S.units.filter(u=>u.lha).length,pool0=S.pools.plaLst;const dk=[...rc].find(([kk,v])=>v.kind==='drop');let d=null;
    if(dk){doMove(m,dk[0],'drop');d={landed:!isShip(m)&&hexOf(m).isl!=='CN'&&!atSea(m),unbound:!m.ship&&!sh.boundTo,shipStays:S.units.some(u=>u.lha),pool:S.pools.plaLst===pool0};}
    return {names:uname(sh)+'／'+uname(m),n:S.units.filter(u=>u.lha).length,bound,kinds:k,hp:m.hp,d};});
  r.push([!!o&&o.n===1&&o.bound,'2027 年：1 艘四川艦載著一個陸戰隊空中突擊營（'+(o&&o.names)+'）']);
  r.push([!!o&&o.kinds.drop>0&&o.kinds.sail>0&&o.hp===1,'陸戰隊可從海上機降（'+(o&&o.kinds.drop)+' 個落點）、也能隨艦航行；1 步＝約 1/4 個旅']);
  r.push([!!o&&!!o.d&&o.d.landed&&o.d.unbound&&o.d.shipStays&&o.d.pool,'機降後：陸戰隊上岸、艦留在海上、不回兩棲艦群運力池 '+JSON.stringify(o&&o.d)]);
  r.push(...noErr(p,'四川艦'));await p.close();return r;});

add('飛彈突防特性：魚叉、雄二亞音速，雄三超音速','medium',async c=>{const r=[];
  const p=await L.open(c.b,c.url,'?debug=1',{fast:true,hide:true,seed:5});await L.startGame(p);
  const o=await p.evaluate(()=>{const f=n=>{const q=mslProf(n);return [+q.ch.toFixed(2),+q.pk.toFixed(2)];};
    const t=S.units.find(u=>u.type==='cv'&&u.side==='atk'),ads=()=>S.units.filter(e=>e.side==='atk'&&alive(e)&&(isEsc(e)||e.type==='dd'));
    const snap=()=>ads().map(e=>({e,ad:e.mag&&e.mag.ad,chU:e.chU,chT:e.chT,eng:e.engN,cpU:e.cpU,cpT:e.cpT,t:t.chU,tT:t.chT})),back=sn=>sn.forEach(x=>{if(x.e.mag)x.e.mag.ad=x.ad;x.e.chU=x.chU;x.e.chT=x.chT;x.e.engN=x.eng;x.e.cpU=x.cpU;x.e.cpT=x.cpT;t.chU=x.t;t.chT=x.tT;});
    const run=(prof)=>{const sn=snap(),a=salvoCalc(t,8,false,'tst',prof);back(sn);return +a.surv.toFixed(2);};
    return {harpoon:f('魚叉'),hf2:f('雄二'),hf3:f('雄三'),yj83:f('鷹擊-83'),yj18:f('鷹擊-18'),mix:f({'雄二':.5,'雄三':.5}),cover:adCover(t).length,
      surv:{'魚叉':run('魚叉'),'雄二':run('雄二'),'雄三':run('雄三'),'鷹擊-18':run('鷹擊-18'),none:run(undefined)}};});
  r.push([o.harpoon[0]===1&&o.harpoon[1]===1&&o.hf2[0]===1&&o.hf2[1]===1,'魚叉、雄二（亞音速）：通道與攔截率係數都是 1（與舊版相同）']);
  r.push([o.hf3[0]<.6&&o.hf3[1]<1&&o.hf3[1]>.8,'雄三（超音速）：接戰通道約 '+o.hf3[0]+'、單枚攔截率 ×'+o.hf3[1]]);
  r.push([o.yj18[0]<o.hf3[0]&&o.yj18[1]<o.hf3[1]&&o.yj83[0]>o.hf3[0]&&o.yj83[0]<1,'鷹擊-18（末端 Mach 3）比雄三更難攔；鷹擊-83（末端衝刺）介於中間（通道 '+o.yj83[0]+'）']);
  r.push([o.mix[0]>o.hf3[0]&&o.mix[0]<1,'混合（雄二、雄三各半）介於兩者之間：通道 '+o.mix[0]]);
  r.push([o.cover>0&&o.surv['雄三']>o.surv['魚叉']&&o.surv['鷹擊-18']>o.surv['雄三']&&o.surv['魚叉']===o.surv['雄二']&&o.surv.none===o.surv['魚叉'],'8 枚打有防空的航艦，突破數期望值：魚叉＝雄二＝預設 '+o.surv['魚叉']+' ＜ 雄三 '+o.surv['雄三']+' ＜ 鷹擊-18 '+o.surv['鷹擊-18']]);
  r.push([await p.evaluate(()=>{const ro=S.units.find(u=>u.type==='ro')||{type:'ro'},cv=S.units.find(u=>u.type==='cv'&&u.side==='atk');return seekOf(ro)===.9&&seekOf({type:'cvy'})===.9&&seekOf(cv)===.8&&SALVO.pSeekEW===.6;}),'無護航防空的滾裝船、補給船：尋標命中率 0.9；軍艦 0.8、有護航干擾 0.6']);
  r.push(...noErr(p,'飛彈突防'));await p.close();return r;});

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
