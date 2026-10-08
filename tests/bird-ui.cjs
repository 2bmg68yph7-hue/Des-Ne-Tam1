const {inGame}=require('./browser.cjs'),path=require('node:path'),fs=require('node:fs');
inGame(async(page,errors)=>{
 const out=path.resolve(__dirname,'../../../outputs/stage7-ui');fs.mkdirSync(out,{recursive:true});
 await page.addLocatorHandler(page.locator('#stateOverlay:not(.hidden)'),()=>page.locator('#stateOkBtn').evaluate(e=>e.click()));
 await page.evaluate(async()=>{const E=await import('./engine.js?v=096b'),W=await import('./world.js'),T=await import('./storage.js?v=096b');let s=E.createInitialState();s.scene=s.story.sceneId='ch6_prepare';s.story.entered=['ch6_prepare'];s.chapter=s.story.chapter=6;s.companions.evpapiy.known=s.companions.evpapiy.active=true;s.relationships.galina.known=true;s.flags.metPigeon=s.flags.knowsPigeonName=true;s.world.location='біля хати баби Галі';s.activeStatuses=[];s=W.syncActor(E.normalizeState(s));s.companions.evpapiy.progression.points=1;s.resourceWorld={rngSeed:424242,stocks:{},traps:{},discovered:[]};await T.saveRun(s)});
 await page.locator('#continueBtn').click();await page.locator('.run-card').first().click();await page.waitForTimeout(250);
 await page.locator('#menuBtn').click();await page.locator('[data-navigate="companions"]').click();await page.locator('[data-bird-talent="authority"]').click();await page.waitForTimeout(150);
 await page.locator('#menuOverviewBtn').click();await page.locator('[data-navigate="place"]').click();await page.locator('[data-expedition-action="salo-fight"]').click();await page.waitForTimeout(200);
 if(await page.locator('[data-encounter="flee"]').count()!==1)throw Error('field fight has no escape');
 for(const size of[{width:320,height:568},{width:390,height:844},{width:430,height:932}]){await page.setViewportSize(size);await page.waitForTimeout(80);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('bird fight overflow');await page.screenshot({path:path.join(out,size.width+'-fight.png')})}
 const turn=await page.evaluate(async()=>{const M=await import('./main.js?v=095');return M.readGameState().expedition.encounter.turn});await page.reload();await page.locator('#continueBtn').click();await page.locator('.run-card').first().click();await page.waitForTimeout(200);if(!await page.locator('[data-encounter="flee"]').count())throw Error('reload lost field fight');
 for(let i=0;i<10&&await page.locator('[data-encounter="attack"]').count();i++){await page.locator('[data-encounter="attack"]').click();await page.waitForTimeout(180)}
 const s=await page.evaluate(async()=>{const M=await import('./main.js?v=095');return M.readGameState()});if(!s.companions.evpapiy.quests.salo||s.activeActor!=='evpapiy'||s.scene!=='ch6_prepare')throw Error('quest win or actor lost');
 await page.locator('#menuBtn').click();await page.locator('#menuContent [data-navigate="hero"]').click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'390-bird-hero.png')});
 console.log(JSON.stringify({suite:'bird-ui',passed:true,turn,quest:s.companions.evpapiy.quests.salo,actor:s.activeActor,errors},null,2));if(errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
