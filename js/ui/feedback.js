/* ===== js/ui/feedback.js — Toasts y modales =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, type === 'error' ? 5000 : 2600);
}

/* ===== Selector de varios (chips + "Agregar…") =====
   kind: 'persons' (personas y fechas) | 'people' (solo personas) | 'notes' | 'tasks'. El valor vive en un input oculto (ids separados por coma). */
function pickerOptions(kind, exclude) {
  if (kind === 'notes') return Object.entries(state.notes).flatMap(([k, a]) => a.map(n => [k, n])).sort((x, y) => y[0].localeCompare(x[0]))
    .filter(([, n]) => n.id !== exclude).map(([k, n]) => ({ value: n.id, label: `${n.type === 'list' ? '☑' : '📝'} ${noteLabel(n)} · ${D.short(k)}`, find: noteText(n) + ' ' + D.long(k) }));
  if (kind === 'tasks') return state.tasks.slice().sort((x, y) => (taskStatus(x) === 'done') - (taskStatus(y) === 'done') || x.date.localeCompare(y.date))
    .map(t => ({ value: t.id, label: `${taskStatus(t) === 'done' ? '✓ ' : ''}${t.title} · ${D.short(t.date)}`, find: t.title + ' ' + (t.tags || []).join(' ') }));
  return state.birthdays.filter(b => b.id !== exclude && (kind !== 'people' || kindOf(b) === 'birthday'))
    .sort((a, b) => norm(a.name).localeCompare(norm(b.name)))
    .map(b => ({ value: b.id, label: `${kindIcon(b)} ${dateName(b)}`, sub: [b.relation, b.nick ? `“${b.nick}”` : '', catName(b.category)].filter(Boolean).join(' · '),
      find: [b.name, dateName(b), b.nick, b.relation, catName(b.category), b.tag].filter(Boolean).join(' ') }));
}
function pickerInner(kind, name, selected, exclude) {
  const opts = pickerOptions(kind, exclude), byId = new Map(opts.map(o => [o.value, o.label]));
  const sel = (selected || []).filter(v => byId.has(v));
  const ph = { persons: '+ Agregar persona o fecha…', people: '+ Agregar persona…', notes: '+ Vincular nota…', tasks: '+ Vincular tarea…' }[kind];
  return `<input type="hidden" name="${name}" value="${esc(sel.join(','))}">
    ${sel.length ? `<div class="picker-chips">${sel.map(v => `<span class="pchip">${esc(byId.get(v))}<button type="button" data-action="picker-del" data-v="${esc(v)}" aria-label="Quitar ${esc(byId.get(v))}">✕</button></span>`).join('')}</div>` : ''}
    ${comboHtml(kind, 'picker', ph)}`;
}
function pickerHtml(kind, name, selected, exclude) {
  return `<div class="picker" data-picker="${kind}" data-name="${name}" ${exclude ? `data-exclude="${esc(exclude)}"` : ''}>${pickerInner(kind, name, selected, exclude)}</div>`;
}
/** Dibuja (o vuelve a dibujar) un selector que ya está en la página. */
function fillPicker(el, selected) { el.innerHTML = pickerInner(el.dataset.picker, el.dataset.name, selected, el.dataset.exclude); }
const pickerValues = el => (el.querySelector('input[type=hidden]').value || '').split(',').filter(Boolean);
/** Cambió un selector: si es del editor de notas, actualiza el editor. */
function pickerChanged(el) {
  if (el.closest('#noteForm')) { ui.editor[el.dataset.name] = pickerValues(el); markDirty(); }
  if (sheet && el.closest('#sheetRoot')) sheet.dirty = true;
}

/* ===== Buscador con sugerencias =====
   Un campo donde se escribe y aparecen las coincidencias (sin importar tildes ni mayúsculas; busca en nombre, apodo,
   parentesco, categoría y etiqueta). Se elige tocando, o con ↑ ↓ y Enter. `target` dice qué hacer al elegir:
   'picker' (agrega un chip), 'li' (agrega la persona como ítem de la lista), 'sub' (la agrega como subtarea). */
