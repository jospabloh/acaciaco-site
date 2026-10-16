import { test } from "node:test";
import assert from "node:assert/strict";
import Shared from "../apps-script/Shared.js";
import DEFAULT_CONTENT from "../apps-script/DefaultContent.js";

var S: any = Shared;
var D: any = DEFAULT_CONTENT;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function headerFor(section: string): string[] {
  var def = S.SCHEMA.sections[section];
  return def.kind === "settings" ? def.headers.slice() : def.fields.map((f: any) => f.header);
}

function tabsFrom(content: any): any {
  var tabs: any = {};
  S.SECTION_NAMES.forEach((name: string) => {
    var def = S.SCHEMA.sections[name];
    var rows =
      name === "site"
        ? S.objectToSettings(Object.assign({}, content.site, { _updatedAt: content.updatedAt }), {})
        : S.itemsToRows(name, headerFor(name), content[name]);
    tabs[def.tab] = { header: headerFor(name), rows: rows };
  });
  return tabs;
}

var branchRow = () => clone(D.branches[0]);

// ------------------------------------------------------------- primitives

test("isSafeHttpsUrl solo acepta https:// completo", () => {
  assert.equal(S.isSafeHttpsUrl("https://www.instagram.com/baristop_distribuidora/"), true);
  assert.equal(S.isSafeHttpsUrl("https://lh3.googleusercontent.com/d/abc123"), true);
  for (var bad of [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "http://example.com",
    "data:text/html;base64,AAAA",
    "//example.com",
    "/baristop-v2/algo",
    "assets/foto.jpg",
    "https://",
    "https:// espacio.com",
    "https://a.com/x y",
    " https://a.com",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(S.isSafeHttpsUrl(bad), false, String(bad));
  }
});

test("isEmail y normalizeDigits", () => {
  assert.equal(S.isEmail("roseta.cafeteria@gmail.com"), true);
  assert.equal(S.isEmail("Por definir"), false);
  assert.equal(S.isEmail("a@b"), false);
  assert.equal(S.isEmail(null), false);
  assert.equal(S.normalizeDigits("+52 (449) 178-4526"), "524491784526");
  assert.equal(S.normalizeDigits(null), "");
});

test("isMailable rechaza listas y nombres con corchetes en un solo valor", () => {
  assert.equal(S.isMailable("a@b.co"), true);
  assert.equal(S.isMailable("a@b.co,c@d.co"), false);
  assert.equal(S.isMailable("Ana <a@b.co>"), false);
});

test("safeEqual es falso con vacíos, tipos distintos y longitudes distintas", () => {
  assert.equal(S.safeEqual("abc", "abc"), true);
  assert.equal(S.safeEqual("abc", "abd"), false);
  assert.equal(S.safeEqual("abc", "abcd"), false);
  assert.equal(S.safeEqual("", ""), false);
  assert.equal(S.safeEqual(null, "a"), false);
  assert.equal(S.safeEqual("a", undefined), false);
});

test("sha256HexIsValid", () => {
  assert.equal(S.sha256HexIsValid("a".repeat(64)), true);
  assert.equal(S.sha256HexIsValid("A".repeat(64)), false);
  assert.equal(S.sha256HexIsValid("a".repeat(63)), false);
  assert.equal(S.sha256HexIsValid(undefined), false);
});

// ------------------------------------------------------------------ tokens

var sigFn = (payload: string) => "sig_" + payload.replace(/\./g, "_") + "_abcdefghijkl";

function makeToken(exp: number, nonce = "123e4567-e89b-12d3-a456-426614174000") {
  var payload = "v1." + exp + "." + nonce;
  return payload + "." + sigFn(payload);
}

test("parseToken extrae exp, nonce y firma", () => {
  var t = S.parseToken(makeToken(2000000000));
  assert.equal(t.exp, 2000000000);
  assert.equal(t.nonce, "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(S.parseToken("v2.1.2.3"), null);
  assert.equal(S.parseToken("basura"), null);
  assert.equal(S.parseToken(null), null);
});

test("isTokenValid: vigente, expirado y adulterado", () => {
  var now = 1_900_000_000;
  assert.equal(S.isTokenValid(makeToken(now + 60), now, sigFn), true);
  assert.equal(S.isTokenValid(makeToken(now - 1), now, sigFn), false);
  assert.equal(S.isTokenValid(makeToken(now), now, sigFn), false);
  var tampered = makeToken(now + 60).replace("v1." + (now + 60), "v1." + (now + 99999));
  assert.equal(S.isTokenValid(tampered, now, sigFn), false);
  assert.equal(S.isTokenValid("", now, sigFn), false);
  assert.equal(S.isTokenValid(makeToken(now + 60), now, () => ""), false);
});

// ------------------------------------------------------- sheet <-> content

test("headerIndex funciona con columnas en otro orden", () => {
  var header = headerFor("social").reverse();
  var idx = S.headerIndex(header, "social");
  assert.equal(header[idx.name], "Nombre");
  assert.equal(header[idx.url], "URL");
});

test("headerIndex avisa qué columna falta", () => {
  var header = headerFor("branches").filter((h: string) => h !== "Etiqueta asunto");
  assert.throws(() => S.headerIndex(header, "branches"), {
    message: 'Falta la columna "Etiqueta asunto" en la pestaña Sucursales',
  });
});

test("el encabezado de Sucursales incluye 'Etiqueta asunto'", () => {
  assert.ok(headerFor("branches").includes("Etiqueta asunto"));
});

test("rowsToItems / itemsToRows: ida y vuelta con columnas reordenadas", () => {
  var header = headerFor("branches").reverse();
  var rows = S.itemsToRows("branches", header, D.branches);
  assert.equal(rows[0].length, header.length);
  var back = S.rowsToItems("branches", header, rows);
  assert.deepEqual(back, D.branches);
});

test("rowsToItems normaliza celdas escritas a mano", () => {
  var header = headerFor("branches");
  var item = branchRow();
  var row = S.itemsToRows("branches", header, [item])[0];
  var idx = S.headerIndex(header, "branches");
  row[idx.visible] = "";
  row[idx.whatsapp] = 524491784526; // Sheets stores digits as a number
  row[idx.emails] = " a@b.co ;  c@d.co,, ";
  row[idx.hours] = "Lunes · 9\n\n  Martes · 9  \n";
  var out = S.rowsToItems("branches", header, [row, header.map(() => "")])[0];
  assert.equal(out.visible, true);
  assert.equal(out.whatsapp, "524491784526");
  assert.deepEqual(out.emails, ["a@b.co", "c@d.co"]);
  assert.deepEqual(out.hours, ["Lunes · 9", "Martes · 9"]);
  assert.equal(S.rowsToItems("branches", header, [row, header.map(() => "")]).length, 1, "filas vacías se omiten");
});

test("rowsToItems da id a una fila sin ID y lee Date como AAAA-MM-DD", () => {
  var header = headerFor("announcements");
  var idx = S.headerIndex(header, "announcements");
  var row = header.map(() => "");
  row[idx.text] = "Hola";
  row[idx.startsAt] = new Date(2026, 10, 5);
  var out = S.rowsToItems("announcements", header, [row])[0];
  assert.match(out.id, S.ID_PATTERN);
  assert.equal(out.startsAt, "2026-11-05");
});

test("machines.specs se conserva como texto", () => {
  var header = headerFor("machines");
  var item = Object.assign({}, D.machines[0], { specs: "Voltaje: 110 V\nPotencia: 1.4 kW" });
  var row = S.itemsToRows("machines", header, [item])[0];
  assert.equal(S.rowsToItems("machines", header, [row])[0].specs, "Voltaje: 110 V\nPotencia: 1.4 kW");
});

test("las celdas no llevan apóstrofo: el texto se guarda tal cual", () => {
  var header = headerFor("social");
  var item = Object.assign({}, D.social[0], { handle: "@baristop" });
  assert.equal(S.itemsToRows("social", header, [item])[0][S.headerIndex(header, "social").handle], "@baristop");
});

test("rowsToContent reconstruye el contenido semilla (ordenado por orden, luego id)", () => {
  var content = S.rowsToContent(tabsFrom(D));
  var expected = clone(D);
  S.SECTION_NAMES.filter((n: string) => n !== "site").forEach((n: string) => {
    expected[n].sort((a: any, b: any) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  });
  assert.deepEqual(content, expected);
});

test("rowsToContent ordena por order y expone updatedAt", () => {
  var c = clone(D);
  c.social = [Object.assign({}, c.social[0], { order: 50 }), Object.assign({}, c.social[1], { order: 5 })];
  var out = S.rowsToContent(tabsFrom(c));
  assert.deepEqual(out.social.map((s: any) => s.id), ["facebook", "instagram"]);
  assert.equal(out.updatedAt, D.updatedAt);
  assert.equal("_updatedAt" in out.site, false);
});

test("objectToSettings pone las claves del esquema primero y _updatedAt al final", () => {
  var rows = S.objectToSettings({ _updatedAt: "x", zzz: "1", navCta: "Hola" }, {});
  assert.deepEqual(rows.map((r: any) => r[0]), ["navCta", "zzz", "_updatedAt"]);
  assert.ok(rows[0][2].length > 0, "usa la etiqueta del esquema como descripción");
});

// -------------------------------------------------------------- validation

test("el contenido semilla pasa validateSection en todas las secciones", () => {
  var ctx = {
    categoryIds: D.machineryCategories.map((c: any) => c.id),
    productIds: D.products.map((p: any) => p.id),
  };
  S.SECTION_NAMES.forEach((name: string) => {
    var c = name === "products" ? { categoryIds: D.categories.map((x: any) => x.id) } : ctx;
    var r = S.validateSection(name, name === "site" ? D.site : D[name], c);
    assert.deepEqual(r.errors, [], name);
    assert.equal(r.ok, true, name);
  });
});

test("validateSection rechaza URLs que no son https en todos los campos url", () => {
  var cases: Array<[string, string, string]> = [
    ["social", "url", "social"],
    ["branches", "mapUrl", "branches"],
    ["recipes", "videoUrl", "recipes"],
    ["alliances", "url", "alliances"],
    ["announcements", "url", "announcements"],
    ["promos", "ctaUrl", "promos"],
  ];
  var seeds: any = {
    social: D.social[0],
    branches: D.branches[0],
    recipes: Object.assign({}, D.recipes[0], { photo: "assets/x.jpg" }),
    alliances: D.alliances[0],
    announcements: { id: "aviso-1", order: 10, visible: true, text: "Hola", url: "", startsAt: "", endsAt: "" },
    promos: { id: "promo-1", order: 10, visible: true, title: "P", text: "", image: "", ctaLabel: "", ctaUrl: "", startsAt: "", endsAt: "" },
  };
  for (var [section, field] of cases) {
    for (var bad of ["javascript:alert(1)", "http://x.com", "data:text/html,hola", "www.x.com"]) {
      var row = Object.assign({}, seeds[section], { [field]: bad });
      var r = S.validateSection(section, [row]);
      assert.equal(r.ok, false, section + "." + field + " " + bad);
      assert.equal(r.errors[0].field, field);
    }
    var ok = S.validateSection(section, [Object.assign({}, seeds[section], { [field]: "https://example.com/x" })]);
    assert.equal(ok.ok, true, section + "." + field);
  }
});

test("validateSection: campos de imagen aceptan https o ruta relativa, no javascript:", () => {
  var base = D.insumos[0];
  assert.equal(S.validateSection("insumos", [Object.assign({}, base, { image: "assets/ejemplo/frappe-taro.jpg" })]).ok, true);
  assert.equal(S.validateSection("insumos", [Object.assign({}, base, { image: "https://lh3.googleusercontent.com/d/x" })]).ok, true);
  assert.equal(S.validateSection("insumos", [Object.assign({}, base, { image: "javascript:alert(1)" })]).ok, false);
  assert.equal(S.validateSection("insumos", [Object.assign({}, base, { image: "../secreto.jpg" })]).ok, false);
  assert.equal(S.validateSection("insumos", [Object.assign({}, base, { image: "http://x.com/a.jpg" })]).ok, false);
});

test("validateSection: ids inválidos y repetidos", () => {
  var a = Object.assign({}, D.social[0]);
  var dup = S.validateSection("social", [a, Object.assign({}, a)]);
  assert.equal(dup.ok, false);
  assert.match(dup.errors[0].message, /repetido/);
  assert.equal(S.validateSection("social", [Object.assign({}, a, { id: "Mal Id" })]).ok, false);
  assert.equal(S.validateSection("social", [Object.assign({}, a, { id: "a" })]).ok, false);
});

test("validateSection: la portada admite máximo 4 imágenes", () => {
  var rows = D.heroImages.concat([{ id: "quinta", order: 50, visible: true, title: "Quinta", image: "", alt: "" }]);
  var r = S.validateSection("heroImages", rows);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].message, "La portada admite máximo 4 imágenes.");
  assert.equal(S.validateSection("heroImages", D.heroImages).ok, true);
});

test("validateSection: Etiqueta asunto es obligatoria y de máximo 24 caracteres", () => {
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { subjectTag: "" })]).ok, false);
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { subjectTag: "x".repeat(25) })]).ok, false);
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { subjectTag: "x".repeat(24) })]).ok, true);
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { subjectTag: "[A]\n[B]" })]).ok, false);
});

