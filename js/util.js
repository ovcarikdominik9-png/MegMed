export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const SUBJECT_COLORS = ['#ff5fa8', '#ff8a5c', '#ffc94d', '#3ee08f', '#38c7e8', '#7c8cff', '#b77cff', '#ff6b8a'];

export const STATUS = [
  { label: 'Nezačaté', key: 's0' },
  { label: 'Prejdené', key: 's1' },
  { label: 'Zopakované', key: 's2' },
  { label: 'Zvládnuté', key: 's3' },
];

/** Malý koláčik: 0/3, 1/3, 2/3, 3/3 vyplnený – stav je rozlíšený tvarom, farbou aj textom. */
export function statusIcon(s) {
  const r = 7, c = 9;
  let fill = '';
  if (s === 3) fill = `<circle cx="${c}" cy="${c}" r="${r}" fill="currentColor"/>`;
  else if (s > 0) {
    const a = (s / 3) * 2 * Math.PI;
    const x = c + r * Math.sin(a), y = c - r * Math.cos(a);
    fill = `<path d="M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" fill="currentColor"/>`;
  }
  return `<svg class="status-ico" viewBox="0 0 18 18" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.6"/>${fill}</svg>`;
}

export function statusPill(s) {
  return `<span class="status s${s}">${statusIcon(s)}<span>${STATUS[s].label}</span></span>`;
}

export const icons = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
  grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></g></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5L2.5 20h19L12 3.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.2" fill="currentColor"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
};

export function pageHeader(title, subtitle = '', actions = '') {
  return `<header class="page-head">
    <div><h1 class="page-title">${esc(title)}</h1>${subtitle ? `<p class="page-sub">${subtitle}</p>` : ''}</div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </header>`;
}

export function emptyState({ title, text, action = '' }) {
  return `<div class="empty card">
    <div class="empty-art" aria-hidden="true">${icons.book}</div>
    <h2>${esc(title)}</h2>
    <p>${text}</p>
    ${action}
  </div>`;
}

export function pct(x) {
  return Math.round(x * 100);
}
