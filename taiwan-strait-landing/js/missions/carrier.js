'use strict';
/* ---------- 關卡：擊沉共軍航艦（守方） ----------
   用主遊戲 2026 年的兵力與規則（武器數字不為關卡調整）；限時 4 回合內把任一艘共軍航艦打到失去戰力（重創或沉沒）。
   結局「攻方暫停攻台」是假設情境：損失航艦的政治與軍事衝擊很大，但是否因此放棄攻台沒有可靠依據。 */
MISSION_DEFS.carrier={
  title:'擊沉航艦',
  cfg:{optMode:'play',optSide:'def',optEra:'2026',optT:'8',optNews:'2'},
  brief:'共軍兩個航艦群（遼寧艦、山東艦）在台灣東側海域活動，掩護登陸並從東面夾擊。航艦是共軍的指標性資產，每艘約 2,500 名官兵，周圍有 055、052D、054A 護航艦的多層防空與反潛。<br>你指揮台灣守方，要在攻方登陸台灣之前，把至少一艘航艦打到失去戰力。',
  goal:'第 4 回合結束前，任一艘共軍航艦沉沒或遭重創、失去作戰能力。台灣在這之前失守也算失敗。',
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
        return {t:(u&&alive(u)?'重創':'擊沉')+'航艦',stars:st,d:'第 '+t+' 回合，'+cvName(nm)+(u&&alive(u)?'遭重創、失去作戰能力。':'被擊沉。'),extra:carrierDebrief(nm,t,st)};}}
    return null;
  },
  phase(side){if(side==='atk'&&S.turn>4){endGame('第 4 回合結束，共軍航艦仍保有戰力，任務失敗。','atk','任務失敗');return true;}return false;},
  lose(early){return {d:(early||'未能在時限內重創航艦。')+'<br>可以試試先讓潛艦接近航艦、集中空軍與岸置飛彈同時齊射，或先打掉護航艦。'};}
};

// 航艦的通稱：遼寧艦、山東艦、福建艦（內部記錄仍用「遼寧」「山東」「福建」）
const cvName=nm=>({'遼寧':'遼寧艦','山東':'山東艦','福建':'福建艦'})[nm]||nm;
// 結算：只寫攻擊這支航艦隊的雙方付出與損失（取自戰局實際紀錄；以任務開始時的存量為基準）
function carrierDebrief(nm,t,st){
  const D=MISSION_DEFS.carrier.snap||{},H=(S.hits||[]).filter(h=>h.type==='cv'&&h.side==='atk'&&h.cvn===nm),by={};H.forEach(h=>{by[h.why]=(by[h.why]||0)+1;});
  const C=(S.stats.cvUse||{})[nm]||{use:{},by:{},fired:{},air:0},C0=(D.CV||{})[nm]||{use:{},by:{},fired:{},air:0};
  const byW=k=>{const d=misDiff(C.by[k],C0.by[k]||{});return d.length?'（'+d.map(([w,v])=>w+' '+v).join('、')+'）':'';};
  const u=misDiff(C.use,C0.use).map(([k,v])=>k+' '+v+' 次'+byW(k)),f=misDiff(C.fired,C0.fired),tot=f.reduce((a,x)=>a+x[1],0),air=Math.round((C.air||0)-(C0.air||0));
  const i=AIR.CV.findIndex(c=>c.n===nm),wing=S.air&&i>=0?Math.max(0,AIR.CV[i].f-S.air.cvF[i]):0,escLost=(S.stats.escLost||{}).atk||0,sunk=H.some(h=>h.dead);
  return '<div class="mgoal"><b>我方付出</b>'+misList((u.length?u:['沒有出動紀錄']).concat(tot?['飛彈 '+tot+' 枚（'+f.map(([w,v])=>w+' '+v).join('、')+'）']:[]).concat(['被擊落戰機 '+air+' 架']))+'</div>'+
    '<div class="mgoal"><b>共軍損失</b>'+misList([cvName(nm)+(sunk?'沉沒':'重創失能')+(Object.keys(by).length?'（'+Object.entries(by).map(([w,n])=>w+' 命中 '+n+' 次').join('、')+'）':''),'艦載機約 '+wing+' 架','護航艦 '+escLost+' 艘'])+'</div>';
}
