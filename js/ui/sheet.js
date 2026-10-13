// Dialógy (panely), potvrdenia, menu a krátke hlásenia.

import { esc } from '../util.js';

const root = () => document.getElementById('sheet-root');

/**
 * Otvorí panel. `dismissible` = zatvorí sa ťuknutím mimo (len pre menu, nie pre formuláre,
 * aby sa omylom nestratil rozpísaný text).
 */
export function openSheet({ title, html, onMount, onClose, dismissible = false, className = '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop" ${dismissible ? 'data-close' : ''}></div>
    <div class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head">
        <h2>${esc(title)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Zavrieť">✕</button>
      </div>
      <div class="sheet-body">${html}</div>
    </div>`;
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 200);
    onClose?.(result);
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });
  root().append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  onMount?.(wrap.querySelector('.sheet'), close);
  return close;
}

export function confirmDialog({ title, message, confirmText = 'Potvrdiť', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    openSheet({
      title,
      dismissible: true,
      className: 'sheet-small',
      html: `<p class="sheet-text">${message}</p>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-close>Zrušiť</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmText)}</button>
        </div>`,
      onMount(el, close) {
        el.querySelector('[data-ok]').addEventListener('click', () => { answer = true; close(); });
      },
      onClose: () => resolve(answer),
    });
  });
}

/** Menu s možnosťami. items: [{label, value, danger, current, hint}] alebo {separator:true} */
export function actionMenu({ title, items }) {
  return new Promise((resolve) => {
    let picked = null;
    openSheet({
      title,
      dismissible: true,
      className: 'sheet-small',
      html: `<div class="menu-list">${items.map((it, i) => it.separator
        ? '<div class="menu-sep"></div>'
        : `<button type="button" class="menu-item ${it.danger ? 'danger' : ''} ${it.current ? 'current' : ''}" data-i="${i}">
            ${it.icon || ''}<span class="menu-label">${esc(it.label)}</span>
            ${it.current ? '<span class="menu-current">aktuálne</span>' : ''}
          </button>`).join('')}</div>`,
      onMount(el, close) {
        el.addEventListener('click', (e) => {
          const b = e.target.closest('[data-i]');
          if (!b) return;
          picked = items[Number(b.dataset.i)].value;
          close();
        });
      },
      onClose: () => resolve(picked),
    });
  });
}

let toastTimer;
export function toast(message, { tone = '' } = {}) {
  const el = document.getElementById('toast-root');
  el.innerHTML = `<div class="toast ${tone}" role="status">${esc(message)}</div>`;
  requestAnimationFrame(() => el.firstElementChild?.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.firstElementChild?.classList.remove('show');
  }, 2600);
}
