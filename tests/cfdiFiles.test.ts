import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCfdiFile, MAX_COMBINED_B64_LEN } from "../api/roseta/_cfdiFiles.ts";

function dataUrl(mime: string, body: string): string {
  return `data:${mime};base64,${Buffer.from(body, "latin1").toString("base64")}`;
}

const PDF = { name: "factura.pdf", dataUrl: dataUrl("application/pdf", "%PDF-1.7\nbody") };
const XML = { name: "factura.xml", dataUrl: dataUrl("application/xml", '<?xml version="1.0"?><cfdi:Comprobante/>') };

test("acepta un PDF con la firma correcta", () => {
  const f = parseCfdiFile(PDF, "pdf");
  assert.equal(f?.filename, "factura.pdf");
  assert.ok(f?.content.length);
});

test("acepta un XML con declaración", () => {
  assert.equal(parseCfdiFile(XML, "xml")?.filename, "factura.xml");
});

test("acepta un XML sin declaración pero que abre con etiqueta", () => {
  const f = { name: "cfdi.xml", dataUrl: dataUrl("application/xml", "<cfdi:Comprobante/>") };
  assert.ok(parseCfdiFile(f, "xml"));
});

test("rechaza un PDF cuyo contenido no es PDF", () => {
  const fake = { name: "factura.pdf", dataUrl: dataUrl("application/pdf", "GIF89a not a pdf") };
  assert.equal(parseCfdiFile(fake, "pdf"), null);
});

test("rechaza un XML cuyo contenido no es XML", () => {
  const fake = { name: "factura.xml", dataUrl: dataUrl("application/xml", "%PDF-1.7") };
  assert.equal(parseCfdiFile(fake, "xml"), null);
});

test("rechaza una extensión que no corresponde", () => {
  assert.equal(parseCfdiFile({ name: "factura.txt", dataUrl: PDF.dataUrl }, "pdf"), null);
});

test("rechaza un PDF donde se espera un XML", () => {
  assert.equal(parseCfdiFile(PDF, "xml"), null);
});

test("rechaza entradas vacías o mal formadas", () => {
  assert.equal(parseCfdiFile(null, "pdf"), null);
  assert.equal(parseCfdiFile({}, "pdf"), null);
  assert.equal(parseCfdiFile({ name: "a.pdf", dataUrl: "no-es-data-url" }, "pdf"), null);
});

test("rechaza un archivo que excede el tope de tamaño", () => {
  const huge = { name: "factura.pdf", dataUrl: `data:application/pdf;base64,${"A".repeat(MAX_COMBINED_B64_LEN + 1)}` };
  assert.equal(parseCfdiFile(huge, "pdf"), null);
});

test("la extensión no distingue mayúsculas", () => {
  assert.ok(parseCfdiFile({ name: "FACTURA.PDF", dataUrl: PDF.dataUrl }, "pdf"));
});
