import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FIELD_LABELS,
  REGIMEN_CATALOG,
  REGIMEN_CLAVES,
  USO_CLAVES,
  invalidFields,
  invalidFieldsMessage,
  resolveRegimenClave,
} from "../api/roseta/_facturaValidation.ts";

// The request a real customer sent on 2026-09-07, with every field valid.
// Each case below breaks exactly one thing, so a failure names the culprit.
function validRequest() {
  return {
    rfc: "DCM150604MG0",
    razon_social: "MERCEDES-BENZ MEXICO INTERNATIONAL",
    regimen_fiscal: "601",
    uso_cfdi: "G03",
    codigo_postal: "05348",
    email: "mauricio.landin@mercedes-benz.com",
    sucursal: "Fico 3C (Tres Centurias)",
    fecha_consumo: "2026-04-09",
    monto: "479",
    forma_pago: "Tarjeta de débito",
    folio_ticket: "77668",
    sin_movimiento: false,
  };
}

test("a fully valid request has no invalid fields", () => {
  assert.deepEqual(invalidFields(validRequest()), []);
});

// This is the bug the module exists for: a persona moral's CSF prints the
// régimen description without its clave, the form built an <option value="">
// from it, and that option passes checkValidity() because only the FIRST
// empty option counts as a placeholder. The request reached the server with a
// blank régimen and everything else perfect — and had to come back naming it.
test("an empty régimen is caught, and named", () => {
  const req = validRequest();
  req.regimen_fiscal = "";
  assert.deepEqual(invalidFields(req), ["regimen_fiscal"]);
  assert.match(invalidFieldsMessage(invalidFields(req)), /Régimen fiscal/);
});

test("a régimen outside the catalog is rejected, not just a blank one", () => {
  const req = validRequest();
  req.regimen_fiscal = "Régimen General de Ley Personas Morales";
  assert.deepEqual(invalidFields(req), ["regimen_fiscal"]);
});

test("a uso de CFDI outside the catalog is rejected", () => {
  const req = validRequest();
  req.uso_cfdi = "D01";
  assert.deepEqual(invalidFields(req), ["uso_cfdi"]);
});

test("a hyphenated corporate email domain stays valid", () => {
  // mercedes-benz.com — a regex that forgot the hyphen would reject a real
  // customer's address while the browser's type=email accepted it.
  assert.deepEqual(invalidFields(validRequest()), []);
});

test("RFC accepts both 12-char (moral) and 13-char (física) forms", () => {
  const moral = validRequest();
  assert.deepEqual(invalidFields(moral), []);
  const fisica = validRequest();
  fisica.rfc = "XAXX010101000";
  assert.deepEqual(invalidFields(fisica), []);
  const bad = validRequest();
  bad.rfc = "DCM15060";
  assert.deepEqual(invalidFields(bad), ["rfc"]);
});

test("movimiento is required unless the customer said they don't have it", () => {
  const missing = validRequest();
  missing.folio_ticket = "";
  assert.deepEqual(invalidFields(missing), ["folio_ticket"]);

  const waived = validRequest();
  waived.folio_ticket = "";
  waived.sin_movimiento = true;
  assert.deepEqual(invalidFields(waived), []);
});

test("a zero or negative monto is invalid", () => {
  for (const monto of ["0", "-5", "", "abc"]) {
    const req = validRequest();
    req.monto = monto;
    assert.deepEqual(invalidFields(req), ["monto"], `monto=${monto}`);
  }
});

test("several bad fields are all reported, in form order", () => {
  const req = validRequest();
  req.codigo_postal = "5348"; // 4 digits
  req.email = "no-es-un-correo";
  req.regimen_fiscal = "";
  assert.deepEqual(invalidFields(req), ["regimen_fiscal", "codigo_postal", "email"]);
  assert.equal(
    invalidFieldsMessage(invalidFields(req)),
    "Revisa estos datos: Régimen fiscal, Código postal y Correo.",
  );
});

test("every payload key the validator can report has a Spanish label", () => {
  // Otherwise the client's fallback panel names a raw key at the customer.
  const req = validRequest();
  req.rfc = "";
  req.razon_social = "";
  req.regimen_fiscal = "";
  req.uso_cfdi = "";
  req.codigo_postal = "";
  req.email = "";
  req.sucursal = "";
  req.fecha_consumo = "";
  req.monto = "";
  req.forma_pago = "";
  req.folio_ticket = "";
  for (const key of invalidFields(req)) {
    assert.ok(FIELD_LABELS[key], `missing label for ${key}`);
  }
});

