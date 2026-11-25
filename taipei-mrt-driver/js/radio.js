'use strict';
// 行控無線電通話（單向）：突發事件開始時，行控中心「呼叫」司機——無線電提示音、很淡的雜訊、語音加字幕。
// 【重要】通話內容與用語是依各事件的處置建議（EV_INFO）編寫的**遊戲設計**，不是北捷實際的通話用語或流程（沒有查到公開的通話稿）。
// 【限制】瀏覽器的語音朗讀（Web Speech API）無法接進音效處理，所以無線電雜訊是「疊在語音旁邊播放」，
//        不能把人聲本身變成無線電音質；沒有國語語音的裝置只有提示音、雜訊與字幕。
// 純函式 ocText 不碰 DOM，可在 Node 測試。
const OC={cap:null,stat:null};
function ocCall(g){
  const f=g.formation?`${g.formation} 編組`:'';
  return `${g.L.name}列車${f?'，'+f:''}`;
}
// 每種事件一段通話；e 為 evStart 之後的事件物件（含 level／lim／car 等）
function ocText(g,id,e){
  const c=ocCall(g);
  switch(id){
    case 'quake':return `行控呼叫${c}。台北地區發生震度 ${e.level} 級地震，請依規定降速至每小時 ${e.lim} 公里以下巡軌，保持警戒，等候後續指示。`;
    case 'wind':return `行控呼叫${c}。強風警報，高架與平面路段請降速至每小時 ${e.lim} 公里以下，進入地下段後解除，請注意安全。`;
    case 'trespass':return `行控呼叫${c}。接獲通報，前方軌道上有人，請立即緊急煞車，停妥後回報行控，等候確認排除。`;
    case 'doorfault':return `行控呼叫${c}。第 ${e.car} 節車門閉鎖燈未亮，請重新開關門；仍無法排除，請按行控鈕與我們聯絡。`;
    case 'signal':return `行控呼叫${c}。前方號誌故障，顯示停止，請在號誌前停車待命，等候行控指示，不得越過。`;
    case 'power':return `行控呼叫${c}。供電異常，牽引電力受限，請以惰行為主、每小時 ${e.lim||g.evLim||60} 公里以下行駛，並提早煞車。`;
    case 'debris':return `行控呼叫${c}。接獲通報，前方軌道有樹枝等異物，請減速並在異物前停車，停妥後回報行控。`;
    case 'rain':return `行控呼叫${c}。豪大雨，高架與平面路段請降速至每小時 ${e.lim||50} 公里以下，煞車請提早，注意停準車站，若列車抖動請立即停車。`;
    case 'trainfault':{const nx=g.stations[g.k]?g.stations[g.k].name.replace('/','、'):'下一';return `行控呼叫${c}。列車故障告警，請以每小時 ${e.lim||g.evLim||40} 公里以下駛往${nx}站，開門讓旅客換乘，清客完成前請勿關門。`;}
  }
  return '';
}
const ocSecs=t=>Math.max(4,t.length*0.24+1.5);       // 估計朗讀秒數（沒有語音時字幕的顯示長度）
// 低強度的頻帶雜訊：窄頻（約 400～3400 Hz，像無線電頻寬），音量很小；level：'light'｜'mid'
function ocStaticStart(level){
  if(!AC||!AN||!SET.snd||level==='off')return null;
  try{
    const t=AC.currentTime,s=AC.createBufferSource();s.buffer=AN.nb;s.loop=true;
    const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=400;
    const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3400;
    const g=AC.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(level==='mid'?0.045:0.016,t+0.05);
    s.connect(hp);hp.connect(lp);lp.connect(g);g.connect(AN.master);s.start(t,Math.random()*1.5);
    return {s,g};
  }catch(e){return null;}
}
function ocStaticStop(st,level){
  if(!st)return;
  try{const t=AC.currentTime;st.g.gain.cancelScheduledValues(t);st.g.gain.setTargetAtTime(0.0001,t,0.03);st.s.stop(t+0.2);}catch(e){}
  try{burst(0.12,3000,1400,0.8,level==='mid'?0.09:0.05,0,0.004);}catch(e){}      // 通話結束的「嚓」聲
}
function ocRadio(g,id,e){
  const text=ocText(g,id,e);if(!text)return;       // 沒有通話稿的事件（例如乘客對講）不來電
  ocSay(g,text);
}
// 播出一段行控通話（事件開始時，或處置過程中的回覆／授權）
function ocSay(g,text){
  if(!SET.radio||!g||!text)return;
  const level=SET.radioNoise||'light';
  const dur=ocSecs(text);
  OC.cap={text,t0:performance.now(),dur:dur*1000+1500};
  if(OC.stat){ocStaticStop(OC.stat,level);OC.stat=null;}
  // 按下通話鍵的提示音（兩聲短音）
  try{beep(1050,0.05,'square',0.07,0);beep(1500,0.06,'square',0.08,0.09);}catch(err){}
  const v=(typeof bcVoice==='function')?bcVoice('zh'):null;
  const st=ocStaticStart(level);OC.stat=st;
  let ended=false;
  const finish=()=>{if(ended)return;ended=true;if(OC.stat===st){ocStaticStop(st,level);OC.stat=null;}};
  if(v&&SET.snd&&('speechSynthesis' in window)){
    setTimeout(()=>{try{
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);u.voice=v;u.lang=v.lang;u.rate=1.05;u.pitch=0.92;
      u.onend=finish;u.onerror=finish;speechSynthesis.speak(u);
    }catch(err){finish();}},380);
    setTimeout(finish,(dur+3)*1000);                 // 保險：語音沒有 onend 時也會結束
  }else{
    setTimeout(finish,Math.min(dur,8)*1000);
  }
}
