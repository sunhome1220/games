'use strict';
/* 主地圖上的基地繪製（自 render.js 拆出） */
/* ---------- 基地直接畫在主地圖上：大陸基地（火箭軍、空軍、海軍、集結港）與美日基地，可直接點選打擊，不必切到戰區圖 ---------- */
const HIDEFAR=new Set(['嘉手納','宮古島','佐世保','關島','黃山','梅州','舟山']); // 這些外圍地標改由基地標記取代
let BPX=null;
function basePx(){
  if(BPX)return BPX;BPX={};
  for(const [id,B] of Object.entries(CNB)){const [x,y]=llPx(B.lon,B.lat);BPX['c'+id]=[x,y];}
  const bm={okinawa:'嘉手納',sakishima:'宮古島',sasebo:'佐世保',guam:'關島'};
  for(const [b,n] of Object.entries(bm)){const f=FAR[n];if(f)BPX['b'+b]=[f.x*KS,f.y*KS];}
  const [sx,sy]=oCenter(19,9);BPX.bsea=[sx*KS,sy*KS];
  return BPX;
}
// 基地標籤：機場上有部隊時點不到機場，所以每座台澎機場在附近的空格（優先海上）放一個可點的長方形標籤，用細線連回機場
function baseTagsSVG(){
  let o='';const used=new Set();
  for(const h of airfields()){
    const fs0=8.5*Math.max(.72,SC),tw=((h.name||'機場').replace(/(基地|機場)$/,'').length+1.6)*fs0+8,th=fs0+7;
    const unitOn=k=>S.units.some(u=>K(u.c,u.r)===k&&!subHidden(u)&&!(u.ship&&atSea(u)));
    const seen=new Set([h.k]);let q=[h],cand=[];
    for(let d=1;d<=6&&q.length;d++){const nx=[];for(const a of q)for(const n of nbrs(a.c,a.r)){if(!n||seen.has(n.k))continue;seen.add(n.k);nx.push(n);
        if(n.t!=='sea'||used.has(n.k)||unitOn(n.k))continue; // 只放海上、不和單位或其他標籤重疊（海上有單位時自動換位）
        const nb=nbrs(n.c,n.r).filter(Boolean),landN=nb.filter(m=>isLand(m)).length,busy=nb.filter(m=>unitOn(m.k)||used.has(m.k)).length;
        const [cx,cy]=cen(n.c,n.r),near=[...nb];for(const m of nb)for(const z of nbrs(m.c,m.r))if(z&&!near.includes(z))near.push(z);
        const side=near.filter(m=>{if(!isLand(m))return false;const [mx,my]=cen(m.c,m.r);return Math.abs(mx-cx)<tw/2+R*.75&&Math.abs(my-cy)<th/2+R*.75;}).length; // 標籤比一格寬：用實際的長方形範圍檢查會不會壓到陸地
        cand.push([n,d+landN*.5+side*3+busy*.8]);} // 標籤比一格寬：旁邊是陸地或有單位的格子扣分，盡量放在開闊海面
      q=nx;}
    cand.sort((a,b)=>a[1]-b[1]||a[0].r-b[0].r||a[0].c-b[0].c);
    const t=cand.length?cand[0][0]:h;used.add(t.k);
    const [x0,y0]=cen(h.c,h.r),[x,y]=cen(t.c,t.r),fs=8.5*Math.max(.72,SC),nm=(h.name||'機場').replace(/(基地|機場)$/,''),w=(nm.length+1.6)*fs+8,hh=fs+7,own=S.owner[h.k]==='atk';
    if(t!==h)o+='<line class="btl'+(own?' lost':'')+'" x1="'+x0.toFixed(1)+'" y1="'+y0.toFixed(1)+'" x2="'+x.toFixed(1)+'" y2="'+y.toFixed(1)+'"/>';
    o+='<g class="btag'+(own?' lost':'')+'" data-base="'+h.k+'" data-x="'+x.toFixed(1)+'" data-y="'+y.toFixed(1)+'">'+
      '<rect x="'+(x-w/2).toFixed(1)+'" y="'+(y-hh/2).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+hh.toFixed(1)+'" rx="3"/><text x="'+x.toFixed(1)+'" y="'+(y+fs*.36).toFixed(1)+'" text-anchor="middle" font-size="'+fs.toFixed(1)+'">✈'+nm+'</text></g>';
  }
  return o;
}
function baseMarkersSVG(){
  const P=basePx(),strikeOn=humanTurn()&&S.phase==='atk'&&S.mode==='strike',dOn=(humanTurn()&&S.phase==='def'&&S.mode==='strike'&&S.dfire>0&&lrOK())||tomOn();
  let o='';
  for(const [id,B] of Object.entries(CNB)){
    const pt=P['c'+id];if(!pt)continue;const [x,y]=pt,hp=cnShown(id),tg=dOn&&cnTargets().includes(id);
    const shape=B.kind==='rf'?'<polygon class="mcb" points="0,-10 10,0 0,10 -10,0"/>':B.kind==='air'?'<polygon class="mcb" points="0,-9 9,7 -9,7"/>':B.kind==='navy'?'<rect class="mcb" x="-8" y="-8" width="16" height="16"/>':B.kind==='isr'?'<polygon class="mcb" points="0,-10 3,-3 10,0 3,3 0,10 -3,3 -10,0 -3,-3"/>':'<circle class="mcb" r="8"/>';
    const pd=(S.cnPend&&S.cnPend.id===id)||(S.afPend&&S.afPend.x.cn===id);
    o+='<g class="mcg'+(hp>0?'':' off')+(pd?' pend':'')+'" data-cn="'+id+'" transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') scale('+US.toFixed(3)+')"><circle r="24" fill="transparent" class="hit"/>'+
        shape+'<text class="mnum" y="4">'+hp+'</text>'+(tg?'<circle class="ttg d" r="16"/>':'')+'<text class="mlb" x="'+(B.side==='l'?-13:13)+'" y="3"'+(B.side==='l'?' text-anchor="end"':'')+'>'+B.n+'</text></g>';
  }
  for(const [b,B] of Object.entries(BASES)){
    const pt=P['b'+b];if(!pt)continue;const [x,y]=pt,us=S.fx.units.filter(f=>f.base===b),live=us.filter(f=>f.hp>0).length,act=us.some(fxActive),tg=strikeOn&&baseTargets(b).length;
    o+='<g class="mbg" data-b="'+b+'" transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+') scale('+US.toFixed(3)+')"><circle r="24" fill="transparent" class="hit"/><circle class="mbd '+
        B.c.toLowerCase()+(act?' on':'')+'" r="10"/><text class="mnum'+(act?' w':'')+'" y="4">'+live+'</text>'+(tg?'<circle class="ttg" r="16"/>':'')+'<text class="mlb" x="14" y="4">'+B.n+'</text></g>';
  }
  return o;
}
// 射程圈的線寬與文字大小固定為螢幕像素（地圖整張放大時不跟著變粗、變大）：--ik＝1／（每個座標單位的螢幕像素數）
function ringScaleSync(){const m=document.querySelector('#map');if(!m)return;let k=1;try{const c=m.getScreenCTM();k=c&&c.a>0?c.a:1;}catch(e){}
  const ik=(1/k).toFixed(4);if(m.__ik!==ik){m.__ik=ik;m.style.setProperty('--ik',ik);}}
