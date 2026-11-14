'use strict';
/* ---------- statistics: many simulated games ---------- */
const STAT={running:false,cancel:false};
function pct(a,b){return b?Math.round(a/b*100):0;}
function wilson(k,n){if(!n)return [0,0];const z=1.96,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-h),Math.min(1,c+h)];}
function quant(a,q){if(!a.length)return 0;const b=a.slice().sort((x,y)=>x-y),i=(b.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return b[lo]+(b[hi]-b[lo])*(i-lo);}
function hitSrc(side){ // 某一方承受的損失，依來源分類：台灣自己、美軍、日軍、地面戰鬥、其他
  const o={TW:0,US:0,JP:0,GND:0,OTH:0};S.hits.forEach(h=>{if(h.side!==side)return;const w=h.why,f=S.fx.units.find(x=>x.n===w);
    if(f)o[f.c==='US'?'US':'JP']+=h.n;else if(/反艦飛彈|守方|無人機|飽和|海空攻擊/.test(w))o.TW+=h.n;else if(w==='地面戰鬥'||w==='空降損失')o.GND+=h.n;else o.OTH+=h.n;});return o;}
function allyShare(){const a=hitSrc('atk'),t=a.TW+a.US+a.JP+a.GND+a.OTH;return t>0?(a.US+a.JP)/t:0;} // 攻方損失中有多少是美日造成的
function collectRun(){
  const cs=conditions(),n=cs.filter(c=>c.atk).length,R=S.result||{side:n>=2?'atk':'def',n},c=costSummary(),ev={};
  S.events.forEach(e=>{if(e.choice)ev[e.id]=e.choice;});
  const src=hitSrc;
  return {srcA:src('atk'),srcD:src('def'),lim:!!R.limited,win:R.side==='atk'&&!R.limited,draw:R.side==='draw',n:R.n,early:!!R.early,tp:cs[0].atk,pt:cs[1].atk,fo:cs[2].atk,milA:c.mil.atk.n,milD:c.mil.def.n,civ:c.civ.TW,mkt:c.mkt,us:S.fx.lv.US,usPost:usIdx(),usRet:S.us.hist.some(h=>h.retreat),ev,end:R.ending,sA:R.scoreA,sD:R.scoreD};
}
function statBar(label,p,cls){return '<div class="sbar"><span>'+label+'</span><i><em class="'+(cls||'')+'" style="width:'+p+'%"></em></i><b>'+p+'%</b></div>';}
function statsHTML(rows){
  const N=rows.length,W=rows.filter(r=>r.win).length,[lo,hi]=wilson(W,N);
  const range=(k,f)=>{const a=rows.map(r=>r[k]),lo=quant(a,.1),hi=quant(a,.9);return '平均約 '+f(a.reduce((x,y)=>x+y,0)/N)+(Math.abs(hi-lo)<1e-6?'（每局都相同，已到模型上下限）':'（八成的局落在 '+f(lo)+' ～ '+f(hi)+'）');};
  const grp=(key,labelOf)=>{const m={};rows.forEach(r=>{const k=labelOf(r);if(k===undefined)return;(m[k]=m[k]||[]).push(r);});return Object.entries(m).map(([k,a])=>({k,n:a.length,w:a.filter(r=>r.win).length}));};
  const tables=[];let best=null;
  [['timing','發起時機'],['strike','先制打擊重點'],['mobilize','守方動員方針'],['final','最後攻勢']].forEach(([id,name])=>{
    const g=grp(id,r=>r.ev[id]);if(g.length<2)return;
    tables.push('<tr><td colspan="3"><b>'+name+'</b></td></tr>'+g.sort((a,b)=>b.n-a.n).map(x=>'<tr><td>'+x.k+'</td><td>'+x.n+' 局</td><td>攻方勝率 '+pct(x.w,x.n)+'%'+(x.n<8?'<span class="dd">（樣本少）</span>':'')+'</td></tr>').join(''));
    const ok=g.filter(x=>x.n>=8);if(ok.length>=2){const hiG=ok.reduce((a,b)=>pct(a.w,a.n)>=pct(b.w,b.n)?a:b),loG=ok.reduce((a,b)=>pct(a.w,a.n)<=pct(b.w,b.n)?a:b),gap=pct(hiG.w,hiG.n)-pct(loG.w,loG.n);
      if(!best||gap>best.gap)best={name,gap,hi:hiG,lo:loG};}
  });
  const us=grp('us',r=>LV.US[r.us]),up=grp('usPost',r=>r.usPost<0?'未介入':pn(r.usPost,$('#optFx').value));
  const takeaways=[];
  takeaways.push(W/N>=.6?'這組設定對攻方有利：約 '+pct(W,N)+'% 的局攻方達成勝利條件。':W/N<=.25?'這組設定對守方有利：攻方只有約 '+pct(W,N)+'% 的局達成勝利條件。':'這組設定雙方互有勝負：攻方約 '+pct(W,N)+'% 的局獲勝。');
  const cond=[['首都台北',rows.filter(r=>r.tp).length],['主要港口',rows.filter(r=>r.pt).length],['島上戰力',rows.filter(r=>r.fo).length]].sort((a,b)=>a[1]-b[1]);
  {const av=(side,k)=>rows.reduce((x,r)=>x+r[side][k],0)/N,f1=v=>v.toFixed(1);
   takeaways.push('損失來源（每局平均'+(plainT()?'受創次數':'步數')+'）：攻方共 '+f1(['TW','US','JP','GND','OTH'].reduce((x,k)=>x+av('srcA',k),0))+(plainT()?' 次':' 步')+'，其中台灣反艦飛彈與海空軍 '+f1(av('srcA','TW'))+'、美軍 '+f1(av('srcA','US'))+'、日本 '+f1(av('srcA','JP'))+'、地面戰鬥 '+f1(av('srcA','GND'))+'；守方共 '+f1(['TW','US','JP','GND','OTH'].reduce((x,k)=>x+av('srcD',k),0))+(plainT()?' 次':' 步')+'，其中共軍火力打擊等 '+f1(av('srcD','OTH')+av('srcD','TW'))+'、地面戰鬥 '+f1(av('srcD','GND'))+'。');}
  {const av=k=>Math.round(rows.reduce((x,r)=>x+(r[k]||0),0)/N);takeaways.push('結局分布：'+ENDORDER.map(k=>ENDCARDS[k].t+' '+pct(rows.filter(r=>r.end===k).length,N)+'%').join('、')+'；平均評分 攻方 '+av('sA')+'、守方 '+av('sD')+'。');}
  takeaways.push('三項條件中最難達成的是「'+cond[0][0]+'」（'+pct(cond[0][1],N)+'%），最容易的是「'+cond[2][0]+'」（'+pct(cond[2][1],N)+'%）。');
  if(best&&best.gap>=15)takeaways.push('決策中影響最大的是「'+best.name+'」：選「'+best.hi.k+'」時攻方勝率約 '+pct(best.hi.w,best.hi.n)+'%，選「'+best.lo.k+'」時約 '+pct(best.lo.w,best.lo.n)+'%。');
  const D=rows.filter(r=>r.draw).length,brief=rows.filter(r=>r.tp&&!r.win&&!r.draw).length;
  if(D)takeaways.push('有 '+D+' 局（'+pct(D,N)+'%）判僵局：首都已連續被占 2 個回合以上，但攻方孤立。');
  if(brief)takeaways.push('有 '+brief+' 局（'+pct(brief,N)+'%）首都在最後一刻才被占領（暫時占領），判守方獲勝。');
  const ret=rows.filter(r=>r.usRet),eng=rows.filter(r=>!r.usRet&&r.us>=2);
  if(ret.length>=5)takeaways.push('美軍因傷亡升高而退縮的有 '+ret.length+' 局（'+pct(ret.length,N)+'%），這些局攻方勝率約 '+pct(ret.filter(r=>r.win).length,ret.length)+'%'+(eng.length>=5?'；參戰且未退縮的局約 '+pct(eng.filter(r=>r.win).length,eng.length)+'%':'')+'。');
  const usFull=rows.filter(r=>r.us>=3);if(usFull.length>=8&&usFull.length<N-7)takeaways.push('美國全面參戰時攻方勝率約 '+pct(usFull.filter(r=>r.win).length,usFull.length)+'%，其他情況約 '+pct(rows.filter(r=>r.us<3&&r.win).length,rows.filter(r=>r.us<3).length)+'%。');
  const outs='<h3>攻方勝率 '+pct(W,N)+'%　<span class="dd">僵局 '+pct(rows.filter(r=>r.draw).length,N)+'%・守方勝 '+pct(N-W-rows.filter(r=>r.draw).length,N)+'%</span></h3>';
  const costT='<table class="ctable"><tbody><tr><td>攻方軍人傷亡</td><td>'+range('milA',v=>ppl(v))+'</td></tr><tr><td>守方軍人傷亡</td><td>'+range('milD',v=>ppl(v))+'</td></tr><tr><td>台灣平民傷亡</td><td>'+range('civ',v=>ppl(v))+'</td></tr><tr><td>全球股市</td><td>'+range('mkt',v=>v.toFixed(1)+'%')+'</td></tr></tbody></table>';
  const usT='<table class="ctable"><tbody><tr><td colspan="3"><b>最高參戰程度</b></td></tr>'+us.sort((a,b)=>LV.US.indexOf(a.k)-LV.US.indexOf(b.k)).map(x=>'<tr><td>'+x.k+'</td><td>'+x.n+' 局</td><td>攻方勝率 '+pct(x.w,x.n)+'%'+(x.n<8?'<span class="dd">（樣本少）</span>':'')+'</td></tr>').join('')+'<tr><td colspan="3"><b>結束時的立場</b></td></tr>'+up.sort((a,b)=>b.n-a.n).map(x=>'<tr><td>'+x.k+'</td><td>'+x.n+' 局</td><td>攻方勝率 '+pct(x.w,x.n)+'%'+(x.n<8?'<span class="dd">（樣本少）</span>':'')+'</td></tr>').join('')+'</tbody></table>';
  return '<div class="finw"><div class="fin-head"><div class="eyebrow">統計結果 · '+N+' 局</div>'+outs+
    '<div class="dd">95% 信賴區間約 '+Math.round(lo*100)+'%～'+Math.round(hi*100)+'%。設定：第 '+$('#optT').value+' 回合判定、'+ERA[$('#optEra').value].n+'、'+optLabel('optBuild',$('#optBuild').value)+'、'+optLabel('optFx',$('#optFx').value)+'。雙方由電腦操作，事件決策與擲骰隨機。</div>'+
    '<ul class="stk">'+takeaways.map(t=>'<li>'+t+'</li>').join('')+'</ul></div>'+
    '<div class="fin-body"><div class="fin-tools"><button class="lnk" id="accAll">全部展開</button><button class="lnk" id="accNone">全部收合</button></div>'+
    acc('攻方達成幾項條件','獲勝 '+pct(W,N)+'%・首都 '+pct(rows.filter(r=>r.tp).length,N)+'%・港口 '+pct(rows.filter(r=>r.pt).length,N)+'%・戰力 '+pct(rows.filter(r=>r.fo).length,N)+'%',
      [0,1,2,3].map(k=>statBar(k+' 項'+(k>=2?'（獲勝）':''),pct(rows.filter(r=>r.n===k).length,N),k>=2?'atk':'def')).join('')+'<div class="eyebrow" style="margin-top:10px">各項條件達成率</div>'+
      statBar('首都台北',pct(rows.filter(r=>r.tp).length,N),'atk')+statBar('主要港口',pct(rows.filter(r=>r.pt).length,N),'atk')+statBar('島上戰力',pct(rows.filter(r=>r.fo).length,N),'atk'),true)+
    acc('代價（粗估）','攻方傷亡約 '+ppl(rows.reduce((a,r)=>a+r.milA,0)/N)+'・台灣平民約 '+ppl(rows.reduce((a,r)=>a+r.civ,0)/N),costT,false)+
    acc('美國參戰程度、立場與攻方勝率',us.length+' 種程度',usT,false)+
    (tables.length?acc('決策與攻方勝率',best&&best.gap>=15?'影響最大：'+best.name:'各項決策差異不大','<table class="ctable"><tbody>'+tables.join('')+'</tbody></table>',false):'')+
    '<div class="dd" style="margin-top:8px">電腦的決策是隨機抽樣，不代表最佳策略；樣本越多越準，局數少時勝率可能有明顯誤差。</div></div>'+
    '<div class="fin-foot"><button id="stClose">關閉</button><button class="ghost" id="stAgain">再跑一次</button></div></div>';

}
async function runStats(N){
  if(STAT.running)return;
  STAT.running=true;STAT.cancel=false;clearTimeout(V.t);V.playing=false;if(V.fr.length)vBtn();
  const keep={S,final:REC.final,frames:REC.frames,prev:REC.prev};
  const box=mboxSet('ev');$('#resume').hidden=true;$('#modal').hidden=false;
  const rows=[];
  const prog=i=>{box.innerHTML='<div class="eyebrow">統計中</div><h3>正在模擬 '+i+' / '+N+' 局</h3><div class="pbar"><i style="width:'+Math.round(i/N*100)+'%"></i></div><p class="dd">雙方由電腦操作，事件決策與擲骰隨機；通常不到一分鐘。</p><div class="btns"><button class="ghost" id="stCancel">取消並顯示目前結果</button></div>';$('#stCancel').onclick=()=>{STAT.cancel=true;};};
  prog(0);await new Promise(r=>setTimeout(r,30));
  for(let i=0;i<N&&!STAT.cancel;i++){
    try{await simRun(true);rows.push(collectRun());}catch(e){console.error(e);break;}
    if(i%3===2||i===N-1){prog(i+1);await new Promise(r=>setTimeout(r,0));}
  }
  S=keep.S;REC.final=keep.final;REC.frames=keep.frames;REC.prev=keep.prev;REC.quiet=false;STAT.running=false;
  if(S.started||S.over)renderAll();
  if(rows.length<5){box.innerHTML='<h3>局數太少</h3><p>至少需要 5 局才能統計。</p><div class="btns"><button id="stClose">關閉</button></div>';}
  else{mboxSet('fin');box.innerHTML=statsHTML(rows);accTools();}
  $('#stClose').onclick=()=>{$('#modal').hidden=true;mboxSet('');if(S.over&&S.video&&REC.final&&V.fr.length)showFinal(REC.final);};
  const ag=$('#stAgain');if(ag)ag.onclick=()=>runStats(N);
}
