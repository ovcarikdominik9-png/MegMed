// Detail predmetu: zoznam tém s okruhmi, stav jedným ťuknutím, vyhľadávanie, filter, ťahanie.

import * as store from '../store.js';
import { esc, icons, emptyState, pct, statusPill, statusIcon, STATUS } from '../util.js';
import { toDayStr, diffDays } from '../dates.js';
import { orderTopics } from '../plan.js';
import { openSubjectForm, openBulkAdd, openGroupForm, groupMenu, topicMenu, openTopicEditor } from './forms.js';
import { onLongPress, enableDragSort } from '../ui/gestures.js';
import { toast } from '../ui/sheet.js';
import { examLabel } from './subjects.js';

// Vyhľadávanie a filter si pamätáme pre každý predmet (prežijú prekreslenie).
const uiState = new Map();

export function renderSubject(el, id) {
  const st = store.getState();
  const subj = st.subjects.find((s) => s.id === id);
  if (!subj) {
    el.innerHTML = emptyState({
      title: 'Predmet sa nenašiel', text: 'Možno bol zmazaný.',
      action: '<a class="btn btn-primary" href="#/predmety">Späť na predmety</a>',
    });
    return;
  }
  const ui = uiState.get(id) || { q: '', filter: 'all' };
  uiState.set(id, ui);
  const today = toDayStr();
  const topics = st.topics.filter((t) => t.subjectId === id);
  const counts = [0, 0, 0, 0];
  topics.forEach((t) => counts[t.status]++);
  const n = topics.length;
  const d = diffDays(today, subj.examDate);

  el.innerHTML = `
    <a class="back-link" href="#/predmety">${icons.back}<span>Predmety</span></a>
    <header class="page-head subject-head" style="--c:${esc(subj.color)}">
      <div>
        <h1 class="page-title"><span class="color-dot big"></span>${esc(subj.name)}</h1>
        <p class="page-sub">Skúška: ${examLabel(subj, today)}
          ${d >= 0 && d <= 7 ? `<span class="chip chip-warn">${icons.warn}Menej ako týždeň</span>` : ''}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" data-act="edit-subject">Upraviť predmet</button>
        <button class="btn btn-primary" data-act="bulk">${icons.plus}<span>Pridať témy</span></button>
      </div>
    </header>
    ${n ? `
    <section class="card subject-summary">
      <div class="bar-row big"><div class="bar"><i style="width:${pct(counts[3] / n)}%"></i></div><b>${pct(counts[3] / n)} %</b></div>
      <p class="muted">${counts[3]} z ${n} tém zvládnutých</p>
    </section>
    <div class="toolbar">
      <label class="search">${icons.search}<input type="search" placeholder="Hľadať tému alebo poznámku" value="${esc(ui.q)}" data-search enterkeyhint="search"></label>
      <button class="btn btn-ghost" data-act="new-group">${icons.plus}<span>Okruh</span></button>
    </div>
    <div class="filter-chips" role="group" aria-label="Filter podľa stavu">
      <button class="fchip ${ui.filter === 'all' ? 'on' : ''}" data-filter="all">Všetky <b>${n}</b></button>
      ${STATUS.map((s, i) => `<button class="fchip s${i} ${ui.filter === String(i) ? 'on' : ''}" data-filter="${i}">${statusIcon(i)}${s.label} <b>${counts[i]}</b></button>`).join('')}
    </div>
    <p class="gesture-hint">Ťuknutím na stav ho posunieš ďalej · podrž tému pre zmenu stavu, úpravu alebo zmazanie · ťahaj za ⠿ pre zmenu poradia</p>
    <div class="topic-list" data-list></div>
    ` : emptyState({
      title: 'Pridaj témy tohto predmetu',
      text: 'Skopíruj zoznam tém z prezentácie, sylabu alebo obsahu knihy a vlož ho naraz – každá téma na nový riadok. Okruhy môžeš pridať neskôr.',
      action: `<button class="btn btn-primary btn-lg" data-act="bulk">${icons.plus}<span>Vložiť zoznam tém</span></button>`,
    })}`;

  const list = el.querySelector('[data-list]');
  if (list) renderList(list, subj, ui);

  el.addEventListener('input', (e) => {
    if (e.target.matches('[data-search]')) {
      ui.q = e.target.value;
      renderList(list, subj, ui);
    }
  });

  el.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) {
      ui.filter = f.dataset.filter;
      el.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('on', b === f));
      renderList(list, subj, ui);
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const row = b.closest('[data-id]');
    switch (b.dataset.act) {
      case 'edit-subject': openSubjectForm(subj); break;
      case 'bulk': openBulkAdd(subj.id); break;
      case 'new-group': openGroupForm(subj.id); break;
      case 'group-menu': {
        const g = store.getState().groups.find((x) => x.id === b.closest('[data-group]').dataset.group);
        if (g) groupMenu(g);
        break;
      }
      case 'advance': {
        const t = store.getState().topics.find((x) => x.id === row.dataset.id);
        if (t?.status === 3) toast('Téma je už zvládnutá. Podrž ju, ak chceš stav zmeniť.');
        else store.advanceTopic(row.dataset.id);
        break;
      }
      case 'edit': openTopicEditor(row.dataset.id); break;
      case 'menu': topicMenu(row.dataset.id); break;
    }
  });

  if (list) {
    onLongPress(list, '.topic-row', (row) => topicMenu(row.dataset.id));
    enableDragSort(list, {
      itemSel: '.topic-row',
      headerSel: '.group-head',
      onDrop: (seq) => store.reorderTopics(seq),
    });
  }
}

