// v0.9.7 engine wrapper – chapter 4 + status/save fixes.
export * from './engine.js?core=096b';
import * as core from './engine.js?core=096b';
import {chapterOf} from './chapters.js';
import {STAT_KEYS} from './config.js?v=096b';
import {STATUS_DEFS,CLOTHES,ITEM_DEFS} from './data.js?v=096b';

const ALLOWED_STATUSES=new Set([
  'hangover','pigeonHumiliated','suspicious','scared','angry',
  'yebatorium','tipsy','skunk','tired','blessed','cowLicked','hungry','thirsty','wet','cold','overheated','bump'
]);
const EARLY_CH3=new Set([
  'ch3_intro','ch3_obey','ch3_turn','ch3_call_pigeon','ch3_tell_off','ch3_creature',
  'ch3_vodka','ch3_garlic','ch3_garlic_hit','ch3_ask_pigeon','ch3_run','ch3_pray'
]);

const clone=x=>JSON.parse(JSON.stringify(x));
function dayOf(totalMinutes){return Math.floor(Math.max(0,Number(totalMinutes||0))/1440)+1}
function ensureDiscovered(s,id){s.discoveredStatuses=Array.isArray(s.discoveredStatuses)?s.discoveredStatuses:[];if(!s.discoveredStatuses.includes(id))s.discoveredStatuses.push(id)}
function cleanStatuses(s){
  const valid=id=>ALLOWED_STATUSES.has(id)||Boolean(STATUS_DEFS[id])&&id!=='headInjury';
  s.activeStatuses=(s.activeStatuses||[]).filter(valid);
  s.discoveredStatuses=(s.discoveredStatuses||[]).filter(valid);
  s.statusTimers={...(s.statusTimers||{})};
  for(const id of Object.keys(s.statusTimers))if(!valid(id))delete s.statusTimers[id];
  return s;
}
function setActive(s,id,on,events=[]){
  const had=s.activeStatuses.includes(id);
  if(on&&!had){s.activeStatuses.push(id);ensureDiscovered(s,id);events.push({type:'statusAdded',id,visible:false})}
  else if(!on&&had){s.activeStatuses=s.activeStatuses.filter(x=>x!==id);delete s.statusTimers[id];events.push({type:'statusRemoved',id,visible:false})}
  return events;
}
function forceChapter(s,raw){s.chapter=chapterOf(s);s.story={...(s.story||{}),chapter:s.chapter};return s;}
 function ensureRelationship(s,id,name,values={}){
  s.relationships=s.relationships||{};
  const old=s.relationships[id]||{};
  s.relationships[id]={...old,name,known:Boolean(old.known),values:{...values,...(old.values||{})},discoveredParams:Array.isArray(old.discoveredParams)?old.discoveredParams:[]};
}
function syncKnownPeople(s){
  const entered=new Set(s.story?.entered||[]);
  ensureRelationship(s,'evpapiy','Євпапій',{trust:2,offense:4,greed:8,bullshit:6});
  ensureRelationship(s,'galina','Баба Галя',{trust:5,offense:0});
  ensureRelationship(s,'creature','ТРУПОСМЕРД',{attitude:0});
  ensureRelationship(s,'hood','Постать',{trust:0,offense:0});
  ensureRelationship(s,'cat','Риже гамно',{trust:0,offense:0});
  ensureRelationship(s,'semen','Семен',{trust:0,offense:0});
  if(s.flags?.metPigeon||entered.has('poop'))s.relationships.evpapiy.known=true;
  if(s.relationships.galina.known||[...entered].some(x=>/^galina|galina/i.test(String(x))))s.relationships.galina.known=true;
  if(entered.has('ch2_figure')||[...entered].some(x=>/^ch3_(intro|obey|turn|tell_off)/.test(String(x))))s.relationships.hood.known=true;
  if(s.flags?.catMet||s.flags?.catFirstMeeting||[...entered].some(x=>String(x).startsWith('ch3_cat_')))s.relationships.cat.known=true;
  if(entered.has('ch3_creature')||[...entered].some(x=>/^ch3_(vodka|garlic|run|ask_pigeon|pray)/.test(String(x))))s.relationships.creature.known=true;
  if(entered.has('ch4_intro')||[...entered].some(x=>String(x).startsWith('ch4_')))s.relationships.semen.known=true;
}
function scaledStatusMods(state){
  const out=Object.fromEntries(STAT_KEYS.map(k=>[k,0]));
  const level=Math.max(1,Number(state?.heroProgression?.level||1));
  const bonus=Math.floor((level-1)/3);
  for(const id of state?.activeStatuses||[]){
    const d=STATUS_DEFS[id];
    for(const [k,raw] of Object.entries(d?.mods||{})){
      if(!(k in out))continue;const v=Number(raw||0);out[k]+=v>0?v+bonus:v;
    }
  }
  const shield=(state?.activeStatuses||[]).reduce((n,id)=>Math.max(n,Number(STATUS_DEFS[id]?.negativeModShield||0)),0);
  if(shield>0)for(const k of STAT_KEYS)if(out[k]<0)out[k]=Math.min(0,out[k]+shield);
  return out;
}
export function statModifiers(state){
  const out=scaledStatusMods(state);
  for(const id of Object.values(state?.equipment||{})){
    const d=CLOTHES[id];for(const [k,v] of Object.entries(d?.statMods||{}))if(k in out)out[k]+=Number(v||0);
  }
  return out;
}
export function effectiveStat(state,key){return Math.max(0,core.permanentStat(state,key)+Number(statModifiers(state)[key]||0))}