function textZoomFix(){ringScaleSync(); // 放大到 500% 以上時，地名、浪高等文字以自己的座標為中心縮小（不用 CSS transform-box：iOS Safari 對 SVG 文字支援不完整，會跑位）
  const k=typeof ZOOM!=='undefined'&&ZOOM>5?5/ZOOM:1;
  document.querySelectorAll('#map .lbl,#map .wxl,#map .mport,#map .big,#map .fxt,#map .btag,#map .ltg').forEach(e=>{if(k===1){if(e.__tz){e.removeAttribute('transform');e.__tz=0;}return;}const x=+
      (e.getAttribute('x')||e.getAttribute('data-x'))||0,y=+(e.getAttribute('y')||e.getAttribute('data-y'))||0;e.setAttribute('transform','translate('+x+' '+y+') scale('+
      k.toFixed(4)+') translate('+(-x)+' '+(-y)+')');e.__tz=1;});
}
// 地圖動態層：攻方占領區、灘頭堡、可移動範圍
function mapOverlaySVG(){let o='';
  for(const h of terList('landNotCN',h=>isLand(h)&&h.isl!=='CN')){
    if(S.owner[h.k]!=='atk')continue;
    const [x,y]=cen(h.c,h.r);o+='<polygon class="ov-atk" points="'+hexPts(x,y,R-1)+'"/>';
  }
  for(const h of terList('tw',h=>h.isl==='TW')){ // 次要港口 ⚓ 與灘頭堡外框
    const mp=MINOR_PORTS[h.k],bh=S.bh&&S.bh[h.k]&&S.turn-S.bh[h.k]>=1&&S.owner[h.k]==='atk';if(!mp&&!bh)continue;
    const [x,y]=cen(h.c,h.r);if(bh)o+='<polygon class="ov-bh" points="'+hexPts(x,y,R-3)+'"/>';
  }
  if(humanTurn()&&S.sel&&alive(S.sel)&&S.sel.side===S.phase){
    for(const [k,v] of reach(S.sel)){const [x,y]=cen(TER[k].c,TER[k].r);o+='<polygon class="hl '+v.kind+'" points="'+hexPts(x,y,R-2)+'"/>';}
  }
  return o;}
