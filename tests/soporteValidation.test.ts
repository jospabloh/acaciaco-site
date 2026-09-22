// tests/soporteValidation.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateSoporteSubmission, KNOWN_APPS } from "../api/_soporteValidation.ts";

test("accepts a valid soporte submission for a known app", () => {
  const r = validateSoporteSubmission({
    name: "Ana Pérez", email: "ana@example.com",
    app_interest: "StockFlow", type: "soporte", message: "No me deja guardar un gasto.",
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { name: "Ana Pérez", email: "ana@example.com", appInterest: "StockFlow", type: "soporte", message: "No me deja guardar un gasto." });
});

test("accepts mejora the same way", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "Rumbo", type: "mejora", message: "Sería útil exportar a Excel." });
  assert.equal(r.ok, true);
  assert.equal(r.data?.type, "mejora");
});

test("__idea__ sentinel with an explicit non-idea type is rejected, not silently overridden", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "__idea__", type: "soporte", message: "Deberían tener una app para X." });
  assert.equal(r.ok, false);
});

test("__idea__ sentinel with no type (or type=idea) succeeds with appInterest null", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "__idea__", message: "Deberían tener una app para X." });
  assert.equal(r.ok, true);
  assert.equal(r.data?.appInterest, null);
  assert.equal(r.data?.type, "idea");
});

test("rejects an unknown app name", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "AppQueNoExiste", type: "soporte", message: "x" });
  assert.equal(r.ok, false);
});

test("rejects missing name", () => {
  const r = validateSoporteSubmission({ email: "a@a.com", app_interest: "StockFlow", type: "soporte", message: "x" });
  assert.equal(r.ok, false);
});

test("rejects invalid email", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "no-es-correo", app_interest: "StockFlow", type: "soporte", message: "x" });
  assert.equal(r.ok, false);
});

test("rejects empty message", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "StockFlow", type: "soporte", message: "   " });
  assert.equal(r.ok, false);
});

test("rejects a real app with neither soporte nor mejora as type", () => {
  const r = validateSoporteSubmission({ name: "Ana", email: "a@a.com", app_interest: "StockFlow", type: "idea", message: "x" });
  assert.equal(r.ok, false);
});

test("KNOWN_APPS has the 10 portfolio apps, matching the sales lead form's dropdown text", () => {
  assert.deepEqual(KNOWN_APPS, ["Puntos+", "FlowFin", "StockFlow", "Rumbo", "LIUMA", "CateqHub", "RADAR", "CtrlHQ", "KitchOps", "ArtisKids"]);
});

// This is the real gate behind the "these must stay in sync" comments in
// soporte.html and api/_soporteValidation.ts — a mismatch here means the
// dropdown offers an app the backend will reject, or vice versa.
test("soporte.html's #sop-app dropdown options match KNOWN_APPS + the __idea__ sentinel", () => {
  const soporteHtmlPath = fileURLToPath(new URL("../soporte.html", import.meta.url));
  const html = readFileSync(soporteHtmlPath, "utf8");

  const selectMatch = /<select id="sop-app"[^>]*>([\s\S]*?)<\/select>/.exec(html);
  assert.ok(selectMatch, "soporte.html must contain a #sop-app <select> block");

  const optionValues = [...selectMatch[1].matchAll(/<option value="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((v) => v !== ""); // the disabled "Elige una app…" placeholder

  const expected = [...KNOWN_APPS, "__idea__"];
  assert.deepEqual(optionValues.slice().sort(), expected.slice().sort());
});
