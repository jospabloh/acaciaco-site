# Roseta · Entrega de la factura al cliente e historial por RFC

**Fecha:** 2026-08-05
**Estado:** aprobado, pendiente de plan de implementación

## Problema

El flujo de solicitud de factura de Roseta Café funciona de extremo a extremo
hasta el momento del envío: `api/roseta/factura-submit.ts` manda el correo
interno a Roseta y ACACIA con la CSF y el ticket adjuntos, manda al cliente su
confirmación de recepción, y escribe la fila en las pestañas `Solicitudes` y
`ClientesRFC` del Google Sheet.

A partir de ahí hay dos huecos.

**1. El cliente nunca se entera de que su factura ya está lista.** Roseta timbra
el CFDI en su software, cambia `Estatus` de `Pendiente` a `Facturada` a mano en
el Sheet, y ese cambio no dispara nada: `"Facturada"` sólo aparece en
`roseta/factura/estatus/index.html` para pintar un badge cuando el cliente entra
a consultar por su cuenta. `vercel.json` no declara ningún cron y no existe
ningún endpoint que observe la columna `Estatus`. El PDF y el XML se los reenvía
Roseta a mano desde su correo, uno por uno, sin que quede registro de qué se
mandó ni cuándo.

**2. La consulta por RFC devuelve una sola solicitud.** En
`api/roseta/factura-status.ts` la búsqueda por RFC recorre las filas hacia atrás
y corta en la primera coincidencia, así que un cliente que facturó tres consumos
esta semana sólo ve el más reciente.

## Objetivo

Que el sitio **entregue** el CFDI —no sólo avise— eliminando el reenvío manual de
Roseta y dejando registro de cada envío; y que la consulta por RFC muestre todas
las solicitudes de los últimos 30 días.

## Decisiones tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Qué lleva el correo | El PDF y el XML adjuntos | Reemplaza el reenvío manual de Roseta, no lo duplica |
| Qué dispara el envío | Un clic de Roseta en un panel interno | Determinista e inmediato; sin crons ni estado invisible |
| Dónde se guardan los CFDI | En ningún lado | La fuente de verdad fiscal es su software de timbrado |
| Ventana del historial por RFC | 30 días | Cubre el mes fiscal en curso sin volverse una lista infinita |
| Autenticación del panel | Contraseña compartida | Proporcional a una operación de una persona |

### Alternativas descartadas

- **Cron que vigila el Sheet.** Roseta pegaría links de Drive en columnas nuevas
  y un cron los procesaría. Descartado: pegar links a mano es más frágil que
  subir un archivo (un archivo con permisos restringidos le llega roto al cliente
  y nadie se entera), exige ampliar el service account al scope de Drive, y en el
  plan Hobby de Vercel los crons corren una vez al día.
- **Buzón de correo entrante.** Roseta reenviaría el CFDI a una dirección del
  sistema y un webhook lo reenviaría al cliente. Descartado: depende de que
  escriba bien el folio en el asunto, el parseo de correo entrante es la pieza
  más frágil de las tres, y un match fallido pierde el correo en silencio.

## Arquitectura

### Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `api/roseta/_adminAuth.ts` | Verifica la contraseña del panel. Server-only, como `_sheets.ts`. |
| `api/roseta/factura-admin-list.ts` | `GET` — devuelve las solicitudes para el panel. |
| `api/roseta/factura-admin-send.ts` | `POST` — recibe folio + PDF + XML; manda el correo, marca `Facturada`, registra el envío. |
| `roseta/factura/admin/index.html` | El panel. |
| `roseta/factura/admin/admin.js` | Lógica de cliente del panel. |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `api/roseta/factura-status.ts` | Devuelve una lista de solicitudes en vez de una sola |
| `roseta/factura/estatus/index.html` | Renderiza la lista en vez de un `<dl>` único |
| `.env.example` | Documenta `ROSETA_ADMIN_PASSWORD` |
| `README.md` | Menciona el panel y los endpoints nuevos |

### Cambios en el Google Sheet

La pestaña `Solicitudes` va hoy de `A` a `R`. `factura-submit.ts` documenta que
`Estatus` (**O**) y `Fecha de facturación` (**P**) no se pueden mover porque
Roseta las edita a mano. Las columnas nuevas van **estrictamente después de R**:

- **S — `Notificado el`**: fecha y hora en que se le mandó el CFDI al cliente,
  como timestamp ISO 8601 completo (`2026-08-05T14:32:10.000Z`). Vacío significa
  que nunca se le ha mandado. Es la columna que hace idempotente el envío.
- **T — `Archivos enviados`**: nombres del PDF y el XML enviados, separados por
  coma, para que quede rastro de qué recibió el cliente.

`Fecha de facturación` (**P**) se escribe como `YYYY-MM-DD`, el mismo formato que
ya usa `factura-submit.ts` para `Fecha de solicitud`, para que ambas columnas
sigan siendo comparables y ordenables.

