// v0.9.9 TEST – stabilization pass.
// Fixes scene consequences, chapter 4 pacing/knowledge, menu knowledge, shop gating,
// image loading and test-mode completeness without adding new game mechanics.
import {CHAPTER1_SCENES,resolveSceneValue} from './chapter1.js?v=096b';
import {CHAPTER2_SCENES} from './chapter2.js?v=096b';
import {CHAPTER3_SCENES} from './chapter3.js?v=096b';
import {STATUS_DEFS,ITEM_DEFS} from './data.js?v=096b';
import {normalizeState,executeAction,threatInfo,effectiveStat,createInitialState} from './engine.js?v=096b';
import {loadRun,saveRun,listManual,listChapterCheckpoints,persistentWrite,saveKeys,clearRun} from './storage.js?v=096b';
import {audioManager} from './audio.js?v=096b';

const VERSION099='v0.9.9e TEST';
const DEAD_STATUSES099=new Set(['headInjury','hungry','thirsty','wet','cold','overheated','bump']);
const POST_TYPES099=new Set(['statusAdd','health','damage','need','heroXp','evpXp','itemAdd','itemRemove','clothesAdd','equip']);
const BOOKS099=[CHAPTER1_SCENES,CHAPTER2_SCENES,CHAPTER3_SCENES];
const allScenes099=()=>BOOKS099.flatMap(b=>Object.values(b||{})).filter(Boolean);
const asArray099=x=>x==null?[]:Array.isArray(x)?x:[x];
const esc099=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const clone099=x=>JSON.parse(JSON.stringify(x));
const sceneById099=id=>CHAPTER3_SCENES[id]||CHAPTER2_SCENES[id]||CHAPTER1_SCENES[id]||null;
const resolve099=(value,state)=>typeof value==='function'?value(state):value;

function stamp099(){
  document.querySelectorAll('.version,.howto-version,.game-name span').forEach(el=>el.textContent=VERSION099);
  const t=document.querySelector('#testModeBtn');if(t)t.textContent='Тестовий режим';
}
function disableSound099(){
  try{audioManager.setEnabled?.(false)}catch{}
  try{audioManager.setVolume?.('master',0)}catch{}
  try{audioManager.setVolume?.('ambient',0)}catch{}
  try{audioManager.setVolume?.('effects',0)}catch{}
}
function hideSoundSettings099(){
  const root=document.querySelector('#menuContent');
  if(root?.querySelector('.section-title h2')?.textContent?.trim()==='Налаштування')root.querySelector('.settings-block')?.remove();
}

// ---- Immediate scene consequences -------------------------------------------------
// v0.9.6 moved HP/items/statuses from scene entry to the next button press.
// Recover exactly the effects that wrapper appended, then make the outgoing choices clean.
function effectSig099(e){try{return JSON.stringify(e)}catch{return String(e?.type||'')}}
function diffEffects099(more,base){
  const counts=new Map();
  for(const e of base||[]){const k=effectSig099(e);counts.set(k,(counts.get(k)||0)+1)}
  const out=[];
  for(const e of more||[]){const k=effectSig099(e),n=counts.get(k)||0;if(n)counts.set(k,n-1);else out.push(e)}
  return out;
}
function stateWithPost099(s,flag,value){return{...s,flags:{...(s?.flags||{}),[flag]:value}}}
function movedFromChoices099(oldChoices,state,flag){
  let delayed=[],clean=[];
  try{delayed=asArray099(resolve099(oldChoices,stateWithPost099(state,flag,false)))}catch{}
  try{clean=asArray099(resolve099(oldChoices,stateWithPost099(state,flag,true)))}catch{}
  const out=[];
  for(let i=0;i<delayed.length;i++){
    const a=delayed[i],b=clean.find(x=>x?.id&&x.id===a?.id)||clean[i]||{};
    for(const e of diffEffects099(asArray099(a?.effects),asArray099(b?.effects)))if(POST_TYPES099.has(e?.type))out.push(e);
  }
  const seen=new Set();
  return out.filter(e=>{const k=effectSig099(e);if(seen.has(k))return false;seen.add(k);return true});
}
function restoreImmediateConsequences099(){
  for(const scene of allScenes099()){
    if(!scene?.id||scene.__immediate099||typeof scene.choices!=='function')continue;
    const oldChoices=scene.choices,oldEnter=scene.onEnter,flag=`post096_${scene.id}`;
    const moved=s=>movedFromChoices099(oldChoices,s,flag).filter(e=>!(e?.type==='statusAdd'&&e.id==='headInjury'));
    scene.__movedEffects099=moved;
    scene.onEnter=s=>[
      ...asArray099(resolve099(oldEnter||[],s)).filter(e=>!(e?.type==='statusAdd'&&e.id==='headInjury')),
      ...moved(s)
    ];
    scene.choices=s=>asArray099(resolve099(oldChoices,stateWithPost099(s,flag,true))).map(c=>({
      ...c,
      hiddenEffects:asArray099(c?.hiddenEffects).filter(e=>!(e?.type==='flag'&&e.key===flag))
    }));
    scene.__immediate099=true;
  }
}

function cleanHeadInjuryRuntime099(){
  delete STATUS_DEFS.headInjury;
  for(const scene of allScenes099()){
    if(!scene?.onEnter||scene.__headClean099)continue;
    const old=scene.onEnter;
    scene.onEnter=s=>asArray099(resolve099(old,s)).filter(e=>!((e?.type==='statusAdd'||e?.type==='statusRemove')&&e.id==='headInjury'));
    scene.__headClean099=true;
  }
  const wake=CHAPTER3_SCENES.ch3_wakeup;
  if(wake){
    wake.actors=[
      {role:'hero',src:'./hero_injured_096.png',position:'hero'},
      {role:'pigeon',src:'./pigeon_base_095b.webp',position:'pigeon'}
    ];
  }
}

