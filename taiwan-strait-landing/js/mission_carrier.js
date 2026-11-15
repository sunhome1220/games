'use strict';
/* ---------- 關卡：擊沉共軍航艦（守方） ----------
   用主遊戲 2026 年的兵力與規則（武器數字不為關卡調整）；限時 4 回合內把任一艘共軍航艦打到失去戰力（剩 1 步以下或沉沒）。
   結局「攻方暫停攻台」是假設情境：損失航艦的政治與軍事衝擊很大，但是否因此放棄攻台沒有可靠依據。 */
MISSION_DEFS.carrier={
  title:'擊沉航艦',
  cfg:{optMode:'play',optSide:'def',optEra:'2026',optT:'8',optNews:'2'},
  brief:'共軍兩個航艦群（遼寧、山東）在台灣東側海域活動，掩護登陸並從東面夾擊。航艦是共軍的指標性資產，每艘約 2,500 名官兵，周圍有 055、052D、054A 護航艦的多層防空與反潛。<br>你指揮台灣守方，要在攻方登陸台灣之前，把至少一艘航艦打到失去戰力。',
  goal:'第 4 回合結束前，任一艘共軍航艦沉沒或只剩 1 步（失去作戰能力）。台灣在這之前失守也算失敗。',
  stars:'第 2 回合前完成 ★★★、第 3 回合 ★★、第 4 回合 ★',
  tips:['潛艦（劍龍級、海鯤）的重型魚雷是打航艦最有效的武器，但要先接近到約 60 km 內；護航艦越多，命中率越低。',
    '空軍「攻擊船團」用空射反艦飛彈，岸置雄風與艦隊齊射也能打；航艦在護航艦防空範圍內，飛彈要先被攔截，同時打的枚數越多越能突破。',
    '先打掉護航艦，削弱航艦的防空與反潛。',
    '美國情報與天候都會影響戰局；別忘了台灣本身也要守住。'],
  note:'本關沿用主遊戲的規則與 2026 年的兵力，武器數字沒有為了關卡調整。結局「攻方暫停攻台」是假設情境，不是對真實戰局的預測。',
  ids:null,
  check(){
    if(!this.ids||!this.ids.length){const cvs=S.units.filter(u=>u.type==='cv'&&u.side==='atk');this.ids=cvs.map(u=>u.id);this.snap={CV:JSON.parse(JSON.stringify(S.stats.cvUse||{})),UB:JSON.parse(JSON.stringify(S.stats.useBy||{})),U:Object.assign({},S.stats.use||{}),F:Object.assign({},S.stats.fired||{}),P:Object.assign({},S.pools),TW:S.air?S.air.TW:0,PLA:S.air?S.air.PLA:0,ships:S.units.filter(u=>u.fl&&alive(u)).reduce((a,u)=>a+u.hp,0)};this.nm={};cvs.forEach(u=>{this.nm[u.id]=u.cvi!=null&&AIR.CV[u.cvi]?AIR.CV[u.cvi].n:'共軍航艦';});} // 開局時航艦棋子還沒擺上前不算；先記下艦名（沉沒後棋子就不在了）
    if(!this.ids.length)return null;
    for(const id of this.ids){const u=S.units.find(x=>x.id===id);const nm=(this.nm&&this.nm[id])||'共軍航艦';
      if(!u||!alive(u)||u.hp<=1){const t=S.turn,st=t<=2?3:t===3?2:1;
        return {t:(u&&alive(u)?'重創':'擊沉')+'航艦',stars:st,d:'第 '+t+' 回合，'+nm+(u&&alive(u)?' 被打到只剩 1 步、失去作戰能力':' 被擊沉')+'。<br><b>（假設情境）</b>失去航艦讓共軍東面夾擊的計畫瓦解，國際與國內壓力驟增，北京決定暫停攻台行動。這只是關卡結局，現實中是否會因此放棄攻台沒有可靠依據。',
          extra:carrierDebrief(nm,t,st)};}}
    return null;
  },
  phase(side){if(side==='atk'&&S.turn>4){endGame('第 4 回合結束，共軍航艦仍保有戰力，任務失敗。','atk','任務失敗');return true;}return false;},
  lose(early){return {d:(early||'未能在時限內重創航艦。')+'<br>可以試試先讓潛艦接近航艦、集中空軍與岸置飛彈同時齊射，或先打掉護航艦。'};}
};

