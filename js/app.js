import * as F from './firebase.js';
import {$,esc,money,icons,skeleton,toast,modal} from './ui.js';
import {build, renderBracket, advance} from './bracket.js';

const {auth,db}=F,app=$('#app');
let user=null,profile=null,unsub=null,T=null,S={tab:'open',list:[],q:''};

const ADMIN_EMAIL = 'theshabbirtech@gmail.com';

const tref=id=>F.doc(db,'tournaments',id);
const complete=p=>p&&p.team&&p.phone&&p.avatar;
const fdate=s=>s?new Date(s).toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short'}):'নির্ধারিত নয়';
const countdown=s=>{if(!s)return '';const ms=new Date(s)-Date.now();return isNaN(ms)?'':ms<=0?'शीঘ্রই শুরু হচ্ছে':`শুরু হবে ${Math.floor(ms/60000)}মি এ`;};
const run=async(fn,ok)=>{try{await fn();if(ok)toast(ok);return true}catch(e){toast(e.message,'err');return false}};
const setView=h=>{app.innerHTML=h;icons()};
const needAuth=()=>{if(user)return true;authModal();return false};
const listen=draw=>{unsub=F.onSnapshot(F.query(F.collection(db,'tournaments'),F.orderBy('createdAt','desc')),s=>{S.list=s.docs.map(d=>({id:d.id,...d.data()}));draw()},e=>toast(e.message,'err'))};

F.onAuthStateChanged(auth,async u=>{
  user=u;profile=null;
  if(u){try{const s=await F.getDoc(F.doc(db,'users',u.uid));profile=s.exists()?s.data():null}catch(e){}}
  header();route();
});

function header(){
  const bal = profile?.balance || 0;
  $('#hdr').innerHTML=`<div class="flex items-center gap-1.5 shrink-0">
    <a href="#/wallet" class="glass px-2.5 py-1 rounded-full text-[11px] font-bold text-gold border border-gold/30 hover:border-gold transition whitespace-nowrap">Bal: ৳${bal}</a>
    ${user?`<a href="#/me" class="flex items-center gap-1 rounded-full bg-white/10 py-0.5 pl-1 pr-2 text-[11px] font-semibold"><img src="${esc(profile?.avatar||'https://via.placeholder.com/30')}" class="h-5 w-5 rounded-full object-cover"><span class="max-w-[4rem] truncate">${esc(profile?.team||'প্রোফাইল')}</span></a>`:`<button data-act="auth" class="btn btn-p !py-1 !px-2 text-[11px]">লগইন</button>`}
  </div>`;
  icons();
}

function nav(){
  const it=[['','gamepad-2','টুর্নামেন্ট','#/'],['history','scroll','হিস্টরি','#/history'],['wallet','wallet','ওয়ালেট','#/wallet'],['me','user-round','প্রোফাইল','#/me']];
  $('#nav').innerHTML=`<div class="mx-auto grid max-w-3xl grid-cols-4 bg-ink/95 border-t border-white/10">${it.map(([k,i,l,h])=>`<a href="${h}" data-nav="${k}" class="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-slate-300 transition"><i data-lucide="${i}" class="h-4 w-4"></i>${l}</a>`).join('')}</div>`;
  icons();
}

function authModal(){
  let mode='in';
  const m=modal(`<h3 class="mb-1 text-lg font-bold">DLS Tournament Hub</h3><p class="mb-4 text-sm text-slate-300">টুর্নামেন্টে যোগ দিতে প্রবেশ করুন।</p>
  <button id="g" class="btn btn-g mb-3 w-full"><i data-lucide="chrome" class="h-4 w-4"></i>গুগল (Google) দিয়ে চালিয়ে যান</button>
  <div class="my-3 flex items-center gap-3 text-xs text-slate-400"><span class="h-px flex-1 bg-white/10"></span>অথবা<span class="h-px flex-1 bg-white/10"></span></div>
  <form id="f" class="space-y-3"><input class="inp" name="email" type="email" placeholder="ইমেইল" required autocomplete="email"><input class="inp" name="password" type="password" placeholder="পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)" minlength="6" required autocomplete="current-password">
  <button class="btn btn-p w-full" id="go">প্রবেশ করুন</button></form>
  <button id="sw" class="mt-3 w-full text-center text-xs text-volt font-semibold">নতুন একাউন্ট খুলতে চান? রেজিস্টার করুন</button>`);
  m.$('#g').onclick=async()=>{try{await F.signInWithPopup(auth,new F.GoogleAuthProvider());m.close()}catch(e){toast(e.message,'err')}};
  m.$('#sw').onclick=()=>{mode=mode==='in'?'up':'in';m.$('#go').textContent=mode==='in'?'প্রবেশ করুন':'একাউন্ট তৈরি করুন';m.$('#sw').textContent=mode==='in'?'নতুন একাউন্ট খুলতে চান? রেজিস্টার করুন':'আগে থেকেই আছে? প্রবেশ করুন'};
  m.$('#f').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    try{await(mode==='in'?F.signInWithEmailAndPassword:F.createUserWithEmailAndPassword)(auth,d.email,d.password);m.close()}catch(err){toast(err.message.replace('Firebase: ',''),'err')}};
}

