/* Baristop admin — section definitions, Spanish copy and client-side validation.
 * The validation mirrors Shared.validateSection on the server (design spec §4.3, §5.4). */
(function () {
  "use strict";

  /* ---------- shared validators (same rules as js/schema.js and Apps Script) ---------- */
  function isEmail(s) {
    return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }
  function normalizeDigits(s) {
    return String(s == null ? "" : s).replace(/\D+/g, "");
  }
  function isSafeHttpsUrl(s) {
    if (typeof s !== "string") return false;
    if (!/^https:\/\/[^\s\/$.?#].[^\s]*$/.test(s)) return false;
    try { return new URL(s).protocol === "https:"; } catch (e) { return false; }
  }

  var MSG = {
    required: "Este campo es obligatorio.",
    email: "Escribe un correo válido, por ejemplo nombre@dominio.com.",
    url: "Escribe la dirección completa, empezando con https://",
    digits: "Escribe de 10 a 15 dígitos, sin espacios ni guiones.",
    date: "Elige una fecha válida.",
    dateOrder: "La fecha \"Hasta\" no puede ser anterior a \"Desde\".",
    quoteAlways: "Silvia debe recibir todas las solicitudes: escribe al menos un correo válido.",
    tag: "Escribe una etiqueta de 1 a 24 caracteres, por ejemplo [BARISTOP AGS].",
    recipe: "Agrega una foto o el enlace de un video.",
    heroMax: "La portada admite máximo 4 imágenes."
  };

  /* ---------- image specs (design spec §2.15) ---------- */
  var IMAGE_SPECS = {
    "heroImages.image": { w: 1200, h: 900, maxKB: 300, keepAlpha: false, allowSvg: false, placeholder: "hero-4x3.svg",
      help: "Puedes subir la foto tal cual sale de tu teléfono (hasta 12 MB); la ajustamos automáticamente a 1200 × 900 px. Foto horizontal. Formatos: JPG o WebP. Se muestra en la franja bajo el menú." },
    "branches.photo": { w: 1200, h: 800, maxKB: 400, keepAlpha: false, allowSvg: false, placeholder: "branch-3x2.svg",
      help: "Puedes subir la foto tal cual sale de tu teléfono (hasta 12 MB); la ajustamos automáticamente a 1200 × 800 px. Foto de la sucursal. Formatos: JPG o WebP." },
    "machineryCategories.image": { w: 1200, h: 800, maxKB: 400, keepAlpha: false, allowSvg: false, placeholder: "category-3x2.svg",
      help: "Puedes subir la foto tal cual sale de tu teléfono (hasta 12 MB); la ajustamos automáticamente a 1200 × 800 px. Foto representativa de la categoría. Formatos: JPG o WebP." },
    "machines.image": { w: 1200, h: 900, maxKB: 400, keepAlpha: true, allowSvg: false, placeholder: "machine-4x3.svg",
      help: "Puedes subir la foto tal cual sale de tu teléfono (hasta 12 MB); la ajustamos automáticamente a 1200 × 900 px. Foto del equipo sobre fondo claro. Formatos: JPG, WebP o PNG." },
    "insumos.image": { w: 1200, h: 1500, maxKB: 500, keepAlpha: false, allowSvg: false, placeholder: "insumo-4x5.svg",
      help: "Puedes subir la foto tal cual sale de tu teléfono (hasta 12 MB); la ajustamos automáticamente a 1200 × 1500 px. Imagen vertical del producto. Formatos: JPG o WebP." },
    "recipes.photo": { w: 1080, h: 1350, maxKB: 500, keepAlpha: false, allowSvg: false, placeholder: "recipe-4x5.svg",
      help: "Puedes subir la foto tal cual sale de tu teléfono (hasta 12 MB); la ajustamos automáticamente a 1080 × 1350 px. Foto vertical de la bebida. Formatos: JPG o WebP." },
    "alliances.logo": { w: 600, h: 300, maxKB: 150, keepAlpha: true, allowSvg: true, placeholder: "logo-2x1.svg",
      help: "Puedes subir la foto tal cual sale de tu teléfono (hasta 12 MB); la ajustamos automáticamente a 600 × 300 px. Logo con fondo transparente. Formatos: PNG o SVG." },
    "categories.image": { w: 1200, h: 800, maxKB: 400, keepAlpha: false, allowSvg: false, placeholder: "category-3x2.svg",
      help: "Foto representativa de la línea, 1200 × 800 px, JPG o WebP, máx. 400 KB. Se ve en el menú y en las tarjetas." },
    "products.photos": { w: 1200, h: 1200, maxKB: 400, keepAlpha: true, allowSvg: false, placeholder: "product-1x1.svg",
      help: "Fotos cuadradas del producto sobre fondo claro, 1200 × 1200 px, JPG, WebP o PNG, máx. 400 KB cada una. La primera es la principal; hasta 6." },
    "variants.image": { w: 1200, h: 1200, maxKB: 400, keepAlpha: true, allowSvg: false, placeholder: "product-1x1.svg",
      help: "Opcional: foto de esta presentación o sabor, 1200 × 1200 px. Si la dejas vacía se usan las fotos del producto." },
    "promos.image": { w: 1200, h: 675, maxKB: 350, keepAlpha: false, allowSvg: false, placeholder: "promo-16x9.svg",
      help: "Puedes subir la foto tal cual sale de tu teléfono (hasta 12 MB); la ajustamos automáticamente a 1200 × 675 px. Imagen horizontal. Formatos: JPG o WebP." }
  };

  /* ---------- Textos (Ajustes) fields, grouped by page section ---------- */
  function t(key, label, o) { o = o || {}; return { key: key, label: label, long: !!o.long, help: o.help || "", type: o.type || "text" }; }

  var QUOTE_GROUP = "Correos de cotización";

  var SITE_GROUPS = [
    { title: "Menú y botón principal", fields: [
      t("navCta", "Texto del botón principal", { help: "Aparece en el menú y en la portada." }),
      t("navCtaShort", "Texto corto del botón (pantallas medianas)", { help: "Se usa en lugar del texto principal cuando el menú se queda sin espacio." }),
      t("navGroupMachinery", "Menú: nombre del grupo de maquinaria", { help: "Por ejemplo Maquinaria." }),
      t("navGroupSupplies", "Menú: nombre del grupo de insumos", { help: "Por ejemplo Insumos." })
    ] },
    { title: "Portada", fields: [
      t("heroEyebrow", "Frase pequeña (en tinto)"),
      t("heroTitle", "Título (primera parte)"),
      t("heroTitleAccent", "Título (parte en cursiva dorada)"),
      t("heroSubtitle", "Subtítulo", { long: true }),
      t("heroStandout", "Frase destacada"),
      t("heroSecondaryCta", "Texto del botón secundario"),
      t("heroTrustHours", "Línea de horarios", { help: "Resumen corto de horarios. El detalle por sucursal se edita en Sucursales." })
    ] },
    { title: "Franja de datos (4 puntos)", fields: [
      t("strip1Title", "Punto 1 — título"), t("strip1Text", "Punto 1 — texto"),
      t("strip2Title", "Punto 2 — título"), t("strip2Text", "Punto 2 — texto"),
      t("strip3Title", "Punto 3 — título"), t("strip3Text", "Punto 3 — texto"),
      t("strip4Title", "Punto 4 — título"), t("strip4Text", "Punto 4 — texto")
    ] },
    { title: "Qué ofrecemos", fields: [
      t("offerTitle", "Título de la sección"),
      t("offerIntro", "Introducción", { long: true }),
      t("offerMachineryTitle", "Maquinaria — título"),
      t("offerMachineryText", "Maquinaria — texto", { long: true }),
      t("offerSuppliesTitle", "Insumos — título"),
      t("offerSuppliesText", "Insumos — texto", { long: true })
    ] },
    { title: "Catálogo", fields: [
      t("catalogTitle", "Título de la sección"),
      t("catalogIntro", "Introducción", { long: true }),
      t("catalogIndexTitle", "Página del catálogo — título"),
      t("catalogIndexIntro", "Página del catálogo — introducción", { long: true, help: "Déjalo vacío para no mostrarlo." }),
      t("groupMachineryIntro", "Página de maquinaria — introducción", { long: true, help: "Déjalo vacío para no mostrarlo." }),
      t("groupSuppliesIntro", "Página de insumos — introducción", { long: true, help: "Déjalo vacío para no mostrarlo." }),
      t("featuredTitle", "Productos destacados — título"),
      t("featuredIntro", "Productos destacados — introducción", { long: true, help: "Déjalo vacío para no mostrarlo." }),
      t("variantLabel", "Nombre del selector de presentaciones", { help: "Por ejemplo Presentación, Sabor o Modelo." }),
      t("priceNote", "Nota debajo de los precios", { long: true, help: "Por ejemplo si los precios incluyen IVA y cuánto duran." }),
      t("priceToQuoteNote", "Nota cuando no hay precio", { long: true }),
      t("availabilityNote", "Nota debajo de las existencias", { long: true, help: "Déjalo vacío para no mostrarla." }),
      t("catalogEmptyCategory", "Mensaje de una línea sin productos", { long: true })
    ] },
    { title: "Por qué Baristop", fields: [
      t("whyTitle", "Título de la sección"),
      t("whyIntro", "Introducción", { long: true }),
      t("why1Title", "Tarjeta 1 — título"), t("why1Text", "Tarjeta 1 — texto", { long: true }),
      t("why2Title", "Tarjeta 2 — título"), t("why2Text", "Tarjeta 2 — texto", { long: true }),
      t("why3Title", "Tarjeta 3 — título"), t("why3Text", "Tarjeta 3 — texto", { long: true }),
      t("why4Title", "Tarjeta 4 — título"), t("why4Text", "Tarjeta 4 — texto", { long: true })
    ] },
    { title: "Cómo trabajamos", fields: [
      t("processTitle", "Título de la sección"),
      t("step1Title", "Paso 1 — título"), t("step1Text", "Paso 1 — texto", { long: true }),
      t("step2Title", "Paso 2 — título"), t("step2Text", "Paso 2 — texto", { long: true }),
      t("step3Title", "Paso 3 — título"), t("step3Text", "Paso 3 — texto", { long: true })
    ] },
    { title: "Recetas (textos de la sección)", fields: [
      t("recipesTitle", "Título de la sección"),
      t("recipesIntro", "Introducción", { long: true }),
      t("recipesEmpty", "Mensaje cuando no hay recetas visibles")
    ] },
    { title: "Baristop en tu ciudad (franquicias)", fields: [
      t("franchiseTitle", "Título"),
      t("franchiseText", "Texto", { long: true }),
      t("franchiseCta", "Texto del botón"),
      t("franchiseWhatsapp", "WhatsApp para franquicias", { type: "digits", help: "Solo números, con 52 al inicio. Por ejemplo 524491784526." })
    ] },
    { title: "Cotiza (textos del formulario)", fields: [
      t("quoteTitle", "Título"),
      t("quoteIntro", "Introducción", { long: true }),
      t("quoteSuccess", "Mensaje al enviar la solicitud", { long: true }),
      t("quoteListTitle", "Mi cotización — título"),
      t("quoteListIntro", "Mi cotización — introducción", { long: true, help: "Déjalo vacío para no mostrarla." }),
      t("quoteListSuccess", "Mi cotización — mensaje al enviar la lista", { long: true })
    ] },
    { title: QUOTE_GROUP, help:
      "Estos correos reciben una copia de todas las solicitudes de cotización, de las dos sucursales. No puede quedar vacío. Separa varios correos con comas. Los correos de cada sucursal se editan en Sucursales.",
      fields: [
        t("quoteAlwaysTo", "Reciben todas las solicitudes (obligatorio)", { type: "emails", help: "Separa varios correos con comas." }),
        t("quoteFallbackTo", "Respaldo si una sucursal no tiene correos", { type: "emails", help: "Se usa solo cuando una sucursal se queda sin destinatarios. Separa varios correos con comas." })
      ] },
    { title: "Alianzas y pie de página", fields: [
      t("alliancesTitle", "Alianzas — título"),
      t("alliancesIntro", "Alianzas — introducción"),
      t("footerTagline", "Pie de página — descripción", { long: true }),
      t("legalName", "Nombre legal (pie de página)")
    ] }
  ];

  /* ---------- list-section field definitions ---------- */
  function f(key, label, type, o) {
    o = o || {};
    return { key: key, label: label, type: type || "text", required: !!o.required, help: o.help || "",
      placeholder: o.placeholder || "", max: o.max || 0, ph: o.ph || "", options: o.options || null };
  }

  var HOURS_HELP = "Una línea por horario";
  var SUBJECT_HELP = "Va al inicio del asunto de cada correo de cotización de esta sucursal, por ejemplo [BARISTOP AGS].";

  var DEFS = {
    social: {
      content: "social", idPrefix: "social", noun: "red social", addLabel: "+ Agregar red",
      title: function (it) { return it.name || "Sin nombre"; },
      subtitle: function (it) { return it.handle || it.url || ""; },
      fields: [
        f("name", "Nombre", "text", { required: true, help: "Instagram, Facebook o TikTok: el icono se elige por el nombre." }),
        f("handle", "Usuario o nombre visible", "text", { help: "Por ejemplo @baristop_distribuidora." }),
        f("url", "Enlace", "url", { help: "Dirección completa, empezando con https://" })
      ]
    },
    branches: {
      content: "branches", idPrefix: "branches", noun: "sucursal", addLabel: "+ Agregar sucursal",
      title: function (it) { return it.name || "Sin nombre"; },
      subtitle: function (it) { return it.address || ""; },
      imageKey: "photo", imageSpec: "branches.photo",
      fields: [
        f("name", "Nombre de la sucursal", "text", { required: true, help: "Por ejemplo Aguascalientes." }),
        f("whatsapp", "WhatsApp", "digits", { required: true, help: "Solo números, con 52 al inicio. Por ejemplo 524491784526." }),
        f("phone", "Teléfono", "digits", { help: "Solo números, sin espacios. Por ejemplo 4491784526." }),
        f("quoteRecipients", "Quién recibe las cotizaciones de esta sucursal", "recipients", { help: "Correos internos que reciben las solicitudes de esta sucursal. No se publican." }),
        f("subjectTag", "Etiqueta del asunto del correo", "text", { required: true, max: 24, help: SUBJECT_HELP, ph: "[BARISTOP AGS]" }),
        f("address", "Dirección", "textarea", { help: "Escribe \"Por definir\" si todavía no la tienes." }),
        f("mapUrl", "Enlace del mapa (opcional)", "url", { help: "Enlace de Google Maps, empezando con https://" }),
        f("emails", "Correos que se muestran en el sitio", "emails", { help: "Se publican en el sitio. Puedes escribir \"Por definir\" mientras no haya correo." }),
        f("hours", "Horarios", "linesArray", { help: HOURS_HELP }),
        f("photo", "Foto de la sucursal", "image")
      ]
    },
    heroImages: {
      content: "heroImages", idPrefix: "heroimages", noun: "imagen de portada", addLabel: "+ Agregar imagen", maxRows: 4,
      title: function (it) { return it.title || "Sin título"; },
      subtitle: function (it) { return it.alt || ""; },
      imageKey: "image", imageSpec: "heroImages.image",
      fields: [
        f("title", "Título (se muestra sobre la foto)", "text", { required: true, help: "Por ejemplo Maquinaria, Salsas, Jarabes o Polvos." }),
        f("image", "Imagen", "image"),
        f("alt", "Descripción de la imagen", "text", { help: "Para personas que no ven la imagen. Por ejemplo \"Cafetera espresso en una barra\"." })
      ]
    },
    categories: {
      content: "categories", idPrefix: "lineas", noun: "línea", addLabel: "+ Agregar línea", idFromName: true,
      title: function (it) { return it.name || "Sin nombre"; },
      subtitle: function (it) { return it.tagline || ""; },
      imageKey: "image", imageSpec: "categories.image",
      emptyText: "Todavía no hay líneas. Usa \"+ Agregar línea\" para crear la primera (por ejemplo Molinos o Jarabes).",
      fields: [
        f("group", "Grupo", "select", { required: true, help: "Define en qué parte del menú aparece la línea.",
          options: [{ value: "maquinaria", label: "Maquinaria" }, { value: "insumos", label: "Insumos" }] }),
        f("name", "Nombre", "text", { required: true, max: 60, ph: "Molinos" }),
        f("tagline", "Subtítulo", "text", { help: "Texto corto debajo del nombre." }),
        f("description", "Descripción", "textarea"),
        f("image", "Imagen", "image")
      ]
    },
    machineryCategories: {
      content: "machineryCategories", idPrefix: "categorias", noun: "categoría", addLabel: "+ Agregar categoría",
      title: function (it) { return it.name || "Sin nombre"; },
      subtitle: function (it) { return it.tagline || ""; },
      imageKey: "image", imageSpec: "machineryCategories.image",
      fields: [
        f("name", "Nombre", "text", { required: true }),
        f("tagline", "Subtítulo", "text", { help: "Texto corto debajo del nombre." }),
        f("description", "Descripción", "textarea"),
        f("image", "Imagen", "image")
      ]
    },
    machines: {
      content: "machines", idPrefix: "maquinas", noun: "equipo", addLabel: "+ Agregar equipo",
      title: function (it) { return it.name || "Sin nombre"; },
      subtitle: function (it) { return it.description || ""; },
      imageKey: "image", imageSpec: "machines.image",
      fields: [
        f("categoryId", "Categoría", "category", { required: true }),
        f("name", "Nombre del equipo", "text", { required: true }),
        f("description", "Descripción", "textarea"),
        f("specs", "Especificaciones", "lines", { help: "Una especificación por línea. Por ejemplo: Dos grupos · Caldera de 11 litros." }),
        f("image", "Imagen", "image")
      ]
    },
    insumos: {
      content: "insumos", idPrefix: "insumos", noun: "insumo", addLabel: "+ Agregar insumo",
      title: function (it) { return it.name || "Sin nombre"; },
      subtitle: function (it) { return it.tagline || ""; },
      imageKey: "image", imageSpec: "insumos.image",
      fields: [
        f("name", "Nombre", "text", { required: true }),
        f("tagline", "Texto corto", "text", { help: "Va debajo del nombre." }),
        f("description", "Descripción", "textarea", { help: "Se muestra completa en la tarjeta." }),
        f("image", "Imagen", "image")
      ]
    },
    recipes: {
      emptyText: "Sin recetas. Sube una foto o pega un video para mostrar qué pueden preparar tus clientes.",
      content: "recipes", idPrefix: "recipes", noun: "receta", addLabel: "+ Agregar receta",
      title: function (it) { return it.title || "Sin título"; },
      subtitle: function (it) { return it.videoUrl ? "Con video" : (it.description || ""); },
      imageKey: "photo", imageSpec: "recipes.photo",
      fields: [
        f("title", "Nombre de la receta", "text", { required: true }),
        f("description", "Descripción corta", "textarea"),
        f("photo", "Foto", "image"),
        f("videoUrl", "Enlace del video (opcional)", "url", { help: "YouTube, Instagram o TikTok, empezando con https://. Necesitas una foto, un video o ambos." })
      ]
    },
    alliances: {
      content: "alliances", idPrefix: "alianzas", noun: "alianza", addLabel: "+ Agregar alianza",
      title: function (it) { return it.name || "Sin nombre"; },
      subtitle: function (it) { return it.url || ""; },
      imageKey: "logo", imageSpec: "alliances.logo",
      fields: [
        f("name", "Nombre de la marca", "text", { required: true }),
        f("logo", "Logo", "image"),
        f("url", "Sitio web (opcional)", "url", { help: "Si lo llenas, el logo abre este enlace. Debe empezar con https://" })
      ]
    },
    announcements: {
      emptyText: "Sin anuncios. Agrega uno para mostrar una línea arriba del menú (por ejemplo, cierre por inventario). Si no hay ninguno, no se muestra nada.",
      content: "announcements", idPrefix: "anuncios", noun: "anuncio", addLabel: "+ Agregar anuncio",
      title: function (it) { return it.text || "Sin texto"; },
      subtitle: function (it) { return dateRangeLabel(it); },
      fields: [
        f("text", "Texto del anuncio", "text", { required: true, help: "Una sola línea, corta." }),
        f("url", "Enlace (opcional)", "url", { help: "Si lo llenas, el texto abre este enlace. Debe empezar con https://" }),
        f("startsAt", "Desde (opcional)", "date", { help: "Primer día en que se muestra." }),
        f("endsAt", "Hasta (opcional)", "date", { help: "Último día en que se muestra." })
      ]
    },
    promos: {
      emptyText: "Sin promociones. Agrega una con imagen, texto y fechas; se ocultará sola al vencer.",
      content: "promos", idPrefix: "promos", noun: "promoción", addLabel: "+ Agregar promoción",
      title: function (it) { return it.title || "Sin título"; },
      subtitle: function (it) { return dateRangeLabel(it) || it.text || ""; },
      imageKey: "image", imageSpec: "promos.image",
      fields: [
        f("title", "Título", "text", { required: true }),
        f("text", "Texto", "textarea"),
        f("image", "Imagen", "image"),
        f("ctaLabel", "Texto del botón (opcional)", "text"),
        f("ctaUrl", "Enlace del botón (opcional)", "url", { help: "Debe empezar con https://" }),
        f("startsAt", "Desde (opcional)", "date", { help: "Primer día en que se muestra." }),
        f("endsAt", "Hasta (opcional)", "date", { help: "Último día en que se muestra." })
      ]
    }
  };

  function dateRangeLabel(it) {
    var a = it.startsAt || "";
    var b = it.endsAt || "";
    if (a && b) return "Del " + a + " al " + b;
    if (a) return "Desde " + a;
    if (b) return "Hasta " + b;
    return "";
  }

  /* ---------- sections in sidebar order (design spec §4.2) ---------- */
  var SPEC_OF = IMAGE_SPECS;
  // Short help-box lines: the images are resized automatically, so no hard requirements here.
  var SPEC_SHORT = {
    "heroImages.image": "foto horizontal; la ajustamos a 1200 × 900 px. Se muestra bajo el menú.",
    "branches.photo": "foto horizontal; la ajustamos a 1200 × 800 px.",
    "machineryCategories.image": "foto horizontal; la ajustamos a 1200 × 800 px.",
    "machines.image": "foto horizontal; la ajustamos a 1200 × 900 px.",
    "insumos.image": "foto vertical; la ajustamos a 1200 × 1500 px.",
    "recipes.photo": "foto vertical; la ajustamos a 1080 × 1350 px.",
    "alliances.logo": "logo con fondo transparente; lo ajustamos a 600 × 300 px (PNG o SVG).",
    "promos.image": "foto horizontal; la ajustamos a 1200 × 675 px.",
    "categories.image": "foto representativa de la línea, 1200 × 800 px, JPG o WebP, máx. 400 KB. Se ve en el menú y en las tarjetas.",
    "products.photos": "fotos cuadradas sobre fondo claro, 1200 × 1200 px, JPG, WebP o PNG, máx. 400 KB cada una. La primera es la principal; hasta 6.",
    "variants.image": "opcional, 1200 × 1200 px. Si la dejas vacía se usan las fotos del producto."
  };
  function specLine(key, prefix) {
    var txt = SPEC_SHORT[key];
    return { label: prefix || "", text: prefix ? txt : txt.charAt(0).toUpperCase() + txt.slice(1) };
  }

  var SECTIONS = [
    { id: "site", label: "Textos", kind: "site", contents: ["site"],
      help: "Aquí cambias los textos del sitio. Escribe en español, sin mayúsculas sostenidas. Los cambios se ven al guardar y recargar el sitio (puede tardar hasta 5 minutos por la caché).",
      specs: [] },
    { id: "correos", label: "Correos de cotización", kind: "site", contents: ["site"],
      help: "Aquí eliges quién recibe copia de todas las solicitudes de cotización. Los correos de cada sucursal se editan en Sucursales.",
      specs: [] },
    { id: "heroImages", label: "Portada", kind: "list", contents: ["heroImages"], def: "heroImages",
      help: "Son las 4 fotos que aparecen debajo del menú: maquinaria, salsas, jarabes y polvos. Se muestran en ese orden.",
      helpAfter: "Son exactamente 4 imágenes; para cambiar una, edítala o reemplaza su foto.",
      specs: [specLine("heroImages.image")] },
    { id: "announcements", label: "Anuncios", kind: "list", contents: ["announcements"], def: "announcements",
      help: "Una barra delgada arriba del menú. Se muestra el primero visible dentro de sus fechas. Déjalo sin anuncios para que no aparezca nada.",
      specs: [] },
    { id: "promos", label: "Promos", kind: "list", contents: ["promos"], def: "promos",
      help: "Tarjetas con imagen, texto y botón. Usa \"Desde\" y \"Hasta\" para que se oculten solas. Sin promos visibles, la sección no aparece.",
      specs: [specLine("promos.image")] },
    { id: "catalog", label: "Catálogo", kind: "catalog", contents: ["categories", "products", "variants"],
      help: "Primero las líneas (categorías), luego los productos de cada línea y, dentro de cada producto, sus presentaciones (sabor, tamaño o modelo) con precio y existencias por sucursal. Los productos que dicen \"(ejemplo)\" son de muestra: edítalos o bórralos. Deja el precio vacío para mostrar \"Precio a cotizar\".",
      helpAfter: "Las pestañas antiguas Maquinaria e Insumos de la hoja ya no se usan; el catálogo se edita aquí.",
      specs: [specLine("categories.image", "Línea: "), specLine("products.photos", "Producto: "), specLine("variants.image", "Presentación: ")] },
    { id: "recipes", label: "Recetas", kind: "list", contents: ["recipes"], def: "recipes",
      help: "Sube una foto y/o pega el enlace del video (YouTube, Instagram o TikTok). Las recetas se abren en una pestaña nueva al tocar la tarjeta.",
      specs: [specLine("recipes.photo")] },
    { id: "branches", label: "Sucursales", kind: "list", contents: ["branches"], def: "branches",
      help: "• WhatsApp y teléfono sin espacios, con 52 al inicio para WhatsApp.\n• Los correos de cotización son internos y no se publican; el copiado a todas las solicitudes está en «Correos de cotización».\n• La etiqueta va al inicio del asunto de cada correo, por ejemplo [BARISTOP AGS].",
      specs: [specLine("branches.photo")] },
    { id: "social", label: "Redes", kind: "list", contents: ["social"], def: "social",
      help: "Enlaces a tus redes. El icono se elige por el nombre (Instagram, Facebook, TikTok).",
      specs: [] },
    { id: "alliances", label: "Alianzas", kind: "list", contents: ["alliances"], def: "alliances",
      help: "Logos de las marcas aliadas, en el orden en que aparecen.",
      specs: [specLine("alliances.logo")] }
  ];

  /* ---------- validation ---------- */
  function isYmd(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }

  function splitEmails(str) {
    return String(str || "").split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function isPlaceholderText(s) { return /^por definir$/i.test(String(s).trim()); }

  /* Returns an object { fieldKey: message } for one item. ctx: { categoryIds } */
  function validateItem(contentKey, item, ctx) {
    var def = DEFS[contentKey];
    var errs = {};
    def.fields.forEach(function (fd) {
      var v = item[fd.key];
      var str = typeof v === "string" ? v.trim() : v;
      if (fd.required && fd.type !== "category" && fd.type !== "select" && (str === "" || str == null)) { errs[fd.key] = MSG.required; return; }
      switch (fd.type) {
        case "url":
          if (str && !isSafeHttpsUrl(str)) errs[fd.key] = MSG.url;
          break;
        case "digits":
          if (str) {
            var n = normalizeDigits(str);
            if (n.length < 10 || n.length > 15 || n !== str) errs[fd.key] = MSG.digits;
          }
          break;
        case "emails":
          (v || []).forEach(function (m) {
            if (!isEmail(m) && !isPlaceholderText(m)) errs[fd.key] = MSG.email;
          });
          break;
        case "recipients":
          (v || []).forEach(function (m) { if (!isEmail(m)) errs[fd.key] = MSG.email; });
          break;
        case "date":
          if (str && !isYmd(str)) errs[fd.key] = MSG.date;
          break;
        case "select":
          if (!fd.options.some(function (o) { return o.value === str; })) errs[fd.key] = fd.key === "group" ? "Elige Maquinaria o Insumos." : MSG.required;
          break;
        case "category":
          if (!str || (ctx && ctx.categoryIds && ctx.categoryIds.indexOf(str) === -1)) errs[fd.key] = "Elige una categoría.";
          break;
        default:
          break;
      }
      if (fd.max && typeof str === "string" && str.length > fd.max) errs[fd.key] = fd.key === "subjectTag" ? MSG.tag : "Máximo " + fd.max + " caracteres.";
    });
    if (contentKey === "branches") {
      var tag = (item.subjectTag || "").trim();
      if (!tag || tag.length > 24) errs.subjectTag = tag ? MSG.tag : MSG.required;
    }
    if (contentKey === "recipes" && !(item.photo || "").trim() && !(item.videoUrl || "").trim()) {
      errs.photo = MSG.recipe;
      if (!errs.videoUrl) errs.videoUrl = MSG.recipe;
    }
    if ((contentKey === "announcements" || contentKey === "promos") && item.startsAt && item.endsAt && !errs.startsAt && !errs.endsAt &&
        item.startsAt > item.endsAt) {
      errs.endsAt = MSG.dateOrder;
    }
    return errs;
  }

  /* Whole-section check before saving. Returns [{ row, label, field, message }]. */
  function validateRows(contentKey, rows, ctx) {
    var out = [];
    var def = DEFS[contentKey];
    var seen = {};
    rows.forEach(function (item, idx) {
      var label = def.title(item) + "";
      if (label.length > 40) label = label.slice(0, 40) + "…";
      if (seen[item.id]) out.push({ row: idx, label: label, field: "id", message: "Hay dos elementos con el mismo identificador." });
      seen[item.id] = true;
      var errs = validateItem(contentKey, item, ctx);
      Object.keys(errs).forEach(function (k) {
        var fd = def.fields.filter(function (x) { return x.key === k; })[0];
        out.push({ row: idx, label: label, field: k, fieldLabel: fd ? fd.label : k, message: errs[k] });
      });
    });
    if (def.maxRows && rows.length > def.maxRows) out.push({ row: -1, label: "", field: "", message: MSG.heroMax });
    return out;
  }

  function validateSite(site) {
    var errs = {};
    var always = splitEmails(site.quoteAlwaysTo);
    if (!always.length || !always.every(isEmail)) errs.quoteAlwaysTo = MSG.quoteAlways;
    var fb = splitEmails(site.quoteFallbackTo);
    if (fb.some(function (m) { return !isEmail(m); })) errs.quoteFallbackTo = MSG.email;
    var wa = String(site.franchiseWhatsapp || "").trim();
    if (wa) {
      var n = normalizeDigits(wa);
      if (n.length < 10 || n.length > 15 || n !== wa) errs.franchiseWhatsapp = MSG.digits;
    }
    return errs;
  }

  window.AdminSections = {
    SECTIONS: SECTIONS, DEFS: DEFS, SITE_GROUPS: SITE_GROUPS, QUOTE_GROUP: QUOTE_GROUP, IMAGE_SPECS: IMAGE_SPECS, MSG: MSG,
    isEmail: isEmail, normalizeDigits: normalizeDigits, isSafeHttpsUrl: isSafeHttpsUrl, splitEmails: splitEmails,
    validateItem: validateItem, validateRows: validateRows, validateSite: validateSite
  };
})();
