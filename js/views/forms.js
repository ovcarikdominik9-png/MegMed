// Formuláre a menu zdieľané medzi obrazovkami.

import * as store from '../store.js';
import { openSheet, confirmDialog, actionMenu, toast } from '../ui/sheet.js';
import { esc, SUBJECT_COLORS, STATUS, statusIcon } from '../util.js';
import { toDayStr, plural } from '../dates.js';

// ---------- Predmet ----------

export function openSubjectForm(subject = null, { onCreated } = {}) {
  const st = store.getState();
  const color = subject?.color || SUBJECT_COLORS[st.subjects.length % SUBJECT_COLORS.length];
  openSheet({
    title: subject ? 'Upraviť predmet' : 'Nový predmet',
    html: `<form class="form" novalidate>
      <label class="field"><span>Názov predmetu</span>
        <input name="name" required maxlength="80" value="${esc(subject?.name)}" placeholder="napr. Anatómia 2" autocomplete="off"></label>
      <fieldset class="field"><legend>Farba</legend>
        <div class="swatches">${SUBJECT_COLORS.map((c) => `
          <label class="swatch" style="--c:${c}"><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''} aria-label="Farba ${c}"><span></span></label>`).join('')}
        </div></fieldset>
      <div class="field-row">
        <label class="field"><span>Dátum skúšky</span>
          <input type="date" name="examDate" required value="${esc(subject?.examDate || '')}"></label>
        <label class="field"><span>Čas skúšky <em>(nepovinné)</em></span>
          <input type="time" name="examTime" value="${esc(subject?.examTime || '')}"></label>
      </div>
      <p class="form-error" hidden></p>
      <div class="form-actions">
        ${subject ? '<button type="button" class="btn btn-danger-ghost" data-delete>Zmazať predmet</button><span class="spacer"></span>' : ''}
        <button type="button" class="btn btn-ghost" data-close>Zrušiť</button>
        <button type="submit" class="btn btn-primary">${subject ? 'Uložiť' : 'Pridať predmet'}</button>
      </div>
    </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const err = el.querySelector('.form-error');
      if (!subject) setTimeout(() => form.elements.name.focus(), 250);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          name: form.elements.name.value.trim(),
          color: form.elements.color.value,
          examDate: form.elements.examDate.value,
          examTime: form.elements.examTime.value,
        };
        if (!data.name) return showErr(err, 'Zadaj názov predmetu.');
        if (!data.examDate) return showErr(err, 'Dátum skúšky je povinný – podľa neho appka počíta denný plán.');
        if (subject) {
          store.updateSubject(subject.id, data);
          toast('Predmet uložený');
        } else {
          const s = store.addSubject(data);
          toast('Predmet pridaný');
          onCreated?.(s);
        }
        close();
      });
      el.querySelector('[data-delete]')?.addEventListener('click', async () => {
        const n = st.topics.filter((t) => t.subjectId === subject.id).length;
        const ok = await confirmDialog({
          title: 'Zmazať predmet?',
          message: `Predmet <b>${esc(subject.name)}</b> sa zmaže spolu s ${n} ${n === 1 ? 'témou' : 'témami'}. Túto akciu nejde vrátiť (iba obnovením zo zálohy).`,
          confirmText: 'Zmazať',
          danger: true,
        });
        if (!ok) return;
        store.deleteSubject(subject.id);
        close();
        toast('Predmet zmazaný');
        location.hash = '#/predmety';
      });
    },
  });
}

function showErr(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}

// ---------- Hromadné pridanie tém ----------

function groupOptions(subjectId, selected) {
  const groups = store.getState().groups.filter((g) => g.subjectId === subjectId).sort((a, b) => a.order - b.order);
  return `<option value="">Bez okruhu</option>
    ${groups.map((g) => `<option value="${g.id}" ${g.id === selected ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}`;
}

export function openBulkAdd(subjectId, { groupId = null } = {}) {
  openSheet({
    title: 'Pridať témy',
    className: 'sheet-wide',
    html: `<form class="form" novalidate>
      <label class="field"><span>Každá téma na nový riadok</span>
        <textarea name="lines" rows="11" placeholder="Srdce – stavba a cievne zásobenie&#10;Prevodový systém srdca&#10;Osrdcovník&#10;…&#10;&#10;Tip: skopíruj celý zoznam z prezentácie alebo sylabu.&#10;Odrážky a čísla na začiatku riadkov sa odstránia."></textarea></label>
      <div class="field-row">
        <label class="field"><span>Okruh</span>
          <select name="group">${groupOptions(subjectId, groupId)}<option value="__new">+ Nový okruh…</option></select></label>
        <label class="field" data-newgroup hidden><span>Názov nového okruhu</span>
          <input name="newGroup" maxlength="80" placeholder="napr. Kardiovaskulárny systém"></label>
      </div>
      <p class="form-error" hidden></p>
      <div class="form-actions">
        <span class="count-hint" data-count>Zatiaľ žiadne témy</span><span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-close>Zrušiť</button>
        <button type="submit" class="btn btn-primary" data-submit disabled>Pridať</button>
      </div>
    </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const count = el.querySelector('[data-count]');
      const submit = el.querySelector('[data-submit]');
      const newWrap = el.querySelector('[data-newgroup]');
      setTimeout(() => form.elements.lines.focus(), 250);
      const update = () => {
        const n = store.parseTopicLines(form.elements.lines.value).length;
        count.textContent = n ? `Pridá sa ${n} ${n === 1 ? 'téma' : n < 5 ? 'témy' : 'tém'}` : 'Zatiaľ žiadne témy';
        submit.disabled = n === 0;
        submit.textContent = n ? `Pridať ${n}` : 'Pridať';
      };
      form.elements.lines.addEventListener('input', update);
      form.elements.group.addEventListener('change', () => {
        newWrap.hidden = form.elements.group.value !== '__new';
        if (!newWrap.hidden) form.elements.newGroup.focus();
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const titles = store.parseTopicLines(form.elements.lines.value);
        if (!titles.length) return;
        let gid = form.elements.group.value || null;
        if (gid === '__new') {
          const name = form.elements.newGroup.value.trim();
          if (!name) return showErr(el.querySelector('.form-error'), 'Zadaj názov nového okruhu.');
          gid = store.addGroup(subjectId, name).id;
        }
        store.addTopics(subjectId, titles, gid);
        close();
        toast(`${plural(titles.length, 'Pridaná', 'Pridané', 'Pridaných')} ${titles.length} ${plural(titles.length, 'téma', 'témy', 'tém')}`);
      });
    },
  });
}

// ---------- Okruh ----------

export function openGroupForm(subjectId, group = null) {
  openSheet({
    title: group ? 'Premenovať okruh' : 'Nový okruh',
    className: 'sheet-small',
    html: `<form class="form" novalidate>
      <label class="field"><span>Názov okruhu</span>
        <input name="name" maxlength="80" value="${esc(group?.name)}" placeholder="napr. Kardiovaskulárny systém" autocomplete="off"></label>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-close>Zrušiť</button>
        <button type="submit" class="btn btn-primary">${group ? 'Uložiť' : 'Pridať okruh'}</button>
      </div></form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      setTimeout(() => form.elements.name.focus(), 250);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.elements.name.value.trim();
        if (!name) return;
        if (group) store.renameGroup(group.id, name);
        else store.addGroup(subjectId, name);
        close();
      });
    },
  });
}

