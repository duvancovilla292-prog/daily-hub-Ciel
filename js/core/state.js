/* ===== js/core/state.js — Estado de la aplicación y de la interfaz =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

let state = Store.load();
const t0 = D.today();

const newEditor = date => ({ id: null, date, title: '', type: 'text', content: '', items: [], link: '', dirty: false, reading: false });
const linkValue = l => l ? l.sid + '|' + l.iid : '';
const parseLink = v => { if (!v) return null; const [sid, iid] = String(v).split('|'); return sid && iid ? { sid, iid } : null; };
// Una nota guardada se abre en modo lectura: solo se edita con el botón "Editar"
const editorFrom = (n, date) => ({ id: n.id, date, title: n.title, type: n.type, content: n.content, items: clone(n.items), link: linkValue(n.link), dirty: false, reading: true });

const ui = {
  tab: 'calendar',
  today: D.key(t0),
  active: D.key(t0),
  cal: { y: t0.getFullYear(), m: t0.getMonth() },     // mes visible del calendario
  sheet: false,                                       // ventana de detalle del día
  query: '', queryRaw: '',
  taskStatus: 'all', taskScope: 'all',
  notesMode: 'day', noteScope: 'all',
  editor: null,
  scratchStatus: 'saved',
  schedFilter: 'all', newSchedOpen: false,
  openForms: new Set(),
  anchors: {},                                        // fecha que muestra cada horario
  bdayCat: 'all',                                     // filtro de categoría en Cumpleaños
  adminOpen: false,
  admin: (() => { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; } })()
};
ui.editor = newEditor(ui.active);

let commitSeq = 0;                                     // sube con cada cambio (para saber si aún se puede deshacer)
const hooks = { onCommit: null };                      // la sincronización con la nube se engancha aquí

function commit() {
  commitSeq++;
  const ok = Store.save(state);
  if (hooks.onCommit) hooks.onCommit();
  if (!ok && !commit.warned) {
    commit.warned = true;
    toast('No se puede usar el almacenamiento del navegador: los datos se perderán al cerrar. Un administrador puede usar Exportar para respaldarlos.', 'error');
  }
}

/** Reemplaza todos los datos (al deshacer o al llegar datos de la nube) y vuelve a dibujar. */
function replaceState(next) {
  state = next;
  commitSeq++;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* sin almacenamiento */ }
  const e = ui.editor;
  if (e.id && !e.dirty) {                                // la nota abierta se refresca (o se cierra si ya no existe)
    const f = Object.entries(state.notes).flatMap(([k, a]) => a.map(n => [k, n])).find(([, n]) => n.id === e.id);
    ui.editor = f ? editorFrom(f[1], f[0]) : newEditor(ui.active);
    if (f && !e.reading) ui.editor.reading = false;
  }
  applyTheme(); applyFont(); render();
}
