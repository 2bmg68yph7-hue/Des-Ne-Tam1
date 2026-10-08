// v0.10.0 TEST – Дарина, Постать і глава 7.
// Сюжетний патч без нових механік: оновлює арт Постаті, вводить Дарину в главі 6,
// зберігає факт, що вона впізнала Степана ще біля сараю, і додає главу 7.
import {CHAPTER2_SCENES} from './chapter2.js?v=096b';
import {CHAPTER3_SCENES} from './chapter3.js?v=096b';
import {createInitialState,normalizeState} from './engine.js?v=096b';
import {loadRun,saveRun,clearRun} from './storage.js?v=096b';
import {readGameState} from './main.js?v=095';

const VERSION100='v0.10.0 TEST';
const A100={
  darinaBase:'./darina_base_100.png',
  darinaHood:'./ch2_unknown_v2.png',
  darinaHoodReach:'./darina_hood_reach_100.png',
  darinaReveal:'./darina_reveal_100.png',
  darinaEmotional:'./darina_emotional_100.png',
  stepanAngry:'./stepan_angry_100.png',
  stepanShock:'./stepan_shock_100.png',
  stepanSmirk:'./stepan_smirk_100.png',
  stepanCrySmile:'./stepan_cry_smile_100.png',
  stepanOverwhelmed:'./stepan_overwhelmed_100.png',
  fog:'./ch7_fog_100.jpg',
  morningEvp:'./ch2_wake_yard_evp_100.jpg'
};

const hero100=(src=A100.stepanShock)=>({role:'hero ch7-hero100',src,position:'hero'});
const darina100=(src=A100.darinaReveal)=>({role:'npc ch7-darina100 face-left',src,position:'npc'});
const pigeon100=(src='./pigeon_base_095b.webp')=>({role:'pigeon ch4-pigeon097',src,position:'pigeon'});
const galina100=()=>({role:'npc ch4-galina097',src:'./galina_base.png',position:'npc'});
const fog100={background:A100.fog,atmosphere:'silent',chapter:7,storyPace:'calm',shopAccess:false,world:[
  {type:'world',key:'environment',value:'outdoors'},
  {type:'world',key:'location',value:'білий туман'}
]};
const yard6100={background:'./ch4_night.jpg',atmosphere:'village',chapter:6,storyPace:'urgent',shopAccess:false,world:[
  {type:'world',key:'environment',value:'outdoors'},
  {type:'world',key:'location',value:'біля хати баби Галі'}
]};

function hasStatus100(s,id){return Boolean((s?.activeStatuses||[]).includes(id))}
function addEnter100(scene,effects){
  if(!scene)return;
  const old=scene.onEnter;
  scene.onEnter=s=>{
    const base=typeof old==='function'?old(s):(old||[]);
    return [...(Array.isArray(base)?base:[base].filter(Boolean)),...effects];
  };
}
function swapHoodArt100(scene,src=A100.darinaHoodReach){
  if(!scene)return;
  const patch=actors=>(actors||[]).map(a=>String(a?.src||'').includes('ch2_unknown_v2.png')?{...a,src}:a);
  if(typeof scene.actors==='function'){
    const old=scene.actors;scene.actors=s=>patch(old(s));
  }else scene.actors=patch(scene.actors);
}

