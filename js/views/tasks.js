/* ===== js/views/tasks.js — Vista: tareas =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

/** Fila de tarea. `key` = día que se está mostrando (importa en las que se repiten: el check es de ese día). */
function taskRow(t, key) {
  const k = key || t.date, done = doneOn(t, k), lk = linkLabel(t.link), meta = taskMeta(t);
  return `<li class="task ${done ? 'done' : ''}" data-id="${esc(t.id)}">
    <label class="check"><input type="checkbox" data-change="toggle-task" data-id="${esc(t.id)}" data-key="${esc(k)}" ${done ? 'checked' : ''} aria-label="${t.mode === 'repeat' ? 'Hecha este día' : 'Completar'}"><span class="box"></span></label>
    <span class="t-title"><span class="t-name">${esc(t.title)}</span>${taskInfo(t)}${meta ? `<small class="t-meta">${esc(meta)}</small>` : ''}${subList(t)}${moveBtns(t)}</span>
    ${taskActs(t, lk)}
  </li>`;
}
/** Hora, etiquetas y avance de subtareas (el botón despliega la lista). */
function taskInfo(t) {
  const parts = [];
  const tags = t.tags || [], subs = t.subtasks || [];
  if (t.time) parts.push(`<span class="t-time">⏰ ${fmtT(t.time)}</span>`);
  if (dueSoon(t)) parts.push(`<span class="t-due">⏳ ${dueLabel(t)}</span>`);
  const pn = personName(t.person);
  if (pn) parts.push(`<button class="t-person" data-action="open-person" data-id="${esc(t.person)}" title="Ver la ficha de ${esc(pn)}">👤 ${esc(pn)}</button>`);
  tags.forEach(g => parts.push(`<span class="t-tag">#${esc(g)}</span>`));
  if (subs.length) {
    const d = subs.filter(x => x.done).length;
    parts.push(`<button class="t-subs ${d === subs.length ? 'all' : ''}" data-action="toggle-subs" data-id="${esc(t.id)}" aria-expanded="${ui.openSubs.has(t.id)}" title="Subtareas">☑ ${d}/${subs.length}</button>`);
  }
  return parts.length ? `<span class="t-info">${parts.join('')}</span>` : '';
}
const subList = t => (t.subtasks || []).length && ui.openSubs.has(t.id)
  ? `<ul class="t-sublist">${t.subtasks.map(x => `<li class="${x.done ? 'done' : ''}"><label class="check"><input type="checkbox" data-change="toggle-sub" data-id="${esc(t.id)}" data-sub="${esc(x.id)}" ${x.done ? 'checked' : ''} aria-label="Subtarea hecha"><span class="box"></span></label><span>${esc(x.text)}</span></li>`).join('')}</ul>`
  : '';
/** Atrasadas: mover a hoy o a mañana (en las de periodo se mueve la fecha límite). */
const moveBtns = t => t.mode !== 'repeat' && isOverdue(t)
  ? `<span class="t-move"><span class="late-lbl">Atrasada</span><button class="btn btn-ghost btn-xs" data-action="move-task" data-id="${esc(t.id)}" data-to="0">→ Hoy</button><button class="btn btn-ghost btn-xs" data-action="move-task" data-id="${esc(t.id)}" data-to="1">→ Mañana</button></span>`
  : '';
/** Fila del grupo "Se repiten": sin check (se marca en cada día), con su avance. */
function repeatRow(t) {
  const st = taskStatus(t);
  return `<li class="task rep ${st}" data-id="${esc(t.id)}">
    <span class="rep-ico" aria-hidden="true">🔁</span>
    <span class="t-title"><span class="t-name">${esc(t.title)}</span>${taskInfo(t)}<small class="t-meta">${esc(taskMeta(t))}</small>${subList(t)}</span>
    ${taskActs(t, linkLabel(t.link))}
  </li>`;
}
const taskActs = (t, lk) => `<span class="t-acts">${lk ? `<span class="link-chip on" title="Vinculada a: ${esc(lk)}">🔗 ${esc(lk)}</span>` : ''}
    <span class="prio ${t.priority}" title="Prioridad">${PRIO[t.priority].label}</span>
    <button class="icon-btn edit" data-action="edit-task" data-id="${esc(t.id)}" aria-label="Editar tarea" title="Editar">${ICON_EDIT}</button>
    <button class="icon-btn" data-action="del-task" data-id="${esc(t.id)}" aria-label="Eliminar tarea" title="Eliminar">${ICON_X}</button></span>`;

