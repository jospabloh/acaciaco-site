# Baristop — panel de contenido: guía de instalación

Esta guía instala el "cerebro" del sitio nuevo de Baristop: una hoja de cálculo de
Google Sheets que guarda los textos, una carpeta de Drive para las imágenes y un
programa (Google Apps Script) que entrega el contenido al sitio, recibe los cambios
del panel y envía por correo las cotizaciones.

No cuesta nada: todo corre con una cuenta de Gmail normal. Tiempo estimado: 20 minutos.

> **Quién lo instala:** la cuenta de Google que quedará como dueña del panel (la
> del cliente, de preferencia). Los correos de cotización salen desde esa cuenta con
> el nombre "Baristop web".

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `Code.gs` | El programa: recibe las llamadas del sitio y del panel. |
| `Shared.js` | Reglas compartidas (validaciones, correos, columnas). |
| `DefaultContent.js` | Los textos y datos iniciales con los que se llena la hoja. |
| `appsscript.json` | Configuración del proyecto (zona horaria, permisos). |

---

## 1. Crear la hoja de cálculo

1. Entra a <https://sheets.new> con la cuenta que será dueña del panel.
2. Ponle nombre arriba a la izquierda: **Baristop web — contenido**.
3. No agregues nada más: el programa crea las pestañas solo.

## 2. Abrir Apps Script y pegar el código

1. En la hoja: menú **Extensiones → Apps Script**. Se abre una pestaña nueva con un
   archivo llamado `Código.gs` (o `Code.gs`).
2. Arriba a la izquierda, cambia el nombre del proyecto "Proyecto sin título" por
   **Baristop web**.
3. **Code.gs:** borra todo lo que trae el archivo y pega el contenido de `Code.gs`.
4. **Shared:** junto a "Archivos" pulsa el botón **+ → Secuencia de comandos**.
   Escribe el nombre `Shared` (el editor le pone `.gs`). Pega el contenido de `Shared.js`.
5. **DefaultContent:** repite el paso anterior con el nombre `DefaultContent` y pega
   el contenido de `DefaultContent.js`.
6. **Manifiesto:** a la izquierda, pulsa el engrane **Configuración del proyecto** y
   activa la casilla **Mostrar archivo de manifiesto "appsscript.json" en el editor**.
   Vuelve a **Editor** (el ícono `< >`), abre `appsscript.json`, borra todo y pega el
   contenido de `appsscript.json`.
7. Pulsa el ícono de guardar (disquete) o `Ctrl/Cmd + S`.

## 3. Elegir la contraseña del panel

1. **Configuración del proyecto** (engrane) → baja hasta **Propiedades de la secuencia
   de comandos** → **Agregar propiedad de la secuencia de comandos**.
2. Propiedad: `ADMIN_PASSWORD_PLAIN`. Valor: la contraseña que quieres para el panel
   (mínimo 8 caracteres; mejor una frase larga). Pulsa **Guardar propiedades de la
   secuencia de comandos**.

La contraseña no se queda guardada tal cual: el siguiente paso la convierte en una
huella cifrada y **borra** esta propiedad.

## 4. Ejecutar `setup` y dar permisos

1. En el editor, arriba, elige la función **setup** en el menú desplegable y pulsa
   **Ejecutar**.
2. Aparece **Autorización necesaria** → **Revisar permisos** → elige tu cuenta.
3. Google muestra "**Google no ha verificado esta app**". Es normal: el programa es
   tuyo y no está publicado. Pulsa **Avanzado → Ir a Baristop web (no seguro)**.
4. Revisa los permisos y pulsa **Permitir**. Se piden:
   - *Ver y editar esta hoja* — leer y guardar el contenido.
   - *Ver, editar, crear y borrar tus archivos de Google Drive* — crear la carpeta de
     imágenes y subir fotos. Se pide "Drive completo" y no solo "archivos creados por
     la app" porque tú también puedes arrastrar fotos a esa carpeta a mano.
   - *Enviar correos como tú* — mandar las cotizaciones.
   - *Conectarse a un servicio externo* — requerido por el tipo de aplicación web.
