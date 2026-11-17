// Gartenskizze (UC7): Beete als Rechtecke per Drag & Drop anordnen, Druck/PDF (UC16).
import { updateBed, setSetting } from './db.js';
import { el } from './ui.js';
import { isActive, spaceWarning } from './rules.js';

const SNAP = 10; // cm
const snap = (v) => Math.round(v / SNAP) * SNAP;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export async function renderPlan(root, state, refresh) {
  const g = state.garden;
  const dims = (b) => ({ w: b.widthCm ?? 100, h: b.lengthCm ?? 200 });

  // Beete ohne Position werden einmalig nebeneinander gelegt und gespeichert.
  const unplaced = state.beds.filter((b) => b.x === undefined);
  unplaced.forEach((b, i) => {
    const idx = state.beds.indexOf(b);
    b.x = (idx % 5) * 120;
    b.y = Math.floor(idx / 5) * 220;
  });
  await Promise.all(unplaced.map((b) => updateBed(b.id, { x: b.x, y: b.y })));

  const width = el('input', { type: 'number', min: 1, max: 100, step: 0.5, value: g.widthCm / 100, required: true, ariaLabel: 'Breite in Metern' });
  const height = el('input', { type: 'number', min: 1, max: 100, step: 0.5, value: g.heightCm / 100, required: true, ariaLabel: 'Länge in Metern' });
  const sizeForm = el('form', { className: 'no-print' },
    el('span', { textContent: 'Gartenfläche (m):' }), width, el('span', { textContent: '×' }), height,
    el('button', { type: 'submit', textContent: 'Übernehmen' }));
  sizeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    state.garden = { widthCm: Math.round(width.value * 100), heightCm: Math.round(height.value * 100) };
    await setSetting('garden', state.garden);
    refresh();
  });
  const print = el('button', { className: 'secondary no-print', textContent: 'Als PDF speichern / drucken' });
  print.addEventListener('click', () => window.print());

  const avail = Math.max(root.clientWidth, 300);
  const s = avail / g.widthCm; // Pixel pro cm
  const garden = el('div', { className: 'garden' });
  garden.style.width = `${g.widthCm * s}px`;
  garden.style.height = `${g.heightCm * s}px`;

  for (const bed of state.beds) {
    const { w, h } = dims(bed);
    const mine = state.plantings.filter((p) => p.bedId === bed.id);
    const warn = spaceWarning(bed, mine, state.plants);
    const tile = el('div', { className: 'bed-tile' + (warn ? ' over' : '') },
      el('b', { textContent: bed.name }),
      ...mine.filter(isActive).map((p) => el('span', { textContent: `${p.count ?? 1}× ${p.name}` })));
    tile.title = `${bed.name} (${w} × ${h} cm)${warn ? '\n⚠ ' + warn : ''}`;
    tile.style.cssText = `left:${bed.x * s}px;top:${bed.y * s}px;width:${w * s}px;height:${h * s}px`;

    tile.addEventListener('pointerdown', (e) => {
      tile.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, ox = bed.x, oy = bed.y;
      let nx = ox, ny = oy;
      const move = (ev) => {
        nx = snap(clamp(ox + (ev.clientX - sx) / s, 0, g.widthCm - w));
        ny = snap(clamp(oy + (ev.clientY - sy) / s, 0, g.heightCm - h));
        tile.style.left = `${nx * s}px`;
        tile.style.top = `${ny * s}px`;
      };
      const up = async () => {
        tile.removeEventListener('pointermove', move);
        tile.removeEventListener('pointerup', up);
        tile.removeEventListener('pointercancel', up);
        if (nx !== ox || ny !== oy) {
          bed.x = nx; bed.y = ny;
          await updateBed(bed.id, { x: nx, y: ny });
        }
      };
      tile.addEventListener('pointermove', move);
      tile.addEventListener('pointerup', up);
      tile.addEventListener('pointercancel', up);
    });
    garden.append(tile);
  }

  const listing = el('div', { className: 'print-list' }, el('h3', { textContent: 'Beetliste' }),
    ...state.beds.map((bed) => {
      const { w, h } = dims(bed);
      const act = state.plantings.filter((p) => p.bedId === bed.id && isActive(p));
      return el('p', {}, el('b', { textContent: bed.name }),
        ` – ${w} × ${h} cm, ${bed.sun ?? 'sonnig'}: `,
        act.length ? act.map((p) => `${p.count ?? 1}× ${p.name}`).join(', ') : 'leer');
    }));

  root.replaceChildren(el('h2', { textContent: 'Beetplan' }),
    el('div', { className: 'row' }, sizeForm, print),
    state.beds.length ? garden : el('p', { className: 'muted', textContent: 'Lege zuerst unter „Beete" ein Beet an.' }),
    el('p', { className: 'muted no-print', textContent: 'Beete per Maus oder Finger verschieben (rastet auf 10 cm). Rot umrandet = zu eng bepflanzt.' }),
    listing);
}
