import {clone,normalizeState,executeAction,effectiveStat,itemCount,addItem,removeItem} from './engine.js?v=096b';
import {activeActor,locationContext,timePhase,awardExplorationXp} from './world.js';
import {LOCATIONS} from './locations.js';
import {ITEM_DEFS} from './data.js?v=096b';
import {chapterOf} from './chapters.js';

const WINDOWS=new Set(['ch1_prepare','ch2_prepare','ch3_prepare','ch4_prepare','ch5_prepare','ch6_prepare']);
const SMALL_EARLY=new Set(['intro','outside','insideEat','inside_eat']);
export function canExplore(s){return s.health>0&&!s.pendingBattle&&!s.expedition?.encounter&&(WINDOWS.has(s.scene)||SMALL_EARLY.has(s.scene))}
function originFor(s){const c=locationContext({...s,expedition:null});return ['hut','well','wake','road','fog'].includes(c.site)?c.site:'yard'}
export function currentLocation(s){return s.expedition?.anchor===s.scene?s.expedition.current:originFor(s)}
export function awayFromStory(s){return s.expedition?.anchor===s.scene&&s.expedition.current!==s.expedition.origin}
export function locationLabel(s){return LOCATIONS[currentLocation(s)]?.label||s.world.location}
export function discoveredLocations(s){const known=new Set(['hut','yard','well',...(s.resourceWorld?.discovered||[])]);if(chapterOf(s)>=2)known.add('wake');if((s.story.entered||[]).some(x=>/^ch2_(bang|figure|end)/.test(x)))known.add('shed');if(chapterOf(s)>=5)known.add('road');if(chapterOf(s)===7)known.add('fog');known.add(currentLocation(s));return known}
export function travelOptions(s){
 const current=currentLocation(s),links=LOCATIONS[current]?.links||[];
 return links.filter(id=>!LOCATIONS[id].storyOnly&&(LOCATIONS[id].chapter||1)<=chapterOf(s)).map(id=>({id,label:discoveredLocations(s).has(id)?LOCATIONS[id].label:'Невідома стежка',minutes:travelMinutes(s,id),risk:(LOCATIONS[id].risk||0)+(timePhase(s)==='night'?1:0),available:canExplore(s)}));
}
function travelMinutes(s,to){const bird=activeActor(s)==='evpapiy',slow=s.needs.energy<20||s.activeStatuses.includes('bump'),night=timePhase(s)==='night';return (bird?6:12)+(slow?10:0)+(night?6:0)+(LOCATIONS[to]?.risk||0)*4}
function initialize(s){
 s.resourceWorld={version:1,discovered:[],stocks:{},traps:{},...(s.resourceWorld||{})};
 if(s.expedition?.anchor!==s.scene)s.expedition={anchor:s.scene,origin:originFor(s),current:originFor(s),worldOrigin:clone(s.world),travelCount:0};
}
function setLocation(s,id){s.expedition.current=id;const d=LOCATIONS[id];s.world.location=d.label;s.world.environment=d.indoors?'indoors':'outdoors';if(!s.resourceWorld.discovered.includes(id))s.resourceWorld.discovered.push(id)}
function journal(s,id,text,detail){s.journal=s.journal||[];s.journal.push({id,text,detail,chapter:chapterOf(s),clock:s.clock.totalMinutes,actor:activeActor(s)})}
function refusal(s,message){return{state:clone(s),events:[],accepted:false,message}}
export function travel(state,to){
 if(!canExplore(state)||!travelOptions(state).some(x=>x.id===to))return refusal(state,'Ця стежка зараз недоступна.');
 let s=clone(normalizeState(state));initialize(s);
 const minutes=travelMinutes(s,to),night=timePhase(s)==='night';
 const r=executeAction(s,{id:'travel-'+to,minutes,activity:'walk',effects:[]});s=r.state;initialize(s);setLocation(s,to);s.expedition.travelCount++;
 // Choosing deliberate movement avoids mandatory random damage and soft locks.
 journal(s,'travel-'+to,'Перехід: '+LOCATIONS[to].label,`${minutes} хв${night?' · нічний шлях довший':''}. Припаси й енергія витрачені.`);
 return{...r,state:s,message:LOCATIONS[to].description};
}
function distance(from,to){const q=[[from,0]],seen=new Set();while(q.length){const [id,d]=q.shift();if(id===to)return d;if(seen.has(id))continue;seen.add(id);for(const next of LOCATIONS[id]?.links||[])q.push([next,d+1])}return 1}
export function returnToStory(state){
 if(!awayFromStory(state)||state.health<=0||state.expedition?.encounter)return refusal(state,'Спочатку завершіть поточну небезпеку.');
 const s=clone(state),hops=distance(s.expedition.current,s.expedition.origin),minutes=hops*(activeActor(s)==='evpapiy'?8:16),world=clone(s.expedition.worldOrigin);
 const r=executeAction(s,{id:'return-to-story',minutes,activity:'walk',effects:[]});
 // Slow withdrawal remains possible with an exhausted bag; no free teleport.
 if(r.state.health<=0){r.state.health=1;r.events.push({type:'health',actual:1,visible:true});r.state.memories.world={...(r.state.memories.world||{}),exhaustedReturn:true}}
 r.state.world={...world,weather:clone(r.state.world.weather)};r.state.expedition.current=r.state.expedition.origin;
 journal(r.state,'return-to-story','Повернення до сюжетного місця',`${minutes} хв · пройдено назад ${hops} відрізків. Припаси не відновлено.`);
 return{...r,message:'Повернулися. Можна продовжити історію.'};
}

