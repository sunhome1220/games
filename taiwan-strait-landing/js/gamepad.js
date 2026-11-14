/* 手把原型（Gamepad API）：左搖桿移動游標、✕＝點選、△＝火力打擊、Options＝結束階段、○＝取消。
   只在偵測到手把時啟動；滑鼠與觸控不受影響。DualSense 在 Chrome 用標準對應（0=✕ 1=○ 3=△ 9=Options）。 */
(function(){
  if(!navigator.getGamepads)return;
  const cur=document.createElement('div');
  cur.id='gpCur';cur.hidden=true;
  cur.style.cssText='position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid #f5c542;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.55);pointer-events:none;z-index:99';
  document.body.appendChild(cur);
  // 六角格游標：在地圖上、格子在螢幕上寬度 ≥ 14 px 時，黃圈換成框住整格的黃色六角框，左搖桿一次跳一格
  const NS='http://www.w3.org/2000/svg',hx=document.createElementNS(NS,'svg'),hp=document.createElementNS(NS,'polygon');
  hx.setAttribute('style','position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:99;display:none;overflow:visible');
  hp.setAttribute('style','fill:rgba(245,197,66,.16);stroke:#f5c542;stroke-width:3;stroke-linejoin:round;filter:drop-shadow(0 0 2px rgba(0,0,0,.7))');
  hx.appendChild(hp);document.body.appendChild(hx);
  const HEXMIN=14;let hexOn=false,hc=null,stepT=0,stepN=0;
  const mapEl=(px,py)=>{ // 該點最上層是地圖（或只被單位資訊卡蓋住）時，回傳地圖上的元素；被操作列等介面蓋住則回傳 null
    const es=document.elementsFromPoint?document.elementsFromPoint(px,py):[],t=es[0];if(!t)return null;
    if(!(t.closest('.mapwrap')||t.closest('#ucard')))return null;
    return es.find(e=>e.closest&&e.closest('#map'))||null;};
  const inWrap=(px,py)=>{const w=document.querySelector('.mapwrap');if(!w)return false;const b=w.getBoundingClientRect();return px>=b.left&&px<=b.right&&py>=b.top&&py<=b.bottom;};
  const toS=(m,px,py)=>[m.a*px+m.c*py+m.e,m.b*px+m.d*py+m.f];
  function hexAtCursor(){ // 回傳 {m,c,r} 或 null（不在地圖上、格子太小、有彈窗、不是遊戲格）
    const H=window.TSL_HEX,map=document.querySelector('#map'),mw=document.querySelector('.mapwrap');
    if(!H||!map||!mw||document.querySelector('#modal:not([hidden])'))return null;
    if(!inWrap(x,y)||!mapEl(x,y))return null;
    const m=map.getScreenCTM();if(!m||Math.sqrt(3)*H.R*Math.abs(m.a)<HEXMIN)return null;
    const iv=m.inverse(),px=iv.a*x+iv.c*y+iv.e,py=iv.b*x+iv.d*y+iv.f,cr=H.p2c(px,py);
    return cr&&H.ok(cr[0],cr[1])?{m,c:cr[0],r:cr[1]}:null;
  }
  function drawHex(m,c,r){const H=window.TSL_HEX,[px,py]=H.c2p(c,r),pts=[];
    for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-30);pts.push(toS(m,px+H.R*Math.cos(a),py+H.R*Math.sin(a)).map(v=>v.toFixed(1)).join(','));}
    hp.setAttribute('points',pts.join(' '));}
  let x=innerWidth/2,y=innerHeight/2,prev={},lastEl=null,running=false,on=false,drag=null,dragStarted=false,zt=0;
  const pickPad=()=>{const ps=navigator.getGamepads?navigator.getGamepads():[];for(const p of ps)if(p&&p.connected)return p;return null;};
  const dz=v=>Math.abs(v)<.2?0:v;
  function frame(){
    const pad=pickPad();
    if(!pad){on=false;cur.hidden=true;hx.style.display='none';running=false;document.body.classList.remove('gp');return;}
    if(!on){on=true;cur.hidden=false;x=innerWidth/2;y=innerHeight/2;document.body.classList.add('gp');}
    const lx=dz(pad.axes[0]||0),ly=dz(pad.axes[1]||0),vis=document.body.classList.contains('playing')||!!document.querySelector('#modal:not([hidden])');
    const hh=vis?hexAtCursor():null;
    if(hh){ // 六角格模式：游標固定在格子中心；推搖桿跳到該方向最接近的相鄰格（按住時連續跳）
      const H=window.TSL_HEX,m=hh.m;let c=hh.c,r=hh.r;
      if(Math.hypot(lx,ly)>.5){const now=Date.now();
        if(!stepT||now-stepT>(stepN===1?260:180)){stepT=now;stepN++;
          const [cx,cy]=toS(m,...H.c2p(c,r)),ang=Math.atan2(ly,lx);let best=null,bd=9;
          for(const [nc,nr] of H.nb(c,r)){const [sx,sy]=toS(m,...H.c2p(nc,nr)),d=Math.abs(Math.atan2(Math.sin(Math.atan2(sy-cy,sx-cx)-ang),Math.cos(Math.atan2(sy-cy,sx-cx)-ang)));if(d<bd){bd=d;best=[nc,nr,sx,sy];}}
          if(best){
            if(inWrap(best[2],best[3])&&mapEl(best[2],best[3])){c=best[0];r=best[1];window.TSL_RUMBLE&&TSL_RUMBLE('step');}
            else{x=Math.max(0,Math.min(innerWidth-1,best[2]));y=Math.max(0,Math.min(innerHeight-1,best[3]));hc=null;} // 走出可見的地圖：回到自由游標
          }
        }
      }else{stepT=0;stepN=0;}
      if(hc!==null||Math.hypot(lx,ly)<=.5||c!==hh.c||r!==hh.r){const [sx,sy]=toS(m,...H.c2p(c,r));x=sx;y=sy;hc=[c,r];drawHex(m,c,r);}
      hexOn=hc!==null;
    }else{
      hexOn=false;hc=null;stepT=0;stepN=0;
      x=Math.max(0,Math.min(innerWidth-1,x+lx*9));
      y=Math.max(0,Math.min(innerHeight-1,y+ly*9));
    }
    cur.style.left=x+'px';cur.style.top=y+'px';
    cur.style.display=vis&&!hexOn?'':'none';
    cur.hidden=cur.style.display==='none';
    hx.style.display=vis&&hexOn?'':'none';
    const el=hexOn?(mapEl(x,y)||document.elementFromPoint(x,y)):document.elementFromPoint(x,y); // 六角格模式：點的是地圖上那一格（不是蓋在上面的卡片）
    if(el&&el!==lastEl){lastEl=el;el.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,clientX:x,clientY:y}));}
    const b=i=>!!(pad.buttons[i]&&pad.buttons[i].pressed),press=i=>b(i)&&!prev[i];
    const ev=t=>new MouseEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y,view:window});
    // 右搖桿：平移地圖
    const mw=document.querySelector('.mapwrap');const ax=pad.axes;
    if(mw&&(dz(ax[2]||0)||dz(ax[3]||0))){mw.scrollLeft+=dz(ax[2]||0)*14;mw.scrollTop+=dz(ax[3]||0)*14;}
    // L2／R2：縮放（送出與 Ctrl＋滾輪相同的事件）
    const tv=i=>(pad.buttons[i]&&pad.buttons[i].value)||0;
    if(mw&&(tv(6)>.1||tv(7)>.1)&&(!zt||Date.now()-zt>140)){zt=Date.now();mw.dispatchEvent(new WheelEvent('wheel',{ctrlKey:true,deltaY:tv(7)>tv(6)?-100:100,bubbles:true,cancelable:true}));}
    // 按住 ✕ 拖曳天候膠囊或單位卡（天候膠囊放開時吸附到邊緣；沒移動就當作點一下）
    if(press(0)&&el&&!drag){
      const wx=el.closest('#wxWin'),uc=el.closest('#ucard');
      if(wx)drag={el:wx,mode:'move',dx:x-wx.getBoundingClientRect().left,dy:y-wx.getBoundingClientRect().top,key:'tsl-wx-pos',x0:x,y0:y,tgt:el};
      else if(uc&&!el.closest('button')&&!el.closest('#ucClose,#ucMin'))drag={el:uc,mode:'move',dx:x-uc.getBoundingClientRect().left,dy:y-uc.getBoundingClientRect().top,key:'tsl-ucard-pos'};
    }
    if(drag){
      if(drag.mode==='move'&&b(0)){drag.el.style.right=drag.el.style.bottom='';drag.el.style.left=Math.max(0,Math.min(innerWidth-drag.el.offsetWidth,x-drag.dx))+'px';drag.el.style.top=Math.max(0,Math.min(innerHeight-40,y-drag.dy))+'px';}
      if(drag.mode==='resize'&&b(4)){const r=drag.el.getBoundingClientRect();drag.el.style.width=Math.max(150,x-r.left)+'px';drag.el.style.height=Math.max(44,y-r.top)+'px';}
      if((drag.mode==='move'&&!b(0))||(drag.mode==='resize'&&!b(4))){
        if(drag.key==='tsl-wx-pos'){if(Math.hypot(x-drag.x0,y-drag.y0)<6){if(drag.tgt)drag.tgt.dispatchEvent(ev('click'));}else if(window.TSL_WXSNAP)TSL_WXSNAP();} // 天候膠囊：沒移動＝點一下；有移動就吸附並記住
        else try{localStorage.setItem(drag.key,JSON.stringify({fx:parseFloat(drag.el.style.left)/innerWidth,fy:parseFloat(drag.el.style.top)/innerHeight}));}catch(e){}
        drag=null;
      }
    }
    if(press(0)&&el&&!dragStarted&&!drag){el.dispatchEvent(ev('click'));window.TSL_RUMBLE&&TSL_RUMBLE('tap');}
    dragStarted=b(0)&&!!drag;
    if(press(3)){const s=document.querySelector('#btnStrike');if(s&&!s.disabled&&!s.hidden)s.click();}
    if(press(9)){const e=document.querySelector('#btnEnd');if(e&&!e.disabled&&!e.hidden)e.click();}
    if(press(1)){const c=document.querySelector('#modal:not([hidden]) .ghost, #modal:not([hidden]) button#cfN');if(c)c.click();}
    prev={0:b(0),1:b(1),3:b(3),9:b(9)};
    requestAnimationFrame(frame);
  }
  const start=()=>{if(!running){running=true;requestAnimationFrame(frame);}};
  addEventListener('gamepadconnected',()=>{document.body.classList.add('gp');start();});
  addEventListener('gamepaddisconnected',()=>{on=false;cur.hidden=true;hx.style.display='none';if(!pickPad())document.body.classList.remove('gp');});
  // 震動（Gamepad vibrationActuator；不支援時靜默略過）。localStorage tsl-rumble=0 可關閉
  let lastRum=0;
  window.TSL_RUMBLE=k=>{
    try{if(localStorage.getItem('tsl-rumble')==='0')return;}catch(e){}
    const now=Date.now();if(now-lastRum<120)return;lastRum=now;
    const P={step:[0,.22,35],tap:[.1,.3,60],hit:[.6,.3,180],turn:[.3,.1,120],end:[.8,.5,500]}[k];if(!P)return;
    for(const p of (navigator.getGamepads?navigator.getGamepads():[])){
      if(p&&p.connected&&p.vibrationActuator&&p.vibrationActuator.playEffect){
        p.vibrationActuator.playEffect('dual-rumble',{startDelay:0,duration:P[2],weakMagnitude:P[1],strongMagnitude:P[0]}).catch(()=>{});return;}
    }
  };
  // 有些瀏覽器（例如部分 iOS Safari）不一定會發出 gamepadconnected：未啟動時每 0.5 秒主動檢查一次，碰觸螢幕或按鍵時也檢查
  const poll=()=>{if(!running&&pickPad())start();};
  setInterval(poll,500);addEventListener('pointerdown',poll,true);addEventListener('keydown',poll,true);
  if(pickPad())start();
})();
