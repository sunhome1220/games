'use strict';
/* ---------- 動畫：特效佇列、飛彈與戰機飛行、攔截、爆炸、齊射、空降等（2026-11-14.94 由 fx.js 拆出）---------- */
const FXQ=[];
const fxPos=h=>TER[K(h[0],h[1])]?cen(h[0],h[1]):center(h[0],h[1]); // 格子座標 [c,r] → 畫面位置（地圖外的外圍格用 center）
const SVGNS='http://www.w3.org/2000/svg';
let PREVIEW=false;
const fxq=o=>{if(!PREVIEW)FXQ.push(o);};
// 齊射動畫：n 枚反艦飛彈飛向船艦；目標或護航艦有防空時，畫出攔截彈升空：攔下的空中爆炸、突破的命中或落海，最後顯示「攔截 X／命中 Y」
const fxSalvo=(from,t,r,air)=>{if(!PREVIEW)FXQ.push({t:'salvo',from,to:[t.c,t.r],n:r.n,I:r.I,surv:r.surv,hits:r.hits,side:t.side,air:air||null});}; // air＝{km:飛彈射程, lost:被防空擊落架數}：戰機先飛到發射點再放飛彈
const fxCapX=(from,t)=>{if(!PREVIEW)FXQ.push({t:'capx',from,to:[t.c,t.r]});}; // 打擊機群半途遭艦載機攔截
const fxToast=(s,ms)=>{if(PREVIEW)return;FXQ.push({t:'toast',s,ms});}; // 打擊結果的訊息：等飛彈或戰機飛到、爆炸後才跳出
const reduce=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
let FXSPD=1;const fxK=()=>((S&&S.video&&V.sp)?Math.max(.2,1/V.sp):1)/FXSPD; // 動畫速度設定：0.5／1／2／4 倍
function el(tag,at,parent){const e=document.createElementNS(SVGNS,tag);for(const k in at)e.setAttribute(k,at[k]);if(!parent)e.__t=performance.now();(parent||document.getElementById('gF')).appendChild(e);return e;}
function tween(ms,fn,end){ms*=fxK();const t0=performance.now();(function f(t){const k=Math.min(1,Math.max(0,(t-t0)/ms));fn(k);if(k<1)requestAnimationFrame(f);else if(end)end();})(t0);}
function bez(a,c,b,t){const u=1-t;return [u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]];}
const FXS=()=>Math.max(.55,SC)*(typeof ZOOM!=='undefined'&&ZOOM>5?5/ZOOM:1); // 特效尺寸：跟著格子大小縮小，放大到 500% 以上時不再變大
function fxFlash(p,r1,r2,col,ms,par){r1*=FXS();r2*=FXS();const e=el('circle',{cx:p[0],cy:p[1],r:r1,fill:col,opacity:.9},par);tween(ms,k=>{e.setAttribute('r',r1+(r2-r1)*k);e.setAttribute('opacity',.9*(1-k));},()=>e.remove());}
function fxRing(p,r1,r2,col,ms,w,par){r1*=FXS();r2*=FXS();w=(w||2)*FXS();const e=el('circle',{cx:p[0],cy:p[1],r:r1,fill:'none',stroke:col,'stroke-width':w||2},par);tween(ms,k=>{e.setAttribute('r',r1+(r2-r1)*k);e.setAttribute('opacity',1-k);},()=>e.remove());}
function fxSparks(p,n,len,col,ms){len*=FXS();const ls=[];for(let i=0;i<n;i++)ls.push([el('line',{stroke:col,'stroke-width':2,'stroke-linecap':'round'}),Math.PI*2*i/n+NR()*.6]);
  tween(ms,k=>{ls.forEach(([l,a])=>{const r0=4+len*k*.55,r1=4+len*k;l.setAttribute('x1',p[0]+Math.cos(a)*r0);l.setAttribute('y1',p[1]+Math.sin(a)*r0*.8);l.setAttribute('x2',
      p[0]+Math.cos(a)*r1);l.setAttribute('y2',p[1]+Math.sin(a)*r1*.8);l.setAttribute('opacity',1-k);});},()=>ls.forEach(([l])=>l.remove()));
    }
function fxText(p,s,cls,ms){const f=Math.max(.6,SC),t=el('text',{x:p[0],y:p[1]-18*f,class:'fxt '+cls,'text-anchor':'middle',style:'font-size:'+(13*f).toFixed(1)+'px;stroke-width:'+(3*f).toFixed(1)+'px'});t.textContent=s; // 字級隨格子大小縮放
  tween(ms||950,k=>{t.setAttribute('y',p[1]-18*f-18*f*k);t.setAttribute('opacity',k<.65?1:1-(k-.65)/.35);},()=>t.remove());}
