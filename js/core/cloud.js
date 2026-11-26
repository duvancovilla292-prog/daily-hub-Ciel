/* ===== js/core/cloud.js — Sincronización con Firebase (Google + Firestore) =====
   Módulo: se carga después de los scripts clásicos y usa sus funciones globales (state, Store, replaceState, toast…).

   Cómo se guarda: cada elemento es un documento propio en users/{uid}/items/{id}
     t_<id> tarea · n_<id> nota (con su fecha) · b_<id> cumpleaños · c_<id> categoría · s_<id> horario · x_scratch bloc rápido · x_look apariencia
   y cada documento lleva { data (JSON), updatedAt (ms), deleted }. Borrar deja una marca (deleted: true) para que
   los demás dispositivos también lo borren. Si dos dispositivos cambian el mismo elemento, gana el cambio más reciente;
   si cambian elementos distintos, se conservan los dos.

   Cambios sin conexión: cada cambio local queda como "pendiente" (guardado en el navegador) hasta que la nube lo confirma,
   así que no se pierde al recargar ni lo pisa lo que llegue de la nube si es más viejo.

   Cuentas: los datos del navegador pertenecen a la cuenta con la que se sincronizaron. Al cerrar sesión se vacía el
   navegador; si al entrar hay datos de invitado, se pregunta antes de subirlos. Sin sesión la app funciona igual,
   solo con el almacenamiento del navegador. */

const SDK = 'https://www.gstatic.com/firebasejs/13.4.0/';
const firebaseConfig = {
  apiKey: 'AIzaSyBgTUT6vUQuzkBrx0Z3D7DAEcqgbri5cmI',
  authDomain: 'daily-hud-951b1.firebaseapp.com',
  projectId: 'daily-hud-951b1',
  storageBucket: 'daily-hud-951b1.firebasestorage.app',
  messagingSenderId: '369901038763',
  appId: '1:369901038763:web:f2d3d67e3ed877071edbee'
};
const REC_KEY = 'daily_hub_sync';            // { uid, pending: {id: ms}, known: {id: ms}, confirmed, mergeLocal }
const OLD_LINK_KEY = 'daily_hub_cloud_uid';  // versión anterior (un solo documento por cuenta)
const DOC_RE = /^(?:[tnbcs]_[\w-]{1,64}|x_scratch|x_msg|x_look)$/;
const LABEL = {
  loading: 'Conectando con la nube…', off: 'Sin iniciar sesión: los datos solo están en este navegador',
  syncing: 'Guardando en la nube…', ok: 'Sincronizado con la nube', offline: 'Sin conexión: los cambios se subirán al volver la red',
  error: 'Error de sincronización', unavailable: 'No se pudo cargar Firebase'
};

let A, F, auth, db, user = null, unsub = null, timer = null, status = 'loading', flushing = false, markLegacy = '';

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* nada */ } };
const emptyRec = uid => ({ uid: uid || '', pending: {}, known: {}, confirmed: false, mergeLocal: false });
function loadRec() {
  try {
    const r = JSON.parse(lsGet(REC_KEY) || 'null');
    if (r && typeof r.uid === 'string') return { uid: r.uid, pending: r.pending || {}, known: r.known || {}, confirmed: !!r.confirmed, mergeLocal: !!r.mergeLocal };
  } catch (e) { /* registro dañado */ }
  return emptyRec();
}
let rec = loadRec();
const saveRec = () => lsSet(REC_KEY, JSON.stringify(rec));
const pendingN = () => Object.keys(rec.pending).length;
const hasData = s => s.tasks.length || s.birthdays.length || s.schedules.length || Object.keys(s.notes).length || s.scratchpad.trim() || s.birthdayCategories.length;

