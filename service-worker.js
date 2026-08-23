const CACHE_NAME='healthy-app-v10-ios-web-push';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./meal-table-fix.js','./water-reminders.js'];

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
  const headTags=[];
  if(!html.includes('apple-mobile-web-app-capable'))headTags.push('<meta name="apple-mobile-web-app-capable" content="yes">');
  if(!html.includes('mobile-web-app-capable'))headTags.push('<meta name="mobile-web-app-capable" content="yes">');
  if(!html.includes('apple-mobile-web-app-status-bar-style'))headTags.push('<meta name="apple-mobile-web-app-status-bar-style" content="default">');
  if(!html.includes('rel="manifest"')&&!html.includes("rel='manifest'"))headTags.push('<link rel="manifest" href="./manifest.webmanifest?v=20260823-2">');
  if(headTags.length){
    const tags=headTags.join('');
    html=html.includes('</head>')?html.replace('</head>',tags+'</head>'):tags+html;
  }

  const scripts=[];
  if(!html.includes('meal-table-fix.js'))scripts.push('<script src="./meal-table-fix.js?v=20260818-6"></script>');
  if(!html.includes('water-reminders.js'))scripts.push('<script src="./water-reminders.js?v=20260822-1"></script>');
  if(scripts.length){
    const tags=scripts.join('');
    html=html.includes('</body>')?html.replace('</body>',tags+'</body>'):html+tags;
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
  if(url.pathname.endsWith('/meal-table-fix.js')||url.pathname.endsWith('/water-reminders.js')||url.pathname.endsWith('/manifest.webmanifest')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch(error){data={body:event.data?.text()||''}}
  event.waitUntil(self.registration.showNotification(data.title||'💧 תזכורת שתייה',{
    body:data.body||'כדאי להשלים מים כדי להתקדם לעבר היעד היומי.',
    icon:'./icon.svg',
    badge:'./icon.svg',
    tag:data.tag||'water-reminder',
    renotify:false,
    data:{url:data.url||'./index.html#water'}
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./index.html#water',self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    for(const client of clients){
      if(new URL(client.url).origin===self.location.origin){client.navigate(target);return client.focus()}
    }
    return self.clients.openWindow(target);
  }));
});
