// v0.9.7 – Chapter 4 + final technical pass before story-only development.
import {CHAPTER1_SCENES} from './chapter1.js?v=096b';
import {CHAPTER2_SCENES} from './chapter2.js?v=096b';
import {CHAPTER3_SCENES} from './chapter3.js?v=096b';
import {STATUS_DEFS,ITEM_DEFS} from './data.js?v=096b';
import {normalizeState,threatInfo,effectiveStat,createInitialState} from './engine.js?v=096b';
import {loadRun,saveRun,clearRun} from './storage.js?v=096b';

const PUBLIC_BUILD=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const asArray=x=>Array.isArray(x)?x:[];
const H={base:'./hero_shrug_096.png',angry:'./hero_angry_096.png',worry:'./hero_worry_096.png',shock:'./hero_shocked_096.png',son:'./ch4_stepan_son.png'};
const S={base:'./ch4_semen_base.png',talk:'./ch4_semen_talk.png',side:'./ch4_semen_sideeye.png',quiet:'./ch4_semen_silenced.png'};
const P={base:'./pigeon_base_095b.webp',serious:'./pigeon_suspicious.png',fly:'./pigeon_attack_095.webp'};
const C={base:'./cat_base_095m.png',side:'./cat_sideeye_095m.png'};
const B={night:'./ch4_night.jpg',fog:'./ch4_fog_light.jpg',deep:'./ch4_fog_dark.jpg'};

const hero=(src=H.base)=>({role:'hero ch4-hero097',src,position:'hero'});
const semen=(src=S.base)=>({role:'npc ch4-semen097',src,position:'npc'});
const pigeon=(src=P.base)=>({role:'pigeon ch4-pigeon097',src,position:'pigeon'});
const galina=()=>({role:'npc ch4-galina097',src:'./galina_base.png',position:'npc'});
const cat=(src=C.base)=>({role:'npc ch4-cat097',src,position:'npc'});
const yard=(background=B.night)=>({background,atmosphere:'village',chapter:4,world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'біля хати баби Галі'}]});
const fog=(background=B.fog)=>({background,atmosphere:'silent',chapter:4,world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'дорога в тумані'}]});

function fixRepeatedReaction096a(){
  const sc=CHAPTER3_SCENES.ch3_state_yebatorium;if(!sc)return;
  sc.text=`– Ех, була не була.

Ви робите крок до ТРУПОСМЕРДА.

Постать поруч різко повертає голову до вас.

– Ти куди поперся?

– Та гірше вже не буде.

– Буде.

ТРУПОСМЕРД теж робить крок до вас.

Ну. Аргумент прийнято.`;
}

function restoreStatuses097(){
  STATUS_DEFS.blessed={name:'СВЯТА ВОДИЧКА ПРАЦЮЄ',portrait:'./portrait_base.png',blurb:'Баба Галя явно шось знала.',mods:{},negativeModShield:1,durationMinutes:60,extraEffects:['Кожен мінус до характеристик від активних станів слабшає на 1.'],remove:'сам мине через 60 ігрових хвилин.'};
  STATUS_DEFS.cowLicked={name:'ВАС ОБЛИЗАЛА КОРОВА',portrait:'./portrait_base.png',blurb:'Не питайте.',mods:{strength:5,attention:5,agility:5,charisma:5,pofigism:5,ahui:5},durationMinutes:60,remove:'сам мине через 1 ігрову годину.'};
  for(const id of ['headInjury'])delete STATUS_DEFS[id];
  if(ITEM_DEFS.holy_water)ITEM_DEFS.holy_water.description='На 60 хвилин послаблює кожен мінус до характеристик від активних станів на 1.';
}

function stripHeadInjury097(){
  for(const sc of Object.values(CHAPTER3_SCENES)){
    if(!sc)continue;
    if(Array.isArray(sc.onEnter))sc.onEnter=sc.onEnter.filter(e=>!(e?.type==='statusAdd'&&e.id==='headInjury')&&!(e?.type==='statusRemove'&&e.id==='headInjury'));
    else if(typeof sc.onEnter==='function'){
      const old=sc.onEnter;sc.onEnter=s=>asArray(old(s)).filter(e=>!(e?.type==='statusAdd'&&e.id==='headInjury')&&!(e?.type==='statusRemove'&&e.id==='headInjury'));
    }
  }
  const wake=CHAPTER3_SCENES.ch3_wakeup;
  if(wake){
    const old=wake.onEnter;
    wake.onEnter=s=>{
      const xs=typeof old==='function'?asArray(old(s)):asArray(old);
      const out=xs.filter(e=>!(e?.type==='statusAdd'&&e.id==='headInjury'));
      if(!s.flags?.shedHeadInjuryStory097){out.push({type:'damage',amount:10,ignoreArmor:true},{type:'flag',key:'shedHeadInjuryStory097',value:true})}
      return out;
    };
    wake.actors=[hero('./hero_injured_096.png'),pigeon(P.base)];
  }
  const g=CHAPTER3_SCENES.ch3_galina;
  if(g){
    g.actors=s=>[hero(s.flags?.shedHeadInjuryStory097?'./hero_injured_096.png':H.shock),galina()];
    const normal=`І тут вас хтось бере під руку. Ви вже майже готові знову ахуєвати, але то баба Галя.\n\nНа всі ваші «а шо це було?», «а хто це був?» і «ви взагалі бачили, шо тут робиться?» вона не відповідає ні слова. Просто веде вас через двір до хати.`;
    const hurt=`Ви ще не дуже впевнено стоїте на ногах, коли з-за рогу виходить баба Галя. Вона дивиться на вас, помічає кров на потилиці й одразу бере під руку.\n\n– Рану треба промити.\n\n– Баб Галь, я питаю, шо то було.\n\n– Чула. Ходи вже.\n\nВона розвертає вас у бік хати.`;
    g.text=s=>s.flags?.shedHeadInjuryStory097?hurt:normal;
  }
}

