import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  sha256Hex,
  hmacHex,
  safeEqual,
  normalizeHash,
  parseCookies,
  isSafeNext,
  isPublicAsset,
  loginPage,
  unavailablePage,
  COOKIE_MESSAGE,
} from "../lib/preview-gate.mjs";
import middleware, { config } from "../middleware.js";

var PASSWORD = "contraseña-de-prueba";
var ENV = "BARISTOP_PREVIEW_HASH";
var saved: string | undefined;
var HASH = "";

beforeEach(async () => {
  saved = process.env[ENV];
  HASH = await sha256Hex(PASSWORD);
  process.env[ENV] = HASH;
});

afterEach(() => {
  if (saved === undefined) delete process.env[ENV];
  else process.env[ENV] = saved;
});

function get(path: string, cookie?: string) {
  var headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request("https://acaciaco.com.mx" + path, { headers });
}

function login(password: string, next = "") {
  return new Request("https://acaciaco.com.mx/baristop-v2/__preview/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password, next }).toString(),
  });
}

async function validCookie() {
  return "bv2_preview=" + (await hmacHex(HASH, COOKIE_MESSAGE));
}

// ----------------------------------------------------------------- helpers

test("sha256Hex coincide con el valor conocido", async () => {
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("la cookie cambia cuando cambia el hash", async () => {
  var a = await hmacHex("a".repeat(64), COOKIE_MESSAGE);
  var b = await hmacHex("b".repeat(64), COOKIE_MESSAGE);
  assert.notEqual(a, b);
  assert.equal(a, await hmacHex("a".repeat(64), COOKIE_MESSAGE));
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("safeEqual: falso con vacíos, tipos distintos y longitudes distintas", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "ab"), false);
  assert.equal(safeEqual("", ""), false);
  assert.equal(safeEqual(undefined, undefined), false);
});

test("normalizeHash falla cerrado con vacío o mal formado", () => {
  assert.equal(normalizeHash(undefined), "");
  assert.equal(normalizeHash(""), "");
  assert.equal(normalizeHash("abc"), "");
  assert.equal(normalizeHash("z".repeat(64)), "");
  assert.equal(normalizeHash("  " + "AB".repeat(32) + "\n"), "ab".repeat(32));
});

test("parseCookies", () => {
  assert.deepEqual(parseCookies("a=1; bv2_preview=xyz; c=3"), { a: "1", bv2_preview: "xyz", c: "3" });
  assert.deepEqual(parseCookies(null as any), {});
  assert.deepEqual(parseCookies("sin-igual"), {});
});

test("isSafeNext solo permite rutas de /baristop-v2", () => {
  for (var good of ["/baristop-v2", "/baristop-v2/", "/baristop-v2/admin", "/baristop-v2?demo=1", "/baristop-v2/admin?x=1#y"]) {
    assert.equal(isSafeNext(good), true, good);
  }
  for (var bad of [
    "//evil.com",
    "//baristop-v2",
    "/roseta",
    "/roseta/factura",
    "/baristop",
    "/baristop-v2.evil.com",
    "/baristop-v2evil",
    "https://evil.com/baristop-v2",
    "/baristop-v2//evil.com",
    "/baristop-v2\\evil",
    "/baristop-v2/__preview/login",
    "/baristop-v2\r\nSet-Cookie: x=1",
    "",
    null,
  ]) {
    assert.equal(isSafeNext(bad as any), false, String(bad));
  }
});

test("solo el sello redondo es público", () => {
  assert.equal(isPublicAsset("/baristop-v2/assets/baristop-logo.png"), true);
  assert.equal(isPublicAsset("/baristop-v2/assets/baristop-lockup.png"), false);
  assert.equal(isPublicAsset("/baristop-v2"), false);
  assert.equal(isPublicAsset("/baristop-v2/assets/baristop-logo.png/../../index.html"), false);
});

test("loginPage escapa valores dinámicos, no lleva script y usa ruta absoluta", () => {
  var html = loginPage({ error: '<img src=x onerror=alert(1)>"', next: '/baristop-v2/"><script>alert(1)</script>' });
  assert.equal(html.includes("<script"), false);
  assert.equal(html.includes("<img src=x"), false);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(html.includes('action="/baristop-v2/__preview/login"'));
  assert.ok(html.includes("&quot;&gt;&lt;script&gt;"), "el next se escapa");
  assert.ok(loginPage({ next: "//evil.com" }).includes('name="next" value="/baristop-v2"'), "un next inseguro vuelve a /baristop-v2");
  assert.ok(html.includes('lang="es"'));
  assert.ok(html.includes("Entrar"));
  assert.equal(/\son[a-z]+=/i.test(unavailablePage() + loginPage({})), false, "sin manejadores inline");
  assert.equal(/\sstyle=/i.test(loginPage({})), false);
  var ok = loginPage({ next: "/baristop-v2/admin?x=1" });
  assert.ok(ok.includes('value="/baristop-v2/admin?x=1"'));
});

// -------------------------------------------------------------- middleware

test("el matcher es exactamente la lista de dos entradas", () => {
  assert.deepEqual(config.matcher, ["/baristop-v2", "/baristop-v2/:path*"]);
});

test("falla cerrado: sin hash configurado responde 503, nunca el sitio", async () => {
  delete process.env[ENV];
  var res = await middleware(get("/baristop-v2"));
  assert.equal(res.status, 503);
  assert.match(await res.text(), /Vista previa no disponible\./);
  assert.equal(res.headers.get("x-middleware-next"), null);
  assert.match(res.headers.get("x-robots-tag") || "", /noindex/);
});

test("falla cerrado: hash mal formado responde 503 aun con cookie", async () => {
  process.env[ENV] = "no-es-un-hash";
  var res = await middleware(get("/baristop-v2", "bv2_preview=" + "a".repeat(64)));
  assert.equal(res.status, 503);
  var login503 = await middleware(login(PASSWORD));
  assert.equal(login503.status, 503);
  assert.equal(login503.headers.get("set-cookie"), null);
});

test("sin cookie: 401 con la página de acceso, noindex y no-store", async () => {
  var res = await middleware(get("/baristop-v2/admin?x=1"));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("x-middleware-next"), null);
  assert.match(res.headers.get("x-robots-tag") || "", /noindex/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  var html = await res.text();
  assert.ok(html.includes('name="password"'));
  assert.ok(html.includes('value="/baristop-v2/admin?x=1"'));
  assert.equal(html.includes("<script"), false);
});

test("contraseña incorrecta: 401 con el mensaje y sin cookie", async () => {
  var res = await middleware(login("otra-contraseña"));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("set-cookie"), null);
  assert.match(await res.text(), /Contraseña incorrecta\./);
});