5. Cuando termine, abre **Registro de ejecución** (abajo). Debe decir
   `setup() terminó` y listar lo que creó, incluida la línea
   *Contraseña del panel guardada (cifrada)*.
6. **Verifica:**
   - La hoja ahora tiene pestañas: Ajustes, Redes, Sucursales, Portada,
     CategoriasMaquinaria, Maquinas, Insumos, Recetas, Alianzas, Anuncios, Promos y
     Cotizaciones, con los datos iniciales.
   - En <https://drive.google.com> existe la carpeta **Baristop web — imágenes**.
   - En Configuración del proyecto ya no aparece `ADMIN_PASSWORD_PLAIN`; ahora hay
     `ADMIN_PASSWORD_SHA256`.

`setup` se puede volver a ejecutar sin riesgo: no borra ni duplica nada.

## 5. Publicar como aplicación web

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. Junto a "Seleccionar tipo" pulsa el engrane y elige **Aplicación web**.
3. Descripción: `Baristop web v1`.
4. **Ejecutar como:** *Yo* (tu correo). **Quién tiene acceso:** *Cualquier usuario*.
5. Pulsa **Implementar** (autoriza de nuevo si lo pide).
6. Copia la **URL de la aplicación web**. Termina en `/exec`. Guárdala: la necesitas
   en el paso siguiente.

> Es "Cualquier usuario" porque el sitio público debe poder leer el contenido y enviar
> cotizaciones sin iniciar sesión. Lo privado (editar, subir imágenes) exige la
> contraseña del panel.

## 6. Conectar el sitio

1. Abre el archivo `baristop-v2/config.js` del sitio.
2. Pega la URL entre las comillas:

   ```js
   window.BARISTOP_CONFIG = { apiUrl: "https://script.google.com/macros/s/XXXXXXXX/exec" };
   ```
3. Sube el cambio (o avisa a quien mantiene el sitio). Con `apiUrl` vacío el sitio
   funciona en **modo demostración**, sin conexión a Google.

## 7. Probar

1. **Contenido público:** abre en el navegador `<URL>?action=getContent`. Debe
   mostrar un texto JSON que empieza con `{"ok":true,"data":{...`. Comprueba que
   **no** aparezcan `roseta.cafeteria@gmail.com` ni las llaves `quoteRecipients` con
   correos: esos datos solo se entregan al panel. (La primera vez puede tardar unos
   segundos: es el arranque del script.)
2. **Panel:** entra a `/baristop-v2/admin`, escribe la contraseña del paso 3, cambia
   un texto, pulsa **Guardar cambios** y revisa en la hoja que se actualizó.
3. **Correo:** en el editor de Apps Script ejecuta la función **testQuote**. Llega un
   correo de prueba, con asunto `[BARISTOP AGS] Prueba de cotización (Baristop web)`, a
   los destinatarios de Aguascalientes más Silvia, y aparece una fila en la pestaña
   **Cotizaciones**.
4. **Formulario real:** envía una cotización desde el sitio, una por sucursal.
   Revisa que el asunto lleve `[BARISTOP AGS]` o `[BARISTOP DGO]`, que Responder
   llegue al correo del cliente y que Silvia reciba copia.

## 8. Operación diaria

### Quién recibe las cotizaciones

- **Por sucursal:** pestaña *Sucursales* del panel (o de la hoja), columna
  **Correos cotización**. No se publican en el sitio.
- **Siempre (las dos sucursales):** *Textos → Correos de cotización*, campo
  `quoteAlwaysTo`. Es obligatorio: no se puede dejar vacío.
- **Respaldo:** `quoteFallbackTo`, solo se usa si una sucursal se queda sin
  destinatarios.
- **Etiqueta del asunto:** columna **Etiqueta asunto** de cada sucursal, por ejemplo
  `[BARISTOP AGS]`.

