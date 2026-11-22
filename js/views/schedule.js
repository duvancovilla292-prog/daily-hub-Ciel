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
function timelineBlocks(s, its, a, b, key) {
  const lo = a * 60, hi = (b + 1) * 60;
  const list = its.filter(it => it.start).map(it => ({ it, s0: Math.max(toMin(it.start), lo), e0: Math.min(endMin(it), hi) }))
    .filter(x => x.e0 > x.s0).sort((x, y) => x.s0 - y.s0 || y.e0 - x.e0);
  // grupos de actividades que se solapan; dentro de cada grupo, cada una toma la primera columna libre
  let group = [], groupEnd = -1, cols = [];
  const flush = () => { const n = cols.length; group.forEach(x => { x.n = n; }); group = []; cols = []; };
  list.forEach(x => {
    if (x.s0 >= groupEnd) { flush(); groupEnd = -1; }
    let c = cols.findIndex(end => end <= x.s0);
    if (c < 0) { c = cols.length; cols.push(0); }
    cols[c] = x.e0; x.c = c; group.push(x); groupEnd = Math.max(groupEnd, x.e0);
  });
  flush();
  return list.map(x => {
    const top = (x.s0 - lo) * HOUR_PX / 60, h = Math.max((x.e0 - x.s0) * HOUR_PX / 60, 24);
    const cls = h < 44 ? 'act tl-act short' : 'act tl-act';
    return `<div class="${cls}" style="--c:${s.color};top:${top}px;height:${h - 3}px;left:calc(${x.c} * 100% / ${x.n});width:calc(100% / ${x.n} - 4px)" title="${esc(x.it.title)} · ${esc(timeLabel(x.it))}"><b>${esc(x.it.title)}</b><small>${timeLabel(x.it)}</small>${linkTags(s.id, x.it.id, key)}</div>`;
  }).join('');
}
const hourOptions = sel => Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === sel ? 'selected' : ''}>${hourLabel(h)}</option>`).join('');

const actHtml = (s, it, key) => `<div class="act" style="--c:${s.color}"><b>${esc(it.title)}</b><small>${timeLabel(it)}</small>${linkTags(s.id, it.id, key)}</div>`;

/* --- Diario: franjas por hora + paneles laterales (plantilla "Daily plan") --- */
function dailyView(s, key) {
  const [a, b] = hourRange(s);
  const inside = inRange(s, key) && s.weekdays.includes(D.wd(D.parse(key)));
  const occ = s.items.filter(it => occurs(s, it, key)).sort(byStart);
  const allDay = occ.filter(it => !it.start);
  let rows = '';
  if (allDay.length) rows += `<div class="hr"><span class="hl">Todo el día</span><div class="hc">${allDay.map(it => actHtml(s, it, key)).join('')}</div></div>`;
  let lines = '';
  for (let h = a; h <= b; h++) lines += `<div class="tl-h" style="top:${(h - a) * HOUR_PX}px;height:${HOUR_PX}px"><span class="hl">${hourLabel(h)}</span></div>`;
  rows += `<div class="tl" style="height:${(b - a + 1) * HOUR_PX}px">${lines}<div class="tl-acts">${timelineBlocks(s, occ, a, b, key)}</div></div>`;
  const tasks = Cal.tasksOn(key), notes = Cal.notesOn(key);
  return `<div class="daily">
    <aside class="d-side">
      <div class="panel"><span class="ptitle">Tareas</span>${tasks.length ? `<ul class="mini-tasks">${tasks.map(t => `<li class="${t.completed ? 'done' : ''}"><label class="check"><input type="checkbox" data-change="toggle-task" data-id="${t.id}" ${t.completed ? 'checked' : ''} aria-label="Completar"><span class="box"></span></label><span>${esc(t.title)}</span></li>`).join('')}</ul>` : '<p class="empty-note">Sin tareas este día.</p>'}</div>
      <div class="panel"><span class="ptitle">Notas</span>${notes.length ? notes.map(n => `<button class="note-chip" data-action="open-note" data-key="${key}" data-id="${n.id}">${n.type === 'list' ? '☑' : '📝'} ${esc(noteLabel(n))}</button>`).join('') : '<p class="empty-note">Sin notas este día.</p>'}</div>
    </aside>
    <div class="d-grid">${inside ? '' : '<p class="off-msg">Este día queda fuera de la vigencia o de los días en que aplica el horario.</p>'}${rows}</div>
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
    days.map((k, i) => `<div class="wk-h ${k === ui.today ? 'today' : ''}">${WD_SHORT[i].toUpperCase()} <b>${+k.slice(8)}</b></div>`).join('');
  const cell = (k, its) => `<div class="wk-c ${inRange(s, k) ? '' : 'off'}">${its.map(it => actHtml(s, it, k)).join('')}</div>`;
  const allDayAny = days.some(k => s.items.some(it => !it.start && occurs(s, it, k)));
  if (allDayAny) h += `<div class="wk-t">Todo el día</div>` + days.map(k => cell(k, s.items.filter(it => !it.start && occurs(s, it, k)))).join('');
  // Una fila con la columna de horas y, por cada día, una línea de tiempo del mismo alto
  const H = (b - a + 1) * HOUR_PX, slots = cls => Array.from({ length: b - a + 1 }, (_, i) => `<div class="${cls}" style="top:${i * HOUR_PX}px;height:${HOUR_PX - 8}px">${cls === 'wk-t' ? hourLabel(a + i) : ''}</div>`).join('');
  h += `<div class="wk-col" style="height:${H}px">${slots('wk-t')}</div>`;
  h += days.map(k => `<div class="wk-col wk-day ${inRange(s, k) ? '' : 'off'}" style="height:${H}px">${slots('wk-c')}<div class="tl-acts">${timelineBlocks(s, s.items.filter(it => occurs(s, it, k)), a, b, k)}</div></div>`).join('');
  return h + '</div></div>';
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
  const prefix = `${y}-${D.pad(m + 1)}`;
  const linked = [];
  Object.keys(state.notes).filter(k => k.startsWith(prefix)).sort().forEach(k => state.notes[k].forEach(n => { if (n.link && n.link.sid === s.id) linked.push([k, n]); }));
  h += `<div class="cal-notes"><span class="script">notas</span>${linked.length ? linked.map(([k, n]) => `<button class="note-chip" data-action="open-note" data-key="${k}" data-id="${n.id}"><b>${+k.slice(8)}</b> ${esc(noteLabel(n))}</button>`).join('') : '<span class="muted small">Las notas vinculadas a este horario aparecerán aquí.</span>'}</div>`;
  return h;
}

