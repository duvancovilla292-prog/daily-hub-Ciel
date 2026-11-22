/* ===== js/views/tasks.js — Vista: tareas =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

function taskRow(t) {
  const lk = linkLabel(t.link);
  return `<li class="task ${t.completed ? 'done' : ''}" data-id="${t.id}">
    <label class="check"><input type="checkbox" data-change="toggle-task" data-id="${t.id}" ${t.completed ? 'checked' : ''} aria-label="Completar"><span class="box"></span></label>
    <span class="t-title">${esc(t.title)}</span>
    <button class="link-chip ${lk ? 'on' : ''}" data-action="relink" data-id="${t.id}" title="Vincular a una actividad del horario">🔗${lk ? ' ' + esc(lk) : ''}</button>
    <button class="prio ${t.priority}" data-action="cycle-prio" data-id="${t.id}" title="Cambiar prioridad">${PRIO[t.priority].label}</button>
    <button class="icon-btn" data-action="del-task" data-id="${t.id}" aria-label="Eliminar tarea">${ICON_X}</button>
  </li>`;
}

function renderTasks() {
  const all = state.tasks, tk = ui.today, tmonth = tk.slice(0, 7);
  const done = all.filter(t => t.completed).length, pend = all.length - done;
  const pct = all.length ? Math.round(done / all.length * 100) : 0;
  $('#taskStats').innerHTML = `
    <div class="stat"><b>${all.length}</b><span>Total</span></div>
    <div class="stat"><b>${pend}</b><span>Pendientes</span></div>
    <div class="stat"><b>${done}</b><span>Hechas</span></div>
    <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`;

  $$('#taskStatusSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === ui.taskStatus));
  $('#taskScope').value = ui.taskScope;
  fillLinkSelect($('#taskLink'));

  let list = all.filter(t => hit(t.title, ui.query) || hit(linkLabel(t.link), ui.query));
  if (ui.taskStatus === 'pending') list = list.filter(t => !t.completed);
  if (ui.taskStatus === 'done') list = list.filter(t => t.completed);
  if (ui.taskScope === 'active') list = list.filter(t => t.date === ui.active);
  if (ui.taskScope === 'month') list = list.filter(t => t.date.slice(0, 7) === tmonth);
  if (ui.taskScope === 'overdue') list = list.filter(t => !t.completed && t.date < tk);

  if (!list.length) {
    $('#taskList').innerHTML = `<div class="empty">${all.length ? 'No hay tareas que coincidan con los filtros.' : 'Todavía no tienes tareas. Crea la primera desde el formulario.'}</div>`;
    return;
  }
  const groups = {};
  list.forEach(t => (groups[t.date] = groups[t.date] || []).push(t));
  $('#taskList').innerHTML = Object.keys(groups).sort().map(date => {
    const items = groups[date].sort((a, b) => (a.completed - b.completed) || (PRIO[b.priority].rank - PRIO[a.priority].rank));
    const late = date < tk && items.some(t => !t.completed);
    const rel = D.rel(date);
    return `<div class="group"><h3>${esc(D.long(date))}${rel ? `<small>${rel}</small>` : ''}${late ? '<small class="late">atrasada</small>' : ''}</h3><ul class="tasks">${items.map(taskRow).join('')}</ul></div>`;
  }).join('');
}
