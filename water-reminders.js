(function(){
  const ENABLED_KEY='healthy_water_push_enabled_v1';
  const schedule='09:00, 13:00, 14:00, 18:00 ו־20:00';

  function ensureUi(){
    if(document.getElementById('waterReminderBtn'))return true;
    const waterText=document.getElementById('waterText');
    const card=waterText?.closest('.card');
    if(!card)return false;
    const wrapper=document.createElement('div');
    wrapper.className='water-reminder-actions';
    wrapper.innerHTML='<button id="waterReminderBtn" type="button">🔔 הפעל התרעות שתייה</button><div id="waterReminderStatus" class="notice water-reminder-status">התראות מותאמות לשעות 09:00, 13:00, 14:00, 18:00 ו־20:00. תישלח התראה רק אם שתית פחות מ־70% מהיעד היחסי לאותה שעה.</div>';
    wrapper.querySelector('button').addEventListener('click',()=>window.toggleWaterReminders());
    card.appendChild(wrapper);
    if(!document.getElementById('water-reminder-style')){
      const style=document.createElement('style');
      style.id='water-reminder-style';
      style.textContent='.water-reminder-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px}.water-reminder-actions button{margin:0}.water-reminder-status{margin-top:8px}';
      document.head.appendChild(style);
    }
    return true;
  }

  function status(message,kind){
    const el=document.getElementById('waterReminderStatus');
    if(!el)return;
    el.textContent=message;
    el.className='notice water-reminder-status '+(kind||'');
  }

  function button(message,disabled){
    const el=document.getElementById('waterReminderBtn');
    if(!el)return;
    el.textContent=message;
    el.disabled=Boolean(disabled);
  }

  function isStandalone(){
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;
  }

  function base64ToBytes(value){
    const padding='='.repeat((4-value.length%4)%4);
    const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=window.atob(base64);
    return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)));
  }

  async function firebaseToken(){
    const [{getApps},{getAuth}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js')
    ]);
    for(let i=0;i<30;i++){
      const apps=getApps();
      const user=apps.length?getAuth(apps[0]).currentUser:null;
      if(user)return user.getIdToken();
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    throw new Error('יש להתחבר לחשבון Firebase לפני הפעלת ההתראות.');
  }

  async function subscribe(){
    if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){
      throw new Error('המכשיר או הדפדפן אינם תומכים בהתראות אינטרנט.');
    }
    if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!isStandalone()){
      throw new Error('באייפון יש לפתוח את האתר מהסמל שהוסף למסך הבית.');
    }
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('לא ניתנה הרשאה להתראות. אפשר לאשר אותה בהגדרות האייפון.');

    const configResponse=await fetch('/api/push-config',{cache:'no-store'});
    const config=await configResponse.json().catch(()=>({}));
    if(!configResponse.ok||!config.publicKey)throw new Error(config.error||'מפתחות ההתראות עדיין לא הוגדרו בשרת.');

    const registration=await navigator.serviceWorker.ready;
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription){
      subscription=await registration.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:base64ToBytes(config.publicKey)
      });
    }

    const token=await firebaseToken();
    const response=await fetch('/api/push-subscribe',{
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer '+token},
      body:JSON.stringify({subscription})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||'שמירת ההתראות נכשלה.');
    localStorage.setItem(ENABLED_KEY,'1');
  }

  window.refreshWaterReminderStatus=function(){
    if(!ensureUi())return;
    const enabled=localStorage.getItem(ENABLED_KEY)==='1';
    if(enabled&&window.Notification?.permission==='granted'){
      button('✅ התרעות השתייה פעילות',true);
      status(`פעיל בשעות ${schedule}; רק מתחת ל־70% מהיעד היחסי. אפשר לשנות הרשאה בהגדרות ההתראות של האייפון.`,'ok');
    }else{
      button('🔔 הפעל התרעות שתייה',false);
    }
  };

  window.toggleWaterReminders=async function(){
    button('מפעיל התרעות...',true);
    status('מבקש הרשאה ושומר את לוח ההתראות...','');
    try{
      await subscribe();
      window.refreshWaterReminderStatus();
    }catch(error){
      button('🔔 נסה להפעיל שוב',false);
      status(error.message||'לא ניתן להפעיל התרעות.','err');
    }
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',window.refreshWaterReminderStatus);
  else window.refreshWaterReminderStatus();
})();
