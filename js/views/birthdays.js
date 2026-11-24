/* ===== js/views/birthdays.js — Vista: cumpleaños =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

const catName = id => state.birthdayCategories.find(c => c.id === id)?.name || '';
/* Cada categoría tiene su color (según su posición; si hay más categorías que colores, se repiten). Sin categoría: gris. */
const CAT_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#2dd4bf', '#fb923c', '#60a5fa'];
const personName = id => { const b = id && state.birthdays.find(x => x.id === id); return b ? displayName(b.name) : ''; };
const isPet = b => !!state.birthdayCategories.find(c => c.id === b.category && c.pets);
/** Opciones para elegir persona (ordenadas por nombre). */
function personOptions(current) {
  return `<option value="">Ninguna</option>` + state.birthdays.slice().sort((a, b) => norm(a.name).localeCompare(norm(b.name)))
    .map(b => `<option value="${esc(b.id)}" ${b.id === current ? 'selected' : ''}>${esc(displayName(b.name))}</option>`).join('');
}
/** Próximo cumpleaños desde hoy: fecha, días que faltan y años que cumple (si se sabe el año). */
function nextBday(b) {
  const t = D.today();
  let next = new Date(t.getFullYear(), b.month - 1, Math.min(b.day, D.daysIn(t.getFullYear(), b.month)));
  if (next < t) next = new Date(t.getFullYear() + 1, b.month - 1, Math.min(b.day, D.daysIn(t.getFullYear() + 1, b.month)));
  return { date: next, left: Math.round((next - t) / 86400000), turns: b.year ? next.getFullYear() - b.year : null };
}

/** Recordatorio de regalo: cuando falta poco para un cumpleaños con recordatorio, crea una tarea (una sola vez por año). */
function ensureGiftTasks() {
  const today = D.today();
  let added = 0;
  state.birthdays.forEach(b => {
    if (!b.remind) return;
    const nb = nextBday(b), y = nb.date.getFullYear();
    if ((b.giftYears || []).includes(y) || nb.left > Math.max(30, b.remind)) return;
    const due = new Date(nb.date); due.setDate(due.getDate() - b.remind);
    state.tasks.push({ id: uid(), title: `🎁 Regalo para ${displayName(b.name)}`, date: D.key(due < today ? today : due), time: '', completed: false, priority: 'medium',
      link: null, mode: 'once', due: '', doneDates: [], tags: ['regalo'], subtasks: [], person: b.id });
    b.giftYears = [...(b.giftYears || []), y].sort();
    added++;
  });
  if (added) commit();
  return added;
}