function patchEarlierDarina100(){
  const C2=CHAPTER2_SCENES,C3=CHAPTER3_SCENES;

  // Новий ранковий двір. На першому екрані Євпапій уже сидить на паркані у фоні,
  // у всіх інших сценах використовується чиста версія без дубля голуба.
  if(C2.ch2_intro)C2.ch2_intro.background=A100.morningEvp;

  // Біля сараю це вже Дарина. Вона впізнає Степана тут, але гравець про це ще не знає.
  if(C2.ch2_figure){
    C2.ch2_figure.actors=[{role:'hero',src:'./ch2_hero_scared.png',position:'hero'},darina100(A100.darinaHood)];
    addEnter100(C2.ch2_figure,[
      {type:'flag',key:'darinaRecognizedStepanAtShed100',value:true},
      {type:'memory',person:'hood',key:'recognizedStepanAtShed100',value:true}
    ]);
    if(typeof C2.ch2_figure.text==='function'){
      const old=C2.ch2_figure.text;
      C2.ch2_figure.text=s=>`${old(s)}\n\nПостать на якусь секунду завмирає, ніби побачила не те, що чекала. Потім ще нижче опускає голову й нічого не каже.`;
    }
  }
  if(C2.ch2_end)C2.ch2_end.actors=[{role:'hero',src:'./ch2_hero_scared.png',position:'hero'},darina100(A100.darinaHood)];

  // У сценах, де Постать фізично смикає Степана, використовуємо окремий простий ассет з рукою.
  for(const id of ['ch3_intro','ch3_obey','ch3_turn','ch3_tell_off'])swapHoodArt100(C3[id],A100.darinaHoodReach);
  for(const id of ['ch3_pray'])swapHoodArt100(C3[id],A100.darinaHood);
}

function patchChapter6100(){
  const T=CHAPTER3_SCENES;
  if(T.ch6_salo099d)T.ch6_salo099d.choices=[{id:'ch6_salo_next100',label:'Далі',next:'ch6_darina099d'}];

  // Дарина вперше зʼявляється відкрито для гравця, але її звʼязок зі Степаном ще не пояснюємо.
  T.ch6_darina099d={...yard6100,id:'ch6_darina099d',caption:'дарина',actors:[pigeon100('./pigeon_base_095b.webp'),galina100(),darina100(A100.darinaBase)],onEnter:[
    {type:'flag',key:'darinaAppeared099d',value:true}
  ],text:`І тут із-за хвіртки чути жіночий голос:\n\n– А шо тут опять сталося?\n\nУ двір заходить жінка з темним волоссям. Баба Галя дивиться на неї так, ніби чекала значно пізніше.\n\n– Дарина…\n\n– Шо?\n\nЄвпапій різко повертається до неї.\n\n– Степан де?\n\nГолуб зависає.\n\n– А ти звідки знаєш, як його звати?\n\nДарина на секунду мовчить.\n\n– Де він?`,choices:[{id:'ch6_darina_next100',label:'Далі',next:'ch6_darina_fog100'}]};

  T.ch6_darina_fog100={...yard6100,id:'ch6_darina_fog100',caption:'назад у туман',actors:[pigeon100('./pigeon_suspicious.png'),darina100(A100.darinaBase)],text:`– На старій дорозі, – каже Євпапій. – Пішов за голосом малого. Туман закрив дорогу, я вилетів назад, а його нема.\n\nДарина блідне.\n\n– Давно?\n\n– Та тільки шо. Я на все село орав, поки сюди летів.\n\n– Чула.\n\nВона вже розвертається до хвіртки.\n\n– Ей. Ти куда?\n\n– За ним.\n\n– Ти його взагалі знаєш?\n\nДарина зупиняється, але не повертається.\n\n– Знаю.\n\n– Дуже содержательно, блядь.\n\n– Потім.`,choices:[{id:'ch6_darina_fog_next100',label:'Далі',next:'ch6_end100'}]};

  T.ch6_end100={...yard6100,id:'ch6_end100',caption:'вона пішла',actors:[pigeon100('./pigeon_suspicious.png'),galina100()],onEnter:[
    {type:'flag',key:'chapter6Complete100',value:true},
    {type:'flag',key:'storyUrgent099',value:false}
  ],text:`Дарина виходить за хвіртку й зникає в темряві дороги.\n\nЄвпапій ще секунду дивиться їй услід.\n\n– Бабо.\n\n– Шо?\n\n– А це зараз шо було?\n\nБаба Галя поправляє хустку.\n\n– Потім.\n\nЄвпапій повільно повертає до неї голову.\n\n– Та ви тут всі, блядь, зговорились.`,choices:[{id:'ch7_start100',label:'ГЛАВА 7. ПРАВИЛА',next:'ch7_intro100'}]};
}

