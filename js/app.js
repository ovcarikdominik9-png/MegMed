// Štart appky, smerovanie (#/dnes, #/predmety, …) a horná navigácia.

import { initStore, subscribe, getState } from './store.js';
import { requestPersist } from './db.js';
import { toDayStr } from './dates.js';
import { toast } from './ui/sheet.js';
import { renderToday } from './views/today.js';
import { renderSubjects } from './views/subjects.js';
import { renderSubject } from './views/subject.js';
import { renderDeadlines } from './views/deadlines.js';
import { renderProgress } from './views/progress.js';
import { renderSettings, backupOverdue } from './views/settings.js';

const routes = {
  dnes: renderToday,
  predmety: renderSubjects,
  predmet: renderSubject,
  deadliny: renderDeadlines,
  pokrok: renderProgress,
  nastavenia: renderSettings,
};

const viewRoot = document.getElementById('view');
let lastRoute = '';
let lastDay = toDayStr();

function parseRoute() {
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  return routes[name] ? { name, arg: arg && decodeURIComponent(arg) } : { name: 'dnes' };
}

function render() {
  const r = parseRoute();
  const key = `${r.name}/${r.arg || ''}`;
  const sameRoute = key === lastRoute;
  const y = window.scrollY;
  const el = document.createElement('div');
  el.className = `view view-${r.name}${sameRoute ? '' : ' view-enter'}`;
  routes[r.name](el, r.arg);
  viewRoot.replaceChildren(el);
  if (sameRoute) window.scrollTo(0, y); else window.scrollTo(0, 0);
  lastRoute = key;

  const tab = r.name === 'predmet' ? 'predmety' : r.name;
  document.querySelectorAll('[data-tab]').forEach((a) => {
    const on = a.dataset.tab === tab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.querySelector('.gear')?.classList.toggle('has-dot', backupOverdue(getState()));
}

async function start() {
  await initStore();
  if (!location.hash) history.replaceState(null, '', '#/dnes');
  render();
  hideSplash();
  subscribe(render);
  window.addEventListener('hashchange', render);
  // Po návrate do appky (napr. ďalší deň ráno) prepočítaj „Dnes“.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && toDayStr() !== lastDay) {
      lastDay = toDayStr();
      render();
    }
  });
  window.addEventListener('megmed:save-error', () => toast('Uloženie zlyhalo. Exportuj zálohu v Nastaveniach.', { tone: 'bad' }));
  requestPersist();
  registerSW();
}

function hideSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = reduced ? 0 : Math.max(0, 2600 - performance.now());
  setTimeout(() => {
    el.classList.add('hide');
    // Obsah pod ňou nabehne s animáciou v rovnakom okamihu.
    const v = document.querySelector('.view');
    if (v) { v.classList.remove('view-enter'); void v.offsetWidth; v.classList.add('view-enter'); }
    setTimeout(() => el.remove(), 650);
  }, wait);
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  // Pri lokálnom vývoji offline cache nechceme (zobrazovala by staré súbory); zapneš ju cez ?sw
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local && !new URLSearchParams(location.search).has('sw')) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch((err) => console.warn('SW', err));
  // Keď sa nainštaluje nová verzia appky, raz obnovíme stránku (dáta sú bezpečne v IndexedDB).
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    if (!document.querySelector('.sheet-wrap')) location.reload();
  });
}

start().catch((err) => {
  console.error(err);
  document.getElementById('splash')?.remove();
  viewRoot.innerHTML = `<div class="card pad"><h2>Appku sa nepodarilo spustiť</h2><p class="muted">${String(err.message || err)}</p></div>`;
});