test("validateSection: WhatsApp y teléfono de 10 a 15 dígitos", () => {
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { whatsapp: "123" })]).ok, false);
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { phone: "1".repeat(16) })]).ok, false);
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { whatsapp: "52 449 178 4526" })]).ok, true);
});

test("validateSection: correos públicos admiten 'Por definir'; los de cotización no", () => {
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { emails: ["Por definir"] })]).ok, true);
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { emails: ["no-es-correo"] })]).ok, false);
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { quoteRecipients: ["Por definir"] })]).ok, false);
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { quoteRecipients: ["a@b.co,c@d.co"] })]).ok, false);
  assert.equal(S.validateSection("branches", [Object.assign(branchRow(), { quoteRecipients: [] })]).ok, true);
});

test("validateSection: fechas AAAA-MM-DD y Desde <= Hasta", () => {
  var base = { id: "aviso-1", order: 10, visible: true, text: "Hola", url: "" };
  assert.equal(S.validateSection("announcements", [Object.assign({}, base, { startsAt: "2026-11-01", endsAt: "2026-11-30" })]).ok, true);
  assert.equal(S.validateSection("announcements", [Object.assign({}, base, { startsAt: "2026-13-01", endsAt: "" })]).ok, false);
  assert.equal(S.validateSection("announcements", [Object.assign({}, base, { startsAt: "01/11/2026", endsAt: "" })]).ok, false);
  assert.equal(S.validateSection("announcements", [Object.assign({}, base, { startsAt: "2026-12-01", endsAt: "2026-11-30" })]).ok, false);
  assert.equal(S.validateSection("announcements", [Object.assign({}, base, { startsAt: "2026-02-30", endsAt: "" })]).ok, false);
});

test("validateSection: una receta necesita foto o video", () => {
  var r = Object.assign({}, D.recipes[0], { photo: "", videoUrl: "" });
  assert.equal(S.validateSection("recipes", [r]).ok, false);
  assert.equal(S.validateSection("recipes", [Object.assign({}, r, { videoUrl: "https://youtu.be/abc" })]).ok, true);
});

