import * as F from './firebase.js';
import {$,esc,money,icons,skeleton,toast,modal} from './ui.js';
import {build,advance,renderBracket} from './bracket.js';

const {auth,db}=F,app=$('#app');
let user=null,profile=null,unsub=null,T=null,CUR=null,HS={},S={tab:'open',list:[],q:''};

const PLEDGE=['আমি কোনো ম্যাচ ফিক্সিং, বিক্রি বা ইচ্ছাকৃত হারব না।','কোনো মোড, চিট বা ফেক অ্যাকাউন্ট ব্যবহার করব না।','আমি জানি যেকোনো রেজাল্টে অপোনেন্টের কনফার্মেশন লাগবে এবং ফিক্সিং প্রমাণিত হলে হোস্ট ডিসকোয়ালিফাই করতে পারবে।','আমি টুর্নামেন্ট ও প্রাইজের নিয়ম ভালো করে পড়েছি।'];
const PAYPLEDGE='আমি সত্যিসত্যি এন্ট্রি ফি পাঠিয়েছি এবং যে ট্রানজেকশন আইডি (TrxID) দিয়েছি তা সঠিক।';
const STEPS=[['user-round','প্রোফাইল তৈরি করুন','আপনার টিম নাম, ছবি এবং হোয়াটসঅ্যাপ নম্বর দিন। এক মিনিটও লাগবে না।'],['wallet','জয়েন করুন ও ফি দিন','হোস্টকে এন্ট্রি ফি পাঠিয়ে ট্রানজেকশন আইডি (TrxID) দিন। হোস্ট এটি যাচাই করবে।'],['gamepad-2','ম্যাচ খেলুন ও কনফার্ম করুন','রুম কোড শেয়ার করুন, ম্যাচ খেলুন, স্ক্রিনশট দিন। অপোনেন্ট স্কোর কনফার্ম করবে।'],['trophy','পুরস্কার বুঝে নিন','হোস্ট প্রাইজমানি দিয়ে TrxID দেবেন। বিজয়ী দল টাকা পাওয়ার কথা কনফার্ম করবে।']];
const SAFE=['টাকা পাঠানোর আগে হোস্টের ট্র্যাক রেকর্ড বা পূর্বের ইতিহাস যাচাই করুন।','শুধুমাত্র টুর্নামেন্ট পেজে দেওয়া অফিশিয়াল নম্বরে টাকা পাঠান।','অপরিচিত কোনো লিংক বা ইনবক্সে মেসেজ দেওয়া ব্যক্তির কথায় টাকা পাঠাবেন না।','যে হোস্ট পুরস্কার দেয় না তাকে রিপোর্ট করুন।'];
const FAQ=[['আমার পেমেন্ট এখনো ভেরিফাই হয়নি, এখন কী করব?','হোস্ট ম্যানুয়ালি প্রতিটি TrxID চেক করেন। দেরি হলে হোস্টকে হোয়াটসঅ্যাপে মেসেজ দিন। আপনার স্লট পেন্ডিং থাকবে।'],['হোস্ট যদি পুরস্কারের টাকা না দেয়?','বিজয়ী দল "টাকা পাইনি" সিলেক্ট করবে এবং তা প্ল্যাটফর্মে রিপোর্ট হিসেবে জমা হবে।'],['আমার রুম কোডের মেয়াদ শেষ হয়ে গেছে, কী করব?','ডিএলএস ফ্রেন্ডলি রুম কোডের মেয়াদ ৫ মিনিট থাকে। নতুন রুম খুলে ফ্রেশ কোড ম্যাচ রুমে সেভ করুন।'],['সাইট কি কোনো কমিশন বা ফি কেটে রাখে?','না, প্ল্যাটফর্ম ওনার কোনো ফি কাটে না। হোস্ট সাবস্ক্রিপশন কিনে স্বাধীনভাবে নিজের ফি ম্যানেজ করতে পারেন।']];

const tref=id=>F.doc(db,'tournaments',id);
const prizeTotal=t=>(t.prizes||[]).reduce((a,b)=>a+(+b||0),0);
const complete=p=>p&&p.team&&p.phone&&p.avatar;
const isPaid=p=>p.paid!==false;
const paidN=t=>(t.players||[]).filter(isPaid).length;
const statusBadge=s=>({open:['আসন্ন','bg-volt/15 text-volt'],live:['লাইভ','bg-neon/15 text-neon'],done:['সম্পন্ন','bg-gold/15 text-gold']}[s]||['?','']);
const PL=i=>['🥇','🥈','🥉'][i]+' '+['১ম','২য়','৩য়'][i];
const fdate=s=>s?new Date(s).toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short'}):'নির্ধারিত নয়';
const fmtDur=ms=>{const m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60);return d?`${d}দ ${h}ঘণ্টা`:h?`${h}ঘণ্টা ${m%60}মি:`:`${m}মি`};
const countdown=s=>{if(!s)return '';const ms=new Date(s)-Date.now();return isNaN(ms)?'':ms<=0?'শীঘ্রই শুরু হচ্ছে':`শুরু হবে ${fmtDur(ms)} এ`;};
const mut=(id,fn)=>F.runTransaction(db,async tx=>{
  const s=await tx.get(tref(id));if(!s.exists())throw Error('টুর্নামেন্ট পাওয়া যায়নি');
  const t=s.data();t.players=t.players||[];t.rounds=t.rounds||{};t.payouts=t.payouts||{};t.reports=t.reports||[];fn(t);
  tx.update(tref(id),{players:t.players,rounds:t.rounds,status:t.status,champion:t.champion||null,payouts:t.payouts,reports:t.reports});
});
const run=async(fn,ok)=>{try{await mut(T.id,fn);HS={};if(ok)toast(ok);return true}catch(e){toast(e.message,'err');return false}};
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
  const [cls,ic,tt]=bad?['border-red-500/40 bg-red-500/10 text-red-300','shield-alert','সতর্কতা: এই হোস্টের বিরুদ্ধে অভিযোগ আছে!']:good?['border-neon/40 bg-neon/10 text-neon','shield-check','বিশ্বস্ত হোস্ট (ট্র্যাক রেকর্ড ভালো)']:['border-gold/40 bg-gold/10 text-gold','info','নতুন হোস্ট'];
  return `<div class="rounded-2xl border p-3.5 text-sm ${cls}"><div class="flex items-center gap-2 font-bold"><i data-lucide="${ic}" class="h-4 w-4"></i>${tt}</div>
  <p class="mt-1 text-xs text-slate-200 leading-relaxed">${r.done}টি টুর্নামেন্ট সম্পন্ন · ${r.conf}/${r.paid} প্রাইজ কনফার্মড · ${r.rep}টি অভিযোগ</p>
  ${link?`<a href="#/h/${link}" class="mt-1.5 inline-block text-xs text-volt underline font-semibold">হোস্টের প্রোফাইল দেখুন</a>`:''}</div>`;
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
  const u=user?`<a href="#/me" class="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-xs font-semibold"><span class="flex items-center justify-center">${avatarHtml}</span><span class="max-w-[7rem] truncate">${esc(profile?.team||'প্রোফাইল')}</span></a>`
    :`<button data-act="auth" class="btn btn-p !py-1.5">প্রবেশ করুন</button>`;
  $('#hdr').innerHTML=`<div class="flex items-center gap-2">${u}</div>`;
}
function nav(){
  const it=[['','home','হোম','#/'],['new','plus-circle','হোস্ট','#/new'],['lb','crown','র‌্যাঙ্কিং','#/lb'],['me','user-round','প্রোফাইল','#/me']];
  $('#nav').innerHTML=`<div class="mx-auto grid max-w-3xl grid-cols-4">${it.map(([k,i,l,h])=>`<a href="${h}" data-nav="${k}" class="flex flex-col items-center gap-1 py-2 text-xs font-medium text-slate-300 transition ${k==='new'?'text-volt font-bold':''}"><i data-lucide="${i}" class="h-5 w-5"></i>${l}</a>`).join('')}</div>`;
  icons();
}
function authModal(){
  let mode='in';
  const m=modal(`<h3 class="mb-1 text-lg font-bold">ডিএলএস টুর্নামেন্ট হাবে স্বাগতম</h3><p class="mb-4 text-sm text-slate-300">টুর্নামেন্টে যোগ দিতে এবং হোস্ট করতে প্রবেশ করুন।</p>
  <button id="g" class="btn btn-g mb-3 w-full"><i data-lucide="chrome" class="h-4 w-4"></i>গুগল (Google) দিয়ে চালিয়ে যান</button>
  <div class="my-3 flex items-center gap-3 text-xs text-slate-400"><span class="h-px flex-1 bg-white/10"></span>অথবা<span class="h-px flex-1 bg-white/10"></span></div>
  <form id="f" class="space-y-3"><input class="inp" name="email" type="email" placeholder="ইমেইল" required autocomplete="email"><input class="inp" name="password" type="password" placeholder="পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)" minlength="6" required autocomplete="current-password">
  <button class="btn btn-p w-full" id="go">প্রবেশ করুন</button></form>
  <button id="sw" class="mt-3 w-full text-center text-xs text-volt font-semibold">নতুন একাউন্ট খুলতে চান? রেজিস্টার করুন</button>`);
  m.$('#g').onclick=async()=>{try{await F.signInWithPopup(auth,new F.GoogleAuthProvider());m.close()}catch(e){toast(e.message,'err')}};
  m.$('#sw').onclick=()=>{mode=mode==='in'?'up':'in';m.$('#go').textContent=mode==='in'?'প্রবেশ করুন':'একাউন্ট তৈরি করুন';m.$('#sw').textContent=mode==='in'?'নতুন একাউন্ট খুলতে চান? রেজিস্টার করুন':'আগে থেকেই একাউন্ট আছে? প্রবেশ করুন'};
  m.$('#f').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    try{await(mode==='in'?F.signInWithEmailAndPassword:F.createUserWithEmailAndPassword)(auth,d.email,d.password);m.close()}catch(err){toast(err.message.replace('Firebase: ',''),'err')}};
}