/** Lee el formulario de tarea (crear o editar). Devuelve los datos o un texto de error. */
function readTaskForm(f) {
  const fd = new FormData(f);
  const title = String(fd.get('title') || '').trim(), date = String(fd.get('date') || ''), mode = String(fd.get('mode') || 'once');
  const due = String(fd.get('due') || ''), link = parseLink(fd.get('link')), time = String(fd.get('time') || '');
  const person = String(fd.get('person') || ''), personOk = state.birthdays.some(b => b.id === person) ? person : '';
  if (time && !TIME_RE.test(time)) return 'Hora inválida';
  if (!title) return 'Escribe el título';
  if (!D.isValidKey(date)) return 'Elige una fecha válida';
  if (mode === 'span') {
    if (!D.isValidKey(due)) return 'Elige la fecha límite';
    if (due < date) return 'La fecha límite es anterior a la fecha de inicio';
  }
  if (mode === 'repeat') {
    if (!link) return 'Para que se repita, vincúlala a una actividad del horario';
    if (due && (!D.isValidKey(due) || due < date)) return 'La fecha límite es anterior a la fecha de inicio';
  }
  const subTexts = String(fd.get('subtasks') || '').split('\n').map(x => x.trim().slice(0, 100)).filter(Boolean).slice(0, 30);
  return { title, date, time, mode: TASK_MODES[mode] ? mode : 'once', due: mode === 'once' ? '' : due, priority: PRIO[fd.get('priority')] ? String(fd.get('priority')) : 'medium', link, tags: parseTags(fd.get('tags')), subTexts, person: personOk };
}
/** Subtareas a partir del texto (una por línea): las que no cambiaron conservan si estaban hechas. */
function mergeSubtasks(old, texts) {
  const pool = old.slice();
  return texts.map(text => {
    const i = pool.findIndex(x => x.text === text);
    if (i >= 0) return pool.splice(i, 1)[0];
    return { id: uid(), text, done: false };
  });
}
/** Muestra u oculta la fecha límite y la ayuda según el tipo elegido. */
function syncTaskForm(f) {
  const mode = f.elements.mode.value;
  f.querySelector('.due-wrap').hidden = mode === 'once';
  f.elements.due.required = mode === 'span';
  f.querySelector('.lbl-date').textContent = mode === 'once' ? 'Fecha' : 'Desde';
  f.querySelector('.lbl-due').textContent = mode === 'repeat' ? 'Hasta (opcional)' : 'Fecha límite';
  const help = f.querySelector('.mode-help');
  help.hidden = mode === 'once';
  help.textContent = mode === 'span'
    ? 'Abarca todo el periodo y se marca hecha una sola vez.'
    : 'Aparece cada día en que ocurre la actividad vinculada y se marca hecha cada día por separado. Sin fecha "hasta", se repite hasta que termine el horario. Al terminar, queda hecha si la hiciste al menos un día.';
}

