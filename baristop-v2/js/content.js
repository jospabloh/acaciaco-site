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
  var DEFAULT_URL = "data/default-content.json"; // resolved against <base>
  var PUBLIC_TIMEOUT_MS = 6000;
  var QUOTE_TIMEOUT_MS = 20000;

  var LIST_KEYS = [
    "social", "branches", "heroImages", "machineryCategories", "machines",
    "insumos", "recipes", "alliances", "announcements", "promos"
  ];
  // Site keys that the client may clear on purpose: an empty value hides the
  // element instead of falling back to the default copy.
  var OPTIONAL_SITE_KEYS = {
    heroStandout: 1, heroTrustHours: 1, offerIntro: 1, catalogIntro: 1, whyIntro: 1,
    recipesIntro: 1, alliancesIntro: 1, quoteIntro: 1, franchiseText: 1, footerTagline: 1
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
    for (k in fs) if (Object.prototype.hasOwnProperty.call(fs, k)) out.site[k] = fs[k];
    for (k in rs) {
      if (!Object.prototype.hasOwnProperty.call(rs, k)) continue;
      var v = rs[k] == null ? "" : String(rs[k]);
      if (v.trim() === "" && !OPTIONAL_SITE_KEYS[k] && fs[k] !== undefined) continue; // keep default copy
      out.site[k] = v;
    }

    LIST_KEYS.forEach(function (key) {
      var arr = Array.isArray(raw[key]) ? raw[key] : (fallback && Array.isArray(fallback[key]) ? fallback[key] : []);
      out[key] = sortItems(arr).filter(isVisible);
    });

    out.announcements = out.announcements.filter(function (a) { return isWithinDates(a, today); });
    out.promos = out.promos.filter(function (p) { return isWithinDates(p, today); });

    var catIds = {};
    out.machineryCategories.forEach(function (c) { catIds[c.id] = true; });
    out.machines = out.machines.filter(function (m) { return catIds[m.categoryId] === true; });
    return out;
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
    return fetch(DEFAULT_URL, { cache: "no-cache" })
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
    OPTIONAL_SITE_KEYS: OPTIONAL_SITE_KEYS
  };
})();
