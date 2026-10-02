const CACHE='finperso-v13';
const SHELL=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-180.png','./icons/icon-32.png','./icons/icon-96.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE&&n!=='finperso-data').map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);if(!/^https?:$/.test(u.protocol)||/(googleapis\.com|firebaseapp\.com|firebaseio\.com|google\.com)$/.test(u.hostname))return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put('./index.html',c));return res}).catch(()=>caches.match('./index.html')));return}
  e.respondWith(caches.match(r).then(hit=>{const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque')){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c))}return res}).catch(()=>hit);return hit||net}));
});
/* Rappels des charges : vérifiés en arrière-plan (Periodic Sync) et à chaque ouverture */
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const diff=(a,b)=>{const p=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)};return Math.round((p(b)-p(a))/864e5)};
async function checkReminders(){
  if(self.Notification&&Notification.permission!=='granted')return;
  const c=await caches.open('finperso-data');const res=await c.match('./reminders.json');if(!res)return;
  const d=await res.json(),en=d.lang==='en',now=new Date(),td=today();
  if(now.getHours()<(d.hour??8))return;
  const sentRes=await c.match('./notified.json');const sent=sentRes?await sentRes.json():{};
  for(const p of d.plans){
    const left=diff(td,p.due);const late=left<0;const hit=late||(p.rem||[]).some(o=>left<=o);
    if(!hit)continue;const key=p.id+'@'+td;if(sent[key])continue;
    const when=late?(en?`${-left} day(s) overdue`:`En retard de ${-left} jour(s)`):left===0?(en?'Due today':"Échéance aujourd'hui"):left===1?(en?'Due tomorrow':'Échéance demain'):(en?`Due in ${left} days`:`Échéance dans ${left} jours`);
    await self.registration.showNotification(`${p.label} · ${p.amount} ${d.cur}`,{body:when,icon:'icons/icon-192.png',badge:'icons/icon-96.png',tag:'fp-'+p.id,data:{url:'./index.html#plan'}});
    sent[key]=1;
  }
  for(const k of Object.keys(sent))if(!k.endsWith(td))delete sent[k];
  await c.put('./notified.json',new Response(JSON.stringify(sent)));
}
self.addEventListener('periodicsync',e=>{if(e.tag==='finperso-reminders')e.waitUntil(checkReminders())});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='check-reminders')e.waitUntil(checkReminders())});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'./index.html';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if('focus' in c){c.navigate&&c.navigate(url);return c.focus()}}return self.clients.openWindow(url)}))});