function renderTasks() {
  const all = state.tasks, tk = ui.today, tmonth = tk.slice(0, 7);
  const done = all.filter(t => taskStatus(t) === 'done').length, pend = all.length - done;
  const pct = all.length ? Math.round(done / all.length * 100) : 0;
  $('#taskStats').innerHTML = `
    <div class="stat"><b>${all.length}</b><span>Total</span></div>
    <div class="stat"><b>${pend}</b><span>Pendientes</span></div>
    <div class="stat"><b>${done}</b><span>Hechas</span></div>
    <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`;

  $$('#taskStatusSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === ui.taskStatus));
  $('#taskScope').value = ui.taskScope;
  fillLinkSelect($('#taskLink'));

  const q = ui.query, A = ui.active;
  // Filtro de etiquetas (solo se muestra si alguna tarea tiene etiquetas)
  const tags = parseTags(all.flatMap(t => t.tags || [])).sort((a, b) => norm(a).localeCompare(norm(b)));
  if (ui.taskTag && !tags.some(g => norm(g) === norm(ui.taskTag))) ui.taskTag = '';
  const tagSel = $('#taskTag');
  tagSel.hidden = !tags.length;
  tagSel.innerHTML = `<option value="">Todas las etiquetas</option>` + tags.map(g => `<option value="${esc(g)}">#${esc(g)}</option>`).join('');
  tagSel.value = ui.taskTag;
  const match = t => (hit(t.title, q) || hit(linkLabel(t.link), q) || hit(personName(t.person), q) || hit((t.tags || []).join(' '), q) || hit((t.subtasks || []).map(x => x.text).join(' '), q))
    && (!ui.taskTag || (t.tags || []).some(g => norm(g) === norm(ui.taskTag)));
  // Cada tarea se muestra en un día: las normales en su fecha, las de periodo en su inicio
  // (o en la fecha activa si se filtra por ella) y las que se repiten solo en la fecha activa.
  let list = [];
  all.filter(match).forEach(t => {
    if (t.mode === 'repeat') { if (taskOn(t, A)) list.push({ t, key: A }); }
    else if (ui.taskScope === 'active') { if (taskOn(t, A)) list.push({ t, key: A }); }
    else list.push({ t, key: t.date });
  });
  if (ui.taskStatus === 'pending') list = list.filter(e => !doneOn(e.t, e.key));
  if (ui.taskStatus === 'done') list = list.filter(e => doneOn(e.t, e.key));
  if (ui.taskScope === 'month') list = list.filter(e => e.t.mode === 'span' ? e.t.date.slice(0, 7) <= tmonth && e.t.due.slice(0, 7) >= tmonth : e.key.slice(0, 7) === tmonth);
  if (ui.taskScope === 'overdue') list = list.filter(e => e.t.mode !== 'repeat' && isOverdue(e.t));

  // Grupo de gestión de las que se repiten (para editarlas aunque hoy no aparezcan)
  let reps = all.filter(t => t.mode === 'repeat' && match(t));
  if (ui.taskStatus === 'pending') reps = reps.filter(t => taskStatus(t) === 'pending');
  if (ui.taskStatus === 'done') reps = reps.filter(t => taskStatus(t) === 'done');
  if (ui.taskScope === 'overdue') reps = reps.filter(t => taskStatus(t) === 'missed');
  if (ui.taskScope === 'active') reps = [];

  if (!list.length && !reps.length) {
    $('#taskList').innerHTML = `<div class="empty">${all.length ? 'No hay tareas que coincidan con los filtros.' : 'Todavía no tienes tareas. Crea la primera desde el formulario.'}</div>`;
    return;
  }
  const groups = {};
  list.forEach(e => (groups[e.key] = groups[e.key] || []).push(e));
  $('#taskList').innerHTML = Object.keys(groups).sort().map(date => {
    const items = groups[date].sort((a, b) => (doneOn(a.t, a.key) - doneOn(b.t, b.key)) || (a.t.time || '99').localeCompare(b.t.time || '99') || (PRIO[b.t.priority].rank - PRIO[a.t.priority].rank));
    const late = items.some(e => e.t.mode !== 'repeat' && isOverdue(e.t));
    const rel = D.rel(date);
    return `<div class="group"><h3>${esc(D.long(date))}${rel ? `<small>${rel}</small>` : ''}${late ? '<small class="late">atrasada</small>' : ''}</h3><ul class="tasks">${items.map(e => taskRow(e.t, e.key)).join('')}</ul></div>`;
  }).join('') + (reps.length ? `<div class="group"><h3>🔁 Se repiten<small class="muted">se marcan en cada día</small></h3><ul class="tasks">${reps.map(repeatRow).join('')}</ul></div>` : '');
}
