/* Baristop admin — API client for the Google Apps Script Web App (design spec §5.1, §4.6).
 *
 * Every request is a text/plain POST (a CORS "simple request": no preflight, which
 * Apps Script cannot answer). The admin waits up to 25 s because a cold Apps Script
 * start takes 5-10 s and a big upload or save can take longer. */
(function () {
  "use strict";

  var TIMEOUT_MS = 25000;
  var TOKEN_KEY = "baristop-v2:token";
  var CLIENT_ID_KEY = "baristop-v2:client-id";
  var MSG_TIMEOUT = "El servidor tardó en responder. Revisa tu conexión e intenta de nuevo.";

  var ui = window.AdminUI;
  var cfg = window.BARISTOP_CONFIG || {};
  var apiUrl = typeof cfg.apiUrl === "string" ? cfg.apiUrl.trim() : "";
  var onUnauthorized = null;
  var memToken = null;
  var memClientId = null;

  function ApiError(code, message, retryable) {
    var e = new Error(message);
    e.name = "ApiError";
    e.code = code;
    e.retryable = !!retryable;
    return e;
  }

  function demoRequested() {
    try { return new URLSearchParams(location.search).get("demo") === "1"; } catch (e) { return false; }
  }

  /* Demo mode: no backend configured, or ?demo=1 on any host (spec §4.1). */
  function isDemo() { return apiUrl === "" || demoRequested(); }

  function getToken() {
    var t = ui.ss.get(TOKEN_KEY);
    return t || memToken;
  }
  function setToken(t) { memToken = t; ui.ss.set(TOKEN_KEY, t); }
  function clearToken() { memToken = null; ui.ss.remove(TOKEN_KEY); }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    var b = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(b);
    else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  /* Random UUID generated once per browser; sent with login for the per-client rate limit. */
  function getClientId() {
    var id = ui.ls.get(CLIENT_ID_KEY);
    if (id && /^[0-9a-f-]{36}$/.test(id)) return id;
    if (memClientId) return memClientId;
    id = uuid().toLowerCase();
    memClientId = id;
    ui.ls.set(CLIENT_ID_KEY, id);
    return id;
  }

  /* post(body, {auth: true}) -> Promise<data>. Rejects with ApiError {code, message, retryable}. */
  function post(body, opts) {
    opts = opts || {};
    if (!apiUrl) return Promise.reject(ApiError("NOT_CONFIGURED", "El panel no está configurado todavía.", false));
    var payload = {};
    Object.keys(body).forEach(function (k) { payload[k] = body[k]; });
    if (opts.auth) payload.token = getToken() || "";

    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timedOut = false;
    var timer = setTimeout(function () {
      timedOut = true;
      if (ctrl) ctrl.abort();
    }, TIMEOUT_MS);

    var safetyTimer;
    var timeoutPromise = new Promise(function (_, reject) {
      // Safety net for browsers where abort does not reject the fetch.
      safetyTimer = setTimeout(function () { reject(ApiError("TIMEOUT", MSG_TIMEOUT, true)); }, TIMEOUT_MS + 1500);
    });

    var request = fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      return res.text();
    }).then(function (text) {
      var json;
      try { json = JSON.parse(text); } catch (e) {
        throw ApiError("SERVER_ERROR", "Respuesta inesperada del servidor. Intenta de nuevo.", true);
      }
      if (json && json.ok) return json.data;
      var err = (json && json.error) || {};
      var code = err.code || "SERVER_ERROR";
      var msg = err.message || "Algo salió mal. Intenta de nuevo.";
      if (code === "UNAUTHORIZED" && opts.auth) {
        clearToken();
        if (onUnauthorized) onUnauthorized();
      }
      throw ApiError(code, msg, code === "SERVER_ERROR");
    }).catch(function (e) {
      if (e && e.name === "ApiError") throw e;
      if (timedOut || (e && e.name === "AbortError")) throw ApiError("TIMEOUT", MSG_TIMEOUT, true);
      throw ApiError("NETWORK", MSG_TIMEOUT, true);
    });

    return Promise.race([request, timeoutPromise]).then(function (v) {
      clearTimeout(timer); clearTimeout(safetyTimer);
      return v;
    }, function (e) {
      clearTimeout(timer); clearTimeout(safetyTimer);
      throw e;
    });
  }

  function loginMessage(code, fallback) {
    if (code === "UNAUTHORIZED") return "Contraseña incorrecta.";
    if (code === "NOT_CONFIGURED") return "El panel no está configurado todavía.";
    if (code === "RATE_LIMITED") return "Demasiados intentos. Espera unos minutos.";
    return fallback;
  }

  /* login: UNAUTHORIZED here means "wrong password", so it does not trigger the session-ended flow. */
  function login(password) {
    return post({ action: "login", password: password, clientId: getClientId() }).then(function (data) {
      if (!data || !data.token) throw ApiError("SERVER_ERROR", "Respuesta inesperada del servidor. Intenta de nuevo.", true);
      setToken(data.token);
      return data;
    }, function (e) {
      e.message = loginMessage(e.code, e.message);
      throw e;
    });
  }

  function getContent(fresh) {
    var body = { action: "getContent" };
    if (fresh) body.fresh = true;
    return post(body, { auth: !!fresh });
  }

  function saveSection(section, rows) {
    return post({ action: "saveSection", section: section, rows: rows }, { auth: true });
  }

  function uploadImage(p) {
    return post({
      action: "uploadImage", section: p.section, itemId: p.itemId, field: p.field,
      name: p.name, mime: p.mime, dataBase64: p.dataBase64
    }, { auth: true });
  }

  window.AdminApi = {
    isDemo: isDemo,
    hasBackend: function () { return apiUrl !== ""; },
    getToken: getToken, clearToken: clearToken,
    onUnauthorized: function (fn) { onUnauthorized = fn; },
    login: login, getContent: getContent, saveSection: saveSection, uploadImage: uploadImage,
    TIMEOUT_MS: TIMEOUT_MS
  };
})();