// ---- Save migration ---------------------------------------------------------------
function hasLegacyPost099(s){return Object.keys(s?.flags||{}).some(k=>k.startsWith('post096_'))}
function hasDeadHead099(s){return Boolean(s?.activeStatuses?.includes?.('headInjury')||s?.discoveredStatuses?.includes?.('headInjury')||s?.statusTimers?.headInjury!==undefined)}
function cleanPostFlags099(s){for(const k of Object.keys(s.flags||{}))if(k.startsWith('post096_'))delete s.flags[k]}
function removeHeadFromState099(s){
  s.activeStatuses=(s.activeStatuses||[]).filter(x=>x!=='headInjury');
  s.discoveredStatuses=(s.discoveredStatuses||[]).filter(x=>x!=='headInjury');
  s.statusTimers={...(s.statusTimers||{})};delete s.statusTimers.headInjury;
}
function migrateState099(raw){
  if(!raw)return{state:raw,changed:false};
  const original=clone099(raw),hadPost=hasLegacyPost099(original),hadHead=hasDeadHead099(original);
  const entered=new Set(original.story?.entered||[]),sceneId=String(original.story?.sceneId||original.scene||'');
  const freshTestCh4=Boolean(original.flags?.testFreshChapter4099b);
  const oldCh4=!freshTestCh4&&(entered.has('ch4_intro')||[...entered].some(x=>String(x).startsWith('ch4_'))||sceneId.startsWith('ch4_'));
  const oldCh5EvpEnding099d=new Set(['ch5_evp_crash099c','ch5_evp_search099c']);
  const needsCh6Migration099d=oldCh5EvpEnding099d.has(sceneId)||Boolean(original.flags?.chapter5Complete099c&&original.flags?.ch5StepanMissing099c&&Number(original.chapter||0)===5);
  const needsUrgent=Boolean(original.flags?.storyUrgent099||entered.has('ch4_son_question')||(oldCh4&&sceneById099(sceneId)?.storyPace==='urgent'));
  if(!hadPost&&!hadHead&&!oldCh4&&!needsUrgent&&!needsCh6Migration099d)return{state:raw,changed:false};

  let s=normalizeState(clone099(raw));s.flags=s.flags||{};
  if(needsCh6Migration099d){
    s.chapter=6;s.scene='ch6_intro099d';s.story={...(s.story||{}),chapter:6,sceneId:'ch6_intro099d',finished:false};
    s.flags.ch4StepanMissing=true;s.flags.ch5StepanMissing099c=true;s.flags.activeHero097='evpapiy';s.flags.chapter5Complete099c=true;s.flags.storyUrgent099=true;s.flags.migratedOldCh5EndingToCh6099d=true;
  }
  const oldFogEnding099c=new Set(['ch4_watch','ch4_cat_moves','ch4_evp_block','ch4_voice','ch4_fog_deep','ch4_fall','ch4_evp_after']);
  if(oldFogEnding099c.has(sceneId)){
    s.chapter=5;s.scene='ch5_intro';s.story={...(s.story||{}),chapter:5,sceneId:'ch5_intro',finished:false};
    delete s.flags.ch4StepanMissing;delete s.flags.activeHero097;
    s.flags.chapter4Complete099c=true;s.flags.storyUrgent099=false;s.flags.migratedOldFogToCh5099c=true;
  }
  if(hadPost&&sceneId&&entered.has(sceneId)){
    const marker=`post096_${sceneId}`;
    if(!original.flags?.[marker]){
      const sc=sceneById099(sceneId),moved=sc?.__movedEffects099?.(s)||[];
      if(moved.length)s=executeAction(s,{id:`migration099_${sceneId}`,effects:moved}).state;
    }
  }
  cleanPostFlags099(s);removeHeadFromState099(s);
  if(oldCh4){s.flags.semenEncountered099=true;s.flags.semenIntroduced099=true}
  if(needsUrgent)s.flags.storyUrgent099=true;
  s.flags.immediateMigration099=true;
  let migrated099=normalizeState(s);
  if(needsCh6Migration099d){migrated099.chapter=6;migrated099.scene='ch6_intro099d';migrated099.story={...(migrated099.story||{}),chapter:6,sceneId:'ch6_intro099d',finished:false};migrated099.flags={...(migrated099.flags||{}),ch4StepanMissing:true,ch5StepanMissing099c:true,activeHero097:'evpapiy',chapter5Complete099c:true,storyUrgent099:true,migratedOldCh5EndingToCh6099d:true}}
  else if(oldFogEnding099c.has(sceneId)){migrated099.chapter=5;migrated099.scene='ch5_intro';migrated099.story={...(migrated099.story||{}),chapter:5,sceneId:'ch5_intro',finished:false}}
  return{state:migrated099,changed:true};
}
async function migrateAllSaves099(){
  for(const run of [1,2,3,99]){
    try{
      const raw=await loadRun(run),m=migrateState099(raw);
      if(m.changed)await saveRun({...m.state,runId:run});
      const manuals=await listManual(run);
      for(const item of manuals){
        if(!item.state)continue;
        const snap=clone099(item.state),embedded=snap.__chapterCheckpoint?clone099(snap.__chapterCheckpoint):null;delete snap.__chapterCheckpoint;
        const mm=migrateState099(snap),mc=migrateState099(embedded);
        if(mm.changed||mc.changed){const next=mm.state||snap;if(embedded)next.__chapterCheckpoint=mc.state||embedded;await persistentWrite(saveKeys.MANUAL(run,item.slot),JSON.stringify(next))}
      }
      const cps=await listChapterCheckpoints(run,20);
      for(const cp of cps){const mcp=migrateState099(cp.state);if(mcp.changed)await persistentWrite(saveKeys.CHAPTER(run,cp.chapter),JSON.stringify(mcp.state))}
    }catch(e){console.warn('v099 migration skipped',run,e)}
  }
}
let migrationReady099=false;
function setMigrationGate099(waiting){
  const ids=['newGameBtn','continueBtn','chaptersBtn','savesBtn','testModeBtn'];
  for(const id of ids){const b=document.getElementById(id);if(b)b.disabled=Boolean(waiting)}
  const c=document.getElementById('continueBtn');
  if(c){if(waiting){if(!c.dataset.label099)c.dataset.label099=c.textContent;c.textContent='Перевіряю сейви…'}else if(c.dataset.label099){c.textContent=c.dataset.label099}}
}
function installMigrationGate099(){
  setMigrationGate099(true);
  document.addEventListener('click',e=>{
    if(migrationReady099)return;
    if(e.target?.closest?.('#newGameBtn,#continueBtn,#chaptersBtn,#savesBtn,#testModeBtn,.run-card,[data-start-manual],[data-chapter-new],[data-chapter-continue],#continueTestBtn')){
      e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
}
async function runMigrationGate099(){
  installMigrationGate099();
  try{await migrateAllSaves099()}finally{migrationReady099=true;setMigrationGate099(false)}
}

// ---- Chapter 4: final opening structure --------------------------------------------
const H099={base:'./hero_shrug_096.png',angry:'./hero_angry_096.png',worry:'./hero_worry_096.png'};
const S099={base:'./ch4_semen_base.png',talk:'./ch4_semen_talk.png',side:'./ch4_semen_sideeye.png'};
const P099={base:'./pigeon_base_095b.webp',serious:'./pigeon_suspicious.png'};
const hero099=(src=H099.base)=>({role:'hero ch4-hero097',src,position:'hero'});
const semen099=(src=S099.base)=>({role:'npc ch4-semen097',src,position:'npc'});
const pigeon099=(src=P099.base)=>({role:'pigeon ch4-pigeon097',src,position:'pigeon'});
const galina099=()=>({role:'npc ch4-galina097',src:'./galina_base.png',position:'npc'});
const cat099=()=>({role:'npc ch4-cat097',src:'./cat_base_095m.png',position:'npc'});
const yard099={background:'./ch2_wake_yard.jpg',atmosphere:'village',chapter:4,world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'біля хати баби Галі'}]};

function memoryBranch099(s){
  if(s.flags?.creatureVodkaFriend)return'vodka';
  if(s.flags?.creatureGarlicUsed)return'garlic';
  if(s.flags?.creaturePrayerReactionKnown095w||s.flags?.creaturePrayerStalled095w||s.flags?.creatureKilledByPrayer)return'prayer';
  if(s.flags?.shedBattleKnockout)return'fight';
  return'fight';
}
function memoryText099(s){
  const branch=memoryBranch099(s);
  if(branch==='vodka')return'– За горілку, до речі, спасіба. Хороша була.';
  if(branch==='garlic')return'Мужик переводить погляд на ваші руки.\n\n– Часнику нема?';
  if(branch==='prayer')return'– Тільки ти це… молитись зараз не начинай.';
  return'Мужик дивиться на вас трохи довше.\n\n– Мир?';
}
function memoryActors099(s){return memoryBranch099(s)==='prayer'?[hero099(),semen099(S099.talk),pigeon099(P099.base)]:[hero099(),semen099(S099.talk)]}
function itemQty099(s,id){return Number((s?.inventory||[]).find(x=>x?.id===id)?.qty||0)}
function memoryChoices099(s){
  const branch=memoryBranch099(s);
  if(branch==='vodka')return[
    {id:'ch4_mem_vodka_hit099',label:'Ти після неї чуть мене не вʼєбав.',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'vodka_hit'}]},
    {id:'ch4_mem_vodka_paid099',label:'Наступного разу платна.',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'vodka_paid'},{type:'relationship',person:'semen',key:'trust',value:1}]},
    {id:'ch4_mem_vodka_never099',label:'Я тобі більше не наливаю.',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'vodka_never'}]}
  ];
  if(branch==='garlic')return[
    ...(itemQty099(s,'garlic')>0?[{id:'ch4_mem_garlic_offer099',label:'Є. Хочеш?',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'garlic_offer'},{type:'relationship',person:'semen',key:'offense',value:1}]}]:[]),
    {id:'ch4_mem_garlic_calm099',label:'Та не сци.',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'garlic_calm'}]},
    {id:'ch4_mem_garlic_remember099',label:'Ти його досі памʼятаєш?',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'garlic_remember'}]}
  ];
  if(branch==='prayer')return[
    {id:'ch4_mem_prayer_start099',label:'Отче наш…',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'prayer_start'},{type:'relationship',person:'semen',key:'offense',value:1}]},
    {id:'ch4_mem_prayer_calm099',label:'Та не сци.',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'prayer_calm'}]},
    {id:'ch4_mem_prayer_evp099',label:'Подивитись на Євпапія.',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'prayer_evp'}]}
  ];
  return[
    {id:'ch4_mem_fight_peace099',label:'До наступного сараю.',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'fight_peace'},{type:'relationship',person:'semen',key:'trust',value:1}]},
    {id:'ch4_mem_fight_hands099',label:'Тільки руки при собі.',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'fight_hands'}]},
    {id:'ch4_mem_fight_unsure099',label:'Я ще не рішив.',next:'ch4_memory_reaction099',hiddenEffects:[{type:'flag',key:'ch4MemoryReply099',value:'fight_unsure'},{type:'relationship',person:'semen',key:'offense',value:1}]}
  ];
}
function memoryReactionText099(s){
  switch(s.flags?.ch4MemoryReply099){
    case'vodka_hit':return'– Ти після неї чуть мене не вʼєбав.\n\nМужик хмуриться.\n\n– Та?\n\n– Да.\n\n– Хм. Хороша була.';
    case'vodka_paid':return'– Скільки?\n\n– Я пошуткував.\n\n– А.';
    case'vodka_never':return'– Та й добре.\n\n– Шо, образився?\n\n– Нє.';
    case'garlic_offer':return'Мужик робить пів кроку назад.\n\n– Нє.\n\n– А шо так?\n\n– Іди нахуй.';
    case'garlic_calm':return'– Я не сцу.\n\n– Ага. Бачу.';
    case'garlic_remember':return'– А ти б забув?\n\n– Ну… тоже правда.';
    case'prayer_start':return'– Отче наш…\n\n– БЛЯДЬ, ХВАТИТЬ.\n\nЄвпапій збоку починає ржати.';
    case'prayer_calm':return'– Я не сцу.\n\n– Ага. Тому й попросив.';
    case'prayer_evp':return'Ви мовчки дивитесь на Євпапія.\n\n– Я взагалі нічого не казав, – одразу заявляє він.\n\n– І правильно, – буркає мужик.';
    case'fight_peace':return'– До наступного сараю.\n\n– Йде.';
    case'fight_hands':return'– Тільки руки при собі.\n\n– Домовились.';
    case'fight_unsure':return'– Я ще не рішив.\n\n– Та рішай не спіша.';
    default:return'Мужик киває, ніби питання закрите.';
  }
}
function memoryReactionActors099(s){return String(s.flags?.ch4MemoryReply099||'').startsWith('prayer_')?[hero099(),semen099(S099.side),pigeon099(P099.base)]:[hero099(),semen099(S099.side)]}
function introReplyScene099(id,text){return{...yard099,id,caption:'трупосмерд',storyPace:'calm',actors:[hero099(),semen099(S099.talk)],text,choices:[{id:`${id}_next`,label:'Далі',next:'ch4_memory099'}]}}
function rebuildChapter4099(){
  const T=CHAPTER3_SCENES,oldSon=T.ch4_son_question,oldChoices=oldSon?.choices||[];
  if(!T.ch4_intro||T.ch4_intro.__v099final)return;

  T.ch4_intro={...yard099,id:'ch4_intro',caption:'після сараю',storyPace:'calm',actors:[hero099(),pigeon099(P099.base),semen099(S099.base)],onEnter:[{type:'flag',key:'chapter4Started097',value:true},{type:'flag',key:'semenEncountered099',value:true},{type:'flag',key:'storyUrgent099',value:false}],text:`Ви стоїте у дворі біля хати баби Галі, коли на дорозі зʼявляється якийсь мужик з відром. Іде собі спокійно, ніби тут недавно ніхто ні за ким не ганявся, нікого не били й узагалі нічого дивного не відбувалось.\n\nЄвпапій помічає його раніше за вас і раптом притихає. Мужик теж дивиться у ваш бік, трохи сповільнюється, а коли підходить ближче, киває вам так буденно, ніби ви сусіди, які кожного ранку зустрічаються біля криниці.\n\n– О, мужик. Живий.\n\n– А мав не бути?\n\n– Та всяке буває.`,choices:[{id:'ch4_intro_next099',label:'Далі',next:'ch4_recognize099'}],__v099final:true};

  T.ch4_recognize099={...yard099,id:'ch4_recognize099',caption:'десь я цю морду бачив',storyPace:'calm',actors:[hero099(),semen099(S099.base)],text:`Ви вже хочете щось відповісти, але зависаєте. Голос знайомий. Та й морда ця десь уже була, тільки недавно вона виглядала значно гірше.\n\nВи придивляєтесь до нього уважніше. До нормальної сорочки, чистого обличчя, відра в руці, а тоді в голові нарешті складається те, що було біля сараю.\n\nТой самий голос. Та сама морда.\n\nТільки тепер перед вами стоїть цілком нормальний мужик, а не смердюче хуй знає шо, яке вилізло з темряви й чуть вас не вʼєбало.\n\n– ТРУПОСМЕРД?!\n\nМужик знизує плечима.\n\n– Ну, бувало.`,choices:s=>[
    {id:'ch4_reply_kill099',label:'Ти мене чуть не вбив.',next:'ch4_reply_kill099'},
    {id:'ch4_reply_often099',label:'І часто з тобою таке?',next:'ch4_reply_often099'},
    {id:'ch4_reply_broad099',label:'Виглядаєш, сука, підозріло бодро.',next:'ch4_reply_broad099'},
    ...(effectiveStat(s,'pofigism')>=2?[{id:'ch4_reply_pofig099',label:'[ПОХУЇЗМ] Ну був і був.',next:'ch4_reply_pofig099'}]:[])
  ]};

  T.ch4_reply_kill099=introReplyScene099('ch4_reply_kill099','– Та не вбив же.\n\n– Дуже заспокоїв.\n\n– Ну от.');
  T.ch4_reply_often099=introReplyScene099('ch4_reply_often099','Мужик трохи зависає.\n\n– Буває.\n\n– Це не відповідь.\n\n– Іншої нема.');
  T.ch4_reply_broad099=introReplyScene099('ch4_reply_broad099','– А шо, мав дальше смердіти?\n\n– Було б логічніше.');
  T.ch4_reply_pofig099=introReplyScene099('ch4_reply_pofig099','Мужик дивиться на вас.\n\n– І всьо?\n\n– А шо я маю зробити? Назад тебе в сарай запхати?\n\n– Нє.\n\n– Ну то йдем далі.');

  T.ch4_memory099={...yard099,id:'ch4_memory099',caption:'сарай',storyPace:'calm',actors:memoryActors099,text:memoryText099,choices:memoryChoices099};
  T.ch4_memory_reaction099={...yard099,id:'ch4_memory_reaction099',caption:'сарай',storyPace:'calm',actors:memoryReactionActors099,text:memoryReactionText099,choices:[{id:'ch4_memory_done099',label:'Далі',next:'ch4_semen_name099'}]};

  T.ch4_semen_name099={...yard099,id:'ch4_semen_name099',caption:'знайомство',storyPace:'calm',actors:[hero099(),semen099(S099.talk)],onEnter:[{type:'relationshipKnown',person:'semen',value:true},{type:'flag',key:'semenIntroduced099',value:true}],text:`Мужик поправляє відро в руці.\n\n– Семен, до речі.\n\n– А тебе як? – питає Семен.`,choices:[
    {id:'ch4_name_stepan099',label:'Степан.',next:'ch4_name_stepan099'},
    {id:'ch4_name_why099',label:'А тобі нахуя?',next:'ch4_name_why099'},
    {id:'ch4_name_muzhik099',label:'Мужик. Так мене голуб назвав.',next:'ch4_name_muzhik099'}
  ]};
  T.ch4_name_stepan099={...yard099,id:'ch4_name_stepan099',caption:'знайомство',storyPace:'calm',actors:[hero099(),semen099(S099.base)],text:'– Степан.\n\nСемен киває.\n\n– Будем знати.',choices:[{id:'ch4_name_stepan_next099',label:'Далі',next:'ch4_before_son099'}]};
  T.ch4_name_why099={...yard099,id:'ch4_name_why099',caption:'знайомство',storyPace:'calm',actors:[hero099(),semen099(S099.side)],text:'– Та просто спитав.\n\n– Ну то Степан.\n\n– О. Бачиш, не так тяжко.',choices:[{id:'ch4_name_why_next099',label:'Далі',next:'ch4_before_son099'}]};
  T.ch4_name_muzhik099={...yard099,id:'ch4_name_muzhik099',caption:'мужик другий',storyPace:'calm',actors:[hero099(),semen099(S099.talk),pigeon099(P099.base)],text:'Євпапій одразу встряє:\n\n– Не пизди. Я перший придумав.\n\nСемен киває.\n\n– Значить, Мужик Другий.\n\n– Степан, блядь.',choices:[{id:'ch4_name_muzhik_next099',label:'Далі',next:'ch4_before_son099'}]};

  T.ch4_before_son099={...yard099,id:'ch4_before_son099',caption:'ще одне',storyPace:'calm',actors:[hero099(),semen099(S099.base)],text:'Семен піднімає відро й уже збирається йти далі. Проходить кілька метрів, але потім зупиняється й озирається на вас.\n\n– Степан.\n\n– Шо?',choices:[{id:'ch4_before_son_next099',label:'Далі',next:'ch4_son_question'}]};

  T.ch4_son_question={...yard099,id:'ch4_son_question',caption:'одне питання',storyPace:'urgent',actors:[hero099(H099.worry),semen099(S099.talk)],onEnter:[{type:'flag',key:'storyUrgent099',value:true}],text:`– В тебе син є?\n\nВи кілька секунд просто дивитесь на Семена.\n\n– Шо ти сказав?\n\n– Питаю, син у тебе є?\n\n– Звідки ти знаєш?\n\nСемен не відповідає одразу. Стоїть з відром у руці й дивиться на вас так спокійно, ніби спитав, котра година.\n\n– Та не заводься ти. Живий твій малий.\n\nВи різко робите крок до нього.\n\n– Ти його бачив?\n\n– Нє.\n\n– Тоді звідки ти знаєш, шо він живий?`,choices:[{id:'ch4_son_galina099',label:'Далі',next:'ch4_son_galina099'}]};
  T.ch4_son_galina099={...yard099,id:'ch4_son_galina099',caption:'баба галя',storyPace:'urgent',actors:[hero099(H099.angry),galina099(),semen099(S099.side)],text:`За вашою спиною скриплять двері. З хати виходить баба Галя, дивиться на вас, потім на Семена й одразу хмуриться.\n\n– До мене йди.\n\n– Баб Галь, він знає про мого сина.\n\n– Я чула. Іди сюди.\n\n– А я хочу знати, звідки він знає.\n\nСемен уже збирається щось відповісти, але баба Галя перебиває:\n\n– Семене. Не треба.\n\n– А шо я?\n\n– Ти поняв.\n\nВін дивиться на неї ще секунду й замовкає.\n\nВи переводите погляд на бабу Галю.\n\n– А ви тоже знаєте?\n\nВона не відповідає одразу.`,choices:[{id:'ch4_son_reaction099',label:'Далі',next:'ch4_son_reaction099'}]};
  T.ch4_son_reaction099={...yard099,id:'ch4_son_reaction099',caption:'всі шось знають',storyPace:'urgent',actors:[hero099(H099.worry),pigeon099(P099.serious),cat099()],text:`У дверях зʼявляється Риже гамно й сідає на порозі. Євпапій підлітає ближче, але цього разу не жартує.\n\n– Мужик, не лізь зараз.\n\nВи різко дивитесь на нього.\n\n– Ти тоже знаєш?\n\n– Нє.\n\n– Тоді не пизди.\n\nЄвпапій відкриває дзьоб, але передумує. Кіт дивиться в сторону дороги. Баба Галя й Семен лишились позаду, і чим довше всі мовчать, тим сильніше бісить відчуття, що єдиний, кому тут ніхуя не пояснили, – це ви.`,choices:oldChoices};
}

