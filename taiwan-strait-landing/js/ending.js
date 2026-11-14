'use strict';
/* ---------- 結局繪卡與評分 ---------- */
const ENDCARDS={
  a1:{side:'atk',t:'祖國統一',sub:'首都陷落，攻方決定性勝利'},
  a2:{side:'atk',t:'灘頭站穩',sub:'登陸成功，建立戰略據點'},
  a3:{side:'atk',t:'挾勝議和',sub:'帶著戰果走上談判桌'},
  d1:{side:'def',t:'海峽天險',sub:'登陸受挫，攻方主力覆滅'},
  d2:{side:'def',t:'浴血守成',sub:'成功守住，但付出沉重代價'},
  d3:{side:'def',t:'烽火暫歇',sub:'停火或僵持，戰爭尚未真正結束'}
};
const ENDORDER=['a1','a2','a3','d1','d2','d3'];
function endingKind(v){
  const t=v.t||'',d=v.d||'',truce=/停戰|停火|談判|斡旋/.test(t);
  if(v.s==='draw')return 'd3';
  if(v.s==='atk')return truce?'a3':(/決定性|投降/.test(t)||/全滅|崩潰|八成|連續兩個回合/.test(d))?'a1':'a2';
  return truce&&!/守方守住/.test(t)?'d3':/慘勝/.test(t)?'d2':'d1'; // 攻方沒達成任何條件就停火＝守方守住（海峽天險）；烽火暫歇只留給真正的僵局
}
function endScores(){ // 雙方評分：各 100 分，三大項。分數不等於勝負（慘勝會被扣分）
  const cs=conditions(true),n=cs.filter(c=>c.atk).length,b=snap(),c=costSummary(),pd=Object.keys(S.portDown||{}).length,wh=S.stats.winHold||0;
  const clamp=(x,a,z)=>Math.max(a,Math.min(z,x));
  const goalsRaw=n*14+b.ports*2+(b.taipei?3:0)+(wh>=2?3:0);
  const A={goals:clamp(goalsRaw,0,50),cost:Math.round(clamp(30-clamp(c.mil.atk.n/8000,0,15)-clamp(-c.mkt*.75,0,15),0,30)),env:Math.round(20*(1-allyShare()))};
  const D={hold:clamp(50-clamp(goalsRaw,0,50),0,50),cost:Math.round(clamp(30-clamp(c.civ.TW/1700,0,18)-clamp(pd*4,0,8)-clamp(c.mil.def.n/30000,0,4),0,30)),env:Math.round(20*(1-allyShare()))};
  const tot=o=>Math.round(Object.values(o).reduce((x,y)=>x+y,0)),grade=v=>v>=90?'S':v>=75?'A':v>=60?'B':v>=40?'C':'D';
  A.total=tot(A);D.total=tot(D);A.grade=grade(A.total);D.grade=grade(D.total);
  return {A,D,n,ports:b.ports,pok:b.pok,pd,civ:c.civ.TW,milA:c.mil.atk.n,milD:c.mil.def.n,eco:c.econ.TW,hold:S.stats.tpHold||0,as:b.as,ds:b.ds};
}
/* ---------- 難度評價：把這一場的分數放進「同年代、同參戰情境」的電腦推演分布裡看百分位（分數以 5 分為一格的直方圖，各 150 場）；評語只給人類玩家 ---------- */
const BASEL={"interest_2026":{"A":[0,0,27,52,12,27,12,3,0,3,7,0,2,3,2,0,0,0,0,0,0],"D":[0,0,0,0,0,0,2,3,3,6,2,2,2,0,0,6,23,43,45,13,0],"n":150,"w":0.113},"interest_2030":{"A":[0,0,22,70,9,21,18,4,0,1,2,2,0,1,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,1,1,3,1,0,1,4,0,6,10,49,51,23,0],"n":150,"w":0.04},"dice_2027":{"A":[0,0,37,50,15,22,13,3,0,0,6,1,1,2,0,0,0,0,0,0,0],"D":[0,0,0,0,0,1,0,1,5,2,1,1,2,1,0,8,12,53,54,9,0],"n":150,"w":0.067},"dice_2031":{"A":[0,0,23,79,20,15,12,0,0,0,1,0,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,4,12,43,70,20,0],"n":150,"w":0.007},"intel_2028":{"A":[0,0,0,0,17,10,31,35,4,0,12,21,7,5,7,1,0,0,0,0,0],"D":[0,0,0,0,0,0,5,6,1,10,21,10,6,4,0,2,2,12,32,39,0],"n":150,"w":0.353},"intel_2032":{"A":[0,0,0,0,23,18,47,29,8,0,3,16,1,0,2,3,0,0,0,0,0],"D":[0,0,0,0,0,0,0,2,4,3,10,9,4,4,1,3,3,21,36,50,0],"n":150,"w":0.18},"none_2029":{"A":[0,0,0,0,14,16,24,34,5,0,13,23,4,4,11,2,0,0,0,0,0],"D":[0,0,0,0,0,0,1,12,6,11,18,8,3,5,1,2,4,16,27,36,0],"n":150,"w":0.38},"full_2026":{"A":[0,4,41,89,14,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,2,16,51,75,4,0],"n":150,"w":0.007},"full_2030":{"A":[0,0,49,94,5,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,3,21,116,8,0],"n":150,"w":0.007},"interest_2027":{"A":[0,0,17,57,14,24,22,0,0,6,6,2,0,1,1,0,0,0,0,0,0],"D":[0,0,0,0,0,0,1,1,1,9,4,1,0,0,0,3,21,39,53,17,0],"n":150,"w":0.107},"interest_2031":{"A":[0,0,22,79,11,25,11,1,0,0,0,0,0,1,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,1,0,0,0,0,0,1,2,0,2,21,42,61,20,0],"n":150,"w":0.007},"dice_2028":{"A":[0,0,40,64,9,19,15,1,0,1,1,0,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,1,0,1,1,0,1,2,2,11,55,59,17,0],"n":150,"w":0.013},"dice_2032":{"A":[0,0,21,89,13,16,6,2,0,0,3,0,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,1,1,1,0,1,2,0,0,16,49,67,12,0],"n":150,"w":0.027},"intel_2029":{"A":[0,0,0,0,23,20,32,32,2,0,9,14,2,6,10,0,0,0,0,0,0],"D":[0,0,0,0,0,0,2,10,4,5,16,4,3,6,0,0,8,16,40,36,0],"n":150,"w":0.287},"none_2026":{"A":[0,0,0,0,9,17,11,39,3,0,15,34,10,5,5,2,0,0,0,0,0],"D":[0,0,0,0,0,1,1,4,7,13,40,4,3,2,2,2,6,16,27,22,0],"n":150,"w":0.467},"none_2030":{"A":[0,0,0,0,16,11,28,44,4,2,11,23,1,3,6,0,1,0,0,0,0],"D":[0,0,0,0,0,0,1,6,6,9,20,3,8,10,0,1,5,19,37,25,0],"n":150,"w":0.333},"full_2027":{"A":[0,3,50,85,11,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,1,0,0,0,0,0,0,0,2,0,13,47,83,4,0],"n":150,"w":0.007},"full_2031":{"A":[0,0,50,93,6,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,2,12,123,12,0],"n":150,"w":0},"interest_2028":{"A":[0,0,23,57,13,29,22,4,0,1,1,0,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,0,0,2,1,3,1,2,4,15,38,59,25,0],"n":150,"w":0.02},"interest_2032":{"A":[0,0,16,62,18,22,22,4,0,0,3,3,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,1,3,2,1,2,2,0,3,17,35,51,33,0],"n":150,"w":0.053},"dice_2029":{"A":[0,0,30,71,17,14,10,3,0,1,3,0,0,0,1,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,1,0,3,1,0,1,0,1,3,21,39,62,18,0],"n":150,"w":0.033},"intel_2026":{"A":[0,0,0,0,8,14,16,53,6,0,9,20,12,3,6,1,2,0,0,0,0],"D":[0,0,0,0,0,1,1,5,5,15,20,6,4,4,1,2,7,14,27,38,0],"n":150,"w":0.367},"intel_2030":{"A":[0,0,0,0,21,19,35,26,5,2,4,27,2,0,9,0,0,0,0,0,0],"D":[0,0,0,0,0,0,1,7,3,7,20,5,5,5,1,3,5,20,32,36,0],"n":150,"w":0.287},"none_2027":{"A":[0,0,0,0,9,13,16,37,1,1,13,29,9,7,11,2,1,1,0,0,0],"D":[0,0,0,0,0,1,3,10,8,17,21,13,3,3,1,0,5,10,37,18,0],"n":150,"w":0.5},"none_2031":{"A":[0,0,0,0,18,15,31,37,5,2,9,20,2,2,8,1,0,0,0,0,0],"D":[0,0,0,0,0,0,0,4,8,11,13,6,10,10,2,3,6,12,35,30,0],"n":150,"w":0.307},"full_2028":{"A":[0,1,63,74,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,43,95,9,0],"n":150,"w":0},"full_2032":{"A":[0,0,40,101,7,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,3,24,113,8,0],"n":150,"w":0.013},"interest_2029":{"A":[0,0,26,57,12,27,21,2,0,2,3,0,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,1,1,3,0,1,2,1,3,14,36,62,26,0],"n":150,"w":0.033},"dice_2026":{"A":[0,0,40,47,14,18,15,1,0,2,8,0,1,3,1,0,0,0,0,0,0],"D":[0,0,0,0,0,0,2,3,2,6,2,1,2,0,1,9,14,50,40,18,0],"n":150,"w":0.1},"dice_2030":{"A":[0,0,28,69,20,20,9,1,0,0,2,1,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,0,3,0,2,1,1,0,3,13,39,72,16,0],"n":150,"w":0.033},"intel_2027":{"A":[0,0,0,0,14,12,24,45,5,1,2,25,7,4,8,1,2,0,0,0,0],"D":[0,0,0,0,0,0,4,9,5,10,18,4,4,3,0,0,12,11,36,34,0],"n":150,"w":0.333},"intel_2031":{"A":[0,0,0,0,27,13,41,33,3,0,5,17,1,1,9,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,6,6,3,12,6,5,4,0,4,11,12,35,46,0],"n":150,"w":0.22},"none_2028":{"A":[0,0,0,0,14,23,19,34,5,0,9,24,13,3,6,0,0,0,0,0,0],"D":[0,0,0,0,0,0,2,6,3,15,21,8,3,5,1,2,7,21,30,26,0],"n":150,"w":0.367},"none_2032":{"A":[0,0,0,0,16,17,28,44,4,0,8,17,1,2,12,1,0,0,0,0,0],"D":[0,0,0,0,0,0,3,6,7,9,10,6,3,3,0,1,4,14,37,47,0],"n":150,"w":0.28},"full_2029":{"A":[0,1,53,90,4,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],"D":[0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,5,35,107,1,0],"n":150,"w":0}};
function baseKey(){return (S.fxScen||'interest')+'_'+(S.era||'2026');}
function shareAtLeast(side,score){ // 同設定的電腦推演中，達到這個分數或更高的比例（0～1）
  const B=BASEL[baseKey()];if(!B)return null;const h=B[side==='atk'?'A':'D'],n=B.n;let above=0;
  const bi=Math.min(20,Math.max(0,Math.floor(score/5)));for(let i=bi+1;i<h.length;i++)above+=h[i];
  const within=(5-(score-bi*5))/5; // 這一格裡高於此分數的比例（線性內插）
  return Math.max(0,Math.min(1,(above+h[bi]*(bi===20?1:Math.max(0,Math.min(1,within))))/n));
}
const RTIER=sh=>sh<=.05?0:sh<=.2?1:sh<=.5?2:sh<=.8?3:4;
const RGRADE=['S','A','B','C','D'];
const RLINES={ // 評語：[階層][勝／敗]；{p} 會換成百分比
  win:[
    ['戰神！同樣的設定下，只有約 {p}% 的電腦推演能做到。','教科書級的操作，電腦推演裡不到 {p}% 能贏得這麼漂亮。','這成績單可以裱框了，同設定下電腦推演只有約 {p}% 能達到。'],
    ['漂亮，同設定下只有約 {p}% 的電腦推演能贏得這麼好。','穩而準，電腦推演裡約 {p}% 才有這樣的成績。'],
    ['贏是贏了，電腦推演裡約 {p}% 也能做到，不算特別，也不算丟臉。','中規中矩的勝利，同設定下約 {p}% 的電腦推演做得到。'],
    ['贏是贏了，但同設定下約 {p}% 的電腦推演贏得比你好看。','勉強過關，電腦推演裡約 {p}% 都比你更漂亮。'],
    ['這樣也叫贏？同設定下約 {p}% 的電腦推演都贏得比你像樣。','贏得驚險又難看，約 {p}% 的電腦推演表現比你好。']],
  lose:[
    ['輸了，卻輸得很有格調：同設定下只有約 {p}% 的電腦推演能撐得比你好。','這局難度太高，你的表現仍優於九成以上的電腦推演。'],
    ['雖敗猶榮，同設定下約 {p}% 的電腦推演才有這個表現。'],
    ['輸了，但電腦推演裡約 {p}% 也跟你差不多，不用太難過。'],
    ['這種設定下，約 {p}% 的電腦推演都比你撐得久，下次想想哪裡出了問題。','輸了，而且約 {p}% 的電腦推演在同設定下都做得比你好。'],
    ['這麼多資源你也能輸！同設定下約 {p}% 的電腦推演都做得比你好。','輸成這樣，約 {p}% 的電腦推演都能做得比你像樣。請重新開局，或者換個難度。']]
};
const RATING_ON=false; // 規則確定化後，舊的電腦推演百分位基準失去意義，暫時停用，只顯示綜合得分；等規則穩定後重建
function rateLine(side,m){ // 回傳 {share,tier,grade,line}
  if(!RATING_ON)return null;
  const score=side==='atk'?m.A.total:m.D.total,sh=shareAtLeast(side,score);if(sh==null)return null;
  const tier=RTIER(sh),won=S.result&&S.result.side===side,arr=RLINES[won?'win':'lose'][tier],pct=Math.max(1,Math.round(sh*100));
  const ally=allyShare(),extra=side==='def'&&won&&ally>=.5?'（而且有一半以上的功勞是美日的。）':'';
  return {share:sh,tier,grade:RGRADE[tier],pct,line:arr[Math.floor(Math.random()*arr.length)].replace(/\{p\}/g,String(pct))+extra,score};
}
function failGuide(k){ // 攻方失敗時：這局輸在哪裡，以及對應的假設情境（開了會在結算標明）
  if(S.sim||S.video||!S.ctrl||S.ctrl.atk!=='human'||!/^d/.test(k))return '';
  let ships=0;const cause={},kind={};
  S.log.forEach(l=>{const x=String(l.msg).match(/^(.+?)（攻方） 在 .+ 被(?:殲滅|擊沉)（(.+?)）/);if(x){ships++;cause[x[2]]=(cause[x[2]]||0)+1;kind[x[1]]=(kind[x[1]]||0)+1;}});
  const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([n,c])=>n+' '+c+' 次').join('、');
  const bad=S.stats.badWx||0,fl=S.stats.firstLand,why=[],sug=[];
  if(ships)why.push('海上損失 '+ships+' 支船艦（'+top(kind)+'），主要死因：'+top(cause)+'。');
  if(fl==null)why.push('整局沒有成功搶灘。');else why.push('第一次成功上岸在第 '+fl+' 回合。');
  if(bad)why.push('有 '+bad+' 個回合海況不利於登陸。');
  if(S.stats.reserves)why.push('守方後備部隊動員了 '+S.stats.reserves+' 次。');
  if(ships>=4)sug.push(['optWiShip','加速造艦（護航艦隊 +2、航艦 +1、兩棲艦群與滾裝船團各 +2；代價：美日警覺上升）']);
  if(bad>=1)sug.push(['optWiWx','海象永遠適合登陸（純假設）']);
  const ids=sug.map(x=>x[0]).join(',');
  return '<div class="erates fg"><div class="erate atk"><div class="eh"><b>攻方失敗診斷</b></div><ul class="dd">'+why.map(x=>'<li>'+x+'</li>').join('')+'</ul><div class="dd">想看看改變條件會怎樣？這些假設情境不符合真實情況，開啟後結算頁會標明：</div><ul class="dd">'+sug.map(x=>'<li>'+x[1]+'</li>').join('')+'</ul><button class="ghost sm" data-failgo="'+ids+'">套用上面的假設情境重開</button></div></div>';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-failgo]');if(!b)return;
  b.getAttribute('data-failgo').split(',').forEach(id=>{const el=$('#'+id);if(el){el.value='1';el.dispatchEvent(new Event('change'));}});
  try{saveSetup();}catch(x){}location.reload();});