function patchChapter7100(){
  const T=CHAPTER3_SCENES;

  T.ch7_intro100={...fog100,id:'ch7_intro100',caption:'ПРАВИЛА',actors:[hero100(A100.stepanOverwhelmed),darina100(A100.darinaHood)],onEnter:[
    {type:'flag',key:'chapter7Started100',value:true},
    {type:'flag',key:'ch4StepanMissing',value:false},
    {type:'flag',key:'ch5StepanMissing099c',value:false},
    {type:'flag',key:'activeHero097',value:false},
    {type:'flag',key:'storyUrgent099',value:false}
  ],text:`Ви приходите до тями на холодній землі. Голова гуде, в роті присмак крові, а навколо густий білий туман. Ні дороги, ні хат, ні навіть нормального неба. Ви повільно сідаєте, мацаєте потилицю й дивитесь на кров на пальцях.\n\n– Ну заєбісь. Я вже починаю впізнавати сервіс.\n\n– Не вставай різко.\n\nВи завмираєте й повертаєте голову. За кілька метрів стоїть Постать. Та сама, що задовбувала біля сараю, поки не появився Трупосмерд. Чи то Семен.\n\n«Та хто їх розбере», – думаєте ви.\n\n– Т-а-акс, а ти ким будеш, а?\n\n– Я бачила, як ти впав. До того тоже багато чого бачила. Дуже насичене в нас знайомство.`,choices:[{id:'ch7_reveal_move100',label:'Далі',next:'ch7_reveal100'}]};

  T.ch7_reveal100={...fog100,id:'ch7_reveal100',caption:'каптур',actors:[hero100(A100.stepanShock),darina100(A100.darinaReveal)],onEnter:[
    {type:'flag',key:'darinaRevealed100',value:true},
    {type:'relationshipKnown',person:'hood',value:true},
    {type:'memory',person:'hood',key:'isDarina100',value:true}
  ],text:`Вона підходить ближче й повільно знімає каптур. Ви впізнаєте її ще до того, як повністю бачите обличчя – по тому самому руху рукою, яким вона завжди прибирала волосся від щоки.\n\nУ вас тупо перестають нормально тримати ноги.\n\n– Ти?..\n\nДарина дивиться на вас і теж ніби не знає, з чого почати.`,choices:s=>[
    {id:'ch7_real100',label:'Ти справжня?',next:'ch7_real100',hiddenEffects:[{type:'relationship',person:'hood',key:'trust',value:1},{type:'memory',person:'hood',key:'firstReply100',value:'real'}]},
    {id:'ch7_where100',label:'Де ти була?',next:'ch7_where100',hiddenEffects:[{type:'memory',person:'hood',key:'firstReply100',value:'where'}]},
    ...(hasStatus100(s,'angry')?[{id:'ch7_angry100',label:'[ЗЛИЙ] Ти хоч розумієш, шо я пережив?',next:'ch7_angry100',hiddenEffects:[{type:'relationship',person:'hood',key:'offense',value:1},{type:'memory',person:'hood',key:'firstReply100',value:'angry'}]}]:[]),
    ...(hasStatus100(s,'tired')?[{id:'ch7_tired100',label:'[ЗАЄБАВСЯ] Я зараз або тебе обійму, або знову впаду.',next:'ch7_tired100',hiddenEffects:[{type:'relationship',person:'hood',key:'trust',value:1},{type:'memory',person:'hood',key:'firstReply100',value:'tired'}]}]:[])
  ]};

  const replyBase100={...fog100,caption:'дарина'};
  T.ch7_real100={...replyBase100,id:'ch7_real100',actors:[hero100(A100.stepanShock),darina100(A100.darinaEmotional)],text:`– Ти справжня?\n\n– Поки да.\n\n– Не смішно.\n\n– Я й не жартую.\n\nВона простягає руку. Ви берете її за долоню й одразу намацуєте маленький шрам на великому пальці.\n\n– Блядь.\n\n– Ага.`,choices:[{id:'ch7_real_next100',label:'Далі',next:'ch7_four_years100'}]};

  T.ch7_where100={...replyBase100,id:'ch7_where100',actors:[hero100(A100.stepanShock),darina100(A100.darinaEmotional)],text:`– Де ти була?\n\n– Довго розказувати.\n\n– Я нікуди не спішу. Походу, навіть не знаю куда.\n\n– От це якраз проблема.`,choices:[{id:'ch7_where_next100',label:'Далі',next:'ch7_four_years100'}]};

  T.ch7_angry100={...replyBase100,id:'ch7_angry100',actors:[hero100(A100.stepanAngry),darina100(A100.darinaEmotional)],text:`– Ти хоч розумієш, шо я пережив?\n\nДарина не відводить очей.\n\n– Розумію.\n\n– Нє. Не розумієш.\n\n– Тоді розкажи.\n\nІ от це чогось злить ще більше, бо вона навіть не пробує виправдатись.`,choices:[{id:'ch7_angry_next100',label:'Далі',next:'ch7_four_years100'}]};

  T.ch7_tired100={...replyBase100,id:'ch7_tired100',actors:[hero100(A100.stepanCrySmile),darina100(A100.darinaEmotional)],text:`– Я зараз або тебе обійму, або знову впаду.\n\n– Давай перше. Ти сьогодні вже падав.\n\n– Справедливо.`,choices:[{id:'ch7_tired_next100',label:'Далі',next:'ch7_four_years100'}]};

  T.ch7_four_years100={...fog100,id:'ch7_four_years100',caption:'чотири роки',actors:[hero100(A100.stepanOverwhelmed),darina100(A100.darinaEmotional)],text:`Ви підходите й берете її за руки. Стільки разів уявляли цю розмову, що тепер у голові замість нормальних слів якась каша.\n\n– Малому три роки було. Ти вийшла з дому, сказала, шо до вечора вернешся, і всьо. Поліція, лікарні, морги. Я твою фотку всюди носив. Потім люди вже мене впізнавали, а тебе так ніхто й не знайшов.\n\n– Я хотіла вернутись.\n\n– Ну, трохи затрималась.\n\n– Степан…\n\n– Хоч би знак якийсь. Хоч шось. Я роками не знав, ти жива чи я вже просто шукаю людину, якої нема.\n\nДарина стискає ваші руки.\n\n– Я пробувала вернутись. Шукала ту саму дорогу, кричала, шукала людей. Воно звідси просто не працює так, як дома.\n\nВона замовкає, а потім дивиться вам прямо в очі.\n\n– Скільки зараз малому?`,choices:[{id:'ch7_four_years_next100',label:'Далі',next:'ch7_son100'}]};

  T.ch7_son100={...fog100,id:'ch7_son100',caption:'малий',actors:[hero100(A100.stepanSmirk),darina100(A100.darinaEmotional)],text:`– Сім.\n\nДарина завмирає.\n\n– Уже сім?\n\n– Ага. В школу пішов.\n\n– Перший клас?\n\n– Ага. Ранець сам вибирав. Уйобіщний такий, з машинками. Я йому нормальний показував, а він уперся.\n\nУ неї криво смикається рот.\n\n– Значить, точно твій син.\n\n– Та йди ти.\n\nВона сміється й одразу починає плакати.\n\n– Я першого вересня не бачила.\n\n– Зато ранець не бачила. Уже плюс.\n\n– Дебіл.\n\n– Ну а шо мені ще сказати?\n\nДарина витирає лице рукавом.\n\n– Нічого. Просто говори.`,choices:[{id:'ch7_son_next100',label:'Далі',next:'ch7_arrival100'}]};

  T.ch7_arrival100={...fog100,id:'ch7_arrival100',caption:'як вона сюди попала',actors:[hero100(A100.stepanSmirk),darina100(A100.darinaReveal)],text:`– Тепер твоя черга. Як ти взагалі тут оказалась?\n\n– Йшла до зупинки. Почула твій голос із дороги.\n\n– Мій?\n\n– Ти мене кликав.\n\nВи дивитесь на неї.\n\n– Мене тут тоді ще навіть не було.\n\n– Я тепер знаю.\n\n– І тебе це не напрягає?\n\n– Степане, я живу в селі, де вертані через пару днів можуть прийти горілку просити. Мене багато шо напрягає, але список уже довгий.\n\n– Аргумент.\n\nДарина розказує, що пішла на голос, потрапила в туман і назад дороги вже не знайшла. Її знайшла баба Галя й забрала до себе. Відтоді Дарина живе в неї.\n\n– Бабуся мене тоді фактично підібрала.\n\n– Як кота.\n\n– Десь так.\n\n– А Риже гамно шо?\n\n– Ти про кота? Він появився пізніше.`,choices:[{id:'ch7_arrival_next100',label:'Далі',next:'ch7_shed_truth100'}]};

  T.ch7_shed_truth100={...fog100,id:'ch7_shed_truth100',caption:'хто кого підібрав',actors:[hero100(A100.stepanSmirk),darina100(A100.darinaReveal)],onEnter:[
    {type:'flag',key:'darinaRecognizedStepanRevealed100',value:true},
    {type:'flag',key:'chapter7Complete100',value:true},
    {type:'memory',person:'hood',key:'recognizedStepanAtShedKnown100',value:true}
  ],text:`– Значить, тебе вона першою підібрала.\n\n– Не називай це так.\n\n– А шо? Потім ще кота підібрала. Система працює.\n\n– Степане.\n\n– Всьо, мовчу.\n\nДалі ви взнаєте, що біля сараю Дарина впізнала вас одразу. Але поки ви пішли з бабою Галею, туман відрізав її від дороги. До двору вона вибралась уже тоді, коли Євпапій літав по селу й орав, що Степан пропав.\n\n– І ти пішла назад у туман.\n\n– А ти б не пішов?\n\nВи згадуєте голос сина.\n\n– Блядь.\n\n– Отож.`,end:true,choices:[]};
}