// Same guarantee tests/soporteValidation.test.ts gives soporte.html's app
// dropdown: an <option> the backend would reject can never ship, and a clave
// nothing can select can never linger here.
function optionValues(html: string, selectId: string): string[] {
  const select = new RegExp(`<select[^>]*id="${selectId}"[^>]*>([\\s\\S]*?)</select>`).exec(html);
  assert.ok(select, `no <select id="${selectId}"> in roseta/factura/index.html`);
  return [...select[1].matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
}

test("the form's régimen and uso options match the catalogs the server enforces", () => {
  const html = readFileSync(new URL("../roseta/factura/index.html", import.meta.url), "utf8");
  assert.deepEqual(optionValues(html, "regimen").sort(), [...REGIMEN_CLAVES].sort());
  assert.deepEqual(optionValues(html, "usocfdi").sort(), [...USO_CLAVES].sort());
});

function optionLabels(html: string, selectId: string): Map<string, string> {
  const select = new RegExp(`<select[^>]*id="${selectId}"[^>]*>([\\s\\S]*?)</select>`).exec(html);
  const out = new Map<string, string>();
  for (const m of select![1].matchAll(/<option value="([^"]+)"[^>]*>([^<]*)</g)) {
    out.set(m[1], m[2].replace(/^\s*\d{3}\s*·\s*/, "").trim());
  }
  return out;
}

test("REGIMEN_CATALOG's labels are the ones the form actually displays", () => {
  // resolveRegimenClave matches a CSF's wording against these labels, so a
  // label that drifts from the form silently stops resolving its own régimen.
  const html = readFileSync(new URL("../roseta/factura/index.html", import.meta.url), "utf8");
  const fromHtml = optionLabels(html, "regimen");
  for (const { clave, label } of REGIMEN_CATALOG) {
    assert.equal(label, fromHtml.get(clave), `label drift for ${clave}`);
  }
});

// --- recovering a clave the CSF didn't print -------------------------------

// The left column is what a CSF actually prints in its "Regímenes" table.
// Two real customers were blocked by the first row: their CSF (persona moral)
// showed the description with no clave, so the form built an <option value="">
// they could select but never submit.
const CSF_WORDINGS: Array<[string, string | null]> = [
  ["Régimen General de Ley Personas Morales", "601"],
  ["Régimen de las Personas Morales con Fines no Lucrativos", "603"],
  ["Sueldos y Salarios e Ingresos Asimilados a Salarios", "605"],
  ["Régimen de Arrendamiento", "606"],
  ["Demás ingresos", "608"],
  ["Ingresos por Dividendos (socios y accionistas)", "611"],
  ["Personas Físicas con Actividades Empresariales y Profesionales", "612"],
  ["Ingresos por intereses", "614"],
  ["Sin obligaciones fiscales", "616"],
  ["Incorporación Fiscal", "621"],
  ["Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras", "622"],
  ["Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas", "625"],
  ["Régimen Simplificado de Confianza", "626"],
  // Must NOT resolve — a wrong régimen chosen for the customer is worse than
  // asking them to pick.
  ["", null],
  ["Algo que no existe en el catálogo", null],
  ["Ingresos", null], // ambiguous: matches 608, 611 and 614
];

for (const [descripcion, expected] of CSF_WORDINGS) {
  test(`clave from CSF wording: ${descripcion.slice(0, 48) || "(vacío)"} → ${expected}`, () => {
    assert.equal(resolveRegimenClave("", descripcion), expected);
  });
}

test("every catalog label resolves to its own clave", () => {
  for (const { clave, label } of REGIMEN_CATALOG) {
    assert.equal(resolveRegimenClave("", label), clave, `label of ${clave}`);
    assert.equal(resolveRegimenClave("", `${clave} · ${label}`), clave, `option text of ${clave}`);
  }
});

test("a clave already in the catalog is kept as-is, description ignored", () => {
  assert.equal(resolveRegimenClave("612", "cualquier cosa"), "612");
  assert.equal(resolveRegimenClave("  601  ", ""), "601");
});

test("a clave outside the catalog falls back to the description", () => {
  assert.equal(resolveRegimenClave("999", "Régimen General de Ley Personas Morales"), "601");
  assert.equal(resolveRegimenClave("999", "no coincide con nada"), null);
});

test("a submitted régimen recovered from its label is not reported invalid", () => {
  // End to end for the reported case: the old cached form sends an empty
  // regimen_fiscal plus the label it displayed. factura-submit resolves it,
  // so invalidFields sees a real clave and the customer goes through.
  const recovered = resolveRegimenClave("", "· Régimen General de Ley Personas Morales");
  assert.equal(recovered, "601");
  const req = validRequest();
  req.regimen_fiscal = recovered!;
  assert.deepEqual(invalidFields(req), []);
});