test("validateSection: la categoría de una máquina debe existir", () => {
  var m = D.machines[0];
  assert.equal(S.validateSection("machines", [m], { categoryIds: ["cafeteras"] }).ok, true);
  assert.equal(S.validateSection("machines", [Object.assign({}, m, { categoryId: "fantasma" })], { categoryIds: ["cafeteras"] }).ok, false);
});

test("validateSection(site): quoteAlwaysTo exige al menos un correo válido", () => {
  var site = clone(D.site);
  var msg = "Silvia debe recibir todas las solicitudes: escribe al menos un correo válido.";
  for (var bad of ["", "   ", "no-es-correo", " , "]) {
    var r = S.validateSection("site", Object.assign({}, site, { quoteAlwaysTo: bad }));
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.ok(r.errors.some((e: any) => e.message === msg), JSON.stringify(bad));
  }
  delete site.quoteAlwaysTo;
  assert.equal(S.validateSection("site", site).ok, false);
  assert.equal(S.validateSection("site", Object.assign({}, D.site, { quoteAlwaysTo: "a@b.co, c@d.co" })).ok, true);
});

test("validateSection(site): rechaza claves del sistema, valores no texto y datos malformados", () => {
  assert.equal(S.validateSection("site", Object.assign({}, D.site, { _updatedAt: "x" })).ok, false);
  assert.equal(S.validateSection("site", Object.assign({}, D.site, { navCta: { a: 1 } })).ok, false);
  assert.equal(S.validateSection("site", Object.assign({}, D.site, { navCta: "x".repeat(2001) })).ok, false);
  assert.equal(S.validateSection("site", null).ok, false);
  assert.equal(S.validateSection("social", "no es lista").ok, false);
  assert.equal(S.validateSection("social", [null]).ok, false);
  assert.equal(S.validateSection("inexistente", []).ok, false);
});

// ---------------------------------------------------------------- privacy

test("stripPrivate quita los correos privados y no modifica el original", () => {
  var full = clone(D);
  var pub = S.stripPrivate(full);
  assert.equal("quoteAlwaysTo" in pub.site, false);
  assert.equal("quoteFallbackTo" in pub.site, false);
  pub.branches.forEach((b: any) => assert.deepEqual(b.quoteRecipients, []));
  assert.deepEqual(full, D, "el original queda intacto");
  var json = JSON.stringify(pub);
  assert.equal(json.includes("roseta.cafeteria@gmail.com"), false);
  assert.equal(json.includes("quoteRecipients\":[\"") , false);
  // correos públicos de contacto siguen ahí
  assert.deepEqual(pub.branches[0].emails, D.branches[0].emails);
});

// ------------------------------------------------------------- recipients

test("resolveRecipients siempre incluye quoteAlwaysTo", () => {
  var site = { quoteAlwaysTo: "Roseta.Cafeteria@gmail.com", quoteFallbackTo: "respaldo@gmail.com" };
  for (var branch of D.branches.concat([{ quoteRecipients: [] }, {}, null])) {
    var to = S.resolveRecipients(branch, site);
    assert.ok(to.includes("roseta.cafeteria@gmail.com"));
    assert.equal(to.includes("respaldo@gmail.com"), false, "el respaldo solo se usa si no hay nada más");
  }
});

test("resolveRecipients: sucursal ∪ siempre, minúsculas, sin repetidos ni basura", () => {
  var to = S.resolveRecipients(
    { quoteRecipients: ["Karime.Baristop@gmail.com", "Por definir", "karime.baristop@gmail.com", "x@y.co,z@w.co"] },
    { quoteAlwaysTo: "roseta.cafeteria@gmail.com, KARIME.baristop@gmail.com" }
  );
  assert.deepEqual(to, ["karime.baristop@gmail.com", "roseta.cafeteria@gmail.com"]);
});

test("resolveRecipients: Aguascalientes y Durango reciben cada uno su lista más Silvia", () => {
  assert.deepEqual(S.resolveRecipients(D.branches[0], D.site), ["ventas.baristop@gmail.com", "roseta.cafeteria@gmail.com"]);
  assert.deepEqual(S.resolveRecipients(D.branches[1], D.site), ["karime.baristop@gmail.com", "roseta.cafeteria@gmail.com"]);
});

test("resolveRecipients usa el respaldo solo cuando no queda nadie, y [] si tampoco hay respaldo", () => {
  assert.deepEqual(S.resolveRecipients({ quoteRecipients: [] }, { quoteAlwaysTo: "", quoteFallbackTo: "R@x.co" }), ["r@x.co"]);
  assert.deepEqual(S.resolveRecipients({ quoteRecipients: ["Por definir"] }, { quoteAlwaysTo: "basura", quoteFallbackTo: "" }), []);
});

// ------------------------------------------------------------------- mail

var body = () => ({
  branchId: "ags",
  name: "María López",
  business: "Café Central",
  contact: "maria@correo.com",
  need: "Maquinaria / equipo",
  message: "Busco una cafetera <b>de dos grupos</b>.\nGracias",
});

test("buildQuoteEmail: asunto = etiqueta de la sucursal + nombre (negocio)", () => {
  var ags = S.buildQuoteEmail(body(), D.branches[0], D.site, "2026-10-15T12:00:00.000Z");
  assert.equal(ags.subject, "[BARISTOP AGS] María López (Café Central)");
  var dgo = S.buildQuoteEmail(body(), D.branches[1], D.site, "2026-10-15T12:00:00.000Z");
  assert.equal(dgo.subject, "[BARISTOP DGO] María López (Café Central)");
  var custom = S.buildQuoteEmail(body(), Object.assign({}, D.branches[0], { subjectTag: "[NUEVA]" }), D.site, "");
  assert.equal(custom.subject.startsWith("[NUEVA] "), true);
});

test("buildQuoteEmail: sin negocio no hay paréntesis; etiqueta vacía cae en [BARISTOP]", () => {
  var out = S.buildQuoteEmail(Object.assign(body(), { business: "" }), Object.assign({}, D.branches[0], { subjectTag: "" }), D.site, "");
  assert.equal(out.subject, "[BARISTOP] María López");
});

test("buildQuoteEmail: replyTo solo si el contacto es un correo; teléfono va primero en el cuerpo", () => {
  var mail = S.buildQuoteEmail(body(), D.branches[0], D.site, "");
  assert.equal(mail.replyTo, "maria@correo.com");
  var phone = S.buildQuoteEmail(Object.assign(body(), { contact: "449 178 4526" }), D.branches[0], D.site, "");
  assert.equal(phone.replyTo, "");
  assert.equal(phone.text.split("\n")[0], "Responder a: 449 178 4526");
});

test("buildQuoteEmail: escapa HTML y evita inyección de encabezados en el asunto", () => {
  var out = S.buildQuoteEmail(
    Object.assign(body(), { name: "Ana\r\nBcc: x@y.co", business: "<script>alert(1)</script>" }),
    D.branches[0],
    D.site,
    ""
  );
  assert.equal(/[\r\n]/.test(out.subject), false);
  assert.equal(out.html.includes("<script>"), false);
  assert.equal(out.html.includes("&lt;b&gt;de dos grupos&lt;/b&gt;"), true);
});

test("buildQuoteEmail usa la hora ya formateada si se pasa", () => {
  var out = S.buildQuoteEmail(body(), D.branches[0], D.site, "2026-10-15T12:00:00.000Z", "15/10/2026 06:00");
  assert.ok(out.text.includes("15/10/2026 06:00"));
});

test("validateQuote: solicitud válida", () => {
  var now = 1_760_000_000_000;
  var r = S.validateQuote(Object.assign(body(), { website: "", ts: now - 10000 }), { nowMs: now, branchIds: ["ags", "durango"] });
  assert.equal(r.ok, true);
  assert.equal(r.silent, false);
});

