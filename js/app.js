import * as F from './firebase.js';
import {$,esc,money,icons,skeleton,toast,modal} from './ui.js';
import {build,advance,renderBracket} from './bracket.js';

const {auth,db}=F,app=$('#app');
let user=null,profile=null,unsub=null,T=null,CUR=null,S={tab:'open',list:[],q:''};

// Apnar nirdishto admin email ekhane thakbe (ei email diye Google Sign-in korlei admin panel access paben)
const ADMIN_EMAIL = 'theshabbirtech@gmail.com'; 

const PLEDGE=['আমি কোনো ম্যাচ ফিক্সিং, বিক্রি বা ইচ্ছাকৃত হারব না।','কোনো মোড, চিট বা ফেক অ্যাকাউন্ট ব্যবহার করব না।','আমি জানি যেকোনো রেজাল্টে অপোনেন্টের কনফার্মেশন লাগবে এবং ফিক্সিং প্রমাণিত হলে ডিসকোয়ালিফাই করা হবে।','আমি টুর্নামেন্ট ও প্রাইজের নিয়ম ভালো করে পড়েছি।'];
const tref=id=>F.doc(db,'tournaments',id);
const prizeTotal=t=>(t.prizes||[]).reduce((a,b)=>a+(+b||0),0);
const complete=p=>p&&p.team&&p.phone&&p.avatar;
const isPaid=p=>p.paid!==false;
const paidN=t=>(t.players||[]).filter(isPaid).length;
const statusBadge=s=>({open:['আসন্ন','bg-volt/15 text-volt'],live:['লাইভ','bg-neon/15 text-neon'],done:['সম্পন্ন','bg-gold/15 text-gold']}[s]||['?','']);
const PL=i=>['🥇','🥈','🥉'][i]+' '+['১ম','২য়','৩য়'][i];
const fdate=s=>s?new Date(s).toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short'}):'নির্ধারিত নয়';
const countdown=s=>{if(!s)return '';const ms=new Date(s)-Date.now();return isNaN(ms)?'':ms<=0?'শীঘ্রই শুরু হচ্ছে':`শুরু হবে ${Math.floor(ms/60000)}মি এ`;};
const mut=(id,fn)=>F.runTransaction(db,async tx=>{
  const s=await tx.get(tref(id));if(!s.exists())throw Error('টুর্নামেন্ট পাওয়া যায়নি');
  const t=s.data();t.players=t.players||[];t.rounds=t.rounds||{};t.payouts=t.payouts||{};t.reports=t.reports||[];fn(t);
  tx.update(tref(id),{players:t.players,rounds:t.rounds,status:t.status,champion:t.champion||null,payouts:t.payouts,reports:t.reports});
});
const run=async(fn,ok)=>{try{await mut(T.id,fn);if(ok)toast(ok);return true}catch(e){toast(e.message,'err');return false}};
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
  $('#hdr').innerHTML=`<div class="flex items-center justify-between w-full max-w-3xl mx-auto px-4 py-2">
    <div class="font-black text-lg tracking-tight text-slate-100 flex items-center gap-1.5"><i data-lucide="trophy" class="h-5 w-5 text-volt"></i>DLS <span class="text-volt">KING BD</span></div>
    <div class="flex items-center gap-3">
      <div class="glass px-3 py-1 rounded-full text-xs font-bold text-gold border border-gold/30">Total: ৳${bal}</div>
      ${user?`<a href="#/me" class="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-xs font-semibold"><img src="${esc(profile?.avatar||'https://via.placeholder.com/30')}" class="h-7 w-7 rounded-full object-cover"><span class="max-w-[6rem] truncate">${esc(profile?.team||'প্রোফাইল')}</span></a>`:`<button data-act="auth" class="btn btn-p !py-1 !px-3 text-xs">প্রবেশ করুন</button>`}
    </div>
  </div>`;
  icons();
}

