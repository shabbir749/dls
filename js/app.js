import * as F from './firebase.js';
import {$,esc,money,icons,skeleton,toast,modal} from './ui.js';
import {build,advance,renderBracket} from './bracket.js';

const {auth,db}=F,app=$('#app');
let user=null,profile=null,unsub=null,T=null,CUR=null,S={tab:'open',list:[]};

const DEFAULT_RULES='1. Play in the room code given by the host.\n2. Match length: default DLS settings, no pausing to stall.\n3. Disconnect = 5 min to rejoin, otherwise forfeit.\n4. Winner uploads a clear full-screen score screenshot.';
const PLEDGE=['I will NOT fix, sell or throw any match.','I will not use mods, cheats or fake accounts.','I understand any result needs my opponent\'s confirmation, and the host can disqualify me on proof of fixing.','I have read the prize breakdown and the management fee.'];

const tref=id=>F.doc(db,'tournaments',id);
const prizeTotal=t=>(t.prizes||[]).reduce((a,b)=>a+(+b||0),0);
const complete=p=>p&&p.team&&p.code&&p.phone;
const statusBadge=s=>({open:['Upcoming','bg-volt/15 text-volt'],live:['Live','bg-neon/15 text-neon'],done:['Completed','bg-gold/15 text-gold']}[s]||['?','']);
const mut=(id,fn)=>F.runTransaction(db,async tx=>{
  const s=await tx.get(tref(id));if(!s.exists())throw Error('Tournament not found');
  const t=s.data();t.rounds=t.rounds||{};fn(t);
  tx.update(tref(id),{players:t.players,rounds:t.rounds,status:t.status,champion:t.champion||null});
});
const setView=h=>{app.innerHTML=h;icons()};
const needAuth=()=>{if(user)return true;authModal();return false};

/* ---------- auth ---------- */
F.onAuthStateChanged(auth,async u=>{
  user=u;profile=null;
  if(u){try{const s=await F.getDoc(F.doc(db,'users',u.uid));profile=s.exists()?s.data():null}catch(e){}}
  header();route();
});
function header(){
  $('#hdr').innerHTML=user?`<a href="#/me" class="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-xs font-semibold"><span class="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-volt to-neon text-ink">${esc((profile?.team||user.displayName||user.email||'?')[0].toUpperCase())}</span>${esc(profile?.team||'Set profile')}</a>`
    :`<button data-act="auth" class="btn btn-p !py-1.5">Sign in</button>`;
}
function authModal(){
  let mode='in';
  const m=modal(`<h3 class="mb-1 text-lg font-extrabold">Welcome to the Arena</h3><p class="mb-4 text-sm text-slate-400">Sign in to join and host tournaments.</p>
  <button id="g" class="btn btn-g mb-3 w-full"><i data-lucide="chrome" class="h-4 w-4"></i>Continue with Google</button>
  <div class="my-3 flex items-center gap-3 text-xs text-slate-500"><span class="h-px flex-1 bg-white/10"></span>or<span class="h-px flex-1 bg-white/10"></span></div>
  <form id="f" class="space-y-3"><input class="inp" name="email" type="email" placeholder="Email" required autocomplete="email"><input class="inp" name="password" type="password" placeholder="Password (min 6)" minlength="6" required autocomplete="current-password">
  <button class="btn btn-p w-full" id="go">Sign in</button></form>
  <button id="sw" class="mt-3 w-full text-center text-xs text-volt">New here? Create account</button>`);
  m.$('#g').onclick=async()=>{try{await F.signInWithPopup(auth,new F.GoogleAuthProvider());m.close()}catch(e){toast(e.message,'err')}};
  m.$('#sw').onclick=()=>{mode=mode==='in'?'up':'in';m.$('#go').textContent=mode==='in'?'Sign in':'Create account';m.$('#sw').textContent=mode==='in'?'New here? Create account':'Have an account? Sign in'};
  m.$('#f').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    try{await(mode==='in'?F.signInWithEmailAndPassword:F.createUserWithEmailAndPassword)(auth,d.email,d.password);m.close()}catch(err){toast(err.message.replace('Firebase: ',''),'err')}};
}

