'use strict';
/* ---------- effects ---------- */
const FXQ=[];
const SVGNS='http://www.w3.org/2000/svg';
let PREVIEW=false;
const fxq=o=>{if(!PREVIEW)FXQ.push(o);};
const reduce=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
let FXSPD=1;const fxK=()=>((S&&S.video&&V.sp)?Math.max(.2,1/V.sp):1)/FXSPD; // 動畫速度設定：0.5／1／2／4 倍
function el(tag,at,parent){const e=document.createElementNS(SVGNS,tag);for(const k in at)e.setAttribute(k,at[k]);if(!parent)e.__t=performance.now();(parent||document.getElementById('gF')).appendChild(e);return e;}
function tween(ms,fn,end){ms*=fxK();const t0=performance.now();(function f(t){const k=Math.min(1,Math.max(0,(t-t0)/ms));fn(k);if(k<1)requestAnimationFrame(f);else if(end)end();})(t0);}
function bez(a,c,b,t){const u=1-t;return [u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]];}
function fxFlash(p,r1,r2,col,ms,par){const e=el('circle',{cx:p[0],cy:p[1],r:r1,fill:col,opacity:.9},par);tween(ms,k=>{e.setAttribute('r',r1+(r2-r1)*k);e.setAttribute('opacity',.9*(1-k));},()=>e.remove());}
function fxRing(p,r1,r2,col,ms,w,par){const e=el('circle',{cx:p[0],cy:p[1],r:r1,fill:'none',stroke:col,'stroke-width':w||2},par);tween(ms,k=>{e.setAttribute('r',r1+(r2-r1)*k);e.setAttribute('opacity',1-k);},()=>e.remove());}
function fxSparks(p,n,len,col,ms){const ls=[];for(let i=0;i<n;i++)ls.push([el('line',{stroke:col,'stroke-width':2,'stroke-linecap':'round'}),Math.PI*2*i/n+NR()*.6]);
  tween(ms,k=>{ls.forEach(([l,a])=>{const r0=4+len*k*.55,r1=4+len*k;l.setAttribute('x1',p[0]+Math.cos(a)*r0);l.setAttribute('y1',p[1]+Math.sin(a)*r0*.8);l.setAttribute('x2',p[0]+Math.cos(a)*r1);l.setAttribute('y2',p[1]+Math.sin(a)*r1*.8);l.setAttribute('opacity',1-k);});},()=>ls.forEach(([l])=>l.remove()));}
function fxText(p,s,cls,ms){const f=Math.max(.6,SC),t=el('text',{x:p[0],y:p[1]-18*f,class:'fxt '+cls,'text-anchor':'middle',style:'font-size:'+(13*f).toFixed(1)+'px;stroke-width:'+(3*f).toFixed(1)+'px'});t.textContent=s; // 字級隨格子大小縮放
  tween(ms||950,k=>{t.setAttribute('y',p[1]-18*f-18*f*k);t.setAttribute('opacity',k<.65?1:1-(k-.65)/.35);},()=>t.remove());}
function fxImpact(p,hit,sea,big){
  if(hit){fxFlash(p,3,big?26:16,'#ffb347',380);fxFlash(p,2,big?14:9,'#fff3c4',260);fxRing(p,4,big?32:21,'#ff7a3d',440,2.5);fxSparks(p,big?10:6,big?28:17,'#ffd45a',440);}
  else if(sea){fxRing(p,3,17,'#ffffff',560,2);fxRing(p,2,10,'#cfeaf5',440,1.5);}
  else fxFlash(p,3,13,'#cfc7ae',440);
}
let PUFFN=0; // 同時存在的煙團數量上限，避免齊射時節點太多
function fxPuff(p,r1,r2,col,op,ms){
  if(PUFFN>(LITE?40:150))return;PUFFN++;
  const e=el('circle',{cx:p[0],cy:p[1],r:r1,fill:col,stroke:'#8a8f96','stroke-width':.5,'stroke-opacity':.5,opacity:op});
  tween(ms,k=>{e.setAttribute('r',r1+(r2-r1)*Math.sqrt(k));e.setAttribute('cx',p[0]+k*3);e.setAttribute('cy',p[1]-k*5);e.setAttribute('opacity',op*(1-k)*(1-k));},()=>{e.remove();PUFFN--;});
}
// 各武器的造型（彈體朝 +x）：彈道飛彈細長大尾焰並留煙、高超音速滑翔體是楔形無尾焰、巡弋飛彈有翼、反艦飛彈短翼、火箭短小、空對空細小、防空飛彈細長、導引炸彈有尾翼無尾焰、無人機三角翼
const FXSHAPE={
  bm:{d:'M7,0L4,-1L-5,-1L-6.2,-2.6L-7.2,-2.6L-6.8,0L-7.2,2.6L-6.2,2.6L-5,1L4,1Z',fl:1,puff:1,glow:5.5},
  hs:{d:'M6.5,0L-5,-3L-3.6,0L-5,3Z',fl:0,glow:4,glowO:.4,seg:9,tail:4},
  cm:{d:'M5.5,0L3,-.9L-.5,-.9L-1.6,-3.6L-2.6,-3.6L-2.2,-.9L-5,-.9L-5.8,-2.1L-6.4,-2.1L-6,0L-6.4,2.1L-5.8,2.1L-5,.9L-2.2,.9L-2.6,3.6L-1.6,3.6L-.5,.9L3,.9Z',fl:.45,glow:3.5,tail:6},
  asm:{d:'M5.5,0L3,-1L-4.6,-1L-5.6,-2.4L-6.4,-2.4L-6,0L-6.4,2.4L-5.6,2.4L-4.6,1L3,1Z',fl:.55,glow:3.5,tail:6},
  rkt:{d:'M4.5,0L2.8,-.75L-4.2,-.75L-5,-1.7L-5.5,-1.7L-5.2,0L-5.5,1.7L-5,1.7L-4.2,.75L2.8,.75Z',fl:.7,puff:1,glow:3,tail:5,s:.9},
  aam:{d:'M5,0L3.4,-.55L-3.6,-.55L-4.4,-1.6L-4.9,-1.6L-4.6,0L-4.9,1.6L-4.4,1.6L-3.6,.55L3.4,.55Z',fl:.45,glow:2.5,tail:4.6,seg:5},
  sam:{d:'M6,0L4,-.7L-4.6,-.7L-5.4,-2L-6,-2L-5.6,0L-6,2L-5.4,2L-4.6,.7L4,.7Z',fl:.75,glow:3.5,tail:5.6},
  bomb:{d:'M4,0Q3.2,-1.5 .6,-1.5L-2.6,-1.5L-3.8,-2.8L-4.6,-2.8L-4.2,0L-4.6,2.8L-3.8,2.8L-2.6,1.5L.6,1.5Q3.2,1.5 4,0Z',fl:0,glow:2,glowO:.1,seg:3},
  drone:{d:'M3,0L-3.2,-4.2L-2.2,0L-3.2,4.2Z',fl:0,glow:2.5,glowO:.15,seg:4}};
