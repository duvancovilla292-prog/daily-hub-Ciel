# Daily Hub

App web personal de productividad: **calendario, tareas, notas, fechas importantes (cumpleaños y otras fechas que se repiten) y horarios** (diario, semanal y mensual).
HTML + CSS + JavaScript puro, sin dependencias. Todo se guarda en `localStorage` bajo la llave `daily_hub_v1`.

## Cómo usarla
Abre `index.html` en el navegador (no necesita servidor). Mantén las carpetas junto a él.

## Sincronización con la nube (Firebase)
El botón ☁ de la barra superior permite entrar con Google. Con sesión iniciada, los datos se guardan en Firestore y en el navegador, y se sincronizan solos entre dispositivos. Sin sesión, la app funciona igual solo con el navegador. El punto del botón indica el estado: verde sincronizado, azul guardando, amarillo sin conexión, rojo error.

- **Un documento por elemento:** cada tarea, nota, cumpleaños, categoría y horario es un documento en `users/{uid}/items/{id}` con su hora de cambio (`updatedAt`) y una marca de borrado (`deleted`). Si dos dispositivos cambian cosas distintas, se conservan ambas; si cambian lo mismo, gana el cambio más reciente.
- **Sin conexión:** cada cambio queda pendiente en el navegador (sobrevive a recargar) hasta que la nube lo confirma; lo que llegue de la nube no lo pisa si es más viejo.
- **Cuentas:** al cerrar sesión el navegador se vacía (los datos quedan en la cuenta). Si al entrar hay datos sin cuenta, se pregunta antes de subirlos; los datos de otra cuenta nunca se suben. Los datos de la versión anterior (un solo documento `users/{uid}`) se migran solos.
- El tema, la tipografía y los filtros son de cada dispositivo y no se sincronizan.

La configuración está en `js/core/cloud.js`. En la consola de Firebase hace falta:
1. **Authentication → Método de acceso:** activar **Google**.
2. **Authentication → Configuración → Dominios autorizados:** agregar `duvancovilla292-prog.github.io`.
3. **Firestore Database → Reglas** (cada usuario solo puede leer y escribir lo suyo, incluidos sus documentos por elemento):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
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
│   │   ├── utils.js            Constantes, helpers y fechas (D)
│   │   ├── storage.js          Store: guardar, validar, migrar, fusionar (sin duplicados) y estadísticas
│   │   ├── state.js            Estado de los datos y de la interfaz
│   │   └── calendar-engine.js  Cuándo ocurre cada actividad, días del mes, vínculos
│   ├── ui/
│   │   ├── feedback.js         Toasts y modales
│   │   ├── header.js           Cabecera, panel de administrador, dashboard
│   │   ├── router.js           render() y navegación entre apartados
│   │   ├── actions.js          Clicks (data-action)
│   │   └── events.js           Cambios, escritura y formularios
│   ├── views/                  Una vista por apartado: today, calendar, birthdays, tasks, notes, schedule
│   └── main.js                 Arranque
├── fonts/
│   └── Prueva-Regular.ttf/.otf Tipografía Aetheri (la misma de MI-PORTAFOLIO)
└── data/
    └── datos-prueba.json       Datos de ejemplo para probar la carga
```

## Apartados
Para agregar o editar cualquier cosa (tarea, nota, cumpleaños, horario, actividad, día saltado o categoría) se usa un botón **"+ Nuevo…"** que abre una **ventana emergente**; no hay formularios fijos en las pantallas. Si se escribió algo y se cierra la ventana (✕, Cancelar, Esc o tocando fuera), pregunta antes de descartarlo. Los formularios viven ocultos en `#formStore` (index.html) y se mueven a la ventana al abrirla (`openSheet` en `js/ui/feedback.js`).

