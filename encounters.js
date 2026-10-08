import {clone,executeAction,effectiveStat,itemCount,removeItem,addItem} from './engine.js?v=096b';
import {activeActor,timePhase,awardExplorationXp} from './world.js';
import {talent,canFly} from './bird-config.js';
import {currentLocation} from './expedition.js';
import {LOCATIONS} from './locations.js';

export const ENEMIES={
 dog:{name:'Здичавілий пес',hp:28,damage:8,intent:'Гарчить і перекриває стежку. Їжа може його відволікти.'},
 rustle:{name:'Хтось у заростях',hp:34,damage:10,intent:'Ворушиться ближче. Можна зійти зі стежки й перечекати.'},
 cat:{name:'Риже гамно',hp:28,damage:6,intent:'Прикриває шматок сала лапою. Вбивати його ніхто не збирається.'},
 crow:{name:'Нахабна ворона',hp:24,damage:6,intent:'Зайняла гілку й не пускає ближче. Треба відстояти місце або поступитися.'}
};
function random(s){s.resourceWorld=s.resourceWorld||{};let x=Number(s.resourceWorld.rngSeed)||(Number(s.createdAt)^0x6d2b79f5);x^=x<<13;x^=x>>>17;x^=x<<5;s.resourceWorld.rngSeed=x>>>0;return (x>>>0)/4294967296}
export function startEncounter(state,kind='dog',quest=null,from=currentLocation(state)){
 if(!ENEMIES[kind]||state.health<=0||state.pendingBattle||state.expedition?.encounter)return{state:clone(state),accepted:false,events:[]};
 const s=clone(state);if(!s.expedition||s.expedition.anchor!==s.scene)s.expedition={anchor:s.scene,origin:currentLocation(s),current:currentLocation(s),worldOrigin:clone(s.world),travelCount:0};
 s.expedition.encounter={kind,quest,hp:ENEMIES[kind].hp,turn:0,blind:0,poopUsed:false,from,startedAt:s.clock.totalMinutes};
 s.resourceWorld=s.resourceWorld||{};s.resourceWorld.lastEncounterAt=s.clock.totalMinutes;
 return{state:s,events:[],accepted:true,message:ENEMIES[kind].intent};
}
export function maybeEncounter(s,from){
 const site=currentLocation(s),risk=LOCATIONS[site]?.risk||0;
 if(!risk||s.health<20||s.clock.totalMinutes-Number(s.resourceWorld?.lastEncounterAt??-1000)<45)return s;
 const chance=(timePhase(s)==='night'?.3:.12)+(risk-1)*.1;
 if(random(s)<chance)return startEncounter(s,site==='road'||site==='bank'?'dog':'rustle',null,from).state;return s;
}
export function encounterActions(s){
 const e=s.expedition?.encounter;if(!e||s.health<=0)return[];const bird=activeActor(s)==='evpapiy',out=[];
 const add=(id,label,detail,enabled=true)=>out.push({id,label,detail,enabled});
 add('attack',bird?'Ударити дзьобом':itemCount(s,'knife')?'Відбитися ножем':'Відбитися руками','4 енергії. Сила, зброя й бойовий стан змінюють шкоду.',s.needs.energy>=4);
 add('guard','Прикритися й шукати вихід','Доступно навіть без енергії. Послаблює удар; ворог втрачає 2 HP.');
 add('hide','Завмерти в укритті','Уважність, ніч і здібності допомагають. У разі невдачі ворог діє.');
 add('flee','Відійти назад по стежці','Гарантовано завершує зустріч. Низька спритність коштує до 5% здоров’я.');
 if(effectiveStat(s,'ahui')>=3)add('odd-path','Помітити дивний просвіт','Ахуй ≥3: обхід небезпеки з витратою часу.');
 if(effectiveStat(s,'pofigism')>=3)add('calm','Спокійно відступити','Похуїзм ≥3: відхід без паніки та зайвої травми.');
 for(const id of ['salo','berries'])if(itemCount(s,id))add('lure:'+id,'Відволікти їжею','Їжа −1. Дозволяє вийти без удару.');
 for(const id of ['bandage','medkit'])if(itemCount(s,id))add('heal:'+id,'Лікуватися під час сутички','Предмет −1. Після лікування ворог робить хід.');
 if(itemCount(s,'garlic')&&e.kind==='rustle')add('garlic','Кинути часник','Часник −1; ворог втрачає хід і 8 HP.');
 if(bird&&talent(s,'poop')&&!e.poopUsed)add('poop','Обісрати з висоти','6 енергії; здібність позбавляє ворога ходів.',canFly(s)&&s.needs.energy>=6);
 const c=s.companions.evpapiy,v=s.relationships.evpapiy?.values||{};
 if(!bird&&c.active&&c.hp>10&&!c.skipBattles&&!c.offended&&Number(v.offense)<6){const free=Number(v.trust)>=4;add('companion',free?'Попросити Євпапія відволікти':'Запропонувати Євпапію сало за допомогу',free?'Довіра: допомога без предмета; голуб витратить здоров’я.':'Сало −1; без винагороди він не погодиться.',free||itemCount(s,'salo')>0)}
 return out;
}
function finish(s,e,outcome,events){
 const bird=activeActor(s)==='evpapiy';
 s.encounterHistory=s.encounterHistory||[];s.encounterHistory.push({kind:e.kind,quest:e.quest,outcome,turns:e.turn,location:currentLocation(s),clock:s.clock.totalMinutes,actor:activeActor(s)});
 s.journal=s.journal||[];s.journal.push({id:'encounter-'+outcome,text:ENEMIES[e.kind].name,detail:{win:'Супротивник відступив.',hidden:'Перечекали в укритті.',escaped:'Відійшли стежкою назад.',defeat:'Ледь вирвалися. Залишилися травма й виснаження.'}[outcome],chapter:s.chapter,clock:s.clock.totalMinutes,actor:activeActor(s)});
 if(outcome==='win')events.push(...awardExplorationXp(s,15));
 if(outcome==='escaped'||outcome==='defeat'){
  const to=e.from||s.expedition.origin;if(LOCATIONS[to]&&(LOCATIONS[currentLocation(s)]?.links||[]).includes(to)){s.expedition.current=to;s.world.location=LOCATIONS[to].label;s.world.environment=LOCATIONS[to].indoors?'indoors':'outdoors'}
 }
 delete s.expedition.encounter;
 if(bird){s.companions.evpapiy.hp=Math.round(s.health/100*s.companions.evpapiy.maxHp)}
 return{state:s,events,accepted:true,outcome,quest:e.quest,message:s.journal.at(-1).detail};
}
export function performEncounterAction(state,id){
 const a=encounterActions(state).find(x=>x.id===id);if(!a||!a.enabled)return{state:clone(state),accepted:false,events:[],message:'Оберіть доступну дію: відхід лишається відкритим.'};
 let s=clone(state),e=s.expedition.encounter,events=[],effects=[],outcome=null;const bird=activeActor(s)==='evpapiy';e.turn++;
 if(id==='attack'){effects.push({type:'need',key:'energy',value:-4});e.hp-=4+effectiveStat(s,'strength')*2+(bird?talent(s,'beak')*3:itemCount(s,'knife')?3:0)}
 if(id==='guard')e.hp-=2;
 if(id==='hide'){const chance=Math.min(.95,.35+effectiveStat(s,'attention')*.08+(timePhase(s)==='night'?.12:0)+(bird?(talent(s,'thief')+talent(s,'eye'))*.08:0)-(s.activeStatuses.includes('skunk')?.3:0));if(random(s)<chance)outcome='hidden'}
 if(id==='flee'){outcome='escaped';if(effectiveStat(s,'agility')<3)effects.push({type:'damage',amount:5,ignoreArmor:true})}
 if(id==='odd-path'||id==='calm')outcome='escaped';
 if(id.startsWith('lure:')){effects.push({type:'itemRemove',id:id.split(':')[1],qty:1});outcome='escaped'}
 if(id.startsWith('heal:')){const med=id.split(':')[1];effects.push({type:'itemRemove',id:med,qty:1},{type:'health',value:med==='medkit'?25:12})}
 if(id==='garlic'){effects.push({type:'itemRemove',id:'garlic',qty:1});e.hp-=8;e.blind++}
 if(id==='poop'){effects.push({type:'need',key:'energy',value:-6});e.blind=1+talent(s,'poop');e.poopUsed=true}
 if(id==='companion'){const v=s.relationships.evpapiy.values;if(Number(v.trust)<4)effects.push({type:'itemRemove',id:'salo',qty:1});s.companions.evpapiy.hp=Math.max(1,s.companions.evpapiy.hp-4);e.hp-=10+talent(s,'beak')*3;e.blind++}
 if(e.hp<=0)outcome='win';
 if(!outcome){if(e.blind>0)e.blind--;else{const damage=Math.max(1,ENEMIES[e.kind].damage-(id==='guard'?5:0)-(effectiveStat(s,'pofigism')>=3?1:0));effects.push({type:'damage',amount:damage})}}
 const r=executeAction(s,{id:'field-'+id,minutes:id==='odd-path'?10:id==='flee'?8:3,activity:'light',effects});s=r.state;events.push(...r.events);e=s.expedition.encounter;
 if(s.health<=0){s.health=1;outcome='defeat';const trauma=executeAction(s,{effects:[{type:'statusAdd',id:bird?'birdWings':'bump'},{type:'need',key:'energy',value:-15}]});s=trauma.state;events.push(...trauma.events)}
 if(outcome)return finish(s,e,outcome,events);
 return{state:s,events,accepted:true,message:'Сутичка триває. Можна відступити або змінити спосіб.'};
}
