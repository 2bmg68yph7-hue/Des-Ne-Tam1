import {mapMarkup} from './map-ui.js';
import {LOCATIONS} from './locations.js';
import {bagLimits,carriedWeight} from './carry.js';
import {canExplore,currentLocation,locationLabel,awayFromStory,expeditionActions,performExpeditionAction,travel,returnToStory} from './expedition.js';
import {asset} from './assets.js';
import {installInterface,updateMenuTitle,overviewMarkup,heroMarkup,charactersMarkup,relationsMarkup,relationshipHint,readingPreferences,saveReadingPreferences} from './interface.js';
import {CHAPTER_META,chapterOf} from './chapters.js';
import {exportBackup,importBackup,validateBackup} from './storage.js?v=096b';
import {syncActor,activeActor,worldActions,performWorldAction,leaveItem,awardExplorationXp,locationContext,PHASE_LABELS,timePhase} from './world.js';
import {supplementalScene,routeNext,entryGameplay,performGameplayChoice} from './gameplay.js';
import {STAT_KEYS,STAT_LABELS,STAT_DESCRIPTIONS} from './config.js?v=096b';
import {STATUS_DEFS,CLOTHES,ITEM_DEFS} from './data.js?v=096b';
import {createInitialState,normalizeState,formatTime,threatInfo,thermal,equipmentTotals,equip,statModifiers,effectiveStat,itemCount,assignQuickSlot,useItem,executeAction,previewAction,addItem,spendHeroPoint,spendEvpPoint,addHeroXp,addEvpXp} from './engine.js?v=096b';
import {listRuns,loadRun,saveRun,clearRun,saveManual,loadManual,listManual,saveChapterCheckpoint,loadChapterCheckpoint,listChapterCheckpoints,clearChapterCheckpointsAfter,emergencySaveRun,storageCapabilities} from './storage.js?v=096b';
import {audioManager} from './audio.js?v=096b';
import {getChapter1Scene,CHAPTER1_SCENES,resolveSceneValue} from './chapter1.js?v=096b';
import {getChapter2Scene,CHAPTER2_SCENES} from './chapter2.js?v=096b';
import {getChapter3Scene,CHAPTER3_SCENES} from './chapter3.js?v=096b';
import {openStoryBattle} from './battle.js?v=096b';

function getGameScene(state){
  const id=state?.story?.sceneId||state?.scene||'intro';
  return supplementalScene(id)||CHAPTER3_SCENES[id]||CHAPTER2_SCENES[id]||CHAPTER1_SCENES[id]||{id,chapter:chapterOf(state),unsupported:true,background:'./bg.jpg',caption:'ПОТРІБНЕ ОНОВЛЕННЯ',text:'Ця сцена ще не підтримується цією версією гри. Ваше проходження збережене. Оновіть гру або експортуйте сейв у налаштуваннях.',choices:[],end:true};
}

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const paras=t=>String(t||'').split('\n\n').map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');
const lowerFirst=s=>{s=String(s||'');return s?s[0].toLocaleLowerCase('uk-UA')+s.slice(1):s};

let G=null;
let actionBusy=false;
export function readGameState(){return G?JSON.parse(JSON.stringify(G)):null}
let currentTab='inventory';
let inventoryCategory='all';
let noticeQueue=[];
let noticeBusy=false;
let persistChain=Promise.resolve();
let sfxTimers=[];
let deathTimer=null;
let lastSleepMessage='';
const categories=['all','Їжа та напої','Ліки','Зброя','Якась хуйня','Матеріали'];