function fxImpact(p,hit,sea,big){
  if(hit){fxFlash(p,3,big?26:16,'#ffb347',380);fxFlash(p,2,big?14:9,'#fff3c4',260);fxRing(p,4,big?32:21,'#ff7a3d',440,2.5);fxSparks(p,big?10:6,big?28:17,'#ffd45a',440);}
  else if(sea){fxRing(p,3,17,'#ffffff',560,2);fxRing(p,2,10,'#cfeaf5',440,1.5);}
  else fxFlash(p,3,13,'#cfc7ae',440);
}
let PUFFN=0; // 同時存在的煙團數量上限，避免齊射時節點太多
function fxPuff(p,r1,r2,col,op,ms){r1*=FXS();r2*=FXS();
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
    const sh=FXSHAPE[o.shape]||FXSHAPE.asm,fs0=FXS(),sz=(o.r||3)/2.8*.9*(sh.s||1)*fs0,big=(o.arc||0)>60,g=el('g',{});
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
        segs[i].setAttribute('stroke',f<.3?(o.trail||'#ffb347'):'#e6e6e6');segs[i].setAttribute('stroke-width',((o.w||2)*fs0*(1.15-f*.85)).toFixed(2));segs[i].setAttribute('opacity',(.8*(1-f)).toFixed(2));
      }
      const now=performance.now();
      if(sh.puff&&!reduce()&&now-lastPuff>gap&&k>.03&&k<.97){lastPuff=now;fxPuff(at(k-.025),(1.5*sz+.5)/fs0,((big?7:4.6)*sz+2)/fs0,'#f0f0f0',big?.8:.65,(big?1200:820));}
    },()=>{g.remove();segs.forEach(x=>x.remove());if(o.end)o.end();});
    return;
  }
  const dot=el('circle',{r:(o.r||3)*FXS(),fill:o.color||'#ffe08a'}),trail=el('path',{fill:'none',stroke:o.trail||'#ffb347','stroke-width':(o.w||2)*FXS(),'stroke-linecap':'round',opacity:.85});
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
      const bk=Math.atan2(a[1]-rel[1],a[0]-rel[0]);tween(fxDur('plane',Math.hypot(a[0]-rel[0],a[1]-rel[1])),t=>{const x=rel[0]+(a[0]-rel[0])*t,y=rel[1]+(a[1]-rel[1])*t;pl.setAttribute('transform',
          'translate('+x.toFixed(1)+' '+y.toFixed(1)+') rotate('+(bk*180/Math.PI).toFixed(0)+') scale(.85)');pl.setAttribute('opacity',t<.85?1:Math.max(0,1-(t-.85)/.15));},
          ()=>pl.remove()); // 導引炸彈：有彈體、沿落下方向飛（不再是圓球）
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
  const f=FXS(),SC=.5*f,off=(opt&&opt.one?[[0,0]]:[[7,0],[-5,-9],[-5,9]]).map(([x,y])=>[x*f,y*f]);g._pl=[];
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
    tween(760,k=>{v.el.setAttribute('transform','translate('+(v.dx+10*k)+' '+(v.dy+28*k*k+6*k)+') rotate('+(k*160).toFixed(0)+') scale('+(.5*FXS()*(1-.4*k))+')');v.el.setAttribute('opacity',1-k*k);if(!LITE&&NR()<.4)fxPuff([p[0]+10*k+v.dx,p[1]+28*k*k+v.dy],2,5,'#4a4a4a',.7,560);},()=>{v.el.remove();
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

function runFx(o){
  if(o.t==='toast'){toast(o.s,o.ms);return;}
  if(o.t==='capx'){const PP=fxPos,a=PP(o.from),b=PP(o.to),m=[a[0]+(b[0]-a[0])*.55,a[1]+(b[1]-a[1])*.55];
    fxFlight(a,m,'plane',()=>{fxShot([b[0],b[1]-20],m,{arc:-20,dur:420,color:'#ffd9d0',trail:'#ff6a4a',w:1.2,r:2,style:'mis',shape:'sam',end:()=>{fxFlash(m,3,22,'#ff9a3c',420);fxSparks(m,8,24,'#ffd45a',420);fxText(m,'遭艦載機攔截','def',1100);}});});return;}
  if(o.t==='salvo'&&o.air){const PP=fxPos,a=PP(o.from),b=PP(o.to),d=Math.hypot(b[0]-a[0],b[1]-a[1]),rp=o.air.km/KM_HEX*HPX,k=d>rp?(d-rp)/d:0,lp=[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k],T=k>0?fxDur('plane',d-rp):0;
    if(k>0)fxFlight(a,lp,'plane',()=>{}); // 戰機飛到離目標約一個飛彈射程的發射點
    if(o.air.lost)setTimeout(()=>{fxShot([b[0],b[1]-18],lp,{arc:-30,dur:600,color:'#d6f3ff',trail:'#6ec6ff',w:1.4,r:2.2,style:'mis',shape:'sam',end:()=>{fxFlash(lp,3,24,'#ff9a3c',460);fxSparks(lp,8,26,'#ffd45a',460);fxText(lp,'擊落 '+o.air.lost+' 架','def',1200);}});},T*.6*fxK());
    setTimeout(()=>runFx(Object.assign({},o,{air:null,fromPx:lp})),T*fxK());return;}
  if(o.t==='salvo'){const PP=fxPos,a=o.fromPx||PP(o.from),b=PP(o.to),sh=Math.max(1,Math.min(6,o.n)),f=sh/o.n;
    const ni=o.I>0?Math.min(sh,Math.round((o.n-o.surv)*f)):0,nh=o.hits>0?Math.max(1,Math.min(sh-ni,Math.round(o.hits*f))):0,cls=o.side==='def'?'def':'atk';
    for(let i=0;i<sh;i++){const a2=[a[0]+(NR()-.5)*10,a[1]+(NR()-.5)*10],md=i<ni?'int':'pass',hit=i>=ni&&i<ni+nh;
      setTimeout(()=>{if(o.I>0)fxIntercept(a2,b,'asm',md,hit,true,cls);else fxFlight(a2,b,'asm',()=>fxImpact(b,hit,true,true));},i*110*fxK());}
    setTimeout(()=>fxText(b,(o.I>0?'攔截 '+Math.round(o.n-o.surv)+'／':'')+'命中 '+o.hits,o.hits?'dead':cls,1400),(fxDur('asm',Math.hypot(b[0]-a[0],b[1]-a[1]))+sh*110+300)*fxK());
    return;}
  const PO=h=>{const q=oCenter(h[0],h[1]);return [q[0]*KS,q[1]*KS];}; // 外圍／港口出發點（舊座標）
  const P=fxPos;
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
  }else if(o.t==='dog'){fxDog(o);
  }else if(o.t==='drop'){fxDrop(o);}
}
function fxDrop(o){ // 空降：運輸機群從大陸飛到落點；被擊落的半路爆炸，其餘在落點降下傘花
  const PO=fxPos,a=PO(o.from),b=PO(o.at),dd=Math.hypot(b[0]-a[0],b[1]-a[1]),T=fxDur('plane',dd),ang=Math.atan2(b[1]-a[1],b[0]-a[0]);
  const pl=airGlyph('bm','#dfe4e8',{glow:true});pl.setAttribute('data-sc','1');const kx=o.fail?.6:1;
  tween(T*kx,t=>{const x=a[0]+(b[0]-a[0])*t*kx,y=a[1]+(b[1]-a[1])*t*kx-10;pl.setAttribute('transform','translate('+x.toFixed(1)+' '+y.toFixed(1)+') rotate('+(ang*180/Math.PI).toFixed(0)+') scale(.9)');},()=>{
    if(o.fail){const p=[a[0]+(b[0]-a[0])*.6,a[1]+(b[1]-a[1])*.6-10];pl.remove();fxFlash(p,4,30,'#ff9a3c',520);fxSparks(p,10,30,'#ffd45a',520);fxText(p,'運輸機群被擊落','dead',1200);return;}
    for(let i=0;i<5;i++){const q=[b[0]+(i-2)*7*FXS(),b[1]-26*FXS()],c=el('path',{d:'',fill:'#fff',stroke:'#7a8a96','stroke-width':.8,opacity:.95},document.getElementById('gF'));
      tween(900,k=>{const y=q[1]+26*FXS()*k,r=4*FXS();c.setAttribute('d','M'+(q[0]-r).toFixed(1)+' '+y.toFixed(1)+'a'+r.toFixed(1)+' '+r.toFixed(1)+' 0 0 1 '+(2*r).toFixed(1)+' 0z');c.setAttribute('opacity',(k<.8?.95:.95*(1-(k-.8)/.2)).toFixed(2));},()=>c.remove());}
    fxText(b,'空降','def',1000);{const u=S.units.find(x=>x.id===o.id);if(u&&u.dropHide){u.dropHide=0;render();}} // 傘花落下時，空降旅才出現在地圖上
    tween(600,t=>{pl.setAttribute('transform','translate('+(b[0]+Math.cos(ang)*40*t).toFixed(1)+' '+(b[1]-10+Math.sin(ang)*40*t).toFixed(1)+') rotate('+(ang*180/Math.PI).toFixed(0)+') scale(.9)');pl.setAttribute('opacity',(1-t).toFixed(2));},()=>pl.remove());});
  if(o.lost&&!o.fail)setTimeout(()=>{const p=[a[0]+(b[0]-a[0])*.55,a[1]+(b[1]-a[1])*.55-10];fxFlash(p,3,22,'#ff9a3c',460);fxSparks(p,8,24,'#ffd45a',460);fxText(p,'部分被擊落','dead',1000);},T*.55*fxK());
}
// 一發武器從開始到命中（或攔截）的時間（毫秒，未乘播放速度）；公式與 fxFlight／fxShot／fxHimars／fxSub 相同
function fxArrive(o){
  const PO=h=>{const q=oCenter(h[0],h[1]);return [q[0]*KS,q[1]*KS];},P=fxPos;
  const fl=(k,d)=>k==='bomb'?fxDur('plane',d*.72)+fxDur('bomb',d*.28):fxDur(k,d);
  const dist=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  try{
    if(o.t==='air'){const b=P(o.at),src=o.src||'w',s=o.from?P(o.from):o.org?PO(o.org):src==='w'?[b[0]-200,b[1]-150]:src==='e'?[b[0]+200,b[1]-165]:[b[0],b[1]-230],dd=dist(s,b);
      if((o.org||o.from)&&o.k)return fl(o.ad&&o.k==='bomb'?'cm':o.k,dd);return (o.org||o.from)?Math.min(900,260+dd*.7):420;}
    if(o.t==='msl')return fl('asm',dist(P(o.from),P(o.to)));
    if(o.t==='cva')return cvaGeo(o).tot;
    if(o.t==='salvo'){const q=fxPos,d=dist(q(o.from),q(o.to)),rp=o.air?o.air.km/KM_HEX*HPX:d;return (o.air&&d>rp?fxDur('plane',d-rp):0)+fl('asm',Math.min(d,rp))+Math.min(6,o.n)*110+300;}
    if(o.t==='capx'){const q=fxPos;return fxDur('plane',dist(q(o.from),q(o.to))*.55)+420;}
    if(o.t==='drop'){const q=fxPos;return fxDur('plane',dist(q(o.from),q(o.at)))+900;}
    if(o.t==='atk')return o.sea?340:260+2*95;
    if(o.t==='hmr'){const dd=dist(cen(o.from[0],o.from[1]),cen(o.to[0],o.to[1]));return fxDur(o.atc?'atc':'rkt',dd)+(o.atc?0:2*120);}
    if(o.t==='sub'){const dd=dist(cen(o.from[0],o.from[1]),cen(o.to[0],o.to[1]));return o.w==='hm'?360+fl('asm',dd):fl('torp',dd);}
  }catch(e){}
  return 400;
}
function playFx(list){
  if(!list||!list.length)return;if(reduce()){list.filter(o=>o.t==='toast').forEach(o=>toast(o.s,o.ms));return;}
  const g=document.getElementById('gF'),now=performance.now();
  if(g.childNodes.length>70){for(const n of [...g.childNodes]){if(!n.__t)n.__t=now;else if(now-n.__t>4000)n.remove();}} // 只清掉超過 4 秒的舊特效，正在播放的不刪
  while(g.childNodes.length>1200)g.removeChild(g.firstChild); // 安全網：避免異常時無限累積
  let t=ANIM.slid?300:0,last=t,hitAt=t;const k=fxK();ANIM.slid=false; // 單位還在滑到新位置：等它到了再開火
  const nShots=list.filter(x=>x.t==='air'||x.t==='msl').length,stepAir=nShots>=8?45:nShots>=4?85:170,stepMsl=nShots>=8?45:nShots>=4?70:110; // 齊射：發數多時間隔縮短，看起來是一起發射
  list.forEach(o=>{
    let start;
    if(o.t==='atk'||o.t==='msl'||o.t==='hmr'||o.t==='sub'||o.t==='air'||o.t==='tfa'||o.t==='cva'||o.t==='drop'||o.t==='salvo'||o.t==='capx'){start=t;last=t;hitAt=t+(o.t==='tfa'?tfaDur(o):fxArrive(o));t+=(o.t==='air'?stepAir:o.t==='atk'?70:stepMsl);}
    else if(o.t==='dmg'||o.t==='dead'||o.t==='txt'||o.t==='toast')start=Math.max(last+360,hitAt+80); // 等這一發武器飛到、爆炸後才顯示結果
    else start=0;
    if(start>0)setTimeout(()=>runFx(o),start*k);else runFx(o);
  });
}
