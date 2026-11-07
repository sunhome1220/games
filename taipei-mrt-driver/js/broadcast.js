'use strict';
// 車內廣播：多語言語音（Web Speech API）＋字幕。
// 【依據】北捷到站廣播：國語、閩南語（台語）、客家語（依《大眾運輸工具播音語言平等保障法》）加上英語；
//        日語自 2018 年起在熱門景點與轉乘站增設（共 21 站），韓語自 2023 年起先在 15 站增設，
//        2024 年計畫擴及全線 117 站（搜尋時未確認是否如期完成）。日語站名唸法（訓讀／音讀／華語音譯）曾有爭議。
// 【限制】瀏覽器通常沒有台語、客語語音，這兩種只顯示字幕；日語、韓語的站名沒有官方讀法資料，
//        用裝置語音唸漢字站名，唸法可能不準；「熱門與轉乘站」名單依報導點名的站名加上轉乘站，並不完整。
const BC_LANGS=[
  {id:'zh', name:'國語',   vp:['zh-tw','zh-hk','zh-cn','zh'], tag:'#e8c88a'},
  {id:'nan',name:'台語',   vp:['nan','zh-min-nan'],           tag:'#ff9b7b'},
  {id:'hak',name:'客語',   vp:['hak'],                        tag:'#c8a2f0'},
  {id:'en', name:'English',vp:['en-us','en-gb','en'],         tag:'#74c0fc'},
  {id:'ja', name:'日本語', vp:['ja'],                         tag:'#ff8fa3'},
  {id:'ko', name:'한국어', vp:['ko'],                         tag:'#7bd88f'}
];
// 報導中點名有日語／韓語廣播的站（部分名單）
const BC_NAMED_JK=new Set(['士林','台北101/世貿','民權西路','松江南京','台北車站','西門','淡水','中正紀念堂','關渡','石牌']);
function bcIsTransfer(name){let n=0;for(const k in LINES)if(LINES[k].st.includes(name))n++;return n>1;}
function bcLangOk(id,st){
  if(id!=='ja'&&id!=='ko')return true;
  return SET.bcJk==='all'||BC_NAMED_JK.has(st.name)||bcIsTransfer(st.name);
}
// 語句：kind = next（下一站）／arrive（到站）／lead（本列車往）
const BC_TXT={
  zh:(k,n,s)=>k==='next'?`下一站，${n.zh}`:k==='arrive'?`${n.zh}到了，請由${s==='L'?'左':'右'}側車門下車`:`本列車往${n.zh}`,
  // 台語、客語：沒有正確的語句與語音資料，不編造；只標示站名與「無語音」
  nan:(k,n,s)=>`${n.zh}（台語廣播；此裝置沒有台語語音）`,
  hak:(k,n,s)=>`${n.zh}（客語廣播；此裝置沒有客語語音）`,
  en:(k,n,s)=>k==='next'?`Next station, ${n.en}.`:k==='arrive'?`${n.en}. Doors on the ${s==='L'?'left':'right'} side will open.`:`This train is bound for ${n.en}.`,
  ja:(k,n,s)=>k==='next'?`次は、${n.zh}です。`:k==='arrive'?`${n.zh}に到着しました。${s==='L'?'左':'右'}側のドアが開きます。`:`この電車は${n.zh}行きです。`,
  ko:(k,n,s)=>k==='next'?`다음 역은 ${n.zh}입니다.`:k==='arrive'?`${n.zh}에 도착했습니다. ${s==='L'?'왼쪽':'오른쪽'} 문이 열립니다.`:`이 열차는 ${n.zh}행입니다.`
};
let BCV=[];            // 裝置語音清單
let BCAP=null;         // 目前字幕 {lines:[{id,name,tag,text,voice}],t0,dur}
function bcLoadVoices(){try{if('speechSynthesis' in window)BCV=speechSynthesis.getVoices()||[];}catch(e){BCV=[];}}
if('speechSynthesis' in window){bcLoadVoices();try{speechSynthesis.addEventListener('voiceschanged',()=>{bcLoadVoices();if(typeof fillMenu==='function'&&document.getElementById('m-bcinfo'))bcShowInfo();});}catch(e){}}
function bcVoice(id){
  const L=BC_LANGS.find(l=>l.id===id);if(!L)return null;
  for(const p of L.vp){const v=BCV.find(v=>(v.lang||'').toLowerCase().replace('_','-').startsWith(p));if(v)return v;}
  return null;
}
function bcShowInfo(){
  const el=document.getElementById('m-bcinfo');if(!el)return;
  if(!('speechSynthesis' in window)){el.innerHTML='這個瀏覽器不支援語音播報，只會顯示字幕。';return;}
  el.innerHTML='此裝置的語音：'+BC_LANGS.map(l=>`<span style="color:${bcVoice(l.id)?'#7bd88f':'#ff9b7b'}">${l.name}${bcVoice(l.id)?'✓':'✗'}</span>`).join('　')+
    '<br>✗ 的語言只顯示字幕（瀏覽器通常沒有台語、客語語音）。日語、韓語站名以裝置語音唸漢字，唸法可能不準。';
}
// 播報：依設定的語言與站別組出句子，顯示字幕並依序朗讀
function announce(kind,st){
  const g=G;if(!SET.bcOn||!g||!st)return;
  const en=g.L.en?g.L.en[st.idx]:st.name,n={zh:st.name,en:en||st.name};
  const lines=[];
  for(const L of BC_LANGS){
    if(!SET.bcLangs.includes(L.id)||!bcLangOk(L.id,st))continue;
    lines.push({id:L.id,name:L.name,tag:L.tag,text:BC_TXT[L.id](kind,n,st.side),voice:!!bcVoice(L.id)});
  }
  if(!lines.length)return;
  BCAP={lines,t0:performance.now(),dur:kind==='next'?9000:7000};
  if(!('speechSynthesis' in window))return;
  try{
    speechSynthesis.cancel();
    for(const l of lines){
      if(!l.voice)continue;                       // 沒有語音的語言只顯示字幕，不用別的語言的聲音假裝
      const v=bcVoice(l.id),u=new SpeechSynthesisUtterance(l.text);u.voice=v;u.lang=v.lang;u.rate=0.95;speechSynthesis.speak(u);
    }
  }catch(e){}
}
