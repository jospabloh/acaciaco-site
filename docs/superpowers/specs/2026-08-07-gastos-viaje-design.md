# Gastos de Viaje · Herramienta freeware de reportes de viáticos

**Fecha:** 2026-08-07
**Estado:** aprobado, pendiente de plan de implementación
**Alcance:** `acaciaco-site/freeware/gastos-viaje/` + una migración en `acacia-mission-control`

## Problema

Un empleado que vuelve de un viaje de negocios tiene que entregarle a su empresa
un reporte de gastos: la lista de lo que gastó, con fecha y categoría, cuánto de
eso lleva IVA acreditable, cuánto le adelantaron y, sobre todo, cuánto le deben o
cuánto tiene que devolver. Hoy eso se resuelve con una plantilla de Excel que
cada quien hereda de un compañero, más un sobre con tickets engrapados.

Las 20 herramientas del módulo `freeware/` de acaciaco.com.mx resuelven problemas
de ese tamaño exacto: una tarea concreta, gratis, sin registro y sin que los
datos salgan del navegador. Falta esta.

## Objetivo

Que un empleado capture los gastos de un viaje —en varios días, en varias
monedas, con foto de cada ticket— y descargue **un solo PDF entregable**: carátula
con el saldo a reembolsar, tabla de gastos y anexo con cada comprobante. Todo en
el navegador. Y que Mission Control vea no sólo cuánta gente visita la
herramienta, sino cuánta la termina.

## Decisiones tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Usuario objetivo | Empleado que comprueba viáticos ante su empresa | Define el entregable: un documento que RH acepte, no un dashboard financiero |
| Comprobantes | Se adjuntan y se anexan al PDF | Es lo que RH realmente pide; y mantiene la promesa de que nada se sube |
| Autorrellenado con IA | Fuera de alcance | Rompe "nada sale de tu navegador" y cuesta tokens por uso anónimo |
| Alcance del reporte | Multi-moneda, anticipo/saldo, IVA y deducible | Es lo que distingue un reporte de viaje de una lista de gastos |
| Kilometraje | Fuera de alcance | No se pidió; se puede capturar como un gasto normal |
| Persistencia | Un reporte en curso, autoguardado, con exportar/importar `.json` | Los gastos se capturan a lo largo de días; una lista de viajes es navegación que nadie pidió |
| Estructura de UI | Una sola vista con panel de resumen pegajoso | Se captura en cualquier orden, que es como pasa en un viaje |
| Nombre y slug | **Gastos de Viaje** — `/freeware/gastos-viaje` | Corto y sirve igual para la versión EN ("Travel Expenses") |
| Mission Control | Alta en el registro **más** evento de exportación | Mide conversión, no sólo tráfico, sin tocar el esquema |

## Arquitectura

Herramienta estática dentro del módulo `freeware/`. Sin backend propio.

```
freeware/gastos-viaje/
  index.html      SEO + JSON-LD (SoftwareApplication, BreadcrumbList, FAQPage),
                  tokens light/dark, <article> SEO, promo, carga de scripts
  favicon.svg     ícono propio en el teal de la marca
  calc.js         funciones puras: conversión, totales, IVA, saldo (JS plano)
  calc.test.js    pruebas de calc.js con `node --test`
  store.jsx       IndexedDB: autoguardado, adjuntos, exportar/importar .json
  pdf.jsx         buildPdf(): carátula + tabla + anexo de comprobantes
  app.jsx         UI React, estado, i18n ES/EN
```

Cuatro archivos de código en vez de uno porque `app.jsx` completo rondaría las
1,200 líneas. El corte es por responsabilidad y cada pieza se entiende sola:

- `calc.js` no sabe de React ni del DOM. Entra un reporte, salen cifras.
- `pdf.jsx` no sabe de IndexedDB. Entra un reporte más los blobs de los
  comprobantes, sale un `Blob` de PDF.
- `store.jsx` no sabe de UI. Expone `load()`, `save(report)`, `putReceipt(blob)`,
  `getReceipt(id)`, `exportJson()`, `importJson(file)`.
- `app.jsx` orquesta y pinta.

Precedente en el repo: `plink-fx/` ya carga dos `.jsx`.

`calc.js` va como JavaScript plano —no JSX— y cierra con
`if (typeof module !== 'undefined') module.exports = { ... }`. El navegador lo
carga como script clásico y `node --test` puede probarlo sin transpilar nada
(`acaciaco-site` no declara `"type": "module"`, así que Node lo lee como CommonJS).

