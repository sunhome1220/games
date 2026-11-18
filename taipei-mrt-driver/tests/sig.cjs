const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const p=await b.newPage({viewport:{width:700,height:420}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(900);
  const out=await p.evaluate(()=>{
    const res=[];
    for(let rep=0;rep<14;rep++){
      const m=__mrt;Object.assign(m.SET,{line:'red',from:27,to:21,theme:'day',events:true,evRate:'high',evOff:['quake','wind','trespass','doorfault','power','trainfault'],model:'C301',bcOn:false,haptic:false});m.startRun();
      const g=m.G;g.nextEv=20+rep*3;let stuckDump=null,lastPos=-1,still=0;
      for(let i=0;i<60*60*30;i++){
        m.step(1/60);
        if(i%6===0){const D=g.doors;
          if(g.state==='result'||(g.state==='finish'&&g.endT<=0))break;
          if(g.state==='finish'||g.k>=g.S.length)continue;
          const d=g.S[g.k]-g.pos,v=g.v,kmh=v*3.6;
          if(v<0.05&&D.state==='closed'){const j=g.S.findIndex(s=>{const e=s-g.pos;return e<=10&&e>=-30;});if(j===g.k){m.setNotch(0);m.openDoors(g.stations[j].side);continue;}}
          if(D.state==='open'&&D.openT>=6.5&&g.time>=g.tDep[g.cur]-1){m.closeDoors();continue;}
          if(D.state!=='closed')continue;
          if(g.trip){m.setNotch(0);continue;}
          if(v<0.05&&d>20){if(g.time>=g.tDep[g.cur])m.setNotch(3);continue;}
          const a=v*v/(2*Math.max(d,0.01));if(d<=0.02){m.setNotch(-3);continue;}
          if(v>0.3&&(a>0.8||g.notch<0&&a>0.15)){const need=g.dec.findIndex(x=>x>=a*1.03);let nn=need<0?7:need+1;if(v<2.5)nn=Math.min(nn,2);if(v<1.2)nn=1;m.setNotch(-nn);}
          else if(kmh>g.lim-6)m.setNotch(-5);else if(kmh<Math.min(g.lim-8,g.M.vmax-4)&&d>300)m.setNotch(4);else if(v>0.3)m.setNotch(0);else m.setNotch(2);
        }
        if(i%600===0){ if(Math.abs(g.pos-lastPos)<1&&g.state==='run'&&!g.evHold)still++;else still=0;lastPos=g.pos;
          if(still>=7){stuckDump={t:+g.time.toFixed(0),pos:+g.pos.toFixed(1),v:+g.v.toFixed(2),notch:g.notch,trip:g.trip,lim:+g.lim.toFixed(1),k:g.k,cur:g.cur,d:+(g.S[g.k]-g.pos).toFixed(1),
            ev:g.ev&&{id:g.ev.id,cleared:g.ev.cleared,wait:+(g.ev.wait||0).toFixed(1),need:+(g.ev.need||0).toFixed(1),hold:g.ev.hold&&+g.ev.hold.toFixed(1),title:g.ev.title},hold:g.hold,hz:g.hz,evLim:g.evLim,evRamp:g.evRamp,door:g.doors.state,interlock:g.interlock,tDep:+g.tDep[g.cur].toFixed(0)};break;}}
      }
      res.push(stuckDump?{rep,stuck:stuckDump}:{rep,ok:true,state:g.state,log:g.evLog.map(e=>e.id+':'+e.outcome)});
    }
    return res;});
  for(const r of out)console.log(JSON.stringify(r));console.log('errors',errs);await b.close();
})();
