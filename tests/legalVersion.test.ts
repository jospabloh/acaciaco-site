// tests/legalVersion.test.ts
//
// legal/version.json is what the apps read to know which version of the terms
// a tenant has to accept, and each acceptance is stored with that version and
// the hash of the text. So the manifest must never describe a text other than
// the one being served: change a word of the terms and this fails until
// someone decides whether it is a new version (bump `version`, write
// `changes_es`, every tenant accepts again) or a correction of form (update
// only the hash).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const manifest = JSON.parse(read("../legal/version.json"));
const terminos = read("../legal/terminos.html");
const privacidad = read("../legal/privacidad.html");

// The text a tenant accepts is the <article>, not the nav or the footer.
function articleHash(html) {
  const m = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
  assert.ok(m, "the page has an <article>");
  const text = m[1].replace(/\s+/g, " ").trim();
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function lastUpdatedISO(html) {
  const m = html.match(/Última actualización: (\d{1,2}) de ([a-záéíóú]+) de (\d{4})/);
  assert.ok(m, "the page states its last update");
  const month = MONTHS.indexOf(m[2]) + 1;
  assert.ok(month > 0, `unknown month "${m[2]}"`);
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

test("the manifest's hash is the hash of the terms being served", () => {
  assert.equal(
    manifest.documents.terminos.sha256,
    articleHash(terminos),
    "legal/terminos.html changed. New version (bump `version` and `changes_es`) or a correction of form? Either way update documents.terminos.sha256.",
  );
});

test("the version printed on the terms page is the manifest's", () => {
  const m = terminos.match(/Versión (\d{4}-\d{2}-\d{2})/);
  assert.ok(m, "the terms page prints its version");
  assert.equal(m[1], manifest.version);
});

test("the version is a date and its grace period is at least 30 days", () => {
  assert.match(manifest.version, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(manifest.published, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Number.isInteger(manifest.grace_days) && manifest.grace_days >= 30);
});

test("the manifest says what changed, so the app can show it before asking", () => {
  assert.ok(Array.isArray(manifest.changes_es) && manifest.changes_es.length > 0);
  for (const line of manifest.changes_es) assert.ok(typeof line === "string" && line.trim().length > 0);
});

test("the manifest's date for the privacy notice is the one the notice shows", () => {
  assert.equal(manifest.documents.privacidad.updated, lastUpdatedISO(privacidad));
});

test("the manifest points at the two pages by their public address", () => {
  assert.equal(manifest.documents.terminos.url, "https://acaciaco.com.mx/legal/terminos");
  assert.equal(manifest.documents.privacidad.url, "https://acaciaco.com.mx/legal/privacidad");
});
