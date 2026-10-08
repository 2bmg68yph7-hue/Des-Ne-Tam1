// Owns the new interludes and their consequences; never rewrites a canonical scene.
import {clone,executeAction,effectiveStat,itemCount,addHeroXp,addEvpXp} from './engine.js?v=096b';
import {activeActor} from './world.js';
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
 ]}
};
export function supplementalScene(id){return SCENES[id]||null}
export function routeNext(state,next){
  if(next==='ch2_intro'&&state.chapter===1&&!state.flags.preparation1Complete)return'ch1_prepare';
  if(next==='ch2_pee'&&state.chapter===2&&!state.flags.preparation2Complete)return'ch2_prepare';
  return next;
}
const ENTRY_XP={intro:10,poop:10,galinaChanged:10,ch1_prepare:70,ch2_legend:15,ch2_prepare:15,ch2_figure:25};
export function entryGameplay(state,scene){
  let s=clone(state),events=[];s.gameplay=s.gameplay||{version:1,rewards:{}};s.gameplay.rewards=s.gameplay.rewards||{};
  const id=scene.id,amount=ENTRY_XP[id];
  if(amount&&!s.gameplay.rewards[id]){events.push(...(activeActor(s)==='evpapiy'?addEvpXp(s,amount):addHeroXp(s,amount)));s.gameplay.rewards[id]=amount}
  if(id==='ch2_side'&&!s.flags.potionConsumedGameplay&&itemCount(s,'potion_unknown')){
    const r=executeAction(s,{effects:[{type:'itemRemove',id:'potion_unknown',qty:1},f('potionConsumedGameplay')]});s=r.state;events.push(...r.events);
  }
  return{state:s,events};
}
