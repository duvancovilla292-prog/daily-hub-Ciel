/* ===== js/ui/actions.js — Acciones (clicks) =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

const actions = {
  'go-tab': el => goTab(el.dataset.tab),
  'date-rel': el => setActive(D.add(ui.today, +el.dataset.offset)),
  'select-day': el => { ui.sheet = true; setActive(el.dataset.key); },
  'close-sheet': () => { ui.sheet = false; renderSheet(); },
  'clear-search': () => { $('#searchInput').value = ''; ui.query = ''; ui.queryRaw = ''; render(); },
  'theme': () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; applyTheme(); commit(); renderHeader(); },

  'cal-nav': el => { const d = new Date(ui.cal.y, ui.cal.m + +el.dataset.d, 1); ui.cal = { y: d.getFullYear(), m: d.getMonth() }; renderCalendar(); },
  'cal-today': () => { const n = D.today(); ui.cal = { y: n.getFullYear(), m: n.getMonth() }; renderCalendar(); },
  'filter-all': () => { state.settings.filters = [...TYPES]; commit(); renderCalendar(); },
  'toggle-filter': el => {
    const t = el.dataset.type, f = activeFilters();
    if (f.size === TYPES.length) { f.clear(); f.add(t); }       // venía en "Todo" → aislar este tipo
    else if (f.has(t)) f.delete(t); else f.add(t);
    state.settings.filters = f.size ? [...f] : [...TYPES];     // sin ninguno → vuelve a "Todo"
    commit(); renderCalendar();
  },

  'task-status': el => { ui.taskStatus = el.dataset.v; renderTasks(); },
  'cycle-prio': el => {
    const t = state.tasks.find(x => x.id === el.dataset.id); if (!t) return;
    t.priority = t.priority === 'low' ? 'medium' : t.priority === 'medium' ? 'high' : 'low';
    commit(); render();
  },
  'del-task': el => {
    el.closest('.task')?.classList.add('removing');
    setTimeout(() => { state.tasks = state.tasks.filter(t => t.id !== el.dataset.id); commit(); render(); }, 220);
  },
  'relink': async el => {
    const t = state.tasks.find(x => x.id === el.dataset.id); if (!t) return;
    const opts = linkOptions();
    if (!opts.length) return toast('Primero crea un horario con actividades para poder vincular', 'error');
    const v = await linkModal(opts, linkValue(t.link));
    if (v === null) return;
    t.link = parseLink(v); commit(); render();
    toast(v ? 'Tarea vinculada al horario' : 'Vínculo quitado', 'ok');
  },

  'del-bday': el => { state.birthdays = state.birthdays.filter(b => b.id !== el.dataset.id); commit(); render(); toast('Cumpleaños eliminado'); },

  /* notas */
  'notes-mode': el => { flushScratch(); ui.notesMode = el.dataset.v; renderNotes(); },
  'new-note': () => { ui.editor = newEditor(ui.active); renderNotes(); },
  'open-note': el => {
    flushScratch();
    const key = el.dataset.key;
    if (el.dataset.id) {
      const n = (state.notes[key] || []).find(x => x.id === el.dataset.id);
      ui.editor = n ? editorFrom(n, key) : newEditor(key);
    } else ui.editor = newEditor(key);
    ui.notesMode = 'day';
    setActiveSilent(key);
    ui.editor.date = key;
    goTab('notes');
  },
  'note-type': el => {
    const e = ui.editor, v = el.dataset.v;
    if (e.type === v) return;
    if (v === 'list' && !e.items.length) {
      const lines = e.content.split('\n').map(s => s.trim()).filter(Boolean);
      e.items = lines.length ? lines.map(t => ({ id: uid(), text: t, done: false })) : [{ id: uid(), text: '', done: false }];
    }
    if (v === 'text' && !e.content.trim() && e.items.length) e.content = e.items.map(i => i.text).filter(Boolean).join('\n');
    e.type = v; markDirty(); renderEditor();
  },
  'li-add': () => { ui.editor.items.push({ id: uid(), text: '', done: false }); markDirty(); renderListEditor(); const r = $$('.li-text'); r[r.length - 1]?.focus(); },
  'li-del': el => { ui.editor.items.splice(+el.dataset.i, 1); markDirty(); renderListEditor(); updateCount(); },
  'save-note': saveNote,
  'del-note': async () => {
    const e = ui.editor; if (!e.id) return;
    const ok = await modal({ title: 'Eliminar nota', body: 'Se eliminará esta nota. No se puede deshacer.', actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    Object.keys(state.notes).forEach(k => { state.notes[k] = state.notes[k].filter(n => n.id !== e.id); if (!state.notes[k].length) delete state.notes[k]; });
    commit(); ui.editor = newEditor(ui.active); renderNotes(); toast('Nota eliminada');
  },

  /* horarios */
  'sched-filter': el => { ui.schedFilter = el.dataset.v; renderSchedule(); },
  'toggle-new-sched': () => {
    ui.newSchedOpen = !ui.newSchedOpen;
    if (ui.newSchedOpen && !$('#schedStart').value) $('#schedStart').value = ui.active;
    renderSchedule();
    if (ui.newSchedOpen) $('#newSchedCard input[name=name]').focus();
  },
  'sched-nav': el => { const s = state.schedules.find(x => x.id === el.dataset.id); if (s) { shiftAnchor(s, +el.dataset.d); renderSchedule(); } },
  'sched-follow': el => { delete ui.anchors[el.dataset.id]; renderSchedule(); },
  'del-sched': async el => {
    const s = state.schedules.find(x => x.id === el.dataset.id); if (!s) return;
    const ok = await modal({ title: 'Eliminar horario', body: `Se eliminará “${esc(s.name)}” con sus ${plural(s.items.length, 'actividad', 'actividades')}. Las tareas y notas vinculadas se conservan, sin vínculo.`, actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    cleanLinks(s.id);
    state.schedules = state.schedules.filter(x => x.id !== s.id);
    commit(); render(); toast('Horario eliminado');
  },
  'del-item': async el => {
    const s = state.schedules.find(x => x.id === el.dataset.sid); if (!s) return;
    const it = s.items.find(i => i.id === el.dataset.iid); if (!it) return;
    const ok = await modal({ title: 'Eliminar actividad', body: `Se quitará “${esc(it.title)}” de todas las fechas del horario.`, actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    cleanLinks(s.id, it.id);
    s.items = s.items.filter(i => i.id !== it.id);
    commit(); renderSchedule();
  },

  /* administrador */
  'admin-toggle': () => { ui.adminOpen = !ui.adminOpen; renderAdmin(); if (ui.adminOpen && !ui.admin) $('#adminLoginForm input[name=user]').focus(); },
  'admin-lock': () => {
    ui.admin = false;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* nada */ }
    renderHeader(); toast('Panel bloqueado');
  },
  'toggle-font': () => {
    state.settings.font = state.settings.font === 'aetheri' ? 'normal' : 'aetheri';
    applyFont(); commit(); renderHeader();
    toast(state.settings.font === 'aetheri' ? 'Tipografía Aetheri activada' : 'Tipografía normal', 'ok');
  },
  'export': () => {
    if (!ui.admin) return toast('Solo el administrador puede descargar', 'error');
    try {
      flushScratch();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `backup_${D.todayKey()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Respaldo descargado', 'ok');
    } catch (e) { toast('No se pudo descargar: ' + e.message, 'error'); }
  },
  'import': () => { if (!ui.admin) return toast('Solo el administrador puede cargar', 'error'); $('#importFile').click(); },
  'wipe': async () => {
    if (!ui.admin) return;
    const f = await formModal({
      title: 'Vaciar todo',
      desc: 'Se borrarán <b>todas</b> las tareas, notas, cumpleaños, horarios y el bloc rápido. No se puede deshacer: descarga un respaldo antes si lo necesitas.',
      fields: '<label>Escribe <b>VACIAR</b> para confirmar <input name="word" autocomplete="off"></label>',
      submit: 'Vaciar todo',
      check: f => f.elements.word.value.trim().toUpperCase() === 'VACIAR' || 'Escribe VACIAR para confirmar'
    });
    if (!f) return;
    clearTimeout(scratchTimer); pendingScratch = null;
    state.tasks = []; state.notes = {}; state.birthdays = []; state.schedules = []; state.scratchpad = '';
    ui.editor = newEditor(ui.active); ui.anchors = {}; ui.openForms.clear(); ui.sheet = false;
    commit(); render(); toast('Todos los datos fueron eliminados', 'ok');
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](el, e);
});
$('#daySheet').addEventListener('mousedown', e => { if (e.target.id === 'daySheet') actions['close-sheet'](); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.sheet && !$('#modalRoot').firstChild) actions['close-sheet']();
  const t = e.target;
  if (e.key === 'Enter' && t.classList && t.classList.contains('li-text')) {   // Enter en una lista: nuevo ítem debajo
    e.preventDefault();
    const i = +t.dataset.i;
    ui.editor.items.splice(i + 1, 0, { id: uid(), text: '', done: false });
    markDirty(); renderListEditor();
    $$('.li-text')[i + 1]?.focus();
  }
});
