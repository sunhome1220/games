'use strict';
// 外籍旅客求助（英語四選一）：事件「foreign」開始時，外籍旅客用英文詢問，司機員依駕駛室資訊（下一站、車門側、轉乘、終點、站數）選出正確回答。
// 題目由目前這一班的資料即時產生（正確答案一定與遊戲狀態一致）；英文由瀏覽器的英語語音朗讀（沒有英語語音就只有文字）。
// 【難度／課綱】題庫依等級分成模板表 FQ_LEVELS：預設 g5（國小五年級：短句、常見基礎單字，避開 terminate／transfer／bound 這類較難的字），
//   另有 g3（更簡單）與 g8（國中二年級：較長句型）。**程度是依常見的基礎詞彙與句型粗估，不是教育部課綱字表的逐字對照。**
//   要新增等級或課綱：在 FQ_LEVELS 加一個項目（name、note、intro、各題型的 q／opts 模板函式），設定選單與測試會自動帶出；題型名稱見 FQ_TYPES。
// 【依據】知新聞 2025-04-01 專訪北捷行車專員：外國旅客需要幫助時能及時以英文回應，公司每年提供英語檢定補助。
// 【設計】題型、措辭、分數都是遊戲設計，不是北捷的標準應答。純函式 fqMake 不碰 DOM，可在 Node 測試。
const FQ_TYPES=['next','door','transfer','end','count'];
const FQ_LINE={red:{en:'Red Line',full:'the Tamsui–Xinyi Line (Red Line)',zh:'淡水信義線'},blue:{en:'Blue Line',full:'the Bannan Line (Blue Line)',zh:'板南線'},
  green:{en:'Green Line',full:'the Songshan–Xindian Line (Green Line)',zh:'松山新店線'},brown:{en:'Brown Line',full:'the Wenhu Line (Brown Line)',zh:'文湖線'}};