const TESTER_UNLOCK_KEY='des-ne-tam-tester-unlocked-v1';
const TESTER_CODE_HASH='58346b69699f6dadc90ed95b5dd126bc42de7130d6b8213d83bc5b0cf59e885d';
let testerTapCount=0;
let testerTapTimer=null;
function testerUnlocked(){return true}
function syncTesterAccess(){const b=$('#testModeBtn');if(!b)return;const on=testerUnlocked();b.classList.toggle('hidden',!on);b.setAttribute('aria-hidden',on?'false':'true')}
async function sha256Text(value){const bytes=new TextEncoder().encode(String(value||''));const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function tryUnlockTester(){return true}
function installTesterUnlock(){syncTesterAccess()}

const statFlavor={
  strength:{1:'Пока не Геракл.',2:'Ну, лавку вже не боїтесь.',3:'Вже можна шось важче за голуба.',4:'Може, двері самі відкриються.',5:'Село починає берегти меблі.'},
  attention:{1:'Шерлок з вас пока так собі.',2:'Шось таки помічаєте.',3:'Муху в супі вже не пропустите.',4:'Від вас хуй шо сховаєш.',5:'Бачите вже більше, ніж хотілось би.'},
  agility:{1:'Не навернулись – уже добре.',2:'Ноги вже іноді слухаються.',3:'Може, навіть втечете красиво.',4:'Болото перестає бути босом.',5:'Поки всі думають – ви вже зʼїбались.'},
  charisma:{1:'Викрутитись можете, але шанс мізерний.',2:'Вже не кожна розмова закінчується «йди нахуй».',3:'Можете даже когось переконати.',4:'Люди чомусь вас слухають.',5:'От тепер можна пиздіти впевнено.'},
  pofigism:{1:'Пока ше не всьо похуй.',2:'Уже трохи легше дивитись на піздєц.',3:'«Ну і хуй з ним» працює частіше.',4:'Вас уже важко здивувати.',5:'Майже духовне просвітлення.'},
  ahui:{1:'Ви тільки починаєте ахуєвати.',2:'Дивна хуйня вже не дивує кожні пʼять хвилин.',3:'Починаєте приймати правила цього дурдому.',4:'Самі вже звучите як місцевий.',5:'Ще трохи – і нормальне життя здасться дивним.'}
};

function statFlavorText(key,level){return statFlavor[key]?.[level]||`Рівень ${level}. Ше є куди рости.`}

function toast(title,text=''){
  const e=$('#toast');
  e.innerHTML=`<b>${esc(title)}</b>${text?`<span>${esc(text)}</span>`:''}`;
  e.classList.remove('hidden');
  clearTimeout(e._t);
  e._t=setTimeout(()=>e.classList.add('hidden'),2400);
}

function statusEffectText(id){
  const d=STATUS_DEFS[id];
  if(!d)return'';
  const parts=[];
  for(const [key,value] of Object.entries(d.mods||{})){
    if(!value)continue;
    parts.push(`${String(STAT_LABELS[key]||key).toLocaleLowerCase('uk-UA')} ${value>0?'+':''}${value}`);
  }
  for(const extra of d.extraEffects||[])parts.push(lowerFirst(extra).replace(/[.]$/,''));
  return parts.join(', ');
}

function queueState(id){if(!STATUS_DEFS[id])return;noticeQueue.push(id);pumpState()}
function pumpState(){
  if(noticeBusy||!noticeQueue.length)return;
  noticeBusy=true;
  const id=noticeQueue.shift(),original=STATUS_DEFS[id],d=activeActor(G)==='evpapiy'?{...original,portrait:'./pigeon_base_095b.webp'}:original,effects=statusEffectText(id);
  $('#statePopup').innerHTML=`${d.portrait?`<img src="${d.portrait}" class="state-popup-img" alt="">`:''}<h2>${esc(d.name)}</h2><p>${esc(d.blurb||'')}</p>${effects?`<div class="state-popup-effect"><b>ефект:</b> ${esc(effects)}</div>`:''}<div class="state-popup-remove"><b>як позбутись:</b> ${esc(d.remove||'')}</div>`;
  $('#stateOverlay').classList.remove('hidden');
  $('#stateOverlay').setAttribute('aria-hidden','false');
}
function closeState(){noticeBusy=false;$('#stateOverlay').classList.add('hidden');$('#stateOverlay').setAttribute('aria-hidden','true');pumpState()}
function notifyEvents(events){
  for(const e of events||[]){
    if(e.type==='itemAdd'&&e.ok)toast('ОТРИМАНО',`${ITEM_DEFS[e.id]?.name||e.id} ×${e.qty||1}`);
    if((e.type==='damage'||e.type==='health')&&e.actual<0&&e.visible!==false)toast('ЗДОРОВ’Я',`${Math.round(e.actual)}%`);
    if(e.type==='lootPending')toast('РЮКЗАК ПОВНИЙ','Знахідку можна забрати в розділі «Місце», коли звільните місце.');
    if(e.type==='statusAdded')queueState(e.id);
    if(e.type==='statusRemoved')toast('СТАН ЗНЯТО',STATUS_DEFS[e.id]?.name||e.id);
    if(e.type==='heroXp'&&e.visible!==false)toast('ДОСВІД',`+${e.actual} XP`);
    if(e.type==='heroLevelUp')toast('НОВИЙ РІВЕНЬ ГЕРОЯ',`Рівень ${e.level} · +1 очко прокачки`);
    if(e.type==='evpLevelUp')toast('ЄВПАПІЙ ПІДНЯВ РІВЕНЬ',`Рівень ${e.level} · +1 очко прокачки`);
  }
}

function heroForClothes(){
  if(activeActor(G)==='evpapiy')return asset('./pigeon_base_095b.webp');
  if(G?.flags?.localClothes)return './man_local.png';
  if(G?.activeStatuses?.includes('scared'))return './man_worry.png';
  if(G?.activeStatuses?.includes('tired'))return './man_tired.png';
  if(G?.activeStatuses?.includes('pigeonHumiliated'))return './man_angry.png';
  return './man_base.png';
}

function persist(){
 if(!G)return Promise.resolve();const snapshot=JSON.parse(JSON.stringify(G));
 persistChain=persistChain.then(()=>saveRun(snapshot)).then(result=>{if(G?.runId===snapshot.runId)G.lastAutosaveAt=result.at;return result}).catch(error=>{
   const saved=emergencySaveRun(snapshot);toast(saved?'РЕЗЕРВНИЙ СЕЙВ':'НЕ ВДАЛОСЯ ЗБЕРЕГТИ',saved?'Стан збережено в браузері.':'Експортуйте проходження перед закриттям гри.');console.warn('Save failed',error);return{localStorage:saved,indexedDB:false};
 });return persistChain;
}
function show(screen){if(screen!=='gameScreen'){clearSfx();noticeQueue=[];noticeBusy=false;$('#stateOverlay').classList.add('hidden');closeMenu();audioManager.stopAll()}for(const id of ['startScreen','howToScreen','gameScreen'])$('#'+id).classList.add('hidden');$('#'+screen).classList.remove('hidden')}

function askConfirm({title='Почати заново?',text='',okText='Так, почати заново'}={}){
  return new Promise(resolve=>{
    const overlay=$('#confirmOverlay'),ok=$('#confirmOkBtn'),cancel=$('#confirmCancelBtn');
    $('#confirmTitle').textContent=title;
    $('#confirmText').textContent=text;
    ok.textContent=okText;
    const finish=value=>{
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden','true');
      ok.onclick=null;cancel.onclick=null;overlay.onclick=null;
      resolve(value);
    };
    ok.onclick=()=>finish(true);
    cancel.onclick=()=>finish(false);
    overlay.onclick=e=>{if(e.target===overlay)finish(false)};
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden','false');
  });
}

function createChapterState(run,chapter){
  const s=createInitialState(run);
  s.flags.initialStatusPopupShown=true;
  if(chapter===1)return normalizeState(s);

  s.chapter=chapter;
  s.story={chapter,sceneId:CHAPTER_META[chapter].scene,entered:[],finished:false};
  s.scene=CHAPTER_META[chapter].scene;
  s.flags.metPigeon=true;
  s.flags.knowsPigeonName=true;
  s.relationships.evpapiy.known=true;

  if(chapter>=2){
    s.flags.mapUnlocked=true;
    s.flags.shopUnlocked=true;
    s.flags.chapter1Complete=true;
    s.companions.evpapiy.known=true;
    s.companions.evpapiy.active=true;
    s.companions.evpapiy.state='З вами';
  }

  if(chapter>=3){
    s.flags.chapter2Started=true;
    s.flags.chapter2Complete=true;
    s.activeStatuses=['scared'];
    s.discoveredStatuses=['hangover','scared'];
    s.statusTimers={scared:s.clock.totalMinutes+20};
    s.flags.scaredMigration091=true;
    const salo=s.inventory.find(x=>x.id==='salo');
    if(salo)salo.qty=Math.min(5,Number(salo.qty||0)+1);
    else s.inventory.push({id:'salo',qty:1});
    if(!s.inventory.some(x=>x.id==='water'))s.inventory.push({id:'water',qty:1});
  }
  return normalizeState(s);
}

async function renderStart(mode='home'){
  if(mode==='test'&&!testerUnlocked())mode='home';
  show('startScreen');
  syncTesterAccess();
  document.body.classList.remove('menu-open');
  closeDeathOverlay();
  G=null;
  audioManager.setAtmosphere('silent');
  const runs=await listRuns();
  const root=$('#runPicker');
  const actions=$('#startActions');
  root.innerHTML='';
  root.classList.toggle('hidden',mode==='home');
  actions.classList.toggle('hidden',mode!=='home');

  const addHead=(title,back='home')=>{
    const head=document.createElement('div');head.className='run-picker-head';head.innerHTML=`<b>${esc(title)}</b><button class="ghost tiny" data-back-start>Назад</button>`;root.appendChild(head);head.querySelector('[data-back-start]').onclick=()=>renderStart(back);return head;
  };
  const runCard=(run,state,onClick,label='')=>{const tm=state?formatTime(state.clock.totalMinutes):null;const b=document.createElement('button');b.className='run-card';b.innerHTML=`<b>Проходження ${run}</b><span>${state?`Глава ${state.chapter} · ${tm.time}`:'Порожньо'}${label?` · ${esc(label)}`:''}</span>`;b.onclick=onClick;root.appendChild(b)};

  if(mode==='new'){
    addHead('Нове проходження');
    for(const r of runs){const st=r.state?normalizeState(r.state):null;runCard(r.run,st,()=>startNew(r.run))}
  }else if(mode==='continue'){
    addHead('Продовжити');
    let shown=0;for(const r of runs){if(!r.state)continue;shown++;const st=normalizeState(r.state);runCard(r.run,st,()=>continueRun(r.run,st))}
    if(!shown)root.insertAdjacentHTML('beforeend','<div class="empty-state">Ще нема жодного сейву.</div>');
  }else if(mode==='chapters'){
    addHead('Глави');
    const grid=document.createElement('div');grid.className='chapter-grid';
    for(const chapter of Object.keys(CHAPTER_META).map(Number)){
      let checkpointCount=0,continueCount=0;
      for(const r of runs){if(chapter===1||await loadChapterCheckpoint(r.run,chapter))checkpointCount++;if(r.state&&normalizeState(r.state).chapter===chapter)continueCount++}
      const card=document.createElement('article');card.className='chapter-card';
      card.innerHTML=`<div><b>${CHAPTER_META[chapter].title}</b><span>${chapter===1?'Початок гри':'Збережений початок глави'}</span></div><div class="chapter-card-actions"><button type="button" data-chapter-new="${chapter}" ${checkpointCount?'':'disabled'}>${chapter===1?'Нова гра':'Почати главу заново'}</button><button type="button" data-chapter-continue="${chapter}" ${continueCount?'':'disabled'}>Продовжити</button></div>`;
      grid.appendChild(card);
    }
    root.appendChild(grid);
    root.querySelectorAll('[data-chapter-new]').forEach(b=>b.onclick=()=>renderStart(`chapter-new-${b.dataset.chapterNew}`));
    root.querySelectorAll('[data-chapter-continue]').forEach(b=>b.onclick=()=>renderStart(`chapter-continue-${b.dataset.chapterContinue}`));
  }else if(mode.startsWith('chapter-new-')||mode.startsWith('chapter-continue-')){
    const isNew=mode.startsWith('chapter-new-'),chapter=Number(mode.split('-').pop());addHead(`${CHAPTER_META[chapter].title} · ${isNew?(chapter===1?'Нова гра':'Почати заново'):'Продовжити'}`,'chapters');let shown=0;
    for(const r of runs){const st=r.state?normalizeState(r.state):null;if(isNew&&chapter>1&&!(await loadChapterCheckpoint(r.run,chapter)))continue;if(!isNew&&(!st||st.chapter!==chapter))continue;shown++;runCard(r.run,st,()=>isNew?startFromChapter(r.run,chapter):continueRun(r.run,st),isNew&&chapter>1?'чекпойнт глави':'')}
    if(!shown)root.insertAdjacentHTML('beforeend','<div class="empty-state">Тут поки нема відповідного сейву.</div>');
  }else if(mode==='saves'){
    addHead('Збереження');
    for(const r of runs){const section=document.createElement('div');section.className='start-save-group';const manual=await listManual(r.run);section.innerHTML=`<div class="start-save-title"><b>Проходження ${r.run}</b><span>${r.state?`автосейв · глава ${normalizeState(r.state).chapter}`:'автосейву нема'}</span></div><div class="start-save-slots">${manual.map(x=>`<button type="button" data-start-manual="${r.run}:${x.slot}" ${x.state?'':'disabled'}><b>Слот ${x.slot}</b><span>${x.state?`Глава ${normalizeState(x.state).chapter}`:'Порожньо'}</span></button>`).join('')}</div>`;root.appendChild(section)}
    root.querySelectorAll('[data-start-manual]').forEach(b=>b.onclick=async()=>{const [run,slot]=b.dataset.startManual.split(':').map(Number),st=await loadManual(run,slot);if(await loadManualState(run,st)){show('gameScreen');await renderGame()}});
  }else if(mode==='test'){
    addHead('Тестовий сейв');
    const saved=await loadRun(99);
    root.insertAdjacentHTML('beforeend',`<div class="test-mode-panel"><div class="info-card">Окремий тестовий сейв. Нормальні проходження 1–3 він не чіпає.</div>${saved?'<button type="button" class="big" id="continueTestBtn">Продовжити тест</button>':''}<div class="test-chapters"><button data-test-chapter="1">Глава 1</button><button data-test-chapter="2">Глава 2</button><button data-test-chapter="3">Глава 3</button></div><div class="test-options"><label><input type="checkbox" id="testAllItems" checked> Дати тестові предмети</label><label><input type="checkbox" id="testPrayer" checked> Відкрити молитву</label><label><input type="checkbox" id="testSunset" checked> Відкрити ЗАКАТ ПРЄЗРЄНІЯ</label><label><input type="checkbox" id="testScared"> Дати ОБСЕРУНЬКАВСЯ ВІД СТРАХУ</label></div></div>`);
    $('#continueTestBtn')?.addEventListener('click',()=>continueRun(99,normalizeState(saved)));
    root.querySelectorAll('[data-test-chapter]').forEach(b=>b.onclick=()=>startTestChapter(Number(b.dataset.testChapter),{allItems:$('#testAllItems').checked,prayer:$('#testPrayer').checked,sunset:$('#testSunset').checked,scared:$('#testScared').checked}));
  }

  const cap=await storageCapabilities();const storage=$('#storageStatus');if(cap.readBack){storage.textContent='';storage.classList.add('hidden')}else{storage.textContent='Є проблема зі збереженням у цьому браузері.';storage.classList.remove('hidden')}
  if(mode==='home')renderBackupControls(actions);
}

async function startFromChapter(run,chapter){
  if(chapter===1)return startNew(run);
  const checkpoint=await loadChapterCheckpoint(run,chapter);
  if(!checkpoint){toast('НЕМА ЧЕКПОЙНТА',`Спочатку треба реально дійти до ${CHAPTER_META[chapter].title.toLocaleLowerCase('uk-UA')}.`);return}
  const old=await loadRun(run);
  if(old){const ok=await askConfirm({title:`Почати ${CHAPTER_META[chapter].title.toLocaleLowerCase('uk-UA')} заново?`,text:'Повернемось до стану, з яким ви вперше зайшли в цю главу. Усі наслідки попередніх глав лишаться.',okText:'Так, почати главу'});if(!ok)return}
  G=normalizeState({...checkpoint,runId:run});await clearChapterCheckpointsAfter(run,chapter);await saveRun(G);show('gameScreen');await renderGame();
}

async function startNew(run){
  const old=await loadRun(run);
  if(old){const ok=await askConfirm({title:`Стерти проходження ${run}?`,text:'Цей сейв буде видалено, і гра почнеться з самого початку.',okText:'Так, почати заново'});if(!ok)return}
  await clearRun(run);G=createInitialState(run);await saveRun(G);await saveChapterCheckpoint(G,1);show('howToScreen');
}

async function startTestChapter(chapter,opts={}){
  if(!testerUnlocked()){await renderStart('home');return}
  await clearRun(99);G=createChapterState(99,chapter);G.flags.testMode=true;G.flags.initialStatusPopupShown=true;
  if(opts.allItems){for(const [id,qty] of [['water',2],['salo',2],['vodka',2],['knife',1],['garlic',3],['onion',2],['onion_angry',1],['onion_smelly',1],['medkit',2]]){const cur=G.inventory.find(x=>x.id===id);if(cur)cur.qty=Math.max(cur.qty,qty);else G.inventory.push({id,qty})}}
  if(opts.prayer){G.flags.prayerUnlocked=true;G.unlocks.prayer=true}
  if(opts.sunset){G.unlocks.sunsetContempt=true;G.flags.evpapiySaloGivenCount=2;G.flags.evpapiyEnemyConflictCount=1}
  if(opts.scared){if(!G.activeStatuses.includes('scared'))G.activeStatuses.push('scared');if(!G.discoveredStatuses.includes('scared'))G.discoveredStatuses.push('scared');G.statusTimers.scared=G.clock.totalMinutes+20}else{G.activeStatuses=G.activeStatuses.filter(x=>x!=='scared');delete G.statusTimers.scared;G.flags.scaredMigration091=true}
  G.heroProgression.points=Math.max(5,Number(G.heroProgression.points||0));if(G.companions?.evpapiy?.progression)G.companions.evpapiy.progression.points=Math.max(5,Number(G.companions.evpapiy.progression.points||0));
  G=normalizeState(G);await saveRun(G);await saveChapterCheckpoint(G,chapter);show('gameScreen');await renderGame();
}

async function continueRun(run,state){
  if(!state){toast('НЕМА СЕЙВУ','Тут ще нема проходження.');return}
  G=normalizeState({...state,runId:run});show('gameScreen');await renderGame();
}

async function loadManualState(run,raw){
  if(!raw)return false;
  const savedCheckpoint=raw.__chapterCheckpoint?JSON.parse(JSON.stringify(raw.__chapterCheckpoint)):null;
  const clean=JSON.parse(JSON.stringify(raw));delete clean.__chapterCheckpoint;
  G=normalizeState({...clean,runId:run});
  await clearChapterCheckpointsAfter(run,G.chapter);
  if(savedCheckpoint&&chapterOf(savedCheckpoint)===G.chapter){savedCheckpoint.runId=run;await saveChapterCheckpoint(savedCheckpoint,G.chapter)}
  else if(!await loadChapterCheckpoint(run,G.chapter)&&G.health>0)await saveChapterCheckpoint(G,G.chapter);
  await saveRun(G);return true;
}

async function beginGame(){
  show('gameScreen');await renderGame();if(!G.flags.initialStatusPopupShown){G.flags.initialStatusPopupShown=true;await persist();queueState('hangover')}
}

function clearSfx(){for(const t of sfxTimers)clearTimeout(t);sfxTimers=[]}
async function ensureSceneEntered(scene){
  if(scene.unsupported)return false;
  const id=scene.id;
  const chapter=Number(scene.chapter||G.chapter||1);
  G.chapter=chapter;G.story.chapter=chapter;
  if(G.story.entered.includes(id))return false;
  const checkpoint=await loadChapterCheckpoint(G.runId,chapter);
  if(!checkpoint)await saveChapterCheckpoint(G,chapter);
  G.story.entered.push(id);
  const world=resolveSceneValue(scene.world||[],G)||[];
  const onEnter=resolveSceneValue(scene.onEnter||[],G)||[];
  const r=executeAction(G,{id:`enter_${id}`,effects:[...world,...onEnter]});
  G=r.state;
  const gameplay=entryGameplay(G,scene);G=gameplay.state;
  G.story.entered=[...new Set([...G.story.entered,id])];
  G.story.sceneId=id;G.scene=id;
  notifyEvents(r.events);
  notifyEvents(gameplay.events);
  clearSfx();
  for(const fx of scene.sfxOnEnter||[])sfxTimers.push(setTimeout(()=>audioManager.playEffect(fx.id,{volume:fx.volume||1}),fx.delay||0));
  await persist();
  return true;
}
function syncSceneAudio(scene){const place=G&&awayFromStory(G)?LOCATIONS[currentLocation(G)]:null;audioManager.setAtmosphere(place?(place.indoors?'hut':G.world.weather.rain>0?'rain':'village'):scene?.atmosphere||'silent')}
async function renderGame(){
  if(!G)return;
  G=normalizeState(syncActor(normalizeState(G)));
  if(G.pendingBattle&&G.health>0){
    const options=G.pendingBattle.options;
    const result=await openStoryBattle(G,options);G=normalizeState(result.state);notifyEvents(result.events);
    const next=result.outcome==='knockout'?options.nextOnKnockout:result.outcome==='lose'?options.nextOnLose:options.nextOnWin;
    delete G.pendingBattle;if(next&&G.health>0)G.scene=G.story.sceneId=next;
    await persist();return renderGame();
  }
  let scene=getGameScene(G);
  await ensureSceneEntered(scene);
  scene=getGameScene(G);
  if(awayFromStory(G)){audioManager.setAtmosphere(LOCATIONS[currentLocation(G)].indoors?'hut':G.world.weather.rain>0?'rain':'village')}else syncSceneAudio(scene);
  renderHeader();renderStage(scene);renderStory(scene);renderQuickSlots();renderActiveStates();
  if(!$('#menuOverlay').classList.contains('hidden'))renderMenu();
  if(G.health<=0){clearTimeout(deathTimer);deathTimer=setTimeout(()=>openDeathOverlay(),1600)}else closeDeathOverlay();
}

function closeDeathOverlay(){
  clearTimeout(deathTimer);deathTimer=null;const o=$('#deathOverlay');if(!o)return;o.classList.add('hidden');o.setAttribute('aria-hidden','true');$('#deathManualSaves')?.classList.add('hidden');
}

async function openDeathOverlay(){
  if(!G||G.health>0)return;const o=$('#deathOverlay');if(!o)return;const chapter=Number(G.chapter||1),checkpoint=await loadChapterCheckpoint(G.runId,chapter),manual=await listManual(G.runId);o.classList.remove('hidden');o.setAttribute('aria-hidden','false');
  const restart=$('#deathChapterBtn');restart.disabled=!checkpoint;restart.textContent=checkpoint?`Почати главу ${chapter} заново`:'Нема чекпойнта цієї глави';
  const box=$('#deathManualSaves');box.innerHTML=manual.map(x=>`<button type="button" data-death-load="${x.slot}" ${x.state?'':'disabled'}><b>Слот ${x.slot}</b><span>${x.state?`Глава ${normalizeState(x.state).chapter}`:'Порожньо'}</span></button>`).join('');
  box.querySelectorAll('[data-death-load]').forEach(b=>b.onclick=async()=>{const run=G.runId,st=await loadManual(run,Number(b.dataset.deathLoad));if(!await loadManualState(run,st))return;closeDeathOverlay();show('gameScreen');await renderGame();toast('ЗАВАНТАЖЕНО',`Слот ${b.dataset.deathLoad}`)});
  $('#deathManualBtn').onclick=()=>box.classList.toggle('hidden');
  restart.onclick=async()=>{if(!checkpoint)return;G=normalizeState({...checkpoint,runId:G.runId});await clearChapterCheckpointsAfter(G.runId,chapter);await saveRun(G);closeDeathOverlay();show('gameScreen');await renderGame()};
  $('#deathMenuBtn').onclick=async()=>{closeDeathOverlay();await renderStart('home')};
}

function renderHeader(){
  const tm=formatTime(G.clock.totalMinutes),w=G.world.weather,t=thermal(G),th=threatInfo(G);
  $('#timeLine').textContent=`День ${tm.day} · ${tm.time} · ${PHASE_LABELS[timePhase(G)]}`;
  $('#weatherLine').textContent=`${w.icon} ${w.label} ${w.tempC}° · ${t.feel}`;
  $('#threatLine').textContent=`Небезпека: ${th.label}`;
  $('#threatLine').className=`threat ${th.key}`;
  const vals=[['❤️',G.health,'Здоровʼя'],['🍞',G.needs.satiety,'Ситість'],['💧',G.needs.water,'Вода'],['⚡',G.needs.energy,'Бадьорість']];
  $('#miniNeeds').innerHTML=vals.map(([i,v,label])=>`<span class="${v<=20?'critical':''}" title="${label}" aria-label="${label}: ${Math.round(v)}%">${i} ${Math.round(v)}%<i><b style="width:${Math.max(0,Math.min(100,v))}%"></b></i></span>`).join('');
}

function renderStage(scene){
  $('#stageContext').innerHTML=`<span>${esc(locationLabel(G))}</span><span>${activeActor(G)==='evpapiy'?'Євпапій':'Степан'}</span>`;
  if(awayFromStory(G)){const place=LOCATIONS[currentLocation(G)];scene={...scene,background:asset(place.bg),actors:[{src:heroForClothes(),role:activeActor(G)==='evpapiy'?'pigeon':'hero'}]}}
  const root=$('#stageImage');
  root.style.backgroundImage=`linear-gradient(rgba(5,8,6,.05),rgba(5,8,6,.16)),url('${asset(scene.background||'./bg.jpg')}')`;
  root.className=`stage-image ${scene.stageTone||''}`;
  if(scene.chapter===7)root.style.setProperty('background-position','center bottom','important');else root.style.removeProperty('background-position');
  const actors=resolveSceneValue(scene.actors||[],G)||[];
  root.innerHTML=actors.map((a,i)=>{const src=asset(resolveSceneValue(a.src,G));return `<img src="${src}" class="actor ${esc(a.role||'')} ${esc(a.position||'')} actor-${i}" alt="">`}).join('');
}

function resolveChoices(scene){const xs=resolveSceneValue(scene.choices||[],G)||[];return xs.filter(c=>c&&(!c.showIf||c.showIf(G)))}
async function choose(choice){
  if(!G||G.health<=0||actionBusy)return;
  if(choice.menu){openMenu(choice.menu);return}
  if(awayFromStory(G)){toast('ПОВЕРНІТЬСЯ ДО РОЗМОВИ','Завершіть дослідження через карту.');return}
  actionBusy=true;
  try{
  await audioManager.unlock();
  const r=performGameplayChoice(G,choice);
  if(r.accepted===false){toast('ДІЯ НЕДОСТУПНА','Для цієї дії бракує ресурсу. Оберіть інший спосіб.');return}
  G=r.state;notifyEvents(r.events);

  if(choice.battle&&G.health>0){
    G.pendingBattle={options:choice.battle};
    await persist();
    const result=await openStoryBattle(G,choice.battle);
    if(result?.state)G=normalizeState(result.state);if(result?.events)notifyEvents(result.events);
    const next=result?.outcome==='knockout'?choice.battle.nextOnKnockout:result?.outcome==='lose'?choice.battle.nextOnLose:choice.battle.nextOnWin;
    if(next){G.story.sceneId=next;G.scene=next}
    await persist();await renderGame();window.scrollTo({top:0,behavior:'instant'});
    return;
  }

  if(choice.next&&G.health>0){delete G.expedition;const next=routeNext(G,choice.next);G.story.sceneId=next;G.scene=next}
  await persist();await renderGame();window.scrollTo({top:0,behavior:'instant'});
}finally{actionBusy=false}
}

function renderStory(scene){
  if(awayFromStory(G)){const place=LOCATIONS[currentLocation(G)];$('#storyKicker').textContent='ДОСЛІДЖЕННЯ · '+place.label;$('#storyText').innerHTML=paras(place.description);$('#storyExtras').innerHTML='';$('#storyChoices').innerHTML='<button class=story-choice data-explore-place>Дослідити місце</button><button class=story-choice data-explore-map>Обрати стежку на карті</button><button class=story-choice data-return-story>Повернутися до сюжетного місця</button>';$('#storyChoices [data-explore-place]').onclick=()=>openMenu('place');$('#storyChoices [data-explore-map]').onclick=()=>openMenu('map');$('#storyChoices [data-return-story]').onclick=()=>runExpedition(returnToStory);return}
  $('#storyKicker').textContent=`ГЛАВА ${scene.chapter||G.chapter||1} · ${scene.caption||'ДЕСЬ НЕ ТАМ'}`;
  $('#storyText').innerHTML=paras(resolveSceneValue(scene.text||'',G));
  const n=resolveSceneValue(scene.notice||null,G);
  $('#storyExtras').innerHTML=n?`<div class="story-notice"><b>${esc(n.title)}</b><span>${esc(n.body)}</span></div>`:'';
  const root=$('#storyChoices');root.innerHTML='';
  if(scene.end)return;
  for(const c of resolveChoices(scene)){
    const b=document.createElement('button');
    b.className=`story-choice ${c.kind==='secret'?'secret':''}`;
    let prev=previewAction(G,{id:'preview',minutes:c.minutes||0,activity:c.activity||'light',effects:c.effects||[]});
    if(c.overnight){const after=performGameplayChoice(G,c).state;prev=['Ніч і наступний день'];for(const [key,label] of [['energy','Бадьорість'],['water','Вода'],['satiety','Ситість'],['health','Здоровʼя']]){const d=Math.round((key==='health'?after.health:after.needs[key])-(key==='health'?G.health:G.needs[key]));if(d)prev.push(`${label} ${d>0?'+':''}${d}%`)}}
    const prevHtml=prev.map(x=>`<span class="choice-cost ${x.includes('+')?'plus':'minus'}">${esc(x)}</span>`).join(' · ');
    b.innerHTML=`<span>${esc(c.label)}</span>${prev.length?`<small>${prevHtml}</small>`:''}`;
    b.disabled=G.health<=0;
    b.onclick=()=>choose(c);
    root.appendChild(b);
  }
}

async function consumeItem(id){
 if(actionBusy||!G||G.health<=0||G.pendingBattle)return;actionBusy=true;
 try{const r=useItem(G,id);if(!r.used){toast('НЕ ВИКОРИСТОВУЄТЬСЯ','Ця штука поки сюжетна.');return}G=r.state;notifyEvents(r.events);await persist();await renderGame();toast('ВИКОРИСТАНО',ITEM_DEFS[id].name)}finally{actionBusy=false}
}
function renderQuickSlots(){
  $('.quick-row').classList.toggle('has-slots',G.quickSlots.some(Boolean));
  const root=$('#quickSlots');
  root.innerHTML=G.quickSlots.map((id,i)=>!id?`<button class="quick-slot empty" data-q="${i}">Слот ${i+1}</button>`:`<button class="quick-slot" data-q="${i}">${ITEM_DEFS[id]?.icon||'◻'} ${esc(ITEM_DEFS[id]?.name||id)} <b>×${itemCount(G,id)}</b></button>`).join('');
  root.querySelectorAll('[data-q]').forEach(b=>b.onclick=async()=>{
    const i=Number(b.dataset.q),id=G.quickSlots[i];
    if(!id){openMenu('inventory');return}
    await consumeItem(id);
  });
}

function renderActiveStates(){
  const ids=G.activeStatuses||[];
  $('#activeStateCount').textContent=ids.length?`(${ids.length})`:'';
  $('#activeStates').innerHTML=ids.length?ids.map(id=>{
    const d=STATUS_DEFS[id],effects=statusEffectText(id);
    return `<div class="active-state-card"><b>${esc(d?.name||id)}</b>${effects?`<span><b>ефект:</b> ${esc(effects)}</span>`:''}</div>`;
  }).join(''):'<span class="small">Нічого активного.</span>';
}

function openMenu(tab='overview'){
  if(!G)return;
  $('#menuContent').scrollTop=0;
  currentTab=tab;
  document.body.classList.add('menu-open');
  $('#menuOverlay').classList.remove('hidden');
  $('#menuOverlay').setAttribute('aria-hidden','false');
  renderMenu();
}
function closeMenu(){
  document.body.classList.remove('menu-open');
  $('#menuOverlay').classList.add('hidden');
  $('#menuOverlay').setAttribute('aria-hidden','true');
  if(G&&!$('#gameScreen').classList.contains('hidden'))syncSceneAudio(getGameScene(G));
}
function renderMenu(){
  if(!G)return;updateMenuTitle(currentTab);
  document.querySelectorAll('#menuTabs [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab));
  const tm=formatTime(G.clock.totalMinutes);$('#menuMeta').textContent=`Проходження ${G.runId} · День ${tm.day}, ${tm.time}`;
  ({overview:()=>{$('#menuContent').innerHTML=overviewMarkup(G)},hero:()=>{$('#menuContent').innerHTML=heroMarkup(G,heroForClothes())},characters:()=>{$('#menuContent').innerHTML=charactersMarkup(G)},place:renderPlace,journal:renderJournal,states:renderStates,stats:renderStats,needs:renderNeeds,sleep:renderSleep,inventory:renderInventory,clothes:renderClothes,companions:renderCompanions,relations:()=>{$('#menuContent').innerHTML=relationsMarkup(G)},map:renderMap,shop:renderShop,settings:renderSettings}[currentTab]||renderInventory)();
}

function renderPlace(){
  const scene=getGameScene(G),context=locationContext(G,scene),actions=awayFromStory(G)?[]:worldActions(G,scene),extra=expeditionActions(G);
  $('#menuContent').innerHTML=`<div class="section-title"><h2>Місце</h2><span>${esc(PHASE_LABELS[context.phase])} · ${activeActor(G)==='evpapiy'?'Євпапій':'Степан'}</span></div><div class="info-card">${esc(G.world.location)}${context.danger?'<p>Поруч небезпека. Тривалий пошук і відпочинок недоступні.</p>':''}</div>${canExplore(G)?'<button data-open-travel>Обрати стежку на карті</button>':''}<div class="world-actions">${extra.map(a=>`<article class="info-card"><b>${esc(a.label)}</b><p>${esc(a.detail)}</p><button data-expedition-action="${esc(a.id)}" ${a.done?'disabled':''}>${a.minutes} хв · виконати</button></article>`).join('')}${actions.map(a=>`<article class="info-card"><b>${esc(a.label)}</b><p>${esc(a.detail)}</p><button data-world-action="${esc(a.id)}" ${a.done?'disabled':''}>${a.done?'Виконано':a.minutes?`${a.minutes} хв · виконати`:'Забрати'}</button></article>`).join('')||'<div class="empty-state">Зараз зосередьтесь на сюжетній дії. Припаси можна переглянути в інвентарі.</div>'}</div>`;
  $('#menuContent [data-open-travel]')?.addEventListener('click',()=>openMenu('map'));
  $('#menuContent').querySelectorAll('[data-expedition-action]').forEach(b=>b.onclick=()=>runExpedition(s=>performExpeditionAction(s,b.dataset.expeditionAction)));
  $('#menuContent').querySelectorAll('[data-world-action]').forEach(b=>b.onclick=async()=>{
    if(actionBusy||G.health<=0)return;actionBusy=true;
    try{const r=performWorldAction(G,b.dataset.worldAction,getGameScene(G));if(r.accepted===false){toast('НЕДОСТУПНО',r.message);return}G=r.state;notifyEvents(r.events);await persist();await renderGame();renderPlace();toast('ДІЯ ВИКОНАНА',r.message)}finally{actionBusy=false}
  });
}
function renderJournal(){
  const entries=(G.journal||[]).slice().reverse(),revealed=G.flags.darinaRevealed100;
  $('#menuContent').innerHTML=`<div class="section-title"><h2>Журнал</h2></div><div class="info-card"><b>Зараз</b><p>${G.chapter===7?'Ви ще в тумані. Перевірте стан і припаси; шлях назад ще не знайдений.':G.chapter===6?'Євпапій шукає допомогу після зникнення Степана. Його припаси окремі.':G.chapter===5?'Перед дорогою можна підготуватися. У тумані відпочинку не буде.':'Досліджуйте поточне місце між подіями. Запаси й допомога обмежені, а сюжет має кілька способів продовження.'}</p></div>${G.relationships.hood?.known?`<div class="info-card"><b>${revealed?'Дарина':'Постать'}</b><p>${revealed?'Степан упізнав її під час зняття каптура.':'Особа не встановлена.'}</p></div>`:''}${entries.map(e=>`<article class="info-card"><b>${esc(e.text)}</b><small>Глава ${e.chapter} · день ${formatTime(e.clock).day} · ${formatTime(e.clock).time}</small><p>${esc(e.detail)}</p></article>`).join('')||'<p>Записи дослідження з’являться після ваших дій.</p>'}`;
}

function renderInventory(){
  const root=$('#menuContent');
  const filtered=G.inventory.filter(s=>inventoryCategory==='all'||ITEM_DEFS[s.id]?.category===inventoryCategory);
  root.innerHTML=`<div class="section-title"><h2>Інвентар</h2><span>${G.inventory.length}/${bagLimits(G).slots} слотів · ${carriedWeight(G)}/${bagLimits(G).weight} кг</span></div><div class="category-tabs">${categories.map(c=>`<button data-cat="${esc(c)}" class="${inventoryCategory===c?'active':''}">${c==='all'?'Все':esc(c)}</button>`).join('')}</div><div class="item-grid">${filtered.length?filtered.map(s=>{const d=ITEM_DEFS[s.id]||{};return `<article class="item-card"><div class="item-icon">${d.icon||'◻️'}</div><div class="item-copy"><b>${esc(d.name||s.id)}</b><span>${esc(d.description||'')}</span><small>${esc(d.category||'')} · ×${s.qty}</small><div class="item-actions">${d.useEffects?.length?`<button data-use="${s.id}">Використати</button>`:''}${G.importantItems.includes(s.id)?'':`<button data-leave="${s.id}">Відкласти ×1</button>`}<button data-slot="0" data-item="${s.id}">1</button><button data-slot="1" data-item="${s.id}">2</button><button data-slot="2" data-item="${s.id}">3</button></div></div></article>`}).join(''):'<div class="empty-state">Тут поки пусто.</div>'}</div>`;
  root.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{inventoryCategory=b.dataset.cat;renderInventory()});
  root.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>consumeItem(b.dataset.use));
  root.querySelectorAll('[data-leave]').forEach(b=>b.onclick=async()=>{if(actionBusy)return;actionBusy=true;try{const r=leaveItem(G,b.dataset.leave);if(!r.accepted)return;G=r.state;await persist();await renderGame();toast('ВІДКЛАДЕНО','Річ можна забрати назад у розділі «Місце».')}finally{actionBusy=false}});
  root.querySelectorAll('[data-slot]').forEach(b=>b.onclick=async()=>{assignQuickSlot(G,Number(b.dataset.slot),b.dataset.item);await persist();renderQuickSlots();renderInventory();toast('ШВИДКИЙ СЛОТ',`Поставлено в слот ${Number(b.dataset.slot)+1}`)});
}

