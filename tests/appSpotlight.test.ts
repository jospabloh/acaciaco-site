// tests/appSpotlight.test.ts
// scripts/app-spotlight.js holds a short copy of what each apps/<slug>.html says.
// These tests keep that copy structurally honest; wording stays a human review.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = (p: string) => fileURLToPath(new URL("../" + p, import.meta.url));

function loadScript(file: string, exportsKey: string) {
  const sandbox: any = { window: {} };
  vm.runInNewContext(readFileSync(root(file), "utf8"), sandbox);
  return sandbox.window[exportsKey];
}

const SLUGS = ["stockflow", "flowfin", "cateqhub", "puntos-plus", "liuma", "rumbo",
  "artiskids", "sommel", "kitchops", "ctrlhq", "radar"];
const spot = loadScript("scripts/app-spotlight.js", "ACACIA_APP_SPOTLIGHT");
const data = spot.data as Record<string, any>;

test("all 11 apps are present, and only them", () => {
  assert.deepEqual(Object.keys(data).sort(), [...SLUGS].sort());
});

test("each app has 4-5 bullets of at most 60 characters", () => {
  for (const slug of SLUGS) {
    const f: string[] = data[slug].features;
    assert.ok(f.length >= 4 && f.length <= 5, `${slug}: ${f.length} bullets`);
    for (const b of f) assert.ok(b.length <= 60, `${slug}: "${b}" is ${b.length} chars`);
    assert.ok(data[slug].tagline.length > 20, `${slug}: tagline`);
  }
});

test("every slug has an app page and the status matches its hero eyebrow", () => {
  for (const slug of SLUGS) {
    const file = `apps/${slug}.html`;
    assert.ok(existsSync(root(file)), `${file} missing`);
    const html = readFileSync(root(file), "utf8");
    const eyebrow = /<span class="eyebrow">.*?<\/span>\s*([^<]+)</s.exec(html)?.[1].trim() ?? "";
    const pageStatus = eyebrow.startsWith("Disponible") ? "live" : eyebrow.startsWith("En desarrollo") ? "dev" : "?";
    assert.equal(data[slug].status, pageStatus, `${slug}: map says ${data[slug].status}, page eyebrow says "${eyebrow}"`);
  }
});

test("logos exist on disk (RADAR draws an inline mark instead)", () => {
  for (const slug of SLUGS) {
    const logo = data[slug].logo;
    if (slug === "radar") { assert.equal(logo, null); continue; }
    assert.ok(existsSync(root(logo.slice(1))), `${slug}: ${logo} missing`);
  }
});

test("no bullet or tagline says gratis/demo, and RADAR never mentions WhatsApp", () => {
  for (const slug of SLUGS) {
    const text = [data[slug].tagline, ...data[slug].features].join(" ");
    assert.doesNotMatch(text, /gratis|demo/i, `${slug}: banned word`);
    if (slug === "radar") assert.doesNotMatch(text, /whatsapp/i, "radar: WhatsApp");
  }
});

test("homepage static default is StockFlow and matches its map entry", () => {
  const html = readFileSync(root("index.html"), "utf8");
  assert.match(html, /id="app-del-mes"[^>]*data-spot-slug="stockflow"/);
  const sf = data.stockflow;
  assert.ok(html.includes(sf.tagline));
  for (const b of sf.features) assert.ok(html.includes(b), `index.html lacks bullet "${b}"`);
});

test("testimonials.js display names equal the spotlight names", () => {
  const names = loadScript("scripts/testimonials.js", "ACACIA_APP_NAMES");
  for (const slug of SLUGS) assert.equal(names[slug], data[slug].name);
});

test("every app page mounts the testimonials slot before A LA MEDIDA and loads the script", () => {
  for (const slug of SLUGS) {
    const html = readFileSync(root(`apps/${slug}.html`), "utf8");
    const mount = html.indexOf(`<div data-testimonials="${slug}"></div>`);
    const medida = html.indexOf("<!-- A LA MEDIDA -->");
    assert.ok(mount > 0 && mount < medida, `${slug}: mount`);
    assert.ok(html.includes('/scripts/testimonials.js'), `${slug}: script`);
  }
});
