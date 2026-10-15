/**
 * Baristop v2 — pure helpers shared by the Apps Script backend and the unit tests.
 *
 * Rules for this file:
 *  - No imports, no Apps Script services, no DOM: it must load in Apps Script (V8)
 *    AND in `node --test` (CommonJS tail at the bottom).
 *  - Apps Script has no `URL` class, so anything that may use it is guarded.
 *  - The header <-> key mapping (SCHEMA) must stay identical to
 *    baristop-v2/js/schema.js, and isEmail / normalizeDigits / isSafeHttpsUrl must keep
 *    byte-identical bodies there. tests/baristopSchemaSync.test.ts enforces both.
 *
 * Comments and identifiers are English; user-facing strings are Spanish.
 */
var Shared = (function () {
  "use strict";

  // ---------------------------------------------------------------- primitives

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

  // Stricter than isEmail on purpose: addresses we actually mail must be a single bare address.
  function isMailable(s) {
    return isEmail(s) && s.length <= 254 && !/[,;<>()"']/.test(s);
  }

  // ------------------------------------------------------------------- schema

  var ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;
  var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  var PLACEHOLDER = "Por definir";
  var QUOTE_NEEDS = [
    "Maquinaria / equipo",
    "Insumos / consumibles",
    "Equipo + insumos para barra nueva",
    "Reabastecimiento",
    "Franquicia / Baristop en mi ciudad",
    "Asesoría / aún no estoy seguro",
  ];

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

  var MAX_ROWS = 300;
  var URL_MESSAGE = "Escribe la dirección completa, empezando con https://";

  function sectionDef(section) {
    var def = SCHEMA.sections[section];
    if (!def || SECTION_NAMES.indexOf(section) === -1) {
      throw new Error("Sección desconocida: " + section);
    }
    return def;
  }

  // -------------------------------------------------------- compare / tokens

  // Constant-time string compare; false on non-strings or empty input.
  function safeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    if (a.length === 0 || b.length === 0) return false;
    var diff = a.length ^ b.length;
    var n = Math.max(a.length, b.length);
    for (var i = 0; i < n; i++) {
      diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return diff === 0;
  }

  function sha256HexIsValid(s) {
    return typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
  }

  // token = "v1." + exp + "." + nonce + "." + sig
  function parseToken(token) {
    if (typeof token !== "string" || token.length > 300) return null;
    var parts = token.split(".");
    if (parts.length !== 4 || parts[0] !== "v1") return null;
    if (!/^\d{1,12}$/.test(parts[1])) return null;
    if (!/^[A-Za-z0-9-]{8,64}$/.test(parts[2])) return null;
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(parts[3])) return null;
    return { exp: parseInt(parts[1], 10), nonce: parts[2], sig: parts[3] };
  }

  // sigFn(payload) -> expected signature (the HMAC is injected by the caller).
  function isTokenValid(token, nowSec, sigFn) {
    var t = parseToken(token);
    if (!t || typeof sigFn !== "function") return false;
    if (!(t.exp > nowSec)) return false;
    var expected = sigFn("v1." + t.exp + "." + t.nonce);
    return safeEqual(t.sig, expected);
  }

  // ----------------------------------------------------------- sheet <-> items

  function headerIndex(headerRow, section) {
    var def = sectionDef(section);
    var names = [];
    for (var h = 0; h < headerRow.length; h++) names.push(String(headerRow[h] == null ? "" : headerRow[h]).trim());
    var out = {};
    var wanted = def.kind === "settings"
      ? [{ key: "key", header: def.headers[0] }, { key: "value", header: def.headers[1] }, { key: "description", header: def.headers[2] }]
      : def.fields;
    for (var i = 0; i < wanted.length; i++) {
      var f = wanted[i];
      var at = names.indexOf(f.header);
      if (at === -1) {
        if (def.kind === "settings" && f.key === "description") {
          out[f.key] = -1; // the help column is optional
          continue;
        }
        throw new Error('Falta la columna "' + f.header + '" en la pestaña ' + def.tab);
      }
      out[f.key] = at;
    }
    return out;
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function cellToString(v) {
    if (v == null) return "";
    if (Object.prototype.toString.call(v) === "[object Date]") {
      if (isNaN(v.getTime())) return "";
      return v.getFullYear() + "-" + pad2(v.getMonth() + 1) + "-" + pad2(v.getDate());
    }
    return String(v);
  }

  function splitList(v) {
    var out = [];
    var parts = cellToString(v).split(/[,;\n]+/);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p) out.push(p);
    }
    return out;
  }

  function splitLines(v) {
    var out = [];
    var parts = cellToString(v).split(/\r?\n/);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p) out.push(p);
    }
    return out;
  }

  function parseBool(v) {
    if (v === true || v === false) return v;
    var s = cellToString(v).trim().toLowerCase();
    if (s === "") return true; // a hand-added row with an empty box stays visible
    return /^(true|verdadero|si|sí|1|x|yes)$/.test(s);
  }

  function isBlankRow(row) {
    for (var i = 0; i < row.length; i++) {
      if (cellToString(row[i]).trim() !== "") return false;
    }
    return true;
  }

  // Fields stored as arrays in the JSON ("list" = comma separated, "lines" = one per line).
  // machines.specs is declared "lines" but the content model keeps it as plain text.
  function isArrayField(f) {
    return f.type === "list" || (f.type === "lines" && f.key !== "specs");
  }

  function cellToValue(field, raw) {
    if (field.type === "lines" && !isArrayField(field)) return cellToString(raw).replace(/\r\n/g, "\n").trim();
    switch (field.type) {
      case "boolean": return parseBool(raw);
      case "number": {
        var n = parseFloat(cellToString(raw).replace(",", "."));
        return isFinite(n) ? n : null;
      }
      case "list": return splitList(raw);
      case "lines": return splitLines(raw);
      case "digits": return normalizeDigits(cellToString(raw));
      case "text": return cellToString(raw).replace(/\r\n/g, "\n").trim();
      default: return cellToString(raw).trim();
    }
  }

  function rowsToItems(section, headerRow, rows) {
    var def = sectionDef(section);
    if (def.kind !== "list") throw new Error("La sección " + section + " no es una lista.");
    var idx = headerIndex(headerRow, section);
    var items = [];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (isBlankRow(row)) continue;
      var item = {};
      for (var i = 0; i < def.fields.length; i++) {
        var f = def.fields[i];
        item[f.key] = cellToValue(f, row[idx[f.key]]);
      }
      if (!item.id) item.id = "item-" + (r + 2); // hand-added row without an ID
      if (item.order === null) item.order = (r + 1) * 10;
      items.push(item);
    }
    return items;
  }

  function valueToCell(field, v) {
    if (field.type === "lines" && !isArrayField(field)) return v == null ? "" : String(v);
    switch (field.type) {
      case "boolean": return v === true;
      case "number": return typeof v === "number" && isFinite(v) ? v : "";
      case "list": return Array.isArray(v) ? v.join(", ") : "";
      case "lines": return Array.isArray(v) ? v.join("\n") : "";
      case "digits": return normalizeDigits(v);
      default: return v == null ? "" : String(v);
    }
  }

  function itemsToRows(section, headerRow, items) {
    var def = sectionDef(section);
    if (def.kind !== "list") throw new Error("La sección " + section + " no es una lista.");
    var idx = headerIndex(headerRow, section);
    var out = [];
    for (var n = 0; n < items.length; n++) {
      var row = [];
      for (var c = 0; c < headerRow.length; c++) row.push("");
      for (var i = 0; i < def.fields.length; i++) {
        var f = def.fields[i];
        row[idx[f.key]] = valueToCell(f, items[n][f.key]);
      }
      out.push(row);
    }
    return out;
  }

  // Ajustes rows ([Clave, Valor, Descripción]) -> flat object (system `_` keys included).
  function settingsToObject(rows) {
    var out = {};
    for (var i = 0; i < rows.length; i++) {
      var k = cellToString(rows[i][0]).trim();
      if (!k) continue;
      out[k] = cellToString(rows[i][1]).replace(/\r\n/g, "\n").trim();
    }
    return out;
  }

  // Flat object -> Ajustes rows: schema keys first, unknown keys after, system keys last.
  function objectToSettings(obj, descriptions) {
    var desc = descriptions || {};
    var seen = {};
    var rows = [];
    function push(k) {
      if (seen[k]) return;
      seen[k] = true;
      var label = desc[k];
      if (label == null || label === "") {
        for (var i = 0; i < SCHEMA.siteKeys.length; i++) {
          if (SCHEMA.siteKeys[i].key === k) label = SCHEMA.siteKeys[i].label;
        }
      }
      rows.push([k, obj[k] == null ? "" : String(obj[k]), label || ""]);
    }
    var i;
    for (i = 0; i < SCHEMA.siteKeys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(obj, SCHEMA.siteKeys[i].key)) push(SCHEMA.siteKeys[i].key);
    }
    var keys = Object.keys(obj).sort();
    for (i = 0; i < keys.length; i++) if (keys[i].charAt(0) !== "_") push(keys[i]);
    for (i = 0; i < keys.length; i++) if (keys[i].charAt(0) === "_") push(keys[i]);
    return rows;
  }

  function sortItems(items) {
    return items.slice().sort(function (a, b) {
      if (a.order !== b.order) return a.order - b.order;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  // tabs: { <tabName>: { header: [...], rows: [[...]] } }  ->  Content
  function rowsToContent(tabs) {
    var content = { version: 1, updatedAt: "", site: {} };
    for (var s = 0; s < SECTION_NAMES.length; s++) {
      var name = SECTION_NAMES[s];
      var def = SCHEMA.sections[name];
      var tab = tabs[def.tab];
      if (name === "site") {
        var rows = tab && tab.rows ? tab.rows : [];
        var head = tab && tab.header ? tab.header : [];
        var idx = head.length ? headerIndex(head, "site") : { key: 0, value: 1 };
        var shaped = rows.map(function (row) { return [row[idx.key], row[idx.value]]; });
        var obj = settingsToObject(shaped);
        content.updatedAt = obj._updatedAt || "";
        var site = {};
        Object.keys(obj).forEach(function (k) { if (k.charAt(0) !== "_") site[k] = obj[k]; });
        content.site = site;
        continue;
      }
      content[name] = tab ? sortItems(rowsToItems(name, tab.header, tab.rows)) : [];
    }
    return content;
  }

  // -------------------------------------------------------------- validation

  function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }

  function isValidYmd(s) {
    if (typeof s !== "string" || !DATE_PATTERN.test(s)) return false;
    var y = parseInt(s.slice(0, 4), 10);
    var m = parseInt(s.slice(5, 7), 10);
    var d = parseInt(s.slice(8, 10), 10);
    if (m < 1 || m > 12 || d < 1) return false;
    var dim = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= dim[m - 1];
  }

  function isSafeImageRef(s) {
    if (s === "") return true;
    if (isSafeHttpsUrl(s)) return true;
    // Site-relative path such as "assets/ejemplo/frappe-taro.jpg".
    return typeof s === "string" && s.length <= 300 &&
      /^[A-Za-z0-9][A-Za-z0-9_\-.\/]*$/.test(s) && s.indexOf("..") === -1;
  }

  function validateSection(section, rows, ctx) {
    var errors = [];
    function add(row, field, message) {
      errors.push({ row: row, field: field, message: message });
    }
    if (SECTION_NAMES.indexOf(section) === -1) {
      return { ok: false, errors: [{ row: null, field: "", message: "Sección desconocida." }] };
    }
    if (section === "site") {
      validateSite(rows, add);
      return { ok: errors.length === 0, errors: errors };
    }
    if (!Array.isArray(rows)) {
      add(null, "", "Los datos de la sección no son válidos.");
      return { ok: false, errors: errors };
    }
    var def0 = SCHEMA.sections[section];
    if (rows.length > MAX_ROWS) add(null, "", "La sección admite máximo " + MAX_ROWS + " elementos.");
    if (section === "heroImages" && rows.length > (def0.maxRows || 4)) add(null, "", "La portada admite máximo 4 imágenes.");

    var def = SCHEMA.sections[section];
    var seen = {};
    var catIds = ctx && Array.isArray(ctx.categoryIds) ? ctx.categoryIds : null;
    for (var n = 0; n < Math.min(rows.length, MAX_ROWS + 1); n++) {
      var item = rows[n];
      var rowNo = n + 1;
      if (!isPlainObject(item)) {
        add(rowNo, "", "Fila " + rowNo + ": datos no válidos.");
        continue;
      }
      var label = "Fila " + rowNo + (typeof item.name === "string" && item.name ? ' ("' + item.name.slice(0, 40) + '")' : "");
      if (typeof item.id !== "string" || !ID_PATTERN.test(item.id)) {
        add(rowNo, "id", label + ": el identificador no es válido.");
      } else if (seen[item.id]) {
        add(rowNo, "id", label + ": el identificador está repetido.");
      } else {
        seen[item.id] = true;
      }
      if (typeof item.order !== "number" || !isFinite(item.order)) add(rowNo, "order", label + ": el orden debe ser un número.");
      if (typeof item.visible !== "boolean") add(rowNo, "visible", label + ": el campo Visible no es válido.");

      for (var i = 3; i < def.fields.length; i++) {
        validateField(def.fields[i], item[def.fields[i].key], rowNo, label, add);
      }

      if (section === "recipes" && !item.photo && !item.videoUrl) {
        add(rowNo, "photo", label + ": agrega una foto o el enlace de un video.");
      }
      if (section === "machines" && catIds && typeof item.categoryId === "string" && catIds.indexOf(item.categoryId) === -1) {
        add(rowNo, "categoryId", label + ": la categoría no existe.");
      }
      if ((section === "announcements" || section === "promos")) {
        if (item.startsAt && item.endsAt && item.startsAt > item.endsAt) {
          add(rowNo, "endsAt", label + ': la fecha "Hasta" debe ser igual o posterior a "Desde".');
        }
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function validateField(f, v, rowNo, label, add) {
    var name = f.header;
    if (f.type === "list") {
      if (!Array.isArray(v)) { add(rowNo, f.key, label + ": " + name + " no es una lista."); return; }
      if (v.length > 20) add(rowNo, f.key, label + ": " + name + " admite máximo 20 correos.");
      for (var e = 0; e < v.length; e++) {
        // Private recipient lists must be real, mailable addresses; the public "Correos"
        // column may also hold the display placeholder "Por definir".
        var good = typeof v[e] === "string" && (f.private
          ? isMailable(v[e])
          : (isEmail(v[e]) || v[e].trim().toLowerCase() === PLACEHOLDER.toLowerCase()));
        if (!good) add(rowNo, f.key, label + ': "' + String(v[e]).slice(0, 60) + '" no es un correo válido.');
      }
      return;
    }
    if (isArrayField(f)) {
      if (!Array.isArray(v)) { add(rowNo, f.key, label + ": " + name + " no es una lista."); return; }
      if (v.length > 20) add(rowNo, f.key, label + ": " + name + " admite máximo 20 líneas.");
      for (var l = 0; l < v.length; l++) {
        if (typeof v[l] !== "string" || v[l].length > 160) add(rowNo, f.key, label + ": cada línea de " + name + " debe ser texto de máximo 160 caracteres.");
      }
      return;
    }
    if (typeof v !== "string") { add(rowNo, f.key, label + ": " + name + " no es válido."); return; }
    var s = v.trim();
    if (f.required && s === "") { add(rowNo, f.key, label + ": " + name + " es obligatorio."); return; }
    var multiline = f.type === "text" || f.type === "lines";
    var max = f.max || (multiline ? 2000 : 300);
    if (s.length > max) { add(rowNo, f.key, label + ": " + name + " admite máximo " + max + " caracteres."); return; }
    if (f.type === "url") {
      if (s !== "" && !isSafeHttpsUrl(s)) add(rowNo, f.key, label + ": " + name + ". " + URL_MESSAGE);
    } else if (f.type === "image") {
      if (!isSafeImageRef(s)) add(rowNo, f.key, label + ": " + name + ". " + URL_MESSAGE);
    } else if (f.type === "digits") {
      var d = normalizeDigits(s);
      if (d.length < 10 || d.length > 15 || !/^[\d\s()+\-.]+$/.test(s)) add(rowNo, f.key, label + ": " + name + " debe tener entre 10 y 15 dígitos.");
    } else if (f.type === "date") {
      if (s !== "" && !isValidYmd(s)) add(rowNo, f.key, label + ": " + name + " debe tener formato AAAA-MM-DD.");
    } else if (f.key === "categoryId") {
      if (!ID_PATTERN.test(s)) add(rowNo, f.key, label + ": " + name + " no es válida.");
    } else if (!multiline && /[\r\n]/.test(s)) {
      add(rowNo, f.key, label + ": " + name + " debe ir en una sola línea.");
    }
  }

  function validateEmailList(str, requireOne, add, key, message) {
    var list = splitList(str);
    var valid = 0;
    for (var i = 0; i < list.length; i++) {
      if (isMailable(list[i])) valid++;
      else add(null, key, '"' + list[i].slice(0, 60) + '" no es un correo válido.');
    }
    if (requireOne && valid < 1) add(null, key, message);
  }

  function validateSite(obj, add) {
    if (!isPlainObject(obj)) { add(null, "", "Los datos de Textos no son válidos."); return; }
    var keys = Object.keys(obj);
    if (keys.length > 200) add(null, "", "Hay demasiados textos.");
    for (var i = 0; i < Math.min(keys.length, 201); i++) {
      var k = keys[i];
      var v = obj[k];
      if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k)) { add(null, k, 'La clave "' + k.slice(0, 40) + '" no es válida.'); continue; }
      if (typeof v !== "string") { add(null, k, "El texto de " + k + " no es válido."); continue; }
      if (v.length > 2000) add(null, k, "El texto de " + k + " admite máximo 2000 caracteres.");
    }
    if (typeof obj.quoteAlwaysTo !== "string") {
      add(null, "quoteAlwaysTo", "Silvia debe recibir todas las solicitudes: escribe al menos un correo válido.");
    } else {
      validateEmailList(obj.quoteAlwaysTo, true, add, "quoteAlwaysTo", "Silvia debe recibir todas las solicitudes: escribe al menos un correo válido.");
    }
    if (typeof obj.quoteFallbackTo === "string") validateEmailList(obj.quoteFallbackTo, false, add, "quoteFallbackTo", "");
    if (typeof obj.franchiseWhatsapp === "string" && obj.franchiseWhatsapp.trim() !== "") {
      var d = normalizeDigits(obj.franchiseWhatsapp);
      if (d.length < 10 || d.length > 15) add(null, "franchiseWhatsapp", "El WhatsApp de franquicias debe tener entre 10 y 15 dígitos.");
    }
  }

  // ------------------------------------------------------------------ quotes

  function cleanLine(s, max) {
    var t = String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
    return max && t.length > max ? t.slice(0, max) : t;
  }

  // opts: { branchIds: string[] (optional), nowMs: number (optional) }
  // Honeypot / timing failures are `silent`: the caller answers ok:true and sends nothing.
  function validateQuote(body, opts) {
    var o = opts || {};
    var silent = { ok: false, errors: [], silent: true };
    var bad = [];
    if (!isPlainObject(body)) return { ok: false, errors: [{ field: "", message: "Revisa los datos del formulario." }], silent: false };
    var trap = body.website != null && body.website !== "" ? body.website : body.sitio_web;
    if (trap != null && trap !== "") return silent;
    var now = typeof o.nowMs === "number" ? o.nowMs : Date.now();
    var ts = typeof body.ts === "number" ? body.ts : parseInt(body.ts, 10);
    if (!isFinite(ts)) return silent;
    var age = now - ts;
    if (age < 3000 || age > 24 * 3600 * 1000) return silent;

    function str(v) { return typeof v === "string" ? v.trim() : null; }
    var name = str(body.name);
    var business = body.business == null || body.business === "" ? "" : str(body.business);
    var contact = str(body.contact);
    var message = body.message == null || body.message === "" ? "" : str(body.message);
    var need = str(body.need);
    var branchId = str(body.branchId);

    if (name === null || name.length < 2 || name.length > 80) bad.push({ field: "name", message: "Escribe tu nombre." });
    if (business === null || business.length > 120) bad.push({ field: "business", message: "El nombre del negocio es demasiado largo." });
    if (contact === null || contact.length < 5 || contact.length > 120 ||
        !(isEmail(contact) || normalizeDigits(contact).length >= 10)) {
      bad.push({ field: "contact", message: "Escribe un teléfono o correo para responderte." });
    }
    if (message === null || message.length > 2000) bad.push({ field: "message", message: "El mensaje es demasiado largo." });
    if (need === null || QUOTE_NEEDS.indexOf(need) === -1) bad.push({ field: "need", message: "Elige qué buscas." });
    if (branchId === null || !ID_PATTERN.test(branchId) || (Array.isArray(o.branchIds) && o.branchIds.indexOf(branchId) === -1)) {
      bad.push({ field: "branchId", message: "Elige una sucursal." });
    }
    return { ok: bad.length === 0, errors: bad, silent: false };
  }

  function emailsFrom(value) {
    var src = Array.isArray(value) ? value : splitList(value);
    var out = [];
    for (var i = 0; i < src.length; i++) {
      var e = typeof src[i] === "string" ? src[i].trim().toLowerCase() : "";
      if (isMailable(e) && out.indexOf(e) === -1) out.push(e);
    }
    return out;
  }

  // Branch recipients plus site.quoteAlwaysTo (always), de-duplicated and lowercased.
  // Falls back to site.quoteFallbackTo only when nothing else is left.
  function resolveRecipients(branch, site) {
    var s = site || {};
    var out = emailsFrom(branch && branch.quoteRecipients);
    var always = emailsFrom(s.quoteAlwaysTo);
    for (var i = 0; i < always.length; i++) if (out.indexOf(always[i]) === -1) out.push(always[i]);
    if (out.length === 0) out = emailsFrom(s.quoteFallbackTo);
    return out;
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // timeLabel (optional): already-formatted send time; defaults to nowIso.
  function buildQuoteEmail(body, branch, site, nowIso, timeLabel) {
    var b = body || {};
    var tag = cleanLine(branch && branch.subjectTag, 24) || "[BARISTOP]";
    var name = cleanLine(b.name, 80);
    var business = cleanLine(b.business, 120);
    var contact = cleanLine(b.contact, 120);
    var need = cleanLine(b.need, 80);
    var message = String(b.message == null ? "" : b.message).replace(/\r\n/g, "\n").trim();
    var branchName = cleanLine(branch && branch.name, 60);
    var when = timeLabel || nowIso || "";
    var replyTo = isEmail(contact) ? contact : "";
    var subject = tag + " " + name + (business ? " (" + business + ")" : "");

    var text = "Responder a: " + contact + "\n\n" +
      "Sucursal: " + branchName + "\n" +
      "Nombre: " + name + "\n" +
      "Negocio: " + (business || "—") + "\n" +
      "Contacto: " + contact + "\n" +
      "Qué busca: " + need + "\n" +
      "Mensaje:\n" + (message || "—") + "\n\n" +
      "Enviado: " + when + " (hora de Ciudad de México)\n";

    var rows = [
      ["Sucursal", branchName], ["Nombre", name], ["Negocio", business || "—"],
      ["Contacto", contact], ["Qué busca", need], ["Mensaje", message || "—"],
    ];
    var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#2B1A14">' +
      '<p style="margin:0 0 12px"><strong>Responder a:</strong> ' + escapeHtml(contact) + "</p>" +
      '<table role="presentation" cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #e3d5c0">';
    for (var i = 0; i < rows.length; i++) {
      html += '<tr><td style="border:1px solid #e3d5c0;background:#FBF3E6;font-weight:bold;vertical-align:top">' +
        escapeHtml(rows[i][0]) + '</td><td style="border:1px solid #e3d5c0;vertical-align:top">' +
        escapeHtml(rows[i][1]).replace(/\n/g, "<br>") + "</td></tr>";
    }
    html += "</table>" +
      '<p style="margin:12px 0 0;color:#7A6253;font-size:13px">Enviado: ' + escapeHtml(when) + " (hora de Ciudad de México)</p></div>";
    return { subject: subject, text: text, html: html, replyTo: replyTo };
  }

  // Item is inside its window when startsAt <= today <= endsAt (empty bound = open).
  function isWithinDates(item, todayYmd) {
    var s = item && typeof item.startsAt === "string" ? item.startsAt : "";
    var e = item && typeof item.endsAt === "string" ? item.endsAt : "";
    if (s && isValidYmd(s) && todayYmd < s) return false;
    if (e && isValidYmd(e) && todayYmd > e) return false;
    return true;
  }

  // Deep copy without the addresses that must never reach the public.
  function stripPrivate(content) {
    var copy = JSON.parse(JSON.stringify(content));
    if (copy.site) {
      for (var i = 0; i < SCHEMA.siteKeys.length; i++) {
        if (SCHEMA.siteKeys[i].private) delete copy.site[SCHEMA.siteKeys[i].key];
      }
    }
    if (Array.isArray(copy.branches)) {
      for (var b = 0; b < copy.branches.length; b++) copy.branches[b].quoteRecipients = [];
    }
    return copy;
  }

  // ----------------------------------------------------------------- uploads

  // First bytes -> MIME. `bytes` may hold signed values (Apps Script byte[]).
  function sniffImageType(bytes, headText) {
    function at(i) { return (bytes[i] || 0) & 255; }
    if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
    if (bytes.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "image/png";
    if (bytes.length >= 12 && at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
        at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return "image/webp";
    if (typeof headText === "string" && /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(headText)) return "image/svg+xml";
    return "";
  }

  function isSafeSvgText(text) {
    if (typeof text !== "string") return false;
    if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return false;
    return !/<script|<foreignobject|javascript:|\son[a-z]+\s*=|<!entity|<iframe/i.test(text);
  }

  var UPLOAD_MIMES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

  // Checks request metadata and returns { ok, error, spec, maxBytes, ext }.
  function validateUploadMeta(body) {
    var b = body || {};
    var fail = function (message) { return { ok: false, error: message }; };
    if (!isPlainObject(b)) return fail("Solicitud no válida.");
    if (typeof b.section !== "string" || typeof b.field !== "string") return fail("Solicitud no válida.");
    var spec = SCHEMA.images[b.section + "." + b.field];
    if (!spec) return fail("Este campo no admite imágenes.");
    if (typeof b.itemId !== "string" || !ID_PATTERN.test(b.itemId)) return fail("Solicitud no válida.");
    if (typeof b.mime !== "string" || UPLOAD_MIMES.indexOf(b.mime) === -1) return fail("Formato de imagen no permitido. Usa JPG, PNG o WebP.");
    if (b.mime === "image/svg+xml" && !spec.keepAlpha) return fail("Este campo no admite SVG.");
    if (typeof b.dataBase64 !== "string" || b.dataBase64.length < 16) return fail("No se recibió la imagen.");
    var maxBytes = Math.floor(spec.maxKB * 1024 * 1.2);
    if (b.dataBase64.length > Math.ceil(maxBytes / 3) * 4 + 8) {
      return fail("La imagen pesa demasiado. Máximo " + spec.maxKB + " KB.");
    }
    if (!/^[A-Za-z0-9+\/=\r\n]+$/.test(b.dataBase64)) return fail("La imagen no es válida.");
    var ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" }[b.mime];
    return { ok: true, spec: spec, maxBytes: maxBytes, ext: ext };
  }

  return {
    SCHEMA: SCHEMA,
    SECTION_NAMES: SECTION_NAMES,
    QUOTE_NEEDS: QUOTE_NEEDS,
    ID_PATTERN: ID_PATTERN,
    PLACEHOLDER: PLACEHOLDER,
    safeEqual: safeEqual,
    sha256HexIsValid: sha256HexIsValid,
    parseToken: parseToken,
    isTokenValid: isTokenValid,
    headerIndex: headerIndex,
    rowsToItems: rowsToItems,
    itemsToRows: itemsToRows,
    settingsToObject: settingsToObject,
    objectToSettings: objectToSettings,
    rowsToContent: rowsToContent,
    validateSection: validateSection,
    validateQuote: validateQuote,
    isEmail: isEmail,
    isMailable: isMailable,
    normalizeDigits: normalizeDigits,
    isSafeHttpsUrl: isSafeHttpsUrl,
    isValidYmd: isValidYmd,
    stripPrivate: stripPrivate,
    resolveRecipients: resolveRecipients,
    buildQuoteEmail: buildQuoteEmail,
    isWithinDates: isWithinDates,
    sniffImageType: sniffImageType,
    isSafeSvgText: isSafeSvgText,
    validateUploadMeta: validateUploadMeta,
    cleanLine: cleanLine,
  };
})();

if (typeof module === "object" && module.exports) module.exports = Shared;
