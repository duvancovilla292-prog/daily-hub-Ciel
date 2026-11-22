/* ===== js/core/cloud.js — Sincronización con Firebase (Google + Firestore) =====
   Módulo: se carga después de los scripts clásicos y usa sus funciones globales (state, Store, replaceState, toast…).
   Cada usuario guarda sus datos en el documento users/{uid} de Firestore. Sin sesión la app funciona igual,
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
const LINK_KEY = 'daily_hub_cloud_uid';   // con qué cuenta ya se sincronizó este navegador
const LABEL = {
  loading: 'Conectando con la nube…', off: 'Sin iniciar sesión: los datos solo están en este navegador',
  syncing: 'Guardando en la nube…', ok: 'Sincronizado con la nube', offline: 'Sin conexión: se guardará al volver la red',
  error: 'Error de sincronización', unavailable: 'No se pudo cargar Firebase'
};

let A, F, auth, db, user = null, ref = null, unsub = null, timer = null, status = 'loading', lastSent = null;

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } };
const hasData = s => s.tasks.length || s.birthdays.length || s.schedules.length || Object.keys(s.notes).length || s.scratchpad.trim() || s.birthdayCategories.length;

function setStatus(s) {
  status = s === 'syncing' && !navigator.onLine ? 'offline' : s;
  const btn = document.getElementById('cloudBtn');
  if (!btn) return;
  btn.dataset.status = status;
  btn.title = LABEL[status];
  btn.setAttribute('aria-label', LABEL[status]);
}

function explain(e) {
  const c = e && e.code || '';
  if (c.includes('permission-denied')) return 'Firebase rechazó el acceso: revisa las reglas de Firestore.';
  if (c.includes('unauthorized-domain')) return 'Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).';
  if (c.includes('operation-not-allowed')) return 'Activa el inicio de sesión con Google en Firebase (Authentication → Método de acceso).';
  if (c.includes('network') || c.includes('unavailable')) return 'Sin conexión con Firebase. Se intentará de nuevo.';
  return 'Error de Firebase: ' + (c || (e && e.message) || 'desconocido');
}
function fail(e, quiet) {
  console.warn('[nube]', e);
  setStatus(e && String(e.code || '').includes('unavailable') ? 'offline' : 'error');
  if (!quiet) toast(explain(e), 'error');
}

/* --- Subir los datos (con espera de 800 ms para agrupar cambios seguidos) --- */
async function push() {
  clearTimeout(timer); timer = null;
  if (!ref) return;
  const data = JSON.stringify(state);
  if (data === lastSent) { setStatus('ok'); return; }
  lastSent = data;
  setStatus('syncing');
  try {
    await F.setDoc(ref, { data, updatedAt: state.meta.lastUpdated, v: 1 });
    if (lastSent === data) setStatus('ok');
  } catch (e) { lastSent = null; fail(e); }
}
hooks.onCommit = () => {
  if (!ref) return;
  setStatus('syncing');
  clearTimeout(timer);
  timer = setTimeout(push, 800);
};

