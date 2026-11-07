'use strict';
// 手機震動：檔位切換、中立位、緊急煞車、ATP、車門與突發事件各有不同的觸感。
// Android／多數桌面瀏覽器：navigator.vibrate（需要使用者先操作過頁面）。
// iPhone Safari 不支援 navigator.vibrate；iOS 17.4 起切換 <input type="checkbox" switch> 會產生觸覺回饋，
// 這裡用它近似（每次切換一下，圖案以多次切換表示）。這是已知的替代做法，但在真機上的效果沒有驗證。
const HAP={
  p:n=>[4+n*2],                                  // P1～P4：很輕的點，越高檔越久
  n:()=>[16,45,16],                              // N：兩下「卡位」感
  b:n=>[8+n*3],                                  // B1～B7：越重的煞車越長
  eb:()=>[90,35,90,35,220],                      // 緊急煞車：重而長
  ebHold:()=>[45,25,45],                         // 緊急煞車持續時的低頻震動
  atp:()=>[70,30,70,30,70,30,260],               // ATP 動作
  doorOpen:()=>[30],doorClose:()=>[18,40,18],
  alert:()=>[40,70,40,70,40],                    // 突發事件
  quake:()=>[25,20,25,20,25,20,25,20,25,20,25,20,25]
};
const IS_IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let _hapLabel=null,_hapLast=0;
function hapSupport(){return typeof navigator.vibrate==='function'?'vibrate':IS_IOS?'ios':'none';}
function _iosEl(){
  if(_hapLabel)return _hapLabel;
  const l=document.createElement('label');l.setAttribute('aria-hidden','true');
  l.style.cssText='position:fixed;left:-120px;top:0;width:40px;height:40px;opacity:0.01;pointer-events:none';
  const i=document.createElement('input');i.type='checkbox';i.setAttribute('switch','');l.appendChild(i);document.body.appendChild(l);
  return _hapLabel=l;
}
function iosHaptic(pat){
  const l=_iosEl();let t=0;
  pat.forEach((ms,i)=>{
    if(i%2===0){const n=Math.max(1,Math.round(ms/45));for(let k=0;k<n;k++)setTimeout(()=>{try{l.click();}catch(e){}},t+k*45);}
    t+=ms;
  });
}
function haptic(name,arg){
  if(!SET.haptic||!HAP[name])return;
  const pat=HAP[name](arg);_hapLast=performance.now();
  if(hapSupport()==='vibrate'){try{navigator.vibrate(pat);}catch(e){}}
  else if(hapSupport()==='ios')iosHaptic(pat);
}
// 緊急煞車持續期間，每 0.5 秒再震一次（Android 為主）
function hapRumble(g){
  if(!SET.haptic||!(g.notch===-8||g.evForceEB)||g.v<1)return;
  if(performance.now()-_hapLast>500)haptic('ebHold');
}