function clothingBonusText(d){
  const parts=[`броня +${Number(d.armor||0)}`,`тепло +${Number(d.warmth||0)}`,`дощ +${Number(d.rainProtection||0)}`];
  if(d.heatBurden)parts.push(`спека +${d.heatBurden}`);
  for(const [k,v] of Object.entries(d.statMods||{}))if(v)parts.push(`${String(STAT_LABELS[k]||k).toLocaleLowerCase('uk-UA')} ${v>0?'+':''}${v}`);
  return parts.join(' · ');
}

function renderClothes(){
  const root=$('#menuContent'),tot=equipmentTotals(G);
  const equippedIds=Object.values(G.equipment||{}).filter(id=>CLOTHES[id]);
  const ownedIds=[...new Set([...(Array.isArray(G.ownedClothes)?G.ownedClothes:[]),...equippedIds])].filter(id=>CLOTHES[id]);
  if(activeActor(G)==='stepan'&&G.flags?.localClothes){
    for(const id of ['local_shirt','local_vest','local_pants','boots'])if(CLOTHES[id]&&!ownedIds.includes(id))ownedIds.push(id);
  }
  if(!ownedIds.length&&activeActor(G)==='stepan'){
    for(const id of ['modern_shirt','modern_jacket','modern_pants','modern_boots'])if(CLOTHES[id])ownedIds.push(id);
  }
  root.innerHTML=`<div class="section-title"><h2>Шмотки</h2></div><div class="clothes-total"><span><b>Броня</b> ${tot.armor}</span><span><b>Тепло</b> ${tot.warmth}</span><span><b>Захист від дощу</b> ${tot.rainProtection}</span></div><div class="clothes-shell"><div class="clothes-hero"><img src="${heroForClothes()}" alt="Герой"><div class="equipped-list">${equippedIds.map(id=>`<span>${esc(CLOTHES[id].name)}</span>`).join('')}</div></div><div class="clothes-list">${ownedIds.map(id=>{const d=CLOTHES[id];const on=G.equipment?.[d.slot]===id;return `<article class="clothes-card ${on?'equipped':''}"><b>${esc(d.name)}</b>${d.note?`<span>${esc(d.note)}</span>`:''}<small>${esc(clothingBonusText(d))}</small><button data-equip="${id}" ${on?'disabled':''}>${on?'Вдягнено':'Вдягнути'}</button></article>`}).join('')}</div></div>`;
  root.querySelectorAll('[data-equip]').forEach(b=>b.onclick=async()=>{
    const before=new Set(G.activeStatuses||[]);
    equip(G,b.dataset.equip);
    const after=new Set(G.activeStatuses||[]),ev=[];
    for(const id of after)if(!before.has(id))ev.push({type:'statusAdded',id});
    for(const id of before)if(!after.has(id))ev.push({type:'statusRemoved',id});
    notifyEvents(ev);await persist();await renderGame();renderClothes();
  });
}