const comboHtml = (kind, target, ph) => `<div class="combo" data-kind="${kind}" data-target="${target}">
  <input type="search" class="combo-input" placeholder="${esc(ph)}" aria-label="${esc(ph)}" autocomplete="off" enterkeyhint="done" aria-expanded="false">
  <ul class="combo-list" role="listbox" hidden></ul></div>`;
function comboOptions(box) {
  const p = box.closest('.picker'), taken = p ? pickerValues(p) : [];
  const q = norm(box.querySelector('.combo-input').value.trim());
  const all = pickerOptions(box.dataset.kind, p ? p.dataset.exclude : '').filter(o => !taken.includes(o.value));
  const words = q.split(/\s+/).filter(Boolean);
  const found = words.length ? all.filter(o => { const t = norm(o.find || o.label); return words.every(w => t.includes(w)); }) : all;
  // primero los que empiezan por lo escrito
  if (q) found.sort((a, b) => (norm(b.label).replace(/^\W+/, '').startsWith(q) ? 1 : 0) - (norm(a.label).replace(/^\W+/, '').startsWith(q) ? 1 : 0));
  return { list: found.slice(0, 8), total: found.length, q };
}
function renderCombo(box) {
  const ul = box.querySelector('.combo-list'), inp = box.querySelector('.combo-input');
  const { list, total, q } = comboOptions(box);
  box.dataset.active = '0';
  ul.innerHTML = list.length
    ? list.map((o, i) => `<li><button type="button" role="option" class="${i === 0 ? 'on' : ''}" data-action="combo-pick" data-v="${esc(o.value)}"><span>${esc(o.label)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button></li>`).join('') +
      (total > list.length ? `<li class="combo-more">${total - list.length} más… sigue escribiendo para afinar</li>` : '')
    : `<li class="combo-more">${q ? 'Sin coincidencias' : 'No hay nada para elegir'}</li>`;
  ul.hidden = false; inp.setAttribute('aria-expanded', 'true');
}
function closeCombos(except) {
  $$('.combo').forEach(b => { if (b !== except) { const ul = b.querySelector('.combo-list'); if (ul) ul.hidden = true; b.querySelector('.combo-input')?.setAttribute('aria-expanded', 'false'); } });
}
/** Se eligió una opción del buscador. */
function comboPick(box, value) {
  const target = box.dataset.target;
  if (target === 'picker') {
    const p = box.closest('.picker');
    fillPicker(p, [...pickerValues(p), value]);
    pickerChanged(p);
    const again = p.querySelector('.combo-input');
    if (again) { again.dataset.quiet = '1'; again.focus(); delete again.dataset.quiet; }   // listo para seguir escribiendo, sin tapar el resto
    return;
  }
  const b = state.birthdays.find(x => x.id === value); if (!b) return;
  if (target === 'sub') {
    const ta = box.closest('form').elements.subtasks;
    ta.value = (ta.value.trim() ? ta.value.replace(/\s*$/, '') + '\n' : '') + dateName(b);
    if (sheet && box.closest('#sheetRoot')) sheet.dirty = true;
  } else if (target === 'li') {
    const e = ui.editor;
    e.items = e.items.filter(i => i.text.trim());                         // quita el renglón vacío si lo hay
    e.items.push({ id: uid(), text: dateName(b), done: false, person: b.id });
    markDirty(); renderListEditor(); updateCount();
  }
  const inp = box.querySelector('.combo-input'); inp.value = ''; closeCombos(); inp.dataset.quiet = '1'; inp.focus(); delete inp.dataset.quiet;
}
document.addEventListener('input', e => { const box = e.target.closest && e.target.closest('.combo'); if (box && e.target.classList.contains('combo-input')) renderCombo(box); });
document.addEventListener('focusin', e => { const box = e.target.closest && e.target.closest('.combo'); if (box && e.target.classList.contains('combo-input') && !e.target.dataset.quiet) { closeCombos(box); renderCombo(box); } });
document.addEventListener('pointerdown', e => { if (!(e.target.closest && e.target.closest('.combo'))) closeCombos(); }, true);
document.addEventListener('keydown', e => {
  const inp = e.target; if (!inp.classList || !inp.classList.contains('combo-input')) return;
  const box = inp.closest('.combo'), btns = $$('.combo-list button', box);
  let i = +box.dataset.active || 0;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (box.querySelector('.combo-list').hidden) renderCombo(box);
    i = Math.max(0, Math.min(btns.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
    btns.forEach((b, j) => b.classList.toggle('on', j === i)); box.dataset.active = String(i); btns[i]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault(); e.stopPropagation();                  // no enviar el formulario
    if (btns[i]) comboPick(box, btns[i].dataset.v);
  } else if (e.key === 'Escape' && !box.querySelector('.combo-list').hidden) {
    e.preventDefault(); e.stopPropagation(); closeCombos();
  }
}, true);

/* ===== Menú ⋮ de una fila (Editar / Eliminar…) =====
   items: [{ label, action, id, icon, cls }] → botones con data-action, que se atienden como cualquier otro clic. */
let menuBtn = null, menuAt = 0;
function openMenu(btn, items) {
  const again = menuBtn === btn;
  closeMenu();
  if (again) return;                                       // tocar ⋮ otra vez lo cierra
  const m = document.createElement('div');
  m.className = 'pop-menu';
  m.setAttribute('role', 'menu');
  m.innerHTML = items.map(i => `<button type="button" role="menuitem" class="${i.cls || ''}" data-action="${i.action}" data-id="${esc(i.id)}">${i.icon || ''}<span>${esc(i.label)}</span></button>`).join('');
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  let top = r.bottom + 4;
  if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 4);
  m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
  m.style.top = top + 'px';
  btn.setAttribute('aria-expanded', 'true');
  menuBtn = btn;
  menuAt = Date.now();
  m.querySelector('button')?.focus({ preventScroll: true });
}
function closeMenu() {
  document.querySelector('.pop-menu')?.remove();
  if (menuBtn) { menuBtn.setAttribute('aria-expanded', 'false'); menuBtn = null; }
}
document.addEventListener('pointerdown', e => { if (menuBtn && !e.target.closest('.pop-menu') && e.target.closest('[data-action=row-menu]') !== menuBtn) closeMenu(); }, true);
window.addEventListener('resize', () => closeMenu());
window.addEventListener('scroll', () => { if (menuBtn && Date.now() - menuAt > 300) closeMenu(); }, true);   // al desplazar la página (no al abrirlo)

