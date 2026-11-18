// 冒煙測試：載入頁面、兩個關卡的結算、更新日誌延遲載入、一場電腦推演。
// 用法：在 taiwan-strait-landing 資料夾 python3 -m http.server 8765 &，再 node tools/test/smoke.js（需要 playwright）
const {chromium}=require('playwright');
const URL='http://localhost:'+(process.env.PORT||8765)+'/index.html',fails=[];
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails.push(m);};
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium'});
const page=async(q)=>{const p=await b.newPage({viewport:{width:1400,height:900}});p.errs=[];p.bad=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('response',r=>{if(r.status()>=400)p.bad.push(r.status()+' '+r.url());});
  await p.addInitScript(()=>{const o=window.setTimeout;window.setTimeout=(f,t,...a)=>o(f,t>=1500?t:Math.min(t||0,40),...a);});
  await p.goto(URL+q);await p.waitForTimeout(1500);return p;};
// 1 載入
let p=await page('?debug=1');
ok(await p.evaluate(()=>typeof S==='object'&&typeof startGame==='function'&&Object.keys(MISSION_DEFS).join()==='carrier,port'),'頁面載入、兩個關卡已註冊');
ok(!p.errs.length&&!p.bad.length,'載入沒有錯誤／404 '+JSON.stringify(p.errs.concat(p.bad)));
// 2 更新日誌：開頁不載入舊的；看全部才載入
ok(await p.evaluate(()=>CHANGELOG.length<=15&&CHANGELOG_OLD===null),'開頁只載入最近的更新日誌');
await p.evaluate(()=>showChangelog(true));await p.waitForTimeout(1500);
ok(await p.evaluate(()=>CHANGELOG_OLD&&CHANGELOG_OLD.length>0&&document.querySelectorAll('#wn h4').length>CHANGELOG.length),'看全部時載入舊的更新日誌');
await p.close();
// 3 擊沉航艦
p=await page('?mission=carrier&debug=1');await p.click('#misGo');await p.waitForTimeout(2500);
await p.evaluate(()=>{const cv=S.units.find(u=>u.type==='cv'&&u.side==='atk');cv.hp=1;render();});await p.waitForTimeout(4000);
ok((await p.textContent('#mbox')).includes('任務成功'),'擊沉航艦：航艦重創 → 任務成功');ok(!p.errs.length,'擊沉航艦沒有頁面錯誤 '+p.errs);await p.close();
// 4 奪港
p=await page('?mission=port&ex=keelung&debug=1');await p.click('#misGo');await p.waitForTimeout(2500);
await p.evaluate(()=>{setInterval(()=>{for(const k of[SPOT.tcport,SPOT.kaohsiung]){S.owner[k]='atk';S.portDown[k]=0;}},50);});
for(let i=0;i<60&&!(await p.evaluate(()=>MISSION.done));i++){await p.evaluate(()=>{const e=document.querySelector('#modal:not([hidden]) #mbox .opt,#evGo,#itGo,#evRoll');if(e)e.click();else if(humanTurn())document.querySelector('#btnEnd').click();});await p.waitForTimeout(700);}
await p.waitForTimeout(3000);ok((await p.textContent('#mbox')).includes('任務成功'),'奪港：持續守住兩港 → 任務成功');await p.close();
p=await page('?mission=port&ex=keelung&debug=1');await p.click('#misGo');await p.waitForTimeout(2500);
for(let i=0;i<150&&!(await p.evaluate(()=>MISSION.done));i++){await p.evaluate(()=>{const e=document.querySelector('#modal:not([hidden]) #mbox .opt,#evGo,#itGo,#evRoll');if(e)e.click();else if(humanTurn())document.querySelector('#btnEnd').click();});await p.waitForTimeout(700);}
await p.waitForTimeout(3000);ok((await p.textContent('#mbox')).includes('任務失敗'),'奪港：沒佔港 → 第 6 回合任務失敗');ok(!p.errs.length,'奪港沒有頁面錯誤 '+p.errs);await p.close();
await b.close();console.log(fails.length?'\n失敗 '+fails.length+' 項':'\n全部通過');process.exit(fails.length?1:0);})();