function introText097(s){
  const vodka=Boolean(s.flags?.creatureVodkaFriend);
  const garlic=Boolean(s.flags?.creatureGarlicUsed||s.flags?.itemKnown095s_garlic);
  const prayer=Boolean(s.flags?.creaturePrayerReactionKnown095w||s.flags?.creaturePrayerStalled095w||s.flags?.creatureKilledByPrayer);
  const fight=Boolean(s.flags?.shedBattleKnockout);
  if(vodka&&garlic){
    return `Семен підходить ближче, кілька секунд придивляється до вас, а тоді впізнає й усміхається.\n\n– О, мужик. Здоров. За горілку спасіба.\n\nВін ставить відро на землю й простягає руку. Ви все-таки тиснете.\n\n– Нема за шо.\n\nСемен не відпускає долоню ще секунду.\n\n– За часник не спасіба.\n\n– Та вже як вийшло.\n\n– Отож.${prayer?'\n\nВін уже збирається йти, але через кілька кроків обертається.\n\n– І молитись не начинай.\n\n– Та йди вже.':''}`;
  }
  if(vodka)return `Семен підходить ближче, кілька секунд придивляється до вас, а тоді впізнає й усміхається.\n\n– О, мужик. Здоров.\n\nВін ставить відро на землю й простягає руку. Ви трохи зависаєте, бо ще недавно ця сама людина лізла до вас із сараю в стані Трупосмерда, але руку все-таки тиснете.\n\n– За горілку спасіба. Хороша була.\n\n– Ти після неї чуть мене не вʼєбав.\n\nСемен хмуриться й на секунду задумується, ніби справді намагається згадати, що там було.\n\n– Та?\n\n– Да.\n\n– Ну, вибачай.\n\nВін ще раз міцно тисне вам руку, піднімає відро й киває Євпапію.\n\n– Здоров.\n\n– Здоров.\n\nВи переводите погляд з одного на другого й уже не витримуєте.\n\n– Блядь. А можна хоть хтось пояснить, чого Трупосмерд вже не зомбак їбучий?`;
  if(garlic)return `Семен доходить майже до вас, упізнає й зупиняється. Якийсь час просто мовчки дивиться, а потім переводить погляд на ваші руки.\n\n– Часнику нема?\n\n– Шо?\n\n– Питаю, часнику з собою нема?\n\n– Нє.\n\n– Добре.\n\nПісля цього він спокійно простягає вам руку, а ви дивитесь то на неї, то на Семена.\n\n– Ти серйозно?\n\n– А шо?\n\n– Я тебе часником палив.\n\n– От і я про то.\n\nВи ще трохи вагаєтесь, але все-таки тиснете руку. Семен киває, піднімає відро й збирається йти далі, а Євпапій поруч дивиться на вас так, як теща, коли ви не викопали їй города.\n\n– Шо? – питаєте ви.\n\n– Нічо.`;
  if(prayer)return `Семен помічає вас, зупиняється й трохи примружується, ніби теж не одразу радий цій зустрічі.\n\n– А. Це ти.\n\n– Я.\n\nВін ставить відро на землю й простягає руку. Ви тиснете, після чого Семен ще кілька секунд уважно дивиться вам в лице.\n\n– Тільки ти це…\n\n– Шо?\n\n– Молитися зараз не начинай.\n\nВи мовчки дивитесь на нього, а Євпапій поруч дуже старанно відвертає голову.\n\n– А ТИ НЕ РЖИ.\n\n– Я мовчу.\n\n– Я бачу, як ти мовчиш.`;
  if(fight)return `Семен упізнає вас, але цього разу не підходить одразу, а зупиняється трохи далі й якийсь час просто дивиться.\n\n– О, мужик.\n\n– Здоров.\n\nВи теж не спішите скорочувати відстань. Кілька секунд стоїте один навпроти одного, поки Семен нарешті не питає:\n\n– Ну шо?\n\n– Нічо.\n\n– Тоді чого дивишся?\n\nВін криво усміхається.\n\n– Думаю, руку тобі давати чи нє.\n\n– А я думаю, тиснути чи нє.\n\nСемен усе-таки підходить ближче й простягає долоню.\n\n– Мир?\n\nВи дивитесь на його руку, потім на нього.\n\n– До наступного сараю.\n\n– Йде.\n\nПісля цього вже тиснете руки.`;
  return `Семен помічає вас ще здалеку й, підійшовши ближче, одразу простягає руку.\n\n– О, мужик. Здоров.\n\n– Здоров…\n\nВи тиснете йому руку, а Семен тим часом уважно дивиться на вас і раптом питає:\n\n– Ти тоді чого так біг?\n\nВи повільно повертаєте до нього голову.\n\n– В смислі?\n\n– Ну від сараю. Летів, аж курява стояла.\n\n– ТИ ЗА МНОЮ БІГ.\n\nСемен хмуриться й якийсь час намагається згадати той момент.\n\n– А-а.\n\nВи чекаєте.\n\n– Може бути.\n\nДесь збоку тихо фиркає Євпапій, і ви навіть не дивитесь у його сторону.\n\n– Не смійся, падло.`;
}

function evpNormal097(s){
  const r=s.relationships?.evpapiy?.values||{};
  return Number(r.offense||0)<7&&!s.companions?.evpapiy?.offended&&!s.flags?.evpapiyEnemyConflict096;
}
function attentive097(s){return effectiveStat(s,'attention')>=4||s.activeStatuses?.includes('suspicious')}