function recordVodka(before,s,action){
  const all=[...(action?.effects||[]),...(action?.hiddenEffects||[])];
  const drank=String(action?.id||'')==='use_vodka'||all.some(e=>e?.type==='statusAdd'&&e.id==='tipsy');
  if(!drank)return false;
  s.flags=s.flags||{};s.flags.vodkaDrinkSerial096=Number(before?.flags?.vodkaDrinkSerial096||0)+1;s.flags.lastVodkaDrinkDay096=dayOf(before?.clock?.totalMinutes);return true;
}
function maybeHangover(s,events){
  s.flags=s.flags||{};
  const serial=Number(s.flags.vodkaDrinkSerial096||0),done=Number(s.flags.hangoverProcessedVodkaSerial096||0),drinkDay=Number(s.flags.lastVodkaDrinkDay096||0);
  if(serial<=done||!drinkDay||dayOf(s.clock?.totalMinutes)<=drinkDay)return events;
  if(!s.activeStatuses.includes('hangover')){s.activeStatuses.push('hangover');ensureDiscovered(s,'hangover');events.push({type:'statusAdded',id:'hangover',visible:false})}
  s.flags.hangoverProcessedVodkaSerial096=serial;return events;
}
function reconcileTired(s,beforeHad,events){
  events=events.filter(e=>!(e?.type==='statusAdded'||e?.type==='statusRemoved')||e.id!=='tired');
  const energy=Number(s.needs?.energy||0);
  if(energy<35)setActive(s,'tired',true,events);else if(energy>55)setActive(s,'tired',false,events);else setActive(s,'tired',Boolean(beforeHad),events);
  return events;
}
function ensureItem(s,id,qty){
  if(!ITEM_DEFS[id])return;const cur=(s.inventory||[]).find(x=>x.id===id);if(cur)cur.qty=Math.max(Number(cur.qty||0),qty);else s.inventory.push({id,qty});
}
function applyTestSetup(s){
  if(!s.flags?.testMode||s.flags.testSetupApplied096)return;
  s.flags.testSetupApplied096=true;
  let cfg={};try{cfg=JSON.parse(localStorage.getItem('dnt-test-v096')||'{}')}catch{}
  const ids=Array.isArray(cfg.statuses)?cfg.statuses:[];
  for(const id of ids){
    if(!ALLOWED_STATUSES.has(id))continue;
    if(id==='tired')s.needs.energy=Math.min(Number(s.needs.energy||100),30);
    if(!s.activeStatuses.includes(id))s.activeStatuses.push(id);ensureDiscovered(s,id);
    const dur=Number(STATUS_DEFS[id]?.durationMinutes||0);if(dur>0)s.statusTimers[id]=Number(s.clock?.totalMinutes||0)+dur;
    if(id==='yebatorium')s.unlocks.yebatorium=true;
  }
  if(cfg.sunset){s.flags.evpapiySaloGivenCount=Math.max(2,Number(s.flags.evpapiySaloGivenCount||0));s.flags.evpapiyEnemyConflict096=true}
  if(cfg.all097){
    for(const id of ALLOWED_STATUSES)ensureDiscovered(s,id);
    for(const [id,qty] of [['holy_water',3],['potion_unknown',1],['old_key',1],['water',3],['salo',3],['vodka',2],['garlic',3],['onion',2],['onion_angry',1],['onion_smelly',1],['medkit',2]])ensureItem(s,id,qty);
    s.unlocks.yebatorium=true;s.unlocks.sunsetContempt=true;s.unlocks.prayer=true;s.flags.prayerUnlocked=true;
  }
}
function syncItemKnowledge(s){
  const unknown=['garlic','onion','onion_angry','onion_smelly','potion_unknown'];
  for(const id of unknown){if(ITEM_DEFS[id]){ITEM_DEFS[id].category='Якась хуйня';ITEM_DEFS[id].description='???'}}
  if(ITEM_DEFS.onion)ITEM_DEFS.onion.name='Дивна цибуля';
  const known={
    garlic:{category:'Зброя',description:'ТРУПОСМЕРДу дуже не подобається.'},
    onion:{category:'Зброя',name:'Дивна цибуля',description:'Після кидка ворог погано бачить 1 хід.'},
    onion_angry:{category:'Зброя',description:'Вгризається й продовжує кусати.'},
    onion_smelly:{category:'Зброя',description:'Від неї можна й вирубитись.'}
  };
  for(const [id,meta] of Object.entries(known))if(s.flags?.[`itemKnown095s_${id}`]&&ITEM_DEFS[id])Object.assign(ITEM_DEFS[id],meta);
}
function snapshotStepan(before,s,action){
  const effects=[...(action?.effects||[]),...(action?.hiddenEffects||[])];
  const missing=effects.some(e=>e?.type==='flag'&&e.key==='ch4StepanMissing'&&e.value===true);
  if(!missing||s.flags?.stepanSnapshot097)return;
  s.flags=s.flags||{};
  s.flags.stepanSnapshot097=clone({
    health:before.health,needs:before.needs,inventory:before.inventory,importantItems:before.importantItems,
    quickSlots:before.quickSlots,ownedClothes:before.ownedClothes,equipment:before.equipment,stats:before.stats,
    heroProgression:before.heroProgression,activeStatuses:before.activeStatuses,statusTimers:before.statusTimers,money:before.money
  });
}

