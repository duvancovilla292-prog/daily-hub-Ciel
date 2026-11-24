/* ===== js/ui/router.js — Render general y navegación =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

function render() {
  renderHeader();
  ({ today: renderToday, calendar: renderCalendar, tasks: renderTasks, notes: renderNotes, birthdays: renderBirthdays, schedule: renderSchedule })[ui.tab]();
  renderSheet();
}

function goTab(tab) {
  flushScratch();
  ui.tab = tab; ui.sheet = false;
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

function applyTheme() { document.documentElement.dataset.theme = state.settings.theme; }
