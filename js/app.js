import * as F from './firebase.js';
import {$,esc,money,icons,skeleton,toast,modal} from './ui.js';
import {build,advance,renderBracket} from './bracket.js';
import {L,getLang,setLang} from './i18n.js';

const {auth,db}=F,app=$('#app');
let user=null,profile=null,unsub=null,T=null,CUR=null,HS={},S={tab:'open',list:[],q:''};

const PLEDGE=['I will NOT fix, sell or throw any match.','I will not use mods, cheats or fake accounts.',"I understand any result needs my opponent's confirmation, and the host can disqualify me on proof of fixing.",'I have read the prize breakdown and the management fee.'];
const PAYPLEDGE='I have really sent the entry fee, and the TrxID I entered is genuine.';
const STEPS=[['user-round','Create your profile','Add your team name, avatar and WhatsApp number.'],['wallet','Join and pay','Send the entry fee to the host and enter your TrxID.'],['gamepad-2','Play and confirm','Share the room code, play, upload the screenshot. Opponent confirms score.'],['trophy','Get paid','The host pays the prize and posts the TrxID. Winners confirm receipt.']];
const SAFE=['Check the host track record before paying.','Send money only to the number shown on the tournament page.','Never pay through unknown links or people who message you privately.','Report hosts who do not pay prizes. Complaints are public on their profile.'];
const FAQ=[['My payment is not verified yet. What now?','The host checks each TrxID manually. Message the host on WhatsApp if it takes long.'],['What if the host does not pay the prize?','Winners mark "Not received" and it shows on the host profile for everyone to see.'],['My room code expired. What should I do?','DLS friend-room codes last about 5 minutes. Create a new room and save the fresh code.'],['Does the site take a fee?','The site itself does not handle money. Hosts collect entry fees and set management fees openly.']];

const tref=id=>F.doc(db,'tournaments',id);
const prizeTotal=t=>(t.prizes||[]).reduce((a,b)=>a+(+b||0),0);
const complete=p=>p&&p.team&&p.phone;
const isPaid=p=>p.paid!==false;
const paidN=t=>(t.players||[]).filter(isPaid).length;
const statusBadge=s=>({open:[L('Upcoming'),'bg-volt/15 text-volt'],live:[L('Live'),'bg-neon/15 text-neon'],done:[L('Completed'),'bg-gold/15 text-gold']}[s]||['?','']);
const PL=i=>['🥇','🥈','🥉'][i]+' '+L(['1st','2nd','3rd'][i]);
const fdate=s=>s?new Date(s).toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short'}):L('TBA');
const fmtDur=ms=>{const m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60);return d?`${d}দ ${h}ঘিন্টা`:h?`${h}ঘিন্টা ${m%60}মি:`:`${m}মি`};
const countdown=s=>{if(!s)return '';const ms=new Date(s)-Date.now();return isNaN(ms)?'':ms<=0?L('Starting soon'):L('Starts in {0}',fmtDur(ms))};
const mut=(id,fn)=>F.runTransaction(db,async tx=>{
  const s=await tx.get(tref(id));if(!s.exists())throw Error(L('Tournament not found'));
  const t=s.data();t.players=t.players||[];t.rounds=t.rounds||{};t.payouts=t.payouts||{};t.reports=t.reports||[];fn(t);
  tx.update(tref(id),{players:t.players,rounds:t.rounds,status:t.status,champion:t.champion||null,payouts:t.payouts,reports:t.reports});
});
const run=async(fn,ok)=>{try{await mut(T.id,fn);HS={};if(ok)toast(L(ok));return true}catch(e){toast(e.message,'err');return false}};
const setView=h=>{app.innerHTML=h;icons()};
const needAuth=()=>{if(user)return true;authModal();return false};
const listen=draw=>{unsub=F.onSnapshot(F.query(F.collection(db,'tournaments'),F.orderBy('createdAt','desc')),s=>{S.list=s.docs.map(d=>({id:d.id,...d.data()}));draw()},e=>toast(e.message,'err'))};

function hostStats(id){
  return HS[id]||(HS[id]=F.getDocs(F.query(F.collection(db,'tournaments'),F.where('hostId','==',id))).then(s=>{
    const r={hosted:0,done:0,paid:0,conf:0,bad:0,rep:0};
    s.docs.forEach(d=>{const t=d.data();r.hosted++;if(t.status==='done')r.done++;r.rep+=(t.reports||[]).length;
      Object.values(t.payouts||{}).forEach(p=>{r.paid++;if(p.ok===true)r.conf++;if(p.ok===false)r.bad++})});
    return r}));
}
function trustBox(r,link){
  const bad=r.bad>0||r.rep>=2,good=!bad&&r.done>=1&&r.conf>=1;
  const [cls,ic,tt]=bad?['border-red-500/40 bg-red-500/10 text-red-300','shield-alert',L('Warning: complaints about this host')]:good?['border-neon/40 bg-neon/10 text-neon','shield-check',L('Good track record')]:['border-gold/40 bg-gold/10 text-gold','info',L('New or unproven host')];
  return `<div class="rounded-2xl border p-3.5 text-sm ${cls}"><div class="flex items-center gap-2 font-bold"><i data-lucide="${ic}" class="h-4 w-4"></i>${tt}</div>
  <p class="mt-1 text-xs text-slate-200 leading-relaxed">${L('{0} completed · {1}/{2} payouts confirmed · {3} reports',r.done,r.conf,r.paid,r.rep)}</p>
  ${link?`<a href="#/h/${link}" class="mt-1.5 inline-block text-xs text-volt underline font-semibold">${L('View host profile')}</a>`:''}</div>`;
}
function fillHost(){
  const hid=T.hostId;
  hostStats(hid).then(r=>{const el=$('#hs');if(el&&T&&T.hostId===hid){el.innerHTML=trustBox(r,hid);icons()}}).catch(()=>{});
}

