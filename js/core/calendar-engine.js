/* ===== js/core/calendar-engine.js — CalendarEngine: ocurrencias de horarios, días del mes y vínculos =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

const inRange = (s, key) => (!s.startDate || key >= s.startDate) && (!s.endDate || key <= s.endDate);

/** ¿La actividad `it` del horario `s` ocurre en la fecha `key`? */
function occurs(s, it, key) {
  if (!inRange(s, key)) return false;
  const d = D.parse(key), wd = D.wd(d);
  if (s.type === 'daily') return s.weekdays.includes(wd);
  if (s.type === 'weekly') return it.days.includes(wd);
  const dim = D.daysIn(d.getFullYear(), d.getMonth() + 1);
  return it.day === d.getDate() || (it.day > dim && d.getDate() === dim);
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
  tasksOn: key => state.tasks.filter(t => t.date === key),
  notesOn: key => state.notes[key] || [],
  birthdaysOn(key) {
    const d = D.parse(key), y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return state.birthdays
      .filter(b => b.month === m && (b.day === day || (b.month === 2 && b.day === 29 && !D.isLeap(y) && day === 28)))
      .map(b => ({ b, age: b.year && y > b.year ? y - b.year : null }));
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
  return { tasks: state.tasks.filter(t => t.date === key && m(t.link)), notes: Cal.notesOn(key).filter(n => m(n.link)) };
}
function linkTags(sid, iid, key) {
  const { tasks, notes } = linkedOn(sid, key, iid);
  return notes.map(n => `<button class="lk n" data-action="open-note" data-key="${key}" data-id="${n.id}" title="Nota vinculada">📝 ${esc(noteLabel(n))}</button>`).join('') +
    tasks.map(t => `<span class="lk t ${t.completed ? 'done' : ''}" title="Tarea vinculada">${t.completed ? '✓' : '○'} ${esc(t.title)}</span>`).join('');
}
function cleanLinks(sid, iid) {
  const m = l => l && l.sid === sid && (!iid || l.iid === iid);
  state.tasks.forEach(t => { if (m(t.link)) t.link = null; });
  Object.values(state.notes).forEach(arr => arr.forEach(n => { if (m(n.link)) n.link = null; }));
}
