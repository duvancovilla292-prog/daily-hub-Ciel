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

/* Categorías de fechas importantes (solo con sesión se crean, renombran o borran) */
function renderCats() {
  const cats = state.birthdayCategories;
  $('#catList').innerHTML = cats.length ? cats.map(c => {
    const n = state.birthdays.filter(b => b.category === c.id).length;
    return `<div class="cat-row"><span class="bt cat" style="--cc:${catColor(c.id)}">${c.pets ? '🐾 ' : ''}${esc(c.name)}</span><span class="muted small">${plural(n, 'fecha', 'fechas')}</span>
      <button class="icon-btn" data-action="cat-rename" data-id="${esc(c.id)}" aria-label="Renombrar ${esc(c.name)}" title="Renombrar">${ICON_EDIT}</button>
      <button class="icon-btn del" data-action="cat-del" data-id="${esc(c.id)}" aria-label="Eliminar ${esc(c.name)}" title="Eliminar">${ICON_X}</button></div>`;
  }).join('') : '<p class="empty-note">Aún no hay categorías.</p>';
}

/* ===== Panel: pestañas Resumen / Tareas / Notas / Fechas / Horarios / Nube =====
   Números en recuadros y gráficas de barras sencillas (un solo color por gráfica; cada barra muestra su valor
   y al pasar el dedo o el mouse dice qué es). */