function route(){
  if(unsub){unsub();unsub=null}
  if(!F.configured)return setView(`<div class="m-4 glass rounded-2xl p-5"><h2 class="font-bold text-gold">ফায়ারবেজ কনফিগার করা হয়নি</h2></div>`);
  const [,p,a,r,i]=location.hash.split('/');
  document.querySelectorAll('[data-nav]').forEach(n=>{const on=n.dataset.nav===(p||'');n.classList.toggle('text-volt',on);n.classList.toggle('font-bold',on);n.classList.toggle('text-slate-300',!on)});
  setView(skeleton());window.scrollTo(0,0);
  
  if(p==='admin')return adminView();
  if(p==='t')return tourney(a);
  if(p==='m')return matchView(a,r,i);
  if(p==='wallet')return walletView();
  if(p==='history')return historyView();
  if(p==='me')return profileView();
  listen(drawFeed);
}
addEventListener('hashchange',route);
nav();

function drawFeed(){
  setView(`<div class="space-y-5 py-4 max-w-xl mx-auto pb-24">
    <h1 class="text-base font-black text-slate-100 flex items-center gap-1.5"><i data-lucide="zap" class="h-4 w-4 text-volt"></i>চলমান ও আসন্ন টুর্নামেন্টসমূহ</h1>
    <div id="fl" class="space-y-3.5"></div>
    
    <div class="glass rounded-2xl p-4 space-y-2 border border-volt/30">
      <h2 class="font-bold text-volt text-xs flex items-center gap-1.5"><i data-lucide="help-circle" class="h-4 w-4"></i>টুর্নামেন্টে জয়েন করার নিয়ম ও নির্দেশাবলী (FAQ)</h2>
      <div class="space-y-1.5 text-xs text-slate-300">
        <p><b>১. প্রোফাইল সেটআপ:</b> প্রথমে প্রোফাইল অপশনে গিয়ে সঠিক টিম নাম, মোবাইল নম্বর এবং পিকচার দিন (বাধ্যতামূলক)।</p>
        <p><b>২. ওয়ালেট ব্যালেন্স:</b> ওয়ালেট অপশনে গিয়ে বিকাশ/নগদ থেকে 'এড মানি' করুন।</p>
        <p><b>৩. টুর্নামেন্ট জয়েন:</b> পছন্দের টুর্নামেন্টে প্রবেশ করে 'জয়েন করুন' ক্লিক করলে ফি কেটে নেওয়া হবে।</p>
        <p><b>৪. ম্যাচ খেলা:</b> স্লট পূর্ণ হলে ব্র্যাকেট জেনারেট হবে। ব্র্যাকেটে আপনার ম্যাচে ক্লিক করে প্রতিপক্ষের সাথে ৫ মিনিটের ডিএলএস রুম কোড শেয়ার করে খেলুন!</p>
      </div>
    </div>
  </div>`);
  drawList();
}

function drawList(){
  const list=S.list;
  const el=$('#fl');if(!el)return;
  el.innerHTML=list.map(t=>{
    const n=(t.players||[]).length, max=t.max||2;
    const pct=Math.min(100,(n/max)*100);
    const cd=countdown(t.start);
    return `<div class="glass rounded-2xl p-4 space-y-3 relative overflow-hidden border border-white/10 hover:border-volt/30 transition">
      <div class="flex justify-between items-start gap-2"><h3 class="text-sm font-bold text-slate-100 truncate">${esc(t.name)}</h3><span class="text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap"><i data-lucide="calendar" class="h-3.5 w-3.5 text-volt"></i>${fdate(t.start)}</span></div>
      ${cd?`<div class="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-300 flex items-center gap-2"><i data-lucide="hourglass" class="h-4 w-4 shrink-0"></i>${cd}</div>`:''}
      <div class="grid grid-cols-2 gap-2 bg-slate-900/60 p-3 rounded-xl">
        <div><div class="text-[11px] text-slate-400 font-medium">এন্ট্রি ফি:</div><div class="text-base font-black text-volt">৳${t.fee||0}</div></div>
        <div><div class="text-[11px] text-slate-400 font-medium">উইনিং প্রাইজ:</div><div class="text-base font-black text-gold">৳${t.winnerPrize||0}</div></div>
      </div>
      <div class="space-y-1">
        <div class="flex justify-between text-xs font-semibold text-slate-300"><span>স্লট ফিলাপ (${t.type || 'Knockout'})</span><span>${n}/${max} Slots</span></div>
        <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-volt to-neon rounded-full" style="width:${pct}%"></div></div>
      </div>
      <a href="#/t/${t.id}" class="btn btn-n w-full py-2.5 text-center text-xs font-bold block">টুর্নামেন্ট বিস্তারিত ও জয়েন</a>
    </div>`;
  }).join('')||`<div class="glass rounded-2xl p-8 text-center text-xs text-slate-300">বর্তমানে কোনো টুর্নামেন্ট নেই।</div>`;
  icons();
}