test("validateQuote: honeypot y tiempos se descartan en silencio", () => {
  var now = 1_760_000_000_000;
  var opts = { nowMs: now, branchIds: ["ags"] };
  assert.deepEqual(
    [S.validateQuote(Object.assign(body(), { website: "http://spam", ts: now - 10000 }), opts).silent,
     S.validateQuote(Object.assign(body(), { sitio_web: "x", ts: now - 10000 }), opts).silent,
     S.validateQuote(Object.assign(body(), { website: "", ts: now - 1000 }), opts).silent,
     S.validateQuote(Object.assign(body(), { website: "", ts: now - 25 * 3600 * 1000 }), opts).silent,
     S.validateQuote(Object.assign(body(), { website: "" }), opts).silent],
    [true, true, true, true, true]
  );
});

test("validateQuote: errores de campos", () => {
  var now = 1_760_000_000_000;
  var good = Object.assign(body(), { website: "", ts: now - 10000 });
  var opts = { nowMs: now, branchIds: ["ags"] };
  var cases: Array<[any, string]> = [
    [{ name: "A" }, "name"],
    [{ name: "x".repeat(81) }, "name"],
    [{ contact: "hola" }, "contact"],
    [{ contact: "123456789" }, "contact"],
    [{ business: "x".repeat(121) }, "business"],
    [{ message: "x".repeat(2001) }, "message"],
    [{ need: "Otra cosa" }, "need"],
    [{ branchId: "otra" }, "branchId"],
    [{ branchId: null }, "branchId"],
    [{ name: 42 }, "name"],
  ];
  for (var [patch, field] of cases) {
    var r = S.validateQuote(Object.assign({}, good, patch), opts);
    assert.equal(r.ok, false, field);
    assert.equal(r.silent, false);
    assert.ok(r.errors.some((e: any) => e.field === field), field);
  }
  assert.equal(S.validateQuote(Object.assign({}, good, { contact: "+52 449 178 4526" }), opts).ok, true);
  assert.equal(S.validateQuote(Object.assign({}, good, { business: "", message: "" }), opts).ok, true);
  assert.equal(S.validateQuote(null, opts).ok, false);
});

test("las opciones de 'Qué buscas' son las del formulario", () => {
  assert.equal(S.QUOTE_NEEDS.length, 7);
  assert.ok(S.QUOTE_NEEDS.includes("Franquicia / Baristop en mi ciudad"));
  assert.equal(S.QUOTE_NEEDS[6], "Lista de productos");
});

// ------------------------------------------------------------------ dates

test("isWithinDates respeta límites abiertos y cerrados", () => {
  var item = (s: string, e: string) => ({ startsAt: s, endsAt: e });
  assert.equal(S.isWithinDates(item("", ""), "2026-10-15"), true);
  assert.equal(S.isWithinDates(item("2026-10-15", "2026-10-15"), "2026-10-15"), true);
  assert.equal(S.isWithinDates(item("2026-10-16", ""), "2026-10-15"), false);
  assert.equal(S.isWithinDates(item("", "2026-10-14"), "2026-10-15"), false);
  assert.equal(S.isWithinDates(item("", "2026-10-15"), "2026-10-15"), true);
});

// ---------------------------------------------------------------- uploads

