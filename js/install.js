// Install-app banner (standalone: no imports needed). Shows until the app is installed or dismissed.
// After you build the Android APK, paste its direct link here (GitHub Releases link works):
const APK_URL='https://github.com/shabbir749/dls/releases/download/app/DLS.Tournament.Hub.apk';   // e.g. 'https://github.com/shabbir749/dls/releases/download/v1/dls-hub.apk'

const T={
  bn:{title:'DLS Hub অ্যাপ ইনস্টল করুন',sub:'হোম স্ক্রিন থেকে এক ট্যাপে খুলুন',install:'ইনস্টল',apk:'APK ডাউনলোড',ios:'iPhone-এ ইনস্টল করতে Safari-তে নিচের Share বাটন চাপুন, তারপর "Add to Home Screen" চাপুন।'},
  en:{title:'Install the DLS Hub app',sub:'Open it from your home screen in one tap',install:'Install',apk:'Download APK',ios:'On iPhone: tap the Share button in Safari, then "Add to Home Screen".'}
};
const lang=()=>{try{return localStorage.getItem('lang')==='en'?'en':'bn'}catch(e){return 'bn'}};
const t=()=>T[lang()];

const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;
const hidden=()=>{try{return Date.now()<+localStorage.getItem('installHideUntil')}catch(e){return false}};
let deferred=null;

if(!standalone){
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;render()});
  addEventListener('appinstalled',()=>{deferred=null;remove()});
  addEventListener('load',()=>setTimeout(render,1500));
}

function remove(){document.getElementById('install-bar')?.remove()}

function render(){
  if(standalone||hidden())return remove();
  if(!deferred&&!isIOS&&!APK_URL)return;          // nothing useful to offer
  remove();
  const s=t(),bar=document.createElement('div');
  bar.id='install-bar';
  bar.className='fixed inset-x-0 z-30 mx-auto max-w-3xl px-3';
  bar.style.bottom='calc(env(safe-area-inset-bottom) + 4.25rem)';
  const apk=APK_URL?`<a href="${APK_URL}" download class="btn btn-g !min-h-[40px] !px-3 !py-1.5 !text-sm">${s.apk}</a>`:'';
  const inst=(deferred||isIOS)?`<button id="ib-go" class="btn btn-p !min-h-[40px] !px-3 !py-1.5 !text-sm">${s.install}</button>`:'';
  bar.innerHTML=`<div class="glass flex items-center gap-3 rounded-2xl p-3">
    <img src="launchericon-192x192.png" alt="" class="h-11 w-11 rounded-xl">
    <div class="min-w-0 flex-1"><div class="truncate text-sm font-bold">${s.title}</div><div class="truncate text-xs text-slate-400">${s.sub}</div></div>
    <div class="flex flex-col gap-1.5">${inst}${apk}</div>
    <button id="ib-x" aria-label="close" class="self-start px-1 text-xl leading-none text-slate-400">×</button></div>`;
  document.body.append(bar);

  bar.querySelector('#ib-x').onclick=()=>{
    try{localStorage.setItem('installHideUntil',String(Date.now()+3*864e5))}catch(e){}
    remove();
  };
  const go=bar.querySelector('#ib-go');
  if(go)go.onclick=async()=>{
    if(deferred){deferred.prompt();await deferred.userChoice.catch(()=>{});deferred=null;remove()}
    else if(isIOS)alert(s.ios);
  };
}
