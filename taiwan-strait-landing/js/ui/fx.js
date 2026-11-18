'use strict';
/* 狀態列、資訊卡、除錯鉤子（自 fx.js 拆出） */
if(/[?&]debug=1/.test(location.search))window.__fxIntercept=(...a)=>fxIntercept(...a);
if(/[?&]debug=1/.test(location.search))window.__ext=()=>{const out=[],real=S;
  const tryit=(name,fn)=>{PREVIEW=true;try{S=structuredClone(real);const r=fn();out.push(name+' OK '+(Array.isArray(r)?r.length:''));}catch(e){out.push(name+' ERR '+e.message);}finally{S=real;PREVIEW=false;}};
  EVENTS.forEach(ev=>{if(!ev.choice)return;ev.choice.options.filter(o=>o.x).forEach(o=>{const sp=(ev.dice||[]);for(let r=0;r<(sp.length?3:1);r++)tryit(ev.id+':'+o.id+(sp.length?'#'+r:''),()=>ev.apply(o.id,sp.map(d=>d.rows[Math.min(r,d.rows.length-1)])));});});
  ['atk','def'].forEach(side=>truceOptions(side).opts.filter(o=>o.x).forEach(o=>tryit('truce:'+o.id,()=>applyTruce(side,o))));
  tryit('port',()=>applyPort(PORTS[0],portOptions(PORTS[0]).opts.find(o=>o.x)));
  return out;};
if(/[?&]debug=1/.test(location.search)){window.__cpd={EVENTS,interdictOptions,interdictEval,mkUnit,resolveSupply,conditions,snap,hpCell,cpOf,isShip,onTW,isLch,SPOT,TER,cnHitP,cnValue,cnTargets,stgTargets,CNB,strikeCN,cnShown,render:(...a)=>render(...a)};
  window.__truceDef=()=>truceOptions('def').opts.map(o=>o.id);
  window.__instant=()=>checkInstant();
  window.__hm=(id)=>{const u=S.units.find(z=>z.id===id);
  const m=[...reach(u).entries()].find(([k,v])=>v.kind==='sail'||v.kind==='move');
  if(!m)return null;
  humanMove(u,m[0],m[1].kind);
  return {avail:undoAvail(),c:u.c,r:u.r};
  };
  window.__undo=()=>{const u0=S.undo&&S.units.find(z=>z.id===S.undo.id);
  undoMove();
  return u0?{c:u0.c,r:u0.r,moved:u0.moved,avail:undoAvail()}:null;
  };
  window.__guard=()=>endPhaseGuard();
  window.__fxSub=o=>fxSub(o);
  window.__kill=id=>{const u=S.units.find(z=>z.id===id);
  if(!u)return null;
  damage(u,u.hp,'test');
  render();
  return GHOSTS.size;
  };
  window.__gh=()=>GHOSTS.size;
  window.__sd=()=>{const u=S.units.find(z=>z.type==='hk');
  const d=S.units.find(z=>z.type==='dd');
  if(!u||!d)return null;
  const rc=[...reach(u).entries()].find(([k,v])=>v.kind==='sail');
  if(rc){u.c=TER[rc[0]].c;
  u.r=TER[rc[0]].r;
  }d.c=u.c;
  d.r=u.r;
  let seen=0,hit=0;
  for(let i=0;i<200;i++){u.revealed=false;
  u.hp=2;
  S.log.length=0;
  subDetect();
  if(u.revealed)seen++;
  if(u.hp<2)hit++;
  }return {seen,hit,atSea:atSea(u)};
  };
  window.__hit=(p,n)=>{for(const k in ACC)delete ACC[k];
  let h=0;
  for(let i=0;i<n;i++)if(hitP(p,'t'))h++;
  return h;
  };
  window.__wx=()=>({m:S.month,wx:S.mods.wx});
  window.__wave=(mo,n)=>{const keep=[S.month,S.typhoon,S.waveZ,S.typhoonNew];
  S.month=mo;
  S.typhoon=null;
  S.waveZ=0;
  let sum=0,hi=0,ty=0,mx=0,prevT=false,ev=0;
  for(let i=0;i<n;i++){const w=nextWave();
  sum+=w.wave;
  if(w.wave>=2.5)hi++;
  if(w.wave>=5)ty++;
  mx=Math.max(mx,w.wave);
  const t=!!S.typhoon||w.wave>=5;
  if(t&&!prevT)ev++;
  prevT=t;
  }[S.month,S.typhoon,S.waveZ,S.typhoonNew]=keep;
  return {mo,mean:+(sum/n).toFixed(2),pGe25:+(hi/n).toFixed(3),pTyph:+(ty/n).toFixed(3),max:+mx.toFixed(1),typhoonEvents:ev};
  };
  window.__cvt=n=>{window.__sup&&window.__sup();
  S.turn=Math.max(S.turn,3);
  const out=[];
  for(let i=0;i<n;i++){convoyTurn();
  out.push(S.units.filter(u=>u.type==='cvy').map(u=>u.c+','+u.r).join(' '));
  S.turn++;
  }return {out,can:S.units.filter(u=>u.type==='cvy').map(u=>canSail(u))};
  };
  window.__hkdbg=()=>{const u=S.units.find(z=>z.type==='hk');
  return {human:humanTurn(),phase:S.phase,busy:S.busy,moved:u.moved,acted:u.acted,reach:[...reach(u).entries()].map(([k,v])=>k+':'+v.kind).slice(0,6),step:hkHomeStep(u)};
  };
  window.__hkhome=()=>{const u=S.units.find(z=>z.type==='hk');
  if(!u)return null;
  S.sel=u;
  S.phase='def';
  S.ctrl.def='human';
  S.busy=false;
  u.moved=false;
  u.acted=false;
  const b={c:u.c,r:u.r};
  hkGoHome();
  return {b,a:{c:u.c,r:u.r},port:hexOf(u).t};
  };
  window.__collapse=n=>{S.turn=Math.max(S.turn,4);
  S.pools.plaLift=0;
  S.units=S.units.filter(u=>!(u.side==='atk'&&u.type==='cvy'));
  S.sup={t:S.turn,total:0};
  const r=[];
  for(let i=0;i<n&&!S.over;i++){supplyAttrition();
  r.push(S.stats.supDef);
  }return {r,over:S.over,used:supply().used};
  };
  window.__sup=()=>{const r0=supply().cap;
  Object.keys(MINOR_PORTS).forEach(k=>{S.owner[k]='atk';});
  const r1=supply().cap;
  S.turn=Math.max(S.turn,3);
  S.bh={};
  ['22,4','19,7','18,10'].forEach(k=>{S.owner[k]='atk';S.bh[k]=S.turn-1;});
  const r2=supply().cap;
  render();
  return [r0,r1,r2];
  };
  window.__owner=r=>{const hs=Object.values(TER).filter(h=>h.isl==='TW'&&isLand(h));
  hs.slice(0,Math.round(hs.length*r)).forEach(h=>{S.owner[h.k]='atk';});
  return twControl();
  };
  window.__wipe=()=>{S.stats.sailed=true;
  S.turn=Math.max(S.turn,3);
  S.units=S.units.filter(u=>!(u.side==='atk'&&!isShip(u)&&(atSea(u)||onTW(u)||hexOf(u).isl==='PH')));
  checkInstant();
  };
  window.__attr=()=>{S.turn=Math.max(S.turn,3);
  const a=S.units.filter(u=>u.side==='atk'&&!isShip(u));
  const tw=TER[TAIPEI];
  a.slice(0,18).forEach(u=>{u.c=tw.c;u.r=tw.r;});
  const b=S.units.filter(u=>u.side==='atk'&&onTW(u)).reduce((x,u)=>x+u.hp,0);
  supplyAttrition();
  const c=S.units.filter(u=>u.side==='atk'&&onTW(u)).reduce((x,u)=>x+u.hp,0);
  return [b,c,supply()];
  };
  window.__force3=keep=>{PORTS.concat([TAIPEI]).forEach(k=>{S.owner[k]='atk';delete S.portDown[k];});
  const tw=TER[TAIPEI];
  S.units.filter(u=>u.side==='atk'&&!isShip(u)).slice(0,16).forEach(u=>{u.c=tw.c;u.r=tw.r;u.hp=TYPES[u.type].hp;});
  let left=keep;
  S.units.filter(u=>u.side==='def'&&onTW(u)).forEach(u=>{if(left>0){u.hp=Math.min(u.hp,left);left-=u.hp;}else S.units=S.units.filter(x=>x!==u);});
  S.turn=Math.max(S.turn,3);
  const a=snap();
  return [a.n,a.as,a.ds];
  };
  }
