const {inGame}=require('./browser.cjs');
inGame(async(page,errors)=>{
 const results=await page.evaluate(async()=>{
  const checks=[],assert=(name,value)=>{if(!value)throw Error(name);checks.push({name,passed:true})};
  const audioOriginal=window.Audio,instances=[];
  class MockAudio{constructor(){this.paused=true;this.readyState=1;instances.push(this)}addEventListener(){}pause(){this.paused=true}play(){this.paused=false;return new Promise(resolve=>this.complete=resolve)}}
  window.Audio=MockAudio;
  const {audioManager:a}=await import('./audio.js?async-test');a.unlock=async()=>true;
  const first=a.setAtmosphere('hut');await new Promise(r=>setTimeout(r,0));
  const second=a.setAtmosphere('rain');await new Promise(r=>setTimeout(r,0));
  assert('old background stops before next track plays',instances.filter(x=>!x.paused).length===1&&instances[0].paused);
  instances.forEach(x=>x.complete());await Promise.all([first,second]);
  assert('late play cannot revive retired background',a.ambientLayers.size===1&&instances[0].paused);
  await a.setAtmosphere('rain');assert('menu renders reuse one ambient track',instances.length===2);
  a.stopAll();const pending=a.setAtmosphere('hut');await new Promise(r=>setTimeout(r,0));await a.setEnabled(false);instances.at(-1).complete();await pending;
  assert('mute cancels pending playback',a.ambientLayers.size===0&&instances.every(x=>x.paused));a.stopAll();window.Audio=audioOriginal;
  const idbDescriptor=Object.getOwnPropertyDescriptor(window,'indexedDB');let request,closed=0;
  Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){request={};setTimeout(()=>request.onblocked?.(),0);return request}}});
  const T=await import('./storage.js?blocked-test');localStorage.setItem('blocked-test',JSON.stringify({updatedAt:1,marker:'kept'}));const started=performance.now();const raw=await T.persistentRead('blocked-test');
  assert('blocked IndexedDB falls back to intact local save',JSON.parse(raw).marker==='kept'&&performance.now()-started<500);
  request.result={close(){closed++}};request.onsuccess();assert('late database connection closes',closed===1);
  Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){return{}}}});
  const H=await import('./storage.js?hung-test');const now=performance.now();const saved=await H.persistentWrite('hung-test','safe');
  assert('unanswered database does not hang a save',saved.localStorage&&!saved.indexedDB&&performance.now()-now<2300);
  if(idbDescriptor)Object.defineProperty(window,'indexedDB',idbDescriptor);else delete window.indexedDB;
  return checks;
 });
 console.log(JSON.stringify({suite:'async-safety',results,errors},null,2));if(errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
