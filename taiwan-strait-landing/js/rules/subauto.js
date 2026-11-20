'use strict';
/* ---------- 潛艦自主執行任務（2026-11-19）----------
   現實中潛艦在水下幾乎不能通訊，指揮官只能出港前交代任務（目標類型），航行中由艦長自行判斷，不會每個階段被遙控一格一格走。
   設定「潛艦操作方式」＝自主（預設）時，人類操作的一方，台灣潛艦（劍龍級、海鯤）與共軍潛艦棋子在每個己方階段開始時
   由電腦依任務自行行動（沿用電腦代打的潛艦邏輯），玩家不能移動或開火；只有回港、或每 3 個回合一次的「通訊窗口」可以更換任務（★推估）。
   「完全手動」＝和以前一樣逐格操控。電腦操作的一方、電腦推演、純模擬不受影響。美軍攻擊潛艦本來就由電腦操作。 */
const SUB_MIS={
  def:[['','自動','由電腦判斷：價值乘以命中率最高的目標。'],['cvy','運輸船團','優先打補給船團、運輸船團。'],['lnd','載運部隊的登陸艦','優先打載著旅的兩棲艦群與滾裝船。'],['cv','航艦','優先打共軍航艦。'],['dd','護航艦','優先打護航艦，削弱艦隊防空。']],
  atk:[['','自動','由電腦判斷：價值乘以命中率最高的目標。'],['csg','美日航艦打擊群','優先打美軍航艦打擊群。'],['fl','台灣艦隊','優先打台灣海軍艦隊。'],['esc','美日驅逐艦與巡洋艦','優先打柏克級、巡洋艦、出雲級與海自護衛艦、補給艦。']]
};
const PSUB_MISSION={csg:['csg'],fl:['fl'],esc:['ddg','cg','jdg','jdd','ddh','tak']}; // 目標以 e.fl?'fl':e.type 比對
const SUB_WINDOW=3;
const subAuto=u=>!!u&&S.subCtl==='auto'&&S.ctrl[u.side]==='human'&&(u.type==='hk'||u.type==='psub');
function subMisOf(u){ // 這艘潛艦的任務；第一次用到時取設定精靈選的（'auto'＝空字串＝自動）
  if(u.mis===undefined){const el=document.getElementById(u.side==='def'?'optSubMisD':'optSubMisA'),v=el?el.value:'';u.mis=v==='auto'?'':v;u.misT=S.turn;}
  return u.mis;
}
const subWindowOpen=u=>(u.type==='hk'?subInPort(u):psubInPort(u))||S.turn-(u.misT||0)>=SUB_WINDOW;
async function subAutoRun(side){ // 己方階段開始：人類操作的一方，潛艦依任務自行行動，然後鎖定（不能再手動操作）
  if(S.subCtl!=='auto'||S.ctrl[side]!=='human'||S.sim||S.video||S.over)return;
  for(const u of S.units.filter(x=>x.side===side&&alive(x)&&(x.type==='hk'||x.type==='psub'))){
    subMisOf(u);u.auto=1;
    if(u.type==='hk')await subTurn(u);else await psubTurn(u);
    if(alive(u)){u.moved=true;u.acted=true;}
  }
}
function subMisPanelHTML(u){
  if(!subAuto(u)||!alive(u))return '';
  const list=SUB_MIS[u.side],cur=subMisOf(u),nm=v=>(list.find(x=>x[0]===v)||list[0])[1];
  let o='<div class="hint"><b>自主執行任務</b>：任務「'+nm(cur)+'」。潛艦在水下無法接收指令，每個己方階段開始時由艦長依任務自行行動，不能手動移動或開火。';
  if(!subWindowOpen(u))return o+'下一次通訊窗口：回港，或第 '+((u.misT||0)+SUB_WINDOW)+' 回合。</div>';
  o+='現在是通訊窗口，可更換任務（下一個己方階段起生效）：</div><div class="cvord">'+list.map(([v,n])=>'<button class="ghost subMis" data-m="'+v+'"'+(v===cur?' disabled':'')+'>'+(v===cur?'✓ ':'')+n+'</button>').join('')+'</div>';
  setTimeout(()=>{document.querySelectorAll('.subMis').forEach(b=>b.onclick=()=>{u.mis=b.dataset.m;u.misT=S.turn;log(uname(u)+' 通訊窗口：任務改為「'+nm(u.mis)+'」');render();});},0);
  return o;
}
