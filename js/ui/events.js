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
    } else t.completed = el.checked;
    el.closest('.task, li')?.classList.toggle('done', el.checked);   // transición visual inmediata
    commit();
    renderHeader();
    setTimeout(render, 280);
  },
  'bday-cat-filter': el => { ui.bdayCat = el.value; renderBirthdays(); },
  'task-mode': el => syncTaskForm(el.closest('form')),
  'task-scope': el => { ui.taskScope = el.value; renderTasks(); },
  'date-pick': el => setActive(el.value),
  'note-scope': el => { ui.noteScope = el.value; renderNotesList(); },
  'note-date': el => { if (D.isValidKey(el.value)) { ui.editor.date = el.value; markDirty(); } },
  'note-link': el => { ui.editor.link = el.value; markDirty(); },
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
  const rows = [['Tareas', 'tasks'], ['Notas', 'notes'], ['Cumpleaños', 'birthdays'], ['Categorías de cumpleaños', 'cats'], ['Horarios', 'schedules'], ['Actividades de horarios', 'items']];
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

const forms = {
  'admin-login'(f) {
    const err = $('#adminErr');
    if (checkAdmin(f.elements.user.value, f.elements.pass.value)) {
      ui.admin = true; err.hidden = true; f.reset();
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* sin sessionStorage: dura hasta recargar */ }
      renderHeader(); toast('Panel desbloqueado', 'ok');
    } else {
      err.hidden = false; err.textContent = 'Usuario o contraseña incorrectos';
      f.elements.pass.value = ''; f.elements.pass.focus();
    }
  },
  task(f) {
    const r = readTaskForm(f);
    if (typeof r === 'string') return toast(r, 'error');
    state.tasks.push({ id: uid(), ...r, completed: false, doneDates: [] });
    commit(); f.elements.title.value = ''; f.elements.link.value = ''; f.elements.due.value = ''; f.elements.mode.value = 'once'; syncTaskForm(f); f.elements.title.focus();
    renderTasks(); renderHeader(); toast('Tarea agregada', 'ok');
  },
  'quick-task'(f) {
    const fd = new FormData(f), title = String(fd.get('title')).trim();
    if (!title) return;
    state.tasks.push({ id: uid(), title, date: ui.active, completed: false, priority: String(fd.get('priority')), link: null, mode: 'once', due: '', doneDates: [] });
    commit(); render(); toast('Tarea agregada', 'ok');
    $('#dayDetail input[name=title]')?.focus();
  },
  birthday(f) {
    const b = readBdayForm(f);
    if (typeof b === 'string') return toast(b, 'error');
    state.birthdays.push({ id: uid(), ...b });
    commit(); f.reset(); render(); toast(`Cumpleaños de ${b.name} agregado`, 'ok');
  },
  'bday-cat'(f) {
    if (!ui.admin) return toast('Solo el administrador puede crear categorías', 'error');
    const name = f.elements.name.value.trim().slice(0, 30);
    if (!name) return;
    if (state.birthdayCategories.some(c => norm(c.name) === norm(name))) return toast('Esa categoría ya existe', 'error');
    state.birthdayCategories.push({ id: uid(), name });
    commit(); f.reset(); render(); f.elements.name.focus(); toast(`Categoría “${name}” creada`, 'ok');
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
    const s = { id: uid(), name, type, color: String(fd.get('color') || SCHED_COLORS[0]), startDate: start, endDate: end, weekdays, hourStart: hs, hourEnd: he, items: [] };
    state.schedules.push(s);
    commit(); f.reset(); $('#schedColors input').checked = true; syncSchedForm();
    ui.newSchedOpen = false; ui.schedFilter = 'all'; ui.openForms.add(s.id);
    ui.anchors[s.id] = start > ui.active || (end && end < ui.active) ? start : ui.active;   // muestra el periodo vigente
    renderSchedule(); toast('Horario creado: ya puedes agregar actividades', 'ok');
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
    ui.openForms.add(s.id);
    commit(); renderSchedule();
    $(`details[data-sid="${s.id}"] input[name=title]`)?.focus();
    toast('Actividad agregada', 'ok');
  }
};
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  forms[f.dataset.form]?.(f);
});

/* <details> no propaga "toggle": se escucha en captura para recordar formularios abiertos */
document.addEventListener('toggle', e => {
  const d = e.target;
  if (d.matches && d.matches('details.add-item')) d.open ? ui.openForms.add(d.dataset.sid) : ui.openForms.delete(d.dataset.sid);
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
    render();
  }
});