// 射程圈、棋子、潛艦上次發現點
function mapUnitsSVG(){let o='',smk='';RNG_LEG=[];
  {const iu=S.sel&&alive(S.sel)?S.sel:(S.hoverId?S.units.find(x=>x.id===S.hoverId):null); // 射程圈：一鍵全開時畫雙方所有航艦艦隊；點選（或游標停在）艦艇時畫該艦
   if(S.started&&RNG_ALL)S.units.filter(x=>(x.type==='cv'||x.type==='csg'||x.type==='ddh'||x.type==='sam')&&alive(x)&&x!==iu).forEach(x=>{o+=rangeRingsSVG(x,true);});
   if(S.started&&iu&&(iu.type==='cv'||iu.type==='csg'||iu.type==='ddh'||isEsc(iu)||iu.fl||iu.type==='dd'||iu.type==='sam')&&!subHidden(iu))o+=rangeRingsSVG(iu,false);
   if(S.started){const bk=(S.mode==='afS'||S.mode==='afL'||S.mode==='afC')&&S.afK?S.afK:!iu&&S.baseSel&&S.baseSel===S.hover?S.baseSel:null;if(bk)o+=baseRingsSVG(bk);}
   if(S.started)o+=heliRangeSVG();
   rngLegSync();}
  S.units.filter(u=>!subHidden(u)&&!(u.ship&&atSea(u))&&!u.dropHide).concat([...GHOSTS.values()]).sort((a,b)=>cen(a.c,a.r)[1]-cen(b.c,b.r)[1]).forEach(u=>{const p=unitSVG(u,true).split('\u0001');o+=p[0];if(p[1])smk+=p[1];});
  o+=smk;
  // 潛艦「上次發現點」：目前沒被發現的潛艦，只在地圖上留下最後被發現的位置（淡虛線圈與回合數）
  // 潛艦「上次發現點」：淡淡的潛艦剪影＋小標籤「T 回合」，越久越淡；完整說明放在 title（滑鼠停留）
  S.units.filter(u=>subHidden(u)&&u.last&&S.turn-u.last.turn<=6).forEach(u=>{const p=cen(u.last.c,u.last.r),k=US/(16/26*1.18),age=S.turn-u.last.turn,op=Math.max(.35,.8-age*.08),c=u.side==='atk'?'#c0392b':'#3f7fd0';
    o+='<g class="lastseen" opacity="'+op.toFixed(2)+'" transform="translate('+p[0].toFixed(1)+' '+p[1].toFixed(1)+') scale('+(k*1.3).toFixed(3)+')"><title>'+TX('潛艦上次被發現的位置')+'（第 '+u.last.turn+' 回合）</title>'+
      '<path d="M-11 2q0-5 6-5h10q7 0 7 5t-7 5h-10q-6 0-6-5zM-2-3v-3h4v3" fill="none" stroke="'+c+'" stroke-width="1.4" stroke-dasharray="3 2" stroke-linejoin="round"/>'+
      '<rect x="-9" y="9" width="18" height="9" rx="4.5" fill="var(--panel,#fff)" stroke="'+c+'" stroke-width=".8" opacity=".9"/><text x="0" y="15.8" text-anchor="middle" font-size="6.5" font-weight="700" fill="'+c+'">T'+u.last.turn+'</text></g>';});
  return o;}