/** Ficha de una persona: datos, signo, generación, recordatorio de regalo y sus notas y tareas. */
function personHtml(b) {
  const nb = nextBday(b), pet = isPet(b), z = zodiac(b.day, b.month), gen = pet ? '' : generation(b.year);
  const when = nb.left === 0 ? '¡Hoy!' : nb.left === 1 ? 'Mañana' : `En ${nb.left} d`;
  const fact = (k, v) => `<div class="fact"><span>${k}</span><b>${v}</b></div>`;
  const notes = Object.entries(state.notes).flatMap(([k, a]) => a.map(n => [k, n])).filter(([, n]) => n.person === b.id).sort((x, y) => y[0].localeCompare(x[0]));
  const tasks = state.tasks.filter(t => t.person === b.id).sort((x, y) => (taskStatus(x) === 'done') - (taskStatus(y) === 'done') || x.date.localeCompare(y.date));
  const hasGift = notes.some(([, n]) => /^ideas de regalo/i.test(n.title));
  return `<div class="person" style="--cc:${catColor(b.category)}">
    <div class="person-top ${nb.left === 0 ? 'is-today' : ''}">
      <span class="avatar big" aria-hidden="true">${esc(initials(b.name))}${nb.left < 3 ? '<span class="av-cake">🎂</span>' : ''}</span>
      <div class="person-id"><p class="muted small">${b.day} de ${MONTHS[b.month - 1]}${b.year ? ' de ' + b.year : ''}</p>
        ${b.category || b.tag || pet ? `<div class="bday-tags">${bdayTags(b)}${pet ? '<span class="bt tag">🐾 Mascota</span>' : ''}</div>` : ''}</div>
      <span class="countdown">${when}</span>
    </div>
    <div class="person-facts">
      ${nb.turns ? fact(nb.left === 0 ? 'Cumple hoy' : 'Cumplirá', plural(nb.turns, 'año', 'años')) : ''}
      ${b.year && nb.turns && nb.left !== 0 ? fact('Edad', plural(nb.turns - 1, 'año', 'años')) : ''}
      ${fact('Signo', `${z.sym} ${z.name}`)}
      ${gen ? fact('Generación', gen) : ''}
    </div>
    <div class="person-remind">
      <label class="inline-chk"><input type="checkbox" data-change="bday-remind" data-id="${esc(b.id)}" ${b.remind ? 'checked' : ''}> 🎁 Recordarme comprar regalo</label>
      <label class="inline-chk days"><input type="number" min="1" max="60" value="${b.remind || 7}" data-change="bday-remind-days" data-id="${esc(b.id)}" aria-label="Días antes"> días antes</label>
    </div>
    <div class="person-actions">
      <button class="btn btn-primary" data-action="gift-note" data-id="${esc(b.id)}">💡 ${hasGift ? 'Ideas de regalo' : 'Anotar ideas de regalo'}</button>
      <button class="btn btn-ghost" data-action="new-task" data-person="${esc(b.id)}" data-back="person">+ Tarea</button>
      <button class="btn btn-ghost" data-action="person-note" data-id="${esc(b.id)}">+ Nota</button>
      <button class="btn btn-ghost" data-action="edit-bday" data-id="${esc(b.id)}">${ICON_EDIT} Editar datos</button>
    </div>
    <h4 class="sub">Notas</h4>
    ${notes.length ? `<div class="person-notes">${notes.map(([k, n]) => `<button class="note-chip" data-action="open-note" data-key="${esc(k)}" data-id="${esc(n.id)}">${n.pinned ? '📌 ' : ''}${n.type === 'list' ? '☑' : '📝'} ${esc(noteLabel(n))} <small class="muted">${esc(D.short(k))}</small></button>`).join('')}</div>` : '<p class="empty-note">Sin notas vinculadas.</p>'}
    <h4 class="sub">Tareas</h4>
    ${tasks.length ? `<ul class="tasks">${tasks.map(t => taskRow(t)).join('')}</ul>` : '<p class="empty-note">Sin tareas vinculadas.</p>'}
  </div>`;
}
function openPersonSheet(id) {
  const b = state.birthdays.find(x => x.id === id); if (!b) return;
  ui.personOpen = id;
  openSheet({ title: displayName(b.name), html: personHtml(b), wide: true, isDirty: () => false, onClose: () => { ui.personOpen = null; } });
}
/** Mantiene la ficha al día si cambia algo con ella abierta (marcar una tarea, editar los datos…). */
function refreshPersonSheet() {
  if (!ui.personOpen || !sheetOpen()) return;
  const b = state.birthdays.find(x => x.id === ui.personOpen);
  if (!b) { closeSheetNow(); return; }
  const body = $('#sheetRoot .sheet-body'), h = $('#sheetRoot .form-sheet > h3');
  if (!body || !body.querySelector('.person')) return;
  body.innerHTML = personHtml(b);
  h.textContent = displayName(b.name);
}

const catColor = id => { const i = state.birthdayCategories.findIndex(c => c.id === id); return i < 0 ? 'var(--muted)' : CAT_COLORS[i % CAT_COLORS.length]; };

