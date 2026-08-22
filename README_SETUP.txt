HealthyApp MASTER v2.1 - Vercel setup

What is new:
- Gemini + ChatGPT/OpenAI through a secure Vercel backend
- No OpenAI/Gemini secret keys inside index.html
- AI provider selector: Auto / Gemini / ChatGPT
- Food photo analysis uses the selected AI provider
- Text/coach/manual AI also uses the secure backend
- Firebase "Forgot password" button added

Vercel Environment Variables:
1. GEMINI_API_KEY = your Google Gemini API key
2. OPENAI_API_KEY = your OpenAI API key

Important:
- Do NOT paste the OpenAI key into index.html or commit it to GitHub.
- The AI features will not work when index.html is opened as file:// on your PC.
  They work after deploying this project to Vercel, because /api/ai is a server function.
- MABAT remains embedded locally in the HTML and does not require AI.

Deploy:
- Upload this whole folder to GitHub, or import it into Vercel.
- In Vercel > Project Settings > Environment Variables, add the two variables above.
- Redeploy.
- Open Profile > AI connection and press "Test Gemini" and "Test ChatGPT".
התראות שתייה מותאמות (iPhone / Web Push)
------------------------------------------
האפליקציה בודקת בשעות 09:00, 13:00, 14:00, 18:00 ו-20:00 לפי שעון ישראל.
ההתראה נשלחת רק אם הצריכה נמוכה מ-70% מהיעד היחסי בין 07:00 ל-22:00.

יש להגדיר ב-Vercel, עבור Production, את המשתנים הבאים:
1. FIREBASE_SERVICE_ACCOUNT_JSON - קובץ Service Account של Firebase כמחרוזת JSON מלאה.
2. WEB_PUSH_PUBLIC_KEY - מפתח VAPID ציבורי.
3. WEB_PUSH_PRIVATE_KEY - מפתח VAPID פרטי.
4. WATER_CRON_SECRET - מחרוזת סודית ארוכה.
5. WEB_PUSH_SUBJECT - אופציונלי, למשל mailto:your@email.com.

ב-GitHub repository יש להגדיר Secret בשם WATER_CRON_SECRET עם אותו ערך בדיוק.
ה-workflow שב-.github/workflows/water-reminders.yml פונה לשרת פעם בשעה;
השרת עצמו שולח רק בחמש השעות המוגדרות ומונע שליחה כפולה באותה שעה.

באייפון: לפתוח את האתר מהסמל במסך הבית, להתחבר ל-Firebase, ללחוץ על
"הפעל התרעות שתייה" ולאשר Notifications.
