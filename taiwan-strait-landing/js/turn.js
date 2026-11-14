'use strict';
/* ---------- turn flow ---------- */
const ATK_REINF={2:[['amph','north'],['amph','central'],['arm'],['mar','north']],3:[['mar','central'],['amph','north'],['amph','central'],['arm']],4:[['amph','north'],['amph','central'],['arm'],['amph','north']],5:[['amph','north'],['amph','central'],['arm'],['amph','central']],6:[['amph','north'],['amph','central'],['mar','central'],['arm']],7:[['amph','north'],['amph','central'],['arm'],['amph','north']],8:[['amph','north'],['amph','central'],['amph','central']]};
const DEF_REINF={2:[SPOT.taipei,SPOT.taichung],3:[SPOT.taoyuan,SPOT.tainan],4:[SPOT.hsinchu,SPOT.kaohsiung]};
// 預排增援到第 8 回合為止；之後不會憑空生出新的旅（要更多兵力只能在戰前準備階段選擇擴大動員）
function placeNear(k,filter){
  const base=TER[k];
  const c=Object.values(TER).filter(h=>filter(h)&&!unitAt(h.k)).sort((a,b)=>hd(a,base)-hd(b,base));
  return c[0]||null;
}
// ---------- 浪高天候（風浪以顯著浪高 Hs 公尺為計算基準，顯示時附 WMO 海況等級）----------
// 各月平均浪高（公尺，推估）：東北季風期（10～3 月）偏高、5～6 月最低；颱風只在 6～11 月出現，持續數回合、浪高 5～8 公尺
const WAVEM={1:2.1,2:2.2,3:1.8,4:1.3,5:1.15,6:1.1,7:1.2,8:1.5,9:1.6,10:1.7,11:2.0,12:2.2};
const TYPH={6:.004,7:.009,8:.015,9:.015,10:.008,11:.003}; // 每回合颱風生成機率（推估；東北季風月份沒有颱風）
// ---------- 天氣分區與颱風路徑 ----------
// 四個海域：台灣海峽（主戰場，天候膠囊顯示的就是這裡）、北部海域、東部海域、巴士海峽。各海域浪高＝海峽基準浪高 × 季節係數（★推估）：
//  東北季風（10～4 月）：風浪在台灣西南海域對風速最敏感、東北海域最不敏感（EGU 2025：浪高與風速的 1.29／0.95／0.81 次方）→ 巴士海峽 ×1.15、北部 ×1.1、東部 ×0.95
//  西南季風與颱風季（5～9 月）：東部受太平洋湧浪 → 東部 ×1.1、巴士 ×1.1、北部 ×0.85
// 颱風是會移動的實體：自菲律賓海（地圖東南角）生成，往西北移動，到一定緯度後轉北、轉東北（轉向緯度隨機）；
//  強度依中央氣象署分級（近中心最大風速）：輕度／中度／強烈；7 級風暴風半徑 ★輕度 100～200 km、中度 200～300 km、強烈 250～350 km（氣象署：2026 年巴威颱風強烈、半徑 350 km）
//  移動速度 ★15～25 km/h（每回合 12 小時約 180～300 km；研究：近台灣東岸約 4 m/s，登陸前加速約 50%）；穿越台灣本島地形後減弱一級（研究：台灣地形使颱風減弱、減速、偏折）
//  浪高：暴風半徑邊緣＝7 級風的可能浪高 4 公尺（WMO 蒲福風級），往中心線性增加到 ★輕度 9、中度 12、強烈 14 公尺（蒲福 10、11～12、12 級的可能浪高）；半徑外到 2 倍半徑為湧浪，由 4 公尺遞減
const WXZ={W:'台灣海峽',N:'北部海域',E:'東部海域',S:'巴士海峽'},WXREF=[119.9,24.2];
const WXF={ne:{W:1,N:1.1,E:.95,S:1.15},sw:{W:1,N:.85,E:1.1,S:1.1}};
const wxSeason=()=>{const m=S.month||4;return m>=5&&m<=9?'sw':'ne';};
const wxZoneLL=(lon,lat)=>lat>=25.3?'N':lat<21.9?'S':lon>=121.3?'E':'W';
const wxZone=h=>{const [lon,lat]=rcToLL(h.c,h.r);return wxZoneLL(lon,lat);};
const TYC=[{n:'輕度',peak:9,R:[100,200]},{n:'中度',peak:12,R:[200,300]},{n:'強烈',peak:14,R:[250,350]}];
const kmLL=(a,b)=>{const dx=(a[0]-b[0])*111*Math.cos((a[1]+b[1])/2*Math.PI/180),dy=(a[1]-b[1])*111;return Math.hypot(dx,dy);};
function tyWaveLL(ty,ll){if(!ty)return 0;const d=kmLL([ty.lon,ty.lat],ll),R=ty.R,pk=TYC[ty.cls].peak;if(d<=R)return 4+(pk-4)*(1-d/R);if(d<2*R)return 4*(1-(d-R)/R);return 0;}
function wxWaveLL(ll,W){W=W||S.weather;if(!W)return 0;if(W.base==null)return W.wave||0;return Math.round(Math.max(W.base*WXF[wxSeason()][wxZoneLL(ll[0],ll[1])],tyWaveLL(W.ty,ll))*10)/10;}
function wxWave(h,W){return wxWaveLL(rcToLL(h.c,h.r),W);} // 某一格的浪高
const seaOfH=h=>h<=1.25?5:Math.max(1,5-Math.ceil((h-1.25)/.75)); // 浪高→海上移動格數（與天候相同的規則）
function tySpawn(){
  const r=Math.random(),cls=r<.45?0:r<.8?1:2,[r0,r1]=TYC[cls].R;
  return {lon:126.6+Math.random()*1.6,lat:19.8+Math.random()*1.6,hdg:300+Math.random()*15,spd:15+Math.random()*10,R:Math.round(r0+Math.random()*(r1-r0)),cls,recLat:22+Math.random()*5,age:0,tw:false,trail:[]};
}
function tyStep(t){ // 前進一個回合（12 小時）；回傳 false＝消散或離開地圖
  t.trail.push([t.lon,t.lat]);if(t.trail.length>8)t.trail.shift();t.age++;
  {let h=t.hdg>180?t.hdg-360:t.hdg;if(t.lat>=t.recLat)h=Math.min(45,h+35);h+=(Math.random()-.5)*20;t.hdg=(h+360)%360;} // 方位角（0＝北、270＝西）：到轉向緯度後每回合順時針轉 35°，西北→北→東北；另有 ±10° 的擺動
  const km=t.spd*12,a=t.hdg*Math.PI/180;
  t.lat+=km*Math.cos(a)/111;t.lon+=km*Math.sin(a)/(111*Math.cos(t.lat*Math.PI/180));
  const [c,r]=llToRC(t.lon,t.lat),h=TER[K(c,r)];
  if(h&&h.isl==='TW'&&isLand(h)&&!t.tw){t.tw=true;if(t.cls>0){t.cls--;t.R=Math.round(t.R*.9);}else return false;} // 穿越台灣本島：減弱一級
  if(h&&h.isl==='CN'&&isLand(h))return false; // 登陸大陸後消散
  if(t.age>14||t.lon<116||t.lon>130||t.lat<18||t.lat>27.5)return false;
  return true;
}
const ssOf=h=>h<=0?0:h<.1?1:h<.5?2:h<1.25?3:h<2.5?4:h<4?5:h<6?6:h<9?7:h<14?8:9; // WMO 海況代碼 0～9（以 0.1/0.5/1.25/2.5/4/6/9/14 公尺分界）
const SSN=['無浪','微浪','小浪','輕浪','中浪','大浪','巨浪','狂浪','狂濤','怒濤'];
function gauss(){let a=0,b=0;while(!a)a=Math.random();while(!b)b=Math.random();return Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*b);}
function mkWeather(h){
  h=Math.round(h*10)/10;const ss=ssOf(h);
  const sea=seaOfH(h);
  return {id:h>=2.5?'bad':h>=1.25?'fair':'good',n:'浪高 '+h.toFixed(1)+' 公尺（'+SSN[ss]+'，海況 '+ss+'）',sea,air:h<4,fire:h>=3.5?-2:h>=2.5?-1:0,wave:h,ss};
}
function nextWave(){ // 下一回合的天候：海峽基準浪高＝該月平均×對數常態起伏（相鄰回合相關 0.6）；颱風是移動的實體，浪高依與颱風中心的距離
  const m=S.mods,mo=S.month||4;
  if(m.wx&&m.wx[0]>=1){const w=mkWeather(.8);w.base=.8;w.ty=null;return w;}
  const z=.6*(S.waveZ||0)+.8*gauss();S.waveZ=z;const base=Math.min(4.5,WAVEM[mo]*Math.exp(.4*z-.08));
  if(S.typhoon&&S.typhoon.lon!=null){if(!tyStep(S.typhoon))S.typhoon=null;}
  else{S.typhoon=null;if((TYPH[mo]||0)>0&&Math.random()<TYPH[mo]){S.typhoon=tySpawn();S.typhoonNew=true;}}
  const ty=S.typhoon?JSON.parse(JSON.stringify(S.typhoon)):null,w=mkWeather(wxWaveLL(WXREF,{base,ty}));w.base=base;w.ty=ty;return w;
}
// 颱風對海峽的威脅：中心距海峽（含登陸海域）在 2 倍暴風半徑＋一天的移動距離內
const tyThreat=W=>!!(W&&W.ty&&kmLL([W.ty.lon,W.ty.lat],WXREF)<2*W.ty.R+W.ty.spd*24);
function rollWeather(){ // 取得這一回合的天候，並預先產生下一回合（供預報）
  let w=S.nextW||nextWave();S.nextW=nextWave();
  if(S.turn===1&&!S.dDelay&&S.mods.wxT1!=='bad'){ // 颱風逼近時，攻方延後 D 日（選「颱風季強渡」的賭注除外）；以 12 小時為單位，最多 5 天
    let n=0;while(n<10&&(tyThreat(w)||tyThreat(S.nextW))){w=S.nextW;S.nextW=nextWave();n++;}
    S.dDelay=n||-1;if(n){log('颱風逼近台灣海峽：攻方將 D 日延後 '+(n*12)+' 小時，等颱風遠離後才發起');if(!REC.quiet)toast('颱風逼近：D 日延後 '+(n*12)+' 小時',4200);}
  }
  if(S.turn===1&&S.mods.wxT1==='good'&&w.wave>1){const b=w;w=mkWeather(Math.min(b.wave,1));w.base=Math.min(b.base==null?1:b.base,1);w.ty=b.ty;}
  const nh=S.nextW.wave,err=(S.typhoon||S.typhoonNew)?.6:.3;S.fcH=Math.max(.2,Math.round((nh+gauss()*err)*10)/10);S.fcTyphoon=!!S.typhoonNew;S.typhoonNew=false;
  return w;
}
// 風浪對海上船艇的損耗：登陸艦、運兵船、補給船團 2.5 公尺起算（係數 .5）；護航艦、航艦 5 公尺起算（係數 .3）；港內與水下不受影響。期望損失以零頭累積實現
function dockOK(u,n){ // 船艇靠港：潛艦與守方艦艇回守方港口；攻方船艇與登陸部隊回大陸港口或自己掌握的港口
  if(n.t!=='port'||unitsAt(n.k).length>=STACK_MAX+1||!unitsAt(n.k).every(z=>z.side===u.side))return false;
  if(u.type==='hk'||u.type==='ff')return n.isl==='TW'&&S.owner[n.k]==='def';
  if(u.side==='atk'&&(isShip(u)||u.type==='amph'||u.type==='mar'||u.type==='arm'))return n.isl==='CN'||S.owner[n.k]==='atk';
  return false;
}
// 避風令：海上船艇朝最近的己方港口前進；進港者不受風浪損耗，沒趕到的下回合損耗減半
function shelterOrder(side){
  const own=Object.values(TER).filter(h=>h.t==='port'&&(side==='atk'?(h.isl==='CN'||S.owner[h.k]==='atk'):(h.isl==='TW'&&S.owner[h.k]==='def')));
  if(!own.length)return 0;
  const dp=h=>Math.min.apply(null,own.map(q=>hd(h,q)));let moved=0,n=0;
  for(const u of S.units.filter(x=>x.side===side&&atSea(x)&&x.type!=='hk'&&x.type!=='fob'&&(isShip(x)||x.type==='amph'||x.type==='mar'||x.type==='arm')&&shelterAt(x))){
    n++;u.shelterT=S.turn;if(u.moved||u.acted)continue;
    const rc=reach(u);let b=null,bs=dp(hexOf(u));
    for(const [k,v] of rc){if(v.kind!=='sail'&&v.kind!=='move')continue;const sc=dp(TER[k]);if(sc<bs){bs=sc;b=k;}}
    if(b){doMove(u,b,'sail');moved++;}
  }
  if(n){const ty=S.nextW&&S.nextW.ty;log('【避風令】'+SIDE[side]+'海上船艇 '+n+' 個朝最近港口避風（'+moved+' 個移動；'+(ty?'下回合'+TYC[ty.cls].n+'颱風的預測位置會影響所在海域':'預報下回合所在海域浪高達 2.2 公尺以上')+'）');render();}
  return n;
}
// 預報：下一回合某一格的浪高（海峽預報的誤差比例套用到各海域）
function fcWave(h){const N=S.nextW;if(!N)return 0;const v=wxWave(h,N);return N.wave>0&&S.fcH!=null?v*S.fcH/N.wave:v;}
const shelterAt=u=>atSea(u)&&fcWave(hexOf(u))>=2.2;
function shelterNeeded(side){if(!S.started||S.over||!S.nextW)return false;return S.units.some(u=>(!side||u.side===side)&&u.type!=='hk'&&u.type!=='fob'&&(isShip(u)||u.type==='amph'||u.type==='mar'||u.type==='arm')&&shelterAt(u));} // 只有預報會受影響的海域才需要避風（颱風看預測路徑）
function waveAttrition(){ // 依每艘船所在海域的浪高
  let n=0,hx=0;const grp=u=>u.type==='dd'||u.type==='cv'?[5,.3]:(u.type==='ff'||u.type==='cvy'||u.type==='amph'||u.type==='mar'||u.type==='arm')?[2.5,.5]:null;
  for(const u of S.units.slice()){
    if(!atSea(u)||u.type==='hk'||u.type==='fob')continue;const g=grp(u),h=wxWave(hexOf(u));if(!g||h<=g[0])continue;hx=Math.max(hx,h);
    const sheltered=u.shelterT===S.turn-1?.5:1,ev=g[1]*(h-g[0])/3.5*sheltered;
    if(takeInt(ev,'wave:'+u.side+u.type)>=1){damage(u,1,'風浪');n++;}
  }
  if(n){log('風浪（最大浪高 '+hx.toFixed(1)+' 公尺）造成 '+n+' 艘次船艇損耗');if(!REC.quiet)toast('風浪造成船艇損耗 '+n+' 艘次');}
}


