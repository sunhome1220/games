'use strict';
/* 登陸提示（2026-11-17）：選了要登陸的旅後，在地圖上用小標籤指出各處適合哪種登陸方式。
   標籤：搶灘（登陸艦）、港口卸載／港口登陸、浮動碼頭（滾裝船）、空降；★＝推薦（守軍少、離還沒拿下的目標近）；
   載著旅的船沒有任何可登陸格時，改在附近的港口標出「為什麼不能卸載」。
   「登陸提示」按鈕可開關：沒選過時前 2 回合預設開啟，之後依玩家的選擇（記在這台裝置）。
   只畫提示，不影響規則；評分沿用電腦攻方選灘頭的算法（離目標近、守軍少、旁邊有友軍）。 */
let LANDTIPS=null;try{LANDTIPS=localStorage.getItem('tsl-landtips');}catch(e){}
const landTipsOn=()=>LANDTIPS==='1'?true:LANDTIPS==='0'?false:!!(S&&S.started&&S.turn<=2);
function landTipsSync(){const b=document.getElementById('btnLand');if(!b)return;b.setAttribute('aria-pressed',landTipsOn()?'true':'false');b.hidden=!(S&&S.started&&S.ctrl&&S.ctrl.atk==='human'&&!S.video&&!S.sim);} // 只有人類操作攻方時才有登陸提示；守方、電腦推演、影片沒有可提示的東西，按鈕會像壞掉
function landTipsSet(v){LANDTIPS=v?'1':'0';try{localStorage.setItem('tsl-landtips',LANDTIPS);}catch(e){}landTipsSync();if(S&&S.started&&typeof render==='function')render();}
{const b=document.getElementById('btnLand');if(b)b.onclick=()=>landTipsSet(!landTipsOn());}
let LTPLACED=[];
const defTxt=n=>n<=3?'守軍少':n<=8?'守軍中':'守軍多';
function ltag(k,txt,cls){
  const h=TER[k],[x,y]=cen(h.c,h.r),fs=8.5*Math.max(.72,SC);let ty=y-R*1.3;
  const w=[...txt].reduce((a,ch)=>a+(/[　-鿿★・：]/.test(ch)?fs:fs*.6),0)+10,hh=fs+6;
  for(let i=0;i<8&&LTPLACED.some(q=>Math.abs(q.x-x)<(q.w+w)/2&&Math.abs(q.y-ty)<hh+1);i++)ty-=hh+1; // 標籤互相疊到就往上錯開
  LTPLACED.push({x,y:ty,w});
  return '<g class="ltg '+cls+'" data-x="'+x.toFixed(1)+'" data-y="'+ty.toFixed(1)+'"><path class="ltl" d="M'+x.toFixed(1)+' '+(ty+hh/2).toFixed(1)+'L'+x.toFixed(1)+' '+(y-R*.35).toFixed(1)+'"/>'+
    '<rect x="'+(x-w/2).toFixed(1)+'" y="'+(ty-hh/2).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+hh.toFixed(1)+'" rx="'+(hh/2).toFixed(1)+'"/>'+
    '<text x="'+x.toFixed(1)+'" y="'+(ty+fs*.36).toFixed(1)+'" text-anchor="middle" font-size="'+fs.toFixed(1)+'">'+txt+'</text></g>';
}
// 這個旅的登陸／空降方案：可登陸格與空降格（依評分排序，小的較好）、推薦、名稱；標籤與手把選項共用
function landPlan(u){
  if(!S||!u||!alive(u)||u.side!=='atk'||!(isBde(u)||isAirT(u)))return null;
  const rc=reach(u),sh=u.ship&&shipOf(u),ro=!!sh&&sh.type==='ro';
  const defs=S.units.filter(e=>e.side==='def'&&onTW(e)&&!isMsl(e)&&alive(e)),goals=PORTS.concat([TAIPEI]).filter(k=>S.owner[k]!=='atk');
  const lands=[],drops=[];
  for(const [k,v] of rc){
    if(v.kind!=='land'&&v.kind!=='drop')continue;const t=TER[k];if(!t||(t.isl!=='TW'&&t.isl!=='PH'))continue;
    let dS=0;for(const e of defs)if(hd(hexOf(e),t)<=kmH(40))dS+=e.hp;
    const md=goals.length?minD(k,goals):0,sc=md*.5+dS*.25+(v.kind==='land'?enemyAdj(k,'atk')*1.5-Math.min(friendAdj(k,'atk'),3):0);
    (v.kind==='land'?lands:drops).push({k,t,dS,sc});
  }
  lands.sort((a,b)=>a.sc-b.sc);drops.sort((a,b)=>a.sc-b.sc);
  const nameOf=x=>x.t.t==='port'?(ro||u.type==='arm'?'港口卸載':'港口登陸'):(ro?'浮動碼頭':'搶灘');
  const recs=new Set(lands.slice(0,2).map(x=>x.k));if(drops.length&&drops[0].dS<=3)recs.add(drops[0].k);
  // 要標示／列出的登陸格：2 個港口＋4 個其他，依評分排序
  const shown=lands.filter(x=>x.t.t==='port').slice(0,2).concat(lands.filter(x=>x.t.t!=='port').slice(0,4)).sort((a,b)=>a.sc-b.sc);
  return {rc,sh,ro,lands,drops,recs,shown,nameOf,dropsShown:drops.slice(0,3),label:(x,kind)=>(recs.has(x.k)?'★推薦 ':'')+(kind==='drop'?'空降':nameOf(x))+'・'+defTxt(x.dS)};
}
function landTagsSVG(){
  if(!S||!S.started||S.over||S.phase!=='atk'||S.mode||!landTipsOn()||!humanTurn())return '';
  const u=S.sel;if(!u||u.moved||u.acted)return '';
  const pl=landPlan(u);if(!pl)return '';
  LTPLACED=[];let o='';
  for(const x of pl.shown)o+=ltag(x.k,pl.label(x,'land'),pl.recs.has(x.k)?'rec':'land');
  for(const x of pl.dropsShown)o+=ltag(x.k,pl.label(x,'drop'),pl.recs.has(x.k)?'rec':'drop');
  if(!pl.lands.length&&!pl.drops.length&&u.ship&&typeof landWhyHex==='function'){ // 沒有任何可登陸格：在附近港口標出為什麼不行
    const seas=[hexOf(u)].concat([...pl.rc].filter(([,v])=>v.kind==='sail').map(([k])=>TER[k])).filter(x=>x&&x.t==='sea'),seen=new Set();let n=0;
    for(const s of seas){if(n>=3)break;for(const m of nbrs(s.c,s.r)){if(n>=3)break;if(!m||seen.has(m.k)||m.t!=='port'||m.isl==='CN'||m.isl==='JP')continue;seen.add(m.k);const w=landWhyHex(u,m);if(w){o+=ltag(m.k,'不能卸載・'+w,'blk');n++;}}}
  }
  return o;
}
