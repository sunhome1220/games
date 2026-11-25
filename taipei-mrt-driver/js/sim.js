'use strict';
// 模擬核心：關卡建立、物理（step）、ATP、計分、車門與主控器邏輯。**這個檔案不碰 DOM**，可在 Node 用 vm 載入做單元測試（見 tests/unit）。
// 依賴（需在載入前或呼叫前存在於全域）：資料 MODELS／FLEETS／pickModel／pickFormation（js/models.js）、LINES（js/lines.js）、
//   全域狀態 G（目前這一班）與 SET（設定）、事件引擎 evTick／evLimit／evAbort 等（js/events.js），
//   以及「副作用」函式（畫面與聲音，由 index.html 提供；Node 測試以空函式取代）：
//   haptic、hapRumble、beep、sfxNotch、sfxStop、playChime、chimeOpen、chimeClose、announce、syncLever、syncRevBtn、showResult；事件引擎 evInit／evTick／evLimit／evAbort。

const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function hash(n){n=Math.imul((n^61)^(n>>>16),9);n^=n>>>4;n=Math.imul(n,0x27d4eb2d);n^=n>>>15;return (n>>>0)/4294967296;}
function hstr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

/* ========================= 列車與物理參數 ========================= */
const ACC_FR=[0.30,0.55,0.80,1.00];                 // P1～P4 佔車型最大加速度的比例（最大值見 MODELS.accel）
const DEC_FR=[0.15,0.30,0.45,0.60,0.75,0.88,1.00];  // B1～B7 佔車型正常減速度的比例（正常減速度、緊急減速度見 MODELS）
const ATP_FR=0.95;                                  // ATP 停車曲線採用的減速度（占正常減速度）
const ZONE_FR=0.75;                                 // 限速區間前的減速曲線
const REV_LIM=5;                                     // 退行限速 km/h
const MIN_OPEN=6;                                   // 開門後最少停留秒數
const DWELL=22;                                     // 時刻表停站秒數
const TOL_OPEN_SHORT=10, TOL_OPEN_LONG=30;          // 可開門的停車誤差範圍（短停 10 m／過站 30 m）