// ---- Chapter 5: ДОРОГА -----------------------------------------------------------
const H5099={base:H099.base,angry:H099.angry,worry:H099.worry,son:'./ch4_stepan_son.png'};
const P5099={base:P099.base,serious:P099.serious,fly:'./pigeon_attack_095.webp'};
const yard5099={background:'./ch4_night.jpg',atmosphere:'village',chapter:5,world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'біля хати баби Галі'}]};
const road5099={background:'./ch4_fog_light.jpg',atmosphere:'silent',chapter:5,shopAccess:false,world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'стара дорога за селом'}]};
const fog5099={background:'./ch4_fog_dark.jpg',atmosphere:'silent',chapter:5,storyPace:'urgent',shopAccess:false,world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'дорога в тумані'}]};
const hero5099=(src=H5099.base)=>({role:'hero ch4-hero097',src,position:'hero'});
const semen5099=(src=S099.base)=>({role:'npc ch4-semen097',src,position:'npc'});
const pigeon5099=(src=P5099.base)=>({role:'pigeon ch4-pigeon097',src,position:'pigeon'});
const galina5099=()=>({role:'npc ch4-galina097',src:'./galina_base.png',position:'npc'});
const cat5099=()=>({role:'npc ch4-cat097',src:'./cat_base_095m.png',position:'npc'});
function ch5ChoiceFlag099(id,label,next,key,value,extra=[]){return{id,label,next,hiddenEffects:[{type:'flag',key,value},...extra]}}
function chapter5Arrival099(s){
  if(!s.flags?.chapter5TimeSet099c){
    const now=Number(s.clock?.totalMinutes||400),nextDay=Math.floor(now/1440)+1;
    s.clock={...(s.clock||{}),totalMinutes:nextDay*1440+18*60};
    s.needs={...(s.needs||{}),satiety:Math.max(72,Number(s.needs?.satiety||0)),water:Math.max(72,Number(s.needs?.water||0)),energy:Math.max(78,Number(s.needs?.energy||0))};
    s.wetness=0;
  }
  return[{type:'flag',key:'chapter5TimeSet099c',value:true},{type:'flag',key:'chapter5Started099c',value:true},{type:'flag',key:'storyUrgent099',value:false}];
}
function ch5EvpReplyText099(s){
  switch(s.flags?.ch5EvpReply099c){
    case'trust':return'– Я їй вірю. Просто хочу знати більше.\n\n– Ну то це вже друга проблема.\n\n– Дуже помогло.\n\n– Обращайся.';
    case'semen':return'– Семен шось недоговорює.\n\n– Семен взагалі виглядає так, ніби половину життя недоговорює.';
    default:return'– Тут всі шось недоговорюють.\n\nЄвпапій задумується.\n\n– Я договорюю.\n\n– Ти половину часу несеш хуйню.\n\n– Але до кінця.';
  }
}
function ch5SemenReplyText099(s){
  switch(s.flags?.ch5SemenQuestion099c){
    case'voice':return'– Дитячий. Хлопчик.\n\n– І ти рішив, шо це мій син?\n\n– Не рішив. Тому й спитав.';
    case'where':return'Семен киває в сторону дороги за селом.\n\n– Там.\n\n– «Там» – це дуже конкретно.\n\n– Біля старої дороги.';
    case'dont':return'– Я не начинаю. Просто кажу, шо чув.\n\n– Баба Галя тобі вчора ясно сказала заткнутись.\n\n– Я вже заткнувся. Вчора.';
    default:return'– Якщо ти зараз пиздиш про мого сина…\n\n– Я не пизджу.\n\n– Я навіть не договорив.\n\n– А я наперед.';
  }
}
function ch5GalinaReplyText099(s){
  let text='';
  switch(s.flags?.ch5GalinaReply099c){
    case'ok':text='– Ви ж казали, шо з ним усе добре.\n\n– І зараз кажу.\n\nБаба Галя стискає вашу руку.\n\n– Саме тому не йди.';break;
    case'who':text='– Тоді хто це?\n\n– Не знаю.\n\n– Ви брешете.\n\n– Може. Але зараз послухай мене.';break;
    case'know':text='– Звідки ви знаєте, шо то не він?\n\n– Бо знаю, як воно працює.\n\n– Як шо працює?\n\n– Не зараз.';break;
    default:text='– Відпустіть мене.\n\n– Нє.\n\n– Баб Галь.\n\n– Хоч обматюкай мене. Тільки не йди.';break;
  }
  return `${text}\n\nВи смикаєте руку на себе. Цього разу баба Галя не тримає.`;
}
function ch5VoiceAgainText099(s){
  let memory='';
  if(s.flags?.ch5AskedGalina099c)memory='\n\nВ голові одразу спливає її попередження: якщо звідти когось почуєш – не відповідай.';
  else if(s.flags?.ch5CheckedRoad099c)memory='\n\nВи вже ходили сьогодні до цієї дороги. Тоді там не було нікого.';
  return`Із туману знову:\n\n– Тату…\n\nЦього разу тихіше. Потім:\n\n– Тату, ти де?\n\nУ вас холоне всередині. Саме так він кликав вас малим, коли губив із виду.${memory}\n\nБаба Галя за спиною різко каже:\n\n– Не відповідай.`;
}
function ch5PassSemenText099(s){
  const watch=s.flags?.ch5FogDecision099c==='watch';
  return`${watch?'Ви проходите повз Семена, але краєм ока не випускаєте його з поля зору.':'Проходячи повз Семена, ви зупиняєтесь.'}\n\n– Якщо там нема мого сина…\n\nСемен дивиться вам прямо в очі.\n\n– Я тебе туди не посилав.\n\nПауза.\n\n– Я знаю.\n\nВи йдете далі. Семен лишається стояти на місці.`;
}
function rebuildChapter5099c(){
  const T=CHAPTER3_SCENES;

  // New ending of chapter 4. The old fog sequence is no longer reachable from chapter 4.
  T.ch4_son_reaction099={...yard099,id:'ch4_son_reaction099',caption:'не зараз',storyPace:'urgent',shopAccess:false,actors:[hero099(H099.worry),galina099(),semen099(S099.side)],text:`– Баб Галь, ви знаєте, де він?\n\nВона дивиться на вас довше, ніж хотілося б.\n\n– Нє.\n\n– Тоді звідки ви знаєте, шо з ним усе добре?\n\n– Бо знаю. І з ним усе добре.\n\nСемен відкриває рот, але баба Галя навіть не повертається до нього.\n\n– Семене. Досить.\n\nВін знизує плечима й мовчить.\n\n– А мені шо робити? – питаєте ви.\n\n– Сьогодні – нічого. Іди в хату. Завтра поговоримо.\n\nВід цього легше не стає ні на грам.`,choices:[{id:'ch4_finish099c',label:'Далі',next:'ch4_end099c'}]};
  T.ch4_end099c={...yard099,id:'ch4_end099c',caption:'кінець глави',storyPace:'calm',shopAccess:false,actors:[hero099(),pigeon099(P099.base)],onEnter:[{type:'flag',key:'chapter4Complete099c',value:true},{type:'flag',key:'storyUrgent099',value:false}],text:`Семен піднімає відро й іде дорогою, ніби нічого особливого не сказав. Баба Галя повертається до хати.\n\nВи ще трохи стоїте у дворі й дивитесь їм услід. Євпапій мовчить поруч, що саме по собі вже трохи напрягає.\n\nНа сьогодні відповідей більше не буде.`,choices:[{id:'ch5_start099c',label:'Наступний день',next:'ch5_intro'}]};

  T.ch5_intro={...yard5099,id:'ch5_intro',caption:'ДОРОГА',storyPace:'calm',actors:[hero5099(),pigeon5099(P5099.base)],onEnter:chapter5Arrival099,text:`Наступного дня під вечір ви сидите біля хати. Євпапій крутиться поруч.\n\n– Ну шо, мужик.\n\nВи дивитесь на нього.\n\n– Шо?\n\n– Нічо. Проверяв.\n\n– Шо проверяв?\n\n– Чи відкликаєшся.\n\n– І?\n\n– Відкликаєшся.\n\n– А чого ти мене весь час мужиком називаєш?\n\n– Привик.`,choices:[{id:'ch5_intro_next099c',label:'Далі',next:'ch5_evp_son099c'}]};

  T.ch5_evp_son099c={...yard5099,id:'ch5_evp_son099c',caption:'малий',storyPace:'calm',actors:[hero5099(),pigeon5099(P5099.base)],text:`Євпапій якийсь час мовчить, потім коситься на вас.\n\n– Ти про малого думаєш?\n\n– А ти як думаєш?\n\n– Думаю, шо баба сказала – все добре.\n\n– А я думаю, шо від цього ні хуя не легше.`,choices:[
    ch5ChoiceFlag099('ch5_evp_trust099c','Я їй вірю. Просто хочу знати більше.','ch5_evp_reply099c','ch5EvpReply099c','trust'),
    ch5ChoiceFlag099('ch5_evp_semen099c','Семен шось недоговорює.','ch5_evp_reply099c','ch5EvpReply099c','semen'),
    ch5ChoiceFlag099('ch5_evp_all099c','Тут всі шось недоговорюють.','ch5_evp_reply099c','ch5EvpReply099c','all')
  ]};
  T.ch5_evp_reply099c={...yard5099,id:'ch5_evp_reply099c',caption:'дуже помогло',storyPace:'calm',actors:[hero5099(),pigeon5099(P5099.base)],text:ch5EvpReplyText099,choices:[{id:'ch5_evp_reply_next099c',label:'Далі',next:'ch5_semen_arrives099c'}]};

  T.ch5_semen_arrives099c={...yard5099,id:'ch5_semen_arrives099c',caption:'не договорив',storyPace:'calm',shopAccess:false,actors:[hero5099(),semen5099(S099.talk)],text:`По дорозі зʼявляється Семен. Цього разу без відра. Він підходить ближче.\n\n– Степан.\n\n– Шо?\n\n– Я вчора не договорив.\n\nВи одразу напружуєтесь.\n\n– Про малого?\n\nСемен киває.\n\n– До того, як тебе спитав… я голос чув.`,choices:[
    ch5ChoiceFlag099('ch5_semen_voice099c','Який голос?','ch5_semen_reply099c','ch5SemenQuestion099c','voice'),
    ch5ChoiceFlag099('ch5_semen_where099c','Де?','ch5_semen_reply099c','ch5SemenQuestion099c','where'),
    ch5ChoiceFlag099('ch5_semen_dont099c','Семене, не починай.','ch5_semen_reply099c','ch5SemenQuestion099c','dont'),
    ...(false?[]:[])
  ]};
  // Add the status-gated angry answer without making the static array unreadable.
  T.ch5_semen_arrives099c.choices=s=>[
    ch5ChoiceFlag099('ch5_semen_voice099c','Який голос?','ch5_semen_reply099c','ch5SemenQuestion099c','voice'),
    ch5ChoiceFlag099('ch5_semen_where099c','Де?','ch5_semen_reply099c','ch5SemenQuestion099c','where'),
    ch5ChoiceFlag099('ch5_semen_dont099c','Семене, не починай.','ch5_semen_reply099c','ch5SemenQuestion099c','dont'),
    ...(s.activeStatuses?.includes('angry')?[ch5ChoiceFlag099('ch5_semen_angry099c','[ЗЛИЙ] Якщо ти зараз пиздиш про мого сина…','ch5_semen_reply099c','ch5SemenQuestion099c','angry')]:[])
  ];
  T.ch5_semen_reply099c={...yard5099,id:'ch5_semen_reply099c',caption:'голос',storyPace:'calm',shopAccess:false,actors:[hero5099(H5099.worry),semen5099(S099.side)],text:ch5SemenReplyText099,choices:[{id:'ch5_semen_reply_next099c',label:'Далі',next:'ch5_semen_tatu099c'}]};
  T.ch5_semen_tatu099c={...yard5099,id:'ch5_semen_tatu099c',caption:'тату',storyPace:'calm',shopAccess:false,actors:[hero5099(H5099.worry),semen5099(S099.talk)],text:`– І шо він казав?\n\nСемен дивиться кудись убік.\n\n– «Тату».\n\nВи мовчите.\n\n– Один раз?\n\n– Кілька.\n\n– Чого ти вчора не сказав?\n\n– Ти бачив бабу Галю.\n\nВи продовжуєте дивитись на нього. Семен знизує плечима.\n\n– Я тебе нікуди не кличу. Просто сказав.\n\nІ йде.`,choices:[{id:'ch5_tatu_next099c',label:'Далі',next:'ch5_evp_suspicion099c'}]};
  T.ch5_evp_suspicion099c={...yard5099,id:'ch5_evp_suspicion099c',caption:'дуже конкретне уточнення',storyPace:'calm',shopAccess:false,actors:[hero5099(),pigeon5099(P5099.serious)],text:`Євпапій дивиться Семену вслід.\n\n– Мені він не нравиться.\n\n– Ти з ним учора нормально здоровкався.\n\n– Я багато з ким здороваюсь. Це не значить, шо я їм довіряю.\n\n– Шо конкретно тобі не нравиться?\n\n– Він дуже старався пояснити, шо тебе нікуди не кличе.\n\nВи теж дивитесь на дорогу.\n\n– І?\n\n– А ти багато знаєш людей, які просто так уточняють, шо вони тебе нікуди не заманюють?\n\nПауза.\n\n– Блядь.\n\n– Отож.`,choices:[
    {id:'ch5_go_galina099c',label:'Піти до баби Галі.',next:'ch5_galina_warning099c',hiddenEffects:[{type:'flag',key:'ch5AskedGalina099c',value:true}]},
    {id:'ch5_go_road099c',label:'Глянути на ту дорогу.',next:'ch5_check_road099c',hiddenEffects:[{type:'flag',key:'ch5CheckedRoad099c',value:true}]},
    {id:'ch5_ignore_semen099c',label:'Забити на Семена.',next:'ch5_ignore099c',hiddenEffects:[{type:'flag',key:'ch5IgnoredSemen099c',value:true}]}
  ]};

  T.ch5_galina_warning099c={...yard5099,id:'ch5_galina_warning099c',caption:'не ходи',storyPace:'calm',shopAccess:false,actors:[hero5099(),galina5099()],text:`– Баб Галь.\n\nВона тільки дивиться на ваше лице.\n\n– Семен приходив.\n\n– Я вже поняла.\n\n– Каже, чув дитину біля старої дороги.\n\nБаба Галя завмирає.\n\n– Туди не ходи.\n\n– Чого?\n\n– Бо я сказала.\n\n– Дуже переконливо.\n\nВона підходить ближче.\n\n– І ще одне. Якщо звідти когось почуєш – не відповідай.\n\n– Кого?\n\n– Нікого.`,choices:[{id:'ch5_galina_warning_next099c',label:'Далі',next:'ch5_evening_cat099c'}]};
  T.ch5_check_road099c={...road5099,id:'ch5_check_road099c',caption:'стара дорога',storyPace:'calm',shopAccess:false,actors:[hero5099(),pigeon5099(P5099.base)],text:`Ви доходите тільки до краю села. Далі звичайна мокра дорога. Поле. Кущі. Ніяких дітей.\n\nЄвпапій сідає на паркан.\n\n– Ну?\n\n– Нічого.\n\n– Поздравляю. Семен показав тобі дорогу.\n\n– Хочеш медаль?\n\n– Хочу сало.\n\n– В тебе одна думка в голові?\n\n– Нє. Ще бабине підвіконня.\n\nПісля цього ви розвертаєтесь і йдете назад до хати.`,choices:[{id:'ch5_check_road_next099c',label:'Далі',next:'ch5_evening_cat099c'}]};
  T.ch5_ignore099c={...yard5099,id:'ch5_ignore099c',caption:'та ну його',storyPace:'calm',shopAccess:false,actors:[hero5099(),pigeon5099(P5099.base)],text:`– Та ну його нахуй.\n\n– Розумне рішення.\n\nВи дивитесь на Євпапія.\n\n– Аж підозріло, шо ти погодився.\n\n– Я тоже іноді в ахуї від себе.\n\nВи йдете назад до хати.`,choices:[{id:'ch5_ignore_next099c',label:'Далі',next:'ch5_evening_cat099c'}]};

  T.ch5_evening_cat099c={...road5099,id:'ch5_evening_cat099c',caption:'туман',storyPace:'urgent',actors:[hero5099(),cat5099()],onEnter:[{type:'flag',key:'storyUrgent099',value:true}],text:`До вечора стає прохолодніше. Риже гамно раптом виходить із двору й зупиняється посеред дороги.\n\nВи проходите повз, але кіт не рухається.\n\n– Ти там шо побачив?\n\nКіт дивиться вперед. Хвіст повільно опускається.\n\nВи теж дивитесь.\n\nМіж хатами стелиться туман.`,choices:[{id:'ch5_cat_next099c',label:'Далі',next:'ch5_evp_fog099c'}]};
  T.ch5_evp_fog099c={...road5099,id:'ch5_evp_fog099c',caption:'назад',storyPace:'urgent',actors:[hero5099(),pigeon5099(P5099.serious)],text:`Євпапій сідає поруч. Дивиться на туман. Потім на кота.\n\n– Оце мені вже не нравиться.\n\n– Ти бачив таке?\n\n– Туман?\n\n– Не прикидайся довбойобом.\n\n– Я не прикидаюсь.\n\nПауза.\n\n– Євпапій.\n\nГолуб уже не жартує.\n\n– Я би назад пішов.`,choices:[{id:'ch5_evp_fog_next099c',label:'Далі',next:'ch5_first_voice099c'}]};
  T.ch5_first_voice099c={...road5099,id:'ch5_first_voice099c',caption:'тату',storyPace:'urgent',actors:[hero5099(H5099.worry)],text:`Ви вже розвертаєтесь до хати, коли з дороги долинає тихе:\n\n– Тату?\n\nВи завмираєте. Голос дитячий. Знайомий настільки, що в першу секунду ви навіть не думаєте, звідки він тут.\n\nЗнову:\n\n– Тату?`,choices:s=>[
    ch5ChoiceFlag099('ch5_voice_son099c','Синку?','ch5_semen_hears099c','ch5FirstVoiceReply099c','son'),
    ch5ChoiceFlag099('ch5_voice_here099c','Я тут!','ch5_semen_hears099c','ch5FirstVoiceReply099c','here'),
    ch5ChoiceFlag099('ch5_voice_where099c','Де ти?','ch5_semen_hears099c','ch5FirstVoiceReply099c','where'),
    ...(s.activeStatuses?.includes('suspicious')?[ch5ChoiceFlag099('ch5_voice_susp099c','[СОБАКА-ПОДОЗРЄВАКА] Хто це?','ch5_semen_hears099c','ch5FirstVoiceReply099c','suspicious')]:[])
  ]};
  T.ch5_semen_hears099c={...road5099,id:'ch5_semen_hears099c',caption:'про це й казав',storyPace:'urgent',actors:[hero5099(H5099.worry),semen5099(S099.side)],text:`Щойно ви відповідаєте, збоку чути:\n\n– От. Про це я й казав.\n\nСемен стоїть неподалік і дивиться в туман. Ви різко повертаєтесь до нього.\n\n– Ти тоже це чув?\n\n– Чув.\n\n– Де він?\n\nСемен киває на дорогу.\n\n– Звідти.\n\n– Ти його бачиш?\n\n– Нє.\n\nІ додає:\n\n– Але голос звідти.`,choices:[{id:'ch5_semen_hears_next099c',label:'Далі',next:'ch5_galina_stops099c'}]};
  T.ch5_galina_stops099c={...road5099,id:'ch5_galina_stops099c',caption:'стій',storyPace:'urgent',actors:[hero5099(H5099.worry),galina5099()],text:`– СТІЙ.\n\nБаба Галя майже біжить до вас із двору й хапає за руку.\n\n– До хати.\n\n– Там мій син.\n\n– Нема там твого сина.\n\n– Я його чув.\n\n– Чула.\n\n– То якого хуя…\n\n– Бо то не він.\n\nВи завмираєте.`,choices:s=>[
    ch5ChoiceFlag099('ch5_gal_ok099c','Ви ж казали, шо з ним усе добре.','ch5_galina_reply099c','ch5GalinaReply099c','ok'),
    ch5ChoiceFlag099('ch5_gal_who099c','Тоді хто це?','ch5_galina_reply099c','ch5GalinaReply099c','who'),
    ch5ChoiceFlag099('ch5_gal_know099c','Звідки ви знаєте?','ch5_galina_reply099c','ch5GalinaReply099c','know'),
    ...(s.activeStatuses?.includes('angry')?[ch5ChoiceFlag099('ch5_gal_angry099c','[ЗЛИЙ] Відпустіть мене.','ch5_galina_reply099c','ch5GalinaReply099c','angry')]:[])
  ]};
  T.ch5_galina_reply099c={...road5099,id:'ch5_galina_reply099c',caption:'не йди',storyPace:'urgent',actors:[hero5099(H5099.worry),galina5099()],text:ch5GalinaReplyText099,choices:[{id:'ch5_galina_reply_next099c',label:'Далі',next:'ch5_voice_again099c'}]};
  T.ch5_voice_again099c={...road5099,id:'ch5_voice_again099c',caption:'не відповідай',storyPace:'urgent',actors:[hero5099(H5099.son)],text:ch5VoiceAgainText099,choices:[{id:'ch5_voice_again_next099c',label:'Далі',next:'ch5_evp_blocks099c'}]};
  T.ch5_evp_blocks099c={...road5099,id:'ch5_evp_blocks099c',caption:'нє',storyPace:'urgent',actors:[hero5099(H5099.worry),pigeon5099(P5099.serious)],text:`Євпапій сідає просто перед вами на дорогу.\n\n– Мужик.\n\n– Відійди.\n\n– Нє.\n\n– Євпапій.\n\n– Я сказав нє.\n\nВи дивитесь повз нього в туман.\n\n– А якщо це реально він?\n\n– А якщо нє?\n\n– Я мушу перевірити.\n\nЄвпапій не рухається.\n\n– Ти вже один раз відповів. Хватить.`,choices:s=>[
    ch5ChoiceFlag099('ch5_fog_look099c','Я тільки гляну.','ch5_pass_semen099c','ch5FogDecision099c','look'),
    ch5ChoiceFlag099('ch5_fog_son099c','Синку, стій! Я йду.','ch5_pass_semen099c','ch5FogDecision099c','son',[{type:'memory',person:'evpapiy',key:'stepanCalledIntoFog099c',value:true}]),
    ...(s.activeStatuses?.includes('angry')?[ch5ChoiceFlag099('ch5_fog_angry099c','[ЗЛИЙ] Якщо це хтось прикалується – йому пизда.','ch5_pass_semen099c','ch5FogDecision099c','angry')]:[]),
    ...(s.activeStatuses?.includes('suspicious')?[ch5ChoiceFlag099('ch5_fog_watch099c','[СОБАКА-ПОДОЗРЄВАКА] Піти, але не випускати Семена з поля зору.','ch5_pass_semen099c','ch5FogDecision099c','watch')]:[]),
    ...(s.activeStatuses?.includes('tired')?[ch5ChoiceFlag099('ch5_fog_tired099c','[ЗАЄБАВСЯ] Один раз гляну – і всьо.','ch5_pass_semen099c','ch5FogDecision099c','tired')]:[])
  ]};
  T.ch5_pass_semen099c={...road5099,id:'ch5_pass_semen099c',caption:'я тебе не посилав',storyPace:'urgent',actors:[hero5099(H5099.worry),semen5099(S099.side)],text:ch5PassSemenText099,choices:[{id:'ch5_pass_semen_next099c',label:'Далі',next:'ch5_into_fog099c'}]};
  T.ch5_into_fog099c={...fog5099,id:'ch5_into_fog099c',caption:'далі',actors:[hero5099(H5099.son),pigeon5099(P5099.serious)],text:`Євпапій летить слідом.\n\n– Мужик, вертайся.\n\n– Я тільки перевірю.\n\n– Це вже звучить як хуйова ідея.\n\n– Ти можеш не летіти.\n\n– Ага. Щас.\n\nТуман стає густішим. Хати позаду починають зникати.`,choices:[{id:'ch5_into_fog_next099c',label:'Далі',next:'ch5_voice_deeper099c'}]};
  T.ch5_voice_deeper099c={...fog5099,id:'ch5_voice_deeper099c',caption:'тату, сюди',actors:[hero5099(H5099.son),pigeon5099(P5099.fly)],text:`– Тату, сюди!\n\nВи пришвидшуєтесь.\n\n– Мужик, стій.\n\nГолос знову:\n\n– Тату!\n\nВи йдете швидше. Євпапій різко залітає перед вами.\n\n– Я СКАЗАВ СТІЙ!\n\nВи обходите його.`,choices:[{id:'ch5_voice_deeper_next099c',label:'Далі',next:'ch5_name_shout099c'}]};
  T.ch5_name_shout099c={...fog5099,id:'ch5_name_shout099c',caption:'степане',actors:[hero5099(H5099.worry),pigeon5099(P5099.serious)],text:`– СТЕПАНЕ!\n\nВи різко зупиняєтесь. За весь час Євпапій жодного разу не звертався до вас по імені.\n\n– Шо?\n\nВін нічого не відповідає. Просто дивиться вам за спину.`,choices:[{id:'ch5_name_shout_next099c',label:'Далі',next:'ch5_no_road099c'}]};
  T.ch5_no_road099c={...fog5099,id:'ch5_no_road099c',caption:'дороги нема',actors:[hero5099(H5099.worry),pigeon5099(P5099.serious)],text:`Ви обертаєтесь.\n\nДороги назад нема. Ні хати баби Галі. Ні паркану. Ні Семена. Тільки білий туман.\n\n– Блядь, – тихо каже Євпапій.\n\n– Де дорога?\n\n– Я єбу?\n\nІ цього разу навіть він звучить налякано.`,choices:[{id:'ch5_no_road_next099c',label:'Далі',next:'ch5_figure099c'}]};
  T.ch5_figure099c={...fog5099,id:'ch5_figure099c',caption:'постать',actors:[hero5099(H5099.son)],text:`– Тату…\n\nВи повертаєтесь на голос. Попереду в тумані стоїть темна постать. Ні лиця, ні одягу не розгледіти.\n\n– Синку?\n\nПостать ніби відходить далі.\n\n– Тату, сюди.\n\nВи робите крок.`,choices:[{id:'ch5_figure_next099c',label:'Далі',next:'ch5_evp_grabs099c'}]};
  T.ch5_evp_grabs099c={...fog5099,id:'ch5_evp_grabs099c',caption:'не йди',actors:[hero5099(H5099.son),pigeon5099(P5099.fly)],text:`Євпапій хапає вас кігтями за плече.\n\n– Не йди.\n\n– Відпусти.\n\n– Нє.\n\n– Там мій син.\n\n– ТИ НЕ ЗНАЄШ, ШО ТАМ.\n\nВи смикаєтесь. Євпапій злітає з плеча.\n\nІ ви робите ще один крок.`,choices:[{id:'ch5_evp_grabs_next099c',label:'Далі',next:'ch5_fall099c'}]};
  T.ch5_fall099c={...fog5099,id:'ch5_fall099c',caption:'темно',actors:[hero5099(H5099.son)],onEnter:[{type:'flag',key:'chapter5Complete099c',value:true}],text:`Під ногою немає землі.\n\nВи навіть не встигаєте нормально зрозуміти, що сталося. Світ різко провалюється вниз.\n\nОстаннє, що ви чуєте:\n\n– СТЕПАНЕ!\n\nТемно.`,choices:[{id:'ch6_start099d',label:'Далі',next:'ch6_intro099d'}]};
  T.ch5_evp_crash099c={...road5099,id:'ch5_evp_crash099c',caption:'де степан',storyPace:'urgent',actors:[pigeon5099(P5099.base),cat5099()],text:`Євпапій з розгону вилітає з туману й їбеться мордою в мокру землю. Піднімає голову.\n\nДорога знову на місці. Степана нема.\n\nЧерез кілька секунд підбігає Риже гамно й зупиняється поруч.\n\n– Мужик?\n\nТиша.\n\nЄвпапій підлітає вище.\n\n– СТЕПАНЕ!\n\nНіхуя.`,choices:[{id:'ch5_evp_crash_next099c',label:'Далі',next:'ch5_evp_search099c'}]};
  T.ch5_evp_search099c={...road5099,id:'ch5_evp_search099c',caption:'степан зник',storyPace:'calm',actors:[pigeon5099(P5099.base),cat5099()],onEnter:[{type:'flag',key:'ch4StepanMissing',value:true},{type:'flag',key:'ch5StepanMissing099c',value:true},{type:'flag',key:'activeHero097',value:'evpapiy'},{type:'flag',key:'chapter5Complete099c',value:true},{type:'flag',key:'storyUrgent099',value:false}],text:`Євпапій сідає просто в багнюку.\n\n– Блядь.\n\nКіт дивиться на нього.\n\n– Тільки не кажи, шо ти тоже ніхуя не поняв.\n\nРиже гамно повертає голову до туману. Євпапій теж дивиться туди.\n\n– Заєбісь.\n\nВін піднімається.\n\n– Пішли.\n\nКіт не рухається.\n\n– Треба зрозуміти, куди цей довбойоб дівся.\n\nРиже гамно ще секунду дивиться на порожню дорогу, потім іде в сторону села. Євпапій летить за ним.`,notice:{title:'СТЕПАН ЗНИК',body:'КЕРУВАННЯ ПЕРЕХОДИТЬ ДО ЄВПАПІЯ'},end:true,choices:[]};
}


