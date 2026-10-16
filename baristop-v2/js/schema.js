/*
 * Baristop v2 — content schema (spec §2.13, §2.15).
 *
 * UMD-ish: loads as a classic <script> in the browser (window.BaristopSchema)
 * and with require()/default-import in node (module.exports). No imports.
 *
 * This file and apps-script/Shared.js carry the same SCHEMA and byte-identical
 * bodies of isSafeHttpsUrl / isEmail / normalizeDigits / legacyToCatalog /
 * priceSummary / formatMoney / slugify / rootLink; a test keeps them in sync.
 * Do not change those functions without changing both files.
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

var AVAILABILITY_STATES = ["disponible", "pocas", "pedido", "agotado"];
var AVAILABILITY_LABELS = { disponible: "Disponible", pocas: "Pocas piezas", pedido: "Bajo pedido", agotado: "Agotado" };

// Round-1 machinery + insumos (+ machines) -> the three-level catalog (spec 16.7).
// Pure and self-contained: the site uses it as a fallback, setup() as the migration.
function legacyToCatalog(content) {
  var c = content || {};
  var machCats = Array.isArray(c.machineryCategories) ? c.machineryCategories : [];
  var insumos = Array.isArray(c.insumos) ? c.insumos : [];
  var machines = Array.isArray(c.machines) ? c.machines : [];
  var categories = [];
  var products = [];
  var variants = [];
  var seen = {};
  function str(v) { return v == null ? "" : String(v); }
  function pushCategory(src, group, offset) {
    var base = str(src.id);
    var id = base;
    var n = 1;
    while (seen[id]) id = base.slice(0, 33) + "-" + group.slice(0, 3) + (++n);
    seen[id] = true;
    categories.push({
      id: id,
      order: (typeof src.order === "number" ? src.order : 0) + offset,
      visible: src.visible !== false,
      group: group,
      name: str(src.name),
      tagline: str(src.tagline),
      description: str(src.description),
      image: str(src.image)
    });
  }
  for (var i = 0; i < machCats.length; i++) pushCategory(machCats[i], "maquinaria", 0);
  for (var j = 0; j < insumos.length; j++) pushCategory(insumos[j], "insumos", 1000);
  for (var k = 0; k < machines.length; k++) {
    var m = machines[k];
    var pid = str(m.id);
    var lines = Array.isArray(m.specs) ? m.specs : str(m.specs).split(/\r?\n/);
    var specs = [];
    for (var s = 0; s < lines.length && specs.length < 20; s++) {
      var line = str(lines[s]).trim();
      if (line) specs.push(line.slice(0, 160));
    }
    var order = typeof m.order === "number" ? m.order : (k + 1) * 10;
    products.push({
      id: pid,
      order: order,
      visible: m.visible !== false,
      categoryId: str(m.categoryId),
      brand: "",
      name: str(m.name),
      slug: "",
      summary: "",
      description: str(m.description),
      photos: m.image ? [str(m.image)] : [],
      specs: specs,
      usage: "",
      relatedRecipes: [],
      relatedProducts: [],
      featured: false
    });
    variants.push({
      id: (pid.length + 4 > 40 ? pid.slice(0, 36) : pid) + "-std",
      order: 10,
      visible: m.visible !== false,
      productId: pid,
      name: "Modelo estándar",
      sku: "",
      price: null,
      unit: "pieza",
      availability: {},
      image: ""
    });
  }
  return { categories: categories, products: products, variants: variants };
}

// Card price label input (spec 16.5): none = "Precio a cotizar", single = "$1,250",
// from = "Desde $890". Only visible variants count.
function priceSummary(variants) {
  var list = Array.isArray(variants) ? variants : [];
  var prices = [];
  var count = 0;
  for (var i = 0; i < list.length; i++) {
    var v = list[i];
    if (!v || v.visible === false) continue;
    count++;
    if (typeof v.price === "number" && isFinite(v.price)) prices.push(v.price);
  }
  if (!prices.length) return { kind: "none", min: null };
  var min = Math.min.apply(null, prices);
  var max = Math.max.apply(null, prices);
  if (min === max && prices.length === count) return { kind: "single", min: min };
  return { kind: "from", min: min };
}

// es-MX money without Intl (Apps Script has none): "$1,250" or "$1,250.50";
// `fixed` always prints two decimals ("$1,250.00", used in e-mails).
function formatMoney(n, fixed) {
  if (typeof n !== "number" || !isFinite(n)) return "";
  var cents = Math.round(Math.abs(n) * 100);
  var whole = Math.floor(cents / 100);
  var frac = cents % 100;
  var out = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (fixed || frac !== 0) out += "." + (frac < 10 ? "0" : "") + frac;
  return (n < 0 ? "-$" : "$") + out;
}

function slugify(name) {
  var s = String(name == null ? "" : name);
  if (typeof s.normalize === "function") s = s.normalize("NFD");
  s = s.replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (s.length > 60) s = s.slice(0, 60).replace(/-+$/, "");
  return s;
}

// Builds a link to a page of the site that works on every hosting form
// (clean URLs, trailing slash, opened as index.html). Spec 12.4.
function rootLink(path, loc, root) {
  var file = /\/[^\/]+\.[a-z0-9]+$/i.test(loc.pathname);            // opened as .../index.html
  var clean = !file && !/\/$/.test(loc.pathname);                   // served without a slash
  var u = new URL(path || "", root);
  var s = u.pathname;
  if (clean) s = s.replace(/\/$/, "") || "/";
  else if (path && path.indexOf("?") !== 0 && path.indexOf("#") !== 0 && !/\/($|\?|#)/.test(path) && u.pathname.indexOf(".") === -1) s += "/";
  if (file && !/\.[a-z0-9]+$/i.test(s)) s = s.replace(/\/$/, "") + "/index.html";
  return s + u.search + u.hash;
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
  "promos",
  "categories",
  "products",
  "variants"
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
// list (comma-separated) | digits | url (https only) | image | date | number | boolean |
// images (one ref per line, <= 6) | ids (comma-separated ids, <= 10) | enum (field.values) |
// money (number or empty) | map (k=v; k=v, values from field.values)
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
    ]),
    categories: listSection("Categorias", [
      { key: "group", header: "Grupo", type: "enum", values: ["maquinaria", "insumos"], required: true },
      { key: "name", header: "Nombre", type: "string", required: true },
      { key: "tagline", header: "Subtítulo", type: "string" },
      { key: "description", header: "Descripción", type: "text" },
      { key: "image", header: "Imagen", type: "image" }
    ]),
    products: listSection("Productos", [
      { key: "categoryId", header: "Categoría", type: "string", required: true },
      { key: "brand", header: "Marca", type: "string" },
      { key: "name", header: "Nombre", type: "string", required: true },
      { key: "slug", header: "Slug", type: "string" },
      { key: "summary", header: "Resumen", type: "string", max: 160 },
      { key: "description", header: "Descripción", type: "text" },
      { key: "photos", header: "Fotos", type: "images" },
      { key: "specs", header: "Especificaciones", type: "lines" },
      { key: "usage", header: "Guía de uso", type: "text" },
      { key: "relatedRecipes", header: "Recetas relacionadas", type: "ids" },
      { key: "relatedProducts", header: "Productos relacionados", type: "ids" },
      { key: "featured", header: "Destacado", type: "boolean", default: false }
    ]),
    variants: listSection(
      "Variantes",
      [
        { key: "productId", header: "Producto", type: "string", required: true },
        { key: "name", header: "Nombre", type: "string", required: true },
        { key: "sku", header: "SKU", type: "string", max: 40 },
        { key: "price", header: "Precio", type: "money" },
        { key: "unit", header: "Unidad", type: "string", max: 40 },
        { key: "availability", header: "Disponibilidad", type: "map", values: AVAILABILITY_STATES },
        { key: "image", header: "Imagen", type: "image" }
      ],
      { maxRows: 500 }
    )
  },
  // Write-only log tab (spec §5.6). Never returned by any action.
  logs: {
    quotes: {
      tab: "Cotizaciones",
      headers: ["Fecha", "Sucursal", "Nombre", "Negocio", "Contacto", "Qué busca", "Mensaje", "Destinatarios", "Estatus envío", "Productos"]
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
    { key: "legalName", group: "Pie de página", type: "string", label: "Nombre legal (línea de derechos)" },

    { key: "navGroupMachinery", group: "Menú y portada", type: "string", label: "Menú: nombre del grupo de maquinaria" },
    { key: "navGroupSupplies", group: "Menú y portada", type: "string", label: "Menú: nombre del grupo de insumos" },
    { key: "navCtaShort", group: "Menú y portada", type: "string", label: "Texto corto del botón del menú (pantallas medianas)" },

    { key: "catalogIndexTitle", group: "Catálogo", type: "string", label: "Página del catálogo: título" },
    { key: "catalogIndexIntro", group: "Catálogo", type: "text", label: "Página del catálogo: introducción" },
    { key: "groupMachineryIntro", group: "Catálogo", type: "text", label: "Página de maquinaria: introducción" },
    { key: "groupSuppliesIntro", group: "Catálogo", type: "text", label: "Página de insumos: introducción" },
    { key: "featuredTitle", group: "Catálogo", type: "string", label: "Productos destacados: título" },
    { key: "featuredIntro", group: "Catálogo", type: "text", label: "Productos destacados: introducción" },
    { key: "variantLabel", group: "Catálogo", type: "string", label: "Nombre del selector de presentaciones (Presentación, Sabor, Modelo)" },
    { key: "priceNote", group: "Catálogo", type: "text", label: "Nota bajo cada precio (IVA, vigencia)" },
    { key: "priceToQuoteNote", group: "Catálogo", type: "text", label: "Nota cuando el precio es a cotizar" },
    { key: "availabilityNote", group: "Catálogo", type: "text", label: "Nota bajo las existencias por sucursal" },
    { key: "catalogEmptyCategory", group: "Catálogo", type: "text", label: "Texto cuando una línea aún no tiene productos" },

    { key: "quoteListTitle", group: "Cotiza", type: "string", label: "Lista de cotización: título" },
    { key: "quoteListIntro", group: "Cotiza", type: "text", label: "Lista de cotización: introducción" },
    { key: "quoteListSuccess", group: "Cotiza", type: "text", label: "Mensaje al enviar la lista de cotización" }
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
    "promos.image": { w: 1200, h: 675, aspect: "16:9", formats: "JPG/WebP", maxKB: 350, keepAlpha: false, help: "Imagen horizontal, 1200 × 675 px, JPG o WebP, máx. 350 KB." },
    "categories.image": { w: 1200, h: 800, aspect: "3:2", formats: "JPG/WebP", maxKB: 400, keepAlpha: false, help: "Foto representativa de la línea, 1200 × 800 px, JPG o WebP, máx. 400 KB. Se ve en el menú y en las tarjetas." },
    "products.photos": { w: 1200, h: 1200, aspect: "1:1", formats: "JPG/WebP/PNG", maxKB: 400, keepAlpha: true, help: "Fotos cuadradas del producto sobre fondo claro, 1200 × 1200 px, JPG, WebP o PNG, máx. 400 KB cada una. La primera es la principal; hasta 6." },
    "variants.image": { w: 1200, h: 1200, aspect: "1:1", formats: "JPG/WebP/PNG", maxKB: 400, keepAlpha: true, help: "Opcional: foto de esta presentación o sabor, 1200 × 1200 px. Si la dejas vacía se usan las fotos del producto." }
  }
};

if (typeof module === "object" && module.exports) {
  module.exports = {
    SCHEMA: SCHEMA,
    SECTION_NAMES: SECTION_NAMES,
    isSafeHttpsUrl: isSafeHttpsUrl,
    isEmail: isEmail,
    normalizeDigits: normalizeDigits,
    legacyToCatalog: legacyToCatalog,
    priceSummary: priceSummary,
    formatMoney: formatMoney,
    slugify: slugify,
    rootLink: rootLink,
    AVAILABILITY_STATES: AVAILABILITY_STATES,
    AVAILABILITY_LABELS: AVAILABILITY_LABELS
  };
} else if (typeof window !== "undefined") {
  window.BaristopSchema = {
    SCHEMA: SCHEMA,
    SECTION_NAMES: SECTION_NAMES,
    isSafeHttpsUrl: isSafeHttpsUrl,
    isEmail: isEmail,
    normalizeDigits: normalizeDigits,
    legacyToCatalog: legacyToCatalog,
    priceSummary: priceSummary,
    formatMoney: formatMoney,
    slugify: slugify,
    rootLink: rootLink,
    AVAILABILITY_STATES: AVAILABILITY_STATES,
    AVAILABILITY_LABELS: AVAILABILITY_LABELS
  };
}