function renderStats(){
  if(activeActor(G)==='evpapiy'){renderCompanions();return}
  const mods=statModifiers(G),root=$('#menuContent'),p=G.heroProgression||{level:1,xp:0,points:0};
  const xp=Math.max(0,Math.min(99,Number(p.xp||0)));
  root.innerHTML=`<div class="section-title"><h2>Характеристики</h2><span>ГЕРОЙ · РІВЕНЬ ${p.level}</span></div>
    <div class="progression-card"><div class="progression-head"><div><b>Досвід</b><span>${xp}/100 XP</span></div><div><b>Очки прокачки</b><strong>${p.points}</strong></div></div><div class="progression-bar"><i style="width:${xp}%"></i></div><small>100 XP = новий рівень + 1 очко. Очки ви самі вкладаєте в характеристики.</small></div>
    <div class="stat-list">${STAT_KEYS.map(k=>{const st=G.stats[k]||{level:1},level=Math.max(1,Number(st.level||1)),mod=Number(mods[k]||0),now=effectiveStat(G,k),id=`stat-desc-${k}`;return `<article class="stat-card stat-upgrade-card"><div class="stat-head"><div><b>${STAT_LABELS[k]}</b> <button class="info-btn" type="button" data-info="${id}">ⓘ</button><div class="stat-level">Рівень ${level}${mod?` · <span class="${mod>0?'buff-text':'debuff-text'}">стани ${mod>0?'+':''}${mod}</span> · зараз ${now}`:''}</div></div><button type="button" class="stat-plus" data-stat-upgrade="${k}" ${p.points<=0||level>=10?'disabled':''}>+1</button></div><div class="stat-desc" id="${id}">${esc(STAT_DESCRIPTIONS[k])}</div><div class="stat-flavor">${esc(statFlavorText(k,level))}</div></article>`}).join('')}</div>`;
  root.querySelectorAll('.info-btn').forEach(btn=>btn.onclick=()=>{const el=$('#'+btn.dataset.info);if(el)el.classList.toggle('open')});
  root.querySelectorAll('[data-stat-upgrade]').forEach(btn=>btn.onclick=async()=>{if(actionBusy||G.pendingBattle||!spendHeroPoint(G,btn.dataset.statUpgrade))return;await persist();renderStats();renderHeader();toast('ПРОКАЧАНО',`${STAT_LABELS[btn.dataset.statUpgrade]} +1`)})
}