// ---- Chapter 6: ЄВПАПІЙ ----------------------------------------------------------
const road6099={background:'./ch4_fog_light.jpg',atmosphere:'silent',chapter:6,storyPace:'urgent',shopAccess:false,world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'стара дорога за селом'}]};
const yard6099={background:'./ch4_night.jpg',atmosphere:'village',chapter:6,storyPace:'urgent',shopAccess:false,world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'біля хати баби Галі'}]};
function rebuildChapter6099d(){
  const T=CHAPTER3_SCENES;
  // Chapter 5 now ends on Степан's fall. The crash/search beat belongs to chapter 6.
  if(T.ch5_fall099c)T.ch5_fall099c.choices=[{id:'ch6_start099d',label:'Далі',next:'ch6_intro099d'}];

  T.ch6_intro099d={...road6099,id:'ch6_intro099d',caption:'де мужик',actors:[pigeon5099(P5099.base),cat5099()],onEnter:[
    {type:'flag',key:'chapter6Started099d',value:true},
    {type:'flag',key:'chapter5Complete099c',value:true},
    {type:'flag',key:'ch4StepanMissing',value:true},
    {type:'flag',key:'ch5StepanMissing099c',value:true},
    {type:'flag',key:'activeHero097',value:'evpapiy'},
    {type:'flag',key:'storyUrgent099',value:true}
  ],text:`Євпапій вилітає з туману й зі всього розгону їбеться об дорогу. Кілька секунд лежить, розпластавши крила, потім піднімає голову. Туману майже нема. Степана теж.\n\n– Блядь. Мужик? Мужик, хорош прикалуватись.\n\nТиша. Євпапій підлітає вище, оглядає дорогу, але ні слідів, ні Степана. З узбіччя чути шурхіт, і з темряви виходить Риже гамно. Кіт дивиться туди, де щойно був туман.\n\n– Тільки не кажи, шо ти тоже ніхуя не поняв.`,notice:{title:'СТЕПАН ЗНИК',body:'КЕРУВАННЯ ПЕРЕХОДИТЬ ДО ЄВПАПІЯ'},choices:[{id:'ch6_intro_next099d',label:'Далі',next:'ch6_name099d'}]};

  T.ch6_name099d={...road6099,id:'ch6_name099d',caption:'степане',actors:[pigeon5099(P5099.serious),cat5099()],text:`Кіт мовчки розвертається й іде в бік села. Євпапій ще раз дивиться на порожню дорогу.\n\n– СТЕПАНЕ!\n\nНіхуя.\n\nІмʼя цього разу звучить уже не як підйоб. Євпапій ще секунду дивиться на порожню дорогу, тоді летить за котом.`,choices:[{id:'ch6_name_next099d',label:'Далі',next:'ch6_yard099d'}]};

  T.ch6_yard099d={...yard6099,id:'ch6_yard099d',caption:'де мужик',actors:[pigeon5099(P5099.serious),semen5099(S099.side),galina5099()],text:`Біля хати баби Галі стоїть Семен. Баба на ґанку. Побачивши Євпапія, обоє замовкають. Голуб сідає просто перед Семеном.\n\n– Де мужик?\n\n– Який?\n\n– Ти зараз серйозно?\n\n– Я його не тягнув.\n\n– А я не питав, чи ти його тягнув. Я спитав, де він.\n\n– Значить, перейшов.\n\n– Куди?\n\n– Євпапію, – втручається баба Галя.\n\n– Не начинай. Він пішов у ту хуйню, дорога пропала, я вилетів назад, а його нема.`,choices:[{id:'ch6_yard_next099d',label:'Далі',next:'ch6_accuse099d'}]};

  T.ch6_accuse099d={...yard6099,id:'ch6_accuse099d',caption:'ти знав?',actors:[pigeon5099(P5099.serious),semen5099(S099.side)],text:`Семен відводить очі. Євпапій уже дивиться тільки на нього.\n\n– Він пішов туди, бо ти сказав про малого. Ти сказав, шо він його кликав. А потім показав, куди йти. Ти знав, шо буде?\n\n– Нє.\n\n– Пиздиш.\n\n– Не пизджу.\n\n– В тебе рожа така.\n\n– Яка?\n\n– Пиздюча.\n\nСемен уже не усміхається.\n\n– Я його пальцем не тронув.\n\n– Ага. І це чогось звучить ще гірше.`,choices:[{id:'ch6_accuse_next099d',label:'Далі',next:'ch6_salo099d'}]};

  T.ch6_salo099d={...yard6099,id:'ch6_salo099d',caption:'недоказано',actors:[pigeon5099(P5099.base),cat5099(),galina5099()],text:`У двір заходить Риже гамно й одразу помічає миску із салом біля ґанку. Євпапій теж коситься туди.\n\n– Навіть не думай, – каже баба Галя.\n\n– Та мені нахуй не треба ваше сало.\n\nКіт повільно переводить погляд на голуба.\n\n– Чого ти на мене так дивишся?\n\n– Бо минулого разу тоже «не треба» було, – каже баба Галя.\n\n– Недоказано.`,choices:[{id:'ch6_salo_next099d',label:'Далі',next:'ch6_darina099d'}]};

  T.ch6_darina099d={...yard6099,id:'ch6_darina099d',caption:'дарина',actors:[pigeon5099(P5099.base),semen5099(S099.side),galina5099()],onEnter:[{type:'flag',key:'darinaAppeared099d',value:true}],text:`І тут із-за хвіртки чути жіночий голос:\n\n– А шо тут опять сталося?\n\nЗаходить Дарина.`,end:true,choices:[]};
}

