const webpush=require('web-push');
const {firebaseAdmin}=require('../lib/firebase-admin');

const SCHEDULE=[9,13,14,18,20];
const TIMEZONE='Asia/Jerusalem';
const START_HOUR=7;
const END_HOUR=22;
const RATIO=0.7;

function localNow(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return {hour:Number(value.hour),date:`${value.year}-${value.month}-${value.day}`};
}

function waterTotal(state){
  const drinks=Number(state?.water)||0;
  const foodWater=(state?.entries||[]).reduce((sum,entry)=>sum+(Number(entry?.w)||0),0);
  return Math.round((drinks+foodWater)*10)/10;
}

function thresholdFor(target,hour){
  const expected=target*Math.max(0,Math.min(1,(hour-START_HOUR)/(END_HOUR-START_HOUR)));
  return Math.round(expected*RATIO);
}

async function waterReminderHandler(req,res){
  const secret=process.env.WATER_CRON_SECRET;
  if(!secret||req.headers.authorization!==`Bearer ${secret}`)return res.status(401).json({error:'Unauthorized'});
  try{
    const publicKey=process.env.WEB_PUSH_PUBLIC_KEY;
    const privateKey=process.env.WEB_PUSH_PRIVATE_KEY;
    if(!publicKey||!privateKey)throw new Error('Web Push keys are not configured');
    webpush.setVapidDetails(process.env.WEB_PUSH_SUBJECT||'mailto:water-reminders@healthy-app.local',publicKey,privateKey);

    const now=localNow();
    if(!SCHEDULE.includes(now.hour))return res.status(200).json({ok:true,skipped:'not a scheduled hour',local:now});

    const admin=firebaseAdmin();
    const snapshot=await admin.firestore().collection('users').where('waterReminder.enabled','==',true).get();
    let sent=0,skipped=0,disabled=0;
    await Promise.all(snapshot.docs.map(async document=>{
      const record=document.data();
      const reminder=record.waterReminder||{};
      const checkpoint=`${now.date}-${now.hour}`;
      if(reminder.lastSentCheckpoint===checkpoint){skipped++;return}
      const state=record.data||{};
      const target=Number(state.targets?.water)||2400;
      const actual=waterTotal(state);
      const threshold=thresholdFor(target,now.hour);
      if(actual>=threshold){skipped++;return}
      const missing=Math.max(0,Math.ceil(threshold-actual));
      const payload=JSON.stringify({
        title:'💧 הגיע הזמן לשתות מים',
        body:`שתית ${Math.round(actual)} מ״ל. כדי להגיע ל־70% מהקצב הרצוי עד עכשיו, כדאי להשלים כ־${missing} מ״ל.`,
        tag:`water-${checkpoint}`,
        url:'/#water'
      });
      try{
        await webpush.sendNotification(reminder.subscription,payload);
        await document.ref.set({waterReminder:{...reminder,lastSentCheckpoint:checkpoint,lastSentAt:new Date().toISOString()}},{merge:true});
        sent++;
      }catch(error){
        if(error.statusCode===404||error.statusCode===410){
          await document.ref.set({waterReminder:{...reminder,enabled:false,disabledAt:new Date().toISOString()}},{merge:true});
          disabled++;
          return;
        }
        throw error;
      }
    }));
    return res.status(200).json({ok:true,local:now,users:snapshot.size,sent,skipped,disabled});
  }catch(error){
    console.error('water-reminders',error);
    return res.status(500).json({error:'Water reminder job failed'});
  }
}

module.exports=waterReminderHandler;
module.exports._test={localNow,waterTotal,thresholdFor,SCHEDULE,START_HOUR,END_HOUR,RATIO};