function walletView(){
  if(!needAuth())return;
  const bal = profile?.balance || 0, winBal = profile?.winBalance || 0;
  setView(`<div class="space-y-5 py-4 max-w-xl mx-auto pb-24">
    <div class="glass rounded-3xl p-5 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-gold/30">
      <div class="text-xs text-slate-400 font-medium">আমার ওয়ালেট একাউন্ট</div>
      <div class="grid grid-cols-2 gap-3.5 mt-3">
        <div class="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5"><div class="text-xs text-slate-400">মেইন ব্যালেন্স</div><div class="text-xl font-black text-volt mt-0.5">৳${bal}</div></div>
        <div class="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5"><div class="text-xs text-slate-400">উইনিং ব্যালেন্স</div><div class="text-xl font-black text-gold mt-0.5">৳${winBal}</div></div>
      </div>
    </div>
    <div class="glass rounded-2xl p-5 space-y-3 text-center">
      <p class="text-xs text-slate-300">টাকা এড করতে বা তুলতে নিচের বাটন ব্যবহার করুন</p>
      <div class="grid grid-cols-2 gap-3">
        <button data-act="addMoneyModal" class="btn btn-n py-3 text-xs font-bold">এড মানি</button>
        <button data-act="withdrawModal" class="btn btn-p py-3 text-xs font-bold">উইথড্র</button>
      </div>
    </div>
  </div>`);
  icons();
}

const actions={
  auth:authModal,
  addMoneyModal(){
    const m=modal(`<div class="space-y-4">
      <h3 class="text-base font-bold text-slate-100 border-b border-white/10 pb-2">টাকা এড করুন</h3>
      <div class="rounded-2xl bg-slate-900 p-4 border border-volt/40 text-center space-y-2">
        <div class="text-xs text-slate-400 font-medium">অফিশিয়াল বিকাশ/নগদ পার্সোনাল নম্বর</div>
        <div class="text-2xl font-black text-volt tracking-wider select-all">01878254585</div>
        <button type="button" id="copyBtn" class="btn btn-n !py-1 !px-4 text-xs font-bold inline-flex items-center gap-1.5"><i data-lucide="copy" class="h-3.5 w-3.5"></i>নম্বর কপি করুন</button>
      </div>
      <div class="rounded-2xl bg-slate-900/80 p-3 space-y-1 text-xs text-slate-300 border border-white/10">
        <div class="font-bold text-volt">নির্দেশাবলী:</div>
        <p>১. উপরে দেওয়া নম্বরে Send Money করুন।</p>
        <p>২. সঠিক টাকা পাঠিয়ে নিচের বক্সে পরিমাণ ও TrxID দিন।</p>
      </div>
      <div><label class="lbl text-xs">টাকার পরিমাণ</label><input id="am" class="inp text-sm" type="number" placeholder="যেমন: ১০০" min="10"></div>
      <div><label class="lbl text-xs">ট্রানজেকশন আইডি (TrxID)</label><input id="tx" class="inp text-sm" placeholder="যেমন: 8N7X9W2K3L" maxlength="30"></div>
      <button id="verifyBtn" class="btn btn-n w-full py-3 font-bold">VERIFY & SUBMIT</button>
    </div>`);

    m.$('#copyBtn').onclick=()=>{
      navigator.clipboard.writeText('01878254585');
      toast('নম্বর সফলভাবে কপি হয়েছে!');
    };

    m.$('#verifyBtn').onclick=async()=>{
      const amount=+m.$('#am').value, trx=m.$('#tx').value.trim();
      if(!amount||amount<=0||trx.length<5)return toast('সঠিক পরিমাণ ও TrxID দিন','err');
      try {
        await F.addDoc(F.collection(db,'deposits'),{uid:user.uid, team:profile?.team||'User', amount, trx, status:'pending', createdAt:F.serverTimestamp()});
        toast('ডিপোজিট অনুরোধ সফলভাবে পাঠানো হয়েছে!'); m.close();
      } catch(e){toast(e.message,'err')}
    };
  },
  withdrawModal(){
    const m=modal(`<div class="space-y-4">
      <h3 class="text-base font-bold text-slate-100 border-b border-white/10 pb-2">টাকা উইথড্র করুন</h3>
      <div class="rounded-2xl bg-slate-900/80 p-3.5 space-y-1 text-xs text-slate-300 border border-white/10">
        <div class="font-bold text-volt">উইথড্র নির্দেশাবলী:</div>
        <p>১. ন্যূনতম উইথড্র ১০০ টাকা।</p>
        <p>২. ২৪ ঘণ্টার মধ্যে পেমেন্ট কমপ্লিট করা হবে।</p>
      </div>
      <div><label class="lbl text-xs">বিকাশ/নগদ নম্বর (Personal)</label><input id="wn" class="inp text-sm" type="tel" placeholder="01XXXXXXXXX"></div>
      <div><label class="lbl text-xs">পরিমাণ (৳)</label><input id="wa" class="inp text-sm" type="number" placeholder="ন্যূনতম ১০০ টাকা" min="100"></div>
      <button id="wBtn" class="btn btn-p w-full py-3 font-bold">উইথড্র অনুরোধ পাঠান</button>
    </div>`);
    m.$('#wBtn').onclick=async()=>{
      const amount=+m.$('#wa').value, phone=m.$('#wn').value.trim();
      if(amount<100||!phone)return toast('ন্যূনতম ১০০ টাকা এবং সঠিক নম্বর দিন','err');
      if((profile?.winBalance||0)<amount)return toast('পর্যাপ্ত উইনিং ব্যালেন্স নেই!','err');
      try {
        await F.addDoc(F.collection(db,'withdraws'),{uid:user.uid, team:profile?.team||'User', amount, phone, status:'pending', createdAt:F.serverTimestamp()});
        toast('উইথড্র অনুরোধ জমা হয়েছে।'); m.close();
      } catch(e){toast(e.message,'err')}
    };
  }
};
document.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(a&&actions[a.dataset.act]){e.preventDefault();actions[a.dataset.act]()}});

