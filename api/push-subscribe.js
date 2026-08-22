const {firebaseAdmin}=require('../lib/firebase-admin');

module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!token)return res.status(401).json({error:'יש להתחבר לחשבון Firebase.'});
    const admin=firebaseAdmin();
    const user=await admin.auth().verifyIdToken(token);
    const subscription=req.body?.subscription;
    if(!subscription?.endpoint||!subscription?.keys?.p256dh||!subscription?.keys?.auth){
      return res.status(400).json({error:'פרטי ההתראה אינם תקינים.'});
    }
    await admin.firestore().doc(`users/${user.uid}`).set({waterReminder:{
      enabled:true,
      subscription,
      timezone:'Asia/Jerusalem',
      scheduleHours:[9,13,14,18,20],
      ratio:0.7,
      startHour:7,
      endHour:22,
      updatedAt:new Date().toISOString()
    }},{merge:true});
    return res.status(200).json({ok:true});
  }catch(error){
    console.error('push-subscribe',error);
    return res.status(500).json({error:'לא ניתן לשמור את ההתראות כעת.'});
  }
};
