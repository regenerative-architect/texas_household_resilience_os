'use strict';
const VERSION='tx-household-resilience-v2.0.0';
const CORE=[
 './','./index.html','./offline.html','./manifest.webmanifest',
 './assets/upgrade.css','./assets/collab.js','./assets/data-sources.js','./assets/webllm.js','./assets/upgrade.js','./assets/pwa-register.js',
 './data/texas-context.json','./data/resources.json','./data/cross-domain-schema.json',
 './icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(CORE)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;const u=new URL(req.url);
 // External live APIs, source pages, WebLLM package/model files stay network-managed.
 if(u.origin!==self.location.origin)return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(VERSION).then(cache=>cache.put('./index.html',c));return r}).catch(()=>caches.match('./index.html').then(r=>r||caches.match('./offline.html'))));return;
 }
 event.respondWith(caches.match(req).then(cached=>{
  const net=fetch(req).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(VERSION).then(cache=>cache.put(req,c))}return r}).catch(()=>null);
  return cached||net.then(r=>r||caches.match('./offline.html'));
 }));
});
