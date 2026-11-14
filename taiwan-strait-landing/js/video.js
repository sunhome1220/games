'use strict';
/* ---------- video simulation: record the whole war instantly, then play it back ---------- */
const REC={frames:[],prev:null,prevN:0,final:null,closed:false,resolve:null,quiet:false};
const V={fr:[],i:0,playing:false,t:null,sp:2,turnStart:{},cardClosed:-1};
function snapFrame(){
  const o=Object.assign({},S);
  o.units=S.units.map(u=>Object.assign({},u));o.owner=Object.assign({},S.owner);o.pools=Object.assign({},S.pools);
  o.fx={lv:Object.assign({},S.fx.lv),reach:S.fx.reach,units:S.fx.units.map(f=>Object.assign({},f))};
  o.cn=Object.assign({},S.cn);o.cost=JSON.parse(JSON.stringify(S.cost));
  o.hits=S.hits.slice();o.log=S.log.slice(0,60);o.news=S.news.slice();o.events=S.events.slice();o.cnLog=S.cnLog.slice();
  o.sel=null;o.hover=null;o.mode=null;o.rec=false;o.stats=Object.assign({},S.stats);o.us=Object.assign({},S.us,{hist:S.us.hist.slice()});
  return o;
}
function recordFrame(card){
  if(REC.quiet){FXQ.length=0;return;}
  if(REC.closed&&!REC.final)return;
  const f=snapFrame(),prev=REC.prev;
  const cap=S.log.filter(l=>l.n>REC.prevN).reverse();
  const focus=[];
  if(prev){
    const pm=new Map(prev.units.map(u=>[u.id,u]));
    f.units.forEach(u=>{const q=pm.get(u.id);if(!q||q.c!==u.c||q.r!==u.r||q.hp!==u.hp)focus.push(K(u.c,u.r));pm.delete(u.id);});
    pm.forEach(q=>focus.push(K(q.c,q.r)));
  }
  if(!card&&!cap.length&&!focus.length&&!FXQ.length&&prev&&prev.turn===f.turn&&prev.phase===f.phase)return;
  if(!card&&!cap.length&&REC.frames.length>2400)return;
  f.focus=focus;REC.prevN=LOGN;
  REC.frames.push({S:f,cap,card:card||null,fx:FXQ.splice(0),prevN:cap.length?cap[0].n-1:LOGN});
  REC.prev=f;
}
// automatic decisions for the events in video mode
function wpick(ws){let t=ws.reduce((a,w)=>a+w[1],0),r=NR()*t;for(const [v,w] of ws){if((r-=w)<=0)return v;}return ws[0][0];}
function autoChoice(ev,opts){
  opts=opts.filter(o=>!o.x); // 電腦不會選「🔥 極端」選項，只給真人選
  const has=id=>opts.some(o=>o.id===id);let id;
  if(ev.id==='timing')id=wpick([['apr',45],['oct',35],['winter',20]]);
  else if(ev.id==='strike')id=wpick([['ssm',40],['c2',20],['air',30]].concat(has('okinawa')?[['okinawa',10]]:[]));
  else if(ev.id==='mobilize')id=wpick([['full',40],['capital',30],['mobile',30]]);
  else if(ev.id==='final')id=REC.quiet?pick(opts).id:(snap().n>=2&&has('hold')?'hold':'allin'); // statistics: choose at random so the choice is not tied to who is already ahead
  else id=pick(opts).id;
  return opts.find(o=>o.id===id)||opts[0];
}
function autoEvent(ev,i){
  const rec={turn:S.turn,phase:S.phase,title:ev.title,id:ev.id};
  let choice=null;
  if(ev.choice){const opts=ev.choice.options.filter(o=>!o.hide||!o.hide());choice=autoChoice(ev,opts);rec.choice=choice.label;rec.who=ev.choice.who;}
  const rolls=(ev.dice||[]).filter(d=>!d.skip||!d.skip()).map(d=>rollSpec(d,choice&&choice.id));
  const fx=finishRec(ev,rec,choice,rolls);
  const html='<div class="eyebrow">事件節點 '+(i+1)+' / '+EVENTS.length+' · 第 '+S.turn+' 回合 '+SIDE[S.phase]+'階段前</div><h3>'+ev.title+'</h3><p>'+evBlurb(ev)+'</p>'+
    (choice?'<p><span class="badge '+ev.choice.who+'">'+SIDE[ev.choice.who]+'決策</span>選擇「'+choice.label+'」</p>':'')+
    rolls.map(r=>'<p><span class="badge dice">'+(r.it?'判定':'擲骰')+'</span>'+r.label+'：<b>'+r.text+'</b> →「'+r.row.label+'」<span class="dd"> '+r.row.desc+'</span></p>').join('')+
    '<ul>'+fx.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  recordFrame({html,kind:'event',dur:7000});
}
// run one complete simulation with both sides on AI and automatic event decisions; quiet=true skips frame recording
async function simRun(quiet){
  newState();readSetup();initSeed();
  S.sim=false;S.started=true;S.rec=true;S.video=true;S.ctrl={atk:'ai',def:'ai'};
  REC.frames=[];REC.prev=null;REC.prevN=LOGN;REC.final=null;REC.closed=false;REC.quiet=!!quiet;FXQ.length=0;
  applyEra();applyFxScenario();log(applyMonth().join('；')+'。');applyWhatIf();airInit();mslInit();
  const b=$('#optBuild').value,fx=applyBuildup(b);log('戰前集結：'+BUILDUP.find(x=>x.id===b).label+'。'+fx.join('、'));
  applyPlan();
  S.lastSnap=snap();log('純模擬開始。判定回合：第 '+S.T+' 回合。');
  if(!quiet)recordFrame();
  const done=new Promise(r=>{REC.resolve=r;});
  beginPhase('atk');
  await done;
  S.rec=false;REC.quiet=false;
  return S;
}
async function startVideo(){
  vStop();
  setTab('cmd');$('#setup').hidden=true;$('#vbusy').hidden=false;
  await new Promise(r=>setTimeout(r,40));
  await simRun(false);
  if(V.abort){V.abort=false;$('#vbusy').hidden=true;backToSetup();return;}
  V.fr=REC.frames.slice();V.sp=+$('#optVSpeed').value||2;
  V.turnStart={};V.fr.forEach((f,i)=>{if(V.turnStart[f.S.turn]===undefined)V.turnStart[f.S.turn]=i;});
  $('#vSpeed').value=String(V.sp);$('#vScrub').max=V.fr.length-1;
  $('#vbusy').hidden=true;
  fitVideoZoom();vShow(0,true);V.playing=true;vBtn();vSchedule();
}
function fitVideoZoom(){
  const w=document.querySelector('.mapwrap'),h1=w.clientWidth*VBH/VBW;
  setZoom(Math.max(ZMIN,Math.min(1,(innerHeight-330)/h1)),true);
  document.querySelector('.board').scrollIntoView({block:'start'});
}
function vStop(){V.cardClosed=-1;clearTimeout(V.t);VOICE.stop();V.playing=false;V.fr=[];$('#vcard').hidden=true;}
function backToSetup(){vStop();reset();setTab('cmd');}
function vBtn(){$('#vPlay').textContent=V.playing?'⏸':'▶';}
function vLabel(f){return 'D+'+(Math.ceil(f.S.turn/2)-1)+(f.S.turn%2?' 白天':' 夜間')+'・第 '+f.S.turn+' 回合・'+SIDE[f.S.phase]+'階段';}
function vShow(i,full,fxOk){
  V.i=Math.max(0,Math.min(V.fr.length-1,i));const f=V.fr[V.i];S=f.S;ANIM.ok=!!fxOk;
  if(full||f.cap.length||f.card||V.i%4===0||!V.playing)renderAll();else{renderMap();renderStatus();}
  ANIM.ok=true;if(fxOk&&f.fx&&f.fx.length)playFx(f.fx);
  $('#vcap').hidden=false;
  $('#vScrub').value=V.i;$('#vTime').textContent=(V.i+1)+' / '+V.fr.length+'　'+vLabel(f);
  const tag=l=>l.p==='atk'?'攻':'守';
  const old=f.S.log.filter(l=>l.n<=f.prevN).slice(0,3);
  $('#vLines').innerHTML=f.cap.map(l=>'<div class="vl cur"><span class="tn">T'+l.t+tag(l)+'</span>'+l.msg+'</div>').join('')+
    old.map(l=>'<div class="vl"><span class="tn">T'+l.t+tag(l)+'</span>'+l.msg+'</div>').join('');
  $('#vLines').scrollTop=0;
  const b=snap(),c=costSummary();
  $('#vChips').innerHTML=['<span>若現在判定 攻方 <b>'+b.n+'</b>/3 → <b>'+verdict(b.n).t+'</b></span>','<span>島上戰力 攻 <b>'+cpNum(b.as)+'</b>・守 <b>'+cpNum(b.ds)+'</b> '+cpU()+'</span>',
    '<span>港口 <b>'+b.ports+'</b>/'+PORTS.length+'・台北 <b>'+(b.taipei?'攻':'守')+'</b></span>','<span>空軍 攻 <b>'+b.plaAir+'</b>・守與盟 <b>'+b.ally+'</b></span>','<span>火箭軍存量 <b>'+fmt1(S.pools.rf)+'</b></span>',
    '<span>軍人傷亡 攻 <b>'+fmt(c.mil.atk.n)+'</b>・守 <b>'+fmt(c.mil.def.n)+'</b></span>','<span>台灣平民 <b>'+fmt(c.civ.TW)+'</b></span>','<span>全球股市 <b>'+c.mkt.toFixed(1)+'%</b></span>'].join('');
  if(fxOk&&V.playing&&VOICE.on){
    if(f.card&&f.card.kind==='news')VOICE.speak(f.card.html,{flush:true,rate:Math.min(2,1+(V.sp-1)*0.2)}); // 只播每回合的統整快訊
  }else if(!fxOk)VOICE.stop();
  const cd=$('#vcard');
  if(f.card&&V.cardClosed!==V.i){$('#vcBody').innerHTML=f.card.html;cd.className='vcard '+f.card.kind+(cd.classList.contains('moved')?' moved':'');cd.hidden=false;vcardPlace();}else cd.hidden=true;
}