function route(){
  if(unsub){unsub();unsub=null}
  if(!F.configured)return setView(`<div class="m-4 glass rounded-2xl p-5"><h2 class="font-bold text-gold">ফায়ারবেজ কনফিগার করা হয়নি</h2><p class="mt-2 text-sm text-slate-200">js/firebase.js ফাইল খুলে ফায়ারবেজ কনফিগারেশন দিন।</p></div>`);
  const [,p,a,b,c]=location.hash.split('/');
  document.querySelectorAll('[data-nav]').forEach(n=>{const on=n.dataset.nav===(p||'');n.classList.toggle('text-volt',on);n.classList.toggle('font-bold',on);n.classList.toggle('text-slate-300',!on)});
  setView(skeleton());window.scrollTo(0,0);
  if(p==='t')return tourney(a);
  if(p==='m')return matchView(a,+b,+c);
  if(p==='h')return hostView(a);
  if(p==='u')return publicProfileView(a);
  if(p==='new')return createView();
  if(p==='me')return profileView();
  if(p==='admin')return adminReportsView();
  if(p==='lb')return listen(drawLb);
  listen(drawFeed);
}
addEventListener('hashchange',route);
nav();

function drawFeed(){
  const all=S.list,nTeams=all.reduce((a,t)=>a+paidN(t),0),pool=all.reduce((a,t)=>a+prizeTotal(t),0);
  const tabs=[['live','লাইভ','zap'],['open','আসন্ন','calendar-clock'],['done','সম্পন্ন','medal']];
  setView(`<div class="space-y-6 p-4">
  <section class="glass relative overflow-hidden rounded-3xl p-5 sm:p-6 shadow-xl">
    <div class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-volt/20 blur-3xl"></div>
    <span class="badge bg-neon/15 text-neon mb-2"><i data-lucide="shield-check" class="h-3.5 w-3.5"></i>ফেয়ার প্লে · ভেরিফাইড পেমেন্ট</span>
    <h1 class="mt-2 text-3xl font-black leading-tight tracking-tight">DLS <span class="text-volt">Tournament Hub</span></h1>
    <p class="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">বাংলাদেশি ডিএলএস (DLS) খেলোয়াড়দের সেরা টুর্নামেন্ট প্ল্যাটফর্ম। খেলুন আর জিতুন আকর্ষণীয় প্রাইজ।</p>
    <div class="mt-4 flex gap-3"><a href="#/new" class="btn btn-p flex-1"><i data-lucide="plus-circle" class="h-4 w-4"></i>টুর্নামেন্ট হোস্ট করুন</a><button data-act="goList" class="btn btn-g flex-1"><i data-lucide="swords" class="h-4 w-4"></i>সব টুর্নামেন্ট দেখুন</button></div>
    <div class="mt-5 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
      <div class="rounded-xl bg-slate-900/60 py-3"><div class="text-lg sm:text-xl font-extrabold text-volt">${all.length}</div><span class="text-slate-300">টুর্নামেন্ট</span></div>
      <div class="rounded-xl bg-slate-900/60 py-3"><div class="text-lg sm:text-xl font-extrabold text-neon">${nTeams}</div><span class="text-slate-300">যুক্ত টিম</span></div>
      <div class="rounded-xl bg-slate-900/60 py-3"><div class="text-lg sm:text-xl font-extrabold text-gold">${money(pool)}</div><span class="text-slate-300">মোট প্রাইজপুল</span></div></div>
  </section>
  <section id="lst"><h2 class="mb-3 text-xl font-bold">টুর্নামেন্টসমূহ</h2>
    <div class="relative"><i data-lucide="search" class="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400"></i><input id="q" class="inp !pl-10 text-base" placeholder="টুর্নামেন্ট বা হোস্টের নাম খুঁজুন" value="${esc(S.q)}"></div>
    <div class="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-slate-900/70 p-1">${tabs.map(([k,l,i])=>`<button data-act="tab" data-k="${k}" class="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition ${S.tab===k?'bg-volt text-ink shadow':'text-slate-300'}"><i data-lucide="${i}" class="h-4 w-4"></i>${l} <span class="opacity-70 text-xs">(${all.filter(t=>t.status===k).length})</span></button>`).join('')}</div>
    <div id="fl" class="mt-4 space-y-3"></div></section>
  <section><h2 class="mb-3 text-xl font-bold">এটি যেভাবে কাজ করে</h2><div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${STEPS.map(([ic,h,d],i)=>`<div class="glass rounded-2xl p-4"><div class="mb-2 flex items-center gap-2.5"><span class="grid h-9 w-9 place-items-center rounded-xl bg-volt/15 text-volt"><i data-lucide="${ic}" class="h-5 w-5"></i></span><span class="text-sm font-bold text-volt">ধাপ ${i+1}</span></div><div class="text-base font-bold text-slate-100">${h}</div><p class="mt-1 text-sm text-slate-300 leading-relaxed">${d}</p></div>`).join('')}</div></section>
  <section class="rounded-2xl border border-gold/40 bg-gold/5 p-4 sm:p-5"><div class="mb-2.5 flex items-center gap-2 font-bold text-gold text-base"><i data-lucide="shield-alert" class="h-5 w-5"></i>নিরাপত্তা ও সতর্কতা</div><ul class="space-y-2 text-sm text-slate-200 leading-relaxed">${SAFE.map(s=>`<li class="flex gap-2.5"><span class="text-gold font-bold">•</span><span>${s}</span></li>`).join('')}</ul></section>
  <section><h2 class="mb-3 text-xl font-bold">সাধারণ জিজ্ঞাসা</h2><div class="space-y-2.5">${FAQ.map(([q,a])=>`<details class="glass rounded-xl p-4 text-sm"><summary class="cursor-pointer font-bold text-slate-200 text-base">${q}</summary><p class="mt-2.5 text-slate-300 leading-relaxed">${a}</p></details>`).join('')}</div></section>
  <footer class="pb-4 text-center text-xs text-slate-400 leading-relaxed">© DLS Tournament Hub<br>ফার্স্ট টাচ গেমস বা ডিএলএস (DLS)-এর সাথে অফিশিয়ালি সম্পর্কিত নয়।</footer></div>`);
  drawList();
}
function drawList(){
  const q=S.q.trim().toLowerCase(),list=S.list.filter(t=>t.status===S.tab&&(!q||(t.name+' '+t.hostName).toLowerCase().includes(q)));
  const el=$('#fl');if(!el)return;
  el.innerHTML=list.map(t=>card(t)).join('')||`<div class="glass rounded-2xl p-8 text-center text-sm text-slate-300"><i data-lucide="ghost" class="mx-auto mb-2 h-8 w-8 text-slate-400"></i>এখানে এখনো কোনো তথ্য নেই।</div>`;
  icons();
}
function card(t,pool=S.list){
  const [bl,bc]=statusBadge(t.status),n=(t.players||[]).length,cd=t.status==='open'?countdown(t.start):'';
  const hd=pool.filter(x=>x.hostId===t.hostId&&x.status==='done').length;
  const hb=hd>0?`<span class="text-neon font-medium">✔ ${hd}টি সফলভাবে সম্পন্ন</span>`:`<span class="text-gold font-medium">নতুন হোস্ট</span>`;
  return `<a href="#/t/${t.id}" class="glass block rounded-2xl p-4 sm:p-5 transition hover:border-volt/40 active:scale-[.99]">
  <div class="flex items-start justify-between gap-2"><h3 class="text-base sm:text-lg font-bold leading-snug text-slate-100">${esc(t.name)}</h3><span class="badge ${bc}">${bl}</span></div>
  <p class="mt-1.5 text-xs sm:text-sm text-slate-300">পরিচালনায় <strong class="text-slate-200">${esc(t.hostName)}</strong> · ${hb} · ${fdate(t.start)}</p>
  ${cd?`<p class="mt-1.5 flex items-center gap-1.5 text-xs text-volt font-medium"><i data-lucide="clock" class="h-3.5 w-3.5"></i>${cd}</p>`:''}
  <div class="mt-3.5 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
    <div class="rounded-xl bg-slate-900/60 py-2.5"><div class="font-extrabold text-gold text-sm sm:text-base">${money(prizeTotal(t))}</div><span class="text-slate-400 text-xs">পুরস্কার</span></div>
    <div class="rounded-xl bg-slate-900/60 py-2.5"><div class="font-extrabold text-slate-200 text-sm sm:text-base">${t.fee>0?money(t.fee):'ফ্রি'}</div><span class="text-slate-400 text-xs">এন্ট্রি ফি</span></div>
    <div class="rounded-xl bg-slate-900/60 py-2.5"><div class="font-extrabold text-neon text-sm sm:text-base">${n}/${t.max}</div><span class="text-slate-400 text-xs">দলসমূহ</span></div></div></a>`;
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
  setView(`<div class="space-y-4 p-4"><div><h1 class="text-2xl font-black">র‌্যাঙ্কিং</h1><p class="text-sm text-slate-300 mt-1">চ্যাম্পিয়নশিপ এবং ম্যাচ জয়ের ওপর ভিত্তি করে সেরা দলগুলোর তালিকা।</p></div>
  ${rows.length?`<div class="glass overflow-hidden rounded-2xl"><div class="grid grid-cols-[2rem_1fr_3rem_3rem_5rem] gap-2 border-b border-white/10 px-3 py-3 text-xs font-bold uppercase text-slate-400"><span>#</span><span>টিম</span><span class="text-center">🏆</span><span class="text-center">জয়</span><span class="text-right">অর্জিত পুরস্কার</span></div>
  ${rows.map((r,i)=>`<div class="grid grid-cols-[2rem_1fr_3rem_3rem_5rem] items-center gap-2 px-3 py-3 text-sm ${i%2?'bg-white/[.03]':''}"><span class="font-bold ${i<3?'text-gold':'text-slate-400'}">${i+1}</span><a href="#/u/${r.uid}" class="truncate font-semibold text-slate-100 hover:text-volt">${esc(r.team)}</a><span class="text-center font-bold text-gold">${r.c}</span><span class="text-center font-medium">${r.w}</span><span class="text-right font-bold text-xs text-neon">${money(r.prize)}</span></div>`).join('')}</div>`
  :`<div class="glass rounded-2xl p-8 text-center text-sm text-slate-300"><i data-lucide="crown" class="mx-auto mb-2 h-8 w-8 text-slate-400"></i>এখনো কোনো র‍্যাঙ্কিং নেই। টুর্নামেন্ট শেষ হলে এখানে দেখতে পাবেন।</div>`}</div>`);
}