function needTone(v){v=Number(v)||0;if(v>40)return'needgood';if(v>20)return'needmid';if(v>5)return'needlow';return'needcrit'}
function needFlavor(kind,v){
  v=Number(v)||0;
  if(kind==='health'){
    if(v>=90)return'Здоровʼя в порядку.';
    if(v>60)return'Трохи потріпало, але тримаєтесь.';
    if(v>40)return'Здоровʼя просіло – треба відновитись.';
    if(v>20)return'Добряче дісталось – треба підлікуватись.';
    if(v>5)return'Здоровʼя мало – треба терміново підлікуватись.';
    return'Здоровʼя критично мало – ледве тримаєтесь.';
  }
  if(kind==='hunger'){
    if(v>=90)return'Наїлись, їсти поки не хочеться.';
    if(v>40)return'Шось би перекусити.';
    if(v>20)return'Голодний капець.';
    if(v>5)return'Їсти хочеться пиздець.';
    return G.flags.knowsPigeonName?'Євпапій починає виглядати їстівним.':G.flags.metPigeon?'Голуб починає виглядати їстівним.':'Ви вже готові зʼїсти хуй зна шо.';
  }
  if(kind==='thirst'){
    if(v>=90)return'Напились, пити поки не хочеться.';
    if(v>40)return'Шось би випити.';
    if(v>20)return'Сушить.';
    if(v>5)return'Пити хочеться пиздець.';
    return'Ви вже готові пити хуй зна шо.';
  }
  if(kind==='fatigue'){
    if(v>=90)return'Відпочили, сил вистачає.';
    if(v>40)return'Поки нормально.';
    if(v>20)return'Трохи підзаєбались.';
    if(v>5)return'Спати вже хочеться.';
    return'Вирубає.';
  }
  return'';
}

