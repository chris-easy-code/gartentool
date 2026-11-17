import {
  listBeds, addBed, updateBed, deleteBed,
  listPlantings, addPlanting, deletePlanting, updatePlanting,
  listEntries, listHarvests,
  getSetting, setSetting, deleteSetting,
} from './db.js';
import { geocodeZip, fetchWeather } from './weather.js';
import { wateringStatus } from './watering.js';
import { bedWarnings, spaceWarning, sunFits, weatherWarnings, isActive } from './rules.js';
import { el, today, formatDate, details } from './ui.js';
import { renderJournal } from './journal.js';
import { renderHarvestBox, renderHarvestCompare } from './harvest.js';
import { renderCalendar } from './calendar.js';
import { renderPlan } from './plan.js';
import { renderBackup } from './backup.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['overview', 'beds', 'plan', 'calendar', 'harvest', 'data'];

const state = {
  plants: [], beds: [], plantings: [], entries: [], harvests: [],
  garden: { widthCm: 1000, heightCm: 600 },
  place: null,       // { zip, name, lat, lon }
  weather: null,     // Ergebnis von fetchWeather, null wenn nicht verfügbar
  weatherError: '',
  view: VIEWS.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'overview',
};
let editingId = null;

// ---------- Beete & Pflanzungen ----------

const statusOf = (p) =>
  wateringStatus(p, state.plants.find((x) => x.id === p.plantId), state.weather, today());

function wateredButton(p) {
  const b = el('button', { className: 'secondary', textContent: 'Gegossen' });
  b.addEventListener('click', async () => {
    await updatePlanting(p.id, { lastWateredAt: state.weather?.today ?? today() });
    refresh();
  });
  return b;
}

function renderPlanting(p) {
  const info = state.plants.find((x) => x.id === p.plantId);
  const meta = info ? `${info.sun} · Wasserbedarf ${info.water} · Abstand ${info.spacingCm} cm` : 'eigene Pflanze';
  const status = statusOf(p);
  const end = el('button', { className: 'secondary', textContent: 'Abernten' });
  end.title = 'Pflanzung abgeerntet (bleibt als Historie für die Fruchtfolge erhalten)';
  end.addEventListener('click', async () => { await updatePlanting(p.id, { endedAt: today() }); refresh(); });
  const del = el('button', { className: 'danger', textContent: 'Entfernen' });
  del.addEventListener('click', async () => {
    if (confirm('Pflanzung entfernen? Dazu erfasste Ernten werden ebenfalls gelöscht. (Zum Behalten lieber „Abernten".)')) {
      await deletePlanting(p.id);
      refresh();
    }
  });
  return el('li', { className: 'planting' },
    el('span', { className: 'name' },
      el('strong', { textContent: `${p.count ?? 1}× ${p.name}` }),
      el('small', { textContent: `Gepflanzt am ${formatDate(p.plantedAt)} – ${meta}` }),
      el('small', { className: status.state, textContent: status.text }),
      renderHarvestBox(p, state, refresh)),
    wateredButton(p), end, del);
}

function renderEnded(p) {
  const del = el('button', { className: 'danger', textContent: 'Entfernen' });
  del.addEventListener('click', async () => {
    if (confirm('Aus der Historie entfernen? Ernten dazu werden ebenfalls gelöscht.')) { await deletePlanting(p.id); refresh(); }
  });
  return el('li', { className: 'planting' },
    el('span', { className: 'name' },
      el('strong', { textContent: `${p.count ?? 1}× ${p.name}` }),
      el('small', { textContent: `${formatDate(p.plantedAt)} – ${formatDate(p.endedAt)}` }),
      renderHarvestBox(p, state, refresh)),
    del);
}