function buildChapter4097(){
  const T=CHAPTER3_SCENES;
  // The name becomes known as soon as the naming scene itself is on screen.
  if(T.ch3_creature){
    const oldEnter=T.ch3_creature.onEnter;
    T.ch3_creature.onEnter=st=>{const xs=typeof oldEnter==='function'?asArray(oldEnter(st)):asArray(oldEnter);return [...xs.filter(e=>!(e?.type==='flag'&&e.key==='truposmerdNamed096')),{type:'flag',key:'truposmerdNamed096',value:true}]};
  }
  const prev=T.ch3_evp_returns;
  if(prev){prev.end=false;delete prev.notice;prev.choices=[{id:'ch4_start097',label:'Далі',next:'ch4_intro'}]}

  T.ch4_intro={...yard(),id:'ch4_intro',caption:'після сараю',actors:[hero(),pigeon(P.base),semen(S.base)],onEnter:[{type:'flag',key:'chapter4Started097',value:true},{type:'relationshipKnown',person:'semen',value:true}],text:introText097,choices:[{id:'ch4_intro_next097',label:'Далі',next:'ch4_son_question'}]};

  T.ch4_son_question={...yard(),id:'ch4_son_question',caption:'одне питання',actors:[hero(H.worry),semen(S.talk),pigeon(P.serious)],text:`Семен уже відійшов метрів на десять, але раптом зупиняється посеред дороги. Кілька секунд стоїть до вас спиною, тримаючи відро біля ноги, а потім повільно повертає голову.\n\n– Мужик.\n\n– Шо?\n\n– В тебе син є?\n\n– Шо ти сказав?\n\nСемен трохи нахиляє голову.\n\n– Питаю, син у тебе є?\n\n– Звідки ти знаєш?\n\nЄвпапій, який до цього крутився поруч, теж затихає. Він переводить погляд на Семена, але нічого не каже.\n\nЗа вашою спиною скриплять двері. З хати виходить баба Галя, спочатку дивиться на вас, потім на Семена й одразу хмуриться.\n\n– До мене йди.\n\nВи навіть не повертаєтесь.\n\n– Баб Галь, він знає про мого сина.\n\n– Я чула. Іди сюди.\n\n– А я хочу знати, звідки він знає.\n\nУ дверях за бабою Галею зʼявляється Риже гамно. Кіт сідає на порозі й теж дивиться на Семена.\n\nСемен стоїть посеред дороги зовсім спокійно.\n\n– Та не заводься ти. Живий твій малий.\n\nВи різко робите крок до нього.\n\n– Ти його бачив?\n\n– Нє.\n\n– Тоді звідки ти знаєш, шо він живий?\n\nСемен уже збирається щось відповісти, але баба Галя перебиває:\n\n– Семене.\n\nВін повертає до неї голову.\n\n– Шо?\n\n– Не треба.\n\n– А шо я?\n\n– Ти поняв.\n\nВін дивиться на неї ще секунду й замовкає, ніби вони обоє прекрасно знають, про шо саме зараз мова.\n\nВи нарешті повертаєтесь до баби Галі.\n\n– А ви тоже знаєте?\n\nВона не відповідає одразу.\n\n– Я вас нормально питаю. Ви знаєте шось про мого сина?\n\n– Не все, шо тут можна почути, треба слухати.\n\n– Я питаю не про те, шо можна слухати. Я питаю, звідки Семен знає про мого сина.\n\nЄвпапій підлітає ближче й сідає на паркан біля дороги.\n\n– Мужик, не лізь зараз.\n\nВи різко дивитесь на нього.\n\n– Ти тоже знаєш?\n\n– Нє.\n\n– Тоді не пизди.\n\nЄвпапій відкриває дзьоб, але передумує відповідати. Семен стоїть навпроти, баба Галя біля ґанку дивиться вже більше на нього, ніж на вас, а Риже гамно не рухається з порога. І чим довше всі мовчать, тим сильніше вас бісить відчуття, що єдиний, кому тут ніхуя не пояснили, – це ви.`,choices:s=>[
    {id:'ch4_ask_semen097',label:'Спитати Семена, шо він знає.',next:'ch4_ask_semen',hiddenEffects:[{type:'flag',key:'ch4AskedSemen097',value:true}]},
    {id:'ch4_ask_galina097',label:'Спитати бабу Галю, чого вона його затикає.',next:'ch4_ask_galina',hiddenEffects:[{type:'flag',key:'ch4AskedGalina097',value:true}]},
    ...(s.activeStatuses?.includes('angry')?[{id:'ch4_angry097',label:'[ЗЛИЙ] Підійти до Семена й витрусити з нього відповідь.',next:'ch4_angry',hiddenEffects:[{type:'flag',key:'ch4GrabbedSemen097',value:true},{type:'relationship',person:'semen',key:'offense',value:1}]}]:[]),
    ...(s.activeStatuses?.includes('suspicious')?[{id:'ch4_susp097',label:'[СОБАКА-ПОДОЗРЄВАКА] Перестати слухати їх і подивитись, шо тут не так.',next:'ch4_suspicious',hiddenEffects:[{type:'flag',key:'ch4WatchedSemen097',value:true}]}]:[]),
    ...(s.activeStatuses?.includes('tired')?[{id:'ch4_tired097',label:'[ЗАЄБАВСЯ] Сісти й заставити їх нарешті пояснити, шо за хуйня.',next:'ch4_tired',hiddenEffects:[{type:'flag',key:'ch4SatDown097',value:true}]}]:[])
  ]};

  T.ch4_ask_semen={...yard(),id:'ch4_ask_semen',caption:'семен',actors:[hero(H.angry),semen(S.side),galina()],text:`– Семене, давай ще раз. Звідки ти знаєш про мого сина?\n\nВін дивиться на вас кілька секунд, а потім його погляд ковзає кудись убік.\n\n– Знаю та й всьо.\n\n– Нє, так не піде. Ти знаєш, шо він у мене є, знаєш, шо він живий. Значить, звідкись ти це взяв.\n\n– Казав же, живий.\n\n– Я почув. Тепер скажи, звідки ти це знаєш.\n\nСемен знову дивиться кудись за ваше плече, але ви поки не звертаєте на це уваги.\n\nБаба Галя напружується.\n\n– Не треба його більше питати.\n\nВи повертаєтесь до неї.\n\n– А кого мені питати? Вас? Бо ви обоє зараз поводитесь так, ніби знаєте щось, шо стосується моєї дитини, але вирішили між собою, шо мені знати не обовʼязково.`,choices:[{id:'ch4_ask_semen_next097',label:'Далі',next:'ch4_watch'}]};

  T.ch4_ask_galina={...yard(),id:'ch4_ask_galina',caption:'баба галя',actors:[hero(H.angry),galina(),semen(S.quiet)],text:`– Чого ви його затикаєте?\n\n– Бо знаю, коли людині краще замовкнути.\n\n– А мені, значить, краще нічого не знати?\n\n– Тобі зараз краще до мене підійти.\n\n– Нє. Ви скажіть, чого він знає про мого сина.\n\nБаба Галя дивиться на Семена.\n\n– Бо меле язиком те, чого не розуміє.\n\nСемен криво всміхається.\n\n– Та всьо я розумію.\n\n– Семене.\n\nУсмішка з його обличчя зникає.\n\nВи дивитесь між ними й відчуваєте, як терпіння закінчується.\n\n– Хтось із вас уже скаже нормально?`,choices:[{id:'ch4_ask_galina_next097',label:'Далі',next:'ch4_watch'}]};

  T.ch4_angry={...yard(),id:'ch4_angry',caption:'терпіння скінчилось',actors:[hero(H.angry),semen(S.side),pigeon(P.serious)],text:`Ви підходите до Семена впритул і хапаєте його за сорочку.\n\n– Ще раз питаю. Звідки ти знаєш?\n\nЄвпапій різко злітає з паркану.\n\n– Мужик, не треба.\n\n– Не лізь.\n\nСемен не виривається й навіть не намагається відштовхнути вас. Просто дивиться спокійно, аж занадто спокійно для мужика, якого щойно схопили за груди.\n\n– Відпусти.\n\n– Скажеш – відпущу.\n\nБаба Галя робить крок із ґанку.\n\n– Руки забрав.\n\nВи ще секунду тримаєте Семена, а тоді помічаєте, що він уже майже не дивиться вам в очі. Його погляд знову йде кудись за ваше плече.`,choices:[{id:'ch4_angry_next097',label:'Далі',next:'ch4_watch'}]};

  T.ch4_suspicious={...yard(),id:'ch4_suspicious',caption:'шось не так',actors:[hero(H.worry),semen(S.side),pigeon(P.serious)],text:`Ви перестаєте слухати, хто кому що каже, і просто дивитесь на бабу Галю, потім на Семена, Євпапія й кота. Баба Галя напружена, Євпапій поводиться незвично серйозно, а Риже гамно так і сидить на порозі, не зводячи очей із дороги.\n\nІ тоді ви помічаєте Семена. Він дивиться на вас кілька секунд, але постійно відводить очі в одне й те саме місце за вашою спиною. Не демонстративно, просто короткий погляд убік, потім знову на вас, і через кілька секунд знову туди.`,choices:[{id:'ch4_susp_next097',label:'Далі',next:'ch4_watch'}]};

  T.ch4_tired={...yard(),id:'ch4_tired',caption:'всьо, сіли',actors:[hero(H.worry),semen(S.side),galina()],text:`Ви відходите до старої лавки біля паркану й сідаєте.\n\n– Всьо. Я нікуди не йду, поки хтось із вас нормально не пояснить, шо відбувається.\n\nБаба Галя дивиться на вас так, ніби терпіння тут закінчилось не тільки у вас.\n\n– Не час зараз упиратись.\n\n– А коли час? Бо я вже третій день прокидаюсь хуй знає де, знайомлюсь із голубом, який говорить, бачу людей, які вчора були майже трупами, а тепер мені ще кажуть, шо мій син живий. Думаю, я вже заслужив хоча б пару нормальних речень.\n\n– Я нічого не приховую, – каже Семен.\n\nВи дивитесь на нього.\n\n– Ти буквально пʼять хвилин тому не міг нормально пояснити, шо з тобою було в сараї. Тому твоє «я нічого не приховую» мене зараз не дуже заспокоює.\n\nЄвпапій тихо фиркає, але майже одразу замовкає, бо Семен знову дивиться вам за спину.`,choices:[{id:'ch4_tired_next097',label:'Далі',next:'ch4_watch'}]};

  T.ch4_watch={...fog(B.fog),id:'ch4_watch',caption:'дорога',actors:[hero(H.worry),semen(S.side),pigeon(P.serious)],text:s=>attentive097(s)?`Цього разу ви ловите його погляд. Вже не перший.\n\nВи різко обертаєтесь. Позаду нікого нема. Між хатами тягнеться мокра дорога, далі починається туман, за яким уже майже не видно краю села.\n\nВи повільно повертаєтесь до Семена.\n\n– Шо там?\n\nВін мовчить.\n\n– Я питаю, на шо ти дивишся?\n\nЄвпапій теж повертає голову в сторону дороги й кілька секунд вдивляється в туман.\n\n– Там ніхуя нема.\n\nСемен не зводить очей із того місця.\n\n– Уже нема.\n\n– Шо значить «уже нема»?\n\nВін не відповідає.`:`Ви ще щось говорите бабі Галі, коли Євпапій раптом повертає голову в сторону дороги. Майже одночасно з ним туди ж дивиться Риже гамно.\n\nВи замовкаєте.\n\n– Шо там?\n\nЄвпапій кілька секунд вдивляється в туман.\n\n– Нічо.\n\n– А чого ви тоді всі туди витріщились?\n\nСемен тихо відповідає:\n\n– Уже нема.\n\nВи переводите погляд на нього.\n\n– Шо «уже нема»?\n\nВін мовчить.`,choices:[{id:'ch4_watch_next097',label:'Далі',next:'ch4_cat_moves'}]};

  T.ch4_cat_moves={...fog(B.fog),id:'ch4_cat_moves',caption:'в тумані',actors:[hero(H.worry),cat(C.side),semen(S.side)],text:`Риже гамно повільно піднімається з порога. Цього разу кіт не потягується й не оглядає двір, а просто спускається з ґанку та йде в сторону дороги.\n\nЄвпапій одразу замовкає.\n\nВи дивитесь то на нього, то на кота.\n\n– Шо?\n\n– Нічо.\n\n– Євпапій.\n\n– Я сказав, нічо.\n\n– Ага, бачу. Один дивиться в туман, другий теж, кіт туди поперся, але всьо заєбісь.\n\nРиже гамно проходить кілька метрів і зупиняється посеред дороги. Воно не шипить і не вигинає спину. Просто стоїть і дивиться вперед.\n\nБаба Галя спускається з ґанку.\n\n– До мене підійди.\n\n– Та шо там?\n\nНіхто не відповідає.\n\nІ тоді Семен зовсім спокійно каже:\n\n– Він тебе кликав.\n\nВи повертаєтесь до нього.\n\n– Хто?\n\n– Син.\n\nНа кілька секунд ви просто дивитесь на Семена.\n\n– Де?\n\nСемен киває в сторону дороги.\n\n– Там.`,choices:[{id:'ch4_cat_next097',label:'Далі',next:'ch4_evp_block'}]};

  T.ch4_evp_block={...fog(B.fog),id:'ch4_evp_block',caption:'не йди',actors:[hero(H.worry),galina(),pigeon(P.serious)],text:s=>{const base=`Баба Галя різко підходить ближче й хапає вас за рукав.\n\n– Не йди.\n\nВи дивитесь спочатку на її руку, потім їй в обличчя.\n\n– Він сказав, шо там мій син.\n\n– Я чула.\n\n– То якого хуя я маю тут стояти?\n\nВона стискає рукав сильніше.\n\n– Бо то не він.\n\nВи завмираєте.\n\n– Шо?\n\n– Не йди туди.\n\n– Ви звідки знаєте, шо не він?\n\nБаба Галя мовчить.\n\nІ от цього мовчання вже достатньо.\n\nВи вириваєте руку й рушаєте вперед.\n\nЄвпапій одразу злітає з місця й сідає посеред дороги перед вами.\n\n– Мужик, нє.\n\n– З дороги.\n\n– Нє.\n\n– Євпапій.\n\n– Я сказав, нє.`;
    if(evpNormal097(s))return `${base}\n\nВи зупиняєтесь, хоч самі не до кінця розумієте чому. За весь час, відколи ця перната зараза причепилась до вас, ви бачили його наглим, довольним, ображеним, злим і ще хуй знає яким, але таким серйозним – ні разу.\n\nВін не кривляється й навіть не пробує сказати якусь дурню.\n\n– Не ходи.\n\nВи дивитесь повз нього в туман.\n\n– Якщо там реально він, а я зараз залишусь тут…\n\n– А якщо там не він?\n\nВи стискаєте щелепу.\n\n– Я мушу перевірити.\n\nЄвпапій не злітає з дороги.\n\n– Мужик, я серйозно.\n\nВи вже хочете його обійти, коли з туману долинає голос.\n\n– Тату?`;
    return `${base}\n\n– Відвали.\n\nВи махаєте рукою, змушуючи Євпапія злетіти з дороги.\n\n– Та ти кончений, чи шо?!\n\nВи вже його не слухаєте й робите кілька кроків у сторону туману.\n\nСаме тоді попереду чується голос.\n\n– Тату?`;},choices:[{id:'ch4_voice_next097',label:'Далі',next:'ch4_voice'}]};

  T.ch4_voice={...fog(B.deep),id:'ch4_voice',caption:'голос',actors:[hero(H.son),pigeon(P.serious)],text:`Ви зупиняєтесь так різко, що Євпапій мало не врізається вам у спину.\n\nЦей голос не просто схожий. Ви його знаєте. Знаєте, як син тягне останню голосну, коли кличе вас із іншої кімнати. Знаєте цей тон, коли йому треба щось показати або коли він уже щось натворив і ще думає, що ви не в курсі.\n\n– Тату!\n\nУ грудях різко стискається.\n\n– Синку?\n\nПозаду баба Галя кричить:\n\n– НЕ ВІДПОВІДАЙ!\n\nАле ви вже відповіли.\n\nДесь попереду в тумані щось рухається. Ви не можете нормально розгледіти, що саме, але це вже не має значення. Ви йдете вперед спочатку повільно, потім швидше, бо це голос вашого сина і ви прекрасно знаєте, як він звучить.\n\nЄвпапій летить поруч.\n\n– Мужик, стій.\n\nВи не реагуєте.\n\n– Ти мене чуєш? Стій!\n\nГолос знову долинає попереду, тепер уже ближче:\n\n– Тату, сюди.`,choices:[{id:'ch4_voice_deeper097',label:'Йти на голос.',next:'ch4_fog_deep'}]};

  T.ch4_fog_deep={...fog(B.deep),id:'ch4_fog_deep',caption:'дороги назад нема',actors:[hero(H.son),pigeon(P.fly)],text:`Ви пришвидшуєте крок. Позаду щось кричить баба Галя, але слів уже не розібрати. Риже гамно зривається з місця й біжить за вами.\n\n– МУЖИК, СТІЙ!\n\nВи йдете далі. Туман стає густішим. Хати по боках дороги поступово зникають із поля зору, але ви цього майже не помічаєте.\n\n– Тату…\n\nГолос уже зовсім близько.\n\nЄвпапій різко заходить перед вами, мало не врізаючись в обличчя.\n\n– СТЕПАНЕ!\n\nВи здригаєтесь і нарешті дивитесь на нього. За весь час він жодного разу не звертався до вас так.\n\nЄвпапій зависає просто перед вами, важко махаючи крилами, а потім його погляд раптом зміщується вам за спину. Ви бачите, як у нього змінюється морда.\n\nПовільно обертаєтесь. Дороги за вами нема. Нема хати баби Галі, паркану, Семена й самого двору. Навіть слідів на землі не видно. Навколо тільки густий туман.\n\n– Блядь, – тихо каже Євпапій.\n\nДесь далеко позаду крізь білу млу пробивається Риже гамно. Кіт біжить до вас, але виглядає так, ніби з кожним кроком стає тільки далі.\n\nЄвпапій різко повертається до вас.\n\n– Назад.\n\nВи дивитесь навколо.\n\n– Куди?\n\nВін мовчить, бо вже теж зрозумів, що назад нема.`,choices:[{id:'ch4_fog_last097',label:'Далі',next:'ch4_fall'}]};

  T.ch4_fall={...fog(B.deep),id:'ch4_fall',caption:'тату, сюди',actors:[hero(H.son),pigeon(P.fly)],text:`І саме тоді голос сина звучить зовсім близько.\n\n– Тату, сюди.\n\nВи повертаєте голову. Попереду в тумані щось стоїть. Ви не можете розгледіти ні обличчя, ні одяг, навіть нормального людського силуету не видно. Просто темніша пляма серед білого.\n\nВи робите крок.\n\n– Степане, не треба.\n\nЩе один.\n\nПід ногою щось просідає. Ви тільки встигаєте опустити очі, але землі під вами вже нема.`,choices:[{id:'ch4_fall_next097',label:'Далі',next:'ch4_evp_after'}]};

  T.ch4_evp_after={...yard(B.night),id:'ch4_evp_after',caption:'де степан',actors:[pigeon(P.base),cat(C.base)],onEnter:[{type:'flag',key:'ch4StepanMissing',value:true},{type:'flag',key:'activeHero097',value:'evpapiy'},{type:'flag',key:'chapter4Complete097',value:true}],text:`Євпапій з розгону влітає мордою в мокру землю. Кілька секунд він лежить нерухомо, потім повільно піднімає голову, випльовує траву й дивиться перед собою.\n\nСтепана нема. На тому місці, де він щойно стояв, знову звичайна сільська дорога. Туман уже відступив далі між хатами, ніби нічого й не сталося.\n\nРиже гамно підбігає через кілька секунд, зупиняється біля Євпапія й дивиться на порожнє місце.\n\nЄвпапій сідає на землю.\n\n– Блядь.\n\nКіт переводить погляд на нього.\n\n– Тільки не кажи, шо ти тоже ніхуя не поняв.\n\nРиже гамно, звісно, нічого не відповідає. Євпапій ще раз дивиться на дорогу, потім на кота.\n\n– Заєбісь.\n\nВін піднімається й струшує з крил болото.\n\n– Пішли.\n\nРиже гамно не рухається й продовжує дивитись туди, де зник Степан.\n\n– Я сказав, пішли. Треба зрозуміти, куди цей довбойоб дівся.\n\nКіт ще секунду стоїть на місці, а тоді розвертається й іде слідом.`,notice:{title:'ТЕПЕР ВИ КЕРУЄТЕ ЄВПАПІЄМ',body:'Степан зник у тумані.'},end:true,choices:[]};
}

