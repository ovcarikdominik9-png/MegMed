// Dlhé podržanie a zmena poradia ťahaním – cez pointer eventy (prst aj Apple Pencil).

/** Dlhé podržanie na prvku zodpovedajúcom `selector`. Potlačí následný click. */
export function onLongPress(root, selector, handler, ms = 480) {
  let timer = null, sx = 0, sy = 0, fired = false;
  const cancel = () => { clearTimeout(timer); timer = null; };

  root.addEventListener('pointerdown', (e) => {
    const target = e.target.closest(selector);
    if (!target || e.target.closest('[data-drag]')) return;
    fired = false;
    sx = e.clientX; sy = e.clientY;
    cancel();
    timer = setTimeout(() => {
      timer = null;
      fired = true;
      navigator.vibrate?.(12);
      target.classList.add('pressed');
      setTimeout(() => target.classList.remove('pressed'), 220);
      handler(target);
    }, ms);
  });
  root.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel();
  });
  root.addEventListener('pointerup', cancel);
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('click', (e) => {
    if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; }
  }, true);
  root.addEventListener('contextmenu', (e) => {
    if (e.target.closest(selector)) e.preventDefault();
  });
}

/**
 * Zmena poradia ťahaním za úchyt [data-drag].
 * Zoznam je plochý: hlavičky okruhov (headerSel, data-group) a riadky (itemSel, data-id).
 * Po pustení zavolá onDrop([{id, groupId}]) v novom poradí.
 */
export function enableDragSort(list, { itemSel, headerSel, onDrop }) {
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag]');
    if (!handle || !list.contains(handle)) return;
    const item = handle.closest(itemSel);
    if (!item) return;
    e.preventDefault();

    const r0 = item.getBoundingClientRect();
    const grabDy = e.clientY - r0.top;
    let pointerY = e.clientY;
    let raf = 0;
    const pointerId = e.pointerId;
    item.classList.add('dragging');
    list.classList.add('is-dragging');
    navigator.vibrate?.(8);

    const place = () => {
      const candidates = [...list.querySelectorAll(`${itemSel}:not(.dragging), ${headerSel}`)]
        .filter((el) => el.offsetParent !== null);
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        if (pointerY < r.top || pointerY > r.bottom) continue;
        const upper = pointerY < r.top + r.height / 2;
        const isHeader = el.matches(headerSel);
        const isFirstHeader = isHeader && el === list.querySelector(headerSel);
        if (upper && !isFirstHeader) {
          if (el.previousElementSibling !== item) el.before(item);
        } else if (el.nextElementSibling !== item) {
          el.after(item);
        }
        break;
      }
      const natural = list.getBoundingClientRect().top + item.offsetTop;
      item.style.transform = `translateY(${pointerY - grabDy - natural}px)`;
    };

    const loop = () => {
      const edge = 90;
      if (pointerY < edge) window.scrollBy(0, -Math.ceil((edge - pointerY) / 6));
      else if (pointerY > innerHeight - edge) window.scrollBy(0, Math.ceil((pointerY - (innerHeight - edge)) / 6));
      place();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const move = (ev) => { if (ev.pointerId === pointerId) { pointerY = ev.clientY; ev.preventDefault(); } };
    const end = (ev) => {
      if (ev.pointerId !== pointerId) return;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      item.style.transform = '';
      item.classList.remove('dragging');
      list.classList.remove('is-dragging');
      let groupId = null;
      const seq = [];
      for (const el of list.querySelectorAll(`${itemSel}, ${headerSel}`)) {
        if (el.matches(headerSel)) groupId = el.dataset.group || null;
        else seq.push({ id: el.dataset.id, groupId });
      }
      onDrop(seq);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });
}
