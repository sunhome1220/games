'use strict';
// 突發事件。事件種類依新聞與北捷公開規定挑選（搜尋於 2026-11），每項附出處 news 與處置建議 tip。
// 注意：遊戲內的數值（限速、時間）是依規定精神簡化的設定，不是營運手冊原文；找不到具體數值的（例如強風停駛風速門檻）不假裝有。
const EV_INFO={
  quake:{name:'地震',color:'#ff9f43',
    news:'北捷官網問答：震度 2 以上時，列車在月台暫停發車、在站間則減速停車；震度 2～3 高運量列車以半自動 40 km/h 以下巡軌、文湖線全線 50% 速限；震度 4 以上更慢。2024-08-15 台北震度 3 實際限速 40 km/h，2024-04-03 花蓮地震北捷暫停營運約 40～60 分鐘。',
    tip:'地震警報一響，立刻用穩定的煞車把速度降到限速以下（不要等 ATP 動作），並維持低速直到解除。'},
  wind:{name:'強風（颱風）',color:'#74c0fc',
    news:'颱風期間，北捷文湖線與淡水信義線的高架、平面路段因風速達停駛標準而暫停營運，地下路段照常（具體風速門檻未查到）。',
    tip:'強風時高架與平面路段要降速，進入地下段後限制才解除；窗外的雨與風是在提醒你放慢。'},
  trespass:{name:'旅客誤入軌道',color:'#ff6b6b',
    news:'2024 年龍山寺站列車緊急煞車（約 1,200 名旅客改搭下一班車）；2025 年府中站有旅客翻越月台門闖入軌道；民權西路站也曾發生翻越月台門。',
    tip:'看到軌道上有人，第一時間 EB 緊急煞車（正常煞車來不及），停妥後通報行控，等行控確認排除再動。'},
  doorfault:{name:'車門故障',color:'#ffd43b',
    news:'2022 年北捷一列車第 2 節車門滑軌裂痕、關不上，司機員未獲行控授權就出發，事後被提報懲處。',
    tip:'車門閉鎖燈沒亮時不能發車：先重新開關門，仍不行就聯絡行控，取得授權後才能低速駛往下一站檢修。'},
  signal:{name:'號誌異常',color:'#ff8787',
    news:'2026-06-09 板南線尖峰時段號誌異常，忠孝復興站出現人潮壅塞，北捷加開列車輸運。',
    tip:'前方號誌顯示停止就要在號誌前停妥，不可越過；等行控恢復後，以低速通過故障號誌。'},
  power:{name:'供電異常',color:'#fcc419',
    news:'2020-02 板南線昆陽至南港展覽館供電電纜異常，改為單線雙向營運；淡水信義線也曾因供電異常造成列車延誤。',
    tip:'供電異常時牽引力會變弱：不要硬推高檔位，利用惰行維持速度，提早煞車。'},
  trainfault:{name:'列車故障清客',color:'#e599f7',
    news:'2025-10-31 板南線列車繼電器異常，依 SOP 請車上約 550 位旅客換乘後續列車；2025 年文湖線列車因元件故障自動停車，約 8,400 人受影響。',
    tip:'列車故障告警後降速駛往下一站，開門讓旅客換乘，清客完成前不要關門。'}
};
const EV_ORDER=['quake','wind','trespass','doorfault','signal','power','trainfault'];
const EV_RATE={low:{first:[150,300],gap:[300,500],max:2,door:0.12},mid:{first:[80,200],gap:[180,320],max:3,door:0.25},high:{first:[50,120],gap:[90,180],max:5,door:0.4}};
const rndR=(a,b)=>a+Math.random()*(b-a);

