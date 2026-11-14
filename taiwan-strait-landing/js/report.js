'use strict';
/* ---------- theater rendering ---------- */
let FOLD={};
const TPROJ=(lon,lat)=>[((lon-116)*26*.9135).toFixed(1),((34-lat)*26).toFixed(1)];
const TPOLY=(pts,cls)=>'<polygon class="'+cls+'" points="'+pts.map(p=>TPROJ(p[0],p[1]).join(',')).join(' ')+'"/>';
const LAND={
  cn:[[114.8,34],[120.3,34],[120.9,32.5],[121.9,31.6],[121.9,30.8],[122.1,29.9],[121.6,28.9],[121.1,28.1],[120.5,27.2],[119.9,26.6],[119.6,25.9],[119.0,25.2],[118.4,24.6],[117.7,24.0],[117.0,23.6],[116.4,23.0],[114.8,22.7]],
  tw:[[121.5,25.3],[122,25],[121.9,24.5],[121.6,23.5],[121.2,22.8],[120.85,21.9],[120.7,22.3],[120.3,22.6],[120.1,23.0],[120.15,23.6],[120.7,24.5],[121.0,25.0]],
  ky:[[129.8,33.3],[130.5,33.9],[131.0,33.9],[131.7,33.3],[131.6,32.5],[131.3,31.6],[130.8,31.0],[130.6,31.2],[130.2,31.3],[130.3,32.0],[129.8,32.6]],
  ok:[[127.65,26.08],[127.95,26.35],[128.3,26.85],[128.15,26.88],[127.7,26.5]],
  ph:[[122.25,18.55],[122.40,17.90],[122.30,17.10],[122.05,16.30],[121.60,15.75],[121.55,15.00],[121.65,14.55],[121.95,14.05],[122.40,14.20],[122.90,14.15],[123.40,13.95],[124.05,12.70],[123.70,12.60],[123.20,13.00],[122.70,13.55],[122.20,13.50],[121.60,13.70],[121.00,13.70],[120.65,13.90],[120.60,14.40],[120.45,14.50],[120.55,14.90],[120.00,15.00],[119.95,15.80],[120.30,16.20],[120.35,16.75],[120.35,17.60],[120.55,18.20],[120.95,18.50],[121.40,18.65],[121.80,18.50]],
};
const EDCA=[[120.55,18.18,'拉婁'],[121.66,18.36,'卡米洛‧奧西亞斯'],[120.49,15.17,'巴薩'],[121.07,15.43,'馬格賽賽堡'],[120.27,14.82,'蘇比克灣'],[121.97,20.45,'巴丹（巴斯科）']];
const ISLES=[[129.4,28.3,3],[125.3,24.75,2.5],[124.15,24.4,2.5],[123.0,24.45,2],[119.6,23.55,2],[121.95,20.45,2],[121.9,19.4,2.2],[130.95,30.5,2.5]];
function renderTheater(){
  const T=(a,b)=>TPROJ(a,b);
  let o='<rect class="tsea" x="-28" y="0" width="408" height="570"/>';
  o+=TPOLY(LAND.cn,'tcn');
  ['tw','ky','ok','ph'].forEach(k=>{o+=TPOLY(LAND[k],'tland');});
  EDCA.forEach(([a,b,n])=>{const [x,y]=T(a,b);o+='<circle class="tedca" cx="'+x+'" cy="'+y+'" r="3.2"/>';});
  ISLES.forEach(([a,b,r])=>{const [x,y]=T(a,b);o+='<circle class="tland" cx="'+x+'" cy="'+y+'" r="'+r+'"/>';});
  const [bx1,by1]=T(118.2,26.3),[bx2,by2]=T(128.6,21.7);
  o+='<rect class="tbox" x="'+bx1+'" y="'+by1+'" width="'+(bx2-bx1).toFixed(1)+'" height="'+(by2-by1).toFixed(1)+'"/>';
  o+='<text class="tlb acc" x="'+bx1+'" y="'+(by2-0+12)+'">台海戰場（上方地圖）</text>';
  const tpe=T(121.5,25.05);
  [[127.75,26.35,'約 650 km'],[123.0,24.45,'與那國 110 km']].forEach(([a,b,l])=>{
    const [x,y]=T(a,b);o+='<line class="tdist" x1="'+tpe[0]+'" y1="'+tpe[1]+'" x2="'+x+'" y2="'+y+'"/>';
    o+='<text class="tlb sm" x="'+((+tpe[0]+ +x)/2+3).toFixed(1)+'" y="'+((+tpe[1]+ +y)/2-3).toFixed(1)+'">'+l+'</text>';});
  [['中國大陸',114.9,32.6],['東部戰區',114.9,27.4],['東海',124.5,29.5],['九州',131.9,31.9],['沖繩',128.4,27.3],['台灣',120.2,24.4],['菲律賓海',125.6,19.5],['呂宋',121.4,16.4],['南海',117.4,19]].forEach(([t,a,b])=>{const [x,y]=T(a,b);o+='<text class="tlb" x="'+x+'" y="'+y+'">'+t+'</text>';});
  const [yx,yy]=T(131.6,33.95);o+='<text class="tlb sm" x="'+yx+'" y="'+(+yy+9)+'" text-anchor="end">↗ 橫須賀（第 7 艦隊母港）</text>';
  const strikeOn=humanTurn()&&S.phase==='atk'&&S.mode==='strike',dStrikeOn=(humanTurn()&&S.phase==='def'&&S.mode==='strike'&&S.dfire>0&&lrOK())||tomOn();
  for(const [id,B] of Object.entries(CNB)){
    const [x0,y0]=T(B.lon,B.lat),x=+x0,y=+y0,hp=cnShown(id),tg=dStrikeOn&&cnTargets().includes(id);
    const shape=B.kind==='rf'?'<polygon class="tcb" points="'+x+','+(y-10)+' '+(x+10)+','+y+' '+x+','+(y+10)+' '+(x-10)+','+y+'"/>':
      B.kind==='air'?'<polygon class="tcb" points="'+x+','+(y-9)+' '+(x+9)+','+(y+7)+' '+(x-9)+','+(y+7)+'"/>':
      B.kind==='navy'?'<rect class="tcb" x="'+(x-8)+'" y="'+(y-8)+'" width="16" height="16"/>':B.kind==='isr'?'<polygon class="tcb" points="'+[0,-10,3,-3,10,0,3,3,0,10,-3,3,-10,0,-3,-3].map((v,j)=>j%2?y+v:x+v).join(',')+'"/>':'<circle class="tcb" cx="'+x+'" cy="'+y+'" r="8"/>';
    o+='<g class="tcg'+(hp>0?'':' off')+(S.cnSel===id?' sel':'')+'" data-cn="'+id+'">'+shape+'<text class="tnum w" x="'+x+'" y="'+(y+4)+'">'+hp+'</text>'+(tg?'<circle class="ttg d" cx="'+x+'" cy="'+y+'" r="15"/>':'')+
      '<text class="tlb b" x="'+(B.side==='l'?x-13:x+13)+'" y="'+(y+3)+'"'+(B.side==='l'?' text-anchor="end"':'')+'>'+B.n+'</text></g>';
  }
  for(const [b,B] of Object.entries(BASES)){
    const [x,y]=T(B.lon,B.lat);const us=S.fx.units.filter(f=>f.base===b);
    const live=us.filter(f=>f.hp>0).length,act=us.some(fxActive);
    const tg=strikeOn&&baseTargets(b).length;
    o+='<g class="tb'+(S.thSel===b?' sel':'')+'" data-b="'+b+'"><circle class="tbd '+B.c.toLowerCase()+(act?' on':'')+'" cx="'+x+'" cy="'+y+'" r="10"/>'+
      '<text class="tnum" x="'+x+'" y="'+(+y+4)+'">'+live+'</text>'+(tg?'<circle class="ttg" cx="'+x+'" cy="'+y+'" r="15"/>':'')+
      '<text class="tlb b" x="'+(+x+(b==='guam'||b==='sasebo'?-14:14))+'" y="'+(+y+4)+'"'+(b==='guam'||b==='sasebo'?' text-anchor="end"':'')+'>'+B.n+'</text></g>';
  }
  const svg=$('#tmap');svg.setAttribute('viewBox','-28 0 408 570');svg.innerHTML=o;svg.appendChild(tfxGroup());
  const P=S.pools,bar=(k,side)=>'<div class="pool"><span>'+POOLN[k]+'</span><i><em class="'+side+'" style="width:'+Math.round(100*Math.max(0,P[k])/Math.max(S.p0[k],P[k]))+'%"></em></i><b>'+Math.round(P[k]*10)/10+'</b></div>';
  const dt=(key,def,head,body)=>'<details class="fside" data-f="'+key+'"'+((FOLD[key]===undefined?def:FOLD[key])?' open':'')+'><summary class="fh">'+head+'</summary>'+body+'</details>';
  const cnN=Object.keys(CNB).filter(id=>S.cn[id]>0).length;
  let l=dt('atk',true,'<b>攻方</b>',['plaAir','plaCV','plaSub','plaAD','plaNavy','plaLst','plaLift','rf','plaCM','plaLR','plaHS','plaDrone'].map(k=>bar(k,'atk')).join(''))+
    dt('cnb',false,'<b>中方基地</b><span class="dd">運作中 '+cnN+' / '+Object.keys(CNB).length+'　◆火箭軍 ▲空軍 ■海軍 ●集結港</span>',
      Object.entries(CNB).map(([id,B])=>'<div class="fu cnrow'+(S.cnSel===id?' hl':'')+(dStrikeOn&&cnTargets().includes(id)?' tgt':'')+'" data-cnrow="'+id+'"><div><b>'+KIND_S[B.kind]+' '+B.n+'</b> <span class="dd">'+KIND_N[B.kind]+'</span></div><div class="fst"><span class="pips">'+
        Array.from({length:B.hp},(_,i)=>'<i class="'+(i<cnShown(id)?'f':'')+'"></i>').join('')+'</span><span class="st'+(cnShown(id)>0?'':' off')+'">'+(cnShown(id)>0?'運作中':'已癱瘓')+'</span></div></div>').join(''))+
    (S.air?'<div class="dd" style="margin:4px 0">戰機實際架數：共軍東部戰區 '+S.air.PLA+' 架（推估）、共軍航艦艦載機 '+cvFighters()+' 架、台灣 '+S.air.TW+' 架、美航艦艦載機 '+S.air.usF.map((n,i)=>(i?'第 '+(i+1)+' 支 ':'')+n).join('、')+' 架（各支航艦到場後才參戰）。空軍點數＝有效架次 ÷ '+AIR.K+'。</div>':'')+
    dt('def',true,'<b>守方</b>',['rocAir','rocNavy','rocSub','rocAD','rocAS','rocMsl','rocAtc','rocGml','rocAAsh','rocWC','rocSlam','rocRkt','rocDrone','rocMine'].filter(k=>S.p0[k]>0||S.pools[k]>0).map(k=>bar(k,'def')).join(''));
  ['US','JP'].forEach(c=>{
    const lv=S.fx.lv[c],pst=c==='US'&&usIdx()>=0;
    let inner=pst?'<div class="fu dd">'+pd(usIdx())+'。美軍'+casN(usCas())+(S.us.drop?'（已因傷亡退縮）':'')+'</div>':'';
    const us=S.fx.units.filter(f=>f.c===c);
    us.forEach(f=>{const st=fxStatus(f);
      inner+='<div class="fu'+(S.thSel===f.base?' hl':'')+'"><div><b>'+f.n+'</b> <span class="dd">'+f.d+'・'+BASES[f.base].n+'</span></div><div class="fst"><span class="pips">'+
        Array.from({length:f.max},(_,i)=>'<i class="'+(i<f.hp?'f':'')+'"></i>').join('')+'</span><span class="st'+(st==='出擊中'?' on':'')+'">'+st+'</span></div></div>';});
    l+=dt(c,lv>0||(pst&&S.turn>=2),'<b>'+CN[c]+'</b><span class="pill '+(lv||pst?c.toLowerCase():'off')+'">'+(pst?pn(usIdx()):LV[c][lv])+'</span>',inner);
  });
  $('#flist').innerHTML=l;
  const sel=S.thSel&&BASES[S.thSel],csel=S.cnSel&&CNB[S.cnSel];
  $('#thHint').textContent=dStrikeOn?'縱深打擊模式：點選大陸基地（紅色圖形），或主地圖上大陸沿岸集結中的攻方部隊與船隻（有圈的已被找到）。每次發射一包 4 枚，先過共軍防空攔截（越遠越多層），突破後命中率依目標硬度 20～45%；命中使基地受損一級（削弱火箭軍發射能量、機場出擊或港區），攻方每 2 回合修復一級。':csel?csel.n+'（'+KIND_N[csel.kind]+'）：'+csel.d+'，完整度 '+S.cn[S.cnSel]+'/'+csel.hp+(S.cn[S.cnSel]>0?'，被打擊需擲 '+cnNeed(S.cnSel)+' 以上':'，已癱瘓'):strikeOn?'火力打擊模式：點選基地打擊（需擲 '+'4～6）。打擊中立國家的基地會讓它參戰。':
    sel?sel.n+'：'+sel.d+(baseTargets(S.thSel).length?'，打擊需擲 '+baseNeed(S.thSel)+' 以上':''):'點選基地查看駐軍。美日部隊參戰後由電腦在守方階段自動出擊。';
}