F.onAuthStateChanged(auth,async u=>{
  user=u;profile=null;
  if(u){try{const s=await F.getDoc(F.doc(db,'users',u.uid));profile=s.exists()?s.data():null}catch(e){}}
  header();route();
});
function header(){
  const avatarHtml = profile?.avatar ? `<img src="${esc(profile.avatar)}" class="h-7 w-7 rounded-full object-cover">` : `<span class="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-volt to-neon text-ink font-bold">${esc((profile?.team||user?.displayName||user?.email||'?')[0].toUpperCase())}</span>`;
  const u=user?`<a href="#/me" class="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-xs font-semibold"><span class="flex items-center justify-center">${avatarHtml}</span><span class="max-w-[7rem] truncate">${esc(profile?.team||L('Set profile'))}</span></a>`
    :`<button data-act="auth" class="btn btn-p !py-1.5">${L('Sign in')}</button>`;
  $('#hdr').innerHTML=`<div class="flex items-center gap-2">${u}</div>`;
}
function nav(){
  const it=[['','home','Home','#/'],['new','plus-circle','Host','#/new'],['lb','crown','Ranking','#/lb'],['me','user-round','Profile','#/me']];
  $('#nav').innerHTML=`<div class="mx-auto grid max-w-3xl grid-cols-4">${it.map(([k,i,l,h])=>`<a href="${h}" data-nav="${k}" class="flex flex-col items-center gap-1 py-2 text-xs font-medium text-slate-300 transition"><i data-lucide="${i}" class="h-5 w-5"></i>${L(l)}</a>`).join('')}</div>`;
  icons();
}
function authModal(){
  let mode='in';
  const m=modal(`<h3 class="mb-1 text-lg font-bold">${L('Welcome to DLS Tournament Hub')}</h3><p class="mb-4 text-sm text-slate-300">${L('Sign in to join and host tournaments.')}</p>
  <button id="g" class="btn btn-g mb-3 w-full"><i data-lucide="chrome" class="h-4 w-4"></i>${L('Continue with Google')}</button>
  <div class="my-3 flex items-center gap-3 text-xs text-slate-400"><span class="h-px flex-1 bg-white/10"></span>${L('or')}<span class="h-px flex-1 bg-white/10"></span></div>
  <form id="f" class="space-y-3"><input class="inp" name="email" type="email" placeholder="${L('Email')}" required autocomplete="email"><input class="inp" name="password" type="password" placeholder="${L('Password (min 6)')}" minlength="6" required autocomplete="current-password">
  <button class="btn btn-p w-full" id="go">${L('Sign in')}</button></form>
  <button id="sw" class="mt-3 w-full text-center text-xs text-volt font-semibold">${L('New here? Create account')}</button>`);
  m.$('#g').onclick=async()=>{try{await F.signInWithPopup(auth,new F.GoogleAuthProvider());m.close()}catch(e){toast(e.message,'err')}};
  m.$('#sw').onclick=()=>{mode=mode==='in'?'up':'in';m.$('#go').textContent=mode==='in'?L('Sign in'):L('Create account');m.$('#sw').textContent=mode==='in'?L('New here? Create account'):L('Have an account? Sign in')};
  m.$('#f').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    try{await(mode==='in'?F.signInWithEmailAndPassword:F.createUserWithEmailAndPassword)(auth,d.email,d.password);m.close()}catch(err){toast(err.message.replace('Firebase: ',''),'err')}};
}

function route(){
  if(unsub){unsub();unsub=null}
  if(!F.configured)return setView(`<div class="m-4 glass rounded-2xl p-5"><h2 class="font-bold text-gold">${L('Firebase not configured')}</h2><p class="mt-2 text-sm text-slate-200">${L('Open js/firebase.js and paste your Firebase web config.')}</p></div>`);
  const [,p,a,b,c]=location.hash.split('/');
  document.querySelectorAll('[data-nav]').forEach(n=>{const on=n.dataset.nav===(p||'');n.classList.toggle('text-volt',on);n.classList.toggle('font-bold',on);n.classList.toggle('text-slate-300',!on)});
  setView(skeleton());window.scrollTo(0,0);
  if(p==='t')return tourney(a);
  if(p==='m')return matchView(a,+b,+c);
  if(p==='h')return hostView(a);
  if(p==='new')return createView();
  if(p==='me')return profileView();
  if(p==='lb')return listen(drawLb);
  listen(drawFeed);
}
addEventListener('hashchange',route);
nav();

function drawFeed(){
  const all=S.list,nTeams=all.reduce((a,t)=>a+paidN(t),0),pool=all.reduce((a,t)=>a+prizeTotal(t),0);
  const tabs=[['live','Active','zap'],['open','Upcoming','calendar-clock'],['done','Completed','medal']];
  setView(`<div class="space-y-6 p-4">
  <section class="glass relative overflow-hidden rounded-3xl p-5 sm:p-6 shadow-xl">
    <div class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-volt/20 blur-3xl"></div>
    <span class="badge bg-neon/15 text-neon mb-2"><i data-lucide="shield-check" class="h-3.5 w-3.5"></i>${L('Fair play · Verified payments')}</span>
    <h1 class="mt-2 text-3xl font-black leading-tight tracking-tight">DLS <span class="text-volt">Tournament Hub</span></h1>
    <p class="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">${L("Bangladesh's home for Dream League Soccer tournaments. Join, play and win real prizes.")}</p>
    <div class="mt-4 flex gap-3"><a href="#/new" class="btn btn-p flex-1"><i data-lucide="plus-circle" class="h-4 w-4"></i>${L('Host a tournament')}</a><button data-act="goList" class="btn btn-g flex-1"><i data-lucide="swords" class="h-4 w-4"></i>${L('Browse tournaments')}</button></div>
    <div class="mt-5 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
      <div class="rounded-xl bg-slate-900/60 py-3"><div class="text-lg sm:text-xl font-extrabold text-volt">${all.length}</div><span class="text-slate-300">${L('Tournaments')}</span></div>
      <div class="rounded-xl bg-slate-900/60 py-3"><div class="text-lg sm:text-xl font-extrabold text-neon">${nTeams}</div><span class="text-slate-300">${L('Teams joined')}</span></div>
      <div class="rounded-xl bg-slate-900/60 py-3"><div class="text-lg sm:text-xl font-extrabold text-gold">${money(pool)}</div><span class="text-slate-300">${L('Total prizes')}</span></div></div>
  </section>
  <section id="lst"><h2 class="mb-3 text-xl font-bold">${L('Tournaments')}</h2>
    <div class="relative"><i data-lucide="search" class="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400"></i><input id="q" class="inp !pl-10 text-base" placeholder="${L('Search tournament or host')}" value="${esc(S.q)}"></div>
    <div class="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-slate-900/70 p-1">${tabs.map(([k,l,i])=>`<button data-act="tab" data-k="${k}" class="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition ${S.tab===k?'bg-volt text-ink shadow':'text-slate-300'}"><i data-lucide="${i}" class="h-4 w-4"></i>${L(l)} <span class="opacity-70 text-xs">(${all.filter(t=>t.status===k).length})</span></button>`).join('')}</div>
    <div id="fl" class="mt-4 space-y-3"></div></section>
  <section><h2 class="mb-3 text-xl font-bold">${L('How it works')}</h2><div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${STEPS.map(([ic,h,d],i)=>`<div class="glass rounded-2xl p-4"><div class="mb-2 flex items-center gap-2.5"><span class="grid h-9 w-9 place-items-center rounded-xl bg-volt/15 text-volt"><i data-lucide="${ic}" class="h-5 w-5"></i></span><span class="text-sm font-bold text-volt">ধাপ ${i+1}</span></div><div class="text-base font-bold text-slate-100">${L(h)}</div><p class="mt-1 text-sm text-slate-300 leading-relaxed">${L(d)}</p></div>`).join('')}</div></section>
  <section class="rounded-2xl border border-gold/40 bg-gold/5 p-4 sm:p-5"><div class="mb-2.5 flex items-center gap-2 font-bold text-gold text-base"><i data-lucide="shield-alert" class="h-5 w-5"></i>${L('Stay safe')}</div><ul class="space-y-2 text-sm text-slate-200 leading-relaxed">${SAFE.map(s=>`<li class="flex gap-2.5"><span class="text-gold font-bold">•</span><span>${L(s)}</span></li>`).join('')}</ul></section>
  <section><h2 class="mb-3 text-xl font-bold">${L('FAQ')}</h2><div class="space-y-2.5">${FAQ.map(([q,a])=>`<details class="glass rounded-xl p-4 text-sm"><summary class="cursor-pointer font-bold text-slate-200 text-base">${L(q)}</summary><p class="mt-2.5 text-slate-300 leading-relaxed">${L(a)}</p></details>`).join('')}</div></section>
  <footer class="pb-4 text-center text-xs text-slate-400 leading-relaxed">© DLS Tournament Hub<br>${L('Not affiliated with First Touch Games or Dream League Soccer.')}</footer></div>`);
  drawList();
}
function drawList(){
  const q=S.q.trim().toLowerCase(),list=S.list.filter(t=>t.status===S.tab&&(!q||(t.name+' '+t.hostName).toLowerCase().includes(q)));
  const el=$('#fl');if(!el)return;
  el.innerHTML=list.map(t=>card(t)).join('')||`<div class="glass rounded-2xl p-8 text-center text-sm text-slate-300"><i data-lucide="ghost" class="mx-auto mb-2 h-8 w-8 text-slate-400"></i>${L('Nothing here yet.')}</div>`;
  icons();
}
function card(t,pool=S.list){
  const [bl,bc]=statusBadge(t.status),n=(t.players||[]).length,cd=t.status==='open'?countdown(t.start):'';
  const hd=pool.filter(x=>x.hostId===t.hostId&&x.status==='done').length;
  const hb=hd>0?`<span class="text-neon font-medium">✔ ${L('{0} completed',hd)}</span>`:`<span class="text-gold font-medium">${L('New host')}</span>`;
  return `<a href="#/t/${t.id}" class="glass block rounded-2xl p-4 sm:p-5 transition hover:border-volt/40 active:scale-[.99]">
  <div class="flex items-start justify-between gap-2"><h3 class="text-base sm:text-lg font-bold leading-snug text-slate-100">${esc(t.name)}</h3><span class="badge ${bc}">${bl}</span></div>
  <p class="mt-1.5 text-xs sm:text-sm text-slate-300">${L('by')} <strong class="text-slate-200">${esc(t.hostName)}</strong> · ${hb} · ${fdate(t.start)}</p>
  ${cd?`<p class="mt-1.5 flex items-center gap-1.5 text-xs text-volt font-medium"><i data-lucide="clock" class="h-3.5 w-3.5"></i>${cd}</p>`:''}
  <div class="mt-3.5 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
    <div class="rounded-xl bg-slate-900/60 py-2.5"><div class="font-extrabold text-gold text-sm sm:text-base">${money(prizeTotal(t))}</div><span class="text-slate-400 text-xs">${L('Prize')}</span></div>
    <div class="rounded-xl bg-slate-900/60 py-2.5"><div class="font-extrabold text-slate-200 text-sm sm:text-base">${t.fee>0?money(t.fee):L('FREE')}</div><span class="text-slate-400 text-xs">${L('Entry')}</span></div>
    <div class="rounded-xl bg-slate-900/60 py-2.5"><div class="font-extrabold text-neon text-sm sm:text-base">${n}/${t.max}</div><span class="text-slate-400 text-xs">${L('Teams')}</span></div></div></a>`;
}

