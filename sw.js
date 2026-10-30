const CACHE='fr-v30';const ASSETS=['./','index.html','styles.css','app.js','scoring.js','reminders.js','profile.js','insights.js','early.js','cheat.js','weekly.js','report.js','push.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const q=e.request;if(q.method!=='GET'||/\/cal\/[^/]+\.ics$/.test(new URL(q.url).pathname))return;
const nav=q.mode==='navigate'||/\/(index\.html)?$/.test(new URL(q.url).pathname);
if(nav){e.respondWith(fetch(q,{cache:'no-store'}).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put('index.html',c))}return res}).catch(()=>caches.match(q).then(r=>r||caches.match('index.html'))));return}
e.respondWith(caches.match(q).then(r=>r||fetch(q).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(q,c));return res}).catch(()=>caches.match('index.html'))))});
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={body:e.data&&e.data.text()}}
e.waitUntil(self.registration.showNotification(d.title||'FightReady',{body:d.body||'Time to log.',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:d.tag||'fr',data:{tab:d.tab||'log'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const tab=(e.notification.data&&e.notification.data.tab)||'log',url=new URL('./?tab='+tab,self.registration.scope).href;
e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if(c.url.startsWith(self.registration.scope)&&'focus'in c){c.postMessage({tab});return c.focus()}}return clients.openWindow(url)}))});
