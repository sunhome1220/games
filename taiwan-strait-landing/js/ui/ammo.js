'use strict';
/* 彈藥長條圖示（自 fx.js 拆出） */
// ---------- 彈藥圖示：各彈種「剩餘／滿載」的長條（綠 >50%、橘 25～50%、紅 <25%）----------
// 滿載量：艦艇依各型垂直發射管配置（SHIPW、DDW、RFW 艦隊加總）、潛艦依武器配置（HK_HM、hkTp、PSUB、SSN_ARM），美日飛彈單位依 NME／MDT；發射車依開局車數
function ammoRows(u){
  const R=[],add=(n,v,m)=>{if(m>0||v>0)R.push({n,v:Math.max(0,v||0),m:Math.max(m||0,v||0)});},g=u.mag||{};
  if(u.fl){const A=fleetAgg(u);add(TX('防空'),g.ad,A.ad);add(fleetWn(u),g.asm,A.asm);}
  else if(isEsc(u)&&SHIPW[u.type]){const W=SHIPW[u.type];add(TX('防空'),g.ad,W.ad);add(W.asmN,g.asm,W.asm);add(TX('對地'),g.lam,W.lam);}
  else if(u.type==='dd')add(TX('防空'),g.ad,DDW.ad);
  else if(u.type==='ddh'&&SHIPW.ddh)add(TX('防空'),g.ad,SHIPW.ddh.ad);
  else if(u.type==='nme')add(TX('反艦'),g.asm,NME.asm);
  else if(u.type==='mdt'){add(TX('反艦'),g.asm,MDT.asm);add(TX('對地'),g.lam,MDT.lam);}
  else if(u.type==='ssn'){add(TX('魚雷'),u.tp,SSN_ARM.tp);add(TX('魚叉'),u.hm,SSN_ARM.hm);add(TX('戰斧'),g.lam,SSN_ARM.lam);}
  else if(u.type==='hk'){add(TX('魚雷'),u.tp,hkTp(u));add(TX('魚叉'),u.hm,HK_HM);}
  else if(u.type==='psub'&&PSUB[u.cls]){add(TX('魚雷'),u.tp,PSUB[u.cls].tp);add(TX('鷹擊-18'),u.hm,PSUB[u.cls].hm);}
  return R;
}
const ammoLv=r=>r>.5?'g':r>=.25?'o':'r';
function ammoBar(n,v,m,unit){const r=m>0?v/m:0,f=x=>Math.abs(x-Math.round(x))<.05?String(Math.round(x)):x.toFixed(1);
  return '<div class="ab"><span class="abn">'+n+'</span><span class="abt"><i class="'+ammoLv(r)+'" style="width:'+Math.round(r*100)+'%"></i></span><span class="abv '+ammoLv(r)+'">'+f(v)+'<small>/'+f(m)+'</small></span></div>';} // 單位寫在名稱裡（長條才會對齊）