if(/[?&]debug=1/.test(location.search))window.__reach=id=>{const u=S.units.find(x=>x.id===id);
  if(!u)return null;
  const h=hexOf(u);
  return {at:h.k,t:h.t,isl:h.isl,coastal:h.coastal,zones:{pen:ZONES.penghu,sp:SPOT.penghu,mg:SPOT.magong},reach:[...reach(u)].map(([k,v])=>k+':'+v.kind).slice(0,40),moved:u.moved,acted:u.acted};
  };
if(/[?&]debug=1/.test(location.search))window.__af=()=>({n:airfields().length,names:airfields().map(h=>h.k+':'+(h.name||'')),share:afShare(),rocAir:S.pools.rocAir,pick:pickAirfield()});
if(/[?&]debug=1/.test(location.search))window.__score=async(cfg)=>{ // 測試用：依設定跑一場電腦推演，回傳雙方原始分數
  for(const [k,v] of Object.entries(cfg||{})){const e=document.getElementById(k);if(e)e.value=v;}
  const keep=S;
    await simRun(true);
    const m=endScores(),r={A:m.A.total,D:m.D.total,win:(S.result&&S.result.side)||null,US:S.fx.lv.US,JP:S.fx.lv.JP,cvySunk:S.stats.cvySunk||0,arr:S.log.reduce((a,
        l)=>{const q=/補給船團 (\d+) 個抵達卸貨/.exec(l.msg);return a+(q?+q[1]:0);},0),sent:S.log.reduce((a,l)=>{const q=/攻方派出 (\d+) 個補給船團/.exec(l.msg);return a+(q?+q[1]:0);},0),
        turn:S.turn,lh:S.log.reduce((h,l)=>{for(const ch of String(l.msg))h=(h*31+ch.charCodeAt(0))|0;return h;},0),uh:S.units.map(u=>u.type+u.hp+'@'+u.c+','+u.r).join(';')};
    r.uh=[...r.uh].reduce((h,ch)=>(h*31+ch.charCodeAt(0))|0,0);
    S=keep;
    return r;
    }; // lh、uh：戰報與棋子位置的雜湊（重構時比對新舊版是否完全相同）
if(/[?&]debug=1/.test(location.search))window.__sup2=()=>S.sup;
if(/[?&]debug=1/.test(location.search))window.__spd=()=>{const o={};
  for(const u of S.units)if(atSea(u)||u.type==='hk'){const r=reach(Object.assign({},u,{moved:false,acted:false}));
  let mx=0;
  for(const [k,v] of r)if(v.kind==='sail')mx=Math.max(mx,hd(hexOf(u),TER[k]));
  o[u.type]=Math.max(o[u.type]||0,mx);
  }return {wx:S.weather.sea,o};
  };
  window.__c3={cov:()=>{const u=jmsLead();
  return adCover(u).map(e=>e.type+':ad'+e.mag.ad+':d'+hd(hexOf(e),hexOf(u)));
  },jms:()=>{jmsSync();
  return {on:S.jmsOn,u:S.units.filter(u=>u.ally==='JP').map(u=>u.type+u.hp+'@'+u.c+','+u.r)};
  },grab:()=>{S.owner[PORTS[0]]='atk';
  return PORTS[0];
  },pd:()=>JSON.stringify(S.portDown),tom:async()=>{await usTomahawk();
  return S.log.slice(0,4).map(l=>l.msg);
  },fire:()=>{const f=computeFire();
  return [f,S.fireNote];
  },sea:()=>{seaBattle();
  return S.log.slice(0,2).map(l=>l.msg);
  },det:()=>{subDetect();
  return S.log.slice(0,3).map(l=>l.msg);
  },scr:()=>usAswScreen()};
  window.__cvw={render:()=>render(),plan:()=>{cvwPlan();
  return S.cvwA;
  },strike:s=>{cvwStrike(s);
  return S.log.slice(0,3).map(l=>l.msg);
  },sync:()=>uscSync(),turn:()=>uscTurn(),car:s=>cvwCarriers(s).map(c=>({t:c.u.type,i:c.i,sor:c.sor,at:c.u.c+','+c.u.r,foes:cvwFoes(s,c).length}))};
