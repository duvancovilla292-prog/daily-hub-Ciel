/* ===== js/core/storage.js — StorageManager: guardar, validar, migrar, fusionar y estadísticas =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

const defaultState = () => ({
  meta: { version: '1.2', lastUpdated: new Date().toISOString() },
  tasks: [],            // { id, title, date, completed, priority, link:{sid,iid}|null }
  notes: {},            // { "YYYY-MM-DD": [ { id, title, type:'text'|'list', content, items:[{id,text,done}], link, updatedAt } ] }
  birthdays: [],
  schedules: [],        // { id, name, type, color, startDate, endDate, weekdays:[0-6], hourStart, hourEnd, items:[{id,title,start,end,days,day}] }
  scratchpad: '',
  settings: { theme: 'dark', filters: [...TYPES], font: 'normal' }
});

const normLink = l => (l && typeof l.sid === 'string' && typeof l.iid === 'string') ? { sid: l.sid, iid: l.iid } : null;

const Store = {
  available: true,

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      return Store.normalize(JSON.parse(raw), false);
    } catch (e) {
      console.warn('No se pudo leer localStorage, se usa estado vacío.', e);
      Store.available = false;
      return defaultState();
    }
  },

  save(state) {
    state.meta.lastUpdated = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { Store.available = false; return false; }
  },

  /** Valida estructura (lanza Error con mensaje claro si el JSON no sirve). */
  validate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('el archivo no contiene un objeto JSON válido');
    if (!Array.isArray(raw.tasks)) throw new Error('falta la lista "tasks"');
    if (!raw.notes || typeof raw.notes !== 'object' || Array.isArray(raw.notes)) throw new Error('falta el objeto "notes"');
    if (!Array.isArray(raw.birthdays)) throw new Error('falta la lista "birthdays"');
    if (raw.schedules !== undefined && !Array.isArray(raw.schedules)) throw new Error('"schedules" debe ser una lista');
    if (raw.scratchpad !== undefined && typeof raw.scratchpad !== 'string') throw new Error('"scratchpad" debe ser texto');
    return Store.normalize(raw, true);
  },

  /** Limpia/normaliza (también migra respaldos de versiones anteriores).
      strict=true lanza error ante datos corruptos; false los descarta. */
  normalize(raw, strict) {
    const out = defaultState();
    const bad = msg => { if (strict) throw new Error(msg); return null; };
    const nowIso = new Date().toISOString();

    (raw.tasks || []).forEach((t, i) => {
      if (!t || typeof t.title !== 'string' || !t.title.trim()) return bad(`la tarea #${i + 1} no tiene título`);
      if (!D.isValidKey(t.date)) return bad(`la tarea #${i + 1} tiene una fecha inválida`);
      out.tasks.push({ id: String(t.id || uid()), title: t.title.trim(), date: t.date, completed: !!t.completed, priority: PRIO[t.priority] ? t.priority : 'medium', link: normLink(t.link) });
    });

    const readNote = (n, key) => {
      if (typeof n === 'string') n = { content: n };                       // formato antiguo
      if (!n || typeof n !== 'object') return bad(`una nota del ${key} no es válida`);
      const content = typeof n.content === 'string' ? n.content : '';
      const items = Array.isArray(n.items) ? n.items.filter(i => i && typeof i.text === 'string' && i.text.trim()).map(i => ({ id: String(i.id || uid()), text: i.text.trim(), done: !!i.done })) : [];
      const title = typeof n.title === 'string' ? n.title.trim().slice(0, 80) : '';
      if (!title && !content.trim() && !items.length) return null;
      return { id: String(n.id || uid()), title, type: n.type === 'list' ? 'list' : 'text', content, items, link: normLink(n.link), updatedAt: typeof n.updatedAt === 'string' ? n.updatedAt : nowIso };
    };
    Object.entries(raw.notes || {}).forEach(([k, v]) => {
      if (!D.isValidKey(k)) return bad(`hay una nota con fecha inválida ("${k}")`);
      (Array.isArray(v) ? v : [v]).forEach(n => { const note = readNote(n, k); if (note) (out.notes[k] = out.notes[k] || []).push(note); });
    });

    (raw.birthdays || []).forEach((b, i) => {
      if (!b || typeof b.name !== 'string' || !b.name.trim()) return bad(`el cumpleaños #${i + 1} no tiene nombre`);
      const m = Number(b.month), d = Number(b.day);
      if (!Number.isInteger(m) || m < 1 || m > 12) return bad(`el cumpleaños #${i + 1} tiene un mes inválido`);
      if (!Number.isInteger(d) || d < 1 || d > D.daysIn(2024, m)) return bad(`el cumpleaños #${i + 1} tiene un día inválido`);
      const y = Number(b.year);
      out.birthdays.push({ id: String(b.id || uid()), name: b.name.trim(), month: m, day: d, year: Number.isInteger(y) && y >= 1900 && y <= 2100 ? y : null });
    });

    (raw.schedules || []).forEach((s, i) => {
      if (!s || typeof s.name !== 'string' || !s.name.trim()) return bad(`el horario #${i + 1} no tiene nombre`);
      if (!SCHED_TYPES[s.type]) return bad(`el horario "${s.name}" tiene un tipo inválido`);
      const items = [];
      (Array.isArray(s.items) ? s.items : []).forEach(it => {
        if (!it || typeof it.title !== 'string' || !it.title.trim()) return bad(`una actividad de "${s.name}" no tiene título`);
        const item = {
          id: String(it.id || uid()), title: it.title.trim(),
          start: /^\d{2}:\d{2}$/.test(it.start || '') ? it.start : '',
          end: /^\d{2}:\d{2}$/.test(it.end || '') ? it.end : '',
          days: Array.isArray(it.days) ? it.days.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6) : [],
          day: Number.isInteger(Number(it.day)) && Number(it.day) >= 1 && Number(it.day) <= 31 ? Number(it.day) : 1
        };
        if (s.type === 'weekly' && !item.days.length) return bad(`una actividad semanal de "${s.name}" no tiene días`);
        items.push(item);
      });
      const wdays = Array.isArray(s.weekdays) ? [...new Set(s.weekdays.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))] : [];
      const okH = v => v !== null && v !== undefined && v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 23;
      let hs = okH(s.hourStart) ? Number(s.hourStart) : 6, he = okH(s.hourEnd) ? Number(s.hourEnd) : 21;
      if (he < hs) { hs = 6; he = 21; }
      out.schedules.push({
        id: String(s.id || uid()), name: s.name.trim(), type: s.type,
        color: /^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : SCHED_COLORS[0],
        startDate: D.isValidKey(s.startDate) ? s.startDate : '',
        endDate: D.isValidKey(s.endDate) ? s.endDate : '',
        weekdays: wdays.length ? wdays : [0, 1, 2, 3, 4, 5, 6],
        hourStart: hs, hourEnd: he,
        items
      });
    });

    out.scratchpad = typeof raw.scratchpad === 'string' ? raw.scratchpad : '';

    if (raw.settings && typeof raw.settings === 'object') {
      if (raw.settings.theme === 'light' || raw.settings.theme === 'dark') out.settings.theme = raw.settings.theme;
      if (raw.settings.font === 'aetheri' || raw.settings.font === 'normal') out.settings.font = raw.settings.font;
      if (Array.isArray(raw.settings.filters)) {
        const f = raw.settings.filters.filter(x => TYPES.includes(x));
        if (f.length) out.settings.filters = f;
      }
    }

    // Quita vínculos que apunten a actividades que no existen
    const valid = new Set();
    out.schedules.forEach(s => s.items.forEach(i => valid.add(s.id + '|' + i.id)));
    const ok = l => (l && valid.has(l.sid + '|' + l.iid)) ? l : null;
    out.tasks.forEach(t => { t.link = ok(t.link); });
    Object.values(out.notes).forEach(arr => arr.forEach(n => { n.link = ok(n.link); }));
    return out;
  },

  /** Resumen de los datos (panel de administrador). */
  stats(s) {
    const today = D.todayKey();
    const notes = Object.values(s.notes).flat();
    const count = t => s.schedules.filter(x => x.type === t).length;
    return {
      tasks: s.tasks.length, pending: s.tasks.filter(t => !t.completed).length, done: s.tasks.filter(t => t.completed).length,
      overdue: s.tasks.filter(t => !t.completed && t.date < today).length,
      notes: notes.length, lists: notes.filter(n => n.type === 'list').length,
      birthdays: s.birthdays.length,
      schedules: s.schedules.length, daily: count('daily'), weekly: count('weekly'), monthly: count('monthly'),
      items: s.schedules.reduce((a, x) => a + x.items.length, 0),
      links: s.tasks.filter(t => t.link).length + notes.filter(n => n.link).length,
      bytes: new Blob([JSON.stringify(s)]).size,
      updated: s.meta.lastUpdated
    };
  },

  /** Fusiona comparando con lo que ya existe: agrega solo lo nuevo, nunca borra ni duplica.
      Devuelve { state, report } sin tocar el estado actual. */
  merge(cur, inc) {
    const out = clone(cur);
    const stamp = '\n\n— Importado —\n';
    const rep = { tasks: { add: 0, skip: 0 }, notes: { add: 0, skip: 0 }, birthdays: { add: 0, skip: 0 }, schedules: { add: 0, skip: 0 }, items: { add: 0, skip: 0 }, scratch: false };

    const used = new Set();
    out.tasks.forEach(t => used.add(t.id));
    out.birthdays.forEach(b => used.add(b.id));
    out.schedules.forEach(x => { used.add(x.id); x.items.forEach(i => used.add(i.id)); });
    Object.values(out.notes).forEach(a => a.forEach(n => used.add(n.id)));
    const freeId = id => { if (!used.has(id)) { used.add(id); return id; } const n = uid(); used.add(n); return n; };

    /* 1) Horarios y actividades (primero, para poder reajustar los vínculos) */
    const schedSig = x => [norm(x.name), x.type, x.startDate, x.endDate].join('|');
    const itemSig = i => [norm(i.title), i.start, i.end, i.days.slice().sort().join(','), i.day].join('|');
    const idMap = {};                                           // "sidViejo|iidViejo" -> "sidNuevo|iidNuevo"
    inc.schedules.forEach(s => {
      let ex = out.schedules.find(x => x.id === s.id) || out.schedules.find(x => schedSig(x) === schedSig(s));
      if (ex) rep.schedules.skip++;
      else { ex = { ...clone(s), id: freeId(s.id), items: [] }; out.schedules.push(ex); rep.schedules.add++; }
      s.items.forEach(it => {
        let ei = ex.items.find(x => x.id === it.id) || ex.items.find(x => itemSig(x) === itemSig(it));
        if (ei) rep.items.skip++;
        else { ei = { ...clone(it), id: freeId(it.id) }; ex.items.push(ei); rep.items.add++; }
        idMap[s.id + '|' + it.id] = ex.id + '|' + ei.id;
      });
    });
    const valid = new Set(); out.schedules.forEach(x => x.items.forEach(i => valid.add(x.id + '|' + i.id)));
    const relink = l => {
      if (!l) return null;
      const m = idMap[l.sid + '|' + l.iid] || (l.sid + '|' + l.iid);
      if (!valid.has(m)) return null;
      const [sid, iid] = m.split('|'); return { sid, iid };
    };

    /* 2) Tareas */
    const tSig = t => norm(t.title) + '|' + t.date;
    const haveT = new Set(out.tasks.map(tSig));
    inc.tasks.forEach(t => {
      if (haveT.has(tSig(t))) { rep.tasks.skip++; return; }
      out.tasks.push({ ...t, id: freeId(t.id), link: relink(t.link) }); haveT.add(tSig(t)); rep.tasks.add++;
    });

    /* 3) Notas (por fecha) */
    const nSig = n => JSON.stringify([n.title.trim(), n.type, n.content.trim(), n.items.map(i => i.text)]);
    Object.entries(inc.notes).forEach(([k, arr]) => {
      const list = out.notes[k] = out.notes[k] || [];
      const have = new Set(list.map(nSig));
      arr.forEach(n => {
        if (have.has(nSig(n))) { rep.notes.skip++; return; }
        list.push({ ...clone(n), id: freeId(n.id), link: relink(n.link) }); have.add(nSig(n)); rep.notes.add++;
      });
      if (!list.length) delete out.notes[k];
    });

    /* 4) Cumpleaños */
    const bSig = b => [norm(b.name), b.month, b.day].join('|');
    const haveB = new Set(out.birthdays.map(bSig));
    inc.birthdays.forEach(b => {
      if (haveB.has(bSig(b))) { rep.birthdays.skip++; return; }
      out.birthdays.push({ ...b, id: freeId(b.id) }); haveB.add(bSig(b)); rep.birthdays.add++;
    });

    /* 5) Bloc rápido */
    const sp = inc.scratchpad.trim();
    if (sp && !out.scratchpad.includes(sp)) { out.scratchpad = out.scratchpad.trim() ? out.scratchpad + stamp + inc.scratchpad : inc.scratchpad; rep.scratch = true; }
    return { state: out, report: rep };
  }
};