function drawLb(){
  const m={},g=(uid,team)=>m[uid]||(m[uid]={uid,team,t:0,w:0,c:0,prize:0});
  S.list.forEach(t=>{
    if(t.status!=='open')(t.players||[]).filter(isPaid).forEach(p=>g(p.uid,p.team).t++);
    Object.keys(t.rounds||{}).forEach(k=>t.rounds[k].forEach(x=>{if(x.winner&&!x.bye){const w=x.winner===x.a?.uid?x.a:x.b;if(w)g(w.uid,w.team).w++}}));
    if(t.champion)g(t.champion.uid,t.champion.team).c++;
    Object.values(t.payouts||{}).forEach(p=>{if(p.ok===true)g(p.uid,p.team).prize+=+p.amount||0});
  });
  const rows=Object.values(m).sort((a,b)=>b.c-a.c||b.w-a.w||b.prize-a.prize).slice(0,30);
  setView(`<div class="space-y-4 p-4"><div><h1 class="text-2xl font-black">${L('Ranking')}</h1><p class="text-sm text-slate-300 mt-1">${L('Top teams by titles, then match wins.')}</p></div>
  ${rows.length?`<div class="glass overflow-hidden rounded-2xl"><div class="grid grid-cols-[2rem_1fr_3rem_3rem_5rem] gap-2 border-b border-white/10 px-3 py-3 text-xs font-bold uppercase text-slate-400"><span>#</span><span>${L('Team')}</span><span class="text-center">🏆</span><span class="text-center">${L('Wins')}</span><span class="text-right">${L('Prize won')}</span></div>
  ${rows.map((r,i)=>`<div class="grid grid-cols-[2rem_1fr_3rem_3rem_5rem] items-center gap-2 px-3 py-3 text-sm ${i%2?'bg-white/[.03]':''}"><span class="font-bold ${i<3?'text-gold':'text-slate-400'}">${i+1}</span><span class="truncate font-semibold text-slate-100">${esc(r.team)}</span><span class="text-center font-bold text-gold">${r.c}</span><span class="text-center font-medium">${r.w}</span><span class="text-right font-bold text-xs text-neon">${money(r.prize)}</span></div>`).join('')}</div>`
  :`<div class="glass rounded-2xl p-8 text-center text-sm text-slate-300"><i data-lucide="crown" class="mx-auto mb-2 h-8 w-8 text-slate-400"></i>${L('No ranking yet. Finish a tournament to appear here.')}</div>`}</div>`);
}