/* ---------- 匯出：地圖截圖（PNG）與戰報文字 ---------- */
const TX=t=>(window.TSL_T||(x=>x))(t);
function dlBlob(blob,name){
  const f=window.File?new File([blob],name,{type:blob.type}):null;
  if(f&&navigator.canShare&&navigator.canShare({files:[f]})&&matchMedia('(pointer:coarse)').matches){navigator.share({files:[f]}).catch(()=>{});return;} // 手機：開啟系統分享（可存到相簿）
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},3000);
}
const stampNow=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return d.getFullYear()+z(d.getMonth()+1)+z(d.getDate())+'-'+z(d.getHours())+z(d.getMinutes());};
function exportStatus(){
  const b=snap();
  return [TX('第 ')+S.turn+TX(' 回合 · ')+TX(SIDE[S.phase]+'階段')+' · '+TX('判定回合：第 ')+S.T+' · '+TX(ERA[S.era]?ERA[S.era].n:S.era),
    TX('若現在判定：攻方達成 ')+b.n+' / 3 → '+TX(verdict(b.n).t)];
}
async function mapImage(opt){ // 把目前地圖轉成圖片（太大時逐步降低解析度）；回傳 {img,W,H,rcs}。opt={vb:[x,y,w,h],w:輸出寬度}＝直接輸出指定範圍的小圖（不靠 drawImage 裁切，Safari 才不會畫出空白）
  const svg=$('#map');if(!svg||!svg.getAttribute('viewBox'))throw new Error('map');
  const [vx,vy,vw,vh]=svg.getAttribute('viewBox').split(/\s+/).map(Number);
  let css='';for(const sh of document.styleSheets){try{for(const r of sh.cssRules)css+=r.cssText+'\n';}catch(e){}}
  const rcs=getComputedStyle(document.documentElement);
  const vars=[...new Set(css.match(/--[a-z0-9-]+/g)||[])].map(v=>v+':'+rcs.getPropertyValue(v)+';').join('');
  let img=null,W=0,H=0;
  for(const sc of (opt&&opt.vb?[1]:[Math.min(2,1900/vw),1,.6])){
    W=opt&&opt.vb?opt.w:Math.round(vw*sc);H=opt&&opt.vb?Math.round(opt.w*opt.vb[3]/opt.vb[2]):Math.round(vh*sc);
    const clone=svg.cloneNode(true);if(opt&&opt.vb)clone.setAttribute('viewBox',opt.vb.join(' '));
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',W);clone.setAttribute('height',H);clone.setAttribute('style',vars);
    const st=document.createElementNS('http://www.w3.org/2000/svg','style');st.textContent=css;clone.insertBefore(st,clone.firstChild);
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));
    try{img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=url;});try{if(img.decode)await img.decode();}catch(e){}break;}catch(e){img=null;}finally{setTimeout(()=>URL.revokeObjectURL(url),5000);}
  }
  if(!img)throw new Error('render');
  return {img,W,H,rcs};
}
/* ---------- 十秒精華影片：每回合存一張縮圖，結束時挑 6 張以內的重點場景，合成 720×1280 直式影片（標題 1.2 秒＋重點場景＋結局 2 秒＝10 秒） ---------- */
const HL={shots:[],pend:[]};
function hlCount(turn){let sunk=0,lost=0,land=0;S.log.forEach(l=>{if(l.t!==turn)return;const m=String(l.msg);
  if(/（攻方）.*被(殲滅|擊沉)/.test(m))sunk++;else if(/（守方）.*被(殲滅|擊沉)/.test(m))lost++;
  if(/搶灘|占領|空降/.test(m))land++;});return {sunk,lost,land};}