function fxShot(a,b,o){
  const c=[(a[0]+b[0])/2,(a[1]+b[1])/2-(o.arc||0)];
  const dx=b[0]-a[0],dy=b[1]-a[1],dl=Math.hypot(dx,dy)||1,nx=-dy/dl,ny=dx/dl; // 擺動沿著飛行方向的垂直線，不再只改 y（否則近乎垂直飛行時會變成忽快忽慢的抖動）
  const wb=(p,k)=>{if(o.wob){const w=Math.sin(k*Math.PI*(o.wf||5))*o.wob*Math.sin(k*Math.PI);p[0]+=nx*w;p[1]+=ny*w;}return p;};
  const at=k=>wb(bez(a,c,b,Math.min(1,Math.max(0,k))),Math.min(1,Math.max(0,k)));
  if(o.style==='mis'){ // 飛彈：彈體朝飛行方向、尾焰閃動、漸細的尾跡與持續擴散的煙團
    const sh=FXSHAPE[o.shape]||FXSHAPE.asm,sz=(o.r||3)/2.8*.9*(sh.s||1),big=(o.arc||0)>60,g=el('g',{});
    const SEG=sh.seg||7,segs=[];for(let i=0;i<SEG;i++)segs.push(el('line',{'stroke-linecap':'round'}));
    el('circle',{r:(sh.glow||5)*sz,fill:o.trail||'#ffb347',opacity:sh.glowO||.2},g);
    const flame=el('path',{fill:sh.flameC||'#ff8a1f'},g),core=el('path',{fill:'#fff6c0'},g);
    el('path',{d:sh.d,fill:o.color||'#eee',stroke:'#3a3a3a','stroke-width':.45},g);
    let lastPuff=0;const gap=(LITE?95:big?32:42)*fxK();
    tween(o.dur||300,k=>{
      const p=at(k),q=at(Math.max(0,k-.04)),ang=Math.atan2(p[1]-q[1],p[0]-q[0])*180/Math.PI;
      g.setAttribute('transform','translate('+p[0].toFixed(1)+' '+p[1].toFixed(1)+') rotate('+ang.toFixed(1)+') scale('+sz.toFixed(2)+')');
      const fs=sh.fl==null?1:sh.fl,fl=(7+NR()*6)*fs,fw=(2.6+NR()*.8)*Math.max(.4,fs),tx=sh.tail||7;
      if(fs>0){flame.setAttribute('d','M-'+tx+',0L-'+(tx+fl)+','+(-fw*.35)+'L-'+(tx+fl*.6)+',0L-'+(tx+fl)+','+(fw*.35)+'Z M-'+tx+','+(-fw)+'Q-'+(tx+fl*.8)+',0 -'+tx+','+fw+'Z');
        core.setAttribute('d','M-'+tx+','+(-1.3*fs)+'Q-'+(tx+fl*.55)+',0 -'+tx+','+(1.3*fs)+'Z');}
      for(let i=0;i<SEG;i++){ // 尾跡：靠近彈體偏尾焰色，往後漸變成灰白煙並逐漸變細
        const k1=k-i*.035,k2=k-(i+1)*.035;if(k2<-.05){segs[i].setAttribute('opacity',0);continue;}
        const u=at(k1),v=at(k2),f=i/SEG;
        segs[i].setAttribute('x1',u[0].toFixed(1));segs[i].setAttribute('y1',u[1].toFixed(1));segs[i].setAttribute('x2',v[0].toFixed(1));segs[i].setAttribute('y2',v[1].toFixed(1));
        segs[i].setAttribute('stroke',f<.3?(o.trail||'#ffb347'):'#e6e6e6');segs[i].setAttribute('stroke-width',((o.w||2)*(1.15-f*.85)).toFixed(2));segs[i].setAttribute('opacity',(.8*(1-f)).toFixed(2));
      }
      const now=performance.now();
      if(sh.puff&&!reduce()&&now-lastPuff>gap&&k>.03&&k<.97){lastPuff=now;fxPuff(at(k-.025),1.5*sz+.5,(big?7:4.6)*sz+2,'#f0f0f0',big?.8:.65,(big?1200:820));}
    },()=>{g.remove();segs.forEach(x=>x.remove());if(o.end)o.end();});
    return;
  }
  const dot=el('circle',{r:o.r||3,fill:o.color||'#ffe08a'}),trail=el('path',{fill:'none',stroke:o.trail||'#ffb347','stroke-width':o.w||2,'stroke-linecap':'round',opacity:.85});
  tween(o.dur||300,k=>{const p=at(k),q=at(k-.28);dot.setAttribute('cx',p[0]);dot.setAttribute('cy',p[1]);trail.setAttribute('d','M'+q[0].toFixed(1)+','+q[1].toFixed(1)+'L'+p[0].toFixed(1)+','+p[1].toFixed(1));},()=>{dot.remove();trail.remove();if(o.end)o.end();});
}
// 依軍種的彈道／航跡：弧形彈道飛彈、貼海面巡弋飛彈、轟炸機投彈、潛艦魚雷、無人機
// 動畫速度與真實速度成正比：同一比例尺（★真實 1 秒＝動畫 3 毫秒），最短 0.18 秒（太快看不到）、最長 3.5 秒（魚雷、無人機會被這個上限截短）
// 平均速度（m/s，概略）：東風-17 滑翔體 ~2500（約 7 馬赫）、短程彈道飛彈 ~2000（約 6 馬赫）、防空飛彈 ~1500、空對空飛彈 ~1300、陸軍戰術飛彈 ~1000、
// 火箭 ~900、砲彈 ~800、次音速反艦飛彈 ~280、導引炸彈 ~280、戰機 ~250、巡弋飛彈 ~250、無人機與巡飛彈 ~60、重型魚雷 ~25（約 50 節）
const FXV={hs:2500,bm:2000,sam:1500,aam:1300,atc:1000,rkt:900,arty:800,asm:280,bomb:280,plane:250,cm:250,drone:60,torp:25},FX_SEC=3;
function fxDur(k,dPx){const km=dPx/(HPX/KM_HEX);return Math.max(180,Math.min(3500,km*1000/(FXV[k]||300)*FX_SEC));}
function fxFlight(a,b,k,end){
  const dd=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(k==='hs'){ // 東風-17：推進段像彈道飛彈往上爬，分離後換成高超音速滑翔體，以較平的彈道、左右機動衝向目標（電漿層高溫：橘白色熱光）
    const T=fxDur('hs',dd),mid=[a[0]+(b[0]-a[0])*.38,a[1]+(b[1]-a[1])*.38-Math.min(110,dd*.32+30)];
    fxFlash(a,3,14,'#fff',260);
    fxShot(a,mid,{arc:Math.min(40,dd*.1+10),dur:T*.4,color:'#f2f2f2',trail:'#ff9a3c',w:2.8,r:3.4,style:'mis',shape:'bm',end:()=>{
      fxFlash(mid,2,10,'#ffe6c4',260);fxShot(mid,b,{arc:-6,dur:T*.6,color:'#f6e7d4',trail:'#ffb070',w:1.8,r:3.2,wob:5,wf:2,style:'mis',shape:'hs',end});}});
  }else if(k==='bm'){
    fxFlash(a,3,14,'#fff',260);fxSmoke(a,b,Math.min(200,dd*.5+60),5,fxDur('bm',dd));
    fxShot(a,b,{arc:Math.min(200,dd*.5+60),dur:fxDur('bm',dd),color:'#f2f2f2',trail:'#ff9a3c',w:3.2,r:3.6,style:'mis',shape:'bm',end});
  }else if(k==='cm'||k==='asm'){ // 巡弋飛彈（有翼、對地）／反艦飛彈（短翼、掠海、藍灰尾跡）
    fxFlash(a,2,8,'#fff',200);
    fxShot(a,b,{arc:k==='asm'?3:8,dur:fxDur(k,dd),color:k==='asm'?'#dbe6ef':'#e8f4ff',trail:k==='asm'?'#8fbfe0':'#ffb45a',w:1.6,r:2.8,style:'mis',shape:k,end}); // 巡弋飛彈貼海面直飛，不再蛇行（蛇行會讓彈體與尾跡看起來一直抖動）
  }else if(k==='torp'){
    fxRing(a,2,10,'#cfeaf5',420,1.5);
    const n=Math.max(4,Math.round(dd/22)),du=fxDur('torp',dd);
    for(let i=1;i<=n;i++)setTimeout(()=>{const t=i/(n+1),p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+Math.sin(t*9)*2.5];fxRing(p,1,5,'#d8f4ff',460,1.2);},du*i/(n+1)*fxK());
    fxShot(a,b,{arc:0,dur:du,color:'#9fe6ff',trail:'#5fb4e0',w:1.6,r:2.4,wob:2.6,wf:10,end:()=>{fxRing(b,3,26,'#bfeaff',620,2.5);fxFlash(b,2,12,'#e8fbff',360);if(end)end();}});
  }else if(k==='drone'){
    fxShot(a,b,{arc:-10,dur:fxDur('drone',dd),color:'#c8b26a',trail:'#a8946a',w:1,r:2.4,wob:9,wf:3,style:'mis',shape:'drone',end}); // 無人機與巡飛彈：有機身形狀
  }else if(k==='arty'){
    fxFlash(a,2,9,'#ffe08a',160);
    fxShot(a,b,{arc:Math.min(46,dd*.4+14),dur:fxDur('arty',dd),color:'#ffe08a',trail:'#ffb347',w:2,r:2.4,end});
  }else{ // 'bomb'：飛機低空飛過、投下炸彈
    const ang=Math.atan2(b[1]-a[1],b[0]-a[0]),rel=[a[0]+(b[0]-a[0])*.72,a[1]+(b[1]-a[1])*.72-14];
    const pl=airGlyph('bm','#e9edf0',{glow:true});pl.querySelectorAll('path[stroke]').forEach(q=>q.setAttribute('stroke','#555'));pl.setAttribute('data-sc','1');
    tween(fxDur('plane',dd*.72),t=>{const x=a[0]+(rel[0]-a[0])*t,y=a[1]+(rel[1]-a[1])*t;pl.setAttribute('transform','translate('+x.toFixed(1)+' '+y.toFixed(1)+') rotate('+(ang*180/Math.PI).toFixed(0)+') scale(.85)');},()=>{
      fxShot(rel,b,{arc:-4,dur:fxDur('bomb',Math.hypot(b[0]-rel[0],b[1]-rel[1])),color:'#4a4a4a',trail:'#9aa0a6',w:.8,r:2.4,style:'mis',shape:'bomb',end});
      // 投彈後調頭，飛回出發的航艦或機場，快到時才淡出（降落）
      const bk=Math.atan2(a[1]-rel[1],a[0]-rel[0]);tween(fxDur('plane',Math.hypot(a[0]-rel[0],a[1]-rel[1])),t=>{const x=rel[0]+(a[0]-rel[0])*t,y=rel[1]+(a[1]-rel[1])*t;pl.setAttribute('transform','translate('+x.toFixed(1)+' '+y.toFixed(1)+') rotate('+(bk*180/Math.PI).toFixed(0)+') scale(.85)');pl.setAttribute('opacity',t<.85?1:Math.max(0,1-(t-.85)/.15));},()=>pl.remove()); // 導引炸彈：有彈體、沿落下方向飛（不再是圓球）
    });
  }
}
// 防空攔截動畫：來襲飛彈飛向目標，防空飛彈從目標附近升空迎擊。成功＝空中爆炸、來襲飛彈消失；失敗＝防空彈擦身而過，來襲飛彈照常命中（或落空）
function fxIntercept(s,b,k,mode,hit,tsea,side){
  const dur=(kk,d)=>fxDur(kk==='bomb'?'cm':kk,d);
  const dir=b[0]>=s[0]?1:-1,L=[b[0]-dir*26,b[1]+12],pt=f=>[s[0]+(b[0]-s[0])*f,s[1]+(b[1]-s[1])*f];
  const T=mode==='int'?(q=>[q[0],q[1]-20])(pt(.78)):b;
  const D=dur(k,Math.hypot(T[0]-s[0],T[1]-s[1]));
  const aim=mode==='int'?T:(q=>[q[0]-dir*32,q[1]-56])(pt(.78));
  const cls=side==='atk'?'atk':'def';
  setTimeout(()=>{fxFlash(L,2,9,'#cfefff',220);fxSmoke(L,aim,24,3,D*.5);
    fxShot(L,aim,{arc:-26,dur:D*.55,color:'#d6f3ff',trail:'#6ec6ff',w:1.4,r:2.2,style:'mis',shape:'sam',end:()=>{if(mode!=='int'){fxFlash(aim,2,11,'#6ec6ff',420);fxText(aim,'攔截失敗',cls,950);}}});},D*.45*fxK());
  fxFlight(s,T,k,()=>{
    if(mode==='int'){fxFlash(T,4,30,'#ffe9a8',420);fxFlash(T,2,16,'#fff',300);fxRing(T,5,42,'#6ec6ff',540,2.5);fxSparks(T,12,32,'#ffd45a',520);fxText(T,'攔截成功',cls,1000);}
    else fxImpact(b,hit,tsea,true);
  });
}
if(/[?&]debug=1/.test(location.search))window.__fxIntercept=(...a)=>fxIntercept(...a);
if(/[?&]debug=1/.test(location.search))window.__ext=()=>{const out=[],real=S;
  const tryit=(name,fn)=>{PREVIEW=true;try{S=structuredClone(real);const r=fn();out.push(name+' OK '+(Array.isArray(r)?r.length:''));}catch(e){out.push(name+' ERR '+e.message);}finally{S=real;PREVIEW=false;}};
  EVENTS.forEach(ev=>{if(!ev.choice)return;ev.choice.options.filter(o=>o.x).forEach(o=>{const sp=(ev.dice||[]);for(let r=0;r<(sp.length?3:1);r++)tryit(ev.id+':'+o.id+(sp.length?'#'+r:''),()=>ev.apply(o.id,sp.map(d=>d.rows[Math.min(r,d.rows.length-1)])));});});
  ['atk','def'].forEach(side=>truceOptions(side).opts.filter(o=>o.x).forEach(o=>tryit('truce:'+o.id,()=>applyTruce(side,o))));
  tryit('port',()=>applyPort(PORTS[0],portOptions(PORTS[0]).opts.find(o=>o.x)));
  return out;};
if(/[?&]debug=1/.test(location.search)){window.__cpd={EVENTS,interdictOptions,interdictEval,mkUnit,resolveSupply,conditions,snap,hpCell,cpOf,isShip,onTW,isLch,SPOT,TER,cnHitP,cnValue,cnTargets,stgTargets,CNB,strikeCN,cnShown,render};window.__truceDef=()=>truceOptions('def').opts.map(o=>o.id);window.__instant=()=>checkInstant();window.__hm=(id)=>{const u=S.units.find(z=>z.id===id);const m=[...reach(u).entries()].find(([k,v])=>v.kind==='sail'||v.kind==='move');if(!m)return null;humanMove(u,m[0],m[1].kind);return {avail:undoAvail(),c:u.c,r:u.r};};window.__undo=()=>{const u0=S.undo&&S.units.find(z=>z.id===S.undo.id);undoMove();return u0?{c:u0.c,r:u0.r,moved:u0.moved,avail:undoAvail()}:null;};window.__guard=()=>endPhaseGuard();window.__fxSub=o=>fxSub(o);window.__kill=id=>{const u=S.units.find(z=>z.id===id);if(!u)return null;damage(u,u.hp,'test');render();return GHOSTS.size;};window.__gh=()=>GHOSTS.size;window.__sd=()=>{const u=S.units.find(z=>z.type==='hk');const d=S.units.find(z=>z.type==='dd');if(!u||!d)return null;const rc=[...reach(u).entries()].find(([k,v])=>v.kind==='sail');if(rc){u.c=TER[rc[0]].c;u.r=TER[rc[0]].r;}d.c=u.c;d.r=u.r;let seen=0,hit=0;for(let i=0;i<200;i++){u.revealed=false;u.hp=2;S.log.length=0;subDetect();if(u.revealed)seen++;if(u.hp<2)hit++;}return {seen,hit,atSea:atSea(u)};};window.__hit=(p,n)=>{for(const k in ACC)delete ACC[k];let h=0;for(let i=0;i<n;i++)if(hitP(p,'t'))h++;return h;};window.__wx=()=>({m:S.month,wx:S.mods.wx});window.__wave=(mo,n)=>{const keep=[S.month,S.typhoon,S.waveZ,S.typhoonNew];S.month=mo;S.typhoon=null;S.waveZ=0;let sum=0,hi=0,ty=0,mx=0,prevT=false,ev=0;for(let i=0;i<n;i++){const w=nextWave();sum+=w.wave;if(w.wave>=2.5)hi++;if(w.wave>=5)ty++;mx=Math.max(mx,w.wave);const t=!!S.typhoon||w.wave>=5;if(t&&!prevT)ev++;prevT=t;}[S.month,S.typhoon,S.waveZ,S.typhoonNew]=keep;return {mo,mean:+(sum/n).toFixed(2),pGe25:+(hi/n).toFixed(3),pTyph:+(ty/n).toFixed(3),max:+mx.toFixed(1),typhoonEvents:ev};};window.__cvt=n=>{window.__sup&&window.__sup();S.turn=Math.max(S.turn,3);const out=[];for(let i=0;i<n;i++){convoyTurn();out.push(S.units.filter(u=>u.type==='cvy').map(u=>u.c+','+u.r).join(' '));S.turn++;}return {out,can:S.units.filter(u=>u.type==='cvy').map(u=>canSail(u))};};window.__hkdbg=()=>{const u=S.units.find(z=>z.type==='hk');return {human:humanTurn(),phase:S.phase,busy:S.busy,moved:u.moved,acted:u.acted,reach:[...reach(u).entries()].map(([k,v])=>k+':'+v.kind).slice(0,6),step:hkHomeStep(u)};};window.__hkhome=()=>{const u=S.units.find(z=>z.type==='hk');if(!u)return null;S.sel=u;S.phase='def';S.ctrl.def='human';S.busy=false;u.moved=false;u.acted=false;const b={c:u.c,r:u.r};hkGoHome();return {b,a:{c:u.c,r:u.r},port:hexOf(u).t};};window.__collapse=n=>{S.turn=Math.max(S.turn,4);S.pools.plaLift=0;S.units=S.units.filter(u=>!(u.side==='atk'&&u.type==='cvy'));S.sup={t:S.turn,total:0};const r=[];for(let i=0;i<n&&!S.over;i++){supplyAttrition();r.push(S.stats.supDef);}return {r,over:S.over,used:supply().used};};window.__sup=()=>{const r0=supply().cap;Object.keys(MINOR_PORTS).forEach(k=>{S.owner[k]='atk';});const r1=supply().cap;S.turn=Math.max(S.turn,3);S.bh={};['22,4','19,7','18,10'].forEach(k=>{S.owner[k]='atk';S.bh[k]=S.turn-1;});const r2=supply().cap;render();return [r0,r1,r2];};window.__owner=r=>{const hs=Object.values(TER).filter(h=>h.isl==='TW'&&isLand(h));hs.slice(0,Math.round(hs.length*r)).forEach(h=>{S.owner[h.k]='atk';});return twControl();};window.__wipe=()=>{S.stats.sailed=true;S.turn=Math.max(S.turn,3);S.units=S.units.filter(u=>!(u.side==='atk'&&!isShip(u)&&(atSea(u)||onTW(u)||hexOf(u).isl==='PH')));checkInstant();};window.__attr=()=>{S.turn=Math.max(S.turn,3);const a=S.units.filter(u=>u.side==='atk'&&!isShip(u));const tw=TER[TAIPEI];a.slice(0,18).forEach(u=>{u.c=tw.c;u.r=tw.r;});const b=S.units.filter(u=>u.side==='atk'&&onTW(u)).reduce((x,u)=>x+u.hp,0);supplyAttrition();const c=S.units.filter(u=>u.side==='atk'&&onTW(u)).reduce((x,u)=>x+u.hp,0);return [b,c,supply()];};window.__force3=keep=>{PORTS.concat([TAIPEI]).forEach(k=>{S.owner[k]='atk';delete S.portDown[k];});const tw=TER[TAIPEI];S.units.filter(u=>u.side==='atk'&&!isShip(u)).slice(0,16).forEach(u=>{u.c=tw.c;u.r=tw.r;u.hp=TYPES[u.type].hp;});let left=keep;S.units.filter(u=>u.side==='def'&&onTW(u)).forEach(u=>{if(left>0){u.hp=Math.min(u.hp,left);left-=u.hp;}else S.units=S.units.filter(x=>x!==u);});S.turn=Math.max(S.turn,3);const a=snap();return [a.n,a.as,a.ds];};}
if(/[?&]debug=1/.test(location.search))window.__reach=id=>{const u=S.units.find(x=>x.id===id);if(!u)return null;const h=hexOf(u);return {at:h.k,t:h.t,isl:h.isl,coastal:h.coastal,zones:{pen:ZONES.penghu,sp:SPOT.penghu,mg:SPOT.magong},reach:[...reach(u)].map(([k,v])=>k+':'+v.kind).slice(0,40),moved:u.moved,acted:u.acted};};
if(/[?&]debug=1/.test(location.search))window.__af=()=>({n:airfields().length,names:airfields().map(h=>h.k+':'+(h.name||'')),share:afShare(),rocAir:S.pools.rocAir,pick:pickAirfield()});
if(/[?&]debug=1/.test(location.search))window.__score=async(cfg)=>{ // 測試用：依設定跑一場電腦推演，回傳雙方原始分數
  for(const [k,v] of Object.entries(cfg||{})){const e=document.getElementById(k);if(e)e.value=v;}
  const keep=S;await simRun(true);const m=endScores(),r={A:m.A.total,D:m.D.total,win:(S.result&&S.result.side)||null,US:S.fx.lv.US,JP:S.fx.lv.JP,cvySunk:S.stats.cvySunk||0,arr:S.log.reduce((a,l)=>{const q=/補給船團 (\d+) 個抵達卸貨/.exec(l.msg);return a+(q?+q[1]:0);},0),sent:S.log.reduce((a,l)=>{const q=/攻方派出 (\d+) 個補給船團/.exec(l.msg);return a+(q?+q[1]:0);},0),turn:S.turn,lh:S.log.reduce((h,l)=>{for(const ch of String(l.msg))h=(h*31+ch.charCodeAt(0))|0;return h;},0),uh:S.units.map(u=>u.type+u.hp+'@'+u.c+','+u.r).join(';')};r.uh=[...r.uh].reduce((h,ch)=>(h*31+ch.charCodeAt(0))|0,0);S=keep;return r;}; // lh、uh：戰報與棋子位置的雜湊（重構時比對新舊版是否完全相同）