function knownChars097(s){
  const entered=new Set(s.story?.entered||[]),out=[];
  const evp=Boolean(s.flags?.metPigeon||entered.has('poop'));
  if(evp)out.push({name:s.flags?.knowsPigeonName?'Євпапій':'???',portrait:'./pigeon_base_095b.webp',facts:[s.flags?.knowsPigeonName?'Жирний голуб. Говорить. На жаль.':'Ви вже зустрілись. І він явно не звичайний голуб.']});
  const galya=entered.has('end')||s.relationships?.galina?.known||[...entered].some(x=>/^galina/i.test(String(x)));
  if(galya)out.push({name:[...entered].some(x=>/^galina(Inside|Pigeon|Watch|Changed|Clothes)/.test(String(x)))?'Баба Галя':'???',portrait:'./galina_base.png',facts:[s.flags?.localClothes?'Дала вам місцеві шмотки.':'???',s.flags?.galinaFedAfterShed?'Нагодувала після сараю.':'???']});
  const hood=entered.has('ch2_figure')||[...entered].some(x=>/^ch3_(intro|obey|turn|tell_off)/.test(String(x)));
  if(hood)out.push({name:'Постать',portrait:'./ch2_unknown_v2.png',facts:['Обличчя: ???','Хто це: ???']});
  const creature=entered.has('ch3_creature')||[...entered].some(x=>/^ch3_(vodka|garlic|run|ask_pigeon|pray)/.test(String(x)));
  if(creature)out.push({name:s.flags?.truposmerdNamed096?'ТРУПОСМЕРД':'???',portrait:'./creature_normal_095f.webp',facts:[s.flags?.truposmerdNamed096?'Виліз із сараю.':'???',s.flags?.creatureGarlicUsed?'Часник йому дуже не подобається.':'???',s.flags?.creatureVodkaFriend?'Горілку любить.':'???']});
  const catSeen=Boolean(s.flags?.catMet||s.flags?.catFirstMeeting||[...entered].some(x=>String(x).startsWith('ch3_cat_')));
  if(catSeen)out.push({name:'Риже гамно',portrait:'./cat_base_095m.png',facts:['Живе в баби Галі.',s.flags?.catFirstMeeting==='insult'?'Ви вже встигли посратись.':'???']});
  const semenSeen=entered.has('ch4_intro')||[...entered].some(x=>String(x).startsWith('ch4_'));
  if(semenSeen)out.push({name:'Семен',portrait:'./ch4_semen_base.png',facts:['Учора виглядав зовсім інакше.',s.flags?.ch4StepanMissing?'Знає про сина Степана більше, ніж сказав.':'???']});
  if(s.flags?.ch4StepanMissing)out.unshift({name:'Степан',portrait:'./ch4_stepan_missing.png',facts:['Місцезнаходження: ???','Слід обривається в тумані.']});
  return out;
}
function renderCharacters097(s){
  const root=document.querySelector('#menuContent');if(!root)return;activate097('characters');const chars=knownChars097(s);
  root.innerHTML=`<div class="section-title"><h2>Персонажі</h2></div>${chars.length?chars.map(c=>`<details class="character-card096"><summary><img src="${esc(c.portrait)}" alt=""><b>${esc(c.name)}</b></summary><div>${c.facts.map(f=>`<p>${esc(f)}</p>`).join('')}</div></details>`).join(''):'<div class="empty-state">Поки ви ні з ким нормально не познайомились.</div>'}`;
}
function activate097(tab){document.querySelectorAll('#menuTabs [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab))}
function mapState097(s){
  const entered=new Set(s.story?.entered||[]),scene=String(s.story?.sceneId||s.scene||''),loc=String(s.world?.location||'');
  return{
    unlocked:Boolean(s.flags?.mapUnlocked),
    home:Boolean(s.flags?.mapUnlocked),
    wake:Boolean(s.flags?.chapter2Started||[...entered].some(x=>String(x).startsWith('ch2_'))),
    shed:Boolean(s.flags?.heardShedConversation||s.flags?.heardShedBang||s.flags?.pigeonSawInsideShed||s.flags?.ignoredShed||[...entered].some(x=>/^ch[23]_/.test(String(x))&&/shed|bang|creature|garlic|vodka|pray|wakeup/.test(String(x)))),
    fog:Boolean(s.flags?.chapter4Started097||[...entered].some(x=>String(x).startsWith('ch4_'))),scene,loc
  };
}
function renderMap097(s){
  activate097('map');const root=document.querySelector('#menuContent');if(!root)return;const m=mapState097(s);
  const marker=(label,x,y,current=false,small=false)=>`<div class="map-marker known${small?' small':''}${current?' current':''}" style="left:${x}%;top:${y}%">${label}</div>`;
  const unknown=(x,y)=>`<div class="map-unknown" style="left:${x}%;top:${y}%"><span>?</span></div>`;
  const curHome=/хат|криниц/i.test(m.loc)&&!/туман/i.test(m.loc),curWake=/помин|стол|двір/i.test(m.loc)&&!/сарай|туман/i.test(m.loc),curShed=/сарай/i.test(m.loc),curFog=/туман/i.test(m.loc);
  const overlays=m.unlocked?[m.home?marker('Хатина з криницею',27,70,curHome):unknown(27,70),m.wake?marker('Двір з поминками',64,39,curWake):unknown(64,39),m.shed?marker('Сарай',83,47,curShed,true):unknown(83,47),m.fog?marker('Дорога в тумані',21,18,curFog,true):unknown(21,18),unknown(45,13),unknown(84,20)].join(''):'';
  root.innerHTML=`<div class="section-title"><h2>Карта</h2></div><div class="map-visual ${m.unlocked?'':'locked'}"><img src="./map_village.jpg?v=084" alt="Карта села">${m.unlocked?`<div class="map-overlays">${overlays}</div>`:'<div class="map-lock-copy"><b>ПОКИ ЗАКРИТО</b><span>Спочатку треба розібратись, де ви взагалі опинились.</span></div>'}</div>${m.unlocked?'<div class="map-help">Назви зʼявляються тоді, коли ви реально відкрили місце. Решта поки лишається під знаком питання.</div>':''}`;
}
function shopSafe097(s){
  if(!s||!s.flags?.shopUnlocked||s.flags?.activeHero097==='evpapiy')return false;
  const th=threatInfo(s);if(th.key!=='low')return false;
  const scene=String(s.story?.sceneId||s.scene||''),loc=String(s.world?.location||'').toLocaleLowerCase('uk-UA');
  if(/^(ch2_(bang|bang3|after_bang|side|garlic|salo|pigeon_scared|figure|end)|ch3_(intro|obey|turn|call_pigeon|tell_off|creature|vodka|garlic|garlic_hit|ask_pigeon|run|pray)|ch4_)/.test(scene))return false;
  if(/туман|ліс/.test(loc))return false;
  return /хат|двір|криниц|помин|село|дорог/.test(loc)||s.world?.environment==='indoors';
}
function shopBlocked097(){activate097('shop');const root=document.querySelector('#menuContent');if(root)root.innerHTML='<div class="section-title"><h2>Крамничка</h2></div><div class="empty-state"><b>Зараз не до того.</b><br><br>Повернетесь до крамнички, коли навколо реально буде спокійно.</div>'}
function missingStepanHtml097(){return `<div class="section-title"><h2>Степан</h2></div><article class="stepan-missing097"><img src="./ch4_stepan_missing.png" alt="Силует Степана"><div class="stepan-missing-copy097"><b>СТЕПАН</b><span>СТАН: ???</span><span>ЗДОРОВʼЯ: ???</span><span>ОДЯГ: ???</span><span>РЕЧІ: ???</span><span>ІНВЕНТАР: ???</span><p>Слід Степана обривається в тумані.</p></div></article>`}
function renderMissingStepan097(){activate097('stepan');const root=document.querySelector('#menuContent');if(root)root.innerHTML=missingStepanHtml097()}

async function currentState097(){
  const t=document.querySelector('#menuMeta')?.textContent||'';const id=Number(t.match(/Проходження\s+(\d+)/)?.[1]||0);if(!id)return null;const raw=await loadRun(id);return raw?normalizeState(raw):null;
}
function replaceTab097(tab,handler){
  const old=document.querySelector(`#menuTabs [data-tab="${tab}"]`);if(!old||old.dataset.v097)return old;
  const neu=old.cloneNode(true);neu.dataset.v097='1';old.replaceWith(neu);neu.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();handler(neu)},true);return neu;
}
function installMenu097(){
  replaceTab097('characters',async()=>{const s=await currentState097();if(s)renderCharacters097(s)});
  replaceTab097('map',async()=>{const s=await currentState097();if(s)renderMap097(s)});
  const shopOld=document.querySelector('#menuTabs [data-tab="shop"]');
  if(shopOld&&!shopOld.dataset.v097){const mainHandler=shopOld.onclick;const neu=shopOld.cloneNode(true);neu.dataset.v097='1';neu.onclick=null;shopOld.replaceWith(neu);neu.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();const s=await currentState097();if(!shopSafe097(s)){shopBlocked097();return}if(typeof mainHandler==='function')mainHandler.call(neu,e);setTimeout(cleanPlayerCopy097,0)},true)}
  let step=document.querySelector('#menuTabs [data-tab="stepan"]');if(!step){step=document.createElement('button');step.dataset.tab='stepan';step.textContent='Степан';step.className='hidden';const inv=document.querySelector('#menuTabs [data-tab="inventory"]');inv?.before(step);step.onclick=renderMissingStepan097}
  for(const tab of ['states','stats','needs','sleep','inventory','clothes']){
    const btn=document.querySelector(`#menuTabs [data-tab="${tab}"]`);if(!btn||btn.dataset.lock097)continue;btn.dataset.lock097='1';btn.addEventListener('click',e=>{if(!document.body.classList.contains('evp-mode097')){setTimeout(cleanPlayerCopy097,0);return}e.preventDefault();e.stopImmediatePropagation();renderMissingStepan097()},true);
  }
}
function cleanPlayerCopy097(){
  const root=document.querySelector('#menuContent');if(!root)return;
  const h=root.querySelector('.section-title h2')?.textContent||'';
  if(h==='Потреби'){const c=root.querySelector('.info-card');if(c)c.textContent='Здоровʼя, вода, ситість і бадьорість видно прямо тут. Якщо бадьорість падає нижче 35%, зʼявляється «ЗАЄБАВСЯ», а вище 55% він минає. Коли вода, ситість або бадьорість доходять до нуля, починає падати здоровʼя.'}
  if(h==='Характеристики'){const x=root.querySelector('.progression-card small');if(x)x.textContent='За деякі рішення й події ви отримуєте XP. 100 XP = новий рівень і 1 очко, яке можна вкласти в характеристику.'}
  root.querySelectorAll('.state-card small,.active-state-card span').forEach(el=>{el.innerHTML=el.innerHTML.replace(/<b>ефект:<\/b>/gi,'<b>дає:</b>').replace(/<b>як позбутись:<\/b>/gi,'<b>як прибрати:</b>').replace(/<b>особливий ефект:<\/b>/gi,'<b>ще:</b>')});
}

