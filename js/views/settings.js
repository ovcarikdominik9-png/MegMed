// Nastavenia: záloha (export/import), úložisko, reset.

import * as store from '../store.js';
import { serializeBackup, parseBackup, exportFileName, isPersisted, requestPersist } from '../db.js';
import { esc, icons, pageHeader } from '../util.js';
import { toDayStr, diffDays, relDays, formatLong, plural } from '../dates.js';
import { confirmDialog, toast } from '../ui/sheet.js';

export const BACKUP_DAYS = 7;

const count = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;

export function backupOverdue(st) {
  const hasData = st.subjects.length > 0;
  if (!hasData) return false;
  const last = st.settings.lastBackupAt;
  if (!last) return true;
  return diffDays(toDayStr(new Date(last)), toDayStr()) >= BACKUP_DAYS;
}

export function renderSettings(el) {
  const st = store.getState();
  const last = st.settings.lastBackupAt;
  const overdue = backupOverdue(st);
  const lastText = last
    ? `Posledná záloha: <b>${formatLong(toDayStr(new Date(last)))}</b> (${relDays(diffDays(toDayStr(), toDayStr(new Date(last))))})`
    : 'Zálohu si zatiaľ ešte nerobila.';

  el.innerHTML = pageHeader('Nastavenia') + `
    <section class="card settings-card">
      <h2>Záloha dát</h2>
      <div class="backup-status ${overdue ? 'overdue' : 'ok'}">
        ${overdue ? icons.warn : icons.check}
        <div><p>${lastText}</p>
        <p class="small">Zálohu si rob <b>aspoň raz za týždeň</b>. Dáta sú uložené len v tomto iPade – pri vymazaní dát Safari alebo výmene iPadu by sa stratili. Súbor zálohy si ulož do Súborov (iCloud Drive).</p></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary btn-lg" data-act="export">Exportovať zálohu</button>
        <button class="btn btn-ghost btn-lg" data-act="import">Importovať zálohu</button>
        <input type="file" accept="application/json,.json" data-file hidden>
      </div>
      <p class="muted small">Import nahradí všetky súčasné dáta obsahom súboru.</p>
    </section>

    <section class="card settings-card">
      <h2>Úložisko</h2>
      <p data-persist class="muted">Zisťujem…</p>
      <p class="muted small">${count(st.subjects.length, 'predmet', 'predmety', 'predmetov')} · ${count(st.topics.length, 'téma', 'témy', 'tém')} · ${count(st.events.length, 'vlastný termín', 'vlastné termíny', 'vlastných termínov')} · ${count(st.log.length, 'zmena stavu', 'zmeny stavu', 'zmien stavu')}</p>
    </section>

    <section class="card settings-card danger-zone">
      <h2>Vymazať všetko</h2>
      <p class="muted">Zmaže všetky predmety, témy, termíny aj históriu pokroku v tomto zariadení. Predtým si exportuj zálohu.</p>
      <button class="btn btn-danger" data-act="reset">Vymazať všetky dáta</button>
    </section>

    <p class="about muted small">MegMed · verzia 1 · funguje aj offline · žiadne účty, žiadne sledovanie</p>`;

  isPersisted().then((p) => {
    const elP = el.querySelector('[data-persist]');
    if (!elP) return;
    elP.innerHTML = p
      ? `${icons.check} Prehliadač označil dáta ako trvalé – nemal by ich mazať pri nedostatku miesta.`
      : 'Dáta sú uložené v IndexedDB tohto zariadenia. Pre najväčšiu istotu používaj appku z plochy a pravidelne zálohuj.';
  });

  const fileInput = el.querySelector('[data-file]');
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    let doc;
    try {
      doc = parseBackup(await file.text());
    } catch (err) {
      toast(err.message, { tone: 'bad' });
      return;
    }
    const ok = await confirmDialog({
      title: 'Nahradiť dáta zálohou?',
      message: `Záloha obsahuje <b>${count(doc.subjects.length, 'predmet', 'predmety', 'predmetov')}</b> a <b>${count(doc.topics.length, 'tému', 'témy', 'tém')}</b>${doc.exportedAt ? ` (vytvorená ${esc(formatLong(toDayStr(new Date(doc.exportedAt))))})` : ''}. Všetky súčasné dáta v appke sa nahradia.`,
      confirmText: 'Importovať',
      danger: true,
    });
    if (!ok) return;
    // Obnovené dáta sú presne tie zo zálohy → záloha k nim existuje.
    if (doc.exportedAt) doc.settings.lastBackupAt = doc.exportedAt;
    delete doc.exportedAt;
    store.replaceState(doc);
    requestPersist();
    toast('Záloha bola obnovená');
  });

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'export') exportBackup();
    if (b.dataset.act === 'import') fileInput.click();
    if (b.dataset.act === 'reset') {
      const ok = await confirmDialog({
        title: 'Naozaj vymazať všetko?',
        message: 'Všetky predmety, témy a história pokroku sa nenávratne zmažú. Ak nemáš zálohu, najprv ju exportuj.',
        confirmText: 'Vymazať všetko', danger: true,
      });
      if (!ok) return;
      const ok2 = await confirmDialog({
        title: 'Posledné potvrdenie', message: 'Toto sa nedá vrátiť späť. Pokračovať?', confirmText: 'Áno, vymazať', danger: true,
      });
      if (!ok2) return;
      store.resetAll();
      toast('Všetky dáta boli vymazané');
      location.hash = '#/dnes';
    }
  });
}

async function exportBackup() {
  const st = store.getState();
  const json = serializeBackup(st);
  const name = exportFileName(toDayStr());
  const file = new File([json], name, { type: 'application/json' });
  // Na iPade otvorí zdieľací panel → „Uložiť do Súborov“. Inde sa súbor stiahne.
  if (navigator.canShare?.({ files: [file] }) && /iPad|iPhone|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
    try {
      await navigator.share({ files: [file], title: name });
      store.markBackup();
      toast('Záloha uložená');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  store.markBackup();
  toast('Záloha stiahnutá');
}
