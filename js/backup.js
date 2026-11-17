// Datensicherung und Wiederherstellung (UC16).
import { exportAll, importAll } from './db.js';
import { el, today } from './ui.js';

export function renderBackup(root) {
  const save = el('button', { textContent: 'Daten sichern (Datei herunterladen)' });
  save.addEventListener('click', async () => {
    const data = await exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = el('a', { href: url, download: `gartentool-sicherung-${today()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  const restore = el('button', { className: 'secondary', textContent: 'Sicherung wiederherstellen …' });
  restore.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const when = data.exportedAt ? new Date(data.exportedAt).toLocaleString('de-DE') : 'unbekanntem Datum';
      if (!confirm(`Alle aktuellen Daten werden durch die Sicherung vom ${when} ERSETZT. Fortfahren?`)) return;
      await importAll(data);
      alert('Sicherung wiederhergestellt.');
      window.location.reload();
    } catch (err) {
      alert(`Wiederherstellung fehlgeschlagen: ${err.message}`);
    }
  });

  root.replaceChildren(
    el('h2', { textContent: 'Daten' }),
    el('p', { textContent: 'Alle Daten liegen nur in diesem Browser. Sichere sie regelmäßig als Datei (inkl. Fotos).' }),
    el('div', { className: 'row' }, save, restore, file));
}