function freshChapter6TestState099d(){
  let s=freshChapter5TestState099c();
  s.chapter=6;s.scene='ch6_intro099d';
  s.story={...(s.story||{}),chapter:6,sceneId:'ch6_intro099d',entered:[...new Set([...(s.story?.entered||[]),'ch5_intro','ch5_evening_cat099c','ch5_into_fog099c','ch5_fall099c'])],finished:false};
  s.flags={...(s.flags||{}),testFreshChapter6099d:true,chapter5Complete099c:true,ch4StepanMissing:true,ch5StepanMissing099c:true,activeHero097:'evpapiy',storyUrgent099:true};
  s.clock={...(s.clock||{}),totalMinutes:1440+18*60};
  s.needs={...(s.needs||{}),satiety:Math.max(72,Number(s.needs?.satiety||0)),water:Math.max(72,Number(s.needs?.water||0)),energy:Math.max(78,Number(s.needs?.energy||0))};
  s=normalizeState(s);s.chapter=6;s.scene='ch6_intro099d';s.story={...(s.story||{}),chapter:6,sceneId:'ch6_intro099d',finished:false};s.flags={...(s.flags||{}),testMode:true,testFreshChapter6099d:true,chapter5Complete099c:true,ch4StepanMissing:true,ch5StepanMissing099c:true,activeHero097:'evpapiy',storyUrgent099:true};
  return s;
}
async function launchChapter6Test099d(e){
  e?.preventDefault?.();e?.stopPropagation?.();saveTestConfig099b();
  try{await clearRun(99)}catch{}
  await saveRun(freshChapter6TestState099d());
  try{localStorage.setItem('dnt-autostart-test099b','1')}catch{}
  location.reload();
}

function freshChapter5TestState099c(){
  let s=freshChapter4TestState099b('fight');
  s.chapter=5;s.scene='ch5_intro';
  s.story={...(s.story||{}),chapter:5,sceneId:'ch5_intro',entered:[...new Set([...(s.story?.entered||[]),'ch4_intro','ch4_recognize099','ch4_semen_name099','ch4_son_question','ch4_son_reaction099','ch4_end099c'])],finished:false};
  s.flags={...(s.flags||{}),testFreshChapter5099c:true,chapter4Complete099c:true,semenEncountered099:true,semenIntroduced099:true,storyUrgent099:false};
  delete s.flags.ch4StepanMissing;delete s.flags.ch5StepanMissing099c;delete s.flags.activeHero097;delete s.flags.chapter5TimeSet099c;
  s.relationships=s.relationships||{};s.relationships.semen={...(s.relationships.semen||{name:'Семен',values:{trust:0,offense:0},discoveredParams:[]}),known:true};
  s=normalizeState(s);s.chapter=5;s.scene='ch5_intro';s.story={...(s.story||{}),chapter:5,sceneId:'ch5_intro',finished:false};
  return s;
}
async function launchChapter5Test099c(e){
  e?.preventDefault?.();e?.stopPropagation?.();saveTestConfig099b();
  try{await clearRun(99)}catch{}
  await saveRun(freshChapter5TestState099c());
  try{localStorage.setItem('dnt-autostart-test099b','1')}catch{}
  location.reload();
}

