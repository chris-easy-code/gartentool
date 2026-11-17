// Speicherschicht: IndexedDB.
// Stores: beds (UC1), plantings (UC2), entries (Tagebuch/Schädlinge UC12/UC14),
// harvests (UC13), settings (PLZ-Standort, Gartenfläche).
const DB_NAME = 'gartentool';
const DB_VERSION = 4;
const STORES = ['beds', 'plantings', 'entries', 'harvests', 'settings'];

let dbPromise;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const make = (name, opts, index) => {
        if (db.objectStoreNames.contains(name)) return;
        const store = db.createObjectStore(name, opts);
        if (index) store.createIndex(index, index);
      };
      make('beds', { keyPath: 'id', autoIncrement: true });
      make('plantings', { keyPath: 'id', autoIncrement: true }, 'bedId');
      make('entries', { keyPath: 'id', autoIncrement: true }, 'bedId');
      make('harvests', { keyPath: 'id', autoIncrement: true }, 'plantingId');
      make('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const request = fn(tx);
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const getAll = (store) => run(store, 'readonly', (tx) => tx.objectStore(store).getAll());
const add = (store, rec) => run(store, 'readwrite', (tx) => tx.objectStore(store).add(rec));
const remove = (store, id) => run(store, 'readwrite', (tx) => tx.objectStore(store).delete(id));
const update = (store, id, patch) =>
  run(store, 'readwrite', (tx) => {
    const s = tx.objectStore(store);
    const get = s.get(id);
    get.onsuccess = () => { if (get.result) s.put({ ...get.result, ...patch }); };
  });

// Löscht alle Datensätze eines Stores, deren Indexwert passt; ruft für jeden Schlüssel `each` auf.
function deleteByIndex(tx, store, index, value, each) {
  const cur = tx.objectStore(store).index(index).openKeyCursor(IDBKeyRange.only(value));
  cur.onsuccess = () => {
    const c = cur.result;
    if (!c) return;
    tx.objectStore(store).delete(c.primaryKey);
    each?.(c.primaryKey);
    c.continue();
  };
}

// Beete (UC1): { name, widthCm, lengthCm, sun, x, y }
export const listBeds = () => getAll('beds');
export const addBed = (bed) => add('beds', { createdAt: Date.now(), ...bed });
export const updateBed = (id, patch) => update('beds', id, patch);

// Beet löschen inkl. Pflanzungen, deren Ernten und Tagebucheinträgen
export const deleteBed = (id) =>
  run(['beds', 'plantings', 'entries', 'harvests'], 'readwrite', (tx) => {
    tx.objectStore('beds').delete(id);
    deleteByIndex(tx, 'plantings', 'bedId', id, (pid) => deleteByIndex(tx, 'harvests', 'plantingId', pid));
    deleteByIndex(tx, 'entries', 'bedId', id);
  });

// Pflanzungen (UC2): { bedId, plantId|null, name, count, plantedAt, lastWateredAt?, endedAt? }
export const listPlantings = () => getAll('plantings');
export const addPlanting = (p) => add('plantings', p);
export const updatePlanting = (id, patch) => update('plantings', id, patch);
export const deletePlanting = (id) =>
  run(['plantings', 'harvests'], 'readwrite', (tx) => {
    tx.objectStore('plantings').delete(id);
    deleteByIndex(tx, 'harvests', 'plantingId', id);
  });

// Tagebuch (UC12/UC14): { bedId, plantingId|null, date, type: 'note'|'pest', text, measure, photos: [dataURL] }
export const listEntries = () => getAll('entries');
export const addEntry = (e) => add('entries', e);
export const deleteEntry = (id) => remove('entries', id);

// Ernten (UC13): { plantingId, bedId, plantId, name, date, amount, unit }
export const listHarvests = () => getAll('harvests');
export const addHarvest = (h) => add('harvests', h);
export const deleteHarvest = (id) => remove('harvests', id);

// Einstellungen (key 'location': { zip, name, lat, lon }, key 'garden': { widthCm, heightCm })
export const getSetting = (key) =>
  run('settings', 'readonly', (tx) => tx.objectStore('settings').get(key)).then((r) => r?.value);
export const setSetting = (key, value) =>
  run('settings', 'readwrite', (tx) => tx.objectStore('settings').put({ key, value }));
export const deleteSetting = (key) => remove('settings', key);

// Backup (UC16)
export async function exportAll() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readonly');
    const stores = {};
    for (const s of STORES) {
      const r = tx.objectStore(s).getAll();
      r.onsuccess = () => { stores[s] = r.result; };
    }
    tx.oncomplete = () => resolve({ app: 'gartentool', version: 1, exportedAt: new Date().toISOString(), stores });
    tx.onerror = () => reject(tx.error);
  });
}

// Ersetzt ALLE Daten durch die Sicherung. Wirft bei ungültiger Datei, bevor etwas gelöscht wird.
export function importAll(data) {
  const ok = data?.app === 'gartentool' && data.stores && typeof data.stores === 'object'
    && STORES.every((s) => data.stores[s] === undefined || Array.isArray(data.stores[s]));
  if (!ok) return Promise.reject(new Error('Keine gültige Gartentool-Sicherung.'));
  return run(STORES, 'readwrite', (tx) => {
    for (const s of STORES) {
      const store = tx.objectStore(s);
      store.clear();
      for (const rec of data.stores[s] ?? []) store.put(rec);
    }
  });
}