// 等級表：每個題型提供 q(題目英文)、zh(題目中文)、o(正確與錯誤選項的英文句子產生器)。{X} 等占位由程式帶入。
const FQ_LEVELS={
  g3:{name:'國小三年級（較簡單）',note:'更短的句子，只有下一站、車門、終點三種題型',types:['next','door','end'],
    intro:['Hi.','Hello.','Excuse me.'],
    next:{q:()=>'What is the next station?',o:e=>`The next station is ${e}.`},
    door:{q:()=>'Left or right? Which doors open?',o:{left:'The left doors open.',right:'The right doors open.',both:'Both doors open.',none:'No doors open.'}},
    end:{q:()=>'Where does this train go?',o:e=>`It goes to ${e}.`}},
  g5:{name:'國小五年級（預設）',note:'短句與常見基礎單字；包含轉乘與數站數',types:['next','door','transfer','end','count'],
    intro:['Excuse me.','Hi.','Hello.','Sorry.'],
    next:{q:()=>'What is the next station?',o:e=>`The next station is ${e}.`},
    door:{q:()=>'Which doors will open at the next station? Left or right?',o:{left:'The left doors will open.',right:'The right doors will open.',both:'Both doors will open.',none:'No doors will open.'}},
    transfer:{q:l=>`I want to go to the ${l}. Where do I change trains?`,o:e=>`Get off at ${e}.`},
    end:{q:()=>'Where does this train go?',o:e=>`This train goes to ${e}.`},
    count:{q:e=>`How many stops to ${e}? The next station is one.`,o:x=>`${x} stop${x===1?'':'s'}.`}},
  g8:{name:'國中二年級（較難）',note:'較長的句型與較多的字彙',types:['next','door','transfer','end','count'],
    intro:['Excuse me,','Sorry to bother you,','Hello,'],
    next:{q:()=>'could you tell me which station is the next stop?',o:e=>`The next station is ${e}.`},
    door:{q:()=>'which side will the doors open at the next station?',o:{left:'The doors will open on the left side.',right:'The doors will open on the right side.',both:'The doors on both sides will open.',none:'The doors will not open at the next station.'}},
    transfer:{q:l=>`I would like to transfer to ${l}. Where should I get off?`,o:e=>`You should get off at ${e}.`},
    end:{q:()=>'where does this train terminate?',o:e=>`This train terminates at ${e}.`},
    count:{q:e=>`how many stops are there until ${e}? Please count the next station as one.`,o:x=>`${x} stop${x===1?'':'s'}, counting the next station.`}}
};
const FQ_DEFAULT_LEVEL='g5';
const fqPick=(a,r)=>a[Math.floor(r()*a.length)];
function fqShuffle(a,r){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
const fqEn=(g,st)=>{const e=g.L.en&&g.L.en[st.idx];return e||st.name;};      // 站名（英文）；g.L.en 由 tools/gen_lines.py 產生，沒有就退回中文
const fqLevel=()=>FQ_LEVELS[(typeof SET!=='undefined'&&SET.fqLevel)||FQ_DEFAULT_LEVEL]||FQ_LEVELS[FQ_DEFAULT_LEVEL];
const fqSay=(L,r,q)=>{const i=fqPick(L.intro,r);return /[.!?]$/.test(i)?`${i} ${q}`:`${i} ${q}`;};   // 開場白＋題目
// 目前這一班、這個等級能問的題型
function fqTypes(g,r,L){
  const S=g.stations,k=g.k,n=S.length,out=[],has=t=>L.types.includes(t)&&L[t];
  if(k>=n)return out;
  const others=(i)=>S.filter((s,x)=>x!==i);
  const optsFrom=(ans,pool,fmt)=>{const o=fqShuffle([ans,...pool],r).map(fmt);return {opts:o,ans:o.indexOf(fmt(ans))};};
  if(has('next'))out.push({type:'next',build:()=>{
    const ans=fqEn(g,S[k]),pool=fqShuffle(others(k).map(s=>fqEn(g,s)).filter(e=>e!==ans),r).slice(0,3);if(pool.length<3)return null;
    return Object.assign({en:fqSay(L,r,L.next.q()),zh:'請問下一站是哪一站？',exp:`下一站是「${S[k].name}」（${ans}）。`},optsFrom(ans,pool,L.next.o));
  }});
  if(has('door'))out.push({type:'door',build:()=>{
    const side=S[k].side==='L'?'left':'right',txt=L.door.o,opts=fqShuffle(Object.values(txt),r);
    return {en:fqSay(L,r,L.door.q()),zh:'請問下一站車門會開哪一側？',opts,ans:opts.indexOf(txt[side]),exp:`下一站「${S[k].name}」月台在${side==='left'?'左':'右'}側，開${side==='left'?'左':'右'}門。`};
  }});
  const line=g.opt.line;let tj=-1,tkey=null;
  if(has('transfer'))for(let j=k;j<n&&tj<0;j++){for(const key in LINES){if(key!==line&&LINES[key].st.includes(S[j].name)){tj=j;tkey=key;break;}}}
  if(tj>=0)out.push({type:'transfer',build:()=>{
    const ans=fqEn(g,S[tj]),isX=s=>LINES[tkey].st.includes(s.name),pool=fqShuffle(S.filter((s,i)=>i!==tj&&!isX(s)).map(s=>fqEn(g,s)).filter(e=>e!==ans),r).slice(0,3);if(pool.length<3)return null;
    const lname=L===FQ_LEVELS.g8?FQ_LINE[tkey].full:FQ_LINE[tkey].en;
    return Object.assign({en:fqSay(L,r,L.transfer.q(lname)),zh:`我想轉乘${FQ_LINE[tkey].zh}，要在哪一站換車？`,exp:`「${S[tj].name}」可轉乘${FQ_LINE[tkey].zh}，是前方最近的轉乘站。`},optsFrom(ans,pool,L.transfer.o));
  }});
  if(has('end'))out.push({type:'end',build:()=>{
    const last=S[n-1],ans=fqEn(g,last),pool=fqShuffle(S.slice(0,n-1).map(s=>fqEn(g,s)).filter(e=>e!==ans),r).slice(0,3);if(pool.length<3)return null;
    return Object.assign({en:fqSay(L,r,L.end.q()),zh:'請問這班車開到哪一站？',exp:`這班車開到「${last.name}」（${ans}）。`},optsFrom(ans,pool,L.end.o));
  }});
  if(has('count')&&n-k>=3)out.push({type:'count',build:()=>{
    const j=k+2+Math.floor(r()*Math.min(3,n-k-2)),stops=j-k+1,ans=fqEn(g,S[j]);   // 下一站算第 1 站
    const pool=fqShuffle([stops-2,stops-1,stops+1,stops+2,stops+3].filter(x=>x>=1&&x!==stops),r).slice(0,3);if(pool.length<3)return null;
    return Object.assign({en:fqSay(L,r,L.count.q(ans)),zh:`到「${S[j].name}」還有幾站？（下一站算第 1 站）`,exp:`下一站是第 1 站，「${S[j].name}」是第 ${stops} 站。`},optsFrom(stops,pool,L.count.o));
  }});
  return out;
}
// 產生一題：{type,en,zh,opts[4],ans,exp}；r 為亂數函式（預設 Math.random，測試可傳固定種子）；only 指定題型；levelId 指定等級（預設用設定）
// 已答對的題目（以題型＋英文題幹為鍵，存本機）不再出；答錯的題目放進 FQ_WRONG，之後有機會再問一次（直到答對）
const FQ_DONE=new Set(),FQ_WRONG=[];
try{JSON.parse(localStorage.getItem('mrt_fq_done')||'[]').forEach(k=>FQ_DONE.add(k));}catch(e){}
function fqKey(q){return q.type+'|'+q.en;}
function fqMark(q,right){
  const k=fqKey(q),i=FQ_WRONG.findIndex(x=>fqKey(x)===k);
  if(right){FQ_DONE.add(k);if(i>=0)FQ_WRONG.splice(i,1);try{localStorage.setItem('mrt_fq_done',JSON.stringify([...FQ_DONE].slice(-2000)));}catch(e){}}
  else if(i<0)FQ_WRONG.push(q);
}
function fqMake(g,r,only,levelId){
  r=r||Math.random;
  const L=levelId?(FQ_LEVELS[levelId]||fqLevel()):fqLevel();
  const lid=Object.keys(FQ_LEVELS).find(k=>FQ_LEVELS[k]===L);
  // 答錯過的題目：同等級、同題型限制下，約一半機率再問一次
  const w=FQ_WRONG.filter(q=>q.level===lid&&(!only||q.type===only));
  if(w.length&&r()<0.5)return w[Math.floor(r()*w.length)];
  const ts=fqTypes(g,r,L).filter(t=>!only||t.type===only);
  for(let n=0;n<12;n++)for(const t of fqShuffle(ts,r)){const q=t.build();if(q&&q.opts.length===4&&q.ans>=0&&new Set(q.opts).size===4){const o=Object.assign({type:t.type,level:lid},q);if(!FQ_DONE.has(fqKey(o)))return o;}}
  return null;
}
// 朗讀英文題目（有英語語音才讀；回傳是否真的開始朗讀）；g3 讀慢一點
function fqSpeak(text){
  if(typeof SET==='undefined'||!SET.snd||typeof bcVoice!=='function'||typeof window==='undefined'||!('speechSynthesis' in window))return false;
  const v=bcVoice('en');if(!v)return false;
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.voice=v;u.lang=v.lang;u.rate=((SET.fqLevel==='g3')?0.8:0.88)*(0.97+Math.random()*0.06);u.pitch=0.98+Math.random()*0.05;speechSynthesis.speak(u);return true;}catch(e){return false;}
}
