// Real browser regression tests: the same import map and patch chain as the game.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let playwright;try{playwright=require('playwright')}catch{playwright=require(process.env.DNT_NODE_MODULES+'/playwright')}
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)&&file!==root)throw Error('path');if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await playwright.chromium.launch({headless:true,...(process.env.DNT_BROWSER?{executablePath:process.env.DNT_BROWSER}:{})});
 try{
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForTimeout(1400);
 const results=await page.evaluate(async()=>{
   const E=await import('./engine.js?v=096b'),T=await import('./storage.js?v=096b');const results=[];
   async function check(name,fn){try{await fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:String(e.message)})}}
   const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
   for(let chapter=1;chapter<=7;chapter++)await check(`chapter ${chapter} survives normalization and action`,()=>{
     let s=E.createInitialState(1);s.scene=s.story.sceneId=chapter===1?'intro':`ch${chapter}_intro${chapter===6?'099d':chapter===7?'100':''}`;s.chapter=s.story.chapter=chapter;s.customAuthorData={kept:7};
     s=E.executeAction(E.normalizeState(s),{minutes:0,effects:[]}).state;assert(s.chapter===chapter&&s.story.chapter===chapter,`chapter became ${s.chapter}`);assert(s.customAuthorData.kept===7,'unknown field removed');
   });
   await check('full bag rejects whole addition without changing stacks',()=>{let s=E.createInitialState();s.inventory=[{id:'water',qty:4},...Array.from({length:15},()=>({id:'knife',qty:1}))];const before=JSON.stringify(s.inventory);assert(!E.addItem(s,'water',3),'addition should fail');assert(JSON.stringify(s.inventory)===before,'partial items added');});
   await check('missing items reject whole removal',()=>{const s=E.createInitialState();const before=JSON.stringify(s.inventory);assert(!E.removeItem(s,'vodka',2),'removal should fail');assert(JSON.stringify(s.inventory)===before,'partial items removed');});
   await check('failed resource payment cannot earn a reward or consume time',()=>{const s=E.createInitialState();s.inventory=[];const r=E.executeAction(s,{minutes:15,effects:[{type:'heroXp',value:50},{type:'itemRemove',id:'water',qty:1}]});assert(r.state.heroProgression.xp===0,'reward without payment');assert(r.state.clock.totalMinutes===s.clock.totalMinutes,'time consumed on rejected action');assert(r.accepted===false,'rejection missing');});
   await check('valid earned clothing survives load',()=>{const s=E.createInitialState();s.ownedClothes.push('sheepskin');s.equipment.outer='sheepskin';const n=E.normalizeState(s);assert(n.ownedClothes.includes('sheepskin')&&n.equipment.outer==='sheepskin','earned clothing lost');});
   await check('expired timer disappears even after scripted clock jump',()=>{const s=E.createInitialState();s.activeStatuses=['suspicious'];s.statusTimers.suspicious=430;s.clock.totalMinutes=2520;const n=E.executeAction(s,{minutes:0}).state;assert(!n.activeStatuses.includes('suspicious')&&!('suspicious' in n.statusTimers),'expired status remains');});
   await check('a dead hero cannot consume medicine to resurrect',()=>{const s=E.createInitialState();s.health=0;E.addItem(s,'medkit',1);const n=E.useItem(s,'medkit');assert(!n.used&&n.state.health===0&&E.itemCount(n.state,'medkit')===1,'hero resurrected');});
   await check('chapter 7 manual save embeds chapter 7 checkpoint',async()=>{let s=E.createInitialState(2);s.scene=s.story.sceneId='ch7_son100';s.chapter=s.story.chapter=7;s=E.normalizeState(s);await T.saveChapterCheckpoint(s,7);await T.saveManual(s,1);const m=await T.loadManual(2,1);assert(m.chapter===7&&m.__chapterCheckpoint?.chapter===7,'wrong checkpoint');});
   await check('IndexedDB-only autosave remains accessible through Continue',async()=>{let s=E.createInitialState(3);s.scene=s.story.sceneId='ch7_son100';s.chapter=s.story.chapter=7;await T.saveRun(s);localStorage.removeItem(T.saveKeys.AUTO(3));document.querySelector('#continueBtn').click();const n=await T.loadRun(3);assert(n?.scene==='ch7_son100','IndexedDB-only save unavailable');});
   await check('test supplies are given once and stay consumed',()=>{localStorage.setItem('dnt-test-v096',JSON.stringify({all097:true}));let s=E.createInitialState(99);s.flags.testMode=true;s=E.normalizeState(s);const before=E.itemCount(s,'water');s=E.useItem(s,'water').state;assert(E.itemCount(E.normalizeState(s),'water')===before-1,'test item replenished');localStorage.removeItem('dnt-test-v096');});
   await check('legacy save is backed up intact before a new-version write',async()=>{const s=E.createInitialState(2);s.schemaVersion=11;s.health=37;s.flags.authorSecret='kept';const old=JSON.stringify(s);localStorage.setItem(T.saveKeys.AUTO(2),old);await T.persistentDelete(T.saveKeys.AUTO(2)+':backup:v11');await T.saveRun(E.normalizeState(s));const backup=await T.persistentRead(T.saveKeys.AUTO(2)+':backup:v11');assert(backup===old,'backup changed original');});
   await check('migration is idempotent and does not replay old damage or costs',async()=>{const P=await import('./patch-v098.js?v=099e');const s=E.createInitialState();s.schemaVersion=11;s.scene=s.story.sceneId='ch4_intro';s.story.entered=['ch4_intro'];s.flags.post096_ch4_intro=false;s.health=37;s.money=9;const first=P.__v099Test.migrateState(s);const second=P.__v099Test.migrateState(first.state);assert(!second.changed&&JSON.stringify(second.state)===JSON.stringify(first.state),'migration repeats');assert(first.state.health===37&&first.state.money===9,'retroactive costs');});
   await check('export and import preserve autosaves, manuals, checkpoints and author fields',async()=>{const bundle=await T.exportBackup();bundle.saves[T.saveKeys.AUTO(2)].authorExtension={text:'оригінальний факт'};await T.importBackup(bundle);const state=await T.loadRun(2);assert(state.authorExtension.text==='оригінальний факт','author field lost');assert(await T.loadManual(2,1),'manual lost');assert(await T.loadChapterCheckpoint(2,7),'checkpoint lost');let rejected=false;try{T.validateBackup({...bundle,saves:{'unrelated-setting':state}})}catch{rejected=true}assert(rejected,'foreign storage key accepted');});
   return results;
 });
 await page.reload();await page.waitForTimeout(1400);
 async function browserCheck(name,fn){try{await fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}}
 const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
 await browserCheck('dead hero cannot start a battle',async()=>{const health=await page.evaluate(async()=>{const E=await import('./engine.js?v=096b'),B=await import('./battle.js?v=096b');const s=E.createInitialState();s.health=0;const r=await B.openStoryBattle(s);return r.state.health});assert(health===0,'battle revived dead hero')});
 await browserCheck('zero energy has a playable costly fallback and no absent pigeon',async()=>{
   await page.evaluate(async()=>{const E=await import('./engine.js?v=096b'),B=await import('./battle.js?v=096b');const s=E.createInitialState(1);s.needs.energy=0;s.needs.water=0;s.activeStatuses=[];s.inventory=[];s.flags.battleHelpShown095j=true;window.testBattleResult=null;B.openStoryBattle(s,{id:'regression',rngSeed:42,actionMode:'survival',lockVictory:true,turnLimit:2,nextOnWin:'ch3_galina'}).then(r=>window.testBattleResult=r)});
   assert(await page.locator('[data-battle-action="brace"]:enabled').count()===1,'no playable fallback');assert(await page.locator('[data-battle-action="pigeon"]').count()===0,'absent pigeon offered');
   await page.locator('[data-battle-action="brace"]').click();await page.waitForTimeout(2000);
   const saved=await page.evaluate(async()=>{const T=await import('./storage.js?v=096b');return (await T.loadRun(1)).pendingBattle});assert(saved.battle.turn===2,'completed turn not saved');
   const before=JSON.stringify([saved.battle.turn,saved.battle.heroHp,saved.battle.rngSeed,saved.battle.consumed]);
   await page.reload();await page.waitForTimeout(1400);
   await page.evaluate(async()=>{const T=await import('./storage.js?v=096b'),B=await import('./battle.js?v=096b');const s=await T.loadRun(1);B.openStoryBattle(s,s.pendingBattle.options).then(r=>window.testBattleResult=r)});
   const resumed=await page.evaluate(async()=>{const T=await import('./storage.js?v=096b');return (await T.loadRun(1)).pendingBattle.battle});assert(before===JSON.stringify([resumed.turn,resumed.heroHp,resumed.rngSeed,resumed.consumed]),'reload changed saved battle');
   await page.locator('[data-battle-action="brace"]').click();await page.waitForTimeout(2000);await page.locator('[data-battle-action="story-continue"]').click();await page.waitForTimeout(200);
   const outcome=await page.evaluate(()=>window.testBattleResult);assert(outcome.outcome==='win'&&outcome.state.health>0,'survival fallback did not finish');assert(!outcome.state.pendingBattle,'pending fight not cleared');assert(outcome.state.needs.water===0,'zero water reset');
 });
 console.log(JSON.stringify({suite:'foundations',results},null,2));if(results.some(r=>!r.passed))process.exitCode=1;
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