function characterName100(card){return card?.querySelector('summary b,b')?.textContent?.trim()||''}
function setCharacterArt100(card,src){
  if(!card)return;
  const summary=card.querySelector('summary');if(!summary)return;
  let img=summary.querySelector('img');
  const ph=summary.querySelector('.character-placeholder099');
  if(!img){img=document.createElement('img');img.alt='';if(ph)ph.replaceWith(img);else summary.prepend(img)}
  if(img.getAttribute('src')!==src)img.src=src;
}
let menuGuard100=false;
async function patchMenuKnowledge100(){
  if(menuGuard100)return;
  const root=document.querySelector('#menuContent');if(!root)return;
  const h=root.querySelector('.section-title h2')?.textContent?.trim();
  if(h!=='Персонажі'&&h!=='Стосунки')return;
  menuGuard100=true;
  try{
    const cards=[...root.querySelectorAll(h==='Персонажі'?'.character-card096':'.relation-card')];
    const darinaCard=cards.find(c=>characterName100(c)==='Дарина');
    const hoodCard=cards.find(c=>characterName100(c)==='Постать');
    const runId=Number((document.querySelector('#menuMeta')?.textContent||'').match(/Проходження\s+(\d+)/)?.[1]||0);
    const state=readGameState()||(runId?await loadRun(runId):null);
    const revealed=Boolean(state?.flags?.darinaRevealed100);
    if(h==='Персонажі'){
      if(darinaCard){
        setCharacterArt100(darinaCard,revealed?A100.darinaReveal:A100.darinaBase);
        const body=darinaCard.querySelector('div');
        const html=revealed
          ?'<p>Ваша дружина.</p><p>Зникла чотири роки тому.</p><p>Впізнала вас ще біля сараю.</p>'
          :'<p>Живе в баби Галі.</p><p>Звідки знає Степана: ???</p>';
        if(body&&body.innerHTML!==html)body.innerHTML=html;
      }
      if(revealed&&hoodCard)hoodCard.remove();
    }else if(revealed&&hoodCard){
      const b=hoodCard.querySelector('b');if(b)b.textContent='Дарина';
    }
  }finally{menuGuard100=false}
}