/* ---------- Estado ⇄ elementos ---------- */
function elementsJson(s) {
  const m = new Map();
  s.tasks.forEach(t => m.set('t_' + t.id, JSON.stringify(t)));
  Object.entries(s.notes).forEach(([date, arr]) => arr.forEach(n => m.set('n_' + n.id, JSON.stringify({ ...n, date }))));
  s.birthdays.forEach(b => m.set('b_' + b.id, JSON.stringify(b)));
  s.birthdayCategories.forEach(c => m.set('c_' + c.id, JSON.stringify(c)));
  s.schedules.forEach(x => m.set('s_' + x.id, JSON.stringify(x)));
  m.set('x_scratch', JSON.stringify({ text: s.scratchpad }));
  m.set('x_msg', JSON.stringify({ text: s.msgTemplate || '' }));
  m.set('x_look', JSON.stringify(normLook(s.settings && s.settings.look)));
  return m;
}
/** Arma el estado a partir de los elementos, conservando el orden que ya tenían. */
function stateFromElements(map, base) {
  const raw = { meta: base.meta, tasks: [], notes: {}, birthdays: [], birthdayCategories: [], schedules: [], scratchpad: '', msgTemplate: base.msgTemplate || '', settings: { ...base.settings } };
  const order = [...elementsJson(base).keys()];
  const ids = order.filter(id => map.has(id)).concat([...map.keys()].filter(id => !order.includes(id)));
  ids.forEach(id => {
    let v; try { v = JSON.parse(map.get(id)); } catch (e) { return; }
    if (!v || typeof v !== 'object') return;
    const p = id.slice(0, 2);
    if (p === 't_') raw.tasks.push(v);
    else if (p === 'n_') { const { date, ...n } = v; if (D.isValidKey(date)) (raw.notes[date] = raw.notes[date] || []).push(n); }
    else if (p === 'b_') raw.birthdays.push(v);
    else if (p === 'c_') raw.birthdayCategories.push(v);
    else if (p === 's_') raw.schedules.push(v);
    else if (id === 'x_scratch') raw.scratchpad = typeof v.text === 'string' ? v.text : '';
    else if (id === 'x_msg') raw.msgTemplate = typeof v.text === 'string' ? v.text : '';
    else if (id === 'x_look') raw.settings.look = v;            // la apariencia viaja con la cuenta
  });
  return Store.normalize(raw, false, { keepLinks: true });
}

/* ---------- Cambios locales → pendientes ---------- */
let last = elementsJson(state);              // lo último registrado, para detectar qué cambió
function track() {
  const now = elementsJson(state), t = Date.now();
  now.forEach((j, id) => { if (last.get(id) !== j) rec.pending[id] = t; });
  last.forEach((j, id) => { if (!now.has(id)) rec.pending[id] = t; });   // borrado → marca de borrado
  last = now;
  saveRec();
}
hooks.onCommit = () => {
  if (!rec.uid) { last = elementsJson(state); return; }      // invitado: no se sincroniza
  track();
  if (user && user.uid === rec.uid) { setStatus('syncing'); clearTimeout(timer); timer = setTimeout(flush, 800); }
  else setStatus(user ? status : 'offline');
};

function setStatus(s) {
  status = (s === 'syncing' || s === 'ok') && !navigator.onLine && pendingN() ? 'offline' : s;
  const btn = document.getElementById('cloudBtn');
  if (!btn) return;
  btn.dataset.status = status;
  btn.title = LABEL[status];
  btn.setAttribute('aria-label', LABEL[status]);
}
function explain(e) {
  const c = (e && e.code) || '';
  if (c.includes('permission-denied')) return 'Firebase rechazó el acceso: actualiza las reglas de Firestore (ver README). Tus datos siguen en este navegador.';
  if (c.includes('unauthorized-domain')) return 'Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).';
  if (c.includes('operation-not-allowed') || c.includes('configuration-not-found')) return 'Activa el inicio de sesión con Google en Firebase (Authentication → Método de acceso).';
  if (c.includes('network') || c.includes('unavailable')) return 'Sin conexión con Firebase. Se intentará de nuevo.';
  return 'Error de Firebase: ' + (c || (e && e.message) || 'desconocido');
}
let lastErr = { msg: '', at: 0 };
function fail(e, quiet) {
  console.warn('[nube]', e);
  const off = String((e && e.code) || '').match(/unavailable|network/);
  setStatus(off ? 'offline' : 'error');
  const msg = explain(e);
  if (!quiet && !off && (msg !== lastErr.msg || Date.now() - lastErr.at > 30000)) { lastErr = { msg, at: Date.now() }; toast(msg, 'error'); }
}