/* ---------- human & economic cost (rough public-source estimates, not precise data) ---------- */
// personnel per unit at full strength; one step is a share of that
const PERS={amph:5000,mar:4000,abn:3000,arm:5000,inf:4000,tank:3500,res:3000,ssm:400,hmr:300,mlrs:300};
// equipment value per step, US$ billions
const EQUIP={amph:.15,mar:.12,abn:.08,arm:.25,inf:.1,tank:.2,res:.03,ssm:.15,hmr:.2,mlrs:.15};
// per point lost from a force pool: [personnel casualties, share killed, US$ billions, items lost, item name]
const POOLCOST={plaSub:[70,.9,1,1,'艘潛艦'],rocSub:[70,.9,1.5,1,'艘潛艦'],plaCV:[3000,.35,12,1,'艘航艦'],plaAir:[15,.8,.9,12,'架戰機'],plaNavy:[300,.4,1,1.5,'艘作戰艦'],plaAD:[60,.3,.3,1,'個防空陣地'],
  rocAir:[15,.8,.7,12,'架戰機'],rocNavy:[250,.4,.6,1.5,'艘作戰艦'],rocAD:[60,.3,.4,1,'個防空陣地']};
// per foreign step: [personnel casualties, share killed, US$ billions]
const FXCOST={air:[12,.7,.8],sub:[130,.9,2.5],ship:[300,.4,1],ssm:[150,.3,.2]};
// Bloomberg Economics (2024) one-year GDP impact estimates, % of GDP: war vs blockade; GDP in US$ trillions
const GDPHIT={war:{TW:40,CN:16.7,US:6.7,W:10.2},blockade:{TW:12.2,CN:8.9,US:3.3,W:5}};
const GDP={TW:.8,CN:19,US:29,W:110};
function newCost(){return {civ:{TW:0,JP:0,US:0,CN:0},dmg:{TW:0,JP:0,US:0,CN:0},econ:{TW:0,CN:0,US:0,JP:0},mkt:0};}
// estimates: round to hundreds, switch to 萬 above ten thousand
const LG=window.TSL_LANG||'zh-TW',LOC={'zh-TW':'zh-TW','zh-CN':'zh-CN',en:'en-US',ja:'ja-JP'}[LG];
const fmt=n=>LG==='en'?(n>=1e6?(n/1e6).toFixed(n>=1e7?0:1)+'M':n>=1e4?(n/1e3).toFixed(n>=1e5?0:1)+'K':n>=1000?(Math.round(n/100)*100).toLocaleString(LOC):String(Math.round(n/10)*10))
  :n>=10000?(n/10000).toFixed(n>=100000?0:1)+' 萬':n>=1000?(Math.round(n/100)*100).toLocaleString(LOC):String(Math.round(n/10)*10);