function tourney(id){
  unsub=F.onSnapshot(tref(id),s=>{if(!s.exists())return setView(`<p class="p-8 text-center text-slate-300">টুর্নামেন্ট পাওয়া যায়নি</p>`);T={id,...s.data()};T.players=T.players||[];drawT()},e=>toast(e.message,'err'));
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
  
  // প্রাইজ পুল breakdown এবং হোস্ট ফি ডাইনামিক রেন্ডারিং
  const totalPool = prizeTotal(t);
  const prizes = t.prizes || [0, 0, 0];
  const hostPct = t.feePct || 0;
  const grossCollection = (t.max || 0) * (t.fee || 0);
  const hostFeeAmount = Math.round((grossCollection * hostPct) / 100);

  const prizeBreakdownHtml = (totalPool > 0 || grossCollection > 0) ? `
    <div class="rounded-2xl border border-gold/40 bg-gold/5 p-4 sm:p-5 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 font-bold text-gold text-base"><i data-lucide="trophy" class="h-5 w-5"></i>পুরস্কার ও ফি ব্রেকডাউন</div>
        ${hostPct > 0 ? `<span class="badge bg-volt/15 text-volt text-xs">হোস্ট ফি: ${hostPct}% (${money(hostFeeAmount)})</span>` : `<span class="badge bg-neon/15 text-neon text-xs">০% হোস্ট ফি</span>`}
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div class="rounded-xl bg-slate-900/60 p-2.5 text-center"><div class="text-xs text-slate-400">মোট প্লেয়ার প্রাইজ</div><div class="font-extrabold text-gold text-base mt-0.5">${money(totalPool)}</div></div>
        <div class="rounded-xl bg-slate-900/60 p-2.5 text-center"><div class="text-xs text-slate-400">🥇 ১ম স্থান</div><div class="font-extrabold text-slate-100 text-base mt-0.5">${money(prizes[0]||0)}</div></div>
        <div class="rounded-xl bg-slate-900/60 p-2.5 text-center"><div class="text-xs text-slate-400">🥈 ২য় স্থান</div><div class="font-extrabold text-slate-100 text-base mt-0.5">${money(prizes[1]||0)}</div></div>
        <div class="rounded-xl bg-slate-900/60 p-2.5 text-center"><div class="text-xs text-slate-400">🥉 ৩য় স্থান</div><div class="font-extrabold text-slate-100 text-base mt-0.5">${money(prizes[2]||0)}</div></div>
      </div>
    </div>` : '';

  const payRow=i=>{const po=pays[i];return `<div class="rounded-xl bg-slate-900/60 p-3.5 text-sm"><div class="flex items-center justify-between gap-2"><strong class="text-slate-100">${PL(i)} · ${money(t.prizes[i])}</strong>
    <span class="badge ${po?(po.ok===true?'bg-neon/20 text-neon':po.ok===false?'bg-red-500/20 text-red-300':'bg-gold/20 text-gold'):'bg-white/10 text-slate-300'}">${po?(po.ok===true?'টাকা পেয়েছি':po.ok===false?'পাইনি':'পাঠানো হয়েছে · কনফার্মেশনের অপেক্ষা'):'এখনো দেওয়া হয়নি'}</span></div>
    ${po?`<div class="mt-1.5 text-xs text-slate-300">${esc(po.team)} · TrxID <b class="select-all text-slate-100">${esc(po.trx)}</b></div>`:''}
    ${po&&uid===po.uid&&po.ok==null?`<div class="mt-2.5 grid grid-cols-2 gap-2"><button data-act="pconf" data-p="${i}" data-v="1" class="btn btn-n !py-2">হ্যাঁ, আমি পেয়েছি</button><button data-act="pconf" data-p="${i}" data-v="0" class="btn btn-d !py-2">পাইনি</button></div>`:''}
    ${host&&pc[i].length&&(!po||po.ok!==true)?`<button data-act="payout" data-p="${i}" class="btn btn-g mt-2.5 w-full !py-2">${po?'পেমেন্ট রেকর্ড পরিবর্তন করুন':'পেমেন্ট রেকর্ড করুন'}</button>`:''}</div>`};
  
  const canDelete = t.status === 'open' && t.players.length === 0;

  setView(`<div class="space-y-4 p-4">
  <div><div class="flex items-center justify-between"><span class="badge ${bc}">${bl}</span><div class="flex gap-2"><button data-act="share" class="btn btn-g !px-3 !py-1.5 text-xs"><i data-lucide="share-2" class="h-3.5 w-3.5"></i>শেয়ার করুন</button></div></div>
  <h1 class="mt-2 text-2xl sm:text-3xl font-black leading-tight text-slate-100">${esc(t.name)}</h1>
  <p class="mt-1 text-xs sm:text-sm text-slate-300">পরিচালনায় <strong class="text-slate-200">${esc(t.hostName)}</strong> · ${fdate(t.start)}${t.status==='open'&&countdown(t.start)?' · '+countdown(t.start):''}</p></div>
  ${t.champion?`<div class="rounded-2xl bg-gradient-to-r from-gold/30 to-gold/5 p-4 text-center shadow-lg"><i data-lucide="crown" class="mx-auto h-8 w-8 text-gold"></i><div class="text-xs text-gold font-bold tracking-wider mt-1">চ্যাম্পিয়ন দল</div><div class="text-xl font-black text-slate-100 mt-0.5">${esc(t.champion.team)}</div></div>`:''}
  <div><div id="hs" class="h-20 animate-pulse rounded-2xl bg-slate-800/60"></div>
  <div class="mt-1.5 flex justify-end gap-3 text-xs">${user&&t.hostPhone?`<a target="_blank" rel="noopener" href="https://wa.me/${String(t.hostPhone).replace(/\D/g,'')}" class="text-neon underline font-medium">হোস্টের সাথে যোগাযোগ</a>`:''}${!host?`<button data-act="report" class="text-red-400 underline font-medium">হোস্ট / টুর্নামেন্ট রিপোর্ট করুন</button>`:''}</div></div>
  
  ${prizeBreakdownHtml}

  <div class="flex flex-wrap gap-2">
  ${t.status==='open'&&!me&&!full?`<button data-act="join" class="btn btn-n flex-1 py-3 text-base font-bold"><i data-lucide="log-in" class="h-4 w-4"></i>যুক্ত হোন · ${t.fee>0?money(t.fee):'ফ্রি'}</button>`:''}
  ${me&&t.status==='open'?(isPaid(me)?`<div class="btn btn-g flex-1 !text-neon py-3 text-sm font-bold"><i data-lucide="check-circle-2" class="h-4 w-4"></i>আপনি যুক্ত আছেন</div>`:`<div class="btn btn-g flex-1 !text-gold py-3 text-sm font-bold"><i data-lucide="clock" class="h-4 w-4"></i>পেমেন্ট যাচাইয়ের অপেক্ষায়</div>`):''}
  ${mine?`<a href="#/m/${t.id}/${mine.r}/${mine.i}" class="btn btn-p flex-1 py-3 text-base font-bold"><i data-lucide="gamepad-2" class="h-4 w-4"></i>ম্যাচ রুম খুলুন</a>`:''}
  <button data-act="guide" class="btn btn-g py-3"><i data-lucide="scale" class="h-4 w-4"></i>নিয়মাবলী</button></div>
  ${me&&t.fee>0&&t.payInfo&&!isPaid(me)?`<div class="glass rounded-2xl p-4 text-sm space-y-1.5"><b class="text-volt font-bold">পেমেন্ট করার নিয়ম</b><p class="whitespace-pre-line text-slate-200 leading-relaxed">${esc(t.payInfo)}</p></div>`:''}
  ${host?`<section class="glass space-y-3.5 rounded-2xl p-4 sm:p-5"><div class="flex items-center justify-between"><div class="flex items-center gap-2 font-bold text-base text-slate-100"><i data-lucide="shield" class="h-5 w-5 text-volt"></i>হোস্ট কন্ট্রোল প্যানেল</div>
   ${canDelete?`<button data-act="delT" class="btn btn-d !py-1.5 !px-3 text-xs font-bold"><i data-lucide="trash-2" class="h-3.5 w-3.5"></i>টুর্নামেন্ট ডিলিট করুন</button>`:`<span class="text-[11px] text-slate-400" title="কেউ জয়েন করলে ডিলিট করা যাবে না">🔒 ডিলিট লকড</span>`}</div>
   ${pend.length?`<div><div class="mb-2 text-xs font-bold text-slate-300">পেমেন্ট যাচাই করুন (${pend.length})</div><div class="space-y-2.5">${pend.map(p=>`<div class="rounded-xl bg-slate-900/60 p-3.5 text-sm"><div class="flex items-center justify-between gap-2"><strong class="text-slate-100">${esc(p.team)}</strong><span class="text-xs text-slate-300 font-medium">${esc(p.method)} · ${esc(p.sender)}</span></div><div class="mt-1.5 text-xs text-slate-300">TrxID: <b class="select-all text-slate-100 font-bold">${esc(p.trx)}</b></div><div class="mt-3 grid grid-cols-2 gap-2"><button data-act="verify" data-u="${p.uid}" class="btn btn-n !py-2">পেমেন্ট পেয়েছি (Verify)</button><button data-act="reject" data-u="${p.uid}" class="btn btn-d !py-2">বাতিল করুন</button></div></div>`).join('')}</div><p class="mt-2 text-xs text-slate-400 leading-relaxed">ভেরিফাই করার আগে আপনার বিকাশ/নগদ অ্যাপে ট্রানজেকশন আইডি (TrxID) মিলিয়ে নিন।</p></div>`:''}
   ${t.status==='open'?`<button data-act="start" class="btn btn-p w-full py-3 text-base font-bold" ${n<2?'disabled':''}>ব্র্যাকেট তৈরি করে শুরু করুন (${n}টি টিম)</button>`:''}
   ${review.length?`<div class="space-y-2"><div class="text-xs font-bold text-slate-300">আপনার যাচাই প্রয়োজন</div>${review.map(x=>`<a href="#/m/${t.id}/${x.r}/${x.i}" class="flex items-center justify-between rounded-xl bg-slate-900/60 p-3 text-sm hover:bg-white/[0.05]"><span>${esc(x.m.a.team)} vs ${esc(x.m.b.team)}</span><span class="badge ${x.m.status==='disputed'?'bg-red-500/20 text-red-300':x.m.status==='confirmed'?'bg-neon/20 text-neon':'bg-gold/20 text-gold'}">${x.m.status}</span></a>`).join('')}</div>`:(t.status==='live'?`<p class="text-sm text-slate-300">যাচাই করার মতো কোনো ম্যাচ রেজাল্ট নেই।</p>`:'')}</section>`:''}
  ${t.status==='done'&&payPlaces.length?`<section><h2 class="mb-1 text-lg font-bold text-slate-100">পুরস্কার প্রদান স্ট্যাটাস</h2><p class="mb-3 text-xs text-slate-300 leading-relaxed">ফাইনাল খেলার ২৪ ঘণ্টার মধ্যে হোস্ট প্রাইজমানি পাঠিয়ে এখানে ট্রানজেকশন আইডি দেবেন।</p><div class="space-y-2.5">${payPlaces.map(payRow).join('')}</div></section>`:''}
  ${t.rounds&&Object.keys(t.rounds).length?`<section><h2 class="mb-3 text-lg font-bold text-slate-100">টুর্নামেন্ট ব্র্যাকেট (ফিক্সচার)</h2>${renderBracket(t,user?.uid)}</section>`:''}
  <section><h2 class="mb-3 text-lg font-bold text-slate-100">দলসমূহ (${t.players.length}/${t.max})</h2><div class="grid gap-2.5 sm:grid-cols-2">${t.players.map((p,i)=>`<a href="#/u/${p.uid}" class="glass flex items-center gap-3 rounded-xl p-3 text-sm hover:border-volt/40 transition"><span class="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-xs font-bold text-slate-200">${i+1}</span><img src="${esc(p.avatar||'https://via.placeholder.com/40')}" class="h-7 w-7 rounded-full object-cover"><span class="flex-1 truncate font-semibold text-slate-100">${esc(p.team)}</span>${isPaid(p)?'':`<span class="badge bg-gold/15 text-gold">অপেক্ষমাণ</span>`}</a>`).join('')||`<p class="text-sm text-slate-300">এখানে এখনো কোনো তথ্য নেই।</p>`}</div></section>
  <section class="glass rounded-2xl p-4 sm:p-5"><h2 class="mb-2 text-lg font-bold text-slate-100">টুর্নামেন্টের সাধারণ নিয়ম</h2><p class="whitespace-pre-line text-sm text-slate-300 leading-relaxed">${esc(t.rules)}</p></section></div>`);
  fillHost();
}

