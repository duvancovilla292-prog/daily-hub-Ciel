/* ===== js/views/notes.js — Vista: notas y bloc rápido =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

function renderNotes() {
  const day = ui.notesMode === 'day';
  $('#modeDay').classList.toggle('on', day);
  $('#modeScratch').classList.toggle('on', !day);
  $('#dayEditor').hidden = !day;
  $('#scratchEditor').hidden = day;
  $('#noteScope').value = ui.noteScope;
  if (day) renderEditor();
  else { $('#scratchArea').value = state.scratchpad; updateScratchCount(); }
  updateStatus();
  renderNotesList();
}

function renderEditor() {
  const e = ui.editor;
  // Tarjeta: lectura de la nota guardada (o una indicación). El formulario vive en la ventana emergente.
  const saved = e.id && findNote(e.id);
  $('#editorTitle').textContent = saved ? 'Nota' : 'Notas';
  if (saved) renderNoteRead(editorFrom(saved[1], saved[0]));
  else $('#noteRead').innerHTML = '<p class="empty-note note-empty">Elige una nota de la lista para leerla, o crea una con «+ Nueva nota».</p>';
  $('#noteTitle').value = e.title;
  $('#noteDate').value = e.date;
  $$('#noteTypeSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === e.type));
  $('#noteArea').hidden = e.type !== 'text';
  $('#listEditor').hidden = e.type !== 'list';
  $('#noteArea').value = e.content;
  renderListEditor();
  fillLinkSelect($('#noteLink'), e.link);
  $('#notePerson').innerHTML = personOptions(e.person);
  $('#btnDelNote').hidden = !e.id;
  updateCount();
}

/* Vista de solo lectura de una nota guardada */
function renderNoteRead(e) {
  const lk = linkLabel(parseLink(e.link));
  const label = e.title || noteLabel({ title: '', type: e.type, content: e.content, items: e.items });
  const body = e.type === 'list'
    ? (e.items.length ? `<ul class="read-list">${e.items.map(i => `<li class="${i.done ? 'done' : ''}"><span class="mk">${i.done ? '✓' : '○'}</span><span>${esc(i.text)}</span></li>`).join('')}</ul>` : '<p class="empty-note">Lista vacía.</p>')
    : (e.content.trim() ? `<div class="read-text md">${md(e.content)}</div>` : '<p class="empty-note">Sin contenido.</p>');
  $('#noteRead').innerHTML = `
    <div class="read-top"><h3 class="read-title">${e.pinned ? '📌 ' : ''}${e.type === 'list' ? '☑' : '📝'} ${esc(label)}</h3>
      <button class="btn btn-ghost btn-xs" data-action="pin-note" aria-pressed="${e.pinned}">${e.pinned ? 'Quitar de fijadas' : '📌 Fijar arriba'}</button></div>
    <p class="muted small">${esc(cap(D.long(e.date)))}${lk ? ` · <span class="lk-mini">🔗 ${esc(lk)}</span>` : ''}${personName(e.person) ? ` · <button class="t-person" data-action="open-person" data-id="${esc(e.person)}">👤 ${esc(personName(e.person))}</button>` : ''}</p>
    ${body}
    <div class="editor-foot">
      <button class="btn btn-danger" data-action="del-note">Eliminar</button>
      <button class="btn btn-primary" data-action="edit-note">${ICON_EDIT} Editar</button>
    </div>`;
}

function renderListEditor() {
  $('#liRows').innerHTML = ui.editor.items.map((it, i) => `
    <div class="li"><label class="check"><input type="checkbox" data-change="li-done" data-i="${i}" ${it.done ? 'checked' : ''} aria-label="Hecho"><span class="box"></span></label>
    <input class="li-text" data-i="${i}" value="${esc(it.text)}" maxlength="120" placeholder="Ítem…">
    <button class="icon-btn mini" data-action="li-del" data-i="${i}" aria-label="Quitar ítem">${ICON_X}</button></div>`).join('');
}

