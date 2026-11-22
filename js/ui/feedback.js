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