if(/[?&]debug=1/.test(location.search))window.__sup2=()=>S.sup;
if(/[?&]debug=1/.test(location.search))window.__spd=()=>{const o={};for(const u of S.units)if(atSea(u)||u.type==='hk'){const r=reach(Object.assign({},u,{moved:false,acted:false}));let mx=0;for(const [k,v] of r)if(v.kind==='sail')mx=Math.max(mx,hd(hexOf(u),TER[k]));o[u.type]=Math.max(o[u.type]||0,mx);}return {wx:S.weather.sea,o};};window.__c3={cov:()=>{const u=jmsLead();return adCover(u).map(e=>e.type+':ad'+e.mag.ad+':d'+hd(hexOf(e),hexOf(u)));},jms:()=>{jmsSync();return {on:S.jmsOn,u:S.units.filter(u=>u.ally==='JP').map(u=>u.type+u.hp+'@'+u.c+','+u.r)};},grab:()=>{S.owner[PORTS[0]]='atk';return PORTS[0];},pd:()=>JSON.stringify(S.portDown),tom:async()=>{await usTomahawk();return S.log.slice(0,4).map(l=>l.msg);},fire:()=>{const f=computeFire();return [f,S.fireNote];},sea:()=>{seaBattle();return S.log.slice(0,2).map(l=>l.msg);},det:()=>{subDetect();return S.log.slice(0,3).map(l=>l.msg);},scr:()=>usAswScreen()};window.__cvw={render:()=>render(),plan:()=>{cvwPlan();return S.cvwA;},strike:s=>{cvwStrike(s);return S.log.slice(0,3).map(l=>l.msg);},sync:()=>uscSync(),turn:()=>uscTurn(),car:s=>cvwCarriers(s).map(c=>({t:c.u.type,i:c.i,sor:c.sor,at:c.u.c+','+c.u.r,foes:cvwFoes(s,c).length}))};
if(/[?&]debug=1/.test(location.search))window.__ally={hum:()=>allyHuman(),ph:()=>{const D=S.units.filter(u=>u.side==='def'&&hexOf(u).isl==='PH'),A=S.units.filter(u=>u.side==='atk'&&!isShip(u)&&hexOf(u).isl==='PH');return {t:S.turn,dN:D.length,dHp:D.reduce((a,u)=>a+u.hp,0),dT:D.map(u=>u.type).join(','),aN:A.length,mg:S.owner[MAGONG],pf:!!(S.plan&&S.plan.pfirst),twA:S.units.filter(u=>u.side==='atk'&&!isShip(u)&&onTW(u)).length};},aiOne:async id=>{const u=S.units.find(x=>x.id===id);const n0=LOGN;const rc=reach(u);const goals=ZONES[u.zone||aiPlan().zone];const opts=[...rc.entries()].filter(([k,v])=>v.kind==='land').map(([k])=>k+':'+TER[k].isl+':md'+minD(k,goals));await aiAtkUnit(u);return {zone:u.zone,opts,log:S.log.filter(l=>l.n>n0).map(l=>l.msg.slice(0,80)),at:u.c+','+u.r,alive:alive(u)};},seaInfo:()=>S.units.filter(u=>u.side==='atk'&&atSea(u)&&!isShip(u)).map(u=>{const sh=shipOf(u),rc=reach(Object.assign({},u,{moved:false,acted:false}));const L=[...rc.entries()].filter(([k,v])=>v.kind==='land');const goals=ZONES[u.zone||aiPlan().zone];return {t:u.type,hp:u.hp,ship:sh&&sh.type,at:u.c+','+u.r,land:L.length,landNear:L.filter(([k])=>minD(k,goals)<=kmH(200)).length,dGoal:minD(K(u.c,u.r),goals),moved:!!u.moved};}),pools:()=>({lst:S.pools.plaLst,lift:S.pools.plaLift,roRes:S.roReserve}),tw:()=>{const A=S.units.filter(u=>u.side==='atk'&&!isShip(u)&&onTW(u)),D=S.units.filter(u=>u.side==='def'&&onTW(u)&&!isMsl(u)),sea=S.units.filter(u=>u.side==='atk'&&!isShip(u)&&atSea(u));const sp=supply();return {t:S.turn,ph:S.phase,aN:A.length,aHp:A.reduce((x,u)=>x+u.hp,0),dN:D.length,dHp:D.reduce((x,u)=>x+u.hp,0),sea:sea.length,cap:sp.cap,used:sp.used,ports:PORTS.filter(k=>S.owner[k]==='atk').length,own:Object.values(TER).filter(h=>h.isl==='TW'&&isLand(h)&&S.owner[h.k]==='atk').length,adv:(S.intent||{}).adv,cn:S.units.filter(u=>u.side==='atk'&&!isShip(u)&&hexOf(u).isl==='CN').length};},lch:()=>S.units.filter(u=>isLch(u)).map(u=>u.type+':'+u.veh+'/'+lchV0(u)+':hp'+u.hp),loc:()=>S.units.filter(u=>isLch(u)).slice(0,3).map(u=>{const a=locateP(u,'bm'),b=locateP(u,'cm');return u.type+(u.revealed?'R':'H')+':'+a.p.toFixed(2)+'/'+b.p.toFixed(2)+' '+a.txt;}),drone:()=>({p:S.pools.plaDrone,p0:S.p0.plaDrone,d:S.stats.drones,log:S.log.filter(l=>/改裝無人機/.test(l.msg)).slice(0,2).map(l=>l.msg)}),tyStart:(lon,lat)=>{S.dDelay=0;S.turn=1;S.typhoon=Object.assign(tySpawn(),{lon,lat,cls:1,R:250});S.nextW=null;S.weather=rollWeather();return {delay:S.dDelay,ty:S.weather.ty&&[+S.weather.ty.lon.toFixed(2),+S.weather.ty.lat.toFixed(2)],log:S.log.slice(0,2).map(l=>l.msg)};},shel:()=>({atk:shelterNeeded('atk'),def:shelterNeeded('def'),fc:S.fcH,n:S.units.filter(u=>shelterAt(u)).length}),wx:()=>({base:S.weather.base,wave:S.weather.wave,ty:S.weather.ty,z:Object.keys(WXZ).map(z=>z+':'+wxWaveLL(z==='W'?WXREF:z==='N'?[121.7,25.75]:z==='E'?[122.3,23.3]:[120.9,21.35]))}),tyForce:(lon,lat,cls)=>{S.typhoon=Object.assign(tySpawn(),{lon,lat,cls:cls||1,R:250});S.nextW=null;S.weather=rollWeather();render();return {w:S.weather.wave,ty:S.weather.ty};},tyRun:n=>{const out=[];let t=tySpawn();for(let i=0;i<n;i++){out.push([+t.lon.toFixed(2),+t.lat.toFixed(2),t.cls]);if(!tyStep(t)){out.push('gone');break;}}return out;},loss:()=>{const L=lossData();return {atk:L.atk.find(r=>r[0]==='戰機'),def:L.def.find(r=>r[0]==='戰機'),us:L.ally.find(r=>/艦載機/.test(r[0])),raw:S.stats.airL};},ssm:()=>S.units.filter(u=>u.type==='ssm').map(u=>({id:u.id,veh:u.veh,hp:u.hp,ready:ssmReady(u),fk:u.fk,mT:u.mT,rev:!!u.revealed,shots:u.shots})),ssmHit:id=>{const u=S.units.find(x=>x.id===id);return ssmHit(u,'test');},dmg:(id,n)=>{const u=S.units.find(x=>x.id===id);damage(u,n,'test');return u.hp;},as:()=>S.pools.rocAS,fireAS:id=>{const u=S.units.find(x=>x.id===id);const b=S.pools.rocAS;const t=S.units.find(x=>x.side==='atk'&&atSea(x));if(!t)return null;u.shots=1;fireMissile(u,t);return [b,S.pools.rocAS];},eff:id=>{const u=S.units.find(x=>x.id===id);return {a:effAtk(u),d:effDef(u),n:effNote(u),mobT:u.mobT};},pcs:()=>S.units.filter(u=>u.ally&&alive(u)).map(u=>({id:u.id,t:u.type,c:u.c,r:u.r,moved:!!u.moved,acted:!!u.acted,shots:u.shots,mag:u.mag})),reach:id=>{const u=S.units.find(x=>x.id===id);return u?[...reach(u).keys()].length:-1;},move:(id,k)=>{const u=S.units.find(x=>x.id===id);const rc=reach(u);if(!rc.has(k))return false;humanMove(u,k,rc.get(k).kind);return true;},rk:id=>{const u=S.units.find(x=>x.id===id);return [...reach(u).keys()];},tg:id=>{const u=S.units.find(x=>x.id===id);return targets(u).map(t=>t.id+':'+t.type);},fire:(id,tid)=>{const u=S.units.find(x=>x.id===id),t=S.units.find(x=>x.id===tid);fireMissile(u,t);return true;},vol:id=>{const u=S.units.find(x=>x.id===id);return {t:volleyTargets(u).map(t=>t.id),s:volleyShooters(u).length};},volley:(id,tid)=>{const u=S.units.find(x=>x.id===id),t=S.units.find(x=>x.id===tid);const sh=volleyShooters(u,t);return sh.length?fireVolley(sh,t):false;},cvw:id=>{const u=S.units.find(x=>x.id===id);const I=cvwManualInfo(u),L=cvwManualLandInfo(u);return {n:I&&I.n,foes:I&&I.foes.map(t=>t.id),ln:L&&L.n,lt:L&&L.tg.length};},cvwShoot:(id,tid)=>{const u=S.units.find(x=>x.id===id),t=S.units.find(x=>x.id===tid);return cvwManual(u,t);},tom:id=>{const u=S.units.find(x=>x.id===id);return tomShooters(u).length;},tomFire:(id,cn)=>{const u=S.units.find(x=>x.id===id);allyTomahawk(u,cn);return true;},cn:()=>cnTargets(),end:()=>endPhase(),own:id=>{const u=S.units.find(x=>x.id===id);return cvOwn(u);}};
if(/[?&]debug=1/.test(location.search))window.__fl={aggr:(id,k)=>{const u=S.units.find(x=>x.id===id);return cvAggr(u,TER[k]);},moveUS:async u=>{await uscMove(u);},moveCV:async u=>{await aiAtkUnit(u);},sup:u=>supMult(u),d:(a,b)=>hd(hexOf(a),hexOf(b))};
if(/[?&]debug=1/.test(location.search))window.__cvTest=side=>{if(side==='US')usCarrierSunk();else plaCarrierLost('測試');return S.log.slice(0,4).map(l=>l.msg);};
if(/[?&]debug=1/.test(location.search))window.__targets=id=>{const u=S.units.find(x=>x.id===id);return u?{type:u.type,shots:u.shots,acted:u.acted,moved:u.moved,hex:hexOf(u).k,t:targets(u).map(e=>e.type+'@'+hexOf(e).k+(atSea(e)?'(sea)':'')+' d='+hd(hexOf(u),hexOf(e)))}:null;};
if(/[?&]debug=1/.test(location.search))window.__dog=o=>fxDog(o);
if(/[?&]debug=1/.test(location.search)){window.__fg=k=>failGuide(k);window.__ledger=()=>defLedger();window.__isig=()=>intentSig();}
if(/[?&]debug=1/.test(location.search))window.__fxShot=(a,b,o)=>fxShot(a,b,o);
if(/[?&]debug=1/.test(location.search))window.__fxFlight=(a,b,k)=>fxFlight(a,b,k);window.__fxDur=(k,hex)=>Math.round(fxDur(k,hex*HPX));
function fxSmoke(a,b,arc,n,ms){for(let i=1;i<=n;i++)setTimeout(()=>{const p=bez(a,[(a[0]+b[0])/2,(a[1]+b[1])/2-arc],b,i/(n+1));fxFlash(p,2,7,'#e8e8e8',520);},ms*i/(n+1)*fxK());}
function fxShake(id,hit){const e=document.querySelector('#gD .u[data-id="'+id+'"]');if(!e)return;
  e.animate([{transform:'translate(0,0)'},{transform:'translate(-3px,1px)'},{transform:'translate(3px,-1px)'},{transform:'translate(-2px,0)'},{transform:'translate(0,0)'}],{duration:280*fxK()});
  if(hit)e.animate([{opacity:1},{opacity:.35},{opacity:1}],{duration:260*fxK(),iterations:2});}
