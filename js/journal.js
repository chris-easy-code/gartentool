// Tagebuch pro Beet (UC12) inkl. Schädlinge/Krankheiten (UC14).
import { addEntry, deleteEntry } from './db.js';
import { el, today, formatDate, details } from './ui.js';
import { resizePhoto } from './photos.js';

export function renderJournal(bed, state, refresh) {
  const entries = state.entries.filter((e) => e.bedId === bed.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const plantings = state.plantings.filter((p) => p.bedId === bed.id);
  const nameOf = new Map(plantings.map((p) => [p.id, p.name]));

  const type = el('select', { ariaLabel: 'Art des Eintrags' },
    el('option', { value: 'note', textContent: 'Notiz' }),
    el('option', { value: 'pest', textContent: 'Schädling/Krankheit' }));
  const planting = el('select', { ariaLabel: 'Bezug' },
    el('option', { value: '', textContent: 'Ganzes Beet' }),
    ...plantings.map((p) => el('option', { value: String(p.id), textContent: p.name + (p.endedAt ? ' (abgeerntet)' : '') })));
  const date = el('input', { type: 'date', value: today(), required: true, ariaLabel: 'Datum' });
  const text = el('textarea', { rows: 2, placeholder: 'Notiz …', required: true, ariaLabel: 'Text' });
  const measure = el('input', { placeholder: 'Maßnahme, z. B. Brennnesseljauche', maxLength: 200, hidden: true, ariaLabel: 'Maßnahme' });
  const photos = el('input', { type: 'file', accept: 'image/*', multiple: true, ariaLabel: 'Fotos' });
  type.addEventListener('change', () => { measure.hidden = type.value !== 'pest'; });
  const submit = el('button', { type: 'submit', textContent: 'Eintrag speichern' });

  const form = el('form', { className: 'journal-form' }, type, planting, date, text, measure, photos, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true;
    try {
      const imgs = [];
      for (const file of photos.files) imgs.push(await resizePhoto(file));
      await addEntry({
        bedId: bed.id,
        plantingId: planting.value ? Number(planting.value) : null,
        date: date.value,
        type: type.value,
        text: text.value.trim(),
        measure: type.value === 'pest' ? measure.value.trim() : '',
        photos: imgs,
      });
      refresh();
    } catch {
      alert('Eintrag konnte nicht gespeichert werden (Foto ungültig?).');
      submit.disabled = false;
    }
  });

  const list = el('ul', { className: 'entries' }, ...entries.map((en) => {
    const del = el('button', { className: 'danger', textContent: 'Löschen' });
    del.addEventListener('click', async () => {
      if (confirm('Eintrag löschen?')) { await deleteEntry(en.id); refresh(); }
    });
    const thumbs = (en.photos ?? []).map((src) => {
      const img = el('img', { src, className: 'thumb', alt: 'Foto zum Eintrag' });
      img.addEventListener('click', () => img.classList.toggle('big'));
      return img;
    });
    return el('li', { className: 'entry' },
      el('div', { className: 'entry-body' },
        el('small', { textContent: `${formatDate(en.date)} · ${en.type === 'pest' ? 'Schädling/Krankheit' : 'Notiz'}${nameOf.get(en.plantingId) ? ' · ' + nameOf.get(en.plantingId) : ''}` }),
        el('div', { className: 'entry-text', textContent: en.text }),
        en.measure ? el('div', { textContent: `Maßnahme: ${en.measure}` }) : '',
        thumbs.length ? el('div', { className: 'thumbs' }, ...thumbs) : ''),
      del);
  }));

  return details(`journal-${bed.id}`, `Tagebuch (${entries.length})`, form, list);
}