const actions={
  auth:authModal,
  tab:d=>{S.tab=d.k;const y=scrollY;drawFeed();scrollTo(0,y)},
  goList(){$('#lst')?.scrollIntoView({behavior:'smooth'})},
  copy(d){navigator.clipboard?.writeText(d.v).then(()=>toast('কপি করা হয়েছে!'))},
  share(){const u=location.href,txt=`${T.name} · DLS Tournament Hub\n${u}`;if(navigator.share)navigator.share({title:T.name,text:txt,url:u}).catch(()=>{});else window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank')},
  guide(){modal(`<h3 class="mb-3 flex items-center gap-2 text-lg font-bold text-slate-100"><i data-lucide="scale" class="h-5 w-5 text-volt"></i>ম্যাচ ফিক্সিং প্রতিরোধ গাইডলাইন</h3><ul class="space-y-2.5 text-sm text-slate-300 leading-relaxed">
   <li>✅ জয়ী খেলোয়াড় স্কোর ও স্ক্রিনশট সাবমিট করবে। প্রতিপক্ষ তা কনফার্ম বা ডিসপিউট করবে।</li><li>✅ পরবর্তী রাউন্ডে যাওয়ার আগে হোস্ট প্রতিটি রেজাল্ট যাচাই করবেন।</li>
   <li>✅ হোস্ট TrxID চেক করে পেমেন্ট কনফার্ম করার পরেই কেবল টিম লিস্টে যুক্ত হবে।</li>
   <li>🚫 ম্যাচ ফিক্সিং, ইচ্ছাকৃত হার বা দুর্নীতি প্রমাণিত হলে চিরতরে ব্যান ও পুরস্কার বাজেয়াপ্ত করা হবে।</li><li>🚫 ফেক আইডি বা একাধিক একাউন্ট ব্যবহার করলে ডিসকোয়ালিফাই করা হবে।</li>
   <li>🔎 কোনো বিতর্ক দেখা দিলে উভয়পক্ষকে ফুল ম্যাচ রেকর্ডিং বা স্ক্রিনরেকর্ড দিতে বলা হতে পারে।</li></ul>`)},
  join(){
    if(!needAuth())return;
    if(!complete(profile)){toast('প্রথমে আপনার প্রোফাইল সম্পূর্ণ করুন (Team Name, Phone, Avatar compulsory)','err');location.hash='#/me';return}
    const pay=T.fee>0,pl=pay?[...PLEDGE,PAYPLEDGE]:PLEDGE;
    const m=modal(`<h3 class="mb-1 text-lg font-bold text-slate-100">যুক্ত হোন · ${esc(T.name)}</h3><p class="mb-4 text-sm text-slate-300">এন্ট্রি ফি: ${pay?money(T.fee):'ফ্রি'}</p>
    ${pay?`<div class="mb-4 space-y-3 rounded-2xl border border-gold/40 bg-gold/5 p-4"><div class="text-sm font-bold text-gold">ধাপ ১: এন্ট্রি ফি পাঠিয়ে দিন</div><p class="whitespace-pre-line text-sm text-slate-200 leading-relaxed">${esc(T.payInfo||'হোস্টের দেওয়া নম্বরে টাকা পাঠান')}</p>
     <div class="text-sm font-bold text-gold mt-3">ধাপ ২: আপনার পেমেন্ট তথ্য দিন</div>
     <select id="pm" class="inp text-slate-100"><option>bKash</option><option>Nagad</option><option>Rocket</option><option>অন্যান্য মাধ্যম</option></select>
     <input id="ps" class="inp" type="tel" placeholder="যে নম্বর থেকে টাকা পাঠিয়েছেন">
     <input id="pt" class="inp" maxlength="30" placeholder="ট্রানজেকশন আইডি (TrxID যেমন: 9A7B3C2D)">
     <p class="text-xs text-slate-300 leading-relaxed">হোস্ট পেমেন্ট চেক না করা পর্যন্ত আপনার এন্ট্রি পেন্ডিং থাকবে।</p></div>`:''}
    <div class="space-y-2.5">${pl.map(p=>`<label class="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-900/60 p-3.5 text-sm"><input type="checkbox" class="ck mt-0.5 h-4 w-4 accent-cyan-500 shrink-0"><span class="text-slate-200 leading-relaxed">${p}</span></label>`).join('')}</div>
    <button id="ok" class="btn btn-n mt-5 w-full py-3 text-base font-bold" disabled>কনফার্ম করে জয়েন করুন</button>`);
    const cks=[...m.el.querySelectorAll('.ck')];
    cks.forEach(c=>c.onchange=()=>m.$('#ok').disabled=!cks.every(x=>x.checked));
    m.$('#ok').onclick=async()=>{
      const method=pay?m.$('#pm').value:'',sender=pay?m.$('#ps').value.trim():'',trx=pay?m.$('#pt').value.trim():'';
      if(pay&&(!sender||trx.length<6))return toast('আপনার ফোন নম্বর ও TrxID সঠিকভাবে লিখুন','err');
      const ok=await run(t=>{if(t.status!=='open')throw Error('রেজিস্ট্রেশন বন্ধ হয়ে গেছে');if(t.players.length>=t.max)throw Error('টুর্নামেন্ট ফুল হয়ে গেছে (দল পূর্ণ)');if(t.players.some(p=>p.uid===user.uid))throw Error('আপনি ইতিমধ্যেই এই টুর্নামেন্টে যুক্ত হয়েছেন');
        if(pay&&t.players.some(p=>p.trx&&p.trx.toLowerCase()===trx.toLowerCase()))throw Error('এই TrxID দিয়ে ইতিপূর্বেই অন্য কেউ এন্ট্রি নিয়েছে');
        t.players.push({uid:user.uid,team:profile.team,phone:profile.phone,fb:profile.fb||'',avatar:profile.avatar||'',paid:!pay,method,sender,trx})},pay?'অনুরোধ পাঠানো হয়েছে। পেমেন্ট যাচাইয়ের অপেক্ষায় থাকুন।':'সফলভাবে যুক্ত হয়েছেন! 🎮');
      if(ok)m.close()};
  },
  verify(d){run(t=>{if(t.hostId!==user.uid)throw Error('শুধুমাত্র হোস্টের জন্য অনুমোদিত');const p=t.players.find(x=>x.uid===d.u);if(p)p.paid=true},'পেমেন্ট সফলভাবে ভেরিফাই করা হয়েছে')},
  reject(d){if(!confirm('এই পেমেন্ট বাতিল করে টিমটি তালিকা থেকে মুছে দেবেন?'))return;run(t=>{if(t.hostId!==user.uid)throw Error('শুধুমাত্র হোস্টের জন্য অনুমোদিত');if(t.status!=='open')throw Error('রেজিস্ট্রেশন বন্ধ হয়ে গেছে');t.players=t.players.filter(x=>x.uid!==d.u)},'দলটি সফলভাবে বাদ দেওয়া হয়েছে')},
  start(){
    const pend=T.players.filter(p=>!isPaid(p)).length;
    if(pend&&!confirm(`${pend} জন অননুমোদিত খেলোয়াড় বাদ পড়বে। আপনি কি এগিয়ে যেতে চান?`))return;
    run(t=>{if(t.hostId!==user.uid)throw Error('শুধুমাত্র হোস্টের জন্য অনুমোদিত');const ps=t.players.filter(isPaid);if(ps.length<2)throw Error('টুর্নামেন্ট শুরু করতে অন্তত ২টি ভেরিফাইড দল প্রয়োজন');t.players=ps;t.rounds=build(ps);t.status='live'},'ব্র্যাকেট সফলভাবে তৈরি করা হয়েছে!');
  },
  async delT(){
    if(!confirm('আপনি কি সত্যিই এই টুর্নামেন্টটি ডিলিট করতে চান?'))return;
    try {
      if(T.players.length > 0) throw Error('কেউ জয়েন করার পর টুর্নামেন্ট ডিলিট করা যাবে না!');
      await F.deleteDoc(tref(T.id));
      toast('টুর্নামেন্ট ডিলিট করা হয়েছে');
      location.hash='#/';
    } catch(e) {
      toast(e.message, 'err');
    }
  },
  payout(d){
    const i=+d.p,cs=placings(T)[i];
    const m=modal(`<h3 class="mb-3 text-lg font-bold text-slate-100">পেমেন্ট রেকর্ড করুন · ${PL(i)} · ${money(T.prizes[i])}</h3><div class="space-y-3.5">
     <div><label class="lbl">বিজয়ী দল</label><select id="pw" class="inp text-slate-100">${cs.map(c=>`<option value="${c.uid}">${esc(c.team)}</option>`).join('')}</select></div>
     <div><label class="lbl">পেমেন্ট ট্রানজেকশন আইডি (TrxID)</label><input id="pt" class="inp" maxlength="40"></div>
     <p class="text-xs text-slate-400 leading-relaxed">বিজয়ী দল টাকা পাওয়ার পর তা কনফার্ম করবে।</p>
     <button id="ok" class="btn btn-p w-full py-3 font-bold">সংরক্ষণ করুন</button></div>`);
    m.$('#ok').onclick=async()=>{
      const wid=m.$('#pw').value,trx=m.$('#pt').value.trim(),w=cs.find(c=>c.uid===wid);
      if(trx.length<6)return toast('সঠিক ট্রানজেকশন আইডি দিন','err');
      const ok=await run(t=>{if(t.hostId!==user.uid)throw Error('শুধুমাত্র হোস্টের জন্য অনুমোদিত');if(t.payouts[i]?.ok===true)throw Error('এই কাজের অনুমতি নেই');t.payouts[i]={uid:user.uid,team:w.team,amount:+t.prizes[i]||0,trx,ok:null,at:Date.now()}},'পেমেন্ট সফলভাবে রেকর্ড করা হয়েছে');
      if(ok)m.close()};
  },
  pconf(d){run(t=>{const po=t.payouts[+d.p];if(!po||po.uid!==user.uid)throw Error('এই কাজের অনুমতি নেই');po.ok=d.v==='1'},'ধন্যবাদ, রেকর্ড করা হয়েছে')},
  report(){
    if(!needAuth())return;
    const why=prompt('কেন আপনি এই হোস্ট বা টুর্নামেন্টের বিরুদ্ধে রিপোর্ট করতে চান?');if(!why)return;
    run(t=>{if(t.hostId===user.uid)throw Error('নিজের টুর্নামেন্টে নিজের রিপোর্ট দেওয়া যাবে না');if(t.reports.some(r=>r.uid===user.uid))throw Error('আপনি ইতিমধ্যেই রিপোর্ট করেছেন');t.reports.push({uid:user.uid,team:profile?.team||'খেলোয়াড়',why:why.slice(0,300),at:Date.now()})},'রিপোর্ট সফলভাবে পাঠানো হয়েছে');
  },
  async logout(){await F.signOut(auth);location.hash='#/'}
};
document.addEventListener('click',async e=>{const a=e.target.closest('[data-act]');if(a&&actions[a.dataset.act]){e.preventDefault();actions[a.dataset.act](a.dataset,e)}});
document.addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;drawList()}});