function uploadBody(patch: any = {}) {
  return Object.assign(
    { section: "alliances", field: "logo", itemId: "yalini", name: "logo", mime: "image/png", dataBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" },
    patch
  );
}

test("validateUploadMeta acepta un campo de imagen conocido y calcula el tope", () => {
  var r = S.validateUploadMeta(uploadBody());
  assert.equal(r.ok, true);
  assert.equal(r.maxBytes, Math.floor(150 * 1024 * 1.2));
  assert.equal(r.ext, "png");
});

test("validateUploadMeta rechaza campos, tipos, SVG fuera de logos y exceso de tamaño", () => {
  assert.equal(S.validateUploadMeta(uploadBody({ field: "nombre" })).ok, false);
  assert.equal(S.validateUploadMeta(uploadBody({ section: "social" })).ok, false);
  assert.equal(S.validateUploadMeta(uploadBody({ itemId: "../x" })).ok, false);
  assert.equal(S.validateUploadMeta(uploadBody({ mime: "application/pdf" })).ok, false);
  assert.equal(S.validateUploadMeta(uploadBody({ mime: "image/svg+xml" })).ok, true);
  assert.equal(S.validateUploadMeta(uploadBody({ section: "insumos", field: "image", mime: "image/svg+xml" })).ok, false);
  assert.equal(S.validateUploadMeta(uploadBody({ dataBase64: "A".repeat(400000) })).ok, false);
  assert.equal(S.validateUploadMeta(uploadBody({ dataBase64: "data:image/png;base64,AAAAAAAAAAAAAAAA" })).ok, false);
  assert.equal(S.validateUploadMeta(null).ok, false);
});

test("sniffImageType reconoce JPEG, PNG, WebP y SVG (bytes con signo incluidos)", () => {
  assert.equal(S.sniffImageType([-1, -40, -1, -32, 0, 16]), "image/jpeg");
  assert.equal(S.sniffImageType([-119, 80, 78, 71, 13, 10, 26, 10]), "image/png");
  assert.equal(S.sniffImageType([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]), "image/webp");
  assert.equal(S.sniffImageType([60, 115, 118, 103], '<svg xmlns="http://www.w3.org/2000/svg"></svg>'), "image/svg+xml");
  assert.equal(S.sniffImageType([37, 80, 68, 70, 45, 49, 46, 52]), "");
});

test("isSafeSvgText rechaza scripts y manejadores", () => {
  assert.equal(S.isSafeSvgText('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'), true);
  assert.equal(S.isSafeSvgText('<svg><script>alert(1)</script></svg>'), false);
  assert.equal(S.isSafeSvgText('<svg onload="alert(1)"></svg>'), false);
  assert.equal(S.isSafeSvgText('<svg><a href="javascript:alert(1)"/></svg>'), false);
  assert.equal(S.isSafeSvgText("<html></html>"), false);
});

test("rowsToItems omite filas que solo tienen la casilla Visible sin marcar", () => {
  // A checkbox column makes every row of the sheet hold `false`, so a fresh tab
  // returns ~999 rows of [ "", "", false, "", ... ] from getValues().
  var header = headerFor("branches");
  var visibleCol = header.indexOf("Visible");
  var blank = header.map(() => "");
  var unchecked = blank.slice();
  (unchecked as any)[visibleCol] = false;
  var checked = blank.slice();
  (checked as any)[visibleCol] = true;
  assert.equal(S.rowsToItems("branches", header, [unchecked, unchecked, checked, blank]).length, 0);
});


// ============================================================ catalog (round 2)

var catalogCtx = () => ({
  categoryIds: D.categories.map((c: any) => c.id),
  productIds: D.products.map((p: any) => p.id),
});

test("rowsToItems / itemsToRows: ida y vuelta para images, ids, enum, money y map", () => {
  var pHeader = headerFor("products");
  var product = clone(D.products.find((p: any) => p.id === "saju-taro-ejemplo"));
  product.photos = ["assets/ejemplo/frappe-taro.jpg", "https://lh3.googleusercontent.com/d/abc123"];
  product.relatedProducts = ["samlet-moca-ejemplo", "licuadora-ejemplo"];
  product.specs = ["Marca: Saju", "Voltaje: 220 V"];
  var pRow = S.itemsToRows("products", pHeader, [product])[0];
  assert.equal(pRow[S.headerIndex(pHeader, "products").photos], "assets/ejemplo/frappe-taro.jpg\nhttps://lh3.googleusercontent.com/d/abc123");
  assert.equal(pRow[S.headerIndex(pHeader, "products").relatedProducts], "samlet-moca-ejemplo, licuadora-ejemplo");
  assert.deepEqual(S.rowsToItems("products", pHeader, [pRow])[0], product);

  var vHeader = headerFor("variants");
  var variant = { id: "saju-taro-1kg", order: 10, visible: true, productId: "saju-taro-ejemplo", name: "1 kg", sku: "SJ-1K", price: 1250.5, unit: "kg", availability: { ags: "disponible", durango: "pedido" }, image: "" };
  var vRow = S.itemsToRows("variants", vHeader, [variant])[0];
  var vIdx = S.headerIndex(vHeader, "variants");
  assert.equal(vRow[vIdx.price], 1250.5);
  assert.equal(vRow[vIdx.availability], "ags=disponible; durango=pedido");
  assert.deepEqual(S.rowsToItems("variants", vHeader, [vRow])[0], variant);

  var cHeader = headerFor("categories");
  var cat = D.categories[0];
  assert.deepEqual(S.rowsToItems("categories", cHeader, S.itemsToRows("categories", cHeader, [cat]))[0], cat);
});

test("celdas escritas a mano: precio vacío = null, estados desconocidos se descartan, Destacado vacío = falso", () => {
  var vHeader = headerFor("variants");
  var idx = S.headerIndex(vHeader, "variants");
  var row = vHeader.map(() => "");
  row[idx.id] = "v-uno";
  row[idx.order] = 10;
  row[idx.productId] = "saju-taro-ejemplo";
  row[idx.name] = "1 kg";
  row[idx.availability] = "ags=disponible; durango=casi; Sucursal Rara=pocas; nueva-suc=agotado";
  var item = S.rowsToItems("variants", vHeader, [row])[0];
  assert.equal(item.price, null);
  assert.deepEqual(item.availability, { ags: "disponible", "nueva-suc": "agotado" });
  row[idx.price] = "$1,250.50";
  assert.equal(S.rowsToItems("variants", vHeader, [row])[0].price, 1250.5);
  row[idx.price] = "1250,5";
  assert.equal(S.rowsToItems("variants", vHeader, [row])[0].price, 1250.5);

  var pHeader = headerFor("products");
  var pRow = pHeader.map(() => "");
  var pIdx = S.headerIndex(pHeader, "products");
  pRow[pIdx.id] = "p-uno";
  pRow[pIdx.categoryId] = "cafe";
  pRow[pIdx.name] = "Algo";
  pRow[pIdx.relatedProducts] = "a-b, a-b, c-d";
  var p = S.rowsToItems("products", pHeader, [pRow])[0];
  assert.equal(p.featured, false);
  assert.deepEqual(p.relatedProducts, ["a-b", "c-d"]);
  assert.deepEqual(p.photos, []);
  assert.deepEqual(p.specs, []);
});

test("machines.specs sigue siendo texto y products.specs es lista", () => {
  assert.equal(typeof S.rowsToItems("machines", headerFor("machines"), S.itemsToRows("machines", headerFor("machines"), [D.machines[0]]))[0].specs, "string");
  assert.ok(Array.isArray(S.rowsToItems("products", headerFor("products"), S.itemsToRows("products", headerFor("products"), [D.products[0]]))[0].specs));
});

test("validateSection(products): slug único y con formato, línea existente, tope de fotos e ids", () => {
  var base = () => clone(D.products);
  var rows = base();
  rows[1].slug = rows[0].slug;
  var r = S.validateSection("products", rows, catalogCtx());
  assert.equal(r.ok, false);
  assert.match(r.errors[0].message, /slug ya lo usa otro producto/);

  rows = base();
  rows[0].slug = "Con Espacios";
  assert.equal(S.validateSection("products", rows, catalogCtx()).ok, false);

  rows = base();
  rows[0].categoryId = "no-existe";
  assert.match(S.validateSection("products", rows, catalogCtx()).errors[0].message, /elige una línea/);

  rows = base();
  rows[0].photos = ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg", "g.jpg"];
  assert.match(S.validateSection("products", rows, catalogCtx()).errors[0].message, /Máximo 6 fotos/);

  rows = base();
  rows[0].photos = ["javascript:alert(1)"];
  assert.equal(S.validateSection("products", rows, catalogCtx()).ok, false);

  rows = base();
  rows[0].relatedProducts = Array.from({ length: 11 }, (_, i) => "prod-" + i);
  assert.equal(S.validateSection("products", rows, catalogCtx()).ok, false);
  rows[0].relatedProducts = ["MAL ID"];
  assert.equal(S.validateSection("products", rows, catalogCtx()).ok, false);

  rows = base();
  rows[0].summary = "x".repeat(161);
  assert.equal(S.validateSection("products", rows, catalogCtx()).ok, false);
});

test("validateSection(variants): precio, disponibilidad y producto existente", () => {
  var v = () => clone(D.variants);
  var cases: Array<[string, (rows: any[]) => void, boolean]> = [
    ["precio 1250", (r) => { r[0].price = 1250; }, true],
    ["precio 1250.5", (r) => { r[0].price = 1250.5; }, true],
    ["precio 0", (r) => { r[0].price = 0; }, true],
    ["precio negativo", (r) => { r[0].price = -1; }, false],
    ["tres decimales", (r) => { r[0].price = 10.125; }, false],
    ["precio como texto", (r) => { r[0].price = "12"; }, false],
    ["precio enorme", (r) => { r[0].price = 10000000; }, false],
    ["NaN", (r) => { r[0].price = NaN; }, false],
    ["estado válido", (r) => { r[0].availability = { ags: "pocas", durango: "agotado" }; }, true],
    ["estado inválido", (r) => { r[0].availability = { ags: "casi" }; }, false],
    ["clave inválida", (r) => { r[0].availability = { "Mi Sucursal": "pocas" }; }, false],
    ["producto inexistente", (r) => { r[0].productId = "fantasma"; }, false],
    ["nombre vacío", (r) => { r[0].name = ""; }, false],
  ];
  for (var [label, mutate, ok] of cases) {
    var rows = v();
    mutate(rows);
    assert.equal(S.validateSection("variants", rows, catalogCtx()).ok, ok, label);
  }
  assert.match(S.validateSection("variants", (() => { var r = v(); r[0].price = -1; return r; })(), catalogCtx()).errors[0].message, /precio válido/);
});

test("validateSection(categories): grupo del vocabulario y nombre obligatorio", () => {
  var rows = clone(D.categories);
  rows[0].group = "otros";
  assert.equal(S.validateSection("categories", rows).ok, false);
  rows = clone(D.categories);
  rows[0].group = "";
  assert.equal(S.validateSection("categories", rows).ok, false);
  rows = clone(D.categories);
  rows[0].name = "";
  assert.equal(S.validateSection("categories", rows).ok, false);
});

test("topes por sección: variantes 500, productos y categorías 300", () => {
  var mkVariant = (i: number) => ({ id: "var-" + i, order: i, visible: true, productId: "saju-taro-ejemplo", name: "P " + i, sku: "", price: null, unit: "", availability: {}, image: "" });
  var mkProduct = (i: number) => ({ id: "prod-" + i, order: i, visible: true, categoryId: "cafe", brand: "", name: "Producto " + i, slug: "", summary: "", description: "", photos: [], specs: [], usage: "", relatedRecipes: [], relatedProducts: [], featured: false });
  var variants = Array.from({ length: 500 }, (_, i) => mkVariant(i));
  assert.equal(S.validateSection("variants", variants, catalogCtx()).ok, true);
  var over = S.validateSection("variants", variants.concat(mkVariant(500)), catalogCtx());
  assert.equal(over.ok, false);
  assert.match(over.errors[0].message, /máximo 500/);

  var products = Array.from({ length: 300 }, (_, i) => mkProduct(i));
  assert.equal(S.validateSection("products", products, catalogCtx()).ok, true);
  var overP = S.validateSection("products", products.concat(mkProduct(300)), catalogCtx());
  assert.equal(overP.ok, false);
  assert.match(overP.errors[0].message, /máximo 300/);
});

test("un catálogo de 150 productos y 500 presentaciones valida, pesa < 400 KB y cabe en <= 5 trozos de caché", async () => {
  var zlib = await import("node:zlib");
  var categories = D.categories;
  var products: any[] = [];
  var variants: any[] = [];
  for (var i = 0; i < 150; i++) {
    products.push({
      id: "prod-" + i, order: i * 10, visible: true, categoryId: categories[i % categories.length].id, brand: "Marca " + (i % 7),
      name: "Producto de prueba número " + i, slug: "producto-prueba-" + i, summary: "Resumen corto de la ficha " + i,
      description: "Descripción larga. ".repeat(40), photos: ["https://lh3.googleusercontent.com/d/" + "x".repeat(33) + i, "assets/ejemplo/frappe-taro.jpg"],
      specs: Array.from({ length: 10 }, (_, k) => "Etiqueta " + k + ": Valor " + k), usage: "Uso sugerido. ".repeat(40),
      relatedRecipes: ["frappe-taro"], relatedProducts: ["prod-" + ((i + 1) % 150)], featured: i % 10 === 0,
    });
  }
  for (var j = 0; j < 500; j++) {
    variants.push({ id: "var-" + j, order: j, visible: true, productId: "prod-" + (j % 150), name: "Presentación " + j, sku: "SKU-" + j, price: 100 + j, unit: "kg", availability: { ags: "disponible", durango: "pedido" }, image: "" });
  }
  var ctx = { categoryIds: categories.map((c: any) => c.id), productIds: products.map((p) => p.id) };
  assert.deepEqual(S.validateSection("products", products, ctx).errors, []);
  assert.deepEqual(S.validateSection("variants", variants, ctx).errors, []);

  var doc = Object.assign({}, clone(D), { categories: categories, products: products, variants: variants, machineryCategories: [], machines: [], insumos: [] });
  var json = JSON.stringify(doc);
  assert.ok(json.length < 400 * 1024, "JSON de " + json.length + " bytes");

  var raw = S.chunkString(json, 90000);
  assert.ok(raw.length <= 5, raw.length + " trozos sin comprimir");
  assert.equal(S.joinChunks(raw), json);

  var packed = zlib.gzipSync(Buffer.from(json)).toString("base64");
  var chunks = S.chunkString(packed, 90000);
  assert.ok(chunks.length <= 5 && chunks.every((c: string) => c.length <= 90000));
  var back = zlib.gunzipSync(Buffer.from(S.joinChunks(chunks), "base64")).toString("utf8");
  assert.deepEqual(JSON.parse(back), doc);
});

test("chunkString / joinChunks: casos límite", () => {
  assert.deepEqual(S.chunkString("", 10), []);
  assert.deepEqual(S.chunkString("abcdef", 4), ["abcd", "ef"]);
  assert.equal(S.joinChunks(S.chunkString("á".repeat(25), 10)), "á".repeat(25));
  assert.equal(S.joinChunks(null), "");
});

test("el contenido semilla pesa menos de 64 KB", () => {
  assert.ok(JSON.stringify(D).length < 64 * 1024);
});

// ------------------------------------------------------------ catalog helpers

test("priceSummary: none / single / from", () => {
  assert.deepEqual(S.priceSummary([]), { kind: "none", min: null });
  assert.deepEqual(S.priceSummary(undefined), { kind: "none", min: null });
  assert.deepEqual(S.priceSummary([{ price: null }, { price: null }]), { kind: "none", min: null });
  assert.deepEqual(S.priceSummary([{ price: 1250 }]), { kind: "single", min: 1250 });
  assert.deepEqual(S.priceSummary([{ price: 1250 }, { price: 1250 }]), { kind: "single", min: 1250 });
  assert.deepEqual(S.priceSummary([{ price: 1250 }, { price: 890 }, { price: null }]), { kind: "from", min: 890 });
  assert.deepEqual(S.priceSummary([{ price: 1250 }, { price: null }]), { kind: "from", min: 1250 });
  assert.deepEqual(S.priceSummary([{ price: 5, visible: false }, { price: 1250 }]), { kind: "single", min: 1250 });
});

test("formatMoney: es-MX, decimales solo si hacen falta", () => {
  assert.equal(S.formatMoney(1250), "$1,250");
  assert.equal(S.formatMoney(1250.5), "$1,250.50");
  assert.equal(S.formatMoney(0), "$0");
  assert.equal(S.formatMoney(999), "$999");
  assert.equal(S.formatMoney(1234567.89), "$1,234,567.89");
  assert.equal(S.formatMoney(1250, true), "$1,250.00");
  assert.equal(S.formatMoney(0.07), "$0.07");
  assert.equal(S.formatMoney(null), "");
  assert.equal(S.formatMoney(NaN), "");
});

test("slugify quita acentos y signos", () => {
  assert.equal(S.slugify("Café Coatepec 1 kg"), "cafe-coatepec-1-kg");
  assert.equal(S.slugify("  Soy Té — Ñame & Co.  "), "soy-te-name-co");
  assert.equal(S.slugify(""), "");
  assert.equal(S.slugify(null), "");
  var long = S.slugify("palabra ".repeat(20));
  assert.ok(long.length <= 60 && !/-$/.test(long));
});

test("rootLink: las cuatro formas de alojamiento (spec 12.4)", () => {
  var root = "https://x/baristop-v2/";
  assert.equal(S.rootLink("catalogo?c=molinos", { pathname: "/baristop-v2/catalogo" }, root), "/baristop-v2/catalogo?c=molinos");
  assert.equal(S.rootLink("catalogo?c=molinos", { pathname: "/baristop-v2/catalogo/" }, root), "/baristop-v2/catalogo/?c=molinos");
  assert.equal(S.rootLink("catalogo?c=molinos", { pathname: "/baristop-v2/catalogo/index.html" }, root), "/baristop-v2/catalogo/index.html?c=molinos");
  assert.equal(S.rootLink("#cotiza", { pathname: "/baristop-v2/catalogo" }, root), "/baristop-v2#cotiza");
  assert.equal(S.rootLink("#cotiza", { pathname: "/baristop-v2/catalogo/" }, root), "/baristop-v2/#cotiza");
  assert.equal(S.rootLink("#cotiza", { pathname: "/baristop-v2/catalogo/index.html" }, root), "/baristop-v2/index.html#cotiza");
  assert.equal(S.rootLink("", { pathname: "/baristop-v2/catalogo" }, root), "/baristop-v2");
  assert.equal(S.rootLink("", { pathname: "/baristop-v2/catalogo/" }, root), "/baristop-v2/");
});

test("AVAILABILITY_*: cuatro estados con etiqueta", () => {
  assert.deepEqual(S.AVAILABILITY_STATES, ["disponible", "pocas", "pedido", "agotado"]);
  S.AVAILABILITY_STATES.forEach((k: string) => assert.ok(S.AVAILABILITY_LABELS[k]));
  assert.equal(S.AVAILABILITY_LABELS.pocas, "Pocas piezas");
});

test("legacyToCatalog sobre la semilla de la ronda 1: 7 líneas, un producto y una variante por máquina", () => {
  var legacy = { machineryCategories: D.machineryCategories, insumos: D.insumos, machines: D.machines };
  var out = S.legacyToCatalog(legacy);
  assert.equal(out.categories.length, 7);
  assert.deepEqual(out.categories.map((c: any) => c.group), ["maquinaria", "maquinaria", "maquinaria", "insumos", "insumos", "insumos", "insumos"]);
  var ordered = out.categories.slice().sort((a: any, b: any) => a.order - b.order).map((c: any) => c.id);
  assert.deepEqual(ordered, ["cafeteras", "molinos", "licuadoras", "cafe", "polvos", "jarabes", "tisanas"]);
  assert.equal(out.products.length, D.machines.length);
  assert.equal(out.variants.length, D.machines.length);
  out.products.forEach((p: any, i: number) => {
    assert.equal(p.name, D.machines[i].name);
    assert.equal(p.categoryId, D.machines[i].categoryId);
    assert.equal(p.visible, D.machines[i].visible);
  });
  out.variants.forEach((v: any, i: number) => {
    assert.equal(v.productId, D.machines[i].id);
    assert.equal(v.id, D.machines[i].id + "-std");
    assert.equal(v.name, "Modelo estándar");
    assert.equal(v.price, null);
  });
  var ctx = { categoryIds: out.categories.map((c: any) => c.id), productIds: out.products.map((p: any) => p.id) };
  assert.deepEqual(S.validateSection("categories", out.categories).errors, []);
  assert.deepEqual(S.validateSection("products", out.products, ctx).errors, []);
  assert.deepEqual(S.validateSection("variants", out.variants, ctx).errors, []);
});

test("legacyToCatalog copia nombre, descripción, foto y especificaciones de la máquina tal cual", () => {
  var out = S.legacyToCatalog({
    machineryCategories: [{ id: "molinos", order: 20, visible: true, name: "Molinos", tagline: "t", description: "d", image: "" }],
    insumos: [{ id: "cafe", order: 10, visible: true, name: "Café", tagline: "", description: "", image: "" }],
    machines: [{ id: "molino-uno", order: 10, visible: true, categoryId: "molinos", name: "Molino X", description: "Muele", specs: "Voltaje: 110 V\n\nPotencia: 1.4 kW", image: "assets/a.jpg" }],
  });
  assert.deepEqual(out.products[0].specs, ["Voltaje: 110 V", "Potencia: 1.4 kW"]);
  assert.deepEqual(out.products[0].photos, ["assets/a.jpg"]);
  assert.equal(out.products[0].description, "Muele");
  assert.equal(out.categories[1].order, 1010);
  assert.deepEqual(S.legacyToCatalog({}), { categories: [], products: [], variants: [] });
});

test("legacyToCatalog: un id de insumo repetido con una categoría de maquinaria se renombra", () => {
  var out = S.legacyToCatalog({
    machineryCategories: [{ id: "cafe", order: 10, visible: true, name: "A", tagline: "", description: "", image: "" }],
    insumos: [{ id: "cafe", order: 10, visible: true, name: "B", tagline: "", description: "", image: "" }],
    machines: [],
  });
  var ids = out.categories.map((c: any) => c.id);
  assert.equal(new Set(ids).size, 2);
  assert.equal(ids[0], "cafe");
});

// -------------------------------------------------------------- quote lines

var quoteBase = () => ({
  branchId: "ags", name: "María López", business: "Café Central", contact: "4491234567",
  need: "Lista de productos", message: "", website: "", ts: 1000,
});
var quoteOpts = { branchIds: ["ags", "durango"], nowMs: 1000 + 60000 };

test("validateQuote acepta items válidos y devuelve las líneas limpias", () => {
  var body = Object.assign(quoteBase(), { items: [{ productId: "saju-taro-ejemplo", variantId: "saju-taro-p1", qty: 2 }, { productId: "cafetera-ejemplo", variantId: "", qty: 1 }] });
  var r = S.validateQuote(body, quoteOpts);
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items[1], { productId: "cafetera-ejemplo", variantId: "", qty: 1 });
  assert.equal(S.validateQuote(Object.assign(quoteBase(), { items: [] }), quoteOpts).ok, true);
  assert.equal(S.validateQuote(quoteBase(), quoteOpts).ok, true);
  assert.equal(S.validateQuote(quoteBase(), quoteOpts).items.length, 0);
});