function renderNeeds(){
  const rows=[['Здоровʼя',G.health,'health'],['Ситість',G.needs.satiety,'hunger'],['Вода',G.needs.water,'thirst'],['Бадьорість',G.needs.energy,'fatigue']];
  $('#menuContent').innerHTML=`<div class="section-title"><h2>Потреби</h2></div><div class="info-card">Слідкуйте за здоровʼям, водою, ситістю й бадьорістю. Чим нижчий показник – тим хуйовіше герою. Їжа відновлює ситість, напої – воду, відпочинок – бадьорість, аптечка – здоровʼя. При 0% здоровʼя ви здохли.</div><div class="needs-list">${rows.map(([label,value,kind])=>`<article class="need-card"><div class="need-row"><b>${label}</b><b>${Math.round(value)}%</b></div><div class="need-bar ${needTone(value)}"><span style="width:${Math.max(0,Math.min(100,value))}%"></span></div><div class="stat-flavor">${esc(needFlavor(kind,value))}</div></article>`).join('')}</div>`;
}

function sleepPlace(){
  const env=String(G.world?.environment||'outdoors');
  const loc=String(G.world?.location||'').toLocaleLowerCase('uk-UA');
  if(env==='barn'||/хлів/.test(loc))return{key:'barn',label:'Хлів',activity:'sleep_barn'};
  if(env==='indoors')return{key:'house',label:'Хатина',activity:'sleep_house'};
  return{key:'outdoors',label:'Вулиця',activity:'sleep_outdoors'};
}

function sleepMessage(place,hours,cow){
  if(cow)return'Вас облизала корова';
  if(place==='house'){
    if(hours===8)return'Вісім годин без хуйні. Новий рекорд.';
    return'Вперше за сьогодні ви лежите і ніхто не говорить з вами. Навіть Євпапій. Підозріло.';
  }
  if(place==='barn')return'Пахне сіном і гімно';
  return'Спалось хуйово. Все';
}

async function doSleep(hours){
  if(!G||G.health<=0||!locationContext(G,getGameScene(G)).safe||actionBusy){toast('ЗАРАЗ НЕ ДО СНУ','Спершу вийдіть із небезпеки й завершіть поточну подію.');return}
  actionBusy=true;
  try{
  const place=sleepPlace();
  const cow=place.key==='barn'&&Math.random()<.05;
  const effects=cow?[{type:'statusAdd',id:'cowLicked'}]:[];
  const r=executeAction(G,{
    id:`sleep_${place.key}_${hours}h`,
    minutes:hours*60,
    activity:place.activity,
    effects
  });
  G=r.state;
  notifyEvents(r.events);
  lastSleepMessage=sleepMessage(place.key,hours,cow);
  await persist();
  await renderGame();
  toast('ВИ ПОСПАЛИ',lastSleepMessage);
  }finally{actionBusy=false}
}