function tourney(id){
  unsub=F.onSnapshot(tref(id),s=>{if(!s.exists())return setView(`<p class="p-8 text-center text-slate-300">টুর্নামেন্ট পাওয়া যায়নি</p>`);T={id,...s.data()};T.players=T.players||[];drawT()},e=>toast(e.message,'err'));
}

function drawT(){
  const t=T,uid=user?.uid,me=uid&&t.players.find(p=>p.uid===uid),full=t.players.length>=t.max;
  const n=(t.players||[]).length;
  const isAdmin = user && user.email === ADMIN_EMAIL;

  setView(`<div class="space-y-4 py-4 max-w-xl mx-auto pb-24">
    <a href="#/" class="inline-flex items-center gap-1 text-xs text-volt font-medium"><i data-lucide="chevron-left" class="h-4 w-4"></i>ফিরে যান</a>
    <div class="glass rounded-3xl p-5 space-y-4 border border-white/10">
      <div class="flex justify-between items-start gap-2"><h1 class="text-base font-black text-slate-100">${esc(t.name)}</h1><span class="badge bg-volt/15 text-volt text-xs">${t.type || 'Knockout'}</span></div>
      <div class="grid grid-cols-2 gap-2.5 bg-slate-900/60 p-3.5 rounded-2xl">
        <div><div class="text-xs text-slate-400">এন্ট্রি ফি:</div><div class="text-lg font-black text-volt">৳${t.fee||0}</div></div>
        <div><div class="text-xs text-slate-400">উইনিং প্রাইজ:</div><div class="text-lg font-black text-gold">৳${t.winnerPrize||0}</div></div>
      </div>
      <div class="bg-slate-900/80 p-3 rounded-xl text-xs space-y-1">
        <div>🥇 Winner: <b>৳${t.winnerPrize||0}</b></div>
        <div>🥈 Runner-up: <b>৳${t.runnerUpPrize||0}</b></div>
      </div>
      ${!me&&!full?`<button data-act="join" class="btn btn-n w-full py-3 font-bold text-sm">টুর্নামেন্ট জয়েন করুন</button>`:''}
      ${me?`<div class="rounded-xl bg-neon/10 p-3 text-center text-neon font-bold text-xs">✔ আপনি সফলভাবে জয়েন করেছেন</div>`:''}
    </div>

    <div class="glass rounded-2xl p-4 space-y-3">
      <h2 class="font-bold text-slate-100 text-xs flex items-center gap-1.5"><i data-lucide="swords" class="h-4 w-4 text-volt"></i>ম্যাচ ব্র্যাকেট ও ফিকচার</h2>
      ${t.rounds ? renderBracket(t, uid) : `<p class="text-xs text-slate-400">স্লট পূর্ণ হওয়ার পর অ্যাডমিন ব্র্যাকেট জেনারেট করবেন।</p>`}
    </div>

    <div class="glass rounded-2xl p-4 space-y-2">
      <div class="font-bold text-slate-100 text-xs">জয়েন করা টিমসমূহ (${n}/${t.max}):</div>
      <div class="space-y-1.5">
        ${t.players.map(p=>`<div class="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl text-xs"><div class="flex items-center gap-2"><img src="${esc(p.avatar)}" class="h-7 w-7 rounded-full object-cover"><span>${esc(p.team)}</span></div><span class="text-slate-400 text-[11px]">${esc(p.phone)}</span></div>`).join('')||`<span class="text-xs text-slate-400">এখনো কেউ জয়েন করেনি।</span>`}
      </div>
    </div>

    ${isAdmin ? `
      <div class="glass rounded-2xl p-4 space-y-3 border border-volt/40 bg-slate-950">
        <h2 class="font-bold text-volt text-xs">অ্যাডমিন অ্যাকশন: ব্র্যাকেট জেনারেট</h2>
        <button id="genBracketBtn" class="btn btn-p w-full py-2.5 text-xs font-bold">ব্র্যাকেট অটো-জেনারেট করুন</button>
      </div>
    ` : ''}
  </div>`);
  icons();

  if(isAdmin && $('#genBracketBtn')){
    $('#genBracketBtn').onclick=async()=>{
      if(t.players.length < 2) return toast('নূন্যতম ২ জন প্লেয়ার জয়েন করতে হবে','err');
      try {
        const rounds = build(t.players);
        await F.updateDoc(tref(t.id), { rounds, status: 'live' });
        toast('সফলভাবে ব্র্যাকেট তৈরি করা হয়েছে!');
      } catch(e){toast(e.message,'err')}
    };
  }
}

