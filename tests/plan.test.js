// Jednotkové testy pravidla „Dnes“. Spustenie: otvor tests/index.html v prehliadači,
// alebo `node tests/run-node.mjs` (ak máš Node.js).

import { computeTodayPlan, statusAtDayStart, netStepsByTopic, forwardStepsByDay, scheduleStatus, orderTopics, STEPS_LEFT } from '../js/plan.js';
import { diffDays, addDays, startOfWeek, relDays, plural } from '../js/dates.js';
import { parseTopicLines } from '../js/store.js';

export const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  očakávané: ${e}\n  skutočné:  ${a}`);
}

const TODAY = '2026-10-13';
const subj = (id, examDate, extra = {}) => ({ id, name: id, examDate, examTime: null, ...extra });
let n = 0;
const topic = (subjectId, status, extra = {}) => ({ id: `t${++n}`, subjectId, groupId: null, status, order: n, title: `T${n}`, ...extra });

// ---------- Cieľ ----------

test('zostávajúce kroky podľa stavu: 3, 2, 1, 0', () => {
  eq(STEPS_LEFT, [3, 2, 1, 0]);
});

test('cieľ = ceil(zostávajúce kroky / dni do skúšky)', () => {
  // 10 nezačatých tém = 30 krokov, skúška o 7 dní → ceil(30/7) = 5
  const topics = Array.from({ length: 10 }, () => topic('A', 0));
  const [p] = computeTodayPlan({ subjects: [subj('A', addDays(TODAY, 7))], topics, today: TODAY });
  eq(p.remainingSteps, 30);
  eq(p.daysLeft, 7);
  eq(p.goal, 5);
  eq(p.items.reduce((s, i) => s + i.steps, 0), 5, 'súčet krokov v zozname = cieľ');
});

test('skúška zajtra → celý zvyšok dnes (1 deň)', () => {
  const topics = [topic('A', 0), topic('A', 2)];
  const [p] = computeTodayPlan({ subjects: [subj('A', addDays(TODAY, 1))], topics, today: TODAY });
  eq(p.daysLeft, 1);
  eq(p.goal, 4);
});

test('skúška dnes sa ešte zobrazí (minimum 1 deň), minulá nie', () => {
  const topics = [topic('A', 1), topic('B', 0)];
  const plans = computeTodayPlan({
    subjects: [subj('A', TODAY), subj('B', addDays(TODAY, -1))], topics, today: TODAY,
  });
  eq(plans.map((p) => p.subjectId), ['A']);
  eq(plans[0].daysLeft, 1);
  eq(plans[0].goal, 2);
});

test('všetko zvládnuté → cieľ 0, žiadne položky', () => {
  const topics = [topic('A', 3), topic('A', 3)];
  const [p] = computeTodayPlan({ subjects: [subj('A', addDays(TODAY, 10))], topics, today: TODAY });
  eq(p.goal, 0);
  eq(p.items, []);
});

test('predmet bez tém → cieľ 0', () => {
  const [p] = computeTodayPlan({ subjects: [subj('A', addDays(TODAY, 10))], topics: [], today: TODAY });
  eq(p.goal, 0);
});

// ---------- Výber tém ----------

test('najprv Zopakované, potom Prejdené, potom Nezačaté (v poradí zoznamu)', () => {
  const t0a = topic('A', 0), t1a = topic('A', 1), t2a = topic('A', 2), t0b = topic('A', 0), t2b = topic('A', 2);
  // 3+2+1+3+1 = 10 krokov, 5 dní → cieľ 2
  const [p] = computeTodayPlan({ subjects: [subj('A', addDays(TODAY, 5))], topics: [t0a, t1a, t2a, t0b, t2b], today: TODAY });
  eq(p.goal, 2);
  eq(p.items.map((i) => i.topicId), [t2a.id, t2b.id]);
});

test('nové témy sa otvárajú až keď rozpracované dostali krok', () => {
  const a = topic('A', 1), b = topic('A', 0), c = topic('A', 0);
  // 2+3+3 = 8 krokov, 4 dni → cieľ 2: Prejdená téma + prvá nezačatá
  const [p] = computeTodayPlan({ subjects: [subj('A', addDays(TODAY, 4))], topics: [b, a, c], today: TODAY });
  eq(p.items.map((i) => [i.topicId, i.steps]), [[a.id, 1], [b.id, 1]]);
});

test('pri veľkom cieli dostane téma viac krokov (×2, ×3)', () => {
  const a = topic('A', 0), b = topic('A', 1);
  // 3+2 = 5 krokov, skúška zajtra → cieľ 5
  const [p] = computeTodayPlan({ subjects: [subj('A', addDays(TODAY, 1))], topics: [a, b], today: TODAY });
  eq(p.items.map((i) => [i.topicId, i.steps]), [[b.id, 2], [a.id, 3]]);
});

test('poradie zoznamu rešpektuje okruhy: bez okruhu, potom okruhy podľa poradia', () => {
  const groups = [{ id: 'g2', subjectId: 'A', order: 1 }, { id: 'g1', subjectId: 'A', order: 0 }];
  const x = topic('A', 0, { groupId: 'g2', order: 0 });
  const y = topic('A', 0, { groupId: 'g1', order: 5 });
  const z = topic('A', 0, { groupId: null, order: 9 });
  eq(orderTopics([x, y, z], groups).map((t) => t.id), [z.id, y.id, x.id]);
  const [p] = computeTodayPlan({ subjects: [subj('A', addDays(TODAY, 9))], topics: [x, y, z], groups, today: TODAY });
  eq(p.goal, 1);
  eq(p.items[0].topicId, z.id);
});

// ---------- Viac predmetov, upozornenia ----------

test('predmety s bližšou skúškou sú vyššie', () => {
  const topics = [topic('A', 0), topic('B', 0), topic('C', 0)];
  const plans = computeTodayPlan({
    subjects: [subj('A', addDays(TODAY, 30)), subj('B', addDays(TODAY, 3)), subj('C', addDays(TODAY, 12))],
    topics, today: TODAY,
  });
  eq(plans.map((p) => p.subjectId), ['B', 'C', 'A']);
});

test('upozornenie, ak do skúšky zostáva 7 dní alebo menej', () => {
  const topics = [topic('A', 0), topic('B', 0)];
  const plans = computeTodayPlan({ subjects: [subj('A', addDays(TODAY, 7)), subj('B', addDays(TODAY, 8))], topics, today: TODAY });
  eq(plans.map((p) => p.warning), [true, false]);
});

// ---------- Stav na začiatku dňa (plán sa počas dňa nemení) ----------

test('stav na začiatku dňa sa berie z prvej dnešnej zmeny', () => {
  const t = topic('A', 2);
  const log = [
    { topicId: t.id, day: addDays(TODAY, -1), from: 0, to: 1 },
    { topicId: t.id, day: TODAY, from: 1, to: 2 },
  ];
  eq(statusAtDayStart(t, log, TODAY), 1);
  eq(statusAtDayStart(t, [], TODAY), 2);
});

test('plán je stabilný: po splnení kroku sa cieľ nezmení', () => {
  const subjects = [subj('A', addDays(TODAY, 3))];
  const a = topic('A', 0), b = topic('A', 0);
  const before = computeTodayPlan({ subjects, topics: [a, b], today: TODAY });
  // Študentka posunula tému a: 0 → 1
  const log = [{ topicId: a.id, day: TODAY, from: 0, to: 1 }];
  const now = [{ ...a, status: 1 }, b].map((t) => ({ ...t, status: statusAtDayStart(t, log, TODAY) }));
  const after = computeTodayPlan({ subjects, topics: now, today: TODAY });
  eq(after, before);
});

test('čistý posun za deň: dopredu +, späť −', () => {
  const log = [
    { topicId: 'x', day: TODAY, from: 0, to: 1 },
    { topicId: 'x', day: TODAY, from: 1, to: 2 },
    { topicId: 'x', day: TODAY, from: 2, to: 1 },
    { topicId: 'y', day: addDays(TODAY, -1), from: 0, to: 1 },
  ];
  eq([...netStepsByTopic(log, TODAY)], [['x', 1]]);
  eq([...forwardStepsByDay(log)], [[TODAY, 2], [addDays(TODAY, -1), 1]]);
});

// ---------- V pláne ----------

test('indikátor „v pláne“ porovná pokrok s rovnomerným postupom', () => {
  const s = { examDate: addDays(TODAY, 10), startDate: addDays(TODAY, -10) }; // koniec dneška = 11/20 času
  eq(scheduleStatus({ subject: s, topics: [topic('A', 0)], today: TODAY }).expected, 11 / 20);
  const fresh = { examDate: addDays(TODAY, 9), startDate: TODAY }; // pridaný dnes → 1/9, nie 0
  eq(scheduleStatus({ subject: fresh, topics: [topic('A', 0)], today: TODAY }).expected, 1 / 9);
  const half = [topic('A', 3), topic('A', 0)]; // 3/6 krokov = 50 %
  eq(scheduleStatus({ subject: s, topics: half, today: TODAY }).state, 'on');
  const low = [topic('A', 1), topic('A', 0)]; // 1/6 ≈ 17 %
  eq(scheduleStatus({ subject: s, topics: low, today: TODAY }).state, 'behind');
  const high = [topic('A', 3), topic('A', 2)]; // 5/6
  eq(scheduleStatus({ subject: s, topics: high, today: TODAY }).state, 'ahead');
  eq(scheduleStatus({ subject: s, topics: [], today: TODAY }), null);
});

// ---------- Pomocné funkcie ----------

test('dátumy: rozdiel dní cez prechod na zimný čas a týždeň od pondelka', () => {
  eq(diffDays('2026-10-24', '2026-10-26'), 2);
  eq(diffDays('2026-12-31', '2027-01-01'), 1);
  eq(startOfWeek('2026-10-13'), '2026-10-12');
  eq(startOfWeek('2026-10-18'), '2026-10-12');
});

test('slovenské tvary: 1 deň, 3 dni, 5 dní', () => {
  eq([1, 3, 5].map((k) => plural(k, 'deň', 'dni', 'dní')), ['deň', 'dni', 'dní']);
  eq([relDays(0), relDays(1), relDays(4), relDays(-2)], ['dnes', 'zajtra', 'o 4 dni', 'pred 2 dňami']);
});

test('hromadné pridanie: riadky, odrážky a čísla sa odstránia, prázdne riadky sa ignorujú', () => {
  const text = '1. Srdce\n- Cievy\n\n  • Pľúca  \nA. carotis\n12) Obličky\n';
  eq(parseTopicLines(text), ['Srdce', 'Cievy', 'Pľúca', 'A. carotis', 'Obličky']);
});