function evInit(g){
  const R=EV_RATE[SET.evRate]||EV_RATE.mid;
  g.evOn=!!SET.events;g.evR=R;g.evAllowed=EV_ORDER.filter(id=>!(SET.evOff||[]).includes(id));
  g.ev=null;g.evLog=[];g.evCount=0;g.evPts=0;
  g.evLim=null;g.evRamp=null;g.evWindOnly=false;g.evAcc=1;g.evHold=0;g.evForceEB=false;g.evBlockClose=false;
  g.hold=null;g.hz=null;g.doorFault=null;g.flicker=false;
  g.nextEv=rndR(R.first[0],R.first[1]);
}
// 目前的事件限速（km/h）。有 ramp 時，限速從事件開始時的速度以 0.55 m/s² 逐步降到目標，給玩家反應時間
function evLimit(g){
  if(g.evLim==null)return Infinity;
  if(g.evWindOnly&&envNow(g)==='tunnel')return Infinity;
  const r=g.evRamp;return r?Math.max(g.evLim,r.v0-2.0*(g.time-r.t0)):g.evLim;   // 以約 2 km/h/s（0.55 m/s²）逐步降到目標，給玩家足夠的減速時間
}
function shiftSchedule(g,sec){for(let i=g.k;i<g.S.length;i++){g.tArr[i]+=sec;g.tDep[i]+=sec;}}   // 事件造成的延誤不算誤點
function evFinish(g,outcome,pts,note){
  const info=EV_INFO[g.ev.id];
  g.evLog.push({id:g.ev.id,name:info.name,outcome,pts,note:note||'',tip:info.tip,news:info.news,t:g.time});
  g.evPts+=pts;
  toast(`${info.name}：${outcome==='ok'?'處置完成':outcome==='fail'?'處置失敗':'未完成'}（${pts>=0?'+':''}${pts} 分）`,outcome==='ok'?'#9be39b':'#ff9b7b',3.6);
  evClear(g);g.ev=null;
  g.nextEv=g.time+rndR(g.evR.gap[0],g.evR.gap[1]);
}
function evClear(g){g.evLim=null;g.evRamp=null;g.evWindOnly=false;g.evAcc=1;g.evHold=0;g.evForceEB=false;g.evBlockClose=false;g.hold=null;g.hz=null;g.doorFault=null;g.flicker=false;g.rain=false;}
function evStart(g,id){
  if(g.ev)return false;
  const E=EV[id];if(!E)return false;
  g.ev={id,t0:g.time,trips0:g.pen.atp,state:'start'};g.evCount++;
  E.start(g,g.ev);
  evAlarm();
  return true;
}
const kmhOf=g=>g.v*3.6;
const ramp=(g,lim)=>{g.evLim=lim;g.evRamp={v0:kmhOf(g),t0:g.time};};
const brownLine=g=>!!g.M.driverless;

