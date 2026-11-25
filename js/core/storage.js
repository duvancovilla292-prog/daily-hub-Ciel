/* ===== js/core/storage.js — StorageManager: guardar, validar, migrar, fusionar y estadísticas =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

const defaultState = () => ({
  meta: { version: '1.5', lastUpdated: new Date().toISOString() },
  tasks: [],            // { id, title, date, time, completed, doneAt, priority, link:{sid,iid}|null, mode:'once'|'span'|'repeat', due, doneDates, tags, subtasks, persons:[ids], notes:[ids] }
  notes: {},            // { "YYYY-MM-DD": [ { id, title, type:'text'|'list', content, items:[{id,text,done}], link, updatedAt } ] }
  birthdays: [],         // fechas importantes: { id, kind:'birthday'|'event', repeat:'yearly'|'monthly'|'weekly', name, month, day, year|null, category, tag, nick, relation, remind, giftYears, giftDates }
  birthdayCategories: [],   // { id, name } — las crea el administrador
  schedules: [],        // { id, name, type, color, startDate, endDate, weekdays:[0-6], hourStart, hourEnd, skipHolidays, skipDates:[], items:[{id,title,start,end,days,day}] }
  scratchpad: '',
  msgTemplate: '',
  settings: { theme: 'dark', filters: [...TYPES], font: 'normal' }
});

/* Los ids solo pueden tener letras, números, "_" y "-": se usan en atributos HTML y como nombre de documento en la nube */
const ID_RE = /^[\w-]{1,64}$/;
const validId = v => typeof v === 'string' && ID_RE.test(v);
/** Lista de ids (sin repetir ni inválidos). Acepta también el formato anterior de un solo id. */
const idList = (arr, one) => [...new Set([...(Array.isArray(arr) ? arr : []), one].filter(validId))].slice(0, 50);
const normLink = l => (l && validId(l.sid) && validId(l.iid)) ? { sid: l.sid, iid: l.iid } : null;

