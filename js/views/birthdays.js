/* ===== js/views/birthdays.js — Vista: fechas importantes (cumpleaños y otras fechas) =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html).
   Los datos siguen en state.birthdays (por compatibilidad), con kind 'birthday' o 'event'.
   Las "otras fechas" se repiten cada año, cada mes o cada semana (ej. una relación que se celebra cada mes). */
'use strict';

const catName = id => state.birthdayCategories.find(c => c.id === id)?.name || '';
/* Cada categoría tiene su color (según su posición; si hay más categorías que colores, se repiten). Sin categoría: gris. */
/* Paleta categórica validada (daltonismo, contraste y brillo) para el fondo oscuro y el claro; mismo orden en los dos. */
const CAT_COLORS = {
  dark: ['#338ced', '#e76624', '#00a888', '#d28e05', '#e24d8b', '#0aac23', '#9887ef', '#eb6263'],
  light: ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2', '#ec4647']
};
const catColor = id => { const i = state.birthdayCategories.findIndex(c => c.id === id); const pal = CAT_COLORS[state.settings.theme === 'light' ? 'light' : 'dark']; return i < 0 ? 'var(--muted)' : pal[i % pal.length]; };
/** Opciones de categoría para un <select> (la primera es "Sin categoría"). */
const catOptions = current => `<option value="">Sin categoría</option>` +
  state.birthdayCategories.map(c => `<option value="${esc(c.id)}" ${c.id === current ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

/* ---------- Tipos y repetición ---------- */
const DATE_KINDS = {
  birthday: { label: 'Cumpleaños', icon: '🎂', name: 'Nombre de la persona', year: 'Año de nacimiento' },
  event: { label: 'Otra fecha', icon: '📅', name: 'Nombre de la fecha (ej. Aniversario con Mariana)', year: 'Año en que empezó' }
};
const REPEATS = {
  yearly: { label: 'Cada año', one: 'año', many: 'años' },
  monthly: { label: 'Cada mes', one: 'mes', many: 'meses' },
  weekly: { label: 'Cada semana', one: 'semana', many: 'semanas' }
};
const RELATIONS = ['Mamá', 'Papá', 'Hermano', 'Hermana', 'Abuelo', 'Abuela', 'Tío', 'Tía', 'Primo', 'Prima', 'Sobrino', 'Sobrina', 'Hijo', 'Hija', 'Pareja', 'Amigo', 'Amiga', 'Mejor amigo', 'Mejor amiga', 'Compañero', 'Compañera', 'Profe', 'Vecino', 'Vecina', 'Mascota'];
const DEFAULT_MSG = '¡Feliz cumpleaños, {apodo}! 🎉 Que este nuevo año te traiga muchas cosas buenas. ¡Un abrazo!';

const kindOf = b => DATE_KINDS[b && b.kind] ? b.kind : 'birthday';
const kindIcon = b => DATE_KINDS[kindOf(b)].icon;
const repeatOf = b => kindOf(b) === 'event' && REPEATS[b.repeat] ? b.repeat : 'yearly';
/** Fecha en que empezó (o nació), si se sabe el año. */
const startKey = b => b.year ? `${b.year}-${D.pad(b.month)}-${D.pad(Math.min(b.day, D.daysIn(b.year, b.month)))}` : '';
/** Cuántos años / meses / semanas se cumplen, dicho según el tipo: "cumple 17", "cumplirá 17", "5 meses", "hoy 5 meses". */
function yearsText(b, n, today) {
  if (!n) return '';
  if (kindOf(b) === 'birthday') return today ? `cumple ${n}` : `cumplirá ${n}`;
  const r = REPEATS[repeatOf(b)];
  return (today ? 'hoy ' : '') + plural(n, r.one, r.many);
}
/** Si la fecha ocurre el día `key`: { n } con lo cumplido (null si no se sabe el año); si no ocurre: null. */
function occurrenceOn(b, key) {
  const d = D.parse(key), y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const r = repeatOf(b), start = startKey(b);
  if (start && key < start) return null;                                   // todavía no empieza
  if (r === 'yearly') {
    if (m !== b.month || day !== Math.min(b.day, D.daysIn(y, b.month))) return null;   // 29 de febrero → 28 en años no bisiestos
    return { n: b.year ? y - b.year : null };
  }
  if (r === 'monthly') {
    if (day !== Math.min(b.day, D.daysIn(y, m))) return null;               // día 31 → último día en meses cortos
    return { n: b.year ? (y - b.year) * 12 + (m - b.month) : null };
  }
  if (!start) return null;                                                  // cada semana: necesita la fecha de inicio
  const diff = Math.round((d - D.parse(start)) / 86400000);
  return diff % 7 === 0 ? { n: diff / 7 } : null;
}
/** Próxima vez (desde hoy): fecha, días que faltan, lo que se cumple y su clave YYYY-MM-DD. */
function nextBday(b) {
  const t = D.today(), r = repeatOf(b), start = startKey(b);
  let next;
  if (r === 'yearly') {
    next = new Date(t.getFullYear(), b.month - 1, Math.min(b.day, D.daysIn(t.getFullYear(), b.month)));
    if (next < t) next = new Date(t.getFullYear() + 1, b.month - 1, Math.min(b.day, D.daysIn(t.getFullYear() + 1, b.month)));
    if (start && D.key(next) < start) next = D.parse(start);
  } else if (r === 'monthly') {
    for (let i = 0; i < 400 && !next; i++) {
      const y = t.getFullYear() + Math.floor((t.getMonth() + i) / 12), m = (t.getMonth() + i) % 12;
      const c = new Date(y, m, Math.min(b.day, D.daysIn(y, m + 1)));
      if (c >= t && (!start || D.key(c) >= start)) next = c;
    }
  } else {
    const s = D.parse(start);
    if (s >= t) next = s;
    else { next = new Date(t); next.setDate(t.getDate() + (7 - Math.round((t - s) / 86400000) % 7) % 7); }
  }
  const key = D.key(next), o = occurrenceOn(b, key);
  return { date: next, key, left: Math.round((next - t) / 86400000), turns: o && o.n > 0 ? o.n : null };
}
/** Texto de cuándo es: "24 de noviembre de 2009", "Cada mes, el día 14 · desde jun 2025", "Cada lunes · desde 3 nov 2025". */
function whenText(b) {
  const r = repeatOf(b);
  if (r === 'monthly') return `Cada mes, el día ${b.day}${b.year ? ` · desde ${MONTHS[b.month - 1].slice(0, 3)} ${b.year}` : ''}`;
  if (r === 'weekly') return `Cada ${WD_LONG[D.wd(D.parse(startKey(b)))]} · desde ${D.full(startKey(b))}`;
  return `${b.day} de ${MONTHS[b.month - 1]}${b.year ? ' de ' + b.year : ''}`;
}

/* ---------- Nombres y selector de personas ---------- */
/** Nombre para mostrar: a las personas se les pone mayúscula en cada palabra; a las demás fechas, solo al inicio. */
const dateName = b => kindOf(b) === 'birthday' ? displayName(b.name) : cap(String(b.name));
const personName = id => { const b = id && state.birthdays.find(x => x.id === id); return b ? dateName(b) : ''; };
/** Persona cuyo nombre (o apodo) es exactamente ese texto: así, escribir un nombre en una lista o subtarea la vincula. */
function personByName(text) {
  const q = norm(String(text || '').trim()); if (!q) return '';
  const b = state.birthdays.find(x => kindOf(x) === 'birthday' && (norm(dateName(x)) === q || norm(x.name) === q || (x.nick && norm(x.nick) === q)));
  return b ? b.id : '';
}
/** Texto de un ítem o subtarea: si es una persona, como 👤 que abre su ficha. */
const itemText = x => x.person && personName(x.person)
  ? `<button class="t-person" data-action="open-person" data-id="${esc(x.person)}" title="Ver la ficha">👤 ${esc(x.text)}</button>` : esc(x.text);
/** Opciones "+ Agregar persona…" para listas y subtareas (solo personas). */
const addPersonOptions = label => `<option value="">${label}</option>` + state.birthdays.filter(b => kindOf(b) === 'birthday')
  .sort((a, b) => norm(a.name).localeCompare(norm(b.name))).map(b => `<option value="${esc(b.id)}">${esc(dateName(b))}</option>`).join('');
const isPet = b => !!state.birthdayCategories.find(c => c.id === b.category && c.pets);
const nickOf = b => (b.nick || '').trim() || dateName(b).split(/\s+/)[0];
/** Opciones para elegir persona o fecha (ordenadas por nombre). */
function personOptions(current) {
  return `<option value="">Ninguna</option>` + state.birthdays.slice().sort((a, b) => norm(a.name).localeCompare(norm(b.name)))
    .map(b => `<option value="${esc(b.id)}" ${b.id === current ? 'selected' : ''}>${kindOf(b) === 'birthday' ? '' : kindIcon(b) + ' '}${esc(dateName(b))}</option>`).join('');
}

/* ---------- Recordatorio: tarea automática ---------- */
/** Cuando falta poco para una fecha con recordatorio, crea una tarea (una sola vez por cada vez que ocurre).
    El id de la tarea es fijo para esa fecha y esa ocurrencia: si dos dispositivos la crean a la vez, en la nube es el mismo
    documento y queda una sola. Si se borra, no vuelve a aparecer (giftYears / giftDates). */
function ensureGiftTasks() {
  const today = D.today();
  let added = 0;
  state.birthdays.forEach(b => {
    if (!b.remind) return;
    const nb = nextBday(b), r = repeatOf(b), y = nb.date.getFullYear();
    const days = r === 'weekly' ? Math.min(b.remind, 6) : r === 'monthly' ? Math.min(b.remind, 27) : b.remind;
    const done = r === 'yearly' ? (b.giftYears || []).includes(y) : (b.giftDates || []).includes(nb.key);
    if (done || nb.left > (r === 'yearly' ? Math.max(30, days) : days)) return;
    const tid = (r === 'yearly' ? `r${y}-${b.id}` : `r${nb.key.replace(/-/g, '')}-${b.id}`).slice(0, 64);
    if (!state.tasks.some(t => t.id === tid)) {
      const due = new Date(nb.date); due.setDate(due.getDate() - days);
      const isB = kindOf(b) === 'birthday', name = dateName(b);
      state.tasks.push({ id: tid, title: isB ? `🎁 Regalo para ${name}` : `📅 Preparar: ${name}`, date: D.key(due < today ? today : due), time: '', completed: false,
        priority: 'medium', link: null, mode: 'once', due: '', doneDates: [], tags: [isB ? 'regalo' : 'fecha'], subtasks: [], persons: [b.id], notes: [], doneAt: '' });
    }
    if (r === 'yearly') b.giftYears = [...(b.giftYears || []), y].sort();
    else b.giftDates = [...(b.giftDates || []), nb.key].sort().slice(-24);
    added++;
  });
  if (added) commit();
  return added;
}

/* ---------- Formulario (crear y editar) ---------- */
function bdayFieldsHtml(b) {
  const k = kindOf(b), r = repeatOf(b || {});
  return `<label>Tipo <select name="kind" data-change="bday-kind">${Object.entries(DATE_KINDS).map(([v, x]) => `<option value="${v}" ${v === k ? 'selected' : ''}>${x.icon} ${x.label}</option>`).join('')}</select></label>
    <label><span class="lbl-name">${DATE_KINDS[k].name}</span> <input name="name" required maxlength="60" value="${esc(b ? b.name : '')}"></label>
    <label class="event-only" ${k === 'event' ? '' : 'hidden'}>Se repite <select name="repeat" data-change="bday-kind">${Object.entries(REPEATS).map(([v, x]) => `<option value="${v}" ${v === r ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
    <div class="row3">
      <label>Día <input name="day" type="number" min="1" max="31" required value="${b ? b.day : ''}" placeholder="15"></label>
      <label>Mes <select name="month" id="bdayMonth">${MONTHS.map((m, i) => `<option value="${i + 1}" ${b && i + 1 === b.month ? 'selected' : ''}>${cap(m)}</option>`).join('')}</select></label>
      <label><span class="lbl-year">${DATE_KINDS[k].year}</span> <input name="year" type="number" min="1900" max="2100" placeholder="Opcional" value="${b && b.year ? b.year : ''}"></label>
    </div>
    <p class="muted small repeat-help" hidden></p>
    <div class="field event-only" ${k === 'event' ? '' : 'hidden'}><span class="lbl">Personas vinculadas (opcional)</span>${pickerHtml('people', 'persons', b ? b.persons || [] : [], b ? b.id : '')}</div>
    <div class="row2 person-only" ${k === 'birthday' ? '' : 'hidden'}>
      <label>Apodo <input name="nick" maxlength="30" placeholder="Opcional (ej. Javi)" value="${esc(b ? b.nick || '' : '')}"></label>
      <label class="suggest">Parentesco <input name="relation" maxlength="30" data-suggest="relation" autocomplete="off" aria-autocomplete="list" placeholder="Opcional (ej. Primo)" value="${esc(b ? b.relation || '' : '')}"><ul class="combo-list" role="listbox" hidden></ul></label>
    </div>
    <div class="row2">
      <label>Categoría <select name="category" id="bdayCat">${catOptions(b ? b.category : '')}</select></label>
      <label>Etiqueta <input name="tag" maxlength="30" placeholder="Opcional" value="${esc(b ? b.tag || '' : '')}"></label>
    </div>`;
}
/** Muestra los campos que aplican según el tipo y la repetición. */
function syncBdayForm(f) {
  const kind = f.elements.kind.value, k = DATE_KINDS[kind] || DATE_KINDS.birthday, ev = kind === 'event', rep = f.elements.repeat.value;
  f.querySelector('.lbl-name').textContent = k.name;
  f.querySelector('.lbl-year').textContent = ev && rep !== 'yearly' ? 'Año en que empezó (necesario)' : k.year;
  f.querySelectorAll('.event-only').forEach(x => { x.hidden = !ev; });
  f.querySelector('.person-only').hidden = ev;
  f.elements.year.required = ev && rep !== 'yearly';
  const help = f.querySelector('.repeat-help');
  help.hidden = !ev || rep === 'yearly';
  help.textContent = rep === 'monthly' ? 'Se celebra ese día cada mes (si el mes es más corto, el último día). Con el año de inicio se cuentan los meses.'
    : 'Se repite cada semana, el mismo día de la semana de la fecha de inicio.';
}
/** Lee y valida el formulario. Devuelve el objeto o un texto de error. */
function readBdayForm(f) {
  const fd = new FormData(f);
  const kind = DATE_KINDS[fd.get('kind')] ? String(fd.get('kind')) : 'birthday';
  const repeat = kind === 'event' && REPEATS[fd.get('repeat')] ? String(fd.get('repeat')) : 'yearly';
  const name = String(fd.get('name') || '').trim(), day = +fd.get('day'), month = +fd.get('month');
  const yr = String(fd.get('year') || '') === '' ? null : +fd.get('year');
  if (!name) return 'Escribe el nombre';
  if (!Number.isInteger(month) || month < 1 || month > 12) return 'Elige el mes';
  if (!Number.isInteger(day) || day < 1 || day > D.daysIn(2024, month)) return `${cap(MONTHS[month - 1])} no tiene ese día`;
  if (yr !== null && (!Number.isInteger(yr) || yr < 1900 || yr > 2100 || (kind === 'birthday' && yr > new Date().getFullYear()))) return 'Año inválido';
  if (repeat !== 'yearly' && yr === null) return 'Para que se repita cada mes o cada semana, escribe el año en que empezó';
  if (yr !== null && day > D.daysIn(yr, month)) return `En ${yr} ${MONTHS[month - 1]} no tiene ese día`;
  const cat = String(fd.get('category') || '');
  return { kind, repeat, name, day, month, year: yr, category: catName(cat) ? cat : null, tag: String(fd.get('tag') || '').trim().slice(0, 30),
    nick: kind === 'birthday' ? String(fd.get('nick') || '').trim().slice(0, 30) : '',
    relation: kind === 'birthday' ? String(fd.get('relation') || '').trim().slice(0, 30) : '',
    persons: kind === 'event' ? String(fd.get('persons') || '').split(',').filter(id => state.birthdays.some(x => x.id === id && kindOf(x) === 'birthday')) : [] };
}

function bdayTags(b) {
  const c = catName(b.category);
  return (c ? `<span class="bt cat" style="--cc:${catColor(b.category)}">${esc(c)}</span>` : '') + (b.tag ? `<span class="bt tag">${esc(b.tag)}</span>` : '');
}

/* ---------- Mensaje para copiar ---------- */
/** Reemplaza {nombre}, {apodo} y {edad} (lo que cumple; si no se sabe, se quita). */
function fillMessage(tpl, b) {
  const n = nextBday(b).turns;
  return String(tpl || DEFAULT_MSG)
    .replace(/\{nombre\}/gi, dateName(b)).replace(/\{apodo\}/gi, nickOf(b)).replace(/\{edad\}/gi, n ? String(n) : '')
    .replace(/[ \t]{2,}/g, ' ').trim();
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* sin permiso: método antiguo */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}

/* ---------- Ficha de la persona o fecha ---------- */
function personHtml(b) {
  const k = kindOf(b), isB = k === 'birthday', r = repeatOf(b), nb = nextBday(b), pet = isPet(b), z = zodiac(b.day, b.month), gen = pet || !isB ? '' : generation(b.year);
  const when = nb.left === 0 ? '¡Hoy!' : nb.left === 1 ? 'Mañana' : `En ${nb.left} d`;
  const fact = (t, v) => `<div class="fact"><span>${t}</span><b>${v}</b></div>`;
  const unit = REPEATS[r];
  const notes = Object.entries(state.notes).flatMap(([d, a]) => a.map(n => [d, n])).filter(([, n]) => (n.persons || []).includes(b.id) || n.items.some(i => i.person === b.id))
    .sort((x, y) => (y[1].updatedAt || '').localeCompare(x[1].updatedAt || ''));
  const gift = notes.find(([, n]) => /^ideas de regalo/i.test(n.title) && n.type === 'list');
  const tasks = state.tasks.filter(t => (t.persons || []).includes(b.id) || (t.subtasks || []).some(x => x.person === b.id)).sort((x, y) => (taskStatus(x) === 'done') - (taskStatus(y) === 'done') || x.date.localeCompare(y.date));
  const pend = tasks.filter(t => taskStatus(t) !== 'done').length;
  const tab = ui.personTab === 'notes' ? 'notes' : 'todo';
  const ideas = gift ? gift[1].items : [];
  const sub = [isB ? '' : DATE_KINDS[k].label, b.relation, b.nick ? `“${b.nick}”` : ''].filter(Boolean).map(esc).join(' · ');

  const todo = `
    <h4 class="sub">Tareas</h4>
    ${tasks.length ? `<ul class="tasks">${tasks.map(t => taskRow(t)).join('')}</ul>` : '<p class="empty-note">Sin tareas vinculadas.</p>'}
    <button class="btn btn-ghost btn-xs" data-action="new-task" data-person="${esc(b.id)}" data-back="person">+ Tarea</button>
    <h4 class="sub">💡 Ideas de regalo</h4>
    ${ideas.length ? `<ul class="gift-list">${ideas.map(i => `<li class="${i.done ? 'done' : ''}"><label class="check"><input type="checkbox" data-change="gift-item" data-note="${esc(gift[1].id)}" data-item="${esc(i.id)}" ${i.done ? 'checked' : ''} aria-label="Ya está"><span class="box"></span></label><span>${esc(i.text)}</span></li>`).join('')}</ul>` : '<p class="empty-note">Todavía no hay ideas.</p>'}
    <form data-form="gift-add" data-id="${esc(b.id)}" class="quick" autocomplete="off">
      <input name="text" maxlength="120" required placeholder="Agregar una idea (ej. audífonos ~150.000)" aria-label="Nueva idea de regalo">
      <button class="btn btn-primary" aria-label="Agregar idea">+</button>
    </form>
    ${gift ? `<button class="btn btn-ghost btn-xs" data-action="gift-note" data-id="${esc(b.id)}">Abrir la nota completa</button>` : ''}`;
  const hist = notes.length
    ? `<div class="hist">${notes.map(([d, n]) => `<button class="hist-item" data-action="open-note" data-key="${esc(d)}" data-id="${esc(n.id)}">
        <b>${n.pinned ? '📌 ' : ''}${n.type === 'list' ? '☑' : '📝'} ${esc(noteLabel(n))}</b>
        <small class="muted">${esc(D.short(d))}${n.updatedAt ? ` · editada ${esc(new Date(n.updatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }))}` : ''}</small>
        <span>${esc(n.type === 'list' ? n.items.slice(0, 3).map(i => i.text).join(', ') : n.content.trim().slice(0, 110))}</span></button>`).join('')}</div>`
    : '<p class="empty-note">Sin notas vinculadas.</p>';

  return `<div class="person" style="--cc:${catColor(b.category)}">
    <div class="person-top ${nb.left === 0 ? 'is-today' : ''}">
      <span class="avatar big ${isB ? '' : 'icon'}" aria-hidden="true">${isB ? esc(initials(b.name)) : kindIcon(b)}${isB && nb.left < 3 ? '<span class="av-cake">🎂</span>' : ''}</span>
      <div class="person-id">${sub ? `<p class="person-sub">${sub}</p>` : ''}<p class="muted small">${esc(whenText(b))}</p>
        ${b.category || b.tag || pet ? `<div class="bday-tags">${bdayTags(b)}${pet ? '<span class="bt tag">🐾 Mascota</span>' : ''}</div>` : ''}</div>
      <span class="countdown">${when}</span>
    </div>
    ${(() => {
      const links = isB ? state.birthdays.filter(x => (x.persons || []).includes(b.id)) : state.birthdays.filter(x => (b.persons || []).includes(x.id));
      return links.length ? `<div class="t-info person-links"><span class="muted small">${isB ? 'Fechas:' : 'Personas:'}</span>${links.map(x => `<button class="t-person" data-action="open-person" data-id="${esc(x.id)}">${kindIcon(x)} ${esc(dateName(x))}</button>`).join('')}</div>` : '';
    })()}
    <div class="person-facts">
      ${nb.turns ? fact(isB ? (nb.left === 0 ? 'Cumple hoy' : 'Cumplirá') : (nb.left === 0 ? 'Hoy cumplen' : 'Cumplirán'), plural(nb.turns, isB ? 'año' : unit.one, isB ? 'años' : unit.many)) : ''}
      ${isB && b.year && nb.turns && nb.left !== 0 ? fact('Edad', plural(nb.turns - 1, 'año', 'años')) : ''}
      ${!isB ? fact('Se repite', unit.label) : ''}
      ${!isB && b.year ? fact('Desde', D.full(startKey(b))) : ''}
      ${isB ? fact('Signo', `${z.sym} ${z.name}`) : ''}
      ${gen ? fact('Generación', gen) : ''}
    </div>
    <div class="person-remind">
      <label class="inline-chk"><input type="checkbox" data-change="bday-remind" data-id="${esc(b.id)}" ${b.remind ? 'checked' : ''}> ${isB ? '🎁 Recordarme comprar regalo' : '📅 Recordarme con tiempo'}</label>
      <label class="inline-chk days"><input type="number" min="1" max="${r === 'weekly' ? 6 : r === 'monthly' ? 27 : 60}" value="${Math.min(b.remind || (r === 'weekly' ? 1 : 7), r === 'weekly' ? 6 : 60)}" data-change="bday-remind-days" data-id="${esc(b.id)}" aria-label="Días antes"> días antes</label>
    </div>
    <div class="person-actions">
      <button class="btn btn-primary" data-action="copy-msg" data-id="${esc(b.id)}">📋 Copiar mensaje</button>
      <button class="btn btn-ghost" data-action="person-note" data-id="${esc(b.id)}">+ Nota</button>
      <button class="btn btn-ghost" data-action="edit-bday" data-id="${esc(b.id)}">${ICON_EDIT} Editar datos</button>
    </div>
    <div class="seg person-tabs" role="tablist">
      <button role="tab" data-action="person-tab" data-v="todo" class="${tab === 'todo' ? 'on' : ''}" aria-selected="${tab === 'todo'}">Pendientes y regalos${pend + ideas.filter(i => !i.done).length ? ` (${pend + ideas.filter(i => !i.done).length})` : ''}</button>
      <button role="tab" data-action="person-tab" data-v="notes" class="${tab === 'notes' ? 'on' : ''}" aria-selected="${tab === 'notes'}">Historial y notas${notes.length ? ` (${notes.length})` : ''}</button>
    </div>
    <div class="person-pane">${tab === 'todo' ? todo : hist}</div>
  </div>`;
}
function openPersonSheet(id) {
  const b = state.birthdays.find(x => x.id === id); if (!b) return;
  if (ui.personOpen !== id) ui.personTab = 'todo';
  ui.personOpen = id;
  openSheet({ title: dateName(b), html: personHtml(b), wide: true, focus: false, isDirty: () => false, onClose: () => { ui.personOpen = null; } });   // la ficha es para leer: sin cursor ni teclado
}
/** Mantiene la ficha al día si cambia algo con ella abierta (marcar una tarea, agregar una idea, editar los datos…). */
function refreshPersonSheet() {
  if (!ui.personOpen || !sheetOpen()) return;
  const b = state.birthdays.find(x => x.id === ui.personOpen);
  if (!b) { closeSheetNow(); return; }
  const body = $('#sheetRoot .sheet-body'), h = $('#sheetRoot .form-sheet > h3');
  if (!body || !body.querySelector('.person')) return;
  const focusGift = document.activeElement && document.activeElement.closest && document.activeElement.closest('form[data-form=gift-add]');
  body.innerHTML = personHtml(b);
  h.textContent = dateName(b);
  if (focusGift) body.querySelector('form[data-form=gift-add] input')?.focus();
}

/* ---------- Lista ---------- */
function renderBirthdays() {
  const fsel = $('#bdayCatFilter');
  if (ui.bdayCat !== 'all' && ui.bdayCat !== 'none' && !catName(ui.bdayCat)) ui.bdayCat = 'all';
  if (ui.bdayKind !== 'all' && !DATE_KINDS[ui.bdayKind]) ui.bdayKind = 'all';
  fsel.innerHTML = `<option value="all">Todas las categorías</option>` +
    state.birthdayCategories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('') +
    `<option value="none">Sin categoría</option>`;
  fsel.value = ui.bdayCat;

  const q = ui.query;
  $$('#bdayKindSeg button').forEach(x => x.classList.toggle('on', x.dataset.v === ui.bdayKind));
  const list = state.birthdays
    .filter(b => ui.bdayKind === 'all' || kindOf(b) === ui.bdayKind)
    .filter(b => ui.bdayCat === 'all' || (ui.bdayCat === 'none' ? !b.category : b.category === ui.bdayCat))
    .filter(b => hit(b.name, q) || hit(catName(b.category), q) || hit(b.tag, q) || hit(b.relation || '', q) || hit(b.nick || '', q))
    .filter(b => { const w = norm(ui.bdayQ || '').split(/\s+/).filter(Boolean); if (!w.length) return true; const t = norm([b.name, dateName(b), b.nick, b.relation, catName(b.category), b.tag].filter(Boolean).join(' ')); return w.every(x => t.includes(x)); })
    .map(b => ({ b, ...nextBday(b) })).sort((a, b) => a.left - b.left);

  $('#bdayCount').textContent = list.length ? `(${list.length})` : '';
  $('#bdayList').innerHTML = list.length ? list.map(bdayRow).join('') : `<p class="empty-note">${q || ui.bdayCat !== 'all' || ui.bdayKind !== 'all' ? 'Sin coincidencias.' : 'Aún no hay fechas guardadas.'}</p>`;
  if (ui.bdayQ && !list.length) $('#bdayList').innerHTML = `<p class="empty-note">Nadie coincide con “${esc(ui.bdayQ)}”.</p>`;
}

/** Fila: avatar (iniciales con el color de su categoría, o el ícono de la fecha), nombre, parentesco, cuándo, etiquetas, cuenta regresiva y menú ⋮.
    Las de hoy se destacan (borde con degradado, resplandor y confeti); el pastel solo en cumpleaños de hoy o de los próximos 2 días. */
function bdayRow(x) {
  const b = x.b, today = x.left === 0, soon = x.left > 0 && x.left < 3, name = dateName(b), isB = kindOf(b) === 'birthday';
  const when = today ? '¡Hoy!' : x.left === 1 ? 'Mañana' : `En ${x.left} d`;
  const age = x.turns ? ' · ' + yearsText(b, x.turns, today) : '';
  const confetti = today ? `<span class="confetti" aria-hidden="true">${'<i></i>'.repeat(10)}</span>` : '';
  return `<div class="bday-row ${today ? 'is-today' : ''} ${soon ? 'is-soon' : ''}" style="--cc:${catColor(b.category)}" data-action="open-person" data-id="${esc(b.id)}" role="button" tabindex="0" aria-label="Ver la ficha de ${esc(name)}">
    ${confetti}
    <span class="avatar ${isB ? '' : 'icon'}" aria-hidden="true">${isB ? esc(initials(b.name)) : kindIcon(b)}${isB && (today || soon) ? '<span class="av-cake">🎂</span>' : ''}</span>
    <div class="info"><b>${esc(name)}${b.remind ? ' <span class="gift-on" title="Recordatorio activado">🎁</span>' : ''}</b><span class="muted small">${b.relation ? `<span class="rel">${esc(b.relation)}</span> · ` : ''}${esc(whenText(b))}${age}</span>
      ${b.category || b.tag ? `<div class="bday-tags">${bdayTags(b)}</div>` : ''}</div>
    <span class="countdown" title="${today ? 'Es hoy' : `Faltan ${x.left} días`}">${when}</span>
    <button class="icon-btn more" data-action="row-menu" data-id="${esc(b.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Opciones de ${esc(name)}">⋮</button>
  </div>`;
}
