import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import Shared from "../apps-script/Shared.js";
import DEFAULT_CONTENT from "../apps-script/DefaultContent.js";
import siteSchema from "../baristop-v2/js/schema.js";

var ROOT = new URL("..", import.meta.url).pathname;
var read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// Pulls `function name(...) { ... }` out of a source file by matching braces.
function extractFunction(source: string, name: string): string {
  var start = source.search(new RegExp("function\\s+" + name + "\\s*\\("));
  assert.notEqual(start, -1, "no se encontró la función " + name);
  var open = source.indexOf("{", start);
  var depth = 0;
  for (var i = open; i < source.length; i++) {
    var ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("llaves sin cerrar en " + name);
}

// Indentation is the only formatting allowed to differ.
function normalize(code: string): string {
  return code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

test("SCHEMA de Apps Script === SCHEMA del sitio", () => {
  assert.deepEqual((Shared as any).SCHEMA, (siteSchema as any).SCHEMA);
  assert.deepEqual((Shared as any).SECTION_NAMES, (siteSchema as any).SECTION_NAMES);
});

test("DefaultContent === data/default-content.json", () => {
  var json = JSON.parse(read("baristop-v2/data/default-content.json"));
  assert.deepEqual(DEFAULT_CONTENT, json);
});

test("isSafeHttpsUrl, isEmail y normalizeDigits tienen cuerpos idénticos en Shared.js y schema.js", () => {
  var shared = read("apps-script/Shared.js");
  var site = read("baristop-v2/js/schema.js");
  for (var name of ["isSafeHttpsUrl", "isEmail", "normalizeDigits"]) {
    assert.equal(normalize(extractFunction(shared, name)), normalize(extractFunction(site, name)), name);
  }
});

test("las funciones compartidas se comportan igual en ambos módulos", () => {
  var samples = ["https://a.com", "http://a.com", "javascript:alert(1)", "a@b.co", "a b@c.co", "", null, 5, "+52 449 178 4526"];
  for (var s of samples) {
    assert.equal((Shared as any).isSafeHttpsUrl(s), (siteSchema as any).isSafeHttpsUrl(s), String(s));
    assert.equal((Shared as any).isEmail(s), (siteSchema as any).isEmail(s), String(s));
    assert.equal((Shared as any).normalizeDigits(s), (siteSchema as any).normalizeDigits(s), String(s));
  }
});

test("el contenido semilla del sitio pasa las reglas del servidor", () => {
  var json = JSON.parse(read("baristop-v2/data/default-content.json"));
  var ctx = { categoryIds: json.machineryCategories.map((c: any) => c.id) };
  (Shared as any).SECTION_NAMES.forEach((name: string) => {
    var r = (Shared as any).validateSection(name, name === "site" ? json.site : json[name], ctx);
    assert.deepEqual(r.errors, [], name);
  });
  var keys = (Shared as any).SCHEMA.siteKeys.map((k: any) => k.key).sort();
  assert.deepEqual(Object.keys(json.site).sort(), keys, "las claves de site coinciden con SCHEMA.siteKeys");
});

test("ninguna carpeta bajo baristop-v2/ lleva punto en el nombre (el <base> depende de ello)", () => {
  var dotted: string[] = [];
  (function walk(dir: string) {
    for (var entry of readdirSync(dir)) {
      var full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry.includes(".")) dotted.push(full);
        walk(full);
      }
    }
  })(join(ROOT, "baristop-v2"));
  assert.deepEqual(dotted, []);
});

test("el matcher de middleware.js es exactamente la lista de dos entradas", () => {
  var src = read("middleware.js");
  var m = src.match(/matcher:\s*\[([^\]]*)\]/);
  assert.ok(m, "no se encontró el matcher");
  var entries = (m as RegExpMatchArray)[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  assert.deepEqual(entries, ["/baristop-v2", "/baristop-v2/:path*"]);
});

test("package.json declara @vercel/functions en dependencies y .env.example documenta el hash", () => {
  var pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.dependencies["@vercel/functions"]);
  assert.equal(pkg.devDependencies?.["@vercel/functions"], undefined);
  assert.match(read(".env.example"), /^BARISTOP_PREVIEW_HASH=/m);
});