/* ---------- Subir pendientes (en lotes) ---------- */
async function flush() {
  clearTimeout(timer); timer = null;
  if (!user || !rec.uid || user.uid !== rec.uid || !rec.confirmed || flushing) return;
  const ids = Object.keys(rec.pending);
  if (!ids.length) { setStatus('ok'); return; }
  flushing = true;
  setStatus('syncing');
  const cur = elementsJson(state);
  try {
    for (let i = 0; i < ids.length; i += 400) {
      const part = ids.slice(i, i + 400), stamp = {};
      const batch = F.writeBatch(db);
      part.forEach(id => {
        const ms = rec.pending[id], j = cur.get(id);
        stamp[id] = ms;
        batch.set(F.doc(db, 'users', rec.uid, 'items', id), j !== undefined ? { data: j, updatedAt: ms, deleted: false } : { data: '', updatedAt: ms, deleted: true });
      });
      await batch.commit();
      part.forEach(id => { if (rec.pending[id] === stamp[id]) { delete rec.pending[id]; rec.known[id] = stamp[id]; } });
      saveRec();
    }
    setStatus(pendingN() ? 'syncing' : 'ok');
    if (!pendingN() && markLegacy === rec.uid) {               // ya está todo arriba: el documento antiguo queda como migrado
      markLegacy = '';
      F.setDoc(F.doc(db, 'users', rec.uid), { migrated: true }, { merge: true }).catch(e => fail(e, true));
    }
  } catch (e) { fail(e); }
  flushing = false;
  if (pendingN() && status === 'syncing') timer = setTimeout(flush, 1000);   // hubo cambios mientras se subía
}

/* ---------- Cambios de la nube → estado ---------- */
function applyRemote(changes) {
  let map = null;
  changes.forEach(ch => {
    if (ch.type === 'removed') return;
    const id = ch.doc.id, d = ch.doc.data() || {}, ms = Number(d.updatedAt) || 0;
    if (!DOC_RE.test(id) || (rec.known[id] || 0) >= ms) return;   // ya aplicado (o es nuestro propio cambio)
    rec.known[id] = ms;
    if (rec.pending[id] && rec.pending[id] >= ms) return;          // lo local es más nuevo: se subirá
    delete rec.pending[id];
    if (!map) map = elementsJson(state);
    if (d.deleted) map.delete(id);
    else if (typeof d.data === 'string') map.set(id, d.data);
  });
  saveRec();
  if (!map) return false;
  replaceState(stateFromElements(map, state));
  last = elementsJson(state);
  return true;
}

/** Agrega (sin duplicar) otro conjunto de datos al de esta cuenta. */
function mergeIn(other) {
  const { state: merged } = Store.merge(state, other);
  merged.settings = state.settings;
  replaceState(merged);
}
/** Deja el navegador sin datos (conserva tema, tipografía y filtros). */
function resetLocal() {
  clearTimeout(scratchTimer); pendingScratch = null;
  ui.editor = newEditor(ui.active); ui.anchors = {}; ui.openForms.clear(); ui.sheet = false;
  const empty = defaultState();
  empty.settings = state.settings;
  replaceState(empty);
  last = elementsJson(state);
}

/* ---------- Iniciar y cerrar sesión ---------- */
/** Datos de la versión anterior (todo en un solo documento users/{uid}), si aún no se migraron. */
async function readLegacy(uid) {
  try {
    const old = await F.getDoc(F.doc(db, 'users', uid));
    const d = old.exists() ? old.data() : null;
    if (d && typeof d.data === 'string' && !d.migrated) return Store.normalize(JSON.parse(d.data), false);
  } catch (e) { fail(e, true); }
  return null;
}

