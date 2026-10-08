// Owns the new interludes and their consequences; never rewrites a canonical scene.
import {clone,executeAction,effectiveStat,itemCount,addHeroXp,addEvpXp} from './engine.js?v=096b';
import {activeActor} from './world.js';
import {MILESTONE_XP,FOG_BALANCE} from './balance.js';
const f=(key,value=true)=>({type:'flag',key,value});
const need=(key,value)=>({type:'need',key,value});
const gift=id=>({type:'itemAdd',id,qty:1});
const hero={role:'hero',src:'./man_local.png',position:'hero'};
const bird={role:'pigeon',src:'./pigeon_base_095b.webp',position:'pigeon'};
const galina={role:'npc',src:'./galina_base.png',position:'npc'};
const once=(s,key,choice)=>s.flags[key]?[]:[{...choice,effects:[...(choice.effects||[]),f(key)]}];
const upgrade=s=>s.heroProgression.points>0?[{id:'open-upgrades',label:'Застосувати очко розвитку.',menu:'stats'}]:[];
const SCENES={
 ch1_prepare:{id:'ch1_prepare',chapter:1,caption:'перед виходом',background:'./bg_hut.jpg',atmosphere:'hut',world:[{type:'world',key:'environment',value:'indoors'},{type:'world',key:'location',value:'хата баби Галі'}],actors:[hero,galina],text:'Перш ніж виходити, ви перевіряєте кишені й те, що взяли з собою. За порогом уже чути село.\n\nМожна прихопити води, домовитися про невеликий запас або просто йти далі. Кожен варіант лишає історію відкритою.',choices:s=>[
   ...upgrade(s),
   ...once(s,'packedWater1',{id:'pack-water1',label:'Набрати воду в дорогу.',minutes:5,activity:'light',effects:[gift('water'),need('water',15)]}),
   ...once(s,'packedFood1',{id:'pack-food1',label:effectiveStat(s,'charisma')>=3?'Домовитися про харч у дорогу.':'Допомогти прибрати зі столу за харч у дорогу.',minutes:effectiveStat(s,'charisma')>=3?5:15,activity:effectiveStat(s,'charisma')>=3?'dialogue':'light',effects:[gift('salo'),{type:'relationship',person:'galina',key:'trust',value:1}]}),
   ...once(s,'checkedEquipment1',{id:'check-kit1',label:'Перевірити спорядження.',minutes:effectiveStat(s,'attention')>=3?3:8,activity:'light',effects:[f('equipmentChecked')]}),
   {id:'leave-prepared1',label:'Вийти з хати.',next:'ch2_intro',effects:[f('preparation1Complete')]}
 ]},
 ch2_prepare:{id:'ch2_prepare',chapter:2,caption:'перед сараєм',background:'./ch2_table.jpg',atmosphere:'village',world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'двір з поминками'}],actors:s=>[hero,...(s.companions.evpapiy.active?[bird]:[])],text:'За столом ще гомонять. Ви перевіряєте, що лишилося в кишенях, перш ніж відійти за сарай.\n\nДовго тут затримуватись не хочеться. Але глянути, куди ступаєте, можна.',choices:s=>[
   ...upgrade(s),
   ...once(s,'checkedPath2',{id:'check-path2',label:'Придивитися до проходу.',minutes:effectiveStat(s,'attention')>=3?2:6,activity:'light',effects:[f('threatPrepared')]}),
   ...once(s,'calmedBeforeShed2',{id:'calm-before-shed2',label:'Зібратися з думками.',minutes:effectiveStat(s,'pofigism')>=3?2:5,activity:'dialogue',effects:[f('calmPrepared'),{type:'statusRemove',id:'angry'}]}),
   {id:'continue-to-shed2',label:'Відійти за сарай.',next:'ch2_pee',effects:[f('preparation2Complete')]}
 ]},
 ch3_prepare:{id:'ch3_prepare',chapter:3,caption:'після сараю',background:'./bg.jpg',atmosphere:'village',world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'біля хати баби Галі'}],actors:s=>[hero,...(s.companions.evpapiy.active?[bird]:[])],text:'Ви затримуєтеся на ґанку. Після сараю тіло нагадує про себе навіть тоді, коли голова зайнята зовсім іншими питаннями.\n\nМожна перевірити травму й припаси, перш ніж іти далі.',choices:s=>[
   ...upgrade(s),{id:'look-around3',label:'Оглянути місце та доступну допомогу.',menu:'place'},
   ...once(s,'checkedWound3',{id:'check-wound3',label:'Перевірити травму й перев’язку.',minutes:effectiveStat(s,'attention')>=3?3:8,activity:'light',effects:[f('bandageChecked')]}),
   ...once(s,'recovered3',{id:'recover3',label:'Перепочити на ґанку.',minutes:20,activity:'rest',effects:[{type:'wetness',value:-20}]}),
   {id:'leave-prepared3',label:'Йти далі.',next:'ch4_intro',effects:[f('preparation3Complete')]}
 ]},
 ch4_prepare:{id:'ch4_prepare',chapter:4,caption:'ніч і наступний день',background:'./bg_hut.jpg',atmosphere:'hut',world:[{type:'world',key:'environment',value:'indoors'},{type:'world',key:'location',value:'хата баби Галі'}],actors:[{...hero,src:'./hero_shrug_096.png'},galina],text:'Ви заходите до хати. На сьогодні відповідей більше не буде, але є де переночувати.\n\nПеред ніччю можна розібрати припаси й подбати про травму. Наступний день мине біля хати: сон, харч і невелика допомога по господарству теж мають свою ціну.',choices:s=>[
   ...upgrade(s),{id:'look-around4',label:'Перевірити місце, припаси й допомогу.',menu:'place'},
   ...(effectiveStat(s,'charisma')>=3||s.relationships.galina.values.trust>=6&&s.relationships.galina.values.offense<4?[{id:'night-help4',label:'Домовитися про нічліг і харч. Спати 8 годин.',overnight:'help',next:'ch5_intro'}]:[]),
   {id:'night-work4',label:'Допомогти по господарству за харч. Спати 8 годин.',overnight:'work',next:'ch5_intro'},
   ...(itemCount(s,'water')&&itemCount(s,'salo')?[{id:'night-own4',label:'Скористатися власною водою й салом. Спати 8 годин.',overnight:'own',next:'ch5_intro'}]:[]),
   {id:'night-watch4',label:'Спати 4 години, решту ночі прислухатися до двору.',overnight:'watch',next:'ch5_intro'}
 ]},
 ch5_prepare:{id:'ch5_prepare',chapter:5,caption:'під вечір',background:'./ch4_night.jpg',atmosphere:'village',world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'біля хати баби Галі'}],actors:s=>[{...hero,src:'./hero_shrug_096.png'},...(s.companions.evpapiy.active?[bird]:[])],text:'Під вечір ви перевіряєте, що лишилося після дня біля хати. Надворі вогко, а ноги й голова ще пам’ятають сарай.\n\nПоки є можливість, можна поповнити воду, оглянути дорогу поряд і привести одяг до ладу.',choices:s=>[
   ...upgrade(s),{id:'look-around5',label:'Перевірити припаси й доступну допомогу.',menu:'place'},
   ...once(s,'waterPrepared5',{id:'water-prep5',label:'Попити й набрати одну пляшку води.',minutes:5,activity:'light',effects:[need('water',35),gift('water')]}),
   ...once(s,'routePrepared5',{id:'route-prep5',label:s.flags.catFirstMeeting==='polite'?'Оглянути двір поряд із котом, якого вже не проганяєте.':'Придивитися до дороги й своїх кроків.',minutes:effectiveStat(s,'attention')>=3||s.flags.catFirstMeeting==='polite'?5:12,activity:'light',effects:[f('routePrepared')]}),
   ...once(s,'driedBeforeRoad5',{id:'dry-prep5',label:'Висушити мокрий одяг біля дверей.',minutes:15,activity:'rest',effects:[{type:'wetness',value:-45}]}),
   {id:'leave-prepared5',label:'Повернутися до розмови.',next:'ch5_intro',effects:[f('preparation5Complete')]}
 ]},
 ch6_prepare:{id:'ch6_prepare',chapter:6,caption:'крила теж болять',background:'./ch4_night.jpg',atmosphere:'village',world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'біля хати баби Галі'}],onEnter:[f('storyUrgent099',false)],actors:[bird,galina],text:'Євпапій струшує крила. Після удару об дорогу вони слухаються не відразу. Баба Галя ще стоїть поряд.\n\nПоки можна, варто перевірити себе, попити й зібратися з силами. Степанові припаси лишилися зі Степаном.',choices:s=>[
   ...(s.companions.evpapiy.progression.points>0?[{id:'bird-upgrades6',label:'Застосувати очко розвитку Євпапія.',menu:'companions'}]:[]),
   {id:'bird-place6',label:'Оглянути двір.',menu:'place'},
   ...once(s,'birdCare6',{id:'bird-care6',label:'Дозволити Галі оглянути крило й дати води.',minutes:5,activity:'rest',effects:[{type:'health',value:12},{type:'statusRemove',id:'birdWings'},need('water',30),{type:'wetness',value:-25}]}),
   ...once(s,'birdFood6',{id:'bird-food6',label:'Домовитися про маленький шматок сала.',minutes:3,activity:'dialogue',effects:[need('satiety',25),gift('salo')]}),
   ...once(s,'birdLook6',{id:'bird-look6',label:'Оглянути двір згори, бережучи травмоване крило.',minutes:effectiveStat(s,'attention')>=4?3:8,activity:'light',effects:[need('energy',-4),f('birdCheckedYard6')]}),
   {id:'bird-continue6',label:'Повернутися до розмови.',next:'ch6_darina099d',effects:[f('preparation6Complete')]}
 ]}
};
export function supplementalScene(id){return SCENES[id]||null}
export function routeNext(state,next){
  if(next==='ch2_intro'&&state.chapter===1&&!state.flags.preparation1Complete)return'ch1_prepare';
  if(next==='ch2_pee'&&state.chapter===2&&!state.flags.preparation2Complete)return'ch2_prepare';
  if(next==='ch4_intro'&&state.chapter===3&&!state.flags.preparation3Complete)return'ch3_prepare';
  if(next==='ch5_intro'&&state.chapter===4&&!state.flags.preparation4Complete)return'ch4_prepare';
  if(next==='ch5_intro'&&!state.flags.preparation5Complete)return'ch5_prepare';
  if(next==='ch6_darina099d'&&state.chapter===6&&!state.flags.preparation6Complete)return'ch6_prepare';
  return next;
}
export function entryGameplay(state,scene){
  let s=clone(state),events=[];s.gameplay=s.gameplay||{version:1,rewards:{}};s.gameplay.rewards=s.gameplay.rewards||{};
  const id=scene.id,amount=MILESTONE_XP[id];
  if(amount&&!s.gameplay.rewards[id]){events.push(...(activeActor(s)==='evpapiy'?addEvpXp(s,amount):addHeroXp(s,amount)));s.gameplay.rewards[id]=amount}
  if(id==='ch2_side'&&!s.flags.potionConsumedGameplay&&itemCount(s,'potion_unknown')){
    const r=executeAction(s,{effects:[{type:'itemRemove',id:'potion_unknown',qty:1},f('potionConsumedGameplay')]});s=r.state;events.push(...r.events);
  }
  if(id==='ch6_darina099d'&&!s.flags.darinaLocalReportKnown&&s.flags.birdReportDelivered&&s.memories.evpapiy?.reportVerified){s.flags.darinaLocalReportKnown=true;s.journal=s.journal||[];s.journal.push({id:'report-passed',text:'Місцеві орієнтири',detail:'Галя передала Дарині перевірені місцеві орієнтири, які Євпапій залишив у неї.',chapter:6,clock:s.clock.totalMinutes,actor:'evpapiy'})}
  const actions={
   ch5_into_fog099c:{minutes:FOG_BALANCE.walkMinutes,activity:'walk',effects:[{type:'world',key:'weather',value:{kind:'fog',label:'Туман',icon:'🌫️',tempC:10,wind:1,rain:0}},{type:'wetness',value:12}]},
   ch5_voice_deeper099c:{minutes:FOG_BALANCE.rushMinutes,activity:'walk',effects:[need('energy',effectiveStat(s,'agility')>=3?-2:-5)]},
   ch5_no_road099c:{minutes:FOG_BALANCE.walkMinutes,activity:'walk',effects:[{type:'wetness',value:10}]},
   ch5_fall099c:{effects:[{type:'damage',amount:Math.max(6,(effectiveStat(s,'agility')>=3||s.flags.routePrepared||s.flags.scoutedRoute?FOG_BALANCE.preparedFall:FOG_BALANCE.unpreparedFall)-(s.flags.bandageChecked?FOG_BALANCE.bandageBenefit:0)),ignoreArmor:true},{type:'statusAdd',id:'bump'},f('fogFallApplied')]},
   ch6_intro099d:{minutes:3,activity:'light',effects:[{type:'damage',amount:s.memories.world?.sharedSupplies?4:8,ignoreArmor:true},{type:'statusAdd',id:'birdWings'},{type:'wetness',value:25}]},
   ch6_name099d:{minutes:effectiveStat(s,'agility')>=4?5:10,activity:'walk',effects:[]},
   ch7_intro100:{effects:[{type:'world',key:'weather',value:{kind:'fog',label:'Туман',icon:'🌫️',tempC:10,wind:1,rain:0}},...(effectiveStat(s,'pofigism')>=3||s.activeStatuses.includes('blessed')?[]:[{type:'statusAdd',id:'scared'}])]}
  };
  s.gameplay.situations=s.gameplay.situations||{};
  if(actions[id]&&!s.gameplay.situations[id]){const r=executeAction(s,{id:`situation_${id}`,activity:'light',...actions[id]});s=r.state;events.push(...r.events);s.gameplay.situations[id]=true}
  return{state:s,events};
}

