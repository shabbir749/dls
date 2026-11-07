import * as F from './firebase.js';
import {$,esc,money,icons,skeleton,toast,modal} from './ui.js';
import {build, buildGroups, renderBracket, advance} from './bracket.js';

const {auth,db}=F,app=$('#app');
let user=null,profile=null,unsub=null,T=null,S={tab:'upcoming',list:[],q:''};

const ADMIN_EMAIL = 'theshabbirtech@gmail.com';
const COMMUNITY_LINK = 'https://chat.whatsapp.com/KX9hr8fJ4JyHSRssYZd5fy'; 

const tref=id=>F.doc(db,'tournaments',id);
const complete=p=>p&&p.team&&p.phone&&p.avatar;
const fdate=s=>s?new Date(s).toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short'}):'নির্ধারিত নয়';
const countdown=s=>{if(!s)return '';const ms=new Date(s)-Date.now();return isNaN(ms)?'':ms<=0?'শীঘ্রই শুরু হচ্ছে':`শুরু হবে ${Math.floor(ms/60000)}মি এ`;};
const setView=h=>{app.innerHTML=h;icons()};
const needAuth=()=>{if(user)return true;authModal();return false};
const listen=draw=>{unsub=F.onSnapshot(F.query(F.collection(db,'tournaments'),F.orderBy('createdAt','desc')),s=>{S.list=s.docs.map(d=>({id:d.id,...d.data()}));draw()},e=>toast(e.message,'err'))};

const safeUrl=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:''}catch(e){return ''}};

F.onAuthStateChanged(auth,async u=>{
  user=u;profile=null;
  if(u){try{const s=await F.getDoc(F.doc(db,'users',u.uid));profile=s.exists()?s.data():null}catch(e){}}
  header();nav();route();
});