function renderPlantingForm(bed, bedPlantings) {
  const bedSun = bed.sun ?? 'sonnig';
  const options = [...state.plants]
    .sort((a, b) => (sunFits(bed, b) - sunFits(bed, a)) || a.name.localeCompare(b.name, 'de'))
    .map((p) => {
      let label = p.name;
      if (bedSun !== 'sonnig') label = sunFits(bed, p) ? `✓ ${p.name}` : `${p.name} – braucht mehr Sonne`;
      return el('option', { value: p.id, textContent: label });
    });
  const select = el('select', { required: true, ariaLabel: 'Pflanze' },
    el('option', { value: '', textContent: 'Pflanze wählen …' }), ...options,
    el('option', { value: '_custom', textContent: 'Andere …' }));
  const custom = el('input', { placeholder: 'Name der Pflanze', maxLength: 60, hidden: true, ariaLabel: 'Eigener Pflanzenname' });
  const count = el('input', { type: 'number', value: 1, min: 1, max: 9999, step: 1, required: true, ariaLabel: 'Anzahl' });
  const date = el('input', { type: 'date', value: today(), required: true, ariaLabel: 'Pflanzdatum' });
  const hint = el('p', { className: 'hint', hidden: true });

  const updateHint = () => {
    custom.hidden = select.value !== '_custom';
    custom.required = !custom.hidden;
    const info = state.plants.find((x) => x.id === select.value);
    if (!info) { hint.hidden = true; return; }
    const cand = { id: -1, bedId: bed.id, plantId: info.id, name: info.name, count: 1, plantedAt: date.value };
    const before = new Set(bedWarnings(bedPlantings, state.plants));
    const fresh = bedWarnings([...bedPlantings, cand], state.plants).filter((w) => !before.has(w));
    hint.textContent = fresh.map((w) => `⚠ ${w}`).join('\n');
    hint.hidden = fresh.length === 0;
  };
  select.addEventListener('change', updateHint);
  date.addEventListener('change', updateHint);

  const f = el('form', { className: 'planting-form' }, select, custom, count, date,
    el('button', { type: 'submit', textContent: 'Eintragen' }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isCustom = select.value === '_custom';
    const name = isCustom ? custom.value.trim() : state.plants.find((p) => p.id === select.value)?.name;
    if (!name) return;
    await addPlanting({
      bedId: bed.id,
      plantId: isCustom ? null : select.value,
      name,
      count: Math.max(1, Math.floor(Number(count.value)) || 1),
      plantedAt: date.value,
    });
    refresh();
  });
  return el('div', {}, f, hint);
}

function renderBedEdit(bed) {
  const name = el('input', { value: bed.name, maxLength: 60, required: true, ariaLabel: 'Name' });
  const w = el('input', { type: 'number', min: 10, max: 5000, value: bed.widthCm ?? 100, required: true });
  const l = el('input', { type: 'number', min: 10, max: 5000, value: bed.lengthCm ?? 200, required: true });
  const sun = el('select', { ariaLabel: 'Sonnenlage' },
    ...['sonnig', 'halbschattig', 'schattig'].map((v) => el('option', { value: v, textContent: v, selected: v === (bed.sun ?? 'sonnig') })));
  const f = el('form', {}, name,
    el('label', { className: 'unit' }, 'Breite ', w, ' cm'),
    el('label', { className: 'unit' }, 'Länge ', l, ' cm'), sun, el('button', { type: 'submit', textContent: 'Speichern' }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = name.value.trim();
    if (n) await updateBed(bed.id, { name: n, widthCm: Number(w.value), lengthCm: Number(l.value), sun: sun.value });
    editingId = null;
    refresh();
  });
  const cancel = el('button', { type: 'button', className: 'secondary', textContent: 'Abbrechen' });
  cancel.addEventListener('click', () => { editingId = null; refresh(); });
  queueMicrotask(() => name.focus());
  return el('li', { className: 'bed' }, el('div', { className: 'bed-head' }, f, cancel));
}