function hostView(id){
  F.getDocs(F.query(F.collection(db,'tournaments'),F.where('hostId','==',id))).then(async s=>{
    const ts=s.docs.map(d=>({id:d.id,...d.data()}));
    if(!ts.length)return setView(`<p class="p-8 text-center text-slate-300">হোস্টের কোনো তথ্য পাওয়া যায়নি।</p>`);
    const r=await hostStats(id);
    setView(`<div class="space-y-4 p-4"><a href="javascript:history.back()" class="inline-flex items-center gap-1 text-xs text-volt font-medium"><i data-lucide="chevron-left" class="h-4 w-4"></i>ফিরে যান</a>
    <h1 class="text-2xl font-black text-slate-100">${esc(ts[0].hostName)}</h1>${trustBox(r)}
    <h2 class="font-bold text-lg text-slate-100 mt-4">এই হোস্টের অন্যান্য টুর্নামেন্ট</h2><div class="space-y-3">${ts.map(t=>card(t,ts)).join('')}</div></div>`);
  }).catch(e=>toast(e.message,'err'));
}

async function publicProfileView(uid){
  try {
    const docRef = await F.getDoc(F.doc(db, 'users', uid));
    if(!docRef.exists()) return setView(`<p class="p-8 text-center text-slate-300">ইউজার পাওয়া যায়নি</p>`);
    const uData = docRef.data();
    const avatarHtml = uData.avatar ? `<img src="${esc(uData.avatar)}" class="h-24 w-24 rounded-full object-cover border-2 border-volt mx-auto shadow-lg">` : `<div class="grid h-24 w-24 place-items-center rounded-full bg-volt/20 text-volt text-3xl font-black mx-auto">${esc((uData.team||'?')[0].toUpperCase())}</div>`;
    
    setView(`<div class="p-6 max-w-md mx-auto space-y-4 text-center">
      <a href="javascript:history.back()" class="inline-flex items-center gap-1 text-xs text-volt font-medium self-start mb-2"><i data-lucide="chevron-left" class="h-4 w-4"></i>ফিরে যান</a>
      <div class="glass rounded-3xl p-6 space-y-4 shadow-xl">
        ${avatarHtml}
        <div>
          <h1 class="text-2xl font-black text-slate-100">${esc(uData.team || 'Unknown Team')}</h1>
          <span class="badge bg-volt/15 text-volt mt-2">DLS Player</span>
        </div>
        <p class="text-xs text-slate-400 border-t border-white/10 pt-3 leading-relaxed">গোপনীয়তা রক্ষার জন্য অন্যান্য ইউজাররা শুধু আপনার টিম নেম এবং প্রোফাইল পিকচার দেখতে পাবেন।</p>
      </div>
    </div>`);
    icons();
  } catch(e) {
    toast(e.message, 'err');
  }
}

