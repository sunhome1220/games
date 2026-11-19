'use strict';
/* 盟軍與共軍潛艦棋子：美航艦群、海自、攻擊潛艦、潛艦行動（自 turn.js 拆出） */
// ---------- 美軍航艦打擊群棋子（第 1 階段）：參戰抵達後出現在台灣東側外海，由電腦自動操作 ----------
// 生命值以場外的 csg（S.fx.units）為準；棋子被打中時同步扣減。
const USC_HOME=[128.4,23.6]; // 預設進場位置：台灣東方約 700 km 的菲律賓海，在共軍艦射鷹擊-18（540 km）射程外、艦載機打擊距離內（推估）
// ---------- 海自護衛隊群（地圖棋子）：出雲級＋神盾艦 2＋通用護衛艦 1，由電腦操作，掩護先島群島 ----------
const JMS_HOME=[124.3,24.0],JMS_ENTRY=[128.3,25.9]; // ★掩護位置：石垣島南方；進場點：沖繩東南方（自佐世保南下，先在共軍艦射飛彈射程外）
const jmsPieces=()=>S.units.filter(u=>u.ally==='JP'&&(u.type==='ddh'||isEsc(u))&&alive(u));
const jmsLead=()=>S.units.find(u=>u.ally==='JP'&&u.type==='ddh'&&alive(u));
const WXSPOTC={}; // 浪高徽章的候選海格（依錨點格快取；只與地形有關）
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
  const sc=k=>{const h=TER[k];return foe.reduce((a,e)=>a+Math.max(0,SHIPW[e.type].asmR+kmH(40)-hd(h,hexOf(e))),0)*3+Math.max(0,hd(h,home)-kmH(60))*.15;}; // 與美航艦相同：先待在共軍艦射飛彈射程外，沒有威脅時才往先島群島靠攏掩護
  let best=null,bs=sc(K(u.c,u.r))-.3;for(const [k,v] of reach(u)){if(v.kind!=='sail')continue;const t=sc(k);if(t<bs){bs=t;best=k;}}
  if(best){doMove(u,best,'sail');render();await sleep(200);}
}
// ---------- 美軍攻擊潛艦與先島群島的陸上部隊（第 3 階段 PR3）----------
// 攻擊潛艦（維吉尼亞級）：★魚雷 12 枚（每次 2 枚）、魚叉 4 枚、戰斧 12 枚；每支航艦打擊群隨行 1 艘（在航艦 ±3 格內）、另有 1 艘獨立在台灣東南外海
// 陸戰隊濱海團：NMESIS 4 輛×2 枚＝★8 枚，射程 185 km＝9 格，每回合每輛最多發射 1 枚；陸軍多域特遣隊：堤豐 2 輛（戰斧 ★4、標準六型 ★6／12 格）
// 2028 年起部署在先島群島的日本陸地格；之前仍是抽象單位
const SSN_ARM={tp:12,hm:4,lam:12},SSN_PATROL=[124.6,22.6],NME={asm:8,R:kmH(180)},MDT={lam:4,asm:6,R:kmH(240)};
const landPiecesOn=()=>(+S.era||2026)>=2028;
const ssnIndep=()=>S.units.find(u=>u.type==='ssn'&&!u.grp&&alive(u));
const nmePiece=()=>S.units.find(u=>u.type==='nme'&&alive(u)),mdtPiece=()=>S.units.find(u=>u.type==='mdt'&&alive(u));
function seaNear(lon,lat,rad){const [c,r]=llToRC(lon,lat),k0=TER[K(c,r)]?K(c,r):null;return k0&&TER[k0].t==='sea'&&!unitAt(k0)?TER[k0]:placeNear(k0||Object.keys(TER).find(k=>TER[k].t==='sea'),x=>x.t==='sea'&&!unitAt(x.k));}
function spawnSsn(grp,near){
  const h=near?placeNear(K(near.c,near.r),x=>x.t==='sea'&&hd(x,hexOf(near))<=kmH(60)&&!unitAt(x.k)):seaNear(SSN_PATROL[0],SSN_PATROL[1]);if(!h)return null;
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
  const r=salvoHit(t,n,key+'>'+t.type),big=isBigShip(t),steps=r.steps;
  fxSalvo([m.c,m.r],t,r);
  log(uname(m)+'以 '+n+' 枚'+wn+'攻擊 '+uname(t)+'：對方防空發射 '+r.I+' 枚攔截彈，約 '+Math.round(r.surv*10)/10+' 枚突破，命中 '+r.hits+' 枚'+salvoStepTxt(t,steps,'，未造成重創')+'（齊射模型，參數為推估）');
  if(steps)damage(t,steps,TYPES[m.type].n+wn);checkInstant();return true;
}
function shipFoes(u,R){return S.units.filter(e=>e.side==='atk'&&atSea(e)&&isShip(e)&&!isSubT(e)&&e.type!=='fob'&&rd(hexOf(u),hexOf(e))<=R);}
function nmeFire(t0){const m=nmePiece();if(!m||m.acted||m.mag.asm<=0)return;const ts=shipFoes(m,NME.R);if(!ts.length)return;m.acted=true;pieceSalvo(m,t0&&ts.includes(t0)?t0:pickBest(ts,escVal),Math.min(m.mag.asm,2*m.hp),'海軍打擊飛彈（NMESIS）','nme');}
function mdtFire(t0){const m=mdtPiece();if(!m||m.acted||m.mag.asm<=0)return;const ts=shipFoes(m,MDT.R);if(!ts.length)return;m.acted=true;pieceSalvo(m,t0&&ts.includes(t0)?t0:pickBest(ts,escVal),Math.min(m.mag.asm,m.hp),'標準六型飛彈','mdt');}
// 美軍攻擊潛艦：每回合移動後，射程內有艦艇就開火（3 格內優先魚雷；6 格內魚叉）
function ssnFire(u,tgt){
  if(u.acted)return false;const ts=shipFoes(u,6);if(!ts.length)return false;
  const t=tgt&&ts.includes(tgt)?tgt:pickBest(ts,escVal),d=rd(hexOf(u),hexOf(t)),w=(u.tp>0&&d<=kmH(60))?'tp':(u.hm>0?'hm':null);if(!w)return false;
  if(w==='tp')u.tp=Math.max(0,u.tp-2);else u.hm--;u.acted=true;
  const nm=w==='hm'?'魚叉飛彈':'重型魚雷',sv=w==='hm'&&adCover(t).length?salvoCalc(t,1,false,'ssnSalvo>'+t.type):null;
  const hit=sv?sv.hits>0:hitP(w==='hm'?Math.max(.1,hkP(t)-.12):hkP(t),'ssn:'+w+'>'+t.type),big=t.type==='cv'||t.type==='csg',steps=!hit?0:sv&&big?takeInt(.5,'salvoBig'):1;
  log('美軍攻擊潛艦以'+nm+'攻擊 '+uname(t)+(sv?'：對方防空發射 '+sv.I+' 枚攔截彈，':'')+(hit?'命中'+(steps?'':'（航艦體積大，未造成重創）'):'未命中')+'（魚雷 '+u.tp+'、魚叉 '+u.hm+'、戰斧 '+u.mag.lam+' 枚；參數為推估）');
  fxq({t:'sub',from:[u.c,u.r],to:[t.c,t.r],hit,w});
  if(hit&&steps)damage(t,steps,'美軍攻擊潛艦'+nm);
  const dd=S.units.filter(e=>e.side==='atk'&&(e.type==='dd'||isEsc(e))&&alive(e)&&rd(hexOf(u),hexOf(e))<=kmH(80)).length,pa=Math.min(.65,(.1+.12*dd)*hkE()[1]*(w==='hm'?.5:1));
  if(hitP(pa,'ssn:'+w+'>'+t.type)){log('美軍攻擊潛艦被反潛兵力發現並攻擊');damage(u,1,'反潛攻擊');}
  if(alive(u))subEvade(u);
  return true;
}
async function ssnMove(u){
  if(!alive(u))return;const car=u.grp?S.units.find(x=>x.id===u.grp&&alive(x)):null;
  const [pc,pr]=llToRC(SSN_PATROL[0],SSN_PATROL[1]),home=car?hexOf(car):(TER[K(pc,pr)]||hexOf(u));
  const thr=S.units.filter(e=>e.side==='atk'&&isEsc(e)&&e.mag&&e.mag.asm>0);
  const sc=k=>{const h=TER[k];return Math.abs(hd(h,home)-(car?kmH(40):0))*1.0+thr.reduce((a,e)=>a+Math.max(0,kmH(60)-hd(h,hexOf(e))),0)*2;}; // 跟著航艦（或在巡邏點）、避開護航艦的反潛範圍
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
  const pxKm=HPX/KM_HEX,P=ll=>{const [c,r]=llToRC(ll[0],ll[1]),[x,y]=center(c,r);return [x,y];};
  let o='<g class="wxmap" pointer-events="none">';
  const A={W:[119.55,23.2],N:[121.7,25.75],E:[122.3,23.3],S:[120.9,21.35]};
  // 浪高文字避開棋子：在原定位置附近 4 格內的海面格中，挑文字框內棋子最少、離原位置最近的地方
  const upx=S.units.filter(u=>alive(u)).map(u=>center(u.c,u.r)),uR=R*.9;
  const spot=(ll,txt)=>{const [c0,r0]=llToRC(ll[0],ll[1]),h0=TER[K(c0,r0)],[x0,y0]=center(c0,r0),hw=txt.length*5.6+4,hh=8;
    const cand=h0?(WXSPOTC[h0.k]||(WXSPOTC[h0.k]=terList('sea',q=>q.t==='sea').filter(q=>hd(q,h0)<=kmH(80)))):[];let best=[x0,y0],bs=1e9;
    for(const q of [{c:c0,r:r0}].concat(cand)){const [x,y]=center(q.c,q.r),hit=upx.filter(([ux,uy])=>Math.abs(ux-x)<hw+uR&&Math.abs(uy-(y-4))<hh+uR).length,sc=hit*100+Math.hypot(x-x0,y-y0)/HPX;if(sc<bs){bs=sc;best=[x,y];}}
    return best;};
  // 浪高徽章：波浪圖示＋海域名＋浪高；顏色＝灘頭卸載規則的門檻（綠：1.25 m 以下不受影響；橘：受限；紅：2.5 m 以上無法卸載）
  for(const z in A){const v=wxWaveLL(z==='W'?WXREF:A[z]),txt=WXZ[z].replace('海域','')+' '+v.toFixed(1)+' m',[x,y]=spot(A[z],txt),col=v>=2.5?'#c0392b':v>1.25?'#d68910':'#2e8b57';
    const fs=10*Math.max(.7,SC),w=[...txt].reduce((a,ch)=>a+(/[\u3000-\u9fff]/.test(ch)?fs:fs*.58),0)+fs*2.1,h=fs*1.7;
    o+='<g class="wxl" data-x="'+x.toFixed(1)+'" data-y="'+y.toFixed(1)+'"><g transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+')"><rect x="'+(-w/2).toFixed(1)+'" y="'+(-h*.72).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="'+(h/2).toFixed(1)+
      '" fill="var(--panel,#fff)" fill-opacity=".86" stroke="'+col+'" stroke-width="1.2"/><path d="M'+(-w/2+fs*.45).toFixed(1)+' '+(-fs*.15).toFixed(1)+'q'+(fs*.2).toFixed(1)+' '+(-fs*.3).toFixed(1)+' '+(fs*.4).toFixed(1)+' 0t'+(fs*.4).toFixed(1)+' 0" fill="none" stroke="'+col+'" stroke-width="1.6" stroke-linecap="round"/>'+
      '<text x="'+(fs*.55).toFixed(1)+'" y="0" text-anchor="middle" font-size="'+fs.toFixed(1)+'" font-weight="700" fill="var(--ink,#222)"><tspan>'+WXZ[z].replace('海域','')+' </tspan><tspan fill="'+col+'" font-weight="800">'+v.toFixed(1)+' m</tspan></text></g></g>';} // 外層 g 給 textZoomFix 放大時縮字用
  const t=W.ty;
  if(t){const [x,y]=P([t.lon,t.lat]),R=t.R*pxKm,nx=S.nextW&&S.nextW.ty;
    if(t.trail&&t.trail.length)o+='<polyline points="'+t.trail.concat([[t.lon,t.lat]]).map(p=>P(p).map(v=>v.toFixed(1)).join(',')).join(' ')+'" fill="none" stroke="#8e44ad" stroke-width="2" stroke-dasharray="2 4" opacity=".7"/>';
    o+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(2*R).toFixed(1)+'" fill="#8e44ad" fill-opacity=".04" stroke="#8e44ad" stroke-opacity=".25" stroke-dasharray="4 6"/>';
    o+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+R.toFixed(1)+'" fill="#8e44ad" fill-opacity=".1" stroke="#8e44ad" stroke-opacity=".6" stroke-width="2"/>';
    if(nx){const [x2,y2]=P([nx.lon,nx.lat]);
      o+='<line x1="'+x.toFixed(1)+'" y1="'+y.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="#8e44ad" stroke-width="2.5" stroke-dasharray="6 4" marker-end="url(#tyArr)" opacity=".8"/><circle cx="'+
          x2.toFixed(1)+'" cy="'+y2.toFixed(1)+'" r="5" fill="none" stroke="#8e44ad" stroke-width="2" opacity=".8"/>';
      }
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
  if(!on){if(u)S.units=S.units.filter(x=>x!==u&&!(x.type==='ssn'&&x.grp===u.id));
    const es=S.units.filter(e=>e.ally==='US'&&isEsc(e)&&(!u||e.grp===u.id)&&(u||!S.units.some(x=>x.type==='csg'&&x.id===e.grp)));
    if(es.length){S.units=S.units.filter(e=>!es.includes(e));
    log('美軍護航艦隨'+csgName(ci)+'撤離戰區（'+es.length+' 艘）');
    }return null;
    }
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
  if(cvOOA(u)){const foe=S.units.filter(e=>e.side==='atk'&&atSea(e)&&isShip(e));
    let best=null,bs=-1e9;
    for(const [k,v] of reach(u)){if(v.kind!=='sail')continue;
    const h=TER[k],sc=(foe.length?Math.min(...foe.map(e=>hd(h,hexOf(e)))):0)+h.c*.5;
    if(sc>bs){bs=sc;
    best=k;
    }}if(best){doMove(u,best,'sail');
    render();
    await sleep(200);
    }return;
    } // 失去戰鬥能力：往東撤離
  const rc=reach(u),tw=Object.values(TER).filter(h=>h.isl==='TW'&&h.coastal);
  const foe=S.units.filter(e=>e.side==='atk'&&atSea(e));
  // 有共軍水面艦隊時：待在對方艦射反艦飛彈射程（＋2 格）外，但在自己艦載機的打擊距離內；沒有時：維持在台灣東岸外約 6 格
  const thr=foe.filter(e=>isEsc(e)&&e.mag&&e.mag.asm>0),reachR=CVW.US.r+CVW.US.asmR-2;
  const sc=k=>{const h=TER[k],ag=cvAggr(u,h);
    if(thr.length){const dn=Math.min(...foe.filter(e=>isShip(e)).map(e=>hd(h,hexOf(e))));return thr.reduce((a,e)=>a+Math.max(0,SHIPW[e.type].asmR+kmH(40)-hd(h,hexOf(e))),0)*3+Math.max(0,dn-reachR)+Math.min(...tw.map(t=>hd(h,t)))*.02+ag;}
    const d=Math.min(...tw.map(t=>hd(h,t)));return Math.abs(d-kmH(120))+foe.reduce((a,e)=>a+Math.max(0,kmH(80)-hd(h,hexOf(e))),0)*.8+ag;};
  let best=null,bs=sc(K(u.c,u.r))-.3;
  for(const [k,v] of rc){if(v.kind!=='sail')continue;const t=sc(k);if(t<bs){bs=t;best=k;}}
  if(best){doMove(u,best,'sail');render();await sleep(200);}
}
// 反航母打擊（A 方案，數字皆為推估）：每回合最多 2 枚反艦彈道飛彈（東風-21D／26），每枚耗用 1 點火箭軍存量
