// 外籍旅客求助英語題：正確答案與遊戲資料一致、四個選項不重複、各等級的難度限制（預設國小五年級）。
// 執行：node taipei-mrt-driver/tests/unit/quiz.test.cjs（不開瀏覽器）
const vm=require('vm'),fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','..','js');
const ctx=vm.createContext({console,Math,JSON,Object,Array,Number,String,Set,Map,Date,Infinity,RegExp});
vm.runInContext(`var G=null;var SET={line:'red',from:0,to:12,theme:'day',model:'C381',atpStrict:false,events:true,evRate:'mid',evOff:[],haptic:false,snd:true};
${['haptic','hapRumble','beep','sfxNotch','sfxStop','playChime','chimeOpen','chimeClose','announce','syncLever','syncRevBtn','showResult','toast'].map(n=>`var ${n}=function(){};`).join('')}`,ctx);
for(const f of ['models.js','lines.js','events.js','sim.js','quiz.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f});
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));};
// 固定種子亂數
let seed=12345;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
ctx.__rnd=rnd;
const setRun=(line,from,to,k)=>run(`G=buildRun(Object.assign({},SET,{line:'${line}',from:${from},to:${to},model:'auto'}));G.state='run';G.k=${k};1`);
const LV=['g3','g5','g8'];
const banned={g3:/terminat|transfer|bound|counting|destination|apolog/i,g5:/terminat|transfer|bound|counting|destination|apolog/i,g8:null};
const wc=t=>t.trim().split(/\s+/).length;
// 1. 大量隨機：每個等級、每條線、正反向、不同位置
const stat={n:0,bad:[],types:{},byLevel:{g3:{q:0,o:0,n:0},g5:{q:0,o:0,n:0},g8:{q:0,o:0,n:0}}};
const lines=JSON.parse(run('JSON.stringify(Object.keys(LINES).map(k=>[k,LINES[k].st.length]))'));
for(const [line,N] of lines){
  for(const [from,to] of [[0,N-1],[N-1,0],[2,Math.min(N-1,12)],[Math.min(N-1,14),3]]){
    for(const k of [1,2,3]){
      setRun(line,from,to,k);
      const S=JSON.parse(run('JSON.stringify(G.stations.map(s=>({name:s.name,idx:s.idx,side:s.side})))')),EN=JSON.parse(run('JSON.stringify(G.stations.map(s=>G.L.en[s.idx]||s.name))'));
      if(k>=S.length)continue;
      for(const lv of LV)for(let rep=0;rep<6;rep++){
        const q=run(`fqMake(G,__rnd,null,'${lv}')`);stat.n++;
        if(!q){stat.bad.push(`${line} ${from}→${to} k${k} ${lv}：沒有題目`);continue;}
        stat.types[lv+':'+q.type]=(stat.types[lv+':'+q.type]||0)+1;
        const L=stat.byLevel[lv];L.q+=wc(q.en);L.o+=q.opts.reduce((a,b)=>a+wc(b),0)/4;L.n++;
        const A=q.opts[q.ans];
        const nm=o=>o.replace(/^.*?(?:station is |goes to |get off at |terminates at )/i,'').replace(/\.$/,'');   // 選項裡的站名（精確比對；站名可能互相包含，例如 Zhongshan／Zhongshan Junior High School）
        const bad=m=>stat.bad.push(`${line} ${from}→${to} k${k} ${lv} ${q.type}：${m}`);
        if(new Set(q.opts).size!==4||q.opts.length!==4)bad('選項不是 4 個不重複');
        if(/undefined|NaN|\[object/.test(q.en+q.opts.join(' ')+q.exp))bad('文字含 undefined');
        if(q.type==='next'){ if(nm(A)!==EN[k]||q.opts.filter(o=>nm(o)===EN[k]).length!==1)bad('下一站答案不對'); }
        else if(q.type==='door'){const side=S[k].side==='L'?'left':'right',other=side==='left'?'right':'left';if(!A.toLowerCase().includes(side)||A.toLowerCase().includes(other)||/both|no doors|not open/i.test(A))bad('車門側答案不對：'+A);}
        else if(q.type==='end'){const last=EN[EN.length-1];if(nm(A)!==last)bad('終點答案不對');if(q.opts.filter(o=>nm(o)===last).length!==1)bad('終點選項重複含終點');}
        else if(q.type==='transfer'){
          const tk=Object.keys({red:1,blue:1,green:1,brown:1}).find(key=>({red:'Red Line',blue:'Blue Line',green:'Green Line',brown:'Brown Line'})[key]&&q.en.includes(({red:'Red Line',blue:'Blue Line',green:'Green Line',brown:'Brown Line'})[key]));
          const j=S.findIndex((s,i)=>i>=k&&EN[i]===nm(A));
          const onT=j>=0&&JSON.parse(run(`JSON.stringify(LINES['${tk}'].st.includes(G.stations[${j}].name))`));
          const first=S.findIndex((s,i)=>i>=k&&JSON.parse(run(`JSON.stringify(LINES['${tk}'].st.includes(G.stations[${i}].name))`)));
          if(!tk||!onT||first!==j)bad(`轉乘答案不對（路線 ${tk}、答案站 ${j}、最近轉乘站 ${first}）`);
          // 錯誤選項不可也是可轉乘的站
          const wrongT=q.opts.some((o,i)=>i!==q.ans&&S.some((s,x)=>EN[x]===nm(o)&&JSON.parse(run(`JSON.stringify(LINES['${tk}'].st.includes(G.stations[${x}].name))`))));
          if(wrongT)bad('錯誤選項也是可轉乘站');
        }
        else if(q.type==='count'){
          const qs=(q.en.match(/(?:stops to|until) (.+?)\?/)||[])[1],j=S.findIndex((s,i)=>i>k&&EN[i]===qs);const stops=j-k+1,num=parseInt(A);
          if(j<0||num!==stops)bad(`站數答案不對（題目站 ${j}，應為 ${stops}，答案 ${num}）`);
        }
        // 等級難度限制
        if(banned[lv]&&banned[lv].test(q.en+' '+q.opts.join(' ')))bad('含超出等級的字：'+q.en+' / '+q.opts.join(' | '));
        const ENs=EN.slice().sort((a,b)=>b.length-a.length);const strip=t=>ENs.reduce((a,e)=>a.split(e).join(''),t);   // 先去掉較長的站名，避免短站名把長站名切碎      // 去掉站名（來自資料，不算在等級內）
        const words=strip(q.en+' '+q.opts.join(' ')).replace(/[^A-Za-z' ]/g,' ').split(/\s+/).filter(Boolean);
        if(lv!=='g8'&&words.some(w=>w.length>9))bad('有超過 9 個字母的單字：'+words.filter(w=>w.length>9).join(','));
        if(lv==='g3'&&!['next','door','end'].includes(q.type))bad('g3 不該有 '+q.type);
        if(lv==='g3'&&wc(q.en)>8)bad('g3 題目太長：'+q.en);
        if(lv==='g5'&&wc(q.en)>16)bad('g5 題目太長：'+q.en);
        if(lv!=='g8'&&q.opts.some(o=>wc(strip(o))>7))bad('選項太長：'+q.opts.join(' | '));
      }
    }
  }
}
ok(`隨機 ${stat.n} 題（3 等級×4 條線×正反向×多個位置）：正確答案都與遊戲資料一致、4 個選項不重複、符合等級限制`,stat.bad.length===0&&stat.n>500,stat.bad.slice(0,3).join(' ； ')||`題數 ${stat.n}`);
ok('g5 五種題型都會出現（next／door／transfer／end／count）',['next','door','transfer','end','count'].every(t=>stat.types['g5:'+t]>0),JSON.stringify(Object.fromEntries(Object.entries(stat.types).filter(([k])=>k.startsWith('g5')))));
ok('g3 只有 next／door／end 三種',Object.keys(stat.types).filter(k=>k.startsWith('g3:')).every(k=>['g3:next','g3:door','g3:end'].includes(k)));
const avg=lv=>stat.byLevel[lv].q/stat.byLevel[lv].n;
ok('難度遞增：題目平均字數 g3 < g5 < g8',avg('g3')<avg('g5')&&avg('g5')<avg('g8'),['g3','g5','g8'].map(l=>avg(l).toFixed(1)).join(' < '));
// 2. 預設等級與設定
setRun('blue',0,12,2);
ok('預設等級是 g5（國小五年級）',run('FQ_DEFAULT_LEVEL')==='g5'&&run("SET.fqLevel=undefined;fqMake(G,__rnd).level")==='g5');
ok('設定 SET.fqLevel 會改變出題等級',run("SET.fqLevel='g3';fqMake(G,__rnd).level")==='g3'&&run("SET.fqLevel='g8';fqMake(G,__rnd).level")==='g8');
ok('未知等級退回預設（不會壞掉）',run("SET.fqLevel='zzz';fqMake(G,__rnd).level")==='g5');
run("SET.fqLevel='g5'");
// 3. 擴充性：新增一個等級只要加表項，出題與選單都會帶出
run("FQ_LEVELS.g6={name:'測試',note:'x',types:['next'],intro:['Hi.'],next:{q:()=>'Next stop?',o:e=>'It is '+e+'.'}};SET.fqLevel='g6';1");
const q6=run("fqMake(G,__rnd)");
ok('新增等級（只加一個表項）立即可用',q6&&q6.level==='g6'&&q6.en==='Hi. Next stop?'&&q6.opts.every(o=>/^It is /.test(o)));
run("delete FQ_LEVELS.g6;SET.fqLevel='g5'");
// 4. 沒有語音環境：fqSpeak 不丟錯、回傳 false
ok('fqSpeak 在沒有語音支援時回傳 false、不丟錯',run("fqSpeak('hello')")===false);
// 4b. 答對不再出同題；答錯會再問，直到答對
setRun('red',0,12,1);
const qa=run("fqMake(G,__rnd,'next','g5')");
run("FQ_WRONG.length=0;FQ_DONE.clear();1");
ctx.__q=qa;run("fqMark(__q,false)");
ok('答錯：放進再問清單、不算已完成',run('FQ_WRONG.length')===1&&run('FQ_DONE.size')===0);
let again=0;for(let i=0;i<60;i++){const q=run("fqMake(G,__rnd,'next','g5')");if(q&&q.en===qa.en)again++;}
ok('答錯的題目之後會再被問到',again>=10,String(again));
ctx.__q=qa;run("fqMark(__q,true)");
ok('答對：移出再問清單、記為已完成',run('FQ_WRONG.length')===0&&run('FQ_DONE.size')===1);
let rep=0;for(let i=0;i<200;i++){const q=run("fqMake(G,__rnd,'next','g5')");if(q&&q.en===qa.en)rep++;}
ok('答對的題目不再出現（200 次）',rep===0,String(rep));
run("FQ_DONE.clear();FQ_WRONG.length=0;1");
// 5. 檔頭誠實聲明
const src=fs.readFileSync(path.join(dir,'quiz.js'),'utf8');
ok('quiz.js 檔頭標明「程度是粗估、不是教育部課綱字表對照」與「題型措辭分數是遊戲設計」',/不是教育部課綱字表/.test(src)&&/遊戲設計/.test(src));
console.log(`\n合計：通過 ${pass} 項、失敗 ${fail} 項`);
process.exit(fail?1:0);
