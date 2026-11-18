const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const p=await b.newPage({viewport:{width:900,height:520}});const errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(900);
  const cases=[['red',27,16,'C301'],['red',16,27,'C381'],['blue',0,10,'321'],['blue',22,12,'341'],['green',18,8,'C371'],['green',0,10,'C381'],['brown',0,10,'VAL256'],['brown',23,13,'INNOVIA'],['red',27,21,'C301'],['brown',9,16,'VAL256']];
  let allOk=true;
  for(let rep=0;rep<2;rep++)for(const [line,f,t,model] of cases){
    const r=await p.evaluate(([line,f,t,model])=>{
      const m=__mrt;Object.assign(m.SET,{line,from:f,to:t,theme:'day',events:true,evRate:'high',evOff:[],model});m.startRun();
      let stuck=0,lastPos=-1,lastT=0;
      for(let i=0;i<60*60*60;i++){
        m.step(1/60);
        if(i%6===0){const g=m.G,D=g.doors;
          if(g.state==='result')break;
          if(g.doorFault&&!g.doorFault.call){m.evCallControl();}
          if(g.state==='finish'||g.k>=g.S.length)continue;
          const d=g.S[g.k]-g.pos,v=g.v,kmh=v*3.6;
          if(v<0.05&&D.state==='closed'&&!g.doorFault){const j=g.S.findIndex(s=>{const e=s-g.pos;return e<=10&&e>=-30;});if(j===g.k){m.setNotch(0);m.openDoors(g.stations[j].side);continue;}}
          if(D.state==='open'&&D.openT>=6.5&&g.time>=g.tDep[g.cur]-1){m.closeDoors();continue;}
          if(D.state!=='closed')continue;
          if(g.trip){m.setNotch(0);continue;}
          if(g.ev&&g.ev.id==='trespass'&&g.v>0.5){m.setNotch(-8);continue;}
          if(v<0.05&&d>20){if(g.time>=g.tDep[g.cur])m.setNotch(3);continue;}
          const a=v*v/(2*Math.max(d,0.01));if(d<=0.02){m.setNotch(-3);continue;}
          if(v>0.3&&(a>0.8||g.notch<0&&a>0.15)){const need=g.dec.findIndex(x=>x>=a*1.03);let nn=need<0?7:need+1;if(v<2.5)nn=Math.min(nn,2);if(v<1.2)nn=1;m.setNotch(-nn);}
          else if(kmh>g.lim-6)m.setNotch(-5);else if(kmh<Math.min(g.lim-8,g.M.vmax-4)&&d>300)m.setNotch(4);else if(v>0.3)m.setNotch(0);else m.setNotch(2);
        }
        if(m.G.state==='finish'&&m.G.endT<=0)break;
        if(i%600===0){ if(Math.abs(m.G.pos-lastPos)<1&&m.G.state==='run'&&!m.G.evHold)stuck++;else stuck=0;lastPos=m.G.pos; if(stuck>12)return {stuck:true,t:m.G.time,ev:m.G.ev&&m.G.ev.id,df:!!m.G.doorFault,k:m.G.k};}
      }
      const g=m.G;
      return {stuck:false,state:g.state,time:Math.round(g.time),events:g.evLog.map(e=>e.id+':'+e.outcome+':'+e.pts),pen:g.pen,evPts:g.evPts,ev:g.ev&&g.ev.id};
    },[line,f,t,model]);
    const ok=!r.stuck&&(r.state==='finish'||r.state==='result');allOk=allOk&&ok;
    console.log((ok?'ok  ':'FAIL')+' '+(line+' '+f+'→'+t+' '+model).padEnd(22),JSON.stringify(r.stuck?r:{state:r.state,t:r.time,events:r.events.join(' '),open:r.ev||null}));
  }
  console.log(allOk?'ALL COMPLETED':'SOME STUCK','errors',errs);await b.close();
})();