function matchView(tid, r, i){
  unsub=F.onSnapshot(tref(tid),async s=>{
    if(!s.exists())return setView(`<p class="p-8 text-center text-slate-300">ম্যাচ পাওয়া যায়নি</p>`);
    T={id:s.id, ...s.data()};
    const m = T.rounds?.['r'+r]?.[i];
    if(!m) return setView(`<p class="p-8 text-center text-slate-300">ম্যাচ ডেটা ভুল</p>`);

    const isAdmin = user && user.email === ADMIN_EMAIL;
    const isPlayer = user && (m.a?.uid === user.uid || m.b?.uid === user.uid);
    
    setView(`<div class="space-y-4 py-4 max-w-xl mx-auto pb-24">
      <a href="#/t/${tid}" class="inline-flex items-center gap-1 text-xs text-volt font-medium"><i data-lucide="chevron-left" class="h-4 w-4"></i>টুর্নামেন্টে ফিরে যান</a>
      <div class="glass rounded-2xl p-5 space-y-4 text-center">
        <h1 class="text-sm font-bold text-volt uppercase tracking-wider">DLS Match Room & Code Sharing</h1>
        <div class="grid grid-cols-2 gap-4 items-center bg-slate-900/80 p-4 rounded-xl border border-white/10">
          <div>
            <div class="font-bold text-sm text-slate-100">${esc(m.a?.team||'TBD')}</div>
            <div class="text-[11px] text-slate-400">Team A</div>
          </div>
          <div>
            <div class="font-bold text-sm text-slate-100">${esc(m.b?.team||'TBD')}</div>
            <div class="text-[11px] text-slate-400">Team B</div>
          </div>
        </div>

        <div class="rounded-xl bg-slate-900 p-3.5 border border-volt/30 space-y-2 text-left text-xs">
          <div class="font-bold text-volt flex items-center justify-between">
            <span>DLS Friend Code / Room Code (5 Min):</span>
            <span class="text-slate-400 text-[11px]">Status: ${m.status}</span>
          </div>
          <div class="text-slate-200 font-mono text-sm bg-black/40 p-2 rounded-lg">${m.room ? esc(m.room) : 'কোনো কোড দেওয়া হয়নি'}</div>
          
          ${isPlayer && m.status!=='done' ? `
            <div class="pt-2 flex gap-2">
              <input id="roomInput" class="inp text-xs !py-2" placeholder="আপনার রুম কোড দিন (যেমন: 12345)" value="${esc(m.room||'')}">
              <button id="saveRoomBtn" class="btn btn-n !py-2 !px-3 text-xs shrink-0 font-bold">সেভ কোড</button>
            </div>
          ` : ''}
        </div>

        <div class="rounded-xl bg-slate-900 p-3.5 border border-white/10 space-y-2 text-left text-xs">
          <div class="font-bold text-gold">ম্যাচ রেজাল্ট ও স্ক্রিনশট (Proof):</div>
          <div>স্কোর: <b>${m.sa ?? '-'}</b> : <b>${m.sb ?? '-'}</b></div>
          ${m.proof ? `<a href="${esc(m.proof)}" target="_blank" class="text-volt underline block truncate">দিস্ছে স্ক্রিনশট লিংক (View Proof)</a>` : '<div class="text-slate-400 text-[11px]">কোনো স্ক্রিনশট সাবমিট করা হয়নি।</div>'}
          
          ${isPlayer && m.status!=='done' ? `
            <div class="space-y-2 pt-2 border-t border-white/10">
              <div class="grid grid-cols-2 gap-2">
                <input id="saInp" class="inp text-xs !py-2" type="number" placeholder="আপনার গোল" value="${m.sa??''}">
                <input id="sbInp" class="inp text-xs !py-2" type="number" placeholder="প্রতিপক্ষের গোল" value="${m.sb??''}">
              </div>
              <input id="proofInp" class="inp text-xs !py-2" placeholder="স্ক্রিনশট ইমেজ লিংক (Image URL / ImgBB)" value="${esc(m.proof||'')}">
              <button id="submitResBtn" class="btn btn-p w-full py-2 text-xs font-bold">রেজাল্ট ও প্রুফ জমা দিন</button>
            </div>
          ` : ''}
        </div>

        ${isAdmin ? `
          <div class="rounded-xl bg-slate-950 p-4 border border-volt/40 space-y-3 text-left text-xs">
            <div class="font-bold text-volt">অ্যাডমিন ম্যাচ কন্ট্রোল:</div>
            <div class="space-y-1">
              <label class="lbl text-[11px]">জয়ী দল সিলেক্ট করুন:</label>
              <select id="winnerSelect" class="inp text-xs !py-2">
                <option value="">-- উইনার সিলেক্ট করুন --</option>
                <option value="${m.a?.uid}" ${m.winner===m.a?.uid?'selected':''}>${esc(m.a?.team||'Team A')}</option>
                <option value="${m.b?.uid}" ${m.winner===m.b?.uid?'selected':''}>${esc(m.b?.team||'Team B')}</option>
              </select>
            </div>
            <button id="adminWinBtn" class="btn btn-n w-full py-2 text-xs font-bold">উইনার কনফার্ম ও নেক্সট রাউন্ডে পাঠান</button>
          </div>
        ` : ''}

      </div>
    </div>`);
    icons();

    if(isPlayer && $('#saveRoomBtn')){
      $('#saveRoomBtn').onclick=async()=>{
        const room = $('#roomInput').value.trim();
        if(!room) return toast('রুম কোড লিখুন','err');
        m.room = room;
        T.rounds['r'+r][i] = m;
        await F.updateDoc(tref(tid), { rounds: T.rounds });
        toast('রুম কোড সফলভাবে আপডেট হয়েছে!');
      };
    }

    if(isPlayer && $('#submitResBtn')){
      $('#submitResBtn').onclick=async()=>{
        const sa = +$('#saInp').value, sb = +$('#sbInp').value;
        const proof = $('#proofInp').value.trim();
        m.sa = sa; m.sb = sb; m.proof = proof; m.status = 'disputed';
        T.rounds['r'+r][i] = m;
        await F.updateDoc(tref(tid), { rounds: T.rounds });
        toast('রেজাল্ট ও প্রুফ সফলভাবে জমা হয়েছে!');
      };
    }

    if(isAdmin && $('#adminWinBtn')){
      $('#adminWinBtn').onclick=async()=>{
        const winnerUid = $('#winnerSelect').value;
        if(!winnerUid) return toast('সঠিক উইনার সিলেক্ট করুন','err');
        const winnerTeam = winnerUid === m.a?.uid ? m.a : m.b;
        m.winner = winnerUid;
        m.status = 'done';
        advance(T.rounds, +r, +i, winnerTeam);
        T.rounds['r'+r][i] = m;
        
        // If final round, give prize to winner!
        if(+r === Object.keys(T.rounds).length - 1){
          const uDoc = await F.getDoc(F.doc(db, 'users', winnerUid));
          if(uDoc.exists()){
            const curWinBal = uDoc.data().winBalance || 0;
            await F.updateDoc(F.doc(db, 'users', winnerUid), { winBalance: curWinBal + (T.winnerPrize || 0) });
          }
        }

        await F.updateDoc(tref(tid), { rounds: T.rounds });
        toast('উইনার সফলভাবে কনফার্ম করা হয়েছে!');
      };
    }
  });
}