function captureHL(tag,end){
  if(S.sim||S.video||S.rec||!S.started)return;
  const turn=end?S.turn:S.turn-1,c=hlCount(turn),why=hlLines(turn),p=mapImage({vb:[MX0+.02*VBW,MY0,.8*VBW,.74*VBH],w:640}).then(({img,W,H})=>{ // 只取台灣遊戲區，直接輸出 640 寬小圖
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;cv.getContext('2d').drawImage(img,0,0,W,H);
    const old=HL.shots.findIndex(x=>x.tag===tag);const o={tag,turn,cv,c,why,end:!!end};if(old>=0)HL.shots[old]=o;else HL.shots.push(o);}).catch(()=>{});
  HL.pend.push(p);
}
function hlLines(turn){ // 這一回合最值得一提的 2 件事（去掉括號細節）
  const ms=S.log.filter(l=>l.t===turn&&/被(殲滅|擊沉)|搶灘|占領|空降|癱瘓|摧毀|遭|命中/.test(l.msg)).map(l=>String(l.msg).replace(/（[^）]*）/g,'').replace(/\s+/g,' ').slice(0,26).replace(/[）)]+$/,''));
  return [...new Set(ms.reverse())].slice(0,2);
}
function hlCaption(o){const a=[];if(o.end)return '';a.push('第 '+o.turn+' 回合');const c=o.c;
  const t=[];if(c.sunk)t.push('攻方船艦損失 '+c.sunk);if(c.lost)t.push('守方損失 '+c.lost);if(c.land)t.push('登陸／空降行動 '+c.land);return a.concat([t.length?t.join('　'):'雙方調動兵力']).join('　·　');}
