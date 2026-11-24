'use strict';
/* ---------- 傾斜視角（斜俯視） ----------
   做法：把地圖在畫面縱向壓縮成 cos(視角)（正交投影的斜俯視，像 Advance Wars 的棋盤），外層 #tiltBox 的高度同步縮短，捲動範圍才不會多出空白。
   為什麼不用真的透視（perspective＋rotateX）：Chrome 對 3D 變形下的 SVG 做不了內部點擊判定（實測所有點擊都落在同一種多邊形上，點不到單位與海面），
   而 2D 縮放（仿射）下 getScreenCTM、seaHexAt、elementFromPoint 全部照常運作。
   樣式寫在 inline style（不寫進樣式表），匯出截圖／影片讀樣式表時不會跟著壓縮。極簡畫質（ULTRA）一律平面。 */
let TILT=0;try{TILT=+localStorage.getItem('tsl-tilt')||0;}catch(e){}
const TILT_OPTS={'0':['平面','（預設）正上方俯視。'],'25':['微傾斜（25°）','斜俯視：地圖縱向壓縮約 10%，山與建築的立體側面更明顯。'],'40':['傾斜（40°）','縱向壓縮約 23%，更像斜看棋盤；棋子與文字也會被壓扁一些。']};
const tiltOn=()=>TILT>0&&!ULTRA;
const tiltK=()=>tiltOn()?Math.cos(TILT*Math.PI/180):1;
function tiltApply(){
  const box=document.getElementById('tiltBox'),m=document.getElementById('map');if(!box||!m)return;
  const on=tiltOn(),k=tiltK();document.body.classList.toggle('tilt',on);
  if(!on){if(box.style.transform){box.style.transform='';box.style.height='';box.style.transformOrigin='';}return;}
  box.style.transformOrigin='0 0';box.style.transform='scaleY('+k+')';box.style.height=((m.clientHeight||m.getBoundingClientRect().height/(box.__k||1))*k).toFixed(1)+'px';box.__k=k;
}
function setTilt(v){ // 切換時讓視窗中心對著同一塊地圖
  const w=document.querySelector('.mapwrap'),fy=w?(w.scrollTop+w.clientHeight/2)/Math.max(1,w.scrollHeight):0;
  TILT=+v||0;try{localStorage.setItem('tsl-tilt',String(TILT));}catch(e){}tiltApply();
  if(w)w.scrollTop=fy*w.scrollHeight-w.clientHeight/2;}
{const m=document.getElementById('map');
  if(window.ResizeObserver&&m)new ResizeObserver(()=>tiltApply()).observe(m);
  addEventListener('resize',()=>tiltApply());tiltApply();}