/* ---------- 港口破壞評估（守方） ---------- */
function portNearlyLost(k){
  if(S.owner[k]!=='def'||S.portDown[k]||S.portAsked[k])return false;
  const h=TER[k],gar=unitsAt(k).filter(u=>u.side==='def'&&!isShip(u)).reduce((a,u)=>a+u.hp,0);
  if(gar>1)return false;
  return ring2(h).some(n=>unitsAt(n.k).some(u=>u.side==='atk'&&!isShip(u)&&isLand(n)));
}
function portOptions(k){
  const nm=TER[k].name||'港口',gar=unitsAt(k).filter(u=>u.side==='def'&&!isShip(u)).reduce((a,u)=>a+u.hp,0);
  return {title:'港口破壞評估（守方）',blurb:nm+'守軍只剩'+stpN(gar)+'，攻方地面部隊已逼近，港口即將失守。是否在失守前破壞港口設施？（★為系統建議）',
    opts:[
    {id:'demolish',label:'破壞港口設施',desc:'炸毀碼頭、吊車與航道：攻方即使占領也無法使用，重型旅無法從該港上岸、補給容量只剩 +1，也不計入攻方「控制港口」；攻方占領並整修 2 個回合後才恢復。',est:'拖慢攻方、可能保住「主要港口」這項條件',rec:true},
    {id:'keep',label:'保留港口',desc:'設施完整保留；失守後攻方立即取得完整的港口功能。',est:'攻方奪港後馬上能卸載重型旅、補給容量 +4',rec:false},
    {id:"x_raze",x:1,label:"🔥 連市區設施一併炸毀",desc:"港口連同市區設施炸毀，攻方至少 4 個回合無法使用；平民傷亡與經濟損失增加。",est:'攻方約 4 回合無法用港，但民生代價大',rec:false}]};
}
function applyPort(k,o){
  const h=TER[k],rec={turn:S.turn,phase:S.phase,title:'港口破壞評估（'+(h.name||'港口')+'）',id:'port_'+k,choice:o.label,who:'def',rolls:[],effects:[]};
  S.portAsked[k]=true;log('【'+rec.title+'】守方選擇「'+o.label+'」');
  if(o.id==='demolish'){S.portDown[k]=S.turn;rec.effects.push((h.name||'港口')+'設施遭破壞：無法卸載重型旅、補給容量 +1、不計入控制港口，攻方整修需 2 個回合');fxq({t:'txt',at:[h.c,h.r],s:'破壞',col:'def'});}
  if(o.id==='x_raze'){S.portDown[k]=S.turn+2;S.cost.civ.TW+=500;S.cost.dmg.TW+=2;rec.effects.push(...["設施連同市區遭炸毀：攻方至少 4 個回合無法使用，平民傷亡與經濟損失增加"]);fxq({t:'txt',at:[h.c,h.r],s:'炸毀',col:'def'});}
  rec.snap=snap();S.events.push(rec);
}
async function portEval(){
  if(S.over)return;
  for(const k of PORTS){
    if(!portNearlyLost(k))continue;
    const info=portOptions(k),manual=(S.sim&&!S.simAuto)||(!S.video&&S.ctrl.def==='human');let o;
    if(manual)o=await askTruce(info,()=>Math.random()<.8?info.opts[0]:info.opts[1]);
    else{o=Math.random()<.8?info.opts[0]:info.opts[1];if(!(S.rec&&REC.quiet))toast((TER[k].name||'港口')+'：'+o.label);}
    applyPort(k,o);
  }
}
function repairPorts(){
  for(const k of Object.keys(S.portDown))if(S.owner[k]==='atk'&&S.turn>=S.portDown[k]+2){delete S.portDown[k];log('攻方整修完成：'+(TER[k].name||'港口')+'恢復運作');}
}
/* ---------- 停戰／放棄評估 ---------- */
const clamp01=v=>Math.max(0,Math.min(100,Math.round(v)));
function atkOutlook(){ // 攻方勝算的粗略估計（0～100）
  const a=snap();
  let s=35+16*a.ports+(a.taipei?18:0)+(a.as-a.ds)*1.5;
  if(a.as===0)s-=10;
  s+=(S.pools.plaNavy>=5?3:-3)+(S.pools.plaCV>0?2:0);
  if(S.fx.lv.US>=3)s-=8;
  return clamp01(s);
}
function defOutlook(){ // 守方撐住的粗略估計（0～100）
  const a=snap();
  let s=70-16*a.ports-(a.taipei?22:0)+(a.ds-a.as)*1.5;
  const us=usIdx();s+=us>=2?12:us===1?4:-8;
  s-=Math.min(25,S.cost.civ.TW/1200);
  return clamp01(s);
}
function needTruce(side){
  const a=snap(),civ=S.cost.civ.TW;
  if(S.turn>=S.T)return false;
  if(side==='atk')return S.turn>=Math.max(6,Math.ceil(S.T*.7))&&a.ports===0&&!a.taipei&&a.as<=Math.max(2,a.ds/4); // 攻勢要拖到後段才會評估停戰
  const lost=usIdx()<=0||S.us.drop>0,low=civ>=15000;
  return S.turn>=3&&(lost||low)&&(((a.taipei||a.ports>=2)&&(a.ds<=10||civ>=15000))||a.ds<=4);
}
function truceVerdict(kind){
  const n=conditions(true).filter(c=>c.atk).length;
  if(kind==='surrender')return {s:'atk',t:'守方投降',d:'守方放棄抵抗並交出台北，攻方取得首都；戰事結束，平民傷亡與破壞不再擴大。'};
  if(kind==='retreat')return {s:'def',t:'攻方撤退',d:'攻方在攻勢受挫後有限撤退、保存實力；登陸未能達成目標，守方守住台灣。'};
  const lab={truce:'停戰',talks:'談判停火',mediated:'國際斡旋停火'}[kind]||'停火';
  if(n>=2)return {s:'atk',t:lab+'：攻方保有戰果',d:'雙方依現況停火；攻方達成 '+n+' 項條件，實質控制了關鍵位置，守方被迫在不利條件下接受。'};
  if(n===1)return {s:'draw',t:lab+'：僵局',d:'雙方停火，攻方只達成 1 項條件，既沒有站穩也沒有撤出；實質上陷入僵局，後續取決於談判。'};
  return {s:'def',t:lab+'：守方守住',d:'雙方停火時攻方沒有達成任何條件，守方守住主權與主要城市。'};
}
function truceOptions(side){
  const ol=atkOutlook(),dl=defOutlook();
  if(side==='atk'){
    const tv=truceVerdict('truce');
    const rec=ol<12?'truce':'escalate';
    return {title:'停戰評估（攻方）',blurb:'攻勢遲遲沒有進展：沒有港口與台北、島上兵力遠遜守方。指揮部評估目前勝算約 '+ol+'%，請選擇下一步（★為系統建議的最優解）。',
      opts:[
      {id:'truce',label:'接受現況停戰',desc:'雙方停火，依目前控制的位置判定。',est:'結果：'+tv.t+'；成本與傷亡不再擴大',rec:rec==='truce'},
      {id:'retreat',label:'有限撤退、保存實力',desc:'撤回島上與海上兵力，不再擴大損失與國際壓力。',est:'結果：守方勝利；攻方損失止血',rec:false},
      {id:'escalate',label:'提高賭注（升級）',desc:'擴大戰事：本回合火力 +3（消耗火箭軍存量 −2），美日參戰程度各 +1（若情境允許）。',est:'短期勝算約 '+clamp01(ol+12)+'%；但美日更快介入，全球股市再受衝擊',rec:false},
      {id:"x_total",x:1,label:"🔥 全面升級、戰時體制",desc:"本回合火力 +3（消耗火箭軍存量 −3），美日參戰程度各 +1；攻方本回合與下回合防禦 −1，平民傷亡 +30%、股市 −4。",ref:"2019〈告台灣同胞書〉",est:'短期戰力大增，但雙方平民與經濟代價急升',rec:false}]};
  }
  const tv=truceVerdict('talks');
  const rec=conditions().filter(c=>c.atk).length>=3?(dl<12?'surrender':'resist'):(dl<12&&!S.mods.noTalks?'talks':'resist');
  const n3=conditions().filter(c=>c.atk).length; // 攻方已達成幾項勝利條件
  const defOpts=o=>{let r=S.mods.noTalks?o.filter(x=>!x.talk):o;
    if(n3>=3)r=r.filter(x=>['surrender','resist'].includes(x.id)); // 三項全部達成：守方只剩投降或繼續抵抗
    else if(n3>=2)r=r.filter(x=>x.id!=='seek'); // 國際斡旋留給「還差一點、拖太久」的局面
    return r;};
  return {title:'放棄評估（守方）',blurb:'守軍傷亡慘重，外援與民意都在流失。政府評估目前撐住的機會約 '+dl+'%，請選擇下一步（★為系統建議的最優解）。',
    opts:defOpts([
    {id:'talks',talk:true,label:'停火談判（接受部分條件）',desc:'以現況停火，保住政府與大部分領土，但接受部分條件與主權讓步。',est:'結果：'+tv.t+'；平民傷亡不再擴大',rec:rec==='talks'},
    {id:'surrender',label:'投降／交出台北',desc:'放棄抵抗，攻方立即取得首都。',est:'結果：守方投降；戰事結束',rec:rec==='surrender'},
    {id:'resist',label:'繼續抵抗',desc:'拒絕放棄，繼續作戰；軍民損失持續累積。',est:'撐住機率約 '+dl+'%',rec:rec==='resist'},
    {id:'seek',label:'尋求外援／國際斡旋',desc:'擲骰：5～6 國際斡旋成功、強制停火；3～4 美日提高介入；1～2 沒有回應、民心再受打擊。',est:'外部因素不可控',rec:false,talk:true}])};
}
function askTruce(info,autoPick){
  return new Promise(done=>{
    const box=mboxSet('ev');$('#modal').hidden=false;$('#resume').hidden=true;
    box.innerHTML='<div class="eyebrow">第 '+S.turn+' 回合 · '+SIDE[S.phase]+'階段前</div><h3>'+info.title+'</h3><p>'+info.blurb+'</p>'+
      '<div class="opts">'+info.opts.map((o,j)=>'<button class="opt" data-j="'+j+'"><b>'+(o.rec?'★ ':'')+o.label+'</b><span>'+o.desc+(o.ref?'<small class="ref">參考：'+o.ref+'</small>':'')+'<br>預估：'+o.est+'</span></button>').join('')+'</div>';
    box.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{const o=info.opts[+b.dataset.j];$('#modal').hidden=true;box.classList.remove('ev');done(o);});
    if(autoPick)simBar(box,()=>done(autoPick()));
    box.querySelector('.opt').focus();
  });
}
function truceAuto(side,info){
  const ol=atkOutlook(),dl=defOutlook();let w;
  if(side==='atk')w=ol<12?[['truce',22],['retreat',9],['escalate',42]]:[['truce',9],['retreat',4],['escalate',74]];
  else{const bad=S.owner[TAIPEI]==='atk'&&PORTS.filter(k=>S.owner[k]==='atk').length>=2;w=bad?[['talks',50],['surrender',15],['resist',25],['seek',10]]:[['talks',25],['surrender',5],['resist',50],['seek',20]];}
  if(side==='def'&&conditions().filter(c=>c.atk).length>=3)w=[['surrender',60],['resist',40]];
  // 停火只在條件真的不利時才請求：守方電腦要等攻方已達成 2 項以上條件才會求和／求外援；攻方電腦只在攻勢停滯（勝算 <12%）時才請和
  const n3=conditions().filter(c=>c.atk).length,noAsk=side==='def'?n3<2:ol>=12;
  w=w.filter(([id])=>info.opts.some(o=>o.id===id)&&!(noAsk&&['truce','talks','seek'].includes(id)));
  if(!w.length)return info.opts.find(o=>o.id==='resist'||o.id==='escalate')||info.opts[0];
  const id=wpick(w);return info.opts.find(o=>o.id===id)||info.opts[0];
}
function applyTruce(side,o){
  const eff=[];
  const rec={turn:S.turn,phase:S.phase,title:side==='atk'?'停戰評估（攻方）':'放棄評估（守方）',id:'truce_'+side,choice:o.label,who:side,rolls:[],effects:eff};
  log('【'+rec.title+'】'+SIDE[side]+'選擇「'+o.label+'」');
  const m=S.mods,t=S.turn;let end=null;
  if(o.id==='truce'||o.id==='talks')end=truceVerdict(o.id);
  else if(o.id==='retreat'||o.id==='surrender')end=truceVerdict(o.id);
  else if(o.id==='escalate'){
    addTurns(m.fireAdd,t,t,3);pAdd('rf',-2);setLevel('JP',Math.min(2,S.fx.lv.JP+1),'攻方升級');setLevel('US',Math.min(3,S.fx.lv.US+1),'攻方升級');
    S.cost.mkt=Math.max(-35,S.cost.mkt-2);eff.push('本回合火力 +3（消耗火箭軍存量 −2）','美日參戰程度升高（若情境允許）');
  }
  else if(o.id==='x_total'){
    const F=["本回合火力 +3（消耗火箭軍存量 −3）", "美日參戰程度升高（若情境允許）", "攻方本回合與下回合防禦 −1", "平民傷亡 +30%、全球股市 −4"];addTurns(m.fireAdd,t,t,3);pAdd('rf',-3);
    setLevel('JP',Math.min(2,S.fx.lv.JP+1),'攻方升級');setLevel('US',Math.min(3,S.fx.lv.US+1),'攻方升級');
    addTurns(m.atkDef,t,t+1,-1);m.civMul*=1.3;hitMkt(4);eff.push(...F);
  }
  else if(o.id==='resist'){eff.push('守方繼續作戰');}
  else if(o.id==='seek'){
    const med=hitP(1/3,'seekMed'),part=!med&&hitP(1/2,'seekPart'); // 原本擲骰 5–6／3–4／1–2 各 1/3
    eff.push('國際斡旋機率 33%、提高介入 33%（固定規則）');
    if(med){end=truceVerdict('mediated');}
    else if(part){setLevel('US',Math.min(3,S.fx.lv.US+1),'尋求外援');setLevel('JP',Math.min(2,S.fx.lv.JP+1),'尋求外援');eff.push('美日提高介入程度（若情境允許）');}
    else{eff.push('沒有得到回應，沒有任何實際效果');}
  }
  rec.snap=snap();S.events.push(rec);
  S.stats.truce=(S.stats.truce||[]);S.stats.truce.push(side+':'+o.id);
  if(end&&!S.over)endGame(end.d,end.s,end.t);
}
// 請和是單方面的：對方不一定接受。對方是玩家時跳出選項；是電腦時依局勢擲骰（攻方請和：守方多半樂意；守方求和：攻方佔優時多半拒絕）
async function truceAccept(req){
  const opp=req==='atk'?'def':'atk',n=conditions().filter(c=>c.atk).length;
  let p;if(req==='atk')p=n===0?.85:.6;else p=n>=3?.15:n===2?.45:.7;
  if(req==='def'&&atkOutlook()<12)p+=.2;p=Math.min(.95,p);
  const manual=(S.sim&&!S.simAuto)||(!S.video&&S.ctrl[opp]==='human');
  if(!manual)return hitP(p,'truceAccept');
  const tv=truceVerdict(req==='atk'?'truce':'talks');
  const info={title:'對方請求停火',blurb:SIDE[req]+'提出依目前局勢停火。接受則戰事結束，拒絕則繼續作戰。',opts:[
    {id:'yes',label:'接受停火',desc:'依目前控制的位置判定，戰事結束。',est:'結果：'+tv.t,rec:false},
    {id:'no',label:'拒絕，繼續作戰',desc:'不接受對方的條件，戰事繼續。',est:'對方仍可能再次請求',rec:false}]};
  const o=await askTruce(info,()=>hitP(p,'truceAccept')?info.opts[0]:info.opts[1]);
  return o.id==='yes';
}
async function truceEval(side){
  if(S.over)return;
  const T=S.truce[side];
  if(T.n>=2||S.turn-T.t<2||!needTruce(side))return;
  T.n++;T.t=S.turn;
  const info=truceOptions(side);
  const manual=(S.sim&&!S.simAuto)||(!S.video&&S.ctrl[side]==='human');
  let o;
  if(manual){o=await askTruce(info,()=>truceAuto(side,info));}
  else{o=truceAuto(side,info);if(!(S.rec&&REC.quiet))toast(info.title+'：'+o.label);
    if(S.rec&&!REC.quiet)recordFrame({html:'<div class="eyebrow">第 '+S.turn+' 回合</div><h3>'+info.title+'</h3><p>'+info.blurb+'</p><p><span class="badge '+side+'">'+SIDE[side]+'決策</span>選擇「'+o.label+'」</p><p class="dd">'+o.desc+'<br>預估：'+o.est+'</p>',kind:'event',dur:7000});}
  if(o.id==='truce'||o.id==='talks'){
    const ok=await truceAccept(side);
    if(S.over)return;
    if(!ok){log('【停火請求】'+SIDE[side]+'請求停火，'+SIDE[side==='atk'?'def':'atk']+'拒絕，戰事繼續');if(!(S.rec&&REC.quiet))toast(SIDE[side==='atk'?'def':'atk']+'拒絕停火，戰事繼續');S.stats.truceRej=(S.stats.truceRej||0)+1;return;}
  }
  applyTruce(side,o);
}
// ---------- 美軍航艦打擊群棋子（第 1 階段）：參戰抵達後出現在台灣東側外海，由電腦自動操作 ----------
// 生命值以場外的 csg（S.fx.units）為準；棋子被打中時同步扣減。
const USC_HOME=[128.4,23.6]; // 預設進場位置：台灣東方約 700 km 的菲律賓海，在共軍艦射鷹擊-18（540 km）射程外、艦載機打擊距離內（推估）
// ---------- 海自護衛隊群（地圖棋子）：出雲級＋神盾艦 2＋通用護衛艦 1，由電腦操作，掩護先島群島 ----------
const JMS_HOME=[124.3,24.0],JMS_ENTRY=[128.3,25.9]; // ★掩護位置：石垣島南方；進場點：沖繩東南方（自佐世保南下，先在共軍艦射飛彈射程外）
const jmsPieces=()=>S.units.filter(u=>u.ally==='JP'&&(u.type==='ddh'||isEsc(u))&&alive(u));
const jmsLead=()=>S.units.find(u=>u.ally==='JP'&&u.type==='ddh'&&alive(u));
function jmsSync(){
  const f=S.fx&&S.fx.units.find(x=>x.id==='jmsdf');if(!f)return;const on=f.hp>0&&fxActive(f),ps=jmsPieces();
  if(!on){if(ps.length&&f.hp>0){S.units=S.units.filter(x=>!ps.includes(x));log('海自護衛隊群撤離戰區');}return;}
  if(!S.jmsOn){
    const [c,r]=llToRC(JMS_ENTRY[0],JMS_ENTRY[1]),k0=TER[K(c,r)]?K(c,r):null;
    const h=k0&&TER[k0].t==='sea'&&!unitAt(k0)?TER[k0]:placeNear(k0||Object.keys(TER).find(k=>TER[k].t==='sea'),x=>x.t==='sea');if(!h)return;
    const u=mkUnit('def','ddh',h.k,{});u.ally='JP';u.prev=null;u.mag={ad:SHIPW.ddh.ad,asm:0,lam:0};S.units.push(u);spawnEscorts(u,['jdg','jdg','jdd'],'def','JP');
    S.jmsOn=true;log('海自護衛隊群自沖繩東南方進入戰區（出雲級、神盾艦 2、通用護衛艦 1；地圖棋子，由電腦操作）');return;
  }
  if(!ps.length){if(f.hp>0){f.hp=0;log('海自護衛隊群全數被擊沉');bigNews('海自護衛隊群覆沒','日本海上自衛隊的護衛隊群在先島群島海域全數被擊沉，日本國內震動。');}return;}
  const tot=ps.reduce((a,u)=>a+u.hp,0),mx=ps.length?4*2:1;f.hp=Math.max(1,Math.min(f.max||2,Math.round((f.max||2)*tot/mx)));
}
async function jmsMove(){
  const u=jmsLead();if(!u||u.moved)return;u.prev=[u.c,u.r];
  const [hc,hr]=llToRC(JMS_HOME[0],JMS_HOME[1]),home=TER[K(hc,hr)]||hexOf(u),foe=S.units.filter(e=>e.side==='atk'&&atSea(e)&&isEsc(e)&&e.mag&&e.mag.asm>0);
  const sc=k=>{const h=TER[k];return foe.reduce((a,e)=>a+Math.max(0,SHIPW[e.type].asmR+2-hd(h,hexOf(e))),0)*3+Math.max(0,hd(h,home)-3)*.15;}; // 與美航艦相同：先待在共軍艦射飛彈射程外，沒有威脅時才往先島群島靠攏掩護
  let best=null,bs=sc(K(u.c,u.r))-.3;for(const [k,v] of reach(u)){if(v.kind!=='sail')continue;const t=sc(k);if(t<bs){bs=t;best=k;}}
  if(best){doMove(u,best,'sail');render();await sleep(200);}
}
// ---------- 美軍攻擊潛艦與先島群島的陸上部隊（第 3 階段 PR3）----------
// 攻擊潛艦（維吉尼亞級）：★魚雷 12 枚（每次 2 枚）、魚叉 4 枚、戰斧 12 枚；每支航艦打擊群隨行 1 艘（在航艦 ±3 格內）、另有 1 艘獨立在台灣東南外海
// 陸戰隊濱海團：NMESIS 4 輛×2 枚＝★8 枚，射程 185 km＝9 格，每回合每輛最多發射 1 枚；陸軍多域特遣隊：堤豐 2 輛（戰斧 ★4、標準六型 ★6／12 格）
// 2028 年起部署在先島群島的日本陸地格；之前仍是抽象單位
const SSN_ARM={tp:12,hm:4,lam:12},SSN_PATROL=[124.6,22.6],NME={asm:8,R:9},MDT={lam:4,asm:6,R:12};
const landPiecesOn=()=>(+S.era||2026)>=2028;
const ssnIndep=()=>S.units.find(u=>u.type==='ssn'&&!u.grp&&alive(u));
const nmePiece=()=>S.units.find(u=>u.type==='nme'&&alive(u)),mdtPiece=()=>S.units.find(u=>u.type==='mdt'&&alive(u));
function seaNear(lon,lat,rad){const [c,r]=llToRC(lon,lat),k0=TER[K(c,r)]?K(c,r):null;return k0&&TER[k0].t==='sea'&&!unitAt(k0)?TER[k0]:placeNear(k0||Object.keys(TER).find(k=>TER[k].t==='sea'),x=>x.t==='sea'&&!unitAt(x.k));}
function spawnSsn(grp,near){
  const h=near?placeNear(K(near.c,near.r),x=>x.t==='sea'&&hd(x,hexOf(near))<=3&&!unitAt(x.k)):seaNear(SSN_PATROL[0],SSN_PATROL[1]);if(!h)return null;
  const u=mkUnit('def','ssn',h.k,{});u.ally='US';u.hp=2;u.tp=SSN_ARM.tp;u.hm=SSN_ARM.hm;u.mag={ad:0,asm:0,lam:SSN_ARM.lam};if(grp)u.grp=grp;S.units.push(u);return u;
}
function ssnSync(){
  const f=S.fx&&S.fx.units.find(x=>x.id==='ssn');if(!f)return;const on=f.hp>0&&fxActive(f),u=ssnIndep();
  if(on&&!u){const n=spawnSsn(null,null);if(n)log('美軍攻擊潛艦進入台灣東南外海（隱蔽，地圖棋子由電腦操作）');}
  else if(!on&&u)S.units=S.units.filter(x=>x!==u);
}
const JPNAME={nme:'與那國',mdt:'石垣'};
function landSync(){
  if(!S.fx||!landPiecesOn())return;
  for(const [fid,type,get] of [['usmc','nme',nmePiece],['mdtf','mdt',mdtPiece]]){
    const f=S.fx.units.find(x=>x.id===fid);if(!f)continue;const on=f.hp>0&&fxActive(f),u=get();
    if(!on){if(u)S.units=S.units.filter(x=>x!==u);continue;}
    if(!u){const h=Object.values(TER).find(x=>x.isl==='JP'&&x.name===JPNAME[type]&&!unitAt(x.k))||Object.values(TER).find(x=>x.isl==='JP'&&x.t!=='sea'&&!unitAt(x.k));if(!h)continue;
      const n=mkUnit('def',type,h.k,{});n.ally='US';n.hp=f.hp;n.mag=type==='nme'?{ad:0,asm:NME.asm,lam:0}:{ad:0,asm:MDT.asm,lam:MDT.lam};S.units.push(n);log(TYPES[type].n+'部署在 '+hname(h)+'（日本領土；地圖棋子）');}
    else u.hp=f.hp; // 基地打擊扣的是抽象單位的步數：同步到棋子
  }
}
// 單次齊射（陸基或潛艦）：n 枚打 t；有艦隊防空走齊射模型
function pieceSalvo(m,t,n,wn,key){
  n=Math.min(n,m.mag.asm);if(n<=0)return false;m.mag.asm-=n;m.revealed=true;
  const r=salvoCalc(t,n,false,key+'>'+t.type),big=t.type==='cv'||t.type==='csg',steps=big?takeInt(r.hits/2,'salvoBig'):r.hits;
  fxq({t:'msl',from:[m.c,m.r],to:[t.c,t.r],hit:r.hits>0});
  log(uname(m)+'以 '+n+' 枚'+wn+'攻擊 '+uname(t)+'：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+(steps?'，'+tname(t)+' −'+(t.fl?steps+' 艘':stpU(t,steps)):'，未造成重創')+'（齊射模型，參數為推估）');
  if(steps)damage(t,steps,TYPES[m.type].n+wn);checkInstant();return true;
}
function shipFoes(u,R){return S.units.filter(e=>e.side==='atk'&&atSea(e)&&isShip(e)&&e.type!=='hk'&&e.type!=='fob'&&rd(hexOf(u),hexOf(e))<=R);}
function nmeFire(t0){const m=nmePiece();if(!m||m.acted||m.mag.asm<=0)return;const ts=shipFoes(m,NME.R);if(!ts.length)return;m.acted=true;pieceSalvo(m,t0&&ts.includes(t0)?t0:pickBest(ts,escVal),Math.min(m.mag.asm,2*m.hp),'海軍打擊飛彈（NMESIS）','nme');}
function mdtFire(t0){const m=mdtPiece();if(!m||m.acted||m.mag.asm<=0)return;const ts=shipFoes(m,MDT.R);if(!ts.length)return;m.acted=true;pieceSalvo(m,t0&&ts.includes(t0)?t0:pickBest(ts,escVal),Math.min(m.mag.asm,m.hp),'標準六型飛彈','mdt');}
// 美軍攻擊潛艦：每回合移動後，射程內有艦艇就開火（3 格內優先魚雷；6 格內魚叉）
function ssnFire(u,tgt){
  if(u.acted)return false;const ts=shipFoes(u,6);if(!ts.length)return false;
  const t=tgt&&ts.includes(tgt)?tgt:pickBest(ts,escVal),d=rd(hexOf(u),hexOf(t)),w=(u.tp>0&&d<=3)?'tp':(u.hm>0?'hm':null);if(!w)return false;
  if(w==='tp')u.tp=Math.max(0,u.tp-2);else u.hm--;u.revealed=true;u.acted=true;u.last={c:u.c,r:u.r,turn:S.turn};
  const nm=w==='hm'?'魚叉飛彈':'重型魚雷',sv=w==='hm'&&adCover(t).length?salvoCalc(t,1,false,'ssnSalvo>'+t.type):null;
  const hit=sv?sv.hits>0:hitP(w==='hm'?Math.max(.1,hkP(t)-.12):hkP(t),'ssn:'+w+'>'+t.type),big=t.type==='cv'||t.type==='csg',steps=!hit?0:sv&&big?takeInt(.5,'salvoBig'):1;
  log('美軍攻擊潛艦以'+nm+'攻擊 '+uname(t)+(sv?'：對方防空發射 '+sv.I+' 枚攔截彈，':'')+(hit?'命中'+(steps?'':'（航艦體積大，未造成重創）'):'未命中')+'（魚雷 '+u.tp+'、魚叉 '+u.hm+'、戰斧 '+u.mag.lam+' 枚；參數為推估）');
  fxq({t:'sub',from:[u.c,u.r],to:[t.c,t.r],hit,w});
  if(hit&&steps)damage(t,steps,'美軍攻擊潛艦'+nm);
  const dd=S.units.filter(e=>e.side==='atk'&&(e.type==='dd'||isEsc(e))&&alive(e)&&rd(hexOf(u),hexOf(e))<=4).length,pa=Math.min(.65,(.1+.12*dd)*hkE()[1]*(w==='hm'?.5:1));
  if(hitP(pa,'ssn:'+w+'>'+t.type)){log('美軍攻擊潛艦被反潛兵力發現並攻擊');damage(u,1,'反潛攻擊');}
  return true;
}
async function ssnMove(u){
  if(!alive(u))return;const car=u.grp?S.units.find(x=>x.id===u.grp&&alive(x)):null;
  const [pc,pr]=llToRC(SSN_PATROL[0],SSN_PATROL[1]),home=car?hexOf(car):(TER[K(pc,pr)]||hexOf(u));
  const thr=S.units.filter(e=>e.side==='atk'&&isEsc(e)&&e.mag&&e.mag.asm>0);
  const sc=k=>{const h=TER[k];return Math.abs(hd(h,home)-(car?2:0))*1.0+thr.reduce((a,e)=>a+Math.max(0,3-hd(h,hexOf(e))),0)*2;}; // 跟著航艦（或在巡邏點）、避開護航艦的反潛範圍
  let best=null,bs=sc(K(u.c,u.r))-.3;for(const [k,v] of reach(u)){if(v.kind!=='sail')continue;const t=sc(k);if(t<bs){bs=t;best=k;}}
  if(best){doMove(u,best,'sail');}
}
async function allyEndAuto(){ // 玩家操作盟軍：結束階段時，沒下令的單位由電腦代為行動與開火（已動過、已開火的不重複）
  uscSync();jmsSync();S._cvwDone=false;
  for(const u of uscPieces())await uscMove(u);
  await jmsMove();await ssnAll();
  escAutoFire('def');nmeFire();mdtFire();
  if(uscPieces().length)cvwStrike('def');
  await alliedLandStrikes('end');render();
}
async function ssnAll(){for(const u of S.units.filter(x=>x.type==='ssn'&&alive(x))){await ssnMove(u);ssnFire(u);}render();}
// ---------- 還沒進場的美航艦艦隊：在預定位置畫出半透明的整支編組（只是顯示，不會被打、不開火、不影響規則）----------
// 參戰前可能已經在附近待命；決定參戰後逐回合駛來；第 3 支（自夏威夷調派）要等派出後才畫
const USC_LAT=[23.6,22.3,24.9];
function wxMapSVG(){ // 地圖：各海域浪高標籤、颱風（中心、暴風圈、走過的路徑、下一回合預測位置）
  const W=S.weather;if(!S.started||!W||W.base==null)return '';
  const pxKm=KS*OW/2/20,P=ll=>{const [c,r]=llToRC(ll[0],ll[1]),[x,y]=center(c,r);return [x,y];};
  let o='<g class="wxmap" pointer-events="none">';
  const A={W:[119.55,23.2],N:[121.7,25.75],E:[122.3,23.3],S:[120.9,21.35]};
  // 浪高文字避開棋子：在原定位置附近 4 格內的海面格中，挑文字框內棋子最少、離原位置最近的地方
  const upx=S.units.filter(u=>alive(u)).map(u=>center(u.c,u.r)),uR=R*.9;
  const spot=(ll,txt)=>{const [c0,r0]=llToRC(ll[0],ll[1]),h0=TER[K(c0,r0)],[x0,y0]=center(c0,r0),hw=txt.length*5.6+4,hh=8;
    const cand=h0?Object.values(TER).filter(q=>q.t==='sea'&&hd(q,h0)<=4):[];let best=[x0,y0],bs=1e9;
    for(const q of [{c:c0,r:r0}].concat(cand)){const [x,y]=center(q.c,q.r),hit=upx.filter(([ux,uy])=>Math.abs(ux-x)<hw+uR&&Math.abs(uy-(y-4))<hh+uR).length,sc=hit*100+Math.hypot(x-x0,y-y0)/(KS*OW/2);if(sc<bs){bs=sc;best=[x,y];}}
    return best;};
  for(const z in A){const v=wxWaveLL(z==='W'?WXREF:A[z]),txt=WXZ[z]+' '+v.toFixed(1)+' m',[x,y]=spot(A[z],txt),col=v>=2.5?'#c0392b':v>1.25?'#d68910':'#2e86c1';
    o+='<text x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" text-anchor="middle" font-size="11" font-weight="800" fill="'+col+'" stroke="var(--panel,#fff)" stroke-width="3" paint-order="stroke" opacity=".85">'+WXZ[z]+' '+v.toFixed(1)+' m</text>';}
  const t=W.ty;
  if(t){const [x,y]=P([t.lon,t.lat]),R=t.R*pxKm,nx=S.nextW&&S.nextW.ty;
    if(t.trail&&t.trail.length)o+='<polyline points="'+t.trail.concat([[t.lon,t.lat]]).map(p=>P(p).map(v=>v.toFixed(1)).join(',')).join(' ')+'" fill="none" stroke="#8e44ad" stroke-width="2" stroke-dasharray="2 4" opacity=".7"/>';
    o+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(2*R).toFixed(1)+'" fill="#8e44ad" fill-opacity=".04" stroke="#8e44ad" stroke-opacity=".25" stroke-dasharray="4 6"/>';
    o+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+R.toFixed(1)+'" fill="#8e44ad" fill-opacity=".1" stroke="#8e44ad" stroke-opacity=".6" stroke-width="2"/>';
    if(nx){const [x2,y2]=P([nx.lon,nx.lat]);o+='<line x1="'+x.toFixed(1)+'" y1="'+y.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="#8e44ad" stroke-width="2.5" stroke-dasharray="6 4" marker-end="url(#tyArr)" opacity=".8"/><circle cx="'+x2.toFixed(1)+'" cy="'+y2.toFixed(1)+'" r="5" fill="none" stroke="#8e44ad" stroke-width="2" opacity=".8"/>';}
    o+='<defs><marker id="tyArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8e44ad"/></marker></defs>';
    o+='<g transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+')"><circle r="16" fill="#8e44ad" fill-opacity=".85"/><path d="M0-11C7-11 11-5 9 1M0 11C-7 11-11 5-9-1M11 0C11 7 5 11-1 9M-11 0C-11-7-5-11 1-9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle r="3" fill="#fff"/></g>';
    o+='<text x="'+x.toFixed(1)+'" y="'+(y-22).toFixed(1)+'" text-anchor="middle" font-size="12" font-weight="800" fill="#8e44ad" stroke="var(--panel,#fff)" stroke-width="3" paint-order="stroke">'+TYC[t.cls].n+'颱風・暴風半徑 '+t.R+' km</text>';
  }
  return o+'</g>';
}
function ghostIds(){
  if(!S.started||!S.fx||S.over||S.video||(S.fxScen!=='interest'&&S.fxScen!=='full'))return [];
  return CSGS.filter((id,i)=>{const f=S.fx.units.find(x=>x.id===id);if(!f||f.hp<=0||csgPieceOf(f)||fxActive(f))return false;return i<2||fxReady(f)!=null;});
}
function ghostFleetsSVG(){
  let o='';
  for(const id of ghostIds()){
    const f=S.fx.units.find(x=>x.id===id),ci=csgIdx(id),[c0,r0]=llToRC(USC_HOME[0],USC_LAT[ci]||USC_HOME[1]),h0=TER[K(c0,r0)];if(!h0||h0.t!=='sea')continue;
    const ring=nbrs(h0.c,h0.r).filter(x=>x&&x.t==='sea'&&!unitAt(x.k)),types=usEscorts().concat(['ssn']),ps=[{type:'csg',h:h0}].concat(types.map((t,i)=>ring[i]?{type:t,h:ring[i]}:null).filter(Boolean));
    const rd=fxReady(f),eta=rd!=null&&S.turn<rd?'航行中・第 '+rd+' 回合抵達':'待命・美國尚未參戰',[lx,ly]=cen(h0.c,h0.r);
    o+='<g class="gfleet" opacity=".5" pointer-events="none">'+ps.map((p,i)=>unitSVG({id:-(500+ci*10+i),type:p.type,side:'def',ally:'US',c:p.h.c,r:p.h.r,hp:TYPES[p.type].hp,ghostFleet:true})).join('')+'</g>'+
      '<text x="'+lx.toFixed(1)+'" y="'+(ly-34).toFixed(1)+'" text-anchor="middle" font-size="11" font-weight="800" fill="var(--us,#2b6cb0)" stroke="var(--panel,#fff)" stroke-width="3" paint-order="stroke" pointer-events="none">'+csgName(ci)+'</text>'+
      '<text x="'+lx.toFixed(1)+'" y="'+(ly-22).toFixed(1)+'" text-anchor="middle" font-size="10" font-weight="700" fill="var(--muted,#667)" stroke="var(--panel,#fff)" stroke-width="3" paint-order="stroke" pointer-events="none">'+eta+'</text>';
  }
  return o;
} // 各支航艦打擊群的進場緯度（★推估：彼此相距約 250 km，分散防空與避免同時被定位）
// ---------- 盟軍操作：守方玩家可親自指揮美日艦隊（沒下令的單位在結束階段由電腦代為行動）----------
const allyHuman=()=>!S.sim&&!S.video&&!S.rec&&!!S.ctrl&&S.ctrl.def==='human'&&S.allyCtl==='player';
const tomShooters=u=>(u.type==='csg'?S.units.filter(e=>e.grp===u.id&&isEsc(e)):[u]).filter(e=>alive(e)&&e.mag&&e.mag.lam>=LAM.per&&e.tomT!==S.turn);
const tomOn=()=>humanTurn()&&S.phase==='def'&&allyHuman()&&S.mode==='tom'&&!!S.sel&&tomShooters(S.sel).length>0;
function allyTomahawk(sel,id){
  const m=tomShooters(sel)[0];if(!m)return;m.tomT=S.turn;m.mag.lam-=LAM.per;
  log(uname(m)+'發射 '+LAM.per+' 枚戰斧巡弋飛彈縱深打擊（剩 '+m.mag.lam+' 枚）');strikeCN(id,'US');
}
function tomClick(id){ // 點大陸基地：用戰斧巡弋飛彈打擊（先跳出升級警告）
  if(!tomOn()||!cnTargets().includes(id))return false;
  const sel=S.sel;(async()=>{
    if(!(await confirmBox('對大陸本土縱深打擊會升高衝突：美軍每次打擊會讓中方累積 0.5 次回擊（美國尚未公開參戰、屬代理打擊時為 0.25），回擊的對象是美日基地與部隊；大陸的民間與經濟損失也會增加。確定要用戰斧巡弋飛彈打擊「'+CNB[id].n+'」嗎？')))return;
    if(!tomShooters(sel).length)return;allyTomahawk(sel,id);S.mode=null;render();
  })();return true;
}
function uscPiece(){return S.units.find(u=>u.type==='csg'&&alive(u));}
function uscSync(){let first=null;for(const id of CSGS){const u=uscSync1(id);if(u&&!first)first=u;}ssnSync();landSync();return first;}
function uscSync1(id){
  const f=S.fx&&S.fx.units.find(x=>x.id===id);if(!f)return null;let u=csgPieceOf(f);const ci=csgIdx(id);
  const on=f&&f.hp>0&&fxActive(f);
  if(!on){if(u)S.units=S.units.filter(x=>x!==u&&!(x.type==='ssn'&&x.grp===u.id));const es=S.units.filter(e=>e.ally==='US'&&isEsc(e)&&(!u||e.grp===u.id)&&(u||!S.units.some(x=>x.type==='csg'&&x.id===e.grp)));if(es.length){S.units=S.units.filter(e=>!es.includes(e));log('美軍護航艦隨'+csgName(ci)+'撤離戰區（'+es.length+' 艘）');}return null;}
  if(!u){
    const [c,r]=llToRC(USC_HOME[0],USC_LAT[ci]||USC_HOME[1]);const k0=TER[K(c,r)]?K(c,r):null;
    const h=k0&&TER[k0].t==='sea'&&!unitAt(k0)?TER[k0]:placeNear(k0||Object.keys(TER).find(k=>TER[k].t==='sea'),x=>x.t==='sea'&&x.c>=c-3);
    if(!h)return null;
    u=mkUnit('def','csg',h.k,{});u.ally='US';u.fid=id;u.hp=f.hp;u.prev=null;u.wmag=CVW.US.mag;S.units.push(u);u.hadSup=true;spawnEscorts(u,usEscorts(),'def','US');spawnSsn(u.id,u); // 剛進場：視為高速航行中，定位最難
    log(csgName(ci)+'進入台灣東側海域（地圖上的「美航艦」棋子，由電腦自動操作）');if(ci)bigNews(csgName(ci)+'抵達','美國第 '+(ci+1)+' 支航艦打擊群抵達台灣東方海域，艦載機與護航艦加入作戰。');
  }
  u.hp=f.hp;return u;
}
// 每個守方階段：記下上一回合位置（偵察定位用），再移動（有共軍水面艦隊時待在其艦射飛彈射程外，否則在台灣東岸外約 6 格）
async function uscTurn(){
  uscSync();jmsSync();
  if(allyHuman()){for(const u of uscPieces())u.prev=[u.c,u.r];if(!S.allyNote&&S.units.some(u=>u.ally&&u.side==='def'&&alive(u))){S.allyNote=true;log('美日盟軍由你操作：點選美航艦、護航艦、海自艦艇或攻擊潛艦，可移動與開火；沒下令的單位在你結束階段時由電腦代為行動。');toast('美日盟軍由你操作',3200);}return;}
  for(const u of uscPieces())await uscMove(u);await jmsMove();await ssnAll();
  escAutoFire('def'); // 美軍護航艦：射程內有共軍艦艇就開火（電腦自動）
}
async function uscMove(u){
  if(u.moved)return;u.prev=[u.c,u.r];
  if(cvOOA(u)){const foe=S.units.filter(e=>e.side==='atk'&&atSea(e)&&isShip(e));let best=null,bs=-1e9;for(const [k,v] of reach(u)){if(v.kind!=='sail')continue;const h=TER[k],sc=(foe.length?Math.min(...foe.map(e=>hd(h,hexOf(e)))):0)+h.c*.5;if(sc>bs){bs=sc;best=k;}}if(best){doMove(u,best,'sail');render();await sleep(200);}return;} // 失去戰鬥能力：往東撤離
  const rc=reach(u),tw=Object.values(TER).filter(h=>h.isl==='TW'&&h.coastal);
  const foe=S.units.filter(e=>e.side==='atk'&&atSea(e));
  // 有共軍水面艦隊時：待在對方艦射反艦飛彈射程（＋2 格）外，但在自己艦載機的打擊距離內；沒有時：維持在台灣東岸外約 6 格
  const thr=foe.filter(e=>isEsc(e)&&e.mag&&e.mag.asm>0),reachR=CVW.US.r+CVW.US.asmR-2;
  const sc=k=>{const h=TER[k],ag=cvAggr(u,h);
    if(thr.length){const dn=Math.min(...foe.filter(e=>isShip(e)).map(e=>hd(h,hexOf(e))));return thr.reduce((a,e)=>a+Math.max(0,SHIPW[e.type].asmR+2-hd(h,hexOf(e))),0)*3+Math.max(0,dn-reachR)+Math.min(...tw.map(t=>hd(h,t)))*.02+ag;}
    const d=Math.min(...tw.map(t=>hd(h,t)));return Math.abs(d-6)+foe.reduce((a,e)=>a+Math.max(0,4-hd(h,hexOf(e))),0)*.8+ag;};
  let best=null,bs=sc(K(u.c,u.r))-.3;
  for(const [k,v] of rc){if(v.kind!=='sail')continue;const t=sc(k);if(t<bs){bs=t;best=k;}}
  if(best){doMove(u,best,'sail');render();await sleep(200);}
}
// 反航母打擊（A 方案，數字皆為推估）：每回合最多 2 枚反艦彈道飛彈（東風-21D／26），每枚耗用 1 點火箭軍存量
// 單發命中率＝偵察定位 × 末端穿透。定位：上一回合移動 ≤1 格 0.6、2 格 0.4、≥3 格 0.2；穿透：max(0.1, 0.5 − 0.1 × 護航數)，護航數＝打擊群自身 2 艘＋在場的盟軍艦艇
const ASBM={max:2,loc:[.6,.6,.4,.2],pen0:.5,penStep:.1,penMin:.1,ownEscort:2};
// ---------- 舊戰機改裝無人機：誘餌波 ----------
// 依據：Mitchell Institute 報告（路透社報導）估計台海附近機場已部署約 200 架以上舊戰機改裝無人機；陸委會稱可改裝超過 500 架。
// 2026～2027 年 200 架、★2028～2029 年 300 架、★2030 年起 500 架；每個攻方階段在飛彈打擊前放出 ★40 架；★守方分不出誘餌，每架射 2 枚攔截彈
// （占用本回合接戰上限與攔截彈存量）；突破的無人機不另外造成傷害（第一版只算消耗攔截彈）
const PLA_DRONE={'2026':200,'2027':200,'2028':300,'2029':300,'2030':500,'2031':500,'2032':500},DRONE_WAVE=40;
// ---------- 共軍獵殺台灣艦隊（每個攻方階段）----------
// 艦艇雷達訊號大、比陸上發射車好找：★出港艦隊的定位機率依制空——攻方優勢 90%、均勢 65%、守方優勢 40%；夜間 ×0.85（以雷達為主的海上偵察受夜間影響小）、雲雨或颱風 ×0.8；
// 上一階段開火暴露＝100%；在港內是固定目標＝★90%。找到後以 ★16／12／6 枚空射反艦飛彈攻擊（依制空：可用的打擊機數），以齊射模型對上艦隊自身防空，每命中 1 枚沉 1 艘
const KSEA={ctl:{atk:.9,mid:.65,def:.4},port:.9,night:.85,wx:.8,n:{atk:16,mid:12,def:6}};
function huntFleets(){
  const out=[],ac=S.airCtl||'mid';
  for(const u of S.units.filter(x=>x.fl&&x.side==='def'&&alive(x))){
    const h=hexOf(u),inPort=h.t==='port';let p;
    if(inPort)p=KSEA.port;else if(u.revealed)p=1;else{p=KSEA.ctl[ac];if(S.turn%2===0)p*=KSEA.night;if(S.weather&&(S.weather.id==='bad'||tyThreat(S.weather)))p*=KSEA.wx;}
    if(!hitP(p,'huntLoc:'+(inPort?'port':'sea'))){out.push(u.fl.n+'：沒有找到（定位 '+Math.round(p*100)+'%）');continue;}
    const n=KSEA.n[ac],r=salvoCalc(u,n,false,'hunt>'+u.fl.id);
    fxq({t:'air',at:[u.c,u.r],hit:r.hits>0,tsea:true,org:orgPick('pla'),k:'cm',ad:r.I>0?(r.hits>0?'pass':'int'):undefined,adSide:'def'});
    out.push(u.fl.n+'（'+(inPort?'港內':u.revealed?'開火後暴露':'海上')+'）：'+n+' 枚，艦隊攔截 '+r.I+' 枚，命中 '+r.hits+(r.hits?'，沉 '+Math.min(r.hits,u.hp)+' 艘':''));
    if(r.hits)damage(u,r.hits,'共軍空射反艦飛彈');
  }
  if(out.length)log('共軍獵殺守方艦隊（制空'+AIRCTL[ac]+'；定位與枚數為推估）：'+out.join('；'));
}
function droneWave(){
  const P=S.pools;if(!(P.plaDrone>0))return;const n=Math.min(P.plaDrone,DRONE_WAVE);P.plaDrone-=n;
  const r=adIntercept(n),kill=Math.round(n-r.surv);S.stats.drones=(S.stats.drones||0)+n;
  airfields().filter(h=>S.owner[h.k]!=='atk').slice(0,3).forEach(h=>fxq({t:'air',at:[h.c,h.r],hit:false,tsea:false,org:orgPick('pla'),k:'drone',ad:r.I>0?'int':undefined}));
  log('舊戰機改裝無人機 '+n+' 架當誘餌飛向台灣：守方防空發射 '+r.I+' 枚攔截彈、擊落約 '+kill+' 架（剩 '+fmt1(P.plaDrone)+' 架；攔截彈還剩 '+adTot()+' 枚；架數與用法為推估）');
}
function antiCarrier(){
  const ps=uscPieces().filter(u=>!cvOOA(u));if(!ps.length||!S.pools||S.pools.plaLR<1)return;const mv=x=>x.prev?hd(TER[K(x.prev[0],x.prev[1])]||hexOf(x),hexOf(x)):3,u=ps.reduce((a,b)=>mv(b)<mv(a)?b:a); // 挑定位最準的那支
  const moved=u.prev?hd(TER[K(u.prev[0],u.prev[1])]||hexOf(u),hexOf(u)):3;
  const pLoc=ASBM.loc[Math.min(3,moved)];
  const n=Math.min(ASBM.max,Math.floor(S.pools.plaLR));let h=0,I0=0,loc=0;
  for(let i=0;i<n&&alive(u);i++){
    S.pools.plaLR--;let ok=false; // 反艦彈道飛彈屬東風-21D／26 存量
    if(hitP(pLoc,'asbmLoc')){loc++;const r=salvoCalc(u,1,true,'asbm');I0+=r.I;ok=r.hits>0;} // 先要定位成功，再過護航艦的反彈道攔截（齊射模型）
    fxq({t:'air',at:[u.c,u.r],hit:ok,tsea:true,org:orgPick('pla'),k:'bm'});
    if(ok){h++;damage(u,1,'反艦彈道飛彈（東風-21D／26）');}
  }
  log('反航母打擊：發射 '+n+' 枚反艦彈道飛彈，定位成功 '+loc+' 枚、護航艦發射 '+I0+' 枚攔截彈，命中 '+h+' 枚（定位 '+Math.round(pLoc*100)+'%：上一回合移動 '+moved+' 格；攔截以齊射模型計算；皆為推估）');
}
async function beginPhase(side){
  S.phase=side;S.sel=null;S.mode=null;
  GHOSTS.clear();S.units.forEach(u=>{u.inc=0;if(side==='def')u.revealed=!!(u.mT&&S.turn<u.mT);});
  for(const u of S.units)if(u.side===side){u.moved=false;u.acted=false;if(u.type==='hk'){if(hexOf(u).t==='port'){u.tp=hkTp();u.hm=HK_HM;}u.shots=hkSpent(u)?0:1;}if(isEsc(u))u.shots=1;if(u.type==='mlrs'&&u.rl>0)u.rl--;if(isMsl(u))u.shots=(u.type==='ssm'&&S.pools&&S.pools.rocAS<=0)?0:u.type==='ssm'?(ssmReady(u)>0?Math.max(1,Math.round(2*ssmReady(u)/lchV0(u))):0):u.type==='mlrs'?(u.rl>0?0:1):u.type==='hmr'?(u.lu=0,Math.ceil(ssmReady(u)/HMR_PKG)):u.type==='ff'?1:2;}
  for(const u of S.units)if(u.side===side&&(u.type==='hmr'||u.type==='mlrs')&&u.veh!=null&&ssmReady(u)<=0)u.shots=0; // 車都不能射了
  if(side==='atk')S.turnStart={snap:snap(),lv:Object.assign({},S.fx.lv),owner:Object.assign({},S.owner)};
  if(window.TSL_RUMBLE&&humanTurn())TSL_RUMBLE('turn'); // 輪到自己操作時短震一下
  render();if(side==='atk'&&S.turn>1)captureHL('t'+(S.turn-1));await runEvents(side);if(S.over)return;
  await truceEval(side);if(S.over)return;
  if(side==='def')await portEval();if(S.over)return;
  if(side==='def'){await uscTurn();if(S.over)return;}
  if(side==='atk'){subDetect();updateBeachheads();await convoyEval();if(S.over)return;}
  if(side==='def')await interdictEval();if(S.over)return;
  if(side==='atk'){repairPorts();repairAirfields();repairCN();resolveSupply();convoyTurn();liftTurn();supplyAttrition();if(S.over)return;}
  if(side==='atk'){
    S.weather=rollWeather();if(S.weather.id==='bad')S.stats.badWx++;waveAttrition();if(S.over)return;
    if(S.turn===1&&!S.sirenDone&&!S.sim&&!S.video&&!REC.quiet){S.sirenDone=true;SFX.siren(6);} // 第一波：空襲警報
    uscSync();jmsSync();cvwPlan();airBattle();S.fire=computeFire();droneWave();huntFleets();doRetaliation();sweepMines();uscSync();antiCarrier();if(S.over)return;
    if(S.ctrl.atk==='human'&&!S.sim&&!S.video)cvwPrepOnly('atk');else cvwStrike('atk');render();if(S.over)return; // 玩家操作攻方：艦載機對艦份額可先手動指定目標，階段結束時剩下的自動出擊
    if(S.turn>=3&&S.owner[MAGONG]!=='atk'&&S.units.some(u=>u.side==='def'&&hexOf(u).k===MAGONG)&&S.units.some(u=>u.side==='atk'&&atSea(u)&&!isShip(u))){antiShip('守方（澎湖前沿警戒）',1,4,false,'','roc','cm');render();}
    (ATK_REINF[S.turn]||[]).forEach(([t,z])=>{ // 第 8 回合後的持續增援：兩棲旅每回合 2 個，掌握港口時再加 1 個重型旅
      const h=t==='arm'?placeNear(FK('4,4'),x=>x.isl==='CN'&&x.t==='port'):placeNear(FK('4,4'),x=>x.isl==='CN'&&x.coastal);
      if(h){if(!z){const ax=(S.plan&&S.plan.axes)||['north','central'];z=ax[S.zoneFlip++%ax.length];}S.units.push(mkUnit('atk',t,h.k,{zone:z}));log('攻方增援 '+TYPES[t].n+' 抵達 '+hname(h));}
    });
    log('第 '+S.turn+' 回合開始，天候'+S.weather.n+'（海上移動 '+S.weather.sea+'，火力 '+S.fire+' 點'+(S.weather.air?'':'，無法空降')+'）');
  } else {
    if(supply().over)S.stats.over++;
    let wave=(DEF_REINF[S.turn-S.mods.defReinfDelay]||[]).slice(); // 守方後備旅動員受裝備庫存限制，4 回合後沒有新的後備旅
    if(S.mods.defReinfHalve)wave=wave.filter((k,i)=>i%2===0);
    if(wave.length)for(let i=0;i<S.mods.defReinfExtra;i++)wave.push(wave[0]);
    wave.forEach(k=>{
      const h=(S.owner[k]==='def'&&!unitAt(k))?TER[k]:placeNear(k,x=>x.isl==='TW'&&x.t!=='mtn'&&S.owner[x.k]==='def'&&!inZOC('def',x));
      if(h){const nu=mkUnit('def','res',h.k);nu.mobT=S.turn;S.units.push(nu);S.stats.reserves++;log('守方後備旅於 '+hname(h)+' 完成動員（裝備與人員還在編成，攻防各 −1，到下一個攻方階段結束）');}
    });
    S.dfire=lrPackets();usReview();render(); // 本階段可發射的包數（每包 4 枚）：受發射車與存量限制
    if(S.ctrl.def!=='human')for(const m of S.units.filter(u=>u.side==='def'&&u.type==='ff'))await ffSortie(m); // 守方艦艇先出港，再進行海上交戰結算
    await navalPhase();if(S.over)return;
  }
  toast('第 '+S.turn+' 回合 · '+SIDE[side]+'階段');
  render();
  if(S.ctrl[side]==='ai')runAI(side);
}
async function endPhase(){
  if(S.over||!S.started)return;
  if(S.phase==='atk'&&S.ctrl.atk==='human'&&!S.sim&&!S.video&&S.units.some(u=>cvOwn(u)&&(u.cvwT===S.turn&&u.cvwB>0||u.cvwLT===S.turn&&u.cvwLB>0))){cvwStrike('atk');S.mode=null;render();if(S.over)return;} // 沒用完的艦載機對艦份額自動出擊
  if(S.phase==='atk')return beginPhase('def');
  if(allyHuman()){S.busy=true;try{await allyEndAuto();}finally{S.busy=false;}if(S.over)return;}
  S.stats.tpHold=S.owner[TAIPEI]==='atk'?(S.stats.tpHold||0)+1:0;
  {const nn=conditions().filter(c=>c.atk).length;S.stats.winHold=nn>=2?(S.stats.winHold||0)+1:0;S.stats.fullHold=nn>=3?(S.stats.fullHold||0)+1:0;}
  econTick();
  if(S.turn>=S.T){
    // 未真正分出勝負（攻方達成不到兩項、但島上或海上還有攻方兵力）就不在此判定，雙方繼續打下去；上限 30 回合
    const nn=conditions().filter(c=>c.atk).length,alive=S.units.some(u=>u.side==='atk'&&!isShip(u)&&(onTW(u)||hexOf(u).isl==='PH'||atSea(u)));
    if(nn<2&&alive&&S.T<30){
      // 超過預計回合：真人操作的局可選擇由電腦接手推演到分出勝負，或自己繼續、或現在就判定
      const human=!S.sim&&!S.video&&!S.rec&&(S.ctrl.atk==='human'||S.ctrl.def==='human');
      if(human){
        const info={title:'已超過預計回合',blurb:'預計的第 '+S.T+' 回合到了，但勝負還沒分出來（攻方達成 '+nn+' / 3 項，雙方仍在交戰）。要怎麼繼續？',
          opts:[{id:'self',label:'自己繼續操作（再 2 回合）',desc:'判定延後 2 回合，由你繼續指揮。',est:'判定延後至第 '+(S.T+2)+' 回合',rec:false},
            {id:'ai',label:'由電腦接手推演到分出勝負',desc:'雙方都交給電腦，一路推演到分出勝負（上限第 30 回合）；之後可看戰報與結算。',est:'電腦推演，最多到第 30 回合',rec:true},
            {id:'now',label:'現在就判定',desc:'不再延長，依目前局勢直接判定結果。',est:'依目前的控制與兵力判定',rec:false}]};
        const o=await askTruce(info,()=>info.opts[1]);
        if(o.id==='now')return endGame();
        if(o.id==='ai'){S.ctrl={atk:'ai',def:'ai'};S.takeover=true;log('超過預計回合：雙方改由電腦接手推演，直到分出勝負');}
      }
      S.T+=2;S.extended=true;S.stats.autoExt=(S.stats.autoExt||0)+1;log('戰局尚未分出勝負：判定延後至第 '+S.T+' 回合（攻方達成 '+nn+' / 3 項，雙方仍在交戰）');toast('戰局未分，判定延後至第 '+S.T+' 回合',3600);}
    else return endGame();
  }
  if((S.stats.fullHold||0)>=2)return endGame('攻方連續兩個回合同時控制首都、主要港口並取得兵力優勢，提前判定攻方勝利。','atk','攻方提前取勝');
  const n=buildNews();S.news.push(n);
  if(S.rec){render();if(S.newsOn)recordFrame({html:newsBody(n),kind:'news',dur:6500});}
  else if(S.newsOn&&!S.simAuto){if(S.newsCompact){render();toast('📰 '+((n.items&&n.items[0])||'本回合快訊'),3200);}else{S.busy=true;render();await showNews(n);S.busy=false;}}
  if(S.over)return;
  S.turn++;beginPhase('atk');
}
