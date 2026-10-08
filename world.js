import {clone,normalizeState,executeAction,effectiveStat,itemCount,addItem,removeItem,addHeroXp,addEvpXp} from './engine.js?v=096b';
import {chapterOf} from './chapters.js';
import {WORLD_XP_CAP} from './balance.js';

const PROFILE_KEYS=['health','needs','inventory','importantItems','quickSlots','ownedClothes','equipment','stats','heroProgression','activeStatuses','discoveredStatuses','statusTimers','wetness','money'];
const profile=s=>Object.fromEntries(PROFILE_KEYS.map(k=>[k,clone(s[k]??(k==='money'||k==='wetness'?0:[]))]));
export function activeActor(s){return s.activeActor||'stepan'}
export function syncActor(state){
  const s=clone(state),wanted=chapterOf(s)===6?'evpapiy':'stepan',current=activeActor(s);
  if(current===wanted){
    if(wanted==='evpapiy'){
      const bird=s.companions.evpapiy,p=bird.progression;
      bird.hp=Math.round(s.health/100*bird.maxHp);
      s.stats={strength:{level:p.attack},attention:{level:2+p.level},agility:{level:3+p.aggression},charisma:{level:2},pofigism:{level:3},ahui:{level:2}};
      s.heroProgression={level:p.level,xp:p.xp,xpToNext:100,points:0};
    }
    return s;
  }
  s.actors=s.actors||{};s.actors[current]={...(s.actors[current]||{}),profile:profile(s)};
  if(!s.actors[wanted]?.profile){
    const bird=s.companions.evpapiy,p=bird.progression;
    s.actors.evpapiy={profile:{...profile(s),health:Math.round(bird.hp/bird.maxHp*100),needs:{satiety:65,water:65,energy:70},inventory:[],importantItems:[],quickSlots:[null,null,null],ownedClothes:[],equipment:{},activeStatuses:[],discoveredStatuses:[],statusTimers:{},wetness:0,money:0,stats:{strength:{level:p.attack},attention:{level:2+p.level},agility:{level:3+p.aggression},charisma:{level:2},pofigism:{level:3},ahui:{level:2}},heroProgression:{level:p.level,xp:p.xp,xpToNext:100,points:0}}};
  }
  Object.assign(s,clone(s.actors[wanted].profile));s.activeActor=wanted;
  if(wanted==='stepan'){s.flags.activeHero097='stepan';s.flags.ch4StepanMissing=false}
  return s;
}
export function timePhase(s){const m=Number(s.clock.totalMinutes)%1440;return m<360||m>=1320?'night':m<600?'morning':m<1080?'day':'evening'}
export const PHASE_LABELS={morning:'Ранок',day:'День',evening:'Вечір',night:'Ніч'};
export function locationContext(s,scene={}){
  const id=String(s.scene),loc=String(s.world.location||''),chapter=chapterOf(s),actor=activeActor(s);
  const selected=s.expedition?.anchor===s.scene?s.expedition.current:null;
  const site=selected||(/туман/i.test(loc)||/ch5_(into_fog|voice_deeper|name_shout|no_road|figure|evp_grabs|fall)/.test(id)||chapter===7?'fog':/за сараєм|сарай/i.test(loc)?'shed':/столом|помин/i.test(loc)?'wake':s.world.environment==='indoors'?'hut':/криниц/i.test(loc)?'well':/дорога/i.test(loc)?'road':'yard');
  const danger=Boolean(s.pendingBattle)||chapter===3&&!/galina|wake_crowd|evp_missing|cat|evp_returns|prepare/.test(id)||chapter===2&&/bang|after_bang|side|garlic|pigeon_scared|figure|end/.test(id)||chapter===5&&site==='fog';
  const busy=scene.storyPace==='urgent'||s.flags.storyUrgent099;
  return{chapter,actor,site,phase:timePhase(s),danger,busy,safe:!danger&&!busy&&['hut','yard','wake','well'].includes(site),galina:Boolean(s.relationships.galina?.known)&&['hut','yard','wake'].includes(site),night:timePhase(s)==='night'};
}
const effect=(type,fields={})=>({type,...fields});
const need=(key,value)=>effect('need',{key,value});
const statusRemove=id=>effect('statusRemove',{id});
const item=(id,qty=1)=>effect('itemAdd',{id,qty});
const flag=(key,value=true)=>effect('flag',{key,value});
function action(id,label,minutes,activity,effects,detail,options={}){return{id,label,minutes,activity,effects,detail,...options}}
function skill(s,key,target=3){return effectiveStat(s,key)>=target}
export function worldActions(s,scene={}){
  if(s.health<=0||s.pendingBattle||s.expedition?.encounter)return[];
  const c=locationContext(s,scene),out=[],key=id=>`${c.actor}:${c.chapter}:${c.site}:${id}`;
  const once=(a,scope=key(a.id))=>out.push({...a,onceKey:scope,done:Boolean(s.exploration?.completed?.[scope])});
  const g=s.relationships.galina?.values||{},bird=s.relationships.evpapiy?.values||{},quiet=skill(s,'pofigism'),observant=skill(s,'attention'),nimble=skill(s,'agility'),strong=skill(s,'strength'),persuasive=skill(s,'charisma'),weird=skill(s,'ahui');
  if(c.danger){
    once(action('read-danger','Оцінити, куди відступати',observant?1:3,'dialogue',[],observant?'Помічаєте напрямок нападу: наступний захист надійніший.':'Придивляєтесь довше. Відпочити посеред небезпеки не вийде.',{memory:'dangerRead',xp:10}));
    return out;
  }
  if(c.busy)return out;
  if(c.chapter>=3&&c.safe&&s.flags.suspiciousDealConsequencePending){
    if(s.money>=4)out.push(action('settle-deal-money','Завершити розрахунок за взяте діло',0,'dialogue',[effect('money',{value:-4}),flag('suspiciousDealConsequencePending',false)],'−4 монети. У крамничці зникає доплата за незавершену угоду.'));
    out.push(action('settle-deal-work','Відпрацювати залишок узятого діла',20,'work',[flag('suspiciousDealConsequencePending',false)],'Альтернатива без грошей: 20 хвилин роботи замість доплати за припаси.'));
  }
  if(c.actor==='stepan'&&c.chapter===1)once(action('pockets','Перевірити власні кишені',observant?5:10,'light',[item('aspirin')],'Разова знахідка: аспірин. Уважність скорочує пошук.',{xp:15}), 'stepan:1:pockets');
  if(c.safe||c.actor==='evpapiy'&&c.site==='yard'){
    once(action('search','Оглянути доступне оточення',observant?10:c.night?30:20,'light',[item(c.actor==='evpapiy'?'salo':'onion'),...(observant&&!c.night?[item('garlic')]:[]),...(!nimble&&c.night?[effect('damage',{amount:4,ignoreArmor:true})]:[])],c.night?'Темно: пошук довший; спритність захищає від забиття.':'Знайдете звичайний запас; уважність відкриває додаткову знахідку.',{xp:15}));
    if(!c.night&&c.galina)once(action('carry',c.actor==='evpapiy'?'Піднести легкий згорток':'Допомогти з припасами',c.actor==='evpapiy'?5:strong?10:25,'work',[need('energy',strong?-3:-8),item('salo'),effect('money',{value:c.actor==='stepan'?3:0}),effect('relationship',{person:'galina',key:'trust',value:1})],strong?'Сила: менше часу й навантаження.':'Можна й без високої сили; робота займе більше часу.',{xp:15}));
    if(c.night)once(action('listen','Послухати двір у темряві',quiet?5:10,'light',[...(quiet?[]:[effect('statusAdd',{id:'scared'})])],quiet?'Спокійно перевіряєте шуми й запам’ятовуєте безпечний напрямок.':'Страшно, але напрямок запам’ятаєте. Похуїзм змінює ціну.',{memory:'nightRoute',xp:15}));
  }
  if(c.galina){
    const friendly=Number(g.trust||0)>=6&&Number(g.offense||0)<4;
    once(action('ask-water',friendly||persuasive?'Попросити додаткові припаси':'Допомогти Галі за додаткові припаси',friendly||persuasive?5:20,friendly||persuasive?'dialogue':'work',[item('water'),item('salo'),effect('relationship',{person:'galina',key:'trust',value:1})],friendly?'Галя пам’ятає, як ви з нею поводились, і допомагає відразу.':persuasive?'Харизма: коротка домовленість.':'Доступна альтернатива без грошей і високої характеристики: допомога по господарству.',{xp:15}), `${c.actor}:${c.chapter}:galina-help`);
    if(s.health<80)once(action('care',s.health<=15?'Прийняти невідкладну допомогу':'Попросити допомоги з раною',s.health<=15?0:friendly?10:20,'rest',[effect('health',{value:friendly?18:12}),statusRemove('bump')],friendly?'Завдяки попереднім стосункам Галя уважніше допомагає.':'Базова допомога доступна і без високої довіри; додаткові припаси обмежені.'),`${c.actor}:${c.chapter}:care`);
  }
  if(c.actor==='stepan'&&c.chapter>=4&&c.galina&&s.flags.cacheDiscovered){
    if(itemCount(s,'old_key'))once(action('cache-key','Відкрити скриньку старим ключем',5,'light',[item('medkit'),item('water'),effect('clothesAdd',{id:'leather_vest'})],'Ключ, знайдений раніше, справді підходить. Скринька одна.',{xp:20}),'stepan:cache');
    else once(action('cache-help',strong?'Підважити замок інструментом':'Попросити допомоги зі скринькою',strong&&itemCount(s,'knife')?15:25,'work',[item('medkit'),item('water'),effect('clothesAdd',{id:'leather_vest'}),need('energy',strong&&itemCount(s,'knife')?-8:-12)],strong&&itemCount(s,'knife')?'Сила й ніж дають швидший спосіб. Ніж лишається у вас.':'Без ключа й сили є повільніша допомога по господарству.',{xp:15}),'stepan:cache');
  }
  if(c.actor==='stepan'&&c.chapter>=4&&c.galina&&!s.flags.cacheDiscovered)once(action('notice-cache','Оглянути господарський куток',observant?5:15,'light',[flag('cacheDiscovered')],observant?'Помічаєте замок, схожий на ваш старий ключ.':'Пошук довший, але скриньку знайдете.',{xp:10}),'stepan:notice-cache');
  const waterHere=c.site==='well'||c.safe&&c.site==='yard'&&(s.flags.doneWhere||s.story.entered.some(id=>/well|waterSearch/.test(id)))||c.galina;
  if(waterHere&&s.needs.water<65)out.push(action('drink','Попити на місці',c.galina?5:observant?8:15,'light',[need('water',45)],'Доступна вода; пляшку з рюкзака не потрібно. Це не дає повторного досвіду.'));
  if(waterHere&&(s.activeStatuses.includes('skunk')||s.activeStatuses.includes('pigeonHumiliated')||s.wetness>=40))out.push(action('wash','Помитися й привести одяг до ладу',15,'light',[statusRemove('skunk'),statusRemove('pigeonHumiliated'),flag('modernJacketPooped',false)],'Сморід і приниження від голуба знімаються реально.',{dry:20}));
  if(c.safe&&!c.busy&&s.needs.energy<85)out.push(action('rest','Перепочити',30,'rest',[...(s.needs.water>=65&&s.needs.satiety>=65?[statusRemove('hangover')]:[])],'Відновлює енергію, витрачає час і трохи води. За води й їжі полегшує похмілля.',{dry:25}));
  if(c.actor==='stepan'&&c.chapter>=2&&s.companions.evpapiy.active){
    if(itemCount(s,'salo'))once(action('share','Поділитися салом з Євпапієм',3,'dialogue',[effect('itemRemove',{id:'salo',qty:1}),effect('relationship',{person:'evpapiy',key:'trust',value:2}),effect('relationship',{person:'evpapiy',key:'offense',value:-1}),effect('evpXp',{value:20})],'Сало −1. Він запам’ятає допомогу; підтримка в небезпеці залежить від цього.',{memory:'sharedSupplies'}),`stepan:${c.chapter}:share`);
    if(Number(bird.trust||0)>=4&&Number(bird.offense||0)<6&&s.companions.evpapiy.hp>10&&!s.companions.evpapiy.skipBattles){const reliable=Number(bird.bullshit||0)<=6||observant;
      once(action('bird-scout','Попросити Євпапія перевірити напрямок',5,'dialogue',[flag('scoutedRoute',reliable)],reliable?'Попередня допомога голубові відкрила підтримку. Перевірений напрямок зменшить втрати у тумані.':'Євпапій любить наплести. Уважність допомагає перевірити його пораду; зараз не варто покладатися лише на нього.',{memory:'birdScouted',xp:10}),`stepan:${c.chapter}:bird-scout`);
    }
  }
  if(c.actor==='stepan'&&c.chapter===2&&s.unlocks.yebatorium&&itemCount(s,'potion_unknown'))once(action('potion','Роздивитися невідоме зілля',weird?5:15,'light',[],'Ахуй допомагає зрозуміти спосіб використання; для експерименту потрібна окрема сюжетна дія.',{memory:'potionExamined',xp:10}), 'stepan:potion-examined');
  if(c.chapter===7){
    once(action('check-injury','Перевірити себе після падіння',quiet?5:10,'light',[...(quiet?[]:[effect('statusAdd',{id:'scared'})])],'Можна оцінити травму й власні припаси, не розкриваючи особу Постаті.',{xp:15}), 'stepan:7:check-injury');
    if(s.flags.darinaRevealed100){const hood=s.relationships.hood?.values||{},trusted=Number(hood.trust||0)>=6&&Number(hood.offense||0)<3||effectiveStat(s,'charisma')>=4;
      once(action('darina-care','Прийняти допомогу Дарини',trusted?5:10,'rest',[effect('health',{value:trusted?15:8}),statusRemove('bump'),effect('relationship',{person:'hood',key:'trust',value:1})],trusted?'Ваші попередні відповіді допомагають діяти разом.':'Напруга лишилась; спочатку заспокоюєтесь. Допомога все одно доступна.',{memory:'darinaHelpAccepted'}),'stepan:7:darina-care');
      once(action('fog-markers','Разом перевірити найближчі орієнтири',weird||observant?5:15,'light',[need('energy',weird||observant?-2:-6)],'Це лише ближній огляд: дорога в село ще не знайдена. Ахуй або уважність зменшують ціну.',{memory:'pairedFogCheck',xp:15}),'stepan:7:fog-markers');
    }
  }
  for(const [i,loot] of (s.pendingLoot||[]).entries())if((!loot.actor||loot.actor===c.actor)&&(!loot.location||loot.location===c.site))out.push(action(`collect-${i}`,`Забрати залишену знахідку: ${loot.id}`,0,'light',[],'Потрібне місце в рюкзаку.',{collect:i}));
  return out;
}