function tourney(id){
  unsub=F.onSnapshot(tref(id),s=>{if(!s.exists())return setView(`<p class="p-8 text-center text-slate-300">${L('Tournament not found')}</p>`);T={id,...s.data()};T.players=T.players||[];drawT()},e=>toast(e.message,'err'));
}
function transparency(t){
  const n=paidN(t),col=t.fee*n,fee=Math.round(col*t.feePct/100),net=col-fee,pt=prizeTotal(t);
  return `<section class="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-4 sm:p-5 backdrop-blur-md">
  <div class="mb-3 flex items-center gap-2 font-bold text-gold text-base"><i data-lucide="shield-check" class="h-5 w-5"></i>${L('Prize Pool & Management Fee')}</div>
  <div class="space-y-2 text-sm text-slate-200">
  <div class="flex justify-between"><span class="text-slate-300">${L('Entry fee × verified teams')}</span><span class="font-medium">${money(t.fee)} × ${n}</span></div>
  <div class="flex justify-between"><span class="text-slate-300">${L('Total collected')}</span><b class="text-slate-100">${money(col)}</b></div>
  <div class="flex justify-between text-red-300"><span>${L('Management fee ({0}%)',t.feePct)}</span><b>− ${money(fee)}</b></div>
  <div class="flex justify-between border-t border-white/10 pt-2"><span class="text-slate-300 font-medium">${L('Net available')}</span><b class="text-neon text-base">${money(net)}</b></div></div>
  <div class="mt-4 grid grid-cols-3 gap-2.5 text-center text-xs sm:text-sm">${(t.prizes||[]).map((p,i)=>p>0?`<div class="rounded-xl bg-black/20 py-2.5"><div class="text-xs text-slate-300 font-medium">${PL(i)}</div><b class="text-gold text-sm sm:text-base">${money(p)}</b></div>`:'').join('')}</div>
  ${pt>net?`<p class="mt-3.5 rounded-xl bg-gold/10 p-3 text-xs sm:text-sm text-gold leading-relaxed">${L('Declared prizes ({0}) exceed the current net. They fully unlock as more teams join; the host guarantees the declared amounts.',money(pt))}</p>`:''}</section>`;
}
function placings(t){
  const ks=Object.keys(t.rounds||{}).sort((a,b)=>a.slice(1)-b.slice(1));
  const lose=m=>m&&m.winner&&!m.bye?(m.winner===m.a.uid?m.b:m.a):null;
  const fin=ks.length?t.rounds[ks[ks.length-1]][0]:null,semis=ks.length>1?t.rounds[ks[ks.length-2]]:[];
  return [t.champion?[t.champion]:[],[lose(fin)].filter(Boolean),semis.map(lose).filter(Boolean)];
}
function drawT(){
  const t=T,uid=user?.uid,host=uid&&t.hostId===uid,me=uid&&t.players.find(p=>p.uid===uid),full=t.players.length>=t.max,n=paidN(t),pend=t.players.filter(p=>!isPaid(p));
  const [bl,bc]=statusBadge(t.status),pays=t.payouts||{},pc=placings(t);
  const all=[];Object.keys(t.rounds||{}).forEach((k,r)=>t.rounds[k].forEach((m,i)=>all.push({m,r,i})));
  const mine=user&&all.find(x=>x.m.status!=='done'&&x.m.a&&x.m.b&&(x.m.a.uid===user.uid||x.m.b.uid===user.uid));
  const review=host?all.filter(x=>['submitted','confirmed','disputed'].includes(x.m.status)):[];
  const payPlaces=[0,1,2].filter(i=>(t.prizes||[])[i]>0);
  const payRow=i=>{const po=pays[i];return `<div class="rounded-xl bg-slate-900/60 p-3.5 text-sm"><div class="flex items-center justify-between gap-2"><strong class="text-slate-100">${PL(i)} · ${money(t.prizes[i])}</strong>
    <span class="badge ${po?(po.ok===true?'bg-neon/20 text-neon':po.ok===false?'bg-red-500/20 text-red-300':'bg-gold/20 text-gold'):'bg-white/10 text-slate-300'}">${po?(po.ok===true?L('Received'):po.ok===false?L('Not received'):L('Sent · awaiting confirmation')):L('Not paid yet')}</span></div>
    ${po?`<div class="mt-1.5 text-xs text-slate-300">${esc(po.team)} · TrxID <b class="select-all text-slate-100">${esc(po.trx)}</b></div>`:''}
    ${po&&uid===po.uid&&po.ok==null?`<div class="mt-2.5 grid grid-cols-2 gap-2"><button data-act="pconf" data-p="${i}" data-v="1" class="btn btn-n !py-2">${L('I received it')}</button><button data-act="pconf" data-p="${i}" data-v="0" class="btn btn-d !py-2">${L('Not received')}</button></div>`:''}
    ${host&&pc[i].length&&(!po||po.ok!==true)?`<button data-act="payout" data-p="${i}" class="btn btn-g mt-2.5 w-full !py-2">${po?L('Edit payout record'):L('Record payout')}</button>`:''}</div>`};
  setView(`<div class="space-y-4 p-4">
  <div><div class="flex items-center justify-between"><span class="badge ${bc}">${bl}</span><div class="flex gap-2"><button data-act="share" class="btn btn-g !px-3 !py-1.5 text-xs"><i data-lucide="share-2" class="h-3.5 w-3.5"></i>${L('Share')}</button></div></div>
  <h1 class="mt-2 text-2xl sm:text-3xl font-black leading-tight text-slate-100">${esc(t.name)}</h1>
  <p class="mt-1 text-xs sm:text-sm text-slate-300">${L('by')} <strong class="text-slate-200">${esc(t.hostName)}</strong> · ${fdate(t.start)}${t.status==='open'&&countdown(t.start)?' · '+countdown(t.start):''}</p></div>
  ${t.champion?`<div class="rounded-2xl bg-gradient-to-r from-gold/30 to-gold/5 p-4 text-center shadow-lg"><i data-lucide="crown" class="mx-auto h-8 w-8 text-gold"></i><div class="text-xs text-gold font-bold tracking-wider mt-1">${L('CHAMPION')}</div><div class="text-xl font-black text-slate-100 mt-0.5">${esc(t.champion.team)}</div></div>`:''}
  <div><div id="hs" class="h-20 animate-pulse rounded-2xl bg-slate-800/60"></div>
  <div class="mt-1.5 flex justify-end gap-3 text-xs">${user&&t.hostPhone?`<a target="_blank" rel="noopener" href="https://wa.me/${String(t.hostPhone).replace(/\D/g,'')}" class="text-neon underline font-medium">${L('Contact host')}</a>`:''}${!host?`<button data-act="report" class="text-red-400 underline font-medium">${L('Report host')}</button>`:''}</div></div>
  ${transparency(t)}
  <div class="flex flex-wrap gap-2">
  ${t.status==='open'&&!me&&!full?`<button data-act="join" class="btn btn-n flex-1 py-3 text-base font-bold"><i data-lucide="log-in" class="h-4 w-4"></i>${L('Join')} · ${t.fee>0?money(t.fee):L('Free')}</button>`:''}
  ${me&&t.status==='open'?(isPaid(me)?`<div class="btn btn-g flex-1 !text-neon py-3 text-sm font-bold"><i data-lucide="check-circle-2" class="h-4 w-4"></i>${L("You're in")}</div>`:`<div class="btn btn-g flex-1 !text-gold py-3 text-sm font-bold"><i data-lucide="clock" class="h-4 w-4"></i>${L('Waiting for payment verification')}</div>`):''}
  ${mine?`<a href="#/m/${t.id}/${mine.r}/${mine.i}" class="btn btn-p flex-1 py-3 text-base font-bold"><i data-lucide="gamepad-2" class="h-4 w-4"></i>${L('Open my match room')}</a>`:''}
  <button data-act="guide" class="btn btn-g py-3"><i data-lucide="scale" class="h-4 w-4"></i>${L('Rules')}</button></div>
  ${me&&t.fee>0&&t.payInfo&&!isPaid(me)?`<div class="glass rounded-2xl p-4 text-sm space-y-1.5"><b class="text-volt font-bold">${L('Payment instructions')}</b><p class="whitespace-pre-line text-slate-200 leading-relaxed">${esc(t.payInfo)}</p></div>`:''}
  ${host?`<section class="glass space-y-3.5 rounded-2xl p-4 sm:p-5"><div class="flex items-center gap-2 font-bold text-base text-slate-100"><i data-lucide="shield" class="h-5 w-5 text-volt"></i>${L('Host admin')}</div>
   ${pend.length?`<div><div class="mb-2 text-xs font-bold text-slate-300">${L('Payments to verify')} (${pend.length})</div><div class="space-y-2.5">${pend.map(p=>`<div class="rounded-xl bg-slate-900/60 p-3.5 text-sm"><div class="flex items-center justify-between gap-2"><strong class="text-slate-100">${esc(p.team)}</strong><span class="text-xs text-slate-300 font-medium">${esc(p.method)} · ${esc(p.sender)}</span></div><div class="mt-1.5 text-xs text-slate-300">TrxID: <b class="select-all text-slate-100 font-bold">${esc(p.trx)}</b></div><div class="mt-3 grid grid-cols-2 gap-2"><button data-act="verify" data-u="${p.uid}" class="btn btn-n !py-2">${L('Payment received')}</button><button data-act="reject" data-u="${p.uid}" class="btn btn-d !py-2">${L('Reject')}</button></div></div>`).join('')}</div><p class="mt-2 text-xs text-slate-400 leading-relaxed">${L('Match the TrxID with your own bKash/Nagad/Rocket app before verifying.')}</p></div>`:''}
   ${t.status==='open'?`<button data-act="start" class="btn btn-p w-full py-3 text-base font-bold" ${n<2?'disabled':''}>${L('Generate bracket & start ({0} verified teams)',n)}</button>`:''}
   ${review.length?`<div class="space-y-2"><div class="text-xs font-bold text-slate-300">${L('Needs your review')}</div>${review.map(x=>`<a href="#/m/${t.id}/${x.r}/${x.i}" class="flex items-center justify-between rounded-xl bg-slate-900/60 p-3 text-sm hover:bg-white/[0.05]"><span>${esc(x.m.a.team)} vs ${esc(x.m.b.team)}</span><span class="badge ${x.m.status==='disputed'?'bg-red-500/20 text-red-300':'bg-gold/20 text-gold'}">${L(x.m.status)}</span></a>`).join('')}</div>`:(t.status==='live'?`<p class="text-sm text-slate-300">${L('No results waiting for review.')}</p>`:'')}</section>`:''}
  ${t.status==='done'&&payPlaces.length?`<section><h2 class="mb-1 text-lg font-bold text-slate-100">${L('Prize payouts')}</h2><p class="mb-3 text-xs text-slate-300 leading-relaxed">${L('Host must pay within 24 hours of the final and post the TrxID here.')}</p><div class="space-y-2.5">${payPlaces.map(payRow).join('')}</div></section>`:''}
  ${t.rounds&&Object.keys(t.rounds).length?`<section><h2 class="mb-3 text-lg font-bold text-slate-100">${L('Bracket')}</h2>${renderBracket(t,user?.uid)}</section>`:''}
  <section><h2 class="mb-3 text-lg font-bold text-slate-100">${L('Teams')} (${t.players.length}/${t.max})</h2><div class="grid gap-2.5 sm:grid-cols-2">${t.players.map((p,i)=>`<div class="glass flex items-center gap-3 rounded-xl p-3 text-sm"><span class="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-xs font-bold text-slate-200">${i+1}</span><span class="flex-1 truncate font-semibold text-slate-100">${esc(p.team)}</span>${isPaid(p)?'':`<span class="badge bg-gold/15 text-gold">${L('Pending')}</span>`}</div>`).join('')||`<p class="text-sm text-slate-300">${L('No teams yet.')}</p>`}</div></section>
  <section class="glass rounded-2xl p-4 sm:p-5"><h2 class="mb-2 text-lg font-bold text-slate-100">${L('Tournament rules')}</h2><p class="whitespace-pre-line text-sm text-slate-300 leading-relaxed">${esc(t.rules)}</p></section></div>`);
  fillHost();
}

