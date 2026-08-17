module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { provider = 'auto', prompt = '', imageDataUrl = null } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  async function gemini() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not configured');

    const parts = [{ text: prompt }];
    if (imageDataUrl) {
      const m = String(imageDataUrl).match(/^data:([^;]+);base64,(.+)$/s);
      if (!m) throw new Error('Invalid image data');
      parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
    }

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d?.error?.message || `Gemini HTTP ${r.status}`);
    const text = d?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if (!text) throw new Error('Gemini returned no text');
    return text;
  }

  async function openai() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not configured');

    const content = [{ type: 'input_text', text: prompt }];
    if (imageDataUrl) content.push({ type: 'input_image', image_url: imageDataUrl, detail: 'auto' });

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-5.6',
        input: [{ role: 'user', content }]
      })
    });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d?.error?.message || `OpenAI HTTP ${r.status}`);

    let text = d.output_text || '';
    if (!text && Array.isArray(d.output)) {
      for (const item of d.output) {
        if (!Array.isArray(item.content)) continue;
        for (const c of item.content) {
          if (c.type === 'output_text' && c.text) text += c.text;
        }
      }
    }
    if (!text) throw new Error('OpenAI returned no text');
    return text;
  }

  try {
    let text;
    let used;
    if (provider === 'gemini') {
      text = await gemini(); used = 'gemini';
    } else if (provider === 'openai') {
      text = await openai(); used = 'openai';
    } else {
      try { text = await gemini(); used = 'gemini'; }
      catch (e1) { text = await openai(); used = 'openai'; }
    }
    return res.status(200).json({ text, provider: used });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'AI request failed' });
  }
};