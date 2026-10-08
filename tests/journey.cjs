const {inGame}=require('./browser.cjs');
inGame(async(page,errors)=>{
 const strategy=process.env.DNT_ROUTE||'balanced',chapters=new Set(),visited=[],views=[];
 await page.addLocatorHandler(page.locator('#stateOverlay:not(.hidden)'),async()=>{
  for(let i=0;i<20&&await page.locator('#stateOverlay').isVisible();i++)await page.locator('#stateOkBtn').evaluate(e=>e.click());
 });
 await page.locator('#newGameBtn').click();await page.locator('.run-card').first().click();await page.locator('#beginGameBtn').click();
 for(let n=0;n<200;n++){
  const s=await page.evaluate(async()=>{const M=await import('./main.js?v=095');return M.readGameState()});visited.push(s.scene);chapters.add(s.chapter);
  if(s.health<=0)throw Error(`normal route died in ${s.scene}`);
  if(s.scene==='ch7_shed_truth100')break;
  if(await page.locator('#battleTestOverlay').isVisible()){
   const candidates=strategy==='garlic'?['knife','pray-continue','guard','dodge','brace']:['pray-continue','guard','dodge','brace'];let action;
   for(const a of candidates)if(await page.locator(`[data-battle-action="${a}"]:enabled`).count()){action=a;break}
   if(action){await page.locator(`[data-battle-action="${action}"]`).click();await page.waitForTimeout(2000)}
   else if(await page.locator('[data-battle-action="story-continue"]').count()){await page.locator('[data-battle-action="story-continue"]').click();await page.waitForTimeout(100)}
   else throw Error('battle has no usable action');
   continue;
  }
  const choice=await page.evaluate(async strategy=>{
   const E=await import('./engine.js?v=096b'),M=await import('./main.js?v=095'),P=await import('./gameplay.js');
   const sources=await Promise.all([1,2,3].map(i=>import(`./chapter${i}.js?v=096b`))),all=Object.assign({},...sources.map((b,i)=>b[`CHAPTER${i+1}_SCENES`]));
   const s=M.readGameState(),resolve=(v)=>typeof v==='function'?v(s):v,sc=P.supplementalScene(s.scene)||all[s.scene];
   const cs=(resolve(sc.choices)||[]).filter(c=>!c.showIf||c.showIf(s));
   const route=strategy==='vodka'?['inside_eat','well_salo','garlic_take','ch3_vodka','ch5_go_galina099c','night-work4','ch7_where100']:strategy==='garlic'?['inside_eat','well_ignore','garlic_take','ch3_garlic','ch5_go_galina099c','night-work4','ch7_real100']:['inside_eat','well_ignore','garlic_take','ch3_pray','ch5_go_galina099c','ch7_real100'];
   const preferred=cs.findIndex(c=>route.includes(c.id));if(preferred>=0)return preferred;
   function distance(id){const q=[[id,0]],seen=new Set();while(q.length){const[x,d]=q.shift();if(x==='ch7_shed_truth100')return d;if(seen.has(x))continue;seen.add(x);const scene=P.supplementalScene(x)||all[x];if(!scene)continue;let options=[];try{options=resolve(scene.choices)||[]}catch{}for(const c of options)for(const t of[c.next,c.battle?.nextOnWin,c.battle?.nextOnKnockout].filter(Boolean))q.push([t,d+1])}return Infinity}
   let best=-1,cost=Infinity;for(let i=0;i<cs.length;i++){const c=cs[i];if(c.menu)continue;const d=distance(c.next||c.battle?.nextOnWin||c.battle?.nextOnKnockout);if(d<cost){cost=d;best=i}}
   return best;
  },strategy);
  if(choice<0)throw Error(`no route onward from ${s.scene}`);
  await page.locator('.story-choice').nth(choice).click();await page.waitForTimeout(80);
  if(await page.locator('.battle-help095j button').count())await page.locator('.battle-help095j button').click();
  await page.waitForFunction(before=>document.querySelector('#battleTestOverlay')?.classList.contains('hidden')===false||JSON.parse(localStorage.getItem('des-ne-tam-v3:run:1:auto')||'{}').scene!==before,s.scene,{timeout:5000});
 }
 const final=await page.evaluate(async()=>{const M=await import('./main.js?v=095');return M.readGameState()});
 if(final.scene!=='ch7_shed_truth100'||chapters.size!==7||!final.flags.darinaRevealed100||!visited.includes('ch1_prepare')||!visited.includes('ch2_prepare'))throw Error('journey missed chapters, interludes or reveal');
 for(const size of[{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}]){
  await page.setViewportSize(size);await page.waitForTimeout(100);const v=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,ground:getComputedStyle(document.querySelector('#stageImage')).backgroundPosition,loaded:[...document.querySelectorAll('#stageImage img')].every(i=>i.naturalWidth>0)}));views.push(v);if(v.scrollWidth>v.width||!v.ground.split(', ').every(p=>p==='50% 100%')||!v.loaded)throw Error(`mobile scene broken: ${JSON.stringify(v)}`);
 }
 console.log(JSON.stringify({suite:'journey',strategy,passed:true,chapters:[...chapters],steps:visited.length,interludes:visited.filter(s=>s.endsWith('_prepare')),final:{scene:final.scene,health:final.health,needs:final.needs,progression:final.heroProgression},views,errors},null,2));if(errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