const actions={
  auth:authModal,
  tab:d=>{S.tab=d.k;const y=scrollY;drawFeed();scrollTo(0,y)},
  goList(){$('#lst')?.scrollIntoView({behavior:'smooth'})},
  copy(d){navigator.clipboard?.writeText(d.v).then(()=>toast(L('Copied')))},
  share(){const u=location.href,txt=`${T.name} · DLS Tournament Hub\n${u}`;if(navigator.share)navigator.share({title:T.name,text:txt,url:u}).catch(()=>{});else window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank')},
  guide(){modal(`<h3 class="mb-3 flex items-center gap-2 text-lg font-bold text-slate-100"><i data-lucide="scale" class="h-5 w-5 text-volt"></i>${L('Anti-Fixing Guidelines')}</h3><ul class="space-y-2.5 text-sm text-slate-300 leading-relaxed">
   <li>✅ ${L('Winner submits score + full screenshot. The opponent must confirm or dispute.')}</li><li>✅ ${L('The host reviews every result before the winner advances.')}</li>
   <li>✅ ${L('Entry payments are verified by the host using the TrxID before a team is counted.')}</li>
   <li>🚫 ${L('Match fixing, selling matches or deliberate losing = permanent ban + prize forfeiture.')}</li><li>🚫 ${L('Fake or multiple accounts are disqualified.')}</li>
   <li>🔎 ${L('Disputes: both sides may be asked for the full match recording.')}</li><li>💰 ${L('Prize and management fee are shown openly on every tournament page.')}</li></ul>`)},
  join(){
    if(!needAuth())return;
    if(!complete(profile)){toast(L('Complete your profile first'),'err');location.hash='#/me';return}
    const pay=T.fee>0,pl=pay?[...PLEDGE,PAYPLEDGE]:PLEDGE;
    const m=modal(`<h3 class="mb-1 text-lg font-bold text-slate-100">${L('Join')} ${esc(T.name)}</h3><p class="mb-4 text-sm text-slate-300">${L('Entry')}: ${pay?money(T.fee):L('Free')}</p>
    ${pay?`<div class="mb-4 space-y-3 rounded-2xl border border-gold/40 bg-gold/5 p-4"><div class="text-sm font-bold text-gold">${L('Step 1: Send the entry fee')}</div><p class="whitespace-pre-line text-sm text-slate-200 leading-relaxed">${esc(T.payInfo||L('Ask the host for payment details'))}</p>
     <div class="text-sm font-bold text-gold mt-3">${L('Step 2: Enter your payment details')}</div>
     <select id="pm" class="inp text-slate-100"><option>bKash</option><option>Nagad</option><option>Rocket</option><option>${L('Other')}</option></select>
     <input id="ps" class="inp" type="tel" placeholder="${L('Number you sent from')}">
     <input id="pt" class="inp" maxlength="30" placeholder="${L('TrxID (e.g. 9A7B3C2D)')}">
     <p class="text-xs text-slate-300 leading-relaxed">${L('Your spot is held as pending until the host verifies your payment.')}</p></div>`:''}
    <div class="space-y-2.5">${pl.map(p=>`<label class="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-900/60 p-3.5 text-sm"><input type="checkbox" class="ck mt-0.5 h-4 w-4 accent-cyan-500 shrink-0"><span class="text-slate-200 leading-relaxed">${L(p)}</span></label>`).join('')}</div>
    <button id="ok" class="btn btn-n mt-5 w-full py-3 text-base font-bold" disabled>${L('Confirm & join')}</button>`);
    const cks=[...m.el.querySelectorAll('.ck')];
    cks.forEach(c=>c.onchange=()=>m.$('#ok').disabled=!cks.every(x=>x.checked));
    m.$('#ok').onclick=async()=>{
      const method=pay?m.$('#pm').value:'',sender=pay?m.$('#ps').value.trim():'',trx=pay?m.$('#pt').value.trim():'';
      if(pay&&(!sender||trx.length<6))return toast(L('Enter your number and TrxID'),'err');
      const ok=await run(t=>{if(t.status!=='open')throw Error(L('Registration closed'));if(t.players.length>=t.max)throw Error(L('Tournament is full'));if(t.players.some(p=>p.uid===user.uid))throw Error(L('Already joined'));
        if(pay&&t.players.some(p=>p.trx&&p.trx.toLowerCase()===trx.toLowerCase()))throw Error(L('This TrxID is already used'));
        t.players.push({uid:user.uid,team:profile.team,phone:profile.phone,fb:profile.fb||'',paid:!pay,method,sender,trx})},pay?'Request sent. Waiting for payment verification':'You joined! 🎮');
      if(ok)m.close()};
  },
  verify(d){run(t=>{if(t.hostId!==user.uid)throw Error(L('Host only'));const p=t.players.find(x=>x.uid===d.u);if(p)p.paid=true},'Payment verified')},
  reject(d){if(!confirm(L('Reject this payment and remove the team?')))return;run(t=>{if(t.hostId!==user.uid)throw Error(L('Host only'));if(t.status!=='open')throw Error(L('Registration closed'));t.players=t.players.filter(x=>x.uid!==d.u)},'Team removed')},
  start(){
    const pend=T.players.filter(p=>!isPaid(p)).length;
    if(pend&&!confirm(L('{0} unverified player(s) will be removed. Continue?',pend)))return;
    run(t=>{if(t.hostId!==user.uid)throw Error(L('Host only'));const ps=t.players.filter(isPaid);if(ps.length<2)throw Error(L('At least 2 verified teams needed'));t.players=ps;t.rounds=build(ps);t.status='live'},'Bracket generated');
  },
  payout(d){
    const i=+d.p,cs=placings(T)[i];
    const m=modal(`<h3 class="mb-3 text-lg font-bold text-slate-100">${L('Record payout')} · ${PL(i)} · ${money(T.prizes[i])}</h3><div class="space-y-3.5">
     <div><label class="lbl">${L('Winner team')}</label><select id="pw" class="inp text-slate-100">${cs.map(c=>`<option value="${c.uid}">${esc(c.team)}</option>`).join('')}</select></div>
     <div><label class="lbl">${L('Payment TrxID / reference')}</label><input id="pt" class="inp" maxlength="40"></div>
     <p class="text-xs text-slate-400 leading-relaxed">${L('The winner will be asked to confirm they received this payment.')}</p>
     <button id="ok" class="btn btn-p w-full py-3 font-bold">${L('Save')}</button></div>`);
    m.$('#ok').onclick=async()=>{
      const wid=m.$('#pw').value,trx=m.$('#pt').value.trim(),w=cs.find(c=>c.uid===wid);
      if(trx.length<6)return toast(L('Enter a valid TrxID'),'err');
      const ok=await run(t=>{if(t.hostId!==user.uid)throw Error(L('Host only'));if(t.payouts[i]?.ok===true)throw Error(L('Not allowed'));t.payouts[i]={uid:w.uid,team:w.team,amount:+t.prizes[i]||0,trx,ok:null,at:Date.now()}},'Payout recorded');
      if(ok)m.close()};
  },
  pconf(d){run(t=>{const po=t.payouts[+d.p];if(!po||po.uid!==user.uid)throw Error(L('Not allowed'));po.ok=d.v==='1'},'Thanks, recorded')},
  report(){
    if(!needAuth())return;
    const why=prompt(L('Why are you reporting this host?'));if(!why)return;
    run(t=>{if(t.hostId===user.uid)throw Error(L('Not allowed'));if(t.reports.some(r=>r.uid===user.uid))throw Error(L('You already reported this host'));t.reports.push({uid:user.uid,why:why.slice(0,300),at:Date.now()})},'Report sent');
  },
  async logout(){await F.signOut(auth);location.hash='#/'}
};
document.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(a&&actions[a.dataset.act]){e.preventDefault();actions[a.dataset.act](a.dataset,e)}});
document.addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;drawList()}});