### Cambiar la contraseña

1. Configuración del proyecto → Propiedades → agrega `ADMIN_PASSWORD_PLAIN` con la
   contraseña nueva.
2. Ejecuta la función **setAdminPasswordFromProperty**.
3. Se cierran todas las sesiones abiertas del panel y la propiedad se borra sola.

Para cerrar todas las sesiones sin cambiar la contraseña: ejecuta **rotateTokenSecret**.

### Cambiar el código y volver a publicar

Cuando haya una versión nueva de `Code.gs`, `Shared.js` o `DefaultContent.js`: pega el
contenido nuevo y guarda. Luego **Implementar → Administrar implementaciones →** el
lápiz de tu implementación **→ Versión: Nueva versión → Implementar**. La URL **no
cambia**; si creas una "Nueva implementación" sí cambiaría y habría que actualizar
`config.js`.

Si agregaste columnas nuevas a una hoja ya existente, ejecuta **setup** otra vez: agrega
al final las columnas que falten sin tocar tus datos.

### Editar a mano en la hoja

Se puede, pero con cuidado:

- No cambies el texto de la **fila 1** (encabezados); sí puedes mover columnas.
- Cada fila necesita un **ID** único (minúsculas, números y guiones, por ejemplo
  `cafeteras`). Nunca lo cambies después: las máquinas lo usan para ligarse a su
  categoría.
- Las direcciones web deben empezar con `https://`. Si no, el sitio las ignora.
- Los correos y los horarios se escriben separados por comas o por saltos de línea
  (`Alt + Enter` dentro de la celda).
- Los cambios hechos directo en la hoja tardan hasta 5 minutos en verse en el sitio
  (caché). Para verlos al instante ejecuta **clearCache**.

### Vaciar la carpeta de imágenes

Las fotos reemplazadas no se borran, por si quieres recuperarlas. Para limpiar: abre la
carpeta **Baristop web — imágenes** en Drive, selecciona las fotos viejas que ya no se
usan y bórralas. **Antes** confirma en el panel que ninguna sección las use; una foto
borrada dejaría un recuadro vacío en el sitio.

### Mudar todo a otra cuenta o dominio

1. En la hoja: **Archivo → Hacer una copia**. La copia lleva el código incluido
   (el script está ligado a la hoja).
2. En la copia, repite los pasos 3 a 6 (propiedad de contraseña, `setup`, nueva
   implementación y nueva URL en `config.js`). `setup` crea una carpeta de imágenes nueva.
3. Las imágenes que ya estaban subidas siguen funcionando mientras no borres la carpeta
   original; para independizarte, vuelve a subirlas desde el panel.

---

## 9. Límites y avisos (en lenguaje llano)

- **Unas 50 cotizaciones al día.** Gmail permite enviar a 100 *destinatarios* por día
  y cada cotización va a 2 correos (la sucursal y Silvia). Con 3 destinatarios por
  cotización son unas 33. Pasado el límite, el sitio muestra un aviso para escribir
  por WhatsApp y la solicitud queda anotada en la pestaña **Cotizaciones** con el
  error, así que no se pierde. Puedes ver cuánto queda ejecutando **testQuote**: el
  registro dice la cuota restante. Una cuenta de Google Workspace sube el límite a
  1,500 al día.
- **Caché de hasta 5 minutos (en el mejor de los casos).** El sitio guarda el
  contenido unos minutos para ser rápido. Un cambio guardado en el panel puede tardar
  hasta 5 minutos en verse para los visitantes; a veces menos, porque Google puede
  vaciar la caché antes. El enlace **Vista previa** del panel salta la caché del
  navegador.
- **Bloqueo por intentos de contraseña.** Después de 6 contraseñas incorrectas desde
  un mismo navegador, ese navegador espera 15 minutos. Si entre todos suman 60 intentos
  fallidos en 15 minutos (por ejemplo, alguien probando contraseñas desde fuera), el
  panel se bloquea **para todos durante 15 minutos**. Qué hacer: **esperar 15 minutos
  y volver a intentar. No cambies nada.** Los contadores son aproximados: frenan
  descuidos y abusos baratos, no a un atacante decidido; por eso la contraseña debe ser
  larga.