async function syncHeroMode097(){
  let s=null;try{s=await currentState097()}catch{}
  const sceneMissing=/ГЛАВА\s*4[\s\S]*де степан/i.test(document.querySelector('#storyKicker')?.textContent||'');
  const missing=sceneMissing||Boolean(s?.flags?.activeHero097==='evpapiy'&&s?.flags?.ch4StepanMissing);
  document.body.classList.toggle('evp-mode097',missing);
  const step=document.querySelector('#menuTabs [data-tab="stepan"]');if(step)step.classList.toggle('hidden',!missing);
  let badge=document.querySelector('#activeHeroBadge097');if(!badge){badge=document.createElement('span');badge.id='activeHeroBadge097';badge.className='active-hero-badge097';document.querySelector('.world-line')?.appendChild(badge)}
  if(badge){badge.textContent=missing?'🕊️ ЄВПАПІЙ':'';badge.classList.toggle('hidden',!missing)}
  if(missing){const n=document.querySelector('#miniNeeds');if(n)n.innerHTML='<span>🕊️ Керуєте Євпапієм</span>'}
}
function installHeroWatcher097(){
  const target=document.querySelector('#storyKicker');if(!target||target.dataset.watch097)return;target.dataset.watch097='1';
  const obs=new MutationObserver(()=>{syncHeroMode097();setTimeout(cleanPlayerCopy097,0)});obs.observe(target,{childList:true,subtree:true,characterData:true});
  document.querySelector('#menuBtn')?.addEventListener('click',()=>setTimeout(async()=>{
    await syncHeroMode097();cleanPlayerCopy097();const s=await currentState097();if(!s)return;const tab=document.querySelector('#menuTabs [data-tab].active')?.dataset.tab;
    if(tab==='characters')renderCharacters097(s);else if(tab==='map')renderMap097(s);else if(tab==='stepan'||(document.body.classList.contains('evp-mode097')&&['states','stats','needs','sleep','inventory','clothes'].includes(tab)))renderMissingStepan097();
  },40));
  syncHeroMode097();
}

