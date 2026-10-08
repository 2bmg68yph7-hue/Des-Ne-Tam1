const {inGame}=require('./browser.cjs');
inGame(async(page,errors)=>{
 const results=await page.evaluate(async()=>{
  const E=await import('./engine.js?v=096b'),W=await import('./world.js'),X=await import('./expedition.js'),C=await import('./encounters.js'),B=await import('./bird.js'),F=await import('./bird-config.js'),P=await import('./gameplay.js'),T=await import('./storage.js?v=096b');
  const out=[],assert=(name,test)=>{if(!test)throw Error(name);out.push({name,passed:true})};
  const prep=(bird=false)=>{let s=E.createInitialState();s.scene=s.story.sceneId=bird?'ch6_prepare':'ch3_prepare';s.chapter=s.story.chapter=bird?6:3;s.world.location='біля хати баби Галі';s.resourceWorld={rngSeed:424242,stocks:{},traps:{},discovered:[]};s.activeStatuses=[];s=W.syncActor(E.normalizeState(s));return s};
  let s=prep();s.needs.energy=0;s=C.startEncounter(s,'dog').state;
  assert('zero energy encounter always has guard and escape',C.encounterActions(s).some(a=>a.id==='flee'&&a.enabled)&&C.encounterActions(s).some(a=>a.id==='guard'&&a.enabled));
  const escaped=C.performEncounterAction(s,'flee');assert('escape clears encounter without story jump',escaped.outcome==='escaped'&&!escaped.state.expedition.encounter&&escaped.state.scene==='ch3_prepare');
  let hp=prep();hp.health=1;hp.inventory=[];hp=C.startEncounter(hp,'rustle').state;const defeat=C.performEncounterAction(hp,'guard');assert('defeat costs health, injury and energy with playable continuation',defeat.outcome==='defeat'&&defeat.state.health===1&&defeat.state.activeStatuses.includes('bump')&&!defeat.state.expedition.encounter);
  let win=prep();win.stats.strength.level=8;win=C.startEncounter(win,'dog').state;for(let i=0;i<8&&win.expedition.encounter;i++)win=C.performEncounterAction(win,'attack').state;assert('combat victory records own outcome and no canonical mutation',win.encounterHistory.at(-1).outcome==='win'&&win.scene==='ch3_prepare');
  let own=prep();own.inventory=[{id:'salo',qty:1}];own=C.startEncounter(own,'dog').state;const lure=C.performEncounterAction(own,'lure:salo');assert('food distraction consumes one physical item',lure.outcome==='escaped'&&E.itemCount(lure.state,'salo')===0);
  let persisted=prep();persisted=C.startEncounter(persisted,'rustle').state;persisted=C.performEncounterAction(persisted,'guard').state;await T.saveRun(persisted);const restored=E.normalizeState(await T.loadRun(1));assert('reload preserves exact encounter turn, HP and random state',JSON.stringify(restored.expedition.encounter)===JSON.stringify(persisted.expedition.encounter)&&restored.resourceWorld.rngSeed===persisted.resourceWorld.rngSeed);
  let bird=prep(true);bird.inventory=[];const humanProfile=JSON.stringify(bird.actors.stepan.profile);bird=B.performBirdAction(bird,'salo-steal').state;
  assert('Operation SALO gives bird a unique piece and own XP',E.itemCount(bird,'salo')===1&&bird.companions.evpapiy.quests.salo&&bird.companions.evpapiy.progression.xp===25);
  const serial=JSON.stringify(bird);const repeat=B.performBirdAction(bird,'salo-steal');assert('completed bird quest cannot duplicate reward or time',!repeat.accepted&&JSON.stringify(repeat.state)===serial);
  assert('bird supplies do not change human profile',JSON.stringify(bird.actors.stepan.profile)===humanProfile);
  bird.needs.satiety=80;bird=E.useItem(bird,'salo').state;assert('eating SALO actually makes flight unavailable',bird.activeStatuses.includes('birdOverfed')&&!F.canFly(bird));
  bird.clock.totalMinutes+=60;bird=E.normalizeState(bird);assert('food state expires by action clock',!bird.activeStatuses.includes('birdOverfed'));
  bird=E.executeAction(bird,{effects:[{type:'statusAdd',id:'birdWings'}]}).state;assert('injured wings survive wrapper normalization',E.normalizeState(bird).activeStatuses.includes('birdWings')&&!F.canFly(bird));
  const moved=X.travel(bird,'well');assert('injured bird has a ground route instead of soft lock',moved.accepted&&X.currentLocation(moved.state)==='well');
  bird=prep(true);bird.companions.evpapiy.progression.points=5;for(const id of Object.keys(F.BIRD_TALENTS))assert('talent '+id+' uses own point',F.spendBirdTalent(bird,id)&&F.talent(bird,id)===1);assert('human upgrade points stay separate',bird.actors.stepan.profile.heroProgression.points===0);
  bird=X.travel(bird,'well').state;bird=X.travel(bird,'forest').state;if(bird.expedition.encounter)bird=C.performEncounterAction(bird,'flee').state;
  // Direct encounter for the crow tests is tied to the optional quest.
  bird=C.startEncounter(bird,'crow','crow').state;bird.companions.evpapiy.talents.beak=3;bird.needs.energy=80;
  for(let i=0;i<8&&bird.expedition.encounter;i++)bird=B.resolveBirdEncounter(C.performEncounterAction(bird,'attack')).state;
  assert('crow victory gives recorded quest and functional glory',bird.companions.evpapiy.quests.crow&&bird.activeStatuses.includes('birdGlory'));
  let gossip=prep(true);gossip=X.travel(gossip,'wake').state;gossip=B.performBirdAction(gossip,'gossip').state;assert('eavesdropping records local knowledge without Darina reveal',gossip.companions.evpapiy.quests.gossip&&!gossip.flags.darinaRevealed100);
  gossip=X.returnToStory(gossip).state;if(!gossip.memories.evpapiy.reportVerified){gossip=X.travel(gossip,'well').state;gossip=B.performBirdAction(gossip,'check-report').state;gossip=X.returnToStory(gossip).state}
  gossip=B.performBirdAction(gossip,'report').state;assert('report requires actual delivery at Galyas yard',gossip.flags.birdReportDelivered&&gossip.memories.evpapiy.reportDelivered);
  gossip=P.entryGameplay(gossip,{id:'ch6_darina099d'}).state;assert('Darina learns delivered information after arrival only',gossip.flags.darinaLocalReportKnown&&!gossip.flags.darinaRevealed100);
  let human=prep();human.flags.darinaRevealed100=true;human.scene=human.story.sceneId='ch7_reveal100';human.chapter=human.story.chapter=7;human.world.location='білий туман';human.activeStatuses=['hangover'];human.stats.attention.level=1;human.stats.ahui.level=1;const a=W.worldActions(human).find(x=>x.id==='fog-markers');human.flags.darinaLocalReportKnown=true;const b=W.worldActions(human).find(x=>x.id==='fog-markers');assert('delivered local report helps later Stepan without teleporting loot',b.minutes<a.minutes&&!E.itemCount(human,'berries'));
  let poop=prep(true);poop.companions.evpapiy.talents={poop:1};poop.needs.energy=80;poop=C.startEncounter(poop,'crow').state;const before=poop.health;poop=C.performEncounterAction(poop,'poop').state;assert('poop ability spends energy and removes enemy attack',poop.needs.energy<80&&poop.health===before&&poop.expedition.encounter.blind>0&&!C.encounterActions(poop).some(x=>x.id==='poop'));
  return out;
 });
 console.log(JSON.stringify({suite:'bird-encounters',results,errors},null,2));if(errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
