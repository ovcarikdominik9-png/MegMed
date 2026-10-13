// Dátumy ukladáme ako lokálne reťazce "YYYY-MM-DD", aby nevznikali chyby s časovými pásmami.

const pad = (n) => String(n).padStart(2, '0');

export function toDayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDayStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function addDays(s, n) {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return toDayStr(d);
}

/** Počet dní od a do b (b − a). */
export function diffDays(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Pondelok týždňa, do ktorého patrí deň s. */
export function startOfWeek(s) {
  const wd = (parseDay(s).getDay() + 6) % 7;
  return addDays(s, -wd);
}

const DAYS = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
const MONTHS_GEN = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];
export const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** "pondelok 13. októbra" */
export function formatLong(s) {
  const d = parseDay(s);
  return `${DAYS[d.getDay()]} ${d.getDate()}. ${MONTHS_GEN[d.getMonth()]}`;
}

/** "13. okt." alebo "13. okt. 2027" ak je iný rok */
export function formatShort(s, today = toDayStr()) {
  const d = parseDay(s);
  const sameYear = s.slice(0, 4) === today.slice(0, 4);
  return `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
}

export function weekdayShort(s) {
  return DAYS[parseDay(s).getDay()].slice(0, 2);
}

/** Slovenské skloňovanie podľa čísla: 1 deň, 2–4 dni, 5+ dní */
export function plural(n, one, few, many) {
  const a = Math.abs(n);
  if (a === 1) return one;
  if (a >= 2 && a <= 4) return few;
  return many;
}

export function relDays(n) {
  if (n === 0) return 'dnes';
  if (n === 1) return 'zajtra';
  if (n === -1) return 'včera';
  if (n > 0) return `o ${n} ${plural(n, 'deň', 'dni', 'dní')}`;
  const a = -n;
  return `pred ${a} ${a === 1 ? 'dňom' : 'dňami'}`;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 4 && h < 10) return 'Dobré ráno';
  if (h >= 10 && h < 18) return 'Dobrý deň';
  if (h >= 18 && h < 23) return 'Dobrý večer';
  return 'Dobrú noc';
}
