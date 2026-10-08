// Legacy bags stay intact. A heavy bag can always be consumed or unloaded.
export const ITEM_WEIGHT={water:.5,salo:.25,vodka:.6,aspirin:.02,medkit:.4,knife:.3,garlic:.08,onion:.15,onion_angry:.15,onion_smelly:.15,holy_water:.4,potion_unknown:.3,berries:.15,mushrooms:.25,herbs:.05,wood:.8,cloth:.1,rope:.2,raw_meat:.6,stew:.45,tea:.3,bandage:.08,trap:.7};
export function bagLimits(s){return s.activeActor==='evpapiy'?{slots:4,weight:2}:{slots:16,weight:12}}
export function carriedWeight(s){return Math.round((s.inventory||[]).reduce((n,x)=>n+(ITEM_WEIGHT[x.id]??.1)*x.qty,0)*100)/100}
export function canCarryWeight(s,id,qty){return (s.importantItems||[]).includes(id)||carriedWeight(s)+(ITEM_WEIGHT[id]??.1)*qty<=bagLimits(s).weight+.00001}
