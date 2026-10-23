const CACHE='fr-v20';const ASSETS=['./','index.html','styles.css','app.js','scoring.js','reminders.js','profile.js','insights.js','early.js','weekly.js','push.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||/\/cal\/[^/]+\.ics$/.test(new URL(e.request.url).pathname))return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return res}).catch(()=>caches.match('index.html'))))});
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={body:e.data&&e.data.text()}}
e.waitUntil(self.registration.showNotification(d.title||'FightReady',{body:d.body||'Time to log.',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:d.tag||'fr',data:{tab:d.tab||'log'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const tab=(e.notification.data&&e.notification.data.tab)||'log',url=new URL('./?tab='+tab,self.registration.scope).href;
e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if(c.url.startsWith(self.registration.scope)&&'focus'in c){c.postMessage({tab});return c.focus()}}return clients.openWindow(url)}))});