- **Hoy** (se abre por defecto): la agenda del día activo en una sola pantalla, con un apartado **⏰ Por vencer** (tareas de prioridad Alta que vencen en menos de 48 horas; en Tareas llevan la marca "vence en X h"). Una línea de tiempo con las actividades de todos los horarios y las tareas con hora (⚠ marca choques), y al lado las tareas del día (con agregar rápido, también con hora), las atrasadas (con **→ Hoy / → Mañana**), las notas y los cumpleaños. Indica si el día es festivo y qué horarios no aplican.
- **Calendario:** mes actual por defecto, con flechas para cambiar de mes. Filtros (todo / tareas / notas / cumpleaños / horarios), búsqueda y ventana de detalle al tocar un día.
- **Tareas:** con prioridad, **hora opcional**, **etiquetas** (filtro por etiqueta), **subtareas** (lista con avance que se marca sin abrir la edición), filtros y vínculo opcional a una actividad de un horario. Las atrasadas se mueven a hoy o mañana con un toque. Se editan solo con el botón ✏️. Hay tres tipos:
  - **Un solo día.**
  - **Con fecha límite:** abarca del día de inicio a la fecha límite y se marca hecha una sola vez (en el calendario se marca en su inicio y en su vencimiento).
  - **Se repite con la actividad vinculada:** aparece cada día que ocurre esa actividad (desde su fecha hasta la fecha "hasta" o el final del horario) y se marca hecha **cada día por separado**. Al terminar su periodo queda *hecha* si se hizo al menos un día, o *no cumplida* si no. En la pestaña Tareas sale en la fecha activa, y todas se gestionan en el grupo **Se repiten**.
