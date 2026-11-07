import * as F from './firebase.js';
import {$,esc,money,icons,skeleton,toast,modal} from './ui.js';
import {build, renderBracket, advance} from './bracket.js';

const {auth,db}=F,app=$('#app');
let user=null,profile=null,unsub=null,T=null,S={tab:'upcoming',list:[],q:''};

const ADMIN_EMAIL = 'theshabbirtech@gmail.com';
const COMMUNITY_LINK = 'https://chat.whatsapp.com/KX9hr8fJ4JyHSRssYZd5fy'; 

const tref=id=>F.doc(db,'tournaments',id);
const complete=p=>p&&p.team&&p.phone&&p.avatar;
const fdate=s=>s?new Date(s).toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short'}):'নির্ধারিত নয়';
const countdown=s=>{if(!s)return '';const ms=new Date(s)-Date.now();return isNaN(ms)?'':ms<=0?'শীঘ্রই শুরু হচ্ছে':`শুরু হবে ${Math.floor(ms/60000)}মি এ`;};
const run=async(fn,ok)=>{try{await fn();if(ok)toast(ok);return true}catch(e){toast(e.message,'err');return false}};
const setView=h=>{app.innerHTML=h;icons()};
const needAuth=()=>{if(user)return true;authModal();return false};
const listen=draw=>{unsub=F.onSnapshot(F.query(F.collection(db,'tournaments'),F.orderBy('createdAt','desc')),s=>{S.list=s.docs.map(d=>({id:d.id,...d.data()}));draw()},e=>toast(e.message,'err'))};

const safeUrl=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:''}catch(e){return ''}};

F.onAuthStateChanged(auth,async u=>{
  user=u;profile=null;
  if(u){try{const s=await F.getDoc(F.doc(db,'users',u.uid));profile=s.exists()?s.data():null}catch(e){}}
  header();nav();route();
});

// Fixed Header: 3-Column Grid for Logo (Left), Nav Links (Center), Balance/Profile (Right)
function header(){
  const bal = profile?.balance || 0;
  const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Crect width='30' height='30' fill='%23334155'/%3E%3Ctext x='50%25' y='50%25' fill='%23fff' font-size='12' text-anchor='middle' dy='.3em'%3EU%3C/text%3E%3C/svg%3E";
  
  const hdrEl = $('#hdr');
  if(!hdrEl) return;
  
  // Note: Logo is handled in index.html, we inject desktop nav links into a custom container or update header layout
  // To make it 3-column cleanly, let's target the inner flex of header in index.html or manage full header inner HTML via app.js if needed.
  // Since index.html has a flex between logo and #hdr, let's put the desktop nav inside #hdr or structure it seamlessly:
  hdrEl.innerHTML=`
    <!-- Desktop Navigation Links (Centered) -->
    <div class="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300 mx-auto">
      <a href="#/" class="hover:text-volt transition">হোম</a>
      <a href="#/history" class="hover:text-volt transition">হিস্টরি</a>
      <a href="#/wallet" class="hover:text-volt transition">ওয়ালেট</a>
      <a href="#/me" class="hover:text-volt transition">প্রোফাইল</a>
    </div>

    <!-- Right: Balance & User Profile -->
    <div class="flex items-center gap-2">
      <a href="#/wallet" class="glass px-3 py-1 rounded-full text-xs font-bold text-gold border border-gold/40 hover:border-gold transition flex items-center gap-1">
        <i data-lucide="wallet" class="h-3.5 w-3.5"></i>৳${bal}
      </a>
      ${user?`<a href="#/me" class="flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-1 pr-2.5 text-xs font-semibold hover:bg-white/20 transition"><img src="${esc(profile?.avatar||defaultAvatar)}" class="h-6 w-6 rounded-full object-cover"><span class="max-w-[5rem] truncate">${esc(profile?.team||'প্রোফাইল')}</span></a>`:`<button data-act="auth" class="btn btn-p !py-1 !px-3 text-xs">লগইন</button>`}
    </div>`;
  icons();
}

function nav(){
  const it=[['','gamepad-2','টুর্নামেন্ট','#/'],['history','scroll','হিস্টরি','#/history'],['wallet','wallet','ওয়ালেট','#/wallet'],['me','user-round','প্রোফাইল','#/me']];
  const navEl = $('#nav');
  if(!navEl) return;
  navEl.innerHTML=`<div class="md:hidden fixed bottom-0 left-0 right-0 z-40 mx-auto grid grid-cols-4 bg-slate-950/95 backdrop-blur border-t border-white/10 shadow-2xl">${it.map(([k,i,l,h])=>`<a href="${h}" data-nav="${k}" class="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-400 transition"><i data-lucide="${i}" class="h-4 w-4"></i>${l}</a>`).join('')}</div>`;
  icons();
}

