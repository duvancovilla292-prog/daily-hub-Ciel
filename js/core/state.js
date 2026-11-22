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

function commit() {
  const ok = Store.save(state);
  if (!ok && !commit.warned) {
    commit.warned = true;
    toast('No se puede usar el almacenamiento del navegador: los datos se perderán al cerrar. Un administrador puede usar Exportar para respaldarlos.', 'error');
  }
}