export const RESOURCE_POOLS={
 forest:{berries:{qty:3,regen:720},mushrooms:{qty:2,regen:1440},herbs:{qty:2,regen:720},wood:{qty:3,regen:720}},
 bog:{herbs:{qty:3,regen:720},mushrooms:{qty:2,regen:1440}},
 well:{water:{qty:3,regen:360}},
 abandoned:{cloth:{qty:3,regen:0},rope:{qty:1,regen:0},medkit:{qty:1,regen:0}},
 bank:{raw_meat:{qty:2,regen:1440}},
 yard:{cloth:{qty:2,regen:0}}
};
export function stock(s,site,id){const def=RESOURCE_POOLS[site]?.[id];if(!def)return 0;const saved=s.resourceWorld?.stocks?.[site+':'+id];if(!saved)return def.qty;if(def.regen>0&&s.clock.totalMinutes-saved.emptyAt>=def.regen)return def.qty;return saved.left}
function reduceStock(s,site,id,qty){const key=site+':'+id,left=stock(s,site,id)-qty;s.resourceWorld.stocks[key]={left,emptyAt:s.clock.totalMinutes};}
export const RECIPES={
 bandage:{name:'Трав’яна перев’язка',input:{herbs:1,cloth:1},output:'bandage',minutes:10},
 rope:{name:'Сплести мотузку',input:{cloth:2},output:'rope',minutes:12},
 trap:{name:'Зібрати просту пастку',input:{wood:1,rope:1},output:'trap',minutes:15},
 tea:{name:'Заварити настій',input:{herbs:1,water:1,wood:1},output:'tea',minutes:15,fire:true},
 mushroom_stew:{name:'Грибна юшка',input:{mushrooms:2,water:1,wood:1},output:'stew',minutes:20,fire:true},
 meat_stew:{name:'Юшка з дичини',input:{raw_meat:1,water:1,wood:1},output:'stew',minutes:25,fire:true}
};
export function expeditionActions(s){
 if(!canExplore(s))return[];const site=currentLocation(s),night=timePhase(s)==='night',bird=activeActor(s)==='evpapiy',out=[];
 const add=(id,label,minutes,detail,extra={})=>out.push({id,label,minutes,detail,...extra});
 for(const [id,def] of Object.entries(RESOURCE_POOLS[site]||{})){
  if(id==='raw_meat'||bird&&['wood','medkit','rope','cloth'].includes(id))continue;
  const left=stock(s,site,id),minutes=(effectiveStat(s,'attention')>=3?8:15)+(night?10:0);
  add('gather:'+id,site==='abandoned'?'Обшукати: '+ITEM_DEFS[id].name:'Зібрати: '+ITEM_DEFS[id].name,minutes,`${left} порцій лишилося. ${def.regen?'Поповнення після '+def.regen/60+' годин ігрового часу.':'Разова схованка.'}${night?' У темряві пошук довший.':''}`,{done:left===0});
 }
 if(['hut','yard','well','wake'].includes(site)){
  if(['hut','well'].includes(site))add('drink','Попити на місці',5,'+35 води. Без пляшки та повторного XP.');
  add('rest','Перепочити на безпечному місці',30,'Відновлює енергію. Їжа й вода трохи витрачаються; мокрі крила або одяг підсихають.');
 }
 if(!bird){
  for(const [id,r] of Object.entries(RECIPES))if(!r.fire||site==='hut')add('craft:'+id,r.name,r.minutes,Object.entries(r.input).map(([i,q])=>`${ITEM_DEFS[i].name} ×${q}`).join(' + '),{done:Object.entries(r.input).some(([i,q])=>itemCount(s,i)<q)});
  if(['forest','bank'].includes(site)){
   if(itemCount(s,'knife'))add('hunt','Вистежити дрібну дичину з ножем',night?45:30,'Уважність і спритність зменшують втрату енергії та ризик травми. Дичина обмежена запасом на березі.',{done:stock(s,'bank','raw_meat')===0});
   const trap=s.resourceWorld?.traps?.[site];
   if(!trap&&itemCount(s,'trap'))add('set-trap','Поставити пастку',10,'Пастка −1. Перевірити після 90 хвилин; у порожньому місці здобичі не буде.');
   if(trap)add('check-trap','Перевірити пастку',5,trap.readyAt>s.clock.totalMinutes?`Ще ${trap.readyAt-s.clock.totalMinutes} хв до перевірки.`:'Забрати пастку та перевірити здобич.',{done:trap.readyAt>s.clock.totalMinutes});
  }
 }
 if(bird&&['yard','forest','road'].includes(site))add('bird-survey','Перевірити напрямок згори',8,'Витрачає енергію. Записує розвідку; повторний огляд не дає XP.');
 for(const [i,loot] of (s.pendingLoot||[]).entries())if(loot.actor===activeActor(s)&&loot.location===site)add('recover:'+i,'Забрати: '+(ITEM_DEFS[loot.id]?.name||loot.id),0,'Потрібне місце та вільна вага в сумці.');
 return out;
}
export function performExpeditionAction(state,id){
 const a=expeditionActions(state).find(x=>x.id===id);if(!a||a.done)return refusal(state,'Немає припасу або умови для цієї дії.');
 let s=clone(normalizeState(state));initialize(s);const site=currentLocation(s),[kind,item]=id.split(':'),effects=[];let detail=a.detail;
 const gain=(id,qty=1)=>effects.push({type:'itemAdd',id,qty});
 const spend=(id,qty=1)=>effects.push({type:'itemRemove',id,qty});
 if(kind==='gather'){
  if(stock(s,site,item)<1)return refusal(state,'Місце вже обшукали.');gain(item);
  if(site==='bog'){effects.push({type:'wetness',value:15});if(effectiveStat(s,'agility')<3)effects.push({type:'damage',amount:4,ignoreArmor:true})}
 }
 if(kind==='craft'){
  const r=RECIPES[item],probe=clone(s);for(const [i,q] of Object.entries(r.input)){if(!removeItem(probe,i,q))return refusal(state,'Бракує матеріалу.');spend(i,q)}
  if(!addItem(probe,r.output,1))return refusal(state,'Для готової речі бракує місця або вільної ваги. Матеріали не витрачено.');gain(r.output);
 }
 if(id==='drink')effects.push({type:'need',key:'water',value:35});
 if(id==='rest')effects.push({type:'wetness',value:-25});
 if(id==='hunt'){
  const prepared=effectiveStat(s,'attention')>=3&&effectiveStat(s,'agility')>=3;
  effects.push({type:'need',key:'energy',value:prepared?-4:-12});if(!prepared)effects.push({type:'damage',amount:6,ignoreArmor:true});gain('raw_meat');detail=prepared?'Здобули дичину без травми.':'Здобули дичину, але забилися: −6% здоров’я, більше втоми.';
 }
 if(id==='set-trap')spend('trap');
 if(id==='check-trap'){gain('trap');if(stock(s,'bank','raw_meat')>0)gain('raw_meat');else detail='Місце вже виснажене. Пастку забрали без здобичі.'}
 if(id==='bird-survey')effects.push({type:'need',key:'energy',value:-6});
 if(kind==='recover'){
  const loot=s.pendingLoot[Number(item)];if(!loot||!addItem(s,loot.id,loot.qty))return refusal(state,'Сумка ще надто важка або повна.');s.pendingLoot.splice(Number(item),1);return{state:s,events:[],accepted:true,message:'Знахідку забрано.'};
 }
 const r=executeAction(s,{id:'expedition-'+id,minutes:a.minutes,activity:id==='rest'?'rest':kind==='craft'?'light':'work',effects});
 if(!r.accepted)return r;s=r.state;initialize(s);
 // Pending rewards stay at the physical place; chapter changes do not duplicate them.
 for(const loot of s.pendingLoot||[])if(!loot.location&&loot.scene===s.scene&&loot.actor===activeActor(s))loot.location=site;
 if(kind==='gather')reduceStock(s,site,item,1);
 if(id==='hunt'||id==='check-trap'&&stock(s,'bank','raw_meat')>0)reduceStock(s,'bank','raw_meat',1);
 if(id==='set-trap')s.resourceWorld.traps[site]={readyAt:s.clock.totalMinutes+90};
 if(id==='check-trap')delete s.resourceWorld.traps[site];
 s.resourceWorld.rewards=s.resourceWorld.rewards||{};const rewardKey=activeActor(s)+':'+site+':'+id;
 if(!s.resourceWorld.rewards[rewardKey]&&!['drink','rest'].includes(id)){r.events.push(...awardExplorationXp(s,10));s.resourceWorld.rewards[rewardKey]=true}
 if(id==='bird-survey'){s.memories.world={...(s.memories.world||{}),birdSurvey:{chapter:chapterOf(s),location:site,clock:s.clock.totalMinutes}};s.flags.birdSurveyKnown=true}
 journal(s,id,a.label,detail);return{...r,state:s,message:detail};
}
