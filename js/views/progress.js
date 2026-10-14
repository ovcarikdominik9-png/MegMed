// Pokrok: progress bar každého predmetu, indikátor „v pláne“, týždenný prehľad a heatmapa.

import * as store from '../store.js';
import { esc, icons, pageHeader, emptyState, pct, statusIcon, STATUS } from '../util.js';
import { toDayStr, diffDays, addDays, startOfWeek, relDays, plural, MONTHS_SHORT, parseDay, formatLong } from '../dates.js';
import { scheduleStatus, forwardStepsByDay } from '../plan.js';
import { openSubjectForm } from './forms.js';

const WEEKS = 26;

const SCHEDULE_LABEL = {
  done: { text: 'Hotovo', cls: 'ok' },
  ahead: { text: 'Napred', cls: 'ok' },
  on: { text: 'V pláne', cls: 'ok' },
  slightly: { text: 'Mierne pozadu', cls: 'warn' },
  behind: { text: 'Pozadu', cls: 'bad' },
};

export function renderProgress(el) {
  const st = store.getState();
  const today = toDayStr();
  if (!st.subjects.length) {
    el.innerHTML = pageHeader('Pokrok') + emptyState({
      title: 'Pokrok uvidíš po pridaní predmetu',
      text: 'Pridaj predmet a témy. Každé posunutie stavu témy sa tu započíta do týždenného prehľadu a heatmapy.',
      action: `<button class="btn btn-primary btn-lg" data-act="new-subject">${icons.plus}<span>Pridať predmet</span></button>`,
    });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-act="new-subject"]')) openSubjectForm(null, { onCreated: (s) => { location.hash = `#/predmet/${s.id}`; } });
    });
    return;
  }

  const byDay = forwardStepsByDay(st.log);
  const weekStart = startOfWeek(today);
  let weekSteps = 0, activeDays = 0, lastWeekSteps = 0;
  for (let i = 0; i < 7; i++) {
    const n = byDay.get(addDays(weekStart, i)) || 0;
    weekSteps += n;
    if (n > 0) activeDays++;
    lastWeekSteps += byDay.get(addDays(weekStart, i - 7)) || 0;
  }
  const daysSoFar = diffDays(weekStart, today) + 1;

  const subjects = [...st.subjects].sort((a, b) => {
    const pa = a.examDate < today, pb = b.examDate < today;
    return pa - pb || a.examDate.localeCompare(b.examDate);
  });

  el.innerHTML = pageHeader('Pokrok', 'Ako ti to ide v jednotlivých predmetoch a ako pravidelne sa učíš.') + `
    <div class="progress-top">
      <section class="card week-card">
        <div class="card-head"><h2>Tento týždeň</h2></div>
        <div class="week-stats">
          <div class="stat"><b>${weekSteps}</b><span>${plural(weekSteps, 'krok', 'kroky', 'krokov')} splnených</span></div>
          <div class="stat"><b>${activeDays}<small>/${daysSoFar}</small></b><span>${plural(activeDays, 'deň', 'dni', 'dní')} s učením</span></div>
          <div class="stat"><b>${lastWeekSteps}</b><span>krokov minulý týždeň</span></div>
        </div>
      </section>
      <section class="card heat-card">
        <div class="card-head"><h2>Konzistencia</h2><span class="muted small">posledných ${WEEKS} týždňov</span></div>
        ${heatmap(byDay, today)}
      </section>
    </div>
    <h2 class="section-title">Predmety</h2>
    <div class="subject-progress">${subjects.map((s) => subjectProgress(s, st, today)).join('')}</div>`;
  requestAnimationFrame(() => {
    const hm = el.querySelector('.heatmap');
    if (hm) hm.scrollLeft = hm.scrollWidth;
  });
}

function subjectProgress(s, st, today) {
  const topics = st.topics.filter((t) => t.subjectId === s.id);
  const counts = [0, 0, 0, 0];
  topics.forEach((t) => counts[t.status]++);
  const n = topics.length;
  const d = diffDays(today, s.examDate);
  const sch = scheduleStatus({ subject: s, topics, today });
  const lab = sch && SCHEDULE_LABEL[sch.state];
  return `<a class="card sp-card" href="#/predmet/${s.id}" style="--c:${esc(s.color)}">
    <div class="sp-head">
      <span class="color-dot"></span><h3>${esc(s.name)}</h3>
      <span class="sp-days ${d >= 0 && d <= 7 ? 'soon' : ''}">${d < 0 ? 'skúška prebehla' : d === 0 ? 'skúška dnes' : `<b>${d}</b> ${plural(d, 'deň', 'dni', 'dní')} do skúšky`}</span>
    </div>
    ${n ? `
      <div class="bar-row big"><div class="bar"><i style="width:${pct(counts[3] / n)}%"></i></div><b>${pct(counts[3] / n)} %</b></div>
      <p class="muted small">${counts[3]} z ${n} tém zvládnutých</p>
      <div class="stack" aria-hidden="true">${counts.map((c, i) => c ? `<i class="s${i}" style="flex:${c}"></i>` : '').join('')}</div>
      <div class="mini-counts">${STATUS.map((x, i) => `<span class="mini s${i}">${statusIcon(i)}${x.label} ${counts[i]}</span>`).join('')}</div>
      ${lab && d >= 0 ? `<div class="schedule ${lab.cls}"><span class="schedule-badge">${lab.text}</span>
        <span>${sch.state === 'done' ? 'Všetko zvládnuté.' : `Pri rovnomernom postupe by si mala mať do konca dneška ${pct(sch.expected)} % krokov, máš ${pct(sch.actual)} %.`}</span></div>` : ''}`
    : '<p class="muted">Predmet zatiaľ nemá témy.</p>'}
  </a>`;
}

function level(n) {
  if (!n) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 9) return 3;
  return 4;
}

function heatmap(byDay, today) {
  const first = addDays(startOfWeek(today), -7 * (WEEKS - 1));
  let cols = '';
  let months = '';
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const weekStart = addDays(first, 7 * w);
    const m = parseDay(weekStart).getMonth();
    months += `<span>${m !== lastMonth ? MONTHS_SHORT[m] : ''}</span>`;
    lastMonth = m;
    let cells = '';
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const future = day > today;
      const n = byDay.get(day) || 0;
      cells += `<i class="hm l${future ? 'f' : level(n)} ${day === today ? 'today' : ''}" aria-label="${formatLong(day)}: ${n} krokov"></i>`;
    }
    cols += `<div class="hm-col">${cells}</div>`;
  }
  return `<div class="heatmap" style="--weeks:${WEEKS}">
    <div class="hm-months">${months}</div>
    <div class="hm-body">
      <div class="hm-days"><span>Po</span><span></span><span>St</span><span></span><span>Pi</span><span></span><span>Ne</span></div>
      <div class="hm-grid">${cols}</div>
    </div>
    <div class="hm-legend"><span>menej</span><i class="hm l0"></i><i class="hm l1"></i><i class="hm l2"></i><i class="hm l3"></i><i class="hm l4"></i><span>viac</span></div>
  </div>`;
}

