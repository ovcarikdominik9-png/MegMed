// Stav appky v pamäti + akcie. Každá zmena sa hneď uloží do IndexedDB a prekreslí obrazovku.

import { loadState, saveState, migrate, emptyState } from './db.js';
import { toDayStr } from './dates.js';
import { computeTodayPlan, statusAtDayStart, netStepsByTopic } from './plan.js';

let state = null;
const listeners = new Set();
let saveChain = Promise.resolve();

export const getState = () => state;

export async function initStore() {
  state = migrate(await loadState());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit() {
  const snapshot = JSON.parse(JSON.stringify(state));
  saveChain = saveChain.then(() => saveState(snapshot)).catch((err) => {
    console.error(err);
    window.dispatchEvent(new CustomEvent('megmed:save-error'));
  });
  listeners.forEach((fn) => fn());
}

/** Počká, kým sa uložia všetky zmeny (napr. pred exportom). */
export const flush = () => saveChain;

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const nextOrder = (arr) => arr.reduce((m, x) => Math.max(m, x.order ?? -1), -1) + 1;
const now = () => new Date().toISOString();

// ---------- Predmety ----------

export function addSubject({ name, color, examDate, examTime }) {
  const s = {
    id: uid(), name: name.trim(), color, examDate, examTime: examTime || null,
    order: nextOrder(state.subjects), createdAt: now(), startDate: toDayStr(), pastAlertDismissed: false,
  };
  state.subjects.push(s);
  commit();
  return s;
}

export function updateSubject(id, patch) {
  const s = state.subjects.find((x) => x.id === id);
  if (!s) return;
  if (patch.examDate && patch.examDate !== s.examDate) s.pastAlertDismissed = false;
  Object.assign(s, patch);
  if (typeof patch.name === 'string') s.name = patch.name.trim();
  if ('examTime' in patch) s.examTime = patch.examTime || null;
  commit();
}

export function deleteSubject(id) {
  state.subjects = state.subjects.filter((s) => s.id !== id);
  state.groups = state.groups.filter((g) => g.subjectId !== id);
  state.topics = state.topics.filter((t) => t.subjectId !== id);
  state.events.forEach((e) => { if (e.subjectId === id) e.subjectId = null; });
  // Záznam zmien (log) ponechávame, aby heatmapa nestratila históriu.
  commit();
}

// ---------- Okruhy ----------

export function addGroup(subjectId, name) {
  const g = { id: uid(), subjectId, name: name.trim(), order: nextOrder(state.groups.filter((x) => x.subjectId === subjectId)) };
  state.groups.push(g);
  commit();
  return g;
}

export function renameGroup(id, name) {
  const g = state.groups.find((x) => x.id === id);
  if (g) { g.name = name.trim(); commit(); }
}

export function deleteGroup(id, { withTopics = false } = {}) {
  const g = state.groups.find((x) => x.id === id);
  if (!g) return;
  state.groups = state.groups.filter((x) => x.id !== id);
  if (withTopics) {
    state.topics = state.topics.filter((t) => t.groupId !== id);
  } else {
    let order = nextOrder(state.topics.filter((t) => t.subjectId === g.subjectId));
    state.topics.forEach((t) => { if (t.groupId === id) { t.groupId = null; t.order = order++; } });
  }
  commit();
}

// ---------- Témy ----------

/** Vytvorí témy z riadkov textu. Odstráni odrážky a číslovanie („1.“, „-“, „•“). */
export function parseTopicLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-–—•*·▪◦‣]|\d{1,3}[.)])\s*/, '').trim())
    .filter(Boolean);
}

export function addTopics(subjectId, titles, groupId = null) {
  let order = nextOrder(state.topics.filter((t) => t.subjectId === subjectId));
  for (const title of titles) {
    state.topics.push({
      id: uid(), subjectId, groupId, title, note: '', status: 0, order: order++,
      createdAt: now(), statusChangedAt: null, reviews: [],
    });
  }
  commit();
}

export function updateTopic(id, patch) {
  const t = state.topics.find((x) => x.id === id);
  if (!t) return;
  const { status, ...rest } = patch;
  Object.assign(t, rest);
  if (status !== undefined && status !== t.status) applyStatus(t, status);
  commit();
}

export function deleteTopic(id) {
  state.topics = state.topics.filter((t) => t.id !== id);
  commit();
}

function applyStatus(t, to) {
  const at = now();
  state.log.push({ id: uid(), topicId: t.id, subjectId: t.subjectId, from: t.status, to, day: toDayStr(), at });
  t.status = to;
  t.statusChangedAt = at;
}

export function setTopicStatus(id, to) {
  const t = state.topics.find((x) => x.id === id);
  if (!t || t.status === to) return;
  applyStatus(t, to);
  commit();
}

/** Posunie stav o jeden dopredu. Vráti false, ak je téma už zvládnutá. */
export function advanceTopic(id) {
  const t = state.topics.find((x) => x.id === id);
  if (!t || t.status >= 3) return false;
  applyStatus(t, t.status + 1);
  commit();
  return true;
}

/** Nové poradie po ťahaní: [{id, groupId}] v poradí zoznamu. */
export function reorderTopics(sequence) {
  const byId = new Map(state.topics.map((t) => [t.id, t]));
  sequence.forEach(({ id, groupId }, i) => {
    const t = byId.get(id);
    if (t) { t.order = i; t.groupId = groupId || null; }
  });
  commit();
}

// ---------- Termíny ----------

export function addEvent({ title, date, time, subjectId }) {
  state.events.push({ id: uid(), title: title.trim(), date, time: time || null, subjectId: subjectId || null, createdAt: now() });
  commit();
}

export function updateEvent(id, patch) {
  const e = state.events.find((x) => x.id === id);
  if (!e) return;
  Object.assign(e, patch, { time: patch.time || null, subjectId: patch.subjectId || null });
  if (typeof patch.title === 'string') e.title = patch.title.trim();
  commit();
}

export function deleteEvent(id) {
  state.events = state.events.filter((e) => e.id !== id);
  commit();
}

// ---------- Nastavenia a záloha ----------

export function markBackup() {
  state.settings.lastBackupAt = now();
  commit();
}

export function replaceState(doc) {
  state = doc;
  commit();
}

export function resetAll() {
  state = emptyState();
  commit();
}

// ---------- Odvodené údaje ----------

export function getTodayPlan(today = toDayStr()) {
  const topics = state.topics.map((t) => ({ ...t, status: statusAtDayStart(t, state.log, today) }));
  return computeTodayPlan({ subjects: state.subjects, topics, groups: state.groups, today });
}

export function getNetToday(today = toDayStr()) {
  return netStepsByTopic(state.log, today);
}