Los rangos de lectura y escritura pasan de `A:R` a `A:T`.

### Flujo

```
Roseta timbra en su software → entra al panel → ve las pendientes
  → sube PDF + XML de una solicitud → clic en "Enviar al cliente"
      → correo al cliente con los adjuntos          (el entregable)
      → Estatus = Facturada, Fecha de facturación   (columnas O, P)
      → Notificado el = ahora, Archivos = nombres   (columnas S, T)
  → el cliente recibe su factura; si entra a /estatus la ve "Facturada"
```

## Componentes

### `_adminAuth.ts`

Lee `ROSETA_ADMIN_PASSWORD` del entorno —sin prefijo público, para que nunca
llegue al bundle del cliente— y la compara con la que manda el panel usando
`crypto.timingSafeEqual` sobre el hash SHA-256 de ambas, de modo que el tiempo de
respuesta no filtre información. Reutiliza `_ratelimit.ts` para frenar intentos
por fuerza bruta; ese limitador vive en memoria por instancia de lambda, así que
es best-effort, no una garantía.

Si la variable de entorno no está configurada, los endpoints del panel responden
error en vez de quedar abiertos.

### `factura-admin-list.ts`

Autenticado. Devuelve las solicitudes de `Solicitudes!A:T`, la más reciente
arriba, con los datos que el panel necesita: folio, fecha de solicitud, RFC,
razón social, régimen, uso de CFDI, código postal, correo, teléfono, sucursal,
fecha de consumo, monto, subtotal, IVA, forma de pago, movimiento, estatus, fecha
de facturación y fecha de notificación. Acepta un filtro `pendientes` /
`facturadas` / `todas`.

Lee la pestaña completa y filtra en memoria, igual que hacen hoy
`factura-submit.ts` y `factura-status.ts`. Al volumen actual de solicitudes eso
es holgado; si la pestaña creciera hasta volverlo lento, la paginación es un
cambio posterior y aislado a este endpoint.

### `factura-admin-send.ts`

Autenticado. Recibe folio, PDF y XML. En orden:

1. Valida: que el folio exista en el Sheet, que el correo de esa fila sea válido,
   que los archivos sean realmente PDF y XML (por extensión **y** por sus
   primeros bytes: `%PDF` para el PDF, `<?xml` o `<` para el XML), y que juntos no
   excedan **2 MB** ya codificados en base64. Un CFDI típico pesa bastante menos,
   y el tope deja amplio margen frente al límite de 4.5 MB que Vercel impone al
   cuerpo de la petición.
2. Manda el correo al cliente con ambos adjuntos.
3. Localiza la fila del folio, **relee esa fila y confirma que el folio coincide**
   antes de escribir, y actualiza las columnas O, P, S y T.

**El destinatario se lee de la columna H del Sheet, nunca del cuerpo de la
petición.** El panel sólo indica *qué folio* enviar; *a dónde* lo decide el
servidor. Así, aun si la contraseña se filtrara, el endpoint no sirve para mandar
archivos arbitrarios a direcciones arbitrarias.

### El panel

Lista de solicitudes, la más reciente arriba, con filtros `Pendientes` (por
defecto), `Facturadas` y `Todas`. Cada fila muestra folio, fecha, RFC, razón
social, monto, sucursal y estatus. Al abrirla: los datos fiscales completos para
capturar en el software de timbrado (con botón de copiar el RFC), dos zonas de
carga —PDF y XML— y el botón de enviar.

El botón se habilita sólo con **ambos** archivos cargados: el XML es el
comprobante fiscal válido y el PDF su representación impresa, así que mandar sólo
el PDF sería entregar algo que no sirve para deducir.

Una solicitud con fecha en `Notificado el` aparece marcada como enviada y su
botón dice "Reenviar", con confirmación explícita.

La contraseña se pide una vez, se guarda en `sessionStorage` —se borra al cerrar
la pestaña— y viaja en un header en cada petición. La página lleva `noindex` y no
se enlaza desde ninguna parte pública.

### El correo al cliente

- **Asunto:** `Tu factura de Roseta Café ya está lista · RF-XXXXXX`
- **De:** `RESEND_FROM_EMAIL`, el mismo remitente verificado del flujo actual
- **Responder a:** `roseta.cafeteria@gmail.com`
- **Cuerpo:** razón social, folio, fecha de consumo, sucursal y monto, para que el
  cliente reconozca de qué consumo es sin abrir los adjuntos; y una nota de que
  **conserve el XML, porque ése es el comprobante fiscal válido**.
- **Adjuntos:** el PDF y el XML.

Todo valor interpolado pasa por `escapeHtml`, siguiendo el patrón que ya existe
en `factura-submit.ts`.

### Consulta por RFC