function seedHTML(){if(!S.seedCode)return '';return '<div class="erates"><div class="enote dd">戰局碼：<code class="seedc" hidden>'+S.seedCode+'</code> <button class="ghost sm" data-copyseed="1">複製</button><br>在設定最後一頁貼上這個碼，就能用同樣的設定與天候、擲骰結果重玩；你的決策不同，結果仍會不同。</div></div>';}
function ratingHTML(m){
  if(S.sandbox&&S.sandbox.length)return '<div class="erates"><div class="enote dd">本局使用了假設情境：'+S.sandbox.join('、')+'。結果不代表真實預測。</div></div>';
  const human=sd=>!S.sim&&!S.video&&S.ctrl&&S.ctrl[sd]==='human';
  const rows=['atk','def'].map(sd=>{const r=rateLine(sd,m);if(!r)return '';const hm=human(sd);
    const note='同年代、同參戰情境的 150 場電腦推演中，約 '+r.pct+'% 能達到 '+r.score+' 分或更高';
    return '<div class="erate '+sd+'"><div class="eh"><b>'+SIDE[sd]+'</b><span class="eg g'+r.grade+'">'+r.grade+'</span><span class="et">難度評級（相對同設定的電腦推演）</span></div><div class="dd">'+note+'。</div>'+(hm?'<div class="elin">'+r.line+'</div>':'')+'</div>';}).join('');
  return rows?'<div class="erates">'+rows+'<div class="enote dd">難度評級以百分位計：S 前 5%、A 前 20%、B 前 50%、C 前 80%、D 其餘。基準是電腦對電腦的推演，不是真人玩家資料。</div></div>':'';
}
function endCaption(k,m){
  const th=m.hold?'，連續 '+m.hold+' 個回合':'';
  return {a1:'首都台北已由攻方控制'+th+'。',a2:'攻方控制 '+m.ports+' 個主要港口，島上戰力 攻方'+cpTxt(m.as)+'、守方'+cpTxt(m.ds)+'。',a3:'停火時攻方達成 '+m.n+' 項條件，實質控制了關鍵位置。',
    d1:'攻方只達成 '+m.n+' 項條件，軍人傷亡約 '+ppl(m.milA)+'；台灣平民傷亡約 '+ppl(m.civ)+'、經濟損失約 '+money(m.eco||0)+'。',d2:'台灣平民傷亡約 '+ppl(m.civ)+'、經濟損失約 '+money(m.eco||0)+(m.pd?'、'+m.pd+' 個港口遭自行破壞':'')+'。',d3:'攻方達成 '+m.n+' 項條件；停火後的局勢取決於談判。'}[k];
}
function endCardSVG(k){ // 結局繪卡：使用者提供的插圖（不含文字）；標題與說明由遊戲以各語言顯示
  return '<img class="ecard" src="img/end/'+k+'.jpg" alt="'+ENDCARDS[k].t+'" loading="lazy" decoding="async">';
}