if(/[?&]debug=1/.test(location.search))window.__ally={hum:()=>allyHuman(),ph:()=>{const D=S.units.filter(u=>u.side==='def'&&hexOf(u).isl==='PH'),A=S.units.filter(u=>u.side==='atk'&&!isShip(u)&&hexOf(u).isl==='PH');
  return {t:S.turn,dN:D.length,dHp:D.reduce((a,u)=>a+u.hp,0),dT:D.map(u=>u.type).join(','),aN:A.length,mg:S.owner[MAGONG],pf:!!(S.plan&&S.plan.pfirst),twA:S.units.filter(u=>u.side==='atk'&&!isShip(u)&&onTW(u)).length};
  },aiOne:async id=>{const u=S.units.find(x=>x.id===id);
  const n0=LOGN;
  const rc=reach(u);
  const goals=ZONES[u.zone||aiPlan().zone];
  const opts=[...rc.entries()].filter(([k,v])=>v.kind==='land').map(([k])=>k+':'+TER[k].isl+':md'+minD(k,goals));
  await aiAtkUnit(u);
  return {zone:u.zone,opts,log:S.log.filter(l=>l.n>n0).map(l=>l.msg.slice(0,80)),at:u.c+','+u.r,alive:alive(u)};
  },seaInfo:()=>S.units.filter(u=>u.side==='atk'&&atSea(u)&&!isShip(u)).map(u=>{const sh=shipOf(u),rc=reach(Object.assign({},u,{moved:false,acted:false}));const L=[...rc.entries()].filter(([k,
      v])=>v.kind==='land');const goals=ZONES[u.zone||aiPlan().zone];return {t:u.type,hp:u.hp,ship:sh&&sh.type,at:u.c+','+u.r,land:L.length,landNear:L.filter(([k])=>minD(k,
      goals)<=kmH(200)).length,dGoal:minD(K(u.c,u.r),goals),moved:!!u.moved};}),pools:()=>({lst:S.pools.plaLst,lift:S.pools.plaLift,roRes:S.roReserve}),tw:()=>{const A=S.units.filter(u=>u.side==='atk'&&!isShip(u)&&onTW(u)),
      D=S.units.filter(u=>u.side==='def'&&onTW(u)&&!isMsl(u)),sea=S.units.filter(u=>u.side==='atk'&&!isShip(u)&&atSea(u));
  const sp=supply();
  return {t:S.turn,ph:S.phase,aN:A.length,aHp:A.reduce((x,u)=>x+u.hp,0),dN:D.length,dHp:D.reduce((x,u)=>x+u.hp,0),sea:sea.length,cap:sp.cap,used:sp.used,ports:PORTS.filter(k=>S.owner[k]==='atk').length,
      own:Object.values(TER).filter(h=>h.isl==='TW'&&isLand(h)&&S.owner[h.k]==='atk').length,adv:(S.intent||{}).adv,cn:S.units.filter(u=>u.side==='atk'&&!isShip(u)&&hexOf(u).isl==='CN').length};
  },lch:()=>S.units.filter(u=>isLch(u)).map(u=>u.type+':'+u.veh+'/'+lchV0(u)+':hp'+u.hp),loc:()=>S.units.filter(u=>isLch(u)).slice(0,3).map(u=>{const a=locateP(u,
      'bm'),b=locateP(u,'cm');return u.type+(u.revealed?'R':'H')+':'+a.p.toFixed(2)+'/'+b.p.toFixed(2)+' '+a.txt;}),drone:()=>({p:S.pools.plaDrone,p0:S.p0.plaDrone,d:S.stats.drones,
      log:S.log.filter(l=>/改裝無人機/.test(l.msg)).slice(0,2).map(l=>l.msg)}),tyStart:(lon,lat)=>{S.dDelay=0;
  S.turn=1;
  S.typhoon=Object.assign(tySpawn(),{lon,lat,cls:1,R:250});
  S.nextW=null;
  S.weather=rollWeather();
  return {delay:S.dDelay,ty:S.weather.ty&&[+S.weather.ty.lon.toFixed(2),+S.weather.ty.lat.toFixed(2)],log:S.log.slice(0,2).map(l=>l.msg)};
  },shel:()=>({atk:shelterNeeded('atk'),def:shelterNeeded('def'),fc:S.fcH,n:S.units.filter(u=>shelterAt(u)).length}),wx:()=>({base:S.weather.base,wave:S.weather.wave,
      ty:S.weather.ty,z:Object.keys(WXZ).map(z=>z+':'+wxWaveLL(z==='W'?WXREF:z==='N'?[121.7,25.75]:z==='E'?[122.3,23.3]:[120.9,21.35]))}),tyForce:(lon,lat,cls)=>{S.typhoon=Object.assign(tySpawn(),{lon,lat,cls:cls||1,R:250});
  S.nextW=null;
  S.weather=rollWeather();
  render();
  return {w:S.weather.wave,ty:S.weather.ty};
  },tyRun:n=>{const out=[];
  let t=tySpawn();
  for(let i=0;i<n;i++){out.push([+t.lon.toFixed(2),+t.lat.toFixed(2),t.cls]);
  if(!tyStep(t)){out.push('gone');
  break;
  }}return out;
  },loss:()=>{const L=lossData();
  return {atk:L.atk.find(r=>r[0]==='戰機'),def:L.def.find(r=>r[0]==='戰機'),us:L.ally.find(r=>/艦載機/.test(r[0])),raw:S.stats.airL};
  },ssm:()=>S.units.filter(u=>u.type==='ssm').map(u=>({id:u.id,veh:u.veh,hp:u.hp,ready:ssmReady(u),fk:u.fk,mT:u.mT,rev:!!u.revealed,shots:u.shots})),ssmHit:id=>{const u=S.units.find(x=>x.id===id);
  return ssmHit(u,'test');
  },dmg:(id,n)=>{const u=S.units.find(x=>x.id===id);
  damage(u,n,'test');
  return u.hp;
  },as:()=>S.pools.rocAS,fireAS:id=>{const u=S.units.find(x=>x.id===id);
  const b=S.pools.rocAS;
  const t=S.units.find(x=>x.side==='atk'&&atSea(x));
  if(!t)return null;
  u.shots=1;
  fireMissile(u,t);
  return [b,S.pools.rocAS];
  },eff:id=>{const u=S.units.find(x=>x.id===id);
  return {a:effAtk(u),d:effDef(u),n:effNote(u),mobT:u.mobT};
  },pcs:()=>S.units.filter(u=>u.ally&&alive(u)).map(u=>({id:u.id,t:u.type,c:u.c,r:u.r,moved:!!u.moved,acted:!!u.acted,shots:u.shots,mag:u.mag})),reach:id=>{const u=S.units.find(x=>x.id===id);
  return u?[...reach(u).keys()].length:-1;
  },move:(id,k)=>{const u=S.units.find(x=>x.id===id);
  const rc=reach(u);
  if(!rc.has(k))return false;
  humanMove(u,k,rc.get(k).kind);
  return true;
  },rk:id=>{const u=S.units.find(x=>x.id===id);
  return [...reach(u).keys()];
  },tg:id=>{const u=S.units.find(x=>x.id===id);
  return targets(u).map(t=>t.id+':'+t.type);
  },fire:(id,tid)=>{const u=S.units.find(x=>x.id===id),t=S.units.find(x=>x.id===tid);
  fireMissile(u,t);
  return true;
  },vol:id=>{const u=S.units.find(x=>x.id===id);
  return {t:volleyTargets(u).map(t=>t.id),s:volleyShooters(u).length};
  },volley:(id,tid)=>{const u=S.units.find(x=>x.id===id),t=S.units.find(x=>x.id===tid);
  const sh=volleyShooters(u,t);
  return sh.length?fireVolley(sh,t):false;
  },cvw:id=>{const u=S.units.find(x=>x.id===id);
  const I=cvwManualInfo(u),L=cvwManualLandInfo(u);
  return {n:I&&I.n,foes:I&&I.foes.map(t=>t.id),ln:L&&L.n,lt:L&&L.tg.length};
  },cvwShoot:(id,tid)=>{const u=S.units.find(x=>x.id===id),t=S.units.find(x=>x.id===tid);
  return cvwManual(u,t);
  },tom:id=>{const u=S.units.find(x=>x.id===id);
  return tomShooters(u).length;
  },tomFire:(id,cn)=>{const u=S.units.find(x=>x.id===id);
  allyTomahawk(u,cn);
  return true;
  },cn:()=>cnTargets(),end:()=>endPhase(),own:id=>{const u=S.units.find(x=>x.id===id);
  return cvOwn(u);
  }};