test("validateQuote rechaza items mal formados", () => {
  var good = { productId: "saju-taro-ejemplo", variantId: "saju-taro-p1", qty: 1 };
  var bads: any[] = [
    Array.from({ length: 41 }, () => good),
    [Object.assign({}, good, { qty: 0 })],
    [Object.assign({}, good, { qty: "2" })],
    [Object.assign({}, good, { qty: 1000 })],
    [Object.assign({}, good, { qty: 1.5 })],
    [Object.assign({}, good, { productId: "MAL ID" })],
    [Object.assign({}, good, { productId: 5 })],
    [Object.assign({}, good, { variantId: "x" })],
    [null],
    ["texto"],
    "no-es-lista",
    { productId: "a-b" },
  ];
  for (var items of bads) {
    var r = S.validateQuote(Object.assign(quoteBase(), { items: items }), quoteOpts);
    assert.equal(r.ok, false, JSON.stringify(items).slice(0, 60));
    assert.equal(r.errors[0].field, "items");
    assert.equal(r.errors[0].message, "Revisa los productos de tu lista.");
  }
  assert.equal(S.validateQuote(Object.assign(quoteBase(), { items: Array.from({ length: 40 }, () => good) }), quoteOpts).ok, true);
});

var catalogContent = () => ({
  categories: clone(D.categories), products: clone(D.products),
  variants: clone(D.variants).map((v: any) => (v.id === "saju-taro-p1" ? Object.assign(v, { price: 1250, sku: "SJ-TARO-1K", unit: "kg", name: "1 kg" }) : v)),
});