const EV={
  quake:{can:g=>true,
    start(g,e){
      e.level=Math.random()<0.7?3:4;
      const b=brownLine(g);
      e.lim=e.level===3?(b?35:40):(b?17:15);e.dur=e.level===3?75:60;
      e.title=`地震：台北震度 ${e.level} 級`;e.sub=`依規定半自動、限速 ${e.lim} km/h 巡軌（${e.level===3?'震度 2～3':'震度 4'}）`;
      ramp(g,e.lim);
      if(g.v<0.5){g.evHold=14;e.sub+='；在站內暫停發車';}
    },
    tick(g,e){
      if(g.time-e.t0>=e.dur){const clean=g.pen.atp===e.trips0;evFinish(g,clean?'ok':'late',clean?8:0,clean?'':'限速期間 ATP 動作');}
    }},
  wind:{can:g=>g.stations.some(s=>s.env!=='tunnel'),
    start(g,e){
      e.lim=45;e.dur=80;e.title='強風警報（颱風）';e.sub='高架／平面路段限速 45 km/h；地下段不受限（真實營運是達風速標準即停駛）';
      g.evWindOnly=true;ramp(g,e.lim);g.rain=true;
    },
    tick(g,e){if(g.time-e.t0>=e.dur){g.rain=false;const clean=g.pen.atp===e.trips0;evFinish(g,clean?'ok':'late',clean?6:0,clean?'':'限速期間 ATP 動作');}}},
  trespass:{can:g=>{
      if(g.v<8||g.k>=g.S.length||g.rev)return false;
      const d=g.v*g.v/(2*g.M.eb)*1.15+80;return g.S[g.k]-(g.pos+d)>80;},
    start(g,e){
      const d=g.v*g.v/(2*g.M.eb)*1.15+80;
      e.hz=g.pos+d;g.hz={kind:'person',pos:e.hz};e.stopped=0;e.failT=0;
      e.title='旅客誤入軌道！';e.sub='前方軌道上有人：立即 EB 緊急煞車並通報行控';
    },
    tick(g,e,dt){
      if(e.state!=='fail'&&g.pos<e.hz)e.sub=`前方軌道上有人（約 ${Math.max(0,Math.round(e.hz-g.pos))} m）：立即 EB 緊急煞車並通報行控`;
      if(e.state==='fail'){e.failT+=dt;if(g.v<=0.05&&e.failT>6){g.segPen+=0;evFinish(g,'fail',-30,'未能在人員前方停車（遊戲不呈現後果，行控接管）');}return;}
      if(g.v<=0.05&&g.pos<e.hz-6){e.stopped+=dt;if(e.stopped>=8){const byAtp=g.pen.atp>e.trips0;evFinish(g,byAtp?'late':'ok',byAtp?0:12,byAtp?'由 ATP 代為煞停，應自行 EB':'行控確認排除');}return;}
      if(g.pos>=e.hz-3&&g.v>0.5){e.state='fail';g.evForceEB=true;toast('來不及停車，行控接管：緊急煞車','#ff7b7b',3.2);}
    }},
  doorfault:{can:g=>false,   // 由「關門完成」觸發（evOnDoorsClosed）
    start(g,e){
      e.car=1+Math.floor(Math.random()*g.L.cars);
      g.doorFault={car:e.car,tries:0,call:0};e.title=`車門故障：第 ${e.car} 節閉鎖燈未亮`;
      e.sub='先重新開關門；仍無法排除，按「📞 行控」取得授權後才能低速發車';
    },
    tick(g,e,dt){
      const f=g.doorFault;
      if(f&&f.call>0){f.call-=dt;if(f.call<=0){g.doorFault=null;e.authorized=true;e.curAt=g.cur;g.evLim=25;g.evRamp=null;toast('行控授權：以 25 km/h 以下駛往下一站檢修','#9be39b',4);e.title='行控授權中：限速 25 km/h';e.sub='到下一站停妥後解除';}}
      if(e.authorized&&g.cur!==e.curAt)evFinish(g,'ok',e.tries?10:8,'');
    }},
  signal:{can:g=>{
      if(g.v<5||g.k>=g.S.length||g.rev)return false;
      const d=g.v*g.v/(2*0.85*g.M.brake)+110;return g.S[g.k]-(g.pos+Math.max(d,160))>120;},
    start(g,e){
      const d=Math.max(g.v*g.v/(2*0.85*g.M.brake)+110,160);
      e.hold=g.pos+d;g.hold=e.hold;g.hz={kind:'signal',pos:e.hold};e.wait=0;e.need=rndR(12,25);e.cleared=false;
      e.title='前方號誌異常：停止信號';e.sub='請在紅燈前停車待命，等行控恢復；不可越過';
    },
    tick(g,e,dt){
      if(!e.cleared){
        e.sub=g.v<=0.05?`已停車待命，等待行控恢復（${Math.floor(e.wait)} 秒）`:`前方 ${Math.max(0,Math.round(e.hold-g.pos))} m 號誌顯示停止：請在紅燈前停車待命`;
        // 沒有空隙的判斷：越過號誌線就是越過；沒越過且停妥就開始等待（先前漏掉「停在線前 0.5 m 內」會卡死）
        if(g.pos>e.hold&&g.v>0.5){g.trip=true;g.tripT=0;g.segPen+=15;g.pen.atp++;g.hold=null;g.hz=null;evFinish(g,'fail',-15,'越過停止信號');return;}
        if(g.v<=0.05&&g.pos<=e.hold){e.wait+=dt;if(e.wait>=e.need){e.cleared=true;g.hold=null;g.hz.kind='signalgreen';g.evLim=25;g.evRamp=null;e.sub='號誌恢復：以 25 km/h 以下通過故障號誌';e.title='號誌恢復';toast('行控：號誌恢復，限速 25 km/h 通過','#9be39b',3.5);}}
      }else if(g.pos>e.hold+30){shiftSchedule(g,e.wait+40);const clean=g.pen.atp===e.trips0;evFinish(g,clean?'ok':'late',clean?8:0,clean?'':'由 ATP 代為煞停，應自行在號誌前停車');}
    }},
  power:{can:g=>true,
    start(g,e){e.dur=50;e.title='供電異常：牽引受限';e.sub='加速度降低、限速 60 km/h；利用惰行維持速度';g.evAcc=0.4;ramp(g,60);g.flicker=true;},
    tick(g,e){if(g.time-e.t0>=e.dur){const clean=g.pen.atp===e.trips0;evFinish(g,clean?'ok':'late',clean?6:0,clean?'':'限速期間 ATP 動作');}}},
  trainfault:{can:g=>g.k<g.S.length&&g.S[g.k]-g.pos>350&&g.stations.length-g.k>=1,
    start(g,e){
      e.curAt=g.cur;e.state='toStation';e.title='列車故障告警：下一站清客';e.sub='限速 40 km/h 駛往下一站，開門讓旅客換乘，清客完成前不能關門';
      ramp(g,40);
    },
    tick(g,e,dt){
      if(e.state==='toStation'){
        if(g.cur!==e.curAt){      // 已到站並開門
          if(g.state==='finish'){evFinish(g,'ok',10,'終點站清客');return;}
          e.state='clearing';e.t1=g.time;g.evBlockClose=true;e.title='清客中';e.sub='旅客換乘中，請保持開門';
        }
      }else if(e.state==='clearing'){
        const left=12-(g.time-e.t1);
        if(left>0)e.sub=`旅客換乘中，請保持開門（剩 ${Math.ceil(left)} 秒）`;
        else{g.evBlockClose=false;e.state='depart';e.t2=g.time;g.evLim=60;g.evRamp=null;e.title='清客完成';e.sub='可關門發車，限速 60 km/h';}
      }else if(e.state==='depart'){
        if(g.time-e.t2>=60)evFinish(g,'ok',10,'');
      }
    }}
};
// 關門完成時：有進行中的車門故障就判斷是否排除；否則依機率觸發新的車門故障
function evOnDoorsClosed(g){
  if(!g.evOn)return;
  if(g.ev&&g.ev.id==='doorfault'&&g.doorFault){
    const f=g.doorFault;f.tries++;g.ev.tries=f.tries;
    if(Math.random()<(f.tries===1?0.55:0.85)){g.doorFault=null;evFinish(g,'ok',10,`重新開關門 ${f.tries} 次後排除`);}
    else toast(`第 ${f.tries} 次重新關門，閉鎖燈仍未亮。可再試一次或按「📞 行控」`,'#ffd43b',4);
    return;
  }
  if(g.ev||g.state==='finish'||g.k>=g.S.length)return;
  if(!g.evAllowed.includes('doorfault')||g.evCount>=g.evR.max)return;
  if(g.time<g.nextEv-g.evR.gap[0]*0.3&&g.evCount>0)return;
  if(Math.random()<g.evR.door)evStart(g,'doorfault');
}
function evCallControl(){
  const g=G;if(!g||!g.doorFault)return;
  if(g.doorFault.call>0)return;
  g.doorFault.call=8;toast('聯絡行控中……（約 8 秒）','#ffd43b',3);
}
function evAlarm(){try{beep(880,0.18,'square',0.12,0);beep(660,0.18,'square',0.12,0.22);beep(880,0.18,'square',0.12,0.44);}catch(e){}}
// 結算時尚未結束的事件
function evAbort(g){if(g&&g.ev)evFinish(g,'late',0,'行程結束時尚未處置完畢');}
// 每個物理步驟呼叫：進行中的事件逐幀處理；沒有事件時依排程挑一個可用的事件開始
function evTick(g,dt){
  if(!g.evOn||g.state==='result')return;
  if(g.ev){
    EV[g.ev.id].tick(g,g.ev,dt);
    // 保險：任何事件超過 5 分鐘仍未結束就強制結束並解除所有限制，玩家不會被事件困住
    if(g.ev&&g.time-g.ev.t0>300)evFinish(g,'late',0,'逾時，行控解除');
    return;
  }
  if(g.state!=='run'||g.evCount>=g.evR.max||g.time<g.nextEv)return;
  if(g.doors.state!=='closed'||g.k>=g.S.length||g.rev)return;
  if(g.S[g.S.length-1]-g.pos<300)return;                 // 終點前不再觸發
  const ids=g.evAllowed.filter(id=>id!=='doorfault'&&EV[id].can(g));
  if(!ids.length)return;
  evStart(g,ids[Math.floor(Math.random()*ids.length)]);
}
