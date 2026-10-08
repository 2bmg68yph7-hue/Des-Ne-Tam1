// v0.9.9 TEST – stabilization wrapper.
// Keeps the v0.9.7 engine, fixes test completeness and knowledge/relationship migration.
export * from './engine-v096.js?v=099';
import * as prev from './engine-v096.js?v=099';
import {ITEM_DEFS,STATUS_DEFS} from './data.js?v=096b';

const DEAD_STATUSES=new Set(['headInjury','hungry','thirsty','wet','cold','overheated','bump']);

function testConfig(){
  try{return JSON.parse(localStorage.getItem('dnt-test-v096')||'{}')||{}}catch{return{}}
}
function ensureArray(obj,key){if(!Array.isArray(obj[key]))obj[key]=[];return obj[key]}
function ensureTestItem(s,id,qty){
  if(!ITEM_DEFS[id])return;
  s.inventory=Array.isArray(s.inventory)?s.inventory:[];
  const cur=s.inventory.find(x=>x?.id===id);
  if(cur)cur.qty=Math.max(Number(cur.qty||0),qty);
  else s.inventory.push({id,qty});
}
function ensureDiscovered(s,id){const a=ensureArray(s,'discoveredStatuses');if(!a.includes(id))a.push(id)}
function activateTestStatus(s,id){
  const def=STATUS_DEFS[id];
  if(!def||DEAD_STATUSES.has(id))return;
  const active=ensureArray(s,'activeStatuses');
  if(!active.includes(id))active.push(id);
  ensureDiscovered(s,id);
  s.statusTimers=s.statusTimers||{};
  const duration=Number(def.durationMinutes||0);
  if(duration>0)s.statusTimers[id]=Number(s.clock?.totalMinutes||0)+duration;
  if(id==='tired'&&s.needs)s.needs.energy=Math.min(Number(s.needs.energy||100),30);
  if(id==='yebatorium'){s.unlocks=s.unlocks||{};s.unlocks.yebatorium=true}
}
function currentStatusIds(){return Object.keys(STATUS_DEFS).filter(id=>!DEAD_STATUSES.has(id))}
function syncTestState(s){
  if(!s?.flags?.testMode||s.flags.testSetupApplied098)return s;
  s.flags.testSetupApplied098=true;
  const cfg=testConfig();
  const selected=Array.isArray(cfg.statuses)?cfg.statuses:[];
  for(const id of selected)activateTestStatus(s,id);
  if(cfg.all097){
    for(const id of currentStatusIds())ensureDiscovered(s,id);
    for(const [id,def] of Object.entries(ITEM_DEFS)){
      const stack=Math.max(1,Number(def?.stack||1));
      ensureTestItem(s,id,Math.min(stack,3));
    }
    s.unlocks=s.unlocks||{};s.flags=s.flags||{};
    s.unlocks.yebatorium=true;
    s.unlocks.sunsetContempt=true;
    s.unlocks.prayer=true;
    s.flags.prayerUnlocked=true;
  }
  return s;
}
function cleanLegacyStatuses(s){
  if(!s)return s;
  s.activeStatuses=(s.activeStatuses||[]).filter(id=>!DEAD_STATUSES.has(id));
  s.discoveredStatuses=(s.discoveredStatuses||[]).filter(id=>!DEAD_STATUSES.has(id));
  s.statusTimers={...(s.statusTimers||{})};
  for(const id of DEAD_STATUSES)delete s.statusTimers[id];
  return s;
}
function ensureRelationship(s,id,name,values={}){
  s.relationships=s.relationships||{};
  const old=s.relationships[id]||{};
  s.relationships[id]={
    name,
    known:Boolean(old.known),
    values:{...values,...(old.values||{})},
    discoveredParams:Array.isArray(old.discoveredParams)?old.discoveredParams:[]
  };
  return s.relationships[id];
}
function syncRelationships(s){
  if(!s)return s;
  s.flags=s.flags||{};
  const entered=new Set(s.story?.entered||[]);
  const evp=ensureRelationship(s,'evpapiy',s.flags?.knowsPigeonName?'Євпапій':'???',{trust:2,offense:4,greed:8,bullshit:6});
  const gal=ensureRelationship(s,'galina','Баба Галя',{trust:5,offense:0});
  const hood=ensureRelationship(s,'hood',s.flags.darinaRevealed100?'Дарина':'Постать',{trust:0,offense:0});
  const cat=ensureRelationship(s,'cat','Риже гамно',{trust:0,offense:0});
  const creatureNamed=Boolean(s.flags?.truposmerdNamed096);
  const creature=ensureRelationship(s,'creature',creatureNamed?'ТРУПОСМЕРД':'???',{attitude:0});
  const semenNamed=Boolean(s.flags?.semenIntroduced099||s.flags?.semenIntroduced098||s.flags?.semenIntroduced);
  const semen=ensureRelationship(s,'semen',semenNamed?'Семен':'???',{trust:0,offense:0});

  if(s.flags?.metPigeon||entered.has('poop'))evp.known=true;
  if(gal.known||[...entered].some(x=>/^galina/i.test(String(x))))gal.known=true;
  if(entered.has('ch2_figure')||[...entered].some(x=>/^ch3_(intro|obey|turn|tell_off)/.test(String(x))))hood.known=true;
  if(s.flags?.catMet||s.flags?.catFirstMeeting||[...entered].some(x=>String(x).startsWith('ch3_cat_')))cat.known=true;
  if(entered.has('ch3_creature')||[...entered].some(x=>/^ch3_(vodka|garlic|run|ask_pigeon|pray)/.test(String(x))))creature.known=true;
  if(s.flags?.semenEncountered099||entered.has('ch4_intro')||[...entered].some(x=>String(x).startsWith('ch4_')))semen.known=true;
  return s;
}
function post(s){return syncRelationships(syncTestState(cleanLegacyStatuses(s)))}

export function normalizeState(raw){return post(prev.normalizeState(raw))}
export function executeAction(state,action){
  const r=prev.executeAction(state,action);
  return{...r,state:post(r.state)};
}
export function useItem(state,id){
  const r=prev.useItem(state,id);
  return r?.state?{...r,state:post(r.state)}:r;
}
