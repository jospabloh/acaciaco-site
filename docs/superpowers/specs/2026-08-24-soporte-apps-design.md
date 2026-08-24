# Soporte a Apps · sección pública en acaciaco-site para pedir soporte, mejoras o proponer una idea

**Fecha:** 2026-08-24
**Estado:** aprobado, pendiente de plan de implementación
**Alcance:** `acaciaco-site/` (página + `api/`) + `acacia-mission-control/` (migración
+ `api/ingest/lead.js` + `src/pages/CRM.jsx`)
**Fuera de alcance de este spec:** las 9 apps Base44 — ver "Fase 2" al final.

## Problema

Dentro de cada app del portafolio ya existe soporte (`SupportTicket` local +
push/pull hacia Mission Control, módulo 8 — funciona bien y no se toca). Pero
alguien que necesita ayuda, quiere pedir una mejora, o simplemente tiene una idea
para una app nueva **no tiene dónde escribir si no está dentro de una app** —
o no es cliente todavía, o está en el sitio de marketing y no quiere entrar a
buscar el botón de soporte de su app.

acaciaco-site ya tiene un formulario de contacto (`contacto.html`, "O escríbenos
directo") que postea a `api/ingest/lead.js` en Mission Control y cae en la tabla
`leads` (pillar CRM). Pero está enmarcado como formulario de ventas — "Cuéntanos
sobre tu proyecto", "te contactamos en menos de 24 horas" — y no distingue tipo
de solicitud. No sirve para que un cliente reporte que algo no funciona.

## Objetivo (Fase 1)

Una sección de Soporte, separada del contacto de ventas, donde cualquier
visitante elige una app del portafolio (o "Otra idea / app nueva"), dice si es
Soporte o Mejora, escribe su mensaje, y:

1. Le llega un correo de confirmación, y a ACACIA le llega un correo interno con
   el detalle.
2. La solicitud queda visible en Mission Control, filtrable por app y por tipo.

**Lo que Fase 1 NO hace:** no crea un `SupportTicket` real dentro del backend de
ninguna app — ver la sección "Por qué no `tickets`, y por qué eso importa" más
abajo. Eso es Fase 2, con su propio spec.

## Decisiones tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Dónde vive el dato | Tabla `leads` de Mission Control, extendida con `type` | Es la única tabla del bodega que ya acepta un registro externo sin backing real en una app — `tickets` asume un `SupportTicket` real detrás (ver abajo) |
| Selector de app | Dropdown estático, mismas 9 apps + textos que ya usa el lead-form de `contacto.html` | Ya es el precedente exacto en este mismo repo; sin llamar a ningún registro en tiempo de request (el sitio no tiene build ni backend de lectura para eso) |
| "Idea nueva / app que no existe" | Última opción del mismo dropdown, no un formulario aparte | Un solo flujo; se guarda con `app_interest: null`, `type: 'idea'` |
| Selector de tipo (Soporte / Mejora) | Segundo control, sólo visible si se eligió una app real | Preguntar "¿soporte o mejora?" sobre algo que no existe todavía no tiene sentido |
| Correo | Interno (a ACACIA) + confirmación automática al remitente | Pedido explícito: "que me llegue igual por correo" |
| Orden escritura/correo | Se persiste en Mission Control primero, se manda correo después | Al revés del patrón de Roseta (mail-first) a propósito: aquí lo que se guarda ES la solicitud, no un respaldo contable opcional — si Mission Control no la recibe, no hay nada que confirmarle a nadie |
| Anti-spam | Honeypot + límite de tasa por IP (5/hora) | Endpoint público y anónimo que dispara dos correos por envío; protección barata, sin nueva infraestructura |
| Página | Nueva `soporte.html`, separada de `contacto.html` | El formulario de contacto está enmarcado para ventas ("cuéntanos tu proyecto"); un cliente con un problema no lo asocia a ese formulario. Se cruza-enlazan los dos |

## Por qué no `tickets`, y por qué eso importa

Antes de escribir este spec se leyó el código real de la tubería de tickets
(`api/_lib/ingestTicket.js`, `sync/ticketMapping.js`, `ticketControl.js`), no
sólo el CLAUDE.md. La razón para descartar `tickets` no es de estilo, es
funcional:

- `mapTicketRecord()` exige un `record` con la forma exacta que produce el
  `SupportTicket` de **esa** app específica — sus propios nombres de campo de
  estado, prioridad, tenant, y su propio enum de estados (rumbo:
  `open/in_progress/resolved/closed`; ctrlhq: `submitted/resolved`; liuma en
  MAYÚSCULAS…). Fabricar ese registro desde acaciaco-site sin una app real
  detrás es inventar datos con la forma de otra app.
- Peor: cuando un operador responde un ticket desde Mission Control,
  `buildTicketReply`/`buildTicketStatus` terminan llamando
  `callBridge(app, 'tickets.update', …)` — **una escritura real contra el
  backend Base44 de esa app**, sobre el id del ticket. Un ticket "de mentiras"
  creado sólo en la bodega, sin ese id real del lado de la app, rompe la
  primera vez que alguien intenta responderlo desde el panel.

Meterlo ahí de todos modos habría producido un ticket que **se ve real en el
panel de Soporte pero no se puede operar** — peor que no tenerlo, porque nadie
lo sabría hasta que fallara. `leads` no tiene ninguna de las dos ataduras: es
una tabla de CRM sin bridge, pensada exactamente para "algo entró de afuera, sin
cuenta, sin id real todavía".

## Arquitectura

```
Visitante en soporte.html
        │  (elige app / "otra idea", tipo, nombre, correo, mensaje)
        ▼
acaciaco-site: POST /api/soporte-apps
        │  1. valida honeypot + campos requeridos
        │  2. límite de tasa por IP (igual patrón que api/roseta/_ratelimit.ts)
        │  3. POST server-to-server → Mission Control /api/ingest/lead
        │       (con x-lead-secret si INGEST_LEAD_SECRET está puesto)
        │  4. si Mission Control confirma: envía 2 correos vía Resend
        ▼
Mission Control: api/ingest/lead.js (extendido con `type`)
        │  inserta en public.leads
        ▼
Mission Control: src/pages/CRM.jsx (extendido: columna/filtro `type`)
```

A diferencia del lead-form actual de `contacto.html` (que postea **desde el
navegador** directo a Mission Control), aquí el navegador postea a
**acaciaco-site**, y es acaciaco-site quien server-to-server llama a Mission
Control. La razón es el orden escritura→correo de la tabla de arriba: con dos
POSTs separados desde el navegador (uno a Mission Control, otro a un endpoint
de correo) un cierre de pestaña a mitad de camino deja el correo sin mandarse
o la solicitud sin guardarse, sin forma de saber cuál pasó. Con un solo POST a
acaciaco-site, ese orden lo controla un solo handler.

## Modelo de datos

Migración nueva sobre `public.leads` (Mission Control):

```sql
alter table public.leads
  add column type text check (type in ('soporte','mejora','idea'));
```

`null` en filas existentes = lead de ventas de siempre (comportamiento sin
cambio, retrocompatible). `app_interest` se reutiliza tal cual —ya acepta el
nombre de cualquier app o `null`— así que sólo hace falta esta columna nueva.

## Componentes

### `acaciaco-site`

- **`soporte.html`** — página nueva, mismo esqueleto/tema/nav que el resto del
  sitio. Formulario: dropdown de app (9 apps + "Otra idea / app nueva" al
  final), selector Soporte/Mejora (oculto si se eligió "otra idea"), nombre,
  correo, mensaje, campo honeypot oculto. Enlaza desde/hacia `contacto.html`
  ("¿Ya eres cliente y algo no funciona? Ve a Soporte" / "¿Buscas soporte, no
  ventas? …").
- **`api/soporte-apps.ts`** — handler nuevo. Import-free en la parte que se
  quiera cubrir con `node --test` (mismo criterio que `_adminAuth.ts`), con un
  `_ratelimit.ts` colocado junto a él (copia del de `api/roseta/`, mismo
  patrón in-memory de ventana deslizante — no hay nada que compartir entre
  directorios de forma segura sin romper la regla de que cada archivo de
  `api/` es su propia función).
- **`.env.example`** — nuevas: `MISSION_CONTROL_INGEST_URL` (default
  `https://control.acaciaco.com.mx/api/ingest/lead`), `INGEST_LEAD_SECRET`
  (opcional, espejo del mismo nombre en Mission Control),
  `SUPPORT_APPS_NOTIFY_EMAIL` (a quién llega el correo interno).

### `acacia-mission-control`

- **Migración** — columna `type` en `leads` (arriba).
- **`api/ingest/lead.js`** — acepta y persiste `type` (valida contra el enum,
  `null` si no viene — retrocompatible con el lead-form de ventas existente,
  que seguirá sin mandarlo).
- **`src/pages/CRM.jsx`** — columna/badge de tipo junto a `app_interest`, y un
  filtro simple para que "ver sólo Soporte de StockFlow" sea un clic, no un
  scroll por JSON crudo en `raw`.

## Seguridad / anti-abuso

- **Honeypot**: campo oculto (CSS, no `display:none` que algunos bots ya
  ignoran — mejor `position:absolute;left:-9999px`) revisado en el servidor;
  si viene lleno, se responde el mismo mensaje de éxito que un envío real, sin
  tocar ni la base ni el correo.
- **Límite de tasa**: 5 envíos/hora por IP, en memoria (mismo trade-off ya
  documentado en `_ratelimit.ts`: no sobrevive un cold start ni un fleet
  distribuido, suficiente para un formulario público de bajo tráfico).
- El endpoint de Mission Control (`lead.js`) ya es público/anónimo por diseño
  (el lead-form de ventas lo llama directo desde el navegador) — no se le
  cambia ese modelo de confianza; el límite de tasa vive del lado de
  acaciaco-site, que es el único llamador nuevo que puede necesitarlo.

## Manejo de errores

- Honeypot lleno → 200 falso-positivo de éxito (no delatar).
- Límite de tasa excedido → mensaje genérico ("inténtalo más tarde"), sin
  correos.
- Mission Control no responde / error → no se manda ningún correo (ver la
  decisión de orden arriba); el visitante ve un error y el mailto de
  respaldo (`contacto@acaciaco.com.mx`), mismo patrón que el catch del
  lead-form actual.
- Correo interno falla pero Mission Control sí guardó la solicitud → no se le
  muestra error al visitante (su solicitud SÍ quedó registrada); se registra
  para revisión, mismo espíritu del `warning` best-effort de
  `factura-admin-send.ts`.
- Correo de confirmación al remitente falla → igual, best-effort, no bloquea
  ni se le informa como error al visitante (ya se guardó, que es lo que
  importa).

## Testing / verificación

- `node --test` sobre la parte pura de `api/soporte-apps.ts` (validación de
  campos, honeypot, armado del payload) — sin imports, mismo criterio que el
  resto de `tests/` en este repo.
- El roundtrip real contra Mission Control + envío de correo con Resend no se
  puede probar desde este sandbox (proxy sin esos dominios en la allowlist,
  mismo límite que documenta cada CLAUDE.md del portafolio) — se verifica
  contra un preview deploy real al implementar.
- En Mission Control: `npm run build`, `npm run lint`, y una prueba manual de
  la migración contra Supabase antes de aplicarla en producción.

## Fase 2 (fuera de alcance de este spec — spec aparte)

Cuando el correo del remitente coincide con un usuario real de la app elegida,
crear un `SupportTicket` genuino dentro del backend de esa app —vía una acción
nueva en su puente `acaciaControl`, con el tenant resuelto en el servidor por
ese correo, nunca confiado del cliente— para que el ticket sea el mismo objeto
visto y editable tanto desde Mission Control como desde dentro de la app. Si el
correo no coincide con nadie (un prospecto sin cuenta), se queda en `leads`
como en Fase 1 — no hay "dentro de la app" al que escribirle. Esto toca las 9
apps Base44, una por una, y es del tamaño de módulo 15 (una llave/acción por
app) — no se diseña aquí.

## Preguntas abiertas para el plan de implementación

- ¿`INGEST_LEAD_SECRET` está puesto hoy en Mission Control? Si no, el envío
  server-to-server queda igual de abierto que el lead-form actual — no es un
  bloqueante, pero vale confirmarlo al implementar en vez de asumir.
- Copy exacto de `soporte.html` (textos, tono) — se escribe al implementar,
  siguiendo el tono ya establecido en `contacto.html`.
- Si el dropdown de 9 apps debe excluir alguna que ya no esté verdaderamente
  "en producción" — se confirma contra `apps/*.html` al momento de implementar,
  no se congela aquí.
