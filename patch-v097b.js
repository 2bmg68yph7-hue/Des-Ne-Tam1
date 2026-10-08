// v0.9.7b TEST – repair Chapter 4 saves/menu after module-version mismatch.
import {normalizeState} from './engine.js?v=096b';
import {loadRun,saveRun,loadChapterCheckpoint} from './storage.js?v=096b';

function isCh4State(s){
  const scene=String(s?.story?.sceneId||s?.scene||'');
  return scene.startsWith('ch4_')||Number(s?.story?.chapter||s?.chapter||0)>=4;
}

async function chapter4Available097b(){
  for(const run of [1,2,3]){
    const raw=await loadRun(run);
    if(raw&&isCh4State(raw))return true;
    if(await loadChapterCheckpoint(run,4))return true;
  }
  return false;
}

async function decorateChapters097b(){
  const grid=document.querySelector('#runPicker .chapter-grid');
  if(!grid||grid.querySelector('[data-ch4-card097b]'))return;
  const available=await chapter4Available097b();
  const card=document.createElement('article');
  card.className='chapter-card';
  card.dataset.ch4Card097b='1';
  card.innerHTML=`<div><b>Глава 4</b><span>${available?'Можна продовжити з вашого сейву.':'Відкриється, коли реально дійдете до неї.'}</span></div><div class="chapter-card-actions"><button type="button" data-ch4-continue097b ${available?'':'disabled'}>Продовжити</button></div>`;
  grid.appendChild(card);
  card.querySelector('[data-ch4-continue097b]')?.addEventListener('click',()=>document.querySelector('#continueBtn')?.click());
}

function install097b(){
  // Save migration and chapter cards are owned by storage.js and main.js.
  document.querySelectorAll('.version,.howto-version,.game-name span').forEach(el=>el.textContent='v0.9.7b TEST');
}

queueMicrotask(install097b);
