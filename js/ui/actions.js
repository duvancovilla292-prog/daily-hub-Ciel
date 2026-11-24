/* ===== js/ui/actions.js — Acciones (clicks) =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

/** Descarga todos los datos como un archivo JSON (también lo usa la nube antes de cerrar sesión con cambios sin subir). */
function downloadBackup() {
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
}

/** Abre el editor de notas en una ventana (nueva o editar). `after` se ejecuta al cerrarla (ej. volver a la ficha de la persona). */
function openNoteSheet(after) {
  const e = ui.editor;
  e.reading = false;
  renderEditor();
  openSheet({
    title: e.id ? 'Editar nota' : 'Nueva nota', node: $('#noteForm'), wide: true,
    isDirty: () => ui.editor.dirty,
    onCancel: () => { const f = ui.editor.id && findNote(ui.editor.id); ui.editor = f ? editorFrom(f[1], f[0]) : newEditor(ui.active); },
    onClose: () => { renderNotes(); if (after) setTimeout(after, 0); }
  });
}
const findNote = id => Object.entries(state.notes).flatMap(([k, arr]) => arr.map(n => [k, n])).find(([, n]) => n.id === id) || null;

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
    let data;
    const pending = formModal({
      title: 'Editar tarea', desc: '',
      fields: `<label>Título <input name="title" required maxlength="140" value="${esc(t.title)}"></label>
        <label>Tipo <select name="mode" data-change="task-mode">${Object.entries(TASK_MODES).map(([k, l]) => `<option value="${k}" ${k === t.mode ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="row2">
          <label><span class="lbl-date">Fecha</span> <input type="date" name="date" required value="${t.date}"></label>
          <label>Hora <input type="time" name="time" value="${t.time || ''}"></label>
        </div>
        <label class="due-wrap"><span class="lbl-due">Fecha límite</span> <input type="date" name="due" value="${t.due}"></label>
        <div class="row2">
          <label>Prioridad <select name="priority">${Object.entries(PRIO).map(([k, p]) => `<option value="${k}" ${k === t.priority ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label>
          <label>Vincular al horario <select name="link"><option value="">Sin vincular</option>${linkOptions().map(o => `<option value="${o.value}" ${o.value === cur ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
        </div>
        <label>Persona o fecha <select name="person">${personOptions(t.person || '')}</select></label>
        <p class="muted small mode-help" hidden></p>
        <label>Etiquetas <input name="tags" maxlength="160" placeholder="casa, campus (opcional)" value="${esc((t.tags || []).join(', '))}"></label>
        <label>Subtareas <textarea name="subtasks" rows="3" placeholder="Una por línea (opcional)">${esc((t.subtasks || []).map(x => x.text).join('\n'))}</textarea></label>`,
      submit: 'Guardar cambios',
      check: form => { const r = readTaskForm(form); if (typeof r === 'string') return r; data = r; return true; }
    });
    syncTaskForm($('#fm'));
    const f = await pending;
    if (!f) return;
    if (data.mode !== 'repeat') t.doneDates = [];
    const { subTexts, ...rest } = data;
    Object.assign(t, rest, { subtasks: mergeSubtasks(t.subtasks || [], subTexts) });
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

  'show-overdue': () => { ui.taskScope = 'overdue'; ui.taskStatus = 'all'; goTab('tasks'); },
  'toggle-subs': el => { const id = el.dataset.id; if (ui.openSubs.has(id)) ui.openSubs.delete(id); else ui.openSubs.add(id); render(); },
  'move-task': el => {
    const t = state.tasks.find(x => x.id === el.dataset.id); if (!t) return;
    const to = D.add(ui.today, +el.dataset.to);
    if (t.mode === 'span') t.due = to < t.date ? t.date : to; else t.date = to;
    commit(); render(); toast(`Tarea movida a ${el.dataset.to === '0' ? 'hoy' : 'mañana'}`, 'ok');
  },
  'bday-kind-filter': el => { ui.bdayKind = el.dataset.v; renderBirthdays(); },
  'row-menu': el => {
    const id = el.dataset.id;
    openMenu(el, [
      { label: 'Ver ficha', action: 'open-person', id, icon: '👤' },
      { label: 'Editar', action: 'edit-bday', id, icon: ICON_EDIT },
      { label: 'Eliminar', action: 'del-bday', id, icon: ICON_X, cls: 'danger' }
    ]);
  },
  'del-bday': async el => {
    const b = state.birthdays.find(x => x.id === el.dataset.id); if (!b) return;
    const ok = await modal({ title: 'Eliminar fecha', body: `¿Seguro que quieres eliminar ${kindOf(b) === 'birthday' ? 'el cumpleaños de ' : ''}<b>${esc(dateName(b))}</b> (${b.day} de ${MONTHS[b.month - 1]})?`, actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    const snap = snapshot();
    state.birthdays = state.birthdays.filter(x => x.id !== b.id); commit(); render(); offerUndo(snap, 'Fecha eliminada');
  },
  'edit-bday': async el => {
    const b = state.birthdays.find(x => x.id === el.dataset.id); if (!b) return;
    let data;
    const pending = formModal({
      title: 'Editar fecha', desc: '',
      fields: bdayFieldsHtml(b),
      submit: 'Guardar cambios',
      check: form => { const r = readBdayForm(form); if (typeof r === 'string') return r; data = r; return true; }
    });
    syncBdayForm($('#fm'));
    const f = await pending;
    if (!f) return;
    Object.assign(b, data); commit(); render(); toast('Fecha actualizada', 'ok');
  },
  'cat-rename': async el => {
    const c = state.birthdayCategories.find(x => x.id === el.dataset.id); if (!c || !ui.admin) return;
    const f = await formModal({
      title: 'Renombrar categoría', desc: '',
      fields: `<label>Nombre <input name="name" required maxlength="30" value="${esc(c.name)}"></label>
        <label class="inline-chk"><input type="checkbox" name="pets" ${c.pets ? 'checked' : ''}> Son mascotas (no se muestra la generación)</label>`,
      submit: 'Guardar',
      check: form => { const n = form.elements.name.value.trim(); if (!n) return 'Escribe un nombre'; return state.birthdayCategories.some(x => x.id !== c.id && norm(x.name) === norm(n)) ? 'Ya existe una categoría con ese nombre' : true; }
    });
    if (!f) return;
    c.name = f.elements.name.value.trim(); c.pets = f.elements.pets.checked; commit(); render(); toast('Categoría guardada', 'ok');
  },
  'cat-del': async el => {
    const c = state.birthdayCategories.find(x => x.id === el.dataset.id); if (!c || !ui.admin) return;
    const n = state.birthdays.filter(b => b.category === c.id).length;
    const ok = await modal({ title: 'Eliminar categoría', body: `Se eliminará la categoría <b>${esc(c.name)}</b>.${n ? ` ${plural(n, 'fecha quedará', 'fechas quedarán')} sin categoría (no se borran).` : ''}`, actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    const snap = snapshot();
    state.birthdays.forEach(b => { if (b.category === c.id) b.category = null; });
    state.birthdayCategories = state.birthdayCategories.filter(x => x.id !== c.id);
    commit(); render(); offerUndo(snap, 'Categoría eliminada');
  },

  /* notas */
  'notes-mode': el => { flushScratch(); ui.notesMode = el.dataset.v; renderNotes(); },
  'new-note': async () => { if (!(await confirmDiscard())) return; ui.editor = newEditor(ui.active); ui.notesMode = 'day'; renderNotes(); openNoteSheet(); },
  'open-person': el => openPersonSheet(el.dataset.id),
  'gift-note': el => {
    const b = state.birthdays.find(x => x.id === el.dataset.id); if (!b) return;
    const ex = Object.entries(state.notes).flatMap(([k, a]) => a.map(n => [k, n])).find(([, n]) => n.person === b.id && /^ideas de regalo/i.test(n.title));
    closeSheetNow();
    if (ex) ui.editor = editorFrom(ex[1], ex[0]);
    else { ui.editor = newEditor(ui.today); Object.assign(ui.editor, { type: 'list', title: 'Ideas de regalo', person: b.id, items: [{ id: uid(), text: '', done: false }] }); }
    ui.notesMode = 'day';
    openNoteSheet(() => openPersonSheet(b.id));
  },
  'person-note': el => {
    const b = state.birthdays.find(x => x.id === el.dataset.id); if (!b) return;
    closeSheetNow();
    ui.editor = newEditor(ui.today); ui.editor.person = b.id; ui.notesMode = 'day';
    openNoteSheet(() => openPersonSheet(b.id));
  },
  'open-note': async el => {
    if (sheetOpen()) closeSheetNow();                                   // desde la ficha de una persona
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
    if (!el.dataset.id) { openNoteSheet(); return; }                 // "+ Nueva nota" desde Hoy o el calendario
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
  'pin-note': () => {
    const e = ui.editor; if (!e.id) return;
    const n = Object.values(state.notes).flat().find(x => x.id === e.id); if (!n) return;
    n.pinned = !n.pinned; e.pinned = n.pinned;
    commit(); renderNotes(); toast(n.pinned ? 'Nota fijada arriba' : 'Nota quitada de fijadas', 'ok');
  },
  'edit-note': () => {
    const f = findNote(ui.editor.id); if (!f) return;
    ui.editor = editorFrom(f[1], f[0]); ui.editor.reading = false;
    renderNotes(); openNoteSheet();
  },
  'cancel-note': () => requestCloseSheet(),
  'del-note': async () => {
    const e = ui.editor; if (!e.id) return;
    const ok = await modal({ title: 'Eliminar nota', body: 'Se eliminará esta nota.', actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    const snap = snapshot();
    Object.keys(state.notes).forEach(k => { state.notes[k] = state.notes[k].filter(n => n.id !== e.id); if (!state.notes[k].length) delete state.notes[k]; });
    commit(); ui.editor = newEditor(ui.active); closeSheetNow(); renderNotes(); offerUndo(snap, 'Nota eliminada');
  },

  /* horarios */
  'panel-mode': el => { ui.panelMode[el.dataset.id] = el.dataset.v; renderSchedule(); },
  'sched-filter': el => { ui.schedFilter = el.dataset.v; renderSchedule(); },
  'new-sched': () => {
    const f = $('form[data-form=schedule]');
    if (!$('#schedStart').value) $('#schedStart').value = ui.active;
    syncSchedForm();
    openSheet({ title: 'Nuevo horario', node: f, wide: true, onCancel: () => { f.reset(); $('#schedColors input').checked = true; syncSchedForm(); } });
  },
  'new-item': el => {
    const s = state.schedules.find(x => x.id === el.dataset.sid); if (!s) return;
    openSheet({ title: `Nueva actividad · ${s.name}`, html: itemFormHtml(s) });
  },
  'new-skip': el => {
    const s = state.schedules.find(x => x.id === el.dataset.id); if (!s) return;
    openSheet({ title: `Saltar un día · ${s.name}`, html: `<form data-form="skip-day" data-sid="${esc(s.id)}" class="stack" autocomplete="off">
      <p class="muted small">Ese día no aparecerá ninguna actividad de este horario. Se puede restaurar después.</p>
      <label>Día <input type="date" name="day" required value="${esc(ui.active)}"></label>
      <div class="sheet-foot"><button type="button" class="btn btn-ghost" data-action="sheet-close">Cancelar</button><button class="btn btn-primary">Saltar ese día</button></div></form>` });
  },
  'new-task': el => {
    const f = $('form[data-form=task]');
    f.reset();
    f.elements.date.value = el.dataset.key && D.isValidKey(el.dataset.key) ? el.dataset.key : ui.active;
    fillLinkSelect($('#taskLink'), '');
    $('#taskPerson').innerHTML = personOptions(el.dataset.person || '');
    syncTaskForm(f);
    const back = el.dataset.back === 'person' ? el.dataset.person : '';
    openSheet({ title: 'Nueva tarea', node: f, onClose: back ? () => setTimeout(() => openPersonSheet(back), 0) : null });
  },
  'new-bday': el => {
    const preset = el && el.dataset && DATE_KINDS[el.dataset.kind] ? { kind: el.dataset.kind } : null;
    openSheet({ title: 'Nueva fecha importante', html: `<form data-form="birthday" class="stack" autocomplete="off">${bdayFieldsHtml(preset)}
      <div class="sheet-foot"><button type="button" class="btn btn-ghost" data-action="sheet-close">Cancelar</button><button class="btn btn-primary">Guardar fecha</button></div></form>` });
    syncBdayForm($('#sheetRoot form[data-form=birthday]'));
  },
  'person-tab': el => { ui.personTab = el.dataset.v; refreshPersonSheet(); },
  'copy-msg': async el => {
    const b = state.birthdays.find(x => x.id === el.dataset.id); if (!b) return;
    const f = await formModal({
      title: 'Mensaje para ' + dateName(b),
      desc: 'Puedes usar <code>{nombre}</code>, <code>{apodo}</code> y <code>{edad}</code>. La plantilla se guarda para la próxima vez.',
      fields: `<label>Plantilla <textarea name="tpl" rows="4" maxlength="600" data-msg-for="${esc(b.id)}">${esc(state.msgTemplate || DEFAULT_MSG)}</textarea></label>
        <div class="msg-preview" id="msgPreview">${esc(fillMessage(state.msgTemplate, b))}</div>`,
      submit: '📋 Copiar',
      check: form => form.elements.tpl.value.trim() ? true : 'Escribe el mensaje'
    });
    if (!f) return;
    const tpl = f.elements.tpl.value.trim();
    if (tpl !== (state.msgTemplate || DEFAULT_MSG)) { state.msgTemplate = tpl === DEFAULT_MSG ? '' : tpl; commit(); }
    const ok = await copyText(fillMessage(tpl, b));
    toast(ok ? 'Mensaje copiado: ya puedes pegarlo' : 'No se pudo copiar automáticamente', ok ? 'ok' : 'error');
  },
  'new-cat': () => {
    if (!ui.admin) return toast('Inicia sesión con Google para crear categorías', 'error');
    openSheet({ title: 'Nueva categoría de fechas', html: `<form data-form="bday-cat" class="stack" autocomplete="off">
      <label>Nombre <input name="name" required maxlength="30" placeholder="Ej. Trabajo, Familia"></label>
      <label class="inline-chk"><input type="checkbox" name="pets"> Son mascotas (no se muestra la generación)</label>
      <div class="sheet-foot"><button type="button" class="btn btn-ghost" data-action="sheet-close">Cancelar</button><button class="btn btn-primary">Crear categoría</button></div></form>` });
  },
  'sheet-close': () => requestCloseSheet(),
  'sched-nav': el => { const s = state.schedules.find(x => x.id === el.dataset.id); if (s) { shiftAnchor(s, +el.dataset.d); renderSchedule(); } },
  'sched-follow': el => { delete ui.anchors[el.dataset.id]; renderSchedule(); },
  'dup-sched': el => {
    const s = state.schedules.find(x => x.id === el.dataset.id); if (!s) return;
    const copy = { ...clone(s), id: uid(), name: (s.name + ' (copia)').slice(0, 60), items: s.items.map(it => ({ ...clone(it), id: uid() })) };
    state.schedules.splice(state.schedules.indexOf(s) + 1, 0, copy);
    commit(); renderSchedule(); toast('Horario duplicado (sin tareas ni notas vinculadas)', 'ok');
  },
  'skip-today': el => {
    const s = state.schedules.find(x => x.id === el.dataset.id); if (!s || !D.isValidKey(el.dataset.key)) return;
    if (!s.skipDates.includes(el.dataset.key)) s.skipDates = [...s.skipDates, el.dataset.key].sort();
    commit(); render(); toast(`Sin actividades el ${D.full(el.dataset.key)}`, 'ok');
  },
  'unskip': el => {
    const s = state.schedules.find(x => x.id === el.dataset.id); if (!s) return;
    s.skipDates = s.skipDates.filter(k => k !== el.dataset.key); commit(); render();
  },
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
    Object.assign(it, data); commit(); render(); warnConflicts(s, it, 'Actividad actualizada');
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
  'admin-toggle': () => { ui.adminOpen = !ui.adminOpen; renderAdmin(); },
  'cloud-signin': () => window.Cloud ? window.Cloud.signIn() : toast('La sesión con Google no está disponible aquí. Abre la app desde su página web.', 'error'),
  'admin-close': () => { ui.adminOpen = false; renderAdmin(); $('#adminBtn').focus(); },
  'toggle-font': () => {
    state.settings.font = state.settings.font === 'aetheri' ? 'normal' : 'aetheri';
    applyFont(); commit(); renderHeader();
    toast(state.settings.font === 'aetheri' ? 'Tipografía Aetheri activada' : 'Tipografía normal', 'ok');
  },
  'export': () => {
    if (!ui.admin) return toast('Inicia sesión con Google para descargar un respaldo', 'error');
    downloadBackup();
  },
  'load-demo': async () => {
    if (!ui.admin) return toast('Inicia sesión con Google para cargar datos de prueba', 'error');
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
  'import': () => { if (!ui.admin) return toast('Inicia sesión con Google para cargar un respaldo', 'error'); $('#importFile').click(); },
  'wipe': async () => {
    if (!ui.admin) return;
    const f = await formModal({
      title: 'Vaciar todo',
      desc: 'Se borrarán <b>todas</b> las tareas, notas, fechas importantes, horarios y el bloc rápido. Podrás deshacerlo solo durante unos segundos: descarga un respaldo antes si lo necesitas.',
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
  if (el && actions[el.dataset.action]) {
    const inMenu = !!el.closest('.pop-menu');
    actions[el.dataset.action](el, e);
    if (inMenu) closeMenu();                               // elegir una opción cierra el menú ⋮
  }
});
$('#daySheet').addEventListener('mousedown', e => { if (e.target.id === 'daySheet') actions['close-sheet'](); });
$('#adminPanel').addEventListener('mousedown', e => { if (e.target.id === 'adminPanel') actions['admin-close'](); });
document.addEventListener('keydown', e => {
  // Las filas que se abren al tocarlas (role="button") también con Enter o Espacio
  if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.dataset.action) { e.preventDefault(); e.target.click(); return; }
  if (e.key === 'Escape' && menuBtn) { const b = menuBtn; closeMenu(); b.focus(); return; }
  if (e.key === 'Escape' && !$('#modalRoot').firstChild && sheetOpen()) { requestCloseSheet(); return; }
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
