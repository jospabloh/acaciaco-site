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

test("los ocho helpers compartidos tienen cuerpos idénticos en Shared.js y schema.js", () => {
  var shared = read("apps-script/Shared.js");
  var site = read("baristop-v2/js/schema.js");
  var names = ["isSafeHttpsUrl", "isEmail", "normalizeDigits", "legacyToCatalog", "priceSummary", "formatMoney", "slugify", "rootLink"];
  for (var name of names) {
    assert.equal(normalize(extractFunction(shared, name)), normalize(extractFunction(site, name)), name);
  }
});

test("las constantes de disponibilidad son iguales en ambos módulos", () => {
  assert.deepEqual((Shared as any).AVAILABILITY_STATES, (siteSchema as any).AVAILABILITY_STATES);
  assert.deepEqual((Shared as any).AVAILABILITY_LABELS, (siteSchema as any).AVAILABILITY_LABELS);
  assert.deepEqual((Shared as any).SCHEMA.sections.variants.fields.find((f: any) => f.key === "availability").values, (siteSchema as any).AVAILABILITY_STATES);
});

test("los helpers del catálogo se comportan igual en ambos módulos", () => {
  var S: any = Shared;
  var W: any = siteSchema;
  var legacy = { machineryCategories: DEFAULT_CONTENT.machineryCategories, insumos: DEFAULT_CONTENT.insumos, machines: DEFAULT_CONTENT.machines };
  assert.deepEqual(S.legacyToCatalog(legacy), W.legacyToCatalog(legacy));
  assert.deepEqual(S.legacyToCatalog(null), W.legacyToCatalog(null));
  for (var vs of [[], [{ price: 5 }], [{ price: 5 }, { price: null }], [{ price: 1 }, { price: 9 }]]) {
    assert.deepEqual(S.priceSummary(vs), W.priceSummary(vs));
  }
  for (var n of [0, 1250, 1250.5, 1234567.891, -3, NaN, null]) {
    assert.equal(S.formatMoney(n), W.formatMoney(n), String(n));
    assert.equal(S.formatMoney(n, true), W.formatMoney(n, true), String(n));
  }
  for (var t of ["Café Coatepec 1 kg", "  Ñandú & Té ", "", null]) assert.equal(S.slugify(t), W.slugify(t), String(t));
  for (var p of ["catalogo?c=molinos", "#cotiza", ""]) {
    for (var pathname of ["/baristop-v2/catalogo", "/baristop-v2/catalogo/", "/baristop-v2/catalogo/index.html"]) {
      assert.equal(S.rootLink(p, { pathname }, "https://x/baristop-v2/"), W.rootLink(p, { pathname }, "https://x/baristop-v2/"));
    }
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
  var ctx = {
    categoryIds: json.machineryCategories.map((c: any) => c.id),
    productIds: json.products.map((p: any) => p.id),
  };
  assert.equal((Shared as any).SECTION_NAMES.length, 14);
  (Shared as any).SECTION_NAMES.forEach((name: string) => {
    // products point at the new categories, machines at the legacy ones
    var c = name === "products" ? { categoryIds: json.categories.map((x: any) => x.id) } : ctx;
    var r = (Shared as any).validateSection(name, name === "site" ? json.site : json[name], c);
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

test("la semilla del catálogo no inventa especificaciones (spec 16.11)", () => {
  var json = JSON.parse(read("baristop-v2/data/default-content.json"));
  var FACT_LABELS = ["Marca", "Origen"];
  var PLACEHOLDER_VARIANTS = ["2 grupos", "Modelo estándar"];
  var tripwire = /\d\s?(g|kg|ml|l|v|w|%)\b/i;
  assert.ok(json.products.length >= 8);
  for (var p of json.products) {
    assert.match(p.name, /\(ejemplo\)$/, p.id);
    for (var line of p.specs) {
      var m = /^([^:]+): (.+)$/.exec(line);
      assert.ok(m, p.id + ": línea de especificación sin formato Etiqueta: Valor: " + line);
      if (!FACT_LABELS.includes((m as RegExpExecArray)[1])) assert.equal((m as RegExpExecArray)[2], "Por definir", p.id + " " + line);
    }
    assert.doesNotMatch(p.usage, tripwire, p.id + " usage");
    assert.doesNotMatch(p.description, tripwire, p.id + " description");
    assert.doesNotMatch(p.summary, tripwire, p.id + " summary");
  }
  assert.ok(json.variants.length >= 10);
  for (var v of json.variants) {
    assert.ok(/\(ejemplo\)$/.test(v.name) || PLACEHOLDER_VARIANTS.includes(v.name), v.id + " " + v.name);
    assert.equal(v.price, null, v.id);
    assert.equal(v.sku, "", v.id);
    assert.ok(v.unit === "" || v.unit === "pieza", v.id);
    assert.deepEqual(v.availability, {}, v.id);
  }
});

test("la semilla del catálogo es coherente: líneas, productos, variantes, destacados y recetas", () => {
  var json = JSON.parse(read("baristop-v2/data/default-content.json"));
  var catIds = new Set(json.categories.map((c: any) => c.id));
  var prodIds = new Set(json.products.map((p: any) => p.id));
  var recipeIds = new Set(json.recipes.map((r: any) => r.id));
  assert.equal(json.categories.filter((c: any) => c.group === "maquinaria").length, 3);
  assert.equal(json.categories.filter((c: any) => c.group === "insumos").length, 4);
  for (var p of json.products) {
    assert.ok(catIds.has(p.categoryId), p.id);
    for (var r of p.relatedRecipes) assert.ok(recipeIds.has(r), p.id + " receta " + r);
    for (var rp of p.relatedProducts) assert.ok(prodIds.has(rp), p.id + " relacionado " + rp);
    assert.ok(json.variants.some((v: any) => v.productId === p.id), p.id + " sin presentaciones");
    for (var ph of p.photos) {
      if (!ph.startsWith("https://")) assert.ok(statSync(join(ROOT, "baristop-v2", ph)).isFile(), ph);
    }
  }
  assert.equal(json.products.filter((p: any) => p.featured).length, 4);
  assert.deepEqual(
    Object.keys(json.site).filter((k) => !(Shared as any).SCHEMA.siteKeys.some((s: any) => s.key === k)),
    [],
  );
});

test("la semilla pesa menos de 64 KB", () => {
  assert.ok(read("baristop-v2/data/default-content.json").length < 64 * 1024);
});

test("Code.gs: el bucle de setup() salta el sembrado de las pestañas del catálogo y migra después", () => {
  var code = read("apps-script/Code.gs");
  assert.match(code, /var CATALOG_SECTIONS = \["categories", "products", "variants"\]/);
  assert.match(code, /if \(CATALOG_SECTIONS\.indexOf\(name\) === -1\) seedTab_\(/);
  assert.ok(code.indexOf("migrateCatalog_(ss, report);") > code.indexOf("if (CATALOG_SECTIONS.indexOf(name) === -1) seedTab_("), "migrateCatalog_ corre después del bucle");
  assert.match(code, /^function migrateCatalog\(\) \{/m, "migrateCatalog está expuesta para el editor");
  assert.deepEqual((Shared as any).CATALOG_SECTIONS, ["categories", "products", "variants"]);
});