function header(){
  const bal = profile?.balance || 0;
  const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Crect width='30' height='30' fill='%23334155'/%3E%3Ctext x='50%25' y='50%25' fill='%23fff' font-size='12' text-anchor='middle' dy='.3em'%3EU%3C/text%3E%3C/svg%3E";
  
  const hdrEl = $('#hdr');
  if(!hdrEl) return;
  hdrEl.innerHTML=`
    <div class="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300 mx-auto">
      <a href="#/" class="hover:text-volt transition">হোম</a>
      <a href="#/history" class="hover:text-volt transition">হিস্টরি</a>
      <a href="#/wallet" class="hover:text-volt transition">ওয়ালেট</a>
      <a href="#/me" class="hover:text-volt transition">প্রোফাইল</a>
    </div>

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
    <div class="glass rounded-3xl p-6 md:p-8 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-volt/20 relative overflow-hidden shadow-2xl">
      <div class="relative z-10 space-y-4">
        <span class="badge bg-volt/15 text-volt text-xs font-bold px-3 py-1 rounded-full border border-volt/30 inline-flex items-center gap-1.5"><i data-lucide="shield-check" class="h-3.5 w-3.5"></i>১০০% বিশ্বস্ত DLS ই-স্পোর্টস প্ল্যাটফর্ম</span>
        <h1 class="text-xl md:text-3xl font-black text-slate-100 leading-tight">ডিএলএস খেলুন, টুর্নামেন্টে জিতুন এবং ইন্সট্যান্ট ক্যাশআউট করুন!</h1>
        <p class="text-xs md:text-sm text-slate-300 max-w-xl">স্বয়ংক্রিয় ব্র্যাকেট ও পয়েন্ট টেবিল সিস্টেম, দ্রুত বিকাশ/নগদ পেমেন্ট এবং ২৪/৭ সাপোর্ট।</p>
        
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

    <div class="flex items-center justify-between border-b border-white/10 pb-3">
      <div class="flex gap-2">
        <button data-tab="upcoming" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold transition ${S.tab==='upcoming'?'bg-volt text-slate-950 shadow-md shadow-volt/20':'bg-slate-900 text-slate-400 hover:text-slate-200'}">আসন্ন টুর্নামেন্ট</button>
        <button data-tab="live" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold transition ${S.tab==='live'?'bg-volt text-slate-950 shadow-md shadow-volt/20':'bg-slate-900 text-slate-400 hover:text-slate-200'}">চলমান (Live)</button>
        <button data-tab="done" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold transition ${S.tab==='done'?'bg-volt text-slate-950 shadow-md shadow-volt/20':'bg-slate-900 text-slate-400 hover:text-slate-200'}">শেষ হওয়া</button>
      </div>
    </div>

    <div id="fl" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>

    <div class="glass rounded-3xl p-6 space-y-3 border border-white/10">
      <h2 class="font-bold text-slate-100 text-sm md:text-base flex items-center gap-2"><i data-lucide="help-circle" class="h-5 w-5 text-volt"></i>টুর্নামেন্টে যোগ দেওয়ার সহজ ৩টি ধাপ</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 pt-2">
        <div class="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-1">
          <div class="font-black text-volt text-sm">১. এড মানি করুন</div>
          <p>ওয়ালেট অপশন থেকে আপনার বিকাশ বা নগদ পার্সোনাল নম্বরে টাকা পাঠিয়ে ব্যালেন্স রিচার্জ করুন।</p>
        </div>
        <div class="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-1">
          <div class="font-black text-gold text-sm">২. টুর্নামেন্ট জয়েন</div>
          <p>পছন্দের টুর্নামেন্টে জয়েন করুন। স্লট পূর্ণ হলে অ্যাডমিন ব্র্যাকেট বা গ্রুপ স্টেজ চালু করবেন।</p>
        </div>
        <div class="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-1">
          <div class="font-black text-neon text-sm">৩. স্ক্রিনশট ও প্রাইজ</div>
          <p>ম্যাচ শেষে স্ক্রিনশট আপলোড করুন, অ্যাডমিন ভেরিফাই করার পর প্রাইজ মানি ওয়ালেটে যুক্ত হবে!</p>
        </div>
      </div>
    </div>

    <div class="glass rounded-3xl p-6 space-y-4 border border-white/10">
      <h2 class="font-bold text-slate-100 text-sm md:text-base flex items-center gap-2"><i data-lucide="help-circle" class="h-5 w-5 text-volt"></i>সাধারণ জিজ্ঞাসা (FAQ)</h2>
      <div class="space-y-2.5">
        <details class="group bg-slate-900/80 border border-white/10 rounded-2xl p-4 transition">
          <summary class="cursor-pointer font-bold text-xs md:text-sm text-slate-200 flex justify-between items-center select-none">
            ১. ওয়ালেটে টাকা এড হতে কত সময় লাগে?
          </summary>
          <p class="text-xs text-slate-400 mt-2.5 pt-2.5 border-t border-white/5 leading-relaxed">
            সঠিক ট্রানজেকশন আইডি (TrxID) দিয়ে সাবমিট করার সাধারণত ৫ থেকে ১০ মিনিটের মধ্যে অ্যাডমিন ভেরিফাই করে আপনার মেইন ব্যালেন্সে টাকা যুক্ত করে দেন।
          </p>
        </details>

        <details class="group bg-slate-900/80 border border-white/10 rounded-2xl p-4 transition">
          <summary class="cursor-pointer font-bold text-xs md:text-sm text-slate-200 flex justify-between items-center select-none">
            ২. ম্যাচ ড্র হলে বা ডিসকানেক্ট হলে কী হবে?
          </summary>
          <p class="text-xs text-slate-400 mt-2.5 pt-2.5 border-t border-white/5 leading-relaxed">
            নেটওয়ার্ক সমস্যা বা ডিসকানেক্টের কারণে ম্যাচ অসম্পূর্ণ থাকলে দুই প্লেয়ারের পারস্পরিক সমঝোতায় পুনরায় ম্যাচ খেলতে হবে এবং প্রুফ হিসেবে স্ক্রিনশট দিতে হবে।
          </p>
        </details>

        <details class="group bg-slate-900/80 border border-white/10 rounded-2xl p-4 transition">
          <summary class="cursor-pointer font-bold text-xs md:text-sm text-slate-200 flex justify-between items-center select-none">
            ৩. উইনিং ব্যালেন্স কীভাবে বিকাশ বা নগদে তুলব?
          </summary>
          <p class="text-xs text-slate-400 mt-2.5 pt-2.5 border-t border-white/5 leading-relaxed">
            ওয়ালেট অপশন থেকে উইথড্র বাটনে ক্লিক করে আপনার বিকাশ বা নগদ পার্সোনাল নম্বর এবং পরিমাণ (ন্যূনতম ১০০ টাকা) দিয়ে রিকোয়েস্ট পাঠাতে হবে। ২৪ ঘণ্টার মধ্যে পেমেন্ট কমপ্লিট করা হয়।
          </p>
        </details>

        <details class="group bg-slate-900/80 border border-white/10 rounded-2xl p-4 transition">
          <summary class="cursor-pointer font-bold text-xs md:text-sm text-slate-200 flex justify-between items-center select-none">
            ৪. ইন-গেম টিম নাম ভুল দিলে কি পরিবর্তন করা যাবে?
          </summary>
          <p class="text-xs text-slate-400 mt-2.5 pt-2.5 border-t border-white/5 leading-relaxed">
            হ্যাঁ, আপনি প্রোফাইল সেকশনে গিয়ে যেকোনো সময় আপনার DLS ইন-গেম টিম নাম এবং ছবি আপডেট করে নিতে পারবেন। তবে টুর্নামেন্ট শুরু হওয়ার আগেই তা সঠিক করতে হবে।
          </p>
        </details>
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
        <p class="text-xs text-slate-400 max-w-md mx-auto">নতুন টুর্নামেন্ট খুব শীঘ্রই যুক্ত করা হবে। আপডেট পেতে আমাদের অফিসিয়াল ওয়াটসঅ্যাপ গ্রুপে যুক্ত থাকুন।</p>
      </div>
      <a href="${COMMUNITY_LINK}" target="_blank" class="btn btn-n inline-flex items-center gap-2 !py-2.5 !px-5 text-xs font-bold">কমিউনিটি গ্রুপে যোগ দিন</a>
    </div>`;
    icons();
    return;
  }

  el.innerHTML=filtered.map(t=>{
    const n=(t.players||[]).length, max=t.max||4;
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

function renderGroupTables(t){
  if(!t.groups) return '<p class="text-xs text-slate-400">গ্রুপ এখনো তৈরি হয়নি।</p>';
  return Object.keys(t.groups).map(gKey => {
    const standings = t.standings?.[gKey] || [];
    return `<div class="space-y-2 mb-4">
      <div class="text-xs font-bold text-volt flex items-center gap-1"><i data-lucide="shield" class="h-3.5 w-3.5"></i>${gKey.toUpperCase()} পয়েন্ট টেবিল</div>
      <div class="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/80">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-950 text-slate-400 text-[10px] border-b border-white/10">
            <tr>
              <th class="p-2">টিম</th>
              <th class="p-2 text-center">P</th>
              <th class="p-2 text-center">W</th>
              <th class="p-2 text-center">D</th>
              <th class="p-2 text-center">L</th>
              <th class="p-2 text-center">GF</th>
              <th class="p-2 text-center">GD</th>
              <th class="p-2 text-center font-bold text-volt">PTS</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            ${standings.map(s=>`
              <tr class="hover:bg-white/5">
                <td class="p-2 font-semibold text-slate-200 truncate max-w-[100px]">${esc(s.team)}</td>
                <td class="p-2 text-center text-slate-400">${s.mp||0}</td>
                <td class="p-2 text-center text-emerald-400">${s.w||0}</td>
                <td class="p-2 text-center text-amber-400">${s.d||0}</td>
                <td class="p-2 text-center text-red-400">${s.l||0}</td>
                <td class="p-2 text-center text-slate-300">${s.gf||0}</td>
                <td class="p-2 text-center text-slate-300">${s.gd||0}</td>
                <td class="p-2 text-center font-black text-volt">${s.pts||0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

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
      <div class="flex justify-between items-start gap-2"><h1 class="text-lg md:text-xl font-black text-slate-100">${esc(t.name)}</h1><span class="badge bg-volt/15 text-volt text-xs">${t.type || 'Knockout'} (${t.max||4} টিম)</span></div>
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

    ${t.type==='Group Stage' || t.type==='Hybrid' ? `
      <div class="glass rounded-3xl p-5 space-y-3">
        <h2 class="font-bold text-slate-100 text-sm flex items-center gap-1.5"><i data-lucide="table" class="h-4 w-4 text-volt"></i>গ্রুপ স্টেজ স্ট্যান্ডিংস ও পয়েন্ট টেবিল</h2>
        ${renderGroupTables(t)}
      </div>
    `:''}

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
        <h2 class="font-bold text-volt text-xs">অ্যাডমিন অ্যাকশন: ব্র্যাকেট/গ্রুপ জেনারেট</h2>
        <button id="genBracketBtn" class="btn btn-p w-full py-2.5 text-xs font-bold">ব্র্যাকেট অটো-জেনারেট করুন</button>
      </div>
    ` : ''}
  </div>`);
  icons();

  if(isAdmin && $('#genBracketBtn')){
    $('#genBracketBtn').onclick=async()=>{
      if(t.players.length < 4) return toast('ন্যূনতম ৪ জন প্লেয়ার জয়েন করতে হবে','err');
      try {
        let updateData = {};
        if(t.type==='Group Stage' || t.type==='Hybrid'){
          const gRes = buildGroups(t.players, t.max >= 16 ? 4 : 2);
          updateData = { groups: gRes.groups, standings: gRes.standings, rounds: build(t.players), status: 'live' };
        } else {
          updateData = { rounds: build(t.players), status: 'live' };
        }
        await F.updateDoc(tref(t.id), updateData);
        toast('সফলভাবে ব্র্যাকেট ও ফিকচার তৈরি করা হয়েছে!');
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
            <div class="text-[11px] text-slate-400">টিম এ (DLS Name)</div>
          </div>
          <div>
            <div class="font-bold text-base text-slate-100">${esc(m.b?.team||'নির্ধারিত নয়')}</div>
            <div class="text-[11px] text-slate-400">টিম বি (DLS Name)</div>
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
          <div class="font-bold text-gold">ম্যাচ স্ক্রিনশট প্রুফ (Proof SS):</div>
          <div>স্কোর: <b>${m.sa ?? '-'}</b> : <b>${m.sb ?? '-'}</b></div>
          ${m.proof ? `<div class="mt-2"><img src="${m.proof}" class="max-h-48 rounded-xl mx-auto border border-white/10 object-contain"></div>` : '<div class="text-slate-400 text-[11px]">কোনো স্ক্রিনশট জমা দেওয়া হয়নি।</div>'}
          
          ${isPlayer && m.status!=='done' ? `
            <div class="space-y-2 pt-2 border-t border-white/10">
              <label class="lbl text-[11px]">ম্যাচ শেষের স্ক্রিনশট আপলোড করুন (Choose File):</label>
              <input id="ssFile" type="file" accept="image/*" class="inp text-xs file:mr-2 file:rounded-md file:border-0 file:bg-volt file:px-2.5 file:py-1 file:text-xs file:font-bold">
              <button id="submitProofBtn" class="btn btn-p w-full py-2.5 text-xs font-bold">স্ক্রিনশট জমা দিন</button>
            </div>
          ` : ''}
        </div>

        ${isAdmin ? `
          <div class="rounded-2xl bg-slate-950 p-5 border border-volt/40 space-y-3 text-left text-xs">
            <div class="font-bold text-volt">অ্যাডমিন ম্যাচ রিভিউ ও ইনপুট:</div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="lbl text-[10px]">টিম এ গোল (${esc(m.a?.team||'A')}):</label><input id="adminSa" class="inp text-xs !py-2" type="number" value="${m.sa??0}"></div>
              <div><label class="lbl text-[10px]">টিম বি গোল (${esc(m.b?.team||'B')}):</label><input id="adminSb" class="inp text-xs !py-2" type="number" value="${m.sb??0}"></div>
            </div>
            <div class="space-y-1">
              <label class="lbl text-[11px]">বিজয়ী দল সিলেক্ট করুন:</label>
              <select id="winnerSelect" class="inp text-xs !py-2">
                <option value="">-- উইনার সিলেক্ট করুন --</option>
                <option value="${m.a?.uid}" ${m.winner===m.a?.uid?'selected':''}>${esc(m.a?.team||'টিম এ')}</option>
                <option value="${m.b?.uid}" ${m.winner===m.b?.uid?'selected':''}>${esc(m.b?.team||'টিম বি')}</option>
              </select>
            </div>
            <button id="adminWinBtn" class="btn btn-n w-full py-2.5 text-xs font-bold">রেজাল্ট সেভ, পয়েন্ট ও ব্র্যাকেট আপডেট করুন</button>
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

    if(isPlayer && $('#submitProofBtn')){
      $('#submitProofBtn').onclick=()=>{
        const file = $('#ssFile').files[0];
        if(!file) return toast('স্ক্রিনশট ফাইল বেছে নিন','err');
        const reader = new FileReader();
        reader.onload = ev => {
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height, max = 800;
            if(w>h && w>max){ h *= max/w; w = max; } else if(h>max){ w *= max/h; h = max; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            m.proof = canvas.toDataURL('image/jpeg', 0.6);
            m.status = 'disputed';
            T.rounds['r'+r][i] = m;
            await F.updateDoc(tref(tid), { rounds: T.rounds });
            toast('স্ক্রিনশট সফলভাবে জমা হয়েছে!');
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      };
    }

    if(isAdmin && $('#adminWinBtn')){
      $('#adminWinBtn').onclick=async()=>{
        const winnerUid = $('#winnerSelect').value;
        const sa = +$('#adminSa').value, sb = +$('#adminSb').value;
        if(!winnerUid) return toast('সঠিক উইনার সিলেক্ট করুন','err');
        
        const w = winnerUid === m.a?.uid ? m.a : m.b;
        const l = winnerUid === m.a?.uid ? m.b : m.a;
        const isFinal = +r === Object.keys(T.rounds).length - 1;

        try {
          await F.runTransaction(db, async tx => {
            const tRef = tref(tid), t = (await tx.get(tRef)).data(), mm = t.rounds['r'+r][i];
            if(mm.status === 'done') throw Error('এই ম্যাচের রেজাল্ট আগেই সেভ করা হয়েছে');
            
            let wd, ld;
            if(isFinal){
              wd = await tx.get(F.doc(db, 'users', w.uid));
              if(l) ld = await tx.get(F.doc(db, 'users', l.uid));
            }
            
            mm.sa = sa; mm.sb = sb; mm.winner = winnerUid; mm.status = 'done';
            advance(t.rounds, +r, +i, w);
            
            if(t.standings){
              Object.keys(t.standings).forEach(gKey => {
                t.standings[gKey].forEach(st => {
                  if(st.uid === m.a.uid){
                    st.mp += 1; st.gf += sa; st.ga += sb; st.gd = st.gf - st.ga;
                    if(winnerUid === m.a.uid){ st.w += 1; st.pts += 3; }
                    else if(sa === sb){ st.d += 1; st.pts += 1; }
                    else { st.l += 1; }
                  }
                  if(m.b && st.uid === m.b.uid){
                    st.mp += 1; st.gf += sb; st.ga += sa; st.gd = st.gf - st.ga;
                    if(winnerUid === m.b.uid){ st.w += 1; st.pts += 3; }
                    else if(sa === sb){ st.d += 1; st.pts += 1; }
                    else { st.l += 1; }
                  }
                });
                t.standings[gKey].sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
              });
            }

            const upd = { rounds: t.rounds, standings: t.standings || null };
            if(isFinal){
              upd.status = 'done'; upd.champion = { uid: w.uid, team: w.team };
              tx.set(wd.ref, { winBalance: (wd.data()?.winBalance || 0) + (t.winnerPrize || 0) }, { merge: true });
              if(ld) tx.set(ld.ref, { winBalance: (ld.data()?.winBalance || 0) + (t.runnerUpPrize || 0) }, { merge: true });
            }
            tx.update(tRef, upd);
          });
          toast('রেজাল্ট ও পয়েন্ট টেবিল সফলভাবে আপডেট হয়েছে!');
        } catch(e){ toast(e.message, 'err'); }
      };
    }
  });
}

actions.join=async()=>{
  if(!needAuth())return;
  if(!complete(profile)){toast('প্রথমে প্রোফাইল সম্পূর্ণ করুন (DLS টিম নাম, ফোন এবং ছবি বাধ্যতামূলক)','err');location.hash='#/me';return;}
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

function historyView(){
  if(!needAuth())return;
  const list = S.list.filter(t => (t.uids || []).includes(user.uid));
  setView(`<div class="space-y-6 py-4 max-w-3xl mx-auto pb-24 px-3 md:px-0">
    <div class="space-y-1">
      <h1 class="text-lg font-black text-slate-100 flex items-center gap-2"><i data-lucide="scroll" class="h-5 w-5 text-volt"></i>আমার টুর্নামেন্ট হিস্টরি</h1>
    </div>
    <div class="space-y-3">
      ${list.map(t=>`
        <div class="glass rounded-3xl p-5 space-y-3 border border-white/10 hover:border-volt/30 transition">
          <div class="flex justify-between items-center text-sm font-bold text-slate-100">
            <span>${esc(t.name)}</span>
            <span class="badge ${t.status==='done'?'bg-emerald-500/10 text-emerald-400':'bg-volt/10 text-volt'} text-xs font-semibold">${t.status==='done'?'সম্পন্ন':'চলমান'}</span>
          </div>
          <a href="#/t/${t.id}" class="btn btn-n w-full !py-2 text-xs font-bold block text-center">ফিকচার ও রেজাল্ট দেখুন</a>
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
        <button data-act="auth" class="btn btn-p w-full py-3 text-xs font-bold">লগইন / প্রবেশ করুন</button>
      </div>
    </div>`);
    icons();
    return;
  }
  const p=profile||{};
  setView(`<div class="space-y-4 py-4 max-w-xl mx-auto pb-24 px-3 md:px-0">
    <form id="pf" class="glass rounded-3xl p-6 space-y-4 border border-white/10">
      <h1 class="text-lg font-black text-slate-100">প্রোফাইল তথ্য (ইন-গেম DLS নাম)</h1>
      <div><label class="lbl text-xs">আপনার DLS ইন-গেম টিম নাম *</label><input class="inp text-sm" name="team" required placeholder="যেমন: FC Shaor / Real Madrid" value="${esc(p.team||'')}"></div>
      <div><label class="lbl text-xs">মোবাইল নম্বর *</label><input class="inp text-sm" name="phone" required type="tel" value="${esc(p.phone||'')}"></div>
      <div>
        <label class="lbl text-xs">প্রোফাইল পিকচার (Choose File) *</label>
        <input class="inp text-xs file:mr-2 file:rounded-md file:border-0 file:bg-volt file:px-2.5 file:py-1 file:text-xs file:font-bold" id="imgFile" type="file" accept="image/*">
        <input type="hidden" name="avatar" id="avatarVal" value="${esc(p.avatar||'')}">
      </div>
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
        const c=document.createElement('canvas');let w=img.width,h=img.height,max=200;
        if(w>h&&w>max){h*=max/w;w=max;}else if(h>max){w*=max/h;h=max;}
        c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
        $('#avatarVal').value=c.toDataURL('image/jpeg',0.7);
        toast('ছবি সিলেক্ট হয়েছে!');
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  $('#pf').onsubmit=async e=>{
    e.preventDefault();
    const d=Object.fromEntries(new FormData(e.target));
    d.avatar=$('#avatarVal').value;
    if(!d.team || !d.phone || !d.avatar) return toast('সব তথ্য দেওয়া বাধ্যতামূলক!','err');
    try{
      await F.setDoc(F.doc(db,'users',user.uid),d,{merge:true});
      profile.team = d.team; profile.phone = d.phone; profile.avatar = d.avatar;
      header(); toast('DLS প্রোফাইল তথ্য সংরক্ষিত হয়েছে!'); location.hash='#/';
    }catch(err){toast(err.message,'err')}
  };
}

actions.logout=async()=>{await F.signOut(auth);location.hash='#/'};

function adminView(){
  if(!user || user.email !== ADMIN_EMAIL){
    setView(`<div class="p-12 text-center text-red-400 font-bold text-xs">৪৬৪ - অননুমোদিত প্রবেশ!</div>`);
    return;
  }

  setView(`<div class="space-y-6 py-4 max-w-3xl mx-auto pb-24 px-3 md:px-0">
    <h1 class="text-lg font-black text-slate-100">অ্যাডমিন কন্ট্রোল প্যানেল (/admin)</h1>
    
    <div class="glass rounded-3xl p-6 space-y-4 border border-volt/40">
      <h2 class="font-bold text-volt text-sm">নতুন টুর্নামেন্ট তৈরি করুন</h2>
      <form id="mkTourney" class="space-y-3">
        <div><label class="lbl text-xs">টুর্নামেন্টের নাম</label><input class="inp text-sm" name="name" required placeholder="ডিএলএস প্রিমিয়ার কাপ"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="lbl text-xs">এন্ট্রি ফি (৳)</label><input class="inp text-sm" name="fee" type="number" value="50" required></div>
          <div>
            <label class="lbl text-xs">সর্বোচ্চ স্লট (টিম)</label>
            <select class="inp text-sm" name="max">
              <option value="4">৪ স্লট (Semis + Final)</option>
              <option value="8">৮ স্লট (Quarters + Semis + Final)</option>
              <option value="16">১৬ স্লট (Round of 16)</option>
              <option value="32">৩২ স্লট (Round of 32)</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="lbl text-xs">ফরম্যাট / টাইপ</label>
            <select class="inp text-sm" name="type">
              <option value="Knockout">সরাসরি নকআউট (Pure Knockout)</option>
              <option value="Group Stage">গ্রুপ স্টেজ (Group Standings)</option>
              <option value="Hybrid">হাইব্রিড (Group + Knockout)</option>
            </select>
          </div>
          <div><label class="lbl text-xs">শুরুর সময়</label><input class="inp text-sm" name="start" type="datetime-local" required></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="lbl text-xs">উইনার প্রাইজ (৳)</label><input class="inp text-sm" name="winnerPrize" type="number" value="140" required></div>
          <div><label class="lbl text-xs">রানার্স-আপ প্রাইজ (৳)</label><input class="inp text-sm" name="runnerUpPrize" type="number" value="40" required></div>
        </div>
        <button class="btn btn-p w-full py-3 text-xs font-bold">টুর্নামেন্ট পাবলিশ করুন</button>
      </form>
    </div>

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
      await F.setDoc(F.doc(db,'withdraws',withDec.dataset.declineWith),{status:'rejected'},{merge:true});
      toast('উইথড্র অনুরোধ বাতিল করা হয়েছে।');adminView();
    }catch(err){toast(err.message,'err')}
  }
});
