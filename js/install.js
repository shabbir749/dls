// Fixed "Install app" button (standalone, no imports). Stays visible until the app is installed.
// After you build the Android APK, paste its direct link here (GitHub Releases link works):
const APK_URL='https://github.com/shabbir749/dls/releases/download/app/DLS.Tournament.Hub.apk';   // e.g. 'https://github.com/shabbir749/dls/releases/download/v1/dls-hub.apk'

const T={
  bn:{install:'অ্যাপ ইনস্টল',apk:'APK ডাউনলোড',ios:'iPhone-এ ইনস্টল করতে Safari-তে নিচের Share বাটন চাপুন, তারপর "Add to Home Screen" চাপুন।',other:'ইনস্টল করতে ব্রাউজারের মেনু (⋮) থেকে "Install app" বা "Add to Home screen" চাপুন।'},
  en:{install:'Install app',apk:'Download APK',ios:'On iPhone: tap the Share button in Safari, then "Add to Home Screen".',other:'To install, open the browser menu (⋮) and tap "Install app" or "Add to Home screen".'}
};
const lang=()=>{try{return localStorage.getItem('lang')==='en'?'en':'bn'}catch(e){return 'bn'}};

const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;
let deferred=null;

const ICON='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';

if(!standalone){
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e});
  addEventListener('appinstalled',()=>{deferred=null;remove()});
  addEventListener('load',()=>{render();setInterval(refresh,1000)});
}

function remove(){document.getElementById('install-fab')?.remove()}

// Re-draw text if the language was switched, and re-attach if the page re-rendered.
let shownLang='';
function refresh(){
  if(standalone)return;
  const el=document.getElementById('install-fab');
  if(!el||shownLang!==lang())render();
}

function render(){
  if(standalone)return;
  remove();
  const s=T[shownLang=lang()],box=document.createElement('div');
  box.id='install-fab';
  box.className='fixed z-30 flex flex-col items-end gap-2';
  box.style.right='12px';
  box.style.bottom='calc(env(safe-area-inset-bottom) + 4.5rem)';
  const apk=APK_URL?`<a href="${APK_URL}" download class="btn btn-g !min-h-[44px] !rounded-full !px-4 !py-2 !text-sm shadow-lg">${s.apk}</a>`:'';
  box.innerHTML=`${apk}<button id="fab-go" class="btn btn-p !min-h-[48px] !rounded-full !px-5 !py-2 !text-sm">${ICON}${s.install}</button>`;
  document.body.append(box);

  box.querySelector('#fab-go').onclick=async()=>{
    if(deferred){deferred.prompt();await deferred.userChoice.catch(()=>{});deferred=null;}
    else if(isIOS)alert(s.ios);
    else alert(s.other);
  };
}
