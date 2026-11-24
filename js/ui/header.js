/* ===== js/ui/header.js — Cabecera, panel de administrador y mini dashboard =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

function renderHeader() {
  $('#todayLabel').textContent = cap(D.long(ui.today));
  $('#datePicker').value = ui.active;
  $$('[data-action="date-rel"]').forEach(b => b.classList.toggle('on', D.add(ui.today, +b.dataset.offset) === ui.active));
  $('#searchClear').hidden = !ui.query;
  $('#iconSun').hidden = state.settings.theme === 'light';
  $('#iconMoon').hidden = state.settings.theme !== 'light';
  const pending = pendingCount();
  const badge = $('#badgeTasks');
  badge.hidden = !pending;
  badge.textContent = pending > 99 ? '99+' : pending;
  $('#taskDate').value = $('#taskDate').value || ui.active;
  const aet = state.settings.font === 'aetheri';
  $('#fontBtn').classList.toggle('on', aet);
  $('#fontBtn').setAttribute('aria-pressed', aet);
  renderAdmin();
}

/* Panel de administrador (ventana emergente): se abre con el botón Admin, bloqueado hasta iniciar sesión */
function renderAdmin() {
  $('#adminPanel').hidden = !ui.adminOpen;
  document.body.classList.toggle('no-scroll', ui.adminOpen);
  const btn = $('#adminBtn');
  btn.classList.toggle('unlocked', ui.admin);
  $('#adminLockIcon').hidden = ui.admin;
  $('#adminUnlockIcon').hidden = !ui.admin;
  $('#adminLoginBox').hidden = ui.admin;
  $('#adminSession').hidden = !ui.admin;
  $('#adminEmail').textContent = ui.adminEmail;
  $('#adminTools').classList.toggle('locked', !ui.admin);
  renderDash();
  renderCats();
  $$('#adminTools button, #adminTools input').forEach(b => { b.disabled = !ui.admin; });
}

/* Categorías de cumpleaños (solo el administrador las crea, renombra o borra) */
function renderCats() {
  const cats = state.birthdayCategories;
  $('#catList').innerHTML = cats.length ? cats.map(c => {
    const n = state.birthdays.filter(b => b.category === c.id).length;
    return `<div class="cat-row"><span class="bt cat" style="--cc:${catColor(c.id)}">${c.pets ? '🐾 ' : ''}${esc(c.name)}</span><span class="muted small">${plural(n, 'cumpleaños', 'cumpleaños')}</span>
      <button class="icon-btn" data-action="cat-rename" data-id="${esc(c.id)}" aria-label="Renombrar ${esc(c.name)}" title="Renombrar">${ICON_EDIT}</button>
      <button class="icon-btn del" data-action="cat-del" data-id="${esc(c.id)}" aria-label="Eliminar ${esc(c.name)}" title="Eliminar">${ICON_X}</button></div>`;
  }).join('') : '<p class="empty-note">Aún no hay categorías.</p>';
}

function renderDash() {
  const st = ui.admin ? Store.stats(state) : null;
  const v = x => ui.admin ? x : '—';
  const kb = b => b < 1024 ? b + ' B' : (b / 1024).toFixed(1) + ' KB';
  const tile = (n, label, sub) => `<div class="tile"><b>${n}</b><span>${label}</span><small>${sub}</small></div>`;
  const pct = st && st.tasks ? Math.round(st.done / st.tasks * 100) : 0;
  $('#adminDash').innerHTML =
    tile(v(st?.tasks), 'Tareas', ui.admin ? `${st.pending} pendientes · ${st.done} hechas${st.overdue ? ' · ' + st.overdue + ' atrasadas' : ''}` : 'bloqueado') +
    tile(v(st?.notes), 'Notas', ui.admin ? `${st.notes - st.lists} de texto · ${st.lists} listas` : 'bloqueado') +
    tile(v(st?.birthdays), 'Cumpleaños', ui.admin ? plural(st.cats, 'categoría', 'categorías') : 'bloqueado') +
    tile(v(st?.schedules), 'Horarios', ui.admin ? `${st.daily} diarios · ${st.weekly} semanales · ${st.monthly} mensuales` : 'bloqueado') +
    tile(v(st?.items), 'Actividades', ui.admin ? 'en todos los horarios' : 'bloqueado') +
    tile(v(st?.links), 'Vínculos', ui.admin ? 'tareas y notas con horario' : 'bloqueado') +
    (ui.admin ? `<div class="tile wide"><div class="progress" aria-label="Tareas completadas"><i style="width:${pct}%"></i></div><small>${pct}% de las tareas completadas · datos: ${kb(st.bytes)} · modificado ${esc(new Date(st.updated).toLocaleString('es-CO'))}</small></div>` : '');
}

function applyFont() { document.documentElement.classList.toggle('aetheri-on', state.settings.font === 'aetheri'); }