test("resolveQuoteLines resuelve desde la hoja y conserva las líneas desconocidas con found:false", () => {
  var lines = S.resolveQuoteLines(
    [
      { productId: "saju-taro-ejemplo", variantId: "saju-taro-p1", qty: 2 },
      { productId: "cafetera-ejemplo", variantId: "", qty: 1 },
      { productId: "fantasma-uno", variantId: "fantasma-v", qty: 3 },
      { productId: "saju-taro-ejemplo", variantId: "otra-variante", qty: 1 },
    ],
    catalogContent(),
  );
  assert.equal(lines.length, 4);
  assert.deepEqual(lines[0], { productId: "saju-taro-ejemplo", variantId: "saju-taro-p1", qty: 2, name: "Base para frappé sabor taro (ejemplo)", brand: "Saju", variant: "1 kg", sku: "SJ-TARO-1K", unit: "kg", price: 1250, found: true });
  assert.equal(lines[1].found, true);
  assert.equal(lines[1].variant, "");
  assert.equal(lines[1].price, null);
  assert.equal(lines[2].found, false);
  assert.equal(lines[2].name, "fantasma-uno");
  assert.equal(lines[2].variant, "(no encontrado)");
  assert.equal(lines[3].found, false);
  assert.equal(lines[3].name, "Base para frappé sabor taro (ejemplo)");
});

test("resolveQuoteLines ignora productos y presentaciones ocultos, y usa el catálogo heredado si no hay líneas", () => {
  var c = catalogContent();
  c.products.find((p: any) => p.id === "saju-taro-ejemplo").visible = false;
  c = clone(c);
  assert.equal(S.resolveQuoteLines([{ productId: "saju-taro-ejemplo", variantId: "saju-taro-p1", qty: 1 }], c)[0].found, false);
  var legacy = { machineryCategories: D.machineryCategories, insumos: D.insumos, machines: D.machines, categories: [], products: [], variants: [] };
  var l = S.resolveQuoteLines([{ productId: "cafeteras-modelo", variantId: "cafeteras-modelo-std", qty: 1 }], legacy);
  assert.equal(l[0].found, false, "la máquina semilla está oculta");
  legacy.machines = [Object.assign({}, D.machines[0], { visible: true })];
  var l2 = S.resolveQuoteLines([{ productId: "cafeteras-modelo", variantId: "cafeteras-modelo-std", qty: 1 }], legacy);
  assert.equal(l2[0].found, true);
  assert.equal(l2[0].variant, "Modelo estándar");
});

