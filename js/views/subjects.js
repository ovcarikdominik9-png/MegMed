import * as store from '../store.js';
import { esc, icons, pageHeader, emptyState, pct, statusIcon, STATUS } from '../util.js';
import { toDayStr, diffDays, formatLong, relDays } from '../dates.js';
import { openSubjectForm, openBulkAdd } from './forms.js';

export function examLabel(subject, today = toDayStr()) {
  const d = diffDays(today, subject.examDate);
  return `${formatLong(subject.examDate)}${subject.examTime ? ' o ' + esc(subject.examTime) : ''} · ${d < 0 ? 'prebehla ' + relDays(d) : relDays(d)}`;
}

export function renderSubjects(el) {
  const st = store.getState();
  const today = toDayStr();
  const addBtn = `<button class="btn btn-primary" data-act="new">${icons.plus}<span>Nový predmet</span></button>`;

  if (!st.subjects.length) {
    el.innerHTML = pageHeader('Predmety', 'Tu budeš mať všetky predmety a ich témy.') + emptyState({
      title: 'Zatiaľ nemáš žiadny predmet',
      text: 'Začni predmetom, z ktorého máš najbližšiu skúšku. Stačí názov a dátum skúšky, témy pridáš hneď potom – kľudne 20 naraz.',
      action: `<button class="btn btn-primary btn-lg" data-act="new">${icons.plus}<span>Pridať prvý predmet</span></button>`,
    });
  } else {
    const subjects = [...st.subjects].sort((a, b) => {
      const pa = a.examDate < today, pb = b.examDate < today;
      return pa - pb || a.examDate.localeCompare(b.examDate);
    });
    el.innerHTML = pageHeader('Predmety', `${subjects.length} ${subjects.length === 1 ? 'predmet' : subjects.length < 5 ? 'predmety' : 'predmetov'} · zoradené podľa skúšky`, addBtn) + `
      <div class="subject-grid">${subjects.map((s) => subjectCard(s, st, today)).join('')}</div>`;
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'new') {
      openSubjectForm(null, {
        onCreated: (s) => { location.hash = `#/predmet/${s.id}`; setTimeout(() => openBulkAdd(s.id), 350); },
      });
    }
  });
}

function subjectCard(s, st, today) {
  const topics = st.topics.filter((t) => t.subjectId === s.id);
  const counts = [0, 0, 0, 0];
  topics.forEach((t) => counts[t.status]++);
  const n = topics.length;
  const d = diffDays(today, s.examDate);
  const past = d < 0;
  return `<a class="card subject-card ${past ? 'is-past' : ''}" href="#/predmet/${s.id}" style="--c:${esc(s.color)}">
    <div class="subject-card-top">
      <span class="color-dot"></span>
      <h3>${esc(s.name)}</h3>
      ${!past && d <= 7 ? `<span class="chip chip-warn">${icons.warn}${d === 0 ? 'Dnes' : relDays(d)}</span>` : ''}
    </div>
    <p class="muted">Skúška: ${examLabel(s, today)}</p>
    ${n ? `
      <div class="bar-row"><div class="bar"><i style="width:${pct(counts[3] / n)}%"></i></div><b>${pct(counts[3] / n)} %</b></div>
      <p class="muted small">${counts[3]} z ${n} tém zvládnutých</p>
      <div class="mini-counts">${STATUS.map((x, i) => `<span class="mini s${i}" aria-label="${x.label}: ${counts[i]}">${statusIcon(i)}${counts[i]}</span>`).join('')}</div>`
    : `<p class="hint-line">${icons.plus} Zatiaľ bez tém – ťukni a pridaj ich</p>`}
  </a>`;
}
