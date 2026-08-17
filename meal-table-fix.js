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

  const valueCell = (value, decimals = 1) => `<td>${fmt(value, decimals)}</td>`;

  const detailHtml = items => {
    if (!items.length) return '<div class="meal-summary-empty">אין פריטים בארוחה זו.</div>';
    return items.map(entry => {
      const n = nutrition(entry || {});
      const amount = pick(entry.amount, entry.qty, entry.quantity);
      const amountText = amount ? `${fmt(amount)} ${entry.unit || 'ג׳'}` : '';
      return `<div class="meal-summary-item"><div><b>${entry.name || entry.food || 'פריט'}</b>${amountText ? `<span>${amountText}</span>` : ''}</div><div class="meal-summary-item-macros">${fmt(n.cal,0)} קל׳ | חלבון ${fmt(n.p)} | פחמימה ${fmt(n.c)} | שומן ${fmt(n.f)}${n.v ? ` | ירקות ${fmt(n.v)} ג׳` : ''}</div></div>`;
    }).join('');
  };

  window.toggleMealSummaryDetail = id => {
    const row = document.getElementById(id);
    if (row) row.classList.toggle('hide');
  };

  function getState() {
    try { if (typeof st !== 'undefined' && st) return st; } catch (_) {}
    return window.st || null;
  }

  function renderMealJournalTable(force = false) {
    const box = document.getElementById('mealJournal');
    const state = getState();
    if (!box || !state) return;

    const entries = Array.isArray(state.entries) ? state.entries : [];
    const target = getTarget(state);
    const signature = JSON.stringify([entries, target]);
    if (!force && signature === lastSignature && box.querySelector('.meal-summary-table')) return;
    lastSignature = signature;

    const rows = MEALS.map(meal => {
      const items = entries.filter(entry => normalizeMeal(entry && (entry.meal ?? entry.mealType ?? entry.mealName ?? entry.category)) === meal);
      return { meal, items, total: sumEntries(items) };
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

    box.innerHTML = `<div class="meal-summary-scroll"><table class="meal-summary-table" dir="rtl"><thead><tr><th>ארוחה</th><th>קלוריות</th><th>חלבון</th><th>פחמימה</th><th>שומן</th><th>ירקות</th></tr></thead><tbody>${mealRows}${summaryRow('סה״כ היום',total,'meal-summary-total')}${summaryRow('יעד יומי',target,'meal-summary-target')}${summaryRow('נשאר',remaining,'meal-summary-remaining')}</tbody></table></div><div class="meal-summary-hint">לחץ על ארוחה כדי לראות את הפירוט.</div>`;
  }

  window.renderMealJournal = () => renderMealJournalTable(true);

  if (!document.getElementById('meal-summary-table-style-v2')) {
    const style = document.createElement('style');
    style.id = 'meal-summary-table-style-v2';
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
      .meal-summary-item{padding:9px 12px;border-bottom:1px solid #eef2f7}
      .meal-summary-item>div:first-child{display:flex;justify-content:space-between;gap:10px}
      .meal-summary-item span,.meal-summary-item-macros,.meal-summary-empty{font-size:11px;color:#6b7280}
      .meal-summary-item-macros{margin-top:3px}.meal-summary-empty{padding:12px;text-align:center}
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