export async function groupMenu(group) {
  const n = store.getState().topics.filter((t) => t.groupId === group.id).length;
  const choice = await actionMenu({
    title: group.name,
    items: [
      { label: 'Pridať témy do okruhu', value: 'add' },
      { label: 'Premenovať okruh', value: 'rename' },
      { separator: true },
      { label: 'Zmazať okruh, témy ponechať', value: 'del-keep', danger: true },
      ...(n ? [{ label: `Zmazať okruh aj s ${n} ${n === 1 ? 'témou' : 'témami'}`, value: 'del-all', danger: true }] : []),
    ],
  });
  if (choice === 'add') openBulkAdd(group.subjectId, { groupId: group.id });
  if (choice === 'rename') openGroupForm(group.subjectId, group);
  if (choice === 'del-keep') {
    store.deleteGroup(group.id);
    toast('Okruh zmazaný, témy sú medzi témami bez okruhu');
  }
  if (choice === 'del-all') {
    const ok = await confirmDialog({
      title: 'Zmazať okruh aj s témami?',
      message: `Zmaže sa okruh <b>${esc(group.name)}</b> a ${n} ${plural(n, 'téma', 'témy', 'tém')} v ňom.`,
      confirmText: 'Zmazať', danger: true,
    });
    if (ok) { store.deleteGroup(group.id, { withTopics: true }); toast('Okruh zmazaný'); }
  }
}

// ---------- Téma ----------

export async function topicMenu(topicId) {
  const t = store.getState().topics.find((x) => x.id === topicId);
  if (!t) return;
  const choice = await actionMenu({
    title: t.title,
    items: [
      ...STATUS.map((s, i) => ({ label: s.label, value: i, current: t.status === i, icon: `<span class="status-dot s${i}">${statusIcon(i)}</span>` })),
      { separator: true },
      { label: 'Upraviť tému a poznámku', value: 'edit' },
      { label: 'Zmazať tému', value: 'delete', danger: true },
    ],
  });
  if (typeof choice === 'number') {
    store.setTopicStatus(topicId, choice);
  } else if (choice === 'edit') {
    openTopicEditor(topicId);
  } else if (choice === 'delete') {
    await deleteTopicConfirm(t);
  }
}