// 由 0 加速到 vc（P4）所損失的時間 = 加速時間 − 加速距離/vc，依車型的恆定加速度區與功率區計算
function accLoss(M,vc){let v=0,s=0,tt=0;const dt=0.05;while(v<vc&&tt<200){const a=M.accel*Math.min(1,M.knee/Math.max(v,0.1))-(0.02+0.00008*v*v);if(a<=0.02)break;s+=v*dt+0.5*a*dt*dt;v+=a*dt;tt+=dt;}return tt-s/vc;}
function buildRun(opt){
  const mid=pickModel(opt.line,opt.model),M=MODELS[mid],formation=pickFormation(opt.line,mid);
  // 路線資料＋車型決定的列車長度、車廂數與每節車門數（月台門位置依此計算）
  const L=Object.assign({},LINES[opt.line],{trainLen:M.len,cars:M.cars,carLen:M.carLen,doorsPerCar:M.doorsPerCar}),N=L.st.length;
  let from=clamp(opt.from|0,0,N-1),to=clamp(opt.to|0,0,N-1);
  if(from===to)to=from<N-1?from+1:from-1;
  const rev=to<from;                                   // 站序遞減＝反向行駛
  const idxs=[];for(let i=from;i!==to+(rev?-1:1);i+=rev?-1:1)idxs.push(i);
  const stations=[];let pos=0;
  idxs.forEach((i,k)=>{
    if(k>0)pos+=L.d[rev?i:i-1];                        // 站序 i-1 與 i 之間的距離
    const sc=L.sc[i]||{};
    // 靠右行駛：島式月台在車的左側、側式月台在右側（混合式視為島式）
    const side=L.plat[i]==='side'?'R':'L';
    // 風景的左右以站序遞增方向定義，反向行駛時左右對調
    const sw=rev?{L:sc.R,R:sc.L}:{L:sc.L,R:sc.R};
    stations.push({name:L.st[i],code:L.code[i],pos,idx:i,env:L.env[i],plat:L.plat[i],side,sc:{z:sc.z||'mid',L:sw.L||[],R:sw.R||[],ro:!!sc.ro,lm:sc.lm||[]}});
  });
  const S=stations.map(s=>s.pos);
  // 場景分段（以站間中點為界，同一站的月台都在同一種場景）
  const sec=stations.map((s,i)=>({a:i===0?-1e9:(S[i-1]+S[i])/2,b:i===stations.length-1?1e9:(S[i]+S[i+1])/2,env:s.env,sc:s.sc,pos:s.pos}));
  // 限速區間：由 OpenStreetMap 的真實軌道形狀算出的彎道（js/lines.js 的 curves，半徑與依半徑推估的限速）。
  // 推估限速 = √(橫向加速度 1.0 m/s² × 半徑)，不是北捷公布的彎道限速。只取限速低於車型上限的彎道，且不含月台範圍內的彎道。
  const zones=[];
  {
    const C0=L.d.slice(0,idxs[0]).reduce((x,y)=>x+y,0);   // 起點站在路線上的累計里程
    const end=S[S.length-1];
    for(const c of (L.curves||[])){
      const a0=rev?C0-c.s1:c.s0-C0,a1=rev?C0-c.s0:c.s1-C0;   // 轉成本班的里程（反向行駛時前後對調、左右對調）
      const s0=Math.max(a0,0),s1=Math.min(a1,end);
      if(s1-s0<80||c.lim>=M.vmax)continue;
      if(S.some(p=>p>s0-60&&p<s1+60))continue;               // 站內與進出站範圍的彎道由進站減速曲線處理
      zones.push({s0,s1,lim:Math.max(25,c.lim),R:c.R,dir:rev?(c.dir==='L'?'R':'L'):c.dir});
    }
    zones.sort((x,y)=>x.s0-y.s0);
  }
  // 時刻表
  const tArr=[0],tDep=[20];
  for(let i=1;i<stations.length;i++){
    const d=S[i]-S[i-1],vc=Math.min(20,M.vmax/3.6*0.93);
    let rest=d,tz=0;
    for(const z of zones){if(z.s0>=S[i-1]&&z.s1<=S[i]){const len=z.s1-z.s0;tz+=len/Math.min(vc,z.lim/3.6)+6;rest-=len;}} // 限速區間：低速行駛＋進出區間的加減速
    const run=(rest/vc+tz+accLoss(M,vc)+vc/(2*0.85*M.brake))*1.06+6; // 加速損失依車型功率計算；+6 秒：進站最後的慢行對位
    tArr[i]=tDep[i-1]+run;tDep[i]=tArr[i]+DWELL;
  }
  const th=opt.theme==='auto'?['day','dusk','night'][Math.floor(Math.random()*3)]:opt.theme;
  const g={L,M,formation,opt,stations,S,sec,zones,tArr,tDep,theme:th,dec:DEC_FR.map(x=>x*M.brake),
    state:'ready',pos:0,v:0,aAct:0,notch:0,time:0,k:1,cur:0,
    doors:{state:'closed',side:null,t:0,frac:0,openT:0},stopSt:null,
    trip:false,tripT:0,overT:0,lim:M.vmax,over:false,interlock:false,rev:false,rain:false,
    results:[],segPen:0,pen:{atp:0,door:0,miss:0,rev:0},ebUsed:false,
    lastStop:null,arrTime:null,boardFrac:0,toast:null,endT:0,warnAt:0,
    nextAnn:-1};
  evInit(g);return g;
}

function toast(text,color,dur){G.toast={text,color:color||'#fff',t:0,dur:dur||2.6};}

