'use strict';
/* 浪高天候與颱風、避風（自 turn.js 拆出；載入順序在 truce 之前，內容不變） */
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
const seaOfH=h=>h<=1.25?kmH(100):Math.max(kmH(20),kmH(100)-kmH(20)*Math.ceil((h-1.25)/.75)); // 浪高→海上移動格數（與天候相同的規則）
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
  if(u.type==='psub')return n.isl==='CN';
  if(u.side==='atk'&&(isShip(u)||u.type==='amph'||u.type==='mar'||u.type==='arm'))return n.isl==='CN'||S.owner[n.k]==='atk';
  return false;
}
// 避風令：海上船艇朝最近的己方港口前進；進港者不受風浪損耗，沒趕到的下回合損耗減半
function shelterOrder(side){
  const own=Object.values(TER).filter(h=>h.t==='port'&&(side==='atk'?(h.isl==='CN'||S.owner[h.k]==='atk'):(h.isl==='TW'&&S.owner[h.k]==='def')));
  if(!own.length)return 0;
  const dp=h=>Math.min.apply(null,own.map(q=>hd(h,q)));let moved=0,n=0;
  for(const u of S.units.filter(x=>x.side===side&&atSea(x)&&!isSubT(x)&&x.type!=='fob'&&(isShip(x)||x.type==='amph'||x.type==='mar'||x.type==='arm')&&shelterAt(x))){
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
function shelterNeeded(side){if(!S.started||S.over||!S.nextW)return false;return S.units.some(u=>(!side||u.side===side)&&!isSubT(u)&&u.type!=='fob'&&(isShip(u)||u.type==='amph'||u.type==='mar'||u.type==='arm')&&shelterAt(u));} // 只有預報會受影響的海域才需要避風（颱風看預測路徑）
function waveAttrition(){ // 依每艘船所在海域的浪高
  let n=0,hx=0;const grp=u=>u.type==='dd'||u.type==='cv'?[5,.3]:(u.type==='ff'||u.type==='cvy'||u.type==='amph'||u.type==='mar'||u.type==='arm')?[2.5,.5]:null;
  for(const u of S.units.slice()){
    if(!atSea(u)||isSubT(u)||u.type==='fob')continue;const g=grp(u),h=wxWave(hexOf(u));if(!g||h<=g[0])continue;hx=Math.max(hx,h);
    const sheltered=u.shelterT===S.turn-1?.5:1,ev=g[1]*(h-g[0])/3.5*sheltered;
    if(takeInt(ev,'wave:'+u.side+u.type)>=1){damage(u,1,'風浪');n++;}
  }
  if(n){log('風浪（最大浪高 '+hx.toFixed(1)+' 公尺）造成 '+n+' 艘次船艇損耗');if(!REC.quiet)toast('風浪造成船艇損耗 '+n+' 艘次');}
}
