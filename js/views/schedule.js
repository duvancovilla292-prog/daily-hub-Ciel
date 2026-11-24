/* ===== js/views/schedule.js — Vista: horarios diario / semanal / mensual =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

const anchorOf = s => ui.anchors[s.id] || ui.active;
function shiftAnchor(s, d) {
  const a = anchorOf(s);
  ui.anchors[s.id] = s.type === 'daily' ? D.add(a, d) : s.type === 'weekly' ? D.add(a, 7 * d) : D.addMonths(a, d);
}
function periodLabel(s, a) {
  if (s.type === 'daily') return cap(D.long(a));
  if (s.type === 'weekly') { const m = D.monday(a); return `${D.parse(m).getDate()} – ${D.full(D.add(m, 6))}`; }
  return `${cap(MONTHS[D.parse(a).getMonth()])} ${D.parse(a).getFullYear()}`;
}
const vigencia = s => `${s.startDate ? 'Desde ' + D.full(s.startDate) : 'Sin fecha de inicio'} · ${s.endDate ? 'hasta ' + D.full(s.endDate) : 'sin fecha final'}`;

/** Rango de horas visible: el configurado en el horario (por defecto 6:00 AM – 9:00 PM),
    ampliado automáticamente si alguna actividad queda fuera. */
function hourRange(s) {
  let a = s.hourStart, b = s.hourEnd;
  s.items.forEach(it => {
    if (!it.start) return;
    a = Math.min(a, hourOf(it.start));
    const e = it.end && it.end > it.start ? toMin(it.end) - 1 : toMin(it.start);
    b = Math.max(b, Math.floor(e / 60));
  });
  return [a, Math.min(b, 23)];
}

/* --- Línea de tiempo: cada actividad ocupa el alto de su duración --- */
const HOUR_PX = 72;                                   // alto de una hora en la línea de tiempo
const toMin = t => hourOf(t) * 60 + +t.slice(3, 5);
const endMin = it => it.end && it.end > it.start ? toMin(it.end) : toMin(it.start) + 30;   // sin hora de fin: se dibuja de 30 min

/** Bloques posicionados (top/alto según la hora). Las actividades que se cruzan se reparten en columnas. */
/** Reparte en columnas lo que se solapa: cada elemento ({s0, e0} en minutos, ordenados) recibe su columna c y el total n. */
function laneLayout(list) {
  let group = [], groupEnd = -1, cols = [];
  const flush = () => { const n = cols.length; group.forEach(x => { x.n = n; }); group = []; cols = []; };
  list.forEach(x => {
    if (x.s0 >= groupEnd) { flush(); groupEnd = -1; }
    let c = cols.findIndex(end => end <= x.s0);
    if (c < 0) { c = cols.length; cols.push(0); }
    cols[c] = x.e0; x.c = c; group.push(x); groupEnd = Math.max(groupEnd, x.e0);
  });
  flush();
  return list;
}

