'use strict';
/* ---------- 守方防空飛彈棋子（2026-11-17；★推估）----------
   依據：愛國者 9 個作戰連（衛星影像可見 9 處；另有 1 個訓練單位），分北、中、南部署，保護西部都會與軍事設施；第 4 個愛國者營 2025 年成立，配合 PAC-3 MSE 交付。
   天弓三型約 12 個連（2026 年底前完成 12 處陣地，期間部分在臨時陣地）。NASAMS 3 套（本遊戲依年代設定 2031 年起）。
   ★推估：每個棋子代表一個營（數個連）；攔截彈依原本的全台總數（愛國者三型 486、二型 200、天弓三型 400，依年代縮放）按連數分配；
   每連每階段最多接戰 8 枚來襲；對彈道飛彈的防禦範圍約 40 km、對飛機約 100 km（NASAMS 約 40 km、不能攔彈道飛彈）；
   確切陣地位置不公開，棋子放在所保護的都會區與基地附近。開戰前的陣地是已知的（前 2 回合定位 25%），之後比照隱蔽中的地面部隊；
   雷達開機接戰後容易被電子偵察定位（★下一回合定位 35%）。每失 1 步，該營約損失一半的連與攔截彈。 */
const SAM={
  sys:{p:{n:'愛國者',bmR:40,acR:100},t:{n:'天弓三型',bmR:40,acR:100},n:{n:'NASAMS',bmR:0,acR:40}},
  sites:[
    {id:'PN',sys:'p',n:'愛國者 北部營',tag:'愛國者',lon:121.15,lat:24.95,bat:3},
    {id:'PC',sys:'p',n:'愛國者 中部營',tag:'愛國者',lon:120.62,lat:24.26,bat:3},
    {id:'PS',sys:'p',n:'愛國者 南部營',tag:'愛國者',lon:120.30,lat:22.80,bat:3},
    {id:'PE',sys:'p',n:'愛國者 第 4 營（花蓮）',tag:'愛國者',lon:121.60,lat:23.98,bat:1}, // 2025 年成立、配合 PAC-3 MSE；★2 個連拆成花蓮、台東各 1 連（2026-11-18：東部原本只有花蓮一處，宜蘭、台東完全沒有彈道飛彈防禦）
    {id:'PT',sys:'p',n:'愛國者 第 4 營（台東志航）',tag:'愛國者',lon:121.10,lat:22.76,bat:1},
    {id:'TN',sys:'t',n:'天弓三型 北部',tag:'天弓三',lon:121.55,lat:25.08,bat:3}, // ★原本 4 連，挪 1 連到宜蘭（總連數不變）
    {id:'TY',sys:'t',n:'天弓三型 宜蘭',tag:'天弓三',lon:121.75,lat:24.75,bat:1},
    {id:'TC',sys:'t',n:'天弓三型 中部',tag:'天弓三',lon:120.50,lat:24.08,bat:3},
    {id:'TS',sys:'t',n:'天弓三型 南部',tag:'天弓三',lon:120.25,lat:23.00,bat:3},
    {id:'TP',sys:'t',n:'天弓三型 澎湖',tag:'天弓三',lon:119.58,lat:23.57,bat:2,isl:'PH'},
    {id:'NA',sys:'n',n:'NASAMS 台北',tag:'NASAMS',lon:121.55,lat:25.06,bat:3,era:2031}],
  ch:8,emit:.35
};
// 增購的天弓三型連（★推估）：以 2026 年的防空點數（4）為基準，之後每多 1 點就多 1 個連（2028～29 年 +1、2030 年 +2、2031～32 年 +3）；只增加連數（陣地與每階段接戰上限），攔截彈總數仍由原本的防空點數決定。
// 位置由守方在設定精靈挑選（電腦守方、電腦推演一律「自動」＝補在目前彈道防禦涵蓋最少的地方）。候選地點是各地區的代表位置（★推估，陣地不公開）。
const SAM_EXTRA=[{id:'kl',n:'基隆・台北東',lon:121.72,lat:25.10},{id:'hc',n:'新竹・苗栗',lon:120.90,lat:24.70},{id:'tc',n:'台中',lon:120.65,lat:24.15},{id:'cy',n:'雲林・嘉義',lon:120.40,lat:23.60},
  {id:'ks',n:'高雄',lon:120.30,lat:22.62},{id:'pt',n:'屏東・恆春',lon:120.70,lat:22.30},{id:'yl',n:'宜蘭',lon:121.76,lat:24.72},{id:'hl',n:'花蓮',lon:121.60,lat:23.98},{id:'tt',n:'台東',lon:121.10,lat:22.76},{id:'ph',n:'澎湖',lon:119.58,lat:23.57,isl:'PH'}];