function hostView(id){
  F.getDocs(F.query(F.collection(db,'tournaments'),F.where('hostId','==',id))).then(async s=>{
    const ts=s.docs.map(d=>({id:d.id,...d.data()}));
    if(!ts.length)return setView(`<p class="p-8 text-center text-slate-300">${L('Host not found.')}</p>`);
    const r=await hostStats(id);
    setView(`<div class="space-y-4 p-4"><a href="javascript:history.back()" class="inline-flex items-center gap-1 text-xs text-volt font-medium"><i data-lucide="chevron-left" class="h-4 w-4"></i>${L('Back')}</a>
    <h1 class="text-2xl font-black text-slate-100">${esc(ts[0].hostName)}</h1>${trustBox(r)}
    <h2 class="font-bold text-lg text-slate-100 mt-4">${L('Tournaments by this host')}</h2><div class="space-y-3">${ts.map(t=>card(t,ts)).join('')}</div></div>`);
  }).catch(e=>toast(e.message,'err'));
}

function matchView(id,r,i){
  CUR={id,r,i};
  unsub=F.onSnapshot(tref(id),async s=>{
    if(!s.exists())return setView(`<p class="p-8 text-center text-slate-300">${L('Not found.')}</p>`);
    T={id,...s.data()};T.players=T.players||[];const m=T.rounds?.['r'+r]?.[i];
    if(!m||!m.a||!m.b)return setView(`<p class="p-8 text-center text-slate-300">${L('This match is not ready yet.')}</p>`);
    let proof=null;if(m.proof){try{const p=await F.getDoc(F.doc(db,'proofs',`${id}_${r}_${i}`));proof=p.exists()?p.data().img:null}catch(e){}}
    drawMatch(m,proof);
  },e=>toast(e.message,'err'));
}
function person(label,p,full){
  const prof=T.players.find(x=>x.uid===p.uid)||{},wa=prof.phone?`https://wa.me/${String(prof.phone).replace(/\D/g,'')}`:'';
  const avatarHtml = prof?.avatar ? `<img src="${esc(prof.avatar)}" class="h-8 w-8 rounded-full object-cover">` : `<span class="grid h-8 w-8 place-items-center rounded-full bg-volt/20 text-volt font-bold text-xs">${esc(p.team[0].toUpperCase())}</span>`;
  return `<div class="glass rounded-2xl p-4 flex items-center gap-3"><div class="shrink-0">${avatarHtml}</div><div class="min-w-0 flex-1"><div class="text-xs uppercase tracking-wider text-slate-400 font-medium">${label}</div><div class="truncate text-base sm:text-lg font-black text-slate-100">${esc(p.team)}</div>
  ${full?`<div class="mt-2 flex gap-2">${wa?`<a href="${wa}" target="_blank" rel="noopener" class="btn btn-n !px-3 !py-1 text-xs"><i data-lucide="message-circle" class="h-3.5 w-3.5"></i>WhatsApp</a>`:''}${prof.fb?`<a href="${esc(prof.fb)}" target="_blank" rel="noopener" class="btn btn-g !px-3 !py-1 text-xs"><i data-lucide="facebook" class="h-3.5 w-3.5"></i>Facebook</a>`:''}</div>`:''}</div></div>`;
}
function drawMatch(m,proof){
  const {id,r,i}=CUR,uid=user?.uid,isA=m.a.uid===uid,isB=m.b.uid===uid,me=isA||isB,host=user&&T.hostId===uid;
  const opp=isA?m.b:m.a,st=m.status,submitter=m.submittedBy===uid;
  const age=m.roomAt?Math.floor((Date.now()-m.roomAt)/60000):null;
  let result='';
  if(st==='done')result=`<div class="rounded-2xl bg-neon/10 p-4 text-center"><div class="text-xs text-neon font-bold tracking-wider">${L('WINNER')}</div><div class="text-xl font-black text-slate-100 mt-0.5">${esc((m.winner===m.a.uid?m.a:m.b).team)}</div>${m.bye?`<div class="text-xs text-slate-300 mt-1">${L('Bye')}</div>`:`<div class="text-lg font-black text-volt mt-1">${m.sa} – ${m.sb}</div>`}</div>`;
  else if(me&&st==='pending')result=`<form id="rf" class="glass space-y-3.5 rounded-2xl p-4 sm:p-5"><h3 class="font-bold text-base text-slate-100">${L('Submit result')}</h3>
    <div class="grid grid-cols-2 gap-3"><div><label class="lbl">${L('{0} goals',esc(m.a.team))}</label><input class="inp text-center text-xl font-black text-slate-100" name="sa" type="number" min="0" max="99" required inputmode="numeric"></div>
    <div><label class="lbl">${L('{0} goals',esc(m.b.team))}</label><input class="inp text-center text-xl font-black text-slate-100" name="sb" type="number" min="0" max="99" required inputmode="numeric"></div></div>
    <div><label class="lbl">${L('Screenshot proof (required)')}</label><input class="inp file:mr-3 file:rounded-lg file:border-0 file:bg-volt file:px-3 file:py-1.5 file:text-xs file:font-bold" name="img" type="file" accept="image/*" required></div>
    <button class="btn btn-p w-full py-3 text-base font-bold" id="sub">${L('Submit for confirmation')}</button><p class="text-xs text-slate-400 leading-relaxed">${L('Your opponent must confirm before the host approves.')}</p></form>`;
  else if(st==='submitted'||st==='confirmed'||st==='disputed'){
    result=`<div class="glass space-y-3.5 rounded-2xl p-4 sm:p-5"><div class="flex items-center justify-between"><h3 class="font-bold text-base text-slate-100">${L('Submitted result')}</h3><span class="badge ${st==='disputed'?'bg-red-500/20 text-red-300':st==='confirmed'?'bg-neon/20 text-neon':'bg-gold/20 text-gold'}">${L(st)}</span></div>
    <div class="text-center text-3xl font-black text-slate-100">${esc(m.a.team)} <span class="text-volt">${m.sa} – ${m.sb}</span> ${esc(m.b.team)}</div>
    ${proof?`<img src="${proof}" alt="Result proof" class="max-h-80 w-full rounded-xl bg-black/40 object-contain shadow-md">`:''}
    ${st==='disputed'?`<p class="rounded-xl bg-red-500/10 p-3 text-xs sm:text-sm text-red-300 leading-relaxed">${L('Dispute: {0}. Waiting for the host.',esc(m.disputeReason||L('No reason given')))}</p>`:''}
    ${me&&st==='submitted'&&!submitter?`<div class="grid grid-cols-2 gap-2.5"><button data-r="confirm" class="btn btn-n py-2.5 font-bold"><i data-lucide="check" class="h-4 w-4"></i>${L('Confirm')}</button><button data-r="dispute" class="btn btn-d py-2.5 font-bold"><i data-lucide="flag" class="h-4 w-4"></i>${L('Dispute')}</button></div>`:''}
    ${me&&st==='submitted'&&submitter?`<p class="text-center text-sm text-slate-300">${L('Waiting for your opponent to confirm…')}</p>`:''}
    ${st==='confirmed'?`<p class="text-center text-sm text-slate-300">${L('Both players agree. Waiting for host approval.')}</p>`:''}</div>`;
    if(host)result+=`<div class="rounded-2xl border border-volt/40 bg-volt/5 p-4"><div class="mb-2 font-bold text-volt text-sm">${L('Host decision')}</div><div class="grid grid-cols-2 gap-2.5">
      <button data-r="win" data-w="${m.a.uid}" class="btn btn-p py-2.5 font-bold ${m.sa>m.sb?'':'btn-g'}">${L('{0} wins',esc(m.a.team))}</button><button data-r="win" data-w="${m.b.uid}" class="btn btn-p py-2.5 font-bold ${m.sb>m.sa?'':'btn-g'}">${L('{0} wins',esc(m.b.team))}</button></div></div>`;
  }else if(!me)result=`<p class="text-center text-sm text-slate-300">${L('Waiting for players to submit a result.')}</p>`;
  setView(`<div class="space-y-4 p-4"><a href="#/t/${id}" class="inline-flex items-center gap-1 text-xs text-volt font-medium"><i data-lucide="chevron-left" class="h-4 w-4"></i>${esc(T.name)}</a>
  <h1 class="text-xl sm:text-2xl font-black text-slate-100">${L('Match Room')}</h1>
  <div class="grid gap-3 sm:grid-cols-2">${me?person(L('Your opponent'),opp,true):person(L('Team A'),m.a,host)+person(L('Team B'),m.b,host)}</div>
  <div class="rounded-2xl border border-volt/40 bg-gradient-to-br from-volt/10 to-transparent p-4 sm:p-5"><div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-volt"><i data-lucide="door-open" class="h-4 w-4"></i>${L('Private room code')}</div>
   ${m.room?`<div class="mt-2 flex items-center gap-3"><div class="select-all text-3xl sm:text-4xl font-black tracking-widest text-slate-100">${esc(m.room)}</div><button data-act="copy" data-v="${esc(m.room)}" class="btn btn-g px-3 py-2"><i data-lucide="copy" class="h-4 w-4"></i></button></div>
   ${age!=null?`<p class="mt-1.5 text-xs ${age>=5?'text-red-300 font-semibold':'text-slate-300'}">${L('Shared {0} min ago',age)}${age>=5?' · '+L('may have expired, ask for a fresh code'):''}</p>`:''}`:`<p class="mt-2 text-sm text-slate-300 leading-relaxed">${L('Not created yet. Create the room in DLS, then share the code here.')}</p>`}
   ${me&&st!=='done'?`<div class="mt-3.5 flex gap-2.5"><input id="room" class="inp text-lg font-bold tracking-wider text-slate-100" maxlength="20" placeholder="${L('Enter room code')}" value="${esc(m.room)}"><button data-r="room" class="btn btn-p px-5 font-bold">${L('Save')}</button></div>`:''}
   <p class="mt-3 text-xs text-slate-400 leading-relaxed">${L('Friend-room codes expire in about 5 minutes. Create the room only when both players are ready, then share the code immediately.')}</p></div>
  ${result}</div>`);
}

