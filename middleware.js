// Baristop v2 preview gate — Vercel Routing Middleware.
// Runs only for /baristop-v2 (see `config.matcher`). Fails closed: without a
// valid BARISTOP_PREVIEW_HASH every matched request gets a 503, never the site.
// Delete this file (and lib/preview-gate.mjs) when v2 is promoted, see the spec §7.1.
import { next } from "@vercel/functions";
import {
  BASE_PATH,
  LOGIN_PATH,
  LOGOUT_PATH,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  COOKIE_MESSAGE,
  sha256Hex,
  hmacHex,
  safeEqual,
  normalizeHash,
  parseCookies,
  isSafeNext,
  isPublicAsset,
  loginPage,
  unavailablePage,
} from "./lib/preview-gate.mjs";

export const config = { matcher: ["/baristop-v2", "/baristop-v2/:path*"] };

var ROBOTS = "noindex, nofollow, noarchive";

function htmlResponse(html, status, extra) {
  var headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": ROBOTS,
    "X-Content-Type-Options": "nosniff",
  };
  for (var k in extra || {}) headers[k] = extra[k];
  return new Response(html, { status: status, headers: headers });
}

function cookieHeader(value, maxAge) {
  return (
    COOKIE_NAME + "=" + value + "; Path=" + BASE_PATH +
    "; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge
  );
}

function redirect(url, location, setCookie) {
  var headers = {
    Location: new URL(location, url).toString(),
    "Cache-Control": "no-store",
    "X-Robots-Tag": ROBOTS,
  };
  if (setCookie) headers["Set-Cookie"] = setCookie;
  return new Response(null, { status: 303, headers: headers });
}

function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

export default async function middleware(request) {
  var url = new URL(request.url);
  var hash = normalizeHash(process.env.BARISTOP_PREVIEW_HASH);
  if (!hash) return htmlResponse(unavailablePage(), 503, { "Retry-After": "3600" });

  var expected = await hmacHex(hash, COOKIE_MESSAGE);
  var pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;

  if (pathname === LOGIN_PATH && request.method === "POST") {
    var raw = await request.text();
    if (raw.length > 2000) return htmlResponse(loginPage({ error: "Contraseña incorrecta." }), 401);
    var form = new URLSearchParams(raw);
    var password = form.get("password") || "";
    var nextPath = form.get("next") || "";
    if (password.length <= 200 && safeEqual(await sha256Hex(password), hash)) {
      return redirect(
        request.url,
        isSafeNext(nextPath) ? nextPath : BASE_PATH,
        cookieHeader(expected, COOKIE_MAX_AGE)
      );
    }
    await delay(400);
    return htmlResponse(
      loginPage({ error: "Contraseña incorrecta.", next: nextPath }),
      401
    );
  }

  if (pathname === LOGOUT_PATH) {
    return redirect(request.url, LOGIN_PATH, cookieHeader("", 0));
  }

  var cookies = parseCookies(request.headers.get("cookie"));
  var authed = safeEqual(cookies[COOKIE_NAME], expected);

  if (authed && pathname === LOGIN_PATH) return redirect(request.url, BASE_PATH);

  if (authed || isPublicAsset(pathname)) {
    return next({
      headers: {
        "X-Robots-Tag": ROBOTS,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return htmlResponse(loginPage({ next: url.pathname + url.search }), 401);
}
