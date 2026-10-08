const {inGame}=require('./browser.cjs');
inGame(async(page,errors)=>{
 await page.addLocatorHandler(page.locator('#stateOverlay:not(.hidden)'),()=>page.locator('#stateOkBtn').evaluate(e=>e.click()));
 await page.evaluate(async()=>{
  const E=await import('./engine.js?v=096b'),W=await import('./world.js'),T=await import('./storage.js?v=096b'),C=await import('./encounters.js');
  for(const runId of [1,2]){
   let s=E.createInitialState(runId);s.scene=s.story.sceneId=runId===1?'ch3_prepare':'ch6_prepare';s.chapter=s.story.chapter=runId===1?3:6;s.story.entered=[s.scene];s.flags.localClothes=true;s.world.location='біля хати баби Галі';s.activeStatuses=[];s=E.normalizeState(s);s=W.syncActor(s);s.companions.evpapiy.known=s.companions.evpapiy.active=true;s.companions.evpapiy.progression.points=2;s.heroProgression.points=2;s=C.startEncounter(s,runId===1?'dog':'cat').state;await T.saveRun(s);
  }
 });
 const read=()=>page.evaluate(async()=>{const s=(await import('./main.js?v=095')).readGameState();return {stats:s.stats,hero:s.heroProgression,equipment:s.equipment,bird:s.companions.evpapiy,encounter:s.expedition.encounter}});
 const open=async tab=>{await page.locator('#menuBtn').evaluate(e=>e.click());await page.locator(`#menuContent [data-navigate="${tab}"]`).click()};
 const results=[];
 for(const runId of [1,2]){
  await page.locator('#continueBtn').click();await page.locator('.run-card').nth(runId-1).click();await page.waitForTimeout(150);const before=await read();
  if(runId===1){await open('stats');await page.locator('[data-stat-upgrade="strength"]').click();await open('clothes');await page.locator('[data-equip="local_vest"]').click()}
  await open('companions');await page.locator('[data-evp-upgrade="health"]').click();await page.locator('[data-bird-talent="beak"]').click();
  const during=await read();if(JSON.stringify(during)!==JSON.stringify(before))throw Error('Menu changed combat preparation for run '+runId);
  await page.locator('#closeMenuBtn').click();await page.locator('[data-encounter="flee"]').click();await page.waitForTimeout(150);
  if(runId===1){await open('stats');await page.locator('[data-stat-upgrade="strength"]').click();await open('clothes');await page.locator('[data-equip="local_vest"]').click();const after=await read();if(after.stats.strength.level!==before.stats.strength.level+1||after.equipment.outer!=='local_vest')throw Error('Preparation stayed locked after escape')}
  else {await open('companions');await page.locator('[data-evp-upgrade="health"]').click();const after=await read();if(after.bird.maxHp!==before.bird.maxHp+10||after.bird.progression.points!==before.bird.progression.points-1)throw Error('Bird upgrade stayed locked after escape')}
  results.push({name:(runId===1?'Stepan':'Evpapiy')+' preparation locked during combat and restored after escape',passed:true});
  await page.locator('#closeMenuBtn').click();await page.locator('#exitBtn').evaluate(e=>e.click());
 }
 console.log(JSON.stringify({suite:'combat-menu',results,errors},null,2));if(errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