test("contraseña correcta: 303 a /baristop-v2 con cookie HttpOnly", async () => {
  var res = await middleware(login(PASSWORD));
  assert.equal(res.status, 303);
  assert.equal(new URL(res.headers.get("location") as string).pathname, "/baristop-v2");
  var cookie = res.headers.get("set-cookie") as string;
  assert.ok(cookie.startsWith("bv2_preview=" + (await hmacHex(HASH, COOKIE_MESSAGE))));
  for (var flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/baristop-v2", "Max-Age=1209600"]) {
    assert.ok(cookie.includes(flag), flag);
  }
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("el login respeta un next de /baristop-v2 y descarta uno externo", async () => {
  var inside = await middleware(login(PASSWORD, "/baristop-v2/admin"));
  assert.equal(new URL(inside.headers.get("location") as string).pathname, "/baristop-v2/admin");
  for (var evil of ["//evil.com", "https://evil.com", "/roseta/factura/admin"]) {
    var res = await middleware(login(PASSWORD, evil));
    var loc = new URL(res.headers.get("location") as string);
    assert.equal(loc.origin, "https://acaciaco.com.mx");
    assert.equal(loc.pathname, "/baristop-v2");
  }
});

test("con la cookie correcta deja pasar y añade noindex y no-store", async () => {
  var res = await middleware(get("/baristop-v2/admin", await validCookie()));
  assert.equal(res.headers.get("x-middleware-next"), "1");
  assert.match(res.headers.get("x-robots-tag") || "", /noindex/);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
});

test("una cookie de otro hash no sirve (cambiar la contraseña cierra las sesiones)", async () => {
  var stale = "bv2_preview=" + (await hmacHex("c".repeat(64), COOKIE_MESSAGE));
  var res = await middleware(get("/baristop-v2", stale));
  assert.equal(res.status, 401);
  var guess = await middleware(get("/baristop-v2", "bv2_preview=" + HASH));
  assert.equal(guess.status, 401, "el hash mismo no es una cookie válida");
});

test("el sello redondo se sirve sin cookie para la página de acceso; lo demás no", async () => {
  var logo = await middleware(get("/baristop-v2/assets/baristop-logo.png"));
  assert.equal(logo.headers.get("x-middleware-next"), "1");
  var other = await middleware(get("/baristop-v2/assets/baristop-lockup.png"));
  assert.equal(other.status, 401);
});

test("logout borra la cookie y vuelve al acceso", async () => {
  var res = await middleware(get("/baristop-v2/__preview/logout", await validCookie()));
  assert.equal(res.status, 303);
  assert.ok((res.headers.get("set-cookie") as string).includes("Max-Age=0"));
  assert.equal(new URL(res.headers.get("location") as string).pathname, "/baristop-v2/__preview/login");
});