function renderSleep(){
  const place=sleepPlace();
  const options=[1,4,8];
  const root=$('#menuContent');
  const cards=options.map(hours=>{
    const action={id:'sleep_preview',minutes:hours*60,activity:place.activity,effects:[]};
    const preview=previewAction(G,action).filter(x=>/^(Бадьорість|Вода|Ситість|Здоровʼя)/.test(x));
    const effects=preview.map(x=>`<span class="sleep-effect ${x.includes('+')?'plus':'minus'}">${esc(x)}</span>`).join('');
    return `<button class="sleep-card" type="button" data-sleep-hours="${hours}">
      <b>${hours===1?'Подрімати 1 годину':hours===4?'Поспати 4 години':'Виспатися 8 годин'}</b>
      <small>${effects||'Час пройде.'}</small>
    </button>`;
  }).join('');
  root.innerHTML=`<div class="section-title"><h2>Сон</h2><span>${esc(place.label)}</span></div>
    <div class="info-card">Спати можна коли хочете. Наскільки це хороша ідея, залежить від місця й погоди.</div>
    ${lastSleepMessage?`<div class="sleep-result">${esc(lastSleepMessage)}</div>`:''}
    <div class="sleep-grid">${cards}</div>
    ${place.key==='barn'?'<div class="sleep-note">У хліві іноді може статись дещо рідкісне.</div>':''}`;
  root.querySelectorAll('[data-sleep-hours]').forEach(b=>b.onclick=()=>doSleep(Number(b.dataset.sleepHours)));
}

function renderStates(){
  const known=new Set(G.discoveredStatuses);
  $('#menuContent').innerHTML=`<div class="section-title"><h2>Стани</h2></div><div class="info-card">На головному екрані видно, що діє на вас прямо зараз. Тут лишається все, що ви вже встигли пережити.</div><div class="state-list">${Object.entries(STATUS_DEFS).map(([id,d])=>{
    if(!known.has(id))return'<article class="locked-card"><b>???</b><span>Ще не відкрито.</span></article>';
    const effects=statusEffectText(id);
    return `<article class="state-card ${G.activeStatuses.includes(id)?'active':''}"><b>${esc(d.name)}</b>${d.blurb?`<span>${esc(d.blurb)}</span>`:''}${effects?`<small><b>ефект:</b> ${esc(effects)}</small>`:''}<small><b>як позбутись:</b> ${esc(d.remove||'')}</small>${d.persistentUnlock?'<small><b>ще:</b> іноді зʼявляються окремі відбиті варіанти [ЄБАТОРІУМ].</small>':''}</article>`;
  }).join('')}</div>`;
}

function companionDots(value){
  const n=Math.max(0,Math.min(5,Math.round(Number(value||0)/2)));
  return `<span class="comp-dots" aria-label="${n} з 5">${'●'.repeat(n)}${'○'.repeat(5-n)}</span>`;
}

function renderCompanions(){
  const all=Object.entries(G.companions||{}).filter(([,c])=>c.known);
  if(!all.length){$('#menuContent').innerHTML=`<div class="section-title"><h2>Компаньйони</h2></div><div class="empty-state">Поки ви самі. Насолоджуйтесь моментом.</div>`;return}
  $('#menuContent').innerHTML=`<div class="section-title"><h2>Компаньйони</h2></div>${all.map(([id,c])=>{
    if(id==='evpapiy'){
      const r=G.relationships?.evpapiy?.values||{},p=c.progression||{level:c.level||1,xp:0,points:0,attack:1,aggression:1,health:1};const xp=Math.max(0,Math.min(99,Number(p.xp||0)));
      const rel=[['ПІЗДАБОЛЬСТВО',r.bullshit,'як часто він бреше та підйобує.'],['ДОВІРА',r.trust,'чим вище, тим більше шансів, шо ця жирна падла реально скаже щось корисне.'],['ОБРАЗА',r.offense,'Євпапій памʼятає більше, ніж хотілося б.'],['ЖАДІБНІСТЬ',r.greed,'наскільки легко його задобрити їжею.']];
      const combat=[['attack','АТАКА',p.attack,'сильніше бʼє, коли ви таки використовуєте голуба як зброю.'],['aggression','АГРЕСІЯ',p.aggression,'додає шкоди його бойовим діям.'],['health','ЗДОРОВʼЯ',p.health,`максимум зараз ${c.maxHp} HP.`]];
      return `<article class="companion-profile"><div class="companion-main"><img src="${asset(c.portrait||'./pigeon_base.png')}" alt="Євпапій"><div class="companion-main-copy"><div class="companion-name">${esc(c.name||'Євпапій')} · РІВЕНЬ ${p.level}</div><div class="companion-state">${esc(c.active?'З вами':c.state||'Не з вами')}</div><p>До вас прибився жирний наглий голуб, який дуже бісить.</p></div></div>
        <div class="progression-card compact"><div class="progression-head"><div><b>Досвід</b><span>${xp}/100 XP</span></div><div><b>Очки прокачки</b><strong>${p.points}</strong></div></div><div class="progression-bar"><i style="width:${xp}%"></i></div></div>
        <div class="companion-characteristics"><h3>Бойова прокачка</h3>${combat.map(([key,label,value,desc])=>`<div class="comp-stat upgrade"><div class="comp-stat-head"><b>${label} · ${value}</b><button type="button" data-evp-upgrade="${key}" ${p.points<=0||value>=10?'disabled':''}>+1</button></div><span>${esc(desc)}</span></div>`).join('')}</div>
        <div class="companion-characteristics"><h3>Характер і стосунки</h3><p>${esc(relationshipHint('evpapiy',G))}</p></div><div class="companion-warning">З ним може бути легше. Може, веселіше. А може, на вас просто чекає жирна підстава.</div></article>`;
    }
    return `<article class="companion-card"><img src="${esc(c.portrait||'')}" alt=""><div><b>${esc(c.name)}</b><span>${esc(c.active?'З вами':c.state||'Не з вами')}</span>${c.facts?.map(x=>`<small>${esc(x)}</small>`).join('')||''}</div></article>`
  }).join('')}`;
  document.querySelectorAll('[data-evp-upgrade]').forEach(btn=>btn.onclick=async()=>{if(actionBusy||G.pendingBattle||!spendEvpPoint(G,btn.dataset.evpUpgrade))return;await persist();renderCompanions();toast('ЄВПАПІЙ ПРОКАЧАНИЙ',`${btn.dataset.evpUpgrade==='attack'?'АТАКА':btn.dataset.evpUpgrade==='aggression'?'АГРЕСІЯ':'ЗДОРОВʼЯ'} +1`)})
}

function renderRelations(){
  const known=Object.values(G.relationships).filter(r=>r.known);
  $('#menuContent').innerHTML=`<div class="section-title"><h2>Стосунки</h2></div><div class="info-card">Персонажі памʼятають, шо ви витворяли. Що саме вони про вас думають – доведеться поняти по ходу.</div>${known.length?known.map(r=>`<article class="relation-card"><b>${esc(r.name)}</b><span>Що саме цей персонаж про вас думає, доведеться поняти по ходу.</span></article>`).join(''):'<div class="empty-state">Ше нема кого бісити.</div>'}`;
}

async function runExpedition(operation){
 if(actionBusy||!G||G.health<=0||G.pendingBattle)return;actionBusy=true;
 try{const r=operation(G);if(!r.accepted){toast('НЕДОСТУПНО',r.message);return}G=r.state;notifyEvents(r.events);await persist();await renderGame();toast('ДОСЛІДЖЕННЯ',r.message)}finally{actionBusy=false}
}
function renderMap(){
 const root=$('#menuContent');root.innerHTML=mapMarkup(G);
 root.querySelectorAll('[data-travel]').forEach(b=>b.onclick=()=>runExpedition(s=>travel(s,b.dataset.travel)));
 root.querySelector('[data-return-story]')?.addEventListener('click',()=>runExpedition(returnToStory));
}