/* ---------- router ---------- */
function route(){
  if(unsub){unsub();unsub=null}
  if(!F.configured)return setView(`<div class="m-4 glass rounded-2xl p-5"><h2 class="font-bold text-gold">Firebase not configured</h2><p class="mt-2 text-sm text-slate-300">Open <code>js/firebase.js</code> and paste your Firebase web config (see README).</p></div>`);
  const [,p,a,b,c]=location.hash.split('/');
  document.querySelectorAll('[data-nav]').forEach(n=>{const on=n.dataset.nav===(p||'');n.classList.toggle('text-volt',on);n.classList.toggle('text-slate-400',!on)});
  setView(skeleton());window.scrollTo(0,0);
  if(p==='t')return tourney(a);
  if(p==='m')return matchView(a,+b,+c);
  if(p==='new')return createView();
  if(p==='me')return profileView();
  feed();
}
addEventListener('hashchange',route);

/* ---------- feed ---------- */
function feed(){
  unsub=F.onSnapshot(F.query(F.collection(db,'tournaments'),F.orderBy('createdAt','desc')),s=>{S.list=s.docs.map(d=>({id:d.id,...d.data()}));drawFeed()},e=>toast(e.message,'err'));
}
function drawFeed(){
  const tabs=[['live','Active','zap'],['open','Upcoming','calendar-clock'],['done','Completed','medal']];
  const list=S.list.filter(t=>t.status===S.tab);
  setView(`<div class="p-4"><h1 class="text-2xl font-extrabold tracking-tight">Tournaments</h1><p class="text-sm text-slate-400">Fair play. Transparent prizes.</p>
  <div class="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-slate-900/70 p-1">${tabs.map(([k,l,i])=>`<button data-act="tab" data-k="${k}" class="flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${S.tab===k?'bg-volt text-ink shadow':'text-slate-400'}"><i data-lucide="${i}" class="h-3.5 w-3.5"></i>${l}</button>`).join('')}</div>
  <div class="mt-4 space-y-3">${list.map(card).join('')||`<div class="glass rounded-2xl p-8 text-center text-sm text-slate-400"><i data-lucide="ghost" class="mx-auto mb-2 h-8 w-8"></i>Nothing here yet.</div>`}</div></div>`);
}
function card(t){
  const [bl,bc]=statusBadge(t.status),n=(t.players||[]).length;
  return `<a href="#/t/${t.id}" class="glass block rounded-2xl p-4 transition hover:border-volt/40 active:scale-[.98]">
  <div class="flex items-start justify-between gap-2"><h3 class="font-bold leading-tight">${esc(t.name)}</h3><span class="badge ${bc}">${bl}</span></div>
  <p class="mt-1 text-xs text-slate-400">by ${esc(t.hostName)} · ${t.start?new Date(t.start).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'TBA'}</p>
  <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div class="rounded-xl bg-slate-900/60 py-2"><div class="font-extrabold text-gold">${money(prizeTotal(t))}</div>Prize</div>
  <div class="rounded-xl bg-slate-900/60 py-2"><div class="font-extrabold">${t.fee>0?money(t.fee):'FREE'}</div>Entry</div>
  <div class="rounded-xl bg-slate-900/60 py-2"><div class="font-extrabold text-neon">${n}/${t.max}</div>Teams</div></div></a>`;
}

