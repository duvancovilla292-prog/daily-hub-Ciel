/* ===== js/views/birthdays.js — Vista: cumpleaños =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

function renderBirthdays() {
  renderAlerts();
  const q = ui.query, t = D.today();
  const list = state.birthdays.filter(b => hit(b.name, q)).map(b => {
    let next = new Date(t.getFullYear(), b.month - 1, Math.min(b.day, D.daysIn(t.getFullYear(), b.month)));
    if (next < t) next = new Date(t.getFullYear() + 1, b.month - 1, Math.min(b.day, D.daysIn(t.getFullYear() + 1, b.month)));
    return { b, left: Math.round((next - t) / 86400000), turns: b.year ? next.getFullYear() - b.year : null };
  }).sort((a, b) => a.left - b.left);

  $('#bdayList').innerHTML = list.length ? list.map(x => `
    <div class="bday-row"><span>🎂</span>
      <div class="info"><b>${esc(x.b.name)}</b><span class="muted small">${x.b.day} de ${MONTHS[x.b.month - 1]}${x.b.year ? ' de ' + x.b.year : ''} · ${x.left === 0 ? '¡hoy!' : 'faltan ' + x.left + ' d'}${x.turns ? ' · cumplirá ' + x.turns : ''}</span></div>
      <button class="icon-btn" data-action="del-bday" data-id="${x.b.id}" aria-label="Eliminar cumpleaños">${ICON_X}</button>
    </div>`).join('') : `<p class="empty-note">${q ? 'Sin coincidencias.' : 'Aún no hay cumpleaños guardados.'}</p>`;
}