test("buildQuoteEmail con productos: asunto, tabla, Por cotizar y subtotal solo con precios", () => {
  var lines = S.resolveQuoteLines(
    [{ productId: "saju-taro-ejemplo", variantId: "saju-taro-p1", qty: 2 }, { productId: "cafetera-ejemplo", variantId: "", qty: 1 }],
    catalogContent(),
  );
  var mail = S.buildQuoteEmail(quoteBase(), D.branches[0], D.site, "2026-10-15T10:00:00Z", "15/10/2026 10:00", lines);
  assert.match(mail.subject, /María López \(Café Central\) · 2 productos$/);
  assert.match(mail.text, /Productos:/);
  assert.match(mail.text, /- 2 × Base para frappé sabor taro \(ejemplo\) · 1 kg · SKU SJ-TARO-1K · \$1,250\.00 \/ kg/);
  assert.match(mail.text, /- 1 × Cafetera espresso de 2 grupos \(ejemplo\) · Por cotizar/);
  assert.match(mail.text, /Subtotal estimado \(solo productos con precio\): \$2,500 MXN/);
  assert.match(mail.html, /<th [^>]*>Cant\.<\/th>/);
  assert.match(mail.html, /Por cotizar/);
  assert.match(mail.html, /\$1,250\.00/);
  assert.match(mail.html, /Subtotal estimado/);

  var single = S.buildQuoteEmail(quoteBase(), D.branches[0], D.site, "", "", [lines[1]]);
  assert.match(single.subject, /· 1 producto$/);
  assert.doesNotMatch(single.text, /Subtotal/);
  assert.doesNotMatch(single.html, /Subtotal/);
});

test("buildQuoteEmail sin productos es idéntico al de la ronda 1", () => {
  var a = S.buildQuoteEmail(quoteBase(), D.branches[0], D.site, "x", "y");
  var b = S.buildQuoteEmail(quoteBase(), D.branches[0], D.site, "x", "y", []);
  assert.deepEqual(a, b);
  assert.doesNotMatch(a.subject, /producto/);
  assert.doesNotMatch(a.html, /Productos/);
});

test("buildQuoteEmail no deja pasar HTML ni saltos de línea desde los nombres de producto", () => {
  var c = catalogContent();
  c.products[0].name = '<img src=x onerror=alert(1)>\nCC: x@y.co';
  var lines = S.resolveQuoteLines([{ productId: c.products[0].id, variantId: "", qty: 1 }], c);
  var mail = S.buildQuoteEmail(quoteBase(), D.branches[0], D.site, "", "", lines);
  assert.doesNotMatch(mail.html, /<img/);
  assert.match(mail.html, /&lt;img/);
  assert.doesNotMatch(mail.subject, /[\r\n]/);
});

test("quoteLinesToCell resume las líneas y se corta a 2000 caracteres", () => {
  var lines = S.resolveQuoteLines(
    [{ productId: "saju-taro-ejemplo", variantId: "saju-taro-p1", qty: 2 }, { productId: "cafetera-ejemplo", variantId: "", qty: 1 }],
    catalogContent(),
  );
  assert.equal(S.quoteLinesToCell(lines), "2 × Base para frappé sabor taro (ejemplo) · 1 kg [SJ-TARO-1K]; 1 × Cafetera espresso de 2 grupos (ejemplo)");
  assert.equal(S.quoteLinesToCell([]), "");
  var many = Array.from({ length: 40 }, () => Object.assign({}, lines[0], { name: "N".repeat(100) }));
  var cell = S.quoteLinesToCell(many);
  assert.equal(cell.length, 2000);
  assert.ok(cell.endsWith("…"));
});

test("logRowFromHeaders coloca cada valor bajo su encabezado (9 columnas, 10, reordenado, con columna extra)", () => {
  var byHeader = {
    "Fecha": "15/10/2026", "Sucursal": "Aguascalientes", "Nombre": "Ana", "Negocio": "", "Contacto": "449",
    "Qué busca": "Lista de productos", "Mensaje": "", "Destinatarios": "a@b.co", "Estatus envío": "Enviado", "Productos": "2 × X",
    "No existe en el esquema": "ignorado",
  };
  var nine = S.SCHEMA.logs.quotes.headers.slice(0, 9);
  var ten = S.SCHEMA.logs.quotes.headers;
  assert.equal(ten[9], "Productos");
  var r9 = S.logRowFromHeaders(nine, byHeader);
  assert.equal(r9.length, 9);
  assert.equal(r9[8], "Enviado");
  var r10 = S.logRowFromHeaders(ten, byHeader);
  assert.equal(r10.length, 10);
  assert.equal(r10[9], "2 × X");
  assert.deepEqual(r10.slice(0, 9), r9);
  var reordered = ["Productos", "Nombre", " Fecha ", "Estatus envío"];
  assert.deepEqual(S.logRowFromHeaders(reordered, byHeader), ["2 × X", "Ana", "15/10/2026", "Enviado"]);
  var extra = nine.slice(0, 4).concat(["Nota del dueño"], nine.slice(4), ["Productos"]);
  var rx = S.logRowFromHeaders(extra, byHeader);
  assert.equal(rx.length, 11);
  assert.equal(rx[4], "", "la columna insertada a mano queda vacía");
  assert.equal(rx[5], "449");
  assert.equal(rx[10], "2 × X");
  assert.deepEqual(S.logRowFromHeaders(["Fecha", ""], { "": "x", Fecha: null }), ["", ""]);
});

// ----------------------------------------------------- public shape / uploads

test("dropLegacyWhenCatalog vacía los arreglos heredados solo cuando hay categorías visibles", () => {
  var withCatalog = S.dropLegacyWhenCatalog(clone(D));
  assert.deepEqual([withCatalog.machineryCategories, withCatalog.machines, withCatalog.insumos], [[], [], []]);
  assert.equal(withCatalog.categories.length, 7);
  var legacyOnly = clone(D);
  legacyOnly.categories = [];
  legacyOnly = S.dropLegacyWhenCatalog(legacyOnly);
  assert.equal(legacyOnly.machineryCategories.length, 3);
  assert.equal(legacyOnly.insumos.length, 4);
  var hidden = clone(D);
  hidden.categories.forEach((c: any) => (c.visible = false));
  assert.equal(S.dropLegacyWhenCatalog(hidden).insumos.length, 4);
});

test("rowsToContent sin las pestañas del catálogo devuelve listas vacías (script nuevo, hoja vieja)", () => {
  var tabs = tabsFrom(D);
  delete tabs.Categorias;
  delete tabs.Productos;
  delete tabs.Variantes;
  var content = S.rowsToContent(tabs);
  assert.deepEqual([content.categories, content.products, content.variants], [[], [], []]);
  assert.equal(content.insumos.length, 4);
});

test("uploadImage: las tres cajas nuevas existen y el nombre de archivo lleva el índice de la foto", () => {
  var base = { section: "products", field: "photos", itemId: "saju-taro-ejemplo", mime: "image/png", dataBase64: "A".repeat(40), index: 2 };
  var ok = S.validateUploadMeta(base);
  assert.equal(ok.ok, true);
  assert.equal(ok.spec.w, 1200);
  assert.equal(ok.spec.h, 1200);
  assert.equal(S.uploadFileName(base, "20261015-101500", "webp"), "products-saju-taro-ejemplo-2-20261015-101500.webp");
  assert.equal(S.uploadFileName({ section: "categories", itemId: "molinos" }, "20261015-101500", "jpg"), "categories-molinos-20261015-101500.jpg");
  assert.equal(S.validateUploadMeta(Object.assign({}, base, { index: -1 })).ok, false);
  assert.equal(S.validateUploadMeta(Object.assign({}, base, { index: "1" })).ok, false);
  assert.equal(S.validateUploadMeta({ section: "variants", field: "image", itemId: "saju-taro-p1", mime: "image/jpeg", dataBase64: "A".repeat(40) }).ok, true);
  assert.equal(S.validateUploadMeta({ section: "categories", field: "image", itemId: "molinos", mime: "image/webp", dataBase64: "A".repeat(40) }).ok, true);
  assert.equal(S.validateUploadMeta(Object.assign({}, base, { mime: "image/svg+xml" })).ok, true, "keepAlpha admite SVG como en las máquinas");
});
