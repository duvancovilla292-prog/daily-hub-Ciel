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

/* El panel de administración se desbloquea con la sesión de Google (ver js/core/cloud.js).
   Cada cuenta solo puede leer y cambiar sus propios datos: lo garantizan las reglas de Firestore. */

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

/* ===== Festivos de Colombia =====
   Fijos, los de la Ley Emiliani (se pasan al lunes siguiente) y los que dependen de la Semana Santa. */
function easterOf(y) {                                       // algoritmo gregoriano anónimo (Meeus/Jones/Butcher)
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
const _holidays = {};
function holidaysOf(y) {
  if (_holidays[y]) return _holidays[y];
  const out = {}, put = (d, name) => { out[D.key(d)] = name; };
  const nextMonday = d => { d.setDate(d.getDate() + (8 - d.getDay()) % 7); return d; };
  [[1, 1, 'Año Nuevo'], [5, 1, 'Día del Trabajo'], [7, 20, 'Día de la Independencia'], [8, 7, 'Batalla de Boyacá'], [12, 8, 'Inmaculada Concepción'], [12, 25, 'Navidad']]
    .forEach(([m, d, n]) => put(new Date(y, m - 1, d), n));
  [[1, 6, 'Reyes Magos'], [3, 19, 'San José'], [6, 29, 'San Pedro y San Pablo'], [8, 15, 'Asunción de la Virgen'], [10, 12, 'Día de la Raza'], [11, 1, 'Todos los Santos'], [11, 11, 'Independencia de Cartagena']]
    .forEach(([m, d, n]) => put(nextMonday(new Date(y, m - 1, d)), n));
  const easter = easterOf(y), plus = n => { const d = new Date(easter); d.setDate(d.getDate() + n); return d; };
  put(plus(-3), 'Jueves Santo'); put(plus(-2), 'Viernes Santo');
  put(plus(43), 'Ascensión del Señor'); put(plus(64), 'Corpus Christi'); put(plus(71), 'Sagrado Corazón');
  return (_holidays[y] = out);
}
const holidayName = key => holidaysOf(+key.slice(0, 4))[key] || '';

/* ===== Markdown sencillo (para leer notas) =====
   Primero se escapa todo el texto; luego se aplican solo estas marcas:
   # títulos · **negrita** · *cursiva* · ~~tachado~~ · `código` · - listas · 1. listas · - [ ] / - [x] · > cita · [texto](https://enlace) */
function md(src) {
  const inline = t => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  let html = '', list = null, para = [];
  const endPara = () => { if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = []; } };
  const endList = () => { if (list) { html += `</${list}>`; list = null; } };
  const openList = tag => { endPara(); if (list !== tag) { endList(); html += `<${tag}>`; list = tag; } };
  String(src).replace(/\r/g, '').split('\n').forEach(ln => {
    let m;
    if ((m = ln.match(/^(#{1,3})\s+(.*)$/))) { endPara(); endList(); const h = m[1].length + 2; html += `<h${h}>${inline(m[2])}</h${h}>`; }
    else if ((m = ln.match(/^\s*[-*]\s+(.*)$/))) {
      openList('ul');
      const c = m[1].match(/^\[( |x|X)\]\s*(.*)$/);
      html += c ? `<li class="md-check">${c[1] === ' ' ? '☐' : '☑'} ${inline(c[2])}</li>` : `<li>${inline(m[1])}</li>`;
    }
    else if ((m = ln.match(/^\s*\d+[.)]\s+(.*)$/))) { openList('ol'); html += `<li>${inline(m[1])}</li>`; }
    else if ((m = ln.match(/^>\s?(.*)$/))) { endPara(); endList(); html += `<blockquote>${inline(m[1])}</blockquote>`; }
    else if (!ln.trim()) { endPara(); endList(); }
    else { endList(); para.push(ln); }
  });
  endPara(); endList();
  return html;
}

/** Etiquetas escritas a mano ("casa, #campus") → lista limpia sin repetidas. */
function parseTags(v) {
  const out = [], seen = new Set();
  (Array.isArray(v) ? v : String(v || '').split(/[,#\n]/)).forEach(x => {
    const t = String(x).replace(/^#+/, '').trim().slice(0, 20);
    if (t && !seen.has(norm(t)) && out.length < 8) { seen.add(norm(t)); out.push(t); }
  });
  return out;
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ===== Nombres para mostrar =====
   Mayúscula inicial en cada palabra (sin tocar lo guardado ni el resto de la palabra: "GB" sigue igual),
   salvo partículas como "de", "del", "y" en medio del nombre. */
const NAME_SMALL = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'van', 'von']);
function displayName(s) {
  let first = true;
  return String(s).split(/(\s+)/).map(w => {
    if (!w.trim()) return w;
    const m = w.match(/^([^\p{L}]*)(\p{L})(.*)$/u);
    if (!m) return w;
    const small = !first && NAME_SMALL.has(w.toLowerCase());
    first = false;
    return small ? w.toLowerCase() : m[1] + m[2].toLocaleUpperCase('es') + m[3];
  }).join('');
}
/** Iniciales (máximo 2) de las palabras importantes del nombre. */
function initials(s) {
  const words = String(s).replace(/\(.*?\)/g, ' ').split(/\s+/).map(w => w.replace(/[^\p{L}]/gu, '')).filter(w => w && !NAME_SMALL.has(w.toLowerCase()));
  return ((words[0] || '?')[0] + (words[1] ? words[1][0] : '')).toLocaleUpperCase('es');
}