/* ========================= 物理與規則 ========================= */
function atpLimit(g){
  if(g.rev)return REV_LIM;                             // 退行：低速限制
  let lim=g.M.vmax;
  for(const z of g.zones){
    if(g.pos>z.s1)continue;
    if(g.pos>=z.s0)lim=Math.min(lim,z.lim);
    else{const vz=z.lim/3.6;lim=Math.min(lim,Math.sqrt(vz*vz+2*ZONE_FR*g.M.brake*(z.s0-g.pos))*3.6+3);} // 牌子前以平緩曲線遞減，到牌子時剛好降到限速
  }
  if(g.k<g.S.length){
    const d=g.S[g.k]-g.pos;
    const dd=Math.max(d,0);
    lim=Math.min(lim,Math.sqrt(2*ATP_FR*g.M.brake*dd)*3.6+8);
  }
  lim=Math.min(lim,evLimit(g));                         // 突發事件的臨時限速
  if(g.hold!=null){                                      // 前方停止信號：像停車線一樣的減速曲線
    const dh=g.hold-g.pos;lim=dh<=0.5?0:Math.min(lim,Math.sqrt(2*ATP_FR*g.M.brake*(dh-0.5))*3.6+3);
  }
  return lim;
}
function toggleReverse(){
  const g=G;if(!g||g.state==='result'||g.state==='finish')return;
  if(g.v>0.05){toast('停妥後才能切換前進／退行','#ffd37a');return;}
  if(g.doors.state!=='closed'){toast('請先關門','#ffd37a');return;}
  if(g.trip){toast('ATP 動作中，請先將主控器回到 N 位復歸','#ffd37a');return;}
  if(!g.rev){
    const j=stationNear(g);
    if(j<0||j!==g.k||g.k>=g.S.length){toast('退行只限在要停靠的月台範圍內','#ffd37a');return;}
    if(g.S[g.k]-g.pos>-0.05){toast('還沒超過停車線，往前開即可，不需要退行','#ffd37a');return;}
    g.rev=true;g.segPen+=5;g.pen.rev++;setNotch(0);
    toast(`退行：限速 ${REV_LIM} km/h，每次扣 5 分。輕推 P1 後退，快到線時放回 N／B1`,'#ffb347',4.2);
  }else{g.rev=false;setNotch(0);toast('恢復前進','#9be39b');}
  syncRevBtn();
}
function stationNear(g){ // 目前車頭所在的月台（誤差在可開門範圍內）
  for(let j=0;j<g.stations.length;j++){const e=g.S[j]-g.pos;if(e<=TOL_OPEN_SHORT&&e>=-TOL_OPEN_LONG)return j;}
  return -1;
}
function setNotch(n){
  if(!G||G.state==='result')return;
  n=clamp(Math.round(n),-8,4);
  if(n===-8&&G.notch!==-8)G.ebUsed=true;
  const old=G.notch;G.notch=n;syncLever();sfxNotch(old,n);if(old!==n)haptic(n>0?'p':n===0?'n':n===-8?'eb':'b',n>0?n:-n);
}
function step(dt){
  const g=G,D=g.doors;
  g.time+=dt;
  if(g.toast){g.toast.t+=dt;if(g.toast.t>g.toast.dur)g.toast=null;}
  // 車門動作
  if(D.state==='opening'){D.t+=dt;D.frac=Math.min(1,D.t/2.2);if(D.t>=2.2){D.state='open';D.openT=0;}}
  else if(D.state==='open'){D.openT+=dt;g.boardFrac=Math.min(1,D.openT/8);}
  else if(D.state==='closing'){D.t+=dt;D.frac=Math.max(0,1-D.t/2.6);if(D.t>=2.6){D.state='closed';D.frac=0;D.side=null;evOnDoorsClosed(g);}}
  // 有效檔位
  let n=g.notch;
  if(g.trip||g.evForceEB)n=-8;
  g.interlock=false;
  if(g.evHold>0){g.evHold-=dt;if(n>0)n=0;}                    // 地震：暫停發車
  if((D.state!=='closed'||g.doorFault)&&n>0){n=0;g.interlock=true;}   // 車門未關或閉鎖燈未亮：不能加速
  // 目標加速度
  const kmh=g.v*3.6;
  let cmd=0,jl=1.1;
  if(n>0){cmd=ACC_FR[n-1]*g.M.accel*Math.min(1,g.M.knee/Math.max(g.v,0.1))*g.evAcc;jl=1.1;}   // 低速恆定加速度，高速受功率限制
  else if(n>-8&&n<0){cmd=-g.dec[-n-1];jl=1.6;}
  else if(n===-8){cmd=-g.M.eb;jl=4;}
  const da=cmd-g.aAct;g.aAct+=clamp(da,-jl*dt,jl*dt);
  const resist=g.v>0?(0.02+0.00008*g.v*g.v):0;
  let vN=g.v+(g.aAct-resist)*dt;
  let justStopped=false,stopA=0;
  if(vN<=0){
    if(g.v>0){justStopped=true;stopA=Math.max(0,-g.aAct);sfxStop();}
    vN=0;if(g.aAct<0)g.aAct=0;
  }
  g.pos+=(g.rev?-1:1)*(g.v+vN)/2*dt;g.v=vN;   // 退行時沿反方向移動
  // ATP
  g.lim=atpLimit(g);
  g.over=kmh>g.lim+0.5&&!g.trip;
  if(!g.trip){
    // 前方有停止信號（終點速度為零的停車目標）時，不論模式都要停車才復歸，否則會衝過信號
    if(kmh>g.lim+4){g.overT+=dt;if(g.overT>0.8){g.trip=true;g.tripStrict=!!SET.atpStrict||g.hold!=null;g.tripT=0;g.overT=0;g.segPen+=10;g.pen.atp++;toast('ATP 動作：超速，自動緊急煞車',"#ff7b7b",3.2);beep(520,0.6,'square',0.18);}}
    else g.overT=Math.max(0,g.overT-dt*2);
  }else if(g.tripStrict){
    // 嚴格：必須完全停車，再等 2 秒，並把主控器回到 N 位才復歸
    if(g.v<=0){g.tripT+=dt;if(g.tripT>2&&g.notch<=0){g.trip=false;toast('ATP 已復歸，可重新發車','#9be39b');}else if(g.tripT>2&&g.tripT<2.1){toast('請將主控器回到 N 位以復歸 ATP','#ffd37a',3);}}
  }else{
    // 寬鬆（預設）：速度降到限速以下（或已停住），且主控器在 N 或煞車位就復歸，不必停到底
    if(kmh<=g.lim-1||g.v<=0.05){
      if(g.notch<=0){g.trip=false;g.tripT=0;toast(g.v<=0.05?'ATP 已復歸，可重新發車':'ATP 已復歸：速度已降到限速以下','#9be39b');}
      else if(g.time-(g._tripHint||0)>3){g._tripHint=g.time;toast('速度已低於限速，請將主控器回到 N 位以復歸 ATP','#ffd37a',3);}
    }
  }
  evTick(g,dt);                                             // 突發事件
  if(g.trip&&!g._tripH){g._tripH=true;haptic('atp');}else if(!g.trip)g._tripH=false;   // ATP 動作的震動（只在剛動作時一次）
  hapRumble(g);                                              // 緊急煞車持續時的低頻震動
  // 退行超出月台範圍：ATP 動作
  if(g.rev&&!g.trip&&g.k<g.S.length&&g.pos<g.S[g.k]-25){g.trip=true;g.tripStrict=true;g.tripT=0;g.segPen+=10;g.pen.atp++;toast('退行超出月台範圍，ATP 緊急煞車','#ff7b7b',3.2);beep(520,0.6,'square',0.18);}
  // 停車事件
  if(justStopped){
    const j=stationNear(g);
    g.lastStop={a:stopA,j,err:j>=0?g.S[j]-g.pos:null};
    if(j===g.k&&g.arrTime===null){g.arrTime=g.time;}
    if(j===g.k){
      const e=g.S[j]-g.pos;
      const txt=Math.abs(e)<0.05?'誤差 0.0 m':`誤差 ${e>0?'短':'過'} ${Math.abs(e).toFixed(1)} m`;
      toast(`停車完成　${txt}`,Math.abs(e)<=1?'#9be39b':Math.abs(e)<=4?'#ffd37a':'#ff9b7b',3);
      if(g.doors.state==='closed'&&Math.abs(e)<=TOL_OPEN_SHORT+1)playChime();
    }
  }
  // 冒進過站
  if(g.k<g.S.length&&g.pos>g.S[g.k]+TOL_OPEN_LONG&&g.doors.state==='closed'){
    const st=g.stations[g.k];
    g.results.push({name:st.name,err:null,dt:null,acc:0,pun:0,com:0,score:0,miss:true});
    g.pen.miss++;toast(`冒進過站：${st.name}（未停靠）`,'#ff7b7b',3.5);
    g.k++;g.arrTime=null;g.segPen=0;g.boardFrac=0;
    if(g.k>=g.S.length){finishRun();}
  }
  // 起步後更新目前站（離開月台才切到下一個目標，語音報站）
  if(g.v>0.5&&g.nextAnn!==g.k&&g.k<g.S.length&&g.pos>g.S[g.cur]+30){
    g.nextAnn=g.k;announce('next',g.stations[g.k]);
  }
  if(g.state==='ready'&&g.pos>1)g.state='run';
  if(g.endT>0){g.endT-=dt;if(g.endT<=0)showResult();}
}
function scoreArrival(g,j){
  const e=g.S[j]-g.pos,a=Math.abs(e);
  let acc=a<=0.5?100:a<=1?95:a<=2?85:a<=4?65:a<=8?40:15;
  if(e<0&&a>2)acc-=10;acc=Math.max(0,acc);
  const arr=g.arrTime===null?g.time:g.arrTime;
  const dt=arr-g.tArr[j];const ad=Math.abs(dt);
  const pun=ad<=10?100:ad<=20?90:ad<=40?70:ad<=80?45:20;
  const sa=g.lastStop?g.lastStop.a:0;
  let com=100-Math.min(70,sa/0.8*70);
  if(g.ebUsed)com-=15;
  com=Math.max(0,Math.round(com));
  const score=Math.max(0,Math.round(acc*0.5+pun*0.25+com*0.25-g.segPen));
  return {name:g.stations[j].name,err:e,dt,acc,pun,com,score,miss:false};
}

