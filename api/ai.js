module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { provider = 'auto', prompt = '', imageDataUrl = null } = req.body || {};
  if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: 'Missing prompt' });

  // The mobile UI currently renders AI text as plain text rather than Markdown.
  // Ask the models for clean Hebrew plain text so users do not see ** / # markers.
  const nutritionInstructions = imageDataUrl ? '' : `
הנחיות תשובה לאפליקציה:
- ענה בעברית ברורה, קצרה ומעשית.
- השתמש קודם כל בנתוני המשתמש, היעדים, הצריכה והרשומות שסופקו בשאלה. אל תגיד שאין נתונים אם מופיעים נתונים בהקשר.
- כשמבקשים מה לאכול או כמה נשאר, חשב מול היעד והצריכה שסופקו והצג מספרים שימושיים.
- אם אין רשומות מזון היום, ציין זאת בקצרה והצע בהתאם ליעדים שנותרו.
- בתשובת ארוחה, העדף מבנה: הצעה לארוחה, רכיבים וכמויות, ואז סה״כ משוער של קלוריות וחלבון. הוסף פחמימה ושומן כשזה מועיל.
- אל תשתמש ב-Markdown בכלל: בלי **, בלי *, בלי # ובלי טבלאות Markdown. אפשר להשתמש באימוג׳י ובשורות נפרדות.
- אל תמציא מזונות שנאכלו או נתוני עבר שלא סופקו.

`;
  const effectivePrompt = nutritionInstructions + String(prompt);

  async function gemini() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not configured');

    const parts = [{ text: effectivePrompt }];
    if (imageDataUrl) {
      const m = String(imageDataUrl).match(/^data:([^;]+);base64,(.+)$/s);
      if (!m) throw new Error('Invalid image data');
      parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );

    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) {
      const msg = d?.error?.message || `Gemini HTTP ${r.status}`;
      const err = new Error(msg);
      err.status = r.status;
      throw err;
    }

    const text = d?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || '';
    if (!text) throw new Error('Gemini returned no text');
    return text;
  }

  async function openai() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not configured');

    const content = [{ type: 'input_text', text: effectivePrompt }];
    if (imageDataUrl) content.push({ type: 'input_image', image_url: imageDataUrl, detail: 'auto' });

    const model = process.env.OPENAI_MODEL || 'gpt-5.6';
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        input: [{ role: 'user', content }]
      })
    });

    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) {
      const msg = d?.error?.message || `OpenAI HTTP ${r.status}`;
      const err = new Error(msg);
      err.status = r.status;
      throw err;
    }

    let text = d.output_text || '';
    if (!text && Array.isArray(d.output)) {
      for (const item of d.output) {
        if (!Array.isArray(item.content)) continue;
        for (const c of item.content) {
          if (c.type === 'output_text' && c.text) text += c.text;
        }
      }
    }
    text = text.trim();
    if (!text) throw new Error('OpenAI returned no text');
    return text;
  }

  try {
    let text;
    let used;

    if (provider === 'gemini') {
      text = await gemini();
      used = 'gemini';
    } else if (provider === 'openai') {
      text = await openai();
      used = 'openai';
    } else {
      try {
        text = await gemini();
        used = 'gemini';
      } catch (geminiError) {
        try {
          text = await openai();
          used = 'openai';
        } catch (openaiError) {
          throw new Error(`Gemini failed: ${geminiError.message} | OpenAI failed: ${openaiError.message}`);
        }
      }
    }

    return res.status(200).json({ text, provider: used });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'AI request failed' });
  }
};