/* ---------- tournament page ---------- */
function tourney(id){
  unsub=F.onSnapshot(tref(id),s=>{if(!s.exists())return setView('<p class="p-8 text-center text-slate-400">Tournament not found.</p>');T={id,...s.data()};drawT()},e=>toast(e.message,'err'));
}
function transparency(t){
  const n=t.players.length,col=t.fee*n,fee=Math.round(col*t.feePct/100),net=col-fee,pt=prizeTotal(t),lbl=['🥇 1st','🥈 2nd','🥉 3rd'];
  return `<section class="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-4 backdrop-blur-md">
  <div class="mb-3 flex items-center gap-2 font-bold text-gold"><i data-lucide="shield-check" class="h-5 w-5"></i>Prize Pool & Management Fee</div>
  <div class="space-y-1.5 text-sm">
  <div class="flex justify-between"><span class="text-slate-400">Entry fee × teams</span><span>${money(t.fee)} × ${n}</span></div>
  <div class="flex justify-between"><span class="text-slate-400">Total collected</span><b>${money(col)}</b></div>
  <div class="flex justify-between text-red-300"><span>Management fee (${t.feePct}%)</span><b>− ${money(fee)}</b></div>
  <div class="flex justify-between border-t border-white/10 pt-1.5"><span class="text-slate-400">Net available</span><b class="text-neon">${money(net)}</b></div></div>
  <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">${(t.prizes||[]).map((p,i)=>p>0?`<div class="rounded-xl bg-black/20 py-2"><div class="text-[11px] text-slate-400">${lbl[i]}</div><b class="text-gold">${money(p)}</b></div>`:'').join('')}</div>
  ${pt>net?`<p class="mt-3 rounded-lg bg-gold/10 p-2 text-xs text-gold">Declared prizes (${money(pt)}) exceed the current net. They fully unlock as more teams join; the host guarantees the declared amounts.</p>`:''}</section>`;
}
function drawT(){
  const t=T,host=user&&t.hostId===user.uid,joined=user&&t.players.some(p=>p.uid===user.uid),full=t.players.length>=t.max;
  const [bl,bc]=statusBadge(t.status);
  const all=[];Object.keys(t.rounds||{}).forEach((k,r)=>t.rounds[k].forEach((m,i)=>all.push({m,r,i})));
  const mine=user&&all.find(x=>x.m.status!=='done'&&x.m.a&&x.m.b&&(x.m.a.uid===user.uid||x.m.b.uid===user.uid));
  const review=host?all.filter(x=>['submitted','confirmed','disputed'].includes(x.m.status)):[];
  setView(`<div class="space-y-4 p-4">
  <div><span class="badge ${bc}">${bl}</span><h1 class="mt-2 text-2xl font-extrabold leading-tight">${esc(t.name)}</h1>
  <p class="text-xs text-slate-400">Hosted by ${esc(t.hostName)} · ${t.start?new Date(t.start).toLocaleString():'TBA'}</p></div>
  ${t.champion?`<div class="rounded-2xl bg-gradient-to-r from-gold/30 to-gold/5 p-4 text-center"><i data-lucide="crown" class="mx-auto h-8 w-8 text-gold"></i><div class="text-xs text-gold">CHAMPION</div><div class="text-xl font-extrabold">${esc(t.champion.team)}</div></div>`:''}
  ${transparency(t)}
  <div class="flex gap-2">
  ${t.status==='open'&&!joined&&!full?`<button data-act="join" class="btn btn-n flex-1"><i data-lucide="log-in" class="h-4 w-4"></i>Join · ${t.fee>0?money(t.fee):'Free'}</button>`:''}
  ${joined&&t.status==='open'?`<div class="btn btn-g flex-1 !text-neon"><i data-lucide="check-circle-2" class="h-4 w-4"></i>You're in</div>`:''}
  ${mine?`<a href="#/m/${t.id}/${mine.r}/${mine.i}" class="btn btn-p flex-1"><i data-lucide="gamepad-2" class="h-4 w-4"></i>Open my match room</a>`:''}
  <button data-act="guide" class="btn btn-g"><i data-lucide="scale" class="h-4 w-4"></i>Rules</button></div>
  ${joined&&t.fee>0&&t.payInfo?`<div class="glass rounded-2xl p-3 text-sm"><b class="text-volt">Payment instructions</b><p class="mt-1 whitespace-pre-line text-slate-300">${esc(t.payInfo)}</p></div>`:''}
  ${host?`<section class="glass rounded-2xl p-4"><div class="mb-2 flex items-center gap-2 font-bold"><i data-lucide="shield" class="h-4 w-4 text-volt"></i>Host admin</div>
   ${t.status==='open'?`<button data-act="start" class="btn btn-p w-full" ${t.players.length<2?'disabled':''}>Generate bracket & start (${t.players.length} teams)</button>`:''}
   ${review.length?`<div class="mt-3 space-y-2"><div class="text-xs text-slate-400">Needs your review</div>${review.map(x=>`<a href="#/m/${t.id}/${x.r}/${x.i}" class="flex items-center justify-between rounded-xl bg-slate-900/60 p-3 text-sm"><span>${esc(x.m.a.team)} vs ${esc(x.m.b.team)}</span><span class="badge ${x.m.status==='disputed'?'bg-red-500/20 text-red-300':'bg-gold/20 text-gold'}">${x.m.status}</span></a>`).join('')}</div>`:(t.status!=='open'?'<p class="text-sm text-slate-400">No results waiting for review.</p>':'')}</section>`:''}
  ${t.rounds&&Object.keys(t.rounds).length?`<section><h2 class="mb-2 font-bold">Bracket</h2>${renderBracket(t,user?.uid)}</section>`:''}
  <section><h2 class="mb-2 font-bold">Teams (${t.players.length}/${t.max})</h2><div class="grid gap-2 sm:grid-cols-2">${t.players.map((p,i)=>`<div class="glass flex items-center gap-3 rounded-xl p-2.5 text-sm"><span class="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-xs font-bold">${i+1}</span>${esc(p.team)}</div>`).join('')||'<p class="text-sm text-slate-400">No teams yet.</p>'}</div></section>
  <section class="glass rounded-2xl p-4"><h2 class="mb-1 font-bold">Tournament rules</h2><p class="whitespace-pre-line text-sm text-slate-300">${esc(t.rules)}</p></section></div>`);
}
const actions={
  auth:authModal,
  tab:d=>{S.tab=d.k;drawFeed()},
  guide(){modal(`<h3 class="mb-3 flex items-center gap-2 text-lg font-extrabold"><i data-lucide="scale" class="h-5 w-5 text-volt"></i>Anti-Fixing Guidelines</h3><ul class="space-y-2 text-sm text-slate-300">
   <li>✅ Winner submits score + full screenshot. The opponent must <b>confirm</b> or <b>dispute</b>.</li><li>✅ The host reviews every result before the winner advances.</li>
   <li>🚫 Match fixing, selling matches or deliberate losing = permanent ban + prize forfeiture.</li><li>🚫 Fake or multiple accounts are disqualified.</li>
   <li>🔎 Disputes: both sides may be asked for the full match recording.</li><li>💰 Prize and management fee are shown openly on every tournament page.</li></ul>`)},
  join(){
    if(!needAuth())return;
    if(!complete(profile)){toast('Complete your profile first','err');location.hash='#/me';return}
    const m=modal(`<h3 class="mb-1 text-lg font-extrabold">Join ${esc(T.name)}</h3><p class="mb-3 text-sm text-slate-400">Entry ${T.fee>0?money(T.fee):'free'} · confirm the fair-play pledge:</p>
    <div class="space-y-2">${PLEDGE.map((p,i)=>`<label class="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-900/60 p-3 text-sm"><input type="checkbox" class="ck mt-0.5 h-4 w-4 accent-cyan-500">${p}</label>`).join('')}</div>
    <button id="ok" class="btn btn-n mt-4 w-full" disabled>Confirm & join</button>`);
    const cks=[...m.el.querySelectorAll('.ck')];
    cks.forEach(c=>c.onchange=()=>m.$('#ok').disabled=!cks.every(x=>x.checked));
    m.$('#ok').onclick=async()=>{try{await mut(T.id,t=>{if(t.status!=='open')throw Error('Registration closed');if(t.players.length>=t.max)throw Error('Tournament is full');if(t.players.some(p=>p.uid===user.uid))throw Error('Already joined');
      t.players.push({uid:user.uid,team:profile.team,code:profile.code,phone:profile.phone,fb:profile.fb||''})});m.close();toast('You joined! 🎮')}catch(e){toast(e.message,'err')}};
  },
  async start(){
    try{await mut(T.id,t=>{if(t.hostId!==user.uid)throw Error('Host only');t.rounds=build(t.players);t.status='live'});toast('Bracket generated')}catch(e){toast(e.message,'err')}
  },
  async logout(){await F.signOut(auth);location.hash='#/'}
};
document.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(a&&actions[a.dataset.act]){e.preventDefault();actions[a.dataset.act](a.dataset,e)}});

/* ---------- match hub ---------- */
function matchView(id,r,i){
  CUR={id,r,i};
  unsub=F.onSnapshot(tref(id),async s=>{
    if(!s.exists())return setView('<p class="p-8 text-center text-slate-400">Not found.</p>');
    T={id,...s.data()};const m=T.rounds?.['r'+r]?.[i];
    if(!m||!m.a||!m.b)return setView('<p class="p-8 text-center text-slate-400">This match is not ready yet.</p>');
    let proof=null;if(m.proof){try{const p=await F.getDoc(F.doc(db,'proofs',`${id}_${r}_${i}`));proof=p.exists()?p.data().img:null}catch(e){}}
    drawMatch(m,proof);
  },e=>toast(e.message,'err'));
}
function person(label,p,full){
  const wa=p.phone?`https://wa.me/${String(p.phone).replace(/\D/g,'')}`:'';
  const prof=T.players.find(x=>x.uid===p.uid)||{};
  return `<div class="glass rounded-2xl p-3"><div class="text-[11px] uppercase tracking-wide text-slate-400">${label}</div><div class="truncate text-lg font-extrabold">${esc(p.team)}</div>
  ${full?`<div class="mt-1 text-xs text-slate-400">DLS code <b class="select-all text-slate-200">${esc(prof.code||'-')}</b></div>
  <div class="mt-2 flex gap-2">${wa?`<a href="${wa}" target="_blank" rel="noopener" class="btn btn-n !px-3 !py-1.5 text-xs"><i data-lucide="message-circle" class="h-3.5 w-3.5"></i>WhatsApp</a>`:''}${prof.fb?`<a href="${esc(prof.fb)}" target="_blank" rel="noopener" class="btn btn-g !px-3 !py-1.5 text-xs"><i data-lucide="facebook" class="h-3.5 w-3.5"></i>Facebook</a>`:''}</div>`:''}</div>`;
}
function drawMatch(m,proof){
  const {id,r,i}=CUR,uid=user?.uid,isA=m.a.uid===uid,isB=m.b.uid===uid,me=isA||isB,host=user&&T.hostId===uid;
  const opp=isA?m.b:m.a,st=m.status;
  const submitter=m.submittedBy===uid;
  let result='';
  if(st==='done')result=`<div class="rounded-2xl bg-neon/10 p-4 text-center"><div class="text-xs text-neon">WINNER</div><div class="text-xl font-extrabold">${esc((m.winner===m.a.uid?m.a:m.b).team)}</div>${m.bye?'<div class="text-xs text-slate-400">Bye</div>':`<div class="text-lg font-black">${m.sa} – ${m.sb}</div>`}</div>`;
  else if(me&&(st==='pending'))result=`<form id="rf" class="glass space-y-3 rounded-2xl p-4"><h3 class="font-bold">Submit result</h3>
    <div class="grid grid-cols-2 gap-3"><div><label class="lbl">${esc(m.a.team)} goals</label><input class="inp text-center text-lg font-bold" name="sa" type="number" min="0" max="99" required inputmode="numeric"></div>
    <div><label class="lbl">${esc(m.b.team)} goals</label><input class="inp text-center text-lg font-bold" name="sb" type="number" min="0" max="99" required inputmode="numeric"></div></div>
    <div><label class="lbl">Screenshot proof (required)</label><input class="inp file:mr-3 file:rounded-lg file:border-0 file:bg-volt file:px-3 file:py-1 file:text-xs file:font-bold" name="img" type="file" accept="image/*" required></div>
    <button class="btn btn-p w-full" id="sub">Submit for confirmation</button><p class="text-[11px] text-slate-500">Your opponent must confirm before the host approves.</p></form>`;
  else if(st==='submitted'||st==='confirmed'||st==='disputed'){
    result=`<div class="glass space-y-3 rounded-2xl p-4"><div class="flex items-center justify-between"><h3 class="font-bold">Submitted result</h3><span class="badge ${st==='disputed'?'bg-red-500/20 text-red-300':st==='confirmed'?'bg-neon/20 text-neon':'bg-gold/20 text-gold'}">${st}</span></div>
    <div class="text-center text-3xl font-black">${esc(m.a.team)} <span class="text-volt">${m.sa} – ${m.sb}</span> ${esc(m.b.team)}</div>
    ${proof?`<img src="${proof}" alt="Result proof" class="max-h-80 w-full rounded-xl object-contain bg-black/40">`:''}
    ${st==='disputed'?`<p class="rounded-lg bg-red-500/10 p-2 text-sm text-red-300">Dispute: ${esc(m.disputeReason||'No reason given')}. Waiting for the host.</p>`:''}
    ${me&&st==='submitted'&&!submitter?`<div class="grid grid-cols-2 gap-2"><button data-r="confirm" class="btn btn-n"><i data-lucide="check" class="h-4 w-4"></i>Confirm</button><button data-r="dispute" class="btn btn-d"><i data-lucide="flag" class="h-4 w-4"></i>Dispute</button></div>`:''}
    ${me&&st==='submitted'&&submitter?'<p class="text-center text-sm text-slate-400">Waiting for your opponent to confirm…</p>':''}
    ${st==='confirmed'?'<p class="text-center text-sm text-slate-400">Both players agree. Waiting for host approval.</p>':''}</div>`;
    if(host)result+=`<div class="rounded-2xl border border-volt/40 bg-volt/5 p-4"><div class="mb-2 font-bold text-volt">Host decision</div><div class="grid grid-cols-2 gap-2">
      <button data-r="win" data-w="${m.a.uid}" class="btn btn-p ${m.sa>m.sb?'':'btn-g'}">${esc(m.a.team)} wins</button><button data-r="win" data-w="${m.b.uid}" class="btn btn-p ${m.sb>m.sa?'':'btn-g'}">${esc(m.b.team)} wins</button></div></div>`;
  }else if(!me)result='<p class="text-center text-sm text-slate-400">Waiting for players to submit a result.</p>';
  setView(`<div class="space-y-4 p-4"><a href="#/t/${id}" class="inline-flex items-center gap-1 text-xs text-slate-400"><i data-lucide="chevron-left" class="h-4 w-4"></i>${esc(T.name)}</a>
  <h1 class="text-xl font-extrabold">Match Room</h1>
  <div class="grid gap-3 sm:grid-cols-2">${me?person('Your opponent',opp,true):person('Team A',m.a,host)+person('Team B',m.b,host)}</div>
  <div class="rounded-2xl border border-volt/40 bg-gradient-to-br from-volt/10 to-transparent p-4"><div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-volt"><i data-lucide="door-open" class="h-4 w-4"></i>Private room code</div>
   ${m.room?`<div class="mt-1 select-all text-3xl font-black tracking-widest">${esc(m.room)}</div>`:'<p class="mt-1 text-sm text-slate-400">Not created yet. Create the room in DLS, then share the code here.</p>'}
   ${me&&st!=='done'?`<div class="mt-3 flex gap-2"><input id="room" class="inp" maxlength="20" placeholder="Enter room code" value="${esc(m.room)}"><button data-r="room" class="btn btn-p">Save</button></div>`:''}</div>
  ${result}</div>`);
}
/* match-level actions (delegated) */
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-r]');if(!b||!CUR)return;
  const {id,r,i}=CUR,act=b.dataset.r,upd=fn=>mut(id,t=>fn(t.rounds['r'+r][i],t)).catch(x=>toast(x.message,'err'));
  if(act==='room'){const v=$('#room').value.trim();if(v)upd(m=>{m.room=v});}
  if(act==='confirm')upd(m=>{if(m.submittedBy===user.uid)throw Error('Opponent must confirm');m.status='confirmed'});
  if(act==='dispute'){const why=prompt('Why are you disputing this result?');if(why)upd(m=>{m.status='disputed';m.disputeReason=why.slice(0,300)})}
  if(act==='win')upd((m,t)=>{if(t.hostId!==user.uid)throw Error('Host only');const w=b.dataset.w===m.a.uid?m.a:m.b;m.winner=w.uid;m.status='done';advance(t.rounds,r,i,w);
    if(!t.rounds['r'+(r+1)]){t.status='done';t.champion={uid:w.uid,team:w.team}}});
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='rf'||!CUR)return;e.preventDefault();
  const {id,r,i}=CUR,d=new FormData(e.target),sa=+d.get('sa'),sb=+d.get('sb'),btn=$('#sub');
  if(sa===sb)return toast('Draws are not allowed. Play extra time/penalties.','err');
  btn.disabled=true;btn.textContent='Uploading…';
  try{
    const img=await shrink(d.get('img'));
    await F.setDoc(F.doc(db,'proofs',`${id}_${r}_${i}`),{img,by:user.uid,at:F.serverTimestamp()});
    await mut(id,t=>{const m=t.rounds['r'+r][i];if(m.status!=='pending')throw Error('Already submitted');m.sa=sa;m.sb=sb;m.status='submitted';m.submittedBy=user.uid;m.proof=true});
    toast('Submitted. Waiting for opponent');
  }catch(err){toast(err.message,'err');btn.disabled=false;btn.textContent='Submit for confirmation'}
});
/** Resize + compress to a ~100KB JPEG so it fits a Firestore doc (no paid Storage needed). */
function shrink(file,max=900){return new Promise((res,rej)=>{const im=new Image(),u=URL.createObjectURL(file);
  im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.6))};
  im.onerror=()=>rej(Error('Could not read image'));im.src=u})}