if(/[?&]debug=1/.test(location.search))window.__fl={aggr:(id,k)=>{const u=S.units.find(x=>x.id===id);return cvAggr(u,TER[k]);},moveUS:async u=>{await uscMove(u);},moveCV:async u=>{await aiAtkUnit(u);},sup:u=>supMult(u),d:(a,b)=>hd(hexOf(a),hexOf(b))};
if(/[?&]debug=1/.test(location.search))window.__cvTest=side=>{if(side==='US')usCarrierSunk();else plaCarrierLost('測試');return S.log.slice(0,4).map(l=>l.msg);};
if(/[?&]debug=1/.test(location.search))window.__targets=id=>{const u=S.units.find(x=>x.id===id);return u?{type:u.type,shots:u.shots,acted:u.acted,moved:u.moved,hex:hexOf(u).k,t:targets(u).map(e=>e.type+'@'+hexOf(e).k+(atSea(e)?'(sea)':'')+' d='+hd(hexOf(u),hexOf(e)))}:null;};
if(/[?&]debug=1/.test(location.search))window.__dog=o=>fxDog(o);
if(/[?&]debug=1/.test(location.search)){window.__fg=k=>failGuide(k);window.__ledger=()=>defLedger();window.__isig=()=>intentSig();}
if(/[?&]debug=1/.test(location.search))window.__fxShot=(a,b,o)=>fxShot(a,b,o);
if(/[?&]debug=1/.test(location.search))window.__fxFlight=(a,b,k)=>fxFlight(a,b,k);window.__fxDur=(k,hex)=>Math.round(fxDur(k,hex*HPX));
// 守方潛艦對攻方玩家隱蔽：沒開火暴露前看不到（雙方都由人操作、守方玩家、或電腦對電腦觀戰時看得到）
const subInPort=u=>u.type==='hk'&&hexOf(u).t==='port'&&hexOf(u).isl==='TW'; // 回港補給的潛艦停在碼頭，位置固定、看得到，也能被飛彈與空襲打擊
const canHitSub=u=>u.type==='hk'?subInPort(u):u.type==='psub'?psubInPort(u):!(u.type==='ssn'||u.type==='nme'||u.type==='mdt');
const subHidden=u=>(((u.type==='hk'||u.type==='ssn')&&u.side==='def'&&!subInPort(u)&&S.ctrl.atk==='human'&&S.ctrl.def!=='human')||(u.type==='psub'&&!psubInPort(u)&&S.ctrl.def==='human'&&S.ctrl.atk!=='human'))&&!u.revealed&&!S.over&&!S.video&&!S.sim;
const unitAtVis=k=>S.units.find(u=>K(u.c,u.r)===k&&!subHidden(u));

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
    '<span class="chip tp"'+tip('w','【天候・台灣海峽】'+W.n+(W.base!=null?'（各海域：'+Object.keys(WXZ).map(z=>WXZ[z]+' '+wxWaveLL(z==='W'?WXREF:z==='N'?[121.7,25.75]:z==='E'?[122.3,
        23.3]:[120.9,21.35]).toFixed(1)+' m').join('、')+(W.ty?'；'+TYC[W.ty.cls].n+'颱風，暴風半徑 '+W.ty.R+' km，距海峽 '+Math.round(kmLL([W.ty.lon,W.ty.lat],WXREF))+' km':'')+'）':'')+
        '：海上每回合可移動 '+W.sea+' 格；灘頭卸載能力 '+Math.round(Math.max(0,Math.min(1,(2.5-(W.wave||0))/1.25))*100)+'%、港口 '+Math.round(Math.max(.3,Math.min(1,(4-(W.wave||0))/2))*100)+
        '%；'+(W.air?'空降與空襲可以進行':'空降與空襲停擺')+(W.fire?'；火力 '+W.fire:'')+'。浪高 2.5 公尺以上，海上登陸艦、運兵船與補給船團開始損耗，5 公尺以上護航艦與航艦也會。'+(S.fcH!=null?'預報下回合浪高約 '+S.fcH.toFixed(1)+' 公尺（誤差約 ±0.3，颱風時 ±0.6）。':'')+
        (shelterNeeded()?'預報風浪偏大，可以下「避風令」。':''))+'>天候 '+W.n+(S.fcH!=null?' · 預報 '+S.fcH.toFixed(1)+' 公尺'+(S.fcTyphoon?'（颱風）':''):'')+' · 海上移動 <b>'+W.sea+'</b></span>'+
    '<span class="chip tp"'+tip('f',atkP?'【火力】攻方這個階段可以打擊 '+S.fire+' 個目標（火箭軍飛彈、空軍、艦砲等的總和，按「火力打擊」再點目標；每點命中率不高，優先打威脅大的目標）。'+(S.fireNote?S.fireNote:''):'【火力】守方的火力來自岸置飛彈與盟軍；本回合攻方火力 '+S.fire+' 點。'+(S.fireNote?S.fireNote:''))+'>火力 <b>'+S.fire+'</b></span>'+
    '<span class="chip tp"'+tip('a','【制空】雙方空軍對抗的結果：'+AIRCTL[ac]+'。制空優勢的一方空襲與空降更順利、損失較小。'+(S.sead?'目前守方防空被壓制，攻方飛機較安全。':'')+(afShare()<1?'機場受損，起降能力剩 '+Math.round(afShare()*100)+
        '%。':''))+'>制空 <b>'+({atk:'攻優',mid:'均勢',def:'守優'}[ac])+'</b>'+(S.sead?' · 防空壓制':'')+(afShare()<1?' · 機場 '+Math.round(afShare()*100)+'%':'')+'</span>'+
    '<span class="chip tp"'+tip('s','【補給】攻方島上有 '+sp.used+' 個部隊需要彈藥與油糧，補給容量 '+sp.cap+'。'+(sp.over?'需求超過容量，部隊會一回合比一回合損耗，連續多回合缺補給攻方會崩潰。要打開港口、灘頭或補給站來提高容量。':'容量足夠。補給靠港口、灘頭卸貨、空投與就地徵用。'))+(sp.over?' style="border-color:var(--atk);color:var(--atk)"':'')+'>補給 <b>'+sp.used+' / '+sp.cap+'</b></span>';
  $('#status').innerHTML=stHTML;{const ch=[...$('#status').children];$('#statusTop').innerHTML=ch.slice(0,2).map(c=>c.outerHTML).join('');
    const wb=$('#wxBody');wb.innerHTML='';const wx=ch.find(c=>(c.dataset.tip||'').startsWith('【天候'));
    if(wx&&wxMobile()){wx.classList.add('wxmoved'); // 手機：天候搬到地圖上的小膠囊（原狀態列隱藏）；點一下顯示完整說明
      const wv=W.wave,lv=wv==null?'g':wv>=2.5?'r':wv>1.25?'o':'g',ty=W.ty||(S.nextW&&S.nextW.ty)||S.fcTyphoon; // 顏色門檻＝灘頭卸載規則：1.25 m 以下不受影響、2.5 m 以上無法卸載
      const pill=document.createElement('span');pill.className='chip tp wxp '+lv;pill.setAttribute('data-tip',wx.dataset.tip);pill.setAttribute('tabindex','0');pill.setAttribute('role','button');
      pill.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 20c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M5 10c1.5-3.5 5-5 8.5-4-2 1-2.5 3-1 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
        (wv!=null?'<b>'+wv.toFixed(1)+' m</b>'+(S.fcH!=null?'<i title="'+TX('預報下回合')+'"'+(S.fcH>=2.5?' class="r"':S.fcH>1.25?' class="o"':'')+'>'+(S.fcH>wv+.05?'↗':S.fcH<wv-.05?'↘':'→')+S.fcH.toFixed(1)+'</i>':''):'<b>'+W.n+'</b>')+(ty?'<em>颱風</em>':'')+
        '<span class="sep">·</span><span class="bc">'+(wv==null?'':wv<=1.25?TX('可搶灘'):wv>=2.5?TX('無法搶灘'):TX('搶灘')+' '+Math.round((2.5-wv)/1.25*100)+'%')+'</span>'+ // 灘頭卸載能力（同狀態列的規則）
        '<span class="sep">·</span><span class="mv">'+TX('船速')+' <b>'+W.sea+'</b>'+TX('格')+'</span>';
      wb.appendChild(pill);}
    wxWinSync();}
  $('#fsStatus').textContent='第 '+S.turn+'/'+S.T+' 回合 · '+SIDE[S.phase]+' · '+String(S.weather.n).replace(/（[^）]*）/g,'').replace(/\s*公尺/,' m')+' · 火力 '+S.fire+' · 補給 '+sp.used+'/'+sp.cap;
}
function renderCtrl(){
  document.body.classList.toggle('pre',!S.started);document.body.classList.toggle('playing',!!(S.started&&!S.video&&!S.over));
  if(S.started)renderStatus();wxWinSync(); // 手機模式以 playing 類別為準，切換後重新搬移天候
  $('#setup').hidden=S.started;$('#ctrl').hidden=!S.started||S.video;$('#vbarCard').hidden=!(S.started&&S.video);$('#vcap').hidden=!(S.started&&S.video&&V.fr.length>0);
  if(!S.started)return;
  const h=humanTurn();
  $('#phaseTitle').textContent=S.over?'作戰結束':'第 '+S.turn+' 回合 · '+SIDE[S.phase]+'指揮';
  const bs=$('#btnStrike'),atkP=S.phase==='atk',pts=atkP?S.fire:(S.dfire||0),afM=S.mode==='afS'||S.mode==='afL'||S.mode==='afC'||(S.mode==='hlS'||S.mode==='hlL');bs.hidden=false;bs.disabled=!h||(pts<=0&&!afM);bs.classList.toggle('on',S.mode==='strike'||afM);
  bs.textContent=afM?'取消出擊':S.mode==='strike'?'取消打擊（剩 '+pts+'）':(atkP?'火力打擊（'+pts+' 點）':'縱深打擊（'+pts+' 波）');
  $('#btnEnd').disabled=!h;$('#btnEnd').hidden=S.sim;if(S.sim)bs.hidden=true;
  const ba=$('#btnAssist');ba.disabled=!h;ba.hidden=S.sim||S.video;
  {const ir=$('#btnIntentReset');if(ir)ir.hidden=!(h&&S.intentSkip&&S.intentSkip[S.phase]);}
  let hint;
  if(S.over)hint='作戰已結束，可在戰報中回顧過程。';
  else if(S.sim)hint=S.busy?'電腦推演中：'+SIDE[S.phase]+'正在行動…':'推演暫停，等待事件節點的決定。';
  else if(!h)hint=SIDE[S.phase]+'（電腦）正在行動…';
  else if((S.mode==='afS'||S.mode==='afL'||S.mode==='afC')&&S.afK){const n=afRings().length+(S.mode==='afC'?afCNT(S.afK).length:0);
    hint='✈ 空軍出擊中：'+(TER[S.afK].name||'基地')+'・'+AF_MODE_N[S.mode]+'——點紅圈'+(S.mode==='afC'?'或大陸基地':'')+'的目標（可攻擊 '+n+' 個）'+(S.afPend?'；已選定，看面板確認（點其他目標可切換，面板可拖曳）':'')+'。按下方「取消出擊」或點空地離開。';
    }
  else if((S.mode==='hlS'||S.mode==='hlL')&&heliB(S.hlB))hint='🚁 攻擊直升機出擊中：'+heliB(S.hlB).n+'・'+heliModeN(heliB(S.hlB),S.mode)+'——點紅圈的目標（可攻擊 '+heliRings().length+' 個，剩 '+heliBudget(heliB(S.hlB))+' 批）。按下方「取消出擊」或點空地離開。';
  else if(S.mode==='helo')hint='🚁 反潛直升機：點圓圈（150 km）內的海域搜索潛艦；找到會投擲魚雷攻擊。';
  else if(S.mode==='strike'&&S.phase==='def'&&S.cnPend)hint='🎯 縱深打擊：已選定目標，看面板確認發射；點其他目標可切換，面板可拖曳。';
  else if(S.mode==='strike')hint=S.phase==='atk'?'點選任一守方單位、台灣的機場，或地圖上的美日基地進行火力打擊，每次消耗 1 點。':'點選地圖上的大陸基地（紅色圖形），或直接點右側「中方基地」清單的一列，進行長程打擊，每次消耗 1 發長程飛彈。';
  else if(S.sel&&S.sel.type==='hmr'&&S.phase==='def'){const n=targets(S.sel).length;hint='海馬士只能打陸上目標：4 格內用火箭彈，14 格內用陸軍戰術飛彈（各有庫存）；每次最多 4 輛齊射，每階段次數依可射車數，發射後可再移動。'+(n?'橘圈＝目前射程內可打擊的 '+n+' 個目標，點選目標發射。':'目前射程內沒有陸上目標（海上船團要靠反艦飛彈）。');}
  else if(S.sel)hint='綠色＝可移動，橘色＝可登陸，紫色＝可空降；橘圈＝可攻擊目標。再點一次單位可取消選取。';
  else hint=S.phase==='atk'?'點選紅色單位下令。先把兩棲部隊從沿岸出航，下一回合搶灘。':'點選藍色單位下令。飛彈單位可射擊約 160 km 內海上的攻方船團。'+defLedger();
  $('#hint').textContent=hint;$('#fsHint').textContent=hint;
  poolTrack();{const lg=$('#ledger');if(lg){const on=S.started&&S.phase==='def'&&humanTurn()&&!S.sim;lg.hidden=!on;lg.innerHTML=on?defLedgerBars():'';}}
  const fs1=$('#fsStrike'),fs2=$('#fsEnd');fs1.hidden=bs.hidden;fs1.disabled=bs.disabled;fs1.textContent=bs.textContent;fs1.classList.toggle('on',bs.classList.contains('on'));fs2.hidden=$('#btnEnd').hidden;fs2.disabled=$('#btnEnd').disabled;if(S.video){fs1.hidden=true;fs2.hidden=true;}
  const fa=$('#fsAssist');fa.hidden=ba.hidden;fa.disabled=ba.disabled;
  $('#mbText').textContent=$('#phaseTitle').textContent;const m1=$('#mbStrike'),m2=$('#mbAssist'),m3=$('#mbEnd');
  m1.hidden=fs1.hidden;m1.disabled=fs1.disabled;m1.textContent=afM?'取消出擊':S.mode==='strike'?'取消打擊 '+pts:(atkP?'火力打擊 ':'縱深打擊 ')+pts;m1.classList.toggle('on',bs.classList.contains('on'));m2.hidden=ba.hidden;m2.disabled=ba.disabled;m3.hidden=$('#btnEnd').hidden;m3.disabled=$('#btnEnd').disabled;
  const sh=h&&S.sel&&S.sel.type==='hk'&&alive(S.sel);$('#btnHkHome').hidden=!(sh&&!S.sel.moved);$('#btnHkWpn').hidden=!sh;$('#btnHkWpn').textContent=TX('武器：')+TX({auto:'自動',tp:'只用魚雷',hm:'只用魚叉'}[hkPref()]);
  const ua=h&&undoAvail();$('#btnUndo').hidden=!ua;$('#mbUndo').hidden=!ua;
}
// 載運的旅「現在為什麼不能登陸」：本回合還能行動、卻沒有任何橘色（可登陸）格子時，說明規則與附近每個候選格的原因
// 這個旅（在船上）登陸這一格不行的原因；空字串＝可以。供資訊卡說明與地圖登陸提示標籤共用
function landWhyHex(u,n){
  const sh=shipOf(u),ro=!!sh&&sh.type==='ro';
  const floatWhy=n=>S.owner[n.k]!=='atk'?'還沒占領'+(ro?'（滾裝船不能搶灘）':''):enemyAdj(n.k,'atk')>0?'旁邊還有敵軍':n.isl!=='TW'?'只有台灣本島能架浮動碼頭':wxWave(n)>1.25?'浪太高（'+wxWave(n).toFixed(1)+' m）':'條件不符';
  if(n.k===TAIPEI)return '台北市區不能登陸';if(n.cliff)return '斷崖';if(n.mud)return '泥灘';if(n.t==='mtn')return '山地';
    if(u.type==='arm'){if(n.t==='port'){if(S.owner[n.k]!=='atk')return '港口還在守方手上';if(S.portDown[n.k])return '港口已被破壞';}else if(ro)return floatWhy(n);else return '重型旅只能進攻方控制的港口';}
    else if(ro&&n.t!=='port'&&!floatPier(n))return floatWhy(n);
    if(!canStack(u,n.k))return '格內有敵軍或已滿';
  return '';
}
function landWhy(u){
  if(!u||u.side!=='atk'||!u.ship||u.moved||u.acted||!alive(u)||typeof reach!=='function')return [];
  const rc=reach(u);for(const v of rc.values())if(v.kind==='land')return [];
  const sh=shipOf(u),ro=!!sh&&sh.type==='ro',here=hexOf(u),out=[];
  out.push(ro?'滾裝船不能搶灘：只能在攻方控制、未被破壞的港口，或已占領、旁邊沒有敵軍、浪高 1.25 m 以下的灘頭（浮動碼頭）卸載；格內有敵軍不能進。':'登陸艦可在沒有斷崖、泥灘、山地的海岸格搶灘；格內有敵軍不能進。');
  const seas=[here].concat([...rc].filter(([,v])=>v.kind==='sail').map(([k])=>TER[k])).filter(x=>x&&x.t==='sea'),cand=new Map();
  for(const s of seas)for(const n of nbrs(s.c,s.r)){if(n&&!cand.has(n.k)&&isLand(n)&&n.coastal&&n.isl!=='JP'&&n.isl!=='CN')cand.set(n.k,n);}
  if(!cand.size){
    let best=null,bd=1e9;for(const x of Object.values(TER)){if(!isLand(x)||!x.coastal||x.isl==='JP'||x.isl==='CN')continue;const d=rd(here,x);if(d<bd){bd=d;best=x;}}
    out.push('這回合開不到岸邊'+(best?'：最近的海岸（'+hname(best)+'）約 '+Math.round(bd*KM_HEX)+' km，而海上移動力只有 '+seaMove(u)+' 格（約 '+Math.round(seaMove(u)*KM_HEX)+' km）':'')+'。');return out;}
  const why=n=>landWhyHex(u,n);
  const ports=[],groups={};
  for(const n of cand.values()){const w=why(n);if(!w)continue;if(n.t==='port')ports.push(hname(n)+'：'+w);else(groups[w]=groups[w]||[]).push(n);}
  const lines=ports.slice(0,3);
  Object.entries(groups).sort((a,b)=>b[1].length-a[1].length).slice(0,3).forEach(([w,l])=>lines.push('海岸 '+l.length+' 格：'+w));
  out.push('現在沒有可登陸的格子。附近岸邊——'+(lines.join('；')||'沒有可用的海岸格')+'。');return out;
}
// 單位狀態說明：移動與載運：海上、運輸船、返航、航艦失能
function stMove(u,h,st){
  if(atSea(u))st.push('海上航行中');
  if(isBde(u)&&u.side==='atk'&&isLand(h)&&h.isl==='CN'&&!u.ship&&freeShipKind(u,h)===null)st.push('沒有可用的運輸船，要等船返航才能出海');
  else if(isBde(u)&&u.side==='atk'&&isLand(h)&&h.isl==='CN'&&!u.ship&&freeShipKind(u,h)==='ro'){const w=roRisk();if(w)st.push('這個旅出航會搭滾裝船（兩棲艦已用完）。'+w);}
  if(u.ship){const sh=shipOf(u);if(sh)st.push('乘坐'+TYPES[sh.type].n+(sh.type==='ro'?'（沒有登陸艇：不能搶灘、也不能從海上突擊，只能在港口或浮動碼頭卸載）':u.type==='arm'?'（重型旅不能搶灘，只能進攻方控制的港口卸載，也不能從海上突擊）':'（可搶灘，也能對緊鄰的岸上守軍做搶灘突擊）'));if(sh&&sh.type==='ro'&&!u.moved){const w=roRisk();if(w)st.push(w);}landWhy(u).forEach(x=>st.push(x));}
  if(u.boundTo){const b=S.units.find(x=>x.id===u.boundTo);st.push('載著'+(b?TYPES[b.type].n+'（'+(plainT()?'戰力 '+pctU(b)+'%':b.hp+' 步')+'）':'旅')+'：船沉了，船上的旅一起損失');if(u.type==='ro'){const w=roRisk();if(w)st.push(w);}if(b&&b.ship===u.id)landWhy(b).forEach(x=>st.push(x));} // 點到船時也顯示船上的旅為什麼不能登陸
  if((u.type==='lst'||u.type==='ro')&&u.ret)st.push('卸載完畢，正返航大陸港口');
  if(cvOOA(u))st.push('失去戰鬥能力（飛行甲板受損）：艦載機無法起降，撤離戰場中；攻擊方不會再優先打它');
}
// 單位狀態說明：飛彈發射車：被找到的車數、可射車數、存量、是否暴露
function stLauncher(u,h,st){
  if(isLch(u)&&u.veh!=null&&u.side==='def'&&S.phase==='atk'&&S.started&&!S.over){const n=lchFound(u,'bm');st.push(n>0?'攻方本階段偵察找到 '+n+' 輛，可打擊':'攻方本階段偵察沒有找到（或找到的都打過了），無法打擊');}
  if(isLch(u)&&u.veh!=null){const b=ssmBroken(u);st.push('發射車 '+u.veh+' 輛（可射 '+ssmReady(u)+(b?'、火力受損修復中 '+b:'')+'）');if(u.mT&&S.turn<u.mT)st.push('機動受損：維持暴露到下一個攻方階段結束');}
  if(u.type==='ssm')st.push(ssmHp(u)?'魚叉岸防系統（RGM-84L-4，射程約 120 km）；存量 '+fmt1(S.pools.rocHCD||0)+' 點（每點約 100 枚）':'雄二／雄三（射程約 160 km）；存量 '+fmt1(S.pools.rocAS||0)+' 點（每點約 100 枚）');
  if(u.type==='ssm'||u.type==='hmr'||u.type==='mlrs')st.push(u.revealed?'已暴露（上階段開火）':'隱蔽中：火力打擊多半打到誘餌');
}
// 單位狀態說明：艦艇：艦載機、艦隊組成、護航艦彈藥
function stNaval(u,h,st){
  if((u.type==='cv'||u.type==='csg')&&S.air){const c=cvwCarriers(u.side==='atk'?'atk':'def').find(x=>x.u===u);if(c){const sp=u.side==='atk'?cvwA(c.i):S.cvwA&&S.cvwA.def&&S.cvwA.def[c.ui];
    st.push('艦載機 '+Math.round(c.i<0?S.air.usF[c.ui]:S.air.cvF[c.i])+' 架（每回合約 '+Math.round(c.sor)+' 架次，作戰半徑約 '+kmOf(c.w.r)+' km）、'+c.nm+' '+Math.max(0,u.wmag||0)+
        ' 枚（射程 '+kmOf(c.w.asmR)+' km，對艦打擊距離 '+kmOf(c.w.r+c.w.asmR)+' km）'+(sp?'；本回合任務：制空 '+Math.round(sp[0]*100)+'%、對艦 '+Math.round(sp[1]*100)+'%、對地 '+Math.round(sp[2]*100)+'%':''));
      }}
  if(u.fl){const A=fleetAgg(u);st.push('組成：'+fleetTxt(u)+'；防空涵蓋 '+kmOf(A.adR)+' km、反艦飛彈（'+fleetWn(u)+'）射程 '+kmOf(A.asmR)+' km，每艘每次齊射 '+FLEET_PER+' 枚');}
  if(isEsc(u)&&u.mag){const W=SHIPW[u.type];st.push('防空涵蓋 '+kmOf(W.adR)+' km、'+W.asmN+'射程 '+kmOf(W.asmR)+' km；海上不能補充垂直發射管；跟著航艦移動');}
}
// 單位狀態說明：武器單位：火箭砲、海馬士、美日飛彈、潛艦的彈藥與射擊次數
function stWeapons(u,h,st){
  if(u.type==='mlrs')st.push('雷霆2000：射程最遠約 40 km，面積火力、命中比海馬士低；彈藥庫存剩 '+(S.pools?S.pools.rocRkt:0)+' 點；開火後下一階段要再裝填'+(u.rl>0?'（再裝填中，本階段不能開火）':'')+'，本階段剩 '+(u.side===S.phase?u.shots:1)+' 發');
  if(u.type==='hmr')st.push('本階段剩 '+(u.side===S.phase?u.shots:Math.ceil(ssmReady(u)/HMR_PKG))+' 次齊射（每次最多 4 輛）：火箭彈射程約 80 km，庫存 '+Math.round(S.pools?S.pools.rocGml||0:0)+' 個莢艙；陸軍戰術飛彈射程約 300 km，庫存 '+Math.round(S.pools?S.pools.rocAtc||0:0)+' 枚飛彈');
  else if(u.type==='ssn')st.push('隱蔽：開火暴露、被護航艦發現才現身，無法被火力打擊；彈藥配置為推估，每回合移動最多約 '+Math.round(SPD.subMax*KM_HEX)+' km'+(u.grp?'，跟著航艦行動':''));
  else if(u.type==='nme'||u.type==='mdt')st.push('部署在日本領土，只能被基地打擊；'+(u.type==='nme'?'海軍打擊飛彈射程 '+kmOf(NME.R)+' km':'戰斧、標準六型射程 '+kmOf(MDT.R)+' km')+'（彈藥量為推估）');
  else if(u.type==='sam')st.push(samStatus(u));
  else if(u.type==='psub')st.push((psubInPort(u)?'停在大陸港口補彈中：可被飛彈與空襲打擊。':'在海上：平常看不見，開火才暴露；守方護航艦、艦隊與 P-3C 反潛巡邏機有機會發現。')+'魚雷射程約 60 km、鷹擊-18 約 220 km；彈藥用完回大陸港口補彈（★推估）');
  else if(u.type==='hk')st.push((subInPort(u)?'停在母港補給中：位置固定，可被飛彈與空襲打擊。':'在海上：一般情況下無法被偵測或攻擊。')+'重型魚雷射程約 60 km（數量以齊射計）、魚叉飛彈射程約 120 km；射擊後暴露，可能遭反潛攻擊；回母港才能補彈');
  else if(isMsl(u))st.push('本階段剩 '+(u.side===S.phase?u.shots:(u.type==='ff'?1:u.type==='ssm'?(ssmReady(u)>0?Math.max(1,Math.round(2*ssmReady(u)/lchV0(u))):0):2))+' 發，射程約 '+Math.round((u.fl?fleetAgg(u).asmR:kmH(160))*KM_HEX)+' km');
}
function unitStatusList(u,h){ // 單位狀態說明（資訊卡與滑鼠提示共用）
  const st=[];
  stMove(u,h,st);
  stLauncher(u,h,st);
  stNaval(u,h,st);
  stWeapons(u,h,st);
  if(isAirT(u)&&!u.dropped&&h.isl==='CN')st.push(u.type==='aas'?'待命機降（直升機，約 '+AIR_R.aas+' km 內）':'待命空降');
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
  const r=w.getBoundingClientRect(),bar=document.querySelector('.mbar'),br=bar&&getComputedStyle(bar).display!=='none'?bar.getBoundingClientRect():null,side=br&&br.width<innerWidth*.6,lim=br&&!side?br.top:innerHeight; // 手機橫向時操作列在右側（side），不限制高度、改限制右緣 // fixed 元素的 offsetParent 是 null，不能用來判斷是否顯示
  const bottom=Math.min(r.bottom,lim,innerHeight),vis=!document.body.classList.contains('fin-open')&&r.height>0&&bottom-Math.max(r.top,0)>110&&S.started;
  const lg=$('#rngLeg');if(lg){const on=vis&&lg.childElementCount>0;lg.style.display=on?'block':'none';if(on){lg.style.left=(Math.max(r.left,0)+8)+'px';const mb=document.querySelector('.mapbar'),mbB=mb?[...mb.children].reduce((a,c)=>{const q=c.getBoundingClientRect();return q.width&&q.height?Math.max(a,q.bottom):a;},0):0; // 手機：工具列浮在地圖上方，圖例要排在工具列下面，不然會蓋住按鈕
      lg.style.top=(Math.max(r.top,0)+8>=mbB||mbB<=r.top?Math.max(r.top,0)+8:mbB+6)+'px';lg.style.maxWidth=Math.max(160,Math.min(r.right,innerWidth)-Math.max(r.left,0)-70)+'px';}}
  b.style.display=vis?'flex':'none';if(!vis)return;
  const left=Math.min(r.right,side?br.left:innerWidth,innerWidth)-12-44,co=document.getElementById('coach');
  let bt=bottom;
  if(co&&!co.hidden&&getComputedStyle(co).display!=='none'){ // 新手引導訊息和按鈕重疊時，按鈕移到訊息上方
    const cr=co.getBoundingClientRect();
    if(cr.right>left-8&&cr.left<left+52&&cr.top<bottom&&cr.bottom>bottom-68)bt=cr.top;
  }
  b.style.left=left+'px';b.style.top=(bt-12-44)+'px';
}
let locQ=0;const locReq=()=>{if(locQ)return;locQ=requestAnimationFrame(()=>{locQ=0;placeLoc();});};
addEventListener('scroll',locReq,true);addEventListener('resize',locReq);
function renderInfo(){renderInfoSide();syncUCard();locReq();}