let TFXG=null;
const tfxGroup=()=>{if(!TFXG){TFXG=document.createElementNS(SVGNS,'g');TFXG.setAttribute('class','tfx');}return TFXG;};
function tpos(key){const B=CNB[key]||BASES[key];const q=B?TPROJ(B.lon,B.lat):TPROJ(121,23.7);return [+q[0],+q[1]];}
function tfaDur(o){const a=tfaPx(o.a),b=tfaPx(o.b);return a&&b?fxDur(BASES[o.b]?'bm':'cm',Math.hypot(b[0]-a[0],b[1]-a[1])):560;} // 與主地圖的飛彈飛行時間一致
function fxTheater(o){
  const a=tpos(o.a),b=tpos(o.b),g=tfxGroup(),c=[(a[0]+b[0])/2,(a[1]+b[1])/2-30];
  const path=el('path',{d:'M'+a[0]+','+a[1]+' Q'+c[0]+','+c[1]+' '+b[0]+','+b[1],fill:'none',stroke:o.hit?'#ff7a3d':'#9aa5aa','stroke-width':1.6,'stroke-dasharray':'4 4',opacity:.8},g);
  const dot=el('circle',{r:3.5,fill:'#fff3c4',stroke:'#ff7a3d','stroke-width':1},g);
  tween(tfaDur(o),k=>{const p=bez(a,c,b,k);dot.setAttribute('cx',p[0]);dot.setAttribute('cy',p[1]);path.setAttribute('opacity',.8*(1-k*.4));},()=>{
    dot.remove();fxRing(b,3,o.hit?24:14,o.hit?'#ff5a3a':'#cfd6d8',620,o.hit?3:2,g);if(o.hit)fxFlash(b,2,14,'#ffb347',420,g);
    tween(500,k=>path.setAttribute('opacity',.5*(1-k)),()=>path.remove());});
}
// 空優爭奪動畫（視距外）：雙方戰機保持遠距，各自發射空對空飛彈；命中則爆炸墜落，被干擾的飛彈撒出熱焰彈後落空。隱形機平時近乎隱形，發射瞬間才顯形。
const lerp0=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
// 空中單位圖示（機頭朝右）：第四代戰機（三角翼加平尾）、隱形戰機（菱形折線機身，像殲-20／F-22）、轟炸機（長直翼）；帶座艙與尾焰
const AIRG={
  f4:'M13,0 L6,-1.6 L3.5,-8 L-0.5,-8 L1.5,-1.6 L-6,-2 L-8.5,-5 L-11,-5 L-9,0 L-11,5 L-8.5,5 L-6,2 L1.5,1.6 L-0.5,8 L3.5,8 L6,1.6Z',
  st:'M14,0 L5,-2.4 L-0.5,-9 L-5,-9 L-3.8,-2.8 L-9,-4 L-11,-1.6 L-9,0 L-11,1.6 L-9,4 L-3.8,2.8 L-5,9 L-0.5,9 L5,2.4Z',
  bm:'M15,0 L5,-2.2 L2.5,-15 L-1,-15 L-1.5,-2.4 L-8,-3 L-9.5,-6 L-12,-6 L-10.5,0 L-12,6 L-9.5,6 L-8,3 L-1.5,2.4 L-1,15 L2.5,15 L5,2.2Z'};