export function normalizeState(raw){
  const rawHadScared=Boolean(raw?.activeStatuses?.includes?.('scared'));
  const rawScaredMigration=Boolean(raw?.flags?.scaredMigration091);
  let s=core.normalizeState(raw);forceChapter(s,raw);
  const scene=String(s?.story?.sceneId||s?.scene||'');
  if(EARLY_CH3.has(scene)&&!rawHadScared&&!rawScaredMigration&&s.activeStatuses?.includes('scared')){
    s.activeStatuses=s.activeStatuses.filter(x=>x!=='scared');delete s.statusTimers?.scared;s.flags.scaredMigration091=true;
  }
  s=cleanStatuses(s);s.flags=s.flags||{};
  if(s.activeStatuses.includes('suspicious')&&!Number.isFinite(Number(s.statusTimers?.suspicious)))s.statusTimers.suspicious=Number(s.clock?.totalMinutes||0)+30;
  const energy=Number(s.needs?.energy||0);
  if(energy<35){if(!s.activeStatuses.includes('tired'))s.activeStatuses.push('tired');ensureDiscovered(s,'tired')}
  else if(energy>55){s.activeStatuses=s.activeStatuses.filter(x=>x!=='tired');delete s.statusTimers.tired}
  for(const id of ['ryzheHamno','truposmerd','galina','hood','cat'])if(s.companions?.[id])delete s.companions[id];
  applyTestSetup(s);
  const salo=Number(s.flags.evpapiySaloGivenCount||0);s.unlocks.sunsetContempt=Boolean(salo>=2&&s.flags.evpapiyEnemyConflict096);
  syncItemKnowledge(s);syncKnownPeople(s);forceChapter(s,raw);
  return cleanStatuses(s);
}

