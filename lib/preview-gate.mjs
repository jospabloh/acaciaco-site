// Pure helpers for the Baristop v2 preview gate (see middleware.js).
// No imports and no framework: everything here runs on Web Crypto, so the
// same code is exercised by `node --test` and by Vercel's middleware runtime.

export var BASE_PATH = "/baristop-v2";
export var LOGIN_PATH = BASE_PATH + "/__preview/login";
export var LOGOUT_PATH = BASE_PATH + "/__preview/logout";
export var COOKIE_NAME = "bv2_preview";
export var COOKIE_MAX_AGE = 1209600; // 14 days
export var COOKIE_MESSAGE = "baristop-v2|v1";

// Only the round seal is reachable without the cookie: the login page shows it.
var PUBLIC_ASSETS = [BASE_PATH + "/assets/baristop-logo.png"];

var encoder = new TextEncoder();

function toHex(buffer) {
  var bytes = new Uint8Array(buffer);
  var out = "";
  for (var i = 0; i < bytes.length; i++) {
    out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
  }
  return out;
}

export async function sha256Hex(str) {
  var digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(str)));
  return toHex(digest);
}

// HMAC-SHA256 keyed with the UTF-8 bytes of `keyHex` (the stored hash itself).
export async function hmacHex(keyHex, msg) {
  var key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(keyHex)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  var sig = await crypto.subtle.sign("HMAC", key, encoder.encode(String(msg)));
  return toHex(sig);
}

// Constant-time compare. False for non-strings, empty strings and length mismatch.
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// BARISTOP_PREVIEW_HASH must be 64 lowercase hex chars (after trim/lowercase).
export function normalizeHash(value) {
  if (typeof value !== "string") return "";
  var h = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(h) ? h : "";
}

export function parseCookies(header) {
  var out = {};
  if (typeof header !== "string" || !header) return out;
  var parts = header.split(";");
  for (var i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf("=");
    if (eq < 1) continue;
    var name = parts[i].slice(0, eq).trim();
    var val = parts[i].slice(eq + 1).trim();
    if (name && !(name in out)) out[name] = val;
  }
  return out;
}

// Redirect targets are limited to the preview itself (no open redirect).
export function isSafeNext(path) {
  if (typeof path !== "string" || path.length > 300) return false;
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return false;
  if (path.indexOf(BASE_PATH) !== 0) return false;
  var rest = path.slice(BASE_PATH.length);
  if (rest !== "" && !/^[\/?#]/.test(rest)) return false;
  if (rest.indexOf("//") === 0) return false;
  if (path.indexOf(BASE_PATH + "/__preview") === 0) return false;
  return true;
}

export function isPublicAsset(pathname) {
  return PUBLIC_ASSETS.indexOf(pathname) !== -1;
}

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

var PAGE_CSS =
  ":root{--wine:#A3282A;--wine-deep:#6E1B1D;--wine-900:#511518;--cream:#F3E8D6;--gold:#C7973F;--gold-soft:#DDBE74;--ink:#2B1A14;--muted:#7A6253}" +
  "*{box-sizing:border-box}" +
  "html{color-scheme:light}" +
  "body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--cream);color:var(--ink);font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.5}" +
  "main{width:100%;max-width:400px;background:#fff;border:1px solid rgba(58,34,24,.14);border-radius:16px;padding:32px 24px;box-shadow:0 18px 40px rgba(58,34,24,.14);text-align:center}" +
  "img{width:120px;height:120px;border-radius:50%;display:block;margin:0 auto 16px}" +
  "h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.5rem;line-height:1.2;margin:0 0 8px;color:var(--wine-deep)}" +
  "p{margin:0 0 16px;color:var(--muted);font-size:.95rem}" +
  "form{text-align:left}" +
  "label{display:block;font-weight:600;font-size:.9rem;margin-bottom:6px}" +
  "input[type=password]{width:100%;font:inherit;padding:12px 14px;border:1.5px solid rgba(58,34,24,.35);border-radius:10px;background:#fff;color:var(--ink)}" +
  "input[type=password]:focus-visible{outline:3px solid var(--gold);outline-offset:2px;border-color:var(--wine)}" +
  "button{margin-top:16px;width:100%;font:inherit;font-weight:700;padding:13px 16px;border:0;border-radius:999px;background:var(--wine);color:#fff;cursor:pointer}" +
  "button:hover{background:var(--wine-deep)}" +
  "button:focus-visible{outline:3px solid var(--gold);outline-offset:3px}" +
  ".error{margin:0 0 14px;padding:10px 12px;border-radius:10px;background:#FBE9E7;color:#8A1C1C;font-weight:600;font-size:.9rem;text-align:left}" +
  "@media (prefers-reduced-motion:no-preference){button{transition:background .2s ease}}";

function shell(title, body) {
  return (
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow,noarchive">' +
    "<title>" + escapeHtml(title) + "</title>" +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600&amp;family=Inter:wght@400;600;700&amp;display=swap">' +
    "<style>" + PAGE_CSS + "</style></head><body><main>" +
    body +
    "</main></body></html>"
  );
}

// Login page. No inline script; the form posts to an absolute path because this
// page is served by the middleware at whatever URL the visitor asked for.
export function loginPage(opts) {
  var o = opts || {};
  var next = isSafeNext(o.next) ? o.next : BASE_PATH;
  var error = o.error
    ? '<p class="error" role="alert">' + escapeHtml(o.error) + "</p>"
    : "";
  return shell(
    "Baristop · Vista previa",
    '<img src="' + BASE_PATH + '/assets/baristop-logo.png" width="120" height="120" alt="Baristop">' +
      "<h1>Vista previa privada</h1>" +
      "<p>Escribe la contraseña que te compartimos para ver el sitio nuevo.</p>" +
      error +
      '<form method="post" action="' + LOGIN_PATH + '">' +
      '<label for="password">Contraseña</label>' +
      '<input id="password" name="password" type="password" autocomplete="current-password" required maxlength="200" autofocus>' +
      '<input type="hidden" name="next" value="' + escapeHtml(next) + '">' +
      '<button type="submit">Entrar</button>' +
      "</form>"
  );
}

export function unavailablePage() {
  return shell(
    "Baristop · Vista previa no disponible",
    "<h1>Vista previa no disponible.</h1>" +
      "<p>Esta vista previa todavía no está configurada. Vuelve a intentarlo más tarde.</p>"
  );
}
