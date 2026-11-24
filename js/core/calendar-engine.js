/* ===== js/core/calendar-engine.js — CalendarEngine: ocurrencias de horarios, días del mes y vínculos =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

const inRange = (s, key) => (!s.startDate || key >= s.startDate) && (!s.endDate || key <= s.endDate);

/** ¿La actividad `it` del horario `s` ocurre en la fecha `key`? */
function occurs(s, it, key) { return !skipReason(s, key) && occursBase(s, it, key); }
/** Igual que occurs pero sin tener en cuenta festivos ni días saltados. */
function occursBase(s, it, key) {
  if (!inRange(s, key)) return false;
  const d = D.parse(key), wd = D.wd(d);
  if (s.type === 'daily') return s.weekdays.includes(wd);
  if (s.type === 'weekly') return it.days.includes(wd);
  const dim = D.daysIn(d.getFullYear(), d.getMonth() + 1);
  return it.day === d.getDate() || (it.day > dim && d.getDate() === dim);
}
/** ¿Por qué un horario no aplica ese día? ('' = sí aplica) */
function skipReason(s, key) {
  if (s.skipDates && s.skipDates.includes(key)) return 'Día saltado';
  if (s.skipHolidays) { const h = holidayName(key); if (h) return 'Festivo: ' + h; }
  return '';
}
/** Actividades del mismo horario que se cruzan en hora y día con `it`. */
function itemConflicts(s, it) {
  if (!it.start) return [];
  const toM = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  const span = x => [toM(x.start), x.end && x.end > x.start ? toM(x.end) : toM(x.start) + 30];
  const [a0, a1] = span(it);
  const sameDay = o => s.type === 'weekly' ? o.days.some(d => it.days.includes(d)) : s.type === 'monthly' ? o.day === it.day : true;
  return s.items.filter(o => o.id !== it.id && o.start && sameDay(o) && (() => { const [b0, b1] = span(o); return a0 < b1 && b0 < a1; })());
}
const byStart = (a, b) => (a.start || '').localeCompare(b.start || '');
const noteText = n => [n.title, n.content, ...n.items.map(i => i.text)].join(' ');
const noteLabel = n => n.title || firstLine(n.type === 'list' ? n.items.map(i => i.text).join(', ') : n.content) || 'Nota sin título';

const Cal = {
  /** Celdas del mes (lunes primero). null = hueco fuera del mes. */
  monthCells(y, m) {
    const lead = D.wd(new Date(y, m, 1));
    const n = new Date(y, m + 1, 0).getDate();
    const cells = Array(lead).fill(null);
    for (let d = 1; d <= n; d++) cells.push(D.key(new Date(y, m, d)));
    while (cells.length % 7) cells.push(null);
    return cells;
  },
  tasksOn: key => state.tasks.filter(t => taskOn(t, key)),
  notesOn: key => state.notes[key] || [],
  birthdaysOn(key) {
    // fechas importantes que ocurren ese día (cumpleaños y otras fechas que se repiten cada año, mes o semana)
    const out = [];
    state.birthdays.forEach(b => { const o = occurrenceOn(b, key); if (o) out.push({ b, age: o.n > 0 ? o.n : null }); });
    return out;
  },
  scheduleOn(key) {
    const out = [];
    state.schedules.forEach(s => s.items.forEach(item => { if (occurs(s, item, key)) out.push({ s, item }); }));
    return out.sort((a, b) => byStart(a.item, b.item));
  },
  dayInfo(key, q) {
    return {
      tasks: Cal.tasksOn(key).filter(t => hit(t.title, q)),
      notes: Cal.notesOn(key).filter(n => hit(noteText(n), q)),
      bdays: Cal.birthdaysOn(key).filter(x => hit(x.b.name, q)),
      sched: Cal.scheduleOn(key).filter(x => hit(x.item.title, q) || hit(x.s.name, q))
    };
  }
};

const activeFilters = () => new Set(state.settings.filters);

/* Vínculos tarea/nota ↔ actividad del horario */
const findItem = l => { if (!l) return null; const s = state.schedules.find(x => x.id === l.sid); const it = s && s.items.find(i => i.id === l.iid); return it ? { s, it } : null; };
const linkLabel = l => { const f = findItem(l); return f ? `${f.s.name} · ${f.it.title}` : ''; };
function itemWhen(s, it) {
  const t = timeLabel(it);
  if (s.type === 'weekly') return `${it.days.slice().sort().map(d => WD_SHORT[d]).join(', ')} · ${t}`;
  if (s.type === 'monthly') return `día ${it.day} · ${t}`;
  return t;
}
function linkOptions() {
  const arr = [];
  state.schedules.forEach(s => s.items.forEach(it => arr.push({ value: s.id + '|' + it.id, label: `${s.name} · ${it.title} (${itemWhen(s, it)})` })));
  return arr;
}
function fillLinkSelect(sel, current) {
  const opts = linkOptions(), sig = opts.map(o => o.value + o.label).join('\n');
  if (sel.dataset.sig !== sig) {
    sel.innerHTML = '<option value="">Sin vincular</option>' + opts.map(o => `<option value="${o.value}">${esc(o.label)}</option>`).join('');
    sel.dataset.sig = sig;
  }
  if (current !== undefined) sel.value = current || '';
}
function linkedOn(sid, key, iid) {
  const m = l => l && l.sid === sid && (!iid || l.iid === iid);
  return { tasks: Cal.tasksOn(key).filter(t => m(t.link)), notes: Cal.notesOn(key).filter(n => m(n.link)) };
}
function linkTags(sid, iid, key) { return linkTagList(sid, iid, key).join(''); }
/** Etiquetas (una por nota o tarea vinculada a la actividad ese día), como lista. */
function linkTagList(sid, iid, key) {
  const { tasks, notes } = linkedOn(sid, key, iid);
  return notes.map(n => `<button class="lk n" data-action="open-note" data-key="${esc(key)}" data-id="${esc(n.id)}" title="Nota vinculada">📝 ${esc(noteLabel(n))}</button>`).concat(
    tasks.map(t => { const d = doneOn(t, key); return `<span class="lk t ${d ? 'done' : ''}" title="Tarea vinculada">${d ? '✓' : t.mode === 'repeat' ? '🔁' : '○'} ${esc(t.title)}</span>`; }));
}
function cleanLinks(sid, iid) {
  const m = l => l && l.sid === sid && (!iid || l.iid === iid);
  state.tasks.forEach(t => { if (m(t.link)) { t.link = null; if (t.mode === 'repeat') { t.mode = 'once'; t.due = ''; t.doneDates = []; } } });   // sin actividad ya no puede repetirse
  Object.values(state.notes).forEach(arr => arr.forEach(n => { if (m(n.link)) n.link = null; }));
}