// 結算細節：航艦受到哪些攻擊、最後由誰完成、雙方損失與彈藥消耗（都取自戰局實際紀錄；以任務開始時的兵力與存量為基準）
function carrierDebrief(nm,t,st){
  const H=(S.hits||[]).filter(h=>h.type==='cv'&&h.side==='atk'&&h.cvn===nm),last=H[H.length-1];
  const by={};H.forEach(h=>{by[h.why]=(by[h.why]||0)+h.n;});
  const D=MISSION_DEFS.carrier.snap||{P:S.p0,TW:S.air?S.air.TW0:0,PLA:S.air?S.air.PLA0:0,ships:S.rocShips0||0},P=S.pools,P0=D.P;
  const U0=D.U||{},F0=D.F||{},dif=(A,B)=>Object.entries(A||{}).map(([k,v])=>[k,v-(B[k]||0)]).filter(x=>x[1]>0);
  const UB0=D.UB||{},byW=k=>{const d=dif((S.stats.useBy||{})[k],UB0[k]||{});return d.length?'（'+d.map(([w,v])=>w+' '+v).join('、')+'）':'';};
  const sorties=dif(S.stats.use,U0).map(([k,v])=>k+' '+v+' 次'+byW(k)),fired=dif(S.stats.fired,F0).map(([k,v])=>k+' '+v+' 枚');
  const escLost=(S.stats.escLost||{}).atk||0,twAir=S.air?Math.max(0,Math.round(D.TW-S.air.TW)):0,ships=Math.max(0,D.ships-S.units.filter(u=>u.fl&&alive(u)).reduce((a,u)=>a+u.hp,0)),subs=Math.max(0,(P0.rocSub||0)-(P.rocSub||0));
  const li=a=>'<ul class="mdeb">'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  return '<div class="mgoal"><b>致命一擊</b>：'+(last?last.why+'（第 '+last.t+' 回合）':'海上交戰的抽象攻擊')+'</div>'+
    (Object.keys(by).length?'<div class="mgoal"><b>'+nm+' 受到的攻擊</b>'+li(Object.entries(by).map(([w,n])=>w+'：−'+n+' 步'))+'</div>':'')+
    '<div class="mgoal"><b>共軍損失</b>'+li(['航艦 '+nm+(H.some(h=>h.dead)?' 沉沒':' 重創失能'),'護航艦 '+escLost+' 艘','戰機（含艦載機）約 '+(S.air?Math.max(0,Math.round(D.PLA-S.air.PLA)):0)+' 架'])+'</div>'+
    cvPart(nm,D,dif,li)+
    '<div class="mgoal"><b>整個任務期間（含其他行動）</b>'+li([
      '出動：'+(sorties.length?sorties.join('；'):'沒有'),
      '發射：'+(fired.length?fired.join('、'):'沒有'),
      '戰損：戰機 '+twAir+' 架、艦艇 '+ships+' 艘、潛艦 '+subs+' 艘（多半是共軍飛彈與空中打擊造成，不只是攻擊航艦時的損失）'])+'</div>'+
    '<div class="wz-note">用了 '+t+' 個回合。'+(st<3?'更早完成可以拿到更多星。':'')+'</div>';
}

// 只針對這艘航艦的艦隊（航艦與護航艦）：出動、發射、攻擊時被擊落的戰機
function cvPart(nm,D,dif,li){
  const C=(S.stats.cvUse||{})[nm]||{use:{},by:{},fired:{},air:0},C0=(D.CV||{})[nm]||{use:{},by:{},fired:{},air:0};
  const by=k=>{const d=dif(C.by[k],C0.by[k]||{});return d.length?'（'+d.map(([w,v])=>w+' '+v).join('、')+'）':'';};
  const u=dif(C.use,C0.use).map(([k,v])=>k+' '+v+' 次'+by(k)),f=dif(C.fired,C0.fired).map(([k,v])=>k+' '+v+' 枚'),tot=f.reduce((a,x)=>a+(+x.match(/(\d+) 枚$/)[1]),0),air=Math.round((C.air||0)-(C0.air||0));
  return '<div class="mgoal"><b>攻擊 '+nm+' 艦隊的付出</b>（只計打航艦與它的護航艦）'+li((u.length?u:['（沒有出動紀錄）']).concat(f.length?['飛彈：'+f.join('、')+'，共 '+tot+' 枚']:[]).concat(['攻擊時被擊落的戰機：'+air+' 架']))+'</div>';
}