const ppl=n=>fmt(n)+(LG==='en'?'':n>=10000?'人':' 人');
// b is US$ billions
function money(b){
  if(LG==='en')return '$'+(b>=1000?(b/1000).toFixed(2)+' trillion':(b<10?b.toFixed(1):Math.round(b).toLocaleString(LOC))+' billion');
  return b>=1000?(b/1000).toFixed(2)+' 兆美元':Math.round(b*10).toLocaleString(LOC)+' 億美元';}
function civHit(where,h,kind){
  // civilian casualties and damage from fighting at a hex; cities are far deadlier than open ground
  const C=S.cost,c=h.t==='city'?1:h.t==='port'?.5:h.t==='mtn'?.02:.12;
  const base={strike:180,combat:900}[kind];
  C.civ[where]+=Math.round(base*c*(where==='TW'?(S.mods.civMul||1):1));C.dmg[where]+=(kind==='combat'?2:.5)*c+.05;
}
function econTick(){
  const C=S.cost,lv=S.fx.lv,ports=PORTS.filter(k=>S.owner[k]==='atk'&&!S.portDown[k]).length;
  C.econ.TW+=0.45+ports*.3;
  C.econ.CN+=1+.8*lv.US+.6*lv.JP;
  C.econ.US+=.3+.5*lv.US;
  C.econ.JP+=.3+.4*lv.JP;
  C.mkt=Math.max(-35,C.mkt-(1.5+.8*lv.US+.4*lv.JP));
}
function menLost(side,filter){
  let n=0,dead=0,eq=0;
  S.hits.forEach(h=>{if(h.side!==side||!h.type||h.type==='dd'||h.type==='ff'||h.type==='cv'||!PERS[h.type]||(filter&&!filter(h)))return;const per=PERS[h.type]/TYPES[h.type].hp*h.n;n+=per;dead+=per*(h.sea?.6:.3);eq+=EQUIP[h.type]*h.n;});
  return {n,dead,eq};
}
function poolLost(keys){
  let n=0,dead=0,eq=0;const what=[];
  keys.forEach(k=>{const d=Math.max(0,S.p0[k]-S.pools[k]);if(!d)return;const [p,kr,b,q,w]=POOLCOST[k];n+=p*d;dead+=p*d*kr;eq+=b*d;what.push(POOLN[k]+'損失約 '+Math.round(q*d)+' '+w);});
  return {n,dead,eq,what};
}
function fxLost(c){
  let n=0,dead=0,eq=0;
  S.fx.units.filter(f=>f.c===c).forEach(f=>{const d=f.max-f.hp;if(!d)return;const [p,kr,b]=isCSG(f)?[900,.3,4]:f.id==='bomber'?[8,.7,.7]:FXCOST[f.kind];n+=p*d;dead+=p*d*kr;eq+=b*d;});
  return {n,dead,eq};
}
function costSummary(){
  const C=S.cost;
  const pla=menLost('atk'),plaP=poolLost(['plaAir','plaNavy','plaAD','plaCV','plaSub']);
  const roc=menLost('def'),rocP=poolLost(['rocAir','rocNavy','rocAD','rocSub']);
  const us=fxLost('US'),jp=fxLost('JP');
  const rfUsed=S.p0.rf-S.pools.rf;
  return {
    mil:{atk:{n:pla.n+plaP.n,dead:pla.dead+plaP.dead},def:{n:roc.n+rocP.n,dead:roc.dead+rocP.dead},US:us,JP:jp},
    civ:C.civ,
    econ:{TW:C.econ.TW+C.dmg.TW+roc.eq+rocP.eq,CN:C.econ.CN+pla.eq+plaP.eq+rfUsed*.3+C.dmg.CN,US:C.econ.US+us.eq+C.dmg.US,JP:C.econ.JP+jp.eq+C.dmg.JP},
    mkt:C.mkt,seaDead:menLost('atk',h=>h.sea),plaP,rocP
  };
}
function gdpProjection(win){
  const lv=S.fx.lv,base=lv.US>=2?GDPHIT.war:GDPHIT.blockade;
  // a longer war or an occupation that brings lasting sanctions pushes the impact toward the full-year estimate
  const k=Math.min(1,.45+S.turn*.04+(win==='atk'?.25:0)+(lv.US>=3?.1:0));
  const o={};Object.keys(base).forEach(c=>{o[c]={pct:base[c]*k,usd:GDP[c]*base[c]*k/100};});
  return {o,k,kind:lv.US>=2?'戰爭':'封鎖與局部戰事'};
}
function renderCost(){
  const el=$('#costs');if(!el)return;
  if(!S.started){el.innerHTML='<div class="dd">開戰後在這裡累計雙方軍民傷亡、經濟損失與全球市場反應。數字為依公開資料粗估的遊戲換算。</div>';return;}
  const c=costSummary(),row=(l,v,cls)=>'<div class="crow"><span>'+l+'</span><b'+(cls?' class="'+cls+'"':'')+'>'+v+'</b></div>';
  el.innerHTML='<div class="eyebrow">傷亡（含死亡、受傷、失蹤）</div>'+
    row('攻方軍人','約 '+ppl(c.mil.atk.n),'atk')+row('守方軍人','約 '+ppl(c.mil.def.n),'def')+
    (c.mil.US.n||c.mil.JP.n?row('美軍／自衛隊','約 '+fmt(c.mil.US.n)+'／'+ppl(c.mil.JP.n)):'')+
    row('台灣平民','約 '+ppl(c.civ.TW))+(c.civ.CN?row('大陸平民（設施周邊）','約 '+ppl(c.civ.CN)):'')+(c.civ.JP+c.civ.US?row('日本、關島平民','約 '+ppl(c.civ.JP+c.civ.US)):'')+
    '<div class="eyebrow" style="margin-top:8px">經濟損失（累計）</div>'+
    row('台灣',money(c.econ.TW))+row('中國',money(c.econ.CN))+row('美國／日本',money(c.econ.US)+'／'+money(c.econ.JP))+
    row('全球股市',(c.mkt?c.mkt.toFixed(1):'0')+'%',c.mkt<-10?'atk':'')+
    row('先進晶片供應',S.turn>1||S.phase==='def'?'中斷（台灣產能約占全球九成）':'正常');
}

