// Dnes: pozdrav, výstrahy, čo sa dnes učiť, najbližšie termíny, dnešný pokrok.

import * as store from '../store.js';
import { esc, icons, pct, statusPill, STATUS } from '../util.js';
import { toDayStr, diffDays, formatLong, formatShort, relDays, greeting, plural } from '../dates.js';
import { openSubjectForm, openBulkAdd, topicMenu } from './forms.js';
import { onLongPress } from '../ui/gestures.js';
import { upcomingDeadlines } from './deadlines.js';

export function renderToday(el) {
  const st = store.getState();
  const today = toDayStr();
  const plan = store.getTodayPlan(today);
  const net = store.getNetToday(today);
  const subjById = new Map(st.subjects.map((s) => [s.id, s]));
  const topicById = new Map(st.topics.map((t) => [t.id, t]));

  // Splnené kroky: čistý posun tém predmetu za dnešok, najviac po dnešný cieľ.
  let goalTotal = 0, doneTotal = 0;
  const perSubject = plan.map((p) => {
    let done = 0;
    for (const t of st.topics) if (t.subjectId === p.subjectId) done += Math.max(0, net.get(t.id) || 0);
    done = Math.min(done, p.goal);
    goalTotal += p.goal;
    doneTotal += done;
    return { ...p, done };
  });

  el.innerHTML = `
    <section class="hero">
      <h1 class="hero-title">${greeting()}</h1>
      <p class="hero-date">${capitalize(formatLong(today))}</p>
    </section>
    ${alerts(st, today)}
    ${st.subjects.length ? `
    <div class="today-grid">
      <section class="card learn-card">
        <div class="card-head"><h2>Čo sa dnes učiť</h2>${goalTotal ? `<span class="chip">${doneTotal}/${goalTotal} ${plural(goalTotal, 'krok', 'kroky', 'krokov')}</span>` : ''}</div>
        ${learnList(perSubject, subjById, topicById, net, st)}
      </section>
      <div class="side-col">
        <section class="card progress-card">
          <div class="card-head"><h2>Dnešný pokrok</h2></div>
          ${goalTotal ? `
            <div class="big-num"><b>${doneTotal}</b><span>/ ${goalTotal} ${plural(goalTotal, 'krok', 'kroky', 'krokov')}</span></div>
            <div class="bar big"><i style="width:${pct(doneTotal / goalTotal)}%"></i></div>
            <p class="muted small">${doneTotal >= goalTotal ? 'Dnešný cieľ je splnený. Výborne! 🌸' : `Ešte ${goalTotal - doneTotal} ${plural(goalTotal - doneTotal, 'krok', 'kroky', 'krokov')} do dnešného cieľa.`}</p>
            <ul class="sub-progress">${perSubject.filter((p) => p.goal).map((p) => {
              const s = subjById.get(p.subjectId);
              return `<li style="--c:${esc(s.color)}"><span class="color-dot"></span><span class="name">${esc(s.name)}</span><span class="val">${p.done}/${p.goal}</span></li>`;
            }).join('')}</ul>`
          : '<p class="muted">Na dnes nie je naplánovaný žiadny krok.</p>'}
        </section>
        <section class="card next-card">
          <div class="card-head"><h2>Najbližšie skúšky a termíny</h2><a class="link" href="#/deadliny">Všetky</a></div>
          ${nextDeadlines(st, today)}
        </section>
      </div>
    </div>` : welcome()}
  `;

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'new-subject') {
      openSubjectForm(null, { onCreated: (s) => { location.hash = `#/predmet/${s.id}`; setTimeout(() => openBulkAdd(s.id), 350); } });
    } else if (act === 'advance') {
      const id = b.closest('[data-id]').dataset.id;
      if (!store.advanceTopic(id)) topicMenu(id);
    } else if (act === 'bulk') {
      openBulkAdd(b.dataset.subject);
    } else if (act === 'edit-subject') {
      openSubjectForm(subjById.get(b.dataset.subject));
    } else if (act === 'dismiss-past') {
      store.updateSubject(b.dataset.subject, { pastAlertDismissed: true });
    }
  });
  onLongPress(el, '.plan-item', (row) => topicMenu(row.dataset.id));
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function welcome() {
  return `<section class="card welcome">
    <h2>Vitaj v MegMed 🌸</h2>
    <p>Táto appka ti každý deň povie, <b>čo sa máš dnes učiť</b>, <b>čo už máš zvládnuté</b> a <b>čo horí</b>.</p>
    <ol class="steps">
      <li><b>Pridaj predmet</b> s dátumom skúšky.</li>
      <li><b>Vlož zoznam tém</b> – naraz, každú na nový riadok.</li>
      <li>Každý deň otvor <b>Dnes</b> a ťukaním posúvaj témy: Nezačaté → Prejdené → Zopakované → Zvládnuté.</li>
    </ol>
    <button class="btn btn-primary btn-lg" data-act="new-subject">${icons.plus}<span>Pridať prvý predmet</span></button>
  </section>`;
}

