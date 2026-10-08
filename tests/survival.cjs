const {inGame}=require('./browser.cjs');
inGame(async(page,errors)=>{
 const results=await page.evaluate(async()=>{
  const E=await import('./engine.js?v=096b'),P=await import('./gameplay.js'),W=await import('./world.js'),T=await import('./storage.js?v=096b');const out=[];
  const assert=(b,m)=>{if(!b)throw Error(m)},check=async(name,fn)=>{try{await fn();out.push({name,passed:true})}catch(e){out.push({name,passed:false,error:e.message})}};
  function base(id='ch4_prepare'){let s=E.createInitialState(2);s.scene=s.story.sceneId=id;s.clock.totalMinutes=700;s.activeStatuses=[];s.health=60;s.inventory=[];s.money=0;s.needs={water:45,satiety:55,energy:40};s.world.environment='indoors';s.relationships.galina.known=true;s.relationships.galina.values.trust=5;return E.normalizeState(s)}
  await check('overnight with no money or items is available and costs real needs, not a fixed refill',()=>{
   const s=base(),r=P.advanceOvernight(s,'work');assert(r.accepted&&r.state.health>0&&r.state.clock.totalMinutes===2520,'night blocked or time wrong');assert(r.state.needs.water<72&&r.state.needs.satiety<72,'magic refill remains');assert(r.state.memories.galina.nightArrangement==='work','arrangement forgotten');
  });
  await check('four and eight hours of sleep produce different readiness at the same narrative time',()=>{const s=base(),a=P.advanceOvernight(s,'work').state,b=P.advanceOvernight(s,'watch').state;assert(a.clock.totalMinutes===b.clock.totalMinutes&&a.needs.energy>b.needs.energy,'sleep choice has no consequence')});
  await check('no payment means no overnight rewards or time; a completed night cannot repeat',()=>{const s=base(),r=P.advanceOvernight(s,'own');assert(!r.accepted&&r.state.clock.totalMinutes===700,'unpaid night succeeds');const a=P.advanceOvernight(s,'work').state;assert(!P.advanceOvernight(a,'work').accepted,'night farmable')});
  await check('weather and clothing affect outdoor costs; a sheltered night is protected from outdoor wind',()=>{
   const s=base('ch5_prepare');s.world.environment='outdoors';s.world.weather={tempC:8,wind:2,rain:2};s.equipment={};s.ownedClothes=[];s.wetness=60;const cold=E.executeAction(s,{minutes:20,activity:'walk'}).state;
   const warm=E.clone(s);warm.world.environment='indoors';const housed=E.executeAction(warm,{minutes:20,activity:'rest'}).state;assert(cold.needs.energy<housed.needs.energy&&cold.wetness>housed.wetness&&cold.activeStatuses.includes('cold'),'conditions cosmetic');assert(!housed.activeStatuses.includes('cold'),'outdoor wind blows through house');
  });
  await check('fall is always canonical but skill or preparation changes injury; re-entry cannot repeat damage',async()=>{
   const low=base('ch5_fall099c'),high=base('ch5_fall099c');high.flags.routePrepared=true;const a=P.entryGameplay(low,{id:low.scene}).state,b=P.entryGameplay(high,{id:high.scene}).state;assert(a.health<b.health&&b.activeStatuses.includes('bump'),'fall severity unchanged');await T.saveRun(b);const loaded=E.normalizeState(await T.loadRun(2));assert(P.entryGameplay(loaded,{id:loaded.scene}).state.health===b.health,'fall replayed after save');
  });
  await check('three earlier relationships or memories change a later cost',()=>{
   const early=base();early.relationships.galina.values.trust=5;const helped=P.advanceOvernight(early,'work').state;for(const s of[early,helped]){s.scene=s.story.sceneId='ch5_prepare';s.flags.storyUrgent099=false}assert(W.worldActions(helped).find(a=>a.id==='ask-water').minutes<W.worldActions(early).find(a=>a.id==='ask-water').minutes,'Galya forgot help');
   const plain=base('ch5_prepare'),polite=base('ch5_prepare');polite.flags.catFirstMeeting='polite';const choices=s=>P.supplementalScene(s.scene).choices(s).find(c=>c.id==='route-prep5');assert(choices(polite).minutes<choices(plain).minutes,'cat memory has no effect');
   const birdA=W.syncActor(base('ch6_intro099d')),birdB=E.clone(birdA);birdB.memories.world={sharedSupplies:{chapter:3}};assert(P.entryGameplay(birdB,{id:birdB.scene}).state.health>P.entryGameplay(birdA,{id:birdA.scene}).state.health,'shared food has no later effect');
  });
  await check('Darina help uses earlier attitude and remains hidden before the hood reveal',()=>{
   const good=base('ch7_shed_truth100'),bad=base('ch7_shed_truth100');for(const s of[good,bad]){s.flags.storyUrgent099=false;s.world.location='білий туман';s.flags.darinaRevealed100=true}
   good.relationships.hood.values.trust=8;bad.relationships.hood.values.trust=1;bad.relationships.hood.values.offense=8;
   const a=W.performWorldAction(good,'darina-care'),b=W.performWorldAction(bad,'darina-care');assert(a.accepted&&b.accepted&&a.state.health>b.state.health,'attitude ignored or poor relationship blocks help');bad.flags.darinaRevealed100=false;assert(!W.worldActions(bad).some(a=>a.id==='darina-care'),'identity spoiled');
  });
  await check('pigeon earns and spends his own development; Stepan inventory and progress return intact',()=>{
   let s=base('ch6_intro099d');const human=E.clone(s.heroProgression);s=W.syncActor(s);for(const id of['ch6_intro099d','ch6_prepare','ch6_end100'])s=P.entryGameplay(s,{id}).state;assert(s.companions.evpapiy.progression.points>=1,'bird has no upgrade');assert(E.spendEvpPoint(s,'attack'),'bird point cannot be spent');s.scene=s.story.sceneId='ch7_intro100';s=W.syncActor(s);assert(JSON.stringify(s.heroProgression)===JSON.stringify(human)&&s.inventory.length===0,'human profile polluted');
  });
  await check('exploration and repeated jobs share a finite chapter XP budget',()=>{let s=base();for(let i=0;i<100;i++)W.awardExplorationXp(s,10);assert(s.heroProgression.xp===20&&s.heroProgression.level===1,'repeat XP farming remains')});
  await check('an unfinished deal has both paid and penniless resolution',()=>{const s=base('ch3_prepare');s.flags.suspiciousDealConsequencePending=true;s.flags.storyUrgent099=false;s.world.location='хата баби Галі';const poor=W.performWorldAction(s,'settle-deal-work');assert(poor.accepted&&!poor.state.flags.suspiciousDealConsequencePending,'poor build blocked');s.money=8;const rich=W.performWorldAction(s,'settle-deal-money');assert(rich.accepted&&rich.state.money===4&&!rich.state.flags.suspiciousDealConsequencePending,'paid route wrong')});
  return out;
 });
 console.log(JSON.stringify({suite:'survival',results,errors},null,2));if(results.some(r=>!r.passed)||errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