function addCss097(){
  if(document.querySelector('#patch097css'))return;const st=document.createElement('style');st.id='patch097css';st.textContent=`
  .stage-image .actor.ch4-hero097{left:1%!important;right:auto!important;bottom:0!important;max-width:38%!important;max-height:91%!important;object-fit:contain!important}
  .stage-image .actor.ch4-semen097{left:auto!important;right:2%!important;bottom:0!important;max-width:39%!important;max-height:92%!important;object-fit:contain!important}
  .stage-image .actor.ch4-pigeon097{left:43%!important;right:auto!important;bottom:4%!important;max-width:20%!important;max-height:36%!important;object-fit:contain!important;z-index:6!important}
  .stage-image .actor.ch4-galina097{left:auto!important;right:2%!important;bottom:0!important;max-width:39%!important;max-height:91%!important;object-fit:contain!important}
  .stage-image .actor.ch4-cat097{left:auto!important;right:5%!important;bottom:2%!important;max-width:30%!important;max-height:48%!important;object-fit:contain!important}
  .stepan-missing097{display:grid;grid-template-columns:minmax(110px,34%) 1fr;gap:18px;align-items:center;border:1px solid #34443a;border-radius:18px;padding:16px;background:#111b16}.stepan-missing097 img{width:100%;max-height:330px;object-fit:contain;filter:brightness(.8)}.stepan-missing-copy097{display:flex;flex-direction:column;gap:8px}.stepan-missing-copy097>b{font-size:1.15rem}.stepan-missing-copy097 span{font-weight:700}.stepan-missing-copy097 p{margin:10px 0 0;color:#c9c2b7}.active-hero-badge097{font-weight:800}.evp-mode097 .quick-row,.evp-mode097 .active-states{display:none!important}.evp-mode097 #miniNeeds{min-width:auto!important}.evp-mode097 #miniNeeds .need-mini{display:none!important}
  @media(max-width:620px){.stepan-missing097{grid-template-columns:1fr;text-align:center}.stepan-missing097 img{max-height:240px}.stage-image .actor.ch4-hero097{max-width:43%!important}.stage-image .actor.ch4-semen097,.stage-image .actor.ch4-galina097{max-width:43%!important}.stage-image .actor.ch4-pigeon097{left:39%!important;max-width:22%!important}}
  `;document.head.appendChild(st);
}