// ---- Reported story-flow fixes v0.9.9b -------------------------------------------
function canFitItem099(s,id){return itemQty099(s,id)>0||(s?.inventory||[]).length<16}
function fixReportedFlow099b(){
  // Chapter 2: undo the old scene merge so taking Євпапій in hand is actually shown before the peck.
  const C2=CHAPTER2_SCENES;
  if(C2.ch2_real){
    C2.ch2_real.onEnter=[{type:'stat',key:'ahui',value:1},{type:'memory',person:'evpapiy',key:'heroFinallyBelieved',value:true}];
    C2.ch2_real.text=`Євпапій злітає з паркану й сідає вам на голову. Походу, вирішив, що тут тепер його гніздо.\n\nІ тут ви ловите себе на думці, що будуняк уже наче попускає. До цього ще можна було списати все на ту палену горілку: прокинулись хуй зна де, заговорив голуб – ну мало лі. Але зараз голова вже більш-менш ясна.\n\nВи знімаєте Євпапія з голови й берете в руки. Теплий. Жирний. Справжній.\n\n– Шо робиш, їбанько?\n\nВи ще секунду дивитесь на нього.\n\nРеально говорить.`;
    C2.ch2_real.choices=[{id:'ch2_real_next',label:'Далі',next:'ch2_crowd'}];
  }
  if(C2.ch2_crowd){
    C2.ch2_crowd.onEnter=[{type:'damage',amount:1,ignoreArmor:true},{type:'flag',key:'pigeonPeckedFinger',value:true}];
    C2.ch2_crowd.text=`Євпапій клює вас у палець, виривається й відлітає трохи далі. Ви дивитесь йому вслід.\n\nПіздець.\n\nА ще ця жирна падла досі винна вам за куртку.\n\nЩе зранку село виглядало так, ніби всі разом вирішили повмирати по хатах, а тепер майже всі зібрались в одному дворі. Чоловіки тягають лавки, жінки носять миски й глечики, хтось накриває довгий стіл. Після дощу під ногами болото, від хати тягне димом, від столу – їжею.\n\nНароду у дворі дохуя, а тиша стояла така, поки десь за столом хтось не перднув. І навіть тоді ніхто не засміявся.`;
    C2.ch2_crowd.choices=[{id:'ch2_crowd_next',label:'Далі',next:'ch2_legend'}];
  }

  const C3=CHAPTER3_SCENES;
  // Calling Євпапій is one beat only. The next button goes straight to the creature reveal.
  if(C3.ch3_call_pigeon){
    C3.ch3_call_pigeon.text=`– Євпапій…\n\n– Шо?\n\n– Тихо, блядь.\n\nЄвпапій підлітає ближче й сідає вам на руку. Ви трохи піднімаєте її, щоб він бачив сарай.\n\nКілька секунд мовчить.\n\n– Не рухайся.\n\n– Та ви шо, сьогодні всі договорились?\n\nЄвпапій не відповідає.\n\nІ от це вже трохи напрягає.`;
    C3.ch3_call_pigeon.choices=[{id:'ch3_call_next',label:'…',next:'ch3_creature'}];
  }

  // Garlic branch: one clean sequence, with the old imaginary conversation shown only if it really happened.
  if(C3.ch3_garlic){
    C3.ch3_garlic.onEnter=[{type:'itemRemove',id:'garlic',qty:1},{type:'flag',key:'creatureGarlicUsed',value:true}];
    C3.ch3_garlic.text=s=>`– Ну давай, сука. Не підведи.\n\n– Ти шо робиш? – шипить постать.\n\n– Перевіряю народну медицину.\n\nВи кидаєте часник у створіння. Він влучає прямо в груди.\n\nСтворіння згинається й шипить, ніби його ошпарили. Від сорочки піднімається легкий дим.\n\n– О, – каже Євпапій.\n\n– Шо «о»?\n\n– Працює.\n\n${(s.memories?.evpapiy?.offeredGarlicAtShed||s.flags?.offeredGarlicAtShed)?'– ТИ Ж КАЗАВ, ШО ЧАСНИК ХУЙНЯ.\n\n– Я сказав, шо мені його не давати.':'– Сам бачу, блядь.'}\n\nСтворіння повільно випрямляється і робить крок до вас.\n\nПостать тихо каже:\n\n– Тепер воно тебе запамʼятало.\n\n– Заєбісь.`;
    C3.ch3_garlic.notice={title:'СТВОРІННЯ / ЗДОРОВʼЯ 80/100',body:''};
    C3.ch3_garlic.choices=[{id:'ch3_garlic_hit',label:'…',next:'ch3_garlic_hit'}];
  }
  if(C3.ch3_garlic_hit){
    const battleChoices=asArray099(resolve099(C3.ch3_garlic_hit.choices||[],{}));
    C3.ch3_garlic_hit.onEnter=[{type:'damage',amount:10,ignoreArmor:true}];
    C3.ch3_garlic_hit.text=`Створіння різко кидається вперед. Ви встигаєте відскочити, але воно чіпляє вас за плече й кидає на землю.\n\n– Нормально? – питає Євпапій.\n\n– Ага. Заєбісь. Відпочиваю.\n\nВи піднімаєтесь. Створіння вже знову йде до вас.`;
    C3.ch3_garlic_hit.notice={title:'ЗДОРОВʼЯ -10',body:''};
    if(battleChoices.length)C3.ch3_garlic_hit.choices=battleChoices;
  }

  // Knockout/escape aftermath: the key is visibly picked up before the inventory notice.
  if(C3.ch3_wakeup){
    C3.ch3_wakeup.onEnter=s=>{
      const out=[{type:'flag',key:'shedKnifeDestroyed',value:true},{type:'flag',key:'shedBattleKnockout',value:true}];
      if(itemQty099(s,'knife')>0)out.push({type:'itemRemove',id:'knife',qty:1});
      if(itemQty099(s,'old_key')<=0&&canFitItem099(s,'old_key'))out.push({type:'itemAdd',id:'old_key',qty:1});
      if(!s.flags?.shedHeadInjuryStory097)out.push({type:'damage',amount:10,ignoreArmor:true},{type:'flag',key:'shedHeadInjuryStory097',value:true});
      return out;
    };
    C3.ch3_wakeup.text=`Ви приходите до тями від того, що вам тупо важко дихати.\n\nВідкриваєте очі – на грудях сидить Євпапій.\n\n– Злізь.\n\n– О, живий.\n\n– ЗЛІЗЬ, СУКА.\n\nЄвпапій нехотячи злітає. Ви повільно сідаєте під сараєм. Голова гуде, на потилиці щось мокре. Проводите рукою – кров.\n\nСарай перед вами закритий. Наче нічого не сталося.\n\nНожа нема. Постаті нема. Хуйні з сараю нема.\n\nПоруч у траві лежить старий ключ. Ви підбираєте його.`;
    C3.ch3_wakeup.notice={title:'ОТРИМАНО: СТАРИЙ КЛЮЧ',body:'НІЖ ЗНИЩЕНО'};
  }
}

function fixChapter4Continuity099b(){
  const T=CHAPTER3_SCENES;
  // All calm chapter-4 yard scenes happen the same morning. Fog scenes keep their own art.
  for(const [id,sc] of Object.entries(T)){
    if(id.startsWith('ch4_')&&sc?.background==='./ch4_night.jpg')sc.background='./ch2_wake_yard.jpg';
  }
  if(T.ch4_angry&&typeof T.ch4_angry.text==='string'){
    T.ch4_angry.text=T.ch4_angry.text.replace(
      'Ви ще секунду тримаєте Семена, а тоді помічаєте, що він уже майже не дивиться вам в очі. Його погляд знову йде кудись за ваше плече.',
      'Ви ще секунду тримаєте Семена, потім розтискаєте пальці й відпускаєте його сорочку. І тільки тоді помічаєте, що він уже майже не дивиться вам в очі. Його погляд знову йде кудись за ваше плече.'
    );
  }
  if(T.ch4_tired&&typeof T.ch4_tired.text==='string'){
    T.ch4_tired.text=T.ch4_tired.text
      .replace('Бо я вже третій день прокидаюсь хуй знає де, знайомлюсь із голубом, який говорить, бачу людей, які вчора були майже трупами, а тепер мені ще кажуть, шо мій син живий.', 'Бо я сьогодні прокинувся хуй знає де, познайомився з голубом, який говорить, а тепер мужик, який недавно був Трупосмердом, каже, шо мій син живий.')
      .replace('Ти буквально пʼять хвилин тому не міг нормально пояснити, шо з тобою було в сараї.', 'Ти недавно не міг нормально пояснити, шо з тобою було в сараї.');
    if(!T.ch4_tired.text.includes('Ви підводитесь із лавки.'))T.ch4_tired.text+='\n\nВи підводитесь із лавки.';
  }
}

// ---- Menu knowledge ---------------------------------------------------------------
function activateTab099(tab){document.querySelectorAll('#menuTabs [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab))}
function currentRunId099(){return Number((document.querySelector('#menuMeta')?.textContent||'').match(/Проходження\s+(\d+)/)?.[1]||0)}
async function currentState099(){const id=currentRunId099();if(!id)return null;const raw=await loadRun(id);return raw?normalizeState(raw):null}
function replaceTab099(tab,handler){
  const old=document.querySelector(`#menuTabs [data-tab="${tab}"]`);if(!old)return null;
  const neu=old.cloneNode(true);neu.onclick=null;old.replaceWith(neu);
  neu.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();handler(neu)},true);
  return neu;
}
function characterHtml099(c){const art=c.portrait?`<img src="${esc099(c.portrait)}" alt="">`:'<span class="character-placeholder099" aria-hidden="true">?</span>';return `<details class="character-card096"><summary>${art}<b>${esc099(c.name)}</b></summary><div>${(c.facts?.length?c.facts:['???']).map(f=>`<p>${esc099(f)}</p>`).join('')}</div></details>`}
function knownCharacters099(s){
  const entered=new Set(s.story?.entered||[]),out=[];
  if(s.flags?.ch4StepanMissing)out.push({name:'Степан',portrait:'./ch4_stepan_missing.png',facts:['Місцезнаходження: ???','Стан: ???']});
  const evpSeen=Boolean(s.flags?.metPigeon||entered.has('poop'));
  if(evpSeen)out.push({name:s.flags?.knowsPigeonName?'Євпапій':'???',portrait:'./pigeon_base_095b.webp',facts:[s.flags?.knowsPigeonName?'Жирний голуб. Говорить. На жаль.':'Імʼя: ???']});
  const galSeen=Boolean(s.relationships?.galina?.known||[...entered].some(x=>/^galina/i.test(String(x))));
  if(galSeen)out.push({name:'Баба Галя',portrait:'./galina_base.png',facts:[s.flags?.localClothes?'Дала вам місцеві шмотки.':'???',s.flags?.galinaFedAfterShed?'Нагодувала після сараю.':'???']});
  const hoodSeen=entered.has('ch2_figure')||[...entered].some(x=>/^ch3_(intro|obey|turn|tell_off)/.test(String(x)));
  if(hoodSeen)out.push({name:'Постать',portrait:'./ch2_unknown_v2.png',facts:['Обличчя: ???','Хто це: ???']});
  const catSeen=Boolean(s.flags?.catMet||s.flags?.catFirstMeeting||[...entered].some(x=>String(x).startsWith('ch3_cat_')));
  if(catSeen)out.push({name:'Риже гамно',portrait:'./cat_base_095m.png',facts:['Живе в баби Галі.',s.flags?.catFirstMeeting==='insult'?'Ви вже встигли посратись.':'???']});
  const creatureSeen=entered.has('ch3_creature')||[...entered].some(x=>/^ch3_(vodka|garlic|run|ask_pigeon|pray)/.test(String(x)));
  if(creatureSeen)out.push({name:s.flags?.truposmerdNamed096?'ТРУПОСМЕРД':'???',portrait:'./creature_normal_095f.webp',facts:[s.flags?.truposmerdNamed096?'Виліз із сараю.':'???',s.flags?.creatureGarlicUsed?'Часник йому дуже не подобається.':'???',s.flags?.creatureVodkaFriend?'Горілку любить.':'???']});
  const semenSeen=Boolean(s.flags?.semenEncountered099||entered.has('ch4_intro')||[...entered].some(x=>String(x).startsWith('ch4_')));
  if(semenSeen)out.push({name:s.flags?.semenIntroduced099?'Семен':'???',portrait:'./ch4_semen_base.png',facts:[s.flags?.semenIntroduced099?'Біля сараю виглядав зовсім інакше.':'Імʼя: ???',s.flags?.ch4StepanMissing?'Знає про сина Степана більше, ніж сказав.':'???']});
  const darinaSeen=Boolean(s.flags?.darinaAppeared099d||entered.has('ch6_darina099d'));
  if(darinaSeen)out.push({name:'Дарина',portrait:null,facts:['Щойно прийшла до хати баби Галі.','Хто вона: ???']});
  return out;
}
async function renderCharacters099(){
  const root=document.querySelector('#menuContent');if(!root)return;activateTab099('characters');root.innerHTML='<div class="section-title"><h2>Персонажі</h2></div><div class="empty-state">Завантаження...</div>';
  const s=await currentState099(),chars=s?knownCharacters099(s):[];
  root.innerHTML=`<div class="section-title"><h2>Персонажі</h2></div>${chars.length?chars.map(characterHtml099).join(''):'<div class="empty-state">Поки ви ні з ким нормально не познайомились.</div>'}`;
}
async function renderRelations099(){
  const root=document.querySelector('#menuContent');if(!root)return;activateTab099('relations');const s=await currentState099();
  const order=['evpapiy','galina','hood','cat','creature','semen'];
  const known=order.map(id=>[id,s?.relationships?.[id]]).filter(([,r])=>r?.known);
  root.innerHTML=`<div class="section-title"><h2>Стосунки</h2></div><div class="info-card">Люди й всяка інша живність памʼятають, шо ви витворяли. Наскільки ви їм подобаєтесь, гра цифрами не показує.</div>${known.length?known.map(([id,r])=>{let name=r.name||'???';if(id==='semen')name=s.flags?.semenIntroduced099?'Семен':'???';if(id==='creature')name=s.flags?.truposmerdNamed096?'ТРУПОСМЕРД':'???';if(id==='evpapiy')name=s.flags?.knowsPigeonName?'Євпапій':'???';return `<article class="relation-card"><b>${esc099(name)}</b><span><b>СТАВЛЕННЯ:</b> ???</span><small>Дивіться на його реакції й поведінку.</small></article>`}).join(''):'<div class="empty-state">Ше нема кого бісити.</div>'}`;
}
function mapState099(s){
  const entered=new Set(s?.story?.entered||[]),loc=String(s?.world?.location||'');
  const unlocked=Boolean(s?.flags?.mapUnlocked);
  const home=unlocked;
  const wake=Boolean(s?.flags?.chapter2Started||[...entered].some(x=>String(x).startsWith('ch2_')));
  const shed=Boolean(s?.flags?.heardShedConversation||s?.flags?.heardShedBang||s?.flags?.pigeonSawInsideShed||s?.flags?.ignoredShed||[...entered].some(x=>/^ch[23]_/.test(String(x))&&/shed|bang|creature|garlic|vodka|pray|wakeup/.test(String(x))));
  const fogScenes=new Set(['ch4_watch','ch4_cat_moves','ch4_evp_block','ch4_voice','ch4_fog_deep','ch4_fall','ch4_evp_after','ch5_evening_cat099c','ch5_evp_fog099c','ch5_first_voice099c','ch5_semen_hears099c','ch5_galina_stops099c','ch5_voice_again099c','ch5_evp_blocks099c','ch5_pass_semen099c','ch5_into_fog099c','ch5_voice_deeper099c','ch5_name_shout099c','ch5_no_road099c','ch5_figure099c','ch5_evp_grabs099c','ch5_fall099c','ch5_evp_crash099c','ch5_evp_search099c','ch6_intro099d','ch6_name099d']);
  const fog=Boolean(/туман/i.test(loc)||[...entered].some(x=>fogScenes.has(String(x))));
  const currentFog=/туман/i.test(loc),currentShed=/сарай/i.test(loc),currentWake=/помин|стол|двір/i.test(loc)&&!currentShed&&!currentFog,currentHome=!currentWake&&!currentShed&&!currentFog&&/хат|криниц/i.test(loc);
  return{unlocked,home,wake,shed,fog,currentFog,currentShed,currentWake,currentHome};
}
async function renderMap099(){
  const root=document.querySelector('#menuContent');if(!root)return;activateTab099('map');const s=await currentState099();if(!s)return;
  const m=mapState099(s);
  const marker=(label,x,y,current=false,small=false)=>`<div class="map-marker known${small?' small':''}${current?' current':''}" style="left:${x}%;top:${y}%">${label}</div>`;
  const unknown=(x,y)=>`<div class="map-unknown" style="left:${x}%;top:${y}%"><span>?</span></div>`;
  const overlays=m.unlocked?[m.home?marker('Хатина з криницею',27,70,m.currentHome):unknown(27,70),m.wake?marker('Двір з поминками',64,39,m.currentWake):unknown(64,39),m.shed?marker('Сарай',83,47,m.currentShed,true):unknown(83,47),m.fog?marker('Дорога в тумані',21,18,m.currentFog,true):unknown(21,18),unknown(45,13),unknown(84,20)].join(''):'';
  root.innerHTML=`<div class="section-title"><h2>Карта</h2></div><div class="map-visual ${m.unlocked?'':'locked'}"><img src="./map_village.jpg?v=084" alt="Карта села">${m.unlocked?`<div class="map-overlays">${overlays}</div>`:'<div class="map-lock-copy"><b>ПОКИ ЗАКРИТО</b><span>Спочатку треба трохи розібратись, де ви взагалі опинились.</span></div>'}</div>${m.unlocked?'<div class="map-help">Підпис зʼявляється після того, як ви побували в цьому місці. Невідомі точки поки лишаються знаком питання.</div>':''}`;
}

