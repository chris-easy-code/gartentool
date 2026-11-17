// Aussaat-, Pflanz- und Erntekalender (UC10): Tabelle Pflanze × Monat aus plants.json.
import { el } from './ui.js';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const KINDS = [['sow', 'A', 'Aussaat'], ['plant', 'P', 'Pflanzung'], ['harvest', 'E', 'Ernte']];

export function renderCalendar(root, state) {
  const own = new Set(state.plantings.filter((p) => !p.endedAt).map((p) => p.plantId));
  const now = new Date().getMonth() + 1;
  const byName = (a, b) => a.name.localeCompare(b.name, 'de');
  const mine = state.plants.filter((p) => own.has(p.id)).sort(byName);
  const others = state.plants.filter((p) => !own.has(p.id)).sort(byName);

  const legend = el('p', { className: 'legend' },
    ...KINDS.map(([k, letter, label]) => el('span', {}, el('b', { className: `cal ${k}`, textContent: letter }), ` ${label}   `)),
    el('span', { textContent: 'Aktueller Monat hervorgehoben.' }));

  const table = (plants) => {
    const head = el('tr', {}, el('th', { textContent: 'Pflanze' }),
      ...MONTHS.map((m, i) => el('th', { textContent: m, className: i + 1 === now ? 'now-col' : '' })));
    const rows = plants.map((p) => el('tr', {},
      el('th', { scope: 'row', textContent: p.name }),
      ...MONTHS.map((_, i) => el('td', { className: i + 1 === now ? 'now-col' : '' },
        ...KINDS.filter(([k]) => p[k]?.includes(i + 1))
          .map(([k, letter, label]) => el('b', { className: `cal ${k}`, textContent: letter, title: label }))))));
    return el('div', { className: 'table-wrap' }, el('table', { className: 'calendar' }, el('thead', {}, head), el('tbody', {}, ...rows)));
  };

  root.replaceChildren(el('h2', { textContent: 'Kalender' }), legend,
    el('section', { className: 'cal-section own' },
      el('h3', { textContent: 'Meine Pflanzen' }),
      el('p', { className: 'muted', textContent: 'Pflanzen, die du aktuell in deinen Beeten hast.' }),
      mine.length ? table(mine) : el('p', { className: 'muted', textContent: 'Noch keine Pflanzen in deinen Beeten.' })),
    el('section', { className: 'cal-section general' },
      el('h3', { textContent: 'Allgemeine Übersicht' }),
      el('p', { className: 'muted', textContent: 'Weitere Pflanzen aus der Starterliste – nicht in deinen Beeten.' }),
      table(others)));
}