const samExtraN=era=>{const e=ERA[era]||ERA['2026'];return Math.max(0,((e.pools&&e.pools.rocAD)||POOL0.rocAD)-POOL0.rocAD);};
const samSite=u=>SAM.sites.find(x=>x.id===u.sid)||(S.samX||[]).find(x=>x.id===u.sid);
// 重要地點（機場、港口、城市）：彈道防禦涵蓋判定與「自動」選址用
const samValuable=()=>terList('samVal',h=>(h.isl==='TW'||h.isl==='PH')&&h.name&&(h.t==='air'||h.t==='port'||h.t==='city'));
const samBmHexes=()=>samList().filter(u=>samSys(u).bmR>0).map(u=>hexOf(u));
const samExtraHex=c=>{const [col,row]=llToRC(c.lon,c.lat),isl=c.isl||'TW';return placeNear(K(col,row),x=>x.isl===isl&&isLand(x)&&x.t!=='mtn'&&canStack({side:'def',type:'sam'},x.k));};
const samNewCov=(h,have)=>samValuable().filter(v=>rd(v,h)<=kmH(SAM.sys.t.bmR)&&!have.some(q=>rd(v,q)<=kmH(SAM.sys.t.bmR)));
// 設定精靈的選項說明：這個地點會新涵蓋哪些原本沒有彈道防禦的重要地點（以 2026 年的基本部署計算）
function samExtraDesc(c){try{const base=SAM.sites.filter(s=>!s.era&&s.sys!=='n').map(s=>{const [col,row]=llToRC(s.lon,s.lat);return TER[K(col,row)];}).filter(Boolean),h=TER[K(...llToRC(c.lon,c.lat))];
  if(!h)return '';const n=samNewCov(h,base).map(x=>x.name);return n.length?'新增涵蓋 '+n.length+' 處原本沒有彈道飛彈防禦的重要地點：'+n.slice(0,6).join('、')+(n.length>6?'…':'')+'。':'這附近的重要地點大多已有彈道飛彈防禦，主要是加厚（每連每階段多接戰 8 枚）。';}catch(e){return '';}}
