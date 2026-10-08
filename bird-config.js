export const BIRD_TALENTS={
 thief:{name:'Крилатий злодій',detail:'Легше підкрастися до кота або сховатися від небезпеки.'},
 beak:{name:'ЖОСТКИЙ КЛЮВ',detail:'Кожен рівень додає 3 шкоди в сутичці.'},
 poop:{name:'Обісрати з висоти',detail:'Раз за сутичку позбавляє ворога ходів. Потрібні крила й енергія.'},
 authority:{name:'Голубиний авторитет',detail:'Дає спосіб домовитися з котом і відстояти місце перед вороною.'},
 eye:{name:'Орлине око (майже)',detail:'Краще перевіряє чутки, скорочує розвідку й допомагає сховатися.'}
};
export function talent(s,key){return Math.max(0,Math.min(3,Number(s.companions?.evpapiy?.talents?.[key]||0)))}
export function canFly(s){return s.health>0&&s.needs.energy>=25&&!s.activeStatuses.includes('birdWings')&&!s.activeStatuses.includes('birdOverfed')}
export function spendBirdTalent(s,key){if(!BIRD_TALENTS[key])return false;const c=s.companions.evpapiy;if(!c||c.progression.points<=0||talent(s,key)>=3)return false;c.talents={...(c.talents||{}),[key]:talent(s,key)+1};c.progression.points--;return true}
