/* ===== js/ui/actions.js — Acciones (clicks) =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

/** Si la nota que se está editando tiene cambios sin guardar, pregunta antes de perderlos. */
async function confirmDiscard() {
  if (!ui.editor.dirty) return true;
  return modal({ title: 'Descartar cambios', body: 'Hay cambios sin guardar en la nota que estás editando. ¿Quieres descartarlos?', actions: [{ label: 'Seguir editando', value: false }, { label: 'Descartar', value: true, cls: 'btn-danger' }] });
}

const actions = {
  'go-tab': el => goTab(el.dataset.tab),
  'date-rel': el => setActive(D.add(ui.today, +el.dataset.offset)),
  'select-day': el => { ui.sheet = true; setActive(el.dataset.key); },
  'close-sheet': () => { ui.sheet = false; renderSheet(); },
  'clear-search': () => { $('#searchInput').value = ''; ui.query = ''; ui.queryRaw = ''; render(); },
  'cloud': () => window.Cloud ? window.Cloud.open() : toast('La sincronización no está disponible aquí. Abre la app desde su página web (no desde el archivo en la carpeta).', 'error'),
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
  'edit-task': async el => {
    const t = state.tasks.find(x => x.id === el.dataset.id); if (!t) return;
    const cur = linkValue(t.link);
    const f = await formModal({
      title: 'Editar tarea', desc: '',
      fields: `<label>Título <input name="title" required maxlength="140" value="${esc(t.title)}"></label>
        <div class="row2">
          <label>Fecha <input type="date" name="date" required value="${t.date}"></label>
          <label>Prioridad <select name="priority">${Object.entries(PRIO).map(([k, p]) => `<option value="${k}" ${k === t.priority ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label>
        </div>
        <label>Vincular al horario <select name="link"><option value="">Sin vincular</option>${linkOptions().map(o => `<option value="${o.value}" ${o.value === cur ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`,
      submit: 'Guardar cambios',
      check: form => !form.elements.title.value.trim() ? 'Escribe el título' : !D.isValidKey(form.elements.date.value) ? 'Elige una fecha válida' : true
    });
    if (!f) return;
    Object.assign(t, { title: f.elements.title.value.trim(), date: f.elements.date.value, priority: f.elements.priority.value, link: parseLink(f.elements.link.value) });
    commit(); render(); toast('Tarea actualizada', 'ok');
  },
  'del-task': async el => {
    const t = state.tasks.find(x => x.id === el.dataset.id); if (!t) return;
    const ok = await modal({ title: 'Eliminar tarea', body: `¿Seguro que quieres eliminar la tarea <b>${esc(t.title)}</b>?`, actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    const snap = snapshot();
    el.closest('.task')?.classList.add('removing');
    setTimeout(() => { state.tasks = state.tasks.filter(x => x.id !== t.id); commit(); render(); offerUndo(snap, 'Tarea eliminada'); }, 220);
  },

  'del-bday': async el => {
    const b = state.birthdays.find(x => x.id === el.dataset.id); if (!b) return;
    const ok = await modal({ title: 'Eliminar cumpleaños', body: `¿Seguro que quieres eliminar el cumpleaños de <b>${esc(b.name)}</b> (${b.day} de ${MONTHS[b.month - 1]})?`, actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    const snap = snapshot();
    state.birthdays = state.birthdays.filter(x => x.id !== b.id); commit(); render(); offerUndo(snap, 'Cumpleaños eliminado');
  },
  'edit-bday': async el => {
    const b = state.birthdays.find(x => x.id === el.dataset.id); if (!b) return;
    let data;
    const f = await formModal({
      title: 'Editar cumpleaños', desc: '',
      fields: `<label>Nombre <input name="name" required maxlength="60" value="${esc(b.name)}"></label>
        <div class="row3">
          <label>Día <input name="day" type="number" min="1" max="31" required value="${b.day}"></label>
          <label>Mes <select name="month">${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === b.month ? 'selected' : ''}>${cap(m)}</option>`).join('')}</select></label>
          <label>Año <input name="year" type="number" min="1900" max="2100" placeholder="Opcional" value="${b.year ?? ''}"></label>
        </div>
        <div class="row2">
          <label>Categoría <select name="category">${catOptions(b.category)}</select></label>
          <label>Etiqueta <input name="tag" maxlength="30" placeholder="Opcional" value="${esc(b.tag || '')}"></label>
        </div>`,
      submit: 'Guardar cambios',
      check: form => { const r = readBdayForm(form); if (typeof r === 'string') return r; data = r; return true; }
    });
    if (!f) return;
    Object.assign(b, data); commit(); render(); toast('Cumpleaños actualizado', 'ok');
  },
  'cat-rename': async el => {
    const c = state.birthdayCategories.find(x => x.id === el.dataset.id); if (!c || !ui.admin) return;
    const f = await formModal({
      title: 'Renombrar categoría', desc: '',
      fields: `<label>Nombre <input name="name" required maxlength="30" value="${esc(c.name)}"></label>`,
      submit: 'Guardar',
      check: form => { const n = form.elements.name.value.trim(); if (!n) return 'Escribe un nombre'; return state.birthdayCategories.some(x => x.id !== c.id && norm(x.name) === norm(n)) ? 'Ya existe una categoría con ese nombre' : true; }
    });
    if (!f) return;
    c.name = f.elements.name.value.trim(); commit(); render(); toast('Categoría renombrada', 'ok');
  },
  'cat-del': async el => {
    const c = state.birthdayCategories.find(x => x.id === el.dataset.id); if (!c || !ui.admin) return;
    const n = state.birthdays.filter(b => b.category === c.id).length;
    const ok = await modal({ title: 'Eliminar categoría', body: `Se eliminará la categoría <b>${esc(c.name)}</b>.${n ? ` ${plural(n, 'cumpleaños quedará', 'cumpleaños quedarán')} sin categoría (no se borran).` : ''}`, actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    const snap = snapshot();
    state.birthdays.forEach(b => { if (b.category === c.id) b.category = null; });
    state.birthdayCategories = state.birthdayCategories.filter(x => x.id !== c.id);
    commit(); render(); offerUndo(snap, 'Categoría eliminada');
  },

  /* notas */
  'notes-mode': el => { flushScratch(); ui.notesMode = el.dataset.v; renderNotes(); },
  'new-note': async () => { if (!(await confirmDiscard())) return; ui.editor = newEditor(ui.active); renderNotes(); },
  'open-note': async el => {
    if (!(await confirmDiscard())) { if (ui.tab !== 'notes') goTab('notes'); return; }
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
    if (matchMedia('(max-width: 1000px)').matches) $('.editor-card').scrollIntoView({ behavior: 'smooth', block: 'start' });   // en celular la nota queda debajo de la lista
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
  'edit-note': () => { ui.editor.reading = false; renderNotes(); $('#noteTitle').focus(); },
  'cancel-note': async () => {
    const e = ui.editor; if (!e.id) return;
    if (!(await confirmDiscard())) return;
    const n = Object.entries(state.notes).flatMap(([k, arr]) => arr.map(x => [k, x])).find(([, x]) => x.id === e.id);
    ui.editor = n ? editorFrom(n[1], n[0]) : newEditor(ui.active);
    renderNotes();
  },
  'del-note': async () => {
    const e = ui.editor; if (!e.id) return;
    const ok = await modal({ title: 'Eliminar nota', body: 'Se eliminará esta nota.', actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    const snap = snapshot();
    Object.keys(state.notes).forEach(k => { state.notes[k] = state.notes[k].filter(n => n.id !== e.id); if (!state.notes[k].length) delete state.notes[k]; });
    commit(); ui.editor = newEditor(ui.active); renderNotes(); offerUndo(snap, 'Nota eliminada');
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
    const snap = snapshot();
    cleanLinks(s.id);
    state.schedules = state.schedules.filter(x => x.id !== s.id);
    commit(); render(); offerUndo(snap, 'Horario eliminado');
  },
  'edit-item': async el => {
    const s = state.schedules.find(x => x.id === el.dataset.sid); if (!s) return;
    const it = s.items.find(i => i.id === el.dataset.iid); if (!it) return;
    let data;
    const extra = s.type === 'weekly'
      ? `<div><span class="lbl">Días</span><div class="daychecks">${WD_SHORT.map((n, i) => `<label class="daychk"><input type="checkbox" name="days" value="${i}" ${it.days.includes(i) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>`
      : s.type === 'monthly' ? `<label>Día del mes <input type="number" name="day" min="1" max="31" required value="${it.day}"></label>` : '';
    const f = await formModal({
      title: 'Editar actividad', desc: esc(s.name),
      fields: `<label>Actividad <input name="title" required maxlength="100" value="${esc(it.title)}"></label>
        <div class="row2"><label>Inicio <input type="time" name="start" value="${it.start}"></label><label>Fin <input type="time" name="end" value="${it.end}"></label></div>${extra}`,
      submit: 'Guardar cambios',
      check: form => {
        const fd = new FormData(form);
        const title = String(fd.get('title')).trim(), start = String(fd.get('start') || ''), end = String(fd.get('end') || '');
        if (!title) return 'Escribe el nombre de la actividad';
        if (start && end && end < start) return 'La hora de fin es anterior a la de inicio';
        data = { title, start, end };
        if (s.type === 'weekly') { data.days = fd.getAll('days').map(Number); if (!data.days.length) return 'Elige al menos un día de la semana'; }
        if (s.type === 'monthly') { data.day = +fd.get('day'); if (!Number.isInteger(data.day) || data.day < 1 || data.day > 31) return 'Día del mes inválido'; }
        return true;
      }
    });
    if (!f) return;
    Object.assign(it, data); commit(); render(); toast('Actividad actualizada', 'ok');
  },
  'del-item': async el => {
    const s = state.schedules.find(x => x.id === el.dataset.sid); if (!s) return;
    const it = s.items.find(i => i.id === el.dataset.iid); if (!it) return;
    const ok = await modal({ title: 'Eliminar actividad', body: `Se quitará “${esc(it.title)}” de todas las fechas del horario.`, actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    const snap = snapshot();
    cleanLinks(s.id, it.id);
    s.items = s.items.filter(i => i.id !== it.id);
    commit(); renderSchedule(); offerUndo(snap, 'Actividad eliminada');
  },

  /* administrador */
  'admin-toggle': () => { ui.adminOpen = !ui.adminOpen; renderAdmin(); if (ui.adminOpen && !ui.admin) $('#adminLoginForm input[name=user]').focus(); },
  'admin-close': () => { ui.adminOpen = false; renderAdmin(); $('#adminBtn').focus(); },
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
  'load-demo': async () => {
    if (!ui.admin) return toast('Solo el administrador puede cargar datos de prueba', 'error');
    let raw;
    try {
      const res = await fetch('data/datos-prueba.json', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      raw = await res.json();
    } catch (e) {
      return toast('No se pudieron leer los datos de prueba. Si abriste el archivo directo desde la carpeta, usa “Cargar respaldo” y elige data/datos-prueba.json', 'error');
    }
    importData(raw, 'Cargar datos de prueba');
  },
  'import': () => { if (!ui.admin) return toast('Solo el administrador puede cargar', 'error'); $('#importFile').click(); },
  'wipe': async () => {
    if (!ui.admin) return;
    const f = await formModal({
      title: 'Vaciar todo',
      desc: 'Se borrarán <b>todas</b> las tareas, notas, cumpleaños, horarios y el bloc rápido. Podrás deshacerlo solo durante unos segundos: descarga un respaldo antes si lo necesitas.',
      fields: '<label>Escribe <b>VACIAR</b> para confirmar <input name="word" autocomplete="off"></label>',
      submit: 'Vaciar todo',
      check: f => f.elements.word.value.trim().toUpperCase() === 'VACIAR' || 'Escribe VACIAR para confirmar'
    });
    if (!f) return;
    clearTimeout(scratchTimer); pendingScratch = null;
    const snap = snapshot();
    state.tasks = []; state.notes = {}; state.birthdays = []; state.schedules = []; state.scratchpad = '';
    ui.editor = newEditor(ui.active); ui.anchors = {}; ui.openForms.clear(); ui.sheet = false;
    commit(); render(); offerUndo(snap, 'Todos los datos fueron eliminados');
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](el, e);
});
$('#daySheet').addEventListener('mousedown', e => { if (e.target.id === 'daySheet') actions['close-sheet'](); });
$('#adminPanel').addEventListener('mousedown', e => { if (e.target.id === 'adminPanel') actions['admin-close'](); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modalRoot').firstChild) {
    if (ui.adminOpen) actions['admin-close']();
    else if (ui.sheet) actions['close-sheet']();
  }
  const t = e.target;
  if (e.key === 'Enter' && t.classList && t.classList.contains('li-text')) {   // Enter en una lista: nuevo ítem debajo
    e.preventDefault();
    const i = +t.dataset.i;
    ui.editor.items.splice(i + 1, 0, { id: uid(), text: '', done: false });
    markDirty(); renderListEditor();
    $$('.li-text')[i + 1]?.focus();
  }
});