function authModal(){
  let mode='in';
  const m=modal(`<h3 class="mb-1 text-lg font-bold">ডিএলএস টুর্নামেন্ট হাব</h3><p class="mb-4 text-sm text-slate-300">টুর্নামেন্টে যোগ দিতে প্রবেশ করুন।</p>
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
  const [,p,a,r,i]=location.hash.split('/');
  document.querySelectorAll('[data-nav]').forEach(n=>{const on=n.dataset.nav===(p||'');n.classList.toggle('text-volt',on);n.classList.toggle('font-bold',on);n.classList.toggle('text-slate-400',!on)});
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

function drawFeed(){
  setView(`<div class="space-y-6 py-4 max-w-4xl mx-auto pb-24 px-3 md:px-0">
    
    <!-- Hero Banner & Trust Header -->
    <div class="glass rounded-3xl p-6 md:p-8 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-volt/20 relative overflow-hidden shadow-2xl">
      <div class="relative z-10 space-y-4">
        <span class="badge bg-volt/15 text-volt text-xs font-bold px-3 py-1 rounded-full border border-volt/30 inline-flex items-center gap-1.5"><i data-lucide="shield-check" class="h-3.5 w-3.5"></i>১০০% বিশ্বস্ত DLS ই-স্পোর্টস প্ল্যাটফর্ম</span>
        <h1 class="text-xl md:text-3xl font-black text-slate-100 leading-tight">ডিএলএস খেলুন, টুর্নামেন্টে জিতুন এবং ইন্সট্যান্ট ক্যাশআউট করুন!</h1>
        <p class="text-xs md:text-sm text-slate-300 max-w-xl">স্বয়ংক্রিয় ব্র্যাকেট সিস্টেম, দ্রুত বিকাশ/নগদ পেমেন্ট এবং ২৪/৭ সাপোর্ট। অংশগ্রহণ করুন আপনার পছন্দের টুর্নামেন্টে।</p>
        
        <!-- Trust Stats -->
        <div class="grid grid-cols-3 gap-3 pt-2 max-w-lg">
          <div class="bg-black/30 p-2.5 rounded-2xl border border-white/5 text-center">
            <div class="text-xs md:text-sm font-black text-volt">৳৫০,০০০+</div>
            <div class="text-[10px] md:text-xs text-slate-400">মোট পেআউট</div>
          </div>
          <div class="bg-black/30 p-2.5 rounded-2xl border border-white/5 text-center">
            <div class="text-xs md:text-sm font-black text-gold">১০০%</div>
            <div class="text-[10px] md:text-xs text-slate-400">নিরাপদ বিকাশ/নগদ</div>
          </div>
          <div class="bg-black/30 p-2.5 rounded-2xl border border-white/5 text-center">
            <div class="text-xs md:text-sm font-black text-neon">১,০০০+</div>
            <div class="text-[10px] md:text-xs text-slate-400">সক্রিয় প্লেয়ার</div>
          </div>
        </div>

        <div class="pt-2 flex flex-wrap gap-3">
          <a href="${COMMUNITY_LINK}" target="_blank" class="btn bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-2"><i data-lucide="message-circle" class="h-4 w-4"></i>হোয়াটসঅ্যাপ গ্রুপে যোগ দিন</a>
        </div>
      </div>
    </div>

    <!-- Filter Tabs (Upcoming, Live, Completed) -->
    <div class="flex items-center justify-between border-b border-white/10 pb-3">
      <div class="flex gap-2">
        <button data-tab="upcoming" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold transition ${S.tab==='upcoming'?'bg-volt text-slate-950 shadow-md shadow-volt/20':'bg-slate-900 text-slate-400 hover:text-slate-200'}">আসন্ন টুর্নামেন্ট</button>
        <button data-tab="live" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold transition ${S.tab==='live'?'bg-volt text-slate-950 shadow-md shadow-volt/20':'bg-slate-900 text-slate-400 hover:text-slate-200'}">চলমান (Live)</button>
        <button data-tab="done" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold transition ${S.tab==='done'?'bg-volt text-slate-950 shadow-md shadow-volt/20':'bg-slate-900 text-slate-400 hover:text-slate-200'}">শেষ হওয়া</button>
      </div>
    </div>

    <!-- Tournament Cards Grid -->
    <div id="fl" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
    
    <!-- Rules / FAQ Section -->
    <div class="glass rounded-3xl p-6 space-y-3 border border-white/10">
      <h2 class="font-bold text-slate-100 text-sm md:text-base flex items-center gap-2"><i data-lucide="help-circle" class="h-5 w-5 text-volt"></i>টুর্নামেন্টে যোগ দেওয়ার সহজ ৩টি ধাপ</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 pt-2">
        <div class="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-1">
          <div class="font-black text-volt text-sm">১. এড মানি করুন</div>
          <p>ওয়ালেট অপশন থেকে আপনার বিকাশ বা নগদ পার্সোনাল নম্বর দিয়ে সহজেই ব্যালেন্স রিচার্জ করুন।</p>
        </div>
        <div class="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-1">
          <div class="font-black text-gold text-sm">২. টুর্নামেন্ট জয়েন</div>
          <p>পছন্দের টুর্নামেন্টে জয়েন করুন। স্লট পূর্ণ হলে ব্র্যাকেট তৈরি হবে এবং ম্যাচ শুরু হবে।</p>
        </div>
        <div class="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-1">
          <div class="font-black text-neon text-sm">৩. জয়ী হয়ে প্রাইজ নিন</div>
          <p>ডিএলএস রুম কোড দিয়ে ম্যাচ খেলে স্ক্রিনশট সাবমিট করুন, প্রাইজ মানি অটো ওয়ালেটে যুক্ত হবে!</p>
        </div>
      </div>
    </div>
  </div>`);

  document.querySelectorAll('[data-tab]').forEach(btn=>{
    btn.onclick=()=>{
      S.tab=btn.dataset.tab;
      drawFeed();
    };
  });

  drawList();
}

function drawList(){
  const allList=S.list;
  const filtered = allList.filter(t => {
    if(S.tab === 'upcoming') return t.status === 'open' || !t.status;
    if(S.tab === 'live') return t.status === 'live';
    if(S.tab === 'done') return t.status === 'done';
    return true;
  });

  const el=$('#fl');if(!el)return;
  
  if(filtered.length === 0){
    el.innerHTML = `<div class="col-span-full glass rounded-3xl p-8 text-center space-y-4 border border-white/10">
      <div class="mx-auto h-12 w-12 rounded-2xl bg-volt/10 text-volt flex items-center justify-center">
        <i data-lucide="trophy" class="h-6 w-6"></i>
      </div>
      <div class="space-y-1">
        <h3 class="text-base font-bold text-slate-100">বর্তমানে কোনো ${S.tab==='upcoming'?'আসন্ন':S.tab==='live'?'চলমান':'সম্পন্ন'} টুর্নামেন্ট নেই!</h3>
        <p class="text-xs text-slate-400 max-w-md mx-auto">নতুন টুর্নামেন্ট খুব শীঘ্রই যুক্ত করা হবে। আপডেট পেতে আমাদের অফিসিয়াল ওয়াটসঅ্যাপ ও ফেসবুক গ্রুপে যুক্ত থাকুন।</p>
      </div>
      <a href="${COMMUNITY_LINK}" target="_blank" class="btn btn-n inline-flex items-center gap-2 !py-2.5 !px-5 text-xs font-bold">কমিউনিটি গ্রুপে যোগ দিন</a>
    </div>`;
    icons();
    return;
  }

  el.innerHTML=filtered.map(t=>{
    const n=(t.players||[]).length, max=t.max||2;
    const pct=Math.min(100,(n/max)*100);
    const cd=countdown(t.start);
    return `<div class="glass rounded-3xl p-5 space-y-4 relative overflow-hidden border border-white/10 hover:border-volt/40 transition">
      <div class="flex justify-between items-start gap-2">
        <h3 class="text-base font-bold text-slate-100 truncate">${esc(t.name)}</h3>
        <span class="badge bg-volt/10 text-volt text-xs font-semibold px-2.5 py-0.5 rounded-full border border-volt/20">${t.type || 'Knockout'}</span>
      </div>
      
      <div class="text-xs text-slate-400 flex items-center gap-1.5"><i data-lucide="calendar" class="h-3.5 w-3.5 text-volt"></i>${fdate(t.start)}</div>

      ${cd?`<div class="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-300 flex items-center gap-2"><i data-lucide="hourglass" class="h-4 w-4 shrink-0"></i>${cd}</div>`:''}

      <div class="grid grid-cols-2 gap-2 bg-slate-900/80 p-3 rounded-2xl border border-white/5">
        <div><div class="text-[11px] text-slate-400 font-medium">এন্ট্রি ফি:</div><div class="text-lg font-black text-volt">৳${t.fee||0}</div></div>
        <div><div class="text-[11px] text-slate-400 font-medium">উইনিং প্রাইজ:</div><div class="text-lg font-black text-gold">৳${t.winnerPrize||0}</div></div>
      </div>
      
      <div class="space-y-1.5">
        <div class="flex justify-between text-xs font-semibold text-slate-300"><span>স্লট ফিলাপ</span><span>${n}/${max} স্লট</span></div>
        <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-volt to-neon rounded-full" style="width:${pct}%"></div></div>
      </div>
      
      <a href="#/t/${t.id}" class="btn btn-n w-full py-3 text-center text-xs font-bold block">টুর্নামেন্ট বিস্তারিত ও জয়েন</a>
    </div>`;
  }).join('');
  icons();
}

function walletView(){
  if(!needAuth())return;
  const bal = profile?.balance || 0, winBal = profile?.winBalance || 0;
  setView(`<div class="space-y-5 py-4 max-w-2xl mx-auto pb-24 px-3 md:px-0">
    <div class="glass rounded-3xl p-6 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-gold/30 shadow-2xl">
      <div class="text-xs text-slate-400 font-medium">আমার ওয়ালেট একাউন্ট</div>
      <div class="grid grid-cols-2 gap-4 mt-4">
        <div class="bg-slate-900/90 p-4 rounded-2xl border border-white/5"><div class="text-xs text-slate-400">মেইন ব্যালেন্স</div><div class="text-2xl font-black text-volt mt-1">৳${bal}</div></div>
        <div class="bg-slate-900/90 p-4 rounded-2xl border border-white/5"><div class="text-xs text-slate-400">উইনিং ব্যালেন্স</div><div class="text-2xl font-black text-gold mt-1">৳${winBal}</div></div>
      </div>
    </div>
    <div class="glass rounded-3xl p-6 space-y-4 text-center border border-white/10">
      <p class="text-xs text-slate-300">টাকা এড করতে বা আপনার উইনিং ব্যালেন্স তুলতে নিচের বাটন ব্যবহার করুন</p>
      <div class="grid grid-cols-2 gap-4">
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
      <div><label class="lbl text-xs">ট্রানজেকশন আইডি (TrxID)</label><input id="tx" class="inp text-sm uppercase" placeholder="যেমন: 8N7X9W2K3L" maxlength="30"></div>
      <button id="verifyBtn" class="btn btn-n w-full py-3 font-bold">ভেরিফাই ও সাবমিট</button>
    </div>`);

    m.$('#copyBtn').onclick=()=>{
      navigator.clipboard.writeText('01878254585');
      toast('নম্বর সফলভাবে কপি হয়েছে!');
    };

    m.$('#verifyBtn').onclick=async()=>{
      const amount=+m.$('#am').value;
      const trx=m.$('#tx').value.trim().replace(/[^A-Za-z0-9]/g,'').toUpperCase();
      if(!amount||amount<10||amount>50000||trx.length<5)return toast('সঠিক পরিমাণ (১০–৫০,০০০) ও TrxID দিন','err');
      try{
        await F.setDoc(F.doc(db,'deposits',trx),{uid:user.uid,team:profile?.team||'User',amount,trx,status:'pending',createdAt:F.serverTimestamp()});
        toast('ডিপোজিট অনুরোধ পাঠানো হয়েছে!');m.close();
      }catch(e){toast(e.code==='permission-denied'?'এই TrxID আগেই জমা হয়েছে বা তথ্য ভুল':e.message,'err')}
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

  setView(`<div class="space-y-4 py-4 max-w-3xl mx-auto pb-24 px-3 md:px-0">
    <a href="#/" class="inline-flex items-center gap-1 text-xs text-volt font-medium"><i data-lucide="chevron-left" class="h-4 w-4"></i>ফিরে যান</a>
    <div class="glass rounded-3xl p-6 space-y-4 border border-white/10">
      <div class="flex justify-between items-start gap-2"><h1 class="text-lg md:text-xl font-black text-slate-100">${esc(t.name)}</h1><span class="badge bg-volt/15 text-volt text-xs">${t.type || 'Knockout'}</span></div>
      <div class="grid grid-cols-2 gap-3 bg-slate-900/60 p-4 rounded-2xl">
        <div><div class="text-xs text-slate-400">এন্ট্রি ফি:</div><div class="text-xl font-black text-volt">৳${t.fee||0}</div></div>
        <div><div class="text-xs text-slate-400">উইনিং প্রাইজ:</div><div class="text-xl font-black text-gold">৳${t.winnerPrize||0}</div></div>
      </div>
      <div class="bg-slate-900/80 p-3.5 rounded-2xl text-xs space-y-1">
        <div>🥇 প্রথম স্থান (Winner): <b>৳${t.winnerPrize||0}</b></div>
        <div>🥈 দ্বিতীয় স্থান (Runner-up): <b>৳${t.runnerUpPrize||0}</b></div>
      </div>
      ${!me&&!full?`<button data-act="join" class="btn btn-n w-full py-3 font-bold text-sm">টুর্নামেন্ট জয়েন করুন</button>`:''}
      ${me?`<div class="rounded-2xl bg-neon/10 p-3 text-center text-neon font-bold text-xs">✔ আপনি সফলভাবে জয়েন করেছেন</div>`:''}
    </div>

    <div class="glass rounded-3xl p-5 space-y-3">
      <h2 class="font-bold text-slate-100 text-sm flex items-center gap-1.5"><i data-lucide="swords" class="h-4 w-4 text-volt"></i>ম্যাচ ব্র্যাকেট ও ফিকচার</h2>
      ${t.rounds ? renderBracket(t, uid) : `<p class="text-xs text-slate-400">স্লট পূর্ণ হওয়ার পর অ্যাডমিন ব্র্যাকেট জেনারেট করবেন।</p>`}
    </div>

    <div class="glass rounded-3xl p-5 space-y-3">
      <div class="font-bold text-slate-100 text-xs">জয়েন করা টিমসমূহ (${n}/${t.max}):</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        ${t.players.map(p=>`<div class="flex items-center justify-between bg-white/5 px-3.5 py-2.5 rounded-2xl text-xs"><div class="flex items-center gap-2 rounded-full"><img src="${esc(p.avatar)}" class="h-7 w-7 rounded-full object-cover"><span class="font-semibold">${esc(p.team)}</span></div></div>`).join('')||`<span class="text-xs text-slate-400 col-span-full">এখনো কেউ জয়েন করেনি।</span>`}
      </div>
    </div>

    ${isAdmin ? `
      <div class="glass rounded-3xl p-5 space-y-3 border border-volt/40 bg-slate-950">
        <h2 class="font-bold text-volt text-xs">অ্যাডমিন অ্যাকশন: ব্র্যাকেট জেনারেট</h2>
        <button id="genBracketBtn" class="btn btn-p w-full py-2.5 text-xs font-bold">ব্র্যাকেট অটো-জেনারেট করুন</button>
      </div>
    ` : ''}
  </div>`);
  icons();

  if(isAdmin && $('#genBracketBtn')){
    $('#genBracketBtn').onclick=async()=>{
      if(t.players.length < 2) return toast('ন্যূনতম ২ জন প্লেয়ার জয়েন করতে হবে','err');
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
    
    setView(`<div class="space-y-4 py-4 max-w-2xl mx-auto pb-24 px-3 md:px-0">
      <a href="#/t/${tid}" class="inline-flex items-center gap-1 text-xs text-volt font-medium"><i data-lucide="chevron-left" class="h-4 w-4"></i>টুর্নামেন্টে ফিরে যান</a>
      <div class="glass rounded-3xl p-6 space-y-5 text-center">
        <h1 class="text-sm font-bold text-volt uppercase tracking-wider">ডিএলএস ম্যাচ রুম ও কোড শেয়ারিং</h1>
        <div class="grid grid-cols-2 gap-4 items-center bg-slate-900/80 p-4 rounded-2xl border border-white/10">
          <div>
            <div class="font-bold text-base text-slate-100">${esc(m.a?.team||'নির্ধারিত নয়')}</div>
            <div class="text-[11px] text-slate-400">টিম এ</div>
          </div>
          <div>
            <div class="font-bold text-base text-slate-100">${esc(m.b?.team||'নির্ধারিত নয়')}</div>
            <div class="text-[11px] text-slate-400">টিম বি</div>
          </div>
        </div>

        <div class="rounded-2xl bg-slate-900 p-4 border border-volt/30 space-y-2 text-left text-xs">
          <div class="font-bold text-volt flex items-center justify-between">
            <span>ডিএলএস ফ্রেন্ড কোড / রুম কোড:</span>
            <span class="text-slate-400 text-[11px]">স্ট্যাটাস: ${m.status}</span>
          </div>
          <div class="text-slate-200 font-mono text-sm bg-black/40 p-2.5 rounded-xl">${m.room ? esc(m.room) : 'কোনো কোড দেওয়া হয়নি'}</div>
          
          ${isPlayer && m.status!=='done' ? `
            <div class="pt-2 flex gap-2">
              <input id="roomInput" class="inp text-xs !py-2" placeholder="আপনার রুম কোড দিন (যেমন: 12345)" value="${esc(m.room||'')}">
              <button id="saveRoomBtn" class="btn btn-n !py-2 !px-3 text-xs shrink-0 font-bold">কোড সেভ করুন</button>
            </div>
          ` : ''}
        </div>

        <div class="rounded-2xl bg-slate-900 p-4 border border-white/10 space-y-2 text-left text-xs">
          <div class="font-bold text-gold">ম্যাচ রেজাল্ট ও স্ক্রিনশট (প্রুফ):</div>
          <div>স্কোর: <b>${m.sa ?? '-'}</b> : <b>${m.sb ?? '-'}</b></div>
          ${m.proof && safeUrl(m.proof) ? `<a href="${esc(safeUrl(m.proof))}" target="_blank" rel="noopener noreferrer" class="text-volt underline block truncate">স্ক্রিনশট লিংক দেখুন</a>` : '<div class="text-slate-400 text-[11px]">কোনো স্ক্রিনশট সাবমিট করা হয়নি।</div>'}
          
          ${isPlayer && m.status!=='done' ? `
            <div class="space-y-2 pt-2 border-t border-white/10">
              <div class="grid grid-cols-2 gap-2">
                <input id="saInp" class="inp text-xs !py-2" type="number" placeholder="আপনার গোল" value="${m.sa??''}">
                <input id="sbInp" class="inp text-xs !py-2" type="number" placeholder="প্রতিপক্ষের গোল" value="${m.sb??''}">
              </div>
              <input id="proofInp" class="inp text-xs !py-2" placeholder="স্ক্রিনশট ইমেজ লিংক (https://...)" value="${esc(m.proof||'')}">
              <button id="submitResBtn" class="btn btn-p w-full py-2.5 text-xs font-bold">রেজাল্ট ও প্রুফ জমা দিন</button>
            </div>
          ` : ''}
        </div>

        ${isAdmin ? `
          <div class="rounded-2xl bg-slate-950 p-5 border border-volt/40 space-y-3 text-left text-xs">
            <div class="font-bold text-volt">অ্যাডমিন ম্যাচ কন্ট্রোল:</div>
            <div class="space-y-1">
              <label class="lbl text-[11px]">জয়ী দল সিলেক্ট করুন:</label>
              <select id="winnerSelect" class="inp text-xs !py-2">
                <option value="">-- উইনার সিলেক্ট করুন --</option>
                <option value="${m.a?.uid}" ${m.winner===m.a?.uid?'selected':''}>${esc(m.a?.team||'টিম এ')}</option>
                <option value="${m.b?.uid}" ${m.winner===m.b?.uid?'selected':''}>${esc(m.b?.team||'টিম বি')}</option>
              </select>
            </div>
            <button id="adminWinBtn" class="btn btn-n w-full py-2.5 text-xs font-bold">উইনার কনফার্ম ও পরবর্তী রাউন্ডে পাঠান</button>
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
        if(proof && !safeUrl(proof)) return toast('সঠিক HTTPS ইমেজ লিংক দিন','err');
        m.sa = sa; m.sb = sb; m.proof = proof; m.status = 'disputed';
        T.rounds['r'+r][i] = m;
        await F.updateDoc(tref(tid), { rounds: T.rounds });
        toast('রেজাল্ট ও প্রুফ সফলভাবে জমা হয়েছে!');
      };
    }

    if(isAdmin && $('#adminWinBtn')){
      $('#adminWinBtn').onclick=async()=>{
        const winnerUid=$('#winnerSelect').value;
        if(!winnerUid)return toast('সঠিক উইনার সিলেক্ট করুন','err');
        const w=winnerUid===m.a?.uid?m.a:m.b,l=winnerUid===m.a?.uid?m.b:m.a,isFinal=+r===Object.keys(T.rounds).length-1;
        try{
          await F.runTransaction(db,async tx=>{
            const tRef=tref(tid),t=(await tx.get(tRef)).data(),mm=t.rounds['r'+r][i];
            if(mm.status==='done')throw Error('এই ম্যাচের উইনার আগেই কনফার্ম হয়েছে');
            let wd,ld;
            if(isFinal){wd=await tx.get(F.doc(db,'users',w.uid));if(l)ld=await tx.get(F.doc(db,'users',l.uid))}
            mm.winner=winnerUid;mm.status='done';advance(t.rounds,+r,+i,w);
            const upd={rounds:t.rounds};
            if(isFinal){
              upd.status='done';upd.champion={uid:w.uid,team:w.team};
              tx.set(wd.ref,{winBalance:(wd.data()?.winBalance||0)+(t.winnerPrize||0)},{merge:true});
              if(ld)tx.set(ld.ref,{winBalance:(ld.data()?.winBalance||0)+(t.runnerUpPrize||0)},{merge:true});
            }
            tx.update(tRef,upd);
          });
          toast('উইনার কনফার্ম করা হয়েছে!');
        }catch(e){toast(e.message,'err')}
      };
    }
  });
}

actions.join=async()=>{
  if(!needAuth())return;
  if(!complete(profile)){toast('প্রথমে প্রোফাইল সম্পূর্ণ করুন (টিম নাম, ফোন এবং ছবি বাধ্যতামূলক)','err');location.hash='#/me';return;}
  const t=T,fee=t.fee||0,myBal=profile?.balance||0,uids=t.uids||[];
  if(t.status!=='open')return toast('রেজিস্ট্রেশন বন্ধ','err');
  if(uids.includes(user.uid))return toast('আপনি আগেই জয়েন করেছেন','err');
  if(uids.length>=t.max)return toast('স্লট পূর্ণ','err');
  if(myBal<fee)return toast('ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই! এড মানি করুন।','err');
  try{
    const b=F.writeBatch(db);
    b.update(tref(t.id),{players:F.arrayUnion({uid:user.uid,team:profile.team,avatar:profile.avatar||''}),uids:F.arrayUnion(user.uid)});
    if(fee>0)b.update(F.doc(db,'users',user.uid),{balance:myBal-fee});
    await b.commit();
    profile.balance=myBal-fee;header();toast('সফলভাবে টুর্নামেন্টে জয়েন করেছেন!');
  }catch(e){toast('জয়েন করা যায়নি: '+e.message,'err')}
};

function historyView(){
  if(!needAuth())return;
  const list = S.list.filter(t => (t.uids || []).includes(user.uid));
  setView(`<div class="space-y-6 py-4 max-w-3xl mx-auto pb-24 px-3 md:px-0">
    <div class="space-y-1">
      <h1 class="text-lg font-black text-slate-100 flex items-center gap-2"><i data-lucide="scroll" class="h-5 w-5 text-volt"></i>আমার টুর্নামেন্ট ও একটিভিটি হিস্টরি</h1>
      <p class="text-xs text-slate-400">আপনার অংশগ্রহণ করা টুর্নামেন্টগুলোর রেকর্ড।</p>
    </div>
    
    <div class="space-y-3">
      ${list.map(t=>`
        <div class="glass rounded-3xl p-5 space-y-3 border border-white/10 hover:border-volt/30 transition">
          <div class="flex justify-between items-center text-sm font-bold text-slate-100">
            <span>${esc(t.name)}</span>
            <span class="badge ${t.status==='done'?'bg-emerald-500/10 text-emerald-400':'bg-volt/10 text-volt'} text-xs font-semibold">${t.status==='done'?'সম্পন্ন':'চলমান'}</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-2xl">
            <div><span class="text-slate-400">এন্ট্রি ফি:</span> <b class="text-volt">৳${t.fee||0}</b></div>
            <div><span class="text-slate-400">শুরুর সময়:</span> <b>${fdate(t.start)}</b></div>
          </div>
          <a href="#/t/${t.id}" class="btn btn-n w-full !py-2 text-xs font-bold block text-center">টুর্নামেন্ট ফিকচার ও রেজাল্ট দেখুন</a>
        </div>
      `).join('') || '<div class="glass rounded-3xl p-8 text-center text-xs text-slate-300">আপনি এখনো কোনো টুর্নামেন্টে জয়েন করেননি।</div>'}
    </div>
  </div>`);
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
  setView(`<div class="space-y-4 py-4 max-w-xl mx-auto pb-24 px-3 md:px-0">
    <form id="pf" class="glass rounded-3xl p-6 space-y-4 border border-white/10">
      <h1 class="text-lg font-black text-slate-100">প্রোফাইল (বাধ্যতামূলক তথ্য)</h1>
      <div><label class="lbl text-xs">টিম নাম <span class="text-red-400">*</span></label><input class="inp text-sm" name="team" required value="${esc(p.team||'')}"></div>
      <div><label class="lbl text-xs">মোবাইল নম্বর <span class="text-red-400">*</span></label><input class="inp text-sm" name="phone" required type="tel" value="${esc(p.phone||'')}"></div>
      <div>
        <label class="lbl text-xs">প্রোফাইল পিকচার (Choose File) <span class="text-red-400">*</span></label>
        <input class="inp text-xs file:mr-2 file:rounded-md file:border-0 file:bg-volt file:px-2.5 file:py-1 file:text-xs file:font-bold" id="imgFile" type="file" accept="image/*">
        <input type="hidden" name="avatar" id="avatarVal" value="${esc(p.avatar||'')}">
      </div>
      ${p.avatar?`<div class="flex items-center gap-2.5"><img src="${esc(p.avatar)}" class="h-10 w-10 rounded-full object-cover border border-volt/40"><span class="text-[11px] text-slate-400">বর্তমান ছবি</span></div>`:''}
      <button class="btn btn-p w-full py-3 text-xs font-bold">প্রোফাইল সেভ করুন</button>
    </form>
    <button data-act="logout" class="btn btn-g w-full py-3 text-xs text-red-400 font-semibold">লগআউট</button>
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
    setView(`<div class="p-12 text-center text-red-400 font-bold text-xs">৪৬৪ - অননুমোদিত প্রবেশ! (Unauthorized Access)</div>`);
    return;
  }

  setView(`<div class="space-y-6 py-4 max-w-3xl mx-auto pb-24 px-3 md:px-0">
    <h1 class="text-lg font-black text-slate-100">অ্যাডমিন কন্ট্রোল প্যানেল (/admin)</h1>
    
    <!-- Tourney Creator -->
    <div class="glass rounded-3xl p-6 space-y-4 border border-volt/40">
      <h2 class="font-bold text-volt text-sm">নতুন টুর্নামেন্ট তৈরি করুন</h2>
      <form id="mkTourney" class="space-y-3">
        <div><label class="lbl text-xs">টুর্নামেন্টের নাম</label><input class="inp text-sm" name="name" required placeholder="ফ্রাইডে নাইট কাপ"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="lbl text-xs">এন্ট্রি ফি (৳)</label><input class="inp text-sm" name="fee" type="number" value="50" required></div>
          <div><label class="lbl text-xs">সর্বোচ্চ স্লট</label><select class="inp text-sm" name="max"><option value="2">২ স্লট</option><option value="4">৪ স্লট</option><option value="8">৮ স্লট</option><option value="16">১৬ স্লট</option></select></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="lbl text-xs">ফরম্যাট / টাইপ</label><select class="inp text-sm" name="type"><option value="Knockout">নকআউট (Knockout)</option><option value="Group Stage">গ্রুপ স্টেজ</option></select></div>
          <div><label class="lbl text-xs">শুরুর সময়</label><input class="inp text-sm" name="start" type="datetime-local" required></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="lbl text-xs">উইনার প্রাইজ (৳)</label><input class="inp text-sm" name="winnerPrize" type="number" value="80" required></div>
          <div><label class="lbl text-xs">রানার্স-আপ প্রাইজ (৳)</label><input class="inp text-sm" name="runnerUpPrize" type="number" value="20" required></div>
        </div>
        <button class="btn btn-p w-full py-3 text-xs font-bold">টুর্নামেন্ট পাবলিশ করুন</button>
      </form>
    </div>

    <!-- Admin Deposit & Withdraw Requests Box -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="glass rounded-3xl p-5 space-y-3 border border-neon/30">
        <h2 class="font-bold text-neon text-xs flex items-center gap-1.5"><i data-lucide="wallet" class="h-4 w-4"></i>এড মানি রিকোয়েস্ট</h2>
        <div id="depList" class="space-y-2 text-xs">লোড হচ্ছে...</div>
      </div>

      <div class="glass rounded-3xl p-5 space-y-3 border border-gold/30">
        <h2 class="font-bold text-gold text-xs flex items-center gap-1.5"><i data-lucide="send" class="h-4 w-4"></i>উইথড্র রিকোয়েস্ট</h2>
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
      <div class="bg-slate-900 p-3 rounded-2xl border border-white/5 space-y-1.5">
        <div>টিম: <b>${esc(d.team)}</b></div>
        <div>পরিমাণ: <span class="text-volt font-bold">৳${d.amount}</span></div>
        <div>TrxID: <span class="font-mono text-gold">${esc(d.trx)}</span></div>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <button data-approve-dep="${d.id}" class="btn btn-n !py-1.5 !px-2 text-[11px] font-bold">অনুমোদন</button>
          <button data-decline-dep="${d.id}" class="btn bg-red-500/20 text-red-300 hover:bg-red-500/30 !py-1.5 !px-2 text-[11px] font-bold">বাতিল</button>
        </div>
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
      <div class="bg-slate-900 p-3 rounded-2xl border border-white/5 space-y-1.5">
        <div>টিম: <b>${esc(w.team)}</b></div>
        <div>নম্বর: <span class="text-volt font-bold">${esc(w.phone)}</span></div>
        <div>পরিমাণ: <span class="text-gold font-bold">৳${w.amount}</span></div>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <button data-approve-with="${w.id}" class="btn btn-p !py-1.5 !px-2 text-[11px] font-bold">পেইড</button>
          <button data-decline-with="${w.id}" class="btn bg-red-500/20 text-red-300 hover:bg-red-500/30 !py-1.5 !px-2 text-[11px] font-bold">বাতিল</button>
        </div>
      </div>
    `).join('') || '<div class="text-slate-400">কোনো পেন্ডিং উইথড্র নেই।</div>';
    icons();
  });

  $('#mkTourney').onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const fee = +fd.get('fee'), max = +fd.get('max'), wp = +fd.get('winnerPrize'), rp = +fd.get('runnerUpPrize');
    if((wp + rp) > (fee * max)){
      if(!confirm('প্রাইজ মোট ফি-র চেয়ে বেশি। চালিয়ে যাবেন?')) return;
    }
    try {
      await F.addDoc(F.collection(db,'tournaments'),{
        name: fd.get('name'),
        fee,
        winnerPrize: wp,
        runnerUpPrize: rp,
        max,
        type: fd.get('type'),
        start: fd.get('start'),
        status: 'open',
        players: [],
        uids: [],
        createdAt: F.serverTimestamp()
      });
      toast('টুর্নামেন্ট সফলভাবে তৈরি হয়েছে!');
      e.target.reset();
    } catch(err){toast(err.message,'err')}
  };
}