function airGlyph(kind,col,opt,parent){ // 回傳一個 <g>：三機楔形編隊（長機在前、僚機左右後方），單機縮小；opt:{stealth:半透明虛線, glow:尾焰, one:只畫單機}
  const g=el('g',{opacity:opt&&opt.stealth?.28:1},parent);
  const SC=.5,off=opt&&opt.one?[[0,0]]:[[7,0],[-5,-9],[-5,9]];g._pl=[];
  off.forEach(([dx,dy])=>{
    const s1=el('g',{transform:'translate('+dx+' '+dy+') scale('+SC+')'},g);g._pl.unshift({el:s1,dx,dy});
    el('path',{d:AIRG[kind],fill:col,stroke:'#fff','stroke-width':1.3,'stroke-linejoin':'round','stroke-dasharray':opt&&opt.stealth?'2 1.5':'0'},s1);
    el('path',{d:kind==='bm'?'M6,-1.2 L10,0 L6,1.2Z':'M5,-1.1 L9,0 L5,1.1Z',fill:'#cfeaff',opacity:.85},s1); // 座艙
    if(!opt||opt.glow!==false){const n=kind==='bm'?2:1;for(let i=0;i<n;i++)el('circle',{cx:-11.5,cy:n===1?0:(i?5.5:-5.5),r:1.8,fill:'#ffb347',opacity:.9},s1);}
  });
  return g;
}
function fxDog(o){
  const PO=h=>{const q=oCenter(h[0],h[1]);return [q[0]*KS,q[1]*KS];};
  const bases=(o.ob?o.ob.map(([c,r])=>cen(c,r)):[SPOT.ckk,SPOT.chiayiab,SPOT.tainanab,SPOT.gangshan,SPOT.pingtung].map(k=>TER[k]).filter(Boolean).map(h=>cen(h.c,h.r)));
  const pla=[[2,2],[2,4],[2,6],[2,8]].map(PO);
  if(!bases.length){fxText(lerp0(pla[0],pla[0],0),'守方機場全數失效，空軍無法起飛','def',1600);return;}
  const N=LITE?2:Math.max(2,Math.min(4,Math.max(o.na,o.nd))),sh=o.ctl==='atk'?.62:o.ctl==='def'?.38:.5;
  const allJets=[],jet=(col,stealth)=>{const g=airGlyph(stealth?'st':'f4',col,{stealth});allJets.push(g);return g;};
  setTimeout(()=>allJets.forEach(g=>{try{g.remove();}catch(e){}}),(Math.max(2,Math.min(4,Math.max(o.na||2,o.nd||2)))*220+6500)*fxK()); // 保險：任何殘留的機群一定清掉
  const place=(g,p,ang,sc)=>g.setAttribute('transform','translate('+p[0].toFixed(1)+' '+p[1].toFixed(1)+') rotate('+(ang*180/Math.PI).toFixed(0)+') scale('+(.95*(sc||1))+')');
  const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const one=(a,b,col,hit,done)=>{ // 一發空對空飛彈（縮小）：命中＝在目標爆炸；落空＝中途被干擾、撒出熱焰彈
    const miss=[b[0]+(NR()-.5)*70,b[1]+(NR()<.5?-1:1)*(18+NR()*24)];
    fxFlash(a,1.2,5,'#fff',160);
    fxShot(a,hit?b:miss,{arc:(NR()-.5)*20,dur:fxDur('aam',Math.hypot(b[0]-a[0],b[1]-a[1])),color:'#f4f4f4',trail:col,w:.8,r:1.6,style:'mis',shape:'aam',end:()=>{
      if(hit){fxFlash(b,2,14,'#ffb347',320);fxFlash(b,1.2,7,'#fff3c4',220);fxRing(b,3,20,'#ff7a3d',380,1.4);}
      else{for(let i=0;i<3;i++)setTimeout(()=>fxFlash([miss[0]+(NR()-.5)*12,miss[1]+(NR()-.5)*10],1,5,'#ffd45a',360),i*70*fxK());fxText(miss,'被干擾','dead',600);}
      if(done)done();}});
  };
  // 一個編隊齊射：每架各射一發（最多 3 發）；是否有飛彈命中由戰況決定，命中時只打下編隊中的一架
  const missile=(a,b,col,hit,done)=>{const n=LITE?2:3,hi=hit?Math.floor(NR()*n):-1;for(let j=0;j<n;j++)setTimeout(()=>one([a[0]+(NR()-.5)*8,a[1]+(NR()-.5)*8],[b[0]+(NR()-.5)*10,b[1]+(NR()-.5)*10],col,j===hi,j===hi?done:null),j*130*fxK());};
  const fall=(g,p,ang,txt,cls,home)=>{ // 只有被打中的那一架墜落，編隊其餘飛回自己的基地方向
    const v=g._pl&&g._pl.length>1?g._pl.shift():null;
    fxText(p,txt,cls,1100);
    if(!v){tween(760,k=>{place(g,[p[0]+26*k,p[1]+44*k*k+10*k],ang+k*9,1-.35*k);g.setAttribute('opacity',1-k*k);},()=>g.remove());return;}
    tween(760,k=>{v.el.setAttribute('transform','translate('+(v.dx+10*k)+' '+(v.dy+28*k*k+6*k)+') rotate('+(k*160).toFixed(0)+') scale('+(.5*(1-.4*k))+')');v.el.setAttribute('opacity',1-k*k);if(!LITE&&NR()<.4)fxPuff([p[0]+10*k+v.dx,p[1]+28*k*k+v.dy],2,5,'#4a4a4a',.7,560);},()=>{v.el.remove();
      // 被擊落一架後，剩下的編隊朝自己的基地脫離（不用航向反轉：返航途中被擊中時，反轉會變成朝敵方飛）
      const q=g._p||p,bk=home?Math.atan2(home[1]-q[1],home[0]-q[0]):ang+Math.PI;tween(1200,k=>{place(g,[q[0]+Math.cos(bk)*120*k,q[1]+Math.sin(bk)*120*k],bk);g.setAttribute('opacity',k<.6?1:1-(k-.6)/.4);},()=>g.remove());});
  };
  // 一路飛行：直線接近 → 通過交戰點時齊射 → 不停留、半圓 U 形轉彎 → 沿平行航線返航（速度恆定，沒有停在空中）
  const mkPath=(st,pe,sg)=>{
    const L1=Math.hypot(pe[0]-st[0],pe[1]-st[1])||1,d=[(pe[0]-st[0])/L1,(pe[1]-st[1])/L1],n=[-d[1]*sg,d[0]*sg],R=30,S=2*L1+Math.PI*R;
    const c=[pe[0]+n[0]*R,pe[1]+n[1]*R];
    const pos=x=>{x=Math.max(0,Math.min(S,x));
      if(x<L1)return [[st[0]+d[0]*x,st[1]+d[1]*x],Math.atan2(d[1],d[0])];
      if(x<L1+Math.PI*R){const th=(x-L1)/R,sn=Math.sin(th),cs=Math.cos(th);
        return [[c[0]+R*(-n[0]*cs+d[0]*sn),c[1]+R*(-n[1]*cs+d[1]*sn)],Math.atan2(n[1]*sn+d[1]*cs,n[0]*sn+d[0]*cs)];}
      const u=x-L1-Math.PI*R;return [[pe[0]+2*R*n[0]-d[0]*u,pe[1]+2*R*n[1]-d[1]*u],Math.atan2(-d[1],-d[0])];};
    return {pos,S,L1};
  };
  for(let i=0;i<N;i++){
    const a=pla[i%pla.length].slice(),b=bases[i%bases.length].slice();a[1]+=(i>>2)*10;
    const m=lerp(a,b,sh);m[1]+=(NR()-.5)*60;
    const pm=lerp(a,m,.55),rm=lerp(b,m,.55); // 交戰點：雙方在遠處互射，彼此不靠近
    const sg=NR()<.5?1:-1,pp=mkPath(a,pm,sg),rp=mkPath(b,rm,-sg);
    const pst=NR()<o.pst,rst=NR()<o.dst; // 這一對裡是否為隱形機
    const gp=jet('#d9534a',pst),gr=jet('#3f7fd0',rst);
    const pd=i<o.al,rd=i<o.dl,d0=i*220*fxK();
    const T=3300*fxK(),tp=T*pp.L1/pp.S,tr=T*rp.L1/rp.S; // 各自抵達交戰點的時間
    const at=(P,ms)=>P.pos(Math.min(1,ms/T)*P.S); // 某時刻的位置與航向
    const aim=(src,P,tf)=>{let dm=800,q=P.pos(0)[0];for(let j=0;j<3;j++){q=at(P,tf+dm)[0];dm=Math.min(1100,520+Math.hypot(q[0]-src[0],q[1]-src[1])*1.3);}return q;};
    setTimeout(()=>{
      tween(3300,k=>{
        [[gp,pp,pd],[gr,rp,rd]].forEach(([g,P,dead])=>{if(g._dead)return;const [p,ang]=P.pos(k*P.S);g._p=p;g._a=ang;place(g,p,ang);const hid=(g===gp?pst:rst)&&!g._rev;g.setAttribute('opacity',hid?0.28:(k>.88?(1-k)/.12:1));});
      },()=>{[gp,gr].forEach(g=>{if(!g._dead)g.remove();});});
      setTimeout(()=>{ // 紅方通過交戰點：齊射
        if(pst){gp._rev=1;fxRing(gp._p||pm,3,16,'#ffe1dc',420,1.2);}
        const src=gp._p||pm,tgt=aim(src,rp,tp);
        missile(src,tgt,'#ff9a8a',rd,()=>{if(rd){gr._dead=true;fall(gr,gr._p||tgt,gr._a||0,'−1 守方戰機','def',b);}});
      },tp);
      setTimeout(()=>{ // 藍方通過交戰點：齊射
        if(rst){gr._rev=1;fxRing(gr._p||rm,3,16,'#dcecff',420,1.2);}
        const src=gr._p||rm,tgt=aim(src,pp,tr+160*fxK());
        missile(src,tgt,'#8fc4ff',pd,()=>{if(pd){gp._dead=true;fall(gp,gp._p||tgt,gp._a||0,'−1 共軍戰機','atk',a);}});
      },tr+160*fxK());
    },d0);
  }
  const mid=lerp(pla[0],bases[0],.5);setTimeout(()=>fxText(mid,'制空：'+AIRCTL[o.ctl],o.ctl==='def'?'def':o.ctl==='atk'?'atk':'dead',1300),(N*220+3200)*fxK());
}
// 主地圖上的基地打擊動畫：發射點到基地圖示，依武器用巡弋飛彈（低空貼海面）或彈道飛彈（高拋物線）
function tfaPx(key,side){
  const P=basePx();
  if(key==='tw'){const ms=S.units.filter(u=>u.side==='def'&&(u.type==='hmr'||u.type==='ssm'));const u=ms.length?pick(ms):null;if(u)return cen(u.c,u.r);const h=TER[TAIPEI];return cen(h.c,h.r);}
  if(CNB[key])return P['c'+key];if(BASES[key])return P['b'+key];
  return P['b'+key]||null;
}
function fxBaseStrike(o){
  const a=tfaPx(o.a),b=tfaPx(o.b);if(!a||!b||reduce())return;
  const toBase=!!BASES[o.b]; // 攻方打盟國基地：彈道飛彈；守方／盟軍打大陸基地：巡弋飛彈
  fxFlight(a,b,toBase?'bm':'cm',()=>{
    fxImpact(b,o.hit,false,true);
    if(o.hit&&CNB[o.b]&&CNPEND[o.b]&&CNPEND[o.b].length){CNPEND[o.b].shift();render();} // 飛彈抵達：基地受損標記此時才更新
    if(o.hit){for(let i=0;i<3;i++)setTimeout(()=>fxPuff([b[0]+(NR()-.5)*22,b[1]-4-i*4],3,12,'#3d3d3d',.75,1100),i*110*fxK());fxText(b,'基地受創','atk',1100);}
    else fxText(b,'未命中','def',900);
  });
}
// 海馬士（M142 HIMARS）發射動畫：卡車載具原地發射，GMLRS 火箭彈 3 發連射、拋物線飛行、落點多點爆炸；陸軍戰術飛彈（ATACMS）單發、高拋物線、單一大爆炸；發射後載具立即轉移
// 艦載機對艦打擊：2～3 架戰機（三機楔形）從航艦出發，飛到「反艦飛彈射程」前發射，飛彈從戰機位置飛向目標；發射後戰機調頭返航並淡出
function cvaGeo(o){
  const a=cen(o.from[0],o.from[1]),b=cen(o.to[0],o.to[1]),cp=center(1,0)[0]-center(0,0)[0],d=Math.hypot(b[0]-a[0],b[1]-a[1])||1,u=[(b[0]-a[0])/d,(b[1]-a[1])/d];
  let gap=Math.min(d,(o.R||11)*cp),p=[b[0]-u[0]*gap,b[1]-u[1]*gap],dp=d-gap;
  if(dp<50){const f=Math.min(50,d);p=[a[0]+u[0]*f,a[1]+u[1]*f];dp=f;gap=d-f;} // 目標就在射程內：戰機也先前飛一小段再發射
  const n=LITE?Math.min(2,o.n||1):Math.min(3,Math.max(1,o.n||1)),tP=Math.min(1800,350+dp*1.1),tM=Math.min(1000,320+gap*.9);
  return {a,b,p,u,dp,n,tP,tM,tot:tP+(n-1)*130+tM};
}
function fxCarrierAir(o){
  if(reduce())return;const G=cvaGeo(o),col=o.side==='atk'?'#d9534a':'#3f7fd0',cls=o.side==='atk'?'atk':'def';
  const g=airGlyph('f4',col,{glow:true}),ang=Math.atan2(G.u[1],G.u[0]),place=(p,an,op)=>{g.setAttribute('transform','translate('+p[0].toFixed(1)+' '+p[1].toFixed(1)+') rotate('+(an*180/Math.PI).toFixed(0)+') scale(1)');g.setAttribute('opacity',op);};
  const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];place(G.a,ang,0);
  setTimeout(()=>{try{g.remove();}catch(e){}},(G.tP*2+G.tot+1500)*fxK()); // 保險：殘留的戰機一定清掉
  fxFlash(G.a,3,12,'#fff',240);
  tween(G.tP,k=>place(lerp(G.a,G.p,k),ang,Math.min(1,k*6)),()=>{
    // 到達發射點：每架一發（最多 3 發），最後一發決定結果；前面的有防空時被攔截、否則落海
    for(let j=0;j<G.n;j++)setTimeout(()=>{
      const src=[G.p[0]+(NR()-.5)*8,G.p[1]+(NR()-.5)*8],last=j===G.n-1;
      fxFlash(src,1.5,7,'#fff',180);
      if(o.ad&&!reduce())fxIntercept(src,G.b,'cm',last?o.ad:'int',last?o.hit:false,true,o.side);
      else fxFlight(src,G.b,'asm',()=>fxImpact(G.b,last&&o.hit,true,true)); // 艦載機的反艦飛彈
    },j*130*fxK());
    // 調頭返航：朝自己的航艦飛回去，快到航艦時才淡出（降落）
    const back=Math.atan2(G.a[1]-G.p[1],G.a[0]-G.p[0]);
    setTimeout(()=>tween(Math.min(1800,350+G.dp*1.1),k=>place(lerp(G.p,G.a,k),back,k<.85?1:Math.max(0,1-(k-.85)/.15)),()=>g.remove()),(G.n*130+80)*fxK());
  });
}
if(/[?&]debug=1/.test(location.search))window.__cva=o=>fxCarrierAir(o);
function fxHimars(o){
  const a=cen(o.from[0],o.from[1]),b=cen(o.to[0],o.to[1]);if(reduce())return;
  const dd=Math.hypot(b[0]-a[0],b[1]-a[1]),dir=b[0]>=a[0]?1:-1;
  // 發射：載具閃光與揚塵
  fxFlash([a[0],a[1]-4],2,12,'#fff3c4',200);
  for(let i=0;i<(LITE?2:4);i++)setTimeout(()=>fxPuff([a[0]-dir*(4+i*3),a[1]+2-i],3,12+i*2,'#b9a98d',.7,900),i*70*fxK());
  const n=o.atc?1:3;
  for(let i=0;i<n;i++)setTimeout(()=>{
    const aim=[b[0]+(o.hit?0:(NR()-.5)*34)+(NR()-.5)*8*(n>1?1:0),b[1]+(o.hit?0:(NR()<.5?-1:1)*(10+NR()*14))+(NR()-.5)*8*(n>1?1:0)];
    const arc=o.atc?Math.min(210,dd*.55+70):Math.min(90,dd*.32+26);
    const dur=fxDur(o.atc?'atc':'rkt',dd);
    fxFlash([a[0],a[1]-5],1.5,8,'#ffe08a',150);
    fxShot(a,aim,{arc,dur,color:'#e6e6e6',trail:o.atc?'#ff8a3c':'#ffd27a',w:o.atc?2.2:1.2,r:o.atc?3.2:2.4,style:'mis',shape:o.atc?'bm':'rkt',end:()=>{
      if(o.hit||i<n-1){fxFlash(aim,2,o.atc?24:10,'#ffb347',o.atc?380:260);fxFlash(aim,1.5,o.atc?12:6,'#fff3c4',200);fxRing(aim,3,o.atc?36:16,'#ff7a3d',o.atc?520:380,o.atc?2.5:1.6);
        if(!LITE)fxPuff([aim[0],aim[1]-3],3,o.atc?14:8,'#5a5248',.8,1000);}
      else{fxPuff(aim,2,10,'#cfc7ae',.7,700);}
      if(i===n-1){if(o.hit)fxText(b,o.atc?'戰術飛彈命中':'火箭彈命中','def',1000);else fxText(b,'未命中','atk',800);}
    }});
  },(380+i*(o.atc?0:140))*fxK());
}
// 潛艦：魚雷在水下留下氣泡航跡、命中時水柱；魚叉先浮出水面（水花）再破水而出貼海面飛行
function fxSub(o){
  const a=cen(o.from[0],o.from[1]),b=cen(o.to[0],o.to[1]);if(reduce())return;
  const done=()=>fxImpact(b,o.hit,true,true);
  if(o.w==='hm'){
    fxRing(a,2,18,'#dff4ff',560,1.8);fxRing(a,1,10,'#ffffff',420,1.2);
    for(let i=0;i<4;i++)setTimeout(()=>fxPuff([a[0]+(NR()-.5)*14,a[1]-2-i*3],2,7,'#eaf6ff',.8,700),i*60*fxK());
    setTimeout(()=>fxFlight(a,b,'asm',done),360*fxK()); // 潛射魚叉
  }else{
    fxRing(a,2,12,'#cfeaf5',420,1.5);
    fxFlight(a,b,'torp',()=>{if(o.hit){fxRing(b,4,40,'#e8fbff',700,2.5);for(let i=0;i<3;i++)setTimeout(()=>fxFlash([b[0]+(NR()-.5)*10,b[1]-6-i*7],2,10,'#dff4ff',520),i*90*fxK());}done();});
  }
}
// 守方潛艦對攻方玩家隱蔽：沒開火暴露前看不到（雙方都由人操作、守方玩家、或電腦對電腦觀戰時看得到）
const subInPort=u=>u.type==='hk'&&hexOf(u).t==='port'&&hexOf(u).isl==='TW'; // 回港補給的潛艦停在碼頭，位置固定、看得到，也能被飛彈與空襲打擊
const canHitSub=u=>u.type==='hk'?subInPort(u):!(u.type==='ssn'||u.type==='nme'||u.type==='mdt');
const subHidden=u=>(u.type==='hk'||u.type==='ssn')&&u.side==='def'&&!u.revealed&&!subInPort(u)&&!S.over&&S.ctrl.atk==='human'&&S.ctrl.def!=='human'&&!S.video&&!S.sim;
const unitAtVis=k=>S.units.find(u=>K(u.c,u.r)===k&&!subHidden(u));
function runFx(o){
  const PO=h=>{const q=oCenter(h[0],h[1]);return [q[0]*KS,q[1]*KS];}; // 外圍／港口出發點（舊座標）
  const P=h=>TER[K(h[0],h[1])]?cen(h[0],h[1]):center(h[0],h[1]);
  if(o.t==='atk'){
    const a=P(o.from),b=P(o.to),n=o.sea?1:3;
    for(let i=0;i<n;i++)setTimeout(()=>{if(o.sea){fxFlash(a,2,9,'#ffe08a',150);fxShot(a,b,{arc:42,dur:340,end:()=>fxImpact(b,o.hit&&i===n-1,o.tsea,false)});}else fxFlight(a,b,'arty',()=>fxImpact(b,o.hit&&i===n-1,o.tsea,false));},i*95*fxK());
  }else if(o.t==='sub'){fxSub(o);
  }else if(o.t==='msl'){
    const a=P(o.from),b=P(o.to);fxFlight(a,b,'asm',()=>fxImpact(b,o.hit,true,true)); // 反艦飛彈
  }else if(o.t==='air'){
    const b=P(o.at),src=o.src||'w',org=o.org||o.from,s=o.from?P(o.from):o.org?PO(o.org):src==='w'?[b[0]-200,b[1]-150]:src==='e'?[b[0]+200,b[1]-165]:[b[0],b[1]-230];
    const dd=Math.hypot(s[0]-b[0],s[1]-b[1]);if(org)fxFlash(s,3,14,'#fff',260);
    if(org&&o.k&&o.ad&&!reduce())fxIntercept(s,b,o.k==='bomb'?'cm':o.k,o.ad,o.hit,o.tsea,o.adSide||'def');
    else if(org&&o.k)fxFlight(s,b,o.k,()=>fxImpact(b,o.hit,o.tsea,true));
    else fxShot(s,b,{arc:org?Math.min(110,dd*.12):-12,dur:org?Math.min(900,260+dd*.7):420,color:'#fff',trail:'#ff9a3c',w:3,r:3.5,end:()=>fxImpact(b,o.hit,o.tsea,true)});
  }else if(o.t==='cva'){fxCarrierAir(o);
  }else if(o.t==='dmg'){
    const p=P(o.at);fxText(p,'−'+o.n,o.side);fxShake(o.id,true);
  }else if(o.t==='dead'){
    if(o.id!==undefined)ghostDrop(o.id);
    const p=P(o.at);fxFlash(p,4,34,'#ff9a3c',520);fxFlash(p,2,18,'#fff3c4',360);fxRing(p,6,42,'#ff5a3a',620,3);fxSparks(p,12,34,'#ffd45a',560);
    for(let i=0;i<4;i++)setTimeout(()=>fxFlash([p[0]+(NR()-.5)*20,p[1]-6-i*5],3,11,'#6b6b6b',700),i*90*fxK());
    const gh=document.createElementNS(SVGNS,'g');gh.innerHTML=unitSVG({id:-1,c:o.at[0],r:o.at[1],type:o.type,side:o.side,hp:1,moved:true,acted:false});document.getElementById('gF').appendChild(gh);
    tween(620,k=>{gh.setAttribute('opacity',1-k);gh.setAttribute('transform','translate(0,'+(-6*k).toFixed(1)+')');},()=>gh.remove());
    fxText(p,'殲滅','dead',1100);
  }else if(o.t==='txt'){fxText(P(o.at),o.s,o.col||'def',900);
  }else if(o.t==='land'){const p=P(o.at);fxRing(p,4,24,'#ffffff',620,2.5);fxRing(p,2,15,'#cfeaf5',480,2);
  }else if(o.t==='hmr'){fxHimars(o);
  }else if(o.t==='tfa'){fxTheater(o);fxBaseStrike(o);
  }else if(o.t==='dog'){fxDog(o);}
}
// 一發武器從開始到命中（或攔截）的時間（毫秒，未乘播放速度）；公式與 fxFlight／fxShot／fxHimars／fxSub 相同
function fxArrive(o){
  const PO=h=>{const q=oCenter(h[0],h[1]);return [q[0]*KS,q[1]*KS];},P=h=>TER[K(h[0],h[1])]?cen(h[0],h[1]):center(h[0],h[1]);
  const fl=(k,d)=>k==='bomb'?fxDur('plane',d*.72)+fxDur('bomb',d*.28):fxDur(k,d);
  const dist=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  try{
    if(o.t==='air'){const b=P(o.at),src=o.src||'w',s=o.from?P(o.from):o.org?PO(o.org):src==='w'?[b[0]-200,b[1]-150]:src==='e'?[b[0]+200,b[1]-165]:[b[0],b[1]-230],dd=dist(s,b);
      if((o.org||o.from)&&o.k)return fl(o.ad&&o.k==='bomb'?'cm':o.k,dd);return (o.org||o.from)?Math.min(900,260+dd*.7):420;}
    if(o.t==='msl')return fl('asm',dist(P(o.from),P(o.to)));
    if(o.t==='cva')return cvaGeo(o).tot;
    if(o.t==='atk')return o.sea?340:260+2*95;
    if(o.t==='hmr'){const dd=dist(cen(o.from[0],o.from[1]),cen(o.to[0],o.to[1]));return fxDur(o.atc?'atc':'rkt',dd)+(o.atc?0:2*120);}
    if(o.t==='sub'){const dd=dist(cen(o.from[0],o.from[1]),cen(o.to[0],o.to[1]));return o.w==='hm'?360+fl('asm',dd):fl('torp',dd);}
  }catch(e){}
  return 400;
}
function playFx(list){
  if(!list||!list.length||reduce())return;
  const g=document.getElementById('gF'),now=performance.now();
  if(g.childNodes.length>70){for(const n of [...g.childNodes]){if(!n.__t)n.__t=now;else if(now-n.__t>4000)n.remove();}} // 只清掉超過 4 秒的舊特效，正在播放的不刪
  while(g.childNodes.length>1200)g.removeChild(g.firstChild); // 安全網：避免異常時無限累積
  let t=ANIM.slid?300:0,last=t,hitAt=t;const k=fxK();ANIM.slid=false; // 單位還在滑到新位置：等它到了再開火
  const nShots=list.filter(x=>x.t==='air'||x.t==='msl').length,stepAir=nShots>=8?45:nShots>=4?85:170,stepMsl=nShots>=8?45:nShots>=4?70:110; // 齊射：發數多時間隔縮短，看起來是一起發射
  list.forEach(o=>{
    let start;
    if(o.t==='atk'||o.t==='msl'||o.t==='hmr'||o.t==='sub'||o.t==='air'||o.t==='tfa'||o.t==='cva'){start=t;last=t;hitAt=t+(o.t==='tfa'?tfaDur(o):fxArrive(o));t+=(o.t==='air'?stepAir:o.t==='atk'?70:stepMsl);}
    else if(o.t==='dmg'||o.t==='dead'||o.t==='txt')start=Math.max(last+360,hitAt+80); // 等這一發武器飛到、爆炸後才顯示結果
    else start=0;
    if(start>0)setTimeout(()=>runFx(o),start*k);else runFx(o);
  });
}

