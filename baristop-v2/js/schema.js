/*
 * Baristop v2 — content schema (spec §2.13, §2.15).
 *
 * UMD-ish: loads as a classic <script> in the browser (window.BaristopSchema)
 * and with require()/default-import in node (module.exports). No imports.
 *
 * This file and apps-script/Shared.js carry the same SCHEMA and byte-identical
 * bodies of isSafeHttpsUrl / isEmail / normalizeDigits; a test keeps them in
 * sync. Do not reformat the three helper functions without changing both.
 */

function isSafeHttpsUrl(s) {
  if (typeof s !== "string") return false;
  if (!/^https:\/\/[^\s\/$.?#].[^\s]*$/.test(s)) return false;
  if (typeof URL === "function") {
    try {
      return new URL(s).protocol === "https:";
    } catch (e) {
      return false;
    }
  }
  return true;
}

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function normalizeDigits(s) {
  return String(s == null ? "" : s).replace(/\D+/g, "");
}

var SECTION_NAMES = [
  "site",
  "social",
  "branches",
  "heroImages",
  "machineryCategories",
  "machines",
  "insumos",
  "recipes",
  "alliances",
  "announcements",
  "promos"
];

// Shared leading columns of every list section.
var BASE_FIELDS = [
  { key: "id", header: "ID", type: "string", required: true },
  { key: "order", header: "Orden", type: "number", required: true },
  { key: "visible", header: "Visible", type: "boolean", required: true }
];

function listSection(tab, fields, extra) {
  var s = { tab: tab, kind: "list", fields: BASE_FIELDS.concat(fields) };
  if (extra) for (var k in extra) s[k] = extra[k];
  return s;
}

// Field types: string | text (multi-line) | lines (one entry per line) |
// list (comma-separated) | digits | url (https only) | image | date | number | boolean
var SCHEMA = {
  version: 1,
  sections: {
    site: {
      tab: "Ajustes",
      kind: "settings",
      headers: ["Clave", "Valor", "Descripción"]
    },
    social: listSection("Redes", [
      { key: "name", header: "Nombre", type: "string", required: true },
      { key: "handle", header: "Usuario", type: "string" },
      { key: "url", header: "URL", type: "url" }
    ]),
    branches: listSection("Sucursales", [
      { key: "name", header: "Nombre", type: "string", required: true },
      { key: "whatsapp", header: "WhatsApp", type: "digits" },
      { key: "phone", header: "Teléfono", type: "digits" },
      { key: "address", header: "Dirección", type: "text" },
      { key: "mapUrl", header: "Mapa URL", type: "url" },
      { key: "emails", header: "Correos", type: "list" },
      { key: "hours", header: "Horario", type: "lines" },
      { key: "photo", header: "Foto", type: "image" },
      { key: "quoteRecipients", header: "Correos cotización", type: "list", private: true },
      { key: "subjectTag", header: "Etiqueta asunto", type: "string", required: true, max: 24 }
    ]),
    heroImages: listSection(
      "Portada",
      [
        { key: "title", header: "Título", type: "string", required: true },
        { key: "image", header: "Imagen", type: "image" },
        { key: "alt", header: "Alt", type: "string" }
      ],
      { maxRows: 4 }
    ),
    machineryCategories: listSection("CategoriasMaquinaria", [
      { key: "name", header: "Nombre", type: "string", required: true },
      { key: "tagline", header: "Subtítulo", type: "string" },
      { key: "description", header: "Descripción", type: "text" },
      { key: "image", header: "Imagen", type: "image" }
    ]),
    machines: listSection("Maquinas", [
      { key: "categoryId", header: "Categoría", type: "string", required: true },
      { key: "name", header: "Nombre", type: "string", required: true },
      { key: "description", header: "Descripción", type: "text" },
      { key: "specs", header: "Especificaciones", type: "lines" },
      { key: "image", header: "Imagen", type: "image" }
    ]),
    insumos: listSection("Insumos", [
      { key: "name", header: "Nombre", type: "string", required: true },
      { key: "tagline", header: "Subtítulo", type: "string" },
      { key: "description", header: "Descripción", type: "text" },
      { key: "image", header: "Imagen", type: "image" }
    ]),
    recipes: listSection("Recetas", [
      { key: "title", header: "Título", type: "string", required: true },
      { key: "description", header: "Descripción", type: "text" },
      { key: "photo", header: "Foto", type: "image" },
      { key: "videoUrl", header: "Video URL", type: "url" }
    ]),
    alliances: listSection("Alianzas", [
      { key: "name", header: "Nombre", type: "string", required: true },
      { key: "logo", header: "Logo", type: "image" },
      { key: "url", header: "URL", type: "url" }
    ]),
    announcements: listSection("Anuncios", [
      { key: "text", header: "Texto", type: "string", required: true },
      { key: "url", header: "URL", type: "url" },
      { key: "startsAt", header: "Desde", type: "date" },
      { key: "endsAt", header: "Hasta", type: "date" }
    ]),
    promos: listSection("Promos", [
      { key: "title", header: "Título", type: "string", required: true },
      { key: "text", header: "Texto", type: "text" },
      { key: "image", header: "Imagen", type: "image" },
      { key: "ctaLabel", header: "Botón texto", type: "string" },
      { key: "ctaUrl", header: "Botón URL", type: "url" },
      { key: "startsAt", header: "Desde", type: "date" },
      { key: "endsAt", header: "Hasta", type: "date" }
    ])
  },
  // Write-only log tab (spec §5.6). Never returned by any action.
  logs: {
    quotes: {
      tab: "Cotizaciones",
      headers: ["Fecha", "Sucursal", "Nombre", "Negocio", "Contacto", "Qué busca", "Mensaje", "Destinatarios", "Estatus envío"]
    }
  },
  // Keys of the `site` settings object (tab Ajustes), grouped for the admin form.
  // `private` keys are stripped from the public getContent response.
  siteKeys: [
    { key: "navCta", group: "Menú y portada", type: "string", label: "Texto del botón del menú y de la portada" },
    { key: "heroEyebrow", group: "Menú y portada", type: "string", label: "Línea sobre el título (en tinto)" },
    { key: "heroTitle", group: "Menú y portada", type: "string", label: "Título de la portada (antes del acento)" },
    { key: "heroTitleAccent", group: "Menú y portada", type: "string", label: "Título de la portada (parte dorada en cursiva)" },
    { key: "heroSubtitle", group: "Menú y portada", type: "text", label: "Subtítulo de la portada" },
    { key: "heroStandout", group: "Menú y portada", type: "string", label: "Frase destacada" },
    { key: "heroSecondaryCta", group: "Menú y portada", type: "string", label: "Texto del botón secundario" },
    { key: "heroTrustHours", group: "Menú y portada", type: "string", label: "Resumen de horarios (fila de confianza)" },

    { key: "strip1Title", group: "Franja de datos", type: "string", label: "Dato 1: título" },
    { key: "strip1Text", group: "Franja de datos", type: "string", label: "Dato 1: texto" },
    { key: "strip2Title", group: "Franja de datos", type: "string", label: "Dato 2: título" },
    { key: "strip2Text", group: "Franja de datos", type: "string", label: "Dato 2: texto" },
    { key: "strip3Title", group: "Franja de datos", type: "string", label: "Dato 3: título" },
    { key: "strip3Text", group: "Franja de datos", type: "string", label: "Dato 3: texto" },
    { key: "strip4Title", group: "Franja de datos", type: "string", label: "Dato 4: título" },
    { key: "strip4Text", group: "Franja de datos", type: "string", label: "Dato 4: texto" },

    { key: "offerTitle", group: "Qué ofrecemos", type: "string", label: "Título de la sección" },
    { key: "offerIntro", group: "Qué ofrecemos", type: "text", label: "Introducción" },
    { key: "offerMachineryTitle", group: "Qué ofrecemos", type: "string", label: "Tarjeta de maquinaria: título" },
    { key: "offerMachineryText", group: "Qué ofrecemos", type: "text", label: "Tarjeta de maquinaria: texto" },
    { key: "offerSuppliesTitle", group: "Qué ofrecemos", type: "string", label: "Tarjeta de insumos: título" },
    { key: "offerSuppliesText", group: "Qué ofrecemos", type: "text", label: "Tarjeta de insumos: texto" },

    { key: "catalogTitle", group: "Catálogo", type: "string", label: "Título de la sección" },
    { key: "catalogIntro", group: "Catálogo", type: "text", label: "Introducción" },

    { key: "whyTitle", group: "Por qué Baristop", type: "string", label: "Título de la sección" },
    { key: "whyIntro", group: "Por qué Baristop", type: "text", label: "Introducción" },
    { key: "why1Title", group: "Por qué Baristop", type: "string", label: "Motivo 1: título" },
    { key: "why1Text", group: "Por qué Baristop", type: "text", label: "Motivo 1: texto" },
    { key: "why2Title", group: "Por qué Baristop", type: "string", label: "Motivo 2: título" },
    { key: "why2Text", group: "Por qué Baristop", type: "text", label: "Motivo 2: texto" },
    { key: "why3Title", group: "Por qué Baristop", type: "string", label: "Motivo 3: título" },
    { key: "why3Text", group: "Por qué Baristop", type: "text", label: "Motivo 3: texto" },
    { key: "why4Title", group: "Por qué Baristop", type: "string", label: "Motivo 4: título" },
    { key: "why4Text", group: "Por qué Baristop", type: "text", label: "Motivo 4: texto" },

    { key: "processTitle", group: "Cómo trabajamos", type: "string", label: "Título de la sección" },
    { key: "step1Title", group: "Cómo trabajamos", type: "string", label: "Paso 1: título" },
    { key: "step1Text", group: "Cómo trabajamos", type: "text", label: "Paso 1: texto" },
    { key: "step2Title", group: "Cómo trabajamos", type: "string", label: "Paso 2: título" },
    { key: "step2Text", group: "Cómo trabajamos", type: "text", label: "Paso 2: texto" },
    { key: "step3Title", group: "Cómo trabajamos", type: "string", label: "Paso 3: título" },
    { key: "step3Text", group: "Cómo trabajamos", type: "text", label: "Paso 3: texto" },

    { key: "recipesTitle", group: "Recetas", type: "string", label: "Título de la sección" },
    { key: "recipesIntro", group: "Recetas", type: "text", label: "Introducción" },
    { key: "recipesEmpty", group: "Recetas", type: "string", label: "Texto cuando no hay recetas visibles" },

    { key: "franchiseTitle", group: "Franquicias", type: "string", label: "Título" },
    { key: "franchiseText", group: "Franquicias", type: "text", label: "Texto" },
    { key: "franchiseCta", group: "Franquicias", type: "string", label: "Texto del botón" },
    { key: "franchiseWhatsapp", group: "Franquicias", type: "digits", label: "WhatsApp de franquicias (con 52 al inicio, solo números)" },

    { key: "quoteTitle", group: "Cotiza", type: "string", label: "Título de la sección" },
    { key: "quoteIntro", group: "Cotiza", type: "text", label: "Introducción" },
    { key: "quoteSuccess", group: "Cotiza", type: "text", label: "Mensaje al enviar la solicitud" },

    { key: "quoteAlwaysTo", group: "Correos de cotización", type: "list", private: true, required: true, label: "Correos que reciben todas las solicitudes (Silvia)" },
    { key: "quoteFallbackTo", group: "Correos de cotización", type: "list", private: true, label: "Correo de respaldo si una sucursal no tiene destinatarios" },

    { key: "alliancesTitle", group: "Alianzas", type: "string", label: "Título de la sección" },
    { key: "alliancesIntro", group: "Alianzas", type: "text", label: "Introducción" },

    { key: "footerTagline", group: "Pie de página", type: "text", label: "Descripción junto al logo" },
    { key: "legalName", group: "Pie de página", type: "string", label: "Nombre legal (línea de derechos)" }
  ],
  // Image boxes (spec §2.15). w x h is the box the admin resizes into; the site
  // crops with object-fit: cover to the stated aspect.
  images: {
    "heroImages.image": { w: 1200, h: 900, aspect: "4:3", formats: "JPG/WebP", maxKB: 300, keepAlpha: false, help: "Foto horizontal, 1200 × 900 px, JPG o WebP, máx. 300 KB. Se muestra en la franja bajo el menú." },
    "branches.photo": { w: 1200, h: 800, aspect: "3:2", formats: "JPG/WebP", maxKB: 400, keepAlpha: false, help: "Foto de la sucursal, 1200 × 800 px, JPG o WebP, máx. 400 KB." },
    "machineryCategories.image": { w: 1200, h: 800, aspect: "3:2", formats: "JPG/WebP", maxKB: 400, keepAlpha: false, help: "Foto representativa de la categoría, 1200 × 800 px, JPG o WebP, máx. 400 KB." },
    "machines.image": { w: 1200, h: 900, aspect: "4:3", formats: "JPG/WebP/PNG", maxKB: 400, keepAlpha: true, help: "Foto del equipo sobre fondo claro, 1200 × 900 px, JPG, WebP o PNG, máx. 400 KB." },
    "insumos.image": { w: 1200, h: 1500, aspect: "4:5", formats: "JPG/WebP", maxKB: 500, keepAlpha: false, help: "Imagen vertical del producto, 1200 × 1500 px, JPG o WebP, máx. 500 KB." },
    "recipes.photo": { w: 1080, h: 1350, aspect: "4:5", formats: "JPG/WebP", maxKB: 500, keepAlpha: false, help: "Foto vertical de la bebida, 1080 × 1350 px (formato de Instagram), JPG o WebP, máx. 500 KB." },
    "alliances.logo": { w: 600, h: 300, aspect: "2:1", formats: "PNG (transparent) or SVG", maxKB: 150, keepAlpha: true, help: "Logo con fondo transparente, 600 × 300 px, PNG o SVG, máx. 150 KB." },
    "promos.image": { w: 1200, h: 675, aspect: "16:9", formats: "JPG/WebP", maxKB: 350, keepAlpha: false, help: "Imagen horizontal, 1200 × 675 px, JPG o WebP, máx. 350 KB." }
  }
};

if (typeof module === "object" && module.exports) {
  module.exports = {
    SCHEMA: SCHEMA,
    SECTION_NAMES: SECTION_NAMES,
    isSafeHttpsUrl: isSafeHttpsUrl,
    isEmail: isEmail,
    normalizeDigits: normalizeDigits
  };
} else if (typeof window !== "undefined") {
  window.BaristopSchema = {
    SCHEMA: SCHEMA,
    SECTION_NAMES: SECTION_NAMES,
    isSafeHttpsUrl: isSafeHttpsUrl,
    isEmail: isEmail,
    normalizeDigits: normalizeDigits
  };
}
