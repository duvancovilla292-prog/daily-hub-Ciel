/* ===== js/views/birthdays.js — Vista: cumpleaños =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

const catName = id => state.birthdayCategories.find(c => c.id === id)?.name || '';

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
  return (c ? `<span class="bt cat">${esc(c)}</span>` : '') + (b.tag ? `<span class="bt tag"># ${esc(b.tag)}</span>` : '');
}

function renderBirthdays() {
  renderAlerts();
  const sel = $('#bdayCat'), keep = sel.value;
  sel.innerHTML = catOptions(keep);
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

  $('#bdayList').innerHTML = list.length ? list.map(x => `
    <div class="bday-row"><span>🎂</span>
      <div class="info"><b>${esc(x.b.name)}</b><span class="muted small">${x.b.day} de ${MONTHS[x.b.month - 1]}${x.b.year ? ' de ' + x.b.year : ''} · ${x.left === 0 ? '¡hoy!' : 'faltan ' + x.left + ' d'}${x.turns ? ' · cumplirá ' + x.turns : ''}</span>
        ${x.b.category || x.b.tag ? `<div class="bday-tags">${bdayTags(x.b)}</div>` : ''}</div>
      <button class="icon-btn" data-action="edit-bday" data-id="${x.b.id}" aria-label="Editar cumpleaños" title="Editar">${ICON_EDIT}</button>
      <button class="icon-btn del" data-action="del-bday" data-id="${x.b.id}" aria-label="Eliminar cumpleaños" title="Eliminar">${ICON_X}</button>
    </div>`).join('') : `<p class="empty-note">${q || ui.bdayCat !== 'all' ? 'Sin coincidencias.' : 'Aún no hay cumpleaños guardados.'}</p>`;
}
