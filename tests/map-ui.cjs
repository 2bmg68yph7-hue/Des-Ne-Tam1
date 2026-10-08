const {inGame}=require('./browser.cjs');const path=require('node:path'),fs=require('node:fs');
inGame(async(page,errors)=>{
 const out=path.resolve(__dirname,'../../../outputs/stage6-ui');fs.mkdirSync(out,{recursive:true});
 await page.addLocatorHandler(page.locator('#stateOverlay:not(.hidden)'),()=>page.locator('#stateOkBtn').evaluate(e=>e.click()));
 await page.locator('#newGameBtn').click();await page.locator('.run-card').first().click();await page.locator('#beginGameBtn').click();
 await page.locator('#gameNavigation [data-navigate="map"]').click();await page.locator('.route-list [data-travel="well"]').click();await page.waitForTimeout(200);await page.locator('.route-list [data-travel="forest"]').click();await page.waitForTimeout(200);
 const before=await page.evaluate(async()=>{const M=await import('./main.js?v=095');return M.readGameState()});if(before.scene!=='intro'||before.expedition.current!=='forest')throw Error('UI travel changed canonical scene');
 await page.evaluate(()=>{for(let i=0;i<20&&!document.querySelector('#stateOverlay').classList.contains('hidden');i++)document.querySelector('#stateOkBtn').click();document.querySelector('#menuContent').scrollTop=0});await page.waitForTimeout(2600);
 for(const size of[{width:320,height:568},{width:390,height:844},{width:430,height:932}]){
  await page.setViewportSize(size);await page.waitForTimeout(60);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('map overflow');await page.screenshot({path:path.join(out,size.width+'-map.png')});
 }
 await page.locator('#closeMenuBtn').click();await page.locator('[data-explore-place]').click();await page.locator('[data-expedition-action="gather:berries"]').click();await page.waitForTimeout(250);
 const stock=await page.evaluate(async()=>{const M=await import('./main.js?v=095');return M.readGameState().resourceWorld.stocks['forest:berries'].left});if(stock!==2)throw Error('gather did not deplete stock exactly once');
 await page.locator('#closeMenuBtn').click();await page.locator('#menuBtn').click();await page.locator('[data-exit-game]').click();await page.locator('#continueBtn').click();await page.locator('.run-card').first().click();await page.waitForTimeout(200);
 if(!await page.locator('[data-return-story]').isVisible())throw Error('save lost expedition or return control');await page.locator('[data-return-story]').click();await page.waitForTimeout(250);
 const after=await page.evaluate(async()=>{const M=await import('./main.js?v=095');return M.readGameState()});if(after.scene!=='intro'||after.expedition.current!==after.expedition.origin||after.resourceWorld.stocks['forest:berries'].left!==2)throw Error('return replayed story or resources');
 console.log(JSON.stringify({suite:'map-ui',passed:true,before:{scene:before.scene,location:before.expedition.current},after:{scene:after.scene,stock:2},errors},null,2));if(errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