const Store = {
  available: true,

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      return Store.normalize(JSON.parse(raw), false, { keepLinks: true });
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
    if (raw.birthdayCategories !== undefined && !Array.isArray(raw.birthdayCategories)) throw new Error('"birthdayCategories" debe ser una lista');
    if (raw.schedules !== undefined && !Array.isArray(raw.schedules)) throw new Error('"schedules" debe ser una lista');
    if (raw.scratchpad !== undefined && typeof raw.scratchpad !== 'string') throw new Error('"scratchpad" debe ser texto');
    return Store.normalize(raw, true);
  },

  /** Limpia/normaliza (también migra respaldos de versiones anteriores).
      strict=true lanza error ante datos corruptos; false los descarta.
      opts.keepLinks=true conserva vínculos y categorías aunque su destino aún no exista (sincronización por partes). */
  normalize(raw, strict, opts = {}) {
    const out = defaultState();
    const bad = msg => { if (strict) throw new Error(msg); return null; };
    const nowIso = new Date().toISOString();
    const used = new Set();                                    // ids inválidos o repetidos se reemplazan
    const cid = v => { const s = v === undefined || v === null ? '' : String(v); const id = ID_RE.test(s) && !used.has(s) ? s : uid(); used.add(id); return id; };

    (raw.tasks || []).forEach((t, i) => {
      if (!t || typeof t.title !== 'string' || !t.title.trim()) return bad(`la tarea #${i + 1} no tiene título`);
      if (!D.isValidKey(t.date)) return bad(`la tarea #${i + 1} tiene una fecha inválida`);
      let mode = t.mode === 'span' || t.mode === 'repeat' ? t.mode : 'once';
      const due = D.isValidKey(t.due) && t.due >= t.date ? t.due : '';
      if (mode === 'span' && !due) mode = 'once';
      const doneDates = mode === 'repeat' && Array.isArray(t.doneDates) ? [...new Set(t.doneDates.filter(D.isValidKey))].sort() : [];
      const subtasks = (Array.isArray(t.subtasks) ? t.subtasks : []).filter(x => x && typeof x.text === 'string' && x.text.trim()).slice(0, 30)
        .map(x => ({ id: cid(x.id), text: x.text.trim().slice(0, 100), done: !!x.done, person: validId(x.person) ? x.person : '' }));
      out.tasks.push({ id: cid(t.id), title: t.title.trim(), date: t.date, completed: !!t.completed, priority: PRIO[t.priority] ? t.priority : 'medium', link: normLink(t.link), mode, due: mode === 'once' ? '' : due, doneDates,
        time: TIME_RE.test(t.time || '') ? t.time : '', tags: parseTags(t.tags), subtasks,
        persons: idList(t.persons, t.person),          // personas o fechas vinculadas (varias)
        notes: idList(t.notes),                         // notas vinculadas (varias)
        doneAt: typeof t.doneAt === 'string' && !isNaN(Date.parse(t.doneAt)) ? t.doneAt : '' });
    });

    const readNote = (n, key) => {
      if (typeof n === 'string') n = { content: n };                       // formato antiguo
      if (!n || typeof n !== 'object') return bad(`una nota del ${key} no es válida`);
      const content = typeof n.content === 'string' ? n.content : '';
      const items = Array.isArray(n.items) ? n.items.filter(i => i && typeof i.text === 'string' && i.text.trim()).map(i => ({ id: cid(i.id), text: i.text.trim(), done: !!i.done, person: validId(i.person) ? i.person : '' })) : [];
      const title = typeof n.title === 'string' ? n.title.trim().slice(0, 80) : '';
      if (!title && !content.trim() && !items.length) return null;
      return { id: cid(n.id), title, type: n.type === 'list' ? 'list' : 'text', content, items, link: normLink(n.link), updatedAt: typeof n.updatedAt === 'string' ? n.updatedAt : nowIso, pinned: !!n.pinned, persons: idList(n.persons, n.person) };
    };
    Object.entries(raw.notes || {}).forEach(([k, v]) => {
      if (!D.isValidKey(k)) return bad(`hay una nota con fecha inválida ("${k}")`);
      (Array.isArray(v) ? v : [v]).forEach(n => { const note = readNote(n, k); if (note) (out.notes[k] = out.notes[k] || []).push(note); });
    });

    // Categorías de cumpleaños (los respaldos antiguos no las traen: quedan vacías)
    if (Array.isArray(raw.birthdayCategories)) {
      out.birthdayCategories = [];
      const seen = new Set();
      raw.birthdayCategories.forEach(c => {
        const name = c && typeof c.name === 'string' ? c.name.trim().slice(0, 30) : '';
        if (!name || seen.has(norm(name))) return;
        seen.add(norm(name));
        out.birthdayCategories.push({ id: cid(c.id), name, pets: !!c.pets });
      });
    }
    const catIds = new Set(out.birthdayCategories.map(c => c.id));

    (raw.birthdays || []).forEach((b, i) => {
      if (!b || typeof b.name !== 'string' || !b.name.trim()) return bad(`el cumpleaños #${i + 1} no tiene nombre`);
      const m = Number(b.month), d = Number(b.day);
      if (!Number.isInteger(m) || m < 1 || m > 12) return bad(`el cumpleaños #${i + 1} tiene un mes inválido`);
      if (!Number.isInteger(d) || d < 1 || d > D.daysIn(2024, m)) return bad(`el cumpleaños #${i + 1} tiene un día inválido`);
      const y = Number(b.year);
      const kind = b.kind === 'event' || b.kind === 'anniversary' ? 'event' : 'birthday';     // los "aniversarios" pasan a ser otras fechas que se repiten cada año
      const year = Number.isInteger(y) && y >= 1900 && y <= 2100 ? y : null;
      let repeat = kind === 'event' && ['monthly', 'weekly'].includes(b.repeat) ? b.repeat : 'yearly';
      if (repeat !== 'yearly' && !year) repeat = 'yearly';                                    // cada mes / semana necesita el año de inicio
      out.birthdays.push({ id: cid(b.id), kind, repeat, name: b.name.trim(), month: m, day: d, year,
        category: validId(b.category) && (opts.keepLinks || catIds.has(b.category)) ? b.category : null,
        tag: typeof b.tag === 'string' ? b.tag.trim().slice(0, 30) : '',
        nick: typeof b.nick === 'string' ? b.nick.trim().slice(0, 30) : '',
        relation: typeof b.relation === 'string' ? b.relation.trim().slice(0, 30) : '',
        remind: Number.isInteger(+b.remind) && +b.remind >= 1 && +b.remind <= 60 ? +b.remind : 0,          // días antes para la tarea (0 = no)
        giftYears: Array.isArray(b.giftYears) ? [...new Set(b.giftYears.map(Number).filter(n => Number.isInteger(n) && n > 1900 && n < 2200))].sort() : [],
        giftDates: Array.isArray(b.giftDates) ? [...new Set(b.giftDates.filter(D.isValidKey))].sort().slice(-24) : [],
        persons: kind === 'event' ? idList(b.persons) : [] });          // otras fechas: personas vinculadas (ej. aniversario ↔ la pareja)
    });

    (raw.schedules || []).forEach((s, i) => {
      if (!s || typeof s.name !== 'string' || !s.name.trim()) return bad(`el horario #${i + 1} no tiene nombre`);
      if (!SCHED_TYPES[s.type]) return bad(`el horario "${s.name}" tiene un tipo inválido`);
      const items = [];
      (Array.isArray(s.items) ? s.items : []).forEach(it => {
        if (!it || typeof it.title !== 'string' || !it.title.trim()) return bad(`una actividad de "${s.name}" no tiene título`);
        const item = {
          id: cid(it.id), title: it.title.trim(),
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
        id: cid(s.id), name: s.name.trim(), type: s.type,
        color: /^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : SCHED_COLORS[0],
        startDate: D.isValidKey(s.startDate) ? s.startDate : '',
        endDate: D.isValidKey(s.endDate) ? s.endDate : '',
        weekdays: wdays.length ? wdays : [0, 1, 2, 3, 4, 5, 6],
        hourStart: hs, hourEnd: he,
        skipHolidays: !!s.skipHolidays,                       // no aplica en festivos de Colombia
        skipDates: Array.isArray(s.skipDates) ? [...new Set(s.skipDates.filter(D.isValidKey))].sort() : [],   // días saltados
        items
      });
    });

    out.scratchpad = typeof raw.scratchpad === 'string' ? raw.scratchpad : '';
    out.msgTemplate = typeof raw.msgTemplate === 'string' ? raw.msgTemplate.slice(0, 600) : '';     // plantilla del mensaje de cumpleaños

    if (raw.settings && typeof raw.settings === 'object') {
      if (raw.settings.theme === 'light' || raw.settings.theme === 'dark') out.settings.theme = raw.settings.theme;
      if (raw.settings.font === 'aetheri' || raw.settings.font === 'normal') out.settings.font = raw.settings.font;
      if (Array.isArray(raw.settings.filters)) {
        const f = raw.settings.filters.filter(x => TYPES.includes(x));
        if (f.length) out.settings.filters = f;
      }
    }

    // Quita vínculos que apunten a actividades que no existen (salvo en la sincronización, donde pueden llegar después)
    const valid = new Set();
    out.schedules.forEach(s => s.items.forEach(i => valid.add(s.id + '|' + i.id)));
    const ok = l => (l && (opts.keepLinks || valid.has(l.sid + '|' + l.iid))) ? l : null;
    out.tasks.forEach(t => { t.link = ok(t.link); if (t.mode === 'repeat' && !t.link) { t.mode = 'once'; t.due = ''; t.doneDates = []; } });
    Object.values(out.notes).forEach(arr => arr.forEach(n => { n.link = ok(n.link); }));
    // Vínculos a personas (cumpleaños)
    const pIds = new Set(out.birthdays.map(b => b.id)), nIds = new Set(Object.values(out.notes).flat().map(n => n.id));
    const okP = list => opts.keepLinks ? list : list.filter(p => pIds.has(p));
    const okOne = p => p && (opts.keepLinks || pIds.has(p)) ? p : '';
    out.tasks.forEach(t => { t.persons = okP(t.persons); t.notes = opts.keepLinks ? t.notes : t.notes.filter(id => nIds.has(id)); t.subtasks.forEach(x => { x.person = okOne(x.person); }); });
    Object.values(out.notes).forEach(arr => arr.forEach(n => { n.persons = okP(n.persons); n.items.forEach(i => { i.person = okOne(i.person); }); }));
    out.birthdays.forEach(b => { b.persons = okP(b.persons).filter(p => p !== b.id); });
    return out;
  },

  /** Resumen de los datos (panel de administrador). */
  stats(s) {
    const today = D.todayKey();
    const notes = Object.values(s.notes).flat();
    const count = t => s.schedules.filter(x => x.type === t).length;
    return {
      tasks: s.tasks.length, pending: s.tasks.filter(t => taskStatus(t) === 'pending').length, done: s.tasks.filter(t => taskStatus(t) === 'done').length,
      overdue: s.tasks.filter(isOverdue).length, repeat: s.tasks.filter(t => t.mode === 'repeat').length,
      notes: notes.length, lists: notes.filter(n => n.type === 'list').length,
      birthdays: s.birthdays.length, cats: s.birthdayCategories.length,
      schedules: s.schedules.length, daily: count('daily'), weekly: count('weekly'), monthly: count('monthly'),
      items: s.schedules.reduce((a, x) => a + x.items.length, 0),
      links: s.tasks.reduce((a, t) => a + (t.link ? 1 : 0) + (t.persons || []).length + (t.notes || []).length, 0) + notes.reduce((a, n) => a + (n.link ? 1 : 0) + (n.persons || []).length, 0) + s.birthdays.reduce((a, b) => a + (b.persons || []).length, 0),
      bytes: new Blob([JSON.stringify(s)]).size,
      updated: s.meta.lastUpdated
    };
  },

  /** Fusiona comparando con lo que ya existe: agrega solo lo nuevo, nunca borra ni duplica.
      Devuelve { state, report } sin tocar el estado actual. */
  merge(cur, inc) {
    const out = clone(cur);
    const stamp = '\n\n— Importado —\n';
    const rep = { tasks: { add: 0, skip: 0 }, notes: { add: 0, skip: 0 }, birthdays: { add: 0, skip: 0 }, cats: { add: 0, skip: 0 }, schedules: { add: 0, skip: 0 }, items: { add: 0, skip: 0 }, scratch: false };

    const used = new Set();
    out.tasks.forEach(t => used.add(t.id));
    out.birthdays.forEach(b => used.add(b.id));
    out.birthdayCategories.forEach(c => used.add(c.id));
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

    /* 2) Categorías de cumpleaños (por nombre) y cumpleaños */
    const catMap = {};                                          // idViejo -> idNuevo
    inc.birthdayCategories.forEach(c => {
      let ex = out.birthdayCategories.find(x => norm(x.name) === norm(c.name));
      if (ex) rep.cats.skip++;
      else { ex = { id: freeId(c.id), name: c.name, pets: !!c.pets }; out.birthdayCategories.push(ex); rep.cats.add++; }
      catMap[c.id] = ex.id;
    });
    const bSig = b => [norm(b.name), b.month, b.day].join('|');
    const bMap = {};                                            // idViejo -> id de la persona en el resultado
    inc.birthdays.forEach(b => {
      const ex = out.birthdays.find(x => bSig(x) === bSig(b));
      if (ex) { rep.birthdays.skip++; bMap[b.id] = ex.id; return; }
      const nb = { ...b, id: freeId(b.id), category: b.category ? catMap[b.category] || null : null };
      out.birthdays.push(nb); bMap[b.id] = nb.id; rep.birthdays.add++;
    });
    const relinkP = list => [...new Set((list || []).map(p => bMap[p] || p).filter(p => out.birthdays.some(x => x.id === p)))];
    out.birthdays.forEach(b => { if (b.persons && b.persons.length) b.persons = relinkP(b.persons).filter(p => p !== b.id); });

    /* 3) Notas (por fecha) */
    const nMap = {};                                            // idViejo -> id de la nota en el resultado
    const nSig = n => JSON.stringify([n.title.trim(), n.type, n.content.trim(), n.items.map(i => i.text)]);
    Object.entries(inc.notes).forEach(([k, arr]) => {
      const list = out.notes[k] = out.notes[k] || [];
      const have = new Set(list.map(nSig));
      arr.forEach(n => {
        if (have.has(nSig(n))) { rep.notes.skip++; nMap[n.id] = list.find(x => nSig(x) === nSig(n)).id; return; }
        const nn = { ...clone(n), id: freeId(n.id), link: relink(n.link), persons: relinkP(n.persons) };
        nn.items.forEach(i => { i.person = relinkP(i.person ? [i.person] : [])[0] || ''; });
        list.push(nn); nMap[n.id] = nn.id; have.add(nSig(n)); rep.notes.add++;
      });
      if (!list.length) delete out.notes[k];
    });

    /* 4) Tareas */
    const tSig = t => norm(t.title) + '|' + t.date;
    const haveT = new Set(out.tasks.map(tSig));
    inc.tasks.forEach(t => {
      if (haveT.has(tSig(t))) { rep.tasks.skip++; return; }
      (t.subtasks || []).forEach(x => { x.person = relinkP(x.person ? [x.person] : [])[0] || ''; });
      out.tasks.push({ ...t, id: freeId(t.id), link: relink(t.link), persons: relinkP(t.persons), notes: (t.notes || []).map(id => nMap[id] || id).filter(id => Object.values(out.notes).flat().some(n => n.id === id)) }); haveT.add(tSig(t)); rep.tasks.add++;
    });

    /* 5) Bloc rápido */
    const sp = inc.scratchpad.trim();
    if (sp && !out.scratchpad.includes(sp)) { out.scratchpad = out.scratchpad.trim() ? out.scratchpad + stamp + inc.scratchpad : inc.scratchpad; rep.scratch = true; }
    return { state: out, report: rep };
  }
};