function renderList(list, subj, ui) {
  const st = store.getState();
  const groups = st.groups.filter((g) => g.subjectId === subj.id).sort((a, b) => a.order - b.order);
  const all = orderTopics(st.topics.filter((t) => t.subjectId === subj.id), groups);
  const q = ui.q.trim().toLocaleLowerCase('sk');
  const filtering = q !== '' || ui.filter !== 'all';
  const match = (t) => (ui.filter === 'all' || String(t.status) === ui.filter)
    && (!q || t.title.toLocaleLowerCase('sk').includes(q) || (t.note || '').toLocaleLowerCase('sk').includes(q));

  list.classList.toggle('no-drag', filtering);
  const sections = [{ id: '', name: 'Bez okruhu', g: null }, ...groups.map((g) => ({ id: g.id, name: g.name, g }))];
  let html = '';
  let shown = 0;
  for (const sec of sections) {
    const inSec = all.filter((t) => (t.groupId || '') === sec.id);
    const visible = inSec.filter(match);
    shown += visible.length;
    if (sec.id === '') {
      // Hlavička „Bez okruhu“ je v DOM vždy (slúži ako začiatok zoznamu pre ťahanie), zobrazí sa len ak existujú okruhy.
      html += `<div class="group-head ungrouped ${groups.length && inSec.length ? '' : 'is-hidden'}" data-group="">
        <span class="group-name">Bez okruhu</span></div>`;
    } else {
      if (filtering && !visible.length) continue;
      const done = inSec.filter((t) => t.status === 3).length;
      html += `<div class="group-head" data-group="${sec.id}">
        <span class="group-name">${esc(sec.name)}</span>
        <span class="group-count">${done}/${inSec.length}</span>
        <button class="icon-btn" data-act="group-menu" aria-label="Možnosti okruhu ${esc(sec.name)}">${icons.more}</button>
      </div>`;
      if (!inSec.length && !filtering) html += '<div class="group-empty">Prázdny okruh – presuň sem témy ťahaním alebo cez menu okruhu.</div>';
    }
    html += visible.map(topicRow).join('');
  }
  if (filtering && !shown) html += '<p class="list-empty">Žiadna téma nezodpovedá hľadaniu alebo filtru.</p>';
  list.innerHTML = html;
}

function topicRow(t) {
  const next = t.status < 3 ? STATUS[t.status + 1].label : null;
  return `<div class="topic-row" data-id="${t.id}">
    <button class="drag-handle" data-drag aria-label="Presunúť tému">${icons.grip}</button>
    <button class="topic-main" data-act="edit">
      <span class="topic-title">${esc(t.title)}</span>
      ${t.note ? `<span class="topic-note">${esc(t.note)}</span>` : ''}
    </button>
    <button class="status-btn" data-act="advance" aria-label="Stav ${STATUS[t.status].label}${next ? '. Ťuknutím posunieš na ' + next : ''}">
      ${statusPill(t.status)}
    </button>
    <button class="icon-btn" data-act="menu" aria-label="Možnosti témy">${icons.more}</button>
  </div>`;
}
