'use strict';
/* ---------- 四川艦（076 型兩棲攻擊艦，2026-11-19；★推估）----------
   公開資料：076 型首艦，舷號 51；2024-12-27 下水、2025-11 首次海試；報導預期 2026 年底～2027 年初入列（沒有正式入列的官方消息）。
   滿載約 4～5 萬噸，一座電磁彈射器與阻攔索，無人機為主、直升機約 20 架；載兵約 1,000～1,500 人（約遊戲一個旅的 1/4）；
   防空只有近程自衛（紅旗-10 等，外觀分析），沒有區域防空。
   遊戲：2027 年起 1 艘（沒有第二艘的可靠資料）。做成一艘兩棲艦（沿用兩棲艦群的規則：會被打、沉了載的兵一起損失），
   載著一個「海軍陸戰隊空中突擊營」（空中突擊棋子，1 步＝約 1/4 個旅）：直升機從艦上起飛，從海上的位置機降，不必從沿岸基地出發；機降後艦留在海上，不會回到兩棲艦群運力池。
   沒有做：無人機打擊（沒有可靠的架數與性能）、第二艘、載氣墊登陸艇。 */
const LHA={from:2027,at:[120.4,26.3],n:'四川艦（076 型）',marN:'海軍陸戰隊（四川艦）'};
function lhaSpawn(){ // 開局：2027 年起出現，停在福建外海（福州東方，與兩棲部隊集結區相近；實際母港不明，★推估）
  if((+S.era||2026)<LHA.from||S.units.some(u=>u.lha))return;
  const [c,r]=llToRC(LHA.at[0],LHA.at[1]);if(!TER[K(c,r)])return;
  const h=TER[K(c,r)].t==='sea'&&!unitsAt(K(c,r)).length?TER[K(c,r)]:placeNear(K(c,r),x=>x.t==='sea'&&!unitsAt(x.k).length);if(!h)return;
  const mar=mkUnit('atk','aas',h.k,{hp:1,goal:1,lhaMar:1});
  const ship=mkUnit('atk','lst',h.k,{boundTo:mar.id,lha:1});mar.ship=ship.id;S.units.push(ship,mar);
  log(LHA.n+'入列：載「'+LHA.marN+'」約 1,000～1,500 人與直升機，停在福建外海（★推估）');
}
