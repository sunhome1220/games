// 模擬核心單元測試：不開瀏覽器，用 Node 的 vm 載入 js/models.js、js/lines.js、js/events.js、js/sim.js（畫面與聲音的副作用以空函式取代；事件引擎用真的，但 SET.events=false 不會觸發事件）。
// 執行：node taipei-mrt-driver/tests/unit/sim.test.cjs（約 1 秒）
const vm=require('vm'),fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','..','js');
const ctx=vm.createContext({console,Math,JSON,Object,Array,Number,String,Set,Map,Date,Promise,isNaN});
const noop='function(){}';
vm.runInContext(`
var G=null;var SET={line:'red',from:0,to:5,theme:'day',model:'C381',atpStrict:false,events:false,haptic:false};
${['haptic','hapRumble','beep','sfxNotch','sfxStop','playChime','chimeOpen','chimeClose','announce','syncLever','syncRevBtn','showResult','toastExt'].map(n=>`var ${n}=${noop};`).join('')}
`,ctx);
for(const f of ['models.js','lines.js','events.js','sim.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f});
const run=code=>vm.runInContext(code,ctx);
let pass=0,fail=0;
const ok=(n,c,x)=>{if(c)pass++;else fail++;console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));};
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
const newRun=(o)=>run(`G=buildRun(Object.assign({},SET,${JSON.stringify(o||{})}));G.state='run';1`);
const stepN=(sec)=>run(`for(let i=0;i<${Math.round(sec*60)};i++)step(1/60);1`);

// 1. 關卡建立
newRun({line:'red',from:0,to:5,model:'C381'});
let g=JSON.parse(run(`JSON.stringify({n:G.stations.length,S:G.S,tA:G.tArr,tD:G.tDep,z:G.zones,M:G.M.id,k:G.k})`));
ok('建立關卡：6 站、站位遞增、第一站在 0',g.n===6&&g.S[0]===0&&g.S.every((x,i)=>i===0||x>g.S[i-1]),g.S.join());
ok('時刻表：抵達遞增、離站晚於抵達',g.tA.every((x,i)=>i===0||x>g.tA[i-1])&&g.tD.every((x,i)=>x>=g.tA[i]));
ok('限速區間在站間、數值為 45／60',g.z.every(z=>z.s1>z.s0&&z.s0>=0&&z.s1<=g.S[g.S.length-1]&&(z.lim===45||z.lim===60)));
ok('指定車型被採用',g.M==='C381');
newRun({line:'blue',from:10,to:3,model:'321'});
g=JSON.parse(run(`JSON.stringify({S:G.S,n:G.stations.length})`));
ok('反向關卡（起點大於終點）站位仍遞增',g.n===8&&g.S.every((x,i)=>i===0||x>g.S[i-1]));

// 2. 主控器
newRun({line:'red',from:0,to:5,model:'C381'});
run(`setNotch(99)`);ok('檔位上限 P4',run('G.notch')===4);
run(`setNotch(-99)`);ok('檔位下限 EB 並記錄使用過 EB',run('G.notch')===-8&&run('G.ebUsed')===true);
run(`setNotch(1.4)`);ok('檔位四捨五入',run('G.notch')===1);

// 3. 物理
function accelAt(notch,sec){newRun({line:'red',from:0,to:5,model:'C381'});run(`G.state='run';setNotch(${notch})`);stepN(sec);return run('G.v');}
const vP1=accelAt(1,4),vP4=accelAt(4,4);
ok('P4 比 P1 加速快',vP4>vP1*1.8,`P1=${vP1.toFixed(2)} P4=${vP4.toFixed(2)} m/s`);
ok('4 秒 P4 的速度接近車型加速度（≈1 m/s²，受加加速度限制略低）',vP4>2.5&&vP4<=4.1,vP4.toFixed(2));
function stopDist(notch,v0){newRun({line:'red',from:0,to:5,model:'C381'});run(`G.v=${v0};G.pos=100;G.lim=999;setNotch(${notch})`);const p0=run('G.pos');for(let i=0;i<60*120&&run('G.v')>0.01;i++)run('step(1/60)');return run('G.pos')-p0;}
// ATP 超速保護會介入，這裡用低速（20 m/s = 72 km/h，區間內沒有限速時 ATP 不會跳）
const dB7=stopDist(-7,15);
ok('B7 煞停距離 ≈ v²/(2a)（a≈1.0 m/s²，容許 ±25%）',near(dB7,15*15/2,15*15/2*0.25),dB7.toFixed(1)+' m');
const dEB=stopDist(-8,15);
ok('EB 煞停距離比 B7 短',dEB<dB7*0.9,`EB=${dEB.toFixed(1)} B7=${dB7.toFixed(1)}`);
const dB1=stopDist(-1,10);
ok('B1 比 B7 慢很多（同速度下煞停距離長）',dB1>stopDist(-7,10)*2);