actions.join=async()=>{
  if(!needAuth())return;
  if(!complete(profile)){toast('প্রথমে প্রোফাইল সম্পূর্ণ করুন (Team Name, Phone, Avatar compulsory)','err'); location.hash='#/me'; return;}
  const fee=T.fee||0, myBal=profile?.balance||0;
  if(myBal<fee)return toast('ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই! এড মানি করুন।','err');

  const ok=await run(async()=>{
    await F.updateDoc(tref(T.id),{
      players: F.arrayUnion({uid:user.uid, team:profile.team, phone:profile.phone, avatar:profile.avatar||''})
    });
    const newBal=myBal-fee;
    await F.setDoc(F.doc(db,'users',user.uid),{balance:newBal},{merge:true});
    profile.balance=newBal; header();
    toast('সফলভাবে টুর্নামেন্টে জয়েন করেছেন!');
  });
};

function historyView(){
  if(!needAuth())return;
  setView(`<div class="space-y-4 py-4 max-w-xl mx-auto pb-24"><h1 class="text-base font-black text-slate-100">হিস্টরি</h1><div class="glass rounded-2xl p-6 text-center text-xs text-slate-300">কোনো হিস্টরি নেই।</div></div>`);
  icons();
}

function profileView(){
  if(!user){
    setView(`<div class="space-y-6 py-12 max-w-md mx-auto px-4 text-center">
      <div class="glass rounded-3xl p-6 space-y-4 border border-volt/20 shadow-xl">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-volt/15 text-volt">
          <i data-lucide="user-round" class="h-7 w-7"></i>
        </div>
        <div class="space-y-1">
          <h2 class="text-base font-bold text-slate-100">প্রোফাইল দেখতে লগইন করুন</h2>
          <p class="text-xs text-slate-400">আপনার একাউন্টে প্রবেশ করতে নিচের বাটনে ক্লিক করুন।</p>
        </div>
        <button data-act="auth" class="btn btn-p w-full py-3 text-xs font-bold shadow-lg shadow-volt/20">লগইন / প্রবেশ করুন</button>
      </div>
    </div>`);
    icons();
    return;
  }
  const p=profile||{};
  setView(`<div class="space-y-4 py-4 max-w-xl mx-auto pb-24">
    <form id="pf" class="glass rounded-2xl p-4 space-y-3">
      <h1 class="text-lg font-black text-slate-100">প্রোফাইল (বাধ্যতামূলক তথ্য)</h1>
      <div><label class="lbl text-xs">টিম নেম <span class="text-red-400">*</span></label><input class="inp text-sm" name="team" required value="${esc(p.team||'')}"></div>
      <div><label class="lbl text-xs">মোবাইল নম্বর <span class="text-red-400">*</span></label><input class="inp text-sm" name="phone" required type="tel" value="${esc(p.phone||'')}"></div>
      <div>
        <label class="lbl text-xs">প্রোফাইল পিকচার (Choose File) <span class="text-red-400">*</span></label>
        <input class="inp text-xs file:mr-2 file:rounded-md file:border-0 file:bg-volt file:px-2.5 file:py-1 file:text-xs file:font-bold" id="imgFile" type="file" accept="image/*">
        <input type="hidden" name="avatar" id="avatarVal" value="${esc(p.avatar||'')}">
      </div>
      ${p.avatar?`<div class="flex items-center gap-2.5"><img src="${esc(p.avatar)}" class="h-10 w-10 rounded-full object-cover border border-volt/40"><span class="text-[11px] text-slate-400">বর্তমান ছবি</span></div>`:''}
      <button class="btn btn-p w-full py-2.5 text-xs font-bold">প্রোফাইল সেভ করুন</button>
    </form>
    <button data-act="logout" class="btn btn-g w-full py-2.5 text-xs text-red-400 font-semibold">লগআউট</button>
  </div>`);

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
        toast('ছবি সিলেক্ট হয়েছে! সেভ করুন।');
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  $('#pf').onsubmit=async e=>{
    e.preventDefault();
    const d=Object.fromEntries(new FormData(e.target));
    d.avatar=$('#avatarVal').value;
    if(!d.team || !d.phone || !d.avatar) return toast('টিম নাম, ফোন নম্বর এবং প্রোফাইল ছবি দেওয়া বাধ্যতামূলক!','err');
    try{
      await F.setDoc(F.doc(db,'users',user.uid),d,{merge:true});
      profile.team = d.team;
      profile.phone = d.phone;
      profile.avatar = d.avatar;
      header();
      toast('প্রোফাইল সংরক্ষিত হয়েছে!'); location.hash='#/';
    }catch(err){toast(err.message,'err')}
  };
}