/** Opciones de categoría para un <select> (la primera es "Sin categoría"). */
const catOptions = current => `<option value="">Sin categoría</option>` +
  state.birthdayCategories.map(c => `<option value="${esc(c.id)}" ${c.id === current ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

/** Lee y valida un formulario de cumpleaños. Devuelve el objeto o un texto de error. */
function readBdayForm(f) {
  const fd = new FormData(f);
  const name = String(fd.get('name') || '').trim(), day = +fd.get('day'), month = +fd.get('month');
  const yr = String(fd.get('year') || '') === '' ? null : +fd.get('year');
  if (!name) return 'Escribe el nombre';
  if (!Number.isInteger(month) || month < 1 || month > 12) return 'Elige el mes';
  if (!Number.isInteger(day) || day < 1 || day > D.daysIn(2024, month)) return `${cap(MONTHS[month - 1])} no tiene ese día`;
  if (yr !== null && (!Number.isInteger(yr) || yr < 1900 || yr > new Date().getFullYear())) return 'Año inválido';
  const cat = String(fd.get('category') || '');
  return { name, day, month, year: yr, category: catName(cat) ? cat : null, tag: String(fd.get('tag') || '').trim().slice(0, 30) };
}

function bdayTags(b) {
  const c = catName(b.category);
  return (c ? `<span class="bt cat" style="--cc:${catColor(b.category)}">${esc(c)}</span>` : '') + (b.tag ? `<span class="bt tag">${esc(b.tag)}</span>` : '');
}

function renderBirthdays() {
  renderAlerts();
  const fsel = $('#bdayCatFilter');
  if (ui.bdayCat !== 'all' && ui.bdayCat !== 'none' && !catName(ui.bdayCat)) ui.bdayCat = 'all';
  fsel.innerHTML = `<option value="all">Todas las categorías</option>` +
    state.birthdayCategories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('') +
    `<option value="none">Sin categoría</option>`;
  fsel.value = ui.bdayCat;

  const q = ui.query;
  const list = state.birthdays
    .filter(b => ui.bdayCat === 'all' || (ui.bdayCat === 'none' ? !b.category : b.category === ui.bdayCat))
    .filter(b => hit(b.name, q) || hit(catName(b.category), q) || hit(b.tag, q))
    .map(b => ({ b, ...nextBday(b) })).sort((a, b) => a.left - b.left);

  $('#bdayCount').textContent = list.length ? `(${list.length})` : '';
  $('#bdayList').innerHTML = list.length ? list.map(bdayRow).join('') : `<p class="empty-note">${q || ui.bdayCat !== 'all' ? 'Sin coincidencias.' : 'Aún no hay cumpleaños guardados.'}</p>`;
}

/** Fila de cumpleaños: avatar con iniciales (color de su categoría), nombre, fecha, etiquetas, cuenta regresiva y menú ⋮.
    Los de hoy se destacan (borde con degradado, resplandor, pastel con pulso y confeti); el pastel solo aparece si faltan menos de 3 días. */
function bdayRow(x) {
  const b = x.b, today = x.left === 0, soon = x.left > 0 && x.left < 3, name = displayName(b.name);
  const when = today ? '¡Hoy!' : x.left === 1 ? 'Mañana' : `En ${x.left} d`;
  const age = x.turns ? (today ? ` · cumple ${x.turns}` : ` · cumplirá ${x.turns}`) : '';
  const confetti = today ? `<span class="confetti" aria-hidden="true">${'<i></i>'.repeat(10)}</span>` : '';
  return `<div class="bday-row ${today ? 'is-today' : ''} ${soon ? 'is-soon' : ''}" style="--cc:${catColor(b.category)}" data-action="open-person" data-id="${esc(b.id)}" role="button" tabindex="0" aria-label="Ver la ficha de ${esc(name)}">
    ${confetti}
    <span class="avatar" aria-hidden="true">${esc(initials(b.name))}${today || soon ? '<span class="av-cake">🎂</span>' : ''}</span>
    <div class="info"><b>${esc(name)}${b.remind ? ' <span class="gift-on" title="Recordatorio de regalo activado">🎁</span>' : ''}</b><span class="muted small">${b.day} de ${MONTHS[b.month - 1]}${b.year ? ' de ' + b.year : ''}${age}</span>
      ${b.category || b.tag ? `<div class="bday-tags">${bdayTags(b)}</div>` : ''}</div>
    <span class="countdown" title="${today ? 'Cumple hoy' : `Faltan ${x.left} días`}">${when}</span>
    <button class="icon-btn more" data-action="row-menu" data-id="${esc(b.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Opciones de ${esc(name)}">⋮</button>
  </div>`;
}