/* ---------- after-action report ---------- */
function lossCat(h){if(h.why==='地面戰鬥'&&h.sea)return '搶灘突擊';const f=S.fx.units.find(f=>f.n===h.why);return f?(f.c==='US'?'美軍':'自衛隊')+'打擊':h.why;}
function lossBy(side,sea){
  const m={};S.hits.filter(h=>h.side===side&&(sea===undefined||h.sea===sea)).forEach(h=>{
    const k=lossCat(h);m[k]=(m[k]||0)+h.n;});
  return Object.entries(m).sort((a,b)=>b[1]-a[1]);
}
// 結局「雙方損失」：左攻、右守（盟軍列在守方欄的小節）；數字全部來自既有的傷亡計算與開局／結束時的數量差
function lossData(){
  const P=S.pools,p0=S.p0,c=costSummary(),a=S.air,bl=S.stats.bdeLost||{atk:0,def:0},m=c.mil,cv=c.civ;
  let plaF=0,twF=0,usF=0;
  if(a){plaF=Math.max(0,a.PLA0-a.PLA);{const on=cvIdx();for(let i=0;i<Math.min(p0.plaCV,AIR.CV.length);i++)plaF+=on.includes(i)?Math.max(0,AIR.CV[i].f-a.cvF[i]):AIR.CV[i].f;}
    twF=Math.max(0,a.TW0-a.TW);S.fx.units.filter(isCSG).forEach(cs=>{const i=csgIdx(cs.id),n=a.usF?a.usF[i]:AIR.US.f;usF+=Math.max(0,AIR.US.f-n)+(cs.hp<=0?n:0);});}
  const d=(x,y)=>Math.max(0,Math.round((x||0)-(y||0)));
  const atk=[['軍人傷亡','約 '+ppl(m.atk.n)+'（死亡或失蹤約 '+ppl(m.atk.dead)+'）'],
    ['平民（中國大陸軍事設施周邊）','約 '+fmt(cv.CN)+' 人'],
    ['戰機',airLossTxt('atk',plaF,'（含艦載機）')],['護航艦','−'+(d(p0.plaNavy,P.plaNavy)+((S.stats.escLost||{}).atk||0))+' 艘（含航艦護航）'],['航艦','−'+d(p0.plaCV,P.plaCV)+' 艘'],['潛艦','−'+d(p0.plaSub,P.plaSub)+' 艘'],
    ['運輸與補給船','−'+((S.stats.lstSunk||0)+(S.stats.cvySunk||0))+' 支'],['被殲滅的旅','−'+bl.atk+' 個']];
  const def=[['軍人傷亡','約 '+ppl(m.def.n)+'（死亡或失蹤約 '+ppl(m.def.dead)+'）'],
    ['台灣平民','約 '+ppl(cv.TW)+'（死亡或失蹤約 '+ppl(cv.TW*.3)+'）'],
    ['戰機',airLossTxt('def',twF)],['海軍艦艇','−'+Math.max(0,(S.rocShips0||0)-S.units.filter(u=>u.fl&&alive(u)).reduce((a,u)=>a+u.hp,0))+' 艘（開戰時 '+(S.rocShips0||0)+' 艘）'],['潛艦','−'+d(p0.rocSub,P.rocSub)+' 艘'],['被殲滅的旅','−'+bl.def+' 個']];
  const ally=[];
  if(m.US.n)ally.push(['美軍傷亡','約 '+ppl(m.US.n)+'（死亡或失蹤約 '+ppl(m.US.dead)+'）']);
  if(m.JP.n)ally.push(['日本自衛隊傷亡','約 '+ppl(m.JP.n)+'（死亡或失蹤約 '+ppl(m.JP.dead)+'）']);
  if(usF)ally.push(['美航艦艦載機',airLossTxt('us',usF)]);
  if((S.stats.escLost||{}).def)ally.push(['美軍護航艦','−'+S.stats.escLost.def+' 艘']);
  S.fx.units.filter(isCSG).forEach(cs=>{if(cs.hp<(cs.max||3))ally.push([csgName(csgIdx(cs.id)),cs.hp<=0?'被擊沉':plainT()?cvSt(cs.hp,cs.max||3):'受創 −'+((cs.max||3)-cs.hp)+' 步']);});
  if(S.stats.jpShip)ally.push(['海自艦艇','−'+S.stats.jpShip+' 艘']);
  if(S.stats.ssnLost)ally.push(['美軍攻擊潛艦','−'+S.stats.ssnLost+' 艘']);
  if(cv.US)ally.push(['關島居民','約 '+ppl(cv.US)]);
  if(cv.JP)ally.push(['日本平民（沖繩等）','約 '+ppl(cv.JP)]);
  return {atk,def,ally};
}
function lossColsHTML(){
  if(!S.started)return '';
  const L=lossData(),rows=a=>a.map(([k,v])=>'<div class="lrow"><span>'+k+'</span><b>'+v+'</b></div>').join('');
  return '<div class="lossc"><div class="lcol atk"><div class="lh">'+SIDE.atk+'損失</div>'+rows(L.atk)+'</div><div class="lcol def"><div class="lh">'+SIDE.def+'損失</div>'+rows(L.def)+
    '<div class="lsub">盟軍</div>'+(L.ally.length?rows(L.ally):'<div class="lrow dd"><span>未參戰或沒有損失</span></div>')+'</div></div>';
}
function costReport(win){
  const c=costSummary(),g=gdpProjection(win),tr=(a,b,d)=>'<tr><td>'+a+'</td><td>'+b+'</td><td>'+(d||'')+'</td></tr>';
  const m=c.mil,cv=c.civ;
  const casSum='軍人 攻 '+fmt(m.atk.n)+'・守 '+fmt(m.def.n)+'；台灣平民 '+fmt(cv.TW),ecoSum='全球 GDP −'+g.o.W.pct.toFixed(1)+'%・股市 '+c.mkt.toFixed(1)+'%';
  return acc('軍民傷亡',casSum,'<div class="tbl"><table class="ctable"><thead><tr><th></th><th>傷亡</th><th>其中死亡或失蹤</th></tr></thead><tbody>'+
    tr('攻方軍人','約 '+ppl(m.atk.n),'約 '+ppl(m.atk.dead))+
    tr('守方軍人','約 '+ppl(m.def.n),'約 '+ppl(m.def.dead))+
    (m.US.n?tr('美軍','約 '+ppl(m.US.n),'約 '+ppl(m.US.dead)):'')+(m.JP.n?tr('日本自衛隊','約 '+ppl(m.JP.n),'約 '+ppl(m.JP.dead)):'')+
    tr('台灣平民','約 '+ppl(cv.TW),'約 '+ppl(cv.TW*.3))+
    (cv.CN?tr('中國大陸平民（軍事設施周邊）','約 '+fmt(cv.CN)+' 人','約 '+fmt(cv.CN*.3)+' 人'):'')+(cv.JP?tr('日本平民（沖繩等）','約 '+ppl(cv.JP),'約 '+ppl(cv.JP*.3)):'')+(cv.US?tr('關島居民','約 '+ppl(cv.US),'約 '+ppl(cv.US*.3)):'')+
    '</tbody></table></div>'+
    '<div class="dd">裝備：'+[c.plaP.what.length?'攻方 '+c.plaP.what.join('、'):'',c.rocP.what.length?'守方 '+c.rocP.what.join('、'):''].filter(Boolean).join('；')+(S.p0.rf-S.pools.rf?'；火箭軍發射約 '+fmt((S.p0.rf-S.pools.rf)*40)+' 枚飛彈':'')+(S.stats.cn.strikes?'。大陸平民傷亡只計入軍事設施周邊的波及':'。中國大陸本土未遭打擊，本遊戲不計大陸平民傷亡')+'。</div>'
    ,false)+acc('經濟代價',ecoSum,'<div class="tbl"><table class="ctable"><thead><tr><th></th><th>戰事期間直接損失</th><th>若戰事與制裁延續一年，GDP 衝擊</th></tr></thead><tbody>'+
    tr('台灣',money(c.econ.TW),'−'+g.o.TW.pct.toFixed(1)+'%（約 '+money(g.o.TW.usd*1000)+'）')+
    tr('中國',money(c.econ.CN),'−'+g.o.CN.pct.toFixed(1)+'%（約 '+money(g.o.CN.usd*1000)+'）')+
    tr('美國',money(c.econ.US),'−'+g.o.US.pct.toFixed(1)+'%（約 '+money(g.o.US.usd*1000)+'）')+
    tr('日本',money(c.econ.JP),'無公開估算')+
    tr('全球','股市累計 '+c.mkt.toFixed(1)+'%','−'+g.o.W.pct.toFixed(1)+'%（約 '+money(g.o.W.usd*1000)+'）')+
    '</tbody></table></div>'+
    '<div class="dd">先進晶片：台灣生產全球約九成的先進製程晶片，戰事期間供應中斷，汽車、手機、AI 伺服器等產業首當其衝。一年期 GDP 衝擊以 Bloomberg Economics 2024 年的估算為基準（'+g.kind+'情境），依本局戰事規模與結果換算 '+Math.round(g.k*100)+'%。所有數字為遊戲依公開資料的粗估，僅供參考。</div>',false);
}
function usPath(){const h=S.us.hist.filter(x=>x.idx>=0);return h.length?'美軍立場：'+h.map(x=>'T'+x.t+' '+pn(x.idx)).join(' → ')+'。':'';}
function srcLine(){
  const by=f=>S.hits.filter(h=>h.side==='atk'&&h.sea&&f(h.why)).reduce((a,h)=>a+h.n,0);
  const a=by(w=>w==='反艦飛彈'),b=by(w=>/守方|無人機|飽和|海空攻擊/.test(w)),c=by(w=>{const f=S.fx.units.find(x=>x.n===w);return f&&f.c==='US';}),d=by(w=>{const f=S.fx.units.find(x=>x.n===w);return f&&f.c==='JP';});
  return '海上損失來源（'+(plainT()?'受創次數':'步')+'）：台灣岸置與艦載反艦飛彈 '+a+'、台灣海空軍與無人機 '+b+'、美軍 '+c+'、日本 '+d+'。';
}
function afterAction(win){
  const st=S.stats,b=snap(),P=S.pools,sum=a=>a.reduce((x,y)=>x+y[1],0);
  const seaL=sum(lossBy('atk',true)),landL=sum(lossBy('atk',false)),defL=sum(lossBy('def'));
  const allyHits=S.hits.filter(h=>h.side==='atk'&&S.fx.units.some(f=>f.n===h.why)).reduce((a,h)=>a+h.n,0);
  const ssmHits=S.hits.filter(h=>h.side==='atk'&&(h.why==='反艦飛彈'||h.why==='守方海軍')).reduce((a,h)=>a+h.n,0);
  const usIn=S.fx.lv.US>=2,jpIn=S.fx.lv.JP>=2;
  const keys=[];
  // weight each finding by how much it moved the result
  const seaM=menLost('atk',h=>h.sea),allyM=menLost('atk',h=>S.fx.units.some(f=>f.n===h.why)),ssmM=menLost('atk',h=>h.why==='反艦飛彈'||h.why==='守方海軍');
  if(seaL>=6)keys.push([seaL,'渡海損失：攻方約 '+Math.round(seaL/3)+' 個旅在渡海途中失去戰力，傷亡約 '+ppl(seaM.n)+'（其中約 '+ppl(seaM.dead)+'死亡或失蹤）'+(allyHits?'，約 '+ppl(allyM.n)+'是美日部隊造成':'')+(ssmHits?'、約 '+ppl(ssmM.n)+'是守方反艦飛彈與海軍造成':'')+'。'+srcLine()]);
  if(usIn||jpIn)keys.push([allyHits+4,'外國參戰：'+b.fx+'。'+usPath()+(allyHits?'美日部隊共造成攻方約 '+ppl(allyM.n)+'傷亡。':'但實際戰果有限。')+(st.esc.length?'攻方打擊基地引發升級：'+st.esc.join('、')+'。':'')]);
  else keys.push([3,'外國參戰有限：'+b.fx+'，戰局主要由兩岸兵力決定。'+usPath()]);
  if(st.cn.strikes)keys.push([st.cn.hits+3,'縱深打擊：台灣與盟軍共發動 '+st.cn.strikes+' 次，命中 '+st.cn.hits+' 次，癱瘓 '+Object.keys(CNB).filter(id=>S.cn[id]<=0).length+' 處基地；火箭軍飛彈存量剩 '+fmt1(P.rf)+'／'+S.p0.rf+'。'+(st.retal.strikes?'中方報復 '+st.retal.strikes+' 次，命中 '+st.retal.hits+' 次。':'')]);
  keys.push([b.ports?b.ports*3:5,b.ports?'港口：攻方控制 '+b.ports+' 個主要港口，重型旅得以上岸、補給容量擴大。':'港口：攻方沒有拿下任何主要港口，重型旅無法上岸，補給只能靠灘頭。']);
  const hold=st.tpHold||0;
  keys.push([b.taipei?8:3,b.taipei?'首都：攻方控制台北，已連續 '+hold+' 個回合'+(hold<2?'（直到最後才占領，視為暫時占領、立足未穩）':'')+'。':'首都：台北始終由守方控制，或已被收復。']);
  const airR=b.ally>0?b.plaAir/b.ally:9,airGap=airR>=AIR.ctl?3:airR<=1/AIR.ctl?-3:0;
  keys.push([Math.abs(airGap)+1,'制空：結束時攻方戰機 '+b.plaN+' 架、台灣戰機 '+b.twN+' 架（有效戰力比 '+(Math.round(airR*100)/100)+'），'+(airGap>=3?'攻方掌握空優，火力打擊得以持續。':airGap<=-3?'守方與盟國奪回空優，攻方火力受限。':'雙方空中力量拉鋸。')+'攻方共使用火力 '+st.fire+' 點，火箭軍存量剩 '+fmt1(P.rf)+'。']);
  if(P.plaCV<S.p0.plaCV)keys.push([4+(S.p0.plaCV-P.plaCV)*2,'航艦：共軍航艦折損 '+(S.p0.plaCV-P.plaCV)+' 艘（剩 '+fmt1(P.plaCV)+'），艦載機的制空與火力支援下降。']);
  if(P.plaNavy<=2)keys.push([5,'制海：攻方護航艦隊幾乎耗盡（剩 '+fmt1(P.plaNavy)+'），後續船團失去掩護。']);
  if(st.firstLand===null)keys.push([9,'登陸時程：攻方始終沒有部隊踏上台灣本島。']);
  else if(st.firstLand>=3)keys.push([4,'登陸時程：攻方第一支部隊到第 '+st.firstLand+' 回合才上岸，給了守方動員與盟國反應的時間。']);
  if(st.badWx>=2)keys.push([st.badWx+1,'天候：共有 '+st.badWx+' 個回合惡劣天候，渡海與火力都受限。']);
  if(st.over>=2)keys.push([st.over+1,'補給：攻方有 '+st.over+' 個回合島上部隊超過補給容量，攻防各 −1。']);
  const landM=menLost('atk',h=>!h.sea),defM=menLost('def');
  keys.push([Math.abs(b.as-b.ds)/3,'地面兵力：結束時攻方島上'+(menOnTW('atk')?'約 '+ppl(menOnTW('atk')):'已無部隊')+'、守方'+(menOnTW('def')?'約 '+ppl(menOnTW('def')):'已無部隊')+'；攻方地面傷亡約 '+ppl(landM.n)+'，守方地面部隊傷亡約 '+ppl(defM.n)+'，守方後備旅動員 '+st.reserves+' 個。']);
  keys.sort((x,y)=>y[0]-x[0]);
  const atkTips=[],defTips=[];
  const ssmLeft=S.units.some(u=>u.side==='def'&&u.type==='ssm');
  if(seaL>=6&&(usIn||jpIn))atkTips.push({t:'在美日參戰前完成登陸：考慮「戰略突襲」或冬季發起，讓第一波在第 2 回合內全部上岸；或在開戰時先打擊沖繩基地，接受日美參戰的代價換取削弱其戰力。',a:{optBuild:'surprise'}});
  if(seaL>=6&&ssmLeft)atkTips.push('先制打擊選「反艦飛彈陣地」，並在船團出航前用火力優先打擊守方飛彈單位。');
  if(st.esc.length&&b.n<2)atkTips.push('打擊中立國家的基地引發了升級（'+st.esc.join('、')+'），除非能一次重創其戰力，否則得不償失。');
  if(!b.ports)atkTips.push('集中兵力在台中港或基隆附近登陸，盡早奪港讓重型旅上岸，並擴大補給容量。');
  if(st.over>=2)atkTips.push('增兵前先擴大灘頭：每控制一個灘岸格 +2、港口 +4 補給容量，避免島上部隊超載。');
  if(st.badWx>=2)atkTips.push({t:'選擇四月窗口，降低惡劣天候拖慢渡海與火力的機率。',a:{optMonth:'4'}});
  if(airGap<0)atkTips.push('制空落後時火力點數會大減，應把火力集中在削弱對方空軍與防空，而不是分散打地面部隊。');
  if(st.firstLand!==null&&st.firstLand>=3)atkTips.push('第一波應從最靠近台灣的平潭、福州一帶出航，縮短渡海時間。');
  if(st.cn.hits>=4)atkTips.push('大陸的火箭軍與機場遭到持續打擊（命中 '+st.cn.hits+' 次）：分散並加固發射陣地、加強防空，並考慮反制盟軍的長程打擊平台。');
  if(win!=='atk'&&!(S.sandbox&&S.sandbox.length)){atkTips.push({t:'想體驗不同的局面：開啟「砸鍋賣鐵加速造艦」：護航艦隊 +2、航艦 +1，但美日警覺度上升。',a:{optWiShip:'1'}});}
  if(!atkTips.length)atkTips.push('目前的做法有效：維持集中登陸、儘早奪港的節奏，並保留火力應付守方反擊。');
  if(b.taipei)defTips.push('台北失守：動員時考慮「首都要塞化」，並保留一個裝甲旅在台北周邊作為預備隊。');
  if(b.ports>=1)defTips.push('港口被奪：港口守備應加強，裝甲旅部署在港口附近，在攻方站穩前立即反擊。');
  if(!ssmLeft)defTips.push('反艦飛彈陣地全數損失：飛彈應分散、機動部署，打完就轉移陣地，避免被先制打擊與火力打擊清除。');
  if(st.reserves<4)defTips.push('後備部隊到位不足（'+st.reserves+' 個旅）：強化電網、通信等關鍵設施韌性，並提早發布動員令。');
  if(P.rocAir<=1||P.rocAD<=1)defTips.push('空軍與防空在開戰初期就被壓制：加強機堡、分散跑道與機動防空，保留戰力到攻方渡海時再出擊。');
  if(S.fxScen==='intel')defTips.push('本局美國只提供情報、不公開參戰：情報讓守方反艦飛彈更準，但出兵與補給都不會來，守方仍要靠自身的飛彈、海空軍與後備動員。');
  else if(S.fxScen==='none')defTips.push('本局設定為台灣孤軍作戰：守方只能靠自身的反艦飛彈、海空軍與後備動員，應把火力集中在渡海船團。');
  else if(!(usIn||jpIn))defTips.push('盟國沒有實質參戰：戰前外交與早期預警很關鍵，攻方公開集結時的參戰機率明顯較高。');
  if(seaL>=6)defTips.push('海上殲敵是最有效的防衛：繼續把反艦飛彈、海軍與盟軍火力集中在渡海船團。');
  if(!st.cn.strikes&&S.pools.rocMsl>=8)defTips.push('長程對地飛彈全程沒有使用：中方火箭軍與機場是主要威脅，可以考慮在渡海前就打擊火箭軍與集結港。');
  if(!defTips.length)defTips.push('守方防線大致穩固：保持機動預備隊，並持續打擊海上增援。');
  const yours=S.sim?null:(S.ctrl.atk==='human'&&S.ctrl.def!=='human'?'atk':S.ctrl.def==='human'&&S.ctrl.atk!=='human'?'def':null);
  const tipBlock=side=>'<div class="aar-col"><div class="eyebrow">'+SIDE[side]+(yours===side?'（你的陣營）':'')+(win===side?' · 勝方：可保持的做法':' · 改進措施')+'</div><ul>'+(side==='atk'?atkTips:defTips).map(x=>typeof x==='string'?'<li>'+x+'</li>':'<li>'+x.t+(x.a?' <button class="ghost sm tipapply" data-a=\''+JSON.stringify(x.a)+'\'>套用到下一局</button>':'')+'</li>').join('')+'</ul></div>';
  const lossList=(side,label)=>{const l=lossBy(side).map(([k])=>[k,menLost(side,h=>lossCat(h)===k).n]).sort((a,b)=>b[1]-a[1]);return '<div><b>'+label+'</b>：'+(l.length?l.map(([k,v])=>k+' 約 '+ppl(v)).join('、'):'無')+'</div>';};
  const top=lossBy('atk')[0];
  return '<div class="aar"><div class="eyebrow fin-eb">戰後檢討報告 · 參戰情境：'+FXSCEN[S.fxScen]+'</div>'+
    acc('勝負關鍵',Math.min(5,keys.length)+' 項重點（'+keys[0][1].split('：')[0]+' 等）','<ol>'+keys.slice(0,5).map(k=>'<li>'+k[1]+'</li>').join('')+'</ol>',true)+
    costReport(win)+
    acc('部隊傷亡來源（不含空軍、海軍、防空）',top?'攻方最大來源：'+top[0]:'—','<div class="aar-loss">'+lossList('atk','攻方')+lossList('def','守方')+'</div>',false)+
    acc('檢討與改進措施','攻方 '+atkTips.length+' 項・守方 '+defTips.length+' 項','<div class="aar-grid">'+(yours==='def'?tipBlock('def')+tipBlock('atk'):tipBlock('atk')+tipBlock('def'))+'</div>',yours==='atk'&&win!=='atk')+'</div>';
}

