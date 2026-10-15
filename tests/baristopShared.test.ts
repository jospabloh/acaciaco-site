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
  var ctx = { categoryIds: D.machineryCategories.map((c: any) => c.id) };
  S.SECTION_NAMES.forEach((name: string) => {
    var r = S.validateSection(name, name === "site" ? D.site : D[name], ctx);
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
  assert.equal(S.QUOTE_NEEDS.length, 6);
  assert.ok(S.QUOTE_NEEDS.includes("Franquicia / Baristop en mi ciudad"));
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