- **Notas:** se pueden **fijar arriba** (📌) y en modo lectura se ve el **Markdown** (# títulos, **negrita**, *cursiva*, listas, - [ ] pendientes, > citas, `código` y enlaces). Se abren en modo lectura y solo se modifican con **Editar** (con **Cancelar** para descartar). Varias por día, de texto o lista, con botón *Guardar nota* y vínculo opcional al horario. Incluye el bloc rápido (autoguardado).
- **Fechas**: 🎂 **Cumpleaños** (con apodo y **parentesco** opcionales, aparte de la etiqueta) y 📅 **Otras fechas**, que se repiten **cada año, cada mes o cada semana** (ej. una relación que se celebra cada mes: "18 meses"; cada mes y cada semana necesitan el año de inicio; el día 31 cae el último día en meses cortos). Se filtran por tipo y por categoría. El signo y la generación solo aplican a cumpleaños; nombres de personas con mayúscula en cada palabra y el resto de fechas solo al inicio. Lista con avatares de iniciales (color de su categoría), cuenta regresiva y menú ⋮ (Ver ficha / Editar / Eliminar); los de hoy se destacan. Categorías creadas por el administrador (con la opción "Son mascotas") y etiqueta libre; filtro por categoría.
  - **Ficha** (tocar la tarjeta): fecha, edad o tiempo cumplido, **signo zodiacal** y **generación** (calculados; la generación no se muestra en mascotas) y dos pestañas: **Pendientes y regalos** (tareas vinculadas + lista de **💡 ideas de regalo** que se marca y amplía ahí mismo; se guarda como una nota tipo lista vinculada) e **Historial y notas** (notas vinculadas, de la más reciente a la más antigua según su última edición).
  - **📋 Copiar mensaje:** plantilla editable con `{nombre}`, `{apodo}` y `{edad}`, con vista previa; se copia al portapapeles y la plantilla se guarda (y se sincroniza).
  - **Vincular a personas:** tareas y notas pueden vincularse a una persona (además del horario); se ve 👤 en ellas y se buscan por su nombre.
  - **Recordatorio** (desactivado por defecto, en la ficha): "Recordarme comprar regalo / preparar algo N días antes" (7 por defecto). Se crea una tarea ("🎁 Regalo para …" o "📅 Preparar: …") vinculada a la fecha, una sola vez por cada vez que ocurre (en las anuales, cuando faltan 30 días o menos). Su id es fijo por ocurrencia (`r<año>-<id>` o `r<AAAAMMDD>-<id>`), así que si dos dispositivos la crean a la vez queda una sola en la nube.
- **Horario:** se puede **duplicar** (⧉), marcar que **no aplica en festivos de Colombia** (fijos, Ley Emiliani y Semana Santa, calculados sin servicios externos) y **saltar días concretos**. Al agregar o editar una actividad que se cruza con otra del mismo horario, avisa y la marca con ⚠. Cada horario tiene apartados de **Tareas** y **Notas** de su día, semana o mes, con el selector **Todas / Solo vinculadas**. Diario, semanal o mensual, con fecha de inicio y fin. Las horas visibles van por defecto de 6:00 AM a 9:00 PM y se pueden cambiar al crear el horario o después (la tabla se amplía sola si una actividad queda fuera).

## Vínculos
Los vínculos se ven desde los dos lados (si una tarea se vincula a una nota, la nota muestra la tarea) y se eligen con un **buscador con sugerencias**: se escribe y aparecen las coincidencias (sin importar tildes ni mayúsculas; busca por nombre, apodo, parentesco, categoría y etiqueta), se elige tocando o con ↑ ↓ y Enter, y queda como chip. La pestaña Fechas tiene además su propio buscador.

| Desde | Actividad del horario | Personas o fechas | Notas | Tareas |
|---|---|---|---|---|
| **Tarea** | 1 (las que se repiten siguen a esa actividad) | varias | varias | — |
| **Nota** | 1 | varias | — | varias (se guardan en la tarea) |
| **Otra fecha** | — | varias personas (ej. aniversario ↔ la pareja) | — | — |

Además, **los ítems de una lista y las subtareas pueden ser personas**: con "+ Agregar persona…" o escribiendo exactamente su nombre (o apodo). Se ven como 👤 y abren su ficha, y la ficha muestra las listas y tareas donde aparece.

Al borrar una persona, fecha o nota, se quita de los vínculos que la tenían. Al cargar un respaldo, los vínculos se reajustan si la persona o la nota ya existían.

## Administrador
El botón **Admin** abre una ventana emergente que se desbloquea al **iniciar sesión con Google** (no hay contraseña). Cada cuenta administra solo sus propios datos: lo garantizan las reglas de Firestore, no el código del navegador. Con sesión:
- **Panel con pestañas** — *Resumen*, *Tareas* (estados, por vencer, completadas los últimos 7 días, por prioridad, por tipo, etiquetas más usadas, vínculos), *Notas* (fijadas, palabras, ítems de listas, notas por mes, vínculos), *Fechas* (próximas, con recordatorio, por mes del año, por categoría, generaciones y signos), *Horarios* (horas programadas por día y por horario esta semana, choques, festivos, días saltados) y *Nube* (estado, cambios por subir, tamaño). Gráficas de barras de un solo color con su valor escrito; los colores de categoría usan una paleta validada para daltonismo y contraste en tema claro y oscuro.
- **Descargar respaldo** (`backup_YYYY-MM-DD.json`).
- **Cargar datos de prueba** y **Cargar respaldo:** comparan con lo que ya existe y solo agregan lo nuevo, sin duplicar.
- **Vaciar todo** (pide escribir VACIAR para confirmar). Conserva las categorías de cumpleaños.
- **Categorías de cumpleaños:** crear, renombrar y eliminar.

Los ids de todos los elementos solo pueden tener letras, números, `_` y `-`; los que no cumplen (por ejemplo en un respaldo manipulado) se reemplazan al cargarlos.

## Tipografía Aetheri
El botón **Aa** activa/desactiva la fuente en toda la web (clase `aetheri-on` en `<html>`, preferencia guardada). La fuente solo cubre letras, tildes y ¡¿!?; números y demás símbolos usan la tipografía normal.

## Probar con datos de ejemplo
La app arranca **vacía**: nunca carga sola los datos del repositorio. Para probarla, entra como administrador → **Cargar datos de prueba** (lee `data/datos-prueba.json`). Si abres `index.html` directo desde la carpeta, el navegador no deja leer ese archivo: usa **Cargar respaldo** y elígelo a mano. Si lo cargas otra vez, avisa que no hay nada nuevo.