function showVideoResult(blob,name,file){
  const url=URL.createObjectURL(blob),can=!!(navigator.canShare&&navigator.canShare({files:[file]})),ov=document.createElement('div');ov.className='vres';
  ov.innerHTML='<div role="dialog" aria-label="'+TX('精華影片已完成')+'"><b>'+TX('精華影片已完成')+'</b><video src="'+url+'" controls playsinline muted loop autoplay></video><div class="btns">'+(can?'<button id="vrShare">'+TX('分享／儲存到相簿')+'</button>':'')+'<button class="ghost" id="vrDl">'+TX('下載檔案')+'</button><button class="ghost" id="vrX">'+TX('關閉')+'</button></div><div class="dd">'+TX(can?'點「分享／儲存到相簿」會開啟系統選單，可存到相簿或傳給朋友。':'點「下載檔案」存到這台裝置。')+'</div></div>';
  document.body.appendChild(ov);
  const close=()=>{ov.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const sh=ov.querySelector('#vrShare');if(sh)sh.onclick=()=>{navigator.share({files:[file],title:TX('台海兵棋推演 十秒精華')}).catch(e=>{if(e&&e.name!=='AbortError')toast(TX('無法開啟分享，請改用下載'),2500);});};
  ov.querySelector('#vrDl').onclick=()=>{const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();toast(TX('已下載'),1500);};
  ov.querySelector('#vrX').onclick=close;ov.addEventListener('click',e=>{if(e.target===ov)close();});
}
async function exportHighlight(){
  toast(TX('正在合成十秒精華影片（約 12 秒，請稍候）…'),3000);
  try{
    await Promise.all(HL.pend);
    if(!HL.shots.length){const {img,W,H}=await mapImage({vb:[MX0+.02*VBW,MY0,.8*VBW,.74*VBH],w:640}),cv=document.createElement('canvas');cv.width=W;cv.height=H;cv.getContext('2d').drawImage(img,0,0,W,H);HL.shots.push({tag:'now',turn:S.turn,cv,c:{sunk:0,lost:0,land:0},why:[],end:true});}
    const sc=x=>x.c.sunk+x.c.lost+x.c.land*2,mid=HL.shots.filter(x=>!x.end);
    const pick=mid.length<=6?mid.slice():(()=>{const keep=new Set([mid[0],mid[mid.length-1]]);mid.slice().sort((a,b)=>sc(b)-sc(a)).forEach(x=>{if(keep.size<6)keep.add(x);});return mid.filter(x=>keep.has(x));})();
    const endShot=HL.shots.find(x=>x.end)||pick[pick.length-1];
    const scenes=pick.length?pick:[endShot];
    const W=720,H=1280,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
    const rcs=getComputedStyle(document.documentElement),ff='"Noto Sans TC","Noto Sans JP","PingFang TC","Microsoft JhengHei",sans-serif';
    const bg=rcs.getPropertyValue('--bg').trim()||'#f3f1ea',ink=rcs.getPropertyValue('--ink').trim()||'#111',mu=rcs.getPropertyValue('--muted').trim()||'#666';
    const q=sel=>{const e=document.querySelector(sel);return e?e.innerText.replace(/\s+/g,' ').trim():'';};
    const verdict=q('#mbox .verdict')||'作戰結束',fvd=q('#mbox .fvd'),code=S.seed?TX('戰局碼 ')+S.seed:'';
    const wrap=(t,w,font)=>{c.font=font;const out=[];let line='';for(const ch of t){if(c.measureText(line+ch).width>w){out.push(line);line=ch;}else line+=ch;}if(line)out.push(line);return out;};
    const T_INTRO=1.2,T_END=2,TS=Math.max(.6,(10-T_INTRO-T_END)/scenes.length),TOT=T_INTRO+TS*scenes.length+T_END;
    const card=(title,sub,lines)=>{c.fillStyle=bg;c.fillRect(0,0,W,H);c.fillStyle=ink;c.textAlign='center';c.textBaseline='middle';c.font='900 64px '+ff;c.fillText(title,W/2,H*.38);
      c.font='600 30px '+ff;c.fillStyle=mu;c.fillText(sub,W/2,H*.38+70);let y=H*.38+140;lines.forEach(l=>{wrap(l,W-120,'500 28px '+ff).forEach(w=>{c.font='500 28px '+ff;c.fillStyle=ink;c.fillText(w,W/2,y);y+=40;});y+=8;});c.textAlign='left';};
    const drawScene=(o,alpha)=>{c.globalAlpha=alpha;c.fillStyle=bg;c.fillRect(0,0,W,H);
      const h=Math.round(o.cv.height*W/o.cv.width),y=Math.round((H-h)/2);c.drawImage(o.cv,0,y,W,h);
      c.fillStyle=ink;c.textBaseline='top';c.font='900 40px '+ff;c.fillText(TX('台海兵棋推演'),28,36);
      c.font='700 34px '+ff;c.fillStyle=ink;c.fillText(TX(hlCaption(o)),28,y+h+26);
      let ty=y+h+80;c.font='500 30px '+ff;c.fillStyle=ink;(o.why||[]).forEach(wl=>{wrap(TX(wl),W-56,'500 30px '+ff).slice(0,2).forEach(t=>{c.font='500 30px '+ff;c.fillText(t,28,ty);ty+=42;});});c.globalAlpha=1;};
    const frameAt=t=>{
      if(t<T_INTRO){card(TX('台海兵棋推演'),TX('十秒精華'),[TX(ERA[S.era]?ERA[S.era].n:'')].filter(Boolean));return;}
      const u=t-T_INTRO;if(u<TS*scenes.length){const i=Math.min(scenes.length-1,Math.floor(u/TS)),f=(u-i*TS)/TS;drawScene(scenes[i],1);
        if(i>0&&f<.25){c.globalAlpha=1-f/.25;drawScene(scenes[i-1],c.globalAlpha);c.globalAlpha=1;}return;}
      const e=u-TS*scenes.length;drawScene(endShot,1);c.fillStyle=bg;c.globalAlpha=.86;c.fillRect(0,H*.28,W,H*.44);c.globalAlpha=1;
      c.fillStyle=ink;c.textAlign='center';c.textBaseline='middle';c.font='900 56px '+ff;let y=H*.36;wrap(verdict,W-100,'900 56px '+ff).forEach(l=>{c.font='900 56px '+ff;c.fillText(l,W/2,y);y+=68;});
      c.font='500 26px '+ff;c.fillStyle=mu;wrap(fvd,W-120,'500 26px '+ff).slice(0,4).forEach(l=>{c.fillText(l,W/2,y);y+=36;});if(code){c.font='600 24px '+ff;c.fillText(code,W/2,y+16);}c.textAlign='left';};
    const stream=cv.captureStream(30),types=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
    const mime=window.MediaRecorder?types.find(t=>MediaRecorder.isTypeSupported(t)):null;if(!mime)throw new Error('norec');
    const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000}),chunks=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
    const done=new Promise(r=>rec.onstop=r);rec.start(200);const t0=performance.now();
    await new Promise(res=>{(function f(){const t=(performance.now()-t0)/1000;frameAt(Math.min(t,TOT-.001));if(t>=TOT)res();else requestAnimationFrame(f);})();});
    rec.stop();await done;
    const ext=/mp4/.test(mime)?'mp4':'webm',blob=new Blob(chunks,{type:mime.split(';')[0]}),name='taiwan-strait-highlight-'+stampNow()+'.'+ext;
    const file=new File([blob],name,{type:blob.type});
    showVideoResult(blob,name,file); // 合成要十幾秒，早已超過瀏覽器允許直接開分享的時間：改成先預覽，再由使用者點一下按鈕分享或儲存
  }catch(e){toast(TX('無法產生影片（此瀏覽器不支援錄製，或本機檔案開啟限制畫面擷取）'),4500);}
}
async function exportShot(){
  toast(TX('正在產生截圖…'),1500);
  try{
    const {img,W,H,rcs}=await mapImage();
    const k=Math.max(1,W/1400),HEAD=Math.round(96*k),FOOT=Math.round(34*k),cv=document.createElement('canvas');cv.width=W;cv.height=H+HEAD+FOOT;
    const c=cv.getContext('2d'),bg=rcs.getPropertyValue('--bg').trim()||'#fff',ink=rcs.getPropertyValue('--ink').trim()||'#000',mu=rcs.getPropertyValue('--muted').trim()||'#666',ff='"Noto Sans TC","Noto Sans JP","PingFang TC","Microsoft JhengHei",sans-serif';
    c.fillStyle=bg;c.fillRect(0,0,cv.width,cv.height);
    c.fillStyle=ink;c.textBaseline='top';c.font='900 '+Math.round(34*k)+'px '+ff;c.fillText(TX('台海兵棋推演'),Math.round(18*k),Math.round(10*k));
    const [l1,l2]=exportStatus();c.font='600 '+Math.round(15*k)+'px '+ff;c.fillStyle=mu;c.fillText(l1,Math.round(18*k),Math.round(54*k));c.fillText(l2,Math.round(18*k),Math.round(74*k));
    c.drawImage(img,0,HEAD,W,H);
    c.font='500 '+Math.round(12*k)+'px '+ff;c.fillStyle=mu;c.fillText(TX('版本 ')+VERSION+' · '+new Date().toLocaleString(),Math.round(18*k),HEAD+H+Math.round(10*k));
    await new Promise((res,rej)=>cv.toBlob(b=>{if(!b)return rej(new Error('blob'));dlBlob(b,'taiwan-strait-t'+S.turn+'-'+stampNow()+'.png');res();},'image/png'));
    toast(TX('截圖已產生'),1500);
  }catch(e){toast(TX('截圖失敗（地圖太大，請縮小瀏覽器視窗或換個瀏覽器）'),3500);}
}
async function exportReportImage(withCard=true){ // 戰後報告圖：結果、勝負條件、結局繪卡與雙方評分＋結束時的地圖
  const w=document.querySelector('#mbox .finw');if(!w)return;
  toast(TX('正在產生報告圖片…'),1500);
  try{
    const {img,W,H,rcs}=await mapImage();
    const k=Math.max(1,W/1400),pad=Math.round(24*k),TW=W-2*pad,cv=document.createElement('canvas'),c=cv.getContext('2d');
    const bg=rcs.getPropertyValue('--bg').trim()||'#fff',ink=rcs.getPropertyValue('--ink').trim()||'#000',mu=rcs.getPropertyValue('--muted').trim()||'#666',ff='"Noto Sans TC","Noto Sans JP","PingFang TC","Microsoft JhengHei",sans-serif';
    const txt=(q)=>{const e=w.querySelector(q);return e?e.innerText.replace(/\s+/g,' ').trim():'';};
    const rows=[{t:TX('台海兵棋推演')+' · '+TX('戰後檢討報告'),f:'900 '+Math.round(30*k)+'px',c:ink,gap:8},
      {t:txt('.fin-head .eyebrow'),f:'600 '+Math.round(15*k)+'px',c:mu,gap:6},
      {t:txt('.verdict'),f:'900 '+Math.round(40*k)+'px',c:ink,gap:8},
      {t:txt('.fvd'),f:'500 '+Math.round(17*k)+'px',c:ink,gap:12}];
    [...w.querySelectorAll('.fc')].forEach(e=>rows.push({t:e.innerText.replace(/\s+/g,' ').trim(),f:'600 '+Math.round(16*k)+'px',c:e.classList.contains('ok')?'#2e7d32':'#c62828',gap:5}));
    rows.push({t:txt('.fin-score'),f:'700 '+Math.round(17*k)+'px',c:ink,gap:10});
    // 先量高度：依寬度折行
    const lines=[];const m=document.createElement('canvas').getContext('2d');
    for(const r of rows){if(!r.t)continue;m.font=r.f+' '+ff;const lh=Math.round(parseInt(r.f.split(' ')[1])*1.45);let cur='';
      for(const ch of r.t){if(m.measureText(cur+ch).width>TW){lines.push({...r,t:cur,lh});cur=ch;}else cur+=ch;}
      if(cur)lines.push({...r,t:cur,lh,last:true});}
    let hh=pad;lines.forEach(l=>{hh+=l.lh+(l.last?Math.round(l.gap*k):0);});
    // 結局繪卡與雙方評分
    const kind=S.result&&S.result.ending,em=kind?endScores():null,EC=kind?ENDCARDS[kind]:null;
    let cardImg=null;
    if(kind&&withCard)cardImg=await new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src='img/end/'+kind+'.jpg';});
    const sz=Math.round(Math.min(W*.4,520*k)),gx=pad,tx=pad+(cardImg?sz+pad:0),tw=W-tx-pad;
    const wrap=(t,font,maxW)=>{m.font=font;const out=[];let cur='';for(const ch of t){if(m.measureText(cur+ch).width>maxW){out.push(cur);cur=ch;}else cur+=ch;}if(cur)out.push(cur);return out;};
    const fnt=(wt,px)=>wt+' '+Math.round(px*k)+'px '+ff;
    let eh=0,eparts=[];
    if(kind){
      const col=EC.side==='atk'?'#a9362b':'#2b5a8f';
      const cap=wrap(TX(endCaption(kind,em)),fnt(500,16),tw);
      eparts.push({t:TX('結局繪卡')+' · '+TX(EC.sub),f:fnt(600,14),c:mu,lh:20});eparts.push({t:TX(EC.t),f:fnt(900,30),c:col,lh:40});
      cap.forEach(t=>eparts.push({t,f:fnt(500,16),c:ink,lh:24}));
      eparts.push({gap:10});
      [['atk',em.A,[['戰略目標','goals',50],['代價效率','cost',30],['外部環境','env',20]]],['def',em.D,[['守住程度','hold',50],['承受的代價','cost',30],['外援與韌性','env',20]]]].forEach(([who,o,rows2])=>{
        eparts.push({head:true,who,o,f:fnt(900,18),lh:28});rows2.forEach(r=>eparts.push({bar:true,l:TX(r[0]),v:o[r[1]],max:r[2],lh:22}));eparts.push({gap:8});});
      eparts.push({t:TX('分數不等於勝負：慘勝與代價沉重會被扣分。等級 S≥90、A≥75、B≥60、C≥40。'),f:fnt(500,12),c:mu,lh:18,wrapW:tw});
      const hsum=eparts.reduce((a,p)=>a+(p.gap?p.gap*k:p.lh*k),0);eh=Math.max(cardImg?sz:0,Math.round(hsum))+pad;
    }
    const LD=S.started?lossData():null,llh=Math.round(22*k);
    const lossRows=LD?Math.max(LD.atk.length,LD.def.length+1+Math.max(1,LD.ally.length)):0,lh2=LD?(lossRows+1)*llh+pad:0;
    const foot=Math.round(36*k);
    cv.width=W;cv.height=hh+eh+lh2+H+foot;
    c.fillStyle=bg;c.fillRect(0,0,cv.width,cv.height);c.textBaseline='top';
    let y=pad;lines.forEach(l=>{c.font=l.f+' '+ff;c.fillStyle=l.c;c.fillText(l.t,pad,y+Math.round((l.lh-parseInt(l.f.split(' ')[1]))/2));y+=l.lh+(l.last?Math.round(l.gap*k):0);});
    if(kind){
      const y0=hh;
      if(cardImg){c.save();const r=Math.round(10*k);c.beginPath();c.moveTo(gx+r,y0);c.arcTo(gx+sz,y0,gx+sz,y0+sz,r);c.arcTo(gx+sz,y0+sz,gx,y0+sz,r);c.arcTo(gx,y0+sz,gx,y0,r);c.arcTo(gx,y0,gx+sz,y0,r);c.closePath();c.clip();c.drawImage(cardImg,gx,y0,sz,sz);c.restore();c.strokeStyle=ink;c.lineWidth=Math.max(1,k);c.stroke();}
      let ey=y0;
      for(const p of eparts){
        if(p.gap){ey+=p.gap*k;continue;}
        if(p.head){c.font=p.f;c.fillStyle=p.who==='atk'?'#a9362b':'#2b5a8f';const nm=TX(SIDE[p.who])+'  '+p.o.grade;c.fillText(nm,tx,ey+2*k);c.fillStyle=ink;const tot=p.o.total+' / 100';c.textAlign='right';c.fillText(tot,tx+tw,ey+2*k);c.textAlign='left';ey+=p.lh*k;continue;}
        if(p.bar){c.font=fnt(500,14);c.fillStyle=ink;c.fillText(p.l,tx,ey+2*k);const bx=tx+Math.round(tw*.34),bw=Math.round(tw*.5);c.fillStyle='#c4cbc6';c.fillRect(bx,ey+5*k,bw,10*k);c.fillStyle='#55605a';c.fillRect(bx,ey+5*k,bw*p.v/p.max,10*k);c.fillStyle=ink;c.textAlign='right';c.fillText(p.v+' / '+p.max,tx+tw,ey+2*k);c.textAlign='left';ey+=p.lh*k;continue;}
        const ls=p.wrapW?wrap(p.t,p.f,p.wrapW):[p.t];ls.forEach(t=>{c.font=p.f;c.fillStyle=p.c;c.fillText(t,tx,ey+2*k);ey+=p.lh*k;});
      }
    }
    if(LD){ // 雙方損失：左攻、右守
      const cw=Math.round((W-3*pad)/2),y0=hh+eh;
      const col=(x,title,color,list,extra)=>{let yy=y0;c.font=fnt(900,16);c.fillStyle=color;c.fillText(TX(title),x,yy);yy+=llh;
        const draw=arr=>arr.forEach(([kk,vv])=>{c.font=fnt(500,13);c.fillStyle=mu;c.fillText(TX(kk),x,yy+2*k);c.font=fnt(700,13);c.fillStyle=ink;c.textAlign='right';c.fillText(TX(vv),x+cw,yy+2*k);c.textAlign='left';yy+=llh;});
        draw(list);if(extra){c.font=fnt(700,13);c.fillStyle=color;c.fillText(TX('盟軍'),x,yy+2*k);yy+=llh;draw(extra.length?extra:[['未參戰或沒有損失','']]);}};
      col(pad,SIDE.atk+'損失','#a9362b',LD.atk,null);col(pad*2+cw,SIDE.def+'損失','#2b5a8f',LD.def,LD.ally);
    }
    c.drawImage(img,0,hh+eh+lh2,W,H);
    c.font='500 '+Math.round(12*k)+'px '+ff;c.fillStyle=mu;c.fillText(TX('版本 ')+VERSION+' · '+new Date().toLocaleString(),pad,hh+eh+lh2+H+Math.round(10*k));
    await new Promise((res,rej)=>cv.toBlob(b=>{if(!b)return rej(new Error('blob'));dlBlob(b,'taiwan-strait-report-'+stampNow()+'.png');res();},'image/png'));
    toast(TX('已匯出報告圖片'),1500);
  }catch(e){if(withCard&&e&&e.name==='SecurityError')return exportReportImage(false); // 本機檔案開啟時圖片會污染畫布，改為不含結局卡
    toast(TX('報告圖片產生失敗（地圖太大，請縮小瀏覽器視窗或換個瀏覽器）'),3500);}
}
function textHead(title){
  return '# '+TX('台海兵棋推演')+' — '+TX(title)+'\n'+TX('版本 ')+VERSION+' · '+new Date().toLocaleString()+'\n';
}
function exportLogText(){
  let o=textHead('戰報')+'\n## '+TX('戰況')+'\n'+exportStatus().join('\n')+'\n';
  const evs=(S.events||[]).filter(e=>e.title);
  if(evs.length)o+='\n## '+TX('事件節點')+'\n'+evs.map(e=>'- '+TX('第 ')+e.turn+TX(' 回合')+' '+TX(e.title)+(e.choice?'：'+TX(e.choice):'')+(e.effects&&e.effects.length?' → '+e.effects.map(TX).join('；'):'')).join('\n')+'\n';
  const cs=$('#costs');if(cs&&cs.innerText.trim())o+='\n## '+TX('戰爭代價')+'\n'+cs.innerText.trim().replace(/\n{2,}/g,'\n')+'\n';
  o+='\n## '+TX('戰報')+'\n'+(S.log.length?S.log.slice().reverse().map(l=>'T'+l.t+TX(l.p==='atk'?'攻':'守')+' '+TX(l.msg)).join('\n'):TX('尚無戰報。'))+'\n';
  dlBlob(new Blob([o],{type:'text/plain;charset=utf-8'}),'taiwan-strait-log-t'+S.turn+'-'+stampNow()+'.txt');toast(TX('已匯出戰報文字'),1500);
}
function exportReportText(){
  const w=document.querySelector('#mbox .finw');if(!w)return;
  const body=[...w.querySelectorAll('.fin-head,.fin-body')].map(e=>e.innerText.replace(/\n{3,}/g,'\n\n').trim()).join('\n\n');
  let o=textHead('戰後檢討報告')+'\n'+body+'\n';
  dlBlob(new Blob([o],{type:'text/plain;charset=utf-8'}),'taiwan-strait-report-'+stampNow()+'.txt');toast(TX('已匯出報告文字'),1500);
}
$('#btnShot').onclick=exportShot;$('#btnLogExp').onclick=exportLogText;
/* ---------- 語音播報（Web Speech API；預設關閉） ---------- */
const VOICE={n:0,
  get on(){return !!window.speechSynthesis&&$('#optVoice').value==='1';},
  lang:{'zh-TW':'zh-TW','zh-CN':'zh-CN',en:'en-US',ja:'ja-JP'}[window.TSL_LANG||'zh-TW'],
  speak(html,o){
    if(!this.on||!html)return;o=o||{};
    const d=document.createElement('div');d.innerHTML=html;
    const say=d.querySelector('.say');
    const parts=say?[say.textContent.replace(/\s+/g,' ').trim()]:[...d.querySelectorAll('h3,h4,p,li')].map(e=>e.textContent.replace(/\s+/g,' ').trim().replace(/[。.]$/,'')).filter(Boolean);
    let t=parts.length?parts.join('。'):(d.textContent||'').replace(/\s+/g,' ').trim();
    if(t.length>(say?900:260)){const c=t.slice(0,say?900:260),i=Math.max(c.lastIndexOf('。'),c.lastIndexOf('；'),c.lastIndexOf('. '));t=i>80?c.slice(0,i+1):c;}
    if(!say||window.TSL_LANG==='zh-CN')t=(window.TSL_T||(x=>x))(t);if(!t)return;
    if(o.flush||this.n>=3){speechSynthesis.cancel();this.n=0;}
    const u=new SpeechSynthesisUtterance(t),vs=speechSynthesis.getVoices();u.lang=this.lang;
    const sc=x=>(x.lang===this.lang?2:x.lang.slice(0,2)===this.lang.slice(0,2)?1:0)*10+(/premium|enhanced|natural|neural|siri|google|online/i.test(x.name)?5:0)+(x.localService?0:1);
    const v=vs.filter(x=>sc(x)>=10).sort((a,b)=>sc(b)-sc(a))[0];if(v)u.voice=v;
    u.rate=o.rate||1;this.n++;u.onend=u.onerror=()=>{this.n=Math.max(0,this.n-1);};
    speechSynthesis.speak(u);},
  stop(){try{if(window.speechSynthesis)speechSynthesis.cancel();}catch(e){}this.n=0;}
};
// ---------- 空襲警報音效（Web Audio 合成的升降音，不需要音檔；預設關閉）----------
const SFX={ctx:null,get on(){const e=$('#optSfx');return !!e&&e.value==='1';},
  ac(){try{if(!this.ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;this.ctx=new A();}if(this.ctx.state==='suspended')this.ctx.resume();return this.ctx;}catch(e){return null;}},
  siren(sec){if(!this.on)return;const c=this.ac();if(!c)return;const t0=c.currentTime+.05,T=sec||6,per=3,o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
    o.type='sawtooth';f.type='lowpass';f.frequency.value=1600;o.connect(f);f.connect(g);g.connect(c.destination);
    for(let t=0;t<T;t+=per){o.frequency.setValueAtTime(380,t0+t);o.frequency.linearRampToValueAtTime(820,t0+t+per*.55);o.frequency.linearRampToValueAtTime(380,t0+t+per);}
    g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(.16,t0+.6);g.gain.setValueAtTime(.16,t0+T-1);g.gain.linearRampToValueAtTime(0,t0+T);o.start(t0);o.stop(t0+T+.1);}};