function matchView(id,r,i){
  CUR={id,r,i};
  unsub=F.onSnapshot(tref(id),async s=>{
    if(!s.exists())return setView(`<p class="p-8 text-center text-slate-300">কিছু পাওয়া যায়নি।</p>`);
    T={id,...s.data()};T.players=T.players||[];const m=T.rounds?.['r'+r]?.[i];
    if(!m||!m.a||!m.b)return setView(`<p class="p-8 text-center text-slate-300">এই ম্যাচটি এখনো খেলার উপযোগী হয়নি।</p>`);
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
  if(st==='done')result=`<div class="rounded-2xl bg-neon/10 p-4 text-center"><div class="text-xs text-neon font-bold tracking-wider">বিজয় ডিক্লেয়ারড</div><div class="text-xl font-black text-slate-100 mt-0.5">${esc((m.winner===m.a.uid?m.a:m.b).team)}</div>${m.bye?`<div class="text-xs text-slate-300 mt-1">বাই (Bye)</div>`:`<div class="text-lg font-black text-volt mt-1">${m.sa} – ${m.sb}</div>`}</div>`;
  else if(me&&st==='pending')result=`<form id="rf" class="glass space-y-3.5 rounded-2xl p-4 sm:p-5"><h3 class="font-bold text-base text-slate-100">ম্যাচ রেজাল্ট সাবমিট করুন</h3>
    <div class="grid grid-cols-2 gap-3"><div><label class="lbl">${esc(m.a.team)} গোল</label><input class="inp text-center text-xl font-black text-slate-100" name="sa" type="number" min="0" max="99" required inputmode="numeric"></div>
    <div><label class="lbl">${esc(m.b.team)} গোল</label><input class="inp text-center text-xl font-black text-slate-100" name="sb" type="number" min="0" max="99" required inputmode="numeric"></div></div>
    <div><label class="lbl">ম্যাচ জয়ের স্ক্রিনশট দিন (বাধ্যতামূলক)</label><input class="inp file:mr-3 file:rounded-lg file:border-0 file:bg-volt file:px-3 file:py-1.5 file:text-xs file:font-bold" name="img" type="file" accept="image/*" required></div>
    <button class="btn btn-p w-full py-3 text-base font-bold" id="sub">কনফার্মেশনের জন্য পাঠান</button><p class="text-xs text-slate-400 leading-relaxed">হোস্ট চূড়ান্ত অনুমোদন দেওয়ার আগে প্রতিপক্ষকে স্কোর কনফার্ম করতে হবে।</p></form>`;
  else if(st==='submitted'||st==='confirmed'||st==='disputed'){
    result=`<div class="glass space-y-3.5 rounded-2xl p-4 sm:p-5"><div class="flex items-center justify-between"><h3 class="font-bold text-base text-slate-100">সাবমিট করা ম্যাচ রেজাল্ট</h3><span class="badge ${st==='disputed'?'bg-red-500/20 text-red-300':st==='confirmed'?'bg-neon/20 text-neon':'bg-gold/20 text-gold'}">${st}</span></div>
    <div class="text-center text-3xl font-black text-slate-100">${esc(m.a.team)} <span class="text-volt">${m.sa} – ${m.sb}</span> ${esc(m.b.team)}</div>
    ${proof?`<img src="${proof}" alt="Result proof" class="max-h-80 w-full rounded-xl bg-black/40 object-contain shadow-md">`:''}
    ${st==='disputed'?`<p class="rounded-xl bg-red-500/10 p-3 text-xs sm:text-sm text-red-300 leading-relaxed">অভিযোগ/ডিসপিউট: ${esc(m.disputeReason||'কোনো কারণ উল্লেখ করা হয়নি')}। হোস্টের চূড়ান্ত সিদ্ধান্তের অপেক্ষায়।</p>`:''}
    ${me&&st==='submitted'&&!submitter?`<div class="grid grid-cols-2 gap-2.5"><button data-r="confirm" class="btn btn-n py-2.5 font-bold"><i data-lucide="check" class="h-4 w-4"></i>কনফার্ম করুন</button><button data-r="dispute" class="btn btn-d py-2.5 font-bold"><i data-lucide="flag" class="h-4 w-4"></i>ডিসপিউট (অভিযোগ)</button></div>`:''}
    ${me&&st==='submitted'&&submitter?`<p class="text-center text-sm text-slate-300">প্রতিপক্ষের কনফার্মেশনের জন্য অপেক্ষা করা হচ্ছে…</p>`:''}
    ${st==='confirmed'?`<p class="text-center text-sm text-slate-300">উভয় খেলোয়াড় একমত হয়েছেন। হোস্টের চূড়ান্ত অনুমোদনের অপেক্ষা।</p>`:''}</div>`;
    if(host)result+=`<div class="rounded-2xl border border-volt/40 bg-volt/5 p-4"><div class="mb-2 font-bold text-volt text-sm">হোস্টের চূড়ান্ত সিদ্ধান্ত</div><div class="grid grid-cols-2 gap-2.5">
      <button data-r="win" data-w="${m.a.uid}" class="btn btn-p py-2.5 font-bold ${m.sa>m.sb?'':'btn-g'}">${esc(m.a.team)} বিজয়ী হয়েছে</button><button data-r="win" data-w="${m.b.uid}" class="btn btn-p py-2.5 font-bold ${m.sb>m.sa?'':'btn-g'}">${esc(m.b.team)} বিজয়ী হয়েছে</button></div></div>`;
  }else if(!me)result=`<p class="text-center text-sm text-slate-300">খেলোয়াড়দের রেজাল্ট পাঠানোর অপেক্ষা চলছে।</p>`;
  setView(`<div class="space-y-4 p-4"><a href="#/t/${id}" class="inline-flex items-center gap-1 text-xs text-volt font-medium"><i data-lucide="chevron-left" class="h-4 w-4"></i>${esc(T.name)}</a>
  <h1 class="text-xl sm:text-2xl font-black text-slate-100">ম্যাচ রুম</h1>
  <div class="grid gap-3 sm:grid-cols-2">${me?person('আপনার প্রতিপক্ষ',opp,true):person('দল ক',m.a,host)+person('দল খ',m.b,host)}</div>
  <div class="rounded-2xl border border-volt/40 bg-gradient-to-br from-volt/10 to-transparent p-4 sm:p-5"><div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-volt"><i data-lucide="door-open" class="h-4 w-4"></i>ফ্রেন্ডলি রুম কোড (Room Code)</div>
   ${m.room?`<div class="mt-2 flex items-center gap-3"><div class="select-all text-3xl sm:text-4xl font-black tracking-widest text-slate-100">${esc(m.room)}</div><button data-act="copy" data-v="${esc(m.room)}" class="btn btn-g px-3 py-2"><i data-lucide="copy" class="h-4 w-4"></i></button></div>
   ${age!=null?`<p class="mt-1.5 text-xs ${age>=5?'text-red-300 font-semibold':'text-slate-300'}">${age} মিনিট আগে শেয়ার করা হয়েছে${age>=5?' · মেয়াদের শেষ পর্যায়ে, নতুন কোড নিন':''}</p>`:''}`:`<p class="mt-2 text-sm text-slate-300 leading-relaxed">কোড এখনো দেওয়া হয়নি। ডিএলএস গেমের ভেতর রুম খুলে কোড এখানে দিন।</p>`}
   ${me&&st!=='done'?`<div class="mt-3.5 flex gap-2.5"><input id="room" class="inp text-lg font-bold tracking-wider text-slate-100" maxlength="20" placeholder="রুম কোড এখানে লিখুন" value="${esc(m.room)}"><button data-r="room" class="btn btn-p px-5 font-bold">সংরক্ষণ করুন</button></div>`:''}
   <p class="mt-3 text-xs text-slate-400 leading-relaxed">ডিএলএস ফ্রেন্ডলি রুম কোডের মেয়াদ মাত্র ৫ মিনিট থাকে। উভয় খেলোয়াড় রেডি হলেই কেবল কোড তৈরি করে শেয়ার করুন।</p></div>
  ${result}</div>`);
}

document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-r]');if(!b||!CUR)return;
  const {id,r,i}=CUR,act=b.dataset.r,upd=fn=>mut(id,t=>fn(t.rounds['r'+r][i],t)).catch(x=>toast(x.message,'err'));
  if(act==='room'){const v=$('#room').value.trim();if(v)upd(m=>{m.room=v;m.roomAt=Date.now()})}
  if(act==='confirm')upd(m=>{if(m.submittedBy===user.uid)throw Error('প্রতিপক্ষকে আগে কনফার্ম করতে হবে');m.status='confirmed'});
  if(act==='dispute'){const why=prompt('কেন আপনি এই রেজাল্ট নিয়ে ডিসপিউট বা অভিযোগ করছেন?');if(why)upd(m=>{m.status='disputed';m.disputeReason=why.slice(0,300)})}
  if(act==='win')upd((m,t)=>{if(t.hostId!==user.uid)throw Error('শুধুমাত্র হোস্টের জন্য অনুমোদিত');const w=b.dataset.w===m.a.uid?m.a:m.b;m.winner=w.uid;m.status='done';advance(t.rounds,r,i,w);
    if(!t.rounds['r'+(r+1)]){t.status='done';t.champion={uid:w.uid,team:w.team}}});
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='rf'||!CUR)return;e.preventDefault();
  const {id,r,i}=CUR,d=new FormData(e.target),sa=+d.get('sa'),sb=+d.get('sb'),btn=$('#sub');
  if(sa===sb)return toast('ম্যাচে ড্র রাখা যাবে না। এক্সট্রা টাইম বা টাইব্রেকার নিয়ে জয়ী নির্ধারণ করুন।','err');
  btn.disabled=true;btn.textContent='আপলোড হচ্ছে, দয়া করে অপেক্ষা করুন…';
  try{
    const img=await shrink(d.get('img'));
    await F.setDoc(F.doc(db,'proofs',`${id}_${r}_${i}`),{img,by:user.uid,at:F.serverTimestamp()});
    await mut(id,t=>{const m=t.rounds['r'+r][i];if(m.status!=='pending')throw Error('ইতিমধ্যেই রেজাল্ট জমা দেওয়া হয়েছে');m.sa=sa;m.sb=sb;m.status='submitted';m.submittedBy=user.uid;m.proof=true});
    toast('জমা দেওয়া হয়েছে। প্রতিপক্ষের কনফার্মেশনের অপেক্ষা');
  }catch(err){toast(err.message,'err');btn.disabled=false;btn.textContent='কনফার্মেশনের জন্য পাঠান'}
});
function shrink(file,max=900){return new Promise((res,rej)=>{const im=new Image(),u=URL.createObjectURL(file);
  im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.6))};
  im.onerror=()=>rej(Error('ছবিটি পড়া সম্ভব হয়নি, অন্য ছবি দিন'));im.src=u})}

async function checkHostSubscription(uid) {
  try {
    const q = F.query(F.collection(db, 'subscriptions'), F.where('uid', '==', uid));
    const snap = await F.getDocs(q);
    if (snap.empty) return { active: false };
    let active = false, subData = null;
    snap.docs.forEach(d => {
      const data = d.data();
      const st = String(data.status || '').toLowerCase().trim();
      if (st === 'approved') {
        if (data.targetExpire) {
          const exp = new Date(data.targetExpire).getTime();
          if (exp > Date.now()) { active = true; subData = data; }
        } else {
          active = true; subData = data;
        }
      }
    });
    return { active, subData };
  } catch(e) {
    return { active: false };
  }
}