export function performWorldAction(state,id,scene={}){
  const before=syncActor(normalizeState(state)),a=worldActions(before,scene).find(x=>x.id===id);
  if(!a||a.done)return{state:clone(state),events:[],accepted:false,message:'Ця дія зараз недоступна або її вже виконано.'};
  if(a.collect!==undefined){const s=clone(before),loot=s.pendingLoot[a.collect];if(!addItem(s,loot.id,loot.qty))return{state:clone(state),events:[],accepted:false,message:'Спочатку звільніть місце в рюкзаку.'};s.pendingLoot.splice(a.collect,1);return{state:s,events:[],accepted:true,message:'Знахідку забрано.'}}
  const r=executeAction(before,{...a,effects:[...a.effects,...(a.dry?[effect('wetness',{value:-a.dry})]:[])]});if(r.accepted===false)return{...r,message:'Бракує ресурсу: оберіть інший спосіб.'};
  const s=r.state;s.exploration=s.exploration||{completed:{}};s.exploration.completed=s.exploration.completed||{};
  if(a.onceKey)s.exploration.completed[a.onceKey]={clock:s.clock.totalMinutes,scene:s.scene};
  if(a.memory){s.memories.world=s.memories.world||{};s.memories.world[a.memory]={chapter:chapterOf(s),clock:s.clock.totalMinutes,actor:activeActor(s)}}
  if(a.id==='share'){const bird=s.companions.evpapiy;bird.hp=Math.min(bird.maxHp,bird.hp+8);if(s.relationships.evpapiy.values.offense<4)bird.offended=false;s.flags.evpapiySaloGivenCount=Number(s.flags.evpapiySaloGivenCount||0)+1}
  // Exploration supplements the chapter milestones; moving between scene names
  // must not become a source of unlimited levels.
  r.events.push(...awardExplorationXp(s,a.xp||0));
  if(activeActor(s)==='evpapiy')s.companions.evpapiy.hp=Math.round(s.health/100*s.companions.evpapiy.maxHp);
  s.journal=Array.isArray(s.journal)?s.journal:[];s.journal.push({id:a.id,text:a.label,detail:a.detail,chapter:chapterOf(s),clock:s.clock.totalMinutes,actor:activeActor(s)});
  return{...r,state:normalizeState(s),message:a.detail};
}

export function awardExplorationXp(s,amount){
  s.exploration=s.exploration||{completed:{}};s.exploration.xp=s.exploration.xp||{};
  const key=`${activeActor(s)}:${chapterOf(s)}`,earned=Number(s.exploration.xp[key]||0),reward=Math.max(0,Math.min(Number(amount),WORLD_XP_CAP-earned));
  if(!reward)return[];s.exploration.xp[key]=earned+reward;
  return activeActor(s)==='evpapiy'?addEvpXp(s,reward):addHeroXp(s,reward);
}

export function leaveItem(state,id){
  // A full bag always has a reversible way to make room, including a bag full
  // of non-consumable tools. Quest items are stored separately and never dropped.
  const s=clone(state);
  if(s.health<=0||s.pendingBattle||s.importantItems.includes(id)||!removeItem(s,id,1))return{state:clone(state),accepted:false};
  s.pendingLoot=s.pendingLoot||[];s.pendingLoot.push({id,qty:1,scene:s.scene,actor:activeActor(s),location:locationContext(s).site});
  return{state:normalizeState(s),accepted:true};
}
