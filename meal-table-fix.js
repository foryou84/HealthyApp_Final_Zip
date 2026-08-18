(() => {
  const MEALS = ['בוקר', 'צהריים', 'ערב', 'ביניים'];
  let lastSignature = '';

  const num = value => {
    if (value === null || value === undefined || value === '') return 0;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const pick = (...values) => {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== '' && Number.isFinite(Number(String(value).replace(',', '.')))) return num(value);
    }
    return 0;
  };

  const fmt = (value, decimals = 1) => {
    const rounded = Math.round(num(value) * Math.pow(10, decimals)) / Math.pow(10, decimals);
    return rounded.toLocaleString('he-IL', { maximumFractionDigits: decimals });
  };

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  // Strengthen MABAT matching for named food varieties. The main database uses
  // plural category forms such as "אגוזי לוז", while Gemini may return
  // "אגוז לוז". Without normalization a generic "אגוז מבושל" can win.
  if (typeof window.betterScoreFood === 'function' && !window.__specificFoodScoreFix) {
    const originalFoodScore = window.betterScoreFood;
    const cleanFoodText = value => String(value || '').toLowerCase()
      .replace(/["׳״'`.,:;!?()\[\]{}\/\\_-]/g, ' ').replace(/\s+/g, ' ').trim();
    const foodToken = word => ({ אגוזי: 'אגוז', אגוזים: 'אגוז', שקדים: 'שקד', בוטנים: 'בוטן' }[word] || word);
    window.betterScoreFood = function specificFoodScore(query, food) {
      const baseScore = originalFoodScore(query, food);
      if (baseScore < 0 || !food) return baseScore;
      const cleanQuery = cleanFoodText(query);
      const queryWords = cleanQuery.split(/\s+/).filter(Boolean).map(foodToken);
      const names = [food.name, ...(food.a || [])].map(cleanFoodText);
      const nameWords = names.flatMap(name => name.split(/\s+/).filter(Boolean).map(foodToken));
      const matched = queryWords.filter(word => nameWords.includes(word));
      const normalizedExtra = Math.max(0, matched.length - Math.floor(baseScore / 350)) * 350;
      const varietyBonus = queryWords.slice(1).filter(word => nameWords.includes(word)).length * 500;
      // Prefer the food itself ("ריבה, כל הטעמים") over a compound product
      // that merely contains it ("עוגיות במילוי ריבה").
      const leadingFoodBonus = names.some(name => name === cleanQuery || name.startsWith(cleanQuery + ' ')) ? 1500 : 0;
      return baseScore + normalizedExtra + varietyBonus + leadingFoodBonus;
    };
    window.__specificFoodScoreFix = true;
  }

  // Let the user choose the exact MABAT record for every Gemini result instead
  // of silently accepting the first automatic match.
  if (typeof window.renderAiComparison === 'function' && !window.__mabatChoiceList) {
    // A preparation bonus (for example "מבושל") may only reorder genuine text
    // matches. It must never introduce unrelated cooked foods into the list.
    window.findMatches = function relevantMabatMatches(query, limit = 50) {
      return allFoods().map(food => {
        const lexical = betterScoreFood(query, food);
        return { food, lexical, score: lexical > 0 ? lexical + defaultReadyFoodBonus(query, food) : lexical };
      }).filter(result => result.lexical > 0)
        .sort((a, b) => b.score - a.score).slice(0, limit).map(result => result.food);
    };
    window.findFood = function relevantMabatFood(query) {
      return window.findMatches(query, 1)[0] || null;
    };
    const originalRenderAiComparison = window.renderAiComparison;
    const ensureMabatMatches = item => {
      if (!Array.isArray(item.mabatMatches)) item.mabatMatches = typeof findMatches === 'function' ? findMatches(item.aiName, 50) : [];
      if (!item.mabat && item.mabatMatches.length) item.mabat = item.mabatMatches[0];
      return item.mabatMatches;
    };
    window.selectMabatMatch = (foodIndex, matchIndex) => {
      const item = pendingAiFoods[Number(foodIndex)];
      if (!item) return;
      const selected = ensureMabatMatches(item)[Number(matchIndex)];
      if (!selected) return;
      item.mabat = selected;
      item.choice = 'mabat';
      window.renderAiComparison();
    };
    window.renderAiComparison = function renderComparisonWithMabatChoices() {
      try { pendingAiFoods.forEach(ensureMabatMatches); } catch (_) {}
      originalRenderAiComparison();
      const cards = document.querySelectorAll('#aiEditBox .compare-card');
      cards.forEach((card, foodIndex) => {
        const item = pendingAiFoods[foodIndex];
        if (!item || card.querySelector('.mabat-match-picker')) return;
        const matches = ensureMabatMatches(item);
        const wrapper = document.createElement('div');
        wrapper.className = 'mabat-match-picker';
        const label = document.createElement('label');
        label.textContent = matches.length ? `בחר התאמה מדויקת מתוך MABAT (${matches.length} אפשרויות)` : 'לא נמצאו התאמות ב־MABAT';
        wrapper.appendChild(label);
        if (matches.length) {
          const select = document.createElement('select');
          matches.forEach((food, matchIndex) => {
            const text = `${food.name} | ${fmt(food.cal)} קל׳, חלבון ${fmt(food.p)}, פחמימה ${fmt(food.c)}, שומן ${fmt(food.f)} ל־100`;
            select.add(new Option(text, String(matchIndex), false, food === item.mabat));
          });
          select.addEventListener('change', () => window.selectMabatMatch(foodIndex, select.value));
          wrapper.appendChild(select);
          const badge = card.querySelector('.compare-source');
          if (badge) badge.textContent = 'נמצאו התאמות MABAT לבחירה';
        }
        const sourceLabel = [...card.querySelectorAll('label')].find(node => node.textContent.includes('מקור הערכים'));
        card.insertBefore(wrapper, sourceLabel || card.querySelector('.compare-table'));
      });
    };
    window.__mabatChoiceList = true;
  }

  const normalizeMeal = value => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'ביניים';
    if (raw.includes('בוקר') || raw === 'breakfast') return 'בוקר';
    if (raw.includes('צהר') || raw === 'lunch') return 'צהריים';
    if (raw.includes('ערב') || raw === 'dinner') return 'ערב';
    if (raw.includes('ביניים') || raw.includes('נשנ') || raw.includes('חטיף') || raw === 'snack') return 'ביניים';
    return MEALS.includes(value) ? value : 'ביניים';
  };

  const nutrition = entry => ({
    cal: pick(entry.cal, entry.kcal, entry.calories, entry.energy),
    p: pick(entry.p, entry.protein, entry.proteinG),
    c: pick(entry.c, entry.carbs, entry.carb, entry.carbohydrates),
    f: pick(entry.f, entry.fat, entry.fatG),
    v: pick(entry.v, entry.veg, entry.vegetables, entry.vegetable, entry.vegG)
  });

  const sumEntries = entries => (entries || []).reduce((sum, entry) => {
    const n = nutrition(entry || {});
    sum.cal += n.cal; sum.p += n.p; sum.c += n.c; sum.f += n.f; sum.v += n.v;
    return sum;
  }, { cal: 0, p: 0, c: 0, f: 0, v: 0 });

  const getTarget = state => {
    const t = state.targets || state.target || state.goals || {};
    return {
      cal: pick(t.calories, t.cal, t.kcal, t.energy, state.targetCalories, state.calorieTarget, state.kcalTarget, state.dailyCalories),
      p: pick(t.protein, t.p, t.proteinG, state.targetProtein, state.proteinTarget, state.dailyProtein),
      c: pick(t.carbs, t.c, t.carb, t.carbohydrates, state.targetCarbs, state.carbTarget, state.dailyCarbs),
      f: pick(t.fat, t.f, t.fatG, state.targetFat, state.fatTarget, state.dailyFat),
      v: pick(t.veg, t.v, t.vegetables, t.vegG, state.targetVeg, state.vegTarget, state.dailyVeg, 500)
    };
  };

  function getState() {
    try { if (typeof st !== 'undefined' && st) return st; } catch (_) {}
    return window.st || null;
  }

  function sameEntriesShape(candidate, state) {
    if (!candidate || !Array.isArray(candidate.entries) || !state || !Array.isArray(state.entries)) return false;
    if (candidate.entries.length !== state.entries.length) return false;
    if (!candidate.entries.length) return true;
    const getName = e => String((e && (e.name || e.food || e.title)) || '');
    return getName(candidate.entries[0]) === getName(state.entries[0]) &&
      getName(candidate.entries[candidate.entries.length - 1]) === getName(state.entries[state.entries.length - 1]);
  }

  function persistToStorage(storage, state) {
    if (!storage) return false;
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        const raw = storage.getItem(key);
        if (!raw) continue;
        let data;
        try { data = JSON.parse(raw); } catch (_) { continue; }
        if (sameEntriesShape(data, state)) {
          storage.setItem(key, JSON.stringify(state));
          return true;
        }
        for (const wrapper of ['state', 'st', 'data', 'appState']) {
          if (data && sameEntriesShape(data[wrapper], state)) {
            data[wrapper] = state;
            storage.setItem(key, JSON.stringify(data));
            return true;
          }
        }
      }
    } catch (_) {}
    return false;
  }

  function persistState(state, previousEntries) {
    let saved = false;
    const snapshot = Array.isArray(previousEntries) ? previousEntries : null;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        let data;
        try { data = JSON.parse(raw); } catch (_) { continue; }
        const candidates = [{root:data, wrapper:null}, ...['state','st','data','appState'].map(wrapper => ({root:data && data[wrapper], wrapper}))];
        for (const candidate of candidates) {
          const obj = candidate.root;
          if (!obj || !Array.isArray(obj.entries)) continue;
          const oldState = { entries: snapshot || state.entries };
          if (!sameEntriesShape(obj, oldState)) continue;
          if (candidate.wrapper) {
            data[candidate.wrapper] = state;
            localStorage.setItem(key, JSON.stringify(data));
          } else {
            localStorage.setItem(key, JSON.stringify(state));
          }
          saved = true;
          break;
        }
        if (saved) break;
      }
    } catch (_) {}

    if (!saved) saved = persistToStorage(window.sessionStorage, state);

    for (const fnName of ['saveState', 'persistState', 'saveData', 'saveAppState', 'commitState']) {
      const fn = window[fnName];
      if (typeof fn === 'function') {
        try { fn(); saved = true; break; } catch (_) {}
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('healthyapp:statechange', { detail: { source: 'meal-editor' } }));
    } catch (_) {}
    return saved;
  }

  const valueCell = (value, decimals = 1) => `<td>${fmt(value, decimals)}</td>`;

  const detailHtml = items => {
    if (!items.length) return '<div class="meal-summary-empty">אין פריטים בארוחה זו.</div>';
    return items.map(({ entry, index }) => {
      const n = nutrition(entry || {});
      const amount = pick(entry.amount, entry.qty, entry.quantity, entry.grams, entry.weight);
      const amountText = amount ? `${fmt(amount)} ${escapeHtml(entry.unit || 'ג׳')}` : '';
      const name = escapeHtml(entry.name || entry.food || 'פריט');
      return `<div class="meal-summary-item">
        <div class="meal-summary-item-top"><b>${name}</b>${amountText ? `<span>${amountText}</span>` : ''}</div>
        <div class="meal-summary-item-macros">${fmt(n.cal,0)} קל׳ | חלבון ${fmt(n.p)} | פחמימה ${fmt(n.c)} | שומן ${fmt(n.f)}${n.v ? ` | ירקות ${fmt(n.v)} ג׳` : ''}</div>
        <div class="meal-summary-actions">
          <button type="button" class="meal-edit-btn" onclick="event.stopPropagation();editMealEntry(${index})">✏️ ערוך כמות</button>
          <button type="button" class="meal-delete-btn" onclick="event.stopPropagation();deleteMealEntry(${index})">🗑️ מחק</button>
        </div>
      </div>`;
    }).join('');
  };

  window.toggleMealSummaryDetail = id => {
    const row = document.getElementById(id);
    if (row) row.classList.toggle('hide');
  };

  function quantityKey(entry) {
    return ['amount','qty','quantity','grams','weight'].find(key => entry && entry[key] !== undefined && entry[key] !== null && entry[key] !== '') || 'amount';
  }

  function scaleExistingNutrition(entry, ratio) {
    if (!Number.isFinite(ratio)) return;
    const keys = ['cal','kcal','calories','energy','p','protein','proteinG','c','carbs','carb','carbohydrates','f','fat','fatG','v','veg','vegetables','vegetable','vegG'];
    keys.forEach(key => {
      if (entry[key] !== undefined && entry[key] !== null && entry[key] !== '' && Number.isFinite(num(entry[key]))) {
        entry[key] = Math.round(num(entry[key]) * ratio * 100) / 100;
      }
    });
  }

  window.deleteMealEntry = index => {
    const state = getState();
    if (!state || !Array.isArray(state.entries) || !state.entries[index]) return;
    const entry = state.entries[index];
    const name = entry.name || entry.food || 'המאכל';
    if (!window.confirm(`למחוק את "${name}" מהיום?`)) return;
    const previousEntries = state.entries.map(item => ({ ...item }));
    state.entries.splice(index, 1);
    persistState(state, previousEntries);
    lastSignature = '';
    renderMealJournalTable(true);
  };

  window.editMealEntry = index => {
    const state = getState();
    if (!state || !Array.isArray(state.entries) || !state.entries[index]) return;
    const entry = state.entries[index];
    const key = quantityKey(entry);
    const current = pick(entry[key]);
    const name = entry.name || entry.food || 'המאכל';

    if (!current) {
      alert(`ל-${name} אין כמות שמורה שאפשר לשנות אוטומטית. אם לא אכלת אותו, השתמש בכפתור מחק.`);
      return;
    }

    const applyValue = answer => {
      const next = num(answer);
      if (!(next > 0)) {
        if (next === 0 && window.confirm('כמות 0 תמחק את המאכל. למחוק?')) window.deleteMealEntry(index);
        else if (next !== 0) alert('יש להזין כמות גדולה מ-0.');
        return;
      }
      const previousEntries = state.entries.map(item => ({ ...item }));
      const ratio = next / current;
      entry[key] = next;
      scaleExistingNutrition(entry, ratio);
      persistState(state, previousEntries);
      lastSignature = '';
      renderMealJournalTable(true);
    };
    if (typeof window.openAppKeyboard === 'function') window.openAppKeyboard(`כמות חדשה עבור ${name}`, String(current), 'number', applyValue);
    else {
      const answer = window.prompt(`כמות חדשה עבור ${name}:`, String(current));
      if (answer !== null) applyValue(answer);
    }
  };

  function renderMealJournalTable(force = false) {
    const box = document.getElementById('mealJournal');
    const state = getState();
    if (!box || !state) return;

    const entries = Array.isArray(state.entries) ? state.entries : [];
    const target = getTarget(state);
    const signature = JSON.stringify([entries, target]);
    if (!force && signature === lastSignature && box.querySelector('.meal-summary-table')) return;
    lastSignature = signature;

    const indexed = entries.map((entry, index) => ({ entry, index }));
    const rows = MEALS.map(meal => {
      const items = indexed.filter(({entry}) => normalizeMeal(entry && (entry.meal ?? entry.mealType ?? entry.mealName ?? entry.category)) === meal);
      return { meal, items, total: sumEntries(items.map(item => item.entry)) };
    });

    const total = sumEntries(entries);
    const remaining = {
      cal: Math.max(0, target.cal - total.cal),
      p: Math.max(0, target.p - total.p),
      c: Math.max(0, target.c - total.c),
      f: Math.max(0, target.f - total.f),
      v: Math.max(0, target.v - total.v)
    };

    const summaryRow = (label, values, className) => `<tr class="${className}"><th scope="row">${label}</th>${valueCell(values.cal,0)}${valueCell(values.p)}${valueCell(values.c)}${valueCell(values.f)}${valueCell(values.v)}</tr>`;

    const mealRows = rows.map((row, index) => {
      const id = `mealSummaryDetail${index}`;
      return `<tr class="meal-summary-meal-row" onclick="toggleMealSummaryDetail('${id}')"><th scope="row">${row.meal}<span>⌄</span></th>${valueCell(row.total.cal,0)}${valueCell(row.total.p)}${valueCell(row.total.c)}${valueCell(row.total.f)}${valueCell(row.total.v)}</tr><tr id="${id}" class="meal-summary-detail hide"><td colspan="6">${detailHtml(row.items)}</td></tr>`;
    }).join('');

    box.innerHTML = `<div class="meal-summary-scroll"><table class="meal-summary-table" dir="rtl"><thead><tr><th>ארוחה</th><th>קלוריות</th><th>חלבון</th><th>פחמימה</th><th>שומן</th><th>ירקות</th></tr></thead><tbody>${mealRows}${summaryRow('סה״כ היום',total,'meal-summary-total')}${summaryRow('יעד יומי',target,'meal-summary-target')}${summaryRow('נשאר',remaining,'meal-summary-remaining')}</tbody></table></div><div class="meal-summary-hint">לחץ על ארוחה לפירוט. ליד כל מאכל אפשר לערוך כמות או למחוק.</div>`;
  }

  window.renderMealJournal = () => renderMealJournalTable(true);

  if (!document.getElementById('meal-summary-table-style-v3')) {
    const style = document.createElement('style');
    style.id = 'meal-summary-table-style-v3';
    style.textContent = `
      #mealJournal{direction:rtl}
      .meal-summary-scroll{margin-top:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e5e7eb;border-radius:18px;background:#fff}
      .meal-summary-table{width:100%;min-width:520px;border-collapse:collapse;direction:rtl;table-layout:fixed;background:#fff;font-size:12px}
      .meal-summary-table th,.meal-summary-table td{padding:10px 5px;text-align:center;white-space:nowrap;border-bottom:1px solid #e5e7eb}
      .meal-summary-table thead th{background:#f8fafc;font-weight:900;color:#374151}
      .meal-summary-table th:first-child{width:20%;text-align:right;font-weight:900;position:sticky;right:0;z-index:2;background:#fff}
      .meal-summary-table thead th:first-child{background:#f8fafc;z-index:3}
      .meal-summary-meal-row{cursor:pointer}
      .meal-summary-meal-row th{display:flex;align-items:center;justify-content:space-between;gap:4px}
      .meal-summary-detail td{padding:0!important;text-align:right!important;background:#fbfdff}
      .meal-summary-item{padding:10px 12px;border-bottom:1px solid #eef2f7;white-space:normal}
      .meal-summary-item-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .meal-summary-item-top b{white-space:normal;line-height:1.35}
      .meal-summary-item span,.meal-summary-item-macros,.meal-summary-empty{font-size:11px;color:#6b7280}
      .meal-summary-item-macros{margin-top:4px;white-space:normal;line-height:1.45}.meal-summary-empty{padding:12px;text-align:center}
      .meal-summary-actions{display:flex;gap:8px;margin-top:8px}
      .meal-summary-actions button{border:0;border-radius:10px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer}
      .meal-edit-btn{background:#eaf3ff;color:#1264c5}.meal-delete-btn{background:#fff0f0;color:#b42318}
      .meal-summary-total th,.meal-summary-total td{font-weight:900;background:#eef6ff}.meal-summary-total th:first-child{background:#eef6ff}
      .meal-summary-target th,.meal-summary-target td{font-weight:900;background:#f5f3ff}.meal-summary-target th:first-child{background:#f5f3ff}
      .meal-summary-remaining th,.meal-summary-remaining td{font-weight:900;background:#ecfdf5;border-bottom:0}.meal-summary-remaining th:first-child{background:#ecfdf5}
      .meal-summary-hint{font-size:11px;color:#6b7280;text-align:center;margin-top:7px}
      @media(max-width:520px){.meal-summary-table{min-width:500px;font-size:11px}.meal-summary-table th,.meal-summary-table td{padding:9px 4px}}
    `;
    document.head.appendChild(style);
  }

  const refresh = force => { try { renderMealJournalTable(!!force); } catch (e) { console.error('meal summary render failed', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(() => refresh(true), 50));
  else setTimeout(() => refresh(true), 50);

  document.addEventListener('click', () => setTimeout(() => refresh(false), 250), true);
  document.addEventListener('change', () => setTimeout(() => refresh(false), 150), true);
  window.addEventListener('focus', () => refresh(false));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false); });
  setInterval(() => refresh(false), 900);
})();