`factura-status.ts` pasa de devolver una solicitud a devolver una lista. Los dos
tipos de búsqueda se comportan distinto a propósito:

- **Por folio:** coincidencia exacta, **sin ventana de tiempo**. Quien tiene el
  folio tiene una referencia directa a su solicitud.
- **Por RFC:** todas las de los **últimos 30 días naturales** contados hacia atrás
  desde el día de la consulta, según la fecha de solicitud (columna B), la más
  reciente primero. Sin tope de filas: la ventana ya acota la lista.

Si el RFC existe pero no tiene solicitudes en la ventana, el mensaje es distinto
a "no encontramos nada": *"Encontramos solicitudes con ese RFC, pero ninguna de
los últimos 30 días — búscala con tu folio si es más antigua."*

**Campos expuestos por solicitud:** folio, fecha de solicitud, sucursal, monto,
estatus, fecha de facturación y fecha de notificación. Este último contesta
directamente la pregunta que trae el cliente: *¿ya me la mandaron?*

**Campos deliberadamente ocultos**, igual que hoy: correo, razón social, código
postal y teléfono. Que la lista sea más larga no justifica exponer más datos por
fila: el RFC de una persona física se deduce de su nombre y fecha de nacimiento,
así que la consulta pública debe seguir siendo pobre en datos personales.

Una fila con fecha vacía o malformada se incluye y se marca como sin fecha, en
vez de ocultarle al cliente algo que es suyo.

## Manejo de errores

El orden —primero el correo, después el Sheet— es deliberado: el correo es el
entregable, el Sheet es la contabilidad.

| Falla | Comportamiento |
|---|---|
| El correo falla | No se escribe nada. La solicitud sigue en `Pendiente` y Roseta reintenta. El estatus nunca dice "Facturada" si el cliente no recibió nada. |
| El correo sale pero el Sheet falla | El envío fue un éxito. Se reintenta una vez; si sigue fallando, el panel avisa: *"El correo salió correctamente, pero no pude marcar la solicitud como Facturada — márcala a mano en el Sheet."* Explícitamente **no** se le invita a reenviar, porque duplicaría el correo. |
| Folio inexistente | 400, sin mandar nada. |
| Archivo que no es PDF o XML | 400, sin mandar nada. |
| `ROSETA_ADMIN_PASSWORD` sin configurar | Los endpoints del panel responden error; nunca quedan abiertos. |
| La lectura del Sheet falla en el panel | Error visible en pantalla; el panel no muestra una lista vacía que parezca "no hay pendientes". |

**Condición de carrera cubierta:** para escribir el estatus hay que localizar el
número de fila del folio. Si Roseta insertara o borrara filas a mano en ese
instante, el índice podría desfasarse y se escribiría sobre la solicitud
equivocada. Antes de escribir se relee esa fila y se confirma que el folio
coincide; si no, se vuelve a buscar. Con una sola operadora el riesgo es bajo,
pero marcarle "Facturada" a la solicitud de otro cliente es un error caro y la
verificación es barata.

## Verificación

El repositorio no tiene framework de pruebas: `package.json` sólo declara
dependencias, sin `scripts` ni suite. Este trabajo no introduce una
infraestructura de testing; la verificación es manual y con navegador, contra un
Sheet de prueba y `npx vercel dev`.

| Caso | Resultado esperado |
|---|---|
| Contraseña incorrecta | 401 |
| Contraseña correcta | Carga la lista de solicitudes |
| Envío feliz | El correo llega con **ambos** adjuntos; el Sheet queda con `O=Facturada`, `P` con fecha, `S` con la hora y `T` con los nombres |
| Solicitud ya notificada | El panel pide confirmación antes de reenviar |
| Correo forzado a fallar (API key inválida) | El Sheet no se modifica; el estatus sigue en `Pendiente` |
| Folio inexistente | 400 |
| Archivo que no es PDF ni XML | 400 |
| RFC con 3 solicitudes en 30 días y 1 de hace 60 | Salen 3 |
| Folio de hace 60 días | Sí lo encuentra |
| Panel y estatus en móvil | Usables a 360 px de ancho |

La interfaz se verifica con Playwright, ya configurado en el entorno, con
capturas del panel y del historial.

## Fuera de alcance

- **Usuarios individuales** en vez de una contraseña compartida. La contraseña
  protege contra quien encuentre la URL, no contra quien ya la tiene; es
  proporcional a una operación de una persona. Si crece el equipo, se cambia por
  autenticación real.
- **Archivar los CFDI** en el sitio. Viven en el software de timbrado.
- **Recordatorio automático a Roseta** cuando una solicitud lleva días pendiente.

## Variables de entorno nuevas

```
# Contraseña del panel interno /roseta/factura/admin. Sin prefijo público:
# debe permanecer del lado del servidor.
ROSETA_ADMIN_PASSWORD=
```
