// Čisté funkcie pre výpočet „Dnes“ a pokroku. Žiadny DOM, žiadne „teraz“ – dnešný deň sa vždy odovzdáva.
// Testy: tests/plan.test.js

import { diffDays } from './dates.js';

/** Zostávajúce kroky podľa stavu: Nezačaté 3, Prejdené 2, Zopakované 1, Zvládnuté 0 */
export const STEPS_LEFT = [3, 2, 1, 0];

/** Poradie tém tak, ako sú v zozname: najprv témy bez okruhu, potom okruhy podľa poradia. */
export function orderTopics(topics, groups = []) {
  const gOrder = new Map(groups.map((g) => [g.id, g.order]));
  const key = (t) => (t.groupId && gOrder.has(t.groupId) ? gOrder.get(t.groupId) : -Infinity);
  return [...topics].sort((a, b) => {
    const ka = key(a), kb = key(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.order - b.order;
  });
}

/**
 * Dnešný plán.
 * Pre každý predmet so skúškou dnes alebo neskôr:
 *  - zostávajúce kroky = súčet STEPS_LEFT všetkých tém,
 *  - dni = počet dní od dneška do skúšky (dnešok sa počíta, deň skúšky nie; minimum 1),
 *  - cieľ = ceil(kroky / dni),
 *  - kroky sa rozdelia na témy: najprv Zopakované, potom Prejdené, potom Nezačaté (v poradí zoznamu),
 *    každá téma najprv 1 krok; ak cieľ ešte nie je naplnený, dostanú v rovnakom poradí ďalší krok.
 *
 * `topics` majú mať stav zo začiatku dňa (pozri statusAtDayStart), aby sa plán počas dňa nemenil.
 */
export function computeTodayPlan({ subjects, topics, groups = [], today }) {
  const plans = [];
  for (const s of subjects) {
    const daysUntil = diffDays(today, s.examDate);
    if (daysUntil < 0) continue;
    const daysLeft = Math.max(1, daysUntil);
    const list = orderTopics(
      topics.filter((t) => t.subjectId === s.id),
      groups.filter((g) => g.subjectId === s.id),
    );
    const remainingSteps = list.reduce((sum, t) => sum + STEPS_LEFT[t.status], 0);
    const goal = Math.ceil(remainingSteps / daysLeft);

    const queue = [2, 1, 0].flatMap((st) => list.filter((t) => t.status === st));
    const steps = new Map();
    let left = goal;
    for (let pass = 1; pass <= 3 && left > 0; pass++) {
      for (const t of queue) {
        if (left === 0) break;
        if (STEPS_LEFT[t.status] >= pass) {
          steps.set(t.id, (steps.get(t.id) || 0) + 1);
          left--;
        }
      }
    }
    const items = queue
      .filter((t) => steps.has(t.id))
      .map((t) => ({ topicId: t.id, steps: steps.get(t.id), startStatus: t.status }));

    plans.push({
      subjectId: s.id,
      examDate: s.examDate,
      examTime: s.examTime || null,
      daysUntil,
      daysLeft,
      remainingSteps,
      goal,
      warning: daysUntil <= 7,
      items,
    });
  }
  plans.sort((a, b) =>
    a.examDate.localeCompare(b.examDate) || (a.examTime || '').localeCompare(b.examTime || ''));
  return plans;
}

/** Stav témy na začiatku dňa `day` podľa záznamu zmien. */
export function statusAtDayStart(topic, log, day) {
  const first = log.find((e) => e.topicId === topic.id && e.day === day);
  return first ? first.from : topic.status;
}

/** Čistý posun stavu za deň pre každú tému (posun dopredu +, vrátenie −). */
export function netStepsByTopic(log, day) {
  const m = new Map();
  for (const e of log) {
    if (e.day !== day) continue;
    m.set(e.topicId, (m.get(e.topicId) || 0) + (e.to - e.from));
  }
  return m;
}

/** Počet krokov dopredu za každý deň (pre heatmapu a týždenný prehľad). */
export function forwardStepsByDay(log) {
  const m = new Map();
  for (const e of log) {
    if (e.to > e.from) m.set(e.day, (m.get(e.day) || 0) + (e.to - e.from));
  }
  return m;
}

/**
 * Je študentka v pláne? Porovná skutočný pokrok (v krokoch) s rovnomerným postupom
 * od `startDate` predmetu po deň skúšky – očakávaný stav ku koncu dneška.
 */
export function scheduleStatus({ subject, topics, today }) {
  const n = topics.length;
  if (n === 0) return null;
  const done = topics.reduce((sum, t) => sum + t.status, 0);
  const actual = done / (3 * n);
  // Kde by mala byť na konci dneška: dni učenia sú od startDate po deň pred skúškou.
  const total = diffDays(subject.startDate || today, subject.examDate);
  const elapsed = diffDays(subject.startDate || today, today) + 1;
  const expected = total <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / total));
  let state;
  if (actual >= 1) state = 'done';
  else if (actual >= expected + 0.1) state = 'ahead';
  else if (actual >= expected - 0.05) state = 'on';
  else if (actual >= expected - 0.15) state = 'slightly';
  else state = 'behind';
  return { actual, expected, state };
}