// 次要港口、水雷、機場與港口損毀、影片焦點
function mapMarksSVG(){let o='';
  for(const k of Object.keys(MINOR_PORTS)){const h=TER[k];if(!h)continue;const [x,y]=cen(h.c,h.r);o+='<text class="mport" style="font-size:'+(14*Math.max(.55,SC)).toFixed(1)+'px" x="'+(x+R*.7).toFixed(1)+'" y="'+(y-R*.35).toFixed(1)+'">⚓</text>';} // 次要港口標記畫在單位之上
  Object.keys(S.mines||{}).forEach(k=>{const h=TER[k];if(!h)return;const [x,y]=cen(h.c,h.r);o+='<g class="mine" pointer-events="none"><circle cx="'+x.toFixed(1)+
      '" cy="'+(y+8).toFixed(1)+'" r="4.5" fill="#222" stroke="#ffd45a" stroke-width="1.2"/><path d="M'+(x-7).toFixed(1)+' '+(y+8).toFixed(1)+'h14M'+x.toFixed(1)+' '+(y+
      1).toFixed(1)+'v14" stroke="#ffd45a" stroke-width="1"/></g>';});
  airfields().forEach(h=>{const lv=afLevel(h.k);if(!lv)return;const [x,y]=cen(h.c,h.r);o+='<text class="fxt af'+lv+'" pointer-events="none" x="'+(x+R*.65).toFixed(1)+
      '" y="'+(y-R*.4).toFixed(1)+'" text-anchor="middle" style="font-size:'+((lv===3?15:12)*Math.max(.55,SC)).toFixed(1)+'px;stroke-width:'+(3*Math.max(.55,SC)).toFixed(1)+
      'px" fill="'+(lv===3?'#c0392b':lv===2?'#e67e22':'#e0a800')+'">'+(lv===3?'✕':'⚠')+'</text>';});
  Object.keys(S.portDown||{}).forEach(k=>{const h=TER[k];if(!h)return;const [x,y]=cen(h.c,h.r);o+='<text class="fxt dead" pointer-events="none" x="'+x.toFixed(1)+'" y="'+(y+4).toFixed(1)+'" text-anchor="middle" font-size="18" fill="#c0392b">✕</text>';});
  (S.focus||[]).forEach(k=>{const h=TER[k];if(!h)return;const [x,y]=cen(h.c,h.r);o+='<ellipse class="vfocus" cx="'+x.toFixed(1)+'" cy="'+(y+4).toFixed(1)+'" rx="17" ry="12"/>';});
  return o;}
