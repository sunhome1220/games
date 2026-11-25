// 突發事件：時間與種類隨機、事件不會事先出現在路線圖／進度條／限速預告上。
// 執行：node taipei-mrt-driver/tests/unit/events.test.cjs（約 1 秒，不開瀏覽器）
const vm=require('vm'),fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','..','js'),root=path.join(__dirname,'..','..');
const ctx=vm.createContext({console,Math,JSON,Object,Array,Number,String,Set,Map,Date,Infinity});
vm.runInContext(`var G=null;var SET={line:'red',from:0,to:12,theme:'day',model:'C381',atpStrict:false,events:true,evRate:'mid',evOff:[],haptic:false};
${['haptic','hapRumble','beep','sfxNotch','sfxStop','playChime','chimeOpen','chimeClose','announce','syncLever','syncRevBtn','showResult'].map(n=>`var ${n}=function(){};`).join('')}
var envNow=function(){return 'elev';};var toast=function(){};`,ctx);
for(const f of ['models.js','lines.js','events.js','sim.js','routemap.js','radio.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f});
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));};

// 1. 第一個事件的時間每班不同（中頻率：開車後 80～200 秒之間）
const firsts=[];for(let i=0;i<40;i++){run(`G=buildRun(Object.assign({},SET));`);firsts.push(run('G.nextEv'));}
const uniq=new Set(firsts.map(x=>Math.round(x))).size;
ok('第一個事件的時間每班不同（40 班至少 20 種不同值；隨機重複是正常的）',uniq>=20,`40 班中有 ${uniq} 種`);
ok('時間落在設定範圍內（80～200 秒）',firsts.every(x=>x>=80&&x<=200),`${Math.min(...firsts).toFixed(0)}～${Math.max(...firsts).toFixed(0)} 秒`);

// 2. 事件種類隨機（同一個位置、同樣條件，觸發 200 次）
const kinds={};
for(let i=0;i<200;i++){
  run(`G=buildRun(Object.assign({},SET));G.state='run';G.pos=G.S[1]+200;G.k=2;G.v=20;G.time=G.nextEv+1;`);
  run('evTick(G,1/60)');const id=run('G.ev&&G.ev.id');if(id)kinds[id]=(kinds[id]||0)+1;
}
ok('事件種類隨機（同一位置觸發 200 次出現多種）',Object.keys(kinds).length>=4,JSON.stringify(kinds));

// 3. 事件發生前：沒有任何事件留下的限速、停止信號或軌道上的人
run(`G=buildRun(Object.assign({},SET));G.state='run';G.pos=G.S[1]+200;G.k=2;G.v=20;G.time=1;`);
ok('事件發生前沒有預先設定的限速、停止信號或障礙物',run('G.ev===null&&G.hold===null&&G.hz===null&&evLimit(G)===Infinity'));
const before=run('JSON.stringify(nextLimit(G))');

// 4. 事件發生後，路線圖的限速預告也不會出現事件（事件只在發生當下以畫面上方的警示與 ATP 限速呈現）
run(`G.time=G.nextEv+1;evStart(G,'signal');`);
ok('事件已發生（號誌異常）',run("G.ev&&G.ev.id==='signal'&&G.hold!==null"));
ok('路線圖／限速預告不顯示事件',run('JSON.stringify(nextLimit(G))')===before);

// 5. 原始碼檢查：路線圖與上方進度條只讀固定的限速區間，不讀事件狀態
const rm=fs.readFileSync(path.join(dir,'routemap.js'),'utf8');
// 例外：手機橫握時「事件已經發生之後」暫時隱藏路線圖（那一行含 visibility／busy）；除此之外不得讀事件狀態，否則可能預先洩漏事件
const rmChecked=rm.split('\n').filter(l=>!/visibility|busy/.test(l)).join('\n');
ok('路線圖程式不讀事件狀態（g.ev／g.hz／g.hold／evLimit；僅「事件發生後暫時隱藏」例外）',!/\bg\.(ev|hz|hold)\b|evLimit|\bG\.(ev|hz|hold)\b/.test(rmChecked));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=html.indexOf('function drawStrip('),b=html.indexOf('\n}',a);const strip=html.slice(a,b);
ok('上方進度條不讀事件狀態',a>0&&!/\bg\.(ev|hz|hold)\b|evLimit/.test(strip));


