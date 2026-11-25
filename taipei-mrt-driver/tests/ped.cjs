const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const p=await b.newPage({viewport:{width:800,height:480}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/taipei-mrt-driver/index.html');await p.waitForTimeout(900);
  const cases=[['blue',0,8,'永寧','島式（地下）'],['blue',9,13,'龍山寺','島式（地下，另一站）'],['green',10,14,'北門','側式（地下）'],['brown',0,8,'木柵','側式（高架）'],['red',27,20,'淡水','島式（高架）'],['red',27,20,'竹圍','側式（平面）']];
  for(const [line,f,t,st,label] of cases){
    const r=await p.evaluate(([line,f,t,st])=>{
      const m=__mrt;Object.assign(m.SET,{line,from:f,to:t,theme:'day',events:false,bcOn:false,haptic:false});m.startRun();const g=m.G;g.state='run';
      const k=g.stations.findIndex(s=>s.name===st);g.pos=g.S[k]-90;g.v=0;g.k=k;g.doors.state='closed';
      m.render();
      const viol={pillar:0,queue:0,samples:0};let minQ=9;
      const sample=()=>{
        const d=R3.debugPeople(k);if(!d)return;
        const pil=d.pillar;
        for(const q of d.people){
          if(!q.v||!isFinite(q.x))continue;viol.samples++;
          for(const zp of pil.zs){if(Math.abs(q.x-pil.x)<pil.half+0.2&&Math.abs(q.z-zp)<pil.half+0.2){viol.pillar++;break;}}
        }
        // 走動／下車的人，與「還沒開始上車、站著排隊」的人：水平距離太近就是穿過去
        const queued=d.people.filter(q=>q.k==='queue'&&q.v&&(d.te<0||d.te<q.delay));
        for(const q of d.people){if(!q.v||q.k==='queue'||!isFinite(q.x))continue;
          for(const w of queued){const dd=Math.hypot(q.x-w.x,q.z-w.z);if(dd<minQ)minQ=dd;if(dd<0.3)viol.queue++;}}
      };
      // 開門前 12 秒（走動的人與排隊的人），再開門後 25 秒（下車、上車、走開）
      for(let i=0;i<48;i++){for(let j=0;j<15;j++)m.step(1/60);m.render();sample();}
      g.pos=g.S[k]-0.3;g.v=0;g.stopSt=k;g.doors.state='opening';g.doors.side=g.stations[k].side;g.doors.t=0;g.doors.openT=0;
      for(let i=0;i<100;i++){for(let j=0;j<15;j++)m.step(1/60);m.render();sample();}
      return {viol,minQ:+minQ.toFixed(2),plat:g.stations[k].plat};
    },[line,f,t,st]);
    ok(`${label}「${st}」：行人不穿過柱子、不穿過排隊的人（取樣 ${r.viol.samples} 次）`,r.viol.pillar===0&&r.viol.queue===0,`柱子違規 ${r.viol.pillar}、穿過排隊 ${r.viol.queue}、最近距離 ${r.minQ} m`);
  }
  // 行人站好不走動：開門前後、過了很久，每個人的位置都一樣；下車旅客不出現；腿與手臂不擺動
  const st=await p.evaluate(()=>{
    const m=__mrt;Object.assign(m.SET,{line:'blue',from:0,to:8,theme:'day',events:false,bcOn:false,haptic:false});m.startRun();const g=m.G;g.state='run';
    const k=1;g.pos=g.S[k]-90;g.v=0;g.k=k;m.render();
    const snap=()=>JSON.stringify(R3.debugPeople(k).people.map(q=>[q.k,q.v,Math.round(q.x*1000),Math.round(q.z*1000)]));
    const a=snap();
    g.pos=g.S[k]-0.3;g.stopSt=k;g.doors.state='opening';g.doors.side=g.stations[k].side;g.doors.t=0;g.doors.openT=0;
    for(let i=0;i<100;i++){for(let j=0;j<15;j++)m.step(1/60);m.render();}
    const b2=snap();const d=R3.debugPeople(k);
    return {same:a===b2,n:d.people.length,alightVisible:d.people.filter(q=>q.k==='alight'&&q.v).length,walkVisible:d.people.filter(q=>q.k==='walk'&&q.v).length,walkAnim:R3.walkAnim()};
  });
  ok('行人站好不走動：開門前後位置完全相同、下車旅客不出現、有人站在月台上',st.same&&st.alightVisible===0&&st.walkVisible>0&&st.walkAnim===false,JSON.stringify(st));
  console.log('errors',errs);await b.close();
})();
