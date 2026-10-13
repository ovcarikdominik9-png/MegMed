// Úložisko: celý stav je jeden JSON dokument v IndexedDB (rovnaký formát ako záloha).
// IndexedDB: transakčný zápis (dokument sa zapíše celý alebo vôbec), väčší limit ako localStorage.
// localStorage slúži iba ako núdzová záloha, keby IndexedDB zlyhala (napr. súkromné okno).

export const SCHEMA_VERSION = 1;
const DB_NAME = 'megmed';
const STORE = 'kv';
const KEY = 'state';
const LS_FALLBACK = 'megmed-fallback';

export function emptyState() {
  return {
    app: 'MegMed',
    schemaVersion: SCHEMA_VERSION,
    subjects: [],
    groups: [],
    topics: [],
    events: [],
    log: [],
    settings: { lastBackupAt: null, createdAt: new Date().toISOString() },
  };
}

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      // iOS Safari občas zavrie spojenie, keď je appka dlho na pozadí → pri ďalšom zápise otvoríme nové.
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

async function run(mode, fn) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (err) {
      lastErr = err;
      dbPromise = null;
    }
  }
  throw lastErr;
}

export async function loadState() {
  try {
    const doc = await run('readonly', (st) => st.get(KEY));
    if (doc) return doc;
  } catch (err) {
    console.warn('IndexedDB nedostupná, skúšam núdzové úložisko', err);
  }
  try {
    const raw = localStorage.getItem(LS_FALLBACK);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveState(doc) {
  try {
    await run('readwrite', (st) => st.put(doc, KEY));
    try { localStorage.removeItem(LS_FALLBACK); } catch { /* nič */ }
  } catch (err) {
    console.warn('Zápis do IndexedDB zlyhal, ukladám do localStorage', err);
    localStorage.setItem(LS_FALLBACK, JSON.stringify(doc));
  }
}

/** Požiada prehliadač, aby dáta nemazal pri nedostatku miesta. */
export async function requestPersist() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function isPersisted() {
  try { return (await navigator.storage?.persisted?.()) ?? null; } catch { return null; }
}

/** Doplní chýbajúce polia a prevedie staršie verzie dokumentu na aktuálnu. */
export function migrate(doc) {
  if (!doc) return emptyState();
  const base = emptyState();
  const out = { ...base, ...doc, settings: { ...base.settings, ...(doc.settings || {}) } };
  for (const k of ['subjects', 'groups', 'topics', 'events', 'log']) {
    if (!Array.isArray(out[k])) out[k] = [];
  }
  out.subjects = out.subjects.map((s, i) => ({
    color: '#ff5fa8', examTime: null, order: i, startDate: s.examDate, pastAlertDismissed: false, ...s,
  }));
  out.topics = out.topics.map((t, i) => ({
    groupId: null, note: '', status: 0, order: i, statusChangedAt: null, reviews: [], ...t,
  }));
  out.schemaVersion = SCHEMA_VERSION;
  out.app = 'MegMed';
  return out;
}

// ---------- Export / import ----------

export function exportFileName(day) {
  return `megmed-zaloha-${day}.json`;
}

export function serializeBackup(state) {
  const at = new Date().toISOString();
  return JSON.stringify({ ...state, settings: { ...state.settings, lastBackupAt: at }, exportedAt: at }, null, 2);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Načíta a overí zálohu. Pri chybe vyhodí Error so slovenskou správou. */
export function parseBackup(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('Súbor nie je platný JSON. Vyber súbor zálohy, ktorý vytvorila appka MegMed.');
  }
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.subjects) || !Array.isArray(doc.topics)) {
    throw new Error('Toto nevyzerá ako záloha z MegMed (chýbajú predmety alebo témy).');
  }
  if (doc.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Záloha je z novšej verzie appky. Najprv appku aktualizuj (zavri ju a otvor znova).');
  }
  for (const s of doc.subjects) {
    if (!s || !s.id || typeof s.name !== 'string' || !DAY_RE.test(s.examDate || '')) {
      throw new Error('Záloha obsahuje poškodený predmet.');
    }
  }
  const ids = new Set(doc.subjects.map((s) => s.id));
  for (const t of doc.topics) {
    if (!t || !t.id || typeof t.title !== 'string' || !ids.has(t.subjectId) || ![0, 1, 2, 3].includes(t.status)) {
      throw new Error('Záloha obsahuje poškodenú tému.');
    }
  }
  return migrate(doc);
}
