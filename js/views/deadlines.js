// Deadliny: skúšky z predmetov + ručne pridané termíny.

import * as store from '../store.js';
import { esc, icons, pageHeader, emptyState } from '../util.js';
import { toDayStr, diffDays, formatLong, relDays, plural } from '../dates.js';
import { openEventForm, openSubjectForm } from './forms.js';

export function allDeadlines(st, today) {
  const subj = new Map(st.subjects.map((s) => [s.id, s]));
  const list = [
    ...st.subjects.map((s) => ({
      kind: 'exam', id: s.id, title: `Skúška: ${s.name}`, date: s.examDate, time: s.examTime, color: s.color,
      subjectName: s.name,
      left: st.topics.filter((t) => t.subjectId === s.id && t.status < 3).length,
      total: st.topics.filter((t) => t.subjectId === s.id).length,
    })),
    ...st.events.map((e) => ({
      kind: 'event', id: e.id, title: e.title, date: e.date, time: e.time,
      color: subj.get(e.subjectId)?.color, subjectName: subj.get(e.subjectId)?.name,
    })),
  ];
  list.forEach((d) => { d.days = diffDays(today, d.date); });
  return list.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
}

export function upcomingDeadlines(st, today) {
  return allDeadlines(st, today).filter((d) => d.days >= 0);
}

export function renderDeadlines(el) {
  const st = store.getState();
  const today = toDayStr();
  const all = allDeadlines(st, today);
  const upcoming = all.filter((d) => d.days >= 0);
  const past = all.filter((d) => d.days < 0).reverse();
  const addBtn = `<button class="btn btn-primary" data-act="new-event">${icons.plus}<span>Pridať termín</span></button>`;

  el.innerHTML = pageHeader('Deadliny', 'Skúšky z predmetov sa pridávajú automaticky. Testy, odovzdania a iné termíny pridáš ručne.', addBtn) + (
    all.length ? `
      <section class="dl-list">${upcoming.length ? upcoming.map((d) => row(d)).join('') : '<p class="muted card pad">Žiadne nadchádzajúce termíny.</p>'}</section>
      ${past.length ? `<h2 class="section-title muted">Minulé</h2><section class="dl-list past">${past.map((d) => row(d)).join('')}</section>` : ''}`
      : emptyState({
        title: 'Zatiaľ žiadne termíny',
        text: 'Keď pridáš predmet s dátumom skúšky, objaví sa tu automaticky. Môžeš si sem pridať aj testy, zápočty či odovzdanie seminárky.',
        action: `<div class="empty-actions"><button class="btn btn-primary btn-lg" data-act="new-event">${icons.plus}<span>Pridať termín</span></button>
          <button class="btn btn-ghost btn-lg" data-act="new-subject">Pridať predmet</button></div>`,
      }));

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'new-event') openEventForm();
    if (b.dataset.act === 'new-subject') openSubjectForm(null, { onCreated: (s) => { location.hash = `#/predmet/${s.id}`; } });
    if (b.dataset.act === 'open-event') openEventForm(store.getState().events.find((x) => x.id === b.dataset.id));
  });
}

function row(d) {
  const isPast = d.days < 0;
  const count = isPast
    ? `<div class="count-box"><b>${-d.days}</b><span>${plural(d.days, 'deň', 'dni', 'dní')} späť</span></div>`
    : d.days === 0 ? '<div class="count-box soon"><b>!</b><span>dnes</span></div>'
      : `<div class="count-box ${d.days <= 7 ? 'soon' : ''}"><b>${d.days}</b><span>${plural(d.days, 'deň', 'dni', 'dní')}</span></div>`;
  const inner = `${count}
    <div class="dl-main">
      <span class="dl-title">${esc(d.title)}</span>
      <span class="muted small">${formatLong(d.date)}${d.time ? ' · ' + esc(d.time) : ''} · ${relDays(d.days)}${d.kind === 'event' && d.subjectName ? ' · ' + esc(d.subjectName) : ''}</span>
      ${d.kind === 'exam' && d.total ? `<span class="dl-left ${d.left ? '' : 'ok'}">${d.left ? `Do stavu Zvládnuté zostáva <b>${d.left}</b> z ${d.total} tém` : `${icons.check}Všetkých ${d.total} tém zvládnutých`}</span>` : ''}
      ${d.kind === 'exam' && !d.total ? '<span class="dl-left">Predmet zatiaľ nemá témy</span>' : ''}
    </div>
    <span class="chip ${d.kind === 'exam' ? 'chip-exam' : ''}">${d.kind === 'exam' ? 'Skúška' : 'Termín'}</span>`;
  const style = `style="--c:${esc(d.color || 'var(--pink)')}"`;
  return d.kind === 'exam'
    ? `<a class="card dl-row ${isPast ? 'is-past' : ''}" href="#/predmet/${d.id}" ${style}>${inner}</a>`
    : `<button class="card dl-row ${isPast ? 'is-past' : ''}" data-act="open-event" data-id="${d.id}" ${style}>${inner}</button>`;
}
