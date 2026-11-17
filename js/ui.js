// Kleine DOM-Helfer, von allen Ansichten genutzt.
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

export const today = () => new Date().toLocaleDateString('sv-SE'); // lokales Datum als YYYY-MM-DD
export const formatDate = (iso) => new Date(iso + 'T00:00').toLocaleDateString('de-DE');
export const fmtNum = (n) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 2 });

// <details>, dessen Auf/Zu-Zustand ein Neuzeichnen der Seite überlebt.
const openKeys = new Set();
export function details(key, summary, ...children) {
  const d = el('details', { open: openKeys.has(key) }, el('summary', { textContent: summary }), ...children);
  d.addEventListener('toggle', () => { d.open ? openKeys.add(key) : openKeys.delete(key); });
  return d;
}