function renderBed(bed) {
  if (bed.id === editingId) return renderBedEdit(bed);
  const mine = state.plantings
    .filter((p) => p.bedId === bed.id)
    .sort((a, b) => a.plantedAt.localeCompare(b.plantedAt));
  const active = mine.filter(isActive);
  const ended = mine.filter((p) => !isActive(p));

  const edit = el('button', { className: 'secondary', textContent: 'Bearbeiten' });
  edit.addEventListener('click', () => { editingId = bed.id; refresh(); });
  const del = el('button', { className: 'danger', textContent: 'Entfernen' });
  del.addEventListener('click', async () => {
    const hint = mine.length ? ` Pflanzungen, Ernten und Tagebuch (${mine.length} Pflanzung(en)) werden ebenfalls gelöscht.` : ' Das Tagebuch dazu wird ebenfalls gelöscht.';
    if (confirm(`Beet „${bed.name}“ entfernen?${hint}`)) { await deleteBed(bed.id); refresh(); }
  });

  const warnings = [...bedWarnings(mine, state.plants), spaceWarning(bed, mine, state.plants)].filter(Boolean);
  return el('li', { className: 'bed' },
    el('div', { className: 'bed-head' },
      el('span', { className: 'name' }, el('strong', { textContent: bed.name }),
        el('small', { className: 'dim', textContent: `${bed.widthCm ?? 100} × ${bed.lengthCm ?? 200} cm · ${bed.sun ?? 'sonnig'}` })),
      edit, del),
    ...(warnings.length ? [el('ul', { className: 'warn-list' }, ...warnings.map((w) => el('li', { textContent: `⚠ ${w}` })))] : []),
    active.length ? el('ul', { className: 'plantings' }, ...active.map(renderPlanting))
      : el('p', { className: 'muted', textContent: 'Nichts gepflanzt.' }),
    renderPlantingForm(bed, mine),
    ...(ended.length ? [details(`ended-${bed.id}`, `Abgeerntete Pflanzungen (${ended.length})`, el('ul', { className: 'plantings' }, ...ended.map(renderEnded)))] : []),
    renderJournal(bed, state, refresh));
}

// ---------- Übersicht ----------

function renderWeather() {
  const box = $('weather');
  if (!state.place) {
    box.replaceChildren(el('p', { className: 'muted', textContent: 'Gib deine Postleitzahl ein, um das Wetter zu sehen.' }));
    return;
  }
  const reset = el('button', { className: 'secondary', textContent: 'PLZ zurücksetzen' });
  reset.addEventListener('click', async () => {
    if (!confirm(`Standort ${state.place.zip} ${state.place.name} wirklich zurücksetzen?`)) return;
    await deleteSetting('location');
    Object.assign(state, { place: null, weather: null, weatherError: '' });
    $('zip').value = '';
    render();
  });
  const parts = [el('p', { className: 'muted location' },
    el('span', { textContent: `Standort: ${state.place.zip} ${state.place.name}` }), reset)];
  if (state.weather) {
    const c = state.weather.current;
    parts.push(el('p', { className: 'now' },
      el('strong', { textContent: `${Math.round(c.temp)} °C` }),
      ` ${c.text} · Niederschlag jetzt ${c.precipitation} mm · Wind ${Math.round(c.wind)} km/h`));
    const days = state.weather.daily.filter((d) => d.date >= state.weather.today);
    parts.push(el('div', { className: 'forecast' }, ...days.map((d, i) =>
      el('div', {},
        el('strong', { textContent: i === 0 ? 'Heute' : i === 1 ? 'Morgen' : new Date(d.date + 'T00:00').toLocaleDateString('de-DE', { weekday: 'short' }) }),
        el('small', { textContent: `${Math.round(d.min)}–${Math.round(d.max)} °C` }),
        el('small', { textContent: `Regen ${d.mm} mm` })))));
  } else if (state.weatherError) {
    parts.push(el('p', { className: 'error', textContent: state.weatherError }));
  }
  box.replaceChildren(...parts);
}

