const cacheName='zyz-instructor-shell-2.0.13';
const assets=['/instructor/','/instructor/app.js','/instructor/app.css','/instructor/calculators.js','/instructor/icon.svg','/instructor/icon.png','/instructor/icon-192.png','/instructor/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(cacheName).then(c=>c.addAll(assets)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('zyz-instructor-shell-')&&k!==cacheName).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 // Never intercept or cache pairing, instructor data, or writes.
 if(e.request.method!=='GET'||u.origin!==self.location.origin||u.search||!assets.includes(u.pathname))return;
 e.respondWith(fetch(e.request).catch(async()=>await caches.match(e.request)||Response.error()));
});
