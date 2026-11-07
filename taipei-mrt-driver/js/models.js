'use strict';
// 車型資料。來源：維基百科各車型條目與各路線條目「使用列車」（2026-11 擷取）。
// 【已查證】車型名稱、各路線使用的車型與列數、起動加速度、正常／緊急減速度、營運最高速度、編組輸出功率、
//          單節長度、供電（全部為 DC 750 V 第三軌）、製造商與年份、每節車門數（文湖線）。
// 【推估】mass：C301 條目載有 216 t，其餘車型未載，依 C301 推估為 220 t；knee 為由功率與質量推得的
//        「開始進入恆功率區」的速度（m/s），僅用來讓不同車型在高速時的加速度有差別。
// 【示意】cab 的顏色與外觀為遊戲示意，不是各車型駕駛室的實際配色。
const MODELS={
  C301:{id:'C301',name:'C301 型',maker:'川崎重工／聯合鐵路機車集團',year:'1992–93',cars:6,carLen:23.5,len:141,doorsPerCar:4,
        kw:2320,mass:216,accel:1.0,brake:1.0,eb:1.30,vmax:80,design:90,knee:8.6,motor:'西屋 1503A（145 kW）',
        cab:{dash0:'#2d3036',dash1:'#14161a',trim:'#b8a98a',screen:'#9fd6a0'}},
  '321':{id:'321',name:'321 型',maker:'西門子（中鋼組裝）',year:'1998–99',cars:6,carLen:23.5,len:141,doorsPerCar:4,
        kw:3680,mass:220,accel:1.0,brake:1.0,eb:1.30,vmax:80,design:90,knee:13.4,motor:'西門子 1TB2013（230 kW）',
        cab:{dash0:'#27313b',dash1:'#12171d',trim:'#7fa6c9',screen:'#8fe0ff'}},
  '341':{id:'341',name:'341 型',maker:'西門子',year:'2003',cars:6,carLen:23.5,len:141,doorsPerCar:4,
        kw:3680,mass:220,accel:1.0,brake:1.0,eb:1.30,vmax:80,design:90,knee:13.4,motor:'西門子 1TB2013（230 kW）',
        cab:{dash0:'#242d38',dash1:'#10151b',trim:'#6fb4d8',screen:'#8fe0ff'}},
  C371:{id:'C371',name:'C371 型',maker:'三菱電機等',year:'2005–09',cars:6,carLen:23.5,len:141,doorsPerCar:4,
        kw:2800,mass:220,accel:1.0,brake:1.0,eb:1.30,vmax:80,design:90,knee:10.2,motor:'三菱 MB-5113-A（175 kW）',
        cab:{dash0:'#2b2f2a',dash1:'#121512',trim:'#8fb87a',screen:'#b6e39a'}},
  C381:{id:'C381',name:'C381 型',maker:'川崎重工／台灣車輛',year:'2010–13',cars:6,carLen:23.5,len:141.4,doorsPerCar:4,
        kw:2800,mass:220,accel:1.0,brake:1.0,eb:1.30,vmax:80,design:100,knee:10.2,motor:'三菱 MB-5113-A2（175 kW）',
        cab:{dash0:'#22262e',dash1:'#0e1015',trim:'#c9ced8',screen:'#9ad0ff'}},
  // 文湖線：真實列車為全自動無人駕駛（GoA 4），遊戲中的手動駕駛是模擬設定
  VAL256:{id:'VAL256',name:'VAL256 型',maker:'馬特拉／阿爾斯通',year:'1990–93',cars:4,carLen:13.78,len:55.5,doorsPerCar:2,
        kw:0,mass:74.4,accel:1.3,brake:1.3,eb:1.3,vmax:70,design:80,knee:12,motor:'直流馬達（每車 2 具）',driverless:true,
        cab:{dash0:'#2c3340',dash1:'#12161d',trim:'#e8eef8',screen:'#8ec5ff'}},
  INNOVIA:{id:'INNOVIA',name:'Innovia APM 256（370 型）',maker:'龐巴迪／唐榮車輛科技',year:'—',cars:4,carLen:13.78,len:55.5,doorsPerCar:2,
        kw:0,mass:74.4,accel:1.0,brake:1.0,eb:2.35,vmax:70,design:90,knee:10,motor:'龐巴迪 1512A（118 kW）',driverless:true,
        cab:{dash0:'#2a313a',dash1:'#11151b',trim:'#8ec5ff',screen:'#8ec5ff'}}
};
// 各路線使用的車型與列數（亂數選車時依列數加權；文湖線兩款未載列數，等權）
const FLEETS={
  red:[['C301',22],['C381',15]],
  blue:[['321',36],['341',6],['C381',1]],
  green:[['C371',18],['C381',8]],
  brown:[['VAL256',1],['INNOVIA',1]]
};
// 編組號碼（出自各路線條目的編組範圍）；回傳像 "17/18" 的字串，文湖線未載則回傳空字串
function pairs(a,count,step){const o=[];for(let m=0;m<count;m++){const n=a+m*(step||2);o.push(n+'/'+(n+1));}return o;}
const FORMATIONS={
  'red|C301':pairs(1,22).map(s=>s.split('/').map(x=>String(x).padStart(2,'0')).join('/')),
  'red|C381':['501/502'].concat(pairs(505,14)),
  'blue|321':pairs(101,8).concat(pairs(119,27),['175/176']),
  'blue|341':pairs(201,6),
  'blue|C381':['503/504'],
  'green|C371':['301/302','303/304'].concat(pairs(307,16)),
  'green|C381':pairs(533,8)
};
function pickModel(line,want){
  const f=FLEETS[line];
  if(want&&want!=='auto'&&f.some(x=>x[0]===want))return want;
  let tot=0;f.forEach(x=>tot+=x[1]);let r=Math.random()*tot;
  for(const [id,n] of f){if((r-=n)<=0)return id;}
  return f[0][0];
}
function pickFormation(line,id){
  const L=FORMATIONS[line+'|'+id];if(!L)return '';
  return L[Math.floor(Math.random()*L.length)];
}
