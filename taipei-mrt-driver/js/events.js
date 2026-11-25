'use strict';
const FQ_SAFE_FAR=900,FQ_SAFE_NEAR=450,FQ_CURVE_AHEAD=600,FQ_CURVE_ABORT=250;
// 前方 ahead 公尺內、以及目前所在位置沒有彎道／限速區（直線段）
function fqStraight(g,ahead){for(const z of g.zones||[]){if(g.pos>z.s1+30)continue;if(z.s0-g.pos<ahead)return false;}return true;}
// 外籍旅客求助的時機：全自動駕駛（文湖線）隨時可以；人工駕駛只在「直線段、離下一站夠遠」才來電
function fqSafeNow(g){return !!g.M.driverless||(g.S[g.k]-g.pos>FQ_SAFE_FAR&&fqStraight(g,FQ_CURVE_AHEAD));}
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
    tip:'列車故障告警後降速駛往下一站，開門讓旅客換乘，清客完成前不要關門。'},
  intercom:{name:'乘客緊急對講',color:'#4dabf7',
    news:'中時 2014-06-04〈直擊駕駛室 北捷司機5秒看6車廂〉：板南線每列車廂有 4 組監視器與緊急對講系統，乘客按下對講鈕後，駕駛室即顯示該對講機畫面，司機員可與乘客對話；若乘客按完就離開，司機員要切換畫面逐節檢視，看完 6 節車廂約需 5 秒；行控中心可與司機員通訊，有緊急事件時再通報捷運警察隊與轄區警消。',
    tip:'對講機響了要立刻接聽；沒人說話就逐節切換車廂畫面找出是哪一節，確認狀況後回報行控，下一站停車交由站務人員處理。（遊戲中的狀況內容與分數是設計，不是營運手冊）'},
  debris:{name:'軌道異物',color:'#a9e34b',
    news:'知新聞 2025-04-01 專訪北捷行車專員：淡水信義線有高架平面段，颱風天會有大樹枝或異物飛到軌道，只有行車專員能排除異物，要穿好裝備、告知旅客後離開駕駛室去處理。',
    tip:'看到軌道上有異物，要在異物前停車並通報行控；取得行控同意後穿好裝備下車排除，回到駕駛室後以低速通過。（處理時間與流程是遊戲簡化）'},
  rain:{name:'豪大雨',color:'#4dd0e1',
    news:'知新聞 2025-04-01 專訪北捷行車專員：淡水信義線高架段遇到暴雨，行控中心會降低速限，因為下雨車子容易打滑，行車專員要更留意停準車站，若發現車子抖動就要立刻停車，避免停車超出車站標線。',
    tip:'下雨時高架與平面路段限速降低、煞車距離變長：提早煞車、不要等到最後才重踩，才停得準。（限速與煞車效果的數值是遊戲設定）'},
  foreign:{name:'外籍旅客求助（英語）',color:'#ff922b',
    news:'知新聞 2025-04-01 專訪北捷行車專員：外國旅客需要幫助時，司機員能及時以英文回應（受訪者多益 975 分，也擔任北捷「搭乘捷運安全指南」影片的英文解說）；公司每年提供英語檢定補助。',
    tip:'聽（或讀）清楚外籍旅客的問題，依駕駛室的資訊（下一站、車門側、轉乘站、終點、站數）選出正確的英語回答。（題目、措辭與分數是遊戲設計，不是北捷的標準應答）'}
};
const EV_ORDER=['quake','wind','trespass','doorfault','signal','power','trainfault','intercom','debris','rain','foreign'];
const EV_RATE={low:{first:[150,300],gap:[300,500],max:2,door:0.12},mid:{first:[80,200],gap:[180,320],max:3,door:0.25},high:{first:[50,120],gap:[90,180],max:5,door:0.4}};
const rndR=(a,b)=>a+Math.random()*(b-a);

