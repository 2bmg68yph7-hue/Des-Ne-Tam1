import {asset} from './assets.js';
import {activeActor} from './world.js';

export const VIEW_LABELS={overview:'Меню',hero:'Герой',inventory:'Рюкзак',clothes:'Шмотки',stats:'Характеристики',states:'Стани',needs:'Потреби',sleep:'Відпочинок',characters:'Персонажі',companions:'Євпапій',relations:'Стосунки',place:'Місце',map:'Карта',journal:'Журнал',settings:'Налаштування'};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
export const navigationButton=(tab,label=VIEW_LABELS[tab])=>`<button type="button" data-navigate="${tab}">${esc(label)}</button>`;
const PREFS_KEY='des-ne-tam-reading-v1';
export function readingPreferences(){try{return {...{font:17,art:1,reducedMotion:false},...JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')}}catch{return{font:17,art:1,reducedMotion:false}}}
export function applyReadingPreferences(p=readingPreferences()){
 const safe={font:[16,17,19].includes(Number(p.font))?Number(p.font):17,art:[.85,1,1.15].includes(Number(p.art))?Number(p.art):1,reducedMotion:Boolean(p.reducedMotion)};
 document.body.style.setProperty('--story-font',safe.font+'px');document.body.style.setProperty('--art-scale',safe.art);document.body.classList.toggle('reduce-motion',safe.reducedMotion);return safe;
}
export function saveReadingPreferences(p){const safe=applyReadingPreferences(p);try{localStorage.setItem(PREFS_KEY,JSON.stringify(safe))}catch{}return safe}
export function installInterface({openMenu,closeMenu}){
 applyReadingPreferences();
 document.querySelector('#gameNavigation').addEventListener('click',e=>{const b=e.target.closest('[data-navigate]');if(!b)return;b.dataset.navigate==='story'?closeMenu():openMenu(b.dataset.navigate)});
 document.querySelector('#menuOverviewBtn').onclick=()=>openMenu('overview');
 document.querySelector('#menuContent').addEventListener('click',e=>{const b=e.target.closest('[data-navigate]');if(b)openMenu(b.dataset.navigate);if(e.target.closest('[data-exit-game]'))document.querySelector('#exitBtn').click()});
 // Keep legacy IDs for saved UI and tests; one capture owner prevents old tab handlers.
 document.querySelector('#menuTabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();openMenu(b.dataset.tab)},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('#menuOverlay').classList.contains('hidden'))closeMenu()});
}
export function updateMenuTitle(tab){document.querySelector('.menu-title').textContent=VIEW_LABELS[tab]||'Меню';document.querySelector('#menuOverviewBtn').hidden=tab==='overview'}
export function overviewMarkup(state){
 const groups=[['Герой',[['hero',activeActor(state)==='evpapiy'?'Євпапій':'Степан'],['stats','Характеристики й розвиток'],['states','Стани'],['needs','Потреби'],['sleep','Відпочинок']]],['Речі',[['inventory','Рюкзак'],['clothes','Одяг і захист']]],['Світ',[['map','Карта'],['place','Дослідити місце'],['journal','Журнал'],['shop','Крамничка']]],['Знайомі',[['characters','Персонажі'],['relations','Стосунки'],['companions','Євпапій']]],['Налаштування',[['settings','Звук, читання й сейви']]]];
 return groups.map(([label,tabs])=>`<section class="menu-group"><h2>${label}</h2><div class="menu-grid">${tabs.map(([t,l])=>navigationButton(t,l)).join('')}</div></section>`).join('')+'<button data-exit-game>Зберегти й вийти</button>';
}
export function heroMarkup(s,portrait){
 const bird=activeActor(s)==='evpapiy',p=bird?s.companions.evpapiy.progression:s.heroProgression;
 return `<div class="hero-profile"><img src="${asset(portrait)}" alt="${bird?'Євпапій':'Степан'}"><div><span class="eyebrow">ЗАРАЗ ВИ КЕРУЄТЕ</span><h2>${bird?'Євпапій':'Степан'}</h2><p>Рівень ${p.level} · ${p.xp}/100 XP</p><p>${bird?'Шукає Степана. Сало підозріло добре мотивує.':'Плану поки небагато. Зате пригод уже вистачає.'}</p></div></div><div class="hero-summary"><span>Здоров’я ${Math.round(s.health)}%</span><span>Енергія ${Math.round(s.needs.energy)}%</span><span>Вода ${Math.round(s.needs.water)}%</span><span>Ситість ${Math.round(s.needs.satiety)}%</span></div><div class="menu-grid">${[['stats',bird?'Розвиток і здібності':'Характеристики й розвиток'],['states','Стани'],['inventory','Припаси'],['clothes','Спорядження'],['needs','Потреби'],['relations','Стосунки']].map(([t,l])=>navigationButton(t,l)).join('')}</div>`;
}
export function knownCharacters(s){
 const entered=new Set(s.story?.entered||[]),out=[],seen=re=>[...entered].some(id=>re.test(id));
 if(s.flags.ch4StepanMissing)out.push({id:'stepan',name:'Степан',portrait:'./ch4_stepan_missing.png',facts:['Місцезнаходження: ???','Стан: ???']});
 if(s.flags.metPigeon||entered.has('poop'))out.push({id:'evpapiy',name:s.flags.knowsPigeonName?'Євпапій':'???',portrait:'./pigeon_base_095b.webp',facts:[s.flags.knowsPigeonName?'Жирний голуб. Говорить. На жаль.':'Ім’я: ???']});
 if(s.relationships.galina?.known||seen(/^galina/))out.push({id:'galina',name:'Баба Галя',portrait:'./galina_base.png',facts:[s.flags.localClothes?'Дала вам місцеві шмотки.':'???',s.flags.galinaFedAfterShed?'Нагодувала після сараю.':'???']});
 const hood=s.relationships.hood?.known||entered.has('ch2_figure')||seen(/^ch3_(intro|obey|turn|tell_off)/),revealed=s.flags.darinaRevealed100;
 if(hood)out.push({id:'hood',name:revealed?'Дарина':'Постать',portrait:revealed?'./darina_reveal_100.png':'./ch2_unknown_v2.png',facts:revealed?['Степан упізнав її під час зняття каптура.','Вона впізнала його ще біля сараю.']:['Обличчя: ???','Хто це: ???']});
 if(s.flags.catMet||s.flags.catFirstMeeting||seen(/^ch3_cat_/))out.push({id:'cat',name:'Риже гамно',portrait:'./cat_base_095m.png',facts:['Живе в баби Галі.',s.flags.catFirstMeeting==='insult'?'Ви вже встигли посратись.':'???']});
 if(entered.has('ch3_creature')||seen(/^ch3_(vodka|garlic|run|ask_pigeon|pray)/))out.push({id:'creature',name:s.flags.truposmerdNamed096?'ТРУПОСМЕРД':'???',portrait:'./creature_normal_095f.webp',facts:[s.flags.creatureGarlicUsed?'Часник йому не подобається.':'???',s.flags.creatureVodkaFriend?'Горілку любить.':'???']});
 if(s.flags.semenEncountered099||seen(/^ch4_/))out.push({id:'semen',name:s.flags.semenIntroduced099?'Семен':'???',portrait:'./ch4_semen_base.png',facts:[s.flags.semenIntroduced099?'Біля сараю виглядав зовсім інакше.':'Ім’я: ???']});
 if(!revealed&&(s.flags.darinaAppeared099d||entered.has('ch6_darina099d')))out.push({id:'darina',name:'Дарина',portrait:'./darina_base_100.png',facts:['Прийшла до хати баби Галі.','Хто вона: ???']});
 return out;
}
export function charactersMarkup(s){return `<div class="section-title"><h2>Персонажі</h2></div>${knownCharacters(s).map(c=>`<details class="character-profile"><summary><img src="${asset(c.portrait)}" alt=""><b>${esc(c.name)}</b><span>⌄</span></summary><div>${c.facts.map(f=>`<p>${esc(f)}</p>`).join('')}</div></details>`).join('')||'<div class="empty-state">Знайомства ще попереду.</div>'}`}
export function relationshipHint(id,s){const v=s.relationships[id]?.values||{};if(id==='evpapiy')return Number(v.offense)>=6?'Сердиться. Підтримку доведеться заслужити.':Number(v.trust)>=4?'Після вашої допомоги охочіше підтримує. Сало все ще аргумент.':'Може допомогти. А може спочатку захотіти сала.';if(id==='galina')return Number(v.trust)>=6&&Number(v.offense)<4?'Пам’ятає вашу допомогу й охочіше ділиться припасами.':'Допомогу можна отримати за роботу або домовленість.';if(id==='hood')return s.flags.darinaRevealed100?'Попередні вчинки впливають на те, як вона допомагає.':'Ви ще мало про неї знаєте.';if(id==='cat')return s.flags.catFirstMeeting==='insult'?'Вашу першу розмову він запам’ятав.':'Поки терпить вашу присутність.';return'Дивіться на реакції й пам’ятайте попередні розмови.'}
export function relationsMarkup(s){return `<div class="section-title"><h2>Стосунки</h2></div>${knownCharacters(s).filter(c=>s.relationships[c.id]?.known).map(c=>`<article class="relation-card"><b>${esc(c.name)}</b><p>${esc(relationshipHint(c.id,s))}</p></article>`).join('')||'<div class="empty-state">Ще немає відкритих стосунків.</div>'}`}
