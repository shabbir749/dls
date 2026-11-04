import {esc} from './ui.js';
import {L} from './i18n.js';
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const slim=p=>p&&{uid:p.uid,team:p.team};
const blank=()=>({a:null,b:null,sa:null,sb:null,room:'',status:'pending',winner:null});
export const roundName=n=>n===1?L('Final'):n===2?L('Semifinals'):n===4?L('Quarterfinals'):L('Round of {0}',n*2);

/** Single elimination. Size = next power of two ≥ players, so no match is ever bye-vs-bye. */
export function build(players){
  const n=players.length,size=2**Math.ceil(Math.log2(Math.max(2,n))),half=size/2,ps=shuffle(players).map(slim),rounds={};
  for(let r=0,c=half;c>=1;r++,c/=2)rounds['r'+r]=Array.from({length:c},blank);
  rounds.r0.forEach((m,i)=>{m.a=ps[i];m.b=ps[half+i]||null});
  rounds.r0.forEach((m,i)=>{if(!m.b){m.status='done';m.winner=m.a.uid;m.bye=true;advance(rounds,0,i,m.a)}});
  return rounds;
}
export function advance(rounds,r,i,w){
  const next=rounds['r'+(r+1)];if(!next)return;
  next[i>>1][i%2?'b':'a']=slim(w);
}
export function renderBracket(T,uid){
  const keys=Object.keys(T.rounds||{}).sort((a,b)=>a.slice(1)-b.slice(1));
  if(!keys.length)return '';
  const who=(p,sc,win)=>`<div class="flex items-center justify-between gap-2 px-2.5 py-1.5 ${win?'bg-neon/15 font-bold text-neon':''}"><span class="truncate ${p?'':'text-slate-500'}">${p?esc(p.team):L('TBD')}</span><b>${sc??''}</b></div>`;
  return `<div class="-mx-4 overflow-x-auto px-4 pb-2"><div class="flex min-w-max gap-8">${keys.map((k,r)=>{
    const ms=T.rounds[k];
    return `<div class="flex flex-col"><div class="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-volt">${roundName(ms.length)}</div>
    <div class="flex flex-1 flex-col justify-around gap-3">${ms.map((m,i)=>{
      const mine=uid&&(m.a?.uid===uid||m.b?.uid===uid),ready=m.a&&m.b&&m.status!=='done';
      return `<a href="#/m/${T.id}/${r}/${i}" class="block w-44 overflow-hidden rounded-xl border text-xs transition active:scale-95 ${mine?'border-volt shadow-lg shadow-volt/20':'border-white/10'} bg-slate-800/70 backdrop-blur-md">
        ${who(m.a,m.sa,m.winner&&m.winner===m.a?.uid)}<div class="h-px bg-white/10"></div>${who(m.b,m.sb,m.winner&&m.winner===m.b?.uid)}
        ${m.status==='disputed'?'<div class="bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">'+L('disputed')+'</div>':ready&&m.status!=='pending'?'<div class="bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">'+L(m.status)+'</div>':''}</a>`}).join('')}</div></div>`}).join('')}</div></div>`;
}
