'use strict';
/* ---------- 關卡：72 小時奪港（攻方） ----------
   用主遊戲 2026 年的兵力與規則（武器數字不為關卡調整）；你指揮攻方，6 回合（每回合約 12 小時，共 72 小時）內奪下並守住 2 個指定港口。
   候選港口：台中、高雄、基隆；每天輪流排除 1 個（依日期固定，同一天大家挑戰的一樣，不用亂數），網址加 &ex=tcport|kaohsiung|keelung 可指定排除哪個。
   「守住」＝港口格由攻方控制、港口設施沒被破壞，並且撐過一次守方階段。評星的 40%、第 4 回合門檻是出題者的設定（★推估），不是史料。
   結局是假設情境。說明與數字來源見 js/missions/port.md。 */
const PORT_LIMIT=6,PORT_CAND=[['tcport','台中港'],['kaohsiung','高雄港'],['keelung','基隆港']];
function portPick(){ // 排除一個候選港口，回傳要奪取的兩個 [key,名稱]
  const m=location.search.match(/[?&]ex=([a-z]+)/i),dayN=Math.floor(Date.now()/864e5);
  let ex=m&&PORT_CAND.findIndex(p=>p[0]===m[1]);if(ex==null||ex<0)ex=dayN%3;
  return PORT_CAND.filter((_,i)=>i!==ex);
}
const portHeld=k=>S.owner[SPOT[k]]==='atk'&&!S.portDown[SPOT[k]];
MISSION_DEFS.port={
  title:'72 小時奪港',
  cfg:{optMode:'play',optSide:'atk',optEra:'2026',optT:'8',optNews:'2'},
  get brief(){const t=portPick().map(p=>p[1]).join('、');return '兩棲船團已在台灣海峽集結。大軍要上岸，靠的是港口：滾裝船只能在港口或浮動碼頭卸載，重型旅更是只能進港，沒有港口，後續梯隊就卸不下來。<br>你指揮攻方，在 72 小時（6 個回合）內奪下並守住 <b>'+t+'</b>。可以空降先奪、也可以搶灘再打進港，運輸船被擊沉會連船上的旅一起損失。';},
  get goal(){return '第 '+PORT_LIMIT+' 回合結束前，同時守住 '+portPick().map(p=>p[1]).join('、')+'（港口格由攻方控制、設施沒被破壞，並撐過一次守方階段）。';},
  stars:'★ 守住 2 個港口；★★ 再加運輸船損失不超過 40%（★推估）；★★★ 再加第 4 回合前完成（★推估）',
  tips:['滾裝船只能進港或浮動碼頭，重型旅只能進攻方控制、沒被破壞的港口；先用兩棲旅或空降奪下港口，後續梯隊才卸得下來。',
    '空優還沒到手時，滾裝船最容易被打；提早登陸的代價是運輸船損失，會影響評星。',
    '港口被打壞（設施破壞）就不算守住，攻下後要提防守方的火力與反擊。',
    '「登陸提示」按鈕會在地圖上標出各處適合的登陸方式。'],
  note:'本關沿用主遊戲的規則與 2026 年的兵力，武器數字沒有為了關卡調整。評星的門檻是出題者的設定（★推估），結局是假設情境。',
  seen:null,t0:null,hold:null,
  init(){const ids=new Set();this.seen=ids;this.t0={L:S.stats.lstSunk||0,C:S.stats.cvySunk||0};this.hold={};},
  loss(){const s=this.seen?this.seen.size:0,sunk=(S.stats.lstSunk||0)-this.t0.L+(S.stats.cvySunk||0)-this.t0.C;return {s,sunk,r:s?Math.min(1,sunk/s):0};},
  check(){
    if(!this.seen)this.init();
    for(const u of S.units)if(u.side==='atk'&&(u.type==='lst'||u.type==='ro'||u.type==='cvy'))this.seen.add(u.id);
    const T=portPick();let all=true;
    for(const [k] of T){
      if(portHeld(k)){if(this.hold[k]==null)this.hold[k]=S.turn;if(S.turn<=this.hold[k])all=false;}
      else{delete this.hold[k];all=false;}
    }
    if(!all)return null;
    const L=this.loss(),t=S.turn,st=L.r>.4?1:t<=4?3:2;
    return {t:'奪下並守住港口',stars:st,d:'第 '+t+' 回合，'+T.map(p=>p[1]).join('、')+'都由攻方控制並撐過了守方的反擊。<br><b>（假設情境）</b>後續梯隊能否真的靠這兩個港口卸載，還要看空優、港口設施與守方殘存的火力。',extra:this.debrief(T,L,t,st)};
  },
  debrief(T,L,t,st){
    return '<div class="mgoal"><b>港口</b>'+misList(T.map(([k,n])=>n+'：'+(portHeld(k)?'守住':S.owner[SPOT[k]]==='atk'?'設施被破壞':'未佔領')))+'</div>'+
      '<div class="mgoal"><b>運輸船損失</b>：派出約 '+L.s+' 艘，損失 '+L.sunk+' 艘（'+Math.round(L.r*100)+'%）'+(L.r>.4?'，超過 40%，只拿 ★':'')+'</div>'+
      '<div class="mgoal"><b>攻方旅損失</b>：'+(((S.stats.bdeLost||{}).atk)||0)+' 個</div>'+
      '<div class="wz-note">用了 '+t+' 個回合。'+(st<3?'運輸船損失少、第 4 回合前完成可以拿到更多星。':'')+'</div>';
  },
  phase(side){if(side==='atk'&&S.turn>PORT_LIMIT){endGame('第 '+PORT_LIMIT+' 回合結束，港口沒有全部拿下並守住，任務失敗。','atk','任務失敗');return true;}return false;},
  lose(early){const T=portPick();return {d:(early||'未能在時限內奪下港口。')+'<br>港口：'+T.map(([k,n])=>n+(portHeld(k)?'（守住）':S.owner[SPOT[k]]==='atk'?'（設施被破壞）':'（未佔領）')).join('、')+'。可以試試先用空降或兩棲旅奪港，再讓滾裝船與重型旅進港卸載。'};}
};