document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-r]');if(!b||!CUR)return;
  const {id,r,i}=CUR,act=b.dataset.r,upd=fn=>mut(id,t=>fn(t.rounds['r'+r][i],t)).catch(x=>toast(x.message,'err'));
  if(act==='room'){const v=$('#room').value.trim();if(v)upd(m=>{m.room=v;m.roomAt=Date.now()})}
  if(act==='confirm')upd(m=>{if(m.submittedBy===user.uid)throw Error(L('Opponent must confirm'));m.status='confirmed'});
  if(act==='dispute'){const why=prompt(L('Why are you disputing this result?'));if(why)upd(m=>{m.status='disputed';m.disputeReason=why.slice(0,300)})}
  if(act==='win')upd((m,t)=>{if(t.hostId!==user.uid)throw Error(L('Host only'));const w=b.dataset.w===m.a.uid?m.a:m.b;m.winner=w.uid;m.status='done';advance(t.rounds,r,i,w);
    if(!t.rounds['r'+(r+1)]){t.status='done';t.champion={uid:w.uid,team:w.team}}});
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='rf'||!CUR)return;e.preventDefault();
  const {id,r,i}=CUR,d=new FormData(e.target),sa=+d.get('sa'),sb=+d.get('sb'),btn=$('#sub');
  if(sa===sb)return toast(L('Draws are not allowed. Play extra time/penalties.'),'err');
  btn.disabled=true;btn.textContent=L('Uploading…');
  try{
    const img=await shrink(d.get('img'));
    await F.setDoc(F.doc(db,'proofs',`${id}_${r}_${i}`),{img,by:user.uid,at:F.serverTimestamp()});
    await mut(id,t=>{const m=t.rounds['r'+r][i];if(m.status!=='pending')throw Error(L('Already submitted'));m.sa=sa;m.sb=sb;m.status='submitted';m.submittedBy=user.uid;m.proof=true});
    toast(L('Submitted. Waiting for opponent'));
  }catch(err){toast(err.message,'err');btn.disabled=false;btn.textContent=L('Submit for confirmation')}
});
function shrink(file,max=900){return new Promise((res,rej)=>{const im=new Image(),u=URL.createObjectURL(file);
  im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.6))};
  im.onerror=()=>rej(Error(L('Could not read image')));im.src=u})}

