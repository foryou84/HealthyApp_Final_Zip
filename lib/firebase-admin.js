function firebaseAdmin(){
  const {cert,getApps,initializeApp}=require('firebase-admin/app');
  const {getAuth}=require('firebase-admin/auth');
  const {getFirestore}=require('firebase-admin/firestore');

  if(!getApps().length){
    const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
    const serviceAccount=JSON.parse(raw);
    if(serviceAccount.private_key)serviceAccount.private_key=serviceAccount.private_key.replace(/\\n/g,'\n');
    initializeApp({credential:cert(serviceAccount)});
  }
  return {
    auth:()=>getAuth(),
    firestore:()=>getFirestore()
  };
}

module.exports={firebaseAdmin};
