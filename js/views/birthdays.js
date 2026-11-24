/* ===== js/views/birthdays.js — Vista: cumpleaños =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

const catName = id => state.birthdayCategories.find(c => c.id === id)?.name || '';
/* Cada categoría tiene su color (según su posición; si hay más categorías que colores, se repiten). Sin categoría: gris. */
const CAT_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#2dd4bf', '#fb923c', '#60a5fa'];
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

  const q = ui.query, t = D.today();
  const list = state.birthdays
    .filter(b => ui.bdayCat === 'all' || (ui.bdayCat === 'none' ? !b.category : b.category === ui.bdayCat))
    .filter(b => hit(b.name, q) || hit(catName(b.category), q) || hit(b.tag, q))
    .map(b => {
      let next = new Date(t.getFullYear(), b.month - 1, Math.min(b.day, D.daysIn(t.getFullYear(), b.month)));
      if (next < t) next = new Date(t.getFullYear() + 1, b.month - 1, Math.min(b.day, D.daysIn(t.getFullYear() + 1, b.month)));
      return { b, left: Math.round((next - t) / 86400000), turns: b.year ? next.getFullYear() - b.year : null };
    }).sort((a, b) => a.left - b.left);

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
  return `<div class="bday-row ${today ? 'is-today' : ''} ${soon ? 'is-soon' : ''}" style="--cc:${catColor(b.category)}">
    ${confetti}
    <span class="avatar" aria-hidden="true">${esc(initials(b.name))}${today || soon ? '<span class="av-cake">🎂</span>' : ''}</span>
    <div class="info"><b>${esc(name)}</b><span class="muted small">${b.day} de ${MONTHS[b.month - 1]}${b.year ? ' de ' + b.year : ''}${age}</span>
      ${b.category || b.tag ? `<div class="bday-tags">${bdayTags(b)}</div>` : ''}</div>
    <span class="countdown" title="${today ? 'Cumple hoy' : `Faltan ${x.left} días`}">${when}</span>
    <button class="icon-btn more" data-action="row-menu" data-id="${esc(b.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Opciones de ${esc(name)}">⋮</button>
  </div>`;
}