const DASH_LABELS = { summary: 'Resumen', tasks: 'Tareas', notes: 'Notas', dates: 'Fechas', sched: 'Horarios', cloud: 'Nube' };
const dTile = (n, label, sub, cls = '') => `<div class="tile ${cls}"><b>${n}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
/** Barras horizontales: [{ label, value, color? }]. */
function dBars(title, rows, opts = {}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return `<div class="chart"><h4>${title}</h4><p class="empty-note">${opts.empty || 'Sin datos todavía.'}</p></div>`;
  return `<div class="chart"><h4>${title}</h4><div class="bars">${rows.map(r => `
    <div class="bar-row" title="${esc(r.label)}: ${r.value}${opts.unit ? ' ' + opts.unit : ''}">
      <span class="bl">${esc(r.label)}</span>
      <span class="track"><i style="width:${Math.max(r.value ? 3 : 0, Math.round(r.value / max * 100))}%;${r.color ? `background:${r.color}` : ''}"></i></span>
      <b>${r.value}</b></div>`).join('')}</div></div>`;
}
/** Columnas (ej. últimos 7 días): [{ label, value }]. */
function dCols(title, cols) {
  const max = Math.max(1, ...cols.map(c => c.value));
  return `<div class="chart"><h4>${title}</h4><div class="cols">${cols.map(c => `
    <div class="col" title="${esc(c.full || c.label)}: ${c.value}"><b>${c.value || ''}</b><span class="ctrack"><i style="height:${Math.max(c.value ? 6 : 0, Math.round(c.value / max * 100))}%"></i></span><small>${esc(c.label)}</small></div>`).join('')}</div></div>`;
}
const pctOf = (a, b) => b ? Math.round(a / b * 100) : 0;

function renderDash() {
  $$('#dashTabs button').forEach(b => { const on = b.dataset.v === ui.dashTab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.disabled = !ui.admin; });
  if (!ui.admin) { $('#adminDash').innerHTML = '<p class="muted small">Inicia sesión con Google para ver el resumen de tus datos.</p>'; return; }
  const st = Store.stats(state), today = D.todayKey(), kb = b => b < 1024 ? b + ' B' : (b / 1024).toFixed(1) + ' KB';
  const tasks = state.tasks, notes = Object.entries(state.notes).flatMap(([k, a]) => a.map(n => [k, n])), dates = state.birthdays, scheds = state.schedules;
  let h = '';

  if (ui.dashTab === 'tasks') {
    const done = tasks.filter(t => taskStatus(t) === 'done').length, soon = tasks.filter(dueSoon).length;
    const pend = tasks.filter(t => taskStatus(t) === 'pending');
    const last7 = Array.from({ length: 7 }, (_, i) => D.add(today, i - 6)).map(k => ({
      label: WD_SHORT[D.wd(D.parse(k))], full: D.long(k),
      value: tasks.filter(t => t.doneAt && D.key(new Date(t.doneAt)) === k).length + tasks.filter(t => t.mode === 'repeat' && t.doneDates.includes(k)).length
    }));
    const tagCount = {}; tasks.forEach(t => (t.tags || []).forEach(g => { tagCount[g] = (tagCount[g] || 0) + 1; }));
    const subs = tasks.flatMap(t => t.subtasks || []);
    h += `<div class="dash">${dTile(tasks.length, 'Tareas', `${st.pending} pendientes · ${done} hechas`)}${dTile(st.overdue, 'Atrasadas', st.overdue ? 'incluye repetidas no cumplidas' : 'todo al día', st.overdue ? 'warn' : '')}
      ${dTile(soon, 'Por vencer', 'alta prioridad, menos de 48 h', soon ? 'warn' : '')}${dTile(pctOf(done, tasks.length) + '%', 'Completadas', `${done} de ${tasks.length}`)}
      ${dTile(tasks.filter(t => t.time).length, 'Con hora', 'aparecen en la agenda de Hoy')}${dTile(subs.length ? `${subs.filter(x => x.done).length}/${subs.length}` : 0, 'Subtareas', 'hechas / total')}</div>
      ${dCols('Completadas en los últimos 7 días', last7)}
      ${dBars('Pendientes por prioridad', ['high', 'medium', 'low'].map(p => ({ label: PRIO[p].label, value: pend.filter(t => t.priority === p).length })))}
      ${dBars('Por tipo', Object.entries(TASK_MODES).map(([k, l]) => ({ label: l.replace(/ \(.*\)/, ''), value: tasks.filter(t => t.mode === k).length })))}
      ${dBars('Etiquetas más usadas', Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, n]) => ({ label: '#' + g, value: n })), { empty: 'Ninguna tarea tiene etiquetas.' })}
      ${dBars('Vínculos', [{ label: 'A una actividad del horario', value: tasks.filter(t => t.link).length }, { label: 'A personas o fechas', value: tasks.filter(t => (t.persons || []).length).length }, { label: 'A notas', value: tasks.filter(t => (t.notes || []).length).length }])}`;
  } else if (ui.dashTab === 'notes') {
    const words = notes.reduce((a, [, n]) => a + (n.type === 'text' ? (n.content.trim() ? n.content.trim().split(/\s+/).length : 0) : n.items.length), 0);
    const items = notes.flatMap(([, n]) => n.type === 'list' ? n.items : []);
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(D.parse(today).getFullYear(), D.parse(today).getMonth() - 5 + i, 1); return { key: D.key(d).slice(0, 7), label: MONTHS[d.getMonth()].slice(0, 3), full: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }; })
      .map(m => ({ ...m, value: notes.filter(([k]) => k.slice(0, 7) === m.key).length }));
    const lastEdit = notes.map(([, n]) => n.updatedAt).filter(Boolean).sort().pop();
    const linkedTasks = new Set(tasks.flatMap(t => t.notes || []));
    h += `<div class="dash">${dTile(notes.length, 'Notas', `${st.notes - st.lists} de texto · ${st.lists} listas`)}${dTile(notes.filter(([, n]) => n.pinned).length, 'Fijadas', 'arriba en la lista')}
      ${dTile(words, 'Palabras', 'en notas de texto (y líneas de listas)')}${dTile(items.length ? `${items.filter(i => i.done).length}/${items.length}` : 0, 'Ítems de listas', 'hechos / total')}
      ${dTile(state.scratchpad.trim() ? state.scratchpad.trim().split(/\s+/).length : 0, 'Bloc rápido', 'palabras')}${dTile(lastEdit ? new Date(lastEdit).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—', 'Última edición', '')}</div>
      ${dCols('Notas por mes', months)}
      ${dBars('Vínculos', [{ label: 'A una actividad del horario', value: notes.filter(([, n]) => n.link).length }, { label: 'A personas o fechas', value: notes.filter(([, n]) => (n.persons || []).length).length }, { label: 'Con tareas vinculadas', value: notes.filter(([, n]) => linkedTasks.has(n.id)).length }])}`;
  } else if (ui.dashTab === 'dates') {
    const nexts = dates.map(b => ({ b, ...nextBday(b) }));
    const in30 = nexts.filter(x => x.left <= 30).length, in7 = nexts.filter(x => x.left <= 7).length;
    const births = dates.filter(b => kindOf(b) === 'birthday');
    const gens = {}; births.filter(b => b.year && !isPet(b)).forEach(b => { const g = generation(b.year); gens[g] = (gens[g] || 0) + 1; });
    const signs = {}; births.forEach(b => { const z = zodiac(b.day, b.month); const k = `${z.sym} ${z.name}`; signs[k] = (signs[k] || 0) + 1; });
    const byMonth = MONTHS.map((m, i) => ({ label: m.slice(0, 3), full: m, value: dates.filter(b => repeatOf(b) === 'yearly' && b.month === i + 1).length }));
    h += `<div class="dash">${dTile(dates.length, 'Fechas', `${births.length} cumpleaños · ${plural(dates.length - births.length, 'otra', 'otras')}`)}${dTile(in7, 'Próximos 7 días', `${in30} en los próximos 30`)}
      ${dTile(dates.filter(b => b.remind).length, 'Con recordatorio', 'crean su tarea a tiempo')}${dTile(pctOf(births.filter(b => b.year).length, births.length) + '%', 'Con año', 'cumpleaños con año de nacimiento')}
      ${dTile(births.filter(b => b.relation).length, 'Con parentesco', '')}${dTile(st.cats, 'Categorías', '')}</div>
      ${dCols('Fechas por mes del año', byMonth)}
      ${dBars('Por categoría', state.birthdayCategories.map(c => ({ label: (c.pets ? '🐾 ' : '') + c.name, value: dates.filter(b => b.category === c.id).length, color: catColor(c.id) })).concat([{ label: 'Sin categoría', value: dates.filter(b => !b.category).length, color: 'var(--muted)' }]))}
      ${dBars('Generaciones', Object.entries(gens).sort((a, b) => b[1] - a[1]).map(([g, n]) => ({ label: g, value: n })), { empty: 'Agrega el año de nacimiento para verlas.' })}
      ${dBars('Signos', Object.entries(signs).sort((a, b) => b[1] - a[1]).map(([g, n]) => ({ label: g, value: n })))}`;
  } else if (ui.dashTab === 'sched') {
    const mon = D.monday(today), week = Array.from({ length: 7 }, (_, i) => D.add(mon, i));
    const mins = it => it.start && it.end && it.end > it.start ? toMin(it.end) - toMin(it.start) : 0;
    const perSched = scheds.map(s => ({ label: s.name, value: Math.round(week.reduce((a, k) => a + s.items.filter(it => occurs(s, it, k)).reduce((x, it) => x + mins(it), 0), 0) / 6) / 10, color: s.color }));
    const clashes = scheds.reduce((a, s) => a + s.items.filter(it => itemConflicts(s, it).length).length, 0);
    const perDay = week.map(k => ({ label: WD_SHORT[D.wd(D.parse(k))], full: D.long(k), value: Math.round(scheds.reduce((a, s) => a + s.items.filter(it => occurs(s, it, k)).reduce((x, it) => x + mins(it), 0), 0) / 6) / 10 }));
    h += `<div class="dash">${dTile(scheds.length, 'Horarios', `${plural(st.daily, 'diario', 'diarios')} · ${plural(st.weekly, 'semanal', 'semanales')} · ${plural(st.monthly, 'mensual', 'mensuales')}`)}${dTile(st.items, 'Actividades', 'en todos los horarios')}
      ${dTile(perSched.reduce((a, x) => a + x.value, 0).toFixed(1).replace('.0', '') + ' h', 'Esta semana', 'horas programadas')}${dTile(clashes, 'Choques', clashes ? 'actividades que se cruzan' : 'ninguna se cruza', clashes ? 'warn' : '')}
      ${dTile(scheds.filter(s => s.skipHolidays).length, 'Sin festivos', 'horarios que no aplican en festivos')}${dTile(scheds.reduce((a, s) => a + s.skipDates.length, 0), 'Días saltados', '')}</div>
      ${dCols('Horas programadas por día (esta semana)', perDay)}
      ${dBars('Horas por horario (esta semana)', perSched, { unit: 'h', empty: 'Aún no hay horarios.' })}`;
  } else if (ui.dashTab === 'cloud') {
    const c = window.Cloud && window.Cloud.info ? window.Cloud.info() : null;
    h += `<div class="dash">${dTile(c ? (c.status === 'ok' ? '✓' : c.status === 'offline' ? '…' : c.status === 'error' ? '!' : '—') : '—', 'Estado', c ? esc(c.label) : 'no disponible aquí', c && c.status === 'error' ? 'warn' : '')}
      ${dTile(c ? c.pending : 0, 'Cambios por subir', c && c.pending ? 'se suben al volver la conexión' : 'todo subido')}
      ${dTile(kb(st.bytes), 'Tamaño', 'de todos tus datos')}${dTile(esc(new Date(st.updated).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })), 'Último cambio', '')}</div>
      <p class="muted small">Cuenta: <b>${esc(ui.adminEmail)}</b>. Cada tarea, nota, fecha y horario es un documento propio en la nube; la apariencia (🎨) también se sincroniza; modo claro/oscuro, tipografía y filtros son de cada dispositivo.</p>`;
  } else if (ui.dashTab === 'look') {
    h += lookPanel();
  } else {
    const pct = st.tasks ? Math.round(st.done / st.tasks * 100) : 0;
    h += `<div class="dash">${dTile(st.tasks, 'Tareas', `${st.pending} pendientes · ${st.done} hechas${st.overdue ? ' · ' + st.overdue + ' atrasadas' : ''}`)}
      ${dTile(st.notes, 'Notas', `${st.notes - st.lists} de texto · ${st.lists} listas`)}
      ${dTile(st.birthdays, 'Fechas', plural(st.cats, 'categoría', 'categorías'))}
      ${dTile(st.schedules, 'Horarios', `${plural(st.daily, 'diario', 'diarios')} · ${plural(st.weekly, 'semanal', 'semanales')} · ${plural(st.monthly, 'mensual', 'mensuales')}`)}
      ${dTile(st.items, 'Actividades', 'en todos los horarios')}
      ${dTile(st.links, 'Vínculos', 'entre tareas, notas, personas y horarios')}
      <div class="tile wide"><div class="progress" aria-label="Tareas completadas"><i style="width:${pct}%"></i></div><small>${pct}% de las tareas completadas · datos: ${kb(st.bytes)} · modificado ${esc(new Date(st.updated).toLocaleString('es-CO'))}</small></div></div>
      <p class="muted small">Toca una pestaña para ver el detalle de cada sección.</p>`;
  }
  $('#adminDash').innerHTML = h;
}

/* ---------- Apariencia ---------- */
const LOOK_TXT = {
  style: { normal: ['✨ Normal', 'Degradados y brillo'], minimal: ['◻️ Minimalista', 'Plano, sin sombras ni degradados'], tierno: ['🌸 Tierno', 'Tonos pastel y bordes muy redondos'], oled: ['🌑 Noche profunda', 'Negro puro; ahorra batería en pantallas OLED'] },
  bg: { brillo: 'Brillo', liso: 'Liso', degradado: 'Degradado', puntos: 'Puntos', lineas: 'Líneas' },
  shape: { recto: 'Recto', normal: 'Normal', redondo: 'Redondo' },
  density: { compacto: 'Compacto', normal: 'Normal', amplio: 'Amplio' }
};
function lookPanel() {
  const l = normLook(state.settings.look), light = state.settings.theme === 'light';
  const btn = (k, v, inner, cls = '') => `<button class="look-opt ${cls}${l[k] === v ? ' on' : ''}" data-action="look-set" data-k="${k}" data-v="${v}" aria-pressed="${l[k] === v}">${inner}</button>`;
  const row = (title, k, body) => `<section class="look-row"><h4>${title}</h4><div class="look-opts look-${k}">${body}</div></section>`;
  return `<div class="look">
    ${row('Color principal', 'accent', LOOK_OPTS.accent.map(v => { const a = ACCENTS[v]; return btn('accent', v, `<i class="sw" style="background:linear-gradient(135deg,${light ? a[2] : a[0]},${light ? a[3] : a[1]})"></i><span>${a[4]}</span>`, 'swatch'); }).join(''))}
    ${row('Estilo', 'style', LOOK_OPTS.style.map(v => btn('style', v, `<b>${LOOK_TXT.style[v][0]}</b><small>${LOOK_TXT.style[v][1]}</small>`, 'wide-opt')).join(''))}
    ${row('Fondo', 'bg', LOOK_OPTS.bg.map(v => btn('bg', v, `<i class="bgp bgp-${v}"></i><span>${LOOK_TXT.bg[v]}</span>`)).join(''))}
    ${row('Forma de las tarjetas', 'shape', LOOK_OPTS.shape.map(v => btn('shape', v, `<i class="shp shp-${v}"></i><span>${LOOK_TXT.shape[v]}</span>`)).join(''))}
    ${row('Espacio', 'density', LOOK_OPTS.density.map(v => btn('density', v, `<i class="dns dns-${v}"><u></u><u></u><u></u></i><span>${LOOK_TXT.density[v]}</span>`)).join(''))}
    <div class="look-foot"><button class="btn btn-ghost" data-action="look-reset">↺ Restablecer</button>
    <p class="muted small">Los cambios se ven al instante y se guardan en tu cuenta: se aplican en todos tus dispositivos. El modo claro/oscuro (☀/🌙) sigue siendo de cada dispositivo.</p></div>
  </div>`;
}

function applyFont() { document.documentElement.classList.toggle('aetheri-on', state.settings.font === 'aetheri'); }