function injectTest097(){
  if(PUBLIC_BUILD){document.querySelector('#testModeBtn')?.remove();return}
  const panel=document.querySelector('.test-mode-panel');if(!panel||panel.dataset.v097)return;panel.dataset.v097='1';
  const opts=panel.querySelector('.test-options');if(opts){
    const l=document.createElement('label');l.innerHTML='<input type="checkbox" id="testAll097" checked> Відкрити всі стани й дати всі тестові предмети';opts.appendChild(l);
    for(const [id,label] of [['testBlessed097','СВЯТА ВОДИЧКА ПРАЦЮЄ'],['testCow097','ВАС ОБЛИЗАЛА КОРОВА'],['testPigeon097','СРАНИЙ ГОЛУБ ВАС ПРИНИЗИВ'],['testHang097','ЖОСТКИЙ БУДУНЯРА']]){const x=document.createElement('label');const status=id==='testBlessed097'?'blessed':id==='testCow097'?'cowLicked':id==='testPigeon097'?'pigeonHumiliated':'hangover';x.innerHTML=`<input type="checkbox" id="${id}" data-test-status096="${status}"> Дати ${label}`;opts.appendChild(x)}
  }
  const chapters=panel.querySelector('.test-chapters');if(chapters&&!chapters.querySelector('[data-test-ch4-097]')){
    const wrap=document.createElement('div');wrap.className='test-ch4-097';wrap.innerHTML='<select id="testCh4Memory097"><option value="vodka">Глава 4 після горілки</option><option value="garlic">Глава 4 після часнику</option><option value="prayer">Глава 4 після молитви</option><option value="fight">Глава 4 після сутички</option></select><button type="button" data-test-ch4-097>Глава 4</button>';chapters.appendChild(wrap);
    wrap.querySelector('[data-test-ch4-097]').onclick=async()=>{
      const memory=wrap.querySelector('#testCh4Memory097')?.value||'vodka';await clearRun(99);let s=createInitialState(99);s=normalizeState(s);s.chapter=4;s.story={chapter:4,sceneId:'ch4_intro',entered:[],finished:false};s.scene='ch4_intro';s.flags={...s.flags,testMode:true,initialStatusPopupShown:true,mapUnlocked:true,shopUnlocked:true,chapter1Complete:true,chapter2Started:true,chapter2Complete:true,localClothes:true,catMet:true,catFirstMeeting:'polite',truposmerdNamed096:true};s.companions.evpapiy.known=true;s.companions.evpapiy.active=true;s.companions.evpapiy.state='З вами';s.relationships.evpapiy.known=true;s.relationships.galina.known=true;
      if(memory==='vodka')s.flags.creatureVodkaFriend=true;if(memory==='garlic')s.flags.creatureGarlicUsed=true;if(memory==='prayer')s.flags.creaturePrayerReactionKnown095w=true;if(memory==='fight')s.flags.shedBattleKnockout=true;
      let cfg={};try{cfg=JSON.parse(localStorage.getItem('dnt-test-v096')||'{}')}catch{}cfg.all097=Boolean(document.querySelector('#testAll097')?.checked);try{localStorage.setItem('dnt-test-v096',JSON.stringify(cfg));localStorage.setItem('dnt-autostart-test097','1')}catch{}await saveRun(normalizeState(s));location.reload();
    };
  }
  document.querySelectorAll('[data-test-chapter]').forEach(btn=>btn.addEventListener('click',()=>{let cfg={};try{cfg=JSON.parse(localStorage.getItem('dnt-test-v096')||'{}')}catch{}cfg.all097=Boolean(document.querySelector('#testAll097')?.checked);try{localStorage.setItem('dnt-test-v096',JSON.stringify(cfg))}catch{}},true));
}
function installTest097(){
  if(PUBLIC_BUILD){document.querySelector('#testModeBtn')?.remove();return}
  document.querySelector('#testModeBtn')?.addEventListener('click',()=>{for(const ms of [0,80,250,600])setTimeout(injectTest097,ms)},true);
  let auto='';try{auto=localStorage.getItem('dnt-autostart-test097')||'';localStorage.removeItem('dnt-autostart-test097')}catch{}
  if(auto==='1')setTimeout(()=>{document.querySelector('#testModeBtn')?.click();setTimeout(()=>document.querySelector('#continueTestBtn')?.click(),650)},450);
}

function stamp097(){document.querySelectorAll('.version,.howto-version,.game-name span').forEach(el=>el.textContent='v0.9.7b TEST')}
function warm097(){for(const src of [...Object.values(H),...Object.values(S),...Object.values(B),'./ch4_stepan_missing.png']){const im=new Image();im.src=src}}
function apply097(){fixRepeatedReaction096a();restoreStatuses097();stripHeadInjury097();buildChapter4097();addCss097();installMenu097();installHeroWatcher097();installTest097();cleanPlayerCopy097();warm097();stamp097()}
queueMicrotask(apply097);