// 6. 行控無線電：7 種事件各有一段通話，內容與事件的數值一致，且不把遊戲設計說成真實用語
{
  const ids=['quake','wind','trespass','doorfault','signal','power','trainfault'];
  let allOk=true,detail=[];
  for(const id of ids){
    run(`G=buildRun(Object.assign({},SET));G.state='run';G.pos=G.S[1]+200;G.k=2;G.v=20;G.time=G.nextEv+1;`);
    run(`G.ev=null;evStart(G,'${id}')`);
    const t=run(`ocText(G,'${id}',G.ev)`),e=JSON.parse(run('JSON.stringify(G.ev)'));
    detail.push(id+':'+t.length);
    if(!t||t.length<20||!t.startsWith('行控呼叫')||/undefined|NaN|\[object/.test(t))allOk=false;
    if(id==='quake'&&!(t.includes('震度 '+e.level)&&t.includes(String(e.lim))))allOk=false;
    if(id==='wind'&&!t.includes(String(e.lim)))allOk=false;
    if(id==='power'&&!t.includes(String(run('G.evLim'))))allOk=false;
    if(id==='doorfault'&&!t.includes('第 '+e.car+' 節'))allOk=false;
    if(id==='trainfault'&&!(t.includes(String(run('G.evLim')))&&t.includes(run("G.stations[G.k].name.replace('/','、')"))))allOk=false;
  }
  ok('7 種事件各有一段行控通話，數值與事件一致',allOk,detail.join(' '));
  const src=fs.readFileSync(path.join(dir,'radio.js'),'utf8');
  ok('radio.js 檔頭標明通話內容是遊戲設計、非北捷實際用語',/遊戲設計/.test(src)&&/不是北捷實際/.test(src));
  run(`G=buildRun(Object.assign({},SET));G.state='run';G.pos=G.S[1]+200;G.k=2;G.v=20;G.time=G.nextEv+1;`);
  ok('通話稱呼含路線名稱',run("ocText(G,'signal',{})").includes(run('G.L.name')));
}


// 7. 新事件（依 2014 中時、2025 知新聞）：乘客緊急對講、軌道異物、豪大雨
{
  const fresh=(opt)=>run(`SET.events=true;G=buildRun(Object.assign({},SET,{line:'blue',from:0,to:15,model:'321'}));G.state='run';G.pos=G.S[1]+300;G.k=2;G.v=${(opt&&opt.v)||18};G.time=${(opt&&opt.time)||5};G.ev=null;1`);
  const steps=(n,body)=>run(`for(let i=0;i<${Math.round(n*60)};i++){${body||''}step(1/60);}1`);
  // 7a. 乘客緊急對講：乘客還在（接聽）
  fresh();run("evStart(G,'intercom');G.ev.left=false;G.ic.left=false;G.ev.scn='medical';evIcAct(G,G.ev);");
  ok('對講：事件開始、顯示監視螢幕、提供「接聽」',run("G.ev.id==='intercom'&&!!G.ic&&G.evAct.label.includes('接聽')&&G.ic.car>=1&&G.ic.car<=G.L.cars"));
  run('G.evAct.fn()');ok('接聽後：確認狀況並提供「回報行控」',run("G.ev.phase==='report'&&G.evAct.label.includes('回報行控')"));
  run('G.evAct.fn()');ok('回報後：等待下一站交接',run("G.ev.phase==='handover'&&G.evAct===null"));
  run('G.cur=G.cur+1;evTick(G,1/60)');ok('下一站停車開門後事件完成並加分',run("G.ev===null&&G.evLog.length===1&&G.evLog[0].outcome==='ok'&&G.evLog[0].pts>0"));
  ok('事件結束後監視螢幕與按鈕清除',run('G.ic===null&&G.evAct===null'));
  // 7b. 乘客按完就離開：逐節檢視
  fresh();run("evStart(G,'intercom');G.ev.left=true;G.ic.left=true;G.ev.scn='item';G.ev.car=4;G.ic.car=4;G.ic.view=0;evIcAct(G,G.ev);");
  const labels=[run('G.evAct.label')];let presses=0;
  while(run('G.ev.phase')==='ring'&&presses<10){run('G.evAct.fn()');presses++;if(run('G.ev.phase')==='ring')labels.push(run('G.evAct.label'));}
  ok('逐節檢視：按到第 4 節才找到（共按 4 次），標籤依序更新',presses===4&&labels.join('|')==='📹 檢視車廂 1/6|📹 檢視車廂 2/6|📹 檢視車廂 3/6|📹 檢視車廂 4/6'&&run("G.ev.phase==='report'&&G.ic.view===4"),labels.join(' → '));
  // 7c. 誤觸：確認後直接結束
  fresh();run("evStart(G,'intercom');G.ev.left=false;G.ic.left=false;G.ev.scn='mistake';evIcAct(G,G.ev);G.evAct.fn();");
  ok('誤觸：接聽確認後直接完成，不需回報',run("G.ev===null&&G.evLog[0].outcome==='ok'"));
  // 7d. 太久沒反應：逾時
  fresh();run("evStart(G,'intercom');G.ev.left=false;G.ic.left=false;evIcAct(G,G.ev);");steps(65,'');
  ok('對講：60 秒沒有回應 → 逾時（late、不扣分）',run("G.ev===null&&G.evLog[0].outcome==='late'&&G.evLog[0].pts===0"));

  // 7e. 軌道異物：停車→通報→授權→下車排除→低速通過
  fresh();run("evStart(G,'debris')");
  ok('異物：前方軌道出現異物、限速 45',run("G.ev.id==='debris'&&G.hz.kind==='debris'&&G.hz.pos>G.pos&&G.evLim===45"));
  steps(40,'setNotch(-5);if(G.ev&&G.ev.phase!=="approach")break;');
  ok('在異物前停妥 → 提供「通報行控」',run("G.ev&&G.ev.phase==='stopped'&&G.evAct.label.includes('通報')&&G.pos<G.hz.pos-3"),run('G.pos<G.hz.pos?(G.hz.pos-G.pos).toFixed(0)+" m":"已越過"'));
  run('G.evAct.fn()');steps(7,'setNotch(0);');
  ok('通報 6 秒後行控授權 → 提供「下車排除異物」',run("G.ev.phase==='ready'&&G.evAct.label.includes('排除')"));
  run('G.evAct.fn()');ok('排除中：列車被扣住不能起步',run("G.ev.phase==='clearing'&&G.evHold>0"));
  steps(11,'');ok('10 秒後異物清除、限速 25',run("G.hz===null&&G.ev.phase==='resume'&&G.evLim===25"));
  run('G.pos+=200');steps(0.1,'');ok('通過異物位置後事件完成並加分',run("G.ev===null&&G.evLog[0].outcome==='ok'&&G.evLog[0].pts>0"));
  // 7f. 沒有停車：越過異物
  fresh();run("evStart(G,'debris')");steps(40,'setNotch(0);if(G.ev&&G.ev.phase==="fail")break;');
  ok('不停車：越過異物 → 行控接管（強制緊急煞車）',run("G.ev&&G.ev.phase==='fail'&&G.evForceEB===true"));
  steps(30,'');ok('停下後事件失敗扣 25 分',run("G.ev===null&&G.evLog[0].outcome==='fail'&&G.evLog[0].pts===-25"));

  // 7g. 豪大雨：限速降低、煞車效果變差、ATP 曲線提早
  const stopDist=(rain)=>{fresh({v:15});run(`G.pos=100;G.k=9;if(${rain}){evStart(G,'rain');G.evLim=null;G.evRamp=null;}setNotch(-5);`);const p0=run('G.pos');for(let i=0;i<60*120&&run('G.v')>0.01;i++)run('step(1/60)');return run('G.pos')-p0;};
  const dDry=stopDist(false),dWet=stopDist(true);
  ok('豪大雨：同樣 B5 煞車，停車距離變長（約 1/0.75 倍）',dWet>dDry*1.2&&dWet<dDry*1.5,`乾 ${dDry.toFixed(0)} m、雨 ${dWet.toFixed(0)} m`);
  fresh();run("evStart(G,'rain')");
  ok('豪大雨：開始時限速 50、煞車效率 0.75、下雨畫面',run("G.ev.id==='rain'&&G.evLim===50&&G.evBrake===0.75&&G.rain===true&&G.evWindOnly===true"));
  const lim=(rain)=>{fresh({v:15});run(`${rain?"evStart(G,'rain');G.evLim=null;":''}G.pos=G.S[2]-200;G.k=2;`);return run('atpLimit(G)');};
  ok('豪大雨：進站前 ATP 限速曲線提早（同一位置限速較低）',lim(true)<lim(false),`${lim(false).toFixed(0)} → ${lim(true).toFixed(0)} km/h`);
  steps(95,'');ok('90 秒後豪大雨結束、煞車效率恢復',run("G.ev===null&&G.evBrake===1&&G.rain===false"));
  // 7h. 行控通話稿
  fresh();run("evStart(G,'rain')");
  ok('豪大雨與軌道異物有行控通話稿，乘客對講沒有',run("ocText(G,'rain',G.ev).includes('50')&&ocText(G,'debris',{}).includes('異物')&&ocText(G,'intercom',{})===''"));
  // 7i. 新聞出處
  ok('新事件都附新聞出處與處置建議，且標明遊戲設計的部分',['intercom','debris','rain'].every(id=>run(`EV_INFO['${id}'].news.length>40&&EV_INFO['${id}'].tip.length>20`))&&run("EV_INFO.intercom.tip.includes('遊戲中')&&EV_INFO.debris.tip.includes('遊戲簡化')&&EV_INFO.rain.tip.includes('遊戲設定')"));
  ok('事件共 10 種',run('EV_ORDER.length')===10);
}

console.log(`\n合計：通過 ${pass} 項、失敗 ${fail} 項`);
process.exit(fail?1:0);