function timelineBlocks(s, its, lo, hi, key) {   // lo/hi: minutos del borde superior e inferior
  const list = its.filter(it => it.start).map(it => ({ it, s0: Math.max(toMin(it.start), lo), e0: Math.min(endMin(it), hi) }))
    .filter(x => x.e0 > x.s0).sort((x, y) => x.s0 - y.s0 || y.e0 - x.e0);
  laneLayout(list);
  return list.map(x => {
    const top = (x.s0 - lo) * HOUR_PX / 60 + 1, h = Math.max((x.e0 - x.s0) * HOUR_PX / 60, 24);
    // El contenido se adapta al alto del bloque para que nada quede cortado:
    //  normal = nombre, hora y etiquetas una debajo de otra
    //  mid    = nombre y hora en una línea; debajo las etiquetas que quepan + "+N"
    //  short  = todo en una línea, con un contador de vinculadas
    const tags = linkTagList(s.id, x.it.id, key), inner = h - 3 - 10;
    const name = `<b>${esc(x.it.title)}</b>`, time = `<small>${timeLabel(x.it)}</small>`;
    const more = n => n > 0 ? `<span class="lk more" title="${n} más">+${n}</span>` : '';
    let cls = 'act tl-act', body;
    const rows = Math.floor((inner - 38) / 21);       // líneas de etiquetas que caben debajo del nombre y la hora
    if (tags.length <= rows) body = name + time + tags.join('');
    else if (rows >= 1) {                              // caben algunas: la última línea comparte espacio con "+N"
      body = name + time + tags.slice(0, rows - 1).join('') + `<span class="act-tags">${tags[rows - 1]}${more(tags.length - rows)}</span>`;
    } else if (inner >= 40) {
      const shown = tags.slice(0, 1);                 // una línea: la primera + "+N"
      cls += ' mid';
      body = `<span class="act-head">${name}${time}</span>${shown.length ? `<span class="act-tags">${shown.join('')}${more(tags.length - shown.length)}</span>` : ''}`;
    } else {
      cls += ' short';
      body = name + time + (tags.length ? `<span class="lk more" title="${plural(tags.length, 'vinculada', 'vinculadas')}">🔗 ${tags.length}</span>` : '');
    }
    return `<div class="${cls}" style="--c:${s.color};top:${top}px;height:${h - 3}px;left:calc(${x.c} * 100% / ${x.n});width:calc(100% / ${x.n} - 4px)" title="${esc(x.it.title)} · ${esc(timeLabel(x.it))}">${body}</div>`;
  }).join('');
}
const hourOptions = sel => Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === sel ? 'selected' : ''}>${hourLabel(h)}</option>`).join('');

/* --- Apartados de Tareas y Notas del periodo (día, semana o mes), con "Todas / Solo vinculadas" --- */
const onlyLinked = s => ui.panelMode[s.id] === 'linked';
function panelToggle(s) {
  const m = onlyLinked(s) ? 'linked' : 'all';
  return `<div class="seg panel-mode" role="group" aria-label="Qué tareas y notas mostrar">
    <button data-action="panel-mode" data-id="${esc(s.id)}" data-v="all" class="${m === 'all' ? 'on' : ''}">Todas</button>
    <button data-action="panel-mode" data-id="${esc(s.id)}" data-v="linked" class="${m === 'linked' ? 'on' : ''}">Solo vinculadas</button></div>`;
}
function periodTasks(s, from, to) {
  return state.tasks.filter(t => {
    if (onlyLinked(s) && !(t.link && t.link.sid === s.id)) return false;
    for (let k = from; k <= to; k = D.add(k, 1)) if (taskOn(t, k)) return true;
    return false;
  }).sort((a, b) => a.date.localeCompare(b.date));
}
function periodNotes(s, from, to) {
  const out = [];
  Object.keys(state.notes).filter(k => k >= from && k <= to).sort()
    .forEach(k => state.notes[k].forEach(n => { if (!onlyLinked(s) || (n.link && n.link.sid === s.id)) out.push([k, n]); }));
  return out;
}
function panelTaskLi(t, from, to) {
  if (t.mode === 'repeat' && from !== to) {          // en semana o mes: una línea con su avance (se marca en cada día)
    const p = repeatProgress(t, from, to);
    return `<li><span class="rep-ico" title="Se repite">🔁</span><span>${esc(t.title)} <small class="muted">· ${p.d}/${p.n} ${p.n === 1 ? 'día' : 'días'}</small></span></li>`;
  }
  const k = t.mode === 'repeat' ? from : t.date, done = doneOn(t, k);
  const note = t.mode === 'span' ? `hasta ${D.short(t.due)}` : t.mode === 'repeat' ? '🔁' : from !== to ? D.short(t.date) : '';
  return `<li class="${done ? 'done' : ''}"><label class="check"><input type="checkbox" data-change="toggle-task" data-id="${esc(t.id)}" data-key="${esc(k)}" ${done ? 'checked' : ''} aria-label="Completar"><span class="box"></span></label><span>${esc(t.title)}${note ? ` <small class="muted">· ${note}</small>` : ''}</span></li>`;
}
function periodPanels(s, from, to, label) {
  const tasks = periodTasks(s, from, to), notes = periodNotes(s, from, to), one = from === to;
  const which = onlyLinked(s) ? ' vinculadas' : '';
  return `<div class="panel"><span class="ptitle">Tareas</span>${tasks.length ? `<ul class="mini-tasks">${tasks.map(t => panelTaskLi(t, from, to)).join('')}</ul>` : `<p class="empty-note">Sin tareas${which} ${label}.</p>`}</div>
    <div class="panel"><span class="ptitle">Notas</span>${notes.length ? notes.map(([k, n]) => `<button class="note-chip" data-action="open-note" data-key="${esc(k)}" data-id="${esc(n.id)}">${one ? '' : `<b>${+k.slice(8)}</b> `}${n.type === 'list' ? '☑' : '📝'} ${esc(noteLabel(n))}</button>`).join('') : `<p class="empty-note">Sin notas${which} ${label}.</p>`}</div>`;
}

const actHtml = (s, it, key) => `<div class="act" style="--c:${s.color}"><b>${esc(it.title)}</b><small>${timeLabel(it)}</small>${linkTags(s.id, it.id, key)}</div>`;

/* --- Diario: franjas por hora + paneles laterales (plantilla "Daily plan") --- */
/** Aviso del día en el horario diario: fuera de vigencia, festivo o día saltado (con botón para saltar o restaurar). */
function dayNotice(s, key, inside) {
  if (!inside) return '<p class="off-msg">Este día queda fuera de la vigencia o de los días en que aplica el horario.</p>';
  const why = skipReason(s, key);
  if (why === 'Día saltado') return `<p class="off-msg">🚫 Día saltado: hoy no hay actividades de este horario. <button class="btn btn-ghost btn-xs" data-action="unskip" data-id="${esc(s.id)}" data-key="${esc(key)}">Restaurar</button></p>`;
  if (why) return `<p class="off-msg">🇨🇴 ${esc(why)}: este horario no aplica en festivos.</p>`;
  return s.items.length ? `<p class="skip-line"><button class="btn btn-ghost btn-xs" data-action="skip-today" data-id="${esc(s.id)}" data-key="${esc(key)}">Saltar este día</button></p>` : '';
}

function dailyView(s, key) {
  const [a, b] = hourRange(s);
  const inside = inRange(s, key) && s.weekdays.includes(D.wd(D.parse(key)));
  const occ = s.items.filter(it => occurs(s, it, key)).sort(byStart);
  const allDay = occ.filter(it => !it.start);
  let rows = '';
  if (allDay.length) rows += `<div class="hr"><span class="hl">Todo el día</span><div class="hc">${allDay.map(it => actHtml(s, it, key)).join('')}</div></div>`;
  // Cada hora es una línea con su etiqueta encima; la tabla termina en la hora final (o donde termine la última actividad)
  let end = Math.max(s.hourEnd, a + 1);
  occ.forEach(it => { if (it.start) end = Math.max(end, Math.ceil(endMin(it) / 60)); });
  end = Math.min(end, 24);
  let lines = '';
  for (let h = a; h <= end; h++) lines += `<div class="tl-line" style="top:${(h - a) * HOUR_PX}px"><span class="hl">${hourLabel(h % 24)}</span></div>`;
  rows += `<div class="tl" style="height:${(end - a) * HOUR_PX}px">${lines}<div class="tl-acts">${timelineBlocks(s, occ, a * 60, end * 60, key)}</div></div>`;
  return `<div class="daily">
    <aside class="d-side">
      ${panelToggle(s)}
      ${periodPanels(s, key, key, 'este día')}
    </aside>
    <div class="d-grid">${dayNotice(s, key, inside)}${rows}</div>
  </div>`;
}

/* --- Semanal: tabla de horas × días con celdas en forma de píldora --- */
function weeklyView(s, key) {
  const mon = D.monday(key);
  const wide = s.items.some(it => it.days.some(d => d >= 5));
  const n = wide ? 7 : 5;
  const days = Array.from({ length: n }, (_, i) => D.add(mon, i));
  const [a, b] = hourRange(s);
  const cols = `grid-template-columns: 100px repeat(${n}, minmax(120px, 1fr))`;
  let h = `<div class="wk-wrap"><div class="wk" style="${cols}"><span></span>` +
    days.map((k, i) => { const why = skipReason(s, k); return `<div class="wk-h ${k === ui.today ? 'today' : ''} ${why ? 'skipped' : ''}" ${why ? `title="${esc(why)}"` : ''}>${WD_SHORT[i].toUpperCase()} <b>${+k.slice(8)}</b>${why ? `<small>${why === 'Día saltado' ? 'saltado' : 'festivo'}</small>` : ''}</div>`; }).join('');
  const cell = (k, its) => `<div class="wk-c ${inRange(s, k) ? '' : 'off'}">${its.map(it => actHtml(s, it, k)).join('')}</div>`;
  const allDayAny = days.some(k => s.items.some(it => !it.start && occurs(s, it, k)));
  if (allDayAny) h += `<div class="wk-t">Todo el día</div>` + days.map(k => cell(k, s.items.filter(it => !it.start && occurs(s, it, k)))).join('');
  // Una fila con la columna de horas y, por cada día, una línea de tiempo del mismo alto
  const H = (b - a + 1) * HOUR_PX, slots = cls => Array.from({ length: b - a + 1 }, (_, i) => `<div class="${cls}" style="top:${i * HOUR_PX}px;height:${HOUR_PX - 8}px">${cls === 'wk-t' ? hourLabel(a + i) : ''}</div>`).join('');
  h += `<div class="wk-col" style="height:${H}px">${slots('wk-t')}</div>`;
  h += days.map(k => `<div class="wk-col wk-day ${inRange(s, k) ? '' : 'off'}" style="height:${H}px">${slots('wk-c')}<div class="tl-acts">${timelineBlocks(s, s.items.filter(it => occurs(s, it, k)), a * 60, (b + 1) * 60, k)}</div></div>`).join('');
  h += '</div></div>';
  return h + `<div class="period-panels">${panelToggle(s)}<div class="pp-grid">${periodPanels(s, mon, D.add(mon, 6), 'esta semana')}</div></div>`;
}

/* --- Mensual: calendario del mes (plantilla "Mi mes") con cuadro de notas --- */
function monthlyView(s, key) {
  const d = D.parse(key), y = d.getFullYear(), m = d.getMonth();
  let h = `<div class="cal-dows">${WD_LONG.map((n, i) => `<div class="cal-dow"><span class="l">${n}</span><span class="s">${WD_SHORT[i].toLowerCase()}</span></div>`).join('')}</div><div class="cal-grid">`;
  Cal.monthCells(y, m).forEach(k => {
    if (!k) { h += '<div class="cal-cell empty"></div>'; return; }
    const its = s.items.filter(it => occurs(s, it, k)).sort(byStart);
    h += `<div class="cal-cell static ${k === ui.today ? 'today' : ''} ${inRange(s, k) ? '' : 'off'}"><span class="num">${+k.slice(8)}</span>${its.length ? `<span class="dots"><i class="d" style="background:${s.color}"></i></span>` : ''}<div class="cell-acts">${its.map(it => actHtml(s, it, k)).join('')}</div></div>`;
  });
  h += '</div>';
  const first = `${y}-${D.pad(m + 1)}-01`, last = `${y}-${D.pad(m + 1)}-${D.pad(D.daysIn(y, m + 1))}`;
  return h + `<div class="period-panels">${panelToggle(s)}<div class="pp-grid">${periodPanels(s, first, last, 'este mes')}</div></div>`;
}

function schedCard(s) {
  const a = anchorOf(s);
  const view = s.type === 'daily' ? dailyView(s, a) : s.type === 'weekly' ? weeklyView(s, a) : monthlyView(s, a);
  const items = s.items.length
    ? `<div class="it-list">${s.items.slice().sort(byStart).map(it => { const c = itemConflicts(s, it); return `<span class="it-chip ${c.length ? 'clashing' : ''}" style="--c:${s.color}" ${c.length ? `title="Se cruza con: ${esc(c.map(o => o.title).join(', '))}"` : ''}>${c.length ? '⚠ ' : ''}<b>${esc(it.title)}</b> · ${esc(itemWhen(s, it))}<button class="icon-btn mini edit" data-action="edit-item" data-sid="${esc(s.id)}" data-iid="${esc(it.id)}" aria-label="Editar actividad" title="Editar">${ICON_EDIT}</button><button class="icon-btn mini" data-action="del-item" data-sid="${esc(s.id)}" data-iid="${esc(it.id)}" aria-label="Eliminar actividad">${ICON_X}</button></span>`; }).join('')}</div>`
    : '<p class="empty-note">Aún no tiene actividades. Agrégalas con el botón de abajo.</p>';

  const extra = s.type === 'weekly'
    ? `<div><span class="lbl">Días</span><div class="daychecks">${WD_SHORT.map((n, i) => `<label class="daychk"><input type="checkbox" name="days" value="${i}"><span>${n}</span></label>`).join('')}</div></div>`
    : s.type === 'monthly'
      ? '<label>Día del mes <input type="number" name="day" min="1" max="31" required placeholder="1–31"></label>'
      : '';

  const hoursEdit = s.type === 'monthly' ? '' : `<span class="hours-edit">Horas
      <select data-change="sched-hour" data-id="${esc(s.id)}" data-k="start" aria-label="Hora inicial">${hourOptions(s.hourStart)}</select> a
      <select data-change="sched-hour" data-id="${esc(s.id)}" data-k="end" aria-label="Hora final">${hourOptions(s.hourEnd)}</select></span>`;

  return `<section class="card sched-card" style="--c:${s.color}">
    <div class="sched-head"><span class="dot"></span><h2>${esc(s.name)}</h2><span class="tag">${SCHED_TYPES[s.type]}</span>
      <button class="icon-btn" data-action="dup-sched" data-id="${esc(s.id)}" aria-label="Duplicar horario" title="Duplicar horario">⧉</button>
      <button class="icon-btn" data-action="del-sched" data-id="${esc(s.id)}" aria-label="Eliminar horario" title="Eliminar horario">${ICON_X}</button></div>
    <p class="muted small vig">${esc(vigencia(s))}${s.type === 'daily' && s.weekdays.length < 7 ? ' · ' + s.weekdays.map(d => WD_SHORT[d]).join(', ') : ''}</p>
    <div class="period">
      <button class="icon-btn" data-action="sched-nav" data-id="${esc(s.id)}" data-d="-1" aria-label="Anterior">‹</button>
      <b>${esc(periodLabel(s, a))}</b>
      <button class="icon-btn" data-action="sched-nav" data-id="${esc(s.id)}" data-d="1" aria-label="Siguiente">›</button>
      <button class="btn btn-ghost" data-action="sched-follow" data-id="${esc(s.id)}">${ui.anchors[s.id] ? 'Ir a la fecha activa' : 'Sigue la fecha activa'}</button>
      ${hoursEdit}
    </div>
    ${view}
    <h4 class="sub">Actividades</h4>
    ${items}
    <details class="add-item sched-opts" data-opts="${esc(s.id)}" ${ui.openOpts.has(s.id) ? 'open' : ''}>
      <summary>Festivos y días sin actividades${s.skipDates.length ? ` (${s.skipDates.length})` : ''}</summary>
      <div class="stack">
        <label class="inline-chk"><input type="checkbox" data-change="sched-holidays" data-id="${esc(s.id)}" ${s.skipHolidays ? 'checked' : ''}> No aplica en festivos de Colombia</label>
        <form data-form="skip-day" data-sid="${esc(s.id)}" class="quick" autocomplete="off">
          <input type="date" name="day" required aria-label="Día sin actividades">
          <button class="btn btn-primary">Saltar ese día</button>
        </form>
        ${s.skipDates.length ? `<div class="it-list">${s.skipDates.map(k => `<span class="it-chip" style="--c:var(--muted)">🚫 ${esc(D.full(k))}<button class="icon-btn mini" data-action="unskip" data-id="${esc(s.id)}" data-key="${esc(k)}" aria-label="Restaurar ${esc(D.full(k))}" title="Restaurar">${ICON_X}</button></span>`).join('')}</div>` : '<p class="empty-note">No hay días saltados.</p>'}
      </div>
    </details>
    <details class="add-item" data-sid="${esc(s.id)}" ${ui.openForms.has(s.id) ? 'open' : ''}>
      <summary>+ Agregar actividad</summary>
      <form data-form="item" data-sid="${esc(s.id)}" class="stack" autocomplete="off">
        <label>Actividad <input name="title" required maxlength="100" placeholder="Ej. Clase de matemáticas"></label>
        <div class="row2"><label>Inicio <input type="time" name="start"></label><label>Fin <input type="time" name="end"></label></div>
        ${extra}
        <button class="btn btn-primary">Agregar actividad</button>
      </form>
    </details>
  </section>`;
}

function renderSchedule() {
  $$('#schedFilterSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === ui.schedFilter));
  $('#newSchedCard').hidden = !ui.newSchedOpen;
  const q = ui.query;
  const cards = state.schedules
    .filter(s => ui.schedFilter === 'all' || s.type === ui.schedFilter)
    .filter(s => !q || hit(s.name, q) || s.items.some(i => hit(i.title, q)))
    .map(schedCard).join('');
  $('#schedList').innerHTML = cards || `<div class="card empty">${state.schedules.length ? 'No hay horarios que coincidan.' : 'Aún no tienes horarios. Crea uno con “+ Nuevo horario”: diario (por horas), semanal (tabla por días) o mensual (calendario), con fecha de inicio y fin. Puedes tener varios.'}</div>`;
}

function syncSchedForm() {
  const f = $('#newSchedCard form');
  $('#wdaysWrap').hidden = f.elements.type.value !== 'daily';
  $('#hoursWrap').hidden = f.elements.type.value === 'monthly';
  $('#endWrap').hidden = f.elements.duration.value !== 'custom';
}
