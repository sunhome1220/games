/* 手把（Gamepad API）：左搖桿移動游標、✕＝點選、○＝取消、△＝火力打擊、□＝電腦代打、Options＝結束階段（有彈窗時 △／Options＝彈窗的主要按鈕）、
   十字鍵 ←→＝切換到下一個還沒行動的己方單位、↑↓＝游標跳到資訊卡的上／下一個按鈕（之後左搖桿上下也能切換，左右離開）；
   彈窗開著時游標自動吸在選項上，左搖桿或十字鍵四個方向＝上／下一個選項（像 Tab 與方向鍵），右搖桿＝捲動彈窗內容；L1／R1＝切換側欄分頁、L3＝全螢幕、R3＝回到台灣、Share＝按鍵說明。
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
  // ---- 快速鍵：直接按到常用的介面按鈕 ----
  const shown=e=>!!e&&!e.disabled&&!e.hidden&&e.getClientRects().length>0;
  const clickIf=(sel,any)=>{ // 依序找第一個看得到的按鈕來按；any＝都看不到時（例如在別的分頁裡），仍按第一個可用的
    const es=sel.split(',').map(s=>document.querySelector(s.trim())).filter(e=>e&&!e.disabled&&!e.hidden),e=es.find(shown)||(any?es[0]:null);
    if(!e)return false;
    e.click();window.TSL_RUMBLE&&TSL_RUMBLE('tap');return true;};
  const PRIMARY='#evRoll,#evGo,#itGo,#evOk,#cfY,#modal .mbox button:not(.ghost):not(.opt):not(.mnew)';
  // 按鈕導覽：游標「吸」在某個按鈕上（navEl），像 Tab／方向鍵一樣在選項之間跳；彈窗開著時一律用這個模式，資訊卡則用十字鍵上下進入
  let navEl=null,navT=0,navN=0,lastBase=null;
  const setupOn=()=>typeof S!=='undefined'&&S&&!S.started&&!document.body.classList.contains('playing')&&!!document.querySelector('#wzBody')&&document.querySelector('#wzBody').getClientRects().length>0; // 作戰設定頁（開始鈕在看完每一頁前是停用的，所以看設定內容區）
  const NAVSEL='button:not(.mnew),input,select,summary';
  const homeOn=()=>{const h=document.getElementById('home');return !!h&&!h.hidden;}; // 首頁（選戰役模式或關卡挑戰）開著：導覽只在首頁的卡片與核取方塊之間跳，後面的設定精靈先不動
  const navList=()=>{const m=document.querySelector('#modal:not([hidden])');
    if(!m&&homeOn())return [...document.querySelectorAll('#home button,#home a,#home input')].filter(shown);
    if(m)return [...m.querySelectorAll(NAVSEL)].filter(shown);
    if(setupOn())return [...document.querySelectorAll('#wzBody button,#wzPrev,#wzNext,#btnStart,#btnDefault')].filter(shown);
    for(const sel of ['.cpb button','#ucard:not([hidden]) #ucBody button','#info button']){ // 打擊確認列 → 資訊卡 → 側欄資訊卡；只取第一組有按鈕的
      const l=[...document.querySelectorAll(sel)].filter(shown);if(l.length)return l;}
    return [];};
  const navDefault=()=>{const l=navList();return l.find(e=>e.classList.contains('on')&&e.classList.contains('opt'))||l.find(e=>e.classList.contains('opt'))||l.find(e=>e.matches(PRIMARY))||l[0]||null;};
  const toEl=e=>{navEl=e;try{e.scrollIntoView({block:'nearest',inline:'nearest'});}catch(_){}try{e.focus({preventScroll:true});}catch(_){}const r=e.getBoundingClientRect();x=r.left+r.width/2;y=r.top+r.height/2;hc=null;};
  function tabStep(d){const bs=[...document.querySelectorAll('#sidetabs button')].filter(shown);if(!bs.length)return;
    const i=bs.findIndex(e=>e.classList.contains('on')),n=bs[((i<0?0:i)+d+bs.length)%bs.length];n.click();toEl(n);window.TSL_RUMBLE&&TSL_RUMBLE('step');}
  // 依方向找下一個按鈕：(vx,vy)＝推的方向。先找該方向上最近的按鈕（橫向排列的選項往下會跳到下一列），找不到再依清單順序
  function dirStep(vx,vy){
    const bs=navList();if(!bs.length)return;
    const cur=navEl&&bs.includes(navEl)?navEl:null;
    if(!cur){toEl(bs[vx+vy>0?0:bs.length-1]);return;}
    const a=cur.getBoundingClientRect(),ax=a.left+a.width/2,ay=a.top+a.height/2;let best=null,bd=1e9;
    for(const e of bs){if(e===cur)continue;const r=e.getBoundingClientRect(),dx=r.left+r.width/2-ax,dy=r.top+r.height/2-ay;
      const along=dx*vx+dy*vy,perp=Math.abs(dx*vy-dy*vx);
      if(along<=4||perp>along*2.2)continue; // 只看推的方向前方（約 ±65°）
      const sc=along+perp*2.5;if(sc<bd){bd=sc;best=e;}}
    if(best){toEl(best);window.TSL_RUMBLE&&TSL_RUMBLE('step');}
    else btnStep(vx+vy>0?1:-1);
  }
  function btnStep(d){ // 彈窗開著：彈窗裡的按鈕；否則：資訊卡、打擊確認列與指揮面板裡的按鈕
    const bs=navList();if(!bs.length)return;
    const el=document.elementFromPoint(x,y),cur=navEl&&bs.includes(navEl)?navEl:el&&el.closest(NAVSEL),i=bs.indexOf(cur);
    toEl(bs[i<0?(d>0?0:bs.length-1):(i+d+bs.length)%bs.length]);window.TSL_RUMBLE&&TSL_RUMBLE('step');}
  // 打擊、出擊、齊射等選目標的模式：十字鍵左右在橘圈目標之間切換（地圖捲過去、游標停在目標上），✕ 確認
  const TMODES=['strike','volley','afS','afL','afC','cvw','cvwL'];let tgtI=-1,tgtPick=null; // tgtPick＝{id,x,y}：十字鍵選定的目標，✕ 會點這個棋子（同格疊了好幾個單位時不會點錯）
  function targetStep(d){
    const ts=targetRings().map(r=>r[0]).filter(u=>document.querySelector('#map .u[data-id="'+u.id+'"]'));if(!ts.length)return;
    tgtI=((tgtI+d)%ts.length+ts.length)%ts.length;const u=ts[tgtI];navEl=null;
    centerOn(document.querySelector('#map .u[data-id="'+u.id+'"]'));
    requestAnimationFrame(()=>{const e=document.querySelector('#map .u[data-id="'+u.id+'"]');if(!e)return;const q=e.getBoundingClientRect();x=q.left+q.width/2;y=q.top+q.height/2;hc=null;
      tgtPick={id:u.id,x,y,k:u.c+','+u.r};lastEl=document.elementFromPoint(x,y);
      if(!S.sel){S.hover=u.c+','+u.r;S.hoverId=u.id;if(typeof renderInfo==='function')renderInfo();} // 資訊卡顯示這個目標（不是同格最上面的棋子）
      window.TSL_RUMBLE&&TSL_RUMBLE('step');
      if(typeof toast==='function')toast(TX('目標')+' '+(tgtI+1)+'/'+ts.length+'：'+(typeof uname==='function'?uname(u):'')+TX('（✕ 確認）'),1600);});
  }
  // 把棋子捲到地圖可見範圍的正中央（地圖框與整頁都會捲；手機上地圖比畫面高時也看得到，不會被浮動資訊卡蓋住）
  function centerOn(g){if(!g)return;const w=document.querySelector('.mapwrap'),r=g.getBoundingClientRect(),b=w.getBoundingClientRect();
    w.scrollLeft+=r.left+r.width/2-(b.left+b.width/2);w.scrollTop+=r.top+r.height/2-(b.top+b.height/2);
    try{g.scrollIntoView({block:'center',inline:'nearest'});}catch(_){}}
  // 選了己方單位：十字鍵左右在「這個單位能做的事」之間切換——先是可攻擊的目標（橘圈），再是值得去的目的地：
  // 有地名的格（港口、城市、機場）、緊鄰敵軍的格，以及每個方向（每 30°）最遠能到的格。目的地依方位順時針排列
  const KIND={move:'移動',sail:'出航',land:'登陸',drop:'空降'};
  function selOptions(u){
    const h=TER[u.c+','+u.r];if(!h)return [];
    const out=targets(u).filter(t=>document.querySelector('#map .u[data-id="'+t.id+'"]')).map(t=>({id:t.id,k:t.c+','+t.r,lab:TX('攻擊')+'：'+uname(t)}));
    const [x0,y0]=center(h.c,h.r),pick=new Map(),far={},foes=S.units.filter(e=>e.side!==u.side&&alive(e)&&!subHidden(e));
    const dir=a=>TX(['北','東北','東','東南','南','西南','西','西北'][Math.round(a/45)%8]);
    const where=k=>{const t=TER[k],[x,y]=center(t.c,t.r),ang=(Math.atan2(x-x0,-(y-y0))*180/Math.PI+360)%360;return t.name||dir(ang)+' '+Math.round(rd(h,t)*KM_HEX)+' km';};
    for(const [k,v] of reach(u)){const t=TER[k];if(!t)continue;const [x,y]=center(t.c,t.r),ang=(Math.atan2(x-x0,-(y-y0))*180/Math.PI+360)%360,dist=rd(h,t),sec=Math.floor(ang/30);
      const e={k,kind:v.kind,ang,dist,t};
      if(t.name||foes.some(f=>rd(TER[f.c+','+f.r]||t,t)<=kmH(ADJ_KM)))pick.set(k,e);
      if(!far[sec]||dist>far[sec].dist)far[sec]=e;}
    for(const s in far)pick.set(far[s].k,far[s]);
    // 登陸／空降：把推薦的放在最前面（標籤同地圖上的登陸提示：★推薦、搶灘／港口卸載／浮動碼頭／空降、守軍多寡），其餘移動依方位排列
    const pl=typeof landPlan==='function'?landPlan(u):null,first=[],used=new Set();
    if(pl){
      for(const x of pl.shown){used.add(x.k);first.push({k:x.k,lab:pl.label(x,'land')+'：'+where(x.k)});}
      for(const x of pl.dropsShown){used.add(x.k);first.push({k:x.k,lab:pl.label(x,'drop')+'：'+where(x.k)});}
    }
    return out.concat(first,[...pick.values()].filter(e=>!used.has(e.k)).sort((a,b)=>a.ang-b.ang||b.dist-a.dist).map(e=>({k:e.k,lab:TX(KIND[e.kind]||'移動')+'：'+(e.t.name||dir(e.ang)+' '+Math.round(e.dist*KM_HEX)+' km')})));
  }
  let selI=-1,selKey='';
  function selStep(d){
    const u=S.sel,ops=selOptions(u);if(!ops.length)return false;
    const key=u.id+':'+u.c+','+u.r+':'+(u.moved?1:0);if(key!==selKey){selKey=key;selI=d>0?-1:0;} // 換了單位或位置：從頭開始
    selI=((selI+d)%ops.length+ops.length)%ops.length;const o=ops[selI];navEl=null;
    const g=o.id?document.querySelector('#map .u[data-id="'+o.id+'"]'):hexEl(o.k);if(!g)return false;
    centerOn(g);
    requestAnimationFrame(()=>{const e=o.id?document.querySelector('#map .u[data-id="'+o.id+'"]'):hexEl(o.k);if(!e)return;
      const q=e.getBoundingClientRect();x=q.left+q.width/2;y=q.top+q.height/2;hc=null;
      tgtPick={id:o.id||null,k:o.k,x,y,sel:u.id};lastEl=document.elementFromPoint(x,y);window.TSL_RUMBLE&&TSL_RUMBLE('step');
      if(typeof toast==='function')toast((selI+1)+'/'+ops.length+'　'+o.lab+TX('（✕ 確認）'),1800);});
    return true;
  }
  let unitI=-1;
  function unitStep(d){ // 還沒移動也還沒行動的己方單位：把地圖捲到它、游標移過去並點選
    if(typeof S==='undefined'||!S||!S.started||S.over||document.querySelector('#modal:not([hidden])'))return;
    if(typeof humanTurn==='function'&&!humanTurn())return;
    const us=S.units.filter(u=>u.side===S.phase&&!u.acted&&!u.moved&&!(isEsc(u)||u.type==='dd'||((u.type==='lst'||u.type==='ro')&&!u.boundTo)||isSup(u))&&document.querySelector('#map .u[data-id="'+u.id+'"]')); // 跳過護航艦、沒載旅的運輸船（返航中）、補給船（跟著航艦或自動處理，不用手動操作）；載著旅的船要留著：旅在海上不畫出來，點船就是選船上的旅
    if(!us.length)return;
    us.sort((a,b)=>(b.boundTo?1:0)-(a.boundTo?1:0)); // 載著旅、正在海上的船排最前面（要登陸的先選到）；其餘維持原順序
    unitI=((unitI+d)%us.length+us.length)%us.length;
    const w=document.querySelector('.mapwrap'),g=document.querySelector('#map .u[data-id="'+us[unitI].id+'"]'),r=g.getBoundingClientRect(),b=w.getBoundingClientRect();
    navEl=null;centerOn(g);
    requestAnimationFrame(()=>{const e=document.querySelector('#map .u[data-id="'+us[unitI].id+'"]');if(!e)return;const q=e.getBoundingClientRect();x=q.left+q.width/2;y=q.top+q.height/2;hc=null;
      e.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y,view:window}));window.TSL_RUMBLE&&TSL_RUMBLE('step');
      if(S.sel&&typeof toast==='function')toast(TX('選取')+'：'+uname(S.sel)+'　'+(selOptions(S.sel).length?TX('←→ 切換行動、'):'')+TX('○ 換下一個單位'),2200);});
  }
  const pickPad=()=>{const ps=navigator.getGamepads?navigator.getGamepads():[];for(const p of ps)if(p&&p.connected)return p;return null;};
  const dz=v=>Math.abs(v)<.2?0:v;
  function frame(){
    const pad=pickPad();
    if(!pad){on=false;cur.hidden=true;hx.style.display='none';running=false;document.body.classList.remove('gp');return;}
    if(!on){on=true;cur.hidden=false;x=innerWidth/2;y=innerHeight/2;document.body.classList.add('gp');}
    const lx=dz(pad.axes[0]||0),ly=dz(pad.axes[1]||0),vis=document.body.classList.contains('playing')||!!document.querySelector('#modal:not([hidden])')||setupOn();
    // 按鈕導覽模式：彈窗開著（自動吸到目前選項或第一個選項），或已用十字鍵跳到資訊卡的按鈕上
    const modalEl=document.querySelector('#modal:not([hidden])');
    if(navEl&&(!shown(navEl)||(!!modalEl)!==!!navEl.closest('#modal')||(!modalEl&&!navEl.closest('.ucard,.cpb,#info')&&!setupOn())))navEl=null;
    if(modalEl&&!navEl){const d0=navDefault();if(d0)toEl(d0);}
    const setup=!modalEl&&setupOn();
    if(setup&&!navEl){const l=navList(),d0=l.find(e=>e.classList.contains('on'))||l[0];if(d0)toEl(d0);} // 作戰設定頁：游標吸在選項上
    { // 剛點選基地（出擊卡）：游標直接跳到卡片的第一個按鈕，搖桿上下選、✕ 按下、左右推回到地圖
      const bs=typeof S!=='undefined'&&S?S.baseSel||null:null;
      if(bs!==lastBase){lastBase=bs;if(bs&&!modalEl){const l=navList();if(l.length&&l[0].closest('#ucard'))toEl(l[0]);}}
    }
    if(navEl){
      const sy=Math.abs(ly)>.5?(ly>0?1:-1):0,sx=Math.abs(lx)>.5?(lx>0?1:-1):0,d=sy||(modalEl||setup?sx:0);
      if(d){const now=Date.now();if(!navT||now-navT>(navN===1?320:170)){navT=now;navN++;if(modalEl||setup){const ax=Math.abs(lx)>Math.abs(ly);dirStep(ax?sx:0,ax?0:sy);}else btnStep(d);}}
      else{navT=0;navN=0;}
      if(!modalEl&&!setup&&sx&&!sy)navEl=null; // 資訊卡：往左右推就離開按鈕，回到地圖游標
    }
    if(navEl){const r=navEl.getBoundingClientRect();x=r.left+r.width/2;y=r.top+r.height/2;} // 內容捲動時游標跟著按鈕
    const hh=vis&&!navEl?hexAtCursor():null;
    if(tgtPick&&Math.hypot(lx,ly)>.5)tgtPick=null; // 推了搖桿：不再是十字鍵選定的目標
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
      if(!navEl){
        x=Math.max(0,Math.min(innerWidth-1,x+lx*9));
        y=Math.max(0,Math.min(innerHeight-1,y+ly*9));
      }
    }
    cur.style.left=x+'px';cur.style.top=y+'px';
    const menuNav=!!navEl&&(!!modalEl||setup); // 彈窗、設定精靈、首頁：用按鈕上的黃框表示選到哪個，不再疊一顆圓形游標
    cur.style.display=vis&&!hexOn&&!menuNav?'':'none';
    cur.hidden=cur.style.display==='none';
    hx.style.display=vis&&hexOn?'':'none';
    const el=navEl||(hexOn?(mapEl(x,y)||document.elementFromPoint(x,y)):document.elementFromPoint(x,y)); // 六角格模式：點的是地圖上那一格（不是蓋在上面的卡片）
    const onPick=tgtPick&&(Math.hypot(x-tgtPick.x,y-tgtPick.y)<6||(hh&&hh.c+','+hh.r===tgtPick.k));
    if(el&&el!==lastEl&&!onPick){lastEl=el;el.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,clientX:x,clientY:y}));}
    const b=i=>!!(pad.buttons[i]&&pad.buttons[i].pressed),press=i=>b(i)&&!prev[i];
    const ev=t=>new MouseEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y,view:window});
    // 右搖桿：平移地圖
    const mw=document.querySelector('.mapwrap');const ax=pad.axes;
    if(modalEl){const mb=modalEl.querySelector('.fin-body')||modalEl.querySelector('.mbox');if(mb&&dz(ax[3]||0)){mb.scrollTop+=dz(ax[3]||0)*14;if(navEl&&Math.abs(ax[3])>.5)navT=Date.now();}} // 彈窗：右搖桿捲動內容
    else if(mw&&(dz(ax[2]||0)||dz(ax[3]||0))){mw.scrollLeft+=dz(ax[2]||0)*14;mw.scrollTop+=dz(ax[3]||0)*14;}
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
    if(press(0)&&el&&!dragStarted&&!drag){
      if(el.tagName==='SELECT'){el.selectedIndex=(el.selectedIndex+1)%el.options.length;el.dispatchEvent(new Event('change',{bubbles:true}));}
      else if(navEl){el.click();if(!modalEl&&!setup)navEl=null;}
      else if(tgtPick&&tgtPick.sel&&onPick&&S.sel&&S.sel.id===tgtPick.sel){ // 十字鍵選定的攻擊目標或目的地：點那個棋子／那一格
        const g=tgtPick.id?document.querySelector('#map .u[data-id="'+tgtPick.id+'"]'):hexEl(tgtPick.k),t=g&&(g.querySelector('.body')||g);tgtPick=null;selKey='';
        if(t)t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y,view:window}));}
      else if(tgtPick&&(Math.hypot(x-tgtPick.x,y-tgtPick.y)<6||(hh&&hh.c+','+hh.r===tgtPick.k))&&TMODES.includes(S&&S.mode)&&document.querySelector('#map .u[data-id="'+tgtPick.id+'"]')){
        const g=document.querySelector('#map .u[data-id="'+tgtPick.id+'"]'),t=g.querySelector('.body')||g;tgtPick=null;
        t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y,view:window}));} // 資訊卡的按鈕按下後回到地圖游標（例如接著要在地圖上選目標）
      else el.dispatchEvent(ev('click'));
      window.TSL_RUMBLE&&TSL_RUMBLE('tap');}
    dragStarted=b(0)&&!!drag;
    const modal=!!document.querySelector('#modal:not([hidden])');
    if(press(3)||press(9)){ // △／Options：有彈窗時按彈窗的主要按鈕；沒有彈窗時 △＝火力打擊、Options＝結束階段
      if(modal){if(!document.querySelector('#modal.fin-on'))clickIf(PRIMARY);} // 結算頁沒有「主要按鈕」：避免誤按套用假設情境、重新開局
      else if(homeOn()){clickIf('#hmCampaign');} // 首頁：△／Options＝進入戰役模式
      else if(setupOn()){if(press(9))clickIf('#btnStart');}
      else clickIf(press(3)?'#mbStrike,#fsStrike,#btnStrike':'#mbEnd,#fsEnd,#btnEnd',true);
    }
    if(press(2)&&!modal)clickIf('#mbAssist,#fsAssist,#btnAssist',true); // □：電腦代打
    if(press(1)){ // ○：取消（彈窗的取消鈕 → 取消打擊模式 → 關閉資訊卡）
      if(document.querySelector('#modal.fin-on:not([hidden])'))clickIf('#btnClose'); // 結算頁：○＝檢視地圖
      else if(modal)clickIf('#modal .ghost,#modal button#cfN');
      else if(homeOn()){clickIf('#hmBack');} // 首頁：○＝從關卡列表回首頁
      else if(clickIf('#afPend:not([hidden]) #afPendNo,#cnPend:not([hidden]) #cnPendNo')){} // 空軍出擊／縱深打擊的確認面板：○＝取消已選的目標（面板不是彈窗，原本要移游標到「取消」才按得到）
      else if(typeof S!=='undefined'&&S&&(S.mode==='strike'||S.mode==='afS'||S.mode==='afL'||S.mode==='afC'||S.mode==='hlS'||S.mode==='hlL'))clickIf('#mbStrike,#fsStrike,#btnStrike',true);
      else if(typeof S!=='undefined'&&S&&S.sel&&!S.mode){S.sel=null;tgtPick=null;if(typeof render==='function')render();} // 取消選取單位（之後十字鍵左右＝換單位）
      else clickIf('#ucard:not([hidden]) #ucClose');
    }
    if(press(4)||press(5)){if(homeOn()){}else if(!modal&&setupOn())clickIf(press(5)?'#wzNext':'#wzPrev');else tabStep(press(5)?1:-1);} // L1／R1：側欄分頁；作戰設定頁＝上一頁／下一頁
    if(press(14)||press(15)){const d=press(15)?1:-1;if(modal||setupOn())dirStep(d,0);else if(TMODES.includes(S&&S.mode)&&typeof targetRings==='function'&&targetRings().length)targetStep(d);else if(S&&S.sel&&alive(S.sel)&&S.sel.side===S.phase&&!S.mode&&humanTurn()&&selStep(d)){}else unitStep(d);} // 十字鍵左右：下一個還沒行動的己方單位；彈窗裡＝切換選項
    if(press(12)||press(13)){const d=press(13)?1:-1;if(modal||setupOn())dirStep(0,d);else btnStep(d);} // 十字鍵上下：游標跳到上／下一個按鈕
    if(press(10))clickIf('#btnFs,#fsExit'); // L3：全螢幕
    if(press(11))clickIf('#btnLoc'); // R3：回到台灣
    if(press(8))document.body.classList.toggle('gphelp'); // Share：按鍵說明
    prev={};
    for(let i=0;i<17;i++)prev[i]=b(i);
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