/* --- Al iniciar o cerrar sesión --- */
async function onUser(u) {
  if (unsub) { unsub(); unsub = null; }
  clearTimeout(timer); timer = null;
  user = u; ref = null; lastSent = null;
  if (!u) { setStatus('off'); return; }
  setStatus('loading');
  const docRef = F.doc(db, 'users', u.uid);
  try {
    const snap = await F.getDoc(docRef);
    const cloudRaw = snap.exists() && typeof snap.data().data === 'string' ? snap.data().data : null;
    if (!cloudRaw) {
      ref = docRef;                                       // la nube está vacía: se suben los datos de este navegador
      await push();
    } else {
      const cloud = Store.normalize(JSON.parse(cloudRaw), false);
      const firstTime = lsGet(LINK_KEY) !== u.uid;
      if (firstTime && hasData(state)) {
        flushScratch();
        const choice = await modal({
          title: 'Datos en este dispositivo',
          body: 'Este navegador tiene datos guardados y tu cuenta también tiene datos en la nube.<br><br><b>Juntar ambos</b> agrega a la nube lo que falte (sin duplicar). <b>Usar los de la nube</b> descarta lo de este navegador.',
          actions: [{ label: 'Usar los de la nube', value: 'cloud' }, { label: 'Juntar ambos', value: 'merge', cls: 'btn-primary' }]
        });
        if (choice === 'cloud') replaceState(cloud);
        else {
          const { state: merged } = Store.merge(cloud, state);
          merged.settings = state.settings;
          replaceState(merged);
        }
        ref = docRef;
        lastSent = cloudRaw;
        await push();
      } else {
        ref = docRef;
        lastSent = cloudRaw;
        if (cloudRaw !== JSON.stringify(state)) replaceState(cloud);
        setStatus('ok');
      }
    }
    lsSet(LINK_KEY, u.uid);
    // Cambios hechos en otro dispositivo
    unsub = F.onSnapshot(docRef, s => {
      if (s.metadata.hasPendingWrites || !s.exists()) return;
      const raw = s.data().data;
      if (typeof raw !== 'string' || raw === lastSent || timer) return;   // es lo mismo que enviamos, o hay cambios locales por subir
      if (raw === JSON.stringify(state)) return;
      lastSent = raw;
      replaceState(Store.normalize(JSON.parse(raw), false));
      setStatus('ok');
    }, e => fail(e, true));
  } catch (e) { fail(e); }
}

async function signIn() {
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

/* --- Ventana de la nube (botón ☁ de la barra superior) --- */
async function openPanel() {
  if (status === 'unavailable') return toast('No se pudo cargar Firebase. Revisa tu conexión y recarga la página.', 'error');
  if (!auth) return toast('Conectando con la nube…');
  if (!user) {
    const go = await modal({
      title: 'Sincronizar con la nube',
      body: 'Inicia sesión con tu cuenta de Google para guardar tus datos en la nube y verlos en cualquier dispositivo.<br><br>Sin sesión, todo se guarda solo en este navegador.',
      actions: [{ label: 'Ahora no', value: false }, { label: 'Entrar con Google', value: true, cls: 'btn-primary' }]
    });
    if (go) signIn();
    return;
  }
  const v = await modal({
    title: 'Sincronización',
    body: `Sesión iniciada como <b>${esc(user.email || user.displayName || 'usuario')}</b>.<br>Estado: ${esc(LABEL[status])}.<br><br>Tus datos se guardan en la nube y en este navegador.`,
    actions: [{ label: 'Cerrar sesión', value: 'out', cls: 'btn-danger' }, { label: 'Sincronizar ahora', value: 'sync' }, { label: 'Listo', value: false, cls: 'btn-primary' }]
  });
  if (v === 'sync') { flushScratch(); lastSent = null; await push(); if (status === 'ok') toast('Sincronizado', 'ok'); }
  if (v === 'out') {
    flushScratch();
    if (timer) await push();
    await A.signOut(auth);
    toast('Sesión cerrada: los datos siguen en este navegador');
  }
}

window.Cloud = { open: openPanel };
window.addEventListener('online', () => { if (ref) { setStatus('syncing'); push(); } });
window.addEventListener('offline', () => { if (ref) setStatus('offline'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && timer) push(); });

setStatus('loading');
try {
  const [app, auth_, fs] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
  A = auth_; F = fs;
  const fbApp = app.initializeApp(firebaseConfig);
  auth = A.getAuth(fbApp);
  db = F.getFirestore(fbApp);
  A.getRedirectResult(auth).catch(e => fail(e));
  A.onAuthStateChanged(auth, onUser);
} catch (e) {
  console.warn('[nube] no se pudo cargar Firebase', e);
  setStatus('unavailable');
}
