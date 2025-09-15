const form = document.getElementById('plan-form');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultEl.innerHTML = '';
  statusEl.textContent = 'Generating...';

  const formData = new FormData(form);
  const payload = {
    calories: Number(formData.get('calories')),
    days: Number(formData.get('days')),
    diet: (formData.get('diet') || '').trim(),
    allergies: (formData.get('allergies') || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    dislikes: (formData.get('dislikes') || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  };

  try {
    const r = await fetch('http://localhost:8787/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err?.error || `HTTP ${r.status}`);
    }
    const data = await r.json();

    statusEl.textContent = 'Done.';
    renderPlan(data);
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }
});

function renderPlan(data) {
  // data = { days: [ { date, meals: [ { name, kcal, protein_g, carbs_g, fat_g, steps[] } ] } ], shopping_list: [ {item, qty, unit} ] }
  if (!data?.days) {
    resultEl.innerHTML = `<pre>${escapeHTML(JSON.stringify(data, null, 2))}</pre>`;
    return;
  }

  const daysHtml = data.days.map(d => {
    const meals = (d.meals || []).map(m => `
      <div class="meal-card">
        <h4>${m.name}</h4>
        <div class="macros">
          <span>${Math.round(m.kcal)} kcal</span>
          <span>💪 ${m.protein_g}g</span>
          <span>🥖 ${m.carbs_g}g</span>
          <span>🥑 ${m.fat_g}g</span>
        </div>
        ${m.steps?.length ? `<ol>${m.steps.map(s => `<li>${s}</li>`).join('')}</ol>` : ''}
      </div>
    `).join('');

    const total = (d.meals || []).reduce((acc, m) => acc + (m.kcal || 0), 0);

    return `
      <section class="day">
        <h3>${d.date || 'Day'}</h3>
        <p class="muted">Total ~ ${Math.round(total)} kcal</p>
        <div class="meals">${meals}</div>
      </section>
    `;
  }).join('');

  const listHtml = (data.shopping_list || []).map(i =>
    `<li>${i.item}${i.qty ? ` — ${i.qty}${i.unit ? ' ' + i.unit : ''}` : ''}</li>`
  ).join('');

  resultEl.innerHTML = `
    <div class="layout">
      <div>${daysHtml}</div>
      <aside class="sidebar">
        <h3>🛒 Shopping list</h3>
        <ul>${listHtml}</ul>
        <details>
          <summary>Raw JSON</summary>
          <pre>${escapeHTML(JSON.stringify(data, null, 2))}</pre>
        </details>
      </aside>
    </div>
  `;
}

function escapeHTML(s) {
  return s.replace(/[&<>'"]/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[c]);
}
