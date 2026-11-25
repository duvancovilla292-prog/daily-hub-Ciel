/* ===== js/ui/events.js — Eventos de cambio, escritura y formularios =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

const changes = {
  'toggle-task': el => {
    const t = state.tasks.find(x => x.id === el.dataset.id); if (!t) return;
    if (t.mode === 'repeat') {                                      // las que se repiten se marcan solo en ese día
      const key = el.dataset.key; if (!D.isValidKey(key)) return;
      const s = new Set(t.doneDates);
      if (el.checked) s.add(key); else s.delete(key);
      t.doneDates = [...s].sort();
    } else { t.completed = el.checked; t.doneAt = el.checked ? new Date().toISOString() : ''; }
    el.closest('.task, li')?.classList.toggle('done', el.checked);   // transición visual inmediata
    commit();
    renderHeader();
    setTimeout(render, 280);
  },
  'bday-cat-filter': el => { ui.bdayCat = el.value; renderBirthdays(); },
  'task-mode': el => syncTaskForm(el.closest('form')),
  'task-tag': el => { ui.taskTag = el.value; renderTasks(); },
  'toggle-sub': el => {
    const t = state.tasks.find(x => x.id === el.dataset.id); if (!t) return;
    const s = t.subtasks.find(x => x.id === el.dataset.sub); if (!s) return;
    s.done = el.checked; commit(); render();
  },
  'sched-holidays': el => {
    const s = state.schedules.find(x => x.id === el.dataset.id); if (!s) return;
    s.skipHolidays = el.checked; commit(); render();
    toast(el.checked ? 'Este horario ya no aparece en festivos' : 'Este horario vuelve a aparecer en festivos', 'ok');
  },
  'task-scope': el => { ui.taskScope = el.value; renderTasks(); },
  'date-pick': el => setActive(el.value),
  'note-scope': el => { ui.noteScope = el.value; renderNotesList(); },
  'note-date': el => { if (D.isValidKey(el.value)) { ui.editor.date = el.value; markDirty(); } },
  'note-link': el => { ui.editor.link = el.value; markDirty(); },
  'bday-kind': el => syncBdayForm(el.closest('form')),
  'picker-add': el => { const p = el.closest('.picker'); if (!el.value) return; fillPicker(p, [...pickerValues(p), el.value]); pickerChanged(p); },
  'gift-item': el => {
    const n = Object.values(state.notes).flat().find(x => x.id === el.dataset.note); if (!n) return;
    const it = n.items.find(i => i.id === el.dataset.item); if (!it) return;
    it.done = el.checked; n.updatedAt = new Date().toISOString(); commit(); render();
  },
  'bday-remind': el => {
    const b = state.birthdays.find(x => x.id === el.dataset.id); if (!b) return;
    const days = +(el.closest('.person-remind')?.querySelector('input[type=number]')?.value) || 7;
    b.remind = el.checked ? Math.min(60, Math.max(1, days)) : 0;
    commit(); const n = ensureGiftTasks(); render();
    toast(el.checked ? (n ? 'Recordatorio activado: se creó la tarea' : `Recordatorio activado: la tarea aparecerá ${b.remind} ${b.remind === 1 ? 'día' : 'días'} antes (se crea en el mes de la fecha)`) : 'Recordatorio desactivado', 'ok');
  },
  'bday-remind-days': el => {
    const b = state.birthdays.find(x => x.id === el.dataset.id); if (!b) return;
    const v = Math.min(60, Math.max(1, Math.round(+el.value) || 7)); el.value = v;
    if (b.remind) { b.remind = v; commit(); ensureGiftTasks(); render(); }
  },
  'li-done': el => { ui.editor.items[+el.dataset.i].done = el.checked; markDirty(); updateCount(); },
  'sched-hour': el => {
    const s = state.schedules.find(x => x.id === el.dataset.id); if (!s) return;
    const v = +el.value;
    if (el.dataset.k === 'start') { if (v > s.hourEnd) toast('La hora inicial no puede ser mayor que la final', 'error'); else s.hourStart = v; }
    else { if (v < s.hourStart) toast('La hora final no puede ser menor que la inicial', 'error'); else s.hourEnd = v; }
    commit(); renderSchedule();
  },
  'sched-type': syncSchedForm,
  'sched-duration': syncSchedForm
};
document.addEventListener('change', e => {
  const a = e.target.dataset && e.target.dataset.change;
  if (a && changes[a]) changes[a](e.target);
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'noteTitle') { ui.editor.title = t.value; markDirty(); }
  else if (t.id === 'noteArea') { ui.editor.content = t.value; markDirty(); updateCount(); }
  else if (t.id === 'scratchArea') { queueScratchSave(t.value); updateScratchCount(); }
  else if (t.classList && t.classList.contains('li-text')) { ui.editor.items[+t.dataset.i].text = t.value; markDirty(); updateCount(); }
});

$('#searchInput').addEventListener('input', e => {
  ui.queryRaw = e.target.value.trim();
  ui.query = norm(ui.queryRaw);
  render();
});

$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !ui.admin) return;
  let raw;
  try { raw = JSON.parse(await file.text()); }
  catch (err) { toast('Archivo inválido: no es un JSON', 'error'); return; }
  importData(raw, 'Cargar respaldo');
});

/** Compara los datos recibidos con los actuales y, si el admin confirma, agrega solo lo nuevo. */
async function importData(raw, title) {
  let incoming;
  try {
    incoming = Store.validate(raw);
  } catch (err) {
    toast('Archivo inválido: ' + (err.message || 'no se pudo leer'), 'error');
    return;
  }
  const { state: merged, report } = Store.merge(state, incoming);
  const rows = [['Tareas', 'tasks'], ['Notas', 'notes'], ['Fechas importantes', 'birthdays'], ['Categorías de fechas', 'cats'], ['Horarios', 'schedules'], ['Actividades de horarios', 'items']];
  const added = rows.reduce((a, [, k]) => a + report[k].add, 0) + (report.scratch ? 1 : 0);
  if (!added) { toast('No hay nada nuevo: todo lo del archivo ya existe, no se duplicó nada', 'ok'); return; }
  const ok = await modal({
    title,
    body: 'Se comparó el archivo con tus datos actuales:<br><br>' +
      rows.map(([n, k]) => `<b>${n}:</b> ${report[k].add} nuevos · ${report[k].skip} ya existían`).join('<br>') +
      (report.scratch ? '<br><b>Bloc rápido:</b> se agregará el texto nuevo' : '') +
      '<br><br>Solo se agrega lo nuevo: no se borra ni se duplica nada de lo que ya tienes.',
    actions: [{ label: 'Cancelar', value: false }, { label: 'Agregar lo nuevo', value: true, cls: 'btn-primary' }]
  });
  if (!ok) return;
  flushScratch();
  merged.settings = state.settings;
  state = merged;
  ui.editor = newEditor(ui.active); ui.anchors = {};
  commit(); render();
  toast(`Se agregaron ${added} elementos nuevos`, 'ok');
}

