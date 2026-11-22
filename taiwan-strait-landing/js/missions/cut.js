'use strict';
/* ---------- 任務：截斷後續梯隊（守方） ----------
   用主遊戲 2026 年的兵力與規則（武器數字不為任務調整）；限時 6 回合，累計打掉攻方「滾裝船團」的船數（每命中 1 枚＝1 艘，失能與沉沒都算；
   輕型旅 4 艘、重型旅 10 艘，見 sealift.js 的 RO_SHIPS）。台北不能失守。
   評星門檻（★推估，依實測）：用電腦守方跑 18 場（2026 年，第 6 回合前），累計損失船數中位數 5（平均 5.9，範圍 1～14）。
   ★＝中位數 5 艘、★★＝加 25%（7 艘）、★★★＝加 50%（8 艘）。 */
const CUT_LIMIT=6,CUT_STARS=[5,7,8]; // 回合限制；★／★★／★★★ 的船數門檻
MISSION_DEFS.cut={
  title:'截斷後續梯隊',
  cfg:{optMode:'play',optSide:'def',optEra:'2026',optT:'8',optNews:'2'}, // 判定回合設 8（>限時 6），免得主遊戲的判定搶在任務限時前結束
  brief:'登陸成不成功，不只看第一波：滾裝船載著重型旅與後續補給，一艘接一艘從大陸港口開過來。只要在海上與港內把這些商船改裝的船打掉，後面的部隊就送不過來。<br>你指揮台灣守方，在 '+CUT_LIMIT+' 回合內盡量多打掉攻方滾裝船團的船（輕型旅的船團 4 艘、重型旅 10 艘；每命中 1 枚打掉 1 艘）。',
  goal:'第 '+CUT_LIMIT+' 回合結束前，累計打掉至少 '+CUT_STARS[0]+' 艘滾裝船，且台北沒有失守。',
  stars:'★ '+CUT_STARS[0]+' 艘（電腦守方的中位數，★推估）；★★ '+CUT_STARS[1]+' 艘（＋25%）；★★★ '+CUT_STARS[2]+' 艘（＋50%），打到 '+CUT_STARS[2]+' 艘會提前結束',
  tips:['滾裝船沒有自身防空，不在護航艦防空涵蓋內時命中率較高（尋標 0.9）；直升機與飛彈都先挑沒有護航的船團。',
    '第 1～2 回合船團還在大陸港口集結：縱深打擊可以打港內的船（長程飛彈與陸軍戰術飛彈）。',
    '空射魚叉、雄二、岸置雄風與艦隊反艦飛彈打海上船團；潛艦的魚雷對商船很有效。',
    '重型旅的船團有 10 艘：每打掉 1 艘，船上的旅會按比例損失兵力，打得越多越傷。'],
  note:'本任務沿用主遊戲的規則與 2026 年的兵力，武器數字沒有為了任務調整。評星門檻取自電腦守方 18 場的實測中位數（★推估），是出題者的設定，不是真實戰局的預測。',
  t0:null,
  init(){this.t0={n:S.stats.roShips||0,by:Object.assign({},S.stats.roBy||{}),bde:((S.stats.bdeLost||{}).atk)||0};},
  count(){if(!this.t0)this.init();return (S.stats.roShips||0)-this.t0.n;},
  starsOf(n){return n>=CUT_STARS[2]?3:n>=CUT_STARS[1]?2:n>=CUT_STARS[0]?1:0;},
  check(){
    const n=this.count();
    if(S.owner[TAIPEI]==='atk'){endGame('台北失守，任務失敗。','atk','任務失敗');return null;}
    if(n>=CUT_STARS[2])return this.result(n,'提前完成');
    return null;
  },
  result(n,how){
    const st=this.starsOf(n),t=S.turn;
    return {t:'截斷後續梯隊',stars:st,d:'第 '+t+' 回合，累計打掉 '+n+' 艘滾裝船（'+how+'）。<br><b>（假設情境）</b>後續梯隊能否因此送不過來，還要看攻方還剩多少船與運力。',extra:this.debrief(n)};
  },
  debrief(n){
    const by=misDiff(S.stats.roBy,this.t0&&this.t0.by),grp={};
    for(const [k,v] of by){const g=/直升機/.test(k)?'攻擊直升機':/縱深打擊/.test(k)?'縱深打擊（港內集結的船）':/魚雷|潛艦/.test(k)?'潛艦':/海馬士/.test(k)?'海馬士火箭':/地面戰鬥/.test(k)?'地面戰鬥':/飛彈|魚叉|雄/.test(k)?'反艦飛彈（岸置、空射、艦射）':'其他';grp[g]=(grp[g]||0)+v;}
    const rows=Object.entries(grp).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+'：'+v+' 艘');
    const bl=(((S.stats.bdeLost||{}).atk)||0)-(this.t0?this.t0.bde:0);
    return '<div class="mgoal"><b>打掉滾裝船</b>：'+n+' 艘（★ '+CUT_STARS[0]+'、★★ '+CUT_STARS[1]+'、★★★ '+CUT_STARS[2]+'）</div>'+
      '<div class="mgoal"><b>各武器貢獻</b>'+misList(rows.length?rows:['（沒有）'])+'</div>'+
      '<div class="mgoal"><b>攻方被殲滅的旅</b>：'+bl+' 個；<b>運輸與補給船團損失</b>：'+(((S.stats.lstSunk||0)+(S.stats.cvySunk||0)))+' 支</div>';
  },
  phase(side){
    if(side==='def'&&!MISSION.done&&S.turn<=CUT_LIMIT){const n=this.count();toast('任務進度：已打掉 '+n+' 艘滾裝船（★ '+CUT_STARS[0]+'／★★ '+CUT_STARS[1]+'／★★★ '+CUT_STARS[2]+'），第 '+S.turn+'／'+CUT_LIMIT+' 回合',4200);}
    if(side==='atk'&&S.turn>CUT_LIMIT){
      const n=this.count();
      if(S.owner[TAIPEI]==='atk'){endGame('台北失守，任務失敗。','atk','任務失敗');return true;}
      if(n>=CUT_STARS[0]){missionWin(this.result(n,'時限到'));return true;}
      endGame('第 '+CUT_LIMIT+' 回合結束，只打掉 '+n+' 艘滾裝船（需 '+CUT_STARS[0]+' 艘），任務失敗。','atk','任務失敗');return true;
    }
    return false;
  },
  lose(early){const n=this.count();return {d:(early||'未達標。')+'<br>累計打掉 '+n+' 艘滾裝船。'+this.debrief(n)};}
};
