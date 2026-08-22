const admin=require('firebase-admin');

function firebaseAdmin(){
  if(!admin.apps.length){
    const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
    const serviceAccount=JSON.parse(raw);
    if(serviceAccount.private_key)serviceAccount.private_key=serviceAccount.private_key.replace(/\\n/g,'\n');
    admin.initializeApp({credential:admin.credential.cert(serviceAccount)});
  }
  return admin;
}

module.exports={firebaseAdmin};
