const {inGame}=require('./browser.cjs');
inGame(async(page,errors)=>{
 const results=[];
 const assert=(ok,m)=>{if(!ok)throw Error(m)};
 async function check(name,fn){try{await fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}}
 async function start(cfg={}){
  await page.reload();await page.waitForTimeout(1400);
  await page.evaluate(async cfg=>{
   const E=await import('./engine.js?v=096b'),B=await import('./battle.js?v=096b');let s=E.createInitialState(1);
   s.activeStatuses=[];s.flags.battleHelpShown095j=true;s.world.environment='indoors';s.needs.water=80;s.needs.energy=cfg.energy??65;
   s.inventory=[];if(cfg.food){E.addItem(s,'salo',1);s.needs.satiety=20}if(cfg.knife)E.addItem(s,'knife',1);
   if(cfg.prepared){s.flags.threatPrepared=true;s.stats.attention.level=4}
   if(cfg.bird){s.companions.evpapiy.known=s.companions.evpapiy.active=true;s.relationships.evpapiy.known=true;s.relationships.evpapiy.values.trust=cfg.trust??0;s.relationships.evpapiy.values.offense=0}
   window.combatResult=null;B.openStoryBattle(s,{id:cfg.knife?'shedCreature':'prepared-regression',rngSeed:1,actionMode:cfg.mode||'survival',turnLimit:2,lockVictory:true}).then(r=>window.combatResult=r);
  },cfg);
 }
 async function round(action){await page.locator(`[data-battle-action="${action}"]`).click();await page.waitForFunction(()=>document.querySelector('[data-battle-action="story-continue"]')||document.querySelector('[data-battle-action="guard"]:enabled'),null,{timeout:5000});await page.waitForTimeout(100)}
 async function result(){await page.locator('[data-battle-action="story-continue"]').click();await page.waitForFunction(()=>window.combatResult);return page.evaluate(()=>window.combatResult)}
 await check('same encounter, seed and choices: preparation changes the health cost and survives in memory',async()=>{
  await start();await round('guard');await round('guard');const low=await result();
  await start({prepared:true});await round('guard');await round('guard');const high=await result();
  assert(high.state.health>low.state.health,'preparation did not affect damage');assert(!high.state.flags.threatPrepared&&high.state.memories.combat['prepared-regression'].outcome==='win','preparation repeated or outcome lost');
 });
 await check('earlier trust changes the cost of pigeon support',async()=>{
  const remaining=[];
  for(const trust of [0,8]){await start({bird:true,trust});await round('pigeon');remaining.push(await page.evaluate(async()=>{const T=await import('./storage.js?v=096b');return(await T.loadRun(1)).pendingBattle.battle.heroEnergy}))}
  assert(remaining[1]>remaining[0],'trust makes no difference');
 });
 await check('low energy does not hide an affordable prayer or available food',async()=>{
  // Fatigue adds 2: prayer costs 5 and guard costs 7 at this energy level.
  await start({energy:5,mode:'prayer',food:true});assert(await page.locator('[data-battle-action="pray-continue"]:enabled').count()===1,'affordable prayer hidden');assert(await page.locator('[data-battle-action="eat-salo"]:enabled').count()===1,'food hidden');assert(await page.locator('[data-battle-action="brace"]:enabled').count()===1,'fallback missing');
 });
 await check('reloading a scripted knife strike preserves knockout, damage and knife consumption',async()=>{
  await start({knife:true,mode:'normal'});await page.locator('[data-battle-action="knife"]').click();
  await page.waitForFunction(async()=>{const T=await import('./storage.js?v=096b');return(await T.loadRun(1))?.pendingBattle?.battle?.scriptedKnife==='attackPending'});
  await page.reload();await page.waitForTimeout(1400);await page.evaluate(async()=>{const T=await import('./storage.js?v=096b'),B=await import('./battle.js?v=096b');const s=await T.loadRun(1);window.combatResult=null;B.openStoryBattle(s,s.pendingBattle.options).then(r=>window.combatResult=r)});
  await page.waitForSelector('[data-battle-action="story-continue"]');const r=await result();assert(r.outcome==='knockout'&&r.battle.heroHp===60,'scripted strike changed on reload');assert(!r.state.inventory.some(i=>i.id==='knife'),'destroyed knife retained');
 });
 console.log(JSON.stringify({suite:'combat',results,errors},null,2));if(results.some(r=>!r.passed)||errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
