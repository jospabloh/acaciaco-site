// tests/rankingLogic.test.ts
// Pure decision logic of scripts/apps-grid.js (who leads, which metric) loaded
// off disk with no DOM, the way the other tests read files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = (p: string) => fileURLToPath(new URL("../" + p, import.meta.url));
const sandbox: any = { window: {} };
vm.runInNewContext(readFileSync(root("scripts/app-spotlight.js"), "utf8"), sandbox);
vm.runInNewContext(readFileSync(root("scripts/apps-grid.js"), "utf8"), sandbox);
const R = sandbox.window.ACACIA_RANKING;
const known = sandbox.window.ACACIA_APP_SPOTLIGHT.data;
const slugs = Object.keys(known);
const zeros = Object.fromEntries(slugs.map((s) => [s, { visitsMonth: 0, visits30: 0 }]));
const spot = (p: any) => R.chooseSpotlight(p, known);
const lead = (p: any) => R.pickLeader(p.visits, slugs, R.metricFor(p), p.topApp);

test("metric: month payload -> visitsMonth, otherwise visits30; bad months ignored", () => {
  assert.equal(R.metricFor({ month: "2026-09" }), "visitsMonth");
  assert.equal(R.metricFor({ month: "2026-12" }), "visitsMonth");
  for (const m of ["2026-13", "abc", "", null, 5, "2026-9"]) assert.equal(R.metricFor({ month: m }), "visits30");
  assert.equal(R.metricFor(null), "visits30");
});

test("unknown / zero / bucketless topApp never produces a claim", () => {
  assert.equal(spot({ month: "2026-09", topApp: "nope", visits: zeros }), null);
  assert.equal(lead({ month: "2026-09", topApp: "nope", visits: zeros }), null);
  const rz = { ...zeros, rumbo: { visitsMonth: 0 } };
  assert.equal(spot({ month: "2026-09", topApp: "rumbo", visits: rz }), null);
  assert.equal(lead({ month: "2026-09", topApp: "rumbo", visits: rz }), null);
});

test("server pick without a bucket falls back to the real maximum, and tag and box agree", () => {
  const p = { month: "2026-09", topApp: "rumbo", visits: { flowfin: { visitsMonth: 40 } } };
  assert.equal(spot(p).slug, "flowfin");
  assert.equal(lead(p), "flowfin");
  assert.equal(spot(p).eyebrow, "App del mes · la más visitada de septiembre 2026");
});

test("a valid server pick is honoured", () => {
  const p = { month: "2026-12", topApp: "rumbo", visits: { rumbo: { visitsMonth: 3 }, flowfin: { visitsMonth: 40 } } };
  assert.equal(spot(p).slug, "rumbo");
  assert.equal(lead(p), "rumbo");
  assert.match(spot(p).eyebrow, /diciembre 2026$/);
});

test("prototype keys and malformed shapes cannot throw or claim anything", () => {
  for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    assert.doesNotThrow(() => spot({ month: "2026-09", topApp: key, visits: zeros }));
    assert.equal(spot({ month: "2026-09", topApp: key, visits: zeros }), null);
    assert.equal(R.valueOf({}, key, "visits30"), 0);
  }
  for (const visits of ["nope", 5, null, [], true]) {
    assert.doesNotThrow(() => spot({ month: "2026-09", topApp: "rumbo", visits }));
    assert.equal(spot({ month: "2026-09", topApp: "rumbo", visits }), null);
  }
  assert.equal(spot(null), null);
  assert.equal(R.valueOf({ a: "x" }, "a", "visits30"), 0);
  assert.equal(R.valueOf({ a: { visits30: "NaN" } }, "a", "visits30"), 0);
  assert.equal(R.valueOf({ a: { visits30: -5 } }, "a", "visits30"), 0);
});

test("old payload: leader by visits30, 30-day label, none on a zero tie", () => {
  const p = { visits: { radar: { visits30: 80 }, flowfin: { visits30: 50 } }, topApp: "rumbo" };
  assert.equal(spot(p).slug, "radar");
  assert.equal(spot(p).eyebrow, "App más visitada · últimos 30 días");
  assert.equal(spot({ visits: zeros }), null);
});

test("a bad month string falls back to the 30-day metric, never a monthly claim", () => {
  const p = { month: "2026-13", topApp: "rumbo", visits: { flowfin: { visits30: 9, visitsMonth: 99 } } };
  assert.equal(spot(p).eyebrow, "App más visitada · últimos 30 días");
});