/* ---------- 戰績紀錄：每場推演的結果存在這台裝置的瀏覽器裡，之後可回頭查看，也能看六種結局試出了幾種 ---------- */
const HKEY='tsl-history',HMAX=150;
const ENDHINT={
  a1:'攻方：三項條件全部達成並連續站穩；或控制本島 80% 以上領土；或三項達成且守軍所剩無幾；或逼守方投降、殲滅本島守軍。',
  a2:'攻方：達成 2 項條件（占領台北、控制 2 個主要港口、島上兵力不輸守方）。',
  a3:'攻方：在已達成 2 項以上條件時，接受或促成停火。',
  d1:'守方：守住台灣，攻方撤退、船團全滅或條件落空，代價在可承受範圍內。',
  d2:'守方：守住，但平民傷亡達 3 萬人以上，或自行破壞 2 個以上港口（慘勝）。',
  d3:'停火且守方守住，或雙方陷入僵局。'
};
function loadHistory(){try{const a=JSON.parse(localStorage.getItem(HKEY)||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function saveHistory(a){
  for(let n=a.length;n>0;n=Math.floor(n*.8)){try{localStorage.setItem(HKEY,JSON.stringify(a.slice(0,n)));return true;}catch(e){}}
  return false;
}
function recordHistory(v,m,kind){
  if(REC.quiet)return;
  const c=costSummary(),seen={},ch=(S.events||[]).filter(e=>e.choice&&((seen[e.id+'|'+e.turn]=(seen[e.id+'|'+e.turn]||0)+1)===1)).map(e=>[e.title,e.choice,e.who||'']);
  const side=S.video||S.sim?'ai':(S.ctrl.atk==='human'&&S.ctrl.def==='human'?'both':S.ctrl.atk==='human'?'atk':'def');
  const ent={t:Date.now(),ver:VERSION,mode:S.video?'video':S.sim?'sim':'play',side,era:S.era,T:S.T,turn:S.turn,fx:S.fxScen,end:kind,vs:v.s,vt:v.t,n:m.n,ports:m.ports,pok:m.pok,tp:S.owner[TAIPEI]==='atk',as:m.as,ds:m.ds,
    sA:m.A.total,sD:m.D.total,gA:m.A.grade,gD:m.D.grade,civ:Math.round(c.civ.TW),milA:Math.round(c.mil.atk.n),milD:Math.round(c.mil.def.n),mkt:Math.round(c.mkt*10)/10,us:S.fx.lv.US,jp:S.fx.lv.JP,ch};
  const a=loadHistory();a.unshift(ent);if(a.length>HMAX)a.length=HMAX;saveHistory(a);
}
const HMODE={play:'對戰',sim:'電腦推演',video:'純模擬'},HSIDE={atk:'你操作攻方',def:'你操作守方',both:'雙方都操作',ai:'電腦操作'};
function historyOverview(a){
  let got={};try{got=JSON.parse(localStorage.getItem('tsl-endings')||'{}');}catch(e){}
  const cnt=k=>Math.max(got[k]||0,a.filter(x=>x.end===k).length);
  const done=ENDORDER.filter(k=>cnt(k)>0).length;
  return '<div class="hov"><div class="hot"><b>結局收集</b> <span class="dd">已出現 '+done+' / 6 種'+(done===6?'　🎉 全部試出來了':'')+'</span></div><div class="hgrid">'+
    ENDORDER.map(k=>{const n=cnt(k);return '<div class="hcell'+(n?'':' lock')+'"><div class="himg">'+endCardSVG(k)+'</div><div class="hn"><b>'+(n?ENDCARDS[k].t:'？？？')+'</b><span class="dd">'+SIDE[ENDCARDS[k].side]+' · '+(n?'出現 ×'+n:'尚未出現')+'</span>'+'<span class="dd hh">'+(n?'達成條件：':'')+ENDHINT[k]+'</span>'+'</div></div>';}).join('')+'</div></div>';
}
function renderHistory(){
  const box=$('#mbox'),a=loadHistory();
  let h='<div class="eyebrow">📜 戰績紀錄</div><h3>戰績紀錄</h3>'+historyOverview(a);
  h+='<div class="hlist-h"><b>每場結果</b><span class="dd">共 '+a.length+' 場（最多保留最近 '+HMAX+' 場）</span></div>';
  h+=a.length?'<div class="hlist">'+a.map((x,i)=>'<button class="hrow" data-hi="'+i+'"><span class="hth">'+endCardSVG(x.end)+'</span><span class="hmid"><b>'+ENDCARDS[x.end].t+'</b><span class="dd">'+new Date(x.t).toLocaleString()+' · '+HMODE[x.mode]+' · '+HSIDE[x.side]+'</span><span class="dd">'+x.vt+'</span></span><span class="hsc"><i class="atk">'+x.gA+' '+x.sA+'</i><i class="def">'+x.gD+' '+x.sD+'</i></span></button>').join('')+'</div>':'<div class="wz-note">還沒有紀錄。打完一場推演就會自動存在這裡（只存在這台裝置的瀏覽器）。</div>';
  h+='<div class="btns" style="margin-top:14px"><button id="hClose">關閉</button>'+(a.length?'<button class="ghost" id="hExp">匯出紀錄（JSON）</button><button class="ghost" id="hClr">清除全部</button>':'')+'</div>';
  box.innerHTML=h;
  box.querySelectorAll('[data-hi]').forEach(b=>b.onclick=()=>renderHistoryDetail(+b.dataset.hi));
  $('#hClose').onclick=()=>{$('#modal').hidden=true;box.innerHTML='';};
  const e=$('#hExp');if(e)e.onclick=()=>{dlBlob(new Blob([JSON.stringify(loadHistory(),null,1)],{type:'application/json'}),'taiwan-strait-history-'+stampNow()+'.json');toast(TX('已匯出戰績紀錄'),1500);};
  const c=$('#hClr');if(c)c.onclick=()=>{if(confirm(TX('清除全部戰績紀錄？（結局圖鑑的解鎖紀錄會保留）'))){try{localStorage.removeItem(HKEY);}catch(e2){}renderHistory();}};
}
function renderHistoryDetail(i){
  const box=$('#mbox'),a=loadHistory(),x=a[i];if(!x){renderHistory();return;}
  const C=ENDCARDS[x.end],bar=(l,v,mx)=>'<div class="sbar"><span>'+l+'</span><i><em style="width:'+Math.round(100*v/mx)+'%"></em></i><b>'+v+' / '+mx+'</b></div>';
  let h='<div class="eyebrow">📜 戰績紀錄 · '+new Date(x.t).toLocaleString()+'</div><h3>'+C.t+'</h3>'+
    '<div class="hd"><div class="hdi">'+endCardSVG(x.end)+'</div><div class="hdt"><div class="dd">'+C.sub+'</div><p><b>'+x.vt+'</b></p>'+
    '<div class="dd">'+HMODE[x.mode]+' · '+HSIDE[x.side]+' · '+(ERA[x.era]?ERA[x.era].n:x.era)+' · 判定回合 '+x.T+' · 結束於回合 '+x.turn+' · '+optLabel('optFx',x.fx)+'</div>'+
    '<div class="hcond"><span class="'+(x.tp?'ok':'no')+'">'+(x.tp?'✓':'✕')+' 首都台北</span><span class="'+((x.pok!==undefined?x.pok:x.ports>=2)?'ok':'no')+'">'+((x.pok!==undefined?x.pok:x.ports>=2)?'✓':'✕')+' 主要港口 '+x.ports+'</span><span class="'+(x.as>=x.ds&&x.as>=4?'ok':'no')+'">'+(x.as>=x.ds&&x.as>=4?'✓':'✕')+' 島上戰力 '+cpNum(x.as)+' 對 '+cpNum(x.ds)+' '+cpU()+'</span></div></div></div>'+
    '<div class="escores"><div class="escore atk"><div class="eh"><b>攻方</b><span class="eg g'+x.gA+'">'+x.gA+'</span><span class="et">'+x.sA+' / 100</span></div></div><div class="escore def"><div class="eh"><b>守方</b><span class="eg g'+x.gD+'">'+x.gD+'</span><span class="et">'+x.sD+' / 100</span></div></div></div>'+
    '<div class="dd" style="margin-top:8px">台灣平民傷亡約 '+ppl(x.civ)+' · 攻方軍人傷亡約 '+ppl(x.milA)+' · 守方約 '+ppl(x.milD)+' · 全球股市 '+x.mkt+'% · 美國介入程度 '+x.us+'、日本 '+x.jp+'</div>';
  h+='<div class="hlist-h"><b>你的決策與事件</b><span class="dd">'+x.ch.length+' 項</span></div>'+(x.ch.length?'<ol class="hch">'+x.ch.map(c=>'<li><span class="dd">'+c[0]+'</span>　<b>'+c[1]+'</b></li>').join('')+'</ol>':'<div class="wz-note">沒有決策紀錄。</div>');
  h+='<div class="btns" style="margin-top:14px"><button id="hBack">← 回到列表</button><button class="ghost" id="hDel">刪除這筆</button></div>';
  box.innerHTML=h;
  $('#hBack').onclick=renderHistory;
  $('#hDel').onclick=()=>{const b=loadHistory();b.splice(i,1);saveHistory(b);renderHistory();};
}
function openHistory(){if(!$('#modal').hidden)return;mboxSet('');$('#modal').hidden=false;$('#resume').hidden=true;renderHistory();}
function endingBlock(v){
  const k=endingKind(v),m=endScores(),C=ENDCARDS[k];S.result=Object.assign(S.result||{},{ending:k,scoreA:m.A.total,scoreD:m.D.total});
  let got={};try{got=JSON.parse(localStorage.getItem('tsl-endings')||'{}');}catch(e){}
  if(!REC.quiet){got[k]=(got[k]||0)+1;try{localStorage.setItem('tsl-endings',JSON.stringify(got));}catch(e){}recordHistory(v,m,k);}
  const bar=(l,x,max)=>'<div class="sbar"><span>'+l+'</span><i><em style="width:'+Math.round(100*x/max)+'%"></em></i><b>'+x+' / '+max+'</b></div>';
  const col=(who,o,rows)=>'<div class="escore '+who+(who===(S.ctrl&&S.ctrl.atk==='human'&&S.ctrl.def!=='human'?'atk':S.ctrl&&S.ctrl.def==='human'&&S.ctrl.atk!=='human'?'def':'')?' mine':'')+'"><div class="eh"><b>'+SIDE[who]+'</b><span class="eg g'+o.grade+'">'+o.grade+'</span><span class="et">'+o.total+' / 100</span></div>'+rows.map(r=>bar(r[0],o[r[1]],r[2])).join('')+'</div>';
  const gal=ENDORDER.map(x=>'<div class="egi'+(got[x]?'':' lock')+(x===k?' cur':'')+'" title="'+(got[x]?ENDCARDS[x].t:'尚未解鎖')+'">'+endCardSVG(x)+'<div class="egn">'+(got[x]?ENDCARDS[x].t:'？？？')+'</div></div>').join('');
  return '<div class="ending"><div class="ehero '+C.side+'">'+endCardSVG(k)+'<div class="ecap"><div class="eyebrow">結局繪卡 · '+C.sub+'</div><b>'+C.t+'</b><p>'+endCaption(k,m)+'</p></div></div>'+
    '<div class="escores">'+col('atk',m.A,[['戰略目標','goals',50],['代價效率','cost',30],['對抗外援','env',20]])+col('def',m.D,[['守住程度','hold',50],['承受的代價','cost',30],['自主程度','env',20]])+'</div>'+
    '<div class="enote dd">分數不等於勝負：慘勝與代價沉重會被扣分。等級 S≥90、A≥75、B≥60、C≥40。</div>'+lossColsHTML()+ratingHTML(m)+failGuide(k)+seedHTML()+
    acc('結局圖鑑','已解鎖 '+ENDORDER.filter(x=>got[x]).length+' / 6','<div class="egal">'+gal+'</div>',false)+'</div>';
}
// 結算時的控制權：攻方必須在該格或相鄰格還有地面部隊，才算實際控制；沒有兵力的格子歸還守方（遊戲進行中的控制權規則不變）
function settleControl(){
  const gnd=S.units.filter(u=>u.side==='atk'&&!isShip(u)&&!atSea(u)&&onTW(u));const back=[];
  for(const k of Object.keys(S.owner)){
    if(S.owner[k]!=='atk')continue;const h=TER[k];if(!h||h.isl!=='TW')continue;
    if(gnd.some(u=>hd(hexOf(u),h)<=kmH(20)))continue;
    S.owner[k]='def';if(h.name)back.push(h.name);
  }
  if(back.length)log('結算：攻方已無兵力控制的地區歸還守方（'+back.slice(0,8).join('、')+(back.length>8?' 等 '+back.length+' 處':'')+'）');
}
function endGame(early,side,label){
  if(window.TSL_RUMBLE)TSL_RUMBLE('end');
  S.over=true;S.sel=null;S.mode=null;
  settleControl();
  const cs=conditions(true);const n=cs.filter(c=>c.atk).length;
  let v=early?{s:side,t:label||(side==='atk'?'攻方勝利':'守方勝利'),d:early}:verdict(n,true);
  let lim=false;
  {const st=strategicTag(v,lim);v={s:v.s,t:v.t+(/（.*代價）|慘勝/.test(v.t)||lim?'':st.tag),d:v.d+' '+st.text};}
  log('作戰結束：'+v.t);
  S.result={side:v.s,n,early:!!early,limited:lim};
  // 人類只操作守方時，三項改從守方角度顯示（守住＝✓）；其他模式維持攻方角度。下方列出判斷依據。
  const defView=!S.sim&&!S.video&&S.ctrl.def==='human'&&S.ctrl.atk!=='human';
  const DT=['守住首都台北','守住主要港口','島上戰力不落下風'];
  const chips=cs.map((c,i)=>{const okv=defView?!c.atk:c.atk;return '<div class="fc '+(okv?'ok':'no')+'"><span class="fi">'+(okv?'✓':'✕')+'</span><div><b>'+(defView?DT[i]:c.title)+'</b><span class="dd">'+c.now+'</span></div></div>';}).join('');
  const basis='<ul class="fin-basis">'+cs.map((c,i)=>'<li><b>'+(defView?DT[i]:c.title)+'</b>：判定標準——'+(defView?(['台北沒有被攻方控制','攻方控制的主要港口卸載容量不足以支撐島上部隊','攻方島上綜合戰力不如守方，或不到'+cpTxt(4)+'（站不穩）'][i]):c.desc)+'；結果——'+c.now+'，'+(defView?(!c.atk?'守方達成':'守方未達成'):(c.atk?'攻方達成':'攻方未達成'))+'。</li>').join('')+'</ul>';
  const html='<div class="finw"><div class="fin-head"><div class="eyebrow">'+(early?'提前結束 · 第 '+S.turn+' 回合':'第 '+S.T+' 回合 判定')+'</div>'+
    '<h3 class="verdict '+v.s+'">'+v.t+'</h3><p class="fvd">'+v.d+'</p>'+
    '<div class="fin-conds'+(defView?' dv':'')+'">'+chips+'</div>'+basis+'<div class="fin-score">'+(defView?'守方守住 <b>'+(3-n)+'</b> / 3 項（攻方達成 '+n+' 項，需 2 項以上才獲勝）':'攻方達成 <b>'+n+'</b> / 3 項（需 2 項以上獲勝）')+'　<span class="dd">參考：制空 '+AIRCTL[S.airCtl||'mid']+'、攻方護航艦隊 '+fmt1(S.pools.plaNavy)+'、航艦 '+fmt1(S.pools.plaCV)+'</span></div></div>'+
    '<div class="fin-body"><div class="fin-tools"><button class="lnk" id="accAll">全部展開</button><button class="lnk" id="accNone">全部收合</button></div>'+
    endingBlock(v)+afterAction(v.s)+(S.sim||S.video?timelineHTML():'')+newsRecap()+'</div>'+
    '<div class="fin-foot"><button id="btnAgain">'+(S.video?'再模擬一次':'重新開局')+'</button><button class="ghost" id="btnClose">'+(S.video?'回頭看影片':'檢視地圖')+'</button><button class="ghost" id="btnRepExp">匯出報告（文字）</button><button class="ghost" id="btnRepImg">匯出報告（圖片）</button><button class="ghost" id="btnRepVid">🎬 十秒精華影片</button>'+(S.video?'<button class="ghost" id="btnBack">回到設定</button><button class="ghost" id="btnStats2">跑 100 次統計</button>':'')+'</div></div>';
  if(S.rec){REC.final=html;recordFrame();REC.closed=true;if(REC.resolve)REC.resolve();return;}
  showFinal(html);
  render();
}
function mboxSet(cls){const b=$('#mbox');b.classList.remove('ev','fin','evfix');if(cls)b.classList.add(cls);$('#modal').classList.toggle('fin-on',cls==='fin');return b;}
function acc(title,sum,html,open){return '<details class="acc"'+(open?' open':'')+'><summary><b>'+title+'</b><span class="sum">'+sum+'</span></summary><div class="accb">'+html+'</div></details>';}
function accTools(){const tog=o=>document.querySelectorAll('#mbox details.acc').forEach(d=>{d.open=o;});const a=$('#accAll'),n=$('#accNone');if(a)a.onclick=()=>tog(true);if(n)n.onclick=()=>tog(false);}
function showFinal(html){
  captureHL('end',true);
  mboxSet('fin').innerHTML=html;accTools();$('#resume').hidden=true;$('#modal').hidden=false;
  $('#btnAgain').onclick=()=>{$('#modal').hidden=true;if(S.video)startVideo();else reset();};
  $('#btnClose').onclick=()=>{$('#modal').hidden=true;};
  $('#btnRepExp').onclick=()=>exportReportText();$('#btnRepImg').onclick=()=>exportReportImage();$('#btnRepVid').onclick=()=>exportHighlight();
  const bb=$('#btnBack');if(bb)bb.onclick=()=>{$('#modal').hidden=true;backToSetup();};
  const bs=$('#btnStats2');if(bs)bs.onclick=()=>runStats(100);
}
