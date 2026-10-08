const {inGame}=require('./browser.cjs');
inGame(async(page,errors)=>{
 const results=await page.evaluate(async()=>{
  const E=await import('./engine.js?v=096b'),X=await import('./expedition.js'),T=await import('./storage.js?v=096b'),W=await import('./world.js');
  const out=[],assert=(name,test)=>{if(!test)throw Error(name);out.push({name,passed:true})};
  const prepared=(chapter=1)=>{let s=E.createInitialState();s.scene=s.story.sceneId=`ch${chapter}_prepare`;s.chapter=s.story.chapter=chapter;s.world.location='хата баби Галі';s.world.environment='indoors';s.activeStatuses=[];s.resourceWorld={rngSeed:424242,stocks:{},traps:{},discovered:[]};return E.normalizeState(s)};
  let s=prepared();const original=JSON.stringify(s.story);s=X.travel(s,'yard').state;s=X.travel(s,'well').state;
  assert('travel changes time, needs and location while preserving story',s.clock.totalMinutes>400&&s.needs.energy<65&&X.currentLocation(s)==='well'&&JSON.stringify(s.story)===original);
  assert('forest is adjacent unknown until visited',!X.discoveredLocations(s).has('forest')&&X.travelOptions(s).some(x=>x.id==='forest'&&x.label==='Невідома стежка'));
  s=X.travel(s,'forest').state;assert('visiting reveals a saved place',X.discoveredLocations(s).has('forest'));
  for(let i=0;i<3;i++)s=X.performExpeditionAction(s,'gather:berries').state;const full=JSON.stringify(s);const r=X.performExpeditionAction(s,'gather:berries');assert('resource exhaustion rejects repeat with no time or reward',!r.accepted&&JSON.stringify(r.state)===full);
  s=X.returnToStory(s).state;s=X.travel(s,'yard').state;s=X.travel(s,'well').state;s=X.travel(s,'forest').state;assert('revisiting cannot refill stock',X.stock(s,'forest','berries')===0);
  const saved=JSON.stringify(s.resourceWorld);await T.saveRun(s);s=E.normalizeState(await T.loadRun(1));assert('travel, stock and actor survive reload',X.currentLocation(s)==='forest'&&JSON.stringify(s.resourceWorld)===saved);
  s.clock.totalMinutes+=720;assert('stock regeneration requires game time',X.stock(s,'forest','berries')===3);
  const day=X.travelOptions(s)[0].minutes;s.clock.totalMinutes=Math.floor(s.clock.totalMinutes/1440)*1440+1380;assert('night makes actual travel slower',X.travelOptions(s)[0].minutes>day);
  let b=prepared(6);b=W.syncActor(b);b.inventory=[];assert('pigeon has four slots and two kilograms',await import('./carry.js').then(C=>C.bagLimits(b).slots===4&&C.bagLimits(b).weight===2));
  E.addItem(b,'salo',5);assert('pigeon cannot carry an oversized resource bundle',!E.addItem(b,'wood',2));
  let c=prepared();c.inventory=[];E.addItem(c,'herbs');E.addItem(c,'cloth');const crafted=X.performExpeditionAction(c,'craft:bandage');assert('craft atomically consumes actual materials',crafted.accepted&&E.itemCount(crafted.state,'herbs')===0&&E.itemCount(crafted.state,'cloth')===0&&E.itemCount(crafted.state,'bandage')===1);
  const missing=X.performExpeditionAction(c,'craft:tea');assert('failed recipe cannot spend time',!missing.accepted&&missing.state.clock.totalMinutes===c.clock.totalMinutes);
  c=X.travel(c,'yard').state;const fire=X.performExpeditionAction(c,'craft:tea');assert('cooking requires actual fire location',!fire.accepted);
  let h=prepared(3);h=X.travel(h,'yard').state;h=X.travel(h,'well').state;h=X.travel(h,'bank').state;h.inventory=[];E.addItem(h,'trap');h=X.performExpeditionAction(h,'set-trap').state;const early=X.performExpeditionAction(h,'check-trap');assert('a trap needs elapsed time',!early.accepted&&h.resourceWorld.traps.bank);
  h.clock.totalMinutes+=90;h=X.performExpeditionAction(h,'check-trap').state;assert('trap returns tool and finite prey',E.itemCount(h,'trap')===1&&E.itemCount(h,'raw_meat')===1&&!h.resourceWorld.traps.bank&&X.stock(h,'bank','raw_meat')===1);
  h.health=1;h.needs={energy:0,water:0,satiety:0};const back=X.returnToStory(h);assert('exhausted return has a costly route and no soft lock',back.accepted&&back.state.health===1&&back.state.needs.energy===0&&!X.awayFromStory(back.state));
  h=prepared(7);h.scene=h.story.sceneId='ch7_intro100';h.world.location='білий туман';assert('chapter 7 cannot leave fog or reveal church',!X.canExplore(h)&&X.travelOptions(h).length===0&&!X.travel(h,'yard').accepted);
  c=prepared();c.authorSecret={kept:123};c.schemaVersion=12;c.inventory=[{id:'water',qty:30}];const migrated=E.normalizeState(c);assert('old overweight inventory and author fields survive migration',migrated.schemaVersion===13&&E.itemCount(migrated,'water')===30&&migrated.authorSecret.kept===123);
  return out;
 });
 console.log(JSON.stringify({suite:'expedition',results,errors},null,2));if(errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