function renderNotesList() {
  const q = ui.query;
  let entries = [];
  Object.entries(state.notes).forEach(([k, arr]) => arr.forEach(n => entries.push([k, n])));
  if (ui.noteScope === 'active') entries = entries.filter(([k]) => k === ui.active);
  entries = entries.filter(([k, n]) => hit(noteText(n), q) || hit(D.long(k), q) || hit(linkLabel(n.link), q) || hit(personName(n.person), q))
    .sort((a, b) => b[0].localeCompare(a[0]) || b[1].updatedAt.localeCompare(a[1].updatedAt));

  // Las fijadas van arriba, en su propio grupo
  entries = entries.filter(([, n]) => n.pinned).concat(entries.filter(([, n]) => !n.pinned));
  let html = '', last = '';
  entries.forEach(([k, n]) => {
    const g = n.pinned ? 'pinned' : k;
    if (g !== last) { html += n.pinned ? '<h4 class="ngroup">📌 Fijadas</h4>' : `<h4 class="ngroup">${esc(D.short(k))}${D.rel(k) ? ' · ' + D.rel(k) : ''}</h4>`; last = g; }
    const lk = linkLabel(n.link);
    const prev = n.type === 'list'
      ? `${n.items.filter(i => i.done).length}/${n.items.length} · ${n.items.slice(0, 3).map(i => i.text).join(', ')}`
      : n.content.trim().slice(0, 120);
    html += `<button class="note-item ${ui.notesMode === 'day' && ui.editor.id === n.id ? 'on' : ''}" data-action="open-note" data-key="${esc(k)}" data-id="${esc(n.id)}">
      <b>${n.pinned ? '📌 ' : ''}${n.type === 'list' ? '☑' : '📝'} ${esc(noteLabel(n))}</b>${n.pinned ? `<small class="muted">${esc(D.short(k))}</small>` : ''}${prev ? `<span>${esc(prev)}</span>` : ''}${lk ? `<em class="lk-mini">🔗 ${esc(lk)}</em>` : ''}${personName(n.person) ? `<em class="lk-mini">👤 ${esc(personName(n.person))}</em>` : ''}</button>`;
  });
  $('#notesList').innerHTML = html || `<p class="empty-note">${q ? 'Sin coincidencias.' : (ui.noteScope === 'active' ? 'No hay notas en la fecha activa.' : 'Aún no hay notas guardadas.')}</p>`;
}

function updateCount() {
  const e = ui.editor;
  const text = e.type === 'text' ? e.content : e.items.map(i => i.text).join(' ');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  $('#noteCount').textContent = e.type === 'text' ? `${plural(words, 'palabra', 'palabras')}` : `${plural(e.items.filter(i => i.text.trim()).length, 'ítem', 'ítems')} · ${e.items.filter(i => i.done && i.text.trim()).length} hechos`;
}
function updateScratchCount() {
  const v = $('#scratchArea').value, w = v.trim() ? v.trim().split(/\s+/).length : 0;
  $('#scratchCount').textContent = `${plural(w, 'palabra', 'palabras')} · ${v.length} caracteres`;
}

function updateStatus() {
  const el = $('#saveStatus');
  let label, warn;
  if (ui.notesMode === 'day') { warn = ui.editor.dirty; label = warn ? 'Sin guardar' : 'Guardada'; }
  else { warn = ui.scratchStatus === 'saving'; label = warn ? 'Guardando…' : 'Guardado'; }
  el.textContent = label;
  el.classList.toggle('saving', warn);
}
const markDirty = () => { ui.editor.dirty = true; updateStatus(); };

function saveNote() {
  const e = ui.editor, title = e.title.trim();
  let content = '', items = [];
  if (e.type === 'text') content = e.content;
  else items = e.items.filter(i => i.text.trim()).map(i => ({ id: i.id, text: i.text.trim(), done: i.done }));
  if (!title && !content.trim() && !items.length) return toast('La nota está vacía: escribe algo para guardarla', 'error');
  if (!D.isValidKey(e.date)) return toast('Elige una fecha válida', 'error');
  const note = { id: e.id || uid(), title, type: e.type, content, items, link: parseLink(e.link), updatedAt: new Date().toISOString(), pinned: !!e.pinned, person: state.birthdays.some(b => b.id === e.person) ? e.person : '' };
  Object.keys(state.notes).forEach(k => {                       // si cambió de fecha, la saca de la anterior
    state.notes[k] = state.notes[k].filter(n => n.id !== note.id);
    if (!state.notes[k].length) delete state.notes[k];
  });
  (state.notes[e.date] = state.notes[e.date] || []).push(note);
  commit();
  ui.editor = editorFrom(note, e.date);
  closeSheetNow();
  renderNotes();
  toast('Nota guardada', 'ok');
}

/* Bloc rápido: autoguardado con debounce de 400 ms */
let scratchTimer = null, pendingScratch = null;
function queueScratchSave(v) {
  pendingScratch = v; ui.scratchStatus = 'saving'; updateStatus();
  clearTimeout(scratchTimer); scratchTimer = setTimeout(flushScratch, 400);
}
function flushScratch() {
  clearTimeout(scratchTimer);
  if (pendingScratch === null) return;
  state.scratchpad = pendingScratch; pendingScratch = null;
  commit(); ui.scratchStatus = 'saved'; updateStatus();
}