function nav(){
  const it=[['','gamepad-2','ম্যাচ','#/'],['history','scroll','হিস্টরি','#/history'],['wallet','wallet','ওয়ালেট','#/wallet'],['me','user-round','প্রোফাইল','#/me']];
  $('#nav').innerHTML=`<div class="mx-auto grid max-w-3xl grid-cols-4">${it.map(([k,i,l,h])=>`<a href="${h}" data-nav="${k}" class="flex flex-col items-center gap-1 py-2 text-xs font-medium text-slate-300 transition"><i data-lucide="${i}" class="h-5 w-5"></i>${l}</a>`).join('')}</div>`;
  icons();
}

function authModal(){
  let mode='in';
  const m=modal(`<h3 class="mb-1 text-lg font-bold">DLS KING BD-তে স্বাগতম</h3><p class="mb-4 text-sm text-slate-300">টুর্নামেন্টে যোগ দিতে প্রবেশ করুন।</p>
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
  if(!F.configured)return setView(`<div class="m-4 glass rounded-2xl p-5"><h2 class="font-bold text-gold">ফায়ারবেজ কনফিগার করা হয়নি</h2></div>`);
  const [,p,a,b,c]=location.hash.split('/');
  document.querySelectorAll('[data-nav]').forEach(n=>{const on=n.dataset.nav===(p||'');n.classList.toggle('text-volt',on);n.classList.toggle('font-bold',on);n.classList.toggle('text-slate-300',!on)});
  setView(skeleton());window.scrollTo(0,0);
  
  if(p==='admin')return adminView(); // Hidden WordPress style /# /admin route
  if(p==='t')return tourney(a);
  if(p==='wallet')return walletView();
  if(p==='history')return historyView();
  if(p==='me')return profileView();
  listen(drawFeed);
}
addEventListener('hashchange',route);
nav();

function drawFeed(){
  setView(`<div class="space-y-4 p-4 max-w-xl mx-auto"><h1 class="text-xl font-black text-slate-100 flex items-center gap-2"><i data-lucide="zap" class="h-5 w-5 text-volt"></i>চলমান ও আসন্ন ম্যাচসমূহ</h1><div id="fl" class="space-y-4"></div></div>`);
  drawList();
}

function drawList(){
  const list=S.list;
  const el=$('#fl');if(!el)return;
  el.innerHTML=list.map(t=>{
    const n=(t.players||[]).length, max=t.max||2;
    const pct=Math.min(100,(n/max)*100);
    const cd=countdown(t.start);
    return `<div class="glass rounded-2xl p-4 sm:p-5 space-y-3 relative overflow-hidden border border-white/10 hover:border-volt/30 transition">
      <div class="flex justify-between items-start"><h3 class="text-base font-bold text-slate-100">${esc(t.name)}</h3><span class="text-xs text-slate-400 flex items-center gap-1"><i data-lucide="calendar" class="h-3.5 w-3.5 text-volt"></i>${fdate(t.start)}</span></div>
      ${cd?`<div class="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-300 flex items-center gap-2"><i data-lucide="hourglass" class="h-4 w-4"></i>${cd}</div>`:''}
      <div class="grid grid-cols-2 gap-2 bg-slate-900/60 p-3 rounded-xl">
        <div><div class="text-[11px] text-slate-400 font-medium">এন্ট্রি ফি:</div><div class="text-base font-black text-volt">৳${t.fee||50}</div></div>
        <div><div class="text-[11px] text-slate-400 font-medium">উইনিং প্রাইজ:</div><div class="text-base font-black text-gold">৳${prizeTotal(t)||100}</div></div>
      </div>
      <div class="space-y-1">
        <div class="flex justify-between text-xs font-semibold text-slate-300"><span>স্লট ফিলাপ</span><span>${n}/${max} Slots</span></div>
        <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-volt to-neon rounded-full" style="width:${pct}%"></div></div>
      </div>
      <a href="#/t/${t.id}" class="btn btn-n w-full py-2.5 text-center font-bold block">ম্যাচ জয়েন করুন</a>
    </div>`;
  }).join('')||`<div class="glass rounded-2xl p-8 text-center text-sm text-slate-300">বর্তমানে কোনো ম্যাচ নেই।</div>`;
  icons();
}

function walletView(){
  if(!needAuth())return;
  const bal = profile?.balance || 0, winBal = profile?.winBalance || 0;
  setView(`<div class="space-y-5 p-4 max-w-xl mx-auto">
    <div class="glass rounded-3xl p-6 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-gold/30">
      <div class="text-xs text-slate-400 font-medium">আমার ওয়ালেট একাউন্ট</div>
      <div class="grid grid-cols-2 gap-4 mt-3">
        <div class="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5"><div class="text-xs text-slate-400">মেইন ব্যালেন্স</div><div class="text-xl font-black text-volt mt-0.5">৳${bal}</div></div>
        <div class="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5"><div class="text-xs text-slate-400">উইনিং ব্যালেন্স</div><div class="text-xl font-black text-gold mt-0.5">৳${winBal}</div></div>
      </div>
    </div>
    <div class="glass rounded-2xl p-5 space-y-3 text-center">
      <p class="text-sm text-slate-300">টাকা এড করতে বা তুলতে নিচের বাটন ব্যবহার করুন</p>
      <div class="grid grid-cols-2 gap-3">
        <button data-act="addMoneyModal" class="btn btn-n py-3 font-bold">এড মানি</button>
        <button data-act="withdrawModal" class="btn btn-p py-3 font-bold">উইথড্র</button>
      </div>
    </div>
  </div>`);
  icons();
}

const actions={
  auth:authModal,
  addMoneyModal(){
    const m=modal(`<div class="space-y-4">
      <h3 class="text-lg font-bold text-slate-100 border-b border-white/10 pb-2">টাকা এড করুন</h3>
      <div class="rounded-2xl bg-slate-900/80 p-4 space-y-2 text-xs border border-white/10">
        <div class="font-bold text-volt">নিয়মাবলী: বিকাশ/নগদ পার্সোনাল নম্বরে Send Money করুন।</div>
        <p class="text-slate-300">প্রাপক নম্বর: <b class="select-all text-gold">01800000000</b></p>
      </div>
      <div><label class="lbl">টাকার পরিমাণ</label><input id="am" class="inp" type="number" placeholder="যেমন: ১০০" min="10"></div>
      <div><label class="lbl">ট্রানজেকশন আইডি (TrxID)</label><input id="tx" class="inp" placeholder="যেমন: 8N7X9W2K3L" maxlength="30"></div>
      <button id="verifyBtn" class="btn btn-n w-full py-3 font-bold">VERIFY & SUBMIT</button>
    </div>`);
    m.$('#verifyBtn').onclick=async()=>{
      const amount=+m.$('#am').value, trx=m.$('#tx').value.trim();
      if(!amount||amount<=0||trx.length<5)return toast('সঠিক পরিমাণ ও TrxID দিন','err');
      try {
        await F.addDoc(F.collection(db,'deposits'),{uid:user.uid, team:profile?.team||'User', amount, trx, status:'pending', createdAt:F.serverTimestamp()});
        toast('ডিপোজিট অনুরোধ পাঠানো হয়েছে!'); m.close();
      } catch(e){toast(e.message,'err')}
    };
  },
  withdrawModal(){
    const m=modal(`<div class="space-y-4">
      <h3 class="text-lg font-bold text-slate-100 border-b border-white/10 pb-2">টাকা উইথড্র করুন</h3>
      <div><label class="lbl">নম্বর (Personal)</label><input id="wn" class="inp" type="tel" placeholder="01XXXXXXXXX"></div>
      <div><label class="lbl">পরিমাণ (৳)</label><input id="wa" class="inp" type="number" placeholder="ন্যূনতম ১০০ টাকা" min="100"></div>
      <button id="wBtn" class="btn btn-p w-full py-3 font-bold">উইথড্র অনুরোধ পাঠান</button>
    </div>`);
    m.$('#wBtn').onclick=async()=>{
      const amount=+m.$('#wa').value, phone=m.$('#wn').value.trim();
      if(amount<100||!phone)return toast('ন্যূনতম ১০০ টাকা এবং সঠিক নম্বর দিন','err');
      if((profile?.winBalance||0)<amount)return toast('পর্যাপ্ত উইনিং ব্যালেন্স নেই!','err');
      try {
        await F.addDoc(F.collection(db,'withdraws'),{uid:user.uid, team:profile?.team||'User', amount, phone, status:'pending', createdAt:F.serverTimestamp()});
        toast('উইথড্র অনুরোধ সফল হয়েছে।'); m.close();
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
  setView(`<div class="space-y-4 p-4 max-w-xl mx-auto">
    <a href="#/" class="inline-flex items-center gap-1 text-xs text-volt font-medium"><i data-lucide="chevron-left" class="h-4 w-4"></i>ফিরে যান</a>
    <div class="glass rounded-3xl p-5 space-y-4 border border-white/10">
      <div class="flex justify-between items-start"><h1 class="text-xl font-black text-slate-100">${esc(t.name)}</h1><span class="badge bg-volt/15 text-volt">আসন্ন</span></div>
      <div class="grid grid-cols-2 gap-3 bg-slate-900/60 p-3.5 rounded-2xl">
        <div><div class="text-xs text-slate-400">এন্ট্রি ফি:</div><div class="text-lg font-black text-volt">৳${t.fee||50}</div></div>
        <div><div class="text-xs text-slate-400">উইনিং প্রাইজ:</div><div class="text-lg font-black text-gold">৳${prizeTotal(t)||100}</div></div>
      </div>
      ${!me&&!full?`<button data-act="join" class="btn btn-n w-full py-3 font-bold text-base">ম্যাচ জয়েন করুন</button>`:''}
      ${me?`<div class="rounded-xl bg-neon/10 p-3 text-center text-neon font-bold text-sm">✔ আপনি এই ম্যাচে সফলভাবে জয়েন করেছেন</div>`:''}
    </div>
    
    <form id="pForm" class="glass rounded-3xl p-5 space-y-4 border border-gold/30">
      <div class="font-bold text-gold text-base">ইন-গেম তথ্য দিন</div>
      <div><label class="lbl">টিম ম্যানেজার এর নাম</label><input class="inp text-slate-100" name="tName" required placeholder="Tamim gaming"></div>
      <div><label class="lbl">সঠিক টিম রেটিং</label><input class="inp text-slate-100" name="tRating" type="number" required placeholder="92"></div>
      <div><label class="lbl">গোল্ড মেডেল সংখ্যা</label><input class="inp text-slate-100" name="tMedal" type="number" required placeholder="800"></div>
    </form>
  </div>`);
  icons();
}

actions.join=async()=>{
  if(!needAuth())return;
  const f=$('#pForm'), fd=new FormData(f);
  const tName=fd.get('tName'), tRating=fd.get('tRating'), tMedal=fd.get('tMedal');
  if(!tName||!tRating||!tMedal)return toast('সবগুলো তথ্য পূরণ করুন','err');
  const fee=T.fee||50, myBal=profile?.balance||0;
  if(myBal<fee)return toast('ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই!','err');

  const ok=await run(t=>{
    if(t.players.some(p=>p.uid===user.uid))throw Error('ইতিমধ্যেই যুক্ত হয়েছেন');
    t.players.push({uid:user.uid, team:tName, rating:tRating, medal:tMedal, avatar:profile?.avatar||''});
  },'সফলভাবে জয়েন করেছেন!');

  if(ok){
    const newBal=myBal-fee;
    await F.setDoc(F.doc(db,'users',user.uid),{balance:newBal},{merge:true});
    profile.balance=newBal; header();
  }
};

function historyView(){
  if(!needAuth())return;
  setView(`<div class="space-y-4 p-4 max-w-xl mx-auto"><h1 class="text-xl font-black text-slate-100">হিস্টরি</h1><div class="glass rounded-2xl p-6 text-center text-sm text-slate-300">কোনো হিস্টরি নেই।</div></div>`);
  icons();
}

function profileView(){
  if(!user){setView(`<p class="p-8 text-center">লগইন করুন</p>`);return}
  const p=profile||{};
  setView(`<div class="space-y-5 p-4 max-w-xl mx-auto">
    <form id="pf" class="glass rounded-3xl p-6 space-y-4">
      <h1 class="text-2xl font-black text-slate-100">প্রোফাইল</h1>
      <div><label class="lbl">টিম নেম</label><input class="inp text-slate-100" name="team" required value="${esc(p.team)}"></div>
      <div><label class="lbl">মোবাইল নম্বর</label><input class="inp text-slate-100" name="phone" required value="${esc(p.phone)}"></div>
      <button class="btn btn-p w-full py-3 font-bold">সেভ করুন</button>
    </form>
    <button data-act="logout" class="btn btn-g w-full py-3 text-red-400 font-semibold">লগআউট</button>
  </div>`);
  $('#pf').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    try{await F.setDoc(F.doc(db,'users',user.uid),d,{merge:true});profile={...profile,...d};header();toast('সংরক্ষিত হয়েছে!');}catch(err){toast(err.message,'err')}};
}

actions.logout=async()=>{await F.signOut(auth);location.hash='#/'};

// --- SECURE WORDPRESS STYLE /#/admin PANEL ---
function adminView(){
  if(!user || user.email !== ADMIN_EMAIL){
    setView(`<div class="p-12 text-center text-red-400 font-bold">404 - Page Not Found or Unauthorized Access!</div>`);
    return;
  }
  setView(`<div class="space-y-6 p-4 max-w-2xl mx-auto">
    <h1 class="text-2xl font-black text-slate-100">অ্যাডমিন কন্ট্রোল প্যানেল (/admin)</h1>
    
    <div class="glass rounded-3xl p-5 space-y-3 border border-volt/40">
      <h2 class="font-bold text-volt text-lg">নতুন টুর্নামেন্ট তৈরি করুন</h2>
      <form id="mkTourney" class="space-y-3">
        <div><label class="lbl">টুর্নামেন্টের নাম</label><input class="inp" name="name" required placeholder="#11 DLS CUP"></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="lbl">এন্ট্রি ফি (৳)</label><input class="inp" name="fee" type="number" value="50" required></div>
          <div><label class="lbl">উইনিং প্রাইজ (৳)</label><input class="inp" name="prize" type="number" value="100" required></div>
        </div>
        <div><label class="lbl">সর্বোচ্চ স্লট</label><select class="inp" name="max"><option value="2">2 Slots</option><option value="4">4 Slots</option><option value="8">8 Slots</option><option value="16">16 Slots</option></select></div>
        <div><label class="lbl">শুরুর সময়</label><input class="inp" name="start" type="datetime-local" required></div>
        <button class="btn btn-p w-full py-3 font-bold">টুর্নামেন্ট পাবলিশ করুন</button>
      </form>
    </div>
  </div>`);

  $('#mkTourney').onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    try {
      await F.addDoc(F.collection(db,'tournaments'),{
        name: fd.get('name'),
        fee: +fd.get('fee'),
        prizes: [+fd.get('prize'), 0, 0],
        max: +fd.get('max'),
        start: fd.get('start'),
        status: 'open',
        players: [],
        rounds: {},
        createdAt: F.serverTimestamp()
      });
      toast('সফলভাবে নতুন টুর্নামেন্ট তৈরি হয়েছে!');
      e.target.reset();
    } catch(err){toast(err.message,'err')}
  };
}

function matchView(id,r,i){tourney(id)}