function renderShop(){
  if(activeActor(G)!=='stepan'||!locationContext(G,getGameScene(G)).safe){$('#menuContent').innerHTML='<h2>Крамничка</h2><p>До припасів і роботи повернетеся в безпечному дворі.</p>';return}
  const surcharge=G.chapter>=3&&G.flags.suspiciousDealConsequencePending?2:0;
  const items=[['water',4+surcharge],['aspirin',8+surcharge],['onion',2+surcharge]];
  const day=Math.floor(Number(G.clock?.totalMinutes||0)/1440)+1;
  const jobs=[
    {id:'sweep',title:'Підмести двір',pay:2,minutes:15,repeat:'daily',done:Number(G.flags.sweptYardDay||0)===day,effects:[{type:'money',value:2}],hidden:[{type:'flag',key:'sweptYard',value:true},{type:'flag',key:'sweptYardDay',value:day}]},
    {id:'wood',title:'Нарубати дрова',pay:4,minutes:25,repeat:'daily',done:Number(G.flags.choppedWoodDay||0)===day,effects:[{type:'money',value:4},{type:'stat',key:'strength',value:1}],hidden:[{type:'flag',key:'choppedWood',value:true},{type:'flag',key:'choppedWoodDay',value:day}]},
    {id:'deal',title:'Підписатись на підозріле діло',pay:8,minutes:10,repeat:'once',done:Boolean(G.flags.suspiciousDeal),effects:[{type:'money',value:8}],hidden:[{type:'flag',key:'suspiciousDeal',value:true},{type:'flag',key:'suspiciousDealDay',value:day},{type:'flag',key:'suspiciousDealConsequence',value:true},{type:'flag',key:'suspiciousDealConsequencePending',value:true}]}
  ];
  $('#menuContent').innerHTML=`<div class="section-title"><h2>Крамничка</h2><span><b>${G.money}</b> монет</span></div>${G.flags.shopUnlocked?`<div class="shop-money">У вас зараз <b>${G.money} монет</b>.</div><div class="shop-grid">${items.map(([id,p])=>`<article class="item-card"><div class="item-icon">${ITEM_DEFS[id].icon}</div><div class="item-copy"><b>${esc(ITEM_DEFS[id].name)}</b><span>${p} мон.</span><button data-buy="${id}" data-price="${p}">Купити</button></div></article>`).join('')}</div><div class="section-title shop-work-title"><h2>Як заробити</h2><span>День ${day}</span></div><div class="info-card">Підмести двір і нарубати дрова можна раз на день.</div><div class="shop-jobs">${jobs.map(j=>`<article class="job-card ${j.done?'done':''}"><div><b>${esc(j.title)}</b><span>${j.done?(j.repeat==='daily'?'На сьогодні вже зробили.':'Уже зробили.'):`${j.minutes} хв · +${j.pay} монет`}</span></div><button data-job="${j.id}" ${j.done?'disabled':''}>${j.done?'Готово':'Взятись'}</button></article>`).join('')}</div>`:'<div class="locked-big">Ще закрито.</div>'}`;
  if(surcharge){const note=document.createElement('div');note.className='info-card';note.textContent='За незавершене підозріле діло припаси дорожчі на 2 монети. У розділі «Місце» можна розрахуватися або відпрацювати залишок.';$('#menuContent .shop-grid')?.before(note)}
  document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=async()=>{if(actionBusy||G.pendingBattle||G.health<=0)return;const p=Number(b.dataset.price);if(G.money<p){toast('НЕМА ГРОШЕЙ','Ну от так.');return}if(!addItem(G,b.dataset.buy,1)){toast('НЕМА МІСЦЯ','Інвентар забитий.');return}G.money-=p;await persist();renderShop()});
  document.querySelectorAll('[data-job]').forEach(b=>b.onclick=async()=>{
    const j=jobs.find(x=>x.id===b.dataset.job);if(!j||j.done||actionBusy||!locationContext(G,getGameScene(G)).safe)return;
    actionBusy=true;try{
    const r=executeAction(G,{id:`shop_${j.id}`,minutes:j.minutes,activity:'work',effects:j.effects.filter(e=>e.type!=='stat'),hiddenEffects:j.hidden});
    G=r.state;notifyEvents([...r.events,...awardExplorationXp(G,j.effects.some(e=>e.type==='stat')?10:0)]);await persist();await renderGame();renderShop();toast('ЗАРОБИЛИ',`+${j.pay} монет`);
    }finally{actionBusy=false}
  });
}

async function renderSettings(){
  const root=$('#menuContent'),a=audioManager.getSettings(),run=G.runId,manual=await listManual(run);
  if(currentTab!=='settings'||G?.runId!==run||$('#menuOverlay').classList.contains('hidden'))return;
  root.dataset.testMode=G.flags.testMode?'1':'0';
  root.innerHTML=`<div class="section-title"><h2>Налаштування</h2></div><div class="settings-block"><label><input id="soundEnabled" type="checkbox" ${a.enabled?'checked':''}> Звук</label><label>Загальна гучність <input id="masterVol" type="range" min="0" max="1" step=".05" value="${a.master}"></label><label>Атмосфера <input id="ambientVol" type="range" min="0" max="1" step=".05" value="${a.ambient}"></label><label>Ефекти <input id="effectsVol" type="range" min="0" max="1" step=".05" value="${a.effects}"></label><button id="testSound">Перевірити клік</button></div><div class="section-title"><h2>Ручні сейви</h2></div><div class="save-grid">${manual.map(x=>`<article><b>Слот ${x.slot}</b><span>${x.state?'Є сейв':'Порожньо'}</span><div><button data-save="${x.slot}">Зберегти</button>${x.state?`<button data-load="${x.slot}">Завантажити</button>`:''}</div></article>`).join('')}</div>`;
  const p=readingPreferences(),reading=document.createElement('section');reading.className='settings-block';reading.innerHTML=`<h2>Читання</h2><label>Розмір тексту <select id=readingFont>${[16,17,19].map(v=>`<option value=${v} ${v===p.font?'selected':''}>${v} px</option>`).join('')}</select></label><label>Розмір ілюстрації <select id=readingArt>${[[.85,'Компактна'],[1,'Велика'],[1.15,'Ще більша']].map(([v,l])=>`<option value=${v} ${v===p.art?'selected':''}>${l}</option>`).join('')}</select></label><label><input type=checkbox id=readingMotion ${p.reducedMotion?'checked':''}> Менше анімацій</label>`;root.prepend(reading);
  reading.onchange=()=>saveReadingPreferences({font:Number($('#readingFont').value),art:Number($('#readingArt').value),reducedMotion:$('#readingMotion').checked});
  $('#soundEnabled').onchange=e=>audioManager.setEnabled(e.target.checked);
  for(const [id,k] of [['masterVol','master'],['ambientVol','ambient'],['effectsVol','effects']])$('#'+id).oninput=e=>audioManager.setVolume(k,Number(e.target.value));
  $('#testSound').onclick=()=>audioManager.testEffect();
  root.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{await saveManual(G,Number(b.dataset.save));toast('ЗБЕРЕЖЕНО',`Слот ${b.dataset.save}`);renderSettings()});
  root.querySelectorAll('[data-load]').forEach(b=>b.onclick=async()=>{const run=G.runId,s=await loadManual(run,Number(b.dataset.load));if(await loadManualState(run,s)){closeMenu();await renderGame();toast('ЗАВАНТАЖЕНО',`Слот ${b.dataset.load}`)}});
  renderBackupControls(root);
}

function renderBackupControls(root){
  root.querySelector('[data-backup-controls]')?.remove();
  const box=document.createElement('section');box.dataset.backupControls='1';
  box.innerHTML='<div class="section-title"><h2>Перенесення сейвів</h2></div><button data-export-backup>Експортувати проходження</button><button data-import-backup>Імпортувати проходження</button><input type="file" accept="application/json,.json" hidden data-backup-file>';
  root.append(box);
  box.querySelector('[data-export-backup]').onclick=async()=>{if(G)await persist();const bundle=await exportBackup();const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='des-ne-tam-saves.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  const input=box.querySelector('[data-backup-file]');box.querySelector('[data-import-backup]').onclick=()=>input.click();
  input.onchange=async()=>{try{const file=input.files[0];if(!file)return;const bundle=JSON.parse(await file.text());validateBackup(bundle);const ok=await askConfirm({title:'Імпортувати проходження?',text:`Файл містить ${Object.keys(bundle.saves).length} збережень. Відповідні слоти буде замінено, їхні поточні копії залишаться в резерві.`,okText:'Імпортувати'});if(!ok)return;await importBackup(bundle);closeMenu();G=null;await renderStart('continue');toast('ІМПОРТОВАНО','Оберіть проходження для продовження.')}catch(error){toast('ІМПОРТ НЕ ВИКОНАНО',error.message)}finally{input.value=''}};
}

function openAbout(){const o=$('#aboutOverlay');o.classList.remove('hidden');o.setAttribute('aria-hidden','false')}
function closeAbout(){const o=$('#aboutOverlay');o.classList.add('hidden');o.setAttribute('aria-hidden','true')}

$('#newGameBtn').onclick=()=>renderStart('new');
$('#continueBtn').onclick=()=>renderStart('continue');
$('#chaptersBtn').onclick=()=>renderStart('chapters');
$('#savesBtn').onclick=()=>renderStart('saves');
$('#aboutBtn').onclick=openAbout;
$('#testModeBtn')?.addEventListener('click',()=>{if(testerUnlocked())renderStart('test')});
$('#aboutCloseBtn').onclick=closeAbout;
$('#aboutOverlay').onclick=e=>{if(e.target===$('#aboutOverlay'))closeAbout()};
$('#beginGameBtn').onclick=beginGame;
$('#menuBtn').onclick=()=>openMenu('overview');
$('#closeMenuBtn').onclick=closeMenu;
$('#exitBtn').onclick=async()=>{await persist();closeMenu();renderStart('home')};
$('#stateOkBtn').onclick=closeState;
$('#miniNeeds').onclick=()=>openMenu('needs');
$('#miniNeeds').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openMenu('needs')}};
$('#menuOverlay').onclick=e=>{if(e.target===$('#menuOverlay'))closeMenu()};
document.querySelectorAll('#menuTabs [data-tab]').forEach(b=>b.onclick=()=>{currentTab=b.dataset.tab;renderMenu()});
document.addEventListener('pointerdown',e=>{if(e.target.closest('button')){audioManager.unlock();audioManager.playEffect('ui',{volume:.32})}},{passive:true});
window.addEventListener('beforeunload',()=>{if(G)emergencySaveRun(G)});
window.addEventListener('dnt:battlecheckpoint',event=>{if(G?.runId===event.detail?.runId)G=event.detail});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&G)emergencySaveRun(G)});

installInterface({openMenu,closeMenu});
installTesterUnlock();
renderStart('home');
