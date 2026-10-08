// v0.9.7b TEST hotfix – Chapter 4 test launcher.
// Starts chapter 4 directly from the test menu without the old reload race.
import {createInitialState,normalizeState} from './engine.js?v=096b';
import {clearRun,saveRun,loadRun} from './storage.js?v=096b';

const CH4_HISTORY=[
  'poop','galinaInside','galinaChanged','ch2_intro','ch2_figure',
  'ch3_creature','ch3_cat_intro095m','ch3_evp_returns'
];

function readTestConfig097a(){
  let cfg={};
  try{cfg=JSON.parse(localStorage.getItem('dnt-test-v096')||'{}')}catch{}
  cfg.statuses=[...document.querySelectorAll('[data-test-status096]:checked')]
    .map(x=>x.dataset.testStatus096).filter(Boolean);
  if(document.querySelector('#testScared')?.checked&&!cfg.statuses.includes('scared'))cfg.statuses.push('scared');
  cfg.all097=Boolean(document.querySelector('#testAll097')?.checked);
  cfg.sunset=Boolean(document.querySelector('#testSunset')?.checked);
  try{localStorage.setItem('dnt-test-v096',JSON.stringify(cfg))}catch{}
  return cfg;
}

function buildChapter4State097a(memory='vodka'){
  let s=createInitialState(99);
  s=normalizeState(s);
  s.chapter=4;
  s.scene='ch4_intro';
  s.story={chapter:4,sceneId:'ch4_intro',entered:[...CH4_HISTORY],finished:false};
  s.flags={
    ...s.flags,
    testMode:true,
    initialStatusPopupShown:true,
    mapUnlocked:true,
    shopUnlocked:true,
    chapter1Complete:true,
    chapter2Started:true,
    chapter2Complete:true,
    chapter3Complete:true,
    localClothes:true,
    catMet:true,
    catFirstMeeting:'polite',
    truposmerdNamed096:true,
    metPigeon:true,
    knowsPigeonName:true
  };
  s.companions.evpapiy.known=true;
  s.companions.evpapiy.active=true;
  s.companions.evpapiy.state='З вами';
  s.relationships.evpapiy.known=true;
  s.relationships.galina.known=true;

  delete s.flags.creatureVodkaFriend;
  delete s.flags.creatureGarlicUsed;
  delete s.flags.creaturePrayerReactionKnown095w;
  delete s.flags.creaturePrayerStalled095w;
  delete s.flags.shedBattleKnockout;

  if(memory==='vodka')s.flags.creatureVodkaFriend=true;
  if(memory==='garlic')s.flags.creatureGarlicUsed=true;
  if(memory==='prayer')s.flags.creaturePrayerReactionKnown095w=true;
  if(memory==='fight')s.flags.shedBattleKnockout=true;

  s=normalizeState(s);
  // Core versions before chapter 4 clamp chapters to 3. Force the test state back
  // to the actual chapter after every normalization.
  s.chapter=4;
  s.scene='ch4_intro';
  s.story={...(s.story||{}),chapter:4,sceneId:'ch4_intro',entered:[...new Set([...(s.story?.entered||[]),...CH4_HISTORY])],finished:false};
  s.flags={...s.flags,testMode:true,initialStatusPopupShown:true,localClothes:true,chapter3Complete:true};
  return s;
}

async function waitFor(selector,timeout=4000){
  const start=Date.now();
  while(Date.now()-start<timeout){
    const el=document.querySelector(selector);
    if(el)return el;
    await new Promise(r=>setTimeout(r,60));
  }
  return null;
}

async function launchChapter4097a(){
  const memory=document.querySelector('#testCh4Memory097')?.value||'vodka';
  readTestConfig097a();
  await clearRun(99);
  const state=buildChapter4State097a(memory);
  await saveRun(state);

  // Re-open the test menu so main.js creates a fresh “Продовжити тест” button
  // for the state we just saved. No page reload, so there is no timing race.
  document.querySelector('#testModeBtn')?.click();
  const continueBtn=await waitFor('#continueTestBtn');
  if(continueBtn){continueBtn.click();return;}

  // One retry in case the test panel was still rendering.
  document.querySelector('#testModeBtn')?.click();
  const retry=await waitFor('#continueTestBtn',2500);
  if(retry){retry.click();return;}

  alert('Тестовий сейв 4 глави створено, але меню не встигло відкритися. Натисни «Тест» → «Продовжити тест».');
}

function installChapter4Launcher097a(){
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('[data-test-ch4-097]');
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    launchChapter4097a();
  },true);

  // If an old broken chapter-4 test save exists, repair its chapter marker on load.
  setTimeout(async()=>{
    try{
      const old=await loadRun(99);
      const scene=String(old?.story?.sceneId||old?.scene||'');
      if(scene.startsWith('ch4_')&&Number(old?.chapter)!==4){
        old.chapter=4;
        old.story={...(old.story||{}),chapter:4,sceneId:scene};
        await saveRun(old);
      }
    }catch{}
  },0);
}

function stamp097a(){
  document.querySelectorAll('.version,.howto-version,.game-name span').forEach(el=>el.textContent='v0.9.7b TEST');
}

queueMicrotask(()=>{installChapter4Launcher097a();stamp097a()});
