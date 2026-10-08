import {SAVE_NAMESPACE} from './config.js?v=096b';
import {chapterOf} from './chapters.js';

const DB_NAME='des-ne-tam-persistence';
const STORE='saves';
const AUTO=r=>`${SAVE_NAMESPACE}:run:${r}:auto`;
const MANUAL=(r,s)=>`${SAVE_NAMESPACE}:run:${r}:manual:${s}`;
const CHAPTER=(r,c)=>`${SAVE_NAMESPACE}:run:${r}:chapter:${c}`;
function localGet(key){try{return window.localStorage.getItem(key)}catch{return null}}
function localSet(key,value){try{window.localStorage.setItem(key,value);return true}catch{return false}}
function localDel(key){try{window.localStorage.removeItem(key);return true}catch{return false}}
function openDb(){
  if(typeof indexedDB==='undefined')return Promise.resolve(null);
  return new Promise(resolve=>{try{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null)}catch{resolve(null)}});
}
async function idbGet(key){const db=await openDb();if(!db)return null;return new Promise(resolve=>{try{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>resolve(null)}catch{resolve(null)}})}
async function idbMutation(key,value,remove=false){const db=await openDb();if(!db)return false;return new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite');if(remove)tx.objectStore(STORE).delete(key);else tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=tx.onabort=()=>{db.close();resolve(false)}}catch{db.close();resolve(false)}})}
const idbSet=(key,value)=>idbMutation(key,value);
const idbDel=key=>idbMutation(key,null,true);
function timestamp(raw){try{return Number(JSON.parse(raw)?.updatedAt||0)}catch{return -1}}
function valid(raw){if(raw===null)return false;try{JSON.parse(raw);return true}catch{return false}}
export async function persistentRead(key){
 const local=localGet(key),mirror=await idbGet(key);
 let best=local;
 if(mirror!==null&&(local===null||(!valid(local)&&valid(mirror))||timestamp(mirror)>timestamp(local)))best=mirror;
 if(best!==null&&best!==local)localSet(key,best);
 return best;
}
export async function persistentWrite(key,value){
 // Keep the untouched legacy snapshot before a migration or a first new-version write.
 if(!key.includes(':backup:')){
   const old=await persistentRead(key);let legacy=false;try{legacy=Boolean(old)&&Number(JSON.parse(old)?.schemaVersion||0)<12}catch{}
   if(legacy){const backup=key+':backup:v11';if(await persistentRead(backup)===null){const a=localSet(backup,old),b=await idbSet(backup,old);if(!a&&!b)throw Error('Cannot back up legacy save')}}
 }
 const a=localSet(key,value),b=await idbSet(key,value);if(!a&&!b)throw Error('Both save stores are unavailable');return{localStorage:a,indexedDB:b};
}
export async function persistentDelete(key){localDel(key);await idbDel(key)}
export function emergencyLocalWrite(key,value){return localSet(key,value)}
export async function storageCapabilities(){const probe=`${SAVE_NAMESPACE}:probe:${Date.now()}`;try{const result=await persistentWrite(probe,'ok');const read=await persistentRead(probe);await persistentDelete(probe);return{...result,readBack:read==='ok'}}catch{return{localStorage:false,indexedDB:false,readBack:false}}}
export async function loadRun(run){try{const raw=await persistentRead(AUTO(run));return raw?JSON.parse(raw):null}catch{return null}}
export async function listRuns(){const out=[];for(let run=1;run<=3;run++)out.push({run,state:await loadRun(run)});return out}
export async function saveRun(state){state.chapter=chapterOf(state);state.story={...state.story,chapter:state.chapter};state.updatedAt=Math.max(Date.now(),Number(state.updatedAt||0)+1);state.lastAutosaveAt=state.updatedAt;const result=await persistentWrite(AUTO(state.runId),JSON.stringify(state));return{at:state.lastAutosaveAt,...result}}
export function emergencySaveRun(state){state.updatedAt=Date.now();state.lastAutosaveAt=state.updatedAt;return emergencyLocalWrite(AUTO(state.runId),JSON.stringify(state))}
export async function clearRun(run){await persistentDelete(AUTO(run));for(let i=1;i<=3;i++)await persistentDelete(MANUAL(run,i));for(let c=1;c<=20;c++)await persistentDelete(CHAPTER(run,c))}

export async function saveChapterCheckpoint(state,chapter=chapterOf(state)){if(!state||!chapter)return null;if(chapterOf(state)!==Number(chapter))throw Error('Checkpoint chapter does not match its scene');const snap=JSON.parse(JSON.stringify(state));snap.chapter=Number(chapter);snap.story={...(snap.story||{}),chapter:Number(chapter)};return persistentWrite(CHAPTER(state.runId,chapter),JSON.stringify(snap))}
export async function loadChapterCheckpoint(run,chapter){try{const raw=await persistentRead(CHAPTER(run,chapter));if(!raw)return null;const state=JSON.parse(raw);return chapterOf(state)===Number(chapter)?state:null}catch{return null}}
export async function hasChapterCheckpoint(run,chapter){return Boolean(await loadChapterCheckpoint(run,chapter))}
export async function listChapterCheckpoints(run,maxChapter=20){const out=[];for(let chapter=1;chapter<=maxChapter;chapter++){const state=await loadChapterCheckpoint(run,chapter);if(state)out.push({chapter,state})}return out}
export async function clearChapterCheckpointsAfter(run,chapter){for(let c=Number(chapter||0)+1;c<=20;c++)await persistentDelete(CHAPTER(run,c))}

export async function saveManual(state,slot){
  const snapshot=JSON.parse(JSON.stringify(state));
  snapshot.chapter=chapterOf(state);snapshot.story={...snapshot.story,chapter:snapshot.chapter};snapshot.updatedAt=Date.now();
  snapshot.__chapterCheckpoint=await loadChapterCheckpoint(state.runId,snapshot.chapter);
  return persistentWrite(MANUAL(state.runId,slot),JSON.stringify(snapshot));
}
export async function loadManual(run,slot){try{const raw=await persistentRead(MANUAL(run,slot));return raw?JSON.parse(raw):null}catch{return null}}
export async function listManual(run){const out=[];for(let slot=1;slot<=3;slot++)out.push({slot,state:await loadManual(run,slot)});return out}
export const saveKeys={AUTO,MANUAL,CHAPTER};

export async function exportBackup(){
 const saves={};
 for(const run of [1,2,3,99]){
   const keys=[AUTO(run),...[1,2,3].map(slot=>MANUAL(run,slot)),...Array.from({length:20},(_,i)=>CHAPTER(run,i+1))];
   for(const key of keys){const raw=await persistentRead(key);if(raw!==null)saves[key]=JSON.parse(raw)}
 }
 return{format:'des-ne-tam-backup',version:1,schemaVersion:12,origin:location.origin,exportedAt:new Date().toISOString(),saves};
}
export function validateBackup(bundle){
 if(bundle?.format!=='des-ne-tam-backup'||bundle.version!==1||!bundle.saves||Array.isArray(bundle.saves)||typeof bundle.saves!=='object')throw Error('Це не файл збережень «Десь не там».');
 if(Number(bundle.schemaVersion)>12)throw Error('Цей сейв потребує новішої версії гри.');
 const prefix=SAVE_NAMESPACE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=new RegExp(`^${prefix}:run:(1|2|3|99):(auto|manual:[1-3]|chapter:([1-9]|1[0-9]|20))$`);
 for(const [key,state] of Object.entries(bundle.saves)){
   if(!pattern.test(key)||!state||typeof state!=='object'||!state.story||typeof (state.story.sceneId||state.scene)!=='string'||Number(state.schemaVersion)>12)throw Error('Файл містить некоректний слот або стан.');
   if(Number(key.split(':run:')[1].split(':')[0])!==Number(state.runId))throw Error('Номер проходження не відповідає слоту.');
 }
 return true;
}
export async function importBackup(bundle){
 validateBackup(bundle);const previous=[];
 // Complete the backup pass before replacing any slot.
 for(const key of Object.keys(bundle.saves)){const raw=await persistentRead(key);previous.push([key,raw]);if(raw!==null)await persistentWrite(key+':backup:import',raw)}
 try{for(const [key,state] of Object.entries(bundle.saves)){const old=previous.find(x=>x[0]===key)?.[1];const snapshot=JSON.parse(JSON.stringify(state));snapshot.updatedAt=Math.max(Date.now(),timestamp(old)+1);await persistentWrite(key,JSON.stringify(snapshot))}}
 catch(error){for(const [key,raw] of previous){if(raw===null)await persistentDelete(key);else await persistentWrite(key,raw)}throw error}
 return{imported:Object.keys(bundle.saves).length};
}
