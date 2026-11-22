# Daily Hub

App web personal de productividad: **calendario, tareas, notas, cumpleaños y horarios** (diario, semanal y mensual).
HTML + CSS + JavaScript puro, sin dependencias. Todo se guarda en `localStorage` bajo la llave `daily_hub_v1`.

## Cómo usarla
Abre `index.html` en el navegador (no necesita servidor). Mantén las carpetas junto a él.

## Estructura
```
daily-hub/
├── index.html              Página única (SPA)
├── README.md
├── css/                    Estilos, uno por tema (fonts y responsive se cargan en orden, ver index.html)
│   ├── fonts.css           @font-face de Aetheri + clase .aetheri-on
│   ├── base.css            Variables de tema (oscuro/claro), reinicio, formularios, botones
│   ├── layout.css          Barra superior, pestañas, tarjetas
│   ├── calendar.css        Calendario del mes, detalle del día, vínculos, alertas
│   ├── tasks.css           Tareas
│   ├── notes.css           Notas y bloc rápido
│   ├── schedule.css        Horarios diario / semanal / mensual
│   ├── components.css      Modales, toasts
│   ├── admin.css           Panel de administrador y mini dashboard
│   └── responsive.css      Tablet y celular (se carga al final)
├── js/                     Scripts clásicos que comparten ámbito global; el orden de carga está en index.html
│   ├── core/
│   │   ├── utils.js            Constantes, helpers, fechas (D), hash del admin
│   │   ├── storage.js          Store: guardar, validar, migrar, fusionar (sin duplicados) y estadísticas
│   │   ├── state.js            Estado de los datos y de la interfaz
│   │   └── calendar-engine.js  Cuándo ocurre cada actividad, días del mes, vínculos
│   ├── ui/
│   │   ├── feedback.js         Toasts y modales
│   │   ├── header.js           Cabecera, panel de administrador, dashboard
│   │   ├── router.js           render() y navegación entre apartados
│   │   ├── actions.js          Clicks (data-action)
│   │   └── events.js           Cambios, escritura y formularios
│   ├── views/                  Una vista por apartado: calendar, birthdays, tasks, notes, schedule
│   └── main.js                 Arranque
├── fonts/
│   └── Prueva-Regular.ttf/.otf Tipografía Aetheri (la misma de MI-PORTAFOLIO)
└── data/
    └── datos-prueba.json       Datos de ejemplo para probar la carga
```

## Apartados
- **Calendario:** mes actual por defecto, con flechas para cambiar de mes. Filtros (todo / tareas / notas / cumpleaños / horarios), búsqueda y ventana de detalle al tocar un día.
- **Tareas:** con prioridad, filtros y vínculo opcional a una actividad de un horario.
- **Notas:** varias por día, de texto o lista, con botón *Guardar nota* y vínculo opcional al horario. Incluye el bloc rápido (autoguardado).
- **Cumpleaños:** alertas del día y de los próximos 7 días. Cada cumpleaños se puede editar (✏️), pide confirmación antes de eliminarse y puede tener una **categoría** (creada por el administrador, ej. Familia, Amigos) y una **etiqueta** libre opcional. Se filtran por categoría.
- **Horario:** diario, semanal o mensual, con fecha de inicio y fin. Las horas visibles van por defecto de 6:00 AM a 9:00 PM y se pueden cambiar al crear el horario o después (la tabla se amplía sola si una actividad queda fuera).

## Administrador
El botón **Admin** de la barra superior abre una ventana emergente, bloqueada hasta iniciar sesión (se cierra con ✕, Esc o tocando fuera). Ya desbloqueado:
- **Mini dashboard** con el conteo de tareas, notas, cumpleaños, horarios, actividades y vínculos.
- **Descargar respaldo** (`backup_YYYY-MM-DD.json`).
- **Cargar datos de prueba:** agrega los datos de `data/datos-prueba.json` (misma comparación que un respaldo).
- **Cargar respaldo:** compara con lo que ya existe y solo agrega lo nuevo. Nunca borra ni duplica; los vínculos se reajustan.
- **Vaciar todo** (pide escribir VACIAR para confirmar). Conserva las categorías de cumpleaños.
- **Categorías de cumpleaños:** crear, renombrar y eliminar (al eliminar una, sus cumpleaños quedan sin categoría). Se guardan en el JSON como `birthdayCategories`; cada cumpleaños guarda `category` (id) y `tag` (texto).

Las credenciales están en `js/core/utils.js` guardadas como hash. Al ser una app 100 % del lado del cliente, esto oculta funciones pero no es seguridad real.

## Tipografía Aetheri
El botón **Aa** activa/desactiva la fuente en toda la web (clase `aetheri-on` en `<html>`, preferencia guardada). La fuente solo cubre letras, tildes y ¡¿!?; números y demás símbolos usan la tipografía normal.

## Probar con datos de ejemplo
La app arranca **vacía**: nunca carga sola los datos del repositorio. Para probarla, entra como administrador → **Cargar datos de prueba** (lee `data/datos-prueba.json`). Si abres `index.html` directo desde la carpeta, el navegador no deja leer ese archivo: usa **Cargar respaldo** y elígelo a mano. Si lo cargas otra vez, avisa que no hay nada nuevo.
