'use strict';
// 北捷駕駛模擬的 3D 場景（Three.js，動態載入；載入失敗時主程式會退回 2D 偽 3D）。
// 世界座標：x 向右、y 向上，列車前進方向為 -z（軌道里程 s 對應 z = -s）。軌道頂面 y = 0。
// 只畫「世界」；儀表、HUD 仍由主程式的 2D canvas 疊在上面。
// 改動用到的 Three.js 類別後，執行 bash taipei-mrt-driver/tools/build_three.sh 重新打包。
const R3=(function(){
  let T=null,renderer=null,scene=null,camera=null,hemi=null,sun=null,head=null,ground=null,unitBox=null;
  let run=null,cw=1,ch=1;
  const CH=100;                 // 區塊長度（公尺）
  const chunks=new Map();
  const mats=new Map(),texs=new Map();
  let tun=0;                    // 0＝高架／戶外，1＝隧道（光線與霧漸變）
  let th=null;
  const PCOL=[0xd9534f,0x5bc0de,0xf0ad4e,0x5cb85c,0x9b59b6,0xecf0f1,0x34495e,0xe67e22];
  const TH={
    day:{sky0:'#5aa9e6',sky1:'#cfe8ff',gnd:0x7e8a78,bld:0xaeb8c4,fog:0xcfe8ff,hemi:[0xdcecff,0x8a8f86,2.1],sun:2.2,lit:0},
    dusk:{sky0:'#35508c',sky1:'#f2a65a',gnd:0x54505c,bld:0x7a728c,fog:0xc88c64,hemi:[0xffc79a,0x4a4658,1.5],sun:1.4,lit:0.35},
    night:{sky0:'#060b1a',sky1:'#1d2a4a',gnd:0x161a26,bld:0x2a3248,fog:0x1d2a4a,hemi:[0x6f86b8,0x10131c,0.8],sun:0,lit:0.7}
  };
  function hash(n){n=Math.imul((n^61)^(n>>>16),9);n^=n>>>4;n=Math.imul(n,0x27d4eb2d);n^=n>>>15;return (n>>>0)/4294967296;}
  function hstr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

  /* ---------- 材質與貼圖 ---------- */
  function mat(color,opt){
    opt=opt||{};
    const key=color+'|'+(opt.basic?'b':'l')+'|'+(opt.op||1)+'|'+(opt.em||0)+'|'+(opt.map?opt.map.uuid:'')+'|'+(opt.side||0);
    let m=mats.get(key);if(m)return m;
    const p={color,transparent:(opt.op||1)<1,opacity:opt.op||1,fog:true};
    if(opt.map)p.map=opt.map;
    if(opt.side)p.side=T.DoubleSide;
    if(opt.basic)m=new T.MeshBasicMaterial(p);
    else{if(opt.em){p.emissive=color;p.emissiveIntensity=opt.em;}m=new T.MeshLambertMaterial(p);}
    if(opt.depthWrite===false)m.depthWrite=false;
    mats.set(key,m);return m;
  }
  function canvasTex(w,h,draw,key,repeat){
    let t=texs.get(key);if(t)return t;
    const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
    t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;
    if(repeat){t.wrapS=t.wrapT=T.RepeatWrapping;}
    texs.set(key,t);return t;
  }
  function facadeTex(){
    return canvasTex(128,128,(g,w,h)=>{
      g.fillStyle='#ffffff';g.fillRect(0,0,w,h);
      for(let r=0;r<8;r++)for(let q=0;q<8;q++){
        const lit=hash(r*13+q*7+hstr(run.opt.theme||'x'))<th.lit;
        g.fillStyle=lit?'#ffe3a0':(th.lit>0?'#2a3350':'#8aa6bd');
        g.fillRect(q*16+3,r*16+4,10,8);
      }
    },'facade-'+run.theme,true);
  }
  function concreteTex(){
    return canvasTex(64,64,(g,w,h)=>{
      g.fillStyle='#fff';g.fillRect(0,0,w,h);g.fillStyle='rgba(0,0,0,.28)';g.fillRect(0,0,3,h);
      for(let i=0;i<60;i++){g.fillStyle='rgba(0,0,0,'+(Math.random()*0.06)+')';g.fillRect(Math.random()*w,Math.random()*h,6,6);}
    },'concrete',true);
  }
  function labelTex(text,color,key,w,h){
    return canvasTex(w||512,h||128,(g,W,H)=>{
      g.fillStyle='#f8f8fa';g.fillRect(0,0,W,H);g.fillStyle=color;g.fillRect(0,0,W,H*0.22);
      g.fillStyle='#1b2230';g.textAlign='center';g.textBaseline='middle';
      let fs=H*0.5;g.font='800 '+fs+'px "Microsoft JhengHei","PingFang TC","Noto Sans TC","WenQuanYi Zen Hei",sans-serif';
      while(g.measureText(text).width>W*0.9&&fs>12){fs-=2;g.font='800 '+fs+'px "Microsoft JhengHei","PingFang TC","Noto Sans TC","WenQuanYi Zen Hei",sans-serif';}
      g.fillText(text,W/2,H*0.6);
    },key);
  }
  function signTex(txt,kind){
    return canvasTex(128,128,(g)=>{
      g.fillStyle='#fff';g.beginPath();g.arc(64,64,62,0,6.3);g.fill();
      g.strokeStyle='#d32f2f';g.lineWidth=12;g.beginPath();g.arc(64,64,54,0,6.3);g.stroke();
      g.fillStyle='#111';g.textAlign='center';g.textBaseline='middle';g.font='800 64px sans-serif';g.fillText(txt,64,68);
    },'sign-'+txt);
  }
  function stopTex(){
    return canvasTex(128,128,(g)=>{
      g.fillStyle='#f5c828';g.fillRect(0,0,128,128);g.fillStyle='#1b1b1b';g.textAlign='center';g.textBaseline='middle';
      g.font='900 96px "Microsoft JhengHei","PingFang TC","Noto Sans TC","WenQuanYi Zen Hei",sans-serif';g.fillText('停',64,70);
    },'stop');
  }
  function bgTex(){
    return canvasTex(2,256,(g,w,h)=>{
      const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,th.sky0);gr.addColorStop(0.5,th.sky1);gr.addColorStop(1,th.sky1);
      g.fillStyle=gr;g.fillRect(0,0,w,h);
    },'bg-'+run.theme);
  }

  /* ---------- 幾何小工具 ---------- */
  function box(parent,w,h,l,x,y,s,m){const o=new T.Mesh(unitBox,m);o.scale.set(w,h,l);o.position.set(x,y,-s);parent.add(o);return o;}
  function plane(parent,w,h,x,y,s,m){const o=new T.Mesh(planeGeo,m);o.scale.set(w,h,1);o.position.set(x,y,-s);parent.add(o);return o;}
  let planeGeo=null;
  function sectorEnv(s){const S=run.sec;for(let i=0;i<S.length;i++)if(s>=S[i].a&&s<S[i].b)return S[i].env;return S[S.length-1].env;}
  function platRange(st){return [st.pos-run.L.trainLen-14,st.pos+22];}
  function stationAt(s0,s1){for(const st of run.stations){const r=platRange(st);if(s1>r[0]&&s0<r[1])return st;}return null;}

  /* ---------- 區塊（軌道、隧道、高架、建築） ---------- */
  function track(g,sa,sb){
    const len=sb-sa,mid=(sa+sb)/2;
    box(g,4.8,0.3,len,0,-0.15,mid,mat(0x5c5852));
    const rm=mat(0xb0b6be);
    box(g,0.07,0.17,len,-0.7175,0.085,mid,rm);box(g,0.07,0.17,len,0.7175,0.085,mid,rm);
    box(g,0.1,0.1,len,1.5,0.1,mid,mat(0x3c3e46));
    const sp=0.65,n=Math.floor(len/sp);
    const im=new T.InstancedMesh(unitBox,mat(0x3c322c),n);
    const M=new T.Matrix4();
    for(let i=0;i<n;i++){M.compose(new T.Vector3(0,0.06,-(sa+(i+0.5)*sp)),new T.Quaternion(),new T.Vector3(2.5,0.12,0.22));im.setMatrixAt(i,M);}
    im.instanceMatrix.needsUpdate=true;im.frustumCulled=false;g.add(im);g.userData.inst=(g.userData.inst||[]);g.userData.inst.push(im);
  }
  function elevPiece(g,sa,sb){
    const len=sb-sa,mid=(sa+sb)/2;
    box(g,6.4,0.5,len,0,-0.5,mid,mat(0x78797e));
    const pm=mat(0x96989c);
    box(g,0.3,1.2,len,-3.05,0.35,mid,pm);box(g,0.3,1.2,len,3.05,0.35,mid,pm);
    for(let s=Math.ceil(sa/36)*36;s<sb;s+=36){
      for(const sd of [-1,1]){
        box(g,0.12,5.3,0.12,sd*3.3,3.6,s,mat(0x464850));
        box(g,0.9,0.14,0.35,sd*2.9,6.3,s,mat(0xfff4d0,{basic:1}));
      }
    }
    // 建築
    const CELL=22,seed=hstr(run.L.short),ft=facadeTex();
    for(let c=Math.floor(sa/CELL);c<=Math.ceil(sb/CELL);c++){
      const zf=c*CELL;if(zf<sa||zf>=sb)continue;
      for(let side=-1;side<=1;side+=2){
        const h0=hash(c*2+(side>0?1:0)+seed);if(h0<0.32)continue;
        const wid=10+hash(c*5+seed+side)*26,dep=14+hash(c*7+seed+side*3)*30,off=11+hash(c*3+seed+side*9)*42;
        const hgt=14+Math.pow(hash(c*11+seed+side*5),1.6)*80;
        const tone=0.85+hash(c*13+seed)*0.3;
        const col=new T.Color(th.bld).multiplyScalar(tone);
        const key='f'+Math.round(wid/4)+'x'+Math.round(hgt/4)+run.theme;
        let tx=texs.get(key);
        if(!tx){tx=ft.clone();tx.needsUpdate=true;tx.repeat.set(Math.max(1,Math.round(wid/4))/2,Math.max(1,Math.round(hgt/4))/2);texs.set(key,tx);}
        const m=new T.MeshLambertMaterial({color:col,map:tx,emissive:th.lit>0?new T.Color(0x332a14):new T.Color(0),emissiveMap:th.lit>0?tx:null,emissiveIntensity:th.lit>0?1.1:0});
        // 同一塊區塊內的材質於區塊移除時一併釋放
        g.userData.mats=(g.userData.mats||[]);g.userData.mats.push(m);
        const o=new T.Mesh(unitBox,m);o.scale.set(wid,hgt,dep);o.position.set(side*(off+wid/2),-12+hgt/2,-(zf+dep/2));g.add(o);
      }
    }
  }
  function tunnelPiece(g,sa,sb){
    const ct=concreteTex();
    const pieces=[sa];
    for(const st of run.stations){for(const e of platRange(st)){if(e>sa+0.01&&e<sb-0.01)pieces.push(e);}}
    pieces.push(sb);pieces.sort((a,b)=>a-b);
    for(let i=0;i<pieces.length-1;i++){
      const a=pieces[i],b=pieces[i+1],len=b-a,mid=(a+b)/2;
      const st=stationAt(a+0.01,b-0.01);
      const wh=st?4.8:4.2;
      const key='c'+Math.round(len/6*2);
      let tx=texs.get(key);if(!tx){tx=ct.clone();tx.needsUpdate=true;tx.repeat.set(Math.max(1,len/6),1);texs.set(key,tx);}
      const wm=mat(0x9a9ea8,{map:tx});
      for(const sd of [-1,1]){
        if(st&&((st.side==='R')?1:-1)===sd)continue;
        box(g,0.3,wh,len,sd*2.55,wh/2,mid,wm);
      }
      if(!st){
        box(g,5.4,0.3,len,0,4.35,mid,mat(0x6a6e78));
        for(let s=Math.ceil(a/18)*18;s<b;s+=18){for(const sd of [-1,1])box(g,0.1,0.2,1.4,sd*2.38,3.45,s,mat(0xfff0c8,{basic:1}));}
        box(g,0.12,0.14,len,-2.38,2.25,mid,mat(0x2a2c32));box(g,0.12,0.14,len,2.38,2.25,mid,mat(0x2a2c32));
      }
    }
  }
  function buildChunk(ci){
    const g=new T.Group();g.userData.ci=ci;
    const s0=ci*CH,s1=s0+CH;
    const cuts=[s0];
    for(const sc of run.sec){if(sc.a>s0+0.01&&sc.a<s1-0.01)cuts.push(sc.a);}
    cuts.push(s1);
    for(let i=0;i<cuts.length-1;i++){
      const a=cuts[i],b=cuts[i+1],env=sectorEnv((a+b)/2);
      track(g,a,b);
      if(env==='elev')elevPiece(g,a,b);else tunnelPiece(g,a,b);
    }
    return g;
  }
  function freeChunk(g){
    scene.remove(g);
    (g.userData.inst||[]).forEach(m=>m.dispose());
    (g.userData.mats||[]).forEach(m=>m.dispose());
  }

  /* ---------- 車站 ---------- */
  function buildStation(st){
    const g=new T.Group(),L=run.L,sd=st.side==='R'?1:-1;
    const [pa,pb]=platRange(st),len=pb-pa,mid=(pa+pb)/2;
    const tun2=st.env==='tunnel';
    // 月台
    box(g,8.05,1.1,len,sd*5.475,0.55,mid,mat(0xc0c2c8));
    box(g,0.45,0.03,len,sd*1.7,1.11,mid,mat(0xf5c828,{basic:1}));
    box(g,0.06,1.1,len,sd*1.45,0.55,mid,mat(0x70727a));
    if(!tun2)box(g,8.05,2,len,sd*5.475,-1.2,mid,mat(0x6c6e74));
    // 頂棚／後牆
    if(tun2){
      box(g,11.9,0.3,len,sd*3.55,4.95,mid,mat(0xc8ccd0));
      box(g,0.3,4.8,len,sd*9.65,2.4,mid,mat(0xb4bac2));
      for(let s=Math.ceil(pa/12)*12;s<pb;s+=12)box(g,0.05,0.9,5,sd*9.45,3.7,s,mat(new T.Color(L.color).getHex(),{basic:1}));
      // 末端封口
      box(g,7.1,4.8,0.3,sd*5.95,2.4,pb,mat(0x282b32));
      box(g,4.8,0.7,0.3,0,4.55,pb,mat(0x282b32));
    }else{
      box(g,8.3,0.3,len,sd*5.35,4.95,mid,mat(0xd0d3d8));
      box(g,0.1,1.2,len,sd*9.5,1.7,mid,mat(0xb0b8c4,{op:0.5}));
    }
    for(let s=Math.ceil(pa/18)*18;s<pb;s+=18)box(g,0.5,3.7,0.5,sd*3.2,2.95,s,mat(0xbcc0c6));
    // 站名牌
    const nameM=mat(0xffffff,{basic:1,map:labelTex(st.name,L.color,'name-'+L.short+st.name)});
    for(const off of [-100,-46,14])plane(g,4,1.0,sd*5,4.0,st.pos+off,nameM);
    // 停車標與停車線
    box(g,0.3,1.4,0.5,sd*1.8,1.8,st.pos,mat(0x222428));
    plane(g,0.9,0.9,sd*1.8,2.1,st.pos+0.3,mat(0xffffff,{basic:1,map:stopTex()}));
    const ln=new T.Mesh(planeGeo,mat(0x50ff78,{basic:1,op:0.9}));ln.rotation.x=-Math.PI/2;ln.scale.set(3.4,0.5,1);ln.position.set(0,0.19,-st.pos);g.add(ln);
    // 月台門與乘客
    const sp=L.cars===6?5.6:5.2,nd=L.cars*4;
    const glass=mat(0x96cde1,{basic:1,op:0.2,depthWrite:false}),frame=mat(0xd2d6dc);
    const doors=[];
    const persons=[];
    for(let j=0;j<nd;j++){
      const sj=st.pos-4-j*sp;
      box(g,0.05,2.2,sp-2.5,sd*1.6,2.2,sj-sp/2,glass);
      box(g,0.07,2.2,0.08,sd*1.6,2.2,sj-1.25,frame);box(g,0.07,2.2,0.08,sd*1.6,2.2,sj+1.25,frame);
      const a=box(g,0.05,2.2,1.2,sd*1.6,2.2,sj-0.6,glass),b=box(g,0.05,2.2,1.2,sd*1.6,2.2,sj+0.6,glass);
      doors.push({a,b,sj});
      const cnt=Math.floor(hash(st.idx*131+j*7+hstr(L.short))*5);
      for(let p=0;p<cnt;p++){
        persons.push({x:sd*(2.4+(p%2)*0.6+hash(j*3+p)*0.4),s:sj+(p-1.5)*0.7,c:PCOL[Math.floor(hash(st.idx*17+j*5+p)*PCOL.length)],i:persons.length});
      }
    }
    const nP=persons.length;
    const bodies=new T.InstancedMesh(unitBox,mat(0xffffff),Math.max(1,nP)),heads=new T.InstancedMesh(unitBox,mat(0xe8c9a6),Math.max(1,nP));
    bodies.frustumCulled=false;heads.frustumCulled=false;
    persons.forEach((p,i)=>bodies.setColorAt(i,new T.Color(p.c)));
    g.add(bodies);g.add(heads);
    g.userData={doors,persons,bodies,heads,vis:-1,open:-1};
    setPersons(g,1);
    return g;
  }
  // 乘客依 frac（1＝全在月台，0＝全部上車）逐漸消失
  function setPersons(g,frac){
    const u=g.userData,M=new T.Matrix4(),q=new T.Quaternion(),total=Math.max(1,u.persons.length);
    u.persons.forEach(p=>{
      const k=(p.i+0.5)/total<=frac?1:0;
      M.compose(new T.Vector3(p.x,1.1+0.725,-p.s),q,new T.Vector3(0.45*k+0.001,1.45*k+0.001,0.3*k+0.001));u.bodies.setMatrixAt(p.i,M);
      M.compose(new T.Vector3(p.x,1.1+1.6,-p.s),q,new T.Vector3(0.28*k+0.001,0.28*k+0.001,0.28*k+0.001));u.heads.setMatrixAt(p.i,M);
    });
    u.bodies.instanceMatrix.needsUpdate=true;u.heads.instanceMatrix.needsUpdate=true;
    if(u.bodies.instanceColor)u.bodies.instanceColor.needsUpdate=true;
  }

  /* ---------- 限速牌 ---------- */
  function buildSigns(){
    const g=new T.Group();
    for(const z of run.zones){
      for(const [s,lim] of [[z.s0,z.lim],[z.s1,80]]){
        box(g,0.08,2.2,0.08,-2.05,1.1,s,mat(0x555555));
        plane(g,1.0,1.0,-2.05,2.5,s+0.05,mat(0xffffff,{basic:1,map:signTex(String(lim)),side:1}));
      }
    }
    return g;
  }

  /* ---------- 公開介面 ---------- */
  async function load(){
    try{
      T=await import('../vendor/three.min.js');
      return true;
    }catch(e){console.error(e);return false;}
  }
  function init(canvas){
    try{
      renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
      renderer.outputColorSpace=T.SRGBColorSpace;
      scene=new T.Scene();
      camera=new T.PerspectiveCamera(52,1,0.4,520);
      unitBox=new T.BoxGeometry(1,1,1);planeGeo=new T.PlaneGeometry(1,1);
      hemi=new T.HemisphereLight(0xffffff,0x888888,1);scene.add(hemi);
      sun=new T.DirectionalLight(0xffffff,1);sun.position.set(-30,60,20);scene.add(sun);
      head=new T.PointLight(0xfff0d0,0,70,1.2);scene.add(head);
      ground=new T.Mesh(new T.PlaneGeometry(3000,3000),new T.MeshLambertMaterial({color:0x777777}));
      ground.rotation.x=-Math.PI/2;ground.position.y=-12;scene.add(ground);
      scene.fog=new T.Fog(0xcccccc,40,420);
      return true;
    }catch(e){console.error(e);return false;}
  }
  function resize(w,h,dpr){
    cw=w;ch=h;if(!renderer)return;
    renderer.setPixelRatio(Math.min(dpr,1.5));renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  function setRun(g){
    run=g;th=TH[g.theme]||TH.day;
    for(const c of chunks.values())freeChunk(c);chunks.clear();
    for(const t of texs.values())t.dispose();texs.clear();
    for(const m of mats.values())m.dispose();mats.clear();
    if(scene._signs){scene.remove(scene._signs);}
    for(const st of g.stations){if(st.g3){scene.remove(st.g3);st.g3=null;}}
    scene.background=bgTex();
    ground.material.color.setHex(th.gnd);
    scene._signs=buildSigns();scene.add(scene._signs);
    tun=sectorEnv(g.pos+15)==='tunnel'?1:0;
  }
  function frame(g,dt,camX,camY){
    if(!renderer||run!==g)return;
    const pos=g.pos;
    // 區塊
    const c0=Math.floor((pos-60)/CH),c1=Math.floor((pos+480)/CH);
    for(let c=c0;c<=c1;c++)if(!chunks.has(c)){const k=buildChunk(c);scene.add(k);chunks.set(c,k);}
    for(const [c,k] of chunks)if(c<c0||c>c1){freeChunk(k);chunks.delete(c);}
    // 車站（靠近才建立）
    for(const st of g.stations){
      const near=Math.abs(st.pos-pos)<620;
      if(near&&!st.g3){st.g3=buildStation(st);scene.add(st.g3);}
      if(st.g3)st.g3.visible=near;
    }
    // 月台門與乘客動畫
    if(g.stopSt!==null){
      const st=g.stations[g.stopSt],gg=st.g3;
      if(gg){
        const u=gg.userData,fr=g.doors.side===st.side?g.doors.frac:0;
        if(Math.abs(u.open-fr)>0.002){
          u.open=fr;
          for(const d of u.doors){d.a.position.z=-(d.sj-0.6-1.2*fr);d.b.position.z=-(d.sj+0.6+1.2*fr);}
        }
        const bf=Math.round(g.boardFrac*20)/20;
        const want=1-bf;
        if(u.vis!==want){u.vis=want;setPersons(gg,want);}
      }
    }
    // 光線與霧：依鏡頭所在場景漸變
    const target=sectorEnv(pos+8)==='tunnel'?1:0;
    tun+=(target-tun)*Math.min(1,dt*3);
    const fogE=new T.Color(th.fog),fogT=new T.Color(0x040508);
    scene.fog.color.copy(fogE).lerp(fogT,tun);scene.fog.near=40-30*tun;scene.fog.far=420-170*tun;
    hemi.color.setHex(th.hemi[0]);hemi.groundColor.setHex(th.hemi[1]);
    hemi.intensity=th.hemi[2]*(1-tun)+0.9*tun;
    sun.intensity=th.sun*(1-tun);
    head.intensity=2.2*tun+0.4*(1-tun)*(th.lit>0.5?1:0);
    head.position.set(0,2.6,-pos-3);
    ground.position.set(0,-12,-pos);
    // 鏡頭
    camera.position.set(camX,CAMH+camY,-pos);
    camera.lookAt(camX,CAMH+camY-0.05,-pos-50);
    renderer.render(scene,camera);
  }
  const CAMH=2.4;
  return {load,init,resize,setRun,frame,get ok(){return !!renderer;}};
})();