async function onUser(u) {
  if (unsub) { unsub(); unsub = null; }
  clearTimeout(timer); timer = null;
  user = u;
  ui.admin = !!u;
  ui.adminEmail = u ? (u.email || u.displayName || '') : '';
  renderHeader();
  if (!u) { setStatus('off'); return; }
  setStatus('loading');
  const who = esc(ui.adminEmail || 'tu cuenta');

  if (rec.uid && rec.uid !== u.uid) {
    // El navegador tiene datos de OTRA cuenta: no se mezclan
    if (hasData(state) && (pendingN() || !rec.confirmed)) {
      const v = await modal({
        title: 'Datos de otra cuenta',
        body: `Este navegador tiene datos de otra cuenta que no se alcanzaron a confirmar en la nube. Al entrar con ${who} se quitarán de este navegador. ¿Quieres descargar un respaldo antes?`,
        actions: [{ label: 'No, continuar', value: false }, { label: 'Descargar respaldo', value: true, cls: 'btn-primary' }]
      });
      if (v) downloadBackup();
    }
    resetLocal();
    rec = emptyRec(u.uid);
  } else if (!rec.uid) {
    let merge = false;
    if (hasData(state)) {
      if (lsGet(OLD_LINK_KEY) === u.uid) merge = true;          // misma cuenta, versión anterior: se conservan
      else {
        flushScratch();
        const v = await modal({
          title: 'Datos de este navegador',
          body: `Este navegador tiene datos guardados sin cuenta. ¿Quieres agregarlos a ${who}?<br><br>Si eliges <b>No</b>, se quitan de este navegador y tu cuenta no se toca.`,
          actions: [{ label: 'No, quitarlos', value: 'drop' }, { label: 'Agregar a mi cuenta', value: 'add', cls: 'btn-primary' }]
        });
        if (v === 'drop') resetLocal(); else merge = true;
      }
    }
    rec = emptyRec(u.uid);
    rec.mergeLocal = merge;                                     // se juntan cuando la nube responda (los datos siguen a la vista)
  }
  lsDel(OLD_LINK_KEY);
  saveRec();

  const uid = u.uid;
  const legacy = await readLegacy(uid);
  if (!user || user.uid !== uid) return;
  let first = true;
  unsub = F.onSnapshot(F.collection(db, 'users', uid, 'items'), snap => {
    if (!user || user.uid !== uid) return;
    if (!first) { applyRemote(snap.docChanges()); return; }
    first = false;
    // Primera respuesta de la nube: recién aquí se decide qué se junta con qué
    if (rec.mergeLocal) {
      flushScratch();
      const local = clone(state);
      const empty = defaultState();
      empty.settings = state.settings;
      replaceState(empty);
      applyRemote(snap.docChanges());                           // lo que ya hay en la nube
      last = elementsJson(state);
      if (legacy) mergeIn(legacy);                              // + versión anterior
      mergeIn(local);                                           // + lo del navegador (sin duplicar)
      rec.mergeLocal = false;
    } else {
      applyRemote(snap.docChanges());
      if (legacy) mergeIn(legacy);
    }
    if (legacy) markLegacy = uid;
    ensureGiftTasks();
    track();
    rec.confirmed = true;
    saveRec();
    flush();
    if (!pendingN()) setStatus('ok');
  }, e => fail(e));
}

async function signIn() {
  if (!auth) return toast(status === 'unavailable' ? 'No se pudo cargar Firebase. Revisa tu conexión y recarga la página.' : 'Conectando con la nube…', status === 'unavailable' ? 'error' : 'info');
  const provider = new A.GoogleAuthProvider();
  try { await A.signInWithPopup(auth, provider); }
  catch (e) {
    const c = e.code || '';
    if (c.includes('popup-closed') || c.includes('cancelled-popup')) return;
    if (c.includes('popup-blocked') || c.includes('operation-not-supported')) {
      try { await A.signInWithRedirect(auth, provider); } catch (e2) { fail(e2); }
      return;
    }
    fail(e);
  }
}