/* ========================= 車門 ========================= */
function openDoors(side){
  const g=G;if(!g||g.state==='result')return;
  const D=g.doors;
  if(D.state!=='closed')return;
  if(g.v>0.05){toast('列車尚未停妥','#ffd37a');return;}
  const j=stationNear(g);
  if(j<0){toast('不在月台範圍，無法開門','#ffd37a');return;}
  const st=g.stations[j];
  if(side!==st.side){g.segPen+=3;g.pen.door++;toast(`車門側錯誤！本站應開${st.side==='L'?'左':'右'}側`,'#ff7b7b',3);beep(300,0.25,'square',0.15);return;}
  D.state='opening';D.side=side;D.t=0;D.openT=0;haptic('doorOpen');
  if(g.rev){g.rev=false;syncRevBtn();}
  chimeOpen();
  g.stopSt=j;
  if(j===g.k){ // 本站到站計分
    const r=scoreArrival(g,j);g.results.push(r);
    g.cur=j;g.k=j+1;g.segPen=0;g.arrTime=null;g.ebUsed=false;g.boardFrac=0;
    toast(`${st.name}　${r.score} 分　（停車 ${r.acc}／準點 ${r.pun}／舒適 ${r.com}）`,r.score>=85?'#9be39b':r.score>=60?'#ffd37a':'#ff9b7b',4);
    announce('arrive',st);
    if(g.k>=g.S.length){g.endT=7;g.state='finish';}
  }else if(j===g.cur){g.boardFrac=0;}
}
function closeDoors(){
  const g=G;if(!g||g.state==='result')return;
  const D=g.doors;
  if(D.state==='open'){
    if(D.openT<MIN_OPEN){toast('乘客上下車中，請稍候','#ffd37a');return;}
    if(g.evBlockClose){toast('清客中，旅客換乘完成前請保持開門','#ffd37a');return;}
    if(g.state==='finish'){return;}
    D.state='closing';D.t=0;chimeClose();haptic('doorClose');
  }
}
function finishRun(){G.endT=G.endT||1.5;G.state='finish';}
