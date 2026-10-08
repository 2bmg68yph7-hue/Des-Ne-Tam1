// A compact graph. Adjacent unknown places are discovered by actually travelling.
export const LOCATIONS={
 hut:{label:'Хата баби Галі',site:'hut',x:22,y:71,bg:'bg_hut.jpg',indoors:true,links:['yard'],description:'Тепло й сухо. Можна готувати, лікуватися та повернутися до розмови.'},
 yard:{label:'Двір',site:'yard',x:32,y:62,bg:'bg.jpg',links:['hut','well','wake','abandoned','road'],description:'Від хати видно кілька стежок. Можна перепочити чи домовитися про припаси.'},
 well:{label:'Криниця',site:'well',x:16,y:52,bg:'bg.jpg',links:['yard','forest','bank'],description:'Вода тут є. Для запасу в дорогу треба наповнити пляшку.'},
 wake:{label:'Двір з поминками',site:'wake',x:63,y:42,bg:'ch2_table.jpg',chapter:2,links:['yard','shed'],description:'Сюжетне місце. Сарай лишається закритим для довільного обшуку.'},
 shed:{label:'Сарай',site:'shed',x:82,y:45,bg:'ch2_shed.jpg',chapter:2,storyOnly:true,links:['wake'],description:'До сараю веде сюжет. Дослідження не обійде зустрічі та розкриття.'},
 road:{label:'Край старої дороги',site:'road',x:44,y:26,bg:'ch4_fog_light.jpg',chapter:3,risk:1,links:['yard','forest'],description:'Оглядаєте лише край дороги біля села. У туман без сюжету не заходите.'},
 abandoned:{label:'Порожня господарська хата',site:'abandoned',x:67,y:65,bg:'bg_hut.jpg',chapter:3,indoors:true,risk:1,links:['yard'],description:'Закуток для обшуку. Схованка не поповнюється сама від відкриття меню.'},
 forest:{label:'Узлісся',site:'forest',x:13,y:27,bg:'ch4_fog_light.jpg',risk:1,links:['well','road','bog'],description:'Гриби, ягоди, трави й сухі гілки. Вночі збирати важче.'},
 bog:{label:'Край болота',site:'bog',x:28,y:13,bg:'ch4_fog_dark.jpg',chapter:4,risk:2,links:['forest'],description:'Трави й мокра земля. Для безпечних кроків корисна спритність.'},
 bank:{label:'Берег за криницею',site:'bank',x:8,y:81,bg:'bg.jpg',chapter:3,risk:1,links:['well'],description:'Сліди дрібної дичини. Полювання й пастка потребують часу та інструментів.'},
 fog:{label:'Поруч у тумані',site:'fog',x:48,y:15,bg:'ch7_fog_100.jpg',chapter:7,links:[],description:'Лише найближчі орієнтири. Шлях у село ще не знайдений.'},
 church:{label:'???',site:'church',x:84,y:19,bg:'ch4_fog_dark.jpg',chapter:8,storyOnly:true,links:[],description:'Ця територія відкриється пізніше за сюжетом.'}
};
