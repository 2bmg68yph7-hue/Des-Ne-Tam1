const {inGame}=require('./browser.cjs');
const fs=require('node:fs'),path=require('node:path');
inGame(async(page,errors)=>{
 const views=[],out=path.resolve(__dirname,'../../../outputs/stage5-ui');fs.mkdirSync(out,{recursive:true});
 await page.addLocatorHandler(page.locator('#stateOverlay:not(.hidden)'),()=>page.locator('#stateOkBtn').evaluate(e=>e.click()));
 await page.locator('#newGameBtn').click();await page.locator('.run-card').first().click();await page.locator('#beginGameBtn').click();
 for(const size of[{width:320,height:568},{width:390,height:844},{width:430,height:932}]){
  await page.setViewportSize(size);
  for(const tab of['story','overview','hero','inventory','stats','states','needs','clothes','characters','relations','companions','place','map','journal','settings']){
   if(tab==='story'){await page.locator('#closeMenuBtn').evaluate(e=>e.click())}
   else {await page.locator('#menuBtn').evaluate(e=>e.click());if(tab!=='overview')await page.locator(`#menuContent [data-navigate="${tab}"]`).click()}
   await page.waitForTimeout(170);
   const v=await page.evaluate(tab=>{const root=tab==='story'?document.querySelector('#gameScreen'):document.querySelector('#menuContent');return{tab,width:innerWidth,documentWidth:document.documentElement.scrollWidth,contentWidth:root.scrollWidth,clientWidth:root.clientWidth,loaded:[...root.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)}},tab);
   if(v.documentWidth>v.width||v.contentWidth>v.clientWidth+1||!v.loaded)throw Error(JSON.stringify(v));views.push(v);
   await page.screenshot({path:path.join(out,`${size.width}-${tab}.png`)});
  }
 }
 await page.locator('#readingFont').selectOption('19');await page.locator('#soundEnabled').uncheck();await page.locator('#closeMenuBtn').click();await page.locator('#menuBtn').click();await page.locator('[data-navigate="settings"]').last().click();await page.waitForTimeout(200);
 if(await page.locator('#soundEnabled').isChecked()||await page.locator('#readingFont').inputValue()!=='19')throw Error('preferences lost');
 // A save from a future chapter cannot silently replay intro or mutate its scene.
 await page.evaluate(async()=>{const E=await import('./engine.js?v=096b'),T=await import('./storage.js?v=096b');const s=E.createInitialState(2);s.scene=s.story.sceneId='ch9_unknown';s.chapter=s.story.chapter=9;await T.saveRun(s)});
 await page.locator('#closeMenuBtn').click();await page.locator('#exitBtn').evaluate(e=>e.click());await page.locator('#continueBtn').click();await page.locator('.run-card').nth(1).click();await page.waitForTimeout(300);
 const unknown=await page.evaluate(async()=>({scene:(await import('./main.js?v=095')).readGameState().scene,text:document.querySelector('#storyText').textContent}));if(unknown.scene!=='ch9_unknown'||!unknown.text.includes('не підтримується'))throw Error('unknown scene lost');
 console.log(JSON.stringify({suite:'interface',passed:true,views,unknown,errors},null,2));if(errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
