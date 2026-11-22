/* ===== js/core/utils.js — Constantes, utilidades y fechas =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

const KEY = 'daily_hub_v1';
const TYPES = ['tasks', 'notes', 'birthdays', 'schedules'];
const TYPE_LABEL = { tasks: 'Tareas', notes: 'Notas', birthdays: 'Cumpleaños', schedules: 'Horarios' };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WD_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const WD_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const PRIO = { low: { label: 'Baja', rank: 0 }, medium: { label: 'Media', rank: 1 }, high: { label: 'Alta', rank: 2 } };
const SCHED_TYPES = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' };
const SCHED_COLORS = ['#38bdf8', '#a855f7', '#34d399', '#f59e0b', '#f472b6', '#f87171'];
const ICON_X = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

const ICON_EDIT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hit = (text, q) => !q || norm(text).includes(q);
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const clone = o => JSON.parse(JSON.stringify(o));

/* Acceso de administrador (solo del lado del cliente: oculta funciones, no es seguridad real) */
const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};
const ADMIN_HASH = 6433411787817184;
const checkAdmin = (user, pass) => cyrb53(user.trim().toLowerCase() + '|' + pass) === ADMIN_HASH;
const SESSION_KEY = 'daily_hub_admin_session';

/* Horas en formato 12 h (como en las plantillas) */
const fmtT = t => { if (!t) return ''; const h = +t.slice(0, 2); return `${(h % 12) || 12}:${t.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`; };
const hourLabel = h => `${(h % 12) || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
const timeLabel = it => it.start && it.end ? `${fmtT(it.start)} – ${fmtT(it.end)}` : it.start ? fmtT(it.start) : 'Todo el día';
const hourOf = t => +t.slice(0, 2);
const firstLine = t => (t.trim().split('\n')[0] || '').slice(0, 40);

const D = {
  pad: n => String(n).padStart(2, '0'),
  key: d => `${d.getFullYear()}-${D.pad(d.getMonth() + 1)}-${D.pad(d.getDate())}`,
  parse: k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); },
  today: () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); },
  todayKey: () => D.key(D.today()),
  add: (k, n) => { const d = D.parse(k); d.setDate(d.getDate() + n); return D.key(d); },
  addMonths: (k, n) => {
    const d = D.parse(k), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, D.daysIn(d.getFullYear(), d.getMonth() + 1)));
    return D.key(d);
  },
  isValidKey: k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && D.key(D.parse(k)) === k,
  daysIn: (y, m) => new Date(y, m, 0).getDate(),            // m: 1-12
  isLeap: y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0,
  wd: d => (d.getDay() + 6) % 7,                            // 0 = lunes … 6 = domingo
  monday: k => D.add(k, -D.wd(D.parse(k))),
  long: k => { const d = D.parse(k); return `${WD_LONG[D.wd(d)]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`; },
  short: k => { const d = D.parse(k); return `${WD_SHORT[D.wd(d)]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; },
  full: k => `${D.parse(k).getDate()} ${MONTHS[D.parse(k).getMonth()].slice(0, 3)} ${D.parse(k).getFullYear()}`,
  rel: k => {
    const diff = Math.round((D.parse(k) - D.today()) / 86400000);
    return diff === 0 ? 'Hoy' : diff === -1 ? 'Ayer' : diff === 1 ? 'Mañana' : '';
  }
};