function schedCard(s) {
  const a = anchorOf(s);
  const view = s.type === 'daily' ? dailyView(s, a) : s.type === 'weekly' ? weeklyView(s, a) : monthlyView(s, a);
  const items = s.items.length
    ? `<div class="it-list">${s.items.slice().sort(byStart).map(it => `<span class="it-chip" style="--c:${s.color}"><b>${esc(it.title)}</b> · ${esc(itemWhen(s, it))}<button class="icon-btn mini" data-action="del-item" data-sid="${s.id}" data-iid="${it.id}" aria-label="Eliminar actividad">${ICON_X}</button></span>`).join('')}</div>`
    : '<p class="empty-note">Aún no tiene actividades. Agrégalas con el botón de abajo.</p>';

  const extra = s.type === 'weekly'
    ? `<div><span class="lbl">Días</span><div class="daychecks">${WD_SHORT.map((n, i) => `<label class="daychk"><input type="checkbox" name="days" value="${i}"><span>${n}</span></label>`).join('')}</div></div>`
    : s.type === 'monthly'
      ? '<label>Día del mes <input type="number" name="day" min="1" max="31" required placeholder="1–31"></label>'
      : '';

  const hoursEdit = s.type === 'monthly' ? '' : `<span class="hours-edit">Horas
      <select data-change="sched-hour" data-id="${s.id}" data-k="start" aria-label="Hora inicial">${hourOptions(s.hourStart)}</select> a
      <select data-change="sched-hour" data-id="${s.id}" data-k="end" aria-label="Hora final">${hourOptions(s.hourEnd)}</select></span>`;

  return `<section class="card sched-card" style="--c:${s.color}">
    <div class="sched-head"><span class="dot"></span><h2>${esc(s.name)}</h2><span class="tag">${SCHED_TYPES[s.type]}</span>
      <button class="icon-btn" data-action="del-sched" data-id="${s.id}" aria-label="Eliminar horario" title="Eliminar horario">${ICON_X}</button></div>
    <p class="muted small vig">${esc(vigencia(s))}${s.type === 'daily' && s.weekdays.length < 7 ? ' · ' + s.weekdays.map(d => WD_SHORT[d]).join(', ') : ''}</p>
    <div class="period">
      <button class="icon-btn" data-action="sched-nav" data-id="${s.id}" data-d="-1" aria-label="Anterior">‹</button>
      <b>${esc(periodLabel(s, a))}</b>
      <button class="icon-btn" data-action="sched-nav" data-id="${s.id}" data-d="1" aria-label="Siguiente">›</button>
      <button class="btn btn-ghost" data-action="sched-follow" data-id="${s.id}">${ui.anchors[s.id] ? 'Ir a la fecha activa' : 'Sigue la fecha activa'}</button>
      ${hoursEdit}
    </div>
    ${view}
    <h4 class="sub">Actividades</h4>
    ${items}
    <details class="add-item" data-sid="${s.id}" ${ui.openForms.has(s.id) ? 'open' : ''}>
      <summary>+ Agregar actividad</summary>
      <form data-form="item" data-sid="${s.id}" class="stack" autocomplete="off">
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