// 狀態列說明：點（或鍵盤 Enter）狀態標籤，彈出白話說明；再點一次或點別處關閉
(function(){
  let tipEl=null;
  const hide=()=>{if(tipEl){tipEl.remove();tipEl=null;}};
  const show=chip=>{
    const wasSame=tipEl&&tipEl.dataset.k===chip.dataset.tip;hide();if(wasSame)return;
    const r=chip.getBoundingClientRect();tipEl=document.createElement('div');tipEl.className='chiptip';tipEl.dataset.k=chip.dataset.tip;tipEl.setAttribute('role','tooltip');tipEl.textContent=TX(chip.dataset.tip);
    document.body.appendChild(tipEl);
    const w=Math.min(320,innerWidth-16);tipEl.style.width=w+'px';
    tipEl.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left))+'px';tipEl.style.top=(r.bottom+6)+'px';
  };
  document.addEventListener('click',e=>{const c=e.target.closest&&e.target.closest('.chip.tp');if(c){show(c);}else hide();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('tp')){e.preventDefault();show(e.target);}});
  addEventListener('scroll',hide,true);
})();
const wxMobile=()=>matchMedia('(max-width:960px)').matches&&document.body.classList.contains('playing');
function wxWinSync(){const w=$('#wxWin');if(w)w.hidden=!wxMobile();}
function renderStatus(){
  if(!S.started){$('#status').innerHTML='<span class="chip">尚未開始 · 判定回合 <b>'+S.T+'</b> · <b>'+ERA[S.era].n+'</b></span>';$('#fsStatus').textContent='';return;}
  const sp=supply();
  const W=S.weather,ac=S.airCtl||'mid',tip=(k,t)=>' data-tip="'+t.replace(/"/g,'&quot;')+'" tabindex="0" role="button"';
  const atkP=S.phase==='atk';
  const stHTML='<span class="chip tp"'+tip('t','【回合】目前第 '+S.turn+' 回合，預計共 '+S.T+' 回合。第 '+S.T+' 回合結束時判定勝負（雙方還在激戰時可能延長）。')+'>回合 <b>'+S.turn+' / '+S.T+'</b></span>'+
    '<span class="chip tp '+S.phase+'"'+tip('p','【階段】每回合分「攻方階段」與「守方階段」，輪流行動。目前輪到'+SIDE[S.phase]+(S.ctrl[S.phase]==='ai'?'（電腦操作）':'（你操作）')+'；做完按「結束階段」換對方。')+'>'+SIDE[S.phase]+'階段'+(S.ctrl[S.phase]==='ai'?' · 電腦':'')+'</span>'+
    '<span class="chip tp"'+tip('w','【天候・台灣海峽】'+W.n+(W.base!=null?'（各海域：'+Object.keys(WXZ).map(z=>WXZ[z]+' '+wxWaveLL(z==='W'?WXREF:z==='N'?[121.7,25.75]:z==='E'?[122.3,23.3]:[120.9,21.35]).toFixed(1)+' m').join('、')+(W.ty?'；'+TYC[W.ty.cls].n+'颱風，暴風半徑 '+W.ty.R+' km，距海峽 '+Math.round(kmLL([W.ty.lon,W.ty.lat],WXREF))+' km':'')+'）':'')+'：海上每回合可移動 '+W.sea+' 格；灘頭卸載能力 '+Math.round(Math.max(0,Math.min(1,(2.5-(W.wave||0))/1.25))*100)+'%、港口 '+Math.round(Math.max(.3,Math.min(1,(4-(W.wave||0))/2))*100)+'%；'+(W.air?'空降與空襲可以進行':'空降與空襲停擺')+(W.fire?'；火力 '+W.fire:'')+'。浪高 2.5 公尺以上，海上登陸艦、運兵船與補給船團開始損耗，5 公尺以上護航艦與航艦也會。'+(S.fcH!=null?'預報下回合浪高約 '+S.fcH.toFixed(1)+' 公尺（誤差約 ±0.3，颱風時 ±0.6）。':'')+(shelterNeeded()?'預報風浪偏大，可以下「避風令」。':''))+'>天候 '+W.n+(S.fcH!=null?' · 預報 '+S.fcH.toFixed(1)+' 公尺'+(S.fcTyphoon?'（颱風）':''):'')+' · 海上移動 <b>'+W.sea+'</b></span>'+
    '<span class="chip tp"'+tip('f',atkP?'【火力】攻方這個階段可以打擊 '+S.fire+' 個目標（火箭軍飛彈、空軍、艦砲等的總和，按「火力打擊」再點目標；每點命中率不高，優先打威脅大的目標）。'+(S.fireNote?S.fireNote:''):'【火力】守方的火力來自岸置飛彈與盟軍；本回合攻方火力 '+S.fire+' 點。'+(S.fireNote?S.fireNote:''))+'>火力 <b>'+S.fire+'</b></span>'+
    '<span class="chip tp"'+tip('a','【制空】雙方空軍對抗的結果：'+AIRCTL[ac]+'。制空優勢的一方空襲與空降更順利、損失較小。'+(S.sead?'目前守方防空被壓制，攻方飛機較安全。':'')+(afShare()<1?'機場受損，起降能力剩 '+Math.round(afShare()*100)+'%。':''))+'>制空 <b>'+({atk:'攻優',mid:'均勢',def:'守優'}[ac])+'</b>'+(S.sead?' · 防空壓制':'')+(afShare()<1?' · 機場 '+Math.round(afShare()*100)+'%':'')+'</span>'+
    '<span class="chip tp"'+tip('s','【補給】攻方島上有 '+sp.used+' 個部隊需要彈藥與油糧，補給容量 '+sp.cap+'。'+(sp.over?'需求超過容量，部隊會一回合比一回合損耗，連續多回合缺補給攻方會崩潰。要打開港口、灘頭或補給站來提高容量。':'容量足夠。補給靠港口、灘頭卸貨、空投與就地徵用。'))+(sp.over?' style="border-color:var(--atk);color:var(--atk)"':'')+'>補給 <b>'+sp.used+' / '+sp.cap+'</b></span>';
  $('#status').innerHTML=stHTML;{const ch=[...$('#status').children];$('#statusTop').innerHTML=ch.slice(0,2).map(c=>c.outerHTML).join('');
    const wb=$('#wxBody');wb.innerHTML='';const wx=ch.find(c=>(c.dataset.tip||'').startsWith('【天候】'));
    if(wx&&wxMobile()){wx.classList.add('wxmoved'); // 手機：天候搬到地圖上的小膠囊（原狀態列隱藏）；點一下顯示完整說明
      const wv=W.wave,lv=wv==null?'g':wv>=2.5?'r':wv>1.25?'o':'g',ty=W.ty||(S.nextW&&S.nextW.ty)||S.fcTyphoon; // 顏色門檻＝灘頭卸載規則：1.25 m 以下不受影響、2.5 m 以上無法卸載
      const pill=document.createElement('span');pill.className='chip tp wxp '+lv;pill.setAttribute('data-tip',wx.dataset.tip);pill.setAttribute('tabindex','0');pill.setAttribute('role','button');
      pill.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 20c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M5 10c1.5-3.5 5-5 8.5-4-2 1-2.5 3-1 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
        (wv!=null?'<b>'+wv.toFixed(1)+'m</b>'+(S.fcH!=null?'<i>→'+S.fcH.toFixed(1)+'</i>':''):'<b>'+W.n+'</b>')+(ty?'<em>颱風</em>':'')+'<span class="sep">·</span><span class="mv">移動 <b>'+W.sea+'</b></span>';
      wb.appendChild(pill);}
    wxWinSync();}
  $('#fsStatus').textContent='第 '+S.turn+' / '+S.T+' 回合 · '+SIDE[S.phase]+'階段 · 天候'+S.weather.n+' · 火力 '+S.fire+' · 補給 '+sp.used+'/'+sp.cap;
}
function renderCtrl(){
  document.body.classList.toggle('pre',!S.started);document.body.classList.toggle('playing',!!(S.started&&!S.video&&!S.over));
  if(S.started)renderStatus();wxWinSync(); // 手機模式以 playing 類別為準，切換後重新搬移天候
  $('#setup').hidden=S.started;$('#ctrl').hidden=!S.started||S.video;$('#vbarCard').hidden=!(S.started&&S.video);$('#vcap').hidden=!(S.started&&S.video&&V.fr.length>0);
  if(!S.started)return;
  const h=humanTurn();
  $('#phaseTitle').textContent=S.over?'作戰結束':'第 '+S.turn+' 回合 · '+SIDE[S.phase]+'指揮';
  const bs=$('#btnStrike'),atkP=S.phase==='atk',pts=atkP?S.fire:(S.dfire||0);bs.hidden=false;bs.disabled=!h||pts<=0;bs.classList.toggle('on',S.mode==='strike');
  bs.textContent=S.mode==='strike'?'取消打擊（剩 '+pts+'）':(atkP?'火力打擊（'+pts+' 點）':'縱深打擊（'+pts+' 發）');
  $('#btnEnd').disabled=!h;$('#btnEnd').hidden=S.sim;if(S.sim)bs.hidden=true;
  const ba=$('#btnAssist');ba.disabled=!h;ba.hidden=S.sim||S.video;
  {const ir=$('#btnIntentReset');if(ir)ir.hidden=!(h&&S.intentSkip&&S.intentSkip[S.phase]);}
  let hint;
  if(S.over)hint='作戰已結束，可在戰報中回顧過程。';
  else if(S.sim)hint=S.busy?'電腦推演中：'+SIDE[S.phase]+'正在行動…':'推演暫停，等待事件節點的決定。';
  else if(!h)hint=SIDE[S.phase]+'（電腦）正在行動…';
  else if(S.mode==='strike')hint=S.phase==='atk'?'點選任一守方單位、台灣的機場，或地圖上的美日基地進行火力打擊，每次消耗 1 點。':'點選地圖上的大陸基地（紅色圖形），或直接點右側「中方基地」清單的一列，進行長程打擊，每次消耗 1 發長程飛彈。';
  else if(S.sel&&S.sel.type==='hmr'&&S.phase==='def'){const n=targets(S.sel).length;hint='海馬士只能打陸上目標：4 格內用火箭彈，14 格內用陸軍戰術飛彈（各有庫存）；每次最多 4 輛齊射，每階段次數依可射車數，發射後可再移動。'+(n?'橘圈＝目前射程內可打擊的 '+n+' 個目標，點選目標發射。':'目前射程內沒有陸上目標（海上船團要靠反艦飛彈）。');}
  else if(S.sel)hint='綠色＝可移動，橘色＝可登陸，紫色＝可空降；橘圈＝可攻擊目標。再點一次單位可取消選取。';
  else hint=S.phase==='atk'?'點選紅色單位下令。先把兩棲部隊從沿岸出航，下一回合搶灘。':'點選藍色單位下令。飛彈單位可射擊約 160 km 內海上的攻方船團。'+defLedger();
  $('#hint').textContent=hint;$('#fsHint').textContent=hint;
  const fs1=$('#fsStrike'),fs2=$('#fsEnd');fs1.hidden=bs.hidden;fs1.disabled=bs.disabled;fs1.textContent=bs.textContent;fs1.classList.toggle('on',bs.classList.contains('on'));fs2.hidden=$('#btnEnd').hidden;fs2.disabled=$('#btnEnd').disabled;if(S.video){fs1.hidden=true;fs2.hidden=true;}
  const fa=$('#fsAssist');fa.hidden=ba.hidden;fa.disabled=ba.disabled;
  $('#mbText').textContent=$('#phaseTitle').textContent;const m1=$('#mbStrike'),m2=$('#mbAssist'),m3=$('#mbEnd');
  m1.hidden=fs1.hidden;m1.disabled=fs1.disabled;m1.textContent=S.mode==='strike'?'取消打擊 '+pts:(atkP?'火力打擊 ':'縱深打擊 ')+pts;m1.classList.toggle('on',bs.classList.contains('on'));m2.hidden=ba.hidden;m2.disabled=ba.disabled;m3.hidden=$('#btnEnd').hidden;m3.disabled=$('#btnEnd').disabled;
  const sh=h&&S.sel&&S.sel.type==='hk'&&alive(S.sel);$('#btnHkHome').hidden=!(sh&&!S.sel.moved);$('#btnHkWpn').hidden=!sh;$('#btnHkWpn').textContent=TX('武器：')+TX({auto:'自動',tp:'只用魚雷',hm:'只用魚叉'}[hkPref()]);
  const ua=h&&undoAvail();$('#btnUndo').hidden=!ua;$('#mbUndo').hidden=!ua;
}
function unitStatusList(u,h){ // 單位狀態說明（資訊卡與滑鼠提示共用）
  const st=[];
  if(atSea(u))st.push('海上航行中');
  if(isBde(u)&&u.side==='atk'&&isLand(h)&&h.isl==='CN'&&!u.ship&&freeShipKind(u,h)===null)st.push('沒有可用的運輸船，要等船返航才能出海');
  if(u.ship){const sh=shipOf(u);if(sh)st.push('乘坐'+TYPES[sh.type].n+(sh.type==='ro'?'（只能在港口卸載）':'（可搶灘）'));}
  if(u.boundTo){const b=S.units.find(x=>x.id===u.boundTo);st.push('載著'+(b?TYPES[b.type].n+'（'+(plainT()?'戰力 '+pctU(b)+'%':b.hp+' 步')+'）':'旅')+'：船沉了，船上的旅一起損失');}
  if((u.type==='lst'||u.type==='ro')&&u.ret)st.push('卸載完畢，正返航大陸港口');
  if(cvOOA(u))st.push('失去戰鬥能力（飛行甲板受損）：艦載機無法起降，撤離戰場中；攻擊方不會再優先打它');
  if(isLch(u)&&u.veh!=null&&u.side==='def'&&S.phase==='atk'&&S.started&&!S.over){const n=lchFound(u,'bm');st.push(n>0?'攻方本階段偵察找到 '+n+' 輛，可打擊':'攻方本階段偵察沒有找到（或找到的都打過了），無法打擊');}
  if(isLch(u)&&u.veh!=null){const b=ssmBroken(u);st.push('發射車 '+u.veh+' 輛（可射 '+ssmReady(u)+(b?'、火力受損修復中 '+b:'')+'）');if(u.mT&&S.turn<u.mT)st.push('機動受損：維持暴露到下一個攻方階段結束');}
  if(u.type==='ssm'||u.type==='hmr'||u.type==='mlrs')st.push(u.revealed?'已暴露（上階段開火）':'隱蔽中：火力打擊多半打到誘餌');
  if((u.type==='cv'||u.type==='csg')&&S.air){const c=cvwCarriers(u.side==='atk'?'atk':'def').find(x=>x.u===u);if(c){const sp=u.side==='atk'?cvwA(c.i):S.cvwA&&S.cvwA.def&&S.cvwA.def[c.ui];
    st.push('艦載機 '+Math.round(c.i<0?S.air.usF[c.ui]:S.air.cvF[c.i])+' 架（每回合約 '+Math.round(c.sor)+' 架次，作戰半徑 '+c.w.r+' 格）、'+c.nm+' '+Math.max(0,u.wmag||0)+' 枚（射程 '+c.w.asmR+' 格，對艦打擊距離 '+(c.w.r+c.w.asmR)+' 格）'+(sp?'；本回合任務：制空 '+Math.round(sp[0]*100)+'%、對艦 '+Math.round(sp[1]*100)+'%、對地 '+Math.round(sp[2]*100)+'%':''));}}
  if(u.fl){const A=fleetAgg(u);st.push('組成：'+fleetTxt(u)+'；防空飛彈 '+u.mag.ad+' 枚（涵蓋 '+A.adR+' 格）、反艦飛彈 '+u.mag.asm+' 枚（射程 '+A.asmR+' 格，每艘每次齊射 '+FLEET_PER+' 枚）');}
  if(isEsc(u)&&u.mag){const W=SHIPW[u.type];st.push('防空飛彈 '+u.mag.ad+' 枚（涵蓋 '+W.adR+' 格）、'+W.asmN+' '+u.mag.asm+' 枚（射程 '+W.asmR+' 格）'+(W.lam?'、對地飛彈 '+u.mag.lam+' 枚':'')+'；海上不能補充垂直發射管；跟著航艦移動');}
  if(u.type==='mlrs')st.push('雷霆2000：射程最遠約 40 km，面積火力、命中比海馬士低；彈藥庫存剩 '+(S.pools?S.pools.rocRkt:0)+' 點；開火後下一階段要再裝填'+(u.rl>0?'（再裝填中，本階段不能開火）':'')+'，本階段剩 '+(u.side===S.phase?u.shots:1)+' 發');
  if(u.type==='hmr')st.push('本階段剩 '+(u.side===S.phase?u.shots:Math.ceil(ssmReady(u)/HMR_PKG))+' 次齊射（每次最多 4 輛）：火箭彈射程約 80 km，庫存 '+Math.round(S.pools?S.pools.rocGml||0:0)+' 個莢艙；陸軍戰術飛彈射程約 300 km，庫存 '+Math.round(S.pools?S.pools.rocAtc||0:0)+' 枚飛彈');
  else if(u.type==='ssn')st.push('隱蔽：開火暴露、被護航艦發現才現身，無法被火力打擊；魚雷 '+u.tp+'、魚叉 '+u.hm+'、戰斧 '+u.mag.lam+' 枚（★推估），每回合移動最多約 '+Math.round(SPD.subMax*KM_HEX)+' km'+(u.grp?'，跟著航艦行動':''));
  else if(u.type==='nme'||u.type==='mdt')st.push('部署在日本領土，只能被基地打擊；'+(u.type==='nme'?'海軍打擊飛彈 '+u.mag.asm+' 枚（射程 '+NME.R+' 格）':'戰斧 '+u.mag.lam+' 枚、標準六型 '+u.mag.asm+' 枚（射程 '+MDT.R+' 格）')+'（★推估）');
  else if(u.type==='hk')st.push((subInPort(u)?'停在母港補給中：位置固定，可被飛彈與空襲打擊。':'在海上：一般看不見也打不到。')+'重型魚雷 '+(u.tp||0)+' / '+hkTp()+' 齊射（射程約 60 km）、魚叉飛彈 '+(u.hm||0)+' / '+HK_HM+' 枚（射程約 120 km）；射擊後暴露，可能遭反潛攻擊；回母港才能補彈');
  else if(isMsl(u))st.push('本階段剩 '+(u.side===S.phase?u.shots:(u.type==='ff'?1:u.type==='ssm'?(ssmReady(u)>0?Math.max(1,Math.round(2*ssmReady(u)/lchV0(u))):0):2))+' 發，射程約 '+Math.round((u.fl?fleetAgg(u).asmR:kmH(160))*KM_HEX)+' km');
  if(u.type==='abn'&&!u.dropped&&h.isl==='CN')st.push('待命空降');
  if(u.garrison)st.push('守備部隊');
  if(S.started&&u.side===S.phase)st.push(u.acted?'本階段已完成':u.moved?'已移動，仍可攻擊':'可行動');
  if(terrDef(h))st.push('地形防禦 +'+terrDef(h));
  return st;
}
function effNote(u){ // 攻防數值為什麼不是表定值：逐項列出修正
  const T=TYPES[u.type],a=[],sm=(k)=>sideMod(u,k);
  if(weak(u))a.push('受傷（'+(plainT()?'戰力剩 '+pctU(u)+'%':'剩 1 步')+'）攻防各 −1');
  if(unready(u))a.push('剛動員，裝備與人員編成中 攻防各 −1');
  const sa=sm('atk'),sd=sm('def');
  if(sa)a.push('事件／政策 攻擊 '+(sa>0?'+':'−')+Math.abs(sa));
  if(sd)a.push('事件／政策／工事 防禦 '+(sd>0?'+':'−')+Math.abs(sd));
  if(u.side==='atk'&&onTW(u)&&supply().over)a.push('補給不足 攻防各 −1');
  if(unitsAt(K(u.c,u.r)).filter(x=>!isShip(x)).length>1)a.push('同格多單位 防禦 −1');
  return a;
}
function syncLegend(first){const d=$('#lgd');if(!d)return;const mob=matchMedia('(max-width:960px)').matches;if(!mob)d.open=true;else if(first)d.open=false;} // 手機：圖例預設收合；桌機永遠展開
syncLegend(true);addEventListener('resize',()=>syncLegend(false));
function placeLoc(){ // 「回到台灣」按鈕：貼在地圖目前看得到的右下角（地圖比畫面高時也不會被擠到畫面外）
  const b=$('#btnLoc'),w=document.querySelector('.mapwrap');if(!b||!w)return;
  const r=w.getBoundingClientRect(),bar=document.querySelector('.mbar'),lim=bar&&getComputedStyle(bar).display!=='none'?bar.getBoundingClientRect().top:innerHeight; // fixed 元素的 offsetParent 是 null，不能用來判斷是否顯示
  const bottom=Math.min(r.bottom,lim,innerHeight),vis=!document.body.classList.contains('fin-open')&&r.height>0&&bottom-Math.max(r.top,0)>110&&S.started;
  b.style.display=vis?'flex':'none';if(!vis)return;
  b.style.left=(Math.min(r.right,innerWidth)-12-44)+'px';b.style.top=(bottom-12-44)+'px';
}
let locQ=0;const locReq=()=>{if(locQ)return;locQ=requestAnimationFrame(()=>{locQ=0;placeLoc();});};
addEventListener('scroll',locReq,true);addEventListener('resize',locReq);
function renderInfo(){renderInfoSide();syncUCard();locReq();}
function renderInfoSide(){
  const el=$('#info');
  if(FARSEL&&FARINFO[FARSEL]&&!S.sel){const f=FARINFO[FARSEL];
    el.innerHTML='<div class="eyebrow">外圍示意區 · '+FARWHO[f.w]+'</div><h2 style="color:var(--'+(f.w==='atk'?'atk':f.w==='us'?'us':'jp')+')">'+f.t+'</h2><div class="k">'+f.d+'<br>'+f.r+'</div><div class="k" style="margin-top:6px">這裡不是遊戲格，不能操作，只顯示各方火力的出發位置；距離為概略值，圖上位置為示意。</div>'+(matchMedia('(hover:none)').matches?'<button class="ghost" id="btnDetail" data-far="'+FARSEL+'">詳細資料</button>':'');return;}
  const hu=S.hoverId?S.units.find(x=>x.id===S.hoverId):null;
  const u=S.sel&&alive(S.sel)?S.sel:(S.hover?(hu&&K(hu.c,hu.r)===S.hover?hu:unitAt(S.hover)):null);
  const h=u?hexOf(u):(S.hover?TER[S.hover]:null);
  if(!h){el.innerHTML='<div class="k">點選地圖上的單位或地格查看資料。</div>';return;}
  let o='<div class="eyebrow">'+hname(h)+' · '+TERN[h.t]+(h.cliff?' · 斷崖':'')+(h.mud?' · 泥灘潮間帶':'')+(MINOR_PORTS[h.k]?' · 次要港口：'+MINOR_PORTS[h.k]+'（占領後補給 +2，不計入勝負條件）':'')+((S.bh&&S.bh[h.k]&&S.turn-S.bh[h.k]>=1&&S.owner[h.k]==='atk')?' · 灘頭堡（補給 +2）':'')+(isLand(h)?' · '+SIDE[S.owner[h.k]]+'控制':'')+'</div>';
  if(u){
    const T=TYPES[u.type];
    o+='<h2 style="color:var(--'+u.side+')">'+T.n+'</h2>';
    o+='<div class="stats"><div><b>'+effAtk(u)+'</b><span>攻擊</span></div><div><b>'+effDef(u)+'</b><span>防禦</span></div><div><b>'+T.mv+'</b><span>移動</span></div><div><b>'+hpCell(u)[0]+'</b><span>'+hpCell(u)[1]+'</span></div></div>';
    const en=effNote(u);if(en.length)o+='<div class="hint effn">數值修正：'+en.join('、')+'</div>';
    const st=unitStatusList(u,h);
    o+='<div class="hint">'+st.join(' · ')+'</div>';
    o+=fleetPanelHTML(u);if(h.t==='air'&&h.isl==='TW')o+=afPanelHTML(h.k);
    if(humanTurn()&&allyHuman()&&S.phase==='def'&&u.ally&&u.side==='def'){const ts=tomShooters(u);if(ts.length||(u.type==='csg'&&S.units.some(e=>e.grp===u.id&&e.mag&&e.mag.lam>0)))o+='<div class="cvord"><button class="ghost" id="btnTom"'+(ts.length?'':' disabled')+'>戰斧巡弋飛彈縱深打擊<small class="pn">（可發射 '+ts.length+' 艘、每次 '+LAM.per+' 枚）</small></button></div><div class="hint">按下後點地圖上的大陸基地；會先警告升級後果。</div>';}
    setTimeout(()=>{const bt=document.getElementById('btnTom');if(bt)bt.onclick=()=>{S.sel=u;S.mode=S.mode==='tom'?null:'tom';render();};const bv=document.getElementById('btnVolley'),bc=document.getElementById('btnCvw'),bl=document.getElementById('btnCvwL');if(bl)bl.onclick=()=>{S.sel=u;S.mode=S.mode==='cvwL'?null:'cvwL';render();};if(bv)bv.onclick=()=>{S.sel=u;S.mode=S.mode==='volley'?null:'volley';render();};if(bc)bc.onclick=()=>{S.sel=u;S.mode=S.mode==='cvw'?null:'cvw';render();};},0);
    if(matchMedia('(hover:none)').matches)o+='<button class="ghost" id="btnDetail" data-id="'+u.id+'">詳細資料（照片、說明、規則）</button>';
  } else if(h.t==='air'&&h.isl==='TW'){const lv=afLevel(h.k);o+='<div class="hint">機場：'+(S.owner[h.k]==='atk'?'被攻方占領（無法起降）':afTxt(h.k))+'；每個守方階段搶修好 1 條。守方空軍只能從還能用的機場起飛；整體可用機場能量 '+Math.round(afShare()*100)+'%。</div>'+afPanelHTML(h.k);
  } else o+='<div class="hint">'+(terrDef(h)?'地形防禦 +'+terrDef(h)+'。':'')+(h.coastal&&!h.cliff&&!h.mud&&h.t!=='mtn'&&h.isl!=='CN'&&h.isl!=='JP'&&h.k!==TAIPEI?'可供登陸。':'')+(h.isl==='JP'?'日本領土（'+(h.name||'琉球群島')+'）。'+(FARINFO[h.name]?FARINFO[h.name].d+FARINFO[h.name].r:'')+'目前沒有日本地面部隊棋子，暫不開放登陸。':'')+'</div>';
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
// 新手引導：人類操作的前 2 回合，依目前動作顯示「下一步該做什麼」，可按 ✕ 永久關閉
function coachUpdate(){
  let el=document.getElementById('coach');
  const off=(()=>{try{return localStorage.getItem('tsl-coach')==='off';}catch(e){return false;}})();
  const show=!off&&S&&S.started&&!S.over&&!S.sim&&!S.video&&!S.rec&&S.turn<=2&&humanTurn();
  if(!show){if(el)el.hidden=true;return;}
  const side=S.phase,col=side==='atk'?'紅色':'藍色',me=S.units.filter(u=>u.side===side),moved=me.some(u=>u.moved||u.acted);
  let step,txt;
  if(S.mode==='strike'){step='第 2 步：火力打擊';txt='點地圖上有橘圈的敵方目標來打擊；不想打了，再按一次「火力打擊」取消。';}
  else if(S.sel){step='第 2 步：下令';txt='點綠色格子＝移動；點橘圈的敵方單位＝攻擊。點空白處可取消選取。';}
  else if(!moved){step='第 1 步：選單位';txt='點一個'+col+'單位（例如沿岸的'+(side==='atk'?'兩棲旅，先讓它出航':'步兵旅')+'）。';}
  else{step='第 3 步：收尾';txt='還有單位想動就繼續；想打擊按「火力打擊」，不想一個個點就按「電腦代打」；做完按「結束階段」。';}
  if(!el){el=document.createElement('div');el.id='coach';el.className='coach';el.setAttribute('role','status');document.body.appendChild(el);}
  el.hidden=false;
  const key=step+txt;if(el.dataset.k!==key){el.dataset.k=key;el.innerHTML='<b>新手引導 · '+TX(step)+'</b>'+TX(txt)+'<button aria-label="'+TX('關閉引導')+'" title="'+TX('關閉引導（之後不再顯示）')+'">✕</button>';el.querySelector('button').onclick=()=>{try{localStorage.setItem('tsl-coach','off');}catch(e){}el.hidden=true;};}
}
/* ---------- 手機：點選資訊改成地圖上的小浮動卡片（可拖曳、可關閉，位置記在這台裝置） ---------- */
let UCmin=false;try{UCmin=localStorage.getItem('tsl-ucard-min')==='1';}catch(e){}
const UC={closedKey:null,key:null,min:UCmin};
function ucSetMin(v){UC.min=v;try{localStorage.setItem('tsl-ucard-min',v?'1':'0');}catch(e){}syncUCard();}
const ucFloat=()=>matchMedia('(max-width:960px)').matches;
function syncUCard(){
  const el=$('#info'),cd=$('#ucard');if(!cd)return;
  if(!ucFloat()){cd.hidden=true;return;}
  const fresh=el.innerHTML!=='',src=fresh?el:$('#ucBody'),has=!!(src.querySelector('h2')||src.querySelector('.stats'));
  const key=(FARSEL&&!S.sel?'far:'+FARSEL:S.sel?'u'+S.sel.id:S.hoverId?'u'+S.hoverId:S.hover?'h'+S.hover:'')+'|'+S.turn;
  if(key!==UC.key){UC.key=key;UC.closedKey=null;}
  const chip=$('#ucChip');
  if(!has||UC.closedKey===key){cd.hidden=true;chip.hidden=true;return;}
  if(fresh){$('#ucBody').innerHTML=el.innerHTML;el.innerHTML='';}
  const h2=$('#ucBody').querySelector('h2'),ey=$('#ucBody').querySelector('.eyebrow');chip.textContent='▢ '+((h2||ey||{}).textContent||'資訊');
  cd.hidden=UC.min;chip.hidden=!UC.min;if(!UC.min)ucPlace();
}
function ucPlace(){
  const cd=$('#ucard');let pos=null;try{pos=JSON.parse(localStorage.getItem('tsl-ucard-pos')||'null');}catch(e){}
  if(!pos||typeof pos.fx!=='number'){cd.classList.remove('moved');cd.style.left=cd.style.top='';return;}
  cd.classList.add('moved');const w=cd.offsetWidth||220,h=cd.offsetHeight||140;
  cd.style.left=Math.max(4,Math.min(innerWidth-w-4,pos.fx*innerWidth))+'px';cd.style.top=Math.max(4,Math.min(innerHeight-h-4,pos.fy*innerHeight))+'px';
}
(function(){
  const cd=$('#ucard');if(!cd)return;let d=null;
  cd.addEventListener('pointerdown',e=>{if(e.target.closest('#ucClose,#ucMin,button'))return;if(e.target.closest('#ucBody')&&!e.target.closest('h2,.eyebrow,.stats'))return; // 內容區：手指滑動是捲動，不是拖曳視窗
    const r=cd.getBoundingClientRect();d={dx:e.clientX-r.left,dy:e.clientY-r.top,moved:false};try{cd.setPointerCapture(e.pointerId);}catch(x){}});
  cd.addEventListener('pointermove',e=>{if(!d)return;d.moved=true;cd.classList.add('moved');const w=cd.offsetWidth,h=cd.offsetHeight;
    cd.style.left=Math.max(4,Math.min(innerWidth-w-4,e.clientX-d.dx))+'px';cd.style.top=Math.max(4,Math.min(innerHeight-h-4,e.clientY-d.dy))+'px';});
  const end=()=>{if(!d)return;if(d.moved){try{localStorage.setItem('tsl-ucard-pos',JSON.stringify({fx:parseFloat(cd.style.left)/innerWidth,fy:parseFloat(cd.style.top)/innerHeight}));}catch(e){}}d=null;};
  cd.addEventListener('pointerup',end);cd.addEventListener('pointercancel',end);
  $('#ucClose').onclick=()=>{UC.closedKey=UC.key;cd.hidden=true;};
  $('#ucMin').onclick=()=>ucSetMin(true);$('#ucChip').onclick=()=>ucSetMin(false);
  cd.addEventListener('dblclick',()=>{try{localStorage.removeItem('tsl-ucard-pos');}catch(e){}ucPlace();}); // 連點兩下回到右下角
  addEventListener('resize',()=>{if(!cd.hidden)ucPlace();else syncUCard();});
})();
(function(){ // 天候膠囊：整顆可拖曳；放開時離畫面邊緣 40 px 內就吸到那個邊（靠近角落吸到角落），位置記在這台裝置
  const w=$('#wxWin');if(!w)return;let d=null,pos=null;const SNAP=40,M=8;
  const bottomBar=()=>{const b=document.querySelector('.mbar');return b&&getComputedStyle(b).display!=='none'?b.offsetHeight:0;}; // 手機底部操作列
  function apply(){
    if(!pos)return;const ww=w.offsetWidth||120,hh=w.offsetHeight||30;
    w.style.left=w.style.right=w.style.top=w.style.bottom='auto'; // 用 auto 蓋掉 CSS 預設的 left／top，否則同時設 right／bottom 會把膠囊拉大
    if(pos.h==='l')w.style.left='calc('+M+'px + env(safe-area-inset-left,0px))';
    else if(pos.h==='r')w.style.right='calc('+M+'px + env(safe-area-inset-right,0px))';
    else w.style.left=Math.max(0,Math.min(innerWidth-ww,pos.fx*innerWidth))+'px';
    if(pos.v==='t')w.style.top='calc('+M+'px + env(safe-area-inset-top,0px))';
    else if(pos.v==='b')w.style.bottom='calc('+(M+bottomBar())+'px + env(safe-area-inset-bottom,0px))';
    else w.style.top=Math.max(0,Math.min(innerHeight-hh,pos.fy*innerHeight))+'px';
  }
  function snap(){ // 依目前位置決定吸附的邊
    const r=w.getBoundingClientRect(),bb=bottomBar();
    pos={h:r.left<SNAP?'l':innerWidth-r.right<SNAP?'r':'x',v:r.top<SNAP?'t':innerHeight-bb-r.bottom<SNAP?'b':'y',fx:r.left/innerWidth,fy:r.top/innerHeight};
    apply();try{localStorage.setItem('tsl-wx-pos',JSON.stringify(pos));}catch(e){}
  }
  window.TSL_WXSNAP=snap; // 手把拖曳放開後也吸附
  {const mw=document.querySelector('.mapwrap');if(mw&&window.IntersectionObserver)new IntersectionObserver(es=>{const e=es[es.length-1];w.classList.toggle('offmap',e.intersectionRect.height<120);},{threshold:[0,.05,.1,.2,.35,.5,.75,1]}).observe(mw);} // 捲到地圖以外就隱藏，不蓋住下面的內容
  try{const p=JSON.parse(localStorage.getItem('tsl-wx-pos')||'null');if(p&&typeof p.fx==='number'){pos={h:p.h||'x',v:p.v||'y',fx:p.fx,fy:p.fy};apply();}}catch(e){}
  w.addEventListener('pointerdown',e=>{const r=w.getBoundingClientRect();d={x0:e.clientX,y0:e.clientY,dx:e.clientX-r.left,dy:e.clientY-r.top,id:e.pointerId,moved:false};});
  addEventListener('pointermove',e=>{if(!d||e.pointerId!==d.id)return;
    if(!d.moved){if(Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<6)return;d.moved=true;w.classList.add('drag');try{w.setPointerCapture(d.id);}catch(x){}}
    w.style.right=w.style.bottom='';w.style.left=Math.max(0,Math.min(innerWidth-w.offsetWidth,e.clientX-d.dx))+'px';w.style.top=Math.max(0,Math.min(innerHeight-w.offsetHeight,e.clientY-d.dy))+'px';e.preventDefault();});
  const end=()=>{if(!d)return;const mv=d.moved;d=null;w.classList.remove('drag');if(mv){snap();const blk=ev=>{ev.stopPropagation();ev.preventDefault();};addEventListener('click',blk,{capture:true,once:true});setTimeout(()=>removeEventListener('click',blk,{capture:true}),300);}}; // 拖曳結束後吞掉這次 click，不要彈出說明
  addEventListener('pointerup',end);addEventListener('pointercancel',end);
  addEventListener('resize',()=>{wxWinSync();renderStatus();apply();});
})();
function render(){coachUpdate();if(S.rec)recordFrame();else{renderAll();if(FXQ.length)playFx(FXQ.splice(0));}const rb=$('#btnRestart');if(rb)rb.hidden=!(S.started&&!S.over&&!S.video);{const on=!!S.started;const nb=$('#btnNew');if(nb)nb.hidden=!on;const fb=$('#fsNew');if(fb)fb.hidden=!on;const mb=$('#mNew');if(mb)mb.hidden=!on;}const ab=$('#btnAI');if(ab)ab.hidden=!(S.started&&!S.over&&!S.video&&!S.sim&&(S.ctrl.atk==='human'||S.ctrl.def==='human'));}
$('#btnRestart').onclick=()=>restartGame();$('#btnNew').onclick=()=>restartGame();$('#mNew').onclick=()=>restartGame();$('#fsNew').onclick=()=>restartGame(); // 隨時都能放棄這一局（含電腦推演、影片播放、事件視窗開著時）
$('#btnAI').onclick=()=>{
  if(!S.started||S.over||S.video||S.sim)return;
  const hs=['atk','def'].filter(k=>S.ctrl[k]==='human');if(!hs.length)return;
  if(!confirm(TX('改由電腦接手？你操作的一方（')+hs.map(k=>TX(SIDE[k])).join('、')+TX('）之後都由電腦指揮，無法再取回。')))return;
  const was=S.ctrl[S.phase];hs.forEach(k=>{S.ctrl[k]='ai';});
  log('玩家改由電腦接手指揮（'+hs.map(k=>SIDE[k]).join('、')+'）');toast('已改由電腦接手');
  if(was==='human'&&!S.busy&&!S.over)runAI(S.phase);
  render();
};