document.addEventListener('pointerdown',()=>{if(SFX.on)SFX.ac();},true); // 手機瀏覽器要使用者點擊後才能出聲
function sfxBtn(){const b=$('#btnSfx');if(!b)return;const on=SFX.on;b.innerHTML=(on?'🚨':'🔇')+'<span class="bl"> 警報：'+(on?'開':'關')+'</span>';b.setAttribute('aria-pressed',on?'true':'false');}
$('#btnSfx').onclick=()=>{const e=$('#optSfx');e.value=e.value==='1'?'0':'1';e.dispatchEvent(new Event('change'));sfxBtn();if(e.value==='1')SFX.siren(2);};
$('#optSfx').addEventListener('change',sfxBtn);
$('#optFxSpd').addEventListener('change',()=>{FXSPD=+$('#optFxSpd').value||1;});$('#optTerm').addEventListener('change',()=>{TERM=$('#optTerm').value||'plain';});setTimeout(()=>{TERM=$('#optTerm').value||'plain';},0);setTimeout(()=>{FXSPD=+$('#optFxSpd').value||1;},0);
function voiceBtn(){const b=$('#btnVoice');if(!window.speechSynthesis){b.hidden=true;return;}b.hidden=false;const on=$('#optVoice').value==='1';b.innerHTML=(on?'🔊':'🔈')+'<span class="bl"> 語音：'+(on?'開':'關')+'</span>';b.setAttribute('aria-pressed',on);if(!on)VOICE.stop();}
$('#btnVoice').onclick=()=>{const e=$('#optVoice');e.value=e.value==='1'?'0':'1';e.dispatchEvent(new Event('change'));if(e.value==='1')VOICE.speak('語音播報已開啟',{flush:true});};
$('#optVoice').addEventListener('change',()=>{try{localStorage.setItem('tsl-voice-user','1');}catch(e){}voiceBtn();});
voiceBtn();
/* ---------- 事件卡：可拖曳（位置會記住）、可按右上 ✕ 關閉 ---------- */
function vcardPlace(){
  const cd=$('#vcard');let pos=null;try{pos=JSON.parse(localStorage.getItem('tsl-vcard-pos')||'null');}catch(e){}
  if(!pos||typeof pos.x!=='number'){cd.classList.remove('moved');cd.style.left=cd.style.top='';return;}
  cd.classList.add('moved');
  const w=cd.offsetWidth||320,h=cd.offsetHeight||160;
  cd.style.left=Math.max(4,Math.min(innerWidth-w-4,pos.x))+'px';cd.style.top=Math.max(4,Math.min(innerHeight-h-4,pos.y))+'px';
}
(function(){
  const cd=$('#vcard');let d=null;
  cd.addEventListener('pointerdown',e=>{
    if(e.target.closest('#vcClose'))return;
    const r=cd.getBoundingClientRect();d={dx:e.clientX-r.left,dy:e.clientY-r.top,moved:false};
    try{cd.setPointerCapture(e.pointerId);}catch(x){}
  });
  cd.addEventListener('pointermove',e=>{
    if(!d)return;d.moved=true;cd.classList.add('moved');
    const w=cd.offsetWidth,h=cd.offsetHeight;
    cd.style.left=Math.max(4,Math.min(innerWidth-w-4,e.clientX-d.dx))+'px';cd.style.top=Math.max(4,Math.min(innerHeight-h-4,e.clientY-d.dy))+'px';
  });
  const end=()=>{if(!d)return;if(d.moved){try{localStorage.setItem('tsl-vcard-pos',JSON.stringify({x:parseFloat(cd.style.left),y:parseFloat(cd.style.top)}));}catch(e){}}d=null;};
  cd.addEventListener('pointerup',end);cd.addEventListener('pointercancel',end);
  $('#vcClose').onclick=()=>{V.cardClosed=V.i;cd.hidden=true;};
  cd.addEventListener('dblclick',()=>{try{localStorage.removeItem('tsl-vcard-pos');}catch(e){}cd.classList.remove('moved');cd.style.left=cd.style.top='';}); // 連點兩下回到預設位置
  addEventListener('resize',()=>{if(!cd.hidden)vcardPlace();});
})();
function vSchedule(){
  clearTimeout(V.t);if(!V.playing)return;
  const f=V.fr[V.i];let d=f.card?f.card.dur:(f.cap.length?1300:420);
  V.wait=0;V.t=setTimeout(vTick,d/V.sp);
}
function vTick(){
  if(VOICE.on&&speechSynthesis.speaking&&V.wait++<160){V.t=setTimeout(vTick,250);return;} // 等語音唸完再進下一步（最多 40 秒）
  if(V.i>=V.fr.length-1){vEnd();return;}
  vShow(V.i+1,false,true);vSchedule();
}
function vEnd(){V.playing=false;vBtn();VOICE.stop();$('#vcard').hidden=true;if(REC.final)showFinal(REC.final);}
$('#vPlay').onclick=()=>{
  if(!V.fr.length)return;
  if(!V.playing&&V.i>=V.fr.length-1)vShow(0,true);
  V.playing=!V.playing;vBtn();if(V.playing)vSchedule();else{clearTimeout(V.t);VOICE.stop();vShow(V.i,true);}
};
$('#vScrub').addEventListener('input',e=>{vShow(+e.target.value,true);vSchedule();});
$('#vSpeed').addEventListener('change',e=>{V.sp=+e.target.value;vSchedule();});
function vTurnJump(dir){
  if(!V.fr.length)return;const cur=V.fr[V.i].S.turn,turns=Object.keys(V.turnStart).map(Number).sort((a,b)=>a-b);
  let target;
  if(dir>0){target=turns.find(t=>t>cur);if(target===undefined)return vShow(V.fr.length-1,true);}
  else{const start=V.turnStart[cur];target=V.i>start+1?cur:[...turns].reverse().find(t=>t<cur);if(target===undefined)target=turns[0];}
  vShow(V.turnStart[target],true);vSchedule();
}
$('#vNextT').onclick=()=>vTurnJump(1);$('#vPrevT').onclick=()=>vTurnJump(-1);
$('#vAgain').onclick=()=>startVideo();$('#vStats').onclick=()=>runStats(100);$('#vBack').onclick=backToSetup;
addEventListener('keydown',e=>{
  if(!S||!S.video||!V.fr.length||/INPUT|SELECT|TEXTAREA/.test((e.target||{}).tagName||'')&&e.key!==' ')return;
  if(!$('#modal').hidden)return;
  if(e.key===' '){e.preventDefault();$('#vPlay').click();}
  else if(e.key==='ArrowRight'){vShow(V.i+1,true);vSchedule();}
  else if(e.key==='ArrowLeft'){vShow(V.i-1,true);vSchedule();}
});
