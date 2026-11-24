/* ===== js/views/today.js — Vista "Hoy": la agenda del día activo =====
   Junta en una sola pantalla las actividades de todos los horarios, las tareas (con y sin hora), las atrasadas,
   las notas y los cumpleaños. Script clásico: comparte el ámbito global con los demás archivos de /js. */
'use strict';

function renderToday() {
  const k = ui.active, rel = D.rel(k), hol = holidayName(k), isToday = k === ui.today;
  renderAlerts();

  $('#todayHead').innerHTML = `<h2>${esc(cap(D.long(k)))}${rel ? `<span class="pill">${rel}</span>` : ''}</h2>
    ${hol ? `<span class="hol-badge" title="Festivo en Colombia">🇨🇴 Festivo: ${esc(hol)}</span>` : ''}
    ${isToday ? '' : '<button class="btn btn-ghost" data-action="date-rel" data-offset="0">Volver a hoy</button>'}`;

  /* --- Agenda: actividades de todos los horarios + tareas con hora --- */
  const ents = [], allDay = [];
  state.schedules.forEach(s => s.items.forEach(it => {
    if (!occurs(s, it, k)) return;
    if (it.start) ents.push({ kind: 's', s, it, title: it.title, start: it.start, end: it.end, color: s.color, sub: s.name });
    else allDay.push({ s, it });
  }));
  const dayTasks = Cal.tasksOn(k);
  dayTasks.forEach(t => { if (t.time && t.mode !== 'span') ents.push({ kind: 't', t, title: t.title, start: t.time, end: '', color: 'var(--task)', sub: 'Tarea' }); });

  let agenda = '';
  if (allDay.length) agenda += `<div class="today-allday">${allDay.map(x => `<span class="it-chip" style="--c:${x.s.color}"><b>${esc(x.it.title)}</b> · ${esc(x.s.name)} · todo el día</span>`).join('')}</div>`;
  if (ents.length) {
    const list = ents.map(e => ({ e, s0: toMin(e.start), e0: e.end && e.end > e.start ? toMin(e.end) : toMin(e.start) + 30 }))
      .sort((x, y) => x.s0 - y.s0 || y.e0 - x.e0);
    const a = Math.floor(Math.min(...list.map(x => x.s0)) / 60);
    const b = Math.min(24, Math.max(a + 1, Math.ceil(Math.max(...list.map(x => x.e0)) / 60)));
    laneLayout(list);
    let lines = '';
    for (let h = a; h <= b; h++) lines += `<div class="tl-line" style="top:${(h - a) * HOUR_PX}px"><span class="hl">${hourLabel(h % 24)}</span></div>`;
    const blocks = list.map(x => {
      const top = (x.s0 - a * 60) * HOUR_PX / 60 + 1, h = Math.max((x.e0 - x.s0) * HOUR_PX / 60, 24), e = x.e;
      const clash = x.n > 1 ? '<span class="clash" title="Se cruza con otra actividad o tarea">⚠</span>' : '';
      const time = e.kind === 't' ? fmtT(e.start) : timeLabel(e.it);
      const done = e.kind === 't' && doneOn(e.t, k);
      const check = e.kind === 't' ? `<label class="check mini-check"><input type="checkbox" data-change="toggle-task" data-id="${esc(e.t.id)}" data-key="${esc(k)}" ${done ? 'checked' : ''} aria-label="Completar"><span class="box"></span></label>` : '';
      const name = `<b>${e.kind === 't' ? '⏰ ' : ''}${esc(e.title)}</b>`;
      const body = h - 13 < 40
        ? `<span class="act-head">${check}${name}<small>${time}</small>${clash}</span>`
        : `<span class="act-head">${check}${name}${clash}</span><small>${time} · ${esc(e.sub)}</small>`;
      return `<div class="act tl-act ${e.kind === 't' ? 'task-act' : ''} ${done ? 'done' : ''} ${h - 13 < 40 ? 'mid' : ''}" style="--c:${e.color};top:${top}px;height:${h - 3}px;left:calc(${x.c} * 100% / ${x.n});width:calc(100% / ${x.n} - 4px)" title="${esc(e.title)} · ${esc(time)}">${body}</div>`;
    }).join('');
    agenda += `<div class="tl" style="height:${(b - a) * HOUR_PX}px">${lines}<div class="tl-acts">${blocks}</div></div>`;
  }
  const skipped = state.schedules.filter(s => skipReason(s, k) && s.items.some(it => occursBase(s, it, k)));
  agenda += skipped.map(s => `<p class="off-msg">🚫 <b>${esc(s.name)}</b>: no aplica este día (${esc(skipReason(s, k))}).</p>`).join('');
  if (!agenda) agenda = `<p class="empty-note">Sin actividades programadas${state.schedules.length ? '' : '. Crea un horario en la pestaña Horario'}. Las tareas con hora también aparecen aquí.</p>`;
  $('#todayTimeline').innerHTML = agenda;

  /* --- Al lado: tareas, atrasadas, notas y cumpleaños --- */
  const byTime = (x, y) => (doneOn(x, k) - doneOn(y, k)) || (x.time || '99').localeCompare(y.time || '99') || (PRIO[y.priority].rank - PRIO[x.priority].rank);
  const overdue = state.tasks.filter(t => t.mode !== 'repeat' && isOverdue(t) && !taskOn(t, k));
  const notes = Cal.notesOn(k);
  const bdays = Cal.birthdaysOn(k);
  let side = '';
  if (bdays.length) side += `<div class="panel" style="--c:var(--accent2)"><span class="ptitle">Cumpleaños</span><ul class="mini-list">${bdays.map(x => `<li class="person-link" data-action="open-person" data-id="${esc(x.b.id)}" role="button" tabindex="0">🎂 <b>${esc(displayName(x.b.name))}</b>${x.age ? ` — cumple ${x.age}` : ''} ${bdayTags(x.b)}</li>`).join('')}</ul></div>`;
  side += `<div class="panel" style="--c:var(--accent)"><span class="ptitle">Tareas</span>${dayTasks.length ? `<ul class="tasks">${dayTasks.sort(byTime).map(t => taskRow(t, k)).join('')}</ul>` : '<p class="empty-note">Sin tareas para este día.</p>'}
    <button class="btn btn-ghost" data-action="new-task" data-key="${esc(k)}">+ Nueva tarea</button></div>`;
  if (overdue.length) {                                         // las 5 más antiguas; el resto, en Tareas → Atrasadas
    const first = overdue.sort((x, y) => (x.mode === 'span' ? x.due : x.date).localeCompare(y.mode === 'span' ? y.due : y.date)).slice(0, 5);
    side += `<div class="panel" style="--c:var(--danger)"><span class="ptitle">Atrasadas</span><ul class="tasks">${first.map(t => taskRow(t)).join('')}</ul>
      ${overdue.length > 5 ? `<button class="btn btn-ghost" data-action="show-overdue">Ver las ${overdue.length} atrasadas</button>` : ''}</div>`;
  }
  side += `<div class="panel" style="--c:var(--mint)"><span class="ptitle">Notas</span>${notes.length ? notes.map(n => `<button class="note-chip" data-action="open-note" data-key="${esc(k)}" data-id="${esc(n.id)}">${n.pinned ? '📌 ' : ''}${n.type === 'list' ? '☑' : '📝'} ${esc(noteLabel(n))}</button>`).join('') : '<p class="empty-note">No hay notas este día.</p>'}
    <button class="btn btn-ghost" data-action="open-note" data-key="${esc(k)}">+ Nueva nota</button></div>`;
  $('#todaySide').innerHTML = side;
}