// Transaction Listeners
document.addEventListener('click', async e=>{
  const depBtn = e.target.closest('[data-approve-dep]');
  if(depBtn){
    try{
      await F.runTransaction(db,async tx=>{
        const dRef=F.doc(db,'deposits',depBtn.dataset.approveDep),d=await tx.get(dRef);
        if(!d.exists()||d.data().status!=='pending')throw Error('আগেই প্রসেস হয়েছে');
        const uRef=F.doc(db,'users',d.data().uid),u=await tx.get(uRef);
        tx.set(uRef,{balance:(u.exists()?(u.data().balance||0):0)+d.data().amount},{merge:true});
        tx.update(dRef,{status:'accepted'});
      });
      toast('ডিপোজিট অনুমোদন করা হয়েছে!');adminView();
    }catch(err){toast(err.message,'err')}
  }

  const depDec = e.target.closest('[data-decline-dep]');
  if(depDec){
    try{
      await F.setDoc(F.doc(db,'deposits',depDec.dataset.declineDep),{status:'rejected'},{merge:true});
      toast('ডিপোজিট অনুরোধ বাতিল করা হয়েছে।');adminView();
    }catch(err){toast(err.message,'err')}
  }

  const withBtn = e.target.closest('[data-approve-with]');
  if(withBtn){
    try{
      await F.runTransaction(db,async tx=>{
        const wRef=F.doc(db,'withdraws',withBtn.dataset.approveWith),w=await tx.get(wRef);
        if(!w.exists()||w.data().status!=='pending')throw Error('আগেই প্রসেস হয়েছে');
        const uRef=F.doc(db,'users',w.data().uid),u=await tx.get(uRef),bal=u.exists()?(u.data().winBalance||0):0;
        if(bal<w.data().amount)throw Error('ইউজারের উইনিং ব্যালেন্স কম, বাতিল করুন');
        tx.update(uRef,{winBalance:bal-w.data().amount});
        tx.update(wRef,{status:'accepted'});
      });
      toast('উইথড্র পেইড করা হয়েছে!');adminView();
    }catch(err){toast(err.message,'err')}
  }

  const withDec = e.target.closest('[data-decline-with]');
  if(withDec){
    try{
      await F.setDoc(F.doc(db,'deposits',withDec.dataset.declineWith),{status:'rejected'},{merge:true});
      toast('উইথড্র অনুরোধ বাতিল করা হয়েছে।');adminView();
    }catch(err){toast(err.message,'err')}
  }
});