function renderWarnings() {
  const list = weatherWarnings(state.plantings, state.plants, state.weather);
  $('warnings').replaceChildren(...list.map((w) => el('li', { className: `warn ${w.type}`, textContent: `${w.type === 'frost' ? '❄' : '☀'} ${w.text}` })));
  $('no-warnings').hidden = list.length > 0;
  $('no-warnings').textContent = state.weather
    ? 'Keine Frost- oder Hitzewarnung für die nächsten 3 Tage.'
    : 'Ohne Wetterdaten (PLZ eingeben) gibt es keine Frost- und Hitzewarnungen.';
}

function renderReminders() {
  const bedName = new Map(state.beds.map((b) => [b.id, b.name]));
  const due = state.plantings.filter(isActive)
    .map((p) => ({ p, status: statusOf(p) }))
    .filter((x) => x.status.state !== 'ok');
  $('reminders').replaceChildren(...due.map(({ p, status }) =>
    el('li', { className: status.state },
      el('span', { className: 'name' },
        el('strong', { textContent: `${p.count ?? 1}× ${p.name}` }),
        ` im Beet „${bedName.get(p.bedId) ?? '?'}“`,
        el('small', { className: status.state, textContent: status.text })),
      wateredButton(p))));
  $('no-reminders').hidden = due.length > 0;
}

// ---------- Rendern & Laden ----------

async function load() {
  const [beds, plantings, entries, harvests, garden] = await Promise.all([
    listBeds(), listPlantings(), listEntries(), listHarvests(), getSetting('garden'),
  ]);
  Object.assign(state, { beds, plantings, entries, harvests });
  if (garden) state.garden = garden;
}

async function render() {
  await load();
  for (const v of VIEWS) $(`view-${v}`).hidden = v !== state.view;
  document.querySelectorAll('#nav button').forEach((b) =>
    b.setAttribute('aria-current', b.dataset.view === state.view ? 'page' : 'false'));

  renderWeather();
  renderWarnings();
  renderReminders();
  $('bed-list').replaceChildren(...state.beds.map(renderBed));
  $('empty').hidden = state.beds.length > 0;

  if (state.view === 'plan') await renderPlan($('view-plan'), state, refresh);
  if (state.view === 'calendar') renderCalendar($('view-calendar'), state);
  if (state.view === 'harvest') renderHarvestCompare($('view-harvest'), state);
  if (state.view === 'data') renderBackup($('view-data'));
}
const refresh = render;

async function loadWeather() {
  state.weather = null;
  state.weatherError = '';
  if (!state.place) return;
  try {
    state.weather = await fetchWeather(state.place);
  } catch {
    state.weatherError = 'Wetter konnte nicht geladen werden. Gießhinweise gelten dann nur nach Intervall.';
  }
}

// ---------- Ereignisse ----------

document.getElementById('nav').addEventListener('click', (e) => {
  const view = e.target.closest('button')?.dataset.view;
  if (!view) return;
  state.view = view;
  window.location.hash = view;
  render();
});

$('zip-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('zip-error');
  err.hidden = true;
  try {
    const found = await geocodeZip($('zip').value.trim());
    if (!found) {
      err.textContent = 'Postleitzahl nicht gefunden.';
      err.hidden = false;
      return;
    }
    state.place = found;
    await setSetting('location', found);
    await loadWeather();
    render();
  } catch {
    err.textContent = 'Standortsuche fehlgeschlagen (keine Verbindung?).';
    err.hidden = false;
  }
});

$('bed-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('bed-name').value.trim();
  if (!name) return;
  await addBed({
    name,
    widthCm: Number($('bed-width').value),
    lengthCm: Number($('bed-length').value),
    sun: $('bed-sun').value,
  });
  $('bed-name').value = '';
  refresh();
});

// ---------- Start ----------

try {
  state.plants = await (await fetch('data/plants.json')).json();
} catch (err) {
  console.error('Pflanzendaten konnten nicht geladen werden', err);
}
state.place = (await getSetting('location')) ?? null;
if (state.place) $('zip').value = state.place.zip;
await render();
if (state.place) { await loadWeather(); render(); }