actions.logout=async()=>{await F.signOut(auth);location.hash='#/'};

function adminView(){
  if(!user || user.email !== ADMIN_EMAIL){
    setView(`<div class="p-12 text-center text-red-400 font-bold text-xs">404 - Unauthorized Access!</div>`);
    return;
  }

  setView(`<div class="space-y-6 py-4 max-w-xl mx-auto pb-24">
    <h1 class="text-lg font-black text-slate-100">অ্যাডমিন কন্ট্রোল প্যানেল (/admin)</h1>
    
    <!-- Tourney Creator -->
    <div class="glass rounded-2xl p-4 space-y-3 border border-volt/40">
      <h2 class="font-bold text-volt text-sm">নতুন টুর্নামেন্ট তৈরি করুন</h2>
      <form id="mkTourney" class="space-y-2.5">
        <div><label class="lbl text-xs">টুর্নামেন্টের নাম</label><input class="inp text-sm" name="name" required placeholder="Friday Night Cup"></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="lbl text-xs">এন্ট্রি ফি (৳)</label><input class="inp text-sm" name="fee" type="number" value="50" required></div>
          <div><label class="lbl text-xs">সর্বোচ্চ স্লট</label><select class="inp text-sm" name="max"><option value="2">2 Slots</option><option value="4">4 Slots</option><option value="8">8 Slots</option><option value="16">16 Slots</option></select></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="lbl text-xs">ফরম্যাট / টাইপ</label><select class="inp text-sm" name="type"><option value="Knockout">Knockout</option><option value="Group Stage">Group Stage</option></select></div>
          <div><label class="lbl text-xs">শুরুর সময়</label><input class="inp text-sm" name="start" type="datetime-local" required></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="lbl text-xs">Winner Prize (৳)</label><input class="inp text-sm" name="winnerPrize" type="number" value="80" required></div>
          <div><label class="lbl text-xs">Runner-up Prize (৳)</label><input class="inp text-sm" name="runnerUpPrize" type="number" value="20" required></div>
        </div>
        <button class="btn btn-p w-full py-2.5 text-xs font-bold">টুর্নামেন্ট পাবলিশ করুন</button>
      </form>
    </div>

    <!-- Admin Deposit & Withdraw Requests Box -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="glass rounded-2xl p-4 space-y-3 border border-neon/30">
        <h2 class="font-bold text-neon text-xs flex items-center gap-1.5"><i data-lucide="wallet" class="h-4 w-4"></i>এড মানি রিকোয়েস্টসমূহ</h2>
        <div id="depList" class="space-y-2 text-xs">লোড হচ্ছে...</div>
      </div>

      <div class="glass rounded-2xl p-4 space-y-3 border border-gold/30">
        <h2 class="font-bold text-gold text-xs flex items-center gap-1.5"><i data-lucide="send" class="h-4 w-4"></i>উইথড্র রিকোয়েস্টসমূহ</h2>
        <div id="withList" class="space-y-2 text-xs">লোড হচ্ছে...</div>
      </div>
    </div>
  </div>`);

  icons();

  // Fetch Deposits
  F.getDocs(F.collection(db, 'deposits')).then(snap=>{
    const list = snap.docs.map(d=>({id:d.id, ...d.data()}));
    const pending = list.filter(x=>x.status==='pending');
    const el = $('#depList');
    if(!el) return;
    el.innerHTML = pending.map(d=>`
      <div class="bg-slate-900 p-2.5 rounded-xl border border-white/5 space-y-1">
        <div>টিম: <b>${esc(d.team)}</b></div>
        <div>পরিমাণ: <span class="text-volt font-bold">৳${d.amount}</span></div>
        <div>TrxID: <span class="font-mono text-gold">${esc(d.trx)}</span></div>
        <button data-approve-dep="${d.id}" data-uid="${d.uid}" data-amount="${d.amount}" class="btn btn-n !py-1 !px-3 text-[11px] font-bold w-full mt-1">অ্যাপ্রুভ করুন</button>
      </div>
    `).join('') || '<div class="text-slate-400">কোনো পেন্ডিং ডিপোজিট নেই।</div>';
    icons();
  });

  // Fetch Withdraws
  F.getDocs(F.collection(db, 'withdraws')).then(snap=>{
    const list = snap.docs.map(d=>({id:d.id, ...d.data()}));
    const pending = list.filter(x=>x.status==='pending');
    const el = $('#withList');
    if(!el) return;
    el.innerHTML = pending.map(w=>`
      <div class="bg-slate-900 p-2.5 rounded-xl border border-white/5 space-y-1">
        <div>টিম: <b>${esc(w.team)}</b></div>
        <div>নম্বর: <span class="text-volt font-bold">${esc(w.phone)}</span></div>
        <div>পরিমাণ: <span class="text-gold font-bold">৳${w.amount}</span></div>
        <button data-approve-with="${w.id}" data-uid="${w.uid}" data-amount="${w.amount}" class="btn btn-p !py-1 !px-3 text-[11px] font-bold w-full mt-1">উইথড্র পেইড করুন</button>
      </div>
    `).join('') || '<div class="text-slate-400">কোনো পেন্ডিং উইথড্র নেই।</div>';
    icons();
  });

  $('#mkTourney').onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    try {
      await F.addDoc(F.collection(db,'tournaments'),{
        name: fd.get('name'),
        fee: +fd.get('fee'),
        winnerPrize: +fd.get('winnerPrize'),
        runnerUpPrize: +fd.get('runnerUpPrize'),
        max: +fd.get('max'),
        type: fd.get('type'),
        start: fd.get('start'),
        status: 'open',
        players: [],
        createdAt: F.serverTimestamp()
      });
      toast('টুর্নামেন্ট সফলভাবে তৈরি হয়েছে!');
      e.target.reset();
    } catch(err){toast(err.message,'err')}
  };
}