function sceneHasBattle099(scene,state){
  if(!scene)return false;
  let choices=[];try{choices=asArray099(resolve099(scene.choices||[],state))}catch{}
  return choices.some(c=>Boolean(c?.battle));
}
function sceneUrgent099(scene,state){
  if(!scene)return false;
  if(scene.storyPace==='urgent'||scene.shopAccess===false||scene.urgent===true||scene.dangerous===true)return true;
  if(sceneHasBattle099(scene,state))return true;
  const meta=`${scene.caption||''} ${scene.stageTone||''} ${scene.atmosphere||''} ${resolve099(scene.background||'',state)||''}`.toLocaleLowerCase('uk-UA');
  return /туман|fog|battle|combat|chase|погон/.test(meta);
}
function shopSafe099(s){
  if(!s?.flags?.shopUnlocked)return false;
  if(s.flags?.activeHero097==='evpapiy'||s.flags?.ch4StepanMissing)return false;
  if(threatInfo(s)?.key!=='low')return false;
  const scene=sceneById099(String(s.story?.sceneId||s.scene||''));
  if(s.flags?.storyUrgent099||sceneUrgent099(scene,s))return false;
  const loc=String(s.world?.location||'').toLocaleLowerCase('uk-UA'),env=String(s.world?.environment||'').toLocaleLowerCase('uk-UA');
  if(/туман|ліс|сарай|болот|хлів/.test(loc))return false;
  return env==='indoors'||/хат|двір|криниц|помин|село|дорог/.test(loc);
}
function shopBlocked099(){activateTab099('shop');const root=document.querySelector('#menuContent');if(root)root.innerHTML='<div class="section-title"><h2>Крамничка</h2></div><div class="empty-state"><b>Зараз не до того.</b><br><br>Крамничка доступна, коли Степан на місці, навколо спокійно й ви не лізете в туман, ліс або іншу підозрілу хєрню.</div>'}
function callNativeShop099(){
  const donor=[...document.querySelectorAll('#menuTabs [data-tab]')].find(b=>b.dataset.tab==='states'&&typeof b.onclick==='function');
  if(!donor)return false;
  const old=donor.dataset.tab;donor.dataset.tab='shop';
  try{donor.onclick.call(donor)}finally{donor.dataset.tab=old;donor.classList.remove('active')}
  activateTab099('shop');return true;
}
async function renderShopGate099(){const s=await currentState099();if(!shopSafe099(s)){shopBlocked099();return}if(!callNativeShop099())shopBlocked099()}
function installMenu099(){
  replaceTab099('characters',renderCharacters099);
  replaceTab099('relations',renderRelations099);
  replaceTab099('map',renderMap099);
  replaceTab099('shop',renderShopGate099);
  const settings=document.querySelector('#menuTabs [data-tab="settings"]');settings?.addEventListener('click',()=>setTimeout(hideSoundSettings099,0));
}

// ---- Test mode --------------------------------------------------------------------
function currentStatusIds099(){return Object.keys(STATUS_DEFS).filter(id=>!DEAD_STATUSES099.has(id))}
function ensureTestUI099(){
  const panel=document.querySelector('.test-mode-panel'),opts=panel?.querySelector('.test-options');if(!panel||!opts)return;
  const oldAll=document.querySelector('#testAllItems');if(oldAll){oldAll.checked=true;oldAll.closest('label')?.classList.add('legacy-test099')}
  let all=document.querySelector('#testAll097');if(!all){const l=document.createElement('label');l.innerHTML='<input type="checkbox" id="testAll097" checked> Дати всі актуальні предмети й відкрити всі стани';opts.prepend(l);all=l.querySelector('input')}all.checked=true;
  for(const id of currentStatusIds099()){
    if(id==='scared'&&document.querySelector('#testScared'))continue;
    if(opts.querySelector(`[data-test-status096="${id}"]`))continue;
    const def=STATUS_DEFS[id];if(!def)continue;const l=document.createElement('label');l.innerHTML=`<input type="checkbox" data-test-status096="${id}"> Дати ${esc099(def.name||id)}`;opts.appendChild(l);
  }
  const oldCh4=panel.querySelector('[data-test-ch4-097]');
  if(oldCh4){oldCh4.removeAttribute('data-test-ch4-097');oldCh4.setAttribute('data-test-ch4-099b','');oldCh4.onclick=null}
  const ch4=panel.querySelector('[data-test-ch4-099b]');
  if(ch4&&!ch4.dataset.bound099b){ch4.dataset.bound099b='1';ch4.addEventListener('click',launchChapter4Test099b)}
  const chapters=panel.querySelector('.test-chapters');if(chapters&&!chapters.querySelector('[data-test-ch5-099c]')){const b=document.createElement('button');b.type='button';b.setAttribute('data-test-ch5-099c','');b.textContent='Глава 5';chapters.appendChild(b)}
  const ch5=panel.querySelector('[data-test-ch5-099c]');if(ch5&&!ch5.dataset.bound099c){ch5.dataset.bound099c='1';ch5.addEventListener('click',launchChapter5Test099c)}
  if(chapters&&!chapters.querySelector('[data-test-ch6-099d]')){const b=document.createElement('button');b.type='button';b.setAttribute('data-test-ch6-099d','');b.textContent='Глава 6';chapters.appendChild(b)}
  const ch6=panel.querySelector('[data-test-ch6-099d]');if(ch6&&!ch6.dataset.bound099d){ch6.dataset.bound099d='1';ch6.addEventListener('click',launchChapter6Test099d)}
}
function saveTestConfig099b(){
  let cfg={};try{cfg=JSON.parse(localStorage.getItem('dnt-test-v096')||'{}')}catch{}
  cfg.statuses=[...document.querySelectorAll('[data-test-status096]:checked')].map(x=>x.dataset.testStatus096).filter(Boolean);
  if(document.querySelector('#testScared')?.checked&&!cfg.statuses.includes('scared'))cfg.statuses.push('scared');
  cfg.all097=Boolean(document.querySelector('#testAll097')?.checked);
  cfg.sunset=Boolean(document.querySelector('#testSunset')?.checked);
  try{localStorage.setItem('dnt-test-v096',JSON.stringify(cfg))}catch{}
}
function freshChapter4TestState099b(memory){
  let s=createInitialState(99);
  s=normalizeState(s);
  s.runId=99;s.chapter=4;s.scene='ch4_intro';
  s.story={...(s.story||{}),chapter:4,sceneId:'ch4_intro',entered:['poop','galinaInside','galinaChanged','ch2_intro','ch2_figure','ch3_creature','ch3_cat_intro095m','ch3_evp_returns'],finished:false};
  s.flags={...(s.flags||{}),testMode:true,testFreshChapter4099b:true,initialStatusPopupShown:true,mapUnlocked:true,shopUnlocked:true,chapter1Complete:true,chapter2Started:true,chapter2Complete:true,chapter3Complete:true,localClothes:true,catMet:true,catFirstMeeting:'polite',truposmerdNamed096:true,metPigeon:true,knowsPigeonName:true,storyUrgent099:false};
  s.companions=s.companions||{};s.companions.evpapiy={...(s.companions.evpapiy||{}),known:true,active:true,state:'З вами'};
  s.relationships=s.relationships||{};s.relationships.evpapiy={...(s.relationships.evpapiy||{}),known:true};s.relationships.galina={...(s.relationships.galina||{}),known:true};
  for(const k of ['creatureVodkaFriend','creatureGarlicUsed','creaturePrayerReactionKnown095w','creaturePrayerStalled095w','creatureKilledByPrayer','shedBattleKnockout','semenEncountered099','semenIntroduced099'])delete s.flags[k];
  if(memory==='vodka')s.flags.creatureVodkaFriend=true;
  else if(memory==='garlic')s.flags.creatureGarlicUsed=true;
  else if(memory==='prayer')s.flags.creaturePrayerReactionKnown095w=true;
  else s.flags.shedBattleKnockout=true;
  s=normalizeState(s);
  // Some older engine layers clamp the chapter number. Force the fresh test start after normalization.
  s.runId=99;s.chapter=4;s.scene='ch4_intro';s.story={...(s.story||{}),chapter:4,sceneId:'ch4_intro',entered:['poop','galinaInside','galinaChanged','ch2_intro','ch2_figure','ch3_creature','ch3_cat_intro095m','ch3_evp_returns'],finished:false};s.flags={...(s.flags||{}),testMode:true,testFreshChapter4099b:true,initialStatusPopupShown:true,storyUrgent099:false};
  return s;
}
async function launchChapter4Test099b(e){
  e?.preventDefault?.();e?.stopPropagation?.();
  saveTestConfig099b();
  const memory=document.querySelector('#testCh4Memory097')?.value||'vodka';
  try{
    await clearRun(99);
  }catch{}
  const state=freshChapter4TestState099b(memory);
  await saveRun(state);
  try{localStorage.setItem('dnt-autostart-test099b','1')}catch{}
  location.reload();
}
async function autoStartFreshTest099b(){
  let go='';try{go=localStorage.getItem('dnt-autostart-test099b')||'';if(go)localStorage.removeItem('dnt-autostart-test099b')}catch{}
  if(go!=='1')return;
  try{await window.__dntMigration099}catch{}
  document.querySelector('#testModeBtn')?.click();
  for(let i=0;i<50;i++){
    const btn=document.querySelector('#continueTestBtn');
    if(btn){btn.click();return}
    await new Promise(r=>setTimeout(r,60));
  }
}

