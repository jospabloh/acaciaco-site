import { test } from "node:test";
import assert from "node:assert/strict";
import { selectByFolio, selectByRfc } from "../api/roseta/_facturaRows.ts";

const HEADER = ["Folio"];
function r(folio: string, fecha: string, rfc: string, estatus = "Pendiente"): string[] {
  return [
    folio, fecha, rfc, "Juan Pérez", "612", "G03", "20000", "juan@ejemplo.com",
    "4490000000", "UAA", "2026-07-31", "348.00", "Efectivo", "MOV-1",
    estatus, "", "300.00", "48.00", "", "",
  ];
}

const ROWS = [
  HEADER,
  r("RF-A", "2026-08-01", "XAXX010101000"),
  r("RF-B", "2026-07-28", "XAXX010101000", "Facturada"),
  r("RF-C", "2026-06-01", "XAXX010101000"),          // fuera de la ventana
  r("RF-D", "2026-08-02", "XEXX010101000"),          // otro RFC
];

test("selectByFolio encuentra el folio sin importar su antigüedad", () => {
  const found = selectByFolio(ROWS, "RF-C");
  assert.equal(found.length, 1);
  assert.equal(found[0].folio, "RF-C");
});

test("selectByFolio no distingue mayúsculas", () => {
  assert.equal(selectByFolio(ROWS, "rf-a").length, 1);
});

test("selectByFolio devuelve vacío para un folio inexistente", () => {
  assert.deepEqual(selectByFolio(ROWS, "RF-NOPE"), []);
});

test("selectByRfc devuelve sólo lo de la ventana de 30 días", () => {
  const { solicitudes } = selectByRfc(ROWS, "XAXX010101000", "2026-08-05");
  assert.deepEqual(solicitudes.map((s) => s.folio), ["RF-A", "RF-B"]);
});

test("selectByRfc ordena de la más reciente a la más antigua", () => {
  const { solicitudes } = selectByRfc(ROWS, "XAXX010101000", "2026-08-05");
  assert.equal(solicitudes[0].folio, "RF-A");
});

test("selectByRfc distingue 'no existe' de 'nada en la ventana'", () => {
  const vacio = selectByRfc(ROWS, "XAXX010101000", "2026-10-01");
  assert.equal(vacio.solicitudes.length, 0);
  assert.equal(vacio.rfcExists, true);

  const inexistente = selectByRfc(ROWS, "XQQQ010101000", "2026-08-05");
  assert.equal(inexistente.solicitudes.length, 0);
  assert.equal(inexistente.rfcExists, false);
});

test("selectByRfc no filtra datos personales", () => {
  const { solicitudes } = selectByRfc(ROWS, "XAXX010101000", "2026-08-05");
  const blob = JSON.stringify(solicitudes);
  for (const leaked of ["juan@ejemplo.com", "Juan Pérez", "4490000000"]) {
    assert.equal(blob.includes(leaked), false, `se filtró ${leaked}`);
  }
});