/* ===== Ventana emergente para crear o editar =====
   Puede mover dentro un formulario que ya existe en la página (#formStore: conserva sus ids y eventos)
   o mostrar uno armado al momento. Si se escribió algo y se intenta cerrar, pregunta antes de descartarlo.
   Los formularios que se guardan bien (sus funciones devuelven true) cierran la ventana solos. */
let sheet = null;
function openSheet({ title, node, html, wide, isDirty, onCancel, onClose }) {
  closeSheetNow();
  const root = $('#sheetRoot');
  root.innerHTML = `<div class="overlay sheet-overlay"><div class="modal form-sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <button type="button" class="icon-btn sheet-x" data-action="sheet-close" aria-label="Cerrar">✕</button><h3>${esc(title)}</h3><div class="sheet-body"></div></div></div>`;
  const body = $('.sheet-body', root);
  let home = null;
  if (node) { home = { parent: node.parentNode, next: node.nextSibling }; body.appendChild(node); }
  else body.innerHTML = html;
  sheet = { node, home, dirty: false, isDirty, onCancel, onClose };
  $('.overlay', root).addEventListener('mousedown', e => { if (e.target.classList.contains('overlay')) requestCloseSheet(); });
  setTimeout(() => body.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea')?.focus(), 30);
  return body;
}
const sheetOpen = () => !!sheet;
function closeSheetNow() {
  if (!sheet) return;
  const { node, home, onClose } = sheet;
  sheet = null;
  if (node && home) home.parent.insertBefore(node, home.next);
  $('#sheetRoot').innerHTML = '';
  if (onClose) onClose();
}
/** Cerrar por ✕, Cancelar, Esc o tocando fuera: si hay algo escrito, pregunta. */
async function requestCloseSheet() {
  if (!sheet) return;
  const dirty = sheet.isDirty ? sheet.isDirty() : sheet.dirty;
  if (dirty) {
    const ok = await modal({ title: 'Descartar', body: 'Escribiste algo que no se ha guardado. ¿Quieres descartarlo?', actions: [{ label: 'Seguir editando', value: false }, { label: 'Descartar', value: true, cls: 'btn-danger' }] });
    if (!ok || !sheet) return;
  }
  if (sheet.node && sheet.node.tagName === 'FORM') sheet.node.reset();
  if (sheet.onCancel) sheet.onCancel();
  closeSheetNow();
}

/** Aviso con un botón de acción (ej. "Deshacer"). Dura más que un aviso normal. */
function toastAction(msg, label, fn, ms = 7000) {
  const el = document.createElement('div');
  el.className = 'toast has-action';
  el.innerHTML = `<span>${esc(msg)}</span><button type="button" class="toast-btn">${esc(label)}</button>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 320); };
  const timer = setTimeout(close, ms);
  el.querySelector('button').addEventListener('click', () => { clearTimeout(timer); close(); fn(); });
  $('#toasts').appendChild(el);
}

/** Toma una foto de los datos antes de borrar algo y, después de borrarlo, ofrece "Deshacer". */
const snapshot = () => ({ data: clone(state), seq: commitSeq });
function offerUndo(snap, msg) {
  const seq = commitSeq;                                  // número de cambio justo después de borrar
  toastAction(msg, 'Deshacer', () => {
    if (commitSeq !== seq) return toast('Ya hiciste otros cambios después: no se puede deshacer', 'error');
    flushScratch();
    ui.editor = newEditor(ui.active);
    replaceState(snap.data);
    commit();
    toast('Restaurado', 'ok');
  });
}

function modal({ title, body, actions }) {
  return new Promise(resolve => {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal"><h3>${esc(title)}</h3><p>${body}</p><div class="modal-actions">${actions.map((a, i) => `<button class="btn ${a.cls || 'btn-ghost'}" data-m="${i}">${esc(a.label)}</button>`).join('')}</div></div></div>`;
    const close = v => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    root.querySelector('.overlay').addEventListener('click', e => {
      const b = e.target.closest('[data-m]');
      if (b) close(actions[+b.dataset.m].value);
      else if (e.target.classList.contains('overlay')) close(null);
    });
    const btns = $$('[data-m]', root);
    btns[btns.length - 1].focus();
  });
}

/** Modal con formulario. check(form) devuelve true para aceptar o un texto de error. Resuelve el <form> o null. */
function formModal({ title, desc, fields, submit, check }) {
  return new Promise(resolve => {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <form class="modal" id="fm" autocomplete="off"><h3>${esc(title)}</h3><p>${desc}</p>
        <div class="stack" style="margin-top:14px">${fields}<p class="err" id="fmErr" hidden></p></div>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-c>Cancelar</button><button class="btn btn-primary">${esc(submit)}</button></div>
      </form></div>`;
    const f = $('#fm', root), err = $('#fmErr', root);
    const close = v => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    f.addEventListener('submit', e => {
      e.preventDefault();
      const r = check(f);
      if (r === true) close(f); else { err.hidden = false; err.textContent = r; }
    });
    $('[data-c]', root).addEventListener('click', () => close(null));
    $('.overlay', root).addEventListener('mousedown', e => { if (e.target.classList.contains('overlay')) close(null); });
    const first = f.querySelector('input,select'); if (first) first.focus();
  });
}