Recursos compartidos, sin duplicar: React 18 y Babel standalone vendorizados en
`/assets/vendor/`, `pdf-lib@1.17.1` desde unpkg (igual que `generador-facturas`),
`/styles/freeware-premium.css`, `/scripts/analytics.js`, `/scripts/freeware-promo.js`,
tema en `acacia-theme` e idioma en `acacia-lang`.

## Modelo de datos

```js
report = {
  v: 1,
  trip: {
    traveler, employeeId, company, destination, purpose,
    dateFrom, dateTo, currency: "MXN", advance: 0, notes
  },
  expenses: [{
    id, date, category, description,
    amount, currency, fx,      // fx = tipo de cambio a la moneda del reporte
    taxAmount, deductible,     // taxAmount en la moneda original del gasto
    receiptId                  // null si no se adjuntó comprobante
  }],
  updatedAt
}
```

Los adjuntos **no** viven dentro del reporte: van en su propio object store de
IndexedDB (`receipts`: `{ id, blob, name, type }`), referenciados por `receiptId`.
Si vivieran dentro, cada tecla pulsada reescribiría veinte megabytes de fotos.

Categorías: avión o autobús, hospedaje, alimentos, transporte local, combustible
y casetas, otros.

## Cálculos

Todos en `calc.js`, todos puros:

- **Importe convertido** = `amount × fx`. `fx` vale 1 cuando la moneda del gasto
  es la del reporte.
- **Total** = suma de importes convertidos.
- **IVA acreditable** = suma de `taxAmount` convertido, **sólo de los gastos
  marcados como deducibles**.
- **Saldo** = `total − advance`. El resumen lo presenta según el signo:
  "Te deben $3,240.00" o "Debes devolver $760.00", y "Cuentas saldadas" si es cero.

Las sumas se hacen en centavos enteros y el redondeo ocurre sólo al presentar.
Con tipos de cambio de por medio, sumar flotantes se nota en el total.

**Tipo de cambio:** botón *sugerir* que consulta `/api/exchange-rate`, que ya
existe en el sitio. Ese endpoint devuelve **únicamente el FIX USD/MXN de
Banxico**, así que la sugerencia automática aplica a gastos en USD dentro de un
reporte en MXN; cualquier otro par se captura a mano. El campo siempre es
editable y si el endpoint falla, el flujo sigue en manual sin mensaje de error.

## Comprobantes

Se adjunta JPG, PNG, WebP o PDF por gasto. Cualquier otro tipo se rechaza al
adjuntar, diciendo por qué.

