// DLS Tournament Hub service worker. Bump VERSION after every deploy to refresh the cache.
const VERSION='v1.5';
const CACHE='dls-hub-'+VERSION;
const SHELL=['./','./index.html','./manifest.json','./launchericon-192x192.png','./launchericon-512x512.png',
  './js/app.js','./js/bracket.js','./js/firebase.js','./js/ui.js','./js/i18n.js'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('dls-hub-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  // Only handle same-origin GET. Firebase / Firestore / Auth / CDN calls go straight to the network.
  if(req.method!=='GET'||url.origin!==location.origin)return;

  // Pages: network first, fall back to the cached app shell when offline.
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp));return r})
      .catch(()=>caches.match('./index.html').then(r=>r||caches.match('./'))));
    return;
  }

  // Static files: serve from cache instantly, refresh in the background.
  e.respondWith(caches.match(req).then(hit=>{
    const net=fetch(req).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r}).catch(()=>hit);
    return hit||net;
  }));
});