async function createView(){
  if(!user){setView(`<div class="p-8 text-center"><p class="mb-4 text-slate-300 text-sm">টুর্নামেন্ট হোস্ট করতে প্রথমে সাইন ইন করুন।</p><button data-act="auth" class="btn btn-p">প্রবেশ করুন</button></div>`);return}
  if(!complete(profile)){setView(`<div class="p-8 text-center"><p class="mb-4 text-slate-300 text-sm">হোস্ট করার আগে আপনার প্রোফাইল সম্পূর্ণ করে নিন।</p><a href="#/me" class="btn btn-p">প্রোফাইল পেজে যান</a></div>`);return}

  const { active: isSubActive } = await checkHostSubscription(user.uid);

  if (!isSubActive) {
    setView(`<div class="space-y-4 p-4 max-w-xl mx-auto">
      <div class="glass rounded-3xl p-6 text-center space-y-4">
        <div class="grid h-16 w-16 place-items-center rounded-2xl bg-gold/15 text-gold mx-auto"><i data-lucide="crown" class="h-8 w-8"></i></div>
        <h1 class="text-2xl font-black text-slate-100">হস্টিং সাবস্ক্রিপশন প্রয়োজন</h1>
        <p class="text-sm text-slate-300 leading-relaxed">টুর্নামেন্ট হোস্ট করতে হলে যেকোনো একটি প্যাকেজ বেছে নিন এবং পেমেন্ট করে নিচে ট্রানজেকশন আইডি (TrxID) দিন। অ্যাডমিন যাচাই করে এপ্রুভ করলেই আপনার হস্টিং অ্যাক্টিভ হয়ে যাবে।</p>
        
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
          <div class="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div class="text-xs text-slate-400 font-bold">১৫ দিন</div>
            <div class="text-xl font-black text-volt mt-1">১০০ টাকা</div>
          </div>
          <div class="rounded-2xl border border-volt/40 bg-volt/5 p-4 relative">
            <span class="absolute -top-2.5 right-3 badge bg-volt text-ink font-bold text-[10px]">জনপ্রিয়</span>
            <div class="text-xs text-volt font-bold">১ মাস</div>
            <div class="text-xl font-black text-slate-100 mt-1">১৫০ টাকা</div>
          </div>
          <div class="rounded-2xl border border-gold/40 bg-gold/5 p-4">
            <div class="text-xs text-gold font-bold">৬ মাস</div>
            <div class="text-xl font-black text-gold mt-1"> ৫০০ টাকা</div>
          </div>
        </div>

        <div class="rounded-2xl bg-slate-900/80 p-4 text-left space-y-3 text-sm">
          <b class="text-gold font-bold block">পেমেন্ট করার মাধ্যম (Personal):</b>
          <p class="text-slate-200">বিকাশ / নগদ: <b class="select-all text-volt">01XXXXXXXXX</b></p>
          <hr class="border-white/10 my-2">
          <div><label class="lbl">প্যাকেজ সিলেক্ট করুন</label><select id="subType" class="inp text-slate-100"><option value="15days">১৫ দিন - ১০০ টাকা</option><option value="1month" selected>১ মাস - ১৫০ টাকা</option><option value="6months">৬ মাস - ৫০০ টাকা</option></select></div>
          <div><label class="lbl">যে নম্বর থেকে টাকা পাঠিয়েছেন</label><input id="subSender" class="inp" type="tel" placeholder="01XXXXXXXXX"></div>
          <div><label class="lbl">ট্রানজেকশন আইডি (TrxID)</label><input id="subTrx" class="inp" placeholder="যেমন: 9A7B3C2D"></div>
          <button id="subReqBtn" class="btn btn-n w-full py-3 font-bold mt-2">অনুরোধ পাঠান</button>
        </div>
      </div>
    </div>`);
    
    setTimeout(()=>{
      const btn = $('#subReqBtn');
      if(btn) btn.onclick = async()=>{
        const type = $('#subType').value;
        const sender = $('#subSender').value.trim();
        const trx = $('#subTrx').value.trim();
        if(!sender || trx.length < 5) return toast('আপনার ফোন নম্বর ও সঠিক TrxID লিখুন','err');
        btn.disabled = true;
        btn.textContent = 'পাঠানো হচ্ছে...';
        
        const now = new Date();
        if(type === '15days') now.setDate(now.getDate() + 15);
        else if(type === '1month') now.setMonth(now.getMonth() + 1);
        else if(type === '6months') now.setMonth(now.getMonth() + 6);
        const targetExpire = now.toISOString();

        try {
          await F.addDoc(F.collection(db, 'subscriptions'), {
            uid: user.uid,
            team: profile.team,
            email: user.email || '',
            phone: profile.phone,
            type,
            sender,
            trx,
            targetExpire,
            status: 'pending',
            createdAt: F.serverTimestamp()
          });
          toast('অনুরোধ পাঠানো হয়েছে! অ্যাডমিন এপ্রুভ করলে হোস্ট করতে পারবেন।');
          setTimeout(()=>location.reload(), 1500);
        } catch(e) {
          toast(e.message, 'err');
          btn.disabled = false;
          btn.textContent = 'অনুরোধ পাঠান';
        }
      };
    }, 100);
    return;
  }

  // Host setup form with auto-calculation of host commission percentage and net prize pool
  setView(`<form id="cf" class="space-y-4 p-4 max-w-xl mx-auto"><h1 class="text-2xl font-black text-slate-100">টুর্নামেন্ট হোস্ট করুন</h1>
  <div><label class="lbl">টুর্নামেন্টের নাম</label><input class="inp text-slate-100" name="name" required maxlength="60" placeholder="Friday Night Cup"></div>
  <div class="grid grid-cols-2 gap-3"><div><label class="lbl">সর্বোচ্চ দলের সংখ্যা</label><select class="inp text-slate-100" id="inMax" name="max"><option>4</option><option selected>8</option><option>16</option><option>32</option></select></div>
  <div><label class="lbl">এন্ট্রি ফি (টাকায়)</label><input class="inp text-slate-100" id="inFee" name="fee" type="number" min="0" value="50" required></div></div>
  
  <div>
    <label class="lbl flex items-center gap-1.5"><i data-lucide="calendar" class="h-4 w-4 text-volt"></i> শুরুর তারিখ ও সময়</label>
    <div class="relative">
      <input class="inp text-slate-100 font-semibold !bg-slate-900/90 !border-volt/40 focus:!border-volt color-scheme-dark p-3.5 rounded-xl w-full text-sm" name="start" type="datetime-local" style="color-scheme: dark;" required>
    </div>
  </div>

  <div class="glass rounded-2xl p-4 space-y-3">
    <div class="text-sm font-bold text-gold flex items-center justify-between"><span class="flex items-center gap-2"><i data-lucide="trophy" class="h-4 w-4 text-gold"></i> পুরস্কারের বিবরণ (টাকায়)</span><span id="totColText" class="text-xs text-slate-300 font-normal">মোট কালেকশন: ৳৪০০</span></div>
    
    <div class="bg-slate-900/80 p-3 rounded-xl space-y-2 border border-white/5">
      <div class="flex items-center justify-between"><label class="lbl !mb-0">হোস্টের নিজস্ব কমিশন / লাভ (%)</label><span id="hostCalcAmt" class="text-xs text-volt font-bold">৳৪০ (১০%)</span></div>
      <input class="inp text-slate-100" id="inFeePct" name="feePct" type="number" min="0" max="100" value="10" placeholder="১০%" required>
      <p class="text-[11px] text-slate-400">এই শতাংশ হোস্টের ফি হিসেবে বাদ দিয়ে বাকি টাকা ১ ১ম, ২য় ও ৩য় পুরস্কারে স্বয়ংক্রিয়ভাবে ভাগ হয়ে যাবে।</p>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <div><label class="lbl">${PL(0)}</label><input class="inp text-slate-100" id="inP1" name="p1" type="number" min="0" value="0"></div>
      <div><label class="lbl">${PL(1)}</label><input class="inp text-slate-100" id="inP2" name="p2" type="number" min="0" value="0"></div>
      <div><label class="lbl">${PL(2)}</label><input class="inp text-slate-100" id="inP3" name="p3" type="number" min="0" value="0"></div>
    </div>
  </div>

  <div><label class="lbl">পেমেন্ট নির্দেশিকা (বিকাশ/নগদ নম্বর ও পাঠানোর নিয়ম)</label><textarea class="inp text-slate-100" name="payInfo" rows="2.5" placeholder="bKash 01XXXXXXXXX (Personal), Send Money"></textarea></div>
  <div><label class="lbl">টুর্নামেন্টের সাধারণ নিয়ম</label><textarea class="inp text-slate-100 leading-relaxed" name="rules" rows="5">১. হোস্টের দেওয়া ফ্রেন্ডলি রুম কোড ব্যবহার করে ম্যাচ খেলুন।\n২. খেলায় কোনো প্রকার অযথা পজ বা সময় নষ্ট করা নিষিদ্ধ।\n৩. ডিসকানেক্ট হলে ৫ মিনিটের মধ্যে ফিরে এসে ম্যাচ রিকানেক্ট করতে হবে।\n৪. ম্যাচ শেষে জয়ী দল ফুল-স্ক্রিন স্পষ্ট স্কোর স্ক্রিনশট আপলোড করবে।</textarea></div>
  <label class="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-900/60 p-3.5 text-sm"><input type="checkbox" name="pledge" required class="mt-0.5 h-4 w-4 accent-cyan-500 shrink-0"><span class="text-slate-300 leading-relaxed">আমি সততার সাথে পেমেন্ট ভেরিফাই করব এবং ফাইনালের ২৪ ঘণ্টার মধ্যে পুরস্কারের টাকা বুঝিয়ে দেব বলে প্রতিশ্রুতি দিচ্ছি।</span></label>
  <button class="btn btn-p w-full py-3.5 text-base font-bold" id="cb">টুর্নামেন্ট তৈরি করুন</button></form>`);
  
  // Auto-calculation script logic for tournament host form
  const recalcPrizes = () => {
    const max = +$('#inMax').value || 0;
    const fee = +$('#inFee').value || 0;
    const pct = +$('#inFeePct').value || 0;
    
    const gross = max * fee;
    const hostFee = Math.round((gross * pct) / 100);
    const netPrize = gross - hostFee;

    $('#totColText').textContent = `মোট কালেকশন: ৳${gross}`;
    $('#hostCalcAmt').textContent = `৳${hostFee} (${pct}%)`;

    if (netPrize > 0) {
      $('#inP1').value = Math.round(netPrize * 0.57); // ~57% to 1st
      $('#inP2').value = Math.round(netPrize * 0.28); // ~28% to 2nd
      $('#inP3').value = netPrize - Math.round(netPrize * 0.57) - Math.round(netPrize * 0.28); // ~15% to 3rd
    } else {
      $('#inP1').value = 0; $('#inP2').value = 0; $('#inP3').value = 0;
    }
  };

  $('#inMax').onchange = recalcPrizes;
  $('#inFee').oninput = recalcPrizes;
  $('#inFeePct').oninput = recalcPrizes;
  recalcPrizes();

  $('#cf').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    if(+d.fee>0&&!d.payInfo.trim())return toast('পেইড টুর্নামেন্টের জন্য সঠিক পেমেন্ট নির্দেশিকা দিন','err');
    const prizes=[+d.p1,+d.p2,+d.p3];
    $('#cb').disabled=true;
    try{const ref=await F.addDoc(F.collection(db,'tournaments'),{name:d.name.trim(),rules:d.rules,fee:+d.fee,feePct:+d.feePct||0,prizes,payInfo:d.payInfo,max:+d.max,start:d.start,
      hostId:user.uid,hostName:profile.team,hostPhone:profile.phone,status:'open',players:[],rounds:{},payouts:{},reports:[],champion:null,createdAt:F.serverTimestamp()});
      toast('টুর্নামেন্ট সফলভাবে তৈরি হয়েছে!');location.hash='#/t/'+ref.id}catch(err){toast(err.message,'err');$('#cb').disabled=false}};
}

