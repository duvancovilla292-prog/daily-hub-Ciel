/* ===== js/ui/router.js — Render general y navegación =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

function render() {
  renderHeader();
  ({ today: renderToday, calendar: renderCalendar, tasks: renderTasks, notes: renderNotes, birthdays: renderBirthdays, schedule: renderSchedule })[ui.tab]();
  renderSheet();
  refreshPersonSheet();
}

function goTab(tab) {
  flushScratch();
  ui.tab = tab; ui.sheet = false;
  document.body.dataset.tab = tab;                    // el CSS muestra Ayer/Hoy/Mañana solo donde importa el día
  $$('.view').forEach(v => v.hidden = v.id !== 'view-' + tab);
  $$('.tab').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
  render();
}

function setActiveSilent(key) {
  ui.active = key;
  const d = D.parse(key);
  ui.cal = { y: d.getFullYear(), m: d.getMonth() };
  $('#taskDate').value = key;
  if (!ui.editor.id && !ui.editor.dirty) ui.editor.date = key;
}
function setActive(key) {
  if (!D.isValidKey(key)) return;
  setActiveSilent(key);
  render();
}

/* Colores principales: [oscuro, secundario oscuro, claro, secundario claro] */
const ACCENTS = {
  cielo: ['#38bdf8', '#a855f7', '#0284c7', '#9333ea', 'Cielo'],
  violeta: ['#a78bfa', '#f472b6', '#7c3aed', '#db2777', 'Violeta'],
  rosa: ['#f472b6', '#fb923c', '#db2777', '#ea580c', 'Rosa'],
  esmeralda: ['#34d399', '#38bdf8', '#059669', '#0284c7', 'Esmeralda'],
  menta: ['#2dd4bf', '#a3e635', '#0d9488', '#65a30d', 'Menta'],
  naranja: ['#fb923c', '#f43f5e', '#ea580c', '#e11d48', 'Naranja'],
  ambar: ['#fbbf24', '#fb7185', '#d97706', '#e11d48', 'Ámbar'],
  indigo: ['#818cf8', '#22d3ee', '#4f46e5', '#0891b2', 'Índigo']
};
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
/** Texto legible sobre un color: oscuro o blanco, el que contraste más. */
const onColor = l => (l + .05) / .0575 >= 1.05 / (l + .05) ? '#04121f' : '#ffffff';
function applyTheme() {
  const r = document.documentElement, look = state.settings.look || defaultLook();
  const light = state.settings.theme === 'light', a = ACCENTS[look.accent] || ACCENTS.cielo;
  const acc = light ? a[2] : a[0], acc2 = look.style === 'minimal' ? acc : (light ? a[3] : a[1]);
  r.dataset.theme = state.settings.theme;
  ['style', 'bg', 'shape', 'density'].forEach(k => { r.dataset[k] = look[k]; });
  r.style.setProperty('--accent', acc);
  r.style.setProperty('--accent2', acc2);
  r.style.setProperty('--on-accent', onColor(lum(acc)));
  r.style.setProperty('--on-primary', (lum(acc) + lum(acc2)) / 2 > .42 ? '#04121f' : '#ffffff');
}
