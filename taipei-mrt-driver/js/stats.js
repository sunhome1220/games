'use strict';
// 匿名造訪統計（GoatCounter：不用 cookie、不收個資）。只記：造訪次數、「開始遊玩」「完成一班」事件與路線。
// 不記駕駛名稱、成績內容或裝置資訊。瀏覽器開了 Do Not Track 就完全不載入；統計服務連不上時不影響遊戲。
const GC_URL='https://sunhome.goatcounter.com/count';
const GC_SRC='https://gc.zgo.at/count.js';
const statQ=[];
function statDNT(){const d=navigator.doNotTrack||window.doNotTrack||navigator.msDoNotTrack;return d==='1'||d==='yes';}
function statLocal(){return /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|)$/.test(location.hostname)||/\.local$/.test(location.hostname);}
function statOn(){return !statDNT()&&/^https?:$/.test(location.protocol)&&!statLocal();}   // 本機開發不統計
function statFlush(){
  while(statQ.length&&window.goatcounter&&typeof window.goatcounter.count==='function'){
    try{window.goatcounter.count(statQ.shift());}catch(e){}
  }
}
// 記一個事件（path 為事件名，例如 'play'、'play-red'、'finish'）
function statEvent(path,title){
  if(!statOn())return;
  if(statQ.length<20)statQ.push({path,title:title||path,event:true});
  statFlush();
}
function statInit(){
  if(!statOn())return;
  try{
    const s=document.createElement('script');
    s.async=true;s.src=GC_SRC;
    s.setAttribute('data-goatcounter',GC_URL);
    s.onload=()=>setTimeout(statFlush,0);
    s.onerror=()=>{statQ.length=0;};            // 連不上（離線、被擋）就放棄，不重試
    document.head.appendChild(s);
  }catch(e){}
}