function evInit(g){
  const R=EV_RATE[SET.evRate]||EV_RATE.mid;
  g.evOn=!!SET.events;g.evR=R;g.evAllowed=EV_ORDER.filter(id=>!(SET.evOff||[]).includes(id));
  g.ev=null;g.evLog=[];g.evCount=0;g.evPts=0;
  g.evLim=null;g.evRamp=null;g.evWindOnly=false;g.evAcc=1;g.evHold=0;g.evForceEB=false;g.evBlockClose=false;g.evBrake=1;g.evAct=null;g.ic=null;g.fq=null;
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
function evClear(g){g.evLim=null;g.evRamp=null;g.evWindOnly=false;g.evAcc=1;g.evHold=0;g.evForceEB=false;g.evBlockClose=false;g.evBrake=1;g.evAct=null;g.ic=null;g.fq=null;g.hold=null;g.hz=null;g.doorFault=null;g.flicker=false;g.rain=false;}
function evStart(g,id){
  if(g.ev)return false;
  const E=EV[id];if(!E)return false;
  g.ev={id,t0:g.time,trips0:g.pen.atp,state:'start'};g.evCount++;
  E.start(g,g.ev);
  evAlarm();haptic(id==='quake'?'quake':'alert');
  if(typeof ocRadio==='function')ocRadio(g,id,g.ev);          // 行控無線電通話（js/radio.js；語音＋字幕）
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
      if(g.v<=0.3&&g.pos<e.hz-1.5){e.stopped+=dt;if(e.stopped>=8){const byAtp=g.pen.atp>e.trips0;evFinish(g,byAtp?'late':'ok',byAtp?0:12,byAtp?'由 ATP 代為煞停，應自行 EB':'行控確認排除');}return;}
      if(g.pos>=e.hz-1.5){e.state='fail';g.evForceEB=true;toast('來不及停車，行控接管：緊急煞車','#ff7b7b',3.2);}
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
        e.sub=g.v<=0.3?`已停車待命，等待行控恢復（${Math.floor(e.wait)} 秒）`:`前方 ${Math.max(0,Math.round(e.hold-g.pos))} m 號誌顯示停止：請在紅燈前停車待命`;
        // 沒有空隙的判斷：位置越過號誌線 1 m 就是越過（不看速度，否則「緩慢蹭過去」會卡在中間）；沒越過且幾乎停住就開始等待
        if(g.pos>e.hold+1){g.trip=true;g.tripStrict=true;g.tripT=0;g.segPen+=15;g.pen.atp++;g.hold=null;g.hz=null;evFinish(g,'fail',-15,'越過停止信號');return;}
        if(g.v<=0.3&&g.pos<=e.hold+1){e.wait+=dt;   // 「幾乎停住」就算停妥：真人輕蹭手把造成的微小移動不該讓計時一直重來
          if(e.wait>=e.need){e.cleared=true;g.hold=null;g.hz.kind='signalgreen';g.evLim=25;g.evRamp=null;e.sub='號誌恢復：以 25 km/h 以下通過故障號誌';e.title='號誌恢復';toast('行控：號誌恢復，限速 25 km/h 通過','#9be39b',3.5);}}
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
    }},
  // 乘客緊急對講：按「接聽」；乘客按完就離開時要「逐節檢視」找出是哪一節；接著「回報行控」，下一站停車交由站務處理
  intercom:{can:g=>g.state==='run'&&g.k<g.S.length&&g.doors.state==='closed'&&g.v>3&&g.S[g.S.length-1]-g.pos>400,
    start(g,e){
      const cars=g.L.cars;e.car=1+Math.floor(Math.random()*cars);e.left=Math.random()<0.5;
      e.scn=['medical','item','mistake'][Math.floor(Math.random()*3)];
      e.phase='ring';e.curAt=g.cur;e.found=null;
      g.ic={car:e.car,view:0,left:e.left,phase:'ring',scn:e.scn};
      e.title=`第 ${e.car} 節車廂：乘客按下緊急對講`;
      e.sub=e.left?'乘客按完就離開了：按「📹 檢視車廂」逐節確認是哪一節':'按「📞 接聽」與乘客通話';
      evIcAct(g,e);
    },
    tick(g,e,dt){
      g.ic.phase=e.phase;
      if(e.phase==='handover'){if(g.cur!==e.curAt||g.state==='finish'){evFinish(g,'ok',e.pts,e.note);return;}}
      if(g.time-e.t0>(e.phase==='handover'?150:60)){evFinish(g,'late',0,e.phase==='ring'?'太久沒有回應，行控改請站務人員處理':'未在下一站交接，行控另行安排');}
    }},
  // 軌道異物（颱風天樹枝）：停車→通報行控→等候授權→下車排除→低速通過
  debris:{can:g=>{
      if(g.v<8||g.k>=g.S.length||g.rev)return false;
      const d=g.v*g.v/(2*0.9*g.M.brake)+120,at=g.pos+d;
      return g.S[g.k]-at>100&&evEnvAt(g,at)!=='tunnel'&&evEnvAt(g,g.pos)!=='tunnel';},
    start(g,e){
      const d=g.v*g.v/(2*0.9*g.M.brake)+120;
      e.hz=g.pos+d;g.hz={kind:'debris',pos:e.hz};e.phase='approach';e.failT=0;e.trips0=g.pen.atp;g.rain=true;
      e.title='軌道異物：前方有樹枝';e.sub='減速並在異物前停車，停妥後通報行控';ramp(g,45);
    },
    tick(g,e,dt){
      const d=e.hz-g.pos;
      if(e.phase==='fail'){e.failT+=dt;if(g.v<=0.05&&e.failT>6)evFinish(g,'fail',-25,'未能在異物前停車（遊戲不呈現後果，行控接管）');return;}
      if(e.phase==='approach'){
        e.sub=`前方 ${Math.max(0,Math.round(d))} m 軌道有異物：減速並在異物前停車`;
        if(g.v<=0.3&&d>3){e.phase='stopped';e.sub='已停妥：請通報行控';g.evHold=9999;
          g.evAct={label:'📻 通報行控',fn:()=>{e.phase='report';e.tRep=g.time;g.evAct=null;e.sub='已通報行控，等候授權下車處理…';if(typeof ocSay==='function')ocSay(g,'行控收到，請稍候確認安全。');}};}
        else if(d<=2){e.phase='fail';g.evForceEB=true;g.evAct=null;toast('來不及停車，行控接管：緊急煞車','#ff7b7b',3.2);}
      }else if(e.phase==='report'){
        if(g.time-e.tRep>=6){e.phase='ready';e.sub='行控已授權：穿好裝備、告知旅客後下車排除異物';
          if(typeof ocSay==='function')ocSay(g,'行控授權，請穿戴裝備並廣播告知旅客後下車，排除軌道異物。');
          g.evAct={label:'🧰 下車排除異物',fn:()=>{e.phase='clearing';e.tClr=g.time;g.evAct=null;toast('司機員離開駕駛室處理異物（旅客已廣播告知）','#a9e34b',3);}};}
      }else if(e.phase==='clearing'){
        const left=10-(g.time-e.tClr);e.sub=`排除異物中…（剩 ${Math.max(0,Math.ceil(left))} 秒）`;
        if(left<=0){g.hz=null;g.evHold=0;e.phase='resume';e.tRes=g.time;e.at=g.pos;g.evLim=25;g.evRamp=null;e.title='異物已排除';e.sub='以 25 km/h 以下通過，之後恢復正常';}
      }else if(e.phase==='resume'){
        if(g.pos-e.at>=180||g.time-e.tRes>60){const clean=g.pen.atp===e.trips0;evFinish(g,clean?'ok':'late',clean?12:4,clean?'':'處理期間 ATP 動作');}
      }
    }},
  // 豪大雨：高架／平面段降速（行控）、煞車效果變差（輪軌打滑），要提早煞車、停準車站
  rain:{can:g=>g.stations.some(s=>s.env!=='tunnel'),
    start(g,e){e.dur=90;e.lim=50;e.title='豪大雨：高架／平面段降速';e.sub=`行控降低速限至 ${e.lim} km/h（地下段不受限）；輪軌易打滑、煞車效果變差，請提早煞車、停準車站`;
      g.rain=true;g.evBrake=0.75;g.evWindOnly=true;ramp(g,e.lim);},
    tick(g,e){if(g.time-e.t0>=e.dur){g.rain=false;const clean=g.pen.atp===e.trips0;evFinish(g,clean?'ok':'late',clean?6:0,clean?'':'限速期間 ATP 動作');}}},
  // 外籍旅客求助：按「接聽」後聽（讀）英文問題，四選一；答對加分（快一點多加）、答錯扣分、逾時不計
  // 距下一站多遠才會來電（FQ_SAFE_FAR），以及通話中靠近到多近就中止（FQ_SAFE_NEAR），單位公尺
  foreign:{can:g=>g.state==='run'&&g.k<g.S.length&&g.doors.state==='closed'&&g.v>3&&g.S[g.S.length-1]-g.pos>300&&fqSafeNow(g)&&typeof fqMake==='function'&&fqMake(g,Math.random)!==null,
    start(g,e){
      e.q=fqMake(g,Math.random);e.phase='ring';e.pts=0;
      g.fq={q:e.q,phase:'ring',pick:-1};
      e.title='外籍旅客求助：對講機呼叫';e.sub='有外籍旅客用英語求助：按「📞 接聽」';
      g.evAct={label:'📞 接聽',fn:()=>{e.phase='ask';e.tAsk=g.time;g.fq.phase='ask';g.evAct=null;e.title='外籍旅客求助（英語）';e.sub='聽（或讀）旅客的問題，選出最適當的回答';fqSpeak(e.q.en);}};
    },
    tick(g,e){
      // 快到站或前方有彎道：先專心開車，通話取消、不扣分（全自動駕駛的文湖線不受影響）
      if(e.phase!=='result'&&!g.M.driverless&&((g.k<g.S.length&&g.S[g.k]-g.pos<FQ_SAFE_NEAR)||!fqStraight(g,FQ_CURVE_ABORT))){evFinish(g,'ok',0,'快到站或彎道，通話中止（不計分）');return;}
      if(e.phase==='ring'&&g.time-e.t0>40){evFinish(g,'late',0,'太久沒有接聽');return;}
      if(e.phase==='ask'&&g.time-e.tAsk>40){g.fq.phase='result';g.fq.pick=-2;e.phase='result';e.tRes=g.time;e.outcome='late';e.pts=0;e.note='逾時未作答';e.sub='逾時：正確答案已標示';}
      if(e.phase==='result'&&g.time-e.tRes>=5)evFinish(g,e.outcome,e.pts,e.note);
    }}
};
// 作答：i 為選項編號（0～3）
function fqAnswer(g,i){
  const e=g&&g.ev,f=g&&g.fq;if(!e||e.id!=='foreign'||e.phase!=='ask'||!(i>=0&&i<4))return false;
  const right=i===f.q.ans,fast=g.time-e.tAsk<=12;
  f.pick=i;f.phase='result';e.phase='result';e.tRes=g.time;
  if(typeof fqMark==='function')fqMark(f.q,right);
  e.outcome=right?'ok':'fail';e.pts=right?(fast?10:8):-3;e.note=right?(fast?'':'答對，但稍慢'):'答錯';
  e.title=right?'答對了！':'答錯了';e.sub=f.q.exp;
  toast(right?`答對了 +${e.pts}`:'答錯了 −3，正確答案已標示',right?'#9be39b':'#ff9b7b',3);
  return true;
}
// 軌道上某里程所在的場景（高架 elev／平面 grade／地下 tunnel）
function evEnvAt(g,s){for(const c of g.sec)if(s>=c.a&&s<c.b)return c.env;return g.sec[g.sec.length-1].env;}
// 乘客對講的操作按鈕（依階段換標籤）：接聽／檢視下一節車廂／回報行控
function evIcAct(g,e){
  const cars=g.L.cars,scn={medical:['有乘客身體不適，需要協助','（遊戲設計）乘客表示身體不適'],item:['車廂內有無人認領的可疑物品','（遊戲設計）乘客回報發現遺留物品'],mistake:['乘客表示是誤觸對講鈕，沒有異狀','（遊戲設計）乘客誤觸']}[e.scn];
  const found=()=>{
    e.found=g.time;const fast=g.time-e.t0<=(e.left?15:12);
    if(e.scn==='mistake'){evFinish(g,'ok',fast?8:5,'確認為誤觸，無須處置');return;}
    e.phase='report';e.sub=`${scn[0]}：請回報行控，下一站停車交由站務處理`;e.pts=fast?10:6;e.note=fast?'':'反應較慢';
    toast(`第 ${e.car} 節：${scn[0]}`,'#4dabf7',4);
    g.evAct={label:'📻 回報行控',fn:()=>{e.phase='handover';g.evAct=null;e.sub='已回報行控：下一站停車開門，交由站務人員處理';if(typeof ocSay==='function')ocSay(g,'行控收到，下一站請站務人員在月台等候，列車請正常停靠。');}};
  };
  if(e.left){
    g.evAct={label:`📹 檢視車廂 1/${cars}`,fn:()=>{
      g.ic.view=(g.ic.view%cars)+1;const v=g.ic.view;
      if(v===e.car){found();}else{g.evAct.label=`📹 檢視車廂 ${v%cars+1}/${cars}`;}
    }};
  }else{
    g.evAct={label:'📞 接聽',fn:()=>{g.ic.view=e.car;found();}};
  }
}
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
