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
