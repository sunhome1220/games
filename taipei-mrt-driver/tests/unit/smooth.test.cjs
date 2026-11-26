// 軌道形狀要圓順：沿路每 4 m 的方向變化不該有折角（以前每 25 m 一個折點，會看到明顯的尖角）。node taipei-mrt-driver/tests/unit/smooth.test.cjs
const vm=require('vm'),fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','..','js');
const ctx=vm.createContext({console,Math,JSON,Object,Array,Number,String,Set,Map,Date,Infinity,RegExp});
vm.runInContext(`var G=null;var SET={line:'red',from:0,to:12,theme:'day',model:'C381',atpStrict:false,events:false,evRate:'mid',evOff:[],haptic:false,snd:false};${['haptic','hapRumble','beep','sfxNotch','sfxStop','playChime','chimeOpen','chimeClose','announce','syncLever','syncRevBtn','showResult','toast'].map(n=>`var ${n}=function(){};`).join('')}`,ctx);
for(const f of ['models.js','lines.js','events.js','sim.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f});
let pass=0,fail=0;const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));};
const r=JSON.parse(vm.runInContext(`(function(){const res={};for(const k of Object.keys(LINES)){const N=LINES[k].st.length;
 for(const rev of [false,true]){const g=buildRun(Object.assign({},SET,{line:k,from:rev?N-1:0,to:rev?0:N-1,model:'auto'}));
 const tot=g.S[g.S.length-1];let worst=0,over=0,prev=null,straightKink=0;
 for(let s=10;s<tot-10;s+=4){const a=pathPoint(g,s-2),b=pathPoint(g,s+2);if(Math.hypot(b[0]-a[0],b[1]-a[1])<0.5){prev=null;continue;}const h=Math.atan2(b[1]-a[1],b[0]-a[0]);
  if(prev!==null){let d=h-prev;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;d=Math.abs(d)*180/Math.PI;worst=Math.max(worst,d);if(d>3)over++;}prev=h;}
 res[k+(rev?'-rev':'')]={worst:+worst.toFixed(2),over};}}return JSON.stringify(res);})()`,ctx));
for(const k in r)ok(`${k}：任何 4 m 內方向變化 ≤ 6°（沒有折角）`,r[k].worst<=6,JSON.stringify(r[k]));
ok('紅／藍／綠線幾乎沒有超過 3°／4 m 的地方（真實小半徑彎道只在文湖線）',['red','blue','green'].every(k=>r[k].over<=2),JSON.stringify(['red','blue','green'].map(k=>r[k].over)));
// 平滑不能把形狀整個削掉：起訖點直線距離與平滑前相近（平滑只動彎處，不改大尺度）
const d=JSON.parse(vm.runInContext(`(function(){const g=buildRun(Object.assign({},SET,{line:'blue',from:0,to:22,model:'auto'}));const tot=g.S[g.S.length-1];const a=pathPoint(g,0),b=pathPoint(g,tot);const L=g.L;const raw0=L.shape[0],raw1=L.shape[L.shape.length-1];return JSON.stringify({sm:Math.hypot(b[0]-a[0],b[1]-a[1]),raw:Math.hypot(raw1[0]-raw0[0],raw1[1]-raw0[1])*L.shapeScale});})()`,ctx));
ok('平滑後起終點直線距離與原始形狀相差 < 3%',Math.abs(d.sm-d.raw)/d.raw<0.03,JSON.stringify(d));
console.log(`合計：通過 ${pass} 項、失敗 ${fail} 項`);process.exit(fail?1:0);