/* ---------- create tournament ---------- */
function createView(){
  if(!user){setView('<div class="p-8 text-center"><p class="mb-4 text-slate-400">Sign in to host a tournament.</p><button data-act="auth" class="btn btn-p">Sign in</button></div>');return}
  if(!complete(profile)){setView('<div class="p-8 text-center"><p class="mb-4 text-slate-400">Complete your profile before hosting.</p><a href="#/me" class="btn btn-p">Go to profile</a></div>');return}
  setView(`<form id="cf" class="space-y-4 p-4"><h1 class="text-2xl font-extrabold">Host a tournament</h1>
  <div><label class="lbl">Tournament name</label><input class="inp" name="name" required maxlength="60" placeholder="Friday Night Cup"></div>
  <div class="grid grid-cols-2 gap-3"><div><label class="lbl">Max teams</label><select class="inp" name="max"><option>8</option><option>16</option><option>32</option></select></div>
  <div><label class="lbl">Entry fee (৳)</label><input class="inp" name="fee" type="number" min="0" value="0" required></div></div>
  <div><label class="lbl">Start date & time</label><input class="inp" name="start" type="datetime-local" required></div>
  <div class="glass rounded-2xl p-3"><div class="mb-2 text-sm font-bold text-gold">Prize pool breakdown (৳)</div><div class="grid grid-cols-3 gap-2">
   <div><label class="lbl">🥇 1st</label><input class="inp" name="p1" type="number" min="0" value="0"></div><div><label class="lbl">🥈 2nd</label><input class="inp" name="p2" type="number" min="0" value="0"></div><div><label class="lbl">🥉 3rd</label><input class="inp" name="p3" type="number" min="0" value="0"></div></div>
   <div class="mt-3"><label class="lbl">Management fee (% of entry fees)</label><input class="inp" name="feePct" type="number" min="0" max="30" value="10" required></div></div>
  <div><label class="lbl">Payment instructions (shown only to joined players)</label><textarea class="inp" name="payInfo" rows="2" placeholder="bKash 01XXXXXXXXX, send money, use team name as reference"></textarea></div>
  <div><label class="lbl">Rules</label><textarea class="inp" name="rules" rows="5">${DEFAULT_RULES}</textarea></div>
  <button class="btn btn-p w-full" id="cb">Create tournament</button></form>`);
  $('#cf').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));$('#cb').disabled=true;
    try{const ref=await F.addDoc(F.collection(db,'tournaments'),{name:d.name.trim(),rules:d.rules,fee:+d.fee,feePct:+d.feePct,prizes:[+d.p1,+d.p2,+d.p3],payInfo:d.payInfo,max:+d.max,start:d.start,
      hostId:user.uid,hostName:profile.team,status:'open',players:[],rounds:{},champion:null,createdAt:F.serverTimestamp()});
      toast('Tournament created');location.hash='#/t/'+ref.id}catch(err){toast(err.message,'err');$('#cb').disabled=false}};
}