// 4. ATP 限速曲線
newRun({line:'red',from:0,to:5,model:'C381'});
run(`G.pos=0`);const limStart=run('atpLimit(G)');
ok('起步時限速（站間無限速）不超過車型上限',limStart<=run('G.M.vmax')+1e-9);
const S1=run('G.S[1]');
const lims=[400,200,100,40,10,2].map(d=>{run(`G.pos=${S1}-${d}`);return run('atpLimit(G)');});
ok('接近站時 ATP 限速單調遞減',lims.every((x,i)=>i===0||x<=lims[i-1]),lims.map(x=>x.toFixed(0)).join('→'));
ok('距停車線 2 m 時限速已很低（<25 km/h）',lims[5]<25);
run(`G.pos=100;G.hold=130`);const lh=run('atpLimit(G)');run(`G.hold=100.2`);const lh0=run('atpLimit(G)');run(`G.hold=null`);
ok('停止信號前限速遞減，到信號為 0',lh<run(`G.M.vmax`)&&lh0===0,`${lh.toFixed(0)} / ${lh0}`);

// 5. ATP 動作與復歸（寬鬆／嚴格）
function tripScenario(strict){
  run(`SET.atpStrict=${strict}`);newRun({line:'red',from:0,to:5,model:'C381'});
  run(`G.state='run';G.pos=${Math.round(run('G.S[1]')-3000)>0?run('G.S[1]')-3000:0};G.v=100/3.6;`); // 先給一個遠超過限速的速度（站間限速區間 or 超過 ATP 曲線）
  run(`G.zones=[{s0:G.pos+100,s1:G.pos+600,lim:45}];setNotch(2)`);
  let tripped=false;for(let i=0;i<60*8;i++){run('step(1/60)');if(run('G.trip')){tripped=true;break;}}
  return tripped;
}
ok('超速一段時間後 ATP 動作',tripScenario(false)===true);
// 動作後把手把回 N；寬鬆：速度降到限速以下就復歸，不必停車
run(`setNotch(0)`);let released=false,vAtRelease=null;
for(let i=0;i<60*60;i++){run('step(1/60)');if(!run('G.trip')){released=true;vAtRelease=run('G.v');break;}}
ok('寬鬆：手把回 N，速度降到限速以下即復歸（停車前）',released&&vAtRelease>0.5,`v=${vAtRelease&&vAtRelease.toFixed(1)} m/s`);
tripScenario(true);run(`setNotch(0)`);
let relStrict=false,movingRelease=false;
for(let i=0;i<60*90;i++){run('step(1/60)');if(!run('G.trip')){relStrict=true;movingRelease=run('G.v')>0.05;break;}}
ok('嚴格：必須完全停車後才復歸',relStrict&&!movingRelease);
run(`SET.atpStrict=false`);

// 6. 計分
newRun({line:'red',from:0,to:5,model:'C381'});
const sc=(e,dtm,sa,eb,pen)=>run(`G.pos=G.S[1]-(${e});G.arrTime=G.tArr[1]+(${dtm});G.lastStop={a:${sa}};G.ebUsed=${!!eb};G.segPen=${pen||0};scoreArrival(G,1)`);
const a0=sc(0.3,0,0.2),a1=sc(1.5,0,0.2),a2=sc(5,0,0.2),a3=sc(-5,0,0.2);
ok('停車誤差越大，停車分越低（0.3 m=100、1.5 m=85、5 m=40）',a0.acc===100&&a1.acc===85&&a2.acc===40,[a0.acc,a1.acc,a2.acc].join());
ok('衝過線超過 2 m 另扣 10 分（−5 m=30）',a3.acc===30);
ok('準點：±10 秒內滿分，晚 100 秒只剩 20',sc(0,5,0.2).pun===100&&sc(0,100,0.2).pun===20);
ok('舒適：殘餘減速度越大分越低，用過 EB 再扣 15',sc(0,0,0.0).com===100&&sc(0,0,0.4).com<sc(0,0,0.0).com&&sc(0,0,0.2,true).com===sc(0,0,0.2).com-15);
ok('總分 = 停車×0.5＋準點×0.25＋舒適×0.25−扣分，且不低於 0',sc(0,0,0).score===100&&sc(0,0,0,false,999).score===0);

// 7. 車門
newRun({line:'red',from:0,to:5,model:'C381'});
run(`G.v=5;G.pos=G.S[1]`);run(`openDoors('L')`);
ok('行進中不能開門',run('G.doors.state')==='closed');
run(`G.v=0;G.pos=G.S[1]-300`);run(`openDoors('L')`);
ok('不在月台範圍不能開門',run('G.doors.state')==='closed');
const side=run('G.stations[1].side'),wrong=side==='L'?'R':'L';
run(`G.v=0;G.pos=G.S[1]-0.2`);run(`openDoors('${wrong}')`);
ok('開錯邊：不開門、扣 3 分、記一次違規',run('G.doors.state')==='closed'&&run('G.segPen')===3&&run('G.pen.door')===1);
run(`openDoors('${side}')`);
ok('正確的門側：開門、記錄本站成績、前往下一站',run('G.doors.state')==='opening'&&run('G.results.length')===1&&run('G.k')===2);
run(`closeDoors()`);ok('開門未滿最少停留時間不能關門',run('G.doors.state')!=='closing');

// 8. 決定性：同樣輸入（固定車型與天色）產生同樣的站位與限速區間
newRun({line:'green',from:2,to:9,model:'C371'});const A=run('JSON.stringify([G.S,G.zones])');
newRun({line:'green',from:2,to:9,model:'C371'});const B=run('JSON.stringify([G.S,G.zones])');
ok('同一關卡兩次建立結果相同',A===B);

console.log(`\n合計：通過 ${pass} 項、失敗 ${fail} 項`);
process.exit(fail?1:0);
