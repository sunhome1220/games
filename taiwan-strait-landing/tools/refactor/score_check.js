// 重構前後比對：用固定亂數種子跑 4 場電腦推演，輸出分數與戰報、單位的雜湊值；重構前後輸出必須完全相同。
// 用法：node tools/refactor/score_check.js > before.txt（改完再跑一次 > after.txt，diff 兩個檔）
const {chromium}=require('playwright');
const CFGS=[{optEra:'2026',optFx:'interest'},{optEra:'2030',optFx:'none'},{optEra:'2028',optFx:'full',optSide:'def'},{optEra:'2032',optFx:'interest',optBuild:'surprise'}];
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const out=[];
for(const [i,cfg] of CFGS.entries()){
 const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(i=>{let s=1234+i*77;Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};const st=window.setTimeout;window.setTimeout=(f,t,...a)=>st(f,0,...a);try{localStorage.clear()}catch(e){}},i);
 await pg.goto('file://'+require('path').resolve(__dirname,'../../index.html')+'?debug=1');await pg.waitForTimeout(500);
 const r=await pg.evaluate(c=>window.__score(c),cfg);
 out.push(JSON.stringify(r)+(errs.length?' ERR '+errs[0]:''));await pg.close();}
console.log(out.join('\n'));await b.close();})();
