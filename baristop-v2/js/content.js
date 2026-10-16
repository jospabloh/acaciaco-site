/*
 * Baristop v2 — content loading (spec §3.2).
 *
 * Load order: inline HTML copy (already on the page) -> demo content or
 * data/default-content.json -> localStorage cache -> live API (6 s timeout).
 * Exposes window.BaristopContent. Never shows errors to visitors.
 */
(function () {
  "use strict";

  var S = window.BaristopSchema;
  var CACHE_KEY = "baristop-v2:cache";
  var DEMO_KEY = "baristop-v2:demo-content";
  // Resolved against the site root (window.BARISTOP_ROOT, spec 12.4), never against <base>:
  // the catalog shell lives one folder deeper than the home page.
  var DEFAULT_PATH = "data/default-content.json";
  var PUBLIC_TIMEOUT_MS = 6000;
  var QUOTE_TIMEOUT_MS = 20000;

  var LIST_KEYS = [
    "social", "branches", "heroImages", "machineryCategories", "machines",
    "insumos", "recipes", "alliances", "announcements", "promos",
    "categories", "products", "variants"
  ];
  var GROUPS = ["maquinaria", "insumos"];
  var AVAILABILITY = ["disponible", "pocas", "pedido", "agotado"];
  // Copy for the catalog keys (spec 16.6). Used when the content document predates them
  // (old cache, old script version), so the new UI never renders an empty label.
  var SITE_DEFAULTS = {
    navGroupMachinery: "Maquinaria",
    navGroupSupplies: "Insumos",
    navCtaShort: "Cotiza",
    catalogIndexTitle: "Catálogo",
    catalogIndexIntro: "Equipo y consumibles para tu barra. Elige una línea o busca un producto.",
    groupMachineryIntro: "Cafeteras, molinos y licuadoras con asesoría para elegir según tu volumen.",
    groupSuppliesIntro: "Café, bases, jarabes, salsas y tisanas para que tu carta salga igual en cada turno.",
    featuredTitle: "Lo que más piden las barras.",
    featuredIntro: "Una selección de equipo e insumos para empezar.",
    variantLabel: "Presentación",
    priceNote: "Precios en MXN. Confirma IVA y vigencia al cotizar.",
    priceToQuoteNote: "Te lo cotizamos por WhatsApp o desde tu lista.",
    availabilityNote: "Existencias actualizadas por sucursal. Confirma al cotizar.",
    catalogEmptyCategory: "Estamos cargando los productos de esta línea. Cotiza por WhatsApp y te enviamos opciones.",
    quoteListTitle: "Mi cotización",
    quoteListIntro: "Agrega lo que necesites y envíanos la lista. Te respondemos con precios y disponibilidad.",
    quoteListSuccess: "¡Listo! Recibimos tu lista. Te respondemos en horario de atención."
  };
  // Site keys that the client may clear on purpose: an empty value hides the
  // element instead of falling back to the default copy.
  var OPTIONAL_SITE_KEYS = {
    heroStandout: 1, heroTrustHours: 1, offerIntro: 1, catalogIntro: 1, whyIntro: 1,
    recipesIntro: 1, alliancesIntro: 1, quoteIntro: 1, franchiseText: 1, footerTagline: 1,
    catalogIndexIntro: 1, groupMachineryIntro: 1, groupSuppliesIntro: 1, featuredIntro: 1,
    availabilityNote: 1, quoteListIntro: 1
  };

  var params = new URLSearchParams(window.location.search);
  var cfg = window.BARISTOP_CONFIG || {};
  var apiUrl = typeof cfg.apiUrl === "string" ? cfg.apiUrl.trim() : "";
  var demo = apiUrl === "" || params.get("demo") === "1" || !S.isSafeHttpsUrl(apiUrl);
  var noCache = params.get("nocache") === "1";

  var defaults = null; // parsed default-content.json, once loaded

  /* ---------- storage (always guarded) ---------- */

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* quota or blocked */ }
  }
  function readJson(key) {
    var raw = storageGet(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /* ---------- dates ---------- */

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function todayYmd() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function isWithinDates(item, today) {
    var from = item && typeof item.startsAt === "string" ? item.startsAt : "";
    var to = item && typeof item.endsAt === "string" ? item.endsAt : "";
    if (from && today < from) return false;
    if (to && today > to) return false;
    return true;
  }

  /* ---------- normalisation ---------- */

  function isVisible(item) {
    if (!item || typeof item !== "object") return false;
    var v = item.visible;
    return !(v === false || v === "false" || v === "FALSE" || v === 0);
  }
  function orderOf(item) {
    var n = Number(item.order);
    return isFinite(n) ? n : 1e9;
  }
  function sortItems(arr) {
    return arr.slice().sort(function (a, b) {
      var d = orderOf(a) - orderOf(b);
      if (d !== 0) return d;
      var ia = String(a.id || ""), ib = String(b.id || "");
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
  }

  function normalize(raw, fallback) {
    raw = raw && typeof raw === "object" ? raw : {};
    fallback = fallback || defaults || null;
    var today = todayYmd();
    var out = { version: raw.version || 1, updatedAt: raw.updatedAt || "", site: {} };

    var fs = fallback && fallback.site ? fallback.site : {};
    var rs = raw.site && typeof raw.site === "object" ? raw.site : {};
    var k;
    for (k in SITE_DEFAULTS) out.site[k] = SITE_DEFAULTS[k];
    for (k in fs) if (Object.prototype.hasOwnProperty.call(fs, k)) out.site[k] = fs[k];
    for (k in rs) {
      if (!Object.prototype.hasOwnProperty.call(rs, k)) continue;
      var v = rs[k] == null ? "" : String(rs[k]);
      if (v.trim() === "" && !OPTIONAL_SITE_KEYS[k] && (fs[k] !== undefined || SITE_DEFAULTS[k] !== undefined)) continue; // keep default copy
      out.site[k] = v;
    }

    var rawLegacy = Array.isArray(raw.machineryCategories) || Array.isArray(raw.insumos);
    LIST_KEYS.forEach(function (key) {
      var arr = Array.isArray(raw[key]) ? raw[key] : (fallback && Array.isArray(fallback[key]) ? fallback[key] : []);
      // A document that carries its own legacy lists but no catalog (old cache, un-migrated
      // script) must not borrow the default catalog: it is derived from those lists below.
      if (rawLegacy && !Array.isArray(raw[key]) && (key === "categories" || key === "products" || key === "variants")) arr = [];
      out[key] = sortItems(arr).filter(isVisible);
    });

    out.announcements = out.announcements.filter(function (a) { return isWithinDates(a, today); });
    out.promos = out.promos.filter(function (p) { return isWithinDates(p, today); });

    var catIds = {};
    out.machineryCategories.forEach(function (c) { catIds[c.id] = true; });
    out.machines = out.machines.filter(function (m) { return catIds[m.categoryId] === true; });

    normalizeCatalog(out);
    return out;
  }

  /* ---------- catalog (spec 16.1) ---------- */

  function toArray(v) {
    if (Array.isArray(v)) return v.map(function (x) { return x == null ? "" : String(x); }).filter(function (x) { return x.trim() !== ""; });
    if (typeof v === "string") return v.split(/\r?\n|,/).map(function (x) { return x.trim(); }).filter(Boolean);
    return [];
  }
  function toPrice(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
    return isFinite(n) && n >= 0 ? n : null;
  }
  function toAvailability(v) {
    var out = {};
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k) && AVAILABILITY.indexOf(v[k]) !== -1) out[k] = v[k];
    }
    return out;
  }

  function normalizeCatalog(out) {
    // Legacy documents (no visible categories): derive the catalog from the round-1 lists.
    if (!out.categories.length && (out.machineryCategories.length || out.insumos.length) && typeof S.legacyToCatalog === "function") {
      var derived = S.legacyToCatalog({
        machineryCategories: out.machineryCategories, insumos: out.insumos, machines: out.machines
      });
      out.categories = sortItems(derived.categories || []).filter(isVisible);
      out.products = sortItems(derived.products || []).filter(isVisible);
      out.variants = sortItems(derived.variants || []).filter(isVisible);
    }
    out.categories = out.categories.filter(function (c) {
      return c && c.id && GROUPS.indexOf(c.group) !== -1 && String(c.name || "").trim() !== "";
    });
    var catOk = {};
    out.categories.forEach(function (c) { catOk[c.id] = true; });
    var slugs = {};
    out.products = out.products.filter(function (p) {
      return p && p.id && catOk[p.categoryId] === true && String(p.name || "").trim() !== "";
    }).map(function (p) {
      p.photos = toArray(p.photos);
      p.specs = toArray(p.specs);
      p.relatedRecipes = toArray(p.relatedRecipes);
      p.relatedProducts = toArray(p.relatedProducts);
      p.featured = p.featured === true || p.featured === "true" || p.featured === "TRUE";
      p.brand = p.brand == null ? "" : String(p.brand).trim();
      var slug = p.slug && /^[a-z0-9][a-z0-9-]{1,59}$/.test(p.slug) && !slugs[p.slug] ? p.slug : p.id;
      slugs[slug] = true;
      p.slug = slug;
      return p;
    });
    var prodOk = {};
    out.products.forEach(function (p) { prodOk[p.id] = true; });
    out.variants = out.variants.filter(function (v) {
      return v && v.id && prodOk[v.productId] === true && String(v.name || "").trim() !== "";
    }).map(function (v) {
      v.price = toPrice(v.price);
      v.availability = toAvailability(v.availability);
      v.unit = v.unit == null ? "" : String(v.unit).trim();
      v.sku = v.sku == null ? "" : String(v.sku).trim();
      return v;
    });
  }

  /* ---------- network ---------- */

  function fetchWithTimeout(url, options, ms) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = null;
    var opts = options || {};
    if (ctrl) opts.signal = ctrl.signal;
    var race = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error("timeout"));
      }, ms);
    });
    return Promise.race([fetch(url, opts), race]).then(
      function (res) { clearTimeout(timer); return res; },
      function (err) { clearTimeout(timer); throw err; }
    );
  }

  function postApi(body, ms) {
    return fetchWithTimeout(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow"
    }, ms).then(function (res) { return res.json(); });
  }

  function loadDefaults() {
    if (defaults) return Promise.resolve(defaults);
    var root = typeof window.BARISTOP_ROOT === "string" && window.BARISTOP_ROOT ? window.BARISTOP_ROOT : document.baseURI;
    return fetch(new URL(DEFAULT_PATH, root).href, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) { defaults = json; return json; });
  }

  /* ---------- load ---------- */

  function timeOf(iso) {
    var t = Date.parse(iso || "");
    return isNaN(t) ? null : t;
  }

  // callback(content, source) is called for the first usable layer and again
  // whenever a later layer brings different content that is not older.
  function load(callback) {
    var shown = null; // { json, updatedAt }

    function show(raw, source, force) {
      var json = JSON.stringify(raw);
      if (shown) {
        if (!force) return;
        var a = timeOf(raw.updatedAt), b = timeOf(shown.updatedAt);
        if (a !== null && b !== null && a < b) return; // never go back in time
        if (json === shown.json) return;
      }
      shown = { json: json, updatedAt: raw.updatedAt };
      callback(normalize(raw), source);
    }

    function fromDemoStorage() {
      var stored = readJson(DEMO_KEY);
      if (stored && !stored.version && stored.content) stored = stored.content; // tolerate a wrapper
      return stored && typeof stored === "object" && stored.site ? stored : null;
    }

    if (demo) {
      var demoContent = fromDemoStorage();
      if (demoContent) {
        loadDefaults().catch(function () {}).then(function () { show(demoContent, "demo-storage", true); });
        return;
      }
      loadDefaults().then(function (d) { show(d, "default"); }).catch(function () { /* inline copy stays */ });
      return;
    }

    // Live mode.
    var cache = noCache ? null : readJson(CACHE_KEY);
    var cached = cache && cache.content && cache.content.site ? cache.content : null;
    var defaultsReady = loadDefaults().catch(function () { return null; });

    var firstPaint = cached
      ? defaultsReady.then(function () { show(cached, "cache"); })
      : defaultsReady.then(function (d) { if (d) show(d, "default"); });

    firstPaint.then(function () {
      return postApi({ action: "getContent" }, PUBLIC_TIMEOUT_MS);
    }).then(function (res) {
      if (!res || res.ok !== true || !res.data || typeof res.data !== "object" || !res.data.site) return;
      var fresh = res.data;
      var onScreen = shown ? timeOf(shown.updatedAt) : null;
      var incoming = timeOf(fresh.updatedAt);
      var newer = !shown || onScreen === null || incoming === null || incoming > onScreen ||
        (incoming === onScreen && JSON.stringify(fresh) !== shown.json); // hand-edited Sheet, same stamp
      if (newer) show(fresh, "api", true);
      storageSet(CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), content: fresh }));
    }).catch(function () { /* keep whatever is on screen; visitors never see an error */ });
  }

  /* ---------- quote submit ---------- */

  var GENERIC_ERROR = "No pudimos enviar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.";
  var SAFE_CODES = { RATE_LIMITED: 1, NOT_CONFIGURED: 1 };

  // Never rejects: resolves { ok, message }.
  function submitQuote(payload) {
    if (demo) return Promise.resolve({ ok: false, demo: true, message: "" });
    var body = { action: "submitQuote" };
    for (var k in payload) if (Object.prototype.hasOwnProperty.call(payload, k)) body[k] = payload[k];
    return postApi(body, QUOTE_TIMEOUT_MS).then(function (res) {
      if (res && res.ok === true) return { ok: true, message: "" };
      var err = res && res.error ? res.error : {};
      if (SAFE_CODES[err.code] && typeof err.message === "string" && err.message) return { ok: false, message: err.message };
      if (err.code === "VALIDATION") return { ok: false, message: "Revisa los datos del formulario." };
      return { ok: false, message: GENERIC_ERROR };
    }).catch(function () {
      return { ok: false, message: GENERIC_ERROR };
    });
  }

  window.BaristopContent = {
    isDemo: demo,
    apiUrl: apiUrl,
    load: load,
    normalize: normalize,
    submitQuote: submitQuote,
    todayYmd: todayYmd,
    GROUPS: GROUPS,
    OPTIONAL_SITE_KEYS: OPTIONAL_SITE_KEYS
  };
})();