/* ---------- news ---------- */
// 新聞頭條：用這回合實際的命中紀錄（船種、武器、地點、是否沉沒、船上官兵）組成句子；句型依回合固定輪替（不吃戰局種子）
const NEWS_SHIP={ddh:'出雲級',jdg:'海自神盾艦',jdd:'海自護衛艦',lst:'兩棲艦群',ro:'滾裝運兵船',cvy:'補給船團',dd:'護航艦',d55:'055 型驅逐艦',d52:'052D 型驅逐艦',f54:'054A 型護衛艦',cv:'航艦'};
const vpick=(arr,seed)=>arr[((seed%arr.length)+arr.length)%arr.length];
function newsPlace(hs){ // 命中地點：最近的台灣地名＋外海；太遠就用大範圍海域
  if(!hs.length)return '海峽';const cx=hs.reduce((a,h)=>a+h.c,0)/hs.length,cy=hs.reduce((a,h)=>a+h.r,0)/hs.length,c0={c:Math.round(cx),r:Math.round(cy)};
  let best=null,bd=99;for(const h of Object.values(TER))if(h.isl==='TW'&&h.name&&!/基地|機場/.test(h.name)){const d=hd(h,c0);if(d<bd){bd=d;best=h;}}
  if(best&&bd<=6)return best.name+'外海';const [lon]=rcToLL(c0.c,c0.r);return lon<120.9?'台灣海峽':lon>122.6?'台灣東方海域':'台灣周邊海域';
}
const whyShort=w=>(w==='地面戰鬥'?'灘頭守軍火力':String(w||'')).replace(/（[^）]*）$/,'').replace(/^守方（.*?）$/,'岸置飛彈').replace(/^(.{0,12}).*$/,'$1');
function newsSea(t,a,b){
  const all=S.hits.filter(h=>h.t===t&&h.side==='atk'&&h.sea);if(!all.length)return null;
  const ships=all.filter(h=>NEWS_SHIP[h.type]&&h.type!=='cv'),bde=all.filter(h=>PERS[h.type]);
  const hitN=ships.length+bde.filter(x=>!ships.some(s=>s.c===x.c&&s.r===x.r&&s.why===x.why)).length;if(hitN<3)return null;
  const cnt=(arr,f)=>{const m={};arr.forEach(h=>{const k=f(h);if(k)m[k]=(m[k]||0)+1;});return Object.entries(m).sort((x,y)=>y[1]-x[1]);};
  const sunk=cnt(ships.filter(h=>h.dead),h=>NEWS_SHIP[h.type]),dmg=cnt(ships.filter(h=>!h.dead),h=>NEWS_SHIP[h.type]);
  const unit=k=>/艦$|驅逐艦|護衛艦/.test(k)?' 艘':' 支';
  const part=(v,arr)=>arr.length?v+arr.slice(0,3).map(([k,n])=>k+' '+n+unit(k)).join('、'):'';
  const list=[part('擊沉 ',sunk),part('重創 ',dmg)].filter(Boolean).join('，');
  const w=cnt(all,h=>whyShort(h.why)).slice(0,2).map(x=>x[0]),weap=w.join('與')||'反艦攻擊';
  const men=Math.round(bde.reduce((x,h)=>x+PERS[h.type]/(TYPES[h.type].hp||3)*h.n,0)/100)*100;
  const loc=newsPlace(all),menT=men>=300?'，船上約 '+ppl(men)+'下落不明':'';
  const seed=t*7+hitN;
  return vpick([
    loc+'血戰：'+weap+(list?list:'命中 '+hitN+' 次')+menT,
    '共軍渡海船團在'+loc+'遭伏擊，'+weap+'先後命中 '+hitN+' 次'+(list?'，'+list:'')+menT,
    loc+'火光沖天：'+(list||'船團連續中彈 '+hitN+' 次')+'；主要來自'+weap+menT,
    '守方集中火力打擊'+loc+'的船團：'+weap+'命中 '+hitN+' 次'+(list?'，'+list:'')+menT],seed);
}
function newsCarrier(t,a,b){
  const out=[];
  const cv=S.hits.filter(h=>h.t===t&&h.type==='cv');
  if(cv.length){const byN={};cv.forEach(h=>{const k=h.cvn||'共軍航艦';(byN[k]=byN[k]||[]).push(h);});
    Object.entries(byN).forEach(([nm,hs])=>{const dead=hs.some(h=>h.dead),w=[...new Set(hs.map(h=>whyShort(h.why)))].slice(0,2).join('與'),loc=newsPlace(hs);
      out.push(dead?vpick([nm+'艦在'+loc+'被'+w+'擊沉，共軍剩 '+b.cv+' 艘航艦',w+'擊沉'+nm+'艦，'+loc+'海面一片油污'],t):vpick([nm+'艦在'+loc+'遭'+w+'命中，戰力下降',w+'命中'+nm+'艦，艦載機出擊受影響'],t));});}
  else if(b.cv<a.cv)out.push('共軍航艦遭重創，剩 '+b.cv+' 艘');
  const us=S.hits.filter(h=>h.t===t&&h.type==='csg');
  if(us.length&&!us.some(h=>h.dead)){const w=[...new Set(us.map(h=>whyShort(h.why)))].slice(0,2).join('與');out.push(vpick(['美軍航艦打擊群在'+newsPlace(us)+'遭'+w+'命中','美航艦中彈：'+w+'突破艦隊防空'],t));}
  return out;
}
function newsCN(t){
  const cl=S.cnLog.filter(x=>x.t===t);if(!cl.length)return null;
  const hit=cl.filter(x=>x.hit),names=[...new Set(hit.map(x=>CNB[x.id]&&CNB[x.id].n).filter(Boolean))];
  const eff=[...new Set(hit.map(x=>({rf:'火箭軍發射能力下降',air:'機場出擊能力下降',navy:'港口與艦隊受損',stg:'集結部隊與船隻受損'})[CNB[x.id]&&CNB[x.id].kind]).filter(Boolean))];
  const by=[...new Set(cl.map(x=>({roc:'台灣',US:'美軍',JP:'自衛隊'})[x.by]).filter(Boolean))].join('、');
  if(!hit.length)return vpick([by+'對大陸發動 '+cl.length+' 次飛彈打擊，全部被攔截或落空',by+'飛彈縱深打擊 '+cl.length+' 次，未見明顯戰果'],t);
  const nm=names.slice(0,3).join('、')+(names.length>3?' 等 '+names.length+' 處':'');
  return vpick([by+'飛彈命中大陸 '+nm+(eff.length?'，'+eff.join('、'):''),'大陸 '+nm+' 遭'+by+'打擊（'+cl.length+' 發命中 '+hit.length+' 發）'+(eff.length?'：'+eff[0]:'')],t);
}
function buildNews(){
  const st=S.turnStart||{snap:snap(),lv:S.fx.lv,owner:S.owner},a=st.snap,b=snap(),t=S.turn,items=[];
  if(st.owner[TAIPEI]!==S.owner[TAIPEI])items.push(S.owner[TAIPEI]==='atk'?'台北失守，攻方部隊攻入首都':'守軍收復台北');
  ['US','JP'].forEach(c=>{const v=S.fx.lv[c];if(v>st.lv[c])items.push(
    c==='US'?(v===3?'美國宣布全面參戰，航艦打擊群駛向台海':v===2?'美軍開始介入，潛艦與轟炸機投入作戰':'美國宣布向台灣提供情報支援'):
    (v===2?'日本認定存立危機事態，自衛隊投入作戰':'日本同意美軍使用駐日基地'));});
  S.us.hist.filter(h=>h.t===t&&h.retreat).forEach(h=>items.push('美國因傷亡升高改為「'+pn(h.idx)+'」，不再公開承認參戰'));
  PORTS.forEach(k=>{if(st.owner[k]!==S.owner[k])items.push(S.owner[k]==='atk'?'攻方奪下'+TER[k].name+'，取得卸載港口':'守軍奪回'+TER[k].name);});
  if(a.as===0&&b.as>0)items.push('攻方部隊登陸台灣，灘頭激戰');
  {const sn=newsSea(t,a,b);if(sn)items.push(sn);}
  if(b.ds<=a.ds-5)items.push('守軍傷亡慘重，島上戰力降至'+cpTxt(b.ds));
  if(b.as<=a.as-4)items.push('攻方登陸部隊受挫，島上戰力剩'+cpTxt(b.as));
  newsCarrier(t,a,b).forEach(x=>items.push(x));
  if(b.navy<a.navy)items.push('攻方護航艦隊折損 '+(a.navy-b.navy)+' 艘次');
  {const cn=newsCN(t);if(cn)items.push(cn);}
  if(!items.length)items.push(b.as?'島上激戰持續，雙方陷入膠著':'攻方船團仍在海峽渡海集結');
  return {t,items,a,b,weather:S.weather.n};
}
function menOnTW(side){return S.units.filter(u=>u.side===side&&onTW(u)).reduce((a,u)=>a+PERS[u.type]/TYPES[u.type].hp*u.hp,0);}
function newsArt(t){
  const [x0]=cc(2,0);let o='';
  for(const h of Object.values(TER)){if(!isLand(h))continue;const [x,y]=center(h.c,h.r);
    o+='<polygon class="hx '+h.t+(h.isl==='CN'?' cn':'')+'" points="'+hexPts(x,y,R)+'"/>';
    if(h.isl!=='CN'&&S.owner[h.k]==='atk')o+='<polygon class="ov-atk" points="'+hexPts(x,y,R-1)+'"/>';}
  S.units.forEach(u=>{const [x,y]=center(u.c,u.r);
    o+=atSea(u)?'<path class="ndot atk" d="M'+(x-8)+' '+(y+5)+'L'+x+' '+(y-8)+'L'+(x+8)+' '+(y+5)+'Z"/>':'<circle class="ndot '+u.side+'" cx="'+x+'" cy="'+y+'" r="6"/>';});
  const seen={};S.hits.filter(h=>h.t===t).forEach(h=>{const k=K(h.c,h.r);if(seen[k])return;seen[k]=1;const [x,y]=center(h.c,h.r);
    let p=[];for(let i=0;i<16;i++){const r=i%2?6:14,ang=Math.PI*i/8;p.push((x+r*Math.cos(ang)).toFixed(1)+','+(y+r*Math.sin(ang)).toFixed(1));}
    o+='<polygon class="boom" points="'+p.join(' ')+'"/>';});
  ['台北','台中港','高雄'].forEach(n=>{const h=Object.values(TER).find(x=>x.name===n);const [x,y]=center(h.c,h.r);o+='<text class="nlbl" x="'+(x+16)+'" y="'+(y+4)+'">'+n+'</text>';});
  return '<svg class="nart" viewBox="'+(x0-W).toFixed(0)+' 0 '+(VBW-x0+W).toFixed(0)+' '+VBH.toFixed(0)+'" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'+o+'</svg>';
}
function dayLabel(t){return 'D+'+(Math.ceil(t/2)-1)+(t%2?' 白天':' 夜間');}
function newsScript(n){ // 語音稿：直接把快訊內容轉成適合聽的短句，跳過生硬數字（依介面語言產生）
  const a=n.a,b=n.b,c=costSummary(),left=S.T-n.t,L=window.TSL_LANG||'zh-TW',T=window.TSL_T||(x=>x),en=L==='en',ja=L==='ja',zh=!en&&!ja;
  const SEP=en?', ':'、',DOT=en?'. ':'。';
  const clean=x=>{const parts=T(x).split(/[，,、;；]\s*/).filter(q=>q&&!/\d/.test(q));return parts.join(en?', ':ja?'、':'，');}; // 含數字的片段捨去
  const news=n.items.map(clean).filter(Boolean).slice(0,2);
  const pt=Math.min(3,b.ports),ps=['','one','two','three'][pt],ds=b.ds,as=b.as;
  const ground=as===0?0:as>=ds?1:as>=ds*0.6?2:3; // 0 尚未站上 1 攻方占優 2 拉鋸 3 守方占上風
  const sea=a.navy-b.navy>0,air=b.plaAir<a.plaAir,ver=T(verdict(b.n).t),civ=c.civ.TW>=20000;
  const out=[];
  if(en){
    out.push('Turn '+n.t+' is over.');
    news.forEach(x=>out.push(x+'.'));
    out.push(b.taipei?'Taipei has fallen into attacker hands.':'Taipei is still held by the defenders.');
    out.push(pt?'The attacker has taken '+ps+' main port'+(pt>1?'s':'')+'.':'The attacker has not yet taken a main port.');
    out.push(['No attacking troops have established themselves on the island yet.','The attacker has the upper hand on the island.','The fighting on the island is a tug of war.','The defenders have the upper hand on the island.'][ground]);
    if(sea)out.push('The attacker lost more escort ships at sea.');
    if(civ)out.push('Civilian casualties in Taiwan keep rising.');
    out.push('If judged now, the result would be: '+ver+'.');
    if(left>0)out.push(left+(left>1?' turns':' turn')+' remain until judgment.');
    return out.join(' ');
  }
  if(ja){
    out.push('第'+n.t+'ターンが終わりました。');
    news.forEach(x=>out.push(x+'。'));
    out.push(b.taipei?'台北は攻撃側の手に落ちました。':'台北は引き続き防衛側が押さえています。');
    out.push(pt?'攻撃側は主要港を'+pt+'か所確保しています。':'攻撃側はまだ主要港を取れていません。');
    out.push(['島内にはまだ攻撃側の部隊が定着していません。','島内では攻撃側が優勢です。','島内は一進一退の攻防です。','島内では防衛側が優勢です。'][ground]);
    if(sea)out.push('海上では攻撃側の護衛艦にさらに損害が出ました。');
    if(civ)out.push('台湾の民間人の被害は広がり続けています。');
    out.push('いま判定すれば、結果は「'+ver+'」です。');
    if(left>0)out.push('判定まであと'+left+'ターンです。');
    return out.join('');
  }
  out.push('第 '+n.t+' 回合結束。');
  news.forEach(x=>out.push(x+'。'));
  out.push(b.taipei?'台北已落入攻方手中。':'台北仍由守方掌握。');
  out.push(pt?'攻方已拿下'+['','一','兩','三'][pt]+'座主要港口。':'攻方還沒拿下主要港口。');
  out.push(['攻方部隊還沒在島上站穩腳跟。','島上戰場，攻方占優勢。','島上雙方正在拉鋸。','島上戰場，守方占上風。'][ground]);
  if(sea)out.push('海上，攻方護航艦隊又有損失。');
  if(civ)out.push('台灣平民傷亡仍在增加。');
  out.push('若現在判定，結果會是「'+ver+'」。');
  if(left>0)out.push('距離判定還有 '+left+' 回合。');
  return out.join('');
}
function newsBody(n){
  const a=n.a,b=n.b,dlt=(v,p)=>v===p?'':'（'+(v>p?'+':'')+(Math.round((v-p)*10)/10)+'）',left=S.T-n.t;
  return '<div class="news"><div class="nbar"><span class="live">● 即時</span><span>海峽快訊</span><span>'+dayLabel(n.t)+' · 第 '+n.t+' 回合結束</span></div>'+newsArt(n.t)+
    '<h3>'+n.items[0]+'</h3><div class="dek">天候'+n.weather+'。距離判定還有 '+left+' 回合。</div><ul>'+
    '<li><b>地面</b>：攻方島上兵力約 '+ppl(menOnTW('atk'))+'、守方約 '+ppl(menOnTW('def'))+'；攻方控制港口 '+b.ports+' / '+PORTS.length+'，台北由'+(b.taipei?'攻方':'守方')+'控制。</li>'+
    '<li><b>海空</b>：攻方戰機 '+b.plaN+' 架'+dlt(b.plaN,a.plaN)+'、台灣戰機 '+b.twN+' 架'+dlt(b.twN,a.twN)+'（有效戰力 '+b.plaAir+' 對 '+b.ally+'）；攻方護航艦隊 '+b.navy+dlt(b.navy,a.navy)+'、火箭軍存量 '+fmt1(S.pools.rf)+'。</li>'+
    '<li><b>國際</b>：'+b.fx+'。</li>'+
    (()=>{const c=costSummary();return '<li><b>代價</b>：雙方軍人傷亡約 '+ppl(c.mil.atk.n+c.mil.def.n+c.mil.US.n+c.mil.JP.n)+'，台灣平民傷亡約 '+ppl(c.civ.TW)+'；全球股市累計 '+c.mkt.toFixed(1)+'%。</li>';})()+
    '<li><b>情勢</b>：若現在判定，攻方達成 '+b.n+' / 3 →「'+verdict(b.n).t+'」。</li></ul>'+
    (n.items.length>1?'<div class="ticker">其他消息：'+n.items.slice(1).join('　｜　')+'</div>':'')+'<div class="say" data-notr hidden>'+newsScript(n)+'</div></div>';
}
function showNews(n){
  return new Promise(done=>{
    const box=mboxSet('ev');
    box.innerHTML=newsBody(n)+'<div class="btns" style="margin-top:14px"><button id="nwGo">下一回合 ▶</button><button class="ghost" id="nwMap">看地圖</button></div>';
    $('#modal').hidden=false;$('#resume').hidden=true;
    if(VOICE.on)VOICE.speak(box.innerHTML,{flush:true});
    $('#nwMap').onclick=()=>{$('#modal').hidden=true;$('#resume').hidden=false;};
    $('#nwGo').onclick=()=>{$('#modal').hidden=true;$('#resume').hidden=true;box.classList.remove('ev');done();};
    simBar(box,()=>done());
    $('#nwGo').focus();
  });
}
function newsRecap(){
  if(!S.news.length)return '';
  return acc('每回合快訊回顧',S.news.length+' 則','<ul class="tl">'+S.news.map(n=>'<li><b>'+dayLabel(n.t)+'</b>　'+n.items.join('；')+'</li>').join('')+'</ul>',false);
}
