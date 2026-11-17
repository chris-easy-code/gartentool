// Ernteprotokoll pro Pflanzung und Jahresvergleich (UC13).
import { addHarvest, deleteHarvest } from './db.js';
import { el, today, formatDate, fmtNum, details } from './ui.js';

export function renderHarvestBox(p, state, refresh) {
  const mine = state.harvests.filter((h) => h.plantingId === p.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const date = el('input', { type: 'date', value: today(), required: true, ariaLabel: 'Erntedatum' });
  const amount = el('input', { type: 'number', min: 0.01, step: 0.01, required: true, placeholder: 'Menge', ariaLabel: 'Menge' });
  const unit = el('select', { ariaLabel: 'Einheit' },
    el('option', { value: 'kg', textContent: 'kg' }),
    el('option', { value: 'Stück', textContent: 'Stück' }));
  const form = el('form', { className: 'harvest-form' }, date, amount, unit,
    el('button', { type: 'submit', textContent: 'Ernte eintragen' }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = Number(amount.value);
    if (!(value > 0)) return;
    await addHarvest({ plantingId: p.id, bedId: p.bedId, plantId: p.plantId, name: p.name, date: date.value, amount: value, unit: unit.value });
    refresh();
  });
  const list = el('ul', { className: 'entries' }, ...mine.map((h) => {
    const del = el('button', { className: 'danger', textContent: 'Löschen' });
    del.addEventListener('click', async () => { await deleteHarvest(h.id); refresh(); });
    return el('li', { className: 'entry' },
      el('span', { className: 'name', textContent: `${formatDate(h.date)} – ${fmtNum(h.amount)} ${h.unit}` }), del);
  }));
  return details(`harvest-${p.id}`, `Ernte (${mine.length})`, form, list);
}

// Tabelle: Pflanze × Jahr (Summe), getrennt nach Einheit.
export function renderHarvestCompare(root, state) {
  const sums = new Map(); // "name|unit" -> { name, unit, years: Map(year -> sum) }
  const years = new Set();
  for (const h of state.harvests) {
    const year = h.date.slice(0, 4);
    years.add(year);
    const key = `${h.name}|${h.unit}`;
    const row = sums.get(key) ?? { name: h.name, unit: h.unit, years: new Map() };
    row.years.set(year, (row.years.get(year) ?? 0) + h.amount);
    sums.set(key, row);
  }
  root.replaceChildren(el('h2', { textContent: 'Ernten im Jahresvergleich' }));
  if (!sums.size) {
    root.append(el('p', { className: 'muted', textContent: 'Noch keine Ernten. Trage sie bei einer Pflanzung unter „Ernte" ein.' }));
    return;
  }
  const cols = [...years].sort();
  const rows = [...sums.values()].sort((a, b) => a.name.localeCompare(b.name, 'de') || a.unit.localeCompare(b.unit));
  root.append(el('div', { className: 'table-wrap' }, el('table', {},
    el('thead', {}, el('tr', {}, el('th', { textContent: 'Pflanze' }), ...cols.map((y) => el('th', { textContent: y })))),
    el('tbody', {}, ...rows.map((r) => el('tr', {},
      el('th', { scope: 'row', textContent: `${r.name} (${r.unit})` }),
      ...cols.map((y) => el('td', { textContent: r.years.has(y) ? fmtNum(r.years.get(y)) : '–' }))))))));
}
