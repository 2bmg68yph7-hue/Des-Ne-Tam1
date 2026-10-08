import {LOCATIONS} from './locations.js';
import {asset} from './assets.js';
import {canExplore,currentLocation,awayFromStory,discoveredLocations,travelOptions} from './expedition.js';
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
export function mapMarkup(s){
 const known=discoveredLocations(s),current=currentLocation(s),options=travelOptions(s),allowed=new Set(options.map(x=>x.id)),free=canExplore(s),fog=current==='fog';
 const visible=fog?['fog']:Object.keys(LOCATIONS).filter(id=>id!=='fog');
 const nodes=visible.map(id=>{const l=LOCATIONS[id],here=id===current,seen=known.has(id),available=allowed.has(id)&&free;return `<button class="world-node ${here?'here':''} ${seen?'seen':''}" style="left:${l.x}%;top:${l.y}%" data-travel="${id}" ${available?'':'disabled'} aria-label="${esc(seen?l.label:'Невідоме місце')}">${here?'●':seen?'•':'?'}</button>`}).join('');
 return `<div class="section-title"><h2>Карта</h2><span>${esc(LOCATIONS[current]?.label||'???')}</span></div><div class="world-map"><img src="${asset('map_village.jpg')}" alt="Авторська карта села й околиць">${nodes}</div><p class="map-help">${fog?'Ви ще в тумані. Дорогу в село не знайдено.':free?'Оберіть сусідню стежку. Невідоме місце відкриється після переходу.':'Зараз триває сюжетна подія. Пересування відкривається між подіями.'}</p><div class="route-list">${options.map(t=>`<article class="info-card"><b>${esc(t.label)}</b><p>${t.minutes} хв · ${t.risk>1?'вищий ризик':t.risk?'потрібна обережність':'спокійний шлях'} · витрата енергії й води</p><button data-travel="${t.id}" ${t.available?'':'disabled'}>Перейти</button></article>`).join('')}</div>${awayFromStory(s)?'<button data-return-story>Повернутися до сюжетного місця</button>':''}`;
}
