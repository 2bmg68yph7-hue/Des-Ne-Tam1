// Shared by state normalization, save recovery and chapter selection.
export const CHAPTER_META=Object.freeze({
  1:{title:'Глава 1',scene:'intro'},2:{title:'Глава 2',scene:'ch2_intro'},
  3:{title:'Глава 3',scene:'ch3_intro'},4:{title:'Глава 4',scene:'ch4_intro'},
  5:{title:'Глава 5',scene:'ch5_intro'},6:{title:'Глава 6',scene:'ch6_intro099d'},
  7:{title:'Глава 7',scene:'ch7_intro100'}
});
export function chapterOf(state){
  const id=String(state?.story?.sceneId||state?.scene||'');
  const match=/^ch(\d+)_/.exec(id);
  if(match)return Number(match[1]);
  if(id==='intro')return 1;
  const chapter=Number(state?.story?.chapter??state?.chapter??1);
  return Number.isFinite(chapter)?Math.max(1,Math.floor(chapter)):1;
}