async function signOut() {
  flushScratch();
  await flush();
  let keep = false;
  if (hasData(state) && (!rec.confirmed || pendingN())) {
    const why = rec.confirmed
      ? `Hay ${plural(pendingN(), 'cambio que todavía no se ha', 'cambios que todavía no se han')} subido a la nube (¿sin conexión?).`
      : 'Todavía no se pudo confirmar que tus datos estén guardados en la nube (revisa tu conexión o las reglas de Firestore).';
    const v = await modal({
      title: 'Datos sin confirmar en la nube',
      body: `${why}<br><br>Para no perderlos, déjalos en este navegador: al volver a entrar se te preguntará si quieres agregarlos a tu cuenta.`,
      actions: [{ label: 'Cancelar', value: false }, { label: 'Quitarlos igual', value: 'drop', cls: 'btn-danger' }, { label: 'Dejarlos en este navegador', value: 'keep', cls: 'btn-primary' }]
    });
    if (!v) return;
    keep = v === 'keep';
  }
  if (unsub) { unsub(); unsub = null; }
  rec = emptyRec(); saveRec();
  await A.signOut(auth);
  if (!keep) resetLocal();
  toast(keep ? 'Sesión cerrada. Los datos quedaron en este navegador.' : 'Sesión cerrada. Tus datos siguen en tu cuenta; este navegador quedó vacío.');
}

/* ---------- Ventana de la nube (botón ☁) ---------- */
async function openPanel() {
  if (!user) {
    if (status === 'unavailable') return toast('No se pudo cargar Firebase. Revisa tu conexión y recarga la página.', 'error');
    const go = await modal({
      title: 'Sincronizar con la nube',
      body: 'Inicia sesión con tu cuenta de Google para guardar tus datos en la nube, verlos en cualquier dispositivo y usar el panel de administración.<br><br>Sin sesión, todo se guarda solo en este navegador.',
      actions: [{ label: 'Ahora no', value: false }, { label: 'Entrar con Google', value: true, cls: 'btn-primary' }]
    });
    if (go) signIn();
    return;
  }
  const n = pendingN();
  const v = await modal({
    title: 'Sincronización',
    body: `Sesión iniciada como <b>${esc(user.email || user.displayName || 'usuario')}</b>.<br>Estado: ${esc(LABEL[status])}.${n ? `<br>${plural(n, 'cambio pendiente', 'cambios pendientes')} de subir.` : ''}<br><br>Tus datos se guardan en tu cuenta y en este navegador. Al cerrar sesión, este navegador se vacía.`,
    actions: [{ label: 'Cerrar sesión', value: 'out', cls: 'btn-danger' }, { label: 'Sincronizar ahora', value: 'sync' }, { label: 'Listo', value: false, cls: 'btn-primary' }]
  });
  if (v === 'sync') { flushScratch(); await flush(); if (status === 'ok') toast('Sincronizado', 'ok'); }
  if (v === 'out') signOut();
}

window.Cloud = { open: openPanel, signIn, info: () => ({ status, label: LABEL[status], pending: pendingN(), email: user ? user.email || '' : '', confirmed: rec.confirmed }) };
window.addEventListener('online', () => { if (user) { setStatus('syncing'); flush(); } });
window.addEventListener('offline', () => { if (user && pendingN()) setStatus('offline'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && timer) flush(); });

setStatus('loading');
try {
  const [app, auth_, fs] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
  A = auth_; F = fs;
  const fbApp = app.initializeApp(firebaseConfig);
  auth = A.getAuth(fbApp);
  db = F.getFirestore(fbApp);
  A.getRedirectResult(auth).catch(e => fail(e));
  A.onAuthStateChanged(auth, u => { onUser(u).catch(e => fail(e)); });
} catch (e) {
  console.warn('[nube] no se pudo cargar Firebase', e);
  setStatus('unavailable');
}
