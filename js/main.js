/* ===== js/main.js — Inicio de la aplicación =====
   Script clásico: comparte el ámbito global con los demás archivos de /js (ver el orden en index.html). */
'use strict';

$('#schedColors').innerHTML = SCHED_COLORS.map((c, i) => `<label class="sw" style="--c:${c}"><input type="radio" name="color" value="${c}" ${i === 0 ? 'checked' : ''}><span></span></label>`).join('');
$('form[data-form=schedule] select[name=hstart]').innerHTML = hourOptions(6);
$('form[data-form=schedule] select[name=hend]').innerHTML = hourOptions(21);
syncSchedForm();
syncTaskForm($('form[data-form=task]'));
ensureGiftTasks();
applyTheme();
applyFont();
render();

const todays = Cal.birthdaysOn(ui.today);
if (todays.length) toast('🎉 Hoy: ' + todays.map(x => kindIcon(x.b) + ' ' + dateName(x.b)).join(', '), 'ok');
if (!Store.available) toast('El almacenamiento del navegador no está disponible: los datos no se conservarán al cerrar.', 'error');