async function deleteTopicConfirm(t) {
  const ok = await confirmDialog({
    title: 'Zmazať tému?', message: `Téma <b>${esc(t.title)}</b> sa zmaže.`, confirmText: 'Zmazať', danger: true,
  });
  if (ok) { store.deleteTopic(t.id); toast('Téma zmazaná'); }
  return ok;
}

export function openTopicEditor(topicId) {
  const t = store.getState().topics.find((x) => x.id === topicId);
  if (!t) return;
  openSheet({
    title: 'Téma',
    html: `<form class="form" novalidate>
      <label class="field"><span>Názov témy</span>
        <input name="title" maxlength="200" value="${esc(t.title)}" autocomplete="off"></label>
      <label class="field"><span>Poznámka alebo odkaz <em>(nepovinné)</em></span>
        <input name="note" maxlength="200" value="${esc(t.note)}" placeholder="napr. slajdy 12–30, NotebookLM: Kardio 1" autocomplete="off"></label>
      <label class="field"><span>Okruh</span>
        <select name="group">${groupOptions(t.subjectId, t.groupId)}</select></label>
      <fieldset class="field"><legend>Stav</legend>
        <div class="seg seg-status">${STATUS.map((s, i) => `
          <label class="seg-opt s${i}"><input type="radio" name="status" value="${i}" ${t.status === i ? 'checked' : ''}><span>${statusIcon(i)}${s.label}</span></label>`).join('')}
        </div></fieldset>
      <p class="form-error" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn btn-danger-ghost" data-delete>Zmazať</button><span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-close>Zrušiť</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div></form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = form.elements.title.value.trim();
        if (!title) return showErr(el.querySelector('.form-error'), 'Názov témy nemôže byť prázdny.');
        store.updateTopic(t.id, {
          title, note: form.elements.note.value.trim(), groupId: form.elements.group.value || null, status: Number(form.elements.status.value),
        });
        close();
      });
      el.querySelector('[data-delete]').addEventListener('click', async () => {
        if (await deleteTopicConfirm(t)) close();
      });
    },
  });
}

// ---------- Termín (deadline) ----------

export function openEventForm(event = null) {
  const st = store.getState();
  const subjects = [...st.subjects].sort((a, b) => a.name.localeCompare(b.name, 'sk'));
  openSheet({
    title: event ? 'Upraviť termín' : 'Nový termín',
    html: `<form class="form" novalidate>
      <label class="field"><span>Názov</span>
        <input name="title" maxlength="120" value="${esc(event?.title)}" placeholder="napr. Test z histológie, Odovzdanie seminárky" autocomplete="off"></label>
      <div class="field-row">
        <label class="field"><span>Dátum</span><input type="date" name="date" value="${esc(event?.date || toDayStr())}"></label>
        <label class="field"><span>Čas <em>(nepovinné)</em></span><input type="time" name="time" value="${esc(event?.time || '')}"></label>
      </div>
      <label class="field"><span>Predmet <em>(nepovinné)</em></span>
        <select name="subject"><option value="">Bez predmetu</option>
          ${subjects.map((s) => `<option value="${s.id}" ${s.id === event?.subjectId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select></label>
      <p class="form-error" hidden></p>
      <div class="form-actions">
        ${event ? '<button type="button" class="btn btn-danger-ghost" data-delete>Zmazať</button><span class="spacer"></span>' : ''}
        <button type="button" class="btn btn-ghost" data-close>Zrušiť</button>
        <button type="submit" class="btn btn-primary">${event ? 'Uložiť' : 'Pridať termín'}</button>
      </div></form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      if (!event) setTimeout(() => form.elements.title.focus(), 250);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = { title: form.elements.title.value.trim(), date: form.elements.date.value, time: form.elements.time.value, subjectId: form.elements.subject.value };
        const err = el.querySelector('.form-error');
        if (!data.title) return showErr(err, 'Zadaj názov termínu.');
        if (!data.date) return showErr(err, 'Zadaj dátum.');
        if (event) store.updateEvent(event.id, data); else store.addEvent(data);
        close();
        toast(event ? 'Termín uložený' : 'Termín pridaný');
      });
      el.querySelector('[data-delete]')?.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: 'Zmazať termín?', message: `Termín <b>${esc(event.title)}</b> sa zmaže.`, confirmText: 'Zmazať', danger: true });
        if (ok) { store.deleteEvent(event.id); close(); toast('Termín zmazaný'); }
      });
    },
  });
}