async function profileView(){
  if(!user){setView(`<div class="p-8 text-center"><p class="mb-4 text-slate-300 text-sm">প্রোফাইল পরিচালনা করতে সাইন ইন করুন।</p><button data-act="auth" class="btn btn-p">প্রবেশ করুন</button></div>`);return}
  const p=profile||{};
  const { active: subActive, subData } = await checkHostSubscription(user.uid);

  setView(`<div class="space-y-6 p-4">
  <div class="glass rounded-2xl p-4 flex items-center justify-between">
    <div>
      <div class="text-xs text-slate-400 font-medium">হস্টিং সাবস্ক্রিপশন স্ট্যাটাস</div>
      <div class="text-base font-extrabold ${subActive?'text-neon':'text-gold'}">${subActive?'অ্যাক্টিভ (Host Unlocked)':'ইনঅ্যাক্টিভ (সদস্য নন)'}</div>
      ${subActive&&subData?.targetExpire?`<div class="text-[11px] text-slate-300 mt-0.5">মেয়াদ: ${new Date(subData.targetExpire).toLocaleDateString('bn-BD')} পর্যন্ত</div>`:''}
    </div>
    ${!subActive?`<a href="#/new" class="btn btn-n !py-1.5 !px-3 text-xs font-bold">সাবস্ক্রাইব করুন</a>`:''}
  </div>

  <form id="pf" class="space-y-4">
  <h1 class="text-2xl font-black text-slate-100">আপনার প্রোফাইল</h1>
  <p class="text-xs sm:text-sm text-slate-300">${esc(user.email||'')} · (ফেসবুক লিংক ছাড়া অন্যান্য ঘর পূরণ বাধ্যতামূলক)</p>
  <div><label class="lbl">ডিএলএস টিম নেম (Team Name) <span class="text-red-400">*</span></label><input class="inp text-slate-100" name="team" required maxlength="30" value="${esc(p.team)}"></div>
  <div><label class="lbl">প্রোফাইল পিকচার সিলেক্ট করুন <span class="text-red-400">*</span></label><input class="inp text-slate-100 file:mr-3 file:rounded-lg file:border-0 file:bg-volt file:px-3 file:py-1.5 file:text-xs file:font-bold" id="imgFile" type="file" accept="image/*"><input type="hidden" name="avatar" id="avatarVal" value="${esc(p.avatar)}"></div>
  ${p.avatar?`<div class="flex items-center gap-3"><img src="${esc(p.avatar)}" class="h-12 w-12 rounded-full object-cover border border-volt/40"><span class="text-xs text-slate-400">বর্তমান ছবি</span></div>`:''}
  <div><label class="lbl">হোয়াটসঅ্যাপ / মোবাইল নম্বর <span class="text-red-400">*</span></label><input class="inp text-slate-100" name="phone" required type="tel" placeholder="8801XXXXXXXXX" value="${esc(p.phone)}"></div>
  <div><label class="lbl">ফেসবুক প্রোফাইল লিংক (ঐচ্ছিক)</label><input class="inp text-slate-100" name="fb" type="url" placeholder="https://facebook.com/…" value="${esc(p.fb)}"></div>
  <button class="btn btn-p w-full py-3 font-bold">প্রোফাইল সেভ করুন</button>
  </form>

  <section class="glass rounded-2xl p-4 space-y-2">
    <div class="font-bold text-slate-100 text-sm flex items-center gap-2"><i data-lucide="mail" class="h-4 w-4 text-volt"></i>যোগাযোগ ও অভিযোগ (Contact Us / Complain)</div>
    <p class="text-xs text-slate-300 leading-relaxed">যেকোনো সমস্যা, অভিযোগ বা সহায়তার জন্য আমাদের অফিসিয়াল ইমেইলে সরাসরি মেসেজ দিন:</p>
    <a href="mailto:forbusinessshaor@gmail.com" class="inline-block text-xs text-volt font-extrabold underline select-all">forbusinessshaor@gmail.com</a>
  </section>

  <button type="button" data-act="logout" class="btn btn-g w-full py-3 text-red-400 font-semibold"><i data-lucide="log-out" class="h-4 w-4"></i>লগআউট (Sign Out)</button>
  <section id="mine" class="space-y-4"></section></div>`);
  
  $('#imgFile').onchange=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        const c=document.createElement('canvas');let w=img.width,h=img.height;
        const max=200;if(w>h&&w>max){h*=max/w;w=max;}else if(h>max){w*=max/h;h=max;}
        c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
        $('#avatarVal').value=c.toDataURL('image/jpeg',0.7);
        toast('ছবি সিলেক্ট করা হয়েছে! এবার প্রোফাইল সেভ করুন।');
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  $('#pf').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    d.avatar=$('#avatarVal').value;
    if(!d.avatar) return toast('প্রোফাইল ছবি দেয়া বাধ্যতামূলক!','err');
    try{await F.setDoc(F.doc(db,'users',user.uid),d,{merge:true});profile={...profile,...d};header();toast('প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে!');location.hash='#/'}catch(err){toast(err.message,'err')}};
  
  F.getDocs(F.collection(db,'tournaments')).then(s=>{
    const ts=s.docs.map(d=>({id:d.id,...d.data()})),hosted=ts.filter(t=>t.hostId===user.uid),joined=ts.filter(t=>(t.players||[]).some(x=>x.uid===user.uid));
    const row=t=>{const [bl,bc]=statusBadge(t.status);return `<a href="#/t/${t.id}" class="glass flex items-center justify-between gap-2 rounded-xl p-3.5 text-sm hover:bg-white/[0.05]"><span class="truncate font-semibold text-slate-100">${esc(t.name)}</span><span class="badge ${bc}">${bl}</span></a>`};
    const sec=(h,l)=>l.length?`<div><h2 class="mb-2.5 font-bold text-base text-slate-100">${h}</h2><div class="space-y-2">${l.map(row).join('')}</div></div>`:'';
    const el=$('#mine');if(el)el.innerHTML=`<div class="space-y-4">${sec('আমার যুক্ত হওয়া টুর্নামেন্টসমূহ',joined)}${sec('আমার হোস্ট করা টুর্নামেন্টসমূহ',hosted)}</div>`;
  }).catch(()=>{});
}

async function adminReportsView(){
  try {
    const s = await F.getDocs(F.collection(db,'tournaments'));
    let reportsList = [];
    s.docs.forEach(d => {
      const t = d.data();
      if(t.reports && t.reports.length) {
        t.reports.forEach(r => {
          reportsList.push({ tName: t.name, hostName: t.hostName, ...r });
        });
      }
    });

    setView(`<div class="space-y-4 p-4 max-w-2xl mx-auto">
      <h1 class="text-2xl font-black text-slate-100 flex items-center gap-2"><i data-lucide="shield-alert" class="h-6 w-6 text-red-400"></i>অ্যাডমিন রিপোর্টস ড্যাশবোর্ড</h1>
      <p class="text-xs text-slate-300">টুর্নামেন্ট বা হোস্টের বিরুদ্ধে জমা পড়া সব অভিযোগের তালিকা:</p>
      <div class="space-y-3">
        ${reportsList.length ? reportsList.map(r => `<div class="glass rounded-2xl p-4 space-y-1.5 border border-red-500/30">
          <div class="flex justify-between items-center"><b class="text-volt text-sm">${esc(r.tName)}</b><span class="text-[11px] text-slate-400">${r.at ? new Date(r.at).toLocaleDateString('bn-BD') : ''}</span></div>
          <div class="text-xs text-slate-300">হোস্ট: <b class="text-slate-100">${esc(r.hostName)}</b></div>
          <div class="text-xs text-slate-300">অভিযোগকারী: <b class="text-slate-100">${esc(r.team)}</b></div>
          <div class="rounded-xl bg-red-500/10 p-2.5 text-xs text-red-200 mt-2">কারণ: ${esc(r.why)}</div>
        </div>`).join('') : `<div class="glass rounded-2xl p-8 text-center text-sm text-slate-400">কোনো রিপোর্ট বা অভিযোগ পাওয়া যায়নি।</div>`}
      </div>
    </div>`);
    icons();
  } catch(e) {
    toast(e.message, 'err');
  }
}