function installTest099(){
  const btn=document.querySelector('#testModeBtn');if(btn){btn.textContent='Тестовий режим';btn.addEventListener('click',()=>{for(const ms of [0,80,220,500])setTimeout(ensureTestUI099,ms)},true)}
}

// ---- Immediate active-hero UI sync -------------------------------------------------
function applyActiveHeroUi099e(isEvp){
  document.body.classList.toggle('evp-mode097',Boolean(isEvp));
  let badge=document.querySelector('#activeHeroBadge097');
  if(!badge){badge=document.createElement('span');badge.id='activeHeroBadge097';badge.className='active-hero-badge097 hidden';document.querySelector('.world-line')?.appendChild(badge)}
  if(badge){badge.textContent=isEvp?'🕊️ ЄВПАПІЙ':'';badge.classList.toggle('hidden',!isEvp)}
  if(isEvp){
    const needs=document.querySelector('#miniNeeds');if(needs)needs.innerHTML='<span>🕊️ Керуєте Євпапієм</span>';
  }
}
async function syncActiveHeroUi099e(){
  const kicker=String(document.querySelector('#storyKicker')?.textContent||'');
  if(/ГЛАВА\s*6/i.test(kicker)){applyActiveHeroUi099e(true);return}
  try{const s=await currentState099();applyActiveHeroUi099e(Boolean(s?.flags?.activeHero097==='evpapiy'&&s?.flags?.ch4StepanMissing))}catch{}
}
function installActiveHeroUiFix099e(){
  const target=document.querySelector('#storyKicker');if(!target||target.dataset.heroFix099e)return;target.dataset.heroFix099e='1';
  const run=()=>{syncActiveHeroUi099e();setTimeout(syncActiveHeroUi099e,0);setTimeout(syncActiveHeroUi099e,80)};
  new MutationObserver(run).observe(target,{childList:true,subtree:true,characterData:true});
  document.querySelector('#gameScreen')&&new MutationObserver(run).observe(document.querySelector('#gameScreen'),{attributes:true,attributeFilter:['class']});
  run();
}

// ---- Image preloading --------------------------------------------------------------
const imageCache099=new Map();
function imageRecord099(src){
  if(!src||typeof src!=='string')return null;
  if(imageCache099.has(src))return imageCache099.get(src);
  const im=new Image();im.decoding='async';
  const rec={img:im,loaded:null,decoded:null,ok:false};
  rec.loaded=new Promise(resolve=>{
    const done=ok=>{rec.ok=Boolean(ok&&im.naturalWidth);resolve(rec.ok)};
    im.addEventListener('load',()=>done(true),{once:true});
    im.addEventListener('error',()=>done(false),{once:true});
    im.src=src;
    if(im.complete)setTimeout(()=>done(im.naturalWidth>0),0);
  });
  imageCache099.set(src,rec);return rec;
}
async function preloadImage099(src){const rec=imageRecord099(src);if(!rec)return false;return rec.loaded}
async function decodeImage099(src){
  const rec=imageRecord099(src);if(!rec)return false;
  const loaded=await rec.loaded;if(!loaded)return false;
  if(!rec.decoded){
    rec.decoded=(async()=>{
      if(typeof rec.img.decode==='function'){
        try{await rec.img.decode()}catch{if(!rec.img.complete||!rec.img.naturalWidth)return false}
      }
      return Boolean(rec.img.complete&&rec.img.naturalWidth);
    })();
  }
  return rec.decoded;
}
function assetsForScene099(scene,state){
  const out=[];if(!scene)return out;
  const bg=resolve099(scene.background,state);if(typeof bg==='string')out.push(bg);
  let actors=[];try{actors=asArray099(resolve099(scene.actors||[],state))}catch{}
  for(const a of actors){let src='';try{src=resolve099(a?.src,state)}catch{}if(typeof src==='string')out.push(src)}
  return [...new Set(out)];
}
async function decodeScene099(scene,state){
  const assets=assetsForScene099(scene,state);
  if(!assets.length)return true;
  const results=await Promise.all(assets.map(src=>decodeImage099(src)));
  return results.every(Boolean);
}
function warmAllScenes099(){
  const staticAssets=[];
  for(const scene of allScenes099()){
    if(typeof scene.background==='string')staticAssets.push(scene.background);
    if(Array.isArray(scene.actors))for(const a of scene.actors)if(typeof a?.src==='string')staticAssets.push(a.src);
  }
  for(const src of [...new Set(staticAssets)])preloadImage099(src);
  const critical=['./ch2_wake_yard.jpg','./ch4_night.jpg','./ch4_fog_light.jpg','./ch4_fog_dark.jpg','./ch4_semen_base.png','./ch4_semen_talk.png','./ch4_semen_sideeye.png','./ch4_stepan_son.png','./ch4_stepan_missing.png','./pigeon_base_095b.webp','./pigeon_suspicious.png','./cat_base_095m.png','./galina_base.png','./hero_shrug_096.png','./hero_angry_096.png','./hero_worry_096.png','./hero_injured_096.png'];
  Promise.allSettled(critical.map(src=>decodeImage099(src)));
}
let activeRun099=0;
function rememberRun099(target){
  const card=target?.closest?.('.run-card');if(card){const n=Number((card.textContent||'').match(/Проходження\s+(\d+)/)?.[1]||0);if(n)activeRun099=n}
  const manual=target?.closest?.('[data-start-manual]');if(manual){const n=Number(String(manual.dataset.startManual||'').split(':')[0]||0);if(n)activeRun099=n}
  if(target?.closest?.('#continueTestBtn,[data-test-chapter],[data-test-ch4-097],[data-test-ch4-099b],[data-test-ch5-099c],[data-test-ch6-099d]'))activeRun099=99;
}
function predictChoiceState099(state,choice){
  try{
    const r=executeAction(clone099(state),{id:choice.id,minutes:choice.minutes||0,activity:choice.activity||'light',effects:choice.effects||[],hiddenEffects:choice.hiddenEffects||[]});
    const next=normalizeState(r.state);if(choice.next){next.story=next.story||{};next.story.sceneId=choice.next;next.scene=choice.next}return next;
  }catch{return state}
}
async function interceptStoryChoice099(e){
  const btn=e.target?.closest?.('.story-choice');if(!btn||btn.dataset.preload099==='done'||!activeRun099)return;
  const buttons=[...document.querySelectorAll('#storyChoices .story-choice')],index=buttons.indexOf(btn);if(index<0)return;
  const nativeClick=btn.onclick;
  e.preventDefault();e.stopImmediatePropagation();btn.disabled=true;btn.setAttribute('aria-busy','true');
  try{
    const raw=await loadRun(activeRun099);
    const state=raw?normalizeState(raw):null,scene=state?sceneById099(String(state.story?.sceneId||state.scene||'')):null;
    let choices=[];if(scene)choices=asArray099(resolve099(scene.choices||[],state)).filter(c=>c&&(!c.showIf||c.showIf(state)));
    const choice=choices[index];
    if(choice?.next){const predicted=predictChoiceState099(state,choice);await decodeScene099(sceneById099(choice.next),predicted)}
  }catch(err){console.warn('v099 preload skipped',err)}
  btn.dataset.preload099='done';btn.disabled=false;btn.removeAttribute('aria-busy');
  if(typeof nativeClick==='function')await nativeClick.call(btn);
}
function installPreloadHooks099(){
  document.addEventListener('click',e=>rememberRun099(e.target),true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.story-choice'))interceptStoryChoice099(e)},true);
  if('requestIdleCallback'in window)requestIdleCallback(warmAllScenes099,{timeout:1000});else setTimeout(warmAllScenes099,100);
}

// ---- UI cleanup -------------------------------------------------------------------
function fixUiCopy099(){
  const about=document.querySelector('#aboutOverlay .about-copy');
  if(about){for(const p of about.querySelectorAll('p'))if(/^Сейви\./.test(p.textContent?.trim()||''))p.innerHTML='<b>Сейви.</b> Гра сама зберігає прогрес після важливих рішень і подій. Також є ручні сейви й повернення до початку глави.'}
}
function addCss099(){
  if(document.querySelector('#patch099css'))return;const st=document.createElement('style');st.id='patch099css';st.textContent=`
    .legacy-test099{display:none!important}
    .stage-image>.actor{bottom:0!important;object-fit:contain!important;transition:none!important}
    .stage-image:not(:has(>.actor.actor-1))>.actor.actor-0{left:50%!important;right:auto!important;transform:translateX(-50%)!important}
    .stage-image:has(>.actor.actor-1):not(:has(>.actor.actor-2))>.actor.actor-0{left:3%!important;right:auto!important;transform:none!important}
    .stage-image:has(>.actor.actor-1):not(:has(>.actor.actor-2))>.actor.actor-1{left:auto!important;right:3%!important;transform:none!important}
    .stage-image:has(>.actor.actor-2)>.actor.actor-0{left:2%!important;right:auto!important;transform:none!important}
    .stage-image:has(>.actor.actor-2)>.actor.actor-1{left:50%!important;right:auto!important;transform:translateX(-50%)!important}
    .stage-image:has(>.actor.actor-2)>.actor.actor-2{left:auto!important;right:2%!important;transform:none!important}
    .stage-image:not(:has(>.actor.actor-1))>.actor.actor-0:not(.pigeon):not(.ch4-pigeon097):not(.ch4-cat097){max-width:46%!important;max-height:92%!important}
    .stage-image:has(>.actor.actor-1):not(:has(>.actor.actor-2))>.actor.actor-0:not(.pigeon):not(.ch4-pigeon097):not(.ch4-cat097),.stage-image:has(>.actor.actor-1):not(:has(>.actor.actor-2))>.actor.actor-1:not(.pigeon):not(.ch4-pigeon097):not(.ch4-cat097){max-width:40%!important;max-height:92%!important}
    .stage-image:has(>.actor.actor-2)>.actor.actor-0:not(.pigeon):not(.ch4-pigeon097):not(.ch4-cat097),.stage-image:has(>.actor.actor-2)>.actor.actor-1:not(.pigeon):not(.ch4-pigeon097):not(.ch4-cat097),.stage-image:has(>.actor.actor-2)>.actor.actor-2:not(.pigeon):not(.ch4-pigeon097):not(.ch4-cat097){max-width:31%!important;max-height:92%!important}
    .relation-card small{display:block;margin-top:7px;opacity:.7}
    .character-placeholder099{display:inline-grid;place-items:center;width:52px;height:52px;border-radius:50%;border:1px solid #47554d;font-weight:900;font-size:1.4rem;opacity:.8}
    .evp-mode097 .quick-row,.evp-mode097 .active-states{display:none!important}
    @media(max-width:620px){
      .stage-image:has(>.actor.actor-1):not(:has(>.actor.actor-2))>.actor.actor-0:not(.pigeon):not(.ch4-pigeon097):not(.ch4-cat097),.stage-image:has(>.actor.actor-1):not(:has(>.actor.actor-2))>.actor.actor-1:not(.pigeon):not(.ch4-pigeon097):not(.ch4-cat097){max-width:43%!important}
      .stage-image:has(>.actor.actor-2)>.actor.actor-0:not(.pigeon):not(.ch4-pigeon097):not(.ch4-cat097),.stage-image:has(>.actor.actor-2)>.actor.actor-1:not(.pigeon):not(.ch4-pigeon097):not(.ch4-cat097),.stage-image:has(>.actor.actor-2)>.actor.actor-2:not(.pigeon):not(.ch4-pigeon097):not(.ch4-cat097){max-width:33%!important}
    }
  `;document.head.appendChild(st);
}

export const __v099Test={shopSafe:shopSafe099,sceneUrgent:sceneUrgent099,mapState:mapState099,knownCharacters:knownCharacters099,migrateState:migrateState099,decodeScene:decodeScene099,memoryBranch:memoryBranch099,fixReportedFlow:fixReportedFlow099b,fixChapter4Continuity:fixChapter4Continuity099b,freshChapter4TestState:freshChapter4TestState099b,freshChapter5TestState:freshChapter5TestState099c,freshChapter6TestState:freshChapter6TestState099d};

function apply099(){
  stamp099();disableSound099();
  restoreImmediateConsequences099();
  cleanHeadInjuryRuntime099();
  fixReportedFlow099b();
  rebuildChapter4099();
  rebuildChapter5099c();
  rebuildChapter6099d();
  fixChapter4Continuity099b();
  addCss099();installMenu099();installTest099();fixUiCopy099();installActiveHeroUiFix099e();installPreloadHooks099();
  window.__dntMigration099=runMigrationGate099();
  autoStartFreshTest099b();
  for(const ms of [0,250,900])setTimeout(()=>{stamp099();disableSound099();fixUiCopy099();ensureTestUI099()},ms);
}
queueMicrotask(apply099);
