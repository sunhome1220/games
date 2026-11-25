// 突發事件：時間與種類隨機、事件不會事先出現在路線圖／進度條／限速預告上。
// 執行：node taipei-mrt-driver/tests/unit/events.test.cjs（約 1 秒，不開瀏覽器）
const vm=require('vm'),fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','..','js'),root=path.join(__dirname,'..','..');
const ctx=vm.createContext({console,Math,JSON,Object,Array,Number,String,Set,Map,Date,Infinity});
vm.runInContext(`var G=null;var SET={line:'red',from:0,to:12,theme:'day',model:'C381',atpStrict:false,events:true,evRate:'mid',evOff:[],haptic:false};
${['haptic','hapRumble','beep','sfxNotch','sfxStop','playChime','chimeOpen','chimeClose','announce','syncLever','syncRevBtn','showResult'].map(n=>`var ${n}=function(){};`).join('')}
var envNow=function(){return 'elev';};`,ctx);
for(const f of ['models.js','lines.js','events.js','sim.js','routemap.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f});
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));};

// 1. 第一個事件的時間每班不同（中頻率：開車後 80～200 秒之間）
const firsts=[];for(let i=0;i<40;i++){run(`G=buildRun(Object.assign({},SET));`);firsts.push(run('G.nextEv'));}
const uniq=new Set(firsts.map(x=>Math.round(x))).size;
ok('第一個事件的時間每班不同',uniq>=30,`40 班中有 ${uniq} 種`);
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
ok('路線圖程式不讀事件狀態（g.ev／g.hz／g.hold／evLimit）',!/\bg\.(ev|hz|hold)\b|evLimit|\bG\.(ev|hz|hold)\b/.test(rm));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=html.indexOf('function drawStrip('),b=html.indexOf('\n}',a);const strip=html.slice(a,b);
ok('上方進度條不讀事件狀態',a>0&&!/\bg\.(ev|hz|hold)\b|evLimit/.test(strip));

console.log(`\n合計：通過 ${pass} 項、失敗 ${fail} 項`);
process.exit(fail?1:0);