/** Avisa si una actividad se cruza con otra del mismo horario (no lo impide). */
function warnConflicts(s, it, okMsg) {
  const c = itemConflicts(s, it);
  if (c.length) toast(`⚠ ${okMsg}, pero se cruza con: ${c.map(o => `${o.title} (${timeLabel(o)})`).join(', ')}`, 'error');
  else toast(okMsg, 'ok');
}

// Vista previa en vivo del mensaje de cumpleaños
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.msgFor) { const b = state.birthdays.find(x => x.id === t.dataset.msgFor); const p = $('#msgPreview'); if (b && p) p.textContent = fillMessage(t.value, b); }
});

const forms = {
  /** "+" en la ficha: agrega una idea a la nota "Ideas de regalo" de esa persona (la crea si no existe). */
  'gift-add'(f) {
    const b = state.birthdays.find(x => x.id === f.dataset.id); if (!b) return;
    const text = f.elements.text.value.trim().slice(0, 120); if (!text) return;
    let n = Object.values(state.notes).flat().find(x => (x.persons || []).includes(b.id) && x.type === 'list' && /^ideas de regalo/i.test(x.title));
    if (!n) { n = { id: uid(), title: 'Ideas de regalo', type: 'list', content: '', items: [], link: null, updatedAt: '', pinned: false, persons: [b.id] }; (state.notes[ui.today] = state.notes[ui.today] || []).push(n); }
    n.items.push({ id: uid(), text, done: false }); n.updatedAt = new Date().toISOString();
    commit(); f.reset(); render(); toast('Idea agregada', 'ok');
  },
  'skip-day'(f) {
    const s = state.schedules.find(x => x.id === f.dataset.sid); if (!s) return;
    const k = String(new FormData(f).get('day') || '');
    if (!D.isValidKey(k)) return toast('Elige el día que quieres saltar', 'error');
    if (s.skipDates.includes(k)) return toast('Ese día ya está saltado', 'error');
    s.skipDates = [...s.skipDates, k].sort(); commit(); render();
    toast(`“${s.name}” no tendrá actividades el ${D.full(k)}`, 'ok');
    return true;
  },
  task(f) {
    const r = readTaskForm(f);
    if (typeof r === 'string') return toast(r, 'error');
    const { subTexts, ...data } = r;
    state.tasks.push({ id: uid(), ...data, subtasks: mergeSubtasks([], subTexts), completed: false, doneDates: [] });
    commit();
    ['title', 'link', 'due', 'time', 'tags', 'subtasks'].forEach(n => { f.elements[n].value = ''; });
    f.elements.mode.value = 'once'; syncTaskForm(f);
    render(); toast('Tarea agregada', 'ok');
    return true;
  },
  birthday(f) {
    const b = readBdayForm(f);
    if (typeof b === 'string') return toast(b, 'error');
    state.birthdays.push({ id: uid(), ...b });
    commit(); f.reset(); syncBdayForm(f); render(); toast(`${DATE_KINDS[b.kind].icon} ${dateName(b)} agregado`, 'ok');
    return true;
  },
  'bday-cat'(f) {
    if (!ui.admin) return toast('Inicia sesión con Google para crear categorías', 'error');
    const name = f.elements.name.value.trim().slice(0, 30);
    if (!name) return;
    if (state.birthdayCategories.some(c => norm(c.name) === norm(name))) return toast('Esa categoría ya existe', 'error');
    state.birthdayCategories.push({ id: uid(), name, pets: !!(f.elements.pets && f.elements.pets.checked) });
    commit(); render(); toast(`Categoría “${name}” creada`, 'ok');
    return true;
  },
  schedule(f) {
    const fd = new FormData(f);
    const name = String(fd.get('name')).trim(), type = String(fd.get('type')), start = String(fd.get('start')), dur = String(fd.get('duration'));
    if (!name) return;
    if (!D.isValidKey(start)) return toast('Elige la fecha de inicio', 'error');
    let end = '';
    if (dur === 'custom') {
      end = String(fd.get('end'));
      if (!D.isValidKey(end)) return toast('Elige la fecha final', 'error');
      if (end < start) return toast('La fecha final es anterior a la de inicio', 'error');
    } else if (dur !== 'none') {
      const n = parseInt(dur, 10);
      end = dur.endsWith('w') ? D.add(start, n * 7 - 1) : D.add(D.addMonths(start, n), -1);
    }
    const weekdays = type === 'daily' ? fd.getAll('wdays').map(Number) : [0, 1, 2, 3, 4, 5, 6];
    if (!weekdays.length) return toast('Elige al menos un día de la semana', 'error');
    let hs = type === 'monthly' ? 6 : +fd.get('hstart'), he = type === 'monthly' ? 21 : +fd.get('hend');
    if (he < hs) return toast('La hora inicial no puede ser mayor que la final', 'error');
    const s = { id: uid(), name, type, color: String(fd.get('color') || SCHED_COLORS[0]), startDate: start, endDate: end, weekdays, hourStart: hs, hourEnd: he, skipHolidays: fd.get('skipHolidays') === 'on', skipDates: [], items: [] };
    state.schedules.push(s);
    commit(); f.reset(); $('#schedColors input').checked = true; syncSchedForm();
    ui.schedFilter = 'all';
    ui.anchors[s.id] = start > ui.active || (end && end < ui.active) ? start : ui.active;   // muestra el periodo vigente
    renderSchedule(); toast('Horario creado: ya puedes agregar actividades', 'ok');
    return true;
  },
  item(f) {
    const s = state.schedules.find(x => x.id === f.dataset.sid); if (!s) return;
    const fd = new FormData(f);
    const title = String(fd.get('title')).trim(), start = String(fd.get('start') || ''), end = String(fd.get('end') || '');
    if (!title) return;
    if (start && end && end < start) return toast('La hora de fin es anterior a la de inicio', 'error');
    const item = { id: uid(), title, start, end, days: [], day: 1 };
    if (s.type === 'weekly') {
      item.days = fd.getAll('days').map(Number);
      if (!item.days.length) return toast('Elige al menos un día de la semana', 'error');
    }
    if (s.type === 'monthly') {
      item.day = +fd.get('day');
      if (!Number.isInteger(item.day) || item.day < 1 || item.day > 31) return toast('Día del mes inválido', 'error');
    }
    s.items.push(item);
    commit(); renderSchedule();
    warnConflicts(s, item, 'Actividad agregada');
    return true;
  }
};
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const ok = forms[f.dataset.form]?.(f);
  if (ok === true && f.closest('#sheetRoot')) { f.reset?.(); closeSheetNow(); }    // guardado: se cierra la ventana
});
// Algo escrito dentro de la ventana emergente = hay cambios por perder
['input', 'change'].forEach(t => document.addEventListener(t, e => { if (sheet && e.target.closest && e.target.closest('#sheetRoot')) sheet.dirty = true; }, true));

/* <details> no propaga "toggle": se escucha en captura para recordar formularios abiertos */
document.addEventListener('toggle', e => {
  const d = e.target;
  if (!d.matches) return;
  if (d.matches('details.sched-opts')) d.open ? ui.openOpts.add(d.dataset.opts) : ui.openOpts.delete(d.dataset.opts);
  else if (d.matches('details.add-item')) d.open ? ui.openForms.add(d.dataset.sid) : ui.openForms.delete(d.dataset.sid);
}, true);

window.addEventListener('beforeunload', e => {
  flushScratch();
  if (ui.editor.dirty) { e.preventDefault(); e.returnValue = ''; }   // nota sin guardar
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { flushScratch(); return; }
  if (D.todayKey() !== ui.today) {            // pasó la medianoche con la app abierta
    const followed = ui.active === ui.today;
    ui.today = D.todayKey();
    if (followed) setActiveSilent(ui.today);
    ensureGiftTasks();
    render();
  }
});
