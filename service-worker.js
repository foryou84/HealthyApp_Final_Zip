const CACHE_NAME='healthy-app-v24-manual-conversion';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./meal-table-fix.js'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function htmlWithMealTable(request){
  let response;
  try{
    response=await fetch(request,{cache:'no-store'});
  }catch(error){
    response=await caches.match('./index.html') || await caches.match(request);
  }
  if(!response)return Response.error();

  const contentType=response.headers.get('content-type')||'';
  if(!contentType.includes('text/html'))return response;

  let html=await response.text();
  if(!html.includes('meal-table-fix.js')){
    const tag='<script src="./meal-table-fix.js?v=20260819-3"></script>';
    html=html.includes('</body>')?html.replace('</body>',tag+'</body>'):html+tag;
  }

  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control','no-cache');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.mode==='navigate' && url.origin===self.location.origin){
    event.respondWith(htmlWithMealTable(event.request));
    return;
  }
  if(url.pathname.endsWith('/meal-table-fix.js')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
