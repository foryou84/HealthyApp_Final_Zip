module.exports=(req,res)=>{
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const publicKey=process.env.WEB_PUSH_PUBLIC_KEY;
  if(!publicKey)return res.status(503).json({error:'שירות ההתראות עדיין לא הוגדר בשרת.'});
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({publicKey,scheduleHours:[9,13,14,18,20],ratio:0.7,startHour:7,endHour:22});
};