const samSys=u=>SAM.sys[(samSite(u)||{}).sys]||SAM.sys.t;
const samList=()=>S.units.filter(u=>u.type==='sam'&&alive(u));
const samMag=u=>(u.mag.p3||0)+(u.mag.p2||0)+(u.mag.tk||0);
// 開局：依年代放棋子，把全台攔截彈按連數分給各營
function samSpawn(){
  if(S.units.some(u=>u.type==='sam'))return;S.sam=true;const era=+S.era||2026;S.samX=[];
  const live=SAM.sites.filter(s=>!s.era||era>=s.era),A=S.adI||{p3:0,p2:0,tk:0};
  for(const s of live){const [c,r]=llToRC(s.lon,s.lat),isl=s.isl||'TW',h=placeNear(K(c,r),x=>x.isl===isl&&isLand(x)&&x.t!=='mtn'&&canStack({side:'def',type:'sam'},x.k));if(!h)continue;
    S.units.push(mkUnit('def','sam',h.k,{sid:s.id,bat:s.bat,bat0:s.bat,mag:{p3:0,p2:0,tk:0}}));}
  // 增購的連：人類守方依設定選地點；電腦守方與「自動」＝補在新增涵蓋最多重要地點的候選地
  const human=S.ctrl&&S.ctrl.def==='human';
  for(let i=1;i<=samExtraN(S.era);i++){const el=document.getElementById('optAD'+i),pick=human&&el?el.value:'auto';let c=SAM_EXTRA.find(x=>x.id===pick);
    if(!c){const have=samBmHexes();let best=-1;for(const x of SAM_EXTRA){const h=samExtraHex(x);if(!h)continue;const sc=samNewCov(h,have).length;if(sc>best){best=sc;c=x;}}}
    if(!c)continue;const h=samExtraHex(c);if(!h)continue;const site={id:'X'+i,sys:'t',n:'天弓三型 增購（'+c.n+'）',tag:'天弓三',lon:c.lon,lat:c.lat,bat:1,k:h.k,pick:c.id};S.samX.push(site);
    S.units.push(mkUnit('def','sam',h.k,{sid:site.id,bat:1,bat0:1,mag:{p3:0,p2:0,tk:0}}));}
  // 攔截彈總數不變，依各營連數比例分配（增購的連也分到一份）
  const L=samList(),bp=L.filter(u=>samSite(u).sys==='p').reduce((a,u)=>a+u.bat,0),bt=L.filter(u=>samSite(u).sys==='t').reduce((a,u)=>a+u.bat,0);
  for(const u of L){const y=samSite(u).sys;u.mag=y==='p'?{p3:Math.round(A.p3*u.bat/bp),p2:Math.round(A.p2*u.bat/bp),tk:0}:y==='t'?{p3:0,p2:0,tk:Math.round(A.tk*u.bat/bt)}:{p3:0,p2:0,tk:0};}
}
// 全台合計（給原本以總數運作的規則與顯示用）
function samAgg(){if(!S.sam)return;const A={p3:0,p2:0,tk:0};for(const u of samList()){A.p3+=u.mag.p3||0;A.p2+=u.mag.p2||0;A.tk+=u.mag.tk||0;}S.adI=A;}
// 其他規則改了防空點數（空戰壓制、開戰第一波、戰前決策）：按比例分攤到各營；增加時補給天弓三型
function samScale(nw,old){
  const L=samList(),tot=L.reduce((a,u)=>a+samMag(u),0);if(!L.length)return false;
  if(nw<old&&tot>0){ // ★每少 1 點＝一個營損失 1 步（約一半的連與攔截彈），優先打剛開機接戰的、其次攔截彈最多的：防空被壓制是一個一個陣地被打掉，會出現缺口
    for(let i=0;i<old-nw;i++){const c=samList().filter(u=>samMag(u)>0);if(!c.length)break;const t=pickBest(c,u=>(u.emitT>=S.turn-1?1e4:0)+samMag(u));damage(t,1,'防空遭壓制');}}
  else if(nw<old){}
  else if(tot>0&&nw>old){const f=nw/Math.max(1,old);for(const u of L)for(const k of ['p3','p2','tk'])u.mag[k]=Math.round((u.mag[k]||0)*f);}
  else if(nw>old){const t=L.find(u=>samSite(u)&&samSite(u).sys==='t')||L[0];t.mag.tk=(t.mag.tk||0)+(nw-old)*MSL.adPerPt;}
  return true;
}
// 涵蓋：kind＝'bm'（彈道飛彈防禦）或 'ac'（對飛機）
function samCov(h,kind){if(!h)return samList();return samList().filter(u=>{const R=kind==='bm'?samSys(u).bmR:samSys(u).acR;return R>0&&rd(hexOf(u),h)<=kmH(R);});}
const samCovBM=h=>!S.sam||samCov(h,'bm').some(u=>samMag(u)>=2);
function samReset(){for(const u of samList())u.chU=0;}
const samChLeft=u=>Math.max(0,u.bat*SAM.ch-(u.chU||0));
const samCap=()=>samList().reduce((a,u)=>a+(samSys(u).bmR?u.bat*SAM.ch:0),0); // 全台每個攻方階段最多接戰的來襲枚數（各營連數 × 8）
// 攔截 n 枚來襲：只用涵蓋目標格的各營（h 為空時＝全台），每枚射 2 枚，先用愛國者三型
function samIntercept(n,h){
  const ps=samCov(h,'bm');let kill=0,I=0;
  for(let i=0;i<n;i++){
    const pick=k=>ps.find(u=>(u.mag[k]||0)>=2&&samChLeft(u)>0);const u=pick('p3')||pick('tk')||pick('p2');if(!u)break;
    const k=(u.mag.p3||0)>=2?'p3':(u.mag.tk||0)>=2?'tk':'p2';u.mag[k]-=2;u.chU=(u.chU||0)+1;u.emitT=S.turn;I+=2;
    kill+=1-Math.pow(1-MSL.pk[k]*((k==='p3'||k==='p2')&&!facUp('leshan')?(intelOK()?WARN.sat.pk:.8):1),2);}
  samAgg();return {surv:Math.max(0,n-kill),I};
}
// 棋子被打掉 n 步：★該營約按比例損失連與攔截彈
function samLoss(u,n){const hp0=Math.max(1,u.hp+n),f=u.hp<=0?1:n/hp0;for(const k of ['p3','p2','tk'])u.mag[k]=Math.round((u.mag[k]||0)*(1-f));u.bat=Math.max(0,Math.round(u.bat*(1-f)));samAgg();P_adFix();
  log((samSite(u)||{n:'防空營'}).n+' 受損：剩 '+u.bat+' 個連、攔截彈 '+samMag(u)+' 枚（推估）');}
// 空降、機降落點的防空強度：落點在幾個營的對空範圍內（兩個完整的營＝滿分）
function samDropF(h){const c=samCov(h,'ac').filter(u=>samMag(u)>0||samSite(u).sys==='n');return Math.min(1,c.reduce((a,u)=>a+.5*u.hp/TYPES.sam.hp,0));}
function samStatus(u){const s=samSite(u),Y=samSys(u),m=u.mag;
  return (s?s.n:'防空營')+'：'+u.bat+' 個連；攔截彈 '+(s&&s.sys==='p'?'愛國者三型 '+(m.p3||0)+'、二型 '+(m.p2||0):s&&s.sys==='t'?'天弓三型 '+(m.tk||0):'AMRAAM（只對飛機）')+' 枚；'+
    (Y.bmR?'彈道飛彈防禦約 '+Y.bmR+' km、':'')+'對飛機約 '+Y.acR+' km；'+(S.phase==='atk'?'本階段還可接戰 '+samChLeft(u)+'／'+u.bat*SAM.ch:'每個攻方階段可接戰 '+u.bat*SAM.ch)+' 枚來襲（推估）';}