/* ===== Tipos de tarea =====
   once   = un solo día (date)
   span   = con fecha límite: abarca del date al due y se marca hecha una sola vez
   repeat = se repite con la actividad vinculada: aparece cada día que ocurre la actividad (desde date hasta due,
            o hasta que termine el horario) y se marca hecha cada día por separado (doneDates) */
const TASK_MODES = { once: 'Un solo día', span: 'Con fecha límite (abarca un periodo)', repeat: 'Se repite con la actividad vinculada' };

/** Último día de una tarea que se repite: su fecha límite o, si no tiene, el final del horario ('' = sin final). */
function repeatEnd(t) { if (t.due) return t.due; const f = findItem(t.link); return (f && f.s.endDate) || ''; }

/** ¿La tarea aparece en la fecha `key`? */
function taskOn(t, key) {
  if (t.mode === 'span') return t.date <= key && key <= t.due;
  if (t.mode === 'repeat') {
    const f = findItem(t.link);
    if (!f || key < t.date) return false;
    const end = repeatEnd(t);
    if (end && key > end) return false;
    return occurs(f.s, f.it, key);
  }
  return t.date === key;
}
/** ¿Está hecha ese día? (las que se repiten se marcan día por día) */
const doneOn = (t, key) => t.mode === 'repeat' ? t.doneDates.includes(key) : t.completed;

/** Estado general: 'done' | 'pending' | 'missed' (se repetía, ya terminó y no se hizo ningún día). */
function taskStatus(t) {
  if (t.mode !== 'repeat') return t.completed ? 'done' : 'pending';
  const end = repeatEnd(t);
  if (end && D.todayKey() > end) return t.doneDates.length ? 'done' : 'missed';
  return 'pending';
}
function isOverdue(t) {
  if (t.mode === 'repeat') return taskStatus(t) === 'missed';
  return !t.completed && (t.mode === 'span' ? t.due : t.date) < D.todayKey();
}
/** Pendientes "de verdad" (contador de la pestaña): las de un día o periodo sin hacer + las que se repiten hoy y no se han hecho hoy. */
function pendingCount() {
  const today = D.todayKey();
  return state.tasks.filter(t => t.mode === 'repeat' ? taskOn(t, today) && !t.doneDates.includes(today) : !t.completed).length;
}
/** Cuántas veces aparece una tarea que se repite entre dos fechas y cuántas de ellas se hicieron. */
function repeatProgress(t, from, to) {
  let n = 0, d = 0;
  for (let k = from; k <= to; k = D.add(k, 1)) if (taskOn(t, k)) { n++; if (t.doneDates.includes(k)) d++; }
  return { n, d };
}
/** Texto corto que explica la tarea (periodo o repetición). */
function taskMeta(t) {
  if (t.mode === 'span') return `⏳ Del ${D.full(t.date)} al ${D.full(t.due)}`;
  if (t.mode === 'repeat') {
    const end = repeatEnd(t), st = taskStatus(t);
    return `🔁 Se repite desde el ${D.full(t.date)}${end ? ' hasta el ' + D.full(end) : ''} · ${plural(t.doneDates.length, 'día hecho', 'días hechos')}` +
      (st === 'missed' ? ' · no cumplida' : st === 'done' ? ' · terminada' : '');
  }
  return '';
}

/* ===== Por vencer: tareas de prioridad Alta que vencen en las próximas 48 horas =====
   Una de un día vence a su hora (o al final del día si no tiene); una de periodo, al final de su fecha límite. */
function hoursToDue(t) {
  if (t.mode === 'repeat' || t.completed) return null;
  const d = D.parse(t.mode === 'span' ? t.due : t.date);
  if (t.mode !== 'span' && t.time) d.setHours(+t.time.slice(0, 2), +t.time.slice(3, 5)); else d.setHours(23, 59, 59);
  return (d - Date.now()) / 3600000;
}
const dueSoon = t => { if (t.priority !== 'high') return false; const h = hoursToDue(t); return h !== null && h > 0 && h <= 48; };
const dueLabel = t => { const h = hoursToDue(t); return h < 1 ? 'vence en menos de 1 h' : `vence en ${Math.round(h)} h`; };