- **Arranque lento.** Si nadie ha usado el panel en un rato, la primera carga puede
  tardar entre 5 y 10 segundos mientras Google "despierta" el script. El panel espera
  hasta 25 segundos y ofrece **Reintentar**. El sitio público no se detiene: pinta de
  inmediato con la última copia guardada.
- **Imágenes.** Pesan poco porque el panel las reduce antes de subirlas. El servidor
  rechaza archivos de más del 120 % del peso indicado para cada campo y solo acepta
  JPG, PNG, WebP (y SVG en logos).
- **Registro de cotizaciones.** La pestaña **Cotizaciones** guarda cada solicitud con
  fecha, destinatarios y estatus. Nunca se muestra en el sitio ni en el panel. No la
  borres si quieres tener historial.
- **Cuenta dueña.** Si la cuenta que instaló el script se suspende o se elimina, deja
  de funcionar todo. Haz una copia de la hoja de vez en cuando
  (**Archivo → Hacer una copia**).

## 10. Solución de problemas

| Síntoma | Qué revisar |
|---|---|
| El panel dice "El panel no está configurado todavía." | Falta `ADMIN_PASSWORD_SHA256`. Agrega `ADMIN_PASSWORD_PLAIN` y ejecuta `setup`. |
| "Demasiados intentos…" | Espera 15 minutos. No cambies nada. |
| "Tu sesión expiró" | Las sesiones duran 12 horas. Vuelve a entrar. |
| `Falta la columna "X" en la pestaña Y` | Alguien renombró o borró un encabezado. Escríbelo otra vez tal cual o ejecuta `setup`. |
| Un cambio en la hoja no aparece en el sitio | Espera 5 minutos o ejecuta `clearCache`. |
| El formulario dice "El formulario aún no tiene destinatarios" | Revisa `quoteAlwaysTo` y *Correos cotización* de la sucursal. |
| No llegan correos | Revisa spam, la pestaña **Cotizaciones** (columna *Estatus envío*) y **Ver → Ejecuciones** en el editor de Apps Script. |
| Cambié el código y no se nota | Falta publicar una **Nueva versión** (sección 8). |

---

# Vista previa privada en Vercel (solo para el equipo de ACACIA)

Mientras el cliente revisa, el sitio nuevo vive en `acaciaco.com.mx/baristop-v2`
detrás de una contraseña. El filtro es `middleware.js` en la raíz del repositorio;
solo afecta a `/baristop-v2` (el `/baristop` actual y el resto del sitio no cambian).

1. Elige la contraseña temporal y calcula su huella:

   ```bash
   printf '%s' 'la-contraseña' | shasum -a 256
   ```
2. En Vercel → proyecto → **Settings → Environment Variables**, agrega
   `BARISTOP_PREVIEW_HASH` con esa huella (64 caracteres) en **Production y Preview**.
   Haz **Redeploy**: una variable nueva no llega a un despliegue ya construido.
3. Abre `/baristop-v2` en una ventana privada: debe verse la página de acceso. Con la
   contraseña correcta, se ve el sitio durante 14 días en ese navegador.
4. Sin la variable (o mal escrita) el filtro **falla cerrado**: responde 503
   "Vista previa no disponible." y nunca muestra el sitio.
5. Para cerrar la sesión: `/baristop-v2/__preview/logout`.
6. Después del primer despliegue, revisa en Vercel → **Usage** que las invocaciones
   de Routing Middleware queden dentro del plan (para una vista previa con contraseña se
   espera que sí).

Al promover v2 a `/baristop` (o mudarlo al dominio del cliente) se borran
`middleware.js`, `lib/preview-gate.mjs`, la dependencia `@vercel/functions` y la
variable `BARISTOP_PREVIEW_HASH`.
