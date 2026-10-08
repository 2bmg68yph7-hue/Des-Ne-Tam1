const {inGame}=require('./browser.cjs');
inGame(async(page,errors)=>{
 const results=await page.evaluate(async()=>{
  const E=await import('./engine.js?v=096b'),P=await import('./gameplay.js'),W=await import('./world.js'),T=await import('./storage.js?v=096b');
  const out=[],assert=(ok,m)=>{if(!ok)throw Error(m)};
  async function check(name,fn){try{await fn();out.push({name,passed:true})}catch(e){out.push({name,passed:false,error:e.message})}}
  const scene=id=>P.supplementalScene(id),prep=()=>{let s=E.createInitialState(1);s.scene=s.story.sceneId='ch1_prepare';return E.normalizeState(s)};
  await check('first chapter earns a spendable level; saving and re-entering cannot farm it',async()=>{
   let s=E.createInitialState(1);for(const id of ['intro','poop','galinaChanged','ch1_prepare'])s=P.entryGameplay(s,{id}).state;
   assert(s.heroProgression.points===1,'no first point');assert(E.spendHeroPoint(s,'charisma'),'point cannot be used');
   await T.saveRun(s);s=E.normalizeState(await T.loadRun(1));const before=JSON.stringify(s.heroProgression);s=P.entryGameplay(s,{id:'ch1_prepare'}).state;
   assert(JSON.stringify(s.heroProgression)===before&&s.stats.charisma.level===3,'save reset reward or stat');
  });
  await check('a penniless empty-bag character can obtain food; charisma changes the price',()=>{
   const low=prep(),high=prep();low.inventory=[];low.money=0;high.stats.charisma.level=5;high.activeStatuses=[];
   const a=scene(low.scene).choices(low).find(c=>c.id==='pack-food1'),b=scene(high.scene).choices(high).find(c=>c.id==='pack-food1');
   const r=E.executeAction(low,a);assert(r.accepted&&E.itemCount(r.state,'salo')>0,'low build blocked');assert(b.minutes<a.minutes,'charisma has no effect');assert(!scene(low.scene).choices(r.state).some(c=>c.id==='pack-food1'),'food can be farmed');
  });
  await check('attention changes the time needed for equipment and path checks',()=>{
   const low=prep(),high=prep();high.stats.attention.level=6;
   for(const id of ['ch1_prepare','ch2_prepare']){const a=scene(id).choices(low),b=scene(id).choices(high);const key=id==='ch1_prepare'?'check-kit1':'check-path2';assert(b.find(c=>c.id===key).minutes<a.find(c=>c.id===key).minutes,'no attention benefit')}
  });
  await check('preparation routes preserve the canonical destinations',()=>{
   const s=prep();assert(P.routeNext(s,'ch2_intro')==='ch1_prepare','missing first interlude');s.flags.preparation1Complete=true;assert(P.routeNext(s,'ch2_intro')==='ch2_intro','cannot leave');s.chapter=2;assert(P.routeNext(s,'ch2_pee')==='ch2_prepare','missing second interlude');s.flags.preparation2Complete=true;assert(P.routeNext(s,'ch2_pee')==='ch2_pee','cannot leave second interlude');
  });
  await check('canonical potion use consumes a dose exactly once',()=>{
   let s=prep();E.addItem(s,'potion_unknown',1);const before=E.itemCount(s,'potion_unknown');s=P.entryGameplay(s,{id:'ch2_side'}).state;assert(E.itemCount(s,'potion_unknown')===before-1,'dose retained');s=P.entryGameplay(s,{id:'ch2_side'}).state;assert(E.itemCount(s,'potion_unknown')===before-1,'second dose removed');
  });
  await check('a full tool bag has a reversible way to make room and recover a find',()=>{
   let s=prep();s.inventory=Array.from({length:16},()=>({id:'knife',qty:1}));s=E.executeAction(s,{effects:[{type:'itemAdd',id:'water',qty:1}]}).state;
   const dropped=W.leaveItem(s,'knife');assert(dropped.accepted&&dropped.state.inventory.length===15,'cannot make room');const r=W.performWorldAction(dropped.state,'collect-0');assert(r.accepted&&E.itemCount(r.state,'water')===1&&r.state.pendingLoot.some(l=>l.id==='knife'),'find or dropped tool lost');
  });
  await check('bird progression and recovery affect his own actor profile',()=>{
   let s=prep();s.scene=s.story.sceneId='ch6_yard099d';s.chapter=6;s=W.syncActor(s);s.health=20;s.companions.evpapiy.progression.points=1;
   assert(E.spendEvpPoint(s,'attack'),'bird cannot upgrade');s=W.syncActor(s);assert(s.stats.strength.level===2&&s.companions.evpapiy.hp===Math.round(s.companions.evpapiy.maxHp*.2),'bird stats or HP detached');
  });
  return out;
 });
 try{
  await page.evaluate(async()=>{const E=await import('./engine.js?v=096b'),T=await import('./storage.js?v=096b');let s=E.createInitialState(3);s.scene=s.story.sceneId='ch1_prepare';s.flags.initialStatusPopupShown=true;s.flags.packedFood1=s.flags.checkedEquipment1=true;s.heroProgression.points=1;await T.saveRun(s)});
  await page.locator('#continueBtn').click();await page.locator('.run-card').filter({hasText:'Проходження 3'}).click();
  await page.locator('.story-choice').filter({hasText:'Застосувати очко розвитку'}).click();await page.locator('[data-stat-upgrade="attention"]').click();await page.locator('#closeMenuBtn').click();
  await page.locator('.story-choice').filter({hasText:'Набрати воду'}).click();await page.waitForFunction(()=>!document.querySelector('#storyChoices').textContent.includes('Набрати воду'));
  await page.locator('.story-choice').filter({hasText:'Вийти з хати'}).click();await page.waitForFunction(()=>document.querySelector('#storyKicker').textContent.includes('ГЛАВА 2'));
  const s=await page.evaluate(async()=>{const M=await import('./main.js?v=095');return M.readGameState()});if(s.chapter!==2||s.scene!=='ch2_intro'||!s.flags.packedWater1||s.stats.attention.level!==3)throw Error('UI interlude failed');results.push({name:'actual UI spends a point, packs water and enters chapter 2',passed:true});
 }catch(e){results.push({name:'actual UI spends a point, packs water and enters chapter 2',passed:false,error:e.message})}
 console.log(JSON.stringify({suite:'preparation',results,errors},null,2));if(results.some(r=>!r.passed)||errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
