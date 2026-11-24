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