export function executeAction(state,action){
  const expired=(state.activeStatuses||[]).filter(id=>Number.isFinite(Number(state.statusTimers?.[id]))&&Number(state.statusTimers[id])<=Number(state.clock.totalMinutes));
  const before=normalizeState(state),beforeActive=new Set(before.activeStatuses||[]),oldTimers={...(before.statusTimers||{})};
  const r=core.executeAction(before,action);if(r.accepted===false)return r;let s=cleanStatuses(forceChapter(r.state,before));let events=(r.events||[]).filter(e=>{
    if(e?.type!=='statusAdded'&&e?.type!=='statusRemoved')return true;return ALLOWED_STATUSES.has(e.id)||Boolean(STATUS_DEFS[e.id])&&e.id!=='headInjury';
  });
  for(const id of beforeActive){
    if(!s.activeStatuses.includes(id)||!Number.isFinite(Number(oldTimers[id])))continue;
    if(Number(STATUS_DEFS[id]?.durationMinutes)>0)s.statusTimers[id]=Number(oldTimers[id]);
  }
  let zeroHits=0;
  for(const k of ['water','satiety','energy'])if(Number(before.needs?.[k]||0)>0&&Number(s.needs?.[k]||0)<=0)zeroHits+=1;
  if(zeroHits&&s.health>0){const b=s.health;s.health=Math.max(0,s.health-zeroHits);const actual=s.health-b;if(actual)events.push({type:'health',actual,visible:true,reason:'exhaustion'})}
  const drank=recordVodka(before,s,action);
  const all=[...(action?.effects||[]),...(action?.hiddenEffects||[])];
  const added=id=>all.some(e=>e?.type==='statusAdd'&&e.id===id);
  if(drank||added('tipsy')){if(!s.activeStatuses.includes('tipsy'))s.activeStatuses.push('tipsy');ensureDiscovered(s,'tipsy');s.statusTimers.tipsy=Number(s.clock?.totalMinutes||0)+90}
  if(added('blessed')){if(!s.activeStatuses.includes('blessed'))s.activeStatuses.push('blessed');ensureDiscovered(s,'blessed');s.statusTimers.blessed=Number(s.clock?.totalMinutes||0)+60}
  if(added('cowLicked')){if(!s.activeStatuses.includes('cowLicked'))s.activeStatuses.push('cowLicked');ensureDiscovered(s,'cowLicked');s.statusTimers.cowLicked=Number(s.clock?.totalMinutes||0)+60}
  snapshotStepan(before,s,action);
  events=reconcileTired(s,beforeActive.has('tired'),events);events=maybeHangover(s,events);syncItemKnowledge(s);syncKnownPeople(s);forceChapter(s,before);
  for(const id of expired)if(!events.some(e=>e.type==='statusRemoved'&&e.id===id))events.push({type:'statusRemoved',id,visible:false});
  return{state:cleanStatuses(s),events,accepted:true};
}
export function previewAction(state,action){
  const r=executeAction(state,action);if(r.accepted===false)return['Бракує ресурсу'];
  const labels={energy:'Бадьорість',water:'Вода',satiety:'Ситість',health:'Здоровʼя'},parts=[];
  if(action.minutes>0)parts.push(action.minutes+' хв');
  for(const [key,label] of Object.entries(labels)){const before=key==='health'?state.health:state.needs[key],after=key==='health'?r.state.health:r.state.needs[key],delta=Math.round(after)-Math.round(before);if(delta)parts.push(`${label} ${delta>0?'+':''}${delta}%`)}
  return parts;
}
export function useItem(state,id){
  const d=ITEM_DEFS[id];if(state.health<=0||!d||core.itemCount(state,id)<=0||!d.useEffects?.length)return{state,used:false,events:[]};
  return{...executeAction(state,{id:`use_${id}`,effects:d.useEffects,hiddenEffects:[{type:'itemRemove',id,qty:1}]}),used:true};
}

const HIGH_STORY_DANGER=new Set([
  'ch2_bang','ch2_bang3','ch2_after_bang','ch2_side','ch2_garlic','ch2_salo','ch2_pigeon_scared','ch2_figure','ch2_end',
  'ch3_intro','ch3_obey','ch3_turn','ch3_call_pigeon','ch3_tell_off','ch3_creature','ch3_vodka','ch3_garlic','ch3_garlic_hit','ch3_ask_pigeon','ch3_run','ch3_pray',
  'ch3_pray095_2','ch3_pray095_3','ch3_pray095_4','ch3_survival_bell095w',
  'ch4_fog_watch','ch4_cat_moves','ch4_son_reveal','ch4_evp_block','ch4_voice','ch4_fog_deep','ch4_fall'
]);
export function threatInfo(state){
  const scene=String(state?.story?.sceneId||state?.scene||''),base=core.threatInfo(state);
  if(base.key==='critical')return base;
  if(HIGH_STORY_DANGER.has(scene)||scene.startsWith('ch4_fog_'))return{key:'high',label:'ВИСОКА',reason:'поруч пряма небезпека'};
  return base;
}