HEIC —lo que produce un iPhone por omisión— se acepta en el selector, pero sólo
Safari lo decodifica; en Chrome y Firefox el `<canvas>` no puede leerlo. El
manejo es intentar decodificarlo y, si el navegador no puede, rechazarlo con un
mensaje que diga qué hacer ("tu navegador no puede leer HEIC; comparte la foto
como JPG"). Nada de fallar en silencio ni de adjuntar una imagen en blanco.

Antes de guardarlas, las imágenes pasan por un `<canvas>` que las reescala a un
máximo de 1600 px por lado y las recomprime a JPEG con calidad ~0.8. Sin ese
paso, seis fotos de celular producen un PDF de 40 MB que ningún correo
corporativo deja pasar.

En el PDF final cada comprobante ocupa su propia página de anexo, encabezada con
`Gasto #3 · 12 mar 2026 · Hospedaje · $2,450.00`, para que quien revisa coteje
renglón contra imagen sin adivinar. Las imágenes se incrustan con `embedJpg` o
`embedPng`; los comprobantes que ya son PDF se copian con `copyPages`, no se
rasterizan.

## El entregable

Botón principal: **Descargar reporte (PDF)**. Un solo archivo, nombrado
`reporte-gastos-<destino>-<yyyy-mm>.pdf`, con tres partes:

1. **Carátula** — título, viajero, empresa, número de empleado, destino, motivo y
   periodo. A la derecha el bloque de cifras: total, IVA acreditable, anticipo y
   saldo, con el saldo en grande porque es lo que se firma.
2. **Tabla de gastos**, paginada si no cabe en una hoja:
   `# · fecha · categoría · descripción · moneda original · TC · importe · IVA · ded.`
   Cierra con dos líneas de firma, *Elaboró* y *Autorizó*.
3. **Anexo de comprobantes**, una página por ticket, encabezada como se describió.

Botón secundario: **CSV**, una fila por gasto con las mismas columnas. Es para
contabilidad, que va a querer pegarlo en su sistema en vez de transcribir un PDF.

Aparte de los entregables está el `.json` de exportar/importar: no es para
entregar, es el mecanismo para continuar la captura en otra computadora o pasarle
el reporte a alguien. Incluye los adjuntos en base64.

## Interfaz

Una sola vista, con el resumen siempre a la vista:

- **Datos del viaje** arriba: viajero, empresa, destino, motivo, fechas, moneda
  del reporte y anticipo.
- **Lista de gastos** abajo: cada gasto es una fila con fecha, categoría,
  descripción, monto y moneda, tipo de cambio (sólo si la moneda difiere de la
  del reporte), IVA, casilla de deducible y su comprobante adjunto.
- **Panel de resumen** pegajoso al costado —y abajo en móvil— con total, IVA
  acreditable, anticipo y saldo. Se ve como la carátula del reporte, no como una
  calculadora: quien lo mira debe reconocer de inmediato el documento que va a
  descargar.

La dirección visual concreta —tipografía, jerarquía, ritmo de la tabla, el
tratamiento del panel— se trabaja con la skill `frontend-design` durante la
implementación, sobre los tokens OKLCH que ya usa el freeware. No se inventa una
paleta nueva.

ES/EN completo, tema claro/oscuro, y el bloque de privacidad visible: el cálculo,
las fotos y el PDF nunca salen del dispositivo.

## Integración con Mission Control

Dos piezas, ninguna toca el esquema de la bodega.

**Registro.** Migración `supabase/migrations/0032_seed_gastos_viaje.sql` en
`acacia-mission-control`, calcada de `0029_seed_metodo_cubetas.sql`: fila
`fw-gastos-viaje` en `public.apps` con `backend='static'`, `category='freeware'`,
`url='https://acaciaco.com.mx/freeware/gastos-viaje'`, `status='active'`,
idempotente con `on conflict (id) do update`. Con eso `api/web-kpis.js` la
atribuye sola por prefijo de URL y la herramienta aparece en Portafolio con
visitas y visitantes únicos de 30 días.

**Conversión.** Al descargar el PDF, la app dispara un pixel a
`https://control.acaciaco.com.mx/api/track?p=/freeware/gastos-viaje/exportado`.
Cae en `web_events` como una ruta más, suma a la app por el mismo prefijo
(`/freeware/gastos-viaje/...`) y se puede leer por separado en *top paths*. Así
Mission Control no ve solamente tráfico: ve cuánta gente **termina** su reporte.
Cero migración de esquema, cero política de RLS nueva, cero datos personales —
sólo el hecho de que alguien exportó.

**Alta en el sitio**, que es parte del mismo trabajo: `freeware/index.html`
(tarjeta del grid, entrada del footer y el `ItemList` de JSON-LD en la posición
21) y `sitemap.xml`.

## Errores y casos borde

| Situación | Comportamiento |
|---|---|
| IndexedDB no disponible (modo privado, navegador viejo) | La app funciona en memoria y avisa una sola vez, discreto, que no se está guardando |
| Cuota de almacenamiento llena | Mensaje claro con la salida a la mano: exportar el `.json` y liberar espacio |
| Gasto sin monto o sin fecha | No bloquea la captura. Se marca la fila y al exportar se avisa cuántos hay; se puede exportar de todas formas |
| `/api/exchange-rate` caído o sin token | El tipo de cambio se queda en manual. Sin mensaje de error |
| Archivo adjunto de tipo no soportado | Se rechaza al adjuntar, indicando el motivo |
| Importar un `.json` con `v` desconocida | Se rechaza con un mensaje explícito en vez de cargar datos a medias |

## Verificación

`node --test freeware/gastos-viaje/calc.test.js` cubre las funciones puras:
conversión con y sin tipo de cambio, redondeo en centavos, IVA sumado sólo de los
deducibles, y el saldo en sus tres casos (a favor, en contra y exacto).

El resto es de navegador y va por lista manual:

1. Capturar tres gastos, dos de ellos en USD, cada uno con foto.
2. Recargar la página y confirmar que todo volvió, incluidos los adjuntos.
3. Descargar el PDF y revisar carátula, tabla paginada, firmas y anexo.
4. Descargar el CSV y abrirlo en una hoja de cálculo.
5. Exportar el `.json`, borrar los datos, importarlo y confirmar que vuelve igual.
6. Verificar en modo claro y oscuro, en ES y EN, y en ancho de móvil.

Aviso sin adornos: `acaciaco-site` no tiene hoy ninguna infraestructura de
pruebas —`package.json` no declara scripts ni dependencias de desarrollo—. Este
`node --test` sobre `calc.js` es lo primero que entra y cubre únicamente los
cálculos.

## Fuera de alcance

- Autorrellenado de tickets con IA (se puede añadir después; el gancho natural es
  el mismo `factura-extract.ts` de Roseta).
- Kilometraje como fila especial con tarifa por km.
- Lista de varios viajes guardados.
- Cuentas, aprobaciones o cualquier cosa que requiera backend.