function syncRevealFlag100(){
  try{
    const txt=document.querySelector('#storyKicker')?.textContent||'';
    const revealed=/ГЛАВА 7/.test(txt)&&!document.querySelector('#gameScreen')?.classList.contains('hidden')&&[
      'каптур','дарина','чотири роки','малий','як вона сюди попала','хто кого підібрав'
    ].some(x=>txt.toLowerCase().includes(x));
    window.__dntDarinaRevealed100=revealed;
  }catch{}
}
function installMenuPatch100(){
  const content=document.querySelector('#menuContent');if(content)new MutationObserver(()=>setTimeout(patchMenuKnowledge100,0)).observe(content,{childList:true,subtree:true});
  const kicker=document.querySelector('#storyKicker');if(kicker)new MutationObserver(()=>{syncRevealFlag100();setTimeout(patchMenuKnowledge100,0)}).observe(kicker,{childList:true,subtree:true,characterData:true});
}

function stamp100(){document.querySelectorAll('.version,.howto-version,.game-name span').forEach(el=>el.textContent=VERSION100)}

function freshChapter7TestState100(){
  let s=createInitialState(99);
  s.flags={...(s.flags||{}),testMode:true,initialStatusPopupShown:true,mapUnlocked:true,shopUnlocked:true,chapter1Complete:true,chapter2Started:true,chapter2Complete:true,chapter3Complete:true,chapter4Complete099c:true,chapter5Complete099c:true,chapter6Complete100:true,metPigeon:true,knowsPigeonName:true,catMet:true,semenEncountered099:true,semenIntroduced099:true,darinaAppeared099d:true,darinaRecognizedStepanAtShed100:true};
  s.story={...(s.story||{}),entered:['poop','ch2_figure','ch3_intro','ch4_intro','ch5_intro','ch5_fall099c','ch6_darina099d','ch6_end100'],sceneId:'ch7_intro100',chapter:7,finished:false};
  s.scene='ch7_intro100';s.chapter=7;
  s=normalizeState(s);
  s.runId=99;s.chapter=7;s.scene='ch7_intro100';s.story={...(s.story||{}),chapter:7,sceneId:'ch7_intro100',finished:false};
  s.flags={...(s.flags||{}),testMode:true,initialStatusPopupShown:true,chapter6Complete100:true,darinaAppeared099d:true,darinaRecognizedStepanAtShed100:true};
  return s;
}
async function launchChapter7Test100(e){
  e?.preventDefault?.();e?.stopPropagation?.();
  try{await clearRun(99)}catch{}
  await saveRun(freshChapter7TestState100());
  try{localStorage.setItem('dnt-autostart-test099b','1')}catch{}
  location.reload();
}
function ensureChapter7TestButton100(){
  const chapters=document.querySelector('.test-mode-panel .test-chapters');if(!chapters||chapters.querySelector('[data-test-ch7-100]'))return;
  const b=document.createElement('button');b.type='button';b.setAttribute('data-test-ch7-100','');b.textContent='Глава 7';b.addEventListener('click',launchChapter7Test100);chapters.appendChild(b);
}
function installTestButton100(){
  const btn=document.querySelector('#testModeBtn');if(btn)btn.addEventListener('click',()=>{for(const ms of [0,80,220,500])setTimeout(ensureChapter7TestButton100,ms)},true);
}

function installRevealStateTracking100(){
  // Для меню достатньо знати, чи гравець уже дійшов до відкритого обличчя у поточній сесії.
  const kicker=document.querySelector('#storyKicker');
  if(!kicker)return;
  const run=()=>{syncRevealFlag100();};run();new MutationObserver(run).observe(kicker,{childList:true,subtree:true,characterData:true});
}

function apply100(){
  patchEarlierDarina100();
  patchChapter6100();
  patchChapter7100();
  stamp100();
  installMenuPatch100();
  installRevealStateTracking100();
  installTestButton100();
  document.documentElement.dataset.dntVersion='100';
}

apply100();