// Admin Action Listeners for Deposits & Withdraws Approval
document.addEventListener('click', async e=>{
  const depBtn = e.target.closest('[data-approve-dep]');
  if(depBtn){
    const id = depBtn.dataset.approveDep, uid = depBtn.dataset.uid, amount = +depBtn.dataset.amount;
    try {
      await F.updateDoc(F.doc(db, 'deposits', id), { status: 'accepted' });
      const uRef = F.doc(db, 'users', uid);
      const uDoc = await F.getDoc(uRef);
      const curBal = uDoc.exists() ? (uDoc.data().balance || 0) : 0;
      await F.updateDoc(uRef, { balance: curBal + amount });
      toast('ডিপোজিট সফলভাবে অ্যাপ্রুভ হয়েছে এবং ব্যালেন্স যোগ হয়েছে!');
      adminView();
    } catch(err){toast(err.message,'err')}
  }

  const withBtn = e.target.closest('[data-approve-with]');
  if(withBtn){
    const id = withBtn.dataset.approveWith, uid = withBtn.dataset.uid, amount = +withBtn.dataset.amount;
    try {
      await F.updateDoc(F.doc(db, 'withdraws', id), { status: 'accepted' });
      const uRef = F.doc(db, 'users', uid);
      const uDoc = await F.getDoc(uRef);
      const curWinBal = uDoc.exists() ? (uDoc.data().winBalance || 0) : 0;
      if(curWinBal >= amount){
        await F.updateDoc(uRef, { winBalance: curWinBal - amount });
      }
      toast('উইথড্র সফলভাবে পেইড ও কমপ্লিট করা হয়েছে!');
      adminView();
    } catch(err){toast(err.message,'err')}
  }
});