// 可攻擊目標圈、已選定目標、出擊中的基地
// 地圖上畫橘圈的目標（棋子＋圈的種類）；手把切換目標也用這份清單
function targetRings(){
  if(!S||!S.started||!humanTurn())return [];
  let rings=[];
    if(S.mode==='strike'){if(S.phase==='atk')rings=S.units.filter(u=>u.side==='def'&&strikeable(u)).map(u=>[u,'strike']);else if(S.phase==='def'&&S.dfire>0&&lrOK())rings=stgTargets().map(u=>[u,'strike']);}
    else if(S.mode==='volley'&&S.sel&&cvOwn(S.sel))rings=volleyTargets(S.sel).map(u=>[u,'strike']);
    else if(S.mode==='afS'||S.mode==='afL'||S.mode==='afC')rings=afRings().map(u=>[u,'strike']);
    else if(S.mode==='hlS'||S.mode==='hlL')rings=heliRings().map(u=>[u,'strike']);
    else if(S.mode==='cvw'&&S.sel&&cvOwn(S.sel)){const I=cvwManualInfo(S.sel);rings=I&&I.n>0?I.foes.map(u=>[u,'strike']):[];}
    else if(S.mode==='cvwL'&&S.sel&&cvOwn(S.sel)){const I=cvwManualLandInfo(S.sel);rings=I&&I.n>0?I.tg.filter(x=>x.u).map(x=>[x.u,'strike']):[];}
    else if(S.sel&&alive(S.sel)&&S.sel.side===S.phase)rings=targets(S.sel).map(u=>[u,isGndAtk(S.sel)&&isArtShot(S.sel,u)?'art':'']);
  return rings.filter(([u])=>!subHidden(u)&&!(u.ship&&atSea(u))); // 地圖上沒畫出來的單位（船上的旅、隱蔽的潛艦）不畫圈
}
function mapTargetsSVG(){let o='';
  if(humanTurn()){
    const rings=targetRings();
    const rf=US/(16/26*1.18); // 目標圈跟著棋子大小縮放
    rings.forEach(([u,c])=>{const [x0,y0]=cen(u.c,u.r),[sx,sy]=stackPos(u),x=x0+sx,y=y0+sy;o+='<circle class="ring '+c+'" cx="'+x+'" cy="'+y+'" r="'+(15*rf).toFixed(1)+'" style="stroke-width:'+(2.5*Math.max(.6,rf)).toFixed(1)+'px"/>';});
    // 已選定的目標：粗的實線圈＋十字；空軍出擊中的基地：藍色實線圈
    const pu=S.cnPend&&S.cnPend.u?S.units.find(x=>x.id===S.cnPend.u):S.afPend&&(S.afPend.x.u||S.afPend.x.stg)?S.units.find(x=>x.id===(S.afPend.x.u||S.afPend.x.stg)):null;
    if(pu&&alive(pu)){const [x0,y0]=cen(pu.c,pu.r),[sx,sy]=stackPos(pu),x=x0+sx,y=y0+sy,r=19*rf,w=Math.max(1.5,3.5*rf);
      o+='<g class="pendmk" pointer-events="none"><circle cx="'+x+'" cy="'+y+'" r="'+r.toFixed(1)+'" fill="none" stroke="#e8b400" stroke-width="'+w.toFixed(1)+'"/><path d="M'+
          (x-r*1.35)+' '+y+'h'+(r*.55)+'M'+(x+r*.8)+' '+y+'h'+(r*.55)+'M'+x+' '+(y-r*1.35)+'v'+(r*.55)+'M'+x+' '+(y+r*.8)+'v'+(r*.55)+'" stroke="#e8b400" stroke-width="'+w.toFixed(1)+'"/></g>';
      }
    if((S.mode==='afS'||S.mode==='afL'||S.mode==='afC')&&S.afK&&TER[S.afK]){const [x,y]=cen(TER[S.afK].c,TER[S.afK].r);o+='<circle pointer-events="none" cx="'+x+'" cy="'+y+'" r="'+(R*1.05).toFixed(1)+'" fill="none" stroke="var(--def)" stroke-width="'+Math.max(1.5,3*rf).toFixed(1)+'"/>';}
  }
  return o;}
// 棋子移動的滑動動畫、新棋子淡入
function animateUnitSlides(){
  // slide units that moved since the previous render, pop in new ones
  const now=new Map(),k=fxK();ANIM.slid=false;
  document.querySelectorAll('#gD .u[data-id]').forEach(e=>{
    const id=+e.dataset.id,x=+e.dataset.x,y=+e.dataset.y;now.set(id,[x,y]);
    if(!ANIM.ok||ANIM.gid!==S.gid||reduce())return;
    const p=ANIM.pos.get(id);
    if(p){const dx=p[0]-x,dy=p[1]-y,dd=Math.hypot(dx,dy);if(dd>1&&dd<W*8){ANIM.slid=true;e.animate([{transform:'translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)'},{transform:'translate(0,0)'}],{duration:280*k,easing:'cubic-bezier(.2,.7,.2,1)'});}}
    else if(ANIM.pos.size)e.animate([{opacity:0,transform:'translateY(-14px)'},{opacity:1,transform:'translateY(0)'}],{duration:360*k,easing:'ease-out'});
  });
  ANIM.pos=now;ANIM.gid=S.gid;
}
function renderMap(){
  if(!STATIC.built)buildStatic();
  updateCsg();
  let o='';
  o+=mapOverlaySVG();
  o+=mapUnitsSVG();
  o+=facSVG();
  o+=wxMapSVG();
  o+=ghostFleetsSVG();
  o+=baseMarkersSVG();
  o+=baseTagsSVG();
  o+=mapMarksSVG();
  o+=mapTargetsSVG();
  o+=landTagsSVG(); // 登陸提示標籤（landtips.js）
  o+=heloRingSVG();
  $('#gD').innerHTML=o;
  if(typeof landTipsSync==='function')landTipsSync();
  // 選了己方單位、正要下移動命令時：機場標籤變半透明且不能點，不然標籤蓋在海上的目標格上會點不到（點基地改看資訊要先取消選取）
  {const mv=!!(S.started&&S.sel&&alive(S.sel)&&S.sel.side===S.phase&&!S.mode&&humanTurn()&&reach(S.sel).size>0);$('#map').classList.toggle('mvsel',mv);}
  landmarkDim();
  animateUnitSlides();
}