function ammoBarsHTML(u){
  const rows=ammoRows(u).map(x=>ammoBar(x.n,x.v,x.m));
  if(isLch(u)&&u.veh!=null&&!u.ghostFleet)rows.push(ammoBar(TX('發射車（輛）'),ssmReady(u),lchV0(u)));
  // 防空接戰上限（休斯齊射模型）：每一波最多接戰幾枚來襲；同一階段內多次齊射會累計（已用的在下一個階段歸零）
  const isAD=u.fl||u.type==='dd'||(isEsc(u)&&SHIPW[u.type]&&SHIPW[u.type].chan>0)||(u.type==='ddh'&&SHIPW.ddh);
  const cap=isAD&&u.mag&&u.mag.ad>0?chanOf(u):0;
  if(cap>0){const used=u.chT===S.turn+S.phase?(u.chU||0):0,left=Math.max(0,Math.min(cap-used,Math.floor(u.mag.ad/SALVO.perMsl)));
    rows.push('<div class="adcap">'+TX('防空接戰')+'：'+TX('每波最多')+' <b>'+cap+'</b> '+TX('枚來襲')+(used?'，'+TX('本階段還能接戰')+' <b class="'+(left?'':'r')+'">'+left+'</b> '+TX('枚'):'')+
      '<small>（'+TX('每枚來襲用')+' '+SALVO.perMsl+' '+TX('枚攔截彈；超過上限的不會被攔截，近迫防禦另可處理')+' '+SALVO.ciws+' '+TX('枚')+'；★'+TX('推估')+'）</small></div>');}
  return rows.length?'<div class="ammo">'+rows.join('')+'</div>':'';
}
// 守方彈藥存量（全軍共用）：滿載＝該年代的開局存量（S.p0，previewEra 設定）；之後若有補充超過，就取看過的最大值
function poolMax(k){const P=S.pools||{};S.poolMax=S.poolMax||{};const v=Math.max(P[k]||0,(S.p0&&S.p0[k])||0);if(!(S.poolMax[k]>=v))S.poolMax[k]=v;return S.poolMax[k];}
function poolTrack(){if(S&&S.started&&S.pools)['rocAS','rocAS3','rocHCD','rocAAsh','rocHf2A','rocWC','rocSlam','rocMsl','rocAtc','rocGml','rocAD','rocRkt'].forEach(poolMax);}
function defLedgerBars(){
  // 全部換算成「枚」顯示（庫存內部用「點」：雄二／雄三／魚叉岸防每點約 100 枚，長程飛彈每點約 25 枚），不顯示小數；防空是相對規模的點數
  const P=S.pools;if(!P)return '';const row=(n,k,per)=>{const m=poolMax(k)*(per||1);return m>0?ammoBar(n,Math.round((P[k]||0)*(per||1)),Math.round(m)):'';};
  return '<div class="eyebrow" style="margin-top:6px">'+TX('守方彈藥存量（全軍共用，單位：枚）')+'</div><div class="ammo">'+row(TX('雄二（岸置、艦射）'),'rocAS',100)+row(TX('雄三（岸置、艦射）'),'rocAS3',100)+row(TX('魚叉岸防'),'rocHCD',100)+row(TX('空射魚叉（F-16）'),'rocAAsh')+row(TX('空射雄二（經國號）'),'rocHf2A')+
    row(TX('萬劍彈（空射對地）'),'rocWC')+row(TX('SLAM-ER（空射對地）'),'rocSlam')+row(TX('長程飛彈（雲峰、雄二E）'),'rocMsl',25)+
    row(TX('陸軍戰術飛彈（ATACMS）'),'rocAtc')+row(TX('海馬士火箭（莢艙）'),'rocGml')+row(TX('雷霆2000（發）'),'rocRkt')+row(TX('防空（點，相對規模）'),'rocAD')+'</div>'+
    '<div class="adcap">'+TX('陸上防空每回合最多接戰')+' <b>'+(S.sam?samCap():MSL.adCap)+'</b> '+TX('枚來襲')+'<small>（'+TX(S.sam?'各防空營的連數 × 8 枚；只保護各營彈道飛彈防禦範圍內的機場、港口、城市；★推估':'21 個連 × 8 枚，只保護機場、港口、城市；★推估')+'）</small></div>';
}
function renderInfoSide(){
  const el=$('#info');
  if(FARSEL&&FARINFO[FARSEL]&&!S.sel){const f=FARINFO[FARSEL];
    el.innerHTML='<div class="eyebrow">外圍示意區 · '+FARWHO[f.w]+'</div><h2 style="color:var(--'+(f.w==='atk'?'atk':f.w==='us'?'us':'jp')+')">'+f.t+'</h2><div class="k">'+
        f.d+'<br>'+f.r+'</div><div class="k" style="margin-top:6px">這裡不是遊戲格，不能操作，只顯示各方火力的出發位置；距離為概略值，圖上位置為示意。</div>'+(matchMedia('(hover:none)').matches?'<button class="ghost" id="btnDetail" data-far="'+FARSEL+'">詳細資料</button>':'');
      return;
      }
  const hu=S.hoverId?S.units.find(x=>x.id===S.hoverId):null;
  const u=S.sel&&alive(S.sel)?S.sel:(S.hover&&S.baseSel!==S.hover?(hu&&K(hu.c,hu.r)===S.hover?hu:unitAt(S.hover)):null); // 點基地標籤：顯示機場本身
  const h=u?hexOf(u):(S.hover?TER[S.hover]:null);
  if(!h){el.innerHTML='<div class="k">點選地圖上的單位或地格查看資料。</div>';return;}
  let o='<div class="eyebrow">'+hname(h)+' · '+TERN[h.t]+(h.town?'（城鎮）':'')+(h.cliff?' · 斷崖':'')+(h.mud?' · 泥灘潮間帶':'')+(MINOR_PORTS[h.k]?' · 次要港口：'+MINOR_PORTS[h.k]+'（占領後補給 +2，不計入勝負條件）':'')+
      ((S.bh&&S.bh[h.k]&&S.turn-S.bh[h.k]>=1&&S.owner[h.k]==='atk')?' · 灘頭堡（補給 +2）':'')+(isLand(h)?' · '+SIDE[S.owner[h.k]]+'控制':'')+'</div>';
  if(u){
    const T=TYPES[u.type];
    o+='<h2 style="color:var(--'+u.side+')">'+T.n+'</h2>';
    o+='<div class="stats"><div><b>'+effAtk(u)+'</b><span>攻擊</span></div><div><b>'+effDef(u)+'</b><span>防禦</span></div><div><b>'+T.mv+'</b><span>移動</span></div><div><b>'+hpCell(u)[0]+'</b><span>'+hpCell(u)[1]+'</span></div></div>';
    o+=ammoBarsHTML(u); // 彈藥長條（剩餘／滿載）
    const en=effNote(u);if(en.length)o+='<div class="hint effn">數值修正：'+en.join('、')+'</div>';
    const st=unitStatusList(u,h);
    o+='<div class="hint">'+st.join(' · ')+'</div>';
    o+=fleetPanelHTML(u);o+=hkPanelHTML(u);o+=subMisPanelHTML(u);o+=heloPanelHTML(u);if(u.type==='heli'&&heliB(u.hb))o+=heliPanelHTML(heliB(u.hb));if(h.t==='air'&&h.isl==='TW')o+=afPanelHTML(h.k);
    if(humanTurn()&&allyHuman()&&S.phase==='def'&&u.ally&&u.side==='def'){const ts=tomShooters(u);
      if(ts.length||(u.type==='csg'&&S.units.some(e=>e.grp===u.id&&e.mag&&e.mag.lam>0)))o+='<div class="cvord"><button class="ghost" id="btnTom"'+(ts.length?'':' disabled')+
          '>戰斧巡弋飛彈縱深打擊<small class="pn">（可發射 '+ts.length+' 艘、每次 '+LAM.per+' 枚）</small></button></div><div class="hint">按下後點地圖上的大陸基地；會先警告升級後果。</div>';
      }
    setTimeout(()=>{const bt=document.getElementById('btnTom');if(bt)bt.onclick=()=>{S.sel=u;S.mode=S.mode==='tom'?null:'tom';render();};const bv=document.getElementById('btnVolley'),
        bc=document.getElementById('btnCvw'),bl=document.getElementById('btnCvwL');if(bl)bl.onclick=()=>{S.sel=u;S.mode=S.mode==='cvwL'?null:'cvwL';render();};if(bv)bv.onclick=()=>{S.sel=u;S.mode=S.mode==='volley'?null:'volley';render();};if(bc)bc.onclick=()=>{S.sel=u;S.mode=S.mode==='cvw'?null:'cvw';render();};},0);
    if(matchMedia('(hover:none)').matches)o+='<button class="ghost" id="btnDetail" data-id="'+u.id+'">詳細資料（照片、說明、規則）</button>';
  } else if(h.t==='air'&&h.isl==='TW'){const lv=afLevel(h.k);
    o+='<h2 style="color:var(--def)">'+(h.name||'機場')+'</h2>';
    /* 有標題，手機浮動資訊卡才會出現（才點得到出擊按鈕） */o+='<div class="hint">機場：'+(S.owner[h.k]==='atk'?'被攻方占領（無法起降）':afTxt(h.k))+'；每個守方階段搶修好 1 條。守方空軍只能從還能用的機場起飛；整體可用機場能量 '+Math.round(afShare()*100)+'%。</div>'+afPanelHTML(h.k);
  } else o+='<div class="hint">'+(terrDef(h)?'地形防禦 +'+terrDef(h)+'。':'')+(h.coastal&&!h.cliff&&!h.mud&&h.t!=='mtn'&&h.isl!=='CN'&&h.isl!=='JP'&&h.k!==TAIPEI?'可供登陸。':'')+
      (h.isl==='JP'?'日本領土（'+(h.name||'琉球群島')+'）。'+(FARINFO[h.name]?FARINFO[h.name].d+FARINFO[h.name].r:'')+'目前沒有日本地面部隊棋子，暫不開放登陸。':'')+'</div>';
  el.innerHTML=o;
}
// 判定提示：開局不急著說結論；判定回合快到（最後 2 個回合）或條件數有變化的那一兩回合，才顯示「若現在判定」
function verdictNote(n){
  if(S.vnSeen===undefined)S.vnSeen=n;
  if(n!==S.vnSeen){S.vnChg={t:S.turn,from:S.vnSeen,to:n};S.vnSeen=n;}
  const near=S.turn>=S.T-1,chg=!!(S.vnChg&&S.turn-S.vnChg.t<=1),vd='<b class="verdict '+verdict(n).s+'">'+verdict(n).t+'</b>';
  if(near)return '若現在判定：攻方 <b>'+n+'</b> / 3 → '+vd;
  if(chg)return '判定有變化：攻方達成 '+S.vnChg.from+' → <b>'+n+'</b> / 3，若現在判定 → '+vd;
  return '攻方目前達成 <b>'+n+'</b> / 3 項條件；第 '+S.T+' 回合結束時才判定。';
}
function renderVC(){
  const cs=conditions();const n=cs.filter(c=>c.atk).length;
  $('#vcs').innerHTML=cs.map((c,i)=>'<div class="vc"><span class="n">'+(i+1)+'</span><div><div class="t">'+c.title+'</div><div class="d">'+c.desc+'<br>'+c.now+'</div></div><span class="pill '+(c.atk?'atk':'def')+'">'+(c.atk?'攻方':'守方')+'</span></div>').join('')+
    '<div class="dd" style="margin-top:8px">攻方控制本島領土 '+Math.round(twControl()*100)+'%（達 80% 立即判攻方勝利）；渡海船團全滅、登陸部隊耗盡則守方獲勝；灘頭補給線未建立時，島上部隊會逐回合損耗。</div>'+
    '<div class="proj">'+verdictNote(n)+'</div>';
  $('#miniGoal').innerHTML=verdictNote(n)+'（詳見「勝負」頁）';
}
function renderLog(){
  $('#log').innerHTML=S.log.length?S.log.map(l=>'<li><span class="tn">T'+l.t+(l.p==='atk'?'攻':'守')+'</span>'+l.msg+'</li>').join(''):'<li>尚無戰報。</li>';
}
function renderAll(){renderMap();renderStatus();renderCtrl();renderInfo();renderVC();renderNodes();renderLog();renderTheater();renderCost();}
// while recording a video simulation, a render call stores a frame instead of drawing
// 開局視角：第 1 回合輪到玩家時，畫面裡看得到的己方單位不到三分之一，就把地圖捲到己方單位最集中的地方（每一局、每一方只做一次）
const FOCUS_DONE=new WeakMap();
function focusOwnOnce(){
  if(!S||!S.started||S.over||S.sim||S.video||S.rec||S.turn!==1||!humanTurn())return;
  let done=FOCUS_DONE.get(S);
  if(!done){done={};FOCUS_DONE.set(S,done);}
  if(done[S.phase])return;
  const w=document.querySelector('.mapwrap');
  if(!w||document.body.classList.contains('mapfs')||w.scrollWidth<=w.clientWidth+2&&w.scrollHeight<=w.clientHeight+2)return;
  done[S.phase]=true;
  const pts=[];
  for(const u of S.units){
    if(u.side!==S.phase||u.hp<=0)continue;
    const p=center(u.c,u.r);
    pts.push([(MX0+p[0])/EVBW*w.scrollWidth,(MY0+p[1])/EVBH*w.scrollHeight]);
  }
  if(!pts.length)return;
  const inView=(p,l,t)=>p[0]>=l&&p[0]<=l+w.clientWidth&&p[1]>=t&&p[1]<=t+w.clientHeight;
  const seen=pts.filter(p=>inView(p,w.scrollLeft,w.scrollTop)).length;
  if(seen*3>=pts.length)return;
  let best=null,bn=-1;
  for(const c of pts){ // 以每個單位為中心試一次，取畫面內己方單位最多的位置
    const l=c[0]-w.clientWidth/2,t=c[1]-w.clientHeight/2,n=pts.filter(p=>inView(p,l,t)).length;
    if(n>bn){bn=n;best=[l,t];}
  }
  if(bn>seen){w.scrollLeft=best[0];w.scrollTop=best[1];}
}
// 新手引導：人類操作的前 2 回合，依目前動作顯示「下一步該做什麼」，可按 ✕ 永久關閉
// 登陸新手引導：玩家攻方在登陸過程的幾個狀態（有部隊在海上、選了船上的旅、上岸之後）；回傳 [標題,說明] 或 null
function landCoach(){
  if(!S||!S.started||S.phase!=='atk'||!S.ctrl||S.ctrl.atk!=='human')return null;
  const u=S.sel;
  if(u&&alive(u)&&u.side==='atk'&&u.ship&&!u.moved&&!u.acted){
    const sh=shipOf(u),ro=!!sh&&sh.type==='ro';for(const v of reach(u).values())if(v.kind==='land')return ['登陸：選地點','橘色格子＝可登陸，點一格就上岸（上岸後這個旅本回合不能再動）。地圖上的「★推薦」標籤是守軍少、離目標近的位置；工具列的「登陸提示」可以開關標籤。'];
    return ro?['登陸：滾裝船','滾裝船不能搶灘，要在已控制的港口或浮動碼頭卸載，現在還沒有。可以先用登陸艦搶灘、占下港口；詳細原因看資訊卡。']:['登陸：還沒靠岸','這個旅現在沒有可登陸的格子。綠色格子＝可航行的海面，往岸邊靠近，下回合再登陸；詳細原因看資訊卡。'];
  }
  if(!u&&S.units.some(x=>x.side==='atk'&&x.ship&&alive(x)&&!x.moved&&!x.acted))return ['登陸：你有部隊在海上','點選海上的船（或船上的旅），亮橘色的格子就是可登陸的位置，綠色是可航行的海面；「登陸提示」標籤會指出適合的地點。'];
  const fl=S.stats&&S.stats.firstLand;
  if(fl!=null&&S.turn<=fl+1)return ['登陸之後','灘頭已經有部隊：接著占領港口與城市（★勝負目標）、顧好補給（容量看狀態列）；滾裝船要等港口或浮動碼頭才能卸載重型旅。'];
  return null;
}
function coachUpdate(){
  let el=document.getElementById('coach');
  const off=(()=>{try{return localStorage.getItem('tsl-coach')==='off';}catch(e){return false;}})();
  const show=!off&&S&&S.started&&!S.over&&!S.sim&&!S.video&&!S.rec&&humanTurn()&&(S.turn<=2||landCoach()!==null);
  if(!show){if(el&&!el.hidden){el.hidden=true;locReq();}return;}
  const side=S.phase,col=side==='atk'?'紅色':'藍色',me=S.units.filter(u=>u.side===side),moved=me.some(u=>u.moved||u.acted);
  let step,txt;
  if(S.mode==='strike'){step='第 2 步：火力打擊';txt='點地圖上有橘圈的敵方目標來打擊；不想打了，再按一次「火力打擊」取消。';}
  else if(landCoach()){[step,txt]=landCoach();}
  else if(S.sel){step='第 2 步：下令';txt='點綠色格子＝移動；點橘圈的敵方單位＝攻擊。點空白處可取消選取。';}
  else if(!moved){step='第 1 步：選單位';txt='點一個'+col+'單位（例如沿岸的'+(side==='atk'?'兩棲旅，先讓它出航':'步兵旅')+'）。';}
  else{step='第 3 步：收尾';txt='還有單位想動就繼續；想打擊按「火力打擊」，不想一個個點就按「電腦代打」；做完按「結束階段」。';}
  if(!el){el=document.createElement('div');el.id='coach';el.className='coach';el.setAttribute('role','status');document.body.appendChild(el);}
  el.hidden=false;locReq();
  const key=step+txt;
    if(el.dataset.k!==key){el.dataset.k=key;
    el.innerHTML='<b>新手引導 · '+TX(step)+'</b>'+TX(txt)+'<button aria-label="'+TX('關閉引導')+'" title="'+TX('關閉引導（之後不再顯示）')+'">✕</button>';
    el.querySelector('button').onclick=()=>{try{localStorage.setItem('tsl-coach','off');
    }catch(e){}el.hidden=true;locReq();
    };
    }
}
