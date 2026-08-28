const MAX_QUERY_LENGTH = 160;

function nutrientValue(food, nutrientId, namePattern) {
  const nutrients = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
  const nutrient = nutrients.find(item => Number(item.nutrientId) === nutrientId)
    || nutrients.find(item => namePattern.test(String(item.nutrientName || '')));
  const value = Number(nutrient?.value);
  return Number.isFinite(value) ? value : 0;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const query = String(req.body?.query || '').trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < 2) return res.status(400).json({ error: 'Missing USDA search query' });

  const configuredKey = String(process.env.USDA_API_KEY || '').trim();
  const key = configuredKey || 'DEMO_KEY';

  try {
    const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        dataType: ['Foundation', 'Survey (FNDDS)', 'SR Legacy'],
        pageSize: 15,
        pageNumber: 1
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || data?.message || `USDA HTTP ${response.status}` });
    }

    const foods = (Array.isArray(data.foods) ? data.foods : []).map(food => ({
      fdcId: food.fdcId,
      description: food.description || '',
      dataType: food.dataType || '',
      cal: nutrientValue(food, 1008, /^Energy$/i),
      p: nutrientValue(food, 1003, /^Protein$/i),
      c: nutrientValue(food, 1005, /^Carbohydrate/i),
      f: nutrientValue(food, 1004, /^Total lipid/i),
      fiber: nutrientValue(food, 1079, /^Fiber/i)
    })).filter(food => food.description && (food.cal > 0 || food.p > 0 || food.c > 0 || food.f > 0));

    return res.status(200).json({ query, foods, demoKey: !configuredKey });
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'USDA request failed' });
  }
};