/* ---------- profile ---------- */
function profileView(){
  if(!user){setView('<div class="p-8 text-center"><p class="mb-4 text-slate-400">Sign in to manage your profile.</p><button data-act="auth" class="btn btn-p">Sign in</button></div>');return}
  const p=profile||{};
  setView(`<form id="pf" class="space-y-4 p-4"><h1 class="text-2xl font-extrabold">Your profile</h1><p class="text-sm text-slate-400">${esc(user.email||'')} · shown to your opponents inside match rooms.</p>
  <div><label class="lbl">DLS team name</label><input class="inp" name="team" required maxlength="30" value="${esc(p.team)}"></div>
  <div><label class="lbl">In-game user code</label><input class="inp" name="code" required maxlength="30" value="${esc(p.code)}"></div>
  <div><label class="lbl">WhatsApp / phone (with country code)</label><input class="inp" name="phone" required type="tel" placeholder="8801XXXXXXXXX" value="${esc(p.phone)}"></div>
  <div><label class="lbl">Facebook profile link</label><input class="inp" name="fb" type="url" placeholder="https://facebook.com/…" value="${esc(p.fb)}"></div>
  <button class="btn btn-p w-full">Save profile</button><button type="button" data-act="logout" class="btn btn-g w-full"><i data-lucide="log-out" class="h-4 w-4"></i>Sign out</button></form>`);
  $('#pf').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    try{await F.setDoc(F.doc(db,'users',user.uid),d,{merge:true});profile={...profile,...d};header();toast('Profile saved')}catch(err){toast(err.message,'err')}};
}
