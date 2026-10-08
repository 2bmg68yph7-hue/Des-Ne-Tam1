const {inGame}=require('./browser.cjs');
inGame(async(page,errors)=>{
 const result=await page.evaluate(async()=>{
  const E=await import('./engine.js?v=096b'),D=await import('./data.js?v=096b'),P=await import('./gameplay.js'),A=await import('./assets.js'),C=await import('./chapters.js'),I=await import('./interface.js');
  const modules=await Promise.all([1,2,3].map(i=>import(`./chapter${i}.js?v=096b`))),all=Object.assign({},...modules.map((m,i)=>m[`CHAPTER${i+1}_SCENES`]));for(let i=1;i<=6;i++)all[`ch${i}_prepare`]=P.supplementalScene(`ch${i}_prepare`);
  const issues=[],assets=new Set(),counts={},resolve=(v,s)=>typeof v==='function'?v(s):v;let choices=0;
  for(const [id,scene] of Object.entries(all)){
   const chapter=C.chapterOf({scene,story:{sceneId:id}});counts[chapter]=(counts[chapter]||0)+1;
   for(const variant of['low','prepared','angry','tired']){
    let s=E.createInitialState();s.scene=s.story.sceneId=id;s.chapter=s.story.chapter=chapter;s.activeStatuses=variant==='low'?[]:variant==='prepared'?[]:[variant];
    s.inventory=variant==='low'?[]:Object.keys(D.ITEM_DEFS).map(id=>({id,qty:2}));s.needs={energy:variant==='low'?0:80,water:60,satiety:60};s.health=variant==='low'?15:80;
    for(const stat of Object.values(s.stats))stat.level=variant==='prepared'?6:2;s.companions.evpapiy.known=s.companions.evpapiy.active=true;
    s.flags.metPigeon=s.flags.knowsPigeonName=s.flags.catMet=true;s.unlocks.prayer=true;s.flags.prayerUnlocked=true;s.unlocks.yebatorium=variant==='prepared';s.unlocks.sunsetContempt=variant==='prepared';
    try{
     const cs=(resolve(scene.choices,s)||[]).filter(c=>!c.showIf||c.showIf(s));choices+=cs.length;
     if(!scene.end&&!cs.length)issues.push(id+': no choices in '+variant);
     for(const c of cs)for(const next of[c.next,c.battle?.nextOnWin,c.battle?.nextOnKnockout,c.battle?.nextOnLose].filter(Boolean))if(!all[next])issues.push(id+': missing '+next);
     for(const actor of resolve(scene.actors||[],s)||[])if(actor.src)assets.add(A.asset(resolve(actor.src,s)));
     if(scene.background)assets.add(A.asset(scene.background));
     if(chapter===7&&['ch7_intro100','ch7_voice100','ch7_rules100'].includes(id)){
      const actors=resolve(scene.actors,s)||[];if(actors.some(a=>/darina.*(base|emotional|reveal)/.test(resolve(a.src,s))))issues.push(id+': face before reveal');
     }
    }catch(e){issues.push(id+': '+e.message)}
   }
  }
  for(const src of assets){const r=await fetch(src);if(!r.ok)issues.push('missing art: '+src)}
  const before=E.createInitialState();before.relationships.hood={known:true,values:{}};before.story.entered=['ch2_figure'];before.flags.darinaAppeared099d=true;
  if(I.knownCharacters(before).find(c=>c.id==='hood').name!=='Постать')issues.push('premature identity');before.flags.darinaRevealed100=true;
  const after=I.knownCharacters(before);if(after.filter(c=>c.name==='Дарина').length!==1||after.find(c=>c.id==='hood').name!=='Дарина')issues.push('duplicate Darina after reveal');
  if(issues.length)throw Error(JSON.stringify(issues));return{scenes:Object.keys(all).length,chapterCounts:counts,choiceEvaluations:choices,artFiles:assets.size,issues};
 });
 console.log(JSON.stringify({suite:'scene-registry',passed:true,...result,errors},null,2));if(errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
