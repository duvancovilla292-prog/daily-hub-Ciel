# Daily Hub

App web personal de productividad: **calendario, tareas, notas, cumpleaños y horarios** (diario, semanal y mensual).
HTML + CSS + JavaScript puro, sin dependencias. Todo se guarda en `localStorage` bajo la llave `daily_hub_v1`.

## Cómo usarla
Abre `index.html` en el navegador (no necesita servidor). Mantén las carpetas junto a él.

## Sincronización con la nube (Firebase)
El botón ☁ de la barra superior permite entrar con Google. Con sesión iniciada, los datos se guardan en Firestore (documento `users/{uid}`) y en el navegador, y los cambios se sincronizan solos entre dispositivos. Sin sesión, o sin conexión, la app funciona igual con el almacenamiento del navegador. El punto del botón indica el estado: verde sincronizado, azul guardando, amarillo sin conexión, rojo error.

La configuración está en `js/core/cloud.js`. En la consola de Firebase hace falta:
1. **Authentication → Método de acceso:** activar **Google**.
2. **Authentication → Configuración → Dominios autorizados:** agregar `duvancovilla292-prog.github.io`.
3. **Firestore Database:** crear la base de datos y poner estas reglas (cada usuario solo puede leer y escribir lo suyo):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## Deshacer
Al eliminar algo (tarea, nota, cumpleaños, actividad, horario, categoría o *Vaciar todo*) aparece un aviso con **Deshacer** durante unos segundos.

## Publicar cambios
`index.html` carga cada CSS/JS con `?v=…`. Al subir cambios, cambia ese número en **todos** los archivos para que el navegador descargue las versiones nuevas y no mezcle archivos viejos con nuevos.

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
- **Tareas:** con prioridad, filtros y vínculo opcional a una actividad de un horario. Se editan solo con el botón ✏️. Hay tres tipos:
  - **Un solo día.**
  - **Con fecha límite:** abarca del día de inicio a la fecha límite y se marca hecha una sola vez (en el calendario se marca en su inicio y en su vencimiento).
  - **Se repite con la actividad vinculada:** aparece cada día que ocurre esa actividad (desde su fecha hasta la fecha "hasta" o el final del horario) y se marca hecha **cada día por separado**. Al terminar su periodo queda *hecha* si se hizo al menos un día, o *no cumplida* si no. En la pestaña Tareas sale en la fecha activa, y todas se gestionan en el grupo **Se repiten**.
- **Notas:** se abren en modo lectura y solo se modifican con **Editar** (con **Cancelar** para descartar). Varias por día, de texto o lista, con botón *Guardar nota* y vínculo opcional al horario. Incluye el bloc rápido (autoguardado).
- **Cumpleaños:** alertas del día y de los próximos 7 días. Cada cumpleaños se puede editar (✏️), pide confirmación antes de eliminarse y puede tener una **categoría** (creada por el administrador, ej. Familia, Amigos) y una **etiqueta** libre opcional. Se filtran por categoría.
- **Horario:** cada horario tiene apartados de **Tareas** y **Notas** de su día, semana o mes, con el selector **Todas / Solo vinculadas**. Diario, semanal o mensual, con fecha de inicio y fin. Las horas visibles van por defecto de 6:00 AM a 9:00 PM y se pueden cambiar al crear el horario o después (la tabla se amplía sola si una actividad queda fuera).

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
