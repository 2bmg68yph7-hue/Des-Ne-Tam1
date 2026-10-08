import {clone,executeAction,effectiveStat,itemCount,addEvpXp} from './engine.js?v=096b';
import {activeActor,timePhase} from './world.js';
import {currentLocation,canExplore} from './expedition.js';
import {talent} from './bird-config.js';
import {startEncounter} from './encounters.js';

export const BIRD_QUESTS={salo:'Операція САЛО',crow:'ХТО ТУТ ГОЛОВНИЙ?',gossip:'СЛУХАЙ, ШО Я ВЗНАВ'};
export function birdActions(s){
 if(activeActor(s)!=='evpapiy'||s.chapter!==6||!canExplore(s))return[];
 const site=currentLocation(s),quests=s.companions.evpapiy.quests||{},out=[],add=(id,label,minutes,detail,enabled=true)=>out.push({id,label,minutes,detail,done:!enabled});
 if(site==='yard'&&!quests.salo){
  add('salo-steal','Операція САЛО: підкрастися до кота',talent(s,'thief')?5:10,'Крилатий злодій або спритність ≥4: сало без подряпин. Інакше є ціна.');
  add('salo-distract','Операція САЛО: відволікти кота ягодами',5,'Ягоди −1; заберете один шматок сала.',itemCount(s,'berries')>0);
  add('salo-talk','Операція САЛО: домовитися з котом',talent(s,'authority')?5:15,'Авторитет або харизма ≥3: домовленість. Інакше треба витратити більше часу на послугу.');
  add('salo-fight','Операція САЛО: відстояти шматок у сутичці',2,'Окрема сутичка з котом. Відступ можливий; сало — лише за перемоги.');
 }
 if(['forest','road'].includes(site)&&!quests.crow){
  add('crow-talk','ХТО ТУТ ГОЛОВНИЙ? Заявити права на гілку',talent(s,'authority')?3:10,'Голубиний авторитет або харизма ≥3: мирна перемога. Без цього ворона проганяє вас.');
  add('crow-fight','ХТО ТУТ ГОЛОВНИЙ? Показати дзьоб',2,'Сутичка з вороною: перемога дає Голубину велич.');
  add('crow-yield','ХТО ТУТ ГОЛОВНИЙ? Поступитися й обійти',5,'Без травми. Менше XP, зате ціле крило.');
 }
 if(site==='wake'&&!quests.gossip){
  add('gossip','СЛУХАЙ, ШО Я ВЗНАВ: підслухати за парканом',talent(s,'eye')?5:12,'Орлине око або уважність ≥4 допомагають відрізнити перевірений орієнтир від балачок. Це місцеві припаси й стежки; сюжетні таємниці не розкриває.');
 }
 if(['forest','road','well'].includes(site)&&quests.gossip&&!s.memories.evpapiy?.reportVerified)add('check-report','Перевірити почутий місцевий орієнтир',talent(s,'eye')?5:15,'Зіставити чутку з місцем. Повторної нагороди за ту саму пригоду немає.');
 if(['hut','yard'].includes(site)&&quests.gossip&&s.memories.evpapiy?.reportVerified&&!s.memories.evpapiy?.reportAttempted)add('report','Передати бабі Галі перевірені орієнтири',3,'Повідомлення залишиться у Галі. Якщо вона передасть його далі, це допоможе під час обережного огляду місця.');
 return out;
}
function reward(s,key,outcome,events,xp=25){
 const c=s.companions.evpapiy;c.quests=c.quests||{};if(c.quests[key])return;c.quests[key]={outcome,clock:s.clock.totalMinutes};events.push(...addEvpXp(s,xp));
 s.journal=s.journal||[];s.journal.push({id:'bird-'+key,text:BIRD_QUESTS[key],detail:outcome,chapter:6,clock:s.clock.totalMinutes,actor:'evpapiy'});
}
export function resolveBirdEncounter(result){
 if(!result.quest||activeActor(result.state)!=='evpapiy')return result;const s=result.state;
 if(result.outcome==='win'){
  const effects=result.quest==='salo'?[{type:'itemAdd',id:'salo',qty:1}]:[{type:'statusAdd',id:'birdGlory'}];
  const r=executeAction(s,{effects});result.state=r.state;result.events.push(...r.events);reward(result.state,result.quest,'Перемога в сутичці',result.events);
 }else if(result.outcome==='defeat'||result.outcome==='escaped'){
  const r=executeAction(s,{effects:[{type:'statusAdd',id:'birdOffended'}]});result.state=r.state;result.events.push(...r.events);
 }
 return result;
}
export function performBirdAction(state,id){
 const a=birdActions(state).find(x=>x.id===id);if(!a||a.done)return{state:clone(state),accepted:false,events:[],message:'Пригода вже виконана або бракує умови.'};
 if(id==='salo-fight'||id==='crow-fight')return startEncounter(state,id==='salo-fight'?'cat':'crow',id==='salo-fight'?'salo':'crow');
 const effects=[];let key=null,outcome=a.label,xp=25;
 if(id.startsWith('salo-')){
  key='salo';effects.push({type:'itemAdd',id:'salo',qty:1});
  if(id==='salo-steal'&&!talent(state,'thief')&&effectiveStat(state,'agility')<4){effects.push({type:'damage',amount:5,ignoreArmor:true},{type:'statusAdd',id:'birdOffended'});outcome='Сало забрав, але кіт подряпав і образив.'}
  if(id==='salo-distract')effects.unshift({type:'itemRemove',id:'berries',qty:1});
  if(id==='salo-talk'&&!talent(state,'authority')&&effectiveStat(state,'charisma')<3)outcome='Витратив більше часу на послугу коту, отримав сало.';
 }
 if(id==='crow-talk'){
  if(talent(state,'authority')||effectiveStat(state,'charisma')>=3){key='crow';effects.push({type:'statusAdd',id:'birdGlory'});outcome='Ворона поступилася. Голубина велич заслужена.'}
  else {effects.push({type:'statusAdd',id:'birdOffended'},{type:'need',key:'energy',value:-4});outcome='Ворона прогнала. Можна обійти, розвинути авторитет або спробувати сутичку.'}
 }
 if(id==='crow-yield'){key='crow';xp=10;outcome='Поступився гілкою й обійшов без травми.'}
 if(id==='gossip'){key='gossip';const checked=talent(state,'eye')>0||effectiveStat(state,'attention')>=4;outcome=checked?'Перевірив орієнтири біля села.':'Почув балачки; надійність сумнівна.';effects.push({type:'memory',person:'evpapiy',key:'reportVerified',value:checked})}
 if(id==='check-report')effects.push({type:'memory',person:'evpapiy',key:'reportVerified',value:true});
 if(id==='report')effects.push({type:'memory',person:'evpapiy',key:'reportAttempted',value:true},{type:'memory',person:'evpapiy',key:'reportDelivered',value:true},{type:'flag',key:'birdReportDelivered',value:true});
 const r=executeAction(state,{id:'bird-'+id,minutes:a.minutes,activity:'light',effects});if(!r.accepted)return r;
 if(key)reward(r.state,key,outcome,r.events,xp);return{...r,message:outcome};
}
