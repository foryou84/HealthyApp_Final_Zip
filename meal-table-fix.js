(() => {
  const MEALS = ['בוקר', 'צהריים', 'ערב', 'ביניים'];

  const num = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const fmt = (value, decimals = 1) => {
    const n = num(value);
    const rounded = Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
    return rounded.toLocaleString('he-IL', { maximumFractionDigits: decimals });
  };

  const normalizeMeal = value => {
    const meal = String(value || '').trim();
    return MEALS.includes(meal) ? meal : 'ביניים';
  };

  const sumEntries = entries => (entries || []).reduce((sum, entry) => {
    sum.cal += num(entry.cal);
    sum.p += num(entry.p);
    sum.c += num(entry.c);
    sum.f += num(entry.f);
    sum.v += num(entry.v);
    return sum;
  }, { cal: 0, p: 0, c: 0, f: 0, v: 0 });

  const valueCell = (value, decimals = 1) => {
    const cls = num(value) < 0 ? ' meal-value-negative' : '';
    return `<td class="meal-value${cls}">${fmt(value, decimals)}</td>`;
  };

  const detailHtml = items => {
    if (!items.length) return '<div class="meal-summary-empty">אין פריטים בארוחה זו.</div>';
    return items.map(entry => {
      const amount = num(entry.amount) ? `${fmt(entry.amount)} ${entry.unit || 'ג׳'}` : '';
      return `<div class="meal-summary-item">
        <div><b>${entry.name || 'פריט'}</b>${amount ? `<span>${amount}</span>` : ''}</div>
        <div class="meal-summary-item-macros">${fmt(entry.cal, 0)} קל׳ | חלבון ${fmt(entry.p)} | פחמימה ${fmt(entry.c)} | שומן ${fmt(entry.f)}${num(entry.v) ? ` | ירקות ${fmt(entry.v)} ג׳` : ''}</div>
      </div>`;
    }).join('');
  };

  window.toggleMealSummaryDetail = id => {
    const row = document.getElementById(id);
    if (row) row.classList.toggle('hide');
  };

  window.renderMealJournal = function renderMealJournalTable() {
    const box = document.getElementById('mealJournal');
    if (!box || typeof st === 'undefined') return;

    const entries = Array.isArray(st.entries) ? st.entries : [];
    const rows = MEALS.map(meal => {
      const items = entries.filter(entry => normalizeMeal(entry.meal) === meal);
      return { meal, items, total: sumEntries(items) };
    });

    const total = sumEntries(entries);
    const targets = st.targets || {};
    const target = {
      cal: num(targets.calories),
      p: num(targets.protein),
      c: num(targets.carbs),
      f: num(targets.fat),
      v: num(targets.veg) || 500
    };
    const remaining = {
      cal: target.cal - total.cal,
      p: target.p - total.p,
      c: target.c - total.c,
      f: target.f - total.f,
      v: target.v - total.v
    };

    const summaryRow = (label, values, className) => `
      <tr class="${className}">
        <th scope="row">${label}</th>
        ${valueCell(values.cal, 0)}
        ${valueCell(values.p)}
        ${valueCell(values.c)}
        ${valueCell(values.f)}
        ${valueCell(values.v)}
      </tr>`;

    const mealRows = rows.map((row, index) => {
      const detailId = `mealSummaryDetail${index}`;
      return `
        <tr class="meal-summary-meal-row" onclick="toggleMealSummaryDetail('${detailId}')" title="לחץ לפירוט הארוחה">
          <th scope="row"><span>${row.meal}</span><span class="meal-summary-chevron">⌄</span></th>
          ${valueCell(row.total.cal, 0)}
          ${valueCell(row.total.p)}
          ${valueCell(row.total.c)}
          ${valueCell(row.total.f)}
          ${valueCell(row.total.v)}
        </tr>
        <tr id="${detailId}" class="meal-summary-detail hide">
          <td colspan="6">${detailHtml(row.items)}</td>
        </tr>`;
    }).join('');

    box.innerHTML = `
      <div class="meal-summary-scroll">
        <table class="meal-summary-table" dir="rtl">
          <thead>
            <tr>
              <th>ארוחה</th>
              <th>קלוריות</th>
              <th>חלבון</th>
              <th>פחמימה</th>
              <th>שומן</th>
              <th>ירקות</th>
            </tr>
          </thead>
          <tbody>
            ${mealRows}
            ${summaryRow('סה״כ היום', total, 'meal-summary-total')}
            ${summaryRow('יעד יומי', target, 'meal-summary-target')}
            ${summaryRow('נשאר', remaining, 'meal-summary-remaining')}
          </tbody>
        </table>
      </div>
      <div class="meal-summary-hint">לחץ על שורת ארוחה כדי לראות את פירוט המאכלים.</div>`;
  };

  const style = document.createElement('style');
  style.id = 'meal-summary-table-style-v1';
  style.textContent = `
    .meal-summary-scroll{margin-top:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--b,#e5e7eb);border-radius:18px;background:#fff}
    .meal-summary-table{width:100%;min-width:560px;border-collapse:collapse;direction:rtl;background:#fff;font-size:12px}
    .meal-summary-table th,.meal-summary-table td{padding:10px 8px;text-align:center;white-space:nowrap;border-bottom:1px solid var(--b,#e5e7eb)}
    .meal-summary-table thead th{background:#f8fafc;font-weight:900;color:#374151;position:sticky;top:0;z-index:2}
    .meal-summary-table th:first-child{min-width:88px;text-align:right;font-weight:900;position:sticky;right:0;z-index:3;background:#fff}
    .meal-summary-table thead th:first-child{background:#f8fafc;z-index:4}
    .meal-summary-meal-row{cursor:pointer}
    .meal-summary-meal-row:hover td,.meal-summary-meal-row:hover th{background:#f8fbff}
    .meal-summary-meal-row th{display:flex;align-items:center;justify-content:space-between;gap:6px}
    .meal-summary-chevron{color:#6b7280;font-size:14px}
    .meal-summary-detail td{padding:0!important;text-align:right!important;background:#fbfdff}
    .meal-summary-item{padding:9px 12px;border-bottom:1px solid #eef2f7}
    .meal-summary-item:last-child{border-bottom:0}
    .meal-summary-item>div:first-child{display:flex;justify-content:space-between;gap:10px}
    .meal-summary-item span,.meal-summary-item-macros,.meal-summary-empty{font-size:11px;color:#6b7280}
    .meal-summary-item-macros{margin-top:3px}
    .meal-summary-empty{padding:12px;text-align:center}
    .meal-summary-total th,.meal-summary-total td{font-weight:900;background:#eef6ff}
    .meal-summary-target th,.meal-summary-target td{font-weight:900;background:#f5f3ff}
    .meal-summary-remaining th,.meal-summary-remaining td{font-weight:900;background:#ecfdf5;border-bottom:0}
    .meal-summary-total th:first-child{background:#eef6ff}
    .meal-summary-target th:first-child{background:#f5f3ff}
    .meal-summary-remaining th:first-child{background:#ecfdf5}
    .meal-value-negative{color:#b91c1c!important}
    .meal-summary-hint{font-size:11px;color:#6b7280;text-align:center;margin-top:7px}
    @media(max-width:520px){.meal-summary-table{font-size:11px}.meal-summary-table th,.meal-summary-table td{padding:9px 7px}}
  `;
  document.head.appendChild(style);

  const refresh = () => {
    try { window.renderMealJournal(); } catch (e) { console.error('meal summary render failed', e); }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(refresh, 0));
  } else {
    setTimeout(refresh, 0);
  }
})();