export function advanceOvernight(state,mode='work'){
 let s=clone(state),events=[];
 if(s.flags.preparation4Complete)return{state:s,events,accepted:false};
 const r=executeAction(s,{id:'night_provisions',effects:mode==='own'?[{type:'itemRemove',id:'water',qty:1},{type:'itemRemove',id:'salo',qty:1},need('water',30),need('satiety',25)]:[need('water',mode==='help'?65:50),need('satiety',mode==='help'?55:40),...(mode==='help'?[{type:'health',value:8}]:[])]});
 if(r.accepted===false)return r;s=r.state;events.push(...r.events);
 s.world.environment='indoors';
 const start=s.clock.totalMinutes,target=(Math.floor(start/1440)+1)*1440+1080,bedtime=Math.floor(start/1440)*1440+1320;
 const run=(minutes,activity)=>{if(minutes<=0||s.health<=0)return;const r=executeAction(s,{minutes,activity});s=r.state;events.push(...r.events)};
 if(mode==='work')run(20,'work');
 run(Math.max(0,bedtime-s.clock.totalMinutes),'routine');
 run(Math.min(mode==='watch'?240:480,Math.max(0,target-s.clock.totalMinutes)), 'sleep_house');
 run(Math.max(0,target-s.clock.totalMinutes),'routine');
 const finish=executeAction(s,{effects:[f('preparation4Complete'),f('chapter5TimeSet099c'),...(mode==='watch'?[f('routePrepared')]:[]),...(mode==='work'?[{type:'relationship',person:'galina',key:'trust',value:1}]:[]),...(mode!=='watch'&&s.needs.water>=40&&s.needs.satiety>=40?[{type:'statusRemove',id:'hangover'}]:[]),{type:'memory',person:'galina',key:'nightArrangement',value:mode}]});
 return{...finish,events:[...events,...finish.events]};
}
export function performGameplayChoice(state,choice){return choice.overnight?advanceOvernight(state,choice.overnight):executeAction(state,{id:choice.id,minutes:choice.minutes||0,activity:choice.activity||'light',effects:choice.effects||[],hiddenEffects:choice.hiddenEffects||[]})}
