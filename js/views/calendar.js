/* ===== js/views/calendar.js — Vista: calendario =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

function renderCalendar() {
  const { y, m } = ui.cal;
  $('#calTitle').textContent = `${cap(MONTHS[m])} ${y}`;

  const f = activeFilters(), q = ui.query, allOn = f.size === TYPES.length;
  $('#calFilters').innerHTML =
    `<button class="chip ${allOn ? 'on' : ''}" data-action="filter-all">Todo</button>` +
    TYPES.map(k => `<button class="chip ${!allOn && f.has(k) ? 'on' : ''}" data-action="toggle-filter" data-type="${k}" aria-pressed="${!allOn && f.has(k)}">${TYPE_LABEL[k]}</button>`).join('');

  $('#calDows').innerHTML = WD_LONG.map((n, i) => `<div class="cal-dow"><span class="l">${n}</span><span class="s">${WD_SHORT[i].toLowerCase()}</span></div>`).join('');

  let html = '', matchDays = 0;
  Cal.monthCells(y, m).forEach(key => {
    if (!key) { html += '<div class="cal-cell empty" aria-hidden="true"></div>'; return; }
    const info = Cal.dayInfo(key, q);
    const chips = [], dots = [];
    if (f.has('birthdays') && info.bdays.length) {
      dots.push('<i class="d b"></i>');
      info.bdays.forEach(x => chips.push({ c: 'b', txt: '🎂 ' + x.b.name }));
    }
    // En la cuadrícula, las tareas de periodo solo se marcan en su inicio y su fecha límite (para no llenar todos los días)
    const cellTasks = info.tasks.filter(x => x.mode !== 'span' || key === x.date || key === x.due);
    if (f.has('tasks') && cellTasks.length) {
      dots.push(`<i class="d t ${cellTasks.some(x => !doneOn(x, key)) ? '' : 'done'}"></i>`);
      cellTasks.forEach(x => chips.push({ c: 't' + (doneOn(x, key) ? ' done' : ''), txt: (x.mode === 'repeat' ? '🔁 ' : x.mode === 'span' ? (key === x.due ? '⏳ vence: ' : '⏳ ') : '') + x.title }));
    }
    if (f.has('notes') && info.notes.length) {
      dots.push('<i class="d n"></i>');
      info.notes.forEach(n => chips.push({ c: 'n', txt: '📝 ' + noteLabel(n) }));
    }
    if (f.has('schedules') && info.sched.length) {
      dots.push('<i class="d s"></i>');
      info.sched.forEach(x => chips.push({ c: 's', style: `--c:${x.s.color}`, txt: (x.item.start ? fmtT(x.item.start) + ' ' : '') + x.item.title }));
    }

    const match = dots.length > 0;
    if (q && match) matchDays++;
    const cls = ['cal-cell', key === ui.today ? 'today' : '', key === ui.active ? 'sel' : '', q && !match ? 'dim' : '', q && match ? 'hit' : ''].join(' ');
    const shown = chips.slice(0, 3).map(c => `<span class="cc ${c.c}" ${c.style ? `style="${c.style}"` : ''}>${esc(c.txt)}</span>`).join('');
    const more = chips.length > 3 ? `<span class="cc more">+${chips.length - 3} más</span>` : '';
    html += `<button class="${cls}" data-action="select-day" data-key="${esc(key)}" aria-label="${esc(D.long(key))}"><span class="num">${+key.slice(8)}</span><span class="dots">${dots.join('')}</span><span class="cell-chips">${shown}${more}</span></button>`;
  });
  $('#calMonth').innerHTML = html;

  $('#calSummary').textContent = q
    ? `${plural(matchDays, 'día con coincidencias', 'días con coincidencias')} para “${ui.queryRaw}”`
    : (allOn ? 'Toca un día para ver su detalle. Usa las flechas para cambiar de mes.' : 'Mostrando: ' + TYPES.filter(k => f.has(k)).map(k => TYPE_LABEL[k].toLowerCase()).join(', '));

  // Cuadro de notas del mes (como en la plantilla "Mi mes")
  const prefix = `${y}-${D.pad(m + 1)}`;
  const mine = [];
  if (f.has('notes')) Object.keys(state.notes).filter(k => k.startsWith(prefix)).sort().forEach(k => state.notes[k].forEach(n => { if (hit(noteText(n), q)) mine.push([k, n]); }));
  $('#calNotes').innerHTML = `<span class="script">notas</span>` + (mine.length
    ? mine.map(([k, n]) => `<button class="note-chip" data-action="open-note" data-key="${esc(k)}" data-id="${esc(n.id)}"><b>${+k.slice(8)}</b> ${esc(noteLabel(n))}</button>`).join('')
    : '<span class="muted small">No hay notas en este mes.</span>');

  renderAlerts();
}

function renderAlerts() {
  const k = ui.active, rel = D.rel(k);
  const here = Cal.birthdaysOn(k);
  const up = [];
  for (let i = 1; i <= 7; i++) {
    const kk = D.add(k, i);
    Cal.birthdaysOn(kk).forEach(x => up.push({ ...x, i, key: kk }));
  }
  let html = '';
  if (here.length) {
    html += `<div class="alert"><span class="em">🎂</span><div><b>${rel ? rel + ' ' : ''}${here.map(x => esc(x.b.name) + (x.age ? ` cumple ${x.age} años` : ' está de cumpleaños')).join(' · ')}</b><div class="muted small">${cap(D.long(k))}</div></div></div>`;
  }
  if (up.length) {
    html += `<div class="alert soft"><span class="em">🎈</span><div><b>Próximos 7 días</b><div class="small muted">${up.map(x => `${esc(x.b.name)} — ${x.i === 1 ? 'al día siguiente' : 'en ' + x.i + ' días'} (${D.short(x.key)})${x.age ? ', cumple ' + x.age : ''}`).join('<br>')}</div></div></div>`;
  }
  $('#bdayAlerts').innerHTML = html;
  $('#bdayAlerts2').innerHTML = html;
}

/* Ventana con el detalle del día (se abre al tocar un día del calendario) */
function detailHtml(k) {
  const info = Cal.dayInfo(k, ''), rel = D.rel(k);
  let h = `<h2>${esc(cap(D.long(k)))}${rel ? `<span class="pill">${rel}</span>` : ''}</h2>`;

  h += '<section><h3>Cumpleaños</h3>' + (info.bdays.length
    ? `<ul class="mini-list">${info.bdays.map(x => `<li>🎂 <b>${esc(x.b.name)}</b>${x.age ? ` — cumple ${x.age} años` : ''}${x.b.category || x.b.tag ? ` <span class="bday-tags" style="display:inline-flex">${bdayTags(x.b)}</span>` : ''}</li>`).join('')}</ul>`
    : '<p class="empty-note">Nadie cumple años este día.</p>') + '</section>';

  h += `<section><h3>Tareas</h3>${info.tasks.length ? `<ul class="tasks">${info.tasks.map(t => taskRow(t, k)).join('')}</ul>` : '<p class="empty-note">Sin tareas para este día.</p>'}
    <form data-form="quick-task" class="quick" autocomplete="off">
      <input name="title" placeholder="Nueva tarea…" maxlength="140" required aria-label="Nueva tarea">
      <select name="priority" aria-label="Prioridad"><option value="low">Baja</option><option value="medium" selected>Media</option><option value="high">Alta</option></select>
      <button class="btn btn-primary" aria-label="Agregar">+</button>
    </form></section>`;

  h += '<section><h3>Notas</h3>' + (info.notes.length
    ? `<div class="mini-list">${info.notes.map(n => `<button class="note-item" data-action="open-note" data-key="${esc(k)}" data-id="${esc(n.id)}"><b>${n.type === 'list' ? '☑' : '📝'} ${esc(noteLabel(n))}</b></button>`).join('')}</div>`
    : '<p class="empty-note">No hay notas escritas.</p>') +
    `<button class="btn btn-ghost" style="margin-top:8px" data-action="open-note" data-key="${esc(k)}">+ Nueva nota</button></section>`;

  h += '<section><h3>Horario</h3>' + (info.sched.length
    ? `<div class="mini-list">${info.sched.map(x => `<div class="s-line" style="--c:${x.s.color}"><span class="tm">${timeLabel(x.item)}</span><span>${esc(x.item.title)} <span class="muted small">· ${esc(x.s.name)}</span><div class="tags">${linkTags(x.s.id, x.item.id, k)}</div></span></div>`).join('')}</div>`
    : '<p class="empty-note">Sin actividades programadas.</p>') + '</section>';
  return h;
}

function renderSheet() {
  $('#daySheet').hidden = !ui.sheet;
  if (ui.sheet) $('#dayDetail').innerHTML = detailHtml(ui.active);
}
