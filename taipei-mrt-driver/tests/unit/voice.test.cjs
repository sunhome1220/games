// 語音挑選：同語言多個語音時，挑名稱較自然者；簡化／機械語音不被選中。node taipei-mrt-driver/tests/unit/voice.test.cjs
const vm=require('vm'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','..','js','broadcast.js'),'utf8');
const ctx=vm.createContext({console,Math,JSON,Object,Array,Set,Map,window:{},document:{getElementById:()=>null},LINES:{},SET:{},G:null});
vm.runInContext(src+';this.pick=bcPickVoice;this.score=bcVoiceScore;this.parts=bcEnParts;this.setV=v=>{BCV=v;};',ctx);
let pass=0,fail=0;const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));};
const V=(name,lang,local=true)=>({name,lang,localService:local});
let l=[V('Samantha','en-US'),V('Samantha (Enhanced)','en-US'),V('Fred','en-US')];
ok('有 Enhanced 版就選 Enhanced',ctx.pick(l,'en-us').name==='Samantha (Enhanced)');
l=[V('eSpeak English','en-US'),V('Google US English','en-US',false)];
ok('機械感語音（eSpeak）不如 Google 語音',ctx.pick(l,'en-us').name==='Google US English');
l=[V('Microsoft Hanhan','zh-TW'),V('Microsoft HsiaoChen Online (Natural)','zh-TW',false)];
ok('Microsoft Natural 優先',ctx.pick(l,'zh-tw').name.includes('Natural'));
ok('語言不符的不選',ctx.pick([V('Kyoko','ja-JP')],'en')===null);
ok('同分取第一個（保持原行為）',ctx.pick([V('A','zh-TW'),V('B','zh-TW')],'zh-tw').name==='A');
ok('lang 用底線也可比對',ctx.pick([V('A','zh_TW')],'zh-tw').name==='A');
// 淡水：英文語音唸 Tamsui 很怪，改用國語語音唸漢字
ctx.setV([V('Z','zh-TW'),V('E','en-US')]);
const tp=JSON.parse(JSON.stringify(ctx.parts('next',{name:'淡水',side:'L'},'Tamsui')));
ok('淡水用國語語音唸「淡水」（不再用英文語音唸 Tamsui）',tp.some(x=>x[0]==='zh'&&x[1]==='淡水')&&!tp.some(x=>/Tamsui/.test(x[1])&&x[0]==='en'),JSON.stringify(tp));
const ap=JSON.parse(JSON.stringify(ctx.parts('next',{name:'市政府',side:'L'},'Taipei City Hall')));
ok('原本全英文的站（市政府）不受影響',ap.some(x=>x[0]==='en'&&/City Hall/.test(x[1])));
console.log(`合計：通過 ${pass} 項、失敗 ${fail} 項`);process.exit(fail?1:0);