function alerts(st, today) {
  const out = [];
  for (const s of st.subjects) {
    const d = diffDays(today, s.examDate);
    const time = s.examTime ? ` o ${esc(s.examTime)}` : '';
    if (d === 0) {
      out.push(`<div class="alert hot" style="--c:${esc(s.color)}">${icons.warn}<div><b>Dnes${time} máš skúšku: ${esc(s.name)}.</b> Veľa šťastia! 🍀</div></div>`);
    } else if (d === 1) {
      out.push(`<div class="alert hot" style="--c:${esc(s.color)}">${icons.warn}<div><b>Zajtra${time} máš skúšku: ${esc(s.name)}.</b> ${remainingText(st, s)}</div></div>`);
    } else if (d < 0 && !s.pastAlertDismissed) {
      out.push(`<div class="alert past">${icons.warn}<div><b>Skúška z predmetu ${esc(s.name)} bola ${formatShort(s.examDate, today)} (${relDays(d)}).</b> Máš opravný termín? Zadaj nový dátum, nech appka znova plánuje.</div>
        <div class="alert-actions"><button class="btn btn-sm btn-primary" data-act="edit-subject" data-subject="${s.id}">Nový termín</button>
        <button class="btn btn-sm btn-ghost" data-act="dismiss-past" data-subject="${s.id}">Skryť</button></div></div>`);
    }
  }
  for (const e of st.events) {
    const d = diffDays(today, e.date);
    if (d === 0 || d === 1) {
      const s = st.subjects.find((x) => x.id === e.subjectId);
      out.push(`<div class="alert hot">${icons.calendar}<div><b>${d === 0 ? 'Dnes' : 'Zajtra'}${e.time ? ' o ' + esc(e.time) : ''}: ${esc(e.title)}</b>${s ? ' · ' + esc(s.name) : ''}</div></div>`);
    }
  }
  return out.length ? `<div class="alerts">${out.join('')}</div>` : '';
}

function remainingText(st, s) {
  const left = st.topics.filter((t) => t.subjectId === s.id && t.status < 3).length;
  return left ? `Do stavu Zvládnuté ti zostáva ${left} ${plural(left, 'téma', 'témy', 'tém')}.` : 'Všetky témy máš zvládnuté. 💪';
}

function learnList(perSubject, subjById, topicById, net, st) {
  if (!perSubject.length) {
    return `<div class="inline-empty"><p>Žiadny predmet nemá skúšku pred sebou.</p>
      <p class="muted small">Ak máš opravný termín, uprav dátum skúšky v predmete.</p></div>`;
  }
  return perSubject.map((p) => {
    const s = subjById.get(p.subjectId);
    const nTopics = st.topics.filter((t) => t.subjectId === s.id).length;
    const head = `<div class="plan-subject-head" style="--c:${esc(s.color)}">
      <span class="color-dot"></span>
      <a class="plan-subject-name" href="#/predmet/${s.id}">${esc(s.name)}</a>
      ${p.warning ? `<span class="chip chip-warn">${icons.warn}skúška ${p.daysUntil === 0 ? 'dnes' : relDays(p.daysUntil)}</span>` : `<span class="muted small">skúška ${relDays(p.daysUntil)}</span>`}
      ${p.goal ? `<span class="plan-goal">${p.done}/${p.goal}</span>` : ''}
    </div>`;
    if (!nTopics) {
      return `<div class="plan-subject">${head}<div class="plan-empty">Predmet zatiaľ nemá témy.
        <button class="btn btn-sm btn-primary" data-act="bulk" data-subject="${s.id}">${icons.plus}<span>Pridať témy</span></button></div></div>`;
    }
    if (!p.goal) {
      return `<div class="plan-subject">${head}<div class="plan-empty">Všetky témy sú zvládnuté. ✨</div></div>`;
    }
    return `<div class="plan-subject">${head}<div class="plan-items">${p.items.map((it) => planItem(it, topicById, net, st)).join('')}</div></div>`;
  }).join('');
}

function planItem(it, topicById, net, st) {
  const t = topicById.get(it.topicId);
  if (!t) return '';
  const did = Math.max(0, net.get(t.id) || 0);
  const done = did >= it.steps || t.status === 3;
  const group = t.groupId ? st.groups.find((g) => g.id === t.groupId) : null;
  const sub = [group?.name, t.note].filter(Boolean).map(esc).join(' · ');
  return `<div class="plan-item ${done ? 'done' : ''}" data-id="${t.id}">
    <div class="plan-item-main">
      <span class="plan-item-title">${esc(t.title)}${it.steps > 1 ? ` <span class="chip chip-steps">${Math.min(did, it.steps)}/${it.steps} kroky</span>` : ''}</span>
      ${sub ? `<span class="plan-item-sub">${sub}</span>` : ''}
    </div>
    ${statusPill(t.status)}
    ${done
      ? `<span class="done-mark">${icons.check}<span>Splnené</span></span>`
      : `<button class="btn advance-btn" data-act="advance" aria-label="Posunúť na ${STATUS[t.status + 1]?.label}">${icons.arrow}<span>${STATUS[t.status + 1]?.label}</span></button>`}
  </div>`;
}

function nextDeadlines(st, today) {
  const list = upcomingDeadlines(st, today).slice(0, 3);
  if (!list.length) {
    return '<p class="muted">Žiadne nadchádzajúce termíny.</p>';
  }
  return `<ul class="next-list">${list.map((d) => `
    <li style="--c:${esc(d.color || 'var(--pink)')}">
      <div class="count-box ${d.days <= 7 ? 'soon' : ''}"><b>${d.days === 0 ? '!' : d.days}</b><span>${d.days === 0 ? 'dnes' : plural(d.days, 'deň', 'dni', 'dní')}</span></div>
      <div class="next-main"><span class="next-title">${esc(d.title)}</span>
      <span class="muted small">${formatShort(d.date, today)}${d.time ? ' · ' + esc(d.time) : ''}${d.kind === 'exam' ? ' · skúška' : ''}</span></div>
    </li>`).join('')}</ul>`;
}