function createView(){
  if(!user){setView(`<div class="p-8 text-center"><p class="mb-4 text-slate-300 text-sm">${L('Sign in to host a tournament.')}</p><button data-act="auth" class="btn btn-p">${L('Sign in')}</button></div>`);return}
  if(!complete(profile)){setView(`<div class="p-8 text-center"><p class="mb-4 text-slate-300 text-sm">${L('Complete your profile before hosting.')}</p><a href="#/me" class="btn btn-p">${L('Go to profile')}</a></div>`);return}
  setView(`<form id="cf" class="space-y-4 p-4"><h1 class="text-2xl font-black text-slate-100">${L('Host a tournament')}</h1>
  <div><label class="lbl">${L('Tournament name')}</label><input class="inp text-slate-100" name="name" required maxlength="60" placeholder="Friday Night Cup"></div>
  <div class="grid grid-cols-2 gap-3"><div><label class="lbl">${L('Max teams')}</label><select class="inp text-slate-100" name="max"><option>4</option><option selected>8</option><option>16</option><option>32</option></select></div>
  <div><label class="lbl">${L('Entry fee (৳)')}</label><input class="inp text-slate-100" name="fee" type="number" min="0" value="0" required></div></div>
  <div><label class="lbl">${L('Start date & time')}</label><input class="inp text-slate-100" name="start" type="datetime-local" required></div>
  <div class="glass rounded-2xl p-4"><div class="mb-2 text-sm font-bold text-gold">${L('Prize pool breakdown (৳)')}</div><div class="grid grid-cols-3 gap-2">
   <div><label class="lbl">${PL(0)}</label><input class="inp text-slate-100" name="p1" type="number" min="0" value="0"></div><div><label class="lbl">${PL(1)}</label><input class="inp text-slate-100" name="p2" type="number" min="0" value="0"></div><div><label class="lbl">${PL(2)}</label><input class="inp text-slate-100" name="p3" type="number" min="0" value="0"></div></div>
   <div class="mt-3.5"><label class="lbl">${L('Management fee (% of entry fees)')}</label><input class="inp text-slate-100" name="feePct" type="number" min="0" max="30" value="10" required></div></div>
  <div><label class="lbl">${L('Payment instructions (required for paid tournaments)')}</label><textarea class="inp text-slate-100" name="payInfo" rows="2.5" placeholder="bKash 01XXXXXXXXX (Personal), Send Money"></textarea></div>
  <div><label class="lbl">${L('Rules')}</label><textarea class="inp text-slate-100 leading-relaxed" name="rules" rows="5">${L('RULES_DEFAULT')}</textarea></div>
  <label class="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-900/60 p-3.5 text-sm"><input type="checkbox" name="pledge" required class="mt-0.5 h-4 w-4 accent-cyan-500 shrink-0"><span class="text-slate-300 leading-relaxed">${L('I promise to verify payments honestly and pay all declared prizes within 24 hours of the final, posting the TrxID here.')}</span></label>
  <button class="btn btn-p w-full py-3.5 text-base font-bold" id="cb">${L('Create tournament')}</button></form>`);
  $('#cf').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    if(+d.fee>0&&!d.payInfo.trim())return toast(L('Add payment instructions for paid tournaments'),'err');
    const prizes=[+d.p1,+d.p2,+d.p3],maxNet=Math.round(+d.fee*+d.max*(1-+d.feePct/100));
    if(prizes.reduce((a,b)=>a+b,0)>maxNet&&!confirm(L('Your declared prizes are more than the maximum possible entry fees. You must pay the difference yourself. Continue?')))return;
    $('#cb').disabled=true;
    try{const ref=await F.addDoc(F.collection(db,'tournaments'),{name:d.name.trim(),rules:d.rules,fee:+d.fee,feePct:+d.feePct,prizes,payInfo:d.payInfo,max:+d.max,start:d.start,
      hostId:user.uid,hostName:profile.team,hostPhone:profile.phone,status:'open',players:[],rounds:{},payouts:{},reports:[],champion:null,createdAt:F.serverTimestamp()});
      toast(L('Tournament created'));location.hash='#/t/'+ref.id}catch(err){toast(err.message,'err');$('#cb').disabled=false}};
}

function profileView(){
  if(!user){setView(`<div class="p-8 text-center"><p class="mb-4 text-slate-300 text-sm">${L('Sign in to manage your profile.')}</p><button data-act="auth" class="btn btn-p">${L('Sign in')}</button></div>`);return}
  const p=profile||{};
  setView(`<div class="space-y-6 p-4"><form id="pf" class="space-y-4"><h1 class="text-2xl font-black text-slate-100">${L('Your profile')}</h1><p class="text-xs sm:text-sm text-slate-300">${esc(user.email||'')} · ${L('shown to your opponents inside match rooms.')}</p>
  <div><label class="lbl">${L('DLS team name')}</label><input class="inp text-slate-100" name="team" required maxlength="30" value="${esc(p.team)}"></div>
  <div><label class="lbl">প্রোফাইল পিকচার লিংক (Avatar Image URL)</label><input class="inp text-slate-100" name="avatar" type="url" placeholder="https://imgur.com/... বা ছবির সরাসরি লিংক" value="${esc(p.avatar)}"></div>
  <div><label class="lbl">${L('WhatsApp / phone (with country code)')}</label><input class="inp text-slate-100" name="phone" required type="tel" placeholder="8801XXXXXXXXX" value="${esc(p.phone)}"></div>
  <div><label class="lbl">${L('Facebook profile link')}</label><input class="inp text-slate-100" name="fb" type="url" placeholder="https://facebook.com/…" value="${esc(p.fb)}"></div>
  <button class="btn btn-p w-full py-3 font-bold">${L('Save profile')}</button><button type="button" data-act="logout" class="btn btn-g w-full py-3 text-red-400 font-semibold"><i data-lucide="log-out" class="h-4 w-4"></i>${L('Sign out')}</button></form>
  <section id="mine" class="space-y-4"></section></div>`);
  $('#pf').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    try{await F.setDoc(F.doc(db,'users',user.uid),d,{merge:true});profile={...profile,...d};header();toast(L('Profile saved'))}catch(err){toast(err.message,'err')}};
  F.getDocs(F.collection(db,'tournaments')).then(s=>{
    const ts=s.docs.map(d=>({id:d.id,...d.data()})),hosted=ts.filter(t=>t.hostId===user.uid),joined=ts.filter(t=>(t.players||[]).some(x=>x.uid===user.uid));
    const row=t=>{const [bl,bc]=statusBadge(t.status);return `<a href="#/t/${t.id}" class="glass flex items-center justify-between gap-2 rounded-xl p-3.5 text-sm hover:bg-white/[0.05]"><span class="truncate font-semibold text-slate-100">${esc(t.name)}</span><span class="badge ${bc}">${bl}</span></a>`};
    const sec=(h,l)=>l.length?`<div><h2 class="mb-2.5 font-bold text-base text-slate-100">${L(h)}</h2><div class="space-y-2">${l.map(row).join('')}</div></div>`:'';
    const el=$('#mine');if(el)el.innerHTML=`<div class="space-y-4">${sec('Joined by me',joined)}${sec('Hosted by me',hosted)}</div>`;
  }).catch(()=>{});
}
