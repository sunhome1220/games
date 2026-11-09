'use strict';
// 手把：Gamepad API（標準對應：0=A/✕ 1=B/○ 2=X/□ 3=Y/△ 4=LB 5=RB 8=Back 9=Start 12/13=十字鍵上/下；左搖桿 axes[1]）
// 以輪詢方式讀取，每格由主迴圈呼叫 gpPoll。沒有手把時完全不做事。
const GP={id:null,prev:{},hold:{},seen:false,lastNotch:null,rumbleT:0};
const GP_DEAD=0.55,GP_RELEASE=0.3,GP_REP0=0.5,GP_REP=0.25;   // 死區、放開門檻、長按多久開始連續、連續間隔（秒）
function gpPad(){
  const ps=(typeof navigator.getGamepads==='function'?navigator.getGamepads():[])||[];
  for(const p of ps)if(p&&p.connected)return p;
  return null;
}
function gpMenuOpen(){return !document.getElementById('menu').classList.contains('hidden');}
function gpResultOpen(){return !document.getElementById('result').classList.contains('hidden');}
function gpBoardOpen(){return !document.getElementById('board').classList.contains('hidden');}
function gpRumble(strong,weak,ms){
  const p=gpPad();if(!p||typeof SET==='undefined'||SET.haptic===false)return;
  const a=p.vibrationActuator;if(!a||typeof a.playEffect!=='function')return;
  try{a.playEffect('dual-rumble',{startDelay:0,duration:ms,strongMagnitude:strong,weakMagnitude:weak});}catch(e){}
}
// 邊緣觸發：按下的那一格回傳 true；repeat 為 true 時長按會連續觸發（用於加減檔）
function gpEdge(key,down,dt,repeat){
  if(!down){GP.prev[key]=false;GP.hold[key]=0;return false;}
  if(!GP.prev[key]){GP.prev[key]=true;GP.hold[key]=0;return true;}
  if(!repeat)return false;
  const h0=GP.hold[key];GP.hold[key]+=dt;
  const n0=h0<GP_REP0?-1:Math.floor((h0-GP_REP0)/GP_REP),n1=GP.hold[key]<GP_REP0?-1:Math.floor((GP.hold[key]-GP_REP0)/GP_REP);
  return n1>n0;
}
function gpToast(t){if(typeof toast==='function'&&typeof G!=='undefined'&&G)toast(t,'#9be39b',3);}
function gpPoll(dt){
  const p=gpPad();
  if(!p){if(GP.id){GP.id=null;gpToast('手把已斷線');}return;}
  const b=i=>!!(p.buttons[i]&&(p.buttons[i].pressed||p.buttons[i].value>0.6));
  const ay=p.axes[1]||0;
  if(GP.id!==p.id){
    const first=GP.id===null;GP.id=p.id;GP.prev={};GP.hold={};
    gpToast('🎮 已連接手把');
    if(first&&typeof gpTutorial==='function')gpTutorial();
  }
  const anyDown=p.buttons.some(x=>x&&x.pressed);
  // 選單／教學／結算：A 確認、B 返回
  const tut=document.getElementById('tut'),gt=document.getElementById('gptut');
  const a=gpEdge('a',b(0),dt,false);
  if(gt&&!gt.hidden){if(a||gpEdge('b2',b(1),dt,false))document.getElementById('gptut-ok').click();return;}
  if(tut&&!tut.hidden){if(a)document.getElementById('tut-ok').click();return;}
  if(gpMenuOpen()){if(a)document.getElementById('m-go').click();return;}
  if(gpResultOpen()){if(a)document.getElementById('r-again').click();else if(gpEdge('b3',b(1),dt,false))document.getElementById('r-menu').click();return;}
  if(gpBoardOpen()||typeof G==='undefined'||!G)return;
  // 駕駛中
  const up=b(12)||ay<-GP_DEAD,dn=b(13)||ay>GP_DEAD;
  if(!up&&!dn&&Math.abs(ay)<GP_RELEASE){GP.prev.up=false;GP.prev.dn=false;GP.hold.up=0;GP.hold.dn=0;}
  if(gpEdge('up',up,dt,true))setNotch(G.notch+1);
  if(gpEdge('dn',dn,dt,true))setNotch(G.notch-1);
  if(a)setNotch(0);
  if(gpEdge('b',b(1),dt,false))setNotch(-8);
  if(gpEdge('x',b(2),dt,false))closeDoors();
  if(gpEdge('y',b(3),dt,false))horn();
  if(gpEdge('lb',b(4),dt,false))openDoors('L');
  if(gpEdge('rb',b(5),dt,false))openDoors('R');
  if(gpEdge('back',b(8),dt,false))toggleReverse();
  if(gpEdge('start',b(9),dt,false))togglePause();
  // 手把震動：換檔輕、EB 重、ATP 動作脈衝
  if(GP.lastNotch!==G.notch){
    if(GP.lastNotch!==null){G.notch===-8?gpRumble(1,0.8,450):G.notch===0?gpRumble(0.2,0.5,120):gpRumble(0.15,0.35,60);}
    GP.lastNotch=G.notch;
  }
  if(G.trip&&!GP.trip)gpRumble(0.9,0.6,350);
  GP.trip=!!G.trip;
}
function gpInit(){
  const ok=document.getElementById('gptut-ok');if(!ok)return;
  ok.onclick=()=>{try{localStorage.setItem('mrt-gp-tut','1');}catch(e){}document.getElementById('gptut').hidden=true;
    if(GP.pausedByTut){GP.pausedByTut=false;if(typeof paused!=='undefined'&&paused)togglePause();}};
}
// 第一次接上手把：顯示按鍵對照（遊戲進行中會先暫停）
function gpTutorial(){
  let seen=false;try{seen=localStorage.getItem('mrt-gp-tut')==='1';}catch(e){}
  if(seen)return;
  const tut=document.getElementById('tut');if(tut&&!tut.hidden)return;       // 首次教學還沒關：先看那個
  if(typeof G!=='undefined'&&G&&!gpMenuOpen()&&!gpResultOpen()&&typeof paused!=='undefined'&&!paused){togglePause();GP.pausedByTut=true;}
  document.getElementById('gptut').hidden=false;
